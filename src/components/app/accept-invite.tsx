"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/client";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, setPending] = useState(false);

  async function accept() {
    setPending(true);
    const res = await fetch("/api/team/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) {
      push({ kind: "error", title: "Não foi possível aceitar", description: data.error });
      setPending(false);
      return;
    }
    push({ kind: "success", title: "Convite aceite", description: "A organização foi adicionada ao seu perfil." });
    router.push("/app");
    router.refresh();
  }

  return (
    <button onClick={accept} disabled={pending} className="btn btn-md btn-primary mt-5">
      {pending ? "A aceitar…" : "Aceitar convite"}
    </button>
  );
}
