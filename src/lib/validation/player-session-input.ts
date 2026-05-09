import { z } from "zod";

export const listPlayerSessionRecapsQuerySchema = z
  .object({
    campaign_id: z.uuid(),
    limit: z.coerce.number().int().min(1).max(20).default(5),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ListPlayerSessionRecapsQuery = z.infer<
  typeof listPlayerSessionRecapsQuerySchema
>;
