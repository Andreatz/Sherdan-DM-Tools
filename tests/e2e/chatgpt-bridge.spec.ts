import { expect, test } from "@playwright/test";

import { truncateAllForE2E } from "./_truncate";

const DATABASE_URL = process.env.DATABASE_URL ?? "";

test.beforeEach(async () => {
  if (!DATABASE_URL) throw new Error("DATABASE_URL non impostato per E2E");
  await truncateAllForE2E(DATABASE_URL);
});

test("chatgpt bridge: export, analyze fake output and review update pack", async ({
  page,
  request,
}) => {
  await request.post("/api/campaigns", {
    data: { name: "Sherdan Bridge E2E", description: "Campagna smoke" },
  });

  await page.goto("/chatgpt-bridge");
  await expect(
    page.getByRole("heading", { name: "ChatGPT Web Bridge" }),
  ).toBeVisible();
  await expect(page.getByText("Nessuna API chiamata")).toBeVisible();

  await page.getByRole("spinbutton", { name: "Sessione" }).fill("9");
  await page.getByRole("button", { name: "Genera pacchetto" }).click();
  await expect(page.getByText("`/sessione --md 9`")).toBeVisible();

  await page
    .getByPlaceholder("Incolla qui l'output ChatGPT...")
    .fill(
      [
        "# Sessione 9 - Fumo sul porto",
        "",
        "Materiale finto per smoke test.",
        "",
        "# UPDATE PACK PER SHERDAN-DM-TOOLS",
        "",
        "```json",
        JSON.stringify({
          session: { number: 9, title: "Fumo sul porto" },
          plotThreadUpdates: [],
          truthClueUpdates: [],
          npcUpdates: [],
          newHooks: [],
        }),
        "```",
      ].join("\n"),
    );
  await page.getByRole("button", { name: "Analizza output" }).click();
  await expect(page.getByText("UPDATE PACK: presente")).toBeVisible();
});
