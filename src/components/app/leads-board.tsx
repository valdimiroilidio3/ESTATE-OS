"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Download, ExternalLink, LayoutGrid, List, Plus, Search, UserRound } from "lucide-react";
import { useToast, Modal } from "@/components/ui/client";
import { LEAD_STATUS, PIPELINE_LABELS, SOURCE_LABELS } from "@/lib/labels";
import { relativeTime, dateShort } from "@/lib/format";
import type { Lead, LeadStatus } from "@/lib/types";

const PIPELINE: { id: LeadStatus; label: string }[] = [
  { id: "new", label: "New" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
  { id: "visit_scheduled", label: "Visit scheduled" },
  { id: "offer", label: "Offer" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

type Member = { profile_id: string; full_name: string; role: string };

type Event = { id: string; type: string; note: string | null; actor_name?: string | null; created_at: string };

export function LeadsBoard({
  initialLeads,
  members,
  canEdit,
  canExport,
}: {
  initialLeads: Lead[];
  members: Member[];
  canEdit: boolean;
  canExport: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [leads, setLeads] = useState(initialLeads);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "all">("all");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [sort, setSort] = useState<"recent" | "oldest" | "name" | "priority">("recent");
  const [active, setActive] = useState<Lead | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = leads.filter((lead) => {
      if (status !== "all" && lead.status !== status) return false;
      if (!q) return true;
      return [lead.name, lead.email, lead.phone, lead.property_title, lead.message]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
    const priorityRank = { high: 0, normal: 1, low: 2 } as const;
    return [...rows].sort((a, b) => {
      if (sort === "oldest") return a.created_at.localeCompare(b.created_at);
      if (sort === "name") return a.name.localeCompare(b.name, "pt");
      if (sort === "priority")
        return (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1) || b.created_at.localeCompare(a.created_at);
      return b.created_at.localeCompare(a.created_at);
    });
  }, [leads, query, status, sort]);

  async function patchLead(id: string, patch: Record<string, unknown>, message?: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível atualizar.");
      setLeads((prev) => prev.map((lead) => (lead.id === id ? { ...lead, ...data.lead } : lead)));
      setActive((prev) => (prev && prev.id === id ? { ...prev, ...data.lead } : prev));
      if (message) push({ kind: "success", title: message });
      router.refresh();
    } catch (e) {
      push({ kind: "error", title: "Falha", description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function openLead(lead: Lead) {
    setActive(lead);
    setEvents([]);
    const res = await fetch(`/api/leads/${lead.id}`);
    if (res.ok) {
      const data = await res.json();
      setEvents(data.events ?? []);
    }
  }

  async function addNote() {
    if (!active || !note.trim()) return;
    const res = await fetch(`/api/leads/${active.id}/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note, type: "note" }),
    });
    const data = await res.json();
    if (!res.ok) {
      push({ kind: "error", title: "Não foi possível registar a nota", description: data.error });
      return;
    }
    setEvents(data.events);
    setNote("");
    push({ kind: "success", title: "Nota registada" });
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
              placeholder="Pesquisar nome, email, imóvel…"
              className="w-56 bg-transparent text-[12px] text-obsidian placeholder:text-graphite-dim/70 focus:outline-none"
            />
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as LeadStatus | "all")}
            className="select-boxed w-40 py-1.5 text-[11.5px]"
          >
            <option value="all">Todos os estados</option>
            {PIPELINE.map((stage) => (
              <option key={stage.id} value={stage.id}>{LEAD_STATUS[stage.id]?.label ?? stage.label}</option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="select-boxed w-36 py-1.5 text-[11.5px]"
            aria-label="Ordenar leads"
          >
            <option value="recent">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
            <option value="name">Nome (A–Z)</option>
            <option value="priority">Prioridade</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-obsidian/15 p-0.5">
            <button onClick={() => setView("kanban")} aria-label="Vista Kanban" className={clsx("rounded-full p-1.5", view === "kanban" ? "bg-obsidian text-porcelain" : "text-graphite")}>
              <LayoutGrid size={13} />
            </button>
            <button onClick={() => setView("table")} aria-label="Vista tabela" className={clsx("rounded-full p-1.5", view === "table" ? "bg-obsidian text-porcelain" : "text-graphite")}>
              <List size={13} />
            </button>
          </div>
          {canExport ? (
            <a href="/api/leads/export" className="btn btn-sm btn-outline">
              <Download size={12} /> Exportar
            </a>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 border border-dashed border-obsidian/15 px-6 py-10 text-center">
          <p className="text-[13px] font-medium">{leads.length ? "Sem leads para estes filtros" : "Ainda não existem leads"}</p>
          <p className="mx-auto mt-1.5 max-w-md text-[11.5px] leading-relaxed text-graphite-dim">
            {leads.length
              ? "Ajuste a pesquisa ou o estado."
              : "Os pedidos de contacto e de visita das páginas públicas entram aqui com origem e consentimento registados."}
          </p>
        </div>
      ) : view === "kanban" ? (
        <div className="mt-5 grid gap-3 overflow-x-auto pb-2 md:grid-cols-3 xl:grid-cols-7">
          {PIPELINE.map((stage) => {
            const stageLeads = filtered.filter((lead) => lead.status === stage.id);
            return (
              <div
                key={stage.id}
                onDragOver={(e) => {
                  if (canEdit) e.preventDefault();
                }}
                onDrop={(e) => {
                  if (!canEdit || !dragging) return;
                  e.preventDefault();
                  void patchLead(dragging, { status: stage.id }, `Movida para ${LEAD_STATUS[stage.id]?.label}`);
                  setDragging(null);
                }}
                className="min-w-[200px] border border-obsidian/10 bg-white/40 p-2"
              >
                <div className="flex items-center justify-between px-1 pb-2">
                  <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-graphite-dim">{stage.label}</p>
                  <span className="font-mono text-[9.5px] text-graphite-dim">{stageLeads.length}</span>
                </div>
                <ul className="space-y-2">
                  {stageLeads.map((lead) => (
                    <li key={lead.id}>
                      <button
                        draggable={canEdit}
                        onDragStart={() => setDragging(lead.id)}
                        onDragEnd={() => setDragging(null)}
                        onClick={() => openLead(lead)}
                        className={clsx(
                          "w-full cursor-grab border border-obsidian/10 bg-white p-2.5 text-left transition hover:border-obsidian/40",
                          lead.priority === "high" ? "border-l-2 border-l-champagne-deep" : "",
                        )}
                      >
                        <p className="truncate text-[11.5px] font-medium">{lead.name}</p>
                        <p className="mt-0.5 truncate text-[9.5px] text-graphite-dim">
                          {lead.property_reference ?? "Sem imóvel"} · {SOURCE_LABELS[lead.source] ?? lead.source}
                        </p>
                        <p className="mt-1 text-[9px] text-graphite-dim">{relativeTime(lead.created_at)}</p>
                        {lead.owner_name ? (
                          <p className="mt-1 flex items-center gap-1 text-[9px] text-graphite-dim">
                            <UserRound size={8} /> {lead.owner_name}
                          </p>
                        ) : null}
                      </button>
                    </li>
                  ))}
                  {stageLeads.length === 0 ? (
                    <li className="border border-dashed border-obsidian/10 px-2 py-4 text-center text-[9px] text-graphite-dim">
                      Sem leads
                    </li>
                  ) : null}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-obsidian/10 text-[9.5px] uppercase tracking-[0.12em] text-graphite-dim">
                <th className="pb-2 font-medium">Lead</th>
                <th className="pb-2 font-medium">Imóvel</th>
                <th className="pb-2 font-medium">Origem</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 font-medium">Responsável</th>
                <th className="pb-2 text-right font-medium">Entrada</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} onClick={() => openLead(lead)} className="cursor-pointer border-b border-obsidian/[0.07] transition hover:bg-white/60">
                  <td className="py-2.5">
                    <p className="text-[12px] font-medium">{lead.name}</p>
                    <p className="text-[9.5px] text-graphite-dim">{lead.email}</p>
                  </td>
                  <td className="py-2.5 text-[11px] text-graphite">{lead.property_title ?? "—"}</td>
                  <td className="py-2.5 text-[11px] text-graphite">{SOURCE_LABELS[lead.source] ?? lead.source}</td>
                  <td className="py-2.5">
                    <span className={clsx("rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.08em]", LEAD_STATUS[lead.status]?.tone)}>
                      {LEAD_STATUS[lead.status]?.label}
                    </span>
                  </td>
                  <td className="py-2.5 text-[11px] text-graphite">{lead.owner_name ?? "Não atribuída"}</td>
                  <td className="py-2.5 text-right text-[10px] text-graphite-dim">{dateShort(lead.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.name ?? ""}
        description={active ? `${active.email}${active.phone ? ` · ${active.phone}` : ""} · entrada ${dateShort(active.created_at)}` : ""}
        size="lg"
      >
        {active ? (
          <div className="grid gap-6 sm:grid-cols-[1.1fr_1fr]">
            <div className="space-y-3">
              <div>
                <label className="field-label">Estado</label>
                <select
                  className="select-boxed"
                  value={active.status}
                  disabled={!canEdit || saving}
                  onChange={(e) => patchLead(active.id, { status: e.target.value }, "Estado atualizado")}
                >
                  {PIPELINE.map((stage) => (
                    <option key={stage.id} value={stage.id}>{LEAD_STATUS[stage.id]?.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Responsável</label>
                <select
                  className="select-boxed"
                  value={active.owner_id ?? ""}
                  disabled={!canEdit || saving}
                  onChange={(e) => patchLead(active.id, { owner_id: e.target.value || null }, "Responsável atualizado")}
                >
                  <option value="">Não atribuída</option>
                  {members.map((member) => (
                    <option key={member.profile_id} value={member.profile_id}>{member.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="field-label">Prioridade</label>
                  <select
                    className="select-boxed"
                    value={active.priority}
                    disabled={!canEdit || saving}
                    onChange={(e) => patchLead(active.id, { priority: e.target.value }, "Prioridade atualizada")}
                  >
                    <option value="low">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="high">Alta</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">Próxima ação</label>
                  <input
                    className="input-boxed"
                    defaultValue={active.next_action ?? ""}
                    disabled={!canEdit}
                    onBlur={(e) => e.target.value !== (active.next_action ?? "") && patchLead(active.id, { next_action: e.target.value || null })}
                    placeholder="Ex.: telefonar"
                  />
                </div>
              </div>
              <div className="border-t border-obsidian/10 pt-3 text-[11px] text-graphite">
                <p><span className="text-graphite-dim">Imóvel:</span> {active.property_title ?? "Sem imóvel associado"}</p>
                <p className="mt-1"><span className="text-graphite-dim">Origem:</span> {SOURCE_LABELS[active.source] ?? active.source}</p>
                <p className="mt-1"><span className="text-graphite-dim">Consentimento marketing:</span> {active.consent_marketing ? "sim" : "não"}</p>
                <p className="mt-1"><span className="text-graphite-dim">Consentimento termos:</span> {active.consent_terms ? "sim" : "não"}</p>
                {active.message ? (
                  <p className="mt-3 border-l-2 border-obsidian/15 pl-3 text-[11.5px] leading-relaxed">{active.message}</p>
                ) : null}
              </div>
            </div>
            <div>
              <p className="text-[10.5px] uppercase tracking-[0.12em] text-graphite-dim">Histórico</p>
              <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                {events.length === 0 ? (
                  <p className="text-[11px] text-graphite-dim">Sem eventos registados.</p>
                ) : (
                  events.map((event) => (
                    <div key={event.id} className="border-b border-obsidian/[0.07] pb-2">
                      <p className="text-[11px]">{event.note ?? event.type}</p>
                      <p className="text-[9px] text-graphite-dim">
                        {event.type} · {event.actor_name ?? "Sistema"} · {relativeTime(event.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>
              {canEdit ? (
                <div className="mt-3">
                  <label className="field-label" htmlFor="lead-note">Adicionar nota</label>
                  <textarea
                    id="lead-note"
                    className="input-boxed min-h-[64px]"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Registo de contacto, próxima ação, contexto…"
                  />
                  <button onClick={addNote} disabled={!note.trim()} className="btn btn-sm btn-outline mt-2">
                    <Plus size={12} /> Registar nota
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
