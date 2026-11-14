import { many, one, run, uid, now, type Row } from "../db";
import type { AnalyticsSummary } from "@/lib/types";

export const EVENT_TYPES = [
  "page_view",
  "cta_click",
  "visit_request",
  "contact_request",
  "assistant_message",
  "share",
  "gallery_open",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export async function trackEvent(input: {
  orgId: string;
  propertyId?: string | null;
  experienceId?: string | null;
  eventType: EventType;
  sessionKey?: string | null;
  path?: string | null;
  referrer?: string | null;
  meta?: Record<string, unknown>;
}) {
  await run(
    `INSERT INTO analytics_events (id, org_id, property_id, experience_id, event_type, session_key, path, referrer, meta, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      uid(),
      input.orgId,
      input.propertyId ?? null,
      input.experienceId ?? null,
      input.eventType,
      input.sessionKey ?? null,
      input.path ?? null,
      input.referrer ?? null,
      JSON.stringify(input.meta ?? {}),
      now(),
    ],
  );
}

/** ISO-8601 lower bound for a rolling window; timestamps are stored as ISO text. */
function sinceDays(days: number) {
  const span = Math.max(1, Math.min(days, 365));
  return new Date(Date.now() - span * 86_400_000).toISOString();
}

export async function analyticsSummary(orgId: string, days = 30): Promise<AnalyticsSummary> {
  // Every window boundary is passed as a parameter: timestamps are ISO-8601 text.
  const window = sinceDays(days);
  const count = async (eventType: string) =>
    (await one<{ c: number }>(
      `SELECT count(*) AS c FROM analytics_events WHERE org_id = ? AND event_type = ? AND created_at >= ?`,
      [orgId, eventType, window],
    ))?.c ?? 0;

  const [pageViews, ctaClicks, visitRequests, assistantMessages, shares] = await Promise.all([
    count("page_view"),
    count("cta_click"),
    count("visit_request"),
    count("assistant_message"),
    count("share"),
  ]);
  const leads =
    (await one<{ c: number }>(`SELECT count(*) AS c FROM leads WHERE org_id = ? AND created_at >= ?`, [orgId, window]))
      ?.c ?? 0;

  const byPropertyRows = await many<Row>(
    `SELECT p.id AS property_id, p.title,
       (SELECT count(*) FROM analytics_events e WHERE e.property_id = p.id AND e.event_type = 'page_view' AND e.created_at >= ?) AS views,
       (SELECT count(*) FROM analytics_events e WHERE e.property_id = p.id AND e.event_type = 'cta_click' AND e.created_at >= ?) AS cta,
       (SELECT count(*) FROM leads l WHERE l.property_id = p.id AND l.created_at >= ?) AS leads,
       (SELECT count(*) FROM visits v WHERE v.property_id = p.id AND v.created_at >= ?) AS visits
     FROM properties p WHERE p.org_id = ? ORDER BY views DESC LIMIT 12`,
    [window, window, window, window, orgId],
  );

  const bySourceRows = await many<Row>(
    `SELECT source, count(*) AS count FROM leads WHERE org_id = ? AND created_at >= ?
     GROUP BY source ORDER BY count DESC`,
    [orgId, window],
  );

  const dailyRows = await many<Row>(
    `SELECT substr(created_at, 1, 10) AS day, event_type, count(*) AS c FROM analytics_events
     WHERE org_id = ? AND created_at >= ? GROUP BY substr(created_at, 1, 10), event_type`,
    [orgId, sinceDays(14)],
  );
  const dailyMap = new Map<string, { views: number; leads: number }>();
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    dailyMap.set(d, { views: 0, leads: 0 });
  }
  dailyRows.forEach((r) => {
    const bucket = dailyMap.get(r.day);
    if (!bucket) return;
    if (r.event_type === "page_view") bucket.views += r.c;
    if (r.event_type === "contact_request" || r.event_type === "visit_request") bucket.leads += r.c;
  });

  // Conversion is only shown when the sample is meaningful.
  const conversionRate = pageViews >= 30 && leads >= 3 ? Number(((leads / pageViews) * 100).toFixed(2)) : null;

  return {
    pageViews,
    ctaClicks,
    leads,
    visitRequests,
    assistantMessages,
    shares,
    conversionRate,
    byProperty: byPropertyRows.map((r) => ({
      property_id: r.property_id,
      title: r.title,
      views: r.views,
      cta: r.cta,
      leads: r.leads,
      visits: r.visits,
    })),
    bySource: bySourceRows.map((r) => ({ source: r.source, count: r.count })),
    daily: Array.from(dailyMap.entries()).map(([date, v]) => ({ date, ...v })),
  };
}

export async function experienceStats(orgId: string, days = 30) {
  const window = sinceDays(days);
  return many<Row>(
    `SELECT e.id, e.slug, e.layout, e.status, p.title,
       (SELECT count(*) FROM analytics_events a WHERE a.experience_id = e.id AND a.event_type = 'page_view' AND a.created_at >= ?) AS views,
       (SELECT count(*) FROM analytics_events a WHERE a.experience_id = e.id AND a.event_type = 'cta_click' AND a.created_at >= ?) AS cta
     FROM property_experiences e JOIN properties p ON p.id = e.property_id
     WHERE e.org_id = ? ORDER BY views DESC`,
    [window, window, orgId],
  );
}
