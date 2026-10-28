"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { ImagePlus, Loader2, Star, Trash2, Eye, EyeOff, Check, X, Upload } from "lucide-react";
import { useToast } from "@/components/ui/client";
import type { PropertyMedia } from "@/lib/types";
import { ROOM_OPTIONS } from "@/lib/labels";
import { mediaUrl } from "@/lib/media-url";

export function MediaManager({
  propertyId,
  initialMedia,
  readOnly,
}: {
  propertyId: string;
  initialMedia: PropertyMedia[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [items, setItems] = useState(initialMedia);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function patch(id: string, body: Record<string, unknown>, successMessage?: string) {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...(body as Partial<PropertyMedia>) } : m)));
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
    if (successMessage) push({ kind: "success", title: successMessage });
    router.refresh();
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      Array.from(files).forEach((file) => form.append("files", file));
      form.append("propertyId", propertyId);
      const res = await fetch("/api/media", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no envio.");
      setItems((prev) => [...prev, ...data.items]);
      push({ kind: "success", title: `${data.items.length} ficheiro(s) adicionados`, description: "Ficam pendentes até aprovação." });
      router.refresh();
    } catch (e) {
      push({ kind: "error", title: "Falha no envio", description: (e as Error).message });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    if (!confirm("Eliminar este ficheiro? A ação é irreversível.")) return;
    setItems((prev) => prev.filter((m) => m.id !== id));
    await fetch(`/api/media/${id}`, { method: "DELETE" });
    push({ kind: "success", title: "Ficheiro eliminado" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {!readOnly ? (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void upload(e.dataTransfer.files);
          }}
          className="flex items-center justify-between gap-4 border border-dashed border-obsidian/20 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            {uploading ? <Loader2 size={16} className="animate-spin text-champagne-deep" /> : <ImagePlus size={16} className="text-graphite-dim" />}
            <div>
              <p className="text-[12px] font-medium">Adicionar ficheiros ao imóvel</p>
              <p className="text-[10.5px] text-graphite-dim">Arraste ou selecione. JPG/PNG/WEBP/AVIF, PDF ou vídeo curto.</p>
            </div>
          </div>
          <button onClick={() => inputRef.current?.click()} className="btn btn-sm btn-outline" disabled={uploading}>
            <Upload size={12} /> Selecionar
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            accept="image/jpeg,image/png,image/webp,image/avif,application/pdf,video/mp4,video/webm"
            onChange={(e) => upload(e.target.files)}
          />
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className="border border-dashed border-obsidian/15 px-5 py-8 text-center text-[12px] text-graphite-dim">
          Sem ficheiros. Carregue fotografias para poder publicar a experiência.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="group border border-obsidian/10 bg-white">
              <div className="relative aspect-[4/3] bg-stone-soft">
                {item.mime_type.startsWith("image/") ? (
                  <Image src={mediaUrl(item)} alt={item.caption ?? item.file_name} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[11px] uppercase tracking-[0.12em] text-graphite-dim">
                    {item.kind}
                  </div>
                )}
                <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2">
                  <span
                    className={clsx(
                      "rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.1em]",
                      item.status === "approved"
                        ? "bg-forest text-porcelain"
                        : item.status === "rejected"
                          ? "bg-red-900 text-porcelain"
                          : "bg-obsidian/70 text-porcelain",
                    )}
                  >
                    {item.status === "approved" ? "Aprovada" : item.status === "rejected" ? "Rejeitada" : "Pendente"}
                  </span>
                  {item.is_public ? (
                    <span className="flex items-center gap-1 rounded-full bg-porcelain/90 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-forest">
                      <Eye size={9} /> pública
                    </span>
                  ) : null}
                </div>
                {item.is_primary ? (
                  <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-champagne px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-obsidian">
                    <Star size={9} fill="currentColor" /> principal
                  </span>
                ) : null}
              </div>
              <div className="space-y-2 p-3">
                <input
                  defaultValue={item.caption ?? ""}
                  disabled={readOnly}
                  placeholder="Legenda"
                  onBlur={(e) => e.target.value !== (item.caption ?? "") && void patch(item.id, { caption: e.target.value || null })}
                  className="w-full border-0 border-b border-transparent bg-transparent py-1 text-[12px] focus:border-obsidian/30 focus:outline-none disabled:opacity-60"
                />
                <div className="flex items-center gap-2">
                  <select
                    className="select-boxed flex-1 py-1 text-[11px]"
                    value={item.room ?? ""}
                    disabled={readOnly}
                    onChange={(e) => patch(item.id, { room: e.target.value || null })}
                  >
                    <option value="">Divisão…</option>
                    {ROOM_OPTIONS.map((room) => <option key={room}>{room}</option>)}
                  </select>
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-graphite-dim">{item.kind}</span>
                </div>
                {!readOnly ? (
                  <div className="flex items-center justify-between border-t border-obsidian/[0.07] pt-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => patch(item.id, { is_primary: true }, "Imagem principal definida")}
                        aria-label="Definir principal"
                        className={clsx("rounded p-1 transition", item.is_primary ? "text-champagne-deep" : "text-graphite-dim hover:text-obsidian")}
                      >
                        <Star size={13} fill={item.is_primary ? "currentColor" : "none"} />
                      </button>
                      <button
                        onClick={() =>
                          item.is_public
                            ? patch(item.id, { is_public: false }, "Imagem removida da publicação")
                            : patch(item.id, { is_public: true, status: "approved" }, "Imagem aprovada e publicada")
                        }
                        aria-label={item.is_public ? "Despublicar" : "Aprovar e publicar"}
                        className={clsx("rounded p-1 transition", item.is_public ? "text-forest" : "text-graphite-dim hover:text-forest")}
                      >
                        {item.is_public ? <Check size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button
                        onClick={() => patch(item.id, { status: "rejected", is_public: false })}
                        aria-label="Rejeitar"
                        className="rounded p-1 text-graphite-dim transition hover:text-red-800"
                      >
                        <X size={13} />
                      </button>
                    </div>
                    <button onClick={() => remove(item.id)} aria-label="Eliminar" className="rounded p-1 text-graphite-dim transition hover:text-red-800">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
