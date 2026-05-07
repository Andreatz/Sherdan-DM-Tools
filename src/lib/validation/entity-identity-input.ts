import { z } from "zod";

import { boolish } from "./_shared";

const visibilityEnum = z.enum(["dm_only", "discovered", "public"]);

// Pattern Sherdan #1: una entity puo' avere N identita' (Malakor -> Dante,
// Vera forma; Noel -> Yancarlos, Lust, Xuanji Shih). UNA puo' essere
// `is_true_identity=true`. NON c'e' enforcement DB sull'unicita': la UI
// in Fase 1 garantira' che non se ne creino piu' di una. In futuro puo'
// arrivare un partial unique index `WHERE is_true_identity = true`.
//
// `mannerisms` e' JSONB array di tic/abitudini libere (testo).

export const createEntityIdentityInputSchema = z
  .object({
    entityId: z.uuid(),
    name: z.string().trim().min(1).max(200),
    isTrueIdentity: z.boolean().default(false),
    appearance: z.string().nullable().optional(),
    voice: z.string().nullable().optional(),
    mannerisms: z.array(z.string()).default([]),
    activeFromSession: z.uuid().nullable().optional(),
    activeUntilSession: z.uuid().nullable().optional(),
    visibility: visibilityEnum.default("dm_only"),
    notes: z.string().nullable().optional(),
  })
  .strict();

export type CreateEntityIdentityInput = z.infer<
  typeof createEntityIdentityInputSchema
>;

// Update: entityId NON modificabile (cambiare a quale entity appartiene
// un'identita' = cancella+ricrea).
export const updateEntityIdentityInputSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    isTrueIdentity: z.boolean().optional(),
    appearance: z.string().nullable().optional(),
    voice: z.string().nullable().optional(),
    mannerisms: z.array(z.string()).optional(),
    activeFromSession: z.uuid().nullable().optional(),
    activeUntilSession: z.uuid().nullable().optional(),
    visibility: visibilityEnum.optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

export type UpdateEntityIdentityInput = z.infer<
  typeof updateEntityIdentityInputSchema
>;

export const listEntityIdentitiesQuerySchema = z
  .object({
    entity_id: z.uuid().optional(),
    is_true_identity: boolish.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ListEntityIdentitiesQuery = z.infer<
  typeof listEntityIdentitiesQuerySchema
>;
