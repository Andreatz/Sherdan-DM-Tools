// Global setup Playwright: applica le migration al DB di test prima di
// avviare i browser. Il dev server e' avviato da Playwright (webServer in
// playwright.config) usando lo stesso DATABASE_URL.
import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export default async function globalSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "Test E2E richiedono DATABASE_URL impostato (vedi playwright.config + .env locale).",
    );
  }
  const dbName = databaseUrl.split("/").pop()?.split("?")[0];
  if (!dbName || (!/test/i.test(dbName) && dbName !== "ci")) {
    throw new Error(
      `DATABASE_URL E2E deve avere "test" nel nome (o essere "ci"). Trovato: "${dbName ?? "(?)"}".`,
    );
  }

  const sql = postgres(databaseUrl, { max: 1 });
  const db = drizzle(sql);
  try {
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
  } finally {
    await sql.end();
  }
}
