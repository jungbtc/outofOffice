import type { WriteDocument } from "@outofoffice/document-model";
import { createId } from "@outofoffice/shared";

interface CommandBase {
  id: string;
  label: string;
  timestamp: string;
}

export interface TextPatch {
  start: number;
  removed: string;
  inserted: string;
  beforeLength: number;
  afterLength: number;
}

export type EditorCommand = CommandBase & {
  type: "set-write-content";
  patch: TextPatch;
};

export interface SetWriteContentInput {
  type: "set-write-content";
  before: string;
  after: string;
}

export interface CommandHistory {
  past: EditorCommand[];
  future: EditorCommand[];
}

/** A second limit keeps many tiny edits from accumulating object overhead indefinitely. */
export const MAX_HISTORY_ENTRIES = 250;

/** Approximate retained command data, using the worst-case two bytes per UTF-16 code unit. */
export const MAX_HISTORY_BYTES = 4 * 1024 * 1024;

const COMMAND_OBJECT_OVERHEAD_BYTES = 64;
const UTF16_CODE_UNIT_BYTES = 2;

export const emptyHistory = (): CommandHistory => ({ past: [], future: [] });

export function createTextPatch(before: string, after: string): TextPatch {
  let start = 0;
  const sharedLength = Math.min(before.length, after.length);
  while (start < sharedLength && before.charCodeAt(start) === after.charCodeAt(start)) start += 1;

  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (
    beforeEnd > start &&
    afterEnd > start &&
    before.charCodeAt(beforeEnd - 1) === after.charCodeAt(afterEnd - 1)
  ) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }

  return {
    start,
    removed: before.slice(start, beforeEnd),
    inserted: after.slice(start, afterEnd),
    beforeLength: before.length,
    afterLength: after.length,
  };
}

export function command(value: SetWriteContentInput, label: string): EditorCommand {
  return {
    type: value.type,
    patch: createTextPatch(value.before, value.after),
    id: createId("command"),
    label,
    timestamp: new Date().toISOString(),
  };
}

export function writeContentCommand(before: string, after: string, label: string): EditorCommand {
  return command({ type: "set-write-content", before, after }, label);
}

export function measureCommandBytes(item: EditorCommand): number {
  return (
    COMMAND_OBJECT_OVERHEAD_BYTES +
    UTF16_CODE_UNIT_BYTES *
      (item.id.length +
        item.label.length +
        item.timestamp.length +
        item.patch.removed.length +
        item.patch.inserted.length)
  );
}

export function historyBytes(history: CommandHistory): number {
  let bytes = 0;
  for (const item of history.past) bytes += measureCommandBytes(item);
  for (const item of history.future) bytes += measureCommandBytes(item);
  return bytes;
}

function isNoOp(item: EditorCommand): boolean {
  return item.patch.removed.length === 0 && item.patch.inserted.length === 0;
}

function applyPatch(html: string, patch: TextPatch, reverse: boolean): string {
  const expectedLength = reverse ? patch.afterLength : patch.beforeLength;
  const expected = reverse ? patch.inserted : patch.removed;
  const replacement = reverse ? patch.removed : patch.inserted;

  if (
    html.length !== expectedLength ||
    patch.start < 0 ||
    patch.start + expected.length > html.length ||
    html.slice(patch.start, patch.start + expected.length) !== expected
  ) {
    throw new Error("The document no longer matches this history entry.");
  }

  return html.slice(0, patch.start) + replacement + html.slice(patch.start + expected.length);
}

function apply(document: WriteDocument, item: EditorCommand, reverse: boolean): WriteDocument {
  const html = applyPatch(document.content.html, item.patch, reverse);
  return {
    ...document,
    metadata: { ...document.metadata, modifiedAt: new Date().toISOString() },
    content: { ...document.content, html },
  };
}

function appendWithinLimits(past: readonly EditorCommand[], item: EditorCommand): EditorCommand[] {
  const itemBytes = measureCommandBytes(item);
  if (itemBytes > MAX_HISTORY_BYTES) return [];

  const retained = [item];
  let bytes = itemBytes;
  for (let index = past.length - 1; index >= 0; index -= 1) {
    if (retained.length >= MAX_HISTORY_ENTRIES) break;
    const candidate = past[index];
    if (!candidate) continue;
    const candidateBytes = measureCommandBytes(candidate);
    if (bytes + candidateBytes > MAX_HISTORY_BYTES) break;
    retained.push(candidate);
    bytes += candidateBytes;
  }
  retained.reverse();
  return retained;
}

export function executeCommand(
  document: WriteDocument,
  history: CommandHistory,
  item: EditorCommand,
): { document: WriteDocument; history: CommandHistory } {
  if (isNoOp(item)) return { document, history };
  return {
    document: apply(document, item, false),
    history: { past: appendWithinLimits(history.past, item), future: [] },
  };
}

export function undoCommand(
  document: WriteDocument,
  history: CommandHistory,
): { document: WriteDocument; history: CommandHistory } {
  const item = history.past.at(-1);
  if (!item) return { document, history };
  return {
    document: apply(document, item, true),
    history: { past: history.past.slice(0, -1), future: [item, ...history.future] },
  };
}

export function redoCommand(
  document: WriteDocument,
  history: CommandHistory,
): { document: WriteDocument; history: CommandHistory } {
  const item = history.future[0];
  if (!item) return { document, history };
  return {
    document: apply(document, item, false),
    history: { past: [...history.past, item], future: history.future.slice(1) },
  };
}
