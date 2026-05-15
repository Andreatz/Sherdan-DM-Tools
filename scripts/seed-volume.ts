import "dotenv/config";

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { campaigns, entities, plotThreads, truthClues } from "@/db/schema";

interface Options {
  campaignName: string;
  entities: number;
  plotThreads: number;
  truthClues: number;
}

function readOptions(): Options {
  const args = new Map<string, string>();
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    const value = process.argv[i + 1];
    if (!key?.startsWith("--") || value === undefined) continue;
    args.set(key.slice(2), value);
  }
  return {
    campaignName: args.get("campaign") ?? "Performance Seed",
    entities: Number(args.get("entities") ?? 1000),
    plotThreads: Number(args.get("plot-threads") ?? 120),
    truthClues: Number(args.get("truth-clues") ?? 400),
  };
}

async function main() {
  const options = readOptions();
  const [campaign] = await db
    .select({ id: campaigns.id, name: campaigns.name })
    .from(campaigns)
    .where(eq(campaigns.name, options.campaignName))
    .limit(1);
  const campaignId =
    campaign?.id ??
    (
      await db
        .insert(campaigns)
        .values({
          name: options.campaignName,
          description: "Dataset sintetico per profiling locale.",
        })
        .returning({ id: campaigns.id })
    )[0]!.id;

  await seedEntities(campaignId, options.entities);
  const threadIds = await seedPlotThreads(campaignId, options.plotThreads);
  await seedTruthClues(campaignId, threadIds, options.truthClues);

  console.log(
    JSON.stringify(
      {
        ok: true,
        campaignId,
        entities: options.entities,
        plotThreads: options.plotThreads,
        truthClues: options.truthClues,
      },
      null,
      2,
    ),
  );
}

async function seedEntities(campaignId: string, count: number) {
  const batchSize = 250;
  for (let offset = 0; offset < count; offset += batchSize) {
    const size = Math.min(batchSize, count - offset);
    const rows: Array<typeof entities.$inferInsert> = Array.from(
      { length: size },
      (_, i) => {
        const n = offset + i + 1;
        return {
          campaignId,
          type: n % 7 === 0 ? "location" : n % 5 === 0 ? "faction" : "npc",
          name: `Perf Entity ${String(n).padStart(4, "0")}`,
          description: `GM profile sintetico ${n}.`,
          publicDescription: `Profilo pubblico sintetico ${n}.`,
          visibility: n % 9 === 0 ? "dm_only" : n % 3 === 0 ? "discovered" : "public",
          tags: [`perf-${n % 20}`, n % 2 === 0 ? "even" : "odd"],
          properties: {},
        };
      },
    );
    await db.insert(entities).values(rows);
  }
}

async function seedPlotThreads(campaignId: string, count: number) {
  const values: Array<typeof plotThreads.$inferInsert> = Array.from(
    { length: count },
    (_, i) => ({
      campaignId,
      title: `Perf Thread ${String(i + 1).padStart(3, "0")}`,
      description: `Linea GM sintetica ${i + 1}.`,
      publicDescription: `Linea pubblica sintetica ${i + 1}.`,
      status: i % 5 === 0 ? "hot" : i % 2 === 0 ? "warm" : "cold",
      priority: (i % 100) + 1,
      visibility: i % 4 === 0 ? "dm_only" : "discovered",
    }),
  );
  const rows = await db
    .insert(plotThreads)
    .values(values)
    .returning({ id: plotThreads.id });
  return rows.map((row) => row.id);
}

async function seedTruthClues(
  campaignId: string,
  threadIds: string[],
  count: number,
) {
  if (threadIds.length === 0) return;
  const values: Array<typeof truthClues.$inferInsert> = Array.from(
    { length: count },
    (_, i) => ({
      campaignId,
      relatedPlotThreadId: threadIds[i % threadIds.length]!,
      description: `Briciola sintetica ${i + 1}.`,
      truthRevealed: `Verita sintetica ${i + 1}.`,
      status: i % 4 === 0 ? "noticed" : i % 7 === 0 ? "understood" : "planted",
      statusNotes: i % 8 === 0 ? "Nota sintetica per profiling." : null,
    }),
  );
  await db.insert(truthClues).values(values);
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
});
