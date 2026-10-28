import { propertyUpdateSchema } from "@/lib/schemas";
import { authed, json, notFound, readJson, forbidden } from "@/server/http";
import { deleteProperty, getPropertyBundle, updateProperty } from "@/server/data/properties";
import { logAudit } from "@/server/audit";
import { canEdit, roles } from "@/server/auth";

export const runtime = "nodejs";

export const GET = authed(async (_req, { session, params }) => {
  const bundle = getPropertyBundle(session.org.id, params.id);
  if (!bundle) throw notFound("Imóvel não encontrado.");
  return json(bundle);
});

export const PATCH = authed(async (req, { session, params }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  const patch = await readJson(req, propertyUpdateSchema);
  const property = updateProperty(session.org.id, params.id, patch);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "property.updated",
    entity: "property",
    entityId: params.id,
    meta: { fields: Object.keys(patch) },
  });
  return json({ property });
});

export const DELETE = authed(async (_req, { session, params }) => {
  if (!roles.canDelete(session.role)) throw forbidden("Apenas administradores podem eliminar imóveis.");
  deleteProperty(session.org.id, params.id);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "property.deleted",
    entity: "property",
    entityId: params.id,
  });
  return json({ ok: true });
});
