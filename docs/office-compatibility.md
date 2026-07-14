# Document compatibility

No Microsoft Office or OpenDocument importer or exporter is enabled in 0.1.0. The application does not claim compatibility merely because a format appears on the roadmap.

Planned document adapters:

| Planned import                                | Planned export                      |
| --------------------------------------------- | ----------------------------------- |
| DOCX, ODT, RTF, TXT, Markdown, sanitized HTML | DOCX, ODT, PDF, TXT, Markdown, HTML |

Each adapter must:

1. Parse behind a bounded background or sandboxed boundary.
2. Reject external entities and active content.
3. Detect macros and never execute or silently preserve them.
4. Map into the independent outofOffice document model rather than rendering foreign XML directly.
5. Test English, Korean, Unicode paths, malformed archives, and round trips with committed fixtures.
6. Publish a feature-level compatibility matrix and known-loss report.
7. Load only when the user invokes the associated import or export action.

Potential libraries require a fresh license, security, maintenance, memory, and bundle-size review at adoption time. LibreOffice may later be an optional user-configured conversion helper, but it will not be a mandatory runtime.
