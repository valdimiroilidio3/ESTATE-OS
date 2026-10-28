import { NextResponse } from "next/server";
import { loginSchema } from "@/lib/schemas";
import { authenticate, createSession, sessionCookieOptions } from "@/server/auth";
import { ApiError, errorResponse, enforceRateLimit, readJson } from "@/server/http";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    enforceRateLimit(req, "login", 10, 5 * 60_000);
    const input = await readJson(req, loginSchema);
    const result = await authenticate(input.email, input.password);
    if (!result) {
      throw new ApiError("Credenciais inválidas.", 401, "invalid_credentials");
    }
    const { token } = createSession(result.profile.id, result.orgId);
    logAudit({ orgId: result.orgId, actorId: result.profile.id, action: "auth.login", entity: "session" });
    const res = NextResponse.json({ ok: true, redirect: "/app" });
    res.cookies.set("estate_session", token, sessionCookieOptions);
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}
