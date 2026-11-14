import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { DatabaseNotConfiguredError, one } from "@/server/db";
import { config } from "@/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness + readiness probe. Reports what is actually configured — never
 * secrets, and never a fabricated "healthy" when the database is unreachable.
 */
export async function GET(req: Request) {
  const started = Date.now();
  // The public probe says whether the service is up. Tenant counts and raw
  // driver errors are only returned to a caller that presents HEALTH_TOKEN,
  // because they describe the deployment, not its availability.
  const detailed = authorisedDetail(req);
  try {
    const cfg = config();
    // Always probe the database, even when details are hidden: a liveness
    // endpoint that reports "ok" without touching the database is a lie.
    await one<{ ok: number }>(`SELECT 1 AS ok`);
    const count = detailed ? (await one<{ n: number }>(`SELECT count(*) AS n FROM organizations`))?.n ?? 0 : null;
    return NextResponse.json({
      status: "ok",
      database: {
        reachable: true,
        engine: "postgresql",
        ...(detailed ? { organizations: count, latency_ms: Date.now() - started } : {}),
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
        ...(detailed ? { error: message } : {}),
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

function authorisedDetail(req: Request): boolean {
  const expected = process.env.HEALTH_TOKEN;
  if (!expected || expected.length < 16) return false;
  const provided = req.headers.get("x-health-token") ?? "";
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}
