import { memberRoleSchema } from "@/lib/schemas";
import { authed, json, readJson, forbidden } from "@/server/http";
import { removeMember, updateMemberRole } from "@/server/data/team";
import { roles } from "@/server/auth";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const PATCH = authed(async (req, { session, params }) => {
  if (!roles.canManageOrg(session.role)) throw forbidden("Apenas administradores podem alterar funções.");
  const input = await readJson(req, memberRoleSchema);
  updateMemberRole(session.org.id, params.profileId, input.role);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "team.role_changed",
    entity: "organization_member",
    entityId: params.profileId,
    meta: { role: input.role },
  });
  return json({ ok: true });
});

export const DELETE = authed(async (_req, { session, params }) => {
  if (!roles.canManageOrg(session.role)) throw forbidden("Apenas administradores podem remover membros.");
  if (params.profileId === session.profile.id) throw forbidden("Não pode remover a sua própria conta.");
  removeMember(session.org.id, params.profileId);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "team.member_removed",
    entity: "organization_member",
    entityId: params.profileId,
  });
  return json({ ok: true });
});
