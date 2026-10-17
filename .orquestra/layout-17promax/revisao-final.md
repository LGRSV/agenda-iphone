# Revisão final adversarial (C2) — layout do Agenda Lagares no iPhone 17 Pro Max

Frente C2 da missão `layout-17promax`, 17/10/2026. Revisor independente: não participei da implementação
(F3/F4) nem da verificação (F5). Não editei o repositório; todos os mutantes e experimentos rodaram em
cópias no scratchpad. Nada abaixo usa `git commit`, `stash` ou `checkout`.

- **Entrega revisada:** árvore de trabalho de `/home/user/agenda-iphone` (`git diff 3081ea4 -- . ':!.orquestra'`,
  18 arquivos). `sw.js` ainda em `agenda-lagares-v246-mais-leve` (o aumento do CACHE é do maestro, P7).
- **Ambiente:** Chromium 141 (`/opt/pw-browsers/chromium-1194`), Playwright de `/opt/node-tools`, área segura
  emulada pelo CDP via `harness/medir.cjs` (`env()` conferido em cada abertura: 62/34, 47/34, 20/20/62/62).
- **Servidores:** 8765 (repositório), 8799/8800/8801/8802 (cópias para mutantes), 8803 (cópia do commit
  base `3081ea4`, "antes"), 8804 (cópia de experimento).
- **Pasta de trabalho:** `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/c2/`
  (abaixo, `c2/`). Scripts em `c2/*.cjs`, saídas em `c2/saidas/`, capturas em `c2/capturas/`.

---

## (a) Veredito: **reprovado** (1 defeito bloqueante, com correção medida)

| id | gravidade | impede? | resumo |
|---|---|---|---|
| R2 | **bloqueante** | sim | Paisagem: a linha microfone/campo/enviar do Jarvis fica 22,2 px cortada (regressão desta missão) e o painel invade a faixa de cima (13,2 < 20, já existia). O plano exige "em paisagem, só não quebrar". Correção de 2 regras no `index.html`, medida: `top` 20, corte 0, retrato inalterado nos dois perfis e no estado do bug 301994. |
| R1 | importante | não | Nível B: as pílulas com borda de 1 px têm zona de toque real de **42 px**, não 44 (`.notas-toggle`, `.agenda-share`, `.tr-open`; nas auxiliares `.sa-foot button` e `.editbtn`). O `::before` com `top/bottom:-8px` é medido a partir da caixa de padding, que exclui a borda. O teste (±6 px) não vê a diferença. Correção: `-9px`; medido 44. |
| R3 | menor | não | Paisagem, diálogo de nova tarefa: termina em 424 > 420 (4 px sob o inset de baixo). Correção medida: `max-height` do `dialog` descontando os insets → 36..404. |
| R4 | menor | não | Alvos < 44 fora da lista fechada nas auxiliares: `equipamentos-especiais` `.toolbar button` 200×34 (×3) e `.catbar button` 201×36 (×2); `financeiro #pluxeeEdit` 56,5×25 (abaixo até do mínimo 28 da HIG, sem nível B). |
| R5 | menor (teste) | não | `S6.1` não enxerga transbordo recortado: um elemento de 470 px na Lista (mutante M7) deixa `scrollWidth` 440 e `transbordando` 0 porque `html`/`body` têm `overflow-x:clip` e `.view-shell` tem `overflow:hidden`; o botão aparece cortado na tela. Só o grep de texto pegou. |
| R6 | menor (teste) | não | O teste de nível B (`elementFromPoint` a ±6 px) aceita zona de 42 (R1) e só reprova a partir de 40 (mutante M14). |
| R7 | menor (processo) | não (é a etapa P7) | `sw.js` segue em v246 (esperado nesta etapa). Ao aumentar o CACHE, atualizar também as constantes mortas `NOTAS_SCRIPT ?v=9`, `SHARING_SCRIPT ?v=4`, `SEQ_SCRIPT ?v=3` (hoje não injetadas; se um dia forem, injetariam versões velhas). |
| R8 | menor (pré-existente) | não | `#jarvis-form` tem `padding-bottom:calc(10px + env(safe-area-inset-bottom))` dentro de um painel que já fica 90 px + inset acima do fundo: 34 px mortos no retrato (form 732..831 para uma linha de 44), 20 em paisagem. Contribui para o R2. |
| R9 | menor (pré-existente) | não | Paisagem: `#viewmode-btn` ("Desktop", 94,5×31, `z-index:3000`) aparece em `top` 29 sobre os botões do cabeçalho (observação 2 da F5). Fora do escopo. |

**O que passa:** no retrato, nos dois perfis e em mais três tamanhos (375×812, 430×932, 320×568), as três
medições centrais batem com o `layout.cjs` em todas as 9 vistas (seção d). Nenhum dos 16 mutantes
sobreviveu (seção c). Tema claro, bug 301994, teclado (simulado), textos longos e fonte maior não quebram
nada (seção e). O iPhone 13 não quebra, mas perde espaço vertical de forma perceptível (item 5 abaixo).

**Para virar "aprovado" (rodada 3):** aplicar R2 (obrigatório) e, recomendado, R1, R3, P2 e as três linhas
do R4; depois rodar `layout.cjs` (com o critério S6.10 passando) e seguir para P7.

---

## (b) Achados

### R2 — bloqueante — paisagem: linha de entrada do Jarvis cortada (regressão) e painel sob a faixa de cima

- **Reproduzir:** `node c2/estados.cjs paisagem http://127.0.0.1:8765/` (saída `c2/saidas/estados-2.txt`,
  seção "paisagem/variantes — iphone17promax-paisagem"); perfil `{956×440, insets 20/20/62/62}`, vista `jarvis`.
- **Medida (atual):** `#jarvis-panel.open` 13,2..330 (altura 316,8 = 72dvh); `#jarvis-mic`, `#jarvis-input`,
  `#jarvis-send` em 308,2..352,2 → **22,2 px escondidos** pelo `overflow:hidden` do painel. Pilha dentro do painel:
  header 14,2..77,2 (63), locbar 77,2..121,2 (44), msgs 121,2..241,2 (120, `min-height:120px`), chips
  241,2..297,2 (56), form 297,2..382,2 (85). Antes da missão (v246) a linha cabia (F5: 286,2..326,2).
- **Causa:** o painel é ancorado em `bottom:calc(90px + env(safe-area-inset-bottom))` com `max-height:72dvh`, sem
  olhar `env(top)`; os +44/+13/+4 px desta missão (locbar 29→44, chips 43→56, linha 40→44) somados ao
  `min-height:120px` do `#jarvis-msgs` passam de 310 px, e o `#jarvis-msgs` não encolhe.
- **Arquivo e linha:** `index.html:801` (`#jarvis-panel`) e `index.html:811` (`#jarvis-msgs`).
- **Correção (old → new):**
  - `index.html:801`: `bottom:calc(90px + env(safe-area-inset-bottom));max-height:72dvh;` →
    `bottom:calc(90px + env(safe-area-inset-bottom));max-height:min(72dvh,calc(100dvh - 90px - env(safe-area-inset-bottom,0px) - env(safe-area-inset-top,0px)));`
  - `index.html:811`: `gap:10px;min-height:120px}` → `gap:10px;min-height:min(120px,15dvh)}` (regra `#jarvis-msgs`)
- **Medido com a correção** (variante "C2: max-height + msgs min-height:min(120px,15dvh)", CSS acrescentado no fim do
  `body`, mesma posição de cascata da regra original):

  | perfil | painel antes | painel depois | linha de entrada depois | cortado | msgs |
  |---|---|---|---|---|---|
  | paisagem 956×440 | 13,2..330 | **20..330** (310) | 261..305 (dentro de 330, 25 px de folga) | 22,2 → **0** | 120 → 66 |
  | 17PM retrato | 354,9..832 (477,1) | 354,9..832 (477,1) | 743..787 | 0 | 213,1 (inalterado) |
  | 13 retrato | 213,7..720 (506,3) | 213,7..720 (506,3) | 631..675 | 0 | 232,3 (inalterado) |
  | bug 301994 (440×894, top 0) | 292,9..770 (477,1) | 292,9..770 (477,1) | 681..725 | 0 | inalterado |

  Variantes descartadas, medidas no mesmo lugar: só o `max-height` da F5 corrige o `top` (20) mas piora o corte
  (22,2 → 29); `min(120px,20dvh)` zera o corte com 3 px de folga (frágil: o título do cabeçalho em 3 linhas já
  comeria); tirar o `env()` do `#jarvis-form` (R8) encurta o painel em 34 px no retrato (443,1) — opcional.
  A mesma fórmula resolve o caso de altura baixa com teclado (seção e): em 440×610 o `top` passa de 46,8 para
  62 (= inset), por construção (610 − 124 − (610 − 90 − 34 − 62) = 62).
- **Capturas:** `c2/capturas/estados/paisagem-jarvis-atual.png` e `paisagem-jarvis-C2_max_height_msgs_min_height_min.png`.

### R1 — importante — nível B com borda: zona de toque de 42 px, não 44

- **Reproduzir:** `node c2/scan-borda.cjs http://127.0.0.1:8765/` (varredura de `elementFromPoint` a cada 0,5 px nas
  bordas, Lista, 17PM) e `node c2/toque-pilulas.cjs http://127.0.0.1:8765/ iphone17promax dia` (bisseção 0,1 px).
  Nas auxiliares: `node c2/zona-aux.cjs`.
- **Medida:** `.notas-toggle` (rect 463,78..491,78, borda 1 px): acerta de **−7,5 a +6,5** (zona [top−7, bottom+7] =
  **42 px**); idem `.agenda-share` e `.tr-open`. `.list-previous` (borda 0): −8,5 a +7,5 = **44**. Bisseção: 42,9
  (pílulas com borda) contra 44,9 (`.list-previous`), o mesmo artefato de 0,9 nos dois. Auxiliares: `#conedit` e
  `.editbtn` ×4 (borda 1 px) → 43 pela bisseção (= 42); `.iv-foot button` (borda 0) seria 44.
- **Causa:** `position:absolute` com `top:-8px;bottom:-8px` é resolvido contra a **caixa de padding** do botão,
  que não inclui a borda de 1 px; a zona vale `28 − 2 + 16 = 42`.
- **Correção (old → new), todas medidas no app depois de aplicar (zona −8,5..+7,5 = 44 nas três pílulas):**
  - `notas.js:61`: `.notas-toggle::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}` →
    `…top:-9px;bottom:-9px}`; `index.html` `notas.js?v=10` → `?v=11`.
  - `agenda-sharing.js:40`: `.agenda-share::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}` →
    `…top:-9px;bottom:-9px}`; `agenda-sharing.js?v=5` → `?v=6`.
  - `treino.js:403`: `.tr-open::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}` →
    `…top:-9px;bottom:-9px}`; `treino.js?v=13` → `?v=14` em `index.html` **e** `treino.html`.
  - `financeiro.html` (linha 2): `.sa-foot button::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}` →
    `…top:-9px;bottom:-9px}` (`.iv-foot button::before` fica em −8: borda 0).
  - `investimentos.html:33`: `.editbtn::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}` →
    `…top:-9px;bottom:-9px}`.
  - Nas auxiliares não medi depois da correção; a geometria é a mesma (borda 1 px).
  - Contrato (especificação 3.0 e 5.3): "nível B = `top/bottom: −(8 px + largura da borda)`".
- **Com a R2b/P2 (gap 6):** zona 44 continua sem sobreposição entre botões (0 pares nos 60 cartões, dois perfis;
  `c2/saidas/rodape-c2b.txt`, variante "C2b + ::before -9px").

### R3 — menor — paisagem: diálogo de nova tarefa 4 px sob o inset de baixo

- **Reproduzir:** `c2/estados.cjs paisagem`, vista `nova-tarefa`, perfil paisagem.
- **Medida:** `#taskDialog` 16..424 (480×408 = `100dvh − 32px`), `select#taskRepeat` com `bottom` 424 > 420
  (= 440 − inset 20); conteúdo rola (scrollHeight 582 / clientHeight 406).
- **Correção:** `index.html:21`: `max-width:calc(100% - 32px);max-height:calc(100dvh - 32px);` →
  `max-width:calc(100% - 32px);max-height:calc(100dvh - 32px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));`
  (regra `dialog`; `#voz-dialog`, `#treinoDialog` e `#cardioDiaDialog` têm `max-height` próprio por id, não mudam).
- **Medido:** paisagem 16..424 → **36..404** (480×368); retrato 17PM 186,1..769,9 (408×583,8) e 13 130,1..713,9
  (358×583,8): inalterados (variante "C2 + dialog max-height com insets").

### R4 — menor — alvos < 44 nas auxiliares, fora da lista fechada

- **Reproduzir:** `node c2/aux-alvos.cjs http://127.0.0.1:8765/` (17PM; `c2/saidas/aux-alvos.txt`).
- **Medidas:** `equipamentos-especiais.html`: `button.prim` ×2 e `div.toolbar > button` **200×34**;
  `button.cb-analise` e `button.cb-ncon` **201×36** (a especificação 4.7 os dá como 130,7×48 e 132×50 "medido";
  a F5 já tinha notado). `financeiro.html`: `#pluxeeEdit` **56,5×25** (criado por `finance-pluxee.js:86`; sem
  nível B, abaixo do mínimo 28). Demais auxiliares: nenhum interativo < 44 além dos de nível B.
- **Correção sugerida (não medida depois):**
  - `equipamentos-especiais.html:61`: `.toolbar button{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);color:#fff;padding:9px 12px;` →
    `.toolbar button{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);color:#fff;min-height:44px;padding:9px 12px;`
  - `equipamentos-especiais.html:66`: `.catbar button{flex:1;min-width:132px;border:none;border-radius:10px;padding:11px 8px;` →
    `.catbar button{flex:1;min-width:132px;min-height:44px;border:none;border-radius:10px;padding:11px 8px;`
  - `financeiro.html`, no fim do `<style>` da linha 2: acrescentar
    `#pluxeeEdit{position:relative;min-height:28px}#pluxeeEdit::before{content:"";position:absolute;left:0;right:0;top:-9px;bottom:-9px}`
    (nível B com borda de 1 px).

### R5 — menor (lacuna de teste) — transbordo recortado é invisível ao S6.1

- **Reproduzir:** mutante M7 (`width:470px` em `.list-more`, cópia em 8804): `node c2/m7-shot.cjs`.
- **Medida:** `.list-more` 17..487 (470 de largura) com `innerWidth` 440; `scrollWidth` **440**; ancestrais que
  recortam: `html` e `body` `overflow-x:clip`, `.view-shell` `overflow:hidden`. `layout.cjs`: `S6.1.*.lista` ok
  (scrollWidth 440, transbordando 0); minha `cruzada.cjs` também não vê (recorta pelos mesmos ancestrais). O botão
  "Mostrar mais 60 de 277" aparece cortado na borda direita (`c2/capturas/M7-list-more-cortado.png`).
- **Sugestão para o `layout.cjs`:** além de `scrollWidth`, comparar `getBoundingClientRect().right` de cada elemento
  com `innerWidth + 0,5` **sem** descontar o recorte de `html`, `body`, `.app` e `.view-shell`; ou conferir
  `scrollWidth > clientWidth` em `.view-shell` e `.app`.

### R6 — menor (lacuna de teste) — a sonda de nível B (±6 px) tolera 2 px de falta

- **Evidência:** entrega atual com zona de 42 passa (`S6.3.*.B.*` ok); mutante M14 (`top/bottom:-7px`, zona 40) falha.
- **Sugestão:** sondar em `rect.top − 8 + 0,5` e `rect.bottom + 8 − 0,5` (ou medir a extensão por bisseção, como
  `c2/toque-pilulas.cjs`) e exigir ≥ 44 − 0,5.

### R7 — menor (processo) — `sw.js`

- `const CACHE = 'agenda-lagares-v246-mais-leve'` (etapa P7 pendente, do maestro). Constantes com versões
  antigas: `sw.js:7` `notas.js?v=9`, `:13` `agenda-sharing.js?v=4`, `:27` `sequencial.js?v=3` (`treino.js` já em
  13). Hoje não têm efeito: `index.html` contém as strings `financeiro.html` e `gamificacao.html`, então
  `isAuxPage` é verdadeiro para a própria página principal e o `sw.js` não injeta nada nela (conferido no código,
  `sw.js:55-64`). Risco latente: se isso mudar, o `sw.js` injetaria `interface-polish.css`, cujo `body::before`
  (`z-index:-1;inset:0;pointer-events:none`, mesma especificidade e posterior na cascata) anularia o véu
  (medido numa cópia com a injeção forçada: véu com `z-index -1`, `pointer-events none`, `elementFromPoint(220,31)`
  rolado = `main.app`). Sugestão: ao aumentar o CACHE, alinhar as três constantes (`?v=10`, `?v=5`, `?v=4`).

### R8 — menor (pré-existente) — `#jarvis-form` com `env()` morto

- **Medida (17PM retrato):** `#jarvis-form` 732..831 (99 px) para uma linha de 44 (743..787): 10 + 44 + 10 + 34 (`env`)
  + borda. Em paisagem 85 px (20 de `env`). O painel nunca encosta no indicador (`bottom` 90 + inset).
- **Opcional:** `index.html:817` `padding:10px 12px calc(10px + env(safe-area-inset-bottom));` → `padding:10px 12px;`.
  Medido: painel do 17PM 477,1 → 443,1 (linha de entrada 777..821, 11 px da borda do painel); 13: 506,3 → 472,3.
  Não é necessário para o R2.

---

## Pontos de projeto que o coordenador pediu para julgar

Medições com `node c2/pontos.cjs <base> [css]` (saída `c2/saidas/pontos.txt`, `pontos-p3.txt`) e
`node c2/rodape.cjs` (`rodape.txt`, `rodape-c2b.txt`); "antes" = commit `3081ea4` servido em 8803.

### 1. Botões flutuantes sobre o calendário (B1) — **aceitar como está**

Mês, rolagem 0, células cobertas por `#openDialog`, `#cardioFab`, `#jarvis-btn`, `#app-update`/`#app-ver`:

| | 17PM antes | 17PM depois | 17PM + cardio ao lado do "+" | 13 antes | 13 depois | 13 + cardio ao lado |
|---|---|---|---|---|---|---|
| células visíveis / cobertas | 28 / 8 | 28 / 8 | 28 / 8 | 28 / 11 | 21 / 10 | 21 / 10 |
| hoje (17/10) coberto | 76 % | **87 %** | 80 % | 76 % (app-update) | 45 % | 45 % |
| pior célula | 24/10 77 % | 24/10 53 %, 16/10 62 % | 16/10 62 % | 10/10 84 % | 10/10 **101 %** | 10/10 101 % |
| altura do grupo +/cardio | 111 | 111 | 54 | 111 | 111 | 54 |

- A subida de 16 px (A6) custou +11 pontos na cobertura de hoje no 17PM; no 13 a célula 10/10 fica inteira
  coberta a rolagem 0. Pôr o `#cardioFab` ao lado do "+" (`.agenda-actions{flex-direction:row;align-items:center;gap:10px}`)
  reduz a altura do grupo de 111 para 54, mas não reduz o número de células cobertas (o "+" de 148,8×54 é o que
  cobre), e muda a identidade do grupo. Não vale.
- Como o conteúdo rola e o `padding-bottom` de 230 px garante a última linha, **aceito**. Fica registrado como
  item de produto para depois: recolher o grupo ao rolar (comportamento, fora deste escopo).

### 2. Rodapé do cartão com `gap:16px 6px` — **propor P2: `gap:6px` + `row-gap:16px` só nos cartões com `.tr-open`**

Lista, 60 cartões, linhas reais (agrupadas por sobreposição vertical) e sobreposição das zonas de 44 entre
botões do mesmo cartão (`c2/rodape.cjs`):

| variante | 17PM: botões em 2+ linhas / cartões com zonas sobrepostas / altura média / scrollHeight | 13: idem |
|---|---|---|
| antes da missão (gap 6, pílulas 21–24) | — / — / 100,4 / 7516 | — / — / 114 / 8348 |
| atual (`gap:16px 6px`) | 50 / **0** / 119,1 / 8696 | 50 / **0** / 135,7 / 9708 |
| só `gap:6px` | 50 / 9 (tr-open × agenda-share) / 110,6 / 8186 | 50 / 9 / 124,2 / 9018 |
| pílulas na própria linha (`order` + quebra) | 0 / 0 / 117,5 / 8602 | 9 / 0 / 130,6 / 9398 |
| **P2:** `gap:6px` + `.task-footer:has(.tr-open){row-gap:16px}` | 50 / **0** / **113,4** / 8356 | 50 / **0** / **128,6** / 9278 |
| P2 + R1 (`-9px`) | 50 / 0 / 113,4 / 8356 | 50 / 0 / 128,6 / 9278 |

- Por que o 16 era caro demais: os botões ficam em duas linhas em 50 cartões, mas `.notas-toggle` tem
  `margin-left:auto` (encostado à direita) e `.agenda-share` quebra para a esquerda da linha de baixo — as zonas
  não se cruzam horizontalmente. Só o `.tr-open` (também `margin-left:auto`) empilha sob outra pílula da direita:
  com gap 6, 9 cartões têm sobreposição (ex.: `tr-open` 2018,5..2060,5 × `agenda-share` 2052,5..2094,5).
- **P2 (old → new), `index.html:21`:**
  `.task-footer{display:flex;flex-wrap:wrap;align-items:center;gap:16px 6px;margin-top:6px}` →
  `.task-footer{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px}.task-footer:has(.tr-open){row-gap:16px}`
  (`:has()` existe no iOS desde o 15.4; o dono usa 26/27). Ganho: −5,7 px por cartão no 17PM e −7,1 no 13,
  zonas de 44 intactas (0 sobreposições nos dois perfis). Se uma nova pílula ganhar `margin-left:auto`, incluir
  no `:has()`.

### 3. Orçamento vertical (+22 px no topo) — **aceitar no 17PM; no 13, propor P3 (opcional)**

Pilha do Mês (rolagem 0), `c2/saidas/pontos.txt`:

| | 17PM antes → depois | 13 antes → depois | 13 + P3 |
|---|---|---|---|
| `#viewTabs` | 47 → 54 (326,2..380,2) | 47 → 54 | 54 (margem 12 → 8) |
| `#seqEntryBtn` | 40 → 44 | 40 → 44 | 44 (margem 14 → 10) |
| `#filters` | 50 → 60 | 50 → 60 | 56 (padding inferior 14 → 10) |
| `.toolbar` | 61 → 62 | 61 → 62 | 62 |
| 1ª `.calendar-day` (top) | 576,2 → 598,2 (**+22**) | 589,9 → 611,9 (**+22**) | **593,9** (−18; 4 acima do antes) |
| células do Mês no viewport | 28 → 28 | 28 → **21** | 21 |

- 17PM: +22 de +97 px úteis ganhos; aceito.
- 13: perde uma linha do calendário a rolagem 0 e os cartões crescem 19 % (ver item 5). Recuperar 18 px sem tocar
  em nenhum alvo, só nas folgas, e só no 13 (dentro do `@media(max-width:390px){…}` da linha 21):
  acrescentar `.topbar{margin-bottom:16px}#viewTabs{margin-bottom:8px}#seqEntryBtn{margin-bottom:10px}#filters{padding-bottom:10px}`
  (ids para vencer a ordem de cascata: `.seq-entry-btn{margin:0 0 14px}` vem de `sequencial.js`, injetado depois).
  Medido com o equivalente por classe injetado no fim do `head`: 1ª célula 611,9 → 593,9, `#filters` 60 → 56,
  17PM inalterado (598,2). Muda só o ritmo de espaçamento do 13; por isso opcional.

### 4. Falhas da verificação (F5, seção c)

- **Paisagem, painel sob o topo (13,2 < 20):** já existia; corrigido junto com o R2 (`max-height` com insets): medido
  `top` 20 em paisagem, retrato inalterado (tabela do R2).
- **Regressão da linha de entrada (22,2 px cortados):** R2, correção medida acima. A proposta da F5
  (`min(120px,20dvh)`) também zera o corte, mas deixa 3 px de folga; recomendo `15dvh` (25 px de folga).
- **Grep do marketplace:** defeito do texto da especificação (o `new` `width:44px;height:44px;` é genérico e o `old`
  de `#cofre label` é prefixo do `new`). Correção na especificação 4.6: `new` de `.x` →
  `.x{float:right;display:grid;place-items:center;width:44px;height:44px;` e, para `#cofre label`, exigir só
  `grep -c new = 1`. O app está certo (medido: `#cofre label` 342×44, `#cofreLembrar` 22×22).

---

## (c) Teste de mutação

Método: cópia do repositório sem `.git` (`tar --exclude=.git`) em `c2/mutante{,1,2,3}/`, servida em
8799–8802; o `layout.cjs` **da própria cópia** (`<cópia>/.orquestra/layout-17promax/testes/layout.cjs <url>`,
`LAYOUT_CAPTURAS` em `c2/capturas/<id>/`) roda contra a porta da cópia, depois o arquivo é restaurado do
repositório. Baseline (cópia sem mutação): 384 verificações, 381 ok, as mesmas 3 falhas da F5, saída idêntica
linha a linha à `testes/saida-layout.txt` (ok/FALHOU e ids). Runner: `c2/mutantes.cjs`; logs
`c2/saidas/mutantes-w{0..3}.log`; saída completa de cada mutante em `c2/saidas/mut-M<n>.txt`.
"Pegou" conta só verificações de layout/texto; as falhas de suíte E2E (`S6.5.e2e-voz-saida`, `S6.5.e2e-atualiza`,
1 teste em 1 das 9 suítes) apareceram em 9 das 16 execuções com 4 Chromiums em paralelo e não no baseline:
ruído de carga, não detecção.

| id | mutante | como foi feito (arquivo, old → new) | pegou? | por quê (ids novos que falharam) |
|---|---|---|---|---|
| M1 | `.view-tab` volta a 37 | `index.html` `.view-tab{min-height:44px;` → `37px` | **sim** (22) | S6.3 pequenos/view-tab, S6.9 viewTabs/celulaTop, P3, S6.8 |
| M2 | tira o véu | `index.html` remove `body::before{…z-index:60;background:var(--bg)}` | **sim** (8) | S6.7 estilo e rolado (2 perfis), S6.8 |
| M3 | tira o `max-width` dos diálogos | `index.html` `dialog{…;max-width:calc(100% - 32px);` → sem | **sim** (7) | S6.4 taskDialog/alertsDialog (2 perfis), S6.8 |
| M4 | `#jarvis-mic` volta a 40 | `index.html` `#jarvis-mic{width:44px;height:44px;` → `40px` | **sim** (7) | S6.3 jarvis pequenos/#jarvis-mic, P3, S6.8 |
| M5 | quebra o nível B do `.notas-toggle` | `notas.js` remove a linha `.notas-toggle::before{…}` | **sim** (10) | S6.3.*.B.notas-toggle nas 4 vistas × 2 perfis, S6.8 |
| M6 | `#app-update` a 6 px do indicador | `index.html` `#app-ver` `bottom:calc(10px + env…)` → `6px` | **sim** (18) | S6.2 folga8 em 7 vistas × 2 perfis, S6.2 folga.app-update, S6.8 |
| M7 | `width:470px` num elemento da Lista | `index.html` `.list-more{…min-height:44px;` + `width:470px;` | **só pelo texto** (2) | S6.8.index.html (old/new). **S6.1 passou** (scrollWidth 440, transbordando 0) → R5 |
| M8 | remove o `?v=13` do treino | `treino.html` `treino.js?v=13` → `?v=10` | **sim** (3) | S6.8.versoes, S6.8.treino.html (só texto pode pegar: o servidor local ignora `?v=`) |
| M9 | `.chip` volta a 34 | `index.html` `.chip{flex:0 0 auto;min-height:44px;padding:0 13px;` → `padding:8px 13px;` | **sim** (22) | S6.3 pequenos/#filters.chip, S6.9 filters/celulaTop, P3, S6.8 |
| M10 | véu com cor diferente do fundo | `index.html` véu `background:var(--bg)` → `#000` | **sim** (6) | S6.7 estilo (mes/lista × 2 perfis), S6.8 |
| M11 | `.agenda-actions` volta a 46 | `index.html` `bottom:calc(62px + env…)` → `46px` | **sim** (7) | S6.2 folga.openDialog/cardioFab (2 perfis), S6.8 |
| M12 | `.barra` do marketplace gruda em 0 | `marketplace/index.html` `top:env(safe-area-inset-top,0px)` → `top:0` | **sim** (3) | S6.6.marketplace.barra, S6.8 |
| M13 | grade do cartão volta a 25/32, gap 10 | `index.html` `.task-card{…34px minmax(0,1fr) 34px;gap:6px;` → `25px … 32px;gap:10px;` | **sim** (4) | S6.4 taskMain (296/246 esperado) × 2, S6.8 (os alvos de 44 continuam passando: a caixa transborda a coluna) |
| M14 | nível B com ±7 (zona de 40) | `notas.js` `top:-8px;bottom:-8px` → `-7px` | **sim** (10) | S6.3.*.B.notas-toggle (8), S6.8 — e a entrega real, com zona 42, passa → R6 |
| M15 | `.vz-x` volta a 30 | `vozes-neurais.js` `#voz-dialog .vz-x{width:44px;height:44px;` → `30px` | **sim** (6) | S6.3 voz pequenos/.vz-x × 2, S6.8 |
| M16 | tira a regra do `#jarvis-locbar` | `index.html` remove `#jarvis-locbar{min-height:44px!important;…}` | **sim** (6) | S6.3 jarvis pequenos/#jarvis-locbar × 2, S6.8 |

**Resultado: 16 mutantes, 16 pegos (14 por medição, 2 só pelo grep de texto: M7 e M8). Nenhum sobreviveu.**
Lacunas reveladas: M7 (R5) e a tolerância da sonda de nível B (M14 passa a reprovar só em 40; R6). Tempo por
execução: 296–366 s com 4 em paralelo (baseline sozinho: ~8 min).

---

## (d) Validação cruzada

Reimplementação própria em `c2/cruzada.cjs` (escrita e rodada antes de ler o `layout.cjs`): (a) interativos
visíveis com `top < inset` a rolagem 0 e fixos com `bottom > H − insetB` (recorte por ancestrais com
`overflow`, inert, modal, opacidade, `pointer-events`); (b) alvos < 44 por `getBoundingClientRect` **mais** a
extensão real de toque por `elementFromPoint` (varredura de 1 px pelo centro, até 61×61); (c) `scrollWidth`,
rolagem **real** (`scrollTo(5000,0)` → `scrollX`) e elementos que passam do viewport. Perfis extras com
insets de aparelhos reais: 375×812 = iPhone 13 mini (50/34), 430×932 = 15/16 Pro Max (59/34), 320×568 =
SE 1ª geração (20/0). Saídas: `c2/saidas/cruzada-principais.txt`, `cruzada-extras.txt`, `cruzada-*.json`.

| perfil × 9 vistas | scrollWidth (meu / layout.cjs) | scrollX real | transbordo | sob a ilha | fixos sob o indicador | folga mín (meu / layout.cjs) | alvos < 44 (meu / layout.cjs) |
|---|---|---|---|---|---|---|---|
| 17PM 440×956 | 440 / 440 em todas | 0 | 0 | 0 / 0 | 0 / 0 | mes…jarvis 10 / 10; nova-tarefa 174,1 / 174,1; voz 129,3 / 129,3 | mes 0/0, dia 16/16, lista 130/130, atrasadas 48/48, sequencia 16/16, menu 0/0, nova-tarefa 1/1, jarvis 0/0, voz 2/2 — mesmos seletores e tamanhos |
| 13 390×844 | 390 / 390 | 0 | 0 | 0 / 0 | 0 / 0 | 10 / 10; 118,1 / 118,1; 69,8 / 69,7 | idem (voz: `a` 317,9×28,2 nos dois: o link quebra em 2 linhas no 13) |
| 375×812 (50/34) | 375 | 0 | 0 | 0 | 0 | 10; nova-tarefa 102,1; voz 67,5 | como no 13, mais `.calendar-day` 43,8–43,9 de largura (×42; 0,2 px abaixo de 44; fora da lista) |
| 430×932 (59/34) | 430 | 0 | 0 | 0 | 0 | 10; 162,1; 117,3 | como no 17PM |
| 320×568 (20/0) | 320 | 0 | 0 | 0 | 0 | 10; nova-tarefa 16 (diálogo a 16 px do fundo, sem indicador); voz 99,6 | como no 13, mais `.calendar-day` 36×78 (×42) |

- **Divergências com o `layout.cjs`: nenhuma** nos números comparáveis (108 células: 2 perfis × 9 vistas × 6 medidas).
  A única diferença é de arredondamento (voz, 13: folga 69,8 × 69,7).
- **O que só a minha medição mostra:** a extensão real de toque das pílulas de nível B é **61×42** (R1), contra 61×44 de
  `.list-previous` e 44×44 de `#taskLembrete` (o `<label>` de 44 cobre); `a(Kokoro-82M)` no 13 tem toque 0×0 no
  centro porque a caixa de 2 linhas tem o centro no vão entre linhas (links de crédito, fora do escopo).
- Além disso: `c2/aux-alvos.cjs` (12 auxiliares, 17PM): `scrollWidth` 440 em todas; alvos < 44 só os do R4 e os
  de nível B (financeiro: `#conedit` 65,9×28; os `.iv-foot button` e `#pluxeeEdit` estão em slides laterais do
  pager, x = 762–1606).

---

## (e) O que testei (lista completa)

Técnica 1 — validação cruzada
- `c2/cruzada.cjs` nos perfis 17PM e 13 (9 vistas) contra 8765; 375×812, 430×932, 320×568 (9 vistas). Comparação
  automática com `testes/saida-layout.txt`. Resultado na seção (d).
- `c2/toque-pilulas.cjs` (bisseção 0,1 px) em `dia` e `lista` do 17PM; `c2/scan-borda.cjs` (varredura 0,5 px nas
  bordas) na Lista do 17PM, sem e com a correção `-9px`; `c2/zona-aux.cjs` (financeiro, investimentos).
- `c2/aux-alvos.cjs`: as 12 páginas auxiliares, 17PM, interativos < 44 e zonas de nível B.

Técnica 2 — mutação: 16 mutantes (tabela c) + baseline da cópia; capturas de cada execução em `c2/capturas/M<n>/`;
`c2/m7-shot.cjs` para a prova visual do M7.

Técnica 3 — estados do aparelho (`c2/estados.cjs <estado>`; `c2/saidas/estados-2.txt`; capturas em
`c2/capturas/estados/`):
- **Bug 301994** (440×894, `env(top)` 0, `env(bottom)` 34): mes, dia, lista, jarvis, nova-tarefa, voz —
  `scrollWidth` 440, nada sob a faixa (véu com altura 0, `.app` com `padding-top` 18, primeiro texto em 20),
  nada fixo sob o indicador, folga 10, Jarvis 292,9..770. **Resultado: nada quebra.**
- **Tema claro** (`dataset.theme='light'`), 17PM e 13, vistas mes, lista, menu, jarvis, nova-tarefa, voz: véu
  `rgb(244,246,250)` = fundo do `body` nos dois perfis; z-index: véu 60 < Jarvis 101 < menu 120, diálogos em top
  layer; rolado 400 → `(220,31)` = `body` (mes, lista, jarvis), = menu (vista menu: certo, o menu fica acima do véu),
  = diálogo (nova-tarefa, voz). `marketplace/` sem `trancado` em tema claro: véu = `body` (244,246,250), `.barra`
  `top` 62px sticky. **Resultado: coerente; nenhuma emenda visível** (`claro-mes.png`).
- **Fonte maior:** (i) `html{font-size:120%}` (o `index.html` usa `rem` em 11 regras): h1 37,2 (17PM) / 65,9 (13,
  2 linhas como hoje); abas, chips, barra, cartões iguais (px); sem transbordo, nada sob a ilha. (ii) todas as
  `font-size` ×1,2: h1 89,2 (17PM, passa a 2 linhas) / 79,1; `#jarvis-input` 46,9, `#jarvis-header` 70 / 85 (título em
  mais linhas); `scrollWidth` igual ao viewport nas 6 vistas × 2 perfis; nenhum alvo novo < 44; h1 não invade os
  botões. **Resultado: nada quebra.**
- **Teclado aberto** (simulado reduzindo o viewport para 440×610 e 390×498 com o campo focado; o iOS real não
  encolhe o layout viewport do app instalado, então é aproximação): nova-tarefa: diálogo 16..594 / 16..482,
  conteúdo rola (582 > 576 / 464), botões alcançáveis (o `.primary` termina 1,8 px abaixo de H − 34 no 17PM, 0,8 no
  13: irrelevante com o teclado por cima). Jarvis: painel 46,8..486 (17PM) / 15,5..374 (13): os 3 botões do
  cabeçalho ficam na faixa da ilha (57,8 < 62; 31,5 < 47) — mesma causa do R2; a correção do R2 leva o topo a 62 / 47.
- **Paisagem** (956×440, 20/20/62/62), 9 vistas: `scrollWidth` 956, nada fixo fora de 62..894, nada sob a faixa de
  cima; véu 20 px; `#viewmode-btn` 94,5×31 visível (R9); nova-tarefa 4 px sob o inset de baixo (R3); voz 31..409 ok;
  Jarvis = R2. Seis variantes de correção medidas em paisagem, 17PM, 13 e no estado do bug 301994 (tabela do R2).
- **Textos longos** (sementes extras: 300 caracteres com espaços, 120 sem espaços, URL de 130, notas longas):
  dia, lista, mes, sequencia nos dois perfis — `scrollWidth` = viewport, `scrollWidth` do cartão = `clientWidth`
  (336/386), título quebra por `overflow-wrap:anywhere` (`scrollWidth` 246/296 = `clientWidth`), cartão de 257–297 px;
  Reagendar com nome longo: `.reschedule-task-name` 303/261 com `scrollWidth` 2306, `overflow:hidden`, `nowrap`
  (reticências), diálogo 400/358. **Resultado: nada quebra** (`textos-*.png`).

Técnica 4 — coerência
- Véu: cor = `body` em `mes`/`lista` nos dois perfis e temas (acima) e nas 11 auxiliares (F5, confirmada por mim no
  marketplace e no tema claro); `equipamentos-especiais` usa `#101017` sobre gradiente (aceito, spec 7.9).
- z-index: véu 60; `.quick-menu` 120, `#jarvis-panel` 101, `.toast` 20, `.agenda-actions` 45, `#app-ver` 99,
  `#viewmode-btn` 3000 (oculto no retrato pelo `header-cleanup.js`), diálogos em top layer.
- Versões: `index.html` carrega `treino.js?v=13`, `notas.js?v=10`, `agenda-sharing.js?v=5`, `sequencial.js?v=4`,
  `vozes-neurais.js?v=2`; `treino.html` `treino.js?v=13`; `localizacao.js?v=1`, `header-cleanup.js?v=6`,
  `agenda-notas-rapidas.js?v=6` não mudaram (certo: não foram editados). `sw.js`: R7.
- JS: o diff dos 5 `.js` editados (`notas.js`, `agenda-sharing.js`, `sequencial.js`, `treino.js`, `vozes-neurais.js`)
  só muda linhas dentro de template strings de CSS (conferido linha a linha; filtro automático sem sobras).
  Nenhum outro `.js` no diff. `sw.js` intocado.
- Service worker: `index.html` contém `financeiro.html`/`gamificacao.html` → `isAuxPage` → o `sw.js` não injeta
  `interface-polish.css` nem os 11 scripts na página principal (minha emulação inicial sem esse ramo foi
  descartada; registro em R7 como risco latente).

Técnica 5 — regressões no iPhone 13 (capturas `layout/antes/` × `layout/depois/` e `c2/pontos.cjs` em 8803 × 8765)
- Topo: 1ª célula do Mês 589,9 → 611,9 (+22); células no viewport 28 → 21 (uma linha a menos a rolagem 0).
- Cartões da Lista: altura média 114 → 135,7 (+19 %); `scrollHeight` 8348 → 9708 (+16 %); 60/60 rodapés quebram
  (já quebravam 60/60 antes: o que mudou foi o vão 6 → 16 e as pílulas 21/24 → 28). Na captura `iphone13-dia.png`
  o "Compartilhar" do 1º cartão passa a ficar sob o "+ Nova tarefa".
- Jarvis: painel 472,7 → 506,3 (cabe: 72dvh = 607,7); subtítulo em 3 linhas como antes.
- h1 em 2 linhas e chips rolando: já eram assim. Alvos, ilha, indicador, rolagem: iguais ao 17PM.
- **Juízo:** perceptível, sim (uma linha de calendário e ~1 cartão por tela a menos); não quebra nada. P2 (−7,1 px por
  cartão) e P3 (−18 no topo) devolvem quase tudo sem perder os 44 px.

Não testei (e por quê)
- iPhone real/WebKit: só Chromium 141. O `::before` no `input[type=checkbox]` com `appearance:none`, o `:has()` e a
  tinta da barra de status (iOS 26) ficam por conferir no aparelho.
- Teclado real do iOS (só simulação por viewport). Paisagem com insets do iOS 18 (0/21/62/62): não rodei.
- `financeiro-compartilhado.html` com dados reais (só o que a F5 mediu); `#cats button` e `.x` do marketplace
  (atrás da senha, como na F5).
- Capturas finais só das situações novas (estados e M7); as 9 vistas × 2 perfis estão nas pastas da F3/F5.

---

## Conferência dos critérios de aceite do briefing

1. As 5 seções (a)–(e) existem. ✓
2. 16 mutantes testados, cada um com resultado (tabela c). ✓
3. Validação cruzada em 5 tamanhos (17PM, 13, 375×812, 430×932, 320×568), 9 vistas cada. ✓
4. Cada achado tem passos de reprodução, medida, arquivo/linha e correção old → new (R4 e R8 com correção
   não medida, dito explicitamente). ✓
5. Estados da técnica 3 — bug 301994, tema claro, fonte maior (2 modos), teclado (simulado), paisagem, textos longos —
   todos tentados, com resultado (seção e). ✓
