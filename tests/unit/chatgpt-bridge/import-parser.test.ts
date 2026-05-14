import { describe, expect, it } from "vitest";

import { analyzeChatGptBridgeImport } from "@/lib/chatgpt-bridge";

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

