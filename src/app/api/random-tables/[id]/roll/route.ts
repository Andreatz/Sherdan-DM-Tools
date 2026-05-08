import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { randomTables } from "@/db/schema";
import { BadRequestError, NotFoundError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/respond";
import {
  RandomTableRollError,
  rollRandomTable,
  type RandomTableDefinition,
} from "@/lib/random-tables";
import { rollRandomTableInputSchema } from "@/lib/validation/random-table-input";

const idParamSchema = z.object({ id: z.uuid() });
const tableIdSchema = z.uuid();

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function resolveId(ctx: RouteContext): Promise<string> {
  return idParamSchema.parse(await ctx.params).id;
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const id = await resolveId(ctx);
    const body = await parseOptionalJson(req);
    const input = rollRandomTableInputSchema.parse(body);
    const table = await findRandomTable(id);
    if (!table) throw new NotFoundError("random-table", id);

    try {
      const result = await rollRandomTable(table, {
        maxDepth: input.maxDepth,
        resolveTable: findRandomTable,
      });
      return ok(result);
    } catch (err) {
      if (err instanceof RandomTableRollError) {
        throw new BadRequestError(err.message, { rollErrorCode: err.code });
      }
      throw err;
    }
  } catch (err) {
    return fail(err);
  }
}

async function parseOptionalJson(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (!text.trim()) return {};
  return JSON.parse(text) as unknown;
}

async function findRandomTable(
  id: string,
): Promise<RandomTableDefinition | null> {
  const parsed = tableIdSchema.safeParse(id);
  if (!parsed.success) return null;

  const rows = await db
    .select({
      id: randomTables.id,
      name: randomTables.name,
      entries: randomTables.entries,
    })
    .from(randomTables)
    .where(eq(randomTables.id, parsed.data))
    .limit(1);

  return rows[0] ?? null;
}
