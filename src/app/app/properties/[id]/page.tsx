import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Eye,
  FileText,
  Images,
  Sparkles,
  Users,
  CalendarDays,
  History,
  Info,
} from "lucide-react";
import { requireSessionPage } from "@/server/page-auth";
import { getPropertyBundle } from "@/server/data/properties";
import { mediaUrl } from "@/server/data/media";
import { listAudit } from "@/server/audit";
import { listJobs } from "@/server/jobs";
import { providerInfo } from "@/server/ai/provider";
import { listConversations } from "@/server/data/conversations";
import { PROPERTY_STATUS, PROPERTY_TYPE_LABELS, LEAD_STATUS, VISIT_STATUS, LAYOUTS } from "@/lib/labels";
import { money, areaLabel, dateShort, relativeTime, dateTime } from "@/lib/format";
import { Eyebrow, KeyValue, Progress, StatusPill, SectionHead } from "@/components/ui/primitives";
import { PropertyEditor } from "@/components/app/property-editor";
import { MediaManager } from "@/components/app/media-manager";
import { ContentStudio } from "@/components/app/content-studio";
import { ExperiencePanel } from "@/components/app/experience-panel";
import { DocumentsPanel } from "@/components/app/documents-panel";
import { DeletePropertyButton } from "@/components/app/delete-property-button";

export const metadata: Metadata = { title: "Imóvel" };

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "specifications", label: "Specifications" },
  { id: "media", label: "Media" },
  { id: "ai", label: "AI Content" },
  { id: "experience", label: "Experience" },
  { id: "leads", label: "Leads" },
  { id: "visits", label: "Visits" },
  { id: "documents", label: "Documents" },
  { id: "activity", label: "Activity" },
];

export default async function PropertyProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await requireSessionPage();
  const { id } = await params;
  const { tab = "overview" } = await searchParams;
  const bundle = getPropertyBundle(session.org.id, id);
  if (!bundle) notFound();

  const { property, media, content, experience, leads, visits, documents, completion } = bundle;
  const jobs = listJobs(session.org.id, { propertyId: id, limit: 30 });
  const provider = providerInfo();
  const audit = listAudit(session.org.id, { entityId: id, limit: 30 });
  const conversations = listConversations(session.org.id, id);
  const readOnly = session.role === "viewer";
  const cover = media.find((m) => m.is_primary) ?? media[0];
  const approvedPhotos = media.filter((m) => m.status === "approved").length;
  const publishedContent = content.filter((c) => c.status === "approved");
  const activeTab = TABS.some((t) => t.id === tab) ? tab : "overview";

  const timeline = [
    { at: property.created_at, label: "Imóvel criado", detail: property.reference, kind: "property" },
    ...media.slice(0, 4).map((m) => ({
      at: m.created_at,
      label: "Ficheiro carregado",
      detail: `${m.file_name}${m.room ? ` · ${m.room}` : ""}`,
      kind: "media",
    })),
    ...content
      .filter((c) => c.approved_at)
      .map((c) => ({
        at: c.approved_at as string,
        label: "Conteúdo aprovado",
        detail: `${c.kind} · ${c.locale.toUpperCase()}`,
        kind: "content",
      })),
    ...(experience?.published_at
      ? [{ at: experience.published_at, label: "Experiência publicada", detail: `/p/${experience.slug}`, kind: "experience" }]
      : []),
    ...leads.map((l) => ({ at: l.created_at, label: "Lead recebida", detail: `${l.name} · ${l.source}`, kind: "lead" })),
    ...visits.map((v) => ({
      at: v.created_at,
      label: "Visita registada",
      detail: `${v.status} · ${v.lead_name ?? "sem lead"}`,
      kind: "visit",
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const ageDays = Math.floor((Date.now() - new Date(property.updated_at).getTime()) / 86400000);

  return (
    <div className="mx-auto max-w-[1320px]">
      <nav className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.12em] text-graphite-dim">
        <Link href="/app/properties" className="hover:text-obsidian">Properties</Link>
        <span>/</span>
        <span className="text-graphite">{property.reference}</span>
      </nav>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-6 border-b border-obsidian/10 pb-6">
        <div className="flex min-w-0 items-start gap-4">
          <div className="relative hidden h-24 w-32 shrink-0 overflow-hidden bg-stone-soft sm:block">
            {cover ? <Image src={mediaUrl(cover)} alt="" fill sizes="128px" className="object-cover" /> : null}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill {...PROPERTY_STATUS[property.status]} />
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-dim">{property.reference}</span>
              <span className="text-[10.5px] text-graphite-dim">
                {PROPERTY_TYPE_LABELS[property.property_type]} · {property.operation === "sale" ? "venda" : "arrendamento"}
              </span>
            </div>
            <h1 className="mt-2 text-[26px] font-light leading-tight">{property.title}</h1>
            <p className="mt-1 text-[12.5px] text-graphite-dim">
              {[property.location, property.city, property.country].filter(Boolean).join(", ") || "Localização por definir"}
              {property.specs?.usable_area_m2 ? ` · ${areaLabel(property.specs.usable_area_m2)}` : ""}
              {property.specs?.bedrooms !== null && property.specs?.bedrooms !== undefined ? ` · T${property.specs.bedrooms}` : ""}
            </p>
            <p className="mt-2 font-mono text-[15px]">{money(property.price_cents, property.currency)}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap justify-end gap-2">
            <Link href={`/app/ai-studio/${property.id}`} className="btn btn-sm btn-primary">
              <Sparkles size={13} /> AI Studio
            </Link>
            <Link
              href={experience ? `/app/experiences/${experience.id}` : `/app/experiences/new?propertyId=${property.id}`}
              className="btn btn-sm btn-outline"
            >
              <Eye size={13} /> {experience ? "Builder" : "Criar experiência"}
            </Link>
            {experience?.status === "published" ? (
              <a href={`/p/${experience.slug}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">
                Ver página <ArrowUpRight size={12} />
              </a>
            ) : null}
          </div>
          <p className="text-[10px] text-graphite-dim">
            Atualizado {relativeTime(property.updated_at)}
            {ageDays > 30 ? " · dados antigos" : ""}
          </p>
          {!readOnly ? <DeletePropertyButton propertyId={property.id} title={property.title} /> : null}
        </div>
      </header>

      <nav className="no-scrollbar -mx-4 mt-4 flex gap-1 overflow-x-auto border-b border-obsidian/10 px-4 sm:mx-0 sm:px-0">
        {TABS.map((item) => (
          <Link
            key={item.id}
            href={`/app/properties/${property.id}?tab=${item.id}`}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-[11.5px] transition ${
              activeTab === item.id ? "border-obsidian text-obsidian" : "border-transparent text-graphite-dim hover:text-obsidian"
            }`}
          >
            {item.label}
            {item.id === "leads" && leads.length ? ` (${leads.length})` : ""}
            {item.id === "media" && media.length ? ` (${media.length})` : ""}
          </Link>
        ))}
      </nav>

      <div className="py-7">
        {activeTab === "overview" ? (
          <div className="grid gap-8 lg:grid-cols-[1.55fr_1fr]">
            <div className="space-y-8">
              {cover ? (
                <div className="relative aspect-[16/10] overflow-hidden bg-stone-soft">
                  <Image src={mediaUrl(cover)} alt="" fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
                </div>
              ) : null}
              <div>
                <Eyebrow>Resumo comercial</Eyebrow>
                <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-graphite">
                  {property.summary ??
                    "Sem resumo interno. O resumo comercial pode ser gerado no AI Studio a partir dos dados confirmados."}
                </p>
              </div>
              <div className="grid gap-x-10 sm:grid-cols-2">
                <dl>
                  <KeyValue label="Área útil" value={areaLabel(property.specs?.usable_area_m2 ?? null) ?? "—"} />
                  <KeyValue label="Terreno" value={areaLabel(property.specs?.plot_area_m2 ?? null) ?? "—"} />
                  <KeyValue label="Quartos" value={property.specs?.bedrooms ?? "—"} />
                  <KeyValue label="Casas de banho" value={property.specs?.bathrooms ?? "—"} />
                  <KeyValue label="Estacionamento" value={property.specs?.parking ?? "—"} />
                </dl>
                <dl>
                  <KeyValue label="Certificado" value={property.specs?.energy_rating ?? "Não disponível"} />
                  <KeyValue label="Ano" value={property.specs?.year_built ?? "—"} />
                  <KeyValue label="Estado" value={property.specs?.condition ?? "—"} />
                  <KeyValue label="Tipologia" value={property.specs?.typology ?? "—"} />
                  <KeyValue
                    label="Morada"
                    value={property.address_line ? (property.address_private ? "Privada" : property.address_line) : "—"}
                  />
                </dl>
              </div>
            </div>

            <div className="space-y-5">
              <div className="border border-obsidian/10 bg-white p-5">
                <div className="flex items-center justify-between">
                  <Eyebrow>Completude do imóvel</Eyebrow>
                  <span className="font-mono text-[13px]">{completion.score}%</span>
                </div>
                <div className="mt-3"><Progress value={completion.score} /></div>
                <p className="mt-2 text-[10.5px] leading-relaxed text-graphite-dim">
                  Completude de dados para produção — não é uma medida de qualidade comercial.
                </p>
                <ul className="mt-4 space-y-2">
                  {completion.missing.length === 0 ? (
                    <li className="flex items-center gap-2 text-[11.5px] text-forest">
                      <CheckCircle2 size={13} /> Todos os campos necessários estão presentes.
                    </li>
                  ) : (
                    completion.missing.map((item) => (
                      <li key={item.key} className="flex items-start gap-2 text-[11.5px] text-graphite">
                        <Circle size={9} className="mt-1.5 shrink-0 text-champagne-deep" />
                        {item.label}
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-px border border-obsidian/10 bg-obsidian/10">
                {[
                  { icon: Images, label: "Ficheiros", value: media.length, href: `/app/properties/${id}?tab=media` },
                  { icon: FileText, label: "Aprovados", value: publishedContent.length, href: `/app/properties/${id}?tab=ai` },
                  { icon: Users, label: "Leads", value: leads.length, href: `/app/properties/${id}?tab=leads` },
                  { icon: CalendarDays, label: "Visitas", value: visits.length, href: `/app/properties/${id}?tab=visits` },
                ].map((item) => (
                  <Link key={item.label} href={item.href} className="bg-white p-4 transition hover:bg-porcelain">
                    <item.icon size={14} className="text-graphite-dim" />
                    <p className="mt-3 font-mono text-[18px]">{item.value}</p>
                    <p className="text-[10px] uppercase tracking-[0.1em] text-graphite-dim">{item.label}</p>
                  </Link>
                ))}
              </div>

              <div className="border border-obsidian/10 bg-obsidian p-5 text-porcelain">
                <Eyebrow tone="light">Experiência</Eyebrow>
                {experience ? (
                  <>
                    <p className="mt-2 text-[12.5px]">
                      {LAYOUTS[experience.layout]?.label} · {experience.status === "published" ? "publicada" : "rascunho"}
                    </p>
                    <p className="mt-1 truncate font-mono text-[10.5px] text-porcelain/50">/p/{experience.slug}</p>
                    <div className="mt-3 flex gap-2">
                      <Link href={`/app/experiences/${experience.id}`} className="btn btn-sm btn-outline-light">Abrir builder</Link>
                      {experience.status === "published" ? (
                        <a href={`/p/${experience.slug}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost text-porcelain/70">Ver</a>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-[11.5px] leading-relaxed text-porcelain/60">
                      Sem experiência criada. A página pública só existe depois de a criar e publicar.
                    </p>
                    <Link href={`/app/experiences/new?propertyId=${property.id}`} className="btn btn-sm btn-outline-light mt-3">
                      Criar experiência
                    </Link>
                  </>
                )}
              </div>

              <div className="border border-obsidian/10 bg-white p-5">
                <Eyebrow>Assistente público</Eyebrow>
                <p className="mt-2 text-[11.5px] leading-relaxed text-graphite-dim">
                  {conversations.length
                    ? `${conversations.length} conversa(s) registada(s). ${conversations.filter((c) => c.review_status === "unreviewed").length} por rever.`
                    : "Sem conversas. As respostas usam apenas dados aprovados e citam a fonte."}
                </p>
                <Link href={`/app/ai-studio/${property.id}?tab=assistant`} className="btn btn-sm btn-outline mt-3">
                  <Info size={12} /> Rever assistente
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "specifications" ? (
          <div className="max-w-3xl">
            <SectionHead
              eyebrow="Dados técnicos"
              title="Especificações do imóvel"
              description="Alterações são validadas no servidor. Campos vazios não são inventados nem preenchidos com valores por omissão na página pública."
            />
            <div className="mt-6"><PropertyEditor property={property} readOnly={readOnly} /></div>
          </div>
        ) : null}

        {activeTab === "media" ? (
          <div>
            <SectionHead
              eyebrow="Media"
              title="Fotografias e ficheiros"
              description="Uma imagem só é pública depois de aprovada e marcada para publicação. A imagem principal é usada no hero."
            />
            <div className="mt-6"><MediaManager propertyId={property.id} initialMedia={media} readOnly={readOnly} /></div>
          </div>
        ) : null}

        {activeTab === "ai" ? (
          <div>
            <SectionHead
              eyebrow="AI Property Studio"
              title="Conteúdo comercial"
              description="Cada módulo é uma tarefa independente. O conteúdo gerado entra em rascunho e exige aprovação antes de ser publicado."
              action={<Link href={`/app/ai-studio/${property.id}`} className="btn btn-sm btn-outline">Abrir studio completo <ArrowUpRight size={12} /></Link>}
            />
            <div className="mt-6">
              <ContentStudio
                propertyId={property.id}
                initialContent={content}
                initialJobs={jobs as never}
                provider={provider}
                readOnly={readOnly}
              />
            </div>
          </div>
        ) : null}

        {activeTab === "experience" ? (
          <div>
            <SectionHead
              eyebrow="Property experience"
              title="Página pública"
              description="Direcção editorial, contactos e publicação. O builder permite pré-visualizar desktop e mobile antes de publicar."
            />
            <div className="mt-6"><ExperiencePanel propertyId={property.id} experience={experience} readOnly={readOnly} /></div>
          </div>
        ) : null}

        {activeTab === "leads" ? (
          <div>
            <SectionHead
              eyebrow="CRM"
              title="Leads deste imóvel"
              action={<Link href={`/app/leads?propertyId=${property.id}`} className="btn btn-sm btn-outline">Abrir CRM</Link>}
            />
            {leads.length === 0 ? (
              <p className="mt-5 text-[12.5px] text-graphite-dim">
                Sem leads associadas. Os pedidos de contacto e de visita da página pública aparecem aqui, com origem
                e consentimentos registados.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-obsidian/[0.08]">
                {leads.map((lead) => (
                  <li key={lead.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium">{lead.name}</p>
                      <p className="text-[10.5px] text-graphite-dim">
                        {lead.email} {lead.phone ? `· ${lead.phone}` : ""} · {lead.source}
                      </p>
                    </div>
                    <StatusPill {...LEAD_STATUS[lead.status]} />
                    <span className="text-[10px] text-graphite-dim">{relativeTime(lead.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {activeTab === "visits" ? (
          <div>
            <SectionHead eyebrow="Commercial follow-up" title="Visitas" action={<Link href="/app/visits" className="btn btn-sm btn-outline">Calendário</Link>} />
            {visits.length === 0 ? (
              <p className="mt-5 text-[12.5px] text-graphite-dim">Sem visitas registadas para este imóvel.</p>
            ) : (
              <ul className="mt-4 divide-y divide-obsidian/[0.08]">
                {visits.map((visit) => (
                  <li key={visit.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-medium">
                        {visit.scheduled_at ? dateTime(visit.scheduled_at) : "Sem data confirmada"}
                      </p>
                      <p className="text-[10.5px] text-graphite-dim">
                        {visit.lead_name ?? "Sem lead"} · {visit.agent_name ?? "Sem consultor"}
                      </p>
                    </div>
                    <StatusPill {...VISIT_STATUS[visit.status]} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {activeTab === "documents" ? (
          <div className="max-w-3xl">
            <SectionHead
              eyebrow="Documentos"
              title="Documentos e plantas"
              description="Permissões de acesso por documento. Documentos privados nunca são servidos em páginas públicas."
            />
            <div className="mt-6">
              <DocumentsPanel propertyId={property.id} initialDocuments={documents as never} readOnly={readOnly} />
            </div>
          </div>
        ) : null}

        {activeTab === "activity" ? (
          <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <SectionHead
                eyebrow="Property twin"
                title="Ciclo comercial e histórico"
                description="Cada elemento tem origem, data e autor. O histórico é registado no backend."
              />
              <ol className="mt-5 space-y-0 border-l border-obsidian/15 pl-5">
                {timeline.map((item, index) => (
                  <li key={`${item.kind}-${index}`} className="relative pb-5">
                    <span className="absolute -left-[23px] top-1.5 h-1.5 w-1.5 rounded-full bg-obsidian/40" />
                    <p className="text-[12px] font-medium">{item.label}</p>
                    <p className="text-[10.5px] text-graphite-dim">{item.detail}</p>
                    <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-graphite-dim/70">
                      {dateShort(item.at)} · {new Date(item.at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <SectionHead eyebrow="Auditoria" title="Ações registadas" />
              {audit.length === 0 ? (
                <p className="mt-4 text-[12px] text-graphite-dim">
                  Sem ações registadas para este imóvel. Criação, aprovações, publicação e alterações ficam
                  registadas com autor e data.
                </p>
              ) : (
                <ul className="mt-4 divide-y divide-obsidian/[0.07]">
                  {audit.map((entry) => (
                    <li key={entry.id} className="py-2.5">
                      <p className="text-[11.5px]">
                        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-graphite-dim">{entry.action}</span>
                      </p>
                      <p className="text-[10.5px] text-graphite-dim">
                        {entry.actor_name ?? "Sistema"} · {relativeTime(entry.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-6 border border-obsidian/10 bg-white p-4">
                <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.1em] text-graphite-dim">
                  <History size={11} /> Proveniência
                </p>
                <ul className="mt-2 space-y-1.5 text-[11px] text-graphite">
                  <li>Ficha do imóvel — registada por {session.profile.full_name}</li>
                  <li>{approvedPhotos} ficheiros aprovados de {media.length}</li>
                  <li>{publishedContent.length} conteúdos aprovados de {content.length}</li>
                  <li>Última atualização {dateShort(property.updated_at)}</li>
                </ul>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
