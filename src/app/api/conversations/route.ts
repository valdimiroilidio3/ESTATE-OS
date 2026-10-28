import { authed, json } from "@/server/http";
import { assistantQuality, listConversations } from "@/server/data/conversations";
import { one, type Row } from "@/server/db";
import { parseJson } from "@/server/db";

export const runtime = "nodejs";

export const GET = authed(async (req, { session }) => {
  const url = new URL(req.url);
  const settings = parseJson<{ showAssistantTranscripts?: boolean }>(
    one<Row>(`SELECT settings FROM organizations WHERE id = ?`, [session.org.id])?.settings,
    {},
  );
  const enabled = settings.showAssistantTranscripts !== false;
  const items = listConversations(session.org.id, url.searchParams.get("propertyId") ?? undefined);
  return json({
    items: enabled
      ? items
      : items.map((conversation) => ({ ...conversation, messages: [], redacted: true })),
    transcriptsEnabled: enabled,
    quality: assistantQuality(session.org.id, url.searchParams.get("propertyId") ?? undefined),
  });
});
