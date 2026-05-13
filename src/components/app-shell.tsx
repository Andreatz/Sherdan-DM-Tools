import type { ReactNode } from "react";

import { EntityQuickSwitch } from "@/components/entity-quick-switch";
import { RulesShortcut } from "@/components/rules-shortcut";
import { Sidebar } from "@/components/sidebar";

interface AppShellProps {
  children: ReactNode;
}

// Layout principale: sidebar fissa + area main scrollabile.
// Single-user, niente top-bar di auth/profilo. Niente responsive collapse
// per ora: il target e' desktop al tavolo. Si adatta in Fase 10 (Player
// Dashboard) quando arriva il mobile-first.
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <EntityQuickSwitch />
      <RulesShortcut />
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-6xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
