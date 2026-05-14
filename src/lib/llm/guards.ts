import { ServiceUnavailableError } from "@/lib/api/errors";
import { env } from "@/lib/env";

export function ensureLlmEnabledForRoute() {
  if (env.LLM_PROVIDER !== "none") return;
  throw new ServiceUnavailableError(
    "LLM server-side disabilitato (LLM_PROVIDER=none). Usa ChatGPT Web Bridge.",
    { bridgePath: "/chatgpt-bridge" },
  );
}

