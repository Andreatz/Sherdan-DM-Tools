import type { DungeonRoomContent } from "./content-schema";
import type { DungeonSaveInput } from "./save-schema";
import type { DungeonMapData, DungeonRoom } from "./schema";

// Insert pre-id: localId e' l'id "logico" della room sulla mappa
// (es. `room-0`); l'entityId UUID lo assegna Postgres dopo l'insert.
export interface DungeonRootInsert {
  campaignId: string;
  type: "location";
  name: string;
  description: string;
  publicDescription: string | null;
  properties: Record<string, unknown>;
  tags: string[];
  parentId: string | null;
  visibility: "dm_only" | "discovered" | "public";
}

export interface DungeonRoomInsert {
  // Aggancia al root via parentLocalRef = "ROOT" (placeholder, sostituito
  // a runtime con l'id appena restituito da Postgres).
  parentLocalRef: "ROOT";
  roomId: string;
  type: "location";
  name: string;
  description: string;
  publicDescription: string | null;
  properties: Record<string, unknown>;
  tags: string[];
  visibility: "dm_only" | "discovered" | "public";
}

export interface DungeonEncounterInsert {
  // Aggancia alla room via localRef = roomId; risolto a entityId a
  // runtime dopo l'insert delle room.
  roomLocalRef: string;
  title: string;
  description: string | null;
  tacticalNotes: string;
}

export interface DungeonSavePayload {
  root: DungeonRootInsert;
  rooms: DungeonRoomInsert[];
  encounters: DungeonEncounterInsert[];
}

// Compone payload pronto per la transaction. Funzione pura, testabile
// senza DB.
export function composeDungeonSavePayload(input: DungeonSaveInput): DungeonSavePayload {
  const contentByRoomId = new Map(
    input.content.map((entry) => [entry.roomId, entry]),
  );

  const root = buildRoot(input);
  const rooms = input.dungeon.rooms.map((room, index) =>
    buildRoom(room, index, contentByRoomId.get(room.id), input.visibility),
  );
  const encounters = buildEncounters(input.dungeon, contentByRoomId);

  return { root, rooms, encounters };
}

function buildRoot(input: DungeonSaveInput): DungeonRootInsert {
  const { dungeon } = input;
  const properties: Record<string, unknown> = {
    kind: "dungeon",
    atmosphere: {},
    notable_features: [],
    services: [],
    map_data: dungeon,
    extra: {
      procedural: true,
      generator: "bsp",
      generated_at: new Date().toISOString(),
      theme: dungeon.params.theme,
      seed: dungeon.params.seed,
      room_count: dungeon.rooms.length,
    },
  };

  return {
    campaignId: input.campaignId,
    type: "location",
    name: input.name,
    description: renderRootGmMarkdown(input),
    publicDescription: null,
    properties,
    tags: ["procedural-dungeon", `theme:${normalizeTagSlug(dungeon.params.theme)}`],
    parentId: input.parentLocationId ?? null,
    visibility: input.visibility,
  };
}

function buildRoom(
  room: DungeonRoom,
  index: number,
  content: DungeonRoomContent | undefined,
  visibility: "dm_only" | "discovered" | "public",
): DungeonRoomInsert {
  const fallbackName = `Stanza ${index + 1}`;
  const name = content?.title?.trim() || fallbackName;
  const publicDescription = content?.description ?? null;
  const description = renderRoomGmMarkdown(room, content);

  const properties: Record<string, unknown> = {
    kind: "room",
    atmosphere: {},
    notable_features: [],
    services: [],
    extra: {
      procedural_room: true,
      room_id: room.id,
      room_kind: room.kind,
      position: { x: room.x, y: room.y, w: room.w, h: room.h },
      center: { x: room.centerX, y: room.centerY },
    },
  };

  return {
    parentLocalRef: "ROOT",
    roomId: room.id,
    type: "location",
    name,
    description,
    publicDescription,
    properties,
    tags: ["procedural-dungeon-room", `room-kind:${room.kind}`],
    visibility,
  };
}

function buildEncounters(
  dungeon: DungeonMapData,
  contentByRoomId: Map<string, DungeonRoomContent>,
): DungeonEncounterInsert[] {
  const encounters: DungeonEncounterInsert[] = [];
  for (const room of dungeon.rooms) {
    const content = contentByRoomId.get(room.id);
    if (!content?.encounterHook) continue;
    encounters.push({
      roomLocalRef: room.id,
      title: `${content.title} — Encounter`,
      description: content.encounterHook,
      tacticalNotes: renderEncounterTacticalNotes(content),
    });
  }
  return encounters;
}

function renderRootGmMarkdown(input: DungeonSaveInput): string {
  const lines = [
    `# ${input.name}`,
    "",
    `Tema: **${input.dungeon.params.theme}**`,
    `Stanze: ${input.dungeon.rooms.length} · Corridoi: ${input.dungeon.edges.length}`,
    `Griglia: ${input.dungeon.grid.width}×${input.dungeon.grid.height} celle · Seed: ${input.dungeon.params.seed}`,
    "",
    "## Indice stanze",
    ...input.dungeon.rooms.map((room, index) => {
      const content = input.content.find((entry) => entry.roomId === room.id);
      const title = content?.title ?? `Stanza ${index + 1}`;
      return `- \`${room.kind}\` · ${title} (${room.id})`;
    }),
  ];
  return lines.join("\n");
}

function renderRoomGmMarkdown(
  room: DungeonRoom,
  content: DungeonRoomContent | undefined,
): string {
  if (!content) {
    return [
      `# Stanza ${room.id}`,
      `Tipo topologico: \`${room.kind}\``,
      "",
      "_Contenuto narrativo non generato._",
    ].join("\n");
  }
  const sections: string[] = [
    `# ${content.title}`,
    `Tipo topologico: \`${room.kind}\``,
    "",
    "## Descrizione (player-facing)",
    content.description,
  ];
  if (content.encounterHook) {
    sections.push("", "## Encounter hook", content.encounterHook);
  }
  if (content.trap) {
    sections.push("", "## Trappola", content.trap);
  }
  if (content.treasure) {
    sections.push("", "## Tesoro", content.treasure);
  }
  if (content.lore) {
    sections.push("", "## Lore", content.lore);
  }
  if (content.gmNotes) {
    sections.push("", "## Note GM", content.gmNotes);
  }
  return sections.join("\n");
}

function renderEncounterTacticalNotes(content: DungeonRoomContent): string {
  const lines = [content.encounterHook ?? ""];
  if (content.lore) lines.push("", `Contesto: ${content.lore}`);
  if (content.gmNotes) lines.push("", `Note GM: ${content.gmNotes}`);
  return lines.filter(Boolean).join("\n").trim();
}

// Slugify minimale per i tag: ASCII lower-case, separatori `-`, max 60 char.
// Range `̀-ͯ` = combining diacritical marks (accenti) prodotti
// dalla normalizzazione NFD; vanno via per ottenere ASCII.
function normalizeTagSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
