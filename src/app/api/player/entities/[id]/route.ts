import type { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { entities } from "@/db/schema";
import { NotFoundError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/respond";
import { requirePlayerAccess } from "@/lib/security/player-access";
import { projectEntityForPlayer } from "@/lib/security/player-entities";

const idParamSchema = z.object({ id: z.uuid() });

const detailQuerySchema = z
  .object({
    campaign_id: z.uuid(),
  })
  .strict();

const playerSafeColumns = {
  id: entities.id,
  campaignId: entities.campaignId,
  type: entities.type,
  name: entities.name,
  publicDescription: entities.publicDescription,
  parentId: entities.parentId,
  visibility: entities.visibility,
  updatedAt: entities.updatedAt,
} as const;

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveId(ctx: RouteContext): Promise<string> {
  return idParamSchema.parse(await ctx.params).id;
}

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    requirePlayerAccess(req);

    const id = await resolveId(ctx);
    const url = new URL(req.url);
    const q = detailQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const rows = await db
      .select(playerSafeColumns)
      .from(entities)
      .where(
        and(
          eq(entities.id, id),
          eq(entities.campaignId, q.campaign_id),
          inArray(entities.visibility, ["public", "discovered"]),
        ),
      )
      .limit(1);

    const projected = rows[0] ? projectEntityForPlayer(rows[0]) : null;
    if (!projected) throw new NotFoundError("player entity", id);

    return ok(projected);
  } catch (err) {
    return fail(err);
  }
}
