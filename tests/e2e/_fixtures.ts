import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";

export const NPC_PROPERTIES = {
  race: "Umano",
  appearance_summary: "Mantello scuro, occhi attenti.",
  sensory_details: { sight: "Cicatrice sottile." },
  voice: { tone: "basso", speech_patterns: [] },
  tics: [],
  motivations: [],
  goals: {},
  weaknesses: [],
} as const;

export async function apiJson<T>(
  responsePromise: Promise<{
    ok(): boolean;
    status(): number;
    json(): Promise<unknown>;
    text(): Promise<string>;
  }>,
): Promise<T> {
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as T;
}

export async function createCampaign(
  request: APIRequestContext,
  name = "Sherdan E2E",
): Promise<{ id: string; name: string }> {
  return apiJson(
    request.post("/api/campaigns", {
      data: { name, description: "Campagna smoke E2E" },
    }),
  );
}

export async function createNpc(
  request: APIRequestContext,
  input: {
    campaignId: string;
    name: string;
    visibility?: "dm_only" | "discovered" | "public";
    publicDescription?: string;
    description?: string;
  },
): Promise<{ id: string; name: string }> {
  return apiJson(
    request.post("/api/entities", {
      data: {
        campaignId: input.campaignId,
        type: "npc",
        name: input.name,
        visibility: input.visibility ?? "dm_only",
        publicDescription: input.publicDescription,
        description: input.description,
        properties: NPC_PROPERTIES,
      },
    }),
  );
}
