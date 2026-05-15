import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { contradictionIgnores } from "@/db/schema";
import { fail, noContent, ok } from "@/lib/api/respond";

const ignoreInputSchema = z
  .object({
    campaignId: z.uuid(),
    issueId: z.string().trim().min(1),
    reason: z.string().trim().nullable().optional(),
  })
  .strict();

const deleteQuerySchema = z
  .object({
    campaign_id: z.uuid(),
    issue_id: z.string().trim().min(1),
  })
  .strict();

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = ignoreInputSchema.parse(body);
    const [row] = await db
      .insert(contradictionIgnores)
      .values({
        campaignId: input.campaignId,
        issueId: input.issueId,
        reason: input.reason ?? null,
      })
      .onConflictDoUpdate({
        target: [
          contradictionIgnores.campaignId,
          contradictionIgnores.issueId,
        ],
        set: {
          reason: input.reason ?? null,
        },
      })
      .returning({
        id: contradictionIgnores.id,
        campaignId: contradictionIgnores.campaignId,
        issueId: contradictionIgnores.issueId,
        reason: contradictionIgnores.reason,
        createdAt: contradictionIgnores.createdAt,
      });
    return ok(row);
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = deleteQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
    await db
      .delete(contradictionIgnores)
      .where(
        and(
          eq(contradictionIgnores.campaignId, q.campaign_id),
          eq(contradictionIgnores.issueId, q.issue_id),
        ),
      );
    return noContent();
  } catch (err) {
    return fail(err);
  }
}
