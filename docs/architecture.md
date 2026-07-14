# Architecture

## Layers

outofOffice is a pnpm workspace with a Tauri host.

| Layer                     | Responsibility                                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `apps/desktop`            | Accessible React shell, file tabs, transient selection/drag state, editor rendering                  |
| `packages/document-model` | Versioned Write, Present, and Calculate data independent of rendering                                |
| `packages/commands`       | Serializable operations, bounded undo/redo history, deterministic model updates                      |
| `packages/write`          | Text statistics and future writing-domain operations                                                 |
| `packages/present`        | Presentation object factories and future layout operations                                           |
| `packages/calculate`      | Cell utilities and formula tokenization, parsing, reference resolution, and evaluation               |
| `packages/file-formats`   | Typed package envelopes, boundary validation, schemas, and migrations                                |
| `packages/storage`        | Platform-neutral storage DTOs                                                                        |
| `src-tauri`               | Native dialogs, package I/O, archive security, atomic replacement, SQLite recents/recovery, bundling |

The document model is the source of truth. React may keep temporary UI state such as the selected cell or an in-progress drag, but a completed edit becomes a serializable command before it changes the model.

## Edit flow

1. An editor converts a user gesture into an `EditorCommand` containing before/after data.
2. The Zustand shell asks `packages/commands` to apply it to a cloned model.
3. The command is appended to bounded history and the tab becomes dirty.
4. Undo applies the command in reverse; redo reapplies it.
5. The periodic recovery service serializes the current model without changing the user’s file.

Commands intentionally contain no functions, DOM references, or component state. This supports recovery logs, tests, snapshots, and future collaboration.

## Save/open flow

The frontend can show a native dialog but cannot directly read an arbitrary path. It sends a typed payload and user-selected path to a Rust command. Rust validates schema and extension, creates the ZIP in the destination folder under an unpredictable temporary name, flushes it, and uses `MoveFileExW` with replace/write-through flags. A failed write removes the temporary file and leaves the original untouched.

Opening validates compressed size, entry count, aggregate uncompressed size, enclosed paths, JSON size, schema version, document kind, and extension before returning JSON. No package content is executed.

## Local data

SQLite and recovery files live below Tauri’s `app_data_dir` for `com.outofoffice.desktop`, never beside the executable. The database uses WAL mode and stores recents, pins, and recovery metadata. Recovery retains one current snapshot per document and at most 20 document snapshots.

## Portability

All editor packages are platform-neutral. Native operations are behind a small TypeScript bridge. Atomic replacement has a Windows implementation and a portable rename implementation. macOS/Linux bundling, dialogs, paths, and integration must be tested before those targets are enabled.

## Plugin boundary

Third-party plugins are not loaded in 0.1.0. A future host will expose capability-scoped commands and declarative toolbar/import/export registrations. Plugins will never receive raw process access or unrestricted filesystem paths.
