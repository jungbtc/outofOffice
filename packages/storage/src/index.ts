import type { InternalPackagePayload } from "@outofoffice/file-formats";
import type { DocumentKind } from "@outofoffice/shared";

export interface RecentFile {
  path: string;
  title: string;
  kind: DocumentKind;
  lastOpened: number;
  pinned: boolean;
}

export interface LoadedPackage {
  path: string;
  payload: InternalPackagePayload;
}

export interface RecoverySummary {
  id: string;
  documentId: string;
  title: string;
  kind: DocumentKind;
  originalPath: string | null;
  savedAt: number;
}

export interface LoadedRecovery extends RecoverySummary {
  payload: InternalPackagePayload;
}
