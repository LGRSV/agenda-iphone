# F4 — Rodada 3 (última; devolução consolidada do coordenador)

O seu briefing original continua valendo: `briefings/F4-paginas-auxiliares.md`. Seu relatório:
`relatorio-F4.md`. A revisão final (`revisao-final.md`, achados R1 e R4) pede as correções abaixo.
Aplique exatamente, sem mais nada.

## Correções (old → new), em `/home/user/agenda-iphone/`
1. **R1** (pílula de nível B com borda de 1 px tem zona de 42,5, não 44). Troque `top:-8px;bottom:-8px` por
   `top:-9px;bottom:-9px` SÓ nestas regras:
   - `financeiro.html`: `.sa-foot button::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}`.
     O `.iv-foot button::before`, sem borda, fica em `-8px`.
   - `investimentos.html`: `.editbtn::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}`.
2. **R4** (alvos < 44 que ficaram fora da lista):
   - `equipamentos-especiais.html`:
     - old: `.toolbar button{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);color:#fff;padding:9px 12px;`
     - new: `.toolbar button{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);color:#fff;min-height:44px;padding:9px 12px;`
   - `equipamentos-especiais.html`:
     - old: `.catbar button{flex:1;min-width:132px;border:none;border-radius:10px;padding:11px 8px;`
     - new: `.catbar button{flex:1;min-width:132px;min-height:44px;border:none;border-radius:10px;padding:11px 8px;`
   - `financeiro.html`: no fim do `<style>` da linha 2, acrescente
     `#pluxeeEdit{position:relative;min-height:28px}#pluxeeEdit::before{content:"";position:absolute;left:0;right:0;top:-9px;bottom:-9px}`.
     O `#pluxeeEdit` é criado por `finance-pluxee.js:86`. Confira que ele tem borda de 1 px. Se não tiver,
     use `-8px` e registre.
3. **Versão:** em `treino.html`, troque `treino.js?v=13` por `treino.js?v=14` (a F3 sobe o `treino.js` para v14).

## Critérios desta rodada (o coordenador confere com medição própria)
1. Cada old aparece 0 vezes e cada new 1 vez. O `treino.html` tem `treino.js?v=14`.
2. A zona de toque (varredura de `elementFromPoint` a 0,25 px) de `.sa-foot button`, `.editbtn` e
   `#pluxeeEdit` é de 44 ± 0,5.
3. `equipamentos-especiais`: `.toolbar button`, `button.prim`, `.catbar button`, `.cb-analise` e `.cb-ncon`
   com `h ≥ 44`. `scrollWidth` 440/390. Os chips continuam centralizados, com desvio ≤ 1 px.
4. Itens 6 e 7 da seção 6 continuam batendo nas 12 páginas, nos dois perfis.
5. Só mudam `financeiro.html`, `investimentos.html`, `equipamentos-especiais.html` e `treino.html`.

## Restrições
As mesmas do briefing original. Não faça commit. Acrescente "Rodada 3" ao `relatorio-F4.md` e devolva no
formato obrigatório.
