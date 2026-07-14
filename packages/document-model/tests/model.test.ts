import { describe, expect, it } from "vitest";
import { createDocument, validateDocument } from "../src";

describe("document model", () => {
  it("creates and validates Write documents", () => {
    const document = createDocument();
    expect(validateDocument(structuredClone(document))).toEqual(document);
  });

  it("rejects unknown versions and retired module kinds", () => {
    expect(() => validateDocument({ kind: "write", formatVersion: 99 })).toThrow(/supported/);
    expect(() =>
      validateDocument({ kind: "unsupported", formatVersion: 1, metadata: {}, content: {} }),
    ).toThrow(/supported/);
  });
});
