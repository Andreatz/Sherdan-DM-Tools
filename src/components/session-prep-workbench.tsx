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

interface AcceptResponse {
  session: { id: string; number: number; prepNotes: string | null };
  created: {
    clues: Array<{ id: string; description: string }>;
    npcs: Array<{ id: string; name: string }>;
    encounters: Array<{ id: string; title: string }>;
    pcHooks: Array<{ id: string; pcName: string; targetName: string }>;
  };
  skipped: { hookInvalid: number; cluePlotThreadInvalid: number };
  markdown: string;
}

interface SelectionState {
  previouslyOn: boolean;
  notes: boolean;
  hooks: Set<number>;
  npcSeeds: Set<number>;
  encounterSeeds: Set<number>;
  suggestedClues: Set<number>;
}

function fullSelection(output: SessionPrepOutput): SelectionState {
  return {
    previouslyOn: true,
    notes: true,
    hooks: new Set(output.hooks.map((_, i) => i)),
    npcSeeds: new Set(output.npcSeeds.map((_, i) => i)),
    encounterSeeds: new Set(output.encounterSeeds.map((_, i) => i)),
    suggestedClues: new Set(output.suggestedClues.map((_, i) => i)),
  };
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
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [targetSessionId, setTargetSessionId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastAcceptResult, setLastAcceptResult] = useState<AcceptResponse | null>(
    null,
  );

  function toggleSelectionFlag(key: "previouslyOn" | "notes") {
    setSelection((current) =>
      current ? { ...current, [key]: !current[key] } : current,
    );
  }

  function toggleSelectionIndex(
    key: "hooks" | "npcSeeds" | "encounterSeeds" | "suggestedClues",
    index: number,
  ) {
    setSelection((current) => {
      if (!current) return current;
      const set = new Set(current[key]);
      if (set.has(index)) set.delete(index);
      else set.add(index);
      return { ...current, [key]: set };
    });
  }

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
      setSelection(fullSelection(response.output));
      setLastAcceptResult(null);
      setMessage(
        `Prep generato in ${response.iterations} iterazioni (${response.trace.length} tool calls).`,
      );
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setGenerating(false);
    }
  }

  async function acceptSelected() {
    if (!result || !selection || !targetSessionId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch<AcceptResponse>(
        "/api/session-prep/accept",
        {
          method: "POST",
          body: JSON.stringify({
            campaignId: draft.campaignId,
            sessionId: targetSessionId,
            output: result.output,
            vibe: draft.vibe.trim() || undefined,
            focus: draft.focus.trim() || undefined,
            selected: {
              previouslyOn: selection.previouslyOn,
              notes: selection.notes,
              hooks: Array.from(selection.hooks).sort((a, b) => a - b),
              npcSeeds: Array.from(selection.npcSeeds).sort((a, b) => a - b),
              encounterSeeds: Array.from(selection.encounterSeeds).sort(
                (a, b) => a - b,
              ),
              suggestedClues: Array.from(selection.suggestedClues).sort(
                (a, b) => a - b,
              ),
            },
          }),
        },
      );
      setLastAcceptResult(response);
      const target = sessionList.find((s) => s.id === targetSessionId);
      const counts = response.created;
      const created = [
        counts.clues.length > 0 ? `${counts.clues.length} briciole` : null,
        counts.npcs.length > 0 ? `${counts.npcs.length} NPC stub` : null,
        counts.encounters.length > 0
          ? `${counts.encounters.length} encounter draft`
          : null,
        counts.pcHooks.length > 0 ? `${counts.pcHooks.length} PC hook` : null,
      ]
        .filter(Boolean)
        .join(", ");
      setMessage(
        `${created || "Nessun record creato"} · prep_notes aggiornate per S#${target?.number ?? "?"}.`,
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

      {result && selection && (
        <div className="space-y-4">
          <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Previously on...</h2>
              <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={selection.previouslyOn}
                  onChange={() => toggleSelectionFlag("previouslyOn")}
                />
                Includi nelle prep_notes
              </label>
            </header>
            <p className="mt-1 text-xs text-zinc-500">
              Solo `recap`, mai `dm_notes`.
            </p>
            <p className="mt-3 whitespace-pre-wrap text-sm">
              {result.output.previouslyOn}
            </p>
          </section>

          <PrepListSection title="Hooks proposti" empty="Nessun hook proposto.">
            {result.output.hooks.map((hook, i) => (
              <SelectableItem
                key={i}
                checked={selection.hooks.has(i)}
                onToggle={() => toggleSelectionIndex("hooks", i)}
                acceptHint="→ pc_hooks (se PG e target esistono)"
              >
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
              </SelectableItem>
            ))}
          </PrepListSection>

          <PrepListSection title="NPC seeds" empty="Nessun NPC proposto.">
            {result.output.npcSeeds.map((npc, i) => (
              <SelectableItem
                key={i}
                checked={selection.npcSeeds.has(i)}
                onToggle={() => toggleSelectionIndex("npcSeeds", i)}
                acceptHint={
                  npc.existingEntityId
                    ? "(esistente: incluso solo nel prep_notes)"
                    : "→ entity stub dm_only con tag session-prep-draft"
                }
              >
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
              </SelectableItem>
            ))}
          </PrepListSection>

          <PrepListSection title="Encounter seeds" empty="Nessun encounter proposto.">
            {result.output.encounterSeeds.map((enc, i) => (
              <SelectableItem
                key={i}
                checked={selection.encounterSeeds.has(i)}
                onToggle={() => toggleSelectionIndex("encounterSeeds", i)}
                acceptHint="→ encounter draft (Encounter Builder per completarlo)"
              >
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
              </SelectableItem>
            ))}
          </PrepListSection>

          <PrepListSection title="Briciole suggerite" empty="Nessuna briciola proposta.">
            {result.output.suggestedClues.map((clue, i) => (
              <SelectableItem
                key={i}
                checked={selection.suggestedClues.has(i)}
                onToggle={() => toggleSelectionIndex("suggestedClues", i)}
                acceptHint="→ truth_clue (status=planted, planted_in_session=sessione scelta)"
              >
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
              </SelectableItem>
            ))}
          </PrepListSection>

          {result.output.notes.length > 0 && (
            <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
              <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <span className="text-sm font-semibold">Note dell&apos;agent</span>
                <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={selection.notes}
                    onChange={() => toggleSelectionFlag("notes")}
                  />
                  Includi nelle prep_notes
                </label>
              </header>
              <ul className="px-4 py-2 space-y-1 text-sm">
                {result.output.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </section>
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
            <header className="text-sm font-semibold">
              Accetta i pezzi selezionati
            </header>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Le proposte spuntate qui sopra vengono persistite nelle tabelle
              relative (truth_clues, entities NPC dm_only, encounters draft,
              pc_hooks). Il Markdown dei soli pezzi accettati viene appeso a
              `prep_notes` della sessione scelta.
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
                onClick={acceptSelected}
                disabled={saving || !targetSessionId}
                className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                {saving ? "..." : "Accetta selezionati"}
              </button>
            </div>
            {lastAcceptResult && (
              <div className="mt-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100">
                <p className="font-semibold">Creati:</p>
                <ul className="mt-1 list-inside list-disc">
                  <li>
                    Briciole: {lastAcceptResult.created.clues.length}
                    {lastAcceptResult.skipped.cluePlotThreadInvalid > 0
                      ? ` (skipped ${lastAcceptResult.skipped.cluePlotThreadInvalid} per plot thread invalido)`
                      : ""}
                  </li>
                  <li>NPC stub: {lastAcceptResult.created.npcs.length}</li>
                  <li>
                    Encounter draft: {lastAcceptResult.created.encounters.length}
                  </li>
                  <li>
                    PC hooks: {lastAcceptResult.created.pcHooks.length}
                    {lastAcceptResult.skipped.hookInvalid > 0
                      ? ` (skipped ${lastAcceptResult.skipped.hookInvalid} per entity non valide)`
                      : ""}
                  </li>
                </ul>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

interface SelectableItemProps {
  checked: boolean;
  onToggle: () => void;
  acceptHint?: string;
  children: React.ReactNode;
}

function SelectableItem({
  checked,
  onToggle,
  acceptHint,
  children,
}: SelectableItemProps) {
  return (
    <li className="flex items-start gap-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 shrink-0"
      />
      <div className="flex-1 space-y-1">
        {children}
        {acceptHint && (
          <p className="text-[11px] italic text-zinc-400 dark:text-zinc-500">
            {acceptHint}
          </p>
        )}
      </div>
    </li>
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
