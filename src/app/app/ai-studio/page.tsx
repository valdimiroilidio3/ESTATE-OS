import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight, Sparkles } from "lucide-react";
import { requireSessionPage } from "@/server/page-auth";
import { listProperties } from "@/server/data/properties";
import { listJobs, jobStats, TASK_TYPES } from "@/server/jobs";
import { providerInfo } from "@/server/ai/provider";
import { listMedia, mediaUrl } from "@/server/data/media";
import { many, type Row } from "@/server/db";
import { Eyebrow, SectionHead, StatusPill, Progress } from "@/components/ui/primitives";
import { JOB_STATUS, TASK_LABELS } from "@/lib/labels";
import { relativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "AI Studio" };

export default async function AiStudioPage() {
  const session = await requireSessionPage();
  const provider = providerInfo();
  const properties = listProperties(session.org.id, { limit: 60 }).items;
  const stats = jobStats(session.org.id);
  const jobs = listJobs(session.org.id, { limit: 12 });
  const media = listMedia(session.org.id, { limit: 200 });
  const contentCounts = many<Row>(
    `SELECT property_id, count(*) AS total, sum(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved
     FROM property_content WHERE org_id = ? GROUP BY property_id`,
    [session.org.id],
  );
  const countFor = (id: string) => contentCounts.find((c) => c.property_id === id);

  return (
    <div className="mx-auto max-w-[1320px] space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>AI Property Studio</Eyebrow>
          <h1 className="mt-2 text-[26px] font-light">Produção comercial assistida</h1>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-graphite-dim">
            Uma linha de produção por imóvel: listagem, versões multilingues, audiências, campanha, briefing
            audiovisual e preparação da experiência. Cada tarefa tem estado, tentativas e resultado.
          </p>
        </div>
        <div className="flex gap-6 border border-obsidian/10 bg-white px-4 py-3">
          {(
            [
              ["Em fila", stats.queued],
              ["Revisão", stats.needs_review],
              ["Falhas", stats.failed],
            ] as const
          ).map(([label, value]) => (
            <div key={label}>
              <p className="font-mono text-[18px] leading-none">{value}</p>
              <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-graphite-dim">{label}</p>
            </div>
          ))}
        </div>
      </header>

      <div className="flex flex-wrap items-start justify-between gap-4 border border-obsidian/10 bg-white px-4 py-3">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-graphite">
          <Sparkles size={13} className="mt-0.5 shrink-0 text-champagne-deep" />
          <span>
            <strong className="font-medium">{provider.label}</strong>
            {provider.model ? ` · ${provider.model}` : ""} — {provider.note}
          </span>
        </p>
        <Link href="/app/settings#ai" className="text-[10.5px] uppercase tracking-[0.1em] text-graphite-dim hover:text-obsidian">
          Configurar fornecedor
        </Link>
      </div>

      <section>
        <SectionHead
          eyebrow="Imóveis"
          title="Escolher imóvel"
          description="O studio trabalha sempre sobre um imóvel concreto. Nenhum conteúdo é gerado sem ficha associada."
        />
        {properties.length === 0 ? (
          <p className="mt-5 text-[12.5px] text-graphite-dim">
            Sem imóveis. Crie o primeiro para iniciar a produção.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {properties.map((property) => {
              const cover = media.find((m) => m.property_id === property.id && (m.is_primary || m.status === "approved"));
              const counts = countFor(property.id);
              return (
                <li key={property.id} className="border border-obsidian/10 bg-white">
                  <Link href={`/app/ai-studio/${property.id}`} className="group block">
                    <div className="relative aspect-[16/9] overflow-hidden bg-stone-soft">
                      {cover ? (
                        <Image src={mediaUrl(cover)} alt="" fill sizes="33vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.12em] text-graphite-dim">
                          Sem imagem
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[13px] font-medium">{property.title}</p>
                        <ArrowRight size={13} className="mt-0.5 shrink-0 text-graphite-dim transition group-hover:translate-x-0.5" />
                      </div>
                      <p className="mt-0.5 text-[10.5px] text-graphite-dim">
                        {counts ? `${counts.approved ?? 0} aprovados de ${counts.total} gerados` : "Sem conteúdo gerado"}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <Progress value={property.completion} />
                        <span className="font-mono text-[9.5px] text-graphite-dim">{property.completion}%</span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <SectionHead eyebrow="Fila global" title="Tarefas recentes" />
        {jobs.length === 0 ? (
          <p className="mt-4 text-[12.5px] text-graphite-dim">Sem tarefas registadas nesta organização.</p>
        ) : (
          <ul className="mt-2 divide-y divide-obsidian/[0.08]">
            {jobs.map((job) => (
              <li key={job.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${JOB_STATUS[job.status]?.dot}`} />
                <span className="min-w-0 flex-1 truncate text-[12px]">
                  {TASK_LABELS[job.task_type] ?? job.task_type}
                  <span className="text-graphite-dim"> · {(job as { property_title?: string }).property_title ?? "—"}</span>
                </span>
                <StatusPill label={JOB_STATUS[job.status]?.label ?? job.status} tone="bg-obsidian/[0.06] text-graphite" />
                <span className="text-[10px] text-graphite-dim">{relativeTime(job.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border border-obsidian/10 bg-obsidian p-6 text-porcelain">
        <Eyebrow tone="light">Catálogo de tarefas</Eyebrow>
        <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(TASK_TYPES).map(([key, value]) => (
            <div key={key}>
              <p className="text-[12px] text-porcelain">{value.label}</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-porcelain/50">{value.description}</p>
              <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-champagne/70">
                {value.needsReview ? "requer revisão" : "automática"}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
