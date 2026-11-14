import { one, run, uid, now, many, type Row } from "./db";
import { redact } from "./security";
import type { AuditEntry } from "@/lib/types";

export async function logAudit(input: {
  orgId: string;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}) {
  await run(
    `INSERT INTO audit_logs (id, org_id, actor_id, action, entity, entity_id, meta, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      input.orgId,
      input.actorId ?? null,
      input.action,
      input.entity,
      input.entityId ?? null,
      JSON.stringify(redact(input.meta ?? {})),
      input.ip ?? null,
      now(),
    ],
  );
}

/**
 * Records an access-control decision or authentication result.
 *
 * Unlike `logAudit` this is allowed to fail silently: a database hiccup must
 * never turn a blocked request into a 500, and security logging must never
 * become a denial-of-service vector of its own.
 */
export async function logSecurityEvent(input: {
  orgId?: string | null;
  actorId?: string | null;
  action: string;
  outcome: "allowed" | "denied" | "failed";
  route?: string | null;
  ip?: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  try {
    await run(
      `INSERT INTO security_events (id, org_id, actor_id, action, outcome, route, ip, meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uid(),
        input.orgId ?? null,
        input.actorId ?? null,
        input.action,
        input.outcome,
        input.route?.slice(0, 200) ?? null,
        input.ip?.slice(0, 60) ?? null,
        JSON.stringify(redact(input.meta ?? {})),
        now(),
      ],
    );
  } catch (error) {
    console.error("[security] não foi possível registar o evento:", (error as Error).message);
  }
}

export async function listAudit(orgId: string, opts: { limit?: number; entity?: string; entityId?: string } = {}) {
  const limit = opts.limit ?? 40;
  const where = ["a.org_id = ?"];
  const params: unknown[] = [orgId];
  if (opts.entity) {
    where.push("a.entity = ?");
    params.push(opts.entity);
  }
  if (opts.entityId) {
    where.push("a.entity_id = ?");
    params.push(opts.entityId);
  }
  const rows = await many<Row>(
    `SELECT a.*, p.full_name AS actor_name FROM audit_logs a
     LEFT JOIN profiles p ON p.id = a.actor_id
     WHERE ${where.join(" AND ")} ORDER BY a.created_at DESC LIMIT ?`,
    [...params, limit],
  );
  return rows.map<AuditEntry>((r) => ({
    id: r.id,
    actor_name: r.actor_name,
    action: r.action,
    entity: r.entity,
    entity_id: r.entity_id,
    meta: safe(r.meta),
    created_at: r.created_at,
  }));
}

function safe(v: unknown) {
  try {
    return typeof v === "string" ? JSON.parse(v) : {};
  } catch {
    return {};
  }
}

export async function auditCount(orgId: string) {
  return (await one<{ c: number }>(`SELECT count(*) AS c FROM audit_logs WHERE org_id = ?`, [orgId]))?.c ?? 0;
}
