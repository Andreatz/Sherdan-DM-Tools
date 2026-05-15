import { expect, test } from "@playwright/test";

import { truncateAllForE2E } from "./_truncate";
import { apiJson, createCampaign, createNpc } from "./_fixtures";

const DATABASE_URL = process.env.DATABASE_URL ?? "";

test.beforeEach(async () => {
  if (!DATABASE_URL) throw new Error("DATABASE_URL non impostato per E2E");
  await truncateAllForE2E(DATABASE_URL);
});

test("plot threads: thread caldo con entita collegata appare nella board", async ({
  page,
  request,
}) => {
  const campaign = await createCampaign(request, "Sherdan Plot E2E");
  const npc = await createNpc(request, {
    campaignId: campaign.id,
    name: "Mara del Porto",
    visibility: "discovered",
  });
  const thread = await apiJson<{ id: string }>(
    request.post("/api/plot-threads", {
      data: {
        campaignId: campaign.id,
        title: "Contrabbando del porto",
        description: "GM ONLY: la rotta passa dal faro.",
        publicDescription: "Voci di merci sparite.",
        status: "hot",
        priority: 90,
      },
    }),
  );
  await apiJson(
    request.post("/api/plot-thread-entities", {
      data: {
        plotThreadId: thread.id,
        entityId: npc.id,
        role: "instigator",
        notes: "Tiene i contatti sul molo.",
      },
    }),
  );

  await page.goto("/plot-threads");
  await expect(page.getByRole("heading", { name: "Plot Threads" })).toBeVisible();
  await page.getByLabel("Campagna").selectOption(campaign.id);
  await expect(
    page.getByRole("heading", { name: "Contrabbando del porto" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Mara del Porto/ }).first())
    .toBeVisible();
  await expect(page.getByText("Tiene i contatti sul molo.")).toBeVisible();
});
