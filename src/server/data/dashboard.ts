import { many, one, type Row } from "../db";
import { listProperties } from "./properties";
import { leadStats, listLeads } from "./leads";
import { upcomingVisits } from "./visits";
import { jobStats, listJobs } from "../jobs";
import { listAudit } from "../audit";
import { analyticsSummary } from "./analytics";
import { getPlan } from "../plans";

export function overview(orgId: string) {
  const propertyCounts = many<{ status: string; c: number }>(
    `SELECT status, count(*) AS c FROM properties WHERE org_id = ? GROUP BY status`,
    [orgId],
  );
  const counts = Object.fromEntries(propertyCounts.map((r) => [r.status, r.c])) as Record<string, number>;
  const experiences = {
    published:
      one<{ c: number }>(`SELECT count(*) AS c FROM property_experiences WHERE org_id = ? AND status = 'published'`, [
        orgId,
      ])?.c ?? 0,
    draft:
      one<{ c: number }>(
        `SELECT count(*) AS c FROM property_experiences WHERE org_id = ? AND status IN ('draft','unpublished')`,
        [orgId],
      )?.c ?? 0,
  };
  const leads = leadStats(orgId);
  const visits = {
    upcoming:
      one<{ c: number }>(
        `SELECT count(*) AS c FROM visits WHERE org_id = ? AND status IN ('requested','confirmed','rescheduled')
         AND (scheduled_at IS NULL OR scheduled_at >= datetime('now'))`,
        [orgId],
      )?.c ?? 0,
    requested:
      one<{ c: number }>(`SELECT count(*) AS c FROM visits WHERE org_id = ? AND status = 'requested'`, [orgId])?.c ?? 0,
  };
  const analytics = analyticsSummary(orgId, 30);
  const plan = getPlan(
    one<Row>(`SELECT plan_code FROM organizations WHERE id = ?`, [orgId])?.plan_code ?? "starter",
  );
  const propertyLimit = plan?.limits.properties ?? null;

  return {
    properties: {
      total:
        (counts.draft ?? 0) +
        (counts.in_preparation ?? 0) +
        (counts.ready ?? 0) +
        (counts.published ?? 0),
      inPreparation: counts.in_preparation ?? 0,
      ready: counts.ready ?? 0,
      published: counts.published ?? 0,
      draft: counts.draft ?? 0,
      limit: propertyLimit,
    },
    experiences,
    leads,
    visits,
    analytics,
    jobs: jobStats(orgId),
    recentProperties: listProperties(orgId, { limit: 5 }).items,
    recentActivity: listAudit(orgId, { limit: 8 }),
    priorityLeads: listLeads(orgId, { limit: 5 }).filter((l) => l.status !== "won" && l.status !== "lost"),
    upcomingVisits: upcomingVisits(orgId, 4),
    recentJobs: listJobs(orgId, { limit: 5 }),
  };
}
