import { contactRequestSchema } from "@/lib/schemas";
import { errorResponse, enforceRateLimit, json, readJson, ApiError, notFound } from "@/server/http";
import { getPublicExperience } from "@/server/data/properties";
import { createLead } from "@/server/data/leads";
import { createVisit } from "@/server/data/visits";
import { trackEvent } from "@/server/data/analytics";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    enforceRateLimit(req, `contact:${slug}`, 6, 10 * 60_000);
    const publicData = getPublicExperience(slug);
    if (!publicData) throw notFound("Página não encontrada.");
    const input = await readJson(req, contactRequestSchema);
    if (input.website) throw new ApiError("Pedido inválido.", 422, "bot_detected");

    const lead = createLead({
      orgId: publicData.org.id,
      propertyId: publicData.property.id,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      source: input.kind === "visit" ? "visit_form" : "property_page",
      message: input.message ?? null,
      priority: input.kind === "visit" ? "high" : "normal",
    });

    let visitId: string | null = null;
    if (input.kind === "visit") {
      const preference = [input.preferred_date, input.preferred_time].filter(Boolean).join(" ");
      const visit = createVisit(publicData.org.id, {
        property_id: publicData.property.id,
        lead_id: lead.id,
        agent_id: null,
        scheduled_at: null,
        timezone: "Europe/Lisbon",
        status: "requested",
        notes: preference
          ? `Pedido público. Preferência indicada (por confirmar): ${preference}`
          : "Pedido público sem preferência de data.",
      });
      visitId = visit.id;
    }

    trackEvent({
      orgId: publicData.org.id,
      propertyId: publicData.property.id,
      experienceId: publicData.experience.id,
      eventType: input.kind === "visit" ? "visit_request" : "contact_request",
      path: `/p/${slug}`,
      referrer: req.headers.get("referer"),
      meta: { source: "public_form" },
    });

    logAudit({
      orgId: publicData.org.id,
      actorId: null,
      action: input.kind === "visit" ? "visit.requested" : "lead.created",
      entity: input.kind === "visit" ? "visit" : "lead",
      entityId: input.kind === "visit" ? visitId : lead.id,
      meta: { source: "public_page", property_id: publicData.property.id },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    });

    return json({
      ok: true,
      kind: input.kind,
      message:
        input.kind === "visit"
          ? "Pedido de visita registado. O consultor confirmará a disponibilidade antes de qualquer agendamento."
          : "Pedido enviado. O consultor entrará em contacto.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
