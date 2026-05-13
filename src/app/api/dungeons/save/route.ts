import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { campaigns, encounters, entities } from "@/db/schema";
import { AppError, ValidationFailedError } from "@/lib/api/errors";
import { created, fail } from "@/lib/api/respond";
import {
  composeDungeonSavePayload,
  dungeonSaveInputSchema,
  type DungeonSaveResult,
} from "@/lib/dungeons";
import { validateEntityProperties } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = dungeonSaveInputSchema.parse(body);

    const payload = composeDungeonSavePayload(input);

    // Validazione type-specific delle properties (location): scopre
    // problemi nel composer prima di toccare il DB.
    try {
      validateEntityProperties("location", payload.root.properties);
    } catch (zerr) {
      throw new ValidationFailedError(
        zerr,
        "Root dungeon: properties location non valide",
      );
    }
    for (const room of payload.rooms) {
      try {
        validateEntityProperties("location", room.properties);
      } catch (zerr) {
        throw new ValidationFailedError(
          zerr,
          `Room ${room.roomId}: properties location non valide`,
        );
      }
    }

    // Guard: la campagna deve esistere. Senza, la cascade delete
    // dell'entity sotto una campagna inesistente fallirebbe lato DB
    // con messaggio meno utile.
    const [campaign] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.id, input.campaignId))
      .limit(1);
    if (!campaign) {
      throw new AppError(
        `Campagna non trovata: ${input.campaignId}`,
        404,
        "campaign_not_found",
      );
    }

    // Se parentLocationId e' passato, deve essere una location della
    // stessa campagna. Niente cross-campaign cascade.
    if (input.parentLocationId) {
      const [parent] = await db
        .select({
          id: entities.id,
          campaignId: entities.campaignId,
          type: entities.type,
        })
        .from(entities)
        .where(eq(entities.id, input.parentLocationId))
        .limit(1);
      if (!parent) {
        throw new AppError(
          `Parent location non trovata: ${input.parentLocationId}`,
          404,
          "parent_not_found",
        );
      }
      if (parent.campaignId !== input.campaignId) {
        throw new AppError(
          "Parent location appartiene a una campagna diversa",
          400,
          "parent_campaign_mismatch",
        );
      }
      if (parent.type !== "location") {
        throw new AppError(
          "Parent deve essere una entity di type='location'",
          400,
          "parent_not_location",
        );
      }
    }

    const result = await db.transaction(async (tx) => {
      const [rootRow] = await tx
        .insert(entities)
        .values({
          campaignId: payload.root.campaignId,
          type: payload.root.type,
          name: payload.root.name,
          description: payload.root.description,
          publicDescription: payload.root.publicDescription,
          properties: payload.root.properties,
          tags: payload.root.tags,
          parentId: payload.root.parentId,
          visibility: payload.root.visibility,
        })
        .returning({ id: entities.id });
      if (!rootRow) {
        throw new AppError(
          "Salvataggio root dungeon fallito",
          500,
          "dungeon_root_save_failed",
        );
      }

      const roomEntityIds: DungeonSaveResult["roomEntityIds"] = [];
      const roomIdMap = new Map<string, string>(); // roomId -> entityId

      for (const room of payload.rooms) {
        const [roomRow] = await tx
          .insert(entities)
          .values({
            campaignId: payload.root.campaignId,
            type: room.type,
            name: room.name,
            description: room.description,
            publicDescription: room.publicDescription,
            properties: room.properties,
            tags: room.tags,
            parentId: rootRow.id,
            visibility: room.visibility,
          })
          .returning({ id: entities.id });
        if (!roomRow) {
          throw new AppError(
            `Salvataggio room dungeon fallito (${room.roomId})`,
            500,
            "dungeon_room_save_failed",
          );
        }
        roomEntityIds.push({ roomId: room.roomId, entityId: roomRow.id });
        roomIdMap.set(room.roomId, roomRow.id);
      }

      const encounterIds: DungeonSaveResult["encounterIds"] = [];
      for (const encounter of payload.encounters) {
        const locationId = roomIdMap.get(encounter.roomLocalRef);
        if (!locationId) continue;
        const [row] = await tx
          .insert(encounters)
          .values({
            campaignId: payload.root.campaignId,
            title: encounter.title,
            description: encounter.description,
            locationId,
            tacticalNotes: encounter.tacticalNotes,
          })
          .returning({ id: encounters.id });
        if (row) {
          encounterIds.push({ roomId: encounter.roomLocalRef, encounterId: row.id });
        }
      }

      const final: DungeonSaveResult = {
        rootEntityId: rootRow.id,
        roomEntityIds,
        encounterIds,
      };
      return final;
    });

    return created(result);
  } catch (err) {
    return fail(err);
  }
}
