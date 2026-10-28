import { many, one, run, uid, now, parseJson, type Row } from "../db";
import { ApiError } from "../http";

export function getOrCreateConversation(orgId: string, propertyId: string, visitorKey: string) {
  const existing = one<Row>(
    `SELECT * FROM conversations WHERE org_id = ? AND property_id = ? AND visitor_key = ? ORDER BY last_at DESC LIMIT 1`,
    [orgId, propertyId, visitorKey],
  );
  if (existing) return existing;
  const id = uid();
  run(
    `INSERT INTO conversations (id, org_id, property_id, visitor_key, channel, review_status, created_at, last_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [id, orgId, propertyId, visitorKey, "property_assistant", "unreviewed", now(), now()],
  );
  return one<Row>(`SELECT * FROM conversations WHERE id = ?`, [id])!;
}

export function appendMessage(input: {
  orgId: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  citations?: { label: string; value: string; source: string }[];
  provider?: string;
  grounded?: boolean;
}) {
  run(
    `INSERT INTO conversation_messages (id, org_id, conversation_id, role, content, citations, provider, grounded, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      uid(),
      input.orgId,
      input.conversationId,
      input.role,
      input.content,
      JSON.stringify(input.citations ?? []),
      input.provider ?? null,
      input.grounded === false ? 0 : 1,
      now(),
    ],
  );
  run(`UPDATE conversations SET last_at = ? WHERE id = ?`, [now(), input.conversationId]);
}

export function listConversations(orgId: string, propertyId?: string) {
  return many<Row>(
    `SELECT c.*, p.title AS property_title,
       (SELECT count(*) FROM conversation_messages m WHERE m.conversation_id = c.id) AS message_count,
       (SELECT content FROM conversation_messages m WHERE m.conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message
     FROM conversations c LEFT JOIN properties p ON p.id = c.property_id
     WHERE c.org_id = ? ${propertyId ? "AND c.property_id = ?" : ""}
     ORDER BY c.last_at DESC LIMIT 80`,
    propertyId ? [orgId, propertyId] : [orgId],
  );
}

export function getConversation(orgId: string, id: string) {
  const convo = one<Row>(
    `SELECT c.*, p.title AS property_title FROM conversations c LEFT JOIN properties p ON p.id = c.property_id
     WHERE c.id = ? AND c.org_id = ?`,
    [id, orgId],
  );
  if (!convo) return null;
  const messages = many<Row>(
    `SELECT * FROM conversation_messages WHERE conversation_id = ? AND org_id = ? ORDER BY created_at ASC`,
    [id, orgId],
  ).map((m) => ({ ...m, citations: parseJson(m.citations, []) }));
  return { conversation: convo, messages };
}

export function setReviewStatus(orgId: string, id: string, status: "unreviewed" | "reviewed" | "flagged") {
  const convo = one<Row>(`SELECT id FROM conversations WHERE id = ? AND org_id = ?`, [id, orgId]);
  if (!convo) throw new ApiError("Conversa inexistente.", 404, "not_found");
  run(`UPDATE conversations SET review_status = ? WHERE id = ? AND org_id = ?`, [status, id, orgId]);
}

export function assistantQuality(orgId: string, propertyId?: string) {
  const scope = propertyId ? "AND c.property_id = ?" : "";
  const params = propertyId ? [orgId, propertyId] : [orgId];
  const rows = many<Row>(
    `SELECT m.grounded, count(*) AS c FROM conversation_messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE c.org_id = ? AND m.role = 'assistant' ${scope} GROUP BY m.grounded`,
    params,
  );
  const grounded = rows.find((r) => r.grounded === 1)?.c ?? 0;
  const ungrounded = rows.find((r) => r.grounded === 0)?.c ?? 0;
  return { grounded, ungrounded, total: grounded + ungrounded };
}
