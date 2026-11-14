import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { ToastProvider } from "@/components/ui/client";
import { getSession } from "@/server/auth";
import { one } from "@/server/db";

export const metadata: Metadata = { title: "Criar organização" };

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/app");
  // A fresh instance has no organisations: this signup creates the first one.
  const emptyInstance = ((await one<{ n: number }>(`SELECT count(*) AS n FROM organizations`))?.n ?? 0) === 0;
  return (
    <ToastProvider>
      <AuthShell
        title="Criar a sua organização"
        subtitle={
          emptyInstance
            ? "Esta instância ainda não tem organizações. A conta que criar agora passa a ser a primeira organização, com o seu perfil como proprietário."
            : "Introduza os dados da sua agência ou operação independente. Pode adicionar consultores depois."
        }
        image="/media/villa-pool.jpg"
        imageAlt="Piscina exterior de uma villa contemporânea"
        caption="Um imóvel bem apresentado começa por dados bem organizados."
      >
        <AuthForm mode="signup" />
      </AuthShell>
    </ToastProvider>
  );
}
