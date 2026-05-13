"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { RulesQaResult } from "@/lib/rules/qa-schema";

interface HistoryEntry {
  id: string;
  query: string;
  timestamp: number;
  result: RulesQaResult | null;
  error: string | null;
}

const HISTORY_STORAGE_KEY = "sherdan-rules-history-v1";
const HISTORY_LIMIT = 20;

export function RulesLookup() {
  const [query, setQuery] = useState("");
  const [activeResult, setActiveResult] = useState<RulesQaResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expandedChunkIds, setExpandedChunkIds] = useState<Set<string>>(
    new Set(),
  );
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // History caricata da localStorage al mount. SSR-safe: l'effect non
  // gira lato server, e l'hydrate iniziale parte da `[]` per evitare
  // mismatch. setState dentro effect e' qui il pattern canonico
  // (localStorage non e' uno store sincrono server-side).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const items = parsed.filter(isHistoryEntry).slice(0, HISTORY_LIMIT);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setHistory(items);
      }
    } catch {
      window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    }
  }, []);

  // Auto-focus su input al mount (la pagina e' single-purpose).
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const persistHistory = useCallback((next: HistoryEntry[]) => {
    setHistory(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage pieno o disabilitato: niente da fare, history e' best-effort.
    }
  }, []);

  const submit = useCallback(async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2 || loading) return;
    setLoading(true);
    setError(null);
    setExpandedChunkIds(new Set());
    try {
      const response = await fetch("/api/rules/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const body = (await response.json()) as
        | RulesQaResult
        | { error: { message: string } };
      if (!response.ok) {
        const message =
          "error" in body ? body.error.message : "Errore Q&A";
        throw new Error(message);
      }
      if ("answer" in body) {
        setActiveResult(body);
        const entry: HistoryEntry = {
          id: createId(),
          query: trimmed,
          timestamp: Date.now(),
          result: body,
          error: null,
        };
        persistHistory([entry, ...history].slice(0, HISTORY_LIMIT));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Errore Q&A";
      setError(message);
      const entry: HistoryEntry = {
        id: createId(),
        query: trimmed,
        timestamp: Date.now(),
        result: null,
        error: message,
      };
      persistHistory([entry, ...history].slice(0, HISTORY_LIMIT));
    } finally {
      setLoading(false);
    }
  }, [query, loading, history, persistHistory]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void submit();
      }
    },
    [submit],
  );

  const loadFromHistory = useCallback((entry: HistoryEntry) => {
    setQuery(entry.query);
    setActiveResult(entry.result);
    setError(entry.error);
    setExpandedChunkIds(new Set());
    inputRef.current?.focus();
  }, []);

  const clearHistory = useCallback(() => {
    persistHistory([]);
  }, [persistHistory]);

  const toggleChunkExpansion = useCallback((chunkId: string) => {
    setExpandedChunkIds((prev) => {
      const next = new Set(prev);
      if (next.has(chunkId)) next.delete(chunkId);
      else next.add(chunkId);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Rules Lookup
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Q&A sul corpus regole homebrew di Sherdan. Hybrid search (vector +
          trigram, RRF) + risposta LLM con citazioni cliccabili. Premi
          <kbd className="mx-1 rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-800">
            Cmd
          </kbd>
          +
          <kbd className="mx-1 rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:border-zinc-700 dark:bg-zinc-800">
            Enter
          </kbd>
          per inviare.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_240px]">
        <section className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
              Domanda
            </label>
            <textarea
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder="Come funziona il crafting di Obsidium raffinato?"
              className="mt-2 w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                {query.trim().length < 2
                  ? "Min 2 caratteri."
                  : `${query.trim().length} caratteri`}
              </p>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={query.trim().length < 2 || loading}
                className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {loading ? "Cerco..." : "Chiedi"}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          {activeResult && (
            <ResultPanel
              result={activeResult}
              expandedChunkIds={expandedChunkIds}
              onToggleChunk={toggleChunkExpansion}
            />
          )}
        </section>

        <HistoryPanel
          history={history}
          onLoad={loadFromHistory}
          onClear={clearHistory}
        />
      </div>
    </div>
  );
}

interface ResultPanelProps {
  result: RulesQaResult;
  expandedChunkIds: Set<string>;
  onToggleChunk: (chunkId: string) => void;
}

function ResultPanel({ result, expandedChunkIds, onToggleChunk }: ResultPanelProps) {
  const annotated = useMemo(
    () => renderAnswerWithCitations(result.answer, result.citations),
    [result.answer, result.citations],
  );
  const citationsById = useMemo(
    () => new Map(result.citations.map((cit) => [cit.chunkId, cit])),
    [result.citations],
  );

  return (
    <article className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Risposta</h2>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
          {result.metadata.rankersUsed.join(" + ")}
          {" · "}
          embed {result.metadata.embeddingStatus}
          {" · "}
          {result.context.length} chunk in contesto
        </p>
      </header>

      {result.noAnswer && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Il corpus indicizzato non contiene la risposta a questa domanda.
        </p>
      )}

      <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
        {annotated}
      </div>

      {result.citations.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Citazioni
          </h3>
          <ul className="mt-2 space-y-2">
            {result.citations.map((cit) => {
              const chunk = result.context.find(
                (c) => c.chunkId === cit.chunkId,
              );
              const expanded = expandedChunkIds.has(cit.chunkId);
              return (
                <li
                  key={cit.chunkId}
                  data-citation-id={cit.chunkId}
                  className="rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      [{cit.index}] {cit.title ?? cit.source}
                      {cit.section && (
                        <span className="ml-2 font-normal text-zinc-500 dark:text-zinc-400">
                          {cit.section}
                        </span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleChunk(cit.chunkId)}
                      className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    >
                      {expanded ? "Comprimi" : "Mostra chunk"}
                    </button>
                  </div>
                  <p className="mt-1 text-zinc-700 dark:text-zinc-200">
                    &ldquo;{cit.snippet}&rdquo;
                  </p>
                  {expanded && chunk && (
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded border border-zinc-200 bg-white p-2 text-[11px] text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                      {chunk.content}
                    </pre>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {result.context.length > result.citations.length && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Altri chunk nel contesto (non citati direttamente)
          </h3>
          <ul className="mt-2 space-y-1">
            {result.context
              .filter((chunk) => !citationsById.has(chunk.chunkId))
              .map((chunk) => (
                <li
                  key={chunk.chunkId}
                  className="text-[11px] text-zinc-500 dark:text-zinc-400"
                >
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {chunk.title ?? chunk.source}
                  </span>
                  {chunk.section && (
                    <span className="ml-1">&middot; {chunk.section}</span>
                  )}
                  <span className="ml-2 text-zinc-400">
                    rrf {chunk.rrfScore.toFixed(4)}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </article>
  );
}

interface HistoryPanelProps {
  history: HistoryEntry[];
  onLoad: (entry: HistoryEntry) => void;
  onClear: () => void;
}

function HistoryPanel({ history, onLoad, onClear }: HistoryPanelProps) {
  return (
    <aside className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          History
        </h2>
        {history.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-red-700 dark:text-zinc-400 dark:hover:text-red-300"
          >
            Pulisci
          </button>
        )}
      </header>
      {history.length === 0 ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Le domande recenti compariranno qui (solo nel tuo browser).
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {history.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onLoad(entry)}
                className="w-full rounded border border-zinc-200 px-2 py-1.5 text-left text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <p className="line-clamp-2 text-zinc-800 dark:text-zinc-100">
                  {entry.query}
                </p>
                <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                  {formatRelative(entry.timestamp)}
                  {entry.error
                    ? " · errore"
                    : entry.result?.noAnswer
                      ? " · niente nel corpus"
                      : entry.result
                        ? ` · ${entry.result.citations.length} citazioni`
                        : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function renderAnswerWithCitations(
  answer: string,
  citations: { index: number; chunkId: string }[],
): React.ReactNode[] {
  if (citations.length === 0) return [answer];
  // Sostituisce ogni occorrenza di `[N]` con uno span cliccabile che
  // scrolla all'item della citazione corrispondente.
  const indexByDisplay = new Map<number, string>();
  for (const cit of citations) indexByDisplay.set(cit.index, cit.chunkId);
  const re = /\[(\d+)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(answer)) !== null) {
    if (match.index > lastIndex) {
      parts.push(answer.slice(lastIndex, match.index));
    }
    const display = Number(match[1]);
    const chunkId = indexByDisplay.get(display);
    parts.push(
      <button
        key={`cit-${match.index}`}
        type="button"
        onClick={() => {
          if (!chunkId || typeof document === "undefined") return;
          const el = document.querySelector<HTMLElement>(
            `[data-citation-id="${chunkId}"]`,
          );
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        className="mx-0.5 rounded bg-zinc-200 px-1 text-[10px] font-semibold text-zinc-800 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
      >
        [{display}]
      </button>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < answer.length) parts.push(answer.slice(lastIndex));
  return parts;
}

function formatRelative(ts: number): string {
  const seconds = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (seconds < 60) return "ora";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h fa`;
  const days = Math.floor(hours / 24);
  return `${days} g fa`;
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.query === "string" &&
    typeof v.timestamp === "number" &&
    (v.result === null || typeof v.result === "object") &&
    (v.error === null || typeof v.error === "string")
  );
}
