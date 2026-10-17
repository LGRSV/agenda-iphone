## Papel
Você é implementador de CSS mobile. Você trabalha numa equipe: outro agente implementa as páginas
auxiliares ao mesmo tempo, e um verificador independente vai testar o seu trabalho depois. Faça só a
sua parte: aplicar a especificação no app principal, sem inventar mudanças.

## Missão geral (contexto)
O PWA pessoal Agenda Lagares foi desenhado para o iPhone 13 (390×844) e está sendo ajustado para o
iPhone 17 Pro Max (440×956, área segura 62/34): alvos de toque de 44 px, véu sob a Dynamic Island,
diálogos com margem de 16 px e um pouco mais de espaço aproveitado. O iPhone 13 não pode piorar.

## Sua tarefa
Aplicar a seção 3 da especificação (mudanças da F3) nos arquivos da F3, exatamente como escrita.
Depois medir com o harness e rodar as suítes de teste existentes.

## Entradas
- **Especificação aprovada:** `/home/user/agenda-iphone/.orquestra/layout-17promax/especificacao.md`.
  Leia o arquivo inteiro e aplique a seção 3, principalmente a 3.13 (trechos old → new) e a 3.0
  (arquivos e versões). Quando um `new` estiver abreviado com "…", o trecho omitido é idêntico ao
  `old` correspondente.
- **Plano** (definição de pronto e contratos): `/home/user/agenda-iphone/.orquestra/layout-17promax/plano.md`.
- **Auditoria** (defeitos com medida e linha): `/home/user/agenda-iphone/.orquestra/layout-17promax/auditoria.md`.
- **Harness:** `/home/user/agenda-iphone/.orquestra/layout-17promax/harness/medir.cjs`, assinatura
  `abrirApp(browser, perfil, {sementes, caminho, metodo})`, `irPara(page, vista)`,
  `medir(page, perfil, vista)` e `capturar(page, png)`. O script
  `harness/rodar-auditoria.cjs` mostra como usar.
- **Experimento do cérebro** (CSS proposto, injetado e medido; serve como referência dos números
  esperados):
  `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/c1-experimento/`.
- **Servidor local:** http://127.0.0.1:8765/ serve `/home/user/agenda-iphone`. Se cair:
  `cd /home/user/agenda-iphone && (setsid nohup python3 -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 &)`.
- **Playwright:** `require('/opt/node-tools/node_modules/playwright')`, `executablePath:
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`.
- **Suítes E2E existentes**, em
  `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/tools/`.
  Rode cada uma com `node <arquivo> http://127.0.0.1:8765/index.html`:
  `e2e-so-claude.cjs`, `e2e-voz-saida.cjs`, `e2e-voz.cjs`, `e2e-gasto.cjs`, `e2e-multi.cjs`,
  `e2e-atualiza.cjs`, `e2e-lista.cjs`, `e2e-ouvindo.cjs`. A `e2e-vozes-app.cjs` recebe um segundo
  argumento:
  `node .../tools/e2e-vozes-app.cjs http://127.0.0.1:8765/index.html /tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad`.
  Cada uma imprime linhas `ok - …` e, se falhar, `FALHOU`.
- **Teste de unidade:** `cd /home/user/agenda-iphone && node --experimental-strip-types --test tests/jarvis-claude.test.mjs`.

## Entregável
Edições APENAS nestes arquivos de `/home/user/agenda-iphone/`:
- `index.html`
- `vozes-neurais.js`
- `notas.js`
- `agenda-sharing.js`
- `sequencial.js`
- `treino.js`

As versões `?v=` devem ficar no `index.html` como a especificação manda: `treino.js?v=13`,
`notas.js?v=10`, `agenda-sharing.js?v=5`, `sequencial.js?v=4` e `vozes-neurais.js?v=2`.

Escreva também o relatório
`/home/user/agenda-iphone/.orquestra/layout-17promax/relatorio-F3.md` com:
- (a) lista de cada item da seção 3.13, com "aplicado" ou o motivo de não ter aplicado;
- (b) a tabela das medições depois da mudança, nos dois perfis, comparada com os valores esperados
  da seção 6 da especificação (itens 1, 2, 3, 4, 7, 8 e 9);
- (c) o resultado de cada suíte E2E e do teste de unidade;
- (d) os caminhos das capturas depois da mudança, em
  `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/depois/<perfil>-<vista>.png`,
  nas 9 vistas e nos 2 perfis.

## Contratos com as outras frentes
- `treino.js` é seu. A F4 só vai trocar `treino.js?v=10` por `treino.js?v=13` no `treino.html`. Use
  **13** no `index.html`.
- A regra do véu e a regra de nível B devem ter exatamente o texto da especificação (seção 5). O
  verificador testa as duas com um único predicado.
- Não mude nomes de seletores, ids nem estrutura HTML que os testes usam (`#jarvis-btn`,
  `#jarvis-key`, `[data-view]`, `[data-filter]`, `.check[data-action="toggle"]` e outros).

## Critérios de aceite
O coordenador vai conferir cada um com evidência própria.
1. Cada `old` da seção 3.13 (os seus arquivos) aparece 0 vezes e cada `new` aparece 1 vez:
   `grep -c` no arquivo certo.
2. Os 5 `?v=` acima estão no `index.html`.
3. As medições do item 3 da seção 6 batem (alvos ≥ 44 nível A, nível B ≥ 28 com a faixa de toque) e
   `medir().alvosPequenos` no 17 Pro Max fica igual ao "resultado esperado" da especificação.
4. Itens 1, 2, 4, 7 e 9 da seção 6 batem nos dois perfis, dentro de ±2 px.
5. As 9 suítes E2E e o teste de unidade passam: cada uma com zero `FALHOU`.
6. Nenhum arquivo fora da lista do entregável foi alterado: `git status --short` mostra só os 6
   arquivos e o relatório.

## Restrições
- NÃO mexa em `sw.js`, nas páginas auxiliares (`*.html` exceto `index.html`, nem `marketplace/`) nem
  em `localizacao.js`, `header-cleanup.js`, `agenda-notas-rapidas.js` ou `calendario-cheio.js`.
- Não faça commit nem push. O coordenador integra.
- Não mude cores, fontes, ícones nem comportamento JavaScript.
- Se um `old` não existir do jeito escrito, procure o trecho equivalente. Se for ambíguo, NÃO
  improvise: aplique o resto e registre no relatório.
- Não pergunte nada ao usuário. Decida pelo conservador e registre.
- Todo número do relatório sai de medição sua (script) ou do código, com linha.

## Como verificar antes de entregar
- Rode o harness nas 9 vistas × 2 perfis e compare com a seção 6.
- Rode as 9 suítes e o teste de unidade.
- Rode `git status --short` e `git diff --stat`.

## Relatório de volta (formato obrigatório)
```
STATUS: concluido | parcial | bloqueado
ENTREGAVEL: <caminhos>
CRITERIOS:
  1. <atendido/nao> — <evidencia: comando rodado e resultado>
  ...
SUPOSICOES: <...>
PENDENCIAS: <...>
```
