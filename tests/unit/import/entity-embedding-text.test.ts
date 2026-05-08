import { describe, expect, it } from "vitest";

import {
  ENTITY_EMBEDDING_DIMENSIONS,
  assertEmbeddingDimensions,
  buildEntityEmbeddingText,
} from "@/lib/import/entity-embedding-text";

describe("buildEntityEmbeddingText", () => {
  it("combines core entity fields into stable embedding text", () => {
    const text = buildEntityEmbeddingText({
      type: "npc",
      name: "Lunacupa",
      description: "Verita' GM\n\ncon segreti.",
      publicDescription: "Capitana delle Valchirie.",
      properties: {
        race: "Umana",
        voice: { tone: "fredda", speech_patterns: ["frasi brevi"] },
      },
      tags: ["sherdan-import", "domus-nova"],
      visibility: "dm_only",
      extraSections: [
        {
          title: "Segreti stratificati",
          content: "- surface: Deve un favore alla Synapse.",
        },
      ],
    });

    expect(text).toContain("Tipo: npc");
    expect(text).toContain("Nome: Lunacupa");
    expect(text).toContain("Tag: sherdan-import, domus-nova");
    expect(text).toContain("Descrizione pubblica:");
    expect(text).toContain("Verita' GM:");
    expect(text).toContain("Proprieta' strutturate:");
    expect(text).toContain('"tone": "fredda"');
    expect(text).toContain("Segreti stratificati:");
    expect(text).toContain("Deve un favore alla Synapse.");
  });

  it("rejects embedding vectors with the wrong dimension", () => {
    expect(() =>
      assertEmbeddingDimensions(Array.from({ length: ENTITY_EMBEDDING_DIMENSIONS })),
    ).not.toThrow();
    expect(() => assertEmbeddingDimensions([0, 1, 2])).toThrow(
      /Embedding dimension mismatch/,
    );
  });
});
