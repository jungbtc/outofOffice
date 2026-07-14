# outofOffice

`outofOffice` is an independently designed, local-first office suite for Windows. One desktop application contains three focused editors: **Write** for documents, **Present** for presentations, and **Calculate** for spreadsheets.

This repository is licensed under AGPL-3.0-only. It is not affiliated with or endorsed by Microsoft, and it contains no Microsoft branding, templates, proprietary fonts, or source code.

## Development status

Version 0.1.0 is a functional vertical slice, not a finished Office-compatibility release.

Implemented and tested:

- Windows-first Tauri 2 shell with React, strict TypeScript, Zustand, Tailwind CSS, and Radix UI
- Multiple editable tabs plus light, dark, and system themes
- Write rich-text editing with common formatting and live word/character counts
- Present slide creation, duplication, deletion, text/shape objects, dragging, object properties, and slideshow mode
- Calculate cell editing, formatting, multiple worksheets, arithmetic, references, ranges, and an initial formula set
- ZIP-based `.oofdoc`, `.oofslides`, and `.oofsheet` packages
- Native open/save dialogs, atomic writes, recent and pinned files, drag-and-drop, launch-from-file, and SQLite metadata
- Ten-second recovery snapshots in the Windows application-data directory
- Archive entry, expansion, path, version, JSON-size, and extension/type validation
- Windows NSIS and file-association configuration

Not yet implemented: DOCX/PPTX/XLSX or OpenDocument import/export, PDF export, printing, images/tables in Write, image/group/crop tools in Present, charts and advanced spreadsheet formulas, user templates, and plugin loading. See [the roadmap](docs/roadmap.md).

## Screenshots

Screenshots will be added with the first signed preview release. Run the application locally to see the current home screen and editors.

## Supported systems

- Windows 10 64-bit
- Windows 11 64-bit
- WebView2 Runtime (the NSIS build embeds its offline installer)

macOS and Linux packages are intentionally not produced yet. The document model and TypeScript packages are platform-neutral so those targets can be added later.

## Formats

| Format                      | Open | Save | Status                                                    |
| --------------------------- | ---- | ---- | --------------------------------------------------------- |
| `.oofdoc`                   | Yes  | Yes  | Version 1 internal package                                |
| `.oofslides`                | Yes  | Yes  | Version 1 internal package                                |
| `.oofsheet`                 | Yes  | Yes  | Version 1 internal package                                |
| Office/OpenDocument formats | No   | No   | Planned; never claimed as compatible until fixture-tested |
| PDF/CSV                     | No   | No   | Planned                                                   |

The internal packages are publicly documented in [docs/file-formats.md](docs/file-formats.md).

## Install

Download `outofOffice_0.1.0_x64-setup.exe` from a project release, run it as a normal user, and follow the installer. The installer creates a Start Menu entry, registers the three internal extensions, includes an uninstaller, and stores no user documents in the installation directory.

Community builds are unsigned. Windows may show a SmartScreen warning until release signing is configured.

## Development setup

Install:

- Node.js 20.19 or newer (Node 22 LTS recommended)
- pnpm 10 or newer
- Rust stable with the `x86_64-pc-windows-msvc` target
- Visual Studio 2022 Build Tools with “Desktop development with C++” and a Windows 10/11 SDK
- WebView2 Runtime

Then run:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm tauri dev
```

`pnpm tauri dev` starts Vite and opens the native desktop application. Browser-only `pnpm dev` is useful for UI work, but native dialogs and ZIP storage are available only inside Tauri.

## Checks

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

## Production build and installer

From a Developer PowerShell with the MSVC tools available:

```powershell
pnpm install --frozen-lockfile
pnpm tauri build
```

The portable development executable is written to `target\release\outofOffice.exe`. The NSIS installer is written under `target\release\bundle\nsis\` and is named `outofOffice_0.1.0_x64-setup.exe`. Full setup and troubleshooting are in [docs/windows-build.md](docs/windows-build.md).

## Architecture

React components render document models but do not own editor truth. Serializable commands in `packages/commands` update independent models from `packages/document-model`. The Rust layer alone opens or saves user paths, validates package boundaries, performs atomic replacement, and owns SQLite recents/recovery metadata. See [docs/architecture.md](docs/architecture.md).

## Privacy

outofOffice has no telemetry, account, subscription, cloud service, API key, or background network requests. Documents, filenames, paths, recovery snapshots, and activity stay on the user’s computer. The application only makes a network request if a future feature explicitly opens a user-selected external link; no such request is part of this milestone.

## Known limitations

- The vertical slice is intended for small working files; the 300-page/200-slide/100,000-cell performance targets are not yet verified.
- Recovery keeps the newest snapshot for each document and at most 20 documents; recovery snapshots are not encrypted separately from the Windows user profile.
- The initial formula engine intentionally supports a subset and returns `#ERROR!` for unsupported functions.
- Community installers are not code-signed by default.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md) before participating. Do not publish suspected document-parser vulnerabilities before maintainers have had an opportunity to respond.

## License

Copyright © 2026 outofOffice contributors. Source code is provided under the [GNU Affero General Public License v3.0 only](LICENSE). Dependency notices are recorded in [NOTICE](NOTICE) and [docs/dependency-licenses.txt](docs/dependency-licenses.txt).
