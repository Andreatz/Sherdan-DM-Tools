import { z } from "zod";

export const globalSearchQuerySchema = z
  .object({
    q: z.string().trim().max(200).default(""),
    campaign_id: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(12).default(6),
  })
  .strict();

export type GlobalSearchQuery = z.infer<typeof globalSearchQuerySchema>;
