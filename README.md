# ESTATE OS

> **One property in. An entire selling experience out.**
> Um imóvel entra. Uma experiência de venda completa sai.

Plataforma de marketing imobiliário assistida por IA, em português. Recebe a ficha de um
imóvel, produz conteúdo fundamentado nos factos confirmados, gera uma página pública
editorial com URL estável e recolhe contactos e pedidos de visita para um CRM real.

**Princípio central:** nada é inventado. A área, as vistas, os materiais, a morada exata, o
estado ou as licenças nunca são inferidos — quando faltam, o sistema diz que faltam.

---

## 1. Stack e arquitetura

| Camada | Decisão |
| --- | --- |
| Framework | Next.js 15 (App Router, React Server Components) |
| Linguagem | TypeScript estrito |
| UI | Tailwind CSS 3 + componentes acessíveis próprios; Geist + Instrument Serif |
| Persistência | SQLite (`better-sqlite3`) com schema relacional completo e índices |
| Validação | Zod 4 (contratos partilhados entre cliente e servidor) |
| IA | Abstração de fornecedor (`src/server/ai/provider.ts`); motor determinístico local como padrão |
| Jobs assíncronos | Fila em base de dados + scheduler in-process com retry e idempotência |
| Testes | `node:test` (unitário) + script e2e sobre HTTP |

O projeto não exige serviços externos para correr. Chaves de IA e de pagamento são opcionais
e explicitamente sinalizadas quando ausentes.

### Estrutura

```
src/
  app/                 rotas: landing, auth, /app (workspace), /p/[slug] (público), /api
  components/
    app/               wizard, editor, AI studio, experience builder, CRM, media, equipa
    public/            galeria com lightbox, assistente, formulário de visita, partilha
    ui/                primitivas e componentes cliente (toasts, modal, spinner)
  features/            espaço reservado para módulos de domínio extraídos
  lib/                 tipos, schemas Zod, etiquetas PT, formatação
  server/
    data/              acesso a dados por agregado (imóveis, leads, visitas, media, …)
    ai/                knowledge base, motor de produção, assistente, provider, studio
    jobs/              fila, execução, retry, scheduler
    schema.sql         definição da base de dados
scripts/               seed e reset
tests/                 testes unitários e e2e
```

### Modelo de dados

`organizations`, `organization_members`, `profiles`, `sessions`, `invitations`, `plans`,
`subscriptions`, `properties`, `property_specs`, `property_media`, `property_documents`,
`property_content`, `property_experiences`, `ai_jobs`, `ai_usage`, `leads`, `lead_events`,
`visits`, `conversations`, `conversation_messages`, `analytics_events`, `audit_logs`,
`privacy_requests`.

Chaves UUID, timestamps ISO, chaves estrangeiras, índices por `org_id` e restrições de
unicidade (referência por organização, slug público global).

**Isolamento multi-tenant:** todas as consultas filtram por `org_id` derivado da sessão. Um
ID de outra organização devolve `404`, não `403` — não confirma sequer a existência do registo.

---

## 2. Arranque

```bash
npm install
cp .env.example .env.local       # ajustar APP_SECRET
npm run db:seed                  # cria esquema + dados de demonstração
npm run dev                      # http://localhost:3000
```

Requisitos: Node 20+ (testado em Node 22) e ferramentas de build para `better-sqlite3`.

### Contas de demonstração

| Conta | Palavra-passe | Organização | Função |
| --- | --- | --- | --- |
| `helena@estateos.demo` | `EstateDemo2026!` | Atlântico Prime | owner |
| `tomas@estateos.demo` | `EstateDemo2026!` | Atlântico Prime | agent |
| `rui@heritage.demo` | `EstateDemo2026!` | Heritage Lisbon | owner (outra organização) |

Página pública de demonstração: `/p/villa-atlantica-cascais`.
Rascunho privado: `/p/apartamento-chiado-lisboa?preview=1` (requer sessão da organização).

> A organização de demonstração está marcada como tal: páginas públicas mostram um aviso de
> demonstração, as imagens são ilustrativas, a metadata `robots` é `noindex` e o JSON-LD inclui
> `disambiguatingDescription`. Não são apresentados testemunhos, clientes, resultados ou
> certificações fictícias em nenhum ponto do produto.

### Variáveis de ambiente

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `APP_SECRET` | sim (produção) | segredo para hashing de sessões |
| `NEXT_PUBLIC_APP_URL` | recomendada | base URL para links de partilha e canonical |
| `DATABASE_PATH` | não | caminho do ficheiro SQLite (default `./data/estate.db`) |
| `AI_PROVIDER` | não | `local` (default) ou `openai` |
| `OPENAI_API_KEY` | só com `AI_PROVIDER=openai` | chave lida exclusivamente no servidor |
| `OPENAI_BASE_URL` | não | endpoint compatível com OpenAI |
| `OPENAI_TEXT_MODEL` | não | modelo de texto |
| `OPENAI_VISION_MODEL` | não | modelo de visão (reservado; a análise de imagem local não é visual) |
| `AI_REQUEST_TIMEOUT_MS` | não | timeout do pedido ao fornecedor (default 45s) |

Sem chave configurada, a interface identifica o **motor determinístico** e nunca simula
respostas de modelo. Com chave configurada, a geração usa o modelo e mantém as mesmas regras:
só factos confirmados, falha com fallback para o motor local e registo de uso em `ai_usage`.

### Scripts

```bash
npm run dev        # servidor de desenvolvimento (0.0.0.0:3000)
npm run build      # build de produção
npm run start      # servidor de produção
npm run typecheck  # tsc --noEmit
npm run verify     # typecheck + testes unitários
npm test           # testes unitários (node:test + tsx)
npm run e2e        # fluxo completo contra um servidor a correr
npm run db:seed    # dados de demonstração (idempotente para planos)
npm run db:reset   # apaga e recria a base de dados
```

---

## 3. O que existe, por módulo

### Ingestão de imóveis (wizard de 5 passos)
1. **Informação** — título, tipo, operação, preço, localização, privacidade da morada.
2. **Características** — áreas, quartos, casas de banho, estacionamento, condição, ano,
   certificado energético, comodidades, características e vistas *confirmadas*.
3. **Conteúdo** — upload de fotografias e plantas com validação de formato/tamanho, legendas
   e associação a divisões.
4. **Verificação assistida** — pré-visualização sem escrever nada: observações por gravidade
   (`error` / `warning` / `info`), campos em falta, sugestões de classificação de imagem
   **pendentes de confirmação**, rascunho PT/EN e FAQ fundamentada. A interface distingue
   *Confirmado*, *Sugerido* e *Desconhecido*.
5. **Revisão** — resumo, confirmação e criação; os jobs selecionados entram na fila.

### Perfil do imóvel
Nove separadores: Overview, Specifications, Media, AI Content, Experience, Leads, Visits,
Documents, Activity. Inclui score de completude, proveniência, timeline e audit log.

### AI Studio
- **A. Listing Writer** — PT e EN, com resumo, características confirmadas, meta title,
  meta description e CTAs. Campos em falta são listados como não confirmados.
- **B. Audience Adaptation** — quatro enquadramentos (nacional, internacional, famílias,
  investidores). O enquadramento de investimento declara explicitamente que não são
  apresentadas projeções de rentabilidade.
- **C. Campaign Generator** — publicação social, legenda Instagram, anúncios, email,
  WhatsApp, argumentos comerciais, FAQ e guião de vídeo.
- **D. Cinematic Media Brief** — sequência de planos, movimento, duração, formatos e regras de
  produção. O payload marca `is_generated_video: false`: é um entregável de produção.
- **E. Image Enhancement** — separador dedicado que lista as fotografias originais e
  apresenta o serviço como **não configurado** enquanto não existir fornecedor. Qualquer
  alteração futura é rotulada como ilustrativa; não existe conversão de sugestões em factos.
- **F. Property Assistant** — ver secção seguinte.

Todo o conteúdo gerado nasce como **rascunho**, requer aprovação humana e mantém histórico de
versões (rascunhos anteriores passam a `archived`).

### Assistente do imóvel
Recuperação por pontuação de palavras-chave sobre os factos confirmados (dezenas de factos por
imóvel — um vector DB seria injustificado). A resposta cita rótulo, valor e origem; quando não
há factos devolve uma mensagem de desconhecimento explícita. Tópicos recorrentes que **não**
existem na ficha (arquiteto, consumo em kWh, condomínio, mobiliário, orientação solar,
distâncias, piso, ruído) são reconhecidos e declarados em falta. Questões jurídicas,
financeiras e técnicas são encaminhadas para o consultor, sem parecer.

### Pipeline de automação
Tipos: `validate_fields`, `analyze_media`, `generate_listing`, `generate_multilingual`,
`generate_audience_versions`, `generate_campaign`, `generate_media_brief`,
`prepare_experience`.

Estados: `queued → processing → needs_review | completed | failed`. Cada job tem ID, imóvel,
tipo, provider, tentativas, máximo de tentativas, output, erro e timestamps. A UI faz polling
sem bloquear; falhas podem ser repetidas. Jobs presos em `processing` após reinício são
reparados para `queued` no arranque do servidor.

### Experience Builder
Três layouts genuinamente diferentes (Architectural, Signature, Investment), pré-visualização
real em iframe com alternância desktop/mobile, edição de hero, contactos, mapa autorizado,
ordenação/ativação de secções, configuração de galeria (mosaico/grelha/carrossel, seleção de
imagens, legendas), guardar rascunho, publicar e despublicar. O URL público é estável em
`/p/[slug]`.

A publicação exige conteúdo aprovado e pelo menos uma fotografia aprovada; caso contrário a API
responde `409` com a razão. Rascunhos só são visíveis com sessão da mesma organização através
de `?preview=1`.

### Página pública
Hero por layout, Property Story, galeria com lightbox e navegação por teclado, especificações
(sem linhas vazias), destaques, localização (mapa esquemático apenas quando autorizado; morada
privada nunca exposta), assistente, pedido de visita/contacto com consentimento explícito,
CTA final, rodapé editorial. Inclui JSON-LD `RealEstateListing`, Open Graph, `lang="pt-PT"`, skip-link e foco visível.

### Leads & CRM
Pipeline New → Contacted → Qualified → Visit Scheduled → Offer → Won/Lost, em kanban
(com drag & drop) e tabela. Pesquisa, filtro por estado, atribuição de responsável, prioridade,
próxima ação, notas internas, histórico por lead, exportação CSV e registo de consentimento e
origem. **Não existe qualificação automática por atributos sensíveis** — a prioridade só muda
por ação humana.

### Visitas
Calendário mensal e lista. Estados `requested`, `confirmed`, `completed`, `cancelled`,
`rescheduled`. Uma visita nunca é confirmada automaticamente: a confirmação exige ação
autorizada e data/hora. Pedidos do formulário público entram como `requested`.

### Media Library
Upload multipart com validação de MIME e tamanho, organização por imóvel, legendas, divisões,
tags, estados de aprovação (`pending`/`approved`/`rejected`), visibilidade pública explícita,
imagem principal e acesso controlado. Ficheiros privados são servidos por rota
autenticada; não existe URL público adivinhável.

### Analítica
Apenas eventos reais (`page_view` deduplicado por 30 min, `cta_click`, `gallery_open`, `share`),
leads e visitas. Cada métrica tem definição e período visíveis. A conversão só é calculada com
≥30 visualizações **e** ≥3 leads; caso contrário mostra “dados insuficientes”.

### Equipa, planos e privacidade
Funções `owner` / `admin` / `agent` / `viewer` verificadas no servidor. Convites por link com
token (o envio de email não está configurado). Planos STARTER / PRO / AGENCY com quotas reais
aplicadas no backend (imóveis, jobs/mês, lugares); preços editáveis apenas por administração da
plataforma. **Não existe integração de pagamentos**: a subscrição apresenta-se como
`unconfigured`, nunca como ativa. Registo de pedidos RGPD e audit log por organização.

---

## 4. Segurança e privacidade

- Sessões em cookie `httpOnly`, `sameSite=lax` (e `secure` em produção); apenas o hash SHA-256
  do token é guardado.
- Palavras-passe com `scrypt` (N=16384) e salt por utilizador.
- Autorização por função em cada endpoint de escrita; `viewer` é sempre só leitura.
- Verificação de origem em todos os métodos não-GET (defesa CSRF adicional).
- Rate limiting por IP/página: signup 8/10 min, login 10/5 min, upload 40/min, contacto
  6/10 min, assistente 30/h, tracking 60/h.
- Validação Zod no servidor para todos os corpos de pedido.
- Documentos confidenciais apenas por rota autenticada e verificada por organização.
- Chaves de IA nunca expostas ao cliente.
- Audit log de criação, aprovação, publicação, alteração de plano e ações de equipa.

Limitações conhecidas de privacidade: a retenção é uma **política declarada** (não há purge
agendada nesta instância) e o tratamento de pedidos RGPD é manual, com registo em
`privacy_requests`.

---

## 5. Testes e verificação

```bash
npm run typecheck
npm test          # 22 testes unitários: factos, copy, FAQ, verificação, schemas, permissões
npm run e2e       # requer `npm run dev` noutro terminal
```

O e2e percorre: signup → duplicação de email → criação de imóvel → job de IA → rascunho não
aprovado automaticamente → aprovação → upload e aprovação de fotografia → criação e publicação
de experiência → render da página pública e OG → assistente fundamentado → tópico desconhecido
declarado → pedido de visita público → lead no CRM com origem e consentimento → visita em
`requested` → contacto sem consentimento rejeitado → tracking → isolamento entre organizações
(leitura e escrita) → limpeza.

---

## 6. Critérios de aceitação

| # | Critério | Estado |
| --- | --- | --- |
| 1 | Signup e login funcionam com sessão persistente | ✅ |
| 2 | Criar e editar imóvel | ✅ |
| 3 | Upload de fotografias com validação | ✅ |
| 4 | Dados persistem após recarregar/reiniciar | ✅ (SQLite) |
| 5 | Gerar conteúdo por integração configurada | ✅ com `AI_PROVIDER=openai`; sem chave usa motor local identificado |
| 6 | Rever e aprovar conteúdo antes de publicar | ✅ |
| 7 | Página pública por URL estável | ✅ |
| 8 | Pedido de contacto gera lead no CRM | ✅ (e2e) |
| 9 | Pedido de visita registado sem confirmação automática | ✅ (e2e) |
| 10 | Estado das tarefas visível com progresso real | ✅ |
| 11 | Isolamento entre organizações | ✅ (e2e: 404 em leitura e escrita) |
| 12 | Utilizável em mobile | ✅ (layout responsivo; ver nota) |
| 13 | Recuperação de erros | ✅ (error boundary, retry de jobs, toasts) |
| 14 | Estados loading/success/error/empty/unauthorized | ✅ |
| 15 | Testes dos fluxos principais, permissões e isolamento | ✅ (unit + e2e) |

**Nota sobre o critério 12:** a verificação foi feita por inspeção de markup e classes
responsivas; não foi possível executar um browser headless neste ambiente.

---

## 7. Limitações e dependências externas

| Tema | Estado |
| --- | --- |
| Chave de IA | opcional; sem chave, motor determinístico rotulado (não é um LLM) |
| Video generation | **não implementado por decisão de produto**; entrega-se o brief e os prompts |
| Image enhancement | interface preparada; sem fornecedor configurado, não há alteração de imagem |
| Pagamentos/faturação | não integrados; quotas reais aplicadas sem cobrança |
| Envio de email (convites) | não configurado; link de convite é partilhado manualmente |
| Mapa real | mapa esquemático servido localmente; sem tiles de terceiros |
| Análise visual de imagens | heurística por nome/legenda, marcada como sugestão pendente |
| Purge de retenção | política declarada, sem job agendado |
| Escala horizontal | melhor-sqlite + worker in-process; adequado a uma instância |

Sem chaves configuradas, nenhuma operação simula sucesso: ou é executada pelo motor
determinístico e rotulada, ou está desativada com instruções claras.
