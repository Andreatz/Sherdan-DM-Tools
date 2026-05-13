import Link from "next/link";

import { EntitySidebarSection } from "@/components/entity-sidebar-section";

interface NavItem {
  label: string;
  href?: string;
  /** Stato operativo leggibile. Se manca `href`, l'item resta disabilitato. */
  status?: "Pronto" | "Beta" | "Schema" | "Pianificato" | "Bloccato";
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// Navigazione allineata allo stato reale del progetto.
// "Schema" significa che DB/API sono predisposti ma manca ancora la UI completa.
// "Bloccato" indica feature volutamente ferme finche' non esiste una proiezione
// player-safe e un access gate adeguato.
const NAV: NavGroup[] = [
  {
    title: "Generale",
    items: [
      { label: "Home", href: "/", status: "Pronto" },
      { label: "Campagne", href: "/campaigns", status: "Pronto" },
      { label: "Stato progetto", href: "/status", status: "Pronto" },
      { label: "Generation log", href: "/generation-log", status: "Pronto" },
    ],
  },
  {
    title: "Wiki",
    items: [
      { label: "Campagne / Grafo entità", href: "/campaigns", status: "Pronto" },
    ],
  },
  {
    title: "Sessioni & Trama",
    items: [
      { label: "Sessioni", href: "/sessions", status: "Pronto" },
      { label: "Plot Threads", href: "/plot-threads", status: "Pronto" },
      { label: "Briciole di Verita'", href: "/truth-clues", status: "Pronto" },
    ],
  },
  {
    title: "Generators",
    items: [
      { label: "Random Tables", href: "/random-tables", status: "Pronto" },
      { label: "NPC", href: "/npc-generator", status: "Beta" },
      { label: "Loot", href: "/loot-generator", status: "Beta" },
      { label: "Encounter", href: "/encounter-builder", status: "Beta" },
      { label: "Dungeon", href: "/dungeon-generator", status: "Pronto" },
    ],
  },
  {
    title: "Assistenti",
    items: [
      { label: "Session Prep", href: "/session-prep", status: "Beta" },
      { label: "Rules Lookup", status: "Pianificato" },
    ],
  },
  {
    title: "Tavolo",
    items: [{ label: "Player Dashboard", href: "/player", status: "Beta" }],
  },
];

const statusClassName: Record<NonNullable<NavItem["status"]>, string> = {
  Pronto: "text-emerald-700 dark:text-emerald-400",
  Beta: "text-amber-700 dark:text-amber-400",
  Schema: "text-sky-700 dark:text-sky-400",
  Pianificato: "text-zinc-500 dark:text-zinc-400",
  Bloccato: "text-red-700 dark:text-red-400",
};

export function Sidebar() {
  return (
    <aside className="w-64 shrink-0 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex h-full flex-col">
        <div className="px-6 py-6">
          <Link
            href="/"
            className="block text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
          >
            Sherdan
          </Link>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            DM Tools
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6">
          <EntitySidebarSection />

          {NAV.map((group) => (
            <div key={group.title} className="mb-6">
              <h2 className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {group.title}
              </h2>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.label}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <span className="truncate">{item.label}</span>
                        {item.status && (
                          <span
                            className={`shrink-0 text-[10px] uppercase tracking-wider ${statusClassName[item.status]}`}
                          >
                            {item.status}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <div
                        className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm text-zinc-400 dark:text-zinc-500"
                        aria-disabled
                      >
                        <span className="truncate">{item.label}</span>
                        {item.status && (
                          <span
                            className={`shrink-0 text-[10px] uppercase tracking-wider ${statusClassName[item.status]}`}
                          >
                            {item.status}
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
