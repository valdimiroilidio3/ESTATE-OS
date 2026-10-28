import { visitUpdateSchema } from "@/lib/schemas";
import { authed, json, readJson, forbidden } from "@/server/http";
import { updateVisit } from "@/server/data/visits";
import { canEdit } from "@/server/auth";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const PATCH = authed(async (req, { session, params }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  const patch = await readJson(req, visitUpdateSchema);
  const visit = updateVisit(session.org.id, params.id, patch);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "visit.updated",
    entity: "visit",
    entityId: params.id,
    meta: patch,
  });
  return json({ visit });
});
