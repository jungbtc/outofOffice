import { describe, expect, it } from "vitest";
import { createDocument } from "@outofoffice/document-model";
import { parsePackagePayload, serializeDocument } from "../src";

describe("internal format payload", () => {
  it("round trips all document types", () => {
    for (const kind of ["write", "present", "calculate"] as const) {
      const payload = serializeDocument(createDocument(kind));
      expect(parsePackagePayload(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
    }
  });

  it("migrates legacy package envelopes", () => {
    const document = createDocument("write");
    expect(parsePackagePayload({ schemaVersion: 0, kind: "write", document }).schemaVersion).toBe(
      1,
    );
  });
});
