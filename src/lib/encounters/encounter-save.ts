import { z } from "zod";

export const storableEncounterDifficultyOptions = [
  "easy",
  "medium",
  "hard",
  "deadly",
] as const;

export const saveEncounterInputSchema = z
  .object({
    campaignId: z.uuid(),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().nullable().optional(),
    locationId: z.uuid(),
    plotThreadId: z.uuid().nullable().optional(),
    usedInSession: z.uuid().nullable().optional(),
    difficulty: z
      .enum(storableEncounterDifficultyOptions)
      .nullable()
      .optional(),
    partyLevel: z.coerce.number().int().min(1).max(20).nullable().optional(),
    xpTotal: z.coerce.number().int().min(0).nullable().optional(),
    tacticalNotes: z.string().trim().nullable().optional(),
    participants: z
      .array(
        z
          .object({
            entityId: z.uuid(),
            count: z.coerce.number().int().min(1).max(20),
            role: z.string().trim().min(1).max(100).nullable().optional(),
            notes: z.string().trim().nullable().optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type SaveEncounterInput = z.infer<typeof saveEncounterInputSchema>;

export function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function storableEncounterDifficulty(
  value: string | null | undefined,
) {
  if (
    value === "easy" ||
    value === "medium" ||
    value === "hard" ||
    value === "deadly"
  ) {
    return value;
  }
  return null;
}
