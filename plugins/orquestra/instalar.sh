#!/usr/bin/env bash
# Instala a skill orquestra em ~/.claude/skills (escopo pessoal).
#   ./instalar.sh            instala ou atualiza
#   ./instalar.sh --remover  desinstala (o caderno .orquestra/ dos projetos fica)
set -euo pipefail
ORIGEM="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESTINO="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills/orquestra"
if [ "${1:-}" = "--remover" ]; then
  rm -rf "$DESTINO"; echo "orquestra removida de $DESTINO"; exit 0
fi
rm -rf "$DESTINO"; mkdir -p "$DESTINO"
cp -R "$ORIGEM/skills/orquestra/." "$DESTINO/"
echo "orquestra instalada em $DESTINO"
echo "Uso: peça algo grande e diga 'use a orquestra', ou digite /orquestra."
