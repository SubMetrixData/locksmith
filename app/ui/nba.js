// Locksmith Basketball: the NBA side of the app (the WNBA uses the same screens). Data: reports/nba/app_data.json
// (python -m locksmith.nba.app_data). The verdict of every game comes from reports/bets.json through the gp* helpers in
// props.js: these pages repeat it and never grade anything themselves. Win chances shown are the market's unless
// reports/certificate.json says otherwise; raw-model numbers sit inside "Show the numbers".
let NB = null, BDATE = null, BGAME = null, BTAB = 'pick', BPF = {q: '', game: '', mk: ''};
const BTITLES = {slate: 'Basketball games', game: 'Basketball game', watch: 'Watch basketball', props: 'Basketball props', players: 'Basketball players', record: 'Basketball record', model: 'Basketball: us vs the market', research: 'Basketball research'};
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
  const gb = BGAME != null && NB && NB.books ? NB.books.find(b => +b.game_id === +BGAME) : null;   // opened from a list: show that game's day
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
  const lgName = BLG() === 'wnba' ? 'WNBA' : 'NBA';
  $('#title').textContent = (BTITLES[VIEW] || 'Basketball').replace('Basketball', lgName);
  $('#eyebrow').textContent = BLG() === 'wnba' ? 'WNBA ' + (NB && NB.books[0] ? NB.books[0].season : '') + ' season' : 'NBA ' + (NB && NB.books[0] ? `${NB.books[0].season}-${String((NB.books[0].season + 1) % 100).padStart(2, '0')}` : '') + ' season';
  if (!NB || NB._lg !== BLG()) { $('#view').innerHTML = '<div class="card empty">Loading basketball…</div>'; await nbaLoad(); }   // league switched: load the other league
  if (!NB || NB.error || !NB.books) { $('#view').innerHTML = `<div class="card empty">${esc((NB && NB.error) || 'No basketball data yet.')}</div>`; return; }
  if (VIEW === 'game' && BGAME != null) { const gb = NB.books.find(b => +b.game_id === +BGAME); if (gb && gb.date !== BDATE) BDATE = gb.date; }   // opened from Today / Games: that game's day
  await (VIEW === 'record' ? gpTrackLoad() : gpLoad());
  $('#weeks').style.display = ['slate', 'game', 'watch', 'props', 'players'].includes(VIEW) ? '' : 'none';
  nbaChips();
  ({slate: bPicks, game: bGame, watch: bWatch, props: bProps, players: bPlayers, record: bRecord, model: bModel, research: bResearch}[VIEW] || bPicks)();
}
const bWin = b => { const tp = b.true_prob || {}; return (tp.home != null ? tp.home : (b.sim || {}).p_home) >= .5 ? b.home : b.away; };

// ---------------------------------------------------------------- GAMES: one line per game, the verdict from bets.json
function bPicks() {
  const B = bbooks(), lg = BLG(), PPB = pPlays(NB.props, B);
  const when = !BDATE ? 'scheduled right now' : dayName(BDATE) === 'Today' ? 'today' : 'on ' + dayName(BDATE);   // no dates at all: the off-season
  $('#view').innerHTML = `<div class="verdict big1">${B.length ? `${gpCount(lg, B.map(b => b.game_id))} <span class="muted">${B.length} game${B.length > 1 ? 's' : ''} ${when}.</span>` : `<b>No games ${when}.</b>`}</div>`
    + `<div class="gp-list">${B.map(b => gpRow(lg, b.game_id, {b, home: b.home, away: b.away, when: startET(b), match: `${tlogo(b.away, 20, lg)} ${esc(b.away)} @ ${esc(b.home)} ${tlogo(b.home, 20, lg)}`, attr: `data-bg="${b.game_id}"`})).join('')}</div>`
    + (PPB.length ? card('Player props', `Props that fit a tested rule. <a href="#" class="toProps">All props</a>`, pPlaysHTML(PPB, lg, B)) : '');
  document.querySelectorAll('[data-bg]').forEach(el => el.onclick = () => { BGAME = +el.dataset.bg; BTAB = 'pick'; go('game'); });
  document.querySelectorAll('.toProps').forEach(a => a.onclick = e => { e.preventDefault(); go('props'); });
}

// ---------------------------------------------------------------- GAME PAGE
// rows under the matchup: who wins (the shown chance), the spread and total (the market's lines and the projection)
function bAnswer(b, pj, ch) {
  const ln = b.lines || {}, H = b.home, A = b.away;
  const lineRow = (l, now, open, fmt, proj) => ({l, v: ok(now) ? fmt(now) : 'No line yet',
    s: [ok(now) && ok(open) && open !== now ? `opened ${fmt(open)}` : '', proj].filter(Boolean).join(' · ')});
  return answer([gpWho(ch, H, A, bTeam, pj),
    lineRow('Spread', ln.spread, ln.spread_open, v => `${esc(H)} ${spr(v)}`, pj && ok(pj.margin) ? `projected: ${esc(+pj.margin >= 0 ? H : A)} by ${fx(Math.abs(pj.margin), 1)}${gpProjBadge(pj, 'margin')}` : ''),
    lineRow('Total points', ln.total, ln.total_open, v => String(v), pj && ok(pj.total) ? `projected: ${fx(pj.total, 1)}${gpProjBadge(pj, 'total')}` : '')]);
}
function bGame() {
  const B = bbooks(), lg = BLG(); const b = B.find(x => +x.game_id === +BGAME) || B[0]; if (!b) { $('#view').innerHTML = card('No games', '', '<p class="note">No games on this day.</p>'); return; }
  BGAME = b.game_id; const H = b.home, A = b.away, G = gpGame(lg, b.game_id), pj = gpProj(G, b), ch = gpHomeChance(lg, G, b.true_prob);
  const outs = t => ((b.lineups[t] || {}).out || []).map(o => o.name).slice(0, 3).join(', ');
  const rest = b.rest || {}, b2b = [H, A].filter(t => rest[t] != null && rest[t] <= 1);
  const hero = `<div class="card"><div class="card-h"><span class="eyebrow">${dayName(b.date)} · ${startET(b)}${b.venue ? ' · ' + esc(b.venue) : ''}${b2b.length ? ` · <b class="amb">${b2b.join(' & ')} on a back-to-back</b>` : ''}</span></div>
    ${matchupHero({sport: lg, away: A, home: H, awaySub: outs(A) ? 'Out: ' + esc(outs(A)) : 'full strength', homeSub: outs(H) ? 'Out: ' + esc(outs(H)) : 'full strength', score: pj ? [pj.home, pj.away] : ['', ''], avg: null, pHome: ch ? ch.p : null})}
    ${bAnswer(b, pj, ch)}<div><button class="btn" id="bgWatch">&#9654; Watch a simulation of this game</button></div></div>`;
  $('#view').innerHTML = gpHead(lg, b.game_id) + hero + gpSides(lg, b.game_id) + bLineups(b)
    + (B.length > 1 ? card('Other games', '', gameChips(B, BGAME, 'data-bgc', lg)) : '') + gpRaw(bNumbers(b));
  document.querySelectorAll('[data-bgc]').forEach(el => el.onclick = () => { BGAME = +el.dataset.bgc; bGame(); window.scrollTo(0, 0); });
  $('#bgWatch').onclick = () => { BW.gid = b.game_id; go('watch'); };
}
// everything from Locksmith's own simulation and model: the raw numbers, behind "Show the numbers"
function bNumbers(b) {
  const s = b.sim || {}, H = b.home, A = b.away, br = b.brief || {}, ln = b.lines || {}, tp = b.true_prob || {};
  const pm = tp.model != null ? tp.model : s.p_home_model;
  const raw = table([{l: ''}, {l: 'Raw model', r: 1}], [
    pm != null ? `<tr><td>${esc(H)} win chance</td><td class="r num">${pct(pm, 1)}</td></tr>` : '',
    ok(b.margin) ? `<tr><td>Winning margin</td><td class="r num">${esc(+b.margin >= 0 ? H : A)} by ${fx(Math.abs(b.margin), 1)}</td></tr>` : '',
    ok(b.total) ? `<tr><td>Total points</td><td class="r num">${fx(b.total, 1)}</td></tr>` : '',
    ok(ln.total) && s.p_over != null ? `<tr><td>Over ${ln.total}</td><td class="r num">${pct(s.p_over, 1)}</td></tr>` : '',
    ok(ln.spread) && s.p_home_cover != null ? `<tr><td>${esc(H)} ${spr(ln.spread)} covers</td><td class="r num">${pct(s.p_home_cover, 1)}</td></tr>` : '',
    s.p_ot != null ? `<tr><td>Overtime</td><td class="r num">${pct(s.p_ot, 1)}</td></tr>` : ''].filter(Boolean));
  const fct = (br.factors || []).map(x => `<div class="factor"><h4>${esc(x.title)}</h4><p>${esc(x.text)}</p><div class="ptag">${x.pts >= 0.2 ? `<b>+${fx(x.pts, 1)} pts</b> for ${esc(bTeam(x.favors))}` : '<span class="muted">context</span>'}</div></div>`).join('');
  const priced = ((b.pricing || {}).bets || []).length ? table([{l: 'Bet'}, {l: 'Price', r: 1}, {l: 'Raw model', r: 1}, {l: 'Fair price', r: 1}, {l: 'Value', r: 1}],
    b.pricing.bets.map(r => `<tr><td>${esc(r.label)}</td><td class="r num">${am(r.price)}</td><td class="r num">${pct(r.prob, 1)}</td><td class="r num">${amFair(r.prob)}</td><td class="r num">${sgn(100 * r.ev, 1)}%</td></tr>`)) : '';
  const alts = Object.entries(s.alt_spreads || {}).map(([k, p]) => `<tr><td>${H} ${k.replace('-', '−')}</td><td class="r num">${pct(p, 1)}</td><td class="r num">${amFair(p)}</td></tr>`);
  const altt = Object.entries(s.alt_totals || {}).map(([k, p]) => `<tr><td>Over ${k}</td><td class="r num">${pct(p, 1)}</td><td class="r num">${amFair(p)}</td></tr>`);
  const wb = s.win_by || {};
  const team = s.mean ? table([{l: ''}, {l: A, r: 1}, {l: H, r: 1}], [
    `<tr><td>Average points (simulation)</td><td class="r num">${fx(s.mean[1], 1)}</td><td class="r num">${fx(s.mean[0], 1)}</td></tr>`,
    s.quarters ? `<tr><td>By quarter</td><td class="r num">${s.quarters[1].map(x => fx(x, 0)).join(' / ')}</td><td class="r num">${s.quarters[0].map(x => fx(x, 0)).join(' / ')}</td></tr>` : '',
    s.halves ? `<tr><td>First half</td><td class="r num">${fx(s.halves.h1[1], 1)}</td><td class="r num">${fx(s.halves.h1[0], 1)}</td></tr>` : '',
    s.a_pct ? `<tr><td>80% range</td><td class="r num">${fx(s.a_pct[0], 0)}–${fx(s.a_pct[4], 0)}</td><td class="r num">${fx(s.h_pct[0], 0)}–${fx(s.h_pct[4], 0)}</td></tr>` : '',
    `<tr><td>Possessions</td><td class="r num" colspan="2">${fx(b.pace, 1)} each</td></tr>`].filter(Boolean)) : '';
  const pl = t => table([{l: 'Player'}, {l: 'MIN', r: 1}, {l: 'PTS', r: 1}, {l: 'REB', r: 1}, {l: 'AST', r: 1}, {l: '3PM', r: 1}],
    ((b.players || {})[t] || []).map(p => `<tr><td><b>${esc(p.name)}</b> <span class="muted">${p.pos}</span>${p.starter ? ' <span class="badge info">starter</span>' : ''}${p.q ? ' <span class="badge warn">questionable</span>' : ''}</td><td class="r num">${fx(p.min, 0)}</td><td class="r num"><b>${fx(p.pts, 1)}</b></td><td class="r num">${fx(p.reb, 1)}</td><td class="r num">${fx(p.ast, 1)}</td><td class="r num">${fx(p.fg3m, 1)}</td></tr>`));
  // (no brief.bottom_line here: it carries its own "no bet clears the bar" verdict, and the only verdict is the first line)
  return card('The raw model on this game', '', raw) + (team ? card('Simulated box score', 'The average of 20,000 simulated games.', team) : '')
    + (fct ? card('Why the raw model leans the way it does', 'Each factor and how many points it is worth to which team.', fct) : '')
    + `<div class="grid g2">${priced ? card('Raw model vs the posted price', '', priced) : ''}${card('Winning margin', '', table([{l: 'Outcome'}, {l: 'Chance', r: 1}], [[`${H} by 1–5`, wb['1-5']], [`${H} by 6–10`, wb['6-10']], [`${H} by 11+`, wb['11+']], [`${A} by 1–5`, wb['a1-5']], [`${A} by 6–10`, wb['a6-10']], [`${A} by 11+`, wb['a11+']], ['Overtime', s.p_ot]].map(r => `<tr><td>${r[0]}</td><td class="r num">${pct(r[1], 1)}</td></tr>`)))}
      ${alts.length ? card('Alternate spreads', '', table([{l: 'Line'}, {l: 'Covers', r: 1}, {l: 'Fair', r: 1}], alts, {h: 420})) : ''}${altt.length ? card('Alternate totals', '', table([{l: 'Line'}, {l: 'Over', r: 1}, {l: 'Fair', r: 1}], altt, {h: 420})) : ''}</div>`
    + `<div class="grid g2">${card(`${esc(bTeam(A))} players`, 'Projected for tonight’s rotation.', pl(A))}${card(`${esc(bTeam(H))} players`, '', pl(H))}</div>`;
}
function bLineups(b) {
  const sec = t => { const L = (b.lineups || {})[t] || {};
    return `<p class="note"><b>${esc(bTeam(t))}.</b> Out: ${(L.out || []).map(o => `${esc(o.name)} <span class="muted">(${esc(o.status)}${o.detail ? ', ' + esc(o.detail) : ''})</span>`).join(' · ') || 'nobody'}. Questionable (assumed to play): ${(L.questionable || []).map(o => esc(o.name)).join(', ') || 'nobody'}.</p>`; };
  return card('Injuries', 'From the latest injury report. Check again before tip-off.', sec(b.away) + sec(b.home));
}
function bBox(b) { return bNumbers(b); }          // kept for older callers: the box score now lives in "Show the numbers"
function bOdds(b) { return gpSides(BLG(), b.game_id); }

// ---------------------------------------------------------------- PROPS / PLAYERS
function bProps() { propsView({P: NB.props || {}, books: bbooks(), sport: BLG(), name: 'basketball', rerender: bProps}); }

function bPlayers() {
  const rows = []; bbooks().forEach(b => [b.home, b.away].forEach(t => (b.players[t] || []).forEach(p => rows.push({...p, team: t, opp: t === b.home ? b.away : '@ ' + b.home}))));
  const q = window.__bpq || '', sk = window.__bps || 'pts';
  const R = rows.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase())).sort((a, z) => (z[sk] || 0) - (a[sk] || 0));
  const MT = (NB.props || {}).model_test || {}, IM = (NB.impact || {}).top || [];
  $('#view').innerHTML = `<div class="verdict big1"><b>${rows.length} players</b> in ${bbooks().length} games ${dayName(BDATE) === 'Today' ? 'today' : 'on ' + dayName(BDATE)}. Each line is Locksmith’s projection from minutes and production: who is out tonight, the opponent, the game total and spread, rest and recent form.</div>`
    + card('Projected player lines', `Tap a column name to sort.`, `<div class="row-flex"><input id="bpq" class="search" placeholder="Search for a player…" value="${esc(q)}"><span class="muted">${R.length} players</span></div>`
      + `<div class="tbl" style="max-height:720px"><table><thead><tr><th>Player</th><th>Team</th>${[['min', 'MIN'], ['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['fg3m', '3PM'], ['stl', 'STL'], ['blk', 'BLK'], ['pra', 'PRA']].map(([k, l]) => `<th class="r sort" data-bps="${k}">${l}</th>`).join('')}</tr></thead><tbody>`
      + R.slice(0, 400).map(p => `<tr><td><span class="pcell">${hshot(BLG(), p.id, p.name, 28)}<b>${esc(p.name)}</b> <span class="muted">${p.pos}</span>${p.q ? ' <span class="badge warn">Q</span>' : ''}</span></td><td>${tlogo(p.team, 18, 'nba')} ${p.team} <span class="muted">vs ${p.opp}</span></td><td class="r num">${fx(p.min, 0)}</td><td class="r num"><b>${fx(p.pts, 1)}</b></td><td class="r num">${fx(p.reb, 1)}</td><td class="r num">${fx(p.ast, 1)}</td><td class="r num">${fx(p.fg3m, 1)}</td><td class="r num">${fx(p.stl, 1)}</td><td class="r num">${fx(p.blk, 1)}</td><td class="r num">${fx(p.pra, 1)}</td></tr>`).join('') + '</tbody></table></div>')
    + `<div class="grid g2">${MT.stats ? card('How close are these projections?', `Every player-game of ${MT.seasons[0]}-${String((MT.seasons[MT.seasons.length - 1] + 1) % 100).padStart(2, '0')} (${MT.player_games.toLocaleString()}), each season projected by a model trained only on earlier seasons. Average miss: lower is better.`,
      table([{l: 'Stat'}, {l: 'Locksmith', r: 1}, {l: 'Old model', r: 1}, {l: 'Recent average', r: 1}], ['pts', 'reb', 'ast', 'fg3m', 'stl', 'blk', 'pra'].filter(k => MT.stats[k]).map(k => { const v = MT.stats[k]; return `<tr><td>${PSTAT.nba[k]}</td><td class="r num"><b>${fx(v.mae_locksmith, 2)}</b></td><td class="r num">${fx(v.mae_v1, 2)}</td><td class="r num">${fx(v.mae_recent_avg, 2)}</td></tr>`; }))
      + (MT.mae_minutes ? `<p class="note">Minutes: average miss ${fx(MT.mae_minutes.locksmith, 2)} (recent average: ${fx(MT.mae_minutes.recent_avg, 2)}).</p>` : '')) : ''}
      ${IM.length ? card('Most impactful players right now', 'Points per 100 possessions added on offence and saved on defence, adjusted for teammates and opponents.', table([{l: 'Player'}, {l: 'Offence', r: 1}, {l: 'Defence', r: 1}, {l: 'Total', r: 1}],
        IM.slice(0, 15).map(x => `<tr><td><b>${esc(x.name)}</b></td><td class="r num">${sgn(x.off, 1)}</td><td class="r num">${sgn(-x.def, 1)}</td><td class="r num"><b>${sgn(x.net, 1)}</b></td></tr>`))) : ''}</div>`;
  $('#bpq').oninput = () => { clearTimeout(window.__bpt); window.__bpt = setTimeout(() => { window.__bpq = $('#bpq').value; bPlayers(); const x = $('#bpq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 220); };
  document.querySelectorAll('[data-bps]').forEach(th => th.onclick = () => { window.__bps = th.dataset.bps; bPlayers(); });
}

// ---------------------------------------------------------------- RECORD / MODEL / RESEARCH
// the live record of real logged bets leads; the backtest follows, labelled as past games
function bRecord() {
  const lg = BLG(), LG = lg.toUpperCase(), BT = NB.backtest || {}, E = BT.early || {}, O = E.overall || {}, BS = E.by_season || {}, C = (BT.closing || {}).overall || {};
  const yrs = Object.keys(BS), up = yrs.filter(k => BS[k].units > 0).length, sn = k => lg === 'wnba' ? String(k) : `${k}-${String((+k + 1) % 100).padStart(2, '0')}`;
  const acc = (BT.accuracy || []).filter(a => a.with_lines);
  const c = (NB.calib || {}).nba_at_close;
  $('#view').innerHTML = gpLiveRecord(lg, {name: LG})
    + gpPast(O.bets ? `The ${LG} line-move rules (${lg === 'wnba' ? 'spreads, totals and moneylines where its model disagreed with the opening line' : 'spreads and totals its line-move model expected to move its way'})${lg === 'nba' ? '; only the totals passed the accuracy certificate, so spreads are not bet' : ''}, replayed on past seasons at the opening line: <b>${O.wins}-${O.losses}</b>, ${sgn(100 * O.roi, 1)}% a bet, money made in ${up} of ${yrs.length} seasons. Each season used only rules that had worked before it.` : 'No backtest for these bets yet.')
    + (c ? `<p class="note">Only at the opening line: graded at the line on game day, the same kind of bets won ${pct(c.win_close, 1)} of ${c.bets.toLocaleString()} (−110 needs 52.4%), against ${pct(c.win_open, 1)} at the opener. That is why a bet only appears while today’s line is still at the opener.</p>` : '')
    + (O.bets ? `<div class="tiles">${tile(`${O.wins}-${O.losses}`, 'past bets won–lost')}${tile(sgn(100 * O.roi, 1) + '%', 'return a bet', O.roi >= 0 ? 'good' : 'bad')}${E.beat_close != null ? tile(pct(E.beat_close), 'line moved our way') : ''}</div>` : '')
    + gpRaw(`<div class="grid g2">${card('Profit over time', 'Every past bet the strategy made, in order (units).', equitySVG(E.equity))}
      ${card('Season by season', '', table([{l: 'Season'}, {l: 'Record', r: 1}, {l: 'Units', r: 1}, {l: 'Return', r: 1}, {l: 'Line moved our way', r: 1}], yrs.map(k => { const x = BS[k]; return `<tr><td>${sn(k)}${+k === Math.max(...yrs.map(Number)) ? ' <span class="muted">(so far)</span>' : ''}</td><td class="r num">${x.wins}-${x.losses}${x.pushes ? '-' + x.pushes : ''}</td><td class="r num ${x.units >= 0 ? 'pos' : 'neg'}">${sgn(x.units, 1)}</td><td class="r num">${sgn(100 * x.roi, 1)}%</td><td class="r num">${x.beat_close != null ? pct(x.beat_close) : '–'}</td></tr>`; })))}</div>
    ${card('Latest past bets graded', '', table([{l: 'Date'}, {l: 'Bet'}, {l: 'Result'}, {l: 'Units', r: 1}], (E.recent || []).map(x => `<tr><td class="muted">${esc(String(x.date).slice(0, 10))}</td><td>${esc(x.label)}</td><td><span class="badge ${x.profit > 0 ? 'good' : x.profit < 0 ? 'bad' : ''}">${x.profit > 0 ? 'win' : x.profit < 0 ? 'loss' : 'push'}</span></td><td class="r num ${x.profit >= 0 ? 'pos' : 'neg'}">${sgn(x.profit, 2)}</td></tr>`), {h: 420}))}
    ${acc.length ? card('Average miss against the closing line, season by season', 'Points; lower is better. Locksmith never saw the season it is graded on.',
      table([{l: 'Season'}, {l: 'Games', r: 1}, {l: 'Margin: Locksmith / line', r: 1}, {l: 'Total: Locksmith / line', r: 1}],
        acc.map(a => `<tr><td>${sn(a.season)}</td><td class="r num">${a.with_lines}</td><td class="r num">${fx(a.mae_margin_stack_same, 2)} / ${fx(a.mae_margin_close, 2)}</td><td class="r num">${fx(a.mae_total_stack, 2)} / ${fx(a.mae_total_close, 2)}</td></tr>`))) : ''}
    <p class="note">Betting at the closing line instead: ${C.bets ? `${C.bets} past bets, ${sgn(100 * C.roi, 1)}% a bet` : 'no rule survived the test'}.</p>`, 'The backtest in detail (past games, not live bets).');
}
function bModel() {
  const lg = BLG(), LG = lg.toUpperCase(), BT = NB.backtest || {}, W = NB.wp || {}, PT = NB.proj_test || {};
  const acc = (BT.accuracy || []).filter(a => a.with_lines);
  const avg = k => acc.length ? acc.reduce((s, a) => s + (a[k] || 0), 0) / acc.length : null;
  const mL = avg('mae_margin_stack_same'), mC = avg('mae_margin_close');
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> ${mL != null ? `on past ${LG} games, Locksmith missed the final margin by ${fx(mL, 2)} points on average and the closing line by ${fx(mC, 2)}, so ${mL < mC ? 'Locksmith was a little closer' : 'the closing line was as close or closer'}. Win chances shown in the app are the market’s unless a test on unseen games says Locksmith’s beat it.` : 'Not enough graded games yet.'}</div>`
    + gpRaw(`<div class="tiles">${tile(fx(mL, 2) + ' pts', 'Locksmith margin miss')}${tile(fx(mC, 2) + ' pts', 'closing spread miss')}${tile(fx(avg('mae_total_stack'), 1) + ' / ' + fx(avg('mae_total_close'), 1), 'total miss: Locksmith / line')}</div>`
      + `<div class="grid g2">${W.logloss ? card('In-game win model', `Trained on every play of ${esc(W.train_seasons)}, tested on ${W.n_test_states.toLocaleString()} game states of ${esc(W.test_season)}. Compared with a pregame-only estimate, not with live betting prices.`, table([{l: 'Model'}, {l: 'Log loss', r: 1}, {l: 'Brier', r: 1}], [
        `<tr><td><b>Locksmith in-game model</b></td><td class="r num"><b>${fx(W.logloss.locksmith_live, 3)}</b></td><td class="r num">${fx(W.brier.locksmith_live, 3)}</td></tr>`, `<tr><td>Pregame estimate only</td><td class="r num">${fx(W.logloss.pregame_only, 3)}</td><td class="r num">${fx(W.brier.pregame_only, 3)}</td></tr>`])) : ''}
      ${PT.by_stat ? card('Player projections', 'Over/under accuracy at each player’s typical line (log loss, lower is better).', table([{l: 'Stat'}, {l: 'Locksmith', r: 1}, {l: 'Season average', r: 1}], Object.entries(PT.by_stat).map(([k, v]) => `<tr><td>${k.toUpperCase()}</td><td class="r num">${fx(v.ll_locksmith, 4)}</td><td class="r num">${fx(v.ll_season_avg, 4)}</td></tr>`))) : ''}</div>`, 'How the model was tested (past games).');
}
function bResearch() {
  const icon = {works: '✓', doesnt: '✗', neutral: '•', lesson: '!'};
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> every idea below was tested on past ${BLG().toUpperCase()} games and betting lines. ${typeof lkUsedHTML === 'function' ? lkUsedHTML(BLG(), BLG().toUpperCase()) : 'These are tests on past games, not live bets.'}</div><div class="legend rlegend"><span><b class="ic works">✓</b> held up on past games</span><span><b class="ic doesnt">✗</b> doesn’t work</span><span><b class="ic neutral">•</b> not shown to work</span></div>`
    + `<div class="grid g2">${(NB.findings || []).map(f => `<div class="card"><div class="finding"><span class="ic ${f.verdict}">${icon[f.verdict] || '•'}</span><div><h3>${esc(f.title)}</h3><p class="note">${esc(gpWords(f.text))}</p></div></div></div>`).join('')}</div>`;
}
