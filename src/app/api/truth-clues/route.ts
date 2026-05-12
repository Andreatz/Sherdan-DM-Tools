import type { NextRequest } from "next/server";
import { type SQL, and, arrayContains, desc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { plotThreads, sessions, truthClues } from "@/db/schema";
import { BadRequestError } from "@/lib/api/errors";
import { created, fail, ok } from "@/lib/api/respond";
import {
  createTruthClueInputSchema,
  listTruthCluesQuerySchema,
  normalizeTruthClueText,
} from "@/lib/validation/truth-clue-input";

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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listTruthCluesQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const conditions: SQL[] = [eq(truthClues.campaignId, q.campaign_id)];
    if (q.status) conditions.push(eq(truthClues.status, q.status));
    if (q.related_plot_thread_id) {
      conditions.push(
        eq(truthClues.relatedPlotThreadId, q.related_plot_thread_id),
      );
    }
    if (q.planted_in_session) {
      conditions.push(eq(truthClues.plantedInSession, q.planted_in_session));
    }
    if (q.related_entity_id) {
      conditions.push(
        arrayContains(truthClues.relatedEntities, [q.related_entity_id]),
      );
    }

    const rows = await db
      .select(truthClueColumns)
      .from(truthClues)
      .where(and(...conditions))
      .orderBy(desc(truthClues.statusUpdatedAt))
      .limit(q.limit)
      .offset(q.offset);

    return ok(rows);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = createTruthClueInputSchema.parse(body);

    await assertReferencesMatchCampaign({
      campaignId: input.campaignId,
      relatedPlotThreadId: input.relatedPlotThreadId ?? null,
      plantedInSession: input.plantedInSession ?? null,
    });

    const [row] = await db
      .insert(truthClues)
      .values({
        campaignId: input.campaignId,
        description: input.description,
        truthRevealed: input.truthRevealed,
        relatedPlotThreadId: input.relatedPlotThreadId ?? null,
        relatedEntities: input.relatedEntities ?? [],
        plantedInSession: input.plantedInSession ?? null,
        status: input.status,
        statusNotes: normalizeTruthClueText(input.statusNotes),
      })
      .returning(truthClueColumns);

    return created(row);
  } catch (err) {
    return fail(err);
  }
}

export async function assertReferencesMatchCampaign(params: {
  campaignId: string;
  relatedPlotThreadId: string | null;
  plantedInSession: string | null;
}) {
  const { campaignId, relatedPlotThreadId, plantedInSession } = params;
  if (relatedPlotThreadId) {
    const [thread] = await db
      .select({ id: plotThreads.id, campaignId: plotThreads.campaignId })
      .from(plotThreads)
      .where(eq(plotThreads.id, relatedPlotThreadId))
      .limit(1);
    if (!thread) throw new BadRequestError("Plot thread non trovato.");
    if (thread.campaignId !== campaignId) {
      throw new BadRequestError(
        "Briciola e plot thread devono appartenere alla stessa campagna.",
      );
    }
  }
  if (plantedInSession) {
    const [session] = await db
      .select({ id: sessions.id, campaignId: sessions.campaignId })
      .from(sessions)
      .where(eq(sessions.id, plantedInSession))
      .limit(1);
    if (!session) throw new BadRequestError("Sessione non trovata.");
    if (session.campaignId !== campaignId) {
      throw new BadRequestError(
        "Briciola e sessione devono appartenere alla stessa campagna.",
      );
    }
  }
}
