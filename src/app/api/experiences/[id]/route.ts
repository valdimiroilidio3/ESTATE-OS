import { experienceUpdateSchema } from "@/lib/schemas";
import { authed, json, readJson, forbidden, notFound } from "@/server/http";
import { updateExperience } from "@/server/data/experiences";
import { one, type Row } from "@/server/db";
import { canEdit } from "@/server/auth";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const PATCH = authed(async (req, { session, params }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  const patch = await readJson(req, experienceUpdateSchema);
  const experience = updateExperience(session.org.id, params.id, patch);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: patch.status ? `experience.${patch.status}` : "experience.updated",
    entity: "experience",
    entityId: params.id,
    meta: patch.status ? { status: patch.status } : { fields: Object.keys(patch) },
  });
  return json({ experience });
});

export const DELETE = authed(async (_req, { session, params }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  const row = one<Row>(`SELECT id FROM property_experiences WHERE id = ? AND org_id = ?`, [
    params.id,
    session.org.id,
  ]);
  if (!row) throw notFound("Experiência não encontrada.");
  const { run } = await import("@/server/db");
  run(`DELETE FROM property_experiences WHERE id = ? AND org_id = ?`, [params.id, session.org.id]);
  return json({ ok: true });
});
