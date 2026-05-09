import { describe, expect, it } from "vitest";

import { parseSherdanPlayerManualMarkdown } from "@/lib/parsers/sherdan-player-manual";
import { readSherdanSource } from "../../helpers/sherdan-sources";

const manualMarkdown = readSherdanSource("playerManual");

if (!manualMarkdown) {
  describe.skip("parseSherdanPlayerManualMarkdown", () => {
    it("requires local Sherdan source markdown", () => {});
  });
} else {
  describe("parseSherdanPlayerManualMarkdown", () => {
    const documents = parseSherdanPlayerManualMarkdown(manualMarkdown);

    it("parses the player manual as custom rule document chunks", () => {
      expect(documents).toHaveLength(47);
      expect(documents[0]).toMatchObject({
        source: "sherdan-custom",
        title: "Manuale del Giocatore",
        section: "Cap. I > Storia, Genesi e La Rivoluzione Obsidica",
        chunkIndex: 0,
        metadata: {
          source_file: "Manuale del Giocatore.md",
          source_kind: "player_manual",
          heading_level: 2,
          heading_line: 109,
          chapter: "Cap. I",
          category: "history",
        },
      });
      expect(documents.map((document) => document.chunkIndex)).toEqual(
        documents.map((_, index) => index),
      );
    });

    it("removes Homebrewery layout directives and media markup", () => {
      const joinedContent = documents.map((document) => document.content).join("\n");

      expect(joinedContent).toContain("Obsidium");
      expect(joinedContent).not.toContain("{{");
      expect(joinedContent).not.toContain("\\page");
      expect(joinedContent).not.toContain("imageMask");
      expect(joinedContent).not.toContain("position:absolute");
      expect(joinedContent).not.toContain("<img");
    });

    it("classifies setting chapters into useful rule-document categories", () => {
      const byCategory = documents.reduce<Record<string, number>>(
        (acc, document) => {
          acc[document.metadata.category] =
            (acc[document.metadata.category] ?? 0) + 1;
          return acc;
        },
        {},
      );

      expect(byCategory).toEqual({
        history: 3,
        geography: 3,
        seas: 9,
        cities: 27,
        pantheon: 5,
      });
    });

    it("keeps city and pantheon sections independently searchable", () => {
      const tharrosPolitics = documents.find((document) =>
        document.section.includes("Politica e Governo: Il Consiglio del Progresso"),
      );
      const mitra = documents.find((document) =>
        document.section.includes("Mitra, L'Ombra del Vuoto"),
      );

      expect(tharrosPolitics).toBeDefined();
      expect(tharrosPolitics?.metadata).toMatchObject({
        chapter: "Cap. IV",
        category: "cities",
      });
      expect(tharrosPolitics?.content).toContain("Consiglio del Progresso");
      expect(tharrosPolitics?.content).toContain("Gli Occhi di Vetro");

      expect(mitra).toBeDefined();
      expect(mitra?.metadata).toMatchObject({
        chapter: "Cap. V",
        category: "pantheon",
      });
      expect(mitra?.content).toContain("Grande Vuoto");
      expect(mitra?.content).toContain("Obsidium");
    });
  });
}
