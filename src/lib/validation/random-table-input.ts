import { z } from "zod";

import { randomTableEntriesSchema } from "@/lib/random-tables";

const tagsSchema = z.array(z.string().trim().min(1));

export const createRandomTableInputSchema = z
  .object({
    campaignId: z.uuid().nullable().optional(),
    name: z.string().trim().min(1).max(200),
    description: z.string().nullable().optional(),
    entries: randomTableEntriesSchema,
    tags: tagsSchema.default([]),
  })
  .strict();

export type CreateRandomTableInput = z.infer<
  typeof createRandomTableInputSchema
>;

export const updateRandomTableInputSchema = z
  .object({
    campaignId: z.uuid().nullable().optional(),
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().nullable().optional(),
    entries: randomTableEntriesSchema.optional(),
    tags: tagsSchema.optional(),
  })
  .strict();

export type UpdateRandomTableInput = z.infer<
  typeof updateRandomTableInputSchema
>;

export const listRandomTablesQuerySchema = z
  .object({
    campaign_id: z.uuid().optional(),
    tag: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
    sort: z.enum(["name_asc", "updated_desc"]).default("name_asc"),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ListRandomTablesQuery = z.infer<
  typeof listRandomTablesQuerySchema
>;

export const rollRandomTableInputSchema = z
  .object({
    maxDepth: z.number().int().min(0).max(32).optional(),
  })
  .strict();

export type RollRandomTableInput = z.infer<typeof rollRandomTableInputSchema>;
