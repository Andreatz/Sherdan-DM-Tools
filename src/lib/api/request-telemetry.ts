import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import type { NextRequest, NextResponse } from "next/server";

import { getLogger } from "@/lib/logger";

const log = getLogger("api.route");

export interface ApiRequestContext {
  requestId: string;
}

export async function withApiTelemetry(
  req: NextRequest,
  route: string,
  handler: (ctx: ApiRequestContext) => Promise<Response> | Response,
): Promise<Response> {
  const requestId = req.headers.get("x-request-id") ?? randomUUID();
  const startedAt = performance.now();
  try {
    const response = await handler({ requestId });
    response.headers.set("x-request-id", requestId);
    log.info(
      {
        requestId,
        method: req.method,
        route,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      },
      "api route completed",
    );
    return response;
  } catch (err) {
    log.error(
      {
        requestId,
        method: req.method,
        route,
        durationMs: Math.round(performance.now() - startedAt),
        err: err instanceof Error ? err.message : String(err),
      },
      "api route crashed",
    );
    throw err;
  }
}

export function attachRequestId<T extends NextResponse | Response>(
  response: T,
  requestId: string,
): T {
  response.headers.set("x-request-id", requestId);
  return response;
}
