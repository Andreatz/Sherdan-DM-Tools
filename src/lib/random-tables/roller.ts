import { z } from "zod";

const DEFAULT_MAX_DEPTH = 8;

const rawTemplateVarsSchema = z.record(z.string(), z.string());

const rawEntrySchema = z
  .object({
    label: z.string().trim().min(1).optional(),
    value: z.unknown().optional(),
    weight: z.number().finite().positive().optional(),
    subTableId: z.string().trim().min(1).optional(),
    sub_table_id: z.string().trim().min(1).optional(),
    templateVars: rawTemplateVarsSchema.optional(),
    template_vars: rawTemplateVarsSchema.optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    const hasValue = Object.prototype.hasOwnProperty.call(entry, "value");
    const subTableId = entry.subTableId ?? entry.sub_table_id;
    if (!hasValue && !subTableId) {
      ctx.addIssue({
        code: "custom",
        message: "Entry must define value or subTableId.",
      });
    }
  });

export const randomTableEntriesSchema = z
  .array(rawEntrySchema)
  .min(1, "Random table must contain at least one entry.")
  .transform((entries) =>
    entries.map((entry) => ({
      label: entry.label ?? null,
      value: entry.value,
      weight: entry.weight ?? 1,
      subTableId: entry.subTableId ?? entry.sub_table_id ?? null,
      templateVars: entry.templateVars ?? entry.template_vars ?? {},
    })),
  );

export type RandomTableEntry = z.infer<typeof randomTableEntriesSchema>[number];

export interface RandomTableDefinition {
  id: string;
  name?: string | null;
  entries: unknown;
}

export interface RandomTableRollOptions {
  rng?: () => number;
  maxDepth?: number;
  resolveTable?: (
    tableId: string,
  ) => RandomTableDefinition | null | undefined | Promise<RandomTableDefinition | null | undefined>;
}

export interface RandomTableRollTrace {
  tableId: string;
  tableName: string | null;
  depth: number;
  random: number;
  threshold: number;
  totalWeight: number;
  entryIndex: number;
  entryWeight: number;
  entryLabel: string | null;
  entryValue: unknown;
  subTableId: string | null;
  nested: RandomTableRollTrace | null;
}

export interface RandomTableRollResult {
  tableId: string;
  tableName: string | null;
  value: unknown;
  trace: RandomTableRollTrace;
}

type RandomTableRollErrorCode =
  | "circular_reference"
  | "depth_limit"
  | "invalid_rng"
  | "missing_subtable";

export class RandomTableRollError extends Error {
  constructor(
    public readonly code: RandomTableRollErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RandomTableRollError";
  }
}

export function parseRandomTableEntries(entries: unknown): RandomTableEntry[] {
  return randomTableEntriesSchema.parse(entries);
}

export async function rollRandomTable(
  table: RandomTableDefinition,
  options: RandomTableRollOptions = {},
): Promise<RandomTableRollResult> {
  const context = {
    rng: options.rng ?? Math.random,
    maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
    resolveTable: options.resolveTable,
    path: [] as string[],
  };
  return rollTable(table, context, 0);
}

async function rollTable(
  table: RandomTableDefinition,
  context: Required<Pick<RandomTableRollOptions, "rng" | "maxDepth">> & {
    resolveTable?: RandomTableRollOptions["resolveTable"];
    path: string[];
  },
  depth: number,
): Promise<RandomTableRollResult> {
  if (depth > context.maxDepth) {
    throw new RandomTableRollError(
      "depth_limit",
      `Random table nesting exceeded max depth ${context.maxDepth}.`,
    );
  }
  if (context.path.includes(table.id)) {
    throw new RandomTableRollError(
      "circular_reference",
      `Circular random table reference: ${[...context.path, table.id].join(" -> ")}.`,
    );
  }

  const entries = parseRandomTableEntries(table.entries);
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const random = context.rng();
  if (!Number.isFinite(random) || random < 0 || random >= 1) {
    throw new RandomTableRollError(
      "invalid_rng",
      "Random table rng must return a finite number >= 0 and < 1.",
    );
  }

  const threshold = random * totalWeight;
  const { entry, index } = selectEntry(entries, threshold);
  let nested: RandomTableRollTrace | null = null;
  let value = entry.value;

  if (entry.subTableId) {
    if (!context.resolveTable) {
      throw new RandomTableRollError(
        "missing_subtable",
        `Entry references sub-table ${entry.subTableId}, but no resolver was provided.`,
      );
    }
    const subTable = await context.resolveTable(entry.subTableId);
    if (!subTable) {
      throw new RandomTableRollError(
        "missing_subtable",
        `Sub-table not found: ${entry.subTableId}.`,
      );
    }
    const nestedResult = await rollTable(
      subTable,
      { ...context, path: [...context.path, table.id] },
      depth + 1,
    );
    nested = nestedResult.trace;
    value = nestedResult.value;
  }

  return {
    tableId: table.id,
    tableName: table.name ?? null,
    value,
    trace: {
      tableId: table.id,
      tableName: table.name ?? null,
      depth,
      random,
      threshold,
      totalWeight,
      entryIndex: index,
      entryWeight: entry.weight,
      entryLabel: entry.label,
      entryValue: entry.value,
      subTableId: entry.subTableId,
      nested,
    },
  };
}

function selectEntry(
  entries: RandomTableEntry[],
  threshold: number,
): { entry: RandomTableEntry; index: number } {
  let cursor = 0;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry) continue;
    cursor += entry.weight;
    if (threshold < cursor) {
      return { entry, index };
    }
  }

  const lastIndex = entries.length - 1;
  const lastEntry = entries[lastIndex];
  if (!lastEntry) {
    throw new Error("Random table has no selectable entries.");
  }
  return { entry: lastEntry, index: lastIndex };
}
