import { NextResponse } from "next/server";

import { clearPlayerAccessCookie } from "@/lib/security/player-access";

export async function POST() {
  const res = NextResponse.json({ ok: true }, { status: 200 });
  clearPlayerAccessCookie(res);
  return res;
}
