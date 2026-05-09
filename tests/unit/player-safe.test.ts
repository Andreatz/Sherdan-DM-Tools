import { describe, expect, it } from "vitest";

import {
  sanitizePlayerProperties,
  toPlayerSafeEntity,
  toPlayerSafeEntityLink,
  toPlayerSafeTruthClue,
} from "@/lib/player-safe";

describe("player-safe projections", () => {
  it("drops non-player-visible entities", () => {
    expect(
      toPlayerSafeEntity({
        id: "entity-1",
        type: "npc",
        name: "Malakor",
        description: "Verita' GM",
        publicDescription: "Un mercante gentile",
        visibility: "dm_only",
      }),
    ).toBeNull();
  });

  it("projects only public entity description and sanitized properties", () => {
    const projected = toPlayerSafeEntity({
      id: "entity-1",
      campaignId: "campaign-1",
      type: "npc",
      name: "Dante il Fortunato",
      description: "Malakor sotto copertura.",
      publicDescription: "Un mercante troppo sorridente.",
      visibility: "player_visible",
      tags: ["npc"],
      parentId: null,
      properties: {
        appearance_summary: "Cappotto verde e sorriso largo.",
        gm_only: "Non mostrare",
        extra: {
          rumor: "Paga bene.",
          truthRevealed: "E' Malakor.",
          nested: [{ publicFact: "Ama il vino" }, { secret: "No" }],
        },
      },
    });

    expect(projected).toEqual({
      id: "entity-1",
      campaignId: "campaign-1",
      type: "npc",
      name: "Dante il Fortunato",
      description: "Un mercante troppo sorridente.",
      properties: {
        appearance_summary: "Cappotto verde e sorriso largo.",
        extra: {
          rumor: "Paga bene.",
          nested: [{ publicFact: "Ama il vino" }, {}],
        },
      },
      tags: ["npc"],
      parentId: null,
      visibility: "player_visible",
    });
  });

  it("uses public relation type and never raw relation type", () => {
    const projected = toPlayerSafeEntityLink({
      id: "link-1",
      sourceEntityId: "a",
      targetEntityId: "b",
      relationType: "burattino_di",
      publicRelationType: "alleato di",
      strength: 2,
      description: "Si aiutano in pubblico.",
      visibility: "public",
    });

    expect(projected?.relationType).toBe("alleato di");
  });

  it("does not expose truthRevealed from truth clues", () => {
    const projected = toPlayerSafeTruthClue({
      id: "clue-1",
      description: "Il bassorilievo mostra sei ombre al cerchio.",
      truthRevealed: "I sei fratelli erano responsabili.",
      status: "noticed",
      visibility: "player_visible",
    });

    expect(projected).toEqual({
      id: "clue-1",
      description: "Il bassorilievo mostra sei ombre al cerchio.",
      status: "noticed",
      statusNotes: null,
      plantedInSession: null,
      relatedPlotThreadId: null,
      relatedEntities: [],
      visibility: "player_visible",
    });
  });

  it("sanitizes recursive GM-only keys", () => {
    expect(
      sanitizePlayerProperties({
        safe: true,
        gmNotes: "hidden",
        nested: {
          publicFact: "ok",
          exploit_hint: "hidden",
        },
      }),
    ).toEqual({ nested: { publicFact: "ok" }, safe: true });
  });
});
