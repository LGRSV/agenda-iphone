## Papel
Você é implementador de CSS mobile. Outra frente vai verificar o seu trabalho depois. Faça só esta
correção.

## Missão geral (contexto)
O PWA pessoal Agenda Lagares está sendo ajustado para o iPhone 17 Pro Max (440×956, área segura
62/34) sem piorar o iPhone 13 (390×844). O verificador (F5) achou um defeito que já existia antes da
missão na página `financeiro.html`.

## Sua tarefa
Fazer a linha de filtros do `financeiro.html` caber na tela, para que todos os filtros fiquem
visíveis e tocáveis.

## Entradas
- **Defeito, medido pelo F5** (`/home/user/agenda-iphone/.orquestra/layout-17promax/verificacao.md`,
  seção "Rodada 2", item `S6.6.financeiro.bruto`):
  - a linha `.filters` (6 botões, h 44) mede 518 px num espaço de 408 px (358 no iPhone 13);
  - "Reemb./Refat." aparece cortado (344..457) e "Extrato" (464..534) fica fora da tela, sem como
    alcançar;
  - quem esconde o excesso é o `finance-mobile-guard.js:10-14` (`body, .app { overflow-x: clip }`),
    por isso o `scrollWidth` continua 440.
- **Regra atual**, uma vez só em `/home/user/agenda-iphone/financeiro.html`, linha 2:
  `.filters{display:flex;gap:7px;margin:12px 0}`.
- **Harness:** `/home/user/agenda-iphone/.orquestra/layout-17promax/harness/medir.cjs`. Abra a página
  com `abrirApp(browser, perfil, {caminho:'financeiro.html'})`. Veja o exemplo em
  `harness/rodar-auditoria.cjs`.
- **Servidor:** http://127.0.0.1:8765/. Playwright em `require('/opt/node-tools/node_modules/playwright')`,
  com `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`.

## Entregável
No `/home/user/agenda-iphone/financeiro.html`, troque exatamente:
- old: `.filters{display:flex;gap:7px;margin:12px 0}`
- new: `.filters{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}`

Escreva também `/home/user/agenda-iphone/.orquestra/layout-17promax/relatorio-F6.md` com a medição de
antes e depois nos dois perfis.

## Contratos com as outras frentes
- Não mude ids, textos nem outra regra.
- O teste do verificador (`testes/layout.cjs`) espera que nenhum botão de `.filters` passe da borda
  da tela, mesmo recortado.

## Critérios de aceite (o coordenador confere com medição própria)
1. O old aparece 0 vezes e o new 1 vez no `financeiro.html`.
2. Nos dois perfis, os 6 botões de `.filters` têm `getBoundingClientRect().right ≤ innerWidth` e
   `left ≥ 0`.
3. Cada botão continua com `h ≥ 44` e o mesmo texto.
4. O `scrollWidth` continua 440 e 390, e o cabeçalho fica fora da ilha (`conteudoTop ≥ 62`).
5. Só o `financeiro.html` e o relatório mudaram.

## Restrições
- Não mexa em outro arquivo, não faça commit e não pergunte nada ao usuário.

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
