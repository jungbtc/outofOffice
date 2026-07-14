# Calculate module

## Current vertical slice

Calculate stores sparse cell maps in ordered worksheets. Users can enter values and formulas in cells or the formula bar, add/delete/rename/switch worksheets, and set bold, italic, underline, color, background, and alignment.

The recursive-descent formula engine supports arithmetic, comparison, relative/absolute A1 references, ranges, cycle handling, and these functions: `SUM`, `AVERAGE`, `COUNT`, `COUNTA`, `MIN`, `MAX`, `IF`, `AND`, `OR`, `NOT`, `ROUND`, `CONCAT`, `LEFT`, `RIGHT`, `MID`, `LEN`, `TODAY`, `NOW`, `YEAR`, `MONTH`, and `DAY`.

## Not yet implemented

Cross-sheet references, named ranges, lookup/conditional aggregate functions, row/column operations, resize, freeze, hide, merge, fill handle, sorting, filtering, conditional formatting, validation/dropdowns, number formats, charts, CSV/TSV import/export, XLSX/ODS import/export, and PDF export remain future work.

The visible grid is intentionally limited to 40×16 for the vertical slice. The performance milestone requires a virtualized grid, worker calculation graph, batched commands, and tests at 100,000 populated cells.
