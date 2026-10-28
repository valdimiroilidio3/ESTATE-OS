import { leadNoteSchema } from "@/lib/schemas";
import { authed, json, readJson, forbidden, notFound } from "@/server/http";
import { addLeadEvent, getLead, listLeadEvents } from "@/server/data/leads";
import { canEdit } from "@/server/auth";

export const runtime = "nodejs";

export const POST = authed(async (req, { session, params }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  const input = await readJson(req, leadNoteSchema);
  if (!getLead(session.org.id, params.id)) throw notFound("Lead não encontrada.");
  addLeadEvent({
    orgId: session.org.id,
    leadId: params.id,
    type: input.type,
    note: input.note,
    actorId: session.profile.id,
  });
  return json({ events: listLeadEvents(session.org.id, params.id) }, { status: 201 });
});
