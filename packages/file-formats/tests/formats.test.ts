import { describe, expect, it } from "vitest";
import { createDocument } from "@outofoffice/document-model";
import { parsePackagePayload, serializeDocument } from "../src";

describe("internal format payload", () => {
  it("round trips Write documents without an extra full-document clone", () => {
    const document = createDocument();
    const payload = serializeDocument(document);
    expect(payload.document).toBe(document);
    expect(parsePackagePayload(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
  });

  it("migrates legacy envelopes and rejects retired module kinds", () => {
    const document = createDocument();
    expect(parsePackagePayload({ schemaVersion: 0, kind: "write", document }).schemaVersion).toBe(
      1,
    );
    expect(() => parsePackagePayload({ schemaVersion: 1, kind: "unsupported", document })).toThrow(
      /Only.*Write/,
    );
  });
});
