# agenda-iphone

PWA de agenda profissional com visual estilo iOS. Publicado via GitHub Pages a partir
da raiz do repositório (`.nojekyll` presente).

## Arquitetura

Site estático, **sem build e sem gerenciador de pacotes**. Não existe `package.json`,
bundler, linter nem suíte de testes — os arquivos da raiz são exatamente o que o
navegador baixa.

- `index.html` — app principal (agenda, tarefas, J.A.R.V.I.S.). Carrega os módulos por
  `<script src>` no fim do arquivo, em ordem de dependência.
- Páginas independentes: `financeiro.html`, `carteira.html`, `investimentos.html`,
  `treino.html`, `refaturamento.html`, `gamificacao.html`, `importar.html`, entre outras.
- Cada funcionalidade fica em um `.js` próprio na raiz (`notas.js`, `treino.js`,
  `painel.js`, `finance-cycle.js`, …). O padrão é IIFE com `'use strict'`, sem módulos ES
  e sem imports.
- `sw.js` — service worker; `manifest.webmanifest` — instalação como PWA.
- `xlsx.full.min.js` — dependência de terceiro (vendorizada). Não editar.

## Convenções importantes

**Cache busting.** Os scripts são referenciados com um sufixo de versão, por exemplo
`./notas.js?v=8`. Ao alterar um arquivo `.js`, incremente o `?v=` em **todos** os HTML que
o carregam, senão o navegador serve a versão antiga do cache.

**Service worker.** `sw.js` abre com `const CACHE = 'agenda-lagares-v230-…'`. Mudanças que
precisam invalidar o cache exigem um novo nome de `CACHE` — a ativação apaga todos os
caches cujo nome não bate com o atual.

**Idioma.** Interface, comentários e mensagens de commit em português.

## Supabase

Backend em Supabase (auth, dados compartilhados, web push).

- `supabase/migrations/` — SQL versionado por data.
- `supabase/functions/agenda-web-push-worker/index.ts` — edge function de push.
- `supabase-project-config.js` — URL do projeto e *publishable key* (uso em navegador).
  Nunca colocar `service_role` ou qualquer chave de agente aqui.
- Ver `SUPABASE_SETUP.md` para a configuração e `agent.md` para o contrato da API
  `agenda-agent`.

## Como testar

Abra o HTML em um servidor local a partir da raiz do repositório — o service worker e os
caminhos relativos (`./arquivo.js`) exigem `http://`, não `file://`:

```bash
python3 -m http.server 8000
```
