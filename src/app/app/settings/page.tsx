import Link from "next/link";
import type { Metadata } from "next";
import { requireSessionPage } from "@/server/page-auth";
import { getPlans, getSubscription, getPlan } from "@/server/plans";
import { many, one, type Row } from "@/server/db";
import { SettingsPanel } from "@/components/app/settings-panel";
import { Eyebrow, SectionHead } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireSessionPage();
  const plans = getPlans(true);
  const subscription = getSubscription(session.org.id);
  const plan = getPlan(session.org.plan_code);
  const isPlatformAdmin = Boolean(one<Row>(`SELECT is_platform_admin FROM profiles WHERE id = ?`, [session.profile.id])?.is_platform_admin);
  const canManage = session.role === "owner" || session.role === "admin";

  const usage = {
    properties: Number(one<Row>(`SELECT COUNT(*) AS n FROM properties WHERE org_id = ?`, [session.org.id])?.n ?? 0),
    seats: Number(one<Row>(`SELECT COUNT(*) AS n FROM organization_members WHERE org_id = ?`, [session.org.id])?.n ?? 0),
    jobs: Number(
      one<Row>(`SELECT COUNT(*) AS n FROM ai_jobs WHERE org_id = ? AND created_at >= ?`, [
        session.org.id,
        new Date(Date.now() - 30 * 86400_000).toISOString(),
      ])?.n ?? 0,
    ),
  };

  const requests = many<Row>(`SELECT * FROM privacy_requests WHERE org_id = ? ORDER BY created_at DESC LIMIT 20`, [session.org.id]);
  const audit = canManage
    ? many<Row>(
        `SELECT a.*, p.full_name AS actor_name FROM audit_logs a LEFT JOIN profiles p ON p.id = a.actor_id
         WHERE a.org_id = ? ORDER BY a.created_at DESC LIMIT 30`,
        [session.org.id],
      )
    : [];

  return (
    <div className="mx-auto max-w-[1150px] space-y-8">
      <header>
        <Eyebrow>Settings</Eyebrow>
        <h1 className="mt-2 text-[26px] font-light">Configuração</h1>
        <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-graphite-dim">
          Identidade da organização, plano e quotas, privacidade e segurança. Alterações ficam registadas no audit
          log.
        </p>
      </header>

      <SettingsPanel
        org={{
          id: session.org.id,
          name: session.org.name,
          plan_code: session.org.plan_code,
          branding: (session.org.branding ?? {}) as Record<string, string>,
          settings: (session.org.settings ?? {}) as Record<string, unknown>,
        }}
        plans={plans.map((p) => ({
          code: p.code,
          name: p.name,
          tagline: p.tagline ?? "",
          price_monthly_cents: p.price_monthly_cents,
          currency: p.currency,
          limits: p.limits,
          features: p.features,
        }))}
        subscription={subscription ? { plan_code: subscription.plan_code, status: subscription.status, created_at: String((subscription as { created_at?: string }).created_at ?? "") } : null}
        usage={usage}
        canManage={canManage}
        isPlatformAdmin={isPlatformAdmin}
      />

      <section>
        <SectionHead eyebrow="RGPD" title="Pedidos de privacidade" description="Registo de pedidos de acesso, correção ou eliminação. Tratamento manual." />
        {requests.length === 0 ? (
          <p className="mt-3 text-[11.5px] text-graphite-dim">Sem pedidos registados.</p>
        ) : (
          <ul className="mt-3 divide-y divide-obsidian/[0.07]">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-3 py-2.5 text-[11.5px]">
                <span className="min-w-0 flex-1 truncate">{request.email}</span>
                <span className="text-[10px] uppercase tracking-[0.1em] text-graphite-dim">{request.kind}</span>
                <span className="rounded-full bg-champagne/20 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-champagne-deep">{request.status}</span>
                <span className="text-[10px] text-graphite-dim">{relativeTime(request.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canManage ? (
        <section>
          <SectionHead eyebrow="Audit log" title="Últimas ações" description="Registo interno de alterações relevantes na organização." />
          {audit.length === 0 ? (
            <p className="mt-3 text-[11.5px] text-graphite-dim">Sem registos.</p>
          ) : (
            <ul className="mt-3 divide-y divide-obsidian/[0.07]">
              {audit.map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-3 py-2 text-[11px]">
                  <span className="font-mono text-[10px] text-graphite-dim">{entry.action}</span>
                  <span className="min-w-0 flex-1 truncate text-graphite">{entry.entity}{entry.entity_id ? ` · ${String(entry.entity_id).slice(0, 8)}` : ""}</span>
                  <span className="text-[10px] text-graphite-dim">{entry.actor_name ?? "sistema"}</span>
                  <span className="text-[10px] text-graphite-dim">{relativeTime(entry.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <footer className="flex flex-wrap gap-4 border-t border-obsidian/10 pt-4 text-[10.5px] text-graphite-dim">
        <Link href="/legal/privacidade" className="underline decoration-obsidian/20 underline-offset-2">Política de privacidade</Link>
        <Link href="/legal/termos" className="underline decoration-obsidian/20 underline-offset-2">Termos</Link>
        <span>Plano em uso: {plan?.name ?? session.org.plan_code}</span>
      </footer>
    </div>
  );
}
