import { describe, expect, it } from "vitest";

import { analyzeChatGptBridgeImport } from "@/lib/chatgpt-bridge";
import { buildCanonDiff } from "@/lib/chatgpt-bridge/canon-diff";

describe("analyzeChatGptBridgeImport", () => {
  it("estrae un UPDATE PACK JSON valido", () => {
    const result = analyzeChatGptBridgeImport({
      content: [
        "# Sessione 9 - Ombre",
        "",
        "Testo giocabile.",
        "",
        "---",
        "",
        "# UPDATE PACK PER SHERDAN-DM-TOOLS",
        "",
        "```json",
        JSON.stringify({
          session: { number: 9, title: "Ombre" },
          plotThreadUpdates: [],
          truthClueUpdates: [],
          npcUpdates: [],
          newHooks: [],
        }),
        "```",
      ].join("\n"),
    });

    expect(result.hasUpdatePack).toBe(true);
    expect(result.updatePack).toMatchObject({ session: { number: 9 } });
    expect(result.markdownWithoutUpdatePack).toContain("Testo giocabile.");
    expect(result.markdownWithoutUpdatePack).not.toContain("UPDATE PACK");
  });

  it("gestisce JSON mancante senza crash", () => {
    const result = analyzeChatGptBridgeImport({
      content: "# Recap\n\nNessun blocco tecnico.",
    });

    expect(result.hasUpdatePack).toBe(false);
    expect(result.updatePack).toBeUndefined();
    expect(result.warnings).toEqual([]);
  });

  it("segnala JSON invalido ma mantiene il markdown", () => {
    const result = analyzeChatGptBridgeImport({
      content: "# Output\n\n# UPDATE PACK PER SHERDAN-DM-TOOLS\n\n```json\n{ nope\n```",
    });

    expect(result.hasUpdatePack).toBe(true);
    expect(result.updatePack).toBeUndefined();
    expect(result.warnings[0]).toContain("non parseabile");
  });
});

describe("buildCanonDiff", () => {
  it("confronta markdown importato con sezioni canoniche", () => {
    const diff = buildCanonDiff({
      comparedTo: "Sessione 9",
      importedMarkdown: "Riga condivisa\nNuova conseguenza",
      canonSections: [
        { label: "Recap", markdown: "Riga condivisa\nVecchia conseguenza" },
      ],
    });

    expect(diff.sections[0]?.similarity).toBeGreaterThan(0);
    expect(diff.sections[0]?.added).toContain("Nuova conseguenza");
    expect(diff.sections[0]?.removed).toContain("Vecchia conseguenza");
  });
});
