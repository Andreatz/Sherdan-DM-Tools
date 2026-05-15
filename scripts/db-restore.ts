// pnpm db:restore -- <file.sql> → ripristina un dump prodotto da
// `pnpm db:backup`. Operazione DISTRUTTIVA: sovrascrive lo stato corrente
// del database. Lo script chiede conferma esplicita (env `CONFIRM=yes`)
// per evitare incidenti.
//
// Esempio:
//   CONFIRM=yes pnpm db:restore -- backups/sherdan-20260512-130000.sql

import "dotenv/config";

import { spawn } from "node:child_process";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";

import { env } from "@/lib/env";
import { getLogger } from "@/lib/logger";

const log = getLogger("db-restore");

const POSTGRES_CONTAINER =
  process.env.SHERDAN_POSTGRES_CONTAINER ?? "sherdan-postgres";
const databaseUrl = new URL(env.DATABASE_URL);
const DB_NAME = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
const DB_USER = decodeURIComponent(databaseUrl.username || env.POSTGRES_USER || "sherdan");

async function main() {
  const file = process.argv[2];
  if (!file) {
    log.error("Specifica il file dump: pnpm db:restore -- <file.sql>");
    process.exitCode = 1;
    return;
  }
  const fullPath = path.resolve(process.cwd(), file);
  if (!existsSync(fullPath)) {
    log.error({ fullPath }, "file dump non trovato");
    process.exitCode = 1;
    return;
  }
  const { size } = statSync(fullPath);
  if (process.env.CONFIRM !== "yes") {
    log.warn(
      { fullPath, size },
      "operazione distruttiva. Per procedere imposta CONFIRM=yes.",
    );
    process.exitCode = 2;
    return;
  }

  log.info(
    { fullPath, container: POSTGRES_CONTAINER, db: DB_NAME },
    "avvio psql restore",
  );

  // `docker exec` su container_name (non `docker compose exec`).
  const args = [
    "exec",
    "-i",
    POSTGRES_CONTAINER,
    "psql",
    "-U",
    DB_USER,
    "-d",
    DB_NAME,
    "-v",
    "ON_ERROR_STOP=1",
  ];
  const child = spawn("docker", args, {
    stdio: ["pipe", "inherit", "inherit"],
  });
  const reader = createReadStream(fullPath, { encoding: "utf8" });
  reader.pipe(child.stdin);

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (exitCode !== 0) {
    log.error({ exitCode }, "psql restore fallito (rollback non automatico)");
    process.exitCode = 1;
    return;
  }
  log.info("restore completato");
}

void main();
