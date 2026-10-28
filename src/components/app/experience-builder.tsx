"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Monitor, Rocket, Save, Smartphone, Undo2 } from "lucide-react";
import { useToast, Spinner } from "@/components/ui/client";
import { LAYOUTS, EXPERIENCE_STATUS } from "@/lib/labels";
import { StatusPill } from "@/components/ui/primitives";
import type { Experience, ExperienceConfig, ExperienceLayout } from "@/lib/types";

type GalleryMedia = { id: string; src: string; caption: string | null; room: string | null };

export function ExperienceBuilder({
  experience,
  media = [],
  readOnly,
}: {
  experience: Experience;
  media?: GalleryMedia[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [config, setConfig] = useState<ExperienceConfig>(experience.config);
  const [layout, setLayout] = useState<ExperienceLayout>(experience.layout);
  const [status, setStatus] = useState(experience.status);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const gallery = config.gallery ?? { mode: "masonry" as const, mediaIds: [], showCaptions: true };

  const setGallery = (patch: Partial<Required<ExperienceConfig>["gallery"]>) => {
    setConfig((c) => ({ ...c, gallery: { ...(c.gallery ?? { mode: "masonry", mediaIds: [], showCaptions: true }), ...patch } }));
    setDirty(true);
    setPreviewKey((k) => k + 1);
  };

  const toggleMedia = (id: string) => {
    const current = gallery.mediaIds;
    setGallery({ mediaIds: current.includes(id) ? current.filter((value) => value !== id) : [...current, id] });
  };

  const setHero = (key: keyof ExperienceConfig["hero"], value: string | boolean) => {
    setConfig((c) => ({ ...c, hero: { ...c.hero, [key]: value } }));
    setDirty(true);
    setPreviewKey((k) => k + 1);
  };
  const setContact = (key: keyof ExperienceConfig["contact"], value: string) => {
    setConfig((c) => ({ ...c, contact: { ...c.contact, [key]: value } }));
    setDirty(true);
    setPreviewKey((k) => k + 1);
  };
  const setMap = (patch: Partial<ExperienceConfig["map"]>) => {
    setConfig((c) => ({ ...c, map: { ...c.map, ...patch } }));
    setDirty(true);
    setPreviewKey((k) => k + 1);
  };
  const toggleSection = (id: string) => {
    setConfig((c) => ({
      ...c,
      sections: c.sections.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    }));
    setDirty(true);
    setPreviewKey((k) => k + 1);
  };
  const moveSection = (index: number, direction: -1 | 1) => {
    setConfig((c) => {
      const next = [...c.sections];
      const target = index + direction;
      if (target < 0 || target >= next.length) return c;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...c, sections: next };
    });
    setDirty(true);
    setPreviewKey((k) => k + 1);
  };

  const previewSrc = useMemo(() => `/p/${experience.slug}?preview=1&v=${previewKey}`, [experience.slug, previewKey]);

  async function save(options: { silent?: boolean } = {}) {
    setSaving(true);
    try {
      const res = await fetch(`/api/experiences/${experience.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ layout, config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível guardar.");
      setDirty(false);
      setPreviewKey((k) => k + 1);
      if (!options.silent) push({ kind: "success", title: "Rascunho guardado", description: "A pré-visualização reflete as alterações." });
      router.refresh();
    } catch (e) {
      push({ kind: "error", title: "Falha ao guardar", description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function publish(next: "published" | "unpublished" | "draft") {
    setPublishing(true);
    try {
      await save({ silent: true });
      const res = await fetch(`/api/experiences/${experience.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ layout, config, status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível alterar o estado.");
      setStatus(next);
      push({
        kind: "success",
        title: next === "published" ? "Experiência publicada" : "Experiência despublicada",
        description: next === "published" ? `Disponível em /p/${experience.slug}` : "O URL deixou de estar acessível publicamente.",
      });
      router.refresh();
    } catch (e) {
      push({ kind: "error", title: "Ação não concluída", description: (e as Error).message });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <div className="space-y-5">
        <div className="flex items-center justify-between border-b border-obsidian/10 pb-3">
          <StatusPill {...EXPERIENCE_STATUS[status]} />
          <span className="font-mono text-[10px] text-graphite-dim">/p/{experience.slug}</span>
        </div>

        <fieldset disabled={readOnly} className="space-y-5">
          <div>
            <p className="field-label">Direcção editorial</p>
            <div className="grid gap-1.5">
              {(Object.keys(LAYOUTS) as ExperienceLayout[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setLayout(key);
                    setDirty(true);
                    setPreviewKey((k) => k + 1);
                  }}
                  className={`border px-3 py-2 text-left transition ${
                    layout === key ? "border-obsidian bg-obsidian text-porcelain" : "border-obsidian/15 hover:border-obsidian/40"
                  }`}
                >
                  <span className="text-[12px] font-medium">{LAYOUTS[key].label}</span>
                  <span className={`mt-0.5 block text-[10px] leading-relaxed ${layout === key ? "text-porcelain/60" : "text-graphite-dim"}`}>
                    {LAYOUTS[key].description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-obsidian/10 pt-4">
            <p className="field-label">Hero</p>
            <div className="space-y-2">
              <input className="input-boxed" value={config.hero.headline} onChange={(e) => setHero("headline", e.target.value)} placeholder="Título" maxLength={180} />
              <textarea className="input-boxed min-h-[64px]" value={config.hero.subheadline} onChange={(e) => setHero("subheadline", e.target.value)} placeholder="Subtítulo" maxLength={400} />
              <input className="input-boxed" value={config.hero.locationLabel} onChange={(e) => setHero("locationLabel", e.target.value)} placeholder="Localização pública" maxLength={160} />
              <div className="grid grid-cols-2 gap-2">
                <input className="input-boxed" value={config.hero.primaryCta} onChange={(e) => setHero("primaryCta", e.target.value)} placeholder="CTA principal" maxLength={60} />
                <input className="input-boxed" value={config.hero.secondaryCta} onChange={(e) => setHero("secondaryCta", e.target.value)} placeholder="CTA secundário" maxLength={60} />
              </div>
              <label className="flex items-center gap-2 text-[11px] text-graphite">
                <input type="checkbox" className="h-3.5 w-3.5 accent-obsidian" checked={config.hero.showPrice} onChange={(e) => setHero("showPrice", e.target.checked)} />
                Mostrar preço no hero
              </label>
            </div>
          </div>

          <div className="border-t border-obsidian/10 pt-4">
            <p className="field-label">Contacto do consultor</p>
            <div className="grid gap-2">
              <input className="input-boxed" value={config.contact.name} onChange={(e) => setContact("name", e.target.value)} placeholder="Nome" />
              <input className="input-boxed" value={config.contact.role} onChange={(e) => setContact("role", e.target.value)} placeholder="Função" />
              <input className="input-boxed" type="email" value={config.contact.email} onChange={(e) => setContact("email", e.target.value)} placeholder="Email" />
              <input className="input-boxed" value={config.contact.phone} onChange={(e) => setContact("phone", e.target.value)} placeholder="Telefone" />
            </div>
          </div>

          <div className="border-t border-obsidian/10 pt-4">
            <p className="field-label">Localização</p>
            <label className="flex items-center gap-2 text-[11px] text-graphite">
              <input type="checkbox" className="h-3.5 w-3.5 accent-obsidian" checked={config.map.enabled} onChange={(e) => setMap({ enabled: e.target.checked })} />
              Mostrar mapa
            </label>
            {config.map.enabled ? (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="input-boxed"
                    type="number"
                    step="0.0001"
                    value={config.map.lat ?? ""}
                    onChange={(e) => setMap({ lat: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Latitude"
                  />
                  <input
                    className="input-boxed"
                    type="number"
                    step="0.0001"
                    value={config.map.lng ?? ""}
                    onChange={(e) => setMap({ lng: e.target.value ? Number(e.target.value) : null })}
                    placeholder="Longitude"
                  />
                </div>
                <label className="flex items-center gap-2 text-[11px] text-graphite">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-obsidian"
                    checked={config.map.showExactAddress}
                    onChange={(e) => setMap({ showExactAddress: e.target.checked })}
                  />
                  Mostrar morada exata (apenas se autorizado)
                </label>
              </div>
            ) : null}
          </div>

          <div className="border-t border-obsidian/10 pt-4">
            <p className="field-label">Galeria</p>
            <div className="flex rounded-full border border-obsidian/15 p-0.5">
              {([
                { id: "masonry", label: "Mosaico" },
                { id: "grid", label: "Grelha" },
                { id: "carousel", label: "Carrossel" },
              ] as const).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setGallery({ mode: option.id })}
                  className={`flex-1 rounded-full px-2 py-1 text-[10.5px] transition ${
                    gallery.mode === option.id ? "bg-obsidian text-porcelain" : "text-graphite hover:bg-obsidian/[0.05]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <label className="mt-2 flex items-center gap-2 text-[11px] text-graphite">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-obsidian"
                checked={gallery.showCaptions}
                onChange={(e) => setGallery({ showCaptions: e.target.checked })}
              />
              Mostrar legendas nas imagens
            </label>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.1em] text-graphite-dim">
                Imagens ({gallery.mediaIds.length || media.length})
              </span>
              {gallery.mediaIds.length ? (
                <button type="button" onClick={() => setGallery({ mediaIds: [] })} className="text-[10px] text-graphite-dim underline decoration-obsidian/20">
                  Usar todas
                </button>
              ) : null}
            </div>
            {media.length === 0 ? (
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-graphite-dim">
                Sem fotografias aprovadas e públicas. Aprove imagens na biblioteca para as incluir.
              </p>
            ) : (
              <>
                <ul className="mt-2 grid grid-cols-3 gap-1.5">
                  {media.map((item) => {
                    const selected = !gallery.mediaIds.length || gallery.mediaIds.includes(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => toggleMedia(item.id)}
                          aria-pressed={selected}
                          aria-label={`Imagem ${item.caption ?? item.room ?? "do imóvel"}`}
                          className={`relative block aspect-square w-full overflow-hidden border ${
                            selected ? "border-obsidian" : "border-transparent opacity-40"
                          }`}
                        >
                          <Image src={item.src} alt={item.caption ?? item.room ?? "Fotografia"} fill sizes="120px" className="object-cover" />
                          {selected ? (
                            <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-obsidian text-[8px] text-porcelain">✓</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-1.5 text-[10px] leading-relaxed text-graphite-dim">
                  Sem seleção explícita, a página usa todas as fotografias aprovadas e públicas.
                </p>
              </>
            )}
          </div>

          <div className="border-t border-obsidian/10 pt-4">
            <p className="field-label">Secções</p>
            <ul className="space-y-1">
              {config.sections.map((section, index) => (
                <li key={section.id} className="flex items-center gap-2 border-b border-obsidian/[0.06] py-1.5 last:border-0">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-obsidian"
                    checked={section.enabled}
                    onChange={() => toggleSection(section.id)}
                    aria-label={`Ativar secção ${section.id}`}
                  />
                  <span className="flex-1 text-[11.5px] capitalize">{section.id}</span>
                  <button type="button" onClick={() => moveSection(index, -1)} aria-label="Mover para cima" className="text-graphite-dim hover:text-obsidian">
                    <ArrowUp size={12} />
                  </button>
                  <button type="button" onClick={() => moveSection(index, 1)} aria-label="Mover para baixo" className="text-graphite-dim hover:text-obsidian">
                    <ArrowDown size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </fieldset>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-obsidian/10 pb-3">
          <div className="flex items-center gap-1 rounded-full border border-obsidian/15 p-0.5">
            <button onClick={() => setDevice("desktop")} className={`rounded-full p-1.5 ${device === "desktop" ? "bg-obsidian text-porcelain" : "text-graphite"}`} aria-label="Pré-visualização desktop">
              <Monitor size={13} />
            </button>
            <button onClick={() => setDevice("mobile")} className={`rounded-full p-1.5 ${device === "mobile" ? "bg-obsidian text-porcelain" : "text-graphite"}`} aria-label="Pré-visualização mobile">
              <Smartphone size={13} />
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {dirty ? <span className="text-[10px] text-champagne-deep">Alterações não guardadas</span> : null}
            <button onClick={() => setPreviewKey((k) => k + 1)} className="btn btn-sm btn-ghost">
              <Undo2 size={12} /> Recarregar
            </button>
            <button onClick={() => save()} disabled={saving || readOnly} className="btn btn-sm btn-outline">
              {saving ? <Spinner /> : <Save size={12} />} Guardar
            </button>
            {status === "published" ? (
              <>
                <a href={`/p/${experience.slug}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost">
                  <ExternalLink size={12} /> Ver
                </a>
                <button onClick={() => publish("unpublished")} disabled={publishing || readOnly} className="btn btn-sm btn-outline">
                  Despublicar
                </button>
              </>
            ) : (
              <button onClick={() => publish("published")} disabled={publishing || readOnly} className="btn btn-sm btn-primary">
                {publishing ? <Spinner /> : <Rocket size={12} />} Publicar
              </button>
            )}
          </div>
        </div>

        <div className={`mt-4 overflow-hidden border border-obsidian/10 bg-stone-soft ${device === "mobile" ? "mx-auto w-[390px] max-w-full" : "w-full"}`}>
          <div className="flex items-center gap-1.5 border-b border-obsidian/10 bg-porcelain px-3 py-2">
            <span className="h-2 w-2 rounded-full bg-obsidian/15" />
            <span className="h-2 w-2 rounded-full bg-obsidian/15" />
            <span className="h-2 w-2 rounded-full bg-obsidian/15" />
            <span className="ml-2 truncate font-mono text-[9.5px] text-graphite-dim">/p/{experience.slug}</span>
            {status !== "published" ? (
              <span className="ml-auto rounded-full bg-champagne/25 px-2 py-0.5 text-[8.5px] uppercase tracking-[0.1em] text-champagne-deep">
                pré-visualização privada
              </span>
            ) : null}
          </div>
          <iframe
            key={previewKey}
            src={previewSrc}
            title="Pré-visualização da experiência"
            className="block w-full bg-white"
            style={{ height: device === "mobile" ? 680 : 720 }}
          />
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-graphite-dim">
          Pré-visualização real da página pública, servida pelo mesmo componente. Rascunhos só são visíveis para
          membros autenticados da organização.{" "}
          <Link href={`/app/properties/${experience.property_id}?tab=experience`} className="underline decoration-obsidian/20">
            Ficha do imóvel
          </Link>
        </p>
      </div>
    </div>
  );
}
