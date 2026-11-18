(function () {
'use strict';
const D = window.DATA, ALL = D.matches;
const $ = (s, el) => (el || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fd = iso => { const p = iso.split('-'); return (+p[2]) + ' ' + MON[p[1] - 1] + ' ' + p[0]; };
const pct = (a, b) => b ? Math.round(100 * a / b) + '%' : '–';
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const f1 = x => x == null ? '–' : x.toFixed(1);
const f2 = x => x == null ? '–' : x.toFixed(2);
const YEARS = [...new Set(ALL.map(m => m.d.slice(0, 4)))].sort();
const LEVELS = [...new Set(ALL.filter(m => m.cat === 'league').map(m => m.ll))].sort((a, b) => b - a);
const isMe = n => /gambini/i.test(n || '');

const state = { year: 'all', cat: 'all', wo: 'incl', q: '', res: 'all', sort: { key: 'p', dir: -1 }, ry: null, pq: '' };

/* ---------------------------------------------------------------- filtering */
function inCat(m, c) {
  if (c === 'all') return true;
  if (c === 'comp') return m.cat !== 'friendly';
  if (c === 'league') return m.cat === 'league';
  if (c.indexOf('league:') === 0) return m.cat === 'league' && m.ll === +c.split(':')[1];
  return m.cat === c;
}
function flt(o) {
  o = Object.assign({}, state, o || {});
  return ALL.filter(m =>
    (o.year === 'all' || m.d.slice(0, 4) === o.year) && inCat(m, o.cat) &&
    (o.wo === 'incl' || (o.wo === 'excl' ? !m.wo : m.wo)) &&
    (o.res === 'all' || m.res === o.res) &&
    (!o.q || m.vs.toLowerCase().indexOf(o.q.toLowerCase()) >= 0));
}
const CAT_OPTS = [['all', 'All matches'], ['comp', 'Competitive (all leagues)'], ['league', 'League – any level']]
  .concat(LEVELS.map(l => ['league:' + l, l + '° League']))
  .concat([['winter', 'Winter League'], ['playoff', 'League playoffs'], ['friendly', 'Friendly (no league)']]);

/* ---------------------------------------------------------------- aggregation */
function agg(L) {
  const a = { p: L.length, w: 0, l: 0, sw: 0, sl: 0, gw: 0, gl: 0, tbw: 0, tbl: 0, bw: 0, bl: 0, stw: 0, stl: 0,
    s3w: 0, s3l: 0, straightW: 0, behindW: 0, straightL: 0, aheadL: 0, woW: 0, woL: 0, perf: [], lvl: [] };
  for (const m of L) {
    const win = m.res === 'W';
    if (win) a.w++; else a.l++;
    if (m.wo) { if (win) a.woW++; else a.woL++; }
    if (m.perf != null) a.perf.push(m.perf);
    if (m.lvl != null) a.lvl.push(m.lvl);
    let sw = 0, sl = 0;
    for (const s of m.sets) {
      const x = s[0], y = s[1], stb = Math.max(x, y) >= 10;
      if (x > y) { a.sw++; sw++; } else if (y > x) { a.sl++; sl++; }
      if (stb) { if (x > y) a.stw++; else a.stl++; continue; }
      a.gw += x; a.gl += y;
      if (x + y === 13) { if (x > y) a.tbw++; else a.tbl++; }
      if (x === 6 && y === 0) a.bw++;
      if (x === 0 && y === 6) a.bl++;
    }
    if (m.sets.length === 3) { if (win) a.s3w++; else a.s3l++; }
    if (win) { if (sl) a.behindW++; else a.straightW++; } else { if (sw) a.aheadL++; else a.straightL++; }
  }
  a.pct = a.p ? a.w / a.p : null;
  a.ap = avg(a.perf); a.al = avg(a.lvl);
  a.rating = a.ap != null && a.al != null ? a.ap * a.al / 10 : null;
  return a;
}
function streaks(L) {
  let cur = 0, curRes = null, best = 0, bestL = 0, run = 0, runRes = null;
  for (const m of L) {
    if (m.res === runRes) run++; else { run = 1; runRes = m.res; }
    if (runRes === 'W' && run > best) best = run;
    if (runRes === 'L' && run > bestL) bestL = run;
  }
  cur = run; curRes = runRes;
  return { cur, curRes, best, bestL };
}
const scoreStr = m => m.sets.map(s => s[0] + '-' + s[1] + (s[2] != null ? '(' + s[2] + ')' : '')).join(' ') + (m.ret ? ' ret.' : '');
const compTag = m => {
  const c = { league: 'lg', winter: 'wn', playoff: 'po', friendly: 'fr' }[m.cat];
  return '<span class="tag ' + c + '">' + esc(m.league || 'Friendly') + '</span>';
};
const woTag = m => m.wo ? '<span class="tag wo">Walkover</span>' : '';
const badge = r => '<span class="badge ' + r + '">' + r + '</span>';
const playerLink = n => '<a href="#/player/' + encodeURIComponent(n) + '">' + esc(n) + '</a>';

/* ---------------------------------------------------------------- generic UI pieces */
function table(heads, rows, o) {
  o = o || {};
  return '<div class="tablewrap"' + (o.id ? ' id="' + o.id + '"' : '') + '><table><thead><tr>' +
    heads.map(h => '<th class="' + (h.n ? 'n ' : '') + (h.sort ? 's' : '') + '"' + (h.sort ? ' data-sort="' + h.sort + '"' : '') + '>' + h.t + '</th>').join('') +
    '</tr></thead><tbody>' + (rows.length ? rows.join('') : '<tr><td colspan="' + heads.length + '" class="empty">No data for this filter</td></tr>') + '</tbody></table></div>';
}
const td = (v, n) => '<td' + (n ? ' class="n"' : '') + '>' + v + '</td>';
function wlBar(w, l) {
  const t = w + l; if (!t) return '';
  return '<div class="wlbar"><i class="w" style="width:' + 100 * w / t + '%"></i><i class="l" style="width:' + 100 * l / t + '%"></i></div>';
}
function kpi(v, l, s, cls) { return '<div class="card kpi"><div class="v ' + (cls || '') + '">' + v + '</div><div class="l">' + l + '</div>' + (s ? '<div class="s">' + s + '</div>' : '') + '</div>'; }

function filterBar(o) {
  o = o || { cat: true, wo: true, year: true };
  let h = '<div class="filters">';
  if (o.year !== false) h += '<label>Year<div class="pills">' +
    ['all'].concat(YEARS).map(y => '<span class="pill ' + (state.year === y ? 'on' : '') + '" data-year="' + y + '">' + (y === 'all' ? 'All' : y) + '</span>').join('') + '</div></label>';
  if (o.cat !== false) h += '<label>Competition<select data-f="cat">' + CAT_OPTS.map(c => '<option value="' + c[0] + '"' + (state.cat === c[0] ? ' selected' : '') + '>' + c[1] + '</option>').join('') + '</select></label>';
  if (o.wo !== false) h += '<label>Walkovers<select data-f="wo"><option value="incl"' + (state.wo === 'incl' ? ' selected' : '') + '>Included (normal)</option><option value="excl"' + (state.wo === 'excl' ? ' selected' : '') + '>Excluded</option><option value="only"' + (state.wo === 'only' ? ' selected' : '') + '>Walkovers only</option></select></label>';
  return h + '</div>';
}

/* ---------------------------------------------------------------- SVG charts */
function lineChart(pts, o) {
  o = o || {};
  if (pts.length < 2) return '<div class="empty">Not enough data</div>';
  const W = 600, H = o.h || 190, l = 36, r = 12, t = 12, b = 26;
  const ys = pts.map(p => p.y);
  let mn = o.min != null ? o.min : Math.min.apply(null, ys), mx = o.max != null ? o.max : Math.max.apply(null, ys);
  if (mn === mx) { mn -= 1; mx += 1; }
  const X = i => l + (W - l - r) * i / (pts.length - 1);
  const Y = v => { const f = (v - mn) / (mx - mn); return t + (H - t - b) * (o.invert ? f : 1 - f); };
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = mn + (mx - mn) * i / 4, y = Y(v);
    g += '<line x1="' + l + '" x2="' + (W - r) + '" y1="' + y + '" y2="' + y + '" stroke="#243250"/><text x="' + (l - 5) + '" y="' + (y + 4) + '" text-anchor="end">' + (o.fmt ? o.fmt(v) : Math.round(v)) + '</text>';
  }
  const n = Math.min(6, pts.length);
  for (let k = 0; k < n; k++) {
    const i = Math.round((pts.length - 1) * k / (n - 1));
    g += '<text x="' + X(i) + '" y="' + (H - 6) + '" text-anchor="' + (k === 0 ? 'start' : k === n - 1 ? 'end' : 'middle') + '">' + esc(pts[i].x) + '</text>';
  }
  const d = pts.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ');
  const dots = pts.length <= 40 ? pts.map((p, i) => '<circle cx="' + X(i) + '" cy="' + Y(p.y) + '" r="3" fill="' + (o.color || '#b6f23a') + '"><title>' + esc(p.x) + ': ' + (o.fmt ? o.fmt(p.y) : p.y) + '</title></circle>').join('') : '';
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">' + g + '<path d="' + d + '" fill="none" stroke="' + (o.color || '#b6f23a') + '" stroke-width="2.2"/>' + dots + '</svg>';
}
function stackChart(rows) {
  if (!rows.length) return '<div class="empty">No data</div>';
  const W = 600, H = 200, l = 30, b = 34, t = 14;
  const mx = Math.max.apply(null, rows.map(r => r.w + r.l)) || 1;
  const bw = (W - l) / rows.length, bwi = Math.min(60, bw * 0.6);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto">';
  for (let i = 0; i <= 4; i++) { const y = t + (H - t - b) * (1 - i / 4); s += '<line x1="' + l + '" x2="' + W + '" y1="' + y + '" y2="' + y + '" stroke="#243250"/><text x="' + (l - 4) + '" y="' + (y + 4) + '" text-anchor="end">' + Math.round(mx * i / 4) + '</text>'; }
  rows.forEach((r, i) => {
    const x = l + bw * i + (bw - bwi) / 2, hh = H - t - b;
    const hw = hh * r.w / mx, hl = hh * r.l / mx;
    s += '<rect x="' + x + '" y="' + (t + hh - hw) + '" width="' + bwi + '" height="' + hw + '" fill="#22c55e"><title>' + r.label + ': ' + r.w + ' W</title></rect>';
    s += '<rect x="' + x + '" y="' + (t + hh - hw - hl) + '" width="' + bwi + '" height="' + hl + '" fill="#ef4444"><title>' + r.label + ': ' + r.l + ' L</title></rect>';
    s += '<text x="' + (x + bwi / 2) + '" y="' + (H - 18) + '" text-anchor="middle">' + esc(r.label) + '</text><text x="' + (x + bwi / 2) + '" y="' + (H - 5) + '" text-anchor="middle">' + pct(r.w, r.w + r.l) + '</text>';
  });
  return s + '</svg>';
}
function barRows(items, o) {
  o = o || {};
  return '<div class="bars">' + items.map(i => '<div class="row"><div>' + i.label + '</div><div class="track"><div class="fill" style="width:' + (o.max ? 100 * i.v / o.max : i.v) + '%;' + (i.color ? 'background:' + i.color : '') + '"></div></div><div>' + i.right + '</div></div>').join('') + '</div>';
}
function formStrip(L, n) { return '<div class="form">' + L.slice(-n).map(m => '<span class="' + m.res + '" title="' + esc(fd(m.d) + ' ' + m.vs + ' ' + scoreStr(m)) + '"></span>').join('') + '</div>'; }

/* ---------------------------------------------------------------- match table */
function matchTable(L, o) {
  o = o || {};
  const rows = L.map(m => '<tr>' + td(fd(m.d)) + (o.noVs ? '' : td(playerLink(m.vs))) + td('<b>' + esc(scoreStr(m)) + '</b>') + td(badge(m.res)) +
    td(compTag(m) + woTag(m)) + td(m.lvl == null ? '–' : m.lvl, 1) + td(m.perf == null ? '–' : m.perf, 1) +
    td(esc(m.imp || '')) + td((m.surface ? '<span class="tag">' + m.surface + '</span>' : '') + (m.dur ? '<span class="tag">⏱ ' + m.dur + ' h</span>' : '') + (m.note && m.note !== 'Hard' ? '<span class="tag">' + esc(m.note) + '</span>' : '')) + '</tr>');
  return table([{ t: 'Date' }].concat(o.noVs ? [] : [{ t: 'Opponent' }]).concat([{ t: 'Score' }, { t: 'Res' }, { t: 'Competition' }, { t: 'Opp lvl', n: 1 }, { t: 'My perf', n: 1 }, { t: 'To improve' }, { t: 'Notes' }]), rows, o);
}

/* ---------------------------------------------------------------- pages */
function compRows(L) {
  const groups = [];
  LEVELS.forEach(l => groups.push([l + '° League', L.filter(m => m.cat === 'league' && m.ll === l), 'lg']));
  groups.push(['Winter League', L.filter(m => m.cat === 'winter'), 'wn'], ['League playoffs', L.filter(m => m.cat === 'playoff'), 'po'], ['Friendly (no league)', L.filter(m => m.cat === 'friendly'), 'fr']);
  const rows = groups.filter(g => g[1].length).map(g => {
    const a = agg(g[1]);
    return '<tr>' + td('<span class="tag ' + g[2] + '">' + g[0] + '</span>') + td(a.p, 1) + td('<span class="win">' + a.w + '</span>', 1) + td('<span class="loss">' + a.l + '</span>', 1) + td(pct(a.w, a.p), 1) + td(wlBar(a.w, a.l)) +
      td(a.sw + '-' + a.sl, 1) + td(f1(a.al), 1) + td(f1(a.ap), 1) + td(a.woW + a.woL ? '<span class="wo">' + a.woW + 'W ' + a.woL + 'L</span>' : '–', 1) + '</tr>';
  });
  return table([{ t: 'Competition' }, { t: 'P', n: 1 }, { t: 'W', n: 1 }, { t: 'L', n: 1 }, { t: 'Win %', n: 1 }, { t: '' }, { t: 'Sets', n: 1 }, { t: 'Avg opp', n: 1 }, { t: 'Avg perf', n: 1 }, { t: 'Walkovers', n: 1 }], rows);
}
function yearRows(L, label) {
  const rows = YEARS.map(y => {
    const a = agg(L.filter(m => m.d.slice(0, 4) === y)); if (!a.p) return '';
    return '<tr>' + td('<b>' + y + '</b>') + td(a.p, 1) + td('<span class="win">' + a.w + '</span>', 1) + td('<span class="loss">' + a.l + '</span>', 1) + td(pct(a.w, a.p), 1) + td(wlBar(a.w, a.l)) +
      td(a.sw + '-' + a.sl, 1) + td(a.gw + '-' + a.gl, 1) + td(f1(a.al), 1) + td(f1(a.ap), 1) + td(f2(a.rating), 1) + '</tr>';
  }).filter(Boolean);
  const a = agg(L);
  rows.push('<tr>' + td('<b>Total</b>') + td(a.p, 1) + td('<span class="win">' + a.w + '</span>', 1) + td('<span class="loss">' + a.l + '</span>', 1) + td(pct(a.w, a.p), 1) + td(wlBar(a.w, a.l)) + td(a.sw + '-' + a.sl, 1) + td(a.gw + '-' + a.gl, 1) + td(f1(a.al), 1) + td(f1(a.ap), 1) + td(f2(a.rating), 1) + '</tr>');
  return table([{ t: 'Year' }, { t: 'P', n: 1 }, { t: 'W', n: 1 }, { t: 'L', n: 1 }, { t: 'Win %', n: 1 }, { t: '' }, { t: 'Sets', n: 1 }, { t: 'Games', n: 1 }, { t: 'Avg opp lvl', n: 1 }, { t: 'Avg perf', n: 1 }, { t: 'Season rating', n: 1 }], rows);
}
function myRank() {
  const ys = Object.keys(D.rankings).sort(); const y = ys[ys.length - 1], R = D.rankings[y];
  const me = R.rows.find(r => isMe(r.name)); return me ? { y, pos: me.pos, pts: me.vals[R.total], n: R.rows.length } : null;
}
function upcoming() { const t = new Date(); t.setHours(0, 0, 0, 0); return D.next.scheduled.filter(s => new Date(s.date + 'T00:00:00') >= t); }

function pageOverview() {
  const L = flt(), a = agg(L), st = streaks(L), rk = myRank();
  const all = flt({ year: 'all' });
  const rolling = []; for (let i = 9; i < L.length; i++) { const w = L.slice(i - 9, i + 1); rolling.push({ x: fd(L[i].d), y: 100 * w.filter(m => m.res === 'W').length / 10 }); }
  const yrs = YEARS.map(y => { const x = agg(all.filter(m => m.d.slice(0, 4) === y)); return { label: y, w: x.w, l: x.l }; }).filter(r => r.w + r.l);
  const up = D.next.scheduled.slice(0, 3);
  return '<h1>Overview</h1><p class="sub">' + ALL.length + ' matches played between ' + fd(ALL[0].d) + ' and ' + fd(ALL[ALL.length - 1].d) + '. Walkovers are counted in all normal statistics.</p>' + filterBar() +
    '<div class="grid kpis">' + kpi(a.p, 'Matches') + kpi(a.w, 'Wins', '', 'win') + kpi(a.l, 'Losses', '', 'loss') + kpi(pct(a.w, a.p), 'Win rate') +
    kpi(a.sw + '–' + a.sl, 'Sets', pct(a.sw, a.sw + a.sl) + ' won') + kpi(a.gw + '–' + a.gl, 'Games', pct(a.gw, a.gw + a.gl) + ' won') +
    kpi(f1(a.al), 'Avg opponent level', 'scale 1–10') + kpi(f1(a.ap), 'Avg performance', 'self rating 1–10') + kpi(f2(a.rating), 'Rating', 'perf × opp level / 10') +
    kpi(st.cur + st.curRes, 'Current streak', 'best win streak ' + st.best, st.curRes === 'W' ? 'win' : 'loss') +
    (rk ? kpi('#' + rk.pos, 'Club ranking ' + rk.y, rk.pts + ' pts · ' + rk.n + ' players') : '') + kpi(a.woW + a.woL, 'Walkovers', a.woW + 'W / ' + a.woL + 'L (included)', 'wo') + '</div>' +
    '<h2>Recent form <small>last 20 matches (newest on the right)</small></h2><div class="card">' + formStrip(L, 20) + '</div>' +
    '<div class="grid g2"><div><h2>Results by year</h2><div class="card">' + stackChart(yrs) + '</div></div><div><h2>Rolling win rate <small>last 10 matches</small></h2><div class="card">' + lineChart(rolling, { min: 0, max: 100, fmt: v => Math.round(v) + '%' }) + '</div></div></div>' +
    '<h2>By competition <small>league level / Winter League / friendly</small></h2>' + compRows(flt({ cat: 'all' })) +
    '<h2>By year</h2>' + yearRows(flt({ year: 'all' })) +
    '<h2>Latest matches</h2>' + matchTable(L.slice(-10).reverse()) +
    (up.length ? '<h2>Next matches <small><a href="#/next">see all</a></small></h2>' + nextTable(up) : '');
}

function pageMatches() {
  return '<h1>Matches</h1><p class="sub">Every match with score, competition, opponent level and notes.</p>' + filterBar() +
    '<div class="filters"><label>Opponent<input type="search" id="q" placeholder="Search opponent…" value="' + esc(state.q) + '"></label><label>Result<select data-f="res"><option value="all">All</option><option value="W"' + (state.res === 'W' ? ' selected' : '') + '>Wins</option><option value="L"' + (state.res === 'L' ? ' selected' : '') + '>Losses</option></select></label></div>' +
    '<div id="tbl">' + matchesBody() + '</div>';
}
function matchesBody() { const L = flt().slice().reverse(); return '<p class="note">' + L.length + ' matches</p>' + matchTable(L); }

function oppMap(L) { const m = {}; L.forEach(x => (m[x.vs] = m[x.vs] || []).push(x)); return m; }
function playersBody() {
  const map = oppMap(flt());
  let rows = Object.keys(map).map(n => {
    const l = map[n], a = agg(l), info = D.players[n] || {}, last = l[l.length - 1];
    return { n, a, lang: info.lang || '', lvl: info.level != null ? info.level : a.al, last, p: a.p, w: a.w, l: a.l, pct: a.pct, d: last.d };
  });
  if (state.pq) rows = rows.filter(r => r.n.toLowerCase().indexOf(state.pq.toLowerCase()) >= 0);
  const k = state.sort.key, dir = state.sort.dir;
  rows.sort((x, y) => { const a = k === 'n' ? x.n : x[k], b = k === 'n' ? y.n : y[k]; return (a > b ? 1 : a < b ? -1 : 0) * dir || y.p - x.p; });
  return '<p class="note">' + rows.length + ' opponents</p>' + table([{ t: 'Opponent', sort: 'n' }, { t: 'Lang' }, { t: 'Level', n: 1, sort: 'lvl' }, { t: 'P', n: 1, sort: 'p' }, { t: 'W', n: 1, sort: 'w' }, { t: 'L', n: 1, sort: 'l' }, { t: 'Win %', n: 1, sort: 'pct' }, { t: '' }, { t: 'Sets', n: 1 }, { t: 'Last played', sort: 'd' }, { t: 'Last' }],
    rows.map(r => '<tr>' + td(playerLink(r.n)) + td(r.lang) + td(r.lvl == null ? '–' : (+r.lvl).toFixed(r.lvl % 1 ? 1 : 0), 1) + td(r.p, 1) + td('<span class="win">' + r.w + '</span>', 1) + td('<span class="loss">' + r.l + '</span>', 1) + td(pct(r.w, r.p), 1) + td(wlBar(r.w, r.l)) +
      td(r.a.sw + '-' + r.a.sl, 1) + td(fd(r.d)) + td(badge(r.last.res)) + '</tr>'));
}
function pagePlayers() {
  return '<h1>Players</h1><p class="sub">Every opponent faced, with head-to-head record. Click a name for the full history.</p>' + filterBar() +
    '<div class="filters"><label>Search<input type="search" id="pq" placeholder="Search player…" value="' + esc(state.pq) + '"></label></div><div id="tbl">' + playersBody() + '</div>';
}
function pagePlayer(name) {
  const L = ALL.filter(m => m.vs === name), a = agg(L), info = D.players[name] || {};
  if (!L.length) return '<h1>Player not found</h1><a href="#/players">← Players</a>';
  const perfPts = L.map(m => ({ x: fd(m.d), y: m.perf })).filter(p => p.y != null);
  return '<a href="#/players">← All players</a><h1>' + esc(name) + '</h1><p class="sub">' + (info.lang ? 'Language: ' + info.lang + ' · ' : '') + 'Level ' + (info.level != null ? info.level : f1(a.al)) + ' · first met ' + fd(L[0].d) + ' · last met ' + fd(L[L.length - 1].d) + '</p>' +
    '<div class="grid kpis">' + kpi(a.w + '–' + a.l, 'Head to head', pct(a.w, a.p) + ' win rate', a.w >= a.l ? 'win' : 'loss') + kpi(a.p, 'Matches') + kpi(a.sw + '–' + a.sl, 'Sets') + kpi(a.gw + '–' + a.gl, 'Games') + kpi(f1(a.ap), 'My avg performance') + kpi(a.woW + a.woL, 'Walkovers', '', 'wo') + '</div>' +
    '<h2>Form vs this player</h2><div class="card">' + formStrip(L, 40) + '</div>' +
    '<div class="grid g2"><div><h2>By competition</h2>' + compRows(L) + '</div><div><h2>My performance rating by match</h2><div class="card">' + lineChart(perfPts, { min: 0, max: 10 }) + '</div></div></div>' +
    '<h2>All matches</h2>' + matchTable(L.slice().reverse(), { noVs: true });
}

function pageStats() {
  const L = flt(), a = agg(L);
  const lvl = [], perf = [];
  for (let i = 1; i <= 10; i++) {
    const x = agg(L.filter(m => m.lvl === i)); if (x.p) lvl.push({ label: 'Level ' + i, v: 100 * x.w / x.p, right: x.w + 'W ' + x.l + 'L · ' + pct(x.w, x.p) });
    const y = agg(L.filter(m => m.perf === i)); if (y.p) perf.push({ label: 'Rating ' + i, v: 100 * y.w / y.p, right: y.w + 'W ' + y.l + 'L · ' + pct(y.w, y.p) });
  }
  const months = MON.map((mn, i) => { const x = agg(L.filter(m => +m.d.slice(5, 7) === i + 1)); return { label: mn, w: x.w, l: x.l }; });
  const imp = {}; L.forEach(m => { if (m.imp) { const o = imp[m.imp] = imp[m.imp] || { w: 0, l: 0 }; if (m.res === 'W') o.w++; else o.l++; } });
  const impRows = Object.keys(imp).sort((x, y) => (imp[y].w + imp[y].l) - (imp[x].w + imp[x].l));
  const impMax = Math.max.apply(null, impRows.map(k => imp[k].w + imp[k].l).concat([1]));
  const wo = L.filter(m => m.wo), woa = agg(wo);
  const seasons = {}; L.forEach(m => { if (m.league) (seasons[m.league] = seasons[m.league] || []).push(m); });
  const sRows = Object.keys(seasons).sort((x, y) => seasons[x][0].d < seasons[y][0].d ? -1 : 1).map(k => {
    const x = agg(seasons[k]); return '<tr>' + td(compTag(seasons[k][0])) + td(fd(seasons[k][0].d) + ' → ' + fd(seasons[k][seasons[k].length - 1].d)) + td(x.p, 1) + td('<span class="win">' + x.w + '</span>', 1) + td('<span class="loss">' + x.l + '</span>', 1) + td(pct(x.w, x.p), 1) + td(wlBar(x.w, x.l)) + td(x.sw + '-' + x.sl, 1) + td(x.gw + '-' + x.gl, 1) + td(x.woW + x.woL, 1) + '</tr>';
  });
  const rq = D.racquets.map(r => '<tr>' + td(esc(r.name)) + td(r.played, 1) + td('<span class="win">' + r.w + '</span>', 1) + td('<span class="loss">' + r.l + '</span>', 1) + td(pct(r.w, r.played), 1) + td(wlBar(r.w, r.l)) + '</tr>');
  const surf = agg(L.filter(m => m.surface === 'Hard'));
  const longest = L.filter(m => m.dur).sort((x, y) => y.dur.localeCompare(x.dur)).slice(0, 5);
  return '<h1>Player statistics</h1><p class="sub">All figures follow the filters below. Walkovers are included unless you change the filter.</p>' + filterBar() +
    '<div class="grid kpis">' + kpi(a.p, 'Matches') + kpi(pct(a.w, a.p), 'Win rate', a.w + 'W · ' + a.l + 'L') + kpi(pct(a.sw, a.sw + a.sl), 'Sets won', a.sw + '–' + a.sl) + kpi(pct(a.gw, a.gw + a.gl), 'Games won', a.gw + '–' + a.gl) +
    kpi(a.straightW, 'Won in straight sets', pct(a.straightW, a.w) + ' of wins') + kpi(a.behindW, 'Won after losing a set') + kpi(a.straightL, 'Lost in straight sets') + kpi(a.aheadL, 'Lost after winning a set') +
    kpi(a.s3w + '–' + a.s3l, 'Three-set matches', pct(a.s3w, a.s3w + a.s3l) + ' won') + kpi(a.tbw + '–' + a.tbl, 'Tie-break sets (7-6)', pct(a.tbw, a.tbw + a.tbl) + ' won') + kpi(a.stw + '–' + a.stl, 'Match tie-breaks (10 pts)') + kpi(a.bw + '–' + a.bl, '6-0 sets won – lost', 'bagels') + '</div>' +
    '<h2>Per year</h2>' + yearRows(flt({ year: 'all' })) +
    '<h2>Per competition <small>league level, Winter League, playoffs, friendly</small></h2>' + compRows(flt({ cat: 'all' })) +
    '<h2>Per league season</h2>' + table([{ t: 'Season' }, { t: 'Period' }, { t: 'P', n: 1 }, { t: 'W', n: 1 }, { t: 'L', n: 1 }, { t: 'Win %', n: 1 }, { t: '' }, { t: 'Sets', n: 1 }, { t: 'Games', n: 1 }, { t: 'WO', n: 1 }], sRows) +
    '<div class="grid g2"><div><h2>Win rate by opponent level</h2><div class="card">' + barRows(lvl) + '</div></div><div><h2>Win rate by my performance rating</h2><div class="card">' + barRows(perf) + '</div></div></div>' +
    '<div class="grid g2"><div><h2>Results by month of the year</h2><div class="card">' + stackChart(months) + '</div></div><div><h2>Areas to improve <small>noted after the match</small></h2><div class="card">' +
    (impRows.length ? barRows(impRows.map(k => ({ label: esc(k), v: imp[k].w + imp[k].l, right: imp[k].w + imp[k].l + ' (' + imp[k].w + 'W ' + imp[k].l + 'L)', color: '#4f9dff' })), { max: impMax }) : '<div class="empty">No notes</div>') + '</div></div></div>' +
    '<div class="grid g2"><div><h2>Walkovers <small>separate statistic, already included above</small></h2><div class="card"><p>' + wo.length + ' walkover matches in this filter: <b class="win">' + woa.w + ' W</b> · <b class="loss">' + woa.l + ' L</b></p><p class="note">' +
    ['league', 'winter', 'playoff', 'friendly'].map(c => { const x = wo.filter(m => m.cat === c); return x.length ? { league: 'League', winter: 'Winter League', playoff: 'Playoffs', friendly: 'Friendly' }[c] + ': ' + x.length : ''; }).filter(Boolean).join(' · ') + '</p>' +
    matchTable(wo.slice().reverse().slice(0, 12)) + '</div></div>' +
    '<div><h2>Equipment & conditions</h2>' + table([{ t: 'Racquet' }, { t: 'P', n: 1 }, { t: 'W', n: 1 }, { t: 'L', n: 1 }, { t: 'Win %', n: 1 }, { t: '' }], rq) +
    '<div class="card" style="margin-top:12px"><p>Hard court (tagged): <b>' + surf.w + 'W ' + surf.l + 'L</b> in ' + surf.p + ' matches.</p>' +
    (longest.length ? '<p class="note">Longest matches: ' + longest.map(m => esc(m.vs) + ' (' + m.dur + ' h)').join(', ') + '</p>' : '') + '</div></div></div>';
}

/* ---------------------------------------------------------------- ranking */
function rankingBody() {
  const y = state.ry, R = D.rankings[y];
  let rows = R.rows; if (state.rq) rows = rows.filter(r => r.name.toLowerCase().indexOf(state.rq.toLowerCase()) >= 0);
  const tr = c => c.replace(/^Po[čc]et bodov$/i, 'Total points').replace(/^Body za rok (\d+)/, 'Pts from $1').replace(/^Differenza$/, 'Difference')
    .replace(/^Punti da inizio anno$/, 'Pts since Jan').replace(/^Punti senza (\d+)/, 'Pts without $1').replace(/^Turnaj č\.\s*/, 'T').replace(/^Masters č\.?\s*/, 'Masters ');
  const heads = [{ t: '#', n: 1 }, { t: 'Player' }].concat(R.cols.map(c => ({ t: esc(tr(c)), n: 1 })));
  const out = rows.map(r => '<tr class="' + (isMe(r.name) ? 'me' : '') + '">' + td(r.pos, 1) + td(esc(r.name)) + r.vals.map((v, i) => td(v == null || v === '' ? '' : (v === 0 && i !== R.total ? '<span class="muted">·</span>' : (typeof v === 'number' ? v.toLocaleString('en-GB') : esc(v))), 1)).join('') + '</tr>');
  return table(heads, out);
}
function pageRanking() {
  const ys = Object.keys(D.rankings).sort().reverse();
  if (!state.ry) state.ry = ys[0];
  const R = D.rankings[state.ry], top = R.rows.slice(0, 3);
  const mine = Object.keys(D.rankings).sort().map(y => { const r = D.rankings[y], me = r.rows.find(x => isMe(x.name)); return me ? '<tr>' + td('<b>' + y + '</b>') + td('#' + me.pos, 1) + td(me.vals[r.total], 1) + td(r.rows.length, 1) + '</tr>' : ''; });
  const rh = D.rankHistory.map(h => ({ x: h.d.slice(0, 7), y: h.rank }));
  return '<h1>Club ranking</h1><p class="sub">Season ranking by tournament points, kept separate from the match statistics.</p>' +
    '<div class="filters"><label>Season<div class="pills">' + ys.map(y => '<span class="pill ' + (state.ry === y ? 'on' : '') + '" data-ry="' + y + '">' + y + '</span>').join('') + '</div></label>' +
    '<label>Search<input type="search" id="rq" placeholder="Search player…" value="' + esc(state.rq || '') + '"></label></div>' +
    '<div class="podium">' + top.map(r => '<div class="card"><div class="pos">' + r.pos + '</div><div><b>' + esc(r.name) + '</b></div><div class="muted">' + r.vals[R.total] + ' pts</div></div>').join('') + '</div>' +
    '<div id="tbl">' + rankingBody() + '</div>' +
    '<div class="grid g2"><div><h2>My position by season</h2>' + table([{ t: 'Season' }, { t: 'Position', n: 1 }, { t: 'Points', n: 1 }, { t: 'Players', n: 1 }], mine) + '</div>' +
    '<div><h2>My ranking over time <small>lower is better</small></h2><div class="card">' + lineChart(rh, { invert: true, fmt: v => '#' + Math.round(v) }) + '</div></div></div>' +
    (R.scale.length ? '<h2>Points per finishing position</h2><div class="card chips">' + R.scale.map(s => '<span class="chip">' + s[0] + '. → <b>' + s[1] + '</b></span>').join('') + '</div>' : '');
}

/* ---------------------------------------------------------------- leagues */
function pageLeagues() {
  const L = flt({ cat: 'comp', year: 'all' }), by = {};
  L.forEach(m => (by[m.league] = by[m.league] || []).push(m));
  const keys = Object.keys(by).sort((x, y) => by[y][0].d < by[x][0].d ? -1 : 1);
  const cards = keys.map(k => {
    const l = by[k], a = agg(l), mp = oppMap(l);
    return '<div class="card"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">' + '<div>' + compTag(l[0]) + '<div class="note">' + fd(l[0].d) + ' → ' + fd(l[l.length - 1].d) + '</div></div>' +
      '<div style="text-align:right"><b style="font-size:20px">' + a.w + '–' + a.l + '</b> <span class="muted">' + pct(a.w, a.p) + '</span></div></div>' + wlBar(a.w, a.l) +
      '<p class="note">Sets ' + a.sw + '–' + a.sl + ' · Games ' + a.gw + '–' + a.gl + ' · Avg opp ' + f1(a.al) + ' · Avg perf ' + f1(a.ap) + (a.woW + a.woL ? ' · <span class="wo">Walkovers ' + a.woW + 'W ' + a.woL + 'L</span>' : '') + '</p>' +
      '<div class="chips">' + l.map(m => '<span class="chip ' + m.res + '" title="' + esc(fd(m.d) + ' ' + scoreStr(m)) + '">' + esc(m.vs) + (m.wo ? ' <span class="wo">WO</span>' : '') + '</span>').join('') + '</div></div>';
  });
  const ladder = LEVELS.map(lv => { const x = agg(L.filter(m => m.cat === 'league' && m.ll === lv)); return '<tr>' + td('<span class="tag lg">' + lv + '° League</span>') + td(x.p, 1) + td('<span class="win">' + x.w + '</span>', 1) + td('<span class="loss">' + x.l + '</span>', 1) + td(pct(x.w, x.p), 1) + td(wlBar(x.w, x.l)) + '</tr>'; });
  const wl = D.events.filter(e => /winter/i.test(e.name));
  return '<h1>Leagues</h1><p class="sub">Every league season, Winter League and playoff block. Walkovers are included and tagged.</p>' +
    '<div class="grid g2"><div><h2>League ladder <small>all seasons by level</small></h2>' + table([{ t: 'Level' }, { t: 'P', n: 1 }, { t: 'W', n: 1 }, { t: 'L', n: 1 }, { t: 'Win %', n: 1 }, { t: '' }], ladder) + '</div>' +
    '<div><h2>Winter League standings</h2>' + (wl.length ? wl.map(eventCard).join('') : '<div class="empty">No standings</div>') + '</div></div>' +
    '<h2>Seasons <small>newest first</small></h2><div class="grid g2">' + cards.join('') + '</div>';
}

/* ---------------------------------------------------------------- tournaments */
function eventCard(e) {
  const keep = [0, 1, 2, 3, 4, 5].filter(c => e.rows.some(r => r[c] != null && r[c] !== ''));
  const rows = e.rows.filter(r => keep.some(c => r[c] != null && r[c] !== ''));
  const cell = v => { if (v == null || v === '') return '<td></td>'; if (v === 'W' || v === 'L') return '<td>' + badge(v) + '</td>'; return '<td' + (typeof v === 'string' && isMe(v) ? ' style="color:var(--accent);font-weight:700"' : '') + '>' + esc(v) + '</td>'; };
  const head = rows.length && rows[0].filter(x => typeof x === 'string').length >= 3 && rows[0].some(x => /player/i.test(String(x)));
  return '<div class="card" style="margin-bottom:12px"><b>' + esc(e.name) + '</b> <span class="muted">' + e.year + '</span><div class="tablewrap grid-ev" style="margin-top:8px"><table>' +
    rows.map((r, i) => '<tr' + (head && i === 0 ? ' style="color:var(--muted);font-weight:700"' : '') + '>' + keep.map(c => cell(r[c])).join('') + '</tr>').join('') + '</table></div></div>';
}
function pageTournaments() {
  const ev = D.events.slice().sort((a, b) => b.year - a.year);
  return '<h1>Tournaments & results</h1><p class="sub">Brackets, consolation rounds, doubles and league finals recorded in the workbook.</p><div class="grid g2">' + ev.map(eventCard).join('') + '</div>';
}

/* ---------------------------------------------------------------- next matches */
function h2h(name) { const l = ALL.filter(m => m.vs === name), a = agg(l); return l.length ? '<b>' + a.w + '–' + a.l + '</b> <span class="muted">(' + a.p + ' matches, last: ' + fd(l[l.length - 1].d) + ' ' + badge(l[l.length - 1].res) + ')</span>' : '<span class="muted">first meeting</span>'; }
function nextTable(list) {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return table([{ t: 'Date' }, { t: 'Day' }, { t: 'Time' }, { t: 'Opponent' }, { t: 'Head to head' }, { t: 'Level', n: 1 }, { t: 'When' }], list.map(s => {
    const d = new Date(s.date + 'T00:00:00'), diff = Math.round((d - t) / 864e5), info = D.players[s.player] || {};
    return '<tr>' + td('<b>' + fd(s.date) + '</b>') + td(d.toLocaleDateString('en-GB', { weekday: 'long' })) + td(esc(s.time)) + td(playerLink(s.player)) + td(h2h(s.player)) + td(info.level != null ? info.level : '–', 1) + td(diff < 0 ? '<span class="muted">past</span>' : diff === 0 ? '<b class="win">today</b>' : 'in ' + diff + ' days') + '</tr>';
  }));
}
function pageNext() {
  const last = ALL.slice().reverse().find(m => m.league) || ALL[ALL.length - 1], seasonL = ALL.filter(m => m.league === last.league), a = agg(seasonL), n = D.next;
  return '<h1>Next matches</h1><p class="sub">Scheduled matches, opponents still to play and the available court slots.</p>' +
    '<div class="grid kpis">' + kpi(n.scheduled.length, 'Scheduled matches') + kpi(upcoming().length, 'Still to come') + kpi(esc(last.league || 'Friendly'), 'Current competition', a.w + 'W – ' + a.l + 'L so far') + '</div>' +
    '<h2>Schedule</h2>' + (n.scheduled.length ? nextTable(n.scheduled) : '<div class="card empty">Nothing scheduled</div>') +
    '<div class="grid g2"><div><h2>Matches still missing <small>opponents not yet played this season</small></h2>' + (n.missing.length ? table([{ t: 'Opponent' }, { t: 'Head to head' }], n.missing.map(p => '<tr>' + td(playerLink(p)) + td(h2h(p)) + '</tr>')) : '<div class="card empty">None</div>') + (n.notes.length ? '<p class="note">' + n.notes.map(esc).join('<br>') + '</p>' : '') + '</div>' +
    '<div><h2>Court slots</h2>' + table([{ t: 'Day' }, { t: 'Time slots' }], n.slots.map(s => '<tr>' + td('<b>' + s.day + '</b>') + td(s.times.map(t => '<span class="tag">' + t + '</span>').join('')) + '</tr>')) + '</div></div>';
}

/* ---------------------------------------------------------------- development */
function pageDev() {
  const G = D.goals, years = G.ratings;
  const skills = G.skills.map(s => '<div class="card skill"><h3>' + esc(s.name) + '</h3><ul>' + s.items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul></div>').join('');
  const rate = G.skills.map((s, i) => '<div class="rate"><div>' + esc(s.name) + '</div><div class="track" style="background:var(--panel2);border-radius:5px;height:14px;position:relative;overflow:hidden">' +
    years.map((y, k) => y.vals[i] == null ? '' : '<div style="position:absolute;left:0;top:' + k * 4.7 + 'px;height:4px;width:' + y.vals[i] * 10 + '%;background:' + ['#4f9dff', '#f59e0b', '#b6f23a'][k % 3] + '"></div>').join('') + '</div><div class="muted">' + years.map(y => y.vals[i] == null ? '' : y.vals[i]).join(' / ') + '</div></div>').join('');
  const L = ALL, imp = {}; L.forEach(m => { if (m.imp) { const o = imp[m.imp] = imp[m.imp] || { w: 0, l: 0 }; if (m.res === 'W') o.w++; else o.l++; } });
  const keys = Object.keys(imp).sort((a, b) => (imp[b].w + imp[b].l) - (imp[a].w + imp[a].l));
  return '<h1>Development</h1><p class="sub">Technical goals, self-ratings by year and recurring areas to improve.</p>' +
    '<h2>Self-rating by skill <small>' + years.map((y, k) => '<span style="color:' + ['#4f9dff', '#f59e0b', '#b6f23a'][k % 3] + '">■ ' + y.year + '</span>').join(' &nbsp; ') + '</small></h2><div class="card">' + rate + '</div>' +
    '<h2>Goals by area</h2><div class="grid g3">' + skills + '</div>' +
    '<h2>Areas to improve noted after matches</h2><div class="card">' + barRows(keys.map(k => ({ label: esc(k), v: imp[k].w + imp[k].l, right: imp[k].w + imp[k].l + ' (' + imp[k].w + 'W ' + imp[k].l + 'L)', color: '#4f9dff' })), { max: Math.max.apply(null, keys.map(k => imp[k].w + imp[k].l).concat([1])) }) + '</div>' +
    (G.quotes.length ? '<h2>Reminders</h2>' + G.quotes.map(q => '<div class="quote">' + esc(q) + '</div>').join('') : '');
}

/* ---------------------------------------------------------------- router */
const NAV = [['overview', 'Overview'], ['matches', 'Matches'], ['players', 'Players'], ['stats', 'Statistics'], ['ranking', 'Ranking'], ['leagues', 'Leagues'], ['tournaments', 'Tournaments'], ['next', 'Next matches'], ['development', 'Development']];
const PAGES = { overview: pageOverview, matches: pageMatches, players: pagePlayers, stats: pageStats, ranking: pageRanking, leagues: pageLeagues, tournaments: pageTournaments, next: pageNext, development: pageDev };
function route() {
  const p = (location.hash || '#/overview').replace(/^#\/?/, '').split('/');
  const name = p[0] || 'overview';
  const html = name === 'player' ? pagePlayer(decodeURIComponent(p.slice(1).join('/'))) : (PAGES[name] || pageOverview)();
  $('#nav').innerHTML = NAV.map(n => '<a href="#/' + n[0] + '" class="' + (n[0] === name || (name === 'player' && n[0] === 'players') ? 'on' : '') + '">' + n[1] + '</a>').join('');
  $('#app').innerHTML = html;
  $('#foot').innerHTML = 'Data from <b>' + esc(D.source) + '</b> · generated ' + esc(D.generated) + ' · ' + ALL.length + ' matches. Walkovers count in the normal statistics.';
  window.scrollTo(0, 0);
}
function rerender() { const y = window.scrollY; route(); window.scrollTo(0, y); }

document.addEventListener('click', e => {
  const t = e.target.closest('[data-year],[data-ry],[data-sort]'); if (!t) return;
  if (t.dataset.year) { state.year = t.dataset.year; rerender(); }
  else if (t.dataset.ry) { state.ry = t.dataset.ry; rerender(); }
  else if (t.dataset.sort) { const k = t.dataset.sort; state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : (k === 'n' ? 1 : -1) }; $('#tbl').innerHTML = playersBody(); }
});
document.addEventListener('change', e => { const f = e.target.dataset.f; if (f) { state[f] = e.target.value; rerender(); } });
document.addEventListener('input', e => {
  if (e.target.id === 'q') { state.q = e.target.value; $('#tbl').innerHTML = matchesBody(); }
  else if (e.target.id === 'pq') { state.pq = e.target.value; $('#tbl').innerHTML = playersBody(); }
  else if (e.target.id === 'rq') { state.rq = e.target.value; $('#tbl').innerHTML = rankingBody(); }
});
window.addEventListener('hashchange', route);
route();
})();
