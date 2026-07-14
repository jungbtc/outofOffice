# Roadmap

## Phase 1 — foundation

Implemented in the current source: Tauri shell, home, tabs, native dialog bridge, SQLite recents, themes, internal package foundation, and NSIS configuration.

## Phase 2 — functional vertical slice

Implemented in the current source: basic editing and internal save/reopen for Write, Present, and Calculate; serializable undo/redo; recovery snapshots. Native compile/installer verification remains a release-machine gate.

## Phase 3 — import and export

Add hardened DOCX, PPTX, XLSX, and CSV adapters plus shared PDF export. Publish fixture-backed compatibility matrices.

## Phase 4 — editing depth

Move Write to a structured editor, complete page/table/image tools, add full presentation manipulation and notes, virtualize Calculate, expand formulas, and add live charts and templates.

## Phase 5 — Windows hardening

Exercise crash/forced-termination recovery, performance targets, accessibility audits, high-DPI/multi-monitor matrices, Unicode paths, installer upgrades, code signing, dependency audits, and stable releases.

Experimental plugins begin only after a permission model and core editors are reliable. macOS and Linux follow Windows release hardening, not before.
