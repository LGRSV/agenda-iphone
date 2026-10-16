#!/usr/bin/env python3
"""Carregadores das bases da auditoria, com as armadilhas embutidas.

Cada função aqui existe porque um parser ingênuo falha em silêncio nesta base — não
levanta erro, só devolve menos dado ou dado trocado, e a análise sai errada e coerente.
Ver references/bases.md para o porquê de cada guarda.

Uso como biblioteca:

    from bases import ler_ss_os, ler_critica, indexar, universo_de_codigos
    cab, regs = ler_ss_os('BASE_SS_OS_20082026.txt')
    i = indexar(cab)
    codigo = regs[0][i['NUM_TRAFO']]

Uso como comando (diagnóstico rápido de um arquivo):

    python3 bases.py BASE_SS_OS_20082026.txt
"""
import csv
import os
import re
import sys
import unicodedata
from datetime import datetime, timedelta

csv.field_size_limit(10 ** 7)

# A janela de casamento SS × ocorrência é a do motor do site, não inventada aqui.
JANELA = timedelta(hours=24)   # para frente, a partir do fim da ocorrência
ANTES = timedelta(hours=1)     # para trás, a partir do início

PREFIXO_TRAFO = ('57', '56', '53', '51', '52', '55', '42')


# ── utilidades ──────────────────────────────────────────────────────────────
def texto(v):
    return '' if v is None else str(v).strip()


def sem_acento(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s)
                   if unicodedata.category(c) != 'Mn')


def data(s):
    """Aceita os formatos que aparecem nas bases. Devolve None sem drama."""
    s = texto(s)[:19]
    for f in ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M', '%d/%m/%Y',
              '%Y-%m-%d %H:%M:%S', '%Y-%m-%d %H:%M', '%Y-%m-%d'):
        try:
            return datetime.strptime(s, f)
        except ValueError:
            pass
    return None


def chave(v):
    """Normaliza série e tombamento para comparação.

    Tira espaço, pontuação, zeros à esquerda e prefixo de letra (CITD, P). Sem isso,
    formatação vira 'divergência': uma varredura produziu 1.570 falsos assim.
    """
    s = re.sub(r'[^0-9A-Za-z]', '', texto(v)).upper()
    s = re.sub(r'^[A-Z]+', '', s)
    return s.lstrip('0')


def mesmo_numero(a, b):
    """True se a e b são o mesmo número a menos de formatação ou 1 dígito digitado.

    Devolve (igual, motivo) para você poder reportar o motivo em vez de esconder.
    """
    ka, kb = chave(a), chave(b)
    if not ka or not kb:
        return False, 'sem par comparável'
    if ka == kb:
        return True, 'igual'
    if ka in kb or kb in ka:
        return True, 'contido (formatação)'
    if abs(len(ka) - len(kb)) <= 1:
        if len(ka) == len(kb):
            if sum(x != y for x, y in zip(ka, kb)) == 1:
                return True, '1 dígito trocado'
        else:
            lo, hi = (ka, kb) if len(ka) < len(kb) else (kb, ka)
            if any(hi[:i] + hi[i + 1:] == lo for i in range(len(hi))):
                return True, '1 dígito a mais'
    return False, 'diferente'


def indexar(cabecalho):
    """Índice nome→posição. Guarda a PRIMEIRA ocorrência: REFORMADORA_DESAT repete."""
    i = {}
    for n, h in enumerate(cabecalho):
        h = texto(h)
        if h and h not in i:
            i[h] = n
    return i


# ── SS/OS ───────────────────────────────────────────────────────────────────
def ler_ss_os(*arquivos, colunas=64):
    """Lê a base de SS/OS. Devolve (cabecalho, registros) com registros como listas.

    Duas armadilhas:
      1. A descrição da SS e da OS quebra linha no meio do campo. Ler linha a linha
         perde ~60% dos registros SEM dar erro. Aqui as linhas são acumuladas até
         fechar as colunas, e o total é CONFERIDO.
      2. A codificação muda entre extrações (utf-8 numa, latin-1 na seguinte, mesmo
         nome de arquivo). Detectada, não assumida.
    """
    cabecalho, registros = None, []
    for caminho in arquivos:
        bruto = usada = None
        for enc in ('utf-8', 'latin-1'):
            try:
                with open(caminho, encoding=enc) as fh:
                    bruto = fh.read()
                usada = enc
                break
            except UnicodeDecodeError:
                continue
        if bruto is None:
            raise RuntimeError('%s: não decodifica em utf-8 nem latin-1' % caminho)

        linhas = bruto.splitlines()
        cab = linhas[0].split('@')
        n = len(cab) if colunas is None else colunas
        cabecalho = cabecalho or cab
        antes = len(registros)

        buf = None
        for l in linhas[1:]:
            buf = l if buf is None else buf + ' ' + l
            if buf.count('@') >= n - 1:
                campos = buf.split('@')
                if len(campos) > n:          # havia @ dentro do texto (e-mail)
                    campos = campos[: n - 1] + ['@'.join(campos[n - 1:])]
                registros.append(campos)
                buf = None

        lidos = len(registros) - antes
        estimado = bruto.count('@') // (n - 1)
        if lidos < estimado * 0.95:
            raise RuntimeError(
                '%s: li %d registros mas o arquivo sugere ~%d. O parser de linha '
                'quebrada falhou — não siga com este resultado.'
                % (caminho, lidos, estimado))
        print('  %s: %d registros · %s' % (os.path.basename(caminho), lidos, usada),
              file=sys.stderr)
    return cabecalho, registros


# ── Crítica ─────────────────────────────────────────────────────────────────
PAPEIS = ('COD_ELE_PROBLEMA', 'COD_ELE_INTERROMPIDO', 'COD_ELE_FECHADO')


def ler_critica(*arquivos):
    """Lê a Crítica. Devolve lista de dicionários (mapeada por NOME de coluna).

    Três armadilhas:
      1. O arquivo de 12/2025 tem 65 colunas num layout DIFERENTE. Ler por índice
         numérico troca colunas em silêncio — por isso aqui é sempre por nome.
      2. DTA_INIC_ELE / DTA_FIM_ELE vêm vazias em algumas extrações. As datas boas são
         DTA_ABERT e DTA_FECH. Validado abaixo.
      3. Há aspas soltas no texto e campos enormes: QUOTE_NONE + field_size_limit.
    """
    saida = []
    for caminho in arquivos:
        with open(caminho, encoding='latin-1', newline='') as fh:
            rd = csv.reader(fh, delimiter=';', quoting=csv.QUOTE_NONE)
            cab = [texto(c) for c in next(rd)]
            idx = indexar(cab)
            if 'DTA_ABERT' not in idx:
                raise RuntimeError('%s: sem coluna DTA_ABERT — layout inesperado'
                                   % caminho)
            com_data = 0
            for row in rd:
                if len(row) < len(cab):
                    continue
                d = {k: texto(row[p]) for k, p in idx.items() if p < len(row)}
                d['_arquivo'] = os.path.basename(caminho)
                if d.get('DTA_ABERT'):
                    com_data += 1
                saida.append(d)
        if com_data == 0:
            raise RuntimeError('%s: DTA_ABERT vazia em todas as linhas.' % caminho)
        print('  %s: %d ocorrências · %d colunas'
              % (os.path.basename(caminho), com_data, len(cab)), file=sys.stderr)
    return saida


def ocorrencias_do_ativo(critica, codigo):
    """Toda ocorrência em que o código aparece, com o papel em que apareceu.

    O mesmo ativo aparece em três papéis e o casamento vale em qualquer um. Para 'por
    que este trafo queimou', o papel que importa é PROBLEMA; INTERROMPIDO é resposta
    para outra pergunta e vem marcado para você poder separar.
    """
    out = []
    for o in critica:
        for p in PAPEIS:
            if o.get(p, '') == codigo:
                out.append((p, o))
    return out


def casa_na_janela(abertura_ss, inicio_oc, fim_oc):
    """A régua do motor do site: 1h para trás do início, 24h para frente do fim.

    Vale contra o VÃO INTEIRO da ocorrência, não contra o trecho em que este ativo
    aparece.
    """
    if not (abertura_ss and inicio_oc):
        return False
    fim = fim_oc or inicio_oc
    return (inicio_oc - ANTES) <= abertura_ss <= (fim + JANELA)


# ── universo de códigos ─────────────────────────────────────────────────────
def universo_de_codigos(ss_os=None, critica=None, extras=()):
    """Conjunto de todo código operativo conhecido.

    Serve de pano de fundo para o teste de espelho do auxiliar. Quanto maior, melhor o
    teste — vale juntar SS/OS, Crítica, cadastro FIS e camadas de isolação.
    """
    U = set()
    if ss_os:
        cab, regs = ss_os
        i = indexar(cab)
        if 'NUM_TRAFO' in i:
            U |= {texto(r[i['NUM_TRAFO']]) for r in regs}
    if critica:
        for o in critica:
            for p in PAPEIS:
                U.add(o.get(p, ''))
    for e in extras:
        U |= set(e)
    U.discard('')
    return U


# ── diagnóstico pela linha de comando ───────────────────────────────────────
def _diagnostico(caminho):
    with open(caminho, 'rb') as fh:
        cabeca = fh.read(4096)
    if cabeca.count(b'@') > cabeca.count(b';'):
        cab, regs = ler_ss_os(caminho)
        i = indexar(cab)
        print('SS/OS · %d colunas · %d registros' % (len(cab), len(regs)))
        ds = [d for d in (data(r[i['DATA_ABERTURA_SS']]) for r in regs) if d]
        if ds:
            print('abertura de %s a %s' % (min(ds).date(), max(ds).date()))
        pref = {}
        for r in regs:
            k = texto(r[i['NUM_TRAFO']])[:2]
            pref[k] = pref.get(k, 0) + 1
        print('prefixos mais comuns:',
              sorted(pref.items(), key=lambda kv: -kv[1])[:8])
    else:
        oc = ler_critica(caminho)
        print('Crítica · %d ocorrências' % len(oc))
        ds = [d for d in (data(o.get('DTA_ABERT')) for o in oc) if d]
        if ds:
            print('abertura de %s a %s' % (min(ds).date(), max(ds).date()))
        com_obs = sum(1 for o in oc if o.get('OBSERVACAO'))
        print('com OBSERVACAO preenchida: %d (é onde mora o texto de campo)' % com_obs)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)
    for a in sys.argv[1:]:
        print('=' * 70)
        print(a)
        _diagnostico(a)
