"use client";

import { useMemo, useState } from "react";

import {
  parseRecapWikilinkNames,
  resolveRecapMentionEntities,
} from "@/lib/sessions/recap-wikilinks";

interface SessionRecapRow {
  id: string;
  number: number;
  title: string | null;
  date: string | null;
  recap: string | null;
  dmNotes: string | null;
  prepNotes: string | null;
}

interface EntityName {
  id: string;
  name: string;
}

export function SessionRecapEditor({
  sessions,
  entityNames,
}: {
  sessions: SessionRecapRow[];
  entityNames: EntityName[];
}) {
  const [selectedId, setSelectedId] = useState(sessions[0]?.id ?? "");
  const selectedSession = sessions.find((session) => session.id === selectedId);
  const [recaps, setRecaps] = useState(
    () => new Map(sessions.map((session) => [session.id, session.recap ?? ""])),
  );
  const [dmNotes, setDmNotes] = useState(
    () =>
      new Map(sessions.map((session) => [session.id, session.dmNotes ?? ""])),
  );
  const [prepNotes, setPrepNotes] = useState(
    () =>
      new Map(sessions.map((session) => [session.id, session.prepNotes ?? ""])),
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const currentRecap = selectedId ? (recaps.get(selectedId) ?? "") : "";
  const currentDmNotes = selectedId ? (dmNotes.get(selectedId) ?? "") : "";
  const currentPrepNotes = selectedId ? (prepNotes.get(selectedId) ?? "") : "";
  const mentionedEntities = useMemo(() => {
    const wikilinks = parseRecapWikilinkNames(currentRecap);
    return resolveRecapMentionEntities(wikilinks, entityNames);
  }, [currentRecap, entityNames]);

  function updateRecap(value: string) {
    setRecaps((current) => {
      const next = new Map(current);
      next.set(selectedId, value);
      return next;
    });
    setStatus(null);
  }

  function updateDmNotes(value: string) {
    setDmNotes((current) => {
      const next = new Map(current);
      next.set(selectedId, value);
      return next;
    });
    setStatus(null);
  }

  function updatePrepNotes(value: string) {
    setPrepNotes((current) => {
      const next = new Map(current);
      next.set(selectedId, value);
      return next;
    });
    setStatus(null);
  }

  async function saveSessionNotes() {
    if (!selectedId) return;
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/sessions/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recap: currentRecap || null,
          dmNotes: currentDmNotes || null,
          prepNotes: currentPrepNotes || null,
        }),
      });
      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const body = (await response.json()) as {
            error?: { message?: string };
          };
          message = body.error?.message ?? message;
        } catch {
          // Response not JSON.
        }
        throw new Error(message);
      }
      setStatus(`${mentionedEntities.length} entita' collegate`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Sessioni</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Cronaca giocabile della campagna.
          </p>
        </div>
        <button
          type="button"
          onClick={saveSessionNotes}
          disabled={saving || !selectedId}
          className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {saving ? "Salvo..." : "Salva sessione"}
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="mt-4 rounded-md border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Nessuna sessione registrata.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Sessione
              </span>
              <select
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setStatus(null);
                }}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              >
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {sessionLabel(session)}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <div className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Menzioni
              </div>
              {mentionedEntities.length === 0 ? (
                <p className="mt-2 text-zinc-500 dark:text-zinc-400">
                  Nessuna entity riconosciuta.
                </p>
              ) : (
                <ul className="mt-2 grid gap-1">
                  {mentionedEntities.map((entity) => (
                    <li key={entity.id} className="text-zinc-800 dark:text-zinc-200">
                      {entity.name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selectedSession?.date ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {selectedSession.date}
              </div>
            ) : null}
            {status ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                {status}
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Recap
              </span>
              <textarea
                value={currentRecap}
                onChange={(event) => updateRecap(event.target.value)}
                rows={14}
                placeholder="## Recap"
                className="min-h-80 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm leading-6 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                DM notes
              </span>
              <textarea
                value={currentDmNotes}
                onChange={(event) => updateDmNotes(event.target.value)}
                rows={14}
                placeholder="Interpretazioni private, retcon, intuizioni"
                className="min-h-80 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm leading-6 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Prep notes
            </span>
            <textarea
              value={currentPrepNotes}
              onChange={(event) => updatePrepNotes(event.target.value)}
              rows={8}
              placeholder="Scene, agenda, domande aperte"
              className="min-h-48 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm leading-6 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
        </div>
      )}
    </section>
  );
}

function sessionLabel(session: SessionRecapRow) {
  return `Sessione ${session.number}${session.title ? ` - ${session.title}` : ""}`;
}
