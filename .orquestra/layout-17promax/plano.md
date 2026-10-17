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
| C1 especificação | rodada 1 (claude-fable-5-1, conferido no transcript) | aprovado | 7 seções; A1–A6/M1–M10 rastreados em 3.1; 72 trechos old conferidos pelo maestro, cada um 1× no arquivo certo; seção 6 com 10 critérios numéricos; divisão de arquivos coerente (treino.js na F3) |
| F3 app principal | workflow (opus) | despachada | — |
| F4 páginas auxiliares | workflow (opus) | despachada | — |
| F3 app principal | rodada 1 | refazer (1 item) | maestro conferiu: 69/69 trechos aplicados; medição própria nos 2 perfis (sw 440/390, 0 sob ilha, 0 fixos sob indicador, alvos 44, véu 62/47 com cor do fundo, rolado → body, 0 erros JS); 18 arquivos alterados, todos previstos. Falha: nível B do `.tr-open` (rodapé quebrado com vão de 6 px) → rodada 2 com `.task-footer` gap 16px 6px (emenda à spec) |
| F4 páginas auxiliares | rodada 1 | refazer (1 item) | maestro conferiu: trechos aplicados, versão `treino.js?v=13`; defeito visual do `.chip` em equipamentos (texto 13,5 px fora do centro) → rodada 2 com `align-content:center` |
| F3 app principal | rodada 2 | aprovado | maestro: `.task-footer` gap 16px 6px aplicado (old 0 / new 1). Efeito colateral medido pela F3: o rodapé quebra em quase todos os cartões (51/60 no 17PM, 60/60 no 13), então quase todos ficam +10 px. Vai para a C2 decidir |
| F4 páginas auxiliares | rodada 2 | aprovado | maestro: 13 chips do equipamentos com desvio 0,0 px e h 44 nos dois perfis; sw 440/390 |
| F5 verificação | workflow (opus) | despachada | — |
| F5 verificação | rodada 1 | aprovado (entrega do verificador) | 384 linhas, todos os ids S6.1–S6.10 e P1–P6 com medida; maestro reproduziu a regressão de paisagem do Jarvis (painel até 330, linha de entrada 308–352). Falhas vão para a C2 e depois para a rodada 3 consolidada |
| C2 revisão final | workflow (fable) | despachada | — |
| C2 revisão final | rodada 1 (claude-fable-5-1) | reprovado → rodada 3 consolidada | R2 bloqueante (paisagem Jarvis), R1 (zona 42,5 — maestro confirmou: 42,5 medido), R3, R4, R5/R6 (lacunas do teste), R7 (sw.js, maestro); 16/16 mutantes pegos; validação cruzada 5 tamanhos sem divergência. Decisões do maestro: aplicar R1, R2, R3, R4, P2, R5, R6, R7; aceitar B1, P3 (opcional, não aplicado), R8, R9 como fora do escopo |
| F3 | rodada 3 | despachada | — |
| F4 | rodada 3 | despachada | — |
| F5 | rodada 2 | aguarda F3/F4 r3 | — |
| F3 | rodada 3 | aprovado | maestro: 16/16 trechos novos 1×; paisagem painel 20..330 e linha de entrada 261..305 dentro; zona nível B 44,5 pelo mesmo método que dava 42,5; retrato inalterado nos 2 perfis (painel 416×477 / 366×506), 0 erros |
| F4 | rodada 3 | aprovado | maestro: trechos 1×; treino.js?v=14 no treino.html; arquivos alterados = os 4 previstos |
| F5 | rodada 2 | aprovado (entrega do verificador) | teste pega M7 (transbordo recortado) e zona 42 (mutantes em cópias); 430/431; única falha pré-existente: `.filters` do financeiro com 518 px (Extrato inalcançável) → nova frente F6 (F4 já usou 3 rodadas) |
| F6 financeiro filtros | workflow (opus) | despachada | flex-wrap:wrap medido pela F5 |
