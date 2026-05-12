import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db/client";
import { generationLogs } from "@/db/schema";
import { NotFoundError } from "@/lib/api/errors";
import { fail, ok } from "@/lib/api/respond";

const idParamSchema = z.object({ id: z.uuid() });

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = idParamSchema.parse(await ctx.params);
    const rows = await db
      .select()
      .from(generationLogs)
      .where(eq(generationLogs.id, id))
      .limit(1);
    if (!rows[0]) throw new NotFoundError("generation-log", id);
    return ok(rows[0]);
  } catch (err) {
    return fail(err);
  }
}
