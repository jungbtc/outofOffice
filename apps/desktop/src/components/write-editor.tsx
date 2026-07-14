import { useEffect, useRef } from "react";
import DOMPurify from "dompurify";
import { command, type EditorCommand } from "@outofoffice/commands";
import type { WriteDocument } from "@outofoffice/document-model";
import { ToolbarButton } from "@outofoffice/ui";
import { textStatistics } from "@outofoffice/write";

interface WriteEditorProps {
  document: WriteDocument;
  dispatch(command: EditorCommand): void;
}

export function WriteEditor({ document: model, dispatch }: WriteEditorProps) {
  const editor = useRef<HTMLDivElement>(null);
  const safeHtml = DOMPurify.sanitize(model.content.html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
    FORBID_ATTR: ["onerror", "onload", "onclick"],
  });
  useEffect(() => {
    if (editor.current && editor.current.innerHTML !== safeHtml)
      editor.current.innerHTML = safeHtml;
  }, [safeHtml]);

  const commit = (next: string, label: string) => {
    if (next !== model.content.html)
      dispatch(
        command({ type: "set-write-content", before: model.content.html, after: next }, label),
      );
  };
  const format = (name: string, value?: string) => {
    editor.current?.focus();
    globalThis.document.execCommand(name, false, value);
    if (editor.current) commit(editor.current.innerHTML, `Format ${name}`);
  };
  const stats = textStatistics(model.content.html);

  return (
    <section className="editor-module write-module" aria-label="Write editor">
      <div className="context-toolbar" role="toolbar" aria-label="Text formatting">
        <select
          aria-label="Paragraph style"
          defaultValue="p"
          onChange={(event) => format("formatBlock", event.target.value)}
        >
          <option value="p">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="blockquote">Quote</option>
        </select>
        <span className="toolbar-separator" />
        <ToolbarButton
          label="Bold (Ctrl+B)"
          icon={<strong>B</strong>}
          onClick={() => format("bold")}
        />
        <ToolbarButton label="Italic (Ctrl+I)" icon={<em>I</em>} onClick={() => format("italic")} />
        <ToolbarButton
          label="Underline (Ctrl+U)"
          icon={<u>U</u>}
          onClick={() => format("underline")}
        />
        <ToolbarButton
          label="Strikethrough"
          icon={<s>S</s>}
          onClick={() => format("strikeThrough")}
        />
        <span className="toolbar-separator" />
        <ToolbarButton
          label="Bulleted list"
          icon="• List"
          onClick={() => format("insertUnorderedList")}
        />
        <ToolbarButton
          label="Numbered list"
          icon="1. List"
          onClick={() => format("insertOrderedList")}
        />
        <ToolbarButton label="Align left" icon="⇤" onClick={() => format("justifyLeft")} />
        <ToolbarButton label="Align center" icon="≡" onClick={() => format("justifyCenter")} />
        <ToolbarButton label="Align right" icon="⇥" onClick={() => format("justifyRight")} />
        <label className="color-control" title="Text color">
          A
          <input
            type="color"
            defaultValue="#202124"
            onChange={(event) => format("foreColor", event.target.value)}
          />
        </label>
        <label className="color-control" title="Highlight color">
          ▰
          <input
            type="color"
            defaultValue="#fff1a8"
            onChange={(event) => format("hiliteColor", event.target.value)}
          />
        </label>
      </div>
      <div className="write-workspace">
        <article
          ref={editor}
          className="paper"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          aria-label="Document content"
          onInput={(event) => commit(event.currentTarget.innerHTML, "Type text")}
        />
      </div>
      <div className="module-status">
        <span>{stats.words} words</span>
        <span>{stats.characters} characters</span>
        <span>
          {model.page.size} · {model.page.orientation}
        </span>
      </div>
    </section>
  );
}
