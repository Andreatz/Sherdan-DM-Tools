import { describe, expect, it } from "vitest";

import {
  selectAcceptedPieces,
  sessionPrepAcceptSchema,
  type SessionPrepOutput,
} from "@/lib/session-prep";

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";

const fullOutput: SessionPrepOutput = {
  previouslyOn: "Il party fugge da Tharros.",
  hooks: [
    {
      pcEntityId: null,
      pcName: "Bellamy",
      targetEntityId: null,
      targetName: "Dante",
      hookDescription: "h1",
      potentialArc: "a1",
      rationale: "r1",
    },
    {
      pcEntityId: null,
      pcName: "Axton",
      targetEntityId: null,
      targetName: "Capitana",
      hookDescription: "h2",
      potentialArc: "a2",
      rationale: "r2",
    },
  ],
  npcSeeds: [
    {
      existingEntityId: null,
      name: "Mercante taciturno",
      narrativeRole: "informatore",
      proposedType: "npc",
      tone: "stanco",
      rationale: "r",
    },
  ],
  encounterSeeds: [
    {
      title: "Imboscata",
      concept: "concept",
      difficultyHint: "medium",
      creatureHints: ["banditi"],
      rationale: "r",
    },
  ],
  suggestedClues: [
    {
      relatedPlotThreadId: null,
      plotThreadTitle: "Verita' Malakor",
      description: "Una moneta nera.",
      truthRevealed: "Dante e' Malakor.",
      rationale: "r",
    },
    {
      relatedPlotThreadId: null,
      plotThreadTitle: null,
      description: "Mappa stracciata.",
      truthRevealed: "Tharros conosce Lunacupa.",
      rationale: "r",
    },
  ],
  notes: ["Bellamy senza spotlight"],
};

describe("selectAcceptedPieces", () => {
  it("ritorna i soli indici selezionati e rispetta i flag booleani", () => {
    const filtered = selectAcceptedPieces(fullOutput, {
      previouslyOn: false,
      notes: true,
      hooks: [1],
      npcSeeds: [0],
      encounterSeeds: [],
      suggestedClues: [0, 1],
    });
    expect(filtered.previouslyOn).toBe("");
    expect(filtered.notes).toEqual(["Bellamy senza spotlight"]);
    expect(filtered.hooks).toHaveLength(1);
    expect(filtered.hooks[0]?.pcName).toBe("Axton");
    expect(filtered.npcSeeds).toHaveLength(1);
    expect(filtered.encounterSeeds).toEqual([]);
    expect(filtered.suggestedClues).toHaveLength(2);
  });

  it("ignora silenziosamente indici fuori range", () => {
    const filtered = selectAcceptedPieces(fullOutput, {
      previouslyOn: true,
      notes: false,
      hooks: [99],
      npcSeeds: [-1, 0],
      encounterSeeds: [0, 5],
      suggestedClues: [],
    });
    expect(filtered.hooks).toEqual([]);
    expect(filtered.npcSeeds).toHaveLength(1);
    expect(filtered.encounterSeeds).toHaveLength(1);
    expect(filtered.notes).toEqual([]);
  });
});

describe("sessionPrepAcceptSchema", () => {
  it("accetta un payload completo", () => {
    const parsed = sessionPrepAcceptSchema.parse({
      campaignId: CAMPAIGN_ID,
      sessionId: SESSION_ID,
      output: fullOutput,
      selected: {
        previouslyOn: true,
        notes: true,
        hooks: [0],
        npcSeeds: [0],
        encounterSeeds: [],
        suggestedClues: [0],
      },
    });
    expect(parsed.selected.hooks).toEqual([0]);
  });

  it("default selected.previouslyOn=true e arrays vuoti", () => {
    const parsed = sessionPrepAcceptSchema.parse({
      campaignId: CAMPAIGN_ID,
      sessionId: SESSION_ID,
      output: fullOutput,
      selected: {},
    });
    expect(parsed.selected).toEqual({
      previouslyOn: true,
      notes: true,
      hooks: [],
      npcSeeds: [],
      encounterSeeds: [],
      suggestedClues: [],
    });
  });

  it("rifiuta campi extra (strict)", () => {
    expect(() =>
      sessionPrepAcceptSchema.parse({
        campaignId: CAMPAIGN_ID,
        sessionId: SESSION_ID,
        output: fullOutput,
        selected: {},
        unknownField: true,
      }),
    ).toThrow();
  });
});
