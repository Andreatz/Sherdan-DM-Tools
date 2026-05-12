import { describe, expect, it } from "vitest";

import { listPlayerEntitiesQuerySchema } from "@/lib/validation/player-entity-input";

const campaignId = "00000000-0000-4000-8000-000000000001";

describe("listPlayerEntitiesQuerySchema", () => {
  it("accepts an empty query: campaign_id arriva dal cookie in modalita' per-player; lo enforce e' nel route handler", () => {
    expect(listPlayerEntitiesQuerySchema.parse({})).toMatchObject({
      limit: 50,
      offset: 0,
      sort: "name_asc",
    });
  });

  it("accepts safe player-facing list filters", () => {
    expect(
      listPlayerEntitiesQuerySchema.parse({
        campaign_id: campaignId,
        type: "npc",
        search: "Sestante",
        limit: "25",
        offset: "0",
        sort: "updated_desc",
      }),
    ).toEqual({
      campaign_id: campaignId,
      type: "npc",
      search: "Sestante",
      limit: 25,
      offset: 0,
      sort: "updated_desc",
    });
  });

  it("rejects GM-only query controls", () => {
    expect(() =>
      listPlayerEntitiesQuerySchema.parse({
        campaign_id: campaignId,
        include_embedding: "true",
      }),
    ).toThrow();

    expect(() =>
      listPlayerEntitiesQuerySchema.parse({
        campaign_id: campaignId,
        tag: "gm-only",
      }),
    ).toThrow();
  });
});
