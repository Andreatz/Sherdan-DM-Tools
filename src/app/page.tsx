import Link from "next/link";

import { ButtonLink, Panel } from "@/components/ui";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <Panel raised className="overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[var(--surface-muted)] px-6 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            Local-first campaign command center
          </p>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-[1.35fr_0.65fr] lg:p-8">
          <div>
            <h1 className="text-4xl font-semibold text-zinc-950 dark:text-zinc-50">
              Sherdan DM Tools
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--muted)]">
              Wiki canonica, sessioni, plot tracker, player dashboard e Bridge
              ChatGPT in un workspace unico per preparare e condurre la
              campagna Sherdan.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink
                href="/chatgpt-bridge"
                variant="primary"
              >
                Apri ChatGPT Bridge
              </ButtonLink>
              <ButtonLink href="/session-run" variant="secondary">
                Vai al tavolo
              </ButtonLink>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <Metric label="Feature pronte" value="18+" />
            <Metric label="Unit test" value="402" />
            <Metric label="Modalita LLM" value="none/API" />
          </div>
        </div>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-3">
        <HomeCard
          title="Canon"
          text="Entita, identita, segreti, link e hook PG in un archivio strutturato."
          href="/campaigns"
          cta="Apri campagne"
        />
        <HomeCard
          title="Preparazione"
          text="Sessioni, plot thread, truth clues e contradiction detector per tenere il filo."
          href="/sessions"
          cta="Apri sessioni"
        />
        <HomeCard
          title="Tavolo"
          text="Session run mode, combat tracker, reveal tracker e dashboard player-safe."
          href="/player"
          cta="Apri dashboard"
        />
      </section>

      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
              Stato operativo
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Build, lint, typecheck, test unitari, integration local ed E2E
              local sono il percorso di verifica consigliato.
            </p>
          </div>
          <ButtonLink href="/status" variant="secondary" size="sm">
            Vedi status
          </ButtonLink>
        </div>
      </Panel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

function HomeCard({
  title,
  text,
  href,
  cta,
}: {
  title: string;
  text: string;
  href: string;
  cta: string;
}) {
  return (
    <Panel className="p-5">
      <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-[var(--muted)]">
        {text}
      </p>
      <Link
        href={href}
        className="mt-4 inline-flex text-sm font-semibold text-[var(--accent)] hover:underline"
      >
        {cta}
      </Link>
    </Panel>
  );
}
