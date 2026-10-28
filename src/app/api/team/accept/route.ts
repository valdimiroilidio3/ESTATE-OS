import { z } from "zod";
import { authed, json, readJson } from "@/server/http";
import { acceptInvitation } from "@/server/data/team";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const POST = authed(async (req, { session }) => {
  const { token } = await readJson(req, z.object({ token: z.string().min(10).max(200) }));
  const orgId = acceptInvitation(token, session.profile.id);
  logAudit({
    orgId,
    actorId: session.profile.id,
    action: "team.invitation_accepted",
    entity: "invitation",
  });
  return json({ ok: true, orgId });
});
