import { many, one, run, uid, now, type Row } from "../db";
import { ApiError } from "../http";
import type { Visit } from "@/lib/types";

export function listVisits(orgId: string, opts: { from?: string; to?: string; status?: string; propertyId?: string } = {}) {
  const where = ["v.org_id = ?"];
  const params: unknown[] = [orgId];
  if (opts.from) {
    where.push("v.scheduled_at >= ?");
    params.push(opts.from);
  }
  if (opts.to) {
    where.push("v.scheduled_at <= ?");
    params.push(opts.to);
  }
  if (opts.status && opts.status !== "all") {
    where.push("v.status = ?");
    params.push(opts.status);
  }
  if (opts.propertyId) {
    where.push("v.property_id = ?");
    params.push(opts.propertyId);
  }
  return many<Row>(
    `SELECT v.*, p.title AS property_title, p.reference AS property_reference,
            l.name AS lead_name, l.email AS lead_email, pr.full_name AS agent_name
     FROM visits v JOIN properties p ON p.id = v.property_id
     LEFT JOIN leads l ON l.id = v.lead_id LEFT JOIN profiles pr ON pr.id = v.agent_id
     WHERE ${where.join(" AND ")} ORDER BY v.scheduled_at IS NULL, v.scheduled_at ASC LIMIT 300`,
    params,
  ) as Visit[];
}

export function getVisit(orgId: string, id: string) {
  return one<Row>(
    `SELECT v.*, p.title AS property_title, l.name AS lead_name, pr.full_name AS agent_name
     FROM visits v JOIN properties p ON p.id = v.property_id
     LEFT JOIN leads l ON l.id = v.lead_id LEFT JOIN profiles pr ON pr.id = v.agent_id
     WHERE v.id = ? AND v.org_id = ?`,
    [id, orgId],
  ) as Visit | undefined;
}

export function createVisit(
  orgId: string,
  input: {
    property_id: string;
    lead_id?: string | null;
    agent_id?: string | null;
    scheduled_at?: string | null;
    timezone?: string;
    status?: Visit["status"];
    notes?: string | null;
  },
) {
  const property = one<Row>(`SELECT id FROM properties WHERE id = ? AND org_id = ?`, [input.property_id, orgId]);
  if (!property) throw new ApiError("Imóvel inexistente.", 404, "not_found");
  if (input.lead_id) {
    const lead = one<Row>(`SELECT id FROM leads WHERE id = ? AND org_id = ?`, [input.lead_id, orgId]);
    if (!lead) throw new ApiError("Lead inexistente.", 404, "not_found");
  }
  const id = uid();
  run(
    `INSERT INTO visits (id, org_id, property_id, lead_id, agent_id, scheduled_at, timezone, status, notes, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      orgId,
      input.property_id,
      input.lead_id ?? null,
      input.agent_id ?? null,
      input.scheduled_at ?? null,
      input.timezone ?? "Europe/Lisbon",
      input.status ?? "requested",
      input.notes ?? null,
      now(),
      now(),
    ],
  );
  if (input.lead_id && input.status && input.status !== "requested") {
    run(`UPDATE leads SET status = 'visit_scheduled', updated_at = ? WHERE id = ? AND org_id = ?`, [
      now(),
      input.lead_id,
      orgId,
    ]);
  }
  return getVisit(orgId, id)!;
}

export function updateVisit(
  orgId: string,
  id: string,
  patch: Partial<{
    status: Visit["status"];
    scheduled_at: string | null;
    timezone: string;
    agent_id: string | null;
    notes: string | null;
    outcome: string | null;
    lead_id: string | null;
  }>,
) {
  const visit = getVisit(orgId, id);
  if (!visit) throw new ApiError("Visita inexistente.", 404, "not_found");
  if (patch.status === "confirmed" && !visit.scheduled_at && !patch.scheduled_at) {
    throw new ApiError(
      "Não é possível confirmar uma visita sem data e hora acordadas.",
      409,
      "missing_schedule",
    );
  }
  if (patch.scheduled_at === "") {
    throw new ApiError("Data inválida.", 422, "invalid_date");
  }
  const set: Record<string, unknown> = {};
  (["status", "scheduled_at", "timezone", "agent_id", "notes", "outcome", "lead_id"] as const).forEach((key) => {
    if (patch[key] !== undefined) set[key] = patch[key];
  });
  if (!Object.keys(set).length) return visit;
  set.updated_at = now();
  const keys = Object.keys(set);
  run(
    `UPDATE visits SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ? AND org_id = ?`,
    [...keys.map((k) => set[k]), id, orgId],
  );
  if (visit.lead_id && (patch.status === "confirmed" || patch.status === "completed")) {
    run(`UPDATE leads SET status = 'visit_scheduled', updated_at = ? WHERE id = ? AND org_id = ? AND status IN ('new','contacted','qualified')`, [
      now(),
      visit.lead_id,
      orgId,
    ]);
  }
  return getVisit(orgId, id)!;
}

export function upcomingVisits(orgId: string, limit = 5) {
  return many<Row>(
    `SELECT v.*, p.title AS property_title, l.name AS lead_name, pr.full_name AS agent_name
     FROM visits v JOIN properties p ON p.id = v.property_id
     LEFT JOIN leads l ON l.id = v.lead_id LEFT JOIN profiles pr ON pr.id = v.agent_id
     WHERE v.org_id = ? AND v.status IN ('requested','confirmed','rescheduled')
       AND (v.scheduled_at IS NULL OR v.scheduled_at >= datetime('now','-1 day'))
     ORDER BY v.scheduled_at IS NULL, v.scheduled_at ASC LIMIT ?`,
    [orgId, limit],
  ) as Visit[];
}
