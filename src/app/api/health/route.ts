import { NextResponse } from "next/server";
import { DatabaseNotConfiguredError, one } from "@/server/db";
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
    const row = await one<{ n: number }>(`SELECT count(*) AS n FROM organizations`);
    return NextResponse.json({
      status: "ok",
      database: {
        reachable: true,
        engine: "postgresql",
        organizations: row?.n ?? 0,
        latency_ms: Date.now() - started,
      },
      storage: { driver: cfg.storage.driver },
      ai: { provider: cfg.ai.provider, mode: cfg.ai.mode, configured: cfg.ai.configured },
      environment: cfg.isProduction ? "production" : process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.json(
      {
        status: "error",
        database: {
          reachable: false,
          configured: !(error instanceof DatabaseNotConfiguredError),
        },
        error: message,
        hint:
          error instanceof DatabaseNotConfiguredError
            ? "Defina DATABASE_URL e execute `npm run db:init`."
            : "Verifique a ligação PostgreSQL e se o esquema foi aplicado.",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
