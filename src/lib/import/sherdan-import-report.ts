import {
  buildSherdanBootstrapPlan,
  type BootstrapEntity,
  type SherdanBootstrapPlan,
  type SherdanBootstrapSources,
} from "@/lib/import/sherdan-bootstrap-plan";
import {
  countResolvedPcHookAssignments,
  resolvePcHookEntityKeys,
} from "@/lib/import/sherdan-pc-hook-resolution";
import { parseSherdanCampaignMarkdown } from "@/lib/parsers/sherdan-campaign";
import { parseSherdanFactionsMarkdown } from "@/lib/parsers/sherdan-factions";
import { parseSherdanLoreMarkdown } from "@/lib/parsers/sherdan-lore";
import { parseSherdanNpcMarkdown } from "@/lib/parsers/sherdan-npc";
import { parseSherdanPcMarkdown } from "@/lib/parsers/sherdan-pc";

interface SourceRef {
  file: string;
  heading: string;
  line: number;
}

export interface ImportWarning {
  file: string;
  heading: string;
  line: number;
  message: string;
}

export interface DuplicateEntityPlanRow {
  type: string;
  name: string;
  sources: SourceRef[];
}

export interface UnresolvedPcHook {
  pcName: string;
  targetEntityKey: string;
  hookDescription: string;
}

export interface SherdanImportDbSnapshot {
  campaignFound: boolean;
  entitiesTotal: number;
  importedEntities: number;
  importedEntitiesByType: Record<string, number>;
  importedEntitiesWithEmbedding: number;
  importedEntitiesMissingEmbedding: number;
  identities: number;
  secrets: number;
  pcHooks: number;
  entityLinks: number;
  sessions: number;
  plotThreads: number;
  ruleDocuments: number;
}

export interface SherdanImportReport {
  generatedAt: string;
  plan: SherdanBootstrapPlan;
  plannedEntityRows: number;
  uniqueEntityRecords: number;
  plannedEntitiesByType: Record<string, number>;
  duplicateEntityRows: DuplicateEntityPlanRow[];
  parserWarnings: ImportWarning[];
  plannedPcHookAssignments: number;
  unresolvedPcHooks: UnresolvedPcHook[];
  db: SherdanImportDbSnapshot | null;
}

export function buildSherdanImportReport(
  sources: SherdanBootstrapSources,
  options: {
    generatedAt?: string;
    db?: SherdanImportDbSnapshot | null;
  } = {},
): SherdanImportReport {
  const plan = buildSherdanBootstrapPlan(sources);
  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    plan,
    plannedEntityRows: plan.entities.length,
    uniqueEntityRecords: uniqueEntityCount(plan.entities),
    plannedEntitiesByType: countBy(plan.entities, (entity) => entity.type),
    duplicateEntityRows: findDuplicateEntityRows(plan.entities),
    parserWarnings: collectParserWarnings(sources),
    plannedPcHookAssignments: countResolvedPcHookAssignments(plan),
    unresolvedPcHooks: findUnresolvedPcHooks(plan),
    db: options.db ?? null,
  };
}

export function renderSherdanImportReportMarkdown(
  report: SherdanImportReport,
): string {
  const plan = report.plan;
  const identityCount = plan.entities.reduce(
    (sum, entity) => sum + entity.identities.length,
    0,
  );
  const secretCount = plan.entities.reduce(
    (sum, entity) => sum + entity.secrets.length,
    0,
  );

  return [
    "# Sherdan import report",
    "",
    `Generated at: ${report.generatedAt}`,
    "",
    "## Summary",
    "",
    table([
      ["Area", "Planned", "Persisted / DB"],
      [
        "Entities",
        `${report.plannedEntityRows} rows / ${report.uniqueEntityRecords} unique`,
        report.db
          ? `${report.db.importedEntities} imported (${report.db.entitiesTotal} campaign total)`
          : "not checked",
      ],
      ["Identities", String(identityCount), dbValue(report.db?.identities)],
      ["Secrets", String(secretCount), dbValue(report.db?.secrets)],
      [
        "PC hooks",
        `${plan.pcHooks.length} rows / ${report.plannedPcHookAssignments} assignments`,
        dbValue(report.db?.pcHooks),
      ],
      ["Entity links", String(plan.entityLinks.length), dbValue(report.db?.entityLinks)],
      ["Sessions", String(plan.sessions.length), dbValue(report.db?.sessions)],
      ["Plot threads", String(plan.plotThreads.length), dbValue(report.db?.plotThreads)],
      [
        "Rule documents",
        String(plan.ruleDocuments.length),
        dbValue(report.db?.ruleDocuments),
      ],
    ]),
    "",
    "## Planned Entities By Type",
    "",
    table([
      ["Type", "Count"],
      ...Object.entries(report.plannedEntitiesByType).map(([type, count]) => [
        type,
        String(count),
      ]),
    ]),
    "",
    ...(report.db
      ? [
          "## DB Imported Entities By Type",
          "",
          table([
            ["Type", "Count"],
            ...Object.entries(report.db.importedEntitiesByType).map(
              ([type, count]) => [type, String(count)],
            ),
          ]),
          "",
          "## Embeddings",
          "",
          table([
            ["Metric", "Count"],
            ["Imported entities with embedding", String(report.db.importedEntitiesWithEmbedding)],
            [
              "Imported entities missing embedding",
              String(report.db.importedEntitiesMissingEmbedding),
            ],
          ]),
          "",
        ]
      : []),
    "## Skipped / Unresolved",
    "",
    table([
      ["Kind", "Count"],
      ["Duplicate planned entity rows", String(report.duplicateEntityRows.length)],
      ["Unresolved entity links", String(plan.unresolvedLinks.length)],
      ["Unresolved PC hooks", String(report.unresolvedPcHooks.length)],
      ["Parser warnings", String(report.parserWarnings.length)],
    ]),
    "",
    "### Duplicate Planned Entity Rows",
    "",
    bulletList(
      report.duplicateEntityRows.map(
        (duplicate) =>
          `\`${duplicate.type}:${duplicate.name}\` from ${duplicate.sources
            .map((source) => `${source.file}:${source.line} (${source.heading})`)
            .join("; ")}`,
      ),
      "None.",
    ),
    "",
    "### Unresolved Entity Links",
    "",
    bulletList(
      plan.unresolvedLinks.map(
        (link) =>
          `\`${link.sourceEntityKey}\` -> \`${link.targetName}\` (${link.source}, ${link.reason})`,
      ),
      "None.",
    ),
    "",
    "### Unresolved PC Hooks",
    "",
    bulletList(
      report.unresolvedPcHooks.map(
        (hook) =>
          `\`${hook.pcName}\` -> \`${hook.targetEntityKey}\`: ${hook.hookDescription}`,
      ),
      "None.",
    ),
    "",
    "## Parser Warnings",
    "",
    bulletList(
      report.parserWarnings.map(
        (warning) =>
          `${warning.file}:${warning.line} (${warning.heading}) - ${warning.message}`,
      ),
      "None.",
    ),
    "",
  ].join("\n");
}

function collectParserWarnings(sources: SherdanBootstrapSources): ImportWarning[] {
  const warnings: ImportWarning[] = [];

  const campaign = parseSherdanCampaignMarkdown(sources.campaign);
  addWarnings(warnings, { file: "Campagna.md", heading: "Campagna", line: 1 }, campaign.warnings);
  for (const thread of campaign.plotThreads) {
    addWarnings(warnings, thread.source, thread.warnings);
  }
  for (const session of campaign.sessions) {
    addWarnings(warnings, session.source, session.warnings);
  }

  for (const pc of parseSherdanPcMarkdown(sources.backgrounds)) {
    addWarnings(warnings, pc.source, pc.warnings);
  }
  for (const npc of parseSherdanNpcMarkdown(sources.npc)) {
    addWarnings(warnings, npc.source, npc.warnings);
  }
  for (const faction of parseSherdanFactionsMarkdown(sources.factions)) {
    addWarnings(warnings, faction.source, faction.warnings);
    for (const lieutenant of faction.lieutenantEntities) {
      addWarnings(warnings, lieutenant.source, lieutenant.warnings);
    }
  }
  for (const lore of parseSherdanLoreMarkdown(sources.lore)) {
    addWarnings(warnings, lore.source, lore.warnings);
  }

  return warnings;
}

function addWarnings(
  target: ImportWarning[],
  source: SourceRef,
  warnings: string[],
) {
  for (const warning of warnings) {
    target.push({
      file: source.file,
      heading: source.heading,
      line: source.line,
      message: warning,
    });
  }
}

function findDuplicateEntityRows(
  entities: BootstrapEntity[],
): DuplicateEntityPlanRow[] {
  const groups = new Map<string, BootstrapEntity[]>();
  for (const entity of entities) {
    const key = `${entity.type}\0${entity.name}`;
    groups.set(key, [...(groups.get(key) ?? []), entity]);
  }

  return Array.from(groups.values())
    .filter((group) => group.length > 1)
    .map((group) => ({
      type: group[0]?.type ?? "unknown",
      name: group[0]?.name ?? "unknown",
      sources: group.map((entity) => entity.source),
    }));
}

function findUnresolvedPcHooks(plan: SherdanBootstrapPlan): UnresolvedPcHook[] {
  const entityKeys = new Set(plan.entities.map((entity) => entity.key));

  return plan.pcHooks
    .filter(
      (hook) =>
        resolvePcHookEntityKeys(plan.entities, hook.pcName).length === 0 ||
        !entityKeys.has(hook.targetEntityKey),
    )
    .map((hook) => ({
      pcName: hook.pcName,
      targetEntityKey: hook.targetEntityKey,
      hookDescription: hook.hookDescription,
    }));
}

function uniqueEntityCount(entities: BootstrapEntity[]): number {
  return new Set(entities.map((entity) => `${entity.type}\0${entity.name}`)).size;
}

function countBy<T>(items: T[], keyFor: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = keyFor(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function dbValue(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "not checked";
}

function table(rows: string[][]): string {
  const [header, ...body] = rows;
  if (!header) return "";
  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function bulletList(items: string[], emptyText: string): string {
  if (items.length === 0) return emptyText;
  return items.map((item) => `- ${item}`).join("\n");
}
