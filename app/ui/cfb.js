// Locksmith :: College football (FBS). Data: reports/cfb/app_data.json (python -m locksmith.cfb.card).
// Every verdict comes from reports/bets.json through the gp* helpers in props.js; the win chance shown is the market's unless
// reports/certificate.json says otherwise, and raw-model numbers sit inside "Show the numbers".
let CF = null, CDATE = null, CGAME = null;
const CTITLES = {slate: 'College football games', game: 'College football game', live: 'Live betting', record: 'College football record', model: 'College football: us vs the market', research: 'College football research'};
const CFB_VIEWS = ['slate', 'game', 'live', 'record', 'model', 'research'];
const cbooks = () => (CF && CF.books ? CF.books.filter(b => !CDATE || b.date === CDATE) : []);
const cPick = b => (b.pricing && b.pricing.pick) || {bet: 'Pass'};
const cPicksOf = b => (b.pricing && b.pricing.picks) || (cPick(b).bet !== 'Pass' ? [cPick(b)] : []);
const csp = v => v == null ? '–' : v === 0 ? 'PK' : (v > 0 ? '+' : '') + v;
const cHalf = v => Math.round(v * 2) / 2;
const ord = n => n == null ? '' : n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
const FAMNAME = {cover_spread: 'Spread at the opener', cover_total: 'Total at the opener', early_spread: 'Spread at the opener (raw gap)', close_spread: 'Spread at today’s line', early_total: 'Total at the opener (raw gap)', close_total: 'Total at today’s line', wind_open: 'Windy-game under at the opener', wind_close: 'Windy-game under at today’s line'};

// College logos: ESPN serves them by numeric team id (…/teamlogos/ncaa/500/2132.png), not by abbreviation (…/500/CIN.png is a
// 404: 50 teams failed that way on the Bets and Board screens). CFB_LOGO_ID maps every abbreviation in the data to its ESPN id
// (built from reports/cfb/app_data.json teams + books); cfbLogoId(code) also learns any new team once the data loads.
// Teams with no id get a clean initials badge and no image request at all.
const CFB_LOGO_ID = {AFA: 2005, AKR: 2006, ALA: 333, APP: 2026, ARIZ: 12, ARK: 8, ARMY: 349, ARST: 2032, ASU: 9, AUB: 2, BALL: 2050, BAY: 239, BC: 103, BGSU: 189, BOIS: 68, BUFF: 2084, BYU: 252,
  CAL: 25, CCU: 324, CIN: 2132, CLEM: 228, CLT: 2429, CMU: 2117, COLO: 38, CONN: 41, CSU: 36, DEL: 48, DUKE: 150, ECU: 151, EMU: 2199, FAU: 2226, FIU: 2229, FLA: 57, FRES: 278, FSU: 52, GASO: 290,
  GAST: 2247, GT: 59, HAW: 62, HOU: 248, ILL: 356, IOWA: 2294, ISU: 66, IU: 84, JMU: 256, JXST: 55, KENN: 338, KENT: 2309, KSU: 2306, KU: 2305, LIB: 2335, LOU: 97, LSU: 99, LT: 2348, 'M-OH': 193,
  MASS: 113, MD: 120, MEM: 235, MIA: 2390, MICH: 130, MINN: 135, MISS: 145, MIZ: 142, MOST: 2623, MRMK: 2771, MRSH: 276, MSST: 344, MSU: 127, MTSU: 2393, NAVY: 2426, NCSU: 152, ND: 87, NDSU: 2449,
  NEB: 158, NEV: 2440, NIU: 2459, NMSU: 166, NU: 77, ODU: 295, OHIO: 195, OKST: 197, ORE: 2483, ORST: 204, OSU: 194, OU: 201, PITT: 221, PSU: 213, PUR: 2509, RICE: 242, RUTG: 164, SAC: 16, SC: 2579,
  SDSU: 21, SHSU: 2534, SJSU: 23, SMU: 2567, STAN: 24, SYR: 183, 'TA&M': 245, TCU: 2628, TEM: 218, TENN: 2633, TEX: 251, TLSA: 202, TOL: 2649, TROY: 2653, TTU: 2641, TULN: 2655, TXST: 326, UAB: 5,
  UCF: 2116, UCLA: 26, UGA: 61, UK: 96, UL: 309, ULM: 2433, UNC: 153, UNLV: 2439, UNM: 167, UNT: 249, USA: 6, USC: 30, USF: 58, USM: 2572, USU: 328, UTAH: 254, UTEP: 2638, UTSA: 2636, UVA: 258,
  VAN: 238, VT: 259, WAKE: 154, WASH: 264, WIS: 275, WKU: 98, WMU: 2711, WSU: 265, WVU: 277, WYO: 2751};
function cfbLogoId(code) {                          // ESPN numeric id for a college abbreviation (or the id itself), else null
  if (code == null || code === '') return null;
  if (/^\d+$/.test(String(code))) return +code;
  return CFB_LOGO_ID[code] || null;
}
function cfbLogoURL(code) { const id = cfbLogoId(code); return id ? `https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/${id}.png&w=96&h=96` : ''; }
function cLogo(abbr, id, s = 30) {                  // the shell's logo markup (.tlg), lettered with the abbreviation, never a broken image
  const url = cfbLogoURL(id || abbr);
  return `<span class="tlg" style="--s:${s}px"><i>${esc(String(abbr || '').slice(0, 4))}</i>${url ? `<img src="${url}" alt="" loading="lazy" onload="this.parentNode.classList.add('ok')" onerror="this.remove()">` : ''}</span>`;
}
const clogo = (b, side, s = 30) => cLogo(b[side], b[side + '_id'], s);

async function cfbLoad() {
  if (CF) return CF;
  try { CF = (window.pywebview && window.pywebview.api && window.pywebview.api.get_cfb) ? await window.pywebview.api.get_cfb() : await (await fetch('../../reports/cfb/app_data.json', {cache: 'no-store'})).json(); }
  catch (e) { CF = {error: String(e)}; }
  if (CF && CF.books) CF.books.forEach(b => ['home', 'away'].forEach(s => { if (b[s] && b[s + '_id'] && !CFB_LOGO_ID[b[s]]) CFB_LOGO_ID[b[s]] = +b[s + '_id']; }));
  (CF && CF.teams || []).forEach(t => { if (t.abbr && t.id && !CFB_LOGO_ID[t.abbr]) CFB_LOGO_ID[t.abbr] = +t.id; });
  if (CF && CF.books && CF.books.length && !CDATE) { const ds = [...new Set(CF.books.map(b => b.date))].sort(); CDATE = ds[0]; }
  return CF;
}
async function cfbRender() {
  $('#title').textContent = CTITLES[VIEW] || 'College football';
  if (!CF) { $('#view').innerHTML = '<div class="card empty">Loading college football…</div>'; await cfbLoad(); }
  if (!CF || CF.error || !CF.books) { $('#view').innerHTML = `<div class="card empty">${esc((CF && CF.error) || 'No college football data yet.')}</div>`; return; }
  // opened from Today / Games / Bets: show THAT game. The date chips filter the list, so jump to the game's day first
  // (before, a Saturday game opened the first game of Friday's list).
  if (VIEW === 'game' && CGAME != null) { const gb = CF.books.find(b => +b.game_id === +CGAME); if (gb && gb.date !== CDATE) CDATE = gb.date; }
  await (VIEW === 'record' ? gpTrackLoad() : gpLoad());
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
function cBestFam() {   // the published family with the best walk-forward record (past games), for the record page
  const S = cStrat(); let best = null;
  for (const [k, v] of Object.entries(S)) { const w = v.walk_forward || {}; if (w.bets >= 100 && (!best || w.roi > best.w.roi)) best = {k, w, v}; }
  return best;
}
function cWx(b) {
  const w = b.weather || {};
  if (w.indoor) return 'Indoors';
  if (w.wind == null) return '';
  return `${Math.round(w.temp)}°F · wind ${Math.round(w.wind)} mph${w.gust ? ` (gusts ${Math.round(w.gust)})` : ''}${w.precip >= 1 ? ' · rain' : ''}`;
}

// ---------------------------------------------------------------- GAMES: one line per game, the verdict from bets.json
function cPicks() {
  const B = cbooks();
  $('#view').innerHTML = `<div class="verdict big1">${B.length ? `${gpCount('cfb', B.map(b => b.game_id))} <span class="muted">${B.length} game${B.length > 1 ? 's' : ''} ${cWhen()}.</span>` : `<b>No games ${cWhen()}.</b>`}</div>`
    + `<div class="gp-list">${B.map(b => gpRow('cfb', b.game_id, {b, home: b.home, away: b.away, when: startET(b), match: `${clogo(b, 'away', 20)} ${esc(b.away)} @ ${esc(b.home)} ${clogo(b, 'home', 20)}`, attr: `data-cg="${b.game_id}"`})).join('')}</div>`;
  document.querySelectorAll('[data-cg]').forEach(el => el.onclick = () => { CGAME = +el.dataset.cg; go('game'); });
}

// ---------------------------------------------------------------- GAME PAGE
function cBar(v, max, flip) {   // signed bar centred at 0
  const w = Math.min(50, 50 * Math.abs(v) / max), pos = (v >= 0) !== !!flip;
  return `<div class="cbar"><span style="${pos ? 'left:50%' : 'right:50%'};width:${w}%;background:${pos ? 'var(--brand,var(--accent))' : 'var(--muted)'}"></span></div>`;
}
function cRank(r) { return r == null ? '' : `<span class="rk ${r <= 25 ? 'top' : r >= 110 ? 'bot' : ''}">${ord(r)}</span>`; }
function cGame() {
  const B = cbooks(); if (!B.length) { $('#view').innerHTML = '<div class="card empty">No games on this day.</div>'; return; }
  const b = B.find(x => +x.game_id === +CGAME) || B[0]; CGAME = b.game_id;
  const L = b.lines || {}, T = b.teams || {}, H = T.home || {}, A = T.away || {}, W = b.weather || {}, TR = b.travel || {};
  const G = gpGame('cfb', b.game_id), pj = gpProj(G, b), ch = gpHomeChance('cfb', G, b.true_prob), pH = ch ? ch.p : null;
  const nm = s => s === b.home ? (b.home_name || s) : s === b.away ? (b.away_name || s) : s;
  // the highlighted side: the shown chance's favourite, or with no line yet the side the projected score has ahead (never a fake 50/50)
  const side = (s, r) => { const pts = pj ? (s === 'home' ? pj.home : pj.away) : '', win = pH != null ? (s === 'home') === (pH >= .5) : !!pj && +pj.home !== +pj.away && (s === 'home') === (+pj.home > +pj.away);
    return `<div class="mh-t${r ? ' r' : ''}">${clogo(b, s, 64)}<div class="mh-n"><span class="mh-ab">${esc(b[s])}</span><span class="mh-sub">${esc(b[s + '_name'] || '')}${(T[s] || {}).rank ? ` · ${ord(T[s].rank)} in Locksmith’s ratings` : ''}</span></div><div class="mh-s${win ? ' win' : ''}${String(pts).length > 4 ? ' long' : ''}">${pts}</div></div>`; };
  const bar = pH == null ? '' : `<div><div class="winbar"><span style="width:${100 * (1 - pH)}%;background:var(--muted)"></span><span style="width:${100 * pH}%;background:var(--brand,var(--accent))"></span></div><div class="winlab"><span>${esc(b.away)} ${gpPct(1 - pH)}</span><span>${esc(b.home)} ${gpPct(pH)}</span></div></div>`;
  const rows = [gpWho(ch, b.home, b.away, nm, pj),
    {l: 'Spread', v: L.spread != null ? `${esc(b.home)} ${csp(L.spread)}` : 'No line yet', s: [L.spread_open != null && L.spread_open !== L.spread ? `opened ${esc(b.home)} ${csp(L.spread_open)}` : '', pj && ok(pj.margin) ? `projected: ${esc(+pj.margin >= 0 ? b.home : b.away)} by ${fx(Math.abs(pj.margin), 1)}${gpProjBadge(pj, 'margin')}` : ''].filter(Boolean).join(' · ')},
    {l: 'Total', v: L.total != null ? `${L.total}` : 'No line yet', s: [L.total_open != null && L.total_open !== L.total ? `opened ${L.total_open}` : '', pj && ok(pj.total) ? `projected: ${fx(pj.total, 1)}${gpProjBadge(pj, 'total')}` : ''].filter(Boolean).join(' · ')}];
  const hero = `<div class="card"><div class="mhero"><div class="eyebrow">${dayName(b.date)} · ${startET(b)}${b.neutral ? ' · neutral site' : ''} · week ${b.week}${b.conf_game ? ' · conference game' : ''}</div><div class="mh-row">${side('away', false)}<div class="mh-mid">at</div>${side('home', true)}</div>${bar}</div>
    ${answer(rows)}</div>`;
  const cond = card('Conditions and roster', 'Things the ratings alone do not see.', table([{l: ''}, {l: esc(b.home), r: 1}, {l: esc(b.away), r: 1}], [
    `<tr><td>Roster talent (247 composite)</td><td class="r num">${H.talent ?? '–'} ${cRank(H.rk_talent)}</td><td class="r num">${A.talent ?? '–'} ${cRank(A.rk_talent)}</td></tr>`,
    `<tr><td>Returning production (offence / defence)</td><td class="r num">${H.ret_off != null ? pct(H.ret_off) + ' / ' + pct(H.ret_def) : '–'}</td><td class="r num">${A.ret_off != null ? pct(A.ret_off) + ' / ' + pct(A.ret_def) : '–'}</td></tr>`,
    `<tr><td>Games played this season</td><td class="r num">${H.games ?? '–'}</td><td class="r num">${A.games ?? '–'}</td></tr>`,
    `<tr><td>Travel</td><td class="r num">${b.neutral ? 'neutral' : 'home'}</td><td class="r num">${TR.miles != null ? Math.round(TR.miles).toLocaleString() + ' mi' : '–'}${TR.tz >= 1 ? `, ${fx(TR.tz, 0)} time zone${TR.tz >= 1.5 ? 's' : ''}` : ''}</td></tr>`]) +
    `<p class="note"><b>Kickoff weather:</b> ${W.indoor ? 'indoors' : W.wind != null ? `${Math.round(W.temp)}°F, wind ${Math.round(W.wind)} mph (gusts ${Math.round(W.gust || W.wind)}), ${W.precip >= 1 ? fx(W.precip, 1) + ' mm of rain' : 'dry'}${W.src === 'forecast' ? ' (forecast)' : ''}` : 'forecast not out yet (posted about two weeks ahead)'}${TR.elev >= 1200 ? ` · altitude ${Math.round(TR.elev * 3.281).toLocaleString()} ft` : ''}.</p>`);
  const chips = B.length > 1 ? card('Other games', '', `<div class="chips gchips">${B.map(x => `<button class="chip gchip${x.game_id === CGAME ? ' on' : ''}" data-cgc="${x.game_id}">${clogo(x, 'away', 18)}<span>${esc(x.away)} @ ${esc(x.home)}</span>${clogo(x, 'home', 18)}</button>`).join('')}</div>`) : '';
  $('#view').innerHTML = gpHead('cfb', b.game_id) + hero + gpSides('cfb', b.game_id) + cond + chips + gpRaw(cNumbers(b));
  document.querySelectorAll('[data-cgc]').forEach(c => c.onclick = () => { CGAME = +c.dataset.cgc; cGame(); window.scrollTo(0, 0); });
}
// the raw model: its own margin, total and cover chance, what moves its number, and the team efficiency stats
function cNumbers(b) {
  const L = b.lines || {}, T = b.teams || {}, H = T.home || {}, A = T.away || {}, tp = b.true_prob || {};
  const cover = L.spread != null && b.sd && ok(b.margin) ? 1 - normCdf(-(b.margin + L.spread) / b.sd) : null;
  const raw = table([{l: ''}, {l: 'Raw model', r: 1}], [
    tp.model != null ? `<tr><td>${esc(b.home)} win chance</td><td class="r num">${pct(tp.model, 1)}</td></tr>` : '',
    ok(b.margin) ? `<tr><td>Spread</td><td class="r num">${esc(b.home)} ${csp(cHalf(-b.margin))}</td></tr>` : '',
    ok(b.total) ? `<tr><td>Total</td><td class="r num">${fx(b.total, 1)}</td></tr>` : '',
    cover != null ? `<tr><td>${esc(b.home)} ${csp(L.spread)} covers</td><td class="r num">${pct(cover)}</td></tr>` : ''].filter(Boolean));
  const why = (b.why || []).length ? card('What moves the raw model’s number', `Toward ${esc(b.home)} (right) or ${esc(b.away)} (left), in points.`,
    `<div class="whyl">${b.why.map(w => `<div class="whyr"><span>${esc(w.label)}</span>${cBar(w.pts, Math.max(...b.why.map(x => Math.abs(x.pts)), 3))}<b class="num">${esc(w.pts > 0 ? b.home : b.away)} ${fx(Math.abs(w.pts), 1)}</b></div>`).join('')}</div>`) : '';
  const row = (l, hv, av, d, good) => `<tr><td>${l}</td><td class="r num">${hv == null ? '–' : fx(hv, d)}</td><td class="r num">${av == null ? '–' : fx(av, d)}</td><td class="muted">${hv == null || av == null ? '' : (good === 'hi' ? hv > av : hv < av) ? esc(b.home) : esc(b.away)}</td></tr>`;
  const rk = (l, hv, hr, av, ar, d) => `<tr><td>${l}</td><td class="r num">${hv == null ? '–' : fx(hv, d)} ${cRank(hr)}</td><td class="r num">${av == null ? '–' : fx(av, d)} ${cRank(ar)}</td><td></td></tr>`;
  const mu = card('Team stats', 'Opponent-adjusted, garbage time removed. Points added per play = how much each play moves the expected score; ranks among FBS teams.',
    table([{l: ''}, {l: esc(b.home), r: 1}, {l: esc(b.away), r: 1}, {l: 'Better'}], [
      rk('Offence: points added per play', H.epa_o, H.rk_epa_o, A.epa_o, A.rk_epa_o, 3), rk('Defence: points allowed per play (− is good)', H.epa_d, H.rk_epa_d, A.epa_d, A.rk_epa_d, 3),
      rk('Offence: success rate', H.sr_o, H.rk_sr_o, A.sr_o, A.rk_sr_o, 3), rk('Defence: success rate allowed', H.sr_d, H.rk_sr_d, A.sr_d, A.rk_sr_d, 3),
      row('Explosive plays (offence)', H.expl_o, A.expl_o, 3, 'hi'), row('Points per drive (offence)', H.ppd_o, A.ppd_o, 2, 'hi'), row('Points per drive allowed', H.ppd_d, A.ppd_d, 2, 'lo'),
      row('Rushing: points added per carry', H.rush_o, A.rush_o, 3, 'hi'), row('Passing: points added per dropback', H.pass_o, A.pass_o, 3, 'hi'),
      row('Havoc allowed (sacks, TFLs, turnovers)', H.havoc_o, A.havoc_o, 3, 'lo'), row('Seconds per play (pace)', H.secs, A.secs, 1, 'lo')]));
  return `<div class="grid g2">${card('The raw model on this game', '', raw)}${why}</div>` + mu;
}
function normCdf(x) { const t = 1 / (1 + .2316419 * Math.abs(x)), d = .3989423 * Math.exp(-x * x / 2), p = d * t * (.3193815 + t * (-.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; }
function cSeasonBars(by) {
  const E = Object.entries(by || {}); if (!E.length) return '';
  const mx = Math.max(...E.map(([, x]) => Math.abs(x.units)), 5);
  return `<div class="sbars">${E.map(([s, x]) => `<div class="sb"><div class="sb-c"><span class="${x.units >= 0 ? 'up' : 'dn'}" style="height:${45 * Math.abs(x.units) / mx}%"></span></div><b class="num ${x.units >= 0 ? 'pos' : 'neg'}">${sgn(x.units, 0)}</b><span>${String(s).slice(2)}</span></div>`).join('')}</div>`;
}

// ---------------------------------------------------------------- RECORD / MODEL / RESEARCH
// the live record of real logged bets leads; the backtest follows, labelled as past games
function cRecord() {
  const S = cStrat(), best = cBestFam();
  const fam = k => { const x = (S[k] || {}).walk_forward || {}, sc = (S[k] || {}).same_bets_at_close || {}; return `<tr><td>${esc(FAMNAME[k])}</td><td class="r num">${x.bets ? `${x.wins}-${x.losses}` : '–'}</td><td class="r num ${(x.units || 0) >= 0 ? 'pos' : 'neg'}">${x.bets ? sgn(x.units, 1) : '–'}</td><td class="r num">${x.bets ? sgn(100 * x.roi, 1) + '%' : 'no rule passed'}</td><td class="r num">${sc.bets ? sgn(100 * sc.roi, 1) + '%' : ''}</td><td class="r num">${(S[k] || {}).beat_close != null ? pct(S[k].beat_close) : ''}</td></tr>`; };
  const fams = ['cover_spread', 'cover_total', 'early_spread', 'early_total', 'wind_open', 'close_spread', 'close_total', 'wind_close'];
  const fixed = k => Object.entries((S[k] || {}).fixed || {}).map(([r, x]) => `<tr><td>${esc(FAMNAME[k])}, ${r.split('_').pop()}+ ${k.startsWith('wind') ? 'mph' : 'pts'}</td><td class="r num">${x.bets ? `${x.wins}-${x.losses}` : '–'}</td><td class="r num ${(x.roi || 0) >= 0 ? 'pos' : 'neg'}">${x.bets ? sgn(100 * x.roi, 1) + '%' : '–'}</td></tr>`).join('');
  const tb = (((CF.calib || {}).spread_open || {}).bins || []);
  const tierCard = tb.length ? card('Win rate by size of disagreement', 'Spread bets at the opening line, by how far Locksmith was from it. Every season predicted from earlier seasons only. Break-even at −110 is 52.4%.',
    table([{l: 'Locksmith vs the opener'}, {l: 'Games', r: 1}, {l: 'Covered', r: 1}, {l: ''}], tb.map(x => `<tr><td>${x.hi >= 99 ? x.lo + '+ points' : x.lo + '–' + x.hi + ' points'}</td><td class="r num">${x.n.toLocaleString()}</td><td class="r num ${x.win >= .524 ? 'pos' : 'neg'}">${pct(x.win, 1)}</td><td>${cBar(x.win - .524, .08)}</td></tr>`))) : '';
  const sc = best ? (best.v.same_bets_at_close || {}) : {};
  $('#view').innerHTML = gpLiveRecord('cfb', {name: 'college football'})
    + gpPast(best ? `Best rule replayed on past seasons: ${esc(FAMNAME[best.k]).toLowerCase()}, rules chosen each season from earlier seasons only, <b>${best.w.wins}-${best.w.losses}</b> (${sgn(100 * best.w.roi, 1)}% a bet at −110).${sc.bets ? ` The same bets at the closing line returned ${sgn(100 * sc.roi, 1)}%, so the price matters: every bet says the number it counts at.` : ''}` : 'No college football rule has passed the test on past seasons yet.')
    + gpRaw(tierCard + (best ? card(`${FAMNAME[best.k]}: season by season`, 'Units won at −110, walk-forward.', cSeasonBars(best.v.by_season)) : '')
      + card('Every strategy tested', 'Walk-forward: each season only uses rules that worked on earlier seasons. Graded at −110.', table([{l: 'Strategy'}, {l: 'Record', r: 1}, {l: 'Units', r: 1}, {l: 'Return', r: 1}, {l: 'Same bets at close', r: 1}, {l: 'Line moved our way', r: 1}], fams.map(fam)))
      + `<details class="card"><summary><b>Every fixed rule, all seasons</b> <span class="muted">(reference only, not walk-forward)</span></summary>${table([{l: 'Rule'}, {l: 'Record', r: 1}, {l: 'Return', r: 1}], fams.map(fixed))}</details>`, 'The backtest in detail (past games, not live bets).');
}
function cModel() {
  const A = (CF.backtest || {}).accuracy || {}, TT = CF.teams || [], mt = (CF.backtest || {}).move_test || {};
  const rows = Object.entries(A);
  const avg = k => { const v = rows.map(([, x]) => x[k]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b) / v.length : null; };
  const mM = avg('mae_model'), mC = avg('mae_close');
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> ${mM != null ? `on past seasons Locksmith missed the final margin by ${fx(mM, 2)} points on average and the closing line by ${fx(mC, 2)}, so ${mM < mC ? 'Locksmith was a little closer' : 'the closing line was as close or closer'}. Win chances shown in the app are the market’s unless a test on unseen games says Locksmith’s beat it.` : 'Not enough graded games yet.'}</div>`
    + card('Power ratings', 'Every FBS team: points better than an average team on a neutral field, with offence / defence efficiency and roster talent ranks.', table([{l: '#', r: 1}, {l: 'Team'}, {l: 'Rating', r: 1}, {l: 'Offence', r: 1}, {l: 'Defence', r: 1}, {l: 'Talent', r: 1}],
      TT.map(t => `<tr><td class="r num">${t.rank}</td><td><span class="pcell">${cLogo(t.abbr, t.id, 20)} ${esc(t.name || t.abbr)}</span></td><td class="r num"><b>${sgn(t.rating, 1)}</b></td><td class="r num">${cRank(t.rk_epa_o)}</td><td class="r num">${cRank(t.rk_epa_d)}</td><td class="r num">${cRank(t.rk_talent)}</td></tr>`), {h: 620}))
    + gpRaw(card('Final margin: Locksmith vs the sportsbook', `Average miss in points, each season predicted from earlier seasons only (lower is better).${mt.toward_model != null ? ` When Locksmith disagreed with the opener by 3+, the line moved its way ${pct(mt.toward_model)} of the time.` : ''}`, table([{l: 'Season'}, {l: 'Games', r: 1}, {l: 'Locksmith', r: 1}, {l: 'Opening line', r: 1}, {l: 'Locksmith, same games', r: 1}, {l: 'Closing line', r: 1}, {l: 'Total: Locksmith / close', r: 1}],
      rows.map(([s, x]) => `<tr><td>${s}</td><td class="r num">${x.games}</td><td class="r num">${fx(x.mae_model, 2)}</td><td class="r num">${fx(x.mae_open, 2)}</td><td class="r num">${fx(x.mae_model_on_open, 2)}</td><td class="r num">${fx(x.mae_close, 2)}</td><td class="r num">${fx(x.tot_mae_model, 1)} / ${fx(x.tot_mae_close, 1)}</td></tr>`))), 'How the model was tested (past games).')
    + card('What goes into it', '', `<ul class="note">
      <li><b>Every play since 2014</b> (1.9 million): points added per play, success rate, explosive plays, havoc, points per drive and per trip inside the 40, field position, pace. Garbage time removed, every number adjusted for the opponent.</li>
      <li><b>Preseason:</b> 247Sports roster talent, returning production and last season’s rating, leaned on early and faded as games are played.</li>
      <li><b>Market memory:</b> what past betting lines said about each team.</li>
      <li><b>Situation:</b> home field, rest, travel miles, time zones, altitude, FCS opponents, conference and bowl games, kickoff wind, temperature and rain.</li>
      <li><b>Two models</b> (regularised regression + gradient-boosted trees) averaged; every season predicted only from earlier seasons.</li></ul>`);
}
function cResearch() {
  const F = CF.findings || [];
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> every idea below was tested on past college games and betting lines. ${typeof lkUsedHTML === 'function' ? lkUsedHTML('cfb', 'college') : 'These are tests on past games, not live bets.'}</div><div class="grid g2">${F.map(x => `<div class="card finding"><span class="ic ${x.verdict}">${{works: '✓', doesnt: '✗', neutral: '•', lesson: '!'}[x.verdict] || '•'}</span><div><h3>${esc(x.title)}</h3><p class="note">${esc(gpWords(x.text))}</p></div></div>`).join('')}</div>`;
}
