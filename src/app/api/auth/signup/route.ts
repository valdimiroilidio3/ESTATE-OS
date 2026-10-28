import { NextResponse } from "next/server";
import { signupSchema } from "@/lib/schemas";
import { createUserWithOrg } from "@/server/data/team";
import { createSession, sessionCookieOptions } from "@/server/auth";
import { errorResponse, enforceRateLimit, readJson } from "@/server/http";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    enforceRateLimit(req, "signup", 8, 10 * 60_000);
    const input = await readJson(req, signupSchema);
    const { profileId, orgId } = createUserWithOrg(input);
    const { token } = createSession(profileId, orgId);
    logAudit({ orgId, actorId: profileId, action: "org.created", entity: "organization", entityId: orgId });
    const res = NextResponse.json({ ok: true, redirect: "/app" });
    res.cookies.set("estate_session", token, sessionCookieOptions);
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}
