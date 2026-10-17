# Missão: layout do Agenda Lagares revisado para o iPhone 17 Pro Max

## 1. Missão
Ajustar o layout do app (pensado para o iPhone 13, 390×844) para aproveitar e respeitar a tela do
iPhone 17 Pro Max: área segura da Dynamic Island, indicador de início e largura maior. O iPhone 13
não pode piorar.

## 2. Definição de pronto (verificável por terceiro)
Perfis de medição (valores definitivos vêm da frente F1; até lá são HIPÓTESE):
- `iphone17promax`: viewport 440×956, DPR 3, área segura retrato top 62 / bottom 34 (app instalado);
- `iphone13`: viewport 390×844, DPR 3, área segura retrato top 47 / bottom 34.

1. **Sem rolagem lateral** nos dois perfis: em Mês, Dia, Lista, Atrasadas e Sequência, no painel do
   Jarvis, no seletor de voz e no diálogo de nova tarefa, `document.documentElement.scrollWidth <=
   largura do viewport`. Conferido por script.
2. **Nada clicável sob a Dynamic Island nem sob o indicador de início** (ajustado na rodada 1, a
   partir do achado da F2): com rolagem 0, nenhum elemento interativo visível tem `top < inset_top`;
   nenhum elemento interativo **fixo** (`position: fixed` ou `sticky`) tem
   `bottom > altura - inset_bottom`, nos dois perfis. O conteúdo que rola pode passar pela dobra.
   Conferido por script com a área segura emulada.
3. **Alvos de toque ≥ 44×44 px** (HIG da Apple) no perfil 17 Pro Max: botão +, botão do Jarvis,
   setas de navegação, abas de visão, filtros, microfone e enviar do Jarvis, e botões do cabeçalho.
   Conferido por script (getBoundingClientRect).
4. **A largura extra é aproveitada:** no 17 Pro Max o conteúdo principal ocupa a largura útil
   (sem trava em 390). A célula do calendário fica mais larga que no iPhone 13. Conferido medindo os
   dois perfis.
5. **Sem regressão:** todas as suítes E2E existentes passam, além do teste de unidade e do teste
   novo de layout. Lista:
   - e2e-so-claude, e2e-voz-saida, e2e-voz;
   - e2e-gasto, e2e-multi, e2e-atualiza;
   - e2e-lista, e2e-ouvindo, e2e-vozes-app.
6. **Páginas auxiliares alcançáveis pelo app** (lista levantada pela F2): no perfil 17 Pro Max, sem
   rolagem lateral e com o cabeçalho fora da Dynamic Island. Conferido por script.
7. **Publicado:** o CACHE do sw.js foi aumentado, a versão nova está no ar e as capturas de antes e
   depois foram entregues ao dono.

## 3. Fora do escopo
- Mudar identidade visual (cores, fontes, ícones) ou criar funcionalidades.
- iPad e otimização de paisagem: em paisagem, só "não quebrar".
- Mexer em comportamento JavaScript, salvo o necessário para o layout.
- Login e segurança: o dono pediu para deixar o login como está.

## 4. Lições anteriores
Não existe `.orquestra/licoes.md` (primeira missão).

## 5. Frentes
O cérebro é o Fable: escreve a especificação e faz a revisão final adversarial. Os funcionários são
5 agentes Opus.

| Frente | Papel | Modelo | Entregável | Depende de |
|---|---|---|---|---|
| F1 pesquisa | pesquisador de especificação de hardware/web | opus | `.orquestra/layout-17promax/pesquisa.md` | — |
| F2 auditoria | auditor de layout com Playwright | opus | `auditoria.md`, `harness/medir.cjs` e capturas | — |
| C1 especificação | cérebro, arquiteto de layout | fable | `especificacao.md` | F1, F2 |
| F3 app principal | implementador CSS (index.html, vozes-neurais.js) | opus | mudanças nesses arquivos | C1 |
| F4 páginas auxiliares | implementador CSS (só as páginas aux) | opus | mudanças nas páginas aux | C1 |
| F5 verificação | testador independente | opus | `testes/layout.cjs` e `verificacao.md` | F3, F4 |
| C2 revisão final | cérebro, revisor adversarial | fable | `revisao-final.md` | F5 |

### Contratos
- **Perfis de medição:** os nomes e valores acima. Se a F1 corrigir algum valor, a C1 atualiza e
  as medições são refeitas.
- **Emulação da área segura:**
  - preferência: CDP `Emulation.setSafeAreaInsetsOverride`;
  - se o Chromium não aceitar, trocar `env(safe-area-inset-*)` por px nas respostas
    HTML/CSS/JS via `page.route`.
  O harness da F2 (`harness/medir.cjs`) exporta:
  - `perfis`;
  - `abrirApp(page, perfil)`;
  - `medir(page, perfil, vista)`, que devolve JSON;
  - `capturar(page, caminho)`.
- **Arquivos** (ajustado na rodada 1: a F2 mostrou CSS injetado por scripts da página principal):
  - F3 mexe em `index.html`, `vozes-neurais.js` e no CSS que os scripts carregados pelo `index.html`
    injetam (notas.js, agenda-sharing.js, sequencial.js, localizacao.js, header-cleanup.js,
    agenda-notas-rapidas.js, treino.js na parte da agenda). Ao mudar um script, aumenta o `?v=` dele
    no `index.html`;
  - F4 só nas páginas auxiliares e nos CSS/JS próprios delas;
  - ninguém mexe em `sw.js` (o maestro aumenta o CACHE) nem em `.orquestra/` fora da própria saída.
- **Servidor local:** http://127.0.0.1:8765/ serve o diretório do repositório. As capturas ficam
  em `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/`.

## 6. Registro de despacho e revisões
(preenchido pelo maestro a cada rodada)
| Frente | Agente/execução | Início (UTC) | Status |
|---|---|---|---|
| F1 pesquisa | workflow wf_182b1ed9-2a8 (opus) | 2026-10-17 08:27 | despachada |
| F2 auditoria | workflow wf_182b1ed9-2a8 (opus) | 2026-10-17 08:27 | despachada |
| F1 pesquisa | rodada 1 | aprovado | JSON válido; 440×956 e 62/34 conferidos pelo maestro na fonte primária (Use Your Loaf); bug WebKit 301994 conferido no Bugzilla |
| F2 auditoria | rodada 1 | aprovado | harness exporta as 4 funções; emulação conferida pelo maestro com elemento próprio (62/34 e 47/34); 18+12 capturas; defeitos A1–A6, M1–M10, B1–B7 com seletor, medida e linha |
