import { authed, json, forbidden } from "@/server/http";
import { canEdit } from "@/server/auth";
import { retryJob } from "@/server/jobs";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const POST = authed(async (_req, { session, params }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  await retryJob(session.org.id, params.id);
  await logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "ai.job.retried",
    entity: "ai_job",
    entityId: params.id,
  });
  return json({ ok: true });
});
