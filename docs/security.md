# Security design

All documents are untrusted.

Implemented boundaries in 0.1.0:

- Native file selection with no unrestricted frontend filesystem capability
- Strict JSON validation at TypeScript and Rust boundaries
- ZIP compressed-size, entry-count, aggregate-expansion, content-size, and path checks
- `.oofdoc` extension and `write` kind matching
- Atomic writes in the destination directory
- HTML sanitization before document content reaches the editable DOM
- CSP denying objects and frames; no telemetry or automatic external links
- No macro, JavaScript, executable, shell, or plugin execution
- Recovery filenames generated as UUIDs and resolved through trusted database rows
- Recovery lists return metadata only; package bytes are read and validated on explicit recovery

Unsupported legacy recovery metadata is filtered from current queries without deleting old database rows or files. This avoids an upgrade turning feature removal into silent user-data deletion.

Before DOCX or ODT import ships, the importer must add streaming ZIP-bomb checks, safe XML parsing with DTDs and external entities disabled, relationship allowlists, image dimension and pixel limits, macro detection and warnings, and explicit external-link handling.

Dependency auditing runs in Windows CI with `pnpm audit --prod` and Rust audit tooling. A dependency vulnerability is not waived merely because its feature appears unused; waivers require a documented threat analysis and expiry.
