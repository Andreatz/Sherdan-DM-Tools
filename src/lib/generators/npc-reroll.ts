import { z } from "zod";

import type { CompleteOptions } from "@/lib/llm";

import type { GeneratorPrompt } from "./types";
import type { NpcGeneratorContext } from "./npc-context";
import type { NpcGeneratorOutput } from "./npc-output";
import {
  npcNameRerollPatchSchema,
  npcSecretRerollPatchSchema,
  npcVoiceRerollPatchSchema,
  type NpcRerollField,
} from "./npc-preview";

export interface NpcRerollPromptInput {
  context: NpcGeneratorContext;
  output: NpcGeneratorOutput;
  field: NpcRerollField;
}

export function buildNpcRerollPrompt(
  input: NpcRerollPromptInput,
): GeneratorPrompt {
  return {
    input: [
      {
        role: "system",
        content: [
          "Sei il re-roll mirato dell'NPC Generator Sherdan.",
          "Rigenera solo il campo richiesto, mantenendo coerenza con l'NPC corrente e con la location.",
          "Rispondi solo con JSON valido conforme allo schema richiesto.",
        ].join("\n"),
      },
      {
        role: "user",
        content: renderNpcRerollUserPrompt(input),
      },
    ],
    options: rerollOptionsForField(input.field),
  };
}

export function npcRerollPatchSchemaForField(field: NpcRerollField) {
  switch (field) {
    case "name":
      return npcNameRerollPatchSchema;
    case "voice":
      return npcVoiceRerollPatchSchema;
    case "surface_secret":
    case "intermediate_secret":
    case "deep_secret":
      return npcSecretRerollPatchSchema;
  }
}

function renderNpcRerollUserPrompt({
  context,
  output,
  field,
}: NpcRerollPromptInput): string {
  const lines = [
    "# Target Field",
    field,
    "",
    "# Input",
    JSON.stringify(context.input, null, 2),
    "",
    "# Location",
    JSON.stringify(
      {
        id: context.location.id,
        name: context.location.name,
        description: context.location.description,
        publicDescription: context.location.publicDescription,
      },
      null,
      2,
    ),
    "",
    "# Nearby Context",
    JSON.stringify(
      {
        factions: context.nearbyFactions.map((entity) => entity.name),
        npcsToAvoid: context.nearbyNpcs.map((entity) => entity.name),
      },
      null,
      2,
    ),
    "",
    "# Style Reference NPC",
    JSON.stringify(
      context.styleReference
        ? {
            id: context.styleReference.id,
            name: context.styleReference.name,
            description: context.styleReference.description,
            publicDescription: context.styleReference.publicDescription,
            properties: context.styleReference.properties,
            secrets: context.styleReference.secrets,
          }
        : null,
      null,
      2,
    ),
    "",
    "# Current NPC",
    JSON.stringify(slimOutput(output), null, 2),
    "",
    "# Field Instructions",
    instructionsForField(field),
  ];

  return lines.join("\n").trim();
}

function instructionsForField(field: NpcRerollField): string {
  switch (field) {
    case "name":
      return 'Return shape: { "name": "string" }. The name must be distinct from nearby NPC names.';
    case "voice":
      return 'Return shape: { "voice": { "tone": "string", "accent": "string optional", "speech_patterns": ["string"] } }. Keep the voice playable at the table.';
    case "surface_secret":
      return 'Return shape: { "secret": { "layer": "surface", "content": "string", "exploit_hint": "string optional" } }. Surface means immediately usable hook, not the deepest truth.';
    case "intermediate_secret":
      return 'Return shape: { "secret": { "layer": "intermediate", "content": "string", "exploit_hint": "string optional" } }. Intermediate means a reveal that complicates loyalties or motives.';
    case "deep_secret":
      return 'Return shape: { "secret": { "layer": "deep", "content": "string", "exploit_hint": "string optional" } }. Deep means campaign-relevant truth with consequences.';
  }
}

function rerollOptionsForField(field: NpcRerollField): CompleteOptions {
  return {
    temperature: field === "name" ? 0.75 : 0.65,
    maxTokens: field === "voice" ? 500 : 360,
    thinking: false,
  };
}

function slimOutput(output: NpcGeneratorOutput): unknown {
  return {
    name: output.name,
    public_description: output.public_description,
    description: output.description,
    voice: output.properties.voice,
    tics: output.properties.tics,
    goals: output.properties.goals,
    weaknesses: output.properties.weaknesses,
    secrets: output.secrets,
  };
}

export type NpcRerollPatch = z.infer<
  ReturnType<typeof npcRerollPatchSchemaForField>
>;
