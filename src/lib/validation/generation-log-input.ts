import { z } from "zod";

export const generationLogStatusEnum = z.enum(["succeeded", "failed"]);

export const listGenerationLogsQuerySchema = z
  .object({
    campaign_id: z.uuid().optional(),
    generator: z.string().trim().min(1).max(80).optional(),
    status: generationLogStatusEnum.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ListGenerationLogsQuery = z.infer<
  typeof listGenerationLogsQuerySchema
>;
