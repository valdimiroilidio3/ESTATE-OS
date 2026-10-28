import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { LayoutGrid, List, Plus, Search } from "lucide-react";
import { requireSessionPage } from "@/server/page-auth";
import { listProperties } from "@/server/data/properties";
import { listMedia, mediaUrl } from "@/server/data/media";
import { PROPERTY_STATUS, PROPERTY_TYPE_LABELS } from "@/lib/labels";
import { money, areaLabel, relativeTime } from "@/lib/format";
import { Eyebrow, Progress, StatusPill, EmptyState } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Properties" };

const STATUS_FILTERS = [
  { value: "all", label: "Todos" },
  { value: "draft", label: "Rascunho" },
  { value: "in_preparation", label: "Em preparação" },
  { value: "ready", label: "Pronto" },
  { value: "published", label: "Publicado" },
  { value: "archived", label: "Arquivado" },
];

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; operation?: string; view?: string; offset?: string }>;
}) {
  const session = await requireSessionPage();
  const params = await searchParams;
  const view = params.view === "list" ? "list" : "grid";
  const query = {
    q: params.q,
    status: params.status ?? "all",
    operation: params.operation,
    limit: 24,
    offset: Number(params.offset ?? 0),
  };
  const { items, total } = listProperties(session.org.id, query);
  const media = listMedia(session.org.id, { kind: "photo", limit: 200 });
  const coverFor = (id: string) =>
    media.find((m) => m.property_id === id && m.is_primary) ?? media.find((m) => m.property_id === id);

  const queryString = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    Object.entries({ ...params, ...patch }).forEach(([key, value]) => {
      if (value) next.set(key, value);
    });
    return `/app/properties?${next.toString()}`;
  };

  return (
    <div className="mx-auto max-w-[1320px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Property intelligence</Eyebrow>
          <h1 className="mt-2 text-[26px] font-light">Imóveis</h1>
          <p className="mt-1.5 text-[12.5px] text-graphite-dim">
            {total} {total === 1 ? "registo" : "registos"} na organização. Cada ficha alimenta página, conteúdo e
            operação comercial.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-obsidian/15 p-0.5">
            <Link href={queryString({ view: "grid" })} aria-label="Vista de grelha" className={`rounded-full p-1.5 ${view === "grid" ? "bg-obsidian text-porcelain" : "text-graphite"}`}>
              <LayoutGrid size={13} />
            </Link>
            <Link href={queryString({ view: "list" })} aria-label="Vista de lista" className={`rounded-full p-1.5 ${view === "list" ? "bg-obsidian text-porcelain" : "text-graphite"}`}>
              <List size={13} />
            </Link>
          </div>
          <Link href="/app/properties/new" className="btn btn-sm btn-primary">
            <Plus size={13} /> Novo imóvel
          </Link>
        </div>
      </header>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-y border-obsidian/10 py-3">
        <nav className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((filter) => (
            <Link
              key={filter.value}
              href={queryString({ status: filter.value, offset: undefined })}
              className={`rounded-full px-3 py-1 text-[11.5px] transition ${
                (params.status ?? "all") === filter.value
                  ? "bg-obsidian text-porcelain"
                  : "text-graphite hover:bg-obsidian/[0.05]"
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </nav>
        <form action="/app/properties" className="flex items-center gap-2">
          {params.status ? <input type="hidden" name="status" value={params.status} /> : null}
          <label className="flex items-center gap-2 border-b border-obsidian/20 pb-1 text-graphite-dim">
            <Search size={13} />
            <input
              name="q"
              defaultValue={params.q}
              placeholder="Título, referência, cidade"
              className="w-52 bg-transparent text-[12px] text-obsidian placeholder:text-graphite-dim/70 focus:outline-none"
            />
          </label>
        </form>
      </div>

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={params.q || (params.status && params.status !== "all") ? "Nenhum imóvel corresponde aos filtros" : "Ainda não existem imóveis"}
            description={
              params.q || (params.status && params.status !== "all")
                ? "Ajuste a pesquisa ou os filtros de estado para ver outros registos."
                : "Introduza o primeiro imóvel para gerar apresentação, página exclusiva e materiais de campanha."
            }
            action={
              <Link href="/app/properties/new" className="btn btn-sm btn-primary">
                <Plus size={13} /> Criar imóvel
              </Link>
            }
          />
        </div>
      ) : view === "grid" ? (
        <ul className="mt-6 grid gap-x-6 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((property) => {
            const cover = coverFor(property.id);
            return (
              <li key={property.id}>
                <Link href={`/app/properties/${property.id}`} className="group block">
                  <div className="relative aspect-[4/3] overflow-hidden bg-stone-soft">
                    {cover ? (
                      <Image
                        src={mediaUrl(cover)}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover transition duration-700 ease-editorial group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-[10px] uppercase tracking-[0.14em] text-graphite-dim">Sem fotografia</span>
                      </div>
                    )}
                    <div className="absolute left-3 top-3">
                      <StatusPill {...PROPERTY_STATUS[property.status]} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[14px] font-medium">{property.title}</h2>
                      <p className="mt-0.5 text-[11px] text-graphite-dim">
                        {PROPERTY_TYPE_LABELS[property.property_type] ?? property.property_type} ·{" "}
                        {[property.city, property.country].filter(Boolean).join(", ") || "Sem localização"}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-[12px]">{money(property.price_cents, property.currency)}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[10.5px] text-graphite-dim">
                    {property.specs?.usable_area_m2 ? <span>{areaLabel(property.specs.usable_area_m2)}</span> : null}
                    {property.specs?.bedrooms !== null ? <span>{property.specs?.bedrooms} qt</span> : null}
                    <span>{(property as { lead_count?: number }).lead_count ?? 0} leads</span>
                    <span className="ml-auto">{relativeTime(property.updated_at)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={property.completion} />
                    <span className="w-8 text-right font-mono text-[9.5px] text-graphite-dim">{property.completion}%</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-obsidian/10 text-[10px] uppercase tracking-[0.12em] text-graphite-dim">
                <th className="pb-2 font-medium">Imóvel</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 font-medium">Localização</th>
                <th className="pb-2 text-right font-medium">Preço</th>
                <th className="pb-2 text-right font-medium">Completude</th>
                <th className="pb-2 text-right font-medium">Leads</th>
                <th className="pb-2 text-right font-medium">Atualizado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((property) => (
                <tr key={property.id} className="border-b border-obsidian/[0.07] transition hover:bg-white/60">
                  <td className="py-3">
                    <Link href={`/app/properties/${property.id}`} className="flex items-center gap-3">
                      <span className="relative h-10 w-14 shrink-0 overflow-hidden bg-stone-soft">
                        {coverFor(property.id) ? (
                          <Image src={mediaUrl(coverFor(property.id)!)} alt="" fill sizes="56px" className="object-cover" />
                        ) : null}
                      </span>
                      <span>
                        <span className="block text-[12.5px] font-medium">{property.title}</span>
                        <span className="block text-[10px] text-graphite-dim">{property.reference}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="py-3"><StatusPill {...PROPERTY_STATUS[property.status]} /></td>
                  <td className="py-3 text-[11.5px] text-graphite">{[property.city, property.country].filter(Boolean).join(", ") || "—"}</td>
                  <td className="py-3 text-right font-mono text-[11.5px]">{money(property.price_cents, property.currency)}</td>
                  <td className="py-3 text-right font-mono text-[11.5px]">{property.completion}%</td>
                  <td className="py-3 text-right font-mono text-[11.5px]">{(property as { lead_count?: number }).lead_count ?? 0}</td>
                  <td className="py-3 text-right text-[10.5px] text-graphite-dim">{relativeTime(property.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 24 ? (
        <div className="mt-8 flex items-center justify-between border-t border-obsidian/10 pt-4 text-[11px] text-graphite-dim">
          <span>
            {Number(params.offset ?? 0) + 1}–{Math.min(Number(params.offset ?? 0) + 24, total)} de {total}
          </span>
          <div className="flex gap-2">
            {Number(params.offset ?? 0) > 0 ? (
              <Link href={queryString({ offset: String(Math.max(0, Number(params.offset ?? 0) - 24)) })} className="btn btn-sm btn-outline">
                Anterior
              </Link>
            ) : null}
            {Number(params.offset ?? 0) + 24 < total ? (
              <Link href={queryString({ offset: String(Number(params.offset ?? 0) + 24) })} className="btn btn-sm btn-outline">
                Seguinte
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
