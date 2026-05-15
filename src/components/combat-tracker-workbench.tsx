"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

interface CampaignRow {
  id: string;
  name: string;
}

interface InitiativeTurn {
  id?: string;
  name: string;
  initiative?: number;
  hp?: string;
  note?: string;
}

interface DashboardInitiative {
  active: boolean;
  round?: number;
  turns: InitiativeTurn[];
}

interface DashboardState {
  campaignId: string;
  initiative: DashboardInitiative | null;
}

interface DashboardPayload {
  state: DashboardState;
}

const EMPTY_INITIATIVE: DashboardInitiative = {
  active: false,
  round: 1,
  turns: [],
};

export function CombatTrackerWorkbench() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [initiative, setInitiative] =
    useState<DashboardInitiative>(EMPTY_INITIATIVE);
  const [draft, setDraft] = useState({
    name: "",
    initiative: "",
    hp: "",
    note: "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
    async function loadDashboard() {
      if (!campaignId) {
        setInitiative(EMPTY_INITIATIVE);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const payload = await apiFetch<DashboardPayload>(
          `/api/player-dashboard?campaign_id=${encodeURIComponent(campaignId)}`,
        );
        if (cancelled) return;
        setInitiative(normalizeInitiative(payload.state.initiative));
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const sortedTurns = useMemo(
    () =>
      [...initiative.turns].sort(
        (a, b) => (b.initiative ?? -999) - (a.initiative ?? -999),
      ),
    [initiative.turns],
  );

  function addTurn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    const next: InitiativeTurn = {
      id: crypto.randomUUID(),
      name,
      initiative: draft.initiative.trim()
        ? Number.parseInt(draft.initiative, 10)
        : undefined,
      hp: draft.hp.trim() || undefined,
      note: draft.note.trim() || undefined,
    };
    setInitiative((current) => ({
      ...current,
      turns: [...current.turns, next],
    }));
    setDraft({ name: "", initiative: "", hp: "", note: "" });
  }

  function updateTurn(id: string, patch: Partial<InitiativeTurn>) {
    setInitiative((current) => ({
      ...current,
      turns: current.turns.map((turn) =>
        turn.id === id ? { ...turn, ...patch } : turn,
      ),
    }));
  }

  function removeTurn(id: string) {
    setInitiative((current) => ({
      ...current,
      turns: current.turns.filter((turn) => turn.id !== id),
    }));
  }

  async function saveAndMaybePush(push: boolean) {
    if (!campaignId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/api/player-dashboard", {
        method: "PATCH",
        body: JSON.stringify({
          campaignId,
          initiative: serializeInitiative({ ...initiative, turns: sortedTurns }),
        }),
      });
      if (push) {
        const result = await apiFetch<{ sent: number }>("/api/player-dashboard", {
          method: "POST",
          body: JSON.stringify({ campaignId }),
        });
        setMessage(`Tracker salvato e inviato a ${result.sent} connessioni.`);
      } else {
        setMessage("Tracker salvato.");
      }
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
            Combat Tracker
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Iniziativa runtime condivisa col Player Dashboard.
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

      {error && <Notice tone="bad">{error}</Notice>}
      {message && <Notice tone="good">{message}</Notice>}

      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Round" value={String(initiative.round ?? 1)} />
        <Stat label="Turni" value={String(initiative.turns.length)} />
        <Stat label="Stato" value={initiative.active ? "Attivo" : "Pausa"} />
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setInitiative((current) => ({
                  ...current,
                  active: !current.active,
                }))
              }
              className="h-9 rounded-md border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {initiative.active ? "Pausa" : "Avvia"}
            </button>
            <button
              type="button"
              onClick={() =>
                setInitiative((current) => ({
                  ...current,
                  round: (current.round ?? 1) + 1,
                }))
              }
              className="h-9 rounded-md border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              + Round
            </button>
            <button
              type="button"
              onClick={() => setInitiative(EMPTY_INITIATIVE)}
              className="h-9 rounded-md border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
            >
              Reset
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">Ordine iniziativa</h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void saveAndMaybePush(false)}
              disabled={saving || loading}
              className="h-9 rounded-md border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Salva
            </button>
            <button
              type="button"
              onClick={() => void saveAndMaybePush(true)}
              disabled={saving || loading}
              className="h-9 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
            >
              Salva e push
            </button>
          </div>
        </header>

        <form
          onSubmit={addTurn}
          className="grid gap-2 border-b border-zinc-200 p-4 dark:border-zinc-800 md:grid-cols-[minmax(0,1fr)_90px_120px_minmax(0,1fr)_auto]"
        >
          <input
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Nome"
            className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={draft.initiative}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                initiative: event.target.value,
              }))
            }
            placeholder="Init"
            type="number"
            className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={draft.hp}
            onChange={(event) =>
              setDraft((current) => ({ ...current, hp: event.target.value }))
            }
            placeholder="HP"
            className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={draft.note}
            onChange={(event) =>
              setDraft((current) => ({ ...current, note: event.target.value }))
            }
            placeholder="Note / condizioni"
            className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            className="h-9 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-950"
          >
            Aggiungi
          </button>
        </form>

        {loading ? (
          <p className="p-4 text-sm text-zinc-500">Caricamento...</p>
        ) : sortedTurns.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">
            Nessun combattente in iniziativa.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {sortedTurns.map((turn, index) => (
              <li
                key={turn.id}
                className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[44px_minmax(0,1fr)_90px_120px_minmax(0,1fr)_auto]"
              >
                <span className="self-center rounded bg-zinc-100 px-2 py-1 text-center text-xs font-semibold dark:bg-zinc-800">
                  {index + 1}
                </span>
                <input
                  value={turn.name}
                  onChange={(event) =>
                    updateTurn(turn.id ?? "", { name: event.target.value })
                  }
                  className="h-9 rounded-md border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <input
                  value={turn.initiative ?? ""}
                  onChange={(event) =>
                    updateTurn(turn.id ?? "", {
                      initiative: event.target.value
                        ? Number.parseInt(event.target.value, 10)
                        : undefined,
                    })
                  }
                  type="number"
                  className="h-9 rounded-md border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <input
                  value={turn.hp ?? ""}
                  onChange={(event) =>
                    updateTurn(turn.id ?? "", { hp: event.target.value || undefined })
                  }
                  className="h-9 rounded-md border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <input
                  value={turn.note ?? ""}
                  onChange={(event) =>
                    updateTurn(turn.id ?? "", { note: event.target.value || undefined })
                  }
                  className="h-9 rounded-md border border-zinc-300 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  type="button"
                  onClick={() => removeTurn(turn.id ?? "")}
                  className="h-9 rounded-md px-3 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  Rimuovi
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function normalizeInitiative(
  value: DashboardInitiative | null,
): DashboardInitiative {
  if (!value) return EMPTY_INITIATIVE;
  return {
    active: value.active,
    round: value.round ?? 1,
    turns: value.turns.map((turn) => ({
      ...turn,
      id: turn.id ?? crypto.randomUUID(),
    })),
  };
}

function serializeInitiative(value: DashboardInitiative) {
  return {
    active: value.active,
    round: value.round ?? 1,
    turns: value.turns.map(({ name, initiative, hp, note }) => ({
      name,
      initiative,
      hp,
      note,
    })),
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

function Notice({
  tone,
  children,
}: {
  tone: "good" | "bad";
  children: string;
}) {
  const className =
    tone === "good"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
      : "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200";
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${className}`}>
      {children}
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
