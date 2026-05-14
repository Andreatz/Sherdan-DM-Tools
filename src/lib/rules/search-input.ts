import { z } from "zod";

// Input dell'endpoint /api/rules/search. Lasciamo `source` aperto come
// stringa (vocabolario aperto: `sherdan-custom` oggi, `srd-5.1` o altri
// in futuro). `topK` per ranker e `limit` finale separati cosi' si puo'
// pescare ampio dal singolo ranker e poi ridurre via RRF.
export const rulesSearchInputSchema = z
  .object({
    query: z.string().trim().min(2).max(500),
    sources: z.array(z.string().trim().min(1)).optional(),
    topKVector: z.number().int().min(1).max(100).default(20),
    topKTrigram: z.number().int().min(1).max(100).default(20),
    limit: z.number().int().min(1).max(50).default(10),
    // Soglia minima di similarity trigram per includere un chunk nel
    // ranking BM25-ish. 0.05 e' permissivo (Sherdan-style query corte
    // matchano poco). Alzala se l'output e' rumoroso.
    trigramThreshold: z.number().min(0).max(1).default(0.05),
    rerank: z.boolean().default(false),
    rerankTopK: z.number().int().min(1).max(30).default(20),
  })
  .strict();

export type RulesSearchInput = z.infer<typeof rulesSearchInputSchema>;
