import { authed, json, forbidden } from "@/server/http";
import { deleteDocument } from "@/server/data/media";
import { roles } from "@/server/auth";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const DELETE = authed(async (_req, { session, params }) => {
  if (!roles.canDelete(session.role)) throw forbidden("Apenas administradores podem eliminar documentos.");
  deleteDocument(session.org.id, params.id);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "document.deleted",
    entity: "property_document",
    entityId: params.id,
  });
  return json({ ok: true });
});
