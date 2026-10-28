"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  AlertTriangle,
  Info,
  Star,
} from "lucide-react";
import { useToast, Spinner } from "@/components/ui/client";
import { PROPERTY_TYPES, ROOM_OPTIONS } from "@/lib/labels";
import { money } from "@/lib/format";

const STEPS = ["Informação", "Características", "Conteúdo", "Verificação", "Revisão"];

const AMENITY_SUGGESTIONS = [
  "Piscina", "Jardim", "Garagem", "Elevador", "Ar condicionado", "Domótica",
  "Painéis solares", "Terraço", "Varanda", "Lareira", "Mobilado", "Segurança", "Ginásio", "Vista de mar",
];
const VIEW_OPTIONS = ["Mar", "Cidade", "Jardim", "Campo", "Rio", "Montanha"];
const CONDITIONS = ["Novo", "Como novo", "Renovado", "Bom", "A recuperar", "Para obras"];
const ENERGY = ["A+", "A", "B", "B-", "C", "D", "E", "F", "G"];

type StageMedia = {
  id: string;
  file_name: string;
  public_path: string | null;
  room: string | null;
  caption: string | null;
  size_bytes: number;
  kind: string;
  status: string;
};

type Draft = {
  title: string;
  property_type: string;
  operation: "sale" | "rent";
  price: string;
  currency: string;
  country: string;
  city: string;
  location: string;
  address_line: string;
  address_private: boolean;
  summary: string;
  specs: {
    usable_area_m2: string;
    plot_area_m2: string;
    bedrooms: string;
    bathrooms: string;
    parking: string;
    typology: string;
    condition: string;
    year_built: string;
    energy_rating: string;
    amenities: string[];
    features: string[];
    views: string[];
  };
};

const EMPTY: Draft = {
  title: "",
  property_type: "villa",
  operation: "sale",
  price: "",
  currency: "EUR",
  country: "Portugal",
  city: "",
  location: "",
  address_line: "",
  address_private: true,
  summary: "",
  specs: {
    usable_area_m2: "",
    plot_area_m2: "",
    bedrooms: "",
    bathrooms: "",
    parking: "",
    typology: "",
    condition: "",
    year_built: "",
    energy_rating: "",
    amenities: [],
    features: [],
    views: [],
  },
};

const TASKS = [
  { id: "validate_fields", label: "Validar campos obrigatórios", default: true },
  { id: "analyze_media", label: "Analisar media carregada", default: true },
  { id: "generate_listing", label: "Gerar listagem em português", default: true },
  { id: "generate_multilingual", label: "Gerar versão em inglês", default: true },
  { id: "generate_campaign", label: "Gerar pacote de campanha", default: false },
  { id: "generate_media_brief", label: "Preparar briefing cinematográfico", default: false },
  { id: "prepare_experience", label: "Criar experiência em rascunho", default: true },
];

const LOCAL_KEY = "estate-os:property-draft";

export function PropertyWizard() {
  const router = useRouter();
  const { push } = useToast();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [media, setMedia] = useState<StageMedia[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verification, setVerification] = useState<any>(null);
  const [tasks, setTasks] = useState<string[]>(TASKS.filter((t) => t.default).map((t) => t.id));
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.draft) {
          setDraft({ ...EMPTY, ...parsed.draft, specs: { ...EMPTY.specs, ...parsed.draft.specs } });
          if (parsed.media?.length) setMedia(parsed.media);
          if (parsed.primaryId) setPrimaryId(parsed.primaryId);
          setRestored(true);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify({ draft, media, primaryId }));
      } catch {
        /* storage full or unavailable */
      }
    }, 500);
    return () => clearTimeout(handle);
  }, [draft, media, primaryId]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const setSpec = <K extends keyof Draft["specs"]>(key: K, value: Draft["specs"][K]) =>
    setDraft((d) => ({ ...d, specs: { ...d.specs, [key]: value } }));

  const payload = useMemo(
    () => ({
      title: draft.title,
      property_type: draft.property_type,
      operation: draft.operation,
      price: draft.price ? Number(draft.price) : 0,
      currency: draft.currency,
      country: draft.country,
      city: draft.city,
      location: draft.location || undefined,
      address_line: draft.address_line || undefined,
      address_private: draft.address_private,
      summary: draft.summary || undefined,
      specs: {
        usable_area_m2: draft.specs.usable_area_m2 || null,
        plot_area_m2: draft.specs.plot_area_m2 || null,
        bedrooms: draft.specs.bedrooms === "" ? null : Number(draft.specs.bedrooms),
        bathrooms: draft.specs.bathrooms === "" ? null : Number(draft.specs.bathrooms),
        parking: draft.specs.parking === "" ? null : Number(draft.specs.parking),
        typology: draft.specs.typology || undefined,
        condition: draft.specs.condition || undefined,
        year_built: draft.specs.year_built || null,
        energy_rating: draft.specs.energy_rating || undefined,
        amenities: draft.specs.amenities,
        features: draft.specs.features,
        views: draft.specs.views,
      },
      mediaIds: media.map((m) => m.id),
      tasks,
    }),
    [draft, media, tasks],
  );

  const stepValid = useMemo(() => {
    if (step === 0)
      return (
        draft.title.trim().length >= 3 &&
        draft.city.trim().length >= 2 &&
        draft.country.trim().length >= 2 &&
        Number(draft.price) >= 0 &&
        draft.price !== ""
      );
    if (step === 1) return true;
    if (step === 2) return media.length > 0;
    if (step === 3) return Boolean(verification);
    if (step === 4) return confirm;
    return true;
  }, [step, draft, media, verification, confirm]);

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      Array.from(files)
        .slice(0, 12)
        .forEach((file) => form.append("files", file));
      const res = await fetch("/api/media", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no envio.");
      const created: StageMedia[] = data.items;
      setMedia((prev) => [...prev, ...created]);
      if (!primaryId && created[0]) setPrimaryId(created[0].id);
      push({ kind: "success", title: `${created.length} ficheiro(s) enviados`, description: "Ficam por associar até criar o imóvel." });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function updateMedia(id: string, patch: Record<string, unknown>) {
    setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, ...(patch as Partial<StageMedia>) } : m)));
    const res = await fetch(`/api/media/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) push({ kind: "error", title: "Não foi possível atualizar a imagem" });
  }

  async function removeMedia(id: string) {
    setMedia((prev) => prev.filter((m) => m.id !== id));
    if (primaryId === id) setPrimaryId(null);
    await fetch(`/api/media/${id}`, { method: "DELETE" });
  }

  async function verify() {
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch("/api/properties/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível verificar.");
      setVerification(data);
      setStep(3);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  async function applySuggestions() {
    if (!verification?.mediaSuggestions) return;
    let applied = 0;
    for (const suggestion of verification.mediaSuggestions) {
      if (suggestion.suggested_room) {
        const target = media.find((m) => m.id === suggestion.media_id);
        if (target && !target.room) {
          await updateMedia(suggestion.media_id, { room: suggestion.suggested_room });
          applied += 1;
        }
      }
    }
    push({
      kind: "success",
      title: applied ? `${applied} sugestão(ões) aplicadas` : "Nada a aplicar",
      description: "Reveja cada classificação — continua a ser uma sugestão sua, não um facto da IA.",
    });
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível criar o imóvel.");
      if (primaryId) {
        await fetch(`/api/media/${primaryId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ is_primary: true, property_id: data.property.id }),
        });
      }
      localStorage.removeItem(LOCAL_KEY);
      push({ kind: "success", title: "Imóvel criado", description: "As tarefas de produção foram colocadas em fila." });
      router.push(`/app/properties/${data.property.id}?tab=ai`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  const fieldError = (name: string) => undefined;

  return (
    <div className="mx-auto max-w-[1080px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Property ingestion engine</p>
          <h1 className="mt-2 text-[26px] font-light">Introduzir um imóvel</h1>
          <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-graphite-dim">
            Cinco etapas. Nenhum dado é publicado sem revisão. Campos desconhecidos permanecem vazios — não são
            preenchidos por suposição.
          </p>
        </div>
        {restored ? (
          <p className="flex items-center gap-1.5 text-[10.5px] text-graphite-dim">
            <Info size={11} /> Rascunho local restaurado neste dispositivo
          </p>
        ) : null}
      </div>

      <ol className="mt-8 hidden grid-cols-5 gap-px border-t border-obsidian/10 pt-4 sm:grid">
        {STEPS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              onClick={() => index <= step && setStep(index)}
              className={clsx("flex w-full items-center gap-2 text-left text-[11.5px]", index <= step ? "text-obsidian" : "text-graphite-dim")}
            >
              <span
                className={clsx(
                  "flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[9px]",
                  index < step
                    ? "border-forest bg-forest text-porcelain"
                    : index === step
                      ? "border-obsidian bg-obsidian text-porcelain"
                      : "border-obsidian/20",
                )}
              >
                {index < step ? <Check size={10} /> : index + 1}
              </span>
              {label}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-6 border border-obsidian/10 bg-white p-5 sm:p-8">
        {step === 0 ? (
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="title">Título interno *</label>
              <input
                id="title"
                className="input-boxed"
                value={draft.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Ex.: Villa Atlântica — Cascais"
                maxLength={160}
                autoFocus
              />
              <p className="field-hint">Visível apenas no workspace. O título comercial é gerado a partir deste.</p>
            </div>
            <div>
              <label className="field-label" htmlFor="type">Tipo de imóvel</label>
              <select id="type" className="select-boxed" value={draft.property_type} onChange={(e) => set("property_type", e.target.value)}>
                {PROPERTY_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <span className="field-label">Operação</span>
              <div className="flex gap-2">
                {(["sale", "rent"] as const).map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => set("operation", op)}
                    className={clsx(
                      "flex-1 border px-3 py-2 text-[12px] transition",
                      draft.operation === op ? "border-obsidian bg-obsidian text-porcelain" : "border-obsidian/15 text-graphite hover:border-obsidian/40",
                    )}
                  >
                    {op === "sale" ? "Venda" : "Arrendamento"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="field-label" htmlFor="price">
                {draft.operation === "sale" ? "Preço de venda *" : "Renda mensal *"}
              </label>
              <div className="flex gap-2">
                <input
                  id="price"
                  type="number"
                  min={0}
                  step={500}
                  className="input-boxed flex-1"
                  value={draft.price}
                  onChange={(e) => set("price", e.target.value)}
                  placeholder="0"
                />
                <select className="select-boxed w-24" value={draft.currency} onChange={(e) => set("currency", e.target.value)}>
                  {["EUR", "USD", "GBP", "CHF", "BRL"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              {draft.price ? <p className="field-hint">{money(Number(draft.price) * 100, draft.currency)}</p> : null}
            </div>
            <div />
            <div>
              <label className="field-label" htmlFor="country">País *</label>
              <input id="country" className="input-boxed" value={draft.country} onChange={(e) => set("country", e.target.value)} />
            </div>
            <div>
              <label className="field-label" htmlFor="city">Cidade *</label>
              <input id="city" className="input-boxed" value={draft.city} onChange={(e) => set("city", e.target.value)} placeholder="Cascais" />
            </div>
            <div>
              <label className="field-label" htmlFor="location">Zona / freguesia</label>
              <input id="location" className="input-boxed" value={draft.location} onChange={(e) => set("location", e.target.value)} placeholder="Guia" />
            </div>
            <div>
              <label className="field-label" htmlFor="address">Morada completa</label>
              <input id="address" className="input-boxed" value={draft.address_line} onChange={(e) => set("address_line", e.target.value)} placeholder="Opcional" />
            </div>
            <label className="flex items-start gap-2.5 sm:col-span-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-obsidian"
                checked={draft.address_private}
                onChange={(e) => set("address_private", e.target.checked)}
              />
              <span className="text-[11.5px] leading-relaxed text-graphite">
                Manter a morada privada. A localização pública usa apenas cidade/zona; a morada nunca é exposta
                automaticamente.
              </span>
            </label>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {[
              ["usable_area_m2", "Área útil (m²)"],
              ["plot_area_m2", "Área do terreno (m²)"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="field-label" htmlFor={key}>{label}</label>
                <input
                  id={key}
                  type="number"
                  min={0}
                  className="input-boxed"
                  value={(draft.specs as any)[key]}
                  onChange={(e) => setSpec(key as any, e.target.value)}
                />
              </div>
            ))}
            {[
              ["bedrooms", "Quartos"],
              ["bathrooms", "Casas de banho"],
              ["parking", "Estacionamento"],
              ["year_built", "Ano de construção"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="field-label" htmlFor={key}>{label}</label>
                <input
                  id={key}
                  type="number"
                  min={0}
                  className="input-boxed"
                  value={(draft.specs as any)[key]}
                  onChange={(e) => setSpec(key as any, e.target.value)}
                />
              </div>
            ))}
            <div>
              <label className="field-label" htmlFor="typology">Tipologia</label>
              <input id="typology" className="input-boxed" value={draft.specs.typology} onChange={(e) => setSpec("typology", e.target.value)} placeholder="T4" />
            </div>
            <div>
              <label className="field-label" htmlFor="condition">Estado de conservação</label>
              <select id="condition" className="select-boxed" value={draft.specs.condition} onChange={(e) => setSpec("condition", e.target.value)}>
                <option value="">Não indicado</option>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="energy">Eficiência energética</label>
              <select id="energy" className="select-boxed" value={draft.specs.energy_rating} onChange={(e) => setSpec("energy_rating", e.target.value)}>
                <option value="">Não disponível</option>
                {ENERGY.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <span className="field-label">Comodidades</span>
              <div className="flex flex-wrap gap-1.5">
                {AMENITY_SUGGESTIONS.map((amenity) => {
                  const active = draft.specs.amenities.includes(amenity);
                  return (
                    <button
                      key={amenity}
                      type="button"
                      onClick={() =>
                        setSpec(
                          "amenities",
                          active ? draft.specs.amenities.filter((a) => a !== amenity) : [...draft.specs.amenities, amenity],
                        )
                      }
                      className={clsx(
                        "rounded-full border px-2.5 py-1 text-[11px] transition",
                        active ? "border-forest bg-forest text-porcelain" : "border-obsidian/15 text-graphite hover:border-obsidian/40",
                      )}
                    >
                      {amenity}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="sm:col-span-2">
              <span className="field-label">Vistas confirmadas</span>
              <div className="flex flex-wrap gap-1.5">
                {VIEW_OPTIONS.map((view) => {
                  const active = draft.specs.views.includes(view);
                  return (
                    <button
                      key={view}
                      type="button"
                      onClick={() =>
                        setSpec("views", active ? draft.specs.views.filter((v) => v !== view) : [...draft.specs.views, view])
                      }
                      className={clsx(
                        "rounded-full border px-2.5 py-1 text-[11px] transition",
                        active ? "border-champagne-deep bg-champagne/20 text-obsidian" : "border-obsidian/15 text-graphite hover:border-obsidian/40",
                      )}
                    >
                      {view}
                    </button>
                  );
                })}
              </div>
              <p className="field-hint">Introduza apenas vistas que consegue confirmar. Sem confirmação, o campo fica oculto na página pública.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="features">Características especiais</label>
              <textarea
                id="features"
                className="input-boxed min-h-[80px]"
                value={draft.specs.features.join("\n")}
                onChange={(e) => setSpec("features", e.target.value.split("\n").map((l) => l.trim()).filter(Boolean))}
                placeholder={"Uma por linha. Ex.:\nPé-direito duplo na sala\nCozinha equipada em carvalho"}
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void uploadFiles(e.dataTransfer.files);
              }}
              onClick={() => fileInput.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && fileInput.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-obsidian/20 px-6 py-10 text-center transition hover:border-obsidian/50 hover:bg-obsidian/[0.015]"
            >
              {uploading ? <Loader2 className="animate-spin text-champagne-deep" size={22} /> : <Upload size={22} className="text-graphite-dim" />}
              <p className="text-[13px] font-medium">Arraste fotografias, plantas ou documentos</p>
              <p className="text-[11px] text-graphite-dim">JPG, PNG, WEBP, AVIF, PDF, DOC até 8–12 MB por ficheiro</p>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/avif,application/pdf,video/mp4,video/webm"
                className="hidden"
                onChange={(e) => uploadFiles(e.target.files)}
              />
            </div>

            {media.length ? (
              <>
                <div className="mt-6 flex items-center justify-between border-b border-obsidian/10 pb-2">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-graphite-dim">{media.length} ficheiros</p>
                  <p className="text-[10.5px] text-graphite-dim">A estrela define a imagem principal</p>
                </div>
                <ul className="divide-y divide-obsidian/[0.07]">
                  {media.map((item) => (
                    <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="relative h-14 w-20 shrink-0 overflow-hidden bg-stone-soft">
                        <Image src={item.public_path || `/api/media/${item.id}/file`} alt="" fill sizes="80px" className="object-cover" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <input
                          value={item.caption ?? ""}
                          onChange={(e) => setMedia((prev) => prev.map((m) => (m.id === item.id ? { ...m, caption: e.target.value } : m)))}
                          onBlur={(e) => void updateMedia(item.id, { caption: e.target.value || null })}
                          placeholder="Legenda opcional"
                          className="w-full border-0 border-b border-transparent bg-transparent py-1 text-[12px] focus:border-obsidian/30 focus:outline-none"
                        />
                        <span className="text-[10px] text-graphite-dim">{item.file_name}</span>
                      </span>
                      <select
                        className="select-boxed w-36 py-1.5 text-[11px]"
                        value={item.room ?? ""}
                        onChange={(e) => void updateMedia(item.id, { room: e.target.value || null })}
                      >
                        <option value="">Divisão…</option>
                        {ROOM_OPTIONS.map((room) => <option key={room}>{room}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => setPrimaryId(item.id)}
                        aria-label="Definir imagem principal"
                        className={clsx("rounded-full p-1.5 transition", primaryId === item.id ? "text-champagne-deep" : "text-graphite-dim hover:text-obsidian")}
                      >
                        <Star size={15} fill={primaryId === item.id ? "currentColor" : "none"} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeMedia(item.id)}
                        aria-label="Remover ficheiro"
                        className="rounded-full p-1.5 text-graphite-dim transition hover:text-red-800"
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-5 flex items-center gap-2 text-[11.5px] text-graphite-dim">
                <ImagePlus size={13} /> Sem ficheiros. É necessário pelo menos uma fotografia para publicar a
                experiência, mas pode continuar e adicionar mais tarde.
              </p>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-6">
            <div className="flex items-start gap-3 border border-champagne/40 bg-champagne/[0.07] px-4 py-3">
              <Sparkles size={15} className="mt-0.5 shrink-0 text-champagne-deep" />
              <div>
                <p className="text-[12.5px] font-medium">Verificação assistida — pré-visualização</p>
                <p className="mt-1 text-[11px] leading-relaxed text-graphite">
                  {verification?.disclaimer}
                </p>
                <p className="mt-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-graphite-dim">
                  Motor: {verification?.provider?.label} · {verification?.provider?.mode === "deterministic" ? "determinístico" : "modelo"}
                </p>
              </div>
            </div>

            {verification?.issues?.length ? (
              <div>
                <p className="text-[11px] uppercase tracking-[0.12em] text-graphite-dim">Observações</p>
                <ul className="mt-2 divide-y divide-obsidian/[0.07]">
                  {verification.issues.map((issue: any, index: number) => (
                    <li key={index} className="flex items-start gap-2.5 py-2">
                      {issue.level === "error" ? (
                        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-red-800" />
                      ) : issue.level === "warning" ? (
                        <AlertTriangle size={13} className="mt-0.5 shrink-0 text-champagne-deep" />
                      ) : (
                        <Info size={13} className="mt-0.5 shrink-0 text-graphite-dim" />
                      )}
                      <span className="flex-1 text-[12px] text-graphite">{issue.message}</span>
                      <span className="font-mono text-[9.5px] uppercase text-graphite-dim">{issue.field}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="border-t border-obsidian/10 pt-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-graphite-dim">Estado da informação</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.08em]">
                <span className="rounded-full bg-forest/10 px-2 py-0.5 text-forest">Confirmado · ficha do imóvel</span>
                <span className="rounded-full bg-champagne/25 px-2 py-0.5 text-champagne-deep">
                  Sugerido · requer confirmação
                </span>
                <span className="rounded-full bg-obsidian/[0.06] px-2 py-0.5 text-graphite-dim">Desconhecido · em falta</span>
              </div>
              {(verification?.missing ?? []).length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(verification?.missing ?? []).map((item: string) => (
                    <span key={item} className="rounded-full border border-obsidian/15 px-2 py-0.5 text-[10px] text-graphite-dim">
                      {item}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[10.5px] text-forest">Nenhum campo obrigatório em falta.</p>
              )}
            </div>

            {verification?.mediaSuggestions?.length ? (
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-graphite-dim">Classificação sugerida de imagens</p>
                  <button type="button" onClick={applySuggestions} className="btn btn-sm btn-outline">
                    Aplicar sugestões
                  </button>
                </div>
                <ul className="mt-2 divide-y divide-obsidian/[0.07]">
                  {verification.mediaSuggestions.map((s: any, i: number) => (
                    <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12px]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] text-graphite-dim">{s.file_name}</span>
                        <span className="text-graphite">{s.suggested_room ?? "Sem sugestão"}</span>
                      </span>
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-graphite-dim">
                        {s.confidence} · pendente
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="field-hint">Sugestões por palavras-chave. Não existe análise visual por modelo configurado.</p>
              </div>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="border border-obsidian/10 bg-porcelain p-4">
                <p className="text-[10.5px] uppercase tracking-[0.12em] text-graphite-dim">Rascunho de listagem</p>
                <h3 className="mt-2 text-[15px] font-medium">{verification?.preview?.title}</h3>
                <p className="mt-1 text-[11.5px] text-graphite">{verification?.preview?.summary}</p>
                <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1 text-[12px] leading-relaxed text-graphite scrollbar-thin">
                  {String(verification?.preview?.body ?? "").split("\n\n").map((para: string, i: number) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>
                <p className="mt-3 border-t border-obsidian/10 pt-2 text-[10px] text-graphite-dim">
                  Será guardado como rascunho. Requer aprovação antes de aparecer na página pública.
                </p>
              </div>
              <div className="border border-obsidian/10 p-4">
                <p className="text-[10.5px] uppercase tracking-[0.12em] text-graphite-dim">FAQ fundamentada</p>
                <ul className="mt-2 space-y-2">
                  {(verification?.faq ?? []).slice(0, 5).map((item: any, i: number) => (
                    <li key={i} className="border-b border-obsidian/[0.07] pb-2 text-[11.5px]">
                      <p className="font-medium text-obsidian">{item.q}</p>
                      <p className={item.known ? "text-graphite" : "text-graphite-dim"}>{item.a}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-graphite-dim">Resumo</p>
              <dl className="mt-2 divide-y divide-obsidian/[0.07]">
                {[
                  ["Título", draft.title],
                  ["Tipo", PROPERTY_TYPES.find((t) => t.value === draft.property_type)?.label],
                  ["Operação", draft.operation === "sale" ? "Venda" : "Arrendamento"],
                  ["Preço", draft.price ? money(Number(draft.price) * 100, draft.currency) : "Não definido"],
                  ["Localização", [draft.location, draft.city, draft.country].filter(Boolean).join(", ")],
                  ["Área útil", draft.specs.usable_area_m2 ? `${draft.specs.usable_area_m2} m²` : "Não registada"],
                  ["Quartos / WC", `${draft.specs.bedrooms || "—"} / ${draft.specs.bathrooms || "—"}`],
                  ["Ficheiros", `${media.length}`],
                ].map(([label, value]) => (
                  <div key={label as string} className="flex items-baseline justify-between gap-4 py-2">
                    <dt className="text-[11px] uppercase tracking-[0.1em] text-graphite-dim">{label}</dt>
                    <dd className="text-right text-[12.5px]">{value || "—"}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-graphite-dim">
                <Info size={12} className="mt-0.5 shrink-0" />
                A criação do imóvel não publica nada. A página pública só é criada quando publicar a experiência.
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-graphite-dim">Tarefas a iniciar</p>
              <ul className="mt-2 space-y-1.5">
                {TASKS.map((task) => (
                  <li key={task.id}>
                    <label className="flex cursor-pointer items-start gap-2.5 text-[12px]">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5 accent-obsidian"
                        checked={tasks.includes(task.id)}
                        onChange={(e) =>
                          setTasks((prev) => (e.target.checked ? [...prev, task.id] : prev.filter((t) => t !== task.id)))
                        }
                      />
                      {task.label}
                    </label>
                  </li>
                ))}
              </ul>
              <label className="mt-5 flex cursor-pointer items-start gap-2.5 border-t border-obsidian/10 pt-4 text-[11.5px] leading-relaxed">
                <input type="checkbox" className="mt-0.5 h-4 w-4 accent-obsidian" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
                <span>
                  Confirmo que os dados introduzidos correspondem à informação verificada do imóvel e que tenho
                  autorização para utilizar os ficheiros carregados.
                </span>
              </label>
            </div>
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-5 border-l-2 border-red-800 bg-red-900/[0.04] px-3 py-2 text-[12px] text-red-900">
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-obsidian/10 pt-5">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="btn btn-sm btn-ghost">
            <ArrowLeft size={13} /> Voltar
          </button>
          <div className="flex items-center gap-2">
            <span className="mr-2 hidden text-[10.5px] text-graphite-dim sm:block">Etapa {step + 1} de 5</span>
            {step < 2 ? (
              <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!stepValid} className="btn btn-sm btn-primary">
                Continuar <ArrowRight size={13} />
              </button>
            ) : step === 2 ? (
              <button type="button" onClick={verify} disabled={verifying || media.length === 0} className="btn btn-sm btn-primary">
                {verifying ? <Spinner /> : <Sparkles size={13} />} Verificar com IA <ArrowRight size={13} />
              </button>
            ) : step === 3 ? (
              <button type="button" onClick={() => setStep(4)} className="btn btn-sm btn-primary">
                Rever e criar <ArrowRight size={13} />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={!confirm || submitting} className="btn btn-sm btn-primary">
                {submitting ? <Spinner /> : <CheckCircle2 size={13} />} Criar imóvel e iniciar produção
              </button>
            )}
          </div>
        </div>
      </div>

      {fieldError("title")}
    </div>
  );
}
