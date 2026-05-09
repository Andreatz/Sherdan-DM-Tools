import { z } from "zod";

import { plotThreadStatus, visibility } from "@/db/schema";

const plotThreadStatusEnum = z.enum(plotThreadStatus.enumValues);
const visibilityEnum = z.enum(visibility.enumValues);

export const createPlotThreadInputSchema = z
  .object({
    campaignId: z.uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().nullable().optional(),
    publicDescription: z.string().trim().nullable().optional(),
    status: plotThreadStatusEnum.default("warm"),
    priority: z.coerce.number().int().min(0).max(100).nullable().optional(),
    visibility: visibilityEnum.default("dm_only"),
  })
  .strict();

export type CreatePlotThreadInput = z.infer<
  typeof createPlotThreadInputSchema
>;

export const updatePlotThreadInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().nullable().optional(),
    publicDescription: z.string().trim().nullable().optional(),
    status: plotThreadStatusEnum.optional(),
    priority: z.coerce.number().int().min(0).max(100).nullable().optional(),
    visibility: visibilityEnum.optional(),
  })
  .strict();

export type UpdatePlotThreadInput = z.infer<
  typeof updatePlotThreadInputSchema
>;

export const listPlotThreadsQuerySchema = z
  .object({
    campaign_id: z.uuid(),
    status: plotThreadStatusEnum.optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ListPlotThreadsQuery = z.infer<typeof listPlotThreadsQuerySchema>;

export function normalizePlotThreadText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
