// Locksmith :: Today and Games, plus the one data loader every screen shares.
// One source of truth: reports/bets.json (python -m locksmith.grade) holds the verdict, chance, price, stake and why for
// every side of every game. Today shows its Bet / Bet early lines, Games shows one line per game, and every game page opens
// with the very same line (lkVerdictHTML). Nothing here grades anything: grades, chances and stakes all come from Python.
// Accuracy badges come from reports/certificate.json (python -m locksmith.certify): a missing certificate or a missing cell
// means "untested", which is shown as the market's number (STANDARD.md rule 1).
// Globals for the sport pages:  lkBets() -> bets.json or null  ·  lkGame(sport, id) -> that game's entry or null
//                                lkVerdictHTML(g) -> the game's verdict line  ·  lkVerdictText(g) -> the same, as plain text
let BETS = null, BETS_ERR = null, CERT = null, CERT_ERR = null, SUSP = null, BOPEN = null, GAMEFROM = 'games';
let LKF = {sport: 'all', leans: false, gday: 'today'};          // Today / Games filters (the page sport for sport pages is SPORT)
try { Object.assign(LKF, JSON.parse(localStorage.getItem('lk-f') || '{}')); } catch (e) {}
const lkfSave = () => { try { localStorage.setItem('lk-f', JSON.stringify({sport: LKF.sport, leans: LKF.leans, gday: LKF.gday})); } catch (e) {} };
const GRADE = {bet: 'Bet', early: 'Bet early', lean: 'Lean'};
const GRADE_HINT = {bet: 'Passed testing at today’s price, on games the model never saw.',
  early: 'Passed testing at the opening line, and the line hasn’t moved. Bet before it does.',
  lean: 'We like it, but bets like this haven’t beaten today’s price. No money.'};
const SPNAME = {nfl: 'NFL', cfb: 'College', nba: 'NBA', wnba: 'WNBA', nhl: 'NHL', ufc: 'UFC'};
const LK_ORDER = ['nfl', 'cfb', 'nba', 'wnba', 'nhl', 'ufc'];
const QTY = {total: 'total', spread: 'margin', ml: 'win'};
const lkUnit = () => (typeof UNIT_USD !== 'undefined' && UNIT_USD > 0 ? UNIT_USD : 25);
const bAm = a => a == null || !isFinite(a) ? '' : (a > 0 ? '+' : '−') + Math.abs(Math.round(a));
const bLine = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);                 // a spread with a real minus sign: −8.5 / +3
const bPct = (p, d = 0) => p == null || !isFinite(p) ? '–' : (100 * Math.min(.99, Math.max(.01, p))).toFixed(d) + '%';
const bUsd = (d, sign) => { const v = Math.round(d); return (sign ? (v > 0 ? '+' : v < 0 ? '−' : '') : '') + '$' + Math.abs(v).toLocaleString(); };
const bStake = d => { const c = Math.round(d * 100) / 100; return '$' + (Number.isInteger(c) ? c.toLocaleString() : c.toFixed(2)); };   // $50, $12.50
const bDay = iso => { try { return new Date(iso).toLocaleDateString('en-CA'); } catch (e) { return ''; } };
const bTime = iso => { if (!iso) return 'TBD'; try { return new Date(iso).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}); } catch (e) { return 'TBD'; } };
const lkIn = iso => { const m = Math.round((new Date(iso) - Date.now()) / 6e4); if (!isFinite(m)) return ''; if (m <= 0) return 'started'; if (m < 60) return `in ${m} min`; const h = Math.floor(m / 60); return h < 24 ? `in ${h}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `in ${Math.round(h / 24)} day${h >= 36 ? 's' : ''}`; };
function bDayLabel(k) {
  if (!k) return 'Date to be set';
  const t = new Date(), d0 = t.toLocaleDateString('en-CA'); t.setDate(t.getDate() + 1); const d1 = t.toLocaleDateString('en-CA');
  const nice = new Date(k + 'T12:00').toLocaleDateString([], {weekday: 'long', month: 'short', day: 'numeric'});
  return k === d0 ? `Today · ${nice}` : k === d1 ? `Tomorrow · ${nice}` : nice;
}

// ---------------------------------------------------------------- loading (desktop: Python API; web: ../../reports/*.json)
async function lkFetch(fn, path) {
  const A = window.pywebview && window.pywebview.api;
  try {
    if (A && A[fn]) return await A[fn]();
    const r = await fetch('../../reports/' + path, {cache: 'no-store'});
    if (!r.ok) throw new Error(`${path} returned HTTP ${r.status}`);
    return await r.json();
  } catch (e) { return {__err: String((e && e.message) || e)}; }
}
async function betsLoad(force) {
  if (BETS && !force) return BETS;
  const r = await lkFetch('get_bets', 'bets.json');
  if (!r || r.__err) BETS_ERR = (r && r.__err) || 'no response';
  else if (!Array.isArray(r.games)) BETS_ERR = 'bets.json has no list of games';
  else if (!r.generated && !r.games.length) BETS_ERR = 'bets.json is missing (the desktop app found no file)';
  else { BETS = r; BETS_ERR = null; }
  return BETS;
}
async function certLoad(force) {
  if (CERT && !force) return CERT;
  const r = await lkFetch('get_certificate', 'certificate.json');
  if (r && !r.__err && r.cells && Object.keys(r.cells).length) { CERT = r; CERT_ERR = null; } else { CERT = null; CERT_ERR = (r && r.__err) || 'not built yet'; }
  return CERT;
}
async function suspLoad() {
  if (SUSP) return SUSP;
  const r = await lkFetch('get_suspended', 'suspended.json');
  SUSP = r && !r.__err ? r : {};
  return SUSP;
}
let ALTB = null;
async function abLoad() { const r = await lkFetch('get_altbets', 'alt_bets.json'); ALTB = r && !r.__err ? r : {}; return ALTB; }
window.lkBets = () => BETS;
window.lkGame = (sport, id) => (BETS && BETS.games || []).find(g => g.sport === String(sport) && String(g.id) === String(id)) || null;
window.lkCert = () => CERT;
// how old the prices are: the newest price fetch on the board (games' lines_at), else when bets.json was written
const lkAge = () => {
  try {
    const ts = ((BETS && BETS.games) || []).map(g => g.lines_at).filter(Boolean).map(s => +new Date(String(s).replace(' ', 'T'))).filter(isFinite);
    const t = ts.length ? Math.max(...ts) : BETS.generated_utc ? +new Date(BETS.generated_utc) : +new Date(String(BETS.generated).replace(' ', 'T'));
    return isFinite(t) ? (Date.now() - t) / 36e5 : null;
  } catch (e) { return null; }
};

// ---------------------------------------------------------------- accuracy badge (certificate.json; never computed here)
// no_market: grade.py's badge for a game no sportsbook has priced yet (the number is the raw model, rated worse than the line)
const BADGE_LABEL = {beats_market: 'Beats the market', beats_opener: 'Beats the opening line', market: 'Market’s number', no_market: 'No line yet'};
const BADGE_CLS = {beats_market: 'b-beats', beats_opener: 'b-opener', market: 'b-market', no_market: 'b-market b-build'};
const MARKET_TEXT = 'Nothing we’ve built beats the market here yet, so this is the market’s own number with the bookmaker’s cut removed.';
function lkCell(sport, qty, timing) { return CERT && CERT.cells ? CERT.cells[`${sport}|${qty}|${timing}`] || null : null; }
// the bet types of one sport that passed the accuracy certificate (cells rated "better" for a bet family, not a projected
// quantity or a model-alone companion), minus any the live record paused (bets.json live.weak / suspended.json): exactly the
// ones that can reach Today. Research pages name these, so a past-games ✓ is never read as "we bet this".
function lkUsedTypes(sport) {
  const cells = Object.values((CERT && CERT.cells) || {}), weak = (BETS && BETS.live && BETS.live.weak) || {}, SU = SUSP || {};
  const pulled = q => Object.keys(SU).some(k => { const [s, m] = k.split('|'); return s === sport && SU[k] && SU[k].why && m && String(q).includes(m); });   // suspended.json "nba|spread"
  return cells.filter(c => c.sport === sport && c.verdict === 'better' && !['win', 'margin', 'total'].includes(c.quantity) && !/_model$/.test(c.quantity) && !weak[c.quantity] && !pulled(c.quantity))
    .map(c => ({fam: c.quantity, timing: c.timing, label: c.label || lkFamName(c.quantity)}));
}
function lkUsedHTML(sport, name) {   // the one sentence every Research page leads with
  if (!CERT) return 'Our accuracy certificate is still being built, so none of these is bet yet: a ✓ means it held up on past games, nothing more.';
  const U = lkUsedTypes(sport), nm = name || SPNAME[sport] || sport;
  const list = U.map(u => `<b>${esc(u.label)}</b> <span class="bdg ${u.timing === 'open' ? 'b-opener' : 'b-beats'}">Passed testing</span>`);
  return `These are tests on past games, not live bets. A ✓ means an idea held up on those past games; it is not a bet by itself. ${U.length
    ? `Bets come only from the ${nm} bet types that passed our accuracy certificate (Record → Us vs the market): ${list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : list[0]}.`
    : `No ${nm} bet type has passed our accuracy certificate (Record → Us vs the market), so none of these is bet.`}`;
}
function lkBadge(sport, x, timing) {
  if (x && x.badge) {                                                                 // grade.py attaches certify.badge() to every side
    if (x.badge.kind) return x.badge;
    const k = String(x.badge), t = k === 'beats_opener' ? 'open' : k === 'beats_market' ? 'current' : (timing === 'open' ? 'open' : 'current');
    const c = [x.fam, QTY[x.mk] || x.mk].filter(Boolean).map(q => lkCell(sport, q, t)).find(Boolean) || null;
    if (BADGE_LABEL[k]) return {kind: k, text: (c && c.plain) || (k === 'market' ? MARKET_TEXT : BADGE_LABEL[k]), cell: c};
  }
  if (!CERT) return null;                                                             // certificate still being built
  const t = timing === 'open' ? 'open' : 'current', qs = x ? [x.fam, QTY[x.mk] || x.mk].filter(Boolean) : [sport === 'ufc' ? 'win' : 'margin'];
  for (const q of qs) { const c = lkCell(sport, q, t); if (c && c.verdict === 'better') return {kind: t === 'open' ? 'beats_opener' : 'beats_market', text: c.plain || '', cell: c}; }
  return {kind: 'market', text: MARKET_TEXT, cell: qs.map(q => lkCell(sport, q, t)).find(Boolean) || null};
}
function lkGameBadge(g) {   // the projection's badge for a Games line: bets.json proj.badge (margin / total), best one first
  const B = g && g.proj && g.proj.badge;
  if (B && typeof B === 'object') {
    const xs = Object.values(B).filter(b => b && b.kind), r = {beats_market: 0, beats_opener: 1, market: 2, no_market: 3};
    const b = xs.sort((a, z) => (r[a.kind] ?? 4) - (r[z.kind] ?? 4))[0];
    if (b) return {kind: b.kind, text: [b.label, b.detail || b.text].filter(Boolean).join(': '), cell: null};
  }
  return lkBadge(g.sport, null, 'current');
}
function lkBadgeHTML(b) {
  if (!b) return '<span class="bdg b-market b-build" title="Our accuracy test is being built. Until it is done, every chance we show is the market’s own number.">Accuracy test being built</span>';
  return `<span class="bdg ${BADGE_CLS[b.kind] || 'b-market'}" title="${esc(b.text || '')}">${BADGE_LABEL[b.kind] || 'Market’s number'}</span>`
    + (b.cell && b.cell.r_agrees && (b.kind === 'beats_market' || b.kind === 'beats_opener') ? ' <span class="bdg b-r" title="An independent R implementation reached the same result">Checked independently in R</span>' : '');
}

// ---------------------------------------------------------------- the pieces of a line
// THE ONE SCORE RULE (every page that shows a projected score calls this): the projected score keeps the decimals the
// projection has. Never rounded to whole points and never a tie-break point, because on the market's number that would invent
// an over or a cover the line never implied (52.5 shown as 28-25 reads as an over). So the two numbers always add up to the
// projected total and differ by the projected margin: NFL CIN 27.75-24.75 is exactly the market's 52.5 and CIN -3.
//  - football / basketball: bets.json's proj.home / proj.away as Python made them (projection.score: on the line they sum to the
//    total and differ by the spread; with no line yet they are the model's whole points), up to 2 decimals, trailing zeros off;
//    if they would sit on the other side of a posted line than the projection itself, they are rebuilt from (total +/- margin) / 2
//  - hockey: average goals to one decimal, from (total +/- margin) / 2 (whole goals would inflate the total and flip winners)
// .lab is the honest name for it: "Market's score" (the market's own numbers), "Model estimate" (no line yet), else "Our score".
function lkScore(g) {
  const P = g && g.proj; if (!P || P.home == null || P.away == null || g.fight) return null;
  const nhl = g.sport === 'nhl', L = P.line || {}, src = P.src || {}, num = v => v != null && v !== '' && isFinite(+v) ? +v : null;
  const T = num(P.total), M = num(P.margin), r2 = v => Math.round(100 * v) / 100, r1 = v => Math.round(10 * v) / 10;
  const sd = (x, l) => Math.sign(Math.round(100 * (x - l)));            // which side of a line, to the cent (0 = on it)
  let h = +P.home, a = +P.away;
  if (nhl && T != null && M != null) { h = (T + M) / 2; a = (T - M) / 2; }
  else if (!nhl && T != null && M != null && ((num(L.total) != null && sd(h + a, +L.total) !== sd(T, +L.total)) || (num(L.margin) != null && sd(h - a, +L.margin) !== sd(M, +L.margin)))) { h = (T + M) / 2; a = (T - M) / 2; }
  if (nhl) {                         // one decimal each; on a whole/half total the two still add up to it exactly
    let h1 = r1(h), a1 = r1(a);
    if (T != null && Math.abs(10 * T - Math.round(10 * T)) < 1e-6 && Math.abs(r1(h1 + a1) - r1(T)) > 1e-6) { if (Math.abs(h - h1) > Math.abs(a - a1)) h1 = r1(T - a1); else a1 = r1(T - h1); }
    h = h1; a = a1;
  } else { h = r2(h); a = r2(a); }
  const f = v => nhl ? v.toFixed(1) : String(v), hs = f(h), as = f(a);
  const hw = h !== a ? h > a : P.winner ? P.winner === g.home : M != null && M !== 0 ? M > 0 : g.wp_home != null ? g.wp_home >= .5 : true;
  const lab = src.margin === 'model' && src.total === 'model' ? 'Model estimate' : src.margin === 'market' && src.total === 'market' ? 'Market’s score' : 'Our score';
  return {h, a, hs, as, tot: nhl ? r1(h + a) : r2(h + a), rawTot: T, homeWins: hw, lab, mkt: lab === 'Market’s score',
    text: hw ? `${g.home} ${hs}–${as}` : `${g.away} ${as}–${hs}`, full: hw ? `${g.home} ${hs}, ${g.away} ${as}` : `${g.away} ${as}, ${g.home} ${hs}`};
}
const lkScoreLab = g => { const S = lkScore(g); return S ? S.lab : 'Projected score'; };
function lkSides(g) { return (g && g.sides) || []; }
function lkStaked(g) { return lkSides(g).filter(s => s.grade === 'bet' || s.grade === 'early'); }
function lkMarketLine(g) {   // the market's line in two numbers: favourite's spread (moneyline for hockey and UFC) and the total
  const S = lkSides(g), out = [];
  if (g.sport === 'nhl' || g.sport === 'ufc' || g.fight) {
    const ml = S.filter(s => s.mk === 'ml' && s.price != null).sort((a, z) => a.price - z.price)[0];
    if (ml) out.push(`${esc(String(ml.lab).replace(/ ML$/, ''))} ${bAm(ml.price)}`);
  } else {
    const PL = g.proj && g.proj.line;                                   // grade.py's own copy of the market line (home margin, total)
    if (PL && PL.margin != null && isFinite(PL.margin)) out.push(+PL.margin === 0 ? 'Pick’em' : `${esc(PL.margin > 0 ? g.home : g.away)} −${Math.abs(PL.margin)}`);
    else {
      const sp = S.filter(s => s.mk === 'spread').map(s => ({s, v: +String(s.lab).split(' ').pop()})).filter(x => isFinite(x.v)).sort((a, z) => a.v - z.v)[0];
      if (sp) out.push(sp.v === 0 ? 'Pick’em' : `${esc(String(sp.s.lab).replace(/\s+\S+$/, ''))} ${bLine(sp.v)}`);
    }
  }
  const PT = g.proj && g.proj.line && g.proj.line.total, tt = S.find(s => s.mk === 'total');
  if (PT != null && isFinite(PT)) out.push(`O/U ${PT}`); else if (tt) out.push(`O/U ${esc(String(tt.lab).split(' ').pop())}`);
  return out.join(' · ');
}
function lkMarketChance(g, home) {   // the market's own no-vig chance for a side, from bets.json's moneyline rows
  const want = home ? g.home : g.away, s = lkSides(g).find(x => x.mk === 'ml' && String(x.lab).replace(/ ML$/, '') === String(want));
  return s && s.fair != null ? s.fair : null;
}
function lkCond(x) {   // the price the bet still needs: grade.py's own words when it gives them, else the line itself
  if (x.cond) return String(x.cond);
  const lab = String(x.lab || ''), px = x.price != null ? bAm(x.price) : '', at = px ? `, at ${px} or better` : '';
  // Bet early was tested at the opener only (locksmith.early: the same number; moneylines within 2 implied points), so a moved
  // line is outside the test in either direction, even one that looks better
  if (x.grade === 'early') return x.mk === 'ml'
    ? `Only bet while the price is still about the opener${x.opener ? ` (${String(x.opener)})` : ''}, within 2 points of chance. If it moves, skip it.`
    : `Only bet at exactly ${lab.split(' ').pop()}, the opening number${at}. If the line moves either way, skip it: the test covers the opener only.`;
  const t = lab.match(/^(Over|Under)\s+([\d.]+)/i);
  if (t) return /^u/i.test(t[1]) ? `Only bet at ${t[2]} or higher${at}. If it drops, skip it.` : `Only bet at ${t[2]} or lower${at}. If it rises, skip it.`;
  const s = x.mk === 'spread' && lab.match(/^(.+?)\s+([+\-−]?[\d.]+)$/);
  if (s) { const v = +s[2].replace('−', '-'); return v < 0 ? `Only bet ${s[1]} ${bLine(v)} or fewer points${at}. If it grows, skip it.` : `Only bet ${s[1]} ${bLine(v)} or more points${at}. If it shrinks, skip it.`; }
  return px ? `Only bet at ${px} or better. If the price drops, skip it.` : '';
}
function lkGameName(g) { return g.fight ? `${esc(g.away)} vs ${esc(g.home)}` : `${esc(g.away)} @ ${esc(g.home)}`; }
function lkBetLab(x) { return esc(String(x.lab || '').replace(/ ML$/, ' to win')); }
function lkPer100(x) { return x.ev != null && isFinite(x.ev) ? bUsd(100 * x.ev, true) : null; }
function lkStakeUsd(x) { return x.stake ? bStake(x.stake * lkUnit()) : null; }
function lkVerdictText(g, x) {
  if (!g) return 'No bet: this game isn’t on today’s board.';
  x = x || (g.best && g.best.grade !== 'pass' ? g.best : null);
  if (!x) return lkSides(g).length ? 'No bet: nothing beats the market’s price on this game.' : 'No bet: no betting line yet.';
  if (x.grade === 'lean') return `Lean (no money): ${String(x.lab).replace(/ ML$/, ' to win')} ${bAm(x.price)}`.trim();
  const v = lkPer100(x), st = lkStakeUsd(x);
  return `${GRADE[x.grade]}: ${String(x.lab).replace(/ ML$/, ' to win')} ${bAm(x.price)}${v ? ` · ${v} per $100` : ''}${st ? ` · bet ${st}` : ''}`;
}
window.lkVerdictText = lkVerdictText;

// one line: time · bet + price · tag · game · +$9 per $100 · bet $50   (k = sport|id|mk|lab, used to open and expand it)
function lkLineHTML(g, x, opts = {}) {
  const k = `${g.sport}|${g.id}|${x.mk}|${x.lab}`, open = opts.open, cls = `g-${x.grade}`;
  const v = lkPer100(x), st = lkStakeUsd(x), money = x.grade !== 'lean';
  const right = money ? `<span class="ll-val">${v ? `<b class="num ${x.ev >= 0 ? 'pos' : 'neg'}">${v}</b><small>per $100</small>` : ''}${st ? `<span class="ll-stake">bet ${st}</span>` : ''}</span>`
    : '<span class="ll-val"><small>no money</small></span>';
  const tag = `<span class="tag t-${x.grade}" title="${esc(GRADE_HINT[x.grade] || '')}">${GRADE[x.grade]}</span>`;
  const head = `<span class="ll-time">${bTime(g.start)}</span><span class="ll-main"><span class="ll-bet">${lkBetLab(x)}<span class="ll-px">${bAm(x.price)}</span></span><span class="ll-sub">${tag}<span class="ll-game">${lkGameName(g)} · ${SPNAME[g.sport] || g.sport}</span></span></span>${right}<span class="ll-chev" aria-hidden="true">›</span>`;
  const txt = esc(lkVerdictText(g, x));
  if (opts.static) return `<div class="lk-line ${cls}" data-verdict="${txt}">${head}</div>`;
  return `<div class="lk-item${open ? ' open' : ''}"><button type="button" class="lk-line ${cls}" data-lk="${esc(k)}" aria-expanded="${open ? 'true' : 'false'}" data-verdict="${txt}">${head}</button>${open ? lkDetail(g, x) : ''}</div>`;
}
// tapping a line: 3-4 plain lines, then the numbers behind a "Show the numbers" fold
function lkDetail(g, x, noOpen) {
  const S = lkScore(g), L = [];
  if (S) {
    const tl = x.mk === 'total' ? +String(x.lab).split(' ').pop() : null, u = g.sport === 'nhl' ? 'goals on average' : 'points';
    const how = x.mk === 'total' && isFinite(tl) ? `${S.tot} ${u}, ${S.tot > tl ? 'over' : S.tot < tl ? 'under' : 'right on'} the ${tl} line` : x.mk === 'spread' ? `${S.homeWins ? g.home : g.away} by ${Math.round(100 * Math.abs(S.h - S.a)) / 100}` : `${S.homeWins ? g.home : g.away} wins`;
    L.push(`<p>${esc(S.lab)}: <b>${esc(S.full)}</b> (${esc(how)}).</p>`);
  }
  if (x.chance_text) L.push(`<p>${esc(x.chance_text).replace(/(\d+%)/g, '<b>$1</b>')}${x.grade === 'lean' ? ' · no money on leans' : ''}.</p>`);      // grade.py's own words
  else if (x.fair != null || x.p != null) L.push(`<p>Market <b>${bPct(x.fair)}</b> · our chance <b>${bPct(x.p)}</b>${x.grade === 'lean' ? ' · no money on leans' : ''}.</p>`);
  const c = x.grade !== 'lean' ? lkCond(x) : ''; if (c) L.push(`<p class="ll-cond">${esc(c)}</p>`);
  if (x.grade === 'early' && g.start) L.push(`<p>Still at the opening line. Starts ${esc(lkIn(g.start))}.</p>`);
  if (x.grade !== 'lean' && x.p != null && x.fair != null && x.p - x.fair >= 0.08) L.push(`<p>Unusually big gap from the market. Check the line before you bet. The stake stays capped at ${bUsd(2 * lkUnit())}.</p>`);
  const timing = x.grade === 'early' ? 'open' : 'current';
  const nums = [['Our chance', bPct(x.p, 1)], x.p_raw != null && Math.abs(x.p_raw - x.p) > 5e-4 ? ['Model before the pull toward the market', bPct(x.p_raw, 1)] : null, x.lo != null && x.p != null && x.lo <= x.p ? ['Low end of our range', bPct(x.lo, 1)] : null,
    ['Market (cut removed)', bPct(x.fair, 1)], x.model != null ? ['Simulation alone', bPct(x.model, 1)] : null, x.ev != null ? ['Expected value (EV)', `${x.ev >= 0 ? '+' : '−'}${Math.abs(100 * x.ev).toFixed(1)}%`] : null,
    x.stake ? ['Stake (quarter Kelly, capped at 2 units)', `${x.stake} units`] : null, x.book ? ['Best price at', esc(x.book)] : null].filter(Boolean);
  L.push(`<div class="lk-chips">${lkBadgeHTML(lkBadge(g.sport, x, timing))}</div>`);
  L.push(`<details class="lk-more"><summary>Show the numbers</summary><div class="lk-nums">${nums.map(([a, b]) => `<span>${a}: <b>${b}</b></span>`).join('')}</div>${x.why ? `<p class="lk-small" style="margin-top:6px">Why: ${esc(x.why)}${x.fam ? ` (bet type: ${esc(lkFamName(x.fam))})` : ''}.</p>` : ''}</details>`);
  if (!noOpen) L.push(`<p><button type="button" class="lk-link" data-open="${esc(g.sport + '|' + g.id)}">Open the game →</button></p>`);
  return `<div class="ll-detail">${L.join('')}</div>`;
}
const FAMNAMES = {nba_prop: 'NBA player props', nhl_prop: 'NHL player props', wnba_prop: 'WNBA player props', 'edge:lr_edge_any_6': 'UFC fighter model', nfl_close_spread: 'NFL spreads at today’s line',
  nba_spread: 'NBA spreads', nba_total: 'NBA totals', nfl_spread: 'NFL spreads', nfl_total: 'NFL totals', wnba_total: 'WNBA totals', nhl_ml: 'hockey moneylines', nhl_total: 'hockey totals'};
const lkFamName = f => { const s = String((BETS && BETS.live && BETS.live.names && BETS.live.names[f]) || FAMNAMES[f] || String(f || 'other').replace(/^edge:/, '').replace(/_/g, ' ')); return s.charAt(0).toUpperCase() + s.slice(1); };
// the game page's first line: exactly the Today line (staked side), or the lean, or "No bet"
function lkVerdictHTML(g) {
  if (typeof g === 'string' || arguments.length > 1) g = lkGame(arguments[0], arguments[1]);
  if (!g) return `<div class="lk-verdict v-none"><div class="lk-line" data-verdict="${esc(lkVerdictText(null))}"><span class="ll-main"><span class="ll-bet">No bet</span><span class="ll-sub">This game isn’t on today’s board.</span></span></div></div>`;
  const xs = lkStaked(g), x = xs[0] || (g.best && g.best.grade !== 'pass' ? g.best : null);
  if (!x) return `<div class="lk-verdict v-none"><div class="lk-line" data-verdict="${esc(lkVerdictText(g))}"><span class="ll-main"><span class="ll-bet">No bet</span><span class="ll-sub">${lkSides(g).length ? 'Nothing beats the market’s price on this game.' : 'No betting line yet: no sportsbook has priced this game.'}${g.start ? ' ' + esc(bTime(g.start)) : ''}</span></span></div></div>`;
  return `<div class="lk-verdict">${(xs.length ? xs : [x]).map(y => lkLineHTML(g, y, {static: true}) + lkDetail(g, y, true)).join('')}</div>`;
}
window.lkVerdictHTML = lkVerdictHTML;

// ---------------------------------------------------------------- Today
function lkTodayItems() {
  const now = Date.now(), horizon = now + 7 * 864e5, out = [];
  for (const g of (BETS && BETS.games) || []) {
    if (g.started || (g.start && (new Date(g.start) <= now || new Date(g.start) > horizon))) continue;    // started: betting's closed
    const xs = lkStaked(g);
    xs.forEach(x => out.push({g, x}));
    if (!xs.length && LKF.leans && g.best && g.best.grade === 'lean') out.push({g, x: g.best});
  }
  return out.sort((a, z) => (a.g.start ? +new Date(a.g.start) : 9e15) - (z.g.start ? +new Date(z.g.start) : 9e15) || ({bet: 0, early: 1, lean: 2}[a.x.grade] - {bet: 0, early: 1, lean: 2}[z.x.grade]));
}
function lkSportChips(sports, cur) {
  const el = $('#sportbar'); if (!el) return;
  const list = LK_ORDER.filter(s => sports.has(s));
  if (cur !== 'all' && !list.includes(cur)) { LKF.sport = cur = 'all'; }            // that sport has nothing in this window
  if (list.length < 2) { el.innerHTML = ''; el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = ['all', ...list].map(s => `<button type="button" class="chip${s === cur ? ' on' : ''}" data-fsp="${s}">${s === 'all' ? 'All sports' : SPNAME[s]}</button>`).join('');
}
function lkHeadline(items) {
  const td = new Date().toLocaleDateString('en-CA'), money = items.filter(i => i.x.grade !== 'lean');
  const today = money.filter(i => i.g.start && bDay(i.g.start) === td), later = money.filter(i => !i.g.start || bDay(i.g.start) !== td);
  const night = today.length && today.every(i => new Date(i.g.start).getHours() >= 17) ? 'tonight' : 'today';
  if (today.length) {
    const n = today.length, e = today.filter(i => i.x.grade === 'early').length;
    let s = n === 1 ? `<b>1 bet ${night}:</b> ${lkBetLab(today[0].x)} in ${lkGameName(today[0].g)}.` : `<b>${n} bets ${night}.</b>`;
    if (e) s += n === 1 ? ' It’s an early bet: place it before the line moves.' : e === n ? ` All ${n} are early bets: place them before the line moves.` : ` ${e} of them are early bets: place those before the line moves.`;
    if (later.length) s += ` ${later.length} more later this week.`;
    return s;
  }
  if (later.length) {
    const nx = later[0], k = nx.g.start ? bDay(nx.g.start) : null, t1 = new Date(); t1.setDate(t1.getDate() + 1);
    const sameDay = later.filter(i => i.g.start && bDay(i.g.start) === k).length;
    const when = k === t1.toLocaleDateString('en-CA') ? 'Tomorrow' : k ? new Date(k + 'T12:00').toLocaleDateString([], {weekday: 'long'}) : 'Later this week';
    return `<b>No bet today.</b> ${when} has ${sameDay}, starting ${bTime(nx.g.start)}.${later.length > sameDay ? ` ${later.length - sameDay} more after that.` : ''}`;
  }
  return '<b>No bet today.</b> Nothing on the board beats the market’s price right now. That’s a normal day. We’ll keep checking as lines move.';
}
function lkErrorBox() {
  return `<div class="lk-note err"><b>Couldn’t load today’s bets.</b> ${esc(BETS_ERR || '')}. This is not a no-bet day: the data file is missing or unreadable. Check back after the next update.</div>`;
}
function lkAgeNote() {
  const h = lkAge(); if (h == null || h < 6) return '';
  const desk = !!(window.pywebview && window.pywebview.api);
  return `<div class="lk-note warn">These prices are ${Math.round(h)} hours old. ${desk ? 'Run Update (More → Update) before you bet.' : 'Check the price at your sportsbook before you bet.'}</div>`;
}
async function todayRender() {
  $('#title').textContent = 'Today';
  $('#eyebrow').textContent = new Date().toLocaleDateString([], {weekday: 'long', month: 'long', day: 'numeric'});
  const v = $('#view');
  if (!BETS && !BETS_ERR) { v.innerHTML = '<div class="lk-empty">Loading today’s bets…</div>'; await betsLoad(); }
  if (VIEW !== 'today') return;
  if (!BETS) { lkSportChips(new Set(), 'all'); v.innerHTML = lkErrorBox(); return; }
  const all = lkTodayItems(), sports = new Set(all.map(i => i.g.sport));
  lkSportChips(sports, LKF.sport);
  const items = all.filter(i => LKF.sport === 'all' || i.g.sport === LKF.sport);
  const nLean = ((BETS.games) || []).filter(g => g.best && g.best.grade === 'lean' && !lkStaked(g).length && (!g.start || new Date(g.start) > Date.now()) && (LKF.sport === 'all' || g.sport === LKF.sport)).length;
  let body = '', day = null, grp = [];
  const flush = () => { if (grp.length) body += `<div class="lk-group"><h3 class="lk-day">${bDayLabel(day)}</h3><div class="lk-list">${grp.join('')}</div></div>`; grp = []; };
  for (const it of items) {
    const k = it.g.start ? bDay(it.g.start) : null;
    if (k !== day) { flush(); day = k; }
    const key = `${it.g.sport}|${it.g.id}|${it.x.mk}|${it.x.lab}`;
    grp.push(lkLineHTML(it.g, it.x, {open: BOPEN === key}));
  }
  flush();
  const gen = BETS.generated ? `Prices as of ${esc(new Date(String(BETS.generated).replace(' ', 'T')).toLocaleString([], {weekday: 'short', hour: 'numeric', minute: '2-digit'}))}.` : '';
  v.innerHTML = `<p class="lk-lead">${lkHeadline(items)}</p>
    ${lkAgeNote()}
    <div class="lk-chips"><button type="button" class="chip${LKF.leans ? ' on' : ''}" data-leans="1">${LKF.leans ? '− Hide leans' : '+ Leans (no money)'}${!LKF.leans && nLean ? `<span class="n">${nLean}</span>` : ''}</button><button type="button" class="chip" data-view="games">Every game →</button></div>
    ${body || ''}
    <p class="lk-small">${gen} Tap a bet for the projected score, the market’s chance and the price it needs. Bet sizes use your unit of ${bUsd(lkUnit())} (change it in More → Settings). <span id="todayRec"></span></p>`;
  lkWire(v);
  if (typeof trkLoad === 'function') trkLoad().then(T => { const el = $('#todayRec'); const S = T && (typeof gpTracker === 'function' ? gpTracker(T).summary : T.summary); if (el && S && S.graded) el.innerHTML = `Our live record: <b>${S.wins}–${S.losses}</b>, ${bUsd((S.units || 0) * lkUnit(), true)} at ${bUsd(lkUnit())} a unit. <button type="button" class="lk-link" data-view="record">See every bet</button>`; });
}

// ---------------------------------------------------------------- Games: the odds board (every team, every market point)
// Each game shows both teams. For each one: the chance to win and, for every market point (moneyline, spread, total),
// Vegas's price, Vegas's chance (the price with the bookmaker's cut removed) and Locksmith's chance for that exact point.
// Locksmith's chance is its model; a gap only becomes a Bet / Bet early when that bet type passed testing (bets.json grade).
const GAP = 0.03;                                                    // a gap of 3+ chance points is flagged on the board
const lkTeamOf = s => String(s.lab || '').replace(/ ML$/, '').replace(/\s+[+\-−]?[\d.]+$/, '');
function lkOurP(s) {                     // Locksmith's chance for one side: the tested bet model where the side has one, else the raw model
  if (!s) return null;
  if (s.fam && s.p != null) return s.p;
  return s.model != null && isFinite(s.model) ? +s.model : null;
}
function lkObSides(g) {                  // {away: {ml, sp, tot}, home: {...}} from bets.json sides
  const S = lkSides(g), o = {away: {}, home: {}};
  for (const s of S) {
    if (s.mk === 'total') { (/^over/i.test(s.lab) ? o.away : o.home).tot = s; continue; }
    const t = lkTeamOf(s), k = t === String(g.home) ? 'home' : t === String(g.away) ? 'away' : null;
    if (!k) continue;
    if (s.mk === 'ml') o[k].ml = s; else if (s.mk === 'spread') o[k].sp = s;
  }
  return o;
}
function lkGapHTML(s, v, l) {            // the verdict or the gap for one market point
  if (s && (s.grade === 'bet' || s.grade === 'early' || s.grade === 'lean')) return `<span class="tag t-${s.grade}" title="${esc(GRADE_HINT[s.grade] || '')}">${GRADE[s.grade]}</span>`;
  if (v == null || l == null) return '';
  const d = l - v; if (Math.abs(d) < GAP) return '';
  return `<span class="ob-gap" title="Our model is ${Math.abs(Math.round(100 * d))} points ${d > 0 ? 'higher' : 'lower'} than Vegas here. This bet type has not beaten Vegas in testing, so it is not a bet.">${d > 0 ? '▲' : '▼'}${Math.abs(Math.round(100 * d))}</span>`;
}
function lkPctPair(v, l, vNote) {        // "V 30% · L 28%"
  return `<span class="ob-pp"><span class="v" title="Vegas: the price with the bookmaker’s cut removed${vNote ? ' (' + vNote + ')' : ''}">V ${bPct(v)}</span><span class="l" title="Locksmith’s model">L ${bPct(l)}</span></span>`;
}
function lkObCell(s, top, v, l, noPair) { // one market point: the price on top, the two chances and the gap under it
  if (!s && top == null) return '<span class="ob-c ob-na">–</span>';
  return `<span class="ob-c${s && (s.grade === 'bet' || s.grade === 'early') ? ' ob-bet' : ''}"><span class="ob-px">${top}</span>${noPair ? '' : lkPctPair(v, l)}${lkGapHTML(s, v, l)}</span>`;
}
function lkGameGaps(g) {                 // the biggest |Locksmith - Vegas| gap on any market point of this game
  let m = 0;
  for (const s of lkSides(g)) { const l = lkOurP(s); if (l != null && s.fair != null) m = Math.max(m, Math.abs(l - s.fair)); }
  return m;
}
function lkGameBoard(g) {
  const O = lkObSides(g), now = Date.now(), started = g.started || (g.start && new Date(g.start) <= now), noMkt = !lkSides(g).length;
  const x = lkStaked(g)[0] || (g.best && g.best.grade === 'lean' ? g.best : null), S = noMkt ? null : lkScore(g);
  const PW = g.proj && g.proj.win;
  // win chance per team: Vegas from the moneyline (college: from the spread when no moneyline is posted), Locksmith from its model
  const vHome = O.home.ml && O.home.ml.fair != null ? O.home.ml.fair : (PW && PW.src === 'market' && PW.home != null ? PW.home : null);
  const vNote = O.home.ml ? '' : vHome != null ? 'from the spread: no moneyline posted' : '';
  const lHome = O.home.ml ? lkOurP(O.home.ml) : (PW && PW.model != null ? PW.model : null);
  // the team in bold is the one the game page's "Who wins" names: the shown chance (props.js gpHomeChance: a staked moneyline's
  // own chance, else a certified chance, else the market's), so a Bet on an underdog never sits under the other team in bold
  const SW = typeof gpHomeChance === 'function' ? gpHomeChance(g.sport, g) : null;
  const hw = SW && SW.ours ? SW.p >= .5 : vHome != null ? vHome >= .5 : S ? S.homeWins : lHome != null ? lHome >= .5 : null;
  const row = (k, name, win) => {
    const T = O[k], isHome = k === 'home', v = win.v, l = win.l;
    const ml = T.ml ? lkObCell(T.ml, bAm(T.ml.price), T.ml.fair, lkOurP(T.ml), true) : '<span class="ob-c ob-na">–</span>';   // its chances are the Win chance column
    const spv = T.sp ? String(T.sp.lab).split(' ').pop().replace('-', '−') : null;
    const sp = T.sp ? lkObCell(T.sp, `${spv} <small>${bAm(T.sp.price)}</small>`, T.sp.fair, lkOurP(T.sp)) : '<span class="ob-c ob-na">–</span>';
    const tt = T.tot ? lkObCell(T.tot, `${isHome ? 'U' : 'O'} ${String(T.tot.lab).split(' ').pop()} <small>${bAm(T.tot.price)}</small>`, T.tot.fair, lkOurP(T.tot)) : '<span class="ob-c ob-na">–</span>';
    const winc = v == null && l == null ? '<span class="ob-c ob-na">No line yet</span>'
      : `<span class="ob-c ob-win"><span class="ob-big" title="Vegas’s chance${vNote ? ' (' + vNote + ')' : ''}">${v != null ? bPct(v) : '–'}</span><span class="ob-pp"><span class="v">Vegas${vNote ? '*' : ''}</span><span class="l" title="Locksmith’s model">L ${bPct(l)}</span></span>${!T.ml ? lkGapHTML(null, v, l) : ''}</span>`;
    const won = hw === isHome;
    return `<div class="ob-row${won ? ' fav' : ''}"><span class="ob-team">${won ? `<b>${esc(name)}</b>` : esc(name)}</span>${winc}${ml}${g.fight ? '' : sp + tt}</div>`;
  };
  const away = row('away', g.away, {v: vHome != null ? 1 - vHome : null, l: lHome != null ? 1 - lHome : null});
  const home = row('home', g.home, {v: vHome, l: lHome});
  const gb = lkGameBadge(g);
  const tag = started ? '<span class="tag" title="Started. Betting’s closed. We’ll grade it when it’s final.">Started</span>'
    : x ? `<span class="tag t-${x.grade}" title="${esc(lkVerdictText(g, x))}">${GRADE[x.grade]}</span>`
    : noMkt ? '<span class="bdg b-market" title="No sportsbook has posted a line yet. Locksmith’s number is its model only.">No line yet</span>' : gb ? lkBadgeHTML(gb) : '';
  const sc = S ? `<span class="ob-score"><small>${esc(S.lab)}</small>${esc(S.text)}</span>` : '';
  return `<div class="ob-game${g.fight ? ' ob-fight' : ''}"><button type="button" class="ob-head" data-open="${esc(g.sport + '|' + g.id)}" data-verdict="${esc(lkVerdictText(g))}">
    <span class="ll-time">${bTime(g.start)}</span><span class="ob-sp">${SPNAME[g.sport] || g.sport}</span>${sc}<span class="gl-tag">${tag}</span><span class="gl-go" aria-hidden="true">›</span></button>
    <div class="ob-grid"><div class="ob-hd"><span>${g.fight ? 'Fighter' : 'Team'}</span><span>Win chance</span><span>Moneyline</span>${g.fight ? '' : '<span>Spread</span><span>Total</span>'}</div>${away}${home}</div></div>`;
}
function lkGameLine(g) {
  const S = lkScore(g), now = Date.now(), started = g.started || (g.start && new Date(g.start) <= now), x = lkStaked(g)[0] || (g.best && g.best.grade === 'lean' ? g.best : null);
  const SW = typeof gpHomeChance === 'function' ? gpHomeChance(g.sport, g) : null;          // the game page's shown chance
  const hw = SW ? SW.p >= .5 : S ? S.homeWins : null;
  const nm = (t, w) => w ? `<b>${esc(t)}</b>` : esc(t);
  const match = `<span class="sp">${SPNAME[g.sport] || g.sport}</span>${nm(g.away, hw === false)} ${g.fight ? 'vs' : '@'} ${nm(g.home, hw === true)}`;
  let score = '';
  if (S) score = `<small>${esc(S.lab)}</small>${esc(S.text)}`;
  else if (SW) { const p = SW.p, w = p >= .5 ? g.home : g.away; score = `<small>${esc(SW.label)}</small>${bPct(Math.max(p, 1 - p))} ${esc(w)}`; }
  const ln = lkMarketLine(g);
  const gb = lkGameBadge(g);
  const tag = started ? '<span class="tag" title="Started. Betting’s closed. We’ll grade it when it’s final.">Started</span>' : x ? `<span class="tag t-${x.grade}" title="${esc(lkVerdictText(g, x))}">${GRADE[x.grade]}</span>` : gb ? lkBadgeHTML(gb) : '';
  return `<button type="button" class="lk-game" data-open="${esc(g.sport + '|' + g.id)}" data-verdict="${esc(lkVerdictText(g))}"><span class="ll-time">${bTime(g.start)}</span>
    <span class="gl-main"><span class="gl-match">${match}</span><span class="gl-meta"><span class="gl-score">${score}</span><span class="gl-line">${ln ? `<small>Market</small>${ln}` : ''}</span></span></span>
    <span class="gl-tag">${tag}</span><span class="gl-go" aria-hidden="true">›</span></button>`;
}
async function gamesRender() {
  $('#title').textContent = 'Games';
  $('#eyebrow').textContent = 'Every game: win chance and every line, Vegas vs Locksmith';
  const v = $('#view');
  if (!BETS && !BETS_ERR) { v.innerHTML = '<div class="lk-empty">Loading every game…</div>'; await betsLoad(); }
  if (VIEW !== 'games') return;
  if (!BETS) { v.innerHTML = lkErrorBox(); return; }
  const now = Date.now(), td = new Date().toLocaleDateString('en-CA'), t1 = new Date(); t1.setDate(t1.getDate() + 1); const tm = t1.toLocaleDateString('en-CA');
  const pool = (BETS.games || []).filter(g => !g.start || new Date(g.start) > now - 3.5 * 36e5);
  const inDay = (g, d) => d === 'week' ? (!g.start || new Date(g.start) < now + 7 * 864e5) : g.start && bDay(g.start) === (d === 'today' ? td : tm);
  if (LKF.gday === 'today' && !pool.some(g => inDay(g, 'today') && new Date(g.start) > now)) LKF._auto = true; else LKF._auto = false;
  const dsel = LKF._auto && LKF.gday === 'today' ? 'tomorrow' : LKF.gday;
  const inWin = pool.filter(g => inDay(g, dsel));
  lkSportChips(new Set(inWin.map(g => g.sport)), LKF.sport);
  const rows = inWin.filter(g => LKF.sport === 'all' || g.sport === LKF.sport).filter(g => !LKF.gaps || lkGameGaps(g) >= GAP || lkStaked(g).length)
    .sort((a, z) => (a.start ? +new Date(a.start) : 9e15) - (z.start ? +new Date(z.start) : 9e15) || LK_ORDER.indexOf(a.sport) - LK_ORDER.indexOf(z.sport));
  let body = '', day = undefined, grp = [];
  const flush = () => { if (grp.length) body += `<div class="lk-group"><h3 class="lk-day">${bDayLabel(day)}</h3><div class="ob-list">${grp.join('')}</div></div>`; grp = []; };
  for (const g of rows) { const k = g.start ? bDay(g.start) : null; if (k !== day) { flush(); day = k; } grp.push(lkGameBoard(g)); }
  flush();
  const nb = rows.filter(g => lkStaked(g).length).length;
  const lab = dsel === 'today' ? 'today' : dsel === 'tomorrow' ? 'tomorrow' : 'this week';
  const lead = rows.length ? `<b>${rows.length} game${rows.length === 1 ? '' : 's'} ${lab}.</b> ${nb ? `${nb} ${nb === 1 ? 'has a bet' : 'have a bet'}.` : 'None has a bet: nothing beats the market’s price.'}${LKF._auto && LKF.gday === 'today' ? ' Today’s games are done, so this shows tomorrow.' : ''}`
    : `<b>No games ${lab}.</b>`;
  const ch = (d, l) => `<button type="button" class="chip${dsel === d ? ' on' : ''}" data-gday="${d}">${l}</button>`;
  v.innerHTML = `<p class="lk-lead">${lead}</p>${lkAgeNote()}
    <div class="lk-chips">${ch('today', 'Today')}${ch('tomorrow', 'Tomorrow')}${ch('week', 'Next 7 days')}<button type="button" class="chip${LKF.gaps ? ' on' : ''}" data-gaps="1" title="Only games where Locksmith’s model and Vegas differ by 3 or more points on some market">Gaps of 3+ points</button></div>
    <p class="ob-key"><b>Win chance</b> and <b>V</b> = Vegas’s chance (the books’ odds with the bookmaker’s cut removed; Vegas* = from the spread when no moneyline is posted). Prices are the best price we found · <b>L</b> = Locksmith’s model · <span class="ob-gap">▲4</span> = our model is 4 points higher. A gap is not a bet until that bet type has beaten Vegas in testing: only <span class="tag t-bet">Bet</span> and <span class="tag t-early">Bet early</span> are.</p>
    ${body || `<div class="lk-empty">${LKF.gaps ? 'No game in this window has a gap of 3+ points.' : 'Nothing on the board in this window.'}</div>`}
    <p class="lk-small">A bet always agrees with the projected score: if the score says under, we never bet over. Scores keep their decimals (a 52.5 total shows as 27.75–24.75), so they never hint at an over or a cover the line doesn’t. Tap a game for its page. ${CERT ? 'A “Market’s score” is the market’s own projection; we show our own only where tests prove it’s closer.' : 'Our accuracy test is being built; until it is done, treat every score as the market’s number.'}</p>`;
  lkWire(v);
}

// ---------------------------------------------------------------- wiring + opening a game
async function lkOpen(s, id) {
  GAMEFROM = VIEW === 'today' ? 'today' : 'games';
  if (typeof stopPlay === 'function') try { stopPlay(); if (typeof W !== 'undefined') W.token++; } catch (e) {}
  SPORT = s; try { localStorage.setItem('lk-sport', s); } catch (e) {}
  $('#view').innerHTML = '<div class="lk-empty">Opening the game…</div>';
  try {
    if (s === 'nhl' && typeof nhlLoad === 'function') { await nhlLoad(); NGAME = +id; const b = N && N.books && N.books.find(x => +x.game_id === +id); if (b) NDATE = b.date; }
    else if ((s === 'nba' || s === 'wnba') && typeof nbaLoad === 'function') { BGAME = +id; await nbaLoad(); const b = NB && NB.books && NB.books.find(x => +x.game_id === +id); if (b) BDATE = b.date; }
    else if (s === 'ufc' && typeof ufcLoad === 'function') { await ufcLoad(); UFIGHT = String(id); const f = UF && UF.fights && UF.fights.find(x => String(x.fight_id) === String(id)); if (f && f.event_id != null) UEV = f.event_id; }
    else if (s === 'cfb' && typeof cfbLoad === 'function') { await cfbLoad(); CGAME = +id; const b = CF && CF.books && CF.books.find(x => +x.game_id === +id); if (b) CDATE = b.date; }
    else if (s === 'nfl') { GAME = String(id); GTAB = 'brief'; }
  } catch (e) {}
  VIEW = 'game'; if (typeof markNav === 'function') markNav(); render(); window.scrollTo(0, 0);
}
function lkWire(v) {
  v.querySelectorAll('[data-lk]').forEach(b => b.onclick = () => { BOPEN = BOPEN === b.dataset.lk ? null : b.dataset.lk; VIEW === 'today' ? todayRender() : null; });
  v.querySelectorAll('[data-open]').forEach(b => b.onclick = e => { e.stopPropagation(); const i = b.dataset.open.indexOf('|'); lkOpen(b.dataset.open.slice(0, i), b.dataset.open.slice(i + 1)); });
  v.querySelectorAll('[data-leans]').forEach(b => b.onclick = () => { LKF.leans = !LKF.leans; lkfSave(); todayRender(); });
  v.querySelectorAll('[data-gday]').forEach(b => b.onclick = () => { LKF.gday = b.dataset.gday; LKF._auto = false; lkfSave(); gamesRender(); });
  v.querySelectorAll('[data-gaps]').forEach(b => b.onclick = () => { LKF.gaps = !LKF.gaps; gamesRender(); });
}
document.addEventListener('click', e => {           // the shared sport chip row on Today and Games filters both screens
  const b = e.target.closest('#sportbar [data-fsp]'); if (!b) return;
  LKF.sport = b.dataset.fsp; lkfSave(); if (VIEW === 'today') todayRender(); else if (VIEW === 'games') gamesRender();
});
// old names some pages still call
const betsRender = () => (VIEW === 'games' ? gamesRender() : todayRender());
const bOpenGame = g => lkOpen(g.sport, g.id);
