import { describe, expect, it } from "vitest";

import { POST as createCampaign, GET as listCampaigns } from "@/app/api/campaigns/route";
import {
  DELETE as deleteCampaign,
  GET as getCampaign,
  PATCH as patchCampaign,
} from "@/app/api/campaigns/[id]/route";

import { makeRequest, readJson, setupIntegrationDb } from "./_helpers";

setupIntegrationDb();

interface CampaignRow {
  id: string;
  name: string;
  description: string | null;
  settings: Record<string, unknown>;
}

describe("integration: /api/campaigns", () => {
  it("crea, lista, legge, aggiorna e cancella una campagna end-to-end", async () => {
    // Lista vuota all'inizio.
    const empty = await listCampaigns();
    expect(empty.status).toBe(200);
    expect(await readJson(empty)).toEqual([]);

    // Create.
    const createRes = await createCampaign(
      makeRequest("/api/campaigns", {
        method: "POST",
        body: {
          name: "Sherdan Test",
          description: "Campagna creata dai test integrazione",
          settings: { system: "D&D 5e" },
        },
      }),
    );
    expect(createRes.status).toBe(201);
    const created = await readJson<CampaignRow>(createRes);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.name).toBe("Sherdan Test");
    expect(created.settings).toEqual({ system: "D&D 5e" });

    // List ora ha una riga.
    const list = await listCampaigns();
    const listed = await readJson<CampaignRow[]>(list);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.id).toBe(created.id);

    // GET singolo.
    const getRes = await getCampaign(
      makeRequest(`/api/campaigns/${created.id}`),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(getRes.status).toBe(200);

    // PATCH descrizione.
    const patchRes = await patchCampaign(
      makeRequest(`/api/campaigns/${created.id}`, {
        method: "PATCH",
        body: { description: "Aggiornata" },
      }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(patchRes.status).toBe(200);
    const patched = await readJson<CampaignRow>(patchRes);
    expect(patched.description).toBe("Aggiornata");

    // DELETE.
    const deleteRes = await deleteCampaign(
      makeRequest(`/api/campaigns/${created.id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(deleteRes.status).toBe(204);

    // GET dopo delete -> 404.
    const getAfter = await getCampaign(
      makeRequest(`/api/campaigns/${created.id}`),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(getAfter.status).toBe(404);
  });

  it("rifiuta create con nome vuoto e body extra (Zod strict)", async () => {
    const empty = await createCampaign(
      makeRequest("/api/campaigns", {
        method: "POST",
        body: { name: "  " },
      }),
    );
    expect(empty.status).toBe(400);
    const body = await readJson<{ error: { code: string } }>(empty);
    expect(body.error.code).toBe("validation_failed");

    const extra = await createCampaign(
      makeRequest("/api/campaigns", {
        method: "POST",
        body: { name: "ok", unknownField: true },
      }),
    );
    expect(extra.status).toBe(400);
  });

  it("PATCH con body vuoto restituisce 400 BadRequest", async () => {
    const create = await createCampaign(
      makeRequest("/api/campaigns", { method: "POST", body: { name: "X" } }),
    );
    const c = await readJson<CampaignRow>(create);
    const res = await patchCampaign(
      makeRequest(`/api/campaigns/${c.id}`, { method: "PATCH", body: {} }),
      { params: Promise.resolve({ id: c.id }) },
    );
    expect(res.status).toBe(400);
  });
});
