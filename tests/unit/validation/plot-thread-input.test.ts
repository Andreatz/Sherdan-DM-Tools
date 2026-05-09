import { describe, expect, it } from "vitest";

import {
  createPlotThreadInputSchema,
  listPlotThreadsQuerySchema,
  normalizePlotThreadText,
  updatePlotThreadInputSchema,
} from "@/lib/validation/plot-thread-input";

const campaignId = "11111111-1111-4111-8111-111111111111";

describe("plot thread input validation", () => {
  it("accepts GM truth and public version separately", () => {
    const parsed = createPlotThreadInputSchema.parse({
      campaignId,
      title: "Il patto sotto Arborea",
      description: "La verita' GM: il patto nutre la citta'.",
      publicDescription: "Il party crede sia una disputa politica.",
      status: "hot",
      priority: "7",
      visibility: "dm_only",
    });

    expect(parsed.description).toContain("verita' GM");
    expect(parsed.publicDescription).toContain("party crede");
    expect(parsed.priority).toBe(7);
  });

  it("parses list filters and update payloads", () => {
    expect(
      listPlotThreadsQuerySchema.parse({
        campaign_id: campaignId,
        status: "warm",
      }),
    ).toMatchObject({ campaign_id: campaignId, status: "warm", limit: 100 });

    expect(
      updatePlotThreadInputSchema.parse({
        description: null,
        publicDescription: "Versione percepita.",
      }),
    ).toEqual({
      description: null,
      publicDescription: "Versione percepita.",
    });
  });

  it("normalizes blank optional text", () => {
    expect(normalizePlotThreadText("  testo  ")).toBe("testo");
    expect(normalizePlotThreadText("   ")).toBeNull();
  });
});
