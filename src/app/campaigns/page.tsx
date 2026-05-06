import Link from "next/link";

import { db } from "@/db/client";
import { campaigns } from "@/db/schema";
import { getLogger } from "@/lib/logger";

// Niente prerendering al build: la lista cambia, vogliamo dati freschi
// ad ogni richiesta. Inoltre questo evita che `next build` tenti di
// connettersi al DB in CI (dove Postgres non gira).
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
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Campagne</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          Una campagna e&apos; il contenitore principale: dentro vivono
          entita&apos;, sessioni, plot thread, briciole di verita&apos;.
        </p>
      </header>

      {result.ok ? (
        result.rows.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {result.rows.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/campaigns/${c.id}`}
                  className="block rounded-lg border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  <h2 className="text-lg font-semibold">{c.name}</h2>
                  {c.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {c.description}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
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

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold">Nessuna campagna ancora</h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        La creazione di campagne arriva in <strong>Fase 1</strong> insieme al
        Wiki. Per ora, lo schema DB e&apos; pronto e questa pagina la
        leggera&apos; non appena ci saranno righe.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 p-6 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
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
    </div>
  );
}
