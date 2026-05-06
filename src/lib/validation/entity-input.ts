import { z } from "zod";

import { entityType } from "@/db/schema";

// Schema per input HTTP delle entities. SEPARATI dai properties schemas
// (npc/pc/location/...): qui si validano i campi di "alto livello"
// (name, description, type, ecc.); le `properties` JSONB type-specific
// vengono validate dal discriminator `validateEntityProperties` nel
// route handler dopo aver determinato il `type` effettivo.

const entityTypeEnum = z.enum(entityType.enumValues);
const visibilityEnum = z.enum(["dm_only", "discovered", "public"]);

// Per la creazione: campaignId + type + name sono obbligatori. properties
// di default {} (validation dell'eventuale shape passa al discriminator).
export const createEntityInputSchema = z
  .object({
    campaignId: z.uuid(),
    type: entityTypeEnum,
    name: z.string().trim().min(1).max(200),
    description: z.string().nullable().optional(),
    publicDescription: z.string().nullable().optional(),
    properties: z.record(z.string(), z.unknown()).default({}),
    tags: z.array(z.string()).default([]),
    parentId: z.uuid().nullable().optional(),
    visibility: visibilityEnum.default("dm_only"),
  })
  .strict();

export type CreateEntityInput = z.infer<typeof createEntityInputSchema>;

// Update: tutti i campi opzionali, ma se cambia `type` allora deve
// cambiare anche `properties` (le nuove devono essere valid per il nuovo
// type). La regola inversa NON e' simmetrica: si possono cambiare solo
// `properties` mantenendo lo stesso `type`. campaignId NON e' modificabile
// (spostare entita' tra campagne e' un'operazione esplicita futura).
export const updateEntityInputSchema = z
  .object({
    type: entityTypeEnum.optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().nullable().optional(),
    publicDescription: z.string().nullable().optional(),
    properties: z.record(z.string(), z.unknown()).optional(),
    tags: z.array(z.string()).optional(),
    parentId: z.uuid().nullable().optional(),
    visibility: visibilityEnum.optional(),
  })
  .strict()
  .refine(
    (data) => !(data.type !== undefined && data.properties === undefined),
    {
      message:
        "Cambiare 'type' richiede anche 'properties' aggiornate per il nuovo type.",
      path: ["properties"],
    },
  );

export type UpdateEntityInput = z.infer<typeof updateEntityInputSchema>;

// Query string per GET list. snake_case per coerenza URL.
// `tag` e' singolo per ora (filtro AND su un tag); multi-tag arrivera'
// quando servira' (probabilmente in Fase 1 quando si polacchera' la UI).
export const listEntitiesQuerySchema = z
  .object({
    campaign_id: z.uuid().optional(),
    type: entityTypeEnum.optional(),
    parent_id: z.uuid().optional(),
    tag: z.string().optional(),
    search: z.string().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    include_embedding: z.coerce.boolean().default(false),
  })
  .strict();

export type ListEntitiesQuery = z.infer<typeof listEntitiesQuerySchema>;
