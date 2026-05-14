import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("env LLM_PROVIDER=none", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.resetModules();
  });

  it("passa senza API key", async () => {
    vi.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      LLM_PROVIDER: "none",
      GOOGLE_AI_API_KEY: "",
      OPENAI_API_KEY: "",
    };

    const mod = await import("@/lib/env");
    expect(mod.env.LLM_PROVIDER).toBe("none");
  });

  it("espone un provider disabilitato esplicito", async () => {
    vi.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      LLM_PROVIDER: "none",
      GOOGLE_AI_API_KEY: "",
      OPENAI_API_KEY: "",
    };

    const { getLLMProvider } = await import("@/lib/llm");
    await expect(getLLMProvider().complete("ciao")).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining("LLM_PROVIDER=none"),
    });
  });

  it("blocca route generative server-side con errore esplicito", async () => {
    vi.resetModules();
    process.env = {
      ...ORIGINAL_ENV,
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      LLM_PROVIDER: "none",
      GOOGLE_AI_API_KEY: "",
      OPENAI_API_KEY: "",
    };

    const { ensureLlmEnabledForRoute } = await import("@/lib/llm/guards");
    expect(() => ensureLlmEnabledForRoute()).toThrow(
      "LLM server-side disabilitato",
    );
  });
});
