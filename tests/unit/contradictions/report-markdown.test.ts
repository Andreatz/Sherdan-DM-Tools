import { describe, expect, it } from "vitest";

import { buildContradictionReportMarkdown } from "@/lib/contradictions/report-markdown";

describe("buildContradictionReportMarkdown", () => {
  it("esporta summary, issue e checklist in Markdown", () => {
    const markdown = buildContradictionReportMarkdown({
      campaignName: "Sherdan",
      generatedAt: new Date("2026-05-15T12:00:00.000Z"),
      report: {
        summary: { total: 1, high: 1, medium: 0, low: 0 },
        issues: [
          {
            id: "duplicate-name:test",
            severity: "high",
            category: "duplicate_name",
            title: "Nome entity duplicato: Dante",
            detail: "Due entity condividono lo stesso nome.",
            targets: [
              { type: "entity", id: "entity-1", label: "Dante (npc)" },
            ],
            suggestedAction: "Unifica o rinomina.",
          },
        ],
      },
    });

    expect(markdown).toContain("# Contradiction Detector - Sherdan");
    expect(markdown).toContain("- Totale: 1");
    expect(markdown).toContain("### [HIGH] Nome entity duplicato: Dante");
    expect(markdown).toContain("- [ ] Apri Campaign Wiki");
  });
});
