import { teamInviteSchema } from "@/lib/schemas";
import { authed, json, readJson, forbidden } from "@/server/http";
import { inviteMember } from "@/server/data/team";
import { roles } from "@/server/auth";
import { checkQuota } from "@/server/plans";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const POST = authed(async (req, { session }) => {
  if (!roles.canManageOrg(session.role)) throw forbidden("Apenas administradores podem convidar membros.");
  const input = await readJson(req, teamInviteSchema);
  checkQuota(session.org.id, session.org.plan_code, "seats");
  const result = inviteMember({
    orgId: session.org.id,
    email: input.email,
    role: input.role,
    title: input.title,
    invitedBy: session.profile.id,
  });
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "team.invited",
    entity: "invitation",
    entityId: result.id,
    meta: { email: input.email, role: input.role },
  });
  return json(result, { status: 201 });
});
