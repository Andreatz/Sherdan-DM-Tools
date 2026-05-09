import type { NextRequest } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { entities } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import {
  encounterSuggesterInputSchema,
  filterSuggesterMonsters,
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
    const input = encounterSuggesterInputSchema.parse(body);

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

    const suggestions = suggestEncounterCompositions({
      partyLevel: input.partyLevel,
      partySize: input.partySize,
      difficulty: input.difficulty,
      monsters,
      maxSuggestions: input.maxSuggestions,
    });

    return ok({
      input,
      monstersConsidered: monsters.length,
      suggestions,
    });
  } catch (err) {
    return fail(err);
  }
}
