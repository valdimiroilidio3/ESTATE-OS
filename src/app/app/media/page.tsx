import type { Metadata } from "next";
import { requireSessionPage } from "@/server/page-auth";
import { listMedia } from "@/server/data/media";
import { listProperties } from "@/server/data/properties";
import { MediaLibrary } from "@/components/app/media-library";
import { Eyebrow, Metric } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Media Library" };

export default async function MediaPage() {
  const session = await requireSessionPage();
  const media = listMedia(session.org.id, { limit: 300 });
  const properties = listProperties(session.org.id, { limit: 100 }).items;
  const pending = media.filter((m) => m.status === "pending").length;
  const published = media.filter((m) => m.is_public).length;
  const photos = media.filter((m) => m.kind === "photo").length;
  const docs = media.filter((m) => m.kind === "document" || m.kind === "floorplan").length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <header>
        <Eyebrow>Media library</Eyebrow>
        <h1 className="mt-2 text-[26px] font-light">Biblioteca central</h1>
        <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-graphite-dim">
          Fotografias, plantas, vídeos e documentos. Upload validado, estados de aprovação e exposição pública
          explícita. Documentos confidenciais vivem fora da biblioteca pública.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-x-8 md:grid-cols-4">
        <Metric label="Ficheiros" value={media.length} />
        <Metric label="Fotografias" value={photos} />
        <Metric label="Pendentes" value={pending} hint="Requerem revisão" />
        <Metric label="Públicas" value={published} hint={`${docs} plantas/documentos`} />
      </section>

      <MediaLibrary
        initialMedia={media as never}
        properties={properties.map((p) => ({ id: p.id, label: `${p.title} · ${p.reference}` }))}
        canEdit={session.role !== "viewer"}
      />
    </div>
  );
}
