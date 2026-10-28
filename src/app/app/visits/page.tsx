import type { Metadata } from "next";
import { requireSessionPage } from "@/server/page-auth";
import { listVisits } from "@/server/data/visits";
import { listProperties } from "@/server/data/properties";
import { listLeads } from "@/server/data/leads";
import { listMembers } from "@/server/data/team";
import { VisitsBoard } from "@/components/app/visits-board";
import { Eyebrow, Metric } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Visits" };

export default async function VisitsPage() {
  const session = await requireSessionPage();
  const visits = listVisits(session.org.id);
  const properties = listProperties(session.org.id, { limit: 100 }).items;
  const leads = listLeads(session.org.id, { limit: 200 });
  const members = listMembers(session.org.id);

  const counts = visits.reduce<Record<string, number>>((acc, visit) => {
    acc[visit.status] = (acc[visit.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-[1300px] space-y-6">
      <header>
        <Eyebrow>Visits & commercial follow-up</Eyebrow>
        <h1 className="mt-2 text-[26px] font-light">Visitas</h1>
        <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-graphite-dim">
          Calendário e lista. Uma visita só é confirmada depois de uma ação autorizada — o sistema não simula
          disponibilidade de calendário.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-x-8 md:grid-cols-5">
        <Metric label="Total" value={visits.length} />
        <Metric label="Solicitadas" value={counts.requested ?? 0} />
        <Metric label="Confirmadas" value={counts.confirmed ?? 0} />
        <Metric label="Realizadas" value={counts.completed ?? 0} />
        <Metric label="Canceladas" value={counts.cancelled ?? 0} />
      </section>

      <VisitsBoard
        initialVisits={visits}
        properties={properties.map((p) => ({ id: p.id, label: `${p.title} · ${p.reference}` }))}
        leads={leads.map((l) => ({ id: l.id, label: `${l.name} · ${l.email}` }))}
        members={members.map((m) => ({ id: m.profile_id, label: m.full_name }))}
        canEdit={session.role !== "viewer"}
      />
    </div>
  );
}
