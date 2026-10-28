import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Termos de utilização" };

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
      <Link href="/"><Wordmark /></Link>
      <h1 className="mt-10 text-[28px] font-light">Termos de utilização</h1>
      <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-graphite-dim">
        Ambiente de demonstração
      </p>
      <div className="prose-editorial mt-8">
        <h2 className="mt-8 text-[16px] font-medium">1. Objeto</h2>
        <p>
          O ESTATE OS é um software de apresentação e produção comercial de imóveis. A organização utilizadora é
          responsável pela veracidade dos dados que introduz e pela autorização dos materiais que publica.
        </p>
        <h2 className="mt-8 text-[16px] font-medium">2. Conteúdo gerado</h2>
        <p>
          O conteúdo gerado assistidamente deve ser revisto por uma pessoa antes de publicação. A aprovação é
          registada com autor e data. O sistema não substitui verificação documental, avaliação técnica ou
          aconselhamento jurídico e financeiro.
        </p>
        <h2 className="mt-8 text-[16px] font-medium">3. Publicação</h2>
        <p>
          Nenhuma página pública é criada sem ação explícita de publicação. Uma experiência pode ser despublicada a
          qualquer momento; o URL deixa de resolver de imediato.
        </p>
        <h2 className="mt-8 text-[16px] font-medium">4. Uso aceitável</h2>
        <p>
          É proibido carregar conteúdo ilícito, não autorizado ou que viole direitos de terceiros, bem como tentar
          aceder a dados de outras organizações. O acesso é registado.
        </p>
        <h2 className="mt-8 text-[16px] font-medium">5. Planos e faturação</h2>
        <p>
          Limites de plano são aplicados no backend. A faturação não está integrada: os estados de subscrição
          permanecem “não configurado” até existir confirmação de um sistema de pagamentos.
        </p>
        <h2 className="mt-8 text-[16px] font-medium">6. Limitação</h2>
        <p>
          Este software é disponibilizado em ambiente de demonstração, sem garantias de disponibilidade ou de
          adequação a um fim específico.
        </p>
      </div>
    </article>
  );
}
