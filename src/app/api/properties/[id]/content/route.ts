import { authed, json } from "@/server/http";
import { listContent } from "@/server/ai/studio";
import { verificationReport } from "@/server/ai/studio";
import { providerInfo } from "@/server/ai/provider";

export const runtime = "nodejs";

export const GET = authed(async (_req, { session, params }) => {
  return json({
    items: listContent(session.org.id, params.id),
    report: verificationReport(session.org.id, params.id),
    provider: providerInfo(),
  });
});
