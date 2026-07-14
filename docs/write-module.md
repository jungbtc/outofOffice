# Write module

## Current editor

Write uses a versioned `WriteDocument` containing metadata, page settings, and sanitized HTML content. The current editor supports paragraphs, headings, quotes, font family and size, bold, italic, underline, strikethrough, superscript, subscript, foreground and highlight colors, clear formatting, lists, indentation, alignment, and live word and character counts.

The editable DOM remains local while the user types and commits after a short idle period or before an operation that requires current content, such as save, undo, tab switching, printing, or closing. Committed changes become serializable minimal text patches, so undo, redo, recovery, and save operations do not depend on component state or retain full before-and-after document copies. History is limited to 250 entries and approximately 4 MiB of command data.

Saved `.oofdoc` files close and reopen through the native package path. DOMPurify sanitizes stored content before it enters the editable surface. Recovery listings contain only metadata; the native host loads a chosen package on demand.

## Document workflows

The application can create, open, edit, save, rename, and duplicate `.oofdoc` documents. Revision-aware autosave skips unchanged tabs, recovery snapshots protect dirty documents, and closing a modified tab offers Save, Don't Save, or Cancel.

HTML and plain-text export are available. Printing uses the operating system print dialog, which also provides Print to PDF where the platform supports it; there is no separate direct PDF generator. Find and replace, links, basic 2-by-2 table insertion, page breaks, native spell checking, clipboard sanitization, keyboard formatting shortcuts, word count, and zoom are available.

The page presentation supports A4 and Letter paper, portrait and landscape orientation, configurable margins, and print-specific styling. These settings control the visual paper and printed output, but they do not turn the current HTML editor into a structured pagination engine.

## Design direction

The interface should retain the familiar hierarchy of a desktop word processor while remaining independently designed. Formatting controls need visible focus, selected, disabled, and error states. Motion should be brief, interruptible, and disabled by reduced-motion preferences; the editing surface itself should not animate while typing.

## Not yet implemented

DOCX/ODT/RTF import or export, direct PDF-file generation, images, headers and footers, page numbers, multilevel lists, reusable style definitions, document outline navigation, comments, tracked changes, collaboration, and true structured pagination are not implemented or compatibility-tested in 0.1.0.

The next major model step is a structured editor with granular transactions and a documented mapping to the public package format. It must preserve reliable save/recovery behavior and be tested against long documents, repeated open/close cycles, Korean text, IME composition, and clipboard input.
