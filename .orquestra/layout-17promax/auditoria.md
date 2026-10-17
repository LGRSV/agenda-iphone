# Auditoria de layout — estado ATUAL (antes) — iPhone 17 Pro Max × iPhone 13

Frente F2 da missão `layout-17promax`. Só medição: nada do app foi alterado.

- **Data da medição:** 17/10/2026
- **Versão medida:** `sw.js` linha 1 = `agenda-lagares-v246-mais-leve`
- **Commit:** `83e17c5`
- **Navegador:** Chromium 141.0.7390.37 (`/opt/pw-browsers/chromium-1194`), Playwright de `/opt/node-tools`.
- **Perfis** (provisórios, vindos do briefing; a F1 pode corrigir):

| Perfil | Viewport | DPR | Área segura em retrato |
|---|---|---|---|
| `iphone17promax` | 440×956 | 3 | top 62 / bottom 34 / left 0 / right 0 |
| `iphone13` | 390×844 | 3 | top 47 / bottom 34 / left 0 / right 0 |

Os dois perfis usam `isMobile: true` e `hasTouch: true`.

**Harness e scripts** (todos em `.orquestra/layout-17promax/harness/`):

| Arquivo | O que faz |
|---|---|
| `medir.cjs` | Contrato: `perfis`, `abrirApp(browser, perfil, {sementes})`, `medir(page, perfil, vista)` e `capturar(page, caminhoPng)`. Extras fora do contrato: `VISTAS`, `irPara(page, vista)`, `sementesPadrao()` e `medirAreaSegura(page)`. |
| `rodar-auditoria.cjs` | Faz a prova da área segura, mede as 9 vistas nos 2 perfis e mede as páginas auxiliares. |
| `extras-auditoria.cjs` | Medições complementares: diálogo Reagendar, itens do menu, cabeçalho, calendário e estado com a página rolada. |

**Capturas:** ficam em `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/antes/`.

- `<perfil>-<vista>.png` mostra o viewport. As faixas da área segura aparecem em vermelho translúcido, só na captura.
- `pagina-inteira/<perfil>-<vista>.png` mostra a página inteira, sem marcação.
- As páginas auxiliares ficam em `aux-<pagina>.png`.

**Como reproduzir:**
```
cd .orquestra/layout-17promax/harness
node rodar-auditoria.cjs <pasta-capturas> <saida.json>
node extras-auditoria.cjs <saida-extras.json>
```

**Uso do harness:**
- `abrirApp` aceita `{sementes, caminho, metodo}`:
  - `caminho` abre uma página auxiliar;
  - `metodo` aceita `'auto'` (padrão), `'cdp'`, `'route'` ou `'nenhum'` (controle sem emulação).
- O método usado fica em `page.__areaSegura`, por exemplo `{metodo:'cdp', medido:{top:62,…}, confere:true}`.

---

## a. Emulação da área segura: método que funcionou e prova

**Método adotado: CDP `Emulation.setSafeAreaInsetsOverride`.** O Chromium 141 aceitou a chamada, devolveu `{}`, e o
`env(safe-area-inset-*)` passou a valer exatamente os insets do perfil. A sobrescrita vale para a página inteira e
**persiste nas navegações**: as 12 páginas auxiliares, abertas com `goto` depois da chamada, mediram 62/34.

O harness também traz o plano B, testado: a troca de `env(safe-area-inset-*)` por `<n>px` nas respostas
HTML/CSS/JS do 127.0.0.1 via `context.route`. Ele só entra se o CDP falhar ou se o valor medido não bater.

**Prova** (`rodar-auditoria.cjs`, seção 1; objeto `provaAreaSegura` no JSON do fim). São três medições:

1. O env medido por uma sonda com `padding: env(safe-area-inset-*)`.
2. O `padding-top` real do `.app`. A regra é `calc(18px + env(safe-area-inset-top))`, em `index.html:21`.
3. A distância do `#jarvis-btn` até o fundo. A regra é `bottom: calc(12px + env(safe-area-inset-bottom))`, em
   `index.html:70`.

| Perfil | Método | env top / bottom medido | `.app` padding-top | `#jarvis-btn` até o fundo | Confere |
|---|---|---|---|---|---|
| iphone17promax | nenhum (controle) | 0 / 0 | 18 | 12 | — |
| iphone17promax | **cdp** | **62 / 34** | **80** (= 18 + 62) | **46** (= 12 + 34) | sim |
| iphone17promax | route (plano B) | 62 / 34 | 80 | 46 | sim |
| iphone13 | nenhum (controle) | 0 / 0 | 18 | 12 | — |
| iphone13 | **cdp** | **47 / 34** | **65** (= 18 + 47) | **46** | sim |
| iphone13 | route (plano B) | 47 / 34 | 65 | 46 | sim |

**Ressalvas:**
- O Chromium aplica o override mesmo sem `viewport-fit=cover`; o iOS só informa insets com `cover`. Todas as páginas
  medidas têm `viewport-fit=cover`: `index.html:5` e o `<meta name=viewport>` de cada página auxiliar, registrado em
  `viewportMeta` no JSON. Nas páginas medidas, portanto, a emulação corresponde ao iPhone.
- A emulação não desenha a ilha nem o indicador. A faixa vermelha das capturas é a área segura inteira (0–62 e
  922–956 no 17 Pro Max).

---

## b. Métricas do `medir()` por vista × perfil (rolagem 0)

**Leitura das colunas:**
- **interativosSobIndicador:** conta à parte os elementos **fixos** (position fixed/sticky, ou dentro de um `<dialog>`
  aberto) e os elementos **no fluxo**. Os do fluxo são conteúdo que rola, cortado pela dobra da tela.
- **alvosPequenos:** seletores distintos / total de elementos com largura ou altura < 44 px.
- **Vista "atrasadas":** = Lista + filtro `[data-filter="late"]`.
- **Vista "jarvis":** o painel não é modal, então os alvos da página atrás dele também contam.

| Vista | Perfil | scrollWidth / viewportW | interativosSobIlha | interativosSobIndicador (fixos / no fluxo) | alvosPequenos (seletores / elementos) | larguraConteudo (interna) | celulaCalendario (alt.) | sobreposição aberta (w × h, top–bottom) |
|---|---|---|---|---|---|---|---|---|
| mes | iphone17promax | 440 / 440 | 0 | 0 / 7 | 11 / 11 | 440 (408) | 52.6 (91) | — |
| mes | iphone13 | 390 / 390 | 0 | 0 / 14 | 11 / 11 | 390 (358) | 46 (78) | — |
| dia | iphone17promax | 440 / 440 | 0 | 0 / 4 | 16 / 45 | 440 (408) | — | — |
| dia | iphone13 | 390 / 390 | 0 | 0 / 4 | 16 / 45 | 390 (358) | — | — |
| lista | iphone17promax | 440 / 440 | 0 | 0 / 3 | 18 / 262 | 440 (408) | — | — |
| lista | iphone13 | 390 / 390 | 0 | 0 / 7 | 18 / 262 | 390 (358) | — | — |
| atrasadas | iphone17promax | 440 / 440 | 0 | 0 / 3 | 16 / 107 | 440 (408) | — | — |
| atrasadas | iphone13 | 390 / 390 | 0 | 0 / 6 | 16 / 107 | 390 (358) | — | — |
| sequencia | iphone17promax | 440 / 440 | 0 | 0 / 3 | 13 / 41 | 440 (408) | — | — |
| sequencia | iphone13 | 390 / 390 | 0 | 0 / 4 | 13 / 41 | 390 (358) | — | — |
| menu | iphone17promax | 440 / 440 | 0 | 0 / 7 | 11 / 11 | 440 (408) | 52.6 (91) | #quickMenu 260 × 469, 136–605 |
| menu | iphone13 | 390 / 390 | 0 | 0 / 14 | 11 / 11 | 390 (358) | 46 (78) | #quickMenu 260 × 469, 121–590 |
| nova-tarefa | iphone17promax | 440 / 440 | 0 | 0 / 0 | 3 / 3 | 440 (408) | 52.6 (91) | #taskDialog 402 × 572.8, 191.6–764.4 |
| nova-tarefa | iphone13 | 390 / 390 | 0 | 0 / 0 | 3 / 3 | 390 (358) | 46 (78) | #taskDialog 352 × 572.8, 135.6–708.4 |
| jarvis | iphone17promax | 440 / 440 | 0 | 0 / 7 | 25 / 25 | 440 (408) | 52.6 (91) | #jarvis-panel 416 × 453.5, 378.5–832 |
| jarvis | iphone13 | 390 / 390 | 0 | 0 / 14 | 25 / 25 | 390 (358) | 46 (78) | #jarvis-panel 366 × 472.7, 247.3–720 |
| voz | iphone17promax | 440 / 440 | 0 | 0 / 0 | 4 / 4 | 440 (408) | 52.6 (91) | #voz-dialog 402 × 708.7, 123.7–832.3 |
| voz | iphone13 | 390 / 390 | 0 | 0 / 0 | 4 / 4 | 390 (358) | 46 (78) | #voz-dialog 352 × 725.8, 59.1–784.9 |

**Elementos flutuantes fixos** (iguais em todas as vistas sem diálogo modal), em px CSS:

| Seletor | 17 Pro Max (left–right × top–bottom) | iPhone 13 | Folga até a faixa do indicador (17PM: 922; 13: 810) |
|---|---|---|---|
| `#openDialog` (+ Nova tarefa) | 277.3–426 × 822–876 (148.8×54) | 227.3–376 × 710–764 | 46 / 46 |
| `#jarvis-btn` | 18–74 × 854–910 (56×56) | 18–74 × 742–798 | 12 / 12 |
| `#cardioFab` | 378–426 × 765–813 (48×48) | 328–376 × 653–701 | 109 / 109 |
| `#app-update` | 364.3–398.3 × 882–916 (34×34) | 314.3–348.3 × 770–804 | **6 / 6** |

**Resumo do estado atual frente à definição de pronto do `plano.md`:**

| Critério | Situação hoje |
|---|---|
| 1 — sem rolagem lateral | **Já atende** nos 2 perfis e nas 9 vistas: `scrollWidth` = `viewportW` e `transbordando` vazio. |
| 2 — nada sob a ilha nem sob o indicador | **Já atende para a ilha:** 0 em todas as vistas. **Para o indicador:** 0 elemento fixo. Os que aparecem são conteúdo no fluxo cortado pela dobra: células do calendário e botões de cartão. Ver a ressalva em PENDÊNCIAS: com a regra literal do plano, o critério 2 é inatingível sem esconder conteúdo. |
| 3 — alvos ≥ 44 px | **Não atende.** Ver os defeitos A1–A6. |
| 4 — largura extra aproveitada | **Já atende no conteúdo principal:** `.app` 440 contra 390, célula do calendário 52.6 contra 46. Os desperdícios estão nos itens da seção d. |

---

## c. Defeitos, por prioridade

**Como ler os defeitos:**
- A medida é do perfil 17 Pro Max; o iPhone 13 entre parênteses quando difere. Os px são CSS.
- "Linha" aponta o arquivo e a linha onde está a regra hoje.
- O `index.html:21` é a linha única do CSS minificado principal.

### ALTO — alvos de toque < 44 px nos controles do critério 3 do plano

| # | Vista(s) | Perfil | Seletor | Medida | Por que é defeito | CSS atual (linha) |
|---|---|---|---|---|---|---|
| A1 | mes, dia, lista, atrasadas, sequencia | ambos | `#viewTabs button.view-tab` (4 abas) | 96.5 × **37** (13: 84 × 37) | Altura < 44 (HIG); são as abas de visão do critério 3 | `.view-tab{min-height:37px;…font-size:13px}` — `index.html:21`; trilho `.view-tabs{…padding:4px…}` — `index.html:21`; pílula `.view-tabs::before{top:4px;bottom:4px;…}` — `index.html:80` |
| A2 | mes, dia, lista, atrasadas, sequencia | ambos | `#filters button.chip` (Todas, Atrasadas, Concluídas, Trabalho) | 66.7–99.5 × **34** | Altura < 44; filtros do critério 3 | `.chip{flex:0 0 auto;padding:8px 13px;…font-size:13px}` — `index.html:21` |
| A3 | dia; mes | ambos | `#viewContent button.nav-btn` (Dia anterior / próximo); `#calFullBtn` (`.nav-btn.month-full-btn`) | **35 × 35** | Setas de navegação do critério 3 abaixo de 44 nos dois eixos | `.nav-btn{…width:35px;height:35px…}` — `index.html:21`; `.month-toolbar{grid-template-columns:35px minmax(0,1fr) 35px}` e `.month-toolbar-spacer{width:35px;height:35px}` — `index.html:69` |
| A4 | jarvis | ambos | `#jarvis-mic`, `#jarvis-send` | **40 × 40** | Microfone e enviar do Jarvis (critério 3) | `#jarvis-mic{width:40px;height:40px…}` — `index.html:818`; `#jarvis-send{width:40px;height:40px…}` — `index.html:824` |
| A5 | jarvis | ambos | `#jarvis-voice-toggle`, `#jarvis-key`, `#jarvis-close` (`.jarvis-hbtn`) | **30 × 30** | Botões do cabeçalho do painel; o fechar e o seletor de voz são acionados sempre | `.jarvis-hbtn{width:30px;height:30px…}` — `index.html:808` |
| A6 | todas sem diálogo modal | ambos | `#app-update` (fixo, canto inferior direito) | **34 × 34**, bottom 916 → só **6 px** acima da faixa do indicador (922; 13: 804 contra 810) | Alvo pequeno colado ao indicador de início; toque de borda vira gesto do sistema | `#app-update{…width:34px;height:34px…}` — `index.html:855`; posição `#app-ver{position:fixed;…bottom:calc(6px + env(safe-area-inset-bottom))}` — `index.html:853` |

Os botões do cabeçalho do app já atendem: `#seqTimerBtn`, `#parceiroBtn` e `#moreMenuBtn` medem 46 × 46
(`header-cleanup.js:20`). O `+ Nova tarefa` (148.8×54) e o `#jarvis-btn` (56×56) também atendem.

### MÉDIO

| # | Vista(s) | Perfil | Seletor | Medida | Por que é defeito | CSS atual (linha) |
|---|---|---|---|---|---|---|
| M1 | dia, lista, atrasadas, sequencia | ambos | `#viewContent input.check[data-action="toggle"]` | **23 × 23**, fora de `<label>` (`extras.tarefaAlvos.checkDentroDeLabel=false`) | Ação mais frequente do app; alvo de 23 px repetido em todo cartão (8 no Dia, 60 na Lista) | `.check{appearance:none;width:23px;height:23px…}` — `index.html:21`; coluna `.task-card{grid-template-columns:25px minmax(0,1fr) 32px}` — `index.html:21` |
| M1 | idem | ambos | `#viewContent button.task-reschedule` | **31 × 31** | Alvo < 44 em todo cartão | `.task-reschedule{…width:31px;height:31px…}` — `index.html:71` |
| M1 | idem | ambos | `#viewContent button.notas-toggle` (Detalhes / R$) | 49.8–143.5 × **24** | Altura < 44 | `.notas-toggle{…padding:4px 10px;…font-size:11px}` — `notas.js:60` |
| M1 | idem | ambos | `#viewContent button.agenda-share` (Compartilhar) | 98.6 × **21** | Altura < 44 | `.agenda-share{…padding:3px 7px;…font-size:10px}` — `agenda-sharing.js:40` |
| M1 | lista | ambos | `#viewContent button.tr-open` (Abrir treino / cardio) | 86.3–88.7 × **21** | Altura < 44 | `.tr-open{…padding:4px 11px…}` — `treino.js:402` |
| M2 | lista | ambos | `#viewContent button.list-previous[data-action="show-previous"]` | 118.5 × **14** | Link de texto com 14 px de altura | `.list-previous{…margin-top:5px;padding:0;…font-size:11px}` — `index.html:72` |
| M2 | lista, atrasadas | ambos | `#clearDone` (Limpar concluídas) | 116.5 × **24** | Altura < 44 | `.clear-done{padding:4px 0;…font-size:13px}` — `index.html:21` |
| M2 | lista | ambos | `button.list-more[data-action="load-more"]` | 188.8 × **38** | Altura < 44 | `.list-more{…padding:10px 18px…font-size:13px}` — `index.html:72` |
| M3 | mes, dia, lista, atrasadas | ambos | `#seqEntryBtn` (Modo sequencial) | 408 × **40** (13: 358 × 40) | Altura < 44 | `.seq-entry-btn{…padding:11px 14px…}` — `sequencial.js:21` |
| M4 | jarvis | ambos | `#jarvis-chips button.j-chip` (7 atalhos) | 82–116 × **31** | Altura < 44 | `.j-chip{flex:0 0 auto;…padding:7px 13px…}` — `index.html:846` |
| M4 | jarvis | ambos | `#jarvis-locbar` | 414 × **29** (13: 364 × 29) | Altura < 44 | estilo inline `padding:7px 16px;…font-size:11px` — `localizacao.js:676` |
| M5 | voz | ambos | `#voz-dialog button.vz-x` (fechar) | **30 × 30** | Fechar do seletor de voz | `#voz-dialog .vz-x{width:30px;height:30px…}` — `vozes-neurais.js:102` |
| M5 | voz | ambos | `#voz-dialog button.vz-ouvir` (Trocar) | 62.3 × **31** | Altura < 44 | `#voz-dialog .vz-ouvir{…padding:7px 11px…}` — `vozes-neurais.js:120` |
| M5 | voz | ambos | `#voz-dialog a[href*=piper]`, `a[href*=kokoro]` | 25 × **13**, 60.5 × **13** | Links de crédito com 13 px | `#voz-dialog .vz-cred a{…}` e `.vz-cred{font-size:10.5px…}` — `vozes-neurais.js:123-124` |
| M6 | nova-tarefa | ambos | `#closeTaskDialog`, `#taskForm button.primary` | 93.4 × **41**, 97.9 × **41** | Altura < 44 nos botões finais do formulário | `.secondary,.primary{padding:11px 15px;…font-size:14px}` — `index.html:21` |
| M6 | nova-tarefa | ambos | `#taskLembrete` (checkbox "Só um lembrete") | **18 × 18**; o `<label>` que o envolve mede 358 × **32** | Mesmo contando o rótulo, a altura fica em 32 | `.field-check input{width:18px;height:18px…}` e `.field-check{…margin-top:8px…}` — `index.html:74` |
| M7 | (diálogo Reagendar, fora das 9 vistas) | ambos | `#rescheduleDialog .reschedule-preset` | 104.7 × **38** (13: 98 × 38) | Altura < 44 | `.reschedule-preset{min-height:38px…}` — `index.html:73` |
| M8 | dia | ambos | `#viewContent input.day-pick-input` (escolher data sobre o título) | 96.2 × **36** | Alvo invisível menor que 44 | `.day-pick .day-pick-input{position:absolute;inset:0…}` (herda a altura do título) — `index.html:21` |
| M9 | menu | ambos | `#quickMenu #equipamentosBtn`, `#quickMenu #atualizarBtn` | linhas de 244 × 46 **sem texto visível** (`texto:""`; só o ícone; o rótulo existe só em `aria-label`) | Itens de menu sem rótulo, num menu em que todo o resto tem texto; captura `iphone17promax-menu.png` | Criados com só o SVG em `agenda-notas-rapidas.js:101-107`, inseridos em `:114` e `:120`; movidos para o menu por `header-cleanup.js:35`; estilizados por `.quick-menu a,.quick-menu button{display:flex;…min-height:45px}` — `index.html:67` |
| M10 | lista (rolada 400 px) | ambos | conteúdo de `main.app` sob a ilha | Rolando 400 px: **7** interativos com `top < 62` no 17PM (13: 3 sob 47); `barrasFixasCobrindoIlha: []`; no ponto (220, 31) o elemento é `main.app` (extras.rolado400) | Com a barra de status `black-translucent`, o conteúdo rola por baixo da ilha e do relógio sem nenhum fundo. Com rolagem 0 está correto. Decisão de design para a C1: fundo ou véu fixo de `env(safe-area-inset-top)` | `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">` — `index.html:8`; `.topbar{position:relative!important;top:auto!important…}` — `header-cleanup.js:17` |

### BAIXO

| # | Vista(s) | Perfil | Seletor | Medida | Por que é defeito | CSS atual (linha) |
|---|---|---|---|---|---|---|
| B1 | mes, dia, lista (rolagem 0) | ambos | `#agendaActions` (`#openDialog`, `#cardioFab`), `#jarvis-btn`, `#app-update` sobre o conteúdo | Mês com rolagem 0, medido pela interseção dos retângulos. No 17PM: `#openDialog` cobre os dias 15, 16, 17 (hoje), 22, 23 e 24; `#cardioFab` cobre o 17 (hoje); `#jarvis-btn` cobre 11 e 18; `#app-update` cobre o 24. No 13: `#openDialog` cobre 8, 9, 10, 15, 16 e 17 (hoje); `#cardioFab` cobre 3 e 10; `#jarvis-btn` cobre 4, 5, 11 e 12; `#app-update` cobre 16 e 17 (`extras.diasCobertosNoMes`). Ver capturas `*-mes.png` e `*-lista.png` | Botões flutuantes escondem conteúdo; dá para rolar (padding-bottom 180 + inset = 214 px), então é incômodo, não bloqueio | `.agenda-actions{position:fixed;…bottom:calc(46px + env(safe-area-inset-bottom))…}` e `.app{padding-bottom:calc(180px + env(safe-area-inset-bottom))}` — `index.html:70` |
| B2 | (Reagendar) | 17PM | `#rescheduleDialog`; `.reschedule-task-name` | 370 de largura (13: 350): **travado em 370**; nome da tarefa travado em **245** | Trava de largura: no 17PM o diálogo podia ter 400 | `#rescheduleDialog{width:min(calc(100% - 40px),370px)…}` e `.reschedule-task-name{…max-width:245px…}` — `index.html:73` |
| B3 | menu | ambos | `#quickMenu` | **260** fixo nos dois perfis (469 de altura) | Largura fixa; não acompanha a tela | `.quick-menu{…width:min(260px,calc(100vw - 32px))…}` — `index.html:66` |
| B4 | nova-tarefa, voz | ambos | `#taskDialog`, `#voz-dialog` | 402 (13: 352). O autor pede 408 / 416; a UA limita com `max-width: calc(100% - 38px)` (`extras.uaDialogMaxWidth`) | A margem lateral real é de 19 px, não a pretendida (16 / 12); o `420` do `#voz-dialog` nunca vale | `dialog{width:min(calc(100% - 32px),480px)…}` — `index.html:21`; `#voz-dialog{width:min(420px,calc(100vw - 24px))…}` — `vozes-neurais.js:97`; o limite vem da folha da UA para `dialog:modal` |
| B5 | mes | ambos | `.calendar-day`, `.calendar-tag` | Célula 52.6 × 91 (13: 46 × 78). Fonte da etiqueta **8.5 px** fixa (13: 8 px). As etiquetas continuam cortadas ("Acad…", "Trab…") | Os +6.6 px por célula do 17PM quase não viram texto: a fonte é px fixa e o corte é por reticências | `.calendar-tag{…font-size:8.5px…white-space:nowrap;text-overflow:ellipsis}` e `@media(max-width:390px){.calendar-day{min-height:78px;padding:4px 3px}.calendar-tag{font-size:8px}…}` — `index.html:21` |
| B6 | jarvis | 17PM | `#jarvis-panel` | 416 de largura (13: 366); o `max-width:420px` fica a **4 px** de travar; acima de 480 a largura cai para **400** | Trava latente: em 440 não atua, mas qualquer ajuste de margem faz valer o 420 | `#jarvis-panel{…left:max(12px,…);right:max(12px,…);…max-width:420px;max-height:72dvh…}` — `index.html:801`; `@media(min-width:480px){#jarvis-panel{…width:400px}}` — `index.html:859` |
| B7 | páginas auxiliares | 17PM | alvos < 44 px das auxiliares | Ver a tabela da seção e | Fora do critério 6 do plano, que só cobre rolagem lateral e cabeçalho, mas pesa no uso | Linhas na seção e |

---

## d. Onde a largura extra do 17 Pro Max está sendo desperdiçada

**Conclusão medida:**
- O **contêiner principal não está travado em 390**. `.app{width:min(100%,760px)}` (`index.html:21`) dá 440 no 17PM
  e 390 no 13, com área interna de 408 contra 358.
- A grade do calendário vai de 346 para 392 px. Cada célula vai de 46 para 52.6 px de largura (`extras.calendario`).
- O título cresce de 34.32 para 38.72 px: `h1{font-size:clamp(31px,8.8vw,43px)}` (`index.html:21`).
- O critério 4 do plano já está satisfeito no conteúdo principal. O desperdício está nos pontos abaixo.

**Travas de largura em px**, em pontos que poderiam crescer:

| Regra | Linha | 17PM | 13 | Observação |
|---|---|---|---|---|
| `#rescheduleDialog{width:min(calc(100% - 40px),370px)}` | `index.html:73` | 370 (travado) | 350 | Ver B2 |
| `.reschedule-task-name{max-width:245px}` | `index.html:73` | 245 | 245 | |
| `.quick-menu{width:min(260px,calc(100vw - 32px))}` | `index.html:66` | 260 | 260 | |
| `#jarvis-panel{max-width:420px}` | `index.html:801` | 416 | 366 | A 4 px de travar |
| `@media(min-width:480px){#jarvis-panel{width:400px}}` | `index.html:859` | — | — | Inativo em 440/390; encolhe o painel se o viewport for ≥ 480 |
| `#voz-dialog{width:min(420px,calc(100vw - 24px))}` | `vozes-neurais.js:97` | 402 | 352 | Limitado pela UA (`calc(100% - 38px)`), ver B4 |
| `dialog{width:min(calc(100% - 32px),480px)}` | `index.html:21` | 402 | 352 | Idem |
| `.head-actions{max-width:176px!important}` | `header-cleanup.js:19` | 150 usados | 150 | Sem efeito hoje (3 botões de 46 + 2 gaps de 6) |
| `.app{width:min(100%,760px)}` | `index.html:21` | 440 | 390 | OK, sem trava |

**Tamanhos em px fixos que não escalam com a largura:**
- Etiquetas do calendário: 8.5 px. Números dos dias: `.day-number{width:22px;height:22px;font-size:11px}`. Rótulos
  da semana: 10 px (`index.html:21`).
- Botões de navegação: 35 px (`index.html:21`, `index.html:69`).
- Colunas do cartão de tarefa: `25px … 32px` (`index.html:21`).
- No 17PM a coluna de texto do cartão vai a 299 px (13: 249), e só ela absorve os 50 px extras
  (`extras.tarefaAlvos.coluna`).

**Media queries com corte de largura:**

| Regra | Linha | Efeito nos perfis |
|---|---|---|
| `@media(max-width:390px){.calendar-day{min-height:78px;padding:4px 3px}.calendar-tag{font-size:8px}.month-grid-wrap{padding-left:5px;padding-right:5px}}` | `index.html:21` | O **iPhone 13 (390) entra** nesta regra compacta; o 17PM (440) não, e fica com células de 91 de altura. É o único corte que separa os dois aparelhos no app principal. |
| `@media(min-width:600px){.app{padding-left:22px;…}.fab{…}.calendar-day{min-height:110px}}` | `index.html:21` e `index.html:70` | Inativo nos dois |
| `@media(min-width:480px){#jarvis-panel{…}}` | `index.html:859` | Inativo nos dois |
| `@media (max-width: 760px){…}` | `header-cleanup.js:16` | Ativo nos dois |
| `@media(max-width:390px){.grid{grid-template-columns:1fr}…}` e `@media(max-width:390px){.sim-actions{width:100%;min-width:0}}` | `refaturamento.html:21` e `:23` | O 13 vê **1 coluna**; o 17PM vê **2 colunas**, com `.sim-actions{min-width:190px}` (`refaturamento.html:23`) |
| `@media(max-width:480px){.serie{font-size:24px}.grid2{grid-template-columns:1fr}…}` | `equipamentos-especiais.html:59` | Os dois perfis tratados como "celular pequeno" |
| `@media (max-width:380px)` | `fatura-inter.html:84` | Inativo nos dois |
| `@media(max-width:360px)` | `financeiro.html:2` | Inativo nos dois |

**Páginas auxiliares:** `max-width:760px` em financeiro, carteira, extrato-saldo, investimentos, fatura-inter e
refaturamento; `width:min(100%,620px)` em gamificação. Nenhuma trava em 440: a `larguraConteudo` medida é 440 em
todas essas. As exceções:
- equipamentos-especiais: `div.stage` com 408 (`.stage{width:100%;max-width:640px…}`, `equipamentos-especiais.html:18`).
- marketplace: `#cofre` com 420. É o cartão de senha, `#cofre{…max-width:420px…}` em `marketplace/index.html:91`.

---

## e. Páginas auxiliares alcançáveis a partir do app (perfil 17 Pro Max)

Levantamento por leitura do código, buscando `href`, `location.href`, `location.replace` e `window.open` no
`index.html`, nos 21 scripts que ele carrega e, recursivamente, nas páginas encontradas.

**Nível 1** = sai direto do app. **Nível 2 e 3** = a partir de outra auxiliar.

**Colunas da tabela:**
- **Conteúdo do cabeçalho (top):** topo do primeiro texto ou controle do cabeçalho.
- **Sob a ilha?:** compara esse topo com 62.

| Página | Nível | Origem do link (arquivo:linha) | scrollWidth / 440 | Cabeçalho (seletor) | Conteúdo do cabeçalho (top) | Sob a ilha? | Interativos sob ilha / fixos sob indicador | Alvos < 44 px (principais) e CSS | Captura |
|---|---|---|---|---|---|---|---|---|---|
| `financeiro.html` | 1 | `index.html:99`: menu `<a href="financeiro.html">` | 440 | `header.head` 80–149 | 80 | **não** | 0 / 0 | `div.filters > button` × 6: 63–113 × **35** (`.filters button{padding:9px 11px}`, `financeiro.html:2`); `#conedit` 65.9 × **26**, `#ivedit`, `#prevedit` (`.sa-foot button{padding:6px 13px}`, `financeiro.html:2`) | `aux-financeiro.png` |
| `marketplace/` (`marketplace/index.html`) | 1 | `index.html:99`: menu `<a href="./marketplace/">` | 440 | `header.in` 0–154.1 (o padding reserva a área segura) | 80 | **não** | 0 / 0 | `#cofreLembrar` checkbox **13 × 13** (`marketplace/index.html:107`, sem CSS de tamanho). Atrás da senha, só a tela de senha foi medida | `aux-marketplace.png` |
| `gamificacao.html` | 1 | `index.html:99`: menu `<a id="painelBtn" href="./gamificacao.html">` | 440 | `#gamePage header.head` 80–150 | 80 | **não** | 0 / 0 | nenhum | `aux-gamificacao.png` |
| `equipamentos-especiais.html` | 1 | `agenda-notas-rapidas.js:25` (`EQUIP_URL`) + `:121` `window.open(EQUIP_URL,'_blank','noopener')`, pelo item `#equipamentosBtn` do menu | 440 | `h1` 136–186 (o seletor Agenda / Equipamentos fica acima, em 76) | 136 (seletor em 76) | **não** | 0 / 0 | `.appswitch a` 197 × **36** (`equipamentos-especiais.html:253`); `.quickbar button` 132 × **41** (`:257`); `#cidadeFiltro` 408 × 38; `button.prim` / `.toolbar button` 200 × 34; `#app-update` 34 × 34 | `aux-equipamentos-especiais.png` |
| `treino.html?date=…` | 1 | `treino.js:917` e `:926`: `location.href='./treino.html?date='…`, ao tocar em "Abrir treino" (`.tr-open`) ou no título de um cartão de treino da agenda | 440 | `#treinoPage div.tr-head` 0–164 (padding `calc(18px + env(safe-area-inset-top))`, `treino.js:472`) | 76 | **não** | 0 / 0 | `.tr-preset` 43 × **23** (`treino.js:423`); `.tr-tbtn` `#trToggle` / `#trReset` **42 × 42** (`treino.js:426`); `#trHome` 94 × **36** (`.tr-home{min-height:36px}`, `treino.js:412`); campos de carga e repetições 160 × **42** | `aux-treino.png` |
| `carteira.html` | 2 | `financeiro.html:2`: `href="./carteira.html"` | 440 | `header.head` 80–151 | 80 | **não** | 0 / 0 | nenhum | `aux-carteira.png` |
| `extrato-saldo.html?mes=…` | 2 | `financeiro.html:13`: `location.href='extrato-saldo.html?mes='…` | 440 | `header.head` 80–149 | 80 | **não** | 0 / 0 | nenhum | `aux-extrato-saldo.png` |
| `investimentos.html` | 2 | `financeiro.html:18`: `location.href='investimentos.html'` (`#prevedit`) | 440 | `header.head` 80–151 | 80 | **não** | 0 / 0 | `button.editbtn` 65.9 × **28** (`.editbtn{padding:7px 13px}`, `investimentos.html:33`); `#saveMetas` 374 × **43** | `aux-investimentos.png` |
| `fatura-inter.html?fatura=…` | 2 | `finance-cycle.js:490` (script do financeiro): `location.href=\`fatura-inter.html?fatura=…\`` | 440 | `header.head` 80–145 | 80 | **não** | 0 / 0 | `.tabs button` 197 × **37** (`.tabs button{padding:10px 8px}`, `fatura-inter.html:16`) | `aux-fatura-inter.png` |
| `refaturamento.html` | 2 | `finance-sharing.js:35` (script do financeiro): `href='./refaturamento.html'` | 440 | `header.head` 80–149.8 | 80 | **não** | 0 / 0 | `.sim-toggle` 190 × **42** (`min-height:42px`, `refaturamento.html:15`) | `aux-refaturamento.png` |
| `financeiro-compartilhado.html` | 2 | `finance-sharing.js:23`: `location.replace('./financeiro-compartilhado.html')`, só para usuário com acesso compartilhado | 440 | (redirecionou) | — | — | — | Com o usuário de teste, a página voltou para `financeiro.html` (`financeiro-compartilhado.js:54`, `location.replace('./financeiro.html')`). A medição e a captura são do financeiro; o layout próprio dela **não foi medido** | `aux-financeiro-compartilhado.png` |
| `importar.html` | 3 | `carteira.html:27`: `href="./importar.html"` | 440 | `header.head` 80–148 | 80 | **não** | 0 / 0 | nenhum (`#launch` fixo 408 × 50, bottom 906) | `aux-importar.png` |

**Fora da lista (não alcançáveis pelo app):**
- `adicionar.html`: só redireciona para `./?v=14`, em `adicionar.html:52`.
- `v9.html`: redireciona para `./?v=10`, em `v9.html:8`.
- `treino-ana.html`: nenhum link do app ou das auxiliares aponta para ela; ela só tem `href="./"`, em
  `treino-ana.html:56`.

**Como foram abertas:**
- Todas as auxiliares abriram com `viewport-fit=cover`; o valor fica em `viewportMeta` no JSON.
- Nenhuma tem rolagem lateral nem cabeçalho sob a ilha no 17 Pro Max.
- O `treino.html` foi aberto **a partir do app**. A página só desenha com uma tarefa `treino-<data>` criada pelo
  `treino.js` no app (`treino.js:752-757`). A data usada foi 2026-10-19.

---

## f. JSON bruto de todas as medições

O bloco abaixo junta tudo num objeto só:
- `medicoes`: saída de `rodar-auditoria.cjs`, com a prova da área segura, as 18 vistas e as 12 auxiliares;
- `extras`: saída de `extras-auditoria.cjs`.

As listas `interativosSob*` trazem `{seletor, top, bottom}`, mais `texto` e `fixo`. `alvosPequenos` traz
`{seletor, w, h}`, mais `n` (quantos elementos iguais) e `texto`.

```json
{
 "medicoes": {
  "quando": "2026-10-17T08:41:38.680Z",
  "chromium": "141.0.7390.37",
  "perfis": {
   "iphone17promax": {
    "nome": "iphone17promax",
    "width": 440,
    "height": 956,
    "dpr": 3,
    "insets": {
     "top": 62,
     "bottom": 34,
     "left": 0,
     "right": 0
    }
   },
   "iphone13": {
    "nome": "iphone13",
    "width": 390,
    "height": 844,
    "dpr": 3,
    "insets": {
     "top": 47,
     "bottom": 34,
     "left": 0,
     "right": 0
    }
   }
  },
  "provaAreaSegura": [
   {
    "perfil": "iphone17promax",
    "metodo": "nenhum",
    "envMedido": {
     "top": 0,
     "right": 0,
     "bottom": 0,
     "left": 0
    },
    "confere": false,
    "paddingTopApp": 18,
    "jarvisBtnBottomGap": 12
   },
   {
    "perfil": "iphone17promax",
    "metodo": "cdp",
    "envMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "confere": true,
    "paddingTopApp": 80,
    "jarvisBtnBottomGap": 46
   },
   {
    "perfil": "iphone17promax",
    "metodo": "route",
    "envMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "confere": true,
    "paddingTopApp": 80,
    "jarvisBtnBottomGap": 46
   },
   {
    "perfil": "iphone13",
    "metodo": "nenhum",
    "envMedido": {
     "top": 0,
     "right": 0,
     "bottom": 0,
     "left": 0
    },
    "confere": false,
    "paddingTopApp": 18,
    "jarvisBtnBottomGap": 12
   },
   {
    "perfil": "iphone13",
    "metodo": "cdp",
    "envMedido": {
     "top": 47,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "confere": true,
    "paddingTopApp": 65,
    "jarvisBtnBottomGap": 46
   },
   {
    "perfil": "iphone13",
    "metodo": "route",
    "envMedido": {
     "top": 47,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "confere": true,
    "paddingTopApp": 65,
    "jarvisBtnBottomGap": 46
   }
  ],
  "vistas": [
   {
    "vista": "mes",
    "perfil": "iphone17promax",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-18",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-19",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-20",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-21",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-22",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-23",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-24",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"day\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Dia"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"month\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Mês"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"list\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Lista"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"sequencia\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Sequência"
     },
     {
      "seletor": "#seqEntryBtn",
      "w": 408,
      "h": 40,
      "n": 1,
      "texto": "Modo sequencial"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"all\"]",
      "w": 66.7,
      "h": 34,
      "n": 1,
      "texto": "Todas"
     },
     {
      "seletor": "#filters button.chip.chip-late[data-filter=\"late\"]",
      "w": 92.6,
      "h": 34,
      "n": 1,
      "texto": "Atrasadas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"done\"]",
      "w": 99.5,
      "h": 34,
      "n": 1,
      "texto": "Concluídas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"work\"]",
      "w": 84.1,
      "h": 34,
      "n": 1,
      "texto": "Trabalho"
     },
     {
      "seletor": "#calFullBtn",
      "w": 35,
      "h": 35,
      "n": 1,
      "texto": "Calendário em tela cheia"
     },
     {
      "seletor": "#app-update",
      "w": 34,
      "h": 34,
      "n": 1,
      "texto": "Atualizar o app"
     }
    ],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": 52.6,
    "celulaCalendarioAltura": 91,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 82,
     "bottom": 165.2,
     "conteudoTop": 82,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#openDialog",
      "left": 277.3,
      "right": 426,
      "top": 822,
      "bottom": 876,
      "w": 148.8,
      "h": 54
     },
     {
      "seletor": "#jarvis-btn",
      "left": 18,
      "right": 74,
      "top": 854,
      "bottom": 910,
      "w": 56,
      "h": 56
     },
     {
      "seletor": "#cardioFab",
      "left": 378,
      "right": 426,
      "top": 765,
      "bottom": 813,
      "w": 48,
      "h": 48
     },
     {
      "seletor": "#app-update",
      "left": 364.3,
      "right": 398.3,
      "top": 882,
      "bottom": 916,
      "w": 34,
      "h": 34
     }
    ],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 59
   },
   {
    "vista": "dia",
    "perfil": "iphone17promax",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#viewContent button.task-edit-btn.agenda-edit",
      "top": 923,
      "bottom": 1024.3,
      "texto": "Editar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-trash[data-action=\"delete\"]",
      "top": 923,
      "bottom": 1024.3,
      "texto": "Apagar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent input.check[data-action=\"toggle\"]",
      "top": 935,
      "bottom": 958,
      "texto": "Concluir tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-reschedule[data-action=\"reschedule\"]",
      "top": 935,
      "bottom": 966,
      "texto": "Reagendar tarefa",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"day\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Dia"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"month\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Mês"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"list\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Lista"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"sequencia\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Sequência"
     },
     {
      "seletor": "#seqEntryBtn",
      "w": 408,
      "h": 40,
      "n": 1,
      "texto": "Modo sequencial"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"all\"]",
      "w": 66.7,
      "h": 34,
      "n": 1,
      "texto": "Todas"
     },
     {
      "seletor": "#filters button.chip.chip-late[data-filter=\"late\"]",
      "w": 92.6,
      "h": 34,
      "n": 1,
      "texto": "Atrasadas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"done\"]",
      "w": 99.5,
      "h": 34,
      "n": 1,
      "texto": "Concluídas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"work\"]",
      "w": 84.1,
      "h": 34,
      "n": 1,
      "texto": "Trabalho"
     },
     {
      "seletor": "#viewContent button.nav-btn",
      "w": 35,
      "h": 35,
      "n": 2,
      "texto": "Dia anterior"
     },
     {
      "seletor": "#viewContent input.day-pick-input",
      "w": 96.2,
      "h": 36,
      "n": 1,
      "texto": "Escolher data"
     },
     {
      "seletor": "#viewContent input.check[data-action=\"toggle\"]",
      "w": 23,
      "h": 23,
      "n": 8,
      "texto": "Concluir tarefa"
     },
     {
      "seletor": "#viewContent button.notas-toggle",
      "w": 93.3,
      "h": 24,
      "n": 8,
      "texto": "Detalhes"
     },
     {
      "seletor": "#viewContent button.agenda-share",
      "w": 98.6,
      "h": 21,
      "n": 8,
      "texto": "Compartilhar tarefa"
     },
     {
      "seletor": "#viewContent button.task-reschedule[data-action=\"reschedule\"]",
      "w": 31,
      "h": 31,
      "n": 8,
      "texto": "Reagendar tarefa"
     },
     {
      "seletor": "#app-update",
      "w": 34,
      "h": 34,
      "n": 1,
      "texto": "Atualizar o app"
     }
    ],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 82,
     "bottom": 165.2,
     "conteudoTop": 82,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#openDialog",
      "left": 277.3,
      "right": 426,
      "top": 822,
      "bottom": 876,
      "w": 148.8,
      "h": 54
     },
     {
      "seletor": "#jarvis-btn",
      "left": 18,
      "right": 74,
      "top": 854,
      "bottom": 910,
      "w": 56,
      "h": 56
     },
     {
      "seletor": "#cardioFab",
      "left": 378,
      "right": 426,
      "top": 765,
      "bottom": 813,
      "w": 48,
      "h": 48
     },
     {
      "seletor": "#app-update",
      "left": 364.3,
      "right": 398.3,
      "top": 882,
      "bottom": 916,
      "w": 34,
      "h": 34
     }
    ],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 67
   },
   {
    "vista": "lista",
    "perfil": "iphone17promax",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#viewContent button.task-edit-btn.agenda-edit",
      "top": 817.1,
      "bottom": 957,
      "texto": "Editar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-trash[data-action=\"delete\"]",
      "top": 817.1,
      "bottom": 957,
      "texto": "Apagar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.agenda-share",
      "top": 924,
      "bottom": 945,
      "texto": "Compartilhar tarefa",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"day\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Dia"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"month\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Mês"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"list\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Lista"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"sequencia\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Sequência"
     },
     {
      "seletor": "#seqEntryBtn",
      "w": 408,
      "h": 40,
      "n": 1,
      "texto": "Modo sequencial"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"all\"]",
      "w": 66.7,
      "h": 34,
      "n": 1,
      "texto": "Todas"
     },
     {
      "seletor": "#filters button.chip.chip-late[data-filter=\"late\"]",
      "w": 92.6,
      "h": 34,
      "n": 1,
      "texto": "Atrasadas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"done\"]",
      "w": 99.5,
      "h": 34,
      "n": 1,
      "texto": "Concluídas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"work\"]",
      "w": 84.1,
      "h": 34,
      "n": 1,
      "texto": "Trabalho"
     },
     {
      "seletor": "#viewContent button.list-previous[data-action=\"show-previous\"]",
      "w": 118.5,
      "h": 14,
      "n": 1,
      "texto": "Ver tarefas anteriores"
     },
     {
      "seletor": "#clearDone",
      "w": 116.5,
      "h": 24,
      "n": 1,
      "texto": "Limpar concluídas"
     },
     {
      "seletor": "#viewContent input.check[data-action=\"toggle\"]",
      "w": 23,
      "h": 23,
      "n": 60,
      "texto": "Concluir tarefa"
     },
     {
      "seletor": "#viewContent button.notas-toggle",
      "w": 93.3,
      "h": 24,
      "n": 52,
      "texto": "Detalhes"
     },
     {
      "seletor": "#viewContent button.agenda-share",
      "w": 98.6,
      "h": 21,
      "n": 60,
      "texto": "Compartilhar tarefa"
     },
     {
      "seletor": "#viewContent button.task-reschedule[data-action=\"reschedule\"]",
      "w": 31,
      "h": 31,
      "n": 60,
      "texto": "Reagendar tarefa"
     },
     {
      "seletor": "#viewContent button.tr-open",
      "w": 88.7,
      "h": 21,
      "n": 9,
      "texto": "Abrir cardio"
     },
     {
      "seletor": "#viewContent button.tr-open",
      "w": 86.3,
      "h": 21,
      "n": 8,
      "texto": "Abrir treino"
     },
     {
      "seletor": "#viewContent button.list-previous.list-more[data-action=\"load-more\"]",
      "w": 188.8,
      "h": 38,
      "n": 1,
      "texto": "Mostrar mais 60 de 277"
     },
     {
      "seletor": "#app-update",
      "w": 34,
      "h": 34,
      "n": 1,
      "texto": "Atualizar o app"
     }
    ],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 82,
     "bottom": 165.2,
     "conteudoTop": 82,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#openDialog",
      "left": 277.3,
      "right": 426,
      "top": 822,
      "bottom": 876,
      "w": 148.8,
      "h": 54
     },
     {
      "seletor": "#jarvis-btn",
      "left": 18,
      "right": 74,
      "top": 854,
      "bottom": 910,
      "w": 56,
      "h": 56
     },
     {
      "seletor": "#cardioFab",
      "left": 378,
      "right": 426,
      "top": 765,
      "bottom": 813,
      "w": 48,
      "h": 48
     },
     {
      "seletor": "#app-update",
      "left": 364.3,
      "right": 398.3,
      "top": 882,
      "bottom": 916,
      "w": 34,
      "h": 34
     }
    ],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 388
   },
   {
    "vista": "atrasadas",
    "perfil": "iphone17promax",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#viewContent button.task-edit-btn.agenda-edit",
      "top": 860.1,
      "bottom": 961.4,
      "texto": "Editar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-trash[data-action=\"delete\"]",
      "top": 860.1,
      "bottom": 961.4,
      "texto": "Apagar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.agenda-share",
      "top": 928.4,
      "bottom": 949.4,
      "texto": "Compartilhar tarefa",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"day\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Dia"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"month\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Mês"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"list\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Lista"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"sequencia\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Sequência"
     },
     {
      "seletor": "#seqEntryBtn",
      "w": 408,
      "h": 40,
      "n": 1,
      "texto": "Modo sequencial"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"all\"]",
      "w": 66.7,
      "h": 34,
      "n": 1,
      "texto": "Todas"
     },
     {
      "seletor": "#filters button.chip.chip-late[data-filter=\"late\"]",
      "w": 92.6,
      "h": 34,
      "n": 1,
      "texto": "Atrasadas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"done\"]",
      "w": 99.5,
      "h": 34,
      "n": 1,
      "texto": "Concluídas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"work\"]",
      "w": 84.1,
      "h": 34,
      "n": 1,
      "texto": "Trabalho"
     },
     {
      "seletor": "#clearDone",
      "w": 116.5,
      "h": 24,
      "n": 1,
      "texto": "Limpar concluídas"
     },
     {
      "seletor": "#viewContent input.check[data-action=\"toggle\"]",
      "w": 23,
      "h": 23,
      "n": 24,
      "texto": "Concluir tarefa"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 76.9,
      "h": 24,
      "n": 1,
      "texto": "R$ 80"
     },
     {
      "seletor": "#viewContent button.agenda-share",
      "w": 98.6,
      "h": 21,
      "n": 24,
      "texto": "Compartilhar tarefa"
     },
     {
      "seletor": "#viewContent button.task-reschedule[data-action=\"reschedule\"]",
      "w": 31,
      "h": 31,
      "n": 24,
      "texto": "Reagendar tarefa"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 64.2,
      "h": 24,
      "n": 2,
      "texto": "0/5"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 49.8,
      "h": 24,
      "n": 5,
      "texto": "•"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 59,
      "h": 24,
      "n": 1,
      "texto": "2h"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 108.5,
      "h": 24,
      "n": 1,
      "texto": "condicional"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 64,
      "h": 24,
      "n": 3,
      "texto": "0/2"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 64.6,
      "h": 24,
      "n": 1,
      "texto": "0/4"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 92.1,
      "h": 24,
      "n": 1,
      "texto": "R$ 4800"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 81.6,
      "h": 24,
      "n": 1,
      "texto": "R$ 150"
     },
     {
      "seletor": "#viewContent button.notas-toggle",
      "w": 93.3,
      "h": 24,
      "n": 7,
      "texto": "Detalhes"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 143.5,
      "h": 24,
      "n": 1,
      "texto": "R$ 350 · 5/10 parc"
     },
     {
      "seletor": "#app-update",
      "w": 34,
      "h": 34,
      "n": 1,
      "texto": "Atualizar o app"
     }
    ],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 82,
     "bottom": 165.2,
     "conteudoTop": 82,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#openDialog",
      "left": 277.3,
      "right": 426,
      "top": 822,
      "bottom": 876,
      "w": 148.8,
      "h": 54
     },
     {
      "seletor": "#jarvis-btn",
      "left": 18,
      "right": 74,
      "top": 854,
      "bottom": 910,
      "w": 56,
      "h": 56
     },
     {
      "seletor": "#cardioFab",
      "left": 378,
      "right": 426,
      "top": 765,
      "bottom": 813,
      "w": 48,
      "h": 48
     },
     {
      "seletor": "#app-update",
      "left": 364.3,
      "right": 398.3,
      "top": 882,
      "bottom": 916,
      "w": 34,
      "h": 34
     }
    ],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 161
   },
   {
    "vista": "sequencia",
    "perfil": "iphone17promax",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#viewContent button.task-edit-btn.agenda-edit",
      "top": 810.1,
      "bottom": 954,
      "texto": "Editar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-trash[data-action=\"delete\"]",
      "top": 810.1,
      "bottom": 954,
      "texto": "Apagar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.agenda-share",
      "top": 920,
      "bottom": 941,
      "texto": "Compartilhar tarefa",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"day\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Dia"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"month\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Mês"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"list\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Lista"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"sequencia\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Sequência"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"all\"]",
      "w": 66.7,
      "h": 34,
      "n": 1,
      "texto": "Todas"
     },
     {
      "seletor": "#filters button.chip.chip-late[data-filter=\"late\"]",
      "w": 92.6,
      "h": 34,
      "n": 1,
      "texto": "Atrasadas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"done\"]",
      "w": 99.5,
      "h": 34,
      "n": 1,
      "texto": "Concluídas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"work\"]",
      "w": 84.1,
      "h": 34,
      "n": 1,
      "texto": "Trabalho"
     },
     {
      "seletor": "#viewContent input.check[data-action=\"toggle\"]",
      "w": 23,
      "h": 23,
      "n": 8,
      "texto": "Concluir tarefa"
     },
     {
      "seletor": "#viewContent button.notas-toggle",
      "w": 93.3,
      "h": 24,
      "n": 8,
      "texto": "Detalhes"
     },
     {
      "seletor": "#viewContent button.agenda-share",
      "w": 98.6,
      "h": 21,
      "n": 8,
      "texto": "Compartilhar tarefa"
     },
     {
      "seletor": "#viewContent button.task-reschedule[data-action=\"reschedule\"]",
      "w": 31,
      "h": 31,
      "n": 8,
      "texto": "Reagendar tarefa"
     },
     {
      "seletor": "#app-update",
      "w": 34,
      "h": 34,
      "n": 1,
      "texto": "Atualizar o app"
     }
    ],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 82,
     "bottom": 165.2,
     "conteudoTop": 82,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#openDialog",
      "left": 277.3,
      "right": 426,
      "top": 822,
      "bottom": 876,
      "w": 148.8,
      "h": 54
     },
     {
      "seletor": "#jarvis-btn",
      "left": 18,
      "right": 74,
      "top": 854,
      "bottom": 910,
      "w": 56,
      "h": 56
     },
     {
      "seletor": "#cardioFab",
      "left": 378,
      "right": 426,
      "top": 765,
      "bottom": 813,
      "w": 48,
      "h": 48
     },
     {
      "seletor": "#app-update",
      "left": 364.3,
      "right": 398.3,
      "top": 882,
      "bottom": 916,
      "w": 34,
      "h": 34
     }
    ],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 63
   },
   {
    "vista": "menu",
    "perfil": "iphone17promax",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-18",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-19",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-20",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-21",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-22",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-23",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-24",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"day\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Dia"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"month\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Mês"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"list\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Lista"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"sequencia\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Sequência"
     },
     {
      "seletor": "#seqEntryBtn",
      "w": 408,
      "h": 40,
      "n": 1,
      "texto": "Modo sequencial"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"all\"]",
      "w": 66.7,
      "h": 34,
      "n": 1,
      "texto": "Todas"
     },
     {
      "seletor": "#filters button.chip.chip-late[data-filter=\"late\"]",
      "w": 92.6,
      "h": 34,
      "n": 1,
      "texto": "Atrasadas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"done\"]",
      "w": 99.5,
      "h": 34,
      "n": 1,
      "texto": "Concluídas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"work\"]",
      "w": 84.1,
      "h": 34,
      "n": 1,
      "texto": "Trabalho"
     },
     {
      "seletor": "#calFullBtn",
      "w": 35,
      "h": 35,
      "n": 1,
      "texto": "Calendário em tela cheia"
     },
     {
      "seletor": "#app-update",
      "w": 34,
      "h": 34,
      "n": 1,
      "texto": "Atualizar o app"
     }
    ],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": 52.6,
    "celulaCalendarioAltura": 91,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 82,
     "bottom": 165.2,
     "conteudoTop": 82,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#openDialog",
      "left": 277.3,
      "right": 426,
      "top": 822,
      "bottom": 876,
      "w": 148.8,
      "h": 54
     },
     {
      "seletor": "#jarvis-btn",
      "left": 18,
      "right": 74,
      "top": 854,
      "bottom": 910,
      "w": 56,
      "h": 56
     },
     {
      "seletor": "#cardioFab",
      "left": 378,
      "right": 426,
      "top": 765,
      "bottom": 813,
      "w": 48,
      "h": 48
     },
     {
      "seletor": "#app-update",
      "left": 364.3,
      "right": 398.3,
      "top": 882,
      "bottom": 916,
      "w": 34,
      "h": 34
     }
    ],
    "sobreposicao": {
     "seletor": "#quickMenu",
     "left": 164,
     "right": 424,
     "top": 136,
     "bottom": 605,
     "w": 260,
     "h": 469,
     "dentroDaAreaSegura": true
    },
    "transbordando": [],
    "totalInterativosVisiveis": 68
   },
   {
    "vista": "nova-tarefa",
    "perfil": "iphone17promax",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [],
    "alvosPequenos": [
     {
      "seletor": "#taskLembrete",
      "w": 18,
      "h": 18,
      "n": 1,
      "texto": "on"
     },
     {
      "seletor": "#closeTaskDialog",
      "w": 93.4,
      "h": 41,
      "n": 1,
      "texto": "Cancelar"
     },
     {
      "seletor": "#taskForm button.primary",
      "w": 97.9,
      "h": 41,
      "n": 1,
      "texto": "Adicionar"
     }
    ],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": 52.6,
    "celulaCalendarioAltura": 91,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 82,
     "bottom": 165.2,
     "conteudoTop": 82,
     "sobIlha": false
    },
    "flutuantes": [],
    "sobreposicao": {
     "seletor": "#taskDialog",
     "left": 19,
     "right": 421,
     "top": 191.6,
     "bottom": 764.4,
     "w": 402,
     "h": 572.8,
     "dentroDaAreaSegura": true
    },
    "transbordando": [],
    "totalInterativosVisiveis": 9
   },
   {
    "vista": "jarvis",
    "perfil": "iphone17promax",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-18",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-19",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-20",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-21",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-22",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-23",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 861.2,
      "bottom": 952.2,
      "texto": "Abrir 2026-10-24",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"day\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Dia"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"month\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Mês"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"list\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Lista"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"sequencia\"]",
      "w": 96.5,
      "h": 37,
      "n": 1,
      "texto": "Sequência"
     },
     {
      "seletor": "#seqEntryBtn",
      "w": 408,
      "h": 40,
      "n": 1,
      "texto": "Modo sequencial"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"all\"]",
      "w": 66.7,
      "h": 34,
      "n": 1,
      "texto": "Todas"
     },
     {
      "seletor": "#filters button.chip.chip-late[data-filter=\"late\"]",
      "w": 92.6,
      "h": 34,
      "n": 1,
      "texto": "Atrasadas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"done\"]",
      "w": 99.5,
      "h": 34,
      "n": 1,
      "texto": "Concluídas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"work\"]",
      "w": 84.1,
      "h": 34,
      "n": 1,
      "texto": "Trabalho"
     },
     {
      "seletor": "#calFullBtn",
      "w": 35,
      "h": 35,
      "n": 1,
      "texto": "Calendário em tela cheia"
     },
     {
      "seletor": "#app-update",
      "w": 34,
      "h": 34,
      "n": 1,
      "texto": "Atualizar o app"
     },
     {
      "seletor": "#jarvis-voice-toggle",
      "w": 30,
      "h": 30,
      "n": 1,
      "texto": "Alternar voz"
     },
     {
      "seletor": "#jarvis-key",
      "w": 30,
      "h": 30,
      "n": 1,
      "texto": "Escolher a voz do Jarvis"
     },
     {
      "seletor": "#jarvis-close",
      "w": 30,
      "h": 30,
      "n": 1,
      "texto": "Fechar"
     },
     {
      "seletor": "#jarvis-locbar",
      "w": 414,
      "h": 29,
      "n": 1,
      "texto": "Ligar ou desligar a localização"
     },
     {
      "seletor": "#jarvis-chips button.j-chip[data-p=\"Me dê um briefing …\"]",
      "w": 95.4,
      "h": 31,
      "n": 1,
      "texto": "Meu dia"
     },
     {
      "seletor": "#jarvis-chips button.j-chip[data-p=\"Escreva uma mensag…\"]",
      "w": 92.8,
      "h": 31,
      "n": 1,
      "texto": "Receita"
     },
     {
      "seletor": "#jarvis-chips button.j-chip[data-p=\"Onde estou agora, …\"]",
      "w": 116.3,
      "h": 31,
      "n": 1,
      "texto": "Onde estou"
     },
     {
      "seletor": "#jarvis-chips button.j-chip[data-p=\"Resumo da minha se…\"]",
      "w": 96.4,
      "h": 31,
      "n": 1,
      "texto": "Semana"
     },
     {
      "seletor": "#jarvis-chips button.j-chip[data-p=\"Analise minhas tar…\"]",
      "w": 106.8,
      "h": 31,
      "n": 1,
      "texto": "Organizar"
     },
     {
      "seletor": "#jarvis-chips button.j-chip[data-p=\"Como está o clima …\"]",
      "w": 82.3,
      "h": 31,
      "n": 1,
      "texto": "Clima"
     },
     {
      "seletor": "#jarvis-chips button.j-chip[data-p=\"Me dê as principai…\"]",
      "w": 97.2,
      "h": 31,
      "n": 1,
      "texto": "Notícias"
     },
     {
      "seletor": "#jarvis-mic",
      "w": 40,
      "h": 40,
      "n": 1,
      "texto": "Falar"
     },
     {
      "seletor": "#jarvis-input",
      "w": 294,
      "h": 42.4,
      "n": 1,
      "texto": ""
     },
     {
      "seletor": "#jarvis-send",
      "w": 40,
      "h": 40,
      "n": 1,
      "texto": "Enviar"
     }
    ],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": 52.6,
    "celulaCalendarioAltura": 91,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 82,
     "bottom": 165.2,
     "conteudoTop": 82,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#openDialog",
      "left": 277.3,
      "right": 426,
      "top": 822,
      "bottom": 876,
      "w": 148.8,
      "h": 54
     },
     {
      "seletor": "#jarvis-btn",
      "left": 18,
      "right": 74,
      "top": 854,
      "bottom": 910,
      "w": 56,
      "h": 56
     },
     {
      "seletor": "#cardioFab",
      "left": 378,
      "right": 426,
      "top": 765,
      "bottom": 813,
      "w": 48,
      "h": 48
     },
     {
      "seletor": "#app-update",
      "left": 364.3,
      "right": 398.3,
      "top": 882,
      "bottom": 916,
      "w": 34,
      "h": 34
     },
     {
      "seletor": "#jarvis-locbar",
      "left": 13,
      "right": 427,
      "top": 448.5,
      "bottom": 477.5,
      "w": 414,
      "h": 29
     }
    ],
    "sobreposicao": {
     "seletor": "#jarvis-panel",
     "left": 12,
     "right": 428,
     "top": 378.5,
     "bottom": 832,
     "w": 416,
     "h": 453.5,
     "dentroDaAreaSegura": true
    },
    "transbordando": [],
    "totalInterativosVisiveis": 73
   },
   {
    "vista": "voz",
    "perfil": "iphone17promax",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [],
    "alvosPequenos": [
     {
      "seletor": "#voz-dialog button.vz-x",
      "w": 30,
      "h": 30,
      "n": 1,
      "texto": "Fechar"
     },
     {
      "seletor": "#voz-dialog button.vz-ouvir",
      "w": 62.3,
      "h": 31,
      "n": 1,
      "texto": "Trocar"
     },
     {
      "seletor": "#voz-dialog a[href=\"https://github.com/rhasspy/piper\"]",
      "w": 25,
      "h": 13,
      "n": 1,
      "texto": "Piper"
     },
     {
      "seletor": "#voz-dialog a[href=\"https://github.com/hexgrad/kokoro\"]",
      "w": 60.5,
      "h": 13,
      "n": 1,
      "texto": "Kokoro-82M"
     }
    ],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": 52.6,
    "celulaCalendarioAltura": 91,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 82,
     "bottom": 165.2,
     "conteudoTop": 82,
     "sobIlha": false
    },
    "flutuantes": [],
    "sobreposicao": {
     "seletor": "#voz-dialog",
     "left": 19,
     "right": 421,
     "top": 123.7,
     "bottom": 832.3,
     "w": 402,
     "h": 708.7,
     "dentroDaAreaSegura": true
    },
    "transbordando": [],
    "totalInterativosVisiveis": 4
   },
   {
    "vista": "mes",
    "perfil": "iphone13",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 47,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 390,
    "viewportW": 390,
    "viewportH": 844,
    "scrollWidthBody": 390,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-11",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-12",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-13",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-14",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-15",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-16",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-17",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-18",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-19",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-20",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-21",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-22",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-23",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-24",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"day\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Dia"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"month\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Mês"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"list\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Lista"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"sequencia\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Sequência"
     },
     {
      "seletor": "#seqEntryBtn",
      "w": 358,
      "h": 40,
      "n": 1,
      "texto": "Modo sequencial"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"all\"]",
      "w": 66.7,
      "h": 34,
      "n": 1,
      "texto": "Todas"
     },
     {
      "seletor": "#filters button.chip.chip-late[data-filter=\"late\"]",
      "w": 92.6,
      "h": 34,
      "n": 1,
      "texto": "Atrasadas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"done\"]",
      "w": 99.5,
      "h": 34,
      "n": 1,
      "texto": "Concluídas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"work\"]",
      "w": 84.1,
      "h": 34,
      "n": 1,
      "texto": "Trabalho"
     },
     {
      "seletor": "#calFullBtn",
      "w": 35,
      "h": 35,
      "n": 1,
      "texto": "Calendário em tela cheia"
     },
     {
      "seletor": "#app-update",
      "w": 34,
      "h": 34,
      "n": 1,
      "texto": "Atualizar o app"
     }
    ],
    "larguraConteudo": 390,
    "larguraConteudoInterna": 358,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 65,
    "celulaCalendario": 46,
    "celulaCalendarioAltura": 78,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 67,
     "bottom": 178.9,
     "conteudoTop": 67,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#openDialog",
      "left": 227.3,
      "right": 376,
      "top": 710,
      "bottom": 764,
      "w": 148.8,
      "h": 54
     },
     {
      "seletor": "#jarvis-btn",
      "left": 18,
      "right": 74,
      "top": 742,
      "bottom": 798,
      "w": 56,
      "h": 56
     },
     {
      "seletor": "#cardioFab",
      "left": 328,
      "right": 376,
      "top": 653,
      "bottom": 701,
      "w": 48,
      "h": 48
     },
     {
      "seletor": "#app-update",
      "left": 314.3,
      "right": 348.3,
      "top": 770,
      "bottom": 804,
      "w": 34,
      "h": 34
     }
    ],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 59
   },
   {
    "vista": "dia",
    "perfil": "iphone13",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 47,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 390,
    "viewportW": 390,
    "viewportH": 844,
    "scrollWidthBody": 390,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#viewContent button.task-edit-btn.agenda-edit",
      "top": 795.8,
      "bottom": 935.8,
      "texto": "Editar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-trash[data-action=\"delete\"]",
      "top": 795.8,
      "bottom": 935.8,
      "texto": "Apagar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent input.check[data-action=\"toggle\"]",
      "top": 807.8,
      "bottom": 830.8,
      "texto": "Concluir tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-reschedule[data-action=\"reschedule\"]",
      "top": 807.8,
      "bottom": 838.8,
      "texto": "Reagendar tarefa",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"day\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Dia"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"month\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Mês"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"list\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Lista"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"sequencia\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Sequência"
     },
     {
      "seletor": "#seqEntryBtn",
      "w": 358,
      "h": 40,
      "n": 1,
      "texto": "Modo sequencial"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"all\"]",
      "w": 66.7,
      "h": 34,
      "n": 1,
      "texto": "Todas"
     },
     {
      "seletor": "#filters button.chip.chip-late[data-filter=\"late\"]",
      "w": 92.6,
      "h": 34,
      "n": 1,
      "texto": "Atrasadas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"done\"]",
      "w": 99.5,
      "h": 34,
      "n": 1,
      "texto": "Concluídas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"work\"]",
      "w": 84.1,
      "h": 34,
      "n": 1,
      "texto": "Trabalho"
     },
     {
      "seletor": "#viewContent button.nav-btn",
      "w": 35,
      "h": 35,
      "n": 2,
      "texto": "Dia anterior"
     },
     {
      "seletor": "#viewContent input.day-pick-input",
      "w": 96.2,
      "h": 36,
      "n": 1,
      "texto": "Escolher data"
     },
     {
      "seletor": "#viewContent input.check[data-action=\"toggle\"]",
      "w": 23,
      "h": 23,
      "n": 8,
      "texto": "Concluir tarefa"
     },
     {
      "seletor": "#viewContent button.notas-toggle",
      "w": 93.3,
      "h": 24,
      "n": 8,
      "texto": "Detalhes"
     },
     {
      "seletor": "#viewContent button.agenda-share",
      "w": 98.6,
      "h": 21,
      "n": 8,
      "texto": "Compartilhar tarefa"
     },
     {
      "seletor": "#viewContent button.task-reschedule[data-action=\"reschedule\"]",
      "w": 31,
      "h": 31,
      "n": 8,
      "texto": "Reagendar tarefa"
     },
     {
      "seletor": "#app-update",
      "w": 34,
      "h": 34,
      "n": 1,
      "texto": "Atualizar o app"
     }
    ],
    "larguraConteudo": 390,
    "larguraConteudoInterna": 358,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 65,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 67,
     "bottom": 178.9,
     "conteudoTop": 67,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#openDialog",
      "left": 227.3,
      "right": 376,
      "top": 710,
      "bottom": 764,
      "w": 148.8,
      "h": 54
     },
     {
      "seletor": "#jarvis-btn",
      "left": 18,
      "right": 74,
      "top": 742,
      "bottom": 798,
      "w": 56,
      "h": 56
     },
     {
      "seletor": "#cardioFab",
      "left": 328,
      "right": 376,
      "top": 653,
      "bottom": 701,
      "w": 48,
      "h": 48
     },
     {
      "seletor": "#app-update",
      "left": 314.3,
      "right": 348.3,
      "top": 770,
      "bottom": 804,
      "w": 34,
      "h": 34
     }
    ],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 67
   },
   {
    "vista": "lista",
    "perfil": "iphone13",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 47,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 390,
    "viewportW": 390,
    "viewportH": 844,
    "scrollWidthBody": 390,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#viewContent button.task-edit-btn.agenda-edit",
      "top": 728.5,
      "bottom": 829.8,
      "texto": "Editar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-trash[data-action=\"delete\"]",
      "top": 728.5,
      "bottom": 829.8,
      "texto": "Apagar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.agenda-share",
      "top": 796.8,
      "bottom": 817.8,
      "texto": "Compartilhar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-edit-btn.agenda-edit",
      "top": 830.8,
      "bottom": 970.8,
      "texto": "Editar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-trash[data-action=\"delete\"]",
      "top": 830.8,
      "bottom": 970.8,
      "texto": "Apagar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent input.check[data-action=\"toggle\"]",
      "top": 842.8,
      "bottom": 865.8,
      "texto": "Concluir tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-reschedule[data-action=\"reschedule\"]",
      "top": 842.8,
      "bottom": 873.8,
      "texto": "Reagendar tarefa",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"day\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Dia"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"month\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Mês"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"list\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Lista"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"sequencia\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Sequência"
     },
     {
      "seletor": "#seqEntryBtn",
      "w": 358,
      "h": 40,
      "n": 1,
      "texto": "Modo sequencial"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"all\"]",
      "w": 66.7,
      "h": 34,
      "n": 1,
      "texto": "Todas"
     },
     {
      "seletor": "#filters button.chip.chip-late[data-filter=\"late\"]",
      "w": 92.6,
      "h": 34,
      "n": 1,
      "texto": "Atrasadas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"done\"]",
      "w": 99.5,
      "h": 34,
      "n": 1,
      "texto": "Concluídas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"work\"]",
      "w": 84.1,
      "h": 34,
      "n": 1,
      "texto": "Trabalho"
     },
     {
      "seletor": "#viewContent button.list-previous[data-action=\"show-previous\"]",
      "w": 118.5,
      "h": 14,
      "n": 1,
      "texto": "Ver tarefas anteriores"
     },
     {
      "seletor": "#clearDone",
      "w": 116.5,
      "h": 24,
      "n": 1,
      "texto": "Limpar concluídas"
     },
     {
      "seletor": "#viewContent input.check[data-action=\"toggle\"]",
      "w": 23,
      "h": 23,
      "n": 60,
      "texto": "Concluir tarefa"
     },
     {
      "seletor": "#viewContent button.notas-toggle",
      "w": 93.3,
      "h": 24,
      "n": 52,
      "texto": "Detalhes"
     },
     {
      "seletor": "#viewContent button.agenda-share",
      "w": 98.6,
      "h": 21,
      "n": 60,
      "texto": "Compartilhar tarefa"
     },
     {
      "seletor": "#viewContent button.task-reschedule[data-action=\"reschedule\"]",
      "w": 31,
      "h": 31,
      "n": 60,
      "texto": "Reagendar tarefa"
     },
     {
      "seletor": "#viewContent button.tr-open",
      "w": 88.7,
      "h": 21,
      "n": 9,
      "texto": "Abrir cardio"
     },
     {
      "seletor": "#viewContent button.tr-open",
      "w": 86.3,
      "h": 21,
      "n": 8,
      "texto": "Abrir treino"
     },
     {
      "seletor": "#viewContent button.list-previous.list-more[data-action=\"load-more\"]",
      "w": 188.8,
      "h": 38,
      "n": 1,
      "texto": "Mostrar mais 60 de 277"
     },
     {
      "seletor": "#app-update",
      "w": 34,
      "h": 34,
      "n": 1,
      "texto": "Atualizar o app"
     }
    ],
    "larguraConteudo": 390,
    "larguraConteudoInterna": 358,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 65,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 67,
     "bottom": 178.9,
     "conteudoTop": 67,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#openDialog",
      "left": 227.3,
      "right": 376,
      "top": 710,
      "bottom": 764,
      "w": 148.8,
      "h": 54
     },
     {
      "seletor": "#jarvis-btn",
      "left": 18,
      "right": 74,
      "top": 742,
      "bottom": 798,
      "w": 56,
      "h": 56
     },
     {
      "seletor": "#cardioFab",
      "left": 328,
      "right": 376,
      "top": 653,
      "bottom": 701,
      "w": 48,
      "h": 48
     },
     {
      "seletor": "#app-update",
      "left": 314.3,
      "right": 348.3,
      "top": 770,
      "bottom": 804,
      "w": 34,
      "h": 34
     }
    ],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 388
   },
   {
    "vista": "atrasadas",
    "perfil": "iphone13",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 47,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 390,
    "viewportW": 390,
    "viewportH": 844,
    "scrollWidthBody": 390,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#viewContent button.task-edit-btn.agenda-edit",
      "top": 712.5,
      "bottom": 813.8,
      "texto": "Editar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-trash[data-action=\"delete\"]",
      "top": 712.5,
      "bottom": 813.8,
      "texto": "Apagar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-edit-btn.agenda-edit",
      "top": 814.8,
      "bottom": 935.4,
      "texto": "Editar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-trash[data-action=\"delete\"]",
      "top": 814.8,
      "bottom": 935.4,
      "texto": "Apagar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent input.check[data-action=\"toggle\"]",
      "top": 826.8,
      "bottom": 849.8,
      "texto": "Concluir tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-reschedule[data-action=\"reschedule\"]",
      "top": 826.8,
      "bottom": 857.8,
      "texto": "Reagendar tarefa",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"day\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Dia"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"month\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Mês"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"list\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Lista"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"sequencia\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Sequência"
     },
     {
      "seletor": "#seqEntryBtn",
      "w": 358,
      "h": 40,
      "n": 1,
      "texto": "Modo sequencial"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"all\"]",
      "w": 66.7,
      "h": 34,
      "n": 1,
      "texto": "Todas"
     },
     {
      "seletor": "#filters button.chip.chip-late[data-filter=\"late\"]",
      "w": 92.6,
      "h": 34,
      "n": 1,
      "texto": "Atrasadas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"done\"]",
      "w": 99.5,
      "h": 34,
      "n": 1,
      "texto": "Concluídas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"work\"]",
      "w": 84.1,
      "h": 34,
      "n": 1,
      "texto": "Trabalho"
     },
     {
      "seletor": "#clearDone",
      "w": 116.5,
      "h": 24,
      "n": 1,
      "texto": "Limpar concluídas"
     },
     {
      "seletor": "#viewContent input.check[data-action=\"toggle\"]",
      "w": 23,
      "h": 23,
      "n": 24,
      "texto": "Concluir tarefa"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 76.9,
      "h": 24,
      "n": 1,
      "texto": "R$ 80"
     },
     {
      "seletor": "#viewContent button.agenda-share",
      "w": 98.6,
      "h": 21,
      "n": 24,
      "texto": "Compartilhar tarefa"
     },
     {
      "seletor": "#viewContent button.task-reschedule[data-action=\"reschedule\"]",
      "w": 31,
      "h": 31,
      "n": 24,
      "texto": "Reagendar tarefa"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 64.2,
      "h": 24,
      "n": 2,
      "texto": "0/5"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 49.8,
      "h": 24,
      "n": 5,
      "texto": "•"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 59,
      "h": 24,
      "n": 1,
      "texto": "2h"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 108.5,
      "h": 24,
      "n": 1,
      "texto": "condicional"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 64,
      "h": 24,
      "n": 3,
      "texto": "0/2"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 64.6,
      "h": 24,
      "n": 1,
      "texto": "0/4"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 92.1,
      "h": 24,
      "n": 1,
      "texto": "R$ 4800"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 81.6,
      "h": 24,
      "n": 1,
      "texto": "R$ 150"
     },
     {
      "seletor": "#viewContent button.notas-toggle",
      "w": 93.3,
      "h": 24,
      "n": 7,
      "texto": "Detalhes"
     },
     {
      "seletor": "#viewContent button.notas-toggle.has",
      "w": 143.5,
      "h": 24,
      "n": 1,
      "texto": "R$ 350 · 5/10 parc"
     },
     {
      "seletor": "#app-update",
      "w": 34,
      "h": 34,
      "n": 1,
      "texto": "Atualizar o app"
     }
    ],
    "larguraConteudo": 390,
    "larguraConteudoInterna": 358,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 65,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 67,
     "bottom": 178.9,
     "conteudoTop": 67,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#openDialog",
      "left": 227.3,
      "right": 376,
      "top": 710,
      "bottom": 764,
      "w": 148.8,
      "h": 54
     },
     {
      "seletor": "#jarvis-btn",
      "left": 18,
      "right": 74,
      "top": 742,
      "bottom": 798,
      "w": 56,
      "h": 56
     },
     {
      "seletor": "#cardioFab",
      "left": 328,
      "right": 376,
      "top": 653,
      "bottom": 701,
      "w": 48,
      "h": 48
     },
     {
      "seletor": "#app-update",
      "left": 314.3,
      "right": 348.3,
      "top": 770,
      "bottom": 804,
      "w": 34,
      "h": 34
     }
    ],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 161
   },
   {
    "vista": "sequencia",
    "perfil": "iphone13",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 47,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 390,
    "viewportW": 390,
    "viewportH": 844,
    "scrollWidthBody": 390,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#viewContent button.task-edit-btn.agenda-edit",
      "top": 823.8,
      "bottom": 967.8,
      "texto": "Editar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-trash[data-action=\"delete\"]",
      "top": 823.8,
      "bottom": 967.8,
      "texto": "Apagar tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent input.check[data-action=\"toggle\"]",
      "top": 838.8,
      "bottom": 861.8,
      "texto": "Concluir tarefa",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.task-reschedule[data-action=\"reschedule\"]",
      "top": 838.8,
      "bottom": 869.8,
      "texto": "Reagendar tarefa",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"day\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Dia"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"month\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Mês"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"list\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Lista"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"sequencia\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Sequência"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"all\"]",
      "w": 66.7,
      "h": 34,
      "n": 1,
      "texto": "Todas"
     },
     {
      "seletor": "#filters button.chip.chip-late[data-filter=\"late\"]",
      "w": 92.6,
      "h": 34,
      "n": 1,
      "texto": "Atrasadas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"done\"]",
      "w": 99.5,
      "h": 34,
      "n": 1,
      "texto": "Concluídas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"work\"]",
      "w": 84.1,
      "h": 34,
      "n": 1,
      "texto": "Trabalho"
     },
     {
      "seletor": "#viewContent input.check[data-action=\"toggle\"]",
      "w": 23,
      "h": 23,
      "n": 8,
      "texto": "Concluir tarefa"
     },
     {
      "seletor": "#viewContent button.notas-toggle",
      "w": 93.3,
      "h": 24,
      "n": 8,
      "texto": "Detalhes"
     },
     {
      "seletor": "#viewContent button.agenda-share",
      "w": 98.6,
      "h": 21,
      "n": 8,
      "texto": "Compartilhar tarefa"
     },
     {
      "seletor": "#viewContent button.task-reschedule[data-action=\"reschedule\"]",
      "w": 31,
      "h": 31,
      "n": 8,
      "texto": "Reagendar tarefa"
     },
     {
      "seletor": "#app-update",
      "w": 34,
      "h": 34,
      "n": 1,
      "texto": "Atualizar o app"
     }
    ],
    "larguraConteudo": 390,
    "larguraConteudoInterna": 358,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 65,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 67,
     "bottom": 178.9,
     "conteudoTop": 67,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#openDialog",
      "left": 227.3,
      "right": 376,
      "top": 710,
      "bottom": 764,
      "w": 148.8,
      "h": 54
     },
     {
      "seletor": "#jarvis-btn",
      "left": 18,
      "right": 74,
      "top": 742,
      "bottom": 798,
      "w": 56,
      "h": 56
     },
     {
      "seletor": "#cardioFab",
      "left": 328,
      "right": 376,
      "top": 653,
      "bottom": 701,
      "w": 48,
      "h": 48
     },
     {
      "seletor": "#app-update",
      "left": 314.3,
      "right": 348.3,
      "top": 770,
      "bottom": 804,
      "w": 34,
      "h": 34
     }
    ],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 63
   },
   {
    "vista": "menu",
    "perfil": "iphone13",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 47,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 390,
    "viewportW": 390,
    "viewportH": 844,
    "scrollWidthBody": 390,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-11",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-12",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-13",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-14",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-15",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-16",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-17",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-18",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-19",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-20",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-21",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-22",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-23",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-24",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"day\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Dia"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"month\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Mês"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"list\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Lista"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"sequencia\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Sequência"
     },
     {
      "seletor": "#seqEntryBtn",
      "w": 358,
      "h": 40,
      "n": 1,
      "texto": "Modo sequencial"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"all\"]",
      "w": 66.7,
      "h": 34,
      "n": 1,
      "texto": "Todas"
     },
     {
      "seletor": "#filters button.chip.chip-late[data-filter=\"late\"]",
      "w": 92.6,
      "h": 34,
      "n": 1,
      "texto": "Atrasadas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"done\"]",
      "w": 99.5,
      "h": 34,
      "n": 1,
      "texto": "Concluídas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"work\"]",
      "w": 84.1,
      "h": 34,
      "n": 1,
      "texto": "Trabalho"
     },
     {
      "seletor": "#calFullBtn",
      "w": 35,
      "h": 35,
      "n": 1,
      "texto": "Calendário em tela cheia"
     },
     {
      "seletor": "#app-update",
      "w": 34,
      "h": 34,
      "n": 1,
      "texto": "Atualizar o app"
     }
    ],
    "larguraConteudo": 390,
    "larguraConteudoInterna": 358,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 65,
    "celulaCalendario": 46,
    "celulaCalendarioAltura": 78,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 67,
     "bottom": 178.9,
     "conteudoTop": 67,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#openDialog",
      "left": 227.3,
      "right": 376,
      "top": 710,
      "bottom": 764,
      "w": 148.8,
      "h": 54
     },
     {
      "seletor": "#jarvis-btn",
      "left": 18,
      "right": 74,
      "top": 742,
      "bottom": 798,
      "w": 56,
      "h": 56
     },
     {
      "seletor": "#cardioFab",
      "left": 328,
      "right": 376,
      "top": 653,
      "bottom": 701,
      "w": 48,
      "h": 48
     },
     {
      "seletor": "#app-update",
      "left": 314.3,
      "right": 348.3,
      "top": 770,
      "bottom": 804,
      "w": 34,
      "h": 34
     }
    ],
    "sobreposicao": {
     "seletor": "#quickMenu",
     "left": 114,
     "right": 374,
     "top": 121,
     "bottom": 590,
     "w": 260,
     "h": 469,
     "dentroDaAreaSegura": true
    },
    "transbordando": [],
    "totalInterativosVisiveis": 68
   },
   {
    "vista": "nova-tarefa",
    "perfil": "iphone13",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 47,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 390,
    "viewportW": 390,
    "viewportH": 844,
    "scrollWidthBody": 390,
    "interativosSobIlha": [],
    "interativosSobIndicador": [],
    "alvosPequenos": [
     {
      "seletor": "#taskLembrete",
      "w": 18,
      "h": 18,
      "n": 1,
      "texto": "on"
     },
     {
      "seletor": "#closeTaskDialog",
      "w": 93.4,
      "h": 41,
      "n": 1,
      "texto": "Cancelar"
     },
     {
      "seletor": "#taskForm button.primary",
      "w": 97.9,
      "h": 41,
      "n": 1,
      "texto": "Adicionar"
     }
    ],
    "larguraConteudo": 390,
    "larguraConteudoInterna": 358,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 65,
    "celulaCalendario": 46,
    "celulaCalendarioAltura": 78,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 67,
     "bottom": 178.9,
     "conteudoTop": 67,
     "sobIlha": false
    },
    "flutuantes": [],
    "sobreposicao": {
     "seletor": "#taskDialog",
     "left": 19,
     "right": 371,
     "top": 135.6,
     "bottom": 708.4,
     "w": 352,
     "h": 572.8,
     "dentroDaAreaSegura": true
    },
    "transbordando": [],
    "totalInterativosVisiveis": 9
   },
   {
    "vista": "jarvis",
    "perfil": "iphone13",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 47,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 390,
    "viewportW": 390,
    "viewportH": 844,
    "scrollWidthBody": 390,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-11",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-12",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-13",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-14",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-15",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-16",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 753.9,
      "bottom": 837.5,
      "texto": "Abrir 2026-10-17",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-18",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-19",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-20",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-21",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-22",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-23",
      "fixo": false
     },
     {
      "seletor": "#viewContent button.calendar-day",
      "top": 841.5,
      "bottom": 925.1,
      "texto": "Abrir 2026-10-24",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"day\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Dia"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"month\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Mês"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"list\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Lista"
     },
     {
      "seletor": "#viewTabs button.view-tab[data-view=\"sequencia\"]",
      "w": 84,
      "h": 37,
      "n": 1,
      "texto": "Sequência"
     },
     {
      "seletor": "#seqEntryBtn",
      "w": 358,
      "h": 40,
      "n": 1,
      "texto": "Modo sequencial"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"all\"]",
      "w": 66.7,
      "h": 34,
      "n": 1,
      "texto": "Todas"
     },
     {
      "seletor": "#filters button.chip.chip-late[data-filter=\"late\"]",
      "w": 92.6,
      "h": 34,
      "n": 1,
      "texto": "Atrasadas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"done\"]",
      "w": 99.5,
      "h": 34,
      "n": 1,
      "texto": "Concluídas"
     },
     {
      "seletor": "#filters button.chip[data-filter=\"work\"]",
      "w": 84.1,
      "h": 34,
      "n": 1,
      "texto": "Trabalho"
     },
     {
      "seletor": "#calFullBtn",
      "w": 35,
      "h": 35,
      "n": 1,
      "texto": "Calendário em tela cheia"
     },
     {
      "seletor": "#app-update",
      "w": 34,
      "h": 34,
      "n": 1,
      "texto": "Atualizar o app"
     },
     {
      "seletor": "#jarvis-voice-toggle",
      "w": 30,
      "h": 30,
      "n": 1,
      "texto": "Alternar voz"
     },
     {
      "seletor": "#jarvis-key",
      "w": 30,
      "h": 30,
      "n": 1,
      "texto": "Escolher a voz do Jarvis"
     },
     {
      "seletor": "#jarvis-close",
      "w": 30,
      "h": 30,
      "n": 1,
      "texto": "Fechar"
     },
     {
      "seletor": "#jarvis-locbar",
      "w": 364,
      "h": 29,
      "n": 1,
      "texto": "Ligar ou desligar a localização"
     },
     {
      "seletor": "#jarvis-chips button.j-chip[data-p=\"Me dê um briefing …\"]",
      "w": 95.4,
      "h": 31,
      "n": 1,
      "texto": "Meu dia"
     },
     {
      "seletor": "#jarvis-chips button.j-chip[data-p=\"Escreva uma mensag…\"]",
      "w": 92.8,
      "h": 31,
      "n": 1,
      "texto": "Receita"
     },
     {
      "seletor": "#jarvis-chips button.j-chip[data-p=\"Onde estou agora, …\"]",
      "w": 116.3,
      "h": 31,
      "n": 1,
      "texto": "Onde estou"
     },
     {
      "seletor": "#jarvis-chips button.j-chip[data-p=\"Resumo da minha se…\"]",
      "w": 96.4,
      "h": 31,
      "n": 1,
      "texto": "Semana"
     },
     {
      "seletor": "#jarvis-chips button.j-chip[data-p=\"Analise minhas tar…\"]",
      "w": 106.8,
      "h": 31,
      "n": 1,
      "texto": "Organizar"
     },
     {
      "seletor": "#jarvis-chips button.j-chip[data-p=\"Como está o clima …\"]",
      "w": 82.3,
      "h": 31,
      "n": 1,
      "texto": "Clima"
     },
     {
      "seletor": "#jarvis-chips button.j-chip[data-p=\"Me dê as principai…\"]",
      "w": 97.2,
      "h": 31,
      "n": 1,
      "texto": "Notícias"
     },
     {
      "seletor": "#jarvis-mic",
      "w": 40,
      "h": 40,
      "n": 1,
      "texto": "Falar"
     },
     {
      "seletor": "#jarvis-input",
      "w": 244,
      "h": 42.4,
      "n": 1,
      "texto": ""
     },
     {
      "seletor": "#jarvis-send",
      "w": 40,
      "h": 40,
      "n": 1,
      "texto": "Enviar"
     }
    ],
    "larguraConteudo": 390,
    "larguraConteudoInterna": 358,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 65,
    "celulaCalendario": 46,
    "celulaCalendarioAltura": 78,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 67,
     "bottom": 178.9,
     "conteudoTop": 67,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#openDialog",
      "left": 227.3,
      "right": 376,
      "top": 710,
      "bottom": 764,
      "w": 148.8,
      "h": 54
     },
     {
      "seletor": "#jarvis-btn",
      "left": 18,
      "right": 74,
      "top": 742,
      "bottom": 798,
      "w": 56,
      "h": 56
     },
     {
      "seletor": "#cardioFab",
      "left": 328,
      "right": 376,
      "top": 653,
      "bottom": 701,
      "w": 48,
      "h": 48
     },
     {
      "seletor": "#app-update",
      "left": 314.3,
      "right": 348.3,
      "top": 770,
      "bottom": 804,
      "w": 34,
      "h": 34
     },
     {
      "seletor": "#jarvis-locbar",
      "left": 13,
      "right": 377,
      "top": 317.3,
      "bottom": 346.3,
      "w": 364,
      "h": 29
     }
    ],
    "sobreposicao": {
     "seletor": "#jarvis-panel",
     "left": 12,
     "right": 378,
     "top": 247.3,
     "bottom": 720,
     "w": 366,
     "h": 472.7,
     "dentroDaAreaSegura": true
    },
    "transbordando": [],
    "totalInterativosVisiveis": 73
   },
   {
    "vista": "voz",
    "perfil": "iphone13",
    "url": "/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 47,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 390,
    "viewportW": 390,
    "viewportH": 844,
    "scrollWidthBody": 390,
    "interativosSobIlha": [],
    "interativosSobIndicador": [],
    "alvosPequenos": [
     {
      "seletor": "#voz-dialog button.vz-x",
      "w": 30,
      "h": 30,
      "n": 1,
      "texto": "Fechar"
     },
     {
      "seletor": "#voz-dialog button.vz-ouvir",
      "w": 62.3,
      "h": 31,
      "n": 1,
      "texto": "Trocar"
     },
     {
      "seletor": "#voz-dialog a[href=\"https://github.com/rhasspy/piper\"]",
      "w": 25,
      "h": 13,
      "n": 1,
      "texto": "Piper"
     },
     {
      "seletor": "#voz-dialog a[href=\"https://github.com/hexgrad/kokoro\"]",
      "w": 317.9,
      "h": 28.2,
      "n": 1,
      "texto": "Kokoro-82M"
     }
    ],
    "larguraConteudo": 390,
    "larguraConteudoInterna": 358,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 65,
    "celulaCalendario": 46,
    "celulaCalendarioAltura": 78,
    "cabecalho": {
     "seletor": "header.topbar",
     "top": 67,
     "bottom": 178.9,
     "conteudoTop": 67,
     "sobIlha": false
    },
    "flutuantes": [],
    "sobreposicao": {
     "seletor": "#voz-dialog",
     "left": 19,
     "right": 371,
     "top": 59.1,
     "bottom": 784.9,
     "w": 352,
     "h": 725.8,
     "dentroDaAreaSegura": true
    },
    "transbordando": [],
    "totalInterativosVisiveis": 4
   }
  ],
  "auxiliares": [
   {
    "vista": "aux-financeiro",
    "perfil": "iphone17promax",
    "url": "/financeiro.html",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "div.filters > button",
      "top": 894.6,
      "bottom": 929.6,
      "texto": "Todos",
      "fixo": false
     },
     {
      "seletor": "div.filters > button",
      "top": 894.6,
      "bottom": 929.6,
      "texto": "Entradas",
      "fixo": false
     },
     {
      "seletor": "div.filters > button",
      "top": 894.6,
      "bottom": 929.6,
      "texto": "Saídas",
      "fixo": false
     },
     {
      "seletor": "div.filters > button",
      "top": 894.6,
      "bottom": 929.6,
      "texto": "Atrasados",
      "fixo": false
     },
     {
      "seletor": "div.filters > button",
      "top": 894.6,
      "bottom": 929.6,
      "texto": "Reemb./Refat.",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#conedit",
      "w": 65.9,
      "h": 26,
      "n": 1,
      "texto": "Ajustar"
     },
     {
      "seletor": "#ivedit",
      "w": 63.9,
      "h": 24,
      "n": 1,
      "texto": "Ajustar"
     },
     {
      "seletor": "#prevedit",
      "w": 63.9,
      "h": 24,
      "n": 1,
      "texto": "Ajustar"
     },
     {
      "seletor": "#pluxeeEdit",
      "w": 56.5,
      "h": 25,
      "n": 1,
      "texto": "Ajustar"
     },
     {
      "seletor": "div.filters > button",
      "w": 63,
      "h": 35,
      "n": 1,
      "texto": "Todos"
     },
     {
      "seletor": "div.filters > button",
      "w": 81,
      "h": 35,
      "n": 1,
      "texto": "Entradas"
     },
     {
      "seletor": "div.filters > button",
      "w": 67,
      "h": 35,
      "n": 1,
      "texto": "Saídas"
     },
     {
      "seletor": "div.filters > button",
      "w": 89.2,
      "h": 35,
      "n": 1,
      "texto": "Atrasados"
     },
     {
      "seletor": "div.filters > button",
      "w": 112.9,
      "h": 35,
      "n": 1,
      "texto": "Reemb./Refat."
     },
     {
      "seletor": "div.filters > button",
      "w": 69.9,
      "h": 35,
      "n": 1,
      "texto": "Extrato"
     }
    ],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.head",
     "top": 80,
     "bottom": 149,
     "conteudoTop": 80,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#fab",
      "left": 366,
      "right": 424,
      "top": 846,
      "bottom": 904,
      "w": 58,
      "h": 58
     }
    ],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 18,
    "caminhoPedido": "financeiro.html",
    "viewportMeta": "width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover",
    "errosJs": []
   },
   {
    "vista": "aux-marketplace",
    "perfil": "iphone17promax",
    "url": "/marketplace/",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [],
    "alvosPequenos": [
     {
      "seletor": "#cofreLembrar",
      "w": 13,
      "h": 13,
      "n": 1,
      "texto": "on"
     }
    ],
    "larguraConteudo": 420,
    "larguraConteudoInterna": 388,
    "seletorConteudo": "#cofre",
    "paddingTopConteudo": 0,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.in",
     "top": 0,
     "bottom": 154.1,
     "conteudoTop": 80,
     "sobIlha": false
    },
    "flutuantes": [],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 4,
    "caminhoPedido": "marketplace/",
    "viewportMeta": "width=device-width,initial-scale=1,viewport-fit=cover",
    "errosJs": []
   },
   {
    "vista": "aux-gamificacao",
    "perfil": "iphone17promax",
    "url": "/gamificacao.html",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [],
    "alvosPequenos": [],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "#gamePage",
    "paddingTopConteudo": 80,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "#gamePage header.head",
     "top": 80,
     "bottom": 150,
     "conteudoTop": 80,
     "sobIlha": false
    },
    "flutuantes": [],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 1,
    "caminhoPedido": "gamificacao.html",
    "viewportMeta": "width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover",
    "errosJs": []
   },
   {
    "vista": "aux-equipamentos-especiais",
    "perfil": "iphone17promax",
    "url": "/equipamentos-especiais.html",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [],
    "alvosPequenos": [
     {
      "seletor": "a[href=\"./\"]",
      "w": 197,
      "h": 36,
      "n": 1,
      "texto": "Agenda"
     },
     {
      "seletor": "a[href=\"equipamentos-especiais.html\"]",
      "w": 197,
      "h": 36,
      "n": 1,
      "texto": "Equipamentos Especiais"
     },
     {
      "seletor": "div.quickbar > button",
      "w": 132,
      "h": 41,
      "n": 3,
      "texto": "Mapa"
     },
     {
      "seletor": "#busca",
      "w": 408,
      "h": 41,
      "n": 1,
      "texto": ""
     },
     {
      "seletor": "#cidadeFiltro",
      "w": 408,
      "h": 38,
      "n": 1,
      "texto": "Todas as cidadesALMAS (2)ARAGUAINA (1)AR"
     },
     {
      "seletor": "button.cb-analise",
      "w": 201,
      "h": 36,
      "n": 1,
      "texto": "Aguardando análise DMSL"
     },
     {
      "seletor": "button.cb-ncon",
      "w": 201,
      "h": 36,
      "n": 1,
      "texto": "Não conformidade"
     },
     {
      "seletor": "button.prim",
      "w": 200,
      "h": 34,
      "n": 1,
      "texto": "Exportar Excel"
     },
     {
      "seletor": "div.toolbar > button",
      "w": 200,
      "h": 34,
      "n": 1,
      "texto": "Atualizar dados"
     },
     {
      "seletor": "#app-update",
      "w": 34,
      "h": 34,
      "n": 1,
      "texto": "Atualizar o app"
     }
    ],
    "larguraConteudo": 408,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "div.stage",
    "paddingTopConteudo": 0,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "div.hd > h1",
     "top": 136,
     "bottom": 186,
     "conteudoTop": 136,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#app-update",
      "left": 361.2,
      "right": 395.2,
      "top": 882,
      "bottom": 916,
      "w": 34,
      "h": 34
     }
    ],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 21,
    "caminhoPedido": "equipamentos-especiais.html",
    "viewportMeta": "width=device-width,initial-scale=1,viewport-fit=cover",
    "errosJs": []
   },
   {
    "vista": "aux-treino",
    "perfil": "iphone17promax",
    "url": "/treino.html?date=2026-10-19",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#trBody input[type=\"number\"]",
      "top": 898.6,
      "bottom": 940.6,
      "texto": "",
      "fixo": false
     },
     {
      "seletor": "#trBody input[type=\"text\"]",
      "top": 898.6,
      "bottom": 940.6,
      "texto": "15",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#trHome",
      "w": 94.1,
      "h": 36,
      "n": 1,
      "texto": "Voltar para a agenda"
     },
     {
      "seletor": "#trPresets button.tr-preset",
      "w": 43.1,
      "h": 23,
      "n": 1,
      "texto": "30s"
     },
     {
      "seletor": "#trPresets button.tr-preset",
      "w": 43.2,
      "h": 23,
      "n": 2,
      "texto": "60s"
     },
     {
      "seletor": "#trPresets button.tr-preset",
      "w": 49.3,
      "h": 23,
      "n": 1,
      "texto": "2min"
     },
     {
      "seletor": "#trToggle",
      "w": 42,
      "h": 42,
      "n": 1,
      "texto": "Iniciar descanso"
     },
     {
      "seletor": "#trReset",
      "w": 42,
      "h": 42,
      "n": 1,
      "texto": "Zerar"
     },
     {
      "seletor": "#trBody input[type=\"number\"]",
      "w": 160,
      "h": 42,
      "n": 7,
      "texto": ""
     },
     {
      "seletor": "#trBody input[type=\"text\"]",
      "w": 160,
      "h": 42,
      "n": 7,
      "texto": "12"
     }
    ],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 440,
    "seletorConteudo": "#treinoPage",
    "paddingTopConteudo": 0,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "#treinoPage div.tr-head",
     "top": 0,
     "bottom": 164,
     "conteudoTop": 76,
     "sobIlha": false
    },
    "flutuantes": [],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 23,
    "caminhoPedido": "treino.html?date=2026-10-19",
    "viewportMeta": "width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover",
    "errosJs": []
   },
   {
    "vista": "aux-carteira",
    "perfil": "iphone17promax",
    "url": "/carteira.html",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#prev",
      "top": 895.6,
      "bottom": 939.6,
      "texto": "‹",
      "fixo": false
     },
     {
      "seletor": "#next",
      "top": 895.6,
      "bottom": 939.6,
      "texto": "›",
      "fixo": false
     }
    ],
    "alvosPequenos": [],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.head",
     "top": 80,
     "bottom": 151,
     "conteudoTop": 80,
     "sobIlha": false
    },
    "flutuantes": [],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 4,
    "caminhoPedido": "carteira.html",
    "viewportMeta": "width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover",
    "errosJs": []
   },
   {
    "vista": "aux-extrato-saldo",
    "perfil": "iphone17promax",
    "url": "/extrato-saldo.html?mes=2026-10",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [],
    "alvosPequenos": [],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.head",
     "top": 80,
     "bottom": 149,
     "conteudoTop": 80,
     "sobIlha": false
    },
    "flutuantes": [],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 1,
    "caminhoPedido": "extrato-saldo.html?mes=2026-10",
    "viewportMeta": "width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover",
    "errosJs": []
   },
   {
    "vista": "aux-investimentos",
    "perfil": "iphone17promax",
    "url": "/investimentos.html",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "#sRate",
      "top": 913,
      "bottom": 957,
      "texto": "13.14",
      "fixo": false
     },
     {
      "seletor": "#sMonths",
      "top": 913,
      "bottom": 957,
      "texto": "60",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#cofresBox button.editbtn",
      "w": 65.9,
      "h": 28,
      "n": 3,
      "texto": "Ajustar"
     },
     {
      "seletor": "#eprevBox button.editbtn",
      "w": 98.3,
      "h": 28,
      "n": 1,
      "texto": "Ajustar plano"
     },
     {
      "seletor": "#saveMetas",
      "w": 374,
      "h": 43,
      "n": 1,
      "texto": "Salvar metas"
     }
    ],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.head",
     "top": 80,
     "bottom": 151,
     "conteudoTop": 80,
     "sobIlha": false
    },
    "flutuantes": [],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 13,
    "caminhoPedido": "investimentos.html",
    "viewportMeta": "width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover",
    "errosJs": []
   },
   {
    "vista": "aux-fatura-inter",
    "perfil": "iphone17promax",
    "url": "/fatura-inter.html?fatura=2026-11",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [],
    "alvosPequenos": [
     {
      "seletor": "#views button[data-view=\"fatura\"]",
      "w": 197,
      "h": 37,
      "n": 1,
      "texto": "Fatura do mês"
     },
     {
      "seletor": "#tabAno",
      "w": 197,
      "h": 37,
      "n": 1,
      "texto": "Ano 2026"
     }
    ],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.head",
     "top": 80,
     "bottom": 145,
     "conteudoTop": 80,
     "sobIlha": false
    },
    "flutuantes": [],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 5,
    "caminhoPedido": "fatura-inter.html",
    "viewportMeta": "width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover",
    "errosJs": []
   },
   {
    "vista": "aux-refaturamento",
    "perfil": "iphone17promax",
    "url": "/refaturamento.html",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [],
    "alvosPequenos": [
     {
      "seletor": "#simulateRefund",
      "w": 190,
      "h": 42,
      "n": 1,
      "texto": "Devolver R$ 8.500"
     },
     {
      "seletor": "#simulateLorena",
      "w": 190,
      "h": 42,
      "n": 1,
      "texto": "Lorena · devolver R$ 6.000"
     },
     {
      "seletor": "#simulateMatheus",
      "w": 190,
      "h": 42,
      "n": 1,
      "texto": "Matheus Gracia · devolver R$ 2.500"
     }
    ],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.head",
     "top": 80,
     "bottom": 149.8,
     "conteudoTop": 80,
     "sobIlha": false
    },
    "flutuantes": [],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 11,
    "caminhoPedido": "refaturamento.html",
    "viewportMeta": "width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover",
    "errosJs": []
   },
   {
    "vista": "aux-financeiro-compartilhado",
    "perfil": "iphone17promax",
    "url": "/financeiro.html",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [
     {
      "seletor": "div.filters > button",
      "top": 894.6,
      "bottom": 929.6,
      "texto": "Todos",
      "fixo": false
     },
     {
      "seletor": "div.filters > button",
      "top": 894.6,
      "bottom": 929.6,
      "texto": "Entradas",
      "fixo": false
     },
     {
      "seletor": "div.filters > button",
      "top": 894.6,
      "bottom": 929.6,
      "texto": "Saídas",
      "fixo": false
     },
     {
      "seletor": "div.filters > button",
      "top": 894.6,
      "bottom": 929.6,
      "texto": "Atrasados",
      "fixo": false
     },
     {
      "seletor": "div.filters > button",
      "top": 894.6,
      "bottom": 929.6,
      "texto": "Reemb./Refat.",
      "fixo": false
     }
    ],
    "alvosPequenos": [
     {
      "seletor": "#conedit",
      "w": 65.9,
      "h": 26,
      "n": 1,
      "texto": "Ajustar"
     },
     {
      "seletor": "#ivedit",
      "w": 63.9,
      "h": 24,
      "n": 1,
      "texto": "Ajustar"
     },
     {
      "seletor": "#prevedit",
      "w": 63.9,
      "h": 24,
      "n": 1,
      "texto": "Ajustar"
     },
     {
      "seletor": "#pluxeeEdit",
      "w": 56.5,
      "h": 25,
      "n": 1,
      "texto": "Ajustar"
     },
     {
      "seletor": "div.filters > button",
      "w": 63,
      "h": 35,
      "n": 1,
      "texto": "Todos"
     },
     {
      "seletor": "div.filters > button",
      "w": 81,
      "h": 35,
      "n": 1,
      "texto": "Entradas"
     },
     {
      "seletor": "div.filters > button",
      "w": 67,
      "h": 35,
      "n": 1,
      "texto": "Saídas"
     },
     {
      "seletor": "div.filters > button",
      "w": 89.2,
      "h": 35,
      "n": 1,
      "texto": "Atrasados"
     },
     {
      "seletor": "div.filters > button",
      "w": 112.9,
      "h": 35,
      "n": 1,
      "texto": "Reemb./Refat."
     },
     {
      "seletor": "div.filters > button",
      "w": 69.9,
      "h": 35,
      "n": 1,
      "texto": "Extrato"
     }
    ],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.head",
     "top": 80,
     "bottom": 149,
     "conteudoTop": 80,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#fab",
      "left": 366,
      "right": 424,
      "top": 846,
      "bottom": 904,
      "w": 58,
      "h": 58
     }
    ],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 18,
    "caminhoPedido": "financeiro-compartilhado.html",
    "viewportMeta": "width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover",
    "errosJs": []
   },
   {
    "vista": "aux-importar",
    "perfil": "iphone17promax",
    "url": "/importar.html",
    "metodoAreaSegura": "cdp",
    "insetMedido": {
     "top": 62,
     "right": 0,
     "bottom": 34,
     "left": 0
    },
    "scrollWidth": 440,
    "viewportW": 440,
    "viewportH": 956,
    "scrollWidthBody": 440,
    "interativosSobIlha": [],
    "interativosSobIndicador": [],
    "alvosPequenos": [],
    "larguraConteudo": 440,
    "larguraConteudoInterna": 408,
    "seletorConteudo": "main.app",
    "paddingTopConteudo": 80,
    "celulaCalendario": null,
    "celulaCalendarioAltura": null,
    "cabecalho": {
     "seletor": "header.head",
     "top": 80,
     "bottom": 148,
     "conteudoTop": 80,
     "sobIlha": false
    },
    "flutuantes": [
     {
      "seletor": "#launch",
      "left": 16,
      "right": 424,
      "top": 856,
      "bottom": 906,
      "w": 408,
      "h": 50
     }
    ],
    "sobreposicao": null,
    "transbordando": [],
    "totalInterativosVisiveis": 3,
    "caminhoPedido": "importar.html",
    "viewportMeta": "width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover",
    "errosJs": []
   }
  ],
  "erros": {
   "iphone17promax": [],
   "iphone13": []
  }
 },
 "extras": {
  "iphone17promax": {
   "reagendar": {
    "w": 370,
    "left": 35,
    "top": 336,
    "bottom": 620,
    "nomeTarefaW": 245,
    "presets": [
     [
      104.7,
      38
     ],
     [
      104.7,
      38
     ],
     [
      104.7,
      38
     ]
    ]
   },
   "uaDialogMaxWidth": "calc(100% - 38px)",
   "novaTarefa": {
    "w": 402,
    "maxWidthComputado": "calc(100% - 38px)",
    "lembrete": {
     "w": 18,
     "h": 18,
     "dentroDeLabel": true,
     "labelW": 358,
     "labelH": 32
    }
   },
   "menuItens": [
    {
     "seletor": "a[href=\"./\"]",
     "texto": "Agenda",
     "ariaLabel": null,
     "w": 244,
     "h": 45
    },
    {
     "seletor": "a[href=\"financeiro.html\"]",
     "texto": "Financeiro",
     "ariaLabel": null,
     "w": 244,
     "h": 45
    },
    {
     "seletor": "a[href=\"./marketplace/\"]",
     "texto": "Oportunidades Marketplace",
     "ariaLabel": null,
     "w": 244,
     "h": 45
    },
    {
     "seletor": "#painelBtn",
     "texto": "Gamificação e indicadores",
     "ariaLabel": "Abrir gamificação e evolução",
     "w": 244,
     "h": 45
    },
    {
     "seletor": "#alertsBtn",
     "texto": "Alertas e lembretes",
     "ariaLabel": "Configurar alertas",
     "w": 244,
     "h": 45
    },
    {
     "seletor": "#themeToggle",
     "texto": "Modo claro",
     "ariaLabel": "Mudar para modo claro",
     "w": 244,
     "h": 45
    },
    {
     "seletor": "#equipamentosBtn",
     "texto": "",
     "ariaLabel": "Equipamentos Especiais",
     "w": 244,
     "h": 46
    },
    {
     "seletor": "#atualizarBtn",
     "texto": "",
     "ariaLabel": "Atualizar o app",
     "w": 244,
     "h": 46
    },
    {
     "seletor": "#agendaSharedBtn",
     "texto": "Tarefas compartilhadas",
     "ariaLabel": null,
     "w": 244,
     "h": 45
    }
   ],
   "tarefaAlvos": {
    "checkDentroDeLabel": false,
    "check": [
     23,
     23
    ],
    "coluna": "25px 299px 32px"
   },
   "cabecalho": {
    "h1FontSize": "38.72px",
    "h1W": 246,
    "headActionsW": 150,
    "botoes": [
     {
      "id": "seqTimerBtn",
      "w": 46,
      "h": 46
     },
     {
      "id": "parceiroBtn",
      "w": 46,
      "h": 46
     },
     {
      "id": "moreMenuBtn",
      "w": 46,
      "h": 46
     }
    ]
   },
   "calendario": {
    "celulaW": 52.5625,
    "celulaMinHeight": "91px",
    "padding": "5px 4px",
    "etiquetaFonte": "8.5px",
    "gradeW": 392,
    "gradeH": 566
   },
   "rolado400": {
    "scrollY": 400,
    "pontoY": 31,
    "elementoNoPonto": "main.app",
    "barrasFixasCobrindoIlha": [],
    "interativosSobIlhaRolado": 7
   },
   "flutuantes": [
    {
     "seletor": "#openDialog",
     "left": 277.3,
     "right": 426,
     "top": 822,
     "bottom": 876,
     "w": 148.8,
     "h": 54
    },
    {
     "seletor": "#jarvis-btn",
     "left": 18,
     "right": 74,
     "top": 854,
     "bottom": 910,
     "w": 56,
     "h": 56
    },
    {
     "seletor": "#cardioFab",
     "left": 378,
     "right": 426,
     "top": 765,
     "bottom": 813,
     "w": 48,
     "h": 48
    },
    {
     "seletor": "#app-update",
     "left": 364.3,
     "right": 398.3,
     "top": 882,
     "bottom": 916,
     "w": 34,
     "h": 34
    }
   ],
   "diasCobertosNoMes": {
    "openDialog": [
     "2026-10-15",
     "2026-10-16",
     "2026-10-17 (hoje)",
     "2026-10-22",
     "2026-10-23",
     "2026-10-24"
    ],
    "cardioFab": [
     "2026-10-17 (hoje)"
    ],
    "jarvis-btn": [
     "2026-10-11",
     "2026-10-18"
    ],
    "app-update": [
     "2026-10-24"
    ]
   }
  },
  "iphone13": {
   "reagendar": {
    "w": 350,
    "left": 20,
    "top": 280,
    "bottom": 564,
    "nomeTarefaW": 245,
    "presets": [
     [
      98,
      38
     ],
     [
      98,
      38
     ],
     [
      98,
      38
     ]
    ]
   },
   "uaDialogMaxWidth": "calc(100% - 38px)",
   "novaTarefa": {
    "w": 352,
    "maxWidthComputado": "calc(100% - 38px)",
    "lembrete": {
     "w": 18,
     "h": 18,
     "dentroDeLabel": true,
     "labelW": 308,
     "labelH": 32
    }
   },
   "menuItens": [
    {
     "seletor": "a[href=\"./\"]",
     "texto": "Agenda",
     "ariaLabel": null,
     "w": 244,
     "h": 45
    },
    {
     "seletor": "a[href=\"financeiro.html\"]",
     "texto": "Financeiro",
     "ariaLabel": null,
     "w": 244,
     "h": 45
    },
    {
     "seletor": "a[href=\"./marketplace/\"]",
     "texto": "Oportunidades Marketplace",
     "ariaLabel": null,
     "w": 244,
     "h": 45
    },
    {
     "seletor": "#painelBtn",
     "texto": "Gamificação e indicadores",
     "ariaLabel": "Abrir gamificação e evolução",
     "w": 244,
     "h": 45
    },
    {
     "seletor": "#alertsBtn",
     "texto": "Alertas e lembretes",
     "ariaLabel": "Configurar alertas",
     "w": 244,
     "h": 45
    },
    {
     "seletor": "#themeToggle",
     "texto": "Modo claro",
     "ariaLabel": "Mudar para modo claro",
     "w": 244,
     "h": 45
    },
    {
     "seletor": "#equipamentosBtn",
     "texto": "",
     "ariaLabel": "Equipamentos Especiais",
     "w": 244,
     "h": 46
    },
    {
     "seletor": "#atualizarBtn",
     "texto": "",
     "ariaLabel": "Atualizar o app",
     "w": 244,
     "h": 46
    },
    {
     "seletor": "#agendaSharedBtn",
     "texto": "Tarefas compartilhadas",
     "ariaLabel": null,
     "w": 244,
     "h": 45
    }
   ],
   "tarefaAlvos": {
    "checkDentroDeLabel": false,
    "check": [
     23,
     23
    ],
    "coluna": "25px 249px 32px"
   },
   "cabecalho": {
    "h1FontSize": "34.32px",
    "h1W": 196,
    "headActionsW": 150,
    "botoes": [
     {
      "id": "seqTimerBtn",
      "w": 46,
      "h": 46
     },
     {
      "id": "parceiroBtn",
      "w": 46,
      "h": 46
     },
     {
      "id": "moreMenuBtn",
      "w": 46,
      "h": 46
     }
    ]
   },
   "calendario": {
    "celulaW": 46,
    "celulaMinHeight": "78px",
    "padding": "4px 3px",
    "etiquetaFonte": "8px",
    "gradeW": 346,
    "gradeH": 510
   },
   "rolado400": {
    "scrollY": 400,
    "pontoY": 24,
    "elementoNoPonto": "#seqEntryBtn",
    "barrasFixasCobrindoIlha": [],
    "interativosSobIlhaRolado": 3
   },
   "flutuantes": [
    {
     "seletor": "#openDialog",
     "left": 227.3,
     "right": 376,
     "top": 710,
     "bottom": 764,
     "w": 148.8,
     "h": 54
    },
    {
     "seletor": "#jarvis-btn",
     "left": 18,
     "right": 74,
     "top": 742,
     "bottom": 798,
     "w": 56,
     "h": 56
    },
    {
     "seletor": "#cardioFab",
     "left": 328,
     "right": 376,
     "top": 653,
     "bottom": 701,
     "w": 48,
     "h": 48
    },
    {
     "seletor": "#app-update",
     "left": 314.3,
     "right": 348.3,
     "top": 770,
     "bottom": 804,
     "w": 34,
     "h": 34
    }
   ],
   "diasCobertosNoMes": {
    "openDialog": [
     "2026-10-08",
     "2026-10-09",
     "2026-10-10",
     "2026-10-15",
     "2026-10-16",
     "2026-10-17 (hoje)"
    ],
    "cardioFab": [
     "2026-10-03",
     "2026-10-10"
    ],
    "jarvis-btn": [
     "2026-10-04",
     "2026-10-05",
     "2026-10-11",
     "2026-10-12"
    ],
    "app-update": [
     "2026-10-16",
     "2026-10-17 (hoje)"
    ]
   }
  }
 }
}
```
