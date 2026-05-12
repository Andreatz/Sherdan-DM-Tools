// Helper condivisi per i test di integrazione DB/API. Pre-condizioni:
// - `DATABASE_URL` punta a un database Postgres dedicato ai test.
//   Default per setup locale: postgres://sherdan:sherdan_dev@localhost:5432/sherdan_dm_test.
//   In CI viene impostato dal workflow.
// - `pg_trgm` e `vector` extensions sono disponibili (vedi
//   docker/postgres/init/01-extensions.sql + migration 0000).
//
// Le migrations vengono applicate una sola volta per processo (idempotente).
// Tra un test e l'altro `truncateAll()` svuota le tabelle utente, lasciando
// `__drizzle_migrations` intatta.

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { NextRequest } from "next/server";
import postgres from "postgres";
import { beforeAll, beforeEach } from "vitest";

import * as schema from "@/db/schema";

let migrationsApplied = false;

// Postgres client esplicito (non condiviso col `src/db/client.ts` runtime)
// cosi' i test non interferiscono col pool dell'app.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "Test integrazione richiedono DATABASE_URL impostato (es. nel .env locale o nel workflow CI).",
  );
}

export const testSql = postgres(databaseUrl, { max: 4 });
export const testDb = drizzle(testSql, { schema });

export async function applyMigrations(): Promise<void> {
  if (migrationsApplied) return;
  await migrate(testDb, { migrationsFolder: "./src/db/migrations" });
  migrationsApplied = true;
}

// Svuota tutte le tabelle utente con TRUNCATE ... RESTART IDENTITY CASCADE.
// Recupera l'elenco delle tabelle a runtime cosi' nuove migration sono
// catturate automaticamente. Esclude `__drizzle_migrations` per non
// ri-applicare le migration tra i test.
export async function truncateAll(): Promise<void> {
  const rows = await testDb.execute<{ tablename: string }>(sql`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '\\_\\_drizzle\\_%' ESCAPE '\\'
  `);
  const tables = rows
    .map((r) => `"${r.tablename}"`)
    .join(", ");
  if (!tables) return;
  await testDb.execute(
    sql.raw(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`),
  );
}

// Setup conveniente per ogni test file: applica migrations una volta
// e svuota le tabelle prima di ogni test. Usalo come:
//   import { beforeAll, beforeEach } from "vitest";
//   import { setupIntegrationDb } from "./_helpers";
//   setupIntegrationDb();
export function setupIntegrationDb() {
  beforeAll(async () => {
    await applyMigrations();
  });

  beforeEach(async () => {
    await truncateAll();
  });
}

// Costruisce un NextRequest per chiamare un route handler in-process. Le
// route Next esportano `GET/POST/PATCH/DELETE(req, ctx?)` che accettano
// `NextRequest`; questo helper crea il request, serializza il body JSON
// e propaga i cookie/headers richiesti.

export interface MakeRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
}

export function makeRequest(
  url: string,
  options: MakeRequestOptions = {},
): NextRequest {
  const headers = new Headers({
    "content-type": "application/json",
    ...options.headers,
  });
  if (options.cookies && Object.keys(options.cookies).length > 0) {
    const cookieHeader = Object.entries(options.cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
    headers.set("cookie", cookieHeader);
  }
  return new NextRequest(`http://localhost${url}`, {
    method: options.method ?? "GET",
    headers,
    body:
      options.body === undefined
        ? undefined
        : typeof options.body === "string"
          ? options.body
          : JSON.stringify(options.body),
  });
}

// Helper per leggere il body JSON di una NextResponse.
export async function readJson<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

// Estrae il valore del cookie firmato (sherdan_player_access) dalla
// `Set-Cookie` di una NextResponse. Ritorna `null` se assente.
export function extractPlayerCookie(res: Response): string | null {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return null;
  const match = /sherdan_player_access=([^;]+)/.exec(setCookie);
  return match?.[1] ?? null;
}
