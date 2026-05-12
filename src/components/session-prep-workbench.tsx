"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  SessionPrepInput,
  SessionPrepOutput,
  SessionPrepTrace,
} from "@/lib/session-prep";

interface CampaignRow {
  id: string;
  name: string;
}

interface LocationRow {
  id: string;
  name: string;
  type: string;
}

interface SessionRow {
  id: string;
  number: number;
  title: string | null;
  date: string | null;
}

interface GenerateResponse {
  input: SessionPrepInput;
  output: SessionPrepOutput;
  trace: SessionPrepTrace[];
  iterations: number;
}

interface DraftState {
  campaignId: string;
  locationId: string;
  partyLevel: string;
  partySize: string;
  vibe: string;
  focus: string;
}

const EMPTY_DRAFT: DraftState = {
  campaignId: "",
  locationId: "",
  partyLevel: "5",
  partySize: "4",
  vibe: "",
  focus: "",
};

export function SessionPrepWorkbench() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [sessionList, setSessionList] = useState<SessionRow[]>([]);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [targetSessionId, setTargetSessionId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const rows = await apiFetch<CampaignRow[]>("/api/campaigns");
        if (cancelled) return;
        setCampaigns(rows);
        setDraft((current) => ({
          ...current,
          campaignId: current.campaignId || (rows[0]?.id ?? ""),
        }));
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
    async function loadAuxiliaries() {
      if (!draft.campaignId) {
        setLocations([]);
        setSessionList([]);
        return;
      }
      try {
        const [locs, sess] = await Promise.all([
          apiFetch<LocationRow[]>(
            `/api/entities?campaign_id=${encodeURIComponent(draft.campaignId)}&type=location&sort=name_asc&limit=200`,
          ),
          apiFetch<SessionRow[]>(
            `/api/sessions?campaign_id=${encodeURIComponent(draft.campaignId)}`,
          ),
        ]);
        if (cancelled) return;
        setLocations(locs);
        setSessionList(sess);
        // default: ultima sessione (l'agent prep va di solito sulla prossima
        // sessione = la piu' recente in stato draft, qui scegliamo l'ultima
        // come placeholder).
        setTargetSessionId((current) =>
          sess.some((s) => s.id === current) ? current : (sess.at(-1)?.id ?? ""),
        );
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      }
    }
    void loadAuxiliaries();
    return () => {
      cancelled = true;
    };
  }, [draft.campaignId]);

  function updateDraft<K extends keyof DraftState>(key: K, value: DraftState[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setResult(null);
    setMessage(null);
    setError(null);
  }

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.campaignId) return;
    setGenerating(true);
    setError(null);
    setMessage(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = {
        campaignId: draft.campaignId,
        partyLevel: Number(draft.partyLevel),
        partySize: Number(draft.partySize),
      };
      if (draft.locationId) body.locationId = draft.locationId;
      if (draft.vibe.trim()) body.vibe = draft.vibe.trim();
      if (draft.focus.trim()) body.focus = draft.focus.trim();

      const response = await apiFetch<GenerateResponse>(
        "/api/session-prep/generate",
        { method: "POST", body: JSON.stringify(body) },
      );
      setResult(response);
      setMessage(
        `Prep generato in ${response.iterations} iterazioni (${response.trace.length} tool calls).`,
      );
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setGenerating(false);
    }
  }

  async function saveToSession() {
    if (!result || !targetSessionId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<unknown>("/api/session-prep/save", {
        method: "POST",
        body: JSON.stringify({
          sessionId: targetSessionId,
          output: result.output,
          vibe: draft.vibe.trim() || undefined,
          focus: draft.focus.trim() || undefined,
        }),
      });
      const target = sessionList.find((s) => s.id === targetSessionId);
      setMessage(
        target
          ? `Prep aggiunto a Session #${target.number}${target.title ? ` (${target.title})` : ""} prep_notes.`
          : "Prep aggiunto alle prep_notes.",
      );
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setSaving(false);
    }
  }

  const selectedCampaignName = useMemo(
    () => campaigns.find((c) => c.id === draft.campaignId)?.name ?? "Nessuna campagna",
    [campaigns, draft.campaignId],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Session Prep Assistant
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Fase 7 · L&apos;agent legge plot threads, identita&apos;
            attive, briciole e ultime sessioni e propone hook, NPC seeds,
            encounter, briciole + un &quot;previously on&quot; sicuro per i giocatori.
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          {selectedCampaignName}
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

      <form
        onSubmit={generate}
        className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Campagna
            </span>
            <select
              value={draft.campaignId}
              onChange={(e) => updateDraft("campaignId", e.target.value)}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
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
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Location (opzionale)
            </span>
            <select
              value={draft.locationId}
              onChange={(e) => updateDraft("locationId", e.target.value)}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            >
              <option value="">L&apos;agent sceglie</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Livello party
            </span>
            <input
              type="number"
              min={1}
              max={20}
              value={draft.partyLevel}
              onChange={(e) => updateDraft("partyLevel", e.target.value)}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Numero PG
            </span>
            <input
              type="number"
              min={1}
              max={8}
              value={draft.partySize}
              onChange={(e) => updateDraft("partySize", e.target.value)}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        </div>
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
            Vibe richiesto
          </span>
          <input
            value={draft.vibe}
            onChange={(e) => updateDraft("vibe", e.target.value)}
            placeholder="Es. intrigo politico, indagine, viaggio, scontro frontale..."
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
            Focus narrativo (opzionale)
          </span>
          <textarea
            value={draft.focus}
            onChange={(e) => updateDraft("focus", e.target.value)}
            rows={2}
            placeholder="Es. voglio piantare due briciole su Malakor, oppure spotlight su Axton."
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </label>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={generating || !draft.campaignId}
            className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {generating ? "Sto preparando..." : "Genera prep"}
          </button>
        </div>
      </form>

      {result && (
        <div className="space-y-4">
          <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Previously on...</h2>
              <span className="text-xs text-zinc-500">
                Solo `recap`, mai `dm_notes`.
              </span>
            </header>
            <p className="mt-3 whitespace-pre-wrap text-sm">
              {result.output.previouslyOn}
            </p>
          </section>

          <PrepListSection title="Hooks proposti" empty="Nessun hook proposto.">
            {result.output.hooks.map((hook, i) => (
              <li key={i} className="space-y-1 text-sm">
                <div className="font-semibold">
                  {hook.pcName} &rarr; {hook.targetName}
                </div>
                <p>{hook.hookDescription}</p>
                <p className="text-xs text-zinc-500">
                  <strong>Arco potenziale:</strong> {hook.potentialArc}
                </p>
                <p className="text-xs text-zinc-500">
                  <strong>Perche&apos;:</strong> {hook.rationale}
                </p>
              </li>
            ))}
          </PrepListSection>

          <PrepListSection title="NPC seeds" empty="Nessun NPC proposto.">
            {result.output.npcSeeds.map((npc, i) => (
              <li key={i} className="space-y-1 text-sm">
                <div className="font-semibold">
                  {npc.name}{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    ({npc.existingEntityId ? "esistente" : "nuovo"} · {npc.proposedType})
                  </span>
                </div>
                <p>{npc.narrativeRole}</p>
                <p className="text-xs text-zinc-500">
                  <strong>Tono:</strong> {npc.tone}
                </p>
                <p className="text-xs text-zinc-500">
                  <strong>Perche&apos;:</strong> {npc.rationale}
                </p>
              </li>
            ))}
          </PrepListSection>

          <PrepListSection title="Encounter seeds" empty="Nessun encounter proposto.">
            {result.output.encounterSeeds.map((enc, i) => (
              <li key={i} className="space-y-1 text-sm">
                <div className="font-semibold">
                  {enc.title}{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    ({enc.difficultyHint})
                  </span>
                </div>
                <p>{enc.concept}</p>
                <p className="text-xs text-zinc-500">
                  <strong>Creature:</strong> {enc.creatureHints.join(", ")}
                </p>
                <p className="text-xs text-zinc-500">
                  <strong>Perche&apos;:</strong> {enc.rationale}
                </p>
              </li>
            ))}
          </PrepListSection>

          <PrepListSection title="Briciole suggerite" empty="Nessuna briciola proposta.">
            {result.output.suggestedClues.map((clue, i) => (
              <li key={i} className="space-y-1 text-sm">
                <div className="font-semibold">
                  {clue.plotThreadTitle ?? "(nessun thread)"}
                </div>
                <p>{clue.description}</p>
                <p className="text-xs text-zinc-500">
                  <strong>Verita&apos; GM:</strong> {clue.truthRevealed}
                </p>
                <p className="text-xs text-zinc-500">
                  <strong>Perche&apos;:</strong> {clue.rationale}
                </p>
              </li>
            ))}
          </PrepListSection>

          {result.output.notes.length > 0 && (
            <PrepListSection title="Note dell'agent" empty="">
              {result.output.notes.map((note, i) => (
                <li key={i} className="text-sm">
                  {note}
                </li>
              ))}
            </PrepListSection>
          )}

          <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <header className="text-sm font-semibold">
              Tool calls ({result.trace.length})
            </header>
            <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
              {result.trace.map((step, i) => (
                <li key={i} className="py-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono">{step.toolName}</span>
                    <span className="text-zinc-500">{step.durationMs} ms</span>
                  </div>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px] text-zinc-500">
                    args: {JSON.stringify(step.args)}
                  </pre>
                  <p className="text-[11px] text-zinc-500">
                    result preview: {step.resultPreview}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3 rounded-lg border border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-900/70">
            <header className="text-sm font-semibold">Salva in una sessione</header>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Il prep viene appeso a `prep_notes` della sessione scelta come
              blocco Markdown.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={targetSessionId}
                onChange={(e) => setTargetSessionId(e.target.value)}
                className="h-10 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                {sessionList.length === 0 ? (
                  <option value="">Nessuna sessione disponibile</option>
                ) : (
                  sessionList.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.number}
                      {s.title ? ` ${s.title}` : ""}
                      {s.date ? ` (${new Date(s.date).toLocaleDateString()})` : ""}
                    </option>
                  ))
                )}
              </select>
              <button
                type="button"
                onClick={saveToSession}
                disabled={saving || !targetSessionId}
                className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {saving ? "..." : "Salva prep_notes"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function PrepListSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children.flat() : [children];
  const visibleItems = items.filter(Boolean);
  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
        {title}
      </header>
      {visibleItems.length === 0 ? (
        <p className="px-4 py-3 text-xs text-zinc-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 px-4 py-2 dark:divide-zinc-800">
          {visibleItems}
        </ul>
      )}
    </section>
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
