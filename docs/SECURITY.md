# Relatório de segurança — ESTATE OS

Auditoria e endurecimento executados sobre a aplicação existente (Next.js 15 App Router,
React 19, TypeScript, PostgreSQL via `pg`, Zod). O objetivo foi corrigir vulnerabilidades reais
sem alterar a arquitetura, o design ou o comportamento do produto.

Data: 2026-11. Âmbito: código em `src/`, `scripts/`, configuração de build e deploy, dependências.
Fora de âmbito: infraestrutura da base de dados gerida (Neon/Supabase) e testes destrutivos.

---

## 1. Método

1. Leitura do código de todos os 44 route handlers, da camada de dados (`src/server/data/*`),
   autenticação, armazenamento, auditoria e das páginas públicas.
2. Revisão da configuração de build (`next.config.ts`, `vercel.json`), variáveis de ambiente e
   ficheiros versionados (à procura de segredos).
3. `npm audit` sobre a árvore de dependências.
4. Correção por ordem de gravidade, reutilizando os mecanismos existentes (`ApiError`,
   `authed()`, `roles`, `logAudit`, `blob`, `q()`).
5. Verificação: `tsc`, testes unitários novos, e2e contra um servidor de produção local, e
   provas por pedido HTTP real (XSS, cookies, cabeçalhos, uploads, convites).

---

## 2. Vulnerabilidades encontradas e corrigidas

### Críticas / altas

| # | Vulnerabilidade | Onde | Evidência antes | Correção |
| --- | --- | --- | --- | --- |
| 1 | **XSS armazenado** no JSON-LD da página pública. `JSON.stringify` era injetado em `<script type="application/ld+json">`; um título com `</script>` fechava a tag e injetava HTML/JS. | `src/app/p/[slug]/page.tsx` | Título `Villa </script><script>alert(1)</script> Atlântica` gravado via API e devolvido cru no HTML | `escapeInlineJson()` (`src/server/security.ts`) escapa `<`, `>`, `&`, U+2028/U+2029 |
| 2 | **Erro de SQL em produção**: `INSERT OR IGNORE` (sintaxe SQLite) na aceitação de convites. | `src/server/data/team.ts` | Qualquer aceitação de convite falhava com erro de sintaxe PostgreSQL | `INSERT … ON CONFLICT (org_id, profile_id) DO NOTHING` |
| 3 | **Tokens de convite em claro** na tabela e devolvidos por `GET /api/team` a qualquer administrador. | `src/server/data/team.ts` | `listInvitations` fazia `SELECT i.*` (incluía `token`) | Hash SHA-256; a listagem não expõe o token; novo `POST /api/team/invitations/[id]/link` emite um link novo e invalida o anterior |
| 4 | **Convite reutilizável por terceiros**: o link podia ser aceite por qualquer conta autenticada. | `src/server/data/team.ts` | `acceptInvitation` só verificava o token | Passa a exigir que o email do perfil corresponda ao email convidado (`403 invite_email_mismatch`) |
| 5 | **Uploads sem verificação de conteúdo**: o MIME era o declarado pelo browser. | `src/server/data/media.ts` | Um ficheiro HTML enviado como `image/jpeg` era aceite | `assertFileSignature()` compara *magic bytes* com a família declarada → `415 content_mismatch` |
| 6 | **IDOR no identificador do visitante** do assistente público: cookie não assinado controlava a conversa. | `src/app/api/public/[slug]/assistant/route.ts` | Cookie forjado `estate_visitor=<uuid>` reaproveitava a conversa desse id | Cookie assinado com HMAC-SHA256 (`signVisitorKey`/`verifyVisitorKey`); valor inválido gera visitante novo |
| 7 | **Autorização em falta em escritas**: `viewer` conseguia acionar a fila de IA, criar pedidos de privacidade, marcar revisão de conversas e pedir retries. | `api/jobs/tick`, `api/privacy`, `api/conversations/[id]`, `api/jobs/[id]/retry`, `api/properties/verify` | Sem verificação de função | `canEdit`/`canManageOrg` aplicados nos cinco endpoints |
| 8 | **Injeção de fórmulas no CSV de leads** (exportação aberta em Excel/Sheets). | `src/server/data/leads.ts` | `=HYPERLINK("http://…")` num lead ficava ativo na folha | `csvCell()` prefixa `'` a valores com `=`, `@`, tab, CR ou `±` seguido de não-dígito; telemóveis `+351…` continuam legíveis |

### Médias

| # | Problema | Correção |
| --- | --- | --- |
| 9 | Erros do fornecedor de IA devolviam ao browser 400 caracteres do corpo do upstream | Corpo registado no servidor com `redact()`; cliente recebe apenas o estado HTTP |
| 10 | `console.error("[api] unhandled", error)` imprimia objetos `pg` com `detail` (valores de colunas e emails) | `errorResponse` regista apenas `name`/`message` após `redact()` |
| 11 | Logs de auditoria podiam conter segredos em `meta` | `logAudit` grava `redact(meta)`; `security_events` idem; credenciais em URLs são mascaradas |
| 12 | Sem CSP; apenas headers básicos | `Content-Security-Policy` global (`object-src 'none'`, `frame-ancestors 'self'`, `form-action 'self'`, `base-uri 'self'`, `upgrade-insecure-requests` em produção) + COOP/CORP |
| 13 | Ficheiros servidos sem política própria; documentos em `inline` | CSP `default-src 'none'; sandbox` + `X-Frame-Options: DENY`; só imagens ficam `inline`, o resto é `attachment` |
| 14 | `/api/health` público expunha o número de organizações e a mensagem crua do driver | Contagens e erro só com `HEALTH_TOKEN` (16+ caracteres, comparação em tempo constante) |
| 15 | Enumeração de contas por tempo de resposta no login (scrypt só corria para emails existentes) | Verificação contra um hash descartável quando o perfil não existe |
| 16 | Política de palavras-passe fraca (8 caracteres, sem verificação) | Mínimo 10, bloqueio de palavras-passe comuns, do próprio email e de padrões triviais; mensagem devolvida em `422 weak_password` |
| 17 | Sessões: 30 dias sem renovação nem limpeza; sem registo de tentativas falhadas | Token novo em cada login, remoção de sessões expiradas do perfil; `auth.login`, `auth.login_failed`, `access.denied` em `security_events` |
| 18 | Rate limiting com mapa que crescia indefinidamente | Limpeza de baldes expirados acima de 10 000 chaves |
| 19 | `guardOrigin` comparava apenas com o header `host`, falhando atrás de proxy | Aceita `x-forwarded-host`, `NEXT_PUBLIC_APP_URL` e `VERCEL_URL` |
| 20 | Chaves de armazenamento podiam conter `../` (escape do diretório com `STORAGE_DRIVER=fs`) | `isSafeStorageKey()` em `put`/`get`/`remove` |
| 21 | Nomes de coluna interpolados em `UPDATE` sem validação | `assertIdentifiers()` nos cinco construtores dinâmicos (`properties`, `property_specs`, `property_experiences`, `leads`, `media`, `visits`) |
| 22 | `theme.accent` aceitava qualquer string até 20 caracteres, injetada em CSS | Regex `^#[0-9a-fA-F]{6}$` no schema |
| 23 | `postcss` vulnerável (XSS via `</style>`, leitura arbitrária de `.map`) transitivo de `next` | `overrides: { postcss: "^8.5.32" }`; `npm audit` → **0 vulnerabilidades** |
| 24 | Erros de configuração silenciosos (`COOKIE_SECURE=false` em produção, `sslmode=disable`) | Avisos explícitos no arranque (`config().warnings`) |

### Verificado sem alterações necessárias

- **Segredos**: nenhum ficheiro com credenciais versionado (`git ls-files` só tem
  `.env.example` com valores de exemplo). Nenhuma variável sensível exposta ao cliente:
  o único `NEXT_PUBLIC_*` é `NEXT_PUBLIC_APP_URL`.
- **SQL injection**: todas as consultas usam parâmetros ligados (`q()` converte `?` em `$n` e
  ignora literais); os `LIKE` usam parâmetros; `ORDER BY`/`LIMIT` nunca são interpolados.
- **Isolamento multi-tenant**: todas as leituras/escritas filtram `org_id`; o e2e confirma leitura
  e escrita cruzadas bloqueadas (`404`).
- **Mass assignment**: os schemas Zod enumeram campos; `updateOrg` faz merge controlado.
- **Sessão**: cookie `httpOnly`, `sameSite=lax`, `secure` em produção, token de 256 bits guardado
  apenas como hash, `scrypt` com salt por utilizador e comparação em tempo constante.

---

## 3. Ficheiros modificados

Novos:

- `src/server/security.ts` — hash de tokens, comparação constante, redação de logs, escape de
  JSON inline, validação de identificadores e de chaves de armazenamento, *sniffing* de uploads,
  política de palavras-passe, assinatura do visitante, `csvCell`.
- `src/app/api/team/invitations/[id]/link/route.ts` — emissão de link de convite.
- `tests/security.test.ts` — 12 testes.
- `docs/SECURITY.md` (este relatório).

Alterados:

`next.config.ts`, `src/server/db.ts`, `src/server/blob.ts`, `src/server/audit.ts`,
`src/server/auth.ts`, `src/server/http.ts`, `src/server/env.ts`, `src/server/schema.sql`,
`src/server/ai/provider.ts`, `src/server/data/{media,team,leads,visits,properties,experiences}.ts`,
`src/lib/schemas.ts`, `src/app/layout.tsx`, `src/app/join/page.tsx`, `src/app/p/[slug]/page.tsx`,
`src/app/api/auth/{login,signup}/route.ts`, `src/app/api/health/route.ts`,
`src/app/api/{privacy,jobs,conversations,properties}/…`, `src/app/api/media/[id]/file/route.ts`,
`src/app/api/documents/[id]/file/route.ts`, `src/components/auth/auth-form.tsx`,
`src/components/app/team-manager.tsx`, `tests/e2e.mjs`, `tests/security.test.ts`,
`README.md`, `.env.example`, `package.json`.

---

## 4. Impacto operacional

- **Base de dados**: nova tabela `security_events` (org_id opcional). O esquema é aplicado
  automaticamente no primeiro pedido a uma base desatualizada (`ensureSchemaOnce`, sob
  `pg_advisory_lock`), com SQL exclusivamente `CREATE … IF NOT EXISTS`. Não há migração
  destrutiva nem alteração de colunas. `AUTO_MIGRATE=0` mantém o passo manual.
- **Convites existentes**: passam a exigir um link reemitido (os tokens antigos guardados em
  claro deixaram de corresponder ao hash). A UI tem o botão de reemissão na lista de convites.
- **Palavras-passe**: a política nova aplica-se a novos registos; contas existentes continuam a
  autenticar-se normalmente.
- **Novas variáveis**: `HEALTH_TOKEN` (opcional, recomendada em produção), `AUTO_MIGRATE`
  (opcional, por omissão ligado).
- **`/api/health`**: resposta pública mais curta (sem contagens nem mensagens do driver).

---

## 5. Verificação executada

| Verificação | Resultado |
| --- | --- |
| `npx tsc --noEmit` | 0 erros |
| `npm test` | 34 testes, 0 falhas (12 novos de segurança) |
| `npm run e2e` (servidor de produção local) | 44 asserções, todas verdes — inclui CSP, `nosniff`, `401` sem sessão, `403` cross-origin, `403` em configuração de planos, cookie `HttpOnly`/`SameSite`, upload disfarçado recusado (`415`), isolamento entre organizações |
| `npm audit` | 0 vulnerabilidades (antes: 1 alta + 1 moderada) |
| `npm run build` | sucesso, sem base de dados acessível |
| XSS | título com `</script><script>alert(1)</script>` publicado: HTML servido contém `\u003c/script\u003e` e nenhuma tag crua |
| Ficheiros | `GET /api/documents/<id>/file` → `Content-Disposition: attachment`, `CSP … sandbox`, `X-Frame-Options: DENY` |
| Convites | token com 32 caracteres aceite uma vez, reutilização → `404`; email errado → `403`; rotação invalida o link anterior |
| Visitante do assistente | dois pedidos com cookie forjado criam duas conversas (não reaproveitam a existente) |
| Logs | login falhado registado em `security_events` com email e IP, sem palavra-passe; `access.denied` registado por rota |

---

## 6. Riscos pendentes (declarados, não resolvidos)

1. **Rate limiting em memória.** Conta por instância; em serverless, N instâncias multiplicam o
   limite. Correção definitiva: Redis/Upstash ou limitação no edge.
2. **CSP com `'unsafe-inline'` em `script-src`.** Necessário porque o Next injeta bootstrap inline
   sem nonce. Exigiria middleware com nonce e renderização dinâmica.
3. **`x-forwarded-for` é confiável apenas atrás de proxy** (Vercel define-o). Num servidor exposto
   diretamente, o cliente pode rodá-lo e evadir limites.
4. **Sem segundo fator, verificação de email ou recuperação de palavra-passe.** Não existem no
   produto; um utilizador sem acesso à conta não tem caminho de recuperação.
5. **Sessão única de 30 dias, sem reautenticação** para operações sensíveis (alteração de plano,
   exportação de leads).
6. **Alteração de plano é self-service sem faturação.** O `PATCH /api/org` aceita `plan_code`;
   fica registado em auditoria mas não há pagamento a validar. É uma decisão de produto
   ("planos configuráveis, sem faturação fictícia"), não um bug — mas permite subir de plano sem
   contrapartida.
7. **Um perfil autenticado pertence a uma organização por sessão** (`authenticate` escolhe a
   primeira adesão). Não há seletor de organização; consequência: testes de função `viewer` em
   convites só são exercitáveis em fluxo real, não no e2e atual.
8. **Prompt injection no AI Studio.** O conteúdo do utilizador chega ao modelo; há instruções de
   sistema e conteúdo sempre revisto por humanos antes de publicar, mas não há filtragem
   semântica de *prompts* maliciosos.
9. **Objetos em PostgreSQL (`blobs`)** continuam a ser uma escolha de durabilidade; migrar para
   armazenamento de objetos reduz custo e latência, não é um requisito de segurança.
10. **Sem pipeline de CI** a correr `typecheck`/`test`/`audit` em cada push; a verificação é manual
    (`npm run verify`, `npm run e2e`).
11. **Retenção de logs**: `security_events` e `audit_logs` não têm purga automática; a política de
    retenção é declarada, não aplicada.
12. **Bot protection** na página pública: apenas *honeypot* + limite por IP.

---

## 7. Como verificar localmente

```bash
npm ci
npm run db:init          # opcional: o esquema é criado no primeiro pedido
npm run typecheck
npm test                 # 34 testes, inclui tests/security.test.ts
npm run build && COOKIE_SECURE=false npm run start
npm run e2e              # 44 asserções contra o servidor a correr
npm audit                # deve devolver 0 vulnerabilidades
```
