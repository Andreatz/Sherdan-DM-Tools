import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/respond";
import {
  formatSessionPrepAsMarkdown,
  sessionPrepOutputSchema,
} from "@/lib/session-prep";

// Salva il prep generato come append a `sessions.prep_notes` della
// sessione di destinazione. Se la sessione non ha prep_notes, la imposta.
// Altrimenti appende dopo una riga di separazione, cosi' si vede la
// storia di run successivi.

const saveSchema = z
  .object({
    sessionId: z.uuid(),
    output: sessionPrepOutputSchema,
    vibe: z.string().trim().max(200).optional(),
    focus: z.string().trim().max(500).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = saveSchema.parse(body);

    const [session] = await db
      .select({
        id: sessions.id,
        campaignId: sessions.campaignId,
        prepNotes: sessions.prepNotes,
      })
      .from(sessions)
      .where(eq(sessions.id, input.sessionId))
      .limit(1);
    if (!session) throw new NotFoundError("session", input.sessionId);

    const markdown = formatSessionPrepAsMarkdown(input.output, {
      generatedAt: new Date(),
      vibe: input.vibe,
      focus: input.focus,
    });

    const existing = session.prepNotes?.trim();
    const next = existing
      ? `${existing}\n\n---\n\n${markdown}`
      : markdown;

    const [row] = await db
      .update(sessions)
      .set({ prepNotes: next })
      .where(and(eq(sessions.id, input.sessionId)))
      .returning({
        id: sessions.id,
        number: sessions.number,
        prepNotes: sessions.prepNotes,
      });
    if (!row) {
      throw new BadRequestError(
        "Sessione non aggiornata: probabilmente cancellata mentre salvavi.",
      );
    }

    return ok({ session: row, markdown });
  } catch (err) {
    return fail(err);
  }
}
