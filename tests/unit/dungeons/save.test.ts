import { describe, expect, it } from "vitest";

import { generateBspDungeon } from "@/lib/dungeons/bsp";
import {
  dungeonRoomContentSchema,
  type DungeonRoomContent,
} from "@/lib/dungeons/content-schema";
import { composeDungeonSavePayload } from "@/lib/dungeons/save";
import {
  dungeonSaveInputSchema,
  type DungeonSaveInput,
} from "@/lib/dungeons/save-schema";
import { dungeonGenerationParamsSchema } from "@/lib/dungeons/schema";
import { locationPropertiesSchema } from "@/lib/validation/location";

const CAMPAIGN_ID = "550e8400-e29b-41d4-a716-446655440000";

const params = dungeonGenerationParamsSchema.parse({
  roomCount: 6,
  gridWidth: 32,
  gridHeight: 24,
  minRoomSize: 4,
  maxRoomSize: 7,
  seed: 11,
  theme: "cripta di Tharros",
});
const dungeon = generateBspDungeon(params);

function makeContent(roomId: string, overrides: Partial<DungeonRoomContent> = {}): DungeonRoomContent {
  return dungeonRoomContentSchema.parse({
    roomId,
    title: `Stanza ${roomId}`,
    description: "Descrizione player-facing.",
    encounterHook: null,
    trap: null,
    treasure: null,
    lore: null,
    gmNotes: null,
    ...overrides,
  });
}

function makeInput(overrides: Partial<DungeonSaveInput> = {}): DungeonSaveInput {
  const content = dungeon.rooms.map((room) => makeContent(room.id));
  return dungeonSaveInputSchema.parse({
    campaignId: CAMPAIGN_ID,
    name: "Test dungeon",
    dungeon,
    content,
    ...overrides,
  });
}

describe("dungeonSaveInputSchema", () => {
  it("accepts a well-formed input", () => {
    const result = dungeonSaveInputSchema.safeParse({
      campaignId: CAMPAIGN_ID,
      name: "Test dungeon",
      dungeon,
      content: dungeon.rooms.map((room) => makeContent(room.id)),
    });
    expect(result.success).toBe(true);
  });

  it("rejects content for unknown room ids", () => {
    const result = dungeonSaveInputSchema.safeParse({
      campaignId: CAMPAIGN_ID,
      name: "Test dungeon",
      dungeon,
      content: [makeContent("ghost-room-99")],
    });
    expect(result.success).toBe(false);
  });

  it("defaults visibility to dm_only", () => {
    const parsed = dungeonSaveInputSchema.parse({
      campaignId: CAMPAIGN_ID,
      name: "Test dungeon",
      dungeon,
      content: [makeContent(dungeon.rooms[0]?.id ?? "")],
    });
    expect(parsed.visibility).toBe("dm_only");
  });
});

describe("composeDungeonSavePayload", () => {
  it("produces a root location with kind=dungeon and map_data attached", () => {
    const payload = composeDungeonSavePayload(makeInput());
    expect(payload.root.type).toBe("location");
    const props = payload.root.properties as Record<string, unknown>;
    expect(props.kind).toBe("dungeon");
    expect(props.map_data).toEqual(dungeon);
    expect(payload.root.tags).toContain("procedural-dungeon");
    expect(payload.root.parentId).toBeNull();
  });

  it("attaches parentLocationId on the root when provided", () => {
    const parent = "11111111-1111-4111-8111-111111111111";
    const payload = composeDungeonSavePayload(
      makeInput({ parentLocationId: parent }),
    );
    expect(payload.root.parentId).toBe(parent);
  });

  it("produces one room insert per dungeon room with parentLocalRef='ROOT'", () => {
    const payload = composeDungeonSavePayload(makeInput());
    expect(payload.rooms.length).toBe(dungeon.rooms.length);
    for (const room of payload.rooms) {
      expect(room.parentLocalRef).toBe("ROOT");
      expect(room.type).toBe("location");
      const props = room.properties as Record<string, unknown>;
      expect(props.kind).toBe("room");
      expect(room.tags).toContain("procedural-dungeon-room");
    }
  });

  it("rooms keep player description in publicDescription and GM markdown in description", () => {
    const firstId = dungeon.rooms[0]?.id ?? "";
    const content = dungeon.rooms.map((room) =>
      makeContent(room.id, {
        description: `Player view ${room.id}`,
        gmNotes: `GM secret ${room.id}`,
      }),
    );
    const payload = composeDungeonSavePayload(makeInput({ content }));
    const firstRoom = payload.rooms[0];
    expect(firstRoom?.publicDescription).toBe(`Player view ${firstId}`);
    expect(firstRoom?.description).toContain(`GM secret ${firstId}`);
    // Il description GM NON deve essere uguale al publicDescription
    // (deve contenere anche le sezioni GM-only).
    expect(firstRoom?.description).not.toBe(firstRoom?.publicDescription);
  });

  it("creates encounter inserts only for rooms with encounterHook", () => {
    const firstId = dungeon.rooms[0]?.id ?? "";
    const secondId = dungeon.rooms[1]?.id ?? "";
    const content = dungeon.rooms.map((room) =>
      makeContent(room.id, {
        encounterHook:
          room.id === firstId
            ? "Tre fanatici in preghiera, distratti."
            : null,
      }),
    );
    const payload = composeDungeonSavePayload(makeInput({ content }));
    expect(payload.encounters.length).toBe(1);
    expect(payload.encounters[0]?.roomLocalRef).toBe(firstId);
    expect(payload.encounters[0]?.description).toContain("fanatici");
    // Conferma che la second room NON ha encounter.
    expect(
      payload.encounters.find((entry) => entry.roomLocalRef === secondId),
    ).toBeUndefined();
  });

  it("root properties pass locationPropertiesSchema validation", () => {
    const payload = composeDungeonSavePayload(makeInput());
    const result = locationPropertiesSchema.safeParse(payload.root.properties);
    expect(result.success).toBe(true);
  });

  it("each room's properties pass locationPropertiesSchema validation", () => {
    const payload = composeDungeonSavePayload(makeInput());
    for (const room of payload.rooms) {
      const result = locationPropertiesSchema.safeParse(room.properties);
      expect(result.success).toBe(true);
    }
  });

  it("normalizes theme into a tag slug (ASCII, no diacritics)", () => {
    const tags = composeDungeonSavePayload(makeInput()).root.tags;
    const themeTag = tags.find((tag) => tag.startsWith("theme:"));
    expect(themeTag).toBeDefined();
    if (!themeTag) return;
    expect(themeTag).toMatch(/^theme:[a-z0-9-]+$/);
  });

  it("propagates visibility from input to root and rooms", () => {
    const payload = composeDungeonSavePayload(
      makeInput({ visibility: "discovered" }),
    );
    expect(payload.root.visibility).toBe("discovered");
    for (const room of payload.rooms) {
      expect(room.visibility).toBe("discovered");
    }
  });
});
