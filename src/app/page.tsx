import Link from "next/link";

// Home / dashboard placeholder. In Fase 6 mostra ultime sessioni, plot
// thread caldi, briciole non ancora colte. In Fase 7 il prep assistant.
// Per ora: punto d'ingresso per le campagne e stato di avanzamento.
export default function HomePage() {
  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Sherdan DM Tools
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Piattaforma personale per il DM. Wiki, generators, plot tracker,
          session prep — tutto integrato sulla campagna Sherdan.
        </p>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">Inizia da qui</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Le campagne sono il contenitore principale: dentro vivono
          entita&apos;, sessioni, plot thread, briciole di verita&apos;.
        </p>
        <div className="mt-4">
          <Link
            href="/campaigns"
            className="inline-flex items-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Vai alle campagne
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Stato del progetto</h2>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Sei in <strong>Fase 0</strong>. La maggior parte dei tool nella
          sidebar e&apos; ancora un placeholder — cliccarli non fa nulla.
          L&apos;ordine di sblocco e&apos; in <code>ROADMAP.md</code>.
        </div>
      </section>
    </div>
  );
}
