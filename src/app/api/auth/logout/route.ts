import { NextResponse } from "next/server";
import { destroyCurrentSession, clearSessionCookieName } from "@/server/auth";
import { errorResponse } from "@/server/http";

export const runtime = "nodejs";

export async function POST() {
  try {
    await destroyCurrentSession();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(clearSessionCookieName(), "", { path: "/", maxAge: 0 });
    return res;
  } catch (error) {
    return errorResponse(error);
  }
}
