"use client";

import Link from "next/link";
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[workspace]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-start py-20">
      <p className="text-[10px] uppercase tracking-[0.18em] text-champagne-deep">Erro</p>
      <h1 className="mt-3 text-[24px] font-light">Não foi possível carregar esta página</h1>
      <p className="mt-3 text-[12.5px] leading-relaxed text-graphite-dim">
        Ocorreu uma falha inesperada. O seu trabalho guardado não foi alterado. Pode tentar novamente ou voltar ao
        overview.
      </p>
      {error.digest ? <p className="mt-2 font-mono text-[10px] text-graphite-dim">ref. {error.digest}</p> : null}
      <div className="mt-6 flex gap-2">
        <button onClick={reset} className="btn btn-sm btn-primary">
          <RotateCcw size={12} /> Tentar novamente
        </button>
        <Link href="/app" className="btn btn-sm btn-outline">
          Voltar ao overview
        </Link>
      </div>
    </div>
  );
}
