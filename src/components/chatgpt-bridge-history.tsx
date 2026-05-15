"use client";

import { useEffect, useMemo, useState } from "react";

interface CampaignRow {
  id: string;
  name: string;
}

interface HistoryRow {
  kind: "export" | "import";
  id: string;
  campaignId: string;
  campaignName: string;
  taskType: string;
  density?: string;
  filename?: string;
  sessionNumber?: number | null;
  metadata: unknown;
  updatePackPresent?: boolean;
  appliedChangesCount?: number;
  appliedChangesPreview?: Array<{ kind: string; label: string; id?: string }>;
  preview: string;
  characterCount: number;
  createdAt: string;
}

interface HistoryResponse {
  ok: true;
  rows: HistoryRow[];
}

export function ChatGptBridgeHistory() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [kind, setKind] = useState<"all" | "export" | "import">("all");
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCampaigns() {
      try {
        const data = await apiFetch<CampaignRow[]>("/api/campaigns");
        if (!cancelled) setCampaigns(data);
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
    async function loadHistory() {
      setBusy(true);
      setError(null);
      try {
        const params = new URLSearchParams({ kind, limit: "50" });
        if (campaignId) params.set("campaign_id", campaignId);
        const data = await apiFetch<HistoryResponse>(
          `/api/chatgpt-bridge/history?${params.toString()}`,
        );
        if (!cancelled) setRows(data.rows);
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void loadHistory();
    return () => {
      cancelled = true;
    };
  }, [campaignId, kind]);

  const summary = useMemo(() => {
    const exportsCount = rows.filter((row) => row.kind === "export").length;
    const importsCount = rows.filter((row) => row.kind === "import").length;
    const appliedCount = rows.reduce(
      (sum, row) => sum + (row.appliedChangesCount ?? 0),
      0,
    );
    return { exportsCount, importsCount, appliedCount };
  }, [rows]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            ChatGPT Web Bridge
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Storico export/import
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Timeline locale dei pacchetti generati, output importati, Update Pack e
            modifiche applicate al canon.
          </p>
        </div>
        <a href="/chatgpt-bridge" className={secondaryButtonClass}>
          Torna al Bridge
        </a>
      </header>

      {error ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Export" value={summary.exportsCount} />
        <SummaryCard label="Import" value={summary.importsCount} />
        <SummaryCard label="Apply" value={summary.appliedCount} />
      </section>

      <AppliedChangesDashboard rows={rows} />

      <section className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <Field label="Campagna">
          <select
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
            className={controlClass}
          >
            <option value="">Tutte</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo">
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
            className={controlClass}
          >
            <option value="all">Tutto</option>
            <option value="export">Export</option>
            <option value="import">Import</option>
          </select>
        </Field>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {busy ? "Caricamento..." : `${rows.length} record mostrati`}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {rows.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500 dark:text-zinc-400">
            Nessun record Bridge trovato.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((row) => (
              <HistoryItem key={`${row.kind}-${row.id}`} row={row} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function HistoryItem({ row }: { row: HistoryRow }) {
  const metadata = asRecord(row.metadata);
  const warnings = Array.isArray(metadata.warnings) ? metadata.warnings.length : 0;
  return (
    <li className="grid gap-3 p-4 lg:grid-cols-[180px_minmax(0,1fr)]">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Badge tone={row.kind === "export" ? "sky" : "emerald"}>
            {row.kind}
          </Badge>
          {row.density ? <Badge tone="zinc">{row.density}</Badge> : null}
          {row.updatePackPresent ? <Badge tone="violet">update pack</Badge> : null}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {formatDate(row.createdAt)}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {row.characterCount.toLocaleString("it-IT")} caratteri
        </div>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
            {row.kind === "export" ? row.filename : importTitle(row)}
          </h2>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {row.campaignName} · {row.taskType}
          </span>
        </div>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          {row.preview || "Nessuna anteprima disponibile."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {typeof metadata.audience === "string" ? (
            <Badge tone="zinc">audience {metadata.audience}</Badge>
          ) : null}
          {warnings > 0 ? <Badge tone="amber">{warnings} warning</Badge> : null}
          {row.appliedChangesCount ? (
            <Badge tone="emerald">{row.appliedChangesCount} apply</Badge>
          ) : null}
        </div>
        {row.appliedChangesPreview && row.appliedChangesPreview.length > 0 ? (
          <ul className="mt-3 space-y-1 rounded-md border border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-zinc-800 dark:bg-zinc-950">
            {row.appliedChangesPreview.map((change, index) => (
              <li key={`${change.kind}-${change.id ?? index}`}>
                <span className="font-semibold">{kindLabel(change.kind)}</span>:{" "}
                {change.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

function AppliedChangesDashboard({ rows }: { rows: HistoryRow[] }) {
  const changes = rows
    .flatMap((row) =>
      (row.appliedChangesPreview ?? []).map((change) => ({
        ...change,
        createdAt: row.createdAt,
        campaignName: row.campaignName,
      })),
    )
    .slice(0, 8);
  if (changes.length === 0) return null;
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold">Ultime modifiche applicate</h2>
      <ul className="mt-3 grid gap-2 lg:grid-cols-2">
        {changes.map((change, index) => (
          <li
            key={`${change.kind}-${change.id ?? index}`}
            className="rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="emerald">{kindLabel(change.kind)}</Badge>
              <span className="text-zinc-500 dark:text-zinc-400">
                {change.campaignName} · {formatDate(change.createdAt)}
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-100">
              {change.label}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid min-w-52 gap-1">
      <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "amber" | "emerald" | "sky" | "violet" | "zinc";
  children: React.ReactNode;
}) {
  const className = {
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300",
    emerald:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300",
    sky: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-300",
    violet:
      "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-950 dark:text-violet-300",
    zinc: "bg-zinc-100 text-zinc-700 ring-zinc-600/20 dark:bg-zinc-800 dark:text-zinc-300",
  }[tone];
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

function importTitle(row: HistoryRow) {
  return row.sessionNumber
    ? `Import sessione ${row.sessionNumber}`
    : `Import ${row.id.slice(0, 8)}`;
}

function kindLabel(kind: string) {
  return kind
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

function messageForError(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const controlClass =
  "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const secondaryButtonClass =
  "inline-flex h-10 items-center rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";
