"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type OverrideMode = "hidden" | "revealed";
type EntityType =
  | "npc"
  | "pc"
  | "location"
  | "faction"
  | "item"
  | "monster"
  | "deity"
  | "organization";

interface CampaignRow {
  id: string;
  name: string;
}

interface PlayerRow {
  id: string;
  name: string;
  active: boolean;
}

interface OverrideRow {
  id: string;
  playerId: string;
  targetId: string;
  mode: OverrideMode;
  notes: string | null;
}

interface EntityMatrixRow {
  id: string;
  name: string;
  type: EntityType;
  visibility: "dm_only" | "discovered" | "public";
  publicDescription: string | null;
  overrides: Record<string, OverrideRow>;
}

interface MatrixPayload {
  players: PlayerRow[];
  entities: EntityMatrixRow[];
}

const ENTITY_TYPES: EntityType[] = [
  "npc",
  "pc",
  "faction",
  "organization",
  "location",
  "deity",
  "monster",
  "item",
];

export function KnowledgeMatrixWorkbench() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [entityType, setEntityType] = useState<EntityType>("npc");
  const [payload, setPayload] = useState<MatrixPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCampaigns() {
      try {
        const rows = await apiFetch<CampaignRow[]>("/api/campaigns");
        if (cancelled) return;
        setCampaigns(rows);
        setCampaignId((current) => current || (rows[0]?.id ?? ""));
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      }
    }
    void loadCampaigns();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadMatrix() {
      if (!campaignId) {
        setPayload(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<MatrixPayload>(
          `/api/knowledge-matrix?campaign_id=${encodeURIComponent(campaignId)}&type=${encodeURIComponent(entityType)}`,
        );
        if (!cancelled) setPayload(data);
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadMatrix();
    return () => {
      cancelled = true;
    };
  }, [campaignId, entityType]);

  const stats = useMemo(() => {
    if (!payload) return { total: 0, revealed: 0, hidden: 0 };
    let revealed = 0;
    let hidden = 0;
    for (const entity of payload.entities) {
      for (const override of Object.values(entity.overrides)) {
        if (override.mode === "revealed") revealed += 1;
        if (override.mode === "hidden") hidden += 1;
      }
    }
    return { total: payload.entities.length, revealed, hidden };
  }, [payload]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Matrice conoscenza PNG
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Chi sa cosa: visibilita base e override per-player sugli NPC e sugli altri target.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <SelectField
            label="Campagna"
            value={campaignId}
            onChange={setCampaignId}
            options={campaigns.map((campaign) => ({
              value: campaign.id,
              label: campaign.name,
            }))}
          />
          <SelectField
            label="Tipo"
            value={entityType}
            onChange={(value) => setEntityType(value as EntityType)}
            options={ENTITY_TYPES.map((type) => ({ value: type, label: type }))}
          />
        </div>
      </header>

      {error && <ErrorBox message={error} />}

      <section className="grid gap-3 md:grid-cols-3">
        <StatCard label="Target" value={String(stats.total)} />
        <StatCard label="Override revealed" value={String(stats.revealed)} />
        <StatCard label="Override hidden" value={String(stats.hidden)} />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div>
            <h2 className="text-sm font-semibold">Matrice</h2>
            <p className="text-xs text-zinc-500">
              Default segue la visibilita del target; gli override prevalgono per singolo player.
            </p>
          </div>
          <Link
            href="/campaigns"
            className="text-xs font-medium underline underline-offset-2"
          >
            Apri wiki entita
          </Link>
        </header>
        {loading ? (
          <p className="p-4 text-sm text-zinc-500">Caricamento matrice...</p>
        ) : !payload || payload.entities.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">
            Nessun target di tipo {entityType} per questa campagna.
          </p>
        ) : payload.players.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">
            Nessun player attivo. Crea i player dal Player Dashboard control panel.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
                <tr>
                  <th className="sticky left-0 z-10 bg-zinc-50 px-4 py-3 dark:bg-zinc-950">
                    Target
                  </th>
                  <th className="px-3 py-3">Base</th>
                  {payload.players.map((player) => (
                    <th key={player.id} className="px-3 py-3">
                      {player.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {payload.entities.map((entity) => (
                  <tr key={entity.id}>
                    <td className="sticky left-0 z-10 max-w-xs bg-white px-4 py-3 dark:bg-zinc-900">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {entity.name}
                      </div>
                      {entity.publicDescription && (
                        <div className="mt-1 line-clamp-2 text-xs text-zinc-500">
                          {entity.publicDescription}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <VisibilityBadge mode={baseModeFor(entity.visibility)} />
                    </td>
                    {payload.players.map((player) => {
                      const override = entity.overrides[player.id];
                      return (
                        <td key={player.id} className="px-3 py-3">
                          <VisibilityBadge
                            mode={override?.mode ?? baseModeFor(entity.visibility)}
                            muted={!override}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function baseModeFor(visibility: EntityMatrixRow["visibility"]): OverrideMode {
  return visibility === "dm_only" ? "hidden" : "revealed";
}

function VisibilityBadge({
  mode,
  muted = false,
}: {
  mode: OverrideMode;
  muted?: boolean;
}) {
  const className =
    mode === "revealed"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300"
      : "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950 dark:text-red-300";
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${className} ${
        muted ? "opacity-60" : ""
      }`}
    >
      {mode}
    </span>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
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
        {options.length === 0 ? (
          <option value="">Nessuna opzione</option>
        ) : (
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))
        )}
      </select>
    </label>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
      {message}
    </div>
  );
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
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
