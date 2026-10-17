# Relatório F3: app principal (layout 17 Pro Max)

Data: 17/10/2026. Base: commit `3081ea4` (spec aprovada). Arquivos editados: `index.html`, `notas.js`,
`agenda-sharing.js`, `sequencial.js`, `treino.js`, `vozes-neurais.js`. Nenhum outro arquivo do app foi tocado.

**Nota sobre o git.** Não fiz commit. Enquanto eu media, apareceu o commit `ecebe40` ("WIP layout 17 Pro Max:
F3 em andamento", autor Claude, 09:31 UTC, na branch do PR rascunho #128). Ele contém exatamente as minhas
edições nos 6 arquivos: `git diff ecebe40 -- <6 arquivos>` está vazio e `git show --stat ecebe40` lista só
esses 6 (35+/33−). Por isso o `git status --short` de agora mostra só os arquivos da F4 (`*.html` auxiliares
e `treino.html`), que não são meus.

Scripts e saídas desta frente ficam em
`/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/f3/`:
- `trechos.cjs`: lista old→new e contagem;
- `aplicar.cjs`: aplicação;
- `medir-f3.cjs`: medição da seção 6, que gera `medicoes-f3.json`;
- `dbg-tropen.cjs` e `dbg-footer2.cjs`: investigação do `.tr-open`;
- `e2e/`: logs das suítes.

## (a) Itens da seção 3.13

Contagem antes de editar: cada `old` aparecia 1 vez no arquivo certo (`node trechos.cjs`). Depois: `old`=0 e
`new`=1 em todos, **exceto 18b** (ver abaixo).

| # | Arquivo:linha (depois) | Trecho | Situação |
|---|---|---|---|
| 1 | index.html:21 | `.view-tab{min-height:44px;` | aplicado |
| 2 | index.html:21 | `.chip{…min-height:44px;padding:0 13px;` | aplicado |
| 3 | index.html:21 | `.nav-btn{…width:44px;height:44px;` | aplicado |
| 4 | index.html:21 | `.toolbar{…padding:8px 13px;` | aplicado |
| 5 | index.html:21 | `.day-pick .day-pick-input{position:absolute;inset:-4px 0;width:100%;height:auto;` | aplicado |
| 6 | index.html:21 | `.task-card{…34px minmax(0,1fr) 34px;gap:6px;` | aplicado |
| 7 | index.html:21 | `.check` 44×44 + `.check::before` (23 px) + `:checked::before` + `:checked::after{content:"✓";grid-area:1/1}` | aplicado |
| 8 | index.html:21 | `.clear-done{min-height:44px;padding:0 4px;margin:-10px -4px;border:0;` | aplicado |
| 9 | index.html:21 | `.calendar-tag` `font-size:9px` (a media query de 8px ficou como estava) | aplicado |
| 10 | index.html:21 | `dialog{…max-width:calc(100% - 32px);…` | aplicado |
| 11 | index.html:21 | `.secondary,.primary{min-height:44px;padding:10px 16px;…` | aplicado |
| 12 | index.html:21 | `.toast{…bottom:calc(184px + env(safe-area-inset-bottom));` | aplicado |
| 13 | index.html:21 | véu `body::before`, `#jarvis-locbar !important`, `#equipamentosBtn/#atualizarBtn ::after` e `svg`, depois de `.calendar-day{min-height:110px}}` | aplicado (texto do véu idêntico ao da seção 5) |
| 14 | index.html:69 | `.month-toolbar` 44/1fr/44; `.month-toolbar-spacer` 44×44 | aplicado (2 trechos) |
| 15 | index.html:70 | `.app` padding-bottom 196 + inset; `.agenda-actions` bottom 62 + inset | aplicado (2 trechos) |
| 16 | index.html:71 | `.task-reschedule{…width:44px;height:44px;margin:-6px -5px -7px;padding:0;` | aplicado |
| 17 | index.html:72 | `.list-previous` nível B + `.list-previous::before{…}`; `.list-more{…align-items:center;min-height:44px;…padding:0 20px;` | aplicado (2 trechos) |
| 18 | index.html:73 | `#rescheduleDialog` 400 / max-width; `.reschedule-head>div{flex:1;min-width:0}`; `.reschedule-task-name` max-width 100%; `.reschedule-preset` 44 | aplicado (4 trechos). **18b:** o `new` começa pelo `old` inteiro (`.reschedule-head{display:flex;align-items:center;gap:12px}` + regra nova), então `grep -c old` continua 1. Isso é inevitável pelo texto da spec, não é sobra. |
| 19 | index.html:74 | `.field-check{…min-height:44px;margin-top:4px;` | aplicado |
| 20 | index.html:801 | `#jarvis-panel` sem `max-width:420px` | aplicado |
| 21 | index.html:803 | `#jarvis-header{…gap:8px;padding:10px 16px 8px;` | aplicado |
| 22 | index.html:808 | `.jarvis-hbtn{width:44px;height:44px;border:0;border-radius:12px;` | aplicado |
| 23 | index.html:818 | `#jarvis-mic{width:44px;height:44px;` | aplicado |
| 24 | index.html:821 | `#jarvis-input{flex:1;min-height:44px;` | aplicado |
| 25 | index.html:824 | `#jarvis-send{width:44px;height:44px;` | aplicado |
| 26 | index.html:846 | `.j-chip` `min-height:44px;padding:0 13px` | aplicado |
| 27 | index.html:853 | `#app-ver` bottom 10 + inset | aplicado |
| 28 | index.html:855 | `#app-update` 44×44 | aplicado |
| 29 | index.html:1839/1842/1852/1853/1858 | `treino.js?v=13`, `notas.js?v=10`, `agenda-sharing.js?v=5`, `sequencial.js?v=4`, `vozes-neurais.js?v=2` | aplicado (1 ocorrência cada) |
| notas | notas.js:60 + :61 | `.notas-toggle{position:relative;…min-height:28px;` + linha nova `.notas-toggle::before{…}` | aplicado |
| sharing | agenda-sharing.js:40 | `.agenda-share{position:relative;…min-height:28px;padding:3px 7px;` + `.agenda-share::before{…}` logo após o `}` | aplicado |
| seq | sequencial.js:21 | `margin:0 0 14px;min-height:44px;padding:0 14px;` | aplicado |
| tr402 | treino.js:402 + :403 | `.tr-open{position:relative;…min-height:28px;…` + linha nova `.tr-open::before{…}` | aplicado |
| tr411 | treino.js:412 | `.tr-close` 44×44 | aplicado (a linha andou +1 por causa do `::before` novo) |
| tr412 | treino.js:413 | `.tr-home` min-height 44 | aplicado |
| tr423 | treino.js:424 | `.tr-preset{min-height:44px;min-width:44px;padding:0 10px;` | aplicado |
| tr426 | treino.js:427 | `.tr-tbtn{width:44px;height:44px;` | aplicado |
| tr457 | treino.js:458 | `.tr-inputs input{width:100%;min-height:44px;` | aplicado |
| vz97 | vozes-neurais.js:97 | `#voz-dialog{width:min(420px,calc(100vw - 32px));max-width:calc(100vw - 32px);…` | aplicado |
| vz102 | vozes-neurais.js:102 | `.vz-x` 44×44, raio 12 | aplicado |
| vz120 | vozes-neurais.js:120 | `.vz-ouvir` `min-height:44px;padding:0 12px` | aplicado |

As regras de nível B (`.list-previous`, `.notas-toggle`, `.agenda-share` e `.tr-open`) usam o par exato da
seção 5: `position:relative;min-height:28px` + `::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}`
(`grep -c` = 1 em cada arquivo).

## (b) Medições depois da mudança

Medidas com `harness/medir.cjs` (método `cdp`; `env()` medido 62/34 e 47/34), Chromium 141, servidor
`127.0.0.1:8765` servindo a árvore de trabalho. Fonte: `scratchpad/f3/medicoes-f3.json`. `page.__erros` ficou
vazio nas 9 vistas e nos diálogos, nos dois perfis.

### Item 1: sem rolagem lateral

| Perfil | 9 vistas: `scrollWidth` / `transbordando` | Reagendar `scrollWidth` | Alertas `scrollWidth` | Esperado | OK |
|---|---|---|---|---|---|
| 17PM | 440 em todas / 0 em todas | 440 | 440 | 440, vazio | sim |
| 13 | 390 em todas / 0 em todas | 390 | 390 | 390, vazio | sim |

### Item 2: ilha e indicador (rolagem 0)

| Perfil | `interativosSobIlha` (9 vistas) | fixos sob o indicador | folga `#app-update` / `#jarvis-btn` / `#openDialog` / `#cardioFab` | menor folga de fixo interativo | Esperado | OK |
|---|---|---|---|---|---|---|
| 17PM | 0 em todas | 0 em todas | 10 / 12 / 62 / 125 (igual nas 9 vistas) | 10 (`#app-update`) | 10/12/62/125, nenhum < 8 | sim |
| 13 | 0 em todas | 0 em todas | 10 / 12 / 62 / 125 | 10 | idem | sim |

### Item 3: alvos de toque

Nível A (`w ≥ 44 && h ≥ 44`):

| Alvo | 17PM medido | 13 medido | Esperado 17PM | OK |
|---|---|---|---|---|
| `#viewTabs .view-tab` ×4 | 96.5×44 | 84×44 | 96.5×44 | sim |
| `#filters .chip` ×4 | 66.7–99.5 × 44 | 66.7–99.5 × 44 | 66.7–99.5 × 44 | sim |
| `#viewContent .nav-btn` ×2 (dia) | 44×44 | 44×44 | 44×44 | sim |
| `#calFullBtn` | 44×44 | 44×44 | 44×44 | sim |
| `#jarvis-mic`, `#jarvis-send` | 44×44 | 44×44 | 44×44 | sim |
| `.jarvis-hbtn` ×3 | 44×44 | 44×44 | 44×44 | sim |
| `#seqTimerBtn`, `#parceiroBtn`, `#moreMenuBtn` | 46×46 | 46×46 | 46×46 | sim |
| `#openDialog` | 148.8×54 | 148.8×54 | 148.8×54 | sim |
| `#jarvis-btn` | 56×56 | 56×56 | 56×56 | sim |
| `#app-update` | 44×44 | 44×44 | 44×44 | sim |
| `#seqEntryBtn` | 408×44 | 358×44 | 408×44 | sim |
| `.j-chip` ×7 | 82.3–116.3 × 44 | idem | h 44 | sim |
| `#jarvis-locbar` | 414×44 | 364×44 | 414×44 | sim |
| `#jarvis-input` | 286×44 | 236×44 | h 44 | sim |
| `#clearDone` | 124.5×44 | 124.5×44 | h 44 | sim |
| `.list-more` | 192.8×44 | 192.8×44 | h 44 | sim |
| `#viewContent .check` | 44×44 (8 dia, 60 lista, 24 atrasadas, 8 sequência) | idem | 44×44 | sim |
| `#viewContent .task-reschedule` | 44×44 (mesmas contagens) | idem | 44×44 | sim |
| `#viewContent .day-pick-input` | 96.2×44 | 96.2×44 | 96.2×44 | sim |
| `#closeTaskDialog` / `#taskForm .primary` | 95.4×44 / 99.9×44 | idem | h 44 | sim |
| `#taskForm .field-check` | 364×44 | 314×44 | h 44 | sim |
| `.reschedule-preset` ×3 | 114.7×44 | 100.7×44 | h 44 | sim |
| `#rescheduleForm .secondary` / `.primary` | 95.4×44 / 108.2×44 | idem | h 44 | sim |
| `#activateAlerts` / `#exportCalendar` / `#closeAlertsDialog` | 364×44 / 364×44 / 80.9×44 | 314×44 / 314×44 / 80.9×44 | h 44 | sim |
| `#voz-dialog .vz-x` | 44×44 | 44×44 | 44×44 | sim |
| `#voz-dialog .vz-ouvir` | 64.3×44 | 64.3×44 | h 44 | sim |

Nível B: `h ≥ 28` e `elementFromPoint(cx, top−6)` / `(cx, bottom+6)` devolvem o próprio botão, com cada
ocorrência rolada para o meio da tela por `scrollIntoView({block:'center'})`. Valores iguais nos dois perfis.

| Alvo | ocorrências | h mín | acima ok | abaixo ok | OK |
|---|---|---|---|---|---|
| `.notas-toggle` (dia/lista/atrasadas/sequência) | 8 / 52 / 24 / 8 | 28 | todas | todas | sim |
| `.agenda-share` (dia/lista/atrasadas/sequência) | 8 / 60 / 24 / 8 | 28 | todas | todas | sim |
| `.list-previous` (lista) | 2 | 28 | 2/2 | 2/2 | sim |
| `.tr-open` (lista) | 17 | 28 | 17/17 | **8/17** | **não**, ver abaixo |

**`.tr-open`: 9 de 17 falham o teste de baixo.** O motivo é um layout que já existia, não o CSS novo:
- Nos 9 cartões "Academia — treino" o rodapé (`.task-footer`, `gap:6px`) quebra em duas linhas.
- O `.tr-open` fica na linha 1, em x 207–296 (17PM). O `.agenda-share` fica logo abaixo, na linha 2, em x 197–296.
- A distância entre as linhas é 6 px. Então `bottom+6` cai exatamente na borda de cima do `.agenda-share`, que
  é o elemento que `elementFromPoint` devolve.
- No 13 acontece o mesmo: o `.agenda-share` da linha 3 fica em x 0–98.6 e cobre o `cx` 73 do `.tr-open`.

Para confirmar que a quebra já existia, servi o commit `3081ea4` (antes da F3) na porta 8767 e medi o mesmo
rodapé (`dbg-footer2.cjs`):
- antes: rodapé de 299 px, `.tr-open` na linha 1 e `.agenda-share` na linha 2;
- depois: rodapé de 296 px, mesma disposição.

As outras 8 ocorrências (cartões "Cardio") passam. Nenhuma regra da spec resolve isso sem mudar o espaçamento
do rodapé (por exemplo, `row-gap` maior). Não improvisei. Ficou como pendência para o maestro e a C2.

`medir().alvosPequenos` no 17PM, comparado com o resultado esperado da spec:

| Vista | Medido | Esperado | OK |
|---|---|---|---|
| mes, menu, jarvis | `[]` | `[]` | sim |
| dia, sequencia | só `.notas-toggle` 93.3×28 e `.agenda-share` 98.6×28 | só esses dois (h 28) | sim |
| atrasadas | só `.notas-toggle` (várias larguras, todas h 28; a classe `.has` muda o texto) e `.agenda-share` 98.6×28 | só esses dois (h 28) | sim |
| lista | `.list-previous` 118.5×28, `.notas-toggle` ×52, `.agenda-share` ×60, `.tr-open` 88.7×28 ×9 e 86.3×28 ×8 | esses mais `.list-previous` e `.tr-open` (h 28) | sim |
| voz | `a[href=piper]` 25×13, `a[href=kokoro]` 60.5×13 | os dois links de crédito (13 px) | sim |
| nova-tarefa | `#taskLembrete` 18×18, dentro de `label.field-check` com h 44 | idem | sim |

No 13 as listas são iguais. A única diferença é o link Kokoro (317.9×28.2, quebrado em 2 linhas), que já
estava assim antes (`medicoes-antes.json`) e no experimento da C1.

### Item 4: largura aproveitada

| Medida | 17PM | 13 | Esperado (17PM × 13) | OK |
|---|---|---|---|---|
| `larguraConteudo` | 440 | 390 | 440 × 390 | sim |
| `larguraConteudoInterna` | 408 | 358 | 408 × 358 | sim |
| `celulaCalendario` | 52.6 | 46 | 52.6 × 46 | sim |
| `celulaCalendarioAltura` | 91 | 78 | 91 × 78 | sim |
| `#taskDialog` | 408 | 358 | 408 × 358 | sim |
| `#voz-dialog` | 408 | 358 | 408 × 358 | sim |
| `#alertsDialog` | 408 | 358 | 408 × 358 | sim |
| `#rescheduleDialog` | 400 | 358 | 400 × 358 | sim |
| `.reschedule-task-name` | 303 (scrollW 385, `overflow:hidden`) | 261 | 303 × 261 | sim |
| `#jarvis-panel` | 416 | 366 | 416 × 366 | sim |
| `#viewContent .task-main` | 296 | 246 | 296 × 246 | sim |
| `.calendar-tag` font-size | 9px | 8px | 9px × 8px | sim |

### Item 7: véu (M10)

| Perfil | Vistas | `::before` position / height / zIndex / content | cor do véu = cor do `body` | rolado 400: `elementFromPoint(220,31)` | interativos sob a ilha cobertos | Esperado | OK |
|---|---|---|---|---|---|---|---|
| 17PM | mes, lista | fixed / 62px / 60 / `""` | rgb(5,5,6) = rgb(5,5,6) | `body`, fora de `main.app` | 7 de 7 | 62, 7/7 | sim |
| 13 | mes, lista | fixed / 47px / 60 / `""` | rgb(5,5,6) = rgb(5,5,6) | `body`, fora de `main.app` | 3 de 3 | 47, 3/3 | sim |

Itens do menu (M9): `::after` mostra "Equipamentos Especiais" e "Atualizar o app" nos dois perfis; os itens
continuam 244×46.

### Item 8: versões e trechos

- `index.html`: `treino.js?v=13`, `notas.js?v=10`, `agenda-sharing.js?v=5`, `sequencial.js?v=4` e
  `vozes-neurais.js?v=2` aparecem 1 vez cada.
- `treino.html` é da F4.
- Trechos da 3.13: `old`=0 e `new`=1 em todos, exceto 18b (`old`=1, porque o `new` contém o `old`; ver (a)).

### Item 9: altura do topo e toast

| Medida | 17PM | 13 | Esperado | OK |
|---|---|---|---|---|
| `#viewTabs` h | 54 | 54 | 54 (17PM) | sim |
| `#seqEntryBtn` h | 44 | 44 | 44 | sim |
| `#filters` h | 60 | 60 | 60 | sim |
| `.toolbar` h | 62 | 62 | 62 | sim |
| `top` da 1ª `.calendar-day` | 598.2 | 611.9 | 598 ± 2 / 612 ± 2 | sim |
| toast `bottom` (`#toast.show`) | 738 (= 956 − 34 − 184) | 626 (= 844 − 34 − 184) | 738 / 626 | sim |
| toast `bottom` < `#cardioFab.top` | 738 < 749 | 626 < 637 | 749 / 637 | sim |

## (c) Suítes E2E e teste de unidade

Comando: `node <suíte> http://127.0.0.1:8765/index.html` (a `e2e-vozes-app` recebe também o scratchpad).
Resultado da rodada final, todas em sequência (logs em `scratchpad/f3/e2e/final/`):

| Suíte | ok | FALHOU | rc |
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
| `node --experimental-strip-types --test tests/jarvis-claude.test.mjs` | pass 1 | fail 0 | 0 |

Falha intermitente registrada: na 1ª rodada, `e2e-atualiza` falhou uma vez (`assert carregamentos 1 == 2`,
linha 31, teste "fechado o Jarvis… recarrega", 3 ok antes; log em `scratchpad/f3/e2e/e2e-atualiza.log`).
Depois rodei 8 vezes contra a F3 (`:8765`) e 8 vezes contra o commit pré-F3 (`:8767`): 16 de 16 passaram,
7 ok cada (logs `atualiza-<porta>-<n>.log`). A rodada final também passou. Leio como instabilidade de tempo
da própria suíte (o selo vira v245 antes de contar o `load`), não como efeito do CSS. Não consegui reproduzir.

## (d) Capturas depois da mudança

Pasta `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/depois/`
(a página inteira de cada uma fica em `depois/pagina-inteira/` com o mesmo nome):

- `iphone17promax-mes.png`, `iphone17promax-dia.png`, `iphone17promax-lista.png`, `iphone17promax-atrasadas.png`,
  `iphone17promax-sequencia.png`, `iphone17promax-menu.png`, `iphone17promax-nova-tarefa.png`,
  `iphone17promax-jarvis.png`, `iphone17promax-voz.png`
- `iphone13-mes.png`, `iphone13-dia.png`, `iphone13-lista.png`, `iphone13-atrasadas.png`, `iphone13-sequencia.png`,
  `iphone13-menu.png`, `iphone13-nova-tarefa.png`, `iphone13-jarvis.png`, `iphone13-voz.png`
- Extras: `iphone17promax-reagendar.png`, `iphone17promax-alertas.png`, `iphone13-reagendar.png` e `iphone13-alertas.png`.

Conferi a olho a `iphone17promax-lista.png`: a caixa de marcar continua com o quadrado de 23 px (vazio) e o
quadrado preenchido com ✓ (concluída), como antes.

## Pendências

1. **`.tr-open` nível B, teste de baixo: 9 de 17 falham nos dois perfis.** A causa é a quebra de linha do
   rodapé dos cartões de treino, que já existia, com 6 px entre as linhas. Decisão de layout para o maestro/C2:
   por exemplo, `row-gap` ≥ 7 px no `.task-footer` dos cartões de treino, ou aceitar o teste só de cima nesses casos.
2. **18b:** `grep -c` do `old` continua 1 por construção. O verificador deve aceitar.

## Rodada 2 (devolução do coordenador: critério 3, `.tr-open` nível B)

Data: 17/10/2026. Briefing: `briefings/F3-rodada2.md`. Mudei só uma regra, como o coordenador decidiu:

- `index.html:21`: `.task-footer{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px}` →
  `.task-footer{display:flex;flex-wrap:wrap;align-items:center;gap:16px 6px;margin-top:6px}`.
- `git diff --stat`: `index.html | 2 +-` (1 linha trocada). Não há outra regra `.task-footer` em `index.html` nem
  nos `.js` (`grep -o '[^{}]*task-footer[^{]*{[^}]*}'`). Nenhum outro arquivo da F3 foi tocado.

Scripts e saídas desta rodada ficam em `scratchpad/f3/`:
- `medir-f3-r2.cjs`: o mesmo `medir-f3.cjs` da rodada 1, gravando em `medicoes-f3-r2.json`;
- `cmp-r2.cjs`: compara com `medicoes-f3-rodada1.json` (cópia do JSON da rodada 1);
- `ab-footer-r2.cjs`: A/B da altura dos cartões;
- `dbg-tropen-r2.cjs`: vão e teste de toque do `.tr-open`;
- `e2e/r2/`: logs das suítes.

As capturas da rodada 1 foram guardadas em `scratchpad/layout/depois-rodada1/`. As de `scratchpad/layout/depois/`
foram regravadas com o CSS desta rodada (mesmos nomes).

### Critério 1: grep

| Trecho | `grep -c` em `index.html` |
|---|---|
| old (`gap:6px;margin-top:6px}` do `.task-footer`) | 0 |
| new (`gap:16px 6px;margin-top:6px}`) | 1 |

### Critério 2: nível B (`medicoes-f3-r2.json`, mesmo método da rodada 1)

A tabela vale igual para os dois perfis (17PM e 13). Em todas as linhas, h mín = 28.

| Alvo | ocorrências (vistas) | acima ok | abaixo ok |
|---|---|---|---|
| `.tr-open` (lista) | 17 | 17/17 | **17/17** (rodada 1: 8/17) |
| `.notas-toggle` | 8 dia, 52 lista, 24 atrasadas, 8 sequência | todas | todas |
| `.agenda-share` | 8 dia, 60 lista, 24 atrasadas, 8 sequência | todas | todas |
| `.list-previous` | 2 (lista) | 2/2 | 2/2 |

Detalhe do `.tr-open` (`dbg-tropen-r2.cjs`):
- 17PM: nas 17 ocorrências, o `.agenda-share` fica na linha de baixo, a **16 px** (rodada 1: 6 px). `bottom+6`
  devolve o próprio `.tr-open`.
- `bottom+8` cai no `div.task-footer`, porque a borda da faixa é exclusiva. `bottom+9` cai no `.agenda-share` nos 9
  cartões de treino e no `.task-footer` nos 8 de cardio.
- 13: nos 9 cartões de treino, o vão é de 16 px e o resultado é o mesmo do 17PM. Nos 8 de cardio, o `.agenda-share`
  fica na mesma linha, e `bottom+6` devolve o `.tr-open`.

`medir().alvosPequenos` ficou idêntico ao da rodada 1 nas 9 vistas e nos 2 perfis (comparação de string em
`cmp-r2.cjs`). No 17PM, a lista continua com `.list-previous` 118.5×28, `.notas-toggle` ×52, `.agenda-share` ×60,
`.tr-open` 88.7×28 ×9 e 86.3×28 ×8.

### Critério 3: itens 1, 2, 4 e 9 da seção 6, e altura dos cartões

Os valores dos itens abaixo são iguais aos da rodada 1 nos dois perfis (`cmp-r2.cjs`).
`page.__erros` ficou vazio nas vistas e nos diálogos.

- **Item 1:**
  - `scrollWidth` é 440 (17PM) e 390 (13) nas 9 vistas, no Reagendar e nos Alertas.
  - `transbordando` ficou vazio em todas.
- **Item 2:**
  - `interativosSobIlha` = 0 e nenhum fixo sob o indicador, nas 9 vistas.
  - Folgas `#app-update` / `#jarvis-btn` / `#openDialog` / `#cardioFab` = 10 / 12 / 62 / 125.
- **Item 4 (17PM × 13):**
  - `larguraConteudo` 440 × 390 e interna 408 × 358;
  - célula 52.6×91 × 46×78;
  - `#taskDialog`, `#voz-dialog` e `#alertsDialog`: 408 × 358;
  - `#rescheduleDialog` 400 × 358;
  - `.reschedule-task-name` 303 × 261;
  - `#jarvis-panel` 416 × 366;
  - `.task-main` com largura 296 × 246;
  - `.calendar-tag` 9px × 8px.
- **Item 9 (17PM / 13):**
  - `#viewTabs` 54, `#seqEntryBtn` 44, `#filters` 60 e `.toolbar` 62 nos dois;
  - 1ª `.calendar-day` em top 598.2 / 611.9;
  - toast com bottom 738 / 626, abaixo do `#cardioFab` (749 / 637).
- Item 7 (véu, não pedido nesta rodada) também ficou igual: 62/47 px, 7/7 e 3/3 cobertos.

**Altura dos cartões (`ab-footer-r2.cjs`).** Medi na mesma página, cartão a cartão, de dois jeitos:
- com o CSS atual;
- com `.task-footer{row-gap:6px !important}` injetado, que é o espaçamento antigo.

O critério foi: a altura só muda quando o rodapé quebra linha, e a mudança é de (linhas − 1) × 10 px. Resultado: os
8 casos (4 vistas × 2 perfis) passaram, sem nenhum cartão fora da regra.

| Perfil | Vista | rodapé 1 linha (Δ 0) | 2 linhas (Δ +10) | 3 linhas (Δ +20) |
|---|---|---|---|---|
| 17PM | dia | 2 | 6 | 0 |
| 17PM | lista | 9 | 51 | 0 |
| 17PM | atrasadas | 5 | 19 | 0 |
| 17PM | sequência | 0 | 8 | 0 |
| 13 | dia | 0 | 8 | 0 |
| 13 | lista | 0 | 51 | 9 |
| 13 | atrasadas | 2 | 21 | 1 |
| 13 | sequência | 0 | 8 | 0 |

**Atenção para a C2.** A quebra de linha do rodapé não acontece só nos cartões de treino:
- Ela acontece na maioria dos cartões. Por exemplo, tag + hora + "Detalhes" + "Compartilhar" não cabem em uma linha.
- Por isso a regra deixa a maior parte dos cartões 10 px mais alta (no 13, até 20 px).
- No dia do 17PM, o `.task-main` passou de 97.6/88.3/126.9 para 107.6/98.3/136.9.
- Na captura `depois/iphone17promax-lista.png`, os botões "Detalhes"/"Compartilhar" ficam mais afastados da linha da tag.
- Isso não muda nenhum item medido da seção 6. Mas a lista rola mais.

### Critério 4: suítes E2E e teste de unidade (logs em `scratchpad/f3/e2e/r2/`)

| Suíte | ok | FALHOU | rc |
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
| `tests/jarvis-claude.test.mjs` | pass 1 | fail 0 | 0 |

### Critério 5: nenhum outro arquivo

Saída de `git status --short` depois dos testes:
- `M index.html`: o único arquivo desta rodada.
- `M equipamentos-especiais.html` e `M .orquestra/layout-17promax/relatorio-F4.md`: são da F4, que está trabalhando
  ao mesmo tempo. Não mexi neles.

Não fiz commit, stash nem checkout.

### Pendências da rodada 1, atualizadas

1. **`.tr-open`:** resolvido (17/17 dos dois lados, nos dois perfis).
2. **18b:** continua como na rodada 1 (`old`=1 por construção).
