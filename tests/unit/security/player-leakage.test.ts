import { describe, expect, it } from "vitest";

import { projectCampaignsForPlayer } from "@/lib/security/player-campaigns";
import {
  projectEntitiesForPlayer,
  projectEntityForPlayer,
} from "@/lib/security/player-entities";
import {
  projectSessionRecapForPlayer,
  projectSessionRecapsForPlayer,
} from "@/lib/security/player-sessions";

// Test di leakage: forziamo input "sporchi" (con campi GM che non
// dovrebbero mai uscire dalle proiezioni) e verifichiamo che lo schema di
// output non li contenga. Sono complementari ai test di proiezione
// funzionale gia' presenti.

// Approccio leakage: ogni proiezione player ha un set rigido di chiavi
// permesse. Tutte le altre — soprattutto i campi GM-only come `dmNotes`,
// `tags`, `properties`, `embedding`, `secrets`, `identities`, `truthClues`,
// `prepNotes`, `publicDescription` (gia' rinominato in `description`) —
// devono essere assenti, anche se l'input le contiene per errore.
const ENTITY_ALLOWED_KEYS = [
  "id",
  "campaignId",
  "type",
  "name",
  "description",
  "parentId",
  "visibility",
  "updatedAt",
];

const SESSION_ALLOWED_KEYS = [
  "id",
  "campaignId",
  "number",
  "title",
  "date",
  "recap",
  "updatedAt",
];

const CAMPAIGN_ALLOWED_KEYS = ["id", "name", "updatedAt"];

const ALLOWED_VISIBILITIES = new Set(["public", "discovered"]);

describe("player projection leakage", () => {
  it("entity projection only emits the player-safe contract, never raw GM fields", () => {
    const dirty = {
      id: "11111111-1111-4111-8111-111111111111",
      campaignId: "22222222-2222-4222-8222-222222222222",
      type: "npc",
      name: "Garrick il Sussurratore",
      description: "GM ONLY: spia di Tharros, pronto a tradire",
      publicDescription: "Mercante taciturno con un cappello largo",
      parentId: null,
      tags: ["spia", "informatore-segreto"],
      properties: {
        secrets: ["e' un infiltrato"],
        weaknesses: [{ description: "ha paura del fuoco" }],
      },
      visibility: "public" as const,
      updatedAt: new Date("2026-05-12T10:00:00Z"),
      // Campo extra non previsto dal contratto: deve essere scartato.
      embedding: new Array(1024).fill(0),
    };

    const projected = projectEntityForPlayer(dirty)!;
    assertOnlyKeys(projected, ENTITY_ALLOWED_KEYS);
    expect(projected.visibility).toBe("public");
    expect(projected.description).toBe(dirty.publicDescription);
  });

  it("entity projection drops dm_only entities entirely", () => {
    const hidden = projectEntityForPlayer({
      id: "11111111-1111-4111-8111-111111111111",
      campaignId: "22222222-2222-4222-8222-222222222222",
      type: "npc",
      name: "Malakor (Vera Forma)",
      publicDescription: null,
      parentId: null,
      visibility: "dm_only" as const,
      updatedAt: new Date(),
    });
    expect(hidden).toBeNull();
  });

  it("entity list projection filters dm_only rows and never leaks forbidden keys", () => {
    const rows = projectEntitiesForPlayer([
      {
        id: "a",
        campaignId: "c",
        type: "npc",
        name: "Pubblica",
        publicDescription: "ok",
        parentId: null,
        visibility: "public",
        updatedAt: new Date(),
      },
      {
        id: "b",
        campaignId: "c",
        type: "npc",
        name: "Scoperta",
        publicDescription: "ok",
        parentId: null,
        visibility: "discovered",
        updatedAt: new Date(),
      },
      {
        id: "c",
        campaignId: "c",
        type: "npc",
        name: "GM-only",
        publicDescription: "non dovrebbe uscire",
        parentId: null,
        visibility: "dm_only",
        updatedAt: new Date(),
      },
    ]);
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      assertOnlyKeys(row, ENTITY_ALLOWED_KEYS);
      expect(ALLOWED_VISIBILITIES.has(row.visibility)).toBe(true);
    }
  });

  it("session recap projection strips dmNotes and prepNotes even when present in input", () => {
    const dirty = {
      id: "11111111-1111-4111-8111-111111111111",
      campaignId: "22222222-2222-4222-8222-222222222222",
      number: 5,
      title: "Sessione 5",
      date: "2026-05-05",
      recap: "Il party scopre la stanza nascosta.",
      // Volutamente passiamo campi GM che non sono nel contratto:
      // devono essere ignorati silenziosamente.
      updatedAt: new Date(),
    };

    const projected = projectSessionRecapForPlayer({
      ...dirty,
      dmNotes: "GM ONLY: Malakor era nascosto",
      prepNotes: "GM ONLY: preparato per la prossima escalation",
    } as Parameters<typeof projectSessionRecapForPlayer>[0]);

    expect(projected).not.toBeNull();
    assertOnlyKeys(projected!, SESSION_ALLOWED_KEYS);
    expect(projected!.recap).toBe(dirty.recap);
  });

  it("session recap list drops sessions without recap and never leaks forbidden keys", () => {
    const rows = projectSessionRecapsForPlayer([
      {
        id: "a",
        campaignId: "c",
        number: 1,
        title: "Inizio",
        date: null,
        recap: "ok",
        updatedAt: new Date(),
      },
      {
        id: "b",
        campaignId: "c",
        number: 2,
        title: "Sessione cancellata",
        date: null,
        recap: null,
        updatedAt: new Date(),
      },
      {
        id: "c",
        campaignId: "c",
        number: 3,
        title: "   ",
        date: null,
        recap: "   ",
        updatedAt: new Date(),
      },
    ]);
    expect(rows).toHaveLength(1);
    assertOnlyKeys(rows[0]!, SESSION_ALLOWED_KEYS);
  });

  it("campaign list never leaks description / settings / embeddings", () => {
    const rows = projectCampaignsForPlayer([
      // Cast tramite unknown per simulare un input "sporco" che il route
      // potrebbe inavvertitamente passare al projector.
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Sherdan",
        updatedAt: new Date(),
      } as unknown as Parameters<typeof projectCampaignsForPlayer>[0][number],
    ]);
    expect(rows).toHaveLength(1);
    for (const row of rows) {
      assertOnlyKeys(row, CAMPAIGN_ALLOWED_KEYS);
    }
  });
});

function assertOnlyKeys(obj: object, allowed: readonly string[]): void {
  const keys = Object.keys(obj).sort();
  const allowedSet = new Set(allowed);
  const leaked = keys.filter((k) => !allowedSet.has(k));
  expect(
    leaked,
    `proiezione player ha leakato chiavi non previste: ${leaked.join(", ") || "(nessuna)"}; permesse: ${allowed.join(", ")}`,
  ).toEqual([]);
}
