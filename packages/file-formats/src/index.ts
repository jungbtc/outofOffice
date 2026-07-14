import { validateDocument, type WriteDocument } from "@outofoffice/document-model";
import type { DocumentKind } from "@outofoffice/shared";

export const PACKAGE_SCHEMA_VERSION = 1;

export interface InternalPackagePayload {
  schemaVersion: 1;
  kind: DocumentKind;
  document: WriteDocument;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function serializeDocument(document: WriteDocument): InternalPackagePayload {
  return {
    schemaVersion: PACKAGE_SCHEMA_VERSION,
    kind: "write",
    document,
  };
}

export function parsePackagePayload(value: unknown): InternalPackagePayload {
  if (!isRecord(value)) throw new Error("Invalid package payload.");
  const migrated = value.schemaVersion === 0 ? { ...value, schemaVersion: 1 } : value;
  if (migrated.schemaVersion !== PACKAGE_SCHEMA_VERSION)
    throw new Error(`Unsupported package schema version ${String(migrated.schemaVersion)}.`);
  const document = validateDocument(migrated.document);
  if (migrated.kind !== "write")
    throw new Error("Only outofOffice Write documents are supported by this application.");
  return serializeDocument(document);
}

export const packageJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://outofoffice.local/schemas/package-v1.json",
  type: "object",
  required: ["schemaVersion", "kind", "document"],
  additionalProperties: false,
  properties: {
    schemaVersion: { const: 1 },
    kind: { const: "write" },
    document: { type: "object" },
  },
} as const;
