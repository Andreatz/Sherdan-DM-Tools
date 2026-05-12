import { describe, expect, it } from "vitest";

import { applyEntityHidden } from "@/lib/security/player-overrides";

interface Row {
  id: string;
  name: string;
}

describe("applyEntityHidden", () => {
  const rows: Row[] = [
    { id: "a", name: "Alice NPC" },
    { id: "b", name: "Bob NPC" },
    { id: "c", name: "Carol NPC" },
  ];

  it("returns a copy untouched when no hidden ids are configured", () => {
    const result = applyEntityHidden(rows, new Set());
    expect(result).toEqual(rows);
    expect(result).not.toBe(rows); // shallow copy
  });

  it("removes rows whose id is in the hidden set", () => {
    const result = applyEntityHidden(rows, new Set(["b"]));
    expect(result.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("removes multiple rows", () => {
    const result = applyEntityHidden(rows, new Set(["a", "c"]));
    expect(result.map((r) => r.id)).toEqual(["b"]);
  });

  it("ignores hidden ids that do not match any row", () => {
    const result = applyEntityHidden(rows, new Set(["zzz"]));
    expect(result.map((r) => r.id)).toEqual(["a", "b", "c"]);
  });
});
