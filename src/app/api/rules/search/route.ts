import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api/respond";
import { callStructuredOutputLogged } from "@/lib/generators";
import { getLLMProvider } from "@/lib/llm";
import { rulesSearchInputSchema, searchRules, type RuleSearchHit } from "@/lib/rules";
import { z } from "zod";

const rerankOutputSchema = z
  .object({
    orderedChunkIds: z.array(z.string()).min(1),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = rulesSearchInputSchema.parse(body);
    const result = await searchRules(input, {
      embedQuery: async (text: string) => getLLMProvider().embed(text),
      rerankHits: rerankRulesHits,
    });
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}

async function rerankRulesHits(query: string, hits: RuleSearchHit[]) {
  const output = await callStructuredOutputLogged({
    prompt: {
      input: [
        {
          role: "system",
          content:
            "Sei un reranker per regole D&D/Sherdan. Ordina i chunk dal piu' utile al meno utile per rispondere alla query. Restituisci solo JSON valido.",
        },
        {
          role: "user",
          content: [
            `Query: ${query}`,
            "",
            ...hits.map((hit) =>
              [
                `Chunk ${hit.id}`,
                `Source: ${hit.source}`,
                `Section: ${hit.section ?? hit.title ?? "-"}`,
                hit.content.slice(0, 1200),
              ].join("\n"),
            ),
          ].join("\n\n"),
        },
      ],
      options: { temperature: 0, maxTokens: 1000, thinking: false },
    },
    schema: rerankOutputSchema,
    logContext: {
      generatorName: "rules-rerank",
      input: { query, chunkIds: hits.map((hit) => hit.id) },
    },
  });
  const byId = new Map(hits.map((hit) => [hit.id, hit]));
  const ordered = output.orderedChunkIds
    .map((id) => byId.get(id))
    .filter((hit): hit is RuleSearchHit => hit !== undefined);
  const seen = new Set(ordered.map((hit) => hit.id));
  return [...ordered, ...hits.filter((hit) => !seen.has(hit.id))];
}
