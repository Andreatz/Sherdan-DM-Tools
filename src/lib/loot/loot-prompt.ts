import type { CompleteOptions } from "@/lib/llm";
import { renderEntityMarkdown } from "@/lib/generators";

import type { DmgBaseGoldResult } from "./dmg-gold";
import type { LootGeneratorContext } from "./loot-context";
import type { LootNarrativeDensity } from "./loot-input";
import { lootSourcePresetOptions } from "./loot-input";

export interface LootGeneratorPromptOptions {
  baseGold: DmgBaseGoldResult;
  options?: CompleteOptions;
}

const SECTION_LIMITS = {
  anchor: 5000,
  related: 9000,
  style: 8000,
} as const;

export function buildLootGeneratorPrompt(
  context: LootGeneratorContext,
  promptOptions: LootGeneratorPromptOptions,
) {
  return {
    input: [
      {
        role: "system" as const,
        content: LOOT_GENERATOR_SYSTEM_PROMPT,
      },
      {
        role: "user" as const,
        content: renderLootGeneratorUserPrompt(context, promptOptions.baseGold),
      },
    ],
    options: {
      ...defaultOptionsForDensity(context.input.narrativeDensity),
      ...promptOptions.options,
    },
  };
}

const LOOT_GENERATOR_SYSTEM_PROMPT = [
  "Sei un generatore di loot per la campagna Sherdan.",
  "Il valore in monete e' gia' determinato da tabelle DMG: non modificarlo e non inventare altro gold.",
  "Genera solo oggetti, materiali, documenti, consumabili o dettagli narrativi convertibili in entity item.",
  "Scrivi in italiano, con dettagli giocabili al tavolo e senza contraddire la lore fornita.",
  "La risposta finale deve essere un JSON object valido, senza markdown esterno.",
].join("\n");

function renderLootGeneratorUserPrompt(
  context: LootGeneratorContext,
  baseGold: DmgBaseGoldResult,
): string {
  const input = context.input;
  const lines = [
    "# Loot Generator Request",
    "",
    "## Input",
    `- sorgente: ${input.source}`,
    `- party level: ${input.partyLevel}`,
    `- narrative density: ${input.narrativeDensity}`,
    `- source presets disponibili per UI: ${lootSourcePresetOptions.join(", ")}`,
    "",
    "## Deterministic Gold",
    `- DMG tier: ${baseGold.tier}`,
    `- mode: ${baseGold.mode}`,
    `- total gp: ${baseGold.totalGp}`,
    `- gp per unit: ${baseGold.gpPerUnit}`,
    `- average coins per unit: ${JSON.stringify(baseGold.averageCoinsPerUnit)}`,
    "",
    "## Narrative Density Rules",
    densityInstructions(input.narrativeDensity),
    "",
    "## Anchor Entity",
    renderAnchor(context),
    "",
    "## Related Lore Context",
    renderRelatedContext(context),
    "",
    "## Campaign Style Calibration",
    truncateSection(context.style.promptBlock, SECTION_LIMITS.style),
    "",
    "## Required Output Contract",
    outputContract(),
    "",
    "## Quality Bar",
    "- Non includere monete dentro `items`: il gold deterministico e' gia' separato.",
    "- Ogni item deve avere una funzione di scena: indizio, leva sociale, componente, utilita' o tentazione.",
    "- Usa `lore_references` quando l'oggetto deriva chiaramente da entita', fazioni, luoghi, materiali o segreti nel contesto.",
    "- Se un riferimento lore ha un id nel contesto, usa `entity_id`; altrimenti usa almeno `entity_name` e `reason`.",
    "- Esempi di direzione: cristallo di Obsidium grezzo da un agente di Tharros; scheggia di pietra-Scissione da un membro dell'Eclissi.",
    "- Se il contesto non giustifica lore specifica, lascia `lore_references` vuoto invece di inventare collegamenti.",
    "- Mantieni gli item riutilizzabili come entity `type='item'`: nomi brevi, descrizioni concrete, tags utili.",
  ];

  return lines.join("\n").trim();
}

function renderAnchor(context: LootGeneratorContext): string {
  if (!context.anchor || !context.retrieved) {
    return "_Nessuna anchor entity: usa la sorgente testuale come vincolo principale._";
  }

  return truncateSection(
    renderEntityMarkdown(context.anchor, context.retrieved, {
      includeProperties: false,
      includeIdentities: true,
      includeSecrets: true,
      includeRelations: true,
    }),
    SECTION_LIMITS.anchor,
  );
}

function renderRelatedContext(context: LootGeneratorContext): string {
  if (!context.retrieved || context.relatedEntities.length === 0) {
    return "_Nessun contesto narrativo correlato recuperato._";
  }

  const rendered = context.relatedEntities
    .map((entity) =>
      renderEntityMarkdown(entity, context.retrieved ?? undefined, {
        includeProperties: false,
        includeIdentities: true,
        includeSecrets: true,
        includeRelations: true,
      }),
    )
    .join("\n\n---\n\n");
  return truncateSection(rendered, SECTION_LIMITS.related);
}

function densityInstructions(density: LootNarrativeDensity): string {
  switch (density) {
    case "sobrio":
      return [
        "- Genera 1-3 item oltre al gold.",
        "- Preferisci oggetti pratici, documenti, componenti comuni o indizi fisici.",
        "- Usa magia e lore rara solo se il contesto la rende davvero pertinente.",
      ].join("\n");
    case "ricco":
      return [
        "- Genera 3-6 item oltre al gold.",
        "- Includi almeno un item memorabile o Sherdan-specifico se il contesto lo sostiene.",
        "- Puoi aggiungere hook e complicazioni collegate agli item, senza forzare segreti nuovi.",
      ].join("\n");
  }
}

function outputContract(): string {
  return `Return exactly this JSON shape:
{
  "narrative_summary": "string",
  "gm_notes": "string optional",
  "hooks": ["string"],
  "items": [
    {
      "name": "string",
      "kind": "weapon | armor | shield | wondrous | consumable | tool | currency | document | artifact | material | trinket",
      "rarity": "common | uncommon | rare | very_rare | legendary | artifact",
      "quantity": 1,
      "value_gp": 25,
      "attunement": false,
      "description": "string",
      "public_description": "string optional",
      "effects": ["string"],
      "mechanics": {},
      "origin": "string optional",
      "tags": ["loot", "generated"],
      "lore_references": [
        {
          "entity_id": "uuid optional",
          "entity_name": "string",
          "reason": "string",
          "source_section": "string optional"
        }
      ],
      "extra": {}
    }
  ]
}`;
}

function defaultOptionsForDensity(density: LootNarrativeDensity): CompleteOptions {
  switch (density) {
    case "sobrio":
      return { temperature: 0.45, maxTokens: 1400, thinking: false };
    case "ricco":
      return { temperature: 0.6, maxTokens: 2200, thinking: false };
  }
}

function truncateSection(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 64)).trimEnd()}\n\n[section truncated for prompt budget]`;
}
