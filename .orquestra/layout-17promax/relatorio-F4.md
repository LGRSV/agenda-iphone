# Relatório F4: páginas auxiliares (layout 17 Pro Max)

Feito em 17/10/2026. Base: HEAD `ecebe40` (WIP da F3, que não toca em nenhum arquivo da F4). Apliquei a seção 4 da
`especificacao.md` com um script de troca exata (`edicoes.py`). Antes de trocar, o script confere que cada `old`
aparece exatamente 1 vez e cada `new` 0 vezes. Medi as 12 páginas nos dois perfis com o harness, antes e depois
(`medir-f4.cjs`). Não fiz commit nem push e não mexi em nenhum `*.js` nem em `sw.js`.

Arquivos de trabalho, todos em `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/f4/`:
- `edicoes.py`: aplica as trocas.
- `medir-f4.cjs`: mede as páginas.
- `conferir-grep.py`: conta os `old` e `new`.
- `sonda-centro.cjs` e `sonda-chip.cjs`: conferem a centralização do texto.
- `antes-f4.json` e `depois-f4.json`: medições.
- `antes/`: capturas de antes.

---

## (a) Itens da seção 4

| Item | Arquivo | Situação |
|---|---|---|
| Véu (`body::before`, `#17181c`) | `financeiro.html` (antes do `</style>` da linha 2) | aplicado |
| Véu `#17181c` | `carteira.html` (fim da linha 23, antes do `</style>` da 24) | aplicado |
| Véu `#17181c` | `extrato-saldo.html` (`</style>` 11) | aplicado |
| Véu `#17181c` | `investimentos.html` (`</style>` 66) | aplicado |
| Véu `#17181c` | `fatura-inter.html` (primeiro `</style>`, linha 11) | aplicado |
| Véu `var(--bg)` | `refaturamento.html` (primeiro `</style>`, linha 22) | aplicado |
| Véu `var(--bg)` | `financeiro-compartilhado.html` (`</style>` 10) | aplicado |
| Véu `var(--bg)` | `gamificacao.html` (`</style>` 12) | aplicado |
| Véu `#0b1220` | `importar.html` (`</style>` 37) | aplicado |
| Véu `var(--bg)` | `marketplace/index.html` (`</style>` 100) | aplicado |
| Véu `#101017` | `equipamentos-especiais.html` (`</style>` 382) | aplicado |
| Véu em `treino.html` | — | não se aplica: a spec diz que não precisa. A `.tr-head` é `sticky`, com top 0, z 2 e fundo em gradiente opaco (`treino.js:408`) |
| 4.1 `.filters button` → `min-height:44px;padding:0 11px` | `financeiro.html` | aplicado |
| 4.1 `.sa-foot button`: nível B + `::before` | `financeiro.html` | aplicado |
| 4.1 `.iv-foot button`: nível B + `::before` | `financeiro.html` | aplicado |
| 4.2 carteira, extrato-saldo, importar, gamificacao, financeiro-compartilhado | — | só o véu, aplicado. O `financeiro-compartilhado` redireciona (ver observação 5) |
| 4.3 `.editbtn` → `position:relative` + `::before` | `investimentos.html` | aplicado como a spec escreve, sem `min-height:28px` (ver observação 4) |
| 4.3 `.savebtn` + `min-height:44px` | `investimentos.html` | aplicado |
| 4.4 `.tabs button` → `min-height:44px;padding:0 8px` | `fatura-inter.html` | aplicado |
| 4.5 `.sim-toggle` 42 → 44 | `refaturamento.html` | aplicado |
| 4.6 `.barra` com `top:env(safe-area-inset-top,0px)` | `marketplace/index.html` | aplicado |
| 4.6 `#cats button` 37 → 44 | `marketplace/index.html` | aplicado. Só por leitura de código: os botões são gerados atrás da senha e não aparecem sem dados |
| 4.6 `.views button` → `min-height:44px;padding:0 13px` | `marketplace/index.html` | aplicado |
| 4.6 `.x` 38 → 44 | `marketplace/index.html` | aplicado (ver observação 2). Só por leitura de código: o detalhe fica atrás da senha |
| 4.6 `#cofre label` + `min-height:44px` e `#cofre label input{width:22px;height:22px;margin:0}` | `marketplace/index.html` | aplicado (a regra nova entra logo depois da regra `#cofre label`) |
| 4.7 `.chip` → `min-height:44px;padding:0 14px` | `equipamentos-especiais.html` | aplicado, **com defeito visual** (ver observação 1) |
| 4.7 `.appswitch a` → grid centrado, 44 | `equipamentos-especiais.html` | aplicado |
| 4.7 `.quickbar button` → `min-height:44px;padding:0 8px` | `equipamentos-especiais.html` | aplicado |
| 4.7 `.buscabar input` + `min-height:44px` | `equipamentos-especiais.html` | aplicado |
| 4.7 `.buscabar select` + `min-height:44px` | `equipamentos-especiais.html` | aplicado |
| 4.7 `#app-ver`: bottom 6 → 10 | `equipamentos-especiais.html` | aplicado |
| 4.7 `#app-update` 34 → 44 | `equipamentos-especiais.html` | aplicado |
| 4.8 `treino.js?v=10` → `?v=13` | `treino.html:14` | aplicado |

**Contagem de ocorrências** (`conferir-grep.py`, critérios 1 e 2):
- Todos os `old` dão 0 e todos os `new` dão 1, com duas exceções inevitáveis do texto da spec.
- Exceção 1: o `old` `#cofre label{display:flex;gap:8px;align-items:center;` é prefixo do próprio `new`. Por isso ele continua aparecendo 1 vez, dentro do `new`.
- Exceção 2: o `new` curto `width:44px;height:44px;` dá 2 no marketplace (ver observação 2).
- Cada uma das 11 páginas com véu tem exatamente 1 `body::before`. O texto da regra é idêntico ao do contrato, e só a cor muda.
- `treino.html` tem `treino.js?v=13` 1 vez e `treino.js?v=10` 0 vezes.

### Observações e desvios (registrados, sem improvisar)

1. **`.chip` de `equipamentos-especiais.html` fica com o texto colado no alto da pílula.**
   - Os chips são `<div>` (linhas 407–419), não `<button>`. Com `min-height:44px;padding:0 14px` o bloco cresce, mas o texto fica na primeira linha.
   - Medido nos dois perfis, nos 13 chips (`sonda-chip.cjs`): o centro do texto fica **13,5 px acima** do centro da pílula. Antes, com `padding:7px` simétrico, ficava centrado.
   - Capturas: `depois/aux-equipamentos-especiais.png` (o problema) e `f4/antes/aux-equipamentos-especiais.png` (antes).
   - A spec mandava exatamente esse texto, então **apliquei literalmente e não corrigi**. O briefing diz para não inventar mudanças.
   - **Correção proposta, já testada por injeção, sem tocar no repositório:** acrescentar `align-content:center;` na mesma regra, logo depois de `padding:0 14px;`.
     O trecho `border-radius:100px;min-height:44px;padding:0 14px;` continua igual (o `new` da spec segue com 1 ocorrência).
   - Resultado medido da correção: desvio 0,0 nos 13 chips, nos dois perfis. A altura continua 44, e a largura e o texto também não mudam: o espaço antes da contagem "0" se mantém.
   - Captura da correção: `f4/sonda-chip-align-content.png`.
   - Essa correção exige `align-content` em bloco, que o Safari aceita desde o 17.4 e o Chromium desde o 123.
   - Não recomendo `display:flex`: ele tiraria o espaço entre o rótulo e o `<b class="cnt">`.
   - Os outros 13 alvos que mudei estão com o texto centrado (`sonda-centro.cjs`: desvio 0, e −0,4 nas `.views button`).
2. **Marketplace `.x`.** O `old` `width:38px;height:38px;` é único e foi trocado. Já o `new` `width:44px;height:44px;` já existia uma vez em `.gal .nav` (linha 78), então no arquivo ele aparece 2 vezes. Para ter uma evidência única, use `.x{float:right;display:grid;place-items:center;width:44px;height:44px;`, que dá 1.
3. **`#cofre label`.** O `old` é prefixo do `new`, então a contagem do `old` é 1 por construção. Não há resíduo do valor antigo.
4. **`.editbtn` (investimentos).**
   - A spec 4.3 manda só `position:relative`, sem o `min-height:28px` do par de nível B do contrato, porque o botão já tem 28.
   - Apliquei como a spec escreve. A regra `::before` tem o texto idêntico ao do contrato.
   - Medido: 4 botões com h 28,0, e o toque a ±6 px cai no botão, nos dois perfis.
5. **`financeiro-compartilhado.html`.**
   - Sem usuário compartilhado, a página redireciona para `/financeiro.html` (`financeiro-compartilhado.js:54`), como já registrado na auditoria.
   - Medi só a **casca estática**: reabri a página com o `financeiro-compartilhado.js` bloqueado, o que deixa o cabeçalho e o "Carregando…".
   - Na casca: sem rolagem lateral, cabeçalho em 80 (no 13, em 65), e o predicado do véu bate.
   - O layout com dados **não foi medido**.
6. **Treino.**
   - Os alvos já medem ≥ 44, porque o `treino.js` da F3 (commit WIP `ecebe40`) já está no disco. A F4 só trocou a versão no `treino.html`.
   - No servidor local o `?v=` não altera o arquivo servido: os números refletem o `treino.js` atual da F3.
7. **Alvos < 44 que existem mas não estão na spec (não mexi):**
   - `financeiro`: `#pluxeeEdit`, 56,5×25.
   - `equipamentos-especiais`: `button.cb-analise`, `.cb-ncon` e `.cb-execucao` (h 36), e `button.prim`, `.obr` e `div.toolbar > button` (h 34).
   - No iPhone 13, `importar`: `a.back`, 39,6×44.
   - Todos já existiam antes (aparecem em `antes-f4.json`).
8. **Marketplace `.barra` ao rolar.**
   - Sem dados, a página não rola (`scrollY` 0), então não deu para ver a barra grudando.
   - Conferi o critério da spec pelo `getComputedStyle`: `top` = `62px` no 17 Pro Max e `47px` no 13.
9. **Cabeçalho de `equipamentos-especiais`.** O `conteudoTop` do `h1` passou de 136 para 144 (no 13, de 121 para 129), porque o `.appswitch` cresceu 8. O seletor Agenda / Equipamentos continua acima de 62, e o `cabecalho.sobIlha` é `false`.
10. **Nenhum erro de JavaScript** (`page.__erros` vazio) em nenhuma página, nos dois perfis, antes e depois.

---

## (b) Medições (depois), por página

Como ler as colunas:
- **Alvos:** nível B quer dizer altura ≥ 28 e `elementFromPoint(cx, top − 6)` e `(cx, bottom + 6)` devolvendo o próprio botão, com o elemento rolado para o meio.
- **Véu:** é o predicado do item 7: `position` fixed, `height` = inset de cima, `zIndex` 60, `content` `""` e cor igual à do `body`. A exceção é `equipamentos-especiais`, em que a cor esperada é `#101017` = `rgb(16, 16, 23)`.
- **Cobertura com rolagem 400:** em todas as páginas que rolam, `elementFromPoint(W/2, 31)` devolve `body`, e todos os interativos com topo dentro da faixa ficaram cobertos. No 17 Pro Max: investimentos 2/2 e equipamentos 1/1. No 13: financeiro, importar, investimentos e refaturamento, 1/1 cada.

### iPhone 17 Pro Max (440×956, insets 62/34)

| Página | scrollWidth | cab. conteudoTop (antes → depois) | sob ilha (cab / interativos) | fixos sob indicador | Alvos medidos (depois) × esperado | Véu (predicado item 7) |
|---|---|---|---|---|---|---|
| financeiro | 440 | 80 → 80 | false / 0 | 0 | `.filters button` 6× 63–112,9×44 (esp. h ≥ 44, 6×) ok; `.sa-foot button` nível B 1×: h 28, toque ±6 px ok; `.iv-foot button` nível B 2×: h 28, toque ±6 px ok | ok: fixed, h 62px, z 60, cor rgb(23, 24, 28) (= body) |
| carteira | 440 | 80 → 80 | false / 0 | 0 | — (nenhum alvo na spec) | ok: fixed, h 62px, z 60, cor rgb(23, 24, 28) (= body) |
| extrato-saldo | 440 | 80 → 80 | false / 0 | 0 | — | ok: fixed, h 62px, z 60, cor rgb(23, 24, 28) (= body) |
| importar | 440 | 80 → 80 | false / 0 | 0 | — | ok: fixed, h 62px, z 60, cor rgb(11, 18, 32) (= body) |
| gamificacao | 440 | 80 → 80 | false / 0 | 0 | — | ok: fixed, h 62px, z 60, cor rgb(5, 5, 6) (= body) |
| financeiro-compartilhado (casca) | 440 | 80 → 80 | false / 0 | 0 | — | ok: fixed, h 62px, z 60, cor rgb(17, 18, 22) (= body) |
| investimentos | 440 | 80 → 80 | false / 0 | 0 | `.savebtn` 374×44 (esp. h ≥ 44) ok; `.editbtn` nível B 4×: h 28, toque ±6 px ok | ok: fixed, h 62px, z 60, cor rgb(23, 24, 28) (= body) |
| fatura-inter | 440 | 80 → 80 | false / 0 | 0 | `.tabs button` 2× 197×44 (esp. h ≥ 44, 2×) ok | ok: fixed, h 62px, z 60, cor rgb(23, 24, 28) (= body) |
| refaturamento | 440 | 80 → 80 | false / 0 | 0 | `.sim-toggle` 3× 190×44 (esp. h ≥ 44) ok | ok: fixed, h 62px, z 60, cor rgb(17, 18, 22) (= body) |
| marketplace | 440 | 80 → 80 | false / 0 | 0 | `#cofre label` 342×44 (esp. h ≥ 44) ok; `#cofreLembrar` 22×22 (esp. = 22×22) ok; sem `trancado`: `.views button` 3× h 44 ok; `.barra` top = 62px (esp. `'62px'`) ok | ok: fixed, h 62px, z 60, cor rgb(5, 5, 6) (= body) |
| equipamentos-especiais | 440 | 136 → 144 | false / 0 | 0 | `.chip` 13× 66,3–144,2×44 ok (h; texto descentrado, observação 1); `.appswitch a` 2× 197×44 ok; `.quickbar button` 3× 132×44 ok; `.buscabar input` 408×44 ok; `#cidadeFiltro` 408×44 ok; `#app-update` 44×44 ok, folga 10 (esp. ≥ 10) ok | ok: fixed, h 62px, z 60, cor rgb(16, 16, 23) (esp. `#101017`) |
| treino (`?date=2026-10-19`, aberto pelo app) | 440 | 76 → 76 | false / 0 | 0 | `.tr-preset` 4× 44–49,3×44 (esp. ≥ 44×44) ok; `.tr-tbtn` 2× 44×44 ok; `#trHome` 94,1×44 ok; `.tr-inputs input` 14× 160×44 ok | não se aplica (`.tr-head` sticky, top 0, z 2) |

### iPhone 13 (390×844, insets 47/34): conferência de que não piorou

| Página | scrollWidth | cab. conteudoTop (antes → depois) | sob ilha (cab / interativos) | fixos sob indicador | Alvos medidos (depois) × esperado | Véu (predicado item 7) |
|---|---|---|---|---|---|---|
| financeiro | 390 | 65 → 65 | false / 0 | 0 | `.filters button` 6× 63–112,9×44 ok; `.sa-foot button` nível B 1× h 28 ok; `.iv-foot button` nível B 2× h 28 ok | ok: fixed, h 47px, z 60, cor rgb(23, 24, 28) (= body) |
| carteira | 390 | 65 → 65 | false / 0 | 0 | — | ok: fixed, h 47px, z 60, cor rgb(23, 24, 28) (= body) |
| extrato-saldo | 390 | 65 → 65 | false / 0 | 0 | — | ok: fixed, h 47px, z 60, cor rgb(23, 24, 28) (= body) |
| importar | 390 | 65 → 65 | false / 0 | 0 | — | ok: fixed, h 47px, z 60, cor rgb(11, 18, 32) (= body) |
| gamificacao | 390 | 65 → 65 | false / 0 | 0 | — | ok: fixed, h 47px, z 60, cor rgb(5, 5, 6) (= body) |
| financeiro-compartilhado (casca) | 390 | 65 → 65 | false / 0 | 0 | — | ok: fixed, h 47px, z 60, cor rgb(17, 18, 22) (= body) |
| investimentos | 390 | 65 → 65 | false / 0 | 0 | `.savebtn` 324×44 ok; `.editbtn` nível B 4× h 28 ok | ok: fixed, h 47px, z 60, cor rgb(23, 24, 28) (= body) |
| fatura-inter | 390 | 65 → 65 | false / 0 | 0 | `.tabs button` 2× 172×44 ok | ok: fixed, h 47px, z 60, cor rgb(23, 24, 28) (= body) |
| refaturamento | 390 | 65 → 65 | false / 0 | 0 | `.sim-toggle` 3× 328×44 ok | ok: fixed, h 47px, z 60, cor rgb(17, 18, 22) (= body) |
| marketplace | 390 | 65 → 65 | false / 0 | 0 | `#cofre label` 312×44 ok; `#cofreLembrar` 22×22 ok; sem `trancado`: `.views button` 3× h 44 ok; `.barra` top = 47px | ok: fixed, h 47px, z 60, cor rgb(5, 5, 6) (= body) |
| equipamentos-especiais | 390 | 121 → 129 | false / 0 | 0 | `.chip` 13× h 44 ok (texto descentrado, observação 1); `.appswitch a` 2× 172×44 ok; `.quickbar button` 3× 115,3×44 ok; `.buscabar input` 358×44 ok; `#cidadeFiltro` 358×44 ok; `#app-update` 44×44 ok, folga 10 | ok: fixed, h 47px, z 60, cor rgb(16, 16, 23) (esp. `#101017`) |
| treino | 390 | 61 → 61 | false / 0 | 0 | `.tr-preset` 4× 44×44 ok; `.tr-tbtn` 2× 44×44 ok; `#trHome` 94,1×44 ok; `.tr-inputs input` 14× 135×44 ok | não se aplica |

`transbordando` está vazio em todas as páginas, nos dois perfis.

---

## (c) Capturas

As capturas de depois ficam em `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/depois/`:
- 17 Pro Max: `aux-<pagina>.png`, com `<pagina>` sendo um destes: `financeiro`, `carteira`, `extrato-saldo`, `importar`, `gamificacao`, `financeiro-compartilhado`, `investimentos`, `fatura-inter`, `refaturamento`, `marketplace`, `equipamentos-especiais`, `treino`.
- iPhone 13: `aux-<pagina>-iphone13.png`.
- Página inteira: `pagina-inteira/aux-<pagina>[-iphone13].png`.

Capturas de antes, com os mesmos nomes:
`/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/f4/antes/`.

Correção proposta para o `.chip` (só injetada, não aplicada):
`/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/f4/sonda-chip-align-content.png`.

## `git status --short` (no fim)

Aparecem só os 12 arquivos da F4: `carteira.html`, `equipamentos-especiais.html`, `extrato-saldo.html`,
`fatura-inter.html`, `financeiro-compartilhado.html`, `financeiro.html`, `gamificacao.html`, `importar.html`,
`investimentos.html`, `marketplace/index.html`, `refaturamento.html` e `treino.html`. São 28 linhas trocadas (`git diff --stat`), além deste relatório.

---

## Rodada 2 (correção do `.chip`)

Feito em 17/10/2026, sobre o HEAD `7d536da`, conforme `briefings/F4-rodada2.md`. A única mudança no repositório é uma linha
de `equipamentos-especiais.html`. Não fiz commit, stash nem checkout.

### O que mudou
- `equipamentos-especiais.html:149`, regra `.chip{…}`:
  - old: `min-height:44px;padding:0 14px;font-weight:600;font-size:12.5px;`
  - new: `min-height:44px;padding:0 14px;align-content:center;font-weight:600;font-size:12.5px;`
- Antes de trocar, o `old` aparecia **1 vez**, dentro da regra `.chip{…}` (a troca foi feita por script com `assert`).
- Depois, com `grep -c`: `old` = 0; `new` = 1; `align-content:center` = 1 (só nessa regra); o `new` da spec 4.7
  (`border-radius:100px;min-height:44px;padding:0 14px;`) continua com 1 ocorrência.
- `git diff --numstat`: `equipamentos-especiais.html` 1 linha trocada. O `index.html` também aparece modificado, mas é da F3
  (paralela), e eu não mexi nele.

### Evidência (critérios da rodada 2)
Arquivos em `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/f4/rodada2/`.

1. **Centralização.** `sonda-chip-r2.cjs` mede, no mesmo processo, as duas versões. A **r1** é o arquivo do HEAD, servido por
   interceptação a partir de `equipamentos-especiais.HEAD.html`. A **r2** é o arquivo do disco.
   - Mede os 13 chips nos dois perfis.
   - r1: o desvio entre o centro do texto (Range) e o centro da pílula é de −13,5 px nos 13 chips.
   - r2: o desvio do Range é **0,0** nos 13 chips. O desvio do filho `<b class="cnt">` é de 0,5 px nos 6 chips que têm
     contagem. O máximo é **0,5 px**, abaixo do limite de 1 px. Isso vale nos dois perfis.
   - `align-content` computado: `normal` na r1 e `center` na r2. `display` continua `block`.
2. **Altura, largura e texto.** Nos 13 chips, nos dois perfis, a r2 tem `textContent` idêntico ao da r1, largura idêntica
   (66,3 a 144,2) e altura 44. A sonda deu 0 falhas.
3. **Itens 6 e 7 da seção 6.** Rodei de novo o `medir-f4.cjs` nas 12 páginas e nos 2 perfis, e o resultado está em
   `depois-r2.json`. Comparei campo a campo com o `depois-f4.json` da rodada 1: scrollWidth, cabeçalho, sob ilha, fixos sob
   indicador, alvos, nível B, folga, véu, transbordando, erros de JS e marketplace destrancado. Deu **0 diferenças em
   24 registros**.
   - `equipamentos-especiais`, 17 Pro Max: sw 440, `conteudoTop` 144, `sobIlha` false, 0 interativos sob a ilha.
     Alvos: `.chip` 13× h 44, `.appswitch a` 2× 197×44, `.quickbar button` 3× 132×44, `.buscabar input` 408×44,
     `#cidadeFiltro` 408×44 e `#app-update` 44×44 com folga 10, todos ok.
     Véu: fixed, h 62px, z 60, `content ""`, cor `rgb(16, 16, 23)` (esperado `#101017`). Ok.
   - No iPhone 13: sw 390, `conteudoTop` 129, alvos ok e véu com h 47px. Ok.
4. **Nenhum outro arquivo.** `git status --short`: ` M equipamentos-especiais.html` e ` M index.html` (este é da F3).
   Também muda este relatório.

### Capturas novas
- 17 Pro Max: `rodada2/aux-equipamentos-especiais.png`. Os 13 chips aparecem com o texto no meio da pílula.
- iPhone 13: `rodada2/aux-equipamentos-especiais-iphone13.png`.
- As outras 11 páginas também foram capturadas de novo em `rodada2/aux-<pagina>[-iphone13].png`.
- Não sobrescrevi `depois/aux-equipamentos-especiais*.png`. Elas continuam mostrando o estado da rodada 1, com o defeito.
