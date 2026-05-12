import type { NextRequest } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { entities } from "@/db/schema";
import { NotFoundError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/respond";
import {
  assertCampaignScope,
  requirePlayerAccess,
} from "@/lib/security/player-access";
import { projectEntityForPlayer } from "@/lib/security/player-entities";
import { loadPlayerOverrides } from "@/lib/security/player-overrides";

const idParamSchema = z.object({ id: z.uuid() });

const detailQuerySchema = z
  .object({
    // Opzionale: in modalita' per-player il campaign_id arriva dal cookie.
    campaign_id: z.uuid().optional(),
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
    const payload = requirePlayerAccess(req);

    const id = await resolveId(ctx);
    const url = new URL(req.url);
    const q = detailQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const campaignId = assertCampaignScope(payload, q.campaign_id ?? null);

    const overrides = payload.playerId
      ? (await loadPlayerOverrides(payload.playerId)).entity
      : { hidden: new Set<string>(), revealed: new Set<string>() };

    // Override `hidden`: blocca anche se la visibility base e' OK.
    if (overrides.hidden.has(id)) {
      throw new NotFoundError("player entity", id);
    }

    // Override `revealed`: il player puo' vedere questa entita' anche se
    // dm_only. Se invece e' nel set, salta il filtro di visibility.
    const isRevealed = overrides.revealed.has(id);
    const rows = await db
      .select(playerSafeColumns)
      .from(entities)
      .where(
        isRevealed
          ? and(eq(entities.id, id), eq(entities.campaignId, campaignId))
          : and(
              eq(entities.id, id),
              eq(entities.campaignId, campaignId),
              inArray(entities.visibility, ["public", "discovered"]),
            ),
      )
      .limit(1);

    const source = rows[0];
    if (!source) throw new NotFoundError("player entity", id);

    // Se l'entita' viene dal reveal-bypass ma la sua visibility base e'
    // `dm_only`, il proiettore di default la scarterebbe. Ricomponiamo con
    // visibility "discovered" cosi' il contratto player resta valido.
    const safeSource =
      isRevealed && source.visibility === "dm_only"
        ? { ...source, visibility: "discovered" as const }
        : source;

    const projected = projectEntityForPlayer(safeSource);
    if (!projected) throw new NotFoundError("player entity", id);

    return ok(projected);
  } catch (err) {
    return fail(err);
  }
}
