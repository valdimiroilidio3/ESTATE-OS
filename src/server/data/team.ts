import crypto from "node:crypto";
import { many, one, run, uid, now, type Row } from "../db";
import { ApiError } from "../http";
import { hashPassword } from "../auth";
import type { Role } from "@/lib/types";

export function listMembers(orgId: string) {
  return many<Row>(
    `SELECT m.profile_id, m.role, m.title, m.created_at, p.full_name, p.email, p.avatar_url,
       (SELECT count(*) FROM leads l WHERE l.owner_id = p.id AND l.org_id = m.org_id) AS lead_count,
       (SELECT count(*) FROM visits v WHERE v.agent_id = p.id AND v.org_id = m.org_id) AS visit_count
     FROM organization_members m JOIN profiles p ON p.id = m.profile_id
     WHERE m.org_id = ? ORDER BY m.role, p.full_name`,
    [orgId],
  );
}

export function listInvitations(orgId: string) {
  return many<Row>(
    `SELECT i.*, p.full_name AS invited_by_name FROM invitations i LEFT JOIN profiles p ON p.id = i.invited_by
     WHERE i.org_id = ? ORDER BY i.created_at DESC`,
    [orgId],
  );
}

export function inviteMember(input: {
  orgId: string;
  email: string;
  role: Role;
  title?: string;
  invitedBy: string;
}) {
  const existingProfile = one<Row>(`SELECT id, full_name FROM profiles WHERE lower(email) = lower(?)`, [input.email]);
  const token = crypto.randomBytes(24).toString("base64url");
  if (existingProfile) {
    const already = one<Row>(
      `SELECT 1 FROM organization_members WHERE org_id = ? AND profile_id = ?`,
      [input.orgId, existingProfile.id],
    );
    if (already) throw new ApiError("Esta pessoa já pertence à organização.", 409, "already_member");
    run(`INSERT INTO organization_members (org_id, profile_id, role, title, created_at) VALUES (?,?,?,?,?)`, [
      input.orgId,
      existingProfile.id,
      input.role,
      input.title ?? null,
      now(),
    ]);
  }
  const id = uid();
  run(
    `INSERT INTO invitations (id, org_id, email, role, token, status, invited_by, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, input.orgId, input.email, input.role, token, existingProfile ? "accepted" : "pending", input.invitedBy, now()],
  );
  return { id, token, attached: Boolean(existingProfile) };
}

export function acceptInvitation(token: string, profileId: string) {
  const invite = one<Row>(`SELECT * FROM invitations WHERE token = ? AND status = 'pending'`, [token]);
  if (!invite) throw new ApiError("Convite inválido ou já utilizado.", 404, "invalid_invite");
  run(`INSERT OR IGNORE INTO organization_members (org_id, profile_id, role, created_at) VALUES (?,?,?,?)`, [
    invite.org_id,
    profileId,
    invite.role,
    now(),
  ]);
  run(`UPDATE invitations SET status = 'accepted' WHERE id = ?`, [invite.id]);
  return invite.org_id as string;
}

export function updateMemberRole(orgId: string, profileId: string, role: Role) {
  const owners =
    one<{ c: number }>(`SELECT count(*) AS c FROM organization_members WHERE org_id = ? AND role = 'owner'`, [orgId])
      ?.c ?? 0;
  const member = one<Row>(`SELECT role FROM organization_members WHERE org_id = ? AND profile_id = ?`, [
    orgId,
    profileId,
  ]);
  if (!member) throw new ApiError("Membro inexistente.", 404, "not_found");
  if (member.role === "owner" && role !== "owner" && owners <= 1) {
    throw new ApiError("A organização precisa de pelo menos um proprietário.", 409, "last_owner");
  }
  run(`UPDATE organization_members SET role = ? WHERE org_id = ? AND profile_id = ?`, [role, orgId, profileId]);
}

export function removeMember(orgId: string, profileId: string) {
  const member = one<Row>(`SELECT role FROM organization_members WHERE org_id = ? AND profile_id = ?`, [
    orgId,
    profileId,
  ]);
  if (!member) throw new ApiError("Membro inexistente.", 404, "not_found");
  if (member.role === "owner") {
    const owners =
      one<{ c: number }>(
        `SELECT count(*) AS c FROM organization_members WHERE org_id = ? AND role = 'owner'`,
        [orgId],
      )?.c ?? 0;
    if (owners <= 1) throw new ApiError("Não é possível remover o único proprietário.", 409, "last_owner");
  }
  run(`DELETE FROM organization_members WHERE org_id = ? AND profile_id = ?`, [orgId, profileId]);
}

export function getOrg(orgId: string) {
  return one<Row>(`SELECT * FROM organizations WHERE id = ?`, [orgId]);
}

export function updateOrg(
  orgId: string,
  patch: { name?: string; plan_code?: string; branding?: Record<string, unknown>; settings?: Record<string, unknown> },
) {
  const org = getOrg(orgId);
  if (!org) throw new ApiError("Organização inexistente.", 404, "not_found");
  const branding = { ...safe(org.branding), ...(patch.branding ?? {}) };
  const settings = { ...safe(org.settings), ...(patch.settings ?? {}) };
  run(`UPDATE organizations SET name = ?, plan_code = ?, branding = ?, settings = ? WHERE id = ?`, [
    patch.name ?? org.name,
    patch.plan_code ?? org.plan_code,
    JSON.stringify(branding),
    JSON.stringify(settings),
    orgId,
  ]);
}

export function createUserWithOrg(input: {
  fullName: string;
  email: string;
  password: string;
  orgName: string;
}) {
  const existing = one<Row>(`SELECT id FROM profiles WHERE lower(email) = lower(?)`, [input.email]);
  if (existing) throw new ApiError("Já existe uma conta com este email.", 409, "email_taken");
  const profileId = uid();
  const orgId = uid();
  const slug = `${input.orgName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40)}-${crypto.randomBytes(3).toString("hex")}`;
  run(
    `INSERT INTO profiles (id, email, full_name, password_hash, created_at) VALUES (?,?,?,?,?)`,
    [profileId, input.email, input.fullName, hashPassword(input.password), now()],
  );
  run(
    `INSERT INTO organizations (id, name, slug, plan_code, branding, settings, created_at) VALUES (?,?,?,?,?,?,?)`,
    [orgId, input.orgName, slug, "starter", "{}", "{}", now()],
  );
  run(`INSERT INTO organization_members (org_id, profile_id, role, created_at) VALUES (?,?,?,?)`, [
    orgId,
    profileId,
    "owner",
    now(),
  ]);
  run(
    `INSERT INTO subscriptions (id, org_id, plan_code, status, created_at) VALUES (?,?,?,?,?)`,
    [uid(), orgId, "starter", "unconfigured", now()],
  );
  return { profileId, orgId };
}

function safe(v: unknown) {
  try {
    return typeof v === "string" ? JSON.parse(v) : {};
  } catch {
    return {};
  }
}
