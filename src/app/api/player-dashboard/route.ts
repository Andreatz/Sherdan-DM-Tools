import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { playerDashboardStates } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import {
  ensureDashboardState,
  getDmDashboard,
  getPlayerDashboardSnapshot,
} from "@/lib/player-dashboard";
import {
  dashboardQuerySchema,
  updateDashboardStateSchema,
} from "@/lib/player-dashboard/schema";
import { realtimeHub } from "@/lib/realtime";
import {
  assertCampaignScope,
  requirePlayerAccess,
} from "@/lib/security/player-access";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const raw = Object.fromEntries(req.nextUrl.searchParams.entries());

    if (req.nextUrl.searchParams.get("player") === "1") {
      const payload = requirePlayerAccess(req);
      const campaignId = assertCampaignScope(payload, raw.campaign_id);
      return ok(await getPlayerDashboardSnapshot(campaignId, payload));
    }

    const q = dashboardQuerySchema.parse(raw);
    return ok(await getDmDashboard(q.campaign_id));
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const input = updateDashboardStateSchema.parse(await req.json());
    await ensureDashboardState(input.campaignId);

    const updateValues: Partial<typeof playerDashboardStates.$inferInsert> = {};
    if (input.sceneTitle !== undefined) updateValues.sceneTitle = input.sceneTitle;
    if (input.sceneText !== undefined) updateValues.sceneText = input.sceneText;
    if (input.imageUrl !== undefined) updateValues.imageUrl = input.imageUrl;
    if (input.mapImageUrl !== undefined)
      updateValues.mapImageUrl = input.mapImageUrl;
    if (input.mapFogData !== undefined)
      updateValues.mapFogData = input.mapFogData;
    if (input.handouts !== undefined) updateValues.handouts = input.handouts;
    if (input.activeEntityIds !== undefined)
      updateValues.activeEntityIds = input.activeEntityIds;
    if (input.initiative !== undefined) updateValues.initiative = input.initiative;

    const [state] = await db
      .update(playerDashboardStates)
      .set(updateValues)
      .where(eq(playerDashboardStates.campaignId, input.campaignId))
      .returning();

    return ok(state);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = updateDashboardStateSchema.parse(body);
    await ensureDashboardState(input.campaignId);

    const snapshot = await getDmDashboard(input.campaignId);
    const sent = realtimeHub.broadcastCampaign(input.campaignId, "player_dashboard_updated", {
      state: snapshot.state,
    });
    return ok({ sent });
  } catch (err) {
    return fail(err);
  }
}
