export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

import { ensureWhaleSchema } from "../../../../lib/db";
import { runWhaleScanner } from "../../../../lib/scanner/runScan";

function isAuthorized(req: NextRequest): boolean {
  const adminToken = process.env.WHALE_ADMIN_TOKEN || "";
  if (!adminToken) return true;

  const provided =
    req.headers.get("x-whale-admin-token") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");

  return Boolean(provided) && provided === adminToken;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    await ensureWhaleSchema();

    const body = (await req.json().catch(() => null)) as { limit?: number } | null;
    const limit = Number.isFinite(Number(body?.limit)) ? Number(body?.limit) : undefined;

    const summary = await runWhaleScanner(limit);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "scanner failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
