import { z } from "zod";
import { errorResponse, enforceRateLimit, json, notFound, readJson } from "@/server/http";
import { getPublicExperience } from "@/server/data/properties";
import { trackEvent, EVENT_TYPES } from "@/server/data/analytics";

export const runtime = "nodejs";

const schema = z.object({
  event: z.enum(["page_view", "cta_click", "gallery_open", "share"]),
  referrer: z.string().max(300).optional(),
  meta: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    enforceRateLimit(req, `track:${slug}`, 60, 60 * 60_000);
    const publicData = getPublicExperience(slug);
    if (!publicData) throw notFound("Página não encontrada.");
    const input = await readJson(req, schema);
    if (!EVENT_TYPES.includes(input.event)) return json({ ok: true });
    trackEvent({
      orgId: publicData.org.id,
      propertyId: publicData.property.id,
      experienceId: publicData.experience.id,
      eventType: input.event,
      path: `/p/${slug}`,
      referrer: input.referrer ?? req.headers.get("referer"),
      meta: input.meta,
    });
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
