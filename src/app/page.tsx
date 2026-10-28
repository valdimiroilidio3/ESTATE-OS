import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, Check, Minus } from "lucide-react";
import { Wordmark, Eyebrow } from "@/components/ui/primitives";
import { BeforeAfter } from "@/components/marketing/before-after";
import { getPlans } from "@/server/plans";
import { money } from "@/lib/format";

export const metadata: Metadata = {
  title: "ESTATE OS — Every property deserves its own digital world",
};

const STEPS = [
  {
    n: "01",
    title: "Introduza o imóvel",
    body: "Dados, especificações, fotografias, plantas e documentos. Cada campo tem origem registada e estado de confirmação.",
  },
  {
    n: "02",
    title: "Deixe a IA preparar",
    body: "Listagem, versões em português e inglês, campanha, briefing audiovisual e FAQ — sempre a partir dos factos confirmados.",
  },
  {
    n: "03",
    title: "Reveja e aprove",
    body: "Nada é publicado sem revisão humana. O sistema distingue o que está confirmado, o que é sugestão e o que falta.",
  },
  {
    n: "04",
    title: "Publique e acompanhe",
    body: "Página pública com URL estável, assistente fundamentado, pedidos de visita e CRM no mesmo espaço de trabalho.",
  },
];

const AI_MODULES = [
  {
    letter: "A",
    title: "AI Listing Writer",
    body: "Título, descrição, resumo, características, meta title e meta description. PT e EN, estruturável para mais idiomas.",
    note: "Sem superlativos vazios. Sem factos inventados.",
  },
  {
    letter: "B",
    title: "Audience Adaptation",
    body: "Quatro enquadramentos comerciais — nacional, internacional, famílias e investidores — sem alterar factos.",
    note: "Investidores: nenhuma rentabilidade é estimada sem dados.",
  },
  {
    letter: "C",
    title: "Campaign Generator",
    body: "Instagram, anúncios, email, WhatsApp, argumentos comerciais, FAQ e guião de vídeo, editáveis e exportáveis.",
    note: "Cada peça regenerável individualmente.",
  },
  {
    letter: "D",
    title: "Cinematic Media Brief",
    body: "Sequência de planos, movimento de câmara, luz, ambiente, ritmo, sobreposições e formatos de saída.",
    note: "Entregável para produção externa. Não simulamos vídeo.",
  },
  {
    letter: "E",
    title: "Image Enhancement",
    body: "Interface preparada para serviços compatíveis, com preservação de arquitectura e proporções.",
    note: "Alterações virtuais são sempre identificadas como ilustrativas.",
  },
  {
    letter: "F",
    title: "Property Assistant",
    body: "Responde a partir dos dados aprovados, cita a fonte e assume explicitamente quando não sabe.",
    note: "Sem documentos privados. Sem dados de outros compradores.",
  },
];

const FAQ = [
  {
    q: "O sistema inventa características que eu não registei?",
    a: "Não. A geração usa apenas dados confirmados na ficha do imóvel. Campos desconhecidos são omitidos e apresentados como pendentes na verificação assistida. Sugestões visuais nunca são convertidas em factos sem confirmação.",
  },
  {
    q: "Que modelo de IA é utilizado?",
    a: "A arquitectura é independente de fornecedor. Sem credenciais configuradas, a plataforma usa um motor determinístico local, identificado como tal na interface. Com um endpoint compatível com OpenAI configurado no servidor, a geração passa a ser feita por modelo de linguagem, mantendo as mesmas regras de fundamentação.",
  },
  {
    q: "A página pública é pesquisável e partilhável?",
    a: "Sim. Cada experiência publicada tem URL estável, metadados SEO e Open Graph. Pode ser despublicada a qualquer momento, mantendo o registo do imóvel intacto.",
  },
  {
    q: "Como são tratados os dados pessoais?",
    a: "As leads são recolhidas com consentimento explícito e registo de origem. O acesso é isolado por organização no backend, com auditoria de ações relevantes. Existe fluxo para exercer direitos de acesso, retificação, eliminação e portabilidade.",
  },
  {
    q: "A faturação está integrada?",
    a: "Não. Os planos, quotas e limites são reais e aplicados no backend, mas não existe integração com um sistema de pagamentos. O estado da subscrição apresenta-se como não configurado — nunca como ativo por suposição.",
  },
  {
    q: "Posso exportar os materiais gerados?",
    a: "Sim. Cada peça pode ser copiada ou descarregada em texto, e a biblioteca de media mantém os ficheiros originais com estados de aprovação e permissões.",
  },
];

export default async function LandingPage() {
  const plans = getPlans();
  return (
    <div className="bg-porcelain">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-obsidian/5 bg-porcelain/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="ESTATE OS — início">
            <Wordmark />
          </Link>
          <nav className="hidden items-center gap-8 text-[12px] text-graphite md:flex">
            <a href="#como-funciona" className="transition hover:text-obsidian">Como funciona</a>
            <a href="#transformacao" className="transition hover:text-obsidian">Transformação</a>
            <a href="#experiencia" className="transition hover:text-obsidian">Experiência</a>
            <a href="#ia" className="transition hover:text-obsidian">Inteligência artificial</a>
            <a href="#planos" className="transition hover:text-obsidian">Planos</a>
            <a href="#faq" className="transition hover:text-obsidian">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden px-3 py-2 text-[12px] text-graphite transition hover:text-obsidian sm:block">
              Entrar
            </Link>
            <Link href="/signup" className="btn btn-sm btn-primary">
              Criar primeiro imóvel
            </Link>
          </div>
        </div>
      </header>

      {/* ───────── hero ───────── */}
      <section className="relative min-h-[100svh] w-full overflow-hidden bg-obsidian">
        <Image
          src="/media/hero.jpg"
          alt="Moradia contemporânea de luxo junto ao oceano ao pôr do sol"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/45 to-obsidian/25" />
        <div className="absolute inset-0 grain" aria-hidden />
        <div className="relative mx-auto flex min-h-[100svh] max-w-shell flex-col justify-between px-5 pt-28 pb-10 sm:px-8">
          <div className="flex items-start justify-between gap-6">
            <Eyebrow tone="light">Plataforma de apresentação e inteligência imobiliária</Eyebrow>
            <p className="hidden text-right font-mono text-[10px] leading-relaxed tracking-[0.14em] text-porcelain/50 sm:block">
              38°41′N 9°25′W
              <br />
              CASCAIS · PORTUGAL
            </p>
          </div>

          <div className="max-w-4xl">
            <h1 className="animate-fade-up text-[clamp(2.6rem,6.4vw,5.4rem)] font-light leading-[0.98] tracking-tightest text-porcelain">
              Every property deserves
              <br />
              its <span className="font-serif italic text-champagne">own</span> digital world.
            </h1>
            <p className="mt-7 max-w-xl animate-fade-up text-[15px] leading-relaxed text-porcelain/70 [animation-delay:120ms]">
              Transforme dados imobiliários em experiências de venda extraordinárias, com inteligência artificial.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn btn-lg btn-light">
                Criar primeiro imóvel
                <ArrowRight size={15} />
              </Link>
              <Link href="/p/villa-atlantica-cascais" className="btn btn-lg btn-outline-light">
                Explorar uma experiência
              </Link>
            </div>
            <p className="mt-5 max-w-md text-[11px] leading-relaxed text-porcelain/40">
              Estado da arte da demonstração: conta de demonstração disponível. Nenhum dado de clientes reais é
              apresentado.
            </p>
          </div>

          <div className="flex items-end justify-between border-t border-porcelain/15 pt-6">
            <div className="flex gap-10 text-[10px] uppercase tracking-[0.16em] text-porcelain/50">
              <span>Apresentação</span>
              <span className="hidden sm:inline">Página exclusiva</span>
              <span className="hidden md:inline">Campanha</span>
              <span className="hidden md:inline">CRM</span>
            </div>
            <a href="#como-funciona" className="flex flex-col items-center gap-2 text-[9px] uppercase tracking-[0.22em] text-porcelain/50">
              <span>Scroll</span>
              <span className="block h-10 w-px bg-gradient-to-b from-porcelain/50 to-transparent" />
            </a>
          </div>
        </div>
      </section>

      {/* ───────── como funciona ───────── */}
      <section id="como-funciona" className="mx-auto max-w-shell px-5 pb-24 pt-24 sm:px-8 sm:pb-32 sm:pt-32">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.6fr]">
          <div>
            <Eyebrow>Como funciona</Eyebrow>
            <h2 className="mt-4 max-w-md text-[clamp(1.9rem,3.4vw,2.9rem)] font-light leading-[1.05]">
              One property in.
              <br />
              An entire selling
              <br />
              experience out.
            </h2>
            <p className="mt-6 max-w-sm text-[13.5px] leading-relaxed text-graphite">
              Um único registo de imóvel alimenta tudo o que a equipa comercial precisa — com proveniência de dados
              em cada passo.
            </p>
          </div>
          <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2">
            {STEPS.map((step) => (
              <div key={step.n} className="border-t border-obsidian/15 pt-4">
                <span className="font-mono text-[11px] tracking-[0.14em] text-champagne-deep">{step.n}</span>
                <h3 className="mt-3 text-[15px] font-medium">{step.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-graphite-dim">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── antes / depois ───────── */}
      <section id="transformacao" className="border-y border-obsidian/10 bg-white/50">
        <div className="mx-auto grid max-w-shell gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
          <BeforeAfter />
          <div>
            <Eyebrow>Antes e depois da transformação</Eyebrow>
            <h2 className="mt-4 text-[clamp(1.7rem,3vw,2.5rem)] font-light leading-[1.08]">
              A mesma casa.
              <br />
              Outra percepção
              <br />
              de valor.
            </h2>
            <ul className="mt-8 space-y-4">
              {[
                "Selecção de imagem principal e sequência de galeria",
                "Texto construído apenas com características confirmadas",
                "Especificações que se ocultam quando o dado não existe",
                "Briefing audiovisual pronto para produção externa",
              ].map((item) => (
                <li key={item} className="flex gap-3 border-b border-obsidian/[0.08] pb-3 text-[13px] text-graphite">
                  <Check size={14} className="mt-0.5 shrink-0 text-forest" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ───────── experiência demonstrada ───────── */}
      <section id="experiencia" className="mx-auto max-w-shell px-5 py-24 sm:px-8 sm:py-32">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-obsidian/10 pb-6">
          <div>
            <Eyebrow>Página exclusiva</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-[clamp(1.8rem,3.2vw,2.7rem)] font-light leading-[1.06]">
              Cada imóvel com o seu próprio mundo digital — publicado apenas quando aprovado.
            </h2>
          </div>
          <Link href="/p/villa-atlantica-cascais" className="link-underline shrink-0">
            Abrir experiência de demonstração <ArrowUpRight size={13} />
          </Link>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="group relative aspect-[16/11] overflow-hidden bg-stone-soft">
            <Image
              src="/media/villa-pool.jpg"
              alt="Piscina exterior de uma moradia contemporânea em Cascais"
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover transition duration-700 ease-editorial group-hover:scale-[1.02]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-obsidian/80 to-transparent p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-porcelain/60">Experiência · Signature</p>
              <p className="mt-2 font-serif text-3xl text-porcelain">Villa Atlântica</p>
              <p className="mt-1 text-[12px] text-porcelain/70">Guia, Cascais · 245 m² · 4 quartos · 2 450 000 €</p>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="border border-obsidian/10 bg-white p-6">
              <Eyebrow>Property Assistant</Eyebrow>
              <p className="mt-3 text-[13px] leading-relaxed text-graphite">
                “Qual é a área útil?” — o assistente responde com o valor registado e a fonte. Quando o dado não
                existe, diz que não sabe, em vez de improvisar.
              </p>
              <div className="mt-5 space-y-2 border-t border-obsidian/10 pt-4 font-mono text-[10.5px] leading-relaxed text-graphite-dim">
                <p className="text-obsidian">› Qual é a área útil?</p>
                <p>245 m² · fonte: Especificações</p>
                <p className="text-obsidian">› Qual é a rentabilidade anual?</p>
                <p>Informação não disponível. Encaminhado para o consultor.</p>
              </div>
            </div>
            <div className="border border-obsidian/10 bg-white p-6">
              <Eyebrow>Três direcções editoriais</Eyebrow>
              <ul className="mt-4 space-y-3">
                {[
                  ["Architectural", "Minimalismo, grandes imagens, arquitectura em primeiro plano."],
                  ["Signature", "Editorial premium com narrativa e tipografia serifada."],
                  ["Investment", "Leitura factual orientada a especificações e análise."],
                ].map(([name, desc]) => (
                  <li key={name} className="border-b border-obsidian/[0.08] pb-3 last:border-0 last:pb-0">
                    <p className="text-[13px] font-medium">{name}</p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-graphite-dim">{desc}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── IA ───────── */}
      <section id="ia" className="border-y border-obsidian/10 bg-obsidian text-porcelain">
        <div className="mx-auto max-w-shell px-5 py-24 sm:px-8 sm:py-32">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.4fr]">
            <div>
              <Eyebrow tone="light">Inteligência artificial aplicada</Eyebrow>
              <h2 className="mt-4 text-[clamp(1.8rem,3.2vw,2.7rem)] font-light leading-[1.06] text-porcelain">
                Seis módulos.
                <br />
                Uma regra:
                <br />
                <span className="text-champagne">nada de factos inventados.</span>
              </h2>
              <p className="mt-6 max-w-sm text-[13px] leading-relaxed text-porcelain/60">
                A camada de IA é independente do fornecedor. Cada operação tem configuração, validação, timeout,
                limites de utilização e registo de consumo. Se não estiver configurada, o sistema diz-o.
              </p>
            </div>
            <div className="grid gap-x-10 sm:grid-cols-2">
              {AI_MODULES.map((module) => (
                <div key={module.letter} className="border-t border-porcelain/15 py-6">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[11px] text-champagne">{module.letter}</span>
                    <h3 className="text-[14px] font-medium text-porcelain">{module.title}</h3>
                  </div>
                  <p className="mt-2.5 text-[12.5px] leading-relaxed text-porcelain/60">{module.body}</p>
                  <p className="mt-3 text-[10.5px] leading-relaxed text-champagne/80">{module.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────── CRM e visitas ───────── */}
      <section className="mx-auto max-w-shell px-5 py-24 sm:px-8 sm:py-32">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
          <div>
            <Eyebrow>Leads, visitas e seguimento</Eyebrow>
            <h2 className="mt-4 text-[clamp(1.8rem,3.2vw,2.7rem)] font-light leading-[1.06]">
              A apresentação gera interesse.
              <br />
              O sistema organiza-o.
            </h2>
            <p className="mt-6 max-w-md text-[13.5px] leading-relaxed text-graphite">
              Leads com origem registada, pipeline configurável e visitas com estados reais. A confirmação de uma
              visita exige uma ação autorizada — o sistema não simula disponibilidade de calendário.
            </p>
            <Link href="/signup" className="link-underline mt-8 inline-flex">
              Ver o workspace por dentro <ArrowRight size={13} />
            </Link>
          </div>
          <div className="border border-obsidian/10 bg-white p-6">
            <div className="flex items-center justify-between border-b border-obsidian/10 pb-4">
              <p className="text-[12px] font-medium">Pipeline</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite-dim">Configurável</p>
            </div>
            <ol className="mt-4 space-y-2">
              {["New", "Contacted", "Qualified", "Visit scheduled", "Offer", "Won / Lost"].map((stage, i) => (
                <li key={stage} className="flex items-center gap-4 border-b border-obsidian/[0.07] py-2.5 last:border-0">
                  <span className="font-mono text-[10px] text-graphite-dim">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[13px]">{stage}</span>
                  <span className="ml-auto h-[3px] flex-1 max-w-24 bg-stone-soft">
                    <span className="block h-full bg-champagne" style={{ width: `${100 - i * 14}%` }} />
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-5 text-[10.5px] leading-relaxed text-graphite-dim">
              Prioridade baseada em sinais comerciais explícitos — pedido de visita ou de informação. Nunca em
              atributos sensíveis.
            </p>
          </div>
        </div>
      </section>

      {/* ───────── benefícios ───────── */}
      <section className="border-t border-obsidian/10 bg-white/60">
        <div className="mx-auto max-w-shell px-5 py-20 sm:px-8 sm:py-24">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow>Para agências</Eyebrow>
              <h3 className="mt-4 text-[22px] font-light">Consistência em cada imóvel</h3>
              <ul className="mt-5 space-y-3">
                {[
                  "Voz editorial uniforme, independentemente do consultor",
                  "Aprovação obrigatória antes de qualquer publicação",
                  "Permissões por função e isolamento de organização",
                  "Histórico de alterações e proveniência dos dados",
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-[13px] text-graphite">
                    <Minus size={14} className="mt-0.5 shrink-0 text-champagne-deep" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <Eyebrow>Para consultores</Eyebrow>
              <h3 className="mt-4 text-[22px] font-light">Menos trabalho manual repetido</h3>
              <ul className="mt-5 space-y-3">
                {[
                  "Materiais de campanha prontos a editar em minutos",
                  "Assistente que responde com dados oficiais do imóvel",
                  "Pedidos de visita centralizados com estado real",
                  "Analytics que distinguem visitas, contactos e conversões",
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-[13px] text-graphite">
                    <Minus size={14} className="mt-0.5 shrink-0 text-champagne-deep" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── planos ───────── */}
      <section id="planos" className="mx-auto max-w-shell px-5 py-24 sm:px-8 sm:py-32">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-obsidian/10 pb-6">
          <div>
            <Eyebrow>Planos</Eyebrow>
            <h2 className="mt-3 text-[clamp(1.8rem,3vw,2.5rem)] font-light">Configuráveis. Sem letras pequenas.</h2>
          </div>
          <p className="max-w-sm text-[11px] leading-relaxed text-graphite-dim">
            Preços e limites são geridos pelo administrador da plataforma. A faturação não está integrada — nenhuma
            subscrição é apresentada como ativa sem confirmação.
          </p>
        </div>
        <div className="mt-10 grid gap-px overflow-hidden border border-obsidian/10 bg-obsidian/10 md:grid-cols-3">
          {plans.map((plan, index) => (
            <div key={plan.code} className={`flex flex-col bg-porcelain p-7 ${index === 1 ? "md:bg-white" : ""}`}>
              <div className="flex items-baseline justify-between">
                <h3 className="text-[15px] font-medium">{plan.name}</h3>
                {index === 1 ? (
                  <span className="rounded-full border border-champagne px-2 py-0.5 text-[9.5px] uppercase tracking-[0.14em] text-champagne-deep">
                    Mais completo
                  </span>
                ) : null}
              </div>
              <p className="mt-2 min-h-[36px] text-[11.5px] leading-relaxed text-graphite-dim">{plan.tagline}</p>
              <p className="mt-6 font-mono text-[26px] tracking-tight">
                {plan.price_monthly_cents === 0 ? "Sob consulta" : money(plan.price_monthly_cents, plan.currency)}
                {plan.price_monthly_cents > 0 ? <span className="text-[11px] text-graphite-dim"> /mês</span> : null}
              </p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-[12.5px] text-graphite">
                    <Check size={13} className="mt-0.5 shrink-0 text-forest" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className={`btn mt-7 ${index === 1 ? "btn-primary" : "btn-outline"} btn-md`}>
                Começar
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section id="faq" className="border-t border-obsidian/10">
        <div className="mx-auto grid max-w-shell gap-10 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-4 text-[clamp(1.7rem,2.8vw,2.3rem)] font-light leading-[1.1]">
              Perguntas directas.
              <br />
              Respostas verificáveis.
            </h2>
          </div>
          <div>
            {FAQ.map((item) => (
              <details key={item.q} className="group border-b border-obsidian/10 py-5">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-[13.5px] font-medium">
                  {item.q}
                  <span className="mt-1 text-graphite-dim transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 max-w-2xl text-[12.5px] leading-relaxed text-graphite-dim">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── CTA ───────── */}
      <section className="relative overflow-hidden bg-obsidian">
        <Image src="/media/villa-exterior.jpg" alt="" fill sizes="100vw" className="object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/85 to-obsidian/40" />
        <div className="relative mx-auto flex max-w-shell flex-col items-start gap-8 px-5 py-24 sm:px-8 sm:py-32 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Eyebrow tone="light">Começar</Eyebrow>
            <h2 className="mt-4 max-w-xl text-[clamp(2rem,4vw,3.2rem)] font-light leading-[1.02] text-porcelain">
              O primeiro imóvel pode estar apresentado em minutos.
            </h2>
            <p className="mt-5 max-w-md text-[13px] leading-relaxed text-porcelain/60">
              Crie a sua organização, introduza a ficha do imóvel e acompanhe a produção de cada material no
              workspace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="btn btn-lg btn-light">
              Criar primeiro imóvel <ArrowRight size={15} />
            </Link>
            <Link href="/login" className="btn btn-lg btn-outline-light">
              Entrar na conta
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-obsidian/10 bg-porcelain">
        <div className="mx-auto flex max-w-shell flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Wordmark />
            <p className="mt-2 text-[10.5px] text-graphite-dim">
              One property in. An entire selling experience out.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10.5px] text-graphite-dim">
            <Link href="/legal/privacidade" className="hover:text-obsidian">Privacidade</Link>
            <Link href="/legal/termos" className="hover:text-obsidian">Termos</Link>
            <Link href="/login" className="hover:text-obsidian">Entrar</Link>
            <span className="text-graphite-dim/70">© {new Date().getFullYear()} ESTATE OS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
