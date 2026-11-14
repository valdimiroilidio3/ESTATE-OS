import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/schemas";
import { authenticate, createSession, sessionCookieOptions } from "@/server/auth";
import { ApiError, clientIp, errorResponse, enforceRateLimit, readJson } from "@/server/http";
import { logAudit, logSecurityEvent } from "@/server/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    enforceRateLimit(req, "login", 10, 5 * 60_000);
    const input = await readJson(req, loginSchema);
    const result = await authenticate(input.email, input.password);
    if (!result) {
      await logSecurityEvent({
        action: "auth.login_failed",
        outcome: "failed",
        route: "/api/auth/login",
        ip: clientIp(req),
        // The e-mail is recorded to spot targeted attempts, never the password.
        meta: { email: input.email.slice(0, 160) },
      });
      throw new ApiError("Credenciais inválidas.", 401, "invalid_credentials");
    }
    const { token } = await createSession(result.profile.id, result.orgId);
    await logAudit({ orgId: result.orgId, actorId: result.profile.id, action: "auth.login", entity: "session" });
    await logSecurityEvent({
      orgId: result.orgId,
      actorId: result.profile.id,
      action: "auth.login",
      outcome: "allowed",
      route: "/api/auth/login",
      ip: clientIp(req),
    });
    const res = NextResponse.json({ ok: true, redirect: "/app" });
    res.cookies.set("estate_session", token, sessionCookieOptions);
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}
