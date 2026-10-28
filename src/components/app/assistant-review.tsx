"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Check, Flag, MessageSquare, ShieldCheck, ShieldAlert } from "lucide-react";
import { useToast, Modal } from "@/components/ui/client";
import { relativeTime } from "@/lib/format";

type Conversation = {
  id: string;
  visitor_key: string;
  review_status: "unreviewed" | "reviewed" | "flagged";
  message_count: number;
  last_message: string | null;
  last_at: string;
  property_title?: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: { label: string; value: string; source: string }[];
  grounded: number;
  created_at: string;
};

export function AssistantReview({
  initialConversations,
  quality,
  transcriptsEnabled,
}: {
  initialConversations: Conversation[];
  quality: { grounded: number; ungrounded: number; total: number };
  transcriptsEnabled: boolean;
}) {
  const router = useRouter();
  const { push } = useToast();
  const [items, setItems] = useState(initialConversations);
  const [active, setActive] = useState<{ conversation: Conversation; messages: Message[] } | null>(null);
  const [loading, setLoading] = useState(false);

  async function open(id: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível abrir.");
      setActive({ conversation: items.find((c) => c.id === id)!, messages: data.messages });
    } catch (e) {
      push({ kind: "error", title: "Falha", description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(id: string, status: "reviewed" | "flagged") {
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ review_status: status }),
    });
    if (!res.ok) {
      const data = await res.json();
      push({ kind: "error", title: "Não foi possível atualizar", description: data.error });
      return;
    }
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, review_status: status } : c)));
    push({ kind: "success", title: status === "reviewed" ? "Conversa revista" : "Conversa assinalada" });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-px border border-obsidian/10 bg-obsidian/10">
        {[
          ["Respostas fundamentadas", quality.grounded],
          ["Sem fundamento", quality.ungrounded],
          ["Total", quality.total],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-white p-4">
            <p className="font-mono text-[20px]">{value as number}</p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.1em] text-graphite-dim">{label}</p>
          </div>
        ))}
      </div>

      {!transcriptsEnabled ? (
        <p className="border border-obsidian/10 bg-white px-4 py-3 text-[11.5px] text-graphite-dim">
          A consulta de transcrições está desativada nas definições da organização. Os dados continuam registados
          para fins de qualidade, sujeitos à política de retenção configurada.
        </p>
      ) : items.length === 0 ? (
        <p className="border border-dashed border-obsidian/15 px-5 py-8 text-center text-[12px] text-graphite-dim">
          Sem conversas registadas. O assistente público regista as perguntas para controlo de qualidade.
        </p>
      ) : (
        <ul className="divide-y divide-obsidian/[0.08] border-y border-obsidian/10">
          {items.map((conversation) => (
            <li key={conversation.id} className="flex flex-wrap items-center gap-3 py-3">
              <MessageSquare size={14} className="text-graphite-dim" />
              <button onClick={() => open(conversation.id)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-[12px]">{conversation.last_message ?? "Sem mensagens"}</p>
                <p className="text-[10px] text-graphite-dim">
                  {conversation.property_title} · {conversation.message_count} mensagens · {relativeTime(conversation.last_at)}
                </p>
              </button>
              <span
                className={clsx(
                  "rounded-full px-2 py-0.5 text-[9px] uppercase tracking-[0.1em]",
                  conversation.review_status === "reviewed"
                    ? "bg-forest/10 text-forest"
                    : conversation.review_status === "flagged"
                      ? "bg-red-900/10 text-red-900"
                      : "bg-champagne/25 text-champagne-deep",
                )}
              >
                {conversation.review_status}
              </span>
              <button onClick={() => setStatus(conversation.id, "reviewed")} aria-label="Marcar como revista" className="text-graphite-dim hover:text-forest">
                <Check size={14} />
              </button>
              <button onClick={() => setStatus(conversation.id, "flagged")} aria-label="Assinalar" className="text-graphite-dim hover:text-red-800">
                <Flag size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {loading ? <p className="text-[10.5px] text-graphite-dim">A carregar conversa…</p> : null}

      <Modal
        open={Boolean(active)}
        onClose={() => setActive(null)}
        title="Transcrição da conversa"
        description="Registo para controlo de qualidade. Dados pessoais de terceiros não são expostos."
        size="lg"
      >
        <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 scrollbar-thin">
          {active?.messages.map((message) => (
            <div key={message.id} className={clsx("max-w-[92%] px-3 py-2", message.role === "assistant" ? "bg-white" : "ml-auto bg-obsidian text-porcelain")}>
              <p className="whitespace-pre-wrap text-[12px] leading-relaxed">{message.content}</p>
              {message.citations?.length ? (
                <ul className="mt-2 space-y-0.5 border-t border-obsidian/10 pt-1.5">
                  {message.citations.map((c, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-[9.5px] text-graphite-dim">
                      <ShieldCheck size={9} /> {c.label}: {c.value} · {c.source}
                    </li>
                  ))}
                </ul>
              ) : null}
              {message.role === "assistant" && !message.grounded ? (
                <p className="mt-1 flex items-center gap-1 text-[9.5px] text-champagne-deep">
                  <ShieldAlert size={9} /> Resposta sem fundamento nos dados
                </p>
              ) : null}
              <p className="mt-1 text-[9px] text-graphite-dim">{relativeTime(message.created_at)}</p>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
