#!/usr/bin/env bash
# Instala o analise-verificada em ~/.claude/ (escopo pessoal: vale em qualquer projeto).
#
#   ./instalar.sh            instala ou atualiza
#   ./instalar.sh --remover  desinstala
#
# Idempotente: rodar duas vezes nao duplica hook nem perde configuracao existente.
set -euo pipefail

ORIGEM="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
SKILLS="$BASE/skills"
DESTINO="$SKILLS/analise-verificada"
CONFIG="$BASE/settings.json"
SKILLS_NOMES=(analise-verificada contra-analise contexto-longo)

command -v python3 >/dev/null || { echo "erro: python3 e necessario" >&2; exit 1; }

remover_hooks() {
  python3 - "$CONFIG" <<'PY'
import json, sys, pathlib
caminho = pathlib.Path(sys.argv[1])
if not caminho.is_file():
    sys.exit(0)
try:
    cfg = json.loads(caminho.read_text(encoding="utf-8") or "{}")
except json.JSONDecodeError:
    print(f"aviso: {caminho} nao e JSON valido; nao foi tocado", file=sys.stderr)
    sys.exit(0)
hooks = cfg.get("hooks")
if not isinstance(hooks, dict):
    sys.exit(0)
def nosso(grupo):
    return any("analise-verificada" in str(h.get("command", ""))
               for h in grupo.get("hooks", []) if isinstance(h, dict))
for evento in list(hooks):
    if isinstance(hooks[evento], list):
        hooks[evento] = [g for g in hooks[evento] if not (isinstance(g, dict) and nosso(g))]
        if not hooks[evento]:
            del hooks[evento]
if not hooks:
    cfg.pop("hooks", None)
caminho.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY
}

if [ "${1:-}" = "--remover" ]; then
  remover_hooks
  for nome in "${SKILLS_NOMES[@]}"; do rm -rf "${SKILLS:?}/$nome"; done
  echo "analise-verificada removido de $BASE"
  echo "(os livros-razao em .analise/ dos seus projetos foram preservados)"
  exit 0
fi

mkdir -p "$SKILLS" "$DESTINO/scripts"
for nome in "${SKILLS_NOMES[@]}"; do
  mkdir -p "$SKILLS/$nome"
  cp "$ORIGEM/skills/$nome/SKILL.md" "$SKILLS/$nome/SKILL.md"
done
cp "$ORIGEM/scripts/"*.py "$DESTINO/scripts/"
chmod +x "$DESTINO/scripts/"*.py
mkdir -p "$DESTINO/tests" && cp "$ORIGEM/tests/test_verif.py" "$DESTINO/tests/"
cp "$ORIGEM/README.md" "$DESTINO/README.md"

remover_hooks   # tira a versao anterior antes de gravar a nova
python3 - "$CONFIG" "$DESTINO/scripts" <<'PY'
import json, sys, pathlib
caminho, scripts = pathlib.Path(sys.argv[1]), sys.argv[2]
cfg = {}
if caminho.is_file():
    try:
        cfg = json.loads(caminho.read_text(encoding="utf-8") or "{}")
    except json.JSONDecodeError:
        print(f"erro: {caminho} nao e JSON valido; corrija antes de instalar", file=sys.stderr)
        sys.exit(1)
def cmd(script):
    return f'python3 "{scripts}/{script}"'
novos = {
    "Stop": {"hooks": [{"type": "command", "command": cmd("hook_stop.py"), "timeout": 20,
                        "statusMessage": "conferindo numeros contra o livro-razao"}]},
    "SessionStart": {"matcher": "startup|resume|clear|compact|fork",
                     "hooks": [{"type": "command", "command": cmd("hook_contexto.py"), "timeout": 15}]},
    "PostCompact": {"hooks": [{"type": "command", "command": cmd("hook_contexto.py"), "timeout": 15}]},
}
hooks = cfg.setdefault("hooks", {})
for evento, grupo in novos.items():
    hooks.setdefault(evento, []).append(grupo)
caminho.parent.mkdir(parents=True, exist_ok=True)
caminho.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY

echo "instalado em $BASE"
echo "  skills:  ${SKILLS_NOMES[*]}"
echo "  scripts: $DESTINO/scripts"
echo "  hooks:   Stop, SessionStart, PostCompact em $CONFIG"
echo
echo "Reinicie o Claude Code para carregar. Teste com:  python3 $DESTINO/scripts/verif.py status"
