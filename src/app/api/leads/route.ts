import { z } from "zod";
import { authed, json, readJson, forbidden } from "@/server/http";
import { createLead, listLeads, leadStats } from "@/server/data/leads";
import { canEdit } from "@/server/auth";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const GET = authed(async (req, { session }) => {
  const url = new URL(req.url);
  return json({
    items: listLeads(session.org.id, {
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      propertyId: url.searchParams.get("propertyId") ?? undefined,
      ownerId: url.searchParams.get("ownerId") ?? undefined,
    }),
    stats: leadStats(session.org.id),
  });
});

const manualSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(40).optional(),
  property_id: z.string().uuid().nullable().optional(),
  message: z.string().max(2000).optional(),
  source: z.string().max(40).default("manual"),
});

export const POST = authed(async (req, { session }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  const input = await readJson(req, manualSchema);
  const lead = createLead({
    orgId: session.org.id,
    propertyId: input.property_id ?? null,
    name: input.name,
    email: input.email,
    phone: input.phone ?? null,
    source: input.source,
    message: input.message ?? null,
  });
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "lead.created",
    entity: "lead",
    entityId: lead.id,
    meta: { source: "manual" },
  });
  return json({ lead }, { status: 201 });
});
