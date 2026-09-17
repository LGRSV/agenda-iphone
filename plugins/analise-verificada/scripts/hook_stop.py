#!/usr/bin/env python3
"""Hook Stop: impede encerrar a resposta com numero sem lastro.

So age quando existe uma analise ABERTA na pasta de trabalho. Depois de
MAX_BLOQUEIOS tentativas ele para de barrar e apenas avisa, para nunca
prender a sessao em laco.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    from verif import (  # noqa: E402
        MAX_BLOQUEIOS,
        RE_NUMERO,
        auditar_texto,
        dir_para_cwd,
        livro_aberto,
        salvar,
        texto_auditoria,
        _mascarar,
    )
except Exception:  # pragma: no cover - hook nunca pode derrubar a sessao
    sys.exit(0)


def analisar(payload: dict) -> int:
    if payload.get("agent_type"):
        return 0  # subagentes nao sao barrados
    mensagem = payload.get("last_assistant_message") or ""
    if not mensagem.strip():
        return 0
    base = dir_para_cwd(payload.get("cwd"))
    aberto = livro_aberto(base)
    if aberto is None:
        return 0
    caminho, dados = aberto
    if not RE_NUMERO.search(_mascarar(mensagem, True)):
        return 0

    res = auditar_texto(mensagem, dados)
    pendencias = []
    if res["sem_lastro"]:
        pendencias.append(texto_auditoria(res))
    if not res["recalculo"]["ok"]:
        pendencias.append(texto_auditoria(res))
    if not dados["contra"]:
        pendencias.append(
            "nenhuma contra-analise registrada: rode "
            "verif contra --afirmacao ... --teste ... --resultado ... --veredito ..."
        )
    if not pendencias:
        return 0

    bloqueios = int(dados.get("bloqueios", 0))
    aviso = (
        f"[analise-verificada] A analise '{dados['titulo']}' esta aberta e a resposta "
        "tem numero sem origem registrada:\n"
        + "\n".join(dict.fromkeys(pendencias))
        + "\n\nRegistre com 'verif calc/fato/premissa', ou rotule explicitamente o que "
        "for estimativa, ou feche a analise com 'verif fechar'."
    )
    if bloqueios >= MAX_BLOQUEIOS:
        print(json.dumps({"systemMessage": aviso + "\n(limite de bloqueios atingido; seguindo)"}))
        return 0
    dados["bloqueios"] = bloqueios + 1
    try:
        salvar(caminho, dados)
    except Exception:
        return 0
    print(aviso, file=sys.stderr)
    return 2


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    try:
        return analisar(payload)
    except Exception as exc:  # nunca derrubar a sessao por causa do hook
        print(json.dumps({"systemMessage": f"[analise-verificada] hook falhou: {exc}"}))
        return 0


if __name__ == "__main__":
    sys.exit(main())
