import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { BadRequestError, UnauthorizedError } from "@/lib/api/errors";
import { fail } from "@/lib/api/respond";
import { getLogger } from "@/lib/logger";
import {
  isPlayerAccessConfigured,
  setPlayerAccessCookie,
  verifyPlayerAccessCode,
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
    if (!verifyPlayerAccessCode(input.code)) {
      audit.warn(
        { ip, userAgent, outcome: "denied" },
        "player login denied (codice non valido)",
      );
      throw new UnauthorizedError("Codice player non valido");
    }

    audit.info({ ip, userAgent, outcome: "granted" }, "player login granted");
    const res = NextResponse.json({ ok: true }, { status: 200 });
    setPlayerAccessCookie(res);
    return res;
  } catch (err) {
    return fail(err);
  }
}
