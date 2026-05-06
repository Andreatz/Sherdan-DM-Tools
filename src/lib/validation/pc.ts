import { z } from "zod";

import {
  extraField,
  goalsSchema,
  sensoryDetailsSchema,
  stringArray,
  voiceSchema,
  weaknessSchema,
} from "./_shared";

// Player Character properties. Differenze chiave dagli NPC:
// - player_name: chi gioca il PG
// - personality_traits/ideals/bonds/flaws: pattern PHB 5e
// - character_sheet_url: link a foglio esterno (Roll20, Foundry, Avrae...)
// - arc_personale: l'arco narrativo del PG dentro la campagna
//   (Sherdan: ogni PG ha un arco — "ricerca della corona", "vendetta", ecc.)
export const pcPropertiesSchema = z
  .object({
    player_name: z.string().optional(),

    race: z.string().min(1),
    class: z.string().min(1),
    subclass: z.string().optional(),
    level: z.number().int().min(0),
    background: z.string().optional(),
    alignment: z.string().optional(),
    age: z.string().optional(),

    // Apparizione (riusa pattern NPC)
    appearance_summary: z.string().optional(),
    sensory_details: sensoryDetailsSchema.default({}),
    voice: voiceSchema.default({ speech_patterns: [] }),
    tics: stringArray,
    mannerisms: stringArray,

    // Backstory + arco narrativo Sherdan
    backstory: z.string().optional(),
    arc_personale: z.string().optional(),

    // Tratti PHB 5e
    personality_traits: stringArray,
    ideals: stringArray,
    bonds: stringArray,
    flaws: stringArray,

    // Profilo motivazionale (riusa NPC)
    motivations: stringArray,
    goals: goalsSchema.default({}),
    weaknesses: z.array(weaknessSchema).default([]),

    character_sheet_url: z.url().optional(),

    extra: extraField,
  })
  .strict();

export type PcProperties = z.infer<typeof pcPropertiesSchema>;
