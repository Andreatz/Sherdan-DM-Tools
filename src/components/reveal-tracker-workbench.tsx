"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type TargetType = "truth_clue" | "entity_secret";
type OverrideMode = "hidden" | "revealed";

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
  targetType: TargetType;
  targetId: string;
  mode: OverrideMode;
  notes: string | null;
}

interface RevealTarget {
  id: string;
  targetType: TargetType;
  label: string;
  detail: string;
  status: "protected" | "party_revealed";
  layer: string | null;
  source: string | null;
  overrides: Record<string, OverrideRow>;
  updatedAt: string;
}

interface RevealPayload {
  players: PlayerRow[];
  latestSession: { id: string; number: number; title: string | null } | null;
  targets: RevealTarget[];
}

export function RevealTrackerWorkbench() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [filter, setFilter] = useState<"all" | TargetType>("all");
  const [payload, setPayload] = useState<RevealPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
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
    async function loadTracker() {
      if (!campaignId) {
        setPayload(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<RevealPayload>(
          `/api/reveal-tracker?campaign_id=${encodeURIComponent(campaignId)}`,
        );
        if (!cancelled) setPayload(data);
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadTracker();
    return () => {
      cancelled = true;
    };
  }, [campaignId, refreshToken]);

  async function setOverride(
    target: RevealTarget,
    player: PlayerRow,
    mode: OverrideMode | null,
  ) {
    const key = `${target.targetType}:${target.id}:${player.id}`;
    const existing = target.overrides[player.id];
    setSavingKey(key);
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
            targetType: target.targetType,
            targetId: target.id,
            mode,
          }),
        });
      }
      setRefreshToken((value) => value + 1);
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setSavingKey(null);
    }
  }

  async function setPartyReveal(target: RevealTarget, revealed: boolean) {
    const key = `${target.targetType}:${target.id}:party`;
    setSavingKey(key);
    setError(null);
    try {
      if (target.targetType === "truth_clue") {
        await apiFetch(`/api/truth-clues/${target.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: revealed ? "understood" : "planted",
          }),
        });
      } else {
        if (revealed && !payload?.latestSession) {
          throw new Error(
            "Serve almeno una sessione per marcare un segreto come scoperto.",
          );
        }
        await apiFetch(`/api/entity-secrets/${target.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            discoveredAtSession: revealed ? payload?.latestSession?.id : null,
            discoveryNotes: revealed
              ? `Segnato dal Reveal Tracker${payload?.latestSession ? ` nella sessione #${payload.latestSession.number}` : ""}.`
              : null,
          }),
        });
      }
      setRefreshToken((value) => value + 1);
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setSavingKey(null);
    }
  }

  const visibleTargets = useMemo(() => {
    const rows = payload?.targets ?? [];
    return filter === "all"
      ? rows
      : rows.filter((target) => target.targetType === filter);
  }, [payload?.targets, filter]);

  const stats = useMemo(() => {
    const rows = payload?.targets ?? [];
    return rows.reduce(
      (acc, target) => {
        acc.total += 1;
        if (target.status === "party_revealed") acc.partyRevealed += 1;
        if (target.status === "protected") acc.protected += 1;
        for (const override of Object.values(target.overrides)) {
          if (override.mode === "revealed") acc.playerRevealed += 1;
          if (override.mode === "hidden") acc.playerHidden += 1;
        }
        return acc;
      },
      {
        total: 0,
        protected: 0,
        partyRevealed: 0,
        playerRevealed: 0,
        playerHidden: 0,
      },
    );
  }, [payload?.targets]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Spoiler Gate / Reveal Tracker
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Stato dei reveal: briciole, segreti stratificati e override per-player.
          </p>
        </div>
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
              campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))
            )}
          </select>
        </label>
      </header>

      {error && <ErrorBox message={error} />}

      <section className="grid gap-3 md:grid-cols-5">
        <StatCard label="Totali" value={stats.total} />
        <StatCard label="Protetti" value={stats.protected} />
        <StatCard label="Party" value={stats.partyRevealed} />
        <StatCard label="Player revealed" value={stats.playerRevealed} />
        <StatCard label="Player hidden" value={stats.playerHidden} />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex flex-wrap gap-2">
            {(["all", "truth_clue", "entity_secret"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`h-8 rounded-md px-3 text-xs font-medium ${
                  filter === value
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                    : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                }`}
              >
                {value === "all"
                  ? "Tutti"
                  : value === "truth_clue"
                    ? "Briciole"
                    : "Segreti"}
              </button>
            ))}
          </div>
          <div className="flex gap-3 text-xs">
            <Link href="/truth-clues" className="font-medium underline underline-offset-2">
              Briciole
            </Link>
            <Link href="/campaigns" className="font-medium underline underline-offset-2">
              Segreti entita
            </Link>
          </div>
        </header>

        {loading ? (
          <p className="p-4 text-sm text-zinc-500">Caricamento reveal...</p>
        ) : visibleTargets.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">
            Nessun reveal per il filtro selezionato.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {visibleTargets.map((target) => (
              <li key={`${target.targetType}:${target.id}`} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {target.label}
                  </span>
                  <Badge tone={target.status === "party_revealed" ? "good" : "warn"}>
                    {target.status === "party_revealed" ? "party revealed" : "protected"}
                  </Badge>
                  <Badge tone="neutral">
                    {target.targetType === "truth_clue" ? "briciola" : "segreto"}
                  </Badge>
                  {target.layer && <Badge tone="neutral">{target.layer}</Badge>}
                  {target.source && (
                    <span className="text-xs text-zinc-500">{target.source}</span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-200">
                  {target.detail}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton
                    disabled={savingKey === `${target.targetType}:${target.id}:party`}
                    active={target.status === "party_revealed"}
                    onClick={() => void setPartyReveal(target, true)}
                  >
                    Party reveal
                  </ActionButton>
                  <ActionButton
                    disabled={savingKey === `${target.targetType}:${target.id}:party`}
                    onClick={() => void setPartyReveal(target, false)}
                  >
                    Proteggi
                  </ActionButton>
                </div>
                <PlayerOverrides
                  players={payload?.players ?? []}
                  target={target}
                  savingKey={savingKey}
                  setOverride={setOverride}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PlayerOverrides({
  players,
  target,
  savingKey,
  setOverride,
}: {
  players: PlayerRow[];
  target: RevealTarget;
  savingKey: string | null;
  setOverride: (
    target: RevealTarget,
    player: PlayerRow,
    mode: OverrideMode | null,
  ) => Promise<void>;
}) {
  if (players.length === 0) {
    return (
      <p className="mt-3 text-xs text-zinc-500">
        Nessun player attivo per override individuali.
      </p>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {players.map((player) => {
        const override = target.overrides[player.id];
        const key = `${target.targetType}:${target.id}:${player.id}`;
        return (
          <span
            key={player.id}
            className="inline-flex flex-wrap items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-800"
          >
            <span className="font-medium">{player.name}</span>
            <span className="text-zinc-500">
              {override ? override.mode : "default"}
            </span>
            <ActionButton
              active={override?.mode === "revealed"}
              disabled={savingKey === key}
              onClick={() => void setOverride(target, player, "revealed")}
            >
              Rivela
            </ActionButton>
            <ActionButton
              active={override?.mode === "hidden"}
              disabled={savingKey === key}
              onClick={() => void setOverride(target, player, "hidden")}
            >
              Nascondi
            </ActionButton>
            <ActionButton
              disabled={savingKey === key || !override}
              onClick={() => void setOverride(target, player, null)}
            >
              Reset
            </ActionButton>
          </span>
        );
      })}
    </div>
  );
}

function ActionButton({
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "good" | "warn" | "neutral";
}) {
  const className = {
    good: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300",
    warn: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300",
    neutral: "bg-zinc-100 text-zinc-700 ring-zinc-600/20 dark:bg-zinc-800 dark:text-zinc-300",
  }[tone];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium uppercase tracking-wide ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
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
