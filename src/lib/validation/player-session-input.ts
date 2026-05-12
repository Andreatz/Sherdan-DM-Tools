import { z } from "zod";

export const listPlayerSessionRecapsQuerySchema = z
  .object({
    // Opzionale: in modalita' per-player il campaign_id arriva dal cookie
    // tramite `assertCampaignScope`. In modalita' legacy resta richiesto.
    campaign_id: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(20).default(5),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ListPlayerSessionRecapsQuery = z.infer<
  typeof listPlayerSessionRecapsQuerySchema
>;
