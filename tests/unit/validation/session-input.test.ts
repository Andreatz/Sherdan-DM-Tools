import { describe, expect, it } from "vitest";

import {
  createSessionInputSchema,
  listSessionsQuerySchema,
  normalizeSessionText,
  updateSessionInputSchema,
} from "@/lib/validation/session-input";

const campaignId = "11111111-1111-4111-8111-111111111111";

describe("session input validation", () => {
  it("accepts create input without a manual number", () => {
    const parsed = createSessionInputSchema.parse({
      campaignId,
      title: "Sessione nelle rovine",
      date: "2026-05-09",
      recap: "Il party entra nelle rovine.",
      dmNotes: "La statua mente.",
      prepNotes: "Aprire con pioggia.",
    });

    expect(parsed.title).toBe("Sessione nelle rovine");
    expect(parsed.date).toBe("2026-05-09");
  });

  it("rejects manual numbering and malformed dates", () => {
    const result = createSessionInputSchema.safeParse({
      campaignId,
      number: 7,
      date: "09-05-2026",
    });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path.join("."))).toContain(
      "date",
    );
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "unrecognized_keys",
          keys: ["number"],
        }),
      ]),
    );
  });

  it("parses list defaults and normalizes optional markdown fields", () => {
    const query = listSessionsQuerySchema.parse({ campaign_id: campaignId });
    const patch = updateSessionInputSchema.parse({
      title: null,
      recap: "  ## Recap  ",
    });

    expect(query.limit).toBe(100);
    expect(query.include_notes).toBe(false);
    expect(patch.recap).toBe("## Recap");
    expect(normalizeSessionText("   ")).toBeNull();
  });
});
