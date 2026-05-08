import { z } from "zod";

export const lootSourcePresetOptions = [
  "bandit",
  "dragon",
  "merchant",
  "cult",
  "vinculator",
  "noble",
  "pirate",
  "undead",
  "beast",
  "construct",
  "dungeon",
  "quest_reward",
] as const;

export const lootNarrativeDensityOptions = ["sobrio", "ricco"] as const;

export const lootGeneratorInputSchema = z
  .object({
    campaignId: z.uuid(),
    source: z.string().trim().min(2).max(80),
    anchorEntityId: z
      .preprocess(
        (value) => (value === "" || value === null ? undefined : value),
        z.uuid().optional(),
      )
      .optional(),
    partyLevel: z.coerce.number().int().min(1).max(20),
    narrativeDensity: z.enum(lootNarrativeDensityOptions),
  })
  .strict();

export type LootGeneratorInput = z.infer<typeof lootGeneratorInputSchema>;
export type LootNarrativeDensity =
  (typeof lootNarrativeDensityOptions)[number];
export type LootSourcePreset = (typeof lootSourcePresetOptions)[number];
