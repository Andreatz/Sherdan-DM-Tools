import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { buildSherdanBootstrapPlan } from "@/lib/import/sherdan-bootstrap-plan";
import {
  countResolvedPcHookAssignments,
  resolvePcHookEntityKeys,
} from "@/lib/import/sherdan-pc-hook-resolution";

const publicDir = path.join(process.cwd(), "public");

const plan = buildSherdanBootstrapPlan({
  npc: readFileSync(path.join(publicDir, "NPC.md"), "utf8"),
  factions: readFileSync(path.join(publicDir, "Fazioni.md"), "utf8"),
  lore: readFileSync(path.join(publicDir, "Lore.md"), "utf8"),
  campaign: readFileSync(path.join(publicDir, "Campagna.md"), "utf8"),
  backgrounds: readFileSync(
    path.join(publicDir, "Background Personaggi.md"),
    "utf8",
  ),
  playerManual: readFileSync(
    path.join(publicDir, "Manuale del Giocatore.md"),
    "utf8",
  ),
});

describe("Sherdan PC hook resolution", () => {
  it("maps short names and identity aliases to their PC entity", () => {
    expect(resolvePcHookEntityKeys(plan.entities, "Axton")).toEqual([
      "pc:axton arkwright",
    ]);
    expect(resolvePcHookEntityKeys(plan.entities, "Noel/Yancarlos")).toEqual([
      "pc:noel estragon",
    ]);
    expect(resolvePcHookEntityKeys(plan.entities, "Erevan/Azazel")).toEqual([
      "pc:azazel",
    ]);
  });

  it("expands group hooks to all PCs", () => {
    const allPcKeys = plan.entities
      .filter((entity) => entity.type === "pc")
      .map((entity) => entity.key);

    expect(resolvePcHookEntityKeys(plan.entities, "Tutti")).toEqual(allPcKeys);
  });

  it("resolves every planned hook row into concrete assignments", () => {
    expect(countResolvedPcHookAssignments(plan)).toBe(70);
    for (const hook of plan.pcHooks) {
      expect(resolvePcHookEntityKeys(plan.entities, hook.pcName)).not.toHaveLength(0);
    }
  });
});
