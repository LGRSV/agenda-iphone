# F3 — Rodada 3 (última; devolução consolidada do coordenador)

O seu briefing original continua valendo: `briefings/F3-app-principal.md`. Seu relatório:
`relatorio-F3.md`. A revisão final (`revisao-final.md`, achados R1, R2, R3 e o ponto de projeto 2) pede as
correções abaixo. Todas já foram medidas pelo revisor numa cópia. Aplique exatamente, sem mais nada.

## Correções (old → new), em `/home/user/agenda-iphone/`
1. **R2, bloqueante** (paisagem: linha de entrada do Jarvis cortada 22 px; painel com `top` 13,2 < 20).
   Em `index.html`, regra `#jarvis-panel` (linha ~801):
   - old: `bottom:calc(90px + env(safe-area-inset-bottom));max-height:72dvh;`
   - new: `bottom:calc(90px + env(safe-area-inset-bottom));max-height:min(72dvh,calc(100dvh - 90px - env(safe-area-inset-bottom,0px) - env(safe-area-inset-top,0px)));`

   Na regra `#jarvis-msgs` (linha ~811):
   - old: `gap:10px;min-height:120px}`
   - new: `gap:10px;min-height:min(120px,15dvh)}`
2. **R3** (paisagem: `#taskDialog` termina em 424 > 420). Em `index.html`, regra `dialog` (linha 21):
   - old: `max-width:calc(100% - 32px);max-height:calc(100dvh - 32px);`
   - new: `max-width:calc(100% - 32px);max-height:calc(100dvh - 32px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px));`
3. **Ponto de projeto 2** (rodapé do cartão: devolver ~6 px por cartão, mantendo zonas de 44 sem
   sobreposição). Em `index.html` (linha 21):
   - old: `.task-footer{display:flex;flex-wrap:wrap;align-items:center;gap:16px 6px;margin-top:6px}`
   - new: `.task-footer{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px}.task-footer:has(.tr-open){row-gap:16px}`
4. **R1** (pílula de nível B com borda de 1 px tem zona de 42,5 px, não 44: o `::before` absoluto é medido
   da caixa de padding). Troque `top:-8px;bottom:-8px` por `top:-9px;bottom:-9px` SÓ nestas três regras:
   - `notas.js`: `.notas-toggle::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}`;
   - `agenda-sharing.js`: `.agenda-share::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}`;
   - `treino.js`: `.tr-open::before{content:"";position:absolute;left:0;right:0;top:-8px;bottom:-8px}`.

   O `.list-previous::before` (sem borda) continua em `-8px`.

   Versões no `index.html`: `notas.js?v=10` → `?v=11`; `agenda-sharing.js?v=5` → `?v=6`;
   `treino.js?v=13` → `?v=14`. A F4 põe `treino.js?v=14` no `treino.html`.

## Critérios desta rodada (o coordenador confere com medição própria)
1. Cada old acima aparece 0 vezes e cada new 1 vez no arquivo certo. As versões são `?v=11`, `?v=6` e
   `?v=14`.
2. **Paisagem** (perfil `{nome:'paisagem',width:956,height:440,dpr:3,insets:{top:20,bottom:20,left:62,right:62}}`),
   vista `jarvis`:
   - `#jarvis-panel` com `top ≥ 20` e `bottom ≤ 420`;
   - `#jarvis-mic`, `#jarvis-input` e `#jarvis-send` inteiros dentro do painel.
   Vista `nova-tarefa`: `#taskDialog` com `bottom ≤ 420` e `top ≥ 20`.
3. **Retrato nos dois perfis:** `#jarvis-panel` e diálogos com as mesmas medidas da rodada 2. Painel
   416×477,1 no 17PM e 366×506,3 no 13; `#taskDialog` 408/358.
4. **Zona de toque do nível B** (varredura de `elementFromPoint` a cada 0,25 px a partir das bordas, no
   centro horizontal) com 44 ± 0,5 em `.notas-toggle`, `.agenda-share` e `.tr-open`. Na Lista, zero
   pares de zonas sobrepostas entre botões do mesmo cartão, nos dois perfis.
5. As 9 suítes E2E e o teste de unidade com zero `FALHOU`.
6. Só os arquivos `index.html`, `notas.js`, `agenda-sharing.js` e `treino.js` mudaram nesta rodada.

## Restrições
As mesmas do briefing original. Não faça commit. Acrescente "Rodada 3" ao `relatorio-F3.md` e devolva o
relatório no formato obrigatório.
