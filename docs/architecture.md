# Architecture

## Layers

outofOffice is a pnpm workspace with a Tauri host and one focused document editor.

| Layer                     | Responsibility                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `apps/desktop`            | Accessible React shell, document tabs, transient interface state, and editor rendering                   |
| `packages/document-model` | Versioned Write data independent of rendering                                                            |
| `packages/commands`       | Serializable document operations, bounded undo/redo history, and deterministic updates                   |
| `packages/write`          | Text statistics and writing-domain operations                                                            |
| `packages/file-formats`   | Typed package envelopes, boundary validation, schemas, and migrations                                    |
| `packages/storage`        | Platform-neutral storage data-transfer types                                                             |
| `packages/ui`             | Reusable accessible interface controls                                                                   |
| `src-tauri`               | Native dialogs, package I/O, archive security, atomic replacement, SQLite recents/recovery, and bundling |

The document model is the source of truth. React may keep temporary selection, menu, or composition state, but a committed edit becomes a serializable command before it changes the stored model.

## Edit flow

1. The editor converts a committed user edit into an `EditorCommand` containing the information required to apply and reverse it.
2. The store applies the command to the current document model.
3. The command is appended to bounded history and the tab becomes dirty.
4. Undo applies the command in reverse; redo reapplies it.
5. Recovery periodically serializes dirty documents without changing the user’s chosen file.

Commands contain no DOM references, component state, or executable callbacks. This keeps history serializable and makes recovery and tests deterministic. Long typing sessions should be grouped into sensible undo units rather than retaining an unlimited full-document snapshot for every input event.

## Save and open flow

The frontend may show a native dialog but cannot directly read an arbitrary path. It sends a typed payload and user-selected path to Rust. Rust validates schema and extension, creates the ZIP beside the destination under an unpredictable temporary name, flushes it, and atomically replaces the destination. A failed write removes the temporary file and leaves the original untouched.

Opening validates compressed size, entry count, aggregate uncompressed size, enclosed paths, JSON size, schema version, document kind, and extension before returning JSON. Package content is never executed.

## Recovery and local data

SQLite and recovery files live below Tauri’s `app_data_dir` for `com.outofoffice.desktop`, never beside the executable. The database uses WAL mode and stores recents, pins, and recovery metadata.

The home screen requests recovery metadata only. A snapshot package is opened and validated only after the user chooses Recover, through the `load_recovery` command. This prevents every recovery payload from being held in memory while the home screen is visible. Recovery retains one current snapshot per document and at most 20 supported document snapshots.

Existing installations may contain records created by older, unsupported modules. Queries filter those records from the current interface without deleting their database rows or recovery files.

## Resource ownership

Long-lived listeners, timers, workers, object URLs, and editor instances must have explicit cleanup when their owning component or document closes. Native package reads are bounded. The application should avoid loading conversion code until the user invokes the corresponding feature.

## Portability

The editor packages are platform-neutral. Native operations are behind a small TypeScript bridge. Atomic replacement has a Windows implementation and a portable rename implementation. macOS and Linux bundling, dialogs, paths, and integration require testing before those targets are enabled.

## Plugin boundary

Third-party plugins are not loaded in 0.1.0. A future host would require capability-scoped commands and declarative registrations; plugins must never receive unrestricted process or filesystem access.
