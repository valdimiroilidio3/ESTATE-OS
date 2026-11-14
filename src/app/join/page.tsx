import Link from "next/link";
import { getSession } from "@/server/auth";
import { one, type Row } from "@/server/db";
import { hashToken } from "@/server/security";
import { AcceptInvite } from "@/components/app/accept-invite";
import { Wordmark } from "@/components/ui/primitives";

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const session = await getSession();
  // Invitation tokens are stored hashed; the URL carries the raw value.
  const invite = token
    ? await one<Row>(
        `SELECT i.id, i.org_id, i.email, i.role, i.status, o.name AS org_name
           FROM invitations i JOIN organizations o ON o.id = i.org_id
          WHERE i.token = ? AND i.status = 'pending'`,
        [hashToken(token)],
      )
    : undefined;

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-6 py-16">
      <Link href="/"><Wordmark /></Link>
      <h1 className="mt-10 text-[24px] font-light">Convite de organização</h1>
      {!invite ? (
        <p className="mt-3 text-[12.5px] leading-relaxed text-graphite-dim">
          Convite inválido ou já utilizado. Peça um novo convite ao administrador da organização.
        </p>
      ) : (
        <>
          <p className="mt-3 text-[12.5px] leading-relaxed text-graphite">
            Foi convidado para <strong className="font-medium">{invite.org_name}</strong> com a função de {invite.role}.
          </p>
          {session ? (
            session.org.id === invite.org_id ? (
              <p className="mt-4 text-[12px] text-forest">Já pertence a esta organização.</p>
            ) : (
              <AcceptInvite token={token!} />
            )
          ) : (
            <div className="mt-4 space-y-3">
              <p className="text-[11.5px] leading-relaxed text-graphite-dim">
                O convite está associado a {invite.email}. Crie a conta com esse email ou entre na sua conta para
                aceitar. (A sessão existente mantém-se na organização atual; a aceitação liga o seu perfil a esta
                organização.)
              </p>
              <div className="flex gap-2">
                <Link href="/login" className="btn btn-sm btn-primary">Entrar</Link>
                <Link href="/signup" className="btn btn-sm btn-outline">Criar conta</Link>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
