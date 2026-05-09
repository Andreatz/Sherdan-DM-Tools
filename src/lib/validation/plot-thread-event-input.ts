import { z } from "zod";

const eventTypeSchema = z.string().trim().min(1).max(80);

export const createPlotThreadEventInputSchema = z
  .object({
    plotThreadId: z.uuid(),
    sessionId: z.uuid().nullable().optional(),
    eventType: eventTypeSchema,
    description: z.string().trim().min(1),
    publicDescription: z.string().trim().nullable().optional(),
    occurredAt: z.coerce.date().optional(),
  })
  .strict();

export type CreatePlotThreadEventInput = z.infer<
  typeof createPlotThreadEventInputSchema
>;

export const updatePlotThreadEventInputSchema = z
  .object({
    sessionId: z.uuid().nullable().optional(),
    eventType: eventTypeSchema.optional(),
    description: z.string().trim().min(1).optional(),
    publicDescription: z.string().trim().nullable().optional(),
    occurredAt: z.coerce.date().optional(),
  })
  .strict();

export type UpdatePlotThreadEventInput = z.infer<
  typeof updatePlotThreadEventInputSchema
>;

export const listPlotThreadEventsQuerySchema = z
  .object({
    plot_thread_id: z.uuid().optional(),
    session_id: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type ListPlotThreadEventsQuery = z.infer<
  typeof listPlotThreadEventsQuerySchema
>;

export function normalizePlotThreadEventText(
  value: string | null | undefined,
) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
