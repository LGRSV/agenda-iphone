# Lições da orquestra

## layout-17promax (17/10/2026)

- **O cérebro precisa medir antes de especificar, mas não dá para prever efeito colateral em layout de
  quebra de linha.**
  - O `gap:16px 6px` (F3 rodada 2) parecia afetar só os cartões de treino e cresceu quase todos.
  - Critério que pegou: medir a altura de TODOS os cartões antes e depois.
  - Em CSS, peça sempre a contagem de elementos afetados, não só o caso-alvo.
- **"Alvo de 44" com `::before` absoluto ignora a borda** (zona real 42,5).
  - Só a revisão adversarial (C2), com varredura de `elementFromPoint`, achou.
  - A sonda do verificador (±6 px) era tolerante demais.
  - Critério de alvo de toque deve medir a extensão real da zona, não um ponto fixo.
- **Divisão que funcionou:**
  - pesquisa e auditoria em paralelo;
  - especificação por um cérebro;
  - duas frentes de implementação em arquivos disjuntos;
  - verificador independente que não lê relatórios nem diff;
  - revisor final com mutantes em cópia.
  - O verificador e o revisor acharam coisas diferentes: paisagem e grep, depois borda e transbordo
    recortado. Os dois foram necessários.
