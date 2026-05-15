"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface CampaignRow {
  id: string;
  name: string;
}

type Severity = "high" | "medium" | "low";

interface ContradictionIssue {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  detail: string;
  targets: Array<{
    type: string;
    id: string;
    label: string;
  }>;
  suggestedAction: string;
}

interface ContradictionReport {
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
  issues: ContradictionIssue[];
}

export function ContradictionDetectorWorkbench() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [report, setReport] = useState<ContradictionReport | null>(null);
  const [severity, setSeverity] = useState<"all" | Severity>("all");
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
    async function loadReport() {
      if (!campaignId) {
        setReport(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<ContradictionReport>(
          `/api/contradictions?campaign_id=${encodeURIComponent(campaignId)}`,
        );
        if (!cancelled) setReport(data);
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const filteredIssues = useMemo(() => {
    const issues = report?.issues ?? [];
    return severity === "all"
      ? issues
      : issues.filter((issue) => issue.severity === severity);
  }, [report?.issues, severity]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Contradiction Detector
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Audit deterministico del canon: nomi, alias, relazioni, visibilita e stato trama.
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

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="Totale" value={String(report?.summary.total ?? 0)} tone="neutral" />
        <Stat label="Alta" value={String(report?.summary.high ?? 0)} tone="bad" />
        <Stat label="Media" value={String(report?.summary.medium ?? 0)} tone="warn" />
        <Stat label="Bassa" value={String(report?.summary.low ?? 0)} tone="good" />
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h2 className="text-sm font-semibold">Issue rilevate</h2>
          <div className="flex flex-wrap gap-2">
            {(["all", "high", "medium", "low"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setSeverity(value)}
                className={`h-8 rounded-md px-3 text-xs font-medium ring-1 ring-inset ${
                  severity === value
                    ? "bg-zinc-900 text-white ring-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 dark:ring-zinc-100"
                    : "bg-white text-zinc-700 ring-zinc-300 hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-200 dark:ring-zinc-700 dark:hover:bg-zinc-800"
                }`}
              >
                {severityLabel(value)}
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <p className="p-4 text-sm text-zinc-500">Scansione in corso...</p>
        ) : filteredIssues.length === 0 ? (
          <p className="p-4 text-sm text-zinc-500">
            Nessuna contraddizione per il filtro selezionato.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredIssues.map((issue) => (
              <li key={issue.id} className="grid gap-3 p-4 lg:grid-cols-[160px_minmax(0,1fr)]">
                <div className="space-y-2">
                  <SeverityBadge severity={issue.severity} />
                  <div className="text-xs uppercase tracking-wide text-zinc-500">
                    {categoryLabel(issue.category)}
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-zinc-950 dark:text-zinc-50">
                    {issue.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    {issue.detail}
                  </p>
                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
                    {issue.suggestedAction}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {issue.targets.map((target) => (
                      <TargetLink key={`${issue.id}-${target.type}-${target.id}`} target={target} />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "neutral" | "good" | "warn" | "bad";
}) {
  const toneClassName = {
    neutral: "text-zinc-950 dark:text-zinc-50",
    good: "text-emerald-700 dark:text-emerald-300",
    warn: "text-amber-700 dark:text-amber-300",
    bad: "text-red-700 dark:text-red-300",
  }[tone];
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClassName}`}>{value}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const className = {
    high: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950 dark:text-red-300",
    medium:
      "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300",
    low: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300",
  }[severity];
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold uppercase ring-1 ring-inset ${className}`}>
      {severityLabel(severity)}
    </span>
  );
}

function TargetLink({
  target,
}: {
  target: ContradictionIssue["targets"][number];
}) {
  const href = targetHref(target);
  const content = (
    <span className="rounded-md border border-zinc-200 px-2 py-1 text-xs text-zinc-700 dark:border-zinc-800 dark:text-zinc-200">
      {target.label}
    </span>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function targetHref(target: ContradictionIssue["targets"][number]) {
  if (target.type === "entity" || target.type === "identity") {
    return `/campaigns?entity=${encodeURIComponent(target.id)}`;
  }
  if (target.type === "plot_thread") return "/plot-threads";
  if (target.type === "truth_clue") return "/truth-clues";
  return null;
}

function severityLabel(value: "all" | Severity) {
  switch (value) {
    case "all":
      return "Tutte";
    case "high":
      return "Alta";
    case "medium":
      return "Media";
    case "low":
      return "Bassa";
  }
}

function categoryLabel(category: string) {
  return category.replaceAll("_", " ");
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
