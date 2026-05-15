import { describe, expect, it } from "vitest";

import { detectCampaignContradictions } from "@/lib/contradictions/detector";

describe("detectCampaignContradictions", () => {
  it("rileva collisioni deterministiche del canon", () => {
    const report = detectCampaignContradictions({
      entities: [
        {
          id: "entity-1",
          type: "npc",
          name: "Dante il Fortunato",
          visibility: "dm_only",
          publicDescription: null,
        },
        {
          id: "entity-2",
          type: "npc",
          name: "Dante Fortunato",
          visibility: "public",
          publicDescription: null,
        },
      ],
      identities: [
        {
          id: "identity-1",
          entityId: "entity-1",
          entityName: "Dante il Fortunato",
          name: "Malakor",
          isTrueIdentity: true,
        },
        {
          id: "identity-2",
          entityId: "entity-1",
          entityName: "Dante il Fortunato",
          name: "Dante",
          isTrueIdentity: true,
        },
      ],
      links: [
        {
          id: "link-1",
          sourceEntityId: "entity-1",
          sourceName: "Dante il Fortunato",
          targetEntityId: "entity-2",
          targetName: "Dante Fortunato",
          relationType: "ally",
          publicRelationType: null,
        },
        {
          id: "link-2",
          sourceEntityId: "entity-2",
          sourceName: "Dante Fortunato",
          targetEntityId: "entity-1",
          targetName: "Dante il Fortunato",
          relationType: "enemy",
          publicRelationType: null,
        },
      ],
      plotThreads: [
        {
          id: "plot-1",
          title: "La Congiura",
          status: "resolved",
          visibility: "public",
          publicDescription: "",
        },
      ],
      truthClues: [
        {
          id: "clue-1",
          description: "Sigillo spezzato",
          truthRevealed: "Il casato mente",
          status: "noticed",
          relatedPlotThreadId: "plot-1",
          plotThreadTitle: "La Congiura",
          plotThreadStatus: "resolved",
          plantedInSession: null,
        },
      ],
    });

    expect(report.summary.total).toBeGreaterThanOrEqual(6);
    expect(report.summary.high).toBeGreaterThanOrEqual(1);
    expect(report.issues.map((issue) => issue.category)).toContain(
      "duplicate_name",
    );
    expect(report.issues.map((issue) => issue.category)).toContain(
      "identity_conflict",
    );
    expect(report.issues.map((issue) => issue.category)).toContain(
      "relationship_conflict",
    );
    expect(report.issues.map((issue) => issue.category)).toContain("plot_state");
  });
});
