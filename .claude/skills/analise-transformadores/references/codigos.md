# Códigos operativos

O código operativo tem 10 dígitos. Os **dois primeiros** dizem o tipo de ativo; os
**oito últimos** são a identidade do ponto.

## Prefixos

| prefixo | ativo |
|---|---|
| 57, 56, 53, 51, 52, 55, 42 | transformador |
| 03, 02, 67 | chave fusível |
| 33 | chave fusível religadora |
| 88, 90, 80 | chave faca |
| 79, 78 | religador |
| 58 | regulador |
| 59 | capacitor |
| 31, 40, 41, 68, 44, 29, 32, 22, 45, 86, 49, 30 | poste |

Dentro dos transformadores, conferido contra as 1.305 de jan–jun/2026: o prefixo **57
responde por 97,6%** do indicador, 53 por 2,1% e 52 por 0,2%. Ou seja, 57/53/52 é
transformador de distribuição normal e **não** deve levantar suspeita sozinho. O
prefixo **51 é serviço auxiliar** e é o que merece olhar.

## Transformador de serviço auxiliar

Um transformador de serviço auxiliar alimenta um religador ou um regulador. **Não é
carga de cliente e fica fora do indicador de queima.**

**A regra:** o auxiliar espelha o código do equipamento que alimenta, trocando só o
prefixo. Prefixo **51 ou 57** mais os **8 dígitos finais** do religador (79) ou do
regulador (58).

Confirmada literalmente em cerca de 179 textos de OS, do tipo
*"TRAFO FURTADO 5149587113 QUE ATENDE O RELIGADOR 7949587113"* e
*"Segue ss Aberta para fazer a substituição do Trafo que alimenta o Religador
7950099122. trafo 5150099122"*. Dessas ~179 ordens, 31 são furto — o auxiliar é alvo
frequente.

**A regra NÃO generaliza para "mesmos 8 dígitos finais = mesmo ponto".** Isso só vale
para chaves faca 80/90, onde a distância mediana entre os dois códigos é de 2 a 5
metros. Para o prefixo 57 contra outro 57, a mediana é de **22 km**.

### Os quatro testes

Rode todos; nenhum sozinho basta. Implementados em `scripts/auxiliar.py`.

1. **Prefixo.** O código começa com 51?
2. **Espelho.** Existe `79` + os 8 dígitos finais, ou `58` + os 8 dígitos finais, no
   universo de códigos conhecidos? Monte o universo com a SS/OS inteira, a Crítica, o
   cadastro FIS e as camadas de isolação — quanto maior, melhor o teste.
3. **Texto.** A SS ou a OS mencionam *auxiliar*, *religador*, *regulador* ou *RL*?
4. **Rede secundária.** Um auxiliar não tem rede BT própria. No cadastro FIS, compare
   `Primary Location X/Y` com `Secondary Location X/Y`: se coincidem, não há BT. No
   KML, a pasta `ET_<código>` vazia diz a mesma coisa.

**Calibre o teste 2 antes de confiar nele.** Meça quantos transformadores comuns do
mesmo recorte têm espelho: num universo de 41.688 trafos de prefixo 57, apenas 22
(0,05%) tinham. Um teste que dispara em 0,05% dos casos normais discrimina de verdade.

### Falsos positivos conhecidos

- **"regulador do tap"** no texto é o comutador do próprio transformador, não um ativo
  regulador. Um caso real (5703811122, Palmas, 25 kVA, 35 UCs) disparou o teste 3 por
  isso e é transformador comum.
- **`QTD_CLIENTES = 0`** não é assinatura de auxiliar. O campo é preenchido mal; um
  caso com 0 clientes chegou a nomear a UC e a titular no texto da SS.
- **Furto** de auxiliar aparece com `ORIGEM_SS = FURTADO` e não entra no universo de
  queimado/avariado de qualquer forma — mas vale listar à parte, porque é padrão.

### O que fazer ao encontrar um

Não recalcule nada. Registre: código, SS, data, a evidência que confirma (de
preferência o texto verbatim), qual dos quatro testes disparou, e a recomendação de
manter fora do indicador. Se o mês ainda está aberto, isso é aviso antes de fechar —
diga assim.

**Detalhe de como o auxiliar chega ao número:** um auxiliar de religador tem 0
clientes, logo **não gera ocorrência na Crítica**. Ele não entra pela via da Crítica;
entra só pela via da SS com `ORIGEM_SS = QUEIMADO`. Se o indicador do mês for montado a
partir de SS, ele vem junto a menos que alguém filtre.
