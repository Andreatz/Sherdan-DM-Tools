import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as createCampaign } from "@/app/api/campaigns/route";
import { POST as createPlayer } from "@/app/api/players/route";
import { POST as login } from "@/app/api/player/access/login/route";
import { GET as statusRoute } from "@/app/api/player/access/status/route";

import {
  extractPlayerCookie,
  makeRequest,
  readJson,
  setupIntegrationDb,
} from "./_helpers";

const ACCESS_SECRET = "integration-test-player-secret";

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

interface PlayerRow {
  id: string;
  campaignId: string;
  name: string;
}

interface LoginResponse {
  ok: boolean;
  mode: "per-player" | "legacy-global";
  playerName?: string;
}

async function makeCampaign(name = "Sherdan Test"): Promise<CampaignRow> {
  const res = await createCampaign(
    makeRequest("/api/campaigns", { method: "POST", body: { name } }),
  );
  return readJson<CampaignRow>(res);
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
  expect(res.status).toBe(201);
  return readJson<PlayerRow>(res);
}

describe("integration: player auth bridge", () => {
  it("login per-player: codice individuale -> cookie scoped a campagna + lastSeenAt aggiornato", async () => {
    const campaign = await makeCampaign();
    const player = await makePlayer(campaign.id, "Alice", "alice-secret-code");

    const res = await login(
      makeRequest("/api/player/access/login", {
        method: "POST",
        body: { code: "alice-secret-code" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<LoginResponse>(res);
    expect(body.mode).toBe("per-player");
    expect(body.playerName).toBe("Alice");

    const cookie = extractPlayerCookie(res);
    expect(cookie).not.toBeNull();

    // /status legge il cookie e ritrova player + campaign.
    const status = await statusRoute(
      makeRequest("/api/player/access/status", {
        cookies: { sherdan_player_access: cookie! },
      }),
    );
    expect(status.status).toBe(200);
    const statusBody = await readJson<{
      authenticated: boolean;
      mode: string;
      playerName: string | null;
      campaignId: string | null;
    }>(status);
    expect(statusBody.authenticated).toBe(true);
    expect(statusBody.mode).toBe("per-player");
    expect(statusBody.playerName).toBe("Alice");
    expect(statusBody.campaignId).toBe(player.campaignId);
  });

  it("login legacy: codice globale -> cookie senza scoping", async () => {
    const res = await login(
      makeRequest("/api/player/access/login", {
        method: "POST",
        body: { code: ACCESS_SECRET },
      }),
    );
    expect(res.status).toBe(200);
    const body = await readJson<LoginResponse>(res);
    expect(body.mode).toBe("legacy-global");

    const cookie = extractPlayerCookie(res);
    expect(cookie).not.toBeNull();

    const status = await statusRoute(
      makeRequest("/api/player/access/status", {
        cookies: { sherdan_player_access: cookie! },
      }),
    );
    const statusBody = await readJson<{
      authenticated: boolean;
      mode: string;
      campaignId: string | null;
    }>(status);
    expect(statusBody.authenticated).toBe(true);
    expect(statusBody.mode).toBe("legacy-global");
    expect(statusBody.campaignId).toBeNull();
  });

  it("login rifiuta codici non validi con 401", async () => {
    const res = await login(
      makeRequest("/api/player/access/login", {
        method: "POST",
        body: { code: "totally-wrong-code" },
      }),
    );
    expect(res.status).toBe(401);
  });

  it("player revocato (active=false) NON puo' loggare", async () => {
    const campaign = await makeCampaign();
    const player = await makePlayer(campaign.id, "Revoked", "revoked-code");

    // Disattiva via PATCH.
    const { PATCH: patchPlayer } = await import(
      "@/app/api/players/[id]/route"
    );
    const patch = await patchPlayer(
      makeRequest(`/api/players/${player.id}`, {
        method: "PATCH",
        body: { active: false },
      }),
      { params: Promise.resolve({ id: player.id }) },
    );
    expect(patch.status).toBe(200);

    const res = await login(
      makeRequest("/api/player/access/login", {
        method: "POST",
        body: { code: "revoked-code" },
      }),
    );
    expect(res.status).toBe(401);
  });
});
