import { z } from "zod";
import { authed, json } from "@/server/http";
import { analyticsSummary, experienceStats } from "@/server/data/analytics";

export const runtime = "nodejs";

const query = z.object({ days: z.coerce.number().int().min(1).max(365).default(30) });

export const GET = authed(async (req, { session }) => {
  const url = new URL(req.url);
  const { days } = query.parse(Object.fromEntries(url.searchParams));
  return json({
    period_days: days,
    summary: analyticsSummary(session.org.id, days),
    experiences: experienceStats(session.org.id, days),
    definitions: {
      page_views: "Eventos page_view deduplicados por sessão durante 30 minutos.",
      cta_clicks: "Interações com botões principais da experiência pública.",
      leads: "Pedidos de contacto ou visita com consentimento registado.",
      visits: "Pedidos de visita criados (qualquer estado).",
      conversion: "Leads ÷ visualizações. Só com pelo menos 30 visualizações e 3 leads.",
    },
  });
});
