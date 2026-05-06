import { z } from "zod";

import { extraField, stringArray } from "./_shared";

// Differenza vs Faction: una `organization` e' tipicamente non belligerante
// (gilda, ordine, scuola, casata, compagnia mercantile). Una `faction` ha
// goals attivi e una posizione nella geopolitica della campagna. La
// distinzione e' soft — quando una organization sviluppa un'agenda
// conflittuale, la si converte in faction via update di entities.type.
export const organizationKindSchema = z.enum([
  "guild",
  "order",
  "school",
  "house",
  "company",
  "cult",
  "circle",
  "council",
]);

export const organizationPropertiesSchema = z
  .object({
    kind: organizationKindSchema,
    founded: z.string().optional(),
    headquarters_id: z.uuid().optional(),

    structure: z.string().optional(), // markdown
    purpose: z.string().optional(), // markdown
    methods: stringArray,

    territory_ids: z.array(z.uuid()).default([]),
    member_ids: z.array(z.uuid()).default([]),

    members_count_estimate: z.string().optional(),
    requirements: z.string().optional(), // come si entra
    benefits: stringArray,

    extra: extraField,
  })
  .strict();

export type OrganizationProperties = z.infer<
  typeof organizationPropertiesSchema
>;
