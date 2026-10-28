import { visitInputSchema } from "@/lib/schemas";
import { authed, json, readJson, forbidden } from "@/server/http";
import { createVisit, listVisits } from "@/server/data/visits";
import { canEdit } from "@/server/auth";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const GET = authed(async (req, { session }) => {
  const url = new URL(req.url);
  return json({
    items: listVisits(session.org.id, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      propertyId: url.searchParams.get("propertyId") ?? undefined,
    }),
  });
});

export const POST = authed(async (req, { session }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  const input = await readJson(req, visitInputSchema);
  const visit = createVisit(session.org.id, {
    ...input,
    agent_id: input.agent_id ?? session.profile.id,
  });
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "visit.created",
    entity: "visit",
    entityId: visit.id,
    meta: { property_id: input.property_id, status: visit.status },
  });
  return json({ visit }, { status: 201 });
});
