---
name: atualizar-site-auditoria
description: Atualizar o site da auditoria de transformadores da Energisa Tocantins (repositorio_x/auditoria-transformadores-134, publicado em lgrsv.github.io/repositorio_x) — regerar os números, acrescentar uma aba, publicar um mês novo, corrigir um dado e mandar para o ar. Use sempre que o pedido envolver subir, publicar, atualizar, republicar ou corrigir qualquer coisa nesse site, incluindo pedidos curtos como "atualiza o site", "sobe isso", "coloca no site" ou "tá feio, arruma" — porque a publicação tem quatro armadilhas que já quebraram entrega e nenhuma delas é óbvia.
---

# Atualizar o site da auditoria

O site é estático, gerado por Vite e publicado no GitHub Pages por um workflow que **só
dispara em push no `main`**. Todo número da tela sai de um JSON em `public/`, e cada JSON
sai de um gerador em `scripts/`. Não existe banco: o que está no `public/` é o que o
mundo vê.

## As quatro armadilhas

Cada uma já custou uma entrega. Elas não aparecem em `build` nem em `tsc`.

**1 · `/tmp` não sobrevive ao reinício do contêiner.** Quase todo gerador lê uma extração
que mora em `/tmp`. Numa sessão longa o contêiner reinicia, `/tmp` e `node_modules` somem,
e o gerador falha ou — pior — não roda e você publica dado velho achando que atualizou.
Comece sempre por `python3 scripts/atualizar.py --listar`: ele confere a entrada de cada
gerador e diz qual arquivo falta, com o caminho exato.

**2 · O CSS tem vocabulário próprio, e classe inventada não dá erro.** Escrever
`className="cartoes"` ou `className="tabela"` compila, passa no `tsc`, passa no `build` — e
a tela sai sem estilo nenhum, com o número colado no texto. O padrão do projeto é:

| para | use |
|---|---|
| cartão de número | `<section className="kpi-grid">` com `<Kpi rotulo valor nota tom>` — `tom` é `ink`/`green`/`red`/`amber`/`blue` |
| tabela | `<div className="table-scroll"><table className="records-table">` |
| bloco de ressalva | `<section className="panel warning-note wide">` |
| bloco de contexto | `<section className="panel editorial-note wide">` |
| duas colunas | `<div className="compare-grid">` |
| nota de rodapé | `<p className="fonte-detalhe">` |

Antes de usar uma classe, confirme que ela existe: `grep -n "^\.nome" app/globals.css`.

**3 · O bundle usa base `/repositorio_x/`.** Servir o `pages-dist` na raiz dá 404 nos
assets, a página abre em branco, e você conclui que quebrou tudo quando só serviu errado.
`scripts/verificar_site.mjs` já serve no caminho certo.

**4 · O cabeçalho tem um contador global das 1.510.** Aba que lê outro arquivo precisa de
um caso próprio no `header-meta` de `app/page.tsx`, senão mostra "Recorte 1.510" numa tela
que fala de outro universo — um número descrevendo outra lista.

## A invariante que não se negocia

**O indicador fechado é congelado.** As 1.510 de janeiro a junho e o indicador 1.305
(1.225 queimados + 80 avariados) são **entrada, nunca saída**. Nenhum gerador reescreve
`fluxo-1510.json`. Quando um período novo precisa somar, ele soma **por cima**, em arquivo
próprio — foi assim que nasceu o `fluxo-1582.json` (1.510 + 72 de julho). Editar o
arquivo congelado quebraria `scripts/auditoria_invariantes.py`, que trava se o total
deixar de ser 1.510, e é justamente essa trava que dá confiança ao número.

Mês aberto continua aberto: se a decisão veio da régua e não do dono, a tela diz isso.

## A esteira de aprovação

Três estágios, nesta ordem, ditada pelo dono:

1. **usuário** abre o pedido de expurgo
2. **Mateus Gracia** · engenharia analisa
3. **Matheus Alves** · libera o expurgo — é a última assinatura

`vezDe()` trabalha com o NÚMERO do estágio, não com o nome: trocar quem ocupa cada número
reordena a fila inteira. `REJEITADO` devolve ao estágio 1, e o caso não morre — refaz.
Observação registra e **não** move a fila.

## O caminho, do começo ao fim

```bash
cd auditoria-transformadores-134
pnpm install                          # o contêiner pode ter reiniciado
python3 scripts/atualizar.py --listar # o que dá para gerar, e o que falta subir
python3 scripts/atualizar.py          # gera + roda os verificadores de invariante
pnpm build:pages                      # o mesmo build que o workflow roda
node scripts/verificar_site.mjs       # abre num navegador de verdade, aba por aba
```

Só depois disso: commit, push na branch de trabalho, PR, e **merge no `main`** — é o merge
que dispara a publicação. Confirme o deploy pelo workflow `auditoria-pages.yml`; o build
leva ~1 s e o deploy ~10 s.

**Não dá para abrir `lgrsv.github.io` de dentro do ambiente de agente** — o proxy devolve
403. Por isso a verificação é feita contra o mesmo bundle que o workflow publica, servido
em localhost. Nunca dê uma entrega por boa só porque `build` e `tsc` passaram: os dois
passaram na vez em que a tela foi publicada quebrada.

## Acrescentar uma aba

São sete pontos em `app/page.tsx`, e esquecer um deles quebra a compilação de um jeito
que não aponta para a causa:

1. o union `type Modulo`
2. o tipo do dado que a aba lê
3. `useState` para guardar
4. a entrada no mapa de carregamento sob demanda (`pedirApoio`)
5. `APOIO_DA_ABA` — de que arquivo a aba precisa
6. `RECORTES` — pode ser `[]`, mas **tem que existir**: o mapa é `Record<Modulo, …>` e a
   falta dá erro de tipo longe do lugar
7. `TITULOS`, o item no `NAV`, e o bloco de render

E, se a aba lê outro universo, o caso no `header-meta` da armadilha 4.

## Ver a tela sem a senha

A porta de apresentação guarda quem entrou em `localStorage["auditoria-134-demo-user"]`, e
o próprio código diz, em comentário, que ela **não é segurança** — o site é estático e a
regra viaja no bundle. Para QA do build local, semear essa chave com um id válido é
legítimo: é o seu próprio build. `verificar_site.mjs` já faz isso.

## Referências

- `dados.md` — que arquivo alimenta qual tela, e o que cada gerador precisa.
