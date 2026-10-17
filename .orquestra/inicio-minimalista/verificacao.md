# Verificação independente: tela de início minimalista

Data: 17/10/2026, 18h55. Servidor: http://127.0.0.1:8765/ (árvore de trabalho atual).

Li só o `contexto.md`. Não li os relatórios dos designers, o `integracao.md` nem o `git diff`.
Todos os números abaixo saem de medição feita no Chromium 141 (Playwright), com a área segura emulada pelo
harness da missão anterior. O CDP confirmou a área segura em todos os contextos: 62/34 no 17 Pro Max e 47/34 no 13.
Não editei nenhum arquivo do app.

## Veredito

| item | resultado |
|---|---|
| **A.** padrão inalterado (`layout.cjs`) | **432 verificações: 425 ok, 7 FALHOU.** Todas as falhas são do `marketplace/` e nenhuma vem desta mudança. A mesma execução contra uma cópia do `HEAD` sem a mudança dá exatamente as mesmas 432, com os mesmos 425 ok e os mesmos 7 FALHOU. O critério "sem FALHOU" **não** foi atingido (detalhes em A). |
| **A (extra).** escopo do CSS | 0 seletor fora de `html[data-home="<id>"]` nas 4 folhas (217 seletores), 0 `@keyframes` e 0 regra global. Sem escolha, 0 diferença real de estilo computado ou retângulo, com as 4 folhas carregadas ou bloqueadas, em 7 vistas × 2 perfis × 2 temas. |
| **B.** variantes escolhidas pelo menu | **Tudo ok.** São 4 variantes × 2 perfis × 2 temas × 9 vistas × 5 checagens = 720 checagens, mais erros de JS = 0. |
| **C.** funções alcançáveis | **essencial, ios e zen: 15/16.** O `#seqEntryBtn` ("Modo sequencial") fica com `display:none` e não aparece com nenhum toque. A ação dele continua alcançável pelo `#seqTimerBtn`, que tem o mesmo ouvinte, e pela aba Sequência (detalhes em C). **hoje: 16/16.** |
| **D.** suítes | **5 de 5 passam.** São 47 ok, 0 FALHOU e todos com rc 0. |

## A. O padrão não mudou

Comando: `LAYOUT_JSON=<scratch> LAYOUT_CAPTURAS=<scratch> node .orquestra/layout-17promax/testes/layout.cjs http://127.0.0.1:8765/`.
Uso essas variáveis para não sobrescrever o `resultado-layout.json` do repositório.

- **Resultado:** `# total 432: 425 ok, 7 FALHOU`, rc 1. Saída em `verif-inicio/saida-layout.txt`.
- **Ids que falharam** (todos da página auxiliar `marketplace/`):
  - `S6.6.marketplace.#cofrelabel`: `#cofre label` mede 342×20.3, mas o esperado é h ≥ 44.
  - `S6.6.marketplace.cofreLembrar`: `#cofreLembrar` mede 13×13, mas o esperado é 22×22.
  - `S6.6.marketplace.views-button`: os `.views button` têm h 36.8, mas o esperado é h ≥ 44.
  - `S6.6.marketplace.barra`: o `.barra` tem `top` 0px em `position: sticky`, mas o esperado é 62px.
  - `S6.7.aux.marketplace`: o `body::before` está `static`, com `content none`, mas o esperado é o véu fixo de 62px.
  - `S6.8.marketplace/index.html`: só 0 de 7 trechos da correção estão no arquivo.
  - `S6.8.marketplace/index.html.intencao`: esta linha só existe quando o grep literal falha. É por isso que o total passou de 431 para 432.
- **Prova de que a causa não é esta mudança:**
  1. **Cópia do `HEAD` sem a mudança.** Fiz uma cópia do `HEAD` com `git archive` (sem `index.html` alterado e sem `estilos-inicio/`), servi na porta 8766 e rodei o mesmo teste.
     - O resultado foi `432: 425 ok, 7 FALHOU`, com os **mesmos ids e os mesmos resultados** (diff vazio).
     - Das 432 linhas, 430 são idênticas byte a byte, medidas incluídas. Só 2 diferem: `S6.7.17pm.lista.rolado` e `S6.7.13.lista.rolado`. Nelas muda apenas o nome do 2º item invisível do menu fechado contado sob a faixa (`#telaInicioBtn` em vez de `#equipamentosBtn`), porque o menu ganhou o item "Tela de início". O resultado continua ok.
  2. **O `marketplace/index.html` foi reescrito por commits automáticos depois da missão de layout.**
     - O arquivo não está alterado na árvore de trabalho (`git status --short marketplace/` vazio).
     - Foi reescrito pelos commits `3c9ec5c`, `7b34953` e `a4d6587` ("Marketplace: Novos anúncios / Compilado"), todos depois do `7406006` (layout 17 Pro Max).
     - O trecho do véu `body::before{content:"";position:fixed;top:0;lef…` aparece 1 vez no `7406006` e 0 vez no `HEAD`.
     - A última execução registrada (`relatorio-F6.md`) dava 431/431.
- **Conclusão:** a tela de início padrão não mudou. Os 7 FALHOU vêm de uma regressão anterior e alheia a esta mudança, nas correções do marketplace. Ela precisa de conserto à parte, porque o gerador automático do marketplace sobrescreve o arquivo.
- **No mesmo teste:**
  - As 9 suítes E2E e o teste de unidade passam (`S6.5.*`, 10/10).
  - Erros de JS: 0 (`S6.5.erros.*`).

**Extra 1: escopo lido do CSSOM** (`escopo.cjs`)

| folha | regras de estilo | seletores | fora de `html[data-home="<id>"]` | @media/@supports | @keyframes / outras regras globais |
|---|---|---|---|---|---|
| essencial.css | 45 | 48 | 0 | 0 | 0 / 0 |
| hoje.css | 41 | 45 | 0 | 1 | 0 / 0 |
| ios.css | 52 | 53 | 0 | 1 | 0 / 0 |
| zen.css | 64 | 71 | 0 | 0 | 0 / 0 |

O app tem 20 `@keyframes` próprios, e nenhum colide com as variantes.

**Extra 2: impressão digital sem escolha** (localStorage sem `agenda_tela_inicio`, `data-home` ausente)

Comparei todos os elementos do `<body>`, com 31 propriedades computadas mais o retângulo, além de `body::before`/`::after` e `--bg`/`--accent`.
Rodei com as 4 folhas carregadas e com as 4 bloqueadas por rota (`cssRules` inacessível), em mes, dia, lista, sequencia, menu, nova-tarefa e jarvis, nos 2 perfis e nos 2 temas.

- O resultado foi de 0 a 1 elemento diferente em cada vista, de 575 a 2188 elementos por vista.
- O único diferente é sempre `#jarvis-btn` e só no `box-shadow` do anel pulsante, por exemplo `4.12156px` × `4.12131px`. É a fase da animação no instante da leitura. O retângulo e todo o resto são iguais.

## B. Cada variante escolhida pelo menu

**Como foi feito:**

- Em cada combinação, o app abre limpo. O tema claro é escolhido tocando `#themeToggle` no `#quickMenu`. A variante é escolhida tocando `#moreMenuBtn` → `#telaInicioBtn` → `#telaInicioDialog [data-home-id="<id>"]` (`locator.tap`, com checagem de alvo do Playwright).
- Depois disso, confiro `html[data-home]`, `localStorage.agenda_tela_inicio` e `aria-checked`.
- **Vistas medidas (9):** mes, dia, lista, atrasadas, sequencia, menu, nova-tarefa, jarvis e voz.
- **Checagens:**
  - **Sem rolagem lateral.** `scrollWidth` do documento e do body ≤ largura. `window.scrollTo(300,0)` deixa `scrollX` = 0. 0 elemento com retângulo fora do viewport, tanto no recorte quanto no bruto (mesmo recortado por ancestral). O bruto usa o predicado `coletarPagina` do `layout.cjs`. A única exceção é a rolagem intencional de `#jarvis-chips`.
  - **Nada sob a ilha.** Com rolagem 0, nenhum interativo visível tem o topo recortado abaixo do inset. Além disso, uma varredura de `elementFromPoint` a cada 4×2 px da faixa 0..inset não acerta nenhum interativo.
  - **Nenhum fixo sob o indicador.** Nenhum interativo fixo tem o fundo além de H − 34. Além disso, a varredura da faixa do indicador não acerta nenhum interativo fixo.
  - **Alvos ≥ 44.** Todo interativo visível com w ou h < 44 precisa estar na lista de permitidos da missão anterior: só as pílulas de nível B (`.notas-toggle`, `.agenda-share`, `.tr-open`, `.list-previous`) nas vistas de lista, com h ≥ 28.
  - **Véu.** `body::before` com `content ""`, `fixed`, `top 0`, altura = inset, z 60, e cor = `var(--bg)` resolvida = fundo do body.
  - **Erros de JS:** `pageerror` nos 3 contextos de cada combinação.
- **Contra o falso positivo da recarga:** o cliente real do Supabase apaga o token falso do harness, e uma recarga cairia no login, com um `TypeError` de `focus`. Isso acontece também no padrão. Por isso, o token é reposto a cada carga, como faz o `e2e-tela-inicio.cjs`.

| variante | perfil | tema | escolha pelo menu | sem rolagem lateral | nada sob a ilha | nenhum fixo sob o indicador | alvos ≥ 44 (soltos) | véu | erros de JS | funções (C) | escolha após recarregar |
|---|---|---|---|---|---|---|---|---|---|---|---|
| atual | 17 Pro Max | escuro | ok (data-home=—) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | ok 16/16 | ok (—) |
| atual | 17 Pro Max | claro | ok (data-home=—) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | ok 16/16 | ok (—) |
| atual | 13 | escuro | ok (data-home=—) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | ok 16/16 | ok (—) |
| atual | 13 | claro | ok (data-home=—) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | ok 16/16 | ok (—) |
| essencial | 17 Pro Max | escuro | ok (data-home=essencial) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | **FALHOU** 15/16 | ok (essencial) |
| essencial | 17 Pro Max | claro | ok (data-home=essencial) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | **FALHOU** 15/16 | ok (essencial) |
| essencial | 13 | escuro | ok (data-home=essencial) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | **FALHOU** 15/16 | ok (essencial) |
| essencial | 13 | claro | ok (data-home=essencial) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | **FALHOU** 15/16 | ok (essencial) |
| hoje | 17 Pro Max | escuro | ok (data-home=hoje) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | ok 16/16 | ok (hoje) |
| hoje | 17 Pro Max | claro | ok (data-home=hoje) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | ok 16/16 | ok (hoje) |
| hoje | 13 | escuro | ok (data-home=hoje) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | ok 16/16 | ok (hoje) |
| hoje | 13 | claro | ok (data-home=hoje) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | ok 16/16 | ok (hoje) |
| ios | 17 Pro Max | escuro | ok (data-home=ios) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | **FALHOU** 15/16 | ok (ios) |
| ios | 17 Pro Max | claro | ok (data-home=ios) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | **FALHOU** 15/16 | ok (ios) |
| ios | 13 | escuro | ok (data-home=ios) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | **FALHOU** 15/16 | ok (ios) |
| ios | 13 | claro | ok (data-home=ios) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | **FALHOU** 15/16 | ok (ios) |
| zen | 17 Pro Max | escuro | ok (data-home=zen) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | **FALHOU** 15/16 | ok (zen) |
| zen | 17 Pro Max | claro | ok (data-home=zen) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | **FALHOU** 15/16 | ok (zen) |
| zen | 13 | escuro | ok (data-home=zen) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | **FALHOU** 15/16 | ok (zen) |
| zen | 13 | claro | ok (data-home=zen) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | ok (9 vistas) | 0 | **FALHOU** 15/16 | ok (zen) |

**Medidas resumidas** (máximo ou mínimo nas 18 medições de cada perfil, 9 vistas × 2 temas):

| variante | perfil | scrollWidth máx / body | elementos fora (bruto) | menor topo de interativo, rolagem 0 | acertos na faixa da ilha / do indicador | interativos &lt; 44 fora da lista | véu escuro / claro |
|---|---|---|---|---|---|---|---|
| atual | 17 Pro Max | 440 / 440 | 0 | 82 | 0 / 0 | 0 | 62px rgb(5,5,6) / rgb(244,246,250) |
| atual | 13 | 390 / 390 | 0 | 67 | 0 / 0 | 0 | 47px idem |
| essencial | 17 Pro Max | 440 / 440 | 0 | 80 | 0 / 0 | 0 | 62px idem |
| essencial | 13 | 390 / 390 | 0 | 65 | 0 / 0 | 0 | 47px idem |
| hoje | 17 Pro Max | 440 / 440 | 0 | 80 | 0 / 0 | 0 | 62px idem |
| hoje | 13 | 390 / 390 | 0 | 65 | 0 / 0 | 0 | 47px idem |
| ios | 17 Pro Max | 440 / 440 | 0 | 80 | 0 / 0 | 0 | 62px idem |
| ios | 13 | 390 / 390 | 0 | 65 | 0 / 0 | 0 | 47px idem |
| zen | 17 Pro Max | 440 / 440 | 0 | 80 | 0 / 0 | 0 | 62px idem |
| zen | 13 | 390 / 390 | 0 | 65 | 0 / 0 | 0 | 47px idem |

Em todas, a cor do véu = `var(--bg)` = fundo do body, com z-index 60.

**Extras** (não pedidos; mesmos critérios da missão anterior):

| variante | perfil | tema | faixa ::before das pílulas (nível B: zona ≥ 43,5, ≥ 6 px de cada lado) | lista rolada 400: véu cobre a ilha | menor folga de fixo até o indicador (px) | menor topo de interativo, rolagem 0 (px) |
|---|---|---|---|---|---|---|
| atual | 17 Pro Max | escuro | ok (dia, lista, atrasadas, sequência) | ok (5 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 82 (mes) |
| atual | 17 Pro Max | claro | ok (dia, lista, atrasadas, sequência) | ok (5 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 82 (mes) |
| atual | 13 | escuro | ok (dia, lista, atrasadas, sequência) | ok (1 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 67 (mes) |
| atual | 13 | claro | ok (dia, lista, atrasadas, sequência) | ok (1 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 67 (mes) |
| essencial | 17 Pro Max | escuro | ok (dia, lista, atrasadas, sequência) | ok (6 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 80 (mes) |
| essencial | 17 Pro Max | claro | ok (dia, lista, atrasadas, sequência) | ok (6 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 80 (mes) |
| essencial | 13 | escuro | ok (dia, lista, atrasadas, sequência) | ok (5 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 65 (mes) |
| essencial | 13 | claro | ok (dia, lista, atrasadas, sequência) | ok (5 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 65 (mes) |
| hoje | 17 Pro Max | escuro | ok (dia, lista, atrasadas, sequência) | ok (5 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 80 (mes) |
| hoje | 17 Pro Max | claro | ok (dia, lista, atrasadas, sequência) | ok (5 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 80 (mes) |
| hoje | 13 | escuro | ok (dia, lista, atrasadas, sequência) | ok (4 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 65 (mes) |
| hoje | 13 | claro | ok (dia, lista, atrasadas, sequência) | ok (4 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 65 (mes) |
| ios | 17 Pro Max | escuro | ok (dia, lista, atrasadas, sequência) | ok (4 sob a faixa, todos cobertos; ponto = body) | 2 (mes) | 80 (mes) |
| ios | 17 Pro Max | claro | ok (dia, lista, atrasadas, sequência) | ok (4 sob a faixa, todos cobertos; ponto = body) | 2 (mes) | 80 (mes) |
| ios | 13 | escuro | ok (dia, lista, atrasadas, sequência) | ok (4 sob a faixa, todos cobertos; ponto = body) | 2 (mes) | 65 (mes) |
| ios | 13 | claro | ok (dia, lista, atrasadas, sequência) | ok (4 sob a faixa, todos cobertos; ponto = body) | 2 (mes) | 65 (mes) |
| zen | 17 Pro Max | escuro | ok (dia, lista, atrasadas, sequência) | ok (4 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 80 (mes) |
| zen | 17 Pro Max | claro | ok (dia, lista, atrasadas, sequência) | ok (4 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 80 (mes) |
| zen | 13 | escuro | ok (dia, lista, atrasadas, sequência) | ok (3 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 65 (mes) |
| zen | 13 | claro | ok (dia, lista, atrasadas, sequência) | ok (3 sob a faixa, todos cobertos; ponto = body) | 10 (mes) | 65 (mes) |

**Atenção (não reprova nenhuma checagem pedida): ios, tab bar a 2 px do indicador.**

- **O que foi medido:** na variante `ios`, os 4 `#viewTabs button.view-tab` ficam fixos no rodapé, com o fundo em 920 no 17 Pro Max (956 − 34 − 2) e em 808 no 13 (844 − 34 − 2). A folga até a faixa do indicador é de **2 px**, em todas as vistas e nos 2 temas.
- **O que não acontece:** não estão sob o indicador. A varredura da faixa não acerta nenhum interativo fixo, porque só o fundo da barra (o `nav`, que não é interativo) entra na faixa.
- **Comparação:**
  - A especificação da missão anterior pedia folga ≥ 8 (`S6.2.*.folga8`).
  - No padrão e nas outras 3 variantes, a menor folga é de 10 px.
  - Se a regra de 8 px valer para as variantes, `ios` reprova nela.

**Outros extras medidos** (`extra.cjs`; contagens idênticas ao padrão nas 5 opções):

- Nenhum par de fixos interativos se sobrepõe, incluindo a tab bar do `ios` com os botões flutuantes.
- Com o item rolado para o centro, 6 de 20 interativos de cartão na amostra dão outro elemento no centro, em dia e lista. São `.task-edit-btn`/`.task-trash`, ocultos sob o cartão até o deslize. A contagem é a mesma do padrão.
- O nome acessível de todas as funções é igual ao do padrão, com duas exceções:
  - Em `hoje` e `zen`, as abas são lidas em maiúsculas ("DIA", "MÊS"…), por causa de `text-transform`.
  - Em essencial, ios e zen, o `#seqEntryBtn` sai da árvore de acessibilidade (`ignored`).

## C. Funções alcançáveis em cada variante

**Procedimento** (por função, em cada variante × perfil × tema, partindo da vista Mês):

1. Procuro o elemento visível. A visibilidade usa o mesmo predicado do `layout.cjs`: tamanho ≥ 1, sem `display:none`, visibility visible, opacity ≥ 0,05, pointer-events, inert e modal.
2. Faço `scrollIntoView({block:'center'})` e pego o `elementFromPoint` no centro. Ele tem que devolver o próprio elemento ou um descendente.
3. Se o elemento não está visível ou não é acertado no centro, tento cada controle visível que poderia revelá-lo: `#moreMenuBtn` e as 4 abas. Toco o controle e meço de novo.
4. Achado o elemento, **toco no centro** (`touchscreen.tap`) e confiro o efeito medido no padrão:
   - **aba:** fica `.active`;
   - **filtro:** fica `.active`;
   - **+ Nova tarefa:** `#taskDialog[open]`;
   - **menu:** `#quickMenu.is-open`;
   - **Jarvis:** `#jarvis-panel.open`;
   - **parceiro:** `#parceiroDialog[open]`;
   - **cardio:** `#cardioDialog[open]`;
   - **Modo sequencial e cronômetro:** aba Sequência `.active` e `#seqTimerBtn.seq-active`;
   - **atualizar:** navegação da página, com conferência de que a escolha sobrevive.

A aba Mês e o filtro Todas começam de outro estado (Dia ou Atrasadas, por clique programático). Assim, o toque precisa mudar algo de fato.

| função | seletor | atual | essencial | hoje | ios | zen |
|---|---|---|---|---|---|---|
| aba Dia | `#viewTabs [data-view="day"]` | ok 4/4, direto, 97×44 / 84×44 | ok 4/4, direto, 102×44 / 90×44 | ok 4/4, direto, 85×44 / 73×44 | ok 4/4, direto, 106×49 / 94×49 | ok 4/4, direto, 45×44 |
| aba Mês | `#viewTabs [data-view="month"]` | ok 4/4, direto, 97×44 / 84×44 | ok 4/4, direto, 102×44 / 90×44 | ok 4/4, direto, 85×44 / 73×44 | ok 4/4, direto, 106×49 / 94×49 | ok 4/4, direto, 50×44 |
| aba Lista | `#viewTabs [data-view="list"]` | ok 4/4, direto, 97×44 / 84×44 | ok 4/4, direto, 102×44 / 90×44 | ok 4/4, direto, 85×44 / 73×44 | ok 4/4, direto, 106×49 / 94×49 | ok 4/4, direto, 61×44 |
| aba Sequência | `#viewTabs [data-view="sequencia"]` | ok 4/4, direto, 97×44 / 84×44 | ok 4/4, direto, 102×44 / 90×44 | ok 4/4, direto, 85×44 / 73×44 | ok 4/4, direto, 106×49 / 94×49 | ok 4/4, direto, 102×44 |
| filtro Todas | `#filters [data-filter="all"]` | ok 4/4, direto, 67×44 | ok 4/4, direto, 61×44 | ok 4/4, direto, 64×44 | ok 4/4, direto, 80×44 / 67×44 | ok 4/4, direto, 44×44 |
| filtro Atrasadas | `#filters [data-filter="late"]` | ok 4/4, direto, 93×44 | ok 4/4, direto, 87×44 | ok 4/4, direto, 88×44 | ok 4/4, direto, 105×44 / 93×44 | ok 4/4, direto, 64×44 |
| filtro Concluídas | `#filters [data-filter="done"]` | ok 4/4, direto, 100×44 | ok 4/4, direto, 94×44 | ok 4/4, direto, 94×44 | ok 4/4, direto, 112×44 / 100×44 | ok 4/4, direto, 71×44 |
| filtro Trabalho | `#filters [data-filter="work"]` | ok 4/4, direto, 84×44 | ok 4/4, direto, 78×44 | ok 4/4, direto, 80×44 | ok 4/4, direto, 97×44 / 84×44 | ok 4/4, direto, 55×44 |
| + Nova tarefa | `#openDialog` | ok 4/4, direto, 149×54 | ok 4/4, direto, 56×56 | ok 4/4, direto, 56×56 | ok 4/4, direto, 56×56 | ok 4/4, direto, 56×56 |
| menu | `#moreMenuBtn` | ok 4/4, direto, 46×46 | ok 4/4, direto, 46×46 | ok 4/4, direto, 46×46 | ok 4/4, direto, 46×46 | ok 4/4, direto, 46×46 |
| Jarvis | `#jarvis-btn` | ok 4/4, direto, 56×56 | ok 4/4, direto, 56×56 | ok 4/4, direto, 56×56 | ok 4/4, direto, 56×56 | ok 4/4, direto, 56×56 |
| parceiro | `#parceiroBtn` | ok 4/4, direto, 46×46 | ok 4/4, direto, 46×46 | ok 4/4, direto, 46×46 | ok 4/4, direto, 46×46 | ok 4/4, direto, 46×46 |
| cardio | `#cardioFab` | ok 4/4, direto, 48×48 | ok 4/4, direto, 48×48 | ok 4/4, direto, 48×48 | ok 4/4, direto, 48×48 | ok 4/4, direto, 48×48 |
| Modo sequencial | `#seqEntryBtn` | ok 4/4, direto, 408×44 / 358×44 | **FALHOU** 0/4 | ok 4/4, direto, 44×44 | **FALHOU** 0/4 | **FALHOU** 0/4 |
| cronômetro | `#seqTimerBtn` | ok 4/4, direto, 46×46 | ok 4/4, direto, 46×46 | ok 4/4, direto, 46×46 | ok 4/4, direto, 46×46 | ok 4/4, direto, 46×46 |
| atualizar | `#app-update` | ok 4/4, direto, 44×44 | ok 4/4, direto, 44×44 | ok 4/4, direto, 44×44 | ok 4/4, direto, 44×44 | ok 4/4, direto, 44×44 |

A coluna mostra quantas das 4 combinações (perfil × tema) passaram, por onde a função foi achada ("direto" = visível na vista Mês, sem toque prévio) e o tamanho medido do alvo.

**Depois de "Atualizar o app" (`#app-update`):** nas 16 combinações de variante houve 1 navegação. A escolha continuou valendo (`data-home` e `localStorage` iguais ao id), assim como o tema, e não houve erro de JS.

## Falhas, com medida e seletor

### F1. "Modo sequencial" inalcançável como elemento: essencial, ios e zen (12 de 12 combinações)

- **Seletor:** `#seqEntryBtn`.
- **Medida:**
  - Na vista Mês, `getComputedStyle(#seqEntryBtn).display = "none"`.
  - Nenhum dos 5 toques testados (`#moreMenuBtn` e as 4 abas) o torna visível. Depois da aba Sequência, ele fica com o atributo `hidden`, igual ao padrão.
  - Nome acessível: nó `ignored`.
  - É o mesmo nos 2 perfis e nos 2 temas.
- **Regras responsáveis:**
  - `estilos-inicio/essencial.css:46`: `html[data-home="essencial"] #seqEntryBtn{display:none}`
  - `estilos-inicio/ios.css:49`: `html[data-home="ios"] #seqEntryBtn{display:none}`
  - `estilos-inicio/zen.css:55`: `html[data-home="zen"] #seqEntryBtn{display:none}`
  - Em `hoje`, o botão vira um ícone de 44×44, passa no teste e mantém o nome "Modo sequencial".
- **A ação continua alcançável (medido):**
  - Pelo CDP (`DOMDebugger.getEventListeners`), o ouvinte de clique de `#seqEntryBtn` e o de `#seqTimerBtn` são **a mesma função**: `sequencial.js?v=4`, linha 29, coluna 24 (`goToSequencia`, que clica na aba Sequência).
  - O `#seqTimerBtn` passa em C nas 3 variantes: é visível direto, mede 46×46, o centro acerta e o toque produz o mesmo efeito (aba Sequência `.active` e `#seqTimerBtn.seq-active`).
  - A aba Sequência também passa: visível direto, com toque efetivo.
- **Leitura:** pelo critério literal desta verificação ("ela tem que estar visível ou aparecer depois de um toque"), é **FALHOU**. Pelo contrato do `contexto.md` ("pode movê-la… tem que continuar tocável… sem perder nenhuma ação"), a ação não se perde: ela tem dois caminhos visíveis com o mesmo ouvinte. Já o botão rotulado "Modo sequencial" deixa de existir na tela. Quem decide é o integrador. Duas correções servem:
  - aceitar o `#seqTimerBtn` como o caminho do modo sequencial; ou
  - fazer como em `hoje`, transformando o botão em ícone de 44×44 em vez de usar `display:none`.

### F2. `layout.cjs` com 7 FALHOU (marketplace), alheio a esta mudança

Os ids, as medidas e a prova da causa estão na seção A. Não há falha na tela de início.

Não há outra falha. As checagens de B (lateral, ilha, indicador, alvos, véu e erros de JS) passaram nas 144 medições de vista das variantes (4 variantes × 2 perfis × 2 temas × 9 vistas), 5 checagens cada, e também nas 36 do padrão.

## D. Suítes

| suíte | comando | resultado |
|---|---|---|
| e2e-tela-inicio | `node .orquestra/inicio-minimalista/testes/e2e-tela-inicio.cjs http://127.0.0.1:8765/` | rc 0, 16 ok, 0 FALHOU ("tudo ok") |
| e2e-so-claude | `node <scratch>/tools/e2e-so-claude.cjs http://127.0.0.1:8765/index.html` | rc 0, 10 ok, 0 FALHOU |
| e2e-voz-saida | idem | rc 0, 6 ok, 0 FALHOU |
| e2e-lista | idem | rc 0, 7 ok, 0 FALHOU |
| e2e-vozes-app | idem + `<scratch>` como 2º argumento | rc 0, 8 ok, 0 FALHOU |

Saída completa em `verif-inicio/saida-suites.txt`. As 9 suítes também rodaram dentro do `layout.cjs` e passaram (`S6.5.*`).

## Observação para a publicação (não é falha desta verificação)

`sw.js` continua `const CACHE = 'agenda-lagares-v247-iphone17promax';`, igual ao publicado em
https://lgrsv.github.io/agenda-iphone/sw.js (lido agora). Pelo `CLAUDE.md`, mudança no app exige subir esse número antes
de publicar.

## Evidências (scratchpad `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/verif-inicio/`)

- **Scripts:**
  - `verif.cjs`: B e C;
  - `escopo.cjs`: escopo e impressão digital;
  - `extra.cjs`: nome acessível, cobertura e fixos sobrepostos;
  - `ouvintes.cjs`: ouvintes via CDP;
  - `relatorio.cjs`: tabelas.
- **Medidas brutas:** `res-17pm.json`, `res-13.json`, `escopo.json` e `extra.json`.
- **Saídas:**
  - `saida-layout.txt` (8765);
  - `saida-layout-head.txt` (cópia do HEAD em 8766);
  - `saida-suites.txt`;
  - `saida-escopo.txt`.
- **Capturas** pelo menu, em `capturas/<id>/<perfil>-<vista>-<tema>.png`: 5 opções × 2 perfis × 4 vistas × 2 temas = 80.
- **Mosaicos:** `mosaico-mes-escuro-17pm.png` e `mosaico-lista-claro-13.png`.

## Conferência do maestro (antes de publicar)
- **iOS:** a barra de abas foi de 2 px para 8 px acima do indicador (`ios.css`:
  `calc(env(safe-area-inset-bottom) + 2px)` → `+ 8px`). Medido: folga 8 nos dois iPhones, nenhum
  flutuante sobre a barra, scrollWidth 440/390.
- **Escopo:** 217 seletores nos 4 arquivos, 0 fora de `html[data-home="<id>"]` (script do maestro).
- **Seletor:** `e2e-tela-inicio.cjs` todo ok.
- **"Modo sequencial" escondido em essencial, ios e zen:** aceito. A mesma ação fica no
  `#seqTimerBtn` (mesmo handler, visível no cabeçalho) e na aba Sequência.
- **Marketplace (7 falhas do layout.cjs):** não é desta mudança. Os commits automáticos
  "Marketplace: …" reescrevem `marketplace/index.html` a partir de um molde externo e apagaram os
  ajustes do #128. Fica para corrigir na origem do gerador.
