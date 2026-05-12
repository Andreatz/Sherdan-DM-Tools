import { describe, expect, it } from "vitest";

import { POST as createCampaign } from "@/app/api/campaigns/route";
import { POST as createPlotThread } from "@/app/api/plot-threads/route";
import {
  GET as listTruthClues,
  POST as createTruthClue,
} from "@/app/api/truth-clues/route";
import { PATCH as patchTruthClue } from "@/app/api/truth-clues/[id]/route";
import { GET as truthCluesDashboard } from "@/app/api/truth-clues/dashboard/route";

import { makeRequest, readJson, setupIntegrationDb } from "./_helpers";

setupIntegrationDb();

interface CampaignRow {
  id: string;
}
interface PlotThreadRow {
  id: string;
  title: string;
}
interface TruthClueRow {
  id: string;
  status: string;
  description: string;
  relatedPlotThreadId: string | null;
  statusUpdatedAt: string;
}

async function makeCampaign(name = "Sherdan"): Promise<CampaignRow> {
  const res = await createCampaign(
    makeRequest("/api/campaigns", { method: "POST", body: { name } }),
  );
  return readJson<CampaignRow>(res);
}

async function makePlotThread(
  campaignId: string,
  title: string,
): Promise<PlotThreadRow> {
  const res = await createPlotThread(
    makeRequest("/api/plot-threads", {
      method: "POST",
      body: { campaignId, title },
    }),
  );
  expect(res.status).toBe(201);
  return readJson<PlotThreadRow>(res);
}

async function plantClue(
  campaignId: string,
  description: string,
  truthRevealed: string,
  relatedPlotThreadId?: string,
): Promise<TruthClueRow> {
  const res = await createTruthClue(
    makeRequest("/api/truth-clues", {
      method: "POST",
      body: {
        campaignId,
        description,
        truthRevealed,
        relatedPlotThreadId: relatedPlotThreadId ?? null,
      },
    }),
  );
  expect(res.status).toBe(201);
  return readJson<TruthClueRow>(res);
}

describe("integration: truth clues + dashboard", () => {
  it("crea briciole, filtra per status/thread e ribattezza statusUpdatedAt sul cambio", async () => {
    const campaign = await makeCampaign();
    const thread = await makePlotThread(campaign.id, "Verita' su Malakor");

    const surface = await plantClue(
      campaign.id,
      "Una moneta nera cade dal mantello",
      "Agente Eclissi",
      thread.id,
    );
    const orfana = await plantClue(
      campaign.id,
      "Stessa firma in tre lettere",
      "Lo scriba e' uno",
    );

    expect(surface.status).toBe("planted");
    expect(orfana.relatedPlotThreadId).toBeNull();

    // Filtro per thread.
    const byThread = await listTruthClues(
      makeRequest(
        `/api/truth-clues?campaign_id=${campaign.id}&related_plot_thread_id=${thread.id}`,
      ),
    );
    const byThreadRows = await readJson<TruthClueRow[]>(byThread);
    expect(byThreadRows).toHaveLength(1);

    // PATCH status: noticed -> il bump di statusUpdatedAt deve scattare.
    const before = new Date(surface.statusUpdatedAt).getTime();
    await new Promise((r) => setTimeout(r, 10));
    const patch = await patchTruthClue(
      makeRequest(`/api/truth-clues/${surface.id}`, {
        method: "PATCH",
        body: { status: "noticed", statusNotes: "Bellamy ha notato" },
      }),
      { params: Promise.resolve({ id: surface.id }) },
    );
    expect(patch.status).toBe(200);
    const patched = await readJson<TruthClueRow>(patch);
    expect(patched.status).toBe("noticed");
    expect(new Date(patched.statusUpdatedAt).getTime()).toBeGreaterThan(before);

    // PATCH stesso status: NON bumpare statusUpdatedAt.
    await new Promise((r) => setTimeout(r, 10));
    const patch2 = await patchTruthClue(
      makeRequest(`/api/truth-clues/${surface.id}`, {
        method: "PATCH",
        body: { status: "noticed", statusNotes: "altra nota" },
      }),
      { params: Promise.resolve({ id: surface.id }) },
    );
    const patched2 = await readJson<TruthClueRow>(patch2);
    expect(patched2.statusUpdatedAt).toBe(patched.statusUpdatedAt);
  });

  it("dashboard: per-thread breakdown + understoodPct + riga orfana", async () => {
    const campaign = await makeCampaign();
    const thread = await makePlotThread(campaign.id, "Arco Azazel");

    // 3 briciole sul thread: 2 understood + 1 lost; 1 orfana planted.
    const c1 = await plantClue(campaign.id, "c1", "v1", thread.id);
    const c2 = await plantClue(campaign.id, "c2", "v2", thread.id);
    const c3 = await plantClue(campaign.id, "c3", "v3", thread.id);
    await plantClue(campaign.id, "orfana", "verita orfana");

    for (const c of [c1, c2]) {
      const res = await patchTruthClue(
        makeRequest(`/api/truth-clues/${c.id}`, {
          method: "PATCH",
          body: { status: "understood" },
        }),
        { params: Promise.resolve({ id: c.id }) },
      );
      expect(res.status).toBe(200);
    }
    const lostRes = await patchTruthClue(
      makeRequest(`/api/truth-clues/${c3.id}`, {
        method: "PATCH",
        body: { status: "lost" },
      }),
      { params: Promise.resolve({ id: c3.id }) },
    );
    expect(lostRes.status).toBe(200);

    const dash = await truthCluesDashboard(
      makeRequest(`/api/truth-clues/dashboard?campaign_id=${campaign.id}`),
    );
    expect(dash.status).toBe(200);
    const body = await readJson<{
      threads: Array<{
        plotThreadId: string | null;
        understood: number;
        total: number;
        understoodPct: number;
      }>;
    }>(dash);

    const threadRow = body.threads.find(
      (r) => r.plotThreadId === thread.id,
    );
    expect(threadRow).toMatchObject({
      total: 3,
      understood: 2,
      understoodPct: 67,
    });

    const orphan = body.threads.find((r) => r.plotThreadId === null);
    expect(orphan).toMatchObject({
      total: 1,
      understood: 0,
      understoodPct: 0,
    });
  });

  it("rifiuta plot thread o sessione di un'altra campagna", async () => {
    const a = await makeCampaign("A");
    const b = await makeCampaign("B");
    const threadB = await makePlotThread(b.id, "Thread B");

    const res = await createTruthClue(
      makeRequest("/api/truth-clues", {
        method: "POST",
        body: {
          campaignId: a.id,
          description: "x",
          truthRevealed: "y",
          relatedPlotThreadId: threadB.id,
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = await readJson<{ error: { code: string } }>(res);
    expect(body.error.code).toBe("bad_request");
  });
});
