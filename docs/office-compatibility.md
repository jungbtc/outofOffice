# Office and OpenDocument compatibility

No Microsoft Office or OpenDocument importer/exporter is enabled in 0.1.0. The application does not claim compatibility simply because an extension appears on the roadmap.

Planned adapters:

| Module    | Planned import                                | Planned export                      |
| --------- | --------------------------------------------- | ----------------------------------- |
| Write     | DOCX, ODT, RTF, TXT, Markdown, sanitized HTML | DOCX, ODT, PDF, TXT, Markdown, HTML |
| Present   | PPTX, ODP                                     | PPTX, ODP, PDF, PNG, JPEG           |
| Calculate | XLSX, ODS, CSV, TSV                           | XLSX, ODS, CSV, TSV, PDF            |

Each adapter must:

1. Parse in a sandboxed/background boundary with expansion and relationship limits.
2. Reject external entities and active content.
3. Warn when macros are present and never execute or silently preserve them.
4. Map into the independent outofOffice model rather than rendering foreign XML directly.
5. Test English, Korean, Unicode paths, malformed archives, and round trips with committed fixtures.
6. Publish a feature-level compatibility matrix and known-loss report.

Potential libraries require a fresh license, security, maintenance, and bundle-size review at the time of adoption. LibreOffice may later be an optional user-configured conversion helper but will never be a mandatory runtime.
