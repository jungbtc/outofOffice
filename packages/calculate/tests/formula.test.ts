import { describe, expect, it } from "vitest";
import { createWorksheet } from "@outofoffice/document-model";
import { createCell, evaluateCell } from "../src";

describe("formula calculation", () => {
  it("calculates arithmetic, references, ranges, and common functions", () => {
    const sheet = createWorksheet();
    sheet.cells.A1 = createCell("10");
    sheet.cells.A2 = createCell("20");
    sheet.cells.A3 = createCell("=SUM(A1:A2) * 2");
    sheet.cells.B1 = createCell('=IF(A3=60,"yes","no")');
    expect(evaluateCell(sheet, "A3")).toBe(60);
    expect(evaluateCell(sheet, "B1")).toBe("yes");
  });

  it("detects circular references", () => {
    const sheet = createWorksheet();
    sheet.cells.A1 = createCell("=A1+1");
    expect(evaluateCell(sheet, "A1")).toBe("#ERROR!");
  });
});
