"use client";

import { useEffect, useState } from "react";

interface PlayerRow {
  id: string;
  campaignId: string;
  name: string;
  active: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PlayerAccessManagerProps {
  campaignId: string;
}

interface DraftState {
  name: string;
  code: string;
}

const EMPTY_DRAFT: DraftState = { name: "", code: "" };

export function PlayerAccessManager({ campaignId }: PlayerAccessManagerProps) {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rowSavingId, setRowSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const rows = await apiFetch<PlayerRow[]>(
          `/api/players?campaign_id=${encodeURIComponent(campaignId)}`,
        );
        if (cancelled) return;
        setPlayers(rows);
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
  }, [campaignId, refreshToken]);

  function triggerRefresh() {
    setRefreshToken((value) => value + 1);
  }

  async function createPlayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim() || !draft.code.trim()) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<PlayerRow>("/api/players", {
        method: "POST",
        body: JSON.stringify({
          campaignId,
          name: draft.name.trim(),
          code: draft.code.trim(),
        }),
      });
      setDraft(EMPTY_DRAFT);
      setMessage(`Player "${draft.name.trim()}" creato.`);
      triggerRefresh();
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(player: PlayerRow) {
    setRowSavingId(player.id);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<PlayerRow>(`/api/players/${player.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !player.active }),
      });
      setMessage(
        !player.active
          ? `Player "${player.name}" riattivato.`
          : `Player "${player.name}" revocato (codice non valido finche' non riattivi).`,
      );
      triggerRefresh();
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setRowSavingId(null);
    }
  }

  async function rotateCode(player: PlayerRow) {
    const code = window.prompt(
      `Nuovo codice per "${player.name}" (min 4 caratteri):`,
    );
    if (!code || code.trim().length < 4) return;
    setRowSavingId(player.id);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<PlayerRow>(`/api/players/${player.id}`, {
        method: "PATCH",
        body: JSON.stringify({ code: code.trim() }),
      });
      setMessage(
        `Codice di "${player.name}" aggiornato. Comunicalo al giocatore.`,
      );
      triggerRefresh();
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setRowSavingId(null);
    }
  }

  async function renamePlayer(player: PlayerRow) {
    const name = window.prompt(`Nuovo nome per "${player.name}":`, player.name);
    if (!name || !name.trim() || name.trim() === player.name) return;
    setRowSavingId(player.id);
    setError(null);
    setMessage(null);
    try {
      await apiFetch<PlayerRow>(`/api/players/${player.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim() }),
      });
      setMessage(`Player rinominato in "${name.trim()}".`);
      triggerRefresh();
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setRowSavingId(null);
    }
  }

  async function removePlayer(player: PlayerRow) {
    if (
      !window.confirm(
        `Eliminare definitivamente "${player.name}"? Tutti gli override di visibilita' verranno cancellati a cascata.`,
      )
    ) {
      return;
    }
    setRowSavingId(player.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/players/${player.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      setMessage(`Player "${player.name}" eliminato.`);
      triggerRefresh();
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setRowSavingId(null);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold tracking-tight">
          Player access
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Ogni giocatore ha un codice individuale. La revoca disattiva
          l&apos;accesso senza cancellare lo storico.
        </p>
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

      <form onSubmit={createPlayer} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Nome giocatore (es. Alice)"
          required
          className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          value={draft.code}
          onChange={(e) => setDraft({ ...draft, code: e.target.value })}
          placeholder="Codice individuale (min 4 caratteri)"
          required
          minLength={4}
          className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="submit"
          disabled={saving}
          className="h-9 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {saving ? "..." : "Crea"}
        </button>
      </form>

      {loading ? (
        <p className="text-xs text-zinc-500">Caricamento...</p>
      ) : players.length === 0 ? (
        <p className="text-xs text-zinc-500">
          Nessun giocatore configurato. Senza player, l&apos;accesso usa il
          codice globale `SHERDAN_PLAYER_ACCESS_CODE`.
        </p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {players.map((player) => (
            <li
              key={player.id}
              className="flex flex-wrap items-center gap-3 py-2 text-sm"
            >
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  player.active
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                    : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {player.active ? "attivo" : "revocato"}
              </span>
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {player.name}
              </span>
              <span className="text-xs text-zinc-500">
                Ultimo accesso:{" "}
                {player.lastSeenAt
                  ? new Date(player.lastSeenAt).toLocaleString()
                  : "mai"}
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => renamePlayer(player)}
                  disabled={rowSavingId === player.id}
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
                >
                  Rinomina
                </button>
                <button
                  type="button"
                  onClick={() => rotateCode(player)}
                  disabled={rowSavingId === player.id}
                  className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
                >
                  Nuovo codice
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(player)}
                  disabled={rowSavingId === player.id}
                  className="text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
                >
                  {player.active ? "Revoca" : "Riattiva"}
                </button>
                <button
                  type="button"
                  onClick={() => removePlayer(player)}
                  disabled={rowSavingId === player.id}
                  className="text-red-600 hover:text-red-700"
                >
                  Elimina
                </button>
              </div>
            </li>
          ))}
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
