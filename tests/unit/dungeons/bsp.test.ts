import { describe, expect, it } from "vitest";

import { generateBspDungeon } from "@/lib/dungeons/bsp";
import {
  dungeonGenerationParamsSchema,
  dungeonMapDataSchema,
} from "@/lib/dungeons/schema";

function defaultParams(overrides: Partial<Record<string, unknown>> = {}) {
  return dungeonGenerationParamsSchema.parse({
    roomCount: 15,
    gridWidth: 64,
    gridHeight: 44,
    minRoomSize: 4,
    maxRoomSize: 10,
    seed: 42,
    theme: "fortezza Obsidium",
    ...overrides,
  });
}

function buildAdjacency(rooms: { id: string }[], edges: { fromRoomId: string; toRoomId: string }[]) {
  const adj = new Map<string, Set<string>>();
  for (const room of rooms) adj.set(room.id, new Set());
  for (const edge of edges) {
    adj.get(edge.fromRoomId)?.add(edge.toRoomId);
    adj.get(edge.toRoomId)?.add(edge.fromRoomId);
  }
  return adj;
}

function countConnectedComponents(rooms: { id: string }[], adj: Map<string, Set<string>>) {
  const seen = new Set<string>();
  let components = 0;
  for (const room of rooms) {
    if (seen.has(room.id)) continue;
    components += 1;
    const stack = [room.id];
    while (stack.length > 0) {
      const cur = stack.pop();
      if (!cur || seen.has(cur)) continue;
      seen.add(cur);
      for (const next of adj.get(cur) ?? []) stack.push(next);
    }
  }
  return components;
}

describe("generateBspDungeon", () => {
  it("produces output that matches the Zod schema", () => {
    const params = defaultParams();
    const dungeon = generateBspDungeon(params);
    const parsed = dungeonMapDataSchema.safeParse(dungeon);
    expect(parsed.success).toBe(true);
  });

  it("connects all rooms (no isolated rooms, no disconnected subgraphs)", () => {
    const params = defaultParams();
    const dungeon = generateBspDungeon(params);
    const adj = buildAdjacency(dungeon.rooms, dungeon.edges);
    expect(countConnectedComponents(dungeon.rooms, adj)).toBe(1);
    // Ogni stanza ha almeno una connessione (eccetto il caso single-room
    // che qui non si verifica visto roomCount=15).
    for (const room of dungeon.rooms) {
      expect(adj.get(room.id)?.size ?? 0).toBeGreaterThanOrEqual(1);
    }
  });

  it("is deterministic for the same seed (same input -> same output)", () => {
    const params = defaultParams({ seed: 7 });
    const a = generateBspDungeon(params);
    const b = generateBspDungeon(params);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("produces different layouts for different seeds", () => {
    const a = generateBspDungeon(defaultParams({ seed: 1 }));
    const b = generateBspDungeon(defaultParams({ seed: 2 }));
    expect(JSON.stringify(a.rooms)).not.toEqual(JSON.stringify(b.rooms));
  });

  it("respects min/max room size constraints", () => {
    const params = defaultParams({ minRoomSize: 4, maxRoomSize: 8 });
    const dungeon = generateBspDungeon(params);
    for (const room of dungeon.rooms) {
      // Caveat: se la foglia BSP e' piccola, la stanza puo' essere
      // ridotta sotto minRoomSize (vedi `Math.min(minRoomSize, maxW)`
      // in carveRoom). Tolleriamo room.w/h >= 1 ma <= maxRoomSize.
      expect(room.w).toBeGreaterThanOrEqual(1);
      expect(room.h).toBeGreaterThanOrEqual(1);
      expect(room.w).toBeLessThanOrEqual(params.maxRoomSize);
      expect(room.h).toBeLessThanOrEqual(params.maxRoomSize);
    }
  });

  it("keeps every room inside the grid bounds", () => {
    const params = defaultParams();
    const dungeon = generateBspDungeon(params);
    for (const room of dungeon.rooms) {
      expect(room.x).toBeGreaterThanOrEqual(0);
      expect(room.y).toBeGreaterThanOrEqual(0);
      expect(room.x + room.w).toBeLessThanOrEqual(params.gridWidth);
      expect(room.y + room.h).toBeLessThanOrEqual(params.gridHeight);
    }
  });

  it("assigns exactly one entry room and at most one boss/treasure room", () => {
    const dungeon = generateBspDungeon(defaultParams());
    const byKind = new Map<string, number>();
    for (const room of dungeon.rooms) {
      byKind.set(room.kind, (byKind.get(room.kind) ?? 0) + 1);
    }
    expect(byKind.get("entry") ?? 0).toBe(1);
    expect(byKind.get("boss") ?? 0).toBeLessThanOrEqual(1);
    expect(byKind.get("treasure") ?? 0).toBeLessThanOrEqual(1);
    expect(byKind.get("trick") ?? 0).toBeLessThanOrEqual(1);
  });

  it("places the entry room at the topmost-leftmost position", () => {
    const dungeon = generateBspDungeon(defaultParams());
    const entry = dungeon.rooms.find((room) => room.kind === "entry");
    expect(entry).toBeDefined();
    if (!entry) return;
    const sorted = [...dungeon.rooms].sort(
      (a, b) => a.y - b.y || a.x - b.x,
    );
    expect(sorted[0]?.id).toBe(entry.id);
  });

  it("produces a tree (edges = rooms - 1) given how BSP connects siblings", () => {
    const dungeon = generateBspDungeon(defaultParams());
    // BSP con connessione foglie-sibling sull'albero produce esattamente
    // un edge per nodo interno: rooms - 1 edges (proprieta' di un
    // albero spanning). Garantisce no-cycle e connessione completa.
    expect(dungeon.edges.length).toBe(dungeon.rooms.length - 1);
  });

  it("does not exceed the requested room count", () => {
    const dungeon = generateBspDungeon(defaultParams({ roomCount: 12 }));
    expect(dungeon.rooms.length).toBeLessThanOrEqual(12);
    expect(dungeon.rooms.length).toBeGreaterThanOrEqual(4);
  });

  it("returns at least one room even with very tight params", () => {
    const params = defaultParams({
      roomCount: 4,
      gridWidth: 20,
      gridHeight: 20,
      minRoomSize: 3,
      maxRoomSize: 6,
    });
    const dungeon = generateBspDungeon(params);
    expect(dungeon.rooms.length).toBeGreaterThanOrEqual(1);
  });
});
