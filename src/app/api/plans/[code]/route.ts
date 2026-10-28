import { planUpdateSchema } from "@/lib/schemas";
import { authed, json, readJson, forbidden, notFound } from "@/server/http";
import { getPlan, updatePlan } from "@/server/plans";
import { one, type Row } from "@/server/db";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const PATCH = authed(async (req, { session, params }) => {
  const profile = one<Row>(`SELECT is_platform_admin FROM profiles WHERE id = ?`, [session.profile.id]);
  if (!profile?.is_platform_admin) throw forbidden("Configuração de planos reservada à administração da plataforma.");
  if (!getPlan(params.code)) throw notFound("Plano inexistente.");
  const patch = await readJson(req, planUpdateSchema);
  updatePlan(params.code, patch);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "plan.updated",
    entity: "plan",
    entityId: params.code,
    meta: patch as Record<string, unknown>,
  });
  return json({ ok: true });
});
