import { z } from "zod";

import { extraField, goalsSchema, stringArray } from "./_shared";

export const factionSizeSchema = z.enum([
  "tiny",
  "small",
  "medium",
  "large",
  "massive",
]);

export const factionPropertiesSchema = z
  .object({
    alignment: z.string().optional(),
    size: factionSizeSchema.optional(),
    power_level: z.number().int().min(0).max(5).optional(),

    headquarters_id: z.uuid().optional(), // ref a location
    founded: z.string().optional(), // "Era della Scissione", "anno 432 PE"

    structure: z.string().optional(), // markdown, gerarchia interna
    methods: stringArray,

    // Goals stratificati: short/medium/long. Goal *segreti* vanno in
    // entity_secrets, NON qui — qui solo cio' che la fazione persegue
    // dichiaratamente (anche se il pubblico crede altro: vedi public_*
    // sull'entity).
    goals: goalsSchema.default({}),

    // Liste di riferimenti
    territory_ids: z.array(z.uuid()).default([]), // location controllate
    member_ids: z.array(z.uuid()).default([]), // luogotenenti / NPC chiave noti

    members_count_estimate: z.string().optional(), // "decine", "qualche centinaio"

    extra: extraField,
  })
  .strict();

export type FactionProperties = z.infer<typeof factionPropertiesSchema>;
