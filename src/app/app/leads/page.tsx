import type { Metadata } from "next";
import { requireSessionPage } from "@/server/page-auth";
import { listLeads, leadStats } from "@/server/data/leads";
import { listMembers } from "@/server/data/team";
import { LeadsBoard } from "@/components/app/leads-board";
import { Eyebrow, Metric } from "@/components/ui/primitives";
import { LEAD_STATUS } from "@/lib/labels";

export const metadata: Metadata = { title: "Leads & CRM" };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; status?: string }>;
}) {
  const session = await requireSessionPage();
  const params = await searchParams;
  const leads = listLeads(session.org.id, { propertyId: params.propertyId, status: params.status });
  const stats = leadStats(session.org.id);
  const members = listMembers(session.org.id);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Leads & CRM</Eyebrow>
          <h1 className="mt-2 text-[26px] font-light">Pipeline comercial</h1>
          <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-graphite-dim">
            Vista em tabela e kanban, atribuição a consultores, notas internas e histórico. Arraste um cartão para
            alterar o estado.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-x-8 md:grid-cols-5">
        <Metric label="Total" value={stats.total} />
        <Metric label="Novas" value={stats.byStatus.new ?? 0} />
        <Metric label="Ativas" value={stats.active} hint="Exclui ganhas e perdidas" />
        <Metric label="Visitas" value={stats.byStatus.visit_scheduled ?? 0} />
        <Metric label="Ganhas" value={stats.won} />
      </section>

      <div className="flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.1em] text-graphite-dim">
        {Object.entries(LEAD_STATUS).map(([key, value]) => (
          <span key={key} className={`rounded-full px-2 py-0.5 ${value.tone}`}>{value.label}</span>
        ))}
      </div>

      <LeadsBoard
        initialLeads={leads}
        members={members.map((m) => ({ profile_id: m.profile_id, full_name: m.full_name, role: m.role }))}
        canEdit={session.role !== "viewer"}
        canExport={session.role === "owner" || session.role === "admin"}
      />
    </div>
  );
}
