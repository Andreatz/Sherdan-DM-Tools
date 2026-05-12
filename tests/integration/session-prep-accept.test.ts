import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { POST as createCampaign } from "@/app/api/campaigns/route";
import { POST as createEntity } from "@/app/api/entities/route";
import { POST as createPlotThread } from "@/app/api/plot-threads/route";
import { POST as createSession } from "@/app/api/sessions/route";
import { POST as acceptSessionPrep } from "@/app/api/session-prep/accept/route";
import {
  encounters,
  entities,
  pcHooks,
  sessions,
  truthClues,
} from "@/db/schema";

import {
  makeRequest,
  readJson,
  setupIntegrationDb,
  testDb,
} from "./_helpers";

setupIntegrationDb();

interface CampaignRow { id: string }
interface EntityRow { id: string; name: string }
interface SessionRow { id: string; number: number }
interface PlotThreadRow { id: string }

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

const PC_PROPERTIES = {
  race: "Umano",
  class: "Ranger",
  level: 3,
} as const;

async function makeCampaign(name = "Sherdan"): Promise<CampaignRow> {
  const res = await createCampaign(
    makeRequest("/api/campaigns", { method: "POST", body: { name } }),
  );
  return readJson<CampaignRow>(res);
}

async function makeEntity(
  campaignId: string,
  type: string,
  name: string,
): Promise<EntityRow> {
  const properties =
    type === "pc"
      ? PC_PROPERTIES
      : type === "npc"
        ? NPC_PROPERTIES
        : {};
  const res = await createEntity(
    makeRequest("/api/entities", {
      method: "POST",
      body: {
        campaignId,
        type,
        name,
        visibility: "public",
        properties,
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

const BASE_OUTPUT = {
  previouslyOn: "Recap.",
  hooks: [],
  npcSeeds: [],
  encounterSeeds: [],
  suggestedClues: [],
  notes: [],
};

describe("integration: POST /api/session-prep/accept", () => {
  it("persiste briciole, NPC stub, encounter draft e PC hooks selezionati + aggiorna prep_notes", async () => {
    const campaign = await makeCampaign();
    const session = await makeSession(campaign.id);
    const plotThread = await makePlotThread(campaign.id);
    const pc = await makeEntity(campaign.id, "pc", "Bellamy");
    const npcTarget = await makeEntity(campaign.id, "npc", "Dante");

    const res = await acceptSessionPrep(
      makeRequest("/api/session-prep/accept", {
        method: "POST",
        body: {
          campaignId: campaign.id,
          sessionId: session.id,
          output: {
            ...BASE_OUTPUT,
            previouslyOn: "Il party rientra a Lunacupa.",
            hooks: [
              {
                pcEntityId: pc.id,
                pcName: pc.name,
                targetEntityId: npcTarget.id,
                targetName: npcTarget.name,
                hookDescription: "Dante propone un patto",
                potentialArc: "tradimento orchestrato",
                rationale: "spotlight Bellamy",
              },
            ],
            npcSeeds: [
              {
                existingEntityId: null,
                name: "Mercante taciturno",
                narrativeRole: "informatore",
                proposedType: "npc",
                tone: "stanco",
                rationale: "ponte verso il porto",
              },
            ],
            encounterSeeds: [
              {
                title: "Imboscata banditi",
                concept: "tre banditi tendono un agguato",
                difficultyHint: "medium",
                creatureHints: ["bandito", "bandito veterano"],
                rationale: "tension building",
              },
            ],
            suggestedClues: [
              {
                relatedPlotThreadId: plotThread.id,
                plotThreadTitle: "Arc",
                description: "Una moneta nera nel mantello",
                truthRevealed: "Dante e' Malakor",
                rationale: "indiretta",
              },
            ],
          },
          selected: {
            previouslyOn: true,
            notes: true,
            hooks: [0],
            npcSeeds: [0],
            encounterSeeds: [0],
            suggestedClues: [0],
          },
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = await readJson<{
      created: {
        clues: unknown[];
        npcs: unknown[];
        encounters: unknown[];
        pcHooks: unknown[];
      };
      skipped: { hookInvalid: number; cluePlotThreadInvalid: number };
    }>(res);
    expect(body.created.clues).toHaveLength(1);
    expect(body.created.npcs).toHaveLength(1);
    expect(body.created.encounters).toHaveLength(1);
    expect(body.created.pcHooks).toHaveLength(1);
    expect(body.skipped).toEqual({ hookInvalid: 0, cluePlotThreadInvalid: 0 });

    // Sanity DB-side.
    const clues = await testDb
      .select()
      .from(truthClues)
      .where(eq(truthClues.campaignId, campaign.id));
    expect(clues).toHaveLength(1);
    expect(clues[0]?.plantedInSession).toBe(session.id);

    const npcRows = await testDb
      .select()
      .from(entities)
      .where(eq(entities.campaignId, campaign.id));
    // 2 esistenti (pc + npc target) + 1 stub creato = 3 totali
    expect(npcRows).toHaveLength(3);
    const stub = npcRows.find((r) => r.name === "Mercante taciturno");
    expect(stub).toBeDefined();
    expect(stub?.visibility).toBe("dm_only");
    expect(stub?.tags).toContain("session-prep-draft");

    const encounterRows = await testDb
      .select()
      .from(encounters)
      .where(eq(encounters.campaignId, campaign.id));
    expect(encounterRows).toHaveLength(1);
    expect(encounterRows[0]?.difficulty).toBe("medium");

    const hookRows = await testDb
      .select()
      .from(pcHooks)
      .where(eq(pcHooks.campaignId, campaign.id));
    expect(hookRows).toHaveLength(1);

    // prep_notes aggiornate con il Markdown dei soli pezzi accettati.
    const [updatedSession] = await testDb
      .select({ prepNotes: sessions.prepNotes })
      .from(sessions)
      .where(eq(sessions.id, session.id));
    expect(updatedSession?.prepNotes).toContain("Session Prep");
    expect(updatedSession?.prepNotes).toContain("Bellamy → Dante");
    expect(updatedSession?.prepNotes).toContain("Mercante taciturno");
  });

  it("salta gli hook con pcEntityId/targetEntityId non validi (skipped.hookInvalid)", async () => {
    const campaign = await makeCampaign();
    const session = await makeSession(campaign.id);

    const fakeId = "00000000-0000-4000-8000-000000000000";
    const res = await acceptSessionPrep(
      makeRequest("/api/session-prep/accept", {
        method: "POST",
        body: {
          campaignId: campaign.id,
          sessionId: session.id,
          output: {
            ...BASE_OUTPUT,
            hooks: [
              {
                pcEntityId: fakeId,
                pcName: "Ghost PC",
                targetEntityId: fakeId,
                targetName: "Ghost target",
                hookDescription: "x",
                potentialArc: "y",
                rationale: "z",
              },
            ],
          },
          selected: { hooks: [0] },
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = await readJson<{
      created: { pcHooks: unknown[] };
      skipped: { hookInvalid: number };
    }>(res);
    expect(body.created.pcHooks).toEqual([]);
    expect(body.skipped.hookInvalid).toBe(1);

    const hookRows = await testDb
      .select()
      .from(pcHooks)
      .where(eq(pcHooks.campaignId, campaign.id));
    expect(hookRows).toEqual([]);
  });

  it("rifiuta sessionId di un'altra campagna con 400", async () => {
    const a = await makeCampaign("A");
    const b = await makeCampaign("B");
    const sessionB = await makeSession(b.id);

    const res = await acceptSessionPrep(
      makeRequest("/api/session-prep/accept", {
        method: "POST",
        body: {
          campaignId: a.id,
          sessionId: sessionB.id,
          output: BASE_OUTPUT,
          selected: {},
        },
      }),
    );
    expect(res.status).toBe(400);
  });

  it("se l'agent propone un NPC esistente (existingEntityId), NON crea uno stub", async () => {
    const campaign = await makeCampaign();
    const session = await makeSession(campaign.id);
    const existing = await makeEntity(campaign.id, "npc", "NPC Esistente");

    const res = await acceptSessionPrep(
      makeRequest("/api/session-prep/accept", {
        method: "POST",
        body: {
          campaignId: campaign.id,
          sessionId: session.id,
          output: {
            ...BASE_OUTPUT,
            npcSeeds: [
              {
                existingEntityId: existing.id,
                name: "NPC Esistente",
                narrativeRole: "ruolo",
                proposedType: "npc",
                tone: "tono",
                rationale: "r",
              },
            ],
          },
          selected: { npcSeeds: [0] },
        },
      }),
    );
    expect(res.status).toBe(201);
    const body = await readJson<{ created: { npcs: unknown[] } }>(res);
    expect(body.created.npcs).toEqual([]);

    const rows = await testDb
      .select()
      .from(entities)
      .where(eq(entities.campaignId, campaign.id));
    expect(rows).toHaveLength(1); // solo l'NPC esistente
  });
});
