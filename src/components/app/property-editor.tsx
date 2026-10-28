"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save } from "lucide-react";
import { useToast, Spinner } from "@/components/ui/client";
import { PROPERTY_TYPES } from "@/lib/labels";
import type { Property } from "@/lib/types";

const CONDITIONS = ["Novo", "Como novo", "Renovado", "Bom", "A recuperar", "Para obras"];
const ENERGY = ["A+", "A", "B", "B-", "C", "D", "E", "F", "G"];

export function PropertyEditor({ property, readOnly }: { property: Property; readOnly: boolean }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const specs = property.specs;
  const [form, setForm] = useState({
    title: property.title,
    property_type: property.property_type,
    operation: property.operation,
    price: property.price_cents ? String(property.price_cents / 100) : "",
    currency: property.currency,
    country: property.country ?? "",
    city: property.city ?? "",
    location: property.location ?? "",
    address_line: property.address_line ?? "",
    address_private: Boolean(property.address_private),
    summary: property.summary ?? "",
    internal_notes: property.internal_notes ?? "",
    usable_area_m2: specs?.usable_area_m2 ? String(specs.usable_area_m2) : "",
    plot_area_m2: specs?.plot_area_m2 ? String(specs.plot_area_m2) : "",
    bedrooms: specs?.bedrooms !== null && specs?.bedrooms !== undefined ? String(specs.bedrooms) : "",
    bathrooms: specs?.bathrooms !== null && specs?.bathrooms !== undefined ? String(specs.bathrooms) : "",
    parking: specs?.parking !== null && specs?.parking !== undefined ? String(specs.parking) : "",
    typology: specs?.typology ?? "",
    condition: specs?.condition ?? "",
    year_built: specs?.year_built ? String(specs.year_built) : "",
    energy_rating: specs?.energy_rating ?? "",
    amenities: (specs?.amenities ?? []).join(", "),
    features: (specs?.features ?? []).join("\n"),
    views: (specs?.views ?? []).join(", "),
  });

  const set = (key: keyof typeof form, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/${property.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          property_type: form.property_type,
          operation: form.operation,
          price: Number(form.price || 0),
          currency: form.currency,
          country: form.country,
          city: form.city,
          location: form.location || undefined,
          address_line: form.address_line || undefined,
          address_private: form.address_private,
          summary: form.summary || undefined,
          internal_notes: form.internal_notes || undefined,
          specs: {
            usable_area_m2: form.usable_area_m2 || null,
            plot_area_m2: form.plot_area_m2 || null,
            bedrooms: form.bedrooms === "" ? null : Number(form.bedrooms),
            bathrooms: form.bathrooms === "" ? null : Number(form.bathrooms),
            parking: form.parking === "" ? null : Number(form.parking),
            typology: form.typology || undefined,
            condition: form.condition || undefined,
            year_built: form.year_built || null,
            energy_rating: form.energy_rating || undefined,
            amenities: form.amenities.split(",").map((s) => s.trim()).filter(Boolean),
            features: form.features.split("\n").map((s) => s.trim()).filter(Boolean),
            views: form.views.split(",").map((s) => s.trim()).filter(Boolean),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.details?.formErrors?.[0] ?? data.error ?? "Não foi possível guardar.");
      push({ kind: "success", title: "Alterações guardadas", description: "A completude do imóvel foi recalculada." });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <fieldset disabled={readOnly} className="space-y-8 disabled:opacity-70">
        <section>
          <h3 className="border-b border-obsidian/10 pb-2 text-[12px] font-medium uppercase tracking-[0.1em] text-graphite-dim">
            Informação básica
          </h3>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="edit-title">Título interno</label>
              <input id="edit-title" className="input-boxed" value={form.title} onChange={(e) => set("title", e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="edit-type">Tipo</label>
              <select id="edit-type" className="select-boxed" value={form.property_type} onChange={(e) => set("property_type", e.target.value)}>
                {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="edit-op">Operação</label>
              <select id="edit-op" className="select-boxed" value={form.operation} onChange={(e) => set("operation", e.target.value as "sale" | "rent")}>
                <option value="sale">Venda</option>
                <option value="rent">Arrendamento</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="edit-price">Preço</label>
              <div className="flex gap-2">
                <input id="edit-price" type="number" className="input-boxed flex-1" value={form.price} onChange={(e) => set("price", e.target.value)} />
                <select className="select-boxed w-24" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
                  {["EUR", "USD", "GBP", "CHF", "BRL"].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="edit-country">País</label>
              <input id="edit-country" className="input-boxed" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="edit-city">Cidade</label>
              <input id="edit-city" className="input-boxed" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="edit-location">Zona</label>
              <input id="edit-location" className="input-boxed" value={form.location} onChange={(e) => set("location", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="edit-address">Morada completa</label>
              <input id="edit-address" className="input-boxed" value={form.address_line} onChange={(e) => set("address_line", e.target.value)} />
              <label className="mt-2 flex items-center gap-2 text-[11px] text-graphite">
                <input type="checkbox" className="h-3.5 w-3.5 accent-obsidian" checked={form.address_private} onChange={(e) => set("address_private", e.target.checked)} />
                Manter privada — nunca exposta automaticamente na página pública
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="edit-summary">Resumo comercial interno</label>
              <textarea id="edit-summary" className="input-boxed min-h-[70px]" value={form.summary} onChange={(e) => set("summary", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="edit-notes">Notas internas</label>
              <textarea id="edit-notes" className="input-boxed min-h-[60px]" value={form.internal_notes} onChange={(e) => set("internal_notes", e.target.value)} />
            </div>
          </div>
        </section>

        <section>
          <h3 className="border-b border-obsidian/10 pb-2 text-[12px] font-medium uppercase tracking-[0.1em] text-graphite-dim">
            Especificações
          </h3>
          <div className="mt-4 grid gap-5 sm:grid-cols-3">
            {[
              ["usable_area_m2", "Área útil (m²)", "number"],
              ["plot_area_m2", "Terreno (m²)", "number"],
              ["parking", "Estacionamento", "number"],
              ["bedrooms", "Quartos", "number"],
              ["bathrooms", "Casas de banho", "number"],
              ["year_built", "Ano de construção", "number"],
            ].map(([key, label, type]) => (
              <div key={key}>
                <label className="field-label" htmlFor={`edit-${key}`}>{label}</label>
                <input
                  id={`edit-${key}`}
                  type={type}
                  min={0}
                  className="input-boxed"
                  value={(form as any)[key]}
                  onChange={(e) => set(key as keyof typeof form, e.target.value)}
                />
              </div>
            ))}
            <div>
              <label className="field-label" htmlFor="edit-typology">Tipologia</label>
              <input id="edit-typology" className="input-boxed" value={form.typology} onChange={(e) => set("typology", e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="edit-condition">Estado</label>
              <select id="edit-condition" className="select-boxed" value={form.condition} onChange={(e) => set("condition", e.target.value)}>
                <option value="">Não indicado</option>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="edit-energy">Certificado energético</label>
              <select id="edit-energy" className="select-boxed" value={form.energy_rating} onChange={(e) => set("energy_rating", e.target.value)}>
                <option value="">Não disponível</option>
                {ENERGY.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className="field-label" htmlFor="edit-amenities">Comodidades (separadas por vírgula)</label>
              <input id="edit-amenities" className="input-boxed" value={form.amenities} onChange={(e) => set("amenities", e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <label className="field-label" htmlFor="edit-views">Vistas confirmadas (separadas por vírgula)</label>
              <input id="edit-views" className="input-boxed" value={form.views} onChange={(e) => set("views", e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <label className="field-label" htmlFor="edit-features">Características especiais (uma por linha)</label>
              <textarea id="edit-features" className="input-boxed min-h-[80px]" value={form.features} onChange={(e) => set("features", e.target.value)} />
            </div>
          </div>
        </section>
      </fieldset>

      {error ? <p role="alert" className="border-l-2 border-red-800 bg-red-900/[0.04] px-3 py-2 text-[12px] text-red-900">{error}</p> : null}

      {!readOnly ? (
        <div className="flex items-center gap-3 border-t border-obsidian/10 pt-4">
          <button onClick={save} disabled={pending} className="btn btn-sm btn-primary">
            {pending ? <Spinner /> : <Save size={13} />} Guardar alterações
          </button>
          <span className="text-[10.5px] text-graphite-dim">
            A alteração de campos recalcula a completude e não altera conteúdo já aprovado.
          </span>
        </div>
      ) : (
        <p className="text-[11.5px] text-graphite-dim">O seu perfil tem acesso de leitura a este imóvel.</p>
      )}
    </div>
  );
}
