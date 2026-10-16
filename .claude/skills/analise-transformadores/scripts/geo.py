#!/usr/bin/env python3
"""Coordenadas, distância e vizinhança.

COORD_X / COORD_Y da SS/OS são UTM zona 22S, SIRGAS 2000 — EPSG:31982. Não são graus.
A conversão aqui é implementada à mão para não depender de pyproj; confere com pyproj
dentro de ~1 m, o que é bem abaixo da precisão do cadastro.

A régua de vizinhança é a que o dono definiu:
  urbano — os 4 ativos mais próximos, até 100 m
  rural  — os 100 ativos mais próximos, até 1.000 m
  janela — no máximo 7 dias antes e 7 dias depois do evento

Uso:
    from geo import utm_para_latlon, distancia, vizinhos
    lat, lon = utm_para_latlon(786367.5, 8942135.2)
    vz = vizinhos(alvo=(lat, lon), pontos={'0301234567': (la, lo), ...}, rural=False)
"""
import argparse
import math
import re

# WGS84 / SIRGAS2000 — para esta finalidade os dois são equivalentes (< 1 m)
_A = 6378137.0
_F = 1 / 298.257222101
_K0 = 0.9996
_FALSE_E = 500000.0
_FALSE_N = 10000000.0     # hemisfério sul
_ZONA_22_MERIDIANO = -51.0


def utm_para_latlon(x, y, meridiano_central=_ZONA_22_MERIDIANO, sul=True):
    """UTM 22S (EPSG:31982) → graus decimais."""
    e2 = _F * (2 - _F)
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    x = x - _FALSE_E
    if sul:
        y = y - _FALSE_N
    m = y / _K0
    mu = m / (_A * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256))
    phi1 = (mu
            + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * math.sin(2 * mu)
            + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * math.sin(4 * mu)
            + (151 * e1 ** 3 / 96) * math.sin(6 * mu))
    c1 = (e2 / (1 - e2)) * math.cos(phi1) ** 2
    t1 = math.tan(phi1) ** 2
    n1 = _A / math.sqrt(1 - e2 * math.sin(phi1) ** 2)
    r1 = _A * (1 - e2) / (1 - e2 * math.sin(phi1) ** 2) ** 1.5
    d = x / (n1 * _K0)
    lat = phi1 - (n1 * math.tan(phi1) / r1) * (
        d ** 2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1 ** 2 - 9 * e2 / (1 - e2)) * d ** 4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1 ** 2 - 252 * e2 / (1 - e2)
           - 3 * c1 ** 2) * d ** 6 / 720)
    lon = (d
           - (1 + 2 * t1 + c1) * d ** 3 / 6
           + (5 - 2 * c1 + 28 * t1 - 3 * c1 ** 2 + 8 * e2 / (1 - e2)
              + 24 * t1 ** 2) * d ** 5 / 120) / math.cos(phi1)
    return math.degrees(lat), meridiano_central + math.degrees(lon)


def distancia(a, b):
    """Metros entre dois (lat, lon) em graus decimais."""
    la1, lo1 = a
    la2, lo2 = b
    r = 6371000.0
    p = math.radians
    h = (math.sin(p(la2 - la1) / 2) ** 2
         + math.cos(p(la1)) * math.cos(p(la2)) * math.sin(p(lo2 - lo1) / 2) ** 2)
    return 2 * r * math.asin(math.sqrt(h))


def vizinhos(alvo, pontos, rural=False, excluir=()):
    """Vizinhos pela régua do dono. Devolve [(codigo, metros), ...] já ordenado.

    urbano: 4 mais próximos até 100 m · rural: 100 mais próximos até 1.000 m
    """
    limite, quantos = (1000.0, 100) if rural else (100.0, 4)
    fora = set(excluir)
    d = [(c, distancia(alvo, p)) for c, p in pontos.items() if c not in fora]
    d = [x for x in d if x[1] <= limite]
    d.sort(key=lambda x: x[1])
    return d[:quantos]


def coordenada_do_kml(texto, codigo):
    """Coordenada de um ativo num KML de circuito, pulando pasta ET_ vazia.

    A armadilha: 8.623 pastas `ET_<código>` do acervo estão vazias (ativo sem rede BT
    própria). Quem procura a coordenada logo depois do marcador pega, nesses casos, a do
    ativo SEGUINTE — e o resultado parece plausível. Consertar isso levou a validação
    KML × SS/OS de mediana 17 m para 4 m.
    """
    marca = '<name>ET_%s</name>' % codigo
    pos = texto.find(marca)
    if pos < 0:
        return None
    resto = texto[pos + len(marca): pos + len(marca) + 200]
    if re.match(r'\s*</Folder>', resto):
        return None                     # pasta vazia: este ativo não tem ponto aqui
    m = re.search(r'<coordinates>\s*([-0-9.]+),([-0-9.]+)',
                  texto, pos=pos, endpos=pos + 4000)
    return (float(m.group(2)), float(m.group(1))) if m else None


def link_maps(lat, lon):
    """Link do Google Maps que cai com alfinete. Só `/@lat,lon` centraliza sem marcar."""
    return ('https://www.google.com/maps/place/%.6f,%.6f/@%.6f,%.6f,300m/data=!3m1!1e3'
            % (lat, lon, lat, lon))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--utm', nargs=2, type=float, metavar=('X', 'Y'))
    p.add_argument('--dist', nargs=4, type=float,
                   metavar=('LAT1', 'LON1', 'LAT2', 'LON2'))
    a = p.parse_args()
    if a.utm:
        lat, lon = utm_para_latlon(*a.utm)
        print('%.7f, %.7f' % (lat, lon))
        print(link_maps(lat, lon))
    elif a.dist:
        print('%.1f m' % distancia((a.dist[0], a.dist[1]), (a.dist[2], a.dist[3])))
    else:
        p.print_help()
