import type { NextRequest } from "next/server";

import { ok } from "@/lib/api/respond";
import {
  isPlayerAccessConfigured,
  requirePlayerAccess,
} from "@/lib/security/player-access";

export async function GET(req: NextRequest) {
  const configured = isPlayerAccessConfigured();
  let authenticated = false;

  if (configured) {
    try {
      requirePlayerAccess(req);
      authenticated = true;
    } catch {
      authenticated = false;
    }
  }

  return ok({ configured, authenticated });
}
