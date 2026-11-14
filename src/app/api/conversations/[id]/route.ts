import { conversationReviewSchema } from "@/lib/schemas";
import { authed, json, readJson, notFound } from "@/server/http";
import { getConversation, setReviewStatus } from "@/server/data/conversations";
import { one, parseJson, type Row } from "@/server/db";
import { forbidden } from "@/server/http";
import { canEdit } from "@/server/auth";
import { logAudit } from "@/server/audit";

export const runtime = "nodejs";

export const GET = authed(async (_req, { session, params }) => {
  const settings = parseJson<{ showAssistantTranscripts?: boolean }>(
    (await one<Row>(`SELECT settings FROM organizations WHERE id = ?`, [session.org.id]))?.settings,
    {},
  );
  if (settings.showAssistantTranscripts === false) {
    throw forbidden("As transcrições do assistente estão desativadas nas definições de privacidade.");
  }
  const data = await getConversation(session.org.id, params.id);
  if (!data) throw notFound("Conversa não encontrada.");
  return json(data);
});

export const PATCH = authed(async (req, { session, params }) => {
  if (!canEdit(session.role)) throw forbidden("O seu perfil é de leitura.");
  const input = await readJson(req, conversationReviewSchema);
  await setReviewStatus(session.org.id, params.id, input.review_status);
  await logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "conversation.reviewed",
    entity: "conversation",
    entityId: params.id,
    meta: input,
  });
  return json({ ok: true });
});
