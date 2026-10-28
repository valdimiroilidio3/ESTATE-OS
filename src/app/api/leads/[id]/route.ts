import { leadUpdateSchema } from "@/lib/schemas";
import { authed, json, readJson, forbidden } from "@/server/http";
import { getLead, listLeadEvents, updateLead } from "@/server/data/leads";
import { canEdit } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { notFound } from "@/server/http";

export const runtime = "nodejs";

export const GET = authed(async (_req, { session, params }) => {
  const lead = getLead(session.org.id, params.id);
  if (!lead) throw notFound("Lead não encontrada.");
  return json({ lead, events: listLeadEvents(session.org.id, params.id) });
});

export const PATCH = authed(async (req, { session, params }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  const patch = await readJson(req, leadUpdateSchema);
  const lead = updateLead(session.org.id, params.id, patch, session.profile.id);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "lead.updated",
    entity: "lead",
    entityId: params.id,
    meta: patch,
  });
  return json({ lead });
});
