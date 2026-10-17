# Designer: variante `essencial` ("Conteúdo primeiro")

- Arquivo: `/home/user/agenda-iphone/estilos-inicio/essencial.css`, 78 linhas.
  - Toda regra começa com `html[data-home="essencial"]`. Conferido por grep: 0 linhas de regra sem o prefixo.
- Capturas (16): `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/inicio/essencial/<perfil>-<vista>-<tema>.png`.
- Medidas brutas: `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/inicio/essencial-medidas.json`.
- Scripts usados (scratchpad, fora do repositório): `.../scratchpad/essencial-work/` (`rodar.cjs`, `sanidade.cjs`, `lembrete.cjs`, `largo.cjs`, `layout-com-variante.cjs`).

## Decisão de design

A tela de hoje gasta cerca de meia tela em cromo antes do primeiro dia do calendário. A variante tira as molduras e deixa a
tipografia e as cores do app como estão. Hierarquia: conteúdo > navegação > estado.

- **Cabeçalho de uma linha.**
  - Some o "Organização pessoal".
  - O título cai de 31–43 px para 17 px/800. A data (13 px, `--muted`) fica na mesma linha flexível, alinhada pela
    linha de base.
  - Os três botões ficam fantasmas: 46×46, sem borda nem fundo, ícone em `--accent`. A linha mede 46 px (a altura dos
    botões).
- **Progresso como fio.** O cartão de 4 linhas vira uma barra de 3 px com `1/8` à direita, em 12 px `--muted`.
- **Navegação em texto.**
  - Abas: texto de 13 px sobre um fio de 1 px `--line`. A aba ativa ganha cor `--text` e sublinhado de 2 px `--accent`.
  - Filtros: texto `--muted`. O filtro ativo ganha `--accent` e sublinhado de 2 px. "Atrasadas" segue em `--danger`
    ativo ou não, como hoje.
- **Conteúdo sem moldura.**
  - `.view-shell`, `.toolbar` e `.list-header` perdem borda, fundo, raio e sombra.
  - Linhas e calendário encostam na calha de 16 px. Só ficam as linhas finas que separam tarefas e grupos.
- **FAB só com o "+".** Círculo de 56 px. O texto "Nova tarefa" continua no DOM.

Efeito medido: o conteúdo da vista (`#viewContent`) começa em **256,4 px** no 17 Pro Max e **241,4 px** no iPhone 13. Na
tela atual começa em 510,2 e 523,9: são 253,8 e 282,5 px a mais de conteúdo na primeira tela.
- A direção de arte falava em "cerca de 170 px". Esse número bate com o início das abas: 160,4 no 17 Pro Max e 145,4 no
  13.
- Abaixo das abas ainda vêm os filtros (50 px), que a regra manda manter na tela de início.

### Onde me afastei da direção de arte (e por quê)

1. **`.task-card` mantém `padding:12px 5px`.** A regra pedia `12px 0`, que testei primeiro.
   - `.check` e `.task-reschedule` têm margem lateral de −5 px, e o `.task-swipe` tem `overflow:hidden`.
   - Com padding lateral 0, a área de toque recortada medida caiu para **39×44** (8 de 8 caixas no Dia).
   - Com 5 px, ela volta a 44×44 (8/8 no Dia e 60/60 na Lista).
   - Para as linhas ainda encostarem na calha, zerei o recuo de 10 px que só existia por causa da moldura:
     `.day-content{padding:4px 0}` e `.list-body{padding:0 0 9px}`. Essas duas regras não estavam na lista.
   - Resultado: cabeçalho da lista, título do grupo, setas do Dia e separadores começam todos em x = 16.
2. **Estado ligado dos botões fantasmas.**
   - Sem borda, o `#seqTimerBtn.seq-active` (Sequência aberta) e o `#parceiroBtn.on` perderiam o único sinal de estado.
   - Eles ganham um fundo leve, `color-mix(--accent 14%)`.
   - A borda de estado que `sequencial.js:20` e `parceiro.js:74` pintam com seletor de id é anulada com seletor de id sob o
     prefixo.
3. **Exceções da regra do cartão opaco.**
   - `.task-swipe .task-card{background:var(--bg)}` atropelaria o `--surface` dos cartões da Sequência (`.seq-row`) e o
     `--soft` dos lembretes (`.lembrete-card`).
   - As duas cores voltam com regras próprias sob o prefixo. Medido: lembrete `rgb(21,21,26)` = `--soft`, com padding
     esquerdo de 14 px; cartão da Sequência `rgb(12,12,15)` = `--surface`.
4. **Vista Sequência coerente.** Fora da lista, mas é uma aba da tela de início.
   - `.seq-progress-wrap` e `.seq-timeline` perdem o fundo `--soft`.
   - A barra própria e a coluna dos cartões passam a ocupar a largura toda (`padding` lateral 0 à direita).
   - Os cartões da linha do tempo mantêm borda e fundo.
5. **Sublinhado em propriedades separadas.** Uso `text-decoration-line`, `-thickness` e `text-underline-offset` em vez do
   atalho `text-decoration:underline 2px`: o Safari não aceita a espessura dentro do atalho e descartaria a declaração.
6. **Título e data na "mesma linha"** é uma linha flexível com quebra.
   - Hoje, "Minha agenda" (114,8) + 8 + "Sábado, 17 De Outubro" (137,8) = 260,6 px, e a coluna tem 258 no 17 Pro Max e 208
     no 13. Então a data desce para a segunda linha nos dois iPhones.
   - Não custa altura: a linha do cabeçalho mede 46 px de qualquer jeito (altura dos botões).
   - Em tela larga (1024 px) fica tudo numa linha só (captura `essencial-work/largo-mes.png`).

## O que mudou de lugar e onde está cada função

| Função | Hoje | Na variante | Medida (17 Pro Max / 13) |
|---|---|---|---|
| Título e data | eyebrow + h1 de 31–43 px + data abaixo | h1 de 17 px e data de 13 px na mesma linha flexível (a data quebra para baixo quando não cabe) | cabeçalho 80..126 / 65..111 |
| "Organização pessoal" | eyebrow acima do título | **some** | — |
| Modo sequencial | botão largo `#seqEntryBtn` + aba + cronômetro | **o botão largo some** (`display:none`); ficam a aba Sequência (`#viewTabs [data-view="sequencia"]`) e o `#seqTimerBtn` no cabeçalho, que chamam o mesmo `goToSequencia` (`sequencial.js:30`) | aba 102×44 / 89,5×44; cronômetro 46×46; clique no cronômetro ativou a aba (medido `true`) |
| Agenda do parceiro | `#parceiroBtn` com moldura | `#parceiroBtn` fantasma | 46×46 |
| Menu (Agenda, Financeiro, Marketplace, Gamificação, Alertas, Modo claro, Equipamentos, Atualizar, Compartilhadas) | `#moreMenuBtn` → `#quickMenu` | igual, botão fantasma; o menu não foi tocado | 46×46; vista "menu" com 0 alvos < 44 |
| Progresso do dia | cartão com rótulo "Progresso diário · 17/10", 1/8 grande, barra de 9 px e frase "13% …" | fio de 3 px à esquerda de `#progressText` (12 px `--muted`). **Somem** `.summary-label` e `.summary-message`. A seção mantém `aria-label="Progresso diário"` | linha 136..150,4 / 121..135,4; barra 380,3 × 3 |
| Dia / Mês / Lista / Sequência | segmentado com pílula deslizante | abas de texto com sublinhado; `.view-tabs::before` (pílula) desligada | 4 abas de 44 de altura; topo em 160,4 / 145,4 |
| Filtros Todas / Atrasadas / Concluídas / Trabalho | 4 pílulas com borda e fundo | 4 textos; o ativo em `--accent` sublinhado; "Atrasadas" em `--danger` | menor chip 60,7×44; linha 206,4..256,4 / 191,4..241,4 |
| Nova tarefa | `#openDialog` "+ Nova tarefa" | círculo de 56 px só com o "+" (`font-size:0` no botão e 30 px no `.plus`); o nome no DOM segue "+ Nova tarefa" e o clique abriu `#taskDialog` (medido) | 56×56 |
| Registrar cardio | `#cardioFab` com borda e sombra | mesmo lugar, sem borda nem sombra, fundo `--surface` | 48×48 |
| Jarvis | `#jarvis-btn` | intocado | 56×56 |
| Atualizar o app | `#app-update` + versão | mesmo lugar, `#app-ver` com opacidade 0,55; também segue no menu (`#atualizarBtn`) | 44×44 |
| Calendário, lista e dia | dentro de cartão com borda e sombra | sem moldura; `.nav-btn` (44), `.check` (44) e `.task-reschedule` (44) do mesmo tamanho | ver tabela de medidas |

Nenhuma função saiu da tela de início. Só três textos somem: o eyebrow, o rótulo e a frase do progresso. O botão largo
"Modo sequencial" também sai, mas a função dele segue em dois lugares: a aba e o cronômetro.

## Medidas

Harness `medir.cjs` com a área segura emulada por CDP (62/34 e 47/34), folha injetada por `addStyleTag` e
`dataset.home = 'essencial'`. O tema claro foi ligado com `dataset.theme = 'light'`. Rolagem 0.

| perfil | vista | tema | scrollWidth | sob a ilha | fixos sob o indicador | alvos < 44 fora do nível B | nível B (28 px) | transbordando | erros de JS |
|---|---|---|---|---|---|---|---|---|---|
| iphone17promax | mes | escuro | 440/440 | 0 | 0 | 0 | 0 | 0 | 0 |
| iphone17promax | dia | escuro | 440/440 | 0 | 0 | 0 | 16 | 0 | 0 |
| iphone17promax | lista | escuro | 440/440 | 0 | 0 | 0 | 130 | 0 | 0 |
| iphone17promax | menu | escuro | 440/440 | 0 | 0 | 0 | 0 | 0 | 0 |
| iphone17promax | mes | claro | 440/440 | 0 | 0 | 0 | 0 | 0 | 0 |
| iphone17promax | dia | claro | 440/440 | 0 | 0 | 0 | 16 | 0 | 0 |
| iphone17promax | lista | claro | 440/440 | 0 | 0 | 0 | 130 | 0 | 0 |
| iphone17promax | menu | claro | 440/440 | 0 | 0 | 0 | 0 | 0 | 0 |
| iphone13 | mes | escuro | 390/390 | 0 | 0 | 0 | 0 | 0 | 0 |
| iphone13 | dia | escuro | 390/390 | 0 | 0 | 0 | 16 | 0 | 0 |
| iphone13 | lista | escuro | 390/390 | 0 | 0 | 0 | 130 | 0 | 0 |
| iphone13 | menu | escuro | 390/390 | 0 | 0 | 0 | 0 | 0 | 0 |
| iphone13 | mes | claro | 390/390 | 0 | 0 | 0 | 0 | 0 | 0 |
| iphone13 | dia | claro | 390/390 | 0 | 0 | 0 | 16 | 0 | 0 |
| iphone13 | lista | claro | 390/390 | 0 | 0 | 0 | 130 | 0 | 0 |
| iphone13 | menu | claro | 390/390 | 0 | 0 | 0 | 0 | 0 | 0 |

- **Nível B:** são só `.notas-toggle`, `.agenda-share`, `.tr-open` e `.list-previous`, com 28 px visíveis e a faixa
  `::before` da missão anterior. A tela atual mostra os mesmos tipos nas mesmas vistas.
- **Véu `body::before`:** 62 px / 47 px, cor = `--bg` do body nos dois temas.
- **Cabeçalho:** o topo do conteúdo fica em 80 / 65, abaixo da ilha (62 / 47).
- **Alvos recortados** (menor caixa depois do recorte pelos ancestrais com overflow):
  - `.check` 44×44 e `.task-reschedule` 44×44;
  - `.nav-btn` 44×44, `.chip` 60,7×44 e `.view-tab` 102 / 89,5 × 44;
  - botões do cabeçalho 46×46, FAB 56×56, cardio 48×48, Jarvis 56×56 e `#app-update` 44×44.
- **Sem o atributo, nada muda.** Com a folha carregada e sem `data-home`, comparei caixa, cor, fundo, borda, display e
  fonte de todos os elementos de `.app`, `#agendaActions` e `#app-ver`: **idêntico** no Mês (342 elementos), no Dia (395)
  e na Lista (1954).
- **Deslizar para editar/apagar:**
  - Em repouso, `elementFromPoint` no meio do trilho devolve o cartão, não o trilho: o cartão opaco cobre.
  - Com `.is-swiped`, o centro do `.task-trash` devolve o próprio botão.
- **Filtro "Atrasadas" ativo:** cor `--danger` (`rgb(255,156,156)` no escuro, `rgb(186,62,62)` no claro), sublinhado,
  fundo transparente.
- **Sequência (17 Pro Max, escuro):** scrollWidth 440, 0 sob a ilha, só nível B abaixo de 44, `#seqEntryBtn`
  `display:none`, cronômetro ativo com fundo `color(srgb .459 .796 1 / .14)` e sem borda.
- **Tela larga (1024×800):** scrollWidth 1024, 0 erros. O único alvo < 44 fora do nível B é o `#viewmode-btn` (94,5×31),
  que só existe em tela larga e é o mesmo de hoje.
- **Erros de JS:** 0 em todas as rodadas do harness.

### Teste completo `layout.cjs` com a variante ligada

Rodei o teste completo duas vezes, nas mesmas condições.
- **Variante:** `essencial-work/layout-com-variante.cjs`. A folha e o `data-home` entram por `addInitScript` em toda carga
  de `/` e `/index.html`.
- **Padrão:** o `layout.cjs` puro.
- **Condições comuns:** `LAYOUT_SUITES` aponta para uma pasta vazia, para não rodar de novo as 9 suítes E2E de voz e Jarvis,
  que não dependem de CSS. Saídas e JSON ficam no scratchpad; nada no repositório foi gravado.

| rodada | total | ok | FALHOU |
|---|---|---|---|
| padrão (sem variante) | 432 | 415 | 17 |
| variante `essencial` | 432 | 401 | 31 |

- **As 17 do padrão aparecem também na variante:**
  - 9 suítes "não encontradas" e o P5, por causa da pasta vazia de propósito.
  - 7 do **marketplace**: `marketplace/index.html` foi regerado pelos commits automáticos "Marketplace: Novos
    anúncios" (`a4d6587` e anteriores) depois da missão de layout e perdeu os trechos dela.
  - Essas falhas já existem no padrão e não têm relação com a variante. Avisar o maestro: hoje o padrão não passa mais
    431/431 por causa do marketplace.
- **As 14 que só falham com a variante** são todas medidas fixadas no layout padrão, que a variante muda de propósito:
  - `#seqEntryBtn` ausente: 3 verificações (S6.3 nos 2 perfis + S6.9).
  - Altura de `#viewTabs`: 44 contra 54. Altura de `#filters`: 50 contra 60. Altura da `.toolbar` do Mês: 56 contra 62.
  - Topo da primeira célula do calendário: 336,4 contra 598 e 321,4 contra 612. É o ganho de espaço.
  - Largura da célula: 54,8 contra 52,6 e 47,7 contra 46. Largura do `.task-main`: 318 contra 296 e 268 contra 246.
    É a moldura que saiu.
  - `S6.7.*.lista.rolado`: com a lista rolada 400 px, o ponto (220,31) é o body e **todos** os interativos sob a faixa
    estão cobertos pelo véu (8 de 8 e 7 de 7). Só a contagem esperada (7 e 3), tirada do layout padrão, difere.
- **Garantias que passaram com a variante** (S6.1, S6.2, nível B, paisagem e S6.5.erros):
  - sem rolagem lateral, nem bruta;
  - 0 interativos sob a ilha e 0 fixos sob o indicador, com folga ≥ 8;
  - véu com estilo certo;
  - zonas de nível B ≥ 43,5;
  - paisagem (14 ok, 0 falhas);
  - 0 erros de JS nas vistas.

## Riscos

1. **Progresso sem data.**
   - O rótulo "Progresso diário · 17/10" some, mas `renderSummary` (`index.html:233`) mostra o progresso do **dia
     selecionado**.
   - Ao tocar outro dia no Mês ou andar no Dia, o fio passa a mostrar aquele dia sem dizer qual. No Dia, a data está na
     barra logo abaixo; no Mês, não.
   - A frase "13% …" também sai: a porcentagem fica só implícita na barra.
2. **Menos cara de botão.**
   - Abas e filtros viraram texto. Continuam com 44 px de altura e o estado ativo é claro (cor + sublinhado), mas um toque
     novo pode parecer menos óbvio.
   - "Atrasadas" em vermelho mesmo inativa pode ser lida como ativa. Isso é igual a hoje, mas agora sem a pílula para
     diferenciar.
3. **FAB só com "+".**
   - O nome acessível continua "+ Nova tarefa", vindo do texto no DOM, mas o rótulo visível some.
   - Quem conhece o app não perde nada; quem não conhece vê só o sinal.
4. **Cardio sem borda no tema claro.** Quadrado branco (`--surface` #fff) sobre `--bg` #f4f6fa, sem sombra: o contorno do
   botão quase some e só o ícone em `--accent` marca o alvo.
5. **`#app-ver` a 0,55.**
   - O botão de atualizar fica mais apagado, sobretudo no claro.
   - O texto da versão já é `rgba(255,255,255,.3)` hoje e não aparece no tema claro (não é desta variante).
6. **Dependência de `!important` de `header-cleanup.js`.**
   - `align-items:center` da `.topbar` e `gap:0` da `.head-actions` vencem os `!important` de `header-cleanup.js:17` e
     `:19` por terem especificidade maior.
   - Se aquele script mudar os seletores, recheque.
7. **`display:contents` na `.summary-top`.** No Safari antigo (< 16) isso tirava filhos da árvore de acessibilidade. O alvo
   é o iPhone 17 Pro Max, com iOS recente, então o risco é baixo; o `#progressText` continua no DOM.
8. **Problema que já existia e aparece mais na vista Sequência (não é desta variante).**
   - O trilho amarelo/vermelho de editar/apagar aparece nos cantos arredondados dos cartões e através dos concluídos
     (`opacity:.6`).
   - Está igual na tela atual: captura `essencial-work/sequencia-17pm-escuro-ATUAL.png`.
   - Não corrigi: fora do escopo de uma variante.
9. **Não testado:**
   - Safari/iOS de verdade: tudo foi no Chromium 141 com a área segura emulada.
   - Paisagem com a variante: só o que o `layout.cjs` cobre.
   - Uma data com nome de dia longo, como "Quarta-Feira, 30 De Setembro": a data quebra para a segunda linha, como já
     acontece com "Sábado".

## Refino (rodada 2)

- Arquivo: `/home/user/agenda-iphone/estilos-inicio/essencial.css`, agora 89 linhas. Toda regra continua com
  `html[data-home="essencial"]` (grep: 0 linhas com `{` sem o prefixo).
- As 16 capturas foram refeitas por cima, com os mesmos nomes, em
  `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/inicio/essencial/`.
  Medidas brutas: `.../scratchpad/inicio/essencial-medidas.json`.
- Script novo da rodada, com uma verificação por ajuste nos 2 perfis × 2 temas: `.../scratchpad/essencial-work/refino.cjs`.
  - Saída em `.../essencial-work/refino/refino.json`.
  - Recortes de evidência na mesma pasta: `<perfil>-atrasadas-ativa-<tema>.png`, `<perfil>-cabecalho-dia-<tema>.png` e
    `<perfil>-outro-dia-mes-<tema>.png`.

### Ajustes do juiz

1. **Data sem o "De" maiúsculo: aplicado.**
   - CSS: `.subhead{text-transform:none}` e `.subhead::first-letter{text-transform:uppercase}`.
   - Medido nos 4 casos: o `textContent` vem do JS como "sábado, 17 de outubro" e o `innerText` renderizado é
     **"Sábado, 17 de outubro"**. Não contém " De ". `text-transform` = `none`; o `::first-letter` = `uppercase`.
   - O `::first-letter` funciona porque o `#currentDate` é item de um contêiner flex, e por isso vira bloco.
2. **Rótulo "Progresso diário · 17/10" de volta, à esquerda do fio: aplicado.**
   - CSS: `.summary-label{display:block;order:-2;font-size:12px;font-weight:650;color:var(--muted);white-space:nowrap}`.
     O `.summary-message` continua `display:none`.
   - Altura da `.summary`: **15 px** nos 4 casos (136..151 no 17 Pro Max, 121..136 no 13). Pedido: ≤ 16. Antes: 14,4.
   - Largura da `.progress`: **238,3 px** no 17 Pro Max e **188,3** no 13, com "1/8". Pedido: ≥ 180 no 17 Pro Max.
     - Com outro dia escolhido ("· 04/10" e "0/0"): 231,1 e 181,1.
   - Rótulo em x = 16, 132 px de largura, 12 px, cor = `--muted` (`rgb(175,176,184)` no escuro, `rgb(101,112,128)` no claro).
   - O rótulo acompanha o dia: tocar o dia 4 no Mês muda para "Progresso diário · 04/10" e "0/0". Voltando ao Mês, o fio
     continua dizendo 04/10 (captura `refino/iphone17promax-outro-dia-mes-escuro.png`). Voltando a hoje, volta "· 17/10".
   - Isso resolve o risco 1 da primeira rodada (progresso sem data).
3. **Título em 20 px: aplicado.**
   - `h1` medido em 20 px, caixa 135,1 × 24.
   - `.topbar` continua **46 px** (80..126 no 17 Pro Max, 65..111 no 13), presa à altura dos botões.
   - Efeito colateral: o conteúdo da vista desce 0,6 px (256,4 → **257** no 17 Pro Max e 241,4 → **242** no 13), por causa
     do 0,6 px a mais na `.summary`. São 195 px abaixo da área segura; hoje são 448.
   - A data continua na segunda linha. Ela não cabe ao lado do título em 258 / 208 px, como já acontecia em 17 px.
4. **`.nav-btn` fantasma: aplicado.**
   - CSS: `.nav-btn{border:0;background:transparent;color:var(--accent)}`.
   - Medido no Mês (`#calFullBtn`, o expandir) e no Dia ("Dia anterior" e "Próximo dia"), nos 4 casos: **44×44** depois
     do recorte, `border-top-width` 0, fundo `rgba(0,0,0,0)` e cor = `--accent` (`rgb(117,203,255)` no escuro,
     `rgb(20,127,183)` no claro).
   - `.nav-btn` só existe nas barras do `#viewContent` (grep em `index.html` e `*.js`). Diálogos e menu não são afetados.
   - O botão "Hoje" (`.today-btn`, com borda) não aparece: a função `toolbar()` que o desenharia não é chamada em
     `index.html`. Então nenhum controle com moldura sobra nas barras do Mês e do Dia.
5. **"Atrasadas" vermelha só quando ativa: aplicado.**
   - A regra `.chip.chip-late` virou `.chip.chip-late:not(.active){border-color:transparent;color:var(--muted)}`.
     A `.chip.chip-late.active` continua com `--danger` e sublinhado.
   - Inativa: cor = `--muted` (`rgb(175,176,184)` / `rgb(101,112,128)`), sem sublinhado.
   - Ativa, depois do clique: `rgb(255,156,156)` / `rgb(186,62,62)` = `--danger`, sublinhado, fundo transparente.
   - Medido nos 4 casos. Captura: `refino/iphone13-atrasadas-ativa-claro.png`.
6. **Contorno no `#cardioFab`: aplicado.**
   - CSS: `#cardioFab{border:1px solid var(--line);background:var(--surface);box-shadow:none}`. Só a sombra sai.
   - `border-top-width` **1 px**, cor `rgb(46,46,54)` no escuro e `rgb(223,229,237)` no claro, sombra `none`.
   - Caixa continua **48×48**, porque o `box-sizing` é `border-box`.
7. **`#app-ver` opaco no claro: aplicado.**
   - CSS: `html[data-home="essencial"][data-theme="light"] #app-ver{opacity:1}`.
   - Opacidade medida: **0,55 no escuro e 1 no claro**, nos 2 perfis.
   - `#app-update` continua 44×44.
   - O texto da versão (`rgba(255,255,255,.3)`) segue invisível no claro. É assim no padrão e não é desta variante.
8. **Manter `#seqEntryBtn{display:none}` e o padding `12px 5px` do `.task-card`: mantido, sem mudança.**
   - `#seqEntryBtn` medido `display:none`.
   - O cronômetro do cabeçalho leva à aba Sequência (clique medido: `true`).
   - `.check` e `.task-reschedule` continuam 44×44 depois do recorte.

Nenhum ajuste conflitou com uma garantia.

### Medidas da rodada 2 (16 capturas)

Mesmo harness e mesmas condições da primeira rodada.

| perfil | vista | tema | scrollWidth | sob a ilha | fixos sob o indicador | alvos < 44 fora do nível B | nível B (28 px) | erros de JS |
|---|---|---|---|---|---|---|---|---|
| iphone17promax | mes | escuro / claro | 440/440 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| iphone17promax | dia | escuro / claro | 440/440 | 0 / 0 | 0 / 0 | 0 / 0 | 16 / 16 | 0 / 0 |
| iphone17promax | lista | escuro / claro | 440/440 | 0 / 0 | 0 / 0 | 0 / 0 | 130 / 130 | 0 / 0 |
| iphone17promax | menu | escuro / claro | 440/440 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| iphone13 | mes | escuro / claro | 390/390 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |
| iphone13 | dia | escuro / claro | 390/390 | 0 / 0 | 0 / 0 | 0 / 0 | 16 / 16 | 0 / 0 |
| iphone13 | lista | escuro / claro | 390/390 | 0 / 0 | 0 / 0 | 0 / 0 | 130 / 130 | 0 / 0 |
| iphone13 | menu | escuro / claro | 390/390 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 | 0 / 0 |

- **Nível B:** só `.notas-toggle`, `.agenda-share`, `.tr-open` e `.list-previous`, os mesmos da primeira rodada.
- **Véu:** 62 / 47 px.
- **Caixas recortadas:** chip 60,7×44; `.nav-btn` 44×44; `.check` e `.task-reschedule` 44×44; cardio 48×48; `#app-update`
  44×44.
- **Sanidade (`sanidade.cjs`):**
  - Sem `data-home`, com a folha carregada: **idêntico** no Mês (342 elementos), no Dia (395) e na Lista (1954).
  - Trilho de apagar coberto em repouso e visível com `.is-swiped`.
  - Cartão da Sequência = `--surface`.
  - `#seqEntryBtn` `display:none`; o cronômetro leva à Sequência.
  - FAB "+ Nova tarefa" abre `#taskDialog`.
  - 0 erros.
- **Lembrete (`lembrete.cjs`):** fundo `rgb(21,21,26)` = `--soft`.
- **Tela larga (1024 px):** scrollWidth 1024 e 0 erros. Só o `#viewmode-btn` (94,5×31) fica abaixo de 44 fora do nível B,
  como hoje.

### Teste completo `layout.cjs` com a variante, rodado de novo

- Resultado: 432 verificações, 401 ok e 31 FALHOU.
- São **as mesmas 31 da primeira rodada**: `diff` dos ids sem nenhuma diferença.
- Só mudou o valor do topo da primeira célula do calendário: 337 contra 598 no 17 Pro Max e 322 contra 612 no 13. Antes
  eram 336,4 e 321,4: é o 0,6 px a mais da `.summary`.
- Nenhuma garantia nova falhou: S6.1, S6.2, nível B, paisagem e erros continuam ok.

### Riscos que mudam com o refino

- **Riscos 1, 2 (Atrasadas), 4 e 5 da primeira rodada:** resolvidos pelos ajustes 2, 5, 6 e 7.
- **Rótulo + número de dois dígitos no iPhone 13:**
  - Com "Progresso diário · 04/10" e um placar como "12/15", o fio deve ficar perto de 170 px. É uma estimativa, não foi
    medido.
  - Continua uma barra legível; o mínimo de 180 do juiz era para o 17 Pro Max, onde sobram cerca de 220.
- **Atrasadas inativa em `--muted`:** perde-se o aviso vermelho de que existe a categoria. É a decisão do juiz; o filtro
  ativo segue em `--danger`.
