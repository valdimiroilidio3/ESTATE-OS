import Link from "next/link";
import { Wordmark } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-porcelain px-6 text-center">
      <Link href="/" aria-label="ESTATE OS — início">
        <Wordmark />
      </Link>
      <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.24em] text-graphite-dim">404</p>
      <h1 className="mt-3 max-w-md text-[26px] font-light leading-tight">
        Esta página não existe ou já não está publicada.
      </h1>
      <p className="mt-3 max-w-sm text-[12.5px] leading-relaxed text-graphite-dim">
        Se seguiu um link partilhado, confirme com o consultor se a experiência continua disponível.
      </p>
      <div className="mt-7 flex gap-2">
        <Link href="/" className="btn btn-sm btn-primary">Ir para o início</Link>
        <Link href="/app" className="btn btn-sm btn-outline">Entrar no espaço</Link>
      </div>
    </main>
  );
}
