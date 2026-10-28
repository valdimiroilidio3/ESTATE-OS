"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Check, Lock, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { useToast, Spinner } from "@/components/ui/client";
import { money } from "@/lib/format";

type Org = {
  id: string;
  name: string;
  plan_code: string;
  branding: Record<string, string>;
  settings: Record<string, unknown>;
};

type Plan = {
  code: string;
  name: string;
  tagline: string;
  price_monthly_cents: number;
  currency: string;
  limits: { properties?: number; ai_jobs_month?: number; seats?: number; experiences?: number };
  features: string[];
};

export function SettingsPanel({
  org,
  plans,
  subscription,
  usage,
  canManage,
  isPlatformAdmin,
}: {
  org: Org;
  plans: Plan[];
  subscription: { plan_code: string; status: string; created_at: string } | null;
  usage: { properties: number; seats: number; jobs: number };
  canManage: boolean;
  isPlatformAdmin: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [tab, setTab] = useState<"org" | "plan" | "privacy" | "security">("org");
  const [pending, setPending] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: org.name,
    agencyName: org.branding.agencyName ?? "",
    tagline: org.branding.tagline ?? "",
    phone: org.branding.phone ?? "",
    email: org.branding.email ?? "",
    website: org.branding.website ?? "",
    retentionMonths: Number(org.settings.retentionMonths ?? 24),
    assistantEnabled: org.settings.assistantEnabled !== false,
    showAssistantTranscripts: org.settings.showAssistantTranscripts !== false,
    dataController: String(org.settings.dataController ?? ""),
  });
  const [planCode, setPlanCode] = useState(org.plan_code);
  const [prices, setPrices] = useState(
    Object.fromEntries(plans.map((plan) => [plan.code, plan.price_monthly_cents])) as Record<string, number>,
  );

  async function saveOrg(message = "Organização atualizada") {
    setPending("org");
    const res = await fetch("/api/org", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        branding: {
          agencyName: form.agencyName,
          tagline: form.tagline,
          phone: form.phone,
          email: form.email,
          website: form.website,
        },
        settings: {
          retentionMonths: form.retentionMonths,
          assistantEnabled: form.assistantEnabled,
          showAssistantTranscripts: form.showAssistantTranscripts,
          dataController: form.dataController,
        },
      }),
    });
    const data = await res.json();
    setPending(null);
    if (!res.ok) {
      push({ kind: "error", title: "Não foi possível guardar", description: data.error });
      return;
    }
    push({ kind: "success", title: message });
    router.refresh();
  }

  async function changePlan() {
    setPending("plan");
    const res = await fetch("/api/org", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan_code: planCode }),
    });
    const data = await res.json();
    setPending(null);
    if (!res.ok) {
      push({ kind: "error", title: "Não foi possível alterar o plano", description: data.error });
      return;
    }
    push({
      kind: "success",
      title: "Plano atualizado",
      description: "Os limites entram em vigor imediatamente. Não existe cobrança automática configurada.",
    });
    router.refresh();
  }

  async function savePrice(code: string) {
    setPending(code);
    const res = await fetch(`/api/plans/${code}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ price_monthly_cents: Math.round(prices[code] * 100) }),
    });
    const data = await res.json();
    setPending(null);
    if (!res.ok) {
      push({ kind: "error", title: "Não foi possível atualizar o preço", description: data.error });
      return;
    }
    push({ kind: "success", title: `Preço de ${code} atualizado` });
    router.refresh();
  }

  const tabs = [
    { id: "org" as const, label: "Organização", icon: SlidersHorizontal },
    { id: "plan" as const, label: "Plano e limites", icon: Check },
    { id: "privacy" as const, label: "Privacidade", icon: ShieldCheck },
    { id: "security" as const, label: "Segurança", icon: Lock },
  ];

  const currentPlan = plans.find((p) => p.code === org.plan_code);

  return (
    <div>
      <nav className="flex flex-wrap gap-1 border-b border-obsidian/10 pb-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={clsx(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] transition",
              tab === item.id ? "bg-obsidian text-porcelain" : "text-graphite hover:bg-obsidian/[0.05]",
            )}
          >
            <item.icon size={12} /> {item.label}
          </button>
        ))}
      </nav>

      {tab === "org" ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <div>
              <label className="field-label" htmlFor="org-name">Nome da organização</label>
              <input id="org-name" className="input-boxed" value={form.name} disabled={!canManage} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="org-brand">Marca apresentada</label>
                <input id="org-brand" className="input-boxed" value={form.agencyName} disabled={!canManage} onChange={(e) => setForm({ ...form, agencyName: e.target.value })} placeholder="Nome na página pública" />
              </div>
              <div>
                <label className="field-label" htmlFor="org-tagline">Assinatura</label>
                <input id="org-tagline" className="input-boxed" value={form.tagline} disabled={!canManage} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
              </div>
              <div>
                <label className="field-label" htmlFor="org-phone">Telefone</label>
                <input id="org-phone" className="input-boxed" value={form.phone} disabled={!canManage} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <label className="field-label" htmlFor="org-email">Email de contacto</label>
                <input id="org-email" type="email" className="input-boxed" value={form.email} disabled={!canManage} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="org-site">Website</label>
                <input id="org-site" className="input-boxed" value={form.website} disabled={!canManage} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://" />
              </div>
            </div>
            {canManage ? (
              <button onClick={() => saveOrg()} disabled={pending === "org"} className="btn btn-sm btn-primary">
                {pending === "org" ? <Spinner /> : null} Guardar alterações
              </button>
            ) : (
              <p className="text-[10.5px] text-graphite-dim">Apenas administradores podem alterar estes dados.</p>
            )}
          </div>
          <aside className="border border-obsidian/10 bg-white p-5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-graphite-dim">Resumo</p>
            <p className="mt-2 text-[14px] font-medium">{form.agencyName || form.name}</p>
            <p className="text-[11.5px] text-graphite-dim">{form.tagline || "Sem assinatura definida"}</p>
            <dl className="mt-4 space-y-1.5 text-[11px]">
              <div className="flex justify-between"><dt className="text-graphite-dim">Plano</dt><dd>{currentPlan?.name ?? org.plan_code}</dd></div>
              <div className="flex justify-between"><dt className="text-graphite-dim">Imóveis</dt><dd className="font-mono">{usage.properties} / {currentPlan?.limits.properties ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-graphite-dim">Membros</dt><dd className="font-mono">{usage.seats} / {currentPlan?.limits.seats ?? "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-graphite-dim">Jobs IA (mês)</dt><dd className="font-mono">{usage.jobs} / {currentPlan?.limits.ai_jobs_month ?? "—"}</dd></div>
            </dl>
            <p className="mt-4 border-t border-obsidian/10 pt-3 text-[10px] leading-relaxed text-graphite-dim">
              Estes dados alimentam a página pública do imóvel: nome da marca, assinatura e contactos aparecem no
              rodapé editorial.
            </p>
          </aside>
        </div>
      ) : null}

      {tab === "plan" ? (
        <div className="mt-6 space-y-6">
          <p className="max-w-2xl text-[12px] leading-relaxed text-graphite-dim">
            Os limites são aplicados no backend. Não existe integração de pagamento configurada: a alteração de plano
            ajusta quotas e permissões, mas não cria uma subscrição ativa nem cobrança.
          </p>
          {subscription ? (
            <p className="border border-obsidian/10 bg-white px-4 py-3 text-[11.5px]">
              Subscrição registada: <strong className="font-medium">{subscription.plan_code}</strong> · estado{" "}
              <span className={subscription.status === "active" ? "text-forest" : "text-champagne-deep"}>{subscription.status}</span>
              {subscription.status !== "active" ? " — aguarda confirmação do sistema de pagamento." : null}
            </p>
          ) : (
            <p className="border border-obsidian/10 bg-white px-4 py-3 text-[11.5px] text-graphite-dim">
              Nenhuma subscrição registada. O plano em uso é uma quota de trabalho, não uma subscrição paga.
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-3">
            {plans.map((plan) => (
              <button
                key={plan.code}
                onClick={() => canManage && setPlanCode(plan.code)}
                className={clsx(
                  "border p-4 text-left transition",
                  planCode === plan.code ? "border-obsidian bg-white" : "border-obsidian/15 hover:border-obsidian/40",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium">{plan.name}</p>
                  {plan.code === org.plan_code ? <span className="text-[9px] uppercase tracking-[0.1em] text-forest">atual</span> : null}
                </div>
                <p className="mt-1 text-[10.5px] leading-relaxed text-graphite-dim">{plan.tagline}</p>
                <p className="mt-3 text-[18px] font-light">{money(plan.price_monthly_cents, plan.currency)}<span className="text-[10px] text-graphite-dim">/mês</span></p>
                <ul className="mt-3 space-y-1 text-[10.5px] text-graphite">
                  <li>{plan.limits.properties} imóveis</li>
                  <li>{plan.limits.experiences} experiências</li>
                  <li>{plan.limits.ai_jobs_month} jobs IA / mês</li>
                  <li>{plan.limits.seats} lugares</li>
                </ul>
              </button>
            ))}
          </div>
          {canManage ? (
            <button onClick={changePlan} disabled={pending === "plan" || planCode === org.plan_code} className="btn btn-sm btn-primary">
              {pending === "plan" ? <Spinner /> : null} Aplicar plano {plans.find((p) => p.code === planCode)?.name}
            </button>
          ) : null}

          {isPlatformAdmin ? (
            <section className="border-t border-obsidian/10 pt-5">
              <p className="text-[10px] uppercase tracking-[0.12em] text-graphite-dim">Administração da plataforma · preços</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {plans.map((plan) => (
                  <div key={plan.code}>
                    <label className="field-label" htmlFor={`price-${plan.code}`}>{plan.name} (€/mês)</label>
                    <div className="flex gap-2">
                      <input
                        id={`price-${plan.code}`}
                        type="number"
                        min={0}
                        className="input-boxed"
                        value={prices[plan.code] / 100}
                        onChange={(e) => setPrices({ ...prices, [plan.code]: Math.round(Number(e.target.value) * 100) })}
                      />
                      <button onClick={() => savePrice(plan.code)} disabled={pending === plan.code} className="btn btn-sm btn-outline shrink-0">
                        Guardar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-graphite-dim">
                Alterações de preço refletem-se nos planos públicos e ficam registadas no audit log.
              </p>
            </section>
          ) : null}
        </div>
      ) : null}

      {tab === "privacy" ? (
        <div className="mt-6 max-w-2xl space-y-4">
          <div>
            <label className="field-label" htmlFor="retention">Retenção de dados (meses)</label>
            <input
              id="retention"
              type="number"
              min={1}
              max={120}
              className="input-boxed max-w-[140px]"
              value={form.retentionMonths}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, retentionMonths: Number(e.target.value) })}
            />
            <p className="field-hint">Política declarada para dados de leads e conversas. A purga automática não está agendada nesta instância.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="controller">Responsável pelo tratamento</label>
            <input
              id="controller"
              className="input-boxed"
              value={form.dataController}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, dataController: e.target.value })}
              placeholder="Nome da empresa e contacto do DPO"
            />
          </div>
          <label className="flex items-start gap-2 text-[11.5px] leading-relaxed">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.assistantEnabled}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, assistantEnabled: e.target.checked })}
            />
            <span>Ativar o assistente de imóvel nas páginas públicas. Responde apenas com factos aprovados.</span>
          </label>
          <label className="flex items-start gap-2 text-[11.5px] leading-relaxed">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={form.showAssistantTranscripts}
              disabled={!canManage}
              onChange={(e) => setForm({ ...form, showAssistantTranscripts: e.target.checked })}
            />
            <span>Permitir que administradores revejam transcrições de conversas.</span>
          </label>
          {canManage ? (
            <button onClick={() => saveOrg("Definições de privacidade guardadas")} disabled={pending === "org"} className="btn btn-sm btn-primary">
              {pending === "org" ? <Spinner /> : null} Guardar
            </button>
          ) : null}
          <p className="border-t border-obsidian/10 pt-3 text-[10.5px] leading-relaxed text-graphite-dim">
            Pedidos de acesso, correção ou eliminação são registados em Privacidade e ficam no audit log. O
            cumprimento do RGPD exige tratamento manual destes pedidos nesta versão.
          </p>
        </div>
      ) : null}

      {tab === "security" ? (
        <div className="mt-6 space-y-4 text-[12px] leading-relaxed text-graphite">
          <h3 className="text-[13px] font-medium">Isolamento e acesso</h3>
          <ul className="space-y-2 text-[11.5px] text-graphite-dim">
            <li>• Todas as consultas filtram por <code className="font-mono text-[10.5px]">org_id</code> a partir da sessão; nenhum ID chega sem verificação de pertença.</li>
            <li>• Funções <span className="font-medium text-graphite">owner/admin/agent/viewer</span> são verificadas no backend, não apenas na interface.</li>
            <li>• Endpoints públicos têm limite de pedidos por IP e por página (contacto, assistente, tracking).</li>
            <li>• Sessões guardam apenas o hash do token; cookies são httpOnly, sameSite=lax.</li>
            <li>• Documentos confidenciais não têm URL pública; são servidos por rota autenticada.</li>
          </ul>
          <h3 className="pt-2 text-[13px] font-medium">Chaves e integrações</h3>
          <p className="text-[11.5px] leading-relaxed text-graphite-dim">
            As chaves de IA são lidas de variáveis de ambiente no servidor e nunca expostas ao cliente. Sem chave
            configurada, o sistema funciona em modo demonstrativo identificado e não simula respostas de modelo.
          </p>
        </div>
      ) : null}
    </div>
  );
}
