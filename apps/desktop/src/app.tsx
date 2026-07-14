import { useCallback, useEffect, useMemo, useState } from "react";
import type { EditorCommand } from "@outofoffice/commands";
import { parsePackagePayload, serializeDocument } from "@outofoffice/file-formats";
import { PRODUCT, type DocumentKind } from "@outofoffice/shared";
import type { RecentFile, RecoveryRecord } from "@outofoffice/storage";
import { CalculateEditor } from "./components/calculate-editor";
import { HomeScreen, type ThemeChoice } from "./components/home-screen";
import { PresentEditor } from "./components/present-editor";
import { WriteEditor } from "./components/write-editor";
import {
  askToDiscardChanges,
  clearRecovery,
  discardRecovery,
  isTauri,
  listLaunchFiles,
  listRecentFiles,
  listRecoveries,
  loadInternal,
  saveInternal,
  saveRecovery,
  selectOpenPath,
  selectSavePath,
  setRecentPinned,
} from "./lib/native";
import { useEditorStore, type EditorTab } from "./stores/editor-store";

function readTheme(): ThemeChoice {
  const value = localStorage.getItem("outofoffice.theme");
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

export function App() {
  const {
    tabs,
    activeTabId,
    createTab,
    openTab,
    setActive,
    closeTab,
    execute,
    undo,
    redo,
    markSaved,
    markAutosaved,
  } = useEditorStore();
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const [recents, setRecents] = useState<RecentFile[]>([]);
  const [recoveries, setRecoveries] = useState<RecoveryRecord[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;

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
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("outofoffice.theme", theme);
  }, [theme]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
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
            setNotice("Native file dialogs are available when the app runs through Tauri.");
          return;
        }
        const loaded = await loadInternal(path);
        const payload = parsePackagePayload(loaded.payload);
        openTab(payload.document, loaded.path);
        await refreshHome();
      } catch (error) {
        setNotice(error instanceof Error ? error.message : String(error));
      } finally {
        setBusy(false);
      }
    },
    [openTab, refreshHome],
  );

  useEffect(() => {
    void listLaunchFiles().then((paths) =>
      paths.forEach((path) => {
        void openPath(path);
      }),
    );
  }, [openPath]);

  const saveTab = useCallback(
    async (tab: EditorTab, forceDialog = false) => {
      try {
        setBusy(true);
        const path =
          !forceDialog && tab.path
            ? tab.path
            : await selectSavePath(tab.document.kind, tab.document.metadata.title);
        if (!path) {
          if (!isTauri())
            setNotice(
              "Run `pnpm tauri dev` to save ZIP-based outofOffice files with a native dialog.",
            );
          return false;
        }
        const savedPath = await saveInternal(path, serializeDocument(tab.document));
        markSaved(tab.id, savedPath);
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
    [markSaved, refreshHome],
  );

  const close = useCallback(
    async (tab: EditorTab) => {
      if (tab.dirty && !(await askToDiscardChanges(tab.document.metadata.title))) return;
      closeTab(tab.id);
    },
    [closeTab],
  );

  useEffect(() => {
    if (!isTauri()) return;
    const timer = window.setInterval(() => {
      for (const tab of useEditorStore.getState().tabs.filter((item) => item.dirty)) {
        void saveRecovery(serializeDocument(tab.document), tab.path)
          .then((timestamp) => markAutosaved(tab.id, timestamp))
          .catch((error: unknown) =>
            setNotice(error instanceof Error ? error.message : String(error)),
          );
      }
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [markAutosaved]);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/webview")
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type === "drop")
            for (const path of event.payload.paths) void openPath(path);
        }),
      )
      .then((stop) => {
        unlisten = stop;
      });
    return () => unlisten?.();
  }, [openPath]);

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if (!event.ctrlKey) return;
      const current = useEditorStore
        .getState()
        .tabs.find((tab) => tab.id === useEditorStore.getState().activeTabId);
      if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        void openPath();
      } else if (event.key.toLowerCase() === "s" && current) {
        event.preventDefault();
        void saveTab(current, event.shiftKey);
      } else if (event.key.toLowerCase() === "z" && current) {
        event.preventDefault();
        useEditorStore.getState().undo(current.id);
      } else if (event.key.toLowerCase() === "y" && current) {
        event.preventDefault();
        useEditorStore.getState().redo(current.id);
      } else if (event.key.toLowerCase() === "w" && current) {
        event.preventDefault();
        void close(current);
      }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, [close, openPath, saveTab]);

  const dispatch = useCallback(
    (item: EditorCommand) => {
      if (activeTabId) execute(activeTabId, item);
    },
    [activeTabId, execute],
  );
  const editor = useMemo(() => {
    if (!activeTab) return null;
    if (activeTab.document.kind === "write")
      return <WriteEditor document={activeTab.document} dispatch={dispatch} />;
    if (activeTab.document.kind === "present")
      return <PresentEditor document={activeTab.document} dispatch={dispatch} />;
    return <CalculateEditor document={activeTab.document} dispatch={dispatch} />;
  }, [activeTab, dispatch]);

  const recover = (record: RecoveryRecord) => {
    const payload = parsePackagePayload(record.payload);
    openTab(payload.document, record.originalPath, record.id);
  };

  return (
    <div className="app-shell">
      <header className="app-titlebar" data-tauri-drag-region>
        <button className="brand" onClick={() => setActive(null)} aria-label="outofOffice home">
          <span className="brand-symbol">oo</span>
          <strong>{PRODUCT.displayName}</strong>
        </button>
        <nav className="global-actions" aria-label="File actions">
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
          <button
            disabled={!activeTab?.history.past.length}
            onClick={() => activeTab && undo(activeTab.id)}
          >
            Undo
          </button>
          <button
            disabled={!activeTab?.history.future.length}
            onClick={() => activeTab && redo(activeTab.id)}
          >
            Redo
          </button>
        </nav>
        <span className="local-badge">Local only</span>
      </header>
      <nav className="file-tabs" aria-label="Open files">
        <button
          className={`home-tab ${activeTabId === null ? "is-active" : ""}`}
          onClick={() => {
            setActive(null);
            void refreshHome();
          }}
        >
          ⌂
        </button>
        {tabs.map((tab) => (
          <div key={tab.id} className={`file-tab ${tab.id === activeTabId ? "is-active" : ""}`}>
            <button onClick={() => setActive(tab.id)}>
              <span className={`tab-dot ${tab.document.kind}`} />
              {tab.document.metadata.title}
              {tab.dirty ? <b aria-label="Unsaved"> •</b> : null}
            </button>
            <button
              className="tab-close"
              aria-label={`Close ${tab.document.metadata.title}`}
              onClick={() => void close(tab)}
            >
              ×
            </button>
          </div>
        ))}
        <NewMenu onNew={createTab} />
      </nav>
      {activeTab ? (
        editor
      ) : (
        <HomeScreen
          recents={recents}
          recoveries={recoveries}
          theme={theme}
          onNew={createTab}
          onOpen={() => void openPath()}
          onOpenRecent={(path) => void openPath(path)}
          onPin={(file) =>
            void setRecentPinned(file.path, !file.pinned)
              .then(refreshHome)
              .catch((error: unknown) => setNotice(String(error)))
          }
          onRecover={recover}
          onDiscardRecovery={(id) =>
            void discardRecovery(id)
              .then(refreshHome)
              .catch((error: unknown) => setNotice(String(error)))
          }
          onTheme={setTheme}
        />
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

function NewMenu({ onNew }: { onNew(kind: DocumentKind): string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="new-menu">
      <button aria-label="New file" onClick={() => setOpen((value) => !value)}>
        ＋
      </button>
      {open && (
        <div className="new-menu-popover">
          {(["write", "present", "calculate"] as const).map((kind) => (
            <button
              key={kind}
              onClick={() => {
                onNew(kind);
                setOpen(false);
              }}
            >
              New {PRODUCT.modules[kind]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
