import { describe, expect, it } from "vitest";

import {
  StyleCalibrator,
  buildStyleProfile,
  renderStyleCalibrationMarkdown,
  styleCalibrationToPromptVariables,
  type StyleCalibratorEntity,
} from "@/lib/generators";

describe("StyleCalibrator", () => {
  it("extracts campaign style features from entities", () => {
    const profile = buildStyleProfile(sampleEntities());

    expect(profile.entitiesAnalyzed).toBe(3);
    expect(profile.entityTypes).toEqual({ npc: 2, location: 1 });
    expect(profile.description.describedEntities).toBe(3);
    expect(profile.description.averageWords).toBeGreaterThan(5);
    expect(profile.features.sensoryDetailsRatio).toBeCloseTo(2 / 3, 3);
    expect(profile.features.voiceRatio).toBeCloseTo(1 / 3, 3);
    expect(profile.features.ticsRatio).toBeCloseTo(1 / 3, 3);
    expect(profile.features.goalsRatio).toBeCloseTo(1 / 3, 3);
    expect(profile.features.weaknessesRatio).toBeCloseTo(1 / 3, 3);
    expect(profile.features.publicDescriptionRatio).toBeCloseTo(1 / 3, 3);
    expect(profile.secretsByLayer).toEqual({
      surface: 1,
      intermediate: 0,
      deep: 1,
    });
    expect(profile.toneSignals.map((signal) => signal.key)).toContain(
      "industrial_arcane",
    );
    expect(profile.guidance).toContain(
      "Separate surface hooks from deeper truths; do not flatten secrets into one reveal.",
    );
  });

  it("selects few-shot examples and renders a prompt block", () => {
    const result = new StyleCalibrator().calibrate(sampleEntities(), {
      maxExamples: 2,
      maxExampleChars: 180,
    });

    expect(result.examples).toHaveLength(2);
    expect(result.examples[0]).toMatchObject({
      name: "Lunacupa",
      type: "npc",
    });
    expect(result.examples[0]?.reasons).toContain("sensory details");
    expect(result.promptBlock).toContain("## Style Calibration");
    expect(result.promptBlock).toContain("### Few-shot Style Examples");
    expect(result.promptBlock).toContain("#### Lunacupa (npc)");
    expect(result.promptBlock).toContain("Voice:");
    expect(result.promptBlock).toContain("Secrets:");
  });

  it("can be injected into PromptBuilder variables", () => {
    const result = new StyleCalibrator().calibrate(sampleEntities(), {
      maxExamples: 1,
    });
    const variables = styleCalibrationToPromptVariables(result);

    expect(variables.style).toBe(result.promptBlock);
    expect(variables.style_entities_analyzed).toBe(3);
  });

  it("renders empty profiles without examples", () => {
    const profile = buildStyleProfile([]);
    const markdown = renderStyleCalibrationMarkdown(profile, []);

    expect(profile.entitiesAnalyzed).toBe(0);
    expect(profile.description.averageWords).toBe(0);
    expect(markdown).toContain("Entities analyzed: 0");
    expect(markdown).not.toContain("Few-shot Style Examples");
  });
});

function sampleEntities(): StyleCalibratorEntity[] {
  return [
    {
      id: "00000000-0000-4000-8000-000000000001",
      type: "npc",
      name: "Lunacupa",
      publicDescription: "Capitana rispettata della costa.",
      description:
        "Lunacupa parla poco, ma ogni frase pesa come una sentenza. Odora di sale, fumo e metallo freddo. Porta la colpa dei morti come una seconda uniforme, e quando il mare tace sembra ascoltare qualcosa che gli altri non sentono.",
      tags: ["sherdan", "pirata"],
      properties: {
        sensory_details: {
          sight: "cicatrici sottili sul collo",
          smell: "sale e fumo",
          sound: "voce bassa, senza fretta",
        },
        voice: {
          tone: "calma e minacciosa",
          accent: "portuale",
          speech_patterns: ["frasi brevi", "domande taglienti"],
        },
        tics: ["conta le vie di fuga"],
        goals: {
          short_term: "proteggere la ciurma",
          long_term: "vendicare un tradimento",
        },
        weaknesses: [
          {
            description: "Non abbandona i propri morti.",
            who_could_exploit: "Un nemico con ostaggi.",
          },
        ],
      },
      secrets: [
        {
          id: "00000000-0000-4000-8000-000000000101",
          entityId: "00000000-0000-4000-8000-000000000001",
          layer: "surface",
          content: "Ha un debito con la Loggia.",
          exploitHint: null,
          discoveredAtSession: null,
          discoveryNotes: null,
        },
        {
          id: "00000000-0000-4000-8000-000000000102",
          entityId: "00000000-0000-4000-8000-000000000001",
          layer: "deep",
          content: "Ha venduto una rotta per salvare una sola persona.",
          exploitHint: "Leva morale.",
          discoveredAtSession: null,
          discoveryNotes: null,
        },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      type: "location",
      name: "Fucina di Tharros",
      publicDescription: null,
      description:
        "La fucina pulsa di luce azzurra. Ogni motore perde un battito ogni sette colpi, come se l'Obsidium ricordasse una guerra antica.",
      tags: ["tharros", "obsidium"],
      properties: {
        atmosphere: {
          sights: "riflessi azzurri sul ferro",
          sounds: "ingranaggi e vapore",
          smells: "ozono e olio caldo",
        },
      },
      secrets: [],
    },
    {
      id: "00000000-0000-4000-8000-000000000003",
      type: "npc",
      name: "Archivista Grigio",
      publicDescription: null,
      description:
        "Sorride con cortesia accademica e chiude ogni risposta prima che diventi confessione.",
      tags: ["loggia"],
      properties: {},
      secrets: [],
    },
  ];
}
