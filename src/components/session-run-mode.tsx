"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { CopyForChatGptButton } from "@/components/copy-for-chatgpt-button";

interface CampaignRow {
  id: string;
  name: string;
}

interface SessionRow {
  id: string;
  campaignId: string;
  number: number;
  title: string | null;
  date: string | null;
  recap: string | null;
  dmNotes: string | null;
  prepNotes: string | null;
}

interface DashboardState {
  sceneTitle: string | null;
  sceneText: string | null;
  imageUrl: string | null;
  mapImageUrl: string | null;
  handouts: Array<Record<string, unknown>>;
  activeEntityIds: string[];
  initiative: Record<string, unknown> | null;
  updatedAt: string;
}

interface ActiveEntity {
  id: string;
  name: string;
  type: string;
  visibility: string;
  publicDescription: string | null;
}

interface LiveThread {
  id: string;
  title: string;
  status: string;
  priority: number | null;
  publicDescription: string | null;
  lastAdvancedAt: string | null;
}

interface TruthClue {
  id: string;
  description: string;
  truthRevealed: string;
  status: string;
  relatedPlotThreadId: string | null;
}

interface SessionEvent {
  id: string;
  threadTitle: string;
  eventType: string;
  description: string;
  publicDescription: string | null;
}

interface SessionRunPayload {
  session: SessionRow | null;
  dashboardState: DashboardState | null;
  activeEntities: ActiveEntity[];
  liveThreads: LiveThread[];
  unresolvedClues: TruthClue[];
  sessionEvents: SessionEvent[];
}

interface InitiativeTurn {
  name?: unknown;
  initiative?: unknown;
  hp?: unknown;
  note?: unknown;
}

export function SessionRunMode() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [payload, setPayload] = useState<SessionRunPayload | null>(null);
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
    async function loadSessions() {
      if (!campaignId) {
        setSessions([]);
        setSessionId("");
        return;
      }
      try {
        const rows = await apiFetch<SessionRow[]>(
          `/api/sessions?campaign_id=${encodeURIComponent(campaignId)}&include_notes=true`,
        );
        if (cancelled) return;
        setSessions(rows);
        setSessionId((current) =>
          rows.some((session) => session.id === current)
            ? current
            : (rows[rows.length - 1]?.id ?? ""),
        );
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      }
    }
    void loadSessions();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;
    async function loadRunMode() {
      if (!campaignId) {
        setPayload(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ campaign_id: campaignId });
        if (sessionId) params.set("session_id", sessionId);
        const data = await apiFetch<SessionRunPayload>(
          `/api/session-run?${params.toString()}`,
        );
        if (!cancelled) setPayload(data);
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadRunMode();
    return () => {
      cancelled = true;
    };
  }, [campaignId, sessionId]);

  const initiativeTurns = useMemo(() => {
    const turns = payload?.dashboardState?.initiative?.turns;
    return Array.isArray(turns) ? (turns as InitiativeTurn[]) : [];
  }, [payload?.dashboardState?.initiative]);

  const copyText = useMemo(
    () => (payload ? buildRunModeMarkdown(payload) : ""),
    [payload],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Session Run Mode
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Vista da tavolo: scena live, iniziativa, thread caldi e reveal aperti.
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
            emptyLabel="Nessuna campagna"
          />
          <SelectField
            label="Sessione"
            value={sessionId}
            onChange={setSessionId}
            options={sessions.map((session) => ({
              value: session.id,
              label: `#${session.number}${session.title ? ` - ${session.title}` : ""}`,
            }))}
            emptyLabel="Ultima disponibile"
          />
        </div>
      </header>

      {error && <ErrorBox message={error} />}

      <div className="flex flex-wrap gap-2">
        <CopyForChatGptButton text={copyText} />
        <LinkButton href="/player">Player Dashboard</LinkButton>
        <LinkButton href="/sessions">Sessioni</LinkButton>
        <LinkButton href="/plot-threads">Plot Threads</LinkButton>
        <LinkButton href="/truth-clues">Briciole</LinkButton>
      </div>

      {loading ? (
        <Panel title="Caricamento">Sto raccogliendo il contesto live...</Panel>
      ) : !payload ? (
        <Panel title="Vuoto">Seleziona una campagna per iniziare.</Panel>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <section className="space-y-5">
            <Panel title={payload.dashboardState?.sceneTitle || "Scena live"}>
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                {payload.dashboardState?.sceneText?.trim() ||
                  "Nessuna scena pubblicata nel Player Dashboard."}
              </p>
              {(payload.dashboardState?.imageUrl ||
                payload.dashboardState?.mapImageUrl) && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {payload.dashboardState.imageUrl && (
                    <MediaLink
                      href={payload.dashboardState.imageUrl}
                      label="Immagine scena"
                    />
                  )}
                  {payload.dashboardState.mapImageUrl && (
                    <MediaLink
                      href={payload.dashboardState.mapImageUrl}
                      label="Mappa"
                    />
                  )}
                </div>
              )}
            </Panel>

            <Panel
              title={
                payload.session
                  ? `Sessione #${payload.session.number}${payload.session.title ? ` - ${payload.session.title}` : ""}`
                  : "Sessione"
              }
            >
              <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-200">
                {payload.session?.recap?.trim() || "Nessun recap salvato."}
              </p>
            </Panel>

            <Panel title="Eventi della sessione">
              <ItemList
                empty="Nessun evento di plot associato a questa sessione."
                rows={payload.sessionEvents.map((event) => ({
                  id: event.id,
                  title: event.threadTitle,
                  badge: event.eventType,
                  body: event.description,
                  meta: event.publicDescription
                    ? `Percepito: ${event.publicDescription}`
                    : null,
                }))}
              />
            </Panel>

            <Panel title="Briciole non chiuse">
              <ItemList
                empty="Nessuna briciola in stato planted/noticed/misinterpreted."
                rows={payload.unresolvedClues.map((clue) => ({
                  id: clue.id,
                  title: clue.description,
                  badge: clue.status,
                  body: clue.truthRevealed,
                  meta: null,
                }))}
              />
            </Panel>
          </section>

          <aside className="space-y-5">
            <Panel title="Iniziativa">
              {initiativeTurns.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Nessun ordine iniziativa nel Player Dashboard.
                </p>
              ) : (
                <ol className="space-y-2">
                  {initiativeTurns.map((turn, index) => (
                    <li
                      key={`${String(turn.name ?? "turn")}-${index}`}
                      className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {String(turn.name ?? "Senza nome")}
                        </span>
                        <span className="ml-auto rounded bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                          {String(turn.initiative ?? "?")}
                        </span>
                      </div>
                      {Boolean(turn.hp || turn.note) && (
                        <p className="mt-1 text-xs text-zinc-500">
                          {turn.hp ? `HP ${String(turn.hp)}` : ""}
                          {turn.hp && turn.note ? " - " : ""}
                          {turn.note ? String(turn.note) : ""}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </Panel>

            <Panel title="Entita attive">
              <ItemList
                empty="Nessuna entita attiva sul Player Dashboard."
                rows={payload.activeEntities.map((entity) => ({
                  id: entity.id,
                  title: entity.name,
                  badge: entity.type,
                  body: entity.publicDescription || "Senza descrizione pubblica.",
                  meta: entity.visibility,
                }))}
              />
            </Panel>

            <Panel title="Thread caldi e tiepidi">
              <ItemList
                empty="Nessun thread hot/warm."
                rows={payload.liveThreads.map((thread) => ({
                  id: thread.id,
                  title: thread.title,
                  badge: thread.status,
                  body: thread.publicDescription || "Senza descrizione pubblica.",
                  meta:
                    thread.priority !== null
                      ? `Priorita ${thread.priority}`
                      : null,
                }))}
              />
            </Panel>
          </aside>
        </div>
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  emptyLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  emptyLabel: string;
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
          <option value="">{emptyLabel}</option>
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

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <header className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
        {title}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ItemList({
  rows,
  empty,
}: {
  rows: Array<{
    id: string;
    title: string;
    badge: string;
    body: string;
    meta: string | null;
  }>;
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {rows.map((row) => (
        <li key={row.id} className="py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {row.title}
            </span>
            <Badge>{row.badge}</Badge>
            {row.meta && <span className="text-xs text-zinc-500">{row.meta}</span>}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">
            {row.body}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      {children}
    </span>
  );
}

function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center rounded-md border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      {children}
    </Link>
  );
}

function MediaLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block truncate rounded-md border border-zinc-200 px-3 py-2 text-sm underline-offset-2 hover:underline dark:border-zinc-800"
    >
      {label}: {href}
    </a>
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

function buildRunModeMarkdown(payload: SessionRunPayload) {
  return [
    "# Session Run Mode",
    "",
    "## Scena live",
    payload.dashboardState?.sceneTitle
      ? `### ${payload.dashboardState.sceneTitle}`
      : "### Senza titolo",
    payload.dashboardState?.sceneText?.trim() || "_Nessuna scena pubblicata._",
    "",
    "## Sessione",
    payload.session
      ? `#${payload.session.number}${payload.session.title ? ` - ${payload.session.title}` : ""}`
      : "_Nessuna sessione selezionata._",
    payload.session?.recap?.trim() || "_Recap vuoto._",
    "",
    "## Thread hot/warm",
    listOrEmpty(
      payload.liveThreads.map(
        (thread) =>
          `- [${thread.status}] ${thread.title}${thread.priority !== null ? ` (priorita ${thread.priority})` : ""}`,
      ),
    ),
    "",
    "## Briciole non chiuse",
    listOrEmpty(
      payload.unresolvedClues.map(
        (clue) => `- [${clue.status}] ${clue.description}\n  - Verita GM: ${clue.truthRevealed}`,
      ),
    ),
    "",
    "## Entita attive",
    listOrEmpty(
      payload.activeEntities.map(
        (entity) =>
          `- ${entity.name} (${entity.type}, ${entity.visibility}): ${entity.publicDescription ?? "Senza descrizione pubblica"}`,
      ),
    ),
  ].join("\n");
}

function listOrEmpty(rows: string[]) {
  return rows.length > 0 ? rows.join("\n") : "_Nessun elemento._";
}
