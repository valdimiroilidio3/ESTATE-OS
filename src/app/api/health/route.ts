import { NextResponse } from "next/server";
import { one } from "@/server/db";
import { config } from "@/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + readiness probe. Reports what is actually configured — never
 * secrets, and never a fabricated "healthy" when the database is unreachable.
 */
export async function GET() {
  const started = Date.now();
  try {
    const cfg = config();
    const row = one<{ n: number }>(`SELECT count(*) AS n FROM organizations`);
    return NextResponse.json({
      // "degraded" means the instance is serving but data will not survive a restart.
      status: cfg.storage.persistent ? "ok" : "degraded",
      database: { reachable: true, organizations: row?.n ?? 0, latency_ms: Date.now() - started },
      ai: { provider: cfg.ai.provider, mode: cfg.ai.mode, configured: cfg.ai.configured },
      storage: { persistent: cfg.storage.persistent, path: cfg.storage.databasePath, reason: cfg.storage.reason },
      environment: cfg.isProduction ? "production" : process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        database: { reachable: false },
        error: error instanceof Error ? error.message : "unknown",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
