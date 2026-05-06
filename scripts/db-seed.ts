import "dotenv/config";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { env } from "@/lib/env";

// Seed minimale: assicura che esista una campagna "Sherdan" con i settings
// di base. Idempotente — eseguibile piu' volte senza creare duplicati.
//
// La popolazione vera della campagna (NPC, fazioni, lore, ecc.) avviene in
// Fase 1.5 con il Bootstrap script che parsa i .md di public/.

const SHERDAN_NAME = "Sherdan";

async function main() {
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(sql, { schema });

  try {
    const existing = await db
      .select({ id: schema.campaigns.id })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.name, SHERDAN_NAME))
      .limit(1);

    if (existing.length > 0) {
      console.log(
        `[ok] campagna "${SHERDAN_NAME}" gia' presente (id=${existing[0]!.id}). Niente da fare.`,
      );
      return;
    }

    const [created] = await db
      .insert(schema.campaigns)
      .values({
        name: SHERDAN_NAME,
        description:
          "Campagna principale. NPC, fazioni e lore vengono popolati in Fase 1.5 (Bootstrap Sherdan) dai .md in public/.",
        settings: {
          system: "D&D 5e",
          language: "it",
          tone: "dark fantasy con tratti grimdark",
        },
      })
      .returning({ id: schema.campaigns.id });

    if (!created) throw new Error("insert non ha ritornato la riga creata");
    console.log(`[ok] campagna "${SHERDAN_NAME}" creata (id=${created.id})`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
