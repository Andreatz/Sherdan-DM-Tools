import { describe, expect, it } from "vitest";

import {
  createTruthClueInputSchema,
  listTruthCluesQuerySchema,
  normalizeTruthClueText,
  truthClueDashboardQuerySchema,
  updateTruthClueInputSchema,
} from "@/lib/validation/truth-clue-input";

const campaignId = "11111111-1111-4111-8111-111111111111";
const plotThreadId = "22222222-2222-4222-8222-222222222222";
const sessionId = "33333333-3333-4333-8333-333333333333";
const entityIdA = "44444444-4444-4444-8444-444444444444";
const entityIdB = "55555555-5555-4555-8555-555555555555";

describe("truth clue input validation", () => {
  it("accepts a fully populated create payload", () => {
    const parsed = createTruthClueInputSchema.parse({
      campaignId,
      description: "Una moneta nera incrostata cade dal mantello del nobile.",
      truthRevealed: "Il nobile e' un agente dell'Eclissi.",
      relatedPlotThreadId: plotThreadId,
      relatedEntities: [entityIdA, entityIdB],
      plantedInSession: sessionId,
      status: "noticed",
      statusNotes: "Hanno notato la moneta ma non l'hanno riconosciuta.",
    });

    expect(parsed.status).toBe("noticed");
    expect(parsed.relatedEntities).toEqual([entityIdA, entityIdB]);
  });

  it("defaults status to 'planted' when omitted", () => {
    const parsed = createTruthClueInputSchema.parse({
      campaignId,
      description: "Un sigillo strano e' inciso sul muro.",
      truthRevealed: "E' il marchio della Setta.",
    });
    expect(parsed.status).toBe("planted");
    expect(parsed.relatedEntities).toBeUndefined();
  });

  it("rejects empty description/truth", () => {
    expect(() =>
      createTruthClueInputSchema.parse({
        campaignId,
        description: "   ",
        truthRevealed: "x",
      }),
    ).toThrow();
    expect(() =>
      createTruthClueInputSchema.parse({
        campaignId,
        description: "x",
        truthRevealed: "",
      }),
    ).toThrow();
  });

  it("update schema accepts partial payloads and explicit nulls", () => {
    expect(
      updateTruthClueInputSchema.parse({
        status: "understood",
        statusNotes: null,
        relatedPlotThreadId: null,
        plantedInSession: null,
      }),
    ).toEqual({
      status: "understood",
      statusNotes: null,
      relatedPlotThreadId: null,
      plantedInSession: null,
    });
  });

  it("list query supports filters and clamps limits", () => {
    expect(
      listTruthCluesQuerySchema.parse({
        campaign_id: campaignId,
        status: "lost",
        related_plot_thread_id: plotThreadId,
        planted_in_session: sessionId,
        related_entity_id: entityIdA,
        limit: "50",
      }),
    ).toMatchObject({
      campaign_id: campaignId,
      status: "lost",
      related_plot_thread_id: plotThreadId,
      planted_in_session: sessionId,
      related_entity_id: entityIdA,
      limit: 50,
      offset: 0,
    });
  });

  it("dashboard query requires campaign_id", () => {
    expect(truthClueDashboardQuerySchema.parse({ campaign_id: campaignId }))
      .toEqual({ campaign_id: campaignId });
    expect(() => truthClueDashboardQuerySchema.parse({})).toThrow();
  });

  it("normalizes optional status notes text", () => {
    expect(normalizeTruthClueText("  trovata  ")).toBe("trovata");
    expect(normalizeTruthClueText("")).toBeNull();
    expect(normalizeTruthClueText(null)).toBeNull();
    expect(normalizeTruthClueText(undefined)).toBeNull();
  });
});
