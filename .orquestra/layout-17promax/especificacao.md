# Especificação de layout — Agenda Lagares no iPhone 17 Pro Max (C1)

Frente C1 da missão `layout-17promax`. Escrita em 17/10/2026 sobre o commit `83e17c5`
(`sw.js` = `agenda-lagares-v246-mais-leve`). Nada do app foi alterado por esta frente.

**Entradas:** `plano.md` (missão, pronto, contratos), `pesquisa.md` (perfis, seção 4), `auditoria.md`
(defeitos A1–A6, M1–M10, B1–B7; páginas auxiliares), capturas em `scratchpad/layout/antes/`.

**Como os números novos foram obtidos.** Injetei o CSS proposto (arquivo
`scratchpad/layout/c1-experimento/proposta-f3.css`) por cima do app atual, sem tocar no repositório, e
medi com o harness `harness/medir.cjs` nos dois perfis (`experimento-f3.cjs`, `experimento-dialogos.cjs`,
saídas `resultado-antes.json`, `resultado-depois.json`, `dialogos.json`, capturas em
`c1-experimento/capturas/{antes,depois}/`). As páginas auxiliares que a F2 não detalhou foram medidas com
`medir-aux.cjs` (`aux.json`). Tudo em
`/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/c1-experimento/`.
Quando digo "medido" abaixo, é dessa rodada; quando digo "auditoria", é da F2.

---

## 1. Perfis finais

A pesquisa (F1, seção "Diferenças") **confirmou todos os valores provisórios**. Nenhuma medição da
auditoria precisa ser refeita e nenhuma conclusão dela muda.

| Perfil (harness) | Viewport | DPR | Insets retrato (top/bottom/left/right) | Fonte |
|---|---|---|---|---|
| `iphone17promax` | 440 × 956 | 3 | 62 / 34 / 0 / 0 | pesquisa.md §4 (FATO UIKit [U17] → INFERÊNCIA para `env()`) |
| `iphone13` | 390 × 844 | 3 | 47 / 34 / 0 / 0 | pesquisa.md §4 ([U13]) |

Perfil **adicional só para o critério "paisagem não quebra"** (seção 6, item 10). Não existe no harness;
o verificador cria o objeto e passa para `abrirApp(browser, perfil, …)`, que aceita qualquer
`{nome,width,height,dpr,insets}`:

| Perfil | Viewport | Insets (top/bottom/left/right) | Fonte |
|---|---|---|---|
| `iphone17promax-paisagem` | 956 × 440 | 20 / 20 / 62 / 62 | pesquisa.md §4 `insetsPaisagem` (iOS 26; no iOS 18 seria 0/21/62/62) |

Dois fatos da pesquisa que esta especificação respeita (sem mudar perfil):
- **Bug WebKit 301994** (pesquisa, "Diferenças" item 2): às vezes o sistema desenha uma faixa opaca de
  62 px e `env(safe-area-inset-top)` vale 0. Todas as regras abaixo usam `env()` com fallback 0, então
  nesse estado o véu da barra de status (M10) fica com altura 0 e o conteúdo começa nos 18 px de padding
  de sempre. Nada é fixado em 62.
- **iOS 26 ignora `theme-color`** e tinge a barra de status com o fundo do `body` ou de elementos fixos
  encostados no topo (pesquisa, item 4). O véu M10 é exatamente um elemento fixo encostado no topo com
  `background:var(--bg)`, a mesma cor do `body`: a tinta da barra continua igual.

---

## 2. Princípios do layout

1. **Área segura só por `env()`**, sempre com fallback `0px`, nunca número fixo; precisa funcionar com inset 0 (bug 301994).
2. **Largura fluida entre 390 e 440**: sem nova media query; `%`, `minmax`, `1fr` e `calc(100% - 32px)` absorvem os 50 px extras. Fica a única media query existente (`@media(max-width:390px)`), que separa o calendário compacto do iPhone 13.
3. **Margem lateral 16 px em tudo que é caixa de tela inteira** (`.app`, diálogos): `width:min(calc(100% - 32px),…)` mais `max-width:calc(100% - 32px)` para vencer o limite da UA (`calc(100% - 38px)`, auditoria B4).
4. **Alvo de toque nível A = retângulo real ≥ 44×44** (HIG, pesquisa §3) para todo controle solto; **nível B = visível ≥ 28 (mínimo da HIG) + área de toque 44 por `::before` invisível** só para pílulas dentro de linhas densas (rodapé do cartão e link do cabeçalho da lista). Onde o visual precisa continuar pequeno (caixa de marcar, relógio de reagendar), a caixa de toque cresce com margem negativa e o desenho fica num pseudo-elemento.
5. **Nada fixo a menos de 8 px da faixa do indicador** (`H − inset_bottom`); hoje o `#app-update` está a 6 (A6).
6. **Tipografia e cores não mudam** (família, pesos, paleta). Só um tamanho muda: etiqueta do calendário 8,5 → 9 px no 17 Pro Max (B5); o iPhone 13 continua em 8 px pela media query.
7. **Barra de status `black-translucent` ganha um véu fixo** de altura `env(safe-area-inset-top)` e cor do fundo da página (M10), `z-index:60`: acima do conteúdo (≤ 45), abaixo do painel do Jarvis (101), do menu (120) e dos diálogos (top layer).
8. **Paisagem: só não quebrar** — nenhuma regra nova; os fixos já usam `max(…, env(left/right))`. Verificado por script (seção 6, item 10).

---

## 3. Mudanças da F3 (`index.html`, `vozes-neurais.js` e CSS injetado por scripts do app)

### 3.0 Arquivos, versões e convenções

| Arquivo | O que muda | Cache-bust |
|---|---|---|
| `index.html` | CSS minificado da linha 21; linhas 69, 70, 71, 72, 73, 74; bloco do Jarvis (801–855); tags `<script>` | — (é a página) |
| `notas.js` | regra `.notas-toggle` (linha 60) | `index.html:1842` `notas.js?v=9` → `?v=10` |
| `agenda-sharing.js` | regra `.agenda-share` (linha 40) | `index.html:1852` `agenda-sharing.js?v=4` → `?v=5` |
| `sequencial.js` | regra `.seq-entry-btn` (linha 21) | `index.html:1853` `sequencial.js?v=3` → `?v=4` |
| `treino.js` | `.tr-open` (402), `.tr-close` (411), `.tr-home` (412), `.tr-preset` (423), `.tr-tbtn` (426), `.tr-inputs input` (457) | `index.html:1839` `treino.js?v=12` → `?v=13`; a F4 põe o mesmo `?v=13` em `treino.html:14` (contrato, seção 5) |
| `vozes-neurais.js` | `#voz-dialog` (97), `.vz-x` (102), `.vz-ouvir` (120) | `index.html:1858` `vozes-neurais.js?v=1` → `?v=2` |

Não são editados: `header-cleanup.js`, `localizacao.js` (o `#jarvis-locbar` é vencido por regra
`!important` no `index.html`), `agenda-notas-rapidas.js` (o rótulo do M9 vem de `::after{content:attr(aria-label)}`
no `index.html`), `calendario-cheio.js`, `sw.js`.

**Onde entram regras novas no `index.html`:** no fim da linha 21, depois do último `}` do bloco
`@media(min-width:600px){…}`, antes da quebra de linha. Ordem não importa entre elas.

**Nível B (pílulas):** sempre o mesmo par de declarações, para o verificador testar de um jeito só:
`position:relative;min-height:28px` no botão e
`SELETOR::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}`.

### 3.1 Rastreabilidade: cada defeito ALTO/MÉDIO da auditoria → onde se resolve

| Defeito | Resolvido em | Defeito | Resolvido em |
|---|---|---|---|
| A1 abas 37 | 3.3 (`.view-tab`) | M4 j-chip 31, locbar 29 | 3.8 |
| A2 filtros 34 | 3.3 (`.chip`) | M5 vz-x 30, vz-ouvir 31; links de crédito | 3.9; links → seção 7 |
| A3 setas 35 | 3.4 (`.nav-btn`, `.month-toolbar*`) | M6 botões 41, lembrete 18/32 | 3.10 |
| A4 mic/enviar 40 | 3.8 | M7 presets 38 | 3.10 |
| A5 hbtn 30 | 3.8 | M8 campo de data 36 | 3.5 |
| A6 app-update 34 a 6 px | 3.7 / 3.12 | M9 itens de menu sem texto | 3.2 |
| M1 check 23, reagendar 31, pílulas 21–24 | 3.5 / 3.6 | M10 conteúdo sob a ilha ao rolar | 3.2 (véu) |
| M2 list-previous 14, clearDone 24, list-more 38 | 3.6 | B2, B4, B5, B6 (baixos, baratos) | 3.4, 3.9, 3.10, 3.8 |
| M3 seqEntry 40 | 3.3 | B1, B3, B7 | seção 7 / seção 4 |

### 3.2 Cabeçalho e topo

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco no iPhone 13 |
|---|---|---|---|---|
| `body::before` (regra nova) | não existe (`index.html:21`; nenhum `body::before` no app — confirmado por grep) | `body::before{content:"";position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top,0px);z-index:60;background:var(--bg)}` | M10: com a página rolada 400 px, `elementFromPoint(220,31)` passa de `main.app` para `body` e os 7 interativos sob a ilha (13: 3) ficam cobertos (medido: `rolado400.cobertosPeloVeu` 2 → 7; 13: 2 → 3) | Nenhum visual com rolagem 0 (mesma cor do fundo). Altura 47 no 13 (medido). Modo claro: `--bg` muda junto |
| `#equipamentosBtn::after,#atualizarBtn::after` (nova) | sem texto: `texto:""` (auditoria M9; criados só com SVG em `agenda-notas-rapidas.js:101-107`) | `#equipamentosBtn::after,#atualizarBtn::after{content:attr(aria-label)}` | M9: itens passam a mostrar "Equipamentos Especiais" e "Atualizar o app" (medido `equipAfter`) | Nenhum (menu tem 260 de largura nos dois; itens 244×46 antes e depois) |
| `#equipamentosBtn svg,#atualizarBtn svg` (nova) | `.icon-btn svg{width:22px;height:22px;display:block}` (`index.html:849`) → ícone 22 sem caixa de 24 | `#equipamentosBtn svg,#atualizarBtn svg{width:20px;height:20px;margin:0 2px}` | M9: alinha com `.menu-option-icon` (24 px, svg 20; `index.html:68`). Medido: svg em x=185 nos dois casos | Nenhum |
| `.topbar`, `h1`, `.head-actions`, `.icon-btn` | 46×46 (auditoria; `header-cleanup.js:20`), `h1{font-size:clamp(31px,8.8vw,43px)}` | **sem mudança** | — | — |

### 3.3 Abas e filtros

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco no iPhone 13 |
|---|---|---|---|---|
| `.view-tab` | `min-height:37px` (`index.html:21`); medido 96.5×37 (13: 84×37) | `min-height:44px` | A1 → 96.5×44 (13: 84×44), trilho `.view-tabs` 47 → 54 (medido). A pílula `.view-tabs::before{top:4px;bottom:4px}` (`index.html:80`) acompanha sozinha (medida 96.5 de largura depois) | +7 px de altura do trilho |
| `.chip` | `padding:8px 13px` (`index.html:21`); 66.7–99.5 × 34 | `min-height:44px;padding:0 13px` | A2 → 66.7–99.5 × 44 (larguras iguais; medido 66.7×44) | +10 px na linha `.filters` (50 → 60). A linha já rola no 13 (soma dos chips 367 > 358, estado "antes", captura `iphone13-mes.png`); não piora |
| `.seq-entry-btn` (`sequencial.js:21`) | `padding:11px 14px`; 408×40 (13: 358×40) | `min-height:44px;padding:0 14px` | M3 → 408×44 (13: 358×44) medido | +4 px |

### 3.4 Calendário (Mês)

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco no iPhone 13 |
|---|---|---|---|---|
| `.nav-btn` (também `#calFullBtn`) | `width:35px;height:35px` (`index.html:21`) | `width:44px;height:44px` | A3 → 44×44 medido nos dois perfis | Barra 61 → 62 (ver `.toolbar`) |
| `.month-toolbar` | `grid-template-columns:35px minmax(0,1fr) 35px` (`index.html:69`) | `grid-template-columns:44px minmax(0,1fr) 44px` | A3 (coluna do `#calFullBtn` e do espaçador) | Nenhum |
| `.month-toolbar-spacer` | `width:35px;height:35px` (`index.html:69`) | `width:44px;height:44px` | A3 (título continua centrado) | Nenhum |
| `.toolbar` | `padding:12px 13px` (`index.html:21`); barra medida 61 (Mês/Dia), 64 (Sequência) | `padding:8px 13px` | compensa os +9 do botão: barra 62 (Mês/Dia) e 56 (Sequência), medido | −8 px na barra da Sequência; +1 nas outras |
| `.calendar-tag` | `font-size:8.5px` (`index.html:21`); 13 usa 8px pela `@media(max-width:390px)` | `font-size:9px` (a media query de 8px fica como está) | B5: aproveita os +6.6 px por célula do 17PM (52.6 contra 46) | Nenhum: no 13 a media query mantém 8px (medido `tagFont` 8px depois) |
| `.calendar-day`, `.day-number`, `.month-grid-wrap`, `@media(max-width:390px){…}` | 52.6×91 / 46×78 (auditoria §d) | **sem mudança** | critério 4 já atendido (auditoria) | — |

### 3.5 Dia

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco no iPhone 13 |
|---|---|---|---|---|
| `.day-pick .day-pick-input` | `position:absolute;inset:0;width:100%;height:100%` (`index.html:21`); 96.2×36 | `inset:-4px 0;height:auto` (resto igual) | M8 → 96.2×44 medido (o título continua 36; o campo invisível cobre 4 px a mais acima e abaixo, dentro dos 8 px de padding da barra) | Nenhum |
| `.task-card` | `grid-template-columns:25px minmax(0,1fr) 32px;gap:10px` (`index.html:21`); coluna de texto 299 (13: 249) | `grid-template-columns:34px minmax(0,1fr) 34px;gap:6px` | M1 (abre espaço para as caixas de 44 sem sair do cartão) → texto 296 (13: 246), medido | −3 px na coluna de texto (1,2 %) |
| `.check` | `width:23px;height:23px;margin:0;border:1.5px solid var(--faint);…` + `.check:checked{border-color:var(--accent);background:var(--accent)}` + `.check:checked::after{content:"✓"}` (`index.html:21`); 23×23 fora de `<label>` | input vira caixa de toque 44×44 transparente com `margin:-10px -5px`; o quadrado de 23 passa para `.check::before`; o ✓ continua em `::after` (trecho exato em 3.13) | M1 → 44×44 medido; visual idêntico (quadrado de 23 e ✓; captura `depois/iphone17promax-dia.png`) | Altura do cartão 117.6 → 121.6 (+4). Pseudo-elementos em `input[type=checkbox]` com `appearance:none`: o app já depende disso hoje (`.check:checked::after`) |
| `.task-reschedule` | `width:31px;height:31px` (`index.html:71`) | `width:44px;height:44px;margin:-6px -5px -7px` | M1 → 44×44 medido, ocupa 34×31 no grid; o ícone (svg 19) não muda | O fundo de `:active` passa a cobrir 44×44 (feedback = área de toque) |
| `.notas-toggle` (`notas.js:60`) | `padding:4px 10px`; 93.3×24 | acrescentar `position:relative;min-height:28px` + `.notas-toggle::before{…}` (nível B) | M1 → 93.3×28 + toque 44 (medido 28; `elementFromPoint` 6 px acima devolve o botão) | +4 px no rodapé do cartão |
| `.agenda-share` (`agenda-sharing.js:40`) | `padding:3px 7px`; 98.6×21 | idem nível B | M1 → 98.6×28 medido | idem |
| `.tr-open` (`treino.js:402`) | `padding:4px 11px`; 86.3–88.7×21 | idem nível B | M1 → 86.3–88.7×28 medido | idem |

### 3.6 Lista (e Atrasadas)

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco no iPhone 13 |
|---|---|---|---|---|
| `.list-previous` | `margin-top:5px;padding:0;font-size:11px` (`index.html:72`); 118.5×14 | `position:relative;min-height:28px` + `.list-previous::before{…}` (nível B) | M2 → 118.5×28 medido; cabeçalho da lista 68 → 81 | +13 px no cabeçalho (só quando o link aparece) |
| `.clear-done` (`#clearDone`) | `padding:4px 0` (`index.html:21`); 116.5×24 | `min-height:44px;padding:0 4px;margin:-10px -4px` | M2 → 124.5×44 medido sem mudar a altura do cabeçalho (margem negativa; o botão não tem fundo) | Nenhum |
| `.list-more` | `padding:10px 18px` (`index.html:72`); 188.8×38 | `align-items:center;min-height:44px;padding:0 20px` | M2 → 192.8×44 medido | Nenhum |
| cartões | igual a 3.5 | igual a 3.5 | M1 | igual |

### 3.7 Sequência

Sem regra própria: herda abas (3.3), cartões (3.5) e barra (3.4: `.toolbar` 64 → 56, medido). Os
alvos restantes < 44 na vista medida são só as pílulas de nível B (28 px).

### 3.8 Botões flutuantes, painel do Jarvis e selo de versão

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco no iPhone 13 |
|---|---|---|---|---|
| `#app-update` | `width:34px;height:34px` (`index.html:855`); 34×34, bottom 916 (6 px da faixa) | `width:44px;height:44px` | A6 → 44×44 medido | — |
| `#app-ver` | `bottom:calc(6px + env(safe-area-inset-bottom))` (`index.html:853`) | `bottom:calc(10px + env(safe-area-inset-bottom))` | A6 → folga 6 → 10 (medido `folgas.appUpdate` 10 nos dois) | — |
| `.agenda-actions` | `bottom:calc(46px + env(safe-area-inset-bottom))` (`index.html:70`); `#openDialog` 822–876 | `bottom:calc(62px + env(safe-area-inset-bottom))` | A6: dá lugar ao botão de 44 (`#openDialog` 806–860, `#app-update` 868–912: 8 px entre eles, medido) | B1 piora 16 px (mais um pedaço de célula coberto); compensado pelo padding abaixo |
| `.app` (linha 70) | `padding-bottom:calc(180px + env(safe-area-inset-bottom))` (`index.html:70`) | `padding-bottom:calc(196px + env(safe-area-inset-bottom))` | acompanha os 16 px; medido 230 (= 196 + 34) | — |
| `#jarvis-btn` | 56×56, bottom 12 + inset (`index.html:70`) | **sem mudança** | já atende | — |
| `#jarvis-panel` | `max-width:420px` (`index.html:801`); 416 (13: 366) | remover `max-width:420px` | B6 (trava latente a 4 px) → 416 / 366 iguais (medido) | Nenhum |
| `#jarvis-header` | `gap:10px;padding:14px 16px 12px` (`index.html:803`); 69 de altura | `gap:8px;padding:10px 16px 8px` | compensa os botões de 44: cabeçalho 63 (13: 73, título quebra em 3 linhas como antes) | +4 no 13 |
| `.jarvis-hbtn` | `width:30px;height:30px;border-radius:9px` (`index.html:808`) | `width:44px;height:44px;border-radius:12px` | A5 → 44×44 medido (3 botões) | — |
| `#jarvis-mic`, `#jarvis-send` | `width:40px;height:40px` (`index.html:818`, `:824`) | `width:44px;height:44px` | A4 → 44×44 medido | — |
| `#jarvis-input` | `min-height:40px` (`index.html:821`) | `min-height:44px` | alinha com mic/enviar (medido 286×44; 13: 236×44) | — |
| `.j-chip` | `padding:7px 13px` (`index.html:846`); 82–116×31 | `min-height:44px;padding:0 13px` | M4 → ×44 (medido 97.4×44 com padding 14; com 13 a largura volta a 95.4) | linha `#jarvis-chips` 43 → 56 |
| `#jarvis-locbar` (regra nova no `index.html`) | estilo inline `padding:7px 16px` (`localizacao.js:676`); 414×29 (13: 364×29) | `#jarvis-locbar{min-height:44px!important;padding-top:0!important;padding-bottom:0!important}` | M4 → 414×44 (13: 364×44) medido, sem editar `localizacao.js` | painel 453.5 → 477 (13: 472.7 → 506; cabe: máx. 72dvh = 607) |

### 3.9 Seletor de voz (`vozes-neurais.js`)

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco no iPhone 13 |
|---|---|---|---|---|
| `#voz-dialog` | `width:min(420px,calc(100vw - 24px))` (`vozes-neurais.js:97`); 402 (13: 352) pela UA | `width:min(420px,calc(100vw - 32px));max-width:calc(100vw - 32px)` | B4 → 408 (13: 358) medido; margem lateral 16 em vez de 19 | +6 px de largura |
| `#voz-dialog .vz-x` | `width:30px;height:30px;border-radius:9px` (`:102`) | `width:44px;height:44px;border-radius:12px` | M5 → 44×44 medido | — |
| `#voz-dialog .vz-ouvir` | `padding:7px 11px` (`:120`); 62.3×31 | `min-height:44px;padding:0 12px` | M5 → 64.3×44 medido; item `.vz-item` continua 76.5 de altura | — |
| `#voz-dialog .vz-cred a` | 25×13, 60.5×13 (`:123-124`) | **sem mudança** | ver seção 7 | — |

### 3.10 Diálogos (nova tarefa, reagendar, alertas)

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco no iPhone 13 |
|---|---|---|---|---|
| `dialog` | `width:min(calc(100% - 32px),480px)` (`index.html:21`); UA limita a `calc(100% - 38px)` → 402 (13: 352) | acrescentar `max-width:calc(100% - 32px)` | B4 → `#taskDialog` 408 (13: 358), `#alertsDialog` 408 (13: 358), medido | +6 px |
| `.secondary,.primary` | `padding:11px 15px` (`index.html:21`); 93.4×41 / 97.9×41 | `min-height:44px;padding:10px 16px` | M6 → 95.4×44 / 99.9×44 (nova tarefa), 364×44 e 80.9×44 (alertas), 95.4×44 / 108.2×44 (reagendar), medido | — |
| `.field-check` | `margin-top:8px` (`index.html:74`); rótulo 358×32, checkbox 18×18 | `min-height:44px;margin-top:4px` | M6 → rótulo 364×44 (13: 314×44) medido; o `<input>` de 18 continua dentro do `<label>` (toque no rótulo marca) | — |
| `.reschedule-preset` | `min-height:38px` (`index.html:73`); 104.7×38 (13: 98×38) | `min-height:44px` | M7 → 114.7×44 (13: 100.7×44) medido | — |
| `#rescheduleDialog` | `width:min(calc(100% - 40px),370px)` (`index.html:73`); 370 (13: 350) | `width:min(calc(100% - 32px),400px);max-width:calc(100% - 32px)` | B2 → 400 (13: 358) medido | +8 px |
| `.reschedule-head>div` (regra nova) | sem regra; o nome é travado em 245 | `.reschedule-head>div{flex:1;min-width:0}` | B2: a coluna do nome vira flexível (303 no 17PM; 261 no 13, medido) | — |
| `.reschedule-task-name` | `max-width:245px` (`index.html:73`) | `max-width:100%` | B2; reticências continuam (medido `scrollWidth` 385 > `clientWidth` 303, `overflow:hidden`) | — |

### 3.11 Toast

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco no iPhone 13 |
|---|---|---|---|---|
| `.toast` | `bottom:calc(93px + env(safe-area-inset-bottom))` (`index.html:21`); hoje já cobre 7 px do `+ Nova tarefa` (toast 789–829 × fab 822–876) | `bottom:calc(184px + env(safe-area-inset-bottom))` | com o grupo flutuante 16 px mais alto o toast cobriria 23 px do botão; a 184 fica 11 px acima do `#cardioFab` (medido: toast 682–738, cardio 749–797; 13: 570–626 / 637–685) | Toast aparece 91 px mais alto (sobre o conteúdo, não sobre botões) |

### 3.12 Selo de versão

Coberto em 3.8 (`#app-ver` bottom 10 + inset; `#app-update` 44×44). O texto `#app-ver-num` não muda.

### 3.13 Trechos exatos a substituir (old → new)

Todos os trechos abaixo existem uma única vez no arquivo (conferido com `grep`). Copiar o `old`
inteiro e trocar pelo `new`.

**`index.html`, linha 21 (CSS minificado):**

1. `.view-tab{min-height:37px;` → `.view-tab{min-height:44px;`
2. `.chip{flex:0 0 auto;padding:8px 13px;` → `.chip{flex:0 0 auto;min-height:44px;padding:0 13px;`
3. `.nav-btn{display:grid;place-items:center;width:35px;height:35px;` → `.nav-btn{display:grid;place-items:center;width:44px;height:44px;`
4. `.toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 13px;` → `…gap:8px;padding:8px 13px;`
5. `.day-pick .day-pick-input{position:absolute;inset:0;width:100%;height:100%;` → `.day-pick .day-pick-input{position:absolute;inset:-4px 0;width:100%;height:auto;`
6. `.task-card{display:grid;grid-template-columns:25px minmax(0,1fr) 32px;gap:10px;` → `.task-card{display:grid;grid-template-columns:34px minmax(0,1fr) 34px;gap:6px;`
7. old: `.check{appearance:none;width:23px;height:23px;display:grid;place-items:center;margin:0;border:1.5px solid var(--faint);border-radius:8px;background:transparent;color:var(--accentInk);font-size:14px;font-weight:900}.check:checked{border-color:var(--accent);background:var(--accent)}.check:checked::after{content:"✓"}`
   new: `.check{appearance:none;position:relative;width:44px;height:44px;display:grid;place-items:center;margin:-10px -5px;border:0;background:transparent;color:var(--accentInk);font-size:14px;font-weight:900}.check::before{content:"";grid-area:1/1;width:23px;height:23px;box-sizing:border-box;border:1.5px solid var(--faint);border-radius:8px;background:transparent}.check:checked::before{border-color:var(--accent);background:var(--accent)}.check:checked::after{content:"✓";grid-area:1/1}`
8. `.clear-done{padding:4px 0;border:0;` → `.clear-done{min-height:44px;padding:0 4px;margin:-10px -4px;border:0;`
9. `color:var(--text);font-size:8.5px;font-weight:800;line-height:1.1;white-space:nowrap;text-overflow:ellipsis}` → `color:var(--text);font-size:9px;font-weight:800;line-height:1.1;white-space:nowrap;text-overflow:ellipsis}` (é a regra `.calendar-tag`)
10. `dialog{width:min(calc(100% - 32px),480px);max-height:calc(100dvh - 32px);` → `dialog{width:min(calc(100% - 32px),480px);max-width:calc(100% - 32px);max-height:calc(100dvh - 32px);`
11. `.secondary,.primary{padding:11px 15px;border-radius:13px;` → `.secondary,.primary{min-height:44px;padding:10px 16px;border-radius:13px;`
12. `.toast{position:fixed;z-index:20;left:50%;bottom:calc(93px + env(safe-area-inset-bottom));` → `…bottom:calc(184px + env(safe-area-inset-bottom));`
13. Acrescentar no fim da linha 21 (depois de `.calendar-day{min-height:110px}}`):
    `body::before{content:"";position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top,0px);z-index:60;background:var(--bg)}#jarvis-locbar{min-height:44px!important;padding-top:0!important;padding-bottom:0!important}#equipamentosBtn::after,#atualizarBtn::after{content:attr(aria-label)}#equipamentosBtn svg,#atualizarBtn svg{width:20px;height:20px;margin:0 2px}`

**`index.html`, outras linhas:**

14. linha 69: `.month-toolbar{display:grid;grid-template-columns:35px minmax(0,1fr) 35px}` → `…44px minmax(0,1fr) 44px}`; `.month-toolbar-spacer{width:35px;height:35px}` → `.month-toolbar-spacer{width:44px;height:44px}`
15. linha 70: `.app{padding-bottom:calc(180px + env(safe-area-inset-bottom))}` → `…calc(196px + env(safe-area-inset-bottom))}`; `bottom:calc(46px + env(safe-area-inset-bottom));display:flex;flex-direction:column` → `bottom:calc(62px + env(safe-area-inset-bottom));display:flex;flex-direction:column`
16. linha 71: `.task-reschedule{display:grid;place-items:center;width:31px;height:31px;padding:0;` → `.task-reschedule{display:grid;place-items:center;width:44px;height:44px;margin:-6px -5px -7px;padding:0;`
17. linha 72: `.list-previous{display:inline-flex;align-items:center;margin-top:5px;padding:0;border:0;background:transparent;color:var(--accent);font-size:11px;font-weight:800}` → `.list-previous{position:relative;display:inline-flex;align-items:center;min-height:28px;margin-top:5px;padding:0;border:0;background:transparent;color:var(--accent);font-size:11px;font-weight:800}.list-previous::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}`; `.list-more{display:flex;margin:16px auto 10px;padding:10px 18px;` → `.list-more{display:flex;align-items:center;min-height:44px;margin:16px auto 10px;padding:0 20px;`
18. linha 73: `#rescheduleDialog{width:min(calc(100% - 40px),370px);overflow:visible;` → `#rescheduleDialog{width:min(calc(100% - 32px),400px);max-width:calc(100% - 32px);overflow:visible;`; `.reschedule-head{display:flex;align-items:center;gap:12px}` → `.reschedule-head{display:flex;align-items:center;gap:12px}.reschedule-head>div{flex:1;min-width:0}`; `.reschedule-task-name{margin:3px 0 0!important;max-width:245px;` → `.reschedule-task-name{margin:3px 0 0!important;max-width:100%;`; `.reschedule-preset{min-height:38px;` → `.reschedule-preset{min-height:44px;`
19. linha 74: `.field-check{display:flex;align-items:center;gap:9px;margin-top:8px;` → `.field-check{display:flex;align-items:center;gap:9px;min-height:44px;margin-top:4px;`
20. linha 801: `bottom:calc(90px + env(safe-area-inset-bottom));max-width:420px;max-height:72dvh;` → `bottom:calc(90px + env(safe-area-inset-bottom));max-height:72dvh;`
21. linha 803: `#jarvis-header{display:flex;align-items:center;gap:10px;padding:14px 16px 12px;` → `#jarvis-header{display:flex;align-items:center;gap:8px;padding:10px 16px 8px;`
22. linha 808: `.jarvis-hbtn{width:30px;height:30px;border:0;border-radius:9px;` → `.jarvis-hbtn{width:44px;height:44px;border:0;border-radius:12px;`
23. linha 818: `#jarvis-mic{width:40px;height:40px;` → `#jarvis-mic{width:44px;height:44px;`
24. linha 821: `#jarvis-input{flex:1;min-height:40px;` → `#jarvis-input{flex:1;min-height:44px;`
25. linha 824: `#jarvis-send{width:40px;height:40px;` → `#jarvis-send{width:44px;height:44px;`
26. linha 846: `font-weight:700;padding:7px 13px;border-radius:99px;cursor:pointer}` → `font-weight:700;min-height:44px;padding:0 13px;border-radius:99px;cursor:pointer}` (regra `.j-chip`)
27. linha 853: `bottom:calc(6px + env(safe-area-inset-bottom));z-index:99;` → `bottom:calc(10px + env(safe-area-inset-bottom));z-index:99;` (regra `#app-ver`)
28. linha 855: `justify-content:center;width:34px;height:34px;padding:0;` → `justify-content:center;width:44px;height:44px;padding:0;` (regra `#app-update`)
29. linhas 1839, 1842, 1852, 1853, 1858: `treino.js?v=12` → `?v=13`; `notas.js?v=9` → `?v=10`; `agenda-sharing.js?v=4` → `?v=5`; `sequencial.js?v=3` → `?v=4`; `vozes-neurais.js?v=1` → `?v=2`

**`notas.js:60`:** `.notas-toggle{margin-left:auto;display:inline-flex;` → `.notas-toggle{position:relative;margin-left:auto;display:inline-flex;min-height:28px;` e, na linha seguinte do mesmo template, acrescentar
`.notas-toggle::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}`.

**`agenda-sharing.js:40`:** `.agenda-share{display:inline-flex;align-items:center;gap:4px;padding:3px 7px;` → `.agenda-share{position:relative;display:inline-flex;align-items:center;gap:4px;min-height:28px;padding:3px 7px;` e acrescentar, logo depois de `}` dessa regra, `.agenda-share::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}`.

**`sequencial.js:21`:** `margin:0 0 14px;padding:11px 14px;` → `margin:0 0 14px;min-height:44px;padding:0 14px;`.

**`treino.js`:**
- 402: `.tr-open{margin-left:auto;display:inline-flex;align-items:center;gap:5px;padding:4px 11px;` → `.tr-open{position:relative;margin-left:auto;display:inline-flex;align-items:center;gap:5px;min-height:28px;padding:4px 11px;` e nova linha `.tr-open::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}`
- 411: `.tr-close{position:absolute;top:14px;right:14px;width:34px;height:34px;` → `…width:44px;height:44px;`
- 412: `gap:6px;min-height:36px;padding:0 12px;` → `gap:6px;min-height:44px;padding:0 12px;` (regra `.tr-home`)
- 423: `.tr-preset{padding:5px 10px;` → `.tr-preset{min-height:44px;min-width:44px;padding:0 10px;`
- 426: `.tr-tbtn{width:42px;height:42px;` → `.tr-tbtn{width:44px;height:44px;`
- 457: `.tr-inputs input{width:100%;min-height:42px;` → `.tr-inputs input{width:100%;min-height:44px;`

**`vozes-neurais.js`:**
- 97: `#voz-dialog{width:min(420px,calc(100vw - 24px));max-height:86dvh;` → `#voz-dialog{width:min(420px,calc(100vw - 32px));max-width:calc(100vw - 32px);max-height:86dvh;`
- 102: `#voz-dialog .vz-x{width:30px;height:30px;border:0;border-radius:9px;` → `#voz-dialog .vz-x{width:44px;height:44px;border:0;border-radius:12px;`
- 120: `font-size:12px;font-weight:700;padding:7px 11px;border-radius:99px;cursor:pointer}` → `font-size:12px;font-weight:700;min-height:44px;padding:0 12px;border-radius:99px;cursor:pointer}` (regra `.vz-ouvir`)

---

## 4. Mudanças da F4 (páginas auxiliares)

A F4 edita **só** estes arquivos: `financeiro.html`, `carteira.html`, `extrato-saldo.html`,
`investimentos.html`, `fatura-inter.html`, `refaturamento.html`, `financeiro-compartilhado.html`,
`gamificacao.html`, `importar.html`, `marketplace/index.html`, `equipamentos-especiais.html`,
`treino.html` (só a tag de versão). **Não toca** em `treino.js` (é da F3), em `*.js` nenhum, nem em
`sw.js`. As páginas já atendem ao critério 6 do plano (sem rolagem lateral; cabeçalho em 76–136 > 62,
auditoria §e); o que segue é B7 (alvos) e o véu M10 replicado.

**Véu da barra de status (M10), uma regra por página,** acrescentada no fim do primeiro bloco `<style>`
(linha do `</style>` indicada). A cor é o fundo medido do `body` (`aux.json`, `__bodyBg`):

| Página | `</style>` | Regra |
|---|---|---|
| `financeiro.html` | linha 2 | `body::before{content:"";position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top,0px);z-index:60;background:#17181c}` |
| `carteira.html` | 24 | idem, `#17181c` |
| `extrato-saldo.html` | 11 | idem, `#17181c` |
| `investimentos.html` | 66 | idem, `#17181c` |
| `fatura-inter.html` | 11 | idem, `#17181c` |
| `refaturamento.html` | 22 | idem, `background:var(--bg)` (= `#111216`) |
| `financeiro-compartilhado.html` | 10 | idem, `background:var(--bg)` |
| `gamificacao.html` | 12 | idem, `background:var(--bg)` |
| `importar.html` | 37 | idem, `#0b1220` |
| `marketplace/index.html` | 100 | idem, `background:var(--bg)` (segue o modo claro: `:root[data-theme="light"]`) |
| `equipamentos-especiais.html` | 382 | idem, `#101017` (o `body` tem gradiente radial `#16161f → #0c0c12`, linha 144; `#101017` é a cor média da faixa de 62 px, diferença só nos cantos) |
| `treino.html` | — | **não precisa**: `.tr-head` é `position:sticky;top:0;z-index:2` com fundo e `padding-top:calc(18px + env(safe-area-inset-top))` (`treino.js:405` e `:472`), então o próprio cabeçalho cobre a faixa ao rolar |

Nenhuma dessas páginas usa `body::before` hoje (grep: 0 ocorrências em todas).

### 4.1 `financeiro.html` (CSS minificado na linha 2)

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco |
|---|---|---|---|---|
| `.filters button` | `padding:9px 11px;font-weight:800` (`:2`); 63–113×35 (auditoria) | `min-height:44px;padding:0 11px;font-weight:800` | B7 → ×44 | +9 px na linha de filtros |
| `.sa-foot button` (`#conedit`…) | `padding:6px 13px` (`:2`); 65.9×26 | acrescentar `position:relative;min-height:28px` + `.sa-foot button::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}` (nível B) | B7 → 28 visível + 44 de toque | +2 px |
| `.iv-foot button` | `padding:6px 13px` (`:2`); 63.9×24 (medido) | idem nível B (`.iv-foot button::before{…}`) | B7 | +4 px |
| `.back`, `.nav`, `.add` | 44×44 / 408×44 (auditoria; medido) | sem mudança | — | — |

old → new: `.filters button{padding:9px 11px;font-weight:800}` → `.filters button{min-height:44px;padding:0 11px;font-weight:800}`;
`.sa-foot button{background:#2a2d35;` → `.sa-foot button{position:relative;min-height:28px;background:#2a2d35;` e acrescentar `.sa-foot button::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}` logo após o `}` dessa regra;
`.iv-foot button{background:rgba(255,255,255,.24);` → `.iv-foot button{position:relative;min-height:28px;background:rgba(255,255,255,.24);` e `.iv-foot button::before{…}` idem.

### 4.2 `carteira.html`, `extrato-saldo.html`, `importar.html`, `gamificacao.html`, `financeiro-compartilhado.html`

Só o véu (tabela acima). Alvos: nenhum < 44 (auditoria §e; `importar` tem `#launch` fixo 408×50 com
bottom 906 = 16 px acima da faixa, atende ao princípio 5). `financeiro-compartilhado.html` não foi
medida (redireciona sem usuário compartilhado): a F4 aplica só o véu e registra que não mediu.

### 4.3 `investimentos.html`

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco |
|---|---|---|---|---|
| `.editbtn` | `padding:7px 13px` (`:33`); 65.9×28 | `position:relative` + `.editbtn::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}` (nível B; já tem 28) | B7 | nenhum |
| `.savebtn` (`#saveMetas`) | `padding:13px` (`:63`); 374×43 | acrescentar `min-height:44px` | B7 → 374×44 | +1 px |

old → new: `.editbtn{background:#2a2d35;` → `.editbtn{position:relative;background:#2a2d35;` + regra `::before`; `.savebtn{width:100%;margin-top:14px;padding:13px;` → `.savebtn{width:100%;min-height:44px;margin-top:14px;padding:13px;`.

### 4.4 `fatura-inter.html`

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco |
|---|---|---|---|---|
| `.tabs button` | `padding:10px 8px` (`:16`); 197×37 | `min-height:44px;padding:0 8px` | B7 → 197×44 | +7 px |

old → new (linha 16): `.tabs button{padding:10px 8px;border:0;` → `.tabs button{min-height:44px;padding:0 8px;border:0;`.

### 4.5 `refaturamento.html`

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco |
|---|---|---|---|---|
| `.sim-toggle` | `min-height:42px;padding:7px 10px` (`:15`); 190×42 | `min-height:44px` (padding igual) | B7 → 190×44 | +2 px |
| `.actions button`, `.back`, `.smark` | 184.5×44, 44×44 (medido) | sem mudança | — | — |
| `@media(max-width:390px){.grid{grid-template-columns:1fr}…}` (`:21`, `:23`) | 13 vê 1 coluna, 17PM vê 2 (auditoria §d) | sem mudança (é a largura extra sendo usada) | — | — |

old → new (linha 15): `.sim-toggle{display:flex;align-items:center;gap:8px;min-height:42px;` → `…gap:8px;min-height:44px;`.

### 4.6 `marketplace/index.html`

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco |
|---|---|---|---|---|
| `#cofre label` (envolve `#cofreLembrar`) | sem altura (`:96`); checkbox nativo 13×13 (auditoria) | acrescentar `min-height:44px` e nova regra `#cofre label input{width:22px;height:22px;margin:0}` | B7: o rótulo de 44 é o alvo; a caixa vai de 13 a 22 (padrão iOS) | nenhum |
| `#cats button` | `min-height:37px` (`:26`) — atrás da senha, não medido; mesma regra das abas do app (A1) | `min-height:44px` | B7 por leitura de código | trilho `#cats` +7 px |
| `.views button` | `padding:8px 13px` (`:31`); 107.7–167.3×36.8 (medido sem `trancado`) | `min-height:44px;padding:0 13px` | B7 → ×44 | +7 px |
| `.x` (fechar do detalhe) | `width:38px;height:38px` (`:85`) | `width:44px;height:44px` | B7 por leitura de código | nenhum |
| `.barra` (abas presas no alto) | `position:sticky;top:0` (`:24`) | `top:env(safe-area-inset-top,0px)` | ao rolar, a barra gruda em y=0, **sob a ilha** (leitura de código; não medido porque fica atrás da senha). Com o véu M10 (z 60 > 5), a barra passaria por baixo do véu; com `top:env()` ela gruda logo abaixo dele | nenhum em rolagem 0 |
| `.voltar` | 46×46 (medido) | sem mudança | — | — |

old → new: `:24` `.barra{position:sticky;top:0;` → `.barra{position:sticky;top:env(safe-area-inset-top,0px);`; `:26` `#cats button{flex:1 0 auto;min-height:37px;` → `#cats button{flex:1 0 auto;min-height:44px;`; `:31` `.views button{flex:0 0 auto;padding:8px 13px;` → `.views button{flex:0 0 auto;min-height:44px;padding:0 13px;`; `:85` `width:38px;height:38px;` → `width:44px;height:44px;`; `:96` `#cofre label{display:flex;gap:8px;align-items:center;` → `#cofre label{display:flex;gap:8px;align-items:center;min-height:44px;` e acrescentar `#cofre label input{width:22px;height:22px;margin:0}`.

### 4.7 `equipamentos-especiais.html`

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco |
|---|---|---|---|---|
| `.chip` (categorias, 13 chips) | `padding:7px 14px` (`:149`); 66.3–103.7×31 (medido) | `min-height:44px;padding:0 14px` | B7 → ×44 | linha `.ctrl` +13 px; continua rolável |
| `.appswitch a` | `padding:10px 6px` (`:253`); 197×36 (auditoria) | `display:grid;place-items:center;min-height:44px;padding:0 6px` | B7 → 197×44 | +8 px |
| `.quickbar button` | `padding:12px 8px` (`:257`); 132×41 | `min-height:44px;padding:0 8px` | B7 → 132×44 | +3 px |
| `.buscabar input` | `padding:11px 14px` (`:343`); 408×41 (medido) | acrescentar `min-height:44px` | B7 | +3 px |
| `.buscabar select` (`#cidadeFiltro`) | `padding:10px 12px` (`:346`); 408×38 | acrescentar `min-height:44px` | B7 → 408×44 | +6 px |
| `#app-update` | `width:34px;height:34px` (`:321`); 34×34 | `width:44px;height:44px` | B7 / mesmo caso do A6 (nada fixo perto: só `.modal-bg`, `:91`) | nenhum |
| `#app-ver` | `bottom:calc(6px + env(safe-area-inset-bottom))` (`:320`) | `bottom:calc(10px + env(safe-area-inset-bottom))` | folga 6 → 10 | nenhum |
| `.toolbar button`, `.catbar button`, `.nav button` | 130.7×48, 132×50, 129.3×45 (medido) | sem mudança | — | — |

old → new: `:149` `border-radius:100px;padding:7px 14px;` → `border-radius:100px;min-height:44px;padding:0 14px;`; `:253` `.appswitch a{flex:1;text-align:center;padding:10px 6px;` → `.appswitch a{flex:1;display:grid;place-items:center;min-height:44px;padding:0 6px;`; `:257` `border-radius:13px;padding:12px 8px;` → `border-radius:13px;min-height:44px;padding:0 8px;`; `:343` `.buscabar input{width:100%;padding:11px 14px;` → `.buscabar input{width:100%;min-height:44px;padding:11px 14px;`; `:346` `.buscabar select{width:100%;margin-top:7px;padding:10px 12px;` → `.buscabar select{width:100%;min-height:44px;margin-top:7px;padding:10px 12px;`; `:320` `bottom:calc(6px + env(safe-area-inset-bottom))` → `bottom:calc(10px + env(safe-area-inset-bottom))`; `:321` `width:34px;height:34px;` → `width:44px;height:44px;`.

### 4.8 `treino.html`

| Seletor | Valor atual (linha) | Valor novo | Defeito | Risco |
|---|---|---|---|---|
| `<script src="./treino.js?v=10">` | `treino.html:14` | `./treino.js?v=13` | pega o `treino.js` novo da F3 (`.tr-preset` 43×23 → ≥44×44, `.tr-tbtn` 42 → 44, `#trHome` 36 → 44, campos 42 → 44) | nenhum |

Nada mais nesta página: o CSS dela vem de `treino.js` (F3).

---

## 5. Contratos entre F3 e F4

1. **`treino.js` é da F3.** A F4 não o edita; só troca `treino.js?v=10` por `treino.js?v=13` em
   `treino.html:14`. O número **13** é fixo: a F3 usa o mesmo em `index.html:1839`.
2. **Regra do véu** (`body::before{content:"";position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top,0px);z-index:60;background:…}`):
   texto idêntico nos dois lados, só a cor muda. O verificador testa com um único predicado.
3. **Regra de nível B** (`position:relative;min-height:28px` + `::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}`):
   texto idêntico nos dois lados.
4. **Nenhuma variável CSS compartilhada.** Cada página auxiliar tem seu próprio `:root` (ou cores
   literais); o app não exporta nada para elas e nenhuma carrega CSS do `index.html`. `interface-polish.css`
   não é carregado por ninguém (só citado em `sw.js`).
5. **Ninguém mexe em `sw.js`**; o maestro aumenta o `CACHE` depois das duas frentes.
6. Ordem de mesclagem indiferente: os arquivos não se sobrepõem.

---

## 6. Critérios numéricos para o verificador (lista fechada)

Todos medidos com `harness/medir.cjs` (`abrirApp(browser, perfil, {sementes, caminho, metodo})`,
`irPara`, `medir`) ou com `page.evaluate` sobre `getBoundingClientRect()` / `getComputedStyle`. Tolerância
0,5 px salvo indicação. "Vistas" = as 9 do harness (`mes, dia, lista, atrasadas, sequencia, menu,
nova-tarefa, jarvis, voz`). `H` = `innerHeight`, `insetB` = inset inferior do perfil.

1. **Sem rolagem lateral (plano 1).** Para cada vista × perfil: `scrollWidth == viewportW` (440 / 390) e
   `transbordando` vazio. Também nos diálogos Reagendar e Alertas (abrir por `.task-reschedule` e
   `#alertsBtn`): `documentElement.scrollWidth == viewportW`.
2. **Ilha e indicador (plano 2, versão atual).** Para cada vista × perfil com rolagem 0:
   `interativosSobIlha.length == 0`; `interativosSobIndicador.filter(x => x.fixo).length == 0`.
   Folga dos fixos até a faixa (`H − insetB − bottom`): `#app-update ≥ 10`, `#jarvis-btn ≥ 12`,
   `#openDialog ≥ 62`, `#cardioFab ≥ 125`; nenhum elemento fixo interativo com folga `< 8`. Valores
   esperados (medidos): 10 / 12 / 62 / 125 nos dois perfis.
3. **Alvos ≥ 44 (plano 3), perfil 17 Pro Max, por `getBoundingClientRect()`** — lista fechada:
   `#viewTabs .view-tab` ×4 (esperado 96.5×44), `#filters .chip` ×4 (66.7–99.5 × 44),
   `#viewContent .nav-btn` ×2 (44×44, vista dia), `#calFullBtn` (44×44), `#jarvis-mic`, `#jarvis-send`
   (44×44), `.jarvis-hbtn` ×3 (44×44), `#seqTimerBtn`, `#parceiroBtn`, `#moreMenuBtn` (46×46),
   `#openDialog` (148.8×54), `#jarvis-btn` (56×56), `#app-update` (44×44). Critério: `w ≥ 44 && h ≥ 44`.
   **Nível A adicional (mesmo predicado):** `#seqEntryBtn` (408×44), `.j-chip` ×7 (h 44),
   `#jarvis-locbar` (414×44), `#jarvis-input` (h 44), `#clearDone` (h 44), `.list-more` (h 44),
   `#viewContent .check` (44×44, todos), `#viewContent .task-reschedule` (44×44, todos),
   `#viewContent .day-pick-input` (96.2×44), `#closeTaskDialog`, `#taskForm .primary` (h 44),
   `#taskForm .field-check` (h 44), `.reschedule-preset` ×3 (h 44), `#rescheduleForm .secondary/.primary`
   (h 44), `#activateAlerts`, `#exportCalendar`, `#closeAlertsDialog` (h 44), `#voz-dialog .vz-x` (44×44),
   `#voz-dialog .vz-ouvir` (h 44). Repetir no `iphone13`: tudo igual, exceto larguras (84 nas abas).
   **Nível B** (`.notas-toggle`, `.agenda-share`, `.tr-open`, `.list-previous`): `h ≥ 28` **e**
   `document.elementFromPoint(cx, rect.top − 6)` e `elementFromPoint(cx, rect.bottom + 6)` devolvem o
   próprio botão (ou descendente), com `cx = rect.left + rect.width/2` e o elemento rolado para o meio da tela.
   **Resultado esperado de `medir().alvosPequenos` no 17PM:** `mes` [], `menu` [], `jarvis` [];
   `dia`/`atrasadas`/`sequencia` só `.notas-toggle` e `.agenda-share` (h 28); `lista` só esses mais
   `.list-previous` e `.tr-open` (h 28); `voz` só os dois `a[href]` dos créditos (13 px);
   `nova-tarefa` só `#taskLembrete` (18×18, que deve estar dentro de `label.field-check` com h 44).
4. **Largura aproveitada (plano 4).** 17PM × 13: `larguraConteudo` 440 × 390;
   `larguraConteudoInterna` 408 × 358; `celulaCalendario` 52.6 × 46 (17PM > 13 por ≥ 6);
   `celulaCalendarioAltura` 91 × 78; `#taskDialog` 408 × 358; `#voz-dialog` 408 × 358;
   `#alertsDialog` 408 × 358; `#rescheduleDialog` 400 × 358; `.reschedule-task-name` 303 × 261;
   `#jarvis-panel` 416 × 366; `#viewContent .task-main` 296 × 246; `.calendar-tag` `font-size` 9px × 8px.
5. **Sem regressão (plano 5).** `npm`/node: as 9 suítes do plano (`e2e-so-claude, e2e-voz-saida, e2e-voz,
   e2e-gasto, e2e-multi, e2e-atualiza, e2e-lista, e2e-ouvindo, e2e-vozes-app`), o teste de unidade e o
   novo `testes/layout.cjs` passam; `page.__erros` vazio em todas as vistas (medido: vazio).
6. **Páginas auxiliares (plano 6), perfil 17PM**, as 12 da auditoria §e: `scrollWidth == 440`;
   `cabecalho.sobIlha == false` e `cabecalho.conteudoTop ≥ 62` (esperado 76–136 como hoje);
   `interativosSobIlha == 0`; nenhum fixo sob o indicador. Alvos: `financeiro .filters button` ×6 h 44;
   `.sa-foot button`, `.iv-foot button` nível B; `investimentos .savebtn` h 44, `.editbtn` nível B;
   `fatura-inter .tabs button` ×2 h 44; `refaturamento .sim-toggle` h 44; `marketplace #cofre label` h 44
   e `#cofreLembrar` 22×22 (tela de senha, estado padrão), `.views button` h 44 (medir com
   `documentElement.classList.remove('trancado')`), `.barra` `getComputedStyle(...).top == '62px'`;
   `equipamentos-especiais .chip` h 44, `.appswitch a` h 44, `.quickbar button` h 44, `.buscabar input` h 44,
   `#cidadeFiltro` h 44, `#app-update` 44×44 com folga 10; `treino.html?date=…` (criado como na auditoria)
   `.tr-preset` ≥ 44×44, `.tr-tbtn` 44×44, `#trHome` h 44, `.tr-inputs input` h 44.
7. **Véu (M10).** App, vistas `lista` e `mes`, dois perfis: `getComputedStyle(document.body,'::before')`
   com `position == 'fixed'`, `height == inset.top + 'px'` (62 / 47), `zIndex == '60'`, `content == '""'`,
   `backgroundColor == getComputedStyle(document.body).backgroundColor`. Com `scrollTo(0,400)` na `lista`:
   `elementFromPoint(220,31)` é `document.body` (não está dentro de `main.app`) e, para cada interativo
   com `rect.top < inset.top`, `elementFromPoint` no centro recortado pela faixa não devolve o próprio
   elemento (esperado: 7 de 7 cobertos no 17PM, 3 de 3 no 13). Mesmo predicado de estilo nas 11
   auxiliares com véu (cor igual ao `body`, exceto `equipamentos-especiais`, onde a cor é `#101017`).
8. **Versões.** `index.html` contém `treino.js?v=13`, `notas.js?v=10`, `agenda-sharing.js?v=5`,
   `sequencial.js?v=4`, `vozes-neurais.js?v=2`; `treino.html` contém `treino.js?v=13`; `grep -c` de cada
   `old` da seção 3.13 e 4 devolve 0 e de cada `new` devolve 1.
9. **Altura do topo (orçamento vertical).** 17PM, vista `mes`, rolagem 0: `#viewTabs` h 54,
   `#seqEntryBtn` h 44, `#filters` h 60, `.toolbar` h 62; primeira `.calendar-day` com `top` 598 ± 2
   (antes 576). No 13: `top` 612 ± 2 (antes 590). Toast forçado (`#toast.show`): `bottom == H − insetB − 184`
   (738 / 626) e `bottom < #cardioFab.top` (749 / 637).
10. **Paisagem não quebra.** Perfil `{nome:'iphone17promax-paisagem', width:956, height:440, dpr:3,
    insets:{top:20,bottom:20,left:62,right:62}}` nas vistas `mes`, `lista`, `jarvis`:
    `scrollWidth ≤ 956`; nenhum elemento **fixo** interativo com `left < 62` ou `right > 894`;
    `#jarvis-panel.open` com `top ≥ 20` e `bottom ≤ 420`.

---

## 7. Fora do escopo e riscos

**Decidi não mudar (com motivo):**
- **B1 (flutuantes cobrem células/cartões):** mover ou encolher `+ Nova tarefa`, `#cardioFab` e `#jarvis-btn`
  é mudança de funcionalidade/identidade; o `padding-bottom` do `.app` (196 + inset) garante rolagem até o
  fim. Piora 16 px com o A6 e fica registrado.
- **B3 (`.quick-menu` 260 px fixo):** os 9 itens cabem em 244 (medido, inclusive os dois rótulos novos do M9).
- **B5 só parcialmente:** a etiqueta vai a 9 px no 17PM; não troco o corte por reticências nem o número
  de etiquetas por célula (mudaria o desenho do calendário).
- **Links de crédito do seletor de voz (`.vz-cred a`, 13 px):** são links dentro de um parágrafo de
  rodapé, não controles do app; mudar a altura da linha mudaria a tipografia do texto.
- **`#taskLembrete` 18×18:** o alvo é o `<label>` de 44 que o envolve (M6 resolvido pelo rótulo).
- **`h1` quebra em duas linhas no iPhone 13** ("Minha / agenda", 196 px disponíveis) e **os 4 chips de
  filtro rolam no 13** (367 > 358): comportamento já presente nas capturas "antes"; não piora, não entra.
- **`<meta apple-mobile-web-app-status-bar-style>`**: fica `black-translucent`; o véu M10 resolve a
  sobreposição sem mudar a cor da barra (pesquisa, item 4).
- **Paisagem:** só "não quebrar" (plano); nenhuma regra nova.
- **`financeiro-compartilhado.html`:** layout próprio não medido (redireciona). A F5 mede se tiver usuário
  com acesso; a F4 aplica só o véu.
- **Diálogos do treino dentro da agenda (`#treinoDialog`, `#cardioDiaDialog`):** herdam
  `dialog{max-width:calc(100% - 32px)}` (408 em vez de 402); `.tr-close` vai a 44 por tabela; nada mais.
- **`localizacao.js` e `agenda-notas-rapidas.js`:** não editados; vencidos por `!important` e `::after`
  no `index.html` (menos arquivos, sem cache-bust extra).

**Riscos assumidos:**
1. **Orçamento vertical:** o topo cresce 22 px nos dois aparelhos (abas +7, seq +4, filtros +10, barra +1);
   o 17PM tem +97 px úteis, o 13 perde 22 px de conteúdo acima da dobra. Mitigação: barra 12 → 8 de padding.
2. **Cartão de tarefa:** coluna de texto −3 px; altura +4 px; a caixa de marcar passa a depender de
   `::before` no `<input>` (o app já usava `::after` no mesmo input; medido ok no Chromium 141; o WebKit
   desenha pseudo-elementos em `input[type=checkbox]` com `appearance:none` do mesmo jeito). O `:active`
   do relógio de reagendar pinta 44×44.
3. **Margens negativas** (`.check`, `.task-reschedule`, `.clear-done`): o retângulo passa 5 px do conteúdo
   do cartão, dentro do padding de 5 px; nada é recortado por `.task-swipe{overflow:hidden}`.
4. **`#jarvis-locbar` com `!important`** sobre estilo inline: se `localizacao.js` mudar o inline, a regra
   continua valendo; documentado aqui e no CSS.
5. **Rótulos do M9 vêm de `aria-label`:** se alguém trocar o `aria-label` em `agenda-notas-rapidas.js`,
   o texto do menu muda junto (é o comportamento desejado).
6. **Toast 91 px mais alto:** não cobre botões; cobre conteúdo por ~2 s.
7. **Véu com `pointer-events` padrão:** toques na faixa da barra de status caem no véu (o iOS já intercepta
   essa região para "rolar ao topo"). Com o bug 301994 (`env` = 0) o véu some sozinho.
8. **`#jarvis-panel` sem `max-width`:** em viewports entre 440 e 480 o painel ocupa 100 % − 24; acima de
   480 a media query existente (`width:400px`) segue valendo.
9. **Cor do véu em `equipamentos-especiais`** é aproximada (`#101017` sobre um gradiente): diferença de
   ~3 níveis de cinza nos cantos superiores; aceitável para uma página de terceiro nível.
