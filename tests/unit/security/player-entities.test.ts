import { describe, expect, it } from "vitest";

import {
  projectEntitiesForPlayer,
  projectEntityForPlayer,
  type PlayerEntitySource,
} from "@/lib/security/player-entities";

const baseEntity: PlayerEntitySource = {
  id: "entity-1",
  campaignId: "campaign-1",
  type: "npc",
  name: "Sestante",
  publicDescription: "Automa antico conosciuto dal party.",
  parentId: null,
  visibility: "discovered",
  updatedAt: "2026-05-09T00:00:00.000Z",
};

describe("projectEntityForPlayer", () => {
  it("returns only the explicit player-facing entity contract", () => {
    const source = {
      ...baseEntity,
      description: "Verita' GM da non esporre",
      properties: { weaknesses: ["Spoiler"] },
      tags: ["vascello", "gm-only"],
      embedding: [0.1, 0.2],
      entitySecrets: [{ content: "Segreto" }],
      truthRevealed: "Rivelazione cosmica",
    } as PlayerEntitySource & Record<string, unknown>;

    expect(projectEntityForPlayer(source)).toEqual({
      id: "entity-1",
      campaignId: "campaign-1",
      type: "npc",
      name: "Sestante",
      description: "Automa antico conosciuto dal party.",
      parentId: null,
      visibility: "discovered",
      updatedAt: "2026-05-09T00:00:00.000Z",
    });
  });

  it("returns null for dm_only entities", () => {
    expect(
      projectEntityForPlayer({
        ...baseEntity,
        visibility: "dm_only",
        publicDescription: "Anche se presente, non deve uscire.",
      }),
    ).toBeNull();
  });

  it("normalizes missing public description to an empty string", () => {
    expect(
      projectEntityForPlayer({
        ...baseEntity,
        publicDescription: null,
        visibility: "public",
      }),
    ).toMatchObject({ description: "" });
  });
});

describe("projectEntitiesForPlayer", () => {
  it("filters unsafe entities from lists", () => {
    expect(
      projectEntitiesForPlayer([
        baseEntity,
        { ...baseEntity, id: "entity-2", visibility: "dm_only" },
        { ...baseEntity, id: "entity-3", visibility: "public" },
      ]),
    ).toEqual([
      expect.objectContaining({ id: "entity-1" }),
      expect.objectContaining({ id: "entity-3" }),
    ]);
  });
});
