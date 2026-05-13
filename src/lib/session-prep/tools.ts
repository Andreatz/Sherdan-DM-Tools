import { type SQL, and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import {
  entities,
  entityIdentities,
  entityType,
  pcHooks,
  plotThreadStatus,
  plotThreads,
  sessions,
  truthClues,
} from "@/db/schema";
import { getLLMProvider } from "@/lib/llm";
import { searchRules } from "@/lib/rules";

// Tool read-only del Session Prep Assistant. Ogni tool ha:
// - `name` (univoco, usato dall'agent per chiamarlo);
// - `description` (mostrata al modello);
// - `argsSchema` Zod;
// - `execute(campaignId, args)` che esegue la query e ritorna JSON sicuro.
//
// Il `campaignId` e' iniettato dal runner, mai dall'agent: l'LLM non puo'
// "pescare" da altre campagne neppure tentando.

export interface SessionPrepTool<TArgs, TResult> {
  readonly name: string;
  readonly description: string;
  readonly argsSchema: z.ZodType<TArgs>;
  execute(campaignId: string, args: TArgs): Promise<TResult>;
}

// ─── search_entities ──────────────────────────────────────────────────
const searchEntitiesArgsSchema = z
  .object({
    query: z.string().trim().min(1).max(100),
    type: z.enum(entityType.enumValues).optional(),
    limit: z.coerce.number().int().min(1).max(20).default(10),
  })
  .strict();
type SearchEntitiesArgs = z.infer<typeof searchEntitiesArgsSchema>;

export interface SearchEntitiesResultRow {
  id: string;
  type: string;
  name: string;
  publicDescription: string | null;
  gmDescription: string | null;
  tags: string[];
}

export const searchEntitiesTool: SessionPrepTool<
  SearchEntitiesArgs,
  SearchEntitiesResultRow[]
> = {
  name: "search_entities",
  description:
    "Cerca entita' della campagna per nome o testo (case-insensitive). " +
    "Filtra opzionalmente per type. Ritorna id, name, type, descrizione " +
    "pubblica + GM e tags. Usalo per agganciare proposte a entita' esistenti.",
  argsSchema: searchEntitiesArgsSchema,
  async execute(campaignId, args) {
    const pattern = `%${args.query}%`;
    const conditions: SQL[] = [eq(entities.campaignId, campaignId)];
    if (args.type) conditions.push(eq(entities.type, args.type));
    const search = or(
      ilike(entities.name, pattern),
      ilike(entities.publicDescription, pattern),
      ilike(entities.description, pattern),
    );
    if (search) conditions.push(search);

    return db
      .select({
        id: entities.id,
        type: entities.type,
        name: entities.name,
        publicDescription: entities.publicDescription,
        gmDescription: entities.description,
        tags: entities.tags,
      })
      .from(entities)
      .where(and(...conditions))
      .orderBy(asc(entities.name))
      .limit(args.limit);
  },
};

// ─── get_active_plot_threads ──────────────────────────────────────────
const getActivePlotThreadsArgsSchema = z
  .object({
    statuses: z.array(z.enum(plotThreadStatus.enumValues)).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
type GetActivePlotThreadsArgs = z.infer<typeof getActivePlotThreadsArgsSchema>;

export interface PlotThreadSummary {
  id: string;
  title: string;
  status: string;
  priority: number | null;
  /** Verita' GM. Il prep e' GM-only. */
  description: string | null;
  /** Versione percepita dal party. */
  publicDescription: string | null;
  lastAdvancedAt: string | null;
}

export const getActivePlotThreadsTool: SessionPrepTool<
  GetActivePlotThreadsArgs,
  PlotThreadSummary[]
> = {
  name: "get_active_plot_threads",
  description:
    "Lista plot thread della campagna. Default: tutti gli stati tranne " +
    "`resolved`/`abandoned`. Ritorna verita' GM, versione percepita, " +
    "status, priorita' e ultimo evento. Usalo per capire dove la trama " +
    "puo' avanzare in questa sessione.",
  argsSchema: getActivePlotThreadsArgsSchema,
  async execute(campaignId, args) {
    const statuses = args.statuses ?? ["hot", "warm", "cold"];
    const rows = await db
      .select({
        id: plotThreads.id,
        title: plotThreads.title,
        status: plotThreads.status,
        priority: plotThreads.priority,
        description: plotThreads.description,
        publicDescription: plotThreads.publicDescription,
        lastAdvancedAt: plotThreads.lastAdvancedAt,
      })
      .from(plotThreads)
      .where(
        and(
          eq(plotThreads.campaignId, campaignId),
          inArray(plotThreads.status, statuses),
        ),
      )
      .orderBy(desc(plotThreads.priority), asc(plotThreads.title))
      .limit(args.limit);
    return rows.map((row) => ({
      ...row,
      lastAdvancedAt:
        row.lastAdvancedAt instanceof Date
          ? row.lastAdvancedAt.toISOString()
          : row.lastAdvancedAt,
    }));
  },
};

// ─── get_recent_sessions ──────────────────────────────────────────────
const getRecentSessionsArgsSchema = z
  .object({
    n: z.coerce.number().int().min(1).max(10).default(3),
  })
  .strict();
type GetRecentSessionsArgs = z.infer<typeof getRecentSessionsArgsSchema>;

export interface RecentSessionRow {
  id: string;
  number: number;
  title: string | null;
  date: string | null;
  /** Cosa il party ha vissuto (safe per "previously on"). */
  recap: string | null;
  /** Interpretazioni GM, retcon. NON usarlo per "previously on". */
  dmNotes: string | null;
  prepNotes: string | null;
}

export const getRecentSessionsTool: SessionPrepTool<
  GetRecentSessionsArgs,
  RecentSessionRow[]
> = {
  name: "get_recent_sessions",
  description:
    "Ultime N sessioni della campagna (default 3, max 10) con recap, " +
    "dm_notes e prep_notes. Usa solo il `recap` per il 'previously on'; " +
    "`dmNotes` e' GM-only e non va mai esposto ai giocatori.",
  argsSchema: getRecentSessionsArgsSchema,
  async execute(campaignId, args) {
    const rows = await db
      .select({
        id: sessions.id,
        number: sessions.number,
        title: sessions.title,
        date: sessions.date,
        recap: sessions.recap,
        dmNotes: sessions.dmNotes,
        prepNotes: sessions.prepNotes,
      })
      .from(sessions)
      .where(eq(sessions.campaignId, campaignId))
      .orderBy(desc(sessions.number))
      .limit(args.n);
    return rows.map((row) => ({
      ...row,
      date: row.date ?? null,
    }));
  },
};

// ─── get_active_identities ────────────────────────────────────────────
const getActiveIdentitiesArgsSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
type GetActiveIdentitiesArgs = z.infer<typeof getActiveIdentitiesArgsSchema>;

export interface ActiveIdentityRow {
  entityId: string;
  entityName: string;
  identityName: string;
  /** True = e' la "vera" identita' (GM); false = maschera attualmente attiva. */
  isTrueIdentity: boolean;
  voice: string | null;
  appearance: string | null;
}

export const getActiveIdentitiesTool: SessionPrepTool<
  GetActiveIdentitiesArgs,
  ActiveIdentityRow[]
> = {
  name: "get_active_identities",
  description:
    "Per ogni entita' con identita' multiple, ritorna la maschera che il " +
    "party vede ora. Pattern Sherdan: Malakor↔Dante, Noel↔Yancarlos↔Lust. " +
    "Usa questo dato per evitare di rivelare accidentalmente la vera " +
    "identita' nei contenuti player-facing (es. 'previously on').",
  argsSchema: getActiveIdentitiesArgsSchema,
  async execute(campaignId, args) {
    // Identita' "attive": activeUntilSession IS NULL (cioe' non scadute).
    // L'agent puo' usare la combinazione "true identity" + "maschera" per
    // contestualizzare. Ordiniamo per entity name + (mask first, true last)
    // cosi' il modello vede prima la maschera per ogni entity.
    const rows = await db
      .select({
        entityId: entityIdentities.entityId,
        entityName: entities.name,
        identityName: entityIdentities.name,
        isTrueIdentity: entityIdentities.isTrueIdentity,
        voice: entityIdentities.voice,
        appearance: entityIdentities.appearance,
        activeUntilSession: entityIdentities.activeUntilSession,
      })
      .from(entityIdentities)
      .innerJoin(entities, eq(entities.id, entityIdentities.entityId))
      .where(eq(entities.campaignId, campaignId))
      .orderBy(
        asc(entities.name),
        asc(entityIdentities.isTrueIdentity),
        asc(entityIdentities.name),
      )
      .limit(args.limit);
    return rows
      .filter((row) => row.activeUntilSession === null)
      .map(({ activeUntilSession: _drop, ...rest }) => {
        void _drop;
        return rest;
      });
  },
};

// ─── get_truth_progress ───────────────────────────────────────────────
const getTruthProgressArgsSchema = z
  .object({
    plotThreadId: z.uuid().optional(),
  })
  .strict();
type GetTruthProgressArgs = z.infer<typeof getTruthProgressArgsSchema>;

export interface TruthProgressRow {
  plotThreadId: string | null;
  plotThreadTitle: string | null;
  total: number;
  planted: number;
  noticed: number;
  misinterpreted: number;
  understood: number;
  lost: number;
  understoodPct: number;
}

export const getTruthProgressTool: SessionPrepTool<
  GetTruthProgressArgs,
  TruthProgressRow[]
> = {
  name: "get_truth_progress",
  description:
    "Riepilogo briciole di verita' della campagna: per ogni plot thread, " +
    "il count per status (planted/noticed/misinterpreted/understood/lost) " +
    "e la percentuale understood/total. Usalo per capire quali thread " +
    "hanno bisogno di nuove briciole e dove il party e' vicino a capire.",
  argsSchema: getTruthProgressArgsSchema,
  async execute(campaignId, args) {
    const threads = await db
      .select({
        id: plotThreads.id,
        title: plotThreads.title,
      })
      .from(plotThreads)
      .where(eq(plotThreads.campaignId, campaignId))
      .orderBy(asc(plotThreads.title));

    const aggregated = await db
      .select({
        plotThreadId: truthClues.relatedPlotThreadId,
        status: truthClues.status,
        count: sql<number>`count(*)::int`,
      })
      .from(truthClues)
      .where(
        args.plotThreadId
          ? and(
              eq(truthClues.campaignId, campaignId),
              eq(truthClues.relatedPlotThreadId, args.plotThreadId),
            )
          : eq(truthClues.campaignId, campaignId),
      )
      .groupBy(truthClues.relatedPlotThreadId, truthClues.status);

    const map = new Map<string | null, TruthProgressRow>();
    function rowFor(plotThreadId: string | null): TruthProgressRow {
      let row = map.get(plotThreadId);
      if (!row) {
        const thread =
          plotThreadId === null
            ? null
            : threads.find((t) => t.id === plotThreadId);
        row = {
          plotThreadId,
          plotThreadTitle: thread?.title ?? null,
          total: 0,
          planted: 0,
          noticed: 0,
          misinterpreted: 0,
          understood: 0,
          lost: 0,
          understoodPct: 0,
        };
        map.set(plotThreadId, row);
      }
      return row;
    }
    if (!args.plotThreadId) {
      for (const t of threads) rowFor(t.id);
    }
    for (const agg of aggregated) {
      const row = rowFor(agg.plotThreadId);
      row.total += agg.count;
      switch (agg.status) {
        case "planted":
          row.planted += agg.count;
          break;
        case "noticed":
          row.noticed += agg.count;
          break;
        case "misinterpreted":
          row.misinterpreted += agg.count;
          break;
        case "understood":
          row.understood += agg.count;
          break;
        case "lost":
          row.lost += agg.count;
          break;
      }
    }
    const result: TruthProgressRow[] = [];
    for (const row of map.values()) {
      row.understoodPct =
        row.total === 0 ? 0 : Math.round((row.understood / row.total) * 100);
      result.push(row);
    }
    return result.sort((a, b) => {
      if (a.plotThreadId === null) return 1;
      if (b.plotThreadId === null) return -1;
      return (a.plotThreadTitle ?? "").localeCompare(b.plotThreadTitle ?? "");
    });
  },
};

// ─── get_pc_hooks ─────────────────────────────────────────────────────
const PC_HOOK_STATUSES = ["available", "in_progress", "resolved"] as const;

const getPcHooksArgsSchema = z
  .object({
    pcEntityId: z.uuid().optional(),
    /** Default ["available"]: l'agent quasi sempre cerca hook ancora liberi. */
    statuses: z.array(z.enum(PC_HOOK_STATUSES)).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();
type GetPcHooksArgs = z.infer<typeof getPcHooksArgsSchema>;

export interface PcHookRow {
  id: string;
  pcEntityId: string;
  pcName: string;
  targetEntityId: string;
  targetName: string;
  hookDescription: string;
  potentialArc: string | null;
  status: string;
  /** ID della sessione in cui l'hook e' stato usato. Null = non ancora. */
  usedInSession: string | null;
}

export const getPcHooksTool: SessionPrepTool<GetPcHooksArgs, PcHookRow[]> = {
  name: "get_pc_hooks",
  description:
    "Lista hook narrativi PG -> entita' della campagna. Default: solo " +
    "`status='available'`. Filtri opzionali: `pcEntityId` (hook di un " +
    "singolo PG), `statuses` (override del default). Usa questo tool per " +
    "scegliere hook che non hai ancora 'consumato' nelle sessioni recenti.",
  argsSchema: getPcHooksArgsSchema,
  async execute(campaignId, args) {
    const statuses = args.statuses ?? ["available"];
    const conditions: SQL[] = [
      eq(pcHooks.campaignId, campaignId),
      inArray(pcHooks.status, statuses),
    ];
    if (args.pcEntityId) {
      conditions.push(eq(pcHooks.pcEntityId, args.pcEntityId));
    }

    // JOIN ai nomi delle entity PG e target cosi' l'agent non deve
    // chiamare search_entities a parte per ricostruirli.
    const pcAlias = entities;
    const rows = await db
      .select({
        id: pcHooks.id,
        pcEntityId: pcHooks.pcEntityId,
        pcName: pcAlias.name,
        targetEntityId: pcHooks.targetEntityId,
        hookDescription: pcHooks.hookDescription,
        potentialArc: pcHooks.potentialArc,
        status: pcHooks.status,
        usedInSession: pcHooks.usedInSession,
      })
      .from(pcHooks)
      .innerJoin(pcAlias, eq(pcAlias.id, pcHooks.pcEntityId))
      .where(and(...conditions))
      .orderBy(asc(pcAlias.name))
      .limit(args.limit);

    // Risolviamo i target name con un secondo SELECT (Drizzle non
    // supporta alias multipli sulla stessa tabella in single query in
    // modo elegante; due query con un id-set sono comunque rapide).
    const targetIds = Array.from(new Set(rows.map((r) => r.targetEntityId)));
    const targetNameRows = targetIds.length
      ? await db
          .select({ id: entities.id, name: entities.name })
          .from(entities)
          .where(inArray(entities.id, targetIds))
      : [];
    const nameById = new Map(targetNameRows.map((r) => [r.id, r.name]));

    return rows.map((row) => ({
      ...row,
      targetName: nameById.get(row.targetEntityId) ?? "(entita' cancellata)",
    }));
  },
};

// ─── rules_search ─────────────────────────────────────────────────────
const rulesSearchArgsSchema = z
  .object({
    query: z.string().trim().min(2).max(500),
    sources: z.array(z.string().trim().min(1)).optional(),
    limit: z.coerce.number().int().min(1).max(15).default(6),
  })
  .strict();
type RulesSearchArgs = z.infer<typeof rulesSearchArgsSchema>;

export interface RulesSearchResultRow {
  chunkId: string;
  source: string;
  title: string | null;
  section: string | null;
  content: string;
  rrfScore: number;
}

export const rulesSearchTool: SessionPrepTool<
  RulesSearchArgs,
  RulesSearchResultRow[]
> = {
  name: "rules_search",
  description:
    "Cerca nel corpus regole homebrew di Sherdan (Manuale del Giocatore, La " +
    "Forgia di Sherdan) via hybrid search (vector + trigram, RRF). Usalo " +
    "quando una domanda di prep dipende da una regola specifica (es. CD di " +
    "crafting, ricetta di un oggetto, regola di un'abilita'). Ritorna i " +
    "chunk piu' rilevanti con id, source, title, section e contenuto.",
  argsSchema: rulesSearchArgsSchema,
  async execute(_campaignId, args) {
    // Le regole sono globali (no campaignId). _campaignId e' iniettato
    // dal runner per coerenza interface ma non viene usato qui.
    void _campaignId;
    const result = await searchRules(
      {
        query: args.query,
        ...(args.sources && args.sources.length > 0
          ? { sources: args.sources }
          : {}),
        topKVector: 20,
        topKTrigram: 20,
        limit: args.limit,
        trigramThreshold: 0.05,
      },
      { embedQuery: (text) => getLLMProvider().embed(text) },
    );
    return result.hits.map((hit) => ({
      chunkId: hit.id,
      source: hit.source,
      title: hit.title,
      section: hit.section,
      content: hit.content,
      rrfScore: hit.rrfScore,
    }));
  },
};

// ─── Toolbox ──────────────────────────────────────────────────────────
// Lista esportata pronta da iniettare nell'agent. Ordine: la priorita'
// nello scegliere il prossimo tool e' "context > scoperte > dettagli >
// regole".
export const sessionPrepTools = [
  getRecentSessionsTool,
  getActivePlotThreadsTool,
  getActiveIdentitiesTool,
  getTruthProgressTool,
  getPcHooksTool,
  searchEntitiesTool,
  rulesSearchTool,
] as const;

export type SessionPrepToolName = (typeof sessionPrepTools)[number]["name"];
