# Designer: variante `zen` ("Zen tipográfico")

> Rodada de refino feita: a seção **Refino**, no fim, substitui os números e decisões abaixo onde eles divergem
> (título, "Modo sequencial", espaçamentos, cartões, atrasada no Mês, aba ativa).

- Arquivo: `/home/user/agenda-iphone/estilos-inicio/zen.css`, 121 linhas, 64 regras.
  - Os 71 seletores começam com `html[data-home="zen"]`. Conferido com um script que tira os comentários e separa
    os seletores por vírgula: 0 sem o prefixo.
- Capturas (16): `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/inicio/zen/<perfil>-<vista>-<tema>.png`.
- Medidas brutas do `h.medir`: `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/inicio/zen-medidas.json`.
- Scripts e medições auxiliares: `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/zen-work/`.
  - `rodar.cjs`: capturas e `h.medir`.
  - `verificar.cjs` → `verificar.json`: toque, contraste, cliques.
  - `comparar.cjs` → `comparar.json`: padrão × zen e tela larga.
  - `semattr.cjs` → `semattr.json`: sem o atributo, nada muda.
  - `layout-com-zen.cjs`: teste completo com a variante injetada. Saídas `saida-layout-zen.txt` e `saida-layout-atual.txt`.
- Emulação: CDP, área segura medida 62/34 (17 Pro Max) e 47/34 (13). O Chromium daqui desenha `-apple-system` com a
  fonte Inter (`fc-match`).

## Decisão de design

A tela vira uma página de texto. Nada tem caixa: as seções se separam por espaço e, quando precisa, por um fio de 1 px.
Hierarquia só pela tipografia: tamanho, peso (500/600 em vez de 800) e três tons (`--text`, `--muted` e um tom
"baixo").

- **Margens de 28 px.** Coluna interna de 384 px no 17 Pro Max e 334 no 13 (medido). O conteúdo começa 30 px abaixo
  da área segura (`padding-top` 92 e 77).
- **Título grande e calmo.**
  - O "Organização pessoal" some.
  - "Minha agenda" fica em 41,8 px/500 no 17 Pro Max e 37,05 px no 13.
  - A data aparece como o sistema escreve, em minúsculas: "sábado, 17 de outubro", 15 px `--muted`.
  - Os três botões do cabeçalho ficam fantasmas, em `--muted` e 46×46.
- **Progresso em uma linha de texto.**
  - Linha "Progresso diário · 17/10 1/8" em 14 px, um fio de 1 px com o trecho concluído em `--accent`, e a frase
    embaixo em 13 px.
  - O cartão cai de 123 para 56 px de altura.
- **Navegação em maiúsculas pequenas.**
  - Abas DIA / MÊS / LISTA / SEQUÊNCIA em 11 px, tracking .18em. O primeiro rótulo começa na margem esquerda (x = 28)
    e o último termina na direita (x = 412 no 17 Pro Max e 362 no 13). A ativa fica em `--text`; as outras no tom baixo.
  - Embaixo, centrado, o link MODO SEQUENCIAL, no mesmo estilo.
  - Depois, os filtros em texto de 13 px. O ativo é sublinhado (1 px, afastado 6 px) e "Atrasadas" segue em
    `--danger`.
- **Conteúdo solto na página.**
  - `.view-shell`, `.toolbar` e `.list-header` sem borda, fundo nem sombra. Título da barra em 20 px/600.
  - Cartões com mais ar: 18 px em cima e embaixo, título de 16 px/500. Etiqueta como bolinha + nome em 11 px,
    sem pílula.
- **Mês em pontos.**
  - A célula cai de 91 para 60 px de altura. Número centrado (26 px de círculo) e, embaixo, até duas bolinhas de 6 px na
    cor da etiqueta, mais o "+N".
  - Resultado: das 42 células, 35 inteiras na primeira tela do 17 Pro Max (eram 21) e 28 no 13 (eram 14).
- **Flutuantes discretos.**
  - O "+ Nova tarefa" vira um círculo contornado de 56 px só com o "+".
  - O cardio perde a sombra.
  - A versão/atualizar fica em opacidade .45.
  - O Jarvis não foi tocado.

### Onde me afastei da direção de arte (e por quê)

1. **`.task-card` com padding lateral de 5 px, não 0.** Fica em `18px 5px`.
   - Com 0, o `.check` e o `.task-reschedule`, que têm margem de −5 px, são recortados pelo `overflow:hidden` do
     `.task-swipe`.
   - Varredura com `elementFromPoint` a cada 0,25 px na altura do centro: zona de toque horizontal de **39,8 px** com
     0 e **44,8 px** com 5. Os dois perfis deram o mesmo.
2. **Abas com `flex:0 0 auto`, não `1 1 auto`.**
   - A regra pedia `justify-content:space-between` e `flex:1 1 auto` juntos. Com crescimento, o space-between não tem
     efeito. Medido com `flex:1 1 auto` (`zen-work/abas-v1.cjs`): os rótulos ocupavam x = 53,8..386,2 no 17 Pro Max
     (25,8 px para dentro de cada margem) e 47,5..342,5 no 13 (19,5 px).
   - Usei `flex:0 0 auto` com `padding:0 10px`, e margem de −10 px no primeiro e no último. Os rótulos ficam com vãos
     iguais e alinhados às margens de 28 px.
   - Medidas no 17 Pro Max: abas de 44,9 / 49,9 / 60,6 / 102,4 × 44.
   - Pelo mesmo motivo, o "Todas" (44 de largura mínima, texto mais estreito) ganhou `text-align:left`.
3. **Tom baixo no tema claro.** Criei `--zen-quiet`: `--faint` no escuro e `--muted` no claro. Vale para abas e filtros
   inativos, o link do modo sequencial, a frase do progresso e os dias da semana. Contraste medido sobre `--bg`:
   - `--faint` no escuro: 4,97:1;
   - `--faint` no claro seria 2,87:1 (calculado com as cores computadas);
   - `--muted` no claro: 4,64:1.
4. **Mês sem caixa nos dias.**
   - A regra só tirava as etiquetas. O fundo `--soft` com borda de cada `.calendar-day.current` continuaria a
     desenhar 35 caixinhas, contra o conceito "nenhuma caixa". Saem a borda e o fundo.
   - Número e pontos foram centrados sob o dia da semana.
   - Ficam o círculo de hoje e a moldura do selecionado: `--accent`, com fundo de 12 %.
   - A bolinha de atrasada passa a 6 px, colada no canto do número (`left:calc(50% + 9px)`), com anel `--bg`.
   - `.week-labels` em tom baixo, peso 600 e o mesmo `gap:2px` da grade, para as colunas baterem.
5. **Alinhamento à margem.** `.day-content{padding:0}` e `.list-body{padding:0 0 9px}`. Os recuos de 10 px só
   existiam por causa da moldura.
6. **Rodapé do cartão sem caixa.**
   - `.notas-toggle`, `.agenda-share` e `.tr-open` (Detalhes, Compartilhar, Abrir treino) ficam só com
     `border-color:transparent` e fundo transparente.
   - Tamanho e faixa de toque `::before` (nível B) não mudam: continuam 93,3×28, 98,6×28, 88,7×28 e 86,3×28.
   - A regra não mexe na cor. O `.notas-toggle.has` (tarefa com nota) continua em `--accent` pela regra do
     `notas.js`; perde só a borda e o fundo.
7. **`.task-footer{row-gap:16px}`.**
   - Com a coluna 10 px mais estreita, o rodapé quebra em mais cartões.
   - Na 1ª rodada do teste completo, `S6.3.13.atrasadas.B.pares` falhou: as faixas de toque do `.notas-toggle.has` e do
     `.agenda-share` de linhas vizinhas se sobrepunham em 6,1×10 px.
   - 16 px é o vão que o app já usa com `.tr-open`. Na 2ª rodada passou nos dois perfis: 0 pares sobrepostos.
8. **Cores próprias preservadas.**
   - `.task-swipe .task-card{background:var(--bg)}`, opaco para cobrir o trilho de editar/apagar, apagaria o
     `--surface` dos cartões da Sequência e o `--soft` dos lembretes. As duas cores voltam com regra própria.
   - Na Sequência, `.seq-progress-wrap` e `.seq-timeline` perdem o painel `--soft`.
9. **`#seqEntryBtn` sem `display`.** `.seq-entry-btn` já é flex. Um `display:flex` com seletor de id venceria o
   `.seq-entry-btn[hidden]{display:none}` (`sequencial.js:24`). Na aba Sequência o link fica `hidden=true` e
   `display:none` (medido).

## O que mudou de lugar e onde está cada função

Medidas no 17 Pro Max / iPhone 13, rolagem 0, tema escuro.

| Função | Hoje | Na variante | Medida (17 Pro Max / 13) |
|---|---|---|---|
| Título e data | eyebrow + h1 de 31–43 px numa linha + data capitalizada | h1 de 41,8 / 37,05 px, peso 500, em **duas linhas** ("Minha / agenda"); data em minúsculas, 15 px | cabeçalho 92..204,6 / 77..180,1; h1 83,6 / 74,1 de altura |
| "Organização pessoal" | eyebrow | **some** | — |
| Cronômetro, parceiro, menu | `.head-actions` com moldura | mesmo lugar, fantasmas em `--muted`. Estado ligado em `--accent`: o seletor de id de `sequencial.js`/`parceiro.js` vence | 3 × 46×46, borda 0; cronômetro ativo `rgb(117,203,255)` |
| Menu (`#quickMenu`) e seus itens | `#moreMenuBtn` | igual, menu intocado | vista "menu": 0 alvos < 44 |
| Progresso do dia | cartão de 123 px: número de 30 px e barra de 9 px | linha de texto 14 px ("Progresso diário · 17/10 1/8") + fio de 1 px + frase de 13 px | 238,6..294,6 (56 px) / 56 px; fio 384×1 |
| Dia / Mês / Lista / Sequência | segmentado com pílula deslizante | 4 rótulos em maiúsculas 11 px, vãos iguais, pontas nas margens; pílula desligada | abas de 44 de altura; topo 324,6 / 300,1 |
| Modo sequencial | botão largo tracejado | **muda de lugar**: link de texto centrado entre as abas e os filtros; a aba Sequência e o `#seqTimerBtn` seguem iguais | 184,3×44, centro em x = 220 / 195; o clique abriu a Sequência (medido) |
| Filtros | 4 pílulas | 4 textos 13 px; ativo sublinhado; Atrasadas em `--danger` | 44×44, 63,6×44, 70,5×44, 55,3×44 |
| Barra do Mês/Dia | faixa `--soft` com moldura | sem caixa; título 20 px/600; botões fantasmas | botões 44×44 |
| Abrir um dia no Mês | célula 52,6×91 com etiquetas de texto | célula 53,1×60 / 46×60 com pontos; o nome das etiquetas só na legenda, embaixo do mês | toque no dia 10 abriu a vista Dia em 10/10 (medido) |
| Cartões de tarefa | 12 px vertical, título 14/650, pílula da etiqueta | 18 px vertical, título 16/500, etiqueta como bolinha + texto | altura média na Lista 113,4 → 141,8 / 128,6 → 154,8 |
| Nova tarefa | "+ Nova tarefa" preenchido | círculo contornado de 56 px só com "+" (28 px/300); o texto continua no DOM ("+ Nova tarefa") | 56×56 em 370,804 / 320,692; o clique abriu `#taskDialog` (medido) |
| Registrar cardio | `#cardioFab` com sombra | mesmo lugar, sem sombra, fundo `--bg` | 48×48 |
| Jarvis | `#jarvis-btn` | intocado | 56×56 |
| Atualizar o app | `#app-update` | mesmo lugar, opacidade .45 (também segue no menu) | 44×44, `#app-ver` opacity 0.45 |

Ordem dos blocos: só o `#seqEntryBtn` mudou de aparência e de lugar (centrado). A ordem no DOM é a mesma.

## Medidas

### Garantias, por perfil × vista × tema (`h.medir`, captura com rolagem 0)

| Perfil | Vista | Tema | scrollWidth | Interativos sob a ilha | Fixos sob o indicador | Alvos < 44 fora o nível B | Erros de JS |
|---|---|---|---|---|---|---|---|
| 17 Pro Max | mes | escuro | 440 / 440 | 0 | 0 | 0 | 0 |
| 17 Pro Max | dia | escuro | 440 / 440 | 0 | 0 | 0 (nível B: `.notas-toggle` 93,3×28, `.agenda-share` 98,6×28) | 0 |
| 17 Pro Max | lista | escuro | 440 / 440 | 0 | 0 | 0 (nível B: `.list-previous`, `.notas-toggle`, `.agenda-share`, `.tr-open` ×2, todos com 28 de altura) | 0 |
| 17 Pro Max | menu | escuro | 440 / 440 | 0 | 0 | 0 | 0 |
| 17 Pro Max | mes | claro | 440 / 440 | 0 | 0 | 0 | 0 |
| 17 Pro Max | dia | claro | 440 / 440 | 0 | 0 | 0 (nível B) | 0 |
| 17 Pro Max | lista | claro | 440 / 440 | 0 | 0 | 0 (nível B) | 0 |
| 17 Pro Max | menu | claro | 440 / 440 | 0 | 0 | 0 | 0 |
| iPhone 13 | mes | escuro | 390 / 390 | 0 | 0 | 0 | 0 |
| iPhone 13 | dia | escuro | 390 / 390 | 0 | 0 | 0 (nível B) | 0 |
| iPhone 13 | lista | escuro | 390 / 390 | 0 | 0 | 0 (nível B) | 0 |
| iPhone 13 | menu | escuro | 390 / 390 | 0 | 0 | 0 | 0 |
| iPhone 13 | mes | claro | 390 / 390 | 0 | 0 | 0 | 0 |
| iPhone 13 | dia | claro | 390 / 390 | 0 | 0 | 0 (nível B) | 0 |
| iPhone 13 | lista | claro | 390 / 390 | 0 | 0 | 0 (nível B) | 0 |
| iPhone 13 | menu | claro | 390 / 390 | 0 | 0 | 0 | 0 |

- `transbordando`: 0 elementos em todas as 16 medições. A lista de alvos < 44 é a mesma do padrão: só as pílulas de
  nível B.
- Tela larga, sem área segura: scrollWidth 760/760 e 1024/1024, célula do mês 99×60. Captura em
  `zen-work/largo-1024.png`.

### Sem o atributo nada muda (`semattr.cjs`, 17 Pro Max)

- Método: leio todas as propriedades computadas de todos os elementos (e `::before`/`::after`), carrego `zen.css` sem
  `data-home` e leio de novo.

| Vista | Elementos | Diferenças com a folha | Controle (duas leituras sem a folha) |
|---|---|---|---|
| mes | 563 | 1 | 1 |
| dia | 587 | 0 | 0 |
| lista | 2175 | 0 | 0 |
| menu | 563 | 0 | 0 |

- A única diferença no Mês é o `box-shadow` da animação `pulse` do `#jarvis-btn`, que muda também entre duas leituras
  sem a folha.

### Padrão × zen (`comparar.cjs`, tema escuro, rolagem 0)

| Medida | 17PM padrão | 17PM zen | 13 padrão | 13 zen |
|---|---|---|---|---|
| Altura do cabeçalho | 83,2 (h1 em 1 linha) | 112,6 (2 linhas) | 111,9 (2 linhas) | 103,1 (2 linhas) |
| Altura do progresso | 123 | 56 | 123 | 56 |
| Topo das abas | 326,2 | 324,6 | 339,9 | 300,1 |
| Topo de `#viewContent` | 510,2 | 506,6 | 523,9 | 482,1 |
| Topo da 1ª célula do mês | 598,2 | 590,6 | 611,9 | 566,1 |
| Célula do mês | 52,6×91 | 53,1×60 | 46×78 | 46×60 |
| Células inteiras na 1ª tela (de 42) | 21 | 35 | 14 | 28 |
| Fundo da última célula (viewport 956 / 844) | 1164,2 | 960,6 | 1122,3 | 936,1 |
| 1º cartão do Dia (topo) | 582,2 | 568,6 | 595,9 | 544,1 |
| Cartões inteiros do Dia na 1ª tela | 2 | 2 | 2 | 2 |
| Altura média do cartão (Lista, 60 cartões) | 113,4 | 141,8 | 128,6 | 154,8 |
| Altura da página na Lista | 8356 | 10050 | 9278 | 10807 |

### Contraste sobre `--bg` (cores computadas)

| Texto | Escuro | Claro |
|---|---|---|
| aba inativa, filtro inativo, link Modo sequencial, frase do progresso, dias da semana | 4,97:1 | 4,64:1 |
| aba ativa | 19,21:1 | 15:1 |
| Atrasadas | 10,17:1 | 5,05:1 |
| data, ícones do cabeçalho | 9,43:1 | 4,64:1 |

### Teste completo `layout.cjs` com a variante injetada (`layout-com-zen.cjs`, pasta de suítes E2E vazia)

- **Padrão:** 415 ok, 17 FALHOU.
- **Zen:** 399 ok, 33 FALHOU.
- As 17 falhas do padrão também aparecem na zen, todas fora da tela de início:
  - marketplace (7);
  - 9 suítes E2E não encontradas, porque a pasta de suítes ficou vazia;
  - P5, que depende delas.
- As 16 a mais, só da zen, são critérios de medida do layout padrão que a direção de arte muda de propósito:
  - `S6.4.*.larguraConteudoInterna`: 384 em vez de 408 e 334 em vez de 358 (margens de 28).
  - `S6.4.*.taskMain`: 286 em vez de 296 e 236 em vez de 246.
  - `S6.4.17pm.celulaCalendario`: 53,1 em vez de 52,6.
  - `S6.4.*.celulaCalendarioAltura`: 60.
  - `S6.4.*.calendarTagFont`: 0 px, porque a etiqueta virou ponto.
  - `S6.9.*.celulaTop`: 590,6 em vez de 598 e 566,1 em vez de 612.
  - `S6.9.17pm.viewTabs`: 44 em vez de 54.
  - `S6.9.17pm.filters`: 70 em vez de 60.
  - `P4`: interna 384 em vez de 408.
  - `S6.7.*.lista.rolado`: o véu funciona. O ponto (220,31) é o `body` e estão cobertos 8 de 8 / 6 de 6 (visíveis 5 de 5
    / 4 de 4). O teste exige exatamente 7 / 3 elementos sob a faixa, contagem que muda com a altura do cabeçalho.
- Passam todas as `S6.1`, `S6.2` e `S6.3`: sem rolagem lateral, nada sob a ilha, alvos de 44 e zonas de nível B sem
  sobreposição.

## Riscos

1. **A coluna fica mais estreita, de propósito.** Interna 384 no 17 Pro Max (o padrão usa 408) e 334 no 13 (o padrão
   usa 358).
   - Isso desfaz o critério P4 da missão anterior, "largura extra aproveitada".
   - Títulos longos quebram em mais linhas. A Lista fica 20 % mais comprida no 17 Pro Max (8356 → 10050 px) e 16 % no
     13.
2. **O título quebra em duas linhas nos dois iPhones.** A coluna ao lado dos três botões tem 234 / 184 px, e "Minha
   agenda" em 41,8 / 37 px não cabe.
   - É consequência do tamanho pedido (clamp 34–46). Mantive porque lê como um cabeçalho editorial.
   - Ainda assim, o cabeçalho tem 112,6 px no 17 Pro Max, contra 83,2 no padrão.
3. **"O mês inteiro visível sem rolar" não acontece por pouco.**
   - A última linha (a semana seguinte, esmaecida) termina em 960,6 no 17 Pro Max, contra 956 de viewport, e em 936,1
     no 13 (844).
   - Medido com a fonte Inter do Chromium. No iPhone (SF Pro) a altura das linhas de texto pode variar alguns px.
4. **Etiquetas viram pontos.** O nome da etiqueta sai da célula do mês e fica só na legenda.
   - O ponto "Financeiro" (`#ff7f91`) e a bolinha de atrasada (`#ff453a`) têm matiz parecido. Distinguem-se só pela
     posição: o de atrasada fica no canto do número, as etiquetas embaixo.
   - Etiquetas toda concluídas ficam com opacidade .35 e quase somem no tema claro.
5. **Estado só por cor.** A aba ativa difere das outras só pela cor: 19,2:1 contra 4,97:1 no escuro e 15:1 contra 4,64:1
   no claro. Os filtros têm também o sublinhado. O estado ligado do cronômetro e do parceiro também é só a cor `--accent`.
6. **Rodapé do cartão.**
   - Sem a caixa, "Detalhes" e "Compartilhar" parecem links de texto com ícone.
   - O `row-gap:16px` deixa os cartões com rodapé quebrado 10 px mais altos.
7. **Pré-existente, não causado pela variante.** Na vista Sequência, o trilho amarelo/vermelho de editar/apagar aparece
   na fresta de 3 px acima de cada cartão e através do cartão concluído (opacidade .6). Aparece igual no padrão
   (`zen-work/base-sequencia.png`).
8. **A variável `--zen-quiet` tem só os dois temas.** Ela é definida em `html[data-home="zen"]` e
   `html[data-home="zen"][data-theme="light"]`. Um terceiro tema precisaria do seu valor.
9. **Integração.** A variante depende de `data-home="zen"` estar no `<html>` antes da primeira pintura. Se o seletor o
   puser depois, haverá um salto visível no carregamento. Não testei no Safari/iOS real, só no Chromium com a área segura
   emulada.

## Refino

Rodada de refino a partir da avaliação do juiz (nota 6,5). Só `estilos-inicio/zen.css` mudou. A versão anterior está
salva em `zen-work/zen-antes-refino.css`, e as capturas e medidas anteriores em `zen-work/antes-refino/`.

- Arquivo agora: 129 linhas, 64 regras, 71 seletores, todos com `html[data-home="zen"]` (mesmo script de antes: 0 sem
  o prefixo).
- Scripts novos: `zen-work/refino.cjs` → `zen-work/refino/refino.json` (uma medida por ajuste),
  `zen-work/cartao-exp.cjs` → `refino/cartao-exp.json` (altura do cartão), `zen-work/h1largura.cjs` (largura do
  título) e `zen-work/legenda.cjs`.
- Refeitos com o CSS novo: `rodar.cjs` (16 capturas + `h.medir`), `comparar.cjs`, `verificar-refino.cjs`
  (é o `verificar.cjs` com o clique no link trocado pelo clique na aba Sequência), `semattr.cjs` e o teste completo
  `layout-com-zen.cjs`.

### Cada ajuste

| # | Ajuste pedido | Estado | Evidência (medida) |
|---|---|---|---|
| 1 | `#seqEntryBtn{display:none}` e `#viewContent` ≤ 445 da área segura no 17 Pro Max | **aplicado** | `display:none`, 0×0. `#viewContent` passa de 506,6 para **344,4** no 17 Pro Max, ou seja **282,4** da área segura. No 13 passa de 482,1 para 325,6 (278,6 da área segura). O botão só chama `goToSequencia()`, que clica na aba Sequência (`sequencial.js:28-30`). Continuam na tela o `#seqTimerBtn` (46×46) e a aba Sequência (102,4×44). Clique em cada um: aba ativa = `sequencia` nos dois perfis. |
| 2 | `h1` em `clamp(28px,7.6vw,36px)`, uma linha nos dois iPhones (altura ≤ 40), cabeçalho ≈ 70 | **aplicado, com um complemento** | **17 Pro Max:** 33,44 px, h1 com 33,4 de altura, 1 linha, cabeçalho 62,4 (era 112,6). **iPhone 13:** só com o clamp o título quebrava. A 29,64 px, "Minha agenda" mede 189,7 px e a coluna ao lado dos botões tinha 184 (gap de 12 do `.topbar`), resultando em 2 linhas e 59,3 px. Complemento: `.topbar{column-gap:0}` → coluna de 196 px, h1 com 29,6 de altura, 1 linha, cabeçalho 58,6 (era 103,1). No 17 Pro Max, a coluna vai a 246 px para um texto de 214,1. |
| 3 | `.app` `padding-top` 18 px + área segura, `.topbar` margem 20, `.summary` margem 18, `.filters` `padding-bottom` 14; conteúdo ≤ 330 da área segura | **aplicado** | Calculado: `padding-top` 80 / 65 px. Margens 20 / 18 e `padding-bottom` 14 px. Com os ajustes 1 e 2, o conteúdo começa **282,4** px abaixo da área segura no 17 Pro Max (≤ 330) e 278,6 no 13. O padrão está em 448,2 e 476,9. |
| 4 | `.task-card` com 14 px em cima e embaixo; cartão médio ≤ 125 na Lista e 3 cartões inteiros no Dia do 17 Pro Max | **aplicado, meta da Lista não atingida** | Padding medido: `14px 5px`. **Dia do 17 Pro Max:** 3 cartões inteiros (fundos em 545,2 / 675,6 / 850,8, viewport 956); eram 2. No 13 ficam 2 (o 3º termina em 854,4, viewport 844). **Lista:** média de **133,8** no 17 Pro Max (era 141,8; padrão 113,4) e 146,8 no 13 (era 154,8; padrão 128,6). Ver "Por que a Lista não chega a 125". |
| 5 | `.calendar-overdue` vira traço de 10×3 acima do número | **aplicado** | Medido: 10×3, raio 2 px, `rgb(255,69,58)`, `box-shadow:none`. Centro alinhado ao do número (Δx = 0) e 4 px acima dele. O ponto "Financeiro" segue 6×6, raio 50 %, `rgb(255,127,145)`. Agora a diferença é de forma, não só de posição. Outubro tem 6 traços: dias 6, 11, 12, 14, 15 e 16 em `iphone17promax-mes-escuro.png`. Mantive `right:auto`, porque a base tem `right:5px`. |
| 6 | `[data-theme="light"] .calendar-tag.cal-done{opacity:.55}` | **aplicado** | Opacidade calculada de 0,55 no claro e 0,35 no escuro (4 etiquetas concluídas no mês, nos dois perfis). |
| 7 | `.view-tab.active` sublinhada, 1 px, offset 8 | **aplicado** | `text-decoration-line: underline`, 1 px, offset 8 px nos dois temas. Cor do traço: `rgb(248,248,250)` no escuro e `rgb(24,33,45)` no claro. As inativas ficam com `none`. A aba ativa continua com 49,9×44. |
| 8 | Manter margens de 28 e célula de 60, aceitar a perda do P4 e registrar no seletor que a Lista fica mais longa | **margens e célula mantidas; aviso no seletor não aplicado** | Medidas: coluna interna de 384 / 334, célula de 53,1×60 / 46×60. `P4` segue falhando no `layout.cjs` (interna 384 contra 408), como esperado. O seletor não está no `zen.css`, o único arquivo que posso tocar, então não escrevi o aviso. Texto sugerido para quem integrar: "Zen: margens largas; a Lista fica cerca de 13 % mais longa no 17 Pro Max (9408 contra 8356 px) e 10 % no 13 (10171 contra 9278)". |

#### Por que a Lista não chega a 125 (`cartao-exp.cjs`, 60 cartões, 17 Pro Max / 13)

| Variante do cartão | Média 17PM | Média 13 | Observação |
|---|---|---|---|
| padrão do app | 113,4 | 128,6 | — |
| zen antes (18 px) | 141,8 | 154,8 | — |
| **zen agora (14 px)** | **133,8** | **146,8** | aplicado |
| 10 px em cima e embaixo | 125,8 | 138,8 | ainda acima de 125, e mais apertado que o padrão (12) |
| 14 px + `line-height:1.3` no título | 131,4 | 144,1 | — |
| 14 px + `.task-footer{row-gap:6px}` | 125,3 | 135,3 | quebra uma garantia: o vão de 16 px é o que evita a sobreposição das faixas de nível B (falha `S6.3.13.atrasadas.B.pares` da 1ª rodada) |
| 14 px + título de 14 px | 123,4 | 139,2 | abandona o título de 16 px da direção |

- O que pesa no cartão é o título de 16 px numa coluna 10 px mais estreita: 1,5 linha em média contra 1,2 no padrão
  (17 Pro Max).
- Pesa também o rodapé em duas linhas com o vão de 16 px. Esse vão é obrigatório.
- Só se chega a 125 abrindo mão do título de 16 px ou da garantia de toque. Mantive os 14 px pedidos e registro a meta
  como não atingida.

### Medidas depois do refino

#### Garantias (`h.medir`, rolagem 0; `inicio/zen-medidas.json`)

| Perfil | Vista | Tema | scrollWidth | Interativos sob a ilha | Fixos sob o indicador | Alvos < 44 fora o nível B | Erros de JS |
|---|---|---|---|---|---|---|---|
| 17 Pro Max | mes | escuro | 440 / 440 | 0 | 0 | 0 | 0 |
| 17 Pro Max | dia | escuro | 440 / 440 | 0 | 0 | 0 | 0 |
| 17 Pro Max | lista | escuro | 440 / 440 | 0 | 0 | 0 | 0 |
| 17 Pro Max | menu | escuro | 440 / 440 | 0 | 0 | 0 | 0 |
| 17 Pro Max | mes | claro | 440 / 440 | 0 | 0 | 0 | 0 |
| 17 Pro Max | dia | claro | 440 / 440 | 0 | 0 | 0 | 0 |
| 17 Pro Max | lista | claro | 440 / 440 | 0 | 0 | 0 | 0 |
| 17 Pro Max | menu | claro | 440 / 440 | 0 | 0 | 0 | 0 |
| iPhone 13 | mes | escuro | 390 / 390 | 0 | 0 | 0 | 0 |
| iPhone 13 | dia | escuro | 390 / 390 | 0 | 0 | 0 | 0 |
| iPhone 13 | lista | escuro | 390 / 390 | 0 | 0 | 0 | 0 |
| iPhone 13 | menu | escuro | 390 / 390 | 0 | 0 | 0 | 0 |
| iPhone 13 | mes | claro | 390 / 390 | 0 | 0 | 0 | 0 |
| iPhone 13 | dia | claro | 390 / 390 | 0 | 0 | 0 | 0 |
| iPhone 13 | lista | claro | 390 / 390 | 0 | 0 | 0 | 0 |
| iPhone 13 | menu | claro | 390 / 390 | 0 | 0 | 0 | 0 |

- **Nível B (os únicos alvos menores que 44, todos com 28 de altura):**
  - Dia: `.notas-toggle` 93,3×28 e `.agenda-share` 98,6×28.
  - Lista: `.list-previous` 118,5×28, `.notas-toggle`, `.agenda-share` e `.tr-open` 88,7 / 86,3×28.
- **Sob o indicador:** no Dia e na Lista o `h.medir` lista 3 a 5 interativos; todos têm `fixo:false` e são cartões que
  rolam. São 0 fixos.
- **`transbordando`:** 0 nas 16 medições.
- **Toque do cartão:**
  - `.check` e `.task-reschedule` seguem com 44,8 px de zona horizontal (padding `14px 5px`).
  - O FAB abre `#taskDialog`.
  - O toque no dia 10 do Mês abre a vista Dia em 10/10.
  - Medido com `verificar-refino.cjs`.
- **Contraste:** igual ao de antes, porque nenhuma cor mudou.
  - Abas e filtros inativos: 4,97:1 no escuro e 4,64:1 no claro.
  - Aba ativa: 19,21:1 e 15:1.
- **Tela larga:** scrollWidth 760/760 e 1024/1024, célula de 99×60.

#### Padrão × zen agora (`comparar.cjs`, escuro, rolagem 0)

| Medida | 17PM padrão | 17PM zen antes | **17PM zen agora** | 13 padrão | 13 zen antes | **13 zen agora** |
|---|---|---|---|---|---|---|
| Cabeçalho (linhas do h1) | 83,2 (1) | 112,6 (2) | **62,4 (1)** | 111,9 (2) | 103,1 (2) | **58,6 (1)** |
| Progresso | 123 | 56 | **56** | 123 | 56 | **56** |
| Topo das abas | 326,2 | 324,6 | **236,4** | 339,9 | 300,1 | **217,6** |
| Topo de `#viewContent` (da área segura) | 510,2 (448,2) | 506,6 (444,6) | **344,4 (282,4)** | 523,9 (476,9) | 482,1 (435,1) | **325,6 (278,6)** |
| 1ª célula do mês | 598,2 | 590,6 | **428,4** | 611,9 | 566,1 | **409,6** |
| Fundo da última célula (viewport 956 / 844) | 1164,2 | 960,6 | **798,4** | 1122,3 | 936,1 | **779,6** |
| Células inteiras na 1ª tela (de 42) | 21 | 35 | **42** | 14 | 28 | **42** |
| Legenda do mês (topo–fundo) | — | abaixo da dobra | **804,4–866,4** | — | abaixo da dobra | **785,6–847,6** |
| 1º cartão do Dia (topo) | 582,2 | 568,6 | **406,4** | 595,9 | 544,1 | **387,6** |
| Cartões inteiros do Dia | 2 | 2 | **3** | 2 | 2 | **2** |
| Altura média do cartão (Dia, 8) | 109,8 | — | **125,2** | 117,1 | — | **140,1** |
| Altura média do cartão (Lista, 60) | 113,4 | 141,8 | **133,8** | 128,6 | 154,8 | **146,8** |
| Altura da página na Lista | 8356 | 10050 | **9408** | 9278 | 10807 | **10171** |

- "Mês inteiro sem rolar" agora vale nos dois iPhones: as 42 células aparecem.
- No 17 Pro Max a legenda inteira fica na 1ª tela, em parte sob o FAB e o Jarvis, que são fixos. No 13 ela passa
  3,6 px da dobra.

#### Sem o atributo nada muda (`semattr.cjs`, 17 Pro Max)

| Vista | Elementos | Diferenças com a folha | Controle (duas leituras sem a folha) |
|---|---|---|---|
| mes | 563 | 1 | 1 |
| dia | 587 | 0 | 0 |
| lista | 2175 | 0 | 0 |
| menu | 563 | 0 | 0 |

A diferença no Mês é a mesma de antes: o `box-shadow` da animação `pulse` do `#jarvis-btn`. Ela aparece também no
controle.

#### Teste completo `layout.cjs` com a variante (`saida-layout-zen.txt`)

- **Resultado:** 396 ok, 36 FALHOU. Antes do refino eram 399 / 33; o padrão tem 415 / 17.
- **As 3 falhas novas** vêm todas do ajuste 1. O teste do layout padrão espera o botão na tela:
  - `S6.3.17pm.mes.#seqEntryBtn` e `S6.3.13.mes.#seqEntryBtn`: "ausente vs 1× w≥44 e h≥44";
  - `S6.9.17pm.seqEntryBtn`: altura null contra 44.
- **Isso não quebra nenhuma garantia.** Não há controle visível com menos de 44, e a função continua em dois
  controles de 44 ou mais (ajuste 1).
- **Sem regressão nas outras:**
  - `S6.1` e `S6.2`: 106 ok, 0 falhas.
  - `S6.3`: 114 ok. As 2 falhas são só as do `#seqEntryBtn`.
  - Nível B sem sobreposição nas 8 vistas: Dia, Lista, Atrasadas e Sequência × 2 perfis, 0 pares.
- **As outras 33 falhas** são as mesmas de antes:
  - marketplace, E2E e P5 (iguais às do padrão);
  - P4, S6.4, S6.9 e S6.7 `lista.rolado`, que são medidas do layout padrão que a direção muda de propósito.
  - Valores novos dessas medidas:
    - `S6.9.*.celulaTop`: 428,4 / 409,6;
    - `S6.9.17pm.filters`: 58 contra 60;
    - `S6.7`: véu cobrindo 6 de 6 e 5 de 5.

### Capturas refeitas (16)

`/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/inicio/zen/<perfil>-<vista>-<tema>.png`,
mesmos nomes. Conferi a olho:

- `iphone17promax-mes-escuro.png`: título em uma linha, mês inteiro, traços vermelhos acima dos números, MÊS
  sublinhado.
- `iphone13-mes-claro.png` e `iphone13-dia-escuro.png`: título em uma linha.
- `iphone17promax-dia-escuro.png`: 3 cartões inteiros.
- `iphone17promax-lista-claro.png`.
- `iphone13-menu-claro.png`: menu intocado.

### Riscos depois do refino

1. **Folga do título no iPhone 13: 6,3 px.** "Minha agenda" mede 189,7 numa coluna de 196 (fonte Inter do Chromium).
   - Se o SF Pro do iPhone for mais de 3 % mais largo, o título volta a quebrar no 13.
   - No 17 Pro Max a folga é de 31,9 px.
   - Não medi no aparelho.
2. **Sem "Modo sequencial" escrito na tela.**
   - A entrada passa a ser o ícone de cronômetro do cabeçalho (`title`/`aria-label` "Modo sequencial" / "Ativar modo
     sequencial") ou a aba SEQUÊNCIA.
   - O `layout.cjs` passa a acusar 3 falhas de presença desse botão. Quem integrar deve tratá-las como intencionais da
     variante.
3. **A Lista continua mais longa que no padrão:** +12,6 % no 17 Pro Max e +9,6 % no 13. A meta de 125 por cartão não
   foi atingida (ajuste 4).
4. **Estado só por cor no cabeçalho.** O cronômetro e o parceiro ligados seguem marcados só pelo `--accent`. Não estava
   nos ajustes.
5. **Desalinhamento de 3 px no Mês (já existia, não corrigido).**
   - O número fica 11 px abaixo do topo nos dias com pontos e 14 px nos dias sem tarefa. O motivo: o `<button>` centra o
     conteúdo na vertical e o `.calendar-tags` vazio não tem altura.
   - Correção de uma linha, não aplicada por estar fora da lista: `html[data-home="zen"] .calendar-tags{min-height:6px}`.
6. **Flutuantes sobre o Mês.**
   - No 13, o cardio e o FAB cobrem parte das células de sábado 24 e 31. No 17 Pro Max cobrem o fim da legenda.
   - A página do Mês rola: 1096 px de altura no 17 Pro Max e 1078 no 13.
   - É a mesma sobreposição dos fixos que existe no padrão, em outro lugar.
