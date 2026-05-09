import { z } from "zod";

import {
  monsterPropertiesSchema,
  type MonsterProperties,
} from "@/lib/validation/monster";

const OPEN5E_DEFAULT_BASE_URL = "https://api.open5e.com/v2";
export const OPEN5E_DEFAULT_SRD_DOCUMENT = "srd-2014";

const open5eNamedObjectSchema = z
  .object({
    name: z.string().optional(),
    key: z.string().optional(),
  })
  .passthrough();

const open5eFeatureSchema = z
  .object({
    name: z.string().optional(),
    desc: z.string().optional(),
    action_type: z.string().optional(),
    order_in_statblock: z.number().nullable().optional(),
    legendary_action_cost: z.number().nullable().optional(),
    usage_limits: z.unknown().nullable().optional(),
  })
  .passthrough();

export const open5eCreatureSchema = z
  .object({
    key: z.string().min(1),
    name: z.string().min(1),
    document: open5eNamedObjectSchema.optional(),
    type: open5eNamedObjectSchema,
    size: open5eNamedObjectSchema,
    challenge_rating: z.number(),
    proficiency_bonus: z.number().nullable().optional(),
    speed: z.record(z.string(), z.unknown()).optional(),
    speed_all: z.record(z.string(), z.unknown()).optional(),
    category: z.string().nullable().optional(),
    subcategory: z.string().nullable().optional(),
    alignment: z.string().nullable().optional(),
    languages: z
      .object({
        as_string: z.string().optional(),
      })
      .passthrough()
      .optional(),
    armor_class: z.number(),
    armor_detail: z.string().nullable().optional(),
    hit_points: z.number(),
    hit_dice: z.string().nullable().optional(),
    experience_points: z.number().nullable().optional(),
    ability_scores: z.object({
      strength: z.number(),
      dexterity: z.number(),
      constitution: z.number(),
      intelligence: z.number(),
      wisdom: z.number(),
      charisma: z.number(),
    }),
    saving_throws: z.record(z.string(), z.number()).optional(),
    skill_bonuses: z.record(z.string(), z.number()).optional(),
    passive_perception: z.number().nullable().optional(),
    resistances_and_immunities: z
      .object({
        damage_immunities: z.array(z.unknown()).default([]),
        damage_resistances: z.array(z.unknown()).default([]),
        damage_vulnerabilities: z.array(z.unknown()).default([]),
        condition_immunities: z.array(z.unknown()).default([]),
      })
      .passthrough()
      .optional(),
    darkvision_range: z.number().nullable().optional(),
    blindsight_range: z.number().nullable().optional(),
    tremorsense_range: z.number().nullable().optional(),
    truesight_range: z.number().nullable().optional(),
    actions: z.array(open5eFeatureSchema).default([]),
    traits: z.array(open5eFeatureSchema).default([]),
    environments: z.array(z.unknown()).default([]),
    illustration: z.unknown().nullable().optional(),
  })
  .passthrough();

export const open5eCreaturePageSchema = z
  .object({
    count: z.number().int().nonnegative(),
    next: z.string().nullable(),
    previous: z.string().nullable(),
    results: z.array(open5eCreatureSchema),
  })
  .strict();

export type Open5eCreature = z.infer<typeof open5eCreatureSchema>;
export type Open5eCreaturePage = z.infer<typeof open5eCreaturePageSchema>;

export interface Open5eCreatureEntityDraft {
  name: string;
  description: string;
  publicDescription: string;
  properties: MonsterProperties;
  tags: string[];
}

export interface Open5eFetchOptions {
  baseUrl?: string;
  documentKey?: string;
  limit?: number;
  pageSize?: number;
  fetchImpl?: typeof fetch;
}

export async function fetchOpen5eCreatures(
  options: Open5eFetchOptions = {},
): Promise<Open5eCreature[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const creatures: Open5eCreature[] = [];
  let nextUrl: string | null = buildOpen5eCreaturesUrl(options);

  while (nextUrl) {
    const res = await fetchImpl(nextUrl);
    if (!res.ok) {
      throw new Error(`Open5e request failed: HTTP ${res.status}`);
    }

    const page = open5eCreaturePageSchema.parse(await res.json());
    for (const creature of page.results) {
      creatures.push(creature);
      if (options.limit && creatures.length >= options.limit) {
        return creatures;
      }
    }

    nextUrl = page.next;
    if (page.results.length === 0) break;
  }

  return creatures;
}

export function buildOpen5eCreaturesUrl(
  options: Pick<Open5eFetchOptions, "baseUrl" | "documentKey" | "pageSize"> = {},
): string {
  const baseUrl = options.baseUrl ?? OPEN5E_DEFAULT_BASE_URL;
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/creatures/`);
  url.searchParams.set(
    "document__key__in",
    options.documentKey ?? OPEN5E_DEFAULT_SRD_DOCUMENT,
  );
  url.searchParams.set("ordering", "name");
  url.searchParams.set("limit", String(options.pageSize ?? 100));
  return url.toString();
}

export function open5eCreatureToEntityDraft(
  creature: Open5eCreature,
): Open5eCreatureEntityDraft {
  const properties = monsterPropertiesSchema.parse({
    size: lowerKey(creature.size),
    creature_type: lowerKey(creature.type),
    subtype: cleanOptional(creature.subcategory),
    alignment: cleanOptional(creature.alignment),
    ac: Math.trunc(creature.armor_class),
    ac_note: cleanOptional(creature.armor_detail),
    hp_average: Math.max(1, Math.trunc(creature.hit_points)),
    hp_formula: cleanOptional(creature.hit_dice),
    speed: normalizeSpeed(creature.speed_all ?? creature.speed),
    abilities: {
      str: Math.trunc(creature.ability_scores.strength),
      dex: Math.trunc(creature.ability_scores.dexterity),
      con: Math.trunc(creature.ability_scores.constitution),
      int: Math.trunc(creature.ability_scores.intelligence),
      wis: Math.trunc(creature.ability_scores.wisdom),
      cha: Math.trunc(creature.ability_scores.charisma),
    },
    saving_throws: normalizeNumberRecord(creature.saving_throws),
    skills: normalizeNumberRecord(creature.skill_bonuses),
    damage_resistances: normalizeNamedArray(
      creature.resistances_and_immunities?.damage_resistances,
    ),
    damage_immunities: normalizeNamedArray(
      creature.resistances_and_immunities?.damage_immunities,
    ),
    damage_vulnerabilities: normalizeNamedArray(
      creature.resistances_and_immunities?.damage_vulnerabilities,
    ),
    condition_immunities: normalizeNamedArray(
      creature.resistances_and_immunities?.condition_immunities,
    ),
    senses: normalizeSenses(creature),
    languages: normalizeCommaList(creature.languages?.as_string),
    challenge_rating: normalizeChallengeRating(creature.challenge_rating),
    xp:
      creature.experience_points === null ||
      creature.experience_points === undefined
        ? undefined
        : Math.trunc(creature.experience_points),
    proficiency_bonus:
      creature.proficiency_bonus === null ||
      creature.proficiency_bonus === undefined
        ? undefined
        : Math.trunc(creature.proficiency_bonus),
    traits: normalizeFeatures(creature.traits),
    actions: normalizeFeaturesByType(creature.actions, "ACTION"),
    bonus_actions: normalizeFeaturesByType(creature.actions, "BONUS_ACTION"),
    reactions: normalizeFeaturesByType(creature.actions, "REACTION"),
    legendary_actions: normalizeFeaturesByType(
      creature.actions,
      "LEGENDARY_ACTION",
    ),
    lair_actions: normalizeFeaturesByType(creature.actions, "LAIR_ACTION"),
    environment: normalizeNamedArray(creature.environments),
    source: `open5e:${creature.document?.key ?? OPEN5E_DEFAULT_SRD_DOCUMENT}`,
    extra: {
      open5e: {
        key: creature.key,
        document_key: creature.document?.key ?? null,
        document_name: creature.document?.name ?? null,
        category: creature.category ?? null,
        raw_type: creature.type,
        raw_size: creature.size,
        illustration: creature.illustration ?? null,
      },
    },
  });

  return {
    name: creature.name,
    description: buildMonsterDescription(creature, properties),
    publicDescription: `${creature.name}, ${properties.size} ${properties.creature_type}, CR ${properties.challenge_rating}.`,
    properties,
    tags: [
      "monster",
      "srd",
      "open5e",
      `open5e:${creature.key}`,
      `source:${creature.document?.key ?? OPEN5E_DEFAULT_SRD_DOCUMENT}`,
      `cr:${properties.challenge_rating}`,
      `type:${properties.creature_type}`,
      `size:${properties.size}`,
      ...properties.environment.map((entry) => `environment:${slugify(entry)}`),
    ],
  };
}

function buildMonsterDescription(
  creature: Open5eCreature,
  properties: MonsterProperties,
): string {
  const lines = [
    `**${creature.name}**`,
    `${capitalize(properties.size)} ${properties.creature_type}${properties.subtype ? ` (${properties.subtype})` : ""}${properties.alignment ? `, ${properties.alignment}` : ""}`,
    `AC ${properties.ac}${properties.ac_note ? ` (${properties.ac_note})` : ""} - HP ${properties.hp_average}${properties.hp_formula ? ` (${properties.hp_formula})` : ""} - CR ${properties.challenge_rating}${properties.xp ? ` (${properties.xp} XP)` : ""}`,
  ];

  if (properties.traits.length > 0) {
    lines.push("", "### Traits");
    for (const trait of properties.traits) {
      lines.push(`- **${trait.name}.** ${trait.description}`);
    }
  }

  if (properties.actions.length > 0) {
    lines.push("", "### Actions");
    for (const action of properties.actions) {
      lines.push(`- **${action.name}.** ${action.description}`);
    }
  }

  if (properties.legendary_actions.length > 0) {
    lines.push("", "### Legendary Actions");
    for (const action of properties.legendary_actions) {
      lines.push(`- **${action.name}.** ${action.description}`);
    }
  }

  return lines.join("\n");
}

function normalizeChallengeRating(value: number): string {
  if (value === 0.125) return "1/8";
  if (value === 0.25) return "1/4";
  if (value === 0.5) return "1/2";
  return String(Math.trunc(value));
}

function normalizeSpeed(value: Record<string, unknown> | undefined) {
  const speed = {
    walk: positiveNumber(value?.walk),
    fly: positiveNumber(value?.fly),
    swim: positiveNumber(value?.swim),
    climb: positiveNumber(value?.climb),
    burrow: positiveNumber(value?.burrow),
    hover: value?.hover === true ? true : undefined,
  };

  return Object.fromEntries(
    Object.entries(speed).filter(([, entry]) => entry !== undefined),
  );
}

function normalizeSenses(creature: Open5eCreature): string[] {
  const senses = [
    rangeSense("darkvision", creature.darkvision_range),
    rangeSense("blindsight", creature.blindsight_range),
    rangeSense("tremorsense", creature.tremorsense_range),
    rangeSense("truesight", creature.truesight_range),
    creature.passive_perception
      ? `passive Perception ${Math.trunc(creature.passive_perception)}`
      : null,
  ];
  return senses.filter((entry): entry is string => entry !== null);
}

function normalizeFeatures(features: z.infer<typeof open5eFeatureSchema>[]) {
  return features
    .slice()
    .sort((a, b) => (a.order_in_statblock ?? 0) - (b.order_in_statblock ?? 0))
    .map((feature) => ({
      name: cleanOptional(feature.name) ?? "Unnamed feature",
      description:
        cleanOptional(feature.desc) ?? cleanOptional(feature.name) ?? "-",
      usage: featureUsage(feature),
    }));
}

function normalizeFeaturesByType(
  features: z.infer<typeof open5eFeatureSchema>[],
  type: string,
) {
  return normalizeFeatures(
    features.filter((feature) => feature.action_type === type),
  );
}

function featureUsage(feature: z.infer<typeof open5eFeatureSchema>) {
  const parts = [];
  if (
    feature.legendary_action_cost !== null &&
    feature.legendary_action_cost !== undefined
  ) {
    parts.push(`cost ${feature.legendary_action_cost}`);
  }
  const usage = usageLimitsToString(feature.usage_limits);
  if (usage) parts.push(usage);
  return parts.length > 0 ? parts.join("; ") : undefined;
}

function usageLimitsToString(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value !== "object") return String(value);

  const record = value as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : null;
  const param =
    typeof record.param === "string" || typeof record.param === "number"
      ? String(record.param)
      : null;

  if (type && param) return `${type}:${param}`;
  if (type) return type;
  return JSON.stringify(value);
}

function normalizeNumberRecord(
  value: Record<string, number> | undefined,
): Record<string, number> | undefined {
  if (!value || Object.keys(value).length === 0) return undefined;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, Math.trunc(entry)]),
  );
}

function normalizeNamedArray(value: unknown[] | undefined): string[] {
  if (!value) return [];
  return value.map(valueToLabel).filter((entry): entry is string => entry !== null);
}

function normalizeCommaList(value: string | undefined): string[] {
  if (!value || value === "-" || value.toLowerCase() === "none") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function valueToLabel(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.name === "string") return record.name;
  if (typeof record.key === "string") return record.key;
  return null;
}

function rangeSense(
  label: string,
  value: number | null | undefined,
): string | null {
  if (!value || value <= 0) return null;
  return `${label} ${Math.trunc(value)} ft.`;
}

function positiveNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || value <= 0) return undefined;
  return Math.trunc(value);
}

function lowerKey(value: z.infer<typeof open5eNamedObjectSchema>): string {
  return (value.key ?? value.name ?? "").trim().toLowerCase();
}

function cleanOptional(value: string | null | undefined): string | undefined {
  const clean = value?.trim();
  return clean ? clean : undefined;
}

function capitalize(value: string): string {
  return value.length > 0
    ? `${value[0]?.toUpperCase()}${value.slice(1)}`
    : value;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
