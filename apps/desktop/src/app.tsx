import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { EditorCommand } from "@outofoffice/commands";
import { parsePackagePayload, serializeDocument } from "@outofoffice/file-formats";
import { PRODUCT } from "@outofoffice/shared";
import type { RecentFile, RecoverySummary } from "@outofoffice/storage";
import { HomeScreen, type ThemeChoice } from "./components/home-screen";
import { WriteEditor, type WriteEditorHandle } from "./components/write-editor";
import {
  clearRecovery,
  discardRecovery,
  isTauri,
  listLaunchFiles,
  listRecentFiles,
  listRecoveries,
  loadInternal,
  loadRecovery,
  saveInternal,
  saveRecovery,
  selectOpenPath,
  selectSavePath,
  setRecentPinned,
} from "./lib/native";
import { sanitizeDocumentHtml } from "./lib/sanitize";
import { useEditorStore, type EditorTab } from "./stores/editor-store";

function readTheme(): ThemeChoice {
  const value = localStorage.getItem("outofoffice.theme");
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

function findTab(id: string | null): EditorTab | null {
  if (!id) return null;
  return useEditorStore.getState().tabs.find((tab) => tab.id === id) ?? null;
}

function safeFileName(title: string): string {
  const cleaned = Array.from(title, (character) =>
    '<>:"/\\|?*'.includes(character) || character.charCodeAt(0) < 32 ? "-" : character,
  ).join("");
  return cleaned.trim() || "Untitled document";
}

function escapeHtmlText(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function download(content: string, type: string, name: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = globalThis.document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.hidden = true;
  globalThis.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function App() {
  const tabs = useEditorStore((state) => state.tabs);
  const activeTabId = useEditorStore((state) => state.activeTabId);
  const activeTab = useEditorStore(
    (state) => state.tabs.find((tab) => tab.id === state.activeTabId) ?? null,
  );
  const editorRef = useRef<WriteEditorHandle>(null);
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const [recents, setRecents] = useState<RecentFile[]>([]);
  const [recoveries, setRecoveries] = useState<RecoverySummary[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);

  const flushActive = useCallback((label?: string) => editorRef.current?.flush(label), []);

  const refreshHome = useCallback(async () => {
    try {
      const [recentFiles, recoveryFiles] = await Promise.all([listRecentFiles(), listRecoveries()]);
      setRecents(recentFiles);
      setRecoveries(recoveryFiles);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }, []);

  useEffect(() => {
    void refreshHome();
  }, [refreshHome]);

  useEffect(() => {
    globalThis.document.documentElement.dataset.theme = theme;
    localStorage.setItem("outofoffice.theme", theme);
  }, [theme]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      editorRef.current?.flush();
      if (useEditorStore.getState().tabs.some((tab) => tab.dirty)) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const openPath = useCallback(
    async (providedPath?: string) => {
      try {
        setBusy(true);
        const path = providedPath ?? (await selectOpenPath());
        if (!path) {
          if (!isTauri() && !providedPath)
            setNotice("Native file dialogs are available in the installed desktop application.");
          return;
        }
        const loaded = await loadInternal(path);
        const payload = parsePackagePayload(loaded.payload);
        payload.document.content.html = sanitizeDocumentHtml(payload.document.content.html);
        useEditorStore.getState().openTab(payload.document, loaded.path);
        await refreshHome();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(false);
      }
    },
    [refreshHome],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const paths = await listLaunchFiles();
      for (const path of paths) {
        if (cancelled) return;
        await openPath(path);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openPath]);

  const saveTab = useCallback(
    async (requestedTab: EditorTab, forceDialog = false) => {
      if (requestedTab.id === useEditorStore.getState().activeTabId) flushActive();
      const tab = findTab(requestedTab.id);
      if (!tab) return false;
      try {
        setBusy(true);
        const path =
          !forceDialog && tab.path ? tab.path : await selectSavePath(tab.document.metadata.title);
        if (!path) {
          if (!isTauri()) setNotice("Run the desktop application to save native .oofdoc files.");
          return false;
        }
        const savedPath = await saveInternal(path, serializeDocument(tab.document));
        useEditorStore.getState().markSaved(tab.id, savedPath);
        await clearRecovery(tab.document.metadata.id);
        await refreshHome();
        setNotice(`Saved ${tab.document.metadata.title}`);
        return true;
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [flushActive, refreshHome],
  );

  const activate = useCallback(
    (id: string | null) => {
      if (id !== useEditorStore.getState().activeTabId) flushActive();
      useEditorStore.getState().setActive(id);
      if (id === null) void refreshHome();
    },
    [flushActive, refreshHome],
  );

  const closeImmediately = useCallback(
    async (tab: EditorTab, discard: boolean) => {
      if (discard) {
        try {
          await clearRecovery(tab.document.metadata.id);
        } catch (error) {
          setNotice(error instanceof Error ? error.message : String(error));
        }
      }
      useEditorStore.getState().closeTab(tab.id);
      setPendingCloseId(null);
      await refreshHome();
    },
    [refreshHome],
  );

  const requestClose = useCallback(
    (requestedTab: EditorTab) => {
      if (requestedTab.id === useEditorStore.getState().activeTabId) flushActive();
      const tab = findTab(requestedTab.id);
      if (!tab) return;
      if (tab.dirty) setPendingCloseId(tab.id);
      else void closeImmediately(tab, false);
    },
    [closeImmediately, flushActive],
  );

  useEffect(() => {
    if (!isTauri()) return;
    let stopped = false;
    let running = false;
    const runAutosave = async () => {
      if (running || stopped) return;
      running = true;
      try {
        editorRef.current?.flush();
        const candidates = useEditorStore
          .getState()
          .tabs.filter((tab) => tab.dirty && tab.revision > tab.recoveredRevision);
        for (const candidate of candidates) {
          if (stopped) return;
          const revision = candidate.revision;
          try {
            const timestamp = await saveRecovery(
              serializeDocument(candidate.document),
              candidate.path,
            );
            useEditorStore.getState().markAutosaved(candidate.id, revision, timestamp);
          } catch (error) {
            setNotice(error instanceof Error ? error.message : String(error));
          }
        }
      } finally {
        running = false;
      }
    };
    const timer = window.setInterval(() => void runAutosave(), 10_000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/webview")
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type === "drop")
            for (const path of event.payload.paths) void openPath(path);
        }),
      )
      .then((stop) => {
        if (disposed) stop();
        else unlisten = stop;
      })
      .catch((error: unknown) => setNotice(error instanceof Error ? error.message : String(error)));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [openPath]);

  const undo = useCallback(() => {
    flushActive();
    const id = useEditorStore.getState().activeTabId;
    if (id) useEditorStore.getState().undo(id);
  }, [flushActive]);

  const redo = useCallback(() => {
    flushActive();
    const id = useEditorStore.getState().activeTabId;
    if (id) useEditorStore.getState().redo(id);
  }, [flushActive]);

  const duplicate = useCallback(() => {
    flushActive();
    const id = useEditorStore.getState().activeTabId;
    if (id) useEditorStore.getState().duplicateTab(id);
  }, [flushActive]);

  const exportDocument = useCallback(
    (format: "html" | "txt") => {
      flushActive();
      const tab = findTab(useEditorStore.getState().activeTabId);
      if (!tab) return;
      const title = safeFileName(tab.document.metadata.title);
      const safeHtml = sanitizeDocumentHtml(tab.document.content.html);
      if (format === "html") {
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtmlText(title)}</title><style>body{max-width:760px;margin:48px auto;font:12pt/1.6 Georgia,serif;padding:0 24px}table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:6px}.page-break{break-after:page;border:0}</style></head><body>${safeHtml}</body></html>`;
        download(html, "text/html;charset=utf-8", `${title}.html`);
      } else {
        const parsed = new DOMParser().parseFromString(safeHtml, "text/html");
        download(parsed.body.textContent ?? "", "text/plain;charset=utf-8", `${title}.txt`);
      }
      setNotice(`Exported ${tab.document.metadata.title} as ${format.toUpperCase()}`);
    },
    [flushActive],
  );

  useEffect(() => {
    const shortcuts = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLocaleLowerCase();
      const target = event.target as HTMLElement | null;
      const editingField = target?.matches("input, textarea, [contenteditable='true']") ?? false;
      const current = findTab(useEditorStore.getState().activeTabId);
      if (key === "o") {
        event.preventDefault();
        void openPath();
      } else if (key === "n") {
        event.preventDefault();
        flushActive();
        useEditorStore.getState().createTab();
      } else if (key === "s" && current) {
        event.preventDefault();
        void saveTab(current, event.shiftKey);
      } else if (key === "w" && current) {
        event.preventDefault();
        requestClose(current);
      } else if (!editingField && key === "z" && current) {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (!editingField && key === "y" && current) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [flushActive, openPath, redo, requestClose, saveTab, undo]);

  const recover = useCallback(async (record: RecoverySummary) => {
    try {
      setBusy(true);
      const payload = parsePackagePayload(await loadRecovery(record.id));
      payload.document.content.html = sanitizeDocumentHtml(payload.document.content.html);
      useEditorStore.getState().openTab(payload.document, record.originalPath, record.id);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }, []);

  const pendingClose = findTab(pendingCloseId);

  return (
    <div className="app-shell">
      <header className="app-titlebar" data-tauri-drag-region>
        <button
          className="brand"
          onClick={() => activate(null)}
          aria-label="outofOffice Write home"
        >
          <span className="brand-symbol" aria-hidden="true">
            W
          </span>
          <strong>{PRODUCT.displayName}</strong>
        </button>

        {activeTab ? (
          <input
            key={activeTab.id}
            className="document-title-input"
            aria-label="Document title"
            defaultValue={activeTab.document.metadata.title}
            onBlur={(event) => useEditorStore.getState().rename(activeTab.id, event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                event.currentTarget.value = activeTab.document.metadata.title;
                event.currentTarget.blur();
              }
            }}
          />
        ) : (
          <span className="workspace-label">Documents</span>
        )}

        <nav className="global-actions" aria-label="File and history actions">
          <button onClick={() => void openPath()}>Open</button>
          <button
            disabled={!activeTab || busy}
            onClick={() => activeTab && void saveTab(activeTab)}
          >
            Save
          </button>
          <button
            disabled={!activeTab || busy}
            onClick={() => activeTab && void saveTab(activeTab, true)}
          >
            Save as
          </button>
          <button disabled={!activeTab} onClick={duplicate}>
            Duplicate
          </button>
          <ExportMenu disabled={!activeTab} onExport={exportDocument} />
          <span className="action-divider" />
          <button disabled={!activeTab?.history.past.length} onClick={undo}>
            Undo
          </button>
          <button disabled={!activeTab?.history.future.length} onClick={redo}>
            Redo
          </button>
        </nav>
        <span className="local-badge">Local only</span>
      </header>

      <FileTabs
        tabs={tabs}
        activeTabId={activeTabId}
        onActivate={activate}
        onClose={requestClose}
        onNew={() => {
          flushActive();
          useEditorStore.getState().createTab();
        }}
      />

      {activeTab ? (
        <WriteEditor
          ref={editorRef}
          document={activeTab.document}
          dirty={activeTab.dirty}
          lastAutosaveAt={activeTab.lastAutosaveAt}
          dispatch={(command: EditorCommand) =>
            useEditorStore.getState().execute(activeTab.id, command)
          }
          onDraftDirty={() => useEditorStore.getState().markDraftDirty(activeTab.id)}
          onUndo={undo}
          onRedo={redo}
          onPageChange={(page) => useEditorStore.getState().updatePage(activeTab.id, page)}
        />
      ) : (
        <HomeScreen
          recents={recents}
          recoveries={recoveries}
          theme={theme}
          onNew={() => useEditorStore.getState().createTab()}
          onOpen={() => void openPath()}
          onOpenRecent={(path) => void openPath(path)}
          onPin={(file) =>
            void setRecentPinned(file.path, !file.pinned)
              .then(refreshHome)
              .catch((error: unknown) => setNotice(String(error)))
          }
          onRecover={(record) => void recover(record)}
          onDiscardRecovery={(id) =>
            void discardRecovery(id)
              .then(refreshHome)
              .catch((error: unknown) => setNotice(String(error)))
          }
          onTheme={setTheme}
        />
      )}

      {pendingClose && (
        <div className="dialog-scrim" role="presentation">
          <section
            className="unsaved-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="unsaved-title"
          >
            <span className="dialog-icon" aria-hidden="true">
              W
            </span>
            <div>
              <h2 id="unsaved-title">Save changes before closing?</h2>
              <p>Your latest changes to “{pendingClose.document.metadata.title}” are not saved.</p>
            </div>
            <div className="dialog-actions">
              <button onClick={() => setPendingCloseId(null)}>Cancel</button>
              <button
                className="danger-action"
                onClick={() => void closeImmediately(pendingClose, true)}
              >
                Don’t save
              </button>
              <button
                className="primary-action"
                onClick={() =>
                  void saveTab(pendingClose).then((saved) => {
                    if (saved) void closeImmediately(pendingClose, false);
                  })
                }
              >
                Save
              </button>
            </div>
          </section>
        </div>
      )}

      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button aria-label="Dismiss notification" onClick={() => setNotice(null)}>
            ×
          </button>
        </div>
      )}
      {busy && <div className="busy-indicator" aria-label="Working" />}
    </div>
  );
}

interface FileTabsProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onActivate(id: string | null): void;
  onClose(tab: EditorTab): void;
  onNew(): void;
}

function FileTabs({ tabs, activeTabId, onActivate, onClose, onNew }: FileTabsProps) {
  const moveFocus = (event: KeyboardEvent<HTMLElement>, index: number) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextIndex =
      event.key === "ArrowRight"
        ? (index + 1) % Math.max(tabs.length, 1)
        : (index - 1 + tabs.length) % Math.max(tabs.length, 1);
    const next = tabs[nextIndex];
    if (next) onActivate(next.id);
  };

  return (
    <nav className="file-tabs" role="tablist" aria-label="Open documents">
      <button
        className={`home-tab ${activeTabId === null ? "is-active" : ""}`}
        role="tab"
        aria-selected={activeTabId === null}
        aria-label="Document home"
        onClick={() => onActivate(null)}
      >
        Home
      </button>
      {tabs.map((tab, index) => (
        <div key={tab.id} className={`file-tab ${tab.id === activeTabId ? "is-active" : ""}`}>
          <button
            role="tab"
            aria-selected={tab.id === activeTabId}
            tabIndex={tab.id === activeTabId ? 0 : -1}
            onKeyDown={(event) => moveFocus(event, index)}
            onClick={() => onActivate(tab.id)}
          >
            <span className="tab-dot" aria-hidden="true" />
            <span className="tab-title">{tab.document.metadata.title}</span>
            {tab.dirty ? <b className="dirty-dot" aria-label="Unsaved changes" /> : null}
          </button>
          <button
            className="tab-close"
            aria-label={`Close ${tab.document.metadata.title}`}
            onClick={() => onClose(tab)}
          >
            ×
          </button>
        </div>
      ))}
      <button className="new-tab-button" aria-label="New document" onClick={onNew}>
        + New
      </button>
    </nav>
  );
}

function ExportMenu({
  disabled,
  onExport,
}: {
  disabled: boolean;
  onExport(format: "html" | "txt"): void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    globalThis.document.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    return () => {
      globalThis.document.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <div className="export-menu" ref={root}>
      <button
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Export
      </button>
      {open && (
        <div className="export-popover" role="menu">
          <button
            role="menuitem"
            onClick={() => {
              onExport("html");
              setOpen(false);
            }}
          >
            Web document (.html)
          </button>
          <button
            role="menuitem"
            onClick={() => {
              onExport("txt");
              setOpen(false);
            }}
          >
            Plain text (.txt)
          </button>
          <span>Use Print for PDF.</span>
        </div>
      )}
    </div>
  );
}
