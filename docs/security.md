# Security design

All documents are untrusted.

Implemented boundaries in 0.1.0:

- Native file selection with no unrestricted frontend filesystem capability
- Strict JSON validation on both TypeScript and Rust boundaries
- ZIP compressed, entry-count, aggregate expansion, content-size, and traversal checks
- Extension/kind matching
- Atomic writes in the destination directory
- HTML sanitization before Write content reaches the editable DOM
- CSP denying objects and frames; no telemetry or automatic external links
- No macro, JavaScript, executable, shell, or plugin execution
- Recovery filenames generated as UUIDs and resolved only through trusted database rows

Before Office import ships, the importer layer must add streaming ZIP-bomb checks, safe XML parsers with DTD/external entities disabled, relationship allowlists, image dimension/pixel limits, macro detection and warnings, external-link prompts, and removal rather than preservation of executable macros.

Before CSV export ships, cells beginning with `=`, `+`, `-`, `@`, tab, or carriage return need an explicit spreadsheet-injection warning and a user-selected mitigation.

Dependency auditing runs in Windows CI with `pnpm audit --prod` and Rust audit tooling. A dependency vulnerability is not waived merely because the vulnerable feature appears unused; waivers need a documented threat analysis and expiry.
