import { describe, expect, it } from "vitest";

import { projectForAudience } from "@/lib/security/player-safe";

describe("projectForAudience", () => {
  it("returns DM data unchanged for dm audience", () => {
    const value = {
      name: "Sestante",
      description: "Verita' GM",
      publicDescription: "Versione pubblica",
      entitySecrets: [{ content: "Spoiler" }],
    };

    expect(projectForAudience(value, { audience: "dm" })).toBe(value);
  });

  it("strips GM-only fields and normalizes publicDescription for players", () => {
    const value = {
      name: "Sestante",
      description: "Verita' GM",
      publicDescription: "Versione pubblica",
      dmNotes: "Non mostrare",
      embedding: [0.1, 0.2],
      nested: {
        truthRevealed: "Spoiler cosmico",
        public_description: "Voce comune",
      },
      entitySecrets: [{ content: "Segreto" }],
    };

    expect(projectForAudience(value, { audience: "player" })).toEqual({
      name: "Sestante",
      description: "Versione pubblica",
      nested: {
        description: "Voce comune",
      },
    });
  });

  it("projects arrays recursively", () => {
    const value = [
      { name: "Noel", isTrueIdentity: true, publicDescription: "Bardo" },
      { name: "Yancarlos", exploitHint: "Leva GM", publicDescription: "Pirata" },
    ];

    expect(projectForAudience(value, { audience: "public" })).toEqual([
      { name: "Noel", description: "Bardo" },
      { name: "Yancarlos", description: "Pirata" },
    ]);
  });
});
