import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as createCampaign } from "@/app/api/campaigns/route";
import { POST as createEntity } from "@/app/api/entities/route";
import { POST as createPlayer } from "@/app/api/players/route";
import { POST as createOverride } from "@/app/api/player-visibility-overrides/route";
import { POST as login } from "@/app/api/player/access/login/route";
import { GET as realtimeToken } from "@/app/api/player/realtime-token/route";
import { auditLogs, playerVisibilityOverrides } from "@/db/schema";
import { cleanupOrphanPlayerVisibilityOverrides } from "@/lib/security/player-override-cleanup";

import {
  extractPlayerCookie,
  makeRequest,
  readJson,
  setupIntegrationDb,
  testDb,
} from "./_helpers";

const ACCESS_SECRET = "audit-test-secret";

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
}

interface EntityRow {
  id: string;
}

const NPC_PROPERTIES = {
  race: "Umano",
  appearance_summary: "Figura sintetica.",
  sensory_details: { sight: "Mantello scuro." },
  voice: { tone: "basso", speech_patterns: [] },
  tics: [],
  motivations: [],
  goals: {},
  weaknesses: [],
} as const;

async function makeCampaign(): Promise<CampaignRow> {
  const res = await createCampaign(
    makeRequest("/api/campaigns", {
      method: "POST",
      body: { name: "Audit Campaign" },
    }),
  );
  return readJson<CampaignRow>(res);
}

async function makePlayer(campaignId: string): Promise<PlayerRow> {
  const res = await createPlayer(
    makeRequest("/api/players", {
      method: "POST",
      body: { campaignId, name: "Alice", code: "alice-audit-code" },
    }),
  );
  return readJson<PlayerRow>(res);
}

async function makeEntity(campaignId: string): Promise<EntityRow> {
  const res = await createEntity(
    makeRequest("/api/entities", {
      method: "POST",
      body: {
        campaignId,
        type: "npc",
        name: "Mara Audit",
        visibility: "public",
        properties: NPC_PROPERTIES,
      },
    }),
  );
  return readJson<EntityRow>(res);
}

describe("integration: audit log e override cleanup", () => {
  it("persist player login, realtime token e override reveal/hide", async () => {
    const campaign = await makeCampaign();
    const player = await makePlayer(campaign.id);
    const entity = await makeEntity(campaign.id);

    const loginRes = await login(
      makeRequest("/api/player/access/login", {
        method: "POST",
        body: { code: "alice-audit-code" },
        headers: { "x-request-id": "audit-login-test" },
      }),
    );
    expect(loginRes.status).toBe(200);
    const cookie = extractPlayerCookie(loginRes);
    expect(cookie).not.toBeNull();

    const tokenRes = await realtimeToken(
      makeRequest(`/api/player/realtime-token?campaign_id=${campaign.id}`, {
        cookies: { sherdan_player_access: cookie! },
        headers: { "x-request-id": "audit-token-test" },
      }),
    );
    expect(tokenRes.status).toBe(200);

    const overrideRes = await createOverride(
      makeRequest("/api/player-visibility-overrides", {
        method: "POST",
        body: {
          playerId: player.id,
          targetType: "entity",
          targetId: entity.id,
          mode: "hidden",
        },
        headers: { "x-request-id": "audit-override-test" },
      }),
    );
    expect(overrideRes.status).toBe(201);

    const rows = await testDb
      .select({
        action: auditLogs.action,
        playerId: auditLogs.playerId,
        campaignId: auditLogs.campaignId,
        requestId: auditLogs.requestId,
      })
      .from(auditLogs);

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "player.login",
          playerId: player.id,
          campaignId: campaign.id,
          requestId: "audit-login-test",
        }),
        expect.objectContaining({
          action: "player.realtime_token",
          playerId: player.id,
          campaignId: campaign.id,
          requestId: "audit-token-test",
        }),
        expect.objectContaining({
          action: "player_visibility_override.create",
          playerId: player.id,
          campaignId: campaign.id,
          requestId: "audit-override-test",
        }),
      ]),
    );
  });

  it("cleanup rimuove override verso target polimorfici cancellati", async () => {
    const campaign = await makeCampaign();
    const player = await makePlayer(campaign.id);
    const missingTargetId = randomUUID();

    await createOverride(
      makeRequest("/api/player-visibility-overrides", {
        method: "POST",
        body: {
          playerId: player.id,
          targetType: "entity",
          targetId: missingTargetId,
          mode: "revealed",
        },
      }),
    );

    const dryRun = await cleanupOrphanPlayerVisibilityOverrides({ dryRun: true });
    expect(dryRun.orphanCount).toBe(1);
    expect(dryRun.deletedCount).toBe(0);

    const result = await cleanupOrphanPlayerVisibilityOverrides();
    expect(result.deletedCount).toBe(1);

    const remaining = await testDb
      .select({ id: playerVisibilityOverrides.id })
      .from(playerVisibilityOverrides)
      .where(eq(playerVisibilityOverrides.targetId, missingTargetId));
    expect(remaining).toEqual([]);
  });
});
