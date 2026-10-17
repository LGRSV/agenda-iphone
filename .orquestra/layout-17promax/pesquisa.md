# F1 — Pesquisa: iPhone 13 × iPhone 17 Pro Max (números para o layout web)

Pesquisa feita em 17/10/2026. Rótulos: **FATO** (fonte primária ou medição publicada),
**INFERÊNCIA** (derivado, com o cálculo mostrado) e **HIPÓTESE** (sem fonte direta, só indício).
Nas fontes, 1 pt do UIKit = 1 px CSS, porque o app usa `width=device-width` e os dois aparelhos têm
DPR 3 (INFERÊNCIA: é assim que o Safari mapeia a viewport com `device-width`).

## Diferenças em relação aos valores provisórios (leia primeiro)

| Valor provisório da auditoria | O que as fontes dizem | Situação |
|---|---|---|
| 17 Pro Max 440×956, DPR 3 | 440×956 pt, 3x (1320×2868 px ÷ 3) | **Confirmado** |
| 17 Pro Max, insets em retrato 62 / 34 | top 62, bottom 34, left 0, right 0 | **Confirmado** |
| iPhone 13 390×844, DPR 3 | 390×844 pt, 3x (1170×2532 px ÷ 3) | **Confirmado** |
| iPhone 13, insets 47 / 34 | top 47, bottom 34, left 0, right 0 | **Confirmado** |

Nenhum valor provisório mudou. Mas há **quatro pontos novos** que a auditoria ainda não tinha:

1. **Insets em paisagem no iOS 26 diferem do iOS 18.** No 17 Pro Max (iOS 26), o UIKit dá
   top 20 / bottom 20 / left 62 / right 62. No 16 Pro Max, com a mesma tela de 440×956 pt mas no iOS 18,
   eram top 0 / bottom 21 / left 62 / right 62. Fóruns da Apple tratam o top 20 em paisagem como
   possível regressão do iOS 26. Não é um número estável: leia sempre `env()`, não fixe valor no código.
2. **Bug aberto no app instalado (WebKit 301994, reaberto em 04/08/2026 no iOS 27 beta).** Às vezes o
   sistema desenha uma faixa opaca de **62 px** em cima da camada web. Nesse caso
   `innerHeight = 100dvh = screen.height − 62`, e `env(safe-area-inset-top)` passa a valer 0.
   Já foi visto no 26.1, foi corrigido no 26.2 e voltou no 26.5.2 e no iOS 27 beta. O layout precisa
   funcionar nos dois estados: tela inteira com inset de 62, ou área reduzida com inset 0.
3. **O iOS atual é o 27** (lançado em 14/09/2026). O 17 Pro Max saiu de fábrica com o iOS 26, mas o
   aparelho do dono pode já estar no 27. As notas do Safari 27.0 não trazem nenhuma mudança de safe area,
   `viewport-fit` ou web app de tela de início.
4. **Desde o iOS 26, o Safari ignora `theme-color`.** A cor das barras passa a vir do fundo do `body`
   ou de elementos `position: fixed` encostados na borda. Isso vale no Safari e, desde o 26.1, também no
   app instalado.

---

## 1. Tabela comparativa

### 1a. Tela, DPR e viewport

| Item | iPhone 13 | iPhone 17 Pro Max | Rótulo / fonte |
|---|---|---|---|
| Diagonal | 6,1" (6,06" como retângulo) | 6,9" (6,86" como retângulo) | FATO — [A1], [A2], [A3] |
| Pixels físicos (retrato) | 1170 × 2532 | 1320 × 2868 | FATO — [A1], [A2] |
| Densidade | 460 ppi | 460 ppi | FATO — [A1], [A2] |
| DPR (fator de escala) | 3 | 3 | FATO — [U13], [U17] (medição publicada); [Y17] confirma o 17 PM |
| Viewport CSS em retrato | 390 × 844 | 440 × 956 | FATO — [U13], [U17]. INFERÊNCIA que confere: 1170÷3 = 390, 2532÷3 = 844; 1320÷3 = 440, 2868÷3 = 956 |
| Viewport CSS em paisagem (app instalado, tela inteira) | 844 × 390 | 956 × 440 | INFERÊNCIA: retrato girado |
| Ganho em relação ao 13 | — | largura +50 px (+12,8%), altura +112 px (+13,3%) | INFERÊNCIA: 440÷390 = 1,128; 956÷844 = 1,133 |
| px CSS por polegada física | ≈153,3 | ≈153,3 | INFERÊNCIA: 460 ÷ 3 |
| Altura da status bar | 47 pt | 54 pt | FATO — [U13], [U17] |

### 1b. Safe-area-inset (px CSS)

App instalado na tela de início (standalone, `viewport-fit=cover`, `black-translucent`). Em
standalone a página ocupa a tela toda, então `env(safe-area-inset-*)` deve refletir o safe area do
UIKit, que é a fonte das medições abaixo. Essa equivalência é **INFERÊNCIA**: o WebKit não publica
tabela por aparelho e não achei medição de `env()` no 17 Pro Max.

| Inset (standalone) | iPhone 13 retrato | iPhone 13 paisagem | 17 Pro Max retrato | 17 Pro Max paisagem |
|---|---|---|---|---|
| top | 47 | 0 | 62 | 20 (iOS 26) / 0 (iOS 18, valor do 16 PM) |
| bottom | 34 | 21 | 34 | 20 (iOS 26) / 21 (iOS 18, valor do 16 PM) |
| left | 0 | 47 | 0 | 62 |
| right | 0 | 47 | 0 | 62 |
| Rótulo | FATO UIKit [U13] (iOS 15) → INFERÊNCIA para `env()` | idem | FATO UIKit [U17] (iOS 26) → INFERÊNCIA para `env()` | FATO UIKit [U17], [U16] → INFERÊNCIA para `env()` |

Área útil derivada, dentro do safe area (INFERÊNCIA):
- 17 PM retrato: 440 × (956 − 62 − 34) = **440 × 860**. iPhone 13 retrato: 390 × (844 − 47 − 34) = **390 × 763**. O 17 PM ganha +50 px de largura e +97 px de altura útil.
- 17 PM paisagem (iOS 26): (956 − 62 − 62) × (440 − 20 − 20) = **832 × 400**. iPhone 13 paisagem (iOS 15): (844 − 47 − 47) × (390 − 0 − 21) = **750 × 369**.
- 17 PM retrato com o bug 301994 ativo: viewport de **440 × 894** (956 − 62), com `env(top)` = 0 (INFERÊNCIA a partir de [W301994], que mediu 874 → 812 num aparelho de 874 pt).

Safari (aba normal, não instalado), com `viewport-fit=cover`:

| Inset (Safari) | iPhone 13 | 17 Pro Max | Rótulo |
|---|---|---|---|
| top, retrato | 0 | 0 | HIPÓTESE apoiada em [W274773]: um mantenedor do WebKit diz ser "esperado" ter zero em retrato. Em aba, o Safari pinta a área da status bar e a página começa abaixo dela |
| bottom, retrato | depende da barra: 0 com a barra expandida; até 34 quando a página passa por baixo do indicador de início | idem | HIPÓTESE (não achei medição publicada; no iOS 26 a barra Compact flutua sobre o conteúdo) |
| left/right, paisagem | 47 | 62 | HIPÓTESE: o Safari não cobre as laterais, então deveriam valer os insets de hardware |
| top/bottom, paisagem | não encontrado | não encontrado | — |

### 1c. Recorte da câmera e indicador de início

| Item | iPhone 13 (notch) | iPhone 17 Pro Max (Dynamic Island) | Rótulo / fonte |
|---|---|---|---|
| Tipo | notch | Dynamic Island (pílula), centralizada no topo | FATO — [A1], [A3], [A4] |
| Largura | **não encontrado em pt.** A Apple diz "cerca de 20% mais estreito que o do iPhone 12". Vazamento pré-lançamento: ~26 mm ≈ **157 px CSS** | **não encontrado em fonte primária.** Vazamento pré-lançamento: 2,0 cm (16 Pro) ou 1,5 cm (17 Pro) ≈ **121 px** ou **91 px CSS** | HIPÓTESE — [N13], [DI17]. Conta: mm ÷ 25,4 × 153,3 |
| Altura | não encontrado (vazamento: ~5,35 mm ≈ 32 px CSS) | não encontrado. Valor da era 14 Pro: ~37 pt de altura | HIPÓTESE — [N13], [DI14] |
| Posição vertical | colado na borda de cima, dentro da status bar de 47 pt | dentro da status bar de 54 pt; o safe area começa em 62 | INFERÊNCIA a partir de [U13], [U17] |
| Indicador de início: reserva (safe area bottom) | 34 pt (retrato), 21 pt (paisagem) | 34 pt (retrato), 20 pt (paisagem, iOS 26) | FATO — [U13], [U17] |
| Indicador de início: barra visível | ~134 × 5 pt (valor do iPhone X) | não encontrado para o 6,9" | HIPÓTESE — [HI] |

---

## 2. Safari no iOS atual

Versões: o 17 Pro Max saiu com o **iOS 26** (set/2025). O **iOS 27** foi liberado em
**14/09/2026** [R27] e o Safari 27.0 foi publicado em 17/09/2026 [S27]. O comportamento abaixo vem
do Safari 26; o 27.0 não lista mudança nesses pontos.

### 2a. Altura da barra de ferramentas e da barra de abas
- O iOS 26 tem três layouts de abas, escolhidos em Ajustes > Apps > Safari > Abas: **Compact**
  (padrão), **Bottom** e **Top** — FATO [9M], [IDB].
- **Altura em pt das barras: não encontrada em fonte primária.** A Apple não publica esse número.
- Única medição publicada que achei, de segunda mão: num iPhone 16 Pro (tela de 874 pt) com iOS 26.0,
  `innerHeight` foi **768** no modo Top e **754** no modo Compact recolhido — FATO de terceiros
  [SA] via resumo [DD]. O artigo original deu 403, então não consegui ler a tabela completa.
  - Navegador ocupando 874 − 768 = **106 px** (Top) e 874 − 754 = **120 px** (Compact recolhido) — INFERÊNCIA.
  - Se a interface do Safari tiver a mesma altura em pt no 17 Pro Max: `innerHeight` ≈ 956 − 106 = **850** (Top)
    e ≈ 956 − 120 = **836** (Compact recolhido) — INFERÊNCIA. Não foi medido.
- No iOS 26, elementos fixos no topo e no rodapé se deslocam "alguns pixels" ao rolar nos modos
  Compact e Bottom. No modo Top, o cabeçalho fixo some atrás da barra de endereço (iPhone 15 Pro,
  iOS 26.0 beta) — FATO de fórum [AF799143].

### 2b. 100vh / dvh / svh / lvh
- Comportamento esperado do WebKit: `svh` fixo na viewport pequena (barras expandidas), `lvh` fixo na
  grande e `dvh` acompanhando as barras. O bug em que `svh` e `dvh` ficavam iguais foi corrigido em
  13/11/2023 — FATO [W261185].
- No iOS 26, `vh` passa a valer 1% de `window.outerHeight`, que não muda quando a barra de endereço
  expande ou recolhe — FATO de terceiros [SA], via resumo de busca.
- Safari 26.0 corrigiu `lvh`/`vh` dimensionados pela viewport pequena no SFSafariViewController — FATO [S26].
- Safari 26.1 corrigiu um "bottom gap appearing on layouts with viewport-sized fixed containers on iOS"
  (vão embaixo de contêineres fixos do tamanho da viewport) — FATO [SRN261].
- Safari 26.2 corrigiu backdrops de diálogo em tela cheia que não iam até embaixo da barra de
  endereço — FATO [SRN262].
- **No app instalado** não há barra do navegador. Esperado: `100vh = 100svh = 100lvh = 100dvh = innerHeight = 956`
  no 17 PM — HIPÓTESE coerente com [W301994]. **Com o bug 301994 ativo**, `innerHeight = 100dvh`
  vira `screen.height − 62` (medido: 812 num aparelho de 874) e `vh`/`lvh` deixam de bater com
  `svh`/`dvh` — FATO de usuários em [W301994].
- Teclado: no iOS 26.0, `visualViewport.offsetTop` às vezes não volta a 0 depois que o teclado fecha,
  e houve um vão de 24 px entre `visualViewport.height` e `innerHeight` — FATO de fórum [AF800125].
  Nos iPhones com Dynamic Island, a viewport sobe "alguns pixels" depois que o teclado fecha. Segundo
  um engenheiro do WebKit, isso "deveria estar corrigido" no 26.1, mas o bug segue NEW [W300523].

### 2c. Mudanças de safe area e `viewport-fit` que importam para PWA
- Safari 26: **todo site adicionado à tela de início abre como web app por padrão**, mesmo sem
  manifesto. O usuário pode desligar "Abrir como Web App" — FATO [S26], [BF].
- Safari 26 deixou de usar `theme-color`. A cor da "testa" e do "queixo" vem do fundo do `body` ou
  de elementos `position: fixed` encostados na borda. No 26.1, o app instalado também passou a usar o
  fundo de elementos fixos — FATO de terceiros [BF], [1AR].
  - Regra levantada pela comunidade: o Safari amostra elementos fixos a até 4 px do topo e 3 px do rodapé,
    com 80% da largura. Um elemento com `opacity: 0` continua contando; `display: none` não — HIPÓTESE [1AR].
- `viewport-fit=cover` continua obrigatório para o conteúdo passar por baixo do indicador de início e
  para `env(safe-area-inset-bottom)` valer mais que 0 no app instalado — FATO [W236445], [BF].
- **Regressão 301994** (detalhes em "Diferenças", item 2):
  - No iOS 26.1, `env(safe-area-inset-top)` caiu de ≈44 para 0 num iPhone 12 mini.
  - A cor da barra de baixo fica presa no fundo da página e só atualiza quando o app é reaberto.
  - FATO [W301994].
- Top inset de 20 em paisagem no iOS 26: fóruns registram um vão preto no topo de um PWA em paisagem
  e `safeAreaInsets.top` = 20 em vez de 0 depois de girar. Nenhum engenheiro da Apple disse se é
  intencional — FATO de fórum [AF798014].
- Safari 27.0: nenhum item sobre safe area, `viewport-fit`, status bar ou web app de tela de início.
  Há a correção "top and bottom fixed-position elements flickering during rubber-band scrolling" —
  FATO [S27].

---

## 3. HIG: alvo de toque e margens

| Item | Valor | Rótulo / fonte |
|---|---|---|
| Tamanho padrão de controle (iOS/iPadOS) | **44 × 44 pt** | FATO — [HIG-A], [HIG-B], [DT] |
| Tamanho mínimo de controle (iOS/iPadOS) | **28 × 28 pt** | FATO — [HIG-A] |
| Folga em volta de elementos com borda/fundo (bezel) | ~**12 pt** | FATO — [HIG-A] |
| Folga em volta de elementos sem bezel (ícone solto, texto) | ~**24 pt** a partir da borda visível | FATO — [HIG-A] |
| Margem lateral padrão (raiz da tela, UIKit) | **16 pt** em largura compacta (todo iPhone em retrato); 20 pt em largura regular | FATO de terceiros — [UML] (2017). A HIG atual fala em "standard margins" sem dar número [HIG-L] |
| Margem lateral em iPhones largos (Plus/Max) | 20 pt é o valor que circula na comunidade | HIPÓTESE — sem fonte primária |

Observação: a página HIG Layout foi revisada em 09/09/2026 ("Updated guidance to reflect current
best practices"). O JSON atual não tem mais a tabela de dimensões por aparelho, apesar de o
histórico registrar "Added specifications for … iPhone 17 Pro Max" em 09/09/2025 — FATO [HIG-L].

---

## 4. JSON final

Insets do app instalado (standalone). Paisagem do 17 PM: valores do iOS 26. Paisagem do iPhone 13:
valores medidos no iOS 15, não remedidos no iOS 26 (veja a seção 1b).

```json
{"iphone13":{"w":390,"h":844,"dpr":3,"insetsRetrato":{"top":47,"bottom":34,"left":0,"right":0},"insetsPaisagem":{"top":0,"bottom":21,"left":47,"right":47}},
 "iphone17promax":{"w":440,"h":956,"dpr":3,"insetsRetrato":{"top":62,"bottom":34,"left":0,"right":0},"insetsPaisagem":{"top":20,"bottom":20,"left":62,"right":62}},
 "alvoMinimoToque":44}
```

Rótulos do JSON:
- `iphone13.w/h/dpr`: FATO [A1], [U13].
- `iphone13.insets*`: FATO UIKit [U13] → INFERÊNCIA para `env()`.
- `iphone17promax.w/h/dpr`: FATO [A2], [U17], [Y17].
- `iphone17promax.insetsRetrato`: FATO UIKit [U17] → INFERÊNCIA para `env()`.
- `iphone17promax.insetsPaisagem`: FATO UIKit [U17] (iOS 26) → INFERÊNCIA para `env()`. No iOS 18 seria
  0/21/62/62 [U16].
- `alvoMinimoToque`: 44 é o tamanho **padrão recomendado** [HIG-A], [HIG-B], [DT]. O mínimo absoluto da
  HIG é 28.

---

## 5. Fontes

Todas acessadas em **17/10/2026**.

| Id | Fonte | URL | Usada para |
|---|---|---|---|
| A1 | Apple Support — iPhone 13 Technical Specifications | https://support.apple.com/en-us/111872 | 6,1"/6,06", 2532×1170, 460 ppi |
| A2 | Apple — Compare iPhone models | https://www.apple.com/iphone/compare/ | 17 PM: 6,9", 2868×1320, 460 ppi |
| A3 | Apple — iPhone 17 Pro specs (página regional, coluna Pro Max) | https://www.apple.com/uk/iphone-17-pro/specs/ (hoje redireciona para a linha 18; dados vistos via índice de busca das páginas regionais) | 6,86" como retângulo, Dynamic Island |
| A4 | Apple Support — Models with a Dynamic Island (iOS 26) | https://support.apple.com/en-il/guide/iphone/aside/iphc36491887/26/ios/26 | 17 Pro/Pro Max têm Dynamic Island |
| U17 | Use Your Loaf — iPhone 17 Screen Sizes (13/10/2025) | https://useyourloaf.com/blog/iphone-17-screen-sizes/ | 440×956 pt, 3x, status bar 54, insets retrato 62/34/0/0 e paisagem 20/20/62/62 |
| U16 | Use Your Loaf — iPhone 16 Screen Sizes (16/09/2024) | https://useyourloaf.com/blog/iphone-16-screen-sizes/ | 16 PM 440×956, insets paisagem iOS 18: 0/21/62/62 |
| U13 | Use Your Loaf — iPhone 13 Screen Sizes (20/09/2021, atualizado 12/10/2022) | https://useyourloaf.com/blog/iphone-13-screen-sizes/ | 390×844 pt, 3x, status bar 47, insets 47/34/0/0 e 0/21/47/47 |
| Y17 | YesViz — iPhone 17 Pro Max | https://yesviz.com/devices/iphone-17-pro-max/ | viewport 440×956, DPR 3 (sem fonte primária citada) |
| S26 | WebKit — WebKit Features in Safari 26.0 (15/09/2025) | https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ | web app por padrão; correção lvh/vh no SFSafariViewController |
| S27 | WebKit — WebKit Features for Safari 27.0 (17/09/2026) | https://webkit.org/blog/18325/webkit-features-for-safari-27-0/ | sem mudança de safe area/PWA; correção de fixed piscando no rubber-band |
| SRN261 | Apple — Safari 26.1 Release Notes | https://developer.apple.com/documentation/safari-release-notes/safari-26_1-release-notes | correção do bottom gap em contêineres fixos do tamanho da viewport |
| SRN262 | Apple — Safari 26.2 Release Notes | https://developer.apple.com/documentation/safari-release-notes/safari-26_2-release-notes | backdrop de diálogo sob a barra de endereço |
| W301994 | WebKit Bugzilla 301994 — status bar visible in Home Screen Web apps | https://bugs.webkit.org/show_bug.cgi?id=301994 | faixa de 62 px, innerHeight 812/874, env(top) 44→0, reaberto no iOS 27 beta |
| W300523 | WebKit Bugzilla 300523 — viewport shift on Dynamic Island iPhones | https://bugs.webkit.org/show_bug.cgi?id=300523 | viewport sobe depois que o teclado fecha |
| W261185 | WebKit Bugzilla 261185 — svh/dvh equal | https://bugs.webkit.org/show_bug.cgi?id=261185 | semântica de svh/dvh/lvh, corrigido em 2023 |
| W274773 | WebKit Bugzilla 274773 — env(safe-area-inset-*) returns 0 | https://bugs.webkit.org/show_bug.cgi?id=274773 | "expected to get zeroes in portrait" (aba do Safari) |
| W236445 | WebKit Bugzilla 236445 — safe-area on home screen sites | https://bugs.webkit.org/show_bug.cgi?id=236445 | standalone exige viewport-fit=cover para bottom > 0 |
| AF798014 | Apple Developer Forums 798014 — Change to safe area logic on iOS 26 | https://developer.apple.com/forums/thread/798014 | top 20 em paisagem; vão preto em PWA em paisagem |
| AF799143 | Apple Developer Forums 799143 — header/footer shifted in Safari tab settings | https://developer.apple.com/forums/thread/799143 | deslocamento de fixos nos modos Compact/Bottom/Top |
| AF800125 | Apple Developer Forums 800125 — visualViewport offsetTop | https://developer.apple.com/forums/thread/800125 | offsetTop não volta a 0; vão de 24 px |
| SA | stripearmy (Medium) — iOS 26.0: be prepared for viewport changes in Safari | https://stripearmy.medium.com/ios-26-0-be-prepared-for-viewport-changes-in-safari-e867d7eace43 (403 ao abrir; dados via índice de busca) | innerHeight 768 (Top) / 754 (Compact) no 16 Pro; vh = outerHeight |
| DD | daily.dev — resumo do artigo SA (30/09/2025) | https://daily.dev/posts/apple-do-it-again-ios-26-have-completely-break-your-viewport-and-vh-related-units-just-unbeliev-8yowc53re | confirma 768 px no modo Top |
| BF | Ben Frain — iOS 26 Safari theme-color / tab tinting (16/11/2025) | https://benfrain.com/ios26-safari-theme-color-tab-tinting-with-fixed-position-elements/ | theme-color ignorado; tinta vinda de fixed; web app sem manifesto |
| 1AR | 1ar.io — Safari 26 Liquid Glass (13/05/2026) | https://1ar.io/updates/safari-26-liquid-glass-web/ | regras de amostragem de fixed; viewport-fit=cover para barra transparente |
| 9M | 9to5Mac — iOS 26 Safari compact design (15/09/2025) | https://9to5mac.com/2025/09/15/iphone-ios-26-safari-new-compact-design/ | três layouts de abas |
| IDB | iDownloadBlog — iOS 26 Safari tab bar designs | https://www.idownloadblog.com/2025/06/12/ios-26-safari-tab-bar-designs/ | Compact é o padrão |
| R27 | Khaleej Times — iOS 27 release date (10/09/2026) | https://www.khaleejtimes.com/tech/ios-27-uae-release-date-time-eligible-iphones-new-features | iOS 27 em 14/09/2026 |
| HIG-A | Apple HIG — Accessibility (JSON da página) | https://developer.apple.com/design/human-interface-guidelines/accessibility | 44×44 padrão, 28×28 mínimo, folgas de 12/24 pt |
| HIG-B | Apple HIG — Buttons | https://developer.apple.com/design/human-interface-guidelines/buttons | "hit region of at least 44x44 pt" |
| HIG-L | Apple HIG — Layout (revisada em 09/09/2026) | https://developer.apple.com/design/human-interface-guidelines/layout | "standard margins" sem número; tabela de aparelhos removida |
| DT | Apple — UI Design Dos and Don'ts | https://developer.apple.com/design/tips/ | "at least 44 points x 44 points" |
| UML | Use Your Loaf — Changing Root View Layout Margins (17/07/2017) | https://useyourloaf.com/blog/changing-root-view-layout-margins/ | 16 pt compacto / 20 pt regular |
| N13 | Macworld / 9to5Mac — iPhone 13 notch (2021) | https://www.macworld.com/article/357723/iphone-13-notch-vs-iphone-12-size.html ; https://9to5mac.com/2021/09/14/iphone-13-notch-smaller-but-bigger/ | notch 20% mais estreito; vazamento de 26 mm / 5,35 mm |
| DI17 | AppleInsider — iPhone 17 Pro Dynamic Island leak (05/09/2025) | https://appleinsider.com/articles/25/09/05/new-iphone-17-pro-leak-suggests-dynamic-island-is-shrinking | 2 cm → 1,5 cm (rumor) |
| DI14 | Infinum — Designing for Dynamic Island (21/09/2022) | https://infinum.com/?p=28092 | altura de ~36–37 pt (era 14 Pro) |
| HI | ifanr — iPhone X UI (2017) | https://www.ifanr.com/app/914691 | barra do indicador 134×5 pt |

### Lacunas registradas
- Dimensões exatas, em pt, da Dynamic Island do 17 Pro Max e do notch do iPhone 13: sem fonte primária.
  Confirmar nos Apple Design Resources (Figma) ou medir com uma captura de tela.
- Altura das barras do Safari no iOS 26/27 no 17 Pro Max: não medida. Só existe a medição de segunda
  mão no 16 Pro.
- `env(safe-area-inset-*)` no 17 Pro Max: nenhuma medição publicada. Os valores vêm do UIKit. Vale
  medir no aparelho com `getComputedStyle` sobre uma variável `env()`, em retrato e paisagem.
- Insets do iPhone 13 em paisagem no iOS 26: não remedidos. Podem ter virado top 20 / bottom 20, como
  no 17 Pro Max.
