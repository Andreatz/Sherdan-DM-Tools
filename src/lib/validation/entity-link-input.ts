import { z } from "zod";

const visibilityEnum = z.enum(["dm_only", "discovered", "public"]);

// `relationType` e' open vocab per design (ally, enemy, knows,
// lieutenant_of, parent_of, child_of, mentor_of, betrayed_by, ecc.).
// Il limite a 100 chars e' contro typo / payload spazzatura, non
// semantico.
const relationTypeSchema = z.string().trim().min(1).max(100);

export const createEntityLinkInputSchema = z
  .object({
    campaignId: z.uuid(),
    sourceEntityId: z.uuid(),
    targetEntityId: z.uuid(),
    relationType: relationTypeSchema,
    // Pattern Sherdan #3: la "relazione percepita" puo' divergere dalla
    // verita' (es. ally pubblico ma puppet reale). Optional: di default
    // pubblico = privato.
    publicRelationType: relationTypeSchema.nullable().optional(),
    strength: z.number().int().min(0).max(10).nullable().optional(),
    description: z.string().nullable().optional(),
    visibility: visibilityEnum.default("dm_only"),
  })
  .strict();

export type CreateEntityLinkInput = z.infer<
  typeof createEntityLinkInputSchema
>;

// Update non modifica campaignId/source/target: cambierebbe la semantica
// del link. Per spostare un link cancella e ricrea.
export const updateEntityLinkInputSchema = z
  .object({
    relationType: relationTypeSchema.optional(),
    publicRelationType: relationTypeSchema.nullable().optional(),
    strength: z.number().int().min(0).max(10).nullable().optional(),
    description: z.string().nullable().optional(),
    visibility: visibilityEnum.optional(),
  })
  .strict();

export type UpdateEntityLinkInput = z.infer<
  typeof updateEntityLinkInputSchema
>;

// Query GET list. `involves_entity_id` matcha source OR target — pattern
// utile per "tutto cio' che tocca questa entity". Mutuamente esclusivo
// con i filtri puntuali source/target (validato a runtime nel handler).
export const listEntityLinksQuerySchema = z
  .object({
    campaign_id: z.uuid().optional(),
    source_entity_id: z.uuid().optional(),
    target_entity_id: z.uuid().optional(),
    involves_entity_id: z.uuid().optional(),
    relation_type: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ListEntityLinksQuery = z.infer<
  typeof listEntityLinksQuerySchema
>;
