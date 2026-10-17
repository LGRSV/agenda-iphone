# As bases e suas armadilhas

Cada seção começa pelo que quebra, porque é isso que custa tempo. O formato vem depois.

## SS/OS (`BASE_SS_OS_*.txt`)

**A armadilha:** a descrição da SS e da OS contêm quebra de linha no meio do campo.
Quem lê linha a linha perde por volta de **60% dos registros** — e não dá erro. A
análise conclui "a SS não existe" para a maioria dos casos e segue adiante.

**A segunda armadilha:** a codificação muda entre extrações. A de 10/08/2026 veio em
UTF-8 e a de 11/08/2026 veio em latin-1, com o mesmo nome de arquivo. Detecte, não
assuma.

Formato: separador `@`, **64 colunas**, sem aspas. Para ler: acumule linhas até que o
buffer tenha 63 separadores, então divida. Se o resultado tiver mais de 64 campos, o
texto continha `@` (e-mail) — junte o excesso de volta no último campo. Confira o total
lido contra `total_de_@ // 63` e **levante erro** se ficar abaixo de 95%.

Colunas que importam:

| coluna | observação |
|---|---|
| `NUMERO_SS`, `NUMERO_OS`, `NUM_OBRA` | chaves; uma obra pode ter várias SS |
| `NUM_TRAFO` | o código operativo do ativo |
| `ALIMENTADOR` | bate com o cadastro FIS em 100% dos casos testados — bom validador |
| `COORD_X`, `COORD_Y` | **UTM 22S SIRGAS2000, EPSG:31982** — não são graus |
| `ORIGEM_SS`, `DEFEITO_SS` | o rótulo; o universo da auditoria é `QUEIMADO` + `AVARIADO` |
| `DESCRIPTION_SS`, `DESCRICAO_OS` | texto real de campo; é onde a verdade costuma estar |
| `QUAL_ELO_INSTALADO_NO_LOCAL` | **o elo que ENTROU**, não o que estava. Ver `reguas.md` |
| `NS_RETIRADO` / `NS_INSTALADO`, `TOMBAMENTO_*`, `FABRICANTE_*`, `POTENCIA_RET` / `_INST` | identidade do equipamento; o almoxarifado é mais confiável que estes |
| `MEDIÇÃO_DE_ATERRAMENTO_ANTES_X1..X3` e `_X1..X3` | antes e depois da melhoria |
| `PARA_RAIOS_INSTALADO_SUBSTITUIDO`, `EQUIPAMENTO_APRESENTA_VAZAMENTO_DE_OLEO`, `PROVÁVEL_MOTIVO_DO_DEFEITO` | formulário de campo |
| `QTD_CLIENTES` | preenchido mal com frequência; `0` não significa auxiliar |

Cuidado com nomes repetidos: `REFORMADORA_DESAT` aparece duas vezes. Ao montar o índice
de coluna por nome, guarde a **primeira** ocorrência e saiba que existe a segunda.

## Crítica (`Critica*.txt`)

**A armadilha:** o arquivo de 12/2025 tem **65 colunas num layout diferente** dos
demais. Ler por índice numérico produz colunas trocadas em silêncio. **Mapeie sempre
por nome de cabeçalho.**

**A segunda armadilha:** `DTA_INIC_ELE` e `DTA_FIM_ELE` vêm **vazias** em algumas
extrações. Quem usa elas conclui "sem ocorrência" para todo mundo. As datas boas são
`DTA_ABERT` e `DTA_FECH`. Valide que não estão vazias antes de seguir.

**A terceira armadilha:** o campo `OBSERVACAO` carrega texto real de campo e passou
muito tempo sem ser lido. É onde aparece, por exemplo, o elo tendo queimado — algo que
nenhuma OS registra. Numa varredura, aparecia em 10 de 100 ativos.

Formato: separador `;`, latin-1, **sem tratamento de aspas**
(`csv.QUOTE_NONE`) porque há aspas soltas no texto, e
`csv.field_size_limit(10**7)` porque há campos enormes.

**O mesmo ativo aparece em três papéis** e o casamento vale em qualquer um:
`COD_ELE_PROBLEMA` (o que teve defeito), `COD_ELE_INTERROMPIDO` (o que ficou sem
energia) e `COD_ELE_FECHADO`. Para "por que este trafo queimou", o papel que interessa
é **problema**; interrompido é resposta para outra pergunta e deve ser guardado à
parte, como marcador.

**Janela de casamento com a SS** (a mesma do motor do site, não invente outra): a SS
casa se sua abertura cair entre o início da ocorrência menos **1 hora** e o fim mais
**24 horas**. A tolerância para trás existe porque a SS costuma nascer minutos antes do
registro formal. A janela vale contra o **vão inteiro** da ocorrência, do primeiro passo
aberto ao último fechado.

## OBRAS e status de OS

Arquivos xlsx grandes (dezenas de MB). Leia com `read_only=True` e
`data_only=True`, e itere com `values_only=True` — carregar tudo em memória é
desnecessário e lento.

A pergunta que essa base responde melhor que as outras: **obra com instalação e sem
retirada**. São 2.142 obras distintas (não 2.169 — aquele número contava linhas de SS,
não obras). Conte obras distintas, sempre.

## Almoxarifado

**É mais confiável que a SS/OS para identidade de equipamento.** Validado em dois casos
de verdade conhecida. Numa comparação de 6.936 pares limpos, 57% divergiam — e onde deu
para checar, o almoxarifado estava certo.

O erro típico da SS/OS é **o número de série do instalado sobrescrever os campos do
retirado**. Sintoma: uma data de fabricação impossível (ex.: `01/03/2026` num
equipamento retirado, que era `03/2007` digitado errado). Quando a série do retirado e a
do instalado forem iguais, desconfie da SS/OS antes de desconfiar do campo.

## Cadastro FIS (KMZ da rede de distribuição)

Ver `geo.md`. Resumo do que ele acrescenta e do que ele não resolve:

**Acrescenta:** capacidade do elo fusível **cadastrada** no ponto (lado carga e lado
fonte), especificação da chave fusível, potência nominal, tensão primária, fase primária
e secundária, tap, tombamento, série, fabricante, bloco, urbano/rural, e a data da
última alteração de cadastro.

**Não resolve:** identidade de equipamento — fabricante vem `Unknown` em 48 de 70 casos
e série `0000000000` em 48 de 70. E **não identifica auxiliar**: `Uso` vem
"Distribuição" em 100%, incluindo os de prefixo 51.

**Antes de usar o cadastro como "o estado antes do evento", confira a data.** O campo
`Timestamp` é **multivalorado, separado por `¬`** — pegue o máximo. Se a última
alteração for posterior à SS, o registro já pode refletir a troca, e a leitura do
"antes" não vale para aquele caso.
