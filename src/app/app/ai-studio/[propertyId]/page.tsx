import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AlertTriangle, ArrowUpRight, Info, ShieldCheck } from "lucide-react";
import { requireSessionPage } from "@/server/page-auth";
import { getPropertyBundle } from "@/server/data/properties";
import { listJobs } from "@/server/jobs";
import { providerInfo } from "@/server/ai/provider";
import { verificationReport } from "@/server/ai/studio";
import { listConversations, assistantQuality } from "@/server/data/conversations";
import { one, parseJson, type Row } from "@/server/db";
import { Eyebrow, SectionHead, KeyValue } from "@/components/ui/primitives";
import { ContentStudio } from "@/components/app/content-studio";
import { AssistantReview } from "@/components/app/assistant-review";

export const metadata: Metadata = { title: "AI Studio" };

const TABS = [
  { id: "studio", label: "Studio" },
  { id: "verification", label: "Verificação de dados" },
  { id: "image", label: "Imagem" },
  { id: "assistant", label: "Assistente" },
];

export default async function StudioPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSessionPage();
  const { propertyId } = await params;
  const { tab = "studio" } = await searchParams;
  const bundle = getPropertyBundle(session.org.id, propertyId);
  if (!bundle) notFound();
  const jobs = listJobs(session.org.id, { propertyId, limit: 30 });
  const provider = providerInfo();
  const report = verificationReport(session.org.id, propertyId);
  const conversations = listConversations(session.org.id, propertyId);
  const quality = assistantQuality(session.org.id, propertyId);
  const settings = parseJson<{ showAssistantTranscripts?: boolean }>(
    one<Row>(`SELECT settings FROM organizations WHERE id = ?`, [session.org.id])?.settings,
    {},
  );
  const readOnly = session.role === "viewer";
  const activeTab = TABS.some((t) => t.id === tab) ? tab : "studio";

  return (
    <div className="mx-auto max-w-[1240px]">
      <nav className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.12em] text-graphite-dim">
        <Link href="/app/ai-studio" className="hover:text-obsidian">AI Studio</Link>
        <span>/</span>
        <span className="text-graphite">{bundle.property.reference}</span>
      </nav>

      <header className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-obsidian/10 pb-5">
        <div>
          <Eyebrow>AI Studio</Eyebrow>
          <h1 className="mt-2 text-[24px] font-light">{bundle.property.title}</h1>
          <p className="mt-1 text-[11.5px] text-graphite-dim">
            {bundle.content.length} conteúdos · {bundle.property.reference} · completude {bundle.completion.score}%
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/app/properties/${propertyId}`} className="btn btn-sm btn-outline">Ficha do imóvel</Link>
          {bundle.experience ? (
            <Link href={`/app/experiences/${bundle.experience.id}`} className="btn btn-sm btn-ghost">
              Experiência <ArrowUpRight size={12} />
            </Link>
          ) : null}
        </div>
      </header>

      <nav className="mt-3 flex gap-1 border-b border-obsidian/10">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/app/ai-studio/${propertyId}?tab=${item.id}`}
            className={`border-b-2 px-3 py-2.5 text-[11.5px] transition ${
              activeTab === item.id ? "border-obsidian text-obsidian" : "border-transparent text-graphite-dim hover:text-obsidian"
            }`}
          >
            {item.label}
            {item.id === "assistant" && conversations.length ? ` (${conversations.length})` : ""}
          </Link>
        ))}
      </nav>

      <div className="py-7">
        {activeTab === "studio" ? (
          <ContentStudio
            propertyId={propertyId}
            initialContent={bundle.content}
            initialJobs={jobs as never}
            provider={provider}
            readOnly={readOnly}
          />
        ) : null}

        {activeTab === "verification" ? (
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-8">
              <section>
                <SectionHead
                  eyebrow="Verificação assistida"
                  title="Observações sobre os dados"
                  description="Erros bloqueantes impedem uma apresentação correta; avisos indicam informação em falta. Nenhuma sugestão é aplicada automaticamente."
                />
                {report.issues.length === 0 ? (
                  <p className="mt-4 flex items-center gap-2 text-[12px] text-forest">
                    <ShieldCheck size={13} /> Sem observações. Os campos necessários estão presentes.
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-obsidian/[0.08]">
                    {report.issues.map((issue, index) => (
                      <li key={index} className="flex items-start gap-3 py-3">
                        {issue.level === "error" ? (
                          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-800" />
                        ) : issue.level === "warning" ? (
                          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-champagne-deep" />
                        ) : (
                          <Info size={14} className="mt-0.5 shrink-0 text-graphite-dim" />
                        )}
                        <div className="flex-1">
                          <p className="text-[12.5px] text-graphite">{issue.message}</p>
                          <p className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-graphite-dim">
                            {issue.level} · {issue.field} · {issue.source}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <SectionHead
                  eyebrow="Factos e proveniência"
                  title="Base de conhecimento do imóvel"
                  description="Cada facto indica a origem. O assistente e o gerador usam apenas esta base."
                />
                <ul className="mt-4 divide-y divide-obsidian/[0.07]">
                  {report.facts.map((fact, index) => (
                    <li key={index} className="flex items-baseline justify-between gap-4 py-2">
                      <span className="text-[11.5px] text-graphite">{fact.label}</span>
                      <span className="flex items-baseline gap-3 text-right">
                        <span className="text-[12px] font-medium">{fact.value}</span>
                        <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-graphite-dim">{fact.source}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="space-y-6">
              <div className="border border-obsidian/10 bg-white p-5">
                <Eyebrow>FAQ fundamentada</Eyebrow>
                <ul className="mt-3 space-y-3">
                  {report.faq.map((item, index) => (
                    <li key={index} className="border-b border-obsidian/[0.07] pb-2 last:border-0">
                      <p className="text-[11.5px] font-medium">{item.q}</p>
                      <p className={`mt-0.5 text-[11px] leading-relaxed ${item.known ? "text-graphite" : "text-graphite-dim"}`}>
                        {item.a}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="border border-obsidian/10 bg-white p-5">
                <Eyebrow>Fotografia aprovada</Eyebrow>
                <p className="mt-2 font-mono text-[24px]">{report.approvedPhotos}</p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-graphite-dim">
                  A página pública exige pelo menos uma imagem aprovada. Ficheiros pendentes nunca são expostos.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "image" ? (
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <section>
              <SectionHead
                eyebrow="E · Image enhancement"
                title="Melhoria de imagem, com rótulo"
                description="A plataforma está preparada para serviços de melhoria de imagem, mas nenhuma imagem é alterada nesta instância. Sem fornecedor configurado, a operação fica indisponível — não é simulado um resultado."
              />
              <div className="mt-4 border border-champagne/40 bg-champagne/[0.07] px-4 py-3">
                <p className="text-[11.5px] font-medium text-graphite">Serviço de melhoria não configurado</p>
                <p className="mt-1 text-[11px] leading-relaxed text-graphite">
                  Configure um fornecedor compatível no servidor para ativar esta operação. Qualquer imagem
                  resultante seria apresentada como <strong className="font-medium">ilustrativa</strong>, nunca como
                  fotografia documental do imóvel.
                </p>
              </div>
              {bundle.media.filter((item) => item.kind === "photo").length === 0 ? (
                <p className="mt-4 text-[12px] text-graphite-dim">Sem fotografias carregadas para este imóvel.</p>
              ) : (
                <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {bundle.media
                    .filter((item) => item.kind === "photo")
                    .map((item) => (
                      <li key={item.id} className="border border-obsidian/10 bg-white">
                        <div className="relative aspect-[4/3] bg-stone-soft">
                          <Image
                            src={item.public_path || `/api/media/${item.id}/file`}
                            alt={item.caption ?? item.file_name}
                            fill
                            sizes="(max-width: 640px) 50vw, 30vw"
                            className="object-cover"
                          />
                          <span className="absolute left-2 top-2 rounded-full bg-obsidian/70 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em] text-porcelain">
                            original
                          </span>
                        </div>
                        <div className="p-2">
                          <p className="truncate text-[10.5px]">{item.caption ?? item.file_name}</p>
                          <button
                            type="button"
                            disabled
                            className="mt-1 w-full border border-obsidian/15 px-2 py-1 text-[9.5px] uppercase tracking-[0.1em] text-graphite-dim opacity-70"
                            title="Indisponível sem fornecedor configurado"
                          >
                            Melhorar (indisponível)
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
            </section>
            <aside className="space-y-4">
              <div className="border border-obsidian/10 bg-white p-5">
                <Eyebrow>Regras aplicadas</Eyebrow>
                <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-graphite">
                  <li>• Nunca alterar geometria, proporções ou materiais visíveis.</li>
                  <li>• Nenhuma vista simulada, nenhum céu substituído apresentado como real.</li>
                  <li>• Versão original preservada e sempre acessível.</li>
                  <li>• Rótulo “imagem ilustrativa” visível na página pública e nos materiais.</li>
                  <li>• Aprovação humana antes de qualquer utilização comercial.</li>
                </ul>
              </div>
              <div className="border border-obsidian/10 bg-white p-5">
                <Eyebrow>Estado do sistema</Eyebrow>
                <dl className="mt-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-graphite-dim">Fornecedor de imagem</dt>
                    <dd>não configurado</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-graphite-dim">Imagens alteradas</dt>
                    <dd>0</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-graphite-dim">Motor de texto</dt>
                    <dd>{provider.label}</dd>
                  </div>
                </dl>
              </div>
            </aside>
          </div>
        ) : null}

        {activeTab === "assistant" ? (
          <div className="space-y-6">
            <SectionHead
              eyebrow="AI Property Assistant"
              title="Conversas e qualidade"
              description="Respostas fundamentadas em dados aprovados. Questões jurídicas, financeiras e técnicas são encaminhadas para o consultor."
            />
            <AssistantReview
              initialConversations={conversations as never}
              quality={quality}
              transcriptsEnabled={settings.showAssistantTranscripts !== false}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
