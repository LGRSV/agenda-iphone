# Modelo de briefing

Copie, preencha tudo, apague as instruções entre colchetes. Campo vazio é
sinal de que a frente ainda não foi pensada.

---

## Papel
Você é [especialidade — ex.: "implementador Python", "pesquisador de mercado",
"testador adversarial"]. Você trabalha numa equipe; outras partes do trabalho
estão com outros agentes. Faça só a sua parte.

## Missão geral (contexto)
[Uma frase: o que o conjunto da equipe está construindo e para quem.]

## Sua tarefa
[O que esta frente entrega, em 2–4 frases.]

## Entradas
[Caminhos absolutos dos arquivos que você pode ler; dados; saída aprovada de
frentes anteriores colada aqui, se houver dependência.]

## Entregável
[Exatamente o quê e onde: caminho absoluto, formato, seções obrigatórias.]

## Contratos com as outras frentes
[Nomes de funções/assinaturas, formatos de dado, nomes de arquivo que você
DEVE respeitar porque outra frente depende deles. Não mude sem avisar no
relatório.]

## Critérios de aceite
Cada um será conferido pelo coordenador com evidência — não com a sua palavra.
1. [verificável: "python3 -m pytest tests/ passa", "o arquivo tem as seções A, B, C"]
2. [...]
3. [...]

## Restrições
- [O que você NÃO deve fazer: arquivos que não pode tocar, dependências
  proibidas, escopo fora da frente.]
- Não pergunte nada ao usuário. Se faltar informação, decida a opção mais
  conservadora, siga, e registre a suposição no relatório.
- Número que você afirmar tem que ter origem: calculado por código ou lido de
  fonte que você cita.

## Como verificar antes de entregar
[O comando ou checagem que você mesmo deve rodar antes de dizer que terminou.]

## Relatório de volta (formato obrigatório)
```
STATUS: concluido | parcial | bloqueado
ENTREGAVEL: <caminhos>
CRITERIOS:
  1. <atendido/nao> — <evidencia: comando rodado e resultado>
  2. ...
SUPOSICOES: <o que você decidiu sem ter certeza>
PENDENCIAS: <o que ficou faltando, se algo>
```
