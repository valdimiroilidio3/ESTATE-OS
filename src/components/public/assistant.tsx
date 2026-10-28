"use client";

import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { ArrowUp, MessageSquare, Sparkles, ShieldCheck } from "lucide-react";
import { Spinner } from "@/components/ui/client";

type Citation = { label: string; value: string; source: string };
type Message = { role: "user" | "assistant"; content: string; citations?: Citation[]; grounded?: boolean };

export function PropertyAssistant({
  slug,
  suggested,
  consultant,
}: {
  slug: string;
  suggested: string[];
  consultant: { name: string; email: string; phone: string };
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || pending) return;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/${slug}/assistant`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível responder.");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, citations: data.citations, grounded: data.grounded },
      ]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border border-obsidian/10 bg-white">
      <div className="flex items-center justify-between border-b border-obsidian/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-champagne-deep" />
          <p className="text-[12px] font-medium">Property assistant</p>
        </div>
        <span className="flex items-center gap-1 text-[9px] uppercase tracking-[0.12em] text-graphite-dim">
          <ShieldCheck size={10} /> dados aprovados
        </span>
      </div>

      <div ref={listRef} className="max-h-[360px] min-h-[160px] space-y-3 overflow-y-auto px-4 py-4 scrollbar-thin">
        {messages.length === 0 ? (
          <div>
            <p className="text-[12px] leading-relaxed text-graphite">
              Pergunte sobre área, quartos, características confirmadas ou visitas. Respondo apenas com informação
              aprovada deste imóvel — e cito a fonte.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {suggested.map((question) => (
                <button
                  key={question}
                  onClick={() => void send(question)}
                  className="rounded-full border border-obsidian/15 px-2.5 py-1 text-[10.5px] text-graphite transition hover:border-obsidian/50"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
              className={clsx(
                "max-w-[92%] px-3 py-2 text-[12px] leading-relaxed",
                message.role === "user" ? "ml-auto bg-obsidian text-porcelain" : "bg-porcelain text-graphite",
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.citations?.length ? (
                <ul className="mt-2 space-y-0.5 border-t border-obsidian/10 pt-1.5">
                  {message.citations.map((citation, i) => (
                    <li key={i} className="text-[9.5px] text-graphite-dim">
                      <span className="font-medium">{citation.label}:</span> {citation.value} · {citation.source}
                    </li>
                  ))}
                </ul>
              ) : null}
              {message.role === "assistant" && message.grounded === false ? (
                <p className="mt-1 text-[9.5px] text-champagne-deep">Sem resposta nos dados — encaminhado para o consultor.</p>
              ) : null}
            </div>
          ))
        )}
        {pending ? (
          <div className="flex items-center gap-2 text-[11px] text-graphite-dim">
            <Spinner /> A consultar os dados do imóvel…
          </div>
        ) : null}
        {error ? <p className="text-[11px] text-red-800">{error}</p> : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-center gap-2 border-t border-obsidian/10 px-3 py-2"
      >
        <label className="sr-only" htmlFor="assistant-input">Pergunta</label>
        <input
          id="assistant-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={600}
          placeholder="Escreva a sua pergunta…"
          className="flex-1 bg-transparent py-1.5 text-[12px] focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !input.trim()}
          aria-label="Enviar pergunta"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-obsidian text-porcelain disabled:opacity-40"
        >
          <ArrowUp size={13} />
        </button>
      </form>
      <p className="border-t border-obsidian/10 px-4 py-2 text-[9px] leading-relaxed text-graphite-dim">
        Assistente automático. Não presta aconselhamento jurídico ou financeiro. Contacto: {consultant.name || "consultor"}{" "}
        {consultant.email ? `· ${consultant.email}` : ""} {consultant.phone ? `· ${consultant.phone}` : ""}
      </p>
    </div>
  );
}
