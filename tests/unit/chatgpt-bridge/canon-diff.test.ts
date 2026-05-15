import { describe, expect, it } from "vitest";

import { buildSessionCanonDiff } from "@/lib/chatgpt-bridge/canon-diff";

describe("buildSessionCanonDiff", () => {
  it("confronta la sessione campo-per-campo usando UPDATE PACK", () => {
    const diff = buildSessionCanonDiff({
      comparedTo: "Sessione 7",
      importedMarkdown: "Testo lungo importato",
      session: {
        title: "Vecchio titolo",
        recap: "Il party entra al porto.",
        dmNotes: "Il duca mente.",
        prepNotes: "Preparare guardie.",
      },
      updatePack: {
        session: {
          title: "Nuovo titolo",
          recapCandidate: "Il party entra al porto e trova il sigillo.",
          dmNotesCandidate: "Il duca mente.",
          prepNotesCandidate: "Preparare guardie e mappa.",
        },
      },
    });

    expect(diff.fields).toHaveLength(4);
    expect(diff.fieldSummary?.changed).toBe(3);
    expect(diff.fields?.find((field) => field.field === "dmNotes")?.changed).toBe(
      false,
    );
    expect(diff.fields?.find((field) => field.field === "recap")?.source).toBe(
      "update_pack",
    );
  });

  it("usa heading markdown quando manca UPDATE PACK", () => {
    const diff = buildSessionCanonDiff({
      comparedTo: "Sessione 8",
      importedMarkdown: [
        "# Titolo importato",
        "",
        "## Recap",
        "Recap nuovo.",
        "",
        "## Note DM",
        "Nota nuova.",
      ].join("\n"),
      session: {
        title: "Titolo canon",
        recap: "Recap vecchio.",
        dmNotes: null,
        prepNotes: null,
      },
    });

    expect(diff.fields?.find((field) => field.field === "title")?.source).toBe(
      "markdown_title",
    );
    expect(diff.fields?.find((field) => field.field === "recap")?.imported).toBe(
      "Recap nuovo.",
    );
    expect(diff.fields?.find((field) => field.field === "prepNotes")?.source).toBe(
      "missing",
    );
  });
});
