import { describe, expect, it } from "vitest";

import {
  materializeRandomTableSeedEntries,
  randomTableSeedDefinitions,
} from "@/lib/random-tables/seed-data";

describe("random table seed data", () => {
  it("defines at least twenty public/Sherdan tables with unique keys and names", () => {
    const keys = new Set(randomTableSeedDefinitions.map((definition) => definition.key));
    const names = new Set(randomTableSeedDefinitions.map((definition) => definition.name));

    expect(randomTableSeedDefinitions.length).toBeGreaterThanOrEqual(20);
    expect(keys.size).toBe(randomTableSeedDefinitions.length);
    expect(names.size).toBe(randomTableSeedDefinitions.length);
    expect(randomTableSeedDefinitions.some((definition) => definition.scope === "global")).toBe(
      true,
    );
    expect(randomTableSeedDefinitions.some((definition) => definition.scope === "sherdan")).toBe(
      true,
    );
  });

  it("materializes every definition into valid roller entries", () => {
    const idByKey = new Map(
      randomTableSeedDefinitions.map((definition) => [
        definition.key,
        `00000000-0000-4000-8000-${definition.key.slice(0, 12).padEnd(12, "0")}`,
      ]),
    );

    for (const definition of randomTableSeedDefinitions) {
      expect(materializeRandomTableSeedEntries(definition, idByKey).length).toBeGreaterThan(0);
    }
  });

  it("includes nested and template-driven seeds", () => {
    expect(
      randomTableSeedDefinitions.some((definition) =>
        definition.entries.some((entry) => entry.subTableKey),
      ),
    ).toBe(true);
    expect(
      randomTableSeedDefinitions.some((definition) =>
        definition.entries.some((entry) => entry.templateVarKeys),
      ),
    ).toBe(true);
  });
});
