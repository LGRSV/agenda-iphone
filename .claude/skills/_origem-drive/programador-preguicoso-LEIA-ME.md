# Skills para economizar tokens (Claude Code)

Cópias do arquivo principal `SKILL.md` de cada skill, baixadas do GitHub em 2026-10-04.

| Arquivo | Origem | Licença | Versão baixada (commit) | O que faz |
|---|---|---|---|---|
| ponytail-SKILL.md | https://github.com/DietrichGebert/ponytail | MIT | c982cd4 (2026-10-03) | Claude age como dev sênior preguiçoso: escada de decisão (precisa existir? já existe no código? stdlib? uma linha?) e saída curta. Níveis: lite, full, ultra. |
| lazy-cat-SKILL.md | https://github.com/albertobarnabo/lazy-cat | MIT | 7bd607d (2026-10-02) | Antes de codar, procura o caminho barato (biblioteca, dataset, script gerador) e depois escreve só o que foi pedido. Fecha com a linha "Left out". |
| caveman-SKILL.md | https://github.com/JuliusBrussee/caveman | Apache 2.0 | 6571943 (2026-10-04) | Só muda o texto das respostas: frases curtas, sem enrolação. Não reduz o que o Claude lê, só o que escreve. |

## Como usar (Claude Code)

Copie o arquivo para `~/.claude/skills/<nome>/SKILL.md`, por exemplo `~/.claude/skills/ponytail/SKILL.md`, e comece uma sessão nova. Para ligar, use `/ponytail`, `/caveman` etc.; para desligar, diga "normal mode".

## O que NÃO foi salvo

- Ponytail e Caveman têm outras skills auxiliares nos repositórios (review, audit, commit, compress etc.). Só a principal foi salva.
- O lazy-cat tem também duas versões separadas (`think-twice` e `surgical`) dentro de `skills/`. O arquivo principal já junta as duas.
- Os números de economia (por exemplo "65% menos tokens") vêm dos autores e de blogs, não de teste independente. Eu li o conteúdo das skills, mas não testei nenhuma em uso real.
- Eram instruções em texto, sem comandos ou scripts. As três são pesadas para ficar sempre ativas; Ponytail e Caveman pedem para ficar ligadas em toda resposta.
