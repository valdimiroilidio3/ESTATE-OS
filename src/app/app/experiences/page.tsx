import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight, Globe2, Plus } from "lucide-react";
import { requireSessionPage } from "@/server/page-auth";
import { listExperiences } from "@/server/data/experiences";
import { listProperties } from "@/server/data/properties";
import { mediaUrl } from "@/server/data/media";
import { Eyebrow, SectionHead, StatusPill, EmptyState } from "@/components/ui/primitives";
import { EXPERIENCE_STATUS, LAYOUTS } from "@/lib/labels";
import { relativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Experiences" };

export default async function ExperiencesPage() {
  const session = await requireSessionPage();
  const experiences = listExperiences(session.org.id);
  const properties = listProperties(session.org.id, { limit: 100 }).items;
  const withoutExperience = properties.filter((p) => !experiences.some((e) => e.property_id === p.id));

  return (
    <div className="mx-auto max-w-[1320px] space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Property experience</Eyebrow>
          <h1 className="mt-2 text-[26px] font-light">Experiências publicadas</h1>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-graphite-dim">
            Cada experiência é uma página exclusiva com URL estável. Três direcções editoriais alteram o layout, não
            apenas as cores.
          </p>
        </div>
        <Link href="/app/experiences/new" className="btn btn-sm btn-primary">
          <Plus size={13} /> Nova experiência
        </Link>
      </header>

      {experiences.length === 0 ? (
        <EmptyState
          title="Sem experiências"
          description="Crie a primeira página pública a partir de um imóvel com fotografias aprovadas. Fica em rascunho até publicar."
          action={<Link href="/app/experiences/new" className="btn btn-sm btn-primary">Criar experiência</Link>}
        />
      ) : (
        <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
          {experiences.map((experience) => (
            <li key={experience.id} className="group">
              <div className="relative aspect-[4/3] overflow-hidden bg-stone-soft">
                {experience.cover ? (
                  <Image src={mediaUrl({ id: experience.id, public_path: experience.cover })} alt="" fill sizes="33vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.12em] text-graphite-dim">
                    Sem imagem
                  </div>
                )}
                <div className="absolute left-3 top-3"><StatusPill {...EXPERIENCE_STATUS[experience.status]} /></div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-obsidian/80 to-transparent p-4">
                  <p className="font-serif text-[20px] leading-tight text-porcelain">{experience.property_title}</p>
                  <p className="mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-porcelain/60">
                    {LAYOUTS[experience.layout]?.label} · {experience.city ?? "—"}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[10px] text-graphite-dim">/p/{experience.slug}</p>
                  <p className="text-[10px] text-graphite-dim">
                    {experience.lead_count} leads · atualizada {relativeTime(experience.updated_at)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link href={`/app/experiences/${experience.id}`} className="btn btn-sm btn-outline">Builder</Link>
                  {experience.status === "published" ? (
                    <a href={`/p/${experience.slug}`} target="_blank" rel="noreferrer" aria-label="Abrir página" className="btn btn-sm btn-ghost px-2">
                      <ArrowUpRight size={13} />
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {withoutExperience.length > 0 ? (
        <section>
          <SectionHead eyebrow="Por configurar" title="Imóveis sem experiência" description="Crie a página pública a partir da ficha do imóvel." />
          <ul className="mt-4 divide-y divide-obsidian/[0.08]">
            {withoutExperience.map((property) => (
              <li key={property.id} className="flex flex-wrap items-center gap-3 py-3">
                <Globe2 size={14} className="text-graphite-dim" />
                <span className="min-w-0 flex-1 truncate text-[12.5px]">{property.title}</span>
                <span className="text-[10px] text-graphite-dim">{property.reference}</span>
                <Link href={`/app/experiences/new?propertyId=${property.id}`} className="btn btn-sm btn-outline">
                  Criar experiência
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
