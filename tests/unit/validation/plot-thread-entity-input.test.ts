import { describe, expect, it } from "vitest";

import {
  createPlotThreadEntityInputSchema,
  listPlotThreadEntitiesQuerySchema,
  normalizePlotThreadEntityNotes,
  updatePlotThreadEntityInputSchema,
} from "@/lib/validation/plot-thread-entity-input";

const plotThreadId = "11111111-1111-4111-8111-111111111111";
const entityId = "22222222-2222-4222-8222-222222222222";

describe("plot thread entity input validation", () => {
  it("accepts explicit plot roles", () => {
    expect(
      createPlotThreadEntityInputSchema.parse({
        plotThreadId,
        entityId,
        role: "instigator",
        notes: "Ha acceso il conflitto.",
      }),
    ).toEqual({
      plotThreadId,
      entityId,
      role: "instigator",
      notes: "Ha acceso il conflitto.",
    });
  });

  it("rejects roles outside the narrative vocabulary", () => {
    const result = createPlotThreadEntityInputSchema.safeParse({
      plotThreadId,
      entityId,
      role: "ally",
    });

    expect(result.success).toBe(false);
  });

  it("parses list and update payloads", () => {
    expect(
      listPlotThreadEntitiesQuerySchema.parse({ plot_thread_id: plotThreadId }),
    ).toMatchObject({ plot_thread_id: plotThreadId, limit: 100 });

    expect(
      updatePlotThreadEntityInputSchema.parse({
        role: "witness",
        notes: "Ha visto troppo.",
      }),
    ).toEqual({ role: "witness", notes: "Ha visto troppo." });

    expect(normalizePlotThreadEntityNotes("  ")).toBeNull();
  });
});
