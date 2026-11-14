import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { ToastProvider } from "@/components/ui/client";
import { getSession } from "@/server/auth";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/app");
  return (
    <ToastProvider>
      <AuthShell
        title="Entrar no workspace"
        subtitle="Acesso privado à sua organização. Cada conta pertence a uma organização e só vê os dados dessa organização."
        image="/media/villa-living.jpg"
        imageAlt="Sala de estar de uma moradia contemporânea"
        caption="“Every property deserves its own digital world.”"
      >
        <AuthForm mode="login" />
      </AuthShell>
    </ToastProvider>
  );
}
