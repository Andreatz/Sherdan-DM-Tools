import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { sessions } from "@/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { fail, noContent, ok } from "@/lib/api/respond";
import { syncSessionRecapMentionEntities } from "@/lib/sessions/session-mentions";
import {
  normalizeSessionText,
  updateSessionInputSchema,
} from "@/lib/validation/session-input";

const idParamSchema = z.object({ id: z.uuid() });

interface RouteContext {
  params: Promise<{ id: string }>;
}

const sessionDetailColumns = {
  id: sessions.id,
  campaignId: sessions.campaignId,
  number: sessions.number,
  title: sessions.title,
  date: sessions.date,
  recap: sessions.recap,
  dmNotes: sessions.dmNotes,
  prepNotes: sessions.prepNotes,
  createdAt: sessions.createdAt,
  updatedAt: sessions.updatedAt,
} as const;

async function resolveId(ctx: RouteContext): Promise<string> {
  return idParamSchema.parse(await ctx.params).id;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const rows = await db
      .select(sessionDetailColumns)
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("session", id);
    return ok(rows[0]);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const body = (await req.json()) as unknown;
    const input = updateSessionInputSchema.parse(body);
    if (Object.keys(input).length === 0) {
      throw new BadRequestError(
        "Niente da aggiornare: il body PATCH deve avere almeno un campo.",
      );
    }

    const updateValues: Partial<typeof sessions.$inferInsert> = {};
    if (input.title !== undefined)
      updateValues.title = normalizeSessionText(input.title);
    if (input.date !== undefined) updateValues.date = input.date;
    if (input.recap !== undefined)
      updateValues.recap = normalizeSessionText(input.recap);
    if (input.dmNotes !== undefined)
      updateValues.dmNotes = normalizeSessionText(input.dmNotes);
    if (input.prepNotes !== undefined)
      updateValues.prepNotes = normalizeSessionText(input.prepNotes);

    const [row] = await db
      .update(sessions)
      .set(updateValues)
      .where(eq(sessions.id, id))
      .returning(sessionDetailColumns);

    if (!row) throw new NotFoundError("session", id);
    if (input.recap !== undefined) {
      await syncSessionRecapMentionEntities({
        campaignId: row.campaignId,
        sessionId: row.id,
        recap: row.recap,
      });
    }
    return ok(row);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const [row] = await db
      .delete(sessions)
      .where(eq(sessions.id, id))
      .returning({ id: sessions.id });
    if (!row) throw new NotFoundError("session", id);
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
