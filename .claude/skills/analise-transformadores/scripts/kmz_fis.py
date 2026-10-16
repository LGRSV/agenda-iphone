#!/usr/bin/env python3
"""Cadastro FIS: varrer a árvore KMZ da rede de distribuição e extrair os campos.

A árvore no Drive é `dados / SE_<subestação> / <alimentador> / <camada>.kmz` — cerca de
111 subestações e 721 alimentadores, com cinco camadas por circuito: Postes,
Transformadores, Vaos_MT, Equipamentos_de_isolacao, Iluminacao_publica.

DUAS VIAS DE DOWNLOAD, e a diferença entre elas é de ordens de grandeza:

  pasta PÚBLICA  → curl, custo de contexto zero. É o que este script usa.
  pasta PRIVADA  → só o conector do Drive, que devolve base64, e o base64 ENTRA NO
                   CONTEXTO. Para centenas de arquivos é inviável: peça ao dono para
                   tornar a pasta pública.

E recorte sempre: não baixe as 721 pastas. Levante os alimentadores dos casos que
interessam (campo ALIMENTADOR da SS/OS, que bate com o cadastro em 100% dos casos
testados) e passe só esses em --alimentadores.

Uso:

    # descobrir a árvore (uma vez) e baixar só os alimentadores de uma lista
    python3 kmz_fis.py --raiz <ID_da_pasta_dados> --alimentadores alims.json \
        --destino ./kmz --camadas Transformadores Postes

    # extrair o cadastro dos .kmz já baixados
    python3 kmz_fis.py --extrair ./kmz --camada Transformadores --saida fis_trafos.json
"""
import argparse
import collections
import glob
import json
import os
import re
import subprocess
import sys
import time
import zipfile

RE_ENTRADA = re.compile(r'id="entry-([A-Za-z0-9_-]{20,})"')
RE_TITULO = re.compile(r'flip-entry-title">([^<]*)</div>')
RE_PM = re.compile(r'<Placemark>(.*?)</Placemark>', re.S)
RE_NOME = re.compile(r'<name>(.*?)</name>', re.S)
RE_DATA = re.compile(r'<Data name="([^"]*)"[^>]*>\s*<value>(.*?)</value>', re.S)
RE_SIMPLE = re.compile(r'<SimpleData name="([^"]*)">(.*?)</SimpleData>', re.S)
RE_COORD = re.compile(r'<coordinates>\s*([-0-9.]+),([-0-9.]+)', re.S)


def _desescapa(s):
    return (s.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
             .replace('&quot;', '"').replace('&#39;', "'").strip())


def listar(pasta_id, tentativas=4):
    """Filhos de uma pasta pública do Drive: [(id, título), ...]. Só curl."""
    url = 'https://drive.google.com/embeddedfolderview?id=%s#list' % pasta_id
    for t in range(tentativas):
        p = subprocess.run(['curl', '-sSL', '--max-time', '60', url],
                           capture_output=True, text=True)
        if '<html' in p.stdout:
            out = []
            for bloco in p.stdout.split('<div class="flip-entry"')[1:]:
                i, n = RE_ENTRADA.search(bloco), RE_TITULO.search(bloco)
                if i and n:
                    out.append((i.group(1), n.group(1)))
            return out
        time.sleep(2 ** t)
    return []


def baixar(arquivo_id, destino, tentativas=4):
    url = 'https://drive.google.com/uc?export=download&id=%s' % arquivo_id
    for t in range(tentativas):
        subprocess.run(['curl', '-sSL', '--max-time', '120', '-o', destino, url],
                       check=False)
        if os.path.exists(destino) and os.path.getsize(destino) > 100:
            return True
        time.sleep(2 ** t)
    return False


def varrer(raiz, alimentadores, destino, camadas):
    """Percorre SE → alimentador e baixa as camadas pedidas dos alimentadores da lista."""
    os.makedirs(destino, exist_ok=True)
    alvo = set(alimentadores)
    manifesto, achados = {}, {}
    ses = listar(raiz)
    print('subestações/pastas na raiz: %d' % len(ses), file=sys.stderr)
    for sid, snome in ses:
        for cid, cnome in listar(sid):
            if cnome in alvo:
                achados[cnome] = (cid, snome)
        print('.', end='', flush=True, file=sys.stderr)
    print('', file=sys.stderr)

    falta = alvo - set(achados)
    if falta:
        print('NÃO ENCONTRADOS: %s' % sorted(falta), file=sys.stderr)

    for al, (cid, snome) in sorted(achados.items()):
        manifesto[al] = {'se': snome, 'camadas': {}}
        for fid, nome in listar(cid):
            if not nome.lower().endswith('.kmz'):
                continue
            if camadas and not any(nome.startswith(c) for c in camadas):
                continue
            dest = os.path.join(destino, '%s__%s' % (al, nome))
            if not (os.path.exists(dest) and os.path.getsize(dest) > 100):
                baixar(fid, dest)
            manifesto[al]['camadas'][nome] = (os.path.getsize(dest)
                                              if os.path.exists(dest) else 0)
        print('%s (%s): %d camadas' % (al, snome, len(manifesto[al]['camadas'])),
              file=sys.stderr)
    json.dump(manifesto, open(os.path.join(destino, 'manifesto.json'), 'w'),
              ensure_ascii=False, indent=1)
    return manifesto


def extrair(pasta, camada):
    """Lê os .kmz de uma camada e devolve {código: [campos, ...]}.

    Cada ativo é um <Placemark> nomeado pelo código operativo, com ExtendedData de
    ~50 campos. `_lat` / `_lon` vêm da geometria e `_alimentador` do nome do arquivo.
    """
    saida = {}
    for f in sorted(glob.glob(os.path.join(pasta, '*__%s.kmz' % camada))):
        al = os.path.basename(f).split('__')[0]
        try:
            z = zipfile.ZipFile(f)
        except zipfile.BadZipFile:
            print('não é zip válido: %s' % f, file=sys.stderr)
            continue
        kml = [n for n in z.namelist() if n.lower().endswith('.kml')]
        if not kml:
            continue
        t = z.read(kml[0]).decode('utf-8', 'replace')
        for pm in RE_PM.findall(t):
            n = RE_NOME.search(pm)
            cod = _desescapa(n.group(1)) if n else ''
            if not cod:
                continue
            d = {_desescapa(k): _desescapa(v) for k, v in RE_DATA.findall(pm)}
            for k, v in RE_SIMPLE.findall(pm):
                d.setdefault(_desescapa(k), _desescapa(v))
            c = RE_COORD.search(pm)
            if c:
                d['_lon'], d['_lat'] = float(c.group(1)), float(c.group(2))
            d['_alimentador'] = al
            saida.setdefault(cod, []).append(d)
    return saida


def ultima_alteracao(registro):
    """Data mais recente do campo Timestamp, que é MULTIVALORADO, separado por '¬'.

    Antes de tratar o cadastro como "o estado antes do evento", compare esta data com a
    data da SS. Se for posterior, o registro já pode refletir a troca e a leitura do
    "antes" não vale para aquele caso.
    """
    from datetime import datetime
    ds = []
    for p in (registro.get('Timestamp') or '').split('¬'):
        try:
            ds.append(datetime.strptime(p.strip(), '%d/%m/%Y'))
        except ValueError:
            pass
    return max(ds) if ds else None


def main():
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--raiz', help='id da pasta pública raiz (dados)')
    p.add_argument('--alimentadores', help='json com a lista de códigos de alimentador')
    p.add_argument('--destino', default='./kmz')
    p.add_argument('--camadas', nargs='*', default=['Transformadores'])
    p.add_argument('--extrair', help='pasta com os .kmz já baixados')
    p.add_argument('--camada', default='Transformadores')
    p.add_argument('--saida', default='fis.json')
    a = p.parse_args()

    if a.raiz:
        if not a.alimentadores:
            p.error('--raiz exige --alimentadores: não baixe a árvore inteira')
        alims = json.load(open(a.alimentadores))
        varrer(a.raiz, alims, a.destino, a.camadas)

    if a.extrair:
        d = extrair(a.extrair, a.camada)
        json.dump(d, open(a.saida, 'w'), ensure_ascii=False)
        print('%d ativos em %s' % (len(d), a.saida))
        if d:
            campos = collections.Counter(k for v in d.values() for k in v[0])
            print('campos: %s' % ', '.join(sorted(campos)[:12]) + ' …')
            sem_elo = sum(1 for v in d.values()
                          if not v[0].get('Capacidade Elo Fusivel Lado Carga', '').strip())
            print('sem elo cadastrado: %d de %d — confira se batem com '
                  '"Instalação Chave Fusivel = Não", que é ausência declarada, não '
                  'campo em branco' % (sem_elo, len(d)))

    if not (a.raiz or a.extrair):
        p.print_help()


if __name__ == '__main__':
    main()
