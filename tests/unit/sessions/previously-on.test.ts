import { describe, expect, it } from "vitest";

import {
  buildPreviouslyOnPrompt,
  previouslyOnInputSchema,
  previouslyOnOutputSchema,
} from "@/lib/sessions/previously-on";

describe("previously on generator", () => {
  it("builds a prompt from recap only", () => {
    const prompt = buildPreviouslyOnPrompt({
      number: 6,
      title: "La soglia nera",
      recap: "Il party ha trovato [[Malakor]] sotto la torre.",
    });

    const rendered = Array.isArray(prompt.input)
      ? prompt.input.map((message) => message.content).join("\n")
      : prompt.input;
    expect(rendered).toContain("Il party ha trovato [[Malakor]]");
    expect(rendered).toContain("Usa esclusivamente il recap fornito");
    expect(rendered).not.toContain("dm_notes");
    expect(rendered).not.toContain("prep_notes");
  });

  it("validates input and structured output", () => {
    expect(
      previouslyOnInputSchema.parse({
        sessionId: "11111111-1111-4111-8111-111111111111",
      }),
    ).toEqual({ sessionId: "11111111-1111-4111-8111-111111111111" });

    expect(
      previouslyOnOutputSchema.parse({
        previously_on: "Nelle puntate precedenti...",
      }),
    ).toEqual({ previously_on: "Nelle puntate precedenti..." });
  });
});
