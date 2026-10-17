#!/usr/bin/env python3
"""Os quatro testes de transformador de serviço auxiliar.

Um transformador de serviço auxiliar alimenta um religador ou um regulador. Não é carga
de cliente e fica FORA do indicador de queima. O cadastro não identifica isso — o campo
`Uso` do FIS vem "Distribuição" em 100% dos registros, inclusive nos de prefixo 51 —
então a identificação é por regra, e nenhum teste sozinho basta.

Ver references/codigos.md para o porquê de cada teste e para os falsos positivos
conhecidos ("regulador do tap", QTD_CLIENTES=0, furto).

Linha de comando:

    python3 auxiliar.py --ss-os BASE_SS_OS_*.txt --mes 2026-08 \
        [--critica Critica_*.txt] [--fis fis_trafos.json] [--origem QUEIMADO AVARIADO]

Devolve a lista de suspeitos com o motivo, e a taxa de disparo entre os transformadores
comuns do mesmo recorte — que é como você sabe se o teste está discriminando.
"""
import argparse
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bases import (ler_ss_os, ler_critica, indexar, data, texto,   # noqa: E402
                   universo_de_codigos, PREFIXO_TRAFO)

RE_TEXTO = re.compile(r'auxiliar|religador|regulador|\bRL\b', re.I)


def espelhos(codigo):
    """Códigos que um auxiliar deste ponto teria: 79/58 com os mesmos 8 dígitos finais.

    A regra confirmada é: auxiliar = prefixo 51 OU 57 + os 8 dígitos finais do religador
    (79) ou do regulador (58). Ela NÃO generaliza para "mesmos 8 finais = mesmo ponto":
    isso só vale para chave faca 80/90.
    """
    f8 = codigo[2:]
    return ['79' + f8, '58' + f8]


def testar(codigo, textos, universo, fis=None):
    """Aplica os quatro testes. Devolve lista de motivos (vazia = não é auxiliar)."""
    motivos = []

    if codigo.startswith('51'):
        motivos.append('prefixo 51 (serviço auxiliar)')

    achados = [e for e in espelhos(codigo) if e in universo]
    if achados:
        motivos.append('espelha ' + ', '.join(achados))

    for t in textos:
        m = RE_TEXTO.search(t or '')
        if m:
            # "regulador do tap" é o comutador do próprio trafo, não um ativo regulador
            ctx = t[max(0, m.start() - 20): m.end() + 20].lower()
            if 'tap' in ctx and 'regulador' in m.group(0).lower():
                continue
            motivos.append('texto cita "%s"' % m.group(0))
            break

    if fis:
        try:
            px, py = float(fis['Primary Location X']), float(fis['Primary Location Y'])
            sx, sy = float(fis['Secondary Location X']), float(fis['Secondary Location Y'])
            if abs(px - sx) < 0.01 and abs(py - sy) < 0.01:
                motivos.append('sem rede BT própria no cadastro')
        except (KeyError, TypeError, ValueError):
            pass

    return motivos


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--ss-os', nargs='+', required=True)
    p.add_argument('--critica', nargs='*', default=[])
    p.add_argument('--fis', help='json {codigo: [campos do cadastro]} de kmz_fis.py')
    p.add_argument('--mes', help='recorte AAAA-MM (default: todos)')
    p.add_argument('--origem', nargs='*', default=['QUEIMADO', 'AVARIADO'],
                   help='prefixos de ORIGEM_SS do universo; "TODAS" para não filtrar')
    p.add_argument('--json', help='salvar o resultado neste caminho')
    a = p.parse_args()

    cab, regs = ler_ss_os(*a.ss_os)
    i = indexar(cab)
    g = lambda r, k: texto(r[i[k]]) if k in i else ''

    critica = ler_critica(*a.critica) if a.critica else []
    fis = json.load(open(a.fis)) if a.fis else {}

    universo = universo_de_codigos((cab, regs), critica, extras=[fis] if fis else [])
    print('universo de códigos conhecidos: %d' % len(universo), file=sys.stderr)

    recorte, comuns = {}, []
    for r in regs:
        cod = g(r, 'NUM_TRAFO')
        if cod[:2] not in PREFIXO_TRAFO:
            continue
        if a.mes:
            d = data(g(r, 'DATA_ABERTURA_SS'))
            if not d or d.strftime('%Y-%m') != a.mes:
                continue
        origem = g(r, 'ORIGEM_SS').upper()
        if 'TODAS' not in [o.upper() for o in a.origem]:
            if not any(origem.startswith(o.upper()) for o in a.origem):
                continue
        recorte.setdefault(cod, []).append(r)

    suspeitos = []
    for cod, rs in recorte.items():
        textos = [g(r, 'DESCRIPTION_SS') + ' ' + g(r, 'DESCRICAO_OS') for r in rs]
        f = (fis.get(cod) or [None])[0] if fis else None
        motivos = testar(cod, textos, universo, f)
        if motivos:
            suspeitos.append({
                'codigo': cod, 'motivos': motivos,
                'ss': [g(r, 'NUMERO_SS') for r in rs],
                'origem': g(rs[0], 'ORIGEM_SS'), 'defeito': g(rs[0], 'DEFEITO_SS'),
                'localidade': g(rs[0], 'LOCALIDADE'),
                'abertura': g(rs[0], 'DATA_ABERTURA_SS'),
                'clientes': g(rs[0], 'QTD_CLIENTES'),
                'texto': ' '.join(textos[0].split())[:400]})
        else:
            comuns.append(cod)

    # calibração: com que frequência o espelho dispara num trafo comum?
    base = [c for c in universo if c.startswith('57')]
    disparos = sum(1 for c in base if any(e in universo for e in espelhos(c)))
    taxa = 100.0 * disparos / len(base) if base else 0.0

    print()
    print('recorte: %d SS · %d ativos distintos'
          % (sum(len(v) for v in recorte.values()), len(recorte)))
    print('suspeitos de auxiliar: %d' % len(suspeitos))
    for s in suspeitos:
        print()
        print('  %s · %s · %s / %s · %s' % (s['codigo'], s['localidade'],
                                            s['origem'], s['defeito'], s['abertura']))
        print('    SS: %s' % ', '.join(s['ss']))
        for m in s['motivos']:
            print('    → %s' % m)
        print('    texto: %s' % s['texto'][:220])
    print()
    print('calibração do teste de espelho: %d de %d trafos 57 do universo (%.2f%%) '
          'têm religador/regulador espelho. Se essa taxa for alta, o teste não está '
          'discriminando e o universo provavelmente está pequeno demais.'
          % (disparos, len(base), taxa))
    print()
    print('LEMBRETE: achado de auxiliar não recalcula indicador fechado. Se o mês ainda '
          'está aberto, isto é aviso antes de fechar.')

    if a.json:
        json.dump(suspeitos, open(a.json, 'w'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    main()
