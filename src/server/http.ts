import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "./auth";
import { logSecurityEvent } from "./audit";
import { redact } from "./security";
import type { Session } from "@/lib/types";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(message: string, status = 400, code = "bad_request", details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const unauthorized = () => new ApiError("Sessão inválida ou expirada.", 401, "unauthorized");
export const forbidden = (msg = "Não tem permissões para esta ação.") =>
  new ApiError(msg, 403, "forbidden");
export const notFound = (msg = "Registo não encontrado.") => new ApiError(msg, 404, "not_found");

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details ?? null },
      { status: error.status },
    );
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Dados inválidos.", code: "validation_error", details: error.flatten() },
      { status: 422 },
    );
  }
  // Never print the raw error: PostgreSQL messages and provider payloads can
  // carry connection strings, e-mail addresses or request bodies.
  console.error("[api] unhandled", redact(error instanceof Error ? { name: error.name, message: error.message } : error));
  return NextResponse.json(
    { error: "Ocorreu um erro inesperado. Tente novamente.", code: "internal_error" },
    { status: 500 },
  );
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw unauthorized();
  return session;
}

type Handler = (
  req: Request,
  ctx: { session: Session; params: Record<string, string> },
) => Promise<Response> | Response;

/** Route-handler wrapper: resolves session, validates same-origin writes, normalises errors. */
export function authed(handler: Handler) {
  return async (req: Request, context: { params: Promise<unknown> }) => {
    let session: Session | null = null;
    try {
      session = await requireSession();
      if (req.method !== "GET" && req.method !== "HEAD") guardOrigin(req);
      const params = (context?.params ? await context.params : {}) as Record<string, string>;
      return await handler(req, { session, params });
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        recordDenied(req, error, session);
      }
      return errorResponse(error);
    }
  };
}

/**
 * Records blocked requests (`denied`) once per route and actor per minute, so a
 * probing client cannot turn the audit trail itself into a write amplifier.
 */
const denialLog = ((globalThis as any).__estateDenials = (globalThis as any).__estateDenials ?? new Map<
  string,
  number
>()) as Map<string, number>;

function recordDenied(req: Request, error: ApiError, session: Session | null) {
  let route = "/";
  try {
    route = new URL(req.url).pathname;
  } catch {
    // keep the default
  }
  const key = `${session?.profile.id ?? "anon"}:${route}:${error.code}`;
  const now = Date.now();
  if ((denialLog.get(key) ?? 0) > now - 60_000) return;
  denialLog.set(key, now);
  if (denialLog.size > 5_000) denialLog.clear();
  void logSecurityEvent({
    orgId: session?.org.id ?? null,
    actorId: session?.profile.id ?? null,
    action: "access.denied",
    outcome: "denied",
    route,
    ip: clientIp(req),
    meta: { code: error.code, message: error.message, method: req.method },
  });
}

/** Blocks cross-site form posts (CSRF defence-in-depth on top of SameSite=Lax cookies). */
export function guardOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  // Behind a proxy/Vercel the public hostname arrives in x-forwarded-host while
  // `host` may be the internal one; both are accepted, nothing else is.
  const hosts = [req.headers.get("x-forwarded-host"), req.headers.get("host")]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.split(",")[0]!.trim());
  const allowed = [process.env.NEXT_PUBLIC_APP_URL, process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`]
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      try {
        return new URL(value).host;
      } catch {
        return "";
      }
    });
  try {
    const originHost = new URL(origin).host;
    if (![...hosts, ...allowed].includes(originHost)) {
      throw new ApiError("Origem do pedido não autorizada.", 403, "bad_origin");
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("Origem inválida.", 403, "bad_origin");
  }
}

export async function readJson<S extends z.ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError("Corpo do pedido inválido.", 422, "invalid_json");
  }
  return schema.parse(raw);
}

/* ───────── rate limiting (in-process, per key) ───────── */
const buckets = ((globalThis as any).__estateRate = (globalThis as any).__estateRate ?? new Map<
  string,
  { count: number; resetAt: number }
>()) as Map<string, { count: number; resetAt: number }>;

export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  // Expired buckets are swept opportunistically: an unbounded map keyed by IP
  // would otherwise grow with every distinct client and leak memory.
  if (buckets.size > 10_000) {
    for (const [entryKey, entry] of buckets) {
      if (entry.resetAt < now) buckets.delete(entryKey);
    }
    if (buckets.size > 20_000) buckets.clear();
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfter: 0 };
}

/**
 * Best-effort client address.
 *
 * `x-forwarded-for` is only trustworthy when a proxy in front of the app sets
 * it (Vercel does). A deployment exposed directly to the internet must strip
 * that header, otherwise a client can rotate it to evade rate limits.
 */
export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

export function clientKey(req: Request, scope: string) {
  return `${scope}:${clientIp(req)}`;
}

export function enforceRateLimit(req: Request, scope: string, limit: number, windowMs: number) {
  const result = rateLimit(clientKey(req, scope), limit, windowMs);
  if (!result.ok) {
    throw new ApiError(
      `Demasiados pedidos. Tente novamente em ${result.retryAfter}s.`,
      429,
      "rate_limited",
      { retryAfter: result.retryAfter },
    );
  }
}
