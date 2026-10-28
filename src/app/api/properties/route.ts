import { propertyInputSchema } from "@/lib/schemas";
import { authed, json, readJson } from "@/server/http";
import { createProperty, listProperties } from "@/server/data/properties";
import { checkQuota } from "@/server/plans";
import { logAudit } from "@/server/audit";
import { enqueueJob, type TaskType } from "@/server/jobs";
import { forbidden } from "@/server/http";
import { canEdit } from "@/server/auth";

export const runtime = "nodejs";

export const GET = authed(async (req, { session }) => {
  const url = new URL(req.url);
  const result = listProperties(session.org.id, {
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    operation: url.searchParams.get("operation") ?? undefined,
    type: url.searchParams.get("type") ?? undefined,
    limit: Number(url.searchParams.get("limit") ?? 24),
    offset: Number(url.searchParams.get("offset") ?? 0),
  });
  return json(result);
});

export const POST = authed(async (req, { session }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  const input = await readJson(req, propertyInputSchema);
  checkQuota(session.org.id, session.org.plan_code, "properties");
  const property = createProperty(session.org.id, session.profile.id, input);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "property.created",
    entity: "property",
    entityId: property.id,
    meta: { reference: property.reference },
  });
  const tasks = (input.tasks.length ? input.tasks : ["validate_fields", "generate_listing"]) as TaskType[];
  const valid: TaskType[] = [
    "validate_fields",
    "analyze_media",
    "generate_listing",
    "generate_multilingual",
    "generate_audience_versions",
    "generate_campaign",
    "generate_media_brief",
    "prepare_experience",
  ];
  const jobIds = tasks
    .filter((t) => valid.includes(t))
    .map((taskType) =>
      enqueueJob({
        orgId: session.org.id,
        propertyId: property.id,
        taskType,
        createdBy: session.profile.id,
      }),
    );
  return json({ property, jobIds }, { status: 201 });
});
