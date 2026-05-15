import { expect, test } from "@playwright/test";

import { truncateAllForE2E } from "./_truncate";
import { apiJson, createCampaign, createNpc } from "./_fixtures";

const DATABASE_URL = process.env.DATABASE_URL ?? "";

test.beforeEach(async () => {
  if (!DATABASE_URL) throw new Error("DATABASE_URL non impostato per E2E");
  await truncateAllForE2E(DATABASE_URL);
});

test("sessions: aggrega evento plot, briciola e note della sessione", async ({
  page,
  request,
}) => {
  const campaign = await createCampaign(request, "Sherdan Sessioni E2E");
  const session = await apiJson<{ id: string; number: number }>(
    request.post("/api/sessions", {
      data: {
        campaignId: campaign.id,
        title: "Fumo sul porto",
        date: "2026-05-15",
        recap: "Il party incontra Mara.",
        dmNotes: "GM ONLY: Velkan mente.",
        prepNotes: "Aprire con una scena al molo.",
      },
    }),
  );
  const thread = await apiJson<{ id: string }>(
    request.post("/api/plot-threads", {
      data: {
        campaignId: campaign.id,
        title: "Contrabbando del porto",
        status: "hot",
        priority: 80,
      },
    }),
  );
  await apiJson(
    request.post("/api/plot-thread-events", {
      data: {
        plotThreadId: thread.id,
        sessionId: session.id,
        eventType: "reveal",
        description: "Mara consegna un simbolo bruciato.",
      },
    }),
  );
  await apiJson(
    request.post("/api/truth-clues", {
      data: {
        campaignId: campaign.id,
        relatedPlotThreadId: thread.id,
        plantedInSession: session.id,
        description: "Il simbolo odora di sale e cenere.",
        truthRevealed: "Il contrabbando passa dal vecchio faro.",
        status: "noticed",
      },
    }),
  );

  await page.goto("/sessions");
  await expect(page.getByRole("heading", { name: "Sessioni", exact: true }))
    .toBeVisible();
  await page.getByLabel("Campagna").selectOption(campaign.id);
  await expect(
    page.getByRole("heading", { name: "Sessione #1 · Fumo sul porto" }),
  ).toBeVisible();
  await expect(page.getByText("Mara consegna un simbolo bruciato.")).toBeVisible();
  await expect(page.getByText("Il simbolo odora di sale e cenere.")).toBeVisible();
});

test("truth clues: cambio status resta visibile nella workbench", async ({
  page,
  request,
}) => {
  const campaign = await createCampaign(request, "Sherdan Clue E2E");
  const npc = await createNpc(request, {
    campaignId: campaign.id,
    name: "Mara del Porto",
    visibility: "public",
  });
  const clue = await apiJson<{ id: string }>(
    request.post("/api/truth-clues", {
      data: {
        campaignId: campaign.id,
        description: "Mara evita di nominare il faro.",
        truthRevealed: "Mara teme chi abita sotto il faro.",
        relatedEntities: [npc.id],
        status: "planted",
      },
    }),
  );
  await apiJson(
    request.patch(`/api/truth-clues/${clue.id}`, {
      data: { status: "understood", statusNotes: "Il party collega il faro." },
    }),
  );

  await page.goto("/truth-clues");
  await expect(page.getByRole("heading", { name: "Truth Clue Tracker" }))
    .toBeVisible();
  await page.getByLabel("Campagna").selectOption(campaign.id);
  await expect(page.getByText("Mara evita di nominare il faro.").first())
    .toBeVisible();
  await expect(page.getByRole("button", { name: "Capita" })).toBeVisible();
  await expect(page.getByText("Il party collega il faro.")).toBeVisible();
});
