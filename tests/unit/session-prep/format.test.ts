import { describe, expect, it } from "vitest";

import { formatSessionPrepAsMarkdown } from "@/lib/session-prep";

describe("formatSessionPrepAsMarkdown", () => {
  const generatedAt = new Date("2026-05-12T12:00:00Z");

  it("rende ogni sezione presente e salta quelle vuote", () => {
    const md = formatSessionPrepAsMarkdown(
      {
        previouslyOn: "Il party fugge da Tharros.",
        hooks: [
          {
            pcEntityId: null,
            pcName: "Bellamy",
            targetEntityId: null,
            targetName: "Dante",
            hookDescription: "Dante propone un patto sospetto.",
            potentialArc: "tradimento orchestrato",
            rationale: "Bellamy non ha avuto spotlight dalla S3",
          },
        ],
        npcSeeds: [
          {
            existingEntityId: null,
            name: "Mercante taciturno",
            narrativeRole: "informatore riluttante",
            proposedType: "npc",
            tone: "stanco, sospettoso",
            rationale: "serve un ponte verso il porto",
          },
        ],
        encounterSeeds: [],
        suggestedClues: [
          {
            relatedPlotThreadId: null,
            plotThreadTitle: "Verita' su Malakor",
            description: "Una moneta nera incrostata cade dal mantello.",
            truthRevealed: "Dante e' Malakor.",
            rationale: "piantata su scena pubblica, non rivelativa",
          },
        ],
        notes: ["Bellamy non spotlightato dalla S3"],
      },
      { generatedAt, vibe: "intrigo politico" },
    );

    expect(md).toContain("## Session Prep (generato 2026-05-12)");
    expect(md).toContain("*Vibe:* intrigo politico");
    expect(md).toContain("### Previously on...");
    expect(md).toContain("Il party fugge da Tharros.");
    expect(md).toContain("### Hooks proposti");
    expect(md).toContain("**Bellamy → Dante**");
    expect(md).toContain("### NPC seeds");
    expect(md).toContain("Mercante taciturno");
    expect(md).not.toContain("### Encounter seeds");
    expect(md).toContain("### Briciole suggerite");
    expect(md).toContain("Dante e' Malakor.");
    expect(md).toContain("### Note dell'agent");
  });

  it("salta tutte le sezioni opzionali quando arrays sono vuoti", () => {
    const md = formatSessionPrepAsMarkdown(
      {
        previouslyOn: "Brevi.",
        hooks: [],
        npcSeeds: [],
        encounterSeeds: [],
        suggestedClues: [],
        notes: [],
      },
      { generatedAt },
    );
    expect(md).toContain("### Previously on...");
    expect(md).not.toContain("### Hooks proposti");
    expect(md).not.toContain("### NPC seeds");
    expect(md).not.toContain("### Encounter seeds");
    expect(md).not.toContain("### Briciole suggerite");
    expect(md).not.toContain("### Note dell'agent");
  });
});
