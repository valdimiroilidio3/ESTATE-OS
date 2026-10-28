import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
      <Link href="/"><Wordmark /></Link>
      <h1 className="mt-10 text-[28px] font-light">Política de privacidade</h1>
      <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-graphite-dim">
        Última atualização · {new Date().getFullYear()}
      </p>
      <div className="prose-editorial mt-8">
        <h2 className="mt-8 text-[16px] font-medium">1. Responsável pelo tratamento</h2>
        <p>
          Os dados de imóveis, contactos e interações são tratados pela organização que utiliza o ESTATE OS. A
          organização é a responsável pelo tratamento perante os titulares dos dados. A plataforma atua como
          subcontratante técnico.
        </p>
        <h2 className="mt-8 text-[16px] font-medium">2. Dados recolhidos</h2>
        <p>
          Dados de conta (nome, email, palavra-passe cifrada), dados de imóveis fornecidos pela agência, ficheiros
          carregados, pedidos de contacto e de visita, e eventos de utilização das páginas públicas sem dados
          pessoais.
        </p>
        <h2 className="mt-8 text-[16px] font-medium">3. Finalidades e fundamentos</h2>
        <p>
          Gestão da conta e do serviço (execução de contrato), apresentação e comercialização dos imóveis
          (interesse legítimo da agência e execução de diligências pré-contratuais a pedido do titular), e
          comunicações de marketing apenas com consentimento explícito.
        </p>
        <h2 className="mt-8 text-[16px] font-medium">4. Conservação</h2>
        <p>
          Os dados são conservados pelo período definido pela organização nas definições do espaço de trabalho,
          por defeito 24 meses após a última interação, salvo obrigação legal de conservação superior.
        </p>
        <h2 className="mt-8 text-[16px] font-medium">5. Direitos</h2>
        <p>
          Pode solicitar acesso, retificação, eliminação, portabilidade, limitação ou oposição através do formulário
          da página do imóvel ou diretamente junto da agência. As organizações dispõem de um registo de pedidos de
          privacidade no workspace.
        </p>
        <h2 className="mt-8 text-[16px] font-medium">6. Subcontratantes e IA</h2>
        <p>
          Quando um fornecedor de IA está configurado, os dados estritamente necessários à geração de conteúdo
          aprovado são enviados ao fornecedor através de ligação cifrada. Sem fornecedor configurado, a geração
          ocorre localmente por regras determinísticas. Nenhuma chave é exposta ao cliente.
        </p>
        <h2 className="mt-8 text-[16px] font-medium">7. Segurança</h2>
        <p>
          Autenticação com sessões assinadas, autorização por função, isolamento por organização aplicado no
          backend, validação server-side, limitação de tentativas e registo de auditoria das ações relevantes.
        </p>
        <p className="mt-10 text-[11px] text-graphite-dim">
          Este documento descreve o comportamento do software em ambiente de demonstração e não constitui
          aconselhamento jurídico. Antes de utilização comercial, a organização deve validar os textos legais com
          apoio jurídico.
        </p>
      </div>
    </article>
  );
}
