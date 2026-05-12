import type { NextRequest } from "next/server";
import { type SQL, and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { campaigns, players } from "@/db/schema";
import { BadRequestError, ConflictError } from "@/lib/api/errors";
import { created, fail, ok } from "@/lib/api/respond";
import { hashPlayerCode } from "@/lib/security/player-auth";
import {
  createPlayerInputSchema,
  listPlayersQuerySchema,
} from "@/lib/validation/player-input";

// CRUD lato DM per `players`. Il `code` plain non viene mai esposto in
// risposta: la lista ritorna solo metadata (id, name, active, lastSeenAt).
// Il DM che dimentica un codice deve generarne uno nuovo via PATCH.

const playerColumns = {
  id: players.id,
  campaignId: players.campaignId,
  name: players.name,
  active: players.active,
  lastSeenAt: players.lastSeenAt,
  createdAt: players.createdAt,
  updatedAt: players.updatedAt,
} as const;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = listPlayersQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const conditions: SQL[] = [eq(players.campaignId, q.campaign_id)];
    if (q.active !== undefined) {
      conditions.push(eq(players.active, q.active));
    }

    const rows = await db
      .select(playerColumns)
      .from(players)
      .where(and(...conditions))
      .orderBy(asc(players.name));

    return ok(rows);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = createPlayerInputSchema.parse(body);

    const [campaign] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.id, input.campaignId))
      .limit(1);
    if (!campaign) throw new BadRequestError("Campagna non trovata.");

    const codeHash = hashPlayerCode(input.code);

    // Codice gia' in uso per un altro player (anche di un'altra campagna)?
    // L'HMAC e' deterministico, quindi codici uguali producono lo stesso
    // hash: rifiutiamo per non confondere la login bridge.
    const [existing] = await db
      .select({ id: players.id })
      .from(players)
      .where(eq(players.codeHash, codeHash))
      .limit(1);
    if (existing) {
      throw new ConflictError(
        "Codice gia' in uso. Scegline uno diverso.",
      );
    }

    try {
      const [row] = await db
        .insert(players)
        .values({
          campaignId: input.campaignId,
          name: input.name,
          codeHash,
          active: input.active ?? true,
        })
        .returning(playerColumns);
      return created(row);
    } catch (err) {
      // Unique constraint su (campaignId, name).
      if (err instanceof Error && /uq_players_campaign_name/.test(err.message)) {
        throw new ConflictError(
          "Esiste gia' un player con questo nome in questa campagna.",
        );
      }
      throw err;
    }
  } catch (err) {
    return fail(err);
  }
}
