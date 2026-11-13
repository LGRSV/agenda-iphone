#!/usr/bin/env python3
"""Hook SessionStart/PostCompact: reinjeta o livro-razao no contexto.

Numeros verificados moram em disco, nao na janela de contexto. Depois de uma
compactacao eles voltam inteiros em vez de virarem lembranca vaga.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    from verif import dir_para_cwd, livro_aberto, texto_relatorio, texto_status  # noqa: E402
except Exception:  # pragma: no cover
    sys.exit(0)

LIMITE = 6000  # caracteres


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    try:
        base = dir_para_cwd(payload.get("cwd"))
        aberto = livro_aberto(base)
        if aberto is None:
            return 0
        caminho, dados = aberto
        corpo = texto_status(caminho, dados) + "\n\n" + texto_relatorio(dados)
        if len(corpo) > LIMITE:
            corpo = corpo[:LIMITE] + f"\n... (truncado; leia {caminho} por inteiro)"
        print(
            json.dumps(
                {
                    "additionalContext": (
                        "Analise verificada em andamento. Estes numeros ja tem origem "
                        "registrada - use-os em vez de recalcular de cabeca, e registre "
                        "qualquer numero novo com 'verif' antes de usa-lo:\n\n" + corpo
                    ),
                    "systemMessage": f"[analise-verificada] livro-razao ativo: {caminho.name}",
                }
            )
        )
    except Exception:
        return 0
    return 0


if __name__ == "__main__":
    sys.exit(main())
