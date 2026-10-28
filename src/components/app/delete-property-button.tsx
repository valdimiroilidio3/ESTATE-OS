"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/client";

export function DeletePropertyButton({ propertyId, title }: { propertyId: string; title: string }) {
  const router = useRouter();
  const { push } = useToast();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (!confirm(`Eliminar definitivamente “${title}”? Leads e visitas associadas perdem a ligação ao imóvel.`)) return;
    setPending(true);
    const res = await fetch(`/api/properties/${propertyId}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      push({ kind: "error", title: "Não foi possível eliminar", description: data.error });
      setPending(false);
      return;
    }
    push({ kind: "success", title: "Imóvel eliminado" });
    router.push("/app/properties");
    router.refresh();
  }

  return (
    <button onClick={remove} disabled={pending} className="mt-1 inline-flex items-center gap-1.5 text-[10.5px] text-graphite-dim transition hover:text-red-800">
      <Trash2 size={11} /> {pending ? "A eliminar…" : "Eliminar imóvel"}
    </button>
  );
}
