"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Visibility = "dm_only" | "discovered" | "public";
type ExposureMode = "name_only" | "public_description" | "discovered_description";

interface DashboardEntity {
  id: string;
  type: string;
  name: string;
  visibility: Visibility;
  exposureMode: ExposureMode;
  publicDescription: string | null;
}

interface DashboardHandout {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  kind: "text" | "image" | "mixed";
  createdAt?: string;
}

interface DashboardMapReveal {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface DashboardState {
  campaignId: string;
  sceneTitle: string | null;
  sceneText: string | null;
  imageUrl: string | null;
  mapImageUrl: string | null;
  mapFogData: { reveals: DashboardMapReveal[] };
  handouts: DashboardHandout[];
  activeEntityIds: string[];
  initiative: {
    active: boolean;
    round?: number;
    turns: Array<{
      name: string;
      initiative?: number;
      hp?: string;
      note?: string;
    }>;
  } | null;
}

interface DashboardPayload {
  state: DashboardState;
  entities: DashboardEntity[];
}

interface PlayerDashboardControlPanelProps {
  campaignId: string;
}

const VISIBILITY_LABELS: Record<Visibility, string> = {
  dm_only: "Nascosta",
  discovered: "Scoperta",
  public: "Pubblica",
};

const EXPOSURE_LABELS: Record<ExposureMode, string> = {
  name_only: "Solo nome e tipo",
  public_description: "Descrizione pubblica",
  discovered_description: "Pubblica + segreti scoperti",
};

const EMPTY_STATE: DashboardState = {
  campaignId: "",
  sceneTitle: "",
  sceneText: "",
  imageUrl: "",
  mapImageUrl: "",
  mapFogData: { reveals: [] },
  handouts: [],
  activeEntityIds: [],
  initiative: null,
};

export function PlayerDashboardControlPanel({
  campaignId,
}: PlayerDashboardControlPanelProps) {
  const [state, setState] = useState<DashboardState>({
    ...EMPTY_STATE,
    campaignId,
  });
  const [entities, setEntities] = useState<DashboardEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [entitySearch, setEntitySearch] = useState("");
  const [handoutDraft, setHandoutDraft] = useState({
    title: "",
    body: "",
    imageUrl: "",
  });
  const [revealDraft, setRevealDraft] = useState({
    label: "",
    x: 10,
    y: 10,
    width: 30,
    height: 30,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const payload = await apiFetch<DashboardPayload>(
          `/api/player-dashboard?campaign_id=${encodeURIComponent(campaignId)}`,
        );
        if (cancelled) return;
        setState(payload.state);
        setEntities(payload.entities);
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const activeIdSet = useMemo(
    () => new Set(state.activeEntityIds),
    [state.activeEntityIds],
  );

  const filteredEntities = useMemo(() => {
    const query = entitySearch.trim().toLocaleLowerCase("it-IT");
    if (!query) return entities.slice(0, 80);
    return entities
      .filter((entity) =>
        `${entity.name} ${entity.type}`.toLocaleLowerCase("it-IT").includes(query),
      )
      .slice(0, 80);
  }, [entities, entitySearch]);

  const previewEntities = entities.filter((entity) => activeIdSet.has(entity.id));

  async function saveState(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await apiFetch<DashboardState>("/api/player-dashboard", {
        method: "PATCH",
        body: JSON.stringify({
          campaignId,
          sceneTitle: nullIfBlank(state.sceneTitle),
          sceneText: nullIfBlank(state.sceneText),
          imageUrl: nullIfBlank(state.imageUrl),
          mapImageUrl: nullIfBlank(state.mapImageUrl),
          mapFogData: state.mapFogData,
          handouts: state.handouts,
          activeEntityIds: state.activeEntityIds,
          initiative: state.initiative,
        }),
      });
      setState((current) => ({ ...current, ...saved }));
      setMessage("Dashboard player salvata.");
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setSaving(false);
    }
  }

  async function pushUpdate() {
    setPushing(true);
    setError(null);
    setMessage(null);
    try {
      await saveState();
      const result = await apiFetch<{ sent: number }>("/api/player-dashboard", {
        method: "POST",
        body: JSON.stringify({ campaignId }),
      });
      setMessage(`Update inviato a ${result.sent} connessioni player.`);
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setPushing(false);
    }
  }

  async function updateEntity(entity: DashboardEntity, patch: Partial<DashboardEntity>) {
    setError(null);
    const next = { ...entity, ...patch };
    setEntities((rows) => rows.map((row) => (row.id === entity.id ? next : row)));
    try {
      await apiFetch("/api/player-dashboard/entities", {
        method: "PATCH",
        body: JSON.stringify({
          campaignId,
          entityId: entity.id,
          visibility: patch.visibility,
          exposureMode: patch.exposureMode,
        }),
      });
    } catch (err) {
      setEntities((rows) => rows.map((row) => (row.id === entity.id ? entity : row)));
      setError(messageForError(err));
    }
  }

  function toggleActiveEntity(entityId: string) {
    setState((current) => {
      const active = new Set(current.activeEntityIds);
      if (active.has(entityId)) active.delete(entityId);
      else active.add(entityId);
      return { ...current, activeEntityIds: Array.from(active) };
    });
  }

  function addHandout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!handoutDraft.title.trim()) return;
    const imageUrl = handoutDraft.imageUrl.trim() || null;
    const handout: DashboardHandout = {
      id: crypto.randomUUID(),
      title: handoutDraft.title.trim(),
      body: handoutDraft.body.trim(),
      imageUrl,
      kind: imageUrl && handoutDraft.body.trim() ? "mixed" : imageUrl ? "image" : "text",
      createdAt: new Date().toISOString(),
    };
    setState((current) => ({
      ...current,
      handouts: [handout, ...current.handouts].slice(0, 60),
    }));
    setHandoutDraft({ title: "", body: "", imageUrl: "" });
  }

  function removeHandout(id: string) {
    setState((current) => ({
      ...current,
      handouts: current.handouts.filter((handout) => handout.id !== id),
    }));
  }

  function addReveal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reveal: DashboardMapReveal = {
      id: crypto.randomUUID(),
      label: revealDraft.label.trim(),
      x: revealDraft.x,
      y: revealDraft.y,
      width: revealDraft.width,
      height: revealDraft.height,
    };
    setState((current) => ({
      ...current,
      mapFogData: {
        reveals: [...current.mapFogData.reveals, reveal],
      },
    }));
  }

  function removeReveal(id: string) {
    setState((current) => ({
      ...current,
      mapFogData: {
        reveals: current.mapFogData.reveals.filter((reveal) => reveal.id !== id),
      },
    }));
  }

  if (loading) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">
        Caricamento dashboard player...
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            Player Dashboard live
          </h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Scena corrente, entita&apos; in scena, handout e mappa. Il pulsante
            push sveglia i client collegati via WebSocket.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void saveState()}
            disabled={saving}
            className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {saving ? "Salvo..." : "Salva"}
          </button>
          <button
            type="button"
            onClick={() => void pushUpdate()}
            disabled={saving || pushing}
            className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
          >
            {pushing ? "Invio..." : "Push ai giocatori"}
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
          {message}
        </div>
      )}

      <form onSubmit={saveState} className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Titolo scena
            <input
              value={state.sceneTitle ?? ""}
              onChange={(event) =>
                setState((current) => ({
                  ...current,
                  sceneTitle: event.target.value,
                }))
              }
              className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Testo scena
            <textarea
              value={state.sceneText ?? ""}
              onChange={(event) =>
                setState((current) => ({ ...current, sceneText: event.target.value }))
              }
              rows={6}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Immagine scena URL
              <input
                value={state.imageUrl ?? ""}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    imageUrl: event.target.value,
                  }))
                }
                className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Mappa URL
              <input
                value={state.mapImageUrl ?? ""}
                onChange={(event) =>
                  setState((current) => ({
                    ...current,
                    mapImageUrl: event.target.value,
                  }))
                }
                className="mt-1 h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold">Anteprima vista giocatore</h3>
          <div className="mt-3 space-y-3 rounded-md bg-zinc-50 p-3 dark:bg-zinc-950">
            {state.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.imageUrl}
                alt=""
                className="max-h-48 w-full rounded-md object-cover"
              />
            )}
            <div>
              <p className="text-base font-semibold">
                {state.sceneTitle || "Scena senza titolo"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {state.sceneText || "Nessuna descrizione inviata."}
              </p>
            </div>
            {previewEntities.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {previewEntities.map((entity) => (
                  <span
                    key={entity.id}
                    className="rounded-full bg-white px-2 py-0.5 text-xs text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800"
                  >
                    {entity.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </form>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Entita&apos; e visibilita&apos;</h3>
            <input
              value={entitySearch}
              onChange={(event) => setEntitySearch(event.target.value)}
              placeholder="Filtra entita'"
              className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
            />
          </div>
          <div className="max-h-[420px] divide-y divide-zinc-100 overflow-auto dark:divide-zinc-800">
            {filteredEntities.map((entity) => (
              <div
                key={entity.id}
                className="grid gap-2 py-2 text-xs md:grid-cols-[minmax(0,1fr)_120px_190px_90px]"
              >
                <label className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={activeIdSet.has(entity.id)}
                    onChange={() => toggleActiveEntity(entity.id)}
                    className="h-4 w-4"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-zinc-900 dark:text-zinc-50">
                      {entity.name}
                    </span>
                    <span className="text-[11px] text-zinc-500">{entity.type}</span>
                  </span>
                </label>
                <select
                  value={entity.visibility}
                  onChange={(event) =>
                    void updateEntity(entity, {
                      visibility: event.target.value as Visibility,
                    })
                  }
                  className="h-8 rounded-md border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950"
                >
                  {Object.entries(VISIBILITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={entity.exposureMode}
                  onChange={(event) =>
                    void updateEntity(entity, {
                      exposureMode: event.target.value as ExposureMode,
                    })
                  }
                  className="h-8 rounded-md border border-zinc-300 bg-white px-2 dark:border-zinc-700 dark:bg-zinc-950"
                >
                  {Object.entries(EXPOSURE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <span className="self-center text-[11px] text-zinc-500">
                  {activeIdSet.has(entity.id) ? "in scena" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <section className="space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold">Handout</h3>
            <form onSubmit={addHandout} className="space-y-2">
              <input
                value={handoutDraft.title}
                onChange={(event) =>
                  setHandoutDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Titolo"
                className="h-8 w-full rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              />
              <textarea
                value={handoutDraft.body}
                onChange={(event) =>
                  setHandoutDraft((current) => ({
                    ...current,
                    body: event.target.value,
                  }))
                }
                placeholder="Testo handout"
                rows={3}
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
              />
              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <input
                  value={handoutDraft.imageUrl}
                  onChange={(event) =>
                    setHandoutDraft((current) => ({
                      ...current,
                      imageUrl: event.target.value,
                    }))
                  }
                  placeholder="Immagine URL opzionale"
                  className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  type="submit"
                  className="h-8 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-950"
                >
                  Aggiungi
                </button>
              </div>
            </form>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {state.handouts.map((handout) => (
                <li key={handout.id} className="flex gap-2 py-2 text-xs">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{handout.title}</span>
                    <span className="line-clamp-1 text-zinc-500">{handout.body}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeHandout(handout.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Rimuovi
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <h3 className="text-sm font-semibold">Fog of war</h3>
            <form onSubmit={addReveal} className="grid gap-2 sm:grid-cols-6">
              <input
                value={revealDraft.label}
                onChange={(event) =>
                  setRevealDraft((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                placeholder="Area"
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-950 sm:col-span-2"
              />
              {(["x", "y", "width", "height"] as const).map((field) => (
                <input
                  key={field}
                  type="number"
                  min={field === "width" || field === "height" ? 1 : 0}
                  max={100}
                  value={revealDraft[field]}
                  onChange={(event) =>
                    setRevealDraft((current) => ({
                      ...current,
                      [field]: Number(event.target.value),
                    }))
                  }
                  className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                />
              ))}
              <button
                type="submit"
                className="h-8 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-950 sm:col-span-6"
              >
                Rivela area
              </button>
            </form>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {state.mapFogData.reveals.map((reveal) => (
                <li key={reveal.id} className="flex items-center gap-2 py-2 text-xs">
                  <span className="flex-1">
                    {reveal.label || "Area"} ({reveal.x}, {reveal.y},{" "}
                    {reveal.width}x{reveal.height})
                  </span>
                  <button
                    type="button"
                    onClick={() => removeReveal(reveal.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Copri
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
}

async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
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
      // plain response
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

function nullIfBlank(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function messageForError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
