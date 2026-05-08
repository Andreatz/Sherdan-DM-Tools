import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import {
  createRandomTableInputSchema,
  listRandomTablesQuerySchema,
  updateRandomTableInputSchema,
} from "@/lib/validation/random-table-input";

describe("random table input validation", () => {
  it("normalizes create input and entries", () => {
    const input = createRandomTableInputSchema.parse({
      name: "Taverne",
      entries: [
        { value: "La Lanterna", weight: 2 },
        { value: "Oste {name}", template_vars: { name: "names" } },
      ],
      tags: ["urban", "sherdan"],
    });

    expect(input).toEqual({
      name: "Taverne",
      entries: [
        {
          label: null,
          value: "La Lanterna",
          weight: 2,
          subTableId: null,
          templateVars: {},
        },
        {
          label: null,
          value: "Oste {name}",
          weight: 1,
          subTableId: null,
          templateVars: { name: "names" },
        },
      ],
      tags: ["urban", "sherdan"],
    });
  });

  it("accepts nullable campaign and description fields", () => {
    const input = updateRandomTableInputSchema.parse({
      campaignId: null,
      description: null,
    });

    expect(input).toEqual({
      campaignId: null,
      description: null,
    });
  });

  it("rejects invalid entries", () => {
    expect(() =>
      createRandomTableInputSchema.parse({
        name: "Broken",
        entries: [{ label: "no value" }],
      }),
    ).toThrow(ZodError);
  });

  it("parses list query defaults", () => {
    expect(listRandomTablesQuerySchema.parse({})).toEqual({
      sort: "name_asc",
      limit: 50,
      offset: 0,
    });
    expect(
      listRandomTablesQuerySchema.parse({
        limit: "10",
        offset: "5",
        sort: "updated_desc",
      }),
    ).toMatchObject({
      sort: "updated_desc",
      limit: 10,
      offset: 5,
    });
  });
});
