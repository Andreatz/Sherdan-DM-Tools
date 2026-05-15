import "dotenv/config";

import { sql } from "drizzle-orm";

import { db } from "@/db/client";

async function main() {
  const campaignId = process.argv[2];
  if (!campaignId) {
    console.error("Uso: pnpm perf:profile -- <campaign_id>");
    process.exit(1);
  }

  await explain(
    "entities campaign list",
    sql`
      SELECT id, name, type, visibility, updated_at
      FROM entities
      WHERE campaign_id = ${campaignId}
      ORDER BY name ASC
      LIMIT 500
    `,
  );
  await explain(
    "entity graph links",
    sql`
      SELECT source_entity_id, target_entity_id, relation_type, visibility
      FROM entity_links
      WHERE campaign_id = ${campaignId}
    `,
  );
  await explain(
    "bridge plot context",
    sql`
      SELECT id, title, status, priority, updated_at
      FROM plot_threads
      WHERE campaign_id = ${campaignId}
      ORDER BY status ASC, priority DESC NULLS LAST
      LIMIT 80
    `,
  );
  await explain(
    "bridge truth clues",
    sql`
      SELECT id, description, status, created_at
      FROM truth_clues
      WHERE campaign_id = ${campaignId}
      ORDER BY created_at DESC
      LIMIT 120
    `,
  );
}

async function explain(label: string, query: ReturnType<typeof sql>) {
  const rows = await db.execute<{ "QUERY PLAN": string }>(
    sql`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${query}`,
  );
  console.log(`\n## ${label}`);
  for (const row of rows) console.log(row["QUERY PLAN"]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
