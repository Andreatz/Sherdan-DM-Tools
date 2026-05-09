import { existsSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const SHERDAN_SOURCE_FILES = [
  "NPC.md",
  "Fazioni.md",
  "Lore.md",
  "Campagna.md",
  "Background Personaggi.md",
  "Manuale del Giocatore.md",
] as const;

const featureRows = [
  ["Project foundation", "Pronto", "Setup, DB, schema, CI e app shell."],
  ["Campaign Wiki", "Pronto", "CRUD entità, identità, segreti, link e PC hooks."],
  ["Sherdan import", "Pronto", "Parser e import idempotente dei sorgenti markdown privati."],
  ["Random Tables", "Pronto", "Roller, import, subtabelle, template e workbench UI."],
  ["Generator Framework", "Beta", "NPC/Loot/Encounter sono utilizzabili ma ancora da rifinire."],
  ["Plot + Truth Clues", "Schema", "Schema dati pronto; UI dedicata pianificata."],
  ["Session Prep", "Pianificato", "Assistente da costruire su sessioni, thread, clues e hooks."],
  ["Player Dashboard", "Bloccato", "Serve proiezione player-safe + access gate prima di esporlo."],
] as const;

const statusClassName: Record<string, string> = {
  Pronto: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300",
  Beta: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300",
  Schema: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-300",
  Pianificato: "bg-zinc-100 text-zinc-700 ring-zinc-600/20 dark:bg-zinc-800 dark:text-zinc-300",
  Bloccato: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950 dark:text-red-300",
};

export default function StatusPage() {
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

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Fase 0 / Fase 1
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Stato progetto
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Pannello operativo per verificare a colpo d'occhio sicurezza dei contenuti,
          stato reale delle feature e blocchi prima di qualunque esposizione player-facing.
        </p>
      </header>

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
          title="Player Dashboard"
          value={isSafeForPlayers ? "Bloccato" : "Vietato"}
          tone="bad"
          description="Da sbloccare solo dopo proiezione player-safe e access gate."
        />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Sicurezza contenuti
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              I sorgenti Sherdan raw contengono segreti GM-only. Devono restare fuori da public/.
            </p>
          </div>
          <code className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            pnpm content:check:safe
          </code>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <FileList title="content/sherdan/" files={privateFiles} empty="Nessun file privato trovato." />
          <FileList title="public/" files={publicFiles} empty="Nessun file raw esposto." danger={publicFiles.length > 0} />
        </div>

        {missingPrivateFiles.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            Mancano in content/sherdan/: {missingPrivateFiles.join(", ")}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
          Stato feature
        </h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Stato</th>
                <th className="px-4 py-3">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {featureRows.map(([area, status, note]) => (
                <tr key={area}>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {area}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusClassName[status]}`}
                    >
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
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
    good: "text-emerald-700 dark:text-emerald-300",
    warn: "text-amber-700 dark:text-amber-300",
    bad: "text-red-700 dark:text-red-300",
  }[tone];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</p>
      <p className={`mt-2 text-3xl font-semibold ${toneClassName}`}>{value}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
    </div>
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
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      {files.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {files.map((file) => (
            <li
              key={file}
              className={
                danger
                  ? "text-red-700 dark:text-red-300"
                  : "text-zinc-700 dark:text-zinc-300"
              }
            >
              {file}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
