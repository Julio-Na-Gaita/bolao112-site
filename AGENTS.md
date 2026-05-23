# Instruções para o agente no projeto bolao112-site

## Contexto do projeto

O nome correto do app/projeto é **Bolão 112 FC**.

Este projeto é a versão **WEB/PWA** do Bolão 112 FC e agora é a plataforma principal para usuários de Android e iPhone. A experiência deve priorizar uso no celular como PWA/app instalável.

O projeto é um single page app simples, sem React, sem Next.js e sem Vite. Mantenha o projeto simples e preserve a estrutura atual.

Arquivos principais:
- `index.html`: estrutura da página, home pública, telas internas e navegação.
- `styles.css`: estilos visuais principais.
- `app.js`: lógica principal do app, autenticação, Firestore, renderização de telas e painel administrativo.
- `sw.js`: service worker da versão de desenvolvimento/raiz.
- `manifest.webmanifest`: manifesto PWA usado para instalação do app.
- `scripts/build.mjs`: script de build.
- `api/send.js` e `api/cron.js`: funções serverless usadas na Vercel.
- `dist/`: pasta gerada pelo build.

## Fluxo oficial de trabalho

O fluxo oficial do projeto é:
1. Implementar a melhoria solicitada.
2. Rodar `npm run build`.
3. Se o build passar, fazer commit com mensagem clara.
4. Fazer push para a branch `main`.
5. A Vercel fará o deploy automático.
6. O usuário testará a melhoria diretamente no site oficial.

O build deve ser rodado antes do push.

Não usar preview branch como etapa obrigatória.

Não rodar testes locais longos nem exigir validação local antes do push, a menos que o usuário peça explicitamente ou que a alteração seja arriscada o suficiente para justificar.

## Regras de trabalho

Antes de alterar código:
1. Explique quais arquivos pretende alterar.
2. Explique o motivo da alteração.
3. Não faça alterações grandes sem explicar antes.
4. Aguarde confirmação do usuário quando a mudança for grande ou arriscada.

Ao alterar código:
1. Faça mudanças pequenas e fáceis de revisar.
2. Não reescreva arquivos inteiros sem necessidade.
3. Preserve a estrutura atual do projeto.
4. Não adicionar frameworks novos sem autorização.
5. Não alterar Firebase, Vercel, GitHub, variáveis sensíveis, chaves privadas, regras de segurança ou regras de negócio críticas sem autorização explícita.

Depois de alterar código:
1. Rodar `npm run build`.
2. Corrigir qualquer erro de build antes de seguir.
3. Se o build passar, fazer commit com mensagem clara.
4. Fazer push para a branch `main`.
5. Informar quais arquivos foram modificados.
6. Informar que o usuário deve validar a melhoria diretamente no site oficial após o deploy da Vercel.

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
