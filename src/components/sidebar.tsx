import Link from "next/link";

import { EntitySidebarSection } from "@/components/entity-sidebar-section";

interface NavItem {
  label: string;
  href?: string;
  /** Etichetta "in arrivo Fase X". Se presente, l'item e' disabilitato. */
  comingIn?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// Navigazione completa del progetto. Gli item con `comingIn` sono placeholder
// per i tool che arriveranno nelle fasi successive (vedi ROADMAP.md). Cliccare
// li tiene fermi: e' utile per ricordarsi cosa manca senza perdere il filo.
const NAV: NavGroup[] = [
  {
    title: "Generale",
    items: [
      { label: "Home", href: "/" },
      { label: "Campagne", href: "/campaigns" },
    ],
  },
  {
    title: "Wiki",
    items: [
      { label: "Campagne / Grafo entità", href: "/campaigns" },
    ],
  },
  {
    title: "Sessioni & Trama",
    items: [
      { label: "Sessioni", comingIn: "Fase 6" },
      { label: "Plot Threads", comingIn: "Fase 6" },
      { label: "Briciole di Verita'", comingIn: "Fase 6" },
    ],
  },
  {
    title: "Generators",
    items: [
      { label: "Random Tables", href: "/random-tables" },
      { label: "NPC", href: "/npc-generator" },
      { label: "Loot", href: "/loot-generator" },
      { label: "Encounter", comingIn: "Fase 5" },
      { label: "Dungeon", comingIn: "Fase 8" },
    ],
  },
  {
    title: "Assistenti",
    items: [
      { label: "Session Prep", comingIn: "Fase 7" },
      { label: "Rules Lookup", comingIn: "Fase 9" },
    ],
  },
  {
    title: "Tavolo",
    items: [{ label: "Player Dashboard", comingIn: "Fase 10" }],
  },
];

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
                        className="block rounded-md px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <div
                        className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-zinc-400 dark:text-zinc-500"
                        aria-disabled
                      >
                        <span>{item.label}</span>
                        {item.comingIn && (
                          <span className="text-[10px] uppercase tracking-wider">
                            {item.comingIn}
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
