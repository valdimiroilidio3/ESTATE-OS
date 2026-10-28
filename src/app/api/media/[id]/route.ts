import { mediaUpdateSchema } from "@/lib/schemas";
import { authed, json, notFound, readJson, forbidden } from "@/server/http";
import { deleteMedia, getMedia, updateMedia } from "@/server/data/media";
import { canEdit } from "@/server/auth";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const PATCH = authed(async (req, { session, params }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  const patch = await readJson(req, mediaUpdateSchema);
  const media = updateMedia(session.org.id, params.id, patch);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "media.updated",
    entity: "property_media",
    entityId: params.id,
    meta: { fields: Object.keys(patch) },
  });
  return json({ media });
});

export const DELETE = authed(async (_req, { session, params }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  if (!getMedia(session.org.id, params.id)) throw notFound("Ficheiro não encontrado.");
  deleteMedia(session.org.id, params.id);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "media.deleted",
    entity: "property_media",
    entityId: params.id,
  });
  return json({ ok: true });
});
