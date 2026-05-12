import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getLogger } from "@/lib/logger";

import { AppError, TooManyRequestsError, ValidationFailedError } from "./errors";

const log = getLogger("api");

// Helper di risposta per route handler. Convenzioni:
// - ok(data, status?)        -> 200 default, JSON body
// - created(data)            -> 201, JSON body
// - noContent()              -> 204, body vuoto (per DELETE)
// - fail(err)                -> mappa AppError/ZodError/unknown a JSON struct.
//
// Forma errore consistente:
//   { "error": { "code": "...", "message": "...", "details": ... } }

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

export function fail(err: unknown): NextResponse {
  // Zod parse errors -> 400 validation_failed
  if (err instanceof ZodError) {
    err = new ValidationFailedError(err.issues);
  }

  if (err instanceof AppError) {
    if (err.status >= 500) {
      log.error(
        { status: err.status, code: err.code, err: err.message },
        "API error (5xx)",
      );
    } else {
      // 4xx: cliente ha sbagliato. Logghiamo a info per diagnosi senza
      // alzare alert (5xx sono il vero "qualcosa non va lato server").
      log.info(
        { status: err.status, code: err.code, err: err.message },
        "API error (4xx)",
      );
    }
    const headers =
      err instanceof TooManyRequestsError
        ? { "Retry-After": String(err.retryAfterSeconds) }
        : undefined;
    return NextResponse.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      },
      { status: err.status, ...(headers ? { headers } : {}) },
    );
  }

  // Errori non tipizzati: 500 generico, dettaglio solo nei log.
  log.error(
    {
      err: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    },
    "API unhandled error",
  );
  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: "Errore interno del server",
      },
    },
    { status: 500 },
  );
}
