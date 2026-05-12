import { z } from "zod";

import { sessionPrepOutputSchema, type SessionPrepOutput } from "./schemas";

// Schema dell'input "accetta selettivamente i pezzi dell'output". Il DM
// puo' includere/escludere ogni proposta indicandone l'indice nell'array
// di output. `previouslyOn` e `notes` sono booleani globali (text-only,
// non c'e' niente da "creare in DB").
export const sessionPrepAcceptSchema = z
  .object({
    campaignId: z.uuid(),
    sessionId: z.uuid(),
    output: sessionPrepOutputSchema,
    vibe: z.string().trim().max(200).optional(),
    focus: z.string().trim().max(500).optional(),
    selected: z
      .object({
        previouslyOn: z.boolean().default(true),
        notes: z.boolean().default(true),
        hooks: z.array(z.number().int().min(0)).default([]),
        npcSeeds: z.array(z.number().int().min(0)).default([]),
        encounterSeeds: z.array(z.number().int().min(0)).default([]),
        suggestedClues: z.array(z.number().int().min(0)).default([]),
      })
      .strict(),
  })
  .strict();

export type SessionPrepAcceptInput = z.infer<typeof sessionPrepAcceptSchema>;

// Filtra l'output ai soli pezzi accettati. Gli indici fuori range
// vengono ignorati silenziosamente (no throw): semantica "best effort"
// utile se l'UI e il server hanno una piccola desync sui contenuti.
export function selectAcceptedPieces(
  output: SessionPrepOutput,
  selected: SessionPrepAcceptInput["selected"],
): SessionPrepOutput {
  return {
    previouslyOn: selected.previouslyOn ? output.previouslyOn : "",
    hooks: selected.hooks
      .filter((i) => i >= 0 && i < output.hooks.length)
      .map((i) => output.hooks[i]!)
      .filter(Boolean),
    npcSeeds: selected.npcSeeds
      .filter((i) => i >= 0 && i < output.npcSeeds.length)
      .map((i) => output.npcSeeds[i]!)
      .filter(Boolean),
    encounterSeeds: selected.encounterSeeds
      .filter((i) => i >= 0 && i < output.encounterSeeds.length)
      .map((i) => output.encounterSeeds[i]!)
      .filter(Boolean),
    suggestedClues: selected.suggestedClues
      .filter((i) => i >= 0 && i < output.suggestedClues.length)
      .map((i) => output.suggestedClues[i]!)
      .filter(Boolean),
    notes: selected.notes ? output.notes : [],
  };
}
