import type { NextRequest } from "next/server";
import { and, asc, desc, eq, ne } from "drizzle-orm";

import { db } from "@/db/client";
import { entities, pcHooks, plotThreads, truthClues } from "@/db/schema";
import { BadRequestError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/respond";
import {
  encounterAssistInputSchema,
  type EncounterNarrativeContext,
  filterSuggesterMonsters,
  generateEncounterAssist,
  monsterRecordToSuggesterMonster,
  parseMonsterRecord,
  suggestEncounterCompositions,
} from "@/lib/encounters";

const monsterColumns = {
  id: entities.id,
  name: entities.name,
  description: entities.description,
  publicDescription: entities.publicDescription,
  properties: entities.properties,
  tags: entities.tags,
  updatedAt: entities.updatedAt,
} as const;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = encounterAssistInputSchema.parse(body);

    const rows = await db
      .select(monsterColumns)
      .from(entities)
      .where(
        and(
          eq(entities.campaignId, input.campaignId),
          eq(entities.type, "monster"),
        ),
      )
      .orderBy(asc(entities.name))
      .limit(500);

    const monsters = filterSuggesterMonsters(
      rows
        .map(parseMonsterRecord)
        .filter((record): record is NonNullable<typeof record> => record !== null)
        .map(monsterRecordToSuggesterMonster)
        .filter((monster): monster is NonNullable<typeof monster> => monster !== null),
      input,
    );

    const candidates = suggestEncounterCompositions({
      partyLevel: input.partyLevel,
      partySize: input.partySize,
      difficulty: input.difficulty,
      monsters,
      maxSuggestions: 6,
    });

    if (candidates.length === 0) {
      throw new BadRequestError(
        "Nessuna composizione candidate disponibile per questi vincoli.",
      );
    }

    const narrativeContext = await loadNarrativeContext(input.campaignId);
    const assist = await generateEncounterAssist(
      input,
      candidates,
      narrativeContext,
    );

    return ok({
      input,
      monstersConsidered: monsters.length,
      assist,
    });
  } catch (err) {
    return fail(err);
  }
}

async function loadNarrativeContext(
  campaignId: string,
): Promise<EncounterNarrativeContext> {
  const [threads, clues, hooks] = await Promise.all([
    db
      .select({
        id: plotThreads.id,
        title: plotThreads.title,
        status: plotThreads.status,
        publicDescription: plotThreads.publicDescription,
        description: plotThreads.description,
      })
      .from(plotThreads)
      .where(eq(plotThreads.campaignId, campaignId))
      .orderBy(desc(plotThreads.updatedAt))
      .limit(8),
    db
      .select({
        id: truthClues.id,
        description: truthClues.description,
        truthRevealed: truthClues.truthRevealed,
        status: truthClues.status,
        relatedPlotThreadId: truthClues.relatedPlotThreadId,
      })
      .from(truthClues)
      .where(
        and(
          eq(truthClues.campaignId, campaignId),
          ne(truthClues.status, "understood"),
        ),
      )
      .orderBy(desc(truthClues.statusUpdatedAt))
      .limit(8),
    db
      .select({
        id: pcHooks.id,
        pcEntityId: pcHooks.pcEntityId,
        targetEntityId: pcHooks.targetEntityId,
        hookDescription: pcHooks.hookDescription,
        potentialArc: pcHooks.potentialArc,
        status: pcHooks.status,
      })
      .from(pcHooks)
      .where(and(eq(pcHooks.campaignId, campaignId), ne(pcHooks.status, "resolved")))
      .orderBy(asc(pcHooks.createdAt))
      .limit(8),
  ]);

  return {
    plotThreads: threads,
    truthClues: clues,
    pcHooks: hooks,
  };
}
