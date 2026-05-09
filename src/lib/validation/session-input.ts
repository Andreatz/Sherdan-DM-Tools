import { z } from "zod";

import { boolish } from "./_shared";

const optionalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date deve usare formato YYYY-MM-DD")
  .nullable()
  .optional();

export const createSessionInputSchema = z
  .object({
    campaignId: z.uuid(),
    title: z.string().trim().min(1).max(200).nullable().optional(),
    date: optionalDateSchema,
    recap: z.string().trim().nullable().optional(),
    dmNotes: z.string().trim().nullable().optional(),
    prepNotes: z.string().trim().nullable().optional(),
  })
  .strict();

export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;

export const updateSessionInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200).nullable().optional(),
    date: optionalDateSchema,
    recap: z.string().trim().nullable().optional(),
    dmNotes: z.string().trim().nullable().optional(),
    prepNotes: z.string().trim().nullable().optional(),
  })
  .strict();

export type UpdateSessionInput = z.infer<typeof updateSessionInputSchema>;

export const listSessionsQuerySchema = z
  .object({
    campaign_id: z.uuid(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
    offset: z.coerce.number().int().min(0).default(0),
    include_notes: boolish.optional().default(false),
  })
  .strict();

export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;

export function normalizeSessionText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
