# Instruções para o agente no projeto bolao112-site

## Contexto do projeto

Este projeto é a versão WEB/PWA do Bolão 112 FC.

A versão WEB/PWA é a plataforma principal do Bolão 112 FC para usuários de Android e iPhone. As melhorias devem ser implementadas pensando na publicação direta no site real, com deploy automático pela Vercel após push na branch `main`.

O projeto é um single page app simples, sem React, sem Next.js e sem Vite.

Arquivos principais:
- `index.html`: estrutura da página, home pública, telas internas e navegação.
- `styles.css`: estilos visuais principais.
- `app.js`: lógica principal do app, autenticação, Firestore, renderização de telas e painel administrativo.
- `sw.js`: service worker da versão de desenvolvimento/raiz.
- `manifest.webmanifest`: manifesto PWA usado para instalação do app.
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
6. Não mexer em configurações de Firebase, Vercel ou GitHub sem autorização explícita.
7. Não alterar regras de negócio sensíveis sem autorização explícita.

Depois de alterar código:
1. Rodar `npm run build`.
2. Se o build passar, fazer commit com mensagem clara.
3. Fazer push para a branch `main`.
4. Informar quais arquivos foram modificados.
5. Informar que o usuário deve validar a melhoria diretamente no site oficial após o deploy da Vercel.

## Fluxo de publicação

O fluxo padrão é:
1. Implementar a melhoria diretamente para a versão WEB/PWA.
2. Rodar `npm run build`.
3. Corrigir qualquer erro de build antes de seguir.
4. Fazer commit com mensagem clara.
5. Fazer push para `main`.
6. Aguardar o deploy automático da Vercel.
7. O usuário valida no site oficial.

Não usar preview branch como etapa obrigatória.

Não rodar testes locais longos nem exigir validação local antes do push, a menos que o usuário peça explicitamente ou que a alteração seja arriscada o suficiente para justificar.

Nunca fazer commit, push ou deploy quando houver dúvidas sobre mudanças sensíveis sem pedir autorização explícita.

## Comandos importantes

Instalar dependências:

`npm install`

Gerar build:

`npm run build`

Rodar localmente:

`npm run dev`

Preview da pasta `dist`:

`npm run preview`

Acessar localmente:

`http://localhost:5173`
