import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import postgres from "postgres";

import { Badge, PageHeader, Panel } from "@/components/ui";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

const SHERDAN_SOURCE_FILES = [
  "NPC.md",
  "Fazioni.md",
  "Lore.md",
  "Campagna.md",
  "Background Personaggi.md",
  "Manuale del Giocatore.md",
  "Agente AI Worldbuilding.md",
] as const;

const featureRows = [
  ["Foundation progetto", "Pronto", "Next.js, TypeScript, Postgres, Drizzle, Zod, logging ed env check."],
  ["Campaign Wiki", "Pronto", "CRUD entita, identita, segreti, link, tag e PC hooks."],
  ["Grafo entita", "Pronto", "Visualizzazione relazioni con pan/zoom."],
  ["Import Sherdan", "Pronto", "Parser e bootstrap idempotente da content/sherdan/."],
  ["Content safety gate", "Pronto", "Blocca markdown Sherdan raw in public/."],
  ["Random Tables Engine", "Pronto", "CRUD, import, roll, subtabelle, template e history."],
  ["Sessioni", "Pronto", "Lista, recap, DM notes, prep notes, plot e briciole per sessione."],
  ["Plot Thread Tracker", "Pronto", "Kanban, split GM/pubblico, timeline e stale alerts."],
  ["Truth Clue Tracker", "Pronto", "Briciole filtrabili, status, verita rivelata e sessioni."],
  ["Player Dashboard", "Pronto", "Accesso per-player, cookie firmato, API player-safe e realtime."],
  ["Session Run Mode", "Pronto", "Vista da tavolo con scena live, iniziativa, thread hot/warm, briciole e copy-for-ChatGPT."],
  ["Rules Lookup", "Pronto", "Search ibrida RRF, citazioni, corpus homebrew/SRD e Q&A opzionale."],
  ["Procedural Dungeon Generator", "Pronto / Opzionale", "Layout BSP deterministico; contenuto LLM opzionale."],
  ["ChatGPT Web Bridge", "Pronto", "Export/import manuale, Update Pack, review & apply."],
  ["Contradiction Detector", "Pronto", "Audit deterministico di nomi, alias, relazioni, visibilita e stato trama."],
  ["NPC Generator", "Opzionale", "Richiede LLM server-side se usato come generatore automatico."],
  ["Loot Generator", "Opzionale", "Richiede LLM server-side per generazione automatica."],
  ["Encounter Builder", "Pronto / Opzionale", "Browser/CR calculator pronto; assist LLM opzionale."],
  ["Session Prep Assistant LLM", "Opzionale", "Sostituito nel workflow consigliato dal ChatGPT Web Bridge."],
  ["Combat Tracker runtime", "Pronto", "Iniziativa, round, HP/note e push live al Player Dashboard."],
  ["Matrice conoscenza PNG", "Pronto", "Matrice player x target basata su visibilita base e override individuali."],
  ["Spoiler Gate / Reveal Tracker", "Pronto", "Dashboard reveal per briciole, segreti stratificati e override per-player."],
] as const;

interface DatabaseStatus {
  ok: boolean;
  databaseName: string;
  migrationCount: number | null;
  publicTableCount: number | null;
  message: string;
}

interface BackupStatus {
  filename: string | null;
  sizeBytes: number | null;
  updatedAt: Date | null;
}

export default async function StatusPage() {
  const root = process.cwd();
  const privateDir = path.join(root, "content", "sherdan");
  const publicDir = path.join(root, "public");
  const privateFiles = SHERDAN_SOURCE_FILES.filter((file) =>
    existsSync(path.join(privateDir, file)),
  );
  const publicFiles = SHERDAN_SOURCE_FILES.filter((file) =>
    existsSync(path.join(publicDir, file)),
  );
  const missingPrivateFiles = SHERDAN_SOURCE_FILES.filter(
    (file) => !privateFiles.includes(file),
  );
  const isSafeForPlayers = publicFiles.length === 0;
  const [databaseStatus, backupStatus] = await Promise.all([
    getDatabaseStatus(),
    getLatestBackup(root),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Operativo · readiness locale"
        title="Stato progetto"
      >
        Pannello operativo per verificare sicurezza dei contenuti, database,
        migration, backup, LLM mode e blocchi prima di qualunque esposizione
        player-facing.
      </PageHeader>

      <section className="grid gap-4 lg:grid-cols-4">
        <StatusCard
          title="Database"
          value={databaseStatus.ok ? "Connesso" : "Errore"}
          tone={databaseStatus.ok ? "good" : "bad"}
          description={databaseStatus.message}
        />
        <StatusCard
          title="Migration"
          value={
            databaseStatus.migrationCount === null
              ? "n/d"
              : String(databaseStatus.migrationCount)
          }
          tone={databaseStatus.migrationCount === null ? "warn" : "good"}
          description={`${databaseStatus.publicTableCount ?? 0} tabelle public rilevate.`}
        />
        <StatusCard
          title="LLM mode"
          value={env.LLM_PROVIDER}
          tone={env.LLM_PROVIDER === "none" ? "good" : "warn"}
          description={
            env.LLM_PROVIDER === "none"
              ? "Bridge manuale attivo; nessuna API LLM richiesta."
              : "Provider server-side abilitato per tool opzionali."
          }
        />
        <StatusCard
          title="Ultimo backup"
          value={backupStatus.filename ? "Trovato" : "Assente"}
          tone={backupStatus.filename ? "good" : "warn"}
          description={
            backupStatus.filename
              ? `${backupStatus.filename} · ${formatBytes(backupStatus.sizeBytes ?? 0)}`
              : "Esegui pnpm db:backup prima di sessioni importanti."
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <StatusCard
          title="Sorgenti privati"
          value={`${privateFiles.length}/${SHERDAN_SOURCE_FILES.length}`}
          tone={privateFiles.length === SHERDAN_SOURCE_FILES.length ? "good" : "warn"}
          description="File markdown Sherdan trovati in content/sherdan/."
        />
        <StatusCard
          title="Leak public/"
          value={publicFiles.length === 0 ? "0" : String(publicFiles.length)}
          tone={isSafeForPlayers ? "good" : "bad"}
          description={
            isSafeForPlayers
              ? "Nessun sorgente Sherdan raw trovato in public/."
              : "Sorgenti raw ancora esposti come asset statici."
          }
        />
        <StatusCard
          title="Realtime"
          value="/api/realtime"
          tone="good"
          description="WebSocket su custom server con token firmato player-facing."
        />
      </section>

      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Sicurezza contenuti
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              I sorgenti Sherdan raw contengono segreti GM-only. Devono restare
              fuori da public/.
            </p>
          </div>
          <code className="rounded-md bg-[var(--surface-muted)] px-2 py-1 text-xs text-[var(--muted)]">
            pnpm content:check:safe
          </code>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <FileList
            title="content/sherdan/"
            files={privateFiles}
            empty="Nessun file privato trovato."
          />
          <FileList
            title="public/"
            files={publicFiles}
            empty="Nessun file raw esposto."
            danger={publicFiles.length > 0}
          />
        </div>

        {missingPrivateFiles.length > 0 && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            Mancano in content/sherdan/: {missingPrivateFiles.join(", ")}
          </div>
        )}
      </Panel>

      <Panel className="overflow-hidden">
        <div className="border-b border-[var(--border)] p-5">
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Stato feature
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-[var(--surface-muted)] text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Stato</th>
                <th className="px-4 py-3">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {featureRows.map(([area, status, note]) => (
                <tr key={area} className="hover:bg-[var(--surface-muted)]/60">
                  <td className="px-4 py-3 font-medium text-zinc-950 dark:text-zinc-100">
                    {area}
                  </td>
                  <td className="px-4 py-3">
                    <FeatureBadge status={status} />
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

async function getDatabaseStatus(): Promise<DatabaseStatus> {
  const databaseName = getDatabaseName(env.DATABASE_URL);
  const sql = postgres(env.DATABASE_URL, { max: 1, onnotice: () => undefined });
  try {
    const [row] = await sql<
      { public_table_count: number; migration_count: number | null }[]
    >`
      SELECT
        (SELECT count(*)::int FROM information_schema.tables WHERE table_schema = 'public') AS public_table_count,
        (SELECT count(*)::int FROM drizzle.__drizzle_migrations) AS migration_count
    `;
    return {
      ok: true,
      databaseName,
      publicTableCount: row?.public_table_count ?? null,
      migrationCount: row?.migration_count ?? null,
      message: `${databaseName} raggiungibile.`,
    };
  } catch (err) {
    return {
      ok: false,
      databaseName,
      publicTableCount: null,
      migrationCount: null,
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    await sql.end();
  }
}

async function getLatestBackup(root: string): Promise<BackupStatus> {
  const backupsDir = path.join(root, "backups");
  if (!existsSync(backupsDir)) {
    return { filename: null, sizeBytes: null, updatedAt: null };
  }
  const candidates = readdirSync(backupsDir)
    .filter((file) => /^sherdan-\d{8}-\d{6}\.sql$/.test(file))
    .map((file) => {
      const stats = statSync(path.join(backupsDir, file));
      return { file, stats };
    })
    .filter(({ stats }) => stats.size > 0)
    .sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);
  const latest = candidates[0];
  if (!latest) return { filename: null, sizeBytes: null, updatedAt: null };
  return {
    filename: latest.file,
    sizeBytes: latest.stats.size,
    updatedAt: latest.stats.mtime,
  };
}

function getDatabaseName(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  return decodeURIComponent(url.pathname.replace(/^\//, "")) || "unknown";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function FeatureBadge({ status }: { status: string }) {
  const tone =
    status === "Pronto"
      ? "success"
      : status === "Opzionale"
        ? "info"
        : status === "Pronto / Opzionale"
          ? "accent"
          : status === "Beta"
            ? "warning"
            : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}

function StatusCard({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  tone: "good" | "warn" | "bad";
}) {
  const toneClassName = {
    good: "text-[var(--success)]",
    warn: "text-[var(--warning)]",
    bad: "text-[var(--danger)]",
  }[tone];

  return (
    <Panel className="p-5">
      <p className="text-sm font-medium text-[var(--muted)]">{title}</p>
      <p className={`mt-2 truncate text-2xl font-semibold ${toneClassName}`}>
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
    </Panel>
  );
}

function FileList({
  title,
  files,
  empty,
  danger = false,
}: {
  title: string;
  files: readonly string[];
  empty: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
      <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
        {title}
      </h3>
      {files.length === 0 ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {files.map((file) => (
            <li
              key={file}
              className={danger ? "text-[var(--danger)]" : "text-[var(--muted)]"}
            >
              {file}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
