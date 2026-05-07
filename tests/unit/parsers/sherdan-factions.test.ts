import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseSherdanFactionsMarkdown } from "@/lib/parsers/sherdan-factions";

const factionsMarkdown = readFileSync(
  path.join(process.cwd(), "public", "Fazioni.md"),
  "utf8",
);

describe("parseSherdanFactionsMarkdown", () => {
  const factions = parseSherdanFactionsMarkdown(factionsMarkdown);

  it("parses Fazioni.md into importable faction entities", () => {
    expect(factions).toHaveLength(17);
    expect(factions[0]).toMatchObject({
      type: "faction",
      name: "Le Valchirie della Burrasca",
      visibility: "dm_only",
    });
  });

  it("extracts typed faction properties and lieutenant sub-entities", () => {
    const valchirie = factions.find((faction) =>
      faction.name.includes("Valchirie"),
    );

    expect(valchirie).toBeDefined();
    expect(valchirie?.properties).toMatchObject({
      members_count_estimate: expect.stringContaining("200"),
      size: "medium",
    });
    expect(valchirie?.properties.structure).toContain("Madre Furiosa");
    expect(valchirie?.properties.methods.length).toBeGreaterThanOrEqual(2);
    expect(valchirie?.lieutenantEntities).toHaveLength(2);
    expect(valchirie?.lieutenantEntities[0]).toMatchObject({
      type: "npc",
      name: "Prima Lama Vesta",
      parentFactionName: "Le Valchirie della Burrasca",
      properties: {
        race: "Mezzorca",
      },
    });
  });

  it("extracts secrets, relationships and PG hooks from structured factions", () => {
    const synapse = factions.find((faction) => faction.name === "La Synapse");

    expect(synapse).toBeDefined();
    expect(synapse?.secrets.map((secret) => secret.layer)).toEqual([
      "surface",
      "intermediate",
      "deep",
    ]);
    expect(synapse?.entityLinks).toHaveLength(6);
    expect(synapse?.entityLinks[0]).toMatchObject({
      targetName: "Consiglio del Progresso",
      relationType: "related_to",
      visibility: "dm_only",
    });
    expect(synapse?.pcHooks).toHaveLength(3);
    expect(synapse?.properties.goals.short_term).toContain("mercato nero");
  });

  it("keeps Eclissi GM-only truths as deep secrets", () => {
    const eclissi = factions.find((faction) => faction.name === "L'Eclissi");

    expect(eclissi).toBeDefined();
    expect(eclissi?.secrets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          layer: "deep",
          content: expect.stringContaining("Il Vero Volto dell'Eclissi"),
        }),
        expect.objectContaining({
          layer: "deep",
          content: expect.stringContaining("Trono Dormiente"),
        }),
      ]),
    );
    expect(eclissi?.entityLinks.length).toBeGreaterThanOrEqual(6);
    expect(eclissi?.lieutenantEntities.map((entity) => entity.name)).toContain(
      'Saeth "Il Lamento"',
    );
  });
});
