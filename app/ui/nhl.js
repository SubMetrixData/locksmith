// Locksmith Hockey: the NHL side of the app. Data: reports/nhl/app_data.json (python -m locksmith.nhl.app_data).
// Uses the shared helpers from app.js (card, table, tile, answer, gl, pct, fx, sgn, esc) and the game-page helpers in props.js
// (gp*): every verdict comes from reports/bets.json, the win chance shown is the market's unless reports/certificate.json says
// otherwise, and raw-model numbers sit inside "Show the numbers".
let N = null, NDATE = null, NGAME = null, NTAB = 'pick', NPF = {q: '', game: '', mk: ''};
const NTITLES = {slate: 'Hockey games', game: 'Hockey game', watch: 'Watch hockey', props: 'Hockey props', players: 'Hockey players', record: 'Hockey record', model: 'Hockey: us vs the market', research: 'Hockey research'};
const NHL_COL = {ANA: ['#F47A38', '#B9975B'], BOS: ['#FFB81C', '#111111'], BUF: ['#003087', '#FFB81C'], CAR: ['#CE1126', '#111111'], CBJ: ['#002654', '#CE1126'], CGY: ['#D2001C', '#FAAF19'],
  CHI: ['#CF0A2C', '#111111'], COL: ['#6F263D', '#236192'], DAL: ['#006847', '#8F8F8C'], DET: ['#CE1126', '#FFFFFF'], EDM: ['#041E42', '#FF4C00'], FLA: ['#C8102E', '#041E42'],
  LAK: ['#111111', '#A2AAAD'], MIN: ['#154734', '#A6192E'], MTL: ['#AF1E2D', '#192168'], NJD: ['#CE1126', '#111111'], NSH: ['#FFB81C', '#041E42'], NYI: ['#00539B', '#F47D30'],
  NYR: ['#0038A8', '#CE1126'], OTT: ['#C52032', '#C2912C'], PHI: ['#F74902', '#111111'], PIT: ['#FCB514', '#111111'], SEA: ['#001628', '#99D9D9'], SJS: ['#006D75', '#EA7200'],
  STL: ['#002F87', '#FCB514'], TBL: ['#002868', '#FFFFFF'], TOR: ['#00205B', '#FFFFFF'], UTA: ['#71AFE5', '#090909'], VAN: ['#00205B', '#00843D'], VGK: ['#B4975A', '#333F42'],
  WPG: ['#041E42', '#AC162C'], WSH: ['#C8102E', '#041E42']};
const nTeam = t => (N && N.teamname && N.teamname[t]) || t;
const nCol = t => (NHL_COL[t] || ['#888', '#444'])[0];
const nbooks = () => (N ? N.books.filter(b => b.date === NDATE) : []);
const am = x => ok(x) ? (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(Math.round(x)) : '–';      // a real minus sign, as everywhere else
const amFair = p => !ok(p) || p <= 0 || p >= 1 ? '–' : p >= .5 ? '−' + Math.round(100 * p / (1 - p)) : '+' + Math.round(100 * (1 - p) / p);
const dayName = d => { const t = new Date(), dd = new Date(d + 'T12:00:00'); const diff = Math.round((dd - new Date(t.getFullYear(), t.getMonth(), t.getDate(), 12)) / 864e5);
  return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : dd.toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'}); };
const startET = b => { try { return new Date(b.start_utc).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'}); } catch (e) { return ''; } };
const PNAME = {goal: 'Anytime goal', points: 'Points', assists: 'Assists', sog: 'Shots on goal'};

async function nhlLoad() {
  if (N) return N;
  try { N = (window.pywebview && window.pywebview.api && window.pywebview.api.get_nhl) ? await window.pywebview.api.get_nhl() : await (await fetch('../../reports/nhl/app_data.json', {cache: 'no-store'})).json(); }
  catch (e) { N = {error: String(e)}; }
  if (N && !N.error) { const ds = [...new Set(N.books.map(b => b.date))].sort(); if (!NDATE || !ds.includes(NDATE)) { const td = new Date().toLocaleDateString('en-CA'); NDATE = ds.find(d => d >= td) || ds[ds.length - 1]; } }
  return N;
}
function nhlChips() {
  const ds = [...new Set(N.books.map(b => b.date))].sort();
  $('#weeks').innerHTML = ds.map(d => `<button class="chip${d === NDATE ? ' on' : ''}" data-nd="${d}">${dayName(d)}</button>`).join('');
  document.querySelectorAll('[data-nd]').forEach(c => c.onclick = () => { NDATE = c.dataset.nd; NGAME = nbooks()[0] && nbooks()[0].game_id; nhlRender(); });
}
async function nhlRender() {
  $('#title').textContent = NTITLES[VIEW] || 'Hockey';
  $('#eyebrow').textContent = 'NHL ' + (N && N.books && N.books[0] ? `${N.books[0].season}-${String((N.books[0].season + 1) % 100).padStart(2, '0')}` : '') + ' season';
  if (!N) { $('#view').innerHTML = '<div class="card empty">Loading hockey…</div>'; await nhlLoad(); }
  if (!N || N.error || !N.books) { $('#view').innerHTML = `<div class="card empty">${esc((N && N.error) || 'No hockey data yet.')}</div>`; return; }
  if (NGAME != null) { const gb = N.books.find(b => +b.game_id === +NGAME); if (gb && gb.date !== NDATE && VIEW === 'game') NDATE = gb.date; }   // opened from Today / Games: that game's day
  await (VIEW === 'record' ? gpTrackLoad() : gpLoad());
  $('#weeks').style.display = ['slate', 'game', 'watch', 'props', 'players'].includes(VIEW) ? '' : 'none';
  nhlChips();
  const f = {slate: nPicks, game: nGame, watch: nWatch, props: nProps, players: nPlayers, record: nRecord, model: nModel, research: nResearch}[VIEW] || nPicks;
  f();
}

// ---------------------------------------------------------------- GAMES: one line per game, the verdict from bets.json
function nPicks() {
  const B = nbooks(), PP = pPlays(N.props, B), when = dayName(NDATE) === 'Today' ? 'today' : 'on ' + dayName(NDATE);
  $('#view').innerHTML = `<div class="verdict big1">${B.length ? `${gpCount('nhl', B.map(b => b.game_id))} <span class="muted">${B.length} game${B.length > 1 ? 's' : ''} ${when}.</span>` : `<b>No games ${when}.</b>`}</div>`
    + `<div class="gp-list">${B.map(b => gpRow('nhl', b.game_id, {b, home: b.home, away: b.away, when: startET(b), match: `${tlogo(b.away, 20, 'nhl')} ${esc(b.away)} @ ${esc(b.home)} ${tlogo(b.home, 20, 'nhl')}`, attr: `data-ng="${b.game_id}"`})).join('')}</div>`
    + (PP.length ? card('Player props', `Props that fit a tested rule. <a href="#" class="toProps">All props</a>`, pPlaysHTML(PP, 'nhl', B)) : '');
  document.querySelectorAll('[data-ng]').forEach(el => el.onclick = () => { NGAME = +el.dataset.ng; NTAB = 'pick'; go('game'); });
  document.querySelectorAll('.toProps').forEach(a => a.onclick = e => { e.preventDefault(); go('props'); });
}

// ---------------------------------------------------------------- GAME PAGE
function nGoalieLine(b, t) { const g = (((b.box || {}).goalies || {})[t] || {}).projected; return g && g.length ? `${esc(g[0].name)} <span class="muted">(${pct(g[0].p_start)} to start)</span>` : '<span class="muted">starter unknown</span>'; }
// rows under the matchup: who wins (the shown chance), the puck line and total (the market's lines and the projection)
function nAnswer(b, pj, ch) {
  const ln = b.lines || {}, H = b.home, A = b.away;
  const plFav = ok(ln.pl_home) ? (ln.pl_home < 0 ? H : A) : null;
  return answer([gpWho(ch, H, A, nTeam, pj),
    plFav ? {l: 'Puck line', v: `${esc(plFav)} −1.5 ${am(plFav === H ? ln.pl_home_price : ln.pl_away_price)}`, s: `${esc(plFav === H ? A : H)} +1.5 ${am(plFav === H ? ln.pl_away_price : ln.pl_home_price)}`} : null,
    {l: 'Total goals', v: ok(ln.total) ? `${ln.total}` : 'No line yet', s: [ok(ln.total) && ok(ln.total_open) && ln.total_open !== ln.total ? `opened ${ln.total_open}` : '', pj && ok(pj.total) ? `projected: ${fx(pj.total, 1)} goals${gpProjBadge(pj, 'total')}` : ''].filter(Boolean).join(' · ')}]);
}
function nGame() {
  const B = nbooks(); const b = B.find(x => +x.game_id === +NGAME) || B[0]; if (!b) { $('#view').innerHTML = card('No games', '', '<p class="note">No games on this day.</p>'); return; }
  NGAME = b.game_id; const H = b.home, A = b.away, G = gpGame('nhl', b.game_id), pj = gpProj(G, b), ch = gpHomeChance('nhl', G, b.true_prob);
  const b2b = [H, A].filter(t => (b.b2b || {})[t]);
  const hero = `<div class="card"><div class="card-h"><span class="eyebrow">${dayName(b.date)} · ${startET(b)}${b.venue ? ' · ' + esc(b.venue) : ''}${b2b.length ? ` · <b class="amb">${b2b.join(' & ')} on a back-to-back</b>` : ''}</span></div>
    ${matchupHero({sport: 'nhl', away: A, home: H, awaySub: nGoalieLine(b, A), homeSub: nGoalieLine(b, H), score: pj ? [pj.home, pj.away] : ['', ''], avg: null, pHome: ch ? ch.p : null})}
    ${nAnswer(b, pj, ch)}<p class="note">Starting goalies are confirmed on game day; check before you bet.</p><div><button class="btn" id="ngWatch">&#9654; Watch a simulation of this game</button></div></div>`;
  $('#view').innerHTML = gpHead('nhl', b.game_id) + hero + gpSides('nhl', b.game_id) + nInjuries(b)
    + (B.length > 1 ? card('Other games', '', gameChips(B, NGAME, 'data-ngc', 'nhl')) : '') + gpRaw(nNumbers(b));
  document.querySelectorAll('[data-ngc]').forEach(el => el.onclick = () => { NGAME = +el.dataset.ngc; nGame(); window.scrollTo(0, 0); });
  $('#ngWatch').onclick = () => { HW.gid = b.game_id; go('watch'); };
}
function nInjuries(b) {
  const lu = b.lineups || {}, t = x => (lu[x] && (lu[x].out || []).length) ? lu[x].out.map(o => `${esc(o.name)} <span class="muted">(${esc(String(o.status || '').toLowerCase())})</span>`).join(', ') : 'nobody of note';
  return card('Injuries', 'From the latest injury report. Day-to-day players are assumed to play.', `<p class="note"><b>${esc(nTeam(b.away))}</b> out: ${t(b.away)}.<br><b>${esc(nTeam(b.home))}</b> out: ${t(b.home)}.</p>`);
}
// everything from Locksmith's own simulation and model: the raw numbers, behind "Show the numbers"
function nNumbers(b) {
  const s = b.sim || {}, H = b.home, A = b.away, bx = b.box || {}, br = b.brief || {}, tp = b.true_prob || {}, ln = b.lines || {}, rows = ((b.pricing || {}).bets || []);
  const pm = tp.model != null ? tp.model : s.p_home_model;
  const raw = table([{l: ''}, {l: 'Raw model', r: 1}], [
    pm != null ? `<tr><td>${esc(H)} win chance</td><td class="r num">${pct(pm, 1)}</td></tr>` : '',
    s.mean ? `<tr><td>Average goals</td><td class="r num">${esc(A)} ${fx(s.mean[1], 2)}, ${esc(H)} ${fx(s.mean[0], 2)}</td></tr>` : '',
    ok(s.total_mean) ? `<tr><td>Total goals</td><td class="r num">${fx(s.total_mean, 2)}</td></tr>` : '',
    ok(ln.total) && s.p_over_line != null ? `<tr><td>Over ${ln.total}</td><td class="r num">${pct(s.p_over_line / Math.max(s.p_over_line + (s.p_under_line || 0), 1e-6), 1)}</td></tr>` : '',
    s.p_ot != null ? `<tr><td>Tied after 60 minutes</td><td class="r num">${pct(s.p_ot, 1)}</td></tr>` : ''].filter(Boolean));
  const fct = (br.factors || []).map(x => `<div class="factor"><h4>${esc(x.title)}</h4><p>${esc(x.text)}</p><div class="ptag">${x.goals >= 0.02 ? `<b>+${fx(x.goals, 2)} goals</b> for ${esc(nTeam(x.favors))}` : '<span class="muted">about even</span>'}</div></div>`).join('');
  const out = (b.pricing || {}).outlook || {};
  const moves = (ok(out.ml_move_home) && Math.abs(out.ml_move_home) >= 0.01) || (ok(out.total_move) && Math.abs(out.total_move) >= 0.1)
    ? `<p class="note"><b>Where the raw model expects the line to go:</b> ${ok(out.ml_move_home) && Math.abs(out.ml_move_home) >= 0.01 ? `toward ${out.ml_move_home > 0 ? H : A} by about ${fx(100 * Math.abs(out.ml_move_home), 1)} points of win chance` : ''}${ok(out.total_move) && Math.abs(out.total_move) >= 0.1 ? `${ok(out.ml_move_home) && Math.abs(out.ml_move_home) >= 0.01 ? '; ' : ''}the total toward the ${out.total_move > 0 ? 'over' : 'under'} by about ${fx(Math.abs(out.total_move), 2)} goals` : ''}.</p>` : '';
  const priced = rows.length ? table([{l: 'Bet'}, {l: 'Price', r: 1}, {l: 'Raw model', r: 1}, {l: 'Fair price', r: 1}], rows.map(r => `<tr><td>${esc(r.label)}</td><td class="r num">${am(r.price)}</td><td class="r num">${pct(r.prob, 1)}</td><td class="r num">${amFair(r.prob)}</td></tr>`)) : '';
  const tot = Object.keys(s).filter(k => k.startsWith('p_over_') && k !== 'p_over_line').map(k => [k.slice(7), s[k]]);
  const tt = (o, team) => Object.entries(o || {}).map(([L, p]) => `<tr><td>${team} over ${L}</td><td class="r num">${pct(p, 1)}</td><td class="r num">${amFair(p)}</td></tr>`).join('');
  const ex = (s.top_scores || []).slice(0, 8).map(x => `<tr><td>${A} ${x[1]}, ${H} ${x[0]}</td><td class="r num">${pct(x[2], 1)}</td></tr>`);
  const res = table([{l: 'Outcome'}, {l: 'Chance', r: 1}, {l: 'Fair', r: 1}], [
    `<tr><td>${H} win in regulation</td><td class="r num">${pct(s.p_reg_home, 1)}</td><td class="r num">${amFair(s.p_reg_home)}</td></tr>`, `<tr><td>Tied after 60 minutes</td><td class="r num">${pct(s.p_ot, 1)}</td><td class="r num">${amFair(s.p_ot)}</td></tr>`,
    `<tr><td>${A} win in regulation</td><td class="r num">${pct(s.p_reg_away, 1)}</td><td class="r num">${amFair(s.p_reg_away)}</td></tr>`, `<tr><td>Goes to a shootout</td><td class="r num">${pct(s.p_so, 1)}</td><td class="r num">${amFair(s.p_so)}</td></tr>`,
    `<tr><td>${H} −1.5 / ${A} +1.5</td><td class="r num">${pct(s.p_home_m15, 1)} / ${pct(s.p_away_p15, 1)}</td><td class="r num">${amFair(s.p_home_m15)}</td></tr>`,
    `<tr><td>${A} −1.5 / ${H} +1.5</td><td class="r num">${pct(s.p_away_m15, 1)} / ${pct(s.p_home_p15, 1)}</td><td class="r num">${amFair(s.p_away_m15)}</td></tr>`,
    `<tr><td>Both teams score</td><td class="r num">${pct(s.btts, 1)}</td><td class="r num">${amFair(s.btts)}</td></tr>`]);
  const team = bx.sog ? table([{l: ''}, {l: A, r: 1}, {l: H, r: 1}], [
    `<tr><td>Shots on goal</td><td class="r num">${fx(bx.sog[1], 1)}</td><td class="r num">${fx(bx.sog[0], 1)}</td></tr>`,
    bx.pp_opps ? `<tr><td>Power plays</td><td class="r num">${fx(bx.pp_opps[1], 1)}</td><td class="r num">${fx(bx.pp_opps[0], 1)}</td></tr>` : '',
    bx.goalies ? `<tr><td>Goalie save %</td><td class="r num">${fx(100 * bx.goalies[A].sv_pct, 1)}%</td><td class="r num">${fx(100 * bx.goalies[H].sv_pct, 1)}%</td></tr>` : '',
    s.p_shutout ? `<tr><td>Shutout chance</td><td class="r num">${pct(s.p_shutout[1])}</td><td class="r num">${pct(s.p_shutout[0])}</td></tr>` : ''].filter(Boolean)) : '';
  const sk = t => table([{l: 'Player'}, {l: 'G', r: 1}, {l: 'A', r: 1}, {l: 'PTS', r: 1}, {l: 'SOG', r: 1}, {l: 'Goal %', r: 1, t: 'Chance to score at least once'}],
    ((bx.players || {})[t] || []).map(p => `<tr><td><b>${esc(p.name)}</b> <span class="muted">${p.pos}</span>${p.pp_unit ? ` <span class="badge info">${p.pp_unit}</span>` : ''}${p.dtd ? ' <span class="badge warn">day-to-day</span>' : ''}</td><td class="r num">${fx(p.g, 2)}</td><td class="r num">${fx(p.a, 2)}</td><td class="r num"><b>${fx(p.pts, 2)}</b></td><td class="r num">${fx(p.sog, 1)}</td><td class="r num">${pct(p.p_goal)}</td></tr>`));
  // (no brief.bottom_line here: it carries its own verdict, and the only verdict on the page is the first line)
  return `<div class="grid g2">${card('The raw model on this game', '', raw + moves)}${team ? card('Simulated box score', 'The average of 20,000 simulated games.', team) : ''}</div>`
    + (fct ? card('Why the raw model leans the way it does', 'Each factor and how many goals it is worth to which team.', fct) : '')
    + `<div class="grid g2">${priced ? card('Raw model vs the posted price', '', priced) : ''}${card('Result', '', res)}
      ${tot.length ? card('Total goals', '', table([{l: 'Line'}, {l: 'Over', r: 1}, {l: 'Fair over', r: 1}], tot.map(([L, p]) => `<tr><td>${L}</td><td class="r num">${pct(p, 1)}</td><td class="r num">${amFair(p)}</td></tr>`))) : ''}
      ${card('Team totals and exact scores', '', table([{l: 'Market'}, {l: 'Chance', r: 1}, {l: 'Fair', r: 1}], [tt(s.away_tt, A), tt(s.home_tt, H)]) + (ex.length ? table([{l: 'Exact final'}, {l: 'Chance', r: 1}], ex) : ''))}</div>`
    + `<div class="grid g2">${card(`${esc(nTeam(A))} skaters`, 'Projected for tonight’s lineup.', sk(A))}${card(`${esc(nTeam(H))} skaters`, '', sk(H))}</div>`
    + (b.ratings && b.league ? nRatings(b) : '');
}
function nBrief(b) { return gpRaw(nNumbers(b)); }   // kept for older callers
function nBox(b) { return gpRaw(nNumbers(b)); }
function nOdds(b) { return gpSides('nhl', b.game_id); }
function nRatings(b) {
  const H = b.home, A = b.away, R = b.ratings, L = b.league;
  const rows = [['5-on-5 expected goals for, per 60', 'ev_xgf', L.ev_xgf, 1], ['5-on-5 expected goals against, per 60', 'ev_xga', L.ev_xgf, -1], ['5-on-5 goals for, per 60', 'ev_gf', L.ev_gf, 1], ['5-on-5 goals against, per 60', 'ev_ga', L.ev_gf, -1],
    ['Power play: expected goals per 60', 'pp_xgf', L.pp_xgf, 1], ['Penalty kill: expected goals allowed per 60', 'pk_xga', L.pp_xgf, -1], ['Penalties taken per 60', 'pen_taken', L.pen, -1], ['Penalties drawn per 60', 'pen_drawn', L.pen, 1],
    ['Shots on goal for, per 60', 'sog_for', L.sog, 1], ['Shots on goal against, per 60', 'sog_against', L.sog, -1]];
  const bar = (v, lg, dir) => { const r = Math.max(-1, Math.min(1, (v / lg - 1) * 3 * dir)); const w = Math.abs(r) * 50; return `<span class="track"><span class="fill" style="left:${r >= 0 ? 50 : 50 - w}%;width:${w}%;background:${r >= 0 ? 'var(--win,var(--accent))' : 'var(--loss,var(--red))'}"></span></span>`; };
  return card('Team ratings', `Each team’s numbers this season and last (recent games count most), shrunk toward league average. Expected goals measure shot quality.`,
    table([{l: 'Rating'}, {l: A, r: 1}, {l: ''}, {l: H, r: 1}, {l: ''}, {l: 'League', r: 1}], rows.map(([l, k, lg, d]) => `<tr><td>${l}</td><td class="r num">${fx(R[A][k], 2)}</td><td style="width:16%">${bar(R[A][k], lg, d)}</td><td class="r num">${fx(R[H][k], 2)}</td><td style="width:16%">${bar(R[H][k], lg, d)}</td><td class="r num muted">${fx(lg, 2)}</td></tr>`)));
}

// ---------------------------------------------------------------- PROPS + PLAYERS
function nProps() { propsView({P: N.props || {}, books: nbooks(), sport: 'nhl', name: 'hockey', rerender: nProps}); }

function nPlayers() {
  const rows = [];
  nbooks().forEach(b => [b.home, b.away].forEach(t => (b.box.players[t] || []).forEach(p => rows.push({...p, team: t, opp: t === b.home ? b.away : '@ ' + b.home}))));
  const outs = []; nbooks().forEach(b => [b.home, b.away].forEach(t => ((b.lineups || {})[t] || {out: []}).out.forEach(x => outs.push({...x, team: t}))));
  const q = window.__npq || '', sk = window.__nps || 'pts', PT = N.proj_test || {}, v2 = PT.models && PT.models.v2, v1 = PT.models && PT.models['v1 (old)'], sa = PT.models && PT.models['season average'];
  const key = {pts: p => p.pts, g: p => p.g, sog: p => p.sog, goal: p => p.p_goal, toi: p => p.toi}[sk] || (p => p.pts);
  const R = rows.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase())).sort((a, z) => key(z) - key(a));
  const form = f => f ? `${f.g}-${f.a}-${f.pts} <span class="muted">in ${f.gp}</span>` : '<span class="muted">–</span>';
  $('#view').innerHTML = `<div class="verdict big1"><b>${rows.length} skaters</b> in ${nbooks().length} games ${dayName(NDATE) === 'Today' ? 'today' : 'on ' + dayName(NDATE)}. Each projection comes from his ice time at even strength and on the power play, his scoring rates in each, and tonight’s opponent and goalie.</div>`
    + (outs.length ? `<div class="verdict amber"><b>Out tonight (ESPN injury report):</b> ${outs.slice(0, 14).map(x => `${esc(x.name)} <span class="muted">${x.team}, ${esc(x.status.toLowerCase())}</span>`).join(' · ')}. Day-to-day players are assumed to play.</div>` : '')
    + card('Projected player lines', `Sorted by ${({pts: 'points', g: 'goals', sog: 'shots', goal: 'goal chance', toi: 'ice time'})[sk]}. Tap a column name to sort. Last 10 = goals-assists-points in his last 10 games.`,
      `<div class="row-flex"><input id="npq" class="search" placeholder="Search for a player…" value="${esc(q)}"><span class="muted">${R.length} players</span></div>` +
      `<div class="tbl" style="max-height:720px"><table><thead><tr><th>Player</th><th>Team</th><th>Role</th><th class="r sort" data-nps="toi">TOI</th><th class="r sort" data-nps="g">G</th><th class="r">A</th><th class="r sort" data-nps="pts">PTS</th><th class="r sort" data-nps="sog">SOG</th><th class="r sort" data-nps="goal">Goal %</th><th class="r">1+ pt</th><th class="r">Last 10</th></tr></thead><tbody>`
      + R.slice(0, 400).map(p => `<tr><td><span class="pcell">${hshot('nhl', p.id, p.name, 28)}<b>${esc(p.name)}</b> <span class="muted">${p.pos}</span>${p.dtd ? ' <span class="badge warn">day-to-day</span>' : ''}</span></td><td>${tlogo(p.team, 18, 'nhl')} ${p.team} <span class="muted">vs ${p.opp}</span></td><td>${p.pp_unit ? `<span class="badge info">${p.pp_unit}</span>` : ''}</td>
        <td class="r num">${mmss(p.toi)} <span class="muted">${p.toi_pp >= .3 ? mmss(p.toi_pp) + ' PP' : ''}</span></td><td class="r num">${fx(p.g, 2)}</td><td class="r num">${fx(p.a, 2)}</td><td class="r num"><b>${fx(p.pts, 2)}</b></td><td class="r num">${fx(p.sog, 1)}</td><td class="r num">${pct(p.p_goal)}</td><td class="r num">${pct(p.p_pt)}</td><td class="r num">${form(p.form)}</td></tr>`).join('') + '</tbody></table></div>')
    + (v2 ? gpRaw(card('How accurate are these projections?', `Tested on every one of the ${PT.player_games.toLocaleString()} player-games of ${PT.season}-${String((PT.season + 1) % 100).padStart(2, '0')}, each projected only from games before it. Log loss: lower is better.`,
      table([{l: 'Method'}, {l: 'Anytime goal', r: 1}, {l: '1+ point', r: 1}, {l: 'Over 2.5 shots', r: 1}], [['<b>Locksmith (ice time × situation rates × opponent)</b>', v2], ['Previous Locksmith method', v1], ['Player’s season average', sa]].map(([l, m]) => `<tr><td>${l}</td><td class="r num">${fx(m.goal_ll, 4)}</td><td class="r num">${fx(m.point_ll, 4)}</td><td class="r num">${fx(m.sog_over_2_5_ll, 4)}</td></tr>`))), 'How the player projections were tested (past games).') : '');
  $('#npq').oninput = () => { clearTimeout(window.__npt); window.__npt = setTimeout(() => { window.__npq = $('#npq').value; nPlayers(); const x = $('#npq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 220); };
  document.querySelectorAll('[data-nps]').forEach(th => th.onclick = () => { window.__nps = th.dataset.nps; nPlayers(); });
}

// ---------------------------------------------------------------- RECORD / MODEL / RESEARCH
// the live record of real logged bets leads; the backtest follows, labelled as past games
function nRecord() {
  const BT = N.backtest || {}, ER = BT.early || {}, O = ER.overall || {}, BS = ER.by_season || {}, BF = ER.by_family || {}, CL = BT.out_of_sample || {}, ov = BT.overall || {};
  const yrs = Object.keys(BS), up = yrs.filter(k => BS[k].units > 0).length, sn = k => `${k}-${String((+k + 1) % 100).padStart(2, '0')}`;
  const fam = {open_ml: 'Early moneylines', open_total: 'Early totals'};
  const c = (N.calib || {}).nhl_at_close;
  $('#view').innerHTML = gpLiveRecord('nhl', {name: 'NHL'})
    + gpPast(O.bets ? `The NHL bets Locksmith publishes, replayed on past seasons at the opening line: <b>${O.wins}-${O.losses}</b>, ${sgn(100 * O.roi, 1)}% a bet from ${sn(yrs[0])} on, money made in ${up} of ${yrs.length} seasons. Each season used only what was knowable when the opening line was posted; moneylines are graded at the real opening price, totals at −110 (the archive has the opening total but not its price).` : 'No backtest for these bets yet.')
    + (c ? `<p class="note">Only at the opening price: early moneylines returned ${sgn(100 * c.roi_open, 1)}% a bet at the opener but ${sgn(100 * c.roi_close, 1)}% at the game-day price (${c.bets.toLocaleString()} past bets).</p>` : '')
    + (O.bets ? `<div class="tiles">${tile(`${O.wins}-${O.losses}`, 'past bets won–lost')}${tile(sgn(100 * O.roi, 1) + '%', 'return a bet', O.roi >= 0 ? 'good' : 'bad')}${ER.beat_close != null ? tile(pct(ER.beat_close), 'line moved our way') : ''}</div>` : '')
    + gpRaw(`<div class="grid g2">${card('Profit over time', 'Every past bet, in order (units).', equitySVG(ER.equity))}
      ${card('Season by season', '', table([{l: 'Season'}, {l: 'Record', r: 1}, {l: 'Units', r: 1}, {l: 'Return', r: 1}, {l: 'Line moved our way', r: 1}],
        yrs.map(k => { const x = BS[k]; return `<tr><td>${sn(k)}${+k === Math.max(...yrs.map(Number)) ? ' <span class="muted">(so far)</span>' : ''}</td><td class="r num">${x.wins}-${x.losses}${x.pushes ? '-' + x.pushes : ''}</td><td class="r num ${x.units >= 0 ? 'pos' : 'neg'}">${sgn(x.units, 1)}</td><td class="r num">${sgn(100 * x.roi, 1)}%</td><td class="r num">${x.beat_close != null ? pct(x.beat_close) : '–'}</td></tr>`; }))
        + table([{l: 'Bet type'}, {l: 'Record', r: 1}, {l: 'Units', r: 1}, {l: 'Return', r: 1}], Object.entries(BF).map(([k, x]) => `<tr><td>${fam[k] || esc(gpFam(k))}</td><td class="r num">${x.wins}-${x.losses}</td><td class="r num ${x.units >= 0 ? 'pos' : 'neg'}">${sgn(x.units, 1)}</td><td class="r num">${sgn(100 * x.roi, 1)}%</td></tr>`)))}</div>
    ${card('Latest past bets graded', 'Newest first.', table([{l: 'Date'}, {l: 'Bet'}, {l: 'Price', r: 1}, {l: 'Result'}, {l: 'Units', r: 1}],
      (ER.recent || []).map(x => `<tr><td class="muted">${esc(String(x.date).slice(0, 10))}</td><td>${esc(x.label)}</td><td class="r num">${am(x.price)}</td><td><span class="badge ${x.profit > 0 ? 'good' : x.profit < 0 ? 'bad' : ''}">${x.profit > 0 ? 'win' : x.profit < 0 ? 'loss' : 'push'}</span></td><td class="r num ${x.profit >= 0 ? 'pos' : 'neg'}">${sgn(x.profit, 2)}</td></tr>`), {h: 460}))}
    ${card('Accuracy against the closing line, season by season', 'Log loss: lower is better; a coin flip scores 0.693. Locksmith never saw the season it is graded on.',
      table([{l: 'Season'}, {l: 'Games', r: 1}, {l: 'Locksmith', r: 1}, {l: 'Closing line', r: 1}, {l: 'Total goals miss: Locksmith / line', r: 1}],
        (BT.accuracy || []).filter(a => a.with_lines > 50).map(a => `<tr><td>${sn(a.season)}</td><td class="r num">${a.with_lines}</td><td class="r num">${fx(a.ll_stack, 4)}</td><td class="r num">${fx(a.ll_close, 4)}</td><td class="r num">${fx(a.mae_total_stack, 2)} / ${fx(a.mae_total_close, 2)}</td></tr>`))
      + `<p class="note">At game time the closing line is more accurate (${fx(ov.ll_stack, 4)} vs ${fx(ov.ll_close, 4)} over ${(ov.with_lines || 0).toLocaleString()} games), so Locksmith only bets hockey early. Bets at the closing line: ${CL.wins || 0}-${CL.losses || 0}, ${sgn(100 * (CL.roi || 0), 1)}% a bet.</p>`)}`, 'The backtest in detail (past games, not live bets).');
}

function nModel() {
  const X = N.xg || {}, W = N.wp || {}, RL = N.realism || {}, ov = (N.backtest || {}).overall || {};
  const fmt = (r, v) => v == null ? '–' : r.fmt === 'pct' ? pct(v, 1) : fx(v, r.fmt);
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> at game time the closing line is ${ov.ll_stack != null && ov.ll_stack <= ov.ll_close ? 'no more accurate than' : 'more accurate than'} Locksmith’s raw hockey win chances (tested on ${(ov.with_lines || 0).toLocaleString()} past games), so the win chances shown in the app are the market’s. Locksmith’s simulated games look like real NHL games.</div>`
    + gpRaw(`<div class="tiles">${tile(fx(ov.ll_stack, 4), 'Locksmith log loss (lower is better)')}${tile(fx(ov.ll_close, 4), 'closing-line log loss')}${X.late ? tile(fx(X.late.auc, 2), `shot model AUC on ${X.late.n_shots.toLocaleString()} shots`) : ''}</div>`
    + `<div class="grid g2">${card('Do simulated games look like real ones?', `A league-average simulated game (${(RL.n_sim || 0).toLocaleString()} of them) against ${(RL.n_real || 0).toLocaleString()} real games from the last four seasons.`,
      table([{l: 'Measure'}, {l: 'Real', r: 1}, {l: 'Simulated', r: 1}], (RL.rows || []).map(r => `<tr><td>${r.label}</td><td class="r num">${fmt(r, r.real)}</td><td class="r num"><b>${fmt(r, r.sim)}</b></td></tr>`)))}
      ${X.late ? card('Shot quality model (expected goals)', 'Cross-fitted: seasons up to 2021-22 scored by a model trained on later seasons and vice versa, so no shot is scored by a model that saw it.', table([{l: 'Test seasons'}, {l: 'Shots', r: 1}, {l: 'Goals', r: 1}, {l: 'AUC', r: 1}, {l: 'Log loss (naive)', r: 1}],
        [['2018-19 to 2021-22', X.early], ['2022-23 to now', X.late]].map(([l, x]) => `<tr><td>${l}</td><td class="r num">${x.n_shots.toLocaleString()}</td><td class="r num">${x.goals.toLocaleString()}</td><td class="r num">${fx(x.auc, 3)}</td><td class="r num">${fx(x.logloss, 4)} (${fx(x.logloss_naive, 4)})</td></tr>`))) : ''}
      ${W.logloss ? card('In-game win model', `Trained on every play of ${esc(W.train_seasons)}, tested on all ${W.n_test_states.toLocaleString()} game states of ${esc(W.test_season)}. Compared with a pregame-only estimate, not with live betting prices.`, table([{l: 'Model'}, {l: 'Log loss', r: 1}, {l: 'Brier', r: 1}], [
        `<tr><td><b>Locksmith in-game model</b></td><td class="r num"><b>${fx(W.logloss.locksmith_live, 3)}</b></td><td class="r num">${fx(W.brier.locksmith_live, 3)}</td></tr>`, `<tr><td>Pregame estimate only</td><td class="r num">${fx(W.logloss.pregame_only, 3)}</td><td class="r num">${fx(W.brier.pregame_only, 3)}</td></tr>`])
        + (W.remaining_goals_mae ? `<p class="note">Goals still to come: average miss ${fx(W.remaining_goals_mae.locksmith_live, 2)} vs ${fx(W.remaining_goals_mae.pregame_pace, 2)} for the pregame pace.</p>` : '')) : ''}</div>`, 'How the model was tested (past games).');
}
function nResearch() {
  const icon = {works: '✓', doesnt: '✗', neutral: '•', lesson: '!'};
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> every idea below was tested on past NHL games and betting lines since 2018. ${typeof lkUsedHTML === 'function' ? lkUsedHTML('nhl', 'NHL') : 'These are tests on past games, not live bets.'}</div><div class="legend rlegend"><span><b class="ic works">✓</b> held up on past games</span><span><b class="ic doesnt">✗</b> doesn’t work</span><span><b class="ic neutral">•</b> not shown to work</span><span><b class="ic lesson">!</b> lesson</span></div>`
    + `<div class="grid g2">${(N.findings || []).map(f => `<div class="card"><div class="finding"><span class="ic ${f.verdict}">${icon[f.verdict] || '•'}</span><div><h3>${esc(f.title)}</h3><p class="note">${esc(gpWords(f.text))}</p></div></div></div>`).join('')}</div>`;
}
