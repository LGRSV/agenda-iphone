#!/usr/bin/env python3
"""Tabela 03 da NDU-002: dimensionamento de elo fusível.

A distinção que muda a conclusão: existem DOIS elos, e eles respondem a perguntas
diferentes.

  - o elo que ESTAVA  → cadastro FIS, `Capacidade Elo Fusivel Lado Carga`/`Lado Fonte`
                        "a proteção do ponto estava dimensionada certo antes de queimar?"
  - o elo que ENTROU  → SS/OS, `QUAL_ELO_INSTALADO_NO_LOCAL`
                        "a equipe deixou o ponto certo depois do atendimento?"

Reportar só um produz conclusão invertida: num recorte de julho/2026 o elo que entrou
estava superdimensionado em 29 casos, enquanto o elo que estava era conforme em 30 de
38. Sempre julgue os dois e mostre lado a lado.

Uso como biblioteca:

    from elo_ndu002 import exigido, julgar, comparar
    reg, ctx = exigido(pot='15', tensao='19,9 KV', fase='A')
    veredito = julgar(elo='1H', pot='15', tensao='19,9 KV', fase='A')

Uso como comando:

    python3 elo_ndu002.py --pot 15 --tensao "19,9 KV" --fase A --elo 1H
    python3 elo_ndu002.py --tabela
"""
import argparse
import re

# Monofásico: a coluna é a tensão FASE-TERRA (7,9 em rede 13,8; 19,9 em rede 34,5)
MONO = {'5':   {'7.9': '0,5H', '19.9': '0,5H'},
        '10':  {'7.9': '1H',   '19.9': '0,5H'},
        '15':  {'7.9': '2H',   '19.9': '1H'},
        '25':  {'7.9': '3H',   '19.9': '2H'}}

# Trifásico: a coluna é a tensão de LINHA
TRI = {'15':    {'13.8': '0,5H', '34.5': '0,5H'},
       '30':    {'13.8': '1H',   '34.5': '0,5H'},
       '45':    {'13.8': '2H',   '34.5': '1H'},
       '75':    {'13.8': '3H',   '34.5': '1H'},
       '112.5': {'13.8': '5H',   '34.5': '2H'},
       '150':   {'13.8': '6K',   '34.5': '3H'},
       '225':   {'13.8': '10K',  '34.5': '5H'},
       '300':   {'13.8': '12K',  '34.5': '5H'}}

ORDEM = ['0,5H', '1H', '2H', '3H', '5H', '3K', '6K', '8K', '10K',
         '12K', '15K', '25K', '30K', '40K', '50K', '100K']
RANK = {e: n for n, e in enumerate(ORDEM)}


def _num(s):
    s = (s or '').replace(',', '.')
    m = re.search(r'[\d.]+', s)
    return m.group(0).rstrip('.') if m else ''


def normaliza_elo(e):
    """'0.5H', '0,5 H', '00H' → forma canônica ou '' se não reconhecido."""
    e = (e or '').upper().replace(' ', '').replace('.', ',')
    e = re.sub(r'^0+(?=\d)', '', e)
    return e if e in RANK else ''


def trifasico(fase):
    """Trifásico se as três fases estão declaradas. 'ABC' sim, 'A' ou 'C' não."""
    return len(set((fase or '').upper()) & set('ABC')) >= 3


def rede(tensao):
    """Descobre a classe da rede: '13.8' ou '34.5'.

    O valor que chega pode ser a tensão de LINHA (13,8 / 34,5 — como vem do cadastro
    FIS) ou a tensão FASE-TERRA (7,9 / 7,967 / 19,9 / 19,919 — como costuma vir escrita
    no texto de campo e na especificação). As duas descrevem a mesma rede, e confundi-las
    joga o caso na coluna errada da tabela. Por isso a decisão é por proximidade a um
    valor conhecido, não por um corte em 20 kV.
    """
    t = _num(tensao)
    if not t:
        return ''
    v = float(t)
    conhecidos = [(7.9, '13.8'), (7.967, '13.8'), (13.8, '13.8'),
                  (19.9, '34.5'), (19.919, '34.5'), (34.5, '34.5')]
    alvo, dist = '', None
    for ref, classe in conhecidos:
        d = abs(v - ref)
        if dist is None or d < dist:
            alvo, dist = classe, d
    # tolerância generosa: 13,2 e 34,4 aparecem; 2,3 kV não é rede de distribuição daqui
    return alvo if dist <= 2.0 else ''


def exigido(pot, tensao, fase):
    """Devolve (elo_da_tabela, contexto). elo vazio = combinação não tabelada."""
    p = _num(pot)
    r = rede(tensao)
    if not r:
        return '', 'tensão ausente ou fora das classes 13,8 / 34,5 — não dá para julgar'
    if trifasico(fase):
        return TRI.get(p, {}).get(r, ''), 'trifásico %s kV' % r
    col = '7.9' if r == '13.8' else '19.9'
    return MONO.get(p, {}).get(col, ''), 'monofásico %s kV fase-terra (rede %s)' % (col, r)


def julgar(elo, pot, tensao, fase):
    """Devolve dict com veredito, elo normalizado, elo exigido e contexto."""
    e = normaliza_elo(elo)
    reg, ctx = exigido(pot, tensao, fase)
    if not e:
        v = 'SEM ELO' if not (elo or '').strip() else 'ELO NÃO RECONHECIDO'
    elif not reg:
        v = 'FORA DA TABELA 03'
    elif e == reg:
        v = 'CONFORME'
    elif RANK[e] > RANK[reg]:
        v = 'SUPERDIMENSIONADO'
    else:
        v = 'SUBDIMENSIONADO'
    return {'veredito': v, 'elo': e or (elo or '').strip(),
            'exigido': reg, 'contexto': ctx}


def comparar(elo_cadastrado, elo_instalado, pot, tensao, fase):
    """Julga os dois elos e diz a direção da troca. É esta a saída que se reporta."""
    a = julgar(elo_cadastrado, pot, tensao, fase)
    b = julgar(elo_instalado, pot, tensao, fase)
    ka, kb = normaliza_elo(elo_cadastrado), normaliza_elo(elo_instalado)
    if not (ka and kb):
        d = 'sem par comparável'
    elif ka == kb:
        d = 'entrou igual ao cadastrado'
    else:
        d = 'subiu' if RANK[kb] > RANK[ka] else 'desceu'
    return {'estava': a, 'entrou': b, 'mudanca': d}


def _tabela():
    print('MONOFÁSICO (coluna = tensão fase-terra)')
    print('  %-8s %-10s %s' % ('kVA', '7,9 kV', '19,9 kV'))
    for k, v in MONO.items():
        print('  %-8s %-10s %s' % (k, v['7.9'], v['19.9']))
    print()
    print('TRIFÁSICO (coluna = tensão de linha)')
    print('  %-8s %-10s %s' % ('kVA', '13,8 kV', '34,5 kV'))
    for k, v in TRI.items():
        print('  %-8s %-10s %s' % (k, v['13.8'], v['34.5']))
    print()
    print('ordem crescente: ' + ' · '.join(ORDEM))
    print()
    print('Fonte: NDU-002 Tabela 03 (v5.1/2018 e v5.2/2019 idênticas).')


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--tabela', action='store_true')
    p.add_argument('--pot')
    p.add_argument('--tensao')
    p.add_argument('--fase')
    p.add_argument('--elo', help='o elo a julgar')
    p.add_argument('--elo-cadastrado')
    p.add_argument('--elo-instalado')
    a = p.parse_args()
    if a.tabela or not a.pot:
        _tabela()
    elif a.elo_cadastrado or a.elo_instalado:
        r = comparar(a.elo_cadastrado, a.elo_instalado, a.pot, a.tensao, a.fase)
        print('contexto: %s · régua: %s' % (r['estava']['contexto'],
                                            r['estava']['exigido'] or '—'))
        print('estava %-6s → %s' % (r['estava']['elo'] or '—', r['estava']['veredito']))
        print('entrou %-6s → %s' % (r['entrou']['elo'] or '—', r['entrou']['veredito']))
        print('mudança: %s' % r['mudanca'])
    else:
        r = julgar(a.elo, a.pot, a.tensao, a.fase)
        print('%s · %s · régua %s' % (r['veredito'], r['contexto'], r['exigido'] or '—'))
