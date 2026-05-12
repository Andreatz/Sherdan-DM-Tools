// Helper run-time per ripulire le tabelle utente tra un test E2E e
// l'altro. Riusa il pattern di `tests/integration/_helpers.ts` ma
// indipendente per non importare `vitest`.

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export async function truncateAllForE2E(databaseUrl: string): Promise<void> {
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);
  try {
    const rows = await db.execute<{ tablename: string }>(sql`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename NOT LIKE '\\_\\_drizzle\\_%' ESCAPE '\\'
    `);
    const tables = rows.map((r) => `"${r.tablename}"`).join(", ");
    if (!tables) return;
    await db.execute(
      sql.raw(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`),
    );
  } finally {
    await client.end();
  }
}
