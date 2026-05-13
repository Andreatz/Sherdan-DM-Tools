import { z } from "zod";

import {
  dungeonMapDataSchema,
  type DungeonMapData,
  type DungeonRoomKind,
} from "./schema";

// Output LLM per singola stanza. Niente meccaniche statblock: solo
// agganci narrativi. Encounter precisi (mostri + CR) restano dominio
// dell'Encounter Builder, che verra' integrato nello slice 3.
export const dungeonRoomContentSchema = z
  .object({
    roomId: z.string().min(1),
    title: z.string().trim().min(1).max(160),
    // Descrizione "letta al tavolo": cosa vedono, sentono, percepiscono
    // i PG entrando. Pulita da meta-info GM.
    description: z.string().trim().min(1).max(1200),
    // Hook combattimento opzionale: tag-line di cosa potrebbe accadere
    // (sara' raffinato in encounter veri nello slice 3).
    encounterHook: z.string().trim().min(1).max(400).nullable().default(null),
    // Trappola opzionale: descrizione + meccanica suggerita (DC, danno
    // aspetto, contromisure).
    trap: z.string().trim().min(1).max(400).nullable().default(null),
    // Tesoro opzionale: oggetto/contante/segreto materiale. La forma
    // resta narrativa, niente tabella DMG qui.
    treasure: z.string().trim().min(1).max(400).nullable().default(null),
    // Aggancio di lore: pezzo di mondo che la stanza rivela (storia del
    // sito, faction, indizi).
    lore: z.string().trim().min(1).max(600).nullable().default(null),
    // Note GM private: rivelazioni stratificate, ganci segreti, leve.
    gmNotes: z.string().trim().min(1).max(600).nullable().default(null),
  })
  .strict();
export type DungeonRoomContent = z.infer<typeof dungeonRoomContentSchema>;

// Output LLM batch: contenuto per ognuna delle stanze richieste.
export const dungeonContentLLMOutputSchema = z
  .object({
    rooms: z.array(dungeonRoomContentSchema).min(1),
  })
  .strict();
export type DungeonContentLLMOutput = z.infer<typeof dungeonContentLLMOutputSchema>;

// Input dell'endpoint content: la mappa generata + opzionalmente la
// campagna (per StyleCalibrator) e un subset di room da rigenerare
// (re-roll).
export const dungeonContentInputSchema = z
  .object({
    dungeon: dungeonMapDataSchema,
    campaignId: z.uuid().optional(),
    // Se presente, rigenera solo queste room mantenendo il resto come
    // contesto. Slice 2 supporta re-roll completo o subset.
    targetRoomIds: z.array(z.string().min(1)).optional(),
    // Contenuto gia' esistente (utile durante un re-roll parziale: il
    // modello vede cosa c'era e mantiene coerenza con le room non
    // toccate).
    existingContent: z.array(dungeonRoomContentSchema).optional(),
  })
  .strict();
export type DungeonContentInput = z.infer<typeof dungeonContentInputSchema>;

// Mappa dei kind ai termini visivi-narrativi usati dal prompt.
export const ROOM_KIND_PROMPT_LABELS: Record<DungeonRoomKind, string> = {
  entry: "ingresso (prima stanza che incontrano i PG)",
  standard: "stanza generica (interstizio o passaggio)",
  boss: "stanza climax / boss (il punto piu' difficile e profondo)",
  treasure: "camera tesoro / cache (dead-end profondo)",
  trick: "stanza-puzzle o trappola elaborata (junction)",
};

export interface DungeonContentResult {
  rooms: DungeonRoomContent[];
  metadata: {
    targetedRoomIds: string[];
    totalRooms: number;
    styleEntitiesAnalyzed: number;
  };
}

// Helper di composizione: unisce content rigenerato con quello esistente.
// Il modello potrebbe omettere/duplicare rooms — qui imponiamo che
// l'output finale copra esattamente le room targeted, mantenendo il
// resto invariato.
export function composeDungeonContent(input: {
  dungeon: DungeonMapData;
  targetedRoomIds: string[];
  llmRooms: DungeonRoomContent[];
  existing: DungeonRoomContent[];
  styleEntitiesAnalyzed: number;
}): DungeonContentResult {
  const byId = new Map<string, DungeonRoomContent>();
  for (const existing of input.existing) byId.set(existing.roomId, existing);

  // Solo i targeted ricevono l'aggiornamento. Se il modello restituisce
  // room fuori dal set targeted le ignoriamo (no surprise rewrites).
  const targetSet = new Set(input.targetedRoomIds);
  for (const generated of input.llmRooms) {
    if (!targetSet.has(generated.roomId)) continue;
    byId.set(generated.roomId, generated);
  }

  // Le room targeted devono avere un content alla fine. Se il modello
  // ne ha saltata una, fail-loud nel composer.
  const missing = input.targetedRoomIds.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new Error(
      `LLM dungeon content: room mancanti nell'output (${missing.join(", ")})`,
    );
  }

  return {
    rooms: input.dungeon.rooms
      .map((room) => byId.get(room.id))
      .filter((content): content is DungeonRoomContent => content !== undefined),
    metadata: {
      targetedRoomIds: input.targetedRoomIds,
      totalRooms: input.dungeon.rooms.length,
      styleEntitiesAnalyzed: input.styleEntitiesAnalyzed,
    },
  };
}
