export const PRODUCT = {
  displayName: "outofOffice Write",
  executable: "outofOffice.exe",
  packageId: "com.outofoffice.desktop",
  slug: "outofoffice",
  version: "0.1.0",
  modules: { write: "Write" },
} as const;

export type DocumentKind = "write";

export const FILE_EXTENSIONS: Record<DocumentKind, string> = {
  write: "oofdoc",
};

export function createId(prefix: string): string {
  const random =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
