// Reciprocal Rank Fusion. Merge di N ranking eterogenei (vector cosine,
// trigram similarity, ...) in un unico ranking finale. Niente
// normalizzazione dei punteggi: si lavora solo sui rank.
//
//   score(d) = sum_over_rankings  1 / (k + rank(d))
//
// k = 60 e' lo smoothing constant del paper originale Cormack et al.
// 2009. Valori piu' bassi (es. 10) danno piu' peso ai top-rank;
// valori piu' alti appiattiscono. 60 e' standard.
//
// Funzione pura, niente I/O. Test in isolation.

export interface RankedItem {
  id: string;
  rank: number; // 1-based: il top-1 ha rank=1.
}

export interface RrfRanking {
  /** Etichetta del ranker, per debug (es. "vector", "trgm"). */
  name: string;
  items: RankedItem[];
}

export interface RrfResultEntry {
  id: string;
  score: number;
  perRanker: Record<string, number | null>; // rank per ranker (null se assente)
}

export interface RrfOptions {
  /** Smoothing constant. Default 60 (standard). */
  k?: number;
  /** Numero massimo di risultati finali. Default 20. */
  limit?: number;
}

export function reciprocalRankFusion(
  rankings: RrfRanking[],
  options: RrfOptions = {},
): RrfResultEntry[] {
  const k = options.k ?? 60;
  const limit = options.limit ?? 20;

  const scoreById = new Map<string, RrfResultEntry>();

  for (const ranking of rankings) {
    for (const item of ranking.items) {
      const existing = scoreById.get(item.id);
      if (existing) {
        existing.score += 1 / (k + item.rank);
        existing.perRanker[ranking.name] = item.rank;
      } else {
        const perRanker: Record<string, number | null> = {};
        for (const r of rankings) perRanker[r.name] = null;
        perRanker[ranking.name] = item.rank;
        scoreById.set(item.id, {
          id: item.id,
          score: 1 / (k + item.rank),
          perRanker,
        });
      }
    }
  }

  return [...scoreById.values()]
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}
