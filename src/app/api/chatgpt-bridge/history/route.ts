import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { campaigns, chatgptBridgeExports, chatgptBridgeImports } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";

const historyQuerySchema = z.object({
  campaign_id: z.uuid().optional(),
  kind: z.enum(["all", "export", "import"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = historyQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const fetchLimit = q.limit + q.offset;

    const [exportsRows, importsRows] = await Promise.all([
      q.kind === "import"
        ? Promise.resolve([])
        : db
            .select({
              id: chatgptBridgeExports.id,
              campaignId: chatgptBridgeExports.campaignId,
              campaignName: campaigns.name,
              taskType: chatgptBridgeExports.taskType,
              density: chatgptBridgeExports.density,
              filename: chatgptBridgeExports.filename,
              markdown: chatgptBridgeExports.markdown,
              metadata: chatgptBridgeExports.metadata,
              createdAt: chatgptBridgeExports.createdAt,
            })
            .from(chatgptBridgeExports)
            .innerJoin(campaigns, eq(campaigns.id, chatgptBridgeExports.campaignId))
            .where(
              q.campaign_id
                ? eq(chatgptBridgeExports.campaignId, q.campaign_id)
                : undefined,
            )
            .orderBy(desc(chatgptBridgeExports.createdAt))
            .limit(fetchLimit),
      q.kind === "export"
        ? Promise.resolve([])
        : db
            .select({
              id: chatgptBridgeImports.id,
              campaignId: chatgptBridgeImports.campaignId,
              campaignName: campaigns.name,
              taskType: chatgptBridgeImports.taskType,
              sessionNumber: chatgptBridgeImports.sessionNumber,
              markdown: chatgptBridgeImports.markdown,
              updatePack: chatgptBridgeImports.updatePack,
              appliedChanges: chatgptBridgeImports.appliedChanges,
              metadata: chatgptBridgeImports.metadata,
              createdAt: chatgptBridgeImports.createdAt,
            })
            .from(chatgptBridgeImports)
            .innerJoin(campaigns, eq(campaigns.id, chatgptBridgeImports.campaignId))
            .where(
              q.campaign_id
                ? eq(chatgptBridgeImports.campaignId, q.campaign_id)
                : undefined,
            )
            .orderBy(desc(chatgptBridgeImports.createdAt))
            .limit(fetchLimit),
    ]);

    const rows = [
      ...exportsRows.map((row) => ({
        kind: "export" as const,
        id: row.id,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        taskType: row.taskType,
        density: row.density,
        filename: row.filename,
        metadata: row.metadata,
        preview: preview(row.markdown),
        characterCount: row.markdown.length,
        createdAt: row.createdAt,
      })),
      ...importsRows.map((row) => ({
        kind: "import" as const,
        id: row.id,
        campaignId: row.campaignId,
        campaignName: row.campaignName,
        taskType: row.taskType,
        sessionNumber: row.sessionNumber,
        metadata: row.metadata,
        updatePackPresent: row.updatePack !== null,
        appliedChangesCount: Array.isArray(row.appliedChanges)
          ? row.appliedChanges.length
          : 0,
        appliedChangesPreview: appliedPreview(row.appliedChanges),
        preview: preview(row.markdown),
        characterCount: row.markdown.length,
        createdAt: row.createdAt,
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(q.offset, q.offset + q.limit);

    return ok({ ok: true, rows });
  } catch (err) {
    return fail(err);
  }
}

function preview(markdown: string) {
  return markdown.replace(/\s+/g, " ").trim().slice(0, 260);
}

function appliedPreview(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      typeof item === "object" && item !== null
        ? (item as { kind?: unknown; label?: unknown; id?: unknown })
        : null,
    )
    .filter((item): item is { kind?: unknown; label?: unknown; id?: unknown } =>
      Boolean(item),
    )
    .slice(0, 8)
    .map((item) => ({
      kind: typeof item.kind === "string" ? item.kind : "change",
      label: typeof item.label === "string" ? item.label : "Modifica applicata",
      id: typeof item.id === "string" ? item.id : undefined,
    }));
}
