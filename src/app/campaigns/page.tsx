import Link from "next/link";

import { db } from "@/db/client";
import { campaigns } from "@/db/schema";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { getLogger } from "@/lib/logger";

// Niente prerendering al build: la lista cambia, vogliamo dati freschi
// ad ogni richiesta. In CI Postgres gira come service container, ma la pagina
// resta comunque dinamica per evitare dati stale.
export const dynamic = "force-dynamic";

const log = getLogger("page.campaigns");

interface CampaignSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

interface FetchResult {
  ok: true;
  rows: CampaignSummary[];
}

interface FetchError {
  ok: false;
  message: string;
}

async function fetchCampaigns(): Promise<FetchResult | FetchError> {
  try {
    const rows = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        description: campaigns.description,
        createdAt: campaigns.createdAt,
      })
      .from(campaigns)
      .orderBy(campaigns.createdAt);
    return { ok: true, rows };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message }, "fetch campaigns failed");
    return { ok: false, message };
  }
}

export default async function CampaignsPage() {
  const result = await fetchCampaigns();

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Canon workspace" title="Campagne">
        Una campagna e&apos; il contenitore principale: dentro vivono entita,
        sessioni, plot thread, briciole di verita e player-facing state.
      </PageHeader>

      {result.ok ? (
        result.rows.length === 0 ? (
          <CampaignEmptyState />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {result.rows.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/campaigns/${c.id}`}
                  className="surface block rounded-lg p-5 transition-colors hover:border-[var(--accent)]"
                >
                  <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                    {c.name}
                  </h2>
                  {c.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-[var(--muted)]">
                      {c.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs font-medium uppercase tracking-[0.12em] text-[var(--muted)]">
                    Creata il {c.createdAt.toLocaleDateString("it-IT")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <ErrorState message={result.message} />
      )}
    </div>
  );
}

function CampaignEmptyState() {
  return (
    <EmptyState title="Nessuna campagna ancora">
      <p>
        Esegui <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5">pnpm db:seed</code>{" "}
        per creare la campagna Sherdan vuota, oppure{" "}
        <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5">pnpm db:bootstrap:sherdan</code>{" "}
        dopo aver migrato i sorgenti in{" "}
        <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5">content/sherdan/</code>.
      </p>
    </EmptyState>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <Panel className="border-red-300 bg-red-50 p-6 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      <h2 className="text-base font-semibold">Errore di connessione al DB</h2>
      <p className="mt-2">
        Verifica che il container Postgres sia attivo:{" "}
        <code className="rounded bg-red-100 px-1.5 py-0.5 dark:bg-red-900/40">
          docker compose up -d
        </code>
      </p>
      <pre className="mt-3 overflow-x-auto rounded bg-red-100 p-2 text-xs dark:bg-red-900/40">
        {message}
      </pre>
    </Panel>
  );
}
