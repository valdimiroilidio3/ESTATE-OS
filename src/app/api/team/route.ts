import { authed, json } from "@/server/http";
import { listInvitations, listMembers } from "@/server/data/team";
import { getPlan, getSubscription , thirtyDaysAgo } from "@/server/plans";
import { one, type Row } from "@/server/db";

export const runtime = "nodejs";

export const GET = authed(async (_req, { session }) => {
  const plan = await getPlan(session.org.plan_code);
  const usage = {
    properties:
      (await one<{ c: number }>(`SELECT count(*) AS c FROM properties WHERE org_id = ? AND status != 'archived'`, [
        session.org.id,
      ]))?.c ?? 0,
    seats:
      (await one<{ c: number }>(`SELECT count(*) AS c FROM organization_members WHERE org_id = ?`, [session.org.id]))?.c ?? 0,
    aiJobs:
      (await one<{ c: number }>(
        `SELECT count(*) AS c FROM ai_jobs WHERE org_id = ? AND created_at >= ?`,
        [session.org.id, thirtyDaysAgo()],
      ))?.c ?? 0,
  };
  return json({
    members: await listMembers(session.org.id),
    invitations: await listInvitations(session.org.id),
    plan,
    subscription: await getSubscription(session.org.id),
    usage,
    currentProfileId: session.profile.id,
  });
});
