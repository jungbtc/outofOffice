import { describe, expect, it } from "vitest";
import { createDocument } from "@outofoffice/document-model";
import {
  MAX_HISTORY_BYTES,
  MAX_HISTORY_ENTRIES,
  command,
  emptyHistory,
  executeCommand,
  measureCommandBytes,
  historyBytes,
  redoCommand,
  undoCommand,
  writeContentCommand,
} from "../src";

describe("compact write command history", () => {
  it("executes, undoes, and redoes immutable write operations", () => {
    const original = createDocument("write");
    const item = writeContentCommand(original.content.html, "<p>Hello</p>", "Type");

    const executed = executeCommand(original, emptyHistory(), item);
    expect(executed.document.content.html).toBe("<p>Hello</p>");
    expect(executed.document).not.toBe(original);
    expect(executed.document.metadata).not.toBe(original.metadata);
    expect(executed.document.content).not.toBe(original.content);
    expect(executed.document.page).toBe(original.page);

    const undone = undoCommand(executed.document, executed.history);
    expect(undone.document.content.html).toBe(original.content.html);
    expect(undone.history.past).toHaveLength(0);
    expect(undone.history.future).toEqual([item]);

    const redone = redoCommand(undone.document, undone.history);
    expect(redone.document.content.html).toBe("<p>Hello</p>");
    expect(redone.history.past).toEqual([item]);
    expect(redone.history.future).toHaveLength(0);
    expect(JSON.parse(JSON.stringify(item))).toEqual(item);
  });

  it("stores only the changed middle of a document", () => {
    const before = "<p>Hello brave world</p>";
    const after = "<p>Hello bright world</p>";
    const item = command({ type: "set-write-content", before, after }, "Replace word");

    expect(item.patch).toEqual({
      start: 11,
      removed: "ave",
      inserted: "ight",
      beforeLength: before.length,
      afterLength: after.length,
    });
    expect(item).not.toHaveProperty("before");
    expect(item).not.toHaveProperty("after");
    expect(measureCommandBytes(item)).toBeLessThan((before.length + after.length) * 2 + 256);
  });

  it("does not alter the document or history for a no-op", () => {
    const document = createDocument("write");
    const history = emptyHistory();
    const item = command(
      {
        type: "set-write-content",
        before: document.content.html,
        after: document.content.html,
      },
      "No change",
    );

    const result = executeCommand(document, history, item);
    expect(result.document).toBe(document);
    expect(result.history).toBe(history);
  });

  it("caps many compact edits by entry count while preserving a valid undo chain", () => {
    let document = createDocument("write");
    let history = emptyHistory();
    const initial = document.content.html;
    const editCount = MAX_HISTORY_ENTRIES + 25;

    for (let index = 0; index < editCount; index += 1) {
      const after = `${document.content.html}x`;
      const result = executeCommand(
        document,
        history,
        command({ type: "set-write-content", before: document.content.html, after }, "Type"),
      );
      document = result.document;
      history = result.history;
    }

    expect(history.past).toHaveLength(MAX_HISTORY_ENTRIES);
    expect(historyBytes(history)).toBeLessThanOrEqual(MAX_HISTORY_BYTES);

    for (let index = 0; index < MAX_HISTORY_ENTRIES; index += 1) {
      const result = undoCommand(document, history);
      document = result.document;
      history = result.history;
    }
    expect(document.content.html).toBe(`${initial}${"x".repeat(25)}`);
  });

  it("stays within the byte budget across many large replacements", () => {
    let document = createDocument("write");
    let history = emptyHistory();
    const blockLength = 96 * 1024;

    for (let index = 0; index < 32; index += 1) {
      const after = String.fromCharCode(65 + (index % 26)).repeat(blockLength);
      const result = executeCommand(
        document,
        history,
        command({ type: "set-write-content", before: document.content.html, after }, "Replace all"),
      );
      document = result.document;
      history = result.history;
      expect(historyBytes(history)).toBeLessThanOrEqual(MAX_HISTORY_BYTES);
    }

    expect(history.past.length).toBeGreaterThan(1);
    expect(history.past.length).toBeLessThan(MAX_HISTORY_ENTRIES);
  });

  it("drops invalid older history when one command exceeds the byte budget", () => {
    const original = createDocument("write");
    const first = executeCommand(
      original,
      emptyHistory(),
      command(
        { type: "set-write-content", before: original.content.html, after: "<p>small</p>" },
        "Small edit",
      ),
    );
    const oversized = "한".repeat(MAX_HISTORY_BYTES);
    const result = executeCommand(
      first.document,
      first.history,
      command(
        { type: "set-write-content", before: first.document.content.html, after: oversized },
        "Oversized edit",
      ),
    );

    expect(result.document.content.html).toBe(oversized);
    expect(result.history.past).toHaveLength(0);
    expect(historyBytes(result.history)).toBe(0);
  });
});
