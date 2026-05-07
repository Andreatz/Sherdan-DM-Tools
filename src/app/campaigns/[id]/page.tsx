import Link from "next/link";
import { notFound } from "next/navigation";

import { type SQL, and, asc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import {
  campaigns,
  entities,
  entityIdentities,
  entityLinks,
  entitySecrets,
  entityType,
  pcHooks,
} from "@/db/schema";
import { getLogger } from "@/lib/logger";
import { EntityLinkEditor } from "@/components/entity-link-editor";
import { WikiMarkdownEditor } from "@/components/wiki-markdown-editor";

const log = getLogger("page.campaign-detail");

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

type EntityType = (typeof entityType.enumValues)[number];
type Visibility = "dm_only" | "discovered" | "public";
type SecretLayer = "surface" | "intermediate" | "deep";
type DetailTab =
  | "gm"
  | "public"
  | "properties"
  | "identities"
  | "secrets"
  | "links"
  | "backlinks"
  | "pc-hooks";

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

interface CampaignEntityDetail extends CampaignEntityRow {
  campaignId: string;
  description: string | null;
  properties: unknown;
  parentId: string | null;
  createdAt: Date;
}

interface EntityName {
  id: string;
  type: EntityType;
  name: string;
  publicDescription: string | null;
}

interface EntityIdentityRow {
  id: string;
  name: string;
  isTrueIdentity: boolean;
  appearance: string | null;
  voice: string | null;
  mannerisms: unknown;
  visibility: Visibility;
  notes: string | null;
}

interface EntitySecretRow {
  id: string;
  layer: SecretLayer;
  content: string;
  exploitHint: string | null;
  discoveredAtSession: string | null;
  discoveryNotes: string | null;
}

interface EntityLinkRow {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string;
  publicRelationType: string | null;
  strength: number | null;
  description: string | null;
  visibility: Visibility;
}

interface PcHookRow {
  id: string;
  pcEntityId: string;
  targetEntityId: string;
  hookDescription: string;
  potentialArc: string | null;
  status: string;
}

interface EntityDetailData {
  entity: CampaignEntityDetail;
  identities: EntityIdentityRow[];
  secrets: EntitySecretRow[];
  links: EntityLinkRow[];
  backlinks: EntityLinkRow[];
  pcHooks: PcHookRow[];
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

const DETAIL_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: "gm", label: "Verita' GM" },
  { id: "public", label: "Versione pubblica" },
  { id: "properties", label: "Properties" },
  { id: "identities", label: "Identita'" },
  { id: "secrets", label: "Segreti" },
  { id: "links", label: "Links" },
  { id: "backlinks", label: "Backlinks" },
  { id: "pc-hooks", label: "Hooks PG" },
];

const DETAIL_TAB_IDS = DETAIL_TABS.map((tab) => tab.id);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function parseDetailTab(value: string | string[] | undefined): DetailTab {
  const tab = firstParam(value);
  return DETAIL_TAB_IDS.includes(tab as DetailTab) ? (tab as DetailTab) : "gm";
}

function parseFocus(value: string | string[] | undefined): string | undefined {
  const focus = firstParam(value);
  return focus && UUID_RE.test(focus) ? focus : undefined;
}

function buildCampaignHref(
  campaignId: string,
  filters: EntityListFilters,
  options: { focus?: string; tab?: DetailTab } = {},
) {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.search) params.set("search", filters.search);
  if (options.focus) params.set("focus", options.focus);
  if (options.tab && options.tab !== "gm") params.set("detail_tab", options.tab);
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

async function fetchCampaignEntityNames(campaignId: string): Promise<EntityName[]> {
  return db
    .select({
      id: entities.id,
      type: entities.type,
      name: entities.name,
      publicDescription: entities.publicDescription,
    })
    .from(entities)
    .where(eq(entities.campaignId, campaignId))
    .orderBy(asc(entities.name));
}

async function fetchEntityDetail(
  campaignId: string,
  entityId: string,
): Promise<EntityDetailData | undefined> {
  const [entity] = await db
    .select({
      id: entities.id,
      campaignId: entities.campaignId,
      type: entities.type,
      name: entities.name,
      description: entities.description,
      publicDescription: entities.publicDescription,
      properties: entities.properties,
      tags: entities.tags,
      parentId: entities.parentId,
      visibility: entities.visibility,
      createdAt: entities.createdAt,
      updatedAt: entities.updatedAt,
    })
    .from(entities)
    .where(and(eq(entities.id, entityId), eq(entities.campaignId, campaignId)))
    .limit(1);

  if (!entity) return undefined;

  const [identities, secrets, linksInvolving, hooks] = await Promise.all([
    db
      .select({
        id: entityIdentities.id,
        name: entityIdentities.name,
        isTrueIdentity: entityIdentities.isTrueIdentity,
        appearance: entityIdentities.appearance,
        voice: entityIdentities.voice,
        mannerisms: entityIdentities.mannerisms,
        visibility: entityIdentities.visibility,
        notes: entityIdentities.notes,
      })
      .from(entityIdentities)
      .where(eq(entityIdentities.entityId, entityId))
      .orderBy(asc(entityIdentities.createdAt)),
    db
      .select({
        id: entitySecrets.id,
        layer: entitySecrets.layer,
        content: entitySecrets.content,
        exploitHint: entitySecrets.exploitHint,
        discoveredAtSession: entitySecrets.discoveredAtSession,
        discoveryNotes: entitySecrets.discoveryNotes,
      })
      .from(entitySecrets)
      .where(eq(entitySecrets.entityId, entityId))
      .orderBy(asc(entitySecrets.createdAt)),
    db
      .select({
        id: entityLinks.id,
        sourceEntityId: entityLinks.sourceEntityId,
        targetEntityId: entityLinks.targetEntityId,
        relationType: entityLinks.relationType,
        publicRelationType: entityLinks.publicRelationType,
        strength: entityLinks.strength,
        description: entityLinks.description,
        visibility: entityLinks.visibility,
      })
      .from(entityLinks)
      .where(
        and(
          eq(entityLinks.campaignId, campaignId),
          or(
            eq(entityLinks.sourceEntityId, entityId),
            eq(entityLinks.targetEntityId, entityId),
          ),
        ),
      )
      .orderBy(asc(entityLinks.createdAt)),
    db
      .select({
        id: pcHooks.id,
        pcEntityId: pcHooks.pcEntityId,
        targetEntityId: pcHooks.targetEntityId,
        hookDescription: pcHooks.hookDescription,
        potentialArc: pcHooks.potentialArc,
        status: pcHooks.status,
      })
      .from(pcHooks)
      .where(
        and(
          eq(pcHooks.campaignId, campaignId),
          or(eq(pcHooks.pcEntityId, entityId), eq(pcHooks.targetEntityId, entityId)),
        ),
      )
      .orderBy(asc(pcHooks.createdAt)),
  ]);

  return {
    entity,
    identities,
    secrets,
    links: linksInvolving.filter((link) => link.sourceEntityId === entityId),
    backlinks: linksInvolving.filter((link) => link.targetEntityId === entityId),
    pcHooks: hooks,
  };
}

export default async function CampaignDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const rawSearchParams = (await searchParams) ?? {};
  const filters = parseFilters(rawSearchParams);
  const detailTab = parseDetailTab(rawSearchParams.detail_tab);
  const requestedFocus = parseFocus(rawSearchParams.focus);

  let campaign: { id: string; name: string; description: string | null } | undefined;
  let campaignEntities: CampaignEntityRow[] = [];
  let campaignEntityNames: EntityName[] = [];
  let allTags: string[] = [];
  let detailData: EntityDetailData | undefined;

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
      [campaignEntities, campaignEntityNames, allTags] = await Promise.all([
        fetchCampaignEntities(id, filters),
        fetchCampaignEntityNames(id),
        fetchCampaignTags(id),
      ]);

      const focusId = requestedFocus ?? campaignEntities[0]?.id;
      if (focusId) {
        detailData = await fetchEntityDetail(id, focusId);
      }
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
        selectedEntityId={detailData?.entity.id}
        detailTab={detailTab}
        detailData={detailData}
        entityNames={campaignEntityNames}
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
  selectedEntityId,
  detailTab,
  detailData,
  entityNames,
}: {
  campaignId: string;
  entities: CampaignEntityRow[];
  filters: EntityListFilters;
  allTags: string[];
  selectedEntityId?: string;
  detailTab: DetailTab;
  detailData?: EntityDetailData;
  entityNames: EntityName[];
}) {
  const hasActiveFilters = Boolean(filters.type || filters.tag || filters.search);
  const entityNameById = new Map(entityNames.map((entity) => [entity.id, entity]));

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
            href={buildCampaignHref(campaignId, {}, { focus: selectedEntityId })}
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
        {selectedEntityId && <input type="hidden" name="focus" value={selectedEntityId} />}
        {detailTab !== "gm" && (
          <input type="hidden" name="detail_tab" value={detailTab} />
        )}
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
                  className={`transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${
                    selectedEntityId === entity.id
                      ? "bg-zinc-50 dark:bg-zinc-800/40"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3 align-top">
                    <Link
                      href={buildCampaignHref(campaignId, filters, {
                        focus: entity.id,
                        tab: detailTab,
                      })}
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
                            href={buildCampaignHref(
                              campaignId,
                              { ...filters, tag },
                              { focus: selectedEntityId, tab: detailTab },
                            )}
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

      {detailData ? (
        <EntityDetailPanel
          campaignId={campaignId}
          filters={filters}
          activeTab={detailTab}
          data={detailData}
          entityNameById={entityNameById}
        />
      ) : rows.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          L&apos;entita&apos; selezionata non appartiene a questa campagna oppure
          non esiste piu&apos;.
        </div>
      ) : null}
    </section>
  );
}

function EntityDetailPanel({
  campaignId,
  filters,
  activeTab,
  data,
  entityNameById,
}: {
  campaignId: string;
  filters: EntityListFilters;
  activeTab: DetailTab;
  data: EntityDetailData;
  entityNameById: Map<string, EntityName>;
}) {
  const { entity } = data;

  return (
    <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold tracking-tight">
                {entity.name}
              </h3>
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {TYPE_LABELS[entity.type]}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${VISIBILITY_CLASSES[entity.visibility]}`}
              >
                {VISIBILITY_LABELS[entity.visibility]}
              </span>
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Creata il {entity.createdAt.toLocaleDateString("it-IT")} &middot;
              aggiornata il {entity.updatedAt.toLocaleDateString("it-IT")}
            </p>
          </div>
          {entity.tags.length > 0 && (
            <div className="flex max-w-md flex-wrap justify-end gap-1.5">
              {entity.tags.map((tag) => (
                <Link
                  key={tag}
                  href={buildCampaignHref(
                    campaignId,
                    { ...filters, tag },
                    { focus: entity.id, tab: activeTab },
                  )}
                  className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
        </div>
      </header>

      <nav
        className="flex gap-1 overflow-x-auto border-b border-zinc-200 px-4 py-2 dark:border-zinc-800"
        aria-label="Dettagli entita'"
      >
        {DETAIL_TABS.map((tab) => (
          <Link
            key={tab.id}
            href={buildCampaignHref(campaignId, filters, {
              focus: entity.id,
              tab: tab.id,
            })}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors ${
              activeTab === tab.id
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="p-5">
        {activeTab === "gm" && (
          <WikiMarkdownEditor
            campaignId={campaignId}
            entityId={entity.id}
            field="description"
            label="Verita' GM"
            initialMarkdown={entity.description}
            entityPreviews={Array.from(entityNameById.values())}
          />
        )}
        {activeTab === "public" && (
          <WikiMarkdownEditor
            campaignId={campaignId}
            entityId={entity.id}
            field="publicDescription"
            label="Versione pubblica"
            initialMarkdown={entity.publicDescription}
            entityPreviews={Array.from(entityNameById.values())}
          />
        )}
        {activeTab === "properties" && (
          <PropertiesPanel properties={entity.properties} />
        )}
        {activeTab === "identities" && (
          <IdentitiesPanel identities={data.identities} />
        )}
        {activeTab === "secrets" && <SecretsPanel secrets={data.secrets} />}
        {activeTab === "links" && (
          <LinksPanel
            campaignId={campaignId}
            currentEntityId={entity.id}
            filters={filters}
            activeTab={activeTab}
            links={data.links}
            entityNameById={entityNameById}
            direction="forward"
          />
        )}
        {activeTab === "backlinks" && (
          <LinksPanel
            campaignId={campaignId}
            filters={filters}
            activeTab={activeTab}
            links={data.backlinks}
            entityNameById={entityNameById}
            direction="backward"
          />
        )}
        {activeTab === "pc-hooks" && (
          <PcHooksPanel
            campaignId={campaignId}
            filters={filters}
            activeTab={activeTab}
            hooks={data.pcHooks}
            entityNameById={entityNameById}
          />
        )}
      </div>
    </article>
  );
}

function PropertiesPanel({ properties }: { properties: unknown }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">JSONB properties</h4>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Sola lettura per ora
        </span>
      </div>
      <pre className="max-h-[520px] overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 text-xs leading-6 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
        {JSON.stringify(properties, null, 2)}
      </pre>
    </div>
  );
}

function IdentitiesPanel({ identities }: { identities: EntityIdentityRow[] }) {
  if (identities.length === 0) {
    return <EmptyDetailState>Nessuna identita&apos; registrata.</EmptyDetailState>;
  }

  return (
    <div className="grid gap-3">
      {identities.map((identity) => (
        <div
          key={identity.id}
          className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium">{identity.name}</h4>
            {identity.isTrueIdentity && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                vera identita&apos;
              </span>
            )}
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${VISIBILITY_CLASSES[identity.visibility]}`}
            >
              {VISIBILITY_LABELS[identity.visibility]}
            </span>
          </div>
          <DetailField label="Aspetto" value={identity.appearance} />
          <DetailField label="Voce" value={identity.voice} />
          <DetailField
            label="Mannerisms"
            value={formatUnknownList(identity.mannerisms)}
          />
          <DetailField label="Note" value={identity.notes} />
        </div>
      ))}
    </div>
  );
}

function SecretsPanel({ secrets }: { secrets: EntitySecretRow[] }) {
  if (secrets.length === 0) {
    return <EmptyDetailState>Nessun segreto registrato.</EmptyDetailState>;
  }

  const layers: SecretLayer[] = ["surface", "intermediate", "deep"];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {layers.map((layer) => {
        const layerSecrets = secrets.filter((secret) => secret.layer === layer);
        return (
          <div key={layer} className="space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {layer}
            </h4>
            {layerSecrets.length === 0 ? (
              <div className="rounded-md border border-dashed border-zinc-200 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                Vuoto
              </div>
            ) : (
              layerSecrets.map((secret) => (
                <div
                  key={secret.id}
                  className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-800 dark:text-zinc-200">
                    {secret.content}
                  </p>
                  <DetailField label="Come sfruttarlo" value={secret.exploitHint} />
                  <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {secret.discoveredAtSession
                      ? "Scoperto dal party"
                      : "Non ancora scoperto"}
                  </p>
                  <DetailField
                    label="Note scoperta"
                    value={secret.discoveryNotes}
                  />
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

function LinksPanel({
  campaignId,
  currentEntityId,
  filters,
  activeTab,
  links,
  entityNameById,
  direction,
}: {
  campaignId: string;
  currentEntityId?: string;
  filters: EntityListFilters;
  activeTab: DetailTab;
  links: EntityLinkRow[];
  entityNameById: Map<string, EntityName>;
  direction: "forward" | "backward";
}) {
  if (direction === "forward" && currentEntityId) {
    return (
      <EntityLinkEditor
        campaignId={campaignId}
        currentEntityId={currentEntityId}
        links={links}
        entities={Array.from(entityNameById.values())}
      />
    );
  }

  if (links.length === 0) {
    return (
      <EmptyDetailState>
        {direction === "forward"
          ? "Nessun link in uscita."
          : "Nessun backlink in ingresso."}
      </EmptyDetailState>
    );
  }

  return (
    <div className="grid gap-3">
      {links.map((link) => {
        const otherId =
          direction === "forward" ? link.targetEntityId : link.sourceEntityId;
        const other = entityNameById.get(otherId);
        return (
          <div
            key={link.id}
            className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex flex-wrap items-center gap-2">
              <EntityInlineLink
                campaignId={campaignId}
                filters={filters}
                tab={activeTab}
                entity={other}
                fallbackId={otherId}
              />
              {other && (
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {TYPE_LABELS[other.type]}
                </span>
              )}
              <span
                className={`rounded-full border px-2 py-0.5 text-xs font-medium ${VISIBILITY_CLASSES[link.visibility]}`}
              >
                {VISIBILITY_LABELS[link.visibility]}
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="font-medium">Verita&apos;:</span>{" "}
              {link.relationType}
              {link.strength !== null ? ` (${link.strength}/10)` : ""}
            </p>
            {link.publicRelationType && (
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="font-medium">Pubblica:</span>{" "}
                {link.publicRelationType}
              </p>
            )}
            <DetailField label="Note" value={link.description} />
          </div>
        );
      })}
    </div>
  );
}

function PcHooksPanel({
  campaignId,
  filters,
  activeTab,
  hooks,
  entityNameById,
}: {
  campaignId: string;
  filters: EntityListFilters;
  activeTab: DetailTab;
  hooks: PcHookRow[];
  entityNameById: Map<string, EntityName>;
}) {
  if (hooks.length === 0) {
    return <EmptyDetailState>Nessun hook PG registrato.</EmptyDetailState>;
  }

  return (
    <div className="grid gap-3">
      {hooks.map((hook) => {
        const pc = entityNameById.get(hook.pcEntityId);
        const target = entityNameById.get(hook.targetEntityId);
        return (
          <div
            key={hook.id}
            className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <EntityInlineLink
                campaignId={campaignId}
                filters={filters}
                tab={activeTab}
                entity={pc}
                fallbackId={hook.pcEntityId}
              />
              <span className="text-zinc-400">-&gt;</span>
              <EntityInlineLink
                campaignId={campaignId}
                filters={filters}
                tab={activeTab}
                entity={target}
                fallbackId={hook.targetEntityId}
              />
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {hook.status}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-800 dark:text-zinc-200">
              {hook.hookDescription}
            </p>
            <DetailField label="Arco potenziale" value={hook.potentialArc} />
          </div>
        );
      })}
    </div>
  );
}

function EntityInlineLink({
  campaignId,
  filters,
  tab,
  entity,
  fallbackId,
}: {
  campaignId: string;
  filters: EntityListFilters;
  tab: DetailTab;
  entity: EntityName | undefined;
  fallbackId: string;
}) {
  return (
    <Link
      href={buildCampaignHref(campaignId, filters, {
        focus: entity?.id ?? fallbackId,
        tab,
      })}
      className="font-medium text-zinc-900 hover:text-zinc-600 dark:text-zinc-50 dark:hover:text-zinc-300"
    >
      {entity?.name ?? fallbackId}
    </Link>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-800 dark:text-zinc-200">
        {value}
      </p>
    </div>
  );
}

function EmptyDetailState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
      {children}
    </div>
  );
}

function formatUnknownList(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value.map((item) => String(item)).join(", ");
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
