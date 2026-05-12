import { describe, expect, it } from "vitest";

import { POST as createCampaign } from "@/app/api/campaigns/route";
import {
  GET as listEntities,
  POST as createEntity,
} from "@/app/api/entities/route";
import {
  GET as getEntity,
  PATCH as patchEntity,
  DELETE as deleteEntity,
} from "@/app/api/entities/[id]/route";

import { makeRequest, readJson, setupIntegrationDb } from "./_helpers";

setupIntegrationDb();

interface CampaignRow {
  id: string;
  name: string;
}

interface EntityRow {
  id: string;
  campaignId: string;
  type: string;
  name: string;
  description: string | null;
  publicDescription: string | null;
  properties: unknown;
  tags: string[];
  visibility: string;
  parentId: string | null;
}

async function makeCampaign(name = "Sherdan Test"): Promise<CampaignRow> {
  const res = await createCampaign(
    makeRequest("/api/campaigns", { method: "POST", body: { name } }),
  );
  return readJson<CampaignRow>(res);
}

const validNpcProperties = {
  race: "Umano",
  appearance_summary: "Mantello scuro, occhi che evitano lo sguardo.",
  sensory_details: {
    sight: "Cicatrice sotto l'occhio sinistro.",
    smell: "Tabacco da pipa.",
  },
  voice: { tone: "basso", speech_patterns: ["pause lunghe"] },
  tics: ["si tocca la barba"],
  motivations: ["proteggere la figlia"],
  goals: { short_term: "trovare un compratore" },
  weaknesses: [
    { description: "ha paura del fuoco", who_could_exploit: "membri di Tharros" },
  ],
} as const;

describe("integration: /api/entities", () => {
  it("crea NPC con properties JSONB validate, le legge e le aggiorna", async () => {
    const campaign = await makeCampaign();
    const res = await createEntity(
      makeRequest("/api/entities", {
        method: "POST",
        body: {
          campaignId: campaign.id,
          type: "npc",
          name: "Garrick",
          description: "GM ONLY: e' una spia.",
          publicDescription: "Mercante taciturno.",
          tags: ["spia"],
          visibility: "public",
          properties: validNpcProperties,
        },
      }),
    );
    expect(res.status).toBe(201);
    const npc = await readJson<EntityRow>(res);
    expect(npc.type).toBe("npc");
    expect(npc.name).toBe("Garrick");

    const list = await listEntities(
      makeRequest(`/api/entities?campaign_id=${campaign.id}`),
    );
    const rows = await readJson<EntityRow[]>(list);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tags).toContain("spia");

    const patched = await patchEntity(
      makeRequest(`/api/entities/${npc.id}`, {
        method: "PATCH",
        body: { publicDescription: "Mercante che parla poco." },
      }),
      { params: Promise.resolve({ id: npc.id }) },
    );
    expect(patched.status).toBe(200);
    expect((await readJson<EntityRow>(patched)).publicDescription).toBe(
      "Mercante che parla poco.",
    );

    const del = await deleteEntity(
      makeRequest(`/api/entities/${npc.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: npc.id }) },
    );
    expect(del.status).toBe(204);

    const get = await getEntity(makeRequest(`/api/entities/${npc.id}`), {
      params: Promise.resolve({ id: npc.id }),
    });
    expect(get.status).toBe(404);
  });

  it("rifiuta NPC con properties invalide (campo obbligatorio mancante)", async () => {
    const campaign = await makeCampaign();
    const res = await createEntity(
      makeRequest("/api/entities", {
        method: "POST",
        body: {
          campaignId: campaign.id,
          type: "npc",
          name: "InvalidNPC",
          // appearance_summary mancante: lo schema NPC lo richiede.
          properties: { race: "Umano" },
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = await readJson<{ error: { code: string } }>(res);
    expect(body.error.code).toBe("validation_failed");
  });

  it("PATCH che cambia il type rifiuta se properties non sono ricalcolate (Zod refine)", async () => {
    const campaign = await makeCampaign();
    const res = await createEntity(
      makeRequest("/api/entities", {
        method: "POST",
        body: {
          campaignId: campaign.id,
          type: "npc",
          name: "Garrick",
          properties: validNpcProperties,
        },
      }),
    );
    const npc = await readJson<EntityRow>(res);

    const patch = await patchEntity(
      makeRequest(`/api/entities/${npc.id}`, {
        method: "PATCH",
        body: { type: "monster" }, // type cambia ma properties no -> 400
      }),
      { params: Promise.resolve({ id: npc.id }) },
    );
    expect(patch.status).toBe(400);
  });

  it("filtra le entita' per type e tag, e fa search ILIKE su name", async () => {
    const campaign = await makeCampaign();
    const locRes = await createEntity(
      makeRequest("/api/entities", {
        method: "POST",
        body: {
          campaignId: campaign.id,
          type: "location",
          name: "Lunacupa",
          tags: ["citta", "porto"],
          properties: { kind: "city" },
        },
      }),
    );
    expect(locRes.status).toBe(201);
    const npcRes = await createEntity(
      makeRequest("/api/entities", {
        method: "POST",
        body: {
          campaignId: campaign.id,
          type: "npc",
          name: "Garrick",
          tags: ["spia"],
          properties: validNpcProperties,
        },
      }),
    );
    expect(npcRes.status).toBe(201);

    const byType = await listEntities(
      makeRequest(`/api/entities?campaign_id=${campaign.id}&type=npc`),
    );
    const byTypeRows = await readJson<EntityRow[]>(byType);
    expect(byTypeRows).toHaveLength(1);
    expect(byTypeRows[0]?.name).toBe("Garrick");

    const byTag = await listEntities(
      makeRequest(`/api/entities?campaign_id=${campaign.id}&tag=porto`),
    );
    const byTagRows = await readJson<EntityRow[]>(byTag);
    expect(byTagRows).toHaveLength(1);
    expect(byTagRows[0]?.name).toBe("Lunacupa");

    const search = await listEntities(
      makeRequest(`/api/entities?campaign_id=${campaign.id}&search=Garr`),
    );
    const searchRows = await readJson<EntityRow[]>(search);
    expect(searchRows).toHaveLength(1);
  });
});
