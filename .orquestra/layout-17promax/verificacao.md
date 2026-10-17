# Verificação independente de layout (F5): Agenda Lagares, iPhone 17 Pro Max × iPhone 13

Frente F5 da missão `layout-17promax`. Fiz só medição. Não editei nenhum arquivo do app.
Não li `relatorio-F3.md`, `relatorio-F4.md`, `git diff` nem `git log`.

> **Rodada 2 (17/10/2026, tarde):** o resultado atual está na seção [Rodada 2](#rodada-2-devolução-do-coordenador), no fim
> deste arquivo: **431 verificações, 430 ok, 1 FALHOU** (extra, pré-existente, `S6.6.financeiro.bruto`). As seções
> abaixo, até (e), são da rodada 1 e ficam como histórico.

- **Data:** 17/10/2026.
- **Ambiente:**
  - Chromium 141.0.7390.37 (`/opt/pw-browsers/chromium-1194`) com o Playwright de `/opt/node-tools`.
  - Servidor local em http://127.0.0.1:8765/, servindo a árvore de trabalho atual (`sw.js` = `agenda-lagares-v246-mais-leve`).
- **Área segura:** emulada pelo CDP `Emulation.setSafeAreaInsetsOverride`, através do `abrirApp` do harness. Em cada
  abertura conferi o `env()` com uma sonda, e todas bateram:
  - 62/34 no 17 Pro Max;
  - 47/34 no 13;
  - 20/20/62/62 na paisagem.

## Resumo

`node .orquestra/layout-17promax/testes/layout.cjs` fez **384 verificações: 381 ok e 3 FALHOU**. O código de saída
foi 1.

Rodei duas vezes seguidas e as saídas ficaram **idênticas byte a byte** (`diff` vazio). Antes de acrescentar o id
extra `S6.10.paisagem.jarvis.entrada`, eu já tinha rodado outras três vezes, com 383 ids. Duas dessas execuções
também foram idênticas byte a byte. A primeira deu o mesmo conjunto de ids e resultados; ela ainda imprimia o tempo
das suítes.

| Critério | ok | FALHOU |
|---|---|---|
| S6.1 sem rolagem lateral | 22 | 0 |
| S6.2 ilha e indicador | 62 | 0 |
| S6.3 alvos de toque | 108 | 0 |
| S6.4 largura aproveitada | 25 | 0 |
| S6.5 sem regressão (9 suítes, unidade, erros de JS) | 13 | 0 |
| S6.6 páginas auxiliares | 82 | 0 |
| S6.7 véu | 17 | 0 |
| S6.8 versões e trechos | 19 | **1** (`S6.8.marketplace/index.html`, defeito da especificação, ver (c)) |
| S6.9 orçamento vertical e toast | 8 | 0 |
| S6.10 paisagem | 6 | **2** (`S6.10.paisagem.jarvis.painel` e o extra `S6.10.paisagem.jarvis.entrada`) |
| P1 a P6 (definição de pronto) | 19 | 0 |

**Veredito curto:**

- No retrato, os dois perfis passam em tudo o que a seção 6 e o pronto pedem.
- O iPhone 13 não piorou em nenhum número medido.
- O que falha está todo na **paisagem**, no painel do Jarvis:
  - o painel invade a faixa de cima. Isso já acontecia na v246 publicada;
  - **e é uma regressão nova:** a linha de entrada (microfone, campo e enviar) fica com 22,2 px dos 44 escondidos pelo
    `overflow:hidden` do painel. Na v246 publicada ela cabia inteira.
- A falha de texto do `marketplace/index.html` vem da especificação, não do app.

**Arquivos:**

- Teste: `.orquestra/layout-17promax/testes/layout.cjs`.
- Saída completa da última execução: `.orquestra/layout-17promax/testes/saida-layout.txt`.
- Medidas brutas: `.orquestra/layout-17promax/testes/resultado-layout.json`.

### Como o teste mede (independente do harness)

O harness só abre a página, navega entre as vistas (`irPara`) e captura as telas. As decisões de ok e FALHOU vêm de
`page.evaluate` próprios:

- **`coletarPagina`** pega os interativos visíveis. Considera
  `button, a, input, select, textarea, summary, [role=button|tab|link|checkbox|switch|menuitem]` e descarta o que for
  inerte, o que estiver atrás de um diálogo modal, `visibility` diferente de `visible`, `pointer-events:none`,
  `display:none` em algum ancestral e opacidade < 0,05 (um campo transparente sobre um rótulo continua valendo).
  - Para cada um guarda o retângulo bruto e o recortado pelos ancestrais com `overflow` diferente de `visible`.
  - Marca como "fixo" o elemento que tem `position` `fixed` ou `sticky` nele ou num ancestral.
  - Também conta o transbordo horizontal e lê o `scrollWidth`.
- **Nível B:** o botão é rolado para o meio da tela com `scrollIntoView({block:'center'})`. Depois, `elementFromPoint`
  a 6 px acima e a 6 px abaixo tem de devolver o próprio botão (ou um descendente).
- **Véu:** `getComputedStyle(body,'::before')`. Com a página rolada, `elementFromPoint` no centro da parte de cada
  interativo que fica dentro da faixa.
- **Topo das auxiliares:** o menor `top` entre os textos visíveis (pelas `Range.getClientRects`) e os controles,
  `svg` e `img` visíveis da página, com rolagem 0.
- **S6.8:** contagem de linhas que contêm cada trecho, que é a semântica do `grep -cF`.
- **Conferência cruzada:** o `medir()` do harness também roda e aparece na medida (`medir(): …`) nas linhas S6.1,
  S6.2, S6.3 e S6.6. Em todas as vistas ele concordou com a medição própria.

**Tolerâncias:**

- 0,5 px nas igualdades, como pede a seção 6;
- ±2 no `top` da S6.9, como a especificação indica;
- nos predicados `≥ 44` e `≥ 28`, só 0,01 de ruído de ponto flutuante, porque a especificação dá o predicado explícito
  `w ≥ 44 && h ≥ 44`.

## (a) Resultado de cada id, nos dois perfis

Cada célula traz o resultado e a medida obtida. As medidas longas foram cortadas com "…"; a versão inteira de cada
linha está em `testes/saida-layout.txt`. Um "—" quer dizer que a especificação não pede aquele id naquele perfil:
S6.9 confere as alturas só no 17PM, e P3 é só do 17PM.

### (a.1) App, dois perfis (`‹p›` = `17pm` ou `13`)

| id | verificação | iphone17promax | iphone13 |
|---|---|---|---|
| `S6.1.‹p›.mes` | sem rolagem lateral em mes | ok — scrollWidth 440, transbordando 0; medir(): sw 440, transb 0 | ok — scrollWidth 390, transbordando 0; medir(): sw 390, transb 0 |
| `S6.2.‹p›.mes.ilha` | nenhum interativo sob a ilha (top < inset top: 62 / 47) em mes | ok — 0; scrollY 0; medir(): 0 | ok — 0; scrollY 0; medir(): 0 |
| `S6.2.‹p›.mes.indicador` | nenhum interativo fixo sob o indicador (bottom > H − inset bottom: 922 / 810) em mes | ok — 0; medir(): 0 | ok — 0; medir(): 0 |
| `S6.2.‹p›.mes.folga8` | nenhum fixo interativo a menos de 8 px da faixa do indicador em mes | ok — 4 fixos, menor folga 10 | ok — 4 fixos, menor folga 10 |
| `S6.3.‹p›.mes.pequenos` | alvos < 44 em mes só os permitidos pela especificação | ok — próprio: 0 pequenos, 0 fora da lista; medir().alvosPequenos fora da lista: 0 | ok — próprio: 0 pequenos, 0 fora da lista; medir().alvosPequenos fora da lista: 0 |
| `S6.3.‹p›.mes.#viewTabs.view-tab` | alvo #viewTabs .view-tab ≥ 44×44 | ok — 4× 96.5×44 | ok — 4× 84×44 |
| `S6.3.‹p›.mes.#filters.chip` | alvo #filters .chip ≥ 44×44 | ok — 4× 66.7×44 / 92.6×44 / 99.5×44 / 84.1×44 | ok — 4× 66.7×44 / 92.6×44 / 99.5×44 / 84.1×44 |
| `S6.3.‹p›.mes.#calFullBtn` | alvo #calFullBtn ≥ 44×44 | ok — 1× 44×44 | ok — 1× 44×44 |
| `S6.3.‹p›.mes.#seqTimerBtn` | alvo #seqTimerBtn ≥ 44×44 | ok — 1× 46×46 | ok — 1× 46×46 |
| `S6.3.‹p›.mes.#parceiroBtn` | alvo #parceiroBtn ≥ 44×44 | ok — 1× 46×46 | ok — 1× 46×46 |
| `S6.3.‹p›.mes.#moreMenuBtn` | alvo #moreMenuBtn ≥ 44×44 | ok — 1× 46×46 | ok — 1× 46×46 |
| `S6.3.‹p›.mes.#openDialog` | alvo #openDialog ≥ 44×44 | ok — 1× 148.8×54 | ok — 1× 148.8×54 |
| `S6.3.‹p›.mes.#jarvis-btn` | alvo #jarvis-btn ≥ 44×44 | ok — 1× 56×56 | ok — 1× 56×56 |
| `S6.3.‹p›.mes.#app-update` | alvo #app-update ≥ 44×44 | ok — 1× 44×44 | ok — 1× 44×44 |
| `S6.3.‹p›.mes.#seqEntryBtn` | alvo #seqEntryBtn ≥ 44×44 | ok — 1× 408×44 | ok — 1× 358×44 |
| `S6.4.‹p›.larguraConteudo` | largura do .app | ok — 440 | ok — 390 |
| `S6.4.‹p›.larguraConteudoInterna` | largura interna do .app | ok — 408 | ok — 358 |
| `S6.4.‹p›.celulaCalendario` | largura da célula do calendário | ok — 52.6 | ok — 46 |
| `S6.4.‹p›.celulaCalendarioAltura` | altura da célula do calendário | ok — 91 | ok — 78 |
| `S6.4.‹p›.calendarTagFont` | font-size da .calendar-tag | ok — 9px | ok — 8px |
| `S6.9.‹p›.viewTabs` | #viewTabs altura | ok — 54 | — |
| `S6.9.‹p›.seqEntryBtn` | #seqEntryBtn altura | ok — 44 | — |
| `S6.9.‹p›.filters` | #filters altura | ok — 60 | — |
| `S6.9.‹p›.toolbar` | .toolbar altura (Mês) | ok — 62 | — |
| `S6.9.‹p›.celulaTop` | top da primeira .calendar-day (rolagem 0) | ok — 598.2 | ok — 611.9 |
| `S6.7.‹p›.mes.estilo` | body::before é o véu (fixed, altura = inset top, z 60, cor do body) em mes | ok — position fixed, height 62px, z 60, content "", bg rgb(5, 5, 6) / body rgb(5, 5, 6) | ok — position fixed, height 47px, z 60, content "", bg rgb(5, 5, 6) / body rgb(5, 5, 6) |
| `S6.9.‹p›.toast` | toast forçado: bottom = H − insetB − 184 e acima do #cardioFab | ok — bottom 738, #cardioFab top 749 | ok — bottom 626, #cardioFab top 637 |
| `S6.1.‹p›.dia` | sem rolagem lateral em dia | ok — scrollWidth 440, transbordando 0; medir(): sw 440, transb 0 | ok — scrollWidth 390, transbordando 0; medir(): sw 390, transb 0 |
| `S6.2.‹p›.dia.ilha` | nenhum interativo sob a ilha (top < inset top: 62 / 47) em dia | ok — 0; scrollY 0; medir(): 0 | ok — 0; scrollY 0; medir(): 0 |
| `S6.2.‹p›.dia.indicador` | nenhum interativo fixo sob o indicador (bottom > H − inset bottom: 922 / 810) em dia | ok — 0; medir(): 0 | ok — 0; medir(): 0 |
| `S6.2.‹p›.dia.folga8` | nenhum fixo interativo a menos de 8 px da faixa do indicador em dia | ok — 4 fixos, menor folga 10 | ok — 4 fixos, menor folga 10 |
| `S6.3.‹p›.dia.pequenos` | alvos < 44 em dia só os permitidos pela especificação | ok — próprio: 16 pequenos, 0 fora da lista; permitidos: #viewContent button.notas-toggle 93.3×28 ×8, #viewContent button.agenda-share 98.6×28 ×8; medir().a… | ok — próprio: 16 pequenos, 0 fora da lista; permitidos: #viewContent button.notas-toggle 93.3×28 ×8, #viewContent button.agenda-share 98.6×28 ×8; medir().a… |
| `S6.3.‹p›.dia.#viewContent.nav-btn` | alvo #viewContent .nav-btn ≥ 44×44 | ok — 2× 44×44 | ok — 2× 44×44 |
| `S6.3.‹p›.dia.#viewContent.check` | alvo #viewContent .check ≥ 44×44 | ok — 8× 44×44 | ok — 8× 44×44 |
| `S6.3.‹p›.dia.#viewContent.task-reschedule` | alvo #viewContent .task-reschedule ≥ 44×44 | ok — 8× 44×44 | ok — 8× 44×44 |
| `S6.3.‹p›.dia.#viewContent.day-pick-input` | alvo #viewContent .day-pick-input ≥ 44×44 | ok — 1× 96.2×44 | ok — 1× 96.2×44 |
| `S6.4.‹p›.taskMain` | largura de #viewContent .task-main (todos, vista dia) | ok — 8 cartões, 296–296 | ok — 8 cartões, 246–246 |
| `S6.3.‹p›.dia.B.notas-toggle` | nível B .notas-toggle: h ≥ 28 e toque 6 px acima/abaixo cai no botão | ok — 8 botões, h 28–28, toque ok 8/8 | ok — 8 botões, h 28–28, toque ok 8/8 |
| `S6.3.‹p›.dia.B.agenda-share` | nível B .agenda-share: h ≥ 28 e toque 6 px acima/abaixo cai no botão | ok — 8 botões, h 28–28, toque ok 8/8 | ok — 8 botões, h 28–28, toque ok 8/8 |
| `S6.1.‹p›.lista` | sem rolagem lateral em lista | ok — scrollWidth 440, transbordando 0; medir(): sw 440, transb 0 | ok — scrollWidth 390, transbordando 0; medir(): sw 390, transb 0 |
| `S6.2.‹p›.lista.ilha` | nenhum interativo sob a ilha (top < inset top: 62 / 47) em lista | ok — 0; scrollY 0; medir(): 0 | ok — 0; scrollY 0; medir(): 0 |
| `S6.2.‹p›.lista.indicador` | nenhum interativo fixo sob o indicador (bottom > H − inset bottom: 922 / 810) em lista | ok — 0; medir(): 0 | ok — 0; medir(): 0 |
| `S6.2.‹p›.lista.folga8` | nenhum fixo interativo a menos de 8 px da faixa do indicador em lista | ok — 4 fixos, menor folga 10 | ok — 4 fixos, menor folga 10 |
| `S6.3.‹p›.lista.pequenos` | alvos < 44 em lista só os permitidos pela especificação | ok — próprio: 130 pequenos, 0 fora da lista; permitidos: #viewContent button.list-previous 118.5×28, #viewContent button.notas-toggle 93.3×28 ×52, #viewCon… | ok — próprio: 130 pequenos, 0 fora da lista; permitidos: #viewContent button.list-previous 118.5×28, #viewContent button.notas-toggle 93.3×28 ×52, #viewCon… |
| `S6.3.‹p›.lista.#clearDone` | alvo #clearDone ≥ 44×44 | ok — 1× 124.5×44 | ok — 1× 124.5×44 |
| `S6.3.‹p›.lista..list-more` | alvo .list-more ≥ 44×44 | ok — 1× 192.8×44 | ok — 1× 192.8×44 |
| `S6.3.‹p›.lista.#viewContent.check` | alvo #viewContent .check ≥ 44×44 | ok — 60× 44×44 | ok — 60× 44×44 |
| `S6.3.‹p›.lista.#viewContent.task-reschedule` | alvo #viewContent .task-reschedule ≥ 44×44 | ok — 60× 44×44 | ok — 60× 44×44 |
| `S6.7.‹p›.lista.estilo` | body::before é o véu (fixed, altura = inset top, z 60, cor do body) em lista | ok — position fixed, height 62px, z 60, content "", bg rgb(5, 5, 6) / body rgb(5, 5, 6) | ok — position fixed, height 47px, z 60, content "", bg rgb(5, 5, 6) / body rgb(5, 5, 6) |
| `S6.7.‹p›.lista.rolado` | rolado 400: elementFromPoint(220,31) é o body e todo interativo sob a faixa fica coberto | ok — scrollY 400, ponto=body; população da C1: cobertos 7 de 7 (2 invisíveis: #themeToggle, #equipamentosBtn); só visíveis: cobertos 5 de 5 | ok — scrollY 400, ponto=body; população da C1: cobertos 3 de 3 (2 invisíveis: #themeToggle, #equipamentosBtn); só visíveis: cobertos 1 de 1 |
| `S6.3.‹p›.lista.B.notas-toggle` | nível B .notas-toggle: h ≥ 28 e toque 6 px acima/abaixo cai no botão | ok — 52 botões, h 28–28, toque ok 52/52 | ok — 52 botões, h 28–28, toque ok 52/52 |
| `S6.3.‹p›.lista.B.agenda-share` | nível B .agenda-share: h ≥ 28 e toque 6 px acima/abaixo cai no botão | ok — 60 botões, h 28–28, toque ok 60/60 | ok — 60 botões, h 28–28, toque ok 60/60 |
| `S6.3.‹p›.lista.B.tr-open` | nível B .tr-open: h ≥ 28 e toque 6 px acima/abaixo cai no botão | ok — 17 botões, h 28–28, toque ok 17/17 | ok — 17 botões, h 28–28, toque ok 17/17 |
| `S6.3.‹p›.lista.B.list-previous` | nível B .list-previous:not(.list-more): h ≥ 28 e toque 6 px acima/abaixo cai no botão | ok — 1 botões, h 28–28, toque ok 1/1 | ok — 1 botões, h 28–28, toque ok 1/1 |
| `S6.1.‹p›.atrasadas` | sem rolagem lateral em atrasadas | ok — scrollWidth 440, transbordando 0; medir(): sw 440, transb 0 | ok — scrollWidth 390, transbordando 0; medir(): sw 390, transb 0 |
| `S6.2.‹p›.atrasadas.ilha` | nenhum interativo sob a ilha (top < inset top: 62 / 47) em atrasadas | ok — 0; scrollY 0; medir(): 0 | ok — 0; scrollY 0; medir(): 0 |
| `S6.2.‹p›.atrasadas.indicador` | nenhum interativo fixo sob o indicador (bottom > H − inset bottom: 922 / 810) em atrasadas | ok — 0; medir(): 0 | ok — 0; medir(): 0 |
| `S6.2.‹p›.atrasadas.folga8` | nenhum fixo interativo a menos de 8 px da faixa do indicador em atrasadas | ok — 4 fixos, menor folga 10 | ok — 4 fixos, menor folga 10 |
| `S6.3.‹p›.atrasadas.pequenos` | alvos < 44 em atrasadas só os permitidos pela especificação | ok — próprio: 48 pequenos, 0 fora da lista; permitidos: #viewContent button.notas-toggle.has 76.9×28, #viewContent button.agenda-share 98.6×28 ×24, #viewCo… | ok — próprio: 48 pequenos, 0 fora da lista; permitidos: #viewContent button.notas-toggle.has 76.9×28, #viewContent button.agenda-share 98.6×28 ×24, #viewCo… |
| `S6.3.‹p›.atrasadas.B.notas-toggle` | nível B .notas-toggle: h ≥ 28 e toque 6 px acima/abaixo cai no botão | ok — 24 botões, h 28–28, toque ok 24/24 | ok — 24 botões, h 28–28, toque ok 24/24 |
| `S6.3.‹p›.atrasadas.B.agenda-share` | nível B .agenda-share: h ≥ 28 e toque 6 px acima/abaixo cai no botão | ok — 24 botões, h 28–28, toque ok 24/24 | ok — 24 botões, h 28–28, toque ok 24/24 |
| `S6.1.‹p›.sequencia` | sem rolagem lateral em sequencia | ok — scrollWidth 440, transbordando 0; medir(): sw 440, transb 0 | ok — scrollWidth 390, transbordando 0; medir(): sw 390, transb 0 |
| `S6.2.‹p›.sequencia.ilha` | nenhum interativo sob a ilha (top < inset top: 62 / 47) em sequencia | ok — 0; scrollY 0; medir(): 0 | ok — 0; scrollY 0; medir(): 0 |
| `S6.2.‹p›.sequencia.indicador` | nenhum interativo fixo sob o indicador (bottom > H − inset bottom: 922 / 810) em sequencia | ok — 0; medir(): 0 | ok — 0; medir(): 0 |
| `S6.2.‹p›.sequencia.folga8` | nenhum fixo interativo a menos de 8 px da faixa do indicador em sequencia | ok — 4 fixos, menor folga 10 | ok — 4 fixos, menor folga 10 |
| `S6.3.‹p›.sequencia.pequenos` | alvos < 44 em sequencia só os permitidos pela especificação | ok — próprio: 16 pequenos, 0 fora da lista; permitidos: #viewContent button.notas-toggle 93.3×28 ×8, #viewContent button.agenda-share 98.6×28 ×8; medir().a… | ok — próprio: 16 pequenos, 0 fora da lista; permitidos: #viewContent button.notas-toggle 93.3×28 ×8, #viewContent button.agenda-share 98.6×28 ×8; medir().a… |
| `S6.3.‹p›.sequencia.B.notas-toggle` | nível B .notas-toggle: h ≥ 28 e toque 6 px acima/abaixo cai no botão | ok — 8 botões, h 28–28, toque ok 8/8 | ok — 8 botões, h 28–28, toque ok 8/8 |
| `S6.3.‹p›.sequencia.B.agenda-share` | nível B .agenda-share: h ≥ 28 e toque 6 px acima/abaixo cai no botão | ok — 8 botões, h 28–28, toque ok 8/8 | ok — 8 botões, h 28–28, toque ok 8/8 |
| `S6.1.‹p›.menu` | sem rolagem lateral em menu | ok — scrollWidth 440, transbordando 0; medir(): sw 440, transb 0 | ok — scrollWidth 390, transbordando 0; medir(): sw 390, transb 0 |
| `S6.2.‹p›.menu.ilha` | nenhum interativo sob a ilha (top < inset top: 62 / 47) em menu | ok — 0; scrollY 0; medir(): 0 | ok — 0; scrollY 0; medir(): 0 |
| `S6.2.‹p›.menu.indicador` | nenhum interativo fixo sob o indicador (bottom > H − inset bottom: 922 / 810) em menu | ok — 0; medir(): 0 | ok — 0; medir(): 0 |
| `S6.2.‹p›.menu.folga8` | nenhum fixo interativo a menos de 8 px da faixa do indicador em menu | ok — 4 fixos, menor folga 10 | ok — 4 fixos, menor folga 10 |
| `S6.3.‹p›.menu.pequenos` | alvos < 44 em menu só os permitidos pela especificação | ok — próprio: 0 pequenos, 0 fora da lista; medir().alvosPequenos fora da lista: 0 | ok — próprio: 0 pequenos, 0 fora da lista; medir().alvosPequenos fora da lista: 0 |
| `S6.1.‹p›.nova-tarefa` | sem rolagem lateral em nova-tarefa | ok — scrollWidth 440, transbordando 0; medir(): sw 440, transb 0 | ok — scrollWidth 390, transbordando 0; medir(): sw 390, transb 0 |
| `S6.2.‹p›.nova-tarefa.ilha` | nenhum interativo sob a ilha (top < inset top: 62 / 47) em nova-tarefa | ok — 0; scrollY 0; medir(): 0 | ok — 0; scrollY 0; medir(): 0 |
| `S6.2.‹p›.nova-tarefa.indicador` | nenhum interativo fixo sob o indicador (bottom > H − inset bottom: 922 / 810) em nova-tarefa | ok — 0; medir(): 0 | ok — 0; medir(): 0 |
| `S6.2.‹p›.nova-tarefa.folga8` | nenhum fixo interativo a menos de 8 px da faixa do indicador em nova-tarefa | ok — 9 fixos, menor folga 174.1 | ok — 9 fixos, menor folga 118.1 |
| `S6.3.‹p›.nova-tarefa.pequenos` | alvos < 44 em nova-tarefa só os permitidos pela especificação | ok — próprio: 1 pequenos, 0 fora da lista; permitidos: #taskLembrete 18×18; medir().alvosPequenos fora da lista: 0 | ok — próprio: 1 pequenos, 0 fora da lista; permitidos: #taskLembrete 18×18; medir().alvosPequenos fora da lista: 0 |
| `S6.3.‹p›.nova-tarefa.#closeTaskDialog` | alvo #closeTaskDialog ≥ 44×44 | ok — 1× 95.4×44 | ok — 1× 95.4×44 |
| `S6.3.‹p›.nova-tarefa.#taskForm.primary` | alvo #taskForm .primary ≥ 44×44 | ok — 1× 99.9×44 | ok — 1× 99.9×44 |
| `S6.3.‹p›.nova-tarefa.#taskForm.field-check` | alvo #taskForm .field-check ≥ 44×44 | ok — 1× 364×44 | ok — 1× 314×44 |
| `S6.4.‹p›.taskDialog` | largura do #taskDialog | ok — 408 | ok — 358 |
| `S6.1.‹p›.jarvis` | sem rolagem lateral em jarvis | ok — scrollWidth 440, transbordando 0; medir(): sw 440, transb 0 | ok — scrollWidth 390, transbordando 0; medir(): sw 390, transb 0 |
| `S6.2.‹p›.jarvis.ilha` | nenhum interativo sob a ilha (top < inset top: 62 / 47) em jarvis | ok — 0; scrollY 0; medir(): 0 | ok — 0; scrollY 0; medir(): 0 |
| `S6.2.‹p›.jarvis.indicador` | nenhum interativo fixo sob o indicador (bottom > H − inset bottom: 922 / 810) em jarvis | ok — 0; medir(): 0 | ok — 0; medir(): 0 |
| `S6.2.‹p›.jarvis.folga8` | nenhum fixo interativo a menos de 8 px da faixa do indicador em jarvis | ok — 15 fixos, menor folga 10 | ok — 15 fixos, menor folga 10 |
| `S6.3.‹p›.jarvis.pequenos` | alvos < 44 em jarvis só os permitidos pela especificação | ok — próprio: 0 pequenos, 0 fora da lista; medir().alvosPequenos fora da lista: 0 | ok — próprio: 0 pequenos, 0 fora da lista; medir().alvosPequenos fora da lista: 0 |
| `S6.3.‹p›.jarvis.#jarvis-mic` | alvo #jarvis-mic ≥ 44×44 | ok — 1× 44×44 | ok — 1× 44×44 |
| `S6.3.‹p›.jarvis.#jarvis-send` | alvo #jarvis-send ≥ 44×44 | ok — 1× 44×44 | ok — 1× 44×44 |
| `S6.3.‹p›.jarvis..jarvis-hbtn` | alvo .jarvis-hbtn ≥ 44×44 | ok — 3× 44×44 | ok — 3× 44×44 |
| `S6.3.‹p›.jarvis..j-chip` | alvo .j-chip ≥ 44×44 | ok — 7× 95.4×44 / 92.8×44 / 116.3×44 / 96.4×44 | ok — 7× 95.4×44 / 92.8×44 / 116.3×44 / 96.4×44 |
| `S6.3.‹p›.jarvis.#jarvis-locbar` | alvo #jarvis-locbar ≥ 44×44 | ok — 1× 414×44 | ok — 1× 364×44 |
| `S6.3.‹p›.jarvis.#jarvis-input` | alvo #jarvis-input ≥ 44×44 | ok — 1× 286×44 | ok — 1× 236×44 |
| `S6.4.‹p›.jarvisPanel` | largura do #jarvis-panel | ok — 416 | ok — 366 |
| `S6.1.‹p›.voz` | sem rolagem lateral em voz | ok — scrollWidth 440, transbordando 0; medir(): sw 440, transb 0 | ok — scrollWidth 390, transbordando 0; medir(): sw 390, transb 0 |
| `S6.2.‹p›.voz.ilha` | nenhum interativo sob a ilha (top < inset top: 62 / 47) em voz | ok — 0; scrollY 0; medir(): 0 | ok — 0; scrollY 0; medir(): 0 |
| `S6.2.‹p›.voz.indicador` | nenhum interativo fixo sob o indicador (bottom > H − inset bottom: 922 / 810) em voz | ok — 0; medir(): 0 | ok — 0; medir(): 0 |
| `S6.2.‹p›.voz.folga8` | nenhum fixo interativo a menos de 8 px da faixa do indicador em voz | ok — 4 fixos, menor folga 129.3 | ok — 4 fixos, menor folga 69.7 |
| `S6.3.‹p›.voz.pequenos` | alvos < 44 em voz só os permitidos pela especificação | ok — próprio: 2 pequenos, 0 fora da lista; permitidos: #voz-dialog a[href="https://github.com/rhasspy/pip"] 25×13, #voz-dialog a[href="https://github.com/h… | ok — próprio: 2 pequenos, 0 fora da lista; permitidos: #voz-dialog a[href="https://github.com/rhasspy/pip"] 25×13, #voz-dialog a[href="https://github.com/h… |
| `S6.3.‹p›.voz.#voz-dialog.vz-x` | alvo #voz-dialog .vz-x ≥ 44×44 | ok — 1× 44×44 | ok — 1× 44×44 |
| `S6.3.‹p›.voz.#voz-dialog.vz-ouvir` | alvo #voz-dialog .vz-ouvir ≥ 44×44 | ok — 1× 64.3×44 | ok — 1× 64.3×44 |
| `S6.4.‹p›.vozDialog` | largura do #voz-dialog | ok — 408 | ok — 358 |
| `S6.1.‹p›.reagendar` | sem rolagem lateral com o diálogo reagendar aberto | ok — scrollWidth 440 | ok — scrollWidth 390 |
| `S6.3.‹p›.reagendar..reschedule-preset` | alvo .reschedule-preset ≥ 44×44 | ok — 3× 114.7×44 | ok — 3× 100.7×44 |
| `S6.3.‹p›.reagendar.#rescheduleForm.secondary` | alvo #rescheduleForm .secondary ≥ 44×44 | ok — 1× 95.4×44 | ok — 1× 95.4×44 |
| `S6.3.‹p›.reagendar.#rescheduleForm.primary` | alvo #rescheduleForm .primary ≥ 44×44 | ok — 1× 108.2×44 | ok — 1× 108.2×44 |
| `S6.4.‹p›.rescheduleDialog` | largura do #rescheduleDialog | ok — 400 | ok — 358 |
| `S6.4.‹p›.rescheduleTaskName` | largura do .reschedule-task-name | ok — 303 | ok — 261 |
| `S6.1.‹p›.alertas` | sem rolagem lateral com o diálogo alertas aberto | ok — scrollWidth 440 | ok — scrollWidth 390 |
| `S6.3.‹p›.alertas.#activateAlerts` | alvo #activateAlerts ≥ 44×44 | ok — 1× 364×44 | ok — 1× 314×44 |
| `S6.3.‹p›.alertas.#exportCalendar` | alvo #exportCalendar ≥ 44×44 | ok — 1× 364×44 | ok — 1× 314×44 |
| `S6.3.‹p›.alertas.#closeAlertsDialog` | alvo #closeAlertsDialog ≥ 44×44 | ok — 1× 80.9×44 | ok — 1× 80.9×44 |
| `S6.4.‹p›.alertsDialog` | largura do #alertsDialog | ok — 408 | ok — 358 |
| `S6.2.‹p›.folga.app-update` | folga do #app-update até a faixa do indicador (H − insetB − bottom) | ok — 10 (em 7 vistas: 10) | ok — 10 (em 7 vistas: 10) |
| `S6.2.‹p›.folga.jarvis-btn` | folga do #jarvis-btn até a faixa do indicador (H − insetB − bottom) | ok — 12 (em 7 vistas: 12) | ok — 12 (em 7 vistas: 12) |
| `S6.2.‹p›.folga.openDialog` | folga do #openDialog até a faixa do indicador (H − insetB − bottom) | ok — 62 (em 7 vistas: 62) | ok — 62 (em 7 vistas: 62) |
| `S6.2.‹p›.folga.cardioFab` | folga do #cardioFab até a faixa do indicador (H − insetB − bottom) | ok — 125 (em 7 vistas: 125) | ok — 125 (em 7 vistas: 125) |
| `S6.5.erros.‹p›` | nenhum erro de JavaScript (pageerror) nas vistas do app, ‹perfil› | ok — 0 erros | ok — 0 erros |
| `P1.‹p›` | sem rolagem lateral (scrollWidth ≤ 440) em Mês, Dia, Lista, Atrasadas, Sequência, Jarvis, voz e nova tarefa | ok — mes 440, dia 440, lista 440, atrasadas 440, sequencia 440, jarvis 440, voz 440, nova-tarefa 440 | ok — mes 390, dia 390, lista 390, atrasadas 390, sequencia 390, jarvis 390, voz 390, nova-tarefa 390 |
| `P2.‹p›` | nada clicável sob a ilha nem fixo sob o indicador (rolagem 0, 9 vistas) | ok — sob a ilha 0, fixos sob o indicador 0 | ok — sob a ilha 0, fixos sob o indicador 0 |
| `P3.‹p›` | alvos ≥ 44×44 no 17PM: +, Jarvis, setas, abas, filtros, mic/enviar, cabeçalho | ok — #openDialog 1× min 148.8×54, #jarvis-btn 1× min 56×56, #viewContent .nav-btn 2× min 44×44, #calFullBtn 1× min 44×44, #viewTabs .view-tab 4× min 96.5×4… | — |

### (a.2) Páginas auxiliares, perfil iphone17promax

| id | verificação | resultado e medida |
|---|---|---|
| `S6.6.financeiro.pagina` | financeiro: abriu a própria página | ok — financeiro.html |
| `S6.6.financeiro.sw` | financeiro: scrollWidth == 440 | ok — scrollWidth 440 |
| `S6.6.financeiro.cabecalho` | financeiro: conteúdo do topo fora da ilha (≥ 62) | ok — primeiro conteúdo em 80 (p.ey "FINANCEIRO"); cabeçalho header.head 80–149; medir(): conteudoTop 80, sobIlha false |
| `S6.6.financeiro.ilha` | financeiro: nenhum interativo sob a ilha | ok — 0 |
| `S6.6.financeiro.indicador` | financeiro: nenhum fixo interativo sob o indicador | ok — 0 |
| `S6.6.financeiro..filtersbutton` | financeiro: .filters button h ≥ 44 | ok — 6× 63×44 / 81×44 / 67×44 / 89.2×44 / 112.9×44 |
| `S6.6.financeiro.B..sa-footbutton` | financeiro: nível B .sa-foot button (h ≥ 28 e toque 6 px acima/abaixo) | ok — 1 botões, h 28–28, toque ok 1/1 |
| `S6.6.financeiro.B..iv-footbutton` | financeiro: nível B .iv-foot button (h ≥ 28 e toque 6 px acima/abaixo) | ok — 2 botões, h 28–28, toque ok 2/2 |
| `S6.7.aux.financeiro` | financeiro: véu body::before (fixed, 62px, z 60, cor do body) | ok — position fixed, height 62px, z 60, content "", bg rgb(23, 24, 28) / body rgb(23, 24, 28) |
| `S6.6.marketplace.pagina` | marketplace: abriu a própria página | ok — marketplace/ |
| `S6.6.marketplace.sw` | marketplace: scrollWidth == 440 | ok — scrollWidth 440 |
| `S6.6.marketplace.cabecalho` | marketplace: conteúdo do topo fora da ilha (≥ 62) | ok — primeiro conteúdo em 80 (span.eyebrow "Marketplace · Palmas"); cabeçalho header.in 0–154.1; medir(): conteudoTop 80, sobIlha false |
| `S6.6.marketplace.ilha` | marketplace: nenhum interativo sob a ilha | ok — 0 |
| `S6.6.marketplace.indicador` | marketplace: nenhum fixo interativo sob o indicador | ok — 0 |
| `S6.6.marketplace.#cofrelabel` | marketplace: #cofre label h ≥ 44 | ok — 1× 342×44 |
| `S6.6.marketplace.cofreLembrar` | marketplace: #cofreLembrar 22×22 (tela de senha) | ok — 22×22 |
| `S6.6.marketplace.views-button` | marketplace (sem .trancado): .views button h ≥ 44 | ok — 3× 107.7×44 / 126.5×44 / 167.3×44 |
| `S6.6.marketplace.barra` | marketplace: .barra getComputedStyle().top == '62px' | ok — top 62px (position sticky) |
| `S6.7.aux.marketplace` | marketplace: véu body::before (fixed, 62px, z 60, cor do body) | ok — position fixed, height 62px, z 60, content "", bg rgb(5, 5, 6) / body rgb(5, 5, 6) |
| `S6.6.gamificacao.pagina` | gamificacao: abriu a própria página | ok — gamificacao.html |
| `S6.6.gamificacao.sw` | gamificacao: scrollWidth == 440 | ok — scrollWidth 440 |
| `S6.6.gamificacao.cabecalho` | gamificacao: conteúdo do topo fora da ilha (≥ 62) | ok — primeiro conteúdo em 80 (p.ey "Gamificação"); cabeçalho header.head 80–150; medir(): conteudoTop 80, sobIlha false |
| `S6.6.gamificacao.ilha` | gamificacao: nenhum interativo sob a ilha | ok — 0 |
| `S6.6.gamificacao.indicador` | gamificacao: nenhum fixo interativo sob o indicador | ok — 0 |
| `S6.7.aux.gamificacao` | gamificacao: véu body::before (fixed, 62px, z 60, cor do body) | ok — position fixed, height 62px, z 60, content "", bg rgb(5, 5, 6) / body rgb(5, 5, 6) |
| `S6.6.equipamentos-especiais.pagina` | equipamentos-especiais: abriu a própria página | ok — equipamentos-especiais.html |
| `S6.6.equipamentos-especiais.sw` | equipamentos-especiais: scrollWidth == 440 | ok — scrollWidth 440 |
| `S6.6.equipamentos-especiais.cabecalho` | equipamentos-especiais: conteúdo do topo fora da ilha (≥ 62) | ok — primeiro conteúdo em 81 (a); cabeçalho div.hd 144–254; medir(): conteudoTop 144, sobIlha false |
| `S6.6.equipamentos-especiais.ilha` | equipamentos-especiais: nenhum interativo sob a ilha | ok — 0 |
| `S6.6.equipamentos-especiais.indicador` | equipamentos-especiais: nenhum fixo interativo sob o indicador | ok — 0 |
| `S6.6.equipamentos-especiais..chip` | equipamentos-especiais: .chip h ≥ 44 | ok — 13× 66.3×44 / 99.4×44 / 103.7×44 / 140.5×44 / 144.2×44 |
| `S6.6.equipamentos-especiais..appswitcha` | equipamentos-especiais: .appswitch a h ≥ 44 | ok — 2× 197×44 |
| `S6.6.equipamentos-especiais..quickbarbutton` | equipamentos-especiais: .quickbar button h ≥ 44 | ok — 3× 132×44 |
| `S6.6.equipamentos-especiais..buscabarinput` | equipamentos-especiais: .buscabar input h ≥ 44 | ok — 1× 408×44 |
| `S6.6.equipamentos-especiais.#cidadeFiltro` | equipamentos-especiais: #cidadeFiltro h ≥ 44 | ok — 1× 408×44 |
| `S6.6.equipamentos-especiais.#app-update` | equipamentos-especiais: #app-update ≥ 44×44 | ok — 1× 44×44 |
| `S6.6.equipamentos-especiais.app-update.folga` | equipamentos-especiais: folga do #app-update até a faixa do indicador | ok — 10 |
| `S6.7.aux.equipamentos-especiais` | equipamentos-especiais: véu body::before (fixed, 62px, z 60, cor rgb(16, 16, 23)) | ok — position fixed, height 62px, z 60, content "", bg rgb(16, 16, 23) / body rgba(0, 0, 0, 0) |
| `S6.6.treino.pagina` | treino: abriu a própria página | ok — treino.html?date=2026-10-19 |
| `S6.6.treino.sw` | treino: scrollWidth == 440 | ok — scrollWidth 440 |
| `S6.6.treino.cabecalho` | treino: conteúdo do topo fora da ilha (≥ 62) | ok — primeiro conteúdo em 76 (#trHome); cabeçalho div.tr-head 0–164; medir(): conteudoTop 76, sobIlha false |
| `S6.6.treino.ilha` | treino: nenhum interativo sob a ilha | ok — 0 |
| `S6.6.treino.indicador` | treino: nenhum fixo interativo sob o indicador | ok — 0 |
| `S6.6.treino..tr-preset` | treino: .tr-preset ≥ 44×44 | ok — 4× 44×44 / 49.3×44 |
| `S6.6.treino..tr-tbtn` | treino: .tr-tbtn ≥ 44×44 | ok — 2× 44×44 |
| `S6.6.treino.#trHome` | treino: #trHome h ≥ 44 | ok — 1× 94.1×44 |
| `S6.6.treino..tr-inputsinput` | treino: .tr-inputs input h ≥ 44 | ok — 14× 160×44 |
| `S6.6.carteira.pagina` | carteira: abriu a própria página | ok — carteira.html |
| `S6.6.carteira.sw` | carteira: scrollWidth == 440 | ok — scrollWidth 440 |
| `S6.6.carteira.cabecalho` | carteira: conteúdo do topo fora da ilha (≥ 62) | ok — primeiro conteúdo em 80 (p.ey "CARTEIRA"); cabeçalho header.head 80–151; medir(): conteudoTop 80, sobIlha false |
| `S6.6.carteira.ilha` | carteira: nenhum interativo sob a ilha | ok — 0 |
| `S6.6.carteira.indicador` | carteira: nenhum fixo interativo sob o indicador | ok — 0 |
| `S6.7.aux.carteira` | carteira: véu body::before (fixed, 62px, z 60, cor do body) | ok — position fixed, height 62px, z 60, content "", bg rgb(23, 24, 28) / body rgb(23, 24, 28) |
| `S6.6.extrato-saldo.pagina` | extrato-saldo: abriu a própria página | ok — extrato-saldo.html?mes=2026-10 |
| `S6.6.extrato-saldo.sw` | extrato-saldo: scrollWidth == 440 | ok — scrollWidth 440 |
| `S6.6.extrato-saldo.cabecalho` | extrato-saldo: conteúdo do topo fora da ilha (≥ 62) | ok — primeiro conteúdo em 80 (p.ey "SALDO PREVISTO"); cabeçalho header.head 80–149; medir(): conteudoTop 80, sobIlha false |
| `S6.6.extrato-saldo.ilha` | extrato-saldo: nenhum interativo sob a ilha | ok — 0 |
| `S6.6.extrato-saldo.indicador` | extrato-saldo: nenhum fixo interativo sob o indicador | ok — 0 |
| `S6.7.aux.extrato-saldo` | extrato-saldo: véu body::before (fixed, 62px, z 60, cor do body) | ok — position fixed, height 62px, z 60, content "", bg rgb(23, 24, 28) / body rgb(23, 24, 28) |
| `S6.6.investimentos.pagina` | investimentos: abriu a própria página | ok — investimentos.html |
| `S6.6.investimentos.sw` | investimentos: scrollWidth == 440 | ok — scrollWidth 440 |
| `S6.6.investimentos.cabecalho` | investimentos: conteúdo do topo fora da ilha (≥ 62) | ok — primeiro conteúdo em 80 (p.ey "INVESTIMENTOS"); cabeçalho header.head 80–151; medir(): conteudoTop 80, sobIlha false |
| `S6.6.investimentos.ilha` | investimentos: nenhum interativo sob a ilha | ok — 0 |
| `S6.6.investimentos.indicador` | investimentos: nenhum fixo interativo sob o indicador | ok — 0 |
| `S6.6.investimentos..savebtn` | investimentos: .savebtn h ≥ 44 | ok — 1× 374×44 |
| `S6.6.investimentos.B..editbtn` | investimentos: nível B .editbtn (h ≥ 28 e toque 6 px acima/abaixo) | ok — 4 botões, h 28–28, toque ok 4/4 |
| `S6.7.aux.investimentos` | investimentos: véu body::before (fixed, 62px, z 60, cor do body) | ok — position fixed, height 62px, z 60, content "", bg rgb(23, 24, 28) / body rgb(23, 24, 28) |
| `S6.6.fatura-inter.pagina` | fatura-inter: abriu a própria página | ok — fatura-inter.html?fatura=2026-11 |
| `S6.6.fatura-inter.sw` | fatura-inter: scrollWidth == 440 | ok — scrollWidth 440 |
| `S6.6.fatura-inter.cabecalho` | fatura-inter: conteúdo do topo fora da ilha (≥ 62) | ok — primeiro conteúdo em 80 (p.ey "CARTÃO DE CRÉDITO"); cabeçalho header.head 80–145; medir(): conteudoTop 80, sobIlha false |
| `S6.6.fatura-inter.ilha` | fatura-inter: nenhum interativo sob a ilha | ok — 0 |
| `S6.6.fatura-inter.indicador` | fatura-inter: nenhum fixo interativo sob o indicador | ok — 0 |
| `S6.6.fatura-inter..tabsbutton` | fatura-inter: .tabs button h ≥ 44 | ok — 2× 197×44 |
| `S6.7.aux.fatura-inter` | fatura-inter: véu body::before (fixed, 62px, z 60, cor do body) | ok — position fixed, height 62px, z 60, content "", bg rgb(23, 24, 28) / body rgb(23, 24, 28) |
| `S6.6.refaturamento.pagina` | refaturamento: abriu a própria página | ok — refaturamento.html |
| `S6.6.refaturamento.sw` | refaturamento: scrollWidth == 440 | ok — scrollWidth 440 |
| `S6.6.refaturamento.cabecalho` | refaturamento: conteúdo do topo fora da ilha (≥ 62) | ok — primeiro conteúdo em 80 (p.ey "INTER ↔ MERCADO PAGO"); cabeçalho header.head 80–149.8; medir(): conteudoTop 80, sobIlha false |
| `S6.6.refaturamento.ilha` | refaturamento: nenhum interativo sob a ilha | ok — 0 |
| `S6.6.refaturamento.indicador` | refaturamento: nenhum fixo interativo sob o indicador | ok — 0 |
| `S6.6.refaturamento..sim-toggle` | refaturamento: .sim-toggle h ≥ 44 | ok — 3× 190×44 |
| `S6.7.aux.refaturamento` | refaturamento: véu body::before (fixed, 62px, z 60, cor do body) | ok — position fixed, height 62px, z 60, content "", bg rgb(17, 18, 22) / body rgb(17, 18, 22) |
| `S6.6.financeiro-compartilhado.pagina` | financeiro-compartilhado: abriu a própria página | ok — financeiro-compartilhado.html |
| `S6.6.financeiro-compartilhado.sw` | financeiro-compartilhado: scrollWidth == 440 | ok — scrollWidth 440 |
| `S6.6.financeiro-compartilhado.cabecalho` | financeiro-compartilhado: conteúdo do topo fora da ilha (≥ 62) | ok — primeiro conteúdo em 80 (p.ey "DINHEIRO DO CASAL"); cabeçalho header.head 80–145.4; medir(): conteudoTop 80, sobIlha false |
| `S6.6.financeiro-compartilhado.ilha` | financeiro-compartilhado: nenhum interativo sob a ilha | ok — 0 |
| `S6.6.financeiro-compartilhado.indicador` | financeiro-compartilhado: nenhum fixo interativo sob o indicador | ok — 0 |
| `S6.7.aux.financeiro-compartilhado` | financeiro-compartilhado: véu body::before (fixed, 62px, z 60, cor do body) | ok — position fixed, height 62px, z 60, content "", bg rgb(17, 18, 22) / body rgb(17, 18, 22) |
| `S6.6.importar.pagina` | importar: abriu a própria página | ok — importar.html |
| `S6.6.importar.sw` | importar: scrollWidth == 440 | ok — scrollWidth 440 |
| `S6.6.importar.cabecalho` | importar: conteúdo do topo fora da ilha (≥ 62) | ok — primeiro conteúdo em 80 (p.ey "FINANCEIRO"); cabeçalho header.head 80–148; medir(): conteudoTop 80, sobIlha false |
| `S6.6.importar.ilha` | importar: nenhum interativo sob a ilha | ok — 0 |
| `S6.6.importar.indicador` | importar: nenhum fixo interativo sob o indicador | ok — 0 |
| `S6.7.aux.importar` | importar: véu body::before (fixed, 62px, z 60, cor do body) | ok — position fixed, height 62px, z 60, content "", bg rgb(11, 18, 32) / body rgb(11, 18, 32) |
| `P6.financeiro` | financeiro: sem rolagem lateral e cabeçalho fora da ilha (17PM) | ok — scrollWidth 440, primeiro conteúdo em 80 |
| `P6.marketplace` | marketplace: sem rolagem lateral e cabeçalho fora da ilha (17PM) | ok — scrollWidth 440, primeiro conteúdo em 80 |
| `P6.gamificacao` | gamificacao: sem rolagem lateral e cabeçalho fora da ilha (17PM) | ok — scrollWidth 440, primeiro conteúdo em 80 |
| `P6.equipamentos-especiais` | equipamentos-especiais: sem rolagem lateral e cabeçalho fora da ilha (17PM) | ok — scrollWidth 440, primeiro conteúdo em 81 |
| `P6.treino` | treino: sem rolagem lateral e cabeçalho fora da ilha (17PM) | ok — scrollWidth 440, primeiro conteúdo em 76 |
| `P6.carteira` | carteira: sem rolagem lateral e cabeçalho fora da ilha (17PM) | ok — scrollWidth 440, primeiro conteúdo em 80 |
| `P6.extrato-saldo` | extrato-saldo: sem rolagem lateral e cabeçalho fora da ilha (17PM) | ok — scrollWidth 440, primeiro conteúdo em 80 |
| `P6.investimentos` | investimentos: sem rolagem lateral e cabeçalho fora da ilha (17PM) | ok — scrollWidth 440, primeiro conteúdo em 80 |
| `P6.fatura-inter` | fatura-inter: sem rolagem lateral e cabeçalho fora da ilha (17PM) | ok — scrollWidth 440, primeiro conteúdo em 80 |
| `P6.refaturamento` | refaturamento: sem rolagem lateral e cabeçalho fora da ilha (17PM) | ok — scrollWidth 440, primeiro conteúdo em 80 |
| `P6.financeiro-compartilhado` | financeiro-compartilhado: sem rolagem lateral e cabeçalho fora da ilha (17PM) | ok — scrollWidth 440, primeiro conteúdo em 80 |
| `P6.importar` | importar: sem rolagem lateral e cabeçalho fora da ilha (17PM) | ok — scrollWidth 440, primeiro conteúdo em 80 |

### (a.3) Paisagem, perfil `iphone17promax-paisagem` (956×440, insets 20/20/62/62)

| id | verificação | resultado e medida |
|---|---|---|
| `S6.10.paisagem.mes.sw` | paisagem mes: scrollWidth ≤ 956 | ok — scrollWidth 956 |
| `S6.10.paisagem.mes.lados` | paisagem mes: nenhum fixo interativo com left < 62 ou right > 894 | ok — 5 fixos, todos em [62, 894] |
| `S6.10.paisagem.lista.sw` | paisagem lista: scrollWidth ≤ 956 | ok — scrollWidth 956 |
| `S6.10.paisagem.lista.lados` | paisagem lista: nenhum fixo interativo com left < 62 ou right > 894 | ok — 5 fixos, todos em [62, 894] |
| `S6.10.paisagem.jarvis.sw` | paisagem jarvis: scrollWidth ≤ 956 | ok — scrollWidth 956 |
| `S6.10.paisagem.jarvis.lados` | paisagem jarvis: nenhum fixo interativo com left < 62 ou right > 894 | ok — 16 fixos, todos em [62, 894] |
| `S6.10.paisagem.jarvis.painel` | paisagem: #jarvis-panel.open com top ≥ 20 e bottom ≤ 420 | **FALHOU** — top 13.2, bottom 330 (altura 316.8) **vs** top ≥ 20 e bottom ≤ 420 |
| `S6.10.paisagem.jarvis.entrada` | paisagem (extra): microfone, campo e enviar do Jarvis inteiros dentro do painel | **FALHOU** — painel 13.2..330; #jarvis-mic 308.2..352.2, #jarvis-input 308.2..352.2, #jarvis-send 308.2..352.2; cortados 3 (22.2 px escondidos) **vs** bottom de cada um ≤ bottom do painel |
| `S6.5.erros.paisagem` | nenhum erro de JavaScript (pageerror) nas vistas do app, iphone17promax-paisagem | ok — 0 erros |

### (a.4) Independentes de perfil (textos, suítes, comparação entre perfis)

| id | verificação | resultado e medida |
|---|---|---|
| `S6.4.celula-17pm-maior` | célula do calendário no 17PM maior que no 13 por ≥ 6 px | ok — 52.6 − 46 = 6.6 |
| `S6.8.versoes` | index.html e treino.html carregam as versões novas dos scripts | ok — treino.js?v=13, notas.js?v=10, agenda-sharing.js?v=5, sequencial.js?v=4, vozes-neurais.js?v=2, treino.js?v=13 |
| `S6.8.index.html` | index.html: grep -c de cada old = 0 e de cada new = 1 | ok — 39/39 trechos ok |
| `S6.8.treino.html` | treino.html: grep -c de cada old = 0 e de cada new = 1 | ok — 1/1 trechos ok |
| `S6.8.notas.js` | notas.js: grep -c de cada old = 0 e de cada new = 1 | ok — 2/2 trechos ok |
| `S6.8.agenda-sharing.js` | agenda-sharing.js: grep -c de cada old = 0 e de cada new = 1 | ok — 2/2 trechos ok |
| `S6.8.sequencial.js` | sequencial.js: grep -c de cada old = 0 e de cada new = 1 | ok — 1/1 trechos ok |
| `S6.8.treino.js` | treino.js: grep -c de cada old = 0 e de cada new = 1 | ok — 7/7 trechos ok |
| `S6.8.vozes-neurais.js` | vozes-neurais.js: grep -c de cada old = 0 e de cada new = 1 | ok — 3/3 trechos ok |
| `S6.8.financeiro.html` | financeiro.html: grep -c de cada old = 0 e de cada new = 1 | ok — 6/6 trechos ok |
| `S6.8.carteira.html` | carteira.html: grep -c de cada old = 0 e de cada new = 1 | ok — 1/1 trechos ok |
| `S6.8.extrato-saldo.html` | extrato-saldo.html: grep -c de cada old = 0 e de cada new = 1 | ok — 1/1 trechos ok |
| `S6.8.investimentos.html` | investimentos.html: grep -c de cada old = 0 e de cada new = 1 | ok — 4/4 trechos ok |
| `S6.8.fatura-inter.html` | fatura-inter.html: grep -c de cada old = 0 e de cada new = 1 | ok — 2/2 trechos ok |
| `S6.8.refaturamento.html` | refaturamento.html: grep -c de cada old = 0 e de cada new = 1 | ok — 2/2 trechos ok |
| `S6.8.financeiro-compartilhado.html` | financeiro-compartilhado.html: grep -c de cada old = 0 e de cada new = 1 | ok — 1/1 trechos ok |
| `S6.8.gamificacao.html` | gamificacao.html: grep -c de cada old = 0 e de cada new = 1 | ok — 1/1 trechos ok |
| `S6.8.importar.html` | importar.html: grep -c de cada old = 0 e de cada new = 1 | ok — 1/1 trechos ok |
| `S6.8.marketplace/index.html` | marketplace/index.html: grep -c de cada old = 0 e de cada new = 1 | **FALHOU** — 5/7 trechos ok [new "width:44px;height:44px;" → 2, old "width:38px;height:38px;" → 0; new "#cofre label{display:flex;gap:8px;align-items:ce…" → 1, old "#cofre label{display:flex;gap:8px;al…" → 1] **vs** 7/7 (old 0, new 1) |
| `S6.8.marketplace/index.html.intencao` | marketplace/index.html: nos trechos que falharam no grep literal, o old só existe dentro do new e o new está presente | ok — "width:44px;height:44px;": new em 2 linha(s), old fora do new em 0; "#cofre label{display:flex;gap:8px;align-": new em 1 linha(s), old fora do new em … |
| `S6.8.equipamentos-especiais.html` | equipamentos-especiais.html: grep -c de cada old = 0 e de cada new = 1 | ok — 8/8 trechos ok |
| `S6.5.e2e-so-claude` | suíte e2e-so-claude | ok — rc 0, 10 ok, 0 FALHOU |
| `S6.5.e2e-voz-saida` | suíte e2e-voz-saida | ok — rc 0, 6 ok, 0 FALHOU |
| `S6.5.e2e-voz` | suíte e2e-voz | ok — rc 0, 6 ok, 0 FALHOU |
| `S6.5.e2e-gasto` | suíte e2e-gasto | ok — rc 0, 4 ok, 0 FALHOU |
| `S6.5.e2e-multi` | suíte e2e-multi | ok — rc 0, 4 ok, 0 FALHOU |
| `S6.5.e2e-atualiza` | suíte e2e-atualiza | ok — rc 0, 7 ok, 0 FALHOU |
| `S6.5.e2e-lista` | suíte e2e-lista | ok — rc 0, 7 ok, 0 FALHOU |
| `S6.5.e2e-ouvindo` | suíte e2e-ouvindo | ok — rc 0, 1 ok, 0 FALHOU |
| `S6.5.e2e-vozes-app` | suíte e2e-vozes-app | ok — rc 0, 8 ok, 0 FALHOU |
| `S6.5.unidade` | teste de unidade tests/jarvis-claude.test.mjs | ok — rc 0, pass 1, fail 0 |
| `P4` | largura extra aproveitada: .app ocupa a largura útil no 17PM e a célula fica mais larga que no 13 | ok — .app 440 (interna 408); célula 52.6 vs 46 |
| `P5` | sem regressão: 9 suítes E2E e teste de unidade passam; nenhum erro de JS nas vistas (o próprio layout.cjs é o código de saída) | ok — 10/10 passaram; erros de JS 0 |

## (b) Suítes E2E e teste de unidade

Rodei as suítes de três formas:

- **Avulsas, rodada 1**, com `node <suíte> http://127.0.0.1:8765/index.html`. A `e2e-vozes-app` recebe também a pasta do
  scratchpad. Script: `scratchpad/f5/rodar-suites.sh`; logs em `scratchpad/f5/suites-r1/`.
- **Avulsas, rodada 2**, com o mesmo script; logs em `scratchpad/f5/suites-r2/`.
- **Dentro do `layout.cjs`**, nos ids `S6.5.<suíte>` e `S6.5.unidade`: cinco execuções completas.

As sete execuções (2 avulsas e 5 dentro do `layout.cjs`) deram o mesmo resultado.

| Suíte | ok | FALHOU | Código de saída |
|---|---|---|---|
| e2e-so-claude | 10 | 0 | 0 |
| e2e-voz-saida | 6 | 0 | 0 |
| e2e-voz | 6 | 0 | 0 |
| e2e-gasto | 4 | 0 | 0 |
| e2e-multi | 4 | 0 | 0 |
| e2e-atualiza | 7 | 0 | 0 |
| e2e-lista | 7 | 0 | 0 |
| e2e-ouvindo | 1 | 0 | 0 |
| e2e-vozes-app | 8 | 0 | 0 |
| **Unidade** `node --experimental-strip-types --test tests/jarvis-claude.test.mjs` | tests 1, pass 1 | fail 0 | 0 |

**Total: 53 ok e 0 FALHOU nas 9 suítes; o teste de unidade passou (1/1).** Além disso, `page.__erros` (eventos
`pageerror`) ficou vazio em todas as vistas dos três perfis: `S6.5.erros.17pm`, `.13` e `.paisagem`, todos com 0.

## (c) Falhas

### 1. `S6.10.paisagem.jarvis.painel`: o painel do Jarvis invade a faixa de cima em paisagem

- **Perfil:** `iphone17promax-paisagem`, o objeto literal da especificação: 956×440, insets 20/20/62/62.
- **Vista:** `jarvis`.
- **Seletor:** `#jarvis-panel.open`.
- **Medida obtida:** `top` 13,2 e `bottom` 330, com altura 316,8.
- **Esperado:** `top ≥ 20` e `bottom ≤ 420`.
- **CSS provável:** `index.html:801`, regra
  `#jarvis-panel{…bottom:calc(90px + env(safe-area-inset-bottom));max-height:72dvh;…}`.
  - Em 440 de altura, o painel atinge o `max-height` (0,72 × 440 = 316,8).
  - Portanto `top` = 440 − (90 + 20) − 316,8 = **13,2**, abaixo do inset de 20.
- **Já existia antes da missão.** Abri a v246 publicada (https://lgrsv.github.io/agenda-iphone/, `sw.js` v246, ainda
  com `max-width:420px`) com o mesmo perfil e o mesmo harness, e ela dá o mesmo `top` 13,2 / `bottom` 330. Script:
  `scratchpad/f5/paisagem-antes.cjs`.
- **Correção que eu sugiro** (não apliquei): `max-height:min(72dvh, calc(100dvh - 90px - env(safe-area-inset-bottom) - env(safe-area-inset-top)))`.
  - Em paisagem o limite fica em 310, e o `top` vai para 20.
  - No retrato nada muda: no 17PM o valor seria 770, maior que os 688 de 72dvh; no 13, 673 contra 607,7.

### 2. `S6.10.paisagem.jarvis.entrada` (verificação extra, fora da lista fechada): a linha de entrada do Jarvis fica cortada em paisagem. REGRESSÃO

Acrescentei esta verificação porque o plano pede "em paisagem, só não quebrar" e a captura
`iphone17promax-paisagem-jarvis.png` mostra a linha de entrada cortada ao meio.

- **Perfil e vista:** `iphone17promax-paisagem`, `jarvis`.
- **Seletores:** `#jarvis-mic`, `#jarvis-input` e `#jarvis-send`, dentro de `#jarvis-panel.open`, que tem
  `overflow:hidden`.
- **Medida obtida:**
  - os três ocupam 308,2..352,2;
  - o painel ocupa 13,2..330;
  - portanto **22,2 px dos 44 ficam escondidos**: metade do campo, do microfone e do botão de enviar.
- **Esperado:** o `bottom` de cada um ≤ o `bottom` do painel.
- **Antes** (v246 publicada, mesmo perfil): o campo ficava em 286,2..326,2, dentro do painel (bottom 330). Ou seja, os
  aumentos de altura desta missão empurraram a linha para fora do painel. Comparando antes e depois:

  | Parte do painel | Antes | Depois |
  |---|---|---|
  | `#jarvis-locbar` | 83,2..112,2 | 77,2..121,2 |
  | `#jarvis-chips` | 232,2..275,2 (43) | 241,2..297,2 (56) |
  | Linha de entrada (altura) | 40 | 44 |

  O `#jarvis-msgs` tem `min-height:120px` e não encolhe para compensar.
- **CSS provável:**
  - `index.html:801`: `max-height:72dvh` e `overflow:hidden` do `#jarvis-panel`;
  - `index.html:811`: `#jarvis-msgs{…min-height:120px}`;
  - `index.html:21`, no fim da linha: `#jarvis-locbar{min-height:44px!important;…}`;
  - `index.html:846`: `.j-chip{…min-height:44px…}`;
  - `index.html:818`, `:821` e `:824`: mic, campo e enviar com 44.
- **Correção:** a mesma do item 1 resolve o `top`, mas não o corte. Para a entrada caber, o `#jarvis-msgs` precisa
  poder encolher em telas baixas, por exemplo `min-height:min(120px, 20dvh)`, ou o painel precisa de mais altura. Fica
  para a C2 decidir.

### 3. `S6.8.marketplace/index.html`: o grep literal falha por defeito da especificação, não do app

- **Página:** `marketplace/index.html`.
- **Medida obtida:** 5 de 7 trechos ok.
- **Esperado:** 7 de 7, cada `old` com `grep -c` 0 e cada `new` com 1.
- **Trecho `.x`:** o `new` `width:44px;height:44px;` aparece em **2 linhas**:
  - `marketplace/index.html:85` `.x{…width:44px;height:44px;…}`, que é a mudança pedida (o `old`
    `width:38px;height:38px;` dá 0);
  - `marketplace/index.html:78` `.gal .nav{position:absolute;top:40%;width:44px;height:44px;…}`, que a especificação
    não cita.

  O trecho `new` da especificação é genérico demais para dar 1. Não conferi se a linha 78 já era assim antes, porque o
  briefing proíbe ler o git das mudanças.
- **Trecho `#cofre label`:** o `old` `#cofre label{display:flex;gap:8px;align-items:center;` é **prefixo** do `new`
  (`…;min-height:44px;`, linha 96). Então o `grep -c old` nunca pode dar 0 depois da mudança aplicada; o predicado é
  impossível de cumprir.
- **Intenção da mudança:** o id `S6.8.marketplace/index.html.intencao` confere que, fora das ocorrências do `new`, o
  `old` aparece em 0 linhas e que o `new` existe. Ele dá **ok**.
- **Comportamento medido:** confere com a intenção.
  - `#cofre label` mede 342×44 e `#cofreLembrar` 22×22.
  - O `.x` fica atrás da senha e não foi medido; ver (d).
- Mantive o limite da especificação, como manda o briefing: o FALHOU fica registrado como observação para a C2.

## (d) O que NÃO consegui testar, e por quê

- **iPhone real e WebKit:**
  - Tudo foi medido no Chromium 141, com a área segura emulada pelo CDP. A ilha e o indicador não são desenhados.
  - Não testei o `::before` dentro do `input[type=checkbox]` com `appearance:none` no WebKit.
  - Não testei o `100dvh` com as barras do Safari.
  - A área de toque real não foi testada; usei `elementFromPoint`, que é o teste de alvo do navegador, não o do dedo.
- **Bug WebKit 301994** (`env()` = 0 com a faixa opaca): não testei o estado com inset 0.
- **Modo claro:** o véu foi conferido só no tema padrão (escuro). A cor do véu do app segue `var(--bg)`, mas não medi
  com `data-theme="light"`.
- **Paisagem com os insets do iOS 18** (0/21/62/62): não testei; usei só o objeto da especificação.
- **marketplace atrás da senha:**
  - `#cats button` e `.x` (fechar do detalhe) não foram medidos; eles não estão na lista da S6.6.
  - `.views button` e `.barra` foram medidos tirando a classe `trancado`, como a especificação manda.
- **financeiro-compartilhado:**
  - Ela só abre para a usuária com acesso compartilhado.
  - Medi com `agenda_supabase_config_v1.workspaceOwnerId` da Ana e um cliente Supabase **simulado** (rota para o
    módulo da CDN, sem nenhuma rede), que devolve um snapshot fictício.
  - O layout medido é o da página com esses dados, não com os dados reais.
- **treino.html:** aberto a partir do app, como na auditoria, com a tarefa `treino-<data>` criada pelo `treino.js`
  (data 2026-10-19).
- **Toast:** medido forçando a classe `.show` no `#toast`, não por uma ação real.
- **P7 (publicação):** fora do escopo da F5.
- **Dependência da data:** as sementes do harness são relativas ao dia em que o teste roda. Contagens de cartões
  (por exemplo 52 `.notas-toggle` na Lista) podem mudar em outro dia. As quantidades fixas que a especificação dá foram
  conferidas como iguais:

  | Alvo | Quantidade |
  |---|---|
  | `.view-tab`, `.chip` | 4 |
  | `.nav-btn` (Dia) | 2 |
  | `.jarvis-hbtn` | 3 |
  | `.j-chip` | 7 |
  | `.reschedule-preset` | 3 |
  | `financeiro .filters button` | 6 |
  | `equipamentos .chip` | 13 |
  | `fatura-inter .tabs button` | 2 |

**Observações para a C2** (nenhuma conta como FALHOU):

1. **S6.7 rolado, "7 de 7 / 3 de 3":** a contagem da especificação usa a população da C1, sem filtro de visibilidade,
   e inclui **2 itens invisíveis do menu fechado** (`#themeToggle` e `#equipamentosBtn`).
   - Medi as duas populações. A da C1 dá 7/7 cobertos (17PM) e 3/3 (13).
   - Só os visíveis: 5/5 (17PM: `#seqEntryBtn` + 4 `.chip`) e 1/1 (13: `#seqEntryBtn`).
   - O id passa nas duas.
2. **Paisagem: `#viewmode-btn`** ("Desktop", `viewmode.js:32`, fixo em
   `top:calc(env(safe-area-inset-top) + 9px);right:calc(env(safe-area-inset-right) + 9px)`) fica por cima do
   `#moreMenuBtn`.
   - Medidas: 790..885 × 29..60 contra 790..836 × 40..86.
   - O centro do `#moreMenuBtn` continua tocável.
   - É idêntico na v246 publicada, então já existia. Não está na lista da S6.10.
3. **Especificação 4.7 × medido:** a especificação diz `equipamentos .toolbar button` / `.catbar button` "130.7×48,
   132×50 (medido)". Hoje meço outra coisa, igual à auditoria F2:
   - `button.prim` e `div.toolbar > button`: **200×34**;
   - `button.cb-analise` e `button.cb-ncon`: **201×36**.

   Ficaram < 44 e fora da lista fechada.
4. **`financeiro #pluxeeEdit`** mede 56,5×25: menos de 28 de altura, sem nível B. Não está na lista da especificação,
   que só cita `.sa-foot button` e `.iv-foot button`.
5. **`.list-more`** é `<button class="list-previous list-more">` (`index.html:260`), então herda também o `::before` de
   nível B do `.list-previous`. Passa como nível A (192,8×44 no 17PM). No teste de nível B, excluí o `.list-more` do
   seletor `.list-previous`.
6. **`equipamentos-especiais`:** o `body` tem fundo transparente (`rgba(0, 0, 0, 0)`). O véu usa `#101017`, como a
   especificação manda.

## (e) Capturas finais

Ficam em `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/verificacao/`.
Cada uma mostra o viewport, com as faixas da área segura em vermelho translúcido. A página inteira, sem marcação, fica
em `pagina-inteira/` com o mesmo nome.

- **App, dois perfis:**
  - `iphone17promax-{mes,dia,lista,atrasadas,sequencia,menu,nova-tarefa,jarvis,voz,reagendar,alertas}.png`;
  - `iphone13-{mes,dia,lista,atrasadas,sequencia,menu,nova-tarefa,jarvis,voz,reagendar,alertas}.png`.
- **Paisagem:** `iphone17promax-paisagem-{mes,lista,jarvis}.png`. A de `jarvis` mostra as falhas 1 e 2.
- **Auxiliares (17PM):** `iphone17promax-aux-{financeiro,marketplace,gamificacao,equipamentos-especiais,treino,carteira,extrato-saldo,investimentos,fatura-inter,refaturamento,financeiro-compartilhado,importar}.png`.
- **Antes e depois da paisagem do Jarvis** (v246 publicada × local), fora da pasta de capturas finais:
  - `scratchpad/f5/paisagem-jarvis-antes.png`;
  - `scratchpad/f5/paisagem-jarvis-depois.png`.

---

## Rodada 2 (devolução do coordenador)

Pedido: `briefings/F5-rodada2.md` (achados R5 e R6 da `revisao-final.md`, emenda do S6.8, novos critérios do S6.10,
versões novas). Continuei independente: não li `relatorio-F3.md`, `relatorio-F4.md`, nem `git diff`/`git log`. Para o
texto exato dos trechos emendados do S6.8 li, além da revisão final, os briefings do coordenador
`briefings/F3-rodada3.md` e `briefings/F4-rodada3.md` (são as ordens de mudança, não relatórios de quem implementou).
Não editei o app. Mutantes só em cópias no scratchpad, servidas nas portas 8811 e 8812.

- **Entrega medida:** árvore de trabalho atual, servida em http://127.0.0.1:8765/ (`sw.js` =
  `agenda-lagares-v247-iphone17promax`). Chromium 141, área segura pelo CDP, `env()` conferido em cada abertura.
- **Arquivos:**
  - teste: `.orquestra/layout-17promax/testes/layout.cjs`;
  - saída da última execução: `testes/saida-layout.txt`; medidas brutas: `testes/resultado-layout.json`;
  - saídas dos mutantes: `testes/saida-mutante-M7.txt` e `testes/saida-mutante-Z42.txt`;
  - scripts de exploração e conferência: `scratchpad/f5r2/` (`explorar*.cjs`, `zonas.cjs`, `pares.cjs`,
    `sanidade.cjs`, `fin.cjs`, `fin-fix.cjs`).

### R2.1 Resumo

- **`node testes/layout.cjs`: 431 verificações, 430 ok, 1 FALHOU.** Código de saída 1.
  - A única falha é a verificação **extra** `S6.6.financeiro.bruto`: dois filtros do `financeiro.html` ficam fora da
    tela, recortados. **É pré-existente** (ver R2.6). Não faz parte da lista fechada S6.1–S6.10 nem de P1–P6.
  - **Lista fechada e definição de pronto: tudo ok.** As três falhas da rodada 1 viraram ok:
    `S6.10.paisagem.jarvis.painel` (top 20), `S6.10.paisagem.jarvis.entrada` (linha de entrada inteira) e
    `S6.8.marketplace/index.html` (com a emenda).
- **Determinismo:** as execuções 2 e 3, seguidas, deram saídas **idênticas byte a byte** (`diff` vazio). A execução 1,
  feita antes de dois ajustes só no texto impresso (zona com 2 casas e "com o diálogo"), deu o mesmo conjunto de ids e
  resultados. Cada execução leva cerca de 3 min 45 s.
- **Mutantes:** o `layout.cjs` pega o **M7** (`width:470px` no `.list-more`) e o **mutante de zona 42** (`-9px` →
  `-8px` no `notas.js`), os dois **por medição** (R2.5).
- **Valores que mudaram de propósito:** comparei id por id a saída da rodada 1 com a da rodada 2. Fora as linhas que eu
  mudei (nível B, S6.8, paisagem), **nenhuma medida mudou**: S6.2, S6.4, S6.9, S6.7 (7 de 7 e 3 de 3), nível A e
  P1–P6 dão os mesmos números da rodada 1. O `gap:6px` do rodapé não mexeu em nenhum esperado da S6.4 nem da S6.9.

### R2.2 O que mudou no teste

1. **R5: transbordo recortado (`S6.1.‹p›.‹vista›.bruto`).**
   - Novo sub-id em cada uma das 9 vistas e nos 2 diálogos (Reagendar, Alertas), nos dois perfis: 22 ids.
   - **Predicado:** todo elemento visível do `body` com `getBoundingClientRect().right > innerWidth + 0,5` ou
     `left < −0,5` reprova, **sem descontar recorte nenhum** (`html`, `body`, `.app`, `.view-shell`).
     - "Visível": `visibility: visible`, nenhum ancestral com `display:none` e opacidade ≥ 0,05 em toda a cadeia.
   - **Única exceção:** filhos de um contêiner da lista fechada `ROLAGEM_INTENCIONAL`, desde que o contêiner tenha
     `overflow-x` `auto` ou `scroll` e caiba no viewport. Se o contêiner não valer, a linha diz por quê.
   - O mesmo predicado roda como **extra** na paisagem (`S6.10.paisagem.‹vista›.bruto`, 4 vistas) e nas 12 auxiliares
     (`S6.6.‹página›.bruto`).
   - **Exclusões (lista fechada) e o que cada uma excluiu nesta entrega:**

     | Contêiner | Página | `overflow-x` | Elementos excluídos (fora do viewport, dentro do contêiner) |
     |---|---|---|---|
     | `#jarvis-chips` | app | auto | 14 (4 `.j-chip` e seus `svg`/`path`, 353,5..760,1) nas vistas `jarvis` e `voz`, nos dois perfis |
     | `#filters` | app | auto | 0. Rola no 13 (scrollWidth 369 > 358), mas os chips vão até 385 < 390 |
     | `#saldoAtual` | financeiro | auto | 3 (slide "saldo previsto" do carrossel) |
     | `#pager` | financeiro | auto | 37 (slides laterais, entre eles `.iv-foot button` e `#pluxeeEdit`) |
     | `#filtros` | equipamentos-especiais | auto | 4 chips |
     | `#filtros-cat` | equipamentos-especiais | auto | 6 (chip e contador) |

2. **R6: nível B medido pela extensão da zona.**
   - Com o botão rolado para o meio da tela, `elementFromPoint` no centro horizontal, a partir do meio do botão para
     cima e para baixo a cada 0,25 px, até o primeiro ponto que não devolve o botão. A fronteira é refinada por
     bisseção (12 passos) entre o último acerto e o primeiro erro.
   - **Critério:** `h ≥ 28`, **zona ≥ 43,5** e pelo menos 6 px de cada lado. Os 6 px de cada lado são a sonda original
     da especificação, mantida para não aceitar uma zona de 44 toda de um lado só.
   - **Rótulos:** `.notas-toggle`, `.agenda-share`, `.tr-open`, `.list-previous` (sem o `.list-more`); nas auxiliares,
     `.sa-foot button`, `.iv-foot button`, `.editbtn` e o novo `#pluxeeEdit` (1 elemento esperado).
   - **Artefato do Chromium, medido:** o teste de alvo devolve o botão até cerca de 1 px acima da borda geométrica do
     `::before`. Com isso, a zona geométrica de 44 mede **44,98** (8,98 acima, 8,00 abaixo) e a de 42 mede **42,98**. O
     limite 43,5 separa as duas com folga de pelo menos 0,5 de cada lado.
   - **Pares entre botões (`S6.3.‹p›.‹vista›.B.pares`):** em cada `.task-card`, a zona de cada interativo é a caixa
     unida ao `::before` absoluto. O `::before` é posicionado contra a caixa de padding, então a borda entra na conta.
     - Conta os pares com interseção > 0,5 px nos dois eixos; não conta pares aninhados.
     - O briefing pede a Lista; rodei também em Dia, Atrasadas e Sequência, que usam o mesmo cartão.
     - **Autoteste:** com `.task-footer:has(.tr-open){row-gap:6px}` injetado, o teste acusa 9 pares (`tr-open` ×
       `agenda-share`, 10 px de sobreposição) e zona de 34 no `.tr-open`. É o mesmo número da revisão final.
3. **S6.8 com as emendas** (tabela em R2.7). Para versões, o teste agora exige que **todas** as referências ao script no
   arquivo tenham a versão esperada, e não só que ela apareça. Um `old` pode ser uma lista: o trecho da especificação e
   a versão intermediária, todas com `grep -c` 0.
4. **S6.10 emendado:**
   - `S6.10.paisagem.jarvis.entrada` deixou de ser extra. Mic, campo e enviar têm de ficar inteiros dentro do painel,
     nos quatro lados, com tolerância de 0,5.
   - Novo `S6.10.paisagem.nova-tarefa.dialogo`: `#taskDialog` com `top ≥ 20` e `bottom ≤ 420`.
5. **Outros:** a variável `LAYOUT_JSON` muda o arquivo das medidas brutas, para os mutantes não sobrescreverem o da
   entrega.

### R2.3 Tabela atualizada: contagem por critério

| Critério | Rodada 1 (ok / FALHOU) | Rodada 2 (ok / FALHOU) | O que mudou |
|---|---|---|---|
| S6.1 sem rolagem lateral | 22 / 0 | **44 / 0** | +22 `.bruto` (R5) |
| S6.2 ilha e indicador | 62 / 0 | 62 / 0 | — |
| S6.3 alvos de toque | 108 / 0 | **116 / 0** | nível B por zona medida; +8 `.B.pares` |
| S6.4 largura aproveitada | 25 / 0 | 25 / 0 | — |
| S6.5 sem regressão | 13 / 0 | 13 / 0 | — |
| S6.6 páginas auxiliares | 82 / 0 | **94 / 1** | +12 `.bruto` (extra), +1 `#pluxeeEdit`; FALHOU `S6.6.financeiro.bruto` |
| S6.7 véu | 17 / 0 | 17 / 0 | — |
| S6.8 versões e trechos | 19 / 1 | **19 / 0** | emendas; o id `marketplace/index.html.intencao` só aparece quando o literal falha, e não aparece mais |
| S6.9 orçamento vertical e toast | 8 / 0 | 8 / 0 | — |
| S6.10 paisagem | 6 / 2 | **13 / 0** | painel e entrada ok; +1 diálogo; +4 `.bruto` (extra) |
| P1 a P6 | 19 / 0 | 19 / 0 | — |
| **Total** | **381 / 3** | **430 / 1** | |

### R2.4 Medidas dos ids novos e alterados

**App, dois perfis** (`‹p›` = `17pm` ou `13`). Os valores foram iguais nos dois perfis em todos estes ids.

| id | iphone17promax | iphone13 |
|---|---|---|
| `S6.1.‹p›.{mes,dia,lista,atrasadas,sequencia,menu,nova-tarefa}.bruto` | ok — fora 0; nenhum excluído | ok — fora 0; nenhum excluído |
| `S6.1.‹p›.{jarvis,voz}.bruto` | ok — fora 0; excluídos `#jarvis-chips` (14 filhos) | ok — idem |
| `S6.1.‹p›.{reagendar,alertas}.bruto` | ok — fora 0; nenhum excluído | ok — idem |
| `S6.3.‹p›.dia.B.notas-toggle` / `.agenda-share` | ok — 8 / 8 botões, h 28, zona 44,98, extensão acima 8,98 / abaixo 8,00 | ok — idem |
| `S6.3.‹p›.atrasadas.B.notas-toggle` / `.agenda-share` | ok — 24 / 24, zona 44,98 (8,98 / 8,00) | ok — idem |
| `S6.3.‹p›.sequencia.B.notas-toggle` / `.agenda-share` | ok — 8 / 8, zona 44,98 (8,98 / 8,00) | ok — idem |
| `S6.3.‹p›.lista.B.notas-toggle` / `.agenda-share` | ok — 52 / 60, zona 44,98 (8,98 / 8,00) | ok — idem |
| `S6.3.‹p›.lista.B.tr-open` | ok — 17, zona **44,00–44,98**, menor extensão abaixo 7,02 (ver nota) | ok — idem |
| `S6.3.‹p›.lista.B.list-previous` | ok — 1, zona 44,98 (sem borda, `-8px`) | ok — idem |
| `S6.3.‹p›.{dia,lista,atrasadas,sequencia}.B.pares` | ok — 8 / 60 / 24 / 8 cartões, 32 / 249 / 96 / 32 interativos, **0 pares** | ok — idem |

Nota do `.tr-open`: com `row-gap:16px` nos cartões com `.tr-open`, a zona geométrica dele ([T−8, T+36]) **encosta**
na do `.agenda-share` da linha de baixo ([T+36, T+80]), sem sobreposição. O artefato de cerca de 1 px do teste de alvo
dá esse último pixel ao `.agenda-share`, que vem depois no DOM. Por isso 44,00 em alguns `.tr-open`: passa o 43,5, e o
teste de pares dá 0.

**Auxiliares (17PM):**

| id | resultado e medida |
|---|---|
| `S6.6.financeiro.B..sa-footbutton` | ok — 1 botão, h 28, zona 44,98 (borda 1 px, `-9px`) |
| `S6.6.financeiro.B..iv-footbutton` | ok — 2 botões, h 28, zona 44,98 (8,58 / 8,41; borda 0, `-8px`) |
| `S6.6.financeiro.B.#pluxeeEdit` | ok — 1 botão, h 28, zona 44,98 (8,58 / 8,41; borda 1 px, `-9px`) |
| `S6.6.investimentos.B..editbtn` | ok — 4 botões, h 28, zona 44,98 (8,98 / 8,00) |
| `S6.6.‹11 páginas›.bruto` | ok — fora 0. Excluídos: em `equipamentos-especiais`, `#filtros` (4) e `#filtros-cat` (6); nas outras, nenhum |
| `S6.6.financeiro.bruto` | **FALHOU** — fora 2: `button[data-f=reemb]` 344,2..457,1 e `button[data-f=extrato]` 464,1..534 (excluídos `#saldoAtual` 3 e `#pager` 37) **vs** 0 com `right > 440,5` |

**Paisagem** (956×440, 20/20/62/62):

| id | resultado e medida |
|---|---|
| `S6.10.paisagem.jarvis.painel` | ok — top 20, bottom 330 (altura 310) |
| `S6.10.paisagem.jarvis.entrada` | ok — painel 20..330 × 62..462; mic 261..305 × 75..119, campo 261..305 × 127..397, enviar 261..305 × 405..449 |
| `S6.10.paisagem.nova-tarefa.dialogo` | ok — top 36, bottom 404 (480×368) |
| `S6.10.paisagem.{mes,lista,jarvis,nova-tarefa}.bruto` | ok — fora 0 |
| `S6.10.paisagem.{mes,lista,jarvis}.sw` / `.lados` | ok — 956; 5 / 5 / 16 fixos em [62, 894] (iguais à rodada 1) |

**Textos (S6.8):**

| id | resultado e medida |
|---|---|
| `S6.8.versoes` | ok — `index.html`: `treino.js?v=14`, `notas.js?v=11`, `agenda-sharing.js?v=6`, `sequencial.js?v=4`, `vozes-neurais.js?v=2`; `treino.html`: `treino.js?v=14`. Uma ocorrência de cada, nenhuma outra versão |
| `S6.8.index.html` | ok — 41/41 trechos (39 da rodada 1, mais `#jarvis-msgs` e `.task-footer`) |
| `S6.8.financeiro.html` | ok — 7/7 (+ `#pluxeeEdit`) |
| `S6.8.equipamentos-especiais.html` | ok — 10/10 (+ `.toolbar button` e `.catbar button`) |
| `S6.8.marketplace/index.html` | ok — 7/7 (com a emenda) |
| demais arquivos | ok — mesmas contagens da rodada 1 (notas.js 2/2, agenda-sharing.js 2/2, treino.js 7/7, investimentos.html 4/4…) |

Os demais ids (S6.2, S6.4, S6.5, S6.7, S6.9, nível A da S6.3, P1–P6 e S6.6 de páginas, sw, cabeçalho, ilha, indicador,
alvos e véu) têm exatamente as medidas da tabela (a) da rodada 1. Comparei automaticamente:
`scratchpad/f5r2/compara.py`.

### R2.5 Mutantes

Método:

1. Cópia do repositório sem `.git` em `scratchpad/f5r2/mut-m7/` e `scratchpad/f5r2/mut-z42/`, servidas em 8811 e 8812.
2. Roda o `layout.cjs` **do repositório** contra a porta da cópia, com `LAYOUT_CAPTURAS` e `LAYOUT_JSON` próprios.
3. Como o S6.8 lê os textos do repositório (sem mutação), tudo o que reprova vem da **medição**.
4. As duas execuções correram em paralelo.

| Mutante | Alteração na cópia (old → new) | Resultado | Ids que reprovaram por causa do mutante |
|---|---|---|---|
| **M7** | `index.html`: `.list-more{display:flex;align-items:center;min-height:44px;` → `…min-height:44px;width:470px;` | **426 ok / 5 FALHOU** | `S6.1.17pm.lista.bruto`, `S6.1.17pm.reagendar.bruto`, `S6.1.13.lista.bruto`, `S6.1.13.reagendar.bruto`: "`#viewContent button.list-previous.list-more 17..487`". O `S6.1.‹p›.lista` antigo continua ok (scrollWidth 440 / 390): é exatamente o R5, agora coberto. A 5ª falha é a pré-existente do financeiro |
| **Zona 42** | `notas.js`: `.notas-toggle::before{…top:-9px;bottom:-9px}` → `top:-8px;bottom:-8px` | **420 ok / 11 FALHOU** | 8 ids `S6.3.{17pm,13}.{dia,lista,atrasadas,sequencia}.B.notas-toggle`: zona **42,98** (acima 7,98, abaixo 7,00), 0 de 8 / 52 / 24 / 8 botões. As outras 3 falhas: a pré-existente do financeiro e `S6.5.e2e-atualiza` com `P5`, que são ruído |

- **O `e2e-atualiza` é ruído da carga paralela, não do mutante:** rodado sozinho contra a 8812, duas vezes, deu
  7 ok e 0 FALHOU. A revisão final viu o mesmo ruído com Chromiums em paralelo.
- **O texto também pegaria:** na cópia M7, o `new` do `.list-more` dá `grep -c` 0. Na cópia de zona 42, o `new` com
  `-9px` dá 0 e o `old` com `-8px` dá 1.
- **Pares:** o autoteste com `row-gap:6px` injetado, descrito em R2.2, deu 9 pares.

### R2.6 Falhas (c)

#### 1. `S6.6.financeiro.bruto` (verificação extra, fora da lista fechada): dois filtros do financeiro ficam fora da tela. **Pré-existente**

- **Perfil:** `iphone17promax`. Medi também no `iphone13` (script `scratchpad/f5r2/fin.cjs`): mesmas posições,
  scrollWidth 390.
- **Página:** `financeiro.html`.
- **Seletores:** `div.filters > button[data-f="reemb"]` ("Reemb./Refat.") e `div.filters > button[data-f="extrato"]`
  ("Extrato").
- **Medida obtida:**
  - "Reemb./Refat." ocupa 344,2..457,1: **cortado na borda**;
  - "Extrato" ocupa 464,1..534: **inteiro fora da tela, sem como alcançar**;
  - o `.filters` ocupa 16..424, com `scrollWidth` 518 e `clientWidth` 408 (358 no 13).
- **Esperado:** 0 elementos com `right > 440,5`.
- **Por que o `S6.6.financeiro.sw` não via:** a linha não rola (`overflow` visível, `flex` sem `wrap`). Quem esconde o
  excesso é o `finance-mobile-guard.js:10-14` (`body, .app { overflow-x: clip }`), que também mantém o
  `documentElement.scrollWidth` em 440. É o mesmo ponto cego do R5.
- **Já existia antes da missão.** Na auditoria F2 (estado de antes), os seis botões mediam
  63 + 81 + 67 + 89,2 + 112,9 + 69,9, mais 5 vãos de 7 px: 518. A missão só mudou a altura (35 → 44).
- **CSS provável:** `financeiro.html:2`, `.filters{display:flex;gap:7px;margin:12px 0}`.
- **Correção sugerida** (medida com CSS injetado, sem editar o app):
  - `.filters{display:flex;gap:7px;margin:12px 0}` → `.filters{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}`;
  - resultado: duas linhas (altura 44 → 95), "Reemb./Refat." 16..129 e "Extrato" 136..206 na segunda linha, 0
    elementos fora, nos dois perfis (`scratchpad/f5r2/fin-fix.cjs`);
  - alternativa: `overflow-x:auto` (rolar, como o `#filters` do app). Nesse caso o `.filters` do financeiro entra na
    lista `ROLAGEM_INTENCIONAL`.
- **Captura:** `iphone17promax-aux-financeiro.png` mostra a linha cortada no pé da tela ("Reemb./Refat" sem o ponto,
  "Extrato" invisível).
- **Gravidade:** fica para a C2 e o coordenador. É pré-existente e não está na lista fechada; mantive o FALHOU, como
  manda o briefing ("não conserte o teste para passar").

Nenhuma outra falha.

### R2.7 Emendas aplicadas ao oráculo do S6.8 (diferenças em relação ao texto da especificação)

| Arquivo | Trecho | Na especificação (3.13 / 4) | No teste da rodada 2 | Fonte |
|---|---|---|---|---|
| `marketplace/index.html` | fechar `.x` | new `width:44px;height:44px;` | new `.x{float:right;display:grid;place-items:center;width:44px;height:44px;` (old `width:38px;height:38px;` = 0) | F5-rodada2, item 3 |
| `marketplace/index.html` | `#cofre label` | old = 0 e new = 1 | só new = 1 | F5-rodada2, item 3 |
| `index.html`, `treino.html` | versões | `treino.js?v=13`, `notas.js?v=10`, `agenda-sharing.js?v=5` | `?v=14`, `?v=11`, `?v=6` (e as versões intermediárias = 0) | F5-rodada2, item 5 |
| `notas.js`, `agenda-sharing.js`, `treino.js` | `::before` do nível B | `top:-8px;bottom:-8px` | `top:-9px;bottom:-9px` (o `-8px` vira old = 0) | contrato emendado, F5-rodada2 item 2 (R1) |
| `financeiro.html` | `.sa-foot button::before` | `-8px` | `-9px` (borda 1 px); `.iv-foot button::before` fica `-8px` (borda 0) | idem (R1) |
| `investimentos.html` | `.editbtn::before` | `-8px` | `-9px` | idem (R1) |
| `index.html` | `dialog` | new `…max-height:calc(100dvh - 32px);` | new `…max-height:calc(100dvh - 32px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));` | R3, decisão do coordenador (`plano.md`), F3-rodada3 |
| `index.html` | `#jarvis-panel` | new `…max-height:72dvh;` | new `…max-height:min(72dvh,calc(100dvh - 90px - env(safe-area-inset-bottom,0px) - env(safe-area-inset-top,0px)));` | R2, idem |
| `index.html` | `#jarvis-msgs` | — | old `gap:10px;min-height:120px}` → new `gap:10px;min-height:min(120px,15dvh)}` | R2, idem |
| `index.html` | `.task-footer` | — | old `…gap:16px 6px;margin-top:6px}` → new `…gap:6px;margin-top:6px}.task-footer:has(.tr-open){row-gap:16px}` | ponto de projeto P2, idem |
| `equipamentos-especiais.html` | `.toolbar button`, `.catbar button` | — | `+min-height:44px` (old = 0, new = 1) | R4, F4-rodada3 |
| `financeiro.html` | `#pluxeeEdit` | — | new `#pluxeeEdit{position:relative;min-height:28px}#pluxeeEdit::before{…top:-9px;bottom:-9px}` | R4, F4-rodada3 |

Nenhum esperado numérico da S6.4, S6.7 ou S6.9 precisou mudar: as medidas da rodada 2 são iguais às da rodada 1.

### R2.8 Suítes E2E e teste de unidade

Nas três execuções da entrega (1, 2 e 3), as 9 suítes e o teste de unidade deram o mesmo resultado da rodada 1:

- e2e-so-claude 10, e2e-voz-saida 6, e2e-voz 6, e2e-gasto 4, e2e-multi 4, e2e-atualiza 7, e2e-lista 7, e2e-ouvindo 1 e
  e2e-vozes-app 8: **53 ok e 0 FALHOU**, todas com código de saída 0;
- unidade: **pass 1, fail 0**;
- `pageerror`: 0 nos três perfis.

### R2.9 O que não testei nesta rodada (além da seção (d) da rodada 1)

- A zona do nível B é a do teste de alvo do Chromium (`elementFromPoint`), com o artefato de cerca de 1 px acima. Não
  é o dedo nem o WebKit.
- **Limites do `.bruto`:**
  - um elemento escondido por `clip-path` ou `clip`, ou coberto por outro, conta como visível. Não apareceu nenhum
    caso assim;
  - nas auxiliares, ele roda só no 17PM, porque a S6.6 é só do 17PM. O financeiro no 13 conferi à parte.
- **Mutantes:** rodaram com o `layout.cjs` do repositório, então o S6.8 leu os textos sem mutação. A detecção mostrada
  é só por medição; a do texto conferi com `grep -c` nas cópias.
- O `sw.js` (CACHE v247 e as constantes `?v=` do R7) não faz parte da S6.8 e não foi conferido.

### R2.10 Capturas

Foram refeitas pela execução 3 em
`/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/verificacao/`, com os
mesmos nomes da rodada 1, mais `iphone17promax-paisagem-nova-tarefa.png`.

- `iphone17promax-paisagem-jarvis.png` mostra o painel inteiro abaixo da faixa e a linha de entrada visível.
- `iphone17promax-aux-financeiro.png` mostra a falha R2.6.
- As capturas dos mutantes ficam em `scratchpad/f5r2/capt-m7/` e `scratchpad/f5r2/capt-z42/`.
