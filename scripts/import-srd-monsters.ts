import "dotenv/config";

import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import {
  fetchOpen5eCreatures,
  OPEN5E_DEFAULT_SRD_DOCUMENT,
  open5eCreatureToEntityDraft,
} from "@/lib/encounters";
import { env } from "@/lib/env";

interface CliOptions {
  campaignId: string;
  documentKey: string;
  limit?: number;
  dryRun: boolean;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const sqlClient = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(sqlClient, { schema });

  try {
    const [campaign] = await db
      .select({ id: schema.campaigns.id, name: schema.campaigns.name })
      .from(schema.campaigns)
      .where(eq(schema.campaigns.id, options.campaignId))
      .limit(1);

    if (!campaign) {
      throw new Error(`Campagna non trovata: ${options.campaignId}`);
    }

    const creatures = await fetchOpen5eCreatures({
      documentKey: options.documentKey,
      limit: options.limit,
    });

    let created = 0;
    let skipped = 0;

    for (const creature of creatures) {
      const draft = open5eCreatureToEntityDraft(creature);
      const open5eTag = `open5e:${creature.key}`;
      const [existing] = await db
        .select({ id: schema.entities.id })
        .from(schema.entities)
        .where(
          and(
            eq(schema.entities.campaignId, campaign.id),
            eq(schema.entities.type, "monster"),
            sql`${open5eTag} = ANY(${schema.entities.tags})`,
          ),
        )
        .limit(1);

      if (existing) {
        skipped += 1;
        continue;
      }

      if (!options.dryRun) {
        await db.insert(schema.entities).values({
          campaignId: campaign.id,
          type: "monster",
          name: draft.name,
          description: draft.description,
          publicDescription: draft.publicDescription,
          properties: draft.properties,
          tags: draft.tags,
          visibility: "dm_only",
        });
      }
      created += 1;
    }

    const mode = options.dryRun ? "dry-run" : "import";
    console.log(
      `[ok] ${mode} SRD monsters (${options.documentKey}) per "${campaign.name}": ${created} create, ${skipped} skip.`,
    );
  } finally {
    await sqlClient.end();
  }
}

function parseArgs(argv: string[]): CliOptions {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;

    const key = arg.slice(2);
    if (key === "dry-run") {
      args.set(key, true);
      continue;
    }

    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Valore mancante per --${key}`);
    }
    args.set(key, value);
    index += 1;
  }

  const campaignId = args.get("campaign-id");
  if (typeof campaignId !== "string") {
    throw new Error(
      "Uso: pnpm db:import:srd-monsters --campaign-id <uuid> [--document srd-2014] [--limit 50] [--dry-run]",
    );
  }

  const limitArg = args.get("limit");
  const limit =
    typeof limitArg === "string" ? Number.parseInt(limitArg, 10) : undefined;
  if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) {
    throw new Error("--limit deve essere un intero positivo");
  }

  const documentArg = args.get("document");
  return {
    campaignId,
    documentKey:
      typeof documentArg === "string"
        ? documentArg
        : OPEN5E_DEFAULT_SRD_DOCUMENT,
    limit,
    dryRun: args.get("dry-run") === true,
  };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
