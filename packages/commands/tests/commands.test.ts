import { describe, expect, it } from "vitest";
import { createDocument } from "@outofoffice/document-model";
import { command, emptyHistory, executeCommand, redoCommand, undoCommand } from "../src";

describe("serializable command history", () => {
  it("executes, undoes, and redoes write operations", () => {
    const original = createDocument("write");
    const item = command(
      { type: "set-write-content", before: original.content.html, after: "<p>Hello</p>" },
      "Type",
    );
    const executed = executeCommand(original, emptyHistory(), item);
    expect(executed.document.kind === "write" && executed.document.content.html).toBe(
      "<p>Hello</p>",
    );
    const undone = undoCommand(executed.document, executed.history);
    expect(undone.document.kind === "write" && undone.document.content.html).toBe(
      original.content.html,
    );
    const redone = redoCommand(undone.document, undone.history);
    expect(redone.document.kind === "write" && redone.document.content.html).toBe("<p>Hello</p>");
    expect(JSON.parse(JSON.stringify(item))).toEqual(item);
  });
});
