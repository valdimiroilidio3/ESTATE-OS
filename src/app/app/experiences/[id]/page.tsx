import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireSessionPage } from "@/server/page-auth";
import { one, many, type Row } from "@/server/db";
import { mapMedia } from "@/server/data/properties";
import { mapExperience, getProperty } from "@/server/data/properties";
import { ExperienceBuilder } from "@/components/app/experience-builder";
import { Eyebrow } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Experience builder" };

export default async function ExperienceBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSessionPage();
  const { id } = await params;
  const row = one<Row>(`SELECT * FROM property_experiences WHERE id = ? AND org_id = ?`, [id, session.org.id]);
  if (!row) notFound();
  const experience = mapExperience(row);
  const property = getProperty(session.org.id, experience.property_id);
  const media = many<Row>(
    `SELECT * FROM property_media WHERE org_id = ? AND property_id = ? AND kind = 'photo' AND status = 'approved' AND is_public = 1
     ORDER BY is_primary DESC, sort, created_at`,
    [session.org.id, experience.property_id],
  ).map(mapMedia);

  return (
    <div className="mx-auto max-w-[1480px]">
      <nav className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.12em] text-graphite-dim">
        <Link href="/app/experiences" className="hover:text-obsidian">Experiences</Link>
        <span>/</span>
        <Link href={`/app/properties/${experience.property_id}?tab=experience`} className="hover:text-obsidian">
          {property?.reference ?? "Imóvel"}
        </Link>
      </nav>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-4 border-b border-obsidian/10 pb-5">
        <div>
          <Eyebrow>Experience builder</Eyebrow>
          <h1 className="mt-2 text-[24px] font-light">{property?.title ?? "Experiência"}</h1>
          <p className="mt-1 text-[11.5px] text-graphite-dim">
            Pré-visualização real · desktop e mobile · guarda rascunho antes de publicar
          </p>
        </div>
      </header>
      <div className="py-6">
        <ExperienceBuilder
          experience={experience}
          media={media.map((item) => ({
            id: item.id,
            src: item.public_path || `/api/media/${item.id}/file`,
            caption: item.caption,
            room: item.room,
          }))}
          readOnly={session.role === "viewer"}
        />
      </div>
    </div>
  );
}
