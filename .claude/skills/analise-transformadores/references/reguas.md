# Réguas técnicas

## Elo fusível — NDU-002 Tabela 03

**Monofásico** — julgue pela tensão **fase-terra**, não pela tensão da rede:

| kVA | 7,9 kV (rede 13,8) | 19,9 kV (rede 34,5) |
|---|---|---|
| 5 | 0,5H | 0,5H |
| 10 | 1H | 0,5H |
| 15 | 2H | 1H |
| 25 | 3H | 2H |

**Trifásico** — julgue pela tensão de linha:

| kVA | 13,8 kV | 34,5 kV |
|---|---|---|
| 15 | 0,5H | 0,5H |
| 30 | 1H | 0,5H |
| 45 | 2H | 1H |
| 75 | 3H | 1H |
| 112,5 | 5H | 2H |
| 150 | 6K | 3H |
| 225 | 10K | 5H |
| 300 | 12K | 5H |

Ordem crescente de capacidade, para dizer se está acima ou abaixo:
`0,5H · 1H · 2H · 3H · 5H · 3K · 6K · 8K · 10K · 12K · 15K · 25K · 30K · 40K · 50K · 100K`.

Fonte: NDU-002 Tabela 03 (v5.1/2018 e v5.2/2019 idênticas). O site oficial bloqueia
robô; trechos indexados de 2025 conferem com os espelhos.

### A distinção que muda a conclusão

São **dois** elos, e eles respondem a perguntas diferentes:

- **O elo que ESTAVA** — cadastro FIS, campos `Capacidade Elo Fusivel Lado Carga` e
  `Lado Fonte`. Responde "a proteção do ponto estava dimensionada certo antes de
  queimar?"
- **O elo que ENTROU** — SS/OS, campo `QUAL_ELO_INSTALADO_NO_LOCAL`. Responde "a equipe
  deixou o ponto dimensionado certo depois do atendimento?"

Numa leitura de 70 casos de julho/2026, os dois deram respostas opostas: pelo elo que
entrou, 29 superdimensionados e 17 conformes; pelo elo que estava, 2 superdimensionados
e 30 conformes (de 38 com dado). O padrão dominante era **0,5H → 1H** em trafo de 5 kVA
monofásico 19,9 kV: sai conforme, entra superdimensionado. Ou seja, o desvio estava
sendo criado no atendimento, não herdado.

**Sempre reporte os dois, lado a lado, e diga qual pergunta cada um responde.** Reportar
só um é o que produz a conclusão invertida.

### Cuidado com a tensão que chega

O mesmo ponto é descrito ora pela tensão de linha (13,8 / 34,5 — como vem do cadastro
FIS), ora pela fase-terra (7,9 / 7,967 / 19,9 / 19,919 — como costuma aparecer no texto
de campo e na especificação). Trocar uma pela outra joga o caso na coluna errada da
tabela. `scripts/elo_ndu002.py` decide por proximidade a um valor conhecido, não por um
corte em 20 kV, justamente por isso.

### Quando o cadastro não tem elo

No mesmo recorte, 32 de 70 vinham sem elo cadastrado — e eram exatamente os 32 com
`Instalação Chave Fusivel = Não`. Isso é **ausência declarada**, não campo em branco:
o cadastro diz que não há chave fusível no ponto. É um achado de proteção, mas é uma
leitura de cadastro; peça conferência de campo antes de virar conclusão.

### Ambiguidade que o cadastro resolve

Julgar o elo pela obra deixava casos em "depende: conforme se trifásico,
subdimensionado se monofásico". O cadastro FIS traz `Fase Primária` explícita, o que
elimina essa ambiguidade. Prefira a fase do cadastro à inferência pela obra.

## Para-raios

O para-raios é a proteção contra surto. **O elo não é** — o elo tipo H tem suportabilidade
alta a surto justamente para **não** operar com descarga atmosférica. Portanto:

- "elo não atuou na descarga" não é defeito do elo; é o projeto.
- para-raios ausente, danificado ou curto-circuitado antes da queima é evidência de
  causa de proteção, e vale mais que o rótulo da base.

## Aterramento

A SS/OS traz medição **antes** (`MEDIÇÃO_DE_ATERRAMENTO_ANTES_X1..X3`) e **depois**
(`_X1..X3`), mais o campo `FEZ_MELHORIA_DE_ATERRAMENTO`.

O padrão que interessa é **melhoria declarada sem efeito duradouro**: um ponto medido em
64,2 Ω, corrigido para 10,4 Ω, e medido de novo em 27,54 Ω antes do atendimento
seguinte. Procure o histórico do ponto, não só a medição do dia.

## Sazonalidade como teste de plausibilidade

Descarga atmosférica concentra 42–43% das ocorrências da Crítica entre dezembro e
março, e **2,9% em julho**. "Trafo queimado por descarga" statewide: **493 em janeiro,
17 em julho**.

Antes de aceitar surto atmosférico como causa fora da estação, teste contra a taxa base
do mês e, se possível, contra o município e a data. Numa revisão de julho isso derrubou
a atribuição de surto de 14 casos para 9.

## Garantia

Cruze data de fabricação, data de instalação, reformadora e nota fiscal de retorno.
Atenção a datas de fabricação impossíveis — costumam ser digitação (`01/03/2026` para
`03/2007`), não fraude, e a confirmação vem do livro de campo ou do almoxarifado.
