// pnpm db:backup → dump completo del DB Postgres in backups/.
//
// Strategia: spawniamo `pg_dump` direttamente dal container Docker
// `sherdan-postgres` via `docker compose exec`, cosi' funziona anche
// quando l'utente non ha `pg_dump` installato lato host. Il dump e'
// scritto come SQL plain (`-Fp`) cosi' resta auditabile/diffabile e si
// puo' ripristinare con un semplice `psql -f`.
//
// Output file: backups/sherdan-YYYYMMDD-HHMMSS.sql

import "dotenv/config";

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, createWriteStream } from "node:fs";
import path from "node:path";

import { env } from "@/lib/env";
import { getLogger } from "@/lib/logger";

const log = getLogger("db-backup");

const POSTGRES_CONTAINER =
  process.env.SHERDAN_POSTGRES_CONTAINER ?? "sherdan-postgres";
const databaseUrl = new URL(env.DATABASE_URL);
const DB_NAME = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ""));
const DB_USER = decodeURIComponent(databaseUrl.username || env.POSTGRES_USER || "sherdan");

async function main() {
  const backupsDir = path.join(process.cwd(), "backups");
  if (!existsSync(backupsDir)) {
    mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..*$/, "")
    .replace("T", "-");
  const outFile = path.join(backupsDir, `sherdan-${timestamp}.sql`);

  log.info(
    { container: POSTGRES_CONTAINER, db: DB_NAME, outFile },
    "avvio pg_dump",
  );

  // `docker exec` su container_name (non `docker compose exec` su service)
  // cosi' funziona anche se chi ha clonato il repo lancia docker fuori
  // dalla cartella del progetto.
  const args = [
    "exec",
    "-i",
    POSTGRES_CONTAINER,
    "pg_dump",
    "-U",
    DB_USER,
    "-d",
    DB_NAME,
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-privileges",
  ];

  const child = spawn("docker", args, { stdio: ["ignore", "pipe", "inherit"] });
  const writer = createWriteStream(outFile, { encoding: "utf8" });

  let bytes = 0;
  child.stdout.on("data", (chunk: Buffer) => {
    bytes += chunk.length;
  });
  child.stdout.pipe(writer);

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  writer.end();
  await new Promise<void>((resolve) => writer.on("finish", () => resolve()));

  if (exitCode !== 0) {
    log.error({ exitCode, outFile }, "pg_dump fallito");
    process.exitCode = 1;
    return;
  }

  log.info({ outFile, bytes }, "backup completato");
  process.stdout.write(`${outFile}\n`);
}

void main();
