"use client";

import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Eye, EyeOff, FileText, Search, Star, Trash2, Upload } from "lucide-react";
import { useToast, Modal, Spinner } from "@/components/ui/client";
import { ROOM_OPTIONS } from "@/lib/labels";
import { relativeTime } from "@/lib/format";
import { mediaUrl } from "@/lib/media-url";

type MediaItem = {
  id: string;
  property_id: string | null;
  property_title?: string | null;
  file_name: string;
  public_path: string | null;
  mime_type: string;
  size_bytes: number;
  kind: string;
  room: string | null;
  caption: string | null;
  is_primary: number;
  is_public: number;
  status: string;
  created_at: string;
};

export function MediaLibrary({
  initialMedia,
  properties,
  canEdit,
}: {
  initialMedia: MediaItem[];
  properties: { id: string; label: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [items, setItems] = useState(initialMedia);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("all");
  const [propertyId, setPropertyId] = useState("all");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [targetProperty, setTargetProperty] = useState(properties[0]?.id ?? "");
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false;
      if (status !== "all" && item.status !== status) return false;
      if (propertyId !== "all" && item.property_id !== propertyId) return false;
      if (!q) return true;
      return [item.file_name, item.caption, item.room, item.property_title]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [items, query, kind, status, propertyId]);

  async function patch(id: string, body: Record<string, unknown>, message?: string) {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...(body as Partial<MediaItem>) } : m)));
    const res = await fetch(`/api/media/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      push({ kind: "error", title: "Ação não concluída", description: data.error });
      router.refresh();
      return;
    }
    if (message) push({ kind: "success", title: message });
    router.refresh();
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append("files", file));
      if (targetProperty) form.append("propertyId", targetProperty);
      const res = await fetch("/api/media", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no envio.");
      setItems((prev) => [...data.items, ...prev]);
      push({ kind: "success", title: `${data.items.length} ficheiro(s) carregados`, description: "Ficam pendentes até aprovação." });
      setUploadOpen(false);
      router.refresh();
    } catch (e) {
      push({ kind: "error", title: "Falha no envio", description: (e as Error).message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: string) {
    if (!confirm("Eliminar este ficheiro? A ação é irreversível.")) return;
    const res = await fetch(`/api/media/${id}`, { method: "DELETE" });
    if (!res.ok) {
      push({ kind: "error", title: "Não foi possível eliminar" });
      return;
    }
    setItems((prev) => prev.filter((m) => m.id !== id));
    setPreview(null);
    push({ kind: "success", title: "Ficheiro eliminado" });
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-obsidian/10 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 border-b border-obsidian/20 pb-1 text-graphite-dim focus-within:border-obsidian/50">
            <Search size={13} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar ficheiros"
              className="w-44 bg-transparent text-[12px] text-obsidian placeholder:text-graphite-dim/70 focus:outline-none"
            />
          </label>
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="select-boxed w-32 py-1.5 text-[11px]">
            <option value="all">Todos os tipos</option>
            <option value="photo">Fotografia</option>
            <option value="floorplan">Planta</option>
            <option value="document">Documento</option>
            <option value="video">Vídeo</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="select-boxed w-32 py-1.5 text-[11px]">
            <option value="all">Todos os estados</option>
            <option value="pending">Pendente</option>
            <option value="approved">Aprovado</option>
            <option value="rejected">Rejeitado</option>
          </select>
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className="select-boxed w-44 py-1.5 text-[11px]">
            <option value="all">Todos os imóveis</option>
            <option value="none">Sem imóvel</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        {canEdit ? (
          <button onClick={() => setUploadOpen(true)} className="btn btn-sm btn-primary">
            <Upload size={12} /> Carregar
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-6 border border-dashed border-obsidian/15 px-6 py-10 text-center text-[12px] text-graphite-dim">
          Sem ficheiros para estes filtros. Formatos aceites: JPG, PNG, WEBP, AVIF, PDF, MP4/WEBM.
        </p>
      ) : (
        <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((item) => (
            <li key={item.id} className="group border border-obsidian/10 bg-white">
              <button onClick={() => setPreview(item)} className="relative block aspect-[4/3] w-full overflow-hidden bg-stone-soft">
                {item.mime_type.startsWith("image/") ? (
                  <Image src={mediaUrl(item)} alt={item.caption ?? item.file_name} fill sizes="(max-width: 640px) 50vw, 20vw" className="object-cover transition duration-500 group-hover:scale-[1.03]" />
                ) : (
                  <span className="flex h-full items-center justify-center"><FileText size={20} className="text-graphite-dim" /></span>
                )}
                <span
                  className={clsx(
                    "absolute left-2 top-2 rounded-full px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.08em]",
                    item.status === "approved" ? "bg-forest text-porcelain" : item.status === "rejected" ? "bg-red-900 text-porcelain" : "bg-obsidian/70 text-porcelain",
                  )}
                >
                  {item.status}
                </span>
                {item.is_public ? (
                  <span className="absolute right-2 top-2 rounded-full bg-porcelain/90 px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.08em] text-forest">pública</span>
                ) : null}
                {item.is_primary ? <span className="absolute bottom-2 left-2 rounded-full bg-champagne px-1.5 py-0.5 text-[8.5px] uppercase tracking-[0.08em]">principal</span> : null}
              </button>
              <div className="p-2.5">
                <p className="truncate text-[11.5px] font-medium">{item.caption ?? item.file_name}</p>
                <p className="mt-0.5 truncate text-[9.5px] text-graphite-dim">
                  {item.property_title ?? "Sem imóvel"} · {item.room ?? "sem divisão"}
                </p>
                <div className="mt-2 flex items-center justify-between border-t border-obsidian/[0.07] pt-1.5">
                  <span className="text-[9px] text-graphite-dim">{relativeTime(item.created_at)}</span>
                  {canEdit ? (
                    <div className="flex gap-1">
                      <button onClick={() => patch(item.id, { is_primary: true }, "Imagem principal definida")} aria-label="Principal" className={clsx("rounded p-0.5", item.is_primary ? "text-champagne-deep" : "text-graphite-dim hover:text-obsidian")}>
                        <Star size={11} fill={item.is_primary ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() =>
                          item.is_public
                            ? patch(item.id, { is_public: false }, "Removida da publicação")
                            : patch(item.id, { is_public: true, status: "approved" }, "Aprovada e publicada")
                        }
                        aria-label="Publicar"
                        className={clsx("rounded p-0.5", item.is_public ? "text-forest" : "text-graphite-dim hover:text-forest")}
                      >
                        {item.is_public ? <Eye size={11} /> : <EyeOff size={11} />}
                      </button>
                      <button onClick={() => remove(item.id)} aria-label="Eliminar" className="rounded p-0.5 text-graphite-dim hover:text-red-800">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Carregar media" description="Ficheiros ficam pendentes e privados até serem aprovados e associados.">
        <label className="field-label" htmlFor="upload-property">Associar a imóvel</label>
        <select id="upload-property" className="select-boxed" value={targetProperty} onChange={(e) => setTargetProperty(e.target.value)}>
          <option value="">Sem imóvel (staging)</option>
          {properties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <input ref={fileRef} type="file" multiple className="mt-4 block w-full text-[11px] file:mr-3 file:border file:border-obsidian/20 file:bg-transparent file:px-3 file:py-1.5 file:text-[11px]" accept="image/jpeg,image/png,image/webp,image/avif,application/pdf,video/mp4,video/webm" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setUploadOpen(false)} className="btn btn-sm btn-ghost">Cancelar</button>
          <button onClick={() => upload(fileRef.current?.files ?? null)} disabled={uploading} className="btn btn-sm btn-primary">
            {uploading ? <Spinner /> : <Upload size={12} />} Enviar
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.caption ?? preview?.file_name ?? ""} description={preview?.property_title ?? "Sem imóvel associado"} size="lg">
        {preview ? (
          <div className="space-y-4">
            {preview.mime_type.startsWith("image/") ? (
              <div className="relative aspect-[16/10] overflow-hidden bg-stone-soft">
                <Image src={mediaUrl(preview)} alt={preview.caption ?? preview.file_name} fill sizes="80vw" className="object-contain" />
              </div>
            ) : (
              <a href={preview.public_path ?? `/api/media/${preview.id}/file`} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline">
                <FileText size={12} /> Abrir ficheiro
              </a>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label">Legenda</label>
                <input className="input-boxed" defaultValue={preview.caption ?? ""} onBlur={(e) => e.target.value !== (preview.caption ?? "") && patch(preview.id, { caption: e.target.value || null })} />
              </div>
              <div>
                <label className="field-label">Divisão</label>
                <select className="select-boxed" value={preview.room ?? ""} onChange={(e) => patch(preview.id, { room: e.target.value || null })}>
                  <option value="">Sem divisão</option>
                  {ROOM_OPTIONS.map((room) => <option key={room}>{room}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Estado</label>
                <select className="select-boxed" value={preview.status} onChange={(e) => patch(preview.id, { status: e.target.value })}>
                  <option value="pending">Pendente</option>
                  <option value="approved">Aprovado</option>
                  <option value="rejected">Rejeitado</option>
                </select>
              </div>
              <div>
                <label className="field-label">Imóvel</label>
                <select className="select-boxed" value={preview.property_id ?? ""} onChange={(e) => patch(preview.id, { property_id: e.target.value || null })}>
                  <option value="">Sem imóvel</option>
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
