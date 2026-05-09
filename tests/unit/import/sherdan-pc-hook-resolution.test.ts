import { describe, expect, it } from "vitest";

import { buildSherdanBootstrapPlan } from "@/lib/import/sherdan-bootstrap-plan";
import {
  countResolvedPcHookAssignments,
  resolvePcHookEntityKeys,
} from "@/lib/import/sherdan-pc-hook-resolution";
import { readSherdanSources } from "../../helpers/sherdan-sources";

const sources = readSherdanSources();

if (!sources) {
  describe.skip("Sherdan PC hook resolution", () => {
    it("requires local Sherdan source markdown", () => {});
  });
} else {
  const plan = buildSherdanBootstrapPlan(sources);

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
}
