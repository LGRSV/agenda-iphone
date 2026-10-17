# F3 — Rodada 2 (devolução do coordenador)

Contexto: o seu briefing original continua valendo
(`/home/user/agenda-iphone/.orquestra/layout-17promax/briefings/F3-app-principal.md`). O seu
relatório da rodada 1 está em `/home/user/agenda-iphone/.orquestra/layout-17promax/relatorio-F3.md`.
O coordenador conferiu com medição própria que os critérios 1, 2, 4, 5 e 6 passaram. Falta um.

## Critério que falhou
Critério 3 (nível B). O `.tr-open` falha o teste de baixo (`elementFromPoint(cx, rect.bottom + 6)`)
em 9 de 17 ocorrências, nos dois perfis.

Evidência (sua própria medição):
- nos cartões de treino, o `.task-footer` quebra em duas linhas;
- o `.agenda-share` fica 6 px abaixo do `.tr-open`;
- a faixa invisível do `.agenda-share` (top:-8px) cobre o vão inteiro;
- com isso, a área efetiva do `.tr-open` fica com cerca de 36 px.

## O que mudar (decisão do coordenador; é uma emenda à especificação)
No `index.html`, troque exatamente:
- old: `.task-footer{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px}`
- new: `.task-footer{display:flex;flex-wrap:wrap;align-items:center;gap:16px 6px;margin-top:6px}`

Isso dá 16 px entre as linhas, 8 px para a faixa de cada botão, e mantém 6 px entre colunas. Não mude
mais nada.

## Critérios desta rodada
1. `grep -c` do old dá 0 e do new dá 1 no `index.html`.
2. Nível B do `.tr-open`: em cima e embaixo, em 17/17 ocorrências nos dois perfis. Os outros nível B
   (`.notas-toggle`, `.agenda-share`, `.list-previous`) continuam passando dos dois lados.
3. Os itens 1, 2, 4 e 9 da seção 6 continuam batendo. A altura dos cartões só muda nos rodapés que
   quebram linha.
4. As 9 suítes E2E e o teste de unidade continuam com zero `FALHOU` (comandos no briefing original).
5. Nenhum outro arquivo foi alterado.

## Relatório
Acrescente ao `relatorio-F3.md` uma seção "Rodada 2" com a evidência. Devolva o relatório de volta no
formato obrigatório do briefing original. Não faça commit.
