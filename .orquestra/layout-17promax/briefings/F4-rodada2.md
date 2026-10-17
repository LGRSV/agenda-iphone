# F4 — Rodada 2 (devolução do coordenador)

Contexto: o seu briefing original continua valendo
(`/home/user/agenda-iphone/.orquestra/layout-17promax/briefings/F4-paginas-auxiliares.md`). O seu
relatório da rodada 1 está em `/home/user/agenda-iphone/.orquestra/layout-17promax/relatorio-F4.md`.
O coordenador conferiu os critérios 1 a 6. Sobra um defeito visual que você mesmo apontou e que
precisa de correção.

## Defeito
`equipamentos-especiais.html`, regra `.chip` (linha 149). Com `min-height:44px;padding:0 14px`, o
texto dos 13 chips (`<div>`) fica 13,5 px acima do centro da pílula, nos dois perfis.

## O que mudar (decisão do coordenador; é a correção que você testou)
No `equipamentos-especiais.html`, troque:
- old: `min-height:44px;padding:0 14px;font-weight:600;font-size:12.5px;`
- new: `min-height:44px;padding:0 14px;align-content:center;font-weight:600;font-size:12.5px;`

Isso vale só para essa regra `.chip`. Confira com `grep -c` que o old aparece 1 vez antes de trocar.
Se aparecer mais de 1 vez, troque só dentro da regra `.chip{…}` e registre.

## Critérios desta rodada
1. O texto dos 13 chips fica centralizado verticalmente: o desvio entre o centro do texto (Range ou
   filho) e o centro da pílula é de no máximo 1 px, nos dois perfis.
2. Os chips continuam com altura 44, a mesma largura e o mesmo texto.
3. Os itens 6 e 7 da seção 6 continuam batendo no `equipamentos-especiais.html`.
4. Nenhum outro arquivo foi alterado.

## Relatório
Acrescente ao `relatorio-F4.md` uma seção "Rodada 2" com a evidência e a captura nova. Devolva o
relatório de volta no formato obrigatório. Não faça commit.
