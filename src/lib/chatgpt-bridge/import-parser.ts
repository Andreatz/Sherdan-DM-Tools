import type { ChatGptBridgeImportAnalyzeResponse } from "./types";
import { updatePackSchema } from "./schemas";
import type { ChatGptBridgeUpdatePack } from "./schemas";

const UPDATE_PACK_HEADING = /^#\s*UPDATE PACK PER SHERDAN-DM-TOOLS\s*$/im;
const JSON_BLOCK = /```json\s*([\s\S]*?)```/i;

export function analyzeChatGptBridgeImport(input: {
  content: string;
  sessionNumber?: number;
}): ChatGptBridgeImportAnalyzeResponse {
  const warnings: string[] = [];
  const detectedTitle = detectTitle(input.content);
  const detectedSessionNumber =
    input.sessionNumber ?? detectSessionNumber(input.content);
  const updatePackSection = extractUpdatePackSection(input.content);
  let updatePack: ChatGptBridgeUpdatePack | undefined;

  if (updatePackSection) {
    const block = updatePackSection.match(JSON_BLOCK)?.[1];
    if (!block) {
      warnings.push("Sezione UPDATE PACK trovata, ma manca un blocco ```json.");
    } else {
      try {
        const parsed = JSON.parse(block) as unknown;
        const validation = updatePackSchema.safeParse(parsed);
        if (validation.success) updatePack = validation.data;
        else warnings.push("UPDATE PACK JSON trovato ma non valido per lo schema Bridge.");
      } catch (err) {
        warnings.push(
          `UPDATE PACK non parseabile come JSON: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  return {
    ok: true,
    ...(detectedTitle ? { detectedTitle } : {}),
    ...(detectedSessionNumber ? { detectedSessionNumber } : {}),
    hasUpdatePack: Boolean(updatePackSection),
    ...(updatePack ? { updatePack } : {}),
    markdownWithoutUpdatePack: removeUpdatePackSection(input.content).trim(),
    warnings,
  };
}

function detectTitle(content: string) {
  const line = content
    .split(/\r?\n/)
    .find((candidate) => /^#\s+\S/.test(candidate.trim()));
  return line?.replace(/^#\s+/, "").trim();
}

function detectSessionNumber(content: string) {
  const match = content.match(/sessione\s+#?\s*(\d+)/i);
  return match ? Number(match[1]) : undefined;
}

function extractUpdatePackSection(content: string) {
  const match = UPDATE_PACK_HEADING.exec(content);
  if (!match) return null;
  return content.slice(match.index);
}

function removeUpdatePackSection(content: string) {
  const match = UPDATE_PACK_HEADING.exec(content);
  if (!match) return content;
  return content.slice(0, match.index).replace(/\n---\s*$/m, "");
}
