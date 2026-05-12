import { z } from "zod";

import { clueStatus } from "@/db/schema";

const clueStatusEnum = z.enum(clueStatus.enumValues);

const relatedEntitiesSchema = z.array(z.uuid()).max(50);

export const createTruthClueInputSchema = z
  .object({
    campaignId: z.uuid(),
    description: z.string().trim().min(1),
    truthRevealed: z.string().trim().min(1),
    relatedPlotThreadId: z.uuid().nullable().optional(),
    relatedEntities: relatedEntitiesSchema.optional(),
    plantedInSession: z.uuid().nullable().optional(),
    status: clueStatusEnum.default("planted"),
    statusNotes: z.string().trim().nullable().optional(),
  })
  .strict();

export type CreateTruthClueInput = z.infer<typeof createTruthClueInputSchema>;

export const updateTruthClueInputSchema = z
  .object({
    description: z.string().trim().min(1).optional(),
    truthRevealed: z.string().trim().min(1).optional(),
    relatedPlotThreadId: z.uuid().nullable().optional(),
    relatedEntities: relatedEntitiesSchema.optional(),
    plantedInSession: z.uuid().nullable().optional(),
    status: clueStatusEnum.optional(),
    statusNotes: z.string().trim().nullable().optional(),
  })
  .strict();

export type UpdateTruthClueInput = z.infer<typeof updateTruthClueInputSchema>;

export const listTruthCluesQuerySchema = z
  .object({
    campaign_id: z.uuid(),
    status: clueStatusEnum.optional(),
    related_plot_thread_id: z.uuid().optional(),
    planted_in_session: z.uuid().optional(),
    related_entity_id: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ListTruthCluesQuery = z.infer<typeof listTruthCluesQuerySchema>;

export const truthClueDashboardQuerySchema = z
  .object({
    campaign_id: z.uuid(),
  })
  .strict();

export type TruthClueDashboardQuery = z.infer<
  typeof truthClueDashboardQuerySchema
>;

export function normalizeTruthClueText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
