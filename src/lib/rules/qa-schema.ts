import { z } from "zod";

import { rulesSearchInputSchema } from "./search-input";

// Input dell'endpoint /api/rules/qa. Estende l'input search con i
// parametri Q&A. Default sensati per V1: top 6 chunk al modello, 0
// citazioni minime (vincolo soft nel prompt).
export const rulesQaInputSchema = rulesSearchInputSchema
  .extend({
    // Quanti chunk passare al modello come contesto. 6 e' un buon
    // compromesso: copre il caso multi-sezione (es. "regole + esempio")
    // senza esplodere il prompt.
    contextLimit: z.number().int().min(1).max(15).default(6),
  })
  .strict();
export type RulesQaInput = z.infer<typeof rulesQaInputSchema>;

// Output strutturato che il modello deve restituire. `answer` markdown
// con riferimenti tipo `[1]`, `[2]` ai chunk usati; `citations` lega
// l'indice al chunk reale (id + snippet).
export const rulesQaLLMOutputSchema = z
  .object({
    answer: z.string().trim().min(1).max(4000),
    citations: z
      .array(
        z
          .object({
            // Indice 1-based che appare nel testo `[N]`. Coerente con il
            // numero di citazione mostrato in UI.
            index: z.number().int().min(1).max(15),
            // ID del chunk citato. Deve essere uno degli id passati nel
            // contesto. Il composer fa validazione loud.
            chunkId: z.string().min(1),
            // Estratto rilevante (<= 280 char). Il modello lo cita,
            // l'UI lo mostra accanto al numero.
            snippet: z.string().trim().min(1).max(400),
          })
          .strict(),
      )
      .default([]),
    // Se il modello non trova risposta nel corpus, dichiara `null` in
    // `answer` e lascia citations vuote. Usiamo invece un campo
    // separato per evitare di confondere "no answer" con `answer=""`.
    noAnswer: z.boolean().default(false),
  })
  .strict();
export type RulesQaLLMOutput = z.infer<typeof rulesQaLLMOutputSchema>;

export interface RulesQaCitation {
  index: number;
  chunkId: string;
  snippet: string;
  // Arricchito dal composer: title/section/source del chunk reale.
  title: string | null;
  section: string | null;
  source: string;
  // Punteggi grezzi della search per debug.
  rrfScore: number;
  vectorRank: number | null;
  trigramRank: number | null;
}

export interface RulesQaResult {
  query: string;
  answer: string;
  noAnswer: boolean;
  citations: RulesQaCitation[];
  // Tutti i chunk passati al modello, anche quelli non citati. Utile
  // all'UI per offrire "expand context" o "vedi tutti i risultati".
  context: Array<{
    chunkId: string;
    title: string | null;
    section: string | null;
    source: string;
    content: string;
    rrfScore: number;
    vectorRank: number | null;
    trigramRank: number | null;
  }>;
  metadata: {
    rankersUsed: string[];
    embeddingStatus: "available" | "unavailable" | "skipped";
    sources: string[] | null;
  };
}
