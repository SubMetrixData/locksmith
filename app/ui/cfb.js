// Locksmith :: College football (FBS). Data: reports/cfb/app_data.json (python -m locksmith.cfb.card)
let CF = null, CDATE = null, CGAME = null;
const CTITLES = {slate: 'College football picks', game: 'College football games', live: 'Live betting', record: 'College football track record', model: 'College football model & power ratings', research: 'College football research'};
const CFB_VIEWS = ['slate', 'game', 'live', 'record', 'model', 'research'];
const cbooks = () => (CF && CF.books ? CF.books.filter(b => !CDATE || b.date === CDATE) : []);
const cPick = b => (b.pricing && b.pricing.pick) || {bet: 'Pass'};
const cPicksOf = b => (b.pricing && b.pricing.picks) || (cPick(b).bet !== 'Pass' ? [cPick(b)] : []);
const clogo = (b, side, s = 30) => tlogo(b[side + '_id'], s, 'cfb');
const csp = v => v == null ? '–' : v === 0 ? 'PK' : (v > 0 ? '+' : '') + v;
const cHalf = v => Math.round(v * 2) / 2;
const ord = n => n == null ? '' : n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const FAMNAME = {cover_spread: 'Spread at the opener', cover_total: 'Total at the opener', early_spread: 'Spread at the opener (raw gap)', close_spread: 'Spread at today’s line', early_total: 'Total at the opener (raw gap)', close_total: 'Total at today’s line', wind_open: 'Windy-game under at the opener', wind_close: 'Windy-game under at today’s line'};

async function cfbLoad() {
  if (CF) return CF;
  try { CF = (window.pywebview && window.pywebview.api && window.pywebview.api.get_cfb) ? await window.pywebview.api.get_cfb() : await (await fetch('../../reports/cfb/app_data.json', {cache: 'no-store'})).json(); }
  catch (e) { CF = {error: String(e)}; }
  if (CF && CF.books && CF.books.length && !CDATE) { const ds = [...new Set(CF.books.map(b => b.date))].sort(); CDATE = ds[0]; }
  return CF;
}
async function cfbRender() {
  $('#title').textContent = CTITLES[VIEW] || 'College football';
  if (!CF) { $('#view').innerHTML = '<div class="card empty">Loading college football…</div>'; await cfbLoad(); }
  if (!CF || CF.error || !CF.books) { $('#view').innerHTML = `<div class="card empty">${esc((CF && CF.error) || 'No college football data yet.')}</div>`; return; }
  const b0 = CF.books[0];
  $('#eyebrow').textContent = b0 ? `College football ${b0.season} · week ${b0.week}` : 'College football';
  const ds = [...new Set(CF.books.map(b => b.date))].sort();
  $('#weeks').innerHTML = ds.map(d => `<button class="chip${d === CDATE ? ' on' : ''}" data-cd="${d}">${dayName(d)}</button>`).join('');
  $('#weeks').style.display = ['slate', 'game'].includes(VIEW) ? '' : 'none';
  document.querySelectorAll('[data-cd]').forEach(c => c.onclick = () => { CDATE = c.dataset.cd; CGAME = null; cfbRender(); });
  ({slate: cPicks, game: cGame, record: cRecord, model: cModel, research: cResearch}[VIEW] || cPicks)();
}
const cWhen = () => dayName(CDATE) === 'Today' ? 'today' : 'on ' + dayName(CDATE);
const cStrat = () => ((CF.backtest || {}).strategies || {});
function cBestFam() {   // the published family with the best walk-forward record, for the headline
  const S = cStrat(); let best = null;
  for (const [k, v] of Object.entries(S)) { const w = v.walk_forward || {}; if (w.bets >= 100 && (!best || w.roi > best.w.roi)) best = {k, w, v}; }
  return best;
}
function cTier() {   // the best-bet tier: spread 8+ points off the opener, walk-forward predictions
  const B = (((CF.calib || {}).spread_open || {}).bins || []).find(x => x.lo >= 8);
  return B && B.n >= 100 ? B : null;
}
function cWx(b) {
  const w = b.weather || {};
  if (w.indoor) return 'Indoors';
  if (w.wind == null) return '';
  return `${Math.round(w.temp)}°F · wind ${Math.round(w.wind)} mph${w.gust ? ` (gusts ${Math.round(w.gust)})` : ''}${w.precip >= 1 ? ' · rain' : ''}`;
}
function cTicket(b, p) {
  return `<div class="ticket click" data-cg="${b.game_id}" style="--ca:var(--accent);--ch:var(--accent)"><div class="tk-m">${clogo(b, 'away')}<span class="tk-at">@</span>${clogo(b, 'home')}<div class="tk-g"><b>${esc(b.away)} at ${esc(b.home)}</b><span>${startET(b)}${b.neutral ? ' · neutral site' : ''}${cWx(b) ? ' · ' + esc(cWx(b)) : ''}</span></div></div>
    <div class="tk-b"><div class="tk-bet">${esc(p.bet)} <span class="tk-st">${starHTML(p.stars)}</span></div><div class="tk-n"><b>${esc(p.label || FAMNAME[p.family] || '')}.</b> ${esc(p.history || '')}${p.cond ? ` · <b>${esc(p.cond)}</b>` : ''}</div></div>
    <div class="tk-r">${p.win_chance != null ? ring(p.win_chance, p.family && p.family.includes('spread') ? 'to cover' : 'to win') : ''}</div></div>`;
}
function cPicks() {
  const B = cbooks(), flat = [];
  B.forEach(b => cPicksOf(b).forEach(p => flat.push([b, p])));
  flat.sort((a, z) => (z[1].win_chance || .53) - (a[1].win_chance || .53));
  const thin = []; B.forEach(b => ((b.pricing || {}).leans || []).forEach(l => thin.push([b, l])));
  const best = cBestFam();
  const rules = Object.keys(CF.rules || {});
  $('#view').innerHTML = `<div class="verdict big1"><b>${flat.length ? `${flat.length} bet${flat.length > 1 ? 's' : ''} ${cWhen()}.` : `No bets ${cWhen()}.`}</b> ${B.length} games priced.</div>
    ${(() => { const wr = (((cStrat().wind_open || {}).fixed || {}).wind_open_12) || {}, t = cTier();
      return `<div class="verdict blue"><b>Best bets</b> are only those whose kind has won at least ${pct(CF.min_chance || .55)} historically: outdoor unders in 12+ mph wind at the opening total${wr.wins ? ` (${wr.wins}-${wr.losses}, ${pct(wr.wins / (wr.wins + wr.losses), 1)})` : ''}${t ? `, spreads 8+ points away from the opener (${pct(t.win, 1)} of ${t.n.toLocaleString()})` : ''}, and the biggest total gaps. Everything thinner is listed below as smaller edges.</div>`; })()}
    ${best ? `<div class="verdict blue"><b>Track record:</b> ${esc(FAMNAME[best.k])}, ${best.w.wins}-${best.w.losses}, ${sgn(best.w.units, 0)} units (${sgn(100 * best.w.roi, 1)}%), every season picked using earlier seasons only. <a href="#" id="toRecC">See every strategy</a></div>` : ''}
    <div class="verdict amber">${rules.length ? `<b>Rules in force:</b> ${rules.map(r => esc(FAMNAME[r])).join(', ')}. Each bet only counts at the number shown or better. If your book is worse, skip it.` : '<b>No tested college football bets right now.</b> No rule passed the walk-forward test this season. The numbers below are projections, not picks.'}</div>`
    + (flat.length ? card('Bets worth making', `${TAP} one to see why.`, `<div class="tickets">${flat.map(([b, p]) => cTicket(b, p)).join('')}</div>`) : '')
    + (() => { const sm = []; B.forEach(b => ((b.pricing || {}).small || []).forEach(p => sm.push([b, p]))); return sm.length ? card('Smaller edges', `These passed the same test but history gives them only ${pct(CF.min_small || .535)}–${pct(CF.min_chance || .55)} to win: thin, so small stakes or skip. Not on the Today page.`,
        table([{l: 'Game'}, {l: 'Bet'}, {l: 'Win chance', r: 1}, {l: 'Condition'}], sm.map(([b, p]) => `<tr class="click" data-cg="${b.game_id}"><td>${esc(b.away)} at ${esc(b.home)}</td><td><b>${esc(p.bet)}</b> <span class="muted">${esc(p.label)}</span></td><td class="r num">${pct(p.win_chance)}</td><td class="muted">${esc(p.cond || '')}</td></tr>`))) : ''; })()
    + (thin.length ? card('Only at a better number', 'Locksmith liked these at the opening line; the line has moved past it.', table([{l: 'Game'}, {l: 'The bet at the opener'}], thin.map(([b, l]) => `<tr class="click" data-cg="${b.game_id}"><td>${esc(b.away)} at ${esc(b.home)}</td><td><b>${esc(l.at_open)}</b> or better</td></tr>`))) : '')
    + card(`Every game ${cWhen()}`, 'Locksmith’s spread and total vs the sportsbook (opening → now). Tap a game for the full breakdown.', table([{l: 'Game'}, {l: 'Win chance', r: 1}, {l: 'Spread: Locksmith / book', r: 1}, {l: 'Total: Locksmith / book', r: 1}, {l: 'Weather'}, {l: 'Bet'}],
      B.map(b => { const L = b.lines || {}, ps = cPicksOf(b); return `<tr class="click" data-cg="${b.game_id}"><td><span class="pcell">${clogo(b, 'away', 20)} ${esc(b.away)} at ${esc(b.home)} ${clogo(b, 'home', 20)}</span> <span class="muted">${startET(b)}</span></td><td class="r num">${esc(b.p_home >= .5 ? b.home : b.away)} ${pct(Math.max(b.p_home, 1 - b.p_home))}</td>
        <td class="r num">${esc(b.home)} ${csp(cHalf(-b.margin))} <span class="muted">/ ${csp(L.spread_open)} → ${csp(L.spread)}</span></td><td class="r num">${fx(b.total, 1)} <span class="muted">/ ${L.total_open ?? '–'} → ${L.total ?? '–'}</span></td><td class="muted">${esc(cWx(b))}</td><td>${ps.length ? ps.map(p => `<b>${esc(p.bet)}</b>`).join('<br>') : '<span class="muted">No bet</span>'}</td></tr>`; }), {h: 720}));
  document.querySelectorAll('[data-cg]').forEach(el => el.onclick = () => { CGAME = +el.dataset.cg; go('game'); });
  const tr = $('#toRecC'); if (tr) tr.onclick = e => { e.preventDefault(); go('record'); };
}
function cBar(v, max, flip) {   // signed bar centred at 0
  const w = Math.min(50, 50 * Math.abs(v) / max);
  return `<div class="cbar"><span style="${(v >= 0) !== !!flip ? 'left:50%' : 'right:50%'};width:${w}%;background:${(v >= 0) !== !!flip ? 'var(--accent)' : '#8a96a0'}"></span></div>`;
}
function cRank(r) { return r == null ? '' : `<span class="rk ${r <= 25 ? 'top' : r >= 110 ? 'bot' : ''}">${ord(r)}</span>`; }
function cGame() {
  const B = cbooks(); if (!B.length) { $('#view').innerHTML = '<div class="card empty">No games on this day.</div>'; return; }
  const b = B.find(x => x.game_id === CGAME) || B[0]; CGAME = b.game_id;
  const ps = cPicksOf(b), lean = ((b.pricing || {}).leans || [])[0], L = b.lines || {}, f = b.pred_final, T = b.teams || {}, H = T.home || {}, A = T.away || {}, W = b.weather || {}, TR = b.travel || {};
  const chips = `<div class="chips gchips">${B.map(x => `<button class="chip gchip${x.game_id === CGAME ? ' on' : ''}" data-cgc="${x.game_id}">${clogo(x, 'away', 18)}<span>${esc(x.away)} @ ${esc(x.home)}</span>${clogo(x, 'home', 18)}</button>`).join('')}</div>`;
  const side = (s, r) => `<div class="mh-t${r ? ' r' : ''}">${clogo(b, s, 64)}<div class="mh-n"><span class="mh-ab">${esc(b[s])}</span><span class="mh-sub">${esc(b[s + '_name'] || '')}${(T[s] || {}).rank ? ` · ${ord(T[s].rank)} in Locksmith’s ratings` : ''}</span></div><div class="mh-s${(s === 'home') === (b.p_home >= .5) ? ' win' : ''}">${s === 'home' ? f[0] : f[1]}</div></div>`;
  const cover = L.spread != null && b.sd ? 1 - normCdf(-(b.margin + L.spread) / b.sd) : null;
  const betTxt = ps.length ? ps.map(p => `${esc(p.bet)} ${starHTML(p.stars)}`).join(' · ') : 'No bet';
  const betSub = ps.length ? ps.map(p => `${esc(p.label)}: ${p.win_chance != null ? pct(p.win_chance) + ' to win · ' : ''}${esc(p.cond || '')}`).join(' · ') : lean ? `${esc(lean.at_open)} was the bet at the opener; the line has moved past it` : 'no edge big enough under the rules that passed the test';
  const hero = `<div class="card"><div class="mhero"><div class="eyebrow">${startET(b)}${b.neutral ? ' · neutral site' : ''} · week ${b.week}${b.conf_game ? ' · conference game' : ''}</div><div class="mh-row">${side('away', false)}<div class="mh-mid">at</div>${side('home', true)}</div>
    <div><div class="winbar"><span style="width:${100 * (1 - b.p_home)}%;background:#8a96a0"></span><span style="width:${100 * b.p_home}%;background:var(--accent)"></span></div><div class="winlab"><span>${esc(b.away)} ${pct(1 - b.p_home)}</span><span>${esc(b.home)} ${pct(b.p_home)}</span></div></div></div>
    ${answer([{l: 'Who wins', v: `${esc(b.p_home >= .5 ? b.home_name : b.away_name)} ${Math.max(...f)}–${Math.min(...f)}`, s: `${pct(Math.max(b.p_home, 1 - b.p_home))} chance to win`},
      {l: 'Spread', v: `Locksmith: ${esc(b.home)} ${csp(cHalf(-b.margin))}`, s: `sportsbook opened ${esc(b.home)} ${csp(L.spread_open)}${L.open_src ? ` (${esc(L.open_src.split(' ')[0])})` : ''}, now ${csp(L.spread)}${cover != null ? ` · ${esc(b.home)} covers ${csp(L.spread)} ${pct(cover)}` : ''}`},
      {l: 'Total', v: `Locksmith: ${fx(b.total, 1)}`, s: `sportsbook opened ${L.total_open ?? '–'}, now ${L.total ?? '–'}`},
      {l: 'The bet', v: betTxt, s: betSub, cls: ps.length ? 'go' : 'pass'}])}</div>`;
  // why
  const why = (b.why || []).length ? card('Why Locksmith’s number', `What moves Locksmith’s spread toward ${esc(b.home)} (right) or ${esc(b.away)} (left), in points.`,
    `<div class="whyl">${b.why.map(w => `<div class="whyr"><span>${esc(w.label)}</span>${cBar(w.pts, Math.max(...b.why.map(x => Math.abs(x.pts)), 3))}<b class="num">${esc(w.pts > 0 ? b.home : b.away)} ${fx(Math.abs(w.pts), 1)}</b></div>`).join('')}</div>`) : '';
  // matchup
  const row = (l, hv, av, d, good) => `<tr><td>${l}</td><td class="r num">${hv == null ? '–' : fx(hv, d)}</td><td class="r num">${av == null ? '–' : fx(av, d)}</td><td class="muted">${hv == null || av == null ? '' : (good === 'hi' ? hv > av : hv < av) ? esc(b.home) : esc(b.away)}</td></tr>`;
  const rk = (l, hv, hr, av, ar, d) => `<tr><td>${l}</td><td class="r num">${hv == null ? '–' : fx(hv, d)} ${cRank(hr)}</td><td class="r num">${av == null ? '–' : fx(av, d)} ${cRank(ar)}</td><td></td></tr>`;
  const mu = card('Matchup', 'Opponent-adjusted, garbage time removed. Points added per play (EPA) = how much each play moves the expected score; ranks among FBS teams.',
    table([{l: ''}, {l: esc(b.home), r: 1}, {l: esc(b.away), r: 1}, {l: 'Edge'}], [
      rk('Offence: points added per play', H.epa_o, H.rk_epa_o, A.epa_o, A.rk_epa_o, 3), rk('Defence: points allowed per play (− is good)', H.epa_d, H.rk_epa_d, A.epa_d, A.rk_epa_d, 3),
      rk('Offence: success rate', H.sr_o, H.rk_sr_o, A.sr_o, A.rk_sr_o, 3), rk('Defence: success rate allowed', H.sr_d, H.rk_sr_d, A.sr_d, A.rk_sr_d, 3),
      row('Explosive plays (offence)', H.expl_o, A.expl_o, 3, 'hi'), row('Points per drive (offence)', H.ppd_o, A.ppd_o, 2, 'hi'), row('Points per drive allowed', H.ppd_d, A.ppd_d, 2, 'lo'),
      row('Rushing: points added per carry', H.rush_o, A.rush_o, 3, 'hi'), row('Passing: points added per dropback', H.pass_o, A.pass_o, 3, 'hi'),
      row('Havoc allowed (sacks, TFLs, turnovers)', H.havoc_o, A.havoc_o, 3, 'lo'), row('Seconds per play (pace)', H.secs, A.secs, 1, 'lo')]));
  const cond = card('Conditions & roster', 'Things the ratings alone do not see.', table([{l: ''}, {l: esc(b.home), r: 1}, {l: esc(b.away), r: 1}], [
    `<tr><td>Roster talent (247 composite)</td><td class="r num">${H.talent ?? '–'} ${cRank(H.rk_talent)}</td><td class="r num">${A.talent ?? '–'} ${cRank(A.rk_talent)}</td></tr>`,
    `<tr><td>Returning production (offence / defence)</td><td class="r num">${H.ret_off != null ? pct(H.ret_off) + ' / ' + pct(H.ret_def) : '–'}</td><td class="r num">${A.ret_off != null ? pct(A.ret_off) + ' / ' + pct(A.ret_def) : '–'}</td></tr>`,
    `<tr><td>Games played this season</td><td class="r num">${H.games ?? '–'}</td><td class="r num">${A.games ?? '–'}</td></tr>`,
    `<tr><td>Travel</td><td class="r num">${b.neutral ? 'neutral' : 'home'}</td><td class="r num">${TR.miles != null ? Math.round(TR.miles).toLocaleString() + ' mi' : '–'}${TR.tz >= 1 ? `, ${fx(TR.tz, 0)} time zone${TR.tz >= 1.5 ? 's' : ''}` : ''}</td></tr>`]) +
    `<p class="note" style="margin-top:10px"><b>Kickoff weather:</b> ${W.indoor ? 'indoors' : W.wind != null ? `${Math.round(W.temp)}°F, wind ${Math.round(W.wind)} mph (gusts ${Math.round(W.gust || W.wind)}), ${W.precip >= 1 ? fx(W.precip, 1) + ' mm of rain' : 'dry'}${W.src === 'forecast' ? ' (forecast)' : ''}` : 'forecast not out yet (posted about two weeks ahead)'}${TR.elev >= 1200 ? ` · altitude ${Math.round(TR.elev * 3.281).toLocaleString()} ft` : ''}.</p>`);
  $('#view').innerHTML = chips + hero + `<div class="grid g2">${why}${cond}</div>` + mu;
  document.querySelectorAll('[data-cgc]').forEach(c => c.onclick = () => { CGAME = +c.dataset.cgc; cGame(); });
}
function normCdf(x) { const t = 1 / (1 + .2316419 * Math.abs(x)), d = .3989423 * Math.exp(-x * x / 2), p = d * t * (.3193815 + t * (-.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; }
function cSeasonBars(by) {
  const E = Object.entries(by || {}); if (!E.length) return '';
  const mx = Math.max(...E.map(([, x]) => Math.abs(x.units)), 5);
  return `<div class="sbars">${E.map(([s, x]) => `<div class="sb"><div class="sb-c"><span class="${x.units >= 0 ? 'up' : 'dn'}" style="height:${45 * Math.abs(x.units) / mx}%"></span></div><b class="num ${x.units >= 0 ? 'pos' : 'neg'}">${sgn(x.units, 0)}</b><span>${String(s).slice(2)}</span></div>`).join('')}</div>`;
}
function cRecord() {
  const S = cStrat(), best = cBestFam();
  const fam = k => { const x = (S[k] || {}).walk_forward || {}, sc = (S[k] || {}).same_bets_at_close || {}; return `<tr><td>${esc(FAMNAME[k])}</td><td class="r num">${x.bets ? `${x.wins}-${x.losses}` : '–'}</td><td class="r num ${(x.units || 0) >= 0 ? 'pos' : 'neg'}">${x.bets ? sgn(x.units, 1) : '–'}</td><td class="r num">${x.bets ? sgn(100 * x.roi, 1) + '%' : 'no rule passed'}</td><td class="r num">${sc.bets ? sgn(100 * sc.roi, 1) + '%' : ''}</td><td class="r num">${(S[k] || {}).beat_close != null ? pct(S[k].beat_close) : ''}</td></tr>`; };
  const fams = ['cover_spread', 'cover_total', 'early_spread', 'early_total', 'wind_open', 'close_spread', 'close_total', 'wind_close'];
  const fixed = k => Object.entries((S[k] || {}).fixed || {}).map(([r, x]) => `<tr><td>${esc(FAMNAME[k])}, ${r.split('_').pop()}+ ${k.startsWith('wind') ? 'mph' : 'pts'}</td><td class="r num">${x.bets ? `${x.wins}-${x.losses}` : '–'}</td><td class="r num ${(x.roi || 0) >= 0 ? 'pos' : 'neg'}">${x.bets ? sgn(100 * x.roi, 1) + '%' : '–'}</td></tr>`).join('');
  const head = best ? `<div class="verdict big1"><b>The short version:</b> ${esc(FAMNAME[best.k]).toLowerCase()}, rules chosen each season from earlier seasons only, went <b>${best.w.wins}-${best.w.losses}</b> (${sgn(100 * best.w.roi, 1)}%, ${sgn(best.w.units, 0)} units at −110).</div>`
    + ((best.v.same_bets_at_close || {}).bets ? `<div class="verdict amber"><b>The price matters.</b> The same bets at the closing line returned ${sgn(100 * best.v.same_bets_at_close.roi, 1)}%${best.v.beat_close != null ? `; they beat the closing number ${pct(best.v.beat_close)} of the time` : ''}. Every pick says the number it counts at.</div>` : '')
    : `<div class="verdict big1"><b>No college football rule has passed the test yet.</b> Every rule below was chosen on earlier seasons and tested on later ones; none was both profitable and convincing, so no picks are published.</div>`;
  const tier = cTier(), tb = (((CF.calib || {}).spread_open || {}).bins || []);
  const tierCard = tb.length ? card('Win rate by size of disagreement', 'Spread bets at the opening line, by how far Locksmith was from it. Every season predicted from earlier seasons only. Break-even at −110 is 52.4%.',
    table([{l: 'Locksmith vs the opener'}, {l: 'Games', r: 1}, {l: 'Covered', r: 1}, {l: ''}], tb.map(x => `<tr${x.lo >= 8 ? ' style="font-weight:700"' : ''}><td>${x.hi >= 99 ? x.lo + '+ points' : x.lo + '–' + x.hi + ' points'}${x.lo >= 8 ? ' (best bets)' : ''}</td><td class="r num">${x.n.toLocaleString()}</td><td class="r num ${x.win >= .524 ? 'pos' : 'neg'}">${pct(x.win, 1)}</td><td>${cBar(x.win - .524, .08)}</td></tr>`))) : '';
  $('#view').innerHTML = head + tierCard + (best ? card(`${FAMNAME[best.k]}: season by season`, 'Units won at −110, walk-forward.', cSeasonBars(best.v.by_season)) : '')
    + card('Every strategy tested', 'Walk-forward: each season only uses rules that worked on earlier seasons. Graded at −110.', table([{l: 'Strategy'}, {l: 'Record', r: 1}, {l: 'Units', r: 1}, {l: 'Return', r: 1}, {l: 'Same bets at close', r: 1}, {l: 'Beat the close', r: 1}], fams.map(fam)))
    + `<details class="card"><summary><b>Every fixed rule, all seasons</b> <span class="muted">(reference only, not walk-forward)</span></summary>${table([{l: 'Rule'}, {l: 'Record', r: 1}, {l: 'Return', r: 1}], fams.map(fixed))}</details>`;
}
function cModel() {
  const A = (CF.backtest || {}).accuracy || {}, TT = CF.teams || [], mt = (CF.backtest || {}).move_test || {};
  const rows = Object.entries(A);
  const avg = k => { const v = rows.map(([, x]) => x[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b) / v.length : null; };
  $('#view').innerHTML = `<div class="verdict blue">Locksmith misses the final margin by <b>${fx(avg('mae_model'), 2)}</b> points on average (closing line ${fx(avg('mae_close'), 2)}, opening line ${fx(avg('mae_open'), 2)}; Locksmith on those same games ${fx(avg('mae_model_on_open'), 2)}).${mt.toward_model != null ? ` When it disagrees with the opener by 3+, the line moves its way ${pct(mt.toward_model)} of the time.` : ''}</div>`
    + card('Power ratings', 'Every FBS team: points better than an average team on a neutral field, with offence / defence efficiency and roster talent ranks.', table([{l: '#', r: 1}, {l: 'Team'}, {l: 'Rating', r: 1}, {l: 'Offence', r: 1}, {l: 'Defence', r: 1}, {l: 'Talent', r: 1}, {l: 'Returning', r: 1}],
      TT.map(t => `<tr><td class="r num">${t.rank}</td><td><span class="pcell">${tlogo(t.id, 20, 'cfb')} ${esc(t.name || t.abbr)}</span></td><td class="r num"><b>${sgn(t.rating, 1)}</b></td><td class="r num">${cRank(t.rk_epa_o)}</td><td class="r num">${cRank(t.rk_epa_d)}</td><td class="r num">${cRank(t.rk_talent)}</td><td class="r num">${t.ret_off != null ? pct((t.ret_off + t.ret_def) / 2) : '–'}</td></tr>`), {h: 620}))
    + card('Final margin: Locksmith vs the sportsbook', 'Average miss in points, each season predicted from earlier seasons only (lower is better).', table([{l: 'Season'}, {l: 'Games', r: 1}, {l: 'Locksmith', r: 1}, {l: 'Opening line', r: 1}, {l: 'Locksmith, same games', r: 1}, {l: 'Closing line', r: 1}, {l: 'Total: Locksmith / close', r: 1}],
      rows.map(([s, x]) => `<tr><td>${s}</td><td class="r num">${x.games}</td><td class="r num">${fx(x.mae_model, 2)}</td><td class="r num">${fx(x.mae_open, 2)}</td><td class="r num">${fx(x.mae_model_on_open, 2)}</td><td class="r num">${fx(x.mae_close, 2)}</td><td class="r num">${fx(x.tot_mae_model, 1)} / ${fx(x.tot_mae_close, 1)}</td></tr>`)))
    + card('What goes into it', '', `<ul class="note">
      <li><b>Every play since 2014</b> (1.9 million): points added per play, success rate, explosive plays, havoc, points per drive and per trip inside the 40, field position, pace. Garbage time removed, every number adjusted for the opponent.</li>
      <li><b>Preseason:</b> 247Sports roster talent, returning production and last season’s rating, leaned on early and faded as games are played.</li>
      <li><b>Market memory:</b> what past betting lines said about each team.</li>
      <li><b>Situation:</b> home field, rest, travel miles, time zones, altitude, FCS opponents, conference and bowl games, kickoff wind, temperature and rain.</li>
      <li><b>Two models</b> (regularised regression + gradient-boosted trees) averaged; every season predicted only from earlier seasons.</li></ul>`);
}
function cResearch() {
  const F = CF.findings || [];
  $('#view').innerHTML = `<div class="grid g2">${F.map(x => `<div class="card finding"><span class="ic ${x.verdict}">${{works: '✓', doesnt: '✗', neutral: '•', lesson: '!'}[x.verdict] || '•'}</span><div><h3>${esc(x.title)}</h3><p class="note">${esc(x.text)}</p></div></div>`).join('')}</div>`;
}
