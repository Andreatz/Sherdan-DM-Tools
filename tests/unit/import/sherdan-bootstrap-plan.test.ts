import { describe, expect, it } from "vitest";

import { buildSherdanBootstrapPlan } from "@/lib/import/sherdan-bootstrap-plan";
import { readSherdanSources } from "../../helpers/sherdan-sources";

const sources = readSherdanSources();

if (!sources) {
  describe.skip("buildSherdanBootstrapPlan", () => {
    it("requires local Sherdan source markdown", () => {});
  });
} else {
  const plan = buildSherdanBootstrapPlan(sources);

  describe("buildSherdanBootstrapPlan", () => {
    it("combines parser outputs into a first-pass import plan", () => {
      expect(plan.entities).toHaveLength(153);
      expect(plan.sessions).toHaveLength(6);
      expect(plan.plotThreads).toHaveLength(10);
      expect(plan.ruleDocuments).toHaveLength(47);
      expect(plan.pcHooks).toHaveLength(58);
      expect(plan.deferredLinks).toHaveLength(45);
      expect(plan.entityLinks).toHaveLength(45);
      expect(plan.unresolvedLinks).toHaveLength(3);
    });

    it("preserves typed entity distribution and parent-child imports", () => {
      const byType = plan.entities.reduce<Record<string, number>>((acc, entity) => {
        acc[entity.type] = (acc[entity.type] ?? 0) + 1;
        return acc;
      }, {});
      const lieutenantCount = plan.entities.filter((entity) => entity.parentKey).length;

      expect(byType).toEqual({
        pc: 7,
        npc: 92,
        faction: 17,
        deity: 1,
        organization: 15,
        location: 21,
      });
      expect(lieutenantCount).toBe(27);
      expect(plan.entities.find((entity) => entity.name === "Prima Lama Vesta")).toMatchObject({
        type: "npc",
        parentKey: "faction:le valchirie della burrasca",
      });
    });

    it("keeps identities, secrets and rule documents available for idempotent upsert", () => {
      const identityCount = plan.entities.reduce(
        (sum, entity) => sum + entity.identities.length,
        0,
      );
      const secretCount = plan.entities.reduce(
        (sum, entity) => sum + entity.secrets.length,
        0,
      );

      expect(identityCount).toBe(81);
      expect(secretCount).toBe(56);
      expect(plan.ruleDocuments[0]).toMatchObject({
        source: "sherdan-custom",
        title: "Manuale del Giocatore",
        chunkIndex: 0,
      });
    });

    it("resolves table links and section references into entity link imports", () => {
      expect(plan.entityLinks).toContainEqual(
        expect.objectContaining({
          sourceEntityKey: 'npc:malakor "lo sfregiato"',
          targetEntityKey: "faction:l'eclissi",
          relationType: "related_to",
          source: "parser-table",
        }),
      );
      expect(plan.entityLinks).toContainEqual(
        expect.objectContaining({
          sourceEntityKey: "organization:l'esplosione della brass raven — anno 197 (2 anni fa)",
          targetEntityKey: 'npc:"chiave rotta" / darian vex',
          relationType: "references",
          source: "section-ref",
        }),
      );
      expect(plan.unresolvedLinks).toContainEqual(
        expect.objectContaining({
          targetName: "NPC.md §60",
          reason: "unknown-target",
        }),
      );
    });
  });
}
