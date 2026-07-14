import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { writeContentCommand, type EditorCommand } from "@outofoffice/commands";
import type { PageSettings, WriteDocument } from "@outofoffice/document-model";
import { ToolbarButton } from "@outofoffice/ui";
import { textStatistics, type TextStatistics } from "@outofoffice/write";
import { sanitizeDocumentHtml, sanitizePastedHtml } from "../lib/sanitize";

const COMMIT_DELAY_MS = 650;
const STATS_DELAY_MS = 220;

interface FormattingState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikeThrough: boolean;
  superscript: boolean;
  subscript: boolean;
  formatBlock: string;
}

const EMPTY_FORMATTING: FormattingState = {
  bold: false,
  italic: false,
  underline: false,
  strikeThrough: false,
  superscript: false,
  subscript: false,
  formatBlock: "p",
};

export interface WriteEditorHandle {
  flush(label?: string): void;
  focus(): void;
}

interface WriteEditorProps {
  document: WriteDocument;
  dirty: boolean;
  lastAutosaveAt: number | null;
  dispatch(command: EditorCommand): void;
  onDraftDirty(): void;
  onUndo(): void;
  onRedo(): void;
  onPageChange(page: Partial<PageSettings>): void;
}

function sameFormatting(left: FormattingState, right: FormattingState): boolean {
  return Object.keys(left).every(
    (key) => left[key as keyof FormattingState] === right[key as keyof FormattingState],
  );
}

function pageDimensions(page: PageSettings): [number, number] {
  const dimensions: [number, number] = page.size === "A4" ? [210, 297] : [216, 279];
  return page.orientation === "portrait" ? dimensions : [dimensions[1], dimensions[0]];
}

function formatAutosave(timestamp: number | null): string {
  if (!timestamp) return "Recovery pending";
  return `Recovered ${new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000))}`;
}

export const WriteEditor = forwardRef<WriteEditorHandle, WriteEditorProps>(function WriteEditor(
  { document: model, dirty, lastAutosaveAt, dispatch, onDraftDirty, onUndo, onRedo, onPageChange },
  forwardedRef,
) {
  const editor = useRef<HTMLDivElement>(null);
  const findInput = useRef<HTMLInputElement>(null);
  const selection = useRef<Range | null>(null);
  const commitTimer = useRef<number | null>(null);
  const statsTimer = useRef<number | null>(null);
  const committedHtml = useRef(model.content.html);
  const hasDraft = useRef(false);
  const findCursor = useRef(0);
  const [statistics, setStatistics] = useState<TextStatistics>({ words: 0, characters: 0 });
  const [formatting, setFormatting] = useState(EMPTY_FORMATTING);
  const [zoom, setZoom] = useState(100);
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [findStatus, setFindStatus] = useState("");

  const refreshStatistics = useCallback(() => {
    const text = editor.current?.innerText ?? "";
    setStatistics(textStatistics(text));
  }, []);

  const scheduleStatistics = useCallback(() => {
    if (statsTimer.current !== null) window.clearTimeout(statsTimer.current);
    statsTimer.current = window.setTimeout(refreshStatistics, STATS_DELAY_MS);
  }, [refreshStatistics]);

  const flush = useCallback(
    (label = "Type text") => {
      if (commitTimer.current !== null) {
        window.clearTimeout(commitTimer.current);
        commitTimer.current = null;
      }
      const element = editor.current;
      if (!element || !hasDraft.current) return;
      const next = element.innerHTML;
      const before = committedHtml.current;
      hasDraft.current = false;
      if (next === before) return;
      committedHtml.current = next;
      dispatch(writeContentCommand(before, next, label));
    },
    [dispatch],
  );

  useImperativeHandle(
    forwardedRef,
    () => ({
      flush,
      focus: () => editor.current?.focus(),
    }),
    [flush],
  );

  const scheduleCommit = useCallback(() => {
    if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
    commitTimer.current = window.setTimeout(() => flush(), COMMIT_DELAY_MS);
  }, [flush]);

  const markChanged = useCallback(
    (immediateLabel?: string) => {
      if (!hasDraft.current) {
        hasDraft.current = true;
        onDraftDirty();
      }
      scheduleStatistics();
      if (immediateLabel) flush(immediateLabel);
      else scheduleCommit();
    },
    [flush, onDraftDirty, scheduleCommit, scheduleStatistics],
  );

  useLayoutEffect(() => {
    const element = editor.current;
    if (!element || model.content.html === committedHtml.current) return;
    const safeHtml = sanitizeDocumentHtml(model.content.html);
    if (element.innerHTML !== safeHtml) element.innerHTML = safeHtml;
    committedHtml.current = safeHtml;
    hasDraft.current = false;
    refreshStatistics();
  }, [model.content.html, refreshStatistics]);

  useLayoutEffect(() => {
    const element = editor.current;
    if (!element || element.childNodes.length > 0) return;
    const safeHtml = sanitizeDocumentHtml(model.content.html);
    element.innerHTML = safeHtml;
    committedHtml.current = safeHtml;
    refreshStatistics();
  }, [model.content.html, refreshStatistics]);

  useEffect(
    () => () => {
      if (commitTimer.current !== null) window.clearTimeout(commitTimer.current);
      if (statsTimer.current !== null) window.clearTimeout(statsTimer.current);
    },
    [],
  );

  const rememberSelection = useCallback(() => {
    const element = editor.current;
    const current = globalThis.getSelection();
    if (!element || !current?.rangeCount) return;
    const range = current.getRangeAt(0);
    if (element.contains(range.commonAncestorContainer)) selection.current = range.cloneRange();
  }, []);

  const restoreSelection = useCallback(() => {
    const saved = selection.current;
    const current = globalThis.getSelection();
    if (!saved || !current) return;
    current.removeAllRanges();
    current.addRange(saved);
  }, []);

  const refreshFormatting = useCallback(() => {
    const element = editor.current;
    const current = globalThis.getSelection();
    if (!element || !current?.anchorNode || !element.contains(current.anchorNode)) return;
    rememberSelection();
    const next: FormattingState = {
      bold: globalThis.document.queryCommandState("bold"),
      italic: globalThis.document.queryCommandState("italic"),
      underline: globalThis.document.queryCommandState("underline"),
      strikeThrough: globalThis.document.queryCommandState("strikeThrough"),
      superscript: globalThis.document.queryCommandState("superscript"),
      subscript: globalThis.document.queryCommandState("subscript"),
      formatBlock:
        String(globalThis.document.queryCommandValue("formatBlock") || "p")
          .replace(/[<>]/g, "")
          .toLowerCase() || "p",
    };
    setFormatting((currentValue) => (sameFormatting(currentValue, next) ? currentValue : next));
  }, [rememberSelection]);

  useEffect(() => {
    globalThis.document.addEventListener("selectionchange", refreshFormatting);
    return () => globalThis.document.removeEventListener("selectionchange", refreshFormatting);
  }, [refreshFormatting]);

  const runCommand = useCallback(
    (name: string, value?: string, label = `Format ${name}`) => {
      editor.current?.focus();
      restoreSelection();
      globalThis.document.execCommand(name, false, value);
      hasDraft.current = true;
      onDraftDirty();
      scheduleStatistics();
      flush(label);
      queueMicrotask(refreshFormatting);
    },
    [flush, onDraftDirty, refreshFormatting, restoreSelection, scheduleStatistics],
  );

  const insertLink = useCallback(() => {
    const href = window.prompt("Paste or enter a link address", "https://");
    if (!href) return;
    runCommand("createLink", href, "Insert link");
  }, [runCommand]);

  const insertTable = useCallback(() => {
    runCommand(
      "insertHTML",
      "<table><tbody><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr></tbody></table><p><br></p>",
      "Insert table",
    );
  }, [runCommand]);

  const insertPageBreak = useCallback(() => {
    runCommand(
      "insertHTML",
      '<hr class="page-break" contenteditable="false"><p><br></p>',
      "Insert page break",
    );
  }, [runCommand]);

  const findNext = useCallback(() => {
    const root = editor.current;
    const query = findText.trim();
    if (!root || !query) {
      setFindStatus("Enter text to find");
      return false;
    }
    const walker = globalThis.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: Array<{ node: Text; start: number; end: number }> = [];
    let fullText = "";
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const start = fullText.length;
      fullText += node.data;
      nodes.push({ node, start, end: fullText.length });
    }
    const haystack = fullText.toLocaleLowerCase();
    const needle = query.toLocaleLowerCase();
    let index = haystack.indexOf(needle, findCursor.current);
    if (index < 0 && findCursor.current > 0) index = haystack.indexOf(needle);
    if (index < 0) {
      setFindStatus("No matches");
      findCursor.current = 0;
      return false;
    }
    const startEntry = nodes.find((entry) => index >= entry.start && index < entry.end);
    const endOffset = index + query.length;
    const endEntry =
      nodes.find((entry) => endOffset > entry.start && endOffset <= entry.end) ?? startEntry;
    if (!startEntry || !endEntry) return false;
    const range = globalThis.document.createRange();
    range.setStart(startEntry.node, index - startEntry.start);
    range.setEnd(endEntry.node, endOffset - endEntry.start);
    const current = globalThis.getSelection();
    current?.removeAllRanges();
    current?.addRange(range);
    selection.current = range.cloneRange();
    findCursor.current = endOffset;
    setFindStatus(`Found at character ${index + 1}`);
    return true;
  }, [findText]);

  const replaceCurrent = useCallback(() => {
    if (!selection.current && !findNext()) return;
    restoreSelection();
    globalThis.document.execCommand("insertText", false, replaceText);
    hasDraft.current = true;
    onDraftDirty();
    flush("Replace text");
    scheduleStatistics();
    findCursor.current = 0;
    setFindStatus("Replaced");
  }, [findNext, flush, onDraftDirty, replaceText, restoreSelection, scheduleStatistics]);

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const html = event.clipboardData.getData("text/html");
      const plain = event.clipboardData.getData("text/plain");
      if (html) globalThis.document.execCommand("insertHTML", false, sanitizePastedHtml(html));
      else globalThis.document.execCommand("insertText", false, plain);
      markChanged("Paste");
    },
    [markChanged],
  );

  const handleEditorKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const key = event.key.toLocaleLowerCase();
      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        flush();
        if (event.shiftKey) onRedo();
        else onUndo();
      } else if ((event.ctrlKey || event.metaKey) && key === "y") {
        event.preventDefault();
        flush();
        onRedo();
      } else if ((event.ctrlKey || event.metaKey) && key === "f") {
        event.preventDefault();
        setFindOpen(true);
        requestAnimationFrame(() => findInput.current?.focus());
      } else if ((event.ctrlKey || event.metaKey) && key === "p") {
        event.preventDefault();
        flush();
        window.print();
      } else if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        insertPageBreak();
      }
    },
    [flush, insertPageBreak, onRedo, onUndo],
  );

  const [pageWidth, pageHeight] = pageDimensions(model.page);
  const paperStyle = {
    "--page-width": `${pageWidth}mm`,
    "--page-height": `${pageHeight}mm`,
    "--page-margin": `${model.page.marginMm}mm`,
    "--editor-zoom": zoom / 100,
  } as CSSProperties;

  const preventToolbarBlur = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <section className="editor-module write-module" aria-label="Write editor">
      <div className="word-ribbon" role="toolbar" aria-label="Document formatting">
        <div className="ribbon-group ribbon-styles" aria-label="Styles">
          <select
            aria-label="Paragraph style"
            value={formatting.formatBlock}
            onPointerDown={rememberSelection}
            onChange={(event) => runCommand("formatBlock", event.target.value, "Change style")}
          >
            <option value="p">Normal</option>
            <option value="h1">Title</option>
            <option value="h2">Heading 1</option>
            <option value="h3">Heading 2</option>
            <option value="blockquote">Quote</option>
          </select>
          <select
            aria-label="Font family"
            defaultValue="Georgia"
            onPointerDown={rememberSelection}
            onChange={(event) => runCommand("fontName", event.target.value, "Change font")}
          >
            <option value="Georgia">Georgia</option>
            <option value="Arial">Arial</option>
            <option value="Calibri">Calibri</option>
            <option value="Courier New">Courier New</option>
            <option value="Times New Roman">Times New Roman</option>
          </select>
          <select
            className="font-size-select"
            aria-label="Font size"
            defaultValue="3"
            onPointerDown={rememberSelection}
            onChange={(event) => runCommand("fontSize", event.target.value, "Change font size")}
          >
            <option value="2">10</option>
            <option value="3">12</option>
            <option value="4">14</option>
            <option value="5">18</option>
            <option value="6">24</option>
            <option value="7">32</option>
          </select>
        </div>

        <span className="toolbar-separator" />
        <div className="ribbon-group" aria-label="Text emphasis">
          <ToolbarButton
            label="Bold (Ctrl+B)"
            icon={<strong>B</strong>}
            active={formatting.bold}
            onPointerDown={preventToolbarBlur}
            onClick={() => runCommand("bold")}
          />
          <ToolbarButton
            label="Italic (Ctrl+I)"
            icon={<em>I</em>}
            active={formatting.italic}
            onPointerDown={preventToolbarBlur}
            onClick={() => runCommand("italic")}
          />
          <ToolbarButton
            label="Underline (Ctrl+U)"
            icon={<u>U</u>}
            active={formatting.underline}
            onPointerDown={preventToolbarBlur}
            onClick={() => runCommand("underline")}
          />
          <ToolbarButton
            label="Strikethrough"
            icon={<s>S</s>}
            active={formatting.strikeThrough}
            onPointerDown={preventToolbarBlur}
            onClick={() => runCommand("strikeThrough")}
          />
          <ToolbarButton
            label="Superscript"
            icon="x²"
            active={formatting.superscript}
            onPointerDown={preventToolbarBlur}
            onClick={() => runCommand("superscript")}
          />
          <ToolbarButton
            label="Subscript"
            icon="x₂"
            active={formatting.subscript}
            onPointerDown={preventToolbarBlur}
            onClick={() => runCommand("subscript")}
          />
          <ToolbarButton
            label="Clear formatting"
            icon="Clear"
            onPointerDown={preventToolbarBlur}
            onClick={() => runCommand("removeFormat", undefined, "Clear formatting")}
          />
          <label className="color-control" title="Text color">
            <span aria-hidden="true">A</span>
            <input
              aria-label="Text color"
              type="color"
              defaultValue="#202124"
              onPointerDown={rememberSelection}
              onChange={(event) => runCommand("foreColor", event.target.value, "Text color")}
            />
          </label>
          <label className="color-control" title="Highlight color">
            <span aria-hidden="true">Highlight</span>
            <input
              aria-label="Highlight color"
              type="color"
              defaultValue="#fff1a8"
              onPointerDown={rememberSelection}
              onChange={(event) => runCommand("hiliteColor", event.target.value, "Highlight text")}
            />
          </label>
        </div>

        <span className="toolbar-separator" />
        <div className="ribbon-group" aria-label="Paragraph">
          <ToolbarButton
            label="Bulleted list"
            icon="• List"
            onPointerDown={preventToolbarBlur}
            onClick={() => runCommand("insertUnorderedList")}
          />
          <ToolbarButton
            label="Numbered list"
            icon="1. List"
            onPointerDown={preventToolbarBlur}
            onClick={() => runCommand("insertOrderedList")}
          />
          <ToolbarButton
            label="Decrease indent"
            icon="< Indent"
            onPointerDown={preventToolbarBlur}
            onClick={() => runCommand("outdent")}
          />
          <ToolbarButton
            label="Increase indent"
            icon="Indent >"
            onPointerDown={preventToolbarBlur}
            onClick={() => runCommand("indent")}
          />
          <ToolbarButton
            label="Align left"
            icon="Left"
            onPointerDown={preventToolbarBlur}
            onClick={() => runCommand("justifyLeft")}
          />
          <ToolbarButton
            label="Align center"
            icon="Center"
            onPointerDown={preventToolbarBlur}
            onClick={() => runCommand("justifyCenter")}
          />
          <ToolbarButton
            label="Align right"
            icon="Right"
            onPointerDown={preventToolbarBlur}
            onClick={() => runCommand("justifyRight")}
          />
          <ToolbarButton
            label="Justify"
            icon="Justify"
            onPointerDown={preventToolbarBlur}
            onClick={() => runCommand("justifyFull")}
          />
        </div>

        <span className="toolbar-separator" />
        <div className="ribbon-group" aria-label="Insert and review">
          <ToolbarButton
            label="Insert link"
            icon="Link"
            onPointerDown={preventToolbarBlur}
            onClick={insertLink}
          />
          <ToolbarButton
            label="Insert a basic 2 by 2 table"
            icon="Table"
            onPointerDown={preventToolbarBlur}
            onClick={insertTable}
          />
          <ToolbarButton
            label="Insert page break (Ctrl+Enter)"
            icon="Page break"
            onPointerDown={preventToolbarBlur}
            onClick={insertPageBreak}
          />
          <ToolbarButton
            label="Find and replace (Ctrl+F)"
            icon="Find"
            active={findOpen}
            onPointerDown={preventToolbarBlur}
            onClick={() => {
              setFindOpen((value) => !value);
              requestAnimationFrame(() => findInput.current?.focus());
            }}
          />
          <ToolbarButton
            label="Print or save as PDF (Ctrl+P)"
            icon="Print"
            onPointerDown={preventToolbarBlur}
            onClick={() => {
              flush();
              window.print();
            }}
          />
        </div>

        <span className="toolbar-separator" />
        <div className="ribbon-group page-controls" aria-label="Page layout">
          <select
            aria-label="Page size"
            value={model.page.size}
            onChange={(event) => onPageChange({ size: event.target.value as PageSettings["size"] })}
          >
            <option value="A4">A4</option>
            <option value="Letter">Letter</option>
          </select>
          <select
            aria-label="Page orientation"
            value={model.page.orientation}
            onChange={(event) =>
              onPageChange({ orientation: event.target.value as PageSettings["orientation"] })
            }
          >
            <option value="portrait">Portrait</option>
            <option value="landscape">Landscape</option>
          </select>
          <select
            aria-label="Page margins"
            value={model.page.marginMm}
            onChange={(event) => onPageChange({ marginMm: Number(event.target.value) })}
          >
            <option value={12}>Narrow</option>
            <option value={20}>Normal</option>
            <option value={28}>Wide</option>
          </select>
        </div>
      </div>

      {findOpen && (
        <form
          className="find-panel"
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            findNext();
          }}
        >
          <label>
            <span>Find</span>
            <input
              ref={findInput}
              value={findText}
              onChange={(event) => {
                setFindText(event.target.value);
                findCursor.current = 0;
                setFindStatus("");
              }}
            />
          </label>
          <label>
            <span>Replace with</span>
            <input value={replaceText} onChange={(event) => setReplaceText(event.target.value)} />
          </label>
          <button type="submit">Find next</button>
          <button type="button" onClick={replaceCurrent}>
            Replace
          </button>
          <span className="find-status" aria-live="polite">
            {findStatus}
          </span>
          <button
            type="button"
            className="quiet-icon-button"
            aria-label="Close find and replace"
            onClick={() => setFindOpen(false)}
          >
            ×
          </button>
        </form>
      )}

      <div className="write-workspace">
        <article
          ref={editor}
          className="paper"
          style={paperStyle}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          aria-label="Document content"
          onBeforeInput={(event) => {
            if ((event.nativeEvent as InputEvent).inputType === "historyUndo")
              event.preventDefault();
          }}
          onInput={() => markChanged()}
          onPaste={handlePaste}
          onKeyDown={handleEditorKeyDown}
          onBlur={() => flush()}
        />
      </div>

      <footer className="module-status" aria-label="Document status">
        <span>{statistics.words} words</span>
        <span>{statistics.characters} characters</span>
        <span>
          {model.page.size} · {model.page.orientation}
        </span>
        <span className={`save-state ${dirty ? "is-dirty" : ""}`}>
          {dirty ? formatAutosave(lastAutosaveAt) : "Saved"}
        </span>
        <div className="zoom-control" role="group" aria-label="Document zoom">
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((value) => Math.max(60, value - 10))}
          >
            −
          </button>
          <output>{zoom}%</output>
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((value) => Math.min(180, value + 10))}
          >
            +
          </button>
        </div>
      </footer>
    </section>
  );
});
