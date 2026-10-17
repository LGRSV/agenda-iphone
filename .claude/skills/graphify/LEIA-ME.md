# graphify — skill para Claude Code

**Versão arquivada:** 0.9.48
**Pacote PyPI:** `graphifyy` (com dois "y" — o comando é `graphify`)
**Repositório oficial:** https://github.com/Graphify-Labs/graphify
**Arquivado em:** 24/08/2026

---

## O que é

Transforma uma pasta qualquer — código, docs, PDFs, imagens, vídeo — num grafo de
conhecimento persistente, gravado em `graphify-out/`. Depois você consulta o grafo
em vez de reler os arquivos, o que economiza contexto e tokens.

**Duas passagens de extração:**

- **Estrutural (AST)** — tree-sitter extrai funções, classes, imports e chamadas de
  arquivos de código. Determinística, **sem LLM, sem API key, sem custo de tokens.**
  Cobre ~28 linguagens (JS, TS, Python, Go, Rust, Java, C/C++, Ruby, PHP, Swift,
  Kotlin, entre outras).
- **Semântica (LLM)** — só para docs, papers e imagens. Usa Gemini se
  `GEMINI_API_KEY` estiver definida; senão o próprio agente faz a extração.
  **Essa parte custa tokens.** Num repositório só de código, ela é pulada inteira.

Depois: detecção de comunidades, *god nodes* (hubs), *surprises* (conexões
inesperadas entre partes do projeto) e um health check de integridade.

**Saídas em `graphify-out/`:** `graph.json` (formato GraphRAG), `GRAPH_REPORT.md`
(relatório em linguagem simples) e uma visualização HTML interativa. Sob flags:
SVG, GraphML, vault do Obsidian, wiki, Cypher para Neo4j/FalkorDB, servidor MCP.

**Rastro de honestidade:** toda aresta é marcada `EXTRACTED` (veio do AST, é fato),
`INFERRED` (o LLM deduziu) ou `AMBIGUOUS`. As regras da skill proíbem inventar
aresta e obrigam a mostrar o custo em tokens.

---

## Como restaurar / instalar

**Caminho recomendado — instalação canônica (baixa a versão mais recente):**

```bash
uv tool install graphifyy      # ou: pipx install graphifyy
graphify install               # registra a skill em ~/.claude/skills/graphify/
```

Para fixar exatamente a versão arquivada aqui:

```bash
uv tool install graphifyy==0.9.48
graphify install
```

**Caminho manual — a partir destes arquivos:**

Copie `SKILL.md` e a pasta `references/` para `~/.claude/skills/graphify/`,
mantendo a estrutura:

```
~/.claude/skills/graphify/
├── SKILL.md
└── references/
    ├── add-watch.md
    ├── exports.md
    ├── extraction-spec.md
    ├── github-and-merge.md
    ├── hooks.md
    ├── query.md
    ├── transcribe.md
    └── update.md
```

O `SKILL.md` sozinho já funciona para o agente entender o fluxo, mas o CLI Python
(`graphifyy`) precisa estar instalado para os comandos rodarem. O Passo 1 do
próprio `SKILL.md` detecta a ausência e reinstala automaticamente via `uv`/`pip`.

---

## Instalação por projeto (em vez de por usuário)

```bash
graphify install --project
```

Grava `.claude/skills/graphify/`, `.claude/settings.json` e um `CLAUDE.md` dentro
do repositório atual. Commitado no git, vale para qualquer sessão naquele projeto.

**Atenção:** essa variante registra hooks `PreToolUse` em `Bash|Grep` e
`Read|Glob` apontando para o caminho absoluto do binário `graphify` na máquina
onde foi instalada. Se o repositório for usado em outra máquina, esse caminho
precisa ser ajustado no `.claude/settings.json`.

Há ainda o modo estrito (`--project --strict`), que **bloqueia** a primeira
leitura de arquivo bruto da sessão e redireciona para o grafo. O padrão é só um
empurrão, não uma trava.

---

## Comandos principais

```bash
graphify query "<pergunta>"              # travessia BFS — contexto amplo
graphify query "<pergunta>" --dfs        # DFS — rastrear uma cadeia específica
graphify query "<pergunta>" --budget 1500  # limita a resposta a N tokens
graphify path "ConceitoA" "ConceitoB"    # menor caminho entre dois conceitos
graphify explain "<conceito>"            # explicação de um nó e suas conexões
graphify update .                        # re-extrai só o que mudou (AST, sem custo)
graphify hook install                    # rebuild automático a cada git commit
```

---

## Nota sobre estes arquivos

Foram copiados da instalação da versão 0.9.48. O tamanho em bytes de cada arquivo
confere com o original, mas **a fonte canônica é sempre o pacote PyPI** — em caso
de qualquer dúvida sobre integridade, use `uv tool install graphifyy` em vez de
copiar daqui.

Licença: ver `LICENSE` e `LICENSE-MIT` no repositório oficial.
