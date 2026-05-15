import "dotenv/config";

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { env } from "@/lib/env";

import { getDatabaseName, isSafeTestDatabaseName } from "./_test-db-url";

function runPnpm(
  args: string[],
  extraEnv: Record<string, string | undefined> = {},
): Promise<void> {
  const childEnv = {
    NODE_ENV: process.env.NODE_ENV ?? "test",
    ...Object.fromEntries(
    Object.entries({ ...process.env, ...extraEnv }).filter(
      (entry): entry is [string, string] => {
        const [key, value] = entry;
        return key.length > 0 && !key.startsWith("=") && value !== undefined;
      },
    ),
    ),
  };
  return new Promise((resolve, reject) => {
    const child: ChildProcess =
      process.platform === "win32"
        ? spawn(
            process.env.ComSpec ?? "cmd.exe",
            ["/d", "/s", "/c", ["pnpm", ...args].join(" ")],
            { env: childEnv, stdio: "inherit" },
          )
        : spawn("pnpm", args, { env: childEnv, stdio: "inherit" });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`pnpm ${args.join(" ")} terminated by ${signal}`));
        return;
      }
      if (code && code !== 0) {
        reject(new Error(`pnpm ${args.join(" ")} exited with code ${code}`));
        return;
      }
      resolve();
    });
  });
}

function latestBackupFile(root: string, afterMs: number): string {
  const backupsDir = path.join(root, "backups");
  if (!existsSync(backupsDir)) {
    throw new Error("Directory backups/ non trovata dopo db:backup.");
  }

  const candidates = readdirSync(backupsDir)
    .filter((file) => /^sherdan-\d{8}-\d{6}\.sql$/.test(file))
    .map((file) => {
      const fullPath = path.join(backupsDir, file);
      return { fullPath, stats: statSync(fullPath) };
    })
    .filter(({ stats }) => stats.size > 0 && stats.mtimeMs >= afterMs)
    .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

  const latest = candidates[0];
  if (!latest) {
    throw new Error("Nessun nuovo backup SQL non vuoto trovato.");
  }
  return path.relative(root, latest.fullPath);
}

async function main() {
  const dbName = getDatabaseName(env.DATABASE_URL);
  if (!isSafeTestDatabaseName(dbName)) {
    throw new Error(
      `db:backup:smoke rifiuta database non test: "${dbName}". Usa pnpm db:backup:smoke.`,
    );
  }

  const sql = postgres(env.DATABASE_URL, { max: 1, onnotice: () => undefined });
  const db = drizzle(sql);
  try {
    await migrate(db, { migrationsFolder: "./src/db/migrations" });
    await sql`DROP TABLE IF EXISTS backup_restore_smoke`;
    await sql`CREATE TABLE backup_restore_smoke (id int primary key, marker text not null)`;
    await sql`INSERT INTO backup_restore_smoke (id, marker) VALUES (1, 'before-restore')`;
  } finally {
    await sql.end();
  }

  const startedAt = Date.now() - 1000;
  await runPnpm(["db:backup"]);
  const backupFile = latestBackupFile(process.cwd(), startedAt);

  const mutateSql = postgres(env.DATABASE_URL, {
    max: 1,
    onnotice: () => undefined,
  });
  try {
    await mutateSql`UPDATE backup_restore_smoke SET marker = 'after-backup' WHERE id = 1`;
  } finally {
    await mutateSql.end();
  }

  await runPnpm(["db:restore", backupFile], { CONFIRM: "yes" });

  const verifySql = postgres(env.DATABASE_URL, {
    max: 1,
    onnotice: () => undefined,
  });
  try {
    const [row] = await verifySql<{ marker: string }[]>`
      SELECT marker FROM backup_restore_smoke WHERE id = 1
    `;
    if (row?.marker !== "before-restore") {
      throw new Error(
        `Restore smoke fallito: marker atteso "before-restore", ricevuto "${row?.marker ?? "missing"}".`,
      );
    }
  } finally {
    await verifySql`DROP TABLE IF EXISTS backup_restore_smoke`;
    await verifySql.end();
  }

  console.log(`[ok] Backup/restore smoke completato su ${dbName}`);
  console.log(`backup: ${backupFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
