import { z } from "zod";
import { authed, json, readJson, forbidden, notFound } from "@/server/http";
import { createExperience, getExperience, listExperiences } from "@/server/data/experiences";
import { getProperty } from "@/server/data/properties";
import { canEdit } from "@/server/auth";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

const schema = z.object({
  property_id: z.string().uuid(),
  layout: z.enum(["architectural", "signature", "investment"]).default("architectural"),
});

export const GET = authed(async (_req, { session }) => {
  return json({ items: listExperiences(session.org.id) });
});

export const POST = authed(async (req, { session }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  const input = await readJson(req, schema);
  if (!getProperty(session.org.id, input.property_id)) throw notFound("Imóvel não encontrado.");
  const experience = createExperience(session.org.id, session.profile.id, input.property_id, input.layout);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "experience.created",
    entity: "experience",
    entityId: experience.id,
    meta: { layout: experience.layout },
  });
  return json({ experience }, { status: 201 });
});
