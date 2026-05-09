import "dotenv/config";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import {
  buildSherdanBootstrapPlan,
  type BootstrapEntity,
  type BootstrapEntityLink,
  type BootstrapIdentity,
  type BootstrapPcHook,
  type BootstrapPlotThread,
  type BootstrapRuleDocument,
  type BootstrapSecret,
  type BootstrapSession,
  type SherdanBootstrapPlan,
} from "@/lib/import/sherdan-bootstrap-plan";
import { resolvePcHookEntityKeys } from "@/lib/import/sherdan-pc-hook-resolution";
import { env } from "@/lib/env";

const SHERDAN_NAME = "Sherdan";
const SHERDAN_SOURCE_FILES = [
  "NPC.md",
  "Fazioni.md",
  "Lore.md",
  "Campagna.md",
  "Background Personaggi.md",
  "Manuale del Giocatore.md",
] as const;

type Db = ReturnType<typeof drizzle<typeof schema>>;

interface SherdanSources {
  npc: string;
  factions: string;
  lore: string;
  campaign: string;
  backgrounds: string;
  playerManual: string;
  sourceDir: string;
}

interface ImportStats {
  campaignsCreated: number;
  campaignsUpdated: number;
  entitiesCreated: number;
  entitiesUpdated: number;
  identitiesCreated: number;
  identitiesUpdated: number;
  secretsCreated: number;
  secretsSkipped: number;
  sessionsCreated: number;
  sessionsUpdated: number;
  plotThreadsCreated: number;
  plotThreadsUpdated: number;
  ruleDocumentsCreated: number;
  ruleDocumentsUpdated: number;
  pcHooksCreated: number;
  pcHooksExisting: number;
  pcHooksUnresolved: number;
  deferredLinks: number;
  entityLinksCreated: number;
  entityLinksUpdated: number;
  entityLinksUnresolved: number;
}

async function main() {
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(sql, { schema });

  try {
    const sources = readSherdanSources();
    const plan = buildSherdanBootstrapPlan(sources);
    const stats = await importPlan(db, plan, sources.sourceDir);

    console.log("[ok] Bootstrap Sherdan completato");
    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await sql.end();
  }
}

async function importPlan(
  db: Db,
  plan: SherdanBootstrapPlan,
  sourceDir: string,
): Promise<ImportStats> {
  const stats: ImportStats = {
    campaignsCreated: 0,
    campaignsUpdated: 0,
    entitiesCreated: 0,
    entitiesUpdated: 0,
    identitiesCreated: 0,
    identitiesUpdated: 0,
    secretsCreated: 0,
    secretsSkipped: 0,
    sessionsCreated: 0,
    sessionsUpdated: 0,
    plotThreadsCreated: 0,
    plotThreadsUpdated: 0,
    ruleDocumentsCreated: 0,
    ruleDocumentsUpdated: 0,
    pcHooksCreated: 0,
    pcHooksExisting: 0,
    pcHooksUnresolved: 0,
    deferredLinks: plan.deferredLinks.length,
    entityLinksCreated: 0,
    entityLinksUpdated: 0,
    entityLinksUnresolved: plan.unresolvedLinks.length,
  };

  const campaignId = await ensureSherdanCampaign(db, stats, sourceDir);
  const entityIds = new Map<string, string>();

  for (const entity of plan.entities.filter((entity) => !entity.parentKey)) {
    const entityId = await upsertEntity(db, campaignId, entity, null, stats);
    entityIds.set(entity.key, entityId);
  }

  for (const entity of plan.entities.filter((entity) => entity.parentKey)) {
    const parentId = entity.parentKey ? entityIds.get(entity.parentKey) : null;
    const entityId = await upsertEntity(db, campaignId, entity, parentId ?? null, stats);
    entityIds.set(entity.key, entityId);
  }

  for (const entity of plan.entities) {
    const entityId = entityIds.get(entity.key);
    if (!entityId) continue;

    for (const identity of entity.identities) {
      await upsertIdentity(db, entityId, identity, stats);
    }

    for (const secret of entity.secrets) {
      await ensureSecret(db, campaignId, entityId, secret, stats);
    }
  }

  for (const session of plan.sessions) {
    await upsertSession(db, campaignId, session, stats);
  }

  for (const thread of plan.plotThreads) {
    await upsertPlotThread(db, campaignId, thread, stats);
  }

  for (const document of plan.ruleDocuments) {
    await upsertRuleDocument(db, document, stats);
  }

  for (const hook of plan.pcHooks) {
    const targetEntityId = entityIds.get(hook.targetEntityKey);
    const pcEntityKeys = resolvePcHookEntityKeys(plan.entities, hook.pcName);
    if (!targetEntityId || pcEntityKeys.length === 0) {
      stats.pcHooksUnresolved += 1;
      continue;
    }
    for (const pcEntityKey of pcEntityKeys) {
      const pcEntityId = entityIds.get(pcEntityKey);
      if (!pcEntityId) {
        stats.pcHooksUnresolved += 1;
        continue;
      }
      await ensurePcHook(db, campaignId, pcEntityId, targetEntityId, hook, stats);
    }
  }

  for (const link of plan.entityLinks) {
    const sourceEntityId = entityIds.get(link.sourceEntityKey);
    const targetEntityId = entityIds.get(link.targetEntityKey);
    if (!sourceEntityId || !targetEntityId) {
      stats.entityLinksUnresolved += 1;
      continue;
    }
    await upsertEntityLink(
      db,
      campaignId,
      sourceEntityId,
      targetEntityId,
      link,
      stats,
    );
  }

  return stats;
}

function readSherdanSources(): SherdanSources {
  const root = process.cwd();
  const privateDir = path.join(root, "content", "sherdan");
  const publicDir = path.join(root, "public");
  const strict =
    process.argv.includes("--strict") || process.env.SHERDAN_CONTENT_STRICT === "1";

  const privateComplete = hasAllSherdanSources(privateDir);
  const publicComplete = hasAllSherdanSources(publicDir);

  if (privateComplete) {
    return readSherdanSourcesFrom(privateDir);
  }

  if (publicComplete && !strict) {
    console.warn(
      "[warn] Uso fallback public/*.md per bootstrap Sherdan. Esegui `pnpm content:migrate:sherdan` e poi `pnpm content:check -- --strict` prima di esporre l'app.",
    );
    return readSherdanSourcesFrom(publicDir);
  }

  const privateMissing = missingSherdanSources(privateDir);
  const publicMissing = missingSherdanSources(publicDir);
  throw new Error(
    [
      "Sorgenti markdown Sherdan non disponibili nella posizione sicura content/sherdan/.",
      `Mancanti in content/sherdan/: ${privateMissing.join(", ") || "nessuno"}`,
      strict
        ? "Modalita' strict attiva: public/*.md non viene accettato come fallback."
        : `Mancanti in public/: ${publicMissing.join(", ") || "nessuno"}`,
      "Risolvi con: pnpm content:migrate:sherdan",
    ].join("\n"),
  );
}

function readSherdanSourcesFrom(sourceDir: string): SherdanSources {
  return {
    npc: readFileSync(path.join(sourceDir, "NPC.md"), "utf8"),
    factions: readFileSync(path.join(sourceDir, "Fazioni.md"), "utf8"),
    lore: readFileSync(path.join(sourceDir, "Lore.md"), "utf8"),
    campaign: readFileSync(path.join(sourceDir, "Campagna.md"), "utf8"),
    backgrounds: readFileSync(
      path.join(sourceDir, "Background Personaggi.md"),
      "utf8",
    ),
    playerManual: readFileSync(
      path.join(sourceDir, "Manuale del Giocatore.md"),
      "utf8",
    ),
    sourceDir: path.relative(process.cwd(), sourceDir) || ".",
  };
}

function hasAllSherdanSources(sourceDir: string): boolean {
  return SHERDAN_SOURCE_FILES.every((file) =>
    existsSync(path.join(sourceDir, file)),
  );
}

function missingSherdanSources(sourceDir: string): string[] {
  return SHERDAN_SOURCE_FILES.filter(
    (file) => !existsSync(path.join(sourceDir, file)),
  );
}

async function ensureSherdanCampaign(
  db: Db,
  stats: ImportStats,
  sourceDir: string,
): Promise<string> {
  const existing = await db
    .select({ id: schema.campaigns.id })
    .from(schema.campaigns)
    .where(eq(schema.campaigns.name, SHERDAN_NAME))
    .limit(1);

  const settings = {
    system: "D&D 5e",
    language: "it",
    tone: "dark fantasy con tratti grimdark",
    bootstrap: {
      source: `${sourceDir}/*.md`,
      importer: "scripts/bootstrap-sherdan.ts",
    },
  };

  if (existing[0]) {
    await db
      .update(schema.campaigns)
      .set({
        description:
          "Campagna principale Sherdan, popolata dai sorgenti markdown privati tramite bootstrap idempotente.",
        settings,
      })
      .where(eq(schema.campaigns.id, existing[0].id));
    stats.campaignsUpdated += 1;
    return existing[0].id;
  }

  const [created] = await db
    .insert(schema.campaigns)
    .values({
      name: SHERDAN_NAME,
      description:
        "Campagna principale Sherdan, popolata dai sorgenti markdown privati tramite bootstrap idempotente.",
      settings,
    })
    .returning({ id: schema.campaigns.id });

  if (!created) throw new Error("Creazione campagna Sherdan fallita");
  stats.campaignsCreated += 1;
  return created.id;
}

async function upsertEntity(
  db: Db,
  campaignId: string,
  entity: BootstrapEntity,
  parentId: string | null,
  stats: ImportStats,
): Promise<string> {
  const existing = await db
    .select({ id: schema.entities.id })
    .from(schema.entities)
    .where(
      and(
        eq(schema.entities.campaignId, campaignId),
        eq(schema.entities.type, entity.type),
        eq(schema.entities.name, entity.name),
      ),
    )
    .limit(1);

  const values = {
    campaignId,
    type: entity.type,
    name: entity.name,
    description: entity.description,
    publicDescription: entity.publicDescription,
    properties: entity.properties,
    tags: entity.tags,
    parentId,
    visibility: entity.visibility,
  };

  if (existing[0]) {
    await db
      .update(schema.entities)
      .set(values)
      .where(eq(schema.entities.id, existing[0].id));
    stats.entitiesUpdated += 1;
    return existing[0].id;
  }

  const [created] = await db
    .insert(schema.entities)
    .values(values)
    .returning({ id: schema.entities.id });

  if (!created) throw new Error(`Creazione entity fallita: ${entity.name}`);
  stats.entitiesCreated += 1;
  return created.id;
}

async function upsertIdentity(
  db: Db,
  entityId: string,
  identity: BootstrapIdentity,
  stats: ImportStats,
) {
  const existing = await db
    .select({ id: schema.entityIdentities.id })
    .from(schema.entityIdentities)
    .where(
      and(
        eq(schema.entityIdentities.entityId, entityId),
        eq(schema.entityIdentities.name, identity.name),
      ),
    )
    .limit(1);

  const values = {
    entityId,
    name: identity.name,
    isTrueIdentity: identity.isTrueIdentity,
    appearance: identity.appearance,
    voice: identity.voice,
    mannerisms: identity.mannerisms,
    visibility: identity.visibility,
    notes: identity.notes,
  };

  if (existing[0]) {
    await db
      .update(schema.entityIdentities)
      .set(values)
      .where(eq(schema.entityIdentities.id, existing[0].id));
    stats.identitiesUpdated += 1;
    return;
  }

  await db.insert(schema.entityIdentities).values(values);
  stats.identitiesCreated += 1;
}

async function ensureSecret(
  db: Db,
  campaignId: string,
  entityId: string,
  secret: BootstrapSecret,
  stats: ImportStats,
) {
  const existing = await db
    .select({ id: schema.entitySecrets.id })
    .from(schema.entitySecrets)
    .where(
      and(
        eq(schema.entitySecrets.campaignId, campaignId),
        eq(schema.entitySecrets.entityId, entityId),
        eq(schema.entitySecrets.layer, secret.layer),
        eq(schema.entitySecrets.content, secret.content),
      ),
    )
    .limit(1);

  if (existing[0]) {
    stats.secretsSkipped += 1;
    return;
  }

  await db.insert(schema.entitySecrets).values({
    campaignId,
    entityId,
    layer: secret.layer,
    content: secret.content,
    exploitHint: secret.exploitHint,
  });
  stats.secretsCreated += 1;
}

async function upsertSession(
  db: Db,
  campaignId: string,
  session: BootstrapSession,
  stats: ImportStats,
) {
  const existing = await db
    .select({ id: schema.sessions.id })
    .from(schema.sessions)
    .where(
      and(
        eq(schema.sessions.campaignId, campaignId),
        eq(schema.sessions.number, session.number),
      ),
    )
    .limit(1);

  const values = {
    campaignId,
    number: session.number,
    title: session.title,
    date: session.date,
    recap: session.recap,
    prepNotes: session.prepNotes,
  };

  if (existing[0]) {
    await db
      .update(schema.sessions)
      .set(values)
      .where(eq(schema.sessions.id, existing[0].id));
    stats.sessionsUpdated += 1;
    return;
  }

  await db.insert(schema.sessions).values(values);
  stats.sessionsCreated += 1;
}

async function upsertPlotThread(
  db: Db,
  campaignId: string,
  thread: BootstrapPlotThread,
  stats: ImportStats,
) {
  const existing = await db
    .select({ id: schema.plotThreads.id })
    .from(schema.plotThreads)
    .where(
      and(
        eq(schema.plotThreads.campaignId, campaignId),
        eq(schema.plotThreads.title, thread.title),
      ),
    )
    .limit(1);

  const values = {
    campaignId,
    title: thread.title,
    description: thread.description,
    publicDescription: thread.publicDescription,
    status: thread.status,
    priority: thread.priority,
    visibility: thread.visibility,
  };

  if (existing[0]) {
    await db
      .update(schema.plotThreads)
      .set(values)
      .where(eq(schema.plotThreads.id, existing[0].id));
    stats.plotThreadsUpdated += 1;
    return;
  }

  await db.insert(schema.plotThreads).values(values);
  stats.plotThreadsCreated += 1;
}

async function upsertRuleDocument(
  db: Db,
  document: BootstrapRuleDocument,
  stats: ImportStats,
) {
  const existing = await db
    .select({ id: schema.ruleDocuments.id })
    .from(schema.ruleDocuments)
    .where(
      and(
        eq(schema.ruleDocuments.source, document.source),
        eq(schema.ruleDocuments.title, document.title),
        eq(schema.ruleDocuments.section, document.section),
        eq(schema.ruleDocuments.chunkIndex, document.chunkIndex),
      ),
    )
    .limit(1);

  const values = {
    source: document.source,
    title: document.title,
    section: document.section,
    content: document.content,
    chunkIndex: document.chunkIndex,
    metadata: document.metadata,
  };

  if (existing[0]) {
    await db
      .update(schema.ruleDocuments)
      .set(values)
      .where(eq(schema.ruleDocuments.id, existing[0].id));
    stats.ruleDocumentsUpdated += 1;
    return;
  }

  await db.insert(schema.ruleDocuments).values(values);
  stats.ruleDocumentsCreated += 1;
}

async function ensurePcHook(
  db: Db,
  campaignId: string,
  pcEntityId: string,
  targetEntityId: string,
  hook: BootstrapPcHook,
  stats: ImportStats,
) {
  const existing = await db
    .select({ id: schema.pcHooks.id })
    .from(schema.pcHooks)
    .where(
      and(
        eq(schema.pcHooks.campaignId, campaignId),
        eq(schema.pcHooks.pcEntityId, pcEntityId),
        eq(schema.pcHooks.targetEntityId, targetEntityId),
        eq(schema.pcHooks.hookDescription, hook.hookDescription),
      ),
    )
    .limit(1);

  if (existing[0]) {
    stats.pcHooksExisting += 1;
    return;
  }

  await db.insert(schema.pcHooks).values({
    campaignId,
    pcEntityId,
    targetEntityId,
    hookDescription: hook.hookDescription,
    potentialArc: hook.potentialArc,
    status: hook.status,
  });
  stats.pcHooksCreated += 1;
}

async function upsertEntityLink(
  db: Db,
  campaignId: string,
  sourceEntityId: string,
  targetEntityId: string,
  link: BootstrapEntityLink,
  stats: ImportStats,
) {
  const existing = await db
    .select({ id: schema.entityLinks.id })
    .from(schema.entityLinks)
    .where(
      and(
        eq(schema.entityLinks.campaignId, campaignId),
        eq(schema.entityLinks.sourceEntityId, sourceEntityId),
        eq(schema.entityLinks.targetEntityId, targetEntityId),
        eq(schema.entityLinks.relationType, link.relationType),
        eq(schema.entityLinks.description, link.description),
      ),
    )
    .limit(1);

  const values = {
    campaignId,
    sourceEntityId,
    targetEntityId,
    relationType: link.relationType,
    publicRelationType: link.publicRelationType,
    strength: link.strength,
    description: link.description,
    visibility: link.visibility,
  };

  if (existing[0]) {
    await db
      .update(schema.entityLinks)
      .set(values)
      .where(eq(schema.entityLinks.id, existing[0].id));
    stats.entityLinksUpdated += 1;
    return;
  }

  await db.insert(schema.entityLinks).values(values);
  stats.entityLinksCreated += 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
