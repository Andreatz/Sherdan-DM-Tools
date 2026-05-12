import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { encounters, entities, lootBundles, sessions } from "@/db/schema";
import { AppError, NotFoundError } from "@/lib/api/errors";
import { created, fail } from "@/lib/api/respond";
import {
  lootGeneratorSaveRequestSchema,
  LootItemResolver,
  LootItemResolverError,
  summarizeResolvedLootBundle,
  type ResolvedLootItem,
} from "@/lib/loot";

const bundleColumns = {
  id: lootBundles.id,
  campaignId: lootBundles.campaignId,
  title: lootBundles.title,
  description: lootBundles.description,
  goldAmount: lootBundles.goldAmount,
  items: lootBundles.items,
  encounterId: lootBundles.encounterId,
  sessionId: lootBundles.sessionId,
  createdAt: lootBundles.createdAt,
} as const;

const itemEntityColumns = {
  id: entities.id,
  name: entities.name,
  type: entities.type,
  tags: entities.tags,
} as const;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const { output, encounterId, sessionId } =
      lootGeneratorSaveRequestSchema.parse(body);
    await assertEncounterMatchesCampaign(encounterId, output.metadata.campaignId);
    await assertSessionMatchesCampaign(sessionId, output.metadata.campaignId);
    const resolved = await resolveLootItemsForSave(output);

    const saved = await db.transaction(async (tx) => {
      const savedItems = [];
      const createdEntities = [];

      for (const resolvedItem of resolved.items) {
        if (resolvedItem.action === "reuse" && resolvedItem.match) {
          savedItems.push(bundleItemForReuse(resolvedItem));
          continue;
        }

        if (!resolvedItem.entityInsert) {
          throw new AppError(
            "Risoluzione item loot incoerente: entityInsert mancante",
            500,
            "loot_item_resolution_inconsistent",
          );
        }

        const [entity] = await tx
          .insert(entities)
          .values(resolvedItem.entityInsert)
          .returning(itemEntityColumns);

        if (!entity) {
          throw new AppError(
            "Creazione item loot non riuscita",
            500,
            "loot_item_create_failed",
          );
        }

        createdEntities.push(entity);
        savedItems.push(bundleItemForCreate(resolvedItem, entity.id));
      }

      const [bundle] = await tx
        .insert(lootBundles)
        .values({
          campaignId: output.metadata.campaignId,
          title: `Loot: ${output.metadata.source}`,
          description: lootBundleDescription(output),
          goldAmount: Math.round(output.baseGold.totalGp),
          items: savedItems,
          encounterId: encounterId ?? null,
          sessionId: sessionId ?? null,
        })
        .returning(bundleColumns);

      if (!bundle) {
        throw new AppError(
          "Creazione loot bundle non riuscita",
          500,
          "loot_bundle_create_failed",
        );
      }

      return {
        bundle,
        createdEntities,
        resolution: summarizeResolvedLootBundle(resolved),
      };
    });

    return created(saved);
  } catch (err) {
    return fail(err);
  }
}

async function assertEncounterMatchesCampaign(
  encounterId: string | undefined,
  campaignId: string,
) {
  if (!encounterId) return;

  const [row] = await db
    .select({ id: encounters.id })
    .from(encounters)
    .where(
      and(
        eq(encounters.id, encounterId),
        eq(encounters.campaignId, campaignId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError(
      "Encounter della campagna per il loot bundle",
      encounterId,
    );
  }
}

async function assertSessionMatchesCampaign(
  sessionId: string | undefined,
  campaignId: string,
) {
  if (!sessionId) return;

  const [row] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.campaignId, campaignId)))
    .limit(1);

  if (!row) {
    throw new NotFoundError(
      "Sessione della campagna per il loot bundle",
      sessionId,
    );
  }
}

async function resolveLootItemsForSave(
  output: Parameters<LootItemResolver["resolve"]>[0],
) {
  try {
    return await new LootItemResolver().resolve(output);
  } catch (err) {
    if (err instanceof LootItemResolverError) {
      throw new AppError(
        "Risoluzione item loot non disponibile: verifica il provider embedding.",
        503,
        "loot_item_resolution_unavailable",
        err.message,
      );
    }
    throw err;
  }
}

function bundleItemForReuse(resolved: ResolvedLootItem) {
  return {
    entity_id: resolved.match?.id,
    name: resolved.item.name,
    description: resolved.item.description,
    qty: resolved.item.quantity,
    rarity: resolved.item.rarity,
    action: "reuse",
    match_score: resolved.match?.score ?? null,
  };
}

function bundleItemForCreate(resolved: ResolvedLootItem, entityId: string) {
  return {
    entity_id: entityId,
    name: resolved.item.name,
    description: resolved.item.description,
    qty: resolved.item.quantity,
    rarity: resolved.item.rarity,
    action: "create",
    match_score: resolved.match?.score ?? null,
  };
}

function lootBundleDescription(output: Parameters<LootItemResolver["resolve"]>[0]) {
  return [
    output.narrativeSummary,
    output.gmNotes ? `GM: ${output.gmNotes}` : null,
    output.hooks.length > 0 ? `Hook:\n${output.hooks.map((hook) => `- ${hook}`).join("\n")}` : null,
    `Gold deterministico: ${output.baseGold.totalGp} gp (${output.baseGold.tier}, ${output.baseGold.mode})`,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n\n");
}
