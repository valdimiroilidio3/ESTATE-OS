import Link from "next/link";
import type { Metadata } from "next";
import { requireSessionPage } from "@/server/page-auth";
import { listProperties } from "@/server/data/properties";
import { listExperiences } from "@/server/data/experiences";
import { NewExperience } from "@/components/app/new-experience";
import { Eyebrow, EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Nova experiência" };

export default async function NewExperiencePage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const session = await requireSessionPage();
  const { propertyId } = await searchParams;
  const experiences = listExperiences(session.org.id);
  const properties = listProperties(session.org.id, { limit: 100 }).items;
  const available = properties.filter((p) => !experiences.some((e) => e.property_id === p.id));

  return (
    <div className="mx-auto max-w-[1000px]">
      <nav className="text-[10.5px] uppercase tracking-[0.12em] text-graphite-dim">
        <Link href="/app/experiences" className="hover:text-obsidian">Experiences</Link> / Nova
      </nav>
      <header className="mt-4 border-b border-obsidian/10 pb-5">
        <Eyebrow>Property experience builder</Eyebrow>
        <h1 className="mt-2 text-[24px] font-light">Nova experiência</h1>
        <p className="mt-1.5 text-[12.5px] text-graphite-dim">
          Escolha o imóvel e a direcção editorial. Pode alterar tudo no builder antes de publicar.
        </p>
      </header>
      <div className="mt-6">
        {available.length === 0 ? (
          <EmptyState
            title="Todos os imóveis já têm experiência"
            description="Abra a lista de experiências para editar uma página existente, ou crie um novo imóvel."
            action={<Link href="/app/experiences" className="btn btn-sm btn-outline">Ver experiências</Link>}
          />
        ) : (
          <NewExperience
            properties={available.map((p) => ({ id: p.id, title: p.title, city: p.city, reference: p.reference }))}
            preselected={propertyId && available.some((p) => p.id === propertyId) ? propertyId : undefined}
          />
        )}
      </div>
    </div>
  );
}
