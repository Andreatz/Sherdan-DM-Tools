import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { players } from "@/db/schema";
import { BadRequestError, UnauthorizedError } from "@/lib/api/errors";
import { fail } from "@/lib/api/respond";
import { withApiTelemetry } from "@/lib/api/request-telemetry";
import { writeAuditLog } from "@/lib/audit-log";
import { getLogger } from "@/lib/logger";
import {
  hashPlayerCode,
  isPlayerAccessConfigured,
  setPlayerAccessCookie,
  verifyGlobalAccessCode,
} from "@/lib/security/player-access";
import { clientKey, enforceRateLimit } from "@/lib/security/rate-limit";

const audit = getLogger("audit.player");

const LOGIN_RATE_LIMIT = {
  bucket: "player-login",
  limit: 5,
  windowMs: 15 * 60 * 1000, // 15 minuti
};

const loginInputSchema = z
  .object({
    code: z.string().trim().min(1),
  })
  .strict();

export async function POST(req: NextRequest) {
  return withApiTelemetry(req, "/api/player/access/login", ({ requestId }) =>
    handlePost(req, requestId),
  );
}

async function handlePost(req: NextRequest, requestId: string) {
  const ip = clientKey(req);
  const userAgent = req.headers.get("user-agent") ?? null;
  try {
    enforceRateLimit(req, LOGIN_RATE_LIMIT);

    if (!isPlayerAccessConfigured()) {
      throw new BadRequestError(
        "Player access non configurato. Imposta SHERDAN_PLAYER_ACCESS_CODE lato server.",
      );
    }

    const input = loginInputSchema.parse((await req.json()) as unknown);

    // Bridge a due step:
    // 1. Lookup per-player via hash deterministico. Se trova un player
    //    attivo, emette cookie scoped a quella campagna.
    // 2. Fallback al codice globale (env): emette cookie "legacy" senza
    //    scoping per campagna. Resta utile per setup pre-multi-player
    //    e per il DM stesso.
    const codeHash = hashPlayerCode(input.code);
    const [player] = await db
      .select({
        id: players.id,
        campaignId: players.campaignId,
        name: players.name,
        active: players.active,
      })
      .from(players)
      .where(and(eq(players.codeHash, codeHash), eq(players.active, true)))
      .limit(1);

    if (player) {
      // Aggiorna lastSeenAt: utile per audit + UI DM ("Bob non si connette
      // dalla S5"). Non bloccante se fallisce.
      try {
        await db
          .update(players)
          .set({ lastSeenAt: new Date() })
          .where(eq(players.id, player.id));
      } catch (err) {
        audit.warn(
          { playerId: player.id, err: err instanceof Error ? err.message : String(err) },
          "impossibile aggiornare lastSeenAt",
        );
      }

      audit.info(
        {
          ip,
          userAgent,
          outcome: "granted",
          mode: "per-player",
          playerId: player.id,
          playerName: player.name,
          campaignId: player.campaignId,
        },
        "player login granted (per-player)",
      );
      await writeAuditLog({
        action: "player.login",
        actorType: "player",
        playerId: player.id,
        campaignId: player.campaignId,
        outcome: "succeeded",
        requestId,
        ip,
        userAgent,
        metadata: { mode: "per-player", playerName: player.name },
      });
      const res = NextResponse.json(
        { ok: true, mode: "per-player", playerName: player.name },
        { status: 200 },
      );
      setPlayerAccessCookie(res, {
        playerId: player.id,
        campaignId: player.campaignId,
      });
      return res;
    }

    if (verifyGlobalAccessCode(input.code)) {
      audit.info(
        { ip, userAgent, outcome: "granted", mode: "legacy-global" },
        "player login granted (legacy global)",
      );
      await writeAuditLog({
        action: "player.login",
        actorType: "player",
        outcome: "succeeded",
        requestId,
        ip,
        userAgent,
        metadata: { mode: "legacy-global" },
      });
      const res = NextResponse.json(
        { ok: true, mode: "legacy-global" },
        { status: 200 },
      );
      setPlayerAccessCookie(res, { playerId: null, campaignId: null });
      return res;
    }

    audit.warn(
      { ip, userAgent, outcome: "denied" },
      "player login denied (codice non valido)",
    );
    await writeAuditLog({
      action: "player.login",
      actorType: "player",
      outcome: "denied",
      requestId,
      ip,
      userAgent,
      metadata: { reason: "invalid_code" },
    });
    throw new UnauthorizedError("Codice player non valido");
  } catch (err) {
    return fail(err);
  }
}
