"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Mail, Trash2, UserPlus } from "lucide-react";
import { useToast, Modal, Spinner } from "@/components/ui/client";
import { ROLE_LABELS } from "@/lib/labels";
import { relativeTime } from "@/lib/format";

type Member = {
  profile_id: string;
  full_name: string;
  email: string;
  role: "owner" | "admin" | "agent" | "viewer";
  title: string | null;
  lead_count: number;
  visit_count: number;
  created_at: string;
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  status: string;
  token: string;
  created_at: string;
};

export function TeamManager({
  initialMembers,
  initialInvitations,
  canManage,
  currentProfileId,
  seats,
  seatsLimit,
}: {
  initialMembers: Member[];
  initialInvitations: Invitation[];
  canManage: boolean;
  currentProfileId: string;
  seats: number;
  seatsLimit: number | null;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [members, setMembers] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({ email: "", role: "agent", title: "" });
  const [error, setError] = useState<string | null>(null);

  async function changeRole(profileId: string, role: string) {
    const res = await fetch(`/api/team/${profileId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!res.ok) {
      push({ kind: "error", title: "Não foi possível alterar a função", description: data.error });
      return;
    }
    setMembers((prev) => prev.map((m) => (m.profile_id === profileId ? { ...m, role: role as Member["role"] } : m)));
    push({ kind: "success", title: "Função atualizada" });
    router.refresh();
  }

  async function remove(profileId: string) {
    if (!confirm("Remover este membro da organização?")) return;
    const res = await fetch(`/api/team/${profileId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      push({ kind: "error", title: "Não foi possível remover", description: data.error });
      return;
    }
    setMembers((prev) => prev.filter((m) => m.profile_id !== profileId));
    push({ kind: "success", title: "Membro removido" });
    router.refresh();
  }

  async function invite() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: form.email, role: form.role, title: form.title || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível convidar.");
      push({
        kind: "success",
        title: data.attached ? "Membro adicionado" : "Convite criado",
        description: data.attached
          ? "A pessoa já tinha conta e foi adicionada à organização."
          : "Partilhe o link de convite com a pessoa convidada.",
      });
      setInviteOpen(false);
      setForm({ email: "", role: "agent", title: "" });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-obsidian/10 pb-3">
          <div>
            <h2 className="text-[12px] font-medium uppercase tracking-[0.1em] text-graphite-dim">Membros</h2>
            <p className="mt-1 text-[10.5px] text-graphite-dim">
              {seats} {seatsLimit ? `de ${seatsLimit} lugares` : "membros"} · funções aplicadas no backend
            </p>
          </div>
          {canManage ? (
            <button onClick={() => setInviteOpen(true)} className="btn btn-sm btn-primary">
              <UserPlus size={12} /> Convidar membro
            </button>
          ) : null}
        </div>
        <ul className="divide-y divide-obsidian/[0.07]">
          {members.map((member) => (
            <li key={member.profile_id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-[10px] text-porcelain">
                {member.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium">
                  {member.full_name}
                  {member.profile_id === currentProfileId ? <span className="ml-2 text-[9px] uppercase tracking-[0.1em] text-graphite-dim">você</span> : null}
                </p>
                <p className="text-[10px] text-graphite-dim">{member.email} · {member.title ?? ROLE_LABELS[member.role]}</p>
              </div>
              <span className="hidden text-[10px] text-graphite-dim sm:block">
                {member.lead_count} leads · {member.visit_count} visitas
              </span>
              {canManage && member.profile_id !== currentProfileId ? (
                <>
                  <select
                    className="select-boxed w-32 py-1 text-[11px]"
                    value={member.role}
                    onChange={(e) => changeRole(member.profile_id, e.target.value)}
                  >
                    <option value="admin">Administrador</option>
                    <option value="agent">Consultor</option>
                    <option value="viewer">Leitura</option>
                    {member.role === "owner" ? <option value="owner">Proprietário</option> : null}
                  </select>
                  <button onClick={() => remove(member.profile_id)} aria-label="Remover membro" className="text-graphite-dim transition hover:text-red-800">
                    <Trash2 size={13} />
                  </button>
                </>
              ) : (
                <span className="rounded-full border border-obsidian/15 px-2 py-0.5 text-[9.5px] uppercase tracking-[0.1em] text-graphite">
                  {ROLE_LABELS[member.role]}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="border-b border-obsidian/10 pb-3 text-[12px] font-medium uppercase tracking-[0.1em] text-graphite-dim">
          Convites
        </h2>
        {invitations.length === 0 ? (
          <p className="mt-3 text-[11.5px] text-graphite-dim">Sem convites registados.</p>
        ) : (
          <ul className="divide-y divide-obsidian/[0.07]">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <Mail size={13} className="text-graphite-dim" />
                <span className="min-w-0 flex-1 truncate text-[11.5px]">{invitation.email}</span>
                <span className="text-[10px] text-graphite-dim">{ROLE_LABELS[invitation.role] ?? invitation.role}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] ${
                    invitation.status === "accepted" ? "bg-forest/10 text-forest" : "bg-champagne/20 text-champagne-deep"
                  }`}
                >
                  {invitation.status}
                </span>
                <span className="text-[9.5px] text-graphite-dim">{relativeTime(invitation.created_at)}</span>
                {invitation.status === "pending" ? (
                  <button
                    onClick={async () => {
                      const url = `${window.location.origin}/join?token=${invitation.token}`;
                      await navigator.clipboard.writeText(url);
                      push({ kind: "success", title: "Link de convite copiado" });
                    }}
                    className="btn btn-sm btn-ghost px-2"
                  >
                    <Copy size={11} /> Link
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[10px] leading-relaxed text-graphite-dim">
          O envio de email não está configurado. O link de convite é partilhado manualmente e expira quando o
          convite é aceite.
        </p>
      </section>

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Convidar membro"
        description="Se a pessoa já tiver conta no ESTATE OS, é adicionada imediatamente. Caso contrário, é criado um link de convite."
      >
        <div className="space-y-3">
          <div>
            <label className="field-label" htmlFor="invite-email">Email</label>
            <input id="invite-email" type="email" className="input-boxed" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label" htmlFor="invite-role">Função</label>
              <select id="invite-role" className="select-boxed" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="admin">Administrador</option>
                <option value="agent">Consultor</option>
                <option value="viewer">Leitura</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="invite-title">Cargo</label>
              <input id="invite-title" className="input-boxed" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Consultor sénior" />
            </div>
          </div>
          {error ? <p className="border-l-2 border-red-800 bg-red-900/[0.04] px-3 py-2 text-[11.5px] text-red-900">{error}</p> : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => setInviteOpen(false)} className="btn btn-sm btn-ghost">Cancelar</button>
          <button onClick={invite} disabled={pending || !form.email} className="btn btn-sm btn-primary">
            {pending ? <Spinner /> : <UserPlus size={12} />} Convidar
          </button>
        </div>
      </Modal>
    </div>
  );
}
