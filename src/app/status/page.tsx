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

// Vocabolario unico per status sidebar/status-page/README:
// - Pronto: feature usabile end-to-end, UI inclusa.
// - Beta: usabile ma con rifiniture o limitazioni note.
// - Schema: DB/API predisposti, UI dedicata ancora da costruire.
// - Pianificato: non iniziato.
// - Bloccato: volontariamente fermo finche' una precondizione non e' soddisfatta.
const featureRows = [
  ["Project foundation", "Pronto", "Setup, DB, schema, CI e app shell."],
  ["Campaign Wiki", "Pronto", "CRUD entita', identita', segreti, link e PC hooks."],
  ["Sherdan import", "Pronto", "Parser e import idempotente dei sorgenti markdown privati."],
  ["Random Tables", "Pronto", "Roller, import, subtabelle, template e workbench UI."],
  ["Sessioni", "Pronto", "Lista, recap rendered, toggle DM notes, prep notes, plot/briciole per sessione."],
  ["Plot Thread Tracker", "Pronto", "Kanban hot/warm/cold/resolved/abandoned, split-screen GM vs percepito, timeline, stale alerts."],
  ["Truth Clue Tracker", "Pronto", "CRUD briciole, filtri, plant/update status, dashboard verita' rivelata per thread."],
  ["NPC Generator", "Pronto", "Preview, re-roll parziale, salvataggio entity, embedding fail-forward + script backfill, link 'Storico generazioni LLM' nella entity detail."],
  ["Loot Generator", "Pronto", "Generator, link a encounter e sessione, lista bundles per campagna/sessione/encounter."],
  ["Encounter Builder", "Pronto", "Browser mostri, CR calculator, LLM assist, used_in_session, filtri list (sessione/location/plot)."],
  ["Generation log", "Pronto", "Audit di ogni chiamata LLM (input/prompt/output/latency/status) su generation_log."],
  ["Player Dashboard", "Pronto", "Per-player, realtime, scena live, handout/mappa/fog, policy entity granulari e push WebSocket."],
  ["Session Prep Assistant", "Pronto", "Agent LLM con 6 tool read-only (entities/plot/sessioni/identita'/truth-progress/pc-hooks), output strutturato + accept granulare: ogni briciola/NPC/encounter/hook accettato diventa record reale (truth_clue, entity stub dm_only, encounter draft, pc_hook). Streaming e tool generate_* rinviati a slice 3."],
  ["Rules Lookup", "Pronto", "Hybrid search + Q&A con citazioni cliccabili e shortcut globale."],
  ["Procedural Dungeon Generator", "Pronto", "Layout BSP, contenuto LLM per stanza, re-roll e salvataggio nel Wiki."],
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
          Operativo · vocabolario stato unificato
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Stato progetto
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Pannello operativo per verificare a colpo d&apos;occhio sicurezza dei contenuti,
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
          value={isSafeForPlayers ? "Pronto" : "Vietato"}
          tone={isSafeForPlayers ? "good" : "bad"}
          description={
            isSafeForPlayers
              ? "Codici per-player, cookie HMAC, rate limit, realtime signed-token e proiezioni player-safe."
              : "Sorgenti raw in public/: NON esporre il dashboard. Esegui pnpm content:check:safe."
          }
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
