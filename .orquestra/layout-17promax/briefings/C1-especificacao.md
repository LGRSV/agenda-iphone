## Papel
Você é o cérebro da equipe: arquiteto de layout mobile. Você não escreve o código final. Você decide
o que muda, com que valores e em que ordem, e escreve uma especificação que dois implementadores
executem sem conversar entre si. A especificação também diz como um verificador independente vai
conferir o resultado.

## Missão geral (contexto)
O PWA pessoal Agenda Lagares (instalado na tela de início, `viewport-fit=cover`, status bar
`black-translucent`) foi desenhado para o iPhone 13 (390×844). O dono agora usa um iPhone 17 Pro
Max. O layout deve respeitar a área segura (Dynamic Island, indicador de início) e aproveitar a
largura maior, sem piorar o iPhone 13.

## Sua tarefa
Ler a pesquisa e a auditoria já aprovadas e escrever a especificação de mudanças de layout, dividida
em duas frentes que mexem em arquivos diferentes:
- **F3:** `index.html` e `vozes-neurais.js`;
- **F4:** as páginas auxiliares.
Para cada mudança diga o seletor, o valor atual e o valor novo. Escreva também os limites numéricos
que o verificador vai conferir.

## Entradas
- `/home/user/agenda-iphone/.orquestra/layout-17promax/plano.md`: missão, definição de pronto e
  contratos.
- `/home/user/agenda-iphone/.orquestra/layout-17promax/pesquisa.md`: números do aparelho. O bloco
  JSON da seção 4 é a fonte dos perfis.
- `/home/user/agenda-iphone/.orquestra/layout-17promax/auditoria.md`: defeitos medidos, linhas do
  CSS e lista das páginas auxiliares.
- Capturas do estado atual em
  `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/antes/`.
  Abra-as com Read: são imagens.
- O código em `/home/user/agenda-iphone/` (somente leitura para você).
- O harness `/home/user/agenda-iphone/.orquestra/layout-17promax/harness/medir.cjs`. Rode-o para
  testar uma hipótese, se precisar.
- Referência opcional do repositório: `/home/user/agenda-iphone/.claude/skills/apple-design/SKILL.md`.
  Use as seções de tipografia, contenção e feedback de toque. O resto (gestos, molas) não entra no
  escopo.

## Entregável
`/home/user/agenda-iphone/.orquestra/layout-17promax/especificacao.md` com as seções:
1. **Perfis finais.** Valores de 17 Pro Max e iPhone 13 confirmados pela pesquisa. Se diferirem dos
   provisórios do plano, diga quais medições da auditoria precisam ser refeitas e se isso muda
   alguma conclusão.
2. **Princípios do layout.** No máximo 8 linhas. Exemplos: como tratar safe-area, largura máxima
   útil, escala de tipografia e espaçamento entre 390 e 440, se usa `clamp()` ou media query, e o
   que acontece em paisagem (só "não quebrar").
3. **Mudanças da F3** (`index.html`, `vozes-neurais.js`). Uma tabela por área:
   - áreas: cabeçalho e topo, abas e filtros, calendário (Mês), Dia, Lista, Sequência, botões
     flutuantes (+ e Jarvis), painel do Jarvis, seletor de voz, diálogos (nova tarefa, reagendar,
     alertas), toast, selo de versão;
   - colunas: seletor, valor atual (com a linha), valor novo, defeito da auditoria que resolve,
     risco no iPhone 13.
   - o CSS do index.html é minificado: indique o trecho exato a substituir (old → new) quando
     possível.
4. **Mudanças da F4** (páginas auxiliares): o mesmo formato, por página.
5. **Contratos entre F3 e F4.** Por exemplo, variáveis CSS com nomes comuns, se houver. Pode ser
   "nenhum", desde que justificado.
6. **Critérios numéricos para o verificador.** Lista fechada de verificações automatizáveis com
   limites. Inclua no mínimo os itens 1 a 4 e 6 da definição de pronto do plano, já com os valores
   finais (insets, 44 px, larguras esperadas).
7. **Fora do escopo e riscos.** O que você decidiu NÃO mudar e por quê.

## Contratos com as outras frentes
- Divisão de arquivos atualizada no plano (seção "Contratos"):
  - a F3 é dona de `index.html`, de `vozes-neurais.js` e do CSS injetado pelos scripts que o
    `index.html` carrega;
  - a F4 é dona das páginas auxiliares e dos CSS/JS que só elas carregam;
  - ninguém mexe em `sw.js`.
  Atribua cada arquivo a exatamente uma frente. Se um arquivo for usado pelos dois lados (por exemplo,
  `treino.js` na agenda e em `treino.html`), dê o arquivo à F3 e diga à F4 que não toque nele.
- O critério 2 do plano foi ajustado: o indicador de início só vale para elementos fixos. Use a
  versão atual.
- O achado M10 (conteúdo rolando sob a ilha e o relógio com a status bar `black-translucent`) precisa
  de decisão sua: resolver (com seletor e valor) ou justificar.
- As vistas e os perfis usam os nomes do plano e do harness. A assinatura real do harness é
  `abrirApp(browser, perfil, {sementes, caminho, metodo})`.

## Critérios de aceite
1. O arquivo tem as 7 seções.
2. Cada defeito "alto" e "médio" da auditoria está resolvido por uma linha da tabela ou justificado
   em "Fora do escopo".
3. Cada linha das tabelas F3 e F4 tem seletor, valor atual com linha e valor novo concreto: nada de
   "ajustar" ou "melhorar".
4. Os critérios da seção 6 são todos mensuráveis pelo harness ou por um script, com limite numérico.
5. Nenhuma mudança é atribuída à frente errada (arquivo fora da divisão).

## Restrições
- Não edite código do app. Escreva só a especificação.
- Não pergunte nada ao usuário. Decida pelo conservador e registre a decisão.
- Não proponha mudar cores, fontes, ícones nem funcionalidades.
- Números vêm da pesquisa, da auditoria ou de medição sua com o harness, sempre citados.

## Como verificar antes de entregar
- Releia a lista de defeitos da auditoria e marque cada um como resolvido (linha X) ou fora do
  escopo.
- Confira se cada seletor citado existe: `grep` no arquivo.

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
