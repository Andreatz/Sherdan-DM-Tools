import { z } from "zod";

import { dungeonRoomContentSchema } from "./content-schema";
import { dungeonMapDataSchema } from "./schema";

// Input dell'endpoint save: campagna, mappa, contenuto, nome che diventa
// il `name` dell'entity root. Optional `parentLocationId` se l'utente
// vuole agganciare il dungeon a una location esistente (es. lo metto
// "sotto" la citta' di Tharros).
export const dungeonSaveInputSchema = z
  .object({
    campaignId: z.uuid(),
    name: z.string().trim().min(1).max(200),
    dungeon: dungeonMapDataSchema,
    content: z.array(dungeonRoomContentSchema).min(1),
    parentLocationId: z.uuid().optional(),
    // Visibility iniziale per root e room. Default `dm_only`: il DM puo'
    // promuovere a `discovered` quando il party arriva sul posto.
    visibility: z
      .enum(["dm_only", "discovered", "public"])
      .default("dm_only"),
  })
  .strict()
  .refine(
    (input) => {
      const roomIds = new Set(input.dungeon.rooms.map((room) => room.id));
      return input.content.every((entry) => roomIds.has(entry.roomId));
    },
    {
      message: "Ogni content.roomId deve corrispondere a una room esistente nella mappa",
      path: ["content"],
    },
  );

export type DungeonSaveInput = z.infer<typeof dungeonSaveInputSchema>;

// Risposta dell'endpoint save: id appena creati. Il client ricava il
// link `/campaigns/{id}?focus=<rootEntityId>#entity-detail`.
export interface DungeonSaveResult {
  rootEntityId: string;
  roomEntityIds: Array<{ roomId: string; entityId: string }>;
  encounterIds: Array<{ roomId: string; encounterId: string }>;
}
