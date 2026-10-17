# Integração: seletor "Tela de início"

## O que mudou

Só o `index.html` mudou (+31 / −1). Não mexi em `sw.js`, nos `.js` (nenhum `?v=` precisou subir) nem nos 4 CSS de variante.

| Onde | O quê |
|---|---|
| `index.html:14` | `<script>` inline de uma linha, antes do primeiro `<style>`. Lê `localStorage['agenda_tela_inicio']` dentro de `try/catch`. Se o valor for `essencial`, `hoje`, `ios` ou `zen`, faz `document.documentElement.dataset.home = id`. Qualquer outro valor é ignorado. |
| `index.html:15-18` | Um `<link rel="stylesheet" href="./estilos-inicio/<id>.css?v=1">` para cada id, logo depois do script. |
| `index.html:91-104` | `<style id="telaInicioStyles">` com as classes novas `.home-option*`, que só existem no diálogo. Nenhuma regra existente mudou. |
| `index.html:118` (dentro de `#quickMenu`) | Botão `#telaInicioBtn` "Tela de início", logo depois de "Modo claro", na seção Ajustes. Usa o mesmo markup dos outros itens (`<span class="menu-option-icon"><svg viewBox="0 0 24 24">…`), com um ícone de traço de layout. O menu já fecha sozinho quando um botão dele é tocado. |
| `index.html:137` | `<dialog id="telaInicioDialog">` com `<section class="modal">` (o mesmo padrão do `#alertsDialog`). Tem o título, uma frase de ajuda e um `role="radiogroup"` com 5 `button.home-option[role=radio][data-home-id]`. Cada opção mostra o nome e o conceito numa linha só: Atual, Conteúdo primeiro, Hoje no centro, Lista agrupada à moda do iOS e Zen tipográfico. A escolha atual fica com `aria-checked="true"`, borda de acento e um check. Embaixo vem o botão "Fechar" (`.secondary`). |
| `index.html:138-146` | Uma IIFE inline. Abrir o diálogo marca a opção atual. Tocar numa opção aplica na hora (`dataset.home = id`, ou `removeAttribute('data-home')` para "atual"), grava no localStorage (`setItem`, ou `removeItem` para "atual"), remarca e fecha. "Fechar" só fecha. |

O valor fica só neste aparelho. `agenda_tela_inicio` não entra na lista de chaves sincronizadas de `supabase-shared-storage.js`.

## Testes e resultados

| Teste | Resultado |
|---|---|
| `.orquestra/inicio-minimalista/testes/e2e-tela-inicio.cjs` (novo) | **16 ok, 0 FALHOU** (rc 0) |
| O mesmo teste contra 3 mutantes (sem o script do head; sem gravar no localStorage; "Atual" sem remover o atributo) | os 3 mutantes foram pegos: 4, 8 e 1 FALHOU, todos com rc 1 |
| `scratchpad/tools/e2e-so-claude.cjs …/index.html` | 10 ok, 0 FALHOU (rc 0) |
| `scratchpad/tools/e2e-lista.cjs …/index.html` | 7 ok, 0 FALHOU (rc 0) |
| `.orquestra/layout-17promax/testes/layout.cjs` (padrão) | 425 ok, 7 FALHOU. As 7 falhas são todas em `marketplace/index.html` e já existiam antes desta mudança (ver abaixo). Todo o resto passa, inclusive as 9 suítes e2e que ele roda. |

O e2e novo usa o harness `medir.cjs`, no perfil 17 Pro Max com a área segura emulada. Ele confere:

- sem escolha não há `data-home` nem valor gravado;
- o script vem antes do primeiro `<style>` e as 4 folhas carregaram;
- o item do menu tem o mesmo estilo computado do "Modo claro", mede 244×45 e o ícone tem stroke de 1,8;
- o diálogo tem 5 opções com nome e conceito, só "Atual" marcada, tudo ≥ 44 px e dentro da tela, nos temas escuro e claro;
- "Fechar" não muda nada;
- para cada variante escolhida pelo menu:
  - aplica o atributo, grava e muda o visual, sem rolagem lateral;
  - depois de recarregar, o atributo continua;
  - o `data-home` já está no `<html>` quando o `<body>` nasce, então não há "pisca";
  - o visual é idêntico ao de antes da recarga;
  - a opção aparece marcada;
- "Atual" remove o atributo e a gravação, e o visual volta ao padrão, também depois de recarregar;
- um valor desconhecido é ignorado;
- não houve nenhum `pageerror`.

### O padrão não mudou, e cada variante ficou igual à que os designers testaram

Medi os estilos computados (26 propriedades, mais `::before`/`::after`) e as caixas de **todos** os elementos do `<body>`. Foram 4 vistas (mes, dia, lista, menu), 2 perfis (17 Pro Max e 13) e 2 temas.

- **Padrão, antes × depois:** 0 diferenças fora do `#quickMenu`. Dentro dele, a única mudança é o item novo. O menu passa de 469 para 514 px, e os 3 itens injetados depois (Equipamentos, Atualizar, Compartilhadas) descem 45 px. O menu termina em y = 650 de 956 (17 Pro Max) e em y = 635 de 844 (13).
- **Método dos designers × integração, por variante.** O método dos designers é `addStyleTag` + `dataset` no fim da página. A integração é escolher, gravar e recarregar. Deu **0 diferenças fora do menu** em `essencial`, `hoje`, `ios` e `zen`. Ou seja, pôr os `<link>` antes dos `<style>` do app não mudou a cascata em nenhum caso medido.

Ferramentas: `scratchpad/integracao/snapshot.cjs` e `diff.cjs`. O diff ignora só a animação do `#jarvis-btn` e do `#toast`: duas fotos do padrão sem mudança nenhuma já davam 23 diferenças só nesses dois.

### Medidas do diálogo

| | 17 Pro Max | 13 |
|---|---|---|
| Caixa do diálogo | 408×518 em y 219 | 358×537 em y 154 |
| Cada opção | 364×58 | 314×58 |
| Botão "Fechar" | 44 px de altura | 44 px de altura |

Não há rolagem interna em nenhum dos dois. Os conceitos cabem numa linha nos dois aparelhos: a 1ª versão do texto de "Atual" quebrava no 13 e foi encurtada para "A tela de sempre, com os cartões.".

Capturas em `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/integracao/capturas/`. São `<perfil>-menu-<tema>.png`, `<perfil>-dialogo-<tema>.png` e `<perfil>-dialogo-zen-marcado-<tema>.png`.

## Achados para quem for publicar

1. **Já estava quebrado, sem relação com esta mudança: o Marketplace perdeu os ajustes do #128.** Os commits automáticos `3c9ec5c`, `7b34953` e `a4d6587` reescreveram `marketplace/index.html` e tiraram os ajustes. O trecho `body::before{content:"";position:fixed` aparece 1 vez em `7406006` e 0 vezes em `HEAD`. É daí que vêm as 7 falhas do `layout.cjs` (S6.6, S6.7 e S6.8 do marketplace). O gerador do Marketplace precisa reaplicar esses ajustes, senão cada coleta vai desfazê-los de novo.
2. **`sw.js`:** a tarefa proibia mexer nele, então ele continua em `agenda-lagares-v247-iphone17promax`. O `CLAUDE.md` pede para subir esse número em toda mudança do app, e é essa linha que confirma no ar que a versão nova foi publicada. Isso fica para o passo de publicação.
3. **Comportamento com o service worker.** O SW não reescreve o `index.html` (`isAuxPage` dá verdadeiro porque a página contém `financeiro.html`). As 4 folhas novas entram no cache cache-first na primeira abertura online. Até lá, sem rede, o `<link>` só falha e a tela atual aparece normalmente.
4. **Instabilidade do harness ao recarregar.** O SDK do Supabase às vezes apaga o token falso, e aí a recarga cai na tela de login. Isso aconteceu em 2 de 4 rodadas das minhas fotos. O e2e novo regrava o token num `addInitScript` a cada navegação. As suítes antigas não recarregam, então não são afetadas.

## Não testado

- Safari/iOS real e o PWA instalado. Tudo aqui foi no Chromium 141 com a área segura emulada.
- Com o service worker ativo, porque o harness bloqueia o SW.
- O `layout.cjs` com as variantes ligadas. Ele roda só no padrão, e o designer do `zen` já avisou que lá ele acusa 3 falhas intencionais de presença de botão.
- Nada foi commitado nem publicado.
