# F5 — Rodada 2 (devolução do coordenador)

O seu briefing original continua valendo: `briefings/F5-verificacao.md`. O revisor final
(`revisao-final.md`, seções R5 e R6 e a tabela de mutação) achou duas lacunas no `testes/layout.cjs`. Há
também uma emenda na especificação. A independência continua: não leia os relatórios F3/F4 nem o git.

## O que mudar no `testes/layout.cjs`
1. **R5:** o S6.1 não vê transbordo recortado. O mutante M7 (`width:470px` em `.list-more`) passou com
   `scrollWidth` 440, porque `html`, `body` e `.view-shell` recortam. Acrescente ao S6.1, nas vistas e
   nos perfis:
   - cada elemento visível com `getBoundingClientRect().right > innerWidth + 0.5` ou `left < -0.5`
     reprova, mesmo recortado;
   - exclua só os elementos de rolagem horizontal intencional (por exemplo `#jarvis-chips`, `overflow-x:auto`)
     e os filhos dele, desde que o contêiner caiba.
   Liste as exclusões no relatório.
2. **R6:** a sonda do nível B a ±6 px aceita zona de 42. Troque por medida da extensão: varredura de
   `elementFromPoint` a cada 0,25 px, ou bisseção, para cima e para baixo a partir das bordas, no centro
   horizontal. Exija zona ≥ 43,5.
   - Rótulos: `.notas-toggle`, `.agenda-share`, `.tr-open`, `.list-previous`, e nas auxiliares
     `.sa-foot button`, `.iv-foot button`, `.editbtn` e `#pluxeeEdit`.
   - Contrato emendado: o nível B usa `top/bottom: -(8px + largura da borda)`. Com borda de 1 px, isso dá
     `-9px`.
   - Zona entre botões: zero pares de zonas sobrepostas no mesmo cartão (Lista, dois perfis).
3. **Emenda na especificação, item S6.8 do marketplace:**
   - o `new` do `.x` passa a ser o trecho longo `.x{float:right;display:grid;place-items:center;width:44px;height:44px;`;
   - no `#cofre label`, exija só `grep -c new == 1`.
4. **Novos critérios de paisagem** no S6.10 (perfil 956×440, insets 20/20/62/62):
   - `#jarvis-panel.open` com `top ≥ 20` e `bottom ≤ 420`;
   - mic, campo e enviar inteiros dentro do painel;
   - `#taskDialog` com `top ≥ 20` e `bottom ≤ 420`.
5. **Versões esperadas agora** (S6.8): `notas.js?v=11`, `agenda-sharing.js?v=6`, `treino.js?v=14` no
   `index.html` e no `treino.html`, `sequencial.js?v=4`, `vozes-neurais.js?v=2`.
6. **Valores de S6.4 e S6.9 que mudaram de propósito:** o rodapé voltou a `gap:6px`, com 16 px só nos
   cartões com `.tr-open`.
   - S6.4 e S6.9 (alturas do topo, células, diálogos, painel em retrato) não mudam.
   - Se algum esperado mudar, use a medida da rodada 2 da sua saída como referência e registre a diferença.

## Critérios desta rodada
1. Rode o `layout.cjs` contra a entrega atual. Ele tem que pegar o mutante M7 e um mutante de zona 42:
   numa CÓPIA servida em outra porta, troque `top:-9px;bottom:-9px` por `-8px` no `notas.js`.
2. Duas execuções seguidas da entrega atual dão o mesmo resultado.
3. O `verificacao.md` ganha a seção "Rodada 2" com a tabela atualizada e as falhas, se houver.

Não edite o app. Não faça commit. Devolva no formato obrigatório.
