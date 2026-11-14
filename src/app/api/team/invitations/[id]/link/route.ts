import { authed, json, forbidden } from "@/server/http";
import { rotateInvitationToken } from "@/server/data/team";
import { roles } from "@/server/auth";
import { logAudit, logSecurityEvent } from "@/server/audit";

export const runtime = "nodejs";

/**
 * Returns a fresh invitation token. The stored value is a hash, so a link can
 * never be recovered from the database — only reissued, and reissuing
 * invalidates the previous one.
 */
export const POST = authed(async (_req, { session, params }) => {
  if (!roles.canManageOrg(session.role)) throw forbidden("Apenas administradores podem gerar links de convite.");
  const token = await rotateInvitationToken(session.org.id, params.id);
  await logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "team.invite_link_issued",
    entity: "invitation",
    entityId: params.id,
  });
  await logSecurityEvent({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "invitation.token_rotated",
    outcome: "allowed",
    route: `/api/team/invitations/${params.id}/link`,
  });
  return json({ token });
});
