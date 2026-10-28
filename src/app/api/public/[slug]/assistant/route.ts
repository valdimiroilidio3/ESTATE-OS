import crypto from "node:crypto";
import { assistantMessageSchema } from "@/lib/schemas";
import { errorResponse, enforceRateLimit, json, readJson, notFound } from "@/server/http";
import { getPublicExperience } from "@/server/data/properties";
import { answerQuestion, suggestedQuestions } from "@/server/ai/assistant";
import { appendMessage, getOrCreateConversation } from "@/server/data/conversations";
import { trackEvent } from "@/server/data/analytics";
import { providerInfo } from "@/server/ai/provider";
import { one, type Row, parseJson } from "@/server/db";

export const runtime = "nodejs";
const COOKIE = "estate_visitor";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    enforceRateLimit(req, `assistant:${slug}`, 30, 60 * 60_000);
    const publicData = getPublicExperience(slug);
    if (!publicData) throw notFound("Página não encontrada.");

    const settings = parseJson<{ assistantEnabled?: boolean }>(
      one<Row>(`SELECT settings FROM organizations WHERE id = ?`, [publicData.org.id])?.settings,
      {},
    );
    if (settings.assistantEnabled === false) {
      return json({ error: "O assistente está desativado para esta organização.", code: "assistant_disabled" }, { status: 403 });
    }

    const input = await readJson(req, assistantMessageSchema);
    let visitorKey = req.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${COOKIE}=`))
      ?.split("=")[1];
    let setCookie = false;
    if (!visitorKey) {
      visitorKey = crypto.randomUUID();
      setCookie = true;
    }

    const conversation = getOrCreateConversation(publicData.org.id, publicData.property.id, visitorKey);
    appendMessage({
      orgId: publicData.org.id,
      conversationId: conversation.id,
      role: "user",
      content: input.message,
    });
    const answer = answerQuestion(publicData.org.id, publicData.property.id, input.message, "pt");
    appendMessage({
      orgId: publicData.org.id,
      conversationId: conversation.id,
      role: "assistant",
      content: answer.answer,
      citations: answer.citations,
      provider: providerInfo().id,
      grounded: answer.grounded,
    });
    trackEvent({
      orgId: publicData.org.id,
      propertyId: publicData.property.id,
      experienceId: publicData.experience.id,
      eventType: "assistant_message",
      path: `/p/${slug}`,
      meta: { intent: answer.intent, grounded: answer.grounded },
    });

    const response = json({
      answer: answer.answer,
      citations: answer.citations,
      grounded: answer.grounded,
      cta: answer.cta,
      intent: answer.intent,
      suggested: suggestedQuestions(publicData.property.id, publicData.org.id, "pt"),
    });
    if (setCookie) {
      response.cookies.set(COOKIE, visitorKey, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 180,
      });
    }
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
