import { describe, expect, it } from "vitest";

import {
  normalizeUpdatePackLookupKey,
  scoreUpdatePackMatch,
  updatePackSchema,
} from "@/lib/chatgpt-bridge";

describe("updatePackSchema", () => {
  it("valida payload UPDATE PACK minimale", () => {
    const parsed = updatePackSchema.parse({
      session: { number: 9, title: "Titolo" },
      plotThreadUpdates: [{ title: "Thread", event: "Evento" }],
      truthClueUpdates: [{ description: "Clue", truthRevealed: "Verita" }],
      npcUpdates: [{ name: "PNG", state: "Ferito" }],
      newHooks: [{ pc: "Axton", target: "Duca", hookDescription: "Ricatto" }],
      newIdentities: [{ entity: "Malakor", name: "Dante il Fortunato" }],
      newSecrets: [{ entity: "Malakor", layer: "deep", content: "Verita nascosta" }],
      newLinks: [{ source: "Malakor", target: "Duca", relationType: "manipulates" }],
    });

    expect(parsed.session?.number).toBe(9);
    expect(parsed.newHooks).toHaveLength(1);
    expect(parsed.newIdentities).toHaveLength(1);
    expect(parsed.newSecrets).toHaveLength(1);
    expect(parsed.newLinks).toHaveLength(1);
  });
});

describe("UPDATE PACK lookup matching", () => {
  it("normalizza accenti, articoli e punteggiatura", () => {
    expect(normalizeUpdatePackLookupKey("L'Eclissi dei Sei!")).toBe(
      "eclissi sei",
    );
  });

  it("assegna punteggio pieno a varianti equivalenti", () => {
    expect(scoreUpdatePackMatch("Dante il Fortunato", "Dante Fortunato")).toBe(
      1,
    );
  });

  it("riconosce match fuzzy ma non nomi lontani", () => {
    expect(scoreUpdatePackMatch("Malakor", "Malakor il Nero")).toBeGreaterThan(
      0.8,
    );
    expect(scoreUpdatePackMatch("Noel", "Garrick")).toBeLessThan(0.72);
  });
});
