# outofOffice

`outofOffice` is an independently designed, local-first word processor for Windows. It focuses on creating and editing documents without an account, subscription, cloud service, or telemetry.

The project is licensed under AGPL-3.0-only. It is not affiliated with or endorsed by Microsoft and includes no Microsoft branding, templates, proprietary fonts, assets, or source code.

## Development status

Version 0.1.0 is an early functional build, not a finished Microsoft Word compatibility release.

Implemented and tested today:

- Windows-first Tauri 2 desktop shell with React and strict TypeScript
- Create, open, edit, save, rename, duplicate, and safely close documents across multiple tabs
- Editable rich text with headings, quotes, inline formatting, colors, highlighting, alignment, indentation, and lists
- Links, basic tables, page breaks, find and replace, spell-check integration, and live word and character counts
- A4 and Letter page setup with orientation, margins, zoom, print layout, printing, and system Print to PDF
- HTML and plain-text export without presenting either format as a lossless editable document format
- Autosave, bounded undo and redo, recovery snapshots, and unsaved-change protection
- Accessible light, dark, and system themes with reduced-motion and high-contrast support
- ZIP-based `.oofdoc` files with native open/save dialogs and atomic replacement
- Recent and pinned files, drag-and-drop, launch-from-file, and SQLite metadata
- Lightweight recovery listings that load a snapshot only when the user chooses it
- Archive size, entry, expansion, path, version, JSON-size, and extension/type validation
- Windows NSIS packaging and `.oofdoc` file association

Not yet implemented or compatibility-tested: DOCX/ODT/RTF import or export, direct PDF-file generation outside the system print workflow, images, headers and footers, page numbers, multilevel lists, document outlines, tracked changes, comments, collaboration, and a structured pagination engine. Unsupported features must not be presented as working.

## Supported systems

- Windows 10 64-bit
- Windows 11 64-bit
- WebView2 Runtime; the NSIS build embeds its offline installer

macOS and Linux packages are not produced yet. The document model and TypeScript packages remain platform-neutral so those targets can be evaluated after the Windows build is stable.

## Formats

| Format                   | Open | Save or export | Status                                                   |
| ------------------------ | ---- | -------------- | -------------------------------------------------------- |
| `.oofdoc`                | Yes  | Yes            | Version 1 editable internal package                      |
| Plain text (`.txt`)      | No   | Export         | Formatting is intentionally removed                      |
| HTML (`.html`)           | No   | Export         | Sanitized document body; not a round-trip package        |
| PDF                      | No   | Print          | Use the operating system's Print to PDF destination      |
| DOCX, ODT, RTF, Markdown | No   | No             | Planned; no compatibility claim or conversion is offered |

The internal package is documented in [docs/file-formats.md](docs/file-formats.md). Opening a file never overwrites it merely to migrate or inspect it.

## Install

Download `outofOffice_0.1.0_x64-setup.exe` from a project release and run it as a normal user. The installer creates a Start Menu entry, registers `.oofdoc`, includes an uninstaller, and stores no user documents in the installation directory.

Community builds are unsigned. Windows may show a SmartScreen warning until release signing is configured.

## Development setup

Install:

- Node.js 20.19 or newer; Node 22 LTS is recommended
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

`pnpm tauri dev` starts Vite and opens the native desktop application. Browser-only `pnpm dev` is useful for interface work, but native dialogs and package storage are available only inside Tauri.

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

## Production build

From a Developer PowerShell with the MSVC tools available:

```powershell
pnpm install --frozen-lockfile
pnpm tauri build
```

The portable executable is written to `target\release\outofOffice.exe`. The NSIS installer is written below `target\release\bundle\nsis\`. Full setup and troubleshooting are in [docs/windows-build.md](docs/windows-build.md).

## Architecture and performance

React renders the document model, serializable commands drive undo and redo, and Rust alone opens or saves user-selected paths. The native layer also validates package boundaries, performs atomic replacement, and owns SQLite recents and recovery metadata. See [docs/architecture.md](docs/architecture.md).

Performance work prioritizes compact bounded history, avoiding duplicate document state during typing, keeping recovery payloads off the home screen, revision-aware autosave, and explicit browser-resource cleanup. Under the recorded Chromium stress workload, retained JavaScript heap growth fell from 1,013,216 bytes to 408,608 bytes (59.7%), while the main production bundle fell from 301.67 kB to 255.13 kB. See [docs/performance.md](docs/performance.md) for the method, full results, and important limits of these measurements.

## Privacy

outofOffice has no telemetry, account, subscription, cloud service, API key, or background network requests. Documents, filenames, paths, recovery snapshots, and activity stay on the user’s computer.

## Known limitations

- `.oofdoc` is the only supported editable document format in this release; HTML and plain text are export-only.
- Recovery keeps the newest snapshot for each active document and at most 20 supported snapshots; snapshots are not encrypted separately from the Windows user profile.
- Metadata for unsupported legacy recovery entries is hidden without deleting the underlying user data.
- Basic tables, page breaks, and print styling are available, but rich-text editing is not yet a complete structured or paginated document engine.
- Community installers are not code-signed by default.

## Contributing and security

Read [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), and [SECURITY.md](SECURITY.md) before participating. Do not publish suspected document-parser vulnerabilities before maintainers have had an opportunity to respond.

## License

Copyright © 2026 outofOffice contributors. Source code is provided under the [GNU Affero General Public License v3.0 only](LICENSE). Dependency notices are recorded in [NOTICE](NOTICE) and [docs/dependency-licenses.txt](docs/dependency-licenses.txt).
