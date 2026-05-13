import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { parseSherdanForgiaMarkdown } from "@/lib/parsers/sherdan-forgia";

const sourceFile = "La Forgia di Sherdan - Sistema di Crafting.md";
// Il file e' in `public/` (Opzione A — vedi docs/decisions.md 2026-05-06).
const markdown = readFileSync(
  join(process.cwd(), "public", sourceFile),
  "utf8",
);

describe("parseSherdanForgiaMarkdown", () => {
  const documents = parseSherdanForgiaMarkdown(markdown);

  it("produces at least one chunk", () => {
    expect(documents.length).toBeGreaterThan(0);
  });

  it("all chunks have source='sherdan-custom' and title=La Forgia", () => {
    for (const doc of documents) {
      expect(doc.source).toBe("sherdan-custom");
      expect(doc.title).toBe("La Forgia di Sherdan");
    }
  });

  it("all chunks have source_kind='forgia' and source_file set", () => {
    for (const doc of documents) {
      expect(doc.metadata.source_kind).toBe("forgia");
      expect(doc.metadata.source_file).toBe(sourceFile);
    }
  });

  it("skips document chrome (Indice, Sistema di Crafting, OGGETTI COMUNI re-statement)", () => {
    for (const doc of documents) {
      expect(doc.metadata.path).not.toContain("Indice");
      expect(doc.section).not.toContain("Sistema di Crafting");
      // "OGGETTI COMUNI" e' chrome (re-statement della Parte), le sotto-categorie
      // sono "Pozioni", "Veleni", ... — devono essere catturate senza il wrapper.
      expect(doc.metadata.path).not.toContain("OGGETTI COMUNI");
    }
  });

  it("captures recipe items like 'Potion of Healing'", () => {
    const potion = documents.find((doc) =>
      doc.section.includes("Potion of Healing"),
    );
    expect(potion).toBeDefined();
    if (!potion) return;
    expect(potion.content.toLowerCase()).toContain("kit da erborista");
    expect(potion.metadata.category).toBe("potions");
  });

  it("captures rules sections (Legenda, Regole Rapide)", () => {
    const legenda = documents.find((doc) =>
      doc.section.includes("Legenda"),
    );
    expect(legenda).toBeDefined();
    if (!legenda) return;
    expect(legenda.metadata.category).toBe("rules");
  });

  it("assigns chunkIndex sequentially starting from 0", () => {
    const indices = documents.map((doc) => doc.chunkIndex);
    expect(indices[0]).toBe(0);
    for (let i = 1; i < indices.length; i += 1) {
      expect(indices[i]).toBe(i);
    }
  });

  it("inferCategory covers main item categories", () => {
    const categories = new Set(documents.map((doc) => doc.metadata.category));
    expect(categories.has("potions")).toBe(true);
    expect(categories.has("poisons")).toBe(true);
    expect(categories.has("rules")).toBe(true);
  });

  it("classifies sections under 'Regole' as chapter='Regole'", () => {
    const legenda = documents.find((doc) => doc.section.includes("Legenda"));
    expect(legenda?.metadata.chapter).toBe("Regole");
  });
});
