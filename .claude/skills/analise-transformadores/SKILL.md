---
name: analise-transformadores
description: Auditoria de transformadores queimados e avariados da Energisa Tocantins — leitura das bases SS/OS, Crítica, OBRAS, almoxarifado e do cadastro FIS (KMZ da rede de distribuição), classificação de causa e subcausa, teste de transformador de serviço auxiliar, dimensionamento de elo fusível pela NDU-002, cruzamento com eventos em ativos vizinhos e montagem dos dossiês em Excel e artifact. Use sempre que a conversa mencionar trafo queimado, trafo avariado, código operativo, SS, OS, Crítica, elo fusível, para-raios, alimentador, religador, indicador de queima, taxa de falha, NQM, garantia de trafo, almoxarifado, KMZ ou KML de rede — mesmo que o pedido pareça uma pergunta simples de uma linha, porque quase toda pergunta desse domínio esbarra numa armadilha de leitura de base que já custou retrabalho antes.
---

# Auditoria de transformadores — Energisa Tocantins

Este domínio tem uma característica que define como se trabalha nele: **as bases erram
em silêncio**. Um parser ingênuo não quebra — ele devolve menos registros, ou registros
trocados, e a análise sai coerente, convincente e errada. Cada regra abaixo existe
porque alguém já concluiu algo errado por não saber dela.

Leia `references/bases.md` antes de tocar em qualquer base pela primeira vez numa
sessão. Os scripts em `scripts/` já embutem as armadilhas — prefira usá-los a
reescrever o carregador.

## As invariantes do trabalho

Estas valem em toda análise, sem exceção, até que o dono diga o contrário:

**O indicador fechado é congelado.** O 1.305 de jan–jun/2026 (1.225 queimados + 80
avariados) não se recalcula, não se reclassifica, não se "corrige". Todo achado é
**leitura ao lado do caso** — uma anotação que fica junto do registro, não uma
alteração dele. Se uma análise nova sugere que um caso estava mal classificado, o
resultado é uma observação com evidência, nunca um número diferente.

**Mês aberto é mês aberto.** Julho aguarda o martelo do dono. Agosto está em curso.
Nunca apresente número de mês aberto como se fosse fechado; diga a data de corte da
base que você usou e que o mês segue aberto.

**Divergência de formato não é divergência de dado.** Antes de declarar que dois
campos divergem, normalize: tire espaço, ponto, traço, barra, zero à esquerda e
prefixo de letra (`CITD`, `P`). Compare por contenção e por distância de 1 dígito
antes de chamar de diferente. Uma varredura anterior produziu 1.570 "divergências"
que eram só formatação.

**Diga o que ficou de fora.** Toda entrega declara a cobertura: quantos casos, qual
janela, o que não foi lido. Uma janela de histórico desigual (um caso de janeiro tem
1 mês de passado, um de junho tem 6) faz de qualquer taxa de reincidência um **piso**,
não uma medida — diga isso quando reportar.

## O caminho normal de uma análise

1. **Recorte.** Defina o universo por SS: data de abertura, prefixo do código
   operativo do ativo, e `ORIGEM_SS`. Conte SS e ativos distintos separadamente — o
   mesmo ativo costuma ter mais de uma SS, e trocar um pelo outro já produziu um
   número errado publicado ("2.169 obras" que eram 2.142).
2. **Enriqueça** com Crítica (ocorrência, causa, subcausa e principalmente
   `OBSERVACAO`, que carrega texto real de campo), com o almoxarifado quando a
   pergunta for identidade de equipamento, e com o cadastro FIS quando a pergunta for
   estado do ponto antes do evento.
3. **Classifique** causa e subcausa por conta própria, com evidência citada, e mostre
   ao lado do rótulo da base. Quando os dois divergem, isso é o achado — não escolha
   um em silêncio.
4. **Cruze a vizinhança** quando a pergunta for "por que queimou": eventos em ativos
   próximos na janela de ±7 dias. Ver `references/geo.md`.
5. **Entregue** com a cobertura e as ressalvas declaradas. Ver `references/entrega.md`.

## Onde a análise costuma errar

**Transformador de serviço auxiliar não é carga de cliente** e fica fora do
indicador. O cadastro **não** identifica isso — o campo `Uso` do FIS vem
"Distribuição" em 100% dos registros, inclusive nos de prefixo 51 que são auxiliares
por definição. O teste correto está em `references/codigos.md` e implementado em
`scripts/auxiliar.py`. Rode-o em todo recorte novo antes de fechar o número.

**O campo de elo da SS/OS é o elo que ENTROU, não o que estava.**
`QUAL_ELO_INSTALADO_NO_LOCAL` descreve o material do atendimento. O elo que estava no
poste antes vem do cadastro FIS (`Capacidade Elo Fusivel Lado Carga` / `Lado Fonte`).
Confundir os dois inverte a conclusão: numa leitura de julho, o elo que **entrou**
estava superdimensionado em 29 casos, enquanto o elo que **estava** era conforme em 30
de 38. Ver `references/reguas.md`.

**A Crítica e a SS/OS são complementares, não redundantes.** Num recorte de agosto,
112 SS estavam nas duas bases, 54 só numa e 53 só na outra. Usar uma só perde um
terço. Una e deduplique pelo número da SS, guardando de onde cada linha veio.

**O texto do campo contradiz o rótulo com frequência.** Quando `DESCRIPTION_SS` ou
`OBSERVACAO` diz uma coisa e `DEFEITO_SS` diz outra, o texto costuma estar mais perto
da verdade — mas o certo é registrar os dois e marcar como divergência, não escolher.

**Sazonalidade é um teste barato de plausibilidade.** Descarga atmosférica responde por
42–43% das ocorrências entre dezembro e março e por **2,9% em julho**; "trafo queimado
por descarga" statewide foi 493 em janeiro contra **17 em julho**. Antes de aceitar
surto como causa fora da estação, teste contra a taxa base do mês e do município.

## Scripts

Use-os em vez de reescrever. Todos rodam com Python 3 padrão (`openpyxl` só para saída
Excel) e nenhum depende de rede exceto `kmz_fis.py`.

| script | para quê |
|---|---|
| `scripts/bases.py` | carregar SS/OS, Crítica e o universo de códigos com as armadilhas embutidas; conferem o total lido e levantam erro se o parser falhou |
| `scripts/auxiliar.py` | os quatro testes de transformador de serviço auxiliar sobre um recorte |
| `scripts/elo_ndu002.py` | Tabela 03 da NDU-002; julga elo cadastrado e elo instalado, separadamente |
| `scripts/kmz_fis.py` | varrer a árvore pública do Drive e extrair o cadastro FIS dos alimentadores que interessam |
| `scripts/geo.py` | UTM 22S ↔ WGS84, distância, vizinhos por raio urbano/rural |

`python3 scripts/<nome>.py --help` explica os argumentos de cada um.

## Referências

Leia sob demanda, não tudo de uma vez:

- `references/bases.md` — formato e armadilha de cada base. **Leia antes da primeira leitura de base na sessão.**
- `references/codigos.md` — prefixos de código operativo, regra do auxiliar, regra dos 8 dígitos finais.
- `references/reguas.md` — NDU-002 Tabela 03, elo, para-raios, aterramento, garantia.
- `references/geo.md` — KML/KMZ, cadastro FIS, coordenadas, vizinhança, satélite.
- `references/entrega.md` — o que toda entrega declara; padrões de Excel e artifact.
