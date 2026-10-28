import { contentUpdateSchema } from "@/lib/schemas";
import { authed, json, readJson, forbidden } from "@/server/http";
import { deleteContent, updateContent } from "@/server/ai/studio";
import { canEdit } from "@/server/auth";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const PATCH = authed(async (req, { session, params }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  const patch = await readJson(req, contentUpdateSchema);
  const content = updateContent(session.org.id, params.id, patch, session.profile.id);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: patch.status === "approved" ? "content.approved" : "content.updated",
    entity: "property_content",
    entityId: params.id,
    meta: { kind: content.kind, locale: content.locale, status: content.status },
  });
  return json({ content });
});

export const DELETE = authed(async (_req, { session, params }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  deleteContent(session.org.id, params.id);
  return json({ ok: true });
});
