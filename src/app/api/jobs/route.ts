import { jobCreateSchema } from "@/lib/schemas";
import { authed, json, readJson } from "@/server/http";
import { enqueueJob, listJobs, jobStats, TASK_TYPES, type TaskType } from "@/server/jobs";
import { getProperty } from "@/server/data/properties";
import { checkQuota } from "@/server/plans";
import { notFound, forbidden } from "@/server/http";
import { canEdit } from "@/server/auth";

export const runtime = "nodejs";

export const GET = authed(async (req, { session }) => {
  const url = new URL(req.url);
  return json({
    items: listJobs(session.org.id, {
      propertyId: url.searchParams.get("propertyId") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 30),
    }),
    stats: jobStats(session.org.id),
    catalogue: TASK_TYPES,
  });
});

export const POST = authed(async (req, { session }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  const input = await readJson(req, jobCreateSchema);
  const property = getProperty(session.org.id, input.property_id);
  if (!property) throw notFound("Imóvel não encontrado.");
  checkQuota(session.org.id, session.org.plan_code, "ai_jobs_month");
  const id = enqueueJob({
    orgId: session.org.id,
    propertyId: input.property_id,
    taskType: input.task_type as TaskType,
    createdBy: session.profile.id,
    payload: { ...input.input, locale: input.locale, variant: input.variant },
  });
  return json({ jobId: id }, { status: 202 });
});
