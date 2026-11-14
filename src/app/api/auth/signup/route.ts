import { NextResponse } from "next/server";
import { signupSchema } from "@/lib/schemas";
import { createUserWithOrg } from "@/server/data/team";
import { createSession, sessionCookieOptions } from "@/server/auth";
import { ApiError, errorResponse, enforceRateLimit, readJson } from "@/server/http";
import { logAudit } from "@/server/audit";
import { passwordProblem } from "@/server/security";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    enforceRateLimit(req, "signup", 8, 10 * 60_000);
    const input = await readJson(req, signupSchema);
    const weak = passwordProblem(input.password, input.email);
    if (weak) throw new ApiError(weak, 422, "weak_password", { password: [weak] });
    const { profileId, orgId } = await createUserWithOrg(input);
    const { token } = await createSession(profileId, orgId);
    await logAudit({ orgId, actorId: profileId, action: "org.created", entity: "organization", entityId: orgId });
    const res = NextResponse.json({ ok: true, redirect: "/app" });
    res.cookies.set("estate_session", token, sessionCookieOptions);
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}
