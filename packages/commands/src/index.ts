import {
  cloneDocument,
  touchDocument,
  type Cell,
  type OfficeDocument,
  type Slide,
  type SlideObject,
  type Worksheet,
} from "@outofoffice/document-model";
import { assertNever, createId } from "@outofoffice/shared";

interface CommandBase {
  id: string;
  label: string;
  timestamp: string;
}

export type EditorCommand =
  | (CommandBase & { type: "set-write-content"; before: string; after: string })
  | (CommandBase & { type: "add-slide"; slide: Slide; index: number })
  | (CommandBase & { type: "delete-slide"; slide: Slide; index: number })
  | (CommandBase & { type: "add-slide-object"; slideId: string; object: SlideObject })
  | (CommandBase & { type: "delete-slide-object"; slideId: string; object: SlideObject })
  | (CommandBase & {
      type: "update-slide-object";
      slideId: string;
      before: SlideObject;
      after: SlideObject;
    })
  | (CommandBase & {
      type: "set-cell";
      sheetId: string;
      address: string;
      before: Cell | null;
      after: Cell | null;
    })
  | (CommandBase & { type: "add-sheet"; sheet: Worksheet; index: number })
  | (CommandBase & { type: "delete-sheet"; sheet: Worksheet; index: number })
  | (CommandBase & { type: "rename-sheet"; sheetId: string; before: string; after: string });

export interface CommandHistory {
  past: EditorCommand[];
  future: EditorCommand[];
}

export const emptyHistory = (): CommandHistory => ({ past: [], future: [] });

export function command<T extends Omit<EditorCommand, keyof CommandBase>>(
  value: T,
  label: string,
): T & CommandBase {
  return { ...value, id: createId("command"), label, timestamp: new Date().toISOString() };
}

function locateSlide(document: OfficeDocument, slideId: string): Slide {
  if (document.kind !== "present") throw new Error("A slide command requires a presentation.");
  const slide = document.slides.find((item) => item.id === slideId);
  if (!slide) throw new Error(`Slide ${slideId} no longer exists.`);
  return slide;
}

function apply(document: OfficeDocument, item: EditorCommand, reverse: boolean): OfficeDocument {
  const next = cloneDocument(document);
  switch (item.type) {
    case "set-write-content":
      if (next.kind !== "write") throw new Error("A writing command requires a document.");
      next.content.html = reverse ? item.before : item.after;
      break;
    case "add-slide":
    case "delete-slide": {
      if (next.kind !== "present") throw new Error("A slide command requires a presentation.");
      const shouldAdd = (item.type === "add-slide") !== reverse;
      if (shouldAdd) next.slides.splice(item.index, 0, structuredClone(item.slide));
      else next.slides = next.slides.filter((slide) => slide.id !== item.slide.id);
      break;
    }
    case "add-slide-object":
    case "delete-slide-object": {
      const slide = locateSlide(next, item.slideId);
      const shouldAdd = (item.type === "add-slide-object") !== reverse;
      if (shouldAdd) slide.objects.push(structuredClone(item.object));
      else slide.objects = slide.objects.filter((object) => object.id !== item.object.id);
      break;
    }
    case "update-slide-object": {
      const slide = locateSlide(next, item.slideId);
      const replacement = reverse ? item.before : item.after;
      const index = slide.objects.findIndex((object) => object.id === replacement.id);
      if (index < 0) throw new Error(`Object ${replacement.id} no longer exists.`);
      slide.objects[index] = structuredClone(replacement);
      break;
    }
    case "set-cell": {
      if (next.kind !== "calculate") throw new Error("A cell command requires a spreadsheet.");
      const sheet = next.sheets.find((candidate) => candidate.id === item.sheetId);
      if (!sheet) throw new Error(`Worksheet ${item.sheetId} no longer exists.`);
      const value = reverse ? item.before : item.after;
      if (value) sheet.cells[item.address] = structuredClone(value);
      else delete sheet.cells[item.address];
      break;
    }
    case "add-sheet":
    case "delete-sheet": {
      if (next.kind !== "calculate") throw new Error("A worksheet command requires a spreadsheet.");
      const shouldAdd = (item.type === "add-sheet") !== reverse;
      if (shouldAdd) next.sheets.splice(item.index, 0, structuredClone(item.sheet));
      else next.sheets = next.sheets.filter((sheet) => sheet.id !== item.sheet.id);
      break;
    }
    case "rename-sheet": {
      if (next.kind !== "calculate") throw new Error("A worksheet command requires a spreadsheet.");
      const sheet = next.sheets.find((candidate) => candidate.id === item.sheetId);
      if (!sheet) throw new Error(`Worksheet ${item.sheetId} no longer exists.`);
      sheet.name = reverse ? item.before : item.after;
      break;
    }
    default:
      assertNever(item);
  }
  return touchDocument(next);
}

export function executeCommand(
  document: OfficeDocument,
  history: CommandHistory,
  item: EditorCommand,
): { document: OfficeDocument; history: CommandHistory } {
  return {
    document: apply(document, item, false),
    history: { past: [...history.past, item].slice(-500), future: [] },
  };
}

export function undoCommand(
  document: OfficeDocument,
  history: CommandHistory,
): { document: OfficeDocument; history: CommandHistory } {
  const item = history.past.at(-1);
  if (!item) return { document, history };
  return {
    document: apply(document, item, true),
    history: { past: history.past.slice(0, -1), future: [item, ...history.future] },
  };
}

export function redoCommand(
  document: OfficeDocument,
  history: CommandHistory,
): { document: OfficeDocument; history: CommandHistory } {
  const item = history.future[0];
  if (!item) return { document, history };
  return {
    document: apply(document, item, false),
    history: { past: [...history.past, item], future: history.future.slice(1) },
  };
}
