import { conversationReviewSchema } from "@/lib/schemas";
import { authed, json, readJson, notFound } from "@/server/http";
import { getConversation, setReviewStatus } from "@/server/data/conversations";
import { one, parseJson, type Row } from "@/server/db";
import { forbidden } from "@/server/http";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const GET = authed(async (_req, { session, params }) => {
  const settings = parseJson<{ showAssistantTranscripts?: boolean }>(
    one<Row>(`SELECT settings FROM organizations WHERE id = ?`, [session.org.id])?.settings,
    {},
  );
  if (settings.showAssistantTranscripts === false) {
    throw forbidden("As transcrições do assistente estão desativadas nas definições de privacidade.");
  }
  const data = getConversation(session.org.id, params.id);
  if (!data) throw notFound("Conversa não encontrada.");
  return json(data);
});

export const PATCH = authed(async (req, { session, params }) => {
  const input = await readJson(req, conversationReviewSchema);
  setReviewStatus(session.org.id, params.id, input.review_status);
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "conversation.reviewed",
    entity: "conversation",
    entityId: params.id,
    meta: input,
  });
  return json({ ok: true });
});
