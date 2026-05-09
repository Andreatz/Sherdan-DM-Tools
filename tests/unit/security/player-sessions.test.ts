import { describe, expect, it } from "vitest";

import {
  projectSessionRecapForPlayer,
  projectSessionRecapsForPlayer,
  type PlayerSessionSource,
} from "@/lib/security/player-sessions";

const source: PlayerSessionSource & Record<string, unknown> = {
  id: "session-1",
  campaignId: "campaign-1",
  number: 6,
  title: "Sessione 6",
  date: "2026-04-18",
  recap: "Il party lascia la cripta con nuove cicatrici e nuove domande.",
  updatedAt: "2026-05-09T00:00:00.000Z",
  dmNotes: "Segreto GM da non esporre",
  prepNotes: "Prep privata da non esporre",
};

describe("projectSessionRecapForPlayer", () => {
  it("returns only the player-facing recap contract", () => {
    expect(projectSessionRecapForPlayer(source)).toEqual({
      id: "session-1",
      campaignId: "campaign-1",
      number: 6,
      title: "Sessione 6",
      date: "2026-04-18",
      recap: "Il party lascia la cripta con nuove cicatrici e nuove domande.",
      updatedAt: "2026-05-09T00:00:00.000Z",
    });
  });

  it("falls back to Sessione N when the title is missing", () => {
    expect(
      projectSessionRecapForPlayer({
        ...source,
        title: null,
      }),
    ).toMatchObject({ title: "Sessione 6" });
  });

  it("omits sessions without public recap text", () => {
    expect(projectSessionRecapForPlayer({ ...source, recap: "   " })).toBeNull();
    expect(projectSessionRecapForPlayer({ ...source, recap: null })).toBeNull();
  });
});

describe("projectSessionRecapsForPlayer", () => {
  it("filters sessions without public recaps", () => {
    expect(
      projectSessionRecapsForPlayer([
        source,
        { ...source, id: "session-2", recap: null },
        { ...source, id: "session-3", recap: "Altro recap pubblico." },
      ]),
    ).toEqual([
      expect.objectContaining({ id: "session-1" }),
      expect.objectContaining({ id: "session-3" }),
    ]);
  });
});
