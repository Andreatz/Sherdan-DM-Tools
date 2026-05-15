import { describe, expect, it } from "vitest";

import { listEntitiesQuerySchema } from "@/lib/validation/entity-input";

const campaignId = "11111111-1111-4111-8111-111111111111";

describe("entity input validation", () => {
  it("accepts the full campaign workbench list size", () => {
    expect(
      listEntitiesQuerySchema.parse({
        campaign_id: campaignId,
        sort: "name_asc",
        limit: "500",
      }),
    ).toMatchObject({
      campaign_id: campaignId,
      sort: "name_asc",
      limit: 500,
      offset: 0,
    });
  });

  it("rejects list sizes beyond the workbench cap", () => {
    expect(() => listEntitiesQuerySchema.parse({ limit: "501" })).toThrow();
  });
});
