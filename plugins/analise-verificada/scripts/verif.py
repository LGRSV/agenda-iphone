#!/usr/bin/env python3
"""verif - livro-razao de verificacao para analises.

Regra unica: nenhum numero entra numa analise sem origem registrada aqui.

  calculo   o valor foi computado por este programa (Decimal, nao "de cabeca")
  fato      o valor veio de uma fonte citavel (arquivo, query, URL, o usuario)
  premissa  o valor e estimativa/suposicao e sera rotulado como tal na entrega

Somente stdlib. Rode `verif.py ajuda` para a lista de comandos.
"""
from __future__ import annotations

import argparse
import ast
import json
import os
import re
import sys
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP, getcontext
from pathlib import Path

getcontext().prec = 34

VERSAO_ESQUEMA = 1
MAX_BLOQUEIOS = 2  # quantas vezes o hook Stop pode barrar antes de so avisar

# --------------------------------------------------------------------------
# erros
# --------------------------------------------------------------------------


class ErroVerif(Exception):
    """Erro de uso previsto: mensagem limpa, sem traceback."""


# --------------------------------------------------------------------------
# localizacao do livro-razao
# --------------------------------------------------------------------------


def dir_analises(base: str | None = None) -> Path:
    if base:
        return Path(base).expanduser().resolve()
    env = os.environ.get("ANALISE_DIR")
    if env:
        return Path(env).expanduser().resolve()
    return (Path.cwd() / ".analise").resolve()


def dir_para_cwd(cwd: str | None) -> Path:
    """Pasta de livros a partir do cwd de um hook (ANALISE_DIR ainda manda)."""
    env = os.environ.get("ANALISE_DIR")
    if env:
        return Path(env).expanduser().resolve()
    if cwd:
        return (Path(cwd) / ".analise").resolve()
    return dir_analises(None)


def _slug(texto: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", texto.strip().lower()).strip("-")
    return (s or "analise")[:60]


def caminhos_livros(base: Path) -> list[Path]:
    if not base.is_dir():
        return []
    return sorted(base.glob("*.json"))


def carregar(caminho: Path) -> dict:
    try:
        dados = json.loads(caminho.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ErroVerif(f"livro-razao ilegivel em {caminho}: {exc}") from exc
    if not isinstance(dados, dict) or "entradas" not in dados:
        raise ErroVerif(f"{caminho} nao parece um livro-razao do verif")
    return dados


def salvar(caminho: Path, dados: dict) -> None:
    caminho.parent.mkdir(parents=True, exist_ok=True)
    tmp = caminho.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(caminho)


def livro_aberto(base: Path) -> tuple[Path, dict] | None:
    """Retorna o livro aberto mais recente, ou None."""
    abertos = []
    for c in caminhos_livros(base):
        try:
            d = carregar(c)
        except ErroVerif:
            continue
        if d.get("status") == "aberta":
            abertos.append((d.get("criada_em", ""), c, d))
    if not abertos:
        return None
    abertos.sort()
    _, c, d = abertos[-1]
    return c, d


def livro_atual(base: Path) -> tuple[Path, dict] | None:
    """O livro aberto; na falta dele, o mais recente (para relatorio pos-fechamento)."""
    aberto = livro_aberto(base)
    if aberto is not None:
        return aberto
    todos = []
    for c in caminhos_livros(base):
        try:
            todos.append((carregar(c).get("criada_em", ""), c))
        except ErroVerif:
            continue
    if not todos:
        return None
    todos.sort()
    caminho = todos[-1][1]
    return caminho, carregar(caminho)


def exigir_aberto(base: Path) -> tuple[Path, dict]:
    aberto = livro_aberto(base)
    if aberto is None:
        raise ErroVerif(
            f"nenhuma analise aberta em {base}. Comece com: verif abrir \"<titulo>\""
        )
    return aberto


def agora() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# --------------------------------------------------------------------------
# numeros
# --------------------------------------------------------------------------

# 1.234.567,89 -> pt-BR inequivoco (tem virgula depois de grupos com ponto)
RE_PTBR_COMPLETO = re.compile(r"(?<![\d.,])\d{1,3}(?:\.\d{3})+,\d+(?![\d.,])")
# 1.234 -> ambiguo (mil duzentos e trinta e quatro? ou 1,234?)
RE_PONTO_MILHAR = re.compile(r"(?<![\d.,])\d{1,3}(?:\.\d{3})+(?![\d.,])")
# 1,234,567.89 -> ingles inequivoco
RE_EN_COMPLETO = re.compile(r"(?<![\d.,])\d{1,3}(?:,\d{3})+\.\d+(?![\d.,])")
RE_VIRGULA_MILHAR = re.compile(r"(?<![\d.,])\d{1,3}(?:,\d{3})+(?![\d.,])")


def para_decimal(texto: str) -> Decimal:
    """Converte texto de valor (pt-BR ou ingles) para Decimal, ou levanta ErroVerif."""
    t = texto.strip().replace("R$", "").replace(" ", " ").strip()
    t = t.replace(" ", "")
    if not t:
        raise ErroVerif("valor vazio")
    pct = t.endswith("%")
    if pct:
        t = t[:-1]
    sinal = ""
    if t and t[0] in "+-":
        sinal, t = t[0], t[1:]
    if RE_PTBR_COMPLETO.fullmatch(t):
        t = t.replace(".", "").replace(",", ".")
    elif RE_EN_COMPLETO.fullmatch(t):
        t = t.replace(",", "")
    elif RE_PONTO_MILHAR.fullmatch(t) or RE_VIRGULA_MILHAR.fullmatch(t):
        raise ErroVerif(
            f"'{texto}' e ambiguo (separador de milhar sem decimais). "
            "Escreva sem separador: 1234 ou 1.234,00"
        )
    elif re.fullmatch(r"\d+,\d+", t):
        t = t.replace(",", ".")
    try:
        v = Decimal(sinal + t)
    except InvalidOperation as exc:
        raise ErroVerif(f"'{texto}' nao e um numero reconhecido") from exc
    return v / 100 if pct else v


def fmt(valor: Decimal) -> str:
    """Texto canonico de um Decimal (sem notacao cientifica, sem zeros a toa)."""
    v = valor.normalize() if valor == valor.to_integral_value() else valor
    s = format(v, "f")
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s or "0"


# --------------------------------------------------------------------------
# avaliador de expressoes (AST, sem eval)
# --------------------------------------------------------------------------

RE_PCT_LITERAL = re.compile(r"(\d+(?:\.\d+)?)\s*%")
RE_ROTULO = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _dec_list(args: list[Decimal]) -> list[Decimal]:
    if not args:
        raise ErroVerif("funcao exige ao menos um argumento")
    return args


def _f_media(*a: Decimal) -> Decimal:
    vals = _dec_list(list(a))
    return sum(vals, Decimal(0)) / Decimal(len(vals))


def _f_mediana(*a: Decimal) -> Decimal:
    vals = sorted(_dec_list(list(a)))
    n = len(vals)
    meio = n // 2
    return vals[meio] if n % 2 else (vals[meio - 1] + vals[meio]) / Decimal(2)


def _f_desvpad(*a: Decimal) -> Decimal:
    """Desvio padrao amostral (n-1)."""
    vals = _dec_list(list(a))
    if len(vals) < 2:
        raise ErroVerif("desvpad exige ao menos 2 valores")
    m = _f_media(*vals)
    var = sum(((v - m) ** 2 for v in vals), Decimal(0)) / Decimal(len(vals) - 1)
    return var.sqrt()


def _f_arred(x: Decimal, casas: Decimal = Decimal(2)) -> Decimal:
    exp = Decimal(1).scaleb(-int(casas))
    return x.quantize(exp, rounding=ROUND_HALF_UP)


def _f_resto(a: Decimal, b: Decimal) -> Decimal:
    if b == 0:
        raise ErroVerif("resto por zero")
    return a - b * (a / b).to_integral_value(rounding="ROUND_FLOOR")


FUNCOES = {
    "soma": lambda *a: sum(_dec_list(list(a)), Decimal(0)),
    "media": _f_media,
    "mediana": _f_mediana,
    "desvpad": _f_desvpad,
    "minimo": lambda *a: min(_dec_list(list(a))),
    "maximo": lambda *a: max(_dec_list(list(a))),
    "modulo": lambda x: abs(x),
    "arred": _f_arred,
    "raiz": lambda x: x.sqrt(),
    "resto": _f_resto,
    # apelidos em ingles
    "sum": lambda *a: sum(_dec_list(list(a)), Decimal(0)),
    "mean": _f_media,
    "avg": _f_media,
    "median": _f_mediana,
    "stdev": _f_desvpad,
    "min": lambda *a: min(_dec_list(list(a))),
    "max": lambda *a: max(_dec_list(list(a))),
    "abs": lambda x: abs(x),
    "round": _f_arred,
    "sqrt": lambda x: x.sqrt(),
    "mod": _f_resto,
}


def _pre_expressao(expr: str) -> str:
    bruto = expr
    expr = expr.replace("R$", " ").replace(" ", " ")

    def _ptbr(m: re.Match) -> str:
        return m.group(0).replace(".", "").replace(",", ".")

    expr = RE_PTBR_COMPLETO.sub(_ptbr, expr)
    if RE_PONTO_MILHAR.search(expr):
        alvo = RE_PONTO_MILHAR.search(expr).group(0)
        raise ErroVerif(
            f"'{alvo}' e ambiguo em '{bruto}' (ponto de milhar sem decimais). "
            "Escreva 1234 ou 1234.00"
        )
    for m in re.finditer(r"%\s*(\S)", expr):
        if m.group(1).isalnum() or m.group(1) in "_(":
            raise ErroVerif(
                f"'%' em '{bruto}' e porcentagem, nao resto. "
                "Para resto da divisao use resto(a, b); para porcentagem escreva 10%."
            )
    expr = RE_PCT_LITERAL.sub(r"(\1/100)", expr)
    # virgula so pode existir como separador de argumentos, dentro de parenteses
    profundidade = 0
    for ch in expr:
        if ch == "(":
            profundidade += 1
        elif ch == ")":
            profundidade -= 1
        elif ch == "," and profundidade <= 0:
            raise ErroVerif(
                f"virgula solta em '{bruto}': use ponto como separador decimal "
                "(ex.: 1234.56). A virgula so separa argumentos de funcoes."
            )
    return expr


def avaliar(expr: str, rotulos: dict[str, Decimal]) -> Decimal:
    """Avalia expressao aritmetica em Decimal. Nomes viram rotulos do livro."""
    preparada = _pre_expressao(expr)
    try:
        arvore = ast.parse(preparada, mode="eval")
    except SyntaxError as exc:
        raise ErroVerif(f"expressao invalida: {expr} ({exc.msg})") from exc

    def visita(no: ast.AST) -> Decimal:
        if isinstance(no, ast.Expression):
            return visita(no.body)
        if isinstance(no, ast.Constant):
            if isinstance(no.value, bool) or not isinstance(no.value, (int, float)):
                raise ErroVerif(f"valor nao numerico na expressao: {no.value!r}")
            return Decimal(str(no.value))
        if isinstance(no, ast.UnaryOp):
            if isinstance(no.op, ast.UAdd):
                return visita(no.operand)
            if isinstance(no.op, ast.USub):
                return -visita(no.operand)
            raise ErroVerif("operador unario nao permitido")
        if isinstance(no, ast.BinOp):
            esq, dir_ = visita(no.left), visita(no.right)
            if isinstance(no.op, ast.Add):
                return esq + dir_
            if isinstance(no.op, ast.Sub):
                return esq - dir_
            if isinstance(no.op, ast.Mult):
                return esq * dir_
            if isinstance(no.op, ast.Div):
                if dir_ == 0:
                    raise ErroVerif("divisao por zero")
                return esq / dir_
            if isinstance(no.op, ast.Pow):
                return esq ** dir_
            if isinstance(no.op, ast.Mod):
                raise ErroVerif("'%' aqui e porcentagem; para resto use resto(a, b)")
            raise ErroVerif("operador nao permitido")
        if isinstance(no, ast.Name):
            if no.id in rotulos:
                return rotulos[no.id]
            disp = ", ".join(sorted(rotulos)) or "(nenhum)"
            raise ErroVerif(f"rotulo desconhecido: {no.id}. Registrados: {disp}")
        if isinstance(no, ast.Call):
            if not isinstance(no.func, ast.Name) or no.func.id not in FUNCOES:
                nome = getattr(no.func, "id", "?")
                raise ErroVerif(
                    f"funcao nao permitida: {nome}. Disponiveis: "
                    + ", ".join(sorted(FUNCOES))
                )
            if no.keywords:
                raise ErroVerif("argumentos nomeados nao sao aceitos")
            return FUNCOES[no.func.id](*[visita(a) for a in no.args])
        raise ErroVerif(f"trecho nao permitido na expressao: {type(no).__name__}")

    return visita(arvore)


def rotulos_de(dados: dict) -> dict[str, Decimal]:
    saida: dict[str, Decimal] = {}
    for e in dados["entradas"]:
        saida[e["rotulo"]] = Decimal(e["valor"])
    return saida


# --------------------------------------------------------------------------
# auditoria de rascunho: todo numero precisa de lastro
# --------------------------------------------------------------------------

MASCARAS = [
    re.compile(r"```.*?```", re.S),                  # bloco de codigo
    re.compile(r"`[^`\n]*`"),                        # codigo inline
    re.compile(r"\[[^\]]*\]\([^)]*\)"),              # link markdown
    re.compile(r"https?://\S+"),                     # URL
    re.compile(r"\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?"),  # data ISO
    re.compile(r"\d{1,2}/\d{1,2}(?:/\d{2,4})?"),     # data BR
    re.compile(r"\b\d{1,2}:\d{2}(?::\d{2})?\b"),     # hora
    re.compile(r"^\s{0,3}\d{1,3}[.)]\s", re.M),      # marcador de lista ordenada
    re.compile(r"#\d+\b"),                           # referencia tipo #123
    re.compile(r"\bv?\d+\.\d+\.\d+\b"),              # versao semver
]

RE_ANO = re.compile(r"(?<![\d.,])(?:19|20)\d{2}(?![\d%])(?![.,]\d)")

RE_NUMERO = re.compile(
    r"(?<![\w.,])"
    r"[-+]?"
    r"(?:"
    r"\d{1,3}(?:\.\d{3})+(?:,\d+)?"      # 1.234.567,89 ou 1.234
    r"|\d{1,3}(?:,\d{3})+(?:\.\d+)?"     # 1,234,567.89 ou 1,234
    r"|\d+(?:[.,]\d+)?"                  # 1234.56 / 1234,56 / 1234
    r")"
    r"%?"
    r"(?![\w])"
)


def _mascara_ano(m: re.Match) -> str:
    """Nao trate como ano o que vem logo depois de um cifrao (R$ 2024)."""
    antes = m.string[max(0, m.start() - 4) : m.start()]
    return m.group(0) if "$" in antes else " " * len(m.group(0))


def _mascarar(texto: str, ignorar_anos: bool) -> str:
    """Substitui trechos irrelevantes por espacos, preservando posicoes."""
    out = texto
    for pad in MASCARAS:
        out = pad.sub(lambda m: " " * len(m.group(0)), out)
    if ignorar_anos:
        out = RE_ANO.sub(_mascara_ano, out)
    return out


def candidatos_valor(token: str) -> list[Decimal]:
    """Interpretacoes plausiveis de um numero escrito em texto."""
    t = token.strip()
    pct = t.endswith("%")
    if pct:
        t = t[:-1]
    sinal = Decimal(-1) if t.startswith("-") else Decimal(1)
    t = t.lstrip("+-")
    vals: list[Decimal] = []

    def add(s: str) -> None:
        try:
            vals.append(Decimal(s))
        except InvalidOperation:
            pass

    if re.fullmatch(r"\d{1,3}(?:\.\d{3})+,\d+", t):
        add(t.replace(".", "").replace(",", "."))
    elif re.fullmatch(r"\d{1,3}(?:,\d{3})+\.\d+", t):
        add(t.replace(",", ""))
    elif re.fullmatch(r"\d{1,3}(?:\.\d{3})+", t):
        add(t.replace(".", ""))   # pt-BR: milhar
        add(t)                    # ingles: decimal
    elif re.fullmatch(r"\d{1,3}(?:,\d{3})+", t):
        add(t.replace(",", ""))
        add(t.replace(",", "."))
    elif re.fullmatch(r"\d+,\d+", t):
        add(t.replace(",", "."))
    else:
        add(t)

    saida = [sinal * v for v in vals]
    if pct:
        saida += [v / 100 for v in saida]
    return saida


def _casa(valor: Decimal, alvo: Decimal, token: str, tolerancia: Decimal) -> bool:
    if abs(valor - alvo) <= tolerancia:
        return True
    # o rascunho pode ter arredondado: compare na precisao com que foi escrito
    frac = re.search(r"[.,](\d+)", token)
    casas = len(frac.group(1)) if frac else 0
    try:
        return _f_arred(alvo, Decimal(casas)) == _f_arred(valor, Decimal(casas))
    except InvalidOperation:
        return False


def auditar_texto(
    texto: str,
    dados: dict,
    tolerancia: Decimal = Decimal("0.005"),
    ignorar_anos: bool = True,
    ignorar_regex: list[str] | None = None,
) -> dict:
    """Confere cada numero do texto contra o livro-razao."""
    mascarado = _mascarar(texto, ignorar_anos)
    for p in ignorar_regex or []:
        mascarado = re.compile(p).sub(lambda m: " " * len(m.group(0)), mascarado)

    entradas = dados["entradas"]
    alvos = [(e, Decimal(e["valor"])) for e in entradas]
    linhas = texto.splitlines()

    sem_lastro: list[dict] = []
    usados: dict[str, list[str]] = {}

    for m in RE_NUMERO.finditer(mascarado):
        token = m.group(0)
        valores = candidatos_valor(token)
        if not valores:
            continue
        linha_n = texto.count("\n", 0, m.start()) + 1
        achou = None
        for entrada, alvo in alvos:
            if any(_casa(v, alvo, token, tolerancia) for v in valores):
                achou = entrada
                break
        if achou is not None:
            usados.setdefault(achou["rotulo"], []).append(token)
            continue
        # numeros triviais de prosa (0, 1, 2...) nao sao alarme util
        if all(v == v.to_integral_value() and abs(v) <= 12 for v in valores):
            continue
        sem_lastro.append(
            {
                "token": token,
                "linha": linha_n,
                "trecho": (linhas[linha_n - 1].strip()[:120] if linha_n <= len(linhas) else ""),
                "proximos": _mais_proximos(valores[0], alvos),
            }
        )

    premissas = [
        e["rotulo"] for e in entradas if e["tipo"] == "premissa" and e["rotulo"] in usados
    ]
    recalc = recalcular(dados)
    return {
        "ok": not sem_lastro and recalc["ok"],
        "sem_lastro": sem_lastro,
        "rotulos_usados": usados,
        "premissas_no_texto": premissas,
        "recalculo": recalc,
        "total_numeros": len(usados) + len(sem_lastro),
    }


def _mais_proximos(valor: Decimal, alvos: list[tuple[dict, Decimal]], n: int = 2) -> list[str]:
    ordenados = sorted(alvos, key=lambda p: abs(p[1] - valor))[:n]
    return [f"{e['rotulo']}={fmt(v)}" for e, v in ordenados]


def recalcular(dados: dict) -> dict:
    """Reavalia toda entrada do tipo calculo e compara com o valor guardado."""
    rotulos: dict[str, Decimal] = {}
    divergencias: list[dict] = []
    for e in dados["entradas"]:
        guardado = Decimal(e["valor"])
        if e["tipo"] == "calculo" and e.get("expressao"):
            try:
                obtido = avaliar(e["expressao"], rotulos)
            except ErroVerif as exc:
                divergencias.append(
                    {"rotulo": e["rotulo"], "erro": str(exc), "guardado": e["valor"]}
                )
                rotulos[e["rotulo"]] = guardado
                continue
            if obtido != guardado:
                divergencias.append(
                    {
                        "rotulo": e["rotulo"],
                        "expressao": e["expressao"],
                        "guardado": fmt(guardado),
                        "recalculado": fmt(obtido),
                    }
                )
        rotulos[e["rotulo"]] = guardado
    return {"ok": not divergencias, "divergencias": divergencias}


# --------------------------------------------------------------------------
# operacoes sobre o livro
# --------------------------------------------------------------------------

TIPOS = ("calculo", "fato", "premissa")


def novo_livro(titulo: str) -> dict:
    return {
        "versao": VERSAO_ESQUEMA,
        "titulo": titulo,
        "criada_em": agora(),
        "status": "aberta",
        "bloqueios": 0,
        "entradas": [],
        "contra": [],
        "auditorias": [],
        "falseador": None,
    }


def validar_rotulo(rotulo: str, dados: dict) -> None:
    if not RE_ROTULO.fullmatch(rotulo):
        raise ErroVerif(
            f"rotulo invalido: '{rotulo}'. Use letras, numeros e _ (comecando por letra)."
        )
    if rotulo in FUNCOES:
        raise ErroVerif(f"'{rotulo}' e nome de funcao; escolha outro rotulo")
    if any(e["rotulo"] == rotulo for e in dados["entradas"]):
        raise ErroVerif(f"rotulo ja usado: {rotulo}")


def add_entrada(dados: dict, **campos) -> dict:
    entrada = {"id": len(dados["entradas"]) + 1, "em": agora(), **campos}
    dados["entradas"].append(entrada)
    return entrada


# --------------------------------------------------------------------------
# relatorios
# --------------------------------------------------------------------------

MARCA = {"calculo": "CALCULADO", "fato": "VERIFICADO", "premissa": "PREMISSA"}


def texto_status(caminho: Path, dados: dict) -> str:
    por_tipo = {t: 0 for t in TIPOS}
    for e in dados["entradas"]:
        por_tipo[e["tipo"]] = por_tipo.get(e["tipo"], 0) + 1
    ult = dados["auditorias"][-1] if dados["auditorias"] else None
    linhas = [
        f"analise: {dados['titulo']}  [{dados['status']}]",
        f"arquivo: {caminho}",
        "entradas: "
        + ", ".join(f"{MARCA[t].lower()}={por_tipo.get(t, 0)}" for t in TIPOS),
        f"contra-analises: {len(dados['contra'])}",
        "ultima auditoria: "
        + (f"{'OK' if ult['ok'] else 'FALHOU'} em {ult['em']}" if ult else "nenhuma"),
    ]
    if dados.get("falseador"):
        linhas.append(f"falseador: {dados['falseador']}")
    return "\n".join(linhas)


def texto_relatorio(dados: dict) -> str:
    linhas = [
        f"# Procedencia dos numeros - {dados['titulo']}",
        "",
        "| Rotulo | Valor | Origem | Como foi obtido |",
        "| --- | --- | --- | --- |",
    ]
    for e in dados["entradas"]:
        como = e.get("expressao") or e.get("fonte") or e.get("justificativa") or "-"
        como = str(como).replace("|", "\\|")
        linhas.append(
            f"| `{e['rotulo']}` | {fmt(Decimal(e['valor']))} | {MARCA[e['tipo']]} | {como} |"
        )
    if dados["contra"]:
        linhas += ["", "## Contra-analise", ""]
        for c in dados["contra"]:
            linhas.append(
                f"- **{c['afirmacao']}** -> teste: {c['teste']} -> resultado: "
                f"{c['resultado']} -> **{c['veredito'].upper()}**"
            )
    if dados.get("falseador"):
        linhas += ["", f"**O que mudaria esta conclusao:** {dados['falseador']}"]
    premissas = [e for e in dados["entradas"] if e["tipo"] == "premissa"]
    if premissas:
        linhas += ["", "## Premissas (nao verificadas)", ""]
        for e in premissas:
            linhas.append(
                f"- `{e['rotulo']}` = {fmt(Decimal(e['valor']))} - {e.get('justificativa', '')}"
            )
    return "\n".join(linhas)


def texto_auditoria(res: dict) -> str:
    linhas = []
    if res["sem_lastro"]:
        linhas.append(f"{len(res['sem_lastro'])} numero(s) SEM LASTRO no rascunho:")
        for s in res["sem_lastro"]:
            linhas.append(f"  linha {s['linha']}: '{s['token']}'  |  {s['trecho']}")
            if s["proximos"]:
                linhas.append(f"      mais proximos no livro: {', '.join(s['proximos'])}")
    if not res["recalculo"]["ok"]:
        linhas.append("RECALCULO DIVERGENTE:")
        for d in res["recalculo"]["divergencias"]:
            if "erro" in d:
                linhas.append(f"  {d['rotulo']}: {d['erro']}")
            else:
                linhas.append(
                    f"  {d['rotulo']}: guardado {d['guardado']} != recalculado "
                    f"{d['recalculado']}  ({d['expressao']})"
                )
    if res["premissas_no_texto"]:
        linhas.append(
            "premissas citadas no texto (rotule-as explicitamente): "
            + ", ".join(res["premissas_no_texto"])
        )
    if res["ok"]:
        linhas.append(
            f"OK: {res['total_numeros']} numero(s) com origem registrada; recalculo confere."
        )
    return "\n".join(linhas) if linhas else "OK"


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def _ler_rascunho(arg: str) -> str:
    if arg == "-":
        return sys.stdin.read()
    p = Path(arg)
    if p.is_file():
        return p.read_text(encoding="utf-8", errors="replace")
    return arg  # texto literal


def cmd_abrir(args) -> int:
    base = dir_analises(args.dir)
    existente = livro_aberto(base)
    if existente and not args.forcar:
        raise ErroVerif(
            f"ja existe analise aberta: '{existente[1]['titulo']}' ({existente[0]}). "
            "Feche com 'verif fechar' ou use --forcar."
        )
    if existente and args.forcar:
        c, d = existente
        d["status"] = "abandonada"
        salvar(c, d)
    dados = novo_livro(args.titulo)
    caminho = base / f"{_slug(args.titulo)}.json"
    n = 2
    while caminho.exists():
        caminho = base / f"{_slug(args.titulo)}-{n}.json"
        n += 1
    salvar(caminho, dados)
    print(f"analise aberta: {caminho}")
    return 0


def cmd_calc(args) -> int:
    base = dir_analises(args.dir)
    caminho, dados = exigir_aberto(base)
    validar_rotulo(args.rotulo, dados)
    valor = avaliar(args.expressao, rotulos_de(dados))
    if args.casas is not None:
        valor = _f_arred(valor, Decimal(args.casas))
    add_entrada(
        dados,
        rotulo=args.rotulo,
        tipo="calculo",
        valor=str(valor),
        expressao=args.expressao if args.casas is None else f"arred({args.expressao}, {args.casas})",
        fonte=args.fonte or "",
    )
    salvar(caminho, dados)
    print(f"{args.rotulo} = {fmt(valor)}")
    return 0


def cmd_fato(args) -> int:
    base = dir_analises(args.dir)
    caminho, dados = exigir_aberto(base)
    validar_rotulo(args.rotulo, dados)
    if not args.fonte.strip():
        raise ErroVerif("um fato exige --fonte (arquivo:linha, query, URL ou 'usuario: ...')")
    valor = para_decimal(args.valor)
    add_entrada(
        dados,
        rotulo=args.rotulo,
        tipo="fato",
        valor=str(valor),
        fonte=args.fonte,
        evidencia=args.evidencia or "",
    )
    salvar(caminho, dados)
    print(f"{args.rotulo} = {fmt(valor)}  (fonte: {args.fonte})")
    return 0


def cmd_premissa(args) -> int:
    base = dir_analises(args.dir)
    caminho, dados = exigir_aberto(base)
    validar_rotulo(args.rotulo, dados)
    if not args.justificativa.strip():
        raise ErroVerif("uma premissa exige --justificativa")
    valor = para_decimal(args.valor)
    add_entrada(
        dados,
        rotulo=args.rotulo,
        tipo="premissa",
        valor=str(valor),
        justificativa=args.justificativa,
    )
    salvar(caminho, dados)
    print(f"{args.rotulo} = {fmt(valor)}  (PREMISSA - sera rotulada na entrega)")
    return 0


def cmd_contra(args) -> int:
    base = dir_analises(args.dir)
    caminho, dados = exigir_aberto(base)
    if args.veredito not in ("sustenta", "refuta", "inconclusivo"):
        raise ErroVerif("veredito deve ser: sustenta | refuta | inconclusivo")
    for campo, valor in (("afirmacao", args.afirmacao), ("teste", args.teste), ("resultado", args.resultado)):
        if not valor.strip():
            raise ErroVerif(f"--{campo} nao pode ser vazio")
    dados["contra"].append(
        {
            "id": len(dados["contra"]) + 1,
            "em": agora(),
            "afirmacao": args.afirmacao,
            "teste": args.teste,
            "resultado": args.resultado,
            "veredito": args.veredito,
        }
    )
    salvar(caminho, dados)
    print(f"contra-analise #{len(dados['contra'])} registrada: {args.veredito}")
    return 0


def cmd_auditar(args) -> int:
    base = dir_analises(args.dir)
    caminho, dados = exigir_aberto(base)
    texto = _ler_rascunho(args.rascunho)
    res = auditar_texto(
        texto,
        dados,
        tolerancia=Decimal(args.tolerancia),
        ignorar_anos=not args.anos,
        ignorar_regex=args.ignorar,
    )
    dados["auditorias"].append(
        {
            "em": agora(),
            "origem": args.rascunho if args.rascunho != "-" else "(stdin)",
            "ok": res["ok"],
            "sem_lastro": [s["token"] for s in res["sem_lastro"]],
        }
    )
    if res["ok"]:
        dados["bloqueios"] = 0  # auditoria limpa zera o contador do hook Stop
    salvar(caminho, dados)
    if args.json:
        print(json.dumps(res, ensure_ascii=False, default=str, indent=2))
    else:
        print(texto_auditoria(res))
    return 0 if res["ok"] else 1


def cmd_status(args) -> int:
    base = dir_analises(args.dir)
    aberto = livro_aberto(base)
    if aberto is None:
        print(f"nenhuma analise aberta em {base}")
        return 1
    print(texto_status(*aberto))
    return 0


def cmd_listar(args) -> int:
    base = dir_analises(args.dir)
    encontrados = caminhos_livros(base)
    if not encontrados:
        print(f"nenhum livro-razao em {base}")
        return 1
    for c in encontrados:
        try:
            d = carregar(c)
        except ErroVerif:
            continue
        print(f"{d.get('status', '?'):<12} {d.get('titulo', '?')}  ({c.name})")
    return 0


def cmd_relatorio(args) -> int:
    base = dir_analises(args.dir)
    atual = livro_atual(base)
    if atual is None:
        raise ErroVerif(f"nenhum livro-razao em {base}")
    dados = atual[1]
    texto = texto_relatorio(dados)
    if args.saida:
        Path(args.saida).write_text(texto + "\n", encoding="utf-8")
        print(f"relatorio escrito em {args.saida}")
    else:
        print(texto)
    return 0


def cmd_fechar(args) -> int:
    base = dir_analises(args.dir)
    caminho, dados = exigir_aberto(base)
    faltas = []
    recalc = recalcular(dados)
    if not recalc["ok"]:
        faltas.append("recalculo diverge do que esta guardado (rode 'verif auditar')")
    ults = dados["auditorias"]
    if not ults:
        faltas.append("nenhuma auditoria de rascunho (rode 'verif auditar <arquivo>')")
    elif not ults[-1]["ok"]:
        faltas.append(f"ultima auditoria falhou: {', '.join(ults[-1]['sem_lastro']) or 'ver detalhes'}")
    if not dados["contra"]:
        faltas.append("nenhuma contra-analise registrada (rode 'verif contra ...')")
    if not (args.falseador or "").strip():
        faltas.append("--falseador obrigatorio: o que mudaria esta conclusao?")
    if faltas and not args.forcar:
        print("nao posso fechar; falta:", file=sys.stderr)
        for f in faltas:
            print(f"  - {f}", file=sys.stderr)
        return 1
    dados["status"] = "fechada"
    dados["fechada_em"] = agora()
    dados["falseador"] = args.falseador
    if faltas:
        dados["fechada_forcada"] = faltas
    salvar(caminho, dados)
    print("analise fechada" + (" (FORCADA, com pendencias)" if faltas else ""))
    return 0


def construir_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="verif", description=__doc__.splitlines()[0])
    p.add_argument("--dir", help="pasta dos livros-razao (padrao: ./.analise)")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("abrir", help="abre uma analise")
    s.add_argument("titulo")
    s.add_argument("--forcar", action="store_true", help="abandona a analise aberta atual")
    s.set_defaults(func=cmd_abrir)

    s = sub.add_parser("calc", help="calcula e registra (unica forma de criar numero novo)")
    s.add_argument("expressao")
    s.add_argument("--rotulo", required=True)
    s.add_argument("--casas", type=int, help="arredonda o resultado para N casas")
    s.add_argument("--fonte", help="de onde vieram os insumos")
    s.set_defaults(func=cmd_calc)

    s = sub.add_parser("fato", help="registra valor com fonte citavel")
    s.add_argument("--rotulo", required=True)
    s.add_argument("--valor", required=True)
    s.add_argument("--fonte", required=True)
    s.add_argument("--evidencia", help="comando/consulta que reproduz o valor")
    s.set_defaults(func=cmd_fato)

    s = sub.add_parser("premissa", help="registra estimativa assumida")
    s.add_argument("--rotulo", required=True)
    s.add_argument("--valor", required=True)
    s.add_argument("--justificativa", required=True)
    s.set_defaults(func=cmd_premissa)

    s = sub.add_parser("contra", help="registra uma tentativa de derrubar a conclusao")
    s.add_argument("--afirmacao", required=True)
    s.add_argument("--teste", required=True)
    s.add_argument("--resultado", required=True)
    s.add_argument("--veredito", required=True, help="sustenta | refuta | inconclusivo")
    s.set_defaults(func=cmd_contra)

    s = sub.add_parser("auditar", help="confere os numeros de um rascunho")
    s.add_argument("rascunho", help="arquivo, '-' para stdin, ou o texto literal")
    s.add_argument("--tolerancia", default="0.005")
    s.add_argument("--anos", action="store_true", help="tambem auditar numeros tipo 2026")
    s.add_argument("--ignorar", action="append", help="regex extra a ignorar (repetivel)")
    s.add_argument("--json", action="store_true")
    s.set_defaults(func=cmd_auditar)

    s = sub.add_parser("status", help="resumo da analise aberta")
    s.set_defaults(func=cmd_status)

    s = sub.add_parser("listar", help="lista os livros-razao")
    s.set_defaults(func=cmd_listar)

    s = sub.add_parser("relatorio", help="tabela de procedencia em markdown")
    s.add_argument("--saida")
    s.set_defaults(func=cmd_relatorio)

    s = sub.add_parser("fechar", help="fecha a analise (exige auditoria + contra-analise)")
    s.add_argument("--falseador", required=True, help="o que mudaria esta conclusao")
    s.add_argument("--forcar", action="store_true", help="fecha com pendencias, registrando-as")
    s.set_defaults(func=cmd_fechar)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = construir_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except ErroVerif as exc:
        print(f"verif: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
