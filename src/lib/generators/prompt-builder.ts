import type { CompleteOptions } from "@/lib/llm";

import type { ContextEntity, RetrievedGeneratorContext } from "./context-retriever";
import type { GeneratorPrompt } from "./types";

export type PromptVariableValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export interface PromptBuilderInput {
  systemTemplate?: string;
  userTemplate: string;
  context: RetrievedGeneratorContext;
  variables?: Record<string, PromptVariableValue>;
  options?: CompleteOptions;
  strict?: boolean;
}

export interface EntityMarkdownOptions {
  includeDescriptions?: boolean;
  includeProperties?: boolean;
  includeIdentities?: boolean;
  includeSecrets?: boolean;
  includeRelations?: boolean;
}

export class PromptBuilderError extends Error {
  override readonly name = "PromptBuilderError";

  constructor(
    readonly code: "unknown_placeholder" | "missing_entity",
    message: string,
    readonly placeholder?: string,
  ) {
    super(message);
  }
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.:-]+)\s*\}\}/g;

export class PromptBuilder {
  build(input: PromptBuilderInput): GeneratorPrompt {
    const strict = input.strict ?? true;
    const render = (template: string) =>
      renderTemplate(template, input.context, input.variables ?? {}, strict);

    const user = render(input.userTemplate);
    const system = input.systemTemplate ? render(input.systemTemplate) : null;

    return {
      input: system
        ? [
            { role: "system", content: system },
            { role: "user", content: user },
          ]
        : user,
      options: input.options,
    };
  }
}

export function renderTemplate(
  template: string,
  context: RetrievedGeneratorContext,
  variables: Record<string, PromptVariableValue> = {},
  strict = true,
): string {
  return template.replaceAll(PLACEHOLDER_RE, (match, rawPlaceholder: string) => {
    const placeholder = rawPlaceholder.trim();
    const resolved = resolvePlaceholder(placeholder, context, variables);

    if (resolved !== null) return resolved;
    if (!strict) return match;

    throw new PromptBuilderError(
      "unknown_placeholder",
      `Placeholder prompt sconosciuto: ${placeholder}`,
      placeholder,
    );
  });
}

export function renderEntityMarkdown(
  entity: ContextEntity,
  context?: RetrievedGeneratorContext,
  options: EntityMarkdownOptions = {},
): string {
  const resolvedOptions = {
    includeDescriptions: true,
    includeProperties: true,
    includeIdentities: true,
    includeSecrets: true,
    includeRelations: true,
    ...options,
  };
  const lines = [
    `### ${entity.name}`,
    `- id: ${entity.id}`,
    `- type: ${entity.type}`,
    `- visibility: ${entity.visibility}`,
    `- sources: ${entity.sources.join(", ") || "context"}`,
  ];

  if (entity.tags.length > 0) {
    lines.push(`- tags: ${entity.tags.join(", ")}`);
  }
  if (entity.similarity) {
    lines.push(
      `- similarity: score ${formatNumber(entity.similarity.score)}, distance ${formatNumber(
        entity.similarity.distance,
      )}`,
    );
  }
  if (resolvedOptions.includeDescriptions && entity.publicDescription) {
    lines.push("", "#### Public Description", entity.publicDescription.trim());
  }
  if (resolvedOptions.includeDescriptions && entity.description) {
    lines.push("", "#### GM Description", entity.description.trim());
  }
  if (resolvedOptions.includeProperties && isMeaningfulProperties(entity.properties)) {
    lines.push("", "#### Properties", fencedJson(entity.properties));
  }
  if (
    resolvedOptions.includeIdentities &&
    entity.identities.length > 0
  ) {
    lines.push("", "#### Identities");
    for (const identity of entity.identities) {
      const flags = [
        identity.isTrueIdentity ? "true identity" : null,
        identity.visibility,
      ].filter(Boolean);
      lines.push(
        `- **${identity.name}**${flags.length > 0 ? ` (${flags.join(", ")})` : ""}`,
      );
      if (identity.appearance) lines.push(`  - appearance: ${identity.appearance}`);
      if (identity.voice) lines.push(`  - voice: ${identity.voice}`);
      if (identity.notes) lines.push(`  - notes: ${identity.notes}`);
      if (hasArrayItems(identity.mannerisms)) {
        lines.push(`  - mannerisms: ${identity.mannerisms.join(", ")}`);
      }
    }
  }
  if (resolvedOptions.includeSecrets && entity.secrets.length > 0) {
    lines.push("", "#### Secrets");
    for (const secret of entity.secrets) {
      lines.push(`- **${secret.layer}**: ${secret.content}`);
      if (secret.exploitHint) lines.push(`  - exploit: ${secret.exploitHint}`);
      if (secret.discoveryNotes) lines.push(`  - discovery: ${secret.discoveryNotes}`);
    }
  }
  if (resolvedOptions.includeRelations && entity.relations.length > 0) {
    const nameById = context
      ? new Map(context.entities.map((item) => [item.id, item.name]))
      : new Map<string, string>();
    lines.push("", "#### Relations");
    for (const relation of entity.relations) {
      const otherId =
        relation.direction === "outgoing"
          ? relation.targetEntityId
          : relation.sourceEntityId;
      const arrow = relation.direction === "outgoing" ? "->" : "<-";
      const otherName = nameById.get(otherId) ?? otherId;
      const strength =
        relation.strength === null ? "" : `, strength ${relation.strength}`;
      lines.push(
        `- ${arrow} ${otherName}: ${relation.relationType}${strength} (${relation.visibility})`,
      );
      if (relation.description) lines.push(`  - ${relation.description}`);
      if (relation.publicRelationType) {
        lines.push(`  - public: ${relation.publicRelationType}`);
      }
    }
  }

  return lines.join("\n").trim();
}

export function renderContextMarkdown(
  context: RetrievedGeneratorContext,
  entities: ContextEntity[] = context.entities,
): string {
  if (entities.length === 0) return "_No context entities._";
  return entities
    .map((entity) => renderEntityMarkdown(entity, context))
    .join("\n\n---\n\n");
}

function resolvePlaceholder(
  placeholder: string,
  context: RetrievedGeneratorContext,
  variables: Record<string, PromptVariableValue>,
): string | null {
  if (placeholder in variables) {
    return stringifyVariable(variables[placeholder]);
  }

  switch (placeholder) {
    case "anchor":
      return renderEntityMarkdown(context.anchor, context);
    case "related":
      return renderContextMarkdown(context, context.related);
    case "similar":
      return renderContextMarkdown(context, context.similar);
    case "entities":
    case "context":
      return renderContextMarkdown(context);
    case "relations":
      return renderRelationsMarkdown(context);
  }

  if (placeholder.startsWith("entity:")) {
    const query = placeholder.slice("entity:".length);
    const entity = findEntity(context, query);
    if (!entity) {
      throw new PromptBuilderError(
        "missing_entity",
        `Entity non trovata per placeholder: ${placeholder}`,
        placeholder,
      );
    }
    return renderEntityMarkdown(entity, context);
  }

  return null;
}

function renderRelationsMarkdown(context: RetrievedGeneratorContext): string {
  if (context.relations.length === 0) return "_No relations._";
  const nameById = new Map(context.entities.map((entity) => [entity.id, entity.name]));

  return context.relations
    .map((relation) => {
      const source = nameById.get(relation.sourceEntityId) ?? relation.sourceEntityId;
      const target = nameById.get(relation.targetEntityId) ?? relation.targetEntityId;
      const strength =
        relation.strength === null ? "" : `, strength ${relation.strength}`;
      return `- ${source} -> ${target}: ${relation.relationType}${strength} (${relation.visibility})`;
    })
    .join("\n");
}

function findEntity(
  context: RetrievedGeneratorContext,
  query: string,
): ContextEntity | null {
  const normalized = normalize(query);
  return (
    context.entities.find(
      (entity) => entity.id === query || normalize(entity.name) === normalized,
    ) ?? null
  );
}

function stringifyVariable(value: PromptVariableValue): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function fencedJson(value: unknown): string {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function isMeaningfulProperties(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length > 0
  );
}

function hasArrayItems(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function formatNumber(value: number): string {
  return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
