import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowDown, ArrowUpRight, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { one, many, type Row, parseJson } from "@/server/db";
import { mapExperience, mapMedia } from "@/server/data/properties";
import { getSession } from "@/server/auth";
import { orgBranding } from "@/server/ai/knowledge";
import { suggestedQuestions } from "@/server/ai/assistant";
import { Gallery } from "@/components/public/gallery";
import { PropertyAssistant } from "@/components/public/assistant";
import { VisitForm } from "@/components/public/visit-form";
import { ShareButton } from "@/components/public/share-button";
import { PageView } from "@/components/public/page-view";
import { money, dateShort } from "@/lib/format";
import type { ExperienceConfig, ExperienceLayout, PropertyMedia } from "@/lib/types";

export const dynamic = "force-dynamic";

function orgIsDemo(org: Row) {
  return Boolean(parseJson<{ demo?: boolean }>(org.settings, {}).demo);
}

type Loaded = {
  experienceRow: Row;
  property: Row;
  org: Row;
  media: PropertyMedia[];
  listing: Row | null;
  config: ExperienceConfig;
  preview: boolean;
};

const DEFAULT_SECTIONS = ["story", "gallery", "specifications", "highlights", "location", "assistant"];

function defaultConfig(): ExperienceConfig {
  return {
    hero: { headline: "", subheadline: "", showPrice: true, locationLabel: "", primaryCta: "Solicitar visita", secondaryCta: "Falar com o consultor" },
    sections: DEFAULT_SECTIONS.map((id) => ({ id, enabled: true })),
    contact: { name: "", email: "", phone: "", role: "Consultor" },
    map: { enabled: false, lat: null, lng: null, showExactAddress: false },
    theme: { accent: "#C6A77A", tone: "light" },
  };
}

async function load(slug: string, preview: boolean): Promise<Loaded | null> {
  const experienceRow = one<Row>(
    `SELECT e.*, p.org_id AS p_org_id FROM property_experiences e
     JOIN properties p ON p.id = e.property_id WHERE e.slug = ?`,
    [slug],
  );
  if (!experienceRow) return null;
  const previewMode = experienceRow.status !== "published";
  if (previewMode) {
    if (!preview) return null;
    const session = await getSession();
    if (!session || session.org.id !== experienceRow.p_org_id) return null;
  }
  const property = one<Row>(`SELECT * FROM properties WHERE id = ? AND status != 'archived'`, [experienceRow.property_id]);
  if (!property) return null;
  const org = one<Row>(`SELECT * FROM organizations WHERE id = ?`, [experienceRow.org_id]);
  if (!org) return null;
  const media = many<Row>(
    `SELECT * FROM property_media WHERE property_id = ? AND is_public = 1 AND status = 'approved'
     ORDER BY is_primary DESC, sort, created_at`,
    [property.id],
  ).map(mapMedia);
  const listingRow = one<Row>(
    `SELECT * FROM property_content WHERE property_id = ? AND kind = 'listing' AND status = 'approved'
     ORDER BY CASE locale WHEN 'pt' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1`,
    [property.id],
  );
  const rawConfig = parseJson<Partial<ExperienceConfig>>(experienceRow.config, {});
  const config: ExperienceConfig = {
    ...defaultConfig(),
    ...rawConfig,
    hero: { ...defaultConfig().hero, ...(rawConfig.hero ?? {}) },
    contact: { ...defaultConfig().contact, ...(rawConfig.contact ?? {}) },
    map: { ...defaultConfig().map, ...(rawConfig.map ?? {}) },
    theme: { ...defaultConfig().theme, ...(rawConfig.theme ?? {}) },
    sections: rawConfig.sections?.length ? rawConfig.sections : DEFAULT_SECTIONS.map((id) => ({ id, enabled: true })),
  };
  return { experienceRow, property, org, media, listing: listingRow ?? null, config, preview: previewMode };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug, true);
  if (!data) return { title: "Página não encontrada" };
  const title = data.listing?.title ?? data.property.title;
  const description = String(
    parseJson<{ summary?: string }>(data.listing?.payload, {}).summary ??
      data.property.summary ??
      `${data.property.title} — ${[data.property.location, data.property.city].filter(Boolean).join(", ")}`,
  ).slice(0, 300);
  const cover = data.media[0];
  return {
    title,
    description,
    alternates: { canonical: `/p/${slug}` },
    openGraph: {
      title,
      description,
      type: "website",
      images: cover ? [{ url: cover.public_path || `/api/media/${cover.id}/file`, alt: cover.caption ?? title }] : [],
    },
    robots:
      data.preview || orgIsDemo(data.org)
        ? { index: false, follow: false }
        : { index: true, follow: true },
  };
}

export default async function PublicPropertyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const data = await load(slug, preview === "1");
  if (!data) notFound();

  const { property, org, media, listing, config, preview: isPreview } = data;
  const experience = mapExperience(data.experienceRow);
  const layout: ExperienceLayout = experience.layout;
  const branding = orgBranding(org.id);
  const isDemo = orgIsDemo(org);
  const assistantEnabled = parseJson<{ assistantEnabled?: boolean }>(org.settings, {}).assistantEnabled !== false;
  const galleryConfig = config.gallery ?? { mode: "masonry" as const, mediaIds: [], showCaptions: true };
  const galleryMedia = galleryConfig.mediaIds.length
    ? media.filter((item) => galleryConfig.mediaIds.includes(item.id))
    : media;
  const specs = one<Row>(`SELECT * FROM property_specs WHERE property_id = ?`, [property.id]);
  const payload = parseJson<{ summary?: string; features?: string[] }>(listing?.payload, {});
  const story = listing?.body ?? null;
  const hero = config.hero;
  const consultant = {
    name: config.contact.name || branding.agencyName || org.name,
    role: config.contact.role || "Consultor",
    email: config.contact.email || branding.email || "",
    phone: config.contact.phone || branding.phone || "",
  };
  const price = money(property.price_cents, property.currency);
  const publicLocation = [property.location, property.city].filter(Boolean).join(", ") || property.city || "";
  const order = config.sections.filter((s) => s.enabled).map((s) => s.id);
  const questions = suggestedQuestions(property.id, org.id, "pt");
  const contactHref = `mailto:${consultant.email || ""}`;
  const phoneHref = consultant.phone ? `tel:${consultant.phone.replace(/\s/g, "")}` : "#contact";

  const amenities: string[] = parseJson(specs?.amenities, []);
  const features: string[] = parseJson(specs?.features, []);
  const views: string[] = parseJson(specs?.views, []);

  const specRows = [
    ["Área útil", specs?.usable_area_m2 ? `${specs.usable_area_m2} m²` : null],
    ["Área do terreno", specs?.plot_area_m2 ? `${specs.plot_area_m2} m²` : null],
    ["Quartos", specs?.bedrooms ?? null],
    ["Casas de banho", specs?.bathrooms ?? null],
    ["Estacionamento", specs?.parking ?? null],
    ["Tipologia", specs?.typology ?? null],
    ["Estado", specs?.condition ?? null],
    ["Ano de construção", specs?.year_built ?? null],
    ["Certificado energético", specs?.energy_rating ?? null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== "") as [string, string | number][];

  const highlights = [
    { title: "Arquitectura e materiais", items: features },
    { title: "Comodidades confirmadas", items: amenities },
    { title: "Envolvente", items: views },
  ].filter((group) => group.items.length > 0);

  const mapEnabled = config.map.enabled && config.map.lat !== null && config.map.lng !== null;
  const isDark = layout === "signature";
  const pageClass =
    layout === "signature" ? "bg-[#141412] text-porcelain" : layout === "investment" ? "bg-[#F4F3EF] text-obsidian" : "bg-porcelain text-obsidian";
  const heroHeight = layout === "signature" ? "min-h-[92svh]" : layout === "investment" ? "min-h-[66svh]" : "min-h-[86svh]";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: property.title,
    description: payload.summary ?? property.summary ?? undefined,
    url: `/p/${slug}`,
    image: media.slice(0, 5).map((m) => m.public_path || `/api/media/${m.id}/file`),
    address: {
      "@type": "PostalAddress",
      addressLocality: property.city ?? undefined,
      addressCountry: property.country ?? undefined,
      ...(config.map.showExactAddress && property.address_line && !property.address_private
        ? { streetAddress: property.address_line }
        : {}),
    },
    ...(property.price_cents && !isDemo
      ? {
          offers: {
            "@type": "Offer",
            price: property.price_cents / 100,
            priceCurrency: property.currency,
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
    ...(isDemo
      ? {
          disambiguatingDescription:
            "Demonstration record created for a product demo. Not a real property listing; imagery is illustrative.",
        }
      : {}),
    numberOfRooms: specs?.bedrooms ?? undefined,
    floorSize: specs?.usable_area_m2 ? { "@type": "QuantitativeValue", value: specs.usable_area_m2, unitCode: "MTK" } : undefined,
  };

  return (
    <div className={pageClass}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageView slug={slug} />

      {isPreview ? (
        <div className="sticky top-0 z-[70] flex flex-wrap items-center justify-center gap-3 bg-champagne px-4 py-2 text-[10.5px] font-medium uppercase tracking-[0.12em] text-obsidian">
          Pré-visualização privada · {experience.status === "draft" ? "rascunho" : "despublicada"} · não indexada
        </div>
      ) : null}

      <a
        href="#main"
        className={`sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[80] focus:px-3 focus:py-2 focus:text-[12px] ${
          isDark ? "focus:bg-porcelain focus:text-obsidian" : "focus:bg-obsidian focus:text-porcelain"
        }`}
      >
        Saltar para o conteúdo
      </a>

      <header className="absolute inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-5 text-porcelain sm:px-8">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.24em]">{branding.agencyName ?? org.name}</span>
          <span className="hidden h-3 w-px bg-porcelain/30 sm:block" />
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.18em] text-porcelain/50 sm:block">{property.reference}</span>
        </div>
        <div className="flex items-center gap-4">
          <ShareButton slug={slug} title={property.title} tone="dark" />
          <a
            href="#contact"
            className="hidden rounded-full border border-porcelain/40 px-4 py-1.5 text-[10.5px] uppercase tracking-[0.12em] transition hover:bg-porcelain hover:text-obsidian sm:inline-flex"
          >
            {hero.primaryCta}
          </a>
        </div>
      </header>

      {layout === "investment" ? (
        <section className={`relative grid ${heroHeight} grid-cols-1 pt-16 lg:grid-cols-[1.35fr_1fr] lg:pt-0`}>
          <div className="relative min-h-[42svh] overflow-hidden bg-obsidian">
            {media[0] ? (
              <Image src={media[0].public_path || `/api/media/${media[0].id}/file`} alt={media[0].caption ?? property.title} fill priority sizes="60vw" className="object-cover" />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-obsidian/40 to-transparent" />
          </div>
          <div className="flex flex-col justify-center bg-porcelain px-5 py-16 text-obsidian sm:px-10">
            <p className="text-[10px] uppercase tracking-[0.2em] text-graphite-dim">
              {property.operation === "sale" ? "Venda" : "Arrendamento"} · {publicLocation}
            </p>
            <h1 className="mt-4 text-[clamp(2rem,3.6vw,3rem)] font-normal leading-[1.02] tracking-tightest">
              {hero.headline || property.title}
            </h1>
            {hero.showPrice && price ? <p className="mt-4 font-mono text-[22px]">{price}</p> : null}
            <p className="mt-4 max-w-md text-[13px] leading-relaxed text-graphite">{hero.subheadline || payload.summary || ""}</p>
            <dl className="mt-8 grid grid-cols-2 gap-x-6 border-t border-obsidian/10 pt-4">
              {specRows.slice(0, 6).map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3 border-b border-obsidian/[0.06] py-1.5">
                  <dt className="text-[10px] uppercase tracking-[0.1em] text-graphite-dim">{label}</dt>
                  <dd className="text-[12px] font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-7 flex flex-wrap gap-2">
              <a href="#contact" className="btn btn-md bg-obsidian text-porcelain hover:bg-graphite">{hero.primaryCta}</a>
              <a href={assistantEnabled ? "#assistant" : "#contact"} className="btn btn-md btn-outline">{hero.secondaryCta}</a>
            </div>
          </div>
        </section>
      ) : (
        <section className={`relative ${heroHeight} w-full overflow-hidden bg-obsidian`}>
          {media[0] ? (
            <Image src={media[0].public_path || `/api/media/${media[0].id}/file`} alt={media[0].caption ?? property.title} fill priority sizes="100vw" className="object-cover" />
          ) : null}
          <div className={`absolute inset-0 ${layout === "signature" ? "bg-obsidian/45" : "bg-gradient-to-t from-obsidian via-obsidian/30 to-obsidian/20"}`} />
          <div className="relative mx-auto flex min-h-[inherit] max-w-[1440px] flex-col justify-end px-5 pb-12 pt-32 sm:px-8 sm:pb-16">
            <div className={layout === "signature" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/60">
                {property.operation === "sale" ? "Para venda" : "Para arrendamento"} · {hero.locationLabel || publicLocation}
              </p>
              <h1
                className={
                  layout === "signature"
                    ? "mt-5 font-serif text-[clamp(3rem,8vw,6rem)] leading-[0.92] text-porcelain"
                    : "mt-5 text-[clamp(2.6rem,6vw,5rem)] font-light leading-[0.96] tracking-tightest text-porcelain"
                }
              >
                {hero.headline || property.title}
              </h1>
              <p className={`mt-6 max-w-xl text-[13.5px] leading-relaxed text-porcelain/70 ${layout === "signature" ? "mx-auto" : ""}`}>
                {hero.subheadline || payload.summary || ""}
              </p>
              <div className={`mt-8 flex flex-wrap items-center gap-3 ${layout === "signature" ? "justify-center" : ""}`}>
                <a href="#contact" className="btn btn-lg btn-light">{hero.primaryCta}</a>
                <a href={assistantEnabled ? "#assistant" : "#contact"} className="btn btn-lg btn-outline-light">{hero.secondaryCta}</a>
                {hero.showPrice && price ? <span className="ml-1 font-mono text-[13px] text-porcelain/80 sm:ml-4">{price}</span> : null}
              </div>
            </div>
            <div className="mt-12 flex items-end justify-between border-t border-porcelain/15 pt-5 text-porcelain/45">
              <div className="flex flex-wrap gap-x-8 gap-y-1 text-[9.5px] uppercase tracking-[0.16em]">
                {specRows.slice(0, 4).map(([label, value]) => (
                  <span key={label}>
                    {value} <span className="text-porcelain/30">{label}</span>
                  </span>
                ))}
              </div>
              <a href="#main" className="hidden flex-col items-center gap-1 text-[8.5px] uppercase tracking-[0.2em] sm:flex">
                Scroll
                <ArrowDown size={12} />
              </a>
            </div>
          </div>
        </section>
      )}

      <main id="main">
        {order.map((sectionId) => {
          if (sectionId === "story") {
            if (!story && !payload.summary) return null;
            return (
              <section key={sectionId} className={`mx-auto max-w-[1440px] px-5 sm:px-8 ${layout === "signature" ? "py-24 sm:py-32" : "py-20 sm:py-28"}`}>
                <div className={layout === "signature" ? "mx-auto max-w-prose text-center" : "grid gap-10 lg:grid-cols-[0.55fr_1fr]"}>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-champagne-deep">Property story</p>
                    {layout === "signature" ? (
                      <h2 className="mt-4 font-serif text-[clamp(2rem,4vw,3.2rem)] leading-[1.05]">
                        {payload.summary ?? "Uma apresentação editada a partir dos dados confirmados."}
                      </h2>
                    ) : (
                      <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.6rem)] font-light leading-[1.05]">{property.title}</h2>
                    )}
                  </div>
                  <div className={`prose-editorial ${layout === "signature" ? "mx-auto mt-8 text-left" : ""}`}>
                    {String(story ?? payload.summary ?? "")
                      .split("\n\n")
                      .filter(Boolean)
                      .map((paragraph, index) => (
                        <p
                          key={index}
                          className={
                            layout === "signature" && index === 0
                              ? "text-[15px] leading-[1.9] text-graphite first-letter:float-left first-letter:mr-3 first-letter:font-serif first-letter:text-[54px] first-letter:leading-[0.8]"
                              : "text-[14.5px] leading-[1.9] text-graphite"
                          }
                        >
                          {paragraph}
                        </p>
                      ))}
                    {listing ? (
                      <p className="mt-6 flex items-start gap-2 border-t border-obsidian/10 pt-3 text-[10px] text-graphite-dim">
                        <ShieldCheck size={11} className="mt-0.5 shrink-0" />
                        Texto aprovado pela agência e gerado a partir da ficha do imóvel. Características não confirmadas não foram incluídas.
                      </p>
                    ) : null}
                  </div>
                </div>
              </section>
            );
          }

          if (sectionId === "gallery" && galleryMedia.length > 1) {
            return (
              <section key={sectionId} className={`mx-auto max-w-[1440px] px-3 py-3 sm:px-8 sm:py-6 ${layout === "signature" ? "bg-[#141412]" : ""}`}>
                <Gallery
                  variant={layout}
                  mode={galleryConfig.mode}
                  showCaptions={galleryConfig.showCaptions}
                  items={galleryMedia.map((m) => ({
                    id: m.id,
                    src: m.public_path || `/api/media/${m.id}/file`,
                    caption: m.caption,
                    room: m.room,
                  }))}
                />
              </section>
            );
          }

          if (sectionId === "specifications" && specRows.length) {
            return (
              <section key={sectionId} className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20">
                <div className="border-t border-obsidian/15 pt-6">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-champagne-deep">Specifications</p>
                  <div className={`mt-6 grid ${layout === "investment" ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
                    {specRows.map(([label, value]) => (
                      <div key={label} className="flex items-baseline justify-between gap-4 border-b border-obsidian/[0.08] py-3 sm:pr-8">
                        <span className="text-[10.5px] uppercase tracking-[0.1em] text-graphite-dim">{label}</span>
                        <span className="text-[13px] font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-graphite-dim">Campos sem dados confirmados não são apresentados.</p>
                </div>
              </section>
            );
          }

          if (sectionId === "highlights" && highlights.length) {
            return (
              <section key={sectionId} className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20">
                <div className="grid gap-10 lg:grid-cols-[0.5fr_1fr]">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-champagne-deep">Highlights</p>
                    <h2 className="mt-3 text-[clamp(1.7rem,2.8vw,2.3rem)] font-light leading-[1.08]">O que está confirmado.</h2>
                  </div>
                  <div className="grid gap-8 sm:grid-cols-2">
                    {highlights.map((group) => (
                      <div key={group.title}>
                        <p className="border-b border-obsidian/15 pb-2 text-[10.5px] uppercase tracking-[0.12em] text-graphite-dim">{group.title}</p>
                        <ul className="mt-3 space-y-2">
                          {group.items.map((item) => (
                            <li key={item} className="flex items-start gap-2 text-[13px] text-graphite">
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-champagne-deep" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          }

          if (sectionId === "location" && (mapEnabled || publicLocation)) {
            return (
              <section key={sectionId} className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20">
                <div className="grid gap-8 lg:grid-cols-[0.5fr_1fr]">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-champagne-deep">Location</p>
                    <h2 className="mt-3 flex items-center gap-2 text-[clamp(1.7rem,2.8vw,2.3rem)] font-light leading-[1.08]">
                      <MapPin size={18} className="text-champagne-deep" />
                      {publicLocation || property.city}
                    </h2>
                    <p className="mt-3 max-w-sm text-[12px] leading-relaxed text-graphite">
                      {config.map.showExactAddress && property.address_line && !property.address_private
                        ? property.address_line
                        : "A morada exata é partilhada pelo consultor quando adequado. A localização apresentada é aproximada."}
                    </p>
                    {mapEnabled ? (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${config.map.lat}&mlon=${config.map.lng}#map=15/${config.map.lat}/${config.map.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="link-underline mt-5 inline-flex"
                      >
                        Abrir localização aproximada <ArrowUpRight size={12} />
                      </a>
                    ) : null}
                  </div>
                  {mapEnabled ? (
                    <div className="relative aspect-[16/9] overflow-hidden border border-obsidian/10 bg-[#EDEAE3]">
                      <svg viewBox="0 0 400 220" className="absolute inset-0 h-full w-full" role="img" aria-label={`Localização aproximada de ${publicLocation}`}>
                        <defs>
                          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#101110" strokeOpacity="0.07" strokeWidth="1" />
                          </pattern>
                        </defs>
                        <rect width="400" height="220" fill="url(#grid)" />
                        <path d="M0 150 C80 130 150 170 220 145 S340 120 400 140" fill="none" stroke="#C6A77A" strokeOpacity="0.5" strokeWidth="2" />
                        <path d="M0 60 C90 85 170 45 260 70 S360 95 400 75" fill="none" stroke="#101110" strokeOpacity="0.12" strokeWidth="1.5" />
                        <circle cx="205" cy="112" r="26" fill="#263C32" fillOpacity="0.08" />
                        <circle cx="205" cy="112" r="5" fill="#263C32" />
                        <circle cx="205" cy="112" r="12" fill="none" stroke="#263C32" strokeOpacity="0.4" />
                        <text x="215" y="103" fontSize="9" fill="#343632" letterSpacing="1.5">{publicLocation.toUpperCase()}</text>
                      </svg>
                      <span className="absolute bottom-2 right-2 font-mono text-[8px] uppercase tracking-[0.1em] text-graphite-dim">
                        mapa esquemático · não à escala
                      </span>
                    </div>
                  ) : null}
                </div>
              </section>
            );
          }

          if (sectionId === "assistant" && assistantEnabled) {
            return (
              <section key={sectionId} id="assistant" className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20">
                <div className="grid gap-8 lg:grid-cols-[0.5fr_1fr]">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-champagne-deep">Property assistant</p>
                    <h2 className="mt-3 text-[clamp(1.7rem,2.8vw,2.3rem)] font-light leading-[1.08]">
                      Pergunte. A resposta vem dos dados.
                    </h2>
                    <p className="mt-3 max-w-sm text-[12px] leading-relaxed text-graphite">
                      O assistente responde apenas com informação aprovada, indica a origem de cada dado e diz
                      explicitamente quando não sabe.
                    </p>
                  </div>
                  <PropertyAssistant slug={slug} suggested={questions} consultant={consultant} />
                </div>
              </section>
            );
          }

          return null;
        })}

        <section id="contact" className={`${isDark ? "bg-[#141412] text-porcelain" : "bg-[#EFECE5]"} py-16 sm:py-24`}>
          <div className="mx-auto grid max-w-[1440px] gap-10 px-5 sm:px-8 lg:grid-cols-[0.9fr_1fr]">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-champagne-deep">Visita e contacto</p>
              <h2 className={`mt-3 text-[clamp(1.9rem,3.4vw,2.8rem)] font-light leading-[1.03] ${isDark ? "text-porcelain" : ""}`}>
                {hero.primaryCta}
              </h2>
              <p className={`mt-4 max-w-md text-[13px] leading-relaxed ${isDark ? "text-porcelain/60" : "text-graphite"}`}>
                Indique a sua preferência. A visita fica como “solicitada” até o consultor confirmar a disponibilidade
                — não reservamos horários automaticamente.
              </p>
              <div className={`mt-8 border-t pt-5 ${isDark ? "border-porcelain/15" : "border-obsidian/15"}`}>
                <p className={`text-[10px] uppercase tracking-[0.16em] ${isDark ? "text-porcelain/40" : "text-graphite-dim"}`}>Consultor responsável</p>
                <p className={`mt-2 text-[14px] ${isDark ? "text-porcelain" : ""}`}>{consultant.name || "Equipa de vendas"}</p>
                <p className={`text-[11.5px] ${isDark ? "text-porcelain/50" : "text-graphite-dim"}`}>{consultant.role}</p>
                <div className="mt-3 space-y-1.5">
                  {consultant.email ? (
                    <a href={contactHref} className={`flex items-center gap-2 text-[12px] ${isDark ? "text-porcelain/70 hover:text-porcelain" : "text-graphite hover:text-obsidian"}`}>
                      <Mail size={12} /> {consultant.email}
                    </a>
                  ) : null}
                  {consultant.phone ? (
                    <a href={phoneHref} className={`flex items-center gap-2 text-[12px] ${isDark ? "text-porcelain/70 hover:text-porcelain" : "text-graphite hover:text-obsidian"}`}>
                      <Phone size={12} /> {consultant.phone}
                    </a>
                  ) : null}
                </div>
                <div className="mt-5">
                  <ShareButton slug={slug} title={property.title} tone={isDark ? "dark" : "light"} />
                </div>
              </div>
            </div>
            <VisitForm slug={slug} accent={config.theme.accent} />
          </div>
        </section>

        {isDemo ? (
          <div className={`${isDark ? "bg-[#0d0e0d] text-porcelain/50" : "bg-[#EFECE5] text-graphite-dim"} border-t ${isDark ? "border-porcelain/10" : "border-obsidian/10"}`}>
            <p className="mx-auto max-w-[1440px] px-5 py-3 text-[10px] leading-relaxed tracking-[0.02em] sm:px-8">
              Ambiente de demonstração · imóvel, marca e fotografias são ilustrativos e não correspondem a um imóvel
              real. Página não indexada.
            </p>
          </div>
        ) : null}

        <footer className={`${isDark ? "bg-[#141412] text-porcelain" : "bg-porcelain text-obsidian"} border-t ${isDark ? "border-porcelain/10" : "border-obsidian/10"}`}>
          <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-8 sm:px-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em]">{branding.agencyName ?? org.name}</p>
              <p className={`mt-1 text-[10px] ${isDark ? "text-porcelain/40" : "text-graphite-dim"}`}>
                {property.reference} · atualizado {dateShort(property.updated_at)}
              </p>
            </div>
            <div className={`flex flex-wrap gap-x-5 gap-y-1 text-[10px] ${isDark ? "text-porcelain/40" : "text-graphite-dim"}`}>
              <Link href="/legal/privacidade" className="hover:underline">Privacidade</Link>
              <Link href="/legal/termos" className="hover:underline">Termos</Link>
              <span>Apresentação produzida com ESTATE OS</span>
              <span className={isDark ? "text-porcelain/25" : "text-graphite-dim/60"}>
                {property.address_private ? "Morada exata não divulgada" : property.address_line ?? ""}
              </span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
