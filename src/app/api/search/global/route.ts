import type { NextRequest } from "next/server";
import { type SQL, and, desc, eq, ilike, or } from "drizzle-orm";

import { db } from "@/db/client";
import {
  entities,
  plotThreads,
  ruleDocuments,
  sessions,
  truthClues,
} from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import { globalSearchQuerySchema } from "@/lib/validation/global-search-input";

type GlobalSearchKind =
  | "entity"
  | "session"
  | "plot_thread"
  | "truth_clue"
  | "rule";

interface GlobalSearchResult {
  id: string;
  kind: GlobalSearchKind;
  title: string;
  subtitle: string | null;
  campaignId: string | null;
  href: string;
  updatedAt: Date | string | null;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = globalSearchQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const query = q.q.trim();

    const [entityRows, sessionRows, plotRows, clueRows, ruleRows] =
      await Promise.all([
        searchEntities(query, q.limit, q.campaign_id),
        searchSessions(query, q.limit, q.campaign_id),
        searchPlotThreads(query, q.limit, q.campaign_id),
        searchTruthClues(query, q.limit, q.campaign_id),
        searchRules(query, q.limit),
      ]);

    const actions = buildActions(query, q.campaign_id);
    return ok({
      query,
      actions,
      results: [
        ...entityRows,
        ...sessionRows,
        ...plotRows,
        ...clueRows,
        ...ruleRows,
      ].slice(0, q.limit * 5),
    });
  } catch (err) {
    return fail(err);
  }
}

async function searchEntities(
  query: string,
  limit: number,
  campaignId: string | undefined,
): Promise<GlobalSearchResult[]> {
  const conditions = campaignScoped(campaignId, entities.campaignId);
  if (query) {
    const pattern = `%${query}%`;
    const match = or(
      ilike(entities.name, pattern),
      ilike(entities.description, pattern),
      ilike(entities.publicDescription, pattern),
    );
    if (match) conditions.push(match);
  }

  const rows = await db
    .select({
      id: entities.id,
      campaignId: entities.campaignId,
      type: entities.type,
      name: entities.name,
      publicDescription: entities.publicDescription,
      visibility: entities.visibility,
      updatedAt: entities.updatedAt,
    })
    .from(entities)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(query ? desc(entities.updatedAt) : desc(entities.updatedAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    kind: "entity",
    title: row.name,
    subtitle: `${entityTypeLabel(row.type)} - ${row.visibility}${
      row.publicDescription ? ` - ${truncate(row.publicDescription, 100)}` : ""
    }`,
    campaignId: row.campaignId,
    href: `/campaigns/${row.campaignId}?focus=${row.id}#entity-detail`,
    updatedAt: row.updatedAt,
  }));
}

async function searchSessions(
  query: string,
  limit: number,
  campaignId: string | undefined,
): Promise<GlobalSearchResult[]> {
  const conditions = campaignScoped(campaignId, sessions.campaignId);
  if (query) {
    const pattern = `%${query}%`;
    const match = or(
      ilike(sessions.title, pattern),
      ilike(sessions.recap, pattern),
      ilike(sessions.dmNotes, pattern),
      ilike(sessions.prepNotes, pattern),
    );
    if (match) conditions.push(match);
  }

  const rows = await db
    .select({
      id: sessions.id,
      campaignId: sessions.campaignId,
      number: sessions.number,
      title: sessions.title,
      recap: sessions.recap,
      updatedAt: sessions.updatedAt,
    })
    .from(sessions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sessions.number))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    kind: "session",
    title: `Sessione ${row.number}${row.title ? ` - ${row.title}` : ""}`,
    subtitle: row.recap ? truncate(row.recap, 120) : null,
    campaignId: row.campaignId,
    href: `/sessions?campaign_id=${row.campaignId}#session-${row.id}`,
    updatedAt: row.updatedAt,
  }));
}

async function searchPlotThreads(
  query: string,
  limit: number,
  campaignId: string | undefined,
): Promise<GlobalSearchResult[]> {
  const conditions = campaignScoped(campaignId, plotThreads.campaignId);
  if (query) {
    const pattern = `%${query}%`;
    const match = or(
      ilike(plotThreads.title, pattern),
      ilike(plotThreads.description, pattern),
      ilike(plotThreads.publicDescription, pattern),
    );
    if (match) conditions.push(match);
  }

  const rows = await db
    .select({
      id: plotThreads.id,
      campaignId: plotThreads.campaignId,
      title: plotThreads.title,
      status: plotThreads.status,
      publicDescription: plotThreads.publicDescription,
      updatedAt: plotThreads.updatedAt,
    })
    .from(plotThreads)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(plotThreads.updatedAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    kind: "plot_thread",
    title: row.title,
    subtitle: `${row.status}${
      row.publicDescription ? ` - ${truncate(row.publicDescription, 110)}` : ""
    }`,
    campaignId: row.campaignId,
    href: `/plot-threads?campaign_id=${row.campaignId}#plot-thread-${row.id}`,
    updatedAt: row.updatedAt,
  }));
}

async function searchTruthClues(
  query: string,
  limit: number,
  campaignId: string | undefined,
): Promise<GlobalSearchResult[]> {
  const conditions = campaignScoped(campaignId, truthClues.campaignId);
  if (query) {
    const pattern = `%${query}%`;
    const match = or(
      ilike(truthClues.description, pattern),
      ilike(truthClues.truthRevealed, pattern),
      ilike(truthClues.statusNotes, pattern),
    );
    if (match) conditions.push(match);
  }

  const rows = await db
    .select({
      id: truthClues.id,
      campaignId: truthClues.campaignId,
      description: truthClues.description,
      truthRevealed: truthClues.truthRevealed,
      status: truthClues.status,
      updatedAt: truthClues.statusUpdatedAt,
    })
    .from(truthClues)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(truthClues.statusUpdatedAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    kind: "truth_clue",
    title: truncate(row.description, 90),
    subtitle: `${row.status} - ${truncate(row.truthRevealed, 110)}`,
    campaignId: row.campaignId,
    href: `/truth-clues?campaign_id=${row.campaignId}#truth-clue-${row.id}`,
    updatedAt: row.updatedAt,
  }));
}

async function searchRules(
  query: string,
  limit: number,
): Promise<GlobalSearchResult[]> {
  if (!query) return [];
  const pattern = `%${query}%`;
  const match = or(
    ilike(ruleDocuments.title, pattern),
    ilike(ruleDocuments.section, pattern),
    ilike(ruleDocuments.content, pattern),
  );
  const rows = await db
    .select({
      id: ruleDocuments.id,
      source: ruleDocuments.source,
      title: ruleDocuments.title,
      section: ruleDocuments.section,
      content: ruleDocuments.content,
      createdAt: ruleDocuments.createdAt,
    })
    .from(ruleDocuments)
    .where(match)
    .orderBy(desc(ruleDocuments.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    kind: "rule",
    title: row.section ?? row.title ?? row.source,
    subtitle: `${row.source} - ${truncate(row.content, 130)}`,
    campaignId: null,
    href: `/rules?q=${encodeURIComponent(query)}`,
    updatedAt: row.createdAt,
  }));
}

function buildActions(query: string, campaignId: string | undefined) {
  const encodedQuery = encodeURIComponent(query);
  const campaignSuffix = campaignId ? `?campaign_id=${campaignId}` : "";
  return [
    {
      id: "new-campaign",
      kind: "action",
      title: "Nuova campagna",
      subtitle: "Apri la Campaign Wiki",
      href: "/campaigns",
    },
    {
      id: "new-session",
      kind: "action",
      title: "Nuova sessione",
      subtitle: "Apri il tracker sessioni",
      href: `/sessions${campaignSuffix}`,
    },
    {
      id: "new-truth-clue",
      kind: "action",
      title: "Nuova briciola di verita'",
      subtitle: "Apri il Truth Clue Tracker",
      href: `/truth-clues${campaignSuffix}`,
    },
    {
      id: "ask-rules",
      kind: "action",
      title: query ? `Chiedi alle regole: "${query}"` : "Chiedi alle regole",
      subtitle: "Apri Rules Lookup",
      href: query ? `/rules?q=${encodedQuery}` : "/rules",
    },
    {
      id: "generation-log",
      kind: "action",
      title: "Controlla costi LLM",
      subtitle: "Apri Generation log",
      href: "/generation-log",
    },
  ];
}

function campaignScoped(
  campaignId: string | undefined,
  column:
    | typeof entities.campaignId
    | typeof sessions.campaignId
    | typeof plotThreads.campaignId
    | typeof truthClues.campaignId,
): SQL[] {
  return campaignId ? [eq(column, campaignId)] : [];
}

function entityTypeLabel(type: string) {
  const labels: Record<string, string> = {
    pc: "PG",
    npc: "NPC",
    location: "Luogo",
    faction: "Fazione",
    item: "Oggetto",
    monster: "Mostro",
    deity: "Divinita'",
    organization: "Organizzazione",
  };
  return labels[type] ?? type;
}

function truncate(value: string, max: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 3)).trim()}...`;
}
