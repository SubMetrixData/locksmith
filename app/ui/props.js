// Locksmith :: (1) the game-page helpers every sport page shares (gp*: one verdict line from reports/bets.json, the shown
// chance, the "Show the numbers" block, the live record box, plain names for bet types), and (2) the player props page
// shared by basketball and hockey.
// Props cfg = {P: props object from app_data, books: today's games, sport: 'nba'|'wnba'|'nhl', name: 'basketball'|'hockey', rerender}

// ================================================================ GAME PAGES: one verdict per game, from reports/bets.json
// The rule (reports/overnight/STANDARD.md): reports/bets.json (python -m locksmith.grade) holds the verdict, price, book,
// value and stake of every game. A game page repeats that line word for word and computes no verdict of its own. The win
// chance shown is the market's (bookmaker's cut removed) unless reports/certificate.json says Locksmith's number beats the
// market for that sport; anything from the raw model sits inside a collapsed "Show the numbers" block.
// The shell exposes window.lkBets() / window.lkGame(sport, id); until those exist these pages fetch the same files once.
let GPB = null, GPC = null, GPT = null;                         // this file's own copies of bets.json / certificate.json / tracker.json
const gpApi = () => window.pywebview && window.pywebview.api;
async function gpJSON(fn, path) {
  try {
    const a = gpApi(); if (a && a[fn]) return await a[fn]();
    const r = await fetch(path, {cache: 'no-store'}); if (!r.ok) throw new Error(String(r.status)); return await r.json();
  } catch (e) { return null; }
}
const gpShellBets = () => { try { return window.lkBets ? window.lkBets() : null; } catch (e) { return null; } };
async function gpLoad(force) {                                  // await before drawing a game page or a games list
  if (force || !GPB) GPB = gpShellBets() || await gpJSON('get_bets', '../../reports/bets.json') || {games: [], _missing: true};
  if (force || !GPC) GPC = await gpJSON('get_certificate', '../../reports/certificate.json') || {};
  return GPB;
}
async function gpTrackLoad(force) {                             // await before drawing a record page
  if (force || !GPT) GPT = await gpJSON('get_tracker', '../../reports/tracker.json') || {};
  return GPT;
}
function gpGame(sport, id) {                                    // that game's bets.json entry, or null
  let G = null;
  try { G = window.lkGame ? window.lkGame(sport, String(id)) : null; } catch (e) { G = null; }
  if (G) return G;
  const B = gpShellBets() || GPB;
  return ((B && B.games) || []).find(g => g.sport === sport && String(g.id) === String(id)) || null;
}
const gpUnit = () => { try { if (typeof lkUnit === 'function') return lkUnit(); const v = +(localStorage.getItem('ls_unit') || 25); return v > 0 ? v : 25; } catch (e) { return 25; } };
const gpUSD = x => '$' + Math.abs(Math.round(x)).toLocaleString();          // whole dollars, the same rounding as the Today line
const gpStake = d => { if (typeof bStake === 'function') return bStake(d); const c = Math.round(d * 100) / 100; return '$' + (Number.isInteger(c) ? c.toLocaleString() : c.toFixed(2)); };   // $50, $12.50 (the shell's bStake)
const gpAm = a => a == null || !isFinite(+a) ? '' : (+a > 0 ? '+' : '−') + Math.abs(Math.round(+a));
const gpPct = p => p == null || !isFinite(+p) ? '–' : Math.min(99, Math.max(1, Math.round(100 * p))) + '%';   // never 0% / 100%
const GP_GRADE = {bet: 'Bet', early: 'Bet early', lean: 'Lean'};
const GP_SPORT = {nfl: 'NFL', cfb: 'college football', nba: 'NBA', wnba: 'WNBA', nhl: 'NHL', ufc: 'UFC'};
const GP_BADGE = {beats_market: 'Beats the market', beats_opener: 'Beats the opening line', market: 'Market’s number', no_market: 'No line yet: model estimate'};

// plain names for the internal bet-type keys (never print nhl_prop, cfb_spread, ... on screen)
const GP_FAM = {nba_prop: 'NBA player props', wnba_prop: 'WNBA player props', nhl_prop: 'NHL player props', nfl_prop: 'NFL player props',
  nba_total_move: 'NBA totals (line-move)', nba_move: 'NBA spreads (line-move)', nba_spread: 'NBA spreads', nba_total: 'NBA totals', nba_ml: 'NBA moneylines',
  wnba_total: 'WNBA totals', wnba_spread: 'WNBA spreads', wnba_ml: 'WNBA moneylines', wnba_move: 'WNBA spreads (line-move)',
  nhl_ml: 'NHL moneylines', nhl_total: 'NHL totals', nhl_pl: 'NHL puck lines', cfb_spread: 'College spreads', cfb_total: 'College totals',
  cfb_total_move: 'College totals (line-move)', cfb_spread_move: 'College spreads (line-move)', cfb_wind: 'College unders in wind', cfb_ml: 'College moneylines',
  nfl_wind_under: 'NFL unders in wind', nfl_open_move_spread: 'NFL spreads (line-move)', nfl_open_move_total: 'NFL totals (line-move)', nfl_close_spread: 'NFL spreads at today’s line',
  nfl_spread: 'NFL spreads', nfl_total: 'NFL totals', ufc_ml: 'UFC fighters', ufc_lr_edge: 'UFC fighter model', open_move_spread: 'Spreads (line-move)',
  open_move_total: 'Totals (line-move)', live_candidates: 'Live candidates'};
function gpFam(k) {
  if (!k) return '';
  if (GP_FAM[k]) return GP_FAM[k];
  const N = (((gpShellBets() || GPB) || {}).live || {}).names || {};
  if (N[k]) return N[k][0].toUpperCase() + N[k].slice(1);
  if (String(k).startsWith('edge:')) return 'UFC fighter model';
  const sp = {nba: 'NBA', wnba: 'WNBA', nhl: 'NHL', nfl: 'NFL', cfb: 'College', ufc: 'UFC'}, p = String(k).split('_');
  return (sp[p[0]] ? [sp[p[0]], ...p.slice(1)] : p).join(' ');
}
// a sentence from the data with any internal key swapped for its plain name
const gpWords = s => String(s ?? '').replace(/\bedge:[a-z0-9_]+/g, 'UFC fighter model').replace(/\b(?:nba|wnba|nhl|nfl|cfb|ufc)_[a-z0-9_]+\b|\bopen_move_(?:spread|total)\b|\blive_candidates\b/g, k => gpFam(k));

// certificate.json: Locksmith's number may replace the market's only where a cell says "better"
function gpCert(sport, quantity, timing = 'current') {
  let C = GPC; try { if (window.lkCert && window.lkCert()) C = window.lkCert(); } catch (e) {}
  const c = (((C || {}).cells) || {})[`${sport}|${quantity}|${timing}`];
  return c && c.verdict === 'better' ? c : null;
}
// the home side's (UFC: fighter A's) shown win chance. bets.json's proj.win first (grade.py labels it), then the market's own
// no-vig chance from the moneyline rows, then wp_market; Locksmith's own number (wp_home) only where the certificate allows it.
// Order: (1) a staked moneyline (Bet / Bet early) on this game: its own chance, the very number the Bet line shows (rule 5: a
// bet never contradicts the shown win chance; grade.py also writes it into wp_home); (2) bets.json proj.win; (3) wp_home where
// the certificate rates the win chance better; (4) the market's no-vig chance. .src says which moment a badge may claim.
function gpHomeChance(sport, G, tp) {
  tp = tp || {};
  const W = G && G.proj && G.proj.win, cert = gpCert(sport, 'win');
  const ml = G ? (G.sides || []).find(s => s.mk === 'ml' && String(s.lab).replace(/ ML$/, '') === String(G.home)) : null;
  let mkt = ml && ml.fair != null ? +ml.fair : G && G.wp_market != null ? +G.wp_market : tp.source === 'market' ? (tp.home ?? tp.A) : tp.market;
  mkt = mkt != null && isFinite(+mkt) ? +mkt : null;
  const st = G ? (G.sides || []).find(s => s.mk === 'ml' && (s.grade === 'bet' || s.grade === 'early') && s.p != null && isFinite(+s.p)) : null;
  if (st) {
    const isH = String(st.lab).replace(/ ML$/, '') === String(G.home), ph = isH ? +st.p : 1 - +st.p;
    const fm = st.fair != null && isFinite(+st.fair) ? (isH ? +st.fair : 1 - +st.fair) : mkt;
    return {p: ph, mkt: fm, ours: true, label: 'Our chance', cert: {plain: gpWords(st.why || '')}, src: st.grade === 'early' ? 'opener_fit' : 'certified'};
  }
  if (W && W.home != null && isFinite(+W.home) && W.src && W.src !== 'no_market') { const ours = W.src !== 'market'; return {p: +W.home, mkt, ours, label: ours ? (W.label && W.label !== 'Market' ? W.label : 'Our chance') : 'Market', cert, src: W.src}; }
  if (G && cert && G.wp_home != null) return {p: +G.wp_home, mkt, ours: true, label: 'Our chance', cert, src: 'certified'};
  if (mkt == null) return null;
  return {p: mkt, mkt, ours: false, label: 'Market', cert: null, src: 'market'};
}
// "Market 73%", or where the certificate allows Locksmith's own number: "Our chance 79% · Market 74%  [Beats the market]"
// (a chance certified only at the opener says "Beats the opening line": rule 2, every accuracy claim names its moment)
const gpChanceTxt = (ch, p) => {
  if (!ch.ours) return `${esc(ch.label)} ${gpPct(p)}`;
  const m = ch.mkt == null ? null : (p === Math.max(ch.p, 1 - ch.p) ? (ch.p >= .5 ? ch.mkt : 1 - ch.mkt) : ch.mkt);
  return `${esc(ch.label)} ${gpPct(p)}${m != null ? ` · Market ${gpPct(m)}` : ''} <span class="gp-badge on" title="${esc((ch.cert && ch.cert.plain) || '')}">${ch.src === 'opener_fit' ? 'Beats the opening line' : 'Beats the market'}</span>`;
};
// the projected score: bets.json's proj (the one the bets are checked on) through lkScore (bets.js: THE ONE SCORE RULE, the
// decimals the projection has), then the page data's proj, then its final score. One set of fields, so the score never names
// a second winner. home / away are lkScore's display strings ("27.75", "3.1"); compare them with +.
function gpProj(G, b) {
  const P = (G && G.proj) || (b && b.proj) || null;
  if (G && G.proj && typeof lkScore === 'function') { try { const S = lkScore(G); if (S) return Object.assign({}, G.proj, {home: S.hs, away: S.as, lab: S.lab, homeWins: S.homeWins}); } catch (e) {} }
  if (P && P.home != null && P.away != null) return P;
  const f = b && b.pred_final;
  return f && f.length === 2 ? {home: f[0], away: f[1], margin: f[0] - f[1], total: f[0] + f[1]} : null;
}
const gpScore = (pj, H, A, nm = x => x) => pj ? ((pj.homeWins != null ? pj.homeWins : +pj.home >= +pj.away) ? `${esc(nm(H))} ${pj.home}, ${esc(nm(A))} ${pj.away}` : `${esc(nm(A))} ${pj.away}, ${esc(nm(H))} ${pj.home}`) : '';
// grade.py's accuracy badge for a projected quantity (proj.badge.margin / .total): "Market's number", "Beats the opening line"
// (only a Beats badge is highlighted; "No line yet" is the raw model, rated worse than a line, so it is never shown as a claim)
const gpProjBadge = (pj, q) => { const B = pj && pj.badge && pj.badge[q]; return B && B.kind ? ` <span class="gp-badge${B.kind === 'beats_market' || B.kind === 'beats_opener' ? ' on' : ''}" title="${esc(B.detail || B.text || '')}">${esc(GP_BADGE[B.kind] || B.text || '')}</span>` : ''; };
// "Who wins" from the shown chance; the projected score from the same fields as everywhere else (never a second winner)
function gpWho(ch, H, A, nm, pj, label = 'Who wins') {
  nm = nm || (x => x);
  const sc = pj ? `${pj.lab === 'Model estimate' ? 'model estimate:' : pj.lab === 'Market’s score' ? 'market’s score' : 'projected score'} ${gpScore(pj, H, A, nm)}` : '';
  if (!ch) return {l: label, v: 'No betting line yet', s: sc};
  const fav = ch.p >= .5 ? H : A, pf = Math.max(ch.p, 1 - ch.p);
  const lead = pj ? (+pj.home > +pj.away ? H : +pj.away > +pj.home ? A : null) : null;
  if (Math.abs(ch.p - .5) < .005 || (lead && lead !== fav)) return {l: label, v: 'Too close to call', s: `${esc(nm(fav))}: ${gpChanceTxt(ch, pf)}${sc ? ' · ' + sc : ''}`};
  return {l: label, v: esc(nm(fav)), s: `${gpChanceTxt(ch, pf)}${sc ? ' · ' + sc : ''}`};
}

// the verdict of one game, exactly as bets.json grades it: the first staked side (Bet / Bet early), else the lean, else No bet
// (the same choice the shell's Today line makes)
function gpVerdict(G) {
  const S = (G && G.sides) || [], xs = S.filter(s => s.grade === 'bet' || s.grade === 'early');
  const x = xs[0] || (G && G.best && GP_GRADE[G.best.grade] ? G.best : null), g = x ? x.grade : 'pass', staked = g === 'bet' || g === 'early', u = gpUnit();
  const why = gpWords((x && x.why) || (G ? 'Nothing beats the market’s price on this game.' : 'This game isn’t on today’s board.'));
  return {G, x, g, word: GP_GRADE[g] || 'No bet', staked, lab: x ? x.lab : '', price: x ? x.price : null, book: x ? x.book : null, badge: x && x.badge,
    per100: staked && x.ev != null && isFinite(x.ev) ? Math.round(100 * x.ev) : null, stake: staked && x.stake ? x.stake * u : 0, unit: u, why, chance: x && x.chance_text};
}
// THE FIRST LINE of every game page. The shell's lkVerdictHTML (the Today line itself, bets.js) when it is loaded, so the two
// can never differ; otherwise the same facts drawn here: bet + price + book + grade + "+$X per $100" + stake in dollars.
function gpHead(sport, id) {
  const G = gpGame(sport, id), B = gpShellBets() || GPB, v = gpVerdict(G);
  const hook = `data-gp-sport="${esc(sport)}" data-gp-id="${esc(String(id))}" data-gp-grade="${v.g}" data-gp-lab="${esc(v.lab)}" data-gp-price="${v.price ?? ''}" data-gp-book="${esc(v.book || '')}" data-gp-per100="${v.per100 ?? ''}" data-gp-stake="${v.stake || 0}"`;
  if (typeof lkVerdictHTML === 'function') { try { return `<div class="gp-head" ${hook}>${lkVerdictHTML(G)}</div>`; } catch (e) { /* fall through to the local line */ } }
  const txt = v.g === 'pass' ? `No bet: ${v.why}` : v.g === 'lean' ? `Lean (no money): ${v.lab} ${gpAm(v.price)}` : `${v.word}: ${v.lab} ${gpAm(v.price)}${v.per100 != null ? ` · ${v.per100 >= 0 ? '+' : '−'}$${Math.abs(v.per100)} per $100` : ''}${v.stake ? ` · bet ${gpStake(v.stake)}` : ''}`;
  const parts = v.g === 'pass' ? [`<span class="gp-lab">${esc(v.why)}</span>`]
    : [`<b class="gp-lab">${esc(v.lab)}</b>${v.price != null ? ` <span class="gp-px">${gpAm(v.price)}</span>` : ''}${v.book ? ` <span class="gp-bk">at ${esc(v.book)}</span>` : ''}`,
      v.per100 != null ? `<span class="gp-val">${v.per100 >= 0 ? '+' : '−'}$${Math.abs(v.per100)} per $100</span>` : '',
      v.staked ? (v.stake ? `<span class="gp-st">bet ${gpStake(v.stake)}</span>` : '<span class="gp-st">no stake</span>') : '<span class="gp-st muted">no money</span>'];
  const badge = v.badge && GP_BADGE[v.badge] ? ` <span class="gp-badge${v.badge !== 'market' ? ' on' : ''}">${GP_BADGE[v.badge]}</span>` : '';
  const miss = B && B._missing ? ' <span class="gp-miss">Couldn’t load today’s bets (reports/bets.json), so no game shows a bet.</span>' : '';
  return `<div class="gp-head" ${hook}><div class="gp-line g-${v.g}" data-verdict="${esc(txt)}"><span class="gp-g">${v.word}</span>${parts.filter(Boolean).join('<span class="gp-dot">·</span>')}${badge}</div>
    <div class="gp-sub">${v.chance ? esc(v.chance) + '. ' : ''}${v.g !== 'pass' ? esc(v.why) : ''}${miss}</div></div>`;
}
// a one-line verdict for list rows (same words, shorter)
function gpShort(sport, id) {
  const v = gpVerdict(gpGame(sport, id));
  return v.g === 'pass' ? '<span class="muted">No bet</span>'
    : `<span class="gp-pill g-${v.g}">${v.word}</span> <b>${esc(String(v.lab).replace(/ ML$/, ' to win'))}</b> <span class="gp-px">${gpAm(v.price)}</span>${v.staked && v.stake ? ` <span class="gp-st">bet ${gpStake(v.stake)}</span>` : ''}`;
}
// every side bets.json graded for this game: the price, the market's chance and the verdict with its reason
function gpSides(sport, id, title = 'Every bet on this game') {
  const G = gpGame(sport, id), S = (G && G.sides) || [], u = gpUnit();
  if (!S.length) return card(title, '', `<p class="note">${G ? 'No prices posted for this game yet.' : 'This game has not been graded yet.'}</p>`);
  const ord = {bet: 0, early: 1, lean: 2};
  const rows = S.slice().sort((a, z) => (ord[a.grade] ?? 3) - (ord[z.grade] ?? 3)).map(s => {
    const g = GP_GRADE[s.grade] ? s.grade : 'pass', st = (g === 'bet' || g === 'early');
    const val = st && s.ev != null ? ` · ${s.ev >= 0 ? '+' : '−'}$${Math.abs(Math.round(100 * s.ev))} per $100${s.stake ? ` · bet ${gpStake(s.stake * u)}` : ''}` : '';
    const l = typeof lkOurP === 'function' ? lkOurP(s) : (s.model != null ? s.model : null), gap = l != null && s.fair != null ? l - s.fair : null;
    const gapTxt = gap == null ? '–' : `${gap >= 0 ? '+' : '−'}${Math.abs(Math.round(100 * gap))}`;
    return `<tr class="gp-s g-${g}"><td><b>${esc(s.lab)}</b>${s.book ? ` <span class="muted">${esc(s.book)}</span>` : ''}</td><td class="r num">${gpAm(s.price) || '–'}</td><td class="r num">${s.fair != null ? gpPct(s.fair) : '–'}</td>
      <td class="r num">${l != null ? gpPct(l) : '–'}</td><td class="r num${gap != null && Math.abs(gap) >= 0.03 ? ' amb' : ' muted'}">${gapTxt}</td>
      <td><span class="gp-pill g-${g}">${GP_GRADE[g] || 'No bet'}</span>${val}<div class="muted gp-why">${esc(gpWords(s.why || ''))}</div></td></tr>`; });
  return card(title, 'Price = the best price we found. Vegas = the books’ chance with the bookmaker’s cut removed. Locksmith = our model’s chance for the same line. Gap = Locksmith minus Vegas, in points. A gap is only a bet when the verdict says Bet or Bet early: those bet types beat Vegas in testing; the rest have not.',
    table([{l: 'Bet'}, {l: 'Price', r: 1}, {l: 'Vegas', r: 1}, {l: 'Locksmith', r: 1}, {l: 'Gap', r: 1}, {l: 'Verdict'}], rows));
}
// the collapsed block that holds every raw-model number on a page
const gpRaw = (inner, note) => !inner ? '' : `<details class="gp-raw"><summary>Show the numbers</summary><p class="gp-rawnote">${note || 'Locksmith’s raw model (less accurate than the market in testing).'}</p>${inner}</details>`;
// (class lk-past too: the shell's Record page adds its own "Past games" banner only when a page has none)
const gpPast = (sub) => `<div class="gp-past lk-past"><h2>Past games (backtest), not live bets</h2>${sub ? `<p>${sub}</p>` : ''}</div>`;

// a logged ticket's label in plain words: no price repeated in brackets, no stat codes (sog, ast, fg3m ...)
const GP_STAT = {sog: 'shots on goal', ast: 'assists', pts: 'points', reb: 'rebounds', fg3m: 'threes', pra: 'pts + reb + ast', pr: 'pts + reb', pa: 'pts + ast', ra: 'reb + ast', stl: 'steals', blk: 'blocks', tov: 'turnovers', sb: 'steals + blocks'};
const gpBetWords = s => gpWords(String(s || '').replace(/\s*\([+\-−]?\d+\)\s*$/, '').replace(/\b(sog|ast|pts|reb|fg3m|pra|pr|pa|ra|stl|blk|tov|sb)$/, k => GP_STAT[k] || k));
// THE COMPLETE LIVE RECORD from reports/tracker.json, for every record on every page (Record, Today's line, each sport's page).
// tracker.report() counts each ticket Today showed once: the Board's own B| tickets that no sport pick already holds are in
// `bets`, `summary` and `by_sport`. An older tracker.json kept those Board-only tickets in board_bets alone; then they are folded
// in here by the same side key (sport|event|market|side, so nothing counts twice) and the totals are adjusted with them.
// -> {summary, by_sport, bets, merged (Board-only tickets folded in here), board (B| tickets inside the record)}
const GP_TC = new WeakMap();
function gpTracker(T) {
  T = T || {}; if (GP_TC.has(T)) return GP_TC.get(T);
  const B = T.bets || [], key = b => `${b.sport}|${b.event_id}|${b.market}|${b.side}`, isB = b => String(b.bid || '').startsWith('B|');
  const RI = T.record_includes;                       // the corrected report says what it counts: {tickets, sport_page, board_only, ...}
  let out = {summary: T.summary || {}, by_sport: T.by_sport || {}, bets: B, merged: 0, board: RI && RI.board_only != null ? +RI.board_only : B.filter(isB).length};
  if (!RI && !out.board) {
    const have = new Set(B.map(key)), X = (T.board_bets || []).filter(b => !have.has(key(b)));
    if (X.length) {
      const add = (S0, xs) => {
        const S = Object.assign({}, S0 || {}), g = xs.filter(b => b.status === 'graded'), r = k => g.filter(b => b.result === k).length;
        S.bets = (S.bets || 0) + xs.length; S.graded = (S.graded || 0) + g.length; S.wins = (S.wins || 0) + r('win'); S.losses = (S.losses || 0) + r('loss'); S.pushes = (S.pushes || 0) + r('push');
        S.units = (S.units || 0) + g.reduce((a, b) => a + (+b.units || 0), 0);
        S.open = (S.open || 0) + xs.filter(b => b.status === 'open').length; S.closed = (S.closed || 0) + xs.filter(b => b.status === 'closed').length;
        S.expected_wins = (S.expected_wins || 0) + g.filter(b => b.result === 'win' || b.result === 'loss').reduce((a, b) => a + (+b.p || 0), 0);
        return S;
      };
      const bs = Object.assign({}, out.by_sport);
      [...new Set(X.map(b => b.sport))].forEach(s => { bs[s] = add(bs[s], X.filter(b => b.sport === s)); });
      out = {summary: add(T.summary, X), by_sport: bs, bets: B.concat(X), merged: X.length, board: X.length};
    }
  }
  GP_TC.set(T, out); return out;
}
// the live tracked record of one sport (or one bet type) from reports/tracker.json: real logged bets, every one counted
function gpLiveRecord(sport, opt = {}) {
  const T = GPT || {}, TC = gpTracker(T), fam = opt.fam, name = opt.name || GP_SPORT[sport] || sport, u = gpUnit();
  const L = TC.bets.filter(b => b.sport === sport && (!fam || b.fam === fam));
  const S = !fam && TC.by_sport[sport] ? TC.by_sport[sport] : null;
  const gr = L.filter(b => b.result === 'win' || b.result === 'loss' || b.result === 'push');
  const W = S ? S.wins : gr.filter(b => b.result === 'win').length, Lo = S ? S.losses : gr.filter(b => b.result === 'loss').length, Pu = S ? S.pushes || 0 : gr.filter(b => b.result === 'push').length;
  const units = S ? S.units : gr.reduce((a, b) => a + (+b.units || 0), 0);
  const exp = S ? S.expected_wins : gr.reduce((a, b) => a + (b.result === 'push' ? 0 : (+b.p || 0)), 0);
  const open = L.filter(b => b.status === 'open').length, wd = L.filter(b => b.withdrawn).length, wdg = gr.filter(b => b.withdrawn).length;
  // "the line moved our way": only where closing lines were recorded for these bets (a 0% from no data would mislead)
  const bc = S && S.beat_close != null && L.some(b => b.clv != null || b.line_close != null || b.price_close != null) ? S.beat_close : null;
  if (!T.bets && !T.by_sport) return `<div class="gp-rec"><h2>Our live ${esc(name)} bets</h2><p>Couldn’t load the live record (reports/tracker.json).</p></div>`;
  if (!L.length) return `<div class="gp-rec"><h2>Our live ${esc(name)} bets</h2><p>No live ${esc(name)} bets logged yet. Every bet Locksmith shows is logged and graded here, wins and losses.</p></div>`;
  const recent = gr.slice().sort((a, z) => String(z.date || '').localeCompare(String(a.date || ''))).slice(0, 12);
  const res = r => r === 'win' ? '<span class="gp-pill g-win">Won</span>' : r === 'loss' ? '<span class="gp-pill g-loss">Lost</span>' : '<span class="gp-pill">Push</span>';
  const money = x => { const r = Math.round(x); return `<span class="${r > 0 ? 'gp-up' : r < 0 ? 'gp-dn' : ''}">${r > 0 ? '+' : r < 0 ? '−' : ''}${gpUSD(x)}</span>`; };   // whole dollars, no "−$0"
  return `<div class="gp-rec"><h2>Our live ${esc(name)} bets</h2>
    <p class="gp-recl"><b>${W}-${Lo}${Pu ? '-' + Pu : ''}</b> · ${money(units * u)} betting ${gpUSD(u)} a unit${open ? ` · ${open} still to play` : ''}</p>
    <p>${gr.length ? `We said about <b>${fx(exp, 1)}</b> of these would win; <b>${W}</b> did.` : 'Nothing graded yet.'}${bc != null && gr.length ? ` The line moved our way after we posted ${Math.round(100 * bc)}% of them.` : ''}${wd ? ` ${wd} were taken off the page before the game (${wdg} of those are graded and counted above).` : ''}</p>
    ${recent.length ? table([{l: 'Date'}, {l: 'Bet'}, {l: 'Result'}, {l: 'Won / lost', r: 1}], recent.map(b => `<tr><td class="muted">${esc(String(b.date || '').slice(5))}</td><td>${esc(b.away && b.home ? `${b.away} @ ${b.home}: ` : '')}<b>${esc(gpBetWords(b.bet))}</b> <span class="muted">${gpAm(b.price)}</span>${b.withdrawn ? ' <span class="muted">(taken off the page)</span>' : ''}</td><td>${res(b.result)}</td><td class="r num">${money((+b.units || 0) * u)}</td></tr>`)) : ''}</div>`;
}

// one line per game for a sport's games list: time · matchup · projected score · the bets.json verdict
function gpRow(sport, id, o) {
  const G = gpGame(sport, id), pj = gpProj(G, o.b);
  return `<div class="gp-row click" ${o.attr}><span class="gp-t num">${esc(o.when || '')}</span><span class="gp-m">${o.match}</span><span class="gp-p muted">${pj ? gpScore(pj, o.home, o.away) : ''}</span><span class="gp-v">${gpShort(sport, id)}</span></div>`;
}
function gpCount(sport, ids) {                                  // "2 bets · 1 lean" headline over a list of game ids
  const c = {bet: 0, early: 0, lean: 0}; ids.forEach(id => { const v = gpVerdict(gpGame(sport, id)); if (c[v.g] != null) c[v.g]++; });
  const n = c.bet + c.early;
  return `${n ? `<b>${n} bet${n > 1 ? 's' : ''}</b>${c.early ? ` (${c.early} to bet early)` : ''}` : '<b>No bets.</b> Nothing beats the price, and that is a normal day.'}${c.lean ? ` · ${c.lean} lean${c.lean > 1 ? 's' : ''} (no stake)` : ''}`;
}

(function gpStyle() {                                           // styles for the pieces above; colours are the shell's tokens
  if (document.getElementById('gp-css')) return;
  const s = document.createElement('style'); s.id = 'gp-css';
  s.textContent = `
.gp-line{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 8px;padding:14px 16px;border:1px solid var(--line,var(--rule));border-radius:12px;background:var(--surface,var(--panel));color:var(--ink);font-size:18px;line-height:1.35}
.gp-line .gp-g{font-weight:700;font-size:13px;padding:3px 10px;border-radius:99px;background:var(--surface-2,var(--panel2));color:var(--muted);align-self:center}
.gp-line.g-bet .gp-g,.gp-line.g-early .gp-g{background:var(--brand,var(--accent));color:var(--brand-ink,var(--accent-ink))}
.gp-line.g-lean .gp-g{background:transparent;border:1px solid var(--line,var(--rule));color:var(--ink-2,var(--ink2))}
.gp-line.g-bet,.gp-line.g-early{border-color:color-mix(in srgb,var(--brand,var(--accent)) 45%,transparent)}
.gp-dot{color:var(--muted)}
.gp-px,.gp-val,.gp-st,.gp-t{font-family:var(--mono);font-variant-numeric:tabular-nums}
.gp-val{color:var(--win,var(--accent));font-weight:600}
.gp-st{font-weight:700}
.gp-sub{color:var(--muted);font-size:13.5px;margin:6px 2px 14px;line-height:1.5}
.gp-miss{color:var(--loss,var(--red))}
.gp-pill{display:inline-block;font-size:12px;font-weight:700;padding:2px 8px;border-radius:99px;background:var(--surface-2,var(--panel2));color:var(--muted)}
.gp-pill.g-bet,.gp-pill.g-early{background:var(--brand,var(--accent));color:var(--brand-ink,var(--accent-ink))}
.gp-pill.g-lean{background:transparent;border:1px solid var(--line,var(--rule));color:var(--ink-2,var(--ink2))}
.gp-pill.g-win{background:color-mix(in srgb,var(--win,var(--accent)) 18%,transparent);color:var(--win,var(--accent))}
.gp-pill.g-loss{background:color-mix(in srgb,var(--loss,var(--red)) 18%,transparent);color:var(--loss,var(--red))}
.gp-up{color:var(--win,var(--accent))} .gp-dn{color:var(--loss,var(--red))}
.gp-why{font-size:12.5px;margin-top:3px;line-height:1.4;white-space:normal}
tr.gp-s td:last-child{white-space:normal;min-width:220px}
.gp-badge{font-size:11.5px;font-weight:600;padding:1px 7px;border-radius:99px;border:1px solid var(--line,var(--rule));color:var(--muted)}
.gp-badge.on{border-color:var(--brand,var(--accent));color:var(--brand,var(--accent))}
.gp-raw{border:1px solid var(--line,var(--rule));border-radius:12px;background:var(--surface,var(--panel));padding:2px 16px;margin-top:14px}
.gp-raw>summary{cursor:pointer;padding:11px 0;font-weight:600;color:var(--ink-2,var(--ink2))}
.gp-raw[open]{padding-bottom:16px}
.gp-raw .card{box-shadow:none;margin-top:10px}
.gp-rawnote{color:var(--muted);font-size:13px;margin:0 0 6px}
.gp-rec{border:1px solid var(--line,var(--rule));border-radius:12px;background:var(--surface,var(--panel));padding:16px 18px;display:flex;flex-direction:column;gap:8px}
.gp-rec h2,.gp-past h2{font-size:17px;margin:0;font-weight:600}
.gp-rec p{margin:0;line-height:1.55}
.gp-recl{font-size:20px}
.gp-past{margin:26px 0 10px;padding-top:14px;border-top:1px solid var(--line,var(--rule))}
.gp-past h2{color:var(--ink-2,var(--ink2))} .gp-past p{color:var(--muted);margin:4px 0 0;font-size:13.5px}
.gp-list{display:flex;flex-direction:column;border:1px solid var(--line,var(--rule));border-radius:12px;overflow:hidden;background:var(--surface,var(--panel))}
.gp-row{display:grid;grid-template-columns:76px minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.6fr);gap:10px;align-items:center;padding:11px 14px;border-top:1px solid var(--line,var(--rule))}
.gp-row:first-child{border-top:0} .gp-row:hover{background:var(--surface-2,var(--panel2))}
.gp-m{font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (max-width:700px){.gp-line{font-size:16px;padding:12px 14px}.gp-row{grid-template-columns:62px minmax(0,1fr);gap:4px 10px}.gp-row .gp-p{display:none}.gp-row .gp-v{grid-column:2}}
`;
  document.head.appendChild(s);
})();

// ================================================================ PLAYER PROPS (basketball and hockey)
let PS = {stat: '', game: '', q: '', sort: 'game', open: null, show: 40};
const PSTAT = {nba: {pts: 'Points', reb: 'Rebounds', ast: 'Assists', fg3m: 'Threes', pra: 'Pts+Reb+Ast', pr: 'Pts+Reb', pa: 'Pts+Ast', ra: 'Reb+Ast', stl: 'Steals', blk: 'Blocks', sb: 'Stl+Blk', tov: 'Turnovers'},
  nhl: {points: 'Points', assists: 'Assists', sog: 'Shots on goal', goal: 'Goals'}};
PSTAT.wnba = PSTAT.nba;
const pAm = x => ok(x) ? (x > 0 ? '+' : '') + Math.round(x) : '–';
const pKey = x => `${x.pid}|${x.stat}|${x.line}`;
// plain words for why a prop is not a bet
const PWHY = {'honest chance does not beat the price by enough': 'our chance does not beat the price by enough'};
const pWhy = s => gpWords(PWHY[s] || s || 'nothing beats the price');
// a prop's verdict: blocked bet types are never a bet, whatever the line looks like
function pVerdict(x, P) {
  if (P.blocked) return {g: 'pass', word: 'No bet', why: gpWords(P.blocked)};
  if (x.suspended) return {g: 'pass', word: 'No bet', why: gpWords(x.suspended)};
  if (x.pick) return {g: 'bet', word: 'Bet', why: ''};
  if (x.lean) return {g: 'lean', word: 'Lean', why: 'not proven at this price, no stake'};
  return {g: 'pass', word: 'No bet', why: pWhy(x.why_dropped)};
}
const pMarket = x => x.side === 'over' ? x.p_book : (x.p_book != null ? 1 - x.p_book : null);   // the market's chance of the side shown

function propsView(cfg) {
  const {P, books, sport, name} = cfg, SN = PSTAT[sport] || {};
  const gids = new Set(books.map(b => +b.game_id)), gl_ = {};
  books.forEach(b => gl_[+b.game_id] = `${b.away} @ ${b.home}`);
  const ALL = (P.lines || []).filter(x => gids.has(+x.game_id));
  const plays = P.blocked ? [] : pPlays(P, books);
  const stats = [...new Set(ALL.map(x => x.stat))].sort((a, z) => Object.keys(SN).indexOf(a) - Object.keys(SN).indexOf(z));
  let L = ALL.filter(x => (!PS.stat || x.stat === PS.stat) && (!PS.game || +x.game_id === +PS.game) && (!PS.q || x.player.toLowerCase().includes(PS.q.toLowerCase())));
  const sorters = {game: (a, z) => (+a.game_id - +z.game_id) || a.player.localeCompare(z.player), move: (a, z) => Math.abs(mv(z)) - Math.abs(mv(a)), player: (a, z) => a.player.localeCompare(z.player)};
  L = L.sort(sorters[PS.sort] || sorters.game);
  const day = books.length ? (dayName(books[0].date) === 'Today' ? 'today' : 'on ' + dayName(books[0].date)) : 'today';
  const fam = `${sport}_prop`, lg = sport === 'wnba' ? 'WNBA' : sport === 'nhl' ? 'NHL' : 'NBA';
  const why = plays.length ? '' : psWhyNoStake(sport, P);       // the one plain sentence: props.blocked + the certificate's prop cells
  const head = P.blocked ? `<div class="gp-line g-pass"><span class="gp-g">No bet</span><b class="gp-lab">No ${esc(lg)} player prop is a bet right now</b></div><div class="gp-sub">${esc(why)}${ALL.length ? ` The ${ALL.length} lines below are shown for reference only.` : ''}</div>`
    : !ALL.length ? `<div class="gp-line g-pass"><span class="gp-g">No bet</span><b class="gp-lab">No ${esc(lg)} player props are posted ${day} yet</b></div><div class="gp-sub">They usually go up the morning of the game. ${esc(why)}</div>`
    : plays.length ? `<div class="gp-line g-bet"><span class="gp-g">Bet</span><b class="gp-lab">${plays.length} player prop${plays.length > 1 ? 's' : ''} ${day}</b></div><div class="gp-sub">${ALL.length} lines priced. Each fits a rule that made money on earlier days of this season, graded at the opening price.</div>`
    : `<div class="gp-line g-pass"><span class="gp-g">No bet</span><b class="gp-lab">No ${esc(lg)} player prop is a bet ${day}</b></div><div class="gp-sub">${esc(why)} The ${ALL.length} lines below are shown for reference only.</div>`;
  const filt = `<div class="pfilt"><div class="chips">${['', ...stats].map(s => `<button class="chip ${PS.stat === s ? 'on' : ''}" data-ps="${s}">${s ? SN[s] || s : 'All'}</button>`).join('')}</div>
    <div class="row-flex"><input id="pq" class="search" placeholder="Search for a player…" value="${esc(PS.q)}"><select id="pg" class="search"><option value="">All games</option>${books.map(b => `<option value="${b.game_id}" ${+PS.game === +b.game_id ? 'selected' : ''}>${b.away} @ ${b.home}</option>`).join('')}</select>
    <select id="psort" class="search">${[['game', 'By game'], ['player', 'Player A–Z'], ['move', 'Biggest price move']].map(([k, l]) => `<option value="${k}" ${PS.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="muted">${L.length} lines</span></div></div>`;
  $('#view').innerHTML = head
    + `<div id="pShop" class="ps-wrap"></div>`                  // the prop shop: Underdog pick'em vs DraftKings + the pick'em builder (filled by psMount)
    + (plays.length ? card('Bets', 'The best side at the current price, one per player (bets on one player win or lose together).', `<div class="plist2">${plays.map(x => propRow(x, cfg, gl_)).join('')}</div>`) : '')
    + (ALL.length ? card('Every prop', `Market = the chance the betting market gives, with the bookmaker’s cut removed. ${TAP} a line for the last 10 games and how the price has moved.`, filt + `<div class="plist2">${L.slice(0, PS.show).map(x => propRow(x, cfg, gl_)).join('')}</div>${L.length > PS.show ? `<button class="btn" id="pmore">Show more (${L.length - PS.show} left)</button>` : ''}`) : '')
    + `<div id="pLive">${GPT ? gpLiveRecord(sport, {fam, name: `${lg} player prop`}) : ''}</div>`
    + propsRecord(cfg);
  if (!GPT) gpTrackLoad().then(() => { const el = $('#pLive'); if (el) el.innerHTML = gpLiveRecord(sport, {fam, name: `${lg} player prop`}); });
  psMount(sport);
  document.querySelectorAll('[data-ps]').forEach(b => b.onclick = () => { PS.stat = b.dataset.ps; PS.show = 40; cfg.rerender(); });
  const q = $('#pq');
  if (q) {
    q.oninput = () => { clearTimeout(window.__pqt); window.__pqt = setTimeout(() => { PS.q = q.value; PS.show = 40; cfg.rerender(); const x = $('#pq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 220); };
    $('#pg').onchange = e => { PS.game = e.target.value; cfg.rerender(); };
    $('#psort').onchange = e => { PS.sort = e.target.value; cfg.rerender(); };
  }
  const more = $('#pmore'); if (more) more.onclick = () => { PS.show += 60; cfg.rerender(); };
  document.querySelectorAll('[data-pk]').forEach(el => el.onclick = e => { if (e.target.closest('.pdet')) return; PS.open = PS.open === el.dataset.pk ? null : el.dataset.pk; cfg.rerender(); });
}
const mv = x => ok(x.p_open) ? x.p_book - x.p_open : 0;

function rulesText(rules, SN) {
  if (!rules.length) return '';
  return 'Rules in force: ' + rules.slice(0, 4).map(r => `${r.stat === 'any' ? 'any prop' : (SN[r.stat] || r.stat).toLowerCase()} ${r.side === 'both' ? 'either side' : r.side + 's'} when Locksmith disagrees by ${Math.round(100 * r.edge)}%+ (${r.n} graded past bets, ${sgn(100 * r.roi, 1)}% a bet)`).join('; ') + '.';
}

// one prop: who, the line and price, the market's chance, the last 10 games, and the verdict with its reason
function propRow(x, cfg, gl_) {
  const SN = PSTAT[cfg.sport] || {}, pl = (cfg.P.players || {})[x.pid] || {}, k = pKey(x), open = PS.open === k;
  const price = x.side === 'over' ? x.over_price : x.under_price, h = x.hit10 || [0, 0], V = pVerdict(x, cfg.P);
  return `<div class="prop ${open ? 'open' : ''} ${V.g === 'bet' ? 'play' : ''}" data-pk="${k}">
    <div class="ph"><div class="pwho">${hshot(cfg.sport, x.pid, x.player, 42)}<div class="who"><b>${esc(x.player)}</b><span class="muted">${tlogo(x.team, 16, cfg.sport)} ${esc(x.team)} · ${esc(gl_[+x.game_id] || '')}</span></div></div>
      <div class="pbet"><b>${x.side === 'over' ? 'Over' : 'Under'} ${x.line}</b> ${SN[x.stat] || x.stat} <span class="muted">${pAm(price)}</span></div></div>
    <div class="pnums"><span><small>Market</small><b>${gpPct(pMarket(x))}</b></span><span><small>${x.side === 'over' ? 'Over' : 'Under'} in last ${h[1] || 10}</small><b>${h[1] ? `${x.side === 'over' ? h[0] : h[1] - h[0]}/${h[1]}` : '–'}</b></span>
      <span><small>Verdict</small><b><span class="gp-pill g-${V.g}">${V.word}</span></b></span></div>
    ${V.why ? `<div class="muted gp-why">${esc(V.why)}</div>` : ''}
    ${open ? propDetail(x, pl, cfg) : ''}</div>`;
}

function propDetail(x, pl, cfg) {
  const SN = PSTAT[cfg.sport] || {}, lab = (SN[x.stat] || x.stat).toLowerCase();
  const d = (pl.dist || {})[x.stat];
  const last = (pl.last || {})[x.stat] || [], dates = (pl.last || {}).dates || [];
  const moveTxt = (() => {
    if (!ok(x.over_open)) return 'No opening price recorded.';
    const lm = ok(x.line_open) && x.line_open !== x.line ? ` The line moved from ${x.line_open} to ${x.line}.` : '';
    const dir = mv(x), tw = (x.side === 'over' ? dir > 0 : dir < 0);
    return `Opened over ${pAm(x.over_open)} / under ${pAm(x.under_open)}; now ${pAm(x.over_price)} / ${pAm(x.under_price)}.${lm} ${Math.abs(dir) < .01 ? 'Hardly moved.' : tw ? 'The price has moved toward this side.' : 'The price has moved against this side.'}`;
  })();
  const bb = cfg.sport === 'nba' || cfg.sport === 'wnba';
  const why = bb ? ((pl.why || {})[x.stat] || []) : [], whyMin = bb ? ((pl.why || {}).min || []) : [];
  const ctx = bb
    ? `Projected <b>${fx((pl.proj || {}).min, 0)} minutes</b> (usual ${fx(pl.usual_min, 0)})${whyMin.length ? ': ' + whyMin.map(w => `${esc(w.why.toLowerCase())} ${sgn(w.d, 1)}`).join(', ') : ''}. ${pl.team_total ? `Team expected to score ${fx(pl.team_total, 1)}.` : ''} ${pl.team_out_min > 20 ? `Teammates out tonight take about ${Math.round(pl.team_out_min)} minutes a game with them.` : ''}`
    : `Projected <b>${fx(pl.toi, 1)} minutes</b> of ice time${pl.pp_unit ? `, on the ${esc(pl.pp_unit)} power play` : ''}. Expected ${fx((pl.proj || {}).sog, 1)} shots, ${fx((pl.proj || {}).goal, 2)} goals, ${fx((pl.proj || {}).assists, 2)} assists.`;
  const ms = (cfg.P.milestones || []).filter(m => m.pid === x.pid && m.stat === x.stat).sort((a, z) => a.k - z.k);
  const raw = `<div class="grid g2"><div><h4>Chance of each outcome</h4>${d ? pDistSVG(d, x.line) : '<p class="muted">No distribution.</p>'}
      <p class="note">Locksmith’s projection: <b>${fx(x.proj, 1)} ${esc(lab)}</b>. Locksmith alone: ${pct(x.p_model)} over. Blended with the price: ${pct(x.p_over)} over${x.truth && x.truth.p != null ? `; pooled with past results: ${pct(x.truth.p)} for this side` : ''}. The market: ${pct(x.p_book)} over${ok(x.p_open) ? ` (opened at ${pct(x.p_open)})` : ''}. Value at the current price: ${sgn(100 * x.ev, 1)}%.</p></div>
    <div><h4>Why ${fx(x.proj, 1)} ${esc(lab)}</h4><p class="note">${ctx} ${pl.status ? `<span class="badge warn">${esc(pl.status)}</span> (assumed to play)` : ''}</p>
      ${why.length ? `<div class="why">${why.map(w => `<div><span>${esc(w.why)}</span><b>${sgn(w.d, 1)}</b></div>`).join('')}</div><p class="note">Each number is how much that factor moves tonight’s projection, compared with an average night.</p>` : ''}
      ${ms.length ? `<h4>Milestones</h4>${table([{l: 'Bet'}, {l: 'Price', r: 1}, {l: 'Locksmith', r: 1}], ms.map(m => `<tr><td>${m.k}+</td><td class="r num">${pAm(m.price)} <span class="muted">${pct(m.p_price)}</span></td><td class="r num">${pct(m.p_model)}</td></tr>`))}<p class="note">Milestones carry extra bookmaker margin and have not tested as profitable.</p>` : ''}</div></div>`;
  return `<div class="pdet">
    <div class="grid g2">
      <div><h4>Last ${last.length} games vs ${x.line}</h4>${last.length ? `<div class="l10">${last.map((v, i) => `<span class="${v > x.line ? 'ov' : 'un'}" title="${esc(dates[i] || '')}">${v}</span>`).join('')}</div><p class="note">${last.filter(v => v > x.line).length} of ${last.length} over ${x.line}. Average ${fx(last.reduce((a, b) => a + b, 0) / last.length, 1)}.</p>` : '<p class="muted">No games yet.</p>'}</div>
      <div><h4>Price</h4><p class="note">${moveTxt}</p></div></div>
    ${gpRaw(raw)}</div>`;
}

function pDistSVG(d, line) {
  const k0 = d[0], p = d[1], n = p.length, W = 320, H = 120, bw = W / n, mx = Math.max(...p, 1e-6);
  const over = p.reduce((a, v, i) => a + (k0 + i > line ? v : 0), 0);
  const step = n > 24 ? 5 : n > 12 ? 2 : 1;
  return `<svg viewBox="0 0 ${W} ${H + 18}" class="dist" role="img" aria-label="Chance of each outcome">
    ${p.map((v, i) => { const k = k0 + i, h = (H - 14) * v / mx; return `<rect x="${i * bw + 1}" y="${H - h}" width="${Math.max(bw - 2, 1)}" height="${h}" class="${k > line ? 'ov' : 'un'}"><title>${k}: ${(100 * v).toFixed(1)}%</title></rect>`; }).join('')}
    <line x1="${(line - k0 + 0.5) * bw}" x2="${(line - k0 + 0.5) * bw}" y1="0" y2="${H}" class="ln"/>
    <text x="${Math.min(W - 70, Math.max(4, (line - k0 + 0.5) * bw + 4))}" y="11" class="lt">line ${line}: ${(100 * over).toFixed(0)}% over</text>
    ${p.map((v, i) => (k0 + i) % step === 0 ? `<text x="${i * bw + bw / 2}" y="${H + 14}" class="ax">${k0 + i}</text>` : '').join('')}</svg>`;
}

// how props were tested: past graded lines (a backtest), behind "Show the numbers"
function propsRecord(cfg) {
  const R = cfg.P.record || {}, SN = PSTAT[cfg.sport] || {}, MT = cfg.P.model_test;
  if (!R.n) return gpPast('Not enough graded prop lines yet.');
  const bs = R.by_stat || {}, c = R.clv || {}, wf = R.walk_forward || {};
  const rows = Object.entries(bs).sort((a, z) => z[1].n - a[1].n).map(([k, v]) => `<tr><td>${SN[k] || k}</td><td class="r num">${v.n}</td><td class="r num">${pct(v.over_rate)} / ${pct(v.book_over)}</td><td class="r num">${fx(v.ll_locksmith, 3)} / ${fx(v.ll_open, 3)}</td><td class="r num">${(v.clv || {}).lines ? pct(v.clv.toward) : '–'}</td></tr>`);
  const tiers = (R.tiers || []).map(t => `<tr><td>${Math.round(100 * t.edge_at_least)}%+</td><td class="r num">${t.bets}</td><td class="r num">${t.bets ? t.wins + '-' + t.losses : '–'}</td><td class="r num ${t.roi >= 0 ? 'pos' : 'neg'}">${t.bets ? sgn(100 * t.roi, 1) + '%' : '–'}</td></tr>`);
  const mt = MT && MT.stats ? card('How close are the player projections?', `Every player-game of ${MT.seasons[0]}-${String((MT.seasons[MT.seasons.length - 1] + 1) % 100).padStart(2, '0')} (${MT.player_games.toLocaleString()}), each season projected by a model trained only on earlier seasons. Average miss, lower is better.`,
    table([{l: 'Stat'}, {l: 'Locksmith', r: 1}, {l: 'Old model', r: 1}, {l: 'Recent average', r: 1}], Object.entries(MT.stats).filter(([k]) => SN[k]).map(([k, v]) => `<tr><td>${SN[k]}</td><td class="r num"><b>${fx(v.mae_locksmith, 2)}</b></td><td class="r num">${fx(v.mae_v1, 2)}</td><td class="r num">${fx(v.mae_recent_avg, 2)}</td></tr>`))) : '';
  return gpPast(`${R.n.toLocaleString()} real over/unders from ${esc(R.dates[0])} to ${esc(R.dates[1])} (${R.games} games), each priced by a model that never saw that game and graded at the opening price. Rules chosen day by day from earlier days only: ${wf.bets ? `${wf.wins}-${wf.losses}, ${sgn(100 * wf.roi, 1)}% a bet` : 'no rule qualified yet'}. ${(c.lines || 0) ? `When the price moved before the game, it moved toward Locksmith’s side ${pct(c.toward)} of the time (${c.lines} lines; 50% would be no skill).` : ''}`)
    + gpRaw(`<div class="grid g2">${card('Prop lines graded', 'Accuracy is log loss: lower is better.', table([{l: 'Prop'}, {l: 'Lines', r: 1}, {l: 'Over hit / priced', r: 1}, {l: 'Locksmith / market', r: 1}, {l: 'Moved our way', r: 1}], rows))}
      ${card('Betting every disagreement at the opener', 'Not the bets: the bets only come from rules that worked on earlier days.', table([{l: 'Disagreement'}, {l: 'Bets', r: 1}, {l: 'Won-lost', r: 1}, {l: 'Return', r: 1}], tiers) + `<p class="note">${esc(rulesText(cfg.P.rules || [], SN))}</p>`)}
      ${mt}</div>`, 'Past graded lines and the raw model behind them.');
}

function pPlays(P, books) {
  if (!P || P.blocked) return [];                                 // a blocked bet type has no plays, whatever the lines say
  const gids = new Set(books.map(b => +b.game_id)), best = {};
  ((P || {}).lines || []).filter(x => x.pick && !x.suspended && gids.has(+x.game_id)).sort((a, z) => z.ev - a.ev).forEach(x => { if (!best[x.pid]) best[x.pid] = x; });
  return Object.values(best);
}
function pPlaysHTML(PP, sport, books) {
  const g = {}; books.forEach(b => g[+b.game_id] = `${b.away} at ${b.home}`);
  return `<div class="tickets">${PP.slice(0, 8).map(x => propTicket({sport, pid: x.pid, player: x.player, team: x.team, game: g[+x.game_id] || '', bet: `${x.side === 'over' ? 'Over' : 'Under'} ${x.line} ${((PSTAT[sport] || {})[x.stat] || x.stat).toLowerCase()}`, price: pAm(x.side === 'over' ? x.over_price : x.under_price), chance: pMarket(x), note: `Market ${gpPct(pMarket(x))}`})).join('')}</div>`;
}

// ================================================================ PROP SHOP: Underdog pick'em lines priced from DraftKings
// reports/prop_shop.json (python -m locksmith.propshop). Locksmith's own prop models only tie DraftKings, so the prop edge, if
// there is one, is shopping, not out-modelling: Underdog Fantasy's pick'em line for the same player and stat, priced from
// DraftKings' no-vig chance moved to Underdog's line with a stat distribution. A flag = that fair chance clears the per-pick
// break-even of a 3-pick standard entry at the pick's payout multiplier. NO STAKE: the tracker logs every flag as an 'S|' row
// with its own record (tracker.json propshop_summary), never in the headline record. A sport's tag reads "Tracking (not proven
// yet)" unless certificate.json rates <sport>|prop_shop|current "better"; even then that test is DraftKings' own line moves (a
// stale line priced from the newer one), not proof that Underdog lags DraftKings: only the live S| record can show that.
// The pick'em builder multiplies the fair chances of 2-5 tapped picks (independence assumed; same-game picks are flagged).
// Pages: propsView (NBA / WNBA / NHL) calls psMount(sport); the NFL props page is app.js's props(), wrapped below.
let PSH = null, PSH_P = null;                                   // prop_shop.json once loaded / the load in flight
const PSHOP = {view: {}, sel: null, msg: '', det: null};        // the sport chip per page ('nba' | 'nhl' | 'nfl' | 'all'), the picked keys, builder details open
const PS_SP = ['nba', 'nhl', 'nfl'], PS_MAX = 5, PS_PAY = {2: 3, 3: 6, 4: 10, 5: 20};   // PS_PAY only if the report has no table
const PS_NAME = {nba: 'NBA', nhl: 'NHL', nfl: 'NFL', cfb: 'College football', wnba: 'WNBA'};
const PS_FRESH = {draftkings: 'DraftKings moved last', underdog: 'Underdog moved last', unknown: 'Not clear which moved last'};
const psNarrow = () => { try { return matchMedia('(max-width:760px)').matches; } catch (e) { return false; } };
const psKey = x => `${x.sport}|${x.espn_id}|${x.pid}|${x.stat}|${x.pick}`;     // the tracker's S| id without its prefix
const psP = p => p == null || !isFinite(+p) ? '–' : (100 * p).toFixed(1) + '%';   // one decimal: these edges are 0.1 to 5 points
const psX = m => `${Math.round(m * 100) / 100}x`;
const psMoney = v => { const a = Math.abs(v), s = a < .005 ? '' : v > 0 ? '+' : '−'; return s + '$' + (a >= 100 ? Math.round(a).toLocaleString() : a.toFixed(2)); };
const psRoi = r => r == null || !isFinite(+r) ? '–' : `${r >= 0 ? '+' : '−'}${Math.abs(100 * r).toFixed(1)}%`;
const psStat = x => String(x.stat_label || x.stat || '').replace(/\s*\+\s*/g, ' + ');
const psPickTxt = x => `${x.pick === 'over' ? 'Over' : 'Under'} ${x.ud_line} ${psStat(x)}`;
const psStarted = x => { const t = Date.parse(x.start_utc); return isFinite(t) && t <= Date.now(); };
const psClock = iso => { const d = new Date(iso); return isFinite(d) ? d.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) : '–'; };
const psWhen = x => { const d = new Date(x.start_utc); if (!isFinite(d)) return ''; return d.toDateString() === new Date().toDateString() ? psClock(x.start_utc) : `${d.toLocaleDateString([], {weekday: 'short'})} ${psClock(x.start_utc)}`; };
const psPay = n => +((((PSH || {}).payouts || {}).table || {})[n]) || PS_PAY[n];
const psBE = (n, m) => Math.pow(1 / psPay(n), 1 / n) / (+m || 1);          // per-pick break-even of an n-pick standard entry at multiplier m
function psCert() { let C = GPC; try { if (window.lkCert && window.lkCert()) C = window.lkCert(); } catch (e) {} return C && C.cells ? C : null; }
const psCell = (sport, q, t = 'current') => ((psCert() || {}).cells || {})[`${sport}|${q}|${t}`] || null;
const psUnitWord = () => { const u = String(((PSH || {}).test || {}).unit || ''); return /week/i.test(u) ? 'weeks' : /month/i.test(u) ? 'months' : 'seasons'; };
const psOf = c => `${Math.round((+c.seasons_better || 0) * (+c.seasons || 0))} of ${c.seasons} ${psUnitWord()}`;   // certify's "seasons" are this test's weeks

function psLoad() {                                             // desktop: get_prop_shop; web: ../../reports/prop_shop.json
  if (PSH && !PSH._missing) return Promise.resolve(PSH);
  if (!PSH_P) PSH_P = Promise.resolve(typeof lkFetch === 'function' ? lkFetch('get_prop_shop', 'prop_shop.json') : gpJSON('get_prop_shop', '../../reports/prop_shop.json'))
    .then(r => { PSH = r && !r.__err && (r.flags || r.by_sport) ? r : {_missing: true, err: (r && r.__err) || 'not built yet'}; PSH_P = null; return PSH; })
    .catch(e => { PSH = {_missing: true, err: String((e && e.message) || e)}; PSH_P = null; return PSH; });
  return PSH_P;
}
// the picked keys, restored once from this device (a convenience only: nothing is logged from here)
function psSel() {
  if (PSHOP.sel == null) { let s = []; try { s = JSON.parse(localStorage.getItem('lk-pickem') || '[]'); } catch (e) { s = []; } PSHOP.sel = Array.isArray(s) ? s.map(String) : []; }
  return PSHOP.sel;
}
function psSave() { try { localStorage.setItem('lk-pickem', JSON.stringify(PSHOP.sel || [])); } catch (e) {} }
const psPicked = () => { const F = (PSH && PSH.flags) || []; return psSel().map(k => F.find(x => psKey(x) === k)).filter(x => x && !psStarted(x)); };

// why no player prop gets money, in one plain sentence: props.blocked (live results below promise) + the certificate's prop cells
function psWhyNoStake(sport, P) {
  const lg = PS_NAME[sport] || String(sport).toUpperCase(), o = psCell(sport, 'prop', 'open'), c = psCell(sport, 'prop', 'current');
  const vw = x => x.verdict === 'worse' ? 'loses to' : x.verdict === 'better' ? 'beats' : 'only ties', n = x => (+x.n || 0).toLocaleString();
  const bl = P && P.blocked ? gpWords(P.blocked).split(/\.\s+/)[0].replace(/\.\s*$/, '') : '';
  if (!bl && [o, c].filter(Boolean).length && [o, c].filter(Boolean).every(x => x.verdict === 'better')) return `No ${lg} prop fits a tested betting rule today.`;
  const model = o && c && o.verdict === c.verdict ? `our prop model ${vw(o)} DraftKings’ price on lines it never saw (${n(o)} at the opener, ${n(c)} before the game)`
    : o || c ? `our prop model ${[o && `${vw(o)} DraftKings’ opening price (${n(o)} lines it never saw)`, c && `${vw(c)} its price before the game (${n(c)} lines)`].filter(Boolean).join(' and ')}`
    : `our ${lg} prop chances have not passed the accuracy test against DraftKings’ lines`;
  return `No ${lg} prop gets money because ${bl ? bl.charAt(0).toLowerCase() + bl.slice(1) + ', and ' : ''}${model}.`;
}
// a sport's tag: "Tracking (not proven yet)" unless the certificate rates the prop shop's test better than the stale line's price
function psTag(sport) {
  const c = psCell(sport, 'prop_shop');
  if (c && c.verdict === 'better') return {on: true, c, text: 'Passed the stale-line test',
    title: `Tested on ${(+c.n).toLocaleString()} past DraftKings line moves: its newer price beat its own old line in ${psOf(c)} (checked in R). That shows a stale line can be beaten, not yet that Underdog is the stale one.`};
  return {on: false, c, text: 'Tracking (not proven yet)', title: c ? `Tested on ${(+c.n).toLocaleString()} past DraftKings line moves: not proven (better in ${psOf(c)}, not enough to count).` : 'No accuracy test for this sport yet.'};
}
// the live tracked record of the flagged picks (tracker.json propshop_summary: no stake, never in the headline record)
function psLiveTxt(sport) {
  if (!GPT) return '';
  const S = GPT.propshop_summary;
  if (!S) return 'Live record: starts with these picks';
  const b = (S.by_sport || {})[sport];
  if (!b || !b.n) return 'Live record: nothing logged yet';
  if (!b.graded) return `Live record: ${b.n} logged, none graded yet`;
  return `Live: ${b.wins}-${b.losses} (${psP(b.hit_rate)} hit) · needed ${psP(b.breakeven)}${b.open ? ` · ${b.open} to play` : ''}`;
}
function psNoneTxt(s) {
  const B = ((PSH || {}).by_sport || {})[s] || {}, lg = PS_NAME[s] || s, m = +B.matched_to_draftkings || 0;
  if (!B.underdog_lines) return `No ${lg} lines at Underdog right now.`;
  if (!m) return `${(+B.underdog_lines).toLocaleString()} ${lg} lines at Underdog; none matched to a DraftKings line.`;
  return `${m.toLocaleString()} ${lg} Underdog lines matched to DraftKings, ${Math.round(100 * (+B.share_same_line || 0))}% at the same line; none clears the bar.${/no prices|lines only/i.test(B.draftkings || '') ? ' ESPN’s NFL feed has no DraftKings prices, so only a different line can be flagged, with 3 extra points of margin.' : ''}`;
}

// one flagged pick on one line: who · the pick · Underdog's line vs DraftKings' · the fair chance vs what an entry needs
function psRowHTML(x) {
  const k = psKey(x), on = psSel().includes(k), st = psStarted(x), m = +x.mult || 1, dk = x.pick === 'over' ? x.dk_over : x.dk_under, same = +x.ud_line === +x.dk_line;
  return `<button type="button" class="ps-row${on ? ' on' : ''}${st ? ' started' : ''}" data-psk="${esc(k)}" aria-pressed="${on}"${st ? ' disabled' : ''}>
    <span class="ps-tick" aria-hidden="true"></span>
    <span class="ps-who"><b>${esc(x.player)}</b><small>${esc([x.game, st ? 'started' : psWhen(x)].filter(Boolean).join(' · '))}</small></span>
    <span class="ps-pick"><b>${esc(psPickTxt(x))}</b><small>${m !== 1 ? `pays ${psX(m)} a pick` : 'standard pick'}</small></span>
    <span class="ps-lines"><span>Underdog <b class="num">${x.ud_line}</b> · DraftKings <b class="num">${x.dk_line}</b>${same && dk != null ? ` <span class="num">${gpAm(dk)}</span>` : ''}</span><small>${esc(PS_FRESH[x.changed_last] || '')}</small></span>
    <span class="ps-ch"><b class="num">${psP(x.p_side)}</b></span>
    <small class="ps-need">needs ${psP(psBE(3, m))} for 3 picks, ${psP(psBE(2, m))} for 2</small></button>`;
}
function psGroupHTML(s, xs) {
  const T = psTag(s), lv = psLiveTxt(s);
  return `<div class="ps-gh"><b>${esc(PS_NAME[s])}</b><span class="bdg ${T.on ? 'b-opener' : 'b-build'}" title="${esc(T.title)}">${esc(T.text)}</span>${lv ? `<span class="ps-live">${esc(lv)}</span>` : ''}</div>`
    + (xs.length ? `<div class="ps-list">${xs.map(psRowHTML).join('')}</div>` : `<div class="ps-empty">${esc(psNoneTxt(s))}</div>`);
}

// the pick'em builder: 2-5 tapped picks -> the chance all hit (product, independence assumed), the payout, the average profit.
// It sticks to the bottom of the screen while picks are chosen, so it stays short: the numbers and any same-game warning;
// "Show picks" opens the picked list and the arithmetic (open by default on a wide screen, closed on a phone).
function psBuilderHTML() {
  const S = psPicked(), n = S.length, u = gpUnit(), msg = PSHOP.msg ? `<p class="ps-warn">${esc(PSHOP.msg)}</p>` : '';
  if (!n) return `<div class="ps-b idle"><b>Pick’em builder</b><span>${TAP} 2 to 5 picks above to see the chance they all hit and what the entry is worth.</span>${msg}</div>`;
  const det = PSHOP.det == null ? !psNarrow() : PSHOP.det;
  const sel = `<div class="ps-sels">${S.map(x => `<span class="ps-sel">${esc(x.player)}: ${esc(psPickTxt(x).toLowerCase())}<button type="button" data-psx="${esc(psKey(x))}" aria-label="Remove ${esc(x.player)}">×</button></span>`).join('')}</div>`;
  const hd = t => `<div class="ps-bh"><b>${t}</b><span class="ps-bact"><button type="button" class="lk-link" data-psdet aria-expanded="${det}">${det ? 'Hide picks' : 'Show picks'}</button><button type="button" class="lk-link" data-psclear>Clear</button></span></div>`;
  if (n < 2) return `<div class="ps-b">${hd('1 pick so far')}<p class="lk-small">Pick at least one more: an entry is 2 to 5 picks.</p>${det ? sel : ''}${msg}</div>`;
  const T = psPay(n), mm = S.reduce((a, x) => a * (+x.mult || 1), 1), pay = T * mm, pAll = S.reduce((a, x) => a * +x.p_side, 1), ev = pAll * pay - 1;
  const G = {}; S.forEach(x => { const g = `${x.sport}|${x.espn_id}`; (G[g] = G[g] || []).push(x); });
  const sg = Object.values(G).filter(g => g.length > 1), twice = sg.some(g => new Set(g.map(x => x.pid)).size < g.length);
  const warn = sg.length ? `<p class="ps-warn"><b>Same game:</b> ${sg.map(g => `${esc([...new Set(g.map(x => x.player))].join(' and '))} (${esc(g[0].game)})`).join('; ')}. Picks from one game tend to win or lose together${twice ? ', two picks on one player most of all' : ''}, so ${psP(pAll)} is only a rough guess.</p>` : '';
  const cls = ev >= 0 ? 'pos' : 'neg', all = n === 2 ? 'both' : `all ${n}`;
  const lab = (wide, short) => `<small><span class="ps-wide">${wide}</span><span class="ps-short">${short}</span></small>`;
  return `<div class="ps-b">${hd(`Your entry: ${n} picks`)}
    <div class="ps-bn"><span>${lab(`Chance ${all} hit`, n === 2 ? 'Both hit' : `All ${n} hit`)}<b class="num">${psP(pAll)}</b></span><span>${lab('Pays', 'Pays')}<b class="num">${psX(pay)}</b></span>
      <span>${lab('Average profit per $10', 'Per $10')}<b class="num ${cls}">${psMoney(10 * ev)}</b></span><span>${lab(`Per ${gpUSD(u)} (your unit)`, `Per ${gpUSD(u)}`)}<b class="num ${cls}">${psMoney(u * ev)}</b></span></div>
    ${warn}${msg}${det ? `${sel}<p class="lk-small">${S.map(x => psP(x.p_side)).join(' × ')} = ${psP(pAll)}, if the picks are independent. ${n} picks pay ${psX(T)}${mm !== 1 ? ` × ${psX(mm)} from the pick multipliers` : ''}, so breaking even needs ${psP(1 / pay)} for ${all} (${psP(Math.pow(1 / pay, 1 / n))} a pick).</p>` : ''}</div>`;
}
// under the builder, never sticky: what "moved last" means, the payout table used, and that none of this is staked
function psFootHTML() {
  const tbl = [2, 3, 4, 5].map(k => `${k} picks ${psPay(k)}x`).join(', ');
  return `<p class="lk-small ps-foot">Standard entry: every pick must hit. Payouts used: ${tbl}, the commonly cited Underdog table; Underdog’s own table couldn’t be checked, so confirm the payout its app shows before you submit. “Underdog moved last” means Underdog changed its line after DraftKings did, so DraftKings may be the stale one and the edge is weaker. Math only, no stake: these picks are tracked until the live record proves them.</p>`;
}

const PS_SHAPE = {nb: 'negative binomial', pois: 'Poisson', norm: 'normal'};
const psShape = (x, J) => { const f = (((J || {}).test || {}).families || {})[`${x.sport}|${x.stat}`] || {}; return PS_SHAPE[f.kind] || (/poisson/i.test(x.dist || '') ? 'Poisson' : 'fitted'); };
// "Show the numbers": the tests behind the prop shop and today's picks in full
function psNumbersHTML(J) {
  const T = (J.test || {}).by_sport || {}, BS = J.by_sport || {}, L = (GPT || {}).propshop_summary, gr = ((J.test || {}).grading || {}).cross_check || {};
  const rec = (lab, r) => r && r.n ? `<tr><td>${esc(lab)}</td><td class="r num">${r.wins}-${r.n - r.wins}</td><td class="r num">${psP(r.win_pct)}</td><td class="r num">${psP(r.avg_fair)}</td><td class="r num">${psRoi((r.roi || {}).minus_110)}</td><td class="r num">${psRoi((r.roi || {}).pickem_3pick_6x)}</td><td class="r num">${fx(r.t_minus_110, 2)}</td><td class="r num">${esc(r.weeks_up || '–')}</td></tr>` : '';
  const stale = PS_SP.flatMap(s => { const B = T[s] || {}, lg = PS_NAME[s] + (B.priced === false ? ' (line move only)' : '');
    return [rec(`${lg}: fair 55%+`, (B.stale_side || {})['fair_0.55+']), rec(`${lg}: walk-forward bar`, (B.walk_forward || {}).record), rec(`${lg}: own snapshots`, ((B.by_source || {}).own_pre_game_snapshot || {}).bar_55)]; }).filter(Boolean);
  const cells = PS_SP.map(s => psCell(s, 'prop_shop')).filter(Boolean).map(c => `<tr><td>${esc(PS_NAME[c.sport] || c.sport)}</td><td class="r num">${(+c.n).toLocaleString()}</td><td class="r num">${fx(c.locksmith, 4)} / ${fx(c.market, 4)}</td><td class="r num">${fx(c.t, 2)}</td><td class="r num">${c.ci95 && c.ci95[0] != null ? `${fx(c.ci95[0], 4)} to ${fx(c.ci95[1], 4)}` : '–'}</td><td class="r num">${esc(psOf(c))}</td><td>${c.r_agrees ? 'yes' : 'no'}</td><td>${c.verdict === 'better' ? '<b>better</b>' : esc(c.verdict)}</td></tr>`);
  const diff = [...PS_SP, 'cfb'].filter(s => BS[s]).map(s => { const B = BS[s]; return `<tr><td>${esc(PS_NAME[s])}</td><td class="r num">${(+B.underdog_lines || 0).toLocaleString()}</td><td class="r num">${(+B.matched_to_draftkings || 0).toLocaleString()}</td><td class="r num">${B.share_same_line != null ? psP(B.share_same_line) : '–'}</td><td class="r num">${B.ud_lower ?? '–'} / ${B.ud_higher ?? '–'}</td><td class="r num">${fx(B.abs_line_gap_avg, 2)}</td><td class="r num">${B.flags ?? 0}</td></tr>`; });
  const juice = PS_SP.map(s => { const r = ((T[s] || {}).same_line_juice || {}).bar_55; return r && r.n ? `<tr><td>${esc(PS_NAME[s])}</td><td class="r num">${r.n.toLocaleString()}</td><td class="r num">${psP(r.win_pct)}</td><td class="r num">${psP(r.avg_fair)}</td><td class="r num">${esc(r.weeks_up || '–')}</td></tr>` : ''; }).filter(Boolean);
  const fl = (J.flags || []).map(x => `<tr><td><b>${esc(x.player)}</b> <span class="muted">${esc(PS_NAME[x.sport] || x.sport)}</span></td><td>${esc(psPickTxt(x).toLowerCase())}</td><td class="r num">${x.ud_american != null ? gpAm(x.ud_american) : '–'}${x.ud_no_vig_side != null ? ` <span class="muted">${psP(x.ud_no_vig_side)}</span>` : ''}</td>
    <td class="r num">${x.dk_line} · ${gpAm(x.dk_over) || '–'} / ${gpAm(x.dk_under) || '–'}</td><td class="r num" title="Moved to Underdog’s line with a ${esc(psShape(x, J))} shape: ${esc(String(x.dist || '').replace(/\s*\([^)]*\)/g, ''))}">${psP(x.p_side)}</td><td class="r num">${x.edge_pts >= 0 ? '+' : '−'}${Math.abs(+x.edge_pts).toFixed(1)}</td>
    <td title="DraftKings changed ${esc(psClock(x.dk_updated))} · Underdog changed ${esc(psClock(x.ud_line_updated))}">${esc(({draftkings: 'DraftKings', underdog: 'Underdog', unknown: 'Not clear'})[x.changed_last] || x.changed_last || '–')}</td></tr>`);
  const pay = [2, 3, 4, 5].map(n => `<tr><td>${n} picks</td><td class="r num">${psPay(n)}x</td><td class="r num">${psP(psBE(n, 1))}</td></tr>`);
  const live = L && L.by_changed_last ? Object.entries(L.by_changed_last).map(([k, r]) => `<tr><td>${esc((PS_FRESH[k] || k).split(':')[0])}</td><td class="r num">${r.n}</td><td class="r num">${r.wins}-${r.losses}</td><td class="r num">${psP(r.hit_rate)}</td><td class="r num">${psP(r.breakeven)}</td></tr>`) : [];
  const h = t => `<h4 class="ps-h4">${t}</h4>`;
  const grTxt = Object.entries(gr).map(([s, g]) => `${PS_NAME[s] || s} ${psP(g.agree)} of ${(+g.compared || 0).toLocaleString()} lines`).join(', ');
  return gpRaw(
    h('The stale-line test: when DraftKings moved a line before the game, the side its newer price favoured at the old line')
    + table([{l: 'Test'}, {l: 'Won-lost', r: 1}, {l: 'Win %', r: 1}, {l: 'Fair', r: 1, t: 'Average fair chance of the picks'}, {l: 'At −110', r: 1, t: 'Return per bet at a −110 price'}, {l: 'In a 3-pick', r: 1, t: 'Return per pick inside a 3-pick 6x entry'}, {l: 't', r: 1}, {l: 'Weeks up', r: 1}], stale)
    + `<p class="note">Graded on ESPN box scores (they agree with Locksmith’s own graders on ${esc(grTxt || '–')}). Walk-forward: each week’s bar picked from earlier weeks only. Prop history exists for this season only, so weeks are the unit, not seasons. t is clustered by game.</p>`
    + h('Accuracy certificate (log loss, lower is better: DraftKings’ newer price at the old line / the old line’s own price)')
    + table([{l: 'Sport'}, {l: 'Lines', r: 1}, {l: 'Log loss', r: 1}, {l: 't', r: 1}, {l: '95% interval', r: 1}, {l: 'Better in', r: 1}, {l: 'R agrees'}, {l: 'Verdict'}], cells)
    + `<p class="note">What it proves: a stale DraftKings line can be priced from the newer one. It does not prove Underdog lags DraftKings; only the live record of these picks can show that.</p>`
    + h('How often Underdog’s line differs from DraftKings’ today')
    + table([{l: 'Sport'}, {l: 'Underdog lines', r: 1}, {l: 'Matched', r: 1}, {l: 'Same line', r: 1}, {l: 'Underdog lower / higher', r: 1}, {l: 'Average gap', r: 1}, {l: 'Flagged', r: 1}], diff)
    + h('Same line, DraftKings juiced: its favoured side at 55%+ (no-vig, last pre-game number)')
    + table([{l: 'Sport'}, {l: 'Lines', r: 1}, {l: 'Hit', r: 1}, {l: 'DraftKings said', r: 1}, {l: 'Weeks up', r: 1}], juice)
    + `<p class="note">That supports a standard 1x pick where DraftKings has juice and Underdog’s multiplier hasn’t moved.</p>`
    + h('Today’s picks in full')
    + table([{l: 'Player'}, {l: 'Pick'}, {l: 'Underdog price', r: 1}, {l: 'DraftKings', r: 1, t: 'DraftKings line, over / under price'}, {l: 'Fair', r: 1}, {l: 'Over the bar', r: 1, t: 'Points above the 3-pick break-even'}, {l: 'Moved last'}], fl)
    + `<p class="note">Underdog’s own listed price often disagrees with DraftKings (its no-vig chance is next to it). Moved last compares the last change times; ESPN’s DraftKings time is sometimes in the future, and then no one knows which is fresher.</p>`
    + `<div class="grid g2"><div>${h('Payouts and break-even per pick')}${table([{l: 'Entry'}, {l: 'Pays', r: 1}, {l: 'Each pick needs', r: 1}], pay)}<p class="note">${esc(((J.payouts || {}).source) || '')}</p></div>`
    + `<div>${h('Live record by which app moved last')}${live.length ? table([{l: 'When logged'}, {l: 'Picks', r: 1}, {l: 'Won-lost', r: 1}, {l: 'Hit', r: 1}, {l: 'Needed', r: 1}], live) : `<p class="note">${L ? esc(L.note || 'Nothing logged yet.') : 'Nothing logged yet: the tracker starts logging these picks (no stake) on its next run.'}</p>`}</div></div>`,
    'The tests behind the prop shop, and today’s picks in full. Past results, not live bets.');
}

function psGenTxt(J) {
  const g = J.generated || (J.capture || {}).pulled_at, t = g ? Date.parse(String(g).replace(' ', 'T')) : NaN;
  if (!isFinite(t)) return '';
  const h = (Date.now() - t) / 36e5, d = new Date(t);
  const at = d.toDateString() === new Date().toDateString() ? psClock(d) : `${d.toLocaleDateString([], {month: 'short', day: 'numeric'})}, ${psClock(d)}`;
  return `Lines as of ${at}${h >= 3 ? ` (${Math.round(h)} hours ago: lines move, so check both apps)` : ''}.`;
}
function psShopHTML(page) {
  const title = 'Prop shop: Underdog vs DraftKings', J = PSH;
  if (!J) return card(title, '', '<p class="note">Loading Underdog’s lines…</p>');
  if (J._missing) return card(title, '', `<p class="note">Couldn’t load the prop shop (reports/prop_shop.json: ${esc(J.err)}). The pipeline builds it with python -m locksmith.propshop.</p>`);
  const F = J.flags || [], live = F.filter(x => !psStarted(x)), cnt = s => live.filter(x => s === 'all' || x.sport === s).length;
  PSHOP.sel = psPicked().map(psKey);                            // drop picks that left the board or have started
  let v = PSHOP.view[page];
  if (v !== 'all' && !PS_SP.includes(v)) v = PS_SP.includes(page) && cnt(page) ? page : 'all';
  const shown = v === 'all' ? PS_SP : [v];
  const chips = `<div class="ps-chips" role="group" aria-label="Sport">${[...PS_SP, 'all'].map(s => `<button type="button" class="chip${v === s ? ' on' : ''}" data-psv="${s}" aria-pressed="${v === s}">${s === 'all' ? 'All' : PS_NAME[s]}<span class="n">${cnt(s)}</span></button>`).join('')}</div>`;
  const pass = shown.map(psTag).filter(t => t.on);
  const passNote = pass.length ? `<p class="lk-small ps-foot"><b>Passed the stale-line test</b> (${esc(pass.map(t => PS_NAME[t.c.sport]).join(', '))}): on ${esc(pass.map(t => `${(+t.c.n).toLocaleString()} past ${PS_NAME[t.c.sport]} line moves`).join(' and '))}, pricing DraftKings’ old line from its newer price beat the old line’s own price in ${esc(pass.map(t => psOf(t.c)).join(' and '))}, checked in R. That shows a stale line can be beaten, not yet that Underdog’s lines are the stale ones: the live record will.</p>` : '';
  const sub = `Underdog Fantasy pick’em lines where DraftKings’ price says the pick beats what a 3-pick entry needs. The big number is the fair chance: DraftKings’ chance with its cut removed, moved to Underdog’s line. No stake: every pick is logged and graded. Over is Higher, under is Lower on Underdog. ${psGenTxt(J)}`;
  return card(title, esc(sub), chips + shown.map(s => psGroupHTML(s, F.filter(x => x.sport === s))).join('') + passNote + psBuilderHTML() + psFootHTML() + psNumbersHTML(J), ' id="psCard"');
}
function psMount(sport) {
  const el = document.getElementById('pShop'); if (!el) return;
  el.dataset.sport = sport;
  const draw = () => {
    const e = document.getElementById('pShop'); if (!e || e.dataset.sport !== sport) return;
    const d = e.querySelector('details.gp-raw'), wasOpen = !!(d && d.open);
    e.innerHTML = psShopHTML(sport);
    if (wasOpen) { const d2 = e.querySelector('details.gp-raw'); if (d2) d2.open = true; }
  };
  el.onclick = ev => psClick(ev, sport, draw);
  draw();
  const wait = [];
  if (!PSH || PSH._missing) wait.push(psLoad());
  if (!GPT && typeof gpTrackLoad === 'function') wait.push(gpTrackLoad());
  if (!psCert() && typeof gpLoad === 'function') wait.push(gpLoad());
  if (wait.length) Promise.all(wait).then(draw, draw);
}
function psClick(ev, sport, draw) {
  const t = ev.target.closest('[data-psv],[data-psk],[data-psx],[data-psclear],[data-psdet]'); if (!t || t.disabled) return;
  const S = psSel(); let focus = null; PSHOP.msg = '';
  if (t.dataset.psv) { PSHOP.view[sport] = t.dataset.psv; focus = `[data-psv="${t.dataset.psv}"]`; }
  else if (t.hasAttribute('data-psdet')) { PSHOP.det = !(PSHOP.det == null ? !psNarrow() : PSHOP.det); focus = '[data-psdet]'; }
  else if (t.dataset.psx) PSHOP.sel = S.filter(k => k !== t.dataset.psx);
  else if (t.hasAttribute('data-psclear')) PSHOP.sel = [];
  else if (t.dataset.psk) {
    const k = t.dataset.psk; focus = `[data-psk="${k.replace(/"/g, '\\"')}"]`;
    if (S.includes(k)) PSHOP.sel = S.filter(x => x !== k);
    else if (psPicked().length >= PS_MAX) PSHOP.msg = `An entry holds ${PS_MAX} picks at most here (the payout table stops at ${PS_MAX}).`;
    else PSHOP.sel = S.concat(k);
  }
  psSave(); draw();
  if (focus) { try { const f = document.querySelector('#pShop ' + focus); if (f) f.focus({preventScroll: true}); } catch (e) {} }
}
// the NFL props page is app.js's props(): the same one-sentence note and the prop shop go on top of it. props() is a global
// function declaration in app.js (loaded after this file), so it is wrapped once every script has run.
function psNFLTop() {
  const v = document.getElementById('view'); if (!v || document.getElementById('pShop')) return;
  v.insertAdjacentHTML('afterbegin', `<div class="gp-line g-pass"><span class="gp-g">No bet</span><b class="gp-lab">No NFL player prop is a bet this week</b></div><div class="gp-sub">${esc(psWhyNoStake('nfl', null))}</div><div id="pShop" class="ps-wrap"></div>`);
  psMount('nfl');
}
function psWrapNFL() {
  const f = window.props;
  if (typeof f !== 'function' || f.__ps) return;
  const w = function () { const r = f.apply(this, arguments); try { psNFLTop(); } catch (e) { console.error('prop shop', e); } return r; };
  w.__ps = true; window.props = w;
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', psWrapNFL); else setTimeout(psWrapNFL, 0);
