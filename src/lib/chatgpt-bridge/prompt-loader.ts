import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { architectPromptFull, architectPromptSummary } from "./prompt-templates";

const PROMPT_FILENAMES = [
  "Agente AI Worldbuilding.md",
  "Agente AI Worlbuilding.md",
] as const;

export interface LoadedArchitectPrompt {
  full: string;
  summary: string;
  source: string;
  warning?: string;
}

export function loadArchitectPrompt(): LoadedArchitectPrompt {
  const contentDir = path.join(process.cwd(), "content", "sherdan");
  for (const filename of PROMPT_FILENAMES) {
    const filePath = path.join(contentDir, filename);
    if (existsSync(filePath)) {
      const full = readFileSync(filePath, "utf8").trim();
      return {
        full,
        summary: extractSummary(full),
        source: `content/sherdan/${filename}`,
      };
    }
  }

  return {
    full: architectPromptFull,
    summary: architectPromptSummary,
    source: "fallback interno",
    warning:
      "Prompt Architetto di Mondi non trovato in content/sherdan/: uso fallback sintetico.",
  };
}

function extractSummary(full: string) {
  const normalized = full.trim();
  const marker = "\n## 3.";
  const markerIndex = normalized.indexOf(marker);
  if (markerIndex > 0) {
    return normalized.slice(0, markerIndex).trim();
  }

  const max = 6_000;
  return normalized.length > max ? `${normalized.slice(0, max).trim()}\n\n[...]` : normalized;
}

