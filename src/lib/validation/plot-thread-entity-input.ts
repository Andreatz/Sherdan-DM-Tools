import { z } from "zod";

import { plotRole } from "@/db/schema";

const plotRoleEnum = z.enum(plotRole.enumValues);

export const createPlotThreadEntityInputSchema = z
  .object({
    plotThreadId: z.uuid(),
    entityId: z.uuid(),
    role: plotRoleEnum,
    notes: z.string().trim().nullable().optional(),
  })
  .strict();

export type CreatePlotThreadEntityInput = z.infer<
  typeof createPlotThreadEntityInputSchema
>;

export const updatePlotThreadEntityInputSchema = z
  .object({
    role: plotRoleEnum.optional(),
    notes: z.string().trim().nullable().optional(),
  })
  .strict();

export type UpdatePlotThreadEntityInput = z.infer<
  typeof updatePlotThreadEntityInputSchema
>;

export const listPlotThreadEntitiesQuerySchema = z
  .object({
    plot_thread_id: z.uuid().optional(),
    entity_id: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ListPlotThreadEntitiesQuery = z.infer<
  typeof listPlotThreadEntitiesQuerySchema
>;

export function normalizePlotThreadEntityNotes(
  value: string | null | undefined,
) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
