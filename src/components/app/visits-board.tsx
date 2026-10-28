"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus } from "lucide-react";
import { useToast, Modal, Spinner } from "@/components/ui/client";
import { VISIT_STATUS } from "@/lib/labels";
import { dateTime, relativeTime } from "@/lib/format";
import type { Visit, VisitStatus } from "@/lib/types";

type Option = { id: string; label: string };

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const STATUS_ACTIONS: { status: VisitStatus; label: string }[] = [
  { status: "confirmed", label: "Confirmar" },
  { status: "completed", label: "Marcar realizada" },
  { status: "cancelled", label: "Cancelar" },
  { status: "rescheduled", label: "Reagendar" },
];

export function VisitsBoard({
  initialVisits,
  properties,
  leads,
  members,
  canEdit,
}: {
  initialVisits: Visit[];
  properties: Option[];
  leads: Option[];
  members: Option[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [visits, setVisits] = useState(initialVisits);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [creating, setCreating] = useState(false);
  const [active, setActive] = useState<Visit | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    property_id: properties[0]?.id ?? "",
    lead_id: "",
    agent_id: members[0]?.id ?? "",
    scheduled_at: "",
    timezone: "Europe/Lisbon",
    status: "requested" as VisitStatus,
    notes: "",
  });

  const monthLabel = new Intl.DateTimeFormat("pt-PT", { month: "long", year: "numeric" }).format(cursor);

  const calendarDays = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const totalDays = new Date(year, month + 1, 0).getDate();
    const cells: { date: Date | null; visits: Visit[] }[] = [];
    for (let i = 0; i < startOffset; i += 1) cells.push({ date: null, visits: [] });
    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(year, month, day);
      const dayVisits = visits.filter((visit) => {
        if (!visit.scheduled_at) return false;
        const d = new Date(visit.scheduled_at);
        return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
      });
      cells.push({ date, visits: dayVisits });
    }
    return cells;
  }, [cursor, visits]);

  const unscheduled = visits.filter((v) => !v.scheduled_at && ["requested", "confirmed", "rescheduled"].includes(v.status));

  async function updateVisit(id: string, patch: Record<string, unknown>, message?: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/visits/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível atualizar a visita.");
      setVisits((prev) => prev.map((v) => (v.id === id ? { ...v, ...data.visit } : v)));
      setActive((prev) => (prev && prev.id === id ? { ...prev, ...data.visit } : prev));
      if (message) push({ kind: "success", title: message });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  async function createVisit() {
    setPending(true);
    setError(null);
    try {
      const payload = {
        ...form,
        lead_id: form.lead_id || null,
        agent_id: form.agent_id || null,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : undefined,
      };
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível criar a visita.");
      setVisits((prev) => [data.visit, ...prev]);
      setCreating(false);
      push({ kind: "success", title: "Visita registada", description: "Confirme apenas depois de acordada com o cliente." });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-obsidian/10 py-3">
        <div className="flex items-center gap-2">
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Mês anterior" className="rounded-full p-1.5 text-graphite hover:bg-obsidian/5">
            <ChevronLeft size={15} />
          </button>
          <p className="min-w-[140px] text-center text-[12px] font-medium capitalize">{monthLabel}</p>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Mês seguinte" className="rounded-full p-1.5 text-graphite hover:bg-obsidian/5">
            <ChevronRight size={15} />
          </button>
          <button
            onClick={() => {
              const d = new Date();
              setCursor(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
            className="text-[10.5px] uppercase tracking-[0.1em] text-graphite-dim hover:text-obsidian"
          >
            Hoje
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full border border-obsidian/15 p-0.5">
            <button onClick={() => setView("calendar")} aria-label="Calendário" className={clsx("rounded-full p-1.5", view === "calendar" ? "bg-obsidian text-porcelain" : "text-graphite")}>
              <CalendarDays size={13} />
            </button>
            <button onClick={() => setView("list")} aria-label="Lista" className={clsx("rounded-full p-1.5", view === "list" ? "bg-obsidian text-porcelain" : "text-graphite")}>
              <List size={13} />
            </button>
          </div>
          {canEdit ? (
            <button onClick={() => setCreating(true)} className="btn btn-sm btn-primary">
              <Plus size={12} /> Registar visita
            </button>
          ) : null}
        </div>
      </div>

      {unscheduled.length ? (
        <div className="mt-4 border border-champagne/40 bg-champagne/[0.07] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-champagne-deep">
            {unscheduled.length} pedido(s) sem data — requerem confirmação
          </p>
          <ul className="mt-2 space-y-1.5">
            {unscheduled.map((visit) => (
              <li key={visit.id} className="flex flex-wrap items-center gap-2 text-[11.5px]">
                <button onClick={() => setActive(visit)} className="font-medium underline decoration-obsidian/20 underline-offset-2">
                  {visit.property_title}
                </button>
                <span className="text-graphite-dim">{visit.lead_name ?? "Sem lead"}</span>
                <span className="text-graphite-dim">· {visit.notes ?? "Sem preferência registada"}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {view === "calendar" ? (
        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 border-b border-obsidian/10 pb-1">
              {WEEKDAYS.map((day) => (
                <p key={day} className="px-2 text-[9.5px] uppercase tracking-[0.12em] text-graphite-dim">{day}</p>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((cell, index) => (
                <div
                  key={index}
                  className={clsx(
                    "min-h-[92px] border-b border-r border-obsidian/[0.07] p-1.5",
                    !cell.date && "bg-obsidian/[0.015]",
                    cell.date && cell.date.toDateString() === new Date().toDateString() ? "bg-champagne/[0.06]" : "",
                  )}
                >
                  {cell.date ? (
                    <>
                      <p className="font-mono text-[9.5px] text-graphite-dim">{cell.date.getDate()}</p>
                      <ul className="mt-1 space-y-1">
                        {cell.visits.map((visit) => (
                          <li key={visit.id}>
                            <button
                              onClick={() => setActive(visit)}
                              className="w-full truncate rounded-sm bg-forest/10 px-1.5 py-1 text-left text-[9.5px] text-forest transition hover:bg-forest/20"
                            >
                              {new Date(visit.scheduled_at!).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                              {visit.property_title}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-obsidian/10 text-[9.5px] uppercase tracking-[0.12em] text-graphite-dim">
                <th className="pb-2 font-medium">Data</th>
                <th className="pb-2 font-medium">Imóvel</th>
                <th className="pb-2 font-medium">Lead</th>
                <th className="pb-2 font-medium">Consultor</th>
                <th className="pb-2 font-medium">Estado</th>
                <th className="pb-2 text-right font-medium">Registada</th>
              </tr>
            </thead>
            <tbody>
              {visits.length === 0 ? (
                <tr><td colSpan={6} className="py-8 text-center text-[11.5px] text-graphite-dim">Sem visitas registadas.</td></tr>
              ) : null}
              {visits.map((visit) => (
                <tr key={visit.id} onClick={() => setActive(visit)} className="cursor-pointer border-b border-obsidian/[0.07] hover:bg-white/60">
                  <td className="py-2.5 text-[11.5px]">{visit.scheduled_at ? dateTime(visit.scheduled_at) : "Sem data"}</td>
                  <td className="py-2.5 text-[11.5px]">{visit.property_title}</td>
                  <td className="py-2.5 text-[11.5px] text-graphite">{visit.lead_name ?? "—"}</td>
                  <td className="py-2.5 text-[11.5px] text-graphite">{visit.agent_name ?? "—"}</td>
                  <td className="py-2.5">
                    <span className={clsx("rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.08em]", VISIT_STATUS[visit.status]?.tone)}>
                      {VISIT_STATUS[visit.status]?.label}
                    </span>
                  </td>
                  <td className="py-2.5 text-right text-[10px] text-graphite-dim">{relativeTime(visit.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Registar visita" description="A visita é criada no estado selecionado. A confirmação exige data e hora acordadas.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="visit-property">Imóvel</label>
            <select id="visit-property" className="select-boxed" value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}>
              {properties.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="visit-lead">Lead associada</label>
            <select id="visit-lead" className="select-boxed" value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value })}>
              <option value="">Sem lead</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="visit-agent">Consultor</label>
            <select id="visit-agent" className="select-boxed" value={form.agent_id} onChange={(e) => setForm({ ...form, agent_id: e.target.value })}>
              <option value="">Sem consultor</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="visit-when">Data e hora</label>
            <input id="visit-when" type="datetime-local" className="input-boxed" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
          </div>
          <div>
            <label className="field-label" htmlFor="visit-status">Estado</label>
            <select id="visit-status" className="select-boxed" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as VisitStatus })}>
              <option value="requested">Solicitada</option>
              <option value="confirmed">Confirmada</option>
              <option value="rescheduled">Remarcada</option>
              <option value="completed">Realizada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="field-label" htmlFor="visit-notes">Notas</label>
            <textarea id="visit-notes" className="input-boxed min-h-[60px]" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        {error ? <p className="mt-3 border-l-2 border-red-800 bg-red-900/[0.04] px-3 py-2 text-[11.5px] text-red-900">{error}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setCreating(false)} className="btn btn-sm btn-ghost">Cancelar</button>
          <button onClick={createVisit} disabled={pending || !form.property_id} className="btn btn-sm btn-primary">
            {pending ? <Spinner /> : null} Registar visita
          </button>
        </div>
      </Modal>

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title={active?.property_title ?? ""}
        description={active ? `${active.lead_name ?? "Sem lead"} · ${active.scheduled_at ? dateTime(active.scheduled_at) : "sem data definida"}` : ""}
      >
        {active ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className={clsx("rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.08em]", VISIT_STATUS[active.status]?.tone)}>
                {VISIT_STATUS[active.status]?.label}
              </span>
              <span className="font-mono text-[10px] text-graphite-dim">{active.timezone}</span>
            </div>
            <p className="text-[12px] leading-relaxed text-graphite">{active.notes ?? "Sem notas registadas."}</p>
            {canEdit ? (
              <div className="space-y-3 border-t border-obsidian/10 pt-3">
                <div>
                  <label className="field-label" htmlFor="visit-reschedule">Reagendar para</label>
                  <div className="flex gap-2">
                    <input
                      id="visit-reschedule"
                      type="datetime-local"
                      className="input-boxed"
                      value={active.scheduled_at ? new Date(active.scheduled_at).toISOString().slice(0, 16) : ""}
                      onChange={(e) => setActive({ ...active, scheduled_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                    />
                    <button
                      onClick={() => active.scheduled_at && updateVisit(active.id, { scheduled_at: active.scheduled_at, status: "rescheduled" }, "Visita remarcada")}
                      disabled={pending}
                      className="btn btn-sm btn-outline shrink-0"
                    >
                      Guardar data
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_ACTIONS.map((action) => (
                    <button
                      key={action.status}
                      onClick={() => updateVisit(active.id, { status: action.status }, `Estado: ${action.label}`)}
                      disabled={pending || active.status === action.status}
                      className="btn btn-sm btn-outline"
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
                {!active.scheduled_at ? (
                  <p className="text-[10.5px] text-graphite-dim">Defina data e hora antes de confirmar.</p>
                ) : null}
                <div>
                  <label className="field-label" htmlFor="visit-outcome">Resultado</label>
                  <textarea
                    id="visit-outcome"
                    className="input-boxed min-h-[60px]"
                    defaultValue={active.outcome ?? ""}
                    onBlur={(e) => e.target.value !== (active.outcome ?? "") && updateVisit(active.id, { outcome: e.target.value || null })}
                    placeholder="Registo após a visita"
                  />
                </div>
              </div>
            ) : null}
            {error ? <p className="text-[11.5px] text-red-900">{error}</p> : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
