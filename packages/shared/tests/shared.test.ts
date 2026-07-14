import { describe, expect, it } from "vitest";
import { createId, FILE_EXTENSIONS } from "../src";

describe("shared configuration", () => {
  it("keeps internal extensions centralized", () => {
    expect(FILE_EXTENSIONS).toEqual({
      write: "oofdoc",
      present: "oofslides",
      calculate: "oofsheet",
    });
  });

  it("creates stable-looking unique identifiers", () => {
    expect(createId("doc")).toMatch(/^doc-/);
  });
});
