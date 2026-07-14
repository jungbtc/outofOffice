# Write module

## Current vertical slice

Write uses an independent `WriteDocument` with versioned metadata, page settings, and HTML content. The editor supports paragraphs, two heading levels, quotes, bold, italic, underline, strikethrough, text/highlight color, bullets, numbering, and alignment. Every committed DOM change becomes a serializable `set-write-content` command. The status bar reports words, characters, page size, and orientation.

Saved `.oofdoc` files close and reopen through the shared package path. DOMPurify sanitizes content before it is inserted into the editing surface.

## Not yet implemented

Images, tables, links UI, page breaks, headers/footers, page numbers, margin controls, print/continuous layout switching, find/replace, document outline, DOCX/ODT/RTF/Markdown/HTML import, and PDF/DOCX/ODT export remain future work. They must not be advertised as working.

The next editor-depth step is a structured ProseMirror/Tiptap model that maps operations to granular commands while preserving the public package migration contract.
