# Contexto comum: versões minimalistas da tela de início

## Missão
O dono do app (PWA pessoal "Agenda Lagares", instalado na tela de início de um iPhone 17 Pro Max)
pediu: "Gera algumas versões minimalistas do aplicativo, queria uma mudança de layout da tela de
início".

A equipe vai produzir **4 variantes minimalistas** da tela de início. Elas ficam disponíveis como
**opção** num seletor do próprio app, para o dono experimentar com os dados reais e escolher uma. A
tela atual continua sendo o padrão: nenhuma variante pode mudar o app quando ninguém a escolheu.

## O app (repositório `/home/user/agenda-iphone`, servido em http://127.0.0.1:8765/)

### Tela de início (`index.html`, dentro de `<main class="app">`)
- **`header.topbar`:** "eyebrow" ("Organização pessoal"), `h1` ("Minha agenda") e `#currentDate`.
  À direita, `.head-actions` com:
  - `#seqTimerBtn` (cronômetro) e `#parceiroBtn` (olho), injetados por `header-cleanup.js`;
  - `#moreMenuBtn` (abre `#quickMenu`).
- **`section.summary`:** cartão "Progresso diário" com `#progressText` (ex. 1/8), barra `#progressBar` e
  `#progressMessage`.
- **`nav#viewTabs`:** abas `[data-view="day|month|list|sequencia"]` (Dia, Mês, Lista, Sequência).
- **`#seqEntryBtn`:** botão "Modo sequencial", injetado por `sequencial.js`.
- **`nav#filters`:** chips `[data-filter="all|late|done|work"]`.
- **`section#viewContent`:** a vista atual (calendário do mês, lista do dia, lista geral ou
  sequência), com `.task-card` e outros.
- **Flutuantes:**
  - `#agendaActions` com `#openDialog` ("+ Nova tarefa") e `#cardioFab` (de `treino.js`);
  - `#jarvis-btn` (assistente; abre `#jarvis-panel`);
  - `#app-ver` com `#app-update` e o selo da versão;
  - `#viewmode-btn` ("Desktop", de `viewmode.js`; só aparece em telas largas).

### Visual e temas
- Tema escuro é o padrão. O claro é `[data-theme="light"]` no `<html>` (botão no menu).
- Variáveis em `:root`: `--bg`, `--surface`, `--soft`, `--soft2`, `--text`, `--muted`, `--faint`,
  `--line`, `--accent`, `--accent2`, `--accentInk`, `--danger`, `--shadow`. O tema claro redefine as
  mesmas.
- A fonte e os ícones são os que já existem.

### Garantias da missão anterior (verificadas; não podem ser quebradas por nenhuma variante)
- Alvo de toque ≥ 44×44 px em todo controle solto. Pílulas pequenas usam a "faixa" `::before`.
- Nada clicável sob a Dynamic Island com rolagem 0, e nenhum fixo sob o indicador de início.
- Véu `body::before`, com a altura de `env(safe-area-inset-top)` e a cor de `--bg`.
- Sem rolagem lateral, no iPhone 17 Pro Max (440×956, área segura 62/34) e no iPhone 13
  (390×844, 47/34).
- O teste completo `/home/user/agenda-iphone/.orquestra/layout-17promax/testes/layout.cjs` passa
  431/431 no padrão.
- Inventário de elementos e medidas, se precisar: `.orquestra/layout-17promax/auditoria.md` e
  `especificacao.md`.

## Contrato técnico das variantes
- **Identificadores:** 4 ids curtos em minúsculas, sem acento (por exemplo `essencial`). O padrão se
  chama `atual`.
- **Arquivos:** cada variante vive em **um só arquivo CSS** `/home/user/agenda-iphone/estilos-inicio/<id>.css`.
  - Todas as regras ficam sob `html[data-home="<id>"]`. Nenhuma regra solta.
  - Isso garante que, sem o atributo, nada muda.
- **Escopo:** só CSS. Pode esconder, reordenar (`order`, grid), mudar tamanhos, espaçamentos e
  bordas, e usar as variáveis de cor existentes.
  - Não pode esconder uma função sem deixá-la alcançável. Pode movê-la visualmente ou deixá-la menos
    destacada, mas tem que continuar tocável na tela de início ou no menu (`#quickMenu`), sem perder
    nenhuma ação.
  - Exemplos: o cartão de progresso pode virar uma linha fina; o "Modo sequencial" pode virar ícone;
    os filtros podem ficar mais discretos.
  - Não mexa em `index.html`, nos `.js`, no `sw.js` nem nos arquivos de outra variante.
- **Temas:** cada variante funciona nos dois (escuro e claro).
- **Como visualizar uma variante sem o seletor** (Playwright, harness da missão anterior):
  ```js
  const { chromium } = require('/opt/node-tools/node_modules/playwright');
  const h = require('/home/user/agenda-iphone/.orquestra/layout-17promax/harness/medir.cjs');
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const { context, page } = await h.abrirApp(b, h.perfis.iphone17promax, {}); // área segura emulada, app aberto
  await page.addStyleTag({ path: '/home/user/agenda-iphone/estilos-inicio/<id>.css' });
  await page.evaluate(() => { document.documentElement.dataset.home = '<id>'; });
  // tema claro: document.documentElement.dataset.theme = 'light'
  await h.irPara(page, 'mes'); // ou 'dia', 'lista', 'menu', 'jarvis'
  const m = await h.medir(page, h.perfis.iphone17promax, 'mes'); // scrollWidth, interativosSobIlha, alvosPequenos…
  await page.screenshot({ path: '...png' });
  ```
  Use `page.screenshot` direto. O `h.capturar` desenha uma faixa vermelha de teste.
- **Capturas** em `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/inicio/<id>/`,
  com nomes `<perfil>-<vista>-<tema>.png`:
  - perfis: `iphone17promax` e `iphone13`;
  - vistas: `mes`, `dia`, `lista` e `menu`;
  - temas: `escuro` e `claro`.
- **Referência do estado atual:**
  `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/comparativo/depois-mes.png`,
  `depois-dia.png`, `depois-lista.png` e `depois-jarvis.png`. Abra com Read: são imagens.

## Regras gerais
- Não pergunte nada ao usuário. Decida pelo conservador e registre.
- Não faça commit, stash nem checkout.
- Todo número afirmado vem de medição sua.
