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

export function trackEvent(input: {
  orgId: string;
  propertyId?: string | null;
  experienceId?: string | null;
  eventType: EventType;
  sessionKey?: string | null;
  path?: string | null;
  referrer?: string | null;
  meta?: Record<string, unknown>;
}) {
  run(
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

function rangeFilter(days: number) {
  return `datetime('now', '-${Math.max(1, Math.min(days, 365))} day')`;
}

export function analyticsSummary(orgId: string, days = 30): AnalyticsSummary {
  const window = rangeFilter(days);
  const count = (eventType: string) =>
    one<{ c: number }>(
      `SELECT count(*) AS c FROM analytics_events WHERE org_id = ? AND event_type = ? AND created_at >= ${window}`,
      [orgId, eventType],
    )?.c ?? 0;

  const pageViews = count("page_view");
  const ctaClicks = count("cta_click");
  const visitRequests = count("visit_request");
  const assistantMessages = count("assistant_message");
  const shares = count("share");
  const leads =
    one<{ c: number }>(
      `SELECT count(*) AS c FROM leads WHERE org_id = ? AND created_at >= ${window}`,
      [orgId],
    )?.c ?? 0;

  const byPropertyRows = many<Row>(
    `SELECT p.id AS property_id, p.title,
       (SELECT count(*) FROM analytics_events e WHERE e.property_id = p.id AND e.event_type = 'page_view' AND e.created_at >= ${window}) AS views,
       (SELECT count(*) FROM analytics_events e WHERE e.property_id = p.id AND e.event_type = 'cta_click' AND e.created_at >= ${window}) AS cta,
       (SELECT count(*) FROM leads l WHERE l.property_id = p.id AND l.created_at >= ${window}) AS leads,
       (SELECT count(*) FROM visits v WHERE v.property_id = p.id AND v.created_at >= ${window}) AS visits
     FROM properties p WHERE p.org_id = ? ORDER BY views DESC LIMIT 12`,
    [orgId],
  );

  const bySourceRows = many<Row>(
    `SELECT source, count(*) AS count FROM leads WHERE org_id = ? AND created_at >= ${window}
     GROUP BY source ORDER BY count DESC`,
    [orgId],
  );

  const dailyRows = many<Row>(
    `SELECT date(created_at) AS date, event_type, count(*) AS c FROM analytics_events
     WHERE org_id = ? AND created_at >= datetime('now','-13 day') GROUP BY date(created_at), event_type`,
    [orgId],
  );
  const dailyMap = new Map<string, { views: number; leads: number }>();
  for (let i = 13; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    dailyMap.set(d, { views: 0, leads: 0 });
  }
  dailyRows.forEach((r) => {
    const bucket = dailyMap.get(r.date);
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

export function experienceStats(orgId: string, days = 30) {
  return many<Row>(
    `SELECT e.id, e.slug, e.layout, e.status, p.title,
       (SELECT count(*) FROM analytics_events a WHERE a.experience_id = e.id AND a.event_type = 'page_view' AND a.created_at >= ${rangeFilter(days)}) AS views,
       (SELECT count(*) FROM analytics_events a WHERE a.experience_id = e.id AND a.event_type = 'cta_click' AND a.created_at >= ${rangeFilter(days)}) AS cta
     FROM property_experiences e JOIN properties p ON p.id = e.property_id
     WHERE e.org_id = ? ORDER BY views DESC`,
    [orgId],
  );
}
