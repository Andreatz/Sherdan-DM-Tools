import { inArray, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { playerVisibilityOverrides } from "@/db/schema";

export interface OrphanPlayerOverride extends Record<string, unknown> {
  id: string;
  playerId: string;
  targetType: "entity" | "truth_clue" | "entity_secret";
  targetId: string;
  mode: "hidden" | "revealed";
}

export async function findOrphanPlayerVisibilityOverrides(): Promise<
  OrphanPlayerOverride[]
> {
  return await db.execute<OrphanPlayerOverride>(sql`
    SELECT
      pvo.id,
      pvo.player_id AS "playerId",
      pvo.target_type AS "targetType",
      pvo.target_id AS "targetId",
      pvo.mode
    FROM player_visibility_overrides pvo
    LEFT JOIN entities e
      ON pvo.target_type = 'entity'
      AND pvo.target_id = e.id
    LEFT JOIN truth_clues tc
      ON pvo.target_type = 'truth_clue'
      AND pvo.target_id = tc.id
    LEFT JOIN entity_secrets es
      ON pvo.target_type = 'entity_secret'
      AND pvo.target_id = es.id
    WHERE
      (pvo.target_type = 'entity' AND e.id IS NULL)
      OR (pvo.target_type = 'truth_clue' AND tc.id IS NULL)
      OR (pvo.target_type = 'entity_secret' AND es.id IS NULL)
  `);
}

export async function cleanupOrphanPlayerVisibilityOverrides(options: {
  dryRun?: boolean;
} = {}) {
  const rows = await findOrphanPlayerVisibilityOverrides();
  if (!options.dryRun && rows.length > 0) {
    await db
      .delete(playerVisibilityOverrides)
      .where(
        inArray(
          playerVisibilityOverrides.id,
          rows.map((row) => row.id),
        ),
      );
  }
  return {
    ok: true,
    dryRun: Boolean(options.dryRun),
    orphanCount: rows.length,
    deletedCount: options.dryRun ? 0 : rows.length,
    rows,
  };
}
