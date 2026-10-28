import Link from "next/link";
import type { Metadata } from "next";
import { requireSessionPage } from "@/server/page-auth";
import { analyticsSummary as summary, experienceStats } from "@/server/data/analytics";
import { Eyebrow, Metric, SectionHead } from "@/components/ui/primitives";
import { pct, dateShort } from "@/lib/format";

export const metadata: Metadata = { title: "Analytics" };

const PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const session = await requireSessionPage();
  const params = await searchParams;
  const days = [7, 30, 90].includes(Number(params.days)) ? Number(params.days) : 30;
  const data = summary(session.org.id, days);
  const experiences = experienceStats(session.org.id, days);
  const maxViews = Math.max(1, ...data.daily.map((d) => d.views));
  const demo = Boolean((session.org.settings as Record<string, unknown>).demo);

  return (
    <div className="mx-auto max-w-[1300px] space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Analytics</Eyebrow>
          <h1 className="mt-2 text-[26px] font-light">Eventos reais, não estimativas</h1>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-graphite-dim">
            Métricas calculadas a partir de eventos registados no backend: visualizações de página, cliques em CTA,
            pedidos de contacto e de visita, e mensagens ao assistente.
          </p>
        </div>
        <nav className="flex rounded-full border border-obsidian/15 p-0.5">
          {PERIODS.map((period) => (
            <Link
              key={period.days}
              href={`/app/analytics?days=${period.days}`}
              className={`rounded-full px-3 py-1 text-[11px] transition ${
                days === period.days ? "bg-obsidian text-porcelain" : "text-graphite hover:bg-obsidian/[0.05]"
              }`}
            >
              {period.label}
            </Link>
          ))}
        </nav>
      </header>

      {demo ? (
        <p className="border border-champagne/40 bg-champagne/[0.07] px-4 py-2.5 text-[11px] leading-relaxed text-graphite">
          Esta organização de demonstração contém eventos gerados pelo seed para ilustrar o comportamento do painel.
          Numa organização real, os números refletem apenas tráfego efetivo das páginas publicadas.
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-x-8 md:grid-cols-3 xl:grid-cols-6">
        <Metric label={`Visualizações · ${days}d`} value={data.pageViews} hint="Eventos page_view" />
        <Metric label="Cliques em CTA" value={data.ctaClicks} hint="Pedidos de visita e ações" />
        <Metric label="Leads" value={data.leads} hint="Contactos registados" />
        <Metric label="Pedidos de visita" value={data.visitRequests} hint="Formulário público" />
        <Metric label="Assistente" value={data.assistantMessages} hint="Mensagens respondidas" />
        <Metric
          label="Conversão"
          value={data.conversionRate === null ? "—" : pct(data.conversionRate)}
          hint={data.conversionRate === null ? "Dados insuficientes (mín. 30 vistas e 3 leads)" : "Leads ÷ visualizações"}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionHead eyebrow="Últimos 14 dias" title="Visualizações e contactos" />
          <div className="mt-5 flex h-40 items-end gap-1.5">
            {data.daily.map((day) => (
              <div key={day.date} className="group flex flex-1 flex-col items-center gap-1">
                <div className="relative flex w-full flex-1 items-end">
                  <div
                    className="w-full bg-obsidian/15 transition group-hover:bg-obsidian/30"
                    style={{ height: `${(day.views / maxViews) * 100}%`, minHeight: day.views ? 4 : 0 }}
                    title={`${day.views} visualizações`}
                  />
                  {day.leads ? (
                    <div
                      className="w-full bg-champagne"
                      style={{ height: `${(day.leads / Math.max(1, maxViews)) * 100}%`, minHeight: 3 }}
                      title={`${day.leads} contactos`}
                    />
                  ) : null}
                </div>
                <span className="font-mono text-[8px] text-graphite-dim">{day.date.slice(8)}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-4 text-[10px] text-graphite-dim">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-obsidian/20" /> visualizações</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 bg-champagne" /> contactos</span>
          </div>
          {data.pageViews === 0 ? (
            <p className="mt-4 border border-dashed border-obsidian/15 px-4 py-6 text-center text-[11.5px] text-graphite-dim">
              Sem eventos no período. Publique uma experiência e partilhe o URL para começar a recolher dados.
            </p>
          ) : null}
        </section>

        <section>
          <SectionHead eyebrow="Origem das leads" title="Canais" />
          {data.bySource.length === 0 ? (
            <p className="mt-5 text-[12px] text-graphite-dim">Dados insuficientes — nenhuma lead no período.</p>
          ) : (
            <ul className="mt-4">
              {data.bySource.map((source) => {
                const total = data.bySource.reduce((sum, item) => sum + item.count, 0);
                const share = Math.round((source.count / total) * 100);
                return (
                  <li key={source.source} className="border-b border-obsidian/[0.07] py-2.5">
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="text-graphite">{source.source}</span>
                      <span className="font-mono">{source.count}</span>
                    </div>
                    <div className="mt-1.5 h-[3px] w-full bg-obsidian/10">
                      <div className="h-full bg-champagne" style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section>
        <SectionHead eyebrow="Por imóvel" title="Desempenho das páginas" description="Visualizações, cliques e contactos por imóvel no período selecionado. Conversão por imóvel é apresentada apenas com amostra suficiente." />
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-obsidian/10 text-[9.5px] uppercase tracking-[0.12em] text-graphite-dim">
                <th className="pb-2 font-medium">Imóvel</th>
                <th className="pb-2 text-right font-medium">Vistas</th>
                <th className="pb-2 text-right font-medium">Cliques CTA</th>
                <th className="pb-2 text-right font-medium">Leads</th>
                <th className="pb-2 text-right font-medium">Visitas</th>
                <th className="pb-2 text-right font-medium">Conversão</th>
              </tr>
            </thead>
            <tbody>
              {data.byProperty.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-[11.5px] text-graphite-dim">Sem dados por imóvel no período.</td></tr>
              ) : null}
              {data.byProperty.map((row) => (
                <tr key={row.property_id} className="border-b border-obsidian/[0.07]">
                  <td className="py-2.5 text-[11.5px]">{row.title}</td>
                  <td className="py-2.5 text-right font-mono text-[11px]">{row.views}</td>
                  <td className="py-2.5 text-right font-mono text-[11px]">{row.cta}</td>
                  <td className="py-2.5 text-right font-mono text-[11px]">{row.leads}</td>
                  <td className="py-2.5 text-right font-mono text-[11px]">{row.visits}</td>
                  <td className="py-2.5 text-right font-mono text-[11px]">
                    {row.views >= 30 && row.leads >= 3 ? `${((row.leads / row.views) * 100).toFixed(1)}%` : <span className="font-sans text-[10px] text-graphite-dim">insuficiente</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionHead eyebrow="Experiências" title="Páginas publicadas" />
        {experiences.length === 0 ? (
          <p className="mt-4 text-[12px] text-graphite-dim">Sem experiências criadas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-obsidian/[0.07]">
            {experiences.map((experience) => (
              <li key={experience.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[12px]">{experience.title}</span>
                <span className="font-mono text-[10px] text-graphite-dim">{experience.layout}</span>
                <span className="text-[10px] uppercase tracking-[0.1em] text-graphite-dim">{experience.status}</span>
                <span className="font-mono text-[11px]">{experience.views} vistas</span>
                <span className="font-mono text-[11px] text-graphite-dim">{experience.cta} cliques</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border border-obsidian/10 bg-white p-5">
        <Eyebrow>Definições de métricas</Eyebrow>
        <dl className="mt-3 grid gap-4 text-[11px] leading-relaxed text-graphite-dim sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="font-medium text-graphite">Visualização de página</dt><dd>Um page_view registado quando a página pública é carregada (deduplicado por sessão durante 30 minutos).</dd></div>
          <div><dt className="font-medium text-graphite">Clique em CTA</dt><dd>Interação com botões principais da experiência (visita, contacto, partilha, galeria).</dd></div>
          <div><dt className="font-medium text-graphite">Lead</dt><dd>Pedido de contacto ou de visita submetido com consentimento explícito.</dd></div>
          <div><dt className="font-medium text-graphite">Conversão</dt><dd>Leads ÷ visualizações no período. Só é calculada com pelo menos 30 visualizações e 3 leads.</dd></div>
          <div><dt className="font-medium text-graphite">Pedido de visita</dt><dd>Formulário submetido no modo visita. Não implica confirmação nem reserva.</dd></div>
          <div><dt className="font-medium text-graphite">Período</dt><dd>Janela móvel em dias, com base na data de criação do evento no servidor.</dd></div>
        </dl>
        <p className="mt-3 text-[10px] text-graphite-dim">
          Última atualização dos dados: {dateShort(new Date().toISOString())}. Não são estimados visitantes, taxas ou
          resultados. Sem dados, a interface indica “dados insuficientes”.
        </p>
      </section>
    </div>
  );
}
