import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { entities, sessionEntities } from "@/db/schema";

import {
  parseRecapWikilinkNames,
  resolveRecapMentionEntities,
} from "./recap-wikilinks";

const AUTO_RECAP_MENTION_NOTE = "auto:recap-wikilink";

export async function syncSessionRecapMentionEntities(input: {
  campaignId: string;
  sessionId: string;
  recap: string | null;
}) {
  const wikilinkNames = parseRecapWikilinkNames(input.recap);
  const candidates = await db
    .select({ id: entities.id, name: entities.name })
    .from(entities)
    .where(eq(entities.campaignId, input.campaignId));
  const mentions = resolveRecapMentionEntities(wikilinkNames, candidates);

  await db.transaction(async (tx) => {
    await tx
      .delete(sessionEntities)
      .where(
        and(
          eq(sessionEntities.sessionId, input.sessionId),
          eq(sessionEntities.role, "mentioned"),
          eq(sessionEntities.notes, AUTO_RECAP_MENTION_NOTE),
        ),
      );

    if (mentions.length === 0) return;

    await tx.insert(sessionEntities).values(
      mentions.map((mention) => ({
        sessionId: input.sessionId,
        entityId: mention.id,
        role: "mentioned",
        notes: AUTO_RECAP_MENTION_NOTE,
      })),
    );
  });

  return { count: mentions.length };
}
