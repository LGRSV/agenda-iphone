# Relatório F6: linha de filtros do financeiro.html

## Mudança
Uma regra em `financeiro.html` (linha 2):

- antes: `.filters{display:flex;gap:7px;margin:12px 0}`
- depois: `.filters{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}`

Contagem no arquivo: old 0×, new 1×. `git diff` contra `1fdeb7a`: só `financeiro.html`, 1 linha.

## Como foi medido
Playwright (chromium-1194), `harness/medir.cjs` → `abrirApp(browser, perfil, {caminho:'financeiro.html'})`.
Área segura pelo CDP, conferida: 17 Pro Max 62/34 e iPhone 13 47/34. As medidas vêm de
`getBoundingClientRect()` de cada `.filters button`. `conteudoTop` vem de `medir()`.

## Antes
| perfil | innerWidth | scrollWidth | .filters (largura × altura, scrollWidth) | botões dentro da tela |
|---|---|---|---|---|
| iPhone 17 Pro Max | 440 | 440 | 408 × 44, scrollWidth 518 | 4 de 6 |
| iPhone 13 | 390 | 390 | 358 × 44, scrollWidth 518 | 4 de 6 |

Botões, na mesma linha nos dois perfis (left..right, w×h):
Todos 16..79 (63×44) · Entradas 86..167 (81×44) · Saídas 174..241 (67×44) · Atrasados 248..337.2 (89.2×44) ·
**Reemb./Refat. 344.2..457.1 (112.9×44)** · **Extrato 464.1..534 (69.9×44)**.
No 17 Pro Max, Reemb./Refat. passa da borda (440) e Extrato fica fora da tela. No iPhone 13 (borda 390), Reemb./Refat. é cortado
e Extrato fica inteiro fora. O `overflow-x: clip` do `finance-mobile-guard.js` mantinha o scrollWidth em 440/390.

## Depois
| perfil | innerWidth | scrollWidth | .filters (largura × altura, scrollWidth) | botões dentro da tela | conteudoTop |
|---|---|---|---|---|---|
| iPhone 17 Pro Max | 440 | 440 | 408 × 95, scrollWidth 408 | 6 de 6 | 80 (sobIlha false) |
| iPhone 13 | 390 | 390 | 358 × 95, scrollWidth 358 | 6 de 6 | 65 (sobIlha false) |

Botões nos dois perfis:
- linha 1: Todos 16..79 · Entradas 86..167 · Saídas 174..241 · Atrasados 248..337.2
- linha 2 (+51 px: 44 de altura + 7 de gap): Reemb./Refat. 16..128.9 · Extrato 135.9..205.8

Todos com h 44, os mesmos textos e na mesma ordem. O menor left é 16 e o maior right é 337.2, abaixo de 390 e de 440.

## Testes adicionais
- **Toque:** com cada botão rolado até o centro, `elementFromPoint` no centro devolve o próprio botão.
  Deu 6/6 nos dois perfis.
- **Teste do verificador** (`testes/layout.cjs`): rodado com `LAYOUT_JSON` e `LAYOUT_CAPTURAS` no scratchpad, para não
  sobrescrever os arquivos do repositório. Resultado: **431 ok, 0 FALHOU**, código de saída 0. Antes eram 430/431.
  `S6.6.financeiro.bruto` passou ("fora 0") e `S6.6.financeiro..filtersbutton` deu h ≥ 44.

## Não testado
Não testei em aparelho real nem em Safari/WebKit. Toda a medição foi no Chromium emulado. Também não medi
`financeiro.html` com dados reais: a página abriu com o stub do harness.
