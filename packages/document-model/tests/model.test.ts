import { describe, expect, it } from "vitest";
import { createDocument, validateDocument } from "../src";

describe("document model", () => {
  it.each(["write", "present", "calculate"] as const)(
    "creates and validates %s documents",
    (kind) => {
      const document = createDocument(kind);
      expect(validateDocument(structuredClone(document))).toEqual(document);
    },
  );

  it("rejects unknown versions", () => {
    expect(() => validateDocument({ kind: "write", formatVersion: 99 })).toThrow(/supported/);
  });
});
