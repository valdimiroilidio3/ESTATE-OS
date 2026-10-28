import Link from "next/link";
import type { Metadata } from "next";
import { requireSessionPage } from "@/server/page-auth";
import { listInvitations, listMembers } from "@/server/data/team";
import { getPlan } from "@/server/plans";
import { TeamManager } from "@/components/app/team-manager";
import { Eyebrow, Metric } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const session = await requireSessionPage();
  const members = listMembers(session.org.id);
  const invitations = listInvitations(session.org.id);
  const plan = getPlan(session.org.plan_code);
  const canManage = session.role === "owner" || session.role === "admin";

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <header>
        <Eyebrow>Team & permissions</Eyebrow>
        <h1 className="mt-2 text-[26px] font-light">Equipa</h1>
        <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-graphite-dim">
          Funções e permissões aplicadas no servidor: administradores gerem organização e equipa; consultores editam
          imóveis e leads; leitura não altera dados.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-x-8 md:grid-cols-4">
        <Metric label="Membros" value={members.length} />
        <Metric label="Consultores" value={members.filter((m) => m.role === "agent").length} />
        <Metric label="Convites pendentes" value={invitations.filter((i) => i.status === "pending").length} />
        <Metric label="Lugares do plano" value={plan?.limits.seats ?? "—"} hint={`Plano ${plan?.name ?? session.org.plan_code}`} />
      </section>

      <TeamManager
        initialMembers={members as never}
        initialInvitations={invitations as never}
        canManage={canManage}
        currentProfileId={session.profile.id}
        seats={members.length}
        seatsLimit={plan?.limits.seats ?? null}
      />

      <p className="border-t border-obsidian/10 pt-3 text-[10.5px] text-graphite-dim">
        Precisa de mais lugares ou relatórios agregados?{" "}
        <Link href="/app/settings#plan" className="underline decoration-obsidian/30 underline-offset-2">Ver plano e limites</Link>.
      </p>
    </div>
  );
}
