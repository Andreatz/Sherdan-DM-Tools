import type { NextRequest } from "next/server";
import { type SQL, and, desc, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { generationLogs } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import { listGenerationLogsQuerySchema } from "@/lib/validation/generation-log-input";

// Endpoint read-only per ispezione del log delle chiamate LLM. Esclude i
// payload bulky (prompt/output) per default — disponibili tramite il route
// /api/generation-logs/[id]. Indicizzato su campaign_id, generator, status,
// createdAt (vedi `src/db/schema/generators.ts`).

const compactColumns = {
  id: generationLogs.id,
  campaignId: generationLogs.campaignId,
  generatorName: generationLogs.generatorName,
  provider: generationLogs.provider,
  model: generationLogs.model,
  status: generationLogs.status,
  metadata: generationLogs.metadata,
  inputTokens: generationLogs.inputTokens,
  outputTokens: generationLogs.outputTokens,
  totalTokens: generationLogs.totalTokens,
  costUsd: generationLogs.costUsd,
  createdAt: generationLogs.createdAt,
  error: generationLogs.error,
} as const;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listGenerationLogsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const conditions: SQL[] = [];
    if (q.campaign_id) {
      conditions.push(eq(generationLogs.campaignId, q.campaign_id));
    }
    if (q.generator) {
      conditions.push(eq(generationLogs.generatorName, q.generator));
    }
    if (q.provider) conditions.push(eq(generationLogs.provider, q.provider));
    if (q.model) conditions.push(eq(generationLogs.model, q.model));
    if (q.status) conditions.push(eq(generationLogs.status, q.status));
    if (q.error_only) conditions.push(isNotNull(generationLogs.error));
    if (q.feature) {
      conditions.push(sql`${generationLogs.metadata}->>'feature' = ${q.feature}`);
    }
    if (q.min_duration_ms !== undefined) {
      conditions.push(
        sql`COALESCE((${generationLogs.metadata}->>'latencyMs')::int, 0) >= ${q.min_duration_ms}`,
      );
    }

    const rows = await db
      .select(compactColumns)
      .from(generationLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(generationLogs.createdAt))
      .limit(q.limit)
      .offset(q.offset);

    return ok(rows);
  } catch (err) {
    return fail(err);
  }
}
