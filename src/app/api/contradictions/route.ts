import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  contradictionIgnores,
  entities,
  entityIdentities,
  entityLinks,
  plotThreads,
  truthClues,
} from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import {
  type ContradictionIssue,
  detectCampaignContradictions,
} from "@/lib/contradictions/detector";
import { boolish } from "@/lib/validation/_shared";

const querySchema = z
  .object({
    campaign_id: z.uuid(),
    include_ignored: boolish.optional().default(false),
  })
  .strict();

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = querySchema.parse(Object.fromEntries(url.searchParams.entries()));

    const [entityRows, identityRows, linkRows, plotRows, clueRows, ignoreRows] =
      await Promise.all([
        db
          .select({
            id: entities.id,
            type: entities.type,
            name: entities.name,
            visibility: entities.visibility,
            publicDescription: entities.publicDescription,
          })
          .from(entities)
          .where(eq(entities.campaignId, q.campaign_id)),
        db
          .select({
            id: entityIdentities.id,
            entityId: entityIdentities.entityId,
            name: entityIdentities.name,
            isTrueIdentity: entityIdentities.isTrueIdentity,
          })
          .from(entityIdentities)
          .innerJoin(entities, eq(entities.id, entityIdentities.entityId))
          .where(eq(entities.campaignId, q.campaign_id)),
        db
          .select({
            id: entityLinks.id,
            sourceEntityId: entityLinks.sourceEntityId,
            targetEntityId: entityLinks.targetEntityId,
            relationType: entityLinks.relationType,
            publicRelationType: entityLinks.publicRelationType,
          })
          .from(entityLinks)
          .where(eq(entityLinks.campaignId, q.campaign_id)),
        db
          .select({
            id: plotThreads.id,
            title: plotThreads.title,
            status: plotThreads.status,
            visibility: plotThreads.visibility,
            publicDescription: plotThreads.publicDescription,
          })
          .from(plotThreads)
          .where(eq(plotThreads.campaignId, q.campaign_id)),
        db
          .select({
            id: truthClues.id,
            description: truthClues.description,
            truthRevealed: truthClues.truthRevealed,
            status: truthClues.status,
            relatedPlotThreadId: truthClues.relatedPlotThreadId,
            plantedInSession: truthClues.plantedInSession,
          })
          .from(truthClues)
          .where(eq(truthClues.campaignId, q.campaign_id)),
        db
          .select({
            issueId: contradictionIgnores.issueId,
          })
          .from(contradictionIgnores)
          .where(eq(contradictionIgnores.campaignId, q.campaign_id)),
      ]);

    const entityNameById = new Map(entityRows.map((row) => [row.id, row.name]));
    const plotById = new Map(plotRows.map((row) => [row.id, row]));

    const report = detectCampaignContradictions({
      entities: entityRows,
      identities: identityRows.map((identity) => ({
        ...identity,
        entityName: entityNameById.get(identity.entityId) ?? "Entity sconosciuta",
      })),
      links: linkRows.map((link) => ({
        ...link,
        sourceName: entityNameById.get(link.sourceEntityId) ?? "Source sconosciuta",
        targetName: entityNameById.get(link.targetEntityId) ?? "Target sconosciuto",
      })),
      plotThreads: plotRows,
      truthClues: clueRows.map((clue) => {
        const plot = clue.relatedPlotThreadId
          ? plotById.get(clue.relatedPlotThreadId)
          : undefined;
        return {
          ...clue,
          plotThreadTitle: plot?.title ?? null,
          plotThreadStatus: plot?.status ?? null,
        };
      }),
    });
    const ignoredIds = new Set(ignoreRows.map((row) => row.issueId));
    const issues = report.issues.map((issue) => ({
      ...issue,
      ignored: ignoredIds.has(issue.id),
    }));
    const visibleIssues = q.include_ignored
      ? issues
      : issues.filter((issue) => !issue.ignored);

    return ok({
      issues: visibleIssues,
      summary: summarizeIssues(
        visibleIssues,
        issues.filter((issue) => issue.ignored).length,
      ),
      ignoredIssues: issues.filter((issue) => issue.ignored),
    });
  } catch (err) {
    return fail(err);
  }
}

function summarizeIssues(issues: ContradictionIssue[], ignored: number) {
  return {
    total: issues.length,
    high: issues.filter((issue) => issue.severity === "high").length,
    medium: issues.filter((issue) => issue.severity === "medium").length,
    low: issues.filter((issue) => issue.severity === "low").length,
    ignored,
  };
}
