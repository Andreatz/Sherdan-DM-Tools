import { z } from "zod";

import {
  extraField,
  goalsSchema,
  sensoryDetailsSchema,
  stringArray,
  voiceSchema,
  weaknessSchema,
} from "./_shared";

// NPC properties — calibrato sul materiale Sherdan, definizione canonica
// in ROADMAP.md sezione "Schema esteso (v2)" / "Modifiche alle properties
// JSONB degli NPC". Aggiornare ROADMAP se si modificano i campi.
export const npcPropertiesSchema = z
  .object({
    // Anagrafica
    race: z.string().min(1),
    class: z.string().optional(),
    level: z.number().int().min(0).optional(),
    age: z.string().optional(), // "43 anni", "circa 380", "indeterminata"
    alignment: z.string().optional(),
    occupation: z.string().optional(),

    // Apparizione (multi-sensoriale, pattern Sherdan #5)
    appearance_summary: z.string().min(1),
    sensory_details: sensoryDetailsSchema.default({}),

    // Voce e modi
    voice: voiceSchema.default({ speech_patterns: [] }),
    tics: stringArray,
    mannerisms: stringArray,

    // Profilo motivazionale
    motivations: stringArray,
    goals: goalsSchema.default({}),

    // Tattico (DM-only)
    weaknesses: z.array(weaknessSchema).default([]),

    // Riferimento opzionale a una entity type=monster col blocco statistiche.
    stat_block_id: z.uuid().optional(),

    extra: extraField,
  })
  .strict();

export type NpcProperties = z.infer<typeof npcPropertiesSchema>;
