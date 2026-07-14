import { create } from "zustand";
import {
  emptyHistory,
  executeCommand,
  redoCommand,
  undoCommand,
  type CommandHistory,
  type EditorCommand,
} from "@outofoffice/commands";
import {
  cloneDocument,
  createDocument,
  type PageSettings,
  type WriteDocument,
} from "@outofoffice/document-model";
import { createId } from "@outofoffice/shared";

export interface EditorTab {
  id: string;
  document: WriteDocument;
  path: string | null;
  recoveryId: string | null;
  dirty: boolean;
  history: CommandHistory;
  revision: number;
  recoveredRevision: number;
  lastAutosaveAt: number | null;
}

interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;
  createTab(): string;
  openTab(document: WriteDocument, path: string | null, recoveryId?: string | null): string;
  duplicateTab(id: string): string | null;
  setActive(id: string | null): void;
  closeTab(id: string): void;
  markDraftDirty(id: string): void;
  rename(id: string, title: string): void;
  updatePage(id: string, page: Partial<PageSettings>): void;
  execute(id: string, command: EditorCommand): void;
  undo(id: string): void;
  redo(id: string): void;
  markSaved(id: string, path: string): void;
  markAutosaved(id: string, revision: number, timestamp: number): void;
}

function createTabState(document: WriteDocument, path: string | null): EditorTab {
  return {
    id: createId("tab"),
    document,
    path,
    recoveryId: null,
    dirty: path === null,
    history: emptyHistory(),
    revision: 0,
    recoveredRevision: path === null ? -1 : 0,
    lastAutosaveAt: null,
  };
}

function updateTab(
  tabs: readonly EditorTab[],
  id: string,
  updater: (tab: EditorTab) => EditorTab,
): EditorTab[] {
  let changed = false;
  const next = tabs.map((tab) => {
    if (tab.id !== id) return tab;
    const updated = updater(tab);
    changed ||= updated !== tab;
    return updated;
  });
  return changed ? next : (tabs as EditorTab[]);
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  createTab: () => {
    const tab = createTabState(createDocument(), null);
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
    return tab.id;
  },
  openTab: (document, path, recoveryId = null) => {
    const normalizedPath = path?.toLocaleLowerCase();
    const existing = normalizedPath
      ? get().tabs.find((tab) => tab.path?.toLocaleLowerCase() === normalizedPath)
      : undefined;
    if (existing) {
      set({ activeTabId: existing.id });
      return existing.id;
    }
    const tab = {
      ...createTabState(document, path),
      recoveryId,
      dirty: recoveryId !== null,
      recoveredRevision: recoveryId !== null ? 0 : -1,
    };
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
    return tab.id;
  },
  duplicateTab: (id) => {
    const source = get().tabs.find((tab) => tab.id === id);
    if (!source) return null;
    const document = cloneDocument(source.document);
    const timestamp = new Date().toISOString();
    document.metadata = {
      ...document.metadata,
      id: createId("document"),
      title: `${document.metadata.title} copy`,
      createdAt: timestamp,
      modifiedAt: timestamp,
    };
    const tab = { ...createTabState(document, null), revision: 1 };
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
    return tab.id;
  },
  setActive: (activeTabId) => set({ activeTabId }),
  closeTab: (id) =>
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === id);
      const tabs = state.tabs.filter((tab) => tab.id !== id);
      const fallback = tabs[Math.min(Math.max(index - 1, 0), tabs.length - 1)];
      return {
        tabs,
        activeTabId: state.activeTabId === id ? (fallback?.id ?? null) : state.activeTabId,
      };
    }),
  markDraftDirty: (id) =>
    set((state) => {
      const tabs = updateTab(state.tabs, id, (tab) => (tab.dirty ? tab : { ...tab, dirty: true }));
      return tabs === state.tabs ? state : { tabs };
    }),
  rename: (id, rawTitle) =>
    set((state) => {
      const title = rawTitle.trim() || "Untitled document";
      const tabs = updateTab(state.tabs, id, (tab) => {
        if (tab.document.metadata.title === title) return tab;
        return {
          ...tab,
          dirty: true,
          revision: tab.revision + 1,
          document: {
            ...tab.document,
            metadata: {
              ...tab.document.metadata,
              title,
              modifiedAt: new Date().toISOString(),
            },
          },
        };
      });
      return tabs === state.tabs ? state : { tabs };
    }),
  updatePage: (id, page) =>
    set((state) => {
      const tabs = updateTab(state.tabs, id, (tab) => {
        const nextPage = { ...tab.document.page, ...page };
        if (
          nextPage.size === tab.document.page.size &&
          nextPage.orientation === tab.document.page.orientation &&
          nextPage.marginMm === tab.document.page.marginMm
        )
          return tab;
        return {
          ...tab,
          dirty: true,
          revision: tab.revision + 1,
          document: {
            ...tab.document,
            page: nextPage,
            metadata: { ...tab.document.metadata, modifiedAt: new Date().toISOString() },
          },
        };
      });
      return tabs === state.tabs ? state : { tabs };
    }),
  execute: (id, item) =>
    set((state) => {
      const tabs = updateTab(state.tabs, id, (tab) => {
        const result = executeCommand(tab.document, tab.history, item);
        if (result.document === tab.document) return tab;
        return {
          ...tab,
          ...result,
          dirty: true,
          revision: tab.revision + 1,
        };
      });
      return tabs === state.tabs ? state : { tabs };
    }),
  undo: (id) =>
    set((state) => {
      const tabs = updateTab(state.tabs, id, (tab) => {
        const result = undoCommand(tab.document, tab.history);
        if (result.document === tab.document) return tab;
        return { ...tab, ...result, dirty: true, revision: tab.revision + 1 };
      });
      return tabs === state.tabs ? state : { tabs };
    }),
  redo: (id) =>
    set((state) => {
      const tabs = updateTab(state.tabs, id, (tab) => {
        const result = redoCommand(tab.document, tab.history);
        if (result.document === tab.document) return tab;
        return { ...tab, ...result, dirty: true, revision: tab.revision + 1 };
      });
      return tabs === state.tabs ? state : { tabs };
    }),
  markSaved: (id, path) =>
    set((state) => ({
      tabs: updateTab(state.tabs, id, (tab) =>
        tab.id === id ? { ...tab, path, dirty: false, recoveryId: null } : tab,
      ),
    })),
  markAutosaved: (id, revision, timestamp) =>
    set((state) => ({
      tabs: updateTab(state.tabs, id, (tab) => ({
        ...tab,
        recoveredRevision: Math.max(tab.recoveredRevision, revision),
        lastAutosaveAt: timestamp,
      })),
    })),
}));
