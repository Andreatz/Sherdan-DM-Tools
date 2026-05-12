import type { NextRequest } from "next/server";
import { asc, eq, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { plotThreads, truthClues } from "@/db/schema";
import { fail, ok } from "@/lib/api/respond";
import { truthClueDashboardQuerySchema } from "@/lib/validation/truth-clue-input";

// Dashboard "verita' rivelata" per plot thread: dato un campaign_id, ritorna
// per ogni plot thread (piu' una riga "Senza plot thread" per le briciole
// orfane) i contatori per status e la percentuale `understood`/totale.
// Serve a vedere a colpo d'occhio quanto il party si sta avvicinando alla
// verita' GM di ciascun arco.

interface ThreadDashboardRow {
  plotThreadId: string | null;
  plotThreadTitle: string | null;
  plotThreadStatus: string | null;
  total: number;
  planted: number;
  noticed: number;
  misinterpreted: number;
  understood: number;
  lost: number;
  understoodPct: number;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = truthClueDashboardQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const threadsList = await db
      .select({
        id: plotThreads.id,
        title: plotThreads.title,
        status: plotThreads.status,
      })
      .from(plotThreads)
      .where(eq(plotThreads.campaignId, q.campaign_id))
      .orderBy(asc(plotThreads.title));

    const aggregated = await db
      .select({
        plotThreadId: truthClues.relatedPlotThreadId,
        status: truthClues.status,
        count: sql<number>`count(*)::int`,
      })
      .from(truthClues)
      .where(eq(truthClues.campaignId, q.campaign_id))
      .groupBy(truthClues.relatedPlotThreadId, truthClues.status);

    const byThread = new Map<string | null, ThreadDashboardRow>();

    function rowFor(
      plotThreadId: string | null,
      title: string | null,
      status: string | null,
    ): ThreadDashboardRow {
      const key = plotThreadId;
      let row = byThread.get(key);
      if (!row) {
        row = {
          plotThreadId,
          plotThreadTitle: title,
          plotThreadStatus: status,
          total: 0,
          planted: 0,
          noticed: 0,
          misinterpreted: 0,
          understood: 0,
          lost: 0,
          understoodPct: 0,
        };
        byThread.set(key, row);
      }
      return row;
    }

    for (const t of threadsList) {
      rowFor(t.id, t.title, t.status);
    }

    for (const agg of aggregated) {
      const thread =
        agg.plotThreadId === null
          ? null
          : (threadsList.find((t) => t.id === agg.plotThreadId) ?? null);
      const row = rowFor(
        agg.plotThreadId,
        thread?.title ?? null,
        thread?.status ?? null,
      );
      row.total += agg.count;
      switch (agg.status) {
        case "planted":
          row.planted += agg.count;
          break;
        case "noticed":
          row.noticed += agg.count;
          break;
        case "misinterpreted":
          row.misinterpreted += agg.count;
          break;
        case "understood":
          row.understood += agg.count;
          break;
        case "lost":
          row.lost += agg.count;
          break;
      }
    }

    const result: ThreadDashboardRow[] = [];
    for (const row of byThread.values()) {
      row.understoodPct =
        row.total === 0 ? 0 : Math.round((row.understood / row.total) * 100);
      result.push(row);
    }
    result.sort((a, b) => {
      // Plot thread reali prima (per titolo); "Senza plot thread" in fondo.
      if (a.plotThreadId === null) return 1;
      if (b.plotThreadId === null) return -1;
      return (a.plotThreadTitle ?? "").localeCompare(b.plotThreadTitle ?? "");
    });

    return ok({
      campaignId: q.campaign_id,
      threads: result,
    });
  } catch (err) {
    return fail(err);
  }
}

