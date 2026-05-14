import { type SQL, and, inArray, isNotNull, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { ruleDocuments } from "@/db/schema";
import { getLogger } from "@/lib/logger";

import { reciprocalRankFusion, type RrfResultEntry } from "./rrf";
import type { RulesSearchInput } from "./search-input";

const log = getLogger("rules.search");

export interface RuleSearchHit {
  id: string;
  source: string;
  title: string | null;
  section: string | null;
  content: string;
  metadata: Record<string, unknown>;
  rrfScore: number;
  rankings: {
    vector: number | null;
    trigram: number | null;
  };
  // Punteggi grezzi per ogni ranker (per debug / UI).
  vectorDistance: number | null;
  trigramSimilarity: number | null;
}

export interface RuleSearchResult {
  query: string;
  hits: RuleSearchHit[];
  metadata: {
    sources: string[] | null;
    rankersUsed: ("vector" | "trigram" | "rerank")[];
    vectorCandidates: number;
    trigramCandidates: number;
    embeddingStatus: "available" | "unavailable" | "skipped";
  };
}

export interface RulesSearchDependencies {
  // Funzione che produce l'embedding della query. Iniettabile per i
  // test (no Ollama in unit). Tipico: `getLLMProvider().embed(text)`.
  embedQuery: (query: string) => Promise<number[]>;
  rerankHits?: (query: string, hits: RuleSearchHit[]) => Promise<RuleSearchHit[]>;
}

export async function searchRules(
  input: RulesSearchInput,
  deps: RulesSearchDependencies,
): Promise<RuleSearchResult> {
  const sourceFilter = input.sources && input.sources.length > 0
    ? inArray(ruleDocuments.source, input.sources)
    : undefined;

  // ---- Vector cosine (best-effort: se l'embed fallisce degradiamo a solo trgm)
  const vectorRanking = await runVectorRanker(input, sourceFilter, deps).catch(
    (err) => {
      log.warn(
        { err: err instanceof Error ? err.message : String(err) },
        "vector ranker fallito, degrado a solo trigram",
      );
      return null;
    },
  );

  // ---- Trigram similarity (BM25-ish via pg_trgm)
  const trigramRanking = await runTrigramRanker(input, sourceFilter);

  const rankings = [
    vectorRanking
      ? {
          name: "vector" as const,
          items: vectorRanking.candidates.map((c, index) => ({
            id: c.id,
            rank: index + 1,
          })),
        }
      : null,
    {
      name: "trigram" as const,
      items: trigramRanking.candidates.map((c, index) => ({
        id: c.id,
        rank: index + 1,
      })),
    },
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const merged = reciprocalRankFusion(rankings, { limit: input.limit });

  const rowsById = new Map<string, RowMetadata>();
  for (const candidate of vectorRanking?.candidates ?? []) {
    rowsById.set(candidate.id, {
      row: candidate.row,
      vectorDistance: candidate.distance,
      trigramSimilarity: null,
    });
  }
  for (const candidate of trigramRanking.candidates) {
    const existing = rowsById.get(candidate.id);
    if (existing) {
      existing.trigramSimilarity = candidate.similarity;
    } else {
      rowsById.set(candidate.id, {
        row: candidate.row,
        vectorDistance: null,
        trigramSimilarity: candidate.similarity,
      });
    }
  }

  let hits = merged
    .map((entry) => buildHit(entry, rowsById))
    .filter((hit): hit is RuleSearchHit => hit !== null);

  if (input.rerank && deps.rerankHits && hits.length > 1) {
    hits = await deps.rerankHits(input.query, hits.slice(0, input.rerankTopK));
  }

  return {
    query: input.query,
    hits,
    metadata: {
      sources: input.sources ?? null,
      rankersUsed: [
        ...rankings.map((r) => r.name),
        ...(input.rerank ? (["rerank"] as const) : []),
      ],
      vectorCandidates: vectorRanking?.candidates.length ?? 0,
      trigramCandidates: trigramRanking.candidates.length,
      embeddingStatus: vectorRanking
        ? "available"
        : input.sources && input.sources.length === 0
          ? "skipped"
          : "unavailable",
    },
  };
}

interface RowMetadata {
  row: RuleRow;
  vectorDistance: number | null;
  trigramSimilarity: number | null;
}

interface RuleRow {
  id: string;
  source: string;
  title: string | null;
  section: string | null;
  content: string;
  metadata: unknown;
}

interface VectorCandidate {
  id: string;
  distance: number;
  row: RuleRow;
}

interface TrigramCandidate {
  id: string;
  similarity: number;
  row: RuleRow;
}

async function runVectorRanker(
  input: RulesSearchInput,
  sourceFilter: SQL | undefined,
  deps: RulesSearchDependencies,
): Promise<{ candidates: VectorCandidate[] } | null> {
  const vector = await deps.embedQuery(input.query);
  if (!Array.isArray(vector) || vector.length === 0) return null;
  const literal = toPgVectorLiteral(vector);
  const distanceExpr = sql<number>`${ruleDocuments.embedding} <=> ${literal}::vector`;
  const conditions: SQL[] = [isNotNull(ruleDocuments.embedding)];
  if (sourceFilter) conditions.push(sourceFilter);
  const rows = await db
    .select({
      id: ruleDocuments.id,
      source: ruleDocuments.source,
      title: ruleDocuments.title,
      section: ruleDocuments.section,
      content: ruleDocuments.content,
      metadata: ruleDocuments.metadata,
      distance: distanceExpr,
    })
    .from(ruleDocuments)
    .where(and(...conditions))
    .orderBy(distanceExpr)
    .limit(input.topKVector);

  return {
    candidates: rows.map((row) => ({
      id: row.id,
      distance: row.distance,
      row: {
        id: row.id,
        source: row.source,
        title: row.title,
        section: row.section,
        content: row.content,
        metadata: row.metadata,
      },
    })),
  };
}

async function runTrigramRanker(
  input: RulesSearchInput,
  sourceFilter: SQL | undefined,
): Promise<{ candidates: TrigramCandidate[] }> {
  const similarityExpr = sql<number>`similarity(${ruleDocuments.content}, ${input.query})`;
  // Filtro su soglia di similarity esplicita (no GUC globale).
  const thresholdCondition = sql<boolean>`similarity(${ruleDocuments.content}, ${input.query}) >= ${input.trigramThreshold}`;
  // Fallback ILIKE su title/section: query corte spesso non bucano la
  // soglia trgm anche se matchano un titolo di sezione esatto.
  const ilikeQuery = `%${input.query.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const ilikeCondition = or(
    sql<boolean>`${ruleDocuments.section} ILIKE ${ilikeQuery}`,
    sql<boolean>`${ruleDocuments.title} ILIKE ${ilikeQuery}`,
  );
  const matchAny = or(thresholdCondition, ilikeCondition);
  const finalCondition = sourceFilter ? and(matchAny, sourceFilter) : matchAny;

  const rows = await db
    .select({
      id: ruleDocuments.id,
      source: ruleDocuments.source,
      title: ruleDocuments.title,
      section: ruleDocuments.section,
      content: ruleDocuments.content,
      metadata: ruleDocuments.metadata,
      similarity: similarityExpr,
    })
    .from(ruleDocuments)
    .where(finalCondition)
    .orderBy(sql`${similarityExpr} desc`)
    .limit(input.topKTrigram);

  return {
    candidates: rows.map((row) => ({
      id: row.id,
      similarity: row.similarity,
      row: {
        id: row.id,
        source: row.source,
        title: row.title,
        section: row.section,
        content: row.content,
        metadata: row.metadata,
      },
    })),
  };
}

function buildHit(
  entry: RrfResultEntry,
  rowsById: Map<string, RowMetadata>,
): RuleSearchHit | null {
  const meta = rowsById.get(entry.id);
  if (!meta) return null;
  const metadata =
    meta.row.metadata && typeof meta.row.metadata === "object"
      ? (meta.row.metadata as Record<string, unknown>)
      : {};
  return {
    id: meta.row.id,
    source: meta.row.source,
    title: meta.row.title,
    section: meta.row.section,
    content: meta.row.content,
    metadata,
    rrfScore: entry.score,
    rankings: {
      vector: entry.perRanker.vector ?? null,
      trigram: entry.perRanker.trigram ?? null,
    },
    vectorDistance: meta.vectorDistance,
    trigramSimilarity: meta.trigramSimilarity,
  };
}

function toPgVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`;
}
