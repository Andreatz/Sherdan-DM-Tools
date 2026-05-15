import type { NextRequest } from "next/server";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  entities,
  playerDashboardStates,
  plotThreadEvents,
  plotThreads,
  sessions,
  truthClues,
} from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";

const querySchema = z
  .object({
    campaign_id: z.uuid(),
    session_id: z.uuid().optional(),
  })
  .strict();

const sessionColumns = {
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

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = querySchema.parse(Object.fromEntries(url.searchParams.entries()));

    const [selectedSession] = q.session_id
      ? await db
          .select(sessionColumns)
          .from(sessions)
          .where(
            and(eq(sessions.id, q.session_id), eq(sessions.campaignId, q.campaign_id)),
          )
          .limit(1)
      : await db
          .select(sessionColumns)
          .from(sessions)
          .where(eq(sessions.campaignId, q.campaign_id))
          .orderBy(desc(sessions.number))
          .limit(1);

    const [dashboardState] = await db
      .select({
        id: playerDashboardStates.id,
        sceneTitle: playerDashboardStates.sceneTitle,
        sceneText: playerDashboardStates.sceneText,
        imageUrl: playerDashboardStates.imageUrl,
        mapImageUrl: playerDashboardStates.mapImageUrl,
        handouts: playerDashboardStates.handouts,
        activeEntityIds: playerDashboardStates.activeEntityIds,
        initiative: playerDashboardStates.initiative,
        updatedAt: playerDashboardStates.updatedAt,
      })
      .from(playerDashboardStates)
      .where(eq(playerDashboardStates.campaignId, q.campaign_id))
      .limit(1);

    const activeEntityIds = dashboardState?.activeEntityIds ?? [];

    const [activeEntities, liveThreads, unresolvedClues, sessionEvents] =
      await Promise.all([
        activeEntityIds.length > 0
          ? db
              .select({
                id: entities.id,
                name: entities.name,
                type: entities.type,
                visibility: entities.visibility,
                publicDescription: entities.publicDescription,
              })
              .from(entities)
              .where(
                and(
                  eq(entities.campaignId, q.campaign_id),
                  inArray(entities.id, activeEntityIds),
                ),
              )
              .orderBy(asc(entities.name))
          : Promise.resolve([]),
        db
          .select({
            id: plotThreads.id,
            title: plotThreads.title,
            status: plotThreads.status,
            priority: plotThreads.priority,
            publicDescription: plotThreads.publicDescription,
            lastAdvancedAt: plotThreads.lastAdvancedAt,
          })
          .from(plotThreads)
          .where(
            and(
              eq(plotThreads.campaignId, q.campaign_id),
              inArray(plotThreads.status, ["hot", "warm"]),
            ),
          )
          .orderBy(asc(plotThreads.status), asc(plotThreads.priority))
          .limit(12),
        db
          .select({
            id: truthClues.id,
            description: truthClues.description,
            truthRevealed: truthClues.truthRevealed,
            status: truthClues.status,
            relatedPlotThreadId: truthClues.relatedPlotThreadId,
            plantedInSession: truthClues.plantedInSession,
            statusUpdatedAt: truthClues.statusUpdatedAt,
          })
          .from(truthClues)
          .where(
            and(
              eq(truthClues.campaignId, q.campaign_id),
              inArray(truthClues.status, [
                "planted",
                "noticed",
                "misinterpreted",
              ]),
            ),
          )
          .orderBy(desc(truthClues.statusUpdatedAt))
          .limit(16),
        selectedSession
          ? db
              .select({
                id: plotThreadEvents.id,
                plotThreadId: plotThreadEvents.plotThreadId,
                threadTitle: plotThreads.title,
                eventType: plotThreadEvents.eventType,
                description: plotThreadEvents.description,
                publicDescription: plotThreadEvents.publicDescription,
                occurredAt: plotThreadEvents.occurredAt,
              })
              .from(plotThreadEvents)
              .innerJoin(plotThreads, eq(plotThreads.id, plotThreadEvents.plotThreadId))
              .where(eq(plotThreadEvents.sessionId, selectedSession.id))
              .orderBy(asc(plotThreadEvents.occurredAt))
          : Promise.resolve([]),
      ]);

    return ok({
      session: selectedSession ?? null,
      dashboardState: dashboardState ?? null,
      activeEntities,
      liveThreads,
      unresolvedClues,
      sessionEvents,
    });
  } catch (err) {
    return fail(err);
  }
}
