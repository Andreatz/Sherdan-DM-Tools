import { describe, expect, it } from "vitest";

import {
  projectCampaignForPlayer,
  projectCampaignsForPlayer,
  type PlayerCampaignSource,
} from "@/lib/security/player-campaigns";

const source: PlayerCampaignSource & Record<string, unknown> = {
  id: "campaign-1",
  name: "Sherdan",
  updatedAt: "2026-05-09T00:00:00.000Z",
  description: "Note GM da non esporre",
  settings: { hidden: true },
};

describe("projectCampaignForPlayer", () => {
  it("returns only the player-facing campaign contract", () => {
    expect(projectCampaignForPlayer(source)).toEqual({
      id: "campaign-1",
      name: "Sherdan",
      updatedAt: "2026-05-09T00:00:00.000Z",
    });
  });
});

describe("projectCampaignsForPlayer", () => {
  it("projects campaign lists", () => {
    expect(projectCampaignsForPlayer([source])).toEqual([
      {
        id: "campaign-1",
        name: "Sherdan",
        updatedAt: "2026-05-09T00:00:00.000Z",
      },
    ]);
  });
});
