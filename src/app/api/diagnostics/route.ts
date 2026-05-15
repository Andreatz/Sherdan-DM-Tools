import type { NextRequest } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/db/client";
import { NotFoundError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/respond";
import { withApiTelemetry } from "@/lib/api/request-telemetry";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return withApiTelemetry(req, "/api/diagnostics", async ({ requestId }) => {
    try {
      if (env.NODE_ENV === "production") {
        throw new NotFoundError("diagnostics");
      }

      const [dbRow] = await db.execute<{
        database_name: string;
        migration_count: number | null;
        table_count: number;
      }>(sql`
        SELECT
          current_database() AS database_name,
          (SELECT count(*)::int FROM drizzle.__drizzle_migrations) AS migration_count,
          (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS table_count
      `);

      return ok({
        ok: true,
        requestId,
        nodeEnv: env.NODE_ENV,
        llmProvider: env.LLM_PROVIDER,
        database: {
          name: dbRow?.database_name ?? "unknown",
          migrationCount: dbRow?.migration_count ?? null,
          tableCount: dbRow?.table_count ?? 0,
        },
        playerAccessConfigured: Boolean(env.SHERDAN_PLAYER_ACCESS_CODE),
      });
    } catch (err) {
      return fail(err);
    }
  });
}
