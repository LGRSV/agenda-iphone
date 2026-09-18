# analise-verificada

Plugin do Claude Code que impede análise com número sem origem.

O problema que ele ataca: um modelo consegue produzir números, contas e
conclusões bem estruturadas e **erradas**, apresentadas com o mesmo tom de
certeza de algo conferido. Este plugin troca "confiar no tom" por "conferir o
lastro" — e deixa o rastro em disco para você cobrar.

## Instalação

**Pessoal, em `~/.claude/`** — vale em todo projeto, sem depender deste repo:

```bash
git clone https://github.com/lgrsv/analise-verificada
./analise-verificada/instalar.sh
```

Copia as 3 skills e os scripts para `~/.claude/skills/` e acrescenta os hooks ao
`~/.claude/settings.json`, preservando o que já estiver lá. Rodar de novo
atualiza sem duplicar. `./instalar.sh --remover` desfaz (os livros-razão dos
seus projetos ficam).

**Como plugin** — se preferir gerenciar pelo `/plugin`:

```bash
/plugin marketplace add lgrsv/analise-verificada
/plugin install analise-verificada@analise-verificada
```

Só precisa de `python3` (stdlib apenas). Sem dependências externas.

## O que ele instala

**Três skills** (o protocolo de comportamento):

| Skill | Ataca | Dispara quando |
| --- | --- | --- |
| `analise-verificada` | número não verificado | qualquer análise com total, média, %, projeção |
| `contra-analise` | viés de concordância | o usuário chega com hipótese ou conclusão pronta |
| `contexto-longo` | janela de contexto | planilha grande, muitos documentos, conversa longa |

**Um livro-razão** (`scripts/verif.py`): número só entra na análise por
`calc` (executado em `Decimal`), `fato` (com fonte citável) ou `premissa`
(rotulada como suposição na entrega).

**Três hooks** (a parte que não depende de boa vontade do modelo):

- `Stop` — confere cada resposta antes de deixar o turno terminar. Número sem
  lastro, recálculo divergente ou contra-análise ausente devolvem exit 2 e a
  resposta não sai. Após 2 bloqueios ele libera com aviso, para nunca travar a
  sessão.
- `SessionStart` e `PostCompact` — reinjetam o livro-razão no contexto. Os
  números verificados moram em disco; sobrevivem à compactação inteiros, em vez
  de virarem lembrança aproximada.

## Uso

```bash
alias verif='python3 "$CLAUDE_PLUGIN_ROOT/scripts/verif.py"'

verif abrir "Fatura de setembro"
verif fato --rotulo salario --valor "7.430,00" --fonte "extrato.html:88"
verif calc "soma(1240.50, 389.90, 77.00)" --rotulo mercado
verif calc "salario - mercado" --rotulo sobra --casas 2

verif auditar rascunho.md          # exit 1 se sobrar número sem lastro
verif contra --afirmacao "..." --teste "..." --resultado "..." --veredito refuta
verif fechar --falseador "o que mudaria esta conclusão"
verif relatorio                    # tabela de procedência em markdown
```

O livro fica em `./.analise/<titulo>.json` — texto puro, legível, versionável.
`ANALISE_DIR` muda o lugar.

### Aritmética

`Decimal` exato (`0.1 + 0.2` dá `0.3`). Operadores `+ - * / **`, parênteses,
e `%` sempre como porcentagem (`resto(a, b)` para o resto da divisão). Funções:
`soma media mediana desvpad minimo maximo arred raiz resto modulo` e apelidos em
inglês. Rótulos já registrados são usáveis nas expressões seguintes.

Separador decimal é ponto. `1.234,56` é aceito; **`1.234` é recusado** por ser
ambíguo (1234 ou 1,234?). Recusar é o comportamento desejado.

Nada de `eval`: a expressão passa por AST com lista fechada de nós permitidos.

### Auditoria

`verif auditar` faz duas coisas independentes:

1. Confere cada número do texto contra o livro, aceitando arredondamento
   (`1234.5678` no livro casa com `1.234,57` no texto).
2. **Recalcula do zero** toda expressão guardada e compara com o valor gravado —
   pega valor adulterado ou erro de transcrição.

Ignora por padrão: blocos de código, código inline, links, URLs, datas ISO e BR,
horas, versões semver, referências `#123`, marcadores de lista e anos
1900–2100. `R$ 2024` **não** é tratado como ano. `--anos` audita anos também,
`--ignorar '<regex>'` acrescenta exceções.

## O que foi verificado em sessão real

Testado com o plugin instalado (`claude plugin install`) e sessões `claude -p`
de verdade, não só em teste unitário:

- **Hook `Stop`: funciona.** Numa sessão real com análise aberta, ele barrou a
  resposta duas vezes, o contador `bloqueios` foi de 0 a 2 no arquivo do livro,
  e o modelo mudou o comportamento — parou de afirmar o número e passou a
  declarar que estava sem verificação. É o mecanismo principal do plugin.
- **Instalação e registro: funcionam.** `claude plugin details` lista as 3
  skills e os 3 hooks, com custo fixo de ~488 tokens por sessão.
- **Hook de contexto: executa e emite corretamente, entrega não confirmada.**
  O `SessionStart` roda e devolve o `additionalContext` com o livro inteiro
  (visível no `hook_response` do stream e no transcript). Mas, em modo headless
  (`claude -p`), dois modelos diferentes perguntados diretamente responderam que
  não havia análise aberta. O mesmo aconteceu com um teste de controle via
  `UserPromptSubmit`, o que sugere limitação do modo headless e não do plugin.
  **Não consegui testar em modo interativo daqui.** Por isso a skill manda rodar
  `verif status` ao retomar, em vez de confiar na reinjeção.
- **Hook `PostCompact`: não testado.** Não consegui provocar uma compactação
  real. O script é o mesmo do `SessionStart`, que comprovadamente executa.

## Limites honestos

- **Não garante imparcialidade.** Obriga a produzir o artefato da tentativa de
  refutação; não impede um teste fraco. O `verif relatorio` existe para você
  ler o que foi testado e cobrar quando for fraco.
- **A auditoria é sintática.** Ela verifica que o número tem origem registrada,
  não que a origem é boa. `fato --fonte "inventei"` passa — por isso a fonte
  precisa ser sempre algo que você consiga abrir e conferir.
- **Falso positivo existe.** Número de contexto (id, código, quantidade) pode
  ser apontado como sem lastro. Use crases, `--ignorar` ou registre como fato.
- **Skill é instrução, não código.** As 3 skills são Markdown que o modelo lê e
  segue — o efeito é alto, mas probabilístico, e não dá para testar como se
  testa uma função. O que é determinístico no plugin é o `verif` (53 testes) e
  o bloqueio do hook `Stop` (verificado em sessão real). O resto é influência.
- **O bloqueio tem teto.** Dois bloqueios por análise e depois libera com aviso.
  Sem teto, um falso positivo prenderia a sessão.

## Testes

```bash
python3 tests/test_verif.py     # 53 testes, stdlib apenas
```

Cobrem aritmética decimal, recusa de código arbitrário, ambiguidade de
separadores, auditoria de rascunho, recálculo, gates de fechamento, e os hooks
(bloqueio, teto de bloqueios, subagente, payload inválido, reinjeção pós-compact).
