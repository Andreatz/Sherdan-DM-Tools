import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseSherdanPcMarkdown } from "@/lib/parsers/sherdan-pc";

const backgroundsMarkdown = readFileSync(
  path.join(process.cwd(), "public", "Background Personaggi.md"),
  "utf8",
);

describe("parseSherdanPcMarkdown", () => {
  const pcs = parseSherdanPcMarkdown(backgroundsMarkdown);

  it("parses player backgrounds as importable PC entities", () => {
    expect(pcs).toHaveLength(7);
    expect(pcs[0]).toMatchObject({
      type: "pc",
      name: "Althea",
      visibility: "discovered",
      properties: {
        race: "Elfa Alta",
        class: "Ladra",
        level: 1,
        age: "120 anni",
      },
    });
  });

  it("extracts structured properties from Axton sections", () => {
    const axton = pcs.find((pc) => pc.name === "Axton Arkwright");

    expect(axton).toBeDefined();
    expect(axton?.properties).toMatchObject({
      race: "Umano Reborn",
      class: "Artefice",
      age: "28 anni",
    });
    expect(axton?.properties.appearance_summary).toContain("Verde smeraldo");
    expect(axton?.properties.personality_traits).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Curioso e inventivo"),
        expect.stringContaining("Cinico ma leale"),
      ]),
    );
    expect(axton?.properties.flaws).toHaveLength(3);
    expect(axton?.properties.motivations).toHaveLength(4);
    expect(axton?.properties.goals.long_term).toContain("miglior inventore-pirata");
    expect(axton?.properties.voice.speech_patterns).toHaveLength(4);
    expect(axton?.identities.map((identity) => identity.name)).toContain(
      "Uomo di ferro",
    );
  });

  it("extracts Noel alternate identities without duplicating the true one", () => {
    const noel = pcs.find((pc) => pc.name === "Noel Estragon");

    expect(noel).toBeDefined();
    expect(noel?.identities).toHaveLength(7);
    expect(noel?.identities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "Noel Estragon",
          isTrueIdentity: true,
          visibility: "discovered",
        }),
        expect.objectContaining({
          name: "Yancarlos",
          isTrueIdentity: false,
          visibility: "dm_only",
        }),
        expect.objectContaining({
          name: "Xuanji Shih",
        }),
        expect.objectContaining({
          name: "Lust",
        }),
      ]),
    );
    expect(noel?.tags).toContain("identita-multiple");
  });

  it("keeps prose-heavy backgrounds as backstory with inferred fields", () => {
    const azazel = pcs.find((pc) => pc.name === "Azazel");
    const bellamy = pcs.find((pc) => pc.name === "Bellamy");

    expect(azazel).toBeDefined();
    expect(azazel?.properties.backstory).toContain("Morne");
    expect(azazel?.properties.subclass).toBe("delle ombre");
    expect(azazel?.properties.extra?.additional_info).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Non permetto a nessuno di toccarmi"),
      ]),
    );
    expect(azazel?.tags).toContain("ombra");

    expect(bellamy).toBeDefined();
    expect(bellamy?.properties.age).toBe("199 anni");
    expect(bellamy?.properties.backstory).toContain("marina di Tharros");
  });
});
