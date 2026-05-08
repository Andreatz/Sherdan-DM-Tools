import { describe, expect, it } from "vitest";

import {
  parseRandomTableImport,
  RandomTableImportError,
} from "@/lib/random-tables";

describe("parseRandomTableImport", () => {
  it("imports a JSON array of entries", () => {
    const entries = parseRandomTableImport(
      JSON.stringify([
        { value: "Comune" },
        { label: "Raro", value: "Cristallo", weight: 2 },
      ]),
      { format: "json" },
    );

    expect(entries).toEqual([
      {
        label: null,
        value: "Comune",
        weight: 1,
        subTableId: null,
        templateVars: {},
      },
      {
        label: "Raro",
        value: "Cristallo",
        weight: 2,
        subTableId: null,
        templateVars: {},
      },
    ]);
  });

  it("imports a JSON object with entries", () => {
    const entries = parseRandomTableImport(
      JSON.stringify({
        name: "Nomi",
        entries: [{ value: "Mara", weight: 3 }],
      }),
      { format: "json" },
    );

    expect(entries).toMatchObject([{ value: "Mara", weight: 3 }]);
  });

  it("imports markdown bullet and numbered lists", () => {
    const entries = parseRandomTableImport(
      `
- Comune
- [2] Raro
1. Antico (peso: 3)
2. 4 | Leggendario
`,
      { format: "markdown" },
    );

    expect(entries.map((entry) => [entry.value, entry.weight])).toEqual([
      ["Comune", 1],
      ["Raro", 2],
      ["Antico", 3],
      ["Leggendario", 4],
    ]);
  });

  it("imports CSV with headers", () => {
    const entries = parseRandomTableImport(
      `value,weight,label
Mercante,2,Sociale
Guardia,1,Militare`,
      { format: "csv" },
    );

    expect(entries).toMatchObject([
      { label: "Sociale", value: "Mercante", weight: 2 },
      { label: "Militare", value: "Guardia", weight: 1 },
    ]);
  });

  it("imports quoted CSV values with commas", () => {
    const entries = parseRandomTableImport(
      `value,weight
"Taverna, affollata",2
"Mercato ""nero""",1`,
      { format: "csv" },
    );

    expect(entries.map((entry) => entry.value)).toEqual([
      "Taverna, affollata",
      'Mercato "nero"',
    ]);
  });

  it("imports CSV template variables", () => {
    const entries = parseRandomTableImport(
      `value,templateVars
"Taverniere {name}","{""name"":""names-table""}"`,
      { format: "csv" },
    );

    expect(entries).toMatchObject([
      {
        value: "Taverniere {name}",
        templateVars: { name: "names-table" },
      },
    ]);
  });

  it("auto-detects markdown", () => {
    const entries = parseRandomTableImport("- Notte calma\n- Alba rossa");

    expect(entries.map((entry) => entry.value)).toEqual([
      "Notte calma",
      "Alba rossa",
    ]);
  });

  it("rejects empty and invalid imports", () => {
    expect(() => parseRandomTableImport("")).toThrow(RandomTableImportError);
    expect(() => parseRandomTableImport("value,weight\nBrutto,pesante", { format: "csv" })).toThrow(
      RandomTableImportError,
    );
    expect(() => parseRandomTableImport("{", { format: "json" })).toThrow(
      RandomTableImportError,
    );
  });
});
