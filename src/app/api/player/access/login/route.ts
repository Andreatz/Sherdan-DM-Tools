import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { BadRequestError, UnauthorizedError } from "@/lib/api/errors";
import { fail } from "@/lib/api/respond";
import {
  isPlayerAccessConfigured,
  setPlayerAccessCookie,
  verifyPlayerAccessCode,
} from "@/lib/security/player-access";

const loginInputSchema = z
  .object({
    code: z.string().trim().min(1),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    if (!isPlayerAccessConfigured()) {
      throw new BadRequestError(
        "Player access non configurato. Imposta SHERDAN_PLAYER_ACCESS_CODE lato server.",
      );
    }

    const input = loginInputSchema.parse((await req.json()) as unknown);
    if (!verifyPlayerAccessCode(input.code)) {
      throw new UnauthorizedError("Codice player non valido");
    }

    const res = NextResponse.json({ ok: true }, { status: 200 });
    setPlayerAccessCookie(res);
    return res;
  } catch (err) {
    return fail(err);
  }
}
