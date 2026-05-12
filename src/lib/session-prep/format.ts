import type { SessionPrepOutput } from "./schemas";

// Serializzazione Markdown del prep, usata per appendere a
// `sessions.prep_notes`. Volutamente sezioni separate e parsabili a
// occhio: niente template grafici complessi.

export function formatSessionPrepAsMarkdown(
  output: SessionPrepOutput,
  meta: { generatedAt: Date; vibe?: string; focus?: string } = {
    generatedAt: new Date(),
  },
): string {
  const date = meta.generatedAt.toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`## Session Prep (generato ${date})`);
  if (meta.vibe) lines.push(`*Vibe:* ${meta.vibe}`);
  if (meta.focus) lines.push(`*Focus:* ${meta.focus}`);
  lines.push("");

  lines.push("### Previously on...");
  lines.push(output.previouslyOn.trim());
  lines.push("");

  if (output.hooks.length > 0) {
    lines.push("### Hooks proposti");
    for (const hook of output.hooks) {
      lines.push(
        `- **${hook.pcName} → ${hook.targetName}**: ${hook.hookDescription}`,
      );
      lines.push(`  - *Arco potenziale:* ${hook.potentialArc}`);
      lines.push(`  - *Perche':* ${hook.rationale}`);
    }
    lines.push("");
  }

  if (output.npcSeeds.length > 0) {
    lines.push("### NPC seeds");
    for (const npc of output.npcSeeds) {
      const tag = npc.existingEntityId ? "esistente" : "nuovo";
      lines.push(
        `- **${npc.name}** (${tag}, ${npc.proposedType}): ${npc.narrativeRole}`,
      );
      lines.push(`  - *Tono:* ${npc.tone}`);
      lines.push(`  - *Perche':* ${npc.rationale}`);
    }
    lines.push("");
  }

  if (output.encounterSeeds.length > 0) {
    lines.push("### Encounter seeds");
    for (const enc of output.encounterSeeds) {
      lines.push(`- **${enc.title}** (${enc.difficultyHint}): ${enc.concept}`);
      lines.push(`  - *Creature ipotizzate:* ${enc.creatureHints.join(", ")}`);
      lines.push(`  - *Perche':* ${enc.rationale}`);
    }
    lines.push("");
  }

  if (output.suggestedClues.length > 0) {
    lines.push("### Briciole suggerite");
    for (const clue of output.suggestedClues) {
      const thread = clue.plotThreadTitle ?? "(nessun thread)";
      lines.push(`- **${thread}**: ${clue.description}`);
      lines.push(`  - *Verita' GM:* ${clue.truthRevealed}`);
      lines.push(`  - *Perche':* ${clue.rationale}`);
    }
    lines.push("");
  }

  if (output.notes.length > 0) {
    lines.push("### Note dell'agent");
    for (const note of output.notes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}
