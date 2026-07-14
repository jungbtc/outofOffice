import { create } from "zustand";
import {
  emptyHistory,
  executeCommand,
  redoCommand,
  undoCommand,
  type CommandHistory,
  type EditorCommand,
} from "@outofoffice/commands";
import { createDocument, type OfficeDocument } from "@outofoffice/document-model";
import { createId, type DocumentKind } from "@outofoffice/shared";

export interface EditorTab {
  id: string;
  document: OfficeDocument;
  path: string | null;
  recoveryId: string | null;
  dirty: boolean;
  history: CommandHistory;
  lastAutosaveAt: number | null;
}

interface EditorState {
  tabs: EditorTab[];
  activeTabId: string | null;
  createTab(kind: DocumentKind): string;
  openTab(document: OfficeDocument, path: string | null, recoveryId?: string | null): string;
  setActive(id: string | null): void;
  closeTab(id: string): void;
  execute(id: string, command: EditorCommand): void;
  undo(id: string): void;
  redo(id: string): void;
  markSaved(id: string, path: string): void;
  markAutosaved(id: string, timestamp: number): void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  createTab: (kind) => {
    const id = createId("tab");
    const tab: EditorTab = {
      id,
      document: createDocument(kind),
      path: null,
      recoveryId: null,
      dirty: true,
      history: emptyHistory(),
      lastAutosaveAt: null,
    };
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: id }));
    return id;
  },
  openTab: (document, path, recoveryId = null) => {
    const existing = path
      ? get().tabs.find((tab) => tab.path?.toLocaleLowerCase() === path.toLocaleLowerCase())
      : undefined;
    if (existing) {
      set({ activeTabId: existing.id });
      return existing.id;
    }
    const id = createId("tab");
    const tab: EditorTab = {
      id,
      document,
      path,
      recoveryId,
      dirty: recoveryId !== null,
      history: emptyHistory(),
      lastAutosaveAt: null,
    };
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: id }));
    return id;
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
  execute: (id, item) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => {
        if (tab.id !== id) return tab;
        const result = executeCommand(tab.document, tab.history, item);
        return { ...tab, ...result, dirty: true };
      }),
    })),
  undo: (id) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, ...undoCommand(tab.document, tab.history), dirty: true } : tab,
      ),
    })),
  redo: (id) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, ...redoCommand(tab.document, tab.history), dirty: true } : tab,
      ),
    })),
  markSaved: (id, path) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === id ? { ...tab, path, dirty: false, recoveryId: null } : tab,
      ),
    })),
  markAutosaved: (id, timestamp) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, lastAutosaveAt: timestamp } : tab)),
    })),
}));
