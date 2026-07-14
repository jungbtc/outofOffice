import { createId, type DocumentKind } from "@outofoffice/shared";

export const CURRENT_FORMAT_VERSION = 1;

export interface DocumentMetadata {
  id: string;
  title: string;
  createdAt: string;
  modifiedAt: string;
  author: string;
}

export interface WriteDocument {
  kind: "write";
  formatVersion: 1;
  metadata: DocumentMetadata;
  page: {
    size: "A4" | "Letter";
    orientation: "portrait" | "landscape";
    marginMm: number;
  };
  content: { html: string };
}

export type SlideObjectType = "text" | "rectangle" | "ellipse";

export interface SlideObject {
  id: string;
  type: SlideObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  text: string;
  fontSize: number;
}

export interface Slide {
  id: string;
  title: string;
  hidden: boolean;
  background: string;
  objects: SlideObject[];
  notes: string;
}

export interface PresentDocument {
  kind: "present";
  formatVersion: 1;
  metadata: DocumentMetadata;
  size: { width: number; height: number; orientation: "landscape" | "portrait" };
  slides: Slide[];
}

export interface CellStyle {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  background: string;
  align: "left" | "center" | "right";
}

export interface Cell {
  input: string;
  style: CellStyle;
}

export interface Worksheet {
  id: string;
  name: string;
  cells: Record<string, Cell>;
  columnWidths: Record<string, number>;
  rowHeights: Record<string, number>;
}

export interface CalculateDocument {
  kind: "calculate";
  formatVersion: 1;
  metadata: DocumentMetadata;
  sheets: Worksheet[];
}

export type OfficeDocument = WriteDocument | PresentDocument | CalculateDocument;

function now(): string {
  return new Date().toISOString();
}

function metadata(kind: DocumentKind): DocumentMetadata {
  const timestamp = now();
  const titles: Record<DocumentKind, string> = {
    write: "Untitled document",
    present: "Untitled presentation",
    calculate: "Untitled spreadsheet",
  };
  return {
    id: createId("document"),
    title: titles[kind],
    createdAt: timestamp,
    modifiedAt: timestamp,
    author: "",
  };
}

export function createSlide(index = 1): Slide {
  return {
    id: createId("slide"),
    title: `Slide ${index}`,
    hidden: false,
    background: "#ffffff",
    objects: [],
    notes: "",
  };
}

export function createWorksheet(index = 1): Worksheet {
  return {
    id: createId("sheet"),
    name: `Sheet ${index}`,
    cells: {},
    columnWidths: {},
    rowHeights: {},
  };
}

export function createDocument(kind: "write"): WriteDocument;
export function createDocument(kind: "present"): PresentDocument;
export function createDocument(kind: "calculate"): CalculateDocument;
export function createDocument(kind: DocumentKind): OfficeDocument;
export function createDocument(kind: DocumentKind): OfficeDocument {
  switch (kind) {
    case "write":
      return {
        kind,
        formatVersion: 1,
        metadata: metadata(kind),
        page: { size: "A4", orientation: "portrait", marginMm: 20 },
        content: { html: "<h1>Untitled document</h1><p>Start writing here…</p>" },
      };
    case "present": {
      const first = createSlide();
      first.objects.push({
        id: createId("object"),
        type: "text",
        x: 80,
        y: 110,
        width: 800,
        height: 100,
        rotation: 0,
        fill: "transparent",
        text: "Untitled presentation",
        fontSize: 42,
      });
      return {
        kind,
        formatVersion: 1,
        metadata: metadata(kind),
        size: { width: 960, height: 540, orientation: "landscape" },
        slides: [first],
      };
    }
    case "calculate":
      return {
        kind,
        formatVersion: 1,
        metadata: metadata(kind),
        sheets: [createWorksheet()],
      };
  }
}

export function cloneDocument<T extends OfficeDocument>(document: T): T {
  return structuredClone(document);
}

export function touchDocument<T extends OfficeDocument>(document: T): T {
  document.metadata.modifiedAt = now();
  return document;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isOfficeDocument(value: unknown): value is OfficeDocument {
  if (!isRecord(value) || value.formatVersion !== CURRENT_FORMAT_VERSION) return false;
  if (
    !isRecord(value.metadata) ||
    typeof value.metadata.id !== "string" ||
    typeof value.metadata.title !== "string"
  )
    return false;
  if (value.kind === "write") {
    return (
      isRecord(value.content) && typeof value.content.html === "string" && isRecord(value.page)
    );
  }
  if (value.kind === "present") {
    return Array.isArray(value.slides) && isRecord(value.size);
  }
  if (value.kind === "calculate") {
    return Array.isArray(value.sheets);
  }
  return false;
}

export function validateDocument(value: unknown): OfficeDocument {
  if (!isOfficeDocument(value))
    throw new Error("The file does not contain a supported outofOffice document.");
  return value;
}
