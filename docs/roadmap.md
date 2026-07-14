# Roadmap

## Phase 1 — focused foundation

Keep one document editor, one internal format, and one installer association. The current source includes the Tauri shell, document tabs, native dialogs, SQLite recents, themes, the `.oofdoc` package foundation, recovery snapshots, and NSIS configuration.

## Phase 2 — performance and reliability

- Bound and group undo history so long typing sessions do not retain unlimited document copies.
- Keep recovery listings metadata-only and load one snapshot on demand.
- Avoid duplicated editor state and unnecessary React subscriptions.
- Clean up listeners, timers, workers, object URLs, and editor resources when documents close.
- Add repeated open/edit/close memory tests and large-document fixtures.
- Exercise crash recovery and unsaved-change protection.

Performance claims require measurements on a documented machine and workload. A single ordinary document should remain comfortable on typical supported Windows hardware; memory should grow predictably with actual content and open documents.

## Phase 3 — document editing depth

Move from the initial HTML editing surface toward a structured document model with granular transactions. Add reliable reusable styles, outline navigation, tables, images, links, page breaks, margins, headers, footers, page numbers, find and replace, spelling integration, zoom, keyboard navigation, and print layout.

## Phase 4 — import, export, and print

Add hardened DOCX and ODT adapters with fixture-backed loss reports, followed by PDF export and printing. Load conversion code only when requested. Do not advertise compatibility until automated fixtures prove the supported subset.

## Phase 5 — Windows hardening

Run accessibility audits, high-DPI and multi-monitor matrices, Unicode and long-path tests, installer upgrades, code signing, dependency audits, and stable release checks on Windows 10 and 11.

Experimental plugins begin only after the core editor has a permission model and reliable document boundaries. macOS and Linux follow Windows release hardening.
