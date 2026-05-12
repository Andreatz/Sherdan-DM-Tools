import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { truthClues } from "@/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { fail, noContent, ok } from "@/lib/api/respond";
import {
  normalizeTruthClueText,
  updateTruthClueInputSchema,
} from "@/lib/validation/truth-clue-input";

import { assertReferencesMatchCampaign } from "../route";

const idParamSchema = z.object({ id: z.uuid() });

interface RouteContext {
  params: Promise<{ id: string }>;
}

const truthClueColumns = {
  id: truthClues.id,
  campaignId: truthClues.campaignId,
  description: truthClues.description,
  truthRevealed: truthClues.truthRevealed,
  relatedPlotThreadId: truthClues.relatedPlotThreadId,
  relatedEntities: truthClues.relatedEntities,
  plantedInSession: truthClues.plantedInSession,
  status: truthClues.status,
  statusNotes: truthClues.statusNotes,
  statusUpdatedAt: truthClues.statusUpdatedAt,
  createdAt: truthClues.createdAt,
} as const;

async function resolveId(ctx: RouteContext): Promise<string> {
  return idParamSchema.parse(await ctx.params).id;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const rows = await db
      .select(truthClueColumns)
      .from(truthClues)
      .where(eq(truthClues.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("truth-clue", id);
    return ok(rows[0]);
  } catch (err) {
    return fail(err);
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const body = (await req.json()) as unknown;
    const input = updateTruthClueInputSchema.parse(body);
    if (Object.keys(input).length === 0) {
      throw new BadRequestError(
        "Niente da aggiornare: il body PATCH deve avere almeno un campo.",
      );
    }

    const [existing] = await db
      .select({
        id: truthClues.id,
        campaignId: truthClues.campaignId,
        status: truthClues.status,
      })
      .from(truthClues)
      .where(eq(truthClues.id, id))
      .limit(1);
    if (!existing) throw new NotFoundError("truth-clue", id);

    if (
      input.relatedPlotThreadId !== undefined ||
      input.plantedInSession !== undefined
    ) {
      await assertReferencesMatchCampaign({
        campaignId: existing.campaignId,
        relatedPlotThreadId:
          input.relatedPlotThreadId === undefined
            ? null
            : input.relatedPlotThreadId,
        plantedInSession:
          input.plantedInSession === undefined ? null : input.plantedInSession,
      });
    }

    const updateValues: Partial<typeof truthClues.$inferInsert> = {};
    if (input.description !== undefined) {
      updateValues.description = input.description;
    }
    if (input.truthRevealed !== undefined) {
      updateValues.truthRevealed = input.truthRevealed;
    }
    if (input.relatedPlotThreadId !== undefined) {
      updateValues.relatedPlotThreadId = input.relatedPlotThreadId;
    }
    if (input.relatedEntities !== undefined) {
      updateValues.relatedEntities = input.relatedEntities;
    }
    if (input.plantedInSession !== undefined) {
      updateValues.plantedInSession = input.plantedInSession;
    }
    if (input.status !== undefined) {
      updateValues.status = input.status;
      // Quando lo stato cambia, ribattezzare statusUpdatedAt: la dashboard
      // "verita' rivelata" si basa su questo per misurare quanto il party
      // si e' avvicinato alla verita' nel tempo.
      if (input.status !== existing.status) {
        updateValues.statusUpdatedAt = new Date();
      }
    }
    if (input.statusNotes !== undefined) {
      updateValues.statusNotes = normalizeTruthClueText(input.statusNotes);
    }

    const [row] = await db
      .update(truthClues)
      .set(updateValues)
      .where(eq(truthClues.id, id))
      .returning(truthClueColumns);

    if (!row) throw new NotFoundError("truth-clue", id);
    return ok(row);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const [row] = await db
      .delete(truthClues)
      .where(eq(truthClues.id, id))
      .returning({ id: truthClues.id });
    if (!row) throw new NotFoundError("truth-clue", id);
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
