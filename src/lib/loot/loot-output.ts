import { z } from "zod";

import {
  itemKindSchema,
  itemPropertiesSchema,
  itemRaritySchema,
  type ItemProperties,
} from "@/lib/validation/item";

import type { DmgBaseGoldResult } from "./dmg-gold";
import type { LootGeneratorContext } from "./loot-context";
import type { LootGeneratorInput } from "./loot-input";

const requiredText = z.string().trim().min(1);
const generatedStringArray = z.array(requiredText).default([]);

export const dmgBaseGoldResultSchema = z
  .object({
    tier: z.enum(["0-4", "5-10", "11-16", "17+"]),
    mode: z.enum(["individual", "hoard"]),
    quantity: z.number().int().min(1),
    gpPerUnit: z.number().nonnegative(),
    totalGp: z.number().nonnegative(),
    averageCoinsPerUnit: z
      .object({
        cp: z.number().nonnegative().optional(),
        sp: z.number().nonnegative().optional(),
        ep: z.number().nonnegative().optional(),
        gp: z.number().nonnegative().optional(),
        pp: z.number().nonnegative().optional(),
      })
      .strict(),
  })
  .strict();

export const lootLoreReferenceSchema = z
  .object({
    entity_id: z.uuid().optional(),
    entity_name: requiredText,
    reason: requiredText,
    source_section: requiredText.optional(),
  })
  .strict();

export const lootGeneratorItemSchema = z
  .object({
    name: requiredText.max(160),
    kind: itemKindSchema,
    rarity: itemRaritySchema.default("common"),
    quantity: z.coerce.number().int().min(1).max(99).default(1),
    value_gp: z.coerce.number().nonnegative().optional(),
    attunement: z.boolean().default(false),
    description: requiredText,
    public_description: requiredText.optional(),
    effects: generatedStringArray,
    mechanics: z.unknown().optional(),
    origin: requiredText.optional(),
    tags: generatedStringArray,
    lore_references: z.array(lootLoreReferenceSchema).default([]),
    extra: z.object({}).catchall(z.unknown()).default({}),
  })
  .strict();

export const lootGeneratorLLMOutputSchema = z
  .object({
    narrative_summary: requiredText,
    gm_notes: requiredText.optional(),
    hooks: generatedStringArray,
    items: z.array(lootGeneratorItemSchema).min(1).max(8),
  })
  .strict();

export const lootGeneratorOutputMetadataSchema = z
  .object({
    campaignId: z.uuid(),
    source: requiredText,
    anchorEntityId: z.uuid().nullable(),
    partyLevel: z.number().int().min(1).max(20),
    narrativeDensity: z.enum(["sobrio", "ricco"]),
    contextEntitiesUsed: z.number().int().min(0),
  })
  .strict();

export const lootGeneratorOutputSchema = z
  .object({
    baseGold: dmgBaseGoldResultSchema,
    narrativeSummary: requiredText,
    gmNotes: requiredText.nullable(),
    hooks: generatedStringArray,
    items: z.array(lootGeneratorItemSchema).min(1).max(8),
    totalEstimatedValueGp: z.number().nonnegative(),
    metadata: lootGeneratorOutputMetadataSchema,
  })
  .strict();

export type LootLoreReference = z.infer<typeof lootLoreReferenceSchema>;
export type LootGeneratorItem = z.infer<typeof lootGeneratorItemSchema>;
export type LootGeneratorLLMOutput = z.infer<
  typeof lootGeneratorLLMOutputSchema
>;

export interface LootGeneratorOutputMetadata {
  campaignId: string;
  source: string;
  anchorEntityId: string | null;
  partyLevel: number;
  narrativeDensity: LootGeneratorInput["narrativeDensity"];
  contextEntitiesUsed: number;
}

export interface LootGeneratorOutput {
  baseGold: DmgBaseGoldResult;
  narrativeSummary: string;
  gmNotes: string | null;
  hooks: string[];
  items: LootGeneratorItem[];
  totalEstimatedValueGp: number;
  metadata: LootGeneratorOutputMetadata;
}

export function composeLootGeneratorOutput(
  input: LootGeneratorInput,
  context: LootGeneratorContext,
  baseGold: DmgBaseGoldResult,
  llmOutput: LootGeneratorLLMOutput,
): LootGeneratorOutput {
  const itemValue = llmOutput.items.reduce(
    (sum, item) => sum + (item.value_gp ?? 0) * item.quantity,
    0,
  );

  return {
    baseGold,
    narrativeSummary: llmOutput.narrative_summary,
    gmNotes: llmOutput.gm_notes ?? null,
    hooks: llmOutput.hooks,
    items: llmOutput.items,
    totalEstimatedValueGp: roundGold(baseGold.totalGp + itemValue),
    metadata: {
      campaignId: input.campaignId,
      source: input.source,
      anchorEntityId: input.anchorEntityId ?? null,
      partyLevel: input.partyLevel,
      narrativeDensity: input.narrativeDensity,
      contextEntitiesUsed: context.relatedEntities.length + (context.anchor ? 1 : 0),
    },
  };
}

export function lootItemToItemProperties(
  item: LootGeneratorItem,
): ItemProperties {
  return itemPropertiesSchema.parse({
    kind: item.kind,
    rarity: item.rarity,
    attunement: item.attunement,
    value_gp: item.value_gp,
    effects: item.effects,
    mechanics: item.mechanics,
    origin: item.origin,
    extra: {
      ...item.extra,
      quantity: item.quantity,
      public_description: item.public_description,
      lore_references: item.lore_references,
      generated_by: "loot-generator",
    },
  });
}

function roundGold(value: number): number {
  return Math.round(value * 100) / 100;
}
