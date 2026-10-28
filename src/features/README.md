# Features

Módulos de domínio extraídos do `app/` quando um fluxo passa a ter UI própria, estado
complexo e regras de negócio reutilizáveis.

A composição atual mantém a lógica de domínio em `src/server` (dados, IA, jobs) e os
componentes de interface em `src/components/app` e `src/components/public`. Esta pasta
existe como fronteira explícita: nada aqui deve aceder diretamente a `better-sqlite3` nem
depender de `cookies()`.

Regra de extração: um módulo entra em `features/<nome>` quando serve mais do que uma rota
e transporta regras — por exemplo `features/leads` (pipeline + atribuição) ou
`features/experiences` (configuração + publicação).
