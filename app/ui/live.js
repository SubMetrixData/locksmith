// Locksmith :: Live betting. Every game in progress (football, hockey, basketball), refreshed every 30 seconds:
// ESPN's live scoreboard + DraftKings' live lines, priced with Locksmith's in-game models (the same LightGBM models
// behind the Watch screen, exported to reports/live_models.json and evaluated here in the browser).
const LV = {models: null, timer: null, games: [], filter: 'all', updated: null, busy: false, err: null, hist: {}, open: {}};
const LSP = {nfl: ['football', 'nfl', 'Football'], nba: ['basketball', 'nba', 'Basketball'], nhl: ['hockey', 'nhl', 'Hockey']};
const LIVE_EDGE = 0.04, LIVE_EV = 0.04;                          // a live bet needs 4%+ more chance than the no-vig price and +4% value

// ---------------------------------------------------------------- model evaluation
function gbm(m, obj) {
  const x = m.features.map(f => obj[f]);
  let s = 0;
  for (const t of m.trees) {
    let n = t;
    while (Array.isArray(n)) {
      const v = x[n[0]];
      let left;
      if (v == null || Number.isNaN(v)) left = n[3] === 2 ? n[2] === 1 : 0 <= n[1];
      else if (n[3] === 1 && v === 0) left = n[2] === 1;
      else left = v <= n[1];
      n = left ? n[4] : n[5];
    }
    s += n;
  }
  return m.objective === 'binary' ? 1 / (1 + Math.exp(-s)) : m.objective === 'poisson' ? Math.exp(s) : s;
}
const Phi = z => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
const PhiInv = p => { p = Math.min(Math.max(p, 1e-6), 1 - 1e-6); let lo = -8, hi = 8; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
const poisCdf = (k, l) => { if (k < 0) return 0; let s = 0, t = Math.exp(-l); for (let i = 0; i <= k; i++) { s += t; t *= l / (i + 1); } return Math.min(s, 1); };
const amImp = a => a == null || Number.isNaN(+a) ? null : a < 0 ? -a / (-a + 100) : 100 / (+a + 100);
const amPay = a => a < 0 ? 100 / -a : a / 100;
const clockSecs = c => { if (c == null) return 0; const s = String(c); if (s.includes(':')) { const [m, x] = s.split(':'); return 60 * +m + +x; } return +s || 0; };
const lpct = p => `${Math.round(100 * p)}%`;
const fairAm = p => !(p > 0 && p < 1) ? '–' : p >= .5 ? '−' + Math.round(100 * p / (1 - p)) : '+' + Math.round(100 * (1 - p) / p);

// ---------------------------------------------------------------- per-sport game state -> Locksmith prices
function priceGame(g) {
  const M = LV.models[g.sport], pre = g.pre || {}, H = g.hs, A = g.as, margin = H - A;
  const preSpread = pre.spread != null ? pre.spread : 0;   // home spread, − = home favoured
  const preTotal = pre.total != null ? pre.total : ({nba: 225, nfl: 45, nhl: 6}[g.sport]);
  let p, mu, sdm, tmean, sdt, f, totalDist = null;
  if (g.sport === 'nba') {
    const cs = clockSecs(g.clock), secs = g.period <= 4 ? (4 - g.period) * 720 + cs : cs;
    const x = {margin, secs_left: secs, period: g.period, pre_margin: -preSpread, pre_total: preTotal, pts_so_far: H + A, margin_x_time: margin / Math.sqrt(secs / 60 + 1)};
    p = gbm(M.win, x); const rem = gbm(M.rem, x);
    f = Math.min(secs / 2880, 1.2); sdm = 13.57 * Math.sqrt(f) + 1.13; sdt = 14.65 * Math.sqrt(f) + 3.61;
    mu = sdm * PhiInv(p); tmean = H + A + rem;
  } else if (g.sport === 'nfl') {
    const cs = clockSecs(g.clock), q = g.period, secs = q <= 4 ? (4 - q) * 900 + cs : cs, half = q === 1 || q === 3 ? 900 + cs : cs;
    const s = g.sit || {};
    const x = {margin, secs, half_secs: half, qtr: Math.min(q, 5), home_poss: s.home_poss, yl: s.yl, down: s.down, ydstogo: s.ydstogo, home_to: s.home_to ?? 3, away_to: s.away_to ?? 3,
      spread: -preSpread, total_line: preTotal};
    const tf = Math.min(Math.max(secs / 3600, 0), 1.2);
    x.margin_t = margin / Math.sqrt(tf + 0.01); x.spread_t = x.spread * tf;
    const side = s.home_poss === 1 ? 1 : s.home_poss === 0 ? -1 : 0; x.ep_home = side * (6 - 0.068 * (s.yl ?? 75));
    p = gbm(M.win, x); mu = margin + gbm(M.margin, x);
    const remT = 0.5 * gbm(M.total, x) + 0.5 * preTotal * Math.min(Math.max(secs / 3600, 0), 1);
    f = tf; sdm = 13.2 * Math.sqrt(f) + 1.5; sdt = 12.5 * Math.sqrt(f) + 2; tmean = H + A + remT;
  } else {
    const cs = clockSecs(g.clock), secs = g.period <= 3 ? (3 - g.period) * 1200 + cs : cs;
    const ph = pre.ml_home != null && pre.ml_away != null ? amImp(pre.ml_home) / (amImp(pre.ml_home) + amImp(pre.ml_away)) : 0.54;
    const x = {margin, secs_left: secs, period: g.period, ot: g.period >= 4 ? 1 : 0, adv: 0, h_empty: 0, a_empty: 0, pre_logit: Math.log(ph / (1 - ph)), pre_total: preTotal, goals_so_far: H + A};
    p = gbm(M.win, x); const lam = Math.max(gbm(M.rem, x), 0.01);
    f = Math.min(secs / 3600, 1.1); totalDist = {base: H + A, lam}; tmean = H + A + lam;
    sdm = 2.4 * Math.sqrt(f) + 0.4; mu = sdm * PhiInv(p);
  }
  const coverHome = s => Phi((mu + s) / sdm);                         // P(home margin + spread > 0)
  const over = L => totalDist ? 1 - poisCdf(Math.floor(L - totalDist.base), totalDist.lam) : 1 - Phi((L - tmean) / sdt);
  return {p, mu, tmean, f, coverHome, over, fairSpread: -mu, sdm};
}

// every side every book offers live: Locksmith's chance, the book's no-vig chance, and the market consensus (median of books)
const med = a => { const v = a.filter(x => x != null && !Number.isNaN(x)).sort((x, y) => x - y); return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null; };
const nv2 = (a, b) => { const x = amImp(a), y = amImp(b); return x != null && y != null ? x / (x + y) : null; };
function sides(g, pr) {
  const B = g.books || []; if (!B.length) return [];
  // the market's view of who wins: median no-vig moneyline across books; a book far from it is lagging (stale)
  const mlNv = B.map(b => nv2(b.ml_home, b.ml_away));
  g.mkt_home = med(mlNv);
  B.forEach((b, k) => { b.stale = g.mkt_home != null && mlNv[k] != null && Math.abs(mlNv[k] - g.mkt_home) > 0.06; });
  g.disagree = g.mkt_home != null ? Math.abs(pr.p - g.mkt_home) : 0;
  // consensus lines: books posting a line far from the median line are a step behind the game
  const tol = {nba: 1, nfl: 0.5, nhl: 0}[g.sport];
  g.cons_spread = med(B.map(b => b.spread)); g.cons_total = med(B.map(b => b.total));
  const out = [];
  const add = (b, label, key, market, p, price, other, cons) => {
    if (price == null || p == null) return;
    const nv = nv2(price, other) ?? amImp(price) / 1.045;
    const ln = market === 'spread' ? b.spread : market === 'total' ? b.total : null, cl = market === 'spread' ? g.cons_spread : g.cons_total;
    const offline = ln != null && cl != null && Math.abs(Math.abs(ln) - Math.abs(cl)) > tol + 1e-9;
    out.push({book: b.book, stale: b.stale || offline, label, key, market, p, price, novig: nv, cons: cons ?? nv, edge: p - (cons ?? nv), ev: p * amPay(price) - (1 - p)});
  };
  for (const b of B) {
    add(b, `${g.home} moneyline`, 'mlh', 'ml', pr.p, b.ml_home, b.ml_away, g.mkt_home);
    add(b, `${g.away} moneyline`, 'mla', 'ml', 1 - pr.p, b.ml_away, b.ml_home, g.mkt_home != null ? 1 - g.mkt_home : null);
    if (b.spread != null && g.sport !== 'nhl') {
      const ph = pr.coverHome(b.spread), sh = b.spread;
      const same = B.filter(x => x.spread === sh).map(x => nv2(x.spread_home, x.spread_away)), cs = med(same);
      add(b, `${g.home} ${sh > 0 ? '+' : ''}${sh}`, 'sph' + sh, 'spread', ph, b.spread_home, b.spread_away, cs);
      add(b, `${g.away} ${-sh > 0 ? '+' : ''}${-sh}`, 'spa' + sh, 'spread', 1 - ph, b.spread_away, b.spread_home, cs != null ? 1 - cs : null);
    }
    if (b.total != null) {
      const po = pr.over(b.total), t = b.total;
      const same = B.filter(x => x.total === t).map(x => nv2(x.over, x.under)), ct = med(same);
      add(b, `Over ${t}`, 'ov' + t, 'total', po, b.over, b.under, ct);
      add(b, `Under ${t}`, 'un' + t, 'total', 1 - po, b.under, b.over, ct != null ? 1 - ct : null);
    }
  }
  return out;
}
// the best price for each side, and whether it is a live bet
function bestSides(g) {
  const by = {};
  for (const x of g.sides || []) { if (x.stale) continue; const k = x.key; if (!by[k] || amPay(x.price) > amPay(by[k].price)) by[k] = x; }
  return Object.values(by);
}
// conservative: the late game is excluded, a moneyline needs ESPN's independent model to lean the same way against the
// market, spreads / totals need a bigger edge at the consensus line
function isLiveBet(g, x) {
  if (!g.pr || g.pr.f <= 0.05 || g.disagree > 0.20 || x.stale) return false;
  if (x.market === 'ml') {
    const home = x.key === 'mlh', pm = home ? g.mkt_home : 1 - g.mkt_home, pe = g.espn_wp == null ? null : (home ? g.espn_wp : 1 - g.espn_wp);
    const espnOk = pe == null ? g.sport === 'nhl' && x.edge >= 0.07 : pe - pm >= 0.02;
    return espnOk && x.edge >= 0.05 && x.ev >= 0.05;
  }
  return false;          // live spreads / totals: shown as Locksmith's fair numbers only until the recorded live lines can test them
}

// ---------------------------------------------------------------- data
async function lj(u) {
  try { const r = await fetch(u, {cache: 'no-store'}); if (!r.ok) throw new Error(r.status); return await r.json(); }
  catch (err) { if (api() && api().live_fetch) { const j = await api().live_fetch(u); if (j && !j.error) return j; } throw err; }   // desktop: fetch through Python
}
function oddsItem(items, live) {
  return (items || []).find(it => ((it.provider || {}).name || '').includes('DraftKings') && (((it.provider || {}).name || '').includes('Live') === live));
}
function oddsOf(it) {
  if (!it) return null;
  const h = it.homeTeamOdds || {}, a = it.awayTeamOdds || {};
  return {spread: it.spread ?? null, total: it.overUnder ?? null, over: it.overOdds ?? null, under: it.underOdds ?? null, ml_home: h.moneyLine ?? null, ml_away: a.moneyLine ?? null,
    spread_home: h.spreadOdds ?? null, spread_away: a.spreadOdds ?? null};
}
const AN_BOOKS = {68: 'DraftKings', 69: 'FanDuel', 71: 'BetRivers', 75: 'BetMGM', 79: 'bet365', 1005: 'Caesars'};
function anBooks(game) {
  const out = [];
  for (const [bid, m] of Object.entries(game.markets || {})) {
    if (!AN_BOOKS[bid]) continue;
    const ev = (m || {}).event || {}, b = {book: AN_BOOKS[bid]};
    let any = false;
    for (const o of ev.moneyline || []) if (o.is_live) { any = true; if (o.side === 'home') b.ml_home = o.odds; else if (o.side === 'away') b.ml_away = o.odds; }
    for (const o of ev.spread || []) if (o.is_live) { any = true; if (o.side === 'home') { b.spread = o.value; b.spread_home = o.odds; } else if (o.side === 'away') b.spread_away = o.odds; }
    for (const o of ev.total || []) if (o.is_live) { any = true; b.total = o.value; if (o.side === 'over') b.over = o.odds; else if (o.side === 'under') b.under = o.odds; }
    if (any) out.push(b);
  }
  return out;
}
async function liveFetch(sport) {
  const [s, l] = LSP[sport];
  const sb = await lj(`https://site.api.espn.com/apis/site/v2/sports/${s}/${l}/scoreboard`);
  const code = sport === 'nhl' ? nhlCode : sport === 'nfl' ? nflCode : nbaCode;
  const games = [];
  for (const e of sb.events || []) {
    const st = e.status || {}, ty = st.type || {};
    const c = e.competitions[0], cp = {}; c.competitors.forEach(x => cp[x.homeAway] = x);
    const g = {sport, id: e.id, state: ty.state, name: ty.name, detail: ty.shortDetail || ty.detail, clock: st.displayClock, period: st.period || 0,
      home: code((cp.home.team || {}).abbreviation), away: code((cp.away.team || {}).abbreviation), hs: +cp.home.score || 0, as: +cp.away.score || 0, start: e.date,
      home_id: (cp.home.team || {}).id, espn_wp: (((c.situation || {}).lastPlay || {}).probability || {}).homeWinPercentage};
    if (sport === 'nfl' && c.situation) {
      const si = c.situation, pt = si.possessionText || '', m = pt.match(/^([A-Z]+)\s+(\d+)/), pos = si.possession;
      const hp = pos == null ? null : String(pos) === String(g.home_id) ? 1 : 0;
      let yl = null; if (m) { const own = hp === 1 ? cp.home.team.abbreviation : hp === 0 ? cp.away.team.abbreviation : null; yl = m[1] === own ? 100 - +m[2] : +m[2]; }
      g.sit = {home_poss: hp, yl, down: si.down > 0 ? si.down : null, ydstogo: si.distance ?? null, home_to: si.homeTimeouts, away_to: si.awayTimeouts, text: si.downDistanceText || ''};
    }
    games.push(g);
  }
  const act = games.filter(g => g.state === 'in');
  if (act.length) {
    let an = null;
    try { an = await lj(`https://api.actionnetwork.com/web/v2/scoreboard/${l}?bookIds=68,69,71,75,79,1005&periods=event`); } catch (err) { an = null; }
    const idx = {};
    for (const x of (an && an.games) || []) {
      const t = {}; (x.teams || []).forEach(y => t[y.id] = y.abbr);
      idx[code(t[x.away_team_id]) + '@' + code(t[x.home_team_id])] = x;
    }
    await Promise.all(act.map(async g => {
      const x = idx[g.away + '@' + g.home]; g.books = x ? anBooks(x) : [];
      try {
        const j = await lj(`https://sports.core.api.espn.com/v2/sports/${s}/leagues/${l}/events/${g.id}/competitions/${g.id}/odds`);
        g.pre = oddsOf(oddsItem(j.items, false));
        const lv = oddsOf(oddsItem(j.items, true));
        if (lv && !g.books.some(b => b.book === 'DraftKings')) g.books.push({book: 'DraftKings', ...lv});
      } catch (err) { g.oddsErr = String(err); }
    }));
  }
  return games;
}
const nhlCode = a => ({TB: 'TBL', NJ: 'NJD', LA: 'LAK', SJ: 'SJS', UTAH: 'UTA', MON: 'MTL', VEG: 'VGK', WAS: 'WSH'}[a] || a);
const nflCode = a => ({WSH: 'WAS', LAR: 'LA', JAC: 'JAX'}[a] || a);
const nbaCode = a => ({GSW: 'GS', NOP: 'NO', NYK: 'NY', SAS: 'SA', UTA: 'UTAH', WAS: 'WSH'}[a] || a);

async function liveTick() {
  if (LV.busy) return; LV.busy = true;
  try {
    if (!LV.models) LV.models = api() && api().get_live_models ? await api().get_live_models() : await lj('../../reports/live_models.json');
    const res = await Promise.allSettled(Object.keys(LSP).map(liveFetch));
    const all = res.flatMap(r => r.status === 'fulfilled' ? r.value : []);
    const bad = res.filter(r => r.status === 'rejected').map(r => String(r.reason));
    if (bad.length === res.length) throw new Error(bad[0]);
    for (const g of all) {
      if (g.state !== 'in') continue;
      try { g.pr = priceGame(g); g.sides = sides(g, g.pr); } catch (err) { g.err = String(err); }
      const h = LV.hist[g.id] = LV.hist[g.id] || []; if (g.pr) { h.push(g.pr.p); if (h.length > 240) h.shift(); }
    }
    LV.games = all; LV.updated = new Date(); LV.err = null;
    if (api() && api().live_record) try { api().live_record(all.filter(g => g.state === 'in').map(g => ({t: LV.updated.toISOString(), sport: g.sport, id: g.id, home: g.home, away: g.away, hs: g.hs, as: g.as, period: g.period, clock: g.clock, sit: g.sit || null, books: g.books, pre: g.pre, mkt_home: g.mkt_home, p: g.pr ? g.pr.p : null, tmean: g.pr ? g.pr.tmean : null, fair_spread: g.pr ? g.pr.fairSpread : null}))); } catch (e) {}
  } catch (err) { LV.err = String(err); }
  LV.busy = false;
  if (VIEW === 'live') liveDraw();
}
function liveStop() { if (LV.timer) clearInterval(LV.timer); LV.timer = null; }
function liveRender() {
  $('#title').textContent = 'Live betting'; $('#weeks').style.display = 'none';
  const ey = $('#eyebrow'); if (ey) ey.textContent = 'In-game prices, every sport';
  if (!LV.timer) { LV.timer = setInterval(() => { if (VIEW !== 'live') { liveStop(); return; } liveTick(); }, 30000); }
  liveDraw(); liveTick();
}

// ---------------------------------------------------------------- drawing
function spark(h, ca, ch) {
  if (!h || h.length < 2) return '';
  const W = 160, Hh = 34, pts = h.map((v, i) => `${(i / (h.length - 1) * W).toFixed(1)},${(Hh - v * Hh).toFixed(1)}`).join(' ');
  return `<svg class="lspark" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none"><line x1="0" x2="${W}" y1="${Hh / 2}" y2="${Hh / 2}" class="mid"/><polyline points="${pts}" style="stroke:${ch}"/></svg>`;
}
function liveCard(g) {
  const pr = g.pr, [ca, ch] = tpair(g.away, g.home, g.sport), BS = bestSides(g);
  const bets = BS.filter(x => isLiveBet(g, x)).sort((a, z) => z.ev - a.ev);
  const best = bets[0];
  const cell = x => !x ? '<td></td>' : `<td class="r"><b>${esc(x.label)}</b> <span class="num">${pAm(x.price)}</span> <span class="muted">${esc(x.book)}</span><br><span class="num ${isLiveBet(g, x) ? 'pos' : 'muted'}">Locksmith ${lpct(x.p)} · market ${lpct(x.cons)}</span></td>`;
  const pick2 = mk => { const xs = BS.filter(x => x.market === mk); if (!xs.length) return ''; const main = mk === 'ml' ? xs : (() => { const lines = {}; xs.forEach(x => { const ln = x.key.replace(/^[a-z]+/, ''); (lines[ln] = lines[ln] || []).push(x); }); const cnt = Object.entries(lines).sort((a, z) => z[1].length - a[1].length)[0]; return cnt ? cnt[1] : []; })();
    const lab = {ml: 'Moneyline', spread: 'Spread', total: 'Total'}[mk];
    return `<tr><td>${lab}</td>${cell(main[0])}${cell(main[1])}</tr>`; };
  const per = g.sport === 'nhl' ? (g.period > 3 ? 'OT' : `P${g.period}`) : (g.period > 4 ? 'OT' : `Q${g.period}`);
  const sit = g.sport === 'nfl' && g.sit && g.sit.text ? `<span class="lsit">${esc(g.sit.text)}</span>` : '';
  const nb = (g.books || []).length, ns = (g.books || []).filter(b => b.stale).length;
  let msg;
  if (best) msg = `<div class="lbet"><div><span class="badge good">Live value</span> <b>${esc(best.label)}</b> <span class="num">${pAm(best.price)}</span> <span class="muted">at ${esc(best.book)}</span></div><div class="note">Locksmith ${lpct(best.p)} vs the market’s ${lpct(best.cons)} (no-vig, ${nb} book${nb > 1 ? 's' : ''}) · value ${sgn(100 * best.ev, 1)}% at this price · fair price ${fairAm(best.p)}${bets.length > 1 ? ` · also: ${bets.slice(1, 3).map(x => esc(x.label) + ' ' + pAm(x.price)).join(', ')}` : ''}</div></div>`;
  else if (!nb) msg = `<div class="lnobet">No live lines right now (books suspend betting during some stoppages).</div>`;
  else if (pr && g.disagree > 0.20) msg = `<div class="lnobet">Locksmith (${lpct(pr.p)}) and the market (${lpct(g.mkt_home)}) disagree by too much for the score alone to explain; the market probably knows something the score doesn’t (an injury, an ejection). No bet.</div>`;
  else if (pr && pr.f <= 0.03) msg = `<div class="lnobet">Too late in the game for a live bet.</div>`;
  else msg = `<div class="lnobet">No live bet: the books are within Locksmith’s range.</div>`;
  return `<div class="card lcard" style="--ca:${ca};--ch:${ch}">
    <div class="lhead"><span class="lsp">${LSP[g.sport][2]}</span><span class="lclock"><i class="dot"></i>${per} · ${esc(g.clock || '')}</span>${sit}<span class="muted" style="margin-left:auto">${nb} book${nb === 1 ? '' : 's'}${ns ? ` · ${ns} lagging (ignored)` : ''}</span></div>
    <div class="lscore"><div class="lt">${tlogo(g.away, 40, g.sport)}<b>${esc(g.away)}</b><span class="num">${g.as}</span></div><div class="lmid">${pr ? `<span class="lwp" style="color:${pr.p >= .5 ? ch : ca}">${lpct(Math.max(pr.p, 1 - pr.p))}</span><small>${pr.p >= .5 ? g.home : g.away} to win</small>` : ''}</div><div class="lt r"><span class="num">${g.hs}</span><b>${esc(g.home)}</b>${tlogo(g.home, 40, g.sport)}</div></div>
    ${pr ? `<div class="winbar"><span style="width:${100 * (1 - pr.p)}%;background:${ca}"></span><span style="width:${100 * pr.p}%;background:${ch}"></span></div>` : ''}
    <div class="lmeta">${pr ? `Locksmith: ${g.home} ${lpct(pr.p)}, fair spread ${g.home} ${pr.fairSpread > 0 ? '+' : ''}${fx(pr.fairSpread, 1)}, total ${fx(pr.tmean, 1)}` : ''}${g.mkt_home != null ? ` · market ${g.home} ${lpct(g.mkt_home)}` : ''}${g.espn_wp != null ? ` · ESPN ${lpct(g.espn_wp)}` : ''}${spark(LV.hist[g.id], ca, ch)}</div>
    ${msg}
    ${BS.length ? `<div class="tbl"><table class="ltab"><tbody>${pick2('ml')}${pick2('spread')}${pick2('total')}</tbody></table></div>` : ''}
  </div>`;
}
function liveDraw() {
  if (VIEW !== 'live') return;
  const act = LV.games.filter(g => g.state === 'in' && (LV.filter === 'all' || g.sport === LV.filter));
  const next = LV.games.filter(g => g.state === 'pre' && (LV.filter === 'all' || g.sport === LV.filter)).sort((a, z) => String(a.start).localeCompare(String(z.start))).slice(0, 8);
  const done = LV.games.filter(g => g.state === 'post' && (LV.filter === 'all' || g.sport === LV.filter)).slice(0, 8);
  const nBets = act.filter(g => bestSides(g).some(x => isLiveBet(g, x))).length;
  const chips = `<div class="chips">${[['all', 'All sports'], ['nfl', 'Football'], ['nba', 'Basketball'], ['nhl', 'Hockey']].map(([k, l]) => `<button class="chip ${LV.filter === k ? 'on' : ''}" data-lf="${k}">${l}${k !== 'all' ? ` <span class="muted">${LV.games.filter(g => g.state === 'in' && g.sport === k).length || ''}</span>` : ''}</button>`).join('')}</div>`;
  const head = !LV.updated ? `<div class="verdict big1"><b>Loading live games…</b></div>`
    : `<div class="verdict big1">${act.length ? `<b>${act.length} game${act.length > 1 ? 's' : ''} live${nBets ? `, ${nBets} with live value` : ''}.</b>` : '<b>No games live right now.</b>'} Prices refresh every 30 seconds (last ${LV.updated.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit', second: '2-digit'})}).</div>`;
  const warn = `<div class="verdict amber"><b>How live picks work, and what is not tested yet.</b> Locksmith’s in-game win model is tested on every play of past seasons and beats a pregame-only estimate. A live pick is a moneyline only, and only when Locksmith <i>and</i> ESPN’s independent win model both rate a team at least 5% higher than the betting market (the median of six books; books a step behind the game are ignored). There is no free archive of past live betting lines, so live picks have no track record yet; the desktop app records every live line it sees to build one. Live spreads and totals are shown as Locksmith’s fair numbers, not picks. Live prices move in seconds: check the price before you bet and keep stakes small.</div>`;
  $('#view').innerHTML = head + chips + (act.length ? `<div class="grid g2">${act.map(liveCard).join('')}</div>` : '') + warn
    + (next.length ? card('Starting soon', '', `<div class="lnext">${next.map(g => `<div>${tlogo(g.away, 22, g.sport)} ${esc(g.away)} at ${esc(g.home)} ${tlogo(g.home, 22, g.sport)} <span class="muted">${LSP[g.sport][2]} · ${new Date(g.start).toLocaleString([], {weekday: 'short', hour: 'numeric', minute: '2-digit'})}</span></div>`).join('')}</div>`) : '')
    + (done.length ? card('Final', '', `<div class="lnext">${done.map(g => `<div>${tlogo(g.away, 22, g.sport)} ${esc(g.away)} ${g.as} – ${g.hs} ${esc(g.home)} ${tlogo(g.home, 22, g.sport)} <span class="muted">${LSP[g.sport][2]}</span></div>`).join('')}</div>`) : '')
    + (LV.err ? `<p class="note">Could not reach the live feed: ${esc(LV.err)}</p>` : '');
  document.querySelectorAll('[data-lf]').forEach(b => b.onclick = () => { LV.filter = b.dataset.lf; liveDraw(); });
}
