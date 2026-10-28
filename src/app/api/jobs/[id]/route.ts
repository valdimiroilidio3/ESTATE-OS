import { authed, json, notFound } from "@/server/http";
import { getJob } from "@/server/jobs";

export const runtime = "nodejs";

export const GET = authed(async (_req, { session, params }) => {
  const job = getJob(session.org.id, params.id);
  if (!job) throw notFound("Tarefa não encontrada.");
  return json({ job });
});
