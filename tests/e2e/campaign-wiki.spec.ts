import { expect, test } from "@playwright/test";

import { truncateAllForE2E } from "./_truncate";
import { apiJson, createCampaign, createNpc } from "./_fixtures";

const DATABASE_URL = process.env.DATABASE_URL ?? "";

test.beforeEach(async () => {
  if (!DATABASE_URL) throw new Error("DATABASE_URL non impostato per E2E");
  await truncateAllForE2E(DATABASE_URL);
});

test("campaign wiki: entity detail mostra identita, segreti e link canonici", async ({
  page,
  request,
}) => {
  const campaign = await createCampaign(request, "Sherdan Wiki E2E");
  const npc = await createNpc(request, {
    campaignId: campaign.id,
    name: "Mara del Porto",
    visibility: "discovered",
    publicDescription: "Una mediatrice del porto.",
    description: "GM ONLY: sa chi muove il contrabbando.",
  });
  const target = await createNpc(request, {
    campaignId: campaign.id,
    name: "Capitano Velkan",
    visibility: "public",
    publicDescription: "Capitano della guardia.",
  });

  await apiJson(
    request.post("/api/entity-identities", {
      data: {
        entityId: npc.id,
        name: "La Vedetta Grigia",
        isTrueIdentity: false,
        visibility: "dm_only",
        mannerisms: ["conta le uscite"],
      },
    }),
  );
  await apiJson(
    request.post("/api/entity-secrets", {
      data: {
        campaignId: campaign.id,
        entityId: npc.id,
        layer: "deep",
        content: "Mara ricatta Velkan da tre sessioni.",
      },
    }),
  );
  await apiJson(
    request.post("/api/entity-links", {
      data: {
        campaignId: campaign.id,
        sourceEntityId: npc.id,
        targetEntityId: target.id,
        relationType: "blackmails",
        publicRelationType: "knows",
        visibility: "dm_only",
      },
    }),
  );

  await page.goto(
    `/campaigns/${campaign.id}?focus=${npc.id}&detail_tab=identities#entity-detail`,
  );
  await expect(page.getByRole("heading", { name: campaign.name })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mara del Porto" }))
    .toBeVisible();
  await expect(page.getByText("La Vedetta Grigia")).toBeVisible();

  await page.goto(
    `/campaigns/${campaign.id}?focus=${npc.id}&detail_tab=secrets#entity-detail`,
  );
  await expect(page.getByText("Mara ricatta Velkan").first()).toBeVisible();

  await page.goto(
    `/campaigns/${campaign.id}?focus=${npc.id}&detail_tab=links#entity-detail`,
  );
  await expect(
    page.locator("#entity-detail").getByRole("link", { name: "Capitano Velkan" }),
  ).toBeVisible();
});
