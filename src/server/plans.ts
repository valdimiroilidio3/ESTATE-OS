import { many, one, run, type Row, parseJson } from "./db";
import type { Plan } from "@/lib/types";
import { ApiError } from "./http";

export const DEFAULT_PLANS: Omit<Plan, "sort">[] = [
  {
    code: "starter",
    name: "Starter",
    tagline: "Para consultores que começam a estruturar a sua apresentação.",
    price_monthly_cents: 4900,
    currency: "EUR",
    limits: { properties: 25, ai_jobs_month: 150, seats: 1, experiences: 25 },
    features: [
      "Gestão de imóveis",
      "Geração básica de conteúdo",
      "Páginas públicas",
      "Recolha de contactos",
    ],
    is_public: 1,
  },
  {
    code: "pro",
    name: "Pro",
    tagline: "Produção multilingue e operação comercial completa.",
    price_monthly_cents: 12900,
    currency: "EUR",
    limits: { properties: 150, ai_jobs_month: 1200, seats: 5, experiences: 150 },
    features: [
      "Tudo do Starter",
      "Produção multilingue",
      "AI Studio avançado",
      "CRM e pipeline",
      "Analytics",
      "Personalização das experiências",
    ],
    is_public: 1,
  },
  {
    code: "agency",
    name: "Agency",
    tagline: "Equipas, permissões e produção à escala da agência.",
    price_monthly_cents: 29900,
    currency: "EUR",
    limits: { properties: 1000, ai_jobs_month: 6000, seats: 30, experiences: 1000 },
    features: [
      "Tudo do Pro",
      "Equipa e permissões",
      "Gestão de múltiplos consultores",
      "Mais capacidade de produção",
      "Branding configurável",
      "Relatórios agregados",
    ],
    is_public: 1,
  },
];

export function ensurePlans() {
  DEFAULT_PLANS.forEach((plan, index) => {
    run(
      `INSERT INTO plans (code, name, tagline, price_monthly_cents, currency, limits, features, is_public, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(code) DO NOTHING`,
      [
        plan.code,
        plan.name,
        plan.tagline,
        plan.price_monthly_cents,
        plan.currency,
        JSON.stringify(plan.limits),
        JSON.stringify(plan.features),
        plan.is_public,
        index,
      ],
    );
  });
}

export function getPlans(includeHidden = false): Plan[] {
  ensurePlans();
  const rows = many<Row>(
    `SELECT * FROM plans ${includeHidden ? "" : "WHERE is_public = 1"} ORDER BY sort, price_monthly_cents`,
  );
  return rows.map((r) => ({
    code: r.code,
    name: r.name,
    tagline: r.tagline,
    price_monthly_cents: r.price_monthly_cents,
    currency: r.currency,
    limits: parseJson(r.limits, {}),
    features: parseJson(r.features, []),
    is_public: r.is_public,
    sort: r.sort,
  }));
}

export function getPlan(code: string): Plan | null {
  ensurePlans();
  const row = one<Row>(`SELECT * FROM plans WHERE code = ?`, [code]);
  if (!row) return null;
  return {
    code: row.code,
    name: row.name,
    tagline: row.tagline,
    price_monthly_cents: row.price_monthly_cents,
    currency: row.currency,
    limits: parseJson(row.limits, {}),
    features: parseJson(row.features, []),
    is_public: row.is_public,
    sort: row.sort,
  };
}

export function updatePlan(code: string, patch: Partial<Pick<Plan, "price_monthly_cents" | "limits" | "features" | "tagline" | "is_public">>) {
  const existing = getPlan(code);
  if (!existing) throw new ApiError("Plano inexistente.", 404, "not_found");
  run(
    `UPDATE plans SET price_monthly_cents = ?, limits = ?, features = ?, tagline = ?, is_public = ?, updated_at = datetime('now')
     WHERE code = ?`,
    [
      patch.price_monthly_cents ?? existing.price_monthly_cents,
      JSON.stringify(patch.limits ?? existing.limits),
      JSON.stringify(patch.features ?? existing.features),
      patch.tagline ?? existing.tagline,
      patch.is_public ?? existing.is_public,
      code,
    ],
  );
}

export function getSubscription(orgId: string) {
  const row = one<Row>(`SELECT * FROM subscriptions WHERE org_id = ? ORDER BY created_at DESC LIMIT 1`, [orgId]);
  if (!row) return null;
  return {
    id: row.id,
    plan_code: row.plan_code,
    status: row.status,
    provider: row.provider,
    external_id: row.external_id,
    current_period_end: row.current_period_end,
  };
}

export function checkQuota(orgId: string, planCode: string, kind: "properties" | "ai_jobs_month" | "seats") {
  const plan = getPlan(planCode);
  if (!plan) return;
  const limit = plan.limits[kind];
  if (typeof limit !== "number") return;
  let used = 0;
  if (kind === "properties") {
    used =
      one<{ c: number }>(
        `SELECT count(*) AS c FROM properties WHERE org_id = ? AND status != 'archived'`,
        [orgId],
      )?.c ?? 0;
  }
  if (kind === "seats") {
    used =
      one<{ c: number }>(`SELECT count(*) AS c FROM organization_members WHERE org_id = ?`, [orgId])?.c ?? 0;
  }
  if (kind === "ai_jobs_month") {
    used =
      one<{ c: number }>(
        `SELECT count(*) AS c FROM ai_jobs WHERE org_id = ? AND created_at >= datetime('now','-30 day')`,
        [orgId],
      )?.c ?? 0;
  }
  if (used >= limit) {
    throw new ApiError(
      `Limite do plano ${plan.name} atingido (${limit} ${kind.replace("_", " ")}). Ajuste o plano nas definições.`,
      402,
      "quota_exceeded",
      { kind, limit, used },
    );
  }
}
