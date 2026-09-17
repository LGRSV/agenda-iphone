---
name: analise-verificada
description: Protocolo obrigatório para qualquer análise que produza número — planilhas, extratos, faturas, médias, totais, percentuais, projeções, comparações, "quanto deu", "quanto sobra", "vale a pena". Use ANTES de escrever o primeiro número na resposta. Nenhum número sai sem ter sido calculado por código ou lido de uma fonte citável; estimativa só passa se for rotulada como estimativa.
---

# Análise verificada

**Premissa desta skill:** um número que você "sabe" mas não executou é um palpite
com aparência de resultado. O livro-razão (`verif`) existe para tornar isso
impossível de esconder — de você inclusive.

O executável é `scripts/verif.py` (na raiz do plugin). Use o caminho absoluto ou
crie um atalho no início da sessão:

```bash
alias verif='python3 "$CLAUDE_PLUGIN_ROOT/scripts/verif.py"'
```

## As quatro regras

1. **Conta de cabeça não existe.** Toda aritmética passa por `verif calc`. Sem
   exceção para contas "óbvias" — `1.234,56 × 3` é exatamente onde o erro entra.
2. **Todo número tem origem.** `calculo` (executado), `fato` (fonte citável) ou
   `premissa` (suposição, rotulada como tal na resposta).
3. **Auditar antes de entregar.** `verif auditar` sobre o rascunho. Se sobrar
   número sem lastro, o rascunho não está pronto.
4. **Tentar derrubar antes de concordar.** Sem contra-análise registrada, a
   análise não fecha. Veja a skill `contra-analise`.

## Procedimento

### 1. Abrir

```bash
verif abrir "Fatura Inter - setembro"
```

Cria `.analise/fatura-inter-setembro.json` na pasta de trabalho. A partir daí o
hook `Stop` confere cada resposta sua antes de deixar você encerrar.

### 2. Registrar os insumos, um a um

```bash
# veio de uma fonte que dá para conferir depois
verif fato --rotulo salario --valor "7.430,00" \
  --fonte "extrato-saldo.html:linha 88" \
  --evidencia "grep -n 'salario' extrato-saldo.html"

# veio de uma conta — a conta fica guardada e é refeita na auditoria
verif calc "soma(1240.50, 389.90, 77.00)" --rotulo mercado_set \
  --fonte "3 lançamentos tag=financeiro em setembro"

# rótulos já registrados podem ser usados na expressão seguinte
verif calc "salario - mercado_set" --rotulo sobra --casas 2

# suposição declarada — vai rotulada como PREMISSA na resposta
verif premissa --rotulo inflacao_mes --valor "0,4%" \
  --justificativa "IPCA de agosto; setembro ainda não publicado"
```

Sintaxe de `calc`: `+ - * / **`, parênteses, `%` sempre significa porcentagem
(`10%` vira `(10/100)`; para resto use `resto(a, b)`). Funções: `soma media
mediana desvpad minimo maximo arred raiz resto modulo` (e os equivalentes em
inglês). Decimal exato — `0.1 + 0.2` dá `0.3`, não `0.30000000000000004`.
Separador decimal é ponto; `1.234,56` é aceito, `1.234` é recusado por ser
ambíguo. Esse é o comportamento desejado: prefira o erro à adivinhação.

### 3. Escrever o rascunho e auditar

```bash
verif auditar rascunho.md          # arquivo
verif auditar -                    # stdin
verif auditar "Sobraram R$ 5.722,60 em setembro."   # texto direto
```

A auditoria faz duas coisas:
- confere cada número do texto contra o livro (aceitando arredondamento);
- **recalcula do zero** toda expressão guardada e compara com o valor gravado.

Saída ≠ 0 significa rascunho reprovado. Resolva assim:
- número real que faltou registrar → registre e audite de novo;
- número que era palpite → ou vire `calc`/`fato`, ou saia da resposta;
- ruído (id, versão, código) → `--ignorar '<regex>'` ou ponha entre crases.

### 4. Contestar

Obrigatório antes de fechar. Veja `contra-analise`. Mínimo:

```bash
verif contra --afirmacao "Sobrou dinheiro em setembro" \
  --teste "somei também as saídas programadas e as parcelas em aberto" \
  --resultado "sobra cai de 5.722,60 para 1.110,60" \
  --veredito inconclusivo
```

### 5. Fechar e entregar

```bash
verif fechar --falseador "Se as 3 parcelas do cartão forem antecipadas, a sobra vira déficit"
verif relatorio --saida procedencia.md
```

`fechar` recusa se faltar auditoria limpa, contra-análise ou falseador.
`--forcar` fecha mesmo assim, mas grava as pendências no arquivo — e você
precisa dizer na resposta o que ficou pendente.

## Como a resposta deve sair

Cada número carrega sua origem. Três marcas, sem meio-termo:

- **VERIFICADO** — lido de fonte citável (diga qual).
- **CALCULADO** — saiu de `verif calc` (diga de quais insumos).
- **PREMISSA** — suposição sua (diga qual e por quê).

Nunca use o mesmo tom para os três. Se um número não tem marca, ele não entra.
Cole a tabela do `verif relatorio` quando a análise tiver mais de ~5 números.

Termine com a frase do `--falseador`: **o que mudaria esta conclusão**. Uma
análise que não diz o que a derrubaria não foi testada, só narrada.

## Quando o hook barrar

O hook `Stop` devolve a lista de números sem lastro. Não contorne registrando
o número como `fato` com fonte inventada — isso destrói a única coisa que este
plugin oferece. Registre a origem real, ou tire o número, ou rotule como
premissa. Depois de 2 bloqueios ele libera com aviso, para não travar a sessão:
se chegou nesse ponto, diga na resposta que entregou sem verificação completa.
