import { z } from "zod";

import { entityType } from "@/db/schema";

const entityTypeEnum = z.enum(entityType.enumValues);

export const listPlayerEntitiesQuerySchema = z
  .object({
    campaign_id: z.uuid(),
    type: entityTypeEnum.optional(),
    parent_id: z.uuid().optional(),
    search: z.string().trim().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    sort: z.enum(["name_asc", "updated_desc"]).default("name_asc"),
  })
  .strict();

export type ListPlayerEntitiesQuery = z.infer<typeof listPlayerEntitiesQuerySchema>;
