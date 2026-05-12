import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  SessionPrepAgentError,
  runSessionPrepAgent,
  type SessionPrepTool,
} from "@/lib/session-prep";
import type {
  CompleteOptions,
  LLMInput,
  LLMProvider,
} from "@/lib/llm";

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";

// Fake tool deterministico. L'agent loop riceve un toolbox custom, cosi'
// possiamo iniettare risposte controllate senza toccare il DB.
function fakeTool<TArgs, TResult>(opts: {
  name: string;
  result: TResult;
  argsSchema?: z.ZodType<TArgs>;
}): SessionPrepTool<TArgs, TResult> {
  return {
    name: opts.name,
    description: `mocked ${opts.name}`,
    argsSchema:
      opts.argsSchema ?? (z.object({}).strict() as unknown as z.ZodType<TArgs>),
    async execute() {
      return opts.result;
    },
  };
}

// Fake LLM provider che ritorna una sequenza pre-pianificata di decisioni
// sotto forma di structured output.
class ScriptedProvider implements LLMProvider {
  private cursor = 0;
  readonly calls: Array<{ input: LLMInput }> = [];

  constructor(private readonly script: unknown[]) {}

  complete(): Promise<string> {
    throw new Error("complete non usato");
  }

  async completeStructured<T>(
    input: LLMInput,
    _schema: z.ZodType<T>,
    _options?: CompleteOptions,
  ): Promise<T> {
    void _schema;
    void _options;
    this.calls.push({ input });
    const next = this.script[this.cursor];
    if (next === undefined) {
      throw new Error("ScriptedProvider: script esaurito");
    }
    this.cursor += 1;
    return next as T;
  }

  async *stream(): AsyncIterable<string> {
    throw new Error("stream non usato");
  }
  embed(): Promise<number[]> {
    throw new Error("embed non usato");
  }
  embedBatch(): Promise<number[][]> {
    throw new Error("embedBatch non usato");
  }
}

const VALID_OUTPUT = {
  previouslyOn: "Il party rientra a Lunacupa dopo l'attacco al porto.",
  hooks: [],
  npcSeeds: [],
  encounterSeeds: [],
  suggestedClues: [],
  notes: ["Bellamy senza spotlight dalla S3"],
};

describe("runSessionPrepAgent", () => {
  it("esegue call_tool -> respond e accumula la trace", async () => {
    const provider = new ScriptedProvider([
      {
        action: "call_tool",
        toolName: "get_recent_sessions",
        args: {},
        reasoning: "mi serve il contesto recente",
      },
      {
        action: "respond",
        output: VALID_OUTPUT,
      },
    ]);

    const result = await runSessionPrepAgent(
      {
        campaignId: CAMPAIGN_ID,
        partyLevel: 5,
        partySize: 4,
        vibe: "intrigo politico",
      },
      {
        llm: provider,
        tools: [
          fakeTool({
            name: "get_recent_sessions",
            result: [{ id: "s1", number: 1, recap: "..." }],
          }),
        ],
      },
    );

    expect(result.iterations).toBe(2);
    expect(result.trace).toHaveLength(1);
    expect(result.trace[0]?.toolName).toBe("get_recent_sessions");
    expect(result.output.previouslyOn).toContain("Lunacupa");
    expect(provider.calls).toHaveLength(2);
  });

  it("gestisce tool sconosciuto come errore e continua il loop", async () => {
    const provider = new ScriptedProvider([
      {
        action: "call_tool",
        toolName: "tool_inesistente",
        args: {},
      },
      {
        action: "respond",
        output: VALID_OUTPUT,
      },
    ]);

    const result = await runSessionPrepAgent(
      { campaignId: CAMPAIGN_ID, partyLevel: 5, partySize: 4 },
      { llm: provider, tools: [] },
    );

    expect(result.iterations).toBe(2);
    // Il tool sconosciuto non finisce nella trace (e' solo nel
    // conversation history come errore).
    expect(result.trace).toHaveLength(0);
  });

  it("gestisce args invalidi come errore e continua il loop", async () => {
    const provider = new ScriptedProvider([
      {
        action: "call_tool",
        toolName: "echo",
        // args invalidi: lo schema richiede `text` stringa.
        args: { wrong: 42 },
      },
      {
        action: "respond",
        output: VALID_OUTPUT,
      },
    ]);

    const echoTool = fakeTool({
      name: "echo",
      result: { ok: true },
      argsSchema: z.object({ text: z.string() }).strict(),
    });

    const result = await runSessionPrepAgent(
      { campaignId: CAMPAIGN_ID, partyLevel: 5, partySize: 4 },
      { llm: provider, tools: [echoTool] },
    );
    expect(result.iterations).toBe(2);
    expect(result.trace).toHaveLength(0);
  });

  it("solleva SessionPrepAgentError quando supera maxIterations", async () => {
    // Provider che chiama sempre lo stesso tool, mai respond.
    const looping = new ScriptedProvider(
      Array.from({ length: 10 }, () => ({
        action: "call_tool",
        toolName: "noop",
        args: {},
      })),
    );

    await expect(
      runSessionPrepAgent(
        { campaignId: CAMPAIGN_ID, partyLevel: 5, partySize: 4 },
        {
          llm: looping,
          tools: [fakeTool({ name: "noop", result: { ok: true } })],
          maxIterations: 3,
        },
      ),
    ).rejects.toBeInstanceOf(SessionPrepAgentError);
  });
});
