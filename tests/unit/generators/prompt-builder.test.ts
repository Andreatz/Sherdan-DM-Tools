import { describe, expect, it } from "vitest";

import {
  PromptBuilder,
  PromptBuilderError,
  renderEntityMarkdown,
  renderTemplate,
  type RetrievedGeneratorContext,
} from "@/lib/generators";

describe("PromptBuilder", () => {
  it("builds LLM messages from templates and context placeholders", () => {
    const prompt = new PromptBuilder().build({
      systemTemplate: "Sei il DM di {{campaign}}.",
      userTemplate: "Anchor:\n{{anchor}}\n\nRelated:\n{{related}}",
      context: sampleContext(),
      variables: { campaign: "Sherdan" },
      options: { temperature: 0.2, maxTokens: 512 },
    });

    expect(prompt.options).toEqual({ temperature: 0.2, maxTokens: 512 });
    expect(prompt.input).toEqual([
      { role: "system", content: "Sei il DM di Sherdan." },
      {
        role: "user",
        content: expect.stringContaining("### Malakor"),
      },
    ]);
    expect(JSON.stringify(prompt.input)).toContain("### Dante");
    expect(JSON.stringify(prompt.input)).toContain("#### Secrets");
    expect(JSON.stringify(prompt.input)).toContain("Sa chi indossa la maschera");
  });

  it("renders a rich markdown block for a context entity", () => {
    const context = sampleContext();
    const markdown = renderEntityMarkdown(context.anchor, context);

    expect(markdown).toContain("### Malakor");
    expect(markdown).toContain("- sources: anchor");
    expect(markdown).toContain("#### Public Description");
    expect(markdown).toContain("#### GM Description");
    expect(markdown).toContain("#### Properties");
    expect(markdown).toContain("#### Identities");
    expect(markdown).toContain("Dante Il Fortunato");
    expect(markdown).toContain("#### Relations");
    expect(markdown).toContain("-> Dante: manipulates, strength 5");
  });

  it("supports explicit entity placeholders by id or name", () => {
    const context = sampleContext();

    expect(
      renderTemplate("{{entity:Malakor}}", context),
    ).toContain("### Malakor");
    expect(
      renderTemplate(`{{entity:${context.related[0]!.id}}}`, context),
    ).toContain("### Dante");
  });

  it("throws typed errors for unknown placeholders and missing entities", () => {
    expect(() => renderTemplate("{{unknown}}", sampleContext())).toThrow(
      PromptBuilderError,
    );
    expect(() => renderTemplate("{{entity:Missing}}", sampleContext())).toThrow(
      PromptBuilderError,
    );
    expect(renderTemplate("{{unknown}}", sampleContext(), {}, false)).toBe(
      "{{unknown}}",
    );
  });
});

function sampleContext(): RetrievedGeneratorContext {
  const anchor = {
    id: "00000000-0000-4000-8000-000000000101",
    campaignId: "00000000-0000-4000-8000-000000000001",
    type: "npc",
    name: "Malakor",
    description: "Verita' GM su Malakor.",
    publicDescription: "Dante, mercante fortunato.",
    properties: { occupation: "trickster" },
    tags: ["villain", "mask"],
    parentId: null,
    visibility: "dm_only",
    sources: ["anchor"],
    relations: [
      {
        id: "00000000-0000-4000-8000-000000000201",
        campaignId: "00000000-0000-4000-8000-000000000001",
        sourceEntityId: "00000000-0000-4000-8000-000000000101",
        targetEntityId: "00000000-0000-4000-8000-000000000102",
        relationType: "manipulates",
        publicRelationType: "knows",
        strength: 5,
        description: "Usa Dante come maschera sociale.",
        visibility: "dm_only",
        direction: "outgoing",
      },
    ],
    similarity: null,
    identities: [
      {
        id: "00000000-0000-4000-8000-000000000301",
        entityId: "00000000-0000-4000-8000-000000000101",
        name: "Dante Il Fortunato",
        isTrueIdentity: false,
        appearance: "Sorriso facile.",
        voice: "Calda e teatrale.",
        mannerisms: ["gioca con una moneta"],
        activeFromSession: null,
        activeUntilSession: null,
        visibility: "dm_only",
        notes: "Identita' rubata.",
      },
    ],
    secrets: [],
  } satisfies RetrievedGeneratorContext["anchor"];

  const related = {
    id: "00000000-0000-4000-8000-000000000102",
    campaignId: anchor.campaignId,
    type: "npc",
    name: "Dante",
    description: "Il vero Dante e' scomparso.",
    publicDescription: null,
    properties: {},
    tags: [],
    parentId: null,
    visibility: "dm_only",
    sources: ["relation", "similarity"],
    relations: [],
    similarity: { distance: 0.12, score: 0.88 },
    identities: [],
    secrets: [
      {
        id: "00000000-0000-4000-8000-000000000401",
        entityId: "00000000-0000-4000-8000-000000000102",
        layer: "deep",
        content: "Sa chi indossa la maschera.",
        exploitHint: "Pressione sulla Loggia.",
        discoveredAtSession: null,
        discoveryNotes: null,
      },
    ],
  } satisfies RetrievedGeneratorContext["related"][number];

  return {
    anchor,
    related: [related],
    similar: [related],
    entities: [anchor, related],
    relations: anchor.relations,
    metadata: {
      maxRelated: 1,
      maxSimilar: 1,
      similaritySkipped: false,
    },
  };
}
