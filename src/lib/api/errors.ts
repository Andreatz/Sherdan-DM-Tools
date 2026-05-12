// Errori applicativi tipizzati (CLAUDE.md sez 7). Tutti gli errori che
// vogliamo trasformare in HTTP response strutturate estendono AppError.
// Errori sconosciuti (any throw new Error / TypeError / ecc.) finiscono
// in 500 con messaggio generico (vedi respond.fail).

export class AppError extends Error {
  override readonly name: string = "AppError";
  constructor(
    message: string,
    /** Status HTTP da ritornare. */
    readonly status: number = 500,
    /** Codice machine-readable per i client (es. "not_found"). */
    readonly code: string = "internal_error",
    /** Payload extra (es. issues di Zod, campi che hanno fallito). */
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  override readonly name: string = "NotFoundError";
  constructor(resource: string, id?: string) {
    super(
      `${resource}${id ? ` con id=${id}` : ""} non trovato`,
      404,
      "not_found",
    );
  }
}

export class ValidationFailedError extends AppError {
  override readonly name: string = "ValidationFailedError";
  constructor(details: unknown, message = "Validazione fallita") {
    super(message, 400, "validation_failed", details);
  }
}

export class BadRequestError extends AppError {
  override readonly name: string = "BadRequestError";
  constructor(message: string, details?: unknown) {
    super(message, 400, "bad_request", details);
  }
}

export class UnauthorizedError extends AppError {
  override readonly name: string = "UnauthorizedError";
  constructor(message = "Accesso non autorizzato", details?: unknown) {
    super(message, 401, "unauthorized", details);
  }
}

export class ServiceUnavailableError extends AppError {
  override readonly name: string = "ServiceUnavailableError";
  constructor(message = "Servizio non disponibile", details?: unknown) {
    super(message, 503, "service_unavailable", details);
  }
}

export class ConflictError extends AppError {
  override readonly name: string = "ConflictError";
  constructor(message: string, details?: unknown) {
    super(message, 409, "conflict", details);
  }
}

export class TooManyRequestsError extends AppError {
  override readonly name: string = "TooManyRequestsError";
  /** Secondi suggeriti prima di riprovare (per header Retry-After). */
  readonly retryAfterSeconds: number;
  constructor(
    message = "Troppe richieste, riprova tra poco.",
    retryAfterSeconds: number = 60,
    details?: unknown,
  ) {
    super(message, 429, "too_many_requests", details);
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
  }
}
