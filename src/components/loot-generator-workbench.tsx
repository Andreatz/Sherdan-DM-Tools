"use client";

import { useEffect, useMemo, useState } from "react";

import {
  lootGeneratorInputSchema,
  lootNarrativeDensityOptions,
  lootSourcePresetOptions,
  type LootGeneratorInput,
  type LootNarrativeDensity,
} from "@/lib/loot/loot-input";
import type { LootGeneratorOutput } from "@/lib/loot/loot-output";
import type {
  LootGeneratorPreviewResponse,
  LootResolutionSummary,
} from "@/lib/loot/loot-preview";

interface CampaignRow {
  id: string;
  name: string;
}

interface EntityRow {
  id: string;
  name: string;
  type: string;
}

interface EncounterRow {
  id: string;
  title: string;
  difficulty: string | null;
  partyLevel: number | null;
}

interface SessionOptionRow {
  id: string;
  number: number;
  title: string | null;
  date: string | null;
}

interface SavedLootResponse {
  bundle: {
    id: string;
    title: string | null;
    goldAmount: number | null;
    encounterId: string | null;
    sessionId: string | null;
  };
  createdEntities: Array<{
    id: string;
    name: string;
  }>;
  resolution: LootResolutionSummary;
}

interface DraftState {
  campaignId: string;
  source: string;
  anchorEntityId: string;
  partyLevel: string;
  narrativeDensity: LootNarrativeDensity;
}

const EMPTY_DRAFT: DraftState = {
  campaignId: "",
  source: "bandit",
  anchorEntityId: "",
  partyLevel: "5",
  narrativeDensity: "sobrio",
};

const FIELD_LABELS: Record<string, string> = {
  campaignId: "Campagna",
  source: "Sorgente",
  anchorEntityId: "Anchor",
  partyLevel: "Livello party",
  narrativeDensity: "Densita",
};

export function LootGeneratorWorkbench() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [encounters, setEncounters] = useState<EncounterRow[]>([]);
  const [sessionOptions, setSessionOptions] = useState<SessionOptionRow[]>([]);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [encounterId, setEncounterId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [validatedInput, setValidatedInput] =
    useState<LootGeneratorInput | null>(null);
  const [preview, setPreview] = useState<LootGeneratorOutput | null>(null);
  const [resolution, setResolution] = useState<LootResolutionSummary | null>(
    null,
  );
  const [savedLoot, setSavedLoot] = useState<SavedLootResponse | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [loadingEncounters, setLoadingEncounters] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCampaigns() {
      setLoadingCampaigns(true);
      setError(null);
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
      } finally {
        if (!cancelled) setLoadingCampaigns(false);
      }
    }

    void loadCampaigns();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!draft.campaignId) return;
    let cancelled = false;

    async function loadEntities() {
      setLoadingEntities(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          campaign_id: draft.campaignId,
          sort: "name_asc",
          limit: "300",
        });
        const rows = await apiFetch<EntityRow[]>(
          `/api/entities?${params.toString()}`,
        );
        if (cancelled) return;
        setEntities(rows);
        setDraft((current) => {
          const validAnchor = rows.some((row) => row.id === current.anchorEntityId);
          return {
            ...current,
            anchorEntityId: validAnchor ? current.anchorEntityId : "",
          };
        });
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setLoadingEntities(false);
      }
    }

    void loadEntities();
    return () => {
      cancelled = true;
    };
  }, [draft.campaignId]);

  useEffect(() => {
    if (!draft.campaignId) return;
    let cancelled = false;

    async function loadEncounters() {
      setLoadingEncounters(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          campaign_id: draft.campaignId,
        });
        const rows = await apiFetch<EncounterRow[]>(
          `/api/encounters?${params.toString()}`,
        );
        if (cancelled) return;
        setEncounters(rows);
        setEncounterId((current) =>
          rows.some((row) => row.id === current) ? current : "",
        );
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setLoadingEncounters(false);
      }
    }

    void loadEncounters();
    return () => {
      cancelled = true;
    };
  }, [draft.campaignId]);

  useEffect(() => {
    let cancelled = false;
    async function loadSessions() {
      if (!draft.campaignId) {
        setSessionOptions([]);
        return;
      }
      try {
        const rows = await apiFetch<SessionOptionRow[]>(
          `/api/sessions?campaign_id=${encodeURIComponent(draft.campaignId)}`,
        );
        if (cancelled) return;
        setSessionOptions(rows);
        setSessionId((current) =>
          rows.some((row) => row.id === current) ? current : "",
        );
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      }
    }
    void loadSessions();
    return () => {
      cancelled = true;
    };
  }, [draft.campaignId]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === draft.campaignId),
    [campaigns, draft.campaignId],
  );
  const selectedAnchor = useMemo(
    () => entities.find((entity) => entity.id === draft.anchorEntityId),
    [entities, draft.anchorEntityId],
  );
  const selectedEncounter = useMemo(
    () => encounters.find((encounter) => encounter.id === encounterId),
    [encounters, encounterId],
  );

  function updateDraft<K extends keyof DraftState>(
    key: K,
    value: DraftState[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setValidatedInput(null);
    setPreview(null);
    setResolution(null);
    setSavedLoot(null);
    setMessage(null);
    setError(null);
  }

  async function generatePreview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = lootGeneratorInputSchema.safeParse(draft);
    if (!result.success) {
      setError(formatValidationError(result.error.issues));
      setValidatedInput(null);
      setPreview(null);
      setResolution(null);
      setSavedLoot(null);
      setMessage(null);
      return;
    }

    setGenerating(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch<LootGeneratorPreviewResponse>(
        "/api/loot-generator/generate",
        {
          method: "POST",
          body: JSON.stringify(result.data),
        },
      );
      setValidatedInput(response.input);
      setPreview(response.output);
      setResolution(response.resolution);
      setSavedLoot(null);
      setMessage("Preview generata");
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setGenerating(false);
    }
  }

  async function saveBundle() {
    if (!preview) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch<SavedLootResponse>(
        "/api/loot-generator/save",
        {
          method: "POST",
          body: JSON.stringify({
            output: preview,
            encounterId: encounterId || undefined,
            sessionId: sessionId || undefined,
          }),
        },
      );
      setSavedLoot(response);
      setResolution(response.resolution);
      setMessage(
        `Bundle salvato (${response.createdEntities.length} nuovi item)`,
      );
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Loot Generator
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Fase 4
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          {selectedCampaign?.name ?? "Nessuna campagna"}
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <form
            onSubmit={generatePreview}
            className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Campagna
                </span>
                <select
                  value={draft.campaignId}
                  onChange={(event) =>
                    updateDraft("campaignId", event.target.value)
                  }
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

              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Anchor
                </span>
                <select
                  value={draft.anchorEntityId}
                  onChange={(event) =>
                    updateDraft("anchorEntityId", event.target.value)
                  }
                  disabled={!draft.campaignId || loadingEntities}
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="">Solo sorgente testuale</option>
                  {entities.map((entity) => (
                    <option key={entity.id} value={entity.id}>
                      {entity.name} ({entity.type})
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Sorgente
                </span>
                <input
                  value={draft.source}
                  onChange={(event) => updateDraft("source", event.target.value)}
                  list="loot-generator-sources"
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <datalist id="loot-generator-sources">
                  {lootSourcePresetOptions.map((source) => (
                    <option key={source} value={source} />
                  ))}
                </datalist>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Encounter
                </span>
                <select
                  value={encounterId}
                  onChange={(event) => {
                    setEncounterId(event.target.value);
                    setSavedLoot(null);
                    setMessage(null);
                    setError(null);
                  }}
                  disabled={!draft.campaignId || loadingEncounters}
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="">Nessun encounter specifico</option>
                  {encounters.map((encounter) => (
                    <option key={encounter.id} value={encounter.id}>
                      {encounter.title}
                      {encounter.difficulty ? ` (${encounter.difficulty})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                  Sessione
                </span>
                <select
                  value={sessionId}
                  onChange={(event) => {
                    setSessionId(event.target.value);
                    setSavedLoot(null);
                    setMessage(null);
                    setError(null);
                  }}
                  disabled={!draft.campaignId}
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <option value="">Nessuna sessione</option>
                  {sessionOptions.map((session) => (
                    <option key={session.id} value={session.id}>
                      #{session.number}
                      {session.title ? ` ${session.title}` : ""}
                      {session.date
                        ? ` (${new Date(session.date).toLocaleDateString()})`
                        : ""}
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
                  step={1}
                  value={draft.partyLevel}
                  onChange={(event) =>
                    updateDraft("partyLevel", event.target.value)
                  }
                  className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
            </div>

            <div className="mt-6">
              <SegmentedControl
                label="Densita narrativa"
                value={draft.narrativeDensity}
                options={lootNarrativeDensityOptions}
                onChange={(value) => updateDraft("narrativeDensity", value)}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <div className="min-h-5 text-sm">
                {error ? (
                  <span className="text-red-600 dark:text-red-400">
                    {error}
                  </span>
                ) : message ? (
                  <span className="text-emerald-700 dark:text-emerald-400">
                    {message}
                  </span>
                ) : null}
              </div>
              <button
                type="submit"
                disabled={generating || !draft.campaignId}
                className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {generating ? "Genero..." : "Genera preview"}
              </button>
            </div>
          </form>

          <LootPreviewPanel
            output={preview}
            resolution={resolution}
            savedLoot={savedLoot}
            saving={saving}
            onSave={saveBundle}
          />
        </div>

        <aside className="space-y-3 xl:sticky xl:top-8 xl:self-start">
          <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Draft
            </h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <SummaryRow label="Campagna" value={selectedCampaign?.name ?? "-"} />
              <SummaryRow
                label="Anchor"
                value={selectedAnchor?.name ?? "Sorgente testuale"}
              />
              <SummaryRow
                label="Encounter"
                value={selectedEncounter?.title ?? "Non collegato"}
              />
              <SummaryRow label="Sorgente" value={draft.source || "-"} />
              <SummaryRow label="Livello" value={draft.partyLevel || "-"} />
              <SummaryRow label="Densita" value={draft.narrativeDensity} />
            </dl>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Input validato
            </h2>
            <pre className="mt-4 max-h-[420px] overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-5 text-zinc-100">
              {JSON.stringify(validatedInput ?? draft, null, 2)}
            </pre>
          </section>
        </aside>
      </div>
    </div>
  );
}

function LootPreviewPanel({
  output,
  resolution,
  savedLoot,
  saving,
  onSave,
}: {
  output: LootGeneratorOutput | null;
  resolution: LootResolutionSummary | null;
  savedLoot: SavedLootResponse | null;
  saving: boolean;
  onSave: () => void;
}) {
  if (!output) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        Nessuna preview
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
            {output.metadata.source}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {output.baseGold.totalGp} gp · tier {output.baseGold.tier} ·{" "}
            {output.items.length} item
          </p>
        </div>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || savedLoot !== null}
          className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-50 dark:bg-emerald-500 dark:text-zinc-950 dark:hover:bg-emerald-400"
        >
          {saving ? "Salvo..." : savedLoot ? "Salvato" : "Salva bundle"}
        </button>
      </div>

      {savedLoot && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          {savedLoot.bundle.title ?? "Loot bundle"} salvato con{" "}
          {savedLoot.createdEntities.length} nuovi item.
        </div>
      )}

      <PreviewBlock title="Summary" text={output.narrativeSummary} />
      {output.gmNotes && <PreviewBlock title="GM" text={output.gmNotes} />}
      <PreviewBlock title="Hook" items={output.hooks} />

      <div className="grid gap-4 lg:grid-cols-2">
        {output.items.map((item) => {
          const resolved = resolution?.items.find(
            (entry) => entry.name === item.name,
          );
          return (
            <article
              key={item.name}
              className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">
                    {item.name}
                  </h3>
                  <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {item.kind} · {item.rarity} · x{item.quantity}
                  </p>
                </div>
                <ResolutionBadge item={resolved} />
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                {item.description}
              </p>
              <TextList items={item.effects} />
              {item.lore_references.length > 0 && (
                <div className="mt-3 rounded-md bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-950 dark:text-zinc-300">
                  {item.lore_references.map((reference) => (
                    <div key={`${item.name}-${reference.entity_name}`}>
                      {reference.entity_name}: {reference.reason}
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>

      <details className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          JSON
        </summary>
        <pre className="mt-3 max-h-[420px] overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-5 text-zinc-100">
          {JSON.stringify({ output, resolution }, null, 2)}
        </pre>
      </details>
    </section>
  );
}

function ResolutionBadge({
  item,
}: {
  item: LootResolutionSummary["items"][number] | undefined;
}) {
  if (!item) {
    return (
      <span className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        pending
      </span>
    );
  }

  if (item.action === "reuse" && item.match) {
    return (
      <span className="rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200">
        reuse {Math.round(item.match.score * 100)}%
      </span>
    );
  }

  return (
    <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
      create
    </span>
  );
}

function PreviewBlock({
  title,
  text,
  items,
}: {
  title: string;
  text?: string | null;
  items?: string[];
}) {
  if (!text && (!items || items.length === 0)) return null;
  return (
    <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
        {title}
      </h3>
      {text && (
        <p className="mt-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
          {text}
        </p>
      )}
      {items && <TextList items={items} />}
    </div>
  );
}

function TextList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid gap-2">
      <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`h-10 rounded-md border px-3 text-sm font-medium transition-colors ${
              value === option
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="truncate text-right font-medium text-zinc-900 dark:text-zinc-100">
        {value}
      </dd>
    </div>
  );
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
      // Response not JSON.
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

function messageForError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function formatValidationError(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): string {
  const first = issues[0];
  if (!first) return "Input non valido";
  const field =
    typeof first.path[0] === "symbol" ? "" : String(first.path[0] ?? "");
  const label = FIELD_LABELS[field] ?? "Input";
  return `${label}: ${first.message}`;
}
