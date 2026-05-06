import type { NextRequest } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { campaigns } from "@/db/schema";
import { created, fail, ok } from "@/lib/api/respond";

// CRUD `campaigns` — collection-level (GET list, POST create).
// Per il singolo: src/app/api/campaigns/[id]/route.ts.

// Schema input creazione. `description` e `settings` opzionali; il resto
// (id, createdAt, updatedAt) e' generato dal DB.
const createSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().optional(),
    settings: z.record(z.string(), z.unknown()).default({}),
  })
  .strict();

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(campaigns)
      .orderBy(campaigns.createdAt);
    return ok(rows);
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    const input = createSchema.parse(body);
    const [row] = await db.insert(campaigns).values(input).returning();
    return created(row);
  } catch (err) {
    return fail(err);
  }
}
