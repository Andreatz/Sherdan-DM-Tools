import { describe, expect, it } from "vitest";

import {
  buildEncounterAssistPrompt,
  composeEncounterAssistOutput,
  encounterAssistInputSchema,
  encounterAssistLLMOutputSchema,
  type EncounterCompositionSuggestion,
} from "@/lib/encounters";

describe("encounter assist", () => {
  it("validates assist input from form-shaped values", () => {
    const input = encounterAssistInputSchema.parse({
      campaignId: "11111111-1111-4111-8111-111111111111",
      brief: "Encounter di livello 5 in palude, tema corruzione",
      partyLevel: "5",
      partySize: "4",
      difficulty: "medium",
      environment: "Swamp",
    });

    expect(input).toMatchObject({
      partyLevel: 5,
      partySize: 4,
      difficulty: "medium",
      environment: "Swamp",
    });
  });

  it("renders a prompt with fixed candidate indexes", () => {
    const prompt = buildEncounterAssistPrompt({
      request: encounterAssistInputSchema.parse({
        campaignId: "11111111-1111-4111-8111-111111111111",
        brief: "Livello 5 in palude, tema corruzione",
        partyLevel: 5,
        partySize: 4,
        difficulty: "medium",
      }),
      candidates: [candidateFixture()],
      narrativeContext: narrativeContextFixture(),
    });

    const user = Array.isArray(prompt.input) ? prompt.input[1]?.content : "";
    expect(user).toContain("Candidate 0");
    expect(user).toContain("2x Wight");
    expect(user).toContain("Plot Threads");
    expect(user).toContain("Monete nere");
    expect(user).toContain("selected_candidate_index");
  });

  it("accepts tactical notes structured output", () => {
    const output = encounterAssistLLMOutputSchema.parse(llmOutputFixture());

    expect(output.tactical_notes.monster_tactics).toContain(
      "I wight provano a isolare il personaggio con meno mobilita.",
    );
    expect(output.narrative_hooks.truth_revelations[0]).toContain(
      "moneta nera",
    );
  });

  it("composes LLM output with the selected math candidate", () => {
    const composed = composeEncounterAssistOutput(llmOutputFixture(), [
      candidateFixture(),
    ], "medium");

    expect(composed.selectedCandidateIndex).toBe(0);
    expect(composed.constraintReport).toMatchObject({
      targetDifficulty: "medium",
      selectedDifficulty: "medium",
      adjustedXp: 2100,
      respectsTarget: true,
    });
    expect(composed.narrativeHooks.plot_complications).toHaveLength(1);
    expect(composed.selectedCandidate.participants[0]?.monster.name).toBe(
      "Wight",
    );
  });

  it("falls back to a valid constrained candidate when the model chooses an invalid index", () => {
    const composed = composeEncounterAssistOutput(
      {
        ...llmOutputFixture(),
        selected_candidate_index: 99,
      },
      [candidateFixture()],
      "medium",
    );

    expect(composed.selectedCandidateIndex).toBe(0);
    expect(composed.constraintReport.respectsTarget).toBe(true);
  });
});

function candidateFixture(): EncounterCompositionSuggestion {
  return {
    participants: [
      {
        monster: {
          id: "wight",
          name: "Wight",
          xp: 700,
          challengeRating: "3",
          creatureType: "undead",
          size: "medium",
          environment: ["Swamp"],
        },
        count: 2,
      },
    ],
    difficulty: {
      partySize: 4,
      thresholds: { easy: 1000, medium: 2000, hard: 3000, deadly: 4400 },
      monsterCount: 2,
      baseXp: 1400,
      multiplier: 1.5,
      adjustedXp: 2100,
      difficulty: "medium",
    },
    score: 400,
  };
}

function llmOutputFixture() {
  return {
    title: "Il pantano dei morti verdi",
    concept:
      "Un incontro in cui la corruzione della palude spinge i non morti a trascinare i PG nel fango.",
    selected_candidate_index: 0,
    tactical_notes: {
      terrain: "Acqua bassa, radici e zone di fango difficile.",
      opening: "I wight emergono separati, gia' in copertura parziale.",
      monster_tactics: [
        "I wight provano a isolare il personaggio con meno mobilita.",
      ],
      escalation: "La palude ribolle e trasforma tre caselle in terreno difficile.",
      retreat_or_surrender:
        "Se uno cade, l'altro prova a fuggire verso una rovina sommersa.",
    },
    variants: ["Aggiungi nebbia pesante se vuoi piu' pressione."],
    gm_notes: ["Buono per introdurre tracce di corruzione necromantica."],
    narrative_hooks: {
      truth_revelations: [
        "Mostra una moneta nera ossidata nel fango senza spiegarne l'origine.",
      ],
      plot_complications: [
        "La palude reagisce al sangue e richiama il thread delle monete nere.",
      ],
      pc_hooks: ["Un simbolo sul wight richiama il passato di un PG."],
    },
  };
}

function narrativeContextFixture() {
  return {
    plotThreads: [
      {
        id: "plot-1",
        title: "Monete nere",
        status: "hot",
        publicDescription: "Strane monete circolano tra i mercanti.",
        description: "Le monete sono un segnale della rete dell'Eclissi.",
      },
    ],
    truthClues: [
      {
        id: "clue-1",
        description: "Una moneta nera ossidata appare nel fango.",
        truthRevealed: "La palude e' collegata ai movimenti dell'Eclissi.",
        status: "planted",
        relatedPlotThreadId: "plot-1",
      },
    ],
    pcHooks: [
      {
        id: "hook-1",
        pcEntityId: "pc-1",
        targetEntityId: "npc-1",
        hookDescription: "Un vecchio simbolo familiare compare sui cadaveri.",
        potentialArc: "Il PG puo' collegare la palude al suo passato.",
        status: "available",
      },
    ],
  };
}
