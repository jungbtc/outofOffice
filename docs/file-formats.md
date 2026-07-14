# Internal file format

## Overview

The supported internal format is `.oofdoc`, an ordinary ZIP package for Write documents.

Version 1 packages contain:

```text
manifest.json
content.json
styles.json
metadata.json
media/
previews/
```

Unknown safe entries may be ignored for forward compatibility. Required content must not depend on entry order.

## Limits and safety

The 0.1.0 reader rejects packages larger than 64 MiB compressed, more than 128 entries, more than 64 MiB total declared uncompressed data, a `content.json` larger than 32 MiB, unsafe archive paths, missing content, a kind or extension mismatch, and unsupported versions. It never extracts an archive tree to disk.

These conservative limits precede media support and will become per-entry and per-media limits in a later format version. Readers must not execute scripts, macros, embedded binaries, or external relationships.

## Manifest

```json
{
  "format": "outofOffice package",
  "schemaVersion": 1,
  "kind": "write",
  "documentId": "document-…",
  "createdBy": "outofOffice 0.1.0"
}
```

## Content envelope

```json
{
  "schemaVersion": 1,
  "kind": "write",
  "document": {
    "kind": "write",
    "formatVersion": 1,
    "metadata": {
      "id": "document-…",
      "title": "Untitled document",
      "createdAt": "2026-07-14T00:00:00.000Z",
      "modifiedAt": "2026-07-14T00:00:00.000Z",
      "author": ""
    },
    "page": {
      "size": "A4",
      "orientation": "portrait",
      "marginMm": 20
    },
    "content": {
      "html": "<p>Start writing here…</p>"
    }
  }
}
```

`schemaVersion` versions the ZIP envelope. `document.formatVersion` versions the document model. `kind` must be `write` in both locations. Identifiers are opaque stable strings and must be preserved by editors.

The TypeScript schema is exported as `packageJsonSchema` from `packages/file-formats`. Unknown versions fail clearly. Opening an older supported version may migrate it in memory, but opening alone must never overwrite the source.

## Content safety

Write stores page settings and sanitized HTML in `document.content.html`. HTML is data, not an execution context. Renderers must sanitize it and block scripts, event attributes, objects, frames, and embeds before it reaches the editable DOM.

## Compatibility policy

Writers emit the current version. A version bump requires schema documentation, migration tests, round-trip tests, and backward fixtures containing English, Korean, and representative Unicode text.

Third-party implementations may use the format without permission, subject to their own licenses and trademarks.
