"use client";

import { useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Spinner } from "@/components/ui/client";

export function VisitForm({ slug, accent = "#C6A77A" }: { slug: string; accent?: string }) {
  const [kind, setKind] = useState<"visit" | "contact">("visit");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!consent) {
      setError("É necessário aceitar a política de privacidade para enviar o pedido.");
      return;
    }
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? "") || undefined,
      message: String(form.get("message") ?? "") || undefined,
      preferred_date: kind === "visit" ? String(form.get("preferred_date") ?? "") || undefined : undefined,
      preferred_time: kind === "visit" ? String(form.get("preferred_time") ?? "") || undefined : undefined,
      consent: true,
      kind,
      website: String(form.get("website") ?? ""),
    };
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/${slug}/contact`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível enviar o pedido.");
      setDone(data.message);
      void fetch(`/api/public/${slug}/track`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "cta_click", meta: { cta: kind } }),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return (
      <div className="border border-forest/20 bg-forest/[0.04] p-6">
        <CheckCircle2 size={20} className="text-forest" />
        <p className="mt-3 text-[14px] font-medium">Pedido registado</p>
        <p className="mt-1.5 max-w-md text-[12.5px] leading-relaxed text-graphite">{done}</p>
        <p className="mt-3 text-[10.5px] text-graphite-dim">
          Este formulário não confirma disponibilidade. O consultor entrará em contacto para acordar data e hora.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border border-obsidian/10 bg-white p-5 sm:p-6">
      <div className="flex gap-2">
        {(["visit", "contact"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setKind(option)}
            className={`flex-1 border px-3 py-2 text-[11.5px] transition ${
              kind === option ? "border-obsidian bg-obsidian text-porcelain" : "border-obsidian/15 text-graphite hover:border-obsidian/40"
            }`}
          >
            {option === "visit" ? "Solicitar visita" : "Pedir informações"}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor="visit-name">Nome *</label>
          <input id="visit-name" name="name" required minLength={2} maxLength={120} className="input-boxed" autoComplete="name" />
        </div>
        <div>
          <label className="field-label" htmlFor="visit-email">Email *</label>
          <input id="visit-email" name="email" type="email" required className="input-boxed" autoComplete="email" />
        </div>
        <div>
          <label className="field-label" htmlFor="visit-phone">Telefone</label>
          <input id="visit-phone" name="phone" className="input-boxed" autoComplete="tel" placeholder="Opcional" />
        </div>
        {kind === "visit" ? (
          <>
            <div>
              <label className="field-label" htmlFor="visit-date">Data preferida</label>
              <input id="visit-date" name="preferred_date" type="date" className="input-boxed" min={new Date().toISOString().slice(0, 10)} />
            </div>
            <div>
              <label className="field-label" htmlFor="visit-time">Período preferido</label>
              <select id="visit-time" name="preferred_time" className="select-boxed">
                <option value="">Indiferente</option>
                <option value="Manhã">Manhã</option>
                <option value="Tarde">Tarde</option>
                <option value="Fim do dia">Fim do dia</option>
              </select>
            </div>
          </>
        ) : null}
        <div className="sm:col-span-2">
          <label className="field-label" htmlFor="visit-message">Mensagem</label>
          <textarea id="visit-message" name="message" maxLength={2000} className="input-boxed min-h-[80px]" placeholder="Questões ou contexto (opcional)" />
        </div>
      </div>

      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <label className="mt-4 flex items-start gap-2.5 text-[10.5px] leading-relaxed text-graphite">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-3.5 w-3.5" style={{ accentColor: accent }} />
        <span>
          Autorizo o contacto da agência sobre este imóvel e aceito a{" "}
          <a href="/legal/privacidade" className="underline decoration-obsidian/30 underline-offset-2" target="_blank" rel="noreferrer">
            política de privacidade
          </a>
          . Os meus dados não são partilhados com terceiros para marketing sem consentimento.
        </span>
      </label>

      {error ? <p role="alert" className="mt-3 border-l-2 border-red-800 bg-red-900/[0.04] px-3 py-2 text-[11.5px] text-red-900">{error}</p> : null}

      <button type="submit" disabled={pending} className="btn btn-md mt-4 w-full bg-obsidian text-porcelain hover:bg-graphite">
        {pending ? <Spinner /> : <Send size={13} />} {kind === "visit" ? "Enviar pedido de visita" : "Enviar pedido"}
      </button>
      <p className="mt-2 text-[9.5px] leading-relaxed text-graphite-dim">
        Pedido sujeito a confirmação do consultor. Nenhum horário é reservado automaticamente.
      </p>
    </form>
  );
}
