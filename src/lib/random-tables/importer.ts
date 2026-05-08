import { parseRandomTableEntries, type RandomTableEntry } from "./roller";

export const randomTableImportFormats = ["auto", "json", "markdown", "csv"] as const;

export type RandomTableImportFormat = (typeof randomTableImportFormats)[number];

export interface RandomTableImportOptions {
  format?: RandomTableImportFormat;
}

interface RawRandomTableEntry {
  label?: string;
  value?: unknown;
  weight?: number;
  subTableId?: string;
  templateVars?: Record<string, string>;
}

type CsvHeaderKey =
  | "value"
  | "weight"
  | "label"
  | "subTableId"
  | "templateVars";

const MARKDOWN_ENTRY_RE = /^\s*(?:[-*+]|\d+[.)])\s+(.+?)\s*$/;
const CHECKBOX_RE = /^\[[ xX]\]\s+/;

const HEADER_ALIASES: Record<CsvHeaderKey, string[]> = {
  value: ["value", "valore", "entry", "result", "risultato", "text", "testo"],
  weight: ["weight", "peso", "w"],
  label: ["label", "etichetta", "name", "nome"],
  subTableId: ["subtableid", "sub_table_id", "sub_table", "subtable", "table_id"],
  templateVars: ["templatevars", "template_vars", "vars", "variables"],
};

export class RandomTableImportError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RandomTableImportError";
  }
}

export function parseRandomTableImport(
  input: string,
  options: RandomTableImportOptions = {},
): RandomTableEntry[] {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new RandomTableImportError("Import vuoto");
  }

  const format = options.format ?? "auto";
  const rawEntries =
    format === "auto" ? parseAuto(trimmed) : parseByFormat(trimmed, format);

  try {
    return parseRandomTableEntries(rawEntries);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new RandomTableImportError(`Entries importate non valide: ${message}`, {
      cause: err,
    });
  }
}

function parseByFormat(
  input: string,
  format: Exclude<RandomTableImportFormat, "auto">,
): unknown {
  switch (format) {
    case "json":
      return parseJsonEntries(input);
    case "markdown":
      return parseMarkdownEntries(input);
    case "csv":
      return parseCsvEntries(input);
  }
}

function parseAuto(input: string): unknown {
  const first = input[0];
  if (first === "[" || first === "{") {
    return parseJsonEntries(input);
  }

  const nonEmptyLines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (nonEmptyLines.some((line) => MARKDOWN_ENTRY_RE.test(line))) {
    return parseMarkdownEntries(input);
  }

  return parseCsvEntries(input);
}

function parseJsonEntries(input: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input) as unknown;
  } catch (err) {
    throw new RandomTableImportError("JSON non valido", { cause: err });
  }

  if (Array.isArray(parsed)) return parsed;
  if (isRecord(parsed) && Array.isArray(parsed.entries)) return parsed.entries;

  throw new RandomTableImportError(
    "Il JSON deve essere un array di entries o un oggetto con campo entries",
  );
}

function parseMarkdownEntries(input: string): RawRandomTableEntry[] {
  const entries: RawRandomTableEntry[] = [];
  const lines = input.split(/\r?\n/);

  for (const line of lines) {
    const match = MARKDOWN_ENTRY_RE.exec(line);
    const body = match?.[1];
    if (!body) continue;
    entries.push(parseTextEntry(body.replace(CHECKBOX_RE, "").trim()));
  }

  if (entries.length === 0) {
    throw new RandomTableImportError("Nessuna entry Markdown trovata");
  }

  return entries;
}

function parseCsvEntries(input: string): RawRandomTableEntry[] {
  const rows = parseCsvRows(input).filter((row) =>
    row.some((field) => field.trim().length > 0),
  );
  const firstRow = rows[0];
  if (!firstRow) {
    throw new RandomTableImportError("CSV vuoto");
  }

  const headerMap = detectCsvHeaders(firstRow);
  const hasHeaders = headerMap.size > 0;
  const dataRows = hasHeaders ? rows.slice(1) : rows;

  return dataRows.map((row, index) =>
    hasHeaders
      ? parseCsvEntryWithHeaders(row, headerMap, index + 2)
      : parseCsvEntryWithoutHeaders(row, index + 1),
  );
}

function parseTextEntry(text: string): RawRandomTableEntry {
  const parts = text
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 2) {
    const firstWeight = parseOptionalWeight(parts[0]);
    const secondWeight = parseOptionalWeight(parts[1]);
    if (firstWeight !== null && parts[1]) {
      return { value: parts[1], weight: firstWeight };
    }
    if (secondWeight !== null && parts[0]) {
      return { value: parts[0], weight: secondWeight };
    }
  }

  const prefixMatch = /^(?:\[(\d+(?:[.,]\d+)?)\]|(\d+(?:[.,]\d+)?)x?)\s+(.+)$/i.exec(
    text,
  );
  const prefixValue = prefixMatch?.[3];
  if (prefixValue) {
    const weight = parseOptionalWeight(prefixMatch[1] ?? prefixMatch[2]);
    if (weight !== null) {
      return { value: prefixValue.trim(), weight };
    }
  }

  const suffixMatch = /^(.+?)\s+\((?:weight|peso|w):\s*(\d+(?:[.,]\d+)?)\)$/i.exec(
    text,
  );
  const suffixValue = suffixMatch?.[1];
  if (suffixValue) {
    const weight = parseOptionalWeight(suffixMatch[2]);
    if (weight !== null) {
      return { value: suffixValue.trim(), weight };
    }
  }

  return { value: text };
}

function parseCsvEntryWithHeaders(
  row: string[],
  headerMap: Map<CsvHeaderKey, number>,
  rowNumber: number,
): RawRandomTableEntry {
  const value = getCsvField(row, headerMap, "value");
  const subTableId = getCsvField(row, headerMap, "subTableId");
  const label = getCsvField(row, headerMap, "label");
  const weightText = getCsvField(row, headerMap, "weight");
  const templateVarsText = getCsvField(row, headerMap, "templateVars");
  const entry: RawRandomTableEntry = {};

  if (value) entry.value = value;
  if (subTableId) entry.subTableId = subTableId;
  if (label) entry.label = label;
  if (weightText) entry.weight = parseRequiredWeight(weightText, rowNumber);
  if (templateVarsText) entry.templateVars = parseTemplateVars(templateVarsText, rowNumber);

  return entry;
}

function parseCsvEntryWithoutHeaders(
  row: string[],
  rowNumber: number,
): RawRandomTableEntry {
  const value = row[0]?.trim();
  const weightText = row[1]?.trim();
  const label = row[2]?.trim();

  const entry: RawRandomTableEntry = {};
  if (value) entry.value = value;
  if (weightText) entry.weight = parseRequiredWeight(weightText, rowNumber);
  if (label) entry.label = label;
  return entry;
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);

  if (inQuotes) {
    throw new RandomTableImportError("CSV con virgolette non chiuse");
  }

  return rows;
}

function detectCsvHeaders(row: string[]): Map<CsvHeaderKey, number> {
  const headerMap = new Map<CsvHeaderKey, number>();

  row.forEach((cell, index) => {
    const key = csvHeaderKeyFor(cell);
    if (key && !headerMap.has(key)) {
      headerMap.set(key, index);
    }
  });

  return headerMap;
}

function csvHeaderKeyFor(cell: string): CsvHeaderKey | null {
  const normalized = normalizeHeader(cell);

  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(normalized)) {
      return key as CsvHeaderKey;
    }
  }

  return null;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function getCsvField(
  row: string[],
  headerMap: Map<CsvHeaderKey, number>,
  key: CsvHeaderKey,
): string | null {
  const index = headerMap.get(key);
  if (index === undefined) return null;
  const value = row[index]?.trim();
  return value ? value : null;
}

function parseRequiredWeight(value: string, rowNumber: number): number {
  const weight = parseOptionalWeight(value);
  if (weight === null) {
    throw new RandomTableImportError(`Peso CSV non valido alla riga ${rowNumber}`);
  }
  return weight;
}

function parseOptionalWeight(value: string | undefined): number | null {
  if (!value) return null;
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const weight = Number(normalized);
  return Number.isFinite(weight) && weight > 0 ? weight : null;
}

function parseTemplateVars(
  value: string,
  rowNumber: number,
): Record<string, string> {
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch (err) {
      throw new RandomTableImportError(
        `templateVars JSON non valido alla riga ${rowNumber}`,
        { cause: err },
      );
    }
    if (!isStringRecord(parsed)) {
      throw new RandomTableImportError(
        `templateVars deve essere un oggetto stringa-stringa alla riga ${rowNumber}`,
      );
    }
    return parsed;
  }

  const pairs = trimmed
    .split(/[;,]/)
    .map((pair) => pair.trim())
    .filter(Boolean);
  const record: Record<string, string> = {};

  for (const pair of pairs) {
    const separatorIndex = pair.search(/[:=]/);
    if (separatorIndex <= 0) {
      throw new RandomTableImportError(
        `templateVars non valido alla riga ${rowNumber}`,
      );
    }
    const key = pair.slice(0, separatorIndex).trim();
    const tableId = pair.slice(separatorIndex + 1).trim();
    if (!key || !tableId) {
      throw new RandomTableImportError(
        `templateVars non valido alla riga ${rowNumber}`,
      );
    }
    record[key] = tableId;
  }

  return record;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) return false;
  return Object.values(value).every((item) => typeof item === "string");
}
