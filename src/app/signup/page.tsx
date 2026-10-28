import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { ToastProvider } from "@/components/ui/client";
import { getSession } from "@/server/auth";

export const metadata: Metadata = { title: "Criar organização" };

export default async function SignupPage() {
  const session = await getSession();
  if (session) redirect("/app");
  return (
    <ToastProvider>
      <AuthShell
        title="Criar a sua organização"
        subtitle="Introduza os dados da sua agência ou operação independente. Pode adicionar consultores depois."
        image="/media/villa-pool.jpg"
        imageAlt="Piscina exterior de uma villa contemporânea"
        caption="Um imóvel bem apresentado começa por dados bem organizados."
      >
        <AuthForm mode="signup" />
      </AuthShell>
    </ToastProvider>
  );
}
