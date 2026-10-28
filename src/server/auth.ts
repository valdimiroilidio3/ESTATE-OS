import crypto from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { one, run, uid, now, type Row } from "./db";
import type { Organization, Profile, Role, Session } from "@/lib/types";

const COOKIE = "estate_session";
const SESSION_DAYS = 30;
const SCRYPT_N = 16384;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64, { N: SCRYPT_N }).toString("hex");
  return `scrypt$${SCRYPT_N}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, nStr, salt, hash] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const derived = crypto.scryptSync(password, salt, 64, { N: Number(nStr) }).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(derived, "hex"), Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export function createSession(profileId: string, orgId: string): { token: string; expires: Date } {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  run(`INSERT INTO sessions (id, profile_id, org_id, expires_at) VALUES (?, ?, ?, ?)`, [
    hashToken(token),
    profileId,
    orgId,
    expires.toISOString(),
  ]);
  return { token, expires };
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
  path: "/",
  maxAge: SESSION_DAYS * 86400,
};

export function clearSessionCookieName() {
  return COOKIE;
}

export const getSession = cache(async (): Promise<Session | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const row = one<Row>(
    `SELECT s.id AS session_id, s.expires_at,
            p.id AS profile_id, p.email, p.full_name, p.locale, p.avatar_url,
            o.id AS org_id, o.name AS org_name, o.slug AS org_slug, o.plan_code,
            o.branding, o.settings, m.role
     FROM sessions s
     JOIN profiles p ON p.id = s.profile_id
     JOIN organizations o ON o.id = s.org_id
     JOIN organization_members m ON m.org_id = s.org_id AND m.profile_id = s.profile_id
     WHERE s.id = ?`,
    [hashToken(token)],
  );
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    run(`DELETE FROM sessions WHERE id = ?`, [row.session_id]);
    return null;
  }
  const profile: Profile = {
    id: row.profile_id,
    email: row.email,
    full_name: row.full_name,
    locale: row.locale,
    avatar_url: row.avatar_url,
  };
  const org: Organization = {
    id: row.org_id,
    name: row.org_name,
    slug: row.org_slug,
    plan_code: row.plan_code,
    branding: safeJson(row.branding),
    settings: safeJson(row.settings),
  };
  return { profile, org, role: row.role as Role, sessionId: row.session_id };
});

function safeJson(v: unknown): Record<string, unknown> {
  try {
    return typeof v === "string" ? JSON.parse(v) : {};
  } catch {
    return {};
  }
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) run(`DELETE FROM sessions WHERE id = ?`, [hashToken(token)]);
}

export async function authenticate(email: string, password: string) {
  const row = one<Row>(`SELECT * FROM profiles WHERE lower(email) = lower(?)`, [email]);
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  const membership = one<Row>(
    `SELECT org_id, role FROM organization_members WHERE profile_id = ? ORDER BY created_at LIMIT 1`,
    [row.id],
  );
  if (!membership) return null;
  return { profile: row, orgId: membership.org_id as string, role: membership.role as Role };
}

export const roles = {
  canManageOrg: (role: Role) => role === "owner" || role === "admin",
  canEdit: (role: Role) => role !== "viewer",
  canDelete: (role: Role) => role === "owner" || role === "admin",
};

export function canEdit(role: Role) {
  return role !== "viewer";
}

export function assertRole(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}

export function avatarInitials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function newId() {
  return uid();
}

export function timestamp() {
  return now();
}
