"use client";

import { useEffect, useMemo, useState } from "react";

interface CampaignRow {
  id: string;
  name: string;
}

interface GenerationLogRow {
  id: string;
  campaignId: string | null;
  generatorName: string;
  provider: string | null;
  model: string;
  status: string;
  metadata: Record<string, unknown> | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: string | null;
  createdAt: string;
  error: { name?: string; message?: string } | null;
}

interface FullLogRow extends GenerationLogRow {
  input: unknown;
  prompt: unknown;
  output: unknown;
}

const STATUS_BADGE: Record<string, string> = {
  succeeded:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

export function GenerationLogWorkbench() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [generator, setGenerator] = useState("");
  const [status, setStatus] = useState<"all" | "succeeded" | "failed">("all");
  const [rows, setRows] = useState<GenerationLogRow[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<FullLogRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const list = await apiFetch<CampaignRow[]>("/api/campaigns");
        if (cancelled) return;
        setCampaigns(list);
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: "50",
          offset: String(offset),
        });
        if (campaignId) params.set("campaign_id", campaignId);
        if (generator) params.set("generator", generator);
        if (status !== "all") params.set("status", status);
        const list = await apiFetch<GenerationLogRow[]>(
          `/api/generation-logs?${params.toString()}`,
        );
        if (cancelled) return;
        setRows(list);
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
  }, [campaignId, generator, offset, status]);

  const generatorOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) set.add(row.generatorName);
    return Array.from(set).sort();
  }, [rows]);

  const aggregate = useMemo(() => {
    let succeeded = 0;
    let failed = 0;
    let totalLatency = 0;
    let withLatency = 0;
    let totalTokens = 0;
    let totalCost = 0;
    let hasCostAlert = false;
    for (const row of rows) {
      if (row.status === "succeeded") succeeded += 1;
      else if (row.status === "failed") failed += 1;
      const latency =
        row.metadata && typeof row.metadata.latencyMs === "number"
          ? (row.metadata.latencyMs as number)
          : null;
      if (latency !== null) {
        totalLatency += latency;
        withLatency += 1;
      }
      totalTokens += row.totalTokens ?? 0;
      totalCost += row.costUsd ? Number(row.costUsd) : 0;
      hasCostAlert =
        hasCostAlert ||
        Boolean(row.metadata && row.metadata.costAlert === true);
    }
    return {
      total: rows.length,
      succeeded,
      failed,
      avgLatencyMs: withLatency === 0 ? null : Math.round(totalLatency / withLatency),
      totalTokens,
      totalCost,
      hasCostAlert,
    };
  }, [rows]);

  async function expand(row: GenerationLogRow) {
    if (expandedId === row.id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(row.id);
    setExpandedDetail(null);
    try {
      const detail = await apiFetch<FullLogRow>(
        `/api/generation-logs/${row.id}`,
      );
      setExpandedDetail(detail);
    } catch (err) {
      setError(messageForError(err));
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Generation log
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Hardening Fase 3 · Tutte le chiamate LLM dei generators
            (NPC/Loot/Encounter) finiscono qui per audit, debug e cost
            monitoring.
          </p>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-4 dark:border-zinc-800 dark:bg-zinc-900">
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
            Campagna
          </span>
          <select
            value={campaignId}
            onChange={(e) => {
              setOffset(0);
              setCampaignId(e.target.value);
            }}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">Tutte</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
            Generator
          </span>
          <input
            value={generator}
            list="generator-options"
            onChange={(e) => {
              setOffset(0);
              setGenerator(e.target.value);
            }}
            placeholder="es. npc-generator"
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <datalist id="generator-options">
            {generatorOptions.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
            Status
          </span>
          <select
            value={status}
            onChange={(e) => {
              setOffset(0);
              setStatus(e.target.value as "all" | "succeeded" | "failed");
            }}
            className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="all">Tutti</option>
            <option value="succeeded">Succeeded</option>
            <option value="failed">Failed</option>
          </select>
        </label>
        <div className="grid gap-1 text-xs">
          <span className="font-semibold uppercase text-zinc-500 dark:text-zinc-400">
            Riepilogo
          </span>
          <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
            <div>Totale: {aggregate.total}</div>
            <div>
              Successi: {aggregate.succeeded} · Errori: {aggregate.failed}
            </div>
            <div>
              Latenza media:{" "}
              {aggregate.avgLatencyMs === null
                ? "—"
                : `${aggregate.avgLatencyMs} ms`}
            </div>
            <div>Token: {aggregate.totalTokens.toLocaleString()}</div>
            <div
              className={
                aggregate.hasCostAlert
                  ? "font-semibold text-amber-700 dark:text-amber-300"
                  : undefined
              }
            >
              Costo stimato: ${aggregate.totalCost.toFixed(4)}
            </div>
          </div>
        </div>
      </div>

      {aggregate.hasCostAlert && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          Almeno una chiamata supera la soglia di alert costo stimato. Apri il
          dettaglio per capire prompt, modello e output.
        </div>
      )}

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 text-sm font-semibold dark:border-zinc-800">
          <span>
            {loading
              ? "Caricamento..."
              : `${rows.length} chiamate registrate · pagina ${
                  Math.floor(offset / 50) + 1
                }`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={offset === 0 || loading}
              onClick={() => setOffset((current) => Math.max(0, current - 50))}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200"
            >
              Precedenti
            </button>
            <button
              type="button"
              disabled={rows.length < 50 || loading}
              onClick={() => setOffset((current) => current + 50)}
              className="rounded-md border border-zinc-300 px-2 py-1 text-xs text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200"
            >
              Successive
            </button>
          </div>
        </header>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-zinc-500">
            Nessuna chiamata loggata. Genera un NPC, un loot bundle o un
            encounter assist per popolare la tabella.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {rows.map((row) => {
              const expanded = expandedId === row.id;
              const latency =
                row.metadata && typeof row.metadata.latencyMs === "number"
                  ? (row.metadata.latencyMs as number)
                  : null;
              return (
                <li key={row.id} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_BADGE[row.status] ?? STATUS_BADGE.succeeded}`}
                    >
                      {row.status}
                    </span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {row.generatorName}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {row.provider ?? "?"} · {row.model}
                    </span>
                    {latency !== null && (
                      <span className="text-xs text-zinc-500">
                        {latency} ms
                      </span>
                    )}
                    {row.totalTokens !== null && (
                      <span className="text-xs text-zinc-500">
                        {row.totalTokens} tok
                      </span>
                    )}
                    {row.costUsd !== null && (
                      <span
                        className={`text-xs ${
                          row.metadata?.costAlert
                            ? "font-semibold text-amber-700 dark:text-amber-300"
                            : "text-zinc-500"
                        }`}
                      >
                        ${Number(row.costUsd).toFixed(4)}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-zinc-500">
                      {new Date(row.createdAt).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => expand(row)}
                      className="text-xs text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50"
                    >
                      {expanded ? "Chiudi" : "Dettaglio"}
                    </button>
                  </div>
                  {row.error && row.status === "failed" && (
                    <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                      {row.error.name ?? "Error"}: {row.error.message ?? "?"}
                    </p>
                  )}
                  {expanded && (
                    <div className="mt-3 grid gap-3 text-xs lg:grid-cols-3">
                      <JsonBlock title="Input" value={expandedDetail?.input} />
                      <JsonBlock
                        title="Prompt"
                        value={expandedDetail?.prompt}
                      />
                      <JsonBlock
                        title={row.status === "failed" ? "Errore" : "Output"}
                        value={
                          row.status === "failed"
                            ? expandedDetail?.error
                            : expandedDetail?.output
                        }
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950">
      <header className="border-b border-inherit px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </header>
      <pre className="max-h-64 overflow-auto px-3 py-2 text-[11px] leading-snug text-zinc-800 dark:text-zinc-100">
        {value === undefined
          ? "—"
          : typeof value === "string"
            ? value
            : JSON.stringify(value, null, 2)}
      </pre>
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
