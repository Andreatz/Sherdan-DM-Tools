import { z } from "zod";

export const npcGeneratorTypeOptions = [
  "taverniere",
  "guardia",
  "mercante",
  "nobile",
  "capitano",
  "infiltrato",
  "cultista",
  "artigiano",
  "informatore",
  "rivale",
] as const;

export const npcGeneratorToneOptions = [
  "serio",
  "comico",
  "cupo",
  "grimdark",
] as const;

export const npcNarrativeDepthOptions = [
  "comparsa",
  "secondario",
  "principale",
] as const;

export const npcGeneratorInputSchema = z
  .object({
    campaignId: z.uuid(),
    locationId: z.uuid(),
    styleEntityId: z
      .preprocess(
        (value) => (value === "" || value === null ? undefined : value),
        z.uuid().optional(),
      )
      .optional(),
    npcType: z.string().trim().min(2).max(80),
    partyLevel: z.coerce.number().int().min(1).max(20),
    tone: z.enum(npcGeneratorToneOptions),
    narrativeDepth: z.enum(npcNarrativeDepthOptions),
  })
  .strict();

export type NpcGeneratorInput = z.infer<typeof npcGeneratorInputSchema>;
export type NpcGeneratorTone = (typeof npcGeneratorToneOptions)[number];
export type NpcNarrativeDepth = (typeof npcNarrativeDepthOptions)[number];
