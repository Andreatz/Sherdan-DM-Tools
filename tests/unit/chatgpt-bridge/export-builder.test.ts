import { describe, expect, it } from "vitest";

import { buildChatGptBridgeExport } from "@/lib/chatgpt-bridge";

const baseInput = {
  campaignId: "00000000-0000-4000-8000-000000000001",
  taskType: "session_md" as const,
  density: "Standard" as const,
  audience: "gm" as const,
  sessionNumber: 9,
  includeSystemPrompt: true,
  includeCampaignSnapshot: true,
  includeRecentSessions: true,
  recentSessionsLimit: 5,
  includePlotThreads: true,
  includeTruthClues: true,
  includeSecrets: true,
  includePcHooks: true,
  includeFactions: true,
  includePlayerFacingState: false,
  requestUpdatePack: true,
};

const context = {
  campaign: {
    id: baseInput.campaignId,
    name: "Sherdan",
    description: "Campagna test",
  },
  recentSessions: [
    {
      id: "00000000-0000-4000-8000-000000000101",
      number: 8,
      title: "Il porto",
      date: null,
      recap: "I PG hanno indagato al porto.",
      dmNotes: "Il mandante e segreto.",
      prepNotes: "Preparare il ricatto.",
    },
  ],
  plotThreads: [
    {
      id: "00000000-0000-4000-8000-000000000201",
      title: "La Congiura",
      description: "Verita GM",
      publicDescription: "Voci di palazzo",
      status: "hot",
      priority: 1,
      visibility: "dm_only",
    },
  ],
  truthClues: [
    {
      id: "00000000-0000-4000-8000-000000000301",
      description: "Sigillo spezzato",
      truthRevealed: "Il casato e compromesso.",
      status: "planted",
      statusNotes: null,
    },
  ],
  secrets: [
    {
      id: "00000000-0000-4000-8000-000000000401",
      layer: "core",
      content: "Segreto GM rilevante",
      exploitHint: null,
      entityName: "Duca",
      plotThreadTitle: null,
    },
  ],
  pcHooks: [],
  factions: [],
  playerFacingState: null,
};

describe("buildChatGptBridgeExport", () => {
  it("produce markdown valido con comando session_md", async () => {
    const result = await buildChatGptBridgeExport(baseInput, context);

    expect(result.ok).toBe(true);
    expect(result.markdown).toContain("# ChatGPT Bridge Export - Sherdan-DM-Tools");
    expect(result.markdown).toContain("`/sessione --md 9`");
    expect(result.markdown).toContain("content/sherdan/Agente AI Worldbuilding.md");
    expect(result.markdown).toContain("Sigillo spezzato");
  });

  it("include istruzioni update pack quando richiesto", async () => {
    const result = await buildChatGptBridgeExport(baseInput, context);

    expect(result.markdown).toContain("# UPDATE PACK PER SHERDAN-DM-TOOLS");
    expect(result.markdown).toContain('"plotThreadUpdates"');
  });

  it("in audience player non include contenuti GM-only", async () => {
    const result = await buildChatGptBridgeExport(
      {
        ...baseInput,
        audience: "player",
        includeSecrets: false,
        taskType: "player_recap",
      },
      {
        ...context,
        recentSessions: context.recentSessions.map((session) => ({
          ...session,
          dmNotes: undefined,
          prepNotes: undefined,
        })),
        plotThreads: context.plotThreads.map((thread) => ({
          ...thread,
          description: undefined,
        })),
        truthClues: context.truthClues.map((clue) => ({
          ...clue,
          truthRevealed: undefined,
        })),
        secrets: [],
      },
    );

    expect(result.markdown).not.toContain("Il mandante e segreto");
    expect(result.markdown).not.toContain("Segreto GM rilevante");
    expect(result.markdown).not.toContain("Il casato e compromesso");
    expect(result.warnings).toContain("Modalita player-facing attiva: campi GM-only filtrati.");
  });

  it("applica un relevance budget in base a densita e focus", async () => {
    const manyClues = Array.from({ length: 20 }, (_, index) => ({
      id: `00000000-0000-4000-8000-0000000010${String(index).padStart(2, "0")}`,
      description:
        index === 17
          ? "La chiave di Obsidium vibra sotto il porto"
          : `Briciola laterale ${index}`,
      truthRevealed:
        index === 17 ? "Obsidium collega il porto al rituale." : "Dettaglio minore",
      status: index === 17 ? "noticed" : "planted",
      statusNotes: null,
    }));

    const result = await buildChatGptBridgeExport(
      {
        ...baseInput,
        density: "Light",
        focus: "Obsidium porto",
      },
      {
        ...context,
        truthClues: manyClues,
      },
    );

    expect(result.markdown).toContain("La chiave di Obsidium");
    expect(result.markdown).not.toContain("Briciola laterale 19");
    expect(result.warnings.some((warning) => warning.includes("Relevance budget"))).toBe(
      true,
    );
  });
});
