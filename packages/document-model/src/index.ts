import { createId, type DocumentKind } from "@outofoffice/shared";

export const CURRENT_FORMAT_VERSION = 1;

export interface DocumentMetadata {
  id: string;
  title: string;
  createdAt: string;
  modifiedAt: string;
  author: string;
}

export interface PageSettings {
  size: "A4" | "Letter";
  orientation: "portrait" | "landscape";
  marginMm: number;
}

export interface WriteDocument {
  kind: "write";
  formatVersion: 1;
  metadata: DocumentMetadata;
  page: PageSettings;
  content: { html: string };
}

export type OfficeDocument = WriteDocument;

function now(): string {
  return new Date().toISOString();
}

function metadata(): DocumentMetadata {
  const timestamp = now();
  return {
    id: createId("document"),
    title: "Untitled document",
    createdAt: timestamp,
    modifiedAt: timestamp,
    author: "",
  };
}

export function createDocument(kind: DocumentKind = "write"): WriteDocument {
  return {
    kind,
    formatVersion: 1,
    metadata: metadata(),
    page: { size: "A4", orientation: "portrait", marginMm: 20 },
    content: { html: "<h1>Untitled document</h1><p>Start writing here…</p>" },
  };
}

export function cloneDocument(document: WriteDocument): WriteDocument {
  return structuredClone(document);
}

export function touchDocument<T extends WriteDocument>(document: T): T {
  document.metadata.modifiedAt = now();
  return document;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isOfficeDocument(value: unknown): value is WriteDocument {
  return (
    isRecord(value) &&
    value.kind === "write" &&
    value.formatVersion === CURRENT_FORMAT_VERSION &&
    isRecord(value.metadata) &&
    typeof value.metadata.id === "string" &&
    typeof value.metadata.title === "string" &&
    isRecord(value.content) &&
    typeof value.content.html === "string" &&
    isRecord(value.page)
  );
}

export function validateDocument(value: unknown): WriteDocument {
  if (!isOfficeDocument(value))
    throw new Error("The file does not contain a supported outofOffice Write document.");
  return value;
}
