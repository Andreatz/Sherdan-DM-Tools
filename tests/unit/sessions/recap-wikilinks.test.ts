import { describe, expect, it } from "vitest";

import {
  parseRecapWikilinkNames,
  resolveRecapMentionEntities,
} from "@/lib/sessions/recap-wikilinks";

describe("recap wikilinks", () => {
  it("parses unique wikilink names from recap markdown", () => {
    expect(
      parseRecapWikilinkNames(
        "Il party incontra [[Malakor]] e poi [[Arborea|la citta']]. [[malakor]] resta nell'ombra.",
      ),
    ).toEqual(["Malakor", "Arborea"]);
  });

  it("resolves wikilinks to campaign entities by normalized name", () => {
    expect(
      resolveRecapMentionEntities(["malakor", "Sconosciuto"], [
        { id: "1", name: "Malakor" },
        { id: "2", name: "Arborea" },
      ]),
    ).toEqual([{ id: "1", name: "Malakor", wikilink: "malakor" }]);
  });
});
