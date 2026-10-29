// Locksmith desktop UI. Data: Python API (pywebview) or reports/app_data.json when served for testing.
let SPORT = (() => { try { return location.hash.includes('nhl') ? 'nhl' : location.hash.includes('wnba') ? 'wnba' : location.hash.includes('nba') ? 'nba' : location.hash.includes('ufc') ? 'ufc' : location.hash.includes('cfb') ? 'cfb' : location.hash.includes('all') ? 'all' : (localStorage.getItem('lk-sport') || 'nfl'); } catch (e) { return 'nfl'; } })();
let D = null, VIEW = 'slate', WEEK = null, GAME = null, GTAB = 'brief', PSORT = {k: 'fp', dir: -1}, POLL = null, FTAB = 'matchup';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const ok = x => x != null && x !== '' && !Number.isNaN(+x);
const pct = (x, d = 0) => ok(x) ? (100 * x).toFixed(d) + '%' : '–';
const sgn = (x, d = 1) => ok(x) ? (x > 0 ? '+' : '') + Number(x).toFixed(d) : '–';
const fx = (x, d = 1) => ok(x) ? Number(x).toFixed(d) : '–';
const ml = x => ok(x) ? (x > 0 ? '+' : '') + Math.round(x) : '–';
const sp = x => ok(x) ? (Math.abs(x) < 0.25 ? 'pick’em' : sgn(x, 1)) : '–';
const api = () => window.pywebview && window.pywebview.api;
// Locksmith's predicted final (whole points, never a tie) — the same score the watched simulation ends on
const PF = s => (s && s.final_pred) || (s && s.mean_score ? [Math.round(s.mean_score[0]), Math.round(s.mean_score[1])] : [0, 0]);
const tap = (window.matchMedia && matchMedia('(pointer:coarse)').matches) ? 'tap' : 'click', TAP = tap[0].toUpperCase() + tap.slice(1);
const TITLES = {today: 'Today’s best bets', slate: 'Picks', game: 'Game center', live: 'Live betting', players: 'Player stats', props: 'Player props', watch: 'Watch', fantasy: 'Fantasy', plays: 'Best bets', record: 'Track record', market: 'Market', model: 'Model accuracy', research: 'Research', update: 'Update'};

// ---------------------------------------------------------------- theme
const SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON = '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
function paintTheme() { const t = document.documentElement.dataset.theme; $('#theme').innerHTML = (t === 'dark' ? SUN + 'Light mode' : MOON + 'Dark mode'); }
$('#theme').onclick = () => { const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = t; try { localStorage.setItem('lk-theme', t); } catch (e) {} paintTheme(); };
paintTheme();

// ---------------------------------------------------------------- data
async function load() {
  try { D = api() ? await api().get_data() : await (await fetch('../../reports/app_data.json', {cache: 'no-store'})).json(); }
  catch (e) { D = {error: String(e)}; }
  if (!D || D.error) { $('#view').innerHTML = `<div class="card empty">${esc(D && D.error || 'No data')}</div>`; $('#gen').textContent = 'No data'; return; }
  $('#gen').textContent = 'Updated ' + D.generated;
  const ws = [...new Set(D.books.map(b => b.week))].sort((a, b) => a - b);
  if (WEEK == null || !ws.includes(WEEK)) WEEK = ws[0];
  $('#weeks').innerHTML = ws.map(w => `<button class="chip${w === WEEK ? ' on' : ''}" data-w="${w}">Week ${w}</button>`).join('');
  $('#eyebrow').textContent = `NFL ${D.books[0].game_id.slice(0, 4)} season`;
  const qs = new URLSearchParams(location.search);            // ?game=<id>&zoom=<gsis>|<rec|rush|pass> (direct links / testing)
  if (qs.get('game') && D.books.find(b => b.game_id === qs.get('game'))) { GAME = qs.get('game'); WEEK = D.books.find(b => b.game_id === GAME).week; if (qs.get('zoom')) BZ.add(GAME + '|' + qs.get('zoom')); }
  if (!GAME || !D.books.find(b => b.game_id === GAME)) GAME = D.books.find(b => b.week === WEEK)?.game_id;
  render();
}
const books = () => D.books.filter(b => b.week === WEEK);
// ---------------------------------------------------------------- phone / tablet navigation (bottom tab bar + "More" sheet), built from the sidebar
const SHORT = {today: 'Today', slate: 'Picks', game: 'Games', live: 'Live', props: 'Props'};
(function mobileNav() {
  const btns = [...document.querySelectorAll('#nav button[data-view]')];
  const icon = b => b.querySelector('svg').outerHTML;
  const MORE = '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/></svg>';
  $('#mnav').innerHTML = btns.filter(b => SHORT[b.dataset.view]).map(b => `<button data-view="${b.dataset.view}">${icon(b)}<span>${SHORT[b.dataset.view]}</span></button>`).join('')
    + `<button id="mmore" aria-haspopup="dialog">${MORE}<span>More</span></button>`;
  $('#mlist').innerHTML = btns.filter(b => !SHORT[b.dataset.view]).map(b => `<button data-view="${b.dataset.view}">${icon(b)}<span>${b.textContent.trim()}</span></button>`).join('');
  const sheet = $('#msheet'), open = v => { sheet.hidden = !v; document.body.classList.toggle('sheet-open', v); };
  $('#mmore').onclick = () => { $('#mtheme').innerHTML = $('#theme').innerHTML; $('#mgen').textContent = $('#gen').textContent; open(sheet.hidden); };
  sheet.addEventListener('click', e => { if (e.target.closest('[data-close],[data-view]')) open(false); });
  $('#mtheme').onclick = () => { $('#theme').click(); $('#mtheme').innerHTML = $('#theme').innerHTML; };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') open(false); });
})();
function markNav() {
  document.querySelectorAll('#nav button[data-view], #mnav button[data-view], #mlist button[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === VIEW));
  const mm = $('#mmore'); if (mm) mm.classList.toggle('on', !SHORT[VIEW]);
}
function go(view, gid) { if (VIEW === 'live' && view !== 'live' && typeof liveStop === 'function') liveStop(); if (VIEW === 'watch' && view !== 'watch' && typeof stopPlay === 'function') { stopPlay(); W.token++; } if (VIEW === 'watch' && view !== 'watch' && typeof hStop === 'function') hStop(); if (VIEW === 'watch' && view !== 'watch' && typeof bStop === 'function') bStop(); VIEW = view; if (gid) GAME = gid; markNav(); render(); $('#view').scrollTop = 0; window.scrollTo(0, 0); }
const NHL_VIEWS = ['slate', 'game', 'live', 'watch', 'props', 'players', 'record', 'model', 'research'];
function markSport() {
  document.body.classList.toggle('sport-nhl', SPORT === 'nhl'); document.body.classList.toggle('sport-nba', SPORT === 'nba' || SPORT === 'wnba'); document.body.classList.toggle('sport-ufc', SPORT === 'ufc'); document.body.classList.toggle('sport-cfb', SPORT === 'cfb'); document.body.classList.toggle('sport-alt', SPORT !== 'nfl');
  document.querySelectorAll('[data-sport]').forEach(b => b.classList.toggle('on', b.dataset.sport === SPORT));
  const bs = $('#brandsub'); if (bs) bs.textContent = ({nhl: 'NHL', nba: 'NBA', ufc: 'UFC', cfb: 'College football', all: 'All sports', wnba: 'WNBA'}[SPORT] || 'NFL') + ' prediction engine';
  document.querySelectorAll('#nav button[data-view="slate"], #mnav button[data-view="slate"]').forEach(b => { const s = b.querySelector('span'); if (s) s.textContent = 'Picks'; });
}
let LASTSPORT = 'nfl';
function setSport(s) {
  if (s === SPORT) return; if (typeof stopPlay === 'function') { stopPlay(); W.token++; } if (typeof hStop === 'function') hStop(); if (typeof bStop === 'function') bStop();
  if (SPORT !== 'all') LASTSPORT = SPORT;
  SPORT = s; try { localStorage.setItem('lk-sport', s); } catch (e) {}
  if (s === 'all') VIEW = 'slate';                                 // All has one page: the bets to take
  if (s !== 'nfl' && !NHL_VIEWS.includes(VIEW)) VIEW = 'slate';
  if (s === 'ufc' && !UFC_VIEWS.includes(VIEW)) VIEW = 'slate';
  if (s === 'cfb' && !CFB_VIEWS.includes(VIEW)) VIEW = 'slate';
  markSport(); markNav(); render(); $('#view').scrollTop = 0;
}
document.addEventListener('click', e => { const b = e.target.closest('[data-sport]'); if (b) setSport(b.dataset.sport); });
function render() {
  markSport();
  if (VIEW === 'live' && SPORT === 'all') SPORT = LASTSPORT;
  if (VIEW === 'live') { markNav(); liveRender(); return; }
  if (VIEW === 'today') VIEW = 'slate';                             // the all-sports summary is retired: each sport's Picks page leads with its best bets
  if (SPORT === 'all') {                                            // any other section from All goes to the last sport viewed
    if (VIEW === 'slate') { markNav(); allRender(); return; }
    SPORT = LASTSPORT; markSport();
  }
  const best = () => { if (VIEW === 'slate' && typeof bestBets === 'function') bestBets(SPORT); };
  if (SPORT === 'nhl') { Promise.resolve(nhlRender()).then(best); return; }
  if (SPORT === 'nba' || SPORT === 'wnba') { Promise.resolve(nbaRender()).then(best); return; }
  if (SPORT === 'ufc') { Promise.resolve(ufcRender()).then(best); return; }
  if (SPORT === 'cfb') { Promise.resolve(cfbRender()).then(best); return; }
  if (!D || D.error) return;
  if (!document.querySelector('#weeks [data-w]')) {                 // coming back from hockey: restore the NFL week chips
    const ws = [...new Set(D.books.map(b => b.week))].sort((a, z) => a - z);
    $('#weeks').innerHTML = ws.map(w => `<button class="chip${w === WEEK ? ' on' : ''}" data-w="${w}">Week ${w}</button>`).join('');
    $('#eyebrow').textContent = `NFL ${D.books[0].game_id.slice(0, 4)} season`;
  }
  $('#title').textContent = TITLES[VIEW]; markNav();
  $('#weeks').style.display = ['slate', 'game', 'players', 'props', 'watch', 'market'].includes(VIEW) ? '' : 'none';
  ({slate: picks, game, players, props, watch, fantasy, plays, record, market, model, research, update})[VIEW]();
  if (VIEW === 'slate' && typeof bestBets === 'function') bestBets('nfl');
}

// ---------------------------------------------------------------- shared pieces
function table(cols, rows, opts = {}) {
  return `<div class="tbl"${opts.h ? ` style="max-height:${opts.h}px"` : ''}><table><thead><tr>${cols.map(c => `<th class="${c.r ? 'r' : ''}${c.sort ? ' sort' : ''}"${c.sort ? ` data-sort="${c.sort}"` : ''}${c.t ? ` title="${esc(c.t)}"` : ''}>${c.l}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${cols.length}" class="muted">Nothing to show yet.</td></tr>`}</tbody></table></div>`;
}
const GLOSS = {
  spread: ['Spread', 'How many points the favorite has to win by. “DAL −4.5” means Dallas must win by 5 or more for a bet on Dallas to win.'],
  total: ['Total (over/under)', 'The combined points both teams score. Bet over if you think the game scores more than the number, under if less.'],
  moneyline: ['Moneyline', 'A bet on who wins, no points involved. −200 means bet $200 to win $100; +170 means bet $100 to win $170.'],
  edge: ['Edge', 'How much better Locksmith’s chance is than the price you are paid. +3% means you win about 3% more often than the odds assume. Below about 2.5% it isn’t worth betting.'],
  stars: ['Stars', 'How strong the bet is, from 1 to 5. Based on the edge and how well that kind of bet held up in testing. Player props get 2 stars at most.'],
  chance: ['Chance to win', 'How often this bet won in Locksmith’s simulations of the game, after an honest adjustment for overconfidence.'],
  units: ['Units', 'Profit counted in bets. +48 units means you would be up 48 times your normal bet size.'],
  roi: ['Return (ROI)', 'Profit divided by everything you bet. +9% means every $100 bet returned $109 on average.'],
  closing: ['Closing line', 'The sportsbook’s final number right before kickoff. It is the sharpest price there is, so beating it is the real test of a model.'],
  clv: ['Beating the close (CLV)', 'Points you gained by betting before the line moved. Positive means you got a better number than the closing line.'],
  fair: ['Fair line', 'What the line should be if Locksmith is right. The gap between the fair line and the sportsbook’s line is where value comes from.'],
  prop: ['Player prop', 'A bet on one player’s stat, like “Gibbs over 72.5 rushing yards”.'],
  juice: ['−115 / the price', 'What the bet costs. At −115 you risk $115 to win $100, so you need to win 53.5% just to break even.'],
  epa: ['EPA', 'Expected points added: how much a play changed the offense’s expected score. +0.10 per play is clearly good; −0.10 is clearly bad.'],
  miss: ['Average miss', 'How far the prediction was from what really happened, on average. Smaller is better.'],
  push: ['Push', 'A tie with the line, like a 3-point win on a −3 spread. Your money comes back.'],
  stake: ['Stake', 'How much of your betting bankroll to put on it. Locksmith uses a cautious quarter-Kelly size so a losing streak can’t wipe you out.'],
  logloss: ['Log loss', 'A score for how good probability predictions are. Lower is better. It punishes being confidently wrong.'],
  range80: ['80% range', 'Eight times out of ten the real result should land inside this range.'],
  puckline: ['Puck line', 'Hockey’s spread. Almost always 1.5 goals: the favorite −1.5 must win by 2 or more.'],
  xg: ['Expected goals (xG)', 'How many goals a team’s shots were worth based on where and how they were taken. It predicts future scoring better than actual goals do.'],
  gsax: ['Goals saved above expected', 'How many goals a goalie stopped beyond what an average goalie would have, given the quality of shots faced.'],
};
const gl = (k, label) => `<button type="button" class="gl" data-gl="${k}">${label || (GLOSS[k] ? GLOSS[k][0].toLowerCase() : k)}</button>`;
function showGloss(k, at) {
  const g = GLOSS[k]; if (!g) return; let p = $('#glpop');
  if (!p) { p = document.createElement('div'); p.id = 'glpop'; p.className = 'glpop'; p.setAttribute('role', 'dialog'); document.body.appendChild(p); }
  p.innerHTML = `<b>${g[0]}</b><p>${g[1]}</p><button type="button" class="btn" data-glclose>Got it</button>`; p.hidden = false;
  if (window.innerWidth > 760 && at) { const r = at.getBoundingClientRect(); p.style.left = Math.min(window.innerWidth - 340, Math.max(12, r.left)) + 'px'; p.style.top = Math.min(window.innerHeight - 180, r.bottom + 8) + 'px'; p.classList.remove('sheet'); }
  else { p.style.left = ''; p.style.top = ''; p.classList.add('sheet'); }
}
document.addEventListener('click', e => { const b = e.target.closest('[data-gl]'); if (b) { e.stopPropagation(); showGloss(b.dataset.gl, b); return; }
  const p = $('#glpop'); if (p && !p.hidden && (e.target.closest('[data-glclose]') || !e.target.closest('#glpop'))) p.hidden = true; }, true);
// scannable answer: label on the left, the answer big, a short note under it
const answer = rows => `<div class="ans">${rows.filter(Boolean).map(r => `<div class="ans-r${r.cls ? ' ' + r.cls : ''}"><span class="ans-l">${r.l}</span><span class="ans-v"><b>${r.v}</b>${r.s ? `<small>${r.s}</small>` : ''}</span></div>`).join('')}</div>`;
const card = (title, sub, body, extra = '') => `<div class="card"${extra}><div class="card-h"><div><h3>${title}</h3>${sub ? `<p class="sub">${sub}</p>` : ''}</div></div>${body}</div>`;
const tile = (big, label, cls = '') => `<div class="tile ${cls}"><b class="num">${big}</b><span>${label}</span></div>`;
function winbar(pHome, H, A, sport) { const a = 1 - pHome, [ca, ch] = tpair(A, H, sport); return `<div><div class="winbar"><span style="width:${100 * a}%;background:${ca}"></span><span style="width:${100 * pHome}%;background:${ch}"></span></div><div class="winlab"><span>${A} ${pct(a)}</span><span>${H} ${pct(pHome)}</span></div></div>`; }
function signals(b) { return (b.market && b.market.signals) || []; }
const SIGNAME = {sharp_money: 'Sharp money', reverse_line_move: 'Reverse line move', liability_hold: 'Book liability', steam: 'Steam move', juice_skew: 'Juice lean'};
function sigBadge(s) { const c = {sharp_money: 'info', reverse_line_move: 'warn', liability_hold: 'bad', steam: 'info', juice_skew: ''}[s.kind] || ''; return `<span class="badge ${c}" title="${esc(s.text)}">${SIGNAME[s.kind] || s.kind}: ${esc(s.side)}</span>`; }
function bestEdge(b) {
  const nb = b.number_board, pr = b.pricing;
  const c = [[`${b.home} ${sp(-nb.market_spread_home)}`, pr.home_cover_edge, pr.home_cover], [`${b.away} ${sp(nb.market_spread_home)}`, pr.away_cover_edge, pr.away_cover],
             [`Over ${nb.market_total}`, pr.over_edge, pr.over], [`Under ${nb.market_total}`, pr.under_edge, pr.under],
             [`${b.home} moneyline ${ml(nb.market_ml[0])}`, pr.ml_home_edge, pr.ml_home_p], [`${b.away} moneyline ${ml(nb.market_ml[1])}`, pr.ml_away_edge, pr.ml_away_p]].filter(x => ok(x[1]));
  return c.sort((a, z) => z[1] - a[1])[0];
}
function answerRows(b) {
  const s = b.score, nb = b.number_board, H = b.home, A = b.away;
  const homeWins = s.p_home_win >= 0.5, Wn = homeWins ? H : A;
  const wp = homeWins ? s.p_home_win : s.p_away_win, f = PF(s), sc = homeWins ? `${f[0]}–${f[1]}` : `${f[1]}–${f[0]}`;
  const fav = nb.market_spread_home >= 0 ? H : A, mline = Math.abs(nb.market_spread_home);
  const ffav = nb.locksmith_margin >= 0 ? H : A, fline = Math.abs(nb.locksmith_margin);
  const be = bestEdge(b), tl = nb.locksmith_total - nb.market_total, bet = be && be[1] >= 0.025;
  const tp = b.brief && b.brief.the_pick;
  return answer([
    {l: 'Who wins', v: `${esc(nmTeam(Wn))} ${sc}`, s: `${pct(wp)} chance to win`},
    {l: gl('spread', 'Spread'), v: `Locksmith: ${ffav} −${fx(fline)}`, s: `sportsbook: ${fav} −${fx(mline)} · ${Math.abs(nb.locksmith_margin - nb.market_spread_home) < 1 ? 'about the same' : `${fx(Math.abs(nb.locksmith_margin - nb.market_spread_home))} pts apart`}`},
    {l: gl('total', 'Total points'), v: `Locksmith: ${fx(nb.locksmith_total)}`, s: `sportsbook: ${nb.market_total} · ${Math.abs(tl) < 1 ? 'right on the number' : tl > 0 ? `${fx(tl)} pts higher` : `${fx(-tl)} pts lower`}`},
    {l: 'The bet', v: tp && tp.bet !== 'Pass' ? esc(tp.bet) + ' ' + starHTML(tp.stars) : bet ? esc(be[0]) : 'No bet', s: tp && tp.bet !== 'Pass' ? `${pct(tp.win_chance)} chance to win` : bet ? `${pct(be[2])} to win · ${gl('edge')} ${sgn(100 * be[1])}%` : `no ${gl('edge')} big enough at today’s prices`, cls: (tp && tp.bet !== 'Pass') || bet ? 'go' : 'pass'},
  ]);
}
function verdict(b) {
  const s = b.score, nb = b.number_board, H = b.home, A = b.away;
  const homeWins = s.p_home_win >= 0.5, W = homeWins ? H : A, Lz = homeWins ? A : H;
  const wp = homeWins ? s.p_home_win : s.p_away_win;
  const sc = homeWins ? `${PF(s)[0]}–${PF(s)[1]}` : `${PF(s)[1]}–${PF(s)[0]}`;
  const fav = nb.market_spread_home >= 0 ? H : A, mline = Math.abs(nb.market_spread_home);
  const ffav = nb.locksmith_margin >= 0 ? H : A, fline = Math.abs(nb.locksmith_margin);
  const be = bestEdge(b), tl = nb.locksmith_total - nb.market_total;
  let t = `Locksmith projects <b>${W} to beat ${Lz} ${sc}</b> (${pct(wp)} to win). The market has ${fav} −${fx(mline)}; Locksmith’s fair line is ${ffav} −${fx(fline)}. `;
  t += `The total is ${nb.market_total} and the model sits at ${fx(nb.locksmith_total)}, ${Math.abs(tl) < 1 ? 'right on the number' : (tl > 0 ? `${fx(tl)} points higher` : `${fx(-tl)} points lower`)}. `;
  t += be && be[1] >= 0.025 ? `Best value: <b>${esc(be[0])}</b> (${pct(be[2])} to win, ${sgn(100 * be[1])}% edge vs the posted price).` : 'No bet clears the value bar at the posted prices.';
  return {html: t, cls: be && be[1] >= 0.025 ? '' : 'blue'};
}
function distSVG(b, W = 640, H = 150) {
  const pmf = b.score.margin_pmf, pad = 22, lo = -28, hi = 28, xs = v => pad + (v - lo) / (hi - lo) * (W - 2 * pad);
  let mx = 0; for (const k in pmf) mx = Math.max(mx, pmf[k]);
  const y = v => H - 24 - (v / mx) * (H - 44);
  let bars = '';
  for (let v = lo; v <= hi; v++) { const p = pmf[v] || 0; if (!p) continue; const key = [3, 7, 10, 14].includes(Math.abs(v));
    bars += `<rect x="${(xs(v) - 4).toFixed(1)}" y="${y(p).toFixed(1)}" width="8" rx="1.5" height="${(H - 24 - y(p)).toFixed(1)}" fill="${v > 0 ? 'var(--accent)' : 'var(--blue)'}" opacity="${key ? 1 : .55}"><title>${v > 0 ? b.home + ' by ' + v : v < 0 ? b.away + ' by ' + (-v) : 'tie'}: ${pct(p, 1)}</title></rect>`; }
  const L = b.number_board.market_spread_home, xL = xs(L);
  const ticks = [-21, -14, -7, 0, 7, 14, 21].map(v => `<text x="${xs(v)}" y="${H - 6}" font-size="11" text-anchor="middle" fill="var(--muted)" font-family="var(--mono)">${v === 0 ? 'tie' : (v > 0 ? b.home + ' +' + v : b.away + ' +' + (-v))}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Final margin distribution"><line x1="${pad}" x2="${W - pad}" y1="${H - 24}" y2="${H - 24}" stroke="var(--rule)"/>${bars}
    <line x1="${xL}" x2="${xL}" y1="16" y2="${H - 24}" stroke="var(--amber)" stroke-width="2" stroke-dasharray="4 3"/><text x="${Math.min(Math.max(xL, 80), W - 80)}" y="12" font-size="12" text-anchor="middle" fill="var(--amber)" font-weight="600">market line</text>${ticks}</svg>`;
}

// ---------------------------------------------------------------- THIS WEEK
function myFantasyTile() {
  const F = D.fantasy; if (!F || !F.my_team || !F.my_team.matchup) return '';
  const me = F.my_team.matchup.teams.find(t => t.roster_id === F.my_roster_id); if (!me) return '';
  return tile(pct(me.win_prob), `${esc(F.my_team.team)} fantasy win chance`, me.win_prob >= 0.5 ? 'good' : 'bad');
}
function slate() {
  const B = books(), m = D.backtest.margin, L = (D.ledger && D.ledger.paper) || {};
  const nPlays = D.plays.filter(p => p.tier !== 'watch').length;
  const head = `<div class="tiles">${tile(B.length, `games in week ${WEEK}`)}${tile(nPlays, 'bets that clear the value bar')}${tile(fx(m.MAE_stack, 2) + ' pts', 'average miss on the final margin (market ' + fx(m.MAE_market, 2) + ')')}
    ${L.games ? tile(pct(L.games.winner_hit_pct), 'winners picked, 2024–26 replay') : ''}${myFantasyTile()}</div>`;
  const cards = B.map(b => {
    const s = b.score, nb = b.number_board, sg = signals(b), be = bestEdge(b), hw = s.p_home_win >= 0.5;
    return `<div class="card click" data-game="${b.game_id}">
      <div class="card-h"><span class="eyebrow">${esc(b.gameday)} · ${esc(b.kick_et)} ET</span><span class="eyebrow">${esc(b.roof)}${b.forecast && ok(b.forecast.wind_mph) && b.forecast.source !== 'indoor' ? ` · ${Math.round(b.forecast.wind_mph)} mph wind` : ''}</span></div>
      ${matchupHero({sport: 'nfl', compact: true, away: b.away, home: b.home, awaySub: esc(b.away_qb), homeSub: esc(b.home_qb), score: PF(s), pHome: s.p_home_win})}
      <div class="kv"><div><span>Most likely score</span><b>${b.away} ${s.modal_score[1]}, ${b.home} ${s.modal_score[0]}</b></div><div><span>Fair spread</span><b>${b.home} ${sp(-nb.locksmith_margin)}</b><span>market ${sp(-nb.market_spread_home)}</span></div><div><span>Fair total</span><b>${fx(nb.locksmith_total)}</b><span>market ${nb.market_total}</span></div></div>
      <div class="badges">${be && be[1] >= 0.025 ? `<span class="badge solid">Value: ${esc(be[0])} ${sgn(100 * be[1])}%</span>` : '<span class="badge">No value bet</span>'}${sg.slice(0, 3).map(sigBadge).join('')}</div></div>`;
  }).join('');
  $('#view').innerHTML = head + `<div class="grid g3">${cards}</div>`;
  document.querySelectorAll('[data-game]').forEach(el => el.onclick = () => { GTAB = 'brief'; go('game', el.dataset.game); });
}


// ---------------------------------------------------------------- PICKS (the bottom line)
const starHTML = n => n ? `<span class="stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>` : '';
const TEAMNAME = {ARI: 'Arizona', ATL: 'Atlanta', BAL: 'Baltimore', BUF: 'Buffalo', CAR: 'Carolina', CHI: 'Chicago', CIN: 'Cincinnati', CLE: 'Cleveland', DAL: 'Dallas', DEN: 'Denver', DET: 'Detroit', GB: 'Green Bay', HOU: 'Houston', IND: 'Indianapolis', JAX: 'Jacksonville', KC: 'Kansas City', LA: 'LA Rams', LAC: 'LA Chargers', LV: 'Las Vegas', MIA: 'Miami', MIN: 'Minnesota', NE: 'New England', NO: 'New Orleans', NYG: 'NY Giants', NYJ: 'NY Jets', PHI: 'Philadelphia', PIT: 'Pittsburgh', SEA: 'Seattle', SF: 'San Francisco', TB: 'Tampa Bay', TEN: 'Tennessee', WAS: 'Washington'};
const nmTeam = t => TEAMNAME[t] || t;
const vsTxt = o => o ? (String(o).startsWith('@') ? ' at ' + String(o).slice(1) : ' vs ' + o) : '';
function guideCard() {
  let off = false; try { off = localStorage.getItem('lk-guide') === 'off'; } catch (e) {}
  if (off) return '';
  return `<div class="guide card" id="guide"><div class="card-h"><h3>How to read Locksmith</h3><button class="btn" id="guideX" aria-label="Hide this guide">Got it</button></div>
    <ol><li><b>Picks</b> are the bets worth making this week. ★ = how strong, % = how often it wins.</li>
    <li><b>Games</b> shows every matchup: who wins, the predicted score, and why.</li>
    <li><b>Watch</b> plays the most likely version of any game, every snap, ending on the predicted score.</li>
    <li>Tap any <span class="gl demo">dotted word</span> for a plain-English meaning.</li></ol></div>`;
}
function picks() {
  const B = books().filter(b => b.brief);
  const bets = B.filter(b => b.brief.the_pick.bet !== 'Pass').sort((a, z) => (z.brief.the_pick.stars - a.brief.the_pick.stars) || ((z.brief.the_pick.edge || 0) - (a.brief.the_pick.edge || 0)));
  const pp = propPlays(WEEK);
  const F = D.fantasy, fd = F && F.my_team && F.my_team.detail;
  const betRow = b => { const tp = b.brief.the_pick; return ticket({sport: 'nfl', away: b.away, home: b.home, when: `${b.gameday.slice(5)} · ${b.kick_et} ET`, bet: tp.bet, chance: tp.win_chance, stars: tp.stars, note: tp.why ? esc(tp.why) : '', attrs: `data-game="${b.game_id}"`}); };
  const propRow = p => propTicket({sport: 'nfl', pid: p.espn_id, player: p.player, team: p.team, game: p.game, bet: `${p.side} ${p.line} ${(PMK[p.market] || '').toLowerCase()}`, price: '−115', chance: p.prob, attrs: 'data-props="1"'});
  const gameRow = b => { const br = b.brief; return `<tr class="click" data-game="${b.game_id}"><td>${b.away} at ${b.home} <span class="muted">${esc(b.gameday.slice(5))}</span></td><td><b>${br.winner} ${br.score[0]}–${br.score[1]}</b></td><td class="r num">${pct(br.win_prob)}</td><td>${br.the_pick.bet === 'Pass' ? '<span class="muted">No bet</span>' : `<b>${esc(br.the_pick.bet)}</b>`}</td></tr>`; };
  $('#view').innerHTML = guideCard() +
    `<div class="verdict big1">${bets.length ? `<b>${bets.length} game bet${bets.length > 1 ? 's' : ''}</b>${pp.length ? ` and <b>${pp.length} player props</b>` : ''} this week. Best bet: <b>${esc(bets[0].brief.the_pick.bet)}</b> (${bets[0].away} at ${bets[0].home}).` : 'No game bets this week yet.'}</div>`
    + (bets.length ? card('Game bets', `${TAP} one to see why. ${gl('stars', 'Stars')} = how strong. % = ${gl('chance', 'chance it wins')}.`, `<div class="tickets">${bets.map(betRow).join('')}</div>`) : '')
    + (pp.length ? card('Player props', `${gl('prop', 'Player bets')} with a smaller edge than game bets. Assumes ${gl('juice', '−115')}, so check your price.`, `<div class="tickets">${pp.slice(0, 6).map(propRow).join('')}</div>`) : '')
    + (fd ? `<div class="card click" id="tofan"><div class="card-h"><div><span class="eyebrow">Fantasy</span><h3>${esc(F.my_team.team)}: ${pct(fd.win_prob_best)} to win this week</h3><p class="sub">Projected ${fx(fd.my_mean, 0)} to ${fx(fd.opp_mean, 0)}${F.my_team.swaps && F.my_team.swaps.length ? ` · <b>${F.my_team.swaps.length} lineup change${F.my_team.swaps.length > 1 ? 's' : ''} to make</b>` : ''}</p></div></div></div>` : '')
    + card('Every game', 'Predicted winner, score and chance to win.', table([{l: 'Game'}, {l: 'Prediction'}, {l: 'Win chance', r: 1}, {l: 'Bet'}], B.map(gameRow)));
  document.querySelectorAll('[data-game]').forEach(el => el.onclick = () => { GTAB = 'brief'; go('game', el.dataset.game); });
  document.querySelectorAll('[data-props]').forEach(el => el.onclick = () => go('props'));
  const tf = $('#tofan'); if (tf) tf.onclick = () => go('fantasy');
  const gx = $('#guideX'); if (gx) gx.onclick = () => { try { localStorage.setItem('lk-guide', 'off'); } catch (e) {} $('#guide').remove(); };
}
function briefTab(b) {
  const br = b.brief;
  if (!br) return card('Research brief', '', '<p class="note">Not built yet. Run Update.</p>');
  const tp = br.the_pick;
  const pick = `<div class="pickbox ${tp.bet === 'Pass' ? 'pass' : ''}"><div><span class="eyebrow">The pick</span><div class="pickbet">${tp.bet === 'Pass' ? 'No bet' : esc(tp.bet)}</div>${starHTML(tp.stars)}</div>
    <div>${esc(tp.why)}${tp.bet !== 'Pass' ? `<br><span class="muted">Wins ${pct(tp.win_chance)} of the time in the simulations · suggested stake ${fx(100 * tp.stake_pct, 1)}% of your bankroll${tp.best_book ? ' · best price ' + esc(tp.best_book) : ''}</span>` : ''}</div></div>`;
  const f = br.factors.map(x => `<div class="factor"><h4>${esc(x.title)}</h4><p>${esc(x.text)}</p><div class="ptag">${x.pts ? `<b style="color:${x.favors === b.home ? 'var(--accent)' : 'var(--blue)'}">+${fx(x.pts)} pts</b>for ${esc(nmTeam(x.favors))}` : '<span class="muted">context</span>'}</div></div>`).join('');
  return card('The answer', '', `<div class="bigscore">${esc(nmTeam(br.winner))} ${br.score[0]}, ${esc(nmTeam(br.loser))} ${br.score[1]} <span class="conf ${br.confidence}" style="vertical-align:middle">${br.confidence} · ${pct(br.win_prob)}</span></div>${pick}<div class="verdict blue">${esc(br.bottom_line)}</div>`)
    + card('The research', 'Every factor the models weigh, in plain English. Point values show how much each one moves the predicted margin, and toward which team.', f)
    + (() => { const gp = propPlays().filter(p => p.game_id === b.game_id); return gp.length ? card('Player props in this game', 'Props that clear the bar (chances assume −115; props get 2 stars at most).', `<div class="grid g2">${gp.map(p => propCard(p)).join('')}</div>`) : ''; })();
}


// ---------------------------------------------------------------- PLAYER PROPS
const PMK = {pass_yds: 'Passing yards', completions: 'Completions', pass_att: 'Pass attempts', pass_td: 'Passing TDs', ints: 'Interceptions', rush_yds: 'Rushing yards', carries: 'Carries',
  rec_yds: 'Receiving yards', receptions: 'Receptions', rush_rec_yds: 'Rush + rec yards', pass_rush_yds: 'Pass + rush yards', anytime_td: 'Anytime TD'};
const propPlays = (wk) => ((D.props && D.props.plays) || []).filter(p => wk == null || p.week === wk);
function propCard(p, compact = false) {
  return `<div class="card propcard"><div class="card-h"><span class="eyebrow">${esc(p.game)} · ${esc(PMK[p.market] || p.market)}</span>${starHTML(p.stars)}</div>
    <div class="pickbet" style="font-size:${compact ? 22 : 25}px">${esc(p.player)} ${esc(p.side.toLowerCase())} ${p.line}</div>
    <div class="muted" style="margin:2px 0 8px">${esc((PMK[p.market] || p.market).toLowerCase())} · wins ${pct(p.prob)} · fair price ${ml(p.fair_odds)}</div>
    ${compact ? '' : `<p class="note" style="color:var(--ink2)">${esc(p.why)}</p>`}</div>`;
}
function propRecordLine() {
  const L = D.ledger || {}, pa = L.paper && L.paper.props_all, li = L.live && L.live.props_all;
  const r = x => `${x.wins}-${x.losses}${x.pushes ? '-' + x.pushes : ''} (${sgn(x.units_flat)} units)`;
  return [li ? `Live: ${r(li)}` : null, pa ? `Replay of weeks ${(D.props_backtest && D.props_backtest.weeks || []).join(', ')}: ${r(pa)}` : null].filter(Boolean).join(' · ');
}
function props() {
  const P = D.props;
  if (!P || !P.props || !P.props.length) { $('#view').innerHTML = card('Player props', '', '<p class="note">No prop lines yet. DraftKings posts most player props on Wednesday or Thursday. Run Update after that.</p>'); return; }
  const BT = D.props_backtest || {}, wk = WEEK;
  const picks = propPlays(wk);
  const rush = (BT.over_rate_by_group || []).find(g => g.grp === 'rush');
  const tierAll = (BT.tiers_lowo || []).find(t => t.tier === 'all picks');
  const rec = propRecordLine();
  const head = `<div class="verdict">${picks.length ? `Locksmith likes <b>${picks.length} player prop${picks.length > 1 ? 's' : ''}</b> in week ${wk}. The best is <b>${esc(picks[0].player)} ${esc(picks[0].side.toLowerCase())} ${picks[0].line} ${esc((PMK[picks[0].market] || '').toLowerCase())}</b>.` : `No player prop in week ${wk} clears the bar yet.`}
    Props are a smaller edge than game bets: the most any prop gets is 2 stars.</div>
    <div class="verdict amber"><b>Before you bet:</b> the free line feed shows DraftKings’ numbers but not the price, so every chance here assumes −115. If your book charges −130 or worse on a prop, skip it. Bet props early in the week: DraftKings lines moved toward Locksmith’s side ${pct(BT.moves_toward_model)} of the time, so waiting usually costs you the number.</div>`;
  const tiles = `<div class="tiles">${tile(P.n_lines, 'real DraftKings prop lines priced')}${tile(picks.length, 'props worth betting')}${tierAll ? tile(pct(tierAll.win, 1), `picks won in testing (${tierAll.n} bets, need 53.5%)`, tierAll.win >= 0.535 ? 'good' : 'bad') : ''}${rush ? tile(pct(1 - rush.over_rate), 'rushing unders hit this season', 'good') : ''}</div>`;
  const grid = picks.length ? `<h2>The props</h2><div class="grid g3">${picks.map(p => propCard(p)).join('')}</div>` : '';
  // every line, with filters
  const f = window.__prf || {q: '', game: '', mk: '', lean: ''};
  const rows = P.props.filter(r => r.week === wk && r.p_over != null && r.market !== 'anytime_td');
  const games = [...new Set(rows.map(r => r.game))].sort();
  let R = rows.filter(r => (!f.q || (r.player || '').toLowerCase().includes(f.q.toLowerCase())) && (!f.game || r.game === f.game) && (!f.mk || r.market === f.mk) && (!f.lean || (r.edge || 0) >= 0));
  R.sort((a, z) => (z.edge || -1) - (a.edge || -1));
  const ctl = `<div class="row-flex"><input id="rq" class="search" placeholder="Search for a player…" value="${esc(f.q)}"><select id="rg" class="search"><option value="">All games</option>${games.map(g => `<option ${g === f.game ? 'selected' : ''}>${esc(g)}</option>`).join('')}</select>
    <select id="rm" class="search"><option value="">All prop types</option>${Object.keys(PMK).filter(k => k !== 'anytime_td').map(k => `<option value="${k}" ${k === f.mk ? 'selected' : ''}>${PMK[k]}</option>`).join('')}</select>
    <label class="muted"><input type="checkbox" id="rl" ${f.lean ? 'checked' : ''}> only lines with an edge</label><span class="muted">${R.length} lines</span></div>`;
  const body = R.slice(0, 400).map(r => { const e = r.edge || 0;
    return `<tr><td><b>${esc(r.player)}</b> <span class="muted">${esc(r.pos || '')}${r.team ? ' · ' + r.team : ''}</span></td><td class="muted">${esc(r.game)}</td><td>${esc(PMK[r.market] || r.market)}</td>
      <td class="r num"><b>${r.line}</b>${r.open_line != null && r.open_line !== r.line ? ` <span class="muted">(opened ${r.open_line})</span>` : ''}</td><td class="r num">${fx(r.proj_median, r.line < 10 ? 1 : 0)} <span class="muted">${fx(r.p10, 0)}–${fx(r.p90, 0)}</span></td>
      <td class="r num">${pct(r.p_over)}</td><td>${e >= 0.02 ? `<b>${esc(r.pick_side)}</b>` : `<span class="muted">${esc(r.pick_side)} (no edge)</span>`}</td><td class="r num ${e >= 0.02 ? 'pos' : 'muted'}">${sgn(100 * e)}%</td><td>${r.stars ? starHTML(r.stars) : ''}</td></tr>`; });
  const allLines = card('Every prop line this week', 'DraftKings’ current line, Locksmith’s projection for the player (most likely value and 80% range), and the honest chance the over hits after adjusting for how sharp prop lines are. Edge is measured against a −115 price.',
    ctl + table([{l: 'Player'}, {l: 'Game'}, {l: 'Prop'}, {l: 'Line', r: 1}, {l: 'Locksmith', r: 1}, {l: 'Over hits', r: 1}, {l: 'Lean'}, {l: 'Edge', r: 1}, {l: ''}], body, {h: 640}));
  const how = `<details class="more"><summary>How props are priced and tested</summary>${card('How it works', '', `<p class="note" style="color:var(--ink2)">Every player in every game is simulated 60,000 times inside the full game simulation. That covers game script, injuries, the defense, the player’s share of targets and carries, and their efficiency. Each DraftKings line is compared with those outcomes.<br><br>
      Those raw simulation odds were then tested against ${BT.n_graded || '–'} real DraftKings lines from ${BT.season || ''} weeks ${(BT.weeks || []).join(', ')}, graded on the real box scores. The raw odds were far too confident. Their log-loss was ${fx(BT.logloss_raw, 3)}, worse than a coin flip at ${fx(BT.logloss_coinflip, 3)}. They did point the right way, though: the stronger the raw edge, the more often the pick won.
      So every chance shown here goes through a fitted adjustment that keeps only the part of the signal that held up, checked one week at a time on weeks it had not seen. After the adjustment, picks with at least a 2% edge won ${tierAll ? pct(tierAll.win, 1) : '–'} of ${tierAll ? tierAll.n : '–'} bets.
      ${rec ? '<br><br><b>Track record:</b> ' + esc(rec) + '.' : ''}</p>`)}
    ${card('Testing details', '', table([{l: 'Group'}, {l: 'Bets', r: 1}, {l: 'Won', r: 1}, {l: 'Return at −115', r: 1}], (BT.tiers_lowo || []).map(t => `<tr><td>${esc(t.tier)}</td><td class="r num">${t.n}</td><td class="r num">${pct(t.win, 1)}</td><td class="r num ${t['roi_at_-115'] >= 0 ? 'pos' : 'neg'}">${sgn(100 * t['roi_at_-115'])}%</td></tr>`))
      + table([{l: 'Prop group'}, {l: 'Lines', r: 1}, {l: 'Over hit', r: 1}], (BT.over_rate_by_group || []).map(g => `<tr><td>${({rush: 'Rushing (yards, carries, rush+rec)', pass: 'Passing', rec: 'Receiving'})[g.grp] || g.grp}</td><td class="r num">${g.n}</td><td class="r num">${pct(g.over_rate, 1)}</td></tr>`)))}</details>`;
  const short = p => { const r = (P.props || []).find(x => x.gsis === p.gsis && x.market === p.market && x.line === p.line); return r && ok(r.proj_median) ? `Locksmith projects ${fx(r.proj_median, r.line < 10 ? 1 : 0)} vs a line of ${p.line}` : ''; };
  const list = picks.length ? card(`${picks.length} props worth betting`, 'Bet these early in the week. % = chance it wins. Skip any priced −130 or worse.', `<div class="tickets">${picks.map(p => propTicket({sport: 'nfl', pid: p.espn_id, player: p.player, team: p.team, game: p.game, bet: `${p.side} ${p.line} ${(PMK[p.market] || '').toLowerCase()}`, price: '−115', chance: p.prob, note: esc(short(p))})).join('')}</div>`) : card('No props this week', '', '<p class="note">Nothing clears the bar yet.</p>');
  $('#view').innerHTML = list + `<details class="more"${f.q || f.game || f.mk || f.lean ? ' open' : ''}><summary>See every prop line (${P.n_lines})</summary>${allLines}</details>` + how;
  const upd = () => { window.__prf = {q: $('#rq').value, game: $('#rg').value, mk: $('#rm').value, lean: $('#rl').checked ? 1 : ''}; props(); };
  $('#rq').oninput = () => { clearTimeout(window.__rt); window.__rt = setTimeout(upd, 220); }; $('#rg').onchange = upd; $('#rm').onchange = upd; $('#rl').onchange = upd;
  const rq = $('#rq'); if (f.q) { rq.focus(); rq.setSelectionRange(rq.value.length, rq.value.length); }
}


// ---------------------------------------------------------------- BOX SCORE
const BZ = new Set();                      // expanded (zoomed) player rows
const STATNAME = {completions: 'Completions', pass_att: 'Pass attempts', pass_yds: 'Passing yards', pass_td: 'Passing TDs', ints: 'Interceptions', carries: 'Carries', rush_yds: 'Rushing yards',
  rush_td: 'Rushing TDs', targets: 'Targets', receptions: 'Receptions', rec_yds: 'Receiving yards', rec_td: 'Receiving TDs'};
const PROPKEY = {pass_yds: 'pass_yds', completions: 'completions', pass_att: 'pass_att', pass_td: 'pass_td', ints: 'ints', rush_yds: 'rush_yds', carries: 'carries', rec_yds: 'rec_yds', receptions: 'receptions'};
const n1 = x => ok(x) ? (Math.abs(x) >= 10 ? Math.round(x) : Number(x).toFixed(1)) : '–';
const n0 = x => ok(x) ? Math.round(x) : '–';
const mmss = m => { const t = Math.round(m * 60); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
function rbar(st, lo, hi) {
  const sc = v => Math.max(0, Math.min(100, (v - lo) / ((hi - lo) || 1) * 100));
  return `<div class="rbar"><span class="w" style="left:${sc(st.p10)}%;width:${sc(st.p90) - sc(st.p10)}%"></span><span class="b" style="left:${sc(st.p25)}%;width:${Math.max(1, sc(st.p75) - sc(st.p25))}%"></span><span class="m" style="left:${sc(st.med)}%"></span></div>`;
}
function zoomPanel(p, b) {
  const keys = Object.keys(p.stats).filter(k => !/_td$|^ints$/.test(k) && ((p.stats[k].v || 0) >= 0.8 || p.pos === 'QB' && ['pass_yds', 'pass_att', 'completions'].includes(k)));
  const props = ((D.props && D.props.props) || []).filter(r => r.gsis === p.id && r.game_id === b.game_id && r.market !== 'anytime_td');
  const picks = ((D.props && D.props.plays) || []).filter(r => r.gsis === p.id && r.game_id === b.game_id);
  const rows = keys.map(k => { const st = p.stats[k], hi = Math.max(st.p90 * 1.08, 1), pr = props.find(r => r.market === PROPKEY[k]);
    return `<tr><td>${STATNAME[k] || k}</td><td class="r num"><b>${n1(st.v)}</b></td><td style="width:40%">${rbar(st, 0, hi)}</td><td class="r num muted">${n1(st.p10)}–${n1(st.p90)}</td>
      <td class="r num">${pr ? `${pr.line} <span class="muted">(over ${pct(pr.p_over)})</span>` : '<span class="muted">–</span>'}</td></tr>`; });
  const td = p.anytime_td && ok(p.anytime_td.p) ? p.anytime_td.p : (ok(p.anytime_td) ? p.anytime_td : null);
  const ss = p.season || {};
  const season = p.pos === 'QB' ? `${ss.cmp ?? 0}/${ss.att ?? 0}, ${ss.pass_yds ?? 0} yds, ${ss.pass_td ?? 0} TD, ${ss.ints ?? 0} INT · ${ss.car ?? 0} carries, ${ss.rush_yds ?? 0} yds`
    : `${ss.car ?? 0} carries, ${ss.rush_yds ?? 0} yds, ${ss.rush_td ?? 0} TD · ${ss.rec ?? 0} catches on ${ss.tgt ?? 0} targets, ${ss.rec_yds ?? 0} yds, ${ss.rec_td ?? 0} TD`;
  return `<tr class="zoom"><td colspan="9"><div class="zbox">
    <div class="zhead"><b>${esc(p.name)}</b> <span class="muted">${p.pos}${p.status && p.status !== 'Active' ? ' · ' + esc(p.status) : ''}</span>${td != null ? ` <span class="badge info">TD chance ${pct(td)}</span>` : ''}${picks.map(x => ` <span class="badge good">Prop pick: ${esc(x.side.toLowerCase())} ${x.line} ${starHTML(x.stars)}</span>`).join('')}</div>
    ${table([{l: 'Stat'}, {l: 'Projected', r: 1}, {l: 'Range of outcomes'}, {l: '80% range', r: 1}, {l: 'DraftKings line', r: 1}], rows)}
    <p class="note">Bar: light = 80% of simulated games, dark = middle 50%, line = most likely. Season so far (${ss.games ?? 0} games): ${season}.</p></div></td></tr>`;
}
function boxTab(b) {
  const X = b.box; if (!X) return card('Box score', '', '<p class="note">Box score not built yet. Run Update all.</p>');
  const H = b.home, A = b.away, TH = X.teams[H], TA = X.teams[A], L = X.line;
  const sum = a => a.reduce((x, y) => x + y, 0);
  const lineScore = `<div class="tbl"><table class="linescore"><thead><tr><th></th><th class="r">1</th><th class="r">2</th><th class="r">3</th><th class="r">4</th><th class="r">T</th></tr></thead><tbody>
    <tr><td><b>${A}</b> <span class="muted">${esc(b.away_qb)}</span></td>${L.away.map(v => `<td class="r num">${fx(v)}</td>`).join('')}<td class="r num tot">${fx(TA.points)}</td></tr>
    <tr><td><b>${H}</b> <span class="muted">${esc(b.home_qb)}</span></td>${L.home.map(v => `<td class="r num">${fx(v)}</td>`).join('')}<td class="r num tot">${fx(TH.points)}</td></tr></tbody></table></div>
    <p class="note">Average points per quarter over every simulated game (overtime ${pct(X.p_ot, 1)}).</p>
    <div class="ends"><div><span class="eyebrow">Win chance</span><div class="wc"><b>${A}</b> ${pct(1 - b.score.p_home_win)} · <b>${H}</b> ${pct(b.score.p_home_win)}</div></div>
    <div><span class="eyebrow">Most likely final scores</span>${table([{l: 'Final'}, {l: 'Chance', r: 1}], (b.score.top_scores || []).slice(0, 6).map(x => `<tr><td>${A} ${x[1]}, ${H} ${x[0]}</td><td class="r num">${pct(x[2], 1)}</td></tr>`))}</div></div>`;
  const rng = (T, k) => T.range && T.range[k] ? ` <span class="muted">(${n0(T.range[k][0])}–${n0(T.range[k][2])})</span>` : '';
  const ts = [['First downs', T => n1(T.first_downs)], ['Total yards', T => n0(T.total_yds)], ['Plays', T => n0(T.plays)], ['Yards per play', T => fx(T.ypp)],
    ['Passing', T => `${n1(T.pass.cmp)}/${n1(T.pass.att)}, ${n0(T.net_pass_yds)} yds`], ['Yards per pass', T => fx(T.pass.ypa)],
    ['Pass attempts', T => n1(T.pass.att) + rng(T, 'att')], ['Passing yards (gross)', T => n0(T.pass.yds) + rng(T, 'pass_yds')],
    ['Sacks – yards lost', T => `${fx(T.sacks)} – ${n0(T.sack_yds)}`], ['Rushing', T => `${n1(T.rush.car)} for ${n0(T.rush.yds)} yds`], ['Yards per rush', T => fx(T.rush.ypc)],
    ['Rushing yards', T => n0(T.rush.yds) + rng(T, 'rush_yds')], ['Touchdowns', T => fx(T.td)], ['Field goals', T => fx(T.fg)], ['Turnovers', T => `${fx(T.turnovers)} <span class="muted">(${fx(T.pass.int)} INT, ${fx(T.fumbles_lost)} fum)</span>`],
    ['Drives', T => n1(T.drives)], ['Possession', T => mmss(T.top_min)], ['Defense: sacks / INT', T => `${fx(T.def.sacks)} / ${fx(T.def.int)}`]];
  const teamStats = `<div class="tbl"><table class="tstats"><thead><tr><th></th><th class="r">${A}</th><th class="r">${H}</th></tr></thead><tbody>${ts.map(([l, f]) => `<tr><td>${l}</td><td class="r num">${f(TA)}</td><td class="r num">${f(TH)}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">First downs, possession and sacks come from relationships fitted on ${X.fit && X.fit.n_team_games ? X.fit.n_team_games.toLocaleString() : ''} real team-games; everything else is simulated directly. Ranges in brackets are 80% of outcomes.</p>`;
  const rowsFor = (T, kind) => {
    const P = (T.players || []).filter(p => kind === 'pass' ? p.pos === 'QB' : kind === 'rush' ? (p.stats.carries && p.stats.carries.v >= 0.3) : (p.stats.targets && p.stats.targets.v >= 0.3));
    P.sort((a, z) => kind === 'rec' ? z.stats.rec_yds.v - a.stats.rec_yds.v : kind === 'rush' ? z.stats.rush_yds.v - a.stats.rush_yds.v : 0);
    return P.map(p => { const S = p.stats, key = `${b.game_id}|${p.id}|${kind}`, open = BZ.has(key);
      const st = p.status && p.status !== 'Active' ? ` <span class="badge warn">${esc(p.status)}</span>` : '';
      const name = `<td class="pl"><span class="caret">${open ? '▾' : '▸'}</span><b>${esc(p.name)}</b> <span class="muted">${p.pos}</span>${st}</td>`;
      let cells;
      if (kind === 'pass') cells = `<td class="r num">${n1(S.completions.v)}/${n1(S.pass_att.v)}</td><td class="r num"><b>${n0(S.pass_yds.v)}</b></td><td class="r num">${fx(S.pass_yds.v / Math.max(S.pass_att.v, 1))}</td><td class="r num">${fx(S.pass_td.v)}</td><td class="r num">${fx(S.ints.v)}</td>`;
      else if (kind === 'rush') cells = `<td class="r num">${n1(S.carries.v)}</td><td class="r num"><b>${n0(S.rush_yds.v)}</b></td><td class="r num">${fx(S.rush_yds.v / Math.max(S.carries.v, 0.1))}</td><td class="r num">${fx(S.rush_td.v)}</td><td></td>`;
      else cells = `<td class="r num">${n1(S.receptions.v)}</td><td class="r num"><b>${n0(S.rec_yds.v)}</b></td><td class="r num">${fx(S.rec_yds.v / Math.max(S.receptions.v, 0.1))}</td><td class="r num">${fx(S.rec_td.v)}</td><td class="r num">${n1(S.targets.v)}</td>`;
      return `<tr class="prow2" data-bz="${key}">${name}${cells}</tr>` + (open ? zoomPanel(p, b) : ''); }).join('');
  };
  const sec = (T, team) => `<div class="card"><div class="card-h"><div><span class="eyebrow">${team === H ? 'Home' : 'Away'}</span><h3>${esc(nmTeam(team))}</h3></div><span class="big" style="font-size:34px">${fx(T.points)}</span></div>
    <div class="tbl"><table class="pbox">
      <thead><tr><th>Passing</th><th class="r">C/ATT</th><th class="r">YDS</th><th class="r">AVG</th><th class="r">TD</th><th class="r">INT</th></tr></thead><tbody>${rowsFor(T, 'pass')}</tbody>
      <thead><tr><th>Rushing</th><th class="r">CAR</th><th class="r">YDS</th><th class="r">AVG</th><th class="r">TD</th><th></th></tr></thead><tbody>${rowsFor(T, 'rush')}</tbody>
      <thead><tr><th>Receiving</th><th class="r">REC</th><th class="r">YDS</th><th class="r">AVG</th><th class="r">TD</th><th class="r">TGT</th></tr></thead><tbody>${rowsFor(T, 'rec')}</tbody>
    </table></div></div>`;
  return `<div class="boxtop">${card('Line score', '', lineScore)}${card('Team stats', '', teamStats)}</div>
    <p class="note" style="margin:6px 2px 12px">Projected box score: the average of every simulated game. ${TAP} any player to zoom into their full range of outcomes, their DraftKings lines and their season so far. Player lines add up to the team totals.</p>
    ${sec(TA, A)}${sec(TH, H)}`;
}

// ---------------------------------------------------------------- GAME CENTER
function game() {
  const b = D.books.find(x => x.game_id === GAME) || books()[0]; if (!b) return; GAME = b.game_id;
  const s = b.score, nb = b.number_board, pr = b.pricing, H = b.home, A = b.away, v = verdict(b), hw = s.p_home_win >= 0.5;
  const pick = gameChips(books(), GAME, 'data-g', 'nfl');
  const head = `<div class="card"><div class="card-h"><span class="eyebrow">Week ${b.week} · ${esc(b.gameday)} · ${esc(b.kick_et)} ET · ${esc(b.roof)} · ${b.forecast && ok(b.forecast.temp_f) && b.forecast.source !== 'indoor' ? `${Math.round(b.forecast.temp_f)}°F, wind ${Math.round(b.forecast.wind_mph)} mph` : 'indoors'} · referee ${esc(b.referee)}</span></div>
    ${matchupHero({sport: 'nfl', away: A, home: H, awaySub: `${esc(b.away_qb)} · coach ${esc(b.away_coach)}`, homeSub: `${esc(b.home_qb)} · coach ${esc(b.home_coach)}`, score: PF(s), avg: s.mean_score, pHome: s.p_home_win})}${answerRows(b)}<div><button class="btn primary" id="gWatch">&#9654; Watch this game, every play</button></div></div>`;
  const tabs = [['brief', 'The pick'], ['box', 'Box score'], ['matchup', 'Matchup'], ['players', 'Players'], ['summary', 'Odds'], ['market', 'Betting market'], ['markets', 'Alt lines'], ['why', 'What drives it']];
  let body = '';
  if (GTAB === 'box') {
    body = boxTab(b);
  } else if (GTAB === 'matchup') {
    body = matchupTab(b);
  } else if (GTAB === 'brief') {
    body = briefTab(b);
  } else if (GTAB === 'summary') {
    const tt = s.team_totals, q = s.quarters_mean;
    body = `<div class="grid g2">${card('How the final margin could land', 'Each bar is one possible final margin from tens of thousands of simulated games. Solid bars are the key numbers 3, 7, 10 and 14.', distSVG(b) + `<div class="legend"><span><i style="background:var(--accent)"></i>${H} wins</span><span><i style="background:var(--blue)"></i>${A} wins</span><span><i style="background:var(--amber)"></i>market line</span></div>`)}
      ${card('Projected final score', 'Averages, likely ranges and the most likely exact scores.', table([{l: ''}, {l: H, r: 1}, {l: A, r: 1}], [
        `<tr><td>Predicted final</td><td class="r num"><b>${PF(s)[0]}</b></td><td class="r num"><b>${PF(s)[1]}</b></td></tr>`,
        `<tr><td>Average points</td><td class="r num"><b>${fx(s.mean_score[0])}</b></td><td class="r num"><b>${fx(s.mean_score[1])}</b></td></tr>`,
        `<tr><td>Middle 50% of outcomes</td><td class="r num">${s.home_pts_pct['25']}–${s.home_pts_pct['75']}</td><td class="r num">${s.away_pts_pct['25']}–${s.away_pts_pct['75']}</td></tr>`,
        `<tr><td>80% of outcomes</td><td class="r num">${s.home_pts_pct['10']}–${s.home_pts_pct['90']}</td><td class="r num">${s.away_pts_pct['10']}–${s.away_pts_pct['90']}</td></tr>`,
        `<tr><td>Touchdowns / field goals</td><td class="r num">${fx(tt[H].exp_tds)}/${fx(tt[H].exp_fgs)}</td><td class="r num">${fx(tt[A].exp_tds)}/${fx(tt[A].exp_fgs)}</td></tr>`,
        `<tr><td>Per quarter (Q1/Q2/Q3/Q4)</td><td class="r num">${['Q1', 'Q2', 'Q3', 'Q4'].map(k => fx(q[k][0], 0)).join('/')}</td><td class="r num">${['Q1', 'Q2', 'Q3', 'Q4'].map(k => fx(q[k][1], 0)).join('/')}</td></tr>`,
        `<tr><td>Scores 30 or more</td><td class="r num">${pct(tt[H].p_30_plus)}</td><td class="r num">${pct(tt[A].p_30_plus)}</td></tr>`]) +
        `<p class="note">Most likely exact scores (${H}–${A}): ${s.top_scores.slice(0, 8).map(x => `${x[0]}–${x[1]} (${pct(x[2], 1)})`).join(', ')}. Overtime chance ${pct(s.p_ot, 1)}.</p>`)}
      ${card('What every model says', 'Expected home margin and total from each independent source.', table([{l: 'Source'}, {l: H + ' margin', r: 1}, {l: 'Total', r: 1}], [
        ['Posted market', `${sgn(nb.market_spread_home)}`, `${nb.market_total}`], ['<b>Locksmith (final)</b>', `<b>${sgn(nb.locksmith_margin)}</b>`, `<b>${fx(nb.locksmith_total)}</b>`],
        ['Football stats only (no betting data)', sgn(nb.fundamentals_margin), fx(nb.fundamentals_total)], ['Early-week model', sgn(nb.open_time_margin), fx(nb.open_time_total)],
        ['Kalman ratings (R)', sgn(nb.kalman_margin), '–'], ['Elo with QB adjustment', sgn(nb.elo_margin), '–'], ['Ratings from past betting lines', sgn(nb.market_rating_margin), fx(nb.market_rating_total)],
        ['Drive-by-drive model', sgn(nb.drive_model_margin), fx(nb.drive_model_total)]].map(r => `<tr><td>${r[0]}</td><td class="r num">${r[1]}</td><td class="r num">${r[2]}</td></tr>`)))}
      ${card('Bets priced against the sportsbook', 'Win chance from the simulations versus the break-even of the posted odds. A positive edge means value.', table([{l: 'Bet'}, {l: 'Win chance', r: 1}, {l: 'Edge', r: 1}, {l: 'Suggested stake', r: 1, t: 'Quarter-Kelly, as % of bankroll'}], [
        [`${H} ${sp(-nb.market_spread_home)} (${ml(nb.spread_prices[0])})`, pr.home_cover, pr.home_cover_edge, pr.home_cover_kelly], [`${A} ${sp(nb.market_spread_home)} (${ml(nb.spread_prices[1])})`, pr.away_cover, pr.away_cover_edge, pr.away_cover_kelly],
        [`Over ${nb.market_total} (${ml(nb.total_prices[0])})`, pr.over, pr.over_edge, pr.over_kelly], [`Under ${nb.market_total} (${ml(nb.total_prices[1])})`, pr.under, pr.under_edge, pr.under_kelly],
        [`${H} moneyline ${ml(nb.market_ml[0])}`, pr.ml_home_p, pr.ml_home_edge, pr.ml_home_kelly], [`${A} moneyline ${ml(nb.market_ml[1])}`, pr.ml_away_p, pr.ml_away_edge, pr.ml_away_kelly]]
        .map(r => `<tr><td>${esc(r[0])}</td><td class="r num">${pct(r[1], 1)}</td><td class="r num ${r[2] > 0 ? 'pos' : 'neg'}">${ok(r[2]) ? sgn(100 * r[2]) + '%' : '–'}</td><td class="r num">${r[3] > 0 ? fx(100 * r[3], 2) + '%' : '–'}</td></tr>`)) +
        `<p class="note">Push chance: spread ${pct(s.p_push_spread, 1)}, total ${pct(s.p_push_total, 1)}. Fair moneyline ${H} ${ml(s.fair_ml_home)} / ${A} ${ml(s.fair_ml_away)}.</p>`)}</div>`;
  } else if (GTAB === 'players') {
    const P = b.players || {};
    body = [A, H].map(team => {
      const d = P[team]; if (!d || !d.qb) return card(team, '', `<p class="note">${esc(P.error || 'No player data.')}</p>`);
      const q = d.qb, qp = q.proj, qs = q.season || {};
      const qline = `<div class="kv" style="grid-template-columns:repeat(5,1fr)"><div><span>Quarterback</span><b>${esc(q.name)}</b></div><div><span>Passing yards (fair line)</span><b class="num">${fx(qp.pass_yds.mean, 0)} (${qp.pass_yds.fair_line})</b></div>
        <div><span>Completions / attempts</span><b class="num">${fx(qp.completions.mean)} / ${fx(qp.pass_att.mean)}</b></div><div><span>TD / INT</span><b class="num">${fx(qp.pass_td.mean, 2)} / ${fx(qp.ints.mean, 2)}</b></div><div><span>300+ yards</span><b class="num">${pct(qp.p_300_pass)}</b></div></div>
        <p class="note">Season so far: ${qs.cmp ?? 0}/${qs.att ?? 0}, ${qs.pass_yds ?? 0} yards, ${qs.pass_td ?? 0} TD, ${qs.ints ?? 0} INT (${fx(qs.ypa, 1)} yards per attempt) in ${qs.games ?? 0} games. 80% range this week: ${fx(qp.pass_yds.p10, 0)}–${fx(qp.pass_yds.p90, 0)} yards.</p>`;
      const rows = d.players.map(p => { const j = p.proj, z = p.season || {};
        return `<tr><td><b>${esc(p.name)}</b> <span class="muted">${p.pos}</span>${p.p_play < 0.99 ? `<br><span class="amb">${esc(p.status)} · plays ${pct(p.p_play)}${j.if_active ? ` · if active ${fx(j.if_active.rec_yds + j.if_active.rush_yds, 0)} yds` : ''}</span>` : ''}</td>
          <td class="r num">${fx(j.targets.mean)}</td><td class="r num">${fx(j.receptions.mean)} <span class="muted">(${j.receptions.fair_line})</span></td><td class="r num"><b>${fx(j.rec_yds.mean)}</b> <span class="muted">(${j.rec_yds.fair_line})</span></td>
          <td class="r num">${fx(j.carries.mean)}</td><td class="r num"><b>${fx(j.rush_yds.mean)}</b> <span class="muted">(${j.rush_yds.fair_line})</span></td><td class="r num">${pct(j.anytime_td)}</td>
          <td class="r num muted">${z.games ?? 0} g · ${z.rec ?? 0} rec ${z.rec_yds ?? 0} yds · ${z.car ?? 0} car ${z.rush_yds ?? 0} yds · ${(z.rec_td ?? 0) + (z.rush_td ?? 0)} TD</td></tr>`; });
      return card(`${team} offense`, `Team projection: ${fx(d.team.pass_att, 0)} passes and ${fx(d.team.carries, 0)} runs for ${fx(d.team.pass_yds, 0)} passing and ${fx(d.team.rush_yds, 0)} rushing yards.`,
        qline + table([{l: 'Player'}, {l: 'Targets', r: 1}, {l: 'Catches (line)', r: 1}, {l: 'Rec yds (line)', r: 1}, {l: 'Carries', r: 1}, {l: 'Rush yds (line)', r: 1}, {l: 'TD chance', r: 1}, {l: 'Season so far', r: 1}], rows));
    }).join('') + `<p class="note">Numbers in brackets are fair over/under lines (the median). Players listed Questionable sit in the measured share of simulations and their work goes to teammates.</p>`;
  } else if (GTAB === 'market') {
    body = marketCard(b);
  } else if (GTAB === 'markets') {
    const alt = Object.entries(s.alt_spreads).map(([k, v]) => [+k, v]).sort((a, z) => a[0] - z[0]);
    const altT = Object.entries(s.alt_totals).map(([k, v]) => [+k, v]).sort((a, z) => a[0] - z[0]);
    body = `<div class="grid g2">${card(`Alternate spreads (${H})`, 'Fair odds for every half point, priced from the simulations including key numbers.', table([{l: 'Line'}, {l: 'Covers', r: 1}, {l: 'Push', r: 1}, {l: 'Fair ' + H, r: 1}, {l: 'Fair ' + A, r: 1}], alt.map(x => `<tr><td>${H} ${sp(-x[0])}</td><td class="r num">${pct(x[1].p_home_cover, 1)}</td><td class="r num">${pct(x[1].push, 1)}</td><td class="r num">${ml(x[1].fair_home)}</td><td class="r num">${ml(x[1].fair_away)}</td></tr>`), {h: 460}))}
      ${card('Alternate totals', '', table([{l: 'Total'}, {l: 'Over', r: 1}, {l: 'Fair over', r: 1}, {l: 'Fair under', r: 1}], altT.map(x => `<tr><td>${x[0]}</td><td class="r num">${pct(x[1].p_over, 1)}</td><td class="r num">${ml(x[1].fair_over)}</td><td class="r num">${ml(x[1].fair_under)}</td></tr>`), {h: 460}))}
      ${card('Team totals, halves and margins', '', table([{l: 'Market'}, {l: 'Locksmith', r: 1}], [
        `<tr><td>${H} team total over ${s.team_totals[H].line}</td><td class="r num">${pct(s.team_totals[H].p_over)} (${ml(s.team_totals[H].fair_over)})</td></tr>`, `<tr><td>${A} team total over ${s.team_totals[A].line}</td><td class="r num">${pct(s.team_totals[A].p_over)} (${ml(s.team_totals[A].fair_over)})</td></tr>`,
        `<tr><td>First-half fair spread / total</td><td class="r num">${H} ${sp(-s.first_half.fair_spread_home)} / ${s.first_half.fair_total}</td></tr>`, `<tr><td>Leading at half: ${H} / tied / ${A}</td><td class="r num">${pct(s.first_half.p_home_lead)} / ${pct(s.first_half.p_tied)} / ${pct(s.first_half.p_away_lead)}</td></tr>`,
        ...Object.entries(s.winning_margin).map(([k, v]) => `<tr><td>Winning margin: ${esc(k)}</td><td class="r num">${pct(v, 1)}</td></tr>`)], {h: 460}))}
      ${card('Parlays and teasers', 'Side and total are correlated; a standard two-team parlay pays +264.', (s.sgp ? table([{l: 'Combo'}, {l: 'Chance', r: 1}, {l: 'Fair odds', r: 1}, {l: 'vs independent', r: 1}], Object.entries(s.sgp).map(([k, v]) => `<tr><td>${esc(k.replace('home_cover', H + ' covers').replace('away_cover', A + ' covers').replace('&', ' + '))}</td><td class="r num">${pct(v.p_joint, 1)}</td><td class="r num">${ml(v.fair_parlay_american)}</td><td class="r num">×${fx(v.correlation_lift, 2)}</td></tr>`)) : '') +
        `<p class="note">6-point teaser legs: ${H} ${pct(s.teaser6.home)}, ${A} ${pct(s.teaser6.away)}, over ${pct(s.teaser6.over)}, under ${pct(s.teaser6.under)}. A two-team teaser at −120 needs 73.9% per leg.</p>`)}</div>`;
  } else {
    const fam = Object.entries(b.why_margin.families).sort((a, z) => Math.abs(z[1]) - Math.abs(a[1])); const mx = Math.max(1, ...fam.map(x => Math.abs(x[1])));
    body = `<div class="grid g2">${card('What drives the number', `Points each factor adds toward ${H} (green) or ${A} (red) in the football-stats model.`, fam.map(([k, v]) => { const w = Math.abs(v) / mx * 50; return `<div class="bar"><span>${esc(k)}</span><span class="track"><span class="fill" style="left:${v >= 0 ? 50 : 50 - w}%;width:${w}%;background:${v >= 0 ? 'var(--accent)' : 'var(--red)'}"></span></span><span class="num r">${sgn(v)}</span></div>`; }).join(''))}
      ${card('Situation and injuries', '', `<p class="note">Rest: ${H} ${b.situational.rest_home} days, ${A} ${b.situational.rest_away} days. ${A} travels ${Math.round(b.situational.away_travel_km || 0).toLocaleString()} km across ${Math.abs(b.situational.tz_shift_away || 0)} time zones${b.situational.div_game ? '; division game' : ''}${b.situational.primetime ? '; prime time' : ''}.</p>
        <p class="note"><b>${H} missing:</b> ${esc(b.absences.home || 'nobody of note')}</p><p class="note"><b>${A} missing:</b> ${esc(b.absences.away || 'nobody of note')}</p>${b.home_qb_note || b.away_qb_note ? `<div class="verdict amber">QB change: ${esc(b.home_qb_note || b.away_qb_note)}</div>` : ''}
        <p class="note">Line outlook: the early-week model is ${sgn(b.line_outlook.open_time_vs_market_total)} points from the total, which historically predicts a ${sgn(b.line_outlook.expected_total_move, 2)}-point move.</p>`)}</div>`;
  }
  $('#view').innerHTML = pick + head + `<div class="tabs">${tabs.map(t => `<button data-t="${t[0]}" class="${t[0] === GTAB ? 'on' : ''}">${t[1]}</button>`).join('')}</div>` + body;
  document.querySelectorAll('[data-g]').forEach(el => el.onclick = () => { GAME = el.dataset.g; game(); });
  const gw = $('#gWatch'); if (gw) gw.onclick = () => { W.gid = b.game_id; W.si = 0; W.i = -1; go('watch'); };
  document.querySelectorAll('[data-t]').forEach(el => el.onclick = () => { GTAB = el.dataset.t; game(); });
}
// ---------------------------------------------------------------- MATCHUP: coaching, play calling, scheme collisions, player vs scheme
function matchupTab(b) {
  const M = b.matchup, H = b.home, A = b.away, meta = D.matchup_meta || {};
  if (!M || !M.teams || !M.teams[H] || !M.teams[A]) return card('Matchup', '', '<p class="note">No matchup report for this game yet. It is built by the next update.</p>');
  const TA = M.teams[A], TH = M.teams[H];
  const p0 = x => ok(x) ? Math.round(100 * x) + '%' : '–';
  const pp = x => ok(x) ? (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(100 * x).toFixed(0) + '%' : '–';
  const e2 = x => ok(x) ? (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(2) : '–';
  // "a lot more / a bit more / about average" against the league, in words + color
  const vsLg = (v, lg, big = .25, small = .08) => { if (!ok(v) || !ok(lg) || !lg) return ['', ''];
    const r = v / lg - 1, a = Math.abs(r); return a >= big ? [r > 0 ? 'a lot more than average' : 'a lot less than average', r > 0 ? 'hi' : 'lo'] : a >= small ? [r > 0 ? 'more than average' : 'less than average', r > 0 ? 'hi2' : 'lo2'] : ['about average', '']; };
  const cell = (v, lg) => { const [, c] = vsLg(v, lg); return `<td class="r num ${c ? 'mu-' + c : ''}">${p0(v)}</td>`; };
  const go4 = T => !ok(T.go4_extra) ? '–' : `${pp(T.go4_extra)}<span class="muted mu-n"> ${T.go4_n} tries</span>`;
  const proe = T => ok(T.proe) ? `${T.proe > 0 ? '+' : T.proe < 0 ? '−' : ''}${Math.abs(T.proe).toFixed(1)}%` : '–';

  // 1. the plain-English read for each side
  const story = (off, T, de) => {
    const s = [];
    const c = T.coach ? esc(T.coach) : off;
    if (ok(T.go4_extra) && Math.abs(T.go4_extra) >= .04) s.push(`${c} goes for it on 4th-and-short ${T.go4_extra > 0 ? 'more' : 'less'} often than most coaches (${pp(T.go4_extra)} vs an average coach in the same spots)`);
    if (ok(T.proe) && Math.abs(T.proe) >= 2) s.push(`${off} ${T.proe > 0 ? 'throws more' : 'runs more'} than the situation calls for (${proe(T)} pass rate over expected)`);
    if (ok(T.nohuddle) && T.nohuddle >= .12) s.push(`${off} plays fast, with no huddle on ${p0(T.nohuddle)} of normal plays`);
    const big = Object.entries(T.off || {}).map(([k, v]) => [k, v.rate / v.lg - 1]).filter(x => Math.abs(x[1]) >= .2).sort((a, z) => Math.abs(z[1]) - Math.abs(a[1])).slice(0, 2);
    const NM = {play_action: 'play action', motion: 'pre-snap motion', screen: 'screens', deep: 'deep shots', shotgun: 'shotgun'};
    big.forEach(([k, r]) => s.push(`uses ${NM[k]} ${r > 0 ? 'a lot more' : 'a lot less'} than average (${p0(T.off[k].rate)} vs ${p0(T.off[k].lg)})`));
    const dd = Object.entries(T.def || {}).map(([k, v]) => [k, v.rate / v.lg - 1]).filter(x => Math.abs(x[1]) >= .2 && x[0] !== 'light_box').sort((a, z) => Math.abs(z[1]) - Math.abs(a[1])).slice(0, 1);
    const DN = {blitz: 'blitzes', heavy_box: 'stacks 8+ in the box', man: 'plays man coverage', pressure: 'gets pressure'};
    dd.forEach(([k, r]) => s.push(`faces a ${de} defense that ${DN[k]} ${r > 0 ? 'a lot more' : 'a lot less'} than average (${p0(T.def[k].rate)} vs ${p0(T.def[k].lg)})`));
    return s.length ? `<p><b>${off} on offense:</b> ${s.join('; ')}.</p>` : `<p><b>${off} on offense:</b> a by-the-book offense, close to league average in how it calls plays.</p>`;
  };
  const read = `<div class="verdict blue mu-read">${story(A, TA, H)}${story(H, TH, A)}</div>`;

  // 2. coaching + play calling side by side
  const offRows = [['Head coach', T => esc(T.coach || '–'), ''], ['4th-and-short: go-for-it vs average coach', go4, '0%'], ['Pass rate over expected (normal situations)', proe, '0%'],
    ['No huddle (normal situations)', T => p0(T.nohuddle), '']];
  const OF = [['play_action', 'Play action (of passes)'], ['motion', 'Pre-snap motion'], ['shotgun', 'Shotgun'], ['screen', 'Screens (of passes)'], ['deep', 'Deep shots, 20+ yards (of passes)']];
  const DF = [['blitz', 'Blitz (5+ rushers)'], ['pressure', 'Pressure on the QB *'], ['man', 'Man coverage *'], ['heavy_box', '8+ in the box (vs runs)'], ['light_box', '6 or fewer in the box (vs runs)']];
  const lgOf = k => (TA.off[k] || TH.off[k] || {}).lg, lgDf = k => (TA.def[k] || TH.def[k] || {}).lg;
  const coach = '<div class="mu-tbl">' + table([{l: ''}, {l: A, r: 1}, {l: H, r: 1}, {l: 'League', r: 1}],
    offRows.map(([l, f, lg]) => `<tr><td>${l}</td><td class="r">${f(TA)}</td><td class="r">${f(TH)}</td><td class="r num muted">${lg}</td></tr>`)
      .concat(OF.map(([k, l]) => `<tr><td>${l}</td>${cell(TA.off[k] && TA.off[k].rate, lgOf(k))}${cell(TH.off[k] && TH.off[k].rate, lgOf(k))}<td class="r num muted">${p0(lgOf(k))}</td></tr>`))) + '</div>';
  const defRows = DF.map(([k, l]) => `<tr><td>${l}</td>${cell(TH.def[k] && TH.def[k].rate, lgDf(k))}${cell(TA.def[k] && TA.def[k].rate, lgDf(k))}<td class="r num muted">${p0(lgDf(k))}</td></tr>`);
  const defense = '<div class="mu-tbl">' + table([{l: ''}, {l: A + ' D', r: 1}, {l: H + ' D', r: 1}, {l: 'League', r: 1}], defRows) + '</div>';

  // 3. where the schemes collide
  const edges = (M.edges || []).filter(e => !['shotgun', 'light_box'].includes(e.feat) && Math.abs(e.value) >= .003).slice(0, 4);
  const collide = edges.length ? `<div class="mu-edges">${edges.map(e => `<div class="mu-edge"><span class="badge ${e.favors === H || e.favors === A ? 'info' : ''}">edge ${esc(e.favors)}</span><div><b>${esc(e.off)} offense vs ${esc(e.def)} defense · ${esc(e.label)}</b><p>${esc(e.text)}</p></div></div>`).join('')}</div>` : '<p class="note">No scheme collision stands out.</p>';

  // 4. player matchups
  const LK = {blitz: 'when blitzed', pressure: 'under pressure', man: 'against man coverage', play_action: 'on play action'};
  const qbBlock = (off, T, de) => { const q = T.qb || {}; if (!q.looks || !q.looks.length) return '';
    return `<div class="mu-qb"><h4>${esc(q.name || off + ' QB')} <span class="muted">vs ${de}'s defense</span></h4>${table([{l: 'Look'}, {l: 'His EPA change per dropback', r: 1}, {l: 'How often he sees it here', r: 1}],
      q.looks.map(x => { const d = x.split - x.lg, cls = Math.abs(d) < .03 ? '' : d > 0 ? 'pos' : 'neg';
        return `<tr><td>${LK[x.look] || x.look}<span class="muted mu-n"> ${x.n} plays</span></td><td class="r num ${cls}">${e2(x.split)}<span class="sub2">league ${e2(x.lg)}</span></td><td class="r num">${p0(x.rate)}<span class="sub2">league ${p0(x.lg_rate)}</span></td></tr>`; }))}</div>`; };
  const rcvBlock = (off, T, de) => { const R = T.receivers || []; if (!R.length) return '';
    return `<div class="mu-qb"><h4>${off} pass catchers <span class="muted">vs ${de}: man coverage ${p0(T.opp_man_rate)} of dropbacks (league ${p0(T.lg_man_rate)}) *</span></h4>${table([{l: 'Player'}, {l: 'EPA / target vs man', r: 1}, {l: 'vs zone', r: 1}, {l: 'Fit vs this D', r: 1}],
      R.map(x => { const better = x.man - x.zone, fit = x.vs_this_d;
        const tag = Math.abs(fit) < .004 ? '<span class="muted">neutral</span>' : fit > 0 ? '<span class="badge good">good fit</span>' : '<span class="badge warn">tougher</span>';
        return `<tr><td><b>${esc(x.name)}</b> <span class="muted">${x.pos}</span><span class="sub2">${better > 0 ? 'better against man' : 'better against zone'} · ${x.n_man + x.n_zone} targets</span></td><td class="r num ${x.man > x.zone ? 'pos' : ''}">${e2(x.man)}</td><td class="r num ${x.zone > x.man ? 'pos' : ''}">${e2(x.zone)}</td><td class="r">${tag}</td></tr>`; }))}</div>`; };
  const players = `${qbBlock(A, TA, H)}${rcvBlock(A, TA, H)}${qbBlock(H, TH, A)}${rcvBlock(H, TH, A)}`;

  // 5. honesty: what was tested and what is used
  const v = meta.validation && meta.validation.models, add = v && v['additive only'], mu = v && v['additive + matchup'];
  const tested = v ? `Tested on ${meta.validation.n_team_games.toLocaleString()} team-games (rules learned on 2022–2024, graded on 2025–2026, profiles built only from earlier games): adding these scheme collisions changed the average miss on offensive efficiency from ${add.test_mae.toFixed(4)} to ${mu.test_mae.toFixed(4)}, which is no real improvement. So they explain how a game is likely to be played, but they do not move Locksmith's score, spread or total.` : '';
  const how = `<div class="verdict amber"><b>What this changes in the model.</b> Each head coach's 4th-down habit is used in the play-by-play simulator, so an aggressive coach goes for it more there. ${tested} Team strength already captures most of what the scheme numbers show.</div>`;

  return `${read}
    <div class="grid g2">${card('Coaching and play calling', 'How each offense calls plays. Green = a lot more than the league, red = a lot less.', coach)}
      ${card('Defensive looks', 'What each defense shows. * Pressure and man coverage come from tracking data, which is published through 2025.', defense)}</div>
    ${card('Where the schemes collide', 'Where one team’s habits run into the other team’s strengths or weaknesses. Numbers are ' + gl('epa', 'EPA') + ' per play.', collide)}
    ${card('Player matchups', 'How each quarterback and his top targets have done against the looks this defense likes, from every play since 2023 (this season counts most). Shrunk toward league average so small samples don’t overreact.', players)}
    ${how}`;
}
function splitRows(label, s) {
  if (!s || s.tickets == null) return '';
  return `<div class="split"><span><b>${esc(label)}</b></span><div class="twin"><div class="row"><span class="muted">Bets</span><span class="track"><span class="fill" style="left:0;width:${s.tickets}%;background:var(--blue)"></span></span><span class="num r">${s.tickets}%</span></div>
    <div class="row"><span class="muted">Money</span><span class="track"><span class="fill" style="left:0;width:${s.money}%;background:var(--accent)"></span></span><span class="num r">${s.money}%</span></div></div></div>`;
}
function histFor(s) {
  const SP = (D.research && D.research.splits) || []; const tot = s.side === 'Over' || s.side === 'Under';
  const key = {sharp_money: tot ? 'Total: bet the side with money% - tickets% >= 15' : 'Spread: bet the side with money% - tickets% >= 15', reverse_line_move: tot ? 'Total: reverse line move' : 'Spread: reverse line move', liability_hold: tot ? 'Total: liability hold' : 'Spread: liability hold'}[s.kind];
  const r = key && SP.find(x => x.rule.startsWith(key));
  return r && ok(r.win_pct) ? `Historically ${pct(r.win_pct, 1)} over ${r.n} games` : 'No history yet';
}
function marketCard(b) {
  const m = b.market; if (!m || m.error) return card('Betting market', '', `<p class="note">${esc(m && m.error || 'No market snapshot yet. Click “Market snapshot” at the top.')}</p>`);
  const H = b.home, A = b.away, S = m.splits || {};
  const moves = `<div class="tiles">${tile(`${sp(m.spread_home_open)} → ${sp(m.spread_home_now)}`, `${H} spread, opener to now`)}${tile(`${fx(m.total_open)} → ${fx(m.total_now)}`, 'total, opener to now')}${tile(sgn(m.news_effect_toward_home), 'move explained by news (toward ' + H + ')')}${tile(sgn(m.residual_move_toward_home), 'unexplained move: the market’s own lean')}</div>`;
  const splits = card('Where the bets and money are', 'Blue = share of bets, green = share of dollars. Money well above bets means fewer, bigger bets.', `${splitRows(H + ' spread', S.spread_home)}${splitRows(A + ' spread', S.spread_away)}${splitRows('Over', S.total_over)}${splitRows('Under', S.total_under)}${splitRows(H + ' moneyline', S.moneyline_home)}${splitRows(A + ' moneyline', S.moneyline_away)}<p class="note">${m.num_bets ? Number(m.num_bets).toLocaleString() + ' tracked bets. ' : ''}${m.snapshots} snapshot${m.snapshots === 1 ? '' : 's'} stored.</p>`);
  const sig = card('Market signals', 'After removing moves caused by news. Each shows its real historical record.', (m.signals || []).map(s => `<div class="signal"><span>${sigBadge(s)}</span><span>${esc(s.text)}<br><span class="muted">${histFor(s)}</span></span></div>`).join('') || '<p class="note">No signal fired for this game.</p>');
  const shop = [...(m.spread_shop || []), ...(m.total_shop || [])].sort((a, z) => z.ev_per_unit - a.ev_per_unit).slice(0, 6);
  const bk = card('Every sportsbook', 'Best prices are ranked by expected value using Locksmith’s probabilities.', table([{l: 'Book'}, {l: H + ' spread', r: 1}, {l: A + ' spread', r: 1}, {l: 'Total (over / under)', r: 1}, {l: 'Moneyline', r: 1}], (m.books || []).map(x => `<tr><td>${esc(x.book)}</td><td class="r num">${sp(x.spread_home)} (${ml(x.spread_home_odds)})</td><td class="r num">${sp(x.spread_away)} (${ml(x.spread_away_odds)})</td><td class="r num">${fx(x.total)} (${ml(x.over_odds)} / ${ml(x.under_odds)})</td><td class="r num">${ml(x.ml_home)} / ${ml(x.ml_away)}</td></tr>`))
    + table([{l: 'Best prices'}, {l: 'Bet'}, {l: 'Win chance', r: 1}, {l: 'Expected value', r: 1}], shop.map(x => `<tr><td>${esc(x.book)}</td><td>${esc(x.side)} ${x.side === 'Over' || x.side === 'Under' ? x.line : sp(x.line)} (${ml(x.odds)})</td><td class="r num">${pct(x.p_cover ?? x.p, 1)}</td><td class="r num ${x.ev_per_unit > 0 ? 'pos' : 'neg'}">${sgn(100 * x.ev_per_unit)}%</td></tr>`)));
  return moves + `<div class="grid g2">${splits}${sig}</div>` + bk;
}

// ---------------------------------------------------------------- PLAYER STATS
function players() {
  const rows = [];
  books().forEach(b => { const P = b.players || {}; [b.home, b.away].forEach(team => { const d = P[team]; if (!d || !d.players) return; const opp = team === b.home ? b.away : '@' + b.home;
    if (d.qb) { const j = d.qb.proj; rows.push({name: d.qb.name, pos: 'QB', team, opp, status: d.qb.status, p_play: 1, pass_yds: j.pass_yds.mean, pass_line: j.pass_yds.fair_line, pass_td: j.pass_td.mean, rec_yds: null, rec: null, tgt: null, rush_yds: j.rush_yds.mean, car: j.carries.mean, td: null, s: d.qb.season || {}, fp: 0.04 * j.pass_yds.mean + 4 * j.pass_td.mean - 2 * j.ints.mean + 0.1 * j.rush_yds.mean + 6 * (j.rush_td ? j.rush_td.mean : 0)}); }
    d.players.forEach(p => { const j = p.proj; rows.push({name: p.name, pos: p.pos, team, opp, status: p.status, p_play: p.p_play, rec_yds: j.rec_yds.mean, rec_line: j.rec_yds.fair_line, rec: j.receptions.mean, tgt: j.targets.mean, rush_yds: j.rush_yds.mean, rush_line: j.rush_yds.fair_line, car: j.carries.mean, td: j.anytime_td, s: p.season || {}, tshare: p.usage.u_tgt,
      fp: 0.5 * j.receptions.mean + 0.1 * (j.rec_yds.mean + j.rush_yds.mean) + 6 * ((j.rec_td ? j.rec_td.mean : 0) + (j.rush_td ? j.rush_td.mean : 0))}); }); }); });
  const teams = [...new Set(rows.map(r => r.team))].sort(); const f = window.__pf || {q: '', team: '', pos: ''};
  let R = rows.filter(r => (!f.q || r.name.toLowerCase().includes(f.q.toLowerCase())) && (!f.team || r.team === f.team) && (!f.pos || r.pos === f.pos));
  R.sort((a, z) => PSORT.dir * ((a[PSORT.k] ?? -1) - (z[PSORT.k] ?? -1)));
  const ctl = `<div class="row-flex"><input id="pq" class="search" placeholder="Search for a player…" value="${esc(f.q)}"><select id="pt" class="search"><option value="">All teams</option>${teams.map(t => `<option ${t === f.team ? 'selected' : ''}>${t}</option>`).join('')}</select>
    <select id="pp" class="search"><option value="">All positions</option>${['QB', 'RB', 'WR', 'TE'].map(t => `<option ${t === f.pos ? 'selected' : ''}>${t}</option>`).join('')}</select><span class="muted">${R.length} players in week ${WEEK} · ${tap} a column to sort</span></div>`;
  const body = R.slice(0, 500).map(r => `<tr><td><b>${esc(r.name)}</b>${r.p_play < 0.99 ? ` <span class="badge warn">${esc(r.status)} · ${pct(r.p_play)}</span>` : ''}</td><td>${r.pos}</td><td>${r.team} <span class="muted">vs ${r.opp}</span></td>
    <td class="r num">${r.pass_yds == null ? '' : `<b>${fx(r.pass_yds, 0)}</b> <span class="muted">(${r.pass_line})</span>`}</td><td class="r num">${r.pass_td == null ? '' : fx(r.pass_td, 2)}</td><td class="r num">${r.tgt == null ? '' : fx(r.tgt)}</td><td class="r num">${r.rec == null ? '' : fx(r.rec)}</td>
    <td class="r num">${r.rec_yds == null ? '' : `<b>${fx(r.rec_yds)}</b> <span class="muted">(${r.rec_line})</span>`}</td><td class="r num">${fx(r.car)}</td><td class="r num"><b>${fx(r.rush_yds)}</b>${r.rush_line != null ? ` <span class="muted">(${r.rush_line})</span>` : ''}</td>
    <td class="r num">${r.td == null ? '' : pct(r.td)}</td><td class="r num"><b>${fx(r.fp)}</b></td><td class="r num muted">${r.pos === 'QB' ? `${r.s.pass_yds ?? 0} pass yds · ${r.s.pass_td ?? 0} TD` : `${r.s.rec_yds ?? 0} rec yds · ${r.s.rush_yds ?? 0} rush yds · ${(r.s.rec_td ?? 0) + (r.s.rush_td ?? 0)} TD`} (${r.s.games ?? 0} g)</td></tr>`);
  $('#view').innerHTML = ctl + table([{l: 'Player'}, {l: 'Pos'}, {l: 'Team'}, {l: 'Pass yds', r: 1, sort: 'pass_yds'}, {l: 'Pass TD', r: 1, sort: 'pass_td'}, {l: 'Targets', r: 1, sort: 'tgt'}, {l: 'Catches', r: 1, sort: 'rec'}, {l: 'Rec yds', r: 1, sort: 'rec_yds'}, {l: 'Carries', r: 1, sort: 'car'}, {l: 'Rush yds', r: 1, sort: 'rush_yds'}, {l: 'TD chance', r: 1, sort: 'td'}, {l: 'Half-PPR pts', r: 1, sort: 'fp', t: 'Approximate half-PPR fantasy points'}, {l: 'Season so far', r: 1}], body);
  const upd = () => { window.__pf = {q: $('#pq').value, team: $('#pt').value, pos: $('#pp').value}; players(); };
  $('#pq').oninput = () => { clearTimeout(window.__pt); window.__pt = setTimeout(upd, 220); }; $('#pt').onchange = upd; $('#pp').onchange = upd;
  const pq = $('#pq'); if (f.q) { pq.focus(); pq.setSelectionRange(pq.value.length, pq.value.length); }
  document.querySelectorAll('th.sort').forEach(th => th.onclick = () => { const k = th.dataset.sort; PSORT = {k, dir: PSORT.k === k ? -PSORT.dir : -1}; players(); });
}

// ---------------------------------------------------------------- FANTASY
function fantasy() {
  const F = D.fantasy;
  if (!F || !F.my_team) { $('#view').innerHTML = card('Fantasy', '', '<p class="note">No league data yet. Click Update all.</p>'); return; }
  const M = F.my_team, d = M.detail || {}, opp = M.opponent ? (M.opponent.team || M.opponent.owner) : 'Opponent';
  const cur = window.__oppv === 'current' && d.rows_current;
  const wp = cur ? d.win_prob_vs_current : d.win_prob_best, oppMean = cur ? d.opp_mean_current : d.opp_mean, R = cur ? d.rows_current : d.rows;
  const swapOut = new Set((M.swaps || []).map(x => x.bench));
  const todo = [];
  (M.swaps || []).forEach(x => todo.push(`Start <b>${esc(x.start)}</b> instead of ${esc(x.bench)} <span class="muted">+${fx(x.gain)} pts</span>`));
  (d.fa_upgrades || []).filter(u => u.win_gain >= 0.02).slice(0, 2).forEach(u => todo.push(`Pick up <b>${esc(u.add)}</b> <span class="muted">${u.pos}, ${u.team}</span> and start him over ${esc(u.replaces)}. Your win chance goes to ${pct(u.win_prob)}`));
  (M.flags || []).filter(f => !swapOut.has(f.player)).forEach(f => todo.push(/Questionable/.test(f.issue) ? `Confirm <b>${esc(f.player)}</b> is active before kickoff. He is Questionable, and Locksmith assumes he plays.` : `<b>${esc(f.player)}</b> is ${esc(f.issue)}. Replace him.`));
  const hero = `<div class="card fhero">
      <div class="fteam"><span class="eyebrow">You</span><b>${esc(M.team)}</b><span class="muted">${esc(M.record)}</span><div class="fpts">${fx(d.my_mean, 0)}</div></div>
      <div class="fmid"><div class="fwp ${wp >= .5 ? 'pos' : 'neg'}">${pct(wp)}</div><div class="muted">chance you win</div></div>
      <div class="fteam r"><span class="eyebrow">Week ${F.week} opponent</span><b>${esc(opp)}</b><span class="muted">${esc(M.opponent ? M.opponent.owner : '')}</span><div class="fpts">${fx(oppMean, 0)}</div></div></div>`;
  const doIt = card(todo.length ? 'Do this before kickoff' : 'Your lineup is set', '', todo.length ? `<ol class="todo">${todo.map(t => `<li>${t}</li>`).join('')}</ol>` : '<p class="note">Your Sleeper lineup is already your best lineup. Nothing to change.</p>')
;
  const sw = d.rows_current ? `<div class="chips" style="margin:4px 0 12px"><button class="chip${cur ? '' : ' on'}" data-oppv="best">${esc(opp)}: best available lineup</button><button class="chip${cur ? ' on' : ''}" data-oppv="current">${esc(opp)}: lineup set now${d.opp_has_current ? '' : ' (not set yet)'}</button></div>` : '';
  const tag = x => x.src === 'not expected to play' ? `<span class="badge bad" title="${esc(x.note || '')}">Not playing</span>` : x.src === 'questionable' || x.injury === 'Questionable' ? `<span class="badge warn" title="${esc(x.note || '')}">Questionable</span>` : x.note === 'BYE' ? '<span class="badge">Bye</span>' : (x.injury ? `<span class="badge warn">${esc(x.injury)}</span>` : '');
  const who = x => `<b>${esc(x.name)}</b> ${tag(x)}<span class="sub2">${x.pos || ''}${x.team ? ' · ' + x.team : ''}${x.opp ? ' vs ' + esc(x.opp) : ''}</span>`;
  const rows = (R || []).map(r => { const a = r.me.mean || 0, b = r.opp.mean || 0;
    return `<tr><td class="slot">${esc(r.slot.replace('SUPER_FLEX', 'SF'))}</td><td>${who(r.me)}</td><td class="r pts ${a >= b ? 'pos' : ''}">${fx(a)}</td><td class="r pts ${b > a ? 'neg' : ''}">${fx(b)}</td><td class="r">${who(r.opp)}</td></tr>`; });
  rows.push(`<tr class="tot"><td></td><td><b>Total</b></td><td class="r pts">${fx(d.my_mean)}</td><td class="r pts">${fx(oppMean)}</td><td></td></tr>`);
  const h2h = card('Head to head', `Your best lineup against ${cur ? 'the lineup they have set now' : 'their best available lineup'}. Only players expected to play count: Questionable players are assumed to play, Doubtful / Out / IR count as zero.`, `<div class="tbl"><table class="h2h"><thead><tr><th></th><th>You</th><th class="r">Pts</th><th class="r">Pts</th><th class="r">${esc(opp)}</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`);
  const me = F.standings.find(x => x.roster_id === F.my_roster_id);
  const league = `<details class="more"><summary>League standings and other matchups${me ? ` · your playoff chance ${pct(me.playoff_odds)}` : ''}</summary>
    ${card('Standings', `Top ${F.league.playoff_teams} make the playoffs.`, table([{l: 'Team'}, {l: 'Record', r: 1}, {l: 'Playoff chance', r: 1}], F.standings.map(x => `<tr${x.roster_id === F.my_roster_id ? ' class="me"' : ''}><td>${esc(x.team || x.owner)}</td><td class="r num">${x.wins}-${x.losses}${x.ties ? '-' + x.ties : ''}</td><td class="r num">${pct(x.playoff_odds)}</td></tr>`)))}
    ${card('This week around the league', 'Both teams in their best available lineups.', table([{l: 'Matchup'}, {l: 'Projected', r: 1}, {l: 'Favorite'}], F.matchups.filter(m => !m.mine).map(m => { const [a, z] = m.teams, fa = a.win_prob >= z.win_prob ? a : z; return `<tr><td>${esc(a.team || a.owner)} vs ${esc(z.team || z.owner)}</td><td class="r num">${fx(a.proj_optimal, 0)}–${fx(z.proj_optimal, 0)}</td><td>${esc(fa.team || fa.owner)} ${pct(Math.max(a.win_prob, z.win_prob))}</td></tr>`; })))}</details>
    <details class="more"><summary>Waiver wire</summary>${card('Best free agents this week', '', table([{l: 'Player'}, {l: 'This week', r: 1}, {l: 'Next week', r: 1}, {l: ''}], (F.waivers || []).filter(x => (x.mean || 0) >= 3).slice(0, 12).map(x => `<tr><td>${who(x)}</td><td class="r num"><b>${fx(x.mean)}</b></td><td class="r num">${fx(x.next_week_mean)}</td><td>${x.upgrade_over ? `<span class="badge good">better than ${esc(x.upgrade_over.player)}</span>` : ''}</td></tr>`)))}</details>`;
  $('#view').innerHTML = hero + doIt + sw + h2h + league;
  document.querySelectorAll('[data-oppv]').forEach(el => el.onclick = () => { window.__oppv = el.dataset.oppv; fantasy(); });
}

// ---------------------------------------------------------------- BEST BETS
function plays() {
  const P = D.plays, live = D.plays.filter(p => p.tier !== 'watch');
  const tierName = t => ({W: 'Wind under', S: 'Spread edge', A: 'Early total', B: 'Price value', watch: 'Watch'})[t.split('+')[0]] || t;
  $('#view').innerHTML = `<div class="verdict blue"><b>How to use this:</b> <b>Early total</b> bets are timing bets. They only pay when you get the number before the market moves to the model, and they drop to Watch once it has. <b>Price value</b> bets beat the posted price, so always take the best number listed. <b>Wind</b> bets back the under in 15+ mph wind, which the market under-reacts to. Stakes are a quarter of the Kelly criterion, as a % of your bankroll.</div>`
    + card(`${live.length} bets this week`, 'Every bet is also written to the Track record ledger and graded automatically after the game.', table([{l: 'Type'}, {l: 'Game'}, {l: 'Bet'}, {l: 'Win chance', r: 1}, {l: 'Edge', r: 1}, {l: 'Stake', r: 1}, {l: 'Best place to bet'}, {l: 'Why'}],
      P.map(p => `<tr><td><span class="badge ${p.tier.startsWith('A') ? 'solid' : p.tier === 'watch' ? '' : 'info'}">${tierName(p.tier)}</span></td><td>${esc(p.game)}</td><td><b>${esc(p.bet)}</b></td><td class="r num">${pct(p.prob, 1)}</td><td class="r num ${p.edge > 0 ? 'pos' : 'neg'}">${sgn(100 * p.edge)}%</td><td class="r num">${p.stake_pct > 0 ? fx(100 * p.stake_pct, 2) + '%' : '–'}</td><td>${esc(p.best_book || '–')}</td><td class="wrap muted">${esc(p.why)}</td></tr>`)));
}

// ---------------------------------------------------------------- TRACK RECORD
function equitySVG(curve, W = 760, H = 210) {
  if (!curve || curve.length < 2) return '<p class="note">Not enough graded bets yet.</p>';
  const pad = 34, lo = Math.min(0, ...curve), hi = Math.max(0, ...curve), xs = i => pad + i / (curve.length - 1) * (W - 2 * pad), ys = v => H - pad - (v - lo) / ((hi - lo) || 1) * (H - 2 * pad);
  const d = curve.map((v, i) => `${i ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ');
  const last = curve[curve.length - 1], col = last >= 0 ? 'var(--accent)' : 'var(--red)';
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Cumulative units won"><line x1="${pad}" x2="${W - pad}" y1="${ys(0)}" y2="${ys(0)}" stroke="var(--muted)" stroke-opacity=".5" stroke-dasharray="4 4"/>
    <path d="${d} L${xs(curve.length - 1)},${ys(0)} L${xs(0)},${ys(0)} Z" fill="${col}" fill-opacity=".10"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2.2"/><circle cx="${xs(curve.length - 1)}" cy="${ys(last)}" r="4.5" fill="${col}"/>
    <text x="${W - pad}" y="14" text-anchor="end" font-size="13" font-weight="600" fill="${col}" font-family="var(--mono)">${sgn(last)} units</text>
    <text x="${pad}" y="${H - 8}" font-size="11.5" fill="var(--muted)">first bet</text><text x="${W - pad}" y="${H - 8}" font-size="11.5" text-anchor="end" fill="var(--muted)">latest (${curve.length} bets)</text>
    <text x="4" y="${ys(hi) + 4}" font-size="11" fill="var(--muted)" font-family="var(--mono)">${fx(hi, 0)}</text><text x="4" y="${ys(lo) + 4}" font-size="11" fill="var(--muted)" font-family="var(--mono)">${fx(lo, 0)}</text></svg>`;
}
const TIERNAME = {A: 'Early total (retired)', B: 'Price value (retired)', W: 'Wind under', S: 'Spread edge', watch: 'Watch (not staked)'};
function recSection(S, label, sub, atClose = false) {
  if (!S || !S.plays_all && !S.games && !S.props_all) return `<h2>${label}</h2>` + card('Nothing graded yet', '', `<p class="note">${sub} Picks published this week are already saved and will be graded automatically once their games end.</p>`);
  const a = S.plays_all || {}, g = S.games || {};
  const tierRows = Object.entries(S.plays_by_tier || {}).map(([t, x]) => `<tr><td>${TIERNAME[t] || t}</td><td class="r num">${x.wins}-${x.losses}${x.pushes ? '-' + x.pushes : ''}</td><td class="r num">${pct(x.win_pct, 1)}</td><td class="r num ${x.units_flat >= 0 ? 'pos' : 'neg'}">${sgn(x.units_flat)}</td><td class="r num">${sgn(100 * x.roi_flat)}%</td><td class="r num">${atClose ? 'n/a' : ok(x.avg_clv_pts) ? sgn(x.avg_clv_pts, 2) : '–'}</td></tr>`);
  const seasonRows = Object.entries(S.plays_by_season || {}).map(([t, x]) => `<tr><td>${t}</td><td class="r num">${x.wins}-${x.losses}${x.pushes ? '-' + x.pushes : ''}</td><td class="r num">${pct(x.win_pct, 1)}</td><td class="r num ${x.units_flat >= 0 ? 'pos' : 'neg'}">${sgn(x.units_flat)}</td></tr>`);
  const recent = (S.recent_plays || []).map(p => `<tr><td class="muted">${p.season} wk ${p.week}</td><td>${esc(p.label)}</td><td class="r num">${ml(p.price)}</td><td class="r num">${pct(p.prob)}</td><td><span class="badge ${p.outcome === 'win' ? 'good' : p.outcome === 'loss' ? 'bad' : ''}">${p.outcome}</span></td><td class="r num ${p.units_flat >= 0 ? 'pos' : 'neg'}">${sgn(p.units_flat, 2)}</td><td class="r num">${atClose ? 'n/a' : ok(p.clv_pts) ? sgn(p.clv_pts) : '–'}</td><td class="muted">final ${esc(p.final)}</td></tr>`);
  const games = (S.recent_games || []).map(x => `<tr><td class="muted">${x.season} wk ${x.week}</td><td>${esc(x.label)}</td><td class="r num">${fx(x.proj_away, 0)}–${fx(x.proj_home, 0)}</td><td class="r num"><b>${esc(x.final)}</b></td><td class="r num">${fx(x.err_margin)}</td><td class="r num">${fx(x.err_total)}</td></tr>`);
  const pl = Object.entries(S.players || {}).filter(([k]) => k !== 'anytime_td').map(([k, x]) => `<tr><td>${k.replace('_', ' ')}</td><td class="r num">${x.n}</td><td class="r num">${fx(x.mae, 1)}</td><td class="r num">${pct(x.over_hit_pct)}</td></tr>`);
  return `<h2>${label}</h2><p class="note">${sub}</p><div class="tiles">${tile(`${a.wins ?? 0}-${a.losses ?? 0}${a.pushes ? '-' + a.pushes : ''}`, 'bets won–lost')}${tile(sgn(a.units_flat), 'units, 1 unit per bet', (a.units_flat || 0) >= 0 ? 'good' : 'bad')}${tile(sgn(100 * (a.roi_flat || 0)) + '%', 'return on money staked')}
    ${g.n ? tile(fx(g.mae_team_points) + ' pts', 'average miss per team score') : ''}${g.n ? tile(pct(g.winner_hit_pct), `winners picked (${g.n} games)`) : ''}${g.n ? tile(g.exact_score_hits, 'exact final scores called') : ''}</div>
    <div class="grid g2">${card('Profit over time', 'Cumulative units won, betting 1 unit on every play in order.', equitySVG(S.equity_curve))}
    ${card('By bet type and season', `${gl('clv', 'CLV')} = points gained versus the closing line (positive = you beat the market).`, table([{l: 'Type'}, {l: 'Record', r: 1}, {l: 'Win %', r: 1}, {l: 'Units', r: 1}, {l: 'ROI', r: 1}, {l: 'CLV', r: 1}], tierRows) + table([{l: 'Season'}, {l: 'Record', r: 1}, {l: 'Win %', r: 1}, {l: 'Units', r: 1}], seasonRows))}</div>
    ${card('Every graded bet, latest first', '', table([{l: 'When'}, {l: 'Bet'}, {l: 'Odds', r: 1}, {l: 'Win chance', r: 1}, {l: 'Result'}, {l: 'Units', r: 1}, {l: 'CLV', r: 1}, {l: ''}], recent, {h: 520}))}
    <div class="grid g2">${card('Score projections vs final scores', 'Projected away–home score against the real result.', table([{l: 'When'}, {l: 'Game'}, {l: 'Projected', r: 1}, {l: 'Final', r: 1}, {l: 'Margin miss', r: 1}, {l: 'Total miss', r: 1}], games, {h: 460}))}
    ${pl.length ? card('Player projections', 'Average miss and how often the player went over the published fair line (50% is ideal).', table([{l: 'Stat'}, {l: 'Graded', r: 1}, {l: 'Average miss', r: 1}, {l: 'Went over', r: 1}], pl)) : ''}</div>
    ${S.props_all ? card('Player props', `Prop picks graded on the real box score at −115. Void if the player sat. Record ${S.props_all.wins}-${S.props_all.losses}${S.props_all.pushes ? '-' + S.props_all.pushes : ''}, ${sgn(S.props_all.units_flat)} units.`, equitySVG(S.props_equity)
        + table([{l: 'When'}, {l: 'Prop'}, {l: 'Win chance', r: 1}, {l: 'Actual', r: 1}, {l: 'Result'}, {l: 'Units', r: 1}], (S.recent_props || []).map(p => `<tr><td class="muted">${p.season} wk ${p.week}</td><td>${esc(p.label)}</td><td class="r num">${pct(p.prob)}</td><td class="r num">${fx(p.actual, 0)}</td><td><span class="badge ${p.outcome === 'win' ? 'good' : p.outcome === 'loss' ? 'bad' : ''}">${p.outcome}</span></td><td class="r num ${p.units_flat >= 0 ? 'pos' : 'neg'}">${sgn(p.units_flat, 2)}</td></tr>`), {h: 420})) : ''}`;
}
function record() {
  const L = D.ledger || {}, SG = D.strategy;
  let top = '';
  if (SG && SG.out_of_sample) {
    const o = SG.out_of_sample, BS = Object.entries(SG.by_season || {}), up = BS.filter(([, x]) => x.units > 0).length;
    top = `<div class="verdict big1"><b>The short version:</b> on ${BS.length} past seasons it never saw, Locksmith’s bets won ${pct(o.win_pct, 1)} of the time for <b>${sgn(o.units)} ${gl('units')}</b>, and ${up} of ${BS.length} seasons made money.</div><p class="note">Fair test: each season only used rules that had already worked before it. Wind and model bets are graded at the real ${gl('closing', 'closing line')}; line-move bets (away side and unders the model expects the line to move toward) at the real opening line, which only existed in the archive through 2020-21, so live they need Locksmith's own Sunday-night opener.</p>`
      + `<div class="tiles">${tile(`${o.wins}-${o.losses}`, 'bets won–lost')}${tile(sgn(o.units), 'units, 1 unit per bet', o.units >= 0 ? 'good' : 'bad')}${tile(sgn(100 * o.roi) + '%', 'return on money staked', o.roi >= 0 ? 'good' : 'bad')}${tile(`${up} of ${BS.length}`, 'winning seasons')}</div>`
      + `<div class="grid g2">${card('Profit over time', 'Every bet the rules would have made, in order.', equitySVG(SG.equity))}
         ${card('Season by season', '', table([{l: 'Season'}, {l: 'Record', r: 1}, {l: 'Win %', r: 1}, {l: 'Units', r: 1}], BS.map(([k, x]) => `<tr><td>${k}</td><td class="r num">${x.wins}-${x.losses}${x.pushes ? '-' + x.pushes : ''}</td><td class="r num">${pct(x.win_pct, 1)}</td><td class="r num ${x.units >= 0 ? 'pos' : 'neg'}">${sgn(x.units)}</td></tr>`))
           + table([{l: 'Bet type'}, {l: 'Record', r: 1}, {l: 'Units', r: 1}], Object.entries(SG.by_rule_family || {}).map(([k, x]) => `<tr><td>${({wind_under: 'Wind unders', close_spread: 'Spread edges (4+ pts)', open_spread: 'Opening-line spreads (retired)'})[k] || k}</td><td class="r num">${x.wins}-${x.losses}</td><td class="r num ${x.units >= 0 ? 'pos' : 'neg'}">${sgn(x.units)}</td></tr>`)))}</div>`;
  }
  $('#view').innerHTML = top
    + recSection(L.live, 'Live picks', 'Recorded when this app publishes them and graded when the games end.')
    + `<details class="more"><summary>Week-by-week replay of 2024–2026 with today’s rules</summary>${recSection(L.paper, 'Replay, 2024–2026', 'The current rules run through every 2024–26 week using only pre-game information, at the closing line.', true)}</details>`;
}

// ---------------------------------------------------------------- MARKET
function market() {
  const rows = books().map(b => { const m = b.market || {}; const S = m.splits || {}; const sg = signals(b);
    return `<tr class="click" data-game="${b.game_id}"><td><b>${b.away} @ ${b.home}</b></td><td class="r num">${b.home} ${sp(m.spread_home_open)} → ${sp(m.spread_home_now)}</td><td class="r num">${fx(m.total_open)} → ${fx(m.total_now)}</td>
      <td class="r num">${S.spread_home ? `${S.spread_home.tickets}% / ${S.spread_home.money}%` : '–'}</td><td class="r num">${S.total_over ? `${S.total_over.tickets}% / ${S.total_over.money}%` : '–'}</td><td class="r num">${sgn(m.residual_move_toward_home)}</td><td class="wrap">${sg.map(sigBadge).join(' ') || '<span class="muted">none</span>'}</td></tr>`; });
  $('#view').innerHTML = `<div class="verdict blue big1"><b>The short version:</b> this shows where the public’s bets and money are going and how the lines have moved. None of these signals made money on its own in 888 tested games, so use them as context, not bets.</div>`
    + `<details class="more"><summary>What the columns mean</summary><p class="note"><b>Bets / money:</b> share of tickets vs share of dollars. When money is well ahead of bets, a few big bettors are on that side.<br><b>Unexplained move:</b> how far the line moved after removing injury and QB news.<br><b>Reverse line move:</b> the line moving against the popular side. <b>Book liability:</b> a side has most of the money but the book won’t move. ${TAP} a game for its full board.</p></details>`
    + table([{l: 'Game'}, {l: 'Spread, opener → now', r: 1}, {l: 'Total, opener → now', r: 1}, {l: 'Home bets / money', r: 1}, {l: 'Over bets / money', r: 1}, {l: 'Unexplained move', r: 1}, {l: 'Signals'}], rows);
  document.querySelectorAll('tr[data-game]').forEach(el => el.onclick = () => { GTAB = 'market'; go('game', el.dataset.game); });
}

// ---------------------------------------------------------------- MODEL ACCURACY
function model() {
  const m = D.backtest.margin, t = D.backtest.total, e = D.engine_backtest || {}, pb = D.player_backtest || {}, gb = D.player_gbm || {};
  const pr = Object.entries(pb).filter(([k]) => k !== 'anytime_td').map(([k, v]) => `<tr><td>${k.replace('_', ' ')}</td><td class="r num">${v.n_test}</td><td class="r num"><b>${fx(v.MAE_calibrated, 2)}</b></td><td class="r num">${fx(v.MAE_naive_last6, 2)}</td><td class="r num ${v.MAE_calibrated <= v.MAE_naive_last6 ? 'pos' : 'neg'}">${sgn(100 * (v.MAE_naive_last6 - v.MAE_calibrated) / v.MAE_naive_last6)}%</td><td class="r num">${gb[k] ? fx(gb[k].MAE_gbm, 2) : '–'}</td></tr>`);
  const td = pb.anytime_td || {};
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> Locksmith predicts the final margin about as well as the Las Vegas ${gl('closing', 'closing line')}, the sharpest number in sports (an ${gl('miss', 'average miss')} of ${fx(m.MAE_stack, 2)} points vs ${fx(m.MAE_market, 2)}). Its ranges are honest: real scores land inside the ${gl('range80', '80% range')} ${pct(e.coverage_home_80)} of the time.</div>`
    + `<div class="tiles">${tile(fx(m.MAE_stack, 2) + ' pts', 'Locksmith’s average miss on the final margin')}${tile(fx(m.MAE_market, 2) + ' pts', 'Las Vegas closing line’s miss')}${tile(fx(m.MAE_ridge_fund, 2) + ' pts', 'miss using football stats only, no betting data')}${tile(fx(t.MAE_stack, 2) + ' / ' + fx(t.MAE_market, 2), 'total points miss: Locksmith / Vegas')}${tile(pct(e.coverage_home_80), 'real scores inside the 80% range (80% is perfect)')}${tile(fx(td.logloss_calibrated, 3), 'touchdown-odds score, lower is better (guessing: ' + fx(td.logloss_naive, 3) + ')')}</div>
    <div class="grid g2">${card('Player projections, tested on the 2025 season', 'Trained on 2024 only, then graded on every 2025 game. Lower miss is better. Boosted trees were tested and lost, so they are not used.', table([{l: 'Stat'}, {l: 'Games', r: 1}, {l: 'Locksmith miss', r: 1}, {l: 'Last-6 average', r: 1}, {l: 'Better by', r: 1}, {l: 'Boosted trees', r: 1}], pr))}
    ${card('Score simulator, tested on 1,500 games', '', table([{l: 'Check'}, {l: 'Result', r: 1}], [['Real team scores inside the 80% range', pct(e.coverage_home_80)], ['Real totals inside the 80% range', pct(e.coverage_total_80)], ['Win-probability log-loss (lower is better)', fx(e.xfit_win_logloss_corrected, 4)], ['Closing market on the same games', fx(e.win_logloss_market_same_games, 4)],
      ['Games decided by exactly 3: simulated / real', `${pct(e.key_margin_corrected && e.key_margin_corrected['3'], 1)} / ${pct(e.key_margin_actual && e.key_margin_actual['3'], 1)}`], ['Games decided by exactly 7: simulated / real', `${pct(e.key_margin_corrected && e.key_margin_corrected['7'], 1)} / ${pct(e.key_margin_actual && e.key_margin_actual['7'], 1)}`]].map(r => `<tr><td>${r[0]}</td><td class="r num">${r[1]}</td></tr>`)))}
    ${card('Beating the opening line (2014–2020)', 'When the early-week model disagreed with the opener, how often the bet beat the closing number.', table([{l: 'Market'}, {l: 'Disagreement', r: 1}, {l: 'Bets', r: 1}, {l: 'Avg points gained', r: 1}, {l: 'Beat the close', r: 1}, {l: 'Won at the opener', r: 1}], (D.research.clv || []).filter(r => r.layer === 'ridge_open').map(r => `<tr><td>${r.market}</td><td class="r num">over ${r.edge_vs_open_gt}</td><td class="r num">${r.n_bets}</td><td class="r num">${sgn(r.avg_clv_pts, 2)}</td><td class="r num">${pct(r.beat_close_pct)}</td><td class="r num">${pct(r.win_pct_at_open, 1)}</td></tr>`)))}
    ${card('Accuracy by season (margin miss, points)', '', table([{l: 'Season'}, {l: 'Market', r: 1}, {l: 'Locksmith', r: 1}, {l: 'Stats only', r: 1}], (D.research.by_season || []).map(r => `<tr><td>${r.season}</td><td class="r num">${fx(r.MAE_market, 2)}</td><td class="r num">${fx(r.MAE_stack, 2)}</td><td class="r num">${fx(r.MAE_fund, 2)}</td></tr>`), {h: 420}))}</div>`;
}

// ---------------------------------------------------------------- RESEARCH
function research() {
  const R = D.research, SP = R.splits || [];
  const icon = {works: '✓', doesnt: '✗', neutral: '•', lesson: '!'};
  const PB = D.props_backtest, PT = PB && (PB.tiers_lowo || []).find(t => t.tier === 'all picks'), PR = PB && (PB.over_rate_by_group || []).find(g => g.grp === 'rush');
  const propFind = PB ? [{verdict: 'neutral', title: 'Player props: a small edge, not a big one', text: `Tested on ${PB.n_graded} real DraftKings prop lines from ${PB.season} weeks ${PB.weeks.join(', ')}. Locksmith’s raw player simulations were far too confident, but pointed the right way. After an honest adjustment, picks won ${PT ? (100 * PT.win).toFixed(1) : '–'}% of ${PT ? PT.n : '–'} bets (53.5% breaks even at −115). Promising, not proven, so props get 2 stars at most.`},
    PR ? {verdict: 'works', title: 'Rushing props go under', text: `On DraftKings rushing yards, carries and rush+receiving yards, the under hit ${(100 * (1 - PR.over_rate)).toFixed(0)}% of the time across ${PR.n} lines this season. Locksmith builds this in, which is why most prop picks are rushing unders. Watch the price: books often charge extra on these unders.`} : null,
    {verdict: 'works', title: 'Bet props early', text: `When DraftKings moved a prop line before kickoff, it moved toward Locksmith’s side ${(100 * PB.moves_toward_model).toFixed(0)}% of the time (${PB.line_moves} moves). Locksmith sees where the market is heading, so the early number is the better number.`}].filter(Boolean) : [];
  const FD = [...propFind, ...(D.findings || [])].map(f => `<div class="card"><div class="finding"><span class="ic ${f.verdict}">${icon[f.verdict] || '•'}</span><div><h3>${esc(f.title)}</h3><p class="note" style="color:var(--ink2)">${esc(f.text)}</p></div></div></div>`).join('');
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> every idea below was tested on real games and real betting lines. Only the ones marked ✓ are used in the picks.</div><div class="legend rlegend"><span><b class="ic works">✓</b> works, used</span><span><b class="ic doesnt">✗</b> doesn’t work</span><span><b class="ic neutral">•</b> not proven</span><span><b class="ic lesson">!</b> lesson</span></div><h2>What we found</h2><div class="grid g2">${FD}</div>
    ${(() => { const M = D.wp_model; if (!M) return ''; return card('How accurate are the live odds?', `The live win probability, spread and total in every simulated game come from a model trained on every NFL play from ${M.train_seasons} and tested on all ${M.n_test_plays.toLocaleString()} plays of the ${M.test_season} season it never saw. Lower is better.`,
      table([{l: 'Live win probability'}, {l: 'Log loss', r: 1}, {l: 'Brier score', r: 1}], [
        `<tr><td><b>Locksmith live model</b></td><td class="r num"><b>${fx(M.logloss.locksmith_live, 3)}</b></td><td class="r num"><b>${fx(M.brier.locksmith_live, 3)}</b></td></tr>`,
        `<tr><td>NFL's own published win probability (nflverse)</td><td class="r num">${fx(M.logloss.nflverse_published, 3)}</td><td class="r num">${fx(M.brier.nflverse_published, 3)}</td></tr>`,
        `<tr><td>Pregame line only (ignores the game)</td><td class="r num">${fx(M.logloss.pregame_line_only, 3)}</td><td class="r num">–</td></tr>`])); })()}
    ${(() => { const A = D.playsim_audit; if (!A) return ''; const lab = {points: 'Points per team', plays: 'Offensive plays', ypp: 'Yards per play', explosive_20: 'Plays of 20+ yards', third_down_pct: '3rd-down conversion', rz_td_pct: 'Red-zone TD rate', td_drives: 'TD drives', fg_drives: 'Field-goal drives', punts: 'Punts', pens: 'Penalties', sacks: 'Sacks', ints: 'Interceptions', total_sd: 'Spread of game totals', margin_le_3_weighted: 'Games decided by 3 or fewer', margin_eq_3_weighted: 'Margin of exactly 3', ot_rate: 'Overtime rate'};
      const fmt = (k, v) => v == null ? '–' : (/pct|margin|rate/.test(k) ? pct(v, 1) : fx(v, k === 'ypp' ? 2 : 1));
      return card('How realistic is the play-by-play simulation?', `Every simulated game on the Watch screen is built snap by snap. Here are ${A.n_sim_games.toLocaleString()} simulated games compared with every real game of 2025 and 2026 so far, per team per game.`,
        table([{l: 'Measure'}, {l: 'Real 2025', r: 1}, {l: 'Real 2026', r: 1}, {l: 'Simulated', r: 1}], A.table.filter(r => lab[r.metric]).map(r => `<tr><td>${lab[r.metric]}</td><td class="r num">${fmt(r.metric, r.real_2025)}</td><td class="r num">${fmt(r.metric, r.real_2026)}</td><td class="r num"><b>${fmt(r.metric, r.sim)}</b></td></tr>`))); })()}
    <details class="more"><summary>Show all the numbers behind these findings</summary>` + (SP.length ? card(`Betting-split theories tested on ${SP[0].games_with_splits} real games (${esc(SP[0].seasons)})`, 'Final bet and money percentages, graded against the closing line. You need 52.4% to profit at −110.', table([{l: 'Rule'}, {l: 'Games', r: 1}, {l: 'Win %', r: 1}, {l: '95% range', r: 1}, {l: 'Return', r: 1}, {l: 'p-value', r: 1, t: 'Below 0.05 = unlikely to be luck'}],
    SP.map(r => `<tr><td class="wrap">${esc(r.rule)}</td><td class="r num">${r.n}</td><td class="r num ${r.win_pct > 0.5238 ? 'pos' : (r.win_pct < 0.5 ? 'neg' : '')}">${pct(r.win_pct, 1)}</td><td class="r num">${pct(r.ci_lo)}–${pct(r.ci_hi)}</td><td class="r num">${ok(r['roi_-110']) ? sgn(100 * r['roi_-110']) + '%' : '–'}</td><td class="r num">${fx(r.p_value, 2)}</td></tr>`))) : '')
    + `<div class="grid g2">${card('Do sportsbooks shade the public? (2006–2025)', 'Cover rate against the closing line. Under 50% means that side is overpriced.', table([{l: 'Public side'}, {l: 'Games', r: 1}, {l: 'Covers', r: 1}, {l: 'p-value', r: 1}], (R.public_shading || []).map(r => `<tr><td>${esc(r.proxy)}</td><td class="r num">${r.n}</td><td class="r num ${r.cover_pct < 0.5 ? 'neg' : 'pos'}">${pct(r.cover_pct, 1)}</td><td class="r num">${fx(r.p_value, 3)}</td></tr>`)))}
    ${card('How the market prices late news', 'How far the line moves for each kind of news versus what that news is actually worth.', table([{l: 'Market'}, {l: 'News'}, {l: 'Line moves', r: 1}, {l: 'Truly worth', r: 1}, {l: 'Verdict'}], (R.news_pricing || []).map(r => `<tr><td>${r.market}</td><td>${esc(r.news.replace(/_/g, ' '))}</td><td class="r num">${fx(r.beta_move, 2)}</td><td class="r num">${fx(r.beta_outcome, 2)}</td><td>${esc(r.verdict)}</td></tr>`)))}
    ${card('Key numbers', 'How often the favourite wins by exactly N when the line is near N.', table([{l: 'Margin'}, {l: 'Games', r: 1}, {l: 'Lands exactly', r: 1}, {l: 'Value of a half point', r: 1}], (R.key_numbers || []).map(r => `<tr><td>${r.number}</td><td class="r num">${r.n_games_near}</td><td class="r num">${pct(r.p_fav_wins_by_exactly, 1)}</td><td class="r num">${pct(r.win_prob_gained_per_half_point_crossing, 1)}</td></tr>`)))}
    ${card('What carries over week to week', 'Share of a team’s per-drive rate that persists into the next game.', table([{l: 'Rate'}, {l: 'Persists', r: 1}], Object.entries(R.drive_shrink || {}).map(([k, v]) => `<tr><td>${({td_rate: 'Touchdowns per drive', fg_rate: 'Field goals per drive', to_rate: 'Turnovers per drive'})[k] || k}</td><td class="r num">${pct(v.slope)}</td></tr>`)))}</div></details>`;
}

// ---------------------------------------------------------------- UPDATE
function update() {
  $('#view').innerHTML = `<div class="grid g2">${card('Refresh everything', 'Downloads the latest stats, injuries, rosters, weather and odds; rebuilds every model; re-simulates every game; records new picks in the ledger; grades finished games; and syncs your Sleeper league. Takes about 5 minutes. Best on Tuesday, then again Saturday after final injury reports.',
      `<div class="row-flex"><button class="btn primary" data-task="update">Update all</button><button class="btn" data-task="rebuild">Rebuild from saved data</button><button class="btn" data-task="market">Market snapshot</button><button class="btn" data-task="players">Rebuild games + fantasy</button><button class="btn" data-task="nhl">Update hockey only</button><button class="btn" data-task="nba">Update basketball only</button><button class="btn" data-task="ufc">Update UFC only</button><button class="btn" data-task="cfb">Update college football only</button><button class="btn" data-task="web">Publish website (Netlify)</button><button class="btn" id="openrep">Open reports folder</button></div>`)}
    ${card('Market watch', 'Takes a market snapshot every few minutes while the app is open, building the line-movement history behind steam and micro-trend signals.', `<div class="row-flex"><select id="wm" class="search"><option>10</option><option selected>15</option><option>30</option><option>60</option></select><span class="muted">minutes</span><button class="btn" id="watch">Start market watch</button><span id="watchstate" class="muted"></span></div>`)}</div>
    ${card('Progress', '', '<div class="log" id="log">No task run yet.</div>')}`;
  document.querySelectorAll('[data-task]').forEach(b => b.onclick = () => runTask(b.dataset.task));
  $('#openrep').onclick = () => api() && api().open_folder('reports');
  $('#watch').onclick = async () => { if (!api()) return; const st = await api().task_status(); const r = await api().market_watch(!st.watch_on, +$('#wm').value); $('#watch').textContent = r.watch_on ? 'Stop market watch' : 'Start market watch'; $('#watchstate').textContent = r.watch_on ? `every ${r.minutes} min` : ''; };
  poll();
}
async function runTask(kind) {
  if (!api()) { $('#view').insertAdjacentHTML('afterbegin', '<div class="verdict amber">Open the Locksmith desktop app to run updates.</div>'); return; }
  const r = await api().run_task(kind); setPill(true, r.message); if (VIEW !== 'update') go('update'); poll(true);
}
function setPill(run, txt) { const p = $('#taskpill'); p.className = 'pill ' + (run ? 'run' : 'ok'); p.textContent = txt; }
async function poll(start) {
  if (!api()) return; if (POLL && !start) return; clearInterval(POLL);
  const tick = async () => {
    const st = await api().task_status();
    const log = $('#log'); if (log) { log.textContent = st.log || 'No task run yet.'; log.scrollTop = log.scrollHeight; }
    if (st.watch_on && $('#watch')) { $('#watch').textContent = 'Stop market watch'; $('#watchstate').textContent = `every ${st.watch_minutes} min · last ${st.last_watch || '–'}`; }
    if (st.running) { setPill(true, `Running: ${st.task}`); window.__wasRunning = true; }
    else if (st.task) { setPill(false, `Done: ${st.task}`); if (window.__wasRunning) { window.__wasRunning = false; await load(); } }
  };
  await tick(); POLL = setInterval(tick, 2000);
}

// ---------------------------------------------------------------- wiring
document.addEventListener('click', e => {
  const z = e.target.closest('tr[data-bz]'); if (z) { const k = z.dataset.bz; BZ.has(k) ? BZ.delete(k) : BZ.add(k); const y = $('#view').scrollTop; game(); $('#view').scrollTop = y; return; }
  const n = e.target.closest('#nav button[data-view], #mnav button[data-view], #mlist button[data-view]'); if (n) { go(n.dataset.view); return; }
  const w = e.target.closest('#weeks .chip'); if (w) { WEEK = +w.dataset.w; GAME = books()[0]?.game_id; document.querySelectorAll('#weeks .chip').forEach(c => c.classList.toggle('on', +c.dataset.w === WEEK)); render(); }
});
$('#btn-update').onclick = () => runTask('update');
$('#btn-market').onclick = () => runTask('market');
// deep links: #fantasy, #game, #record ... ; "-light" / "-dark" suffix sets the theme for that session
(function () { const h = location.hash.slice(1).split('-'); if (TITLES[h[0]]) VIEW = h[0]; markNav(); markSport();
  if (h.includes('light') || h.includes('dark')) { document.documentElement.dataset.theme = h.includes('light') ? 'light' : 'dark'; paintTheme(); } })();
window.addEventListener('pywebviewready', () => { load(); poll(); });
if (!window.pywebview) setTimeout(() => { if (!D) load(); }, 600);
if (SPORT !== 'nfl') setTimeout(() => { if (VIEW && document.body) render(); }, 700);
