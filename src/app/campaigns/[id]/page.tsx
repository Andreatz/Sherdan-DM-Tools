import Link from "next/link";
import { notFound } from "next/navigation";

import { type SQL, and, asc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { campaigns, entities, entityType } from "@/db/schema";
import { getLogger } from "@/lib/logger";

const log = getLogger("page.campaign-detail");

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

type EntityType = (typeof entityType.enumValues)[number];
type Visibility = "dm_only" | "discovered" | "public";

interface EntityListFilters {
  type?: EntityType;
  tag?: string;
  search?: string;
}

interface CampaignEntityRow {
  id: string;
  type: EntityType;
  name: string;
  publicDescription: string | null;
  tags: string[];
  visibility: Visibility;
  updatedAt: Date;
}

const TYPE_LABELS: Record<EntityType, string> = {
  npc: "NPC",
  pc: "PG",
  location: "Luogo",
  faction: "Fazione",
  item: "Oggetto",
  monster: "Mostro",
  deity: "Divinita'",
  organization: "Organizzazione",
};

const VISIBILITY_LABELS: Record<Visibility, string> = {
  dm_only: "DM",
  discovered: "Scoperta",
  public: "Pubblica",
};

const VISIBILITY_CLASSES: Record<Visibility, string> = {
  dm_only:
    "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  discovered:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  public:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
};

const ENTITY_TYPE_OPTIONS = entityType.enumValues;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(
  searchParams: Record<string, string | string[] | undefined>,
): EntityListFilters {
  const rawType = firstParam(searchParams.type);
  const type = ENTITY_TYPE_OPTIONS.includes(rawType as EntityType)
    ? (rawType as EntityType)
    : undefined;
  const tag = firstParam(searchParams.tag)?.trim() || undefined;
  const search = firstParam(searchParams.search)?.trim() || undefined;
  return { type, tag, search };
}

function buildEntityHref(campaignId: string, filters: EntityListFilters) {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.search) params.set("search", filters.search);
  const query = params.toString();
  return query ? `/campaigns/${campaignId}?${query}` : `/campaigns/${campaignId}`;
}

async function fetchCampaignEntities(
  campaignId: string,
  filters: EntityListFilters,
): Promise<CampaignEntityRow[]> {
  const conditions: SQL[] = [eq(entities.campaignId, campaignId)];

  if (filters.type) conditions.push(eq(entities.type, filters.type));
  if (filters.tag) {
    conditions.push(sql`${filters.tag} = ANY(${entities.tags})`);
  }
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    const searchCondition = or(
      ilike(entities.name, pattern),
      ilike(entities.description, pattern),
      ilike(entities.publicDescription, pattern),
    );
    if (searchCondition) conditions.push(searchCondition);
  }

  return db
    .select({
      id: entities.id,
      type: entities.type,
      name: entities.name,
      publicDescription: entities.publicDescription,
      tags: entities.tags,
      visibility: entities.visibility,
      updatedAt: entities.updatedAt,
    })
    .from(entities)
    .where(and(...conditions))
    .orderBy(asc(entities.name))
    .limit(200);
}

async function fetchCampaignTags(campaignId: string): Promise<string[]> {
  const rows = await db
    .select({ tags: entities.tags })
    .from(entities)
    .where(eq(entities.campaignId, campaignId));

  return Array.from(new Set(rows.flatMap((row) => row.tags))).sort((a, b) =>
    a.localeCompare(b, "it-IT"),
  );
}

export default async function CampaignDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const filters = parseFilters((await searchParams) ?? {});

  let campaign: { id: string; name: string; description: string | null } | undefined;
  let campaignEntities: CampaignEntityRow[] = [];
  let allTags: string[] = [];

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

    if (campaign) {
      [campaignEntities, allTags] = await Promise.all([
        fetchCampaignEntities(id, filters),
        fetchCampaignTags(id),
      ]);
    }
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
          &larr; Tutte le campagne
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

      <EntityListSection
        campaignId={campaign.id}
        entities={campaignEntities}
        filters={filters}
        allTags={allTags}
      />
      <PlaceholderSection title="Sessioni" comingIn="Fase 6" />
      <PlaceholderSection title="Plot Threads" comingIn="Fase 6" />
      <PlaceholderSection title="Briciole di Verita'" comingIn="Fase 6" />
    </div>
  );
}

function EntityListSection({
  campaignId,
  entities: rows,
  filters,
  allTags,
}: {
  campaignId: string;
  entities: CampaignEntityRow[];
  filters: EntityListFilters;
  allTags: string[];
}) {
  const hasActiveFilters = Boolean(filters.type || filters.tag || filters.search);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Entita&apos;</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {rows.length} risultat{rows.length === 1 ? "o" : "i"} nel wiki
            della campagna.
          </p>
        </div>
        {hasActiveFilters && (
          <Link
            href={`/campaigns/${campaignId}`}
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Pulisci filtri
          </Link>
        )}
      </div>

      <form
        action={`/campaigns/${campaignId}`}
        className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-[minmax(0,1fr)_160px_180px_auto]"
      >
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Cerca
          </span>
          <input
            name="search"
            defaultValue={filters.search ?? ""}
            placeholder="Nome, verita' GM o versione pubblica"
            className="h-10 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:bg-zinc-900"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Tipo
          </span>
          <select
            name="type"
            defaultValue={filters.type ?? ""}
            className="h-10 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:bg-zinc-900"
          >
            <option value="">Tutti</option>
            {ENTITY_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Tag
          </span>
          <select
            name="tag"
            defaultValue={filters.tag ?? ""}
            className="h-10 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:bg-zinc-900"
          >
            <option value="">Tutti</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          className="h-10 self-end rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
        >
          Filtra
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-8 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {hasActiveFilters
            ? "Nessuna entita' corrisponde ai filtri correnti."
            : "Nessuna entita' ancora. Il seed Sherdan e il bootstrap popoleranno questa lista."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full table-fixed divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
            <thead className="bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="w-[32%] px-4 py-3">Nome</th>
                <th className="w-[13%] px-4 py-3">Tipo</th>
                <th className="w-[14%] px-4 py-3">Visibilita&apos;</th>
                <th className="px-4 py-3">Tag</th>
                <th className="w-[16%] px-4 py-3 text-right">Aggiornata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rows.map((entity) => (
                <tr
                  key={entity.id}
                  className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={`/campaigns/${campaignId}?focus=${entity.id}`}
                      className="font-medium text-zinc-900 hover:text-zinc-600 dark:text-zinc-50 dark:hover:text-zinc-300"
                    >
                      {entity.name}
                    </Link>
                    {entity.publicDescription && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                        {entity.publicDescription}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-zinc-600 dark:text-zinc-300">
                    {TYPE_LABELS[entity.type]}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${VISIBILITY_CLASSES[entity.visibility]}`}
                    >
                      {VISIBILITY_LABELS[entity.visibility]}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {entity.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {entity.tags.map((tag) => (
                          <Link
                            key={tag}
                            href={buildEntityHref(campaignId, {
                              ...filters,
                              tag,
                            })}
                            className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                          >
                            {tag}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        -
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right align-top text-xs text-zinc-500 dark:text-zinc-400">
                    {entity.updatedAt.toLocaleDateString("it-IT")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
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
