import { describe, expect, it } from "vitest";

import { buildRulesQaPrompt } from "@/lib/rules/qa-prompt";
import { composeRulesQaResult } from "@/lib/rules/qa";
import type { RuleSearchHit } from "@/lib/rules/search";

function makeChunk(overrides: Partial<RuleSearchHit> & { id: string }): RuleSearchHit {
  return {
    id: overrides.id,
    source: overrides.source ?? "sherdan-custom",
    title: overrides.title ?? "La Forgia di Sherdan",
    section: overrides.section ?? "Pozioni > Potion of Healing",
    content:
      overrides.content ?? "Potion of Healing — Componenti: 1 RIG + 1 STA.",
    metadata: overrides.metadata ?? {},
    rrfScore: overrides.rrfScore ?? 0.5,
    rankings: overrides.rankings ?? { vector: 1, trigram: 2 },
    vectorDistance: overrides.vectorDistance ?? 0.1,
    trigramSimilarity: overrides.trigramSimilarity ?? 0.4,
  };
}

describe("buildRulesQaPrompt", () => {
  it("includes the question, all chunks indexed 1..N, and an output contract", () => {
    const chunks = [
      makeChunk({ id: "c1", section: "A", content: "Regola A." }),
      makeChunk({ id: "c2", section: "B", content: "Regola B." }),
    ];
    const prompt = buildRulesQaPrompt({
      query: "Come funziona la regola A?",
      chunks,
    });
    const userMessage = Array.isArray(prompt.input)
      ? prompt.input.find((entry) => entry.role === "user")?.content ?? ""
      : prompt.input;
    expect(userMessage).toContain("Come funziona la regola A?");
    expect(userMessage).toContain("[1]");
    expect(userMessage).toContain("[2]");
    expect(userMessage).toContain("c1");
    expect(userMessage).toContain("c2");
    expect(userMessage).toContain("noAnswer");
  });

  it("handles empty context with a clear placeholder", () => {
    const prompt = buildRulesQaPrompt({ query: "domanda", chunks: [] });
    const userMessage = Array.isArray(prompt.input)
      ? prompt.input.find((entry) => entry.role === "user")?.content ?? ""
      : prompt.input;
    expect(userMessage).toContain("Nessun chunk rilevante");
  });

  it("uses low temperature and disables thinking (factual Q&A)", () => {
    const prompt = buildRulesQaPrompt({ query: "x", chunks: [] });
    expect(prompt.options?.temperature).toBeLessThan(0.5);
    expect(prompt.options?.thinking).toBe(false);
  });
});

describe("composeRulesQaResult", () => {
  it("enriches valid citations with chunk metadata (title/section/source)", () => {
    const chunks = [makeChunk({ id: "c1", title: "T", section: "S" })];
    const result = composeRulesQaResult({
      query: "q",
      chunks,
      llmOutput: {
        answer: "vedi [1]",
        citations: [{ index: 1, chunkId: "c1", snippet: "RIG + STA" }],
        noAnswer: false,
      },
      metadata: {
        sources: null,
        rankersUsed: ["vector", "trigram"],
        embeddingStatus: "available",
      },
    });
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.title).toBe("T");
    expect(result.citations[0]?.section).toBe("S");
    expect(result.citations[0]?.source).toBe("sherdan-custom");
  });

  it("drops citations that reference unknown chunkIds (no surprise rewrites)", () => {
    const chunks = [makeChunk({ id: "c1" })];
    const result = composeRulesQaResult({
      query: "q",
      chunks,
      llmOutput: {
        answer: "vedi [1] [2]",
        citations: [
          { index: 1, chunkId: "c1", snippet: "ok" },
          { index: 2, chunkId: "ghost", snippet: "inventata" },
        ],
        noAnswer: false,
      },
      metadata: {
        sources: null,
        rankersUsed: ["vector"],
        embeddingStatus: "available",
      },
    });
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.index).toBe(1);
  });

  it("dedupes citations on duplicate index (first wins)", () => {
    const chunks = [
      makeChunk({ id: "c1" }),
      makeChunk({ id: "c2" }),
    ];
    const result = composeRulesQaResult({
      query: "q",
      chunks,
      llmOutput: {
        answer: "vedi [1]",
        citations: [
          { index: 1, chunkId: "c1", snippet: "primo" },
          { index: 1, chunkId: "c2", snippet: "secondo (dovrebbe perdere)" },
        ],
        noAnswer: false,
      },
      metadata: {
        sources: null,
        rankersUsed: ["vector"],
        embeddingStatus: "available",
      },
    });
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]?.chunkId).toBe("c1");
  });

  it("propagates noAnswer flag and answer text", () => {
    const result = composeRulesQaResult({
      query: "q",
      chunks: [],
      llmOutput: {
        answer: "Non trovo nulla nel corpus.",
        citations: [],
        noAnswer: true,
      },
      metadata: {
        sources: null,
        rankersUsed: [],
        embeddingStatus: "unavailable",
      },
    });
    expect(result.noAnswer).toBe(true);
    expect(result.answer).toContain("Non trovo");
    expect(result.citations).toHaveLength(0);
  });

  it("returns the full chunk context (including non-cited ones) for the UI", () => {
    const chunks = [
      makeChunk({ id: "c1" }),
      makeChunk({ id: "c2" }),
      makeChunk({ id: "c3" }),
    ];
    const result = composeRulesQaResult({
      query: "q",
      chunks,
      llmOutput: {
        answer: "vedi [1]",
        citations: [{ index: 1, chunkId: "c1", snippet: "ok" }],
        noAnswer: false,
      },
      metadata: {
        sources: null,
        rankersUsed: ["vector"],
        embeddingStatus: "available",
      },
    });
    expect(result.context.map((c) => c.chunkId)).toEqual(["c1", "c2", "c3"]);
  });

  it("sorts citations by index ascending", () => {
    const chunks = [
      makeChunk({ id: "c1" }),
      makeChunk({ id: "c2" }),
      makeChunk({ id: "c3" }),
    ];
    const result = composeRulesQaResult({
      query: "q",
      chunks,
      llmOutput: {
        answer: "vedi [3] [1] [2]",
        citations: [
          { index: 3, chunkId: "c3", snippet: "x" },
          { index: 1, chunkId: "c1", snippet: "y" },
          { index: 2, chunkId: "c2", snippet: "z" },
        ],
        noAnswer: false,
      },
      metadata: {
        sources: null,
        rankersUsed: ["vector"],
        embeddingStatus: "available",
      },
    });
    expect(result.citations.map((c) => c.index)).toEqual([1, 2, 3]);
  });
});
