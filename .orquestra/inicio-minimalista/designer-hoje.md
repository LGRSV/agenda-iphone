# Variante `hoje`: Hoje no centro

- **Arquivo:** `/home/user/agenda-iphone/estilos-inicio/hoje.css`. São 40 seletores, todos começam por `html[data-home="hoje"]`. Contei pelo CSSOM, e não há nenhum seletor fora do prefixo.
- **Capturas:** 16 arquivos `<perfil>-<vista>-<tema>.png` em
  `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/inicio/hoje/`.
- **Medidas brutas:** `medidas.json`, na mesma pasta.
- **Scripts:**
  - `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/inicio/hoje-rodar.cjs`: matriz de capturas e medidas.
  - `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/inicio/hoje-checar.cjs`: escopo, efeito sem o atributo, vista Sequência e clique no ícone.
  - `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/inicio/hoje-contraste.cjs`: contraste.

## Decisão de design
A tela abre respondendo "que dia é hoje e como vou nele".

- **Título:** a data de hoje vira o título da tela, em 25 px no iPhone 13 e 28 px no 17 Pro Max. É peso 800, em duas linhas equilibradas por `text-wrap:balance`: "Sábado, 17 / de outubro".
- **Inicial maiúscula:** vem de `::first-letter` em vez de `text-transform:capitalize`, o que elimina o "De Outubro".
- **Rótulo:** "Minha agenda" vira um rótulo de 11 px em maiúsculas.
- **Painel de hoje:** fica logo abaixo e não tem cartão. Tem o 1/8 em 44 px, depois o rótulo "PROGRESSO DIÁRIO · 17/10", uma barra de 6 px e a frase em 13 px.
- **Navegação:** encolhe para uma linha só. São as 4 abas em texto pequeno, sem trilho nem pílula deslizante. A ativa ganha só um fundo `--soft`. O Modo sequencial vira um ícone de 44×44 na coluna 2 da grade do `.app`, sem nenhum wrapper novo.
- **Filtros:** viram chips sem borda, em `--soft`.
- **Mês:** a célula de hoje ganha anel e fundo de acento. As etiquetas dos outros dias ficam em 75 % de opacidade.

**Ganho medido.** A primeira célula do calendário sobe de 611,9 para 433,7 no iPhone 13 (−178 px) e de 598,2 para 455,4 no 17 Pro Max (−143 px). Na prática cabem 2 linhas de calendário a mais por tela no 13.

### Onde segui a direção de arte e onde me afastei

1. **Data acima ou abaixo do rótulo.** O conceito diz "Minha agenda vira um rótulo pequeno *acima* dela". Já as regras (`order:-1`, margem `0 0 4px`) e o `moveOuEsconde` ("#currentDate sobe acima do h1") põem a data em cima. Segui as regras, que são 2 contra 1.
   - Testei a outra ordem (rótulo em cima) em `hoje-teste-b.png`, na mesma pasta do scratchpad. Ela também funciona e lê como sobrescrito clássico.
   - Para trocar, basta uma regra: `.subhead{order:0;margin:4px 0 0}`.
2. **Laterais de 20 px.** Os números da direção (196 e 246 px livres, abas de ~74 px) supunham as laterais de 16 px atuais. Com 20 px, medi:
   - texto do topo com 188 px no 13 e 238 no 17 Pro Max (a data continua em 2 linhas nos dois);
   - abas de 72,5 px no 13 e 85 px no 17 Pro Max.

   Com 20 px nas laterais, as abas não chegam a 74 px no 13. Ainda passam com folga dos 44.
3. **SEQUÊNCIA no iPhone 13.** Em 11 px, o texto mede 69,5 px numa aba de 72,5, sobra de 1,5 px por lado na fonte de teste. Apliquei 10,5 px só em `max-width:400px`, como a regra permite antes de mexer no tracking. Passou a medir 66,3/72,5. No 17 Pro Max ficou 11 px (69,5/85).
4. **Tema claro.** Fiz dois ajustes que a direção não previa, os dois só no tema claro:
   - **Fundos:** `--soft` (#f5f7fb) praticamente some sobre `--bg` (#f4f6fa). Por isso a aba ativa, os chips inativos e o ícone sequencial usam `--soft2` no claro.
   - **Abas inativas:** em `--faint` dariam 2,9:1 em 11 px, então usam `--muted`, com 4,64:1 medido. No escuro, o `--faint` dá 4,97:1 e ficou como pedido.
5. **Etiquetas concluídas.** A regra de 75 % pula `.calendar-tag.cal-done`. Sem isso, as concluídas subiriam de 0,42 para 0,75 e pareceriam pendentes.
6. **Grade do `.app`.** Usei uma regra geral `.app>*{grid-column:1/-1;min-width:0}` em vez de listar só 4 filhos. Assim, qualquer filho injetado depois por um script ocupa a linha toda. Só `#viewTabs` (coluna 1) e `#seqEntryBtn` (coluna 2) saem dela.
7. **`.toolbar-title` em 19 px.** Vale nas três barras: Dia, Mês e Sequência. O mês "Outubro" fica centrado entre 44 | 1fr | 44 sem quebrar.

## O que mudou de lugar e onde está cada função

| Função | Antes | Na variante `hoje` | Medida (13 / 17 Pro Max) |
|---|---|---|---|
| Data de hoje (`#currentDate`) | linha de 14 px abaixo do h1 | título da tela, acima do h1 (`order:-1`) | 188×52,4 em 24,96 px, 2 linhas / 238×59,1 em 28,16 px, 2 linhas |
| "Minha agenda" (`h1`) | título de 31–43 px | rótulo de 11 px, maiúsculas, `--muted`, abaixo da data | 188×14,3 / 238×14,3 |
| "Organização pessoal" (`.eyebrow`) | acima do h1 | some (`display:none`) | — |
| Progresso (`#progressText`, barra, frase) | cartão com borda, sombra e padding 18 | painel sem cartão: 1/8 em 44 px **antes** do rótulo, barra 6 px, frase 13 px | número 33,9×44; barra 350×6 / 400×6 |
| Dia, Mês, Lista, Sequência (`#viewTabs`) | segmentado com trilho e pílula deslizante | 4 abas de texto na coluna 1 da grade | 72,5×44 cada / 85×44 cada |
| Modo sequencial (`#seqEntryBtn`) | faixa tracejada de largura total abaixo das abas | ícone de 44×44 à direita das abas, na mesma linha (coluna 2) | x 326 / x 376. Nome acessível "Modo sequencial" preservado (`getByRole` = 1). Na vista Sequência fica `hidden`, `display:none`, e a coluna 2 vai a 0 (colunas "350px 0px" / "400px 0px"). As abas ocupam 350 / 400 |
| Filtros (`#filters`) | chips com borda, 13 px | chips sem borda, `--soft`, 12 px, abaixo da linha das abas | 63,7 / 87,7 / 94 / 79,8 × 44. Não rolam (somam 343,1 em 350) |
| Cronômetro, parceiro, menu (`.head-actions`) | 46×46 com fundo `--surface` | 46×46 transparentes com contorno `--line` | 150 px de largura no total |
| Menu (`#moreMenuBtn` → `#quickMenu`) | intocado | intocado (Agenda, Financeiro, Marketplace, Gamificação, Alertas, Modo claro, Equipamentos, Atualizar, Compartilhadas) | abre normalmente nas 4 capturas `menu` |
| + Nova tarefa (`#openDialog`), cardio (`#cardioFab`), Jarvis (`#jarvis-btn`) | flutuantes | intocados | — |
| Atualizar (`#app-update`) e selo da versão (`#app-ver`) | opacidade 1 | `#app-ver` com opacidade 0,6, inclusive o botão de 44×44 | 0,6 medido |
| Hoje no Mês (`.calendar-day.today`) | só o número em pílula de acento | anel `--accent` e fundo com 14 % de acento | borda rgb(117,203,255) no escuro |
| Vista Sequência | aba e faixa | aba, ícone do cabeçalho (`#seqTimerBtn`) e ícone ao lado das abas | clique no ícone leva à aba Sequência (`abaAtiva: sequencia`) |

## Tabela de medidas
Medidas com o harness `h.medir`, com área segura emulada por CDP (62/34 no 17 Pro Max e 47/34 no 13). A variante foi aplicada via `addStyleTag` + `dataset.home='hoje'`, e o tema claro via `dataset.theme='light'`. "Alvos < 44" exclui o nível B: `.notas-toggle`, `.agenda-share`, `.tr-open` e `.list-previous` (28 px visíveis + faixa de toque).

| Perfil | Vista | Tema | scrollWidth / viewport | Interativos sob a ilha | Fixos sob o indicador | Alvos < 44 (fora o nível B) | Nível B presentes | Erros de JS |
|---|---|---|---|---|---|---|---|---|
| iphone17promax | mes | escuro | 440 / 440 | 0 | 0 | 0 | 0 | 0 |
| iphone17promax | dia | escuro | 440 / 440 | 0 | 0 | 0 | 2 | 0 |
| iphone17promax | lista | escuro | 440 / 440 | 0 | 0 | 0 | 5 | 0 |
| iphone17promax | menu | escuro | 440 / 440 | 0 | 0 | 0 | 0 | 0 |
| iphone17promax | mes | claro | 440 / 440 | 0 | 0 | 0 | 0 | 0 |
| iphone17promax | dia | claro | 440 / 440 | 0 | 0 | 0 | 2 | 0 |
| iphone17promax | lista | claro | 440 / 440 | 0 | 0 | 0 | 5 | 0 |
| iphone17promax | menu | claro | 440 / 440 | 0 | 0 | 0 | 0 | 0 |
| iphone13 | mes | escuro | 390 / 390 | 0 | 0 | 0 | 0 | 0 |
| iphone13 | dia | escuro | 390 / 390 | 0 | 0 | 0 | 2 | 0 |
| iphone13 | lista | escuro | 390 / 390 | 0 | 0 | 0 | 5 | 0 |
| iphone13 | menu | escuro | 390 / 390 | 0 | 0 | 0 | 0 | 0 |
| iphone13 | mes | claro | 390 / 390 | 0 | 0 | 0 | 0 | 0 |
| iphone13 | dia | claro | 390 / 390 | 0 | 0 | 0 | 2 | 0 |
| iphone13 | lista | claro | 390 / 390 | 0 | 0 | 0 | 5 | 0 |
| iphone13 | menu | claro | 390 / 390 | 0 | 0 | 0 | 0 | 0 |

### Medidas complementares
- **Vista Sequência:** medida após clicar em `#seqEntryBtn`.
  - Nos dois perfis: 0 sob a ilha, 0 alvos < 44, scrollWidth igual ao viewport.
  - O ícone fica com `hidden`/`display:none` e a coluna 2 com 0 px.
- **Efeito nulo sem o atributo:** comparei, com o `hoje.css` carregado e sem `data-home`, o retângulo, a cor, o fundo, a fonte e a opacidade de todos os elementos do `body`. Foram 551 a 2.163 elementos por vista, em 5 vistas × 2 temas × 2 perfis.
  - O resultado foi 0 diferenças.
  - A única exceção é o `#toast`, que estava no meio do próprio fade (opacidade 0,0007 → 0). É a animação dele, não CSS da variante.
- **Contraste** (medido no 17 Pro Max):

  | Elemento | Escuro | Claro |
  |---|---|---|
  | Aba inativa | 4,97 | 4,64 |
  | Aba ativa | 17,16 | 13,79 |
  | "MINHA AGENDA" | 9,43 | 4,64 |
  | Data | 19,21 | 15,0 |
  | Chip inativo | 17,16 | 13,79 |
  | Atrasadas ativo | 9,23 | 3,38 (cores atuais do app, ver riscos) |

- **Topo:** `.topbar` começa em y 65 no 13 e y 80 no 17 Pro Max. A ilha termina em 47 e 62. O véu `body::before` não foi tocado.
- **O que não rodei:** o teste completo `layout.cjs`. Ele mede o padrão, e o `index.html` não carrega este CSS. A garantia "sem o atributo nada muda" foi conferida pela comparação de todos os elementos acima.

## Riscos
1. **Ordem data × rótulo.** Existe a contradição interna da direção, descrita no item 1 da seção "Onde segui a direção de arte e onde me afastei". Se o integrador preferir o rótulo acima da data, basta uma regra, já testada visualmente em `hoje-teste-b.png`.
2. **Fonte real do iPhone.** As larguras foram medidas na fonte de fallback do Chromium de teste, não na SF Pro.
   - "SEQUÊNCIA": no 13 a folga é de 3,1 px por lado (10,5 px); no 17 Pro Max, de 7,7 px por lado.
   - Data: as duas linhas têm folga, porque `text-wrap:balance` reparte o texto.
   - Se a SF Pro for mais larga, o primeiro sinal aparece no 13. O remédio seria baixar mais 0,5 px na mesma media query.
3. **Datas longas: medido, sem problema.** Troquei o texto de `#currentDate` por "quarta-feira, 30 de setembro" e por "segunda-feira, 28 de fevereiro" (`hoje-data-longa.cjs`).
   - As duas ficaram em 2 linhas nos dois perfis, com 52,4 px no 13 e 59,1 px no 17 Pro Max.
   - A primeira célula ficou no mesmo lugar e o scrollWidth igual ao viewport.
   - O risco que sobra é a SF Pro ser mais larga e forçar uma 3ª linha (+26 px) no 13.
4. **"Atrasadas" ativo no claro.** Tem 3,38:1, mas é a cor atual do app (`lateFilterStyles`), repetida por pedido da direção. Não piorou nem melhorou.
5. **Tema claro com tokens diferentes da direção.** Usei `--soft2` e `--muted` (itens 4 e 5 da seção de decisões). Se o integrador quiser a regra ao pé da letra, a aba ativa e os chips ficam quase invisíveis no claro.
6. **Regra geral `.app>*`.** Qualquer filho futuro do `.app` ocupa a largura toda. Hoje são 6 filhos e nenhum quebrou. Um filho com `position:absolute/fixed` não é afetado pela grade.
7. **`#app-ver` a 0,6.** O botão Atualizar continua com 44×44 e fica mais discreto. Ele também continua no menu.
8. **`#seqEntryBtn` depende do `sequencial.js`.** Se o script deixar de injetar o botão, a coluna 2 fica vazia com 0 px e as abas ocupam a linha toda (medido na vista Sequência). Não quebra.

## Refino (rodada 2, depois da nota 6 do juiz)

Tudo em `/home/user/agenda-iphone/estilos-inicio/hoje.css`, que agora tem 45 seletores, todos sob `html[data-home="hoje"]` (0 fora do prefixo, contado pelo CSSOM). As 16 capturas foram refeitas com os mesmos nomes, e `medidas.json` também.

Scripts novos, na pasta `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/inicio/`:
- `hoje-refino.cjs` → `hoje-refino.json`: confere cada ajuste em 2 perfis × 2 temas.
- `hoje-celulas.cjs`: conta as células e os cartões que cabem inteiros na tela.
- `hoje-fab-cobre.cjs`: lista as células do Mês cobertas pelo +.
- `hoje-toolbar.cjs`: bordas do cabeçalho da `.view-shell`.

O "antes" é `hoje-antes-refino.css` (a versão da rodada 1, reconstruída) e `hoje-medidas-antes-refino.json`.

### Ajustes pedidos

| # | Ajuste | Estado | Evidência (17 Pro Max / 13, escuro e claro) |
|---|---|---|---|
| 1 | `.view-shell{border:0;border-radius:16px}` | **aplicado** (l. 59) | `border-width` 0px/0px, raio 16px, sombra `none` nos 4 casos. **Complemento (l. 61–62):** o cabeçalho da casca (`.toolbar`, raio 20 e margem −1 px, ou `.list-header`, com borda própria) desenhava um contorno nos cantos depois que a borda da casca saiu. Ele ficou só com a linha divisória de baixo: `border-width:0 0 1px`, raio 0, margem 0. Medido em Mês, Dia, Lista e Sequência: `b0px/0px/1px`, 400 px de largura, alinhado à casca. |
| 2 | `.head-actions>.icon-btn{border:0}` | **aplicado** (l. 22) | Cronômetro, parceiro e menu medem 46×46, com `border` 0px, fundo transparente e sombra `none` nos 4 casos. |
| 3 | `.summary-number{font-size:32px}` + `.summary-label{11px; .1em; --muted}` | **aplicado** (l. 27 e 29) | Número com 32 px de fonte e caixa 29,2×32. Rótulo em 11 px, `letter-spacing` 1,1 px, cor `--muted`, contraste 9,43 (escuro) e 4,64 (claro). A `.summary` caiu de **82 para 48 px (−34)**; o pedido era ≥ 10. |
| 4 | `.summary-message{display:none}` | **aplicado** (l. 32) | `display:none` medido. Também zerei a margem de baixo da `.progress` (l. 31: `10px 0 0`, antes `10px 0 6px`): sem a frase, esses 6 px ficariam sobrando antes do `row-gap`. A frase não é ação, e os três textos dela ("Nenhuma tarefa…", "Tudo concluído…", "N% … concluídas") já saem do 1/8 e da barra. |
| — | verificar `#viewContent ≤ 283` no 17 Pro Max | **ok** | O topo agora está a **271,4 px** da área segura, y 333,4 absoluto; antes eram 305,4 (y 367,4). No 13, 264,7 (y 311,7); antes eram 298,7. |
| 5 | `#seqEntryBtn{border:0;background:transparent;color:var(--accent)}`, removido da regra `--soft2` do claro | **aplicado** (l. 43 e 72) | Mede 44×44, com `border` 0px e fundo `rgba(0,0,0,0)` nos 4 casos. Ícone em acento com contraste 11,39 (escuro) e 4,09 (claro), acima de 3:1 para não-texto. O nome acessível "Modo sequencial" continua (`getByRole` = 1). Na Sequência fica `hidden` e as colunas dão "400px 0px" / "350px 0px". Agora usa a mesma cor e o mesmo "sem caixa" dos três ícones do cabeçalho. |
| 6 | `.chip:not(.active){background:transparent;color:var(--muted)}` | **aplicado** (l. 51) | **3 de 4** chips têm fundo `rgba(0,0,0,0)` nos 4 casos; o ativo é "Todas", em acento. Contraste dos inativos: 9,43 (escuro) e 4,64 (claro). Para isso também tirei `.chip:not(.active)` da regra `--soft2` do claro (l. 72); senão a especificidade dela venceria no claro. Todos continuam com 44 de altura. **Efeito colateral:** "Atrasadas" inativo deixa o vermelho do app (`.chip.chip-late`) e fica `--muted` como os outros. Ativo, continua preenchido de `--danger`. |
| 7 | `.fab` em círculo de 56 + `.fab .plus{font-size:30px}` | **aplicado** (l. 65–66) | Mede 56×56, com raio 50%, `font-size` 0 e `.plus` em 30 px. O texto "+ Nova tarefa" continua no DOM: `getByRole('button',{name:/Nova tarefa/})` = 1 e o clique abre `#taskDialog` (`open: true`) nos 4 casos. **Células do Mês cobertas pelo +:** no 17 Pro Max, 22, 23, 24, 29, 30 e 31 (pílula de 148,8×54) passaram a só 31; no 13, 22, 23 e 24 passaram a 24 e 31 (o círculo fica na coluna Sáb). **Complemento (l. 68):** `.agenda-actions{align-items:center}` empilha o cardio (48) e o + (56) pelo centro: cardio em x 374 com centro em 398, igual ao do +. Antes ficavam alinhados pela borda direita, com 4 px de desvio. O `#cardioFab` em si não foi tocado. |
| 8 | Manter a data acima do rótulo | **aplicado** (sem mudança) | Continua `order:-1` na `.subhead`. |

### Problemas apontados sem ajuste pedido

- **Regra geral `.app>*{grid-column:1/-1}`: mantida, de propósito.** Numa grade de 2 colunas, um filho futuro sem `grid-column` cairia sozinho numa célula, possivelmente na coluna `auto` estreita do ícone. Com a regra geral, ele ocupa a linha inteira, que é o comportamento menos surpreendente. Listar só os 6 filhos atuais não tira o filho futuro da grade; apenas o deixaria pior posicionado.
- **SEQUÊNCIA no 13 depende da fonte: sem mudança.**
  - Continua em 10,5 px, ocupando 66,3 de 72,5 px.
  - A folga de 3,1 px por lado foi medida na fonte de teste, não na SF Pro.
  - O remédio segue o mesmo: baixar mais 0,5 px na media query.

### Ganho de espaço (medido, `hoje-celulas.cjs`; "inteiro" = base ≤ altura − indicador de início)

| Perfil | 1ª célula do Mês | Dias do mês inteiros | Cartões inteiros no Dia |
|---|---|---|---|
| iPhone 17 Pro Max | 455,4 → **420,4** (padrão 598,2) | 24 → **31 de 31** (última linha termina em 891,4; limite 922) | 3 → **4 de 8** |
| iPhone 13 | 433,7 → **398,7** (padrão 611,9) | 24 → **24 de 31** (última linha termina em 821,5; limite 810, faltam 11,5 px) | 3 → **3 de 8** |

No 13, a 5ª semana ainda passa 11,5 px do limite. Nenhum ajuste pedido cobria isso, então não mexi.

### Matriz depois do refino (`hoje-rodar.cjs`, `h.medir`)

| Perfil | Vistas × temas | scrollWidth / viewport | Sob a ilha | Fixos sob o indicador | Alvos < 44 (fora o nível B) | Erros de JS |
|---|---|---|---|---|---|---|
| iphone17promax | mes, dia, lista e menu × escuro e claro | 440 / 440 nas 8 | 0 | 0 | 0 | 0 |
| iphone13 | mes, dia, lista e menu × escuro e claro | 390 / 390 nas 8 | 0 | 0 | 0 | 0 |

- **Nível B presentes:** iguais à rodada 1: Dia 2, Lista 5, Mês e menu 0.
- **Vista Sequência, nos dois perfis:** scrollWidth igual ao viewport, 0 sob a ilha, 0 alvos < 44 e 0 erros.
- **Efeito nulo sem o atributo:** refeito com `hoje-checar.cjs` (saída em `hoje-checar-refino.json`). Foram 0 diferenças em 551 a 2.163 elementos por vista, nas 5 vistas × 2 temas × 2 perfis. A única exceção continua sendo o `#toast` no meio do próprio fade.

### Riscos novos

1. **O + perdeu o rótulo visível "Nova tarefa".**
   - O nome acessível continua, porque o texto segue no DOM com `font-size:0` e o Chromium o expõe; o VoiceOver do iOS não foi testado.
   - Quem depende do texto para entender o círculo perde essa pista. O "+" em acento é o padrão do iOS para "adicionar".
2. **"Atrasadas" inativo sem vermelho.** A pista de cor saiu por pedido do juiz ("só o filtro ativo preenchido", com a cor `--muted`). Para voltar a ter, basta uma regra: `html[data-home="hoje"] .chip-late:not(.active){color:var(--danger)}`.
3. **Tema claro, cabeçalho da Lista e do Dia.**
   - O fundo `--soft` (#f5f7fb) do cabeçalho fica quase igual ao `--bg` (#f4f6fa). Sem a borda da casca, o topo da casca se funde com a página.
   - A linha divisória de baixo e o corpo branco (`--surface`) continuam marcando a área (ver `iphone13-lista-claro.png`). Não é perda de função; é o "sem moldura" pedido.
