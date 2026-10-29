// Locksmith Basketball: the NBA side of the app. Data: reports/nba/app_data.json (python -m locksmith.nba.app_data).
let NB = null, BDATE = null, BGAME = null, BTAB = 'pick', BPF = {q: '', game: '', mk: ''};
const BTITLES = {slate: 'Basketball picks', game: 'Basketball games', watch: 'Watch basketball', props: 'Basketball props', players: 'Basketball players', record: 'Basketball track record', model: 'Basketball model accuracy', research: 'Basketball research'};
const NBA_COL = {ATL: ['#E03A3E', '#C1D32F'], BOS: ['#007A33', '#BA9653'], BKN: ['#111111', '#FFFFFF'], CHA: ['#1D1160', '#00788C'], CHI: ['#CE1141', '#111111'], CLE: ['#860038', '#FDBB30'],
  DAL: ['#00538C', '#B8C4CA'], DEN: ['#0E2240', '#FEC524'], DET: ['#C8102E', '#1D42BA'], GS: ['#1D428A', '#FFC72C'], HOU: ['#CE1141', '#111111'], IND: ['#002D62', '#FDBB30'],
  LAC: ['#C8102E', '#1D428A'], LAL: ['#552583', '#FDB927'], MEM: ['#5D76A9', '#12173F'], MIA: ['#98002E', '#F9A01B'], MIL: ['#00471B', '#EEE1C6'], MIN: ['#0C2340', '#78BE20'],
  NO: ['#0C2340', '#C8102E'], NY: ['#006BB6', '#F58426'], OKC: ['#007AC1', '#EF3B24'], ORL: ['#0077C0', '#C4CED4'], PHI: ['#006BB6', '#ED174C'], PHX: ['#1D1160', '#E56020'],
  POR: ['#E03A3E', '#111111'], SAC: ['#5A2D81', '#63727A'], SA: ['#C4CED4', '#111111'], TOR: ['#CE1141', '#111111'], UTAH: ['#002B5C', '#F9A01B'], WSH: ['#002B5C', '#E31837']};
const bTeam = t => (NB && NB.teamname && NB.teamname[t]) || t;
const bCol = (t, k = 0) => (NBA_COL[t] || ['#888', '#444'])[k];
const bbooks = () => (NB ? NB.books.filter(b => b.date === BDATE) : []);
const BPN = {pts: 'Points', reb: 'Rebounds', ast: 'Assists', fg3m: 'Threes', pra: 'Pts + reb + ast'};
const spr = v => !ok(v) ? '–' : v === 0 ? 'PK' : (v > 0 ? '+' : '−') + Math.abs(v);

// the same basketball screens serve the NBA and the WNBA: BLG() is the league on screen, NBC caches each league's data
const BLG = () => (typeof SPORT !== 'undefined' && SPORT === 'wnba') ? 'wnba' : 'nba';
const NBC = {};
async function bbData(lg) {          // a league's data without touching the screen's league (the game plan reads both)
  if (NBC[lg]) return NBC[lg];
  const api = window.pywebview && window.pywebview.api, fn = lg === 'wnba' ? 'get_wnba' : 'get_nba';
  try { NBC[lg] = (api && api[fn]) ? await api[fn]() : await (await fetch(`../../reports/${lg}/app_data.json`, {cache: 'no-store'})).json(); }
  catch (e) { NBC[lg] = {error: String(e), books: []}; }
  if (NBC[lg] && !NBC[lg].books) NBC[lg].books = [];
  NBC[lg]._lg = lg;
  return NBC[lg];
}
async function nbaLoad() {
  const lg = BLG();
  if (NB && NB._lg === lg) return NB;
  if (NB && NB._lg !== lg) BDATE = null;
  NB = await bbData(lg);
  const gb = BGAME != null && NB && NB.books ? NB.books.find(b => +b.game_id === +BGAME) : null;   // opened from the game plan: show that game's day
  if (gb) BDATE = gb.date; else if (NB && NB.books && BGAME != null && !NB.books.some(b => +b.game_id === +BGAME)) BGAME = null;
  if (NB && !NB.error) { const ds = [...new Set(NB.books.map(b => b.date))].sort(); if (!BDATE || !ds.includes(BDATE)) { const td = new Date().toLocaleDateString('en-CA'); BDATE = ds.find(d => d >= td) || ds[ds.length - 1]; } }
  return NB;
}
function nbaChips() {
  const ds = [...new Set(NB.books.map(b => b.date))].sort();
  $('#weeks').innerHTML = ds.map(d => `<button class="chip${d === BDATE ? ' on' : ''}" data-bd="${d}">${dayName(d)}</button>`).join('');
  document.querySelectorAll('[data-bd]').forEach(c => c.onclick = () => { BDATE = c.dataset.bd; BGAME = bbooks()[0] && bbooks()[0].game_id; nbaRender(); });
}
async function nbaRender() {
  $('#title').textContent = (BLG() === 'wnba' ? (BTITLES[VIEW] || 'Basketball').replace('Basketball', 'WNBA') : (BTITLES[VIEW] || 'Basketball'));
  $('#eyebrow').textContent = BLG() === 'wnba' ? 'WNBA ' + (NB && NB.books[0] ? NB.books[0].season : '') + ' season' : 'NBA ' + (NB && NB.books[0] ? `${NB.books[0].season}-${String((NB.books[0].season + 1) % 100).padStart(2, '0')}` : '') + ' season';
  if (!NB || NB._lg !== BLG()) { $('#view').innerHTML = '<div class="card empty">Loading basketball…</div>'; await nbaLoad(); }   // league switched: load the other league
  if (!NB || NB.error || !NB.books) { $('#view').innerHTML = `<div class="card empty">${esc((NB && NB.error) || 'No basketball data yet.')}</div>`; return; }
  $('#weeks').style.display = ['slate', 'game', 'watch', 'props', 'players'].includes(VIEW) ? '' : 'none';
  nbaChips();
  ({slate: bPicks, game: bGame, watch: bWatch, props: bProps, players: bPlayers, record: bRecord, model: bModel, research: bResearch}[VIEW] || bPicks)();
}
const bPick = b => (b.pricing && b.pricing.pick) || {bet: 'Pass'};
const bWin = b => b.sim.p_home >= .5 ? b.home : b.away;

// ---------------------------------------------------------------- PICKS
function bPicks() {
  const B = bbooks(), bets = B.filter(b => bPick(b).bet !== 'Pass').sort((a, z) => (bPick(z).stars - bPick(a).stars) || (bPick(z).edge - bPick(a).edge));
  const E = (NB.backtest || {}).early || {}, o = E.overall || {}, PPB = pPlays(NB.props, B);
  const row = b => { const p = bPick(b); return ticket({sport: BLG(), away: b.away, home: b.home, when: startET(b), bet: p.bet, chance: p.win_chance, chanceLabel: 'to cover', stars: p.stars, note: p.history ? esc(p.history) : '', attrs: `data-bg="${b.game_id}"`}); };
  const gameRow = b => { const s = b.sim, w = bWin(b), f = b.pred_final, ln = b.lines || {};
    return `<tr class="click" data-bg="${b.game_id}"><td>${b.away} at ${b.home} <span class="muted">${startET(b)}</span></td><td><b>${w} ${Math.max(...f)}–${Math.min(...f)}</b></td><td class="r num">${pct(Math.max(s.p_home, 1 - s.p_home))}</td>
      <td class="r num">${b.home} ${spr(-Math.round(b.margin * 2) / 2)}<span class="muted"> / ${ok(ln.spread) ? spr(ln.spread) : '–'}</span></td><td>${bPick(b).bet === 'Pass' ? '<span class="muted">No bet</span>' : `<b>${esc(bPick(b).bet)}</b>`}</td></tr>`; };
  $('#view').innerHTML = `<div class="verdict big1">${bets.length ? `<b>${bets.length} bet${bets.length > 1 ? 's' : ''} ${dayName(BDATE) === 'Today' ? 'today' : 'on ' + dayName(BDATE)}.</b> Best: <b>${esc(bPick(bets[0]).bet)}</b> (${bets[0].away} at ${bets[0].home}).` : `<b>No bets ${dayName(BDATE) === 'Today' ? 'today' : 'on ' + dayName(BDATE)}.</b>`}</div>
    ${o.bets ? `<div class="verdict blue"><b>Track record of these bets:</b> ${o.wins}-${o.losses}, ${sgn(o.units, 0)} units (${sgn(100 * o.roi, 1)}%) since 2022-23, each season chosen with earlier data only. <a href="#" id="toRecB">See the record</a></div>` : ''}
    <div class="verdict amber"><b>Only at the opening number.</b> Locksmith’s ${BLG().toUpperCase()} edge is the opening spread: it predicts where spreads move, and once they move the edge is gone (at the game-day line these bets were a coin flip). Each pick below is still at the opener; if your book’s line is worse, skip it. Check the injury report before tip-off; Questionable players are assumed to play.</div>`
    + (() => { const T = B.filter(b => bPick(b).thin); return T.length ? card('Only at a better price', 'These fit Locksmith’s early-line rule, but the line has already moved. Bets like them have won less often than today’s price needs, so they are bets only at the price shown or better.', `<div class="tickets">${T.map(b => { const p = bPick(b); return ticket({sport: BLG(), away: b.away, home: b.home, when: startET(b), bet: p.thin, chance: p.win_chance_hist, chanceLabel: 'won', note: `Playable at <b>${am(p.playable_at)}</b> or better (needs ${pct(p.breakeven, 1)} at today’s price)`, attrs: `data-bg="${b.game_id}"`}); }).join('')}</div>`) : ''; })()
    + (bets.length ? card('Bets worth making', `${TAP} one to see why. ${gl('stars', 'Stars')} = how strong. % = ${gl('chance', 'chance it covers')}.`, `<div class="tickets">${bets.map(row).join('')}</div>`) : '')
    + (PPB.length ? card('Player props', `Tested ${gl('prop', 'player bets')}: each fits a rule that made money on earlier days. <a href="#" class="toProps">All props</a>`, pPlaysHTML(PPB, BLG(), B)) : '')
    + card(`Every game ${dayName(BDATE) === 'Today' ? 'today' : dayName(BDATE)}`, `Predicted final score, chance to win, ${gl('spread', 'spread')} (Locksmith / sportsbook) and the bet.`, table([{l: 'Game'}, {l: 'Prediction'}, {l: 'Win chance', r: 1}, {l: 'Spread', r: 1}, {l: 'Bet'}], B.map(gameRow)));
  document.querySelectorAll('[data-bg]').forEach(el => el.onclick = () => { BGAME = +el.dataset.bg; BTAB = 'pick'; go('game'); });
  const tr = $('#toRecB'); if (tr) tr.onclick = e => { e.preventDefault(); go('record'); };
  document.querySelectorAll('.toProps').forEach(a => a.onclick = e => { e.preventDefault(); go('props'); });
}

// ---------------------------------------------------------------- GAME CENTER
function bAnswer(b) {
  const s = b.sim, ln = b.lines || {}, H = b.home, A = b.away, w = bWin(b), f = b.pred_final, p = bPick(b);
  const lsp = -Math.round(b.margin * 2) / 2;
  return answer([
    {l: 'Who wins', v: `${esc(bTeam(w))} ${Math.max(...f)}–${Math.min(...f)}`, s: `${pct(Math.max(s.p_home, 1 - s.p_home))} chance to win · ${pct(s.p_ot)} chance of overtime`},
    {l: gl('spread', 'Spread'), v: `Locksmith: ${H} ${spr(lsp)}`, s: ok(ln.spread) ? `sportsbook: ${H} ${spr(ln.spread)}${ok(ln.spread_open) && ln.spread_open !== ln.spread ? ` (opened ${spr(ln.spread_open)})` : ''} · ${Math.abs(lsp - ln.spread) < 1 ? 'about the same' : `${fx(Math.abs(lsp - ln.spread), 1)} pts apart`}` : 'no line yet'},
    {l: gl('total', 'Total points'), v: `Locksmith: ${fx(b.total, 1)}`, s: ok(ln.total) ? `sportsbook: ${ln.total} · over ${pct(s.p_over)}` : 'no line yet'},
    {l: 'The bet', v: p.bet !== 'Pass' ? esc(p.bet) + ' ' + starHTML(p.stars) : 'No bet', s: p.bet !== 'Pass' ? `${pct(p.win_chance)} chance to cover (what bets like this have won) · bet early, before the line moves` : p.thin ? `${esc(p.thin)} only at ${am(p.playable_at)} or better: the line has moved past it` : p.moved ? (p.at_open ? `${esc(p.at_open)} was the bet at the opener; today’s line is worse, so it is not a bet now` : 'the line already moved to Locksmith’s number') : `no ${gl('edge')} big enough against the opening line`, cls: p.bet !== 'Pass' ? 'go' : 'pass'}]);
}
function bGame() {
  const B = bbooks(); const b = B.find(x => x.game_id === BGAME) || B[0]; if (!b) { $('#view').innerHTML = card('No games', '', '<p class="note">No games on this day.</p>'); return; }
  BGAME = b.game_id; const H = b.home, A = b.away, s = b.sim, hw = s.p_home >= .5, f = b.pred_final;
  const outs = t => (b.lineups[t].out || []).map(o => o.name).slice(0, 3).join(', ');
  const head = `${gameChips(B, BGAME, 'data-bgc', BLG())}
    <div class="card"><div class="card-h"><span class="eyebrow">${dayName(b.date)} · ${startET(b)} · ${esc(b.venue || '')}${b.rest[H] <= 1 || b.rest[A] <= 1 ? ` · <b class="amb">${[H, A].filter(t => b.rest[t] <= 1).join(' & ')} on a back-to-back</b>` : ''}</span></div>
    ${matchupHero({sport: BLG(), away: A, home: H, awaySub: outs(A) ? 'Out: ' + esc(outs(A)) : 'full strength', homeSub: outs(H) ? 'Out: ' + esc(outs(H)) : 'full strength', score: f, avg: s.mean, pHome: s.p_home})}${bAnswer(b)}<div><button class="btn primary" id="bgWatch">&#9654; Watch this game, every possession</button></div></div>`;
  const tabs = [['pick', 'The pick'], ['box', 'Box score'], ['odds', 'Odds'], ['lineups', 'Lineups & injuries']];
  const body = BTAB === 'box' ? bBox(b) : BTAB === 'odds' ? bOdds(b) : BTAB === 'lineups' ? bLineups(b) : bBrief(b);
  $('#view').innerHTML = head + `<div class="tabs">${tabs.map(t => `<button data-bt="${t[0]}" class="${t[0] === BTAB ? 'on' : ''}">${t[1]}</button>`).join('')}</div>` + body;
  document.querySelectorAll('[data-bgc]').forEach(el => el.onclick = () => { BGAME = +el.dataset.bgc; bGame(); });
  document.querySelectorAll('[data-bt]').forEach(el => el.onclick = () => { BTAB = el.dataset.bt; bGame(); });
  $('#bgWatch').onclick = () => { BW.gid = b.game_id; go('watch'); };
}
function bBrief(b) {
  const br = b.brief, tp = br.the_pick || {bet: 'Pass'};
  const pick = `<div class="pickbox ${tp.bet === 'Pass' ? 'pass' : ''}"><div><span class="eyebrow">The pick</span><div class="pickbet">${tp.bet === 'Pass' ? 'No bet' : esc(tp.bet)}</div>${starHTML(tp.stars)}</div>
    <div>${tp.bet === 'Pass' ? (tp.thin ? `${esc(tp.why_pass)} It is still a bet at <b>${am(tp.playable_at)} or better</b>.${tp.history ? ` <span class="muted">${esc(tp.history)}.</span>` : ''}` : tp.moved ? `Locksmith disagreed with the opening spread${tp.at_open ? ` (${esc(tp.at_open)})` : ''}, but the line has moved since. In testing, these bets only won when placed at the opening number; at the game-day line they were a coin flip. Bet it only if a book still offers ${tp.at_open ? esc(tp.at_open) : 'the opening line'} or better.` : 'Locksmith agrees with the opening spread, so there is nothing to bet.') : `Locksmith’s margin is ${fx(tp.edge, 1)} points away from the opening spread and still ${fx(tp.edge_now, 1)} from today’s. In testing, spreads like this moved toward Locksmith, and these bets made money in every full season since 2022. Bet it now.<br><span class="muted">${tp.history ? esc(tp.history) + ' · ' : ''}Locksmith’s simulations alone say ${pct(tp.win_chance_model)} · suggested stake ${fx(100 * (tp.stake_pct || 0), 2)}% of your bankroll</span>`}</div></div>`;
  const fct = br.factors.map(x => `<div class="factor"><h4>${esc(x.title)}</h4><p>${esc(x.text)}</p><div class="ptag">${x.pts >= 0.2 ? `<b style="color:${bCol(x.favors)}">+${fx(x.pts, 1)} pts</b>for ${esc(bTeam(x.favors))}` : '<span class="muted">context</span>'}</div></div>`).join('');
  return card('The answer', '', `<div class="bigscore">${esc(bTeam(br.winner))} ${br.score[0]}, ${esc(bTeam(br.loser))} ${br.score[1]} <span class="conf ${br.confidence}" style="vertical-align:middle">${br.confidence} · ${pct(br.win_prob)}</span></div>${pick}<div class="verdict blue">${esc(br.bottom_line)}</div>`)
    + card('Why', 'Every factor in plain English, and how many points it is worth to which team.', fct);
}
function bBox(b) {
  const H = b.home, A = b.away, s = b.sim;
  const team = table([{l: ''}, {l: A, r: 1}, {l: H, r: 1}], [
    `<tr><td>Predicted final</td><td class="r num"><b>${b.pred_final[1]}</b></td><td class="r num"><b>${b.pred_final[0]}</b></td></tr>`,
    `<tr><td>Average points</td><td class="r num">${fx(s.mean[1], 1)}</td><td class="r num">${fx(s.mean[0], 1)}</td></tr>`,
    `<tr><td>By quarter</td><td class="r num">${s.quarters[1].map(x => fx(x, 0)).join(' / ')}</td><td class="r num">${s.quarters[0].map(x => fx(x, 0)).join(' / ')}</td></tr>`,
    `<tr><td>First half</td><td class="r num">${fx(s.halves.h1[1], 1)}</td><td class="r num">${fx(s.halves.h1[0], 1)}</td></tr>`,
    `<tr><td>80% range</td><td class="r num">${fx(s.a_pct[0], 0)}–${fx(s.a_pct[4], 0)}</td><td class="r num">${fx(s.h_pct[0], 0)}–${fx(s.h_pct[4], 0)}</td></tr>`,
    `<tr><td>Possessions</td><td class="r num" colspan="2">${fx(b.pace, 1)} each</td></tr>`]);
  const pl = t => table([{l: 'Player'}, {l: 'MIN', r: 1}, {l: 'PTS', r: 1}, {l: 'REB', r: 1}, {l: 'AST', r: 1}, {l: '3PM', r: 1}, {l: 'STL', r: 1}, {l: 'BLK', r: 1}, {l: 'PRA', r: 1}],
    (b.players[t] || []).map(p => `<tr><td><b>${esc(p.name)}</b> <span class="muted">${p.pos}</span>${p.starter ? ' <span class="badge info">starter</span>' : ''}${p.q ? ' <span class="badge warn">questionable</span>' : ''}</td><td class="r num">${fx(p.min, 0)}</td><td class="r num"><b>${fx(p.pts, 1)}</b></td><td class="r num">${fx(p.reb, 1)}</td><td class="r num">${fx(p.ast, 1)}</td><td class="r num">${fx(p.fg3m, 1)}</td><td class="r num">${fx(p.stl, 1)}</td><td class="r num">${fx(p.blk, 1)}</td><td class="r num">${fx(p.pra, 1)}</td></tr>`));
  return `<div class="boxtop">${card('Team totals', 'The average of 20,000 simulated games.', team)}${card('How it was built', '', `<p class="note">Each player: his recent minutes (redistributed when a teammate is out) × his per-minute production × tonight’s opponent and pace. Player points add up to the team’s simulated points.</p>`)}</div>
    ${card(`${bTeam(A)} players`, 'Projected for tonight’s rotation.', pl(A))}${card(`${bTeam(H)} players`, '', pl(H))}`;
}
function bOdds(b) {
  const s = b.sim, H = b.home;
  const priced = (b.pricing.bets || []).length ? table([{l: 'Bet'}, {l: 'Price', r: 1}, {l: 'Locksmith', r: 1}, {l: 'Fair price', r: 1}, {l: 'Value', r: 1}],
    b.pricing.bets.map(r => `<tr><td>${esc(r.label)}</td><td class="r num">${am(r.price)}</td><td class="r num">${pct(r.prob, 1)}</td><td class="r num">${amFair(r.prob)}</td><td class="r num ${r.ev > 0 ? 'pos' : 'neg'}">${sgn(100 * r.ev, 1)}%</td></tr>`)) : '<p class="note">Lines not posted yet.</p>';
  const alts = Object.entries(s.alt_spreads).map(([k, p]) => `<tr><td>${H} ${k.replace('-', '−')}</td><td class="r num">${pct(p, 1)}</td><td class="r num">${amFair(p)}</td></tr>`);
  const altt = Object.entries(s.alt_totals).map(([k, p]) => `<tr><td>Over ${k}</td><td class="r num">${pct(p, 1)}</td><td class="r num">${amFair(p)}</td></tr>`);
  const wb = s.win_by || {};
  return `<div class="grid g2">${card('Priced against the sportsbook', 'Locksmith’s chance vs the posted price.', priced)}
    ${card('Winning margin', '', table([{l: 'Outcome'}, {l: 'Chance', r: 1}], [[`${H} by 1–5`, wb['1-5']], [`${H} by 6–10`, wb['6-10']], [`${H} by 11+`, wb['11+']], [`${b.away} by 1–5`, wb['a1-5']], [`${b.away} by 6–10`, wb['a6-10']], [`${b.away} by 11+`, wb['a11+']], ['Overtime', s.p_ot]].map(r => `<tr><td>${r[0]}</td><td class="r num">${pct(r[1], 1)}</td></tr>`)))}
    ${card('Alternate spreads', '', table([{l: 'Line'}, {l: 'Covers', r: 1}, {l: 'Fair', r: 1}], alts, {h: 420}))}${card('Alternate totals', '', table([{l: 'Line'}, {l: 'Over', r: 1}, {l: 'Fair', r: 1}], altt, {h: 420}))}</div>`;
}
function bLineups(b) {
  const sec = t => { const L = b.lineups[t];
    return card(bTeam(t), `Lineup strength tonight vs normal: ${sgn(L.delta, 1)} points per 100 possessions (player impact of the expected rotation).`,
      `<p class="note"><b>Out:</b> ${(L.out || []).map(o => `${esc(o.name)} <span class="muted">(${esc(o.status)}${o.detail ? ', ' + esc(o.detail) : ''}, ~${fx(o.min, 0)} min a game)</span>`).join(' · ') || 'nobody'}<br><b>Questionable / day-to-day (assumed to play):</b> ${(L.questionable || []).map(o => esc(o.name)).join(', ') || 'nobody'}</p>`); };
  return `<div class="grid g2">${sec(b.away)}${sec(b.home)}</div>`;
}

// ---------------------------------------------------------------- PROPS / PLAYERS
function bProps() { propsView({P: NB.props || {}, books: bbooks(), sport: BLG(), name: 'basketball', rerender: bProps}); }

function bPlayers() {
  const rows = []; bbooks().forEach(b => [b.home, b.away].forEach(t => (b.players[t] || []).forEach(p => rows.push({...p, team: t, opp: t === b.home ? b.away : '@ ' + b.home}))));
  const q = window.__bpq || '', sk = window.__bps || 'pts';
  const R = rows.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase())).sort((a, z) => (z[sk] || 0) - (a[sk] || 0));
  const MT = (NB.props || {}).model_test || {}, IM = (NB.impact || {}).top || [];
  $('#view').innerHTML = `<div class="verdict big1"><b>${rows.length} players</b> in ${bbooks().length} games ${dayName(BDATE) === 'Today' ? 'today' : 'on ' + dayName(BDATE)}. Each line: a learned model of minutes and production — who is out tonight, the opponent’s defence at the player’s position, the game total and spread, rest and recent form.</div>`
    + card('Projected player lines', `Tap a column name to sort.`, `<div class="row-flex"><input id="bpq" class="search" placeholder="Search for a player…" value="${esc(q)}"><span class="muted">${R.length} players</span></div>`
      + `<div class="tbl" style="max-height:720px"><table><thead><tr><th>Player</th><th>Team</th>${[['min', 'MIN'], ['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['fg3m', '3PM'], ['stl', 'STL'], ['blk', 'BLK'], ['pra', 'PRA']].map(([k, l]) => `<th class="r sort" data-bps="${k}">${l}</th>`).join('')}</tr></thead><tbody>`
      + R.slice(0, 400).map(p => `<tr><td><span class="pcell">${hshot(BLG(), p.id, p.name, 28)}<b>${esc(p.name)}</b> <span class="muted">${p.pos}</span>${p.q ? ' <span class="badge warn">Q</span>' : ''}</span></td><td>${tlogo(p.team, 18, 'nba')} ${p.team} <span class="muted">vs ${p.opp}</span></td><td class="r num">${fx(p.min, 0)}</td><td class="r num"><b>${fx(p.pts, 1)}</b></td><td class="r num">${fx(p.reb, 1)}</td><td class="r num">${fx(p.ast, 1)}</td><td class="r num">${fx(p.fg3m, 1)}</td><td class="r num">${fx(p.stl, 1)}</td><td class="r num">${fx(p.blk, 1)}</td><td class="r num">${fx(p.pra, 1)}</td></tr>`).join('') + '</tbody></table></div>')
    + `<div class="grid g2">${MT.stats ? card('How accurate are these projections?', `Every player-game of ${MT.seasons[0]}-${String((MT.seasons[MT.seasons.length - 1] + 1) % 100).padStart(2, '0')} (${MT.player_games.toLocaleString()}), each season projected by a model trained only on earlier seasons. Average miss: lower is better.`,
      table([{l: 'Stat'}, {l: 'Locksmith', r: 1}, {l: 'Old model', r: 1}, {l: 'Recent average', r: 1}], ['pts', 'reb', 'ast', 'fg3m', 'stl', 'blk', 'pra'].filter(k => MT.stats[k]).map(k => { const v = MT.stats[k]; return `<tr><td>${PSTAT.nba[k]}</td><td class="r num pos"><b>${fx(v.mae_locksmith, 2)}</b></td><td class="r num">${fx(v.mae_v1, 2)}</td><td class="r num">${fx(v.mae_recent_avg, 2)}</td></tr>`; }))
      + `<p class="note">Minutes: average miss ${fx(MT.mae_minutes.locksmith, 2)} (recent average: ${fx(MT.mae_minutes.recent_avg, 2)}).</p>`) : ''}
      ${IM.length ? card('Most impactful players right now', 'Points per 100 possessions added on offence and saved on defence, adjusted for teammates and opponents.', table([{l: 'Player'}, {l: 'Offence', r: 1}, {l: 'Defence', r: 1}, {l: 'Total', r: 1}],
        IM.slice(0, 15).map(x => `<tr><td><b>${esc(x.name)}</b></td><td class="r num">${sgn(x.off, 1)}</td><td class="r num">${sgn(-x.def, 1)}</td><td class="r num"><b>${sgn(x.net, 1)}</b></td></tr>`))) : ''}</div>`;
  $('#bpq').oninput = () => { clearTimeout(window.__bpt); window.__bpt = setTimeout(() => { window.__bpq = $('#bpq').value; bPlayers(); const x = $('#bpq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 220); };
  document.querySelectorAll('[data-bps]').forEach(th => th.onclick = () => { window.__bps = th.dataset.bps; bPlayers(); });
}

// ---------------------------------------------------------------- RECORD / MODEL / RESEARCH
function bRecord() {
  const BT = NB.backtest || {}, E = BT.early || {}, O = E.overall || {}, BS = E.by_season || {}, C = (BT.closing || {}).overall || {};
  const yrs = Object.keys(BS), up = yrs.filter(k => BS[k].units > 0).length, sn = k => `${k}-${String((+k + 1) % 100).padStart(2, '0')}`;
  const acc = (BT.accuracy || []).filter(a => a.with_lines);
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> the bets Locksmith publishes for the ${BLG() === 'wnba' ? 'WNBA (spreads, totals and moneylines where its model disagrees with the opening line, bet at the opening line)' : 'NBA (spreads and totals its line-move model expects to move our way, bet at the opening line)'} went <b>${O.wins}-${O.losses}</b> for <b>${sgn(O.units, 0)} ${gl('units')}</b> (${sgn(100 * O.roi, 1)}%) and made money in <b>${up} of ${yrs.length} seasons</b>.</div>
    ${expectBox(O, BS)}
    ${(() => { const c = (NB.calib || {}).nba_at_close; return c ? `<div class="verdict amber"><b>Only at the opening line.</b> These results assume each bet was placed at the opening spread. Locksmith predicts where ${BLG().toUpperCase()} lines move, so the value is gone once they do: the same kind of bets (3+ points off the opener) graded at the line on game day won <b>${pct(c.win_close, 1)}</b> of ${c.bets.toLocaleString()} (needs 52.4% at −110), vs ${pct(c.win_open, 1)} at the opener. So a pick only appears while today’s line is still at the opening number or better.</div>` : ''; })()}
    <p class="note">How this was tested: each season used only betting rules that had already worked before it, and only the lineup known when the line opened (the players from each team’s previous game). Graded at −110 at the opening line. ${pct(E.beat_close)} of these bets got a better number than the ${gl('closing', 'closing line')}.</p>
    <div class="tiles">${tile(`${O.wins}-${O.losses}`, 'bets won–lost')}${tile(sgn(O.units, 0), 'units, 1 unit per bet', O.units >= 0 ? 'good' : 'bad')}${tile(sgn(100 * O.roi, 1) + '%', 'return on money staked', O.roi >= 0 ? 'good' : 'bad')}${tile(pct(E.beat_close), 'beat the closing line', 'good')}</div>
    <div class="grid g2">${card('Profit over time', 'Every bet the strategy made, in order.', equitySVG(E.equity))}
      ${card('Season by season', '', table([{l: 'Season'}, {l: 'Record', r: 1}, {l: 'Units', r: 1}, {l: 'Return', r: 1}, {l: 'Worth (line moves)', r: 1}, {l: 'Beat the close', r: 1}], yrs.map(k => { const x = BS[k]; return `<tr><td>${sn(k)}${+k === Math.max(...yrs.map(Number)) ? ' <span class="muted">(so far)</span>' : ''}</td><td class="r num">${x.wins}-${x.losses}${x.pushes ? '-' + x.pushes : ''}</td><td class="r num ${x.units >= 0 ? 'pos' : 'neg'}">${sgn(x.units, 1)}</td><td class="r num">${sgn(100 * x.roi, 1)}%</td><td class="r num">${x.exp_roi != null ? sgn(100 * x.exp_roi, 1) + '%' : '–'}</td><td class="r num">${pct(x.beat_close)}</td></tr>`; })))}</div>
    ${card('Latest graded bets', '', table([{l: 'Date'}, {l: 'Bet'}, {l: 'Edge', r: 1}, {l: 'Result'}, {l: 'Units', r: 1}], (E.recent || []).map(x => `<tr><td class="muted">${esc(String(x.date).slice(0, 10))}</td><td>${esc(x.label)}</td><td class="r num">${fx(x.edge, 1)} pts</td><td><span class="badge ${x.profit > 0 ? 'good' : x.profit < 0 ? 'bad' : ''}">${x.profit > 0 ? 'win' : x.profit < 0 ? 'loss' : 'push'}</span></td><td class="r num ${x.profit >= 0 ? 'pos' : 'neg'}">${sgn(x.profit, 2)}</td></tr>`), {h: 420}))}
    ${card('Accuracy against the closing line, season by season', 'Average miss on the final margin and total (points). Locksmith never saw the season it is graded on.',
      table([{l: 'Season'}, {l: 'Games', r: 1}, {l: 'Margin: Locksmith / line', r: 1}, {l: 'Total: Locksmith / line', r: 1}, {l: 'Winners: Locksmith / line', r: 1}],
        acc.map(a => `<tr><td>${sn(a.season)}</td><td class="r num">${a.with_lines}</td><td class="r num">${fx(a.mae_margin_stack_same, 2)} / ${fx(a.mae_margin_close, 2)}</td><td class="r num">${fx(a.mae_total_stack, 2)} / ${fx(a.mae_total_close, 2)}</td><td class="r num">${pct(a.winner_stack)} / ${pct(a.winner_close)}</td></tr>`))
      + `<p class="note">At tip-off the closing line is sharper: it has the late injury news. That is why Locksmith bets the ${BLG().toUpperCase()} early.</p>`)}
    <details class="more"><summary>What didn’t work: betting at the closing line, and early totals</summary>${card('Not used', '', `<p class="note">Closing-line rules that survived the season-by-season test: ${C.bets || 0} bets (${C.bets ? sgn(100 * C.roi, 1) + '%' : 'none survived'}). Early totals lost money in testing, so Locksmith only bets ${BLG().toUpperCase()} spreads.</p>`)}</details>`;
}
function bModel() {
  const BT = NB.backtest || {}, W = NB.wp || {}, PT = NB.proj_test || {};
  const acc = (BT.accuracy || []).filter(a => a.with_lines);
  const avg = k => acc.length ? acc.reduce((s, a) => s + (a[k] || 0), 0) / acc.length : null;
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> Locksmith misses ${BLG().toUpperCase()} margins by ${fx(avg('mae_margin_stack_same'), 2)} points on average against ${fx(avg('mae_margin_close'), 2)} for the closing spread, its player projections beat season averages, and its live odds beat the pregame line by a wide margin.</div>`
    + `<div class="tiles">${tile(fx(avg('mae_margin_stack_same'), 2) + ' pts', 'Locksmith margin miss')}${tile(fx(avg('mae_margin_close'), 2) + ' pts', 'closing spread miss')}${tile(fx(avg('mae_total_stack'), 1) + ' / ' + fx(avg('mae_total_close'), 1), 'total miss: Locksmith / line')}${W.logloss ? tile(fx(W.logloss.locksmith_live, 3), `live odds log loss (pregame only ${fx(W.logloss.pregame_only, 3)})`, 'good') : ''}</div>`
    + `<div class="grid g2">${W.logloss ? card('Live odds', `Trained on every play of ${esc(W.train_seasons)}, tested on ${W.n_test_states.toLocaleString()} game states of ${esc(W.test_season)}.`, table([{l: 'Model'}, {l: 'Log loss', r: 1}, {l: 'Brier', r: 1}], [
        `<tr><td><b>Locksmith live model</b></td><td class="r num"><b>${fx(W.logloss.locksmith_live, 3)}</b></td><td class="r num">${fx(W.brier.locksmith_live, 3)}</td></tr>`, `<tr><td>Pregame line only</td><td class="r num">${fx(W.logloss.pregame_only, 3)}</td><td class="r num">${fx(W.brier.pregame_only, 3)}</td></tr>`])) : ''}
      ${PT.by_stat ? card('Player projections', 'Over/under accuracy (log loss, lower is better) at each player’s typical line.', table([{l: 'Stat'}, {l: 'Locksmith', r: 1}, {l: 'Season average', r: 1}], Object.entries(PT.by_stat).map(([k, v]) => `<tr><td>${k.toUpperCase()}</td><td class="r num pos">${fx(v.ll_locksmith, 4)}</td><td class="r num">${fx(v.ll_season_avg, 4)}</td></tr>`))) : ''}</div>`;
}
function bResearch() {
  const icon = {works: '✓', doesnt: '✗', neutral: '•', lesson: '!'};
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> every idea below was tested on real ${BLG().toUpperCase()} games and real betting lines since 2018. Only the ✓ ones are used.</div><div class="legend rlegend"><span><b class="ic works">✓</b> works, used</span><span><b class="ic doesnt">✗</b> doesn’t work</span><span><b class="ic neutral">•</b> not proven</span></div>`
    + `<div class="grid g2">${(NB.findings || []).map(f => `<div class="card"><div class="finding"><span class="ic ${f.verdict}">${icon[f.verdict] || '•'}</span><div><h3>${esc(f.title)}</h3><p class="note">${esc(f.text)}</p></div></div></div>`).join('')}</div>`;
}
