export const ENTITY_EMBEDDING_DIMENSIONS = 1024;
const MAX_EMBEDDING_TEXT_CHARS = 900;

export interface EntityEmbeddingTextInput {
  type: string;
  name: string;
  description: string | null;
  publicDescription: string | null;
  properties: unknown;
  tags: string[];
  visibility: string;
}

export function buildEntityEmbeddingText(
  entity: EntityEmbeddingTextInput,
): string {
  const parts = [
    `Tipo: ${entity.type}`,
    `Nome: ${entity.name}`,
    `Visibilita': ${entity.visibility}`,
    entity.tags.length > 0 ? `Tag: ${entity.tags.join(", ")}` : null,
    section("Descrizione pubblica", entity.publicDescription),
    section("Verita' GM", entity.description),
    section("Proprieta' strutturate", stringifyProperties(entity.properties)),
  ].filter(isNonEmpty);

  return truncateForEmbedding(parts.join("\n\n"));
}

export function assertEmbeddingDimensions(vector: number[]): void {
  if (vector.length !== ENTITY_EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch: atteso ${ENTITY_EMBEDDING_DIMENSIONS}, ricevuto ${vector.length}`,
    );
  }
}

function section(title: string, content: string | null | undefined): string | null {
  const normalized = normalizeWhitespace(content ?? "");
  return normalized ? `${title}:\n${normalized}` : null;
}

function stringifyProperties(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return normalizeWhitespace(JSON.stringify(value, null, 2));
}

function normalizeWhitespace(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function truncateForEmbedding(value: string): string {
  if (value.length <= MAX_EMBEDDING_TEXT_CHARS) return value;
  return `${value.slice(0, MAX_EMBEDDING_TEXT_CHARS - 36).trimEnd()}\n\n[contenuto troncato per embedding]`;
}

function isNonEmpty(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}
