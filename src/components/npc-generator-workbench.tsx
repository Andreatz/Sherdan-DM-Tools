"use client";

import { useEffect, useMemo, useState } from "react";

import {
  npcGeneratorInputSchema,
  npcGeneratorToneOptions,
  npcGeneratorTypeOptions,
  npcNarrativeDepthOptions,
  type NpcGeneratorInput,
  type NpcGeneratorTone,
  type NpcNarrativeDepth,
} from "@/lib/generators/npc-input";

interface CampaignRow {
  id: string;
  name: string;
}

interface LocationRow {
  id: string;
  name: string;
  campaignId: string | null;
}

interface DraftState {
  campaignId: string;
  locationId: string;
  npcType: string;
  partyLevel: string;
  tone: NpcGeneratorTone;
  narrativeDepth: NpcNarrativeDepth;
}

const EMPTY_DRAFT: DraftState = {
  campaignId: "",
  locationId: "",
  npcType: "taverniere",
  partyLevel: "5",
  tone: "cupo",
  narrativeDepth: "secondario",
};

const FIELD_LABELS: Record<string, string> = {
  campaignId: "Campagna",
  locationId: "Location",
  npcType: "Tipo",
  partyLevel: "Livello party",
  tone: "Tono",
  narrativeDepth: "Livello narrativo",
};

export function NpcGeneratorWorkbench() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [validatedInput, setValidatedInput] =
    useState<NpcGeneratorInput | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingLocations, setLoadingLocations] = useState(false);
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
    if (!draft.campaignId) {
      return;
    }

    let cancelled = false;

    async function loadLocations() {
      setLoadingLocations(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          type: "location",
          campaign_id: draft.campaignId,
          sort: "name_asc",
          limit: "200",
        });
        const rows = await apiFetch<LocationRow[]>(
          `/api/entities?${params.toString()}`,
        );
        if (cancelled) return;
        setLocations(rows);
        setDraft((current) => {
          const currentStillValid = rows.some(
            (location) => location.id === current.locationId,
          );
          return {
            ...current,
            locationId: currentStillValid ? current.locationId : (rows[0]?.id ?? ""),
          };
        });
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setLoadingLocations(false);
      }
    }

    void loadLocations();
    return () => {
      cancelled = true;
    };
  }, [draft.campaignId]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === draft.campaignId),
    [campaigns, draft.campaignId],
  );
  const selectedLocation = useMemo(
    () => locations.find((location) => location.id === draft.locationId),
    [locations, draft.locationId],
  );

  function updateDraft<K extends keyof DraftState>(
    key: K,
    value: DraftState[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setValidatedInput(null);
    setMessage(null);
    setError(null);
  }

  function prepareInput(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = npcGeneratorInputSchema.safeParse(draft);
    if (!result.success) {
      setValidatedInput(null);
      setMessage(null);
      setError(formatValidationError(result.error.issues));
      return;
    }

    setValidatedInput(result.data);
    setError(null);
    setMessage("Input pronto");
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">NPC Generator</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Fase 3
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          {selectedCampaign?.name ?? "Nessuna campagna"}
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form
          onSubmit={prepareInput}
          className="min-w-0 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="grid gap-5 lg:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Campagna
              </span>
              <select
                value={draft.campaignId}
                onChange={(event) => updateDraft("campaignId", event.target.value)}
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
                Location
              </span>
              <select
                value={draft.locationId}
                onChange={(event) => updateDraft("locationId", event.target.value)}
                disabled={!draft.campaignId || loadingLocations}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
              >
                {locations.length === 0 ? (
                  <option value="">Nessuna location</option>
                ) : (
                  locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))
                )}
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Tipo
              </span>
              <input
                value={draft.npcType}
                onChange={(event) => updateDraft("npcType", event.target.value)}
                list="npc-generator-types"
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
              <datalist id="npc-generator-types">
                {npcGeneratorTypeOptions.map((type) => (
                  <option key={type} value={type} />
                ))}
              </datalist>
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
                onChange={(event) => updateDraft("partyLevel", event.target.value)}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <SegmentedControl
              label="Tono"
              value={draft.tone}
              options={npcGeneratorToneOptions}
              onChange={(value) => updateDraft("tone", value)}
            />
            <SegmentedControl
              label="Livello narrativo"
              value={draft.narrativeDepth}
              options={npcNarrativeDepthOptions}
              onChange={(value) => updateDraft("narrativeDepth", value)}
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="min-h-5 text-sm">
              {error ? (
                <span className="text-red-600 dark:text-red-400">{error}</span>
              ) : message ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  {message}
                </span>
              ) : null}
            </div>
            <button
              type="submit"
              className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Prepara input
            </button>
          </div>
        </form>

        <aside className="space-y-3 xl:sticky xl:top-8 xl:self-start">
          <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Draft
            </h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <SummaryRow label="Campagna" value={selectedCampaign?.name ?? "-"} />
              <SummaryRow label="Location" value={selectedLocation?.name ?? "-"} />
              <SummaryRow label="Tipo" value={draft.npcType || "-"} />
              <SummaryRow label="Livello" value={draft.partyLevel || "-"} />
              <SummaryRow label="Tono" value={draft.tone} />
              <SummaryRow label="Profondita" value={draft.narrativeDepth} />
            </dl>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Input validato
            </h2>
            <pre className="mt-4 max-h-[440px] overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-5 text-zinc-100">
              {JSON.stringify(validatedInput ?? draft, null, 2)}
            </pre>
          </section>
        </aside>
      </div>
    </div>
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
