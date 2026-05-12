import { z } from "zod";

export const listLootBundlesQuerySchema = z
  .object({
    campaign_id: z.uuid(),
    encounter_id: z.uuid().optional(),
    session_id: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ListLootBundlesQuery = z.infer<typeof listLootBundlesQuerySchema>;
