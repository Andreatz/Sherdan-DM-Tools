import { describe, expect, it } from "vitest";

import { formatEncounterTacticalNotes } from "@/lib/encounters/tactical-notes";

describe("formatEncounterTacticalNotes", () => {
  it("formats assist output into editable markdown", () => {
    const text = formatEncounterTacticalNotes({
      title: "Il pantano dei morti verdi",
      concept: "La palude prova a separare il gruppo.",
      selectedCandidate: {
        participants: [
          {
            monster: { name: "Wight", challengeRating: "3" },
            count: 2,
          },
        ],
      },
      constraintReport: {
        targetDifficulty: "medium",
        selectedDifficulty: "medium",
        baseXp: 1400,
        multiplier: 1.5,
        adjustedXp: 2100,
      },
      tacticalNotes: {
        terrain: "Acqua bassa e radici.",
        opening: "I wight emergono da lati opposti.",
        monster_tactics: ["Isolano il bersaglio piu' lento."],
        escalation: "Il fango diventa terreno difficile.",
        retreat_or_surrender: "Uno fugge verso la rovina.",
      },
      narrativeHooks: {
        truth_revelations: ["Una moneta nera affiora nel fango."],
        plot_complications: ["La palude reagisce al sangue."],
        pc_hooks: ["Un simbolo richiama il passato di un PG."],
      },
      variants: ["Aggiungi nebbia."],
      gmNotes: ["Non rivelare tutto subito."],
    });

    expect(text).toContain("# Il pantano dei morti verdi");
    expect(text).toContain("- 2x Wight (CR 3)");
    expect(text).toContain("- adjusted XP: 2100");
    expect(text).toContain("## Truth Revelations");
    expect(text).toContain("- Una moneta nera affiora nel fango.");
  });
});
