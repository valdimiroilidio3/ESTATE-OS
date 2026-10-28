import { authed, json } from "@/server/http";
import { retryJob } from "@/server/jobs";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const POST = authed(async (_req, { session, params }) => {
  retryJob(session.org.id, params.id);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "ai.job.retried",
    entity: "ai_job",
    entityId: params.id,
  });
  return json({ ok: true });
});
