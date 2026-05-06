import Link from "next/link";
import { notFound } from "next/navigation";

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { campaigns } from "@/db/schema";
import { getLogger } from "@/lib/logger";

const log = getLogger("page.campaign-detail");

interface PageProps {
  params: Promise<{ id: string }>;
}

// Detail page placeholder. In Fase 1 mostra le entita' della campagna,
// le sessioni recenti, i plot thread caldi. Per ora: header + sezioni
// vuote con etichette delle fasi che le riempiranno.
export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;

  let campaign: { id: string; name: string; description: string | null } | undefined;
  try {
    const rows = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        description: campaigns.description,
      })
      .from(campaigns)
      .where(eq(campaigns.id, id))
      .limit(1);
    campaign = rows[0];
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err), id },
      "fetch campaign failed",
    );
    throw err;
  }

  if (!campaign) {
    notFound();
  }

  return (
    <div className="space-y-10">
      <header className="space-y-3">
        <Link
          href="/campaigns"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Tutte le campagne
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          {campaign.name}
        </h1>
        {campaign.description && (
          <p className="text-zinc-600 dark:text-zinc-400">
            {campaign.description}
          </p>
        )}
      </header>

      <PlaceholderSection title="Entita'" comingIn="Fase 1" />
      <PlaceholderSection title="Sessioni" comingIn="Fase 6" />
      <PlaceholderSection title="Plot Threads" comingIn="Fase 6" />
      <PlaceholderSection title="Briciole di Verita'" comingIn="Fase 6" />
    </div>
  );
}

function PlaceholderSection({
  title,
  comingIn,
}: {
  title: string;
  comingIn: string;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <span className="text-xs uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          {comingIn}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
        In arrivo. Lo schema e&apos; gia&apos; pronto: appena la fase apre, la
        sezione si popola.
      </p>
    </section>
  );
}
