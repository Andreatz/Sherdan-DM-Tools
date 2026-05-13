import {
  callStructuredOutputLogged,
  type GeneratorRunOptions,
} from "@/lib/generators";
import { getLLMProvider } from "@/lib/llm";

import { buildRulesQaPrompt } from "./qa-prompt";
import {
  rulesQaLLMOutputSchema,
  type RulesQaCitation,
  type RulesQaInput,
  type RulesQaResult,
} from "./qa-schema";
import { searchRules, type RuleSearchHit } from "./search";

export interface RulesQaDependencies {
  // Search backend (DB). Iniettabile per test.
  search?: (
    input: RulesQaInput,
  ) => Promise<{
    hits: RuleSearchHit[];
    metadata: {
      sources: string[] | null;
      rankersUsed: ("vector" | "trigram")[];
      embeddingStatus: "available" | "unavailable" | "skipped";
    };
  }>;
  // Run options del Generator Framework (llm override, abort signal).
  runOptions?: GeneratorRunOptions;
}

export async function answerRulesQuestion(
  input: RulesQaInput,
  deps: RulesQaDependencies = {},
): Promise<RulesQaResult> {
  const search =
    deps.search ??
    ((qaInput: RulesQaInput) =>
      searchRules(qaInput, {
        embedQuery: (text) => getLLMProvider().embed(text),
      }));

  const searchResult = await search(input);
  const topChunks = searchResult.hits.slice(0, input.contextLimit);

  const prompt = buildRulesQaPrompt({ query: input.query, chunks: topChunks });
  const llmOutput = await callStructuredOutputLogged({
    prompt,
    schema: rulesQaLLMOutputSchema,
    logContext: {
      generatorName: "rules-qa",
      input: {
        query: input.query,
        sources: input.sources ?? null,
        contextLimit: input.contextLimit,
      },
      metadata: {
        chunksRetrieved: searchResult.hits.length,
        chunksUsed: topChunks.length,
        rankersUsed: searchResult.metadata.rankersUsed,
        embeddingStatus: searchResult.metadata.embeddingStatus,
      },
    },
    runOptions: deps.runOptions,
  });

  return composeRulesQaResult({
    query: input.query,
    chunks: topChunks,
    llmOutput,
    metadata: searchResult.metadata,
  });
}

export function composeRulesQaResult(args: {
  query: string;
  chunks: RuleSearchHit[];
  llmOutput: import("./qa-schema").RulesQaLLMOutput;
  metadata: {
    sources: string[] | null;
    rankersUsed: ("vector" | "trigram")[];
    embeddingStatus: "available" | "unavailable" | "skipped";
  };
}): RulesQaResult {
  const chunkById = new Map(args.chunks.map((chunk) => [chunk.id, chunk]));

  // Citations valide: index 1-based, chunkId presente nel contesto, e
  // index unico. Il modello potrebbe inventare citazioni fuori range —
  // le filtriamo silenziosamente, no surprise rewrites.
  const seenIndex = new Set<number>();
  const citations: RulesQaCitation[] = [];
  for (const cit of args.llmOutput.citations) {
    if (seenIndex.has(cit.index)) continue;
    const chunk = chunkById.get(cit.chunkId);
    if (!chunk) continue;
    seenIndex.add(cit.index);
    citations.push({
      index: cit.index,
      chunkId: cit.chunkId,
      snippet: cit.snippet,
      title: chunk.title,
      section: chunk.section,
      source: chunk.source,
      rrfScore: chunk.rrfScore,
      vectorRank: chunk.rankings.vector,
      trigramRank: chunk.rankings.trigram,
    });
  }
  citations.sort((a, b) => a.index - b.index);

  return {
    query: args.query,
    answer: args.llmOutput.answer,
    noAnswer: args.llmOutput.noAnswer,
    citations,
    context: args.chunks.map((chunk) => ({
      chunkId: chunk.id,
      title: chunk.title,
      section: chunk.section,
      source: chunk.source,
      content: chunk.content,
      rrfScore: chunk.rrfScore,
      vectorRank: chunk.rankings.vector,
      trigramRank: chunk.rankings.trigram,
    })),
    metadata: args.metadata,
  };
}
