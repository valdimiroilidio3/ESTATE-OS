"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Lock, Trash2, Upload, Users } from "lucide-react";
import { useToast, Spinner } from "@/components/ui/client";
import { relativeTime } from "@/lib/format";

type Doc = {
  id: string;
  name: string;
  doc_type: string;
  access_level: "private" | "team" | "public";
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
  uploaded_by_name?: string | null;
};

const DOC_TYPES = [
  { value: "caderneta", label: "Caderneta predial" },
  { value: "certificado", label: "Certificado energético" },
  { value: "planta", label: "Planta" },
  { value: "licenca", label: "Licença de utilização" },
  { value: "other", label: "Outro" },
];

export function DocumentsPanel({
  propertyId,
  initialDocuments,
  readOnly,
}: {
  propertyId: string;
  initialDocuments: Doc[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [docType, setDocType] = useState("other");
  const [accessLevel, setAccessLevel] = useState<"private" | "team" | "public">("team");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = inputRef.current?.files?.[0];
    if (!file) {
      push({ kind: "error", title: "Selecione um ficheiro" });
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("name", name || file.name);
      form.append("docType", docType);
      form.append("accessLevel", accessLevel);
      const res = await fetch(`/api/properties/${propertyId}/documents`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha no envio.");
      setDocuments((prev) => [data.document, ...prev]);
      setName("");
      if (inputRef.current) inputRef.current.value = "";
      push({ kind: "success", title: "Documento carregado", description: "Acesso definido como " + accessLevel });
      router.refresh();
    } catch (e) {
      push({ kind: "error", title: "Falha no envio", description: (e as Error).message });
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Eliminar este documento? Esta ação é irreversível.")) return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      push({ kind: "error", title: "Não foi possível eliminar", description: data.error });
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {!readOnly ? (
        <div className="border border-obsidian/10 bg-white p-4">
          <p className="text-[12px] font-medium">Carregar documento</p>
          <p className="mt-1 text-[10.5px] text-graphite-dim">
            Documentos confidenciais permanecem privados no servidor. “Público” só é acessível quando a experiência
            estiver publicada.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="field-label" htmlFor="doc-name">Nome</label>
              <input id="doc-name" className="input-boxed" value={name} onChange={(e) => setName(e.target.value)} placeholder="Caderneta predial" />
            </div>
            <div>
              <label className="field-label" htmlFor="doc-type">Tipo</label>
              <select id="doc-type" className="select-boxed" value={docType} onChange={(e) => setDocType(e.target.value)}>
                {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="doc-access">Acesso</label>
              <select id="doc-access" className="select-boxed" value={accessLevel} onChange={(e) => setAccessLevel(e.target.value as typeof accessLevel)}>
                <option value="private">Privado (administração)</option>
                <option value="team">Equipa</option>
                <option value="public">Público na página</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={upload} disabled={uploading} className="btn btn-sm btn-primary w-full">
                {uploading ? <Spinner /> : <Upload size={12} />} Enviar
              </button>
            </div>
          </div>
          <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png" className="mt-3 block w-full text-[11px] file:mr-3 file:border file:border-obsidian/20 file:bg-transparent file:px-3 file:py-1.5 file:text-[11px]" />
        </div>
      ) : null}

      {documents.length === 0 ? (
        <p className="border border-dashed border-obsidian/15 px-5 py-8 text-center text-[12px] text-graphite-dim">
          Sem documentos. Plantas, certificados e licenças podem ser carregados com permissões distintas.
        </p>
      ) : (
        <ul className="divide-y divide-obsidian/[0.08] border-y border-obsidian/10">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center gap-3 py-3">
              <FileText size={16} className="text-graphite-dim" />
              <div className="min-w-0 flex-1">
                <a href={`/api/documents/${doc.id}/file`} target="_blank" rel="noreferrer" className="text-[12.5px] font-medium hover:underline">
                  {doc.name}
                </a>
                <p className="text-[10px] text-graphite-dim">
                  {DOC_TYPES.find((t) => t.value === doc.doc_type)?.label ?? doc.doc_type} ·{" "}
                  {(doc.size_bytes / 1024).toFixed(0)} KB · {relativeTime(doc.created_at)}
                </p>
              </div>
              <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-graphite-dim">
                {doc.access_level === "private" ? <Lock size={10} /> : <Users size={10} />} {doc.access_level}
              </span>
              {!readOnly ? (
                <button onClick={() => remove(doc.id)} aria-label="Eliminar documento" className="text-graphite-dim transition hover:text-red-800">
                  <Trash2 size={13} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
