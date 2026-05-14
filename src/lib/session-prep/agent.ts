import { z } from "zod";

import { callStructuredOutputLogged } from "@/lib/generators";
import type { LLMProvider } from "@/lib/llm";
import { getLogger } from "@/lib/logger";

import { sessionPrepOutputSchema, type SessionPrepInput, type SessionPrepOutput } from "./schemas";
import { sessionPrepTools, type SessionPrepTool } from "./tools";

// Agent loop "structured output ricorsivo": il modello produce a ogni
// turno un JSON `{ action: "call_tool" | "respond", ... }`. Se chiede un
// tool, lo eseguiamo, accodiamo il risultato al contesto e ripetiamo. Se
// risponde, parsiamo l'output finale via `sessionPrepOutputSchema`.
//
// Nessun function calling SDK-level: e' compatibile sia con Gemini che
// con Ollama tramite `completeStructured` esistente.

const log = getLogger("session-prep.agent");

const DEFAULT_MAX_ITERATIONS = 8;

/** Step intermedio del loop. Usato anche dalla UI per la trace view. */
export interface SessionPrepTrace {
  toolName: string;
  args: unknown;
  /** Risultato troncato per la trace; il loop usa il valore completo. */
  resultPreview: string;
  durationMs: number;
}

export interface SessionPrepRunResult {
  output: SessionPrepOutput;
  trace: SessionPrepTrace[];
  iterations: number;
}

export type SessionPrepAgentEvent =
  | { type: "iteration_start"; iteration: number }
  | { type: "tool_start"; iteration: number; toolName: string; args: unknown }
  | { type: "tool_result"; iteration: number; trace: SessionPrepTrace }
  | { type: "tool_error"; iteration: number; toolName: string; message: string }
  | { type: "done"; iterations: number; trace: SessionPrepTrace[] };

export interface SessionPrepAgentOptions {
  /** Override LLM provider (test). */
  llm?: LLMProvider;
  /** Override toolbox (test). */
  tools?: ReadonlyArray<SessionPrepTool<unknown, unknown>>;
  /** Hard cap su iterazioni. Default 8. */
  maxIterations?: number;
  /** Eventi progressivi per route SSE/UI streaming. */
  onEvent?: (event: SessionPrepAgentEvent) => void | Promise<void>;
}

// Schema "decisione" del modello a ogni turno. discriminated union.
const decisionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("call_tool"),
      toolName: z.string().min(1),
      args: z.unknown(),
      /** Spiegazione breve per audit trace. */
      reasoning: z.string().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("respond"),
      output: sessionPrepOutputSchema,
    })
    .strict(),
]);
type Decision = z.infer<typeof decisionSchema>;

const SYSTEM_PROMPT = `Sei l'assistente prep sessione di un Dungeon Master di D&D 5e.
La campagna usa lo stile narrativo "Sherdan": pattern centrali
1. Identita' multiple: alcune entita' sono in realta' qualcun altro (es. Malakor che si presenta come Dante). Usa get_active_identities per evitare di spoilerare la vera identita' nelle proposte player-facing (es. "previously on").
2. Segreti stratificati: surface < intermediate < deep. La sessione e' una performance dove il party riceve la versione percepita; il prep coordina cosa rivelare gradualmente.
3. Propaganda vs verita': ogni entita' / plot thread ha description (GM truth) e publicDescription (versione percepita). Per il "previously on" usa solo cio' che il party sa.
4. Briciole di verita': non rivelare verita' brute; proponi briciole indirette che il party deve mettere insieme.
5. Hook PG: privilegia i PC hooks con status "available" non ancora usati nelle ultime sessioni.

Come operi:
- Hai a disposizione tool read-only per leggere lo stato della campagna. Chiamali quando ti servono dati che non hai gia'.
- A ogni turno scegli UN'AZIONE:
  - "call_tool" con toolName + args validi -> verra' eseguito e il risultato comparira' nel prossimo turno;
  - "respond" con l'output finale strutturato (hooks, npcSeeds, encounterSeeds, suggestedClues, previouslyOn, notes).
- Sii efficiente: di solito 3-5 tool call bastano (recap recenti, plot threads, identita', truth_progress, eventualmente 1-2 search_entities mirate). Non chiamare lo stesso tool con gli stessi args due volte.

Tono delle proposte: concreto, narrativo, sherdan-aware. Niente generico "il party incontra una guardia"; preferisci "Una guardia tharrosiana ferita chiede asilo politico al party, e cerca di farsi credere disertore mentre raccoglie informazioni per il suo Sigillo".

Se il DM specifica un focus (es. "voglio piantare due briciole su Malakor"), tutte le proposte privilegiano quella direzione.

Importante: nelle proposte player-facing (previouslyOn, hookDescription) usa solo la versione percepita. La verita' GM va in "rationale" e "truthRevealed".`;

function userPrompt(input: SessionPrepInput): string {
  const lines = [
    `Campagna: ${input.campaignId}`,
    `Party: livello ${input.partyLevel}, ${input.partySize} giocatori`,
  ];
  if (input.locationId) {
    lines.push(`Location corrente: ${input.locationId}`);
  } else {
    lines.push(
      "Location corrente: non specificata. Inferisci dalle ultime sessioni o dai plot thread caldi.",
    );
  }
  if (input.vibe) lines.push(`Vibe richiesto: ${input.vibe}`);
  if (input.focus) lines.push(`Focus: ${input.focus}`);
  lines.push(
    "",
    "Produci un prep sessione coerente con lo stato corrente. Usa i tool prima di rispondere.",
  );
  return lines.join("\n");
}

function describeToolForPrompt<TArgs, TResult>(
  tool: SessionPrepTool<TArgs, TResult>,
): string {
  return `- ${tool.name}: ${tool.description}`;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}... [troncato, totale ${value.length} char]`;
}

export async function runSessionPrepAgent(
  input: SessionPrepInput,
  options: SessionPrepAgentOptions = {},
): Promise<SessionPrepRunResult> {
  const toolbox = (options.tools ?? sessionPrepTools) as ReadonlyArray<
    SessionPrepTool<unknown, unknown>
  >;
  const maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const toolMap = new Map(toolbox.map((tool) => [tool.name, tool]));

  const toolsDescription = toolbox.map(describeToolForPrompt).join("\n");
  const conversation: string[] = [
    userPrompt(input),
    "",
    "Tool disponibili:",
    toolsDescription,
    "",
    "Rispondi sempre come JSON che combaci col discriminator schema (action: call_tool | respond).",
  ];

  const trace: SessionPrepTrace[] = [];

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    await options.onEvent?.({ type: "iteration_start", iteration });
    const decision = await callStructuredOutputLogged({
      schema: decisionSchema as z.ZodType<Decision>,
      prompt: {
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: conversation.join("\n") },
        ],
        options: { temperature: 0.4, maxTokens: 4000 },
      },
      logContext: {
        generatorName: "session-prep",
        campaignId: input.campaignId,
        input,
        metadata: { iteration, phase: "agent-decision" },
      },
      runOptions: options.llm ? { llm: options.llm } : undefined,
    });

    if (decision.action === "respond") {
      log.info(
        {
          campaignId: input.campaignId,
          iterations: iteration,
          toolCalls: trace.length,
        },
        "session-prep agent done",
      );
      await options.onEvent?.({ type: "done", iterations: iteration, trace });
      return { output: decision.output, trace, iterations: iteration };
    }

    // call_tool
    const tool = toolMap.get(decision.toolName);
    if (!tool) {
      const message = `Tool sconosciuto: ${decision.toolName}. Tool disponibili: ${Array.from(toolMap.keys()).join(", ")}`;
      await options.onEvent?.({
        type: "tool_error",
        iteration,
        toolName: decision.toolName,
        message,
      });
      conversation.push("", `[errore tool call iter ${iteration}]`, message);
      continue;
    }
    let parsedArgs: unknown;
    try {
      parsedArgs = tool.argsSchema.parse(decision.args);
    } catch (err) {
      const message = `Args invalidi per ${decision.toolName}: ${err instanceof Error ? err.message : String(err)}`;
      await options.onEvent?.({
        type: "tool_error",
        iteration,
        toolName: decision.toolName,
        message,
      });
      conversation.push("", `[errore tool args iter ${iteration}]`, message);
      continue;
    }

    const startedAt = Date.now();
    let result: unknown;
    try {
      await options.onEvent?.({
        type: "tool_start",
        iteration,
        toolName: decision.toolName,
        args: parsedArgs,
      });
      result = await tool.execute(input.campaignId, parsedArgs);
    } catch (err) {
      const message = `Tool ${decision.toolName} ha fallito: ${err instanceof Error ? err.message : String(err)}`;
      log.warn(
        { campaignId: input.campaignId, tool: decision.toolName, err: message },
        "session-prep tool failed",
      );
      await options.onEvent?.({
        type: "tool_error",
        iteration,
        toolName: decision.toolName,
        message,
      });
      conversation.push("", `[errore tool exec iter ${iteration}]`, message);
      continue;
    }
    const durationMs = Date.now() - startedAt;
    const serialized = JSON.stringify(result);
    trace.push({
      toolName: decision.toolName,
      args: parsedArgs,
      resultPreview: truncate(serialized, 200),
      durationMs,
    });
    await options.onEvent?.({
      type: "tool_result",
      iteration,
      trace: trace[trace.length - 1]!,
    });

    conversation.push(
      "",
      `[tool ${decision.toolName} eseguito - iter ${iteration}]`,
      `args: ${JSON.stringify(parsedArgs)}`,
      `result: ${truncate(serialized, 3000)}`,
    );
  }

  throw new SessionPrepAgentError(
    "max_iterations",
    `Agent non ha completato in ${maxIterations} iterazioni. Trace: ${trace
      .map((step) => step.toolName)
      .join(" -> ")}`,
  );
}

export class SessionPrepAgentError extends Error {
  override readonly name = "SessionPrepAgentError";
  constructor(
    readonly code: "max_iterations",
    message: string,
  ) {
    super(message);
  }
}
