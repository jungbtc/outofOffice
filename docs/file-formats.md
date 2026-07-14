# Internal file formats

## Overview

The three formats are ordinary ZIP packages:

- Write: `.oofdoc`
- Present: `.oofslides`
- Calculate: `.oofsheet`

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

The 0.1.0 reader rejects packages larger than 64 MiB compressed, more than 128 entries, more than 64 MiB total declared uncompressed data, a `content.json` larger than 32 MiB, absolute or parent-traversing paths, backslash paths, missing content, mismatched kind/extension, and unsupported versions. It never extracts an archive tree to disk.

These conservative limits precede media support and will become per-entry/per-media limits in a later format version. Readers must not execute scripts, macros, embedded binaries, external relationships, or formulas as code.

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
    }
  }
}
```

`schemaVersion` versions the ZIP envelope. `document.formatVersion` versions the module model. `kind` must agree in all locations. Identifiers are opaque, stable strings and must be preserved by editors.

The TypeScript JSON Schema is exported as `packageJsonSchema` from `packages/file-formats`. Version 0 development envelopes migrate to version 1 by adding the new envelope version; unknown versions fail clearly.

## Module content

Write stores page settings and sanitized HTML in `document.content.html`. HTML is data, not an execution context; renderers must sanitize it and block scripts, event attributes, objects, frames, and embeds.

Present stores slide size plus ordered slides. Each slide has a stable ID, title, hidden flag, background, notes, and ordered objects. Version 1 object kinds are `text`, `rectangle`, and `ellipse`, with numeric geometry in a 960×540 coordinate space.

Calculate stores ordered worksheets. Cells are sparse maps keyed by uppercase A1 addresses. Each cell contains the user’s input and style. Formula text begins with `=`; cached values are intentionally not authoritative.

## Compatibility policy

Writers must emit the current version. Readers may migrate older supported versions in memory and must never overwrite the source merely by opening it. A version bump needs schema documentation, migration tests, round-trip tests, and backward fixtures containing English and Korean text.

Third-party implementations may use these formats without permission, subject only to their own implementation’s licenses and trademarks.
