import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { entities, playerEntityExposures } from "@/db/schema";
import { NotFoundError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/respond";
import { updateEntityExposureSchema } from "@/lib/player-dashboard/schema";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  try {
    const input = updateEntityExposureSchema.parse(await req.json());

    if (input.visibility !== undefined) {
      const [entity] = await db
        .update(entities)
        .set({ visibility: input.visibility })
        .where(
          and(
            eq(entities.id, input.entityId),
            eq(entities.campaignId, input.campaignId),
          ),
        )
        .returning({ id: entities.id });
      if (!entity) throw new NotFoundError("entity", input.entityId);
    }

    if (input.exposureMode !== undefined) {
      await db
        .insert(playerEntityExposures)
        .values({
          campaignId: input.campaignId,
          entityId: input.entityId,
          mode: input.exposureMode,
        })
        .onConflictDoUpdate({
          target: playerEntityExposures.entityId,
          set: { mode: input.exposureMode, updatedAt: new Date() },
        });
    }

    return ok({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
