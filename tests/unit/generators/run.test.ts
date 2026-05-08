import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  GeneratorPipelineError,
  runGenerator,
  type Generator,
  type GeneratorPrompt,
} from "@/lib/generators";

const inputSchema = z.object({
  topic: z.string().min(1),
});

const outputSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
});

type Input = z.infer<typeof inputSchema>;
type Context = { facts: string[] };
type Output = z.infer<typeof outputSchema>;
type Persisted = { id: string; title: string };

describe("runGenerator", () => {
  it("runs the generator contract in order", async () => {
    const calls: string[] = [];
    const generator = testGenerator(calls);

    const result = await runGenerator(generator, { topic: "Sherdan" }, {
      requestId: "req-1",
      metadata: { source: "test" },
    });

    expect(calls).toEqual([
      "validateInput",
      "buildContext",
      "buildPrompt",
      "call",
      "validateOutput",
      "persist",
    ]);
    expect(result).toEqual({
      generatorName: "test-generator",
      input: { topic: "Sherdan" },
      context: { facts: ["fact about Sherdan"] },
      prompt: {
        input: [
          {
            role: "user",
            content: "Write about Sherdan: fact about Sherdan",
          },
        ],
        options: { maxTokens: 256, temperature: 0.2 },
      },
      rawOutput: {
        title: "Generated Sherdan",
        body: "fact about Sherdan",
      },
      output: {
        title: "Generated Sherdan",
        body: "fact about Sherdan",
      },
      persisted: {
        id: "generated-sherdan",
        title: "Generated Sherdan",
      },
    });
  });

  it("can skip persistence for preview flows", async () => {
    const calls: string[] = [];
    const result = await runGenerator(testGenerator(calls), { topic: "Preview" }, {
      persist: false,
    });

    expect(calls).not.toContain("persist");
    expect(result.persisted).toBeNull();
  });

  it("wraps validation errors with the failing stage", async () => {
    await expect(runGenerator(testGenerator([]), { topic: "" })).rejects.toMatchObject({
      name: "GeneratorPipelineError",
      generatorName: "test-generator",
      stage: "validateInput",
    } satisfies Partial<GeneratorPipelineError>);
  });

  it("wraps downstream errors with the failing stage", async () => {
    const generator = testGenerator([], {
      call: () => {
        throw new Error("model offline");
      },
    });

    await expect(runGenerator(generator, { topic: "Sherdan" })).rejects.toMatchObject({
      name: "GeneratorPipelineError",
      generatorName: "test-generator",
      stage: "call",
      cause: expect.objectContaining({ message: "model offline" }),
    } satisfies Partial<GeneratorPipelineError>);
  });
});

function testGenerator(
  calls: string[],
  overrides: Partial<Generator<Input, Output, Context, Persisted>> = {},
): Generator<Input, Output, Context, Persisted> {
  return {
    name: "test-generator",
    validateInput(rawInput) {
      calls.push("validateInput");
      return inputSchema.parse(rawInput);
    },
    buildContext(input) {
      calls.push("buildContext");
      return { facts: [`fact about ${input.topic}`] };
    },
    buildPrompt(input, context) {
      calls.push("buildPrompt");
      return {
        input: [
          {
            role: "user",
            content: `Write about ${input.topic}: ${context.facts.join(", ")}`,
          },
        ],
        options: { maxTokens: 256, temperature: 0.2 },
      } satisfies GeneratorPrompt;
    },
    call(_prompt, input, context) {
      calls.push("call");
      return {
        title: `Generated ${input.topic}`,
        body: context.facts.join("\n"),
      };
    },
    validateOutput(rawOutput) {
      calls.push("validateOutput");
      return outputSchema.parse(rawOutput);
    },
    persist(output, input) {
      calls.push("persist");
      return {
        id: `generated-${input.topic.toLowerCase()}`,
        title: output.title,
      };
    },
    ...overrides,
  };
}
