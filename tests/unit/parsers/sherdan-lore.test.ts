import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseSherdanLoreMarkdown } from "@/lib/parsers/sherdan-lore";

const loreMarkdown = readFileSync(
  path.join(process.cwd(), "public", "Lore.md"),
  "utf8",
);

describe("parseSherdanLoreMarkdown", () => {
  const entities = parseSherdanLoreMarkdown(loreMarkdown);

  it("parses top-level Lore.md sections as importable entities", () => {
    expect(entities.length).toBeGreaterThan(35);
    expect(entities[0]).toMatchObject({
      type: "deity",
      name: expect.stringContaining("Le Sette"),
      visibility: "dm_only",
    });
  });

  it("splits locked GM truth away from public lore", () => {
    const pantheon = entities.find((entity) =>
      entity.name.includes("Sette Divin"),
    );

    expect(pantheon).toBeDefined();
    expect(pantheon?.type).toBe("deity");
    expect(pantheon?.description).toContain("responsabili della Scissione");
    expect(pantheon?.description).toContain("sulla loro natura");
    expect(pantheon?.publicDescription).toContain("Personalit");
    expect(pantheon?.publicDescription).not.toContain("responsabili della Scissione");
    expect(pantheon?.publicDescription).not.toContain("🔒");
  });

  it("keeps fully GM-only sections out of public_description", () => {
    const mitraSabotage = entities.find((entity) =>
      entity.name.includes("Sabotaggio di Mitra"),
    );

    expect(mitraSabotage).toBeDefined();
    expect(mitraSabotage?.type).toBe("organization");
    expect(mitraSabotage?.publicDescription).toBe("");
    expect(mitraSabotage?.description).toContain("Mitra Non Fu Corrotto");
    expect(mitraSabotage?.description).not.toContain("🔒");
  });

  it("classifies city lore as locations with public features and GM truths", () => {
    const tharros = entities.find((entity) => entity.name === "Tharros");

    expect(tharros).toBeDefined();
    expect(tharros?.type).toBe("location");
    expect(tharros?.properties).toMatchObject({
      kind: "city",
      notable_features: expect.arrayContaining([
        "Il Ventre — Vita Quotidiana",
        "Il Sistema degli Ascensori",
        "La Cittadella Eterna",
      ]),
    });
    expect(tharros?.publicDescription).toContain("Il Ventre non dorme mai");
    expect(tharros?.publicDescription).not.toContain("Trono di Meliador");
    expect(tharros?.description).toContain("Il Trono di Meliador");
    expect(tharros?.description).toContain("Tosse Cerulea");
  });
});
