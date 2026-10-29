// Locksmith Hockey: the NHL side of the app. Data: reports/nhl/app_data.json (python -m locksmith.nhl.app_data).
// Uses the shared helpers from app.js (card, table, tile, answer, gl, pct, fx, sgn, esc, starHTML, ml).
let N = null, NDATE = null, NGAME = null, NTAB = 'pick', NPF = {q: '', game: '', mk: ''};
const NTITLES = {slate: 'Hockey picks', game: 'Hockey games', watch: 'Watch hockey', props: 'Hockey props', players: 'Hockey players', record: 'Hockey track record', model: 'Hockey model accuracy', research: 'Hockey research'};
const NHL_COL = {ANA: ['#F47A38', '#B9975B'], BOS: ['#FFB81C', '#111111'], BUF: ['#003087', '#FFB81C'], CAR: ['#CE1126', '#111111'], CBJ: ['#002654', '#CE1126'], CGY: ['#D2001C', '#FAAF19'],
  CHI: ['#CF0A2C', '#111111'], COL: ['#6F263D', '#236192'], DAL: ['#006847', '#8F8F8C'], DET: ['#CE1126', '#FFFFFF'], EDM: ['#041E42', '#FF4C00'], FLA: ['#C8102E', '#041E42'],
  LAK: ['#111111', '#A2AAAD'], MIN: ['#154734', '#A6192E'], MTL: ['#AF1E2D', '#192168'], NJD: ['#CE1126', '#111111'], NSH: ['#FFB81C', '#041E42'], NYI: ['#00539B', '#F47D30'],
  NYR: ['#0038A8', '#CE1126'], OTT: ['#C52032', '#C2912C'], PHI: ['#F74902', '#111111'], PIT: ['#FCB514', '#111111'], SEA: ['#001628', '#99D9D9'], SJS: ['#006D75', '#EA7200'],
  STL: ['#002F87', '#FCB514'], TBL: ['#002868', '#FFFFFF'], TOR: ['#00205B', '#FFFFFF'], UTA: ['#71AFE5', '#090909'], VAN: ['#00205B', '#00843D'], VGK: ['#B4975A', '#333F42'],
  WPG: ['#041E42', '#AC162C'], WSH: ['#C8102E', '#041E42']};
const nTeam = t => (N && N.teamname && N.teamname[t]) || t;
const nCol = t => (NHL_COL[t] || ['#888', '#444'])[0];
const nbooks = () => (N ? N.books.filter(b => b.date === NDATE) : []);
const am = x => ok(x) ? (x > 0 ? '+' : '') + Math.round(x) : '–';
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
  $('#eyebrow').textContent = 'NHL ' + (N && N.books[0] ? `${N.books[0].season}-${String((N.books[0].season + 1) % 100).padStart(2, '0')}` : '') + ' season';
  if (!N) { $('#view').innerHTML = '<div class="card empty">Loading hockey…</div>'; await nhlLoad(); }
  if (!N || N.error || !N.books) { $('#view').innerHTML = `<div class="card empty">${esc((N && N.error) || 'No hockey data yet.')}</div>`; return; }
  $('#weeks').style.display = ['slate', 'game', 'watch', 'props', 'players'].includes(VIEW) ? '' : 'none';
  nhlChips();
  const f = {slate: nPicks, game: nGame, watch: nWatch, props: nProps, players: nPlayers, record: nRecord, model: nModel, research: nResearch}[VIEW] || nPicks;
  f();
}

// ---------------------------------------------------------------- PICKS
function nPick(b) { return b.pricing && b.pricing.pick || {bet: 'Pass'}; }
function nPicks() {
  const B = nbooks(), bets = B.filter(b => nPick(b).bet !== 'Pass').sort((a, z) => (nPick(z).stars - nPick(a).stars) || ((nPick(z).edge || 0) - (nPick(a).edge || 0)));
  const PP = pPlays(N.props, nbooks());
  const allBets = N.books.filter(b => nPick(b).bet !== 'Pass');
  const row = b => { const p = nPick(b); return ticket({sport: 'nhl', away: b.away, home: b.home, when: startET(b), bet: p.bet, chance: p.win_chance, stars: p.stars, note: p.history ? esc(p.history) : '', attrs: `data-ng="${b.game_id}"`}); };
  const gameRow = b => { const s = b.sim, w = s.p_home >= .5 ? b.home : b.away, f = b.pred_final, p = nPick(b);
    return `<tr class="click" data-ng="${b.game_id}"><td>${b.away} at ${b.home} <span class="muted">${startET(b)}</span></td><td><b>${w} ${Math.max(...f)}–${Math.min(...f)}</b></td><td class="r num">${pct(Math.max(s.p_home, 1 - s.p_home))}</td><td class="r num">${fx(s.total_mean, 1)}</td><td>${p.bet === 'Pass' ? '<span class="muted">No bet</span>' : `<b>${esc(p.bet)}</b>`}</td></tr>`; };
  $('#view').innerHTML = `<div class="verdict big1">${bets.length ? `<b>${bets.length} bet${bets.length > 1 ? 's' : ''} ${dayName(NDATE).toLowerCase() === 'today' ? 'today' : 'on ' + dayName(NDATE)}.</b> Best: <b>${esc(nPick(bets[0]).bet)}</b> (${bets[0].away} at ${bets[0].home}).` : `<b>No bets ${dayName(NDATE) === 'Today' ? 'today' : 'on ' + dayName(NDATE)}.</b> ${allBets.length ? `${allBets.length} bet${allBets.length > 1 ? 's' : ''} on other days this week.` : 'Nothing clears the bar this week yet.'}`}</div>
    ${(() => { const E = (N.backtest || {}).early || {}, o = E.overall || {}; return o.bets ? `<div class="verdict blue"><b>Track record of these bets:</b> ${o.wins}-${o.losses}, ${sgn(o.units, 0)} units (${sgn(100 * o.roi, 1)}%) since 2021-22, every season chosen with earlier data only. <a href="#" id="toRec">See the record</a></div>` : ''; })()}
    <div class="verdict amber"><b>Only at the opening price.</b> In testing, early moneylines made ${(() => { const c = (N.calib || {}).nhl_at_close; return c ? `${sgn(100 * c.roi_open, 1)}% per bet at the opener but ${sgn(100 * c.roi_close, 1)}% at the game-day price (${c.bets.toLocaleString()} bets)` : 'money only at the opener'; })()}. Each pick below still beats today’s price; anything the line has moved past is listed as “only at a better price”.</div>
    <div class="verdict amber" style="display:none"><b>Bet these early.</b> Locksmith’s hockey edge is the early line: it predicts where lines move, so the value disappears once the market catches up. Starting goalies are confirmed on game day; if a different goalie starts, the pick no longer applies.</div>`
    + (() => { const T = nbooks().filter(b => nPick(b).thin); return T.length ? card('Only at a better price', 'These fit Locksmith’s early-line rule, but the line has already moved. Bets like them have won less often than today’s price needs, so they are bets only at the price shown or better.', `<div class="tickets">${T.map(b => { const p = nPick(b); return ticket({sport: 'nhl', away: b.away, home: b.home, when: startET(b), bet: p.thin, chance: p.win_chance_hist, chanceLabel: 'won', note: `Playable at <b>${am(p.playable_at)}</b> or better (needs ${pct(p.breakeven, 1)} at today’s price)`, attrs: `data-ng="${b.game_id}"`}); }).join('')}</div>`) : ''; })()
    + (bets.length ? card('Bets worth making', `${TAP} one to see why. ${gl('stars', 'Stars')} = how strong. % = ${gl('chance', 'chance it wins')}.`, `<div class="tickets">${bets.map(row).join('')}</div>`) : '')
    + (PP.length ? card('Player props', `Tested ${gl('prop', 'player bets')}: each fits a rule that made money on earlier days. <a href="#" class="toProps">All props</a>`, pPlaysHTML(PP, 'nhl', nbooks())) : '')
    + card(`Every game ${dayName(NDATE) === 'Today' ? 'today' : dayName(NDATE)}`, `Most likely final score, chance to win, average total goals and the bet.`, table([{l: 'Game'}, {l: 'Prediction'}, {l: 'Win chance', r: 1}, {l: 'Goals', r: 1}, {l: 'Bet'}], B.map(gameRow)));
  document.querySelectorAll('[data-ng]').forEach(el => el.onclick = () => { NGAME = +el.dataset.ng; NTAB = 'pick'; go('game'); });
  const tr = $('#toRec'); if (tr) tr.onclick = e => { e.preventDefault(); go('record'); };
  document.querySelectorAll('.toProps').forEach(a => a.onclick = e => { e.preventDefault(); go('props'); });
}

// ---------------------------------------------------------------- GAME CENTER
function nGoalieLine(b, t) { const g = b.box.goalies[t].projected; return g && g.length ? `${esc(g[0].name)} <span class="muted">(${pct(g[0].p_start)} to start)</span>` : '<span class="muted">starter unknown</span>'; }
function nAnswer(b) {
  const s = b.sim, ln = b.lines || {}, H = b.home, A = b.away, hw = s.p_home >= .5, W = hw ? H : A, f = b.pred_final, p = nPick(b);
  const plFav = ok(ln.pl_home) ? (ln.pl_home < 0 ? H : A) : (hw ? H : A);
  const pFav15 = plFav === H ? s.p_home_m15 : s.p_away_m15;
  const nvh = ok(ln.ml_home) && ok(ln.ml_away) ? (() => { const a = ln.ml_home < 0 ? -ln.ml_home / (-ln.ml_home + 100) : 100 / (ln.ml_home + 100), z = ln.ml_away < 0 ? -ln.ml_away / (-ln.ml_away + 100) : 100 / (ln.ml_away + 100); return a / (a + z); })() : null;
  return answer([
    {l: 'Who wins', v: `${esc(nTeam(W))} ${Math.max(...f)}–${Math.min(...f)}`, s: `${pct(Math.max(s.p_home, 1 - s.p_home))} chance to win · ${pct(s.p_ot)} chance of overtime${nvh != null ? ` · sportsbooks: ${pct(hw ? nvh : 1 - nvh)}` : ''}`},
    {l: gl('puckline', 'Puck line'), v: `${plFav} −1.5: ${pct(pFav15)}`, s: ok(ln.pl_home) ? `sportsbook price ${am(plFav === H ? ln.pl_home_price : ln.pl_away_price)} · fair ${amFair(pFav15)}` : `fair price ${amFair(pFav15)}`},
    {l: gl('total', 'Total goals'), v: `Locksmith: ${fx(s.total_mean, 1)}`, s: ok(ln.total) ? `sportsbook: ${ln.total} · over ${pct(s.p_over_line / Math.max(s.p_over_line + s.p_under_line, 1e-6))}` : 'no line posted yet'},
    {l: 'The bet', v: p.bet !== 'Pass' ? esc(p.bet) + ' ' + starHTML(p.stars) : 'No bet', s: p.bet !== 'Pass' ? `${pct(p.win_chance)} chance to win (what bets like this have won) · bet early, before the line moves` : p.thin ? `${esc(p.thin)} only at ${am(p.playable_at)} or better: the line has moved past it` : p.at_open ? `${esc(p.at_open)} was the bet at the opener; today’s total is worse, so it is not a bet now` : (ok(ln.ml_home) ? `no ${gl('edge')} big enough at today’s prices` : 'lines not posted yet'), cls: p.bet !== 'Pass' ? 'go' : 'pass'}]);
}
function nGame() {
  const B = nbooks(); let b = B.find(x => x.game_id === NGAME) || B[0]; if (!b) { $('#view').innerHTML = card('No games', '', '<p class="note">No games on this day.</p>'); return; }
  NGAME = b.game_id; const H = b.home, A = b.away, s = b.sim, hw = s.p_home >= .5, f = b.pred_final;
  const chips = gameChips(B, NGAME, 'data-ngc', 'nhl');
  const head = `<div class="card"><div class="card-h"><span class="eyebrow">${dayName(b.date)} · ${startET(b)} · ${esc(b.venue || '')}${b.b2b[H] || b.b2b[A] ? ` · <b class="amb">${[H, A].filter(t => b.b2b[t]).join(' & ')} on a back-to-back</b>` : ''}</span></div>
    ${matchupHero({sport: 'nhl', away: A, home: H, awaySub: nGoalieLine(b, A), homeSub: nGoalieLine(b, H), score: f, avg: s.mean, unit: 'goals', pHome: s.p_home})}${nAnswer(b)}<div><button class="btn primary" id="ngWatch">&#9654; Watch this game, every shot</button></div></div>`;
  const tabs = [['pick', 'The pick'], ['box', 'Box score'], ['odds', 'Odds'], ['ratings', 'Team ratings']];
  let body = '';
  if (NTAB === 'pick') body = nBrief(b); else if (NTAB === 'box') body = nBox(b); else if (NTAB === 'odds') body = nOdds(b); else body = nRatings(b);
  $('#view').innerHTML = chips + head + `<div class="tabs">${tabs.map(t => `<button data-nt="${t[0]}" class="${t[0] === NTAB ? 'on' : ''}">${t[1]}</button>`).join('')}</div>` + body;
  document.querySelectorAll('[data-ngc]').forEach(el => el.onclick = () => { NGAME = +el.dataset.ngc; nGame(); });
  document.querySelectorAll('[data-nt]').forEach(el => el.onclick = () => { NTAB = el.dataset.nt; nGame(); });
  $('#ngWatch').onclick = () => { HW.gid = b.game_id; go('watch'); };
}
function nBrief(b) {
  const br = b.brief, tp = br.the_pick || {bet: 'Pass'};
  const pick = `<div class="pickbox ${tp.bet === 'Pass' ? 'pass' : ''}"><div><span class="eyebrow">The pick</span><div class="pickbet">${tp.bet === 'Pass' ? 'No bet' : esc(tp.bet)}</div>${starHTML(tp.stars)}</div>
    <div>${tp.bet === 'Pass' ? (tp.thin ? `${esc(tp.why_pass)} It is still a bet at <b>${am(tp.playable_at)} or better</b>, so check other books.${tp.history ? ` <span class="muted">${esc(tp.history)}.</span>` : ''}` : tp.moved ? 'Locksmith disagreed with the opening line, but the line has already moved to Locksmith’s number, so the value is gone. That is the edge working: it just happened before you could bet.' : 'Locksmith agrees with the opening line, so there is nothing to bet. It only bets hockey when it disagrees with the first line posted, because that is what held up in testing.')
      : `${tp.rule === 'early_total' ? `Locksmith’s total is ${fx(Math.abs(b.total_model - ((b.lines || {}).total_open ?? (b.lines || {}).total)), 2)} goals away from the opening total` : `Locksmith gives this side ${fx(100 * tp.edge, 1)}% more than the opening line did`}. In testing, lines like this moved toward Locksmith before the game, and these bets made money in every season since 2021. Bet it now, before the line moves.<br><span class="muted">${tp.history ? esc(tp.history) + ' · ' : ''}Locksmith’s simulations alone say ${pct(tp.win_chance_model)} · suggested stake ${fx(100 * (tp.stake_pct || 0), 1)}% of your bankroll</span>`}</div></div>`;
  const fct = br.factors.map(x => `<div class="factor"><h4>${esc(x.title)}</h4><p>${esc(x.text)}</p><div class="ptag">${x.goals >= 0.02 ? `<b style="color:${nCol(x.favors)}">+${fx(x.goals, 2)} goals</b>for ${esc(nTeam(x.favors))}` : '<span class="muted">about even</span>'}</div></div>`).join('');
  const out = b.pricing.outlook || {};
  const moves = (ok(out.ml_move_home) && Math.abs(out.ml_move_home) >= 0.01) || (ok(out.total_move) && Math.abs(out.total_move) >= 0.1)
    ? `<div class="verdict blue"><b>Where the line is likely to go:</b> ${ok(out.ml_move_home) && Math.abs(out.ml_move_home) >= 0.01 ? `toward ${out.ml_move_home > 0 ? b.home : b.away} by about ${fx(100 * Math.abs(out.ml_move_home), 1)}% in win chance` : ''}${ok(out.total_move) && Math.abs(out.total_move) >= 0.1 ? `${ok(out.ml_move_home) && Math.abs(out.ml_move_home) >= 0.01 ? '; ' : ''}the total toward the ${out.total_move > 0 ? 'over' : 'under'} by about ${fx(Math.abs(out.total_move), 2)} goals` : ''}. Based on how lines moved in 2,825 tested games.</div>` : '';
  return card('The answer', '', `<div class="bigscore">${esc(nTeam(br.winner))} ${br.score[0]}, ${esc(nTeam(br.loser))} ${br.score[1]} <span class="conf ${br.confidence}" style="vertical-align:middle">${br.confidence} · ${pct(br.win_prob)}</span></div>${pick}<div class="verdict blue">${esc(br.bottom_line)}</div>${moves}`)
    + card('Why', 'Every factor in plain English, and how many goals it is worth to which team.', fct);
}
function nBox(b) {
  const H = b.home, A = b.away, s = b.sim, bx = b.box;
  const per = s.p1 ? `<p class="note">1st period: ${A} ${fx(s.p1.mean[1], 2)}, ${H} ${fx(s.p1.mean[0], 2)} goals · ${pct(s.p1.p_tied)} tied after one.</p>` : '';
  const team = table([{l: ''}, {l: A, r: 1}, {l: H, r: 1}], [
    `<tr><td>Most likely final</td><td class="r num"><b>${b.pred_final[1]}</b></td><td class="r num"><b>${b.pred_final[0]}</b></td></tr>`,
    `<tr><td>Average goals</td><td class="r num">${fx(s.mean[1], 2)}</td><td class="r num">${fx(s.mean[0], 2)}</td></tr>`,
    `<tr><td>Shots on goal</td><td class="r num">${fx(bx.sog[1], 1)}</td><td class="r num">${fx(bx.sog[0], 1)}</td></tr>`,
    `<tr><td>Power plays</td><td class="r num">${fx(bx.pp_opps[1], 1)}</td><td class="r num">${fx(bx.pp_opps[0], 1)}</td></tr>`,
    `<tr><td>Goalie save %</td><td class="r num">${fx(100 * bx.goalies[A].sv_pct, 1)}%</td><td class="r num">${fx(100 * bx.goalies[H].sv_pct, 1)}%</td></tr>`,
    `<tr><td>Saves (projected starter)</td><td class="r num">${fx(bx.goalies[A].saves_mean, 1)}</td><td class="r num">${fx(bx.goalies[H].saves_mean, 1)}</td></tr>`,
    `<tr><td>Shutout chance</td><td class="r num">${pct(s.p_shutout[1])}</td><td class="r num">${pct(s.p_shutout[0])}</td></tr>`]) + per;
  const sk = t => table([{l: 'Player'}, {l: 'G', r: 1}, {l: 'A', r: 1}, {l: 'PTS', r: 1}, {l: 'SOG', r: 1}, {l: 'Goal %', r: 1, t: 'Chance to score at least once'}, {l: 'TOI (PP)', r: 1}, {l: 'Last 10', r: 1}],
    bx.players[t].map(p => `<tr><td><b>${esc(p.name)}</b> <span class="muted">${p.pos}${p.num != null ? ' #' + p.num : ''}</span>${p.pp_unit ? ` <span class="badge info">${p.pp_unit}</span>` : ''}${p.dtd ? ' <span class="badge warn">DTD</span>' : ''}</td><td class="r num">${fx(p.g, 2)}</td><td class="r num">${fx(p.a, 2)}</td><td class="r num"><b>${fx(p.pts, 2)}</b></td><td class="r num">${fx(p.sog, 1)}</td><td class="r num">${pct(p.p_goal)}</td><td class="r num">${mmss(p.toi)}${p.toi_pp >= .3 ? ` <span class="muted">(${mmss(p.toi_pp)})</span>` : ''}</td><td class="r num">${p.form ? `${p.form.g}-${p.form.a}-${p.form.pts}` : '–'}</td></tr>`));
  const lu = b.lineups || {}, outTxt = t => (lu[t] && lu[t].out.length) ? lu[t].out.map(x => `${esc(x.name)} (${esc(x.status.toLowerCase())})`).join(', ') : 'nobody of note';
  const gk = t => { const g = bx.goalies[t].projected; return `<p class="note">${g.map(x => `<b>${esc(x.name)}</b> ${pct(x.p_start)} to start (${sgn(30 * x.rating, 2)} goals saved per game vs average)`).join(' · ') || 'Starter unknown.'} Starters are confirmed on game day.</p>`; };
  return `<div class="boxtop">${card('Team totals', 'Projected box score: the average of 20,000 simulated games. The most likely final is the single most common score.', team)}${card('Goalies', '', gk(A) + gk(H))}</div>
    ${card(`${nTeam(A)} skaters`, `Tonight’s projected lineup: their regulars minus anyone listed out. Out: ${outTxt(A)}.`, sk(A))}${card(`${nTeam(H)} skaters`, `Out: ${outTxt(H)}.`, sk(H))}`;
}
function nOdds(b) {
  const s = b.sim, H = b.home, A = b.away, rows = (b.pricing.bets || []);
  const priced = rows.length ? table([{l: 'Bet'}, {l: 'Price', r: 1}, {l: 'Locksmith', r: 1}, {l: 'Fair price', r: 1}, {l: 'Edge', r: 1}],
    rows.map(r => `<tr><td>${esc(r.label)}</td><td class="r num">${am(r.price)}</td><td class="r num">${pct(r.prob, 1)}</td><td class="r num">${amFair(r.prob)}</td><td class="r num ${(r.edge || 0) > 0 ? 'pos' : 'neg'}">${ok(r.edge) ? sgn(100 * r.edge, 1) + '%' : '–'}</td></tr>`)) : '<p class="note">Sportsbook lines are not posted for this game yet.</p>';
  const tot = Object.keys(s).filter(k => k.startsWith('p_over_') && k !== 'p_over_line').map(k => [k.slice(7), s[k]]);
  const tt = (o, team) => Object.entries(o).map(([L, p]) => `<tr><td>${team} over ${L}</td><td class="r num">${pct(p, 1)}</td><td class="r num">${amFair(p)}</td></tr>`).join('');
  const ex = (s.top_scores || []).slice(0, 8).map(x => `<tr><td>${A} ${x[1]}, ${H} ${x[0]}</td><td class="r num">${pct(x[2], 1)}</td></tr>`);
  return `<div class="grid g2">${card('Priced against the sportsbook', `Locksmith’s chance vs the posted price. ${gl('edge', 'Edge')} is against the no-vig price.`, priced)}
    ${card('Result', '', table([{l: 'Outcome'}, {l: 'Chance', r: 1}, {l: 'Fair', r: 1}], [
      `<tr><td>${H} win (incl. OT / shootout)</td><td class="r num">${pct(s.p_home, 1)}</td><td class="r num">${amFair(s.p_home)}</td></tr>`, `<tr><td>${A} win</td><td class="r num">${pct(1 - s.p_home, 1)}</td><td class="r num">${amFair(1 - s.p_home)}</td></tr>`,
      `<tr><td>${H} win in regulation</td><td class="r num">${pct(s.p_reg_home, 1)}</td><td class="r num">${amFair(s.p_reg_home)}</td></tr>`, `<tr><td>Tied after 60 minutes</td><td class="r num">${pct(s.p_ot, 1)}</td><td class="r num">${amFair(s.p_ot)}</td></tr>`,
      `<tr><td>${A} win in regulation</td><td class="r num">${pct(s.p_reg_away, 1)}</td><td class="r num">${amFair(s.p_reg_away)}</td></tr>`, `<tr><td>Goes to a shootout</td><td class="r num">${pct(s.p_so, 1)}</td><td class="r num">${amFair(s.p_so)}</td></tr>`,
      `<tr><td>${H} −1.5 / ${A} +1.5</td><td class="r num">${pct(s.p_home_m15, 1)} / ${pct(s.p_away_p15, 1)}</td><td class="r num">${amFair(s.p_home_m15)}</td></tr>`,
      `<tr><td>${A} −1.5 / ${H} +1.5</td><td class="r num">${pct(s.p_away_m15, 1)} / ${pct(s.p_home_p15, 1)}</td><td class="r num">${amFair(s.p_away_m15)}</td></tr>`,
      `<tr><td>Both teams score</td><td class="r num">${pct(s.btts, 1)}</td><td class="r num">${amFair(s.btts)}</td></tr>`]))}
    ${card('Total goals', `Average ${fx(s.total_mean, 2)} goals.`, table([{l: 'Line'}, {l: 'Over', r: 1}, {l: 'Fair over', r: 1}], tot.map(([L, p]) => `<tr><td>${L}</td><td class="r num">${pct(p, 1)}</td><td class="r num">${amFair(p)}</td></tr>`)))}
    ${card('Team totals and exact scores', '', table([{l: 'Market'}, {l: 'Chance', r: 1}, {l: 'Fair', r: 1}], [tt(s.away_tt, A), tt(s.home_tt, H)]) + table([{l: 'Exact final'}, {l: 'Chance', r: 1}], ex))}</div>`;
}
function nRatings(b) {
  const H = b.home, A = b.away, R = b.ratings, L = b.league;
  const rows = [['5-on-5 expected goals for, per 60', 'ev_xgf', L.ev_xgf, 1], ['5-on-5 expected goals against, per 60', 'ev_xga', L.ev_xgf, -1], ['5-on-5 goals for, per 60', 'ev_gf', L.ev_gf, 1], ['5-on-5 goals against, per 60', 'ev_ga', L.ev_gf, -1],
    ['Power play: xG per 60', 'pp_xgf', L.pp_xgf, 1], ['Penalty kill: xG allowed per 60', 'pk_xga', L.pp_xgf, -1], ['Penalties taken per 60', 'pen_taken', L.pen, -1], ['Penalties drawn per 60', 'pen_drawn', L.pen, 1],
    ['Shots on goal for, per 60', 'sog_for', L.sog, 1], ['Shots on goal against, per 60', 'sog_against', L.sog, -1]];
  const bar = (v, lg, dir) => { const r = Math.max(-1, Math.min(1, (v / lg - 1) * 3 * dir)); const w = Math.abs(r) * 50; return `<span class="track"><span class="fill" style="left:${r >= 0 ? 50 : 50 - w}%;width:${w}%;background:${r >= 0 ? 'var(--accent)' : 'var(--red)'}"></span></span>`; };
  return card('Team ratings', `Each team’s numbers this season and last (recent games count most), shrunk toward league average. Green = better than average, red = worse. ${gl('xg', 'Expected goals')} measure shot quality.`,
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
    + (v2 ? card('How accurate are these projections?', `Tested on every one of the ${PT.player_games.toLocaleString()} player-games of ${PT.season}-${String((PT.season + 1) % 100).padStart(2, '0')}, each projected only from games before it. ${gl('logloss', 'Log loss')}: lower is better.`,
      table([{l: 'Method'}, {l: 'Anytime goal', r: 1}, {l: '1+ point', r: 1}, {l: 'Over 2.5 shots', r: 1}], [['<b>Locksmith (ice time × situation rates × opponent)</b>', v2], ['Previous Locksmith method', v1], ['Player’s season average', sa]].map(([l, m]) => `<tr><td>${l}</td><td class="r num">${fx(m.goal_ll, 4)}</td><td class="r num">${fx(m.point_ll, 4)}</td><td class="r num">${fx(m.sog_over_2_5_ll, 4)}</td></tr>`))) : '');
  $('#npq').oninput = () => { clearTimeout(window.__npt); window.__npt = setTimeout(() => { window.__npq = $('#npq').value; nPlayers(); const x = $('#npq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 220); };
  document.querySelectorAll('[data-nps]').forEach(th => th.onclick = () => { window.__nps = th.dataset.nps; nPlayers(); });
}

// ---------------------------------------------------------------- TRACK RECORD / MODEL / RESEARCH
function nRecord() {
  const BT = N.backtest || {}, ER = BT.early || {}, O = ER.overall || {}, BS = ER.by_season || {}, BF = ER.by_family || {}, CL = BT.out_of_sample || {}, ov = BT.overall || {};
  const yrs = Object.keys(BS), up = yrs.filter(k => BS[k].units > 0).length, sn = k => `${k}-${String((+k + 1) % 100).padStart(2, '0')}`;
  const fam = {open_ml: 'Early moneylines', open_total: 'Early totals'};
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> the bets Locksmith publishes went <b>${O.wins}-${O.losses}</b> for <b>${sgn(O.units, 0)} ${gl('units')}</b> (${sgn(100 * O.roi, 1)}% ${gl('roi', 'return')}) from ${sn(yrs[0])} to today, and made money in <b>${up} of ${yrs.length} seasons</b>.</div>
    ${expectBox(O, BS)}
    <p class="note">How this was tested: every season used only what was knowable when the opening line was posted (the expected goalie from recent starts, the previous game's lineup); moneylines only when the price was predicted to move Locksmith's way, totals only by rules that had already worked in earlier seasons. Moneylines are graded at the real opening price; totals at −110 because the archive stores the opening total but not its price. The key trust signal is the ${gl('clv', 'closing line')}: ${pct(ER.beat_close)} of these bets got a better number than the final price.</p>
    <div class="tiles">${tile(`${O.wins}-${O.losses}`, 'bets won–lost')}${tile(sgn(O.units, 0), 'units, 1 unit per bet', O.units >= 0 ? 'good' : 'bad')}${tile(sgn(100 * O.roi, 1) + '%', 'return on money staked', O.roi >= 0 ? 'good' : 'bad')}${tile(`${up} of ${yrs.length}`, 'winning seasons', 'good')}</div>
    <div class="grid g2">${card('Profit over time', 'Every published-style bet, in order.', equitySVG(ER.equity))}
      ${card('Season by season', '', table([{l: 'Season'}, {l: 'Record', r: 1}, {l: 'Units', r: 1}, {l: 'Return', r: 1}, {l: 'Worth (line moves)', r: 1}, {l: 'Beat the close', r: 1}],
        yrs.map(k => { const x = BS[k]; return `<tr><td>${sn(k)}${+k === Math.max(...yrs.map(Number)) ? ' <span class="muted">(so far)</span>' : ''}</td><td class="r num">${x.wins}-${x.losses}${x.pushes ? '-' + x.pushes : ''}</td><td class="r num ${x.units >= 0 ? 'pos' : 'neg'}">${sgn(x.units, 1)}</td><td class="r num">${sgn(100 * x.roi, 1)}%</td><td class="r num">${x.exp_roi != null ? sgn(100 * x.exp_roi, 1) + '%' : '–'}</td><td class="r num">${x.beat_close != null ? pct(x.beat_close) : '–'}</td></tr>`; }))
        + table([{l: 'Bet type'}, {l: 'Record', r: 1}, {l: 'Units', r: 1}, {l: 'Return', r: 1}], Object.entries(BF).map(([k, x]) => `<tr><td>${fam[k] || k}</td><td class="r num">${x.wins}-${x.losses}</td><td class="r num ${x.units >= 0 ? 'pos' : 'neg'}">${sgn(x.units, 1)}</td><td class="r num">${sgn(100 * x.roi, 1)}%</td></tr>`)))}</div>
    ${card('Latest graded bets', 'The most recent bets the strategy made, newest first.', table([{l: 'Date'}, {l: 'Bet'}, {l: 'Price', r: 1}, {l: 'Result'}, {l: 'Units', r: 1}],
      (ER.recent || []).map(x => `<tr><td class="muted">${esc(String(x.date).slice(0, 10))}</td><td>${esc(x.label)}</td><td class="r num">${am(x.price)}</td><td><span class="badge ${x.profit > 0 ? 'good' : x.profit < 0 ? 'bad' : ''}">${x.profit > 0 ? 'win' : x.profit < 0 ? 'loss' : 'push'}</span></td><td class="r num ${x.profit >= 0 ? 'pos' : 'neg'}">${sgn(x.profit, 2)}</td></tr>`), {h: 460}))}
    ${card('Accuracy against the closing line, season by season', `${gl('logloss', 'Log loss')}: lower is better; a coin flip scores 0.693. Locksmith never saw the season it is graded on.`,
      table([{l: 'Season'}, {l: 'Games', r: 1}, {l: 'Locksmith', r: 1}, {l: 'Closing line', r: 1}, {l: 'Total goals miss: Locksmith / line', r: 1}],
        (BT.accuracy || []).filter(a => a.with_lines > 50).map(a => `<tr><td>${sn(a.season)}</td><td class="r num">${a.with_lines}</td><td class="r num">${fx(a.ll_stack, 4)}</td><td class="r num">${fx(a.ll_close, 4)}</td><td class="r num">${fx(a.mae_total_stack, 2)} / ${fx(a.mae_total_close, 2)}</td></tr>`))
      + `<p class="note">At game time the closing line is still slightly sharper (${fx(ov.ll_stack, 4)} vs ${fx(ov.ll_close, 4)} over ${(ov.with_lines || 0).toLocaleString()} games). That is exactly why Locksmith bets early: its edge is knowing where the line is going.</p>`)}
    <details class="more"><summary>What didn’t work: betting at the final price</summary>${card('Bets at the closing line', 'Rules picked season by season, graded at the final price.', `<p class="note">${CL.wins || 0}-${CL.losses || 0}, ${sgn(CL.units, 1)} units (${sgn(100 * (CL.roi || 0), 1)}%). Once the line has moved to the right number there is nothing left to bet, so Locksmith never bets hockey at game time.</p>`)}</details>`;
}

function nModel() {
  const X = N.xg || {}, W = N.wp || {}, RL = N.realism || {}, ov = (N.backtest || {}).overall || {}, PB = {};
  const fmt = (r, v) => v == null ? '–' : r.fmt === 'pct' ? pct(v, 1) : fx(v, r.fmt);
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> Locksmith’s hockey win chances are close to the closing line (${fx(ov.ll_stack, 4)} vs ${fx(ov.ll_close, 4)} ${gl('logloss', 'log loss')} on ${(ov.with_lines || 0).toLocaleString()} games), its simulated games look like real NHL games, and its live odds beat the pregame line by a wide margin.</div>`
    + `<div class="tiles">${tile(fx(ov.ll_stack, 4), 'Locksmith log loss (lower is better)')}${tile(fx(ov.ll_close, 4), 'closing-line log loss')}${X.late ? tile(fx(X.late.auc, 2), `shot model AUC on ${X.late.n_shots.toLocaleString()} shots`) : ''}${W.logloss ? tile(fx(W.logloss.locksmith_live, 3), `live odds log loss (pregame only: ${fx(W.logloss.pregame_only, 3)})`, 'good') : ''}</div>`
    + `<div class="grid g2">${card('Do simulated games look like real ones?', `A league-average simulated game (${(RL.n_sim || 0).toLocaleString()} of them) against ${(RL.n_real || 0).toLocaleString()} real games from the last four seasons.`,
      table([{l: 'Measure'}, {l: 'Real', r: 1}, {l: 'Simulated', r: 1}], (RL.rows || []).map(r => `<tr><td>${r.label}</td><td class="r num">${fmt(r, r.real)}</td><td class="r num"><b>${fmt(r, r.sim)}</b></td></tr>`)))}
      ${X.late ? card('Shot quality model (expected goals)', 'Cross-fitted: seasons up to 2021-22 scored by a model trained on later seasons and vice versa, so no shot is scored by a model that saw it.', table([{l: 'Test seasons'}, {l: 'Shots', r: 1}, {l: 'Goals', r: 1}, {l: 'AUC', r: 1}, {l: 'Log loss (naive)', r: 1}],
        [['2018-19 to 2021-22', X.early], ['2022-23 to now', X.late]].map(([l, x]) => `<tr><td>${l}</td><td class="r num">${x.n_shots.toLocaleString()}</td><td class="r num">${x.goals.toLocaleString()}</td><td class="r num">${fx(x.auc, 3)}</td><td class="r num">${fx(x.logloss, 4)} (${fx(x.logloss_naive, 4)})</td></tr>`))) : ''}
      ${W.logloss ? card('Live odds', `Trained on every play of ${esc(W.train_seasons)}, tested on all ${W.n_test_states.toLocaleString()} game states of ${esc(W.test_season)}.`, table([{l: 'Model'}, {l: 'Log loss', r: 1}, {l: 'Brier', r: 1}], [
        `<tr><td><b>Locksmith live model</b></td><td class="r num"><b>${fx(W.logloss.locksmith_live, 3)}</b></td><td class="r num">${fx(W.brier.locksmith_live, 3)}</td></tr>`, `<tr><td>Pregame line only</td><td class="r num">${fx(W.logloss.pregame_only, 3)}</td><td class="r num">${fx(W.brier.pregame_only, 3)}</td></tr>`])
        + `<p class="note">Goals still to come: average miss ${fx(W.remaining_goals_mae.locksmith_live, 2)} vs ${fx(W.remaining_goals_mae.pregame_pace, 2)} for the pregame pace.</p>`) : ''}
      ${PB.n ? card('Player props', `${PB.n.toLocaleString()} DraftKings props from ${esc(PB.dates[0])} to ${esc(PB.dates[1])}, graded on real box scores. Every chance comes from projections built only on earlier games.`, table([{l: 'Prop'}, {l: 'Lines', r: 1}, {l: 'Over hit', r: 1}, {l: 'Priced at', r: 1}, {l: 'Log loss: Locksmith / DraftKings', r: 1}],
        Object.entries(PB.by_market || {}).map(([k, x]) => `<tr><td>${PNAME[k] || k}</td><td class="r num">${x.n}</td><td class="r num">${pct(x.hit_rate, 1)}</td><td class="r num">${pct(x.book_implied, 1)}</td><td class="r num">${fx(x.ll_cal, 4)} / ${fx(x.ll_book, 4)}</td></tr>`))) : ''}</div>`;
}
function nResearch() {
  const icon = {works: '✓', doesnt: '✗', neutral: '•', lesson: '!'};
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> every idea below was tested on real NHL games and real betting lines since 2018. Only the ones marked ✓ are used in the picks.</div><div class="legend rlegend"><span><b class="ic works">✓</b> works, used</span><span><b class="ic doesnt">✗</b> doesn’t work</span><span><b class="ic neutral">•</b> not proven</span><span><b class="ic lesson">!</b> lesson</span></div>`
    + `<div class="grid g2">${(N.findings || []).map(f => `<div class="card"><div class="finding"><span class="ic ${f.verdict}">${icon[f.verdict] || '•'}</span><div><h3>${esc(f.title)}</h3><p class="note">${esc(f.text)}</p></div></div></div>`).join('')}</div>`;
}
