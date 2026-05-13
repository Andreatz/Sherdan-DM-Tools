import { describe, expect, it } from "vitest";

import { reciprocalRankFusion } from "@/lib/rules/rrf";

describe("reciprocalRankFusion", () => {
  it("ranks an item that appears top in both rankers above items in only one", () => {
    const result = reciprocalRankFusion([
      {
        name: "vector",
        items: [
          { id: "a", rank: 1 },
          { id: "b", rank: 2 },
        ],
      },
      {
        name: "trigram",
        items: [
          { id: "a", rank: 1 },
          { id: "c", rank: 2 },
        ],
      },
    ]);
    expect(result[0]?.id).toBe("a");
    expect(result[0]?.score).toBeGreaterThan(result[1]?.score ?? 0);
  });

  it("handles documents present in only one ranker", () => {
    const result = reciprocalRankFusion([
      { name: "vector", items: [{ id: "a", rank: 1 }] },
      { name: "trigram", items: [{ id: "b", rank: 1 }] },
    ]);
    expect(result.length).toBe(2);
    const ids = result.map((entry) => entry.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
  });

  it("perRanker fields show the rank from each list (null when absent)", () => {
    const result = reciprocalRankFusion([
      { name: "vector", items: [{ id: "a", rank: 3 }] },
      {
        name: "trigram",
        items: [
          { id: "a", rank: 1 },
          { id: "b", rank: 2 },
        ],
      },
    ]);
    const aEntry = result.find((entry) => entry.id === "a");
    const bEntry = result.find((entry) => entry.id === "b");
    expect(aEntry?.perRanker).toEqual({ vector: 3, trigram: 1 });
    expect(bEntry?.perRanker).toEqual({ vector: null, trigram: 2 });
  });

  it("applies the limit", () => {
    const items = Array.from({ length: 20 }, (_, index) => ({
      id: `doc-${index}`,
      rank: index + 1,
    }));
    const result = reciprocalRankFusion(
      [{ name: "vector", items }],
      { limit: 5 },
    );
    expect(result.length).toBe(5);
  });

  it("uses k=60 by default (rank 1 contributes 1/61)", () => {
    const result = reciprocalRankFusion([
      { name: "vector", items: [{ id: "a", rank: 1 }] },
    ]);
    expect(result[0]?.score).toBeCloseTo(1 / 61, 6);
  });

  it("k override affects the score (lower k -> higher score for rank 1)", () => {
    const withSmallK = reciprocalRankFusion(
      [{ name: "vector", items: [{ id: "a", rank: 1 }] }],
      { k: 10 },
    );
    const withBigK = reciprocalRankFusion(
      [{ name: "vector", items: [{ id: "a", rank: 1 }] }],
      { k: 100 },
    );
    expect(withSmallK[0]?.score).toBeGreaterThan(withBigK[0]?.score ?? 0);
  });

  it("breaks ties on score by id (stable, deterministic ordering)", () => {
    // Same rank in same single ranker -> identical score -> tie-break su id.
    const result = reciprocalRankFusion([
      {
        name: "vector",
        items: [
          { id: "z", rank: 1 },
          { id: "a", rank: 1 },
        ],
      },
    ]);
    // Entrambi hanno score 1/61, id alfabeticamente: "a" < "z".
    expect(result.map((entry) => entry.id)).toEqual(["a", "z"]);
  });

  it("returns empty array for empty input", () => {
    expect(reciprocalRankFusion([])).toEqual([]);
  });
});
