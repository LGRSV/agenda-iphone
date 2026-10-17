# Entrega

## O que toda entrega declara

Independente do formato, três coisas aparecem sempre, porque sem elas o número não é
auditável:

1. **Cobertura** — quantos casos, qual janela de data, qual base e de que extração.
2. **O que ficou de fora** e por quê.
3. **As ressalvas** que limitam a leitura — janela de histórico desigual, campo
   preenchido mal, cadastro que pode estar defasado, fonte que não foi conferida.

E a invariante: **o indicador fechado não foi tocado**. Diga isso explicitamente quando
a análise chegar perto dele.

## Excel

O dono lê no iPhone. Isso define o formato mais do que qualquer preferência estética:

- Primeira aba **Resumo**, em duas colunas (`item` / `valor`), com o número principal
  em cima e as ressalvas embaixo. É a aba que vai ser lida; as outras são para conferir.
- Uma aba por corte, não uma planilha larga. Congele a primeira linha e ligue o filtro.
- Uma aba **"Como foi lido"** ou **"Qualidade do dado"** com método e ressalva, item a
  item. É o que sustenta a conclusão quando alguém contesta.
- Cores só para veredito (conforme / acima / abaixo / sem dado), não para decorar.
- Texto longo em célula com quebra ligada e alinhamento no topo.

## Artifact

- Sem host externo: a CSP bloqueia tudo menos Google Fonts. Embuta CSS, JS e imagem
  como `data:` URI.
- `target="_blank"` não funciona no sandbox. Ofereça o link para copiar, e um botão de
  cópia, em vez de contar com a abertura em aba nova.
- Tabela larga e diagrama vão dentro de um container com `overflow-x: auto` — o corpo
  da página nunca rola na horizontal.
- Tema: defina a paleta clara em `:root` puro e redefina só os tokens em
  `@media (prefers-color-scheme: dark)` com guarda `:root:not([data-theme="light"])`,
  e de novo em `:root[data-theme="dark"]`. `body` precisa de fundo explícito.
- Um dossiê caso a caso fica grande (10 MB para 100 casos com mapa e satélite). Isso é
  aceitável; o que não é aceitável é o usuário não conseguir chegar no caso que quer —
  invista em filtro e busca antes de investir em enfeite.

## Corrigir em público

Quando um número publicado estiver errado, corrija de frente: diga o número certo, o
errado, e o que causou. Nesta auditoria isso já aconteceu com "2.169 obras" (eram
2.142 — contei linhas de SS em vez de obras), com "nenhuma OS registra o elo queimando"
(a `OBSERVACAO` da Crítica registra, em 10 de 100) e com a leitura invertida de série
retirada/instalada. A correção rápida custa menos que a defesa do número errado.

## Pendências

Mantenha um `PENDENCIAS.md` com o que ficou aberto e por quê. Um fio que some é um fio
que vai ser reaberto do zero daqui a três semanas.
