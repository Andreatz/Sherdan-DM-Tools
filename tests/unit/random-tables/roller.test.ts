import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  parseRandomTableEntries,
  RandomTableRollError,
  rollRandomTable,
  type RandomTableDefinition,
} from "@/lib/random-tables";

describe("random table roller", () => {
  it("parses JSONB entries and normalizes defaults", () => {
    const entries = parseRandomTableEntries([
      { value: "common" },
      { label: "rare", value: "rare", weight: 3, sub_table_id: "nested" },
    ]);

    expect(entries).toEqual([
      {
        label: null,
        value: "common",
        weight: 1,
        subTableId: null,
        templateVars: {},
      },
      {
        label: "rare",
        value: "rare",
        weight: 3,
        subTableId: "nested",
        templateVars: {},
      },
    ]);
  });

  it("rolls uniform entries deterministically", async () => {
    const table = tableDef("colors", [
      { value: "red" },
      { value: "blue" },
      { value: "green" },
    ]);

    await expect(rollRandomTable(table, { rng: () => 0 })).resolves.toMatchObject({
      value: "red",
      trace: { entryIndex: 0, totalWeight: 3 },
    });
    await expect(rollRandomTable(table, { rng: () => 0.5 })).resolves.toMatchObject({
      value: "blue",
      trace: { entryIndex: 1, totalWeight: 3 },
    });
    await expect(rollRandomTable(table, { rng: () => 0.99 })).resolves.toMatchObject({
      value: "green",
      trace: { entryIndex: 2, totalWeight: 3 },
    });
  });

  it("respects weighted entries", async () => {
    const table = tableDef("weather", [
      { value: "rain", weight: 1 },
      { value: "fog", weight: 9 },
    ]);

    await expect(rollRandomTable(table, { rng: () => 0.09 })).resolves.toMatchObject({
      value: "rain",
      trace: { entryIndex: 0, totalWeight: 10 },
    });
    await expect(rollRandomTable(table, { rng: () => 0.1 })).resolves.toMatchObject({
      value: "fog",
      trace: { entryIndex: 1, totalWeight: 10 },
    });
  });

  it("handles fractional weights and exact cumulative boundaries", async () => {
    const table = tableDef("fractional", [
      { value: "thin", weight: 0.5 },
      { value: "middle", weight: 1.5 },
      { value: "heavy", weight: 3 },
    ]);

    await expect(rollRandomTable(table, { rng: () => 0.099 })).resolves.toMatchObject({
      value: "thin",
      trace: { entryIndex: 0, threshold: 0.495, totalWeight: 5 },
    });
    await expect(rollRandomTable(table, { rng: () => 0.1 })).resolves.toMatchObject({
      value: "middle",
      trace: { entryIndex: 1, threshold: 0.5, totalWeight: 5 },
    });
    await expect(rollRandomTable(table, { rng: () => 0.4 })).resolves.toMatchObject({
      value: "heavy",
      trace: { entryIndex: 2, threshold: 2, totalWeight: 5 },
    });
  });

  it("resolves nested sub-rolls with trace", async () => {
    const root = tableDef("root", [{ label: "sub", subTableId: "moods" }]);
    const moods = tableDef("moods", [{ value: "guarded" }, { value: "curious" }]);
    const tables = new Map([
      [root.id, root],
      [moods.id, moods],
    ]);

    const result = await rollRandomTable(root, {
      rng: sequence([0, 0.75]),
      resolveTable: (id) => tables.get(id),
    });

    expect(result.value).toBe("curious");
    expect(result.trace).toMatchObject({
      tableId: "root",
      entryIndex: 0,
      subTableId: "moods",
      nested: {
        tableId: "moods",
        depth: 1,
        entryIndex: 1,
        entryValue: "curious",
        template: null,
      },
    });
  });

  it("interpolates template variables from sub-table rolls", async () => {
    const root = tableDef("tavern", [
      {
        value: "Taverniere {name}, {attitude}",
        templateVars: {
          name: "names",
          attitude: "attitudes",
        },
      },
    ]);
    const names = tableDef("names", [{ value: "Mara" }, { value: "Otho" }]);
    const attitudes = tableDef("attitudes", [
      { value: "diffidente" },
      { value: "troppo cordiale" },
    ]);
    const tables = new Map([
      [root.id, root],
      [names.id, names],
      [attitudes.id, attitudes],
    ]);

    const result = await rollRandomTable(root, {
      rng: sequence([0, 0.75, 0.25]),
      resolveTable: (id) => tables.get(id),
    });

    expect(result.value).toBe("Taverniere Otho, diffidente");
    expect(result.trace.template).toMatchObject({
      template: "Taverniere {name}, {attitude}",
      result: "Taverniere Otho, diffidente",
      variables: [
        {
          name: "name",
          tableId: "names",
          value: "Otho",
          trace: { tableId: "names", entryIndex: 1 },
        },
        {
          name: "attitude",
          tableId: "attitudes",
          value: "diffidente",
          trace: { tableId: "attitudes", entryIndex: 0 },
        },
      ],
    });
  });

  it("rolls repeated template variables only once per result", async () => {
    const root = tableDef("echo", [
      {
        value: "{name} guarda {name}",
        template_vars: { name: "names" },
      },
    ]);
    const names = tableDef("names", [{ value: "Lunacupa" }]);

    const result = await rollRandomTable(root, {
      rng: () => 0,
      resolveTable: (id) => (id === "names" ? names : null),
    });

    expect(result.value).toBe("Lunacupa guarda Lunacupa");
    expect(result.trace.template?.variables).toHaveLength(1);
  });

  it("rejects invalid entry shapes", () => {
    expect(() => parseRandomTableEntries([])).toThrow(ZodError);
    expect(() => parseRandomTableEntries([{ value: "bad", weight: 0 }])).toThrow(
      ZodError,
    );
    expect(() => parseRandomTableEntries([{ value: "bad", weight: -1 }])).toThrow(
      ZodError,
    );
    expect(() =>
      parseRandomTableEntries([{ value: "bad", weight: Number.NaN }]),
    ).toThrow(ZodError);
    expect(() => parseRandomTableEntries([{ label: "empty" }])).toThrow(ZodError);
    expect(() =>
      parseRandomTableEntries([{ value: "extra", unknown: true }]),
    ).toThrow(ZodError);
  });

  it("detects circular sub-table references", async () => {
    const a = tableDef("a", [{ subTableId: "b" }]);
    const b = tableDef("b", [{ subTableId: "a" }]);
    const tables = new Map([
      [a.id, a],
      [b.id, b],
    ]);

    await expect(
      rollRandomTable(a, {
        rng: () => 0,
        resolveTable: (id) => tables.get(id),
      }),
    ).rejects.toMatchObject({
      code: "circular_reference",
    } satisfies Partial<RandomTableRollError>);
  });

  it("detects longer circular sub-table chains", async () => {
    const a = tableDef("a", [{ subTableId: "b" }]);
    const b = tableDef("b", [{ subTableId: "c" }]);
    const c = tableDef("c", [{ subTableId: "a" }]);
    const tables = new Map([
      [a.id, a],
      [b.id, b],
      [c.id, c],
    ]);

    await expect(
      rollRandomTable(a, {
        rng: () => 0,
        resolveTable: (id) => tables.get(id),
      }),
    ).rejects.toMatchObject({
      code: "circular_reference",
      message: "Circular random table reference: a -> b -> c -> a.",
    } satisfies Partial<RandomTableRollError>);
  });

  it("detects circular template references", async () => {
    const a = tableDef("a", [
      { value: "A {b}", templateVars: { b: "b" } },
    ]);
    const b = tableDef("b", [
      { value: "B {a}", templateVars: { a: "a" } },
    ]);
    const tables = new Map([
      [a.id, a],
      [b.id, b],
    ]);

    await expect(
      rollRandomTable(a, {
        rng: () => 0,
        resolveTable: (id) => tables.get(id),
      }),
    ).rejects.toMatchObject({
      code: "circular_reference",
    } satisfies Partial<RandomTableRollError>);
  });

  it("rejects templates with unmapped variables", async () => {
    await expect(
      rollRandomTable(tableDef("bad-template", [{ value: "Hello {name}" }]), {
        rng: () => 0,
        resolveTable: () => null,
      }),
    ).rejects.toMatchObject({
      code: "missing_template_var",
    } satisfies Partial<RandomTableRollError>);
  });

  it("rejects direct sub-tables without a resolver", async () => {
    await expect(
      rollRandomTable(tableDef("root", [{ subTableId: "missing-resolver" }]), {
        rng: () => 0,
      }),
    ).rejects.toMatchObject({
      code: "missing_subtable",
    } satisfies Partial<RandomTableRollError>);
  });

  it("rejects direct sub-tables when the resolver returns null", async () => {
    await expect(
      rollRandomTable(tableDef("root", [{ subTableId: "missing" }]), {
        rng: () => 0,
        resolveTable: () => null,
      }),
    ).rejects.toMatchObject({
      code: "missing_subtable",
      message: "Sub-table not found: missing.",
    } satisfies Partial<RandomTableRollError>);
  });

  it("supports async sub-table resolution", async () => {
    const root = tableDef("root", [{ subTableId: "async-child" }]);
    const child = tableDef("async-child", [{ value: "resolved later" }]);

    await expect(
      rollRandomTable(root, {
        rng: () => 0,
        resolveTable: async (id) => (id === child.id ? child : null),
      }),
    ).resolves.toMatchObject({
      value: "resolved later",
      trace: {
        nested: { tableId: "async-child", entryValue: "resolved later" },
      },
    });
  });

  it("enforces the nesting depth limit", async () => {
    const root = tableDef("root", [{ subTableId: "child" }]);
    const child = tableDef("child", [{ value: "leaf" }]);
    const tables = new Map([
      [root.id, root],
      [child.id, child],
    ]);

    await expect(
      rollRandomTable(root, {
        rng: () => 0,
        maxDepth: 0,
        resolveTable: (id) => tables.get(id),
      }),
    ).rejects.toMatchObject({
      code: "depth_limit",
    } satisfies Partial<RandomTableRollError>);
  });

  it("enforces the nesting depth limit through template variables", async () => {
    const root = tableDef("root", [
      { value: "Root {child}", templateVars: { child: "child" } },
    ]);
    const child = tableDef("child", [{ value: "leaf" }]);

    await expect(
      rollRandomTable(root, {
        rng: () => 0,
        maxDepth: 0,
        resolveTable: (id) => (id === child.id ? child : null),
      }),
    ).rejects.toMatchObject({
      code: "depth_limit",
    } satisfies Partial<RandomTableRollError>);
  });

  it("rejects rng values outside the Math.random range", async () => {
    await expect(
      rollRandomTable(tableDef("bad-rng", [{ value: "x" }]), {
        rng: () => 1,
      }),
    ).rejects.toMatchObject({
      code: "invalid_rng",
    } satisfies Partial<RandomTableRollError>);
  });
});

function tableDef(id: string, entries: unknown[]): RandomTableDefinition {
  return {
    id,
    name: id,
    entries,
  };
}

function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? values.at(-1) ?? 0;
}
