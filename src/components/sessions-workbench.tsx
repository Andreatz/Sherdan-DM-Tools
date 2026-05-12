"use client";

import { useEffect, useMemo, useState } from "react";

interface CampaignRow {
  id: string;
  name: string;
}

interface SessionRow {
  id: string;
  campaignId: string;
  number: number;
  title: string | null;
  date: string | null;
  recap: string | null;
  dmNotes: string | null;
  prepNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PlotThreadEventRow {
  id: string;
  plotThreadId: string;
  sessionId: string | null;
  eventType: string;
  description: string;
  publicDescription: string | null;
  occurredAt: string;
}

interface PlotThreadRow {
  id: string;
  title: string;
  status: string;
}

interface TruthClueRow {
  id: string;
  description: string;
  truthRevealed: string;
  status: string;
  relatedPlotThreadId: string | null;
}

interface SessionEntityRow {
  id: string;
  sessionId: string;
  entityId: string;
  role: string;
  notes: string | null;
}

interface EntityRow {
  id: string;
  name: string;
  type: string;
}

export function SessionsWorkbench() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDmNotes, setShowDmNotes] = useState(false);
  const [plotThreads, setPlotThreads] = useState<PlotThreadRow[]>([]);
  const [events, setEvents] = useState<PlotThreadEventRow[]>([]);
  const [plantedClues, setPlantedClues] = useState<TruthClueRow[]>([]);
  const [sessionEntities, setSessionEntities] = useState<SessionEntityRow[]>(
    [],
  );
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await apiFetch<CampaignRow[]>("/api/campaigns");
        if (cancelled) return;
        setCampaigns(rows);
        setCampaignId((current) => current || (rows[0]?.id ?? ""));
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!campaignId) {
        setSessions([]);
        return;
      }
      setLoadingSessions(true);
      try {
        const rows = await apiFetch<SessionRow[]>(
          `/api/sessions?campaign_id=${encodeURIComponent(campaignId)}&include_notes=true`,
        );
        if (cancelled) return;
        setSessions(rows);
        setSelectedId((current) =>
          rows.some((s) => s.id === current)
            ? current
            : (rows[rows.length - 1]?.id ?? null),
        );
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;
    async function loadAuxiliaries() {
      if (!campaignId) {
        setPlotThreads([]);
        setEntities([]);
        return;
      }
      try {
        const [pt, ents] = await Promise.all([
          apiFetch<PlotThreadRow[]>(
            `/api/plot-threads?campaign_id=${encodeURIComponent(campaignId)}&limit=200`,
          ),
          apiFetch<EntityRow[]>(
            `/api/entities?campaign_id=${encodeURIComponent(campaignId)}&sort=name_asc&limit=500`,
          ),
        ]);
        if (cancelled) return;
        setPlotThreads(pt);
        setEntities(ents);
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      }
    }
    void loadAuxiliaries();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;
    async function loadSessionContext() {
      if (!selectedId || !campaignId) {
        setEvents([]);
        setPlantedClues([]);
        setSessionEntities([]);
        return;
      }
      try {
        const [evts, clues, sEnts] = await Promise.all([
          apiFetch<PlotThreadEventRow[]>(
            `/api/plot-thread-events?session_id=${encodeURIComponent(selectedId)}&limit=200`,
          ),
          apiFetch<TruthClueRow[]>(
            `/api/truth-clues?campaign_id=${encodeURIComponent(campaignId)}&planted_in_session=${encodeURIComponent(selectedId)}&limit=200`,
          ),
          // session_entities non ha un endpoint dedicato lato API; lo
          // skippiamo finche' non serve: il recap parser sincronizza gia'
          // le menzioni automatiche tramite wikilink.
          Promise.resolve([] as SessionEntityRow[]),
        ]);
        if (cancelled) return;
        setEvents(evts);
        setPlantedClues(clues);
        setSessionEntities(sEnts);
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      }
    }
    void loadSessionContext();
    return () => {
      cancelled = true;
    };
  }, [selectedId, campaignId]);

  const selected = useMemo(
    () => sessions.find((s) => s.id === selectedId) ?? null,
    [sessions, selectedId],
  );
  const plotThreadById = useMemo(() => {
    const map = new Map<string, PlotThreadRow>();
    for (const t of plotThreads) map.set(t.id, t);
    return map;
  }, [plotThreads]);
  const entityById = useMemo(() => {
    const map = new Map<string, EntityRow>();
    for (const e of entities) map.set(e.id, e);
    return map;
  }, [entities]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Sessioni</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Fase 6 · Recap, dm_notes (toggle), prep_notes e cosa e&apos; avanzato
            in ciascuna sessione.
          </p>
        </div>
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
            Campagna
          </span>
          <select
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
          >
            {campaigns.length === 0 ? (
              <option value="">Nessuna campagna</option>
            ) : (
              campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        </label>
      </header>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <header className="border-b border-zinc-200 px-4 py-2 text-xs font-semibold uppercase text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {loadingSessions
              ? "Caricamento..."
              : `${sessions.length} sessioni`}
          </header>
          {sessions.length === 0 ? (
            <p className="px-4 py-3 text-xs text-zinc-500">
              Nessuna sessione registrata.
            </p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={`flex w-full flex-col items-start gap-0.5 px-4 py-2 text-left text-sm ${
                      selectedId === s.id
                        ? "bg-zinc-100 dark:bg-zinc-800"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <span className="font-medium">
                      #{s.number}
                      {s.title ? ` · ${s.title}` : ""}
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      {s.date ? new Date(s.date).toLocaleDateString() : "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="space-y-4">
          {!selected ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              Seleziona una sessione dalla lista per vedere il recap e cosa
              e&apos; avanzato.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Sessione #{selected.number}
                  {selected.title ? ` · ${selected.title}` : ""}
                </h2>
                <span className="text-xs text-zinc-500">
                  {selected.date
                    ? new Date(selected.date).toLocaleDateString()
                    : "Senza data"}
                </span>
                <label className="ml-auto flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={showDmNotes}
                    onChange={(e) => setShowDmNotes(e.target.checked)}
                  />
                  Mostra DM notes
                </label>
              </div>

              <RecapPanel
                title="Recap (in fiction)"
                hint="Cosa il party ha vissuto. Sicuro da mostrare ai giocatori."
                value={selected.recap}
              />
              {showDmNotes && (
                <RecapPanel
                  title="DM notes (GM-only)"
                  hint="Interpretazioni, retcon, intuizioni private. Non mostrare ai giocatori."
                  value={selected.dmNotes}
                  accent="amber"
                />
              )}
              {selected.prepNotes && (
                <RecapPanel
                  title="Prep notes (pre-sessione)"
                  hint="Cosa hai preparato prima della sessione."
                  value={selected.prepNotes}
                />
              )}

              <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <header className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
                  Plot thread avanzati in questa sessione
                </header>
                {events.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-zinc-500">
                    Nessun evento registrato per questa sessione. Aggiungili
                    dal{" "}
                    <a
                      href="/plot-threads"
                      className="underline underline-offset-2"
                    >
                      Plot Threads workbench
                    </a>
                    .
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {events.map((evt) => {
                      const thread = plotThreadById.get(evt.plotThreadId);
                      return (
                        <li key={evt.id} className="px-4 py-3 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                              {thread?.title ?? "(thread sconosciuto)"}
                            </span>
                            <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                              {evt.eventType}
                            </span>
                          </div>
                          <p className="mt-1 text-zinc-700 dark:text-zinc-200">
                            {evt.description}
                          </p>
                          {evt.publicDescription && (
                            <p className="text-zinc-500">
                              Versione percepita: {evt.publicDescription}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <header className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
                  Briciole piantate in questa sessione
                </header>
                {plantedClues.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-zinc-500">
                    Nessuna briciola registrata come piantata in questa
                    sessione.
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {plantedClues.map((clue) => (
                      <li key={clue.id} className="px-4 py-3 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {clue.status}
                          </span>
                          <span className="font-semibold text-zinc-800 dark:text-zinc-100">
                            {clue.description}
                          </span>
                          {clue.relatedPlotThreadId && (
                            <span className="text-zinc-500">
                              ·{" "}
                              {plotThreadById.get(clue.relatedPlotThreadId)
                                ?.title ?? "(thread)"}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-zinc-500">
                          Verita&apos;: {clue.truthRevealed}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {sessionEntities.length > 0 && (
                <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                  <h3 className="mb-2 text-sm font-semibold">
                    Entita&apos; menzionate
                  </h3>
                  <ul className="flex flex-wrap gap-2">
                    {sessionEntities.map((se) => {
                      const entity = entityById.get(se.entityId);
                      return (
                        <li
                          key={se.id}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800"
                        >
                          {entity?.name ?? "(?)"} ({se.role})
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

interface RecapPanelProps {
  title: string;
  hint: string;
  value: string | null;
  accent?: "amber";
}

function RecapPanel({ title, hint, value, accent }: RecapPanelProps) {
  const border =
    accent === "amber"
      ? "border-amber-300 dark:border-amber-700"
      : "border-zinc-200 dark:border-zinc-800";
  const bg =
    accent === "amber"
      ? "bg-amber-50 dark:bg-amber-900/20"
      : "bg-white dark:bg-zinc-900";
  return (
    <div className={`rounded-lg border ${border} ${bg}`}>
      <header className="border-b border-inherit px-4 py-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      </header>
      <div className="whitespace-pre-wrap px-4 py-3 text-sm text-zinc-800 dark:text-zinc-100">
        {value && value.trim() ? (
          value
        ) : (
          <span className="italic text-zinc-400">Vuoto</span>
        )}
      </div>
    </div>
  );
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

function messageForError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
