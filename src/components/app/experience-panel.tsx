"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Eye, Globe2, Pencil, Rocket } from "lucide-react";
import { useToast, Spinner } from "@/components/ui/client";
import { LAYOUTS, EXPERIENCE_STATUS } from "@/lib/labels";
import { StatusPill } from "@/components/ui/primitives";
import type { Experience, ExperienceLayout } from "@/lib/types";

export function ExperiencePanel({
  propertyId,
  experience,
  readOnly,
}: {
  propertyId: string;
  experience: Experience | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [layout, setLayout] = useState<ExperienceLayout>("architectural");
  const [pending, setPending] = useState(false);

  async function create() {
    setPending(true);
    try {
      const res = await fetch("/api/experiences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ property_id: propertyId, layout }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível criar.");
      push({ kind: "success", title: "Experiência criada", description: "Abre o builder para configurar e publicar." });
      router.refresh();
    } catch (e) {
      push({ kind: "error", title: "Falha", description: (e as Error).message });
    } finally {
      setPending(false);
    }
  }

  async function publish(next: "published" | "unpublished") {
    if (!experience) return;
    setPending(true);
    try {
      const res = await fetch(`/api/experiences/${experience.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível publicar.");
      push({
        kind: "success",
        title: next === "published" ? "Experiência publicada" : "Experiência despublicada",
        description: next === "published" ? "O URL público está ativo." : "O URL deixa de resolver imediatamente.",
      });
      router.refresh();
    } catch (e) {
      push({ kind: "error", title: "Ação não concluída", description: (e as Error).message });
    } finally {
      setPending(false);
    }
  }

  if (!experience) {
    return (
      <div className="space-y-5">
        <div className="border border-obsidian/10 bg-white p-5">
          <p className="text-[13px] font-medium">Criar experiência do imóvel</p>
          <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-graphite-dim">
            A experiência é uma página pública com URL estável. Começa sempre em rascunho: só fica visível quando a
            publicar.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {(Object.keys(LAYOUTS) as ExperienceLayout[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setLayout(key)}
                className={`border p-3 text-left transition ${
                  layout === key ? "border-obsidian bg-obsidian text-porcelain" : "border-obsidian/15 hover:border-obsidian/40"
                }`}
              >
                <p className="text-[12px] font-medium">{LAYOUTS[key].label}</p>
                <p className={`mt-1 text-[10.5px] leading-relaxed ${layout === key ? "text-porcelain/60" : "text-graphite-dim"}`}>
                  {LAYOUTS[key].description}
                </p>
              </button>
            ))}
          </div>
          <button onClick={create} disabled={pending || readOnly} className="btn btn-sm btn-primary mt-4">
            {pending ? <Spinner /> : <Globe2 size={13} />} Criar experiência
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <div className="border border-obsidian/10 bg-white p-5">
          <div className="flex items-center justify-between">
            <p className="text-[12px] uppercase tracking-[0.1em] text-graphite-dim">Experiência</p>
            <StatusPill {...EXPERIENCE_STATUS[experience.status]} />
          </div>
          <p className="mt-3 text-[15px] font-medium">{experience.config.hero?.headline || "Sem título"}</p>
          <p className="mt-1 text-[12px] text-graphite-dim">
            Layout {LAYOUTS[experience.layout]?.label} · atualizada {new Date(experience.updated_at).toLocaleDateString("pt-PT")}
          </p>
          {experience.status === "published" ? (
            <p className="mt-3 truncate font-mono text-[10.5px] text-forest">/p/{experience.slug}</p>
          ) : (
            <p className="mt-3 text-[10.5px] text-graphite-dim">URL reservado: /p/{experience.slug}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/app/experiences/${experience.id}`} className="btn btn-sm btn-primary">
              <Pencil size={12} /> Abrir builder
            </Link>
            {experience.status === "published" ? (
              <>
                <a href={`/p/${experience.slug}`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">
                  <Eye size={12} /> Ver página
                </a>
                <button onClick={() => publish("unpublished")} disabled={pending || readOnly} className="btn btn-sm btn-ghost">
                  Despublicar
                </button>
              </>
            ) : (
              <button onClick={() => publish("published")} disabled={pending || readOnly} className="btn btn-sm btn-outline">
                {pending ? <Spinner /> : <Rocket size={12} />} Publicar
              </button>
            )}
          </div>
        </div>
        <div className="border border-obsidian/10 bg-obsidian p-5 text-porcelain">
          <p className="text-[10px] uppercase tracking-[0.14em] text-porcelain/50">Ligações</p>
          <ul className="mt-3 space-y-2 text-[11.5px] text-porcelain/70">
            <li className="flex items-center justify-between border-b border-porcelain/10 pb-2">
              <span>Assistente</span>
              <span className="font-mono text-[10px]">{experience.config.sections?.find((s) => s.id === "assistant")?.enabled ? "ativo" : "desativado"}</span>
            </li>
            <li className="flex items-center justify-between border-b border-porcelain/10 pb-2">
              <span>Mapa</span>
              <span className="font-mono text-[10px]">{experience.config.map?.enabled ? "visível" : "oculto"}</span>
            </li>
            <li className="flex items-center justify-between">
              <span>Morada exata</span>
              <span className="font-mono text-[10px]">{experience.config.map?.showExactAddress ? "exposta" : "protegida"}</span>
            </li>
          </ul>
          <a href={`/p/${experience.slug}`} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-champagne">
            Abrir pré-visualização pública <ArrowUpRight size={11} />
          </a>
        </div>
      </div>
    </div>
  );
}
