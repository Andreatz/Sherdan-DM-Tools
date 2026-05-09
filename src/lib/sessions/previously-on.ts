import { z } from "zod";

import { callStructuredOutput, type GeneratorPrompt } from "@/lib/generators";
import type { GeneratorRunOptions } from "@/lib/generators";

export const previouslyOnInputSchema = z
  .object({
    sessionId: z.uuid(),
  })
  .strict();

export const previouslyOnOutputSchema = z
  .object({
    previously_on: z.string().trim().min(1).max(2400),
  })
  .strict();

export type PreviouslyOnOutput = z.infer<typeof previouslyOnOutputSchema>;

export interface PreviouslyOnSessionRecap {
  number: number;
  title: string | null;
  recap: string;
}

export function buildPreviouslyOnPrompt(
  session: PreviouslyOnSessionRecap,
): GeneratorPrompt {
  return {
    input: [
      {
        role: "system",
        content: [
          "Sei un narratore cinematografico per una campagna D&D.",
          "Devi generare un breve 'Previously on...' in italiano per i giocatori.",
          "Usa esclusivamente il recap fornito. Non inventare segreti, retcon, note DM o informazioni fuori scena.",
          "La risposta finale deve essere un JSON object valido, senza markdown esterno.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          "# Sessione precedente",
          "",
          `Numero: ${session.number}`,
          session.title ? `Titolo: ${session.title}` : null,
          "",
          "## Recap pubblico",
          session.recap,
          "",
          "## Output richiesto",
          "Scrivi 2-4 paragrafi brevi, ritmo da apertura di episodio, massimo 220 parole.",
          'Formato JSON: {"previously_on":"..."}',
        ]
          .filter((line): line is string => line !== null)
          .join("\n"),
      },
    ],
    options: {
      temperature: 0.55,
      maxTokens: 900,
      thinking: false,
    },
  };
}

export async function generatePreviouslyOn(
  session: PreviouslyOnSessionRecap,
  options: GeneratorRunOptions = {},
): Promise<PreviouslyOnOutput> {
  return callStructuredOutput(
    buildPreviouslyOnPrompt(session),
    previouslyOnOutputSchema,
    options,
  );
}
