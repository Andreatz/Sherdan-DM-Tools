import { describe, expect, it } from "vitest";

import {
  npcGeneratorOutputSchema,
  npcGeneratorOutputSchemaForDepth,
  type NpcGeneratorOutput,
} from "@/lib/generators";
import { npcPropertiesSchema } from "@/lib/validation/npc";

const campaignLocationId = "22222222-2222-4222-8222-222222222222";
const factionId = "33333333-3333-4333-8333-333333333333";
const nearbyNpcId = "44444444-4444-4444-8444-444444444444";

describe("npcGeneratorOutputSchema", () => {
  it("accepts a complete NPC generator output and stays compatible with NPC properties", () => {
    const output = npcGeneratorOutputSchemaForDepth("principale").parse(
      sampleOutput(),
    );

    expect(output.name).toBe("Capitana Rame");
    expect(output.properties.sensory_details).toEqual({
      sight: "Uniforme cerata con cuciture di rame ossidato.",
      smell: "Sale, ozono e tabacco spento.",
      sound: "Stivali pesanti e voce bassa.",
      touch: "Stretta di mano fredda.",
    });
    expect(output.properties.voice.speech_patterns).toEqual([
      "frasi brevi",
      "domande che sembrano ordini",
    ]);
    expect(output.secrets.map((secret) => secret.layer)).toEqual([
      "surface",
      "intermediate",
      "deep",
    ]);
    expect(() => npcPropertiesSchema.parse(output.properties)).not.toThrow();
  });

  it("normalizes strings and default arrays from model output", () => {
    const output = npcGeneratorOutputSchema.parse({
      ...sampleOutput({ secrets: [] }),
      name: "  Mara del Molo  ",
      tags: undefined,
      properties: {
        ...sampleOutput().properties,
        race: "  umana  ",
        extra: {
          ...sampleOutput().properties.extra,
          plot_hooks: undefined,
        },
      },
    });

    expect(output.name).toBe("Mara del Molo");
    expect(output.tags).toEqual([]);
    expect(output.properties.race).toBe("umana");
    expect(output.properties.extra.plot_hooks).toEqual([]);
  });

  it("requires the Sherdan NPC fields used by the prompt", () => {
    const result = npcGeneratorOutputSchema.safeParse({
      ...sampleOutput(),
      properties: {
        ...sampleOutput().properties,
        sensory_details: {
          sight: "Occhi attenti.",
        },
        voice: {
          tone: "piatta",
          speech_patterns: [],
        },
        tics: [],
        weaknesses: [],
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toEqual(
        expect.arrayContaining([
          "properties.sensory_details.smell",
          "properties.sensory_details.sound",
          "properties.voice.speech_patterns",
          "properties.tics",
          "properties.weaknesses",
        ]),
      );
    }
  });

  it("requires all three secret layers for principal NPCs", () => {
    const result = npcGeneratorOutputSchemaForDepth("principale").safeParse(
      sampleOutput({
        secrets: [
          {
            layer: "surface",
            content: "Ha un debito al porto.",
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          "NPC principale richiede almeno un segreto intermediate",
          "NPC principale richiede almeno un segreto deep",
        ]),
      );
    }
  });

  it("rejects deep secrets for cameo NPCs and mismatched narrative metadata", () => {
    const result = npcGeneratorOutputSchemaForDepth("comparsa").safeParse(
      sampleOutput({
        properties: {
          ...sampleOutput().properties,
          extra: {
            ...sampleOutput().properties.extra,
            narrative_depth: "principale",
          },
        },
        secrets: [
          {
            layer: "deep",
            content: "Conosce il nome perduto di Malakor.",
          },
        ],
      }),
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toEqual(
        expect.arrayContaining([
          "Una comparsa non deve introdurre segreti deep",
          "narrative_depth deve essere coerente con l'input (comparsa)",
        ]),
      );
    }
  });
});

function sampleOutput(
  overrides: Partial<NpcGeneratorOutput> = {},
): NpcGeneratorOutput {
  return {
    name: "Capitana Rame",
    public_description:
      "Una capitana portuale severa che conosce ogni molo di Arborea.",
    description:
      "Capitana Rame lavora per tenere il porto stabile, ma usa la Synapse quando la legge non basta.",
    tags: ["npc", "generated", "capitano"],
    properties: {
      race: "umana",
      class: "guerriera",
      level: 7,
      age: "circa 45 anni",
      alignment: "legale neutrale",
      occupation: "capitana portuale",
      appearance_summary:
        "Alta, asciutta, con mani segnate dal sale e occhi che non concedono appello.",
      sensory_details: {
        sight: "Uniforme cerata con cuciture di rame ossidato.",
        smell: "Sale, ozono e tabacco spento.",
        sound: "Stivali pesanti e voce bassa.",
        touch: "Stretta di mano fredda.",
      },
      voice: {
        tone: "calma, autoritaria",
        accent: "portuale",
        speech_patterns: ["frasi brevi", "domande che sembrano ordini"],
      },
      tics: ["controlla sempre le uscite"],
      mannerisms: ["non si siede mai dando le spalle alla porta"],
      motivations: ["mantenere Arborea fuori da una guerra aperta"],
      goals: {
        short_term: "scoprire chi sta comprando guardie del porto",
        medium_term: "tagliare un accordo con la Loggia senza perdere faccia",
        long_term: "rendere il porto indipendente dai ricatti della Synapse",
      },
      weaknesses: [
        {
          description: "Non sacrifica marinai innocenti.",
          who_could_exploit: "Un nemico con ostaggi tra gli scaricatori.",
        },
      ],
      extra: {
        npc_type: "capitano",
        tone: "cupo",
        narrative_depth: "principale",
        location_id: campaignLocationId,
        nearby_faction_ids: [factionId],
        nearby_npc_ids: [nearbyNpcId],
        plot_hooks: ["Sa dove attraccano le navi senza registro."],
        differentiation_note:
          "Piu' istituzionale e meno carismatica degli NPC pirati gia' noti.",
      },
    },
    secrets: [
      {
        layer: "surface",
        content: "Accetta favori dalla Synapse.",
        exploit_hint: "Una ricevuta nascosta nel registro del porto.",
      },
      {
        layer: "intermediate",
        content: "Sta coprendo il figlio di un contrabbandiere.",
        exploit_hint: "Pressione sulla famiglia del ragazzo.",
      },
      {
        layer: "deep",
        content: "Ha venduto una rotta ai nemici per salvare Arborea.",
        exploit_hint: "Un superstite conosce il prezzo pagato.",
      },
    ],
    ...overrides,
  };
}
