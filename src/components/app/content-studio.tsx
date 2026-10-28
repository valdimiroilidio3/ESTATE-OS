"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  Download,
  Loader2,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useToast, Modal, Spinner, CopyButton } from "@/components/ui/client";
import { JOB_STATUS, TASK_LABELS } from "@/lib/labels";
import { relativeTime } from "@/lib/format";
import type { ContentRecord, Job } from "@/lib/types";

const MODULES = [
  {
    id: "generate_listing",
    title: "AI Listing Writer",
    description: "Título, descrição, resumo, características, meta title e meta description.",
    locales: true,
    cta: "Gerar listagem",
  },
  {
    id: "generate_multilingual",
    title: "Versões multilingues",
    description: "Versões em português e inglês a partir dos mesmos factos confirmados.",
    locales: false,
    cta: "Gerar PT + EN",
  },
  {
    id: "generate_audience_versions",
    title: "Audience Adaptation",
    description: "Nacional, internacional, espaço, investidores e posicionamento premium.",
    locales: false,
    cta: "Gerar 5 versões",
  },
  {
    id: "generate_campaign",
    title: "Campaign Generator",
    description: "Instagram, anúncios, email, WhatsApp, argumentos, FAQ e guião de vídeo.",
    locales: true,
    cta: "Gerar campanha",
  },
  {
    id: "generate_media_brief",
    title: "Cinematic Media Brief",
    description: "Sequência de planos, câmara, luz, ambiente e formatos de saída.",
    locales: true,
    cta: "Gerar briefing",
  },
  {
    id: "analyze_media",
    title: "Análise de media",
    description: "Sugestões de divisão e verificação de ficheiros — requerem confirmação.",
    locales: false,
    cta: "Analisar ficheiros",
  },
] as const;

const KIND_LABEL: Record<string, string> = {
  listing: "Listagem",
  audience: "Audiência",
  campaign: "Campanha",
  media_brief: "Briefing de vídeo",
};

const VARIANT_LABEL: Record<string, string> = {
  national: "Nacional",
  international: "Internacional",
  families: "Espaço",
  investors: "Investidores",
  luxury: "Premium",
  default: "Principal",
};

type Provider = { id: string; label: string; configured: boolean; mode: string; note: string; model?: string };

export function ContentStudio({
  propertyId,
  initialContent,
  initialJobs,
  provider,
  readOnly,
}: {
  propertyId: string;
  initialContent: ContentRecord[];
  initialJobs: Job[];
  provider: Provider;
  readOnly: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [content, setContent] = useState(initialContent);
  const [jobs, setJobs] = useState(initialJobs);
  const [locale, setLocale] = useState<"pt" | "en">("pt");
  const [busyModule, setBusyModule] = useState<string | null>(null);
  const [editing, setEditing] = useState<ContentRecord | null>(null);
  const [draft, setDraft] = useState<{ title: string; body: string; payload: Record<string, unknown> }>({
    title: "",
    body: "",
    payload: {},
  });
  const [saving, setSaving] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState(false);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeJobs = jobs.filter((j) => j.status === "queued" || j.status === "processing");

  const reloadContent = useCallback(async () => {
    const res = await fetch(`/api/properties/${propertyId}/content`);
    if (!res.ok) return;
    const data = await res.json();
    setContent(data.items);
  }, [propertyId]);

  const poll = useCallback(async () => {
    const res = await fetch(`/api/jobs?propertyId=${propertyId}`);
    if (!res.ok) return;
    const data = await res.json();
    setJobs(data.items);
    const hasActive = data.items.some((j: Job) => j.status === "queued" || j.status === "processing");
    if (!hasActive) {
      if (polling.current) {
        clearInterval(polling.current);
        polling.current = null;
      }
      await reloadContent();
      router.refresh();
    }
  }, [propertyId, reloadContent, router]);

  useEffect(() => {
    if (activeJobs.length && !polling.current) {
      polling.current = setInterval(poll, 2500);
    }
    return () => {
      if (polling.current) {
        clearInterval(polling.current);
        polling.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeJobs.length]);

  async function launch(taskType: string) {
    setBusyModule(taskType);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          property_id: propertyId,
          task_type: taskType,
          locale,
          input: { locale },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível iniciar a tarefa.");
      push({ kind: "success", title: "Tarefa em fila", description: "Pode continuar a trabalhar. O estado atualiza automaticamente." });
      const refreshed = await fetch(`/api/jobs?propertyId=${propertyId}`);
      if (refreshed.ok) {
        const payload = await refreshed.json();
        setJobs(payload.items);
      }
    } catch (e) {
      push({ kind: "error", title: "Tarefa não iniciada", description: (e as Error).message });
    } finally {
      setBusyModule(null);
    }
  }

  async function retry(id: string) {
    const res = await fetch(`/api/jobs/${id}/retry`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json();
      push({ kind: "error", title: "Não foi possível repetir", description: data.error });
      return;
    }
    push({ kind: "info", title: "Tarefa recolocada em fila" });
    await poll();
  }

  function openEditor(item: ContentRecord) {
    setEditing(item);
    setDraft({ title: item.title ?? "", body: item.body ?? "", payload: { ...item.payload } });
  }

  async function saveContent(status?: "approved" | "draft" | "archived") {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/content/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...draft, ...(status ? { status } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível guardar.");
      setContent((prev) => prev.map((c) => (c.id === data.content.id ? data.content : c)));
      setEditing(null);
      push({ kind: "success", title: status === "approved" ? "Conteúdo aprovado" : "Conteúdo atualizado" });
      router.refresh();
    } catch (e) {
      push({ kind: "error", title: "Falha ao guardar", description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: ContentRecord) {
    if (!confirm("Eliminar este conteúdo?")) return;
    const res = await fetch(`/api/content/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      setContent((prev) => prev.filter((c) => c.id !== item.id));
      push({ kind: "success", title: "Conteúdo eliminado" });
      router.refresh();
    }
  }

  function download(item: ContentRecord) {
    const text = [
      `# ${item.title ?? ""}`,
      `(${KIND_LABEL[item.kind] ?? item.kind} · ${item.locale.toUpperCase()} · ${item.provider})`,
      "",
      item.body ?? "",
      "",
      ...Object.entries(item.payload)
        .filter(([, v]) => typeof v === "string")
        .map(([k, v]) => `## ${k}\n${v as string}`),
    ].join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.kind}-${item.locale}-${item.id.slice(0, 6)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const grouped = useMemo(() => {
    const order = ["listing", "audience", "campaign", "media_brief"];
    return order
      .map((kind) => ({ kind, items: content.filter((c) => c.kind === kind) }))
      .filter((group) => group.items.length > 0);
  }, [content]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-obsidian/10 bg-white px-4 py-3">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-graphite">
          <Sparkles size={13} className="mt-0.5 shrink-0 text-champagne-deep" />
          <span>
            <strong className="font-medium">{provider.label}</strong> · {provider.note}
          </span>
        </p>
        <label className="flex items-center gap-2 text-[11px] text-graphite">
          Idioma base
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as "pt" | "en")}
            className="select-boxed w-24 py-1 text-[11px]"
            disabled={readOnly}
          >
            <option value="pt">Português</option>
            <option value="en">Inglês</option>
          </select>
        </label>
      </div>

      <div className="grid gap-px border border-obsidian/10 bg-obsidian/10 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((module) => (
          <div key={module.id} className="flex flex-col bg-white p-4">
            <h3 className="text-[13px] font-medium">{module.title}</h3>
            <p className="mt-1.5 flex-1 text-[11.5px] leading-relaxed text-graphite-dim">{module.description}</p>
            <button
              onClick={() => launch(module.id)}
              disabled={readOnly || busyModule !== null}
              className="btn btn-sm btn-outline mt-4 w-full"
            >
              {busyModule === module.id ? <Spinner /> : <Sparkles size={12} />} {module.cta}
            </button>
          </div>
        ))}
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-obsidian/10 pb-2">
          <h3 className="text-[12px] font-medium uppercase tracking-[0.1em] text-graphite-dim">Tarefas de produção</h3>
          <button onClick={() => setExpandedJobs((v) => !v)} className="text-[10.5px] uppercase tracking-[0.1em] text-graphite-dim hover:text-obsidian">
            {expandedJobs ? "Ver menos" : `Ver todas (${jobs.length})`}
          </button>
        </div>
        {jobs.length === 0 ? (
          <p className="mt-3 text-[11.5px] text-graphite-dim">
            Sem tarefas. Cada geração é registada com estado, tentativas, resultado e erro quando aplicável.
          </p>
        ) : (
          <ul className="mt-1 divide-y divide-obsidian/[0.07]">
            {(expandedJobs ? jobs : jobs.slice(0, 5)).map((job) => {
              const meta = JOB_STATUS[job.status];
              return (
                <li key={job.id} className="flex flex-wrap items-start gap-3 py-2.5">
                  <span className={clsx("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", meta?.dot)} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[12px] font-medium">
                      {TASK_LABELS[job.task_type] ?? job.task_type}
                      <span className={clsx("text-[10px] font-normal", meta?.tone)}>{meta?.label}</span>
                    </p>
                    <p className="mt-0.5 truncate text-[10.5px] text-graphite-dim">
                      {job.output ? String(job.output).slice(0, 160) : job.error ?? `Criada ${relativeTime(job.created_at)}`}
                    </p>
                  </div>
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-graphite-dim">
                    {job.attempts}/{job.max_attempts} tent.
                  </span>
                  {job.status === "failed" ? (
                    <button onClick={() => retry(job.id)} className="btn btn-sm btn-outline">
                      <RefreshCw size={11} /> Repetir
                    </button>
                  ) : null}
                  {job.status === "processing" || job.status === "queued" ? (
                    <Loader2 size={13} className="mt-1 animate-spin text-champagne-deep" />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {grouped.length === 0 ? (
        <div className="border border-dashed border-obsidian/15 px-6 py-10 text-center">
          <p className="text-[13px] font-medium">Ainda não existe conteúdo gerado</p>
          <p className="mx-auto mt-1.5 max-w-md text-[11.5px] leading-relaxed text-graphite-dim">
            Inicie uma tarefa acima. Os resultados ficam em rascunho até aprovação explícita — nada aparece na
            página pública sem esse passo.
          </p>
        </div>
      ) : (
        grouped.map((group) => (
          <section key={group.kind}>
            <div className="flex items-center justify-between border-b border-obsidian/10 pb-2">
              <h3 className="text-[12px] font-medium uppercase tracking-[0.1em] text-graphite-dim">
                {KIND_LABEL[group.kind] ?? group.kind}
              </h3>
              <span className="font-mono text-[9.5px] text-graphite-dim">{group.items.length} versões</span>
            </div>
            <ul className="grid gap-4 pt-4 lg:grid-cols-2">
              {group.items.map((item) => (
                <li key={item.id} className="flex flex-col border border-obsidian/10 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-graphite-dim">
                        {item.locale.toUpperCase()} · {VARIANT_LABEL[item.variant] ?? item.variant}
                      </p>
                      <h4 className="mt-1 text-[13.5px] font-medium leading-snug">{item.title ?? "Sem título"}</h4>
                    </div>
                    <span
                      className={clsx(
                        "shrink-0 rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.1em]",
                        item.status === "approved"
                          ? "bg-forest text-porcelain"
                          : item.status === "archived"
                            ? "bg-obsidian/10 text-graphite-dim"
                            : "bg-champagne/25 text-champagne-deep",
                      )}
                    >
                      {item.status === "approved" ? "aprovado" : item.status === "archived" ? "arquivado" : "rascunho"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-4 flex-1 text-[11.5px] leading-relaxed text-graphite">
                    {String(item.payload.summary ?? item.body ?? "").slice(0, 320)}
                  </p>
                  <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.08em] text-graphite-dim">
                    {item.provider} · {relativeTime(item.updated_at)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-obsidian/[0.07] pt-2.5">
                    <button onClick={() => openEditor(item)} className="btn btn-sm btn-ghost px-2">
                      <Pencil size={11} /> {item.status === "approved" ? "Ver" : "Rever"}
                    </button>
                    {item.status !== "approved" && !readOnly ? (
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/content/${item.id}`, {
                            method: "PATCH",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({ status: "approved" }),
                          });
                          if (res.ok) {
                            push({ kind: "success", title: "Conteúdo aprovado" });
                            await reloadContent();
                            router.refresh();
                          }
                        }}
                        className="btn btn-sm btn-ghost px-2 text-forest"
                      >
                        <Check size={11} /> Aprovar
                      </button>
                    ) : null}
                    <CopyButton text={[item.title, item.body].filter(Boolean).join("\n\n")} />
                    <button onClick={() => download(item)} aria-label="Descarregar" className="ml-auto text-graphite-dim transition hover:text-obsidian">
                      <Download size={13} />
                    </button>
                    {!readOnly ? (
                      <button onClick={() => remove(item)} aria-label="Eliminar" className="text-graphite-dim transition hover:text-red-800">
                        <Trash2 size={13} />
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `${KIND_LABEL[editing.kind] ?? editing.kind} · ${editing.locale.toUpperCase()}` : ""}
        description="Edite livremente. A aprovação é registada com autor e data. Alterações factuais exigem nova revisão."
        size="lg"
        footer={
          <>
            <button onClick={() => setEditing(null)} className="btn btn-sm btn-ghost">Cancelar</button>
            <button onClick={() => saveContent()} disabled={saving} className="btn btn-sm btn-outline">
              {saving ? <Spinner /> : null} Guardar rascunho
            </button>
            {editing?.status !== "approved" && !readOnly ? (
              <button onClick={() => saveContent("approved")} disabled={saving} className="btn btn-sm btn-primary">
                <Check size={13} /> Guardar e aprovar
              </button>
            ) : null}
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label" htmlFor="content-title">Título</label>
            <input
              id="content-title"
              className="input-boxed"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="content-body">Texto principal</label>
            <textarea
              id="content-body"
              className="input-boxed min-h-[260px] font-mono text-[12px] leading-relaxed"
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            />
          </div>
          {Object.entries(draft.payload)
            .filter(([, value]) => typeof value === "string" && value.length < 4000)
            .map(([key, value]) => (
              <div key={key}>
                <label className="field-label" htmlFor={`payload-${key}`}>{key}</label>
                <textarea
                  id={`payload-${key}`}
                  className="input-boxed min-h-[70px] text-[12px]"
                  value={value as string}
                  onChange={(e) => setDraft((d) => ({ ...d, payload: { ...d.payload, [key]: e.target.value } }))}
                />
              </div>
            ))}
          <details className="border-t border-obsidian/10 pt-3">
            <summary className="cursor-pointer text-[11px] uppercase tracking-[0.1em] text-graphite-dim">
              Payload estruturado (leitura)
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto bg-obsidian p-3 font-mono text-[10px] leading-relaxed text-porcelain/80">
              {JSON.stringify(draft.payload, null, 2)}
            </pre>
          </details>
        </div>
      </Modal>
    </div>
  );
}
