import type { NextRequest } from "next/server";
import { type SQL, and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";

import { db } from "@/db/client";
import { entities } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import {
  assertCampaignScope,
  requirePlayerAccess,
} from "@/lib/security/player-access";
import { projectEntitiesForPlayer } from "@/lib/security/player-entities";
import {
  applyEntityHidden,
  loadPlayerOverrides,
} from "@/lib/security/player-overrides";
import { listPlayerEntitiesQuerySchema } from "@/lib/validation/player-entity-input";

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

export async function GET(req: NextRequest) {
  try {
    const payload = requirePlayerAccess(req);

    const url = new URL(req.url);
    const q = listPlayerEntitiesQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const campaignId = assertCampaignScope(payload, q.campaign_id ?? null);

    // Visibility overrides per il player corrente. In modalita' legacy
    // (`playerId === null`) non ci sono override: la base resta intoccata.
    const overrides = payload.playerId
      ? (await loadPlayerOverrides(payload.playerId)).entity
      : { hidden: new Set<string>(), revealed: new Set<string>() };

    // La query base: visibilita' player-safe (public/discovered). In
    // OR-condition includiamo le entita' `revealed` esplicitamente per
    // questo player (mode=revealed sblocca anche dm_only).
    const baseFilters: SQL[] = [eq(entities.campaignId, campaignId)];
    if (q.type) baseFilters.push(eq(entities.type, q.type));
    if (q.parent_id) baseFilters.push(eq(entities.parentId, q.parent_id));
    if (q.search) {
      const pattern = `%${q.search}%`;
      const searchCondition = or(
        ilike(entities.name, pattern),
        ilike(entities.publicDescription, pattern),
      );
      if (searchCondition) baseFilters.push(searchCondition);
    }

    const revealedIds = Array.from(overrides.revealed);
    const visibilityFilter =
      revealedIds.length > 0
        ? or(
            inArray(entities.visibility, ["public", "discovered"]),
            inArray(entities.id, revealedIds),
          )
        : inArray(entities.visibility, ["public", "discovered"]);

    const conditions = [...baseFilters];
    if (visibilityFilter) conditions.push(visibilityFilter);

    const rows = await db
      .select(playerSafeColumns)
      .from(entities)
      .where(and(...conditions))
      .orderBy(q.sort === "updated_desc" ? desc(entities.updatedAt) : asc(entities.name))
      .limit(q.limit)
      .offset(q.offset);

    // Override `hidden`: rimuove entita' visibili per default ma marcate
    // come nascoste per questo player.
    const filtered = applyEntityHidden(rows, overrides.hidden);

    // Per le entita' fetchate via `revealed` con visibility base `dm_only`,
    // il proiettore le scarterebbe. Le ricomponiamo a `discovered` cosi'
    // restano visibili al player senza rompere il contratto player-safe.
    const safeRows = filtered.map((row) =>
      overrides.revealed.has(row.id) && row.visibility === "dm_only"
        ? { ...row, visibility: "discovered" as const }
        : row,
    );

    return ok(projectEntitiesForPlayer(safeRows));
  } catch (err) {
    return fail(err);
  }
}
