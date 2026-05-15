"use client";

import Link from "next/link";
import type { ReactNode } from "react";
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
  const [search, setSearch] = useState("");
  const [onlyOverrides, setOnlyOverrides] = useState(false);
  const [payload, setPayload] = useState<MatrixPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
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
  }, [campaignId, entityType, refreshToken]);

  async function setEntityOverride(
    entity: EntityMatrixRow,
    player: PlayerRow,
    mode: OverrideMode | null,
  ) {
    const cellKey = `${entity.id}:${player.id}`;
    const existing = entity.overrides[player.id];
    setSavingCell(cellKey);
    setError(null);
    try {
      if (mode === null) {
        if (existing) {
          await apiFetch(`/api/player-visibility-overrides/${existing.id}`, {
            method: "DELETE",
          });
        }
      } else if (existing) {
        if (existing.mode !== mode) {
          await apiFetch(`/api/player-visibility-overrides/${existing.id}`, {
            method: "PATCH",
            body: JSON.stringify({ mode }),
          });
        }
      } else {
        await apiFetch("/api/player-visibility-overrides", {
          method: "POST",
          body: JSON.stringify({
            playerId: player.id,
            targetType: "entity",
            targetId: entity.id,
            mode,
          }),
        });
      }
      setRefreshToken((value) => value + 1);
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setSavingCell(null);
    }
  }

  async function setRowOverride(entity: EntityMatrixRow, mode: OverrideMode | null) {
    if (!payload) return;
    setError(null);
    try {
      for (const player of payload.players) {
        await setEntityOverride(entity, player, mode);
      }
    } catch (err) {
      setError(messageForError(err));
    }
  }

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

  const visibleEntities = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (payload?.entities ?? []).filter((entity) => {
      if (onlyOverrides && Object.keys(entity.overrides).length === 0) {
        return false;
      }
      if (!query) return true;
      return (
        entity.name.toLowerCase().includes(query) ||
        (entity.publicDescription ?? "").toLowerCase().includes(query)
      );
    });
  }, [onlyOverrides, payload?.entities, search]);

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

      <section className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_auto] dark:border-zinc-800 dark:bg-zinc-900">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cerca target o descrizione pubblica..."
          className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <label className="inline-flex h-10 items-center gap-2 rounded-md border border-zinc-300 px-3 text-sm dark:border-zinc-700">
          <input
            type="checkbox"
            checked={onlyOverrides}
            onChange={(event) => setOnlyOverrides(event.target.checked)}
          />
          <span>Solo override</span>
        </label>
      </section>

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
        ) : !payload || visibleEntities.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">
            Nessun target di tipo {entityType} per filtri correnti.
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
                {visibleEntities.map((entity) => (
                  <tr key={entity.id}>
                    <td className="sticky left-0 z-10 max-w-xs bg-white px-4 py-3 dark:bg-zinc-900">
                      <Link
                        href={`/campaigns/${encodeURIComponent(campaignId)}?focus=${encodeURIComponent(entity.id)}#entity-detail`}
                        className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-100"
                      >
                        {entity.name}
                      </Link>
                      {entity.publicDescription && (
                        <div className="mt-1 line-clamp-2 text-xs text-zinc-500">
                          {entity.publicDescription}
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1">
                        <CellButton
                          disabled={savingCell !== null}
                          onClick={() => void setRowOverride(entity, "revealed")}
                        >
                          Rivela riga
                        </CellButton>
                        <CellButton
                          disabled={savingCell !== null}
                          onClick={() => void setRowOverride(entity, "hidden")}
                        >
                          Nascondi riga
                        </CellButton>
                        <CellButton
                          disabled={
                            savingCell !== null ||
                            Object.keys(entity.overrides).length === 0
                          }
                          onClick={() => void setRowOverride(entity, null)}
                        >
                          Reset riga
                        </CellButton>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <VisibilityBadge mode={baseModeFor(entity.visibility)} />
                    </td>
                    {payload.players.map((player) => {
                      const override = entity.overrides[player.id];
                      const mode = override?.mode ?? baseModeFor(entity.visibility);
                      const saving = savingCell === `${entity.id}:${player.id}`;
                      return (
                        <td key={player.id} className="px-3 py-3">
                          <div className="flex min-w-36 flex-col gap-1">
                            <VisibilityBadge mode={mode} muted={!override} />
                            <div className="flex flex-wrap gap-1">
                              <CellButton
                                disabled={saving}
                                active={override?.mode === "revealed"}
                                onClick={() =>
                                  void setEntityOverride(entity, player, "revealed")
                                }
                              >
                                Rivela
                              </CellButton>
                              <CellButton
                                disabled={saving}
                                active={override?.mode === "hidden"}
                                onClick={() =>
                                  void setEntityOverride(entity, player, "hidden")
                                }
                              >
                                Nascondi
                              </CellButton>
                              <CellButton
                                disabled={saving || !override}
                                onClick={() =>
                                  void setEntityOverride(entity, player, null)
                                }
                              >
                                Reset
                              </CellButton>
                            </div>
                          </div>
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

function CellButton({
  children,
  onClick,
  active = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide disabled:opacity-40 ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
      }`}
    >
      {children}
    </button>
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
