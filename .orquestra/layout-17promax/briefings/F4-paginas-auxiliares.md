## Papel
Você é implementador de CSS mobile. Você trabalha numa equipe: outro agente implementa o app
principal ao mesmo tempo, e um verificador independente vai testar o seu trabalho depois. Faça só a
sua parte: aplicar a especificação nas páginas auxiliares, sem inventar mudanças.

## Missão geral (contexto)
O PWA pessoal Agenda Lagares foi desenhado para o iPhone 13 (390×844) e está sendo ajustado para o
iPhone 17 Pro Max (440×956, área segura 62/34). As páginas auxiliares (financeiro, carteira e as
outras) recebem alvos de toque de 44 px e o véu sob a Dynamic Island. O iPhone 13 não pode piorar.

## Sua tarefa
Aplicar a seção 4 da especificação (mudanças da F4), exatamente como escrita, e conferir com o
harness página por página.

## Entradas
- **Especificação aprovada:** `/home/user/agenda-iphone/.orquestra/layout-17promax/especificacao.md`.
  Leia o arquivo inteiro e aplique a seção 4. A seção 5 (contratos) e o item 6 da seção 6 são os
  critérios das páginas. Quando um `new` estiver abreviado com "…", o trecho omitido é idêntico ao
  `old`.
- **Plano:** `/home/user/agenda-iphone/.orquestra/layout-17promax/plano.md`.
- **Auditoria:** `/home/user/agenda-iphone/.orquestra/layout-17promax/auditoria.md`. A seção e traz as
  páginas, como chegar em cada uma e as medidas de antes.
- **Harness:** `/home/user/agenda-iphone/.orquestra/layout-17promax/harness/medir.cjs`.
  `abrirApp(browser, perfil, {sementes, caminho, metodo})` abre qualquer página pelo `caminho`, com a
  área segura emulada. Veja o exemplo das auxiliares em `harness/rodar-auditoria.cjs` e
  `harness/extras-auditoria.cjs`.
- **Experimento do cérebro:**
  `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/c1-experimento/medir-aux.cjs`
  e `aux.json` (como medir as auxiliares e os números esperados).
- **Servidor local:** http://127.0.0.1:8765/ serve `/home/user/agenda-iphone`. Se cair:
  `cd /home/user/agenda-iphone && (setsid nohup python3 -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 &)`.
- **Playwright:** `require('/opt/node-tools/node_modules/playwright')`, `executablePath:
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`.

## Entregável
Edições APENAS nas páginas auxiliares que a seção 4 da especificação lista, em
`/home/user/agenda-iphone/`:
- `financeiro.html`, `carteira.html`, `extrato-saldo.html`, `importar.html`;
- `gamificacao.html`, `financeiro-compartilhado.html`, `investimentos.html`;
- `fatura-inter.html`, `refaturamento.html`, `marketplace/index.html`;
- `equipamentos-especiais.html`, `treino.html`;
- e nos CSS/JS que só essas páginas carregam, se a especificação mandar.

Em `treino.html` a única mudança é `treino.js?v=10` → `treino.js?v=13`, além do que a seção 4.8
mandar para o próprio `treino.html`.

Escreva também o relatório
`/home/user/agenda-iphone/.orquestra/layout-17promax/relatorio-F4.md` com:
- (a) cada item da seção 4 com "aplicado" ou o motivo;
- (b) uma tabela por página no perfil 17 Pro Max (e no iPhone 13 para conferir que não piorou):
  `scrollWidth`, `cabecalho.conteudoTop`, alvos medidos contra o esperado do item 6 da seção 6 e o
  predicado do véu do item 7;
- (c) os caminhos das capturas, em
  `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/depois/aux-<pagina>.png`.

## Contratos com as outras frentes
- NÃO edite `treino.js`: ele é da F3, que usa `?v=13`. Você só troca a versão no `treino.html`.
- A regra do véu (`body::before{content:"";position:fixed;top:0;left:0;right:0;height:env(safe-area-inset-top,0px);z-index:60;background:…}`)
  e a regra de nível B (`position:relative;min-height:28px` + `::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}`)
  devem ter o texto idêntico ao da especificação. Só a cor do véu muda por página.
- Não mude ids nem estrutura HTML.

## Critérios de aceite
O coordenador vai conferir cada um com evidência própria.
1. Cada `old` da seção 4 aparece 0 vezes e cada `new` aparece 1 vez no arquivo certo: `grep -c`.
2. `treino.html` contém `treino.js?v=13` e não contém mais `treino.js?v=10`.
3. Item 6 da seção 6, nas 12 páginas no perfil 17 Pro Max: `scrollWidth == 440`, cabeçalho com
   `conteudoTop ≥ 62`, nenhum interativo sob a ilha e os alvos listados no tamanho esperado.
   `financeiro-compartilhado.html` só se der para abrir; se não der, registre e aplique só o véu.
4. Item 7 da seção 6: o predicado do véu bate em cada página com véu.
5. No iPhone 13, cada página continua sem rolagem lateral e com o cabeçalho fora dos 47 px.
6. Nenhum arquivo fora da lista foi alterado: `git status --short`, desconsiderando os arquivos da
   F3, que trabalha em paralelo (index.html, vozes-neurais.js, notas.js, agenda-sharing.js,
   sequencial.js, treino.js).

## Restrições
- NÃO mexa em `index.html`, `sw.js`, `treino.js`, `vozes-neurais.js`, `notas.js`,
  `agenda-sharing.js` ou `sequencial.js`.
- Não faça commit nem push.
- Não mude cores (exceto a do véu, como especificado), fontes, ícones nem comportamento JavaScript.
- Se um `old` não existir do jeito escrito, procure o equivalente. Se for ambíguo, não improvise:
  registre.
- Não pergunte nada ao usuário. Decida pelo conservador e registre.

## Como verificar antes de entregar
- Meça as 12 páginas nos dois perfis com o harness.
- Rode `git status --short` e `git diff --stat` nos seus arquivos.

## Relatório de volta (formato obrigatório)
```
STATUS: concluido | parcial | bloqueado
ENTREGAVEL: <caminhos>
CRITERIOS:
  1. <atendido/nao> — <evidencia>
  ...
SUPOSICOES: <...>
PENDENCIAS: <...>
```
