import "dotenv/config";

import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import {
  materializeRandomTableSeedEntries,
  randomTableSeedDefinitions,
} from "@/lib/random-tables/seed-data";
import { env } from "@/lib/env";

const SHERDAN_NAME = "Sherdan";
const PLACEHOLDER_ENTRIES = [{ value: "__pending_seed_update__" }];

async function main() {
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(sql, { schema });

  try {
    const sherdanCampaignId = await ensureSherdanCampaign();
    const idByKey = new Map<string, string>();
    let created = 0;
    let updated = 0;

    for (const definition of randomTableSeedDefinitions) {
      const campaignId =
        definition.scope === "sherdan" ? sherdanCampaignId : null;
      const rows = await db
        .select({ id: schema.randomTables.id })
        .from(schema.randomTables)
        .where(
          and(
            eq(schema.randomTables.name, definition.name),
            campaignId === null
              ? isNull(schema.randomTables.campaignId)
              : eq(schema.randomTables.campaignId, campaignId),
          ),
        )
        .limit(1);

      const existing = rows[0];
      if (existing) {
        idByKey.set(definition.key, existing.id);
        continue;
      }

      const [row] = await db
        .insert(schema.randomTables)
        .values({
          campaignId,
          name: definition.name,
          description: definition.description,
          tags: definition.tags,
          entries: PLACEHOLDER_ENTRIES,
        })
        .returning({ id: schema.randomTables.id });

      if (!row) throw new Error(`Seed insert failed: ${definition.name}`);
      idByKey.set(definition.key, row.id);
      created += 1;
    }

    for (const definition of randomTableSeedDefinitions) {
      const id = idByKey.get(definition.key);
      if (!id) throw new Error(`Seed id missing after first pass: ${definition.key}`);

      const campaignId =
        definition.scope === "sherdan" ? sherdanCampaignId : null;
      const entries = materializeRandomTableSeedEntries(definition, idByKey);

      await db
        .update(schema.randomTables)
        .set({
          campaignId,
          name: definition.name,
          description: definition.description,
          tags: definition.tags,
          entries,
        })
        .where(eq(schema.randomTables.id, id));
      updated += 1;
    }

    console.log(
      `[ok] random tables seed completato: ${created} create, ${updated} upsert/update.`,
    );
  } finally {
    await sql.end();
  }

  async function ensureSherdanCampaign(): Promise<string> {
    const existing = await db
      .select({ id: schema.campaigns.id })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.name, SHERDAN_NAME))
      .limit(1);

    if (existing[0]) return existing[0].id;

    const [created] = await db
      .insert(schema.campaigns)
      .values({
        name: SHERDAN_NAME,
        description:
          "Campagna principale. Seed base creato automaticamente per i tool.",
        settings: {
          system: "D&D 5e",
          language: "it",
          tone: "dark fantasy con tratti grimdark",
        },
      })
      .returning({ id: schema.campaigns.id });

    if (!created) throw new Error(`Campaign seed failed: ${SHERDAN_NAME}`);
    return created.id;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
