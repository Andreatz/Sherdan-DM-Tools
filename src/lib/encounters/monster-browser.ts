import { z } from "zod";

import {
  monsterPropertiesSchema,
  type MonsterProperties,
} from "@/lib/validation/monster";

const monsterSizeOptions = [
  "tiny",
  "small",
  "medium",
  "large",
  "huge",
  "gargantuan",
] as const;

export const listMonstersQuerySchema = z
  .object({
    campaign_id: z.uuid(),
    search: z.string().trim().min(1).optional(),
    cr_min: z.coerce.number().min(0).max(33).optional(),
    cr_max: z.coerce.number().min(0).max(33).optional(),
    creature_type: z.string().trim().min(1).optional(),
    environment: z.string().trim().min(1).optional(),
    size: z.enum(monsterSizeOptions).optional(),
    limit: z.coerce.number().int().min(1).max(500).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict()
  .refine(
    (query) =>
      query.cr_min === undefined ||
      query.cr_max === undefined ||
      query.cr_min <= query.cr_max,
    {
      message: "cr_min deve essere minore o uguale a cr_max",
      path: ["cr_min"],
    },
  );

export type ListMonstersQuery = z.infer<typeof listMonstersQuerySchema>;

export interface MonsterBrowserRecord {
  id: string;
  name: string;
  description: string | null;
  publicDescription: string | null;
  tags: string[];
  properties: MonsterProperties;
  updatedAt: Date;
}

export interface MonsterBrowserFacets {
  creatureTypes: string[];
  environments: string[];
  sizes: string[];
  crRange: {
    min: number | null;
    max: number | null;
  };
}

export function parseMonsterRecord(input: {
  id: string;
  name: string;
  description: string | null;
  publicDescription: string | null;
  properties: unknown;
  tags: string[];
  updatedAt: Date;
}): MonsterBrowserRecord | null {
  const result = monsterPropertiesSchema.safeParse(input.properties);
  if (!result.success) return null;

  return {
    ...input,
    properties: result.data,
  };
}

export function filterMonsterRecords(
  records: MonsterBrowserRecord[],
  query: Pick<
    ListMonstersQuery,
    "cr_min" | "cr_max" | "creature_type" | "environment" | "size"
  >,
): MonsterBrowserRecord[] {
  return records.filter((record) => {
    const cr = challengeRatingToNumber(record.properties.challenge_rating);
    if (query.cr_min !== undefined && cr < query.cr_min) return false;
    if (query.cr_max !== undefined && cr > query.cr_max) return false;
    if (
      query.creature_type &&
      record.properties.creature_type !== query.creature_type
    ) {
      return false;
    }
    if (query.size && record.properties.size !== query.size) return false;
    if (
      query.environment &&
      !record.properties.environment
        .map((entry) => entry.toLowerCase())
        .includes(query.environment.toLowerCase())
    ) {
      return false;
    }
    return true;
  });
}

export function buildMonsterFacets(
  records: MonsterBrowserRecord[],
): MonsterBrowserFacets {
  const crValues = records.map((record) =>
    challengeRatingToNumber(record.properties.challenge_rating),
  );

  return {
    creatureTypes: uniqueSorted(
      records.map((record) => record.properties.creature_type),
    ),
    environments: uniqueSorted(
      records.flatMap((record) => record.properties.environment),
    ),
    sizes: uniqueSorted(records.map((record) => record.properties.size)),
    crRange: {
      min: crValues.length > 0 ? Math.min(...crValues) : null,
      max: crValues.length > 0 ? Math.max(...crValues) : null,
    },
  };
}

export function paginateMonsterRecords(
  records: MonsterBrowserRecord[],
  query: Pick<ListMonstersQuery, "limit" | "offset">,
): MonsterBrowserRecord[] {
  return records.slice(query.offset, query.offset + query.limit);
}

export function challengeRatingToNumber(value: string): number {
  if (value === "1/8") return 0.125;
  if (value === "1/4") return 0.25;
  if (value === "1/2") return 0.5;
  return Number.parseInt(value, 10);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}
