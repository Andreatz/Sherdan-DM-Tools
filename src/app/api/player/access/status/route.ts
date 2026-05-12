import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { players } from "@/db/schema";
import { ok } from "@/lib/api/respond";
import {
  isPlayerAccessConfigured,
  readPlayerCookie,
} from "@/lib/security/player-access";

export async function GET(req: NextRequest) {
  const configured = isPlayerAccessConfigured();
  let authenticated = false;
  let mode: "per-player" | "legacy-global" | null = null;
  let playerName: string | null = null;
  let campaignId: string | null = null;

  if (configured) {
    try {
      const payload = readPlayerCookie(req);
      authenticated = true;
      if (payload.playerId) {
        mode = "per-player";
        campaignId = payload.campaignId;
        const [row] = await db
          .select({ name: players.name })
          .from(players)
          .where(eq(players.id, payload.playerId))
          .limit(1);
        playerName = row?.name ?? null;
      } else {
        mode = "legacy-global";
      }
    } catch {
      authenticated = false;
    }
  }

  return ok({ configured, authenticated, mode, playerName, campaignId });
}
