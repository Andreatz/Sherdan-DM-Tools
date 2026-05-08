import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildSherdanImportReport,
  renderSherdanImportReportMarkdown,
} from "@/lib/import/sherdan-import-report";

const publicDir = path.join(process.cwd(), "public");

const sources = {
  npc: readFileSync(path.join(publicDir, "NPC.md"), "utf8"),
  factions: readFileSync(path.join(publicDir, "Fazioni.md"), "utf8"),
  lore: readFileSync(path.join(publicDir, "Lore.md"), "utf8"),
  campaign: readFileSync(path.join(publicDir, "Campagna.md"), "utf8"),
  backgrounds: readFileSync(
    path.join(publicDir, "Background Personaggi.md"),
    "utf8",
  ),
  playerManual: readFileSync(
    path.join(publicDir, "Manuale del Giocatore.md"),
    "utf8",
  ),
};

describe("Sherdan import report", () => {
  it("summarizes planned rows, duplicate entity rows and unresolved imports", () => {
    const report = buildSherdanImportReport(sources, {
      generatedAt: "2026-05-08T00:00:00.000Z",
    });

    expect(report.plannedEntityRows).toBe(153);
    expect(report.uniqueEntityRecords).toBe(151);
    expect(report.duplicateEntityRows).toHaveLength(2);
    expect(report.plan.unresolvedLinks).toHaveLength(3);
    expect(report.unresolvedPcHooks).toHaveLength(32);
    expect(report.parserWarnings.length).toBeGreaterThan(0);
  });

  it("renders a markdown report with diagnostic sections", () => {
    const report = buildSherdanImportReport(sources, {
      generatedAt: "2026-05-08T00:00:00.000Z",
    });
    const markdown = renderSherdanImportReportMarkdown(report);

    expect(markdown).toContain("# Sherdan import report");
    expect(markdown).toContain("## Skipped / Unresolved");
    expect(markdown).toContain("Duplicate Planned Entity Rows");
    expect(markdown).toContain("Parser Warnings");
    expect(markdown).toContain("NPC.md");
  });
});
