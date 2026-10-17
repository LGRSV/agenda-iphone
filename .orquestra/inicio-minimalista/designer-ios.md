# Variante `ios`: lista agrupada à moda do iOS

- **Arquivo:** `/home/user/agenda-iphone/estilos-inicio/ios.css` (8,5 kB). São 49 seletores, todos começam por `html[data-home="ios"]`. Contei pelo CSSOM: 0 fora do prefixo e uma única media query, `(max-width: 760px)`.
- **Capturas:** 16 arquivos `<perfil>-<vista>-<tema>.png` em
  `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/inicio/ios/`.
  Na mesma pasta estão as extras `extra-*.png`: página rolada, Sequência, Jarvis, Desktop 1180 e data longa no 13.
- **Medidas brutas:** `medidas.json`, `medidas-sem-variante.json` e `checar.json`, na mesma pasta.
- **Scripts** (em `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/inicio/`):
  - `ios-rodar.cjs`: matriz de capturas e medidas com `h.medir`.
  - `ios-checar.cjs`: escopo, efeito nulo sem o atributo, colisões, rolagem, cliques nas abas, Sequência, Jarvis, toast, contraste e Desktop 1180.
  - `ios-titulo.cjs` e `ios-data-longa.cjs`: largura do título e das datas longas.

## Decisão de design
A tela passa a parecer um app do sistema. O conteúdo fica no meio e a navegação desce para o polegar.

- **Cabeçalho.** O título "Minha agenda" fica grande, em peso 700, com a data em cinza logo abaixo, escrita como no iOS: "Sábado, 17 de outubro". O eyebrow some. Os três botões (cronômetro, olho, menu) perdem caixa, borda e sombra e ficam só com o glifo azul, mantendo 46×46 de alvo.
- **Células agrupadas.** Progresso, filtros e conteúdo viram células de raio 12, sem borda, sombra nem gradiente.
  - O progresso é uma linha: rótulo em 15 px, número em 17 px, barra de 4 px e a frase.
  - Os filtros são um segmented control.
  - A vista (Dia, Mês, Lista, Sequência) é a célula grande.
- **Tab bar.** As abas saem do fluxo e viram uma barra fixa no rodapé, com glifo de 24 px e rótulo de 11 px. A aba ativa fica em azul. Ela continua visível com a página rolada.
- **Flutuantes.** O + Nova tarefa vira o botão redondo de 56 px, como o compor do Notas. Jarvis, + e Atualizar ficam numa linha 16 px acima da barra.

**Ganho medido.** A primeira célula do calendário sobe de 598,2 para 397,4 no 17 Pro Max (−200,8 px) e de 611,9 para 375,2 no iPhone 13 (−236,7 px). As 4 abas, que ocupavam uma linha de ~54 px no meio da tela, agora ficam no rodapé, ao alcance do polegar.

### Onde segui a direção de arte e onde me afastei
1. **Colisão do `#app-ver` com o + redondo (corrigida).** Com os números da direção (+ em 73, `#app-ver` em 67 e 10 px da direita), medi na primeira rodada que os dois se sobrepunham no 17 Pro Max: + em 370–426 × 793–849 e Atualizar em 354,3–398,3 × 811–855.
   - **Causa:** antes, o "+ Nova tarefa" ficava *acima* do `#app-ver` (62 contra 10–54). A direção desceu o + sem notar que ele passaria a ocupar o canto do selo.
   - **Correção:** o `#app-ver` foi para a **esquerda do +**, centrado na altura dele. Ficou com `right: max(14px, inset) + 66px` e `bottom: 80px + inset`.
   - **Resultado:** o selo "v247" termina 10 px antes do +, e o Atualizar (44×44) fica 22 px acima da barra. O script `ios-checar.cjs` acusa 0 colisões entre +, cardio, Jarvis, Atualizar, versão e barra nos 4 casos (2 perfis × 2 temas).
2. **Borda da barra: 58 px, não 57.** A borda superior de 1 px soma-se aos 6 + 49 + 2.
   - Para manter "16 px acima da barra", o + foi a 74 em vez de 73.
   - O Jarvis também foi a 74 em vez de 69. Assim, Jarvis e + ficam alinhados numa linha só; a 69 e 73 ficavam 4 px desencontrados.
   - O painel do Jarvis abre em 138 (em vez de 133), 8 px acima do topo do botão. O mesmo 138 entra no `max-height`.
   - O `.app` ficou com o padding-bottom de 253, como pedido.
3. **Toast.** O `.toast` (z 20) começava em 184 e ficaria 2 px sobre o `#cardioFab`, que agora sobe até 187. Levei o toast a 198, o que mantém os mesmos 11 px de folga do padrão. Medi isso com uma mensagem longa nos dois perfis.
4. **Título fluido no 13.** Em 34 px, "Minha agenda" mede 226,7 px. A coluna de texto tem 246 px no 17 Pro Max, mas só 196 px no 13 (408 ou 358 − 150 dos botões − 12 de gap). No 13 o título quebrava em 2 linhas, com 74,8 px de altura.
   - Usei `clamp(26px, (100vw − 206px)/6,7, 34px)`.
   - **17 Pro Max:** 34 px exatos.
   - **13:** 27,46 px, numa linha (30,2 px de altura), com 12,9 px de folga.
5. **Célula no tema escuro.** Fiz duas trocas de token, com variáveis locais `--ios-celula` e `--ios-segmento`:
   - **Célula:** `--surface` sobre `--bg` mede 1,04:1, e sem borda a célula praticamente some (A/B em `ios-ab/a-*` e `b-*`). Passei a usar `--soft`, que dá 1,12:1 e fica perto do #1c1c1e sobre preto do iOS.
   - **Segmento ativo:** sobre `--soft`, ele sobe de `--soft2` para `--line` (1,35:1).
   - **Tema claro:** fica exatamente como a direção pediu, com `--surface` (#fff) sobre `--bg` e o ativo em `--soft2`.
6. **Glifos na tab bar (acréscimo).** Só com texto de 11 px, a barra de 92 px ficava vazia. Cada aba ganhou um glifo de 24 px, feito com `::before` e uma máscara SVG em data URI pintada com `currentColor`:
   - **Dia:** calendário com um dia marcado.
   - **Mês:** calendário com grade.
   - **Lista:** linhas com marcadores.
   - **Sequência:** o mesmo cronômetro do `#seqTimerBtn`.

   O rótulo continua sendo o texto do botão.
7. **Aba ativa no tema claro.** O `--accent` sobre branco dá 4,42:1 no rótulo de 11 px; troquei por `--accent2`, que dá 5,24:1. No escuro ficou `--accent` (10,18:1).
8. **Data.** O `text-transform: capitalize` do padrão gerava "17 De Outubro". Troquei por `none` com `::first-letter` em maiúscula, o que dá "Sábado, 17 de outubro".
9. **Estado ligado dos botões do cabeçalho.** O `#parceiroBtn.on` e o `#seqTimerBtn.seq-active` mostravam o estado pela borda, que saiu. Agora ganham um fundo com 16 % de acento. Medi: aparece só na aba Sequência e some nas outras.
10. **Cartões da Sequência.** Continuam `--surface` sobre a trilha `--soft`, como no padrão.
11. **Padding dos cartões.** O `padding: 12px` do `.task-card` usa `:where()`. Assim, regras mais específicas do app, como o `padding-left: 14px` do `.lembrete-card`, continuam valendo.
12. **Acima de 760 px (modo Desktop).** Tudo o que é da tab bar e das posições dos flutuantes fica dentro de `@media (max-width: 760px)`.
    - Medi com viewport de 1180, a largura que o `viewmode.js` aplica. Resultado: `#viewTabs` com `position: relative` e margem 12, + em 62, Jarvis em 12, `#app-ver` em 10/10, `.app` com 196, toast em 184 e glifo `none`.
    - Só a forma redonda do + e o visual das células valem também no Desktop.

## O que mudou de lugar e onde está cada função

| Função | Antes | Na variante `ios` | Medida (17 Pro Max / 13) |
|---|---|---|---|
| "Organização pessoal" (`.eyebrow`) | acima do h1 | some | — |
| Título "Minha agenda" | 31–43 px, peso padrão | 34 px / 27,46 px, peso 700, uma linha | 246×37,4 / 196×30,2 |
| Data (`#currentDate`) | 14 px, "17 De Outubro" | 15 px `--muted`, "Sábado, 17 de outubro" | uma linha nos dois (data de hoje) |
| Cronômetro, olho, menu | caixas de 46 com borda | só o glifo azul, 46×46 | x 274/326/378 / x 224/276/328 |
| Menu (`#moreMenuBtn` → `#quickMenu`) | intocado | intocado (Agenda, Financeiro, Marketplace, Gamificação, Alertas, Modo claro, Equipamentos, **Atualizar o app**, Compartilhadas) | abre nas 4 capturas `menu`, dentro da área segura |
| Progresso (número, barra, frase) | cartão 18 px de padding, sombra, gradiente | célula de 79 px de altura | y 152,4 / y 130,2 |
| Filtros | chips soltos com borda | segmented control de 52 px (botões de 44), **logo abaixo do progresso** | 79,5 / 105,4 / 112,3 / 96,8 · 67 / 92,9 / 99,8 / 84,3; não rolam |
| Dia, Mês, Lista, Sequência (`#viewTabs`) | segmentado no fluxo, abaixo do progresso | **tab bar fixa no rodapé**, 4 botões de 49 px | 106×49 a y 871–920 / 93,5×49 a y 759–808 |
| Modo sequencial (`#seqEntryBtn`) | faixa tracejada | **some** (`display: none`); a aba Sequência na barra e o `#seqTimerBtn` levam à mesma vista | cliques medidos: aba ativa = `sequencia` |
| + Nova tarefa (`#openDialog`) | pílula com texto, à direita | **círculo de 56**, 16 px acima da barra; o rótulo segue no DOM | 370–426 × 792–848 / 320–376 × 680–736; nome acessível "Nova tarefa" = 1; o diálogo abre |
| Registrar cardio (`#cardioFab`) | acima do + | acima do +, sem sombra | 378–426 × 735–783 / 328–376 × 623–671 |
| Jarvis (`#jarvis-btn`) | canto inferior esquerdo | sobe, na mesma linha do + | 18–74 × 792–848 / 18–74 × 680–736 |
| Painel do Jarvis | 90 px acima | 138 px acima, 8 px sobre o botão | 306,9–784 / 165,7–672, dentro da área segura |
| Atualizar (`#app-update`) e versão (`#app-ver`) | canto inferior direito | **à esquerda do +**, centrados nele | Atualizar 284,3–328,3 × 798–842 / 234,3–278,3 × 686–730 |
| Toast (`.toast`) | 184 | 198, 11 px acima do cardio | 652–724 / 524–612 com mensagem longa |
| Células (resumo, filtros, vista) | borda, sombra e gradiente | sem borda e sem sombra, raio 12 | — |

## Tabela de medidas
Medidas com o harness `h.medir`, com área segura emulada por CDP (62/34 no 17 Pro Max e 47/34 no 13). A variante foi aplicada via `addStyleTag` + `dataset.home='ios'`, e o tema claro via `dataset.theme='light'`. "Alvos < 44" exclui o nível B: `.notas-toggle`, `.agenda-share`, `.tr-open` e `.list-previous`.

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

Em nenhuma das 16 medidas apareceu elemento transbordando.

### Medidas complementares
- **Faixa do indicador.**
  - As abas terminam em 920 no 17 Pro Max e em 808 no 13. A faixa começa em 922 e 810, então ficam 2 px acima dela.
  - A barra vai de 864 a 956 e de 752 a 844 (92 px, contando os 34 da área segura).
- **Topo.** O conteúdo do cabeçalho começa em y 78 no 17 Pro Max (ilha até 62) e em y 63 no 13 (ilha até 47). O véu `body::before` não foi tocado.
- **Rolagem.** Rolei a página a 380 px no 17 Pro Max e 415 px no 13 (o máximo, porque o conteúdo acabou).
  - A barra continua em y 864 e 752.
  - No fim da rolagem, a legenda do mês fica inteira acima dos flutuantes (`extra-*-mes-rolado-escuro.png`).
- **Cliques nas abas da barra.** Cliquei com `page.click`, que falha se algo cobrir o botão, com a página rolada a 400 px, na ordem Dia → Lista → Sequência → Mês, nos 4 casos.
  - A aba ativa seguiu cada clique.
  - O `#seqTimerBtn` ganhou `seq-active` e fundo de acento a 16 % só em Sequência.
- **Vista Sequência** (medida com `h.medir` nos 4 casos): scrollWidth igual ao viewport, 0 interativos sob a ilha, 0 fixos sob o indicador, 0 alvos < 44 e 2 do nível B.
- **Jarvis.** O painel fica 8 px acima do botão, dentro da área segura. Não há interativo sob a ilha nem alvo < 44 nos 4 casos.
- **Efeito nulo sem o atributo.** Carreguei o `ios.css` sem `data-home` e comparei com o padrão sem CSS: retângulo, cor, fundo, fonte, opacidade e borda de todos os elementos do `body`.
  - Foram 551 a 2.163 elementos por vista, em 6 vistas × 2 temas × 2 perfis.
  - Deu 0 diferenças, com uma única exceção: `#seqLiveClock`, cuja largura passou de 60,6 para 61 px. É o relógio ao vivo da Sequência, que muda de dígito a cada segundo; não vem do CSS.
- **Contraste** (medido; os dois perfis dão o mesmo):

  | Par | Escuro | Claro |
  |---|---|---|
  | Célula sobre o fundo | 1,12 | 1,08 |
  | Aba inativa (rótulo) sobre a barra | 8,43 | 5,02 |
  | Aba ativa (rótulo) sobre a barra | 10,18 | 5,24 |
  | Segmento ativo sobre o trilho | 1,35 | 1,18 |
  | Texto do segmento ativo | 12,69 | 13,79 |
  | Texto do chip inativo | 17,16 | 16,23 |
  | Glifo do cabeçalho sobre o fundo | 11,39 | 4,09 |
  | Data sobre o fundo | 9,43 | 4,64 |
  | Frase do progresso sobre a célula | 8,43 | 5,02 |

- **O que não rodei:** o teste completo `layout.cjs`. Ele mede o padrão, e o `index.html` não carrega este CSS. A garantia "sem o atributo nada muda" foi conferida pela comparação de todos os elementos acima.

## Riscos
1. **O `#app-ver` mudou de lugar além do que a direção previa.** Ele vai para a esquerda do +, para não ficar embaixo do botão redondo (item 1 das decisões). O selo "v247" e o círculo do Atualizar passam a flutuar mais para o meio, sobre o conteúdo, como já flutuavam no canto. O Atualizar continua também no menu.
2. **Fonte real do iPhone.** As larguras foram medidas na fonte de teste (Inter), não na SF Pro.
   - **Título:** a folga é de 19,3 px no 17 Pro Max e 12,9 px no 13.
   - **Datas longas:** "quarta-feira, 30 de setembro" e "segunda-feira, 28 de fevereiro" quebram em 2 linhas no 13 (+19 px; a primeira célula vai de 375,2 para 394,2). No 17 Pro Max ficam numa linha (212,5 de 246 px).
3. **Célula escura em `--soft`.** É um desvio da direção (item 5 das decisões). Elementos internos que já usavam `--soft` passam a ter o mesmo fundo da célula: dia atual do mês, `.lembrete-card` e trilha da Sequência. Os que têm borda continuam delimitados. Para voltar à regra ao pé da letra, basta trocar `--soft` por `--surface` na linha `:not([data-theme="light"])`.
4. **Segmento ativo discreto.** Mede 1,35:1 no escuro e 1,18:1 no claro, contra o preenchimento azul do padrão. É o comportamento do segmented control do iOS, e o texto continua com 12,7 e 13,8:1. Se o dono sentir falta, o remédio é peso 800 ou texto em acento no `.chip.active`.
5. **Conteúdo sob a barra.** A barra cobre os últimos 92 px da tela durante a rolagem. O padding de 253 garante que o fim do conteúdo sobe acima dos flutuantes (medido). A barra fica em z 46, acima do `.agenda-actions` (45).
6. **XP da gamificação.** O `.gm-xp-toast` (z 99999, bottom 92) pode cobrir por ~2 s a linha dos flutuantes (74–130). No padrão, ele já cobria a pílula do "+ Nova tarefa". Não consegui reproduzi-lo no teste: ele não apareceu ao marcar uma tarefa.
7. **Teclado e Safari fora do PWA.** Não emulei o teclado do iOS. Uma barra `position:fixed; bottom:0` pode ficar atrás do teclado ao digitar no Jarvis, que não é modal. No Safari em aba, a barra pode pular quando a barra de endereço recolhe. No PWA instalado, que é como o dono usa, isso não acontece.
8. **Glifos por máscara.** Os glifos das abas dependem de `mask` com SVG em data URI (Safari 15.4+). Num navegador sem suporte, cada glifo viraria um quadrado de 24 px na cor do rótulo. O texto da aba continua igual.
9. **Faixas coloridas na Sequência.** As faixas amarela e vermelha do trilho de editar e apagar aparecem nas bordas arredondadas dos cartões da Sequência. Isso já existe no padrão (`ios-ab/padrao-sequencia.png`) e não vem desta variante.
10. **No Desktop (>760 px),** o + também fica redondo. Só a forma muda: posição, abas e demais flutuantes ficam como no padrão (medido).

## Refino

Rodada de ajustes pedida pelo juiz (nota 8). Todas as mudanças ficaram em `estilos-inicio/ios.css`, sob `html[data-home="ios"]`. As 16 capturas foram refeitas com os mesmos nomes, e as extras (`extra-*`) também.

- **Scripts novos:** `ios-refino.cjs` mede os ajustes; `ios-refino-a11y.cjs` lê a árvore acessível e o padrão; `ios-refino-700.cjs` mede com 700 e 761 px de largura. Todos ficam em `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/inicio/`.
- **Resultados, na pasta `ios/`:** `refino.json` (depois) e `refino-antes.json` (o mesmo script rodado sobre `ios-antes-refino.css`). Também foram regenerados `medidas.json` e `checar.json`. As versões anteriores ficaram em `medidas-antes-refino.json` e `checar-antes-refino.json`.

### Ajustes

| # | Ajuste do juiz | Situação | Evidência (17 Pro Max / 13, escuro e claro iguais salvo indicação) |
|---|---|---|---|
| 1 | `#app-ver` à direita do Jarvis: `right:auto; left: max(18px, inset) + 66px; bottom: 80px + inset` | **aplicado** (a verificação do centro não passa; ver abaixo) | Atualizar 84–128 × 798–842 / 84–128 × 686–730; "v247" 135–159,7. Jarvis 18–74, a 10 px do Atualizar, com o centro na mesma altura (Δ 0). Atualizar 22 px acima da barra. **0 colisões** entre +, cardio, Jarvis, Atualizar, versão e barra nos 4 casos (`ios-refino.cjs` e `ios-checar.cjs`). Com o Jarvis aberto, o painel termina 14 px acima do `#app-ver` (784 → 798 / 672 → 686). Com 700 px de largura (faixa 600–760, Jarvis em `left: 22`), sobram 6 px entre Jarvis e Atualizar, sem colisão. Com 761 e 1180 volta ao padrão (`right` e `bottom` de 10). |
| 2 | `.summary-message{display:none}` | **aplicado, com variação** | A célula de progresso passou de **79 para 58 px**. A frase saiu da tela por *visually-hidden* (`position:absolute`, 1×1, `clip-path: inset(50%)`), não por `display:none`, e continua na árvore acessível: o `ariaSnapshot` da `.summary` lista "paragraph: 13% das tarefas deste dia concluídas." A margem inferior da `.progress` foi de 6 para 0 (ela só separava a frase), o que deixa 12 px em cima e 12 embaixo. A primeira célula do calendário subiu de 397,4 para **376,4** e de 375,2 para **354,2** (no padrão: 598,2 e 611,9). |
| 3 | Escuro: `.calendar-day.current{background: var(--surface)}` | **aplicado, com proteção** | O seletor ficou `.calendar-day.current:not(.selected)`. Sem o `:not`, a regra (0,4,1) apagaria o fundo de acento do dia selecionado (`.calendar-day.selected`, 0,2,0), porque o 17 é `current selected today`. Medido: o dia passa de `rgb(21,21,26)` (= célula, razão 1,00) para `rgb(12,12,15)` sobre a célula `rgb(21,21,26)`. São fundos diferentes, com razão de 1,07, e a borda `--line` dá 1,45 sobre o dia. O selecionado ficou com o mesmo fundo do padrão: `color(srgb 0.1047 0.1519 0.1906)` nos dois. No claro nada muda (dia `--soft` sobre a célula `#fff`, 1,07). |
| 4 | Claro: `#filters` em `--soft2`, `.chip.active` em `#fff` com `box-shadow: 0 1px 3px rgba(0,0,0,.14)` | **aplicado; o "> 1,18" só passa na aresta** | O trilho ficou `rgb(232,237,244)`, o ativo `#fff` e a sombra `rgba(0,0,0,.14) 0 1px 3px` está presente. **Em cor chapada, a razão continua 1,18**: é o mesmo par de antes (`#fff` e `--soft2`), só com os papéis trocados, e a razão de contraste é simétrica. O ganho vem da sombra: medi em pixel, logo abaixo da borda do segmento, `rgb(209,213,220)` contra o branco, o que dá **1,47:1**. O trilho também deixou de ter a cor da célula de progresso (1,18 contra ela; antes, 1,00). Não escureci o trilho além de `--soft2` porque "Atrasadas" (texto `--danger`, 13 px) mede 4,64:1 sobre ele, e em `--line` cairia para menos de 4,5. Com "Atrasadas" ativa, ela continua vermelha (`rgb(186,62,62)`): o branco vale só para `:not(.chip-late)`. |
| 5 | `#cardioFab{border-radius:50%}` | **aplicado** | Raio calculado de `50%` (antes 15px), 48×48, borda `--line`, sem sombra. |
| 6 | Manter `--soft` nas células escuras e o Jarvis em 74, alinhado ao + | **mantido** | Célula sobre o fundo: 1,12 (escuro). Jarvis e + em 792–848 / 680–736, os dois 16 px acima da barra. |

### A verificação "o centro do `#app-update` não cai sobre `.calendar-day.current`" não passa
- **Medido.** Com rolagem 0, na vista Mês, o centro do Atualizar está em (106, 820) no 17 Pro Max e em (106, 708) no 13. Nos dois cai sobre o **dia 26**, da 2ª coluna e 5ª linha (`calendar-day current`), nos dois temas.
- **Por que nenhuma posição ao lado do Jarvis resolve.** Em outubro de 2026, a 5ª linha (25 a 31) só tem dias do mês e ocupa a largura toda, na faixa em que os flutuantes precisam ficar acima da barra.
  - **17 Pro Max:** a 6ª linha (1 a 7 de novembro, `outside`) começa em 851,4. Para o centro do botão cair fora de um dia do mês, ele teria de ficar no vão de 4 px entre as linhas ou abaixo de 847. Nos dois casos, o botão de 44 px invadiria a barra, que começa em 864.
  - **iPhone 13:** a 6ª linha já fica toda sob a barra (781 contra 752).
- **O padrão tem o mesmo caso.** No padrão, o centro do Atualizar cai sobre o dia 24 (17 Pro Max) e sobre o 17, hoje e selecionado (13). Antes deste refino, na variante, caía sobre o 30 e o 22.
- **O que o ajuste resolveu.** O "meio do calendário" ficou livre:
  - **17 Pro Max:** o Atualizar, que é tocável, fica só sobre a coluna Seg (79,8–132,7). O "v247" (135–159,7) não recebe toque (`pointer-events: none`) e encosta na borda da coluna Ter (136,7). As colunas Qua, Qui e Sex (28, 29 e 30) ficam livres.
  - **iPhone 13:** o Atualizar invade 6 px da coluna Ter (121,6–128).
  - **Resultado:** Jarvis, Atualizar e versão formam um grupo no canto esquerdo, espelhando o grupo + e cardio no canto direito.

### Medidas refeitas (16 capturas, `h.medir`)
| Perfil | Vistas × temas | scrollWidth / viewport | Interativos sob a ilha | Fixos sob o indicador | Alvos < 44 (fora o nível B) | Nível B presentes | Erros de JS |
|---|---|---|---|---|---|---|---|
| iphone17promax | mes, dia, lista, menu × escuro, claro (8) | 440 / 440 em todas | 0 | 0 | 0 | mes 0 · dia 2 · lista 5 · menu 0 | 0 |
| iphone13 | mes, dia, lista, menu × escuro, claro (8) | 390 / 390 em todas | 0 | 0 | 0 | mes 0 · dia 2 · lista 5 · menu 0 | 0 |

Nenhum elemento transbordando. A única "sobreposição" registrada é o `#quickMenu` aberto nas vistas `menu`, dentro da área segura (164–424 × 134–603 / 114–374 × 119–588), como antes.

**`ios-checar.cjs` rodado de novo:**
- **Escopo:** 53 seletores, 0 fora do prefixo, uma única media query `(max-width: 760px)`.
- **Efeito nulo sem o atributo:** 0 diferenças em 6 vistas × 2 temas × 2 perfis (551 a 2.163 elementos por vista).
- **Abas:** a barra fica em 864 e 752 com a página rolada (359 e 394 px). Os cliques nas 4 abas com a página rolada seguem a aba ativa.
- **Sequência:** 0 sob a ilha, 0 alvos < 44, 2 do nível B.
- **Jarvis:** painel 8 px acima do botão, 0 sob a ilha.
- **Demais:** toast 11 px acima do cardio. O + continua com nome acessível "Nova tarefa" e abre o diálogo. Desktop 1180 igual ao padrão. 0 erros de JS.
- **Data longa no 13** ("quarta-feira, 30 de setembro"): quebra em 2 linhas, e a primeira célula vai a 373,2 (antes 394,2).
- **Atenção:** no `checar.json`, o campo `chipAtivoSobreTrilho` do claro agora dá 1. Esse script compara o segmento com a célula de progresso, não com o trilho. O par certo, segmento sobre `#filters`, está no `refino.json` (1,18 chapado e 1,47 na aresta).

### O que fica valendo no lugar do texto acima
- **Na tabela "O que mudou de lugar":**
  - Progresso é uma célula de **58 px**, só com número e barra; a frase fica apenas para o leitor de tela.
  - Atualizar e versão ficam **à direita do Jarvis** (84–128 e 135–159,7), não mais à esquerda do +.
  - Cardio é **redondo**.
- **No "Ganho medido":** a primeira célula fica em **376,4 / 354,2** (−221,8 / −257,7 px contra o padrão).
- **Nas decisões e nos riscos:** os itens "1. Colisão do `#app-ver`" e "Risco 1" foram substituídos por este refino. O item 3 dos riscos ("dia atual do mês com o mesmo fundo da célula") deixa de valer no escuro.

### Riscos que continuam ou surgiram
1. **O Atualizar flutua sobre o conteúdo** (antes também flutuava).
   - **Vista Dia, rolagem 0:** fica sobre o "Compartilhar" (`.agenda-share`) de uma tarefa; antes ficava sobre o `.notas-toggle`.
   - **Vista Lista:** fica sobre o corpo de um cartão.
   - **Efeito:** como o `#app-ver` está em z 99, um toque nesse ponto vai para o Atualizar. Rolar a página tira o conflito.
2. **"v247" no tema claro.** O selo tem a cor do padrão (`rgba(255,255,255,.3)`) e quase não aparece sobre fundo claro. Isso já acontece no padrão e não foi mexido.
3. **Segmento ativo no claro.** A separação depende da sombra de 1 px e 3 px de desfoque. Em tela real com brilho alto, isso pode ser mais sutil que nos 1,47:1 medidos.
