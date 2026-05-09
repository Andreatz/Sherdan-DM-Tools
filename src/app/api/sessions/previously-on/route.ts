import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/respond";
import {
  generatePreviouslyOn,
  previouslyOnInputSchema,
} from "@/lib/sessions/previously-on";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = previouslyOnInputSchema.parse(body);

    const [session] = await db
      .select({
        id: sessions.id,
        number: sessions.number,
        title: sessions.title,
        recap: sessions.recap,
      })
      .from(sessions)
      .where(eq(sessions.id, input.sessionId))
      .limit(1);

    if (!session) throw new NotFoundError("session", input.sessionId);
    const recap = session.recap?.trim();
    if (!recap) {
      throw new BadRequestError(
        "Serve un recap salvato per generare il Previously on.",
      );
    }

    const output = await generatePreviouslyOn({
      number: session.number,
      title: session.title,
      recap,
    });

    return ok(output);
  } catch (err) {
    return fail(err);
  }
}
