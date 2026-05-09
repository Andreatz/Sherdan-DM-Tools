import { describe, expect, it } from "vitest";

import { parseSherdanNpcMarkdown } from "@/lib/parsers/sherdan-npc";
import { readSherdanSource } from "../../helpers/sherdan-sources";

const npcMarkdown = readSherdanSource("npc");

if (!npcMarkdown) {
  describe.skip("parseSherdanNpcMarkdown", () => {
    it("requires local Sherdan source markdown", () => {});
  });
} else {
  describe("parseSherdanNpcMarkdown", () => {
    const npcs = parseSherdanNpcMarkdown(npcMarkdown);

    it("parses NPC.md into importable npc entities", () => {
      expect(npcs.length).toBeGreaterThan(60);
      expect(npcs[0]).toMatchObject({
        type: "npc",
        name: 'Capitana Lunacupa "La Vedova"',
        visibility: "dm_only",
      });
    });

    it("extracts typed properties, secrets, weaknesses and PG hooks", () => {
      const lunacupa = npcs.find((npc) => npc.name.includes("Lunacupa"));

      expect(lunacupa).toBeDefined();
      expect(lunacupa?.properties).toMatchObject({
        race: "Umana",
        class: "Ranger",
        level: 12,
        age: "43 anni",
        goals: {
          short_term: expect.stringContaining("informatrici"),
          medium_term: expect.stringContaining("Cinque Capi"),
          long_term: expect.stringContaining("porto sicuro"),
        },
      });
      expect(lunacupa?.properties.tics).toHaveLength(4);
      expect(lunacupa?.properties.weaknesses).toHaveLength(4);
      expect(lunacupa?.secrets.map((secret) => secret.layer)).toEqual([
        "surface",
        "intermediate",
        "deep",
      ]);
      expect(lunacupa?.pcHooks).toHaveLength(4);
      expect(lunacupa?.pcHooks[0]).toMatchObject({
        pcName: "Bellamy",
        status: "available",
      });
    });

    it("keeps Malakor's masquerade data for later identity/link import", () => {
      const malakor = npcs.find((npc) => npc.name.includes("Malakor"));

      expect(malakor).toBeDefined();
      expect(malakor?.identities).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Dante Il Fortunato",
            isTrueIdentity: false,
            visibility: "public",
          }),
        ]),
      );
      expect(malakor?.entityLinks.length).toBeGreaterThanOrEqual(8);
      expect(malakor?.pcHooks.map((hook) => hook.pcName)).toContain("Azazel");
      expect(malakor?.secrets).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            layer: "deep",
            content: expect.stringContaining("Vincolatori sopravvissuti"),
          }),
        ]),
      );
    });

    it("keeps private markers out of public NPC descriptions", () => {
      const privateMarkers = ["\u{1F512}", "\u{1F4A1}", "GM-Only"];
      const publicDescriptions = npcs.map((npc) => npc.publicDescription);

      for (const description of publicDescriptions) {
        for (const marker of privateMarkers) {
          expect(description).not.toContain(marker);
        }
      }

      expect(
        npcs.find((npc) => npc.name === "Il Re d'Ombra")?.publicDescription,
      ).toBe("");
      expect(
        npcs.find((npc) => npc.name === "Lama Tenzin / Lama Dorje")
          ?.publicDescription,
      ).toContain("Lama Tenzin");
    });
  });
}
