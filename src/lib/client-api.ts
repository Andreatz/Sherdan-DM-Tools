export class ClientApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
    this.details = details;
  }
}

export async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; details?: unknown };
    };
    return body.error?.message ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export async function apiFetch<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    let details: unknown;
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as {
        error?: { message?: string; details?: unknown };
      };
      message = body.error?.message ?? message;
      details = body.error?.details;
    } catch {
      // Response not JSON.
    }
    throw new ClientApiError(message, response.status, details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function messageForError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
