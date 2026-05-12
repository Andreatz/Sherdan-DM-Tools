"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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

interface SidebarEntity {
  id: string;
  campaignId: string;
  type: EntityType;
  name: string;
  tags: string[];
  visibility: Visibility;
  updatedAt: string;
}

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

const TYPE_LABELS: Record<EntityType, string> = {
  pc: "PG",
  npc: "NPC",
  location: "Luoghi",
  faction: "Fazioni",
  organization: "Organizzazioni",
  deity: "Divinita'",
  item: "Oggetti",
  monster: "Mostri",
};

const VISIBILITY_DOT: Record<Visibility, string> = {
  dm_only: "bg-zinc-400 dark:bg-zinc-500",
  discovered: "bg-amber-500",
  public: "bg-emerald-500",
};

function isSidebarEntity(value: unknown): value is SidebarEntity {
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
    typeof candidate.updatedAt === "string"
  );
}

function parseSidebarEntities(value: unknown): SidebarEntity[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isSidebarEntity);
}

export function EntitySidebarSection() {
  const [entities, setEntities] = useState<SidebarEntity[]>([]);
  const [recentEntities, setRecentEntities] = useState<SidebarEntity[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadEntities() {
      try {
        setIsLoading(true);
        setError(null);
        const [entitiesResponse, recentResponse] = await Promise.all([
          fetch("/api/entities?limit=200", { signal: controller.signal }),
          fetch("/api/entities?limit=5&sort=updated_desc", {
            signal: controller.signal,
          }),
        ]);

        if (!entitiesResponse.ok) {
          throw new Error(`HTTP ${entitiesResponse.status}`);
        }
        if (!recentResponse.ok) {
          throw new Error(`HTTP ${recentResponse.status}`);
        }
        const entitiesData = (await entitiesResponse.json()) as unknown;
        const recentData = (await recentResponse.json()) as unknown;
        setEntities(parseSidebarEntities(entitiesData));
        setRecentEntities(parseSidebarEntities(recentData));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadEntities();
    return () => controller.abort();
  }, []);

  const groupedEntities = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("it-IT");
    const filtered =
      normalizedQuery.length === 0
        ? entities
        : entities.filter((entity) => {
            const haystack = [entity.name, entity.type, ...entity.tags]
              .join(" ")
              .toLocaleLowerCase("it-IT");
            return haystack.includes(normalizedQuery);
          });

    return TYPE_ORDER.map((type) => ({
      type,
      entities: filtered.filter((entity) => entity.type === type),
    })).filter((group) => group.entities.length > 0);
  }, [entities, query]);

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between px-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Entita&apos;
        </h2>
        <span className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
          {entities.length}
        </span>
      </div>

      <label className="sr-only" htmlFor="entity-sidebar-search">
        Cerca entita&apos;
      </label>
      <input
        id="entity-sidebar-search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Cerca nel wiki"
        className="mb-3 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:bg-zinc-900"
      />

      {isLoading ? (
        <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
          Carico il wiki...
        </p>
      ) : error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-800 dark:bg-red-950/40 dark:text-red-200">
          Wiki non disponibile: {error}
        </p>
      ) : groupedEntities.length === 0 ? (
        <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
          {query.trim() ? "Nessun risultato." : "Nessuna entita' ancora."}
        </p>
      ) : (
        <div className="space-y-4">
          {query.trim().length === 0 && recentEntities.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between px-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Modificate di recente
                </h3>
                <span className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-600">
                  {recentEntities.length}
                </span>
              </div>
              <ul className="space-y-0.5">
                {recentEntities.map((entity) => (
                  <li key={entity.id}>
                    <Link
                      href={`/campaigns/${entity.campaignId}?focus=${entity.id}#entity-detail`}
                      className="flex min-w-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${VISIBILITY_DOT[entity.visibility]}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate">{entity.name}</span>
                      <span className="shrink-0 text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
                        {new Date(entity.updatedAt).toLocaleDateString("it-IT", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {groupedEntities.map((group) => {
            // Apriamo automaticamente il gruppo se l'utente sta cercando
            // (per non nascondere i risultati della ricerca). Altrimenti
            // ogni tipo e' chiuso di default: con ~150 entita' tenere
            // tutto aperto rende la sidebar non navigabile.
            const open = query.trim().length > 0;
            return (
              <details key={group.type} open={open} className="group">
                <summary className="mb-1 flex cursor-pointer items-center justify-between rounded-md px-3 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <span
                      aria-hidden="true"
                      className="transition-transform group-open:rotate-90"
                    >
                      ▸
                    </span>
                    {TYPE_LABELS[group.type]}
                  </h3>
                  <span className="text-[10px] tabular-nums text-zinc-400 dark:text-zinc-600">
                    {group.entities.length}
                  </span>
                </summary>
                <ul className="space-y-0.5 pl-2">
                  {group.entities.map((entity) => (
                    <li key={entity.id}>
                      <Link
                        href={`/campaigns/${entity.campaignId}?focus=${entity.id}#entity-detail`}
                        className="flex min-w-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${VISIBILITY_DOT[entity.visibility]}`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 truncate">{entity.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
