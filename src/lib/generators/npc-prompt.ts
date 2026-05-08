import type { CompleteOptions } from "@/lib/llm";

import { renderEntityMarkdown } from "./prompt-builder";
import type { GeneratorPrompt } from "./types";
import type { NpcGeneratorContext } from "./npc-context";
import type { NpcNarrativeDepth } from "./npc-input";

export interface NpcGeneratorPromptOptions {
  options?: CompleteOptions;
}

const SECTION_LIMITS = {
  location: 5000,
  factions: 6000,
  nearbyNpcs: 7000,
  otherContext: 5000,
  style: 9000,
} as const;

export function buildNpcGeneratorPrompt(
  context: NpcGeneratorContext,
  options: NpcGeneratorPromptOptions = {},
): GeneratorPrompt {
  return {
    input: [
      {
        role: "system",
        content: NPC_GENERATOR_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: renderNpcGeneratorUserPrompt(context),
      },
    ],
    options: {
      ...defaultOptionsForDepth(context.input.narrativeDepth),
      ...options.options,
    },
  };
}

const NPC_GENERATOR_SYSTEM_PROMPT = [
  "Sei un generatore di NPC per la campagna Sherdan.",
  "Devi creare materiale pronto per il DM, coerente con il contesto fornito e senza contraddire la lore esistente.",
  "Scrivi in italiano. Mantieni un tono concreto, giocabile al tavolo, con dettagli sensoriali specifici.",
  "Non riusare nomi, ruoli o segreti degli NPC vicini: se il contesto mostra figure simili, differenzia il nuovo NPC.",
  "La risposta finale deve essere un JSON object valido, senza markdown esterno.",
].join("\n");

function renderNpcGeneratorUserPrompt(context: NpcGeneratorContext): string {
  const input = context.input;
  const otherNearbyEntities = withoutIds(
    context.nearbyEntities,
    new Set([
      ...context.nearbyFactions.map((entity) => entity.id),
      ...context.nearbyNpcs.map((entity) => entity.id),
    ]),
  );
  const lines = [
    "# NPC Generator Request",
    "",
    "## Input",
    `- tipo richiesto: ${input.npcType}`,
    `- party level: ${input.partyLevel}`,
    `- tone: ${input.tone}`,
    `- narrative depth: ${input.narrativeDepth}`,
    "",
    "## Narrative Depth Rules",
    narrativeDepthInstructions(input.narrativeDepth),
    "",
    "## Location Anchor",
    truncateSection(
      renderEntityMarkdown(context.location, context.retrieved, {
        includeProperties: false,
        includeSecrets: true,
      }),
      SECTION_LIMITS.location,
    ),
    "",
    "## Nearby Factions And Organizations",
    renderEntitiesForPrompt(context, context.nearbyFactions, SECTION_LIMITS.factions),
    "",
    "## Existing Nearby NPCs To Avoid Duplicating",
    renderEntitiesForPrompt(context, context.nearbyNpcs, SECTION_LIMITS.nearbyNpcs),
    "",
    "## Other Nearby Context",
    renderEntitiesForPrompt(context, otherNearbyEntities, SECTION_LIMITS.otherContext),
    "",
    "## Campaign Style Calibration",
    truncateSection(context.style.promptBlock, SECTION_LIMITS.style),
    "",
    "## Required Output Contract",
    outputContract(),
    "",
    "## Quality Bar",
    "- L'NPC deve avere una funzione chiara nella location.",
    "- `appearance_summary` deve essere breve ma evocativo.",
    "- `sensory_details` deve includere almeno sight, smell e sound; touch se utile.",
    "- `voice` deve includere tone e speech_patterns; accent se emerge dal contesto.",
    "- `tics` e `mannerisms` devono essere osservabili in scena.",
    "- `goals` deve distinguere short_term, medium_term e long_term quando il livello narrativo lo consente.",
    "- `weaknesses` deve includere almeno un oggetto con `who_could_exploit`.",
    "- Usa `public_description` per cio' che il mondo/party potrebbe credere e `description` per la verita' GM.",
  ];

  return lines.join("\n").trim();
}

function withoutIds<T extends { id: string }>(items: T[], ids: Set<string>): T[] {
  return items.filter((item) => !ids.has(item.id));
}

function renderEntitiesForPrompt(
  context: NpcGeneratorContext,
  entities: NpcGeneratorContext["nearbyEntities"],
  maxChars: number,
): string {
  if (entities.length === 0) return "_No context entities._";
  const rendered = entities
    .map((entity) =>
      renderEntityMarkdown(entity, context.retrieved, {
        includeProperties: false,
        includeIdentities: true,
        includeSecrets: true,
        includeRelations: true,
      }),
    )
    .join("\n\n---\n\n");
  return truncateSection(rendered, maxChars);
}

function truncateSection(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 64)).trimEnd()}\n\n[section truncated for prompt budget]`;
}

function narrativeDepthInstructions(depth: NpcNarrativeDepth): string {
  switch (depth) {
    case "comparsa":
      return [
        "- Genera una comparsa memorabile ma leggera.",
        "- Mantieni goals e motivazioni semplici.",
        "- Evita segreti profondi; al massimo un surface hook implicito in `extra.plot_hooks`.",
      ].join("\n");
    case "secondario":
      return [
        "- Genera un NPC ricorrente con agenda propria.",
        "- Includi almeno un conflitto pratico e una leva sociale.",
        "- Puoi proporre secrets surface/intermediate se servono, ma non forzare un deep secret.",
      ].join("\n");
    case "principale":
      return [
        "- Genera un NPC centrale, con doppio livello pubblico/GM.",
        "- Includi segreti su tre layer: surface, intermediate e deep.",
        "- I segreti devono essere sfruttabili e collegabili a fazioni, location o briciole future.",
      ].join("\n");
  }
}

function outputContract(): string {
  return `Return exactly this JSON shape:
{
  "name": "string",
  "public_description": "string",
  "description": "string",
  "tags": ["npc", "generated", "..."],
  "properties": {
    "race": "string",
    "class": "string optional",
    "level": "number optional",
    "age": "string optional",
    "alignment": "string optional",
    "occupation": "string optional",
    "appearance_summary": "string",
    "sensory_details": {
      "sight": "string",
      "smell": "string",
      "sound": "string",
      "touch": "string optional"
    },
    "voice": {
      "tone": "string",
      "accent": "string optional",
      "speech_patterns": ["string"]
    },
    "tics": ["string"],
    "mannerisms": ["string"],
    "motivations": ["string"],
    "goals": {
      "short_term": "string",
      "medium_term": "string",
      "long_term": "string"
    },
    "weaknesses": [
      {
        "description": "string",
        "who_could_exploit": "string"
      }
    ],
    "extra": {
      "npc_type": "string",
      "tone": "string",
      "narrative_depth": "string",
      "location_id": "uuid",
      "nearby_faction_ids": ["uuid"],
      "nearby_npc_ids": ["uuid"],
      "plot_hooks": ["string"],
      "differentiation_note": "string"
    }
  },
  "secrets": [
    {
      "layer": "surface | intermediate | deep",
      "content": "string",
      "exploit_hint": "string optional"
    }
  ]
}`;
}

function defaultOptionsForDepth(depth: NpcNarrativeDepth): CompleteOptions {
  switch (depth) {
    case "comparsa":
      return { temperature: 0.55, maxTokens: 1200, thinking: false };
    case "secondario":
      return { temperature: 0.6, maxTokens: 1800, thinking: false };
    case "principale":
      return { temperature: 0.65, maxTokens: 2600, thinking: false };
  }
}
