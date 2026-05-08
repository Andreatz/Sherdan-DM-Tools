import type { EntityTypeName } from "@/lib/validation";

import type { ContextSecretRecord } from "./context-retriever";
import type { PromptVariableValue } from "./prompt-builder";

export interface StyleCalibratorEntity {
  id: string;
  type: EntityTypeName;
  name: string;
  description: string | null;
  publicDescription: string | null;
  properties: unknown;
  tags?: string[];
  secrets?: ContextSecretRecord[];
}

export interface StyleCalibratorOptions {
  maxExamples?: number;
  maxExampleChars?: number;
}

export interface StyleDescriptionStats {
  describedEntities: number;
  averageWords: number;
  medianWords: number;
  averageChars: number;
}

export interface StyleFeatureStats {
  sensoryDetailsRatio: number;
  voiceRatio: number;
  ticsRatio: number;
  goalsRatio: number;
  weaknessesRatio: number;
  publicDescriptionRatio: number;
}

export interface StyleToneSignal {
  key: string;
  label: string;
  hits: number;
}

export interface StyleExample {
  entityId: string;
  name: string;
  type: EntityTypeName;
  score: number;
  reasons: string[];
  markdown: string;
}

export interface StyleProfile {
  entitiesAnalyzed: number;
  entityTypes: Record<string, number>;
  description: StyleDescriptionStats;
  features: StyleFeatureStats;
  secretsByLayer: Record<"surface" | "intermediate" | "deep", number>;
  toneSignals: StyleToneSignal[];
  guidance: string[];
}

export interface StyleCalibrationResult {
  profile: StyleProfile;
  examples: StyleExample[];
  promptBlock: string;
}

interface ToneDictionary {
  key: string;
  label: string;
  terms: string[];
}

const DEFAULT_MAX_EXAMPLES = 4;
const DEFAULT_MAX_EXAMPLE_CHARS = 900;

const TONE_DICTIONARIES: ToneDictionary[] = [
  {
    key: "grimdark",
    label: "dark fantasy / grimdark",
    terms: [
      "ombra",
      "morte",
      "sangue",
      "paura",
      "colpa",
      "vendetta",
      "brucia",
      "corrotto",
      "segreto",
      "trauma",
    ],
  },
  {
    key: "political_intrigue",
    label: "intrigo politico",
    terms: [
      "fazione",
      "consiglio",
      "loggia",
      "synapse",
      "potere",
      "guerra",
      "traditore",
      "propaganda",
      "alleato",
      "resistenza",
    ],
  },
  {
    key: "industrial_arcane",
    label: "arcano-industriale",
    terms: [
      "obsidium",
      "metallo",
      "ingranaggio",
      "motore",
      "fucina",
      "macchina",
      "tecnologia",
      "cristallo",
      "vapore",
      "tharros",
    ],
  },
  {
    key: "sensory",
    label: "scrittura multi-sensoriale",
    terms: [
      "odore",
      "suono",
      "voce",
      "pelle",
      "mani",
      "occhi",
      "freddo",
      "fumo",
      "sale",
      "cenere",
    ],
  },
];

export class StyleCalibrator {
  calibrate(
    entities: StyleCalibratorEntity[],
    options: StyleCalibratorOptions = {},
  ): StyleCalibrationResult {
    const profile = buildStyleProfile(entities);
    const examples = selectStyleExamples(entities, {
      maxExamples: options.maxExamples ?? DEFAULT_MAX_EXAMPLES,
      maxExampleChars: options.maxExampleChars ?? DEFAULT_MAX_EXAMPLE_CHARS,
    });

    return {
      profile,
      examples,
      promptBlock: renderStyleCalibrationMarkdown(profile, examples),
    };
  }
}

export function styleCalibrationToPromptVariables(
  calibration: StyleCalibrationResult,
): Record<string, PromptVariableValue> {
  return {
    style: calibration.promptBlock,
    style_entities_analyzed: calibration.profile.entitiesAnalyzed,
  };
}

export function buildStyleProfile(
  entities: StyleCalibratorEntity[],
): StyleProfile {
  const described = entities
    .map((entity) => descriptionText(entity))
    .filter((text) => text.length > 0);
  const wordCounts = described.map(countWords).sort((left, right) => left - right);
  const charCounts = described.map((text) => text.length);
  const denominator = entities.length || 1;

  const profile: StyleProfile = {
    entitiesAnalyzed: entities.length,
    entityTypes: countBy(entities, (entity) => entity.type),
    description: {
      describedEntities: described.length,
      averageWords: round(average(wordCounts)),
      medianWords: round(median(wordCounts)),
      averageChars: round(average(charCounts)),
    },
    features: {
      sensoryDetailsRatio: ratio(
        entities.filter((entity) => hasSensoryDetails(entity.properties)).length,
        denominator,
      ),
      voiceRatio: ratio(
        entities.filter((entity) => hasVoiceDetails(entity.properties)).length,
        denominator,
      ),
      ticsRatio: ratio(
        entities.filter((entity) => hasArrayField(entity.properties, "tics")).length,
        denominator,
      ),
      goalsRatio: ratio(
        entities.filter((entity) => hasGoals(entity.properties)).length,
        denominator,
      ),
      weaknessesRatio: ratio(
        entities.filter((entity) => hasArrayField(entity.properties, "weaknesses")).length,
        denominator,
      ),
      publicDescriptionRatio: ratio(
        entities.filter((entity) => Boolean(entity.publicDescription?.trim())).length,
        denominator,
      ),
    },
    secretsByLayer: {
      surface: countSecrets(entities, "surface"),
      intermediate: countSecrets(entities, "intermediate"),
      deep: countSecrets(entities, "deep"),
    },
    toneSignals: detectToneSignals(entities),
    guidance: [],
  };

  profile.guidance = buildGuidance(profile);
  return profile;
}

export function renderStyleCalibrationMarkdown(
  profile: StyleProfile,
  examples: StyleExample[],
): string {
  const lines = [
    "## Style Calibration",
    "",
    `- Entities analyzed: ${profile.entitiesAnalyzed}`,
    `- Average description: ${profile.description.averageWords} words (${profile.description.averageChars} chars)`,
    `- Median description: ${profile.description.medianWords} words`,
    `- Entity mix: ${formatCounts(profile.entityTypes)}`,
    `- Features: sensory ${formatPercent(profile.features.sensoryDetailsRatio)}, voice ${formatPercent(
      profile.features.voiceRatio,
    )}, tics ${formatPercent(profile.features.ticsRatio)}, goals ${formatPercent(
      profile.features.goalsRatio,
    )}, weaknesses ${formatPercent(profile.features.weaknessesRatio)}`,
    `- Secrets: surface ${profile.secretsByLayer.surface}, intermediate ${profile.secretsByLayer.intermediate}, deep ${profile.secretsByLayer.deep}`,
    `- Tone signals: ${profile.toneSignals.map((signal) => signal.label).join(", ") || "none"}`,
    "",
    "### Guidance",
    ...profile.guidance.map((item) => `- ${item}`),
  ];

  if (examples.length > 0) {
    lines.push("", "### Few-shot Style Examples");
    for (const example of examples) {
      lines.push("", example.markdown);
    }
  }

  return lines.join("\n").trim();
}

function selectStyleExamples(
  entities: StyleCalibratorEntity[],
  options: Required<StyleCalibratorOptions>,
): StyleExample[] {
  return entities
    .map((entity) => scoreExample(entity, options.maxExampleChars))
    .filter((example) => example.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, options.maxExamples);
}

function scoreExample(
  entity: StyleCalibratorEntity,
  maxExampleChars: number,
): StyleExample {
  const reasons: string[] = [];
  let score = 0;
  const description = descriptionText(entity);
  const properties = isRecord(entity.properties) ? entity.properties : {};
  const secrets = entity.secrets ?? [];

  if (description.length > 120) {
    score += 3;
    reasons.push("rich description");
  } else if (description.length > 0) {
    score += 1;
    reasons.push("description");
  }
  if (hasSensoryDetails(properties)) {
    score += 2;
    reasons.push("sensory details");
  }
  if (hasVoiceDetails(properties)) {
    score += 2;
    reasons.push("voice");
  }
  if (hasArrayField(properties, "tics")) {
    score += 2;
    reasons.push("tics");
  }
  if (hasGoals(properties)) {
    score += 1;
    reasons.push("goals");
  }
  if (hasArrayField(properties, "weaknesses")) {
    score += 1;
    reasons.push("weaknesses");
  }
  if (secrets.length > 0) {
    score += Math.min(3, secrets.length);
    reasons.push("layered secrets");
  }

  return {
    entityId: entity.id,
    name: entity.name,
    type: entity.type,
    score,
    reasons,
    markdown: renderExampleMarkdown(entity, reasons, maxExampleChars),
  };
}

function renderExampleMarkdown(
  entity: StyleCalibratorEntity,
  reasons: string[],
  maxExampleChars: number,
): string {
  const properties = isRecord(entity.properties) ? entity.properties : {};
  const lines = [
    `#### ${entity.name} (${entity.type})`,
    `- Signals: ${reasons.join(", ") || "description"}`,
  ];
  const description = truncate(descriptionText(entity), maxExampleChars);
  if (description) {
    lines.push("", description);
  }

  const details = compact([
    renderSensorySummary(properties),
    renderVoiceSummary(properties),
    renderArraySummary(properties, "tics", "Tics"),
    renderGoalsSummary(properties),
    renderSecretsSummary(entity.secrets ?? []),
  ]);
  if (details.length > 0) {
    lines.push("", ...details);
  }

  return lines.join("\n").trim();
}

function buildGuidance(profile: StyleProfile): string[] {
  const guidance = [
    "Keep generated prose close to the campaign's average description length unless the narrative level asks for more depth.",
  ];

  if (profile.features.sensoryDetailsRatio >= 0.25) {
    guidance.push("Use concrete sensory detail, especially sight, smell and sound.");
  }
  if (profile.features.voiceRatio >= 0.2) {
    guidance.push("Give important NPCs a recognizable voice profile and speech pattern.");
  }
  if (profile.features.ticsRatio >= 0.2) {
    guidance.push("Include small behavioral tics instead of generic personality labels.");
  }
  if (profile.secretsByLayer.surface + profile.secretsByLayer.deep > 0) {
    guidance.push("Separate surface hooks from deeper truths; do not flatten secrets into one reveal.");
  }
  if (profile.features.weaknessesRatio >= 0.15) {
    guidance.push("When creating antagonists, include a concrete exploitable weakness.");
  }
  for (const signal of profile.toneSignals.slice(0, 3)) {
    guidance.push(`Lean into ${signal.label} when it fits the prompt.`);
  }

  return unique(guidance);
}

function detectToneSignals(entities: StyleCalibratorEntity[]): StyleToneSignal[] {
  const corpus = entities
    .map((entity) =>
      [
        entity.name,
        entity.description,
        entity.publicDescription,
        ...(entity.tags ?? []),
        JSON.stringify(entity.properties),
        ...(entity.secrets ?? []).map((secret) => secret.content),
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ")
    .toLowerCase();

  return TONE_DICTIONARIES.map((dictionary) => ({
    key: dictionary.key,
    label: dictionary.label,
    hits: dictionary.terms.reduce(
      (sum, term) => sum + occurrences(corpus, term),
      0,
    ),
  }))
    .filter((signal) => signal.hits > 0)
    .sort((left, right) => right.hits - left.hits);
}

function descriptionText(entity: StyleCalibratorEntity): string {
  return [entity.publicDescription, entity.description]
    .filter((text): text is string => Boolean(text?.trim()))
    .join("\n\n")
    .trim();
}

function hasSensoryDetails(properties: unknown): boolean {
  if (!isRecord(properties)) return false;
  const direct = properties.sensory_details;
  const atmosphere = isRecord(properties.atmosphere)
    ? properties.atmosphere
    : null;
  return hasMeaningfulRecord(direct) || hasMeaningfulRecord(atmosphere);
}

function hasVoiceDetails(properties: unknown): boolean {
  if (!isRecord(properties)) return false;
  return hasMeaningfulRecord(properties.voice);
}

function hasGoals(properties: unknown): boolean {
  if (!isRecord(properties)) return false;
  return hasMeaningfulRecord(properties.goals);
}

function hasArrayField(properties: unknown, key: string): boolean {
  if (!isRecord(properties)) return false;
  const value = properties[key];
  return Array.isArray(value) && value.length > 0;
}

function hasMeaningfulRecord(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return Object.values(value).some((item) =>
    Array.isArray(item) ? item.length > 0 : Boolean(String(item ?? "").trim()),
  );
}

function renderSensorySummary(properties: Record<string, unknown>): string | null {
  const sensory = isRecord(properties.sensory_details)
    ? properties.sensory_details
    : isRecord(properties.atmosphere)
      ? properties.atmosphere
      : null;
  if (!sensory) return null;
  const entries = Object.entries(sensory)
    .filter(([, value]) => Boolean(String(value ?? "").trim()))
    .map(([key, value]) => `${key}: ${String(value)}`);
  return entries.length > 0 ? `- Sensory: ${entries.join("; ")}` : null;
}

function renderVoiceSummary(properties: Record<string, unknown>): string | null {
  if (!isRecord(properties.voice)) return null;
  const entries = Object.entries(properties.voice)
    .filter(([, value]) =>
      Array.isArray(value) ? value.length > 0 : Boolean(String(value ?? "").trim()),
    )
    .map(([key, value]) =>
      Array.isArray(value) ? `${key}: ${value.join(", ")}` : `${key}: ${String(value)}`,
    );
  return entries.length > 0 ? `- Voice: ${entries.join("; ")}` : null;
}

function renderArraySummary(
  properties: Record<string, unknown>,
  key: string,
  label: string,
): string | null {
  const value = properties[key];
  if (!Array.isArray(value) || value.length === 0) return null;
  return `- ${label}: ${value.map(String).join(", ")}`;
}

function renderGoalsSummary(properties: Record<string, unknown>): string | null {
  if (!isRecord(properties.goals)) return null;
  const entries = Object.entries(properties.goals)
    .filter(([, value]) => Boolean(String(value ?? "").trim()))
    .map(([key, value]) => `${key}: ${String(value)}`);
  return entries.length > 0 ? `- Goals: ${entries.join("; ")}` : null;
}

function renderSecretsSummary(secrets: ContextSecretRecord[]): string | null {
  if (secrets.length === 0) return null;
  return `- Secrets: ${secrets
    .map((secret) => `${secret.layer}: ${secret.content}`)
    .join(" | ")}`;
}

function countSecrets(
  entities: StyleCalibratorEntity[],
  layer: "surface" | "intermediate" | "deep",
): number {
  return entities.reduce(
    (sum, entity) =>
      sum + (entity.secrets ?? []).filter((secret) => secret.layer === layer).length,
    0,
  );
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 1) return values[middle] ?? 0;
  return ((values[middle - 1] ?? 0) + (values[middle] ?? 0)) / 2;
}

function ratio(value: number, total: number): number {
  return round(value / total, 3);
}

function round(value: number, decimals = 0): number {
  const multiplier = 10 ** decimals;
  return Math.round(value * multiplier) / multiplier;
}

function countBy<T>(items: T[], keyFor: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const key = keyFor(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function formatCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort((left, right) => right[1] - left[1]);
  return entries.length > 0
    ? entries.map(([key, value]) => `${key} ${value}`).join(", ")
    : "none";
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function occurrences(corpus: string, term: string): number {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return Array.from(corpus.matchAll(new RegExp(`\\b${escaped}\\b`, "g"))).length;
}

function truncate(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 34)).trimEnd()}\n\n[example truncated for prompt budget]`;
}

function compact(items: Array<string | null>): string[] {
  return items.filter((item): item is string => Boolean(item));
}

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
