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
      },
    });
  });

  it("rejects invalid entry shapes", () => {
    expect(() => parseRandomTableEntries([])).toThrow(ZodError);
    expect(() => parseRandomTableEntries([{ value: "bad", weight: 0 }])).toThrow(
      ZodError,
    );
    expect(() => parseRandomTableEntries([{ label: "empty" }])).toThrow(ZodError);
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
