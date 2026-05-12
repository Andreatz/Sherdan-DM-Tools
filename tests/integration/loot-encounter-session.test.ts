import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { POST as createCampaign } from "@/app/api/campaigns/route";
import { POST as createEntity } from "@/app/api/entities/route";
import { POST as createPlotThread } from "@/app/api/plot-threads/route";
import { POST as createSession } from "@/app/api/sessions/route";
import { POST as createEncounter, GET as listEncounters } from "@/app/api/encounters/route";
import { GET as listLootBundles } from "@/app/api/loot-bundles/route";
import { lootBundles } from "@/db/schema";

import {
  makeRequest,
  readJson,
  setupIntegrationDb,
  testDb,
} from "./_helpers";

setupIntegrationDb();

interface CampaignRow { id: string; }
interface EntityRow { id: string; }
interface SessionRow { id: string; number: number; }
interface PlotThreadRow { id: string; }
interface EncounterCreateResponse { encounter: { id: string; usedInSession: string | null }; }

async function makeCampaign(): Promise<CampaignRow> {
  const res = await createCampaign(
    makeRequest("/api/campaigns", { method: "POST", body: { name: "Sherdan" } }),
  );
  return readJson<CampaignRow>(res);
}

async function makeLocation(campaignId: string, name = "Lunacupa"): Promise<EntityRow> {
  const res = await createEntity(
    makeRequest("/api/entities", {
      method: "POST",
      body: {
        campaignId,
        type: "location",
        name,
        properties: { kind: "city" },
      },
    }),
  );
  expect(res.status).toBe(201);
  return readJson<EntityRow>(res);
}

async function makeMonster(campaignId: string, name: string): Promise<EntityRow> {
  const res = await createEntity(
    makeRequest("/api/entities", {
      method: "POST",
      body: {
        campaignId,
        type: "monster",
        name,
        properties: {
          size: "small",
          creature_type: "humanoid",
          ac: 15,
          hp_average: 7,
          speed: { walk: 30 },
          abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
          challenge_rating: "1/4",
          xp: 50,
        },
      },
    }),
  );
  expect(res.status).toBe(201);
  return readJson<EntityRow>(res);
}

async function makeSession(campaignId: string): Promise<SessionRow> {
  const res = await createSession(
    makeRequest("/api/sessions", {
      method: "POST",
      body: { campaignId, title: "S1" },
    }),
  );
  expect(res.status).toBe(201);
  return readJson<SessionRow>(res);
}

async function makePlotThread(campaignId: string): Promise<PlotThreadRow> {
  const res = await createPlotThread(
    makeRequest("/api/plot-threads", {
      method: "POST",
      body: { campaignId, title: "Arc" },
    }),
  );
  return readJson<PlotThreadRow>(res);
}

describe("integration: loot bundles + encounters x sessione", () => {
  it("encounter list filtra per used_in_session, location_id, plot_thread_id", async () => {
    const campaign = await makeCampaign();
    const location = await makeLocation(campaign.id);
    const otherLocation = await makeLocation(campaign.id, "Tharros");
    const monster = await makeMonster(campaign.id, "Goblin");
    const session = await makeSession(campaign.id);
    const thread = await makePlotThread(campaign.id);

    const encA = await createEncounter(
      makeRequest("/api/encounters", {
        method: "POST",
        body: {
          campaignId: campaign.id,
          title: "Imboscata banditi",
          locationId: location.id,
          plotThreadId: thread.id,
          usedInSession: session.id,
          partyLevel: 3,
          xpTotal: 200,
          participants: [{ entityId: monster.id, count: 4 }],
        },
      }),
    );
    expect(encA.status).toBe(201);
    await createEncounter(
      makeRequest("/api/encounters", {
        method: "POST",
        body: {
          campaignId: campaign.id,
          title: "Goblin alla porta",
          locationId: otherLocation.id,
          partyLevel: 3,
          xpTotal: 50,
          participants: [{ entityId: monster.id, count: 1 }],
        },
      }),
    );

    const all = await listEncounters(
      makeRequest(`/api/encounters?campaign_id=${campaign.id}`),
    );
    expect((await readJson<unknown[]>(all)).length).toBe(2);

    const bySession = await listEncounters(
      makeRequest(
        `/api/encounters?campaign_id=${campaign.id}&used_in_session=${session.id}`,
      ),
    );
    const sessionRows = await readJson<Array<{ title: string }>>(bySession);
    expect(sessionRows.map((r) => r.title)).toEqual(["Imboscata banditi"]);

    const byLocation = await listEncounters(
      makeRequest(
        `/api/encounters?campaign_id=${campaign.id}&location_id=${otherLocation.id}`,
      ),
    );
    expect((await readJson<unknown[]>(byLocation)).length).toBe(1);

    const byThread = await listEncounters(
      makeRequest(
        `/api/encounters?campaign_id=${campaign.id}&plot_thread_id=${thread.id}`,
      ),
    );
    expect((await readJson<unknown[]>(byThread)).length).toBe(1);
  });

  it("loot-bundles list filtra per encounter_id e session_id", async () => {
    const campaign = await makeCampaign();
    const location = await makeLocation(campaign.id);
    const monster = await makeMonster(campaign.id, "Goblin");
    const session1 = await makeSession(campaign.id);
    const session2 = await makeSession(campaign.id);

    const encRes = await createEncounter(
      makeRequest("/api/encounters", {
        method: "POST",
        body: {
          campaignId: campaign.id,
          title: "Test",
          locationId: location.id,
          participants: [{ entityId: monster.id, count: 1 }],
        },
      }),
    );
    const enc = (await readJson<EncounterCreateResponse>(encRes)).encounter;

    // Inseriamo loot bundle direttamente: la save route richiede una
    // pipeline LLM che non vogliamo in test integration.
    await testDb.insert(lootBundles).values([
      {
        campaignId: campaign.id,
        title: "Bundle A",
        goldAmount: 50,
        items: [],
        encounterId: enc.id,
        sessionId: session1.id,
      },
      {
        campaignId: campaign.id,
        title: "Bundle B",
        goldAmount: 10,
        items: [],
        encounterId: null,
        sessionId: session2.id,
      },
      {
        campaignId: campaign.id,
        title: "Bundle C orphan",
        goldAmount: 5,
        items: [],
        encounterId: null,
        sessionId: null,
      },
    ]);

    const all = await listLootBundles(
      makeRequest(`/api/loot-bundles?campaign_id=${campaign.id}`),
    );
    expect((await readJson<unknown[]>(all)).length).toBe(3);

    const byEnc = await listLootBundles(
      makeRequest(
        `/api/loot-bundles?campaign_id=${campaign.id}&encounter_id=${enc.id}`,
      ),
    );
    expect((await readJson<Array<{ title: string }>>(byEnc)).map((b) => b.title)).toEqual([
      "Bundle A",
    ]);

    const bySession = await listLootBundles(
      makeRequest(
        `/api/loot-bundles?campaign_id=${campaign.id}&session_id=${session2.id}`,
      ),
    );
    expect((await readJson<Array<{ title: string }>>(bySession)).map((b) => b.title)).toEqual([
      "Bundle B",
    ]);
  });

  it("non leakka loot di un'altra campagna", async () => {
    const a = await makeCampaign();
    const b = await makeCampaign();
    await testDb.insert(lootBundles).values([
      {
        campaignId: a.id,
        title: "From A",
        goldAmount: 50,
        items: [],
      },
      {
        campaignId: b.id,
        title: "From B",
        goldAmount: 100,
        items: [],
      },
    ]);

    const res = await listLootBundles(
      makeRequest(`/api/loot-bundles?campaign_id=${a.id}`),
    );
    const rows = await readJson<Array<{ title: string }>>(res);
    expect(rows.map((r) => r.title)).toEqual(["From A"]);

    // Sanity: il record di b esiste comunque nel DB.
    const stillThere = await testDb
      .select({ title: lootBundles.title })
      .from(lootBundles)
      .where(eq(lootBundles.campaignId, b.id));
    expect(stillThere.map((r) => r.title)).toEqual(["From B"]);
  });
});
