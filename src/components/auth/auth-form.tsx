"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/client";

type Mode = "login" | "signup";

const DEMO = { email: "helena@estateos.demo", password: "EstateDemo2026!" };

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [values, setValues] = useState({
    fullName: "",
    orgName: "",
    email: "",
    password: "",
    acceptTerms: false,
  });

  const set = (key: keyof typeof values, value: string | boolean) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setPending(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body =
        mode === "login"
          ? { email: values.email, password: values.password }
          : {
              fullName: values.fullName,
              orgName: values.orgName,
              email: values.email,
              password: values.password,
              acceptTerms: values.acceptTerms,
            };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.details?.fieldErrors) setFieldErrors(data.details.fieldErrors);
        if (data.details?.formErrors?.length) setError(data.details.formErrors[0]);
        else setError(data.error ?? "Não foi possível continuar.");
        return;
      }
      push({ kind: "success", title: mode === "login" ? "Sessão iniciada" : "Organização criada" });
      router.replace(data.redirect ?? "/app");
      router.refresh();
    } catch {
      setError("Erro de rede. Verifique a ligação e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      {mode === "signup" ? (
        <>
          <div>
            <label className="field-label" htmlFor="fullName">Nome completo</label>
            <input
              id="fullName"
              className="input"
              value={values.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              autoComplete="name"
              required
            />
            {fieldErrors.fullName ? <p className="field-hint text-red-800">{fieldErrors.fullName}</p> : null}
          </div>
          <div>
            <label className="field-label" htmlFor="orgName">Nome da organização</label>
            <input
              id="orgName"
              className="input"
              value={values.orgName}
              onChange={(e) => set("orgName", e.target.value)}
              autoComplete="organization"
              required
            />
            {fieldErrors.orgName ? <p className="field-hint text-red-800">{fieldErrors.orgName}</p> : null}
          </div>
        </>
      ) : null}

      <div>
        <label className="field-label" htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          className="input"
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          autoComplete="email"
          required
        />
        {fieldErrors.email ? <p className="field-hint text-red-800">{fieldErrors.email}</p> : null}
      </div>

      <div>
        <div className="flex items-baseline justify-between">
          <label className="field-label" htmlFor="password">Palavra-passe</label>
          {mode === "login" ? (
            <span className="text-[10.5px] text-graphite-dim">Mínimo 8 caracteres</span>
          ) : null}
        </div>
        <input
          id="password"
          type="password"
          className="input"
          value={values.password}
          onChange={(e) => set("password", e.target.value)}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={8}
          required
        />
        {fieldErrors.password ? <p className="field-hint text-red-800">{fieldErrors.password}</p> : null}
      </div>

      {mode === "signup" ? (
        <label className="flex cursor-pointer items-start gap-3 text-[11.5px] leading-relaxed text-graphite">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-obsidian"
            checked={values.acceptTerms}
            onChange={(e) => set("acceptTerms", e.target.checked)}
            required
          />
          <span>
            Aceito os{" "}
            <Link href="/legal/termos" className="underline decoration-obsidian/30 underline-offset-2">termos</Link> e a{" "}
            <Link href="/legal/privacidade" className="underline decoration-obsidian/30 underline-offset-2">
              política de privacidade
            </Link>
            . Os dados que introduzir são tratados para gestão da conta e dos imóveis da organização.
          </span>
        </label>
      ) : null}

      {error ? (
        <p role="alert" className="border-l-2 border-red-800 bg-red-900/[0.04] px-3 py-2 text-[12px] text-red-900">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn btn-md btn-primary w-full" disabled={pending}>
        {pending ? "A processar…" : mode === "login" ? "Entrar no workspace" : "Criar organização"}
      </button>

      {mode === "login" ? (
        <>
          <button
            type="button"
            onClick={() => setValues((prev) => ({ ...prev, email: DEMO.email, password: DEMO.password }))}
            className="w-full border border-dashed border-obsidian/15 px-3 py-2.5 text-[11px] text-graphite-dim transition hover:border-obsidian/30 hover:text-obsidian"
          >
            Preencher credenciais de demonstração — helena@estateos.demo
          </button>
          <p className="text-center text-[11.5px] text-graphite-dim">
            Ainda não tem conta?{" "}
            <Link href="/signup" className="text-obsidian underline decoration-obsidian/30 underline-offset-2">
              Criar organização
            </Link>
          </p>
        </>
      ) : (
        <p className="text-center text-[11.5px] text-graphite-dim">
          Já tem conta?{" "}
          <Link href="/login" className="text-obsidian underline decoration-obsidian/30 underline-offset-2">
            Entrar
          </Link>
        </p>
      )}
    </form>
  );
}
