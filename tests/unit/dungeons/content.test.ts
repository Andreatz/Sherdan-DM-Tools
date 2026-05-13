import { describe, expect, it } from "vitest";

import { generateBspDungeon } from "@/lib/dungeons/bsp";
import {
  composeDungeonContent,
  dungeonContentInputSchema,
  dungeonRoomContentSchema,
  type DungeonRoomContent,
} from "@/lib/dungeons/content-schema";
import {
  buildDungeonContentPrompt,
  resolveTargetedRoomIds,
} from "@/lib/dungeons/content-prompt";
import { dungeonGenerationParamsSchema } from "@/lib/dungeons/schema";

const params = dungeonGenerationParamsSchema.parse({
  roomCount: 8,
  gridWidth: 40,
  gridHeight: 28,
  minRoomSize: 4,
  maxRoomSize: 8,
  seed: 13,
  theme: "cripta sotto Tharros",
});
const dungeon = generateBspDungeon(params);

function dummyContent(roomId: string, overrides: Partial<DungeonRoomContent> = {}): DungeonRoomContent {
  return dungeonRoomContentSchema.parse({
    roomId,
    title: `Stanza ${roomId}`,
    description: "Descrizione di esempio.",
    encounterHook: null,
    trap: null,
    treasure: null,
    lore: null,
    gmNotes: null,
    ...overrides,
  });
}

describe("dungeon content schema + helpers", () => {
  it("validates a well-formed input", () => {
    const firstId = dungeon.rooms[0]?.id ?? "room-0";
    const result = dungeonContentInputSchema.safeParse({
      dungeon,
      // Zod 4 z.uuid() richiede v1-v8 (o all-zeros/all-fs).
      campaignId: "550e8400-e29b-41d4-a716-446655440000",
      targetRoomIds: [firstId],
      existingContent: [dummyContent(firstId)],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid campaign id (not uuid)", () => {
    const result = dungeonContentInputSchema.safeParse({
      dungeon,
      campaignId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("resolveTargetedRoomIds defaults to all rooms when omitted", () => {
    const targeted = resolveTargetedRoomIds({ dungeon });
    expect(targeted).toEqual(dungeon.rooms.map((room) => room.id));
  });

  it("resolveTargetedRoomIds filters out unknown room ids", () => {
    const valid = dungeon.rooms[0]?.id ?? "";
    const targeted = resolveTargetedRoomIds({
      dungeon,
      targetRoomIds: [valid, "ghost-room"],
    });
    expect(targeted).toEqual([valid]);
  });

  it("resolveTargetedRoomIds falls back to all rooms when no targets are valid", () => {
    const targeted = resolveTargetedRoomIds({
      dungeon,
      targetRoomIds: ["ghost-1", "ghost-2"],
    });
    expect(targeted).toEqual(dungeon.rooms.map((room) => room.id));
  });
});

describe("composeDungeonContent", () => {
  it("merges new content on targeted rooms and keeps existing for the rest", () => {
    const ids = dungeon.rooms.map((room) => room.id);
    const firstId = ids[0];
    const secondId = ids[1];
    expect(firstId).toBeDefined();
    expect(secondId).toBeDefined();
    if (!firstId || !secondId) return;

    const existing = ids.map((id) => dummyContent(id, { description: `OLD ${id}` }));
    const llmRooms = [dummyContent(firstId, { description: `NEW ${firstId}` })];

    const result = composeDungeonContent({
      dungeon,
      targetedRoomIds: [firstId],
      llmRooms,
      existing,
      styleEntitiesAnalyzed: 0,
    });

    expect(result.rooms.length).toBe(dungeon.rooms.length);
    const byId = new Map(result.rooms.map((room) => [room.roomId, room]));
    expect(byId.get(firstId)?.description).toBe(`NEW ${firstId}`);
    expect(byId.get(secondId)?.description).toBe(`OLD ${secondId}`);
  });

  it("ignores LLM output for non-targeted rooms (no surprise rewrites)", () => {
    const ids = dungeon.rooms.map((room) => room.id);
    const firstId = ids[0];
    const secondId = ids[1];
    if (!firstId || !secondId) return;

    const existing = ids.map((id) => dummyContent(id, { description: `OLD ${id}` }));
    // Il modello restituisce contenuto anche per secondId, ma non era
    // targeted -> deve restare "OLD".
    const llmRooms = [
      dummyContent(firstId, { description: `NEW ${firstId}` }),
      dummyContent(secondId, { description: `STRAY ${secondId}` }),
    ];

    const result = composeDungeonContent({
      dungeon,
      targetedRoomIds: [firstId],
      llmRooms,
      existing,
      styleEntitiesAnalyzed: 0,
    });

    const byId = new Map(result.rooms.map((room) => [room.roomId, room]));
    expect(byId.get(secondId)?.description).toBe(`OLD ${secondId}`);
  });

  it("throws if the LLM skips a targeted room", () => {
    const firstId = dungeon.rooms[0]?.id;
    if (!firstId) return;
    expect(() =>
      composeDungeonContent({
        dungeon,
        targetedRoomIds: [firstId],
        llmRooms: [],
        existing: [],
        styleEntitiesAnalyzed: 0,
      }),
    ).toThrow(/room mancanti/i);
  });

  it("returns rooms in the dungeon's room order", () => {
    const llmRooms = dungeon.rooms.map((room) =>
      dummyContent(room.id, { description: `room ${room.id}` }),
    );
    const result = composeDungeonContent({
      dungeon,
      targetedRoomIds: dungeon.rooms.map((room) => room.id),
      llmRooms,
      existing: [],
      styleEntitiesAnalyzed: 0,
    });
    expect(result.rooms.map((room) => room.roomId)).toEqual(
      dungeon.rooms.map((room) => room.id),
    );
  });
});

describe("buildDungeonContentPrompt", () => {
  it("includes theme, all room ids, and marks only targeted ones with [TARGET]", () => {
    const firstId = dungeon.rooms[0]?.id;
    if (!firstId) return;
    const prompt = buildDungeonContentPrompt({
      dungeon,
      targetedRoomIds: [firstId],
      existingContent: [],
      styleCalibrationMarkdown: null,
    });
    const userMessage = Array.isArray(prompt.input)
      ? prompt.input.find((entry) => entry.role === "user")?.content ?? ""
      : prompt.input;
    expect(userMessage).toContain(dungeon.params.theme);
    for (const room of dungeon.rooms) {
      expect(userMessage).toContain(room.id);
    }
    // Il marker dentro la lista stanze ha forma "<id> [TARGET]:".
    // Il backtick literal `[TARGET]` nelle istruzioni e' un riferimento e non conta.
    const targetMatches = userMessage.match(/ \[TARGET\]:/g) ?? [];
    expect(targetMatches.length).toBe(1);
  });

  it("appends the style calibration block when provided", () => {
    const prompt = buildDungeonContentPrompt({
      dungeon,
      targetedRoomIds: dungeon.rooms.map((room) => room.id),
      existingContent: [],
      styleCalibrationMarkdown: "## Style Calibration\n- entities: 42",
    });
    const userMessage = Array.isArray(prompt.input)
      ? prompt.input.find((entry) => entry.role === "user")?.content ?? ""
      : prompt.input;
    expect(userMessage).toContain("Style Calibration");
    expect(userMessage).toContain("entities: 42");
  });

  it("shows existing content for non-targeted rooms only (coherence anchor)", () => {
    const ids = dungeon.rooms.map((room) => room.id);
    const firstId = ids[0];
    const secondId = ids[1];
    if (!firstId || !secondId) return;
    const prompt = buildDungeonContentPrompt({
      dungeon,
      targetedRoomIds: [firstId],
      existingContent: [
        dummyContent(firstId, { description: "TARGETED-OLD" }),
        dummyContent(secondId, { description: "FIXED-CTX" }),
      ],
      styleCalibrationMarkdown: null,
    });
    const userMessage = Array.isArray(prompt.input)
      ? prompt.input.find((entry) => entry.role === "user")?.content ?? ""
      : prompt.input;
    expect(userMessage).toContain("FIXED-CTX");
    expect(userMessage).not.toContain("TARGETED-OLD");
  });

  it("uses temperature ~0.6 and disables thinking (slice 2 default)", () => {
    const prompt = buildDungeonContentPrompt({
      dungeon,
      targetedRoomIds: dungeon.rooms.map((room) => room.id),
      existingContent: [],
      styleCalibrationMarkdown: null,
    });
    expect(prompt.options?.temperature).toBeGreaterThan(0.3);
    expect(prompt.options?.thinking).toBe(false);
  });
});
