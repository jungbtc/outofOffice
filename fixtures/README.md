# Fixtures

Compatibility fixtures will be committed with the corresponding document adapters rather than added as empty placeholders.

Future fixture sets should include:

- English, Korean, mixed-script, emoji, and bidirectional text
- Unicode filenames and deeply nested paths
- Versioned `.oofdoc` packages
- DOCX, ODT, and RTF documents once those adapters exist
- Malformed archives, unsafe relationships, oversized content, and round-trip loss cases

Every compatibility claim must point to an automated fixture-backed test.
