import type { ReactNode } from "react";

import { CommandPalette } from "@/components/command-palette";
import { RulesShortcut } from "@/components/rules-shortcut";
import { Sidebar } from "@/components/sidebar";

interface AppShellProps {
  children: ReactNode;
}

// Layout principale: sidebar + area main scrollabile, con collapse mobile.
export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar />
      <CommandPalette />
      <RulesShortcut />
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
