import { expect, test, type APIRequestContext } from "@playwright/test";

import { truncateAllForE2E } from "./_truncate";

const DATABASE_URL = process.env.DATABASE_URL ?? "";

// Smoke E2E del flusso player end-to-end:
// 1. Il DM crea (via API) una campagna, due entity (una public, una
//    dm_only) e un player con codice individuale.
// 2. Il giocatore visita `/player`, inserisce il codice e accede.
// 3. La UI mostra SOLO l'entita' public (la dm_only resta nascosta).
// 4. Il DM imposta un override `revealed` sulla entity dm_only.
// 5. Dopo refresh, la UI ora mostra anche quella entity.
// 6. Il DM imposta un override `hidden` sulla entity public.
// 7. Dopo refresh, la UI non mostra piu' la entity public.

const NPC_PROPERTIES = {
  race: "Umano",
  appearance_summary: "Sguardo basso, mantello scuro.",
  sensory_details: { sight: "Cicatrice." },
  voice: { tone: "basso", speech_patterns: [] },
  tics: [],
  motivations: [],
  goals: {},
  weaknesses: [],
} as const;

test.beforeEach(async () => {
  if (!DATABASE_URL) throw new Error("DATABASE_URL non impostato per E2E");
  await truncateAllForE2E(DATABASE_URL);
});

interface SeedData {
  campaignId: string;
  publicEntityId: string;
  dmOnlyEntityId: string;
  playerId: string;
}

async function seedFixture(api: APIRequestContext): Promise<SeedData> {
  const campaign = await api
    .post("/api/campaigns", { data: { name: "Sherdan E2E" } })
    .then((r) => r.json());

  const publicEntity = await api
    .post("/api/entities", {
      data: {
        campaignId: campaign.id,
        type: "npc",
        name: "NPC Visibile",
        visibility: "public",
        publicDescription: "Mercante del porto",
        properties: NPC_PROPERTIES,
      },
    })
    .then((r) => r.json());

  const dmOnlyEntity = await api
    .post("/api/entities", {
      data: {
        campaignId: campaign.id,
        type: "npc",
        name: "NPC Segreto",
        visibility: "dm_only",
        description: "GM ONLY: non esporre",
        publicDescription: "non visibile al party",
        properties: NPC_PROPERTIES,
      },
    })
    .then((r) => r.json());

  const player = await api
    .post("/api/players", {
      data: {
        campaignId: campaign.id,
        name: "Alice",
        code: "alice-e2e-secret-code",
      },
    })
    .then((r) => r.json());

  return {
    campaignId: campaign.id,
    publicEntityId: publicEntity.id,
    dmOnlyEntityId: dmOnlyEntity.id,
    playerId: player.id,
  };
}

test("player flow: login per-player, scoping campagna e override visibility", async ({
  page,
  request,
}) => {
  const fixture = await seedFixture(request);

  // ---------------------------------------------------------------- step 1
  // /player: form di login visibile
  await page.goto("/player");
  await expect(
    page.getByPlaceholder("Codice accesso giocatori"),
  ).toBeVisible();

  // ---------------------------------------------------------------- step 2
  // login con codice player
  await page.getByPlaceholder("Codice accesso giocatori").fill("alice-e2e-secret-code");
  await page.getByRole("button", { name: "Entra" }).click();

  // ---------------------------------------------------------------- step 3
  // dopo login: campagna selezionata. La dashboard NON auto-carica la
  // lista entita' per default (preserva il piano dati del giocatore):
  // serve cliccare "Carica".
  await expect(page.getByRole("heading", { name: "Campagna" })).toBeVisible();
  await page.getByRole("button", { name: "Carica" }).click();
  await expect(
    page.getByRole("heading", { name: "NPC Visibile" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "NPC Segreto" })).toHaveCount(0);

  // ---------------------------------------------------------------- step 4
  // DM imposta override `revealed` sulla dm_only.
  const revealRes = await request.post("/api/player-visibility-overrides", {
    data: {
      playerId: fixture.playerId,
      targetType: "entity",
      targetId: fixture.dmOnlyEntityId,
      mode: "revealed",
    },
  });
  expect(revealRes.status()).toBe(201);

  // ---------------------------------------------------------------- step 5
  // re-fetch -> ora la dm_only e' visibile via revealed override
  await page.getByRole("button", { name: "Carica" }).click();
  await expect(
    page.getByRole("heading", { name: "NPC Segreto" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "NPC Visibile" }),
  ).toBeVisible();

  // ---------------------------------------------------------------- step 6
  // DM imposta override `hidden` sulla public.
  const hideRes = await request.post("/api/player-visibility-overrides", {
    data: {
      playerId: fixture.playerId,
      targetType: "entity",
      targetId: fixture.publicEntityId,
      mode: "hidden",
    },
  });
  expect(hideRes.status()).toBe(201);

  // ---------------------------------------------------------------- step 7
  // re-fetch -> ora la public e' nascosta
  await page.getByRole("button", { name: "Carica" }).click();
  await expect(page.getByRole("heading", { name: "NPC Visibile" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "NPC Segreto" }),
  ).toBeVisible();
});

test("player flow: codice errato resta sulla form di login", async ({ page }) => {
  await page.goto("/player");
  await page
    .getByPlaceholder("Codice accesso giocatori")
    .fill("totally-wrong-code");
  await page.getByRole("button", { name: "Entra" }).click();

  // L'input login deve restare visibile (no transizione a dashboard).
  await expect(
    page.getByPlaceholder("Codice accesso giocatori"),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Campagna" })).toHaveCount(0);
});
