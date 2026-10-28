"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Globe2 } from "lucide-react";
import { useToast, Spinner } from "@/components/ui/client";
import { LAYOUTS } from "@/lib/labels";
import type { ExperienceLayout } from "@/lib/types";
import type { Property } from "@/lib/types";

export function NewExperience({
  properties,
  preselected,
}: {
  properties: Pick<Property, "id" | "title" | "city" | "reference">[];
  preselected?: string;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [propertyId, setPropertyId] = useState(preselected ?? properties[0]?.id ?? "");
  const [layout, setLayout] = useState<ExperienceLayout>("architectural");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!propertyId) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/experiences", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ property_id: propertyId, layout }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível criar a experiência.");
      push({ kind: "success", title: "Experiência criada em rascunho" });
      router.push(`/app/experiences/${data.experience.id}`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="border border-obsidian/10 bg-white p-6">
        <label className="field-label" htmlFor="property">Imóvel</label>
        <select
          id="property"
          className="select-boxed"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          disabled={Boolean(preselected)}
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · {p.reference}{p.city ? ` · ${p.city}` : ""}
            </option>
          ))}
        </select>

        <p className="field-label mt-6">Direcção editorial</p>
        <div className="grid gap-2">
          {(Object.keys(LAYOUTS) as ExperienceLayout[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setLayout(key)}
              className={`border px-4 py-3 text-left transition ${
                layout === key ? "border-obsidian bg-obsidian text-porcelain" : "border-obsidian/15 hover:border-obsidian/40"
              }`}
            >
              <span className="text-[13px] font-medium">{LAYOUTS[key].label}</span>
              <span className={`mt-1 block text-[11px] leading-relaxed ${layout === key ? "text-porcelain/60" : "text-graphite-dim"}`}>
                {LAYOUTS[key].description}
              </span>
            </button>
          ))}
        </div>

        {error ? <p className="mt-4 border-l-2 border-red-800 bg-red-900/[0.04] px-3 py-2 text-[12px] text-red-900">{error}</p> : null}

        <button onClick={create} disabled={pending || !propertyId} className="btn btn-md btn-primary mt-6">
          {pending ? <Spinner /> : <Globe2 size={14} />} Criar experiência em rascunho
        </button>
      </div>
      <p className="mt-3 text-[10.5px] leading-relaxed text-graphite-dim">
        O URL é gerado a partir do imóvel e mantém-se estável. A página só fica pública após publicação e depois de
        existir pelo menos uma imagem aprovada.
      </p>
    </div>
  );
}
