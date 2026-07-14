import { invoke } from "@tauri-apps/api/core";
import type { InternalPackagePayload } from "@outofoffice/file-formats";
import { FILE_EXTENSIONS } from "@outofoffice/shared";
import type { LoadedPackage, RecentFile, RecoverySummary } from "@outofoffice/storage";

export const isTauri = (): boolean =>
  typeof window !== "undefined" && window.__TAURI_INTERNALS__ !== undefined;

const filters = [{ name: "outofOffice Write documents", extensions: [FILE_EXTENSIONS.write] }];

export async function selectOpenPath(): Promise<string | null> {
  if (!isTauri()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({ multiple: false, directory: false, filters });
  return typeof result === "string" ? result : null;
}

export async function selectSavePath(title: string): Promise<string | null> {
  if (!isTauri()) return null;
  const { save } = await import("@tauri-apps/plugin-dialog");
  return save({
    defaultPath: `${title}.${FILE_EXTENSIONS.write}`,
    filters,
  });
}

export async function loadInternal(path: string): Promise<LoadedPackage> {
  return invoke<LoadedPackage>("load_document", { path });
}

export async function saveInternal(path: string, payload: InternalPackagePayload): Promise<string> {
  return invoke<string>("save_document", { request: { path, payload } });
}

export async function listRecentFiles(): Promise<RecentFile[]> {
  return isTauri() ? invoke<RecentFile[]>("list_recent_files") : [];
}

export async function setRecentPinned(path: string, pinned: boolean): Promise<void> {
  await invoke("set_recent_pinned", { path, pinned });
}

export async function saveRecovery(
  payload: InternalPackagePayload,
  originalPath: string | null,
): Promise<number> {
  return invoke<number>("save_recovery", { request: { payload, originalPath } });
}

export async function listRecoveries(): Promise<RecoverySummary[]> {
  return isTauri() ? invoke<RecoverySummary[]>("list_recoveries") : [];
}

export async function loadRecovery(id: string): Promise<InternalPackagePayload> {
  return invoke<InternalPackagePayload>("load_recovery", { id });
}

export async function clearRecovery(documentId: string): Promise<void> {
  if (isTauri()) await invoke("clear_recovery", { documentId });
}

export async function discardRecovery(id: string): Promise<void> {
  await invoke("discard_recovery", { id });
}

export async function listLaunchFiles(): Promise<string[]> {
  return isTauri() ? invoke<string[]>("list_launch_files") : [];
}

export async function askToDiscardChanges(title: string): Promise<boolean> {
  const message = `Discard unsaved changes to “${title}”?`;
  if (!isTauri()) return window.confirm(message);
  const { confirm } = await import("@tauri-apps/plugin-dialog");
  return confirm(message, {
    title: "Unsaved changes",
    kind: "warning",
    okLabel: "Discard",
    cancelLabel: "Keep editing",
  });
}
