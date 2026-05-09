import { describe, expect, it } from "vitest";

import {
  createPlotThreadEventInputSchema,
  listPlotThreadEventsQuerySchema,
  normalizePlotThreadEventText,
  updatePlotThreadEventInputSchema,
} from "@/lib/validation/plot-thread-event-input";

const plotThreadId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";

describe("plot thread event input validation", () => {
  it("accepts timeline events with public and GM descriptions", () => {
    const parsed = createPlotThreadEventInputSchema.parse({
      plotThreadId,
      sessionId,
      eventType: "public_reveal",
      description: "La verita' GM avanza.",
      publicDescription: "Il party scopre un simbolo.",
      occurredAt: "2026-05-09T10:00:00.000Z",
    });

    expect(parsed.eventType).toBe("public_reveal");
    expect(parsed.occurredAt).toBeInstanceOf(Date);
  });

  it("parses list filters and update payloads", () => {
    expect(
      listPlotThreadEventsQuerySchema.parse({ plot_thread_id: plotThreadId }),
    ).toMatchObject({ plot_thread_id: plotThreadId, limit: 100 });

    expect(
      updatePlotThreadEventInputSchema.parse({
        sessionId: null,
        publicDescription: null,
      }),
    ).toEqual({ sessionId: null, publicDescription: null });
  });

  it("normalizes blank optional text", () => {
    expect(normalizePlotThreadEventText("  evento  ")).toBe("evento");
    expect(normalizePlotThreadEventText("")).toBeNull();
  });
});
