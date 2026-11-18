"""
Reads the tennis results Excel (T-Report.xlsx) and writes data.js for the website.
Usage:  python build_data.py [path\to\T-Report.xlsx]
Re-run it every time you add results, then re-upload the site folder.
"""
import openpyxl, re, json, sys, os, datetime, collections

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = sys.argv[1] if len(sys.argv) > 1 else r'C:\Users\gambinis\Desktop\T-Report.xlsx'
OUT = os.path.join(HERE, 'data.js')
ME = 'Simone Gambini'

wb = openpyxl.load_workbook(SRC, data_only=True)


def clean(s):
    if s is None:
        return ''
    return re.sub(r'\s+', ' ', str(s).replace('\xa0', ' ')).strip()


def num(v):
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def iso(d):
    return d.strftime('%Y-%m-%d') if isinstance(d, (datetime.datetime, datetime.date)) else None


# ---------------------------------------------------------------- matches
SET_RE = re.compile(r'^\s*(\d+)\s*-\s*(\d+)\s*(?:\((\d+)\))?\s*$')


def parse_set(v):
    if v is None or clean(v) == '':
        return None
    m = SET_RE.match(str(v))
    if not m:
        print('WARN set not parsed:', repr(v))
        return None
    a, b, tb = int(m.group(1)), int(m.group(2)), m.group(3)
    s = [a, b]
    if tb is not None:
        s.append(int(tb))
    return s


def parse_comment(c, date):
    raw = clean(c)
    wo = bool(re.match(r'(?i)walkover', raw))
    rest = re.sub(r'(?i)^walkover\s*-?\s*', '', raw).strip()
    dur = None
    m = re.search(r'(\d+:\d\d)', rest)
    if m:
        dur = m.group(1)
        rest = re.sub(r'\(?\s*h?\s*-?\s*' + re.escape(dur) + r'\s*(hr|h)?\s*\)?', '', rest).strip(' -')
    out = dict(cat='friendly', league=None, ll=None, season=None, note='', surface=None, stage=None)
    # QF / SF / F are only memory notes: drop them, keep the league
    rest = re.sub(r'(?i)^(QF|SF|F)\s*-\s*', '', rest).strip()
    nm = re.search(r"(?i)nitra", rest)
    m = re.match(r"^(\d)\*?\s*in the League", rest)
    m2 = re.match(r"^(\d)\S?\s*League(?:\s*'(\d\d))?", rest)
    if nm or re.match(r'(?i)^league$', rest):
        yy = re.search(r"'(\d\d)", rest)
        out.update(cat='nitra', season=('20' + yy.group(1)) if yy else None)
    elif m:
        out.update(cat='league', ll=int(m.group(1)), season=str(date.year))
    elif m2:
        yy = int(m2.group(2)) + 2000 if m2.group(2) else date.year
        out.update(cat='league', ll=int(m2.group(1)), season=str(yy))
    elif re.match(r'(?i)^winter league', rest):
        start = date.year if date.month >= 9 else date.year - 1
        out.update(cat='winter', season='%d-%02d' % (start, (start + 1) % 100))
    else:
        out['note'] = rest
        if rest.lower() == 'hard':
            out['surface'] = 'Hard'
    if out['cat'] == 'league':
        out['league'] = "%d° League '%s" % (out['ll'], out['season'][2:])
    elif out['cat'] == 'winter':
        out['league'] = 'Winter League ' + out['season']
    elif out['cat'] == 'nitra':
        out['league'] = 'Nitra League' + (" '" + out['season'][2:] if out['season'] else '')
    out['wo'] = wo
    out['dur'] = dur
    return out


ws = wb['Partite']
matches = []
unplayed = 0
for r in range(11, ws.max_row + 1):
    vs, date, perf, lvl, s1, s2, s3, res, com, imp = [ws.cell(r, c).value for c in range(2, 12)]
    if not isinstance(date, datetime.datetime):
        continue
    if res not in ('W', 'L'):
        if vs:
            unplayed += 1
        continue
    info = parse_comment(com, date)
    ret = any(clean(x).lower().startswith('ret') for x in (s1, s2, s3) if x is not None)
    sets = [s for s in ((None if str(x).strip().lower().startswith('ret') else parse_set(x)) for x in (s1, s2, s3)) if s]
    matches.append(dict(
        id=len(matches), d=iso(date), vs=clean(vs), perf=num(perf), lvl=num(lvl),
        sets=sets, res=res, ret=ret, imp=clean(imp) or None, **info))
matches.sort(key=lambda m: (m['d'], m['id']))
for i, m in enumerate(matches):
    m['id'] = i
print('matches', len(matches), 'unplayed with name', unplayed)

# validate against the sheet's own yearly summary
chk = collections.defaultdict(lambda: [0, 0, 0, 0])
for m in matches:
    y = int(m['d'][:4])
    chk[y][0 if m['res'] == 'W' else 1] += 1
    chk[y][2] += m['perf'] or 0
    chk[y][3] += m['lvl'] or 0
for r in range(3, 8):
    y = ws.cell(r, 2).value
    print('sheet', y, ws.cell(r, 3).value, ws.cell(r, 4).value, '| mine', chk[y][:2],
          'perf', round(chk[y][2] / sum(chk[y][:2]), 3), 'vs', round(ws.cell(r, 9).value, 3),
          'opp', round(chk[y][3] / sum(chk[y][:2]), 3), 'vs', round(ws.cell(r, 8).value, 3))

# racquets
racquets = []
for r in range(3, 9):
    n = ws.cell(r, 12).value
    if n:
        racquets.append(dict(name=clean(n), played=num(ws.cell(r, 13).value), w=num(ws.cell(r, 14).value),
                             l=num(ws.cell(r, 15).value)))

# next matches panel (columns R..W) and slots (Y,Z)
scheduled, missing, notes = [], [], []
for r in range(2, 40):
    p, d, t, mm, nt = [ws.cell(r, c).value for c in (19, 20, 21, 22, 23)]
    if p and isinstance(d, datetime.datetime):
        scheduled.append(dict(player=clean(p), date=iso(d), time=clean(t)))
    if mm:
        missing.append(clean(mm))
    if nt:
        notes.append(clean(nt))
slots = collections.OrderedDict()
for r in range(1, 40):
    day, t = ws.cell(r, 25).value, ws.cell(r, 26).value
    if day and t:
        slots.setdefault(clean(day).split(' - ')[-1], set()).add(clean(t))
wl = wb['Winter League Results']
for r in range(1, 20):
    day = wl.cell(r, 10).value
    if day and clean(day) in ('Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'):
        for c in (11, 13):
            t = wl.cell(r, c).value
            if t:
                slots.setdefault(clean(day), set()).add(clean(t))
order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
slots = [dict(day=d, times=sorted(slots[d])) for d in order if d in slots]

# ---------------------------------------------------------------- players, ranking history
sg = wb['Statistiche Giocatori']
players = {}
for r in range(5, 120):
    n, l, lang = sg.cell(r, 8).value, sg.cell(r, 9).value, sg.cell(r, 10).value
    if n:
        players[clean(n)] = dict(level=num(l), lang=clean(lang))
history = []
for r in range(5, 120):
    d, rk = sg.cell(r, 30).value, sg.cell(r, 31).value
    if isinstance(d, datetime.datetime) and rk is not None:
        history.append(dict(d=iso(d), rank=num(rk)))
print('players', len(players), 'rank history', len(history))

# ---------------------------------------------------------------- yearly club rankings
rankings = {}
for y in sorted(n for n in wb.sheetnames if re.fullmatch(r'20\d\d', n.strip())):
    w = wb[y]
    hdr = [clean(c) for c in next(w.iter_rows(min_row=1, max_row=1, values_only=True))]
    hi = next(i for i, h in enumerate(hdr) if h.lower().startswith('hr'))
    end = hi + 1
    while end < len(hdr) and hdr[end]:
        end += 1
    cols = hdr[hi + 1:end]
    total_idx = next((i for i, c in enumerate(cols) if c.lower().startswith('po')), None)
    rows = []
    for row in w.iter_rows(min_row=2, values_only=True):
        name = row[hi]
        if not name:
            continue
        vals = [num(v) for v in row[hi + 1:end]]
        rows.append(dict(name=clean(name), vals=vals))
    # sort by total points so the position is always correct
    if total_idx is not None:
        rows.sort(key=lambda x: -(x['vals'][total_idx] or 0))
    for i, rw in enumerate(rows):
        rw['pos'] = i + 1
    # points scale table
    scale = []
    for r in range(1, 6):
        for c in range(1, w.max_column + 1):
            if clean(w.cell(r, c).value) == 'Umiestnenie':
                rr = r + 1
                while w.cell(rr, c).value is not None:
                    scale.append([num(w.cell(rr, c).value), num(w.cell(rr, c + 1).value)])
                    rr += 1
    rankings[y] = dict(cols=cols, total=total_idx, rows=rows, scale=scale)
    me = next((x for x in rows if 'gambini' in x['name'].lower()), None)
    print(y, 'players', len(rows), 'me', me and (me['pos'], me['vals'][total_idx]))

# ---------------------------------------------------------------- tournaments (sheet Vittorie)
vw = wb['Vittorie']
events, cur = [], None
for r in range(1, vw.max_row + 1):
    cells = [vw.cell(r, c).value for c in range(2, 8)]
    b, c3 = cells[0], cells[1]
    if b and isinstance(c3, (int, float)) and 2000 <= c3 <= 2100 and all(x is None for x in cells[2:]):
        cur = dict(name=clean(b), year=int(c3), rows=[])
        events.append(cur)
        continue
    if cur is not None and any(x is not None for x in cells):
        cur['rows'].append([clean(x) if isinstance(x, str) else num(x) for x in cells])
print('events', [(e['name'], e['year'], len(e['rows'])) for e in events])

# ---------------------------------------------------------------- goals
gw = wb['Goals']
skills = []
for c in range(4, 11):
    head = clean(gw.cell(2, c).value)
    if head:
        items = [clean(gw.cell(r, c).value) for r in range(3, 12) if gw.cell(r, c).value]
        skills.append(dict(name=head, items=items))
ratings = []
for r in range(12, 18):
    d = gw.cell(r, 3).value
    if isinstance(d, datetime.datetime):
        vals = [num(gw.cell(r, c).value) for c in range(4, 11)]
        if any(v is not None for v in vals):
            ratings.append(dict(year=d.year, vals=vals))
quotes = [clean(gw.cell(r, c).value) for r in range(17, 25) for c in (2, 3) if gw.cell(r, c).value]
print('skills', [s['name'] for s in skills], 'ratings', len(ratings), 'quotes', quotes)

data = dict(
    me=ME, generated=datetime.datetime.now().strftime('%Y-%m-%d %H:%M'), source=os.path.basename(SRC),
    matches=matches, players=players, racquets=racquets, rankHistory=history, rankings=rankings,
    events=events, goals=dict(skills=skills, ratings=ratings, quotes=quotes),
    next=dict(scheduled=scheduled, missing=missing, notes=notes, slots=slots),
)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write('window.DATA = ' + json.dumps(data, ensure_ascii=False) + ';\n')
print('written', OUT, os.path.getsize(OUT), 'bytes')
cats = collections.Counter((m['cat'], m['wo']) for m in matches)
print(cats)
print(collections.Counter(m['league'] for m in matches if m['league']))
print('friendly notes', collections.Counter(m['note'] for m in matches if m['cat'] == 'friendly'))
print('last match', matches[-1]['d'], 'scheduled', scheduled, 'missing', missing, 'notes', notes)
print('slots', slots)
