import { describe, expect, it } from "vitest";
import { createId, FILE_EXTENSIONS, PRODUCT } from "../src";

describe("shared configuration", () => {
  it("exposes only the focused Write document format", () => {
    expect(FILE_EXTENSIONS).toEqual({ write: "oofdoc" });
    expect(PRODUCT.modules).toEqual({ write: "Write" });
  });

  it("creates stable-looking unique identifiers", () => {
    expect(createId("doc")).toMatch(/^doc-/);
  });
});
