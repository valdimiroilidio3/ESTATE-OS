import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "./auth";
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
  console.error("[api] unhandled", error);
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
    try {
      const session = await requireSession();
      if (req.method !== "GET" && req.method !== "HEAD") guardOrigin(req);
      const params = (context?.params ? await context.params : {}) as Record<string, string>;
      return await handler(req, { session, params });
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/** Blocks cross-site form posts (CSRF defence-in-depth on top of SameSite=Lax cookies). */
export function guardOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("host");
  try {
    const originHost = new URL(origin).host;
    if (!host || originHost !== host) {
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

export function clientKey(req: Request, scope: string) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  return `${scope}:${ip}`;
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
