import { z } from "zod";

import { boolish } from "./_shared";

const layerEnum = z.enum(["surface", "intermediate", "deep"]);

// Pattern Sherdan #2: segreti stratificati (surface/intermediate/deep)
// indipendenti dalla visibilita' del party. Un secret puo' appartenere a
// una entity, a un plot thread, o a entrambi (es. il segreto della
// Scissione). DB enforce: CHECK (entity_id IS NOT NULL OR plot_thread_id
// IS NOT NULL).

export const createEntitySecretInputSchema = z
  .object({
    campaignId: z.uuid(),
    entityId: z.uuid().nullable().optional(),
    plotThreadId: z.uuid().nullable().optional(),
    layer: layerEnum,
    content: z.string().min(1),
    exploitHint: z.string().nullable().optional(),
    discoveredAtSession: z.uuid().nullable().optional(),
    discoveryNotes: z.string().nullable().optional(),
  })
  .strict()
  .refine(
    (d) =>
      (d.entityId !== null && d.entityId !== undefined) ||
      (d.plotThreadId !== null && d.plotThreadId !== undefined),
    {
      message: "Almeno uno tra 'entityId' e 'plotThreadId' deve essere valorizzato.",
      path: ["entityId"],
    },
  );

export type CreateEntitySecretInput = z.infer<
  typeof createEntitySecretInputSchema
>;

// Update: campaignId NON modificabile. entityId/plotThreadId modificabili
// (puo' servire per riassegnare un secret), ma il check DB impone che
// almeno uno resti non-null. Se passi entrambi a null il DB respinge con
// constraint violation -> 500 generico (ok per ora; futuro mapping
// 23514 -> 400).
export const updateEntitySecretInputSchema = z
  .object({
    entityId: z.uuid().nullable().optional(),
    plotThreadId: z.uuid().nullable().optional(),
    layer: layerEnum.optional(),
    content: z.string().min(1).optional(),
    exploitHint: z.string().nullable().optional(),
    discoveredAtSession: z.uuid().nullable().optional(),
    discoveryNotes: z.string().nullable().optional(),
  })
  .strict();

export type UpdateEntitySecretInput = z.infer<
  typeof updateEntitySecretInputSchema
>;

export const listEntitySecretsQuerySchema = z
  .object({
    campaign_id: z.uuid().optional(),
    entity_id: z.uuid().optional(),
    plot_thread_id: z.uuid().optional(),
    layer: layerEnum.optional(),
    discovered: boolish.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ListEntitySecretsQuery = z.infer<
  typeof listEntitySecretsQuerySchema
>;
