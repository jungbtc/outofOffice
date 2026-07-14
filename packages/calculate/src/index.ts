import type { Cell, CellStyle, Worksheet } from "@outofoffice/document-model";

export type CellValue = string | number | boolean;

export const DEFAULT_CELL_STYLE: CellStyle = {
  bold: false,
  italic: false,
  underline: false,
  color: "#202124",
  background: "#ffffff",
  align: "left",
};

export function createCell(input: string, style: CellStyle = DEFAULT_CELL_STYLE): Cell {
  return { input, style: { ...style } };
}

export function columnName(index: number): string {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

export function cellAddress(row: number, column: number): string {
  return `${columnName(column)}${row + 1}`;
}

function columnIndex(name: string): number {
  let result = 0;
  for (const character of name.toUpperCase()) result = result * 26 + character.charCodeAt(0) - 64;
  return result - 1;
}

function addressParts(address: string): { row: number; column: number } {
  const match = /^\$?([A-Z]+)\$?(\d+)$/i.exec(address);
  if (!match?.[1] || !match[2]) throw new Error(`Invalid cell reference ${address}`);
  return { column: columnIndex(match[1]), row: Number(match[2]) - 1 };
}

type TokenType = "number" | "cell" | "identifier" | "string" | "operator" | "eof";
interface Token {
  type: TokenType;
  value: string;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let offset = 0;
  const pattern =
    /\s*(?:(\d+(?:\.\d+)?)|(\$?[A-Za-z]{1,3}\$?\d+)|([A-Za-z_][A-Za-z0-9_]*)|("(?:[^"]|"")*")|(<=|>=|<>|[+\-*/^=<>(),:]))/y;
  while (offset < source.length) {
    pattern.lastIndex = offset;
    const match = pattern.exec(source);
    if (!match)
      throw new Error(`Unexpected formula token near “${source.slice(offset, offset + 12)}”.`);
    offset = pattern.lastIndex;
    if (match[1]) tokens.push({ type: "number", value: match[1] });
    else if (match[2])
      tokens.push({ type: "cell", value: match[2].replaceAll("$", "").toUpperCase() });
    else if (match[3]) tokens.push({ type: "identifier", value: match[3].toUpperCase() });
    else if (match[4])
      tokens.push({ type: "string", value: match[4].slice(1, -1).replaceAll('""', '"') });
    else if (match[5]) tokens.push({ type: "operator", value: match[5] });
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

type FormulaValue = CellValue | CellValue[];
interface FormulaResolver {
  cell(address: string): CellValue;
  range(start: string, end: string): CellValue[];
}

function scalar(value: FormulaValue): CellValue {
  return Array.isArray(value) ? (value[0] ?? 0) : value;
}
function numeric(value: FormulaValue): number {
  const item = scalar(value);
  if (typeof item === "string" && item.startsWith("#")) throw new Error(item);
  const converted = Number(item);
  return Number.isFinite(converted) ? converted : 0;
}
function truthy(value: FormulaValue): boolean {
  const item = scalar(value);
  return typeof item === "string" ? item.length > 0 : Boolean(item);
}
function flatten(values: FormulaValue[]): CellValue[] {
  return values.flatMap((value) => (Array.isArray(value) ? value : [value]));
}

class FormulaParser {
  private index = 0;
  public constructor(
    private readonly tokens: Token[],
    private readonly resolver: FormulaResolver,
  ) {}
  private peek(): Token {
    return this.tokens[this.index] ?? { type: "eof", value: "" };
  }
  private take(): Token {
    const token = this.peek();
    this.index += 1;
    return token;
  }
  private accept(value: string): boolean {
    if (this.peek().value !== value) return false;
    this.index += 1;
    return true;
  }
  private expect(value: string): void {
    if (!this.accept(value)) throw new Error(`Expected “${value}”.`);
  }
  public parse(): CellValue {
    const value = scalar(this.comparison());
    if (this.peek().type !== "eof") throw new Error(`Unexpected “${this.peek().value}”.`);
    return value;
  }
  private comparison(): FormulaValue {
    let left = this.addition();
    const operator = this.peek().value;
    if (["=", "<>", "<", ">", "<=", ">="].includes(operator)) {
      this.take();
      const right = this.addition();
      const a = scalar(left);
      const b = scalar(right);
      if (operator === "=") left = a === b;
      else if (operator === "<>") left = a !== b;
      else if (operator === "<") left = a < b;
      else if (operator === ">") left = a > b;
      else if (operator === "<=") left = a <= b;
      else left = a >= b;
    }
    return left;
  }
  private addition(): FormulaValue {
    let value = this.multiplication();
    while (["+", "-"].includes(this.peek().value)) {
      const operator = this.take().value;
      const right = this.multiplication();
      value = operator === "+" ? numeric(value) + numeric(right) : numeric(value) - numeric(right);
    }
    return value;
  }
  private multiplication(): FormulaValue {
    let value = this.power();
    while (["*", "/"].includes(this.peek().value)) {
      const operator = this.take().value;
      const right = this.power();
      value = operator === "*" ? numeric(value) * numeric(right) : numeric(value) / numeric(right);
    }
    return value;
  }
  private power(): FormulaValue {
    let value = this.unary();
    if (this.accept("^")) value = numeric(value) ** numeric(this.power());
    return value;
  }
  private unary(): FormulaValue {
    if (this.accept("-")) return -numeric(this.unary());
    if (this.accept("+")) return numeric(this.unary());
    return this.primary();
  }
  private primary(): FormulaValue {
    const token = this.take();
    if (token.type === "number") return Number(token.value);
    if (token.type === "string") return token.value;
    if (token.type === "cell") {
      if (this.accept(":")) {
        const end = this.take();
        if (end.type !== "cell") throw new Error("A range must end with a cell reference.");
        return this.resolver.range(token.value, end.value);
      }
      return this.resolver.cell(token.value);
    }
    if (token.type === "identifier") {
      if (token.value === "TRUE") return true;
      if (token.value === "FALSE") return false;
      this.expect("(");
      const args: FormulaValue[] = [];
      if (!this.accept(")")) {
        do {
          args.push(this.comparison());
        } while (this.accept(","));
        this.expect(")");
      }
      return this.call(token.value, args);
    }
    if (token.value === "(") {
      const value = this.comparison();
      this.expect(")");
      return value;
    }
    throw new Error(`Unexpected “${token.value}”.`);
  }
  private call(name: string, args: FormulaValue[]): FormulaValue {
    const values = flatten(args);
    const numbers = values.map(Number).filter(Number.isFinite);
    switch (name) {
      case "SUM":
        return numbers.reduce((sum, value) => sum + value, 0);
      case "AVERAGE":
        return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
      case "COUNT":
        return numbers.length;
      case "COUNTA":
        return values.filter((value) => value !== "").length;
      case "MIN":
        return numbers.length ? Math.min(...numbers) : 0;
      case "MAX":
        return numbers.length ? Math.max(...numbers) : 0;
      case "IF":
        return truthy(args[0] ?? false) ? scalar(args[1] ?? true) : scalar(args[2] ?? false);
      case "AND":
        return args.every(truthy);
      case "OR":
        return args.some(truthy);
      case "NOT":
        return !truthy(args[0] ?? false);
      case "ROUND":
        return Number(numeric(args[0] ?? 0).toFixed(numeric(args[1] ?? 0)));
      case "CONCAT":
        return values.join("");
      case "LEFT":
        return String(scalar(args[0] ?? "")).slice(0, numeric(args[1] ?? 1));
      case "RIGHT":
        return String(scalar(args[0] ?? "")).slice(-numeric(args[1] ?? 1));
      case "MID":
        return String(scalar(args[0] ?? "")).slice(
          numeric(args[1] ?? 1) - 1,
          numeric(args[1] ?? 1) - 1 + numeric(args[2] ?? 1),
        );
      case "LEN":
        return String(scalar(args[0] ?? "")).length;
      case "TODAY": {
        const date = new Date();
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
      }
      case "NOW":
        return new Date().toISOString();
      case "YEAR":
        return new Date(String(scalar(args[0] ?? ""))).getFullYear();
      case "MONTH":
        return new Date(String(scalar(args[0] ?? ""))).getMonth() + 1;
      case "DAY":
        return new Date(String(scalar(args[0] ?? ""))).getDate();
      default:
        throw new Error(`Unsupported function ${name}.`);
    }
  }
}

export function evaluateFormula(formula: string, resolver: FormulaResolver): CellValue {
  return new FormulaParser(tokenize(formula.replace(/^=/, "")), resolver).parse();
}

export function evaluateCell(
  sheet: Worksheet,
  address: string,
  stack: ReadonlySet<string> = new Set(),
): CellValue {
  const normalized = address.replaceAll("$", "").toUpperCase();
  const cell = sheet.cells[normalized];
  if (!cell || cell.input === "") return "";
  if (!cell.input.startsWith("=")) {
    const number = Number(cell.input);
    return cell.input.trim() !== "" && Number.isFinite(number) ? number : cell.input;
  }
  if (stack.has(normalized)) return "#CYCLE!";
  const nextStack = new Set(stack).add(normalized);
  try {
    return evaluateFormula(cell.input, {
      cell: (reference) => evaluateCell(sheet, reference, nextStack),
      range: (start, end) => {
        const from = addressParts(start);
        const to = addressParts(end);
        const values: CellValue[] = [];
        for (let row = Math.min(from.row, to.row); row <= Math.max(from.row, to.row); row += 1) {
          for (
            let column = Math.min(from.column, to.column);
            column <= Math.max(from.column, to.column);
            column += 1
          ) {
            values.push(evaluateCell(sheet, cellAddress(row, column), nextStack));
          }
        }
        return values;
      },
    });
  } catch {
    return "#ERROR!";
  }
}
