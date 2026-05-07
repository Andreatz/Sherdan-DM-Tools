import { z } from "zod";

import { entityType } from "@/db/schema";

// Search globale sulle entities (Fase 1). Implementazione attuale: ILIKE
// su name + description + publicDescription. Funziona bene per i ~50 NPC
// di Sherdan. Quando il volume crescera' o servira' ranking per rilevanza,
// si aggiungeranno indici trigram (pg_trgm gia' installato) e si passera'
// a similarity() con threshold + ORDER BY similarity.

const entityTypeEnum = z.enum(entityType.enumValues);

export const searchEntitiesQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(200),
    campaign_id: z.uuid().optional(),
    type: entityTypeEnum.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type SearchEntitiesQuery = z.infer<typeof searchEntitiesQuerySchema>;
