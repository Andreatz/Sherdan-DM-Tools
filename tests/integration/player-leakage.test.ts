import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as createCampaign } from "@/app/api/campaigns/route";
import { POST as createEntity } from "@/app/api/entities/route";
import { POST as createPlayer } from "@/app/api/players/route";
import { POST as createOverride } from "@/app/api/player-visibility-overrides/route";
import { POST as login } from "@/app/api/player/access/login/route";
import { GET as listPlayerEntities } from "@/app/api/player/entities/route";
import { GET as getPlayerEntity } from "@/app/api/player/entities/[id]/route";

import {
  extractPlayerCookie,
  makeRequest,
  readJson,
  setupIntegrationDb,
} from "./_helpers";

const ACCESS_SECRET = "leakage-test-secret";

setupIntegrationDb();

beforeEach(() => {
  vi.stubEnv("SHERDAN_PLAYER_ACCESS_CODE", ACCESS_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

interface CampaignRow {
  id: string;
}
interface EntityRow {
  id: string;
  visibility: string;
}
interface PlayerRow {
  id: string;
  campaignId: string;
}

async function makeCampaign(name: string): Promise<CampaignRow> {
  const res = await createCampaign(
    makeRequest("/api/campaigns", { method: "POST", body: { name } }),
  );
  return readJson<CampaignRow>(res);
}

const NPC_PROPERTIES = {
  race: "Umano",
  appearance_summary: "Sguardo basso.",
  sensory_details: { sight: "Cicatrice." },
  voice: { tone: "basso", speech_patterns: [] },
  tics: [],
  motivations: [],
  goals: {},
  weaknesses: [],
} as const;

async function makeNpc(
  campaignId: string,
  name: string,
  visibility: "public" | "discovered" | "dm_only",
  description: string,
  publicDescription: string,
): Promise<EntityRow> {
  const res = await createEntity(
    makeRequest("/api/entities", {
      method: "POST",
      body: {
        campaignId,
        type: "npc",
        name,
        visibility,
        description,
        publicDescription,
        tags: ["gm-only-tag"],
        properties: NPC_PROPERTIES,
      },
    }),
  );
  expect(res.status).toBe(201);
  return readJson<EntityRow>(res);
}

async function makePlayer(
  campaignId: string,
  name: string,
  code: string,
): Promise<PlayerRow> {
  const res = await createPlayer(
    makeRequest("/api/players", {
      method: "POST",
      body: { campaignId, name, code },
    }),
  );
  return readJson<PlayerRow>(res);
}

async function loginAs(code: string): Promise<string> {
  const res = await login(
    makeRequest("/api/player/access/login", {
      method: "POST",
      body: { code },
    }),
  );
  expect(res.status).toBe(200);
  const cookie = extractPlayerCookie(res);
  expect(cookie).not.toBeNull();
  return cookie!;
}

const ALLOWED_ENTITY_KEYS = [
  "id",
  "campaignId",
  "type",
  "name",
  "description",
  "parentId",
  "visibility",
  "updatedAt",
];

describe("integration: player API leakage end-to-end", () => {
  it("list player entities: zero leakage di campi GM, dm_only escluso, scope di campagna applicato", async () => {
    const sherdan = await makeCampaign("Sherdan");
    const otherCampaign = await makeCampaign("Altra campagna");

    // Sherdan: 2 public + 1 dm_only.
    await makeNpc(
      sherdan.id,
      "NPC Pubblico",
      "public",
      "GM ONLY: backstabber",
      "Mercante taciturno",
    );
    await makeNpc(
      sherdan.id,
      "NPC Discovered",
      "discovered",
      "GM ONLY: trasformista",
      "Guida silenziosa",
    );
    await makeNpc(
      sherdan.id,
      "NPC Segreto",
      "dm_only",
      "GM ONLY: NON ESPORRE",
      "non visibile",
    );
    // Altra campagna: una entity pubblica che NON deve apparire.
    await makeNpc(
      otherCampaign.id,
      "Spy in altra campagna",
      "public",
      "GM",
      "pubblico",
    );

    await makePlayer(sherdan.id, "Alice", "alice-secret");
    const cookie = await loginAs("alice-secret");

    const listRes = await listPlayerEntities(
      makeRequest("/api/player/entities", {
        cookies: { sherdan_player_access: cookie },
      }),
    );
    expect(listRes.status).toBe(200);
    const rows = await readJson<Array<Record<string, unknown>>>(listRes);

    // Solo 2 visibili (public + discovered). Niente dm_only ne' altra campagna.
    expect(rows).toHaveLength(2);
    const names = rows.map((r) => r.name);
    expect(names.sort()).toEqual(["NPC Discovered", "NPC Pubblico"]);

    // Zero leakage: chiavi solo dell'allow-list player-safe.
    for (const row of rows) {
      const keys = Object.keys(row).sort();
      const allowed = new Set(ALLOWED_ENTITY_KEYS);
      const leaked = keys.filter((k) => !allowed.has(k));
      expect(leaked, `leaked keys: ${leaked.join(", ")}`).toEqual([]);
    }
  });

  it("scoping: cookie per Alice (Sherdan) rifiuta campaign_id di un'altra campagna", async () => {
    const sherdan = await makeCampaign("Sherdan");
    const other = await makeCampaign("Altra");
    await makePlayer(sherdan.id, "Alice", "alice-secret");
    const cookie = await loginAs("alice-secret");

    const res = await listPlayerEntities(
      makeRequest(`/api/player/entities?campaign_id=${other.id}`, {
        cookies: { sherdan_player_access: cookie },
      }),
    );
    expect(res.status).toBe(400);
    const body = await readJson<{ error: { code: string } }>(res);
    expect(body.error.code).toBe("bad_request");
  });

  it("override hidden: il giocatore non vede l'entita' anche se pubblica", async () => {
    const sherdan = await makeCampaign("Sherdan");
    const garrick = await makeNpc(
      sherdan.id,
      "Garrick",
      "public",
      "GM ONLY",
      "Mercante",
    );
    const alice = await makePlayer(sherdan.id, "Alice", "alice-secret");

    await createOverride(
      makeRequest("/api/player-visibility-overrides", {
        method: "POST",
        body: {
          playerId: alice.id,
          targetType: "entity",
          targetId: garrick.id,
          mode: "hidden",
        },
      }),
    );

    const cookie = await loginAs("alice-secret");
    const list = await listPlayerEntities(
      makeRequest("/api/player/entities", {
        cookies: { sherdan_player_access: cookie },
      }),
    );
    expect(await readJson<unknown[]>(list)).toEqual([]);

    const detail = await getPlayerEntity(
      makeRequest(`/api/player/entities/${garrick.id}`, {
        cookies: { sherdan_player_access: cookie },
      }),
      { params: Promise.resolve({ id: garrick.id }) },
    );
    expect(detail.status).toBe(404);
  });

  it("override revealed: il giocatore vede un'entita' dm_only", async () => {
    const sherdan = await makeCampaign("Sherdan");
    const segreto = await makeNpc(
      sherdan.id,
      "NPC Segreto",
      "dm_only",
      "GM ONLY",
      "(nessuna versione pubblica)",
    );
    const alice = await makePlayer(sherdan.id, "Alice", "alice-secret");

    await createOverride(
      makeRequest("/api/player-visibility-overrides", {
        method: "POST",
        body: {
          playerId: alice.id,
          targetType: "entity",
          targetId: segreto.id,
          mode: "revealed",
        },
      }),
    );

    const cookie = await loginAs("alice-secret");
    const list = await listPlayerEntities(
      makeRequest("/api/player/entities", {
        cookies: { sherdan_player_access: cookie },
      }),
    );
    const rows = await readJson<Array<Record<string, unknown>>>(list);
    expect(rows.map((r) => r.name)).toEqual(["NPC Segreto"]);
    // La proiezione marca l'entita' come "discovered" per non rompere il
    // contratto player-safe anche se in DB e' dm_only.
    expect(rows[0]?.visibility).toBe("discovered");

    const detail = await getPlayerEntity(
      makeRequest(`/api/player/entities/${segreto.id}`, {
        cookies: { sherdan_player_access: cookie },
      }),
      { params: Promise.resolve({ id: segreto.id }) },
    );
    expect(detail.status).toBe(200);
  });

  it("nessun cookie -> 401", async () => {
    const res = await listPlayerEntities(
      makeRequest("/api/player/entities"),
    );
    expect(res.status).toBe(401);
  });
});
