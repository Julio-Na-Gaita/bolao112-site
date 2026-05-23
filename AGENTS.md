# Instruções para o agente no projeto bolao112-site

## Contexto do projeto

Este projeto é a versão WEB do Bolão 112 FC.

O projeto é um single page app simples, sem React, sem Next.js e sem Vite.

Arquivos principais:
- `index.html`: estrutura da página, home pública, telas internas e navegação.
- `styles.css`: estilos visuais principais.
- `app.js`: lógica principal do app, autenticação, Firestore, renderização de telas e painel administrativo.
- `sw.js`: service worker da versão de desenvolvimento/raiz.
- `scripts/build.mjs`: script de build.
- `api/send.js` e `api/cron.js`: funções serverless usadas na Vercel.
- `dist/`: pasta gerada pelo build.

## Regras de trabalho

Antes de alterar código:
1. Explique quais arquivos pretende alterar.
2. Explique o motivo da alteração.
3. Aguarde confirmação do usuário quando a mudança for grande ou arriscada.

Ao alterar código:
1. Faça mudanças pequenas e fáceis de revisar.
2. Não reescreva arquivos inteiros sem necessidade.
3. Preserve a estrutura atual do projeto.
4. Não adicionar frameworks novos sem autorização.
5. Não alterar variáveis sensíveis ou chaves privadas.
6. Não mexer em configurações de Firebase, Vercel ou GitHub sem autorização.

Depois de alterar código:
1. Rodar `npm run build`.
2. Informar quais arquivos foram modificados.
3. Explicar como testar localmente.
4. Não fazer commit, push ou deploy sem autorização explícita do usuário.

## Comandos importantes

Instalar dependências:

`npm install`

Gerar build:

`npm run build`

Rodar localmente:

`npx http-server . -p 5173 -c-1`

Acessar localmente:

`http://localhost:5173`