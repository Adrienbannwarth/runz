#!/usr/bin/env python3
"""Sauvegarde RunZ → Excel.

Copie RunZ-Suivi.xlsx en RunZ-Sauvegarde-site.xlsx (même dossier) et remplit, avec les données du site :
  - l'onglet « Saisie km » (colonnes à saisir A, B, D, E, F, G, H, N ; les colonnes calculées restent des formules)
  - les bonus en km de l'onglet « Boost » (colonnes H à L)
Le fichier obtenu fonctionne seul : on peut y continuer la saisie à la main si le site tombe.
Le fichier RunZ-Suivi.xlsx d'origine n'est jamais modifié.

Usage :
  python3 scripts/backup-excel.py "/chemin/RunZ-Suivi.xlsx"            # récupère les données sur le site
  python3 scripts/backup-excel.py "/chemin/RunZ-Suivi.xlsx" --json f.json  # données depuis un fichier (test)
Le secret (CRON_SECRET) et l'URL (APP_URL) sont lus dans .env.vercel.local, à la racine du projet.
Bibliothèque standard uniquement. L'édition se fait directement dans le XML pour garder listes déroulantes et mise en forme.
"""
import datetime as dt
import json
import os
import re
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIRST_ROW = 5
LAST_ROW_SAISIE = 2004
LAST_ROW_BONUS = 104


def env():
    vals = {}
    path = os.path.join(ROOT, '.env.vercel.local')
    if os.path.exists(path):
        for line in open(path, encoding='utf-8'):
            m = re.match(r'\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$', line)
            if m:
                vals[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return vals


def fetch():
    e = env()
    url = (e.get('APP_URL') or 'https://runz-colorz.vercel.app').rstrip('/') + '/api/export?format=json'
    req = urllib.request.Request(url, headers={'Authorization': f"Bearer {e.get('CRON_SECRET', '')}"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


# ---------- lecture minimale du classeur ----------
def sheet_paths(z):
    wb = z.read('xl/workbook.xml').decode()
    rels = z.read('xl/_rels/workbook.xml.rels').decode()
    target = {m.group(1): m.group(2) for m in re.finditer(r'<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"', rels)}
    target.update({m.group(2): m.group(1) for m in re.finditer(r'<Relationship [^>]*Target="([^"]+)"[^>]*Id="([^"]+)"', rels)})
    out = {}
    for m in re.finditer(r'<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"', wb):
        t = target[m.group(2)].lstrip('/')
        out[m.group(1).replace('&apos;', "'").replace('&amp;', '&')] = t if t.startswith('xl/') else 'xl/' + t
    return out


def shared_strings(z):
    try:
        x = z.read('xl/sharedStrings.xml').decode()
    except KeyError:
        return []
    return [''.join(re.findall(r'<t[^>]*>(.*?)</t>', si, re.S)) for si in re.findall(r'<si>(.*?)</si>', x, re.S)]


CELL = re.compile(r'<c r="([A-Z]+)(\d+)"([^>]*?)(?:/>|>(.*?)</c>)', re.S)


def cell_value(attrs, inner, sst):
    if inner is None:
        return None
    v = re.search(r'<v>(.*?)</v>', inner, re.S)
    if 't="s"' in attrs and v:
        return sst[int(v.group(1))]
    if 't="inlineStr"' in attrs:
        return ''.join(re.findall(r'<t[^>]*>(.*?)</t>', inner, re.S))
    return v.group(1) if v else None


# ---------- écriture ----------
def serial(iso):
    return (dt.date.fromisoformat(iso) - dt.date(1899, 12, 30)).days


def style(attrs):
    m = re.search(r'\bs="(\d+)"', attrs or '')
    return f' s="{m.group(1)}"' if m else ''


def c_str(ref, st, v):
    return f'<c r="{ref}"{st} t="inlineStr"><is><t xml:space="preserve">{escape(str(v))}</t></is></c>'


def c_num(ref, st, v):
    return f'<c r="{ref}"{st}><v>{v}</v></c>'


def shift_formula(f, src, dst):
    """Recale les références relatives de ligne src → dst (ex. $B19 → $B7), sans toucher aux $5, $89…"""
    return re.sub(rf'(?<=[A-Z]){src}(?!\d)', str(dst), f)


def rewrite_rows(xml, values_by_row, formula_cols, template_row, last_row):
    """values_by_row : {ligne: {col: xml_cellule}}. Les cellules à formule existantes sont conservées ;
    si une ligne n'a pas de formule (lignes vidées), on la recrée à partir de la ligne modèle."""
    rows = {int(m.group(1)): m for m in re.finditer(r'<row r="(\d+)"([^>]*)>(.*?)</row>', xml, re.S)}
    tpl = {}
    if template_row in rows:
        for m in CELL.finditer(rows[template_row].group(3)):
            f = re.search(r'<f[^>]*>(.*?)</f>', m.group(4) or '', re.S)
            if m.group(1) in formula_cols and f:
                tpl[m.group(1)] = (style(m.group(3)), re.search(r'\bt="(\w+)"', m.group(3)), f.group(1))

    def build(r, existing):
        cells = {m.group(1): m for m in CELL.finditer(existing)} if existing is not None else {}
        out = []
        cols = sorted(set(cells) | set(values_by_row.get(r, {})) | set(formula_cols), key=lambda c: (len(c), c))
        for col in cols:
            ref = f'{col}{r}'
            if col in values_by_row.get(r, {}):
                st = style(cells[col].group(3)) if col in cells else ''
                out.append(values_by_row[r][col](ref, st))
            elif col in cells and (col not in formula_cols or '<f' in (cells[col].group(4) or '')):
                out.append(cells[col].group(0))
            elif col in formula_cols and col in tpl:
                st, t, f = tpl[col]
                out.append(f'<c r="{ref}"{st}{" t=" + chr(34) + t.group(1) + chr(34) if t else ""}><f>{shift_formula(f, template_row, r)}</f></c>')
            elif col in cells:
                out.append(cells[col].group(0))
        return ''.join(out)

    def repl(m):
        r = int(m.group(1))
        if r < FIRST_ROW or r > last_row or (r not in values_by_row and '<f' in m.group(3)):
            return m.group(0)
        return f'<row r="{r}"{m.group(2)}>{build(r, m.group(3))}</row>'

    return re.sub(r'<row r="(\d+)"([^>]*)>(.*?)</row>', repl, xml, flags=re.S)


def team_map(z, paths, sst):
    """Noms d'équipe du site (Team Rouge) → noms de l'Excel (Rouges), via Paramètres!A14:A17."""
    xml = z.read(paths['Paramètres']).decode()
    names = []
    for m in CELL.finditer(xml):
        if m.group(1) == 'A' and 14 <= int(m.group(2)) <= 30:
            v = cell_value(m.group(3), m.group(4), sst)
            if v:
                names.append(v)
    stem = lambda s: re.sub(r'^team\s+', '', s.strip().lower()).rstrip('s')
    return lambda site: next((n for n in names if stem(n) == stem(site)), site)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    src = sys.argv[1]
    data = json.load(open(sys.argv[sys.argv.index('--json') + 1])) if '--json' in sys.argv else fetch()
    out_path = os.path.join(os.path.dirname(src), 'RunZ-Sauvegarde-site.xlsx')

    zin = zipfile.ZipFile(src)
    paths = sheet_paths(zin)
    sst = shared_strings(zin)
    to_excel_team = team_map(zin, paths, sst)

    rows = data['rows'][: LAST_ROW_SAISIE - FIRST_ROW + 1]
    saisie = {}
    for i, a in enumerate(rows):
        r = FIRST_ROW + i
        v = {
            'A': lambda ref, st, d=a['date']: c_num(ref, st, serial(d)),
            'B': lambda ref, st, x=a['participant']: c_str(ref, st, x),
            'D': lambda ref, st, x=a['activite']: c_str(ref, st, x),
            'E': lambda ref, st, x=a['km']: c_num(ref, st, x),
            'F': lambda ref, st, x=a['creneau']: c_str(ref, st, x),
            'H': lambda ref, st, x=a['justificatif']: c_str(ref, st, x),
            'N': lambda ref, st, x=a['commentaire']: c_str(ref, st, x),
        }
        if a.get('dplus') is not None:
            v['G'] = lambda ref, st, x=a['dplus']: c_num(ref, st, x)
        saisie[r] = v

    bonus = {}
    for i, b in enumerate(data.get('bonuses', [])[: LAST_ROW_BONUS - FIRST_ROW + 1]):
        bonus[FIRST_ROW + i] = {
            'H': lambda ref, st, d=b['date']: c_num(ref, st, serial(d)),
            'I': lambda ref, st, x=to_excel_team(b['equipe']): c_str(ref, st, x),
            'J': lambda ref, st, x=b['boost']: c_str(ref, st, x),
            'K': lambda ref, st, x=b['km']: c_num(ref, st, x),
            'L': lambda ref, st, x=b['justification']: c_str(ref, st, x),
        }

    p_saisie, p_boost = paths['Saisie km'], paths['Boost']
    fd, tmp = tempfile.mkstemp(suffix='.xlsx')  # construit hors du dossier partagé
    os.close(fd)
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            buf = zin.read(item.filename)
            if item.filename == p_saisie:
                buf = rewrite_rows(buf.decode(), saisie, {'C', 'I', 'J', 'K', 'L', 'M'}, 19, LAST_ROW_SAISIE).encode()
            elif item.filename == p_boost:
                buf = rewrite_rows(buf.decode(), bonus, set(), 0, LAST_ROW_BONUS).encode()
            if item.filename.startswith('xl/worksheets/sheet'):
                # valeurs en cache des formules retirées : tout logiciel (Excel, Excel en ligne, LibreOffice) recalcule
                buf = re.sub(r'(<f[^>]*/>|<f[^>]*>.*?</f>)<v>.*?</v>', r'\1', buf.decode(), flags=re.S).encode()
            if item.filename == 'xl/workbook.xml':
                # Excel recalcule tout à l'ouverture
                s = buf.decode()
                s = re.sub(r'<calcPr([^>]*?)\s*/>', lambda m: '<calcPr' + re.sub(r'\s*fullCalcOnLoad="[^"]*"', '', m.group(1)) + ' fullCalcOnLoad="1"/>', s)
                buf = s.encode()
            elif item.filename == 'xl/calcChain.xml':
                continue  # recréée par Excel
            zout.writestr(item, buf)
    # calcChain retiré : on enlève aussi sa référence
    if 'xl/calcChain.xml' in zin.namelist():
        fixed = tmp + '.2'
        with zipfile.ZipFile(tmp) as zt, zipfile.ZipFile(fixed, 'w', zipfile.ZIP_DEFLATED) as zf:
            for item in zt.infolist():
                b = zt.read(item.filename)
                if item.filename == '[Content_Types].xml':
                    b = re.sub(rb'<Override[^>]*calcChain[^>]*/>', b'', b)
                elif item.filename == 'xl/_rels/workbook.xml.rels':
                    b = re.sub(rb'<Relationship[^>]*calcChain[^>]*/>', b'', b)
                zf.writestr(item, b)
        os.replace(fixed, tmp)
    zin.close()
    shutil.copyfile(tmp, out_path)  # réécrit le fichier en place (pas de suppression dans le dossier partagé)
    os.remove(tmp)
    print(f"{len(rows)} activités et {len(bonus)} bonus écrits dans {out_path} ({data.get('generated_at', '')})")


if __name__ == '__main__':
    main()
