import { describe, expect, it, vi } from "vitest";

import { apiFetch, ClientApiError, messageForError } from "@/lib/client-api";

describe("client-api", () => {
  it("parsa JSON sulle risposte ok", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

    await expect(apiFetch<{ ok: boolean }>("/api/test")).resolves.toEqual({
      ok: true,
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/test", {
      headers: { "Content-Type": "application/json" },
    });
    fetchMock.mockRestore();
  });

  it("estrae messaggio API error tipizzato", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { message: "Payload invalido", details: { field: "name" } },
          }),
          { status: 400 },
        ),
      );

    await expect(apiFetch("/api/test")).rejects.toMatchObject({
      name: "ClientApiError",
      message: "Payload invalido",
      status: 400,
      details: { field: "name" },
    } satisfies Partial<ClientApiError>);
    fetchMock.mockRestore();
  });

  it("normalizza messaggi da errori sconosciuti", () => {
    expect(messageForError(new Error("boom"))).toBe("boom");
    expect(messageForError("plain")).toBe("plain");
  });
});
