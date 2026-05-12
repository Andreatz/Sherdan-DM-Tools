"use client";

import { useEffect, useMemo, useState } from "react";

type OverrideTarget = "entity" | "truth_clue" | "entity_secret";
type OverrideMode = "hidden" | "revealed";

interface PlayerRow {
  id: string;
  name: string;
  active: boolean;
}

interface OverrideRow {
  id: string;
  playerId: string;
  targetType: OverrideTarget;
  targetId: string;
  mode: OverrideMode;
  notes: string | null;
  createdAt: string;
}

export interface PlayerOverrideEditorProps {
  campaignId: string;
  targetType: OverrideTarget;
  targetId: string;
  /** Etichetta del target (es. "Garrick il Sussurratore") per audit/log UI. */
  targetLabel?: string;
  /**
   * Visibilita' base del target nel modello DM (`dm_only`/`discovered`/
   * `public`). Determina quale mode propone l'UI per default: per un
   * target `dm_only` ha senso solo `revealed` (sbloccarlo a 1 player);
   * per `public/discovered` ha senso solo `hidden` (nasconderlo a 1).
   */
  baseVisibility?: "dm_only" | "discovered" | "public";
}

export function PlayerOverrideEditor({
  campaignId,
  targetType,
  targetId,
  targetLabel,
  baseVisibility,
}: PlayerOverrideEditorProps) {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPlayerId, setSavingPlayerId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [playersRows, overrideRows] = await Promise.all([
          apiFetch<PlayerRow[]>(
            `/api/players?campaign_id=${encodeURIComponent(campaignId)}&active=true`,
          ),
          apiFetch<OverrideRow[]>(
            `/api/player-visibility-overrides?campaign_id=${encodeURIComponent(campaignId)}&target_type=${encodeURIComponent(targetType)}&target_id=${encodeURIComponent(targetId)}`,
          ),
        ]);
        if (cancelled) return;
        setPlayers(playersRows);
        setOverrides(overrideRows);
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
  }, [campaignId, targetType, targetId, refreshToken]);

  function refresh() {
    setRefreshToken((value) => value + 1);
  }

  const overrideByPlayerId = useMemo(() => {
    const map = new Map<string, OverrideRow>();
    for (const o of overrides) map.set(o.playerId, o);
    return map;
  }, [overrides]);

  const baseExposed =
    baseVisibility === "public" || baseVisibility === "discovered";
  // Per un target gia' esposto al party la mossa naturale e' nasconderlo
  // a 1 player. Per un target `dm_only`, la mossa naturale e' rivelarlo
  // a 1 player. La UI mostra entrambi i pulsanti ma evidenzia il default.
  const defaultMode: OverrideMode = baseExposed ? "hidden" : "revealed";

  async function setMode(player: PlayerRow, mode: OverrideMode | null) {
    setSavingPlayerId(player.id);
    setError(null);
    try {
      const existing = overrideByPlayerId.get(player.id);
      if (mode === null) {
        if (!existing) return;
        const res = await fetch(`/api/player-visibility-overrides/${existing.id}`, {
          method: "DELETE",
        });
        if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      } else if (existing) {
        if (existing.mode === mode) return;
        await apiFetch<OverrideRow>(
          `/api/player-visibility-overrides/${existing.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ mode }),
          },
        );
      } else {
        await apiFetch<OverrideRow>(`/api/player-visibility-overrides`, {
          method: "POST",
          body: JSON.stringify({
            playerId: player.id,
            targetType,
            targetId,
            mode,
          }),
        });
      }
      refresh();
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setSavingPlayerId(null);
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <header className="space-y-0.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
          Override visibilita&apos; per giocatore
        </h4>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {targetLabel ? (
            <>
              Target: <span className="font-medium">{targetLabel}</span> ·{" "}
            </>
          ) : null}
          Visibilita&apos; base:{" "}
          <span className="font-medium">{baseVisibility ?? "?"}</span>.{" "}
          {baseExposed
            ? "Default `hidden`: il giocatore selezionato NON vedra' questo target."
            : "Default `revealed`: il giocatore selezionato VEDRA' questo target anche se dm_only."}
        </p>
      </header>
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-[11px] text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}
      {loading ? (
        <p className="text-[11px] text-zinc-500">Caricamento...</p>
      ) : players.length === 0 ? (
        <p className="text-[11px] text-zinc-500">
          Nessun giocatore attivo. Crea i player nel pannello Player access.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {players.map((player) => {
            const current = overrideByPlayerId.get(player.id);
            const saving = savingPlayerId === player.id;
            return (
              <li
                key={player.id}
                className="flex flex-wrap items-center gap-2 py-1.5 text-xs"
              >
                <span className="font-medium text-zinc-800 dark:text-zinc-100">
                  {player.name}
                </span>
                <span className="ml-auto flex flex-wrap items-center gap-1">
                  {(["hidden", "revealed"] as const).map((mode) => {
                    const isActive = current?.mode === mode;
                    const isDefault = mode === defaultMode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setMode(player, mode)}
                        disabled={saving}
                        className={`rounded px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                          isActive
                            ? mode === "hidden"
                              ? "bg-red-100 text-red-800 ring-1 ring-red-400 dark:bg-red-900/40 dark:text-red-200"
                              : "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-400 dark:bg-emerald-900/40 dark:text-emerald-200"
                            : isDefault
                              ? "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
                              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                        }`}
                      >
                        {mode === "hidden" ? "Nascondi" : "Rivela"}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setMode(player, null)}
                    disabled={saving || !current}
                    className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 hover:text-zinc-900 disabled:opacity-30 dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    Reset
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
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
