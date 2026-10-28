import { orgSettingsSchema } from "@/lib/schemas";
import { authed, json, readJson, forbidden } from "@/server/http";
import { updateOrg } from "@/server/data/team";
import { getSubscription } from "@/server/plans";
import { roles } from "@/server/auth";
import { logAudit } from "@/server/audit";
import { run, uid, now } from "@/server/db";

export const runtime = "nodejs";

export const PATCH = authed(async (req, { session }) => {
  if (!roles.canManageOrg(session.role)) throw forbidden("Apenas administradores podem alterar a organização.");
  const input = await readJson(req, orgSettingsSchema);
  if (input.plan_code && input.plan_code !== session.org.plan_code) {
    const existing = getSubscription(session.org.id);
    if (existing) {
      run(`UPDATE subscriptions SET plan_code = ? WHERE id = ?`, [input.plan_code, existing.id]);
    } else {
      run(`INSERT INTO subscriptions (id, org_id, plan_code, status, created_at) VALUES (?,?,?,?,?)`, [
        uid(),
        session.org.id,
        input.plan_code,
        "unconfigured",
        now(),
      ]);
    }
    logAudit({
      orgId: session.org.id,
      actorId: session.profile.id,
      action: "org.plan_changed",
      entity: "organization",
      entityId: session.org.id,
      meta: { from: session.org.plan_code, to: input.plan_code, billing: "not_configured" },
    });
  }
  updateOrg(session.org.id, {
    name: input.name,
    plan_code: input.plan_code,
    branding: input.branding,
    settings: input.settings,
  });
  logAudit({
    orgId: session.org.id,
    actorId: session.profile.id,
    action: "org.updated",
    entity: "organization",
    entityId: session.org.id,
  });
  return json({ ok: true });
});
