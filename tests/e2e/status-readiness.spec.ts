import { expect, test } from "@playwright/test";

import { truncateAllForE2E } from "./_truncate";

const DATABASE_URL = process.env.DATABASE_URL ?? "";

test.beforeEach(async () => {
  if (!DATABASE_URL) throw new Error("DATABASE_URL non impostato per E2E");
  await truncateAllForE2E(DATABASE_URL);
});

test("status: mostra readiness DB, LLM mode e content safety", async ({
  page,
}) => {
  await page.goto("/status");
  await expect(page.getByRole("heading", { name: "Stato progetto" })).toBeVisible();
  await expect(page.getByText("Database", { exact: true })).toBeVisible();
  await expect(page.getByText("Connesso")).toBeVisible();
  await expect(page.getByText("LLM mode", { exact: true })).toBeVisible();
  await expect(page.getByText("Leak public/", { exact: true })).toBeVisible();
  await expect(page.getByText("Nessun file raw esposto.")).toBeVisible();
  await expect(page.getByText("Stato feature")).toBeVisible();
});
