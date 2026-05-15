"use client";

import { useEffect, useMemo, useState } from "react";

import { CopyForChatGptButton } from "@/components/copy-for-chatgpt-button";
import { plotRole, plotThreadStatus } from "@/db/schema";

const STATUSES = plotThreadStatus.enumValues;
type PlotStatus = (typeof STATUSES)[number];

const STATUS_LABEL: Record<PlotStatus, string> = {
  hot: "Caldo",
  warm: "Tiepido",
  cold: "Freddo",
  resolved: "Risolto",
  abandoned: "Abbandonato",
};

const STATUS_BADGE: Record<PlotStatus, string> = {
  hot: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  warm: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  cold: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  resolved:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  abandoned: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

const ROLES = plotRole.enumValues;
type PlotRole = (typeof ROLES)[number];

const ROLE_LABEL: Record<PlotRole, string> = {
  instigator: "Istigatore",
  victim: "Vittima",
  target: "Bersaglio",
  mcguffin: "McGuffin",
  witness: "Testimone",
};

// Numero di giorni di inattivita' oltre i quali un thread hot/warm e' "stale".
const STALE_DAYS = 30;

interface CampaignRow {
  id: string;
  name: string;
}

interface PlotThreadRow {
  id: string;
  campaignId: string;
  title: string;
  description: string | null;
  publicDescription: string | null;
  status: PlotStatus;
  priority: number | null;
  visibility: string;
  lastAdvancedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionRow {
  id: string;
  number: number;
  title: string | null;
  date: string | null;
}

interface EntityRow {
  id: string;
  name: string;
  type: string;
}

interface PlotThreadEntityRow {
  id: string;
  plotThreadId: string;
  entityId: string;
  role: PlotRole;
  notes: string | null;
  createdAt: string;
}

interface PlotThreadEventRow {
  id: string;
  plotThreadId: string;
  sessionId: string | null;
  eventType: string;
  description: string;
  publicDescription: string | null;
  visibility: string;
  occurredAt: string;
}

interface TruthClueRow {
  id: string;
  description: string;
  truthRevealed: string;
  relatedPlotThreadId: string | null;
  plantedInSession: string | null;
  status: string;
  statusUpdatedAt: string;
}

interface EventDraft {
  eventType: string;
  description: string;
  publicDescription: string;
  sessionId: string;
  occurredAt: string;
}

const EMPTY_EVENT_DRAFT: EventDraft = {
  eventType: "advanced",
  description: "",
  publicDescription: "",
  sessionId: "",
  occurredAt: "",
};

interface EntityDraft {
  entityId: string;
  role: PlotRole;
  notes: string;
}

const EMPTY_ENTITY_DRAFT: EntityDraft = {
  entityId: "",
  role: "instigator",
  notes: "",
};

interface ThreadDraft {
  title: string;
  description: string;
  publicDescription: string;
  status: PlotStatus;
  priority: string;
}

const EMPTY_THREAD_DRAFT: ThreadDraft = {
  title: "",
  description: "",
  publicDescription: "",
  status: "warm",
  priority: "",
};

export function PlotThreadsWorkbench() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [threads, setThreads] = useState<PlotThreadRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [threadEntities, setThreadEntities] = useState<PlotThreadEntityRow[]>(
    [],
  );
  const [threadEvents, setThreadEvents] = useState<PlotThreadEventRow[]>([]);
  const [threadClues, setThreadClues] = useState<TruthClueRow[]>([]);
  const [eventDraft, setEventDraft] = useState<EventDraft>(EMPTY_EVENT_DRAFT);
  const [entityDraft, setEntityDraft] = useState<EntityDraft>(
    EMPTY_ENTITY_DRAFT,
  );
  const [threadDraft, setThreadDraft] =
    useState<ThreadDraft>(EMPTY_THREAD_DRAFT);
  const [threadDraftOpen, setThreadDraftOpen] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingThread, setSavingThread] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingEntity, setSavingEntity] = useState(false);
  const [targetThreadId] = useState(() => queryParam("thread"));
  const [targetCampaignId] = useState(() => queryParam("campaign_id"));
  const [refreshToken, setRefreshToken] = useState(0);
  const [detailRefreshToken, setDetailRefreshToken] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await apiFetch<CampaignRow[]>("/api/campaigns");
        if (cancelled) return;
        setCampaigns(rows);
        setCampaignId((current) =>
          targetCampaignId && rows.some((row) => row.id === targetCampaignId)
            ? targetCampaignId
            : current || (rows[0]?.id ?? ""),
        );
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [targetCampaignId]);

  useEffect(() => {
    let cancelled = false;
    async function loadAuxiliaries() {
      if (!campaignId) {
        setSessions([]);
        setEntities([]);
        return;
      }
      try {
        const [sess, ents] = await Promise.all([
          apiFetch<SessionRow[]>(
            `/api/sessions?campaign_id=${encodeURIComponent(campaignId)}`,
          ),
          apiFetch<EntityRow[]>(
            `/api/entities?campaign_id=${encodeURIComponent(campaignId)}&sort=name_asc&limit=500`,
          ),
        ]);
        if (cancelled) return;
        setSessions(sess);
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
    async function load() {
      if (!campaignId) {
        setThreads([]);
        return;
      }
      setLoadingThreads(true);
      try {
        const rows = await apiFetch<PlotThreadRow[]>(
          `/api/plot-threads?campaign_id=${encodeURIComponent(campaignId)}&limit=200`,
        );
        if (cancelled) return;
        setThreads(rows);
        setSelectedId((current) =>
          targetThreadId && rows.some((t) => t.id === targetThreadId)
            ? targetThreadId
            : rows.some((t) => t.id === current)
              ? current
              : (rows[0]?.id ?? null),
        );
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setLoadingThreads(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [campaignId, refreshToken, targetThreadId]);

  useEffect(() => {
    let cancelled = false;
    async function loadDetail() {
      if (!selectedId) {
        setThreadEntities([]);
        setThreadEvents([]);
        setThreadClues([]);
        return;
      }
      setLoadingDetail(true);
      try {
        const [ents, evts, clues] = await Promise.all([
          apiFetch<PlotThreadEntityRow[]>(
            `/api/plot-thread-entities?plot_thread_id=${encodeURIComponent(selectedId)}&limit=200`,
          ),
          apiFetch<PlotThreadEventRow[]>(
            `/api/plot-thread-events?plot_thread_id=${encodeURIComponent(selectedId)}&limit=200`,
          ),
          campaignId
            ? apiFetch<TruthClueRow[]>(
                `/api/truth-clues?campaign_id=${encodeURIComponent(campaignId)}&related_plot_thread_id=${encodeURIComponent(selectedId)}&limit=200`,
              )
            : Promise.resolve([] as TruthClueRow[]),
        ]);
        if (cancelled) return;
        setThreadEntities(ents);
        setThreadEvents(evts);
        setThreadClues(clues);
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }
    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId, campaignId, detailRefreshToken]);

  const selected = useMemo(
    () => threads.find((t) => t.id === selectedId) ?? null,
    [threads, selectedId],
  );
  const sessionById = useMemo(() => {
    const map = new Map<string, SessionRow>();
    for (const s of sessions) map.set(s.id, s);
    return map;
  }, [sessions]);
  const entityById = useMemo(() => {
    const map = new Map<string, EntityRow>();
    for (const e of entities) map.set(e.id, e);
    return map;
  }, [entities]);

  const staleThreads = useMemo(
    () => threads.filter((t) => isStale(t)),
    [threads],
  );

  function refreshThreads() {
    setRefreshToken((value) => value + 1);
  }
  function refreshDetail() {
    setDetailRefreshToken((value) => value + 1);
  }

  async function createThread(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignId || !threadDraft.title.trim()) return;
    setSavingThread(true);
    setError(null);
    setMessage(null);
    try {
      const created = await apiFetch<PlotThreadRow>("/api/plot-threads", {
        method: "POST",
        body: JSON.stringify({
          campaignId,
          title: threadDraft.title.trim(),
          description: threadDraft.description.trim() || null,
          publicDescription: threadDraft.publicDescription.trim() || null,
          status: threadDraft.status,
          priority: threadDraft.priority
            ? Number(threadDraft.priority)
            : null,
        }),
      });
      setSelectedId(created.id);
      setThreadDraft(EMPTY_THREAD_DRAFT);
      setThreadDraftOpen(false);
      setMessage("Plot thread creato.");
      refreshThreads();
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setSavingThread(false);
    }
  }

  async function changeStatus(thread: PlotThreadRow, status: PlotStatus) {
    if (thread.status === status) return;
    setError(null);
    setMessage(null);
    try {
      await apiFetch<PlotThreadRow>(`/api/plot-threads/${thread.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMessage(`Thread "${thread.title}" -> ${STATUS_LABEL[status]}.`);
      refreshThreads();
    } catch (err) {
      setError(messageForError(err));
    }
  }

  async function updateThreadDescriptions(input: {
    description?: string | null;
    publicDescription?: string | null;
  }) {
    if (!selected) return;
    setError(null);
    setMessage(null);
    try {
      await apiFetch<PlotThreadRow>(`/api/plot-threads/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
      setMessage("Descrizione aggiornata.");
      refreshThreads();
    } catch (err) {
      setError(messageForError(err));
    }
  }

  async function addEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !eventDraft.description.trim()) return;
    setSavingEvent(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<PlotThreadEventRow>(`/api/plot-thread-events`, {
        method: "POST",
        body: JSON.stringify({
          plotThreadId: selected.id,
          sessionId: eventDraft.sessionId || null,
          eventType: eventDraft.eventType.trim() || "advanced",
          description: eventDraft.description.trim(),
          publicDescription: eventDraft.publicDescription.trim() || null,
          occurredAt: eventDraft.occurredAt || undefined,
        }),
      });
      setEventDraft(EMPTY_EVENT_DRAFT);
      setMessage("Evento aggiunto. Thread avanzato.");
      refreshDetail();
      refreshThreads();
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setSavingEvent(false);
    }
  }

  async function deleteEvent(eventId: string) {
    if (!confirm("Eliminare questo evento dalla timeline?")) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/plot-thread-events/${eventId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      setMessage("Evento eliminato.");
      refreshDetail();
    } catch (err) {
      setError(messageForError(err));
    }
  }

  async function addEntity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !entityDraft.entityId) return;
    setSavingEntity(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<PlotThreadEntityRow>(`/api/plot-thread-entities`, {
        method: "POST",
        body: JSON.stringify({
          plotThreadId: selected.id,
          entityId: entityDraft.entityId,
          role: entityDraft.role,
          notes: entityDraft.notes.trim() || null,
        }),
      });
      setEntityDraft(EMPTY_ENTITY_DRAFT);
      setMessage("Entita' collegata.");
      refreshDetail();
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setSavingEntity(false);
    }
  }

  async function removeEntity(entityRowId: string) {
    if (!confirm("Rimuovere questa entita' dal plot thread?")) return;
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/plot-thread-entities/${entityRowId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      setMessage("Entita' rimossa.");
      refreshDetail();
    } catch (err) {
      setError(messageForError(err));
    }
  }

  const selectedCampaignName =
    campaigns.find((c) => c.id === campaignId)?.name ?? "Nessuna campagna";

  const truthProgress = useMemo(() => {
    if (threadClues.length === 0) return null;
    const understood = threadClues.filter(
      (c) => c.status === "understood",
    ).length;
    return {
      total: threadClues.length,
      understood,
      pct: Math.round((understood / threadClues.length) * 100),
    };
  }, [threadClues]);
  const selectedChatGptMarkdown = selected
    ? buildPlotThreadChatGptMarkdown({
        thread: selected,
        threadEvents,
        threadClues,
        threadEntities,
        entityById,
        sessionById,
      })
    : "";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Plot Threads
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Fase 6 · Doppio arco, timeline eventi, briciole correlate e stale
            alerts.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
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
          <button
            type="button"
            onClick={() => {
              setThreadDraftOpen((open) => !open);
              setThreadDraft(EMPTY_THREAD_DRAFT);
            }}
            disabled={!campaignId}
            className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {threadDraftOpen ? "Chiudi" : "+ Nuovo thread"}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
          {message}
        </div>
      )}

      {staleThreads.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-900/30">
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Stale alert · {staleThreads.length} thread fermi da oltre{" "}
            {STALE_DAYS} giorni
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-amber-900 dark:text-amber-100">
            {staleThreads.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-2"
              >
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={() => setSelectedId(t.id)}
                >
                  {t.title}
                </button>
                <span className="text-amber-700 dark:text-amber-300">
                  {t.lastAdvancedAt
                    ? `ultimo evento ${formatRelative(t.lastAdvancedAt)}`
                    : "nessun evento registrato"}
                </span>
                <button
                  type="button"
                  className="ml-auto rounded bg-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-300 dark:bg-amber-800 dark:text-amber-100 dark:hover:bg-amber-700"
                  onClick={() =>
                    changeStatus(t, t.status === "hot" ? "warm" : "cold")
                  }
                >
                  Demote a {t.status === "hot" ? "Tiepido" : "Freddo"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {threadDraftOpen && (
        <form
          onSubmit={createThread}
          className="space-y-4 rounded-lg border border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-900/70"
        >
          <h2 className="text-lg font-semibold">Nuovo plot thread</h2>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Titolo
            </span>
            <input
              value={threadDraft.title}
              onChange={(e) =>
                setThreadDraft({ ...threadDraft, title: e.target.value })
              }
              required
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Verita&apos; GM
              </span>
              <textarea
                value={threadDraft.description}
                onChange={(e) =>
                  setThreadDraft({
                    ...threadDraft,
                    description: e.target.value,
                  })
                }
                rows={4}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Versione percepita dal party
              </span>
              <textarea
                value={threadDraft.publicDescription}
                onChange={(e) =>
                  setThreadDraft({
                    ...threadDraft,
                    publicDescription: e.target.value,
                  })
                }
                rows={4}
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Status
              </span>
              <select
                value={threadDraft.status}
                onChange={(e) =>
                  setThreadDraft({
                    ...threadDraft,
                    status: e.target.value as PlotStatus,
                  })
                }
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Priorita&apos; (0-100)
              </span>
              <input
                type="number"
                min={0}
                max={100}
                value={threadDraft.priority}
                onChange={(e) =>
                  setThreadDraft({ ...threadDraft, priority: e.target.value })
                }
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingThread}
              className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {savingThread ? "Salvataggio..." : "Crea thread"}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
        {/* Kanban */}
        <section className="space-y-3">
          <header className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
            Kanban · {threads.length} thread · {selectedCampaignName}
          </header>
          {loadingThreads ? (
            <p className="text-xs text-zinc-500">Caricamento...</p>
          ) : (
            <div className="grid gap-3">
              {STATUSES.map((status) => {
                const list = threads.filter((t) => t.status === status);
                return (
                  <div
                    key={status}
                    className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <header className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 text-xs font-semibold uppercase dark:border-zinc-800">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${STATUS_BADGE[status]}`}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                      <span className="text-zinc-500">{list.length}</span>
                    </header>
                    {list.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-zinc-400">
                        Nessun thread.
                      </p>
                    ) : (
                      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {list.map((t) => {
                          const stale = isStale(t);
                          return (
                            <li key={t.id}>
                              <button
                                type="button"
                                onClick={() => setSelectedId(t.id)}
                                className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                                  selectedId === t.id
                                    ? "bg-zinc-100 dark:bg-zinc-800"
                                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate font-medium">
                                    {t.title}
                                  </span>
                                  {stale && (
                                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                                      stale
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 flex flex-wrap gap-2 text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                                  {t.priority !== null && (
                                    <span>P{t.priority}</span>
                                  )}
                                  <span>
                                    {t.lastAdvancedAt
                                      ? formatRelative(t.lastAdvancedAt)
                                      : "mai avanzato"}
                                  </span>
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Detail */}
        <section className="space-y-4">
          {!selected ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
              Seleziona un plot thread dal Kanban per vedere il doppio arco, la
              timeline e le briciole correlate.
            </div>
          ) : (
            <>
              <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {selected.title}
                  </h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_BADGE[selected.status]}`}
                  >
                    {STATUS_LABEL[selected.status]}
                  </span>
                  <CopyForChatGptButton text={selectedChatGptMarkdown} />
                  <div className="ml-auto flex flex-wrap items-center gap-1 text-xs">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        disabled={s === selected.status}
                        onClick={() => changeStatus(selected, s)}
                        className={`rounded px-2 py-1 text-[11px] uppercase tracking-wide ${
                          s === selected.status
                            ? `${STATUS_BADGE[s]} ring-1 ring-zinc-400`
                            : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {STATUS_LABEL[s]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {selected.priority !== null && (
                    <span>Priorita&apos;: {selected.priority}</span>
                  )}
                  <span>
                    Ultimo evento:{" "}
                    {selected.lastAdvancedAt
                      ? new Date(selected.lastAdvancedAt).toLocaleString()
                      : "—"}
                  </span>
                  <span>
                    Creato: {new Date(selected.createdAt).toLocaleDateString()}
                  </span>
                </div>
                {truthProgress && (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100">
                    Verita&apos; rivelata: {truthProgress.understood}/
                    {truthProgress.total} briciole capite (
                    {truthProgress.pct}%)
                  </div>
                )}
              </div>

              {/* Split-screen doppio arco */}
              <div className="grid gap-3 lg:grid-cols-2">
                <DescriptionPanel
                  key={`${selected.id}-gm`}
                  title="Verita&apos; GM"
                  hint="Cosa sta realmente accadendo dietro le quinte."
                  value={selected.description ?? ""}
                  onSave={(value) =>
                    updateThreadDescriptions({
                      description: value.trim() ? value : null,
                    })
                  }
                />
                <DescriptionPanel
                  key={`${selected.id}-public`}
                  title="Versione percepita dal party"
                  hint="Cosa il party crede stia accadendo (propaganda, voci, ipotesi)."
                  value={selected.publicDescription ?? ""}
                  onSave={(value) =>
                    updateThreadDescriptions({
                      publicDescription: value.trim() ? value : null,
                    })
                  }
                />
              </div>

              {/* Timeline */}
              <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <header className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
                  Timeline eventi
                </header>
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {threadEvents.length === 0 ? (
                    <li className="px-4 py-4 text-xs text-zinc-500">
                      Nessun evento registrato.
                    </li>
                  ) : (
                    threadEvents.map((evt) => {
                      const session = evt.sessionId
                        ? sessionById.get(evt.sessionId)
                        : null;
                      return (
                        <li
                          key={evt.id}
                          className="grid gap-3 px-4 py-3 sm:grid-cols-[120px_1fr_1fr_auto]"
                        >
                          <div className="text-xs text-zinc-500">
                            <div>
                              {new Date(evt.occurredAt).toLocaleDateString()}
                            </div>
                            <div className="font-semibold uppercase tracking-wide">
                              {evt.eventType}
                            </div>
                            {session && (
                              <div>
                                #{session.number}
                                {session.title ? ` ${session.title}` : ""}
                              </div>
                            )}
                          </div>
                          <div className="text-xs">
                            <div className="mb-0.5 font-semibold text-zinc-500 dark:text-zinc-400">
                              GM
                            </div>
                            <p className="text-zinc-800 dark:text-zinc-100">
                              {evt.description}
                            </p>
                          </div>
                          <div className="text-xs">
                            <div className="mb-0.5 font-semibold text-zinc-500 dark:text-zinc-400">
                              Percepito
                            </div>
                            <p className="text-zinc-700 dark:text-zinc-200">
                              {evt.publicDescription ?? (
                                <span className="italic text-zinc-400">
                                  —
                                </span>
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => deleteEvent(evt.id)}
                            className="self-start text-xs text-red-600 hover:text-red-700"
                          >
                            Elimina
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
                <form
                  onSubmit={addEvent}
                  className="grid gap-3 border-t border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/70"
                >
                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="grid gap-1">
                      <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                        Tipo evento
                      </span>
                      <input
                        list="event-type-options"
                        value={eventDraft.eventType}
                        onChange={(e) =>
                          setEventDraft({
                            ...eventDraft,
                            eventType: e.target.value,
                          })
                        }
                        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      />
                      <datalist id="event-type-options">
                        <option value="introduced" />
                        <option value="advanced" />
                        <option value="twist" />
                        <option value="public_reveal" />
                        <option value="private_reveal" />
                        <option value="resolved" />
                      </datalist>
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                        Sessione (opzionale)
                      </span>
                      <select
                        value={eventDraft.sessionId}
                        onChange={(e) =>
                          setEventDraft({
                            ...eventDraft,
                            sessionId: e.target.value,
                          })
                        }
                        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      >
                        <option value="">—</option>
                        {sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            #{s.number} {s.title ?? ""}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                        Avvenuto il (opzionale)
                      </span>
                      <input
                        type="datetime-local"
                        value={eventDraft.occurredAt}
                        onChange={(e) =>
                          setEventDraft({
                            ...eventDraft,
                            occurredAt: e.target.value,
                          })
                        }
                        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      />
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                        Descrizione GM
                      </span>
                      <textarea
                        value={eventDraft.description}
                        onChange={(e) =>
                          setEventDraft({
                            ...eventDraft,
                            description: e.target.value,
                          })
                        }
                        rows={3}
                        required
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                        Versione percepita (opzionale)
                      </span>
                      <textarea
                        value={eventDraft.publicDescription}
                        onChange={(e) =>
                          setEventDraft({
                            ...eventDraft,
                            publicDescription: e.target.value,
                          })
                        }
                        rows={3}
                        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                      />
                    </label>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={savingEvent}
                      className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    >
                      {savingEvent ? "..." : "Aggiungi evento"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Entities coinvolte */}
              <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <header className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
                  Entita&apos; coinvolte
                </header>
                {loadingDetail ? (
                  <p className="px-4 py-3 text-xs text-zinc-500">
                    Caricamento...
                  </p>
                ) : threadEntities.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-zinc-500">
                    Nessuna entita&apos; collegata.
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {threadEntities.map((pte) => {
                      const entity = entityById.get(pte.entityId);
                      return (
                        <li
                          key={pte.id}
                          className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm"
                        >
                          <span className="font-medium">
                            {entity?.name ?? "(entita' eliminata)"}
                          </span>
                          <span className="text-xs text-zinc-500">
                            ({entity?.type ?? "?"})
                          </span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] uppercase tracking-wide text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {ROLE_LABEL[pte.role]}
                          </span>
                          {pte.notes && (
                            <span className="text-xs text-zinc-500">
                              {pte.notes}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeEntity(pte.id)}
                            className="ml-auto text-xs text-red-600 hover:text-red-700"
                          >
                            Rimuovi
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <form
                  onSubmit={addEntity}
                  className="grid gap-3 border-t border-zinc-200 bg-zinc-50 p-4 sm:grid-cols-[1fr_180px_auto] dark:border-zinc-800 dark:bg-zinc-900/70"
                >
                  <select
                    value={entityDraft.entityId}
                    onChange={(e) =>
                      setEntityDraft({
                        ...entityDraft,
                        entityId: e.target.value,
                      })
                    }
                    required
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <option value="">Scegli entita&apos;...</option>
                    {entities.map((entity) => (
                      <option key={entity.id} value={entity.id}>
                        {entity.name} ({entity.type})
                      </option>
                    ))}
                  </select>
                  <select
                    value={entityDraft.role}
                    onChange={(e) =>
                      setEntityDraft({
                        ...entityDraft,
                        role: e.target.value as PlotRole,
                      })
                    }
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={savingEntity}
                    className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                  >
                    {savingEntity ? "..." : "Collega"}
                  </button>
                  <input
                    value={entityDraft.notes}
                    onChange={(e) =>
                      setEntityDraft({ ...entityDraft, notes: e.target.value })
                    }
                    placeholder="Note opzionali (es. 'pensa di essere alleato')"
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm sm:col-span-3 dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </form>
              </div>

              {/* Briciole correlate */}
              <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                <header className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
                  Briciole correlate
                </header>
                {threadClues.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-zinc-500">
                    Nessuna briciola collegata. Piantale dal{" "}
                    <a
                      href="/truth-clues"
                      className="underline underline-offset-2"
                    >
                      Truth Clue Tracker
                    </a>
                    .
                  </p>
                ) : (
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {threadClues.map((clue) => (
                      <li
                        key={clue.id}
                        className="space-y-1 px-4 py-3 text-xs"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            {clue.status}
                          </span>
                          <span className="font-medium text-zinc-800 dark:text-zinc-100">
                            {clue.description}
                          </span>
                        </div>
                        <p className="text-zinc-500">
                          Verita&apos;: {clue.truthRevealed}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

interface DescriptionPanelProps {
  title: string;
  hint: string;
  value: string;
  onSave: (next: string) => void | Promise<void>;
}

function DescriptionPanel({
  title,
  hint,
  value,
  onSave,
}: DescriptionPanelProps) {
  // Lo stato di draft/editing e' locale e si resetta al cambio di thread/field
  // tramite la `key` impostata dal parent: cosi' non serve sincronizzare lo
  // stato in useEffect (lint react-hooks/set-state-in-effect).
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function commit() {
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {editing ? "Annulla" : "Modifica"}
        </button>
      </header>
      <div className="px-4 py-3 text-xs text-zinc-500">{hint}</div>
      {editing ? (
        <div className="space-y-2 px-4 pb-4">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={commit}
              disabled={saving}
              className="h-9 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {saving ? "..." : "Salva"}
            </button>
          </div>
        </div>
      ) : (
        <div className="whitespace-pre-wrap px-4 pb-4 text-sm text-zinc-800 dark:text-zinc-100">
          {value || <span className="italic text-zinc-400">Vuoto</span>}
        </div>
      )}
    </div>
  );
}

function isStale(thread: PlotThreadRow): boolean {
  if (thread.status !== "hot" && thread.status !== "warm") return false;
  const reference = thread.lastAdvancedAt ?? thread.createdAt;
  const last = new Date(reference).getTime();
  if (Number.isNaN(last)) return false;
  const ageDays = (Date.now() - last) / 86_400_000;
  return ageDays > STALE_DAYS;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = Date.now() - then;
  const days = Math.floor(diff / 86_400_000);
  if (days < 1) return "oggi";
  if (days === 1) return "ieri";
  if (days < 30) return `${days} giorni fa`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mesi fa`;
  const years = Math.floor(days / 365);
  return `${years} anni fa`;
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
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

function buildPlotThreadChatGptMarkdown({
  thread,
  threadEvents,
  threadClues,
  threadEntities,
  entityById,
  sessionById,
}: {
  thread: PlotThreadRow;
  threadEvents: PlotThreadEventRow[];
  threadClues: TruthClueRow[];
  threadEntities: PlotThreadEntityRow[];
  entityById: Map<string, EntityRow>;
  sessionById: Map<string, SessionRow>;
}) {
  return [
    `# Copy-for-ChatGPT: Plot thread - ${thread.title}`,
    "",
    `Status: ${thread.status}`,
    `Priorita: ${thread.priority ?? "non impostata"}`,
    "",
    "## Verita GM",
    thread.description?.trim() || "_Vuoto_",
    "",
    "## Versione percepita",
    thread.publicDescription?.trim() || "_Vuoto_",
    "",
    "## Entita coinvolte",
    listOrEmpty(
      threadEntities.map((row) => {
        const entity = entityById.get(row.entityId);
        return `- ${entity?.name ?? "Entita sconosciuta"} (${row.role})${row.notes ? `: ${row.notes}` : ""}`;
      }),
    ),
    "",
    "## Timeline",
    listOrEmpty(
      threadEvents.map((event) => {
        const session = event.sessionId ? sessionById.get(event.sessionId) : null;
        return `- ${new Date(event.occurredAt).toLocaleDateString("it-IT")} ${session ? `S${session.number} ` : ""}[${event.eventType}]: ${event.description}${event.publicDescription ? `\n  - Percepito: ${event.publicDescription}` : ""}`;
      }),
    ),
    "",
    "## Briciole correlate",
    listOrEmpty(
      threadClues.map(
        (clue) =>
          `- [${clue.status}] ${clue.description}\n  - Verita GM: ${clue.truthRevealed}`,
      ),
    ),
  ].join("\n");
}

function listOrEmpty(rows: string[]) {
  return rows.length > 0 ? rows.join("\n") : "_Nessun elemento._";
}

function queryParam(name: string) {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}
