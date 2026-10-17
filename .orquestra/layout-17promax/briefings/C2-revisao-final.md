## Papel
Você é o revisor final adversarial. Você não participou da implementação nem da verificação. O seu
trabalho é tentar **derrubar** a entrega: achar o critério de pronto que não está atendido, a
inconsistência entre partes, o caso que ninguém testou e a lacuna no teste automatizado.

## Missão geral (contexto)
O PWA pessoal Agenda Lagares, desenhado para o iPhone 13 (390×844), foi ajustado para o iPhone 17
Pro Max (440×956, área segura retrato 62/34; paisagem 20/20/62/62):
- alvos de toque de 44 px;
- véu sob a Dynamic Island;
- diálogos com margem de 16 px;
- páginas auxiliares ajustadas.
O dono vai usar o app instalado na tela de início, com iOS 26 ou 27.

## Sua tarefa
Revisar a entrega integrada contra a definição de pronto e tentar quebrá-la com as técnicas abaixo.
Para cada achado, diga se é defeito real, com evidência reproduzível.

## Entradas
- **Definição de pronto** (seção 2) e contratos: `/home/user/agenda-iphone/.orquestra/layout-17promax/plano.md`.
- **Especificação** (a seção 6 tem os critérios numéricos):
  `/home/user/agenda-iphone/.orquestra/layout-17promax/especificacao.md`.
- **Pesquisa** (números do aparelho, bug WebKit 301994 da faixa de 62 px com `env(top)=0`):
  `/home/user/agenda-iphone/.orquestra/layout-17promax/pesquisa.md`.
- **Entrega integrada:** o repositório `/home/user/agenda-iphone`. O diff contra a base é
  `git diff 3081ea4 -- . ':!.orquestra'` (3081ea4 é o commit antes da implementação).
- **Teste do verificador:** `/home/user/agenda-iphone/.orquestra/layout-17promax/testes/layout.cjs`,
  e o veredito dele em `verificacao.md`.
- **Harness:** `/home/user/agenda-iphone/.orquestra/layout-17promax/harness/medir.cjs`.
- **Capturas:** `antes/`, `depois/` e `verificacao/` em
  `/tmp/claude-0/-home-user-agenda-iphone/3207d749-cbff-51f4-a8a2-534b7b3c7cb3/scratchpad/layout/`.
  Abra-as com Read: são imagens.
- **Servidor local:** http://127.0.0.1:8765/ serve o repositório. Para servir uma CÓPIA, use outra
  porta (por exemplo 8799) apontando para uma pasta sua no scratchpad.
- **Playwright:** `require('/opt/node-tools/node_modules/playwright')`, `executablePath:
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`.

## Técnicas obrigatórias
1. **Validação cruzada:** reimplemente, sem olhar o código do `layout.cjs`, as três medições centrais:
   - (a) interativos sob a ilha / fixos sob o indicador;
   - (b) alvos < 44;
   - (c) rolagem lateral.
   Rode-as nos dois perfis e em pelo menos 3 tamanhos intermediários e extremos: 375×812, 430×932 e
   320×568. Compare com o que o `layout.cjs` diz. Divergência = achado.
2. **Teste de mutação:**
   - copie o repositório para uma pasta no scratchpad (`cp -r`, sem `.git`) e sirva-a em outra porta;
   - crie pelo menos 8 mutantes plausíveis, um por vez, por exemplo:
     - voltar `.view-tab` para 37 px;
     - tirar o véu `body::before`;
     - tirar o `max-width` dos diálogos;
     - voltar `#jarvis-mic` para 40;
     - quebrar a regra de nível B de `.notas-toggle`;
     - deixar `#app-update` a 6 px do indicador;
     - pôr `width:470px` num elemento da Lista;
     - remover o `?v=13` do treino.
   - para cada mutante, rode o `layout.cjs` contra a cópia (o script aceita a URL base como
     argumento) e anote se ele pegou;
   - mutante que sobrevive é lacuna de teste.
3. **Estados do aparelho que ninguém testou:**
   - bug 301994: inset top 0 com `innerHeight` 894 (956 − 62);
   - tema claro: `document.documentElement.dataset.theme='light'`;
   - fonte maior do sistema: zoom de texto, por exemplo `html{font-size:120%}` ou `-webkit-text-size-adjust`;
   - teclado aberto no diálogo de nova tarefa (`innerHeight` menor);
   - paisagem;
   - cartões com textos muito longos.
   Procure sobreposição, corte ou alvo pequeno.
4. **Coerência entre partes:**
   - o véu tem a mesma cor do fundo em cada página e em cada tema;
   - o `z-index` do véu não cobre o menu, o painel do Jarvis nem os diálogos;
   - as versões `?v=` batem entre `index.html`, `treino.html` e os arquivos;
   - nada de JS mudou além de strings de CSS.
5. **Regressões no iPhone 13:** compare as capturas de antes e depois e as medidas de topo
   (orçamento vertical). Diga se algo ficou pior de forma perceptível.

## Pontos de projeto que o coordenador pede que você julgue
Para cada um: aceitar como está, ou propor a correção concreta (old → new) com a medida antes e
depois.
1. **Botões flutuantes sobre o calendário** (auditoria B1, que a C1 deixou fora do escopo):
   - no Mês, o "+ Nova tarefa" e o `#cardioFab` cobrem dias do calendário, inclusive o dia de hoje;
   - na mudança, o grupo subiu 16 px;
   - veja `scratchpad/layout/depois/iphone17promax-mes.png`.
2. **Rodapé do cartão com `gap:16px 6px`** (rodada 2 da F3):
   - o rodapé quebra em quase todos os cartões (51/60 no 17PM, 60/60 no 13);
   - por isso quase todos ficaram +10 px (alguns +20 px no 13);
   - existe alternativa que mantenha os 44 px de toque com menos altura?
3. **Orçamento vertical:** o topo cresceu 22 px nos dois aparelhos (abas, filtros e modo sequencial
   em 44). Vale no iPhone 13?

## Entregável
`/home/user/agenda-iphone/.orquestra/layout-17promax/revisao-final.md` com:
- (a) o veredito: **aprovado** ou **reprovado**, com a lista de defeitos que impedem;
- (b) os achados, cada um com: id (R1, R2…), gravidade (bloqueante, importante, menor), como
  reproduzir (comando ou passos), medida, arquivo e linha, e a correção sugerida (old → new, se for
  CSS);
- (c) a tabela da mutação: mutante, como foi feito, se o `layout.cjs` pegou (sim ou não);
- (d) a validação cruzada: tamanhos, medidas suas contra as do `layout.cjs`;
- (e) a **lista do que você testou**: "não achei nada" sem essa lista não vale.

## Critérios de aceite
1. As 5 seções existem.
2. Pelo menos 8 mutantes testados, cada um com o resultado.
3. Validação cruzada em pelo menos 5 tamanhos de tela (os 2 perfis e mais 3).
4. Cada achado tem passos de reprodução e medida.
5. Os estados do item 3 das técnicas foram todos tentados, cada um com o resultado.

## Restrições
- NÃO edite o repositório: nem o app, nem `.orquestra/` fora do seu `revisao-final.md`. Mutantes só
  numa cópia no scratchpad.
- Não pergunte nada ao usuário.
- Toda afirmação de defeito vem com medição sua.

## Como verificar antes de entregar
- Releia cada achado e confira se dá para reproduzir só com o que você escreveu.

## Relatório de volta (formato obrigatório)
```
STATUS: concluido | parcial | bloqueado
ENTREGAVEL: <caminho>
VEREDITO: aprovado | reprovado
ACHADOS: <ids com gravidade>
MUTANTES: <n testados / n pegos>
CRITERIOS:
  1. <atendido/nao> — <evidencia>
  ...
```
