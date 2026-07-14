import { useEffect, useMemo, useState } from "react";
import {
  createCell,
  cellAddress,
  columnName,
  DEFAULT_CELL_STYLE,
  evaluateCell,
} from "@outofoffice/calculate";
import { command, type EditorCommand } from "@outofoffice/commands";
import { createWorksheet, type CalculateDocument, type Cell } from "@outofoffice/document-model";
import { ToolbarButton } from "@outofoffice/ui";

interface CalculateEditorProps {
  document: CalculateDocument;
  dispatch(command: EditorCommand): void;
}
const ROWS = 40;
const COLUMNS = 16;

export function CalculateEditor({ document: model, dispatch }: CalculateEditorProps) {
  const [activeSheetId, setActiveSheetId] = useState(model.sheets[0]?.id ?? "");
  const [selectedAddress, setSelectedAddress] = useState("A1");
  const activeSheet = model.sheets.find((sheet) => sheet.id === activeSheetId) ?? model.sheets[0];
  useEffect(() => {
    if (!model.sheets.some((sheet) => sheet.id === activeSheetId))
      setActiveSheetId(model.sheets[0]?.id ?? "");
  }, [activeSheetId, model.sheets]);
  const addresses = useMemo(
    () =>
      Array.from({ length: ROWS }, (_, row) =>
        Array.from({ length: COLUMNS }, (__, column) => cellAddress(row, column)),
      ),
    [],
  );
  if (!activeSheet) return <div className="empty-editor">This spreadsheet has no worksheets.</div>;
  const selectedCell = activeSheet.cells[selectedAddress] ?? createCell("");
  const setCell = (address: string, after: Cell | null, label = "Change cell") => {
    dispatch(
      command(
        {
          type: "set-cell",
          sheetId: activeSheet.id,
          address,
          before: activeSheet.cells[address] ?? null,
          after,
        },
        label,
      ),
    );
  };
  const changeInput = (address: string, input: string) => {
    const existing = activeSheet.cells[address];
    setCell(
      address,
      input === "" && !existing ? null : createCell(input, existing?.style ?? DEFAULT_CELL_STYLE),
    );
  };
  const patchStyle = (patch: Partial<Cell["style"]>, label: string) =>
    setCell(
      selectedAddress,
      { ...selectedCell, style: { ...selectedCell.style, ...patch } },
      label,
    );
  const addSheet = () => {
    const sheet = createWorksheet(model.sheets.length + 1);
    dispatch(command({ type: "add-sheet", sheet, index: model.sheets.length }, "Add worksheet"));
    setActiveSheetId(sheet.id);
  };
  const renameSheet = () => {
    const name = window.prompt("Worksheet name", activeSheet.name)?.trim();
    if (name && name !== activeSheet.name)
      dispatch(
        command(
          { type: "rename-sheet", sheetId: activeSheet.id, before: activeSheet.name, after: name },
          "Rename worksheet",
        ),
      );
  };
  const deleteSheet = () => {
    if (model.sheets.length === 1) return;
    const index = model.sheets.findIndex((sheet) => sheet.id === activeSheet.id);
    const fallback = model.sheets[index === 0 ? 1 : index - 1];
    dispatch(command({ type: "delete-sheet", sheet: activeSheet, index }, "Delete worksheet"));
    setActiveSheetId(fallback?.id ?? "");
  };

  return (
    <section className="editor-module calculate-module" aria-label="Calculate editor">
      <div className="context-toolbar" role="toolbar" aria-label="Cell formatting">
        <ToolbarButton
          label="Bold"
          icon={<strong>B</strong>}
          active={selectedCell.style.bold}
          onClick={() => patchStyle({ bold: !selectedCell.style.bold }, "Toggle bold")}
        />
        <ToolbarButton
          label="Italic"
          icon={<em>I</em>}
          active={selectedCell.style.italic}
          onClick={() => patchStyle({ italic: !selectedCell.style.italic }, "Toggle italic")}
        />
        <ToolbarButton
          label="Underline"
          icon={<u>U</u>}
          active={selectedCell.style.underline}
          onClick={() =>
            patchStyle({ underline: !selectedCell.style.underline }, "Toggle underline")
          }
        />
        <span className="toolbar-separator" />
        <ToolbarButton
          label="Align left"
          icon="⇤"
          active={selectedCell.style.align === "left"}
          onClick={() => patchStyle({ align: "left" }, "Align left")}
        />
        <ToolbarButton
          label="Align center"
          icon="≡"
          active={selectedCell.style.align === "center"}
          onClick={() => patchStyle({ align: "center" }, "Align center")}
        />
        <ToolbarButton
          label="Align right"
          icon="⇥"
          active={selectedCell.style.align === "right"}
          onClick={() => patchStyle({ align: "right" }, "Align right")}
        />
        <label className="color-control">
          Text
          <input
            type="color"
            value={selectedCell.style.color}
            onChange={(event) => patchStyle({ color: event.target.value }, "Text color")}
          />
        </label>
        <label className="color-control">
          Fill
          <input
            type="color"
            value={selectedCell.style.background}
            onChange={(event) => patchStyle({ background: event.target.value }, "Cell fill")}
          />
        </label>
      </div>
      <div className="formula-bar">
        <strong>{selectedAddress}</strong>
        <span>fx</span>
        <input
          aria-label="Formula input"
          value={selectedCell.input}
          onChange={(event) => changeInput(selectedAddress, event.target.value)}
          placeholder="Enter a value or formula, e.g. =SUM(A1:A5)"
        />
      </div>
      <div className="sheet-viewport">
        <div
          className="sheet-grid"
          style={{ gridTemplateColumns: `46px repeat(${COLUMNS}, 112px)` }}
        >
          <div className="corner-cell" />
          {Array.from({ length: COLUMNS }, (_, column) => (
            <div key={column} className="column-header">
              {columnName(column)}
            </div>
          ))}
          {addresses.map((row, rowIndex) => (
            <div className="grid-row" key={rowIndex} style={{ display: "contents" }}>
              <div className="row-header">{rowIndex + 1}</div>
              {row.map((address) => {
                const cell = activeSheet.cells[address];
                const active = address === selectedAddress;
                const value = active
                  ? (cell?.input ?? "")
                  : String(evaluateCell(activeSheet, address));
                const style = cell?.style ?? DEFAULT_CELL_STYLE;
                return (
                  <input
                    key={address}
                    className={`grid-cell ${active ? "is-selected" : ""}`}
                    aria-label={address}
                    value={value}
                    style={{
                      fontWeight: style.bold ? 700 : 400,
                      fontStyle: style.italic ? "italic" : "normal",
                      textDecoration: style.underline ? "underline" : "none",
                      color: style.color,
                      background: style.background,
                      textAlign: style.align,
                    }}
                    onFocus={() => setSelectedAddress(address)}
                    onChange={(event) => changeInput(address, event.target.value)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="sheet-tabs">
        <button className="add-sheet" onClick={addSheet} title="Add worksheet">
          ＋
        </button>
        {model.sheets.map((sheet) => (
          <button
            key={sheet.id}
            className={sheet.id === activeSheet.id ? "is-active" : ""}
            onClick={() => setActiveSheetId(sheet.id)}
            onDoubleClick={renameSheet}
          >
            {sheet.name}
          </button>
        ))}
        <button onClick={renameSheet}>Rename</button>
        <button disabled={model.sheets.length === 1} onClick={deleteSheet}>
          Delete
        </button>
      </div>
      <div className="module-status">
        <span>{selectedAddress}</span>
        <span>{Object.keys(activeSheet.cells).length} populated cells</span>
        <span>Ready</span>
      </div>
    </section>
  );
}
