# Habilidades

Biblioteca de skills (habilidades) para agentes de IA — Claude Code e compatíveis.

Cada subpasta guarda uma skill completa e um `LEIA-ME.md` explicando o que ela faz
e como restaurá-la.

---

## Por que esta pasta existe

Sessões do Claude Code na web rodam em containers efêmeros: tudo que é instalado em
`~/.claude/` some quando a sessão termina. Só três coisas sobrevivem:

1. **As skills sincronizadas da conta** (aparecem em `~/.claude/skills/synced/`)
2. **O que está commitado num repositório git**
3. **O que está aqui no Google Drive** — acessível via conector em qualquer sessão

Esta pasta é a opção 3: um acervo durável de skills que qualquer sessão futura pode
ler e reinstalar, sem depender do que sobreviveu no container.

---

## Conteúdo

| Skill | O que faz | Versão |
|---|---|---|
| `graphify/` | Transforma código, docs, PDFs e imagens num grafo de conhecimento consultável. Reduz o custo de contexto ao responder sobre uma base de código. | 0.9.48 |

---

## Como usar em uma conversa futura

Basta pedir ao assistente algo como:

> "Instale a skill graphify que está na pasta Habilidades do meu Google Drive."

O assistente lê o `LEIA-ME.md` da subpasta correspondente e segue as instruções de
restauração. Na maioria dos casos a rota mais confiável não é copiar os arquivos
daqui, e sim o comando de instalação canônico que cada `LEIA-ME.md` indica — estes
arquivos servem como referência, backup e documentação do que já foi testado.

---

## Como adicionar uma skill nova

Crie uma subpasta com o nome da skill contendo:

- `SKILL.md` — o arquivo principal, com o frontmatter `name` e `description`
- `references/` — arquivos auxiliares, se houver
- `LEIA-ME.md` — o que faz, versão, origem e como reinstalar

Atualizado em: 24/08/2026
