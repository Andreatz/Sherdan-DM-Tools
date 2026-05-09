import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const SHERDAN_TEST_SOURCE_FILES = {
  npc: "NPC.md",
  factions: "Fazioni.md",
  lore: "Lore.md",
  campaign: "Campagna.md",
  backgrounds: "Background Personaggi.md",
  playerManual: "Manuale del Giocatore.md",
} as const;

export type SherdanTestSourceKey = keyof typeof SHERDAN_TEST_SOURCE_FILES;
export type SherdanTestSources = Record<SherdanTestSourceKey, string>;

const sourceDirs = [
  path.join(process.cwd(), "content", "sherdan"),
  // Legacy local fallback only. CI safety gates forbid committing/deploying
  // raw Sherdan markdown under public/.
  path.join(process.cwd(), "public"),
];

export function readSherdanSourceFile(filename: string): string | null {
  for (const dir of sourceDirs) {
    const fullPath = path.join(dir, filename);
    if (existsSync(fullPath)) return readFileSync(fullPath, "utf8");
  }
  return null;
}

export function readSherdanSource(key: SherdanTestSourceKey): string | null {
  return readSherdanSourceFile(SHERDAN_TEST_SOURCE_FILES[key]);
}

export function readSherdanSources(): SherdanTestSources | null {
  const entries = Object.entries(SHERDAN_TEST_SOURCE_FILES).map(
    ([key, filename]) => [key, readSherdanSourceFile(filename)] as const,
  );

  if (entries.some(([, content]) => content === null)) return null;

  return Object.fromEntries(entries) as SherdanTestSources;
}
