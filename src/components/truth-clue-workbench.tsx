"use client";

import { useEffect, useMemo, useState } from "react";

import { CopyForChatGptButton } from "@/components/copy-for-chatgpt-button";
import { clueStatus } from "@/db/schema";
import { PlayerOverrideEditor } from "@/components/player-override-editor";
import { apiFetch, messageForError } from "@/lib/client-api";

const CLUE_STATUSES = clueStatus.enumValues;

type ClueStatus = (typeof CLUE_STATUSES)[number];

const STATUS_LABEL: Record<ClueStatus, string> = {
  planted: "Piantata",
  noticed: "Notata",
  misinterpreted: "Fraintesa",
  understood: "Capita",
  lost: "Persa",
};

const STATUS_CLASS: Record<ClueStatus, string> = {
  planted:
    "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  noticed:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  misinterpreted:
    "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
  understood:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  lost: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

interface CampaignRow {
  id: string;
  name: string;
}

interface PlotThreadRow {
  id: string;
  title: string;
  status: string;
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

interface TruthClueRow {
  id: string;
  campaignId: string;
  description: string;
  truthRevealed: string;
  relatedPlotThreadId: string | null;
  relatedEntities: string[];
  plantedInSession: string | null;
  status: ClueStatus;
  statusNotes: string | null;
  statusUpdatedAt: string;
  createdAt: string;
}

interface DashboardThreadRow {
  plotThreadId: string | null;
  plotThreadTitle: string | null;
  plotThreadStatus: string | null;
  total: number;
  planted: number;
  noticed: number;
  misinterpreted: number;
  understood: number;
  lost: number;
  understoodPct: number;
}

interface DashboardResponse {
  campaignId: string;
  threads: DashboardThreadRow[];
}

interface DraftClue {
  id: string | null;
  description: string;
  truthRevealed: string;
  relatedPlotThreadId: string;
  plantedInSession: string;
  relatedEntities: string[];
  status: ClueStatus;
  statusNotes: string;
}

const EMPTY_DRAFT: DraftClue = {
  id: null,
  description: "",
  truthRevealed: "",
  relatedPlotThreadId: "",
  plantedInSession: "",
  relatedEntities: [],
  status: "planted",
  statusNotes: "",
};

export function TruthClueWorkbench() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [plotThreads, setPlotThreads] = useState<PlotThreadRow[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [clues, setClues] = useState<TruthClueRow[]>([]);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [filterStatus, setFilterStatus] = useState<ClueStatus | "all">("all");
  const [filterPlotThreadId, setFilterPlotThreadId] = useState<string>("");
  const [filterSessionId, setFilterSessionId] = useState<string>("");
  const [filterEntityId, setFilterEntityId] = useState<string>("");
  const [draft, setDraft] = useState<DraftClue>(EMPTY_DRAFT);
  const [draftOpen, setDraftOpen] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingClues, setLoadingClues] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);
  const [targetClueId] = useState(() => queryParam("clue"));
  const [targetCampaignId] = useState(() => queryParam("campaign_id"));
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  function triggerRefresh() {
    setRefreshToken((value) => value + 1);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoadingCampaigns(true);
      setError(null);
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
      } finally {
        if (!cancelled) setLoadingCampaigns(false);
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
        setPlotThreads([]);
        setSessions([]);
        setEntities([]);
        return;
      }
      try {
        const [threads, sess, ents] = await Promise.all([
          apiFetch<PlotThreadRow[]>(
            `/api/plot-threads?campaign_id=${encodeURIComponent(campaignId)}`,
          ),
          apiFetch<SessionRow[]>(
            `/api/sessions?campaign_id=${encodeURIComponent(campaignId)}`,
          ),
          apiFetch<EntityRow[]>(
            `/api/entities?campaign_id=${encodeURIComponent(campaignId)}&sort=name_asc&limit=500`,
          ),
        ]);
        if (cancelled) return;
        setPlotThreads(threads);
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
    async function loadClues() {
      if (!campaignId) {
        setClues([]);
        return;
      }
      setLoadingClues(true);
      setError(null);
      try {
        const params = new URLSearchParams({ campaign_id: campaignId });
        if (filterStatus !== "all") params.set("status", filterStatus);
        if (filterPlotThreadId)
          params.set("related_plot_thread_id", filterPlotThreadId);
        if (filterSessionId) params.set("planted_in_session", filterSessionId);
        if (filterEntityId) params.set("related_entity_id", filterEntityId);
        const rows = await apiFetch<TruthClueRow[]>(
          `/api/truth-clues?${params.toString()}`,
        );
        if (cancelled) return;
        setClues(sortTargetFirst(rows, targetClueId));
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setLoadingClues(false);
      }
    }
    void loadClues();
    return () => {
      cancelled = true;
    };
  }, [
    campaignId,
    filterStatus,
    filterPlotThreadId,
    filterSessionId,
    filterEntityId,
    refreshToken,
    targetClueId,
  ]);

  useEffect(() => {
    let cancelled = false;
    async function loadDashboard() {
      if (!campaignId) {
        setDashboard(null);
        return;
      }
      setLoadingDashboard(true);
      try {
        const data = await apiFetch<DashboardResponse>(
          `/api/truth-clues/dashboard?campaign_id=${encodeURIComponent(campaignId)}`,
        );
        if (cancelled) return;
        setDashboard(data);
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setLoadingDashboard(false);
      }
    }
    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [campaignId, refreshToken]);

  const plotThreadById = useMemo(() => {
    const map = new Map<string, PlotThreadRow>();
    for (const t of plotThreads) map.set(t.id, t);
    return map;
  }, [plotThreads]);
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

  function resetDraft() {
    setDraft(EMPTY_DRAFT);
  }

  function startPlant() {
    resetDraft();
    setDraft((d) => ({
      ...d,
      relatedPlotThreadId: filterPlotThreadId || d.relatedPlotThreadId,
      plantedInSession: filterSessionId || d.plantedInSession,
    }));
    setDraftOpen(true);
  }

  function startEdit(clue: TruthClueRow) {
    setDraft({
      id: clue.id,
      description: clue.description,
      truthRevealed: clue.truthRevealed,
      relatedPlotThreadId: clue.relatedPlotThreadId ?? "",
      plantedInSession: clue.plantedInSession ?? "",
      relatedEntities: clue.relatedEntities,
      status: clue.status,
      statusNotes: clue.statusNotes ?? "",
    });
    setDraftOpen(true);
  }

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!campaignId) return;
    if (!draft.description.trim() || !draft.truthRevealed.trim()) {
      setError("Descrizione e verita' rivelata sono obbligatori.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        description: draft.description.trim(),
        truthRevealed: draft.truthRevealed.trim(),
        relatedPlotThreadId: draft.relatedPlotThreadId || null,
        plantedInSession: draft.plantedInSession || null,
        relatedEntities: draft.relatedEntities,
        status: draft.status,
        statusNotes: draft.statusNotes.trim() ? draft.statusNotes.trim() : null,
      };
      if (draft.id) {
        await apiFetch<TruthClueRow>(`/api/truth-clues/${draft.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setMessage("Briciola aggiornata.");
      } else {
        await apiFetch<TruthClueRow>(`/api/truth-clues`, {
          method: "POST",
          body: JSON.stringify({ ...payload, campaignId }),
        });
        setMessage("Briciola piantata.");
      }
      setDraftOpen(false);
      resetDraft();
      triggerRefresh();
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(clue: TruthClueRow, status: ClueStatus) {
    if (clue.status === status) return;
    setStatusSavingId(clue.id);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<TruthClueRow>(`/api/truth-clues/${clue.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMessage(`Stato aggiornato: ${STATUS_LABEL[status]}.`);
      triggerRefresh();
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setStatusSavingId(null);
    }
  }

  async function deleteClue(clue: TruthClueRow) {
    if (!confirm("Eliminare definitivamente questa briciola?")) return;
    setStatusSavingId(clue.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/truth-clues/${clue.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(`HTTP ${res.status}`);
      }
      setMessage("Briciola eliminata.");
      triggerRefresh();
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setStatusSavingId(null);
    }
  }

  function toggleEntity(entityId: string) {
    setDraft((d) => {
      const exists = d.relatedEntities.includes(entityId);
      return {
        ...d,
        relatedEntities: exists
          ? d.relatedEntities.filter((id) => id !== entityId)
          : [...d.relatedEntities, entityId],
      };
    });
  }

  const selectedCampaignName =
    campaigns.find((c) => c.id === campaignId)?.name ?? "Nessuna campagna";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Truth Clue Tracker
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Fase 6 · Briciole di verita&apos; piantate, notate, capite o perse
            durante le sessioni.
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
              disabled={loadingCampaigns}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
            >
              {campaigns.length === 0 ? (
                <option value="">Nessuna campagna</option>
              ) : (
                campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <button
            type="button"
            onClick={startPlant}
            disabled={!campaignId}
            className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            + Pianta briciola
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {/* Filtri */}
          <div className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-900">
            <FilterSelect
              label="Status"
              value={filterStatus}
              onChange={(value) => setFilterStatus(value as ClueStatus | "all")}
            >
              <option value="all">Tutti</option>
              {CLUE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Plot thread"
              value={filterPlotThreadId}
              onChange={setFilterPlotThreadId}
            >
              <option value="">Tutti</option>
              {plotThreads.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Sessione"
              value={filterSessionId}
              onChange={setFilterSessionId}
            >
              <option value="">Tutte</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  #{s.number} {s.title ?? ""}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Entita&apos; coinvolta"
              value={filterEntityId}
              onChange={setFilterEntityId}
            >
              <option value="">Tutte</option>
              {entities.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </FilterSelect>
          </div>

          {/* Form draft (plant/edit) */}
          {draftOpen && (
            <form
              onSubmit={saveDraft}
              className="space-y-4 rounded-lg border border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-900/70"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">
                  {draft.id ? "Modifica briciola" : "Pianta nuova briciola"}
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setDraftOpen(false);
                    resetDraft();
                  }}
                  className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Annulla
                </button>
              </div>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Come e&apos; apparsa in scena
                </span>
                <textarea
                  value={draft.description}
                  onChange={(e) =>
                    setDraft({ ...draft, description: e.target.value })
                  }
                  rows={3}
                  required
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Verita&apos; rivelata (GM)
                </span>
                <textarea
                  value={draft.truthRevealed}
                  onChange={(e) =>
                    setDraft({ ...draft, truthRevealed: e.target.value })
                  }
                  rows={3}
                  required
                  className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                    Plot thread collegato
                  </span>
                  <select
                    value={draft.relatedPlotThreadId}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        relatedPlotThreadId: e.target.value,
                      })
                    }
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <option value="">Nessuno</option>
                    {plotThreads.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                    Sessione di introduzione
                  </span>
                  <select
                    value={draft.plantedInSession}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        plantedInSession: e.target.value,
                      })
                    }
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <option value="">Nessuna</option>
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.number} {s.title ?? ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                    Status
                  </span>
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        status: e.target.value as ClueStatus,
                      })
                    }
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    {CLUE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                    Note status
                  </span>
                  <input
                    value={draft.statusNotes}
                    onChange={(e) =>
                      setDraft({ ...draft, statusNotes: e.target.value })
                    }
                    placeholder="Come l&apos;hanno colta / come l&apos;hanno fraintesa..."
                    className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  />
                </label>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Entita&apos; coinvolte
                </span>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Click per aggiungere/rimuovere. Selezionate:{" "}
                  {draft.relatedEntities.length}
                </p>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950">
                  {entities.length === 0 ? (
                    <p className="text-xs text-zinc-500">
                      Nessuna entita&apos; in questa campagna.
                    </p>
                  ) : (
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {entities.map((entity) => {
                        const checked = draft.relatedEntities.includes(
                          entity.id,
                        );
                        return (
                          <li key={entity.id}>
                            <label className="flex items-center gap-2 rounded px-2 py-1 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleEntity(entity.id)}
                              />
                              <span className="truncate">
                                {entity.name}{" "}
                                <span className="text-zinc-400">
                                  ({entity.type})
                                </span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  {saving
                    ? "Salvataggio..."
                    : draft.id
                      ? "Salva modifiche"
                      : "Pianta briciola"}
                </button>
              </div>
            </form>
          )}

          {/* Lista briciole */}
          <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
              <span>
                {loadingClues
                  ? "Caricamento..."
                  : `${clues.length} briciole · ${selectedCampaignName}`}
              </span>
            </header>
            {clues.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">
                Nessuna briciola corrispondente ai filtri. Inizia a piantarne
                una con il bottone in alto.
              </div>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {clues.map((clue) => {
                  const thread = clue.relatedPlotThreadId
                    ? plotThreadById.get(clue.relatedPlotThreadId)
                    : null;
                  const session = clue.plantedInSession
                    ? sessionById.get(clue.plantedInSession)
                    : null;
                  return (
                    <li
                      key={clue.id}
                      id={`clue-${clue.id}`}
                      className={`space-y-3 px-4 py-4 scroll-mt-4 ${
                        clue.id === targetClueId
                          ? "bg-amber-50/70 ring-1 ring-inset ring-amber-300 dark:bg-amber-950/30 dark:ring-amber-800"
                          : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_CLASS[clue.status]}`}
                        >
                          {STATUS_LABEL[clue.status]}
                        </span>
                        <p className="min-w-0 flex-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {clue.description}
                        </p>
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="font-semibold">Verita&apos; GM:</span>{" "}
                        {clue.truthRevealed}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {thread && <span>Thread: {thread.title}</span>}
                        {session && (
                          <span>
                            Sessione: #{session.number}{" "}
                            {session.title ? `· ${session.title}` : ""}
                          </span>
                        )}
                        {clue.relatedEntities.length > 0 && (
                          <span>
                            Entita&apos;:{" "}
                            {clue.relatedEntities
                              .map(
                                (id) => entityById.get(id)?.name ?? "(?)",
                              )
                              .join(", ")}
                          </span>
                        )}
                        <span>
                          Status aggiornato:{" "}
                          {new Date(clue.statusUpdatedAt).toLocaleString()}
                        </span>
                      </div>
                      {clue.statusNotes && (
                        <p className="rounded bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
                          {clue.statusNotes}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex flex-wrap items-center gap-1">
                          {CLUE_STATUSES.map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => updateStatus(clue, s)}
                              disabled={statusSavingId === clue.id}
                              className={`rounded px-2 py-1 text-[11px] uppercase tracking-wide transition-colors ${
                                clue.status === s
                                  ? `${STATUS_CLASS[s]} ring-1 ring-zinc-400`
                                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                              }`}
                            >
                              {STATUS_LABEL[s]}
                            </button>
                          ))}
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <CopyForChatGptButton
                            text={buildTruthClueChatGptMarkdown({
                              clue,
                              thread: thread ?? null,
                              session: session ?? null,
                              entityById,
                            })}
                          />
                          <button
                            type="button"
                            onClick={() => startEdit(clue)}
                            className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
                          >
                            Modifica
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteClue(clue)}
                            disabled={statusSavingId === clue.id}
                            className="text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
                          >
                            Elimina
                          </button>
                        </div>
                      </div>
                      <details>
                        <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100">
                          Visibilita&apos; per giocatore
                        </summary>
                        <div className="mt-2">
                          <PlayerOverrideEditor
                            campaignId={campaignId}
                            targetType="truth_clue"
                            targetId={clue.id}
                            targetLabel={clue.description.slice(0, 60)}
                            baseVisibility="dm_only"
                          />
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Dashboard verita' rivelata */}
        <aside className="space-y-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Verita&apos; rivelata per thread
            </h2>
            {loadingDashboard ? (
              <p className="text-xs text-zinc-500">Caricamento...</p>
            ) : !dashboard || dashboard.threads.length === 0 ? (
              <p className="text-xs text-zinc-500">
                Nessun plot thread o briciola in questa campagna.
              </p>
            ) : (
              <ul className="space-y-3">
                {dashboard.threads
                  .filter((row) => row.plotThreadId !== null || row.total > 0)
                  .map((row) => (
                    <li
                      key={row.plotThreadId ?? "__orphan"}
                      className="space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-zinc-700 dark:text-zinc-200">
                          {row.plotThreadTitle ?? "Senza plot thread"}
                        </span>
                        <span className="shrink-0 tabular-nums text-zinc-500">
                          {row.understood}/{row.total} ·{" "}
                          {row.understoodPct}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                        <div
                          className="h-full bg-emerald-500"
                          style={{
                            width: `${row.total === 0 ? 0 : row.understoodPct}%`,
                          }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        {row.planted > 0 && <span>Piantate {row.planted}</span>}
                        {row.noticed > 0 && <span>Notate {row.noticed}</span>}
                        {row.misinterpreted > 0 && (
                          <span>Fraintese {row.misinterpreted}</span>
                        )}
                        {row.lost > 0 && <span>Perse {row.lost}</span>}
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}

function FilterSelect({ label, value, onChange, children }: FilterSelectProps) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
      >
        {children}
      </select>
    </label>
  );
}

function sortTargetFirst(rows: TruthClueRow[], targetId: string) {
  if (!targetId) return rows;
  return [...rows].sort((a, b) => {
    if (a.id === targetId) return -1;
    if (b.id === targetId) return 1;
    return 0;
  });
}

function buildTruthClueChatGptMarkdown({
  clue,
  thread,
  session,
  entityById,
}: {
  clue: TruthClueRow;
  thread: PlotThreadRow | null;
  session: SessionRow | null;
  entityById: Map<string, EntityRow>;
}) {
  const relatedEntities = clue.relatedEntities
    .map((id) => entityById.get(id))
    .filter((entity): entity is EntityRow => Boolean(entity));
  return [
    `# Copy-for-ChatGPT: Truth clue - ${clue.description.slice(0, 80)}`,
    "",
    `Status: ${clue.status}`,
    `Plot thread: ${thread?.title ?? "nessuno"}`,
    `Sessione: ${session ? `#${session.number}${session.title ? ` - ${session.title}` : ""}` : "non impostata"}`,
    "",
    "## Briciola percepita",
    clue.description,
    "",
    "## Verita GM",
    clue.truthRevealed,
    "",
    "## Note status",
    clue.statusNotes?.trim() || "_Vuoto_",
    "",
    "## Entita correlate",
    relatedEntities.length > 0
      ? relatedEntities.map((entity) => `- ${entity.name} (${entity.type})`).join("\n")
      : "_Nessuna entita._",
  ].join("\n");
}

function queryParam(name: string) {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(name) ?? "";
}
