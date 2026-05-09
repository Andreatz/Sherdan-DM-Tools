"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  MonsterBrowserFacets,
  MonsterBrowserRecord,
} from "@/lib/encounters";

interface CampaignRow {
  id: string;
  name: string;
}

interface MonsterBrowserResponse {
  rows: MonsterBrowserRecord[];
  total: number;
  limit: number;
  offset: number;
  facets: MonsterBrowserFacets;
}

interface FilterState {
  campaignId: string;
  search: string;
  crMin: string;
  crMax: string;
  creatureType: string;
  environment: string;
  size: string;
}

const EMPTY_FILTERS: FilterState = {
  campaignId: "",
  search: "",
  crMin: "",
  crMax: "",
  creatureType: "",
  environment: "",
  size: "",
};

export function MonsterBrowser() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [data, setData] = useState<MonsterBrowserResponse | null>(null);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [loadingMonsters, setLoadingMonsters] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCampaigns() {
      setLoadingCampaigns(true);
      try {
        const rows = await apiFetch<CampaignRow[]>("/api/campaigns");
        if (cancelled) return;
        setCampaigns(rows);
        setFilters((current) => ({
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
    if (!filters.campaignId) return;
    let cancelled = false;

    async function loadMonsters() {
      setLoadingMonsters(true);
      setError(null);
      try {
        const params = monsterQueryParams(filters);
        const response = await apiFetch<MonsterBrowserResponse>(
          `/api/monsters?${params.toString()}`,
        );
        if (!cancelled) setData(response);
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setLoadingMonsters(false);
      }
    }

    void loadMonsters();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === filters.campaignId),
    [campaigns, filters.campaignId],
  );

  function updateFilter<K extends keyof FilterState>(
    key: K,
    value: FilterState[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetTacticalFilters() {
    setFilters((current) => ({
      ...current,
      search: "",
      crMin: "",
      crMax: "",
      creatureType: "",
      environment: "",
      size: "",
    }));
  }

  const facets = data?.facets;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Encounter Builder
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Browser mostri SRD
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
          {selectedCampaign?.name ?? "Nessuna campagna"}
        </div>
      </header>

      <section className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Campagna
            </span>
            <select
              value={filters.campaignId}
              onChange={(event) =>
                updateFilter("campaignId", event.target.value)
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

          <label className="grid gap-1 lg:col-span-3">
            <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Cerca
            </span>
            <input
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="aboleth, undead, legendary..."
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>

          <FilterSelect
            label="Tipo"
            value={filters.creatureType}
            options={facets?.creatureTypes ?? []}
            placeholder="Tutti"
            onChange={(value) => updateFilter("creatureType", value)}
          />
          <FilterSelect
            label="Environment"
            value={filters.environment}
            options={facets?.environments ?? []}
            placeholder="Tutti"
            onChange={(value) => updateFilter("environment", value)}
          />
          <FilterSelect
            label="Size"
            value={filters.size}
            options={facets?.sizes ?? []}
            placeholder="Tutte"
            onChange={(value) => updateFilter("size", value)}
          />

          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="CR min"
              value={filters.crMin}
              onChange={(value) => updateFilter("crMin", value)}
            />
            <NumberInput
              label="CR max"
              value={filters.crMax}
              onChange={(value) => updateFilter("crMax", value)}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
          <div className="text-zinc-600 dark:text-zinc-400">
            {error ? (
              <span className="text-red-600 dark:text-red-400">{error}</span>
            ) : loadingMonsters ? (
              "Carico mostri..."
            ) : (
              `${data?.total ?? 0} mostri`
            )}
            {facets &&
            facets.crRange.min !== null &&
            facets.crRange.max !== null ? (
              <span>
                {" "}
                - CR {facets.crRange.min}-{facets.crRange.max}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={resetTacticalFilters}
            className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Reset filtri
          </button>
        </div>
      </section>

      <section className="grid gap-4">
        {data?.rows.length === 0 ? (
          <div className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Nessun mostro trovato
          </div>
        ) : (
          data?.rows.map((monster) => (
            <MonsterCard key={monster.id} monster={monster} />
          ))
        )}
      </section>
    </div>
  );
}

function MonsterCard({ monster }: { monster: MonsterBrowserRecord }) {
  const p = monster.properties;

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">
            {monster.name}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {p.size} {p.creature_type}
            {p.alignment ? `, ${p.alignment}` : ""} - CR{" "}
            {p.challenge_rating}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <StatPill label="AC" value={String(p.ac)} />
          <StatPill label="HP" value={String(p.hp_average)} />
          <StatPill label="XP" value={p.xp ? String(p.xp) : "-"} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <InfoBlock label="Speed" value={speedLabel(p.speed)} />
        <InfoBlock label="Senses" value={p.senses.join(", ") || "-"} />
        <InfoBlock label="Languages" value={p.languages.join(", ") || "-"} />
      </div>

      <div className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <InfoBlock
          label="Environment"
          value={p.environment.length > 0 ? p.environment.join(", ") : "-"}
        />
        <InfoBlock
          label="Defenses"
          value={
            [
              p.damage_resistances.length > 0
                ? `Res ${p.damage_resistances.join(", ")}`
                : null,
              p.damage_immunities.length > 0
                ? `Imm ${p.damage_immunities.join(", ")}`
                : null,
              p.condition_immunities.length > 0
                ? `Cond ${p.condition_immunities.join(", ")}`
                : null,
            ]
              .filter(Boolean)
              .join(" - ") || "-"
          }
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
        {monster.tags.slice(0, 10).map((tag) => (
          <span
            key={`${monster.id}-${tag}`}
            className="rounded-md border border-zinc-200 px-2 py-1 dark:border-zinc-800"
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}

function FilterSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
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
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <input
        type="number"
        min={0}
        max={33}
        step={0.125}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
      />
    </label>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-16 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="text-[10px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-950">
      <div className="text-[10px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-zinc-800 dark:text-zinc-200">{value}</div>
    </div>
  );
}

function monsterQueryParams(filters: FilterState) {
  const params = new URLSearchParams({
    campaign_id: filters.campaignId,
    limit: "100",
  });
  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.crMin) params.set("cr_min", filters.crMin);
  if (filters.crMax) params.set("cr_max", filters.crMax);
  if (filters.creatureType) params.set("creature_type", filters.creatureType);
  if (filters.environment) params.set("environment", filters.environment);
  if (filters.size) params.set("size", filters.size);
  return params;
}

function speedLabel(speed: MonsterBrowserRecord["properties"]["speed"]) {
  const entries = Object.entries(speed).filter(
    ([, value]) => value !== undefined,
  );
  if (entries.length === 0) return "-";
  return entries
    .map(([key, value]) => (key === "hover" ? "hover" : `${key} ${value} ft.`))
    .join(", ");
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
