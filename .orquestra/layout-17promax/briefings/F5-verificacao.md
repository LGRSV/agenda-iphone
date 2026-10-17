## Papel
Você é testador independente de layout mobile. Você NÃO participou da implementação e não deve se
basear no que os implementadores dizem ter feito. O seu trabalho é medir o app como ele está e dizer,
critério por critério, se passa ou falha, com números.

## Missão geral (contexto)
O PWA pessoal Agenda Lagares, desenhado para o iPhone 13 (390×844), foi ajustado para o iPhone 17
Pro Max (440×956, área segura 62/34):
- alvos de toque de 44 px;
- véu sob a Dynamic Island;
- diálogos com margem de 16 px;
- páginas auxiliares com os mesmos ajustes.
O iPhone 13 não pode ter piorado.

## Sua tarefa
1. Escrever um teste automatizado que implemente, de forma independente, os critérios numéricos da
   seção 6 da especificação (itens 1 a 10) e os critérios 1 a 6 da definição de pronto do plano.
2. Rodá-lo nos dois perfis.
3. Rodar também as suítes E2E existentes e o teste de unidade.
4. Escrever o veredito.

## Entradas
- **Definição de pronto** (seção 2): `/home/user/agenda-iphone/.orquestra/layout-17promax/plano.md`.
- **Especificação:** `/home/user/agenda-iphone/.orquestra/layout-17promax/especificacao.md`.
  - Use a **seção 6**, a lista fechada de critérios numéricos com valores esperados: ela é o seu
    oráculo.
  - As seções 3 e 4 dizem o que deveria ter mudado. Leia para entender, mas teste o comportamento
    medido, não o texto do CSS (exceto o item 8, que é de texto).
- **Harness:** `/home/user/agenda-iphone/.orquestra/layout-17promax/harness/medir.cjs`.
  - Use-o para abrir o app e as páginas com a área segura emulada: `perfis`,
    `abrirApp(browser, perfil, {sementes, caminho, metodo})`, `irPara(page, vista)` e `capturar`.
  - As **checagens** devem ser suas, com `page.evaluate` próprio: não reaproveite o `medir()` como
    prova única. Pode chamá-lo, mas confira os números por conta própria.
- **Como chegar em cada página auxiliar:** seção e de
  `/home/user/agenda-iphone/.orquestra/layout-17promax/auditoria.md`.
- **Servidor local:** http://127.0.0.1:8765/ serve `/home/user/agenda-iphone`. Se cair:
  `cd /home/user/agenda-iphone && (setsid nohup python3 -m http.server 8765 --bind 127.0.0.1 >/dev/null 2>&1 &)`.
- **Playwright:** `require('/opt/node-tools/node_modules/playwright')`, `executablePath:
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`.
- **Suítes E2E existentes**, em
  `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/tools/`.
  Rode cada uma com `node <arquivo> http://127.0.0.1:8765/index.html`:
  `e2e-so-claude.cjs`, `e2e-voz-saida.cjs`, `e2e-voz.cjs`, `e2e-gasto.cjs`, `e2e-multi.cjs`,
  `e2e-atualiza.cjs`, `e2e-lista.cjs`, `e2e-ouvindo.cjs`. A `e2e-vozes-app.cjs` recebe também, como
  segundo argumento, a pasta
  `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad`.
  Cada uma imprime `ok - …` e, se falhar, `FALHOU`.
- **Teste de unidade:** `cd /home/user/agenda-iphone && node --experimental-strip-types --test tests/jarvis-claude.test.mjs`.

## Entregável
1. **`/home/user/agenda-iphone/.orquestra/layout-17promax/testes/layout.cjs`**, um script Node:
   - uso: `node layout.cjs [http://127.0.0.1:8765/]`;
   - para cada verificação, imprime uma linha `ok - <id> <descrição> (<medida>)` ou
     `FALHOU - <id> <descrição> (<medida obtida> vs <esperado>)`;
   - termina com o código 0 se tudo passar e 1 se algo falhar;
   - ids: `S6.1` … `S6.10` (seção 6 da especificação) e `P1` … `P6` (definição de pronto), com
     sub-ids quando houver várias medições;
   - tem que ser determinístico: rodar 2 vezes seguidas dá o mesmo resultado.
2. **`/home/user/agenda-iphone/.orquestra/layout-17promax/verificacao.md`** com:
   - (a) a tabela de cada id com resultado e medida, nos dois perfis;
   - (b) o resultado das 9 suítes E2E e do teste de unidade;
   - (c) a lista de falhas, cada uma com: id, perfil, vista ou página, seletor, medida obtida,
     esperado, e o arquivo e a linha do CSS provável (por leitura do código);
   - (d) o que você NÃO conseguiu testar e por quê;
   - (e) as capturas finais em
     `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/verificacao/<perfil>-<vista>.png`.

## Contratos com as outras frentes
- Ids dos critérios: `S6.n` e `P n`. O coordenador e o revisor final vão usá-los para citar falhas.
- Nomes de vistas e perfis iguais aos do harness. O perfil de paisagem do item 10 é o objeto literal
  da especificação.

## Critérios de aceite
1. `node /home/user/agenda-iphone/.orquestra/layout-17promax/testes/layout.cjs` roda até o fim e
   imprime pelo menos uma linha para cada id de `S6.1` a `S6.10` e de `P1` a `P6`.
2. Duas execuções seguidas dão o mesmo conjunto de ok e FALHOU.
3. O `verificacao.md` tem as seções a–e. Cada falha traz medida obtida e esperado.
4. As 9 suítes e o teste de unidade foram rodados, com a saída resumida (contagem de ok e FALHOU)
   no relatório.
5. Não está no relatório nenhum "passou" sem medida.

## Restrições
- NÃO leia `relatorio-F3.md`, `relatorio-F4.md` nem `git diff`/`git log` das mudanças de layout. O
  seu juízo tem que vir da medição.
- NÃO edite nenhum arquivo do app. Só escreva em `.orquestra/layout-17promax/testes/`, em
  `.orquestra/layout-17promax/verificacao.md` e na pasta de capturas.
- Não "conserte" o teste para passar. Se o esperado da especificação parecer errado, registre isso
  como observação, sem mudar o limite.
- Não faça commit nem push. Não pergunte nada ao usuário.

## Como verificar antes de entregar
- Rode o `layout.cjs` duas vezes e compare as saídas com `diff`.
- Rode as 9 suítes e o teste de unidade.

## Relatório de volta (formato obrigatório)
```
STATUS: concluido | parcial | bloqueado
ENTREGAVEL: <caminhos>
CRITERIOS:
  1. <atendido/nao> — <evidencia>
  ...
VEREDITO: <quantos ids passaram / falharam; lista dos que falharam>
SUPOSICOES: <...>
PENDENCIAS: <...>
```
