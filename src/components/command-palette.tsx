"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type ResultKind =
  | "entity"
  | "session"
  | "plot_thread"
  | "truth_clue"
  | "rule"
  | "action";

interface PaletteItem {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle: string | null;
  href: string;
}

interface SearchPayload {
  query: string;
  actions: PaletteItem[];
  results: PaletteItem[];
}

const KIND_LABEL: Record<ResultKind, string> = {
  action: "Azione",
  entity: "Entita'",
  session: "Sessione",
  plot_thread: "Thread",
  truth_clue: "Briciola",
  rule: "Regola",
};

const KIND_DOT: Record<ResultKind, string> = {
  action: "bg-zinc-500",
  entity: "bg-sky-500",
  session: "bg-emerald-500",
  plot_thread: "bg-amber-500",
  truth_clue: "bg-fuchsia-500",
  rule: "bg-indigo-500",
};

function isPaletteItem(value: unknown): value is PaletteItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.kind === "string" &&
    item.kind in KIND_LABEL &&
    typeof item.title === "string" &&
    (item.subtitle === null || typeof item.subtitle === "string") &&
    typeof item.href === "string"
  );
}

function parsePayload(value: unknown): SearchPayload {
  if (typeof value !== "object" || value === null) {
    return { query: "", actions: [], results: [] };
  }
  const payload = value as Record<string, unknown>;
  return {
    query: typeof payload.query === "string" ? payload.query : "",
    actions: Array.isArray(payload.actions)
      ? payload.actions.filter(isPaletteItem)
      : [],
    results: Array.isArray(payload.results)
      ? payload.results.filter(isPaletteItem)
      : [],
  };
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("it-IT");
}

export function CommandPalette() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [payload, setPayload] = useState<SearchPayload>({
    query: "",
    actions: [],
    results: [],
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isShortcut) return;

      event.preventDefault();
      if (isOpen) {
        close();
      } else {
        setQuery("");
        setActiveIndex(0);
        setIsOpen(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        setError(null);
        const params = new URLSearchParams({
          q: query,
          limit: "6",
        });
        const response = await fetch(`/api/search/global?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = parsePayload((await response.json()) as unknown);
        setPayload(data);
        setActiveIndex(0);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 120);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [isOpen, query]);

  const visibleActions = useMemo(() => {
    const normalized = normalize(query);
    if (!normalized) return payload.actions;
    return payload.actions.filter((action) =>
      normalize(`${action.title} ${action.subtitle ?? ""}`).includes(
        normalized,
      ),
    );
  }, [payload.actions, query]);

  const items = useMemo(
    () => [...visibleActions, ...payload.results].slice(0, 18),
    [payload.results, visibleActions],
  );

  function close() {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function navigateTo(item: PaletteItem) {
    close();
    router.push(item.href);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        items.length === 0 ? 0 : Math.min(current + 1, items.length - 1),
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = items[activeIndex];
      if (selected) navigateTo(selected);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-title"
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/45 p-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <h2
              id="command-palette-title"
              className="text-base font-semibold text-zinc-950 dark:text-zinc-50"
            >
              Cerca o esegui
            </h2>
            <span className="rounded border border-zinc-200 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Cmd K
            </span>
          </div>
          <label className="sr-only" htmlFor="command-palette-input">
            Cerca in Sherdan
          </label>
          <input
            ref={inputRef}
            id="command-palette-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Entita', sessioni, plot, briciole, regole o azioni"
            className="mt-3 h-11 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
          />
        </div>

        <div className="max-h-[460px] overflow-y-auto p-2">
          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
              Search non disponibile: {error}
            </p>
          ) : items.length === 0 ? (
            <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
              {isLoading ? "Cerco..." : "Nessun risultato."}
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((item, index) => (
                <li key={`${item.kind}:${item.id}`}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => navigateTo(item)}
                    className={`flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                      index === activeIndex
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                        : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <span
                      className={`size-2.5 shrink-0 rounded-full ${KIND_DOT[item.kind]}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {item.title}
                      </span>
                      {item.subtitle && (
                        <span
                          className={`mt-0.5 block truncate text-xs ${
                            index === activeIndex
                              ? "text-zinc-200 dark:text-zinc-700"
                              : "text-zinc-500 dark:text-zinc-400"
                          }`}
                        >
                          {item.subtitle}
                        </span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase ${
                        index === activeIndex
                          ? "bg-white/15 text-white dark:bg-zinc-950/10 dark:text-zinc-800"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
                      }`}
                    >
                      {KIND_LABEL[item.kind]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
