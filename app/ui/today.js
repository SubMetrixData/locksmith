// Locksmith :: Record. Two tabs:
//   Our bets           the live ledger first (reports/tracker.json, python -m locksmith.tracker): every ticket Locksmith logged,
//                      wins, losses and withdrawn, in dollars at the user's unit, with "we said X wins, we got Y" and how the lines
//                      moved; then each sport and bet type; then the complete list. Backtests come last, labelled as past games.
//   Us vs the market   reports/certificate.json (python -m locksmith.certify): where our numbers beat the market, at which moment,
//                      checked in R; the live projection scorecard (reports/scorecard.json); and the "There are no locks." box.
// Also the shared loaders and the projection-accuracy card the Model details pages use (stackCard).
let TRK = null, TRU = null, STK = null, SCD = null, RTAB = 'ours', RALL = false;
let UNIT_USD = 25;                                   // the user's unit size in dollars (More -> Settings; localStorage ls_unit)
try { UNIT_USD = +(localStorage.getItem('ls_unit') || 25) || 25; } catch (e) {}
try { const t = localStorage.getItem('lk-rtab'); if (t === 'ours' || t === 'market') RTAB = t; } catch (e) {}
const usd = u => '$' + (Math.round(u * UNIT_USD * 2) / 2).toFixed(2).replace(/\.00$/, '');
const SPORTNAME = {nfl: 'NFL', cfb: 'College football', nba: 'NBA', wnba: 'WNBA', nhl: 'NHL', ufc: 'UFC', props: 'Player props'};
const rcUsd = u => (typeof bUsd === 'function' ? bUsd((u || 0) * UNIT_USD, true) : usd(u));
const rcCents = u => { const v = Math.round((u || 0) * UNIT_USD * 100) / 100; return (v > 0 ? '+' : v < 0 ? '−' : '') + '$' + (Number.isInteger(v) ? Math.abs(v) : Math.abs(v).toFixed(2)); };   // one ticket: exact
const rcCls = u => (u || 0) > 0.0001 ? 'pos' : (u || 0) < -0.0001 ? 'neg' : '';
const rcDate = d => { try { return new Date(String(d).slice(0, 10) + 'T12:00').toLocaleDateString([], {month: 'short', day: 'numeric'}); } catch (e) { return ''; } };

async function trkLoad(force) {
  if (TRK && !force) return TRK;
  const r = typeof lkFetch === 'function' ? await lkFetch('get_tracker', 'tracker.json') : {__err: 'loader missing'};
  TRK = r && !r.__err ? r : {bets: [], summary: {}, __err: r && r.__err};
  return TRK;
}
async function truLoad() {
  if (TRU) return TRU;
  const r = typeof lkFetch === 'function' ? await lkFetch('get_truth', 'truth.json') : {};
  TRU = r && !r.__err ? r : {};
  return TRU;
}
async function stkLoad() {
  if (STK) return STK;
  const r = typeof lkFetch === 'function' ? await lkFetch('get_stack', 'stack.json') : {};
  STK = r && !r.__err ? r : {};
  return STK;
}
async function scdLoad() {
  const r = typeof lkFetch === 'function' ? await lkFetch('get_scorecard', 'scorecard.json') : {};
  SCD = r && !r.__err ? r : (SCD || {});
  return SCD;
}

// ---------------------------------------------------------------- Record: Our bets
function rcHonesty(H) {   // the worst-calibrated group with enough bets, in plain words
  const bad = (H || []).filter(h => h.n >= 15 && h.won < h.promised - 0.05).sort((a, z) => (a.won - a.promised) - (z.won - z.promised))[0];
  if (bad) return ` Our chances have run high on bets we rated ${Math.round(100 * bad.lo) || Math.round(100 * bad.promised)}% or more: they won ${Math.round(100 * bad.won)}%, while our chances said ${Math.round(100 * bad.promised)}%.`;
  const good = (H || []).filter(h => h.n >= 15);
  return good.length ? ' So far our chances have been close to what happened.' : '';
}
function rcTicket(b) {
  const res = b.status === 'graded' ? (b.result === 'win' ? `<span class="pos">Won ${rcCents(b.units)}</span>` : b.result === 'loss' ? `<span class="neg">Lost ${rcCents(b.units).replace('−', '')}</span>` : '<span>Push $0</span>')
    : b.status === 'closed' ? '<span class="muted">In progress</span>' : '<span class="muted">Not started</span>';
  const game = b.sport === 'ufc' ? '' : `${esc(b.away || '')} @ ${esc(b.home || '')}`;
  const moved = b.clv != null ? (b.clv > 0 ? 'line moved our way' : b.clv < 0 ? 'line moved against us' : 'line didn’t move') : '';
  const sub = [SPORTNAME[b.sport] || b.sport, game, b.withdrawn ? 'withdrawn before the start (still counts)' : '', moved].filter(Boolean).join(' · ');
  // plain words (props.js gpBetWords: "pa" -> "pts + ast"), and the price once: gpBetWords drops a "(−105)" suffix, so it is always appended
  const lab = typeof gpBetWords === 'function' ? gpBetWords(b.bet || '') : String(b.bet || '');
  const px = b.price != null && typeof bAm === 'function' && (typeof gpBetWords === 'function' || !/\([+\-−]?\d+\)\s*$/.test(String(b.bet || ''))) ? ' ' + bAm(b.price) : '';
  return `<div class="rc-tk${b.withdrawn ? ' wd' : ''}"><span class="d">${rcDate(b.date || b.start_utc)}</span><span class="b"><b>${esc(lab)}${px}</b><span>${sub}</span></span><span class="r">${res}</span></div>`;
}
function rcRow(name, x, chips) {
  const wl = x && (x.wins != null) ? `${x.wins}–${x.losses}${x.pushes ? '–' + x.pushes : ''}` : '–';
  const u = x ? (x.units || 0) : 0;
  return `<div class="rc-row"><span class="rc-n">${name}</span><span class="rc-wl">${wl}</span><span class="rc-usd ${rcCls(u)}">${x && (x.graded || x.n) ? rcUsd(u) : ''}</span><span class="rc-c">${chips || ''}</span></div>`;
}
function rcOurs() {
  // the complete record (props.js gpTracker): every ticket Today showed counts once, the Board's own tickets included
  const T = TRK || {}, TC = typeof gpTracker === 'function' ? gpTracker(T) : {summary: T.summary || {}, by_sport: T.by_sport || {}, bets: T.bets || [], board: 0};
  const S = TC.summary || {}, B = TC.bets || [];
  if (T.__err && !B.length) return `<div class="lk-note err"><b>Couldn’t load the live record.</b> ${esc(T.__err)}. Nothing has been deleted: the ledger lives in data/tracker/ and shows here again after the next update.</div>`;
  if (!S.bets && !B.length) return '<div class="lk-empty">No bets logged yet. Every bet Today shows is logged the moment it appears and graded after the game.</div>';
  const since = B.map(b => String(b.date || '').slice(0, 10)).filter(Boolean).sort()[0];
  const g = B.filter(b => b.status === 'graded' && (b.result === 'win' || b.result === 'loss'));
  const cl = g.filter(b => b.clv != null), our = cl.filter(b => b.clv > 0).length, ag = cl.filter(b => b.clv < 0).length, no = cl.length - our - ag;
  const wd = B.filter(b => b.withdrawn), wdg = wd.filter(b => b.status === 'graded'), wdw = wdg.filter(b => b.result === 'win').length, wdl = wdg.filter(b => b.result === 'loss').length;
  const said = S.expected_wins != null ? Math.round(S.expected_wins) : null;
  const vn = S.value_vs_close_n != null ? ` (on the ${S.value_vs_close_n} bets with a closing number)` : '';     // the sample it is judged on
  const luck = S.expected_units != null ? (S.expected_units >= 0
      ? ` Judged by where the lines closed${vn}, these bets were worth about <b>${rcUsd(S.expected_units)}</b>. The market moved our way.`
      : ` Judged by where the lines closed${vn}, these bets were worth about <b>${rcUsd(S.expected_units)}</b>.${(S.units || 0) > S.expected_units ? ' We’re ahead on luck so far.' : ''}`) : '';
  const head = `<div class="rc-head">
      <div class="rc-big">${S.wins ?? 0}–${S.losses ?? 0}${S.pushes ? '–' + S.pushes : ''} · <span class="${rcCls(S.units)}">${rcUsd(S.units)}</span> <small>at ${'$' + UNIT_USD} a unit${since ? ' · since ' + rcDate(since) : ''}</small></div>
      ${said != null ? `<p><b>We said ${said} wins. We got ${S.wins ?? 0}.</b>${rcHonesty(T.honesty)}</p>` : ''}
      ${cl.length ? `<p>Lines moved our way on ${our} bet${our === 1 ? '' : 's'}, against us on ${ag}, and didn’t move on ${no}.${luck}</p>` : luck ? `<p>${luck.trim()}</p>` : ''}
      <p class="lk-small">${S.graded ?? g.length} graded bets${S.closed ? `, ${S.closed} in progress` : ''}${S.open ? `, ${S.open} not started` : ''}. ${(S.graded || 0) < 500 ? 'That is too few to tell skill from luck. ' : ''}Every ticket counts, including the ${wd.length} we withdrew before the start (${wdw}–${wdl} so far)${TC.board ? ` and the ${TC.board} the Today screen logged on its own` : ''}; the same bet never counts twice. ${T.ledger_note ? esc(T.ledger_note) : 'Nothing is deleted for its result. On Nov 6 we merged 12 duplicate UFC tickets (the same fighter logged twice when fight ids shifted; 2 of them were graded, one win and one loss), so each pick counts once.'}</p>
    </div>`;
  const by = TC.by_sport || {};
  const sports = Object.keys(by).length ? `<h3 class="lk-h">By sport</h3><div class="lk-list">${LK_ORDER_SAFE().filter(s => by[s]).map(s => rcRow(SPORTNAME[s] || s, by[s], by[s].open ? `<small>${by[s].open} to play</small>` : '')).join('')}</div>` : '';
  const LV = (typeof BETS !== 'undefined' && BETS && BETS.live) || {}, FR = LV.families || {}, weak = LV.weak || {}, shown = new Set(LV.shown || []);
  const SU = (typeof SUSP !== 'undefined' && SUSP) || {}, suKeys = Object.keys(SU).filter(k => SU[k] && typeof SU[k] === 'object' && SU[k].why);
  // a bet type is paused when its own live record says so (bets.json live.weak) or its whole market is pulled (suspended.json: "nba|spread")
  const pausedBy = f => { const w = weak[f]; if (w) return w; const k = suKeys.find(k => { const [s, m] = k.split('|'); return String(f).startsWith(s + '_') && (String(f).includes(m) || (m === 'spread' && /_move$/.test(f) && !/total/.test(f))); }); return k ? SU[k].why : null; };
  const famRows = Object.entries(FR).filter(([, x]) => x && x.n).sort((a, z) => z[1].n - a[1].n).map(([f, x]) => { const pz = pausedBy(f); return rcRow(esc(lkFamName(f)), x,
    pz ? `<span class="bdg b-paused" title="${esc(pz)}">Paused</span>` : shown.has(f) ? '<span class="bdg b-passed" title="Passed testing on games the model never saw, and bet on Today right now">Passed testing</span>' : ''); });
  const types = famRows.length ? `<h3 class="lk-h">By bet type <small>live, on the bets Today showed</small></h3><div class="lk-list">${famRows.join('')}</div>${suKeys.length ? `<p class="lk-small">Paused: ${suKeys.map(k => esc(SU[k].why)).join(' ')} Off until they are re-tested.</p>` : ''}` : '';
  // (the Today screen's own log used to sit here as a separate line; its tickets are now inside every total above, once each)
  const board = '';
  const list = [...B].sort((a, z) => String(z.start_utc || z.date || '').localeCompare(String(a.start_utc || a.date || '')) || String(z.first_seen || '').localeCompare(String(a.first_seen || '')));
  const shownList = RALL ? list : list.slice(0, 25);
  const every = `<h3 class="lk-h">Every bet, latest first <small>${list.length} tickets</small></h3><div class="lk-list">${shownList.map(rcTicket).join('')}</div>
    ${list.length > 25 ? `<p class="lk-small"><button type="button" class="lk-link" id="rcAll">${RALL ? 'Show the latest 25' : `Show all ${list.length}`}</button></p>` : ''}`;
  const past = `<h3 class="lk-h">Past games (backtest), not live bets</h3>
    <p class="lk-small">How each sport’s rules would have done on past seasons, using only what was known before each game. These are not live bets, and they are never added to the record above.</p>
    <div class="lk-list">${['nfl', 'cfb', 'nba', 'nhl', 'ufc'].map(s => `<button type="button" class="rc-row rc-past" data-past="${s}"><span class="rc-n">${SPORTNAME[s]}</span><span class="rc-wl"></span><span class="rc-usd"></span><span class="rc-c"><small>past seasons, replayed with today’s rules</small> <span class="bdg b-market">Backtest</span> ›</span></button>`).join('')}</div>`;
  return head + sports + types + board + every + past;
}
const LK_ORDER_SAFE = () => (typeof LK_ORDER !== 'undefined' ? LK_ORDER : ['nfl', 'cfb', 'nba', 'wnba', 'nhl', 'ufc']);

// ---------------------------------------------------------------- Record: Us vs the market
function rcList(xs) { return xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]; }
// a passed test, counted the way the certificate's own headline counts it: a "model on its own" companion cell (nhl|total_model)
// only backs up its main cell, so it is not a separate place where we beat the market
const rcPassed = c => c.verdict === 'better' && !/_model$/.test(String(c.quantity || ''));
const rcCompanion = c => c.verdict === 'better' && /_model$/.test(String(c.quantity || ''));
function rcNoLocks(C, since) {
  const live = `Our live record started on ${since ? rcDate(since) : 'the first day'} and includes every pick. Next to it we show what our own odds expected and how often the lines moved our way, so you can judge skill versus luck for yourself.`;
  if (!C) return `<div class="nolocks"><h3>There are no locks.</h3><p>Sportsbook prices are very accurate. We start from the market’s number and only move off it where tests on games the model never saw prove we’re closer. That test, our accuracy certificate, is being built; until it is done, every chance and score we show is the market’s own number. ${live}</p></div>`;
  const cells = Object.values(C.cells || {}), better = cells.filter(rcPassed);
  // summarised by sport (the tests themselves are listed right below the box)
  const where = xs => { const sp = LK_ORDER_SAFE().filter(s => xs.some(c => c.sport === s)).map(s => SPORTNAME[s] === 'College football' ? 'college football' : SPORTNAME[s] || s); return `${xs.length} test${xs.length === 1 ? '' : 's'} (${rcList(sp)})`; };
  const cur = better.filter(c => c.timing !== 'open'), op = better.filter(c => c.timing === 'open');
  const a = cur.length ? `At game time our numbers did better than the closing line in ${where(cur)}. Everywhere else they are about as accurate as the closing line, no better, so there we show the market’s own number.`
    : 'At game time, Locksmith’s numbers are about as accurate as the closing line: no better, no worse. So at game time we show the market’s own number.';
  const b = op.length ? ` Where we did better in testing is early, at the opening line: ${where(op)}. The market usually catches up by game time, so those bets only count while the line hasn’t moved.` : '';
  return `<div class="nolocks"><h3>There are no locks.</h3><p>Sportsbook prices are very accurate. ${a}${b} Those are backtests on past games. ${live}</p></div>`;
}
function rcCell(c) {
  const k = c.verdict === 'better' ? (c.timing === 'open' ? 'beats_opener' : 'beats_market') : 'market';
  const b = {kind: k, text: c.plain || '', cell: c};
  const n = v => v == null ? '–' : typeof v === 'number' ? (Math.abs(v) < 10 ? v.toFixed(4) : v.toLocaleString()) : esc(String(v));
  const nums = [['Measure', esc(c.metric || '')], ['Games tested', c.n != null ? Number(c.n).toLocaleString() : '–'], ['Seasons', esc(String(c.seasons ?? '–'))], ['Locksmith', n(c.locksmith)], ['Market', n(c.market)],
    ['Gain', c.gain_pct != null ? `${(+c.gain_pct).toFixed(2)}%` : n(c.gain)], ['t', c.t != null ? (+c.t).toFixed(2) : '–'], ['95% range of the gain', Array.isArray(c.ci95) ? c.ci95.map(v => (+v).toFixed(4)).join(' to ') : '–'],
    ['Seasons better', c.seasons_better_n != null && c.seasons_scored ? `${c.seasons_better_n} of ${c.seasons_scored}` : c.seasons_better != null && isFinite(+c.seasons_better) ? `${Math.round(100 * c.seasons_better)}%` : '–'], ['R says', esc(String(c.r_verdict ?? '–'))], c.live ? ['Live so far', `${c.live.n ?? 0} games, ${esc(String(c.live.verdict || 'too few to tell'))}`] : null].filter(Boolean);
  const lab = c.label || `${c.sport} ${c.quantity}`, when = /opener|opening|game time|fight time|before the game/i.test(lab) ? '' : (c.timing === 'open' ? ' at the opening line' : ' at game time');
  return `<div class="rc-cell"><span class="n">${esc(lab + when)}</span>
    <span class="c">${lkBadgeHTML(b)}</span>${c.plain ? `<p class="p">${esc(c.plain)}</p>` : ''}
    <details class="lk-more"><summary>Show the numbers</summary><div class="lk-nums">${nums.map(([x, y]) => `<span>${x}: <b>${y}</b></span>`).join('')}</div></details></div>`;
}
function rcScore() {
  const S = (SCD && SCD.sports) || {}, ks = LK_ORDER_SAFE().filter(s => S[s] && S[s].last_look && S[s].last_look.games);
  const rows = ks.map(s => { const L = S[s].last_look, m = L.margin, t = L.total;
    const part = (lab, x) => x ? `${lab}: us ${x.closer}, market ${x.market_closer}${x.ties ? `, tied ${x.ties}` : ''}` : '';
    return `<div class="rc-row"><span class="rc-n">${SPORTNAME[s] || s}</span><span class="rc-wl">${L.games} game${L.games === 1 ? '' : 's'}</span><span class="rc-usd"></span><span class="rc-c"><small>${[part('margin', m), part('total', t)].filter(Boolean).join(' · ')}</small></span></div>`; });
  const tot = ks.reduce((a, s) => a + S[s].last_look.games, 0);
  return `<h3 class="lk-h">The live scorecard <small>${SCD && SCD.snapshots ? `${Number(SCD.snapshots).toLocaleString()} projections logged` : ''}</small></h3>
    <p class="lk-small">Before every game we log our projected margin and total next to the market’s, and after the final we check which landed closer. Counts are the games where each number was closer.</p>
    ${rows.length ? `<div class="lk-list">${rows.join('')}</div><p class="lk-small">${tot} graded game${tot === 1 ? '' : 's'} so far: far too few to say anything. It takes hundreds.</p>` : '<div class="lk-empty">No games graded yet. The first results appear after tonight’s finals.</div>'}`;
}
function rcMarket() {
  const C = typeof CERT !== 'undefined' ? CERT : null, since = ((TRK && TRK.bets) || []).map(b => String(b.date || '').slice(0, 10)).filter(Boolean).sort()[0];
  const intro = '<p class="lk-lead">We start from the market’s number. We only move off it where tests on games we never trained on prove we’re closer.</p>';
  if (!C) return intro + `<div class="lk-note warn"><b>Our accuracy certificate is being built.</b> It tests every sport, at game time and at the opening line, on games the model never saw, and checks the result in R. Until it is done, every chance and score in Locksmith is the market’s own number.</div>` + rcScore() + rcNoLocks(null, since);
  const cells = Object.values(C.cells || {}).filter(c => !rcCompanion(c));      // (companions back up a passed cell; not counted twice)
  const better = cells.filter(rcPassed).sort((a, z) => (a.timing === 'open') - (z.timing === 'open') || String(a.label || '').localeCompare(String(z.label || '')));
  const rest = cells.filter(c => !better.includes(c));
  const nNow = better.filter(c => c.timing !== 'open').length, nOpen = better.length - nNow;
  const bySport = LK_ORDER_SAFE().map(s => [s, rest.filter(c => c.sport === s)]).filter(([, xs]) => xs.length);
  const restRows = bySport.map(([s, xs]) => { const t = xs.filter(c => c.verdict === 'tie').length, w = xs.length - t;
    return `<div class="rc-cell"><span class="n">${SPORTNAME[s] || s}</span><span class="c"><span class="bdg b-market">Market’s number</span></span>
      <p class="p">${xs.length} test${xs.length === 1 ? '' : 's'}: ${t ? `${t} tied the market` : ''}${t && w ? ', ' : ''}${w ? `${w} did worse` : ''}. Here we show the market’s own number.</p>
      <details class="lk-more"><summary>See each test</summary><div class="lk-list" style="margin-top:8px">${xs.map(rcCell).join('')}</div></details></div>`; }).join('');
  return intro + rcNoLocks(C, since) + `
    <h3 class="lk-h">Where we beat the market or the opening line <small>${nNow} at today’s price, ${nOpen} at the opening line · ${better.length} of ${cells.length} tests passed${C.generated ? ` · checked ${esc(C.generated)}` : ''}</small></h3>
    ${C.standard ? `<p class="lk-small">The test: ${esc(C.standard)}</p>` : ''}
    ${better.length ? `<div class="lk-list">${better.map(rcCell).join('')}</div>` : '<div class="lk-empty">Nothing passed yet. Every number we show is the market’s.</div>'}
    <h3 class="lk-h">Everywhere else <small>the market’s number</small></h3><div class="lk-list">${restRows}</div>` + rcScore();
}
async function recordRender() {
  $('#title').textContent = 'Record';
  $('#eyebrow').textContent = 'Every bet we’ve shown, and how our numbers compare with the market’s';
  const v = $('#view');
  v.innerHTML = '<div class="lk-empty">Loading the record…</div>';
  await Promise.allSettled([trkLoad(), typeof certLoad === 'function' ? certLoad() : null, scdLoad(), typeof suspLoad === 'function' ? suspLoad() : null, typeof betsLoad === 'function' ? betsLoad() : null]);
  if (VIEW !== 'record' || String(RECSUB).startsWith('past:')) return;
  const tab = (k, l) => `<button type="button" class="${RTAB === k ? 'on' : ''}" data-rtab="${k}">${l}</button>`;
  v.innerHTML = `<div class="lk-tabs" role="tablist">${tab('ours', 'Our bets')}${tab('market', 'Us vs the market')}</div>` + (RTAB === 'market' ? rcMarket() : rcOurs());
  v.querySelectorAll('[data-rtab]').forEach(b => b.onclick = () => { RTAB = b.dataset.rtab; try { localStorage.setItem('lk-rtab', RTAB); } catch (e) {} recordRender(); });
  const ra = $('#rcAll'); if (ra) ra.onclick = () => { RALL = !RALL; recordRender(); };
  v.querySelectorAll('[data-past]').forEach(b => b.onclick = () => { RECSUB = 'past:' + b.dataset.past; render(); window.scrollTo(0, 0); });
}

// ---------------------------------------------------------------- projection accuracy vs the market (reports/stack.json), on Model details
async function stackCard(sport) {
  const host = document.querySelector('#view');
  if (!host || VIEW !== 'model') return;
  const S = await stkLoad();
  if (VIEW !== 'model' || SPORT !== sport) return;
  const MK = {margin: 'Final margin', total: 'Total points'}, unit = sport === 'nhl' ? 'goals' : 'points';
  const rows = [];
  for (const mk of ['margin', 'total']) {
    for (const at of ['open', 'close']) {
      const r = S[`${sport}_${mk}${at === 'open' ? '_open' : ''}`];
      if (!r || !r.mae) continue;
      const m = r.mae, best = m[r.method], used = r.use;
      rows.push(`<tr class="${used ? 'pos' : ''}"><td>${MK[mk]}</td><td>${at === 'open' ? 'Opening line' : 'Closing line'}</td><td class="r num">${(r.n || 0).toLocaleString()}</td><td class="r num">${fx(m.line, 2)}</td><td class="r num"><b>${fx(best, 2)}</b></td><td class="r num ${best < m.line ? 'pos' : 'neg'}">${sgn(100 * (m.line - best) / m.line, 1)}%</td><td class="r num">${(r.seasons_better || {})[r.method] ?? '–'} of ${r.seasons ?? '–'}</td><td>${used ? 'yes' : 'no: ties the line'}</td></tr>`);
    }
  }
  if (!rows.length) return;
  const html = card('Is the projection more accurate than the market?', `Average miss in ${unit} on the final score, every season predicted by a fit that only saw earlier seasons (backtest: past games, not live bets). The badge you see on Today and Games comes from the accuracy certificate (Record → Us vs the market), not from this table.`,
    table([{l: 'Market'}, {l: 'Compared with'}, {l: 'Games', r: 1}, {l: 'Line’s miss', r: 1}, {l: 'Our miss', r: 1}, {l: 'Better by', r: 1}, {l: 'Seasons better', r: 1}, {l: 'Used'}], rows));
  const old = document.querySelector('#stackCard'); if (old) old.remove();
  host.insertAdjacentHTML('beforeend', `<div id="stackCard">${html}</div>`);
}
// kept for older callers: the per-sport projection scorecard now lives on Record -> Us vs the market
async function scorecardCard(sport) { return null; }
