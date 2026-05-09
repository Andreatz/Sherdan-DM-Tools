import { describe, expect, it } from "vitest";

import {
  buildSherdanImportReport,
  renderSherdanImportReportMarkdown,
} from "@/lib/import/sherdan-import-report";
import { readSherdanSources } from "../../helpers/sherdan-sources";

const sources = readSherdanSources();

if (!sources) {
  describe.skip("Sherdan import report", () => {
    it("requires local Sherdan source markdown", () => {});
  });
} else {
  describe("Sherdan import report", () => {
    it("summarizes planned rows, duplicate entity rows and unresolved imports", () => {
      const report = buildSherdanImportReport(sources, {
        generatedAt: "2026-05-08T00:00:00.000Z",
      });

      expect(report.plannedEntityRows).toBe(153);
      expect(report.uniqueEntityRecords).toBe(151);
      expect(report.duplicateEntityRows).toHaveLength(2);
      expect(report.plan.unresolvedLinks).toHaveLength(3);
      expect(report.plannedPcHookAssignments).toBe(70);
      expect(report.unresolvedPcHooks).toHaveLength(0);
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
}
