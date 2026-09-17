---
name: contexto-longo
description: Protocolo para analisar material grande demais para confiar na memória — planilhas com muitas linhas, extratos longos, vários documentos, logs, arquivos de milhares de linhas, ou análise que atravessa compactação de contexto. Use quando o volume passar do que cabe confortavelmente na janela, ou quando a conversa já for longa. Substitui "li tudo e resumo" por agregação em código com reconciliação.
---

# Contexto longo

**Premissa desta skill:** detalhe lido no meio de 4.000 linhas não fica
disponível depois; vira lembrança aproximada. E lembrança aproximada apresentada
como leitura é o mesmo erro de sempre com outra roupa.

## Regra

Material grande não é lido para depois ser resumido de memória. É **agregado por
código**, e o código escreve o resultado em disco. A resposta cita o arquivo de
resultado, não a lembrança da leitura.

## Procedimento

### 1. Antes de ler, conte

```bash
wc -l extrato.csv
head -3 extrato.csv; tail -3 extrato.csv
```

Quantas linhas, quais colunas, qual período. Registre o total como fato — ele é
a âncora de todas as reconciliações depois:

```bash
verif fato --rotulo linhas_total --valor 4821 --fonte "wc -l extrato.csv" \
  --evidencia "wc -l extrato.csv"
```

### 2. Agregue com script, não com os olhos

Escreva um script que produz os agregados e os grava. Nunca peça ao modelo o
papel do interpretador:

```bash
python3 script_agrega.py extrato.csv > .analise/agregados.json
```

O script precisa emitir, além dos agregados: linhas lidas, linhas descartadas e
o porquê de cada descarte. Descarte silencioso é o vazamento mais comum.

### 3. Reconcilie — sempre

A soma das partes tem que bater com o total contado de forma independente:

```bash
verif calc "soma(cat_mercado, cat_transporte, cat_lazer, cat_outros)" --rotulo soma_categorias
verif calc "soma_categorias - total_geral" --rotulo residuo
```

`residuo` diferente de zero é um achado, não um detalhe de arredondamento.
Ou você explica de onde vem, ou a análise não está pronta. Idem para contagens:
`linhas_lidas + linhas_descartadas` tem que dar `linhas_total`.

### 4. Processe em blocos quando não couber

Blocos de tamanho fixo, resultado parcial de cada bloco gravado em disco,
agregação final por script sobre os parciais. Nunca carregue o bloco seguinte
esperando lembrar do anterior.

```bash
split -l 1000 extrato.csv .analise/bloco_
for b in .analise/bloco_*; do python3 script_agrega.py "$b" > "$b.json"; done
python3 script_junta.py .analise/bloco_*.json > .analise/agregados.json
```

### 5. Atravesse a compactação

Números registrados com `verif` ficam em disco e voltam ao contexto pelos hooks
`SessionStart` e `PostCompact`. Por isso: **registre no momento em que o número
aparece**, não no fim. O que não estiver no livro-razão quando a conversa for
compactada está perdido, e o que você lembrar dele depois é reconstrução.

## O que a resposta precisa dizer

- Quantas linhas/documentos entraram na conta e quantos ficaram de fora, com o
  motivo.
- Se a reconciliação fechou. Se não fechou, o resíduo e a hipótese sobre ele.
- O que **não** foi examinado. Cobertura parcial apresentada como completa é a
  pior saída possível daqui.
