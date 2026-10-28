import Link from "next/link";
import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Plus, Sparkles } from "lucide-react";
import { requireSessionPage } from "@/server/page-auth";
import { overview } from "@/server/data/dashboard";
import { Metric, SectionHead, StatusPill, Eyebrow, Progress, EmptyState } from "@/components/ui/primitives";
import { PROPERTY_STATUS, LEAD_STATUS, JOB_STATUS, VISIT_STATUS, TASK_LABELS } from "@/lib/labels";
import { money, relativeTime, dateTime, pct } from "@/lib/format";
import { mediaUrl } from "@/server/data/media";
import { listMedia } from "@/server/data/media";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const session = await requireSessionPage();
  const data = overview(session.org.id);
  const covers = listMedia(session.org.id, { kind: "photo", limit: 40 });
  const coverFor = (propertyId: string) =>
    covers.find((m) => m.property_id === propertyId && m.is_primary) ??
    covers.find((m) => m.property_id === propertyId);

  return (
    <div className="mx-auto max-w-[1280px] space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Overview · {new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "long", year: "numeric" }).format(new Date())}</Eyebrow>
          <h1 className="mt-2 text-[26px] font-light leading-tight">
            Bom dia, {session.profile.full_name.split(" ")[0]}.
          </h1>
          <p className="mt-1.5 text-[12.5px] text-graphite-dim">
            {data.properties.total === 0
              ? "Ainda não existem imóveis. Introduza o primeiro para iniciar a produção."
              : `${data.properties.total} imóveis na organização · ${data.experiences.published} experiências publicadas`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/properties/new" className="btn btn-sm btn-primary">
            <Plus size={13} /> Adicionar imóvel
          </Link>
          <Link href="/app/ai-studio" className="btn btn-sm btn-outline">
            <Sparkles size={13} /> AI Studio
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-x-8 gap-y-0 md:grid-cols-3 xl:grid-cols-6">
        <Metric label="Imóveis" value={data.properties.total} hint={data.properties.limit ? `Limite do plano: ${data.properties.limit}` : undefined} href="/app/properties" />
        <Metric label="Em preparação" value={data.properties.inPreparation} hint="Produção ou revisão em curso" href="/app/properties?status=in_preparation" />
        <Metric label="Experiências" value={data.experiences.published} hint={`${data.experiences.draft} em rascunho`} href="/app/experiences" />
        <Metric label="Leads" value={data.leads.total} hint={`${data.leads.byStatus.new ?? 0} novas por contactar`} href="/app/leads" />
        <Metric label="Visitas" value={data.visits.upcoming} hint={`${data.visits.requested} por confirmar`} href="/app/visits" />
        <Metric
          label="Conversão · 30 dias"
          value={data.analytics.conversionRate === null ? "—" : pct(data.analytics.conversionRate)}
          hint={data.analytics.conversionRate === null ? "Dados insuficientes para calcular" : "Leads / visualizações de página"}
          href="/app/analytics"
        />
      </section>

      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-10">
          <section>
            <SectionHead
              eyebrow="Trabalho recente"
              title="Imóveis editados recentemente"
              action={
                <Link href="/app/properties" className="link-underline">
                  Ver todos <ArrowRight size={12} />
                </Link>
              }
            />
            {data.recentProperties.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  title="Sem imóveis registados"
                  description="Crie o primeiro imóvel para gerar descrição, página pública e materiais de campanha."
                  action={
                    <Link href="/app/properties/new" className="btn btn-sm btn-primary">
                      <Plus size={13} /> Criar imóvel
                    </Link>
                  }
                />
              </div>
            ) : (
              <ul className="mt-2 divide-y divide-obsidian/[0.08]">
                {data.recentProperties.map((property) => {
                  const cover = coverFor(property.id);
                  return (
                    <li key={property.id}>
                      <Link
                        href={`/app/properties/${property.id}`}
                        className="group flex items-center gap-4 py-3.5 transition hover:bg-white/50"
                      >
                        <span className="relative h-14 w-20 shrink-0 overflow-hidden bg-stone-soft">
                          {cover ? (
                            <Image
                              src={mediaUrl(cover)}
                              alt=""
                              fill
                              sizes="80px"
                              className="object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <span className="flex h-full items-center justify-center text-[9px] uppercase tracking-[0.12em] text-graphite-dim">
                              Sem imagem
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-[13.5px] font-medium">{property.title}</span>
                            <StatusPill {...PROPERTY_STATUS[property.status]} />
                          </span>
                          <span className="mt-1 block truncate text-[11.5px] text-graphite-dim">
                            {property.reference} · {[property.city, property.country].filter(Boolean).join(", ") || "Localização por definir"} ·{" "}
                            {money(property.price_cents, property.currency)}
                          </span>
                        </span>
                        <span className="hidden w-28 shrink-0 sm:block">
                          <span className="flex items-center justify-between text-[10px] text-graphite-dim">
                            <span>Completude</span>
                            <span className="font-mono">{property.completion}%</span>
                          </span>
                          <span className="mt-1.5 block">
                            <Progress value={property.completion} />
                          </span>
                        </span>
                        <span className="hidden text-[10.5px] text-graphite-dim md:block">{relativeTime(property.updated_at)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <SectionHead eyebrow="Auditoria" title="Atividade recente" />
            {data.recentActivity.length === 0 ? (
              <p className="mt-5 text-[12.5px] text-graphite-dim">
                Sem atividade registada. As ações relevantes — criação, aprovação, publicação e alterações — são
                registadas aqui com autor e data.
              </p>
            ) : (
              <ul className="mt-3 space-y-0">
                {data.recentActivity.map((entry) => (
                  <li key={entry.id} className="flex items-baseline gap-3 border-b border-obsidian/[0.07] py-2.5 last:border-0">
                    <span className="w-20 shrink-0 font-mono text-[9.5px] uppercase tracking-[0.08em] text-graphite-dim">
                      {entry.action.split(".").slice(-1)[0]}
                    </span>
                    <span className="flex-1 text-[12px] text-graphite">
                      {String(entry.meta.note ?? `${entry.entity} · ${entry.action}`)}
                    </span>
                    <span className="hidden text-[10px] text-graphite-dim sm:block">{entry.actor_name ?? "Sistema"}</span>
                    <span className="text-[10px] text-graphite-dim">{relativeTime(entry.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section className="border border-obsidian/10 bg-white p-5">
            <div className="flex items-center justify-between">
              <Eyebrow>Leads prioritárias</Eyebrow>
              <Link href="/app/leads" aria-label="Abrir leads" className="text-graphite-dim transition hover:text-obsidian">
                <ArrowUpRight size={14} />
              </Link>
            </div>
            {data.priorityLeads.length === 0 ? (
              <p className="mt-4 text-[12px] leading-relaxed text-graphite-dim">
                Sem leads ativas. Os pedidos de contacto e de visita aparecem aqui com origem e estado.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-obsidian/[0.07]">
                {data.priorityLeads.map((lead) => (
                  <li key={lead.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12.5px] font-medium">{lead.name}</p>
                      <StatusPill {...LEAD_STATUS[lead.status]} />
                    </div>
                    <p className="mt-0.5 truncate text-[10.5px] text-graphite-dim">
                      {lead.property_title ?? "Sem imóvel associado"} · {relativeTime(lead.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border border-obsidian/10 bg-white p-5">
            <div className="flex items-center justify-between">
              <Eyebrow>Próximas visitas</Eyebrow>
              <Link href="/app/visits" aria-label="Abrir visitas" className="text-graphite-dim transition hover:text-obsidian">
                <ArrowUpRight size={14} />
              </Link>
            </div>
            {data.upcomingVisits.length === 0 ? (
              <p className="mt-4 text-[12px] leading-relaxed text-graphite-dim">
                Sem visitas agendadas. Um pedido submetido na página pública entra como “solicitada”.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-obsidian/[0.07]">
                {data.upcomingVisits.map((visit) => (
                  <li key={visit.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12.5px] font-medium">{visit.property_title}</p>
                      <StatusPill {...VISIT_STATUS[visit.status]} />
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-graphite-dim">
                      {visit.scheduled_at ? dateTime(visit.scheduled_at) : "Sem data definida"} · {visit.lead_name ?? "Sem lead"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border border-obsidian/10 bg-obsidian p-5 text-porcelain">
            <div className="flex items-center justify-between">
              <Eyebrow tone="light">Tarefas de produção</Eyebrow>
              <Link href="/app/ai-studio" className="text-porcelain/50 transition hover:text-porcelain" aria-label="Abrir AI Studio">
                <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 border-b border-porcelain/15 pb-4">
              {(
                [
                  ["Em fila", data.jobs.queued],
                  ["Revisão", data.jobs.needs_review],
                  ["Falhas", data.jobs.failed],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <p className="font-mono text-[20px] leading-none text-porcelain">{value}</p>
                  <p className="mt-1 text-[9.5px] uppercase tracking-[0.12em] text-porcelain/50">{label}</p>
                </div>
              ))}
            </div>
            {data.recentJobs.length === 0 ? (
              <p className="mt-4 text-[11.5px] leading-relaxed text-porcelain/60">
                Nenhuma tarefa registada. Cada geração é uma tarefa independente com estado, tentativas e resultado.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {data.recentJobs.slice(0, 4).map((job) => (
                  <li key={job.id} className="flex items-start gap-2.5">
                    <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${JOB_STATUS[job.status]?.dot ?? "bg-porcelain/40"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] text-porcelain/90">
                        {TASK_LABELS[job.task_type] ?? job.task_type}
                      </p>
                      <p className="truncate text-[10px] text-porcelain/45">
                        {(job as { property_title?: string }).property_title ?? "—"} · {JOB_STATUS[job.status]?.label}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
