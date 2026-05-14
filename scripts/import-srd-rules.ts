// pnpm db:import:srd-rules [--all-spells] [--limit-spells=50] [--dry-run]
//
// Importa rule sections + spells SRD 2014 da D&D 5e API come rule_documents.
// Source: https://www.dnd5eapi.co/api/2014

import "dotenv/config";

import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { z } from "zod";

import * as schema from "@/db/schema";
import { env } from "@/lib/env";

const BASE_URL = "https://www.dnd5eapi.co";
const SOURCE = "srd-2014";
const DEFAULT_SPELL_INDEXES = [
  "invisibility",
  "fireball",
  "counterspell",
  "dispel-magic",
  "detect-magic",
  "mage-armor",
  "shield",
] as const;

const listSchema = z.object({
  results: z.array(
    z.object({
      index: z.string(),
      name: z.string(),
      url: z.string(),
    }),
  ),
});

const ruleSectionSchema = z
  .object({
    index: z.string(),
    name: z.string(),
    desc: z.string(),
    url: z.string(),
  })
  .passthrough();

const spellSchema = z
  .object({
    index: z.string(),
    name: z.string(),
    desc: z.array(z.string()).default([]),
    higher_level: z.array(z.string()).optional(),
    range: z.string().optional(),
    components: z.array(z.string()).optional(),
    material: z.string().optional(),
    duration: z.string().optional(),
    concentration: z.boolean().optional(),
    casting_time: z.string().optional(),
    level: z.number().optional(),
    url: z.string(),
  })
  .passthrough();

interface Args {
  dryRun: boolean;
  allSpells: boolean;
  limitSpells: number | null;
}

interface Draft {
  title: string;
  section: string;
  chunkIndex: number;
  content: string;
  metadata: Record<string, unknown>;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(sql, { schema });
  const drafts = await buildDrafts(args);
  let created = 0;
  let updated = 0;

  try {
    if (!args.dryRun) {
      for (const draft of drafts) {
        const didUpdate = await upsertRuleDocument(db, draft);
        if (didUpdate) updated += 1;
        else created += 1;
      }
    }
  } finally {
    await sql.end();
  }

  process.stdout.write(
    JSON.stringify(
      {
        source: SOURCE,
        dryRun: args.dryRun,
        scanned: drafts.length,
        created,
        updated,
      },
      null,
      2,
    ),
  );
  process.stdout.write("\n");
}

async function buildDrafts(args: Args): Promise<Draft[]> {
  const [ruleSections, spells] = await Promise.all([
    fetchList("/api/2014/rule-sections"),
    fetchList("/api/2014/spells"),
  ]);
  const selectedSpells = args.allSpells
    ? args.limitSpells === null
      ? spells
      : spells.slice(0, args.limitSpells)
    : spells.filter((spell) => DEFAULT_SPELL_INDEXES.includes(spell.index as never));

  const ruleDrafts = await Promise.all(
    ruleSections.map(async (entry, index) => {
      const detail = ruleSectionSchema.parse(await fetchJson(entry.url));
      return {
        title: "D&D 5e SRD 2014",
        section: `Rules > ${detail.name}`,
        chunkIndex: index,
        content: detail.desc,
        metadata: {
          source_kind: "srd-rule-section",
          index: detail.index,
          url: `${BASE_URL}${detail.url}`,
        },
      };
    }),
  );

  const spellDrafts = await Promise.all(
    selectedSpells.map(async (entry, index) => {
      const detail = spellSchema.parse(await fetchJson(entry.url));
      return {
        title: "D&D 5e SRD 2014",
        section: `Spells > ${detail.name}`,
        chunkIndex: 10_000 + index,
        content: renderSpell(detail),
        metadata: {
          source_kind: "srd-spell",
          index: detail.index,
          url: `${BASE_URL}${detail.url}`,
          level: detail.level ?? null,
        },
      };
    }),
  );

  return [...ruleDrafts, ...spellDrafts];
}

async function fetchList(path: string) {
  return listSchema.parse(await fetchJson(path)).results;
}

async function fetchJson(path: string) {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`D&D 5e API HTTP ${res.status}: ${url}`);
  return res.json();
}

async function upsertRuleDocument(
  db: ReturnType<typeof drizzle<typeof schema>>,
  draft: Draft,
): Promise<boolean> {
  const existing = await db
    .select({ id: schema.ruleDocuments.id })
    .from(schema.ruleDocuments)
    .where(
      and(
        eq(schema.ruleDocuments.source, SOURCE),
        eq(schema.ruleDocuments.title, draft.title),
        eq(schema.ruleDocuments.section, draft.section),
      ),
    )
    .limit(50);

  const values = {
    source: SOURCE,
    title: draft.title,
    section: draft.section,
    content: draft.content,
    chunkIndex: draft.chunkIndex,
    metadata: draft.metadata,
    embedding: null,
  };

  if (existing[0]) {
    await db
      .update(schema.ruleDocuments)
      .set(values)
      .where(eq(schema.ruleDocuments.id, existing[0].id));
    const duplicateIds = existing.slice(1).map((row) => row.id);
    if (duplicateIds.length > 0) {
      await db
        .delete(schema.ruleDocuments)
        .where(inArray(schema.ruleDocuments.id, duplicateIds));
    }
    return true;
  }
  await db.insert(schema.ruleDocuments).values(values);
  return false;
}

function renderSpell(spell: z.infer<typeof spellSchema>) {
  const lines = [
    `# ${spell.name}`,
    "",
    `Level: ${spell.level ?? "?"}`,
    spell.casting_time ? `Casting time: ${spell.casting_time}` : null,
    spell.range ? `Range: ${spell.range}` : null,
    spell.components ? `Components: ${spell.components.join(", ")}` : null,
    spell.material ? `Material: ${spell.material}` : null,
    spell.duration ? `Duration: ${spell.duration}` : null,
    spell.concentration !== undefined
      ? `Concentration: ${spell.concentration ? "yes" : "no"}`
      : null,
    "",
    ...spell.desc,
    ...(spell.higher_level?.length
      ? ["", "At Higher Levels", ...spell.higher_level]
      : []),
  ];
  return lines.filter((line): line is string => line !== null).join("\n");
}

function parseArgs(argv: string[]): Args {
  const args: Args = { dryRun: false, allSpells: false, limitSpells: null };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--all-spells") args.allSpells = true;
    else if (arg.startsWith("--limit-spells=")) {
      const value = Number(arg.slice("--limit-spells=".length));
      if (!Number.isInteger(value) || value < 0) {
        throw new Error("--limit-spells richiede un intero >= 0");
      }
      args.limitSpells = value;
    } else {
      throw new Error(`Argomento non riconosciuto: ${arg}`);
    }
  }
  return args;
}

void main();
