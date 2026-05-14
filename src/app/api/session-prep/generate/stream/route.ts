import type { NextRequest } from "next/server";

import {
  runSessionPrepAgent,
  sessionPrepInputSchema,
  type SessionPrepAgentEvent,
} from "@/lib/session-prep";

function sse(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as unknown;
  const input = sessionPrepInputSchema.parse(body);
  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  async function write(event: string, data: unknown) {
    await writer.write(encoder.encode(sse(event, data)));
  }

  void (async () => {
    try {
      await write("start", { input });
      const result = await runSessionPrepAgent(input, {
        onEvent: async (event: SessionPrepAgentEvent) => {
          await write(event.type, event);
        },
      });
      await write("result", {
        input,
        output: result.output,
        trace: result.trace,
        iterations: result.iterations,
      });
    } catch (err) {
      await write("error", {
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
