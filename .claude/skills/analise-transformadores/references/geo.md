# Geografia, cadastro e imagem

## Coordenadas

`COORD_X` / `COORD_Y` da SS/OS são **UTM zona 22S, SIRGAS 2000 — EPSG:31982**. Não são
graus. Converter errado joga o ativo no oceano e o erro é óbvio; o erro sutil é assumir
outro datum e ficar dezenas de metros fora.

Três fontes independentes de coordenada, e elas se confirmam:
SS/OS (UTM), KML de circuito (Daimon) e cadastro FIS (`Lat`/`Long` em graus com vírgula
decimal, mais `UTM = POINT(x y)`). Concordância medida entre FIS e a coordenada em uso:
**mediana de 2,2 m**. Divergência acima de ~50 m merece olhar.

## KML de circuito — a armadilha da pasta vazia

**8.623 pastas `ET_<código>` no acervo estão vazias** — são ativos sem rede BT própria.
Um extrator que procura a coordenada logo depois do marcador `ET_` pega, nesses casos,
**a coordenada do ativo seguinte**. O sintoma é sutil: as coordenadas parecem
plausíveis, só estão trocadas.

A correção: ao encontrar `ET_<código>`, verifique se o que vem em seguida é
`</Folder>`. Se for, pule — aquele ativo não tem ponto próprio ali.

Consertar isso melhorou a validação KML × SS/OS de **mediana 17 m para 4 m**.

Separar BT de MT **não funciona por nome** — os placemarks de BT são numéricos. Use o
deslocamento do marcador `<name>RedeBT</name>` no arquivo: o que vem depois é BT.

## Cadastro FIS — árvore KMZ da rede de distribuição

Estrutura no Drive: `dados / SE_<subestação> / <alimentador> / <camada>.kmz`.
São 111 subestações e supridoras mais uma pasta `CARTOGRAFIA`, e por volta de 721
alimentadores. Cinco camadas por circuito: **Postes**, **Transformadores**,
**Vaos_MT**, **Equipamentos_de_isolacao**, **Iluminacao_publica**.

Cada `.kmz` é um zip com `doc.kml`. Cada ativo é um `<Placemark>` nomeado pelo código
operativo, com `<ExtendedData>` de cerca de 50 campos.

### Como baixar sem gastar contexto

**Se a pasta estiver pública**, use `curl` — custo de contexto zero:

- listar uma pasta: `https://drive.google.com/embeddedfolderview?id=<ID>#list`,
  e extraia os pares id/título dos blocos `<div class="flip-entry" id="entry-<ID>">…<div class="flip-entry-title">TÍTULO</div>`
- baixar um arquivo: `https://drive.google.com/uc?export=download&id=<ID>`

`scripts/kmz_fis.py` faz a varredura e o download inteiros por essa via.

**Se a pasta for privada**, só resta o conector do Drive
(`download_file_content`), que devolve base64 — e o base64 **entra no contexto**. Para
centenas de arquivos isso é inviável. Nesse caso, peça ao dono para tornar a pasta
pública, ou recorte para pouquíssimos arquivos. A diferença entre as duas vias é de
ordens de grandeza.

### Recorte, sempre

Não baixe as 721 pastas. Levante os alimentadores dos casos que interessam (campo
`ALIMENTADOR` da SS/OS, que bate com o cadastro em 100% dos casos testados) e baixe só
esses. Para 70 casos foram 51 alimentadores, 254 arquivos, 56 MB — e 44.050
transformadores de cadastro para comparar.

### Campos do FIS que valem

`Alimentador` · `Potência Nominal (kVA)` · `Especificação` · `Tensão Primária` ·
`Fase Primária` / `Secundária` · `Tap Ligado do Lado da Fonte/Carga` ·
`Fabricante` · `Número de Série` · `Tombamento` ·
`Instalação Chave Fusivel` · `Especificação Chave Fusivel` ·
`Capacidade Elo Fusivel Lado Carga` / `Lado Fonte` · `Retorno pelo Terra` ·
`NAME_BLOCO` (o código da chave fusível do ponto) · `Urbano_Rural` · `Localidade` ·
`Lat` / `Long` / `UTM` · `Primary` e `Secondary Location X/Y` ·
`Timestamp` e `Event Description` (histórico de alteração do cadastro).

`Timestamp` é **multivalorado, separado por `¬`**. Pegue o máximo e compare com a data
do evento antes de tratar o cadastro como "o estado antes".

## Vizinhança

Para a pergunta "o que aconteceu perto deste ativo", a régua que o dono definiu:

- **urbano:** os 4 ativos mais próximos, até 100 m
- **rural:** os 100 ativos mais próximos, até 1.000 m
- **janela:** no máximo 7 dias antes e 7 dias depois do evento

Traga tudo o que houver nesses ativos — ocorrência da Crítica, SS e OS — não só
ocorrência. Poste abalroado, poda e serviço de terceiro nas proximidades explicam
queima com frequência, e só aparecem se você olhar SS/OS do vizinho.

## Imagem de satélite

**Pode redistribuir e embutir:**
- **CBERS-4A/WPM, 2 m** — INPE BDC STAC, `https://data.inpe.br/bdc/stac/v1/search`,
  coleção `CB4A-WPM-PCA-FUSED-1`, asset `tci`.
- **Sentinel-2, 10 m** — `https://earth-search.aws.element84.com/v1/search`.

Ambos são dados abertos, com atribuição.

**Não pode:** baixar em lote ou embutir tiles do Google ou da Esri. Os termos proíbem.
Para levar o usuário ao Google Maps, use link, não tile.

Link do Maps que **cai com alfinete** (só `/@lat,lon` centraliza sem marcar):

```
https://www.google.com/maps/place/LAT,LON/@LAT,LON,300m/data=!3m1!1e3
```

Ao ordenar cenas por data, cuidado: `sorted(..., key=lambda kv: (-kv[0][1],))` sobre
string de data não inverte nada. Use `key=..., reverse=True`.
