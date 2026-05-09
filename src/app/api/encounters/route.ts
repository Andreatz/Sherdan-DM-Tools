import type { NextRequest } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  encounterParticipants,
  encounters,
  entities,
  plotThreads,
  sessions,
} from "@/db/schema";
import { AppError, BadRequestError } from "@/lib/api/errors";
import { created, fail, ok } from "@/lib/api/respond";
import {
  normalizeOptionalText,
  saveEncounterInputSchema,
} from "@/lib/encounters/encounter-save";

const listEncountersQuerySchema = z
  .object({
    campaign_id: z.uuid(),
  })
  .strict();

const encounterListColumns = {
  id: encounters.id,
  campaignId: encounters.campaignId,
  title: encounters.title,
  description: encounters.description,
  locationId: encounters.locationId,
  plotThreadId: encounters.plotThreadId,
  difficulty: encounters.difficulty,
  partyLevel: encounters.partyLevel,
  usedInSession: encounters.usedInSession,
  xpTotal: encounters.xpTotal,
  createdAt: encounters.createdAt,
  updatedAt: encounters.updatedAt,
} as const;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listEncountersQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const rows = await db
      .select(encounterListColumns)
      .from(encounters)
      .where(eq(encounters.campaignId, q.campaign_id))
      .orderBy(asc(encounters.title));

    return ok(rows);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = saveEncounterInputSchema.parse(body);

    await assertLocation(input.campaignId, input.locationId);
    if (input.plotThreadId) {
      await assertPlotThread(input.campaignId, input.plotThreadId);
    }
    if (input.usedInSession) {
      await assertSession(input.campaignId, input.usedInSession);
    }
    await assertParticipants(input.campaignId, input.participants);

    const saved = await db.transaction(async (tx) => {
      const [encounter] = await tx
        .insert(encounters)
        .values({
          campaignId: input.campaignId,
          title: input.title,
          description: normalizeOptionalText(input.description),
          locationId: input.locationId,
          plotThreadId: input.plotThreadId ?? null,
          difficulty: input.difficulty ?? null,
          partyLevel: input.partyLevel ?? null,
          xpTotal: input.xpTotal ?? null,
          tacticalNotes: normalizeOptionalText(input.tacticalNotes),
          usedInSession: input.usedInSession ?? null,
        })
        .returning(encounterListColumns);

      if (!encounter) {
        throw new AppError("Encounter non salvato");
      }

      const participants = await tx
        .insert(encounterParticipants)
        .values(
          input.participants.map((participant) => ({
            encounterId: encounter.id,
            entityId: participant.entityId,
            count: participant.count,
            role: normalizeOptionalText(participant.role),
            notes: normalizeOptionalText(participant.notes),
          })),
        )
        .returning({
          id: encounterParticipants.id,
          encounterId: encounterParticipants.encounterId,
          entityId: encounterParticipants.entityId,
          count: encounterParticipants.count,
          role: encounterParticipants.role,
          notes: encounterParticipants.notes,
        });

      return { encounter, participants };
    });

    return created(saved);
  } catch (err) {
    return fail(err);
  }
}

async function assertLocation(campaignId: string, locationId: string) {
  const [location] = await db
    .select({ id: entities.id, type: entities.type })
    .from(entities)
    .where(and(eq(entities.id, locationId), eq(entities.campaignId, campaignId)))
    .limit(1);

  if (!location) {
    throw new BadRequestError(
      "La location selezionata non esiste nella campagna.",
    );
  }
  if (location.type !== "location") {
    throw new BadRequestError(
      "locationId deve puntare a una entity di tipo location.",
    );
  }
}

async function assertPlotThread(campaignId: string, plotThreadId: string) {
  const [thread] = await db
    .select({ id: plotThreads.id })
    .from(plotThreads)
    .where(
      and(
        eq(plotThreads.id, plotThreadId),
        eq(plotThreads.campaignId, campaignId),
      ),
    )
    .limit(1);

  if (!thread) {
    throw new BadRequestError(
      "Il plot thread selezionato non esiste nella campagna.",
    );
  }
}

async function assertSession(campaignId: string, sessionId: string) {
  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.campaignId, campaignId)))
    .limit(1);

  if (!session) {
    throw new BadRequestError(
      "La sessione selezionata non esiste nella campagna.",
    );
  }
}

async function assertParticipants(
  campaignId: string,
  participants: Array<{ entityId: string }>,
) {
  const ids = Array.from(
    new Set(participants.map((participant) => participant.entityId)),
  );
  const rows = await db
    .select({ id: entities.id, type: entities.type })
    .from(entities)
    .where(and(inArray(entities.id, ids), eq(entities.campaignId, campaignId)));

  const foundIds = new Set(rows.map((row) => row.id));
  const missingIds = ids.filter((id) => !foundIds.has(id));
  if (missingIds.length > 0) {
    throw new BadRequestError(
      "Uno o piu' partecipanti non esistono nella campagna.",
      { missingIds },
    );
  }

  const nonMonsterIds = rows
    .filter((row) => row.type !== "monster")
    .map((row) => row.id);
  if (nonMonsterIds.length > 0) {
    throw new BadRequestError(
      "Il builder encounter salva solo partecipanti di tipo monster.",
      { nonMonsterIds },
    );
  }
}
