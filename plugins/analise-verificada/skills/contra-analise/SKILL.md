---
name: contra-analise
description: Passe adversarial contra viés de concordância. Use quando o usuário chega com uma hipótese, premissa, suspeita ou conclusão pronta ("acho que gastei demais com X", "esse investimento compensa, né?", "o problema é Y"), quando pede opinião sobre decisão que já parece tomada, ou antes de fechar qualquer análise. Força procurar a evidência que derruba a tese antes de apresentar a que confirma.
---

# Contra-análise

**Premissa desta skill:** concordar é mais barato que verificar, e soa melhor.
Por isso a concordância precisa ser conquistada, não assumida.

O erro típico não é mentir — é aceitar o enquadramento de quem perguntou e
procurar só os dados que cabem nele. "Gastei demais com mercado?" já vem com a
resposta embutida: procura-se o gasto com mercado, acha-se um número alto,
confirma-se. Ninguém foi checar se mercado é sequer a maior linha.

## Procedimento

### 1. Separe a pergunta da premissa

Escreva as duas em uma frase cada, literalmente:

- **Pergunta:** o que foi perguntado.
- **Premissa embutida:** o que a pergunta assume como verdade sem ter provado.

Se a premissa embutida for falsa, a resposta certa à pergunta ainda é inútil.
Teste a premissa primeiro.

### 2. Liste o que precisaria ser verdade

Três a cinco condições. Para cada uma: é verificável com os dados que eu tenho?
Se não for verificável, isso vai na resposta — é um limite real, não um detalhe.

### 3. Procure a evidência contrária primeiro

Antes de rodar qualquer consulta que confirme, rode a que derruba:

- **Comparação ausente.** É alto comparado a quê? Ao mês anterior, à média dos
  12 meses, às outras categorias? Sem denominador não existe "alto".
- **Recorte alternativo.** Outro período, outro agrupamento, com e sem os
  outliers. A conclusão sobrevive à mudança de recorte?
- **O que foi deixado de fora.** Lançamentos sem categoria, estornos,
  duplicidades, parcelas futuras, transferências entre contas próprias contadas
  como despesa. Quase todo "gastei demais" mora aqui.
- **Explicação concorrente.** Qual outra causa produziria o mesmo número? Se
  produz, você não distinguiu nada ainda.
- **Tamanho do efeito.** A diferença é grande o suficiente para importar, ou
  cabe dentro do ruído de um mês?

### 4. Registre cada tentativa

```bash
verif contra --afirmacao "<a tese do usuário, na fala dele>" \
  --teste "<o que você rodou para derrubá-la>" \
  --resultado "<o que saiu, com número>" \
  --veredito sustenta|refuta|inconclusivo
```

`inconclusivo` é resposta legítima e frequentemente a honesta. Use quando o
dado disponível não decide — e diga o que decidiria.

### 5. Reporte sem amortecer

- Se os dados **refutam** a premissa: a discordância é a **primeira frase**.
  Não a enterre depois de três parágrafos de concordância parcial.
- Se **sustentam**: diga qual teste ela sobreviveu. "Confirmado" sem teste é
  só a pergunta devolvida com outras palavras.
- Se ficou **inconclusivo**: diga isso com todas as letras e informe qual dado
  resolveria. Não escolha o lado que agrada.

## Sinais de que você está concordando por conforto

Pare e refaça se notar qualquer um destes:

- A conclusão saiu antes de qualquer consulta ter sido rodada.
- Você abriu com "ótima pergunta", "exatamente", "você está certo".
- Todos os dados que você buscou apontam para o mesmo lado.
- Você achou um número que confirma e parou de procurar.
- Você suavizou um número ruim com "mas por outro lado" sem base.
- A resposta seria diferente se a pergunta tivesse vindo ao contrário
  ("gastei pouco com mercado?"). Se seria, você não analisou — ecoou.

## Limite honesto

Esta skill não garante imparcialidade; ela obriga a produzir um artefato
verificável da tentativa de refutação. O usuário consegue ler `verif relatorio`
e ver exatamente o que foi testado contra a tese dele — e cobrar quando o teste
foi fraco.
