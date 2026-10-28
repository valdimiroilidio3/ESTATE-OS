import { one, run, uid, now, many, type Row } from "./db";
import type { AuditEntry } from "@/lib/types";

export function logAudit(input: {
  orgId: string;
  actorId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}) {
  run(
    `INSERT INTO audit_logs (id, org_id, actor_id, action, entity, entity_id, meta, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid(),
      input.orgId,
      input.actorId ?? null,
      input.action,
      input.entity,
      input.entityId ?? null,
      JSON.stringify(input.meta ?? {}),
      input.ip ?? null,
      now(),
    ],
  );
}

export function listAudit(orgId: string, opts: { limit?: number; entity?: string; entityId?: string } = {}) {
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
  const rows = many<Row>(
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

export function auditCount(orgId: string) {
  return one<{ c: number }>(`SELECT count(*) AS c FROM audit_logs WHERE org_id = ?`, [orgId])?.c ?? 0;
}
