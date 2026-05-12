"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type EntityType =
  | "npc"
  | "pc"
  | "location"
  | "faction"
  | "item"
  | "monster"
  | "deity"
  | "organization";

type Visibility = "dm_only" | "discovered" | "public";

interface QuickSwitchEntity {
  id: string;
  campaignId: string;
  type: EntityType;
  name: string;
  tags: string[];
  visibility: Visibility;
  publicDescription: string | null;
}

const TYPE_LABELS: Record<EntityType, string> = {
  npc: "NPC",
  pc: "PG",
  location: "Luogo",
  faction: "Fazione",
  item: "Oggetto",
  monster: "Mostro",
  deity: "Divinita'",
  organization: "Organizzazione",
};

const TYPE_ORDER: EntityType[] = [
  "pc",
  "npc",
  "location",
  "faction",
  "organization",
  "deity",
  "item",
  "monster",
];

const VISIBILITY_DOT: Record<Visibility, string> = {
  dm_only: "bg-zinc-400 dark:bg-zinc-500",
  discovered: "bg-amber-500",
  public: "bg-emerald-500",
};

const MAX_RESULTS = 12;

function isQuickSwitchEntity(value: unknown): value is QuickSwitchEntity {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.campaignId === "string" &&
    typeof candidate.type === "string" &&
    TYPE_ORDER.includes(candidate.type as EntityType) &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every((tag) => typeof tag === "string") &&
    typeof candidate.visibility === "string" &&
    ["dm_only", "discovered", "public"].includes(candidate.visibility) &&
    (candidate.publicDescription === null ||
      typeof candidate.publicDescription === "string")
  );
}

function parseEntities(value: unknown): QuickSwitchEntity[] {
  return Array.isArray(value) ? value.filter(isQuickSwitchEntity) : [];
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("it-IT");
}

function searchableText(entity: QuickSwitchEntity) {
  return normalize(
    [
      entity.name,
      entity.type,
      TYPE_LABELS[entity.type],
      entity.publicDescription ?? "",
      ...entity.tags,
    ].join(" "),
  );
}

export function EntityQuickSwitch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [entities, setEntities] = useState<QuickSwitchEntity[]>([]);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isQuickSwitchShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (!isQuickSwitchShortcut) return;

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
    if (!isOpen || entities.length > 0 || isLoading) return;

    const controller = new AbortController();

    async function loadEntities() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch("/api/entities?limit=200", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as unknown;
        setEntities(parseEntities(data));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadEntities();
    return () => controller.abort();
  }, [entities.length, isLoading, isOpen]);

  const results = useMemo(() => {
    const normalizedQuery = normalize(query);
    const filtered =
      normalizedQuery.length === 0
        ? entities
        : entities.filter((entity) =>
            searchableText(entity).includes(normalizedQuery),
          );

    return filtered.slice(0, MAX_RESULTS);
  }, [entities, query]);

  function close() {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(0);
  }

  function navigateTo(entity: QuickSwitchEntity) {
    close();
    router.push(
      `/campaigns/${entity.campaignId}?focus=${entity.id}#entity-detail`,
    );
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
        results.length === 0 ? 0 : Math.min(current + 1, results.length - 1),
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
      const selected = results[activeIndex];
      if (selected) navigateTo(selected);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="entity-quick-switch-title"
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/45 p-4 pt-[12vh]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
          <h2
            id="entity-quick-switch-title"
            className="text-base font-semibold text-zinc-950 dark:text-zinc-50"
          >
            Vai a entita&apos;
          </h2>
          <label className="sr-only" htmlFor="entity-quick-switch-input">
            Cerca entita&apos;
          </label>
          <input
            ref={inputRef}
            id="entity-quick-switch-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            placeholder="Nome, tipo, tag o descrizione pubblica"
            className="mt-3 h-11 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
          />
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          {isLoading ? (
            <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
              Carico entita&apos;...
            </p>
          ) : error ? (
            <p className="rounded-md bg-red-50 px-3 py-3 text-sm text-red-800 dark:bg-red-950/40 dark:text-red-200">
              Wiki non disponibile: {error}
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
              Nessuna entita&apos; trovata.
            </p>
          ) : (
            <ul className="space-y-1">
              {results.map((entity, index) => (
                <li key={entity.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => navigateTo(entity)}
                    className={`flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                      index === activeIndex
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                        : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <span
                      className={`size-2.5 shrink-0 rounded-full ${VISIBILITY_DOT[entity.visibility]}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {entity.name}
                      </span>
                      {entity.publicDescription && (
                        <span
                          className={`mt-0.5 block truncate text-xs ${
                            index === activeIndex
                              ? "text-zinc-200 dark:text-zinc-700"
                              : "text-zinc-500 dark:text-zinc-400"
                          }`}
                        >
                          {entity.publicDescription}
                        </span>
                      )}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
                        index === activeIndex
                          ? "bg-white/15 text-white dark:bg-zinc-950/10 dark:text-zinc-800"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400"
                      }`}
                    >
                      {TYPE_LABELS[entity.type]}
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
