import Link from "next/link";

import { EntitySidebarSection } from "@/components/entity-sidebar-section";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavItem {
  label: string;
  href?: string;
  /** Stato operativo leggibile. Se manca `href`, l'item resta disabilitato. */
  status?: "Pronto" | "Beta" | "Schema" | "Pianificato" | "Opzionale";
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// Navigazione allineata allo stato reale del progetto.
// "Schema" significa che DB/API sono predisposti ma manca ancora la UI completa.
// "Opzionale" indica superfici disponibili solo con provider/servizi extra.
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
      { label: "Campagne / Grafo entita'", href: "/campaigns", status: "Pronto" },
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
      { label: "NPC", href: "/npc-generator", status: "Opzionale" },
      { label: "Loot", href: "/loot-generator", status: "Opzionale" },
      { label: "Encounter", href: "/encounter-builder", status: "Pronto" },
      { label: "Dungeon", href: "/dungeon-generator", status: "Pronto" },
    ],
  },
  {
    title: "Assistenti",
    items: [
      { label: "Session Prep", href: "/session-prep", status: "Opzionale" },
      { label: "ChatGPT Bridge", href: "/chatgpt-bridge", status: "Pronto" },
      { label: "Bridge storico", href: "/chatgpt-bridge/history", status: "Pronto" },
      { label: "Contradiction Detector", href: "/contradictions", status: "Pronto" },
      { label: "Rules Lookup", href: "/rules", status: "Pronto" },
    ],
  },
  {
    title: "Tavolo",
    items: [
      { label: "Session Run Mode", href: "/session-run", status: "Pronto" },
      { label: "Player Dashboard", href: "/player", status: "Pronto" },
      { label: "Combat Tracker", href: "/combat-tracker", status: "Pronto" },
      { label: "Matrice conoscenza PNG", href: "/knowledge-matrix", status: "Pronto" },
      { label: "Spoiler Gate", href: "/reveal-tracker", status: "Pronto" },
    ],
  },
];

const statusClassName: Record<NonNullable<NavItem["status"]>, string> = {
  Pronto: "text-emerald-700 dark:text-emerald-300",
  Beta: "text-amber-700 dark:text-amber-300",
  Schema: "text-sky-700 dark:text-sky-300",
  Opzionale: "text-indigo-700 dark:text-indigo-300",
  Pianificato: "text-zinc-500 dark:text-zinc-400",
};

export function Sidebar() {
  return (
    <aside className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] backdrop-blur lg:sticky lg:top-0 lg:min-h-screen lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r dark:bg-[color-mix(in_srgb,var(--surface)_88%,transparent)]">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-4 lg:block lg:px-5 lg:py-5">
          <div className="min-w-0">
            <Link
              href="/"
              className="block truncate text-xl font-semibold text-zinc-950 dark:text-zinc-50"
            >
              Sherdan
            </Link>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              DM Tools Workspace
            </p>
          </div>
          <div className="lg:mt-4">
            <ThemeToggle />
          </div>
        </div>

        <nav className="flex max-h-[48vh] gap-4 overflow-x-auto overflow-y-auto px-3 py-4 lg:block lg:max-h-[calc(100vh-9rem)] lg:flex-1 lg:overflow-x-hidden lg:px-4 lg:py-5">
          <EntitySidebarSection />

          {NAV.map((group) => (
            <div key={group.title} className="mb-4 min-w-52 lg:mb-5 lg:min-w-0">
              <h2 className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                {group.title}
              </h2>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.label}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="group flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-[var(--surface-muted)] hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white"
                      >
                        <span className="truncate">{item.label}</span>
                        {item.status && (
                          <span
                            className={`status-pill shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${statusClassName[item.status]}`}
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
                            className={`status-pill shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${statusClassName[item.status]}`}
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
