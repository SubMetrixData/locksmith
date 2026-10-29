// Locksmith :: Today. Every sport's suggested bets on one timeline, by start time. A bet leaves the suggestions the
// moment its game starts (betting is closed) and moves to "Closed", where the tracker grades it once it is final.
// Data: each sport's app data + reports/tracker.json (python -m locksmith.tracker).
let TD = {day: 0, minp: 0}, TRK = null;
let UNIT_USD = 25;                                   // the user's unit size in dollars
try { UNIT_USD = +(localStorage.getItem('ls_unit') || 25) || 25; } catch (e) {}
const usd = u => '$' + (Math.round(u * UNIT_USD * 2) / 2).toFixed(2).replace(/\.00$/, '');
try { TD.minp = +(localStorage.getItem('ls_minp') || 0); } catch (e) {}
const tdDate = k => { const d = new Date(); d.setDate(d.getDate() + k); return d.toLocaleDateString('en-CA'); };
const SPORTNAME = {nfl: 'NFL', cfb: 'College football', nba: 'NBA', wnba: 'WNBA', nhl: 'NHL', ufc: 'UFC', props: 'Player props (NBA + NHL)'};
const tdPrice = (bet, fallback) => { const m = String(bet || '').replace('−', '-').match(/\(([+-]?\d+)\)\s*$/); return m ? +m[1] : (fallback != null ? +fallback : -110); };
const tdPay = a => a < 0 ? 100 / -a : a / 100;
const tdAm = a => a == null || !isFinite(a) ? '–' : (a > 0 ? '+' : '−') + Math.abs(Math.round(a));
const tdFair = p => !(p > 0 && p < 1) ? null : p >= .5 ? -100 * p / (1 - p) : 100 * (1 - p) / p;
const tdKelly = (p, a) => { if (!(p > 0)) return 1; const b = tdPay(a), k = (p * (b + 1) - 1) / b; return k > 0 ? Math.min(2, Math.max(.5, Math.round(25 * k * 2) / 2)) : .5; };
const tdWhen = iso => { try { return new Date(iso).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}); } catch (e) { return ''; } };
function tdIn(iso) {
  const m = Math.round((new Date(iso) - Date.now()) / 60000);
  if (!isFinite(m)) return '';
  if (m <= 0) return 'started';
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return h < 24 ? `in ${h}h${r ? ' ' + r + 'm' : ''}` : `in ${Math.round(h / 24)} day${h >= 36 ? 's' : ''}`;
}
function nflStart(b) {   // gameday + kickoff (Eastern) -> ISO: try EDT then EST, keep the one that is that hour in New York
  try {
    const [y, mo, d] = b.gameday.split('-').map(Number), [h, mi] = String(b.kick_et).split(':').map(Number);
    for (const off of [4, 5]) {
      const t = new Date(Date.UTC(y, mo - 1, d, h + off, mi));
      if (+t.toLocaleString('en-US', {timeZone: 'America/New_York', hour: 'numeric', hour12: false}) % 24 === h) return t.toISOString();
    }
  } catch (e) {}
  return null;
}
let TRU = null;
async function truLoad() {
  if (TRU) return TRU;
  try { TRU = (window.pywebview && window.pywebview.api && window.pywebview.api.get_truth) ? await window.pywebview.api.get_truth() : await (await fetch('../../reports/truth.json', {cache: 'no-store'})).json(); }
  catch (e) { TRU = {}; }
  return TRU;
}
function relSVG(rel) {   // promised (x) vs won (y), out of sample; the diagonal is perfect honesty
  const lo = Math.max(0, Math.min(...rel.map(r => Math.min(r.promised, r.won))) - .03), hi = Math.min(1, Math.max(...rel.map(r => Math.max(r.promised, r.won))) + .03);
  const S = 132, P = 16, sc = v => P + (S - 2 * P) * (v - lo) / (hi - lo || 1);
  const pts = rel.map(r => `<line x1="${sc(r.promised)}" x2="${sc(r.promised)}" y1="${S - sc(Math.max(lo, r.won - 1.64 * r.se))}" y2="${S - sc(Math.min(hi, r.won + 1.64 * r.se))}" class="rel-e"/><circle cx="${sc(r.promised)}" cy="${S - sc(r.won)}" r="${3 + Math.min(4, r.n / 400)}" class="rel-p"/>`).join('');
  return `<svg viewBox="0 0 ${S} ${S}" class="relsvg" role="img" aria-label="promised vs won"><rect x="${P}" y="${P}" width="${S - 2 * P}" height="${S - 2 * P}" class="rel-bg"/><line x1="${sc(lo)}" y1="${S - sc(lo)}" x2="${sc(hi)}" y2="${S - sc(hi)}" class="rel-d"/>${pts}
    <text x="${S / 2}" y="${S - 2}" class="rel-t">promised</text><text x="4" y="${S / 2}" class="rel-t" transform="rotate(-90 8 ${S / 2})">won</text></svg>`;
}
function tdProof() {
  const T = TRU || {}, fams = Object.entries(T).filter(([k, v]) => v && v.eval_open && v.eval_open.reliability && v.eval_open.reliability.length);
  if (!fams.length) return '';
  const tile = ([k, v]) => { const e = v.eval_open, g = v.eval || {}, m = v.move || {};
    const gain = 100 * (e.logloss_naive - e.logloss) / e.logloss_naive;
    return `<div class="reltile"><b>${esc(v.what)}</b>${relSVG(e.reliability)}<div class="note"><b>${(e.n || 0).toLocaleString()}</b> bets, each season scored by a calibration built on earlier seasons only. Log loss ${fx(e.logloss, 3)} vs ${fx(e.logloss_naive, 3)} for the ${k.endsWith('_ml') ? 'opening price' : 'coin-flip line'} (${sgn(gain, 1)}% better).${m.direction_right != null && m.mae_move < m.mae_no_move ? ` The line moved the way Locksmith expected ${pct(m.direction_right)} of the time.` : ''}</div></div>`; };
  const nfl = T.nfl ? Object.entries(T.nfl).map(([k, r]) => `${k.replace('_', ' ')} ${r.record} → ${pct(r.p, 1)} (likely ${pct(r.lo)}–${pct(r.hi)})`).join(' · ') : '';
  const TP = T.true_prob || {}, nm = {nba: 'NBA', nhl: 'NHL', ufc: 'UFC', cfb: 'College football'};
  const tpTable = Object.keys(TP).length ? `<p class="note" style="margin-top:10px"><b>Who wins each game: Locksmith vs the sportsbook's closing line</b> (the sharpest public forecast), every season scored on games the model never saw. Lower log loss = more accurate.</p>` + table([{l: 'Sport'}, {l: 'Games', r: 1}, {l: 'Closing line', r: 1}, {l: 'Locksmith + market', r: 1}, {l: 'Seasons better', r: 1}, {l: 'Shown on game pages'}],
    Object.entries(TP).map(([k, v]) => `<tr><td>${nm[k] || k}</td><td class="r num">${(v.n || 0).toLocaleString()}</td><td class="r num">${fx(v.ll_market, 4)}</td><td class="r num ${v.gain > 0 ? 'pos' : ''}">${fx(v.ll_true, 4)}</td><td class="r num">${v.seasons_better}/${v.seasons}</td><td>${v.gain > 0 && v.t >= 2 && v.seasons_better * 2 >= v.seasons ? '<b>Locksmith + market</b> (clearly more accurate than the close)' : v.gain > 0 ? 'the market\u2019s own number (Locksmith + market was only a hair better: not proven)' : 'the market\u2019s own number (nothing beat it here at game time)'}</td></tr>`)) : '';
  return card('Are these chances honest?', 'Every bet type, scored on games its calibration had never seen. Each dot is a group of bets: how often Locksmith said they would win (across) vs how often they did (up), with the 90% range. On the diagonal = honest.',
    `${tpTable}<div class="relgrid" style="margin-top:12px">${fams.map(tile).join('')}</div>${nfl ? `<p class="note"><b>NFL rules</b> (record so far, with a 100-bet prior at break-even): ${esc(nfl)}.</p>` : ''}
     <p class="note"><b>What changed to make them honest:</b> every win chance now comes from history graded on information available when the bet was placed. Hockey’s history used tonight’s actual goalie and lineup, which nobody knows at the opening line. Rebuilt on the expected goalie and the previous game’s lineup, the early-line record went from +8.4% to <b>+6.0%</b> over 4,475 bets: still real, and now honest. A bet’s chance also moves with the market: a day out it is the open-time number, at the start it uses where the line has moved since.</p>`);
}
async function trkLoad() {
  if (TRK) return TRK;
  try { TRK = (window.pywebview && window.pywebview.api && window.pywebview.api.get_tracker) ? await window.pywebview.api.get_tracker() : await (await fetch('../../reports/tracker.json', {cache: 'no-store'})).json(); }
  catch (e) { TRK = {bets: [], summary: {}}; }
  return TRK;
}

async function tdCollect(day) {
  const out = [];
  await Promise.allSettled([typeof nhlLoad === 'function' ? nhlLoad() : null, typeof nbaLoad === 'function' ? nbaLoad() : null, typeof ufcLoad === 'function' ? ufcLoad() : null,
    typeof cfbLoad === 'function' ? cfbLoad() : null]);
  const push = o => { const T = o.truth || {}; o.p = T.p != null ? T.p : o.chance; o.lo = T.lo; o.hi = T.hi; o.price = o.price != null ? o.price : tdPrice(o.bet);
    if (T.best && T.best.price != null) { o.consensus = o.price; o.price = T.best.price; o.book = T.best.book || null; } out.push(o); };
  // NFL
  if (typeof D !== 'undefined' && D && D.books) {
    for (const b of D.books.filter(b => b.gameday === day)) {
      const p = b.brief && b.brief.the_pick, st = b.kick_utc || nflStart(b);
      if (p && p.bet !== 'Pass') push({sport: 'nfl', kind: 'game', id: b.game_id, away: b.away, home: b.home, start: st, bet: p.bet, chance: p.win_chance, truth: p.truth, stars: p.stars || 1, note: p.why || '', cond: 'Check your price before you bet.'});
    }
    const games = new Map(D.books.filter(b => b.gameday === day).map(b => [`${b.away} @ ${b.home}`, b]));
    for (const p of ((D.props || {}).plays || []).filter(p => games.has(p.game))) {
      const [a, h] = p.game.split(' @ '), b = games.get(p.game);
      push({sport: 'nfl', kind: 'prop', id: null, away: a, home: h, pid: p.espn_id, player: p.player, team: p.team, start: b.kick_utc || nflStart(b), price: -115, bet: `${p.player} ${String(p.side).toLowerCase()} ${p.line} ${(typeof PMK !== 'undefined' && PMK[p.market] || p.market).toLowerCase()}`, chance: p.prob, stars: 1, note: p.why || '', cond: 'DraftKings line priced at −115; skip it at −130 or worse.'});
    }
  }
  const two = (sport, data, label) => {
    if (!data || !data.books) return;
    for (const b of data.books.filter(b => b.date === day)) {
      const pr = b.pricing || {}, p = pr.pick || {bet: 'Pass'};
      const many = pr.picks && pr.picks.length ? pr.picks : (p.bet !== 'Pass' ? [p] : []);
      many.forEach(q => push({sport, kind: 'game', id: b.game_id, away: b.away, home: b.home, start: b.start_utc, bet: q.bet, chance: q.win_chance, truth: q.truth, stars: q.stars || 1,
        note: [q.label, q.history].filter(Boolean).join('. '), cond: q.cond ? q.cond.charAt(0).toUpperCase() + q.cond.slice(1) + '.' : label}));
      if (!many.length && (p.thin || p.at_open)) out.push({sport, kind: 'better', id: b.game_id, away: b.away, home: b.home, start: b.start_utc, bet: p.thin || p.at_open, chance: p.win_chance_hist || null, stars: 0,
        note: p.thin ? `Playable at ${tdAm(p.playable_at)} or better.` : `Only at the opening line (${p.at_open}) or better.`, cond: ''});
    }
    const props = typeof pPlays === 'function' ? pPlays(data.props, data.books.filter(b => b.date === day)) : [];
    for (const x of props) {
      const b = data.books.find(b => +b.game_id === +x.game_id) || {};
      const pa = x.side === 'over' ? x.over_price : x.under_price;
      push({sport, kind: 'prop', id: x.game_id, away: b.away, home: b.home, pid: x.pid, player: x.player, team: x.team, start: b.start_utc, price: pa,
        bet: `${x.player} ${x.side} ${x.line} ${(PSTAT[sport][x.stat] || x.stat).toLowerCase()}`, chance: x.side === 'over' ? x.p_over : 1 - x.p_over, truth: x.truth, stars: 1,
        note: `Locksmith ${fx(x.proj, 1)} vs line ${x.line}. Tested prop rule.`, cond: 'Player props: small stakes.'});
    }
  };
  two('nhl', typeof N !== 'undefined' ? N : null, 'Only at today’s price or better (the value is in the early line).');
  if (typeof bbData === 'function') { two('nba', await bbData('nba'), 'Only while the spread is still the opening number or better.'); two('wnba', await bbData('wnba'), 'Only at the line shown or better.'); }
  if (typeof CF !== 'undefined' && CF) two('cfb', CF, 'Only at the line shown or better.');
  if (typeof UF !== 'undefined' && UF && UF.fights) {
    for (const f of UF.fights.filter(f => f.date === day && (f.state === 'pre' || !f.state))) {
      const p = f.pick, s = p.side;
      if (p.bet !== 'Pass') push({sport: 'ufc', kind: 'game', id: f.fight_id, fight: f, side: s, start: f.start, price: p.price, bet: p.bet, chance: p.win_chance, truth: p.truth, stars: p.stars || 1,
        note: `Opened ${tdAm(p.open)}, now ${tdAm(p.price)}.`, cond: 'Only at the opening price or better.'});
      else if (p.at_open) out.push({sport: 'ufc', kind: 'better', id: f.fight_id, fight: f, side: s, start: f.start, bet: p.at_open, chance: p.win_chance, stars: 0, note: `Playable at ${tdAm(p.playable_at)} or better.`, cond: ''});
    }
  }
  for (const o of out) {
    o.ev = o.p != null ? o.p * tdPay(o.price) - (1 - o.p) : null;
    o.fair = tdFair(o.p); o.stake = o.kind === 'prop' ? .5 : tdKelly(o.p, o.price);
  }
  return out;
}

function tdHead(x) {
  if (x.sport === 'ufc') { const f = x.fight, me = f[x.side], them = f[x.side === 'A' ? 'B' : 'A']; return {img: hshot('ufc', me.espn_id, me.name, 40), title: esc(me.name), sub: `vs ${esc(them.name)}`}; }
  if (x.kind === 'prop') return {img: hshot(x.sport, x.pid, x.player, 40), title: esc(x.player), sub: `${esc(x.away || '')} at ${esc(x.home || '')}`};
  return {img: `${tlogo(x.away, 26, x.sport)}<span class="tk-at">@</span>${tlogo(x.home, 26, x.sport)}`, title: `${esc(x.away)} at ${esc(x.home)}`, sub: ''};
}
function tdTicket(x) {
  const h = tdHead(x), lab = x.sport === 'nba' || x.sport === 'wnba' || (x.sport === 'cfb' && !/^(over|under)/i.test(x.bet)) ? 'to cover' : 'to win';
  const iv = x.lo != null && x.hi != null ? ` <span class="muted">(${pct(x.lo)}–${pct(x.hi)})</span>` : '';
  const T = x.truth || {}, dc = T.decay || {};
  const rb = T.robust === true ? `<span class="badge go" title="Bets like this still won at the game-time line">Holds to game time</span>` : T.robust === false ? `<span class="badge warn" title="Bets like this only won at the opening line">Bet early: fades by game time${dc.kind === 'win' && dc.open != null ? ` (${pct(dc.open)} at the opener, ${pct(dc.close)} at game time)` : dc.roi_open != null ? ` (${sgn(100 * dc.roi_open, 1)}% at the opener, ${sgn(100 * dc.roi_close, 1)}% at game time)` : ''}</span>` : '';
  const need = x.price != null ? (x.price < 0 ? -x.price / (-x.price + 100) : 100 / (x.price + 100)) : null;
  const per100 = x.ev != null ? 100 * x.ev : null;
  const strength = per100 == null ? '' : per100 >= 8 ? 'Strong value' : per100 >= 4 ? 'Good value' : per100 > 0.5 ? 'Thin value' : 'No value';
  const valueLine = x.p != null && need != null && x.kind !== 'better' ? `<div class="tdvalue"><b class="${per100 >= 4 ? 'pos' : ''}">${strength}:</b> you need ${pct(need, 1)} to break even at ${tdAm(x.price)}, bets like this win ${pct(x.p, 1)} → <b>${per100 >= 0 ? '+' : '−'}$${Math.abs(per100).toFixed(2)}</b> per $100, every time you make it.</div>` : '';
  const facts = x.p != null && x.kind !== 'better' ? `<div class="tdfacts"><span><b>${pct(x.p)}</b>${iv} true chance</span><span>fair ${tdAm(x.fair)}</span>${x.consensus != null ? `<span><b>best price ${tdAm(x.price)}</b> ${x.book ? 'at ' + esc(x.book) : '(best of 6 US books)'} <span class="muted">(most books ${tdAm(x.consensus)})</span></span>` : ''}<span class="${x.ev >= 0 ? 'pos' : 'neg'}">${sgn(100 * x.ev, 1)}% expected at ${tdAm(x.price)}</span><span>bet <b>${usd(x.stake)}</b> <span class="muted">(${fx(x.stake, 1)}u)</span></span>${x.truth && x.truth.close ? `<span>expected close <b>${esc(x.truth.close)}</b></span>` : ''}</div>` : '';
  return `<div class="ticket click tdt" data-td="${x.sport}|${x.id || ''}"><div class="tk-m">${h.img}<div class="tk-g"><b>${h.title}</b><span><span class="tdsp">${SPORTNAME[x.sport]}</span>${h.sub ? ' ' + h.sub : ''}</span></div></div>
    <div class="tk-b"><div class="tk-bet">${esc(x.bet)}${x.stars ? ` <span class="tk-st">${starHTML(x.stars)}</span>` : ''}</div>${valueLine}${facts}<div class="tk-n">${rb ? rb + ' ' : ''}${esc(x.note)}${x.cond ? ` <b>${esc(x.cond)}</b>` : ''}</div></div>
    <div class="tk-r">${x.p != null ? ring(x.p, lab) : ''}</div></div>`;
}
function tdClosedRow(r) {
  const st = r.status === 'graded' ? (r.result === 'win' ? `<span class="badge go">Won ${sgn(r.units, 2)}u</span>` : r.result === 'loss' ? `<span class="badge bad">Lost ${sgn(r.units, 2)}u</span>` : '<span class="badge">Push</span>')
    : '<span class="badge warn">In progress</span>';
  const score = r.home_score != null ? ` · ${r.away} ${Math.round(r.away_score)}, ${r.home} ${Math.round(r.home_score)}` : '';
  const clv = r.clv != null ? ` · ${r.clv > 0 ? 'beat' : r.clv < 0 ? 'missed' : 'matched'} the close${r.market !== 'ml' ? ` by ${fx(Math.abs(r.clv), 1)}` : ''}` : '';
  return `<tr><td><span class="tdsp">${SPORTNAME[r.sport] || r.sport}</span> ${esc(r.sport === 'ufc' ? r.pick_team : `${r.away} at ${r.home}`)}</td><td><b>${esc(r.bet)}</b>${r.withdrawn ? ' <span class="muted">(withdrawn before start)</span>' : ''}<div class="muted">${pct(r.p)} · ${fx(r.stake, 1)}u${score}${clv}</div></td><td class="r">${st}</td></tr>`;
}
function tdRecord() {
  const S = (TRK && TRK.summary) || {}, H = (TRK && TRK.honesty) || [];
  if (!S.bets) return card('Tracked record', 'Every suggested bet is logged when it first appears and graded when final. Nothing has been graded yet.', '');
  const by = (TRK.by_sport) || {};
  return card('Tracked record', 'Every bet Locksmith suggested, logged the first time it appeared (that line and price count, even if the suggestion was later withdrawn) and graded at the final.',
    `<div class="answer">${[['Record', `${S.wins}-${S.losses}${S.pushes ? '-' + S.pushes : ''}`, `${S.graded} graded · ${S.closed} in progress · ${S.open} not started`],
      ['Units', sgn(S.units, 2), S.roi != null ? `${sgn(100 * S.roi, 1)}% per unit risked` : ''],
      ['Promised vs won', S.expected_wins != null ? `${fx(S.expected_wins, 1)} vs ${S.wins}` : '–', 'wins the shown chances added up to, vs actual'],
      ['Worth (line moves)', S.expected_units != null ? sgn(S.expected_units, 2) + 'u' : '–', 'what the closing lines say these bets were worth, luck removed'],
      ['Beat the closing line', S.beat_close != null ? pct(S.beat_close) : '–', 'how often we got a better number than the last one']].map(([l, v, s]) => `<div class="ans"><span class="l">${l}</span><b>${v}</b><span class="s">${s}</span></div>`).join('')}</div>`
    + (Object.keys(by).length > 1 ? table([{l: 'Sport'}, {l: 'Record', r: 1}, {l: 'Units', r: 1}, {l: 'Beat close', r: 1}], Object.entries(by).map(([s, x]) => `<tr><td>${SPORTNAME[s] || s}</td><td class="r num">${x.wins}-${x.losses}</td><td class="r num ${x.units >= 0 ? 'pos' : 'neg'}">${sgn(x.units, 2)}</td><td class="r num">${x.beat_close != null ? pct(x.beat_close) : '–'}</td></tr>`)) : '')
    + (H.length ? `<p class="note" style="margin-top:8px"><b>Honesty check:</b> ${H.map(h => `bets shown at ${pct(h.lo)}–${pct(Math.min(h.hi, 1))} won ${pct(h.won)} (${h.n})`).join(' · ')}.</p>` : ''));
}

async function tdAlerts() {   // desktop app only: opt-in Windows toast when a new NBA/NHL "Bet early" pick appears
  const el = $('#tdAlerts'), A = window.pywebview && window.pywebview.api;
  if (!el || !A || !A.get_alerts) return;
  let s; try { s = await A.get_alerts(); } catch (e) { return; }
  el.hidden = false;
  el.innerHTML = `<label class="muted"><input type="checkbox" id="tdAl" ${s.on ? 'checked' : ''}> Alert me (small Windows notification) when a new NBA or NHL “Bet early” pick appears</label>${s.on && s.pending ? ` <span class="muted">· next: ${esc(s.pending)}</span>` : ''}`;
  $('#tdAl').onchange = async e => { try { await A.set_alerts(e.target.checked); } catch (x) {} tdAlerts(); };
}

async function todayRender() {
  $('#title').textContent = 'Today'; $('#weeks').style.display = 'none';
  const ey = $('#eyebrow'); if (ey) ey.textContent = new Date().toLocaleDateString([], {weekday: 'long', month: 'long', day: 'numeric'});
  $('#view').innerHTML = '<div class="card empty">Gathering every sport’s bets…</div>';
  await Promise.allSettled([trkLoad(), truLoad()]);
  let day = tdDate(TD.day), items = await tdCollect(day);
  const now = Date.now(), live = x => x.start && new Date(x.start) > now;
  if (TD.day === 0 && !items.some(x => x.kind !== 'better' && live(x))) { const t = await tdCollect(tdDate(1)); if (t.length) { TD.auto = true; day = tdDate(1); items = t; } }
  if (VIEW !== 'today') return;
  const byTime = (a, z) => (new Date(a.start) - new Date(z.start)) || ((z.ev || 0) - (a.ev || 0));
  const allOpen = items.filter(x => x.kind === 'game' && (!x.start || live(x))).sort(byTime);
  const open = allOpen.filter(x => (x.p || 0) >= TD.minp - 1e-9);
  // bet of the day: the most confident bet still to start that has real value at its price (game bets first, then props);
  // if nothing has value today, the best remaining option, clearly marked as below the bar
  const valueOf = L => L.filter(x => x.p != null && (x.ev || 0) > 0.005).sort((a, z) => (z.p - a.p) || ((z.ev || 0) - (a.ev || 0)));
  const botd = valueOf(allOpen)[0] || valueOf(props)[0] || null;
  const botdWeak = !botd ? [...allOpen, ...props].filter(x => x.p != null).sort((a, z) => (z.ev || -9) - (a.ev || -9))[0] : null;
  const props = items.filter(x => x.kind === 'prop' && (!x.start || live(x))).sort(byTime);
  const better = items.filter(x => x.kind === 'better' && (!x.start || live(x)));
  const label = day === tdDate(0) ? 'today' : day === tdDate(1) ? 'tomorrow' : new Date(day + 'T12:00').toLocaleDateString([], {weekday: 'long'});
  // timeline: one block per start time
  const slots = []; for (const x of open) { const k = x.start ? tdWhen(x.start) : 'Time to be set'; let s = slots.find(s => s.k === k); if (!s) slots.push(s = {k, iso: x.start, items: []}); s.items.push(x); }
  const next = open.find(x => x.start);
  const stake = open.reduce((a, x) => a + (x.stake || 0), 0), exp = open.reduce((a, x) => a + (x.ev || 0) * (x.stake || 0), 0);
  const closedToday = ((TRK && TRK.bets) || []).filter(r => (r.date === day || (r.start_utc || '').slice(0, 10) === day) && r.status !== 'open');
  const bySport = Object.keys(SPORTNAME).map(s => [s, open.filter(x => x.sport === s).length]).filter(x => x[1]);
  const propRows = props.map(x => `<tr class="click" data-td="${x.sport}|${x.id || ''}"><td class="num">${x.start ? tdWhen(x.start) : ''}</td><td><span class="tdsp">${SPORTNAME[x.sport]}</span> <b>${esc(x.bet)}</b> <span class="muted">${tdAm(x.price)}</span></td><td class="r num">${pct(x.p)}</td><td class="r num ${x.ev >= 0 ? 'pos' : 'neg'}">${sgn(100 * x.ev, 1)}%</td></tr>`);
  $('#view').innerHTML = `<div class="verdict big1">${open.length ? `<b>${open.length} bet${open.length === 1 ? '' : 's'} left ${label}</b> across ${bySport.map(([s, n]) => `${SPORTNAME[s]} (${n})`).join(', ')}${props.length ? `, plus ${props.length} player prop${props.length === 1 ? '' : 's'}` : ''}.${next ? ` Next starts <b>${tdWhen(next.start)}</b> (${tdIn(next.start)}).` : ''}` : `<b>No game bets left ${label}.</b>${props.length ? ` ${props.length} player props below.` : ' Nothing still to start clears the bar.'}`}${TD.auto ? ' Today’s card is done, so this shows tomorrow.' : ''}</div>
    <div class="chips">${[0, 1, 2].map(k => `<button class="chip ${TD.day === k || (TD.auto && k === 1 && TD.day === 0) ? 'on' : ''}" data-tdd="${k}">${k === 0 ? 'Today' : k === 1 ? 'Tomorrow' : new Date(tdDate(2) + 'T12:00').toLocaleDateString([], {weekday: 'long'})}</button>`).join('')}</div>
    <div id="tdAlerts" hidden></div>
    ${open.length ? `<div class="answer tdsum">${[['Bets left', open.length, `first ${next ? tdWhen(next.start) : '–'}, last ${tdWhen(open[open.length - 1].start)}`], ['Total stake', `${fx(stake, 1)}u`, '1u = 1% of your bankroll'], ['Expected profit', `${sgn(exp, 2)}u`, 'at the prices shown, if the chances are right'], ['Closed ' + label, closedToday.length, 'bets whose games have started']].map(([l, v, s]) => `<div class="ans"><span class="l">${l}</span><b>${v}</b><span class="s">${s}</span></div>`).join('')}</div>` : ''}
    ${(() => { const C = (TRU || {}).confidence || {}, tiersOf = th => Object.entries(C).map(([sp, L]) => [sp, (L || []).find(t => Math.abs(t.min - th) < 1e-9)]).filter(x => x[1]);
      const lab = {0: 'All value bets', 0.7: '70%+ chance', 0.8: 'Locks: 80%+'};
      const note = TD.minp > 0 ? tiersOf(TD.minp).map(([sp, t]) => `${sp.toUpperCase()} bets at ${pct(t.min)}+ won <b>${pct(t.won, 1)}</b> of ${t.bets.toLocaleString()} (${sgn(100 * t.roi, 1)}% return, about ${Math.round(t.per_year)} a year, typical price ${tdAm(t.median_price)})`).join(' · ') : '';
      return `<div class="chips">${[0, 0.7, 0.8].map(th => `<button class="chip ${Math.abs(TD.minp - th) < 1e-9 ? 'on' : ''}" data-tdm="${th}">${lab[th]}</button>`).join('')}</div>`
        + (TD.minp > 0 ? `<div class="verdict blue"><b>Higher confidence, fewer bets.</b> ${note || 'No history for this tier yet.'} Showing ${open.length} of ${allOpen.length} bets left ${label}. Nothing wins every time: these are heavy favourites that win most of the time and pay less when they do.</div>` : ''); })()}
    <div class="verdict amber"><b>How to read this.</b> Bets are in start order. The ring and “true chance” are what bets like this have actually won (with the likely range), not what the simulator hoped. “Fair” is the price at which the bet breaks even; better than that is value. Stakes are a quarter of the Kelly amount, capped at 2 units. A bet disappears from here the moment its game starts and is graded below once it is final.</div>`
    + (botd ? card('Bet of the day', `The most confident bet left ${label} that is still value at its price${botd.kind === 'prop' ? ' (a player prop: small stake)' : ''}.`, `<div class="tickets botd">${tdTicket(botd)}</div>`)
       : botdWeak ? card('Bet of the day', `Nothing left ${label} clears Locksmith's bar. This is the closest thing to value: skip it or use the minimum stake.`, `<div class="tickets botd">${tdTicket(botdWeak)}</div>`) : '')
    + (slots.length ? `<div class="tdline">${slots.map(s => `<div class="tdslot"><div class="tdtime"><b>${s.k}</b><span>${s.iso ? tdIn(s.iso) : ''}</span></div><div class="tickets">${s.items.map(tdTicket).join('')}</div></div>`).join('')}</div>` : '')
    + (props.length ? `<details class="card"><summary><b>Player props (${props.length})</b> <span class="muted">tested prop rules, by start time. Small stakes (0.5u): props are priced tightly.</span></summary>${table([{l: 'Start'}, {l: 'Prop'}, {l: 'Chance', r: 1}, {l: 'Expected', r: 1}], propRows, {h: 520})}</details>` : '')
    + (better.length ? card('Only at a better price', 'Locksmith liked these at the opening line; the line has moved past it.', `<div class="tickets">${better.map(x => tdTicket({...x, p: x.chance})).join('')}</div>`) : '')
    + (closedToday.length ? card(`Closed ${label}`, 'Games under way or finished: no longer suggested. Graded at the line and price first shown.', table([{l: 'Game'}, {l: 'Bet'}, {l: 'Result', r: 1}], closedToday.map(tdClosedRow))) : '')
    + (() => { const L = open.filter(x => x.ev != null && x.ev > 0); if (!L.length) return '';
        const ev = L.reduce((a, x) => a + x.ev, 0) / L.length;
        const sd = Math.sqrt(L.reduce((a, x) => { const b = tdPay(x.price); return a + x.p * (1 - x.p) * Math.pow(b + 1, 2); }, 0) / L.length);
        const Phi = z => { const t = 1 / (1 + .2316419 * Math.abs(z)), d = .3989423 * Math.exp(-z * z / 2), q = d * t * (.3193815 + t * (-.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - q : q; };
        const row = n => `<tr><td>${n.toLocaleString()} bets</td><td class="r num pos">${sgn(n * ev, 1)}u</td><td class="r num">${Phi(ev * Math.sqrt(n) / sd) > 0.99 ? '&gt;99%' : pct(Phi(ev * Math.sqrt(n) / sd))}</td><td class="r num">${sgn(n * ev - 1.645 * Math.sqrt(n) * sd, 1)}u</td></tr>`;
        return card('Why 55% is a winning number', `Spreads are set so each side is a coin flip, and the book charges about 4.5% to bet: you need 52.4% just to break even at −110. The best professional bettors win about 54–56% against the spread. Today\u2019s value bets average <b>${sgn(100 * ev, 1)}%</b> per bet. One bet is close to a coin flip; a habit of them is not:`,
          table([{l: 'Betting 1 unit on bets like these'}, {l: 'Expected profit', r: 1}, {l: 'Chance you are ahead', r: 1}, {l: 'Bad-luck case (1 in 20)', r: 1}], [100, 300, 1000].map(row))
          + '<p class="note">Assumes the honest chances are right (the tracker below checks that) and flat 1-unit stakes. Bets that win far more often exist (heavy favourites, some props: see Locks), but they pay less when they win, so they are not better bets, just steadier ones.</p>'); })()
    + tdRecord() + tdProof()
    + `<p class="note">Live betting picks change by the minute: see the <a href="#" id="toLive">Live</a> tab during games.</p>`;
  document.querySelectorAll('[data-tdd]').forEach(c => c.onclick = () => { TD.day = +c.dataset.tdd; TD.auto = false; todayRender(); });
  document.querySelectorAll('[data-tdm]').forEach(c => c.onclick = () => { TD.minp = +c.dataset.tdm; try { localStorage.setItem('ls_minp', String(TD.minp)); } catch (e) {} todayRender(); });
  const tl = $('#toLive'); if (tl) tl.onclick = e => { e.preventDefault(); go('live'); };
  tdAlerts();
  document.querySelectorAll('[data-td]').forEach(el => el.onclick = () => {
    const [s, id] = el.dataset.td.split('|');
    if (s === 'nhl') NGAME = +id; else if (s === 'nba' || s === 'wnba') BGAME = +id; else if (s === 'ufc') UFIGHT = id; else if (s === 'nfl') GAME = id; else if (s === 'cfb' && typeof CGAME !== 'undefined') CGAME = +id;
    if (s === 'nhl' && typeof NDATE !== 'undefined') NDATE = day; if ((s === 'nba' || s === 'wnba') && typeof BDATE !== 'undefined') BDATE = day;
    VIEW = 'game'; setSport(s); markNav(); render();
  });
  clearTimeout(TD.timer);                                // keep it current: a started game drops off without a reload
  TD.timer = setTimeout(() => { if (VIEW === 'today') todayRender(); }, 60000);
}


// ---------------------------------------------------------------- best bets for one sport (top of that sport's Picks page)
async function bestBets(sport) {
  const host = document.querySelector('#view');
  if (!host || VIEW !== 'slate' || SPORT !== sport) return;
  await Promise.allSettled([trkLoad(), truLoad()]);
  const now = Date.now(), all = [];
  for (let k = 0; k < 8; k++) { try { all.push(...(await tdCollect(tdDate(k))).filter(x => x.sport === sport)); } catch (e) {} }
  if (VIEW !== 'slate' || SPORT !== sport) return;
  const live = x => !x.start || new Date(x.start) > now;
  const seen = new Set();
  const val = all.filter(x => live(x) && x.kind !== 'better' && x.p != null && (x.ev || 0) >= (x.kind === 'prop' ? 0.02 : 0.02) && !seen.has(x.sport + x.id + x.bet) && seen.add(x.sport + x.id + x.bet));
  const games = val.filter(x => x.kind === 'game').sort((a, z) => (z.ev || 0) - (a.ev || 0)).slice(0, 5);
  const props = val.filter(x => x.kind === 'prop').sort((a, z) => (z.ev || 0) - (a.ev || 0)).slice(0, 3);
  const top = [...games, ...props];
  const total = top.reduce((a, x) => a + (x.stake || 0), 0), exp = top.reduce((a, x) => a + (x.ev || 0) * (x.stake || 0), 0);
  const when = x => { try { const d = new Date(x.start); const k = Math.round((new Date(d.toDateString()) - new Date(new Date().toDateString())) / 864e5); return (k === 0 ? 'Today' : k === 1 ? 'Tomorrow' : d.toLocaleDateString([], {weekday: 'short'})) + ' ' + d.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}); } catch (e) { return ''; } };
  const gen = {nfl: typeof D !== 'undefined' && D ? D.generated : null, nba: typeof NB !== 'undefined' && NB ? NB.generated : null, nhl: typeof N !== 'undefined' && N ? N.generated : null,
    ufc: typeof UF !== 'undefined' && UF ? UF.generated : null, cfb: typeof CF !== 'undefined' && CF ? CF.generated : null}[sport];
  const ageH = gen ? (Date.now() - new Date(String(gen).replace(' ', 'T'))) / 36e5 : null;
  const desk = !!(window.pywebview && window.pywebview.api);
  const fresh = ageH == null ? '' : ageH > 8 ? `<div class="verdict amber" style="margin:0 0 10px"><b>These picks are ${Math.round(ageH)} hours old.</b> Prices move, and Locksmith's edge is in getting the number first: ${desk ? 'the app updates itself every 6 hours while it is open; click Update to refresh now.' : 'this website is a snapshot. Open the desktop app (it updates itself) before betting.'}</div>` : `<p class="muted" style="margin:0 0 8px">Updated ${ageH < 1 ? 'less than an hour' : Math.round(ageH) + ' hour' + (Math.round(ageH) === 1 ? '' : 's')} ago.</p>`;
  const html = `<div class="card bestbets" id="bestBets"><div class="card-h"><div><h3>Best bets</h3><p class="sub">${top.length ? `The ${top.length === 1 ? 'one bet' : top.length + ' bets'} worth making in ${SPORTNAME[sport]} over the next week, best value first. 1 unit = $${UNIT_USD}: total <b>${usd(total)}</b>, expected profit <b>${exp >= 0 ? '+' : '−'}${usd(Math.abs(exp))}</b> if the chances are right. Each bet only counts at the price shown or better.` : `No ${SPORTNAME[sport]} bet clears the bar right now. Nothing is forced: check back after the next update.`}</p></div></div>
    ${fresh}
    ${top.length ? `<div class="tickets">${top.map(x => tdTicket({...x, note: [when(x), x.note].filter(Boolean).join(' · ')})).join('')}</div>` : ''}
    <div class="muted bb-unit">Unit size <input id="bbUnit" type="number" min="1" step="1" value="${UNIT_USD}" style="width:70px"> dollars <span id="tdAlerts" hidden></span></div></div>`;
  const old = document.querySelector('#bestBets'); if (old) old.remove();
  host.insertAdjacentHTML('afterbegin', html);
  host.querySelectorAll('#bestBets [data-td]').forEach(el => el.onclick = () => {
    const [s, id] = el.dataset.td.split('|'); const x = top.find(t => String(t.id) === id) || {};
    if (s === 'nhl') { NGAME = +id; if (typeof NDATE !== 'undefined' && x.start) NDATE = (x.date || NDATE); }
    else if (s === 'nba' || s === 'wnba') { BGAME = +id; } else if (s === 'ufc') UFIGHT = id; else if (s === 'nfl') GAME = id; else if (s === 'cfb' && typeof CGAME !== 'undefined') CGAME = +id;
    VIEW = 'game'; markNav(); render();
  });
  const u = document.querySelector('#bbUnit');
  if (u) u.onchange = () => { const v = +u.value; if (v > 0) { UNIT_USD = v; try { localStorage.setItem('ls_unit', String(v)); } catch (e) {} bestBets(sport); } };
  if (sport === 'nba' || sport === 'nhl') tdAlerts();
  mostLikely(sport);
}


// ---------------------------------------------------------------- most likely to win (no edge required: just the steadiest bets)
const LK_SD_CFB = 14.7;                                // college: chance from the spread (no moneyline in the feed)
const lkImp = a => a < 0 ? -a / (-a + 100) : 100 / (a + 100);
const lkNoVig = (a, b) => (a == null || b == null || !a || !b) ? null : lkImp(+a) / (lkImp(+a) + lkImp(+b));
const lkPhi = z => { const t = 1 / (1 + .2316419 * Math.abs(z)), d = .3989423 * Math.exp(-z * z / 2), q = d * t * (.3193815 + t * (-.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - q : q; };

function lkCollect(sport) {
  const out = [], now = Date.now(), soon = now + 7 * 864e5;
  const add = o => { if (o.p != null && o.start && new Date(o.start) > now && new Date(o.start) < soon) out.push(o); };
  const sides = (b, p, hp, ap, model, extra = {}) => {     // one game's moneyline: keep the favourite
    if (p == null) return;
    const home = p >= .5;
    add({sport, id: b.game_id, start: extra.start || b.start_utc, home: b.home, away: b.away, team: home ? b.home : b.away, opp: home ? b.away : b.home, at: home ? 'vs' : '@',
      bet: `${home ? b.home : b.away} to win`, p: home ? p : 1 - p, price: home ? hp : ap, model: model == null ? null : home ? model : 1 - model});
  };
  const BBD = sport === 'nba' || sport === 'wnba' ? (typeof NBC !== 'undefined' && NBC[sport]) : null;
  if (BBD) for (const b of BBD.books || []) {
    const L = b.lines || {}; sides(b, lkNoVig(L.ml_home, L.ml_away), L.ml_home, L.ml_away, b.sim && b.sim.p_home);
  }
  if (sport === 'nhl' && typeof N !== 'undefined' && N) for (const b of N.books || []) {
    const L = b.lines || {};
    sides(b, lkNoVig(L.ml_home, L.ml_away), L.ml_home_best || L.ml_home, L.ml_away_best || L.ml_away, b.sim && b.sim.p_home);
    if (L.pl_home != null && L.pl_home_price && L.pl_away_price) {    // the +1.5 puck line: the underdog can lose by one and still cash
      const ph = lkNoVig(L.pl_home_price, L.pl_away_price); if (ph == null) continue;
      const dogHome = L.pl_home > 0, p = dogHome ? ph : 1 - ph, t = dogHome ? b.home : b.away;
      add({sport, id: b.game_id, start: b.start_utc, home: b.home, away: b.away, team: t, opp: dogHome ? b.away : b.home, at: dogHome ? 'vs' : '@', bet: `${t} +1.5 goals`, p,
        price: dogHome ? L.pl_home_price : L.pl_away_price, model: b.sim ? (dogHome ? b.sim.p_home_p15 : b.sim.p_away_p15) : null, kind: 'pl'});
    }
  }
  if (sport === 'nfl' && typeof D !== 'undefined' && D) for (const b of D.books || []) {
    const nb = b.number_board || {}, ml = nb.market_ml || [];
    sides(b, nb.market_p_home_shin != null ? nb.market_p_home_shin : lkNoVig(ml[0], ml[1]), ml[0], ml[1], b.score && b.score.p_home_win, {start: b.kick_utc || nflStart(b)});
  }
  if (sport === 'cfb' && typeof CF !== 'undefined' && CF) for (const b of CF.books || []) {
    const L = b.lines || {}; if (L.spread == null) continue;
    sides(b, lkPhi(-L.spread / LK_SD_CFB), null, null, b.p_home);
  }
  if (sport === 'ufc' && typeof UF !== 'undefined' && UF) for (const f of UF.fights || []) {
    if (f.state && f.state !== 'pre') continue;
    const m = f.market || {}, T = f.true_prob || {}, pA = T.A != null ? T.A : m.p_now_A; if (pA == null) continue;
    const a = pA >= .5, me = a ? f.A : f.B, them = a ? f.B : f.A;
    add({sport, id: f.fight_id, start: f.start, team: me.name, opp: them.name, at: 'vs', bet: `${me.name} to win`, p: a ? pA : 1 - pA,
      price: a ? (m.best_A || m.now_A) : (m.best_B || m.now_B), model: T.model == null ? null : a ? T.model : 1 - T.model, ufc: true});
  }
  return out.sort((x, z) => z.p - x.p);
}

function lkHist(sport, p) {
  const H = ((TRU || {}).likely || {})[sport]; if (!H) return null;
  return (H.buckets || []).find(b => p >= b.lo && p < b.hi + 1e-9) || null;
}

async function mostLikely(sport) {
  const host = document.querySelector('#view');
  if (!host || VIEW !== 'slate' || SPORT !== sport) return;
  await truLoad();
  const L = lkCollect(sport).slice(0, 12);
  const when = x => { try { const d = new Date(x.start), k = Math.round((new Date(d.toDateString()) - new Date(new Date().toDateString())) / 864e5); return (k === 0 ? 'Today' : k === 1 ? 'Tomorrow' : d.toLocaleDateString([], {weekday: 'short'})) + ' ' + d.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}); } catch (e) { return ''; } };
  const H = ((TRU || {}).likely || {})[sport];
  const rows = L.map(x => {
    const h = lkHist(x.kind === 'pl' ? 'nhl_pl' : sport, x.p), win = x.price ? UNIT_USD * tdPay(+x.price) : null;
    const agree = x.model == null ? '' : x.model >= x.p - 0.03 ? `<span class="pos">agrees (${pct(x.model)})</span>` : `<span class="neg">less sure (${pct(x.model)})</span>`;
    return `<tr class="click" data-lk="${x.sport}|${x.id}"><td class="num">${when(x)}</td><td>${x.ufc ? '' : tlogo(x.team, 20, sport) + ' '}<b>${esc(x.bet)}</b> <span class="muted">${x.at} ${esc(x.opp)}</span></td>`
      + `<td class="r num"><b>${pct(x.p)}</b></td><td class="r num">${x.price ? tdAm(+x.price) : `<span class="muted" title="no moneyline in the feed: this is the fair price">fair ${tdAm(tdFair(x.p))}</span>`}</td>`
      + `<td class="r num">${win != null ? '$' + win.toFixed(2) : '–'}</td><td class="r">${h ? `${pct(h.won)} <span class="muted">of ${h.games.toLocaleString()}</span>` : '–'}</td><td class="r">${agree}</td></tr>`;
  });
  const hot = H ? (H.buckets || []).filter(b => b.roi != null && b.roi > 0) : [];
  const unit = sport === 'ufc' ? 'fights' : 'games';
  const html = `<div class="card" id="mostLikely"><div class="card-h"><div><h3>Most likely to win</h3><p class="sub">The safest ${SPORTNAME[sport]} bets over the next week, highest chance first. No edge needed: these are simply the bets that win most often.
    <b>Chance</b> is the betting market's own estimate with the bookmaker's cut removed${sport === 'ufc' ? ' (blended with Locksmith, which has beaten UFC closing lines)' : sport === 'cfb' ? ' (worked out from the spread)' : ''}. <b>History</b> is how often favourites at that chance actually won${H ? ` (${H.seasons[0]}–${H.seasons[1]})` : ''}. <b>Locksmith</b> is whether its own model agrees.</p></div></div>
    ${L.length ? table([{l: 'When'}, {l: 'Bet'}, {l: 'Chance', r: 1}, {l: 'Price', r: 1}, {l: `Win on $${UNIT_USD}`, r: 1}, {l: 'History', r: 1}, {l: 'Locksmith', r: 1}], rows) : `<p class="muted">No ${SPORTNAME[sport]} lines posted yet for the next week.</p>`}
    <p class="note" style="margin-top:8px"><b>The catch:</b> a heavy favourite pays little, so one loss wipes out several wins (at −400 you win $${(UNIT_USD / 4).toFixed(2)} on $${UNIT_USD} but lose all $${UNIT_USD} when it misses). The price already reflects the chance, so over many bets these roughly break even, minus the bookmaker's cut.
    ${hot.length ? `The exception in the history: ${SPORTNAME[sport]} favourites at ${hot.map(b => `${pct(b.lo)}–${pct(Math.min(b.hi, 1))} won ${pct(b.won, 1)} and returned ${sgn(100 * b.roi, 1)}% (${b.games.toLocaleString()} ${unit})`).join('; ')}.` : ''}
    Don't parlay these to boost the payout: every leg is another chance to lose.</p></div>`;
  const old = document.querySelector('#mostLikely'); if (old) old.remove();
  const bb = document.querySelector('#bestBets');
  if (bb) bb.insertAdjacentHTML('afterend', html); else host.insertAdjacentHTML('afterbegin', html);
  host.querySelectorAll('#mostLikely [data-lk]').forEach(el => el.onclick = () => {
    const [s, id] = el.dataset.lk.split('|');
    if (s === 'nhl') NGAME = +id; else if (s === 'nba' || s === 'wnba') BGAME = +id; else if (s === 'ufc') UFIGHT = id; else if (s === 'nfl') GAME = id; else if (s === 'cfb' && typeof CGAME !== 'undefined') CGAME = +id;
    VIEW = 'game'; markNav(); render();
  });
}


// ---------------------------------------------------------------- All: the day's game plan, every sport, at the current price
// Roles mirror python/locksmith/plan.py (lock / core / value / optional lean). Candidates: Locksmith's bet types that still
// made money at the price you can actually get (plan.py CURRENT) + every rule that survived the current-price edge research
// (python/locksmith/edges, logged and served by the tracker as TRK.edges).
const PL = {lock: .55, core: .60, value: .55, lean: .50, edge: .02, nCore: 3, nValue: 2, minPrice: -300};   // worse than -300 pays too little to plan around
const plImp = a => a < 0 ? -a / (-a + 100) : 100 / (a + 100);
const plAm = q => q >= .5 ? -100 * q / (1 - q) : 100 * (1 - q) / q;
const PLFAM = {nhl_ml: 'nhl_ml_close', ufc_ml: 'ufc_ml_close'};
const PLFAM_OPEN = {nhl_ml: 'nhl_ml_open', ufc_ml: 'ufc_ml_open'};
const plAllowed = x => { if (x.src === 'edge' || x.src === 'early') return true; const CT = ((TRU || {}).plan || {}).current_types || {}, f = (x.truth || {}).fam, k = PLFAM[f] || f; return CT[k] != null && x.edge >= CT[k] - 1e-9; };
const plSig = x => `${x.sport}|${x.id}|${String(x.bet).replace(/\([^)]*\)/g, '').trim().split(/\s+/)[0].toLowerCase()}`;
let PLDAY = 0;
const plWon = (w, n) => w != null && w > 1 && n ? w / n : w;          // research files give wins as a rate or a count

function plRoles(L) {
  const c = L.filter(x => x.p >= PL.lean && x.edge >= 0 && +x.price >= PL.minPrice), used = new Set();
  const lk = c.filter(x => x.p >= PL.lock && x.edge >= PL.edge).sort((a, z) => z.p - a.p)[0];
  if (lk) { lk.role = 'lock'; used.add(lk); }
  c.filter(x => !used.has(x) && x.p >= PL.core && x.edge >= PL.edge).sort((a, z) => z.edge - a.edge).slice(0, PL.nCore).forEach(x => { x.role = 'core'; used.add(x); });
  c.filter(x => !used.has(x) && x.p >= PL.value && x.p < PL.core && x.edge >= PL.edge).sort((a, z) => z.edge - a.edge).slice(0, PL.nValue).forEach(x => { x.role = 'value'; used.add(x); });
  if (!used.size && c.length) { const x = [...c].sort((a, z) => z.edge - a.edge)[0]; x.role = 'lean'; used.add(x); }
  return [...used];
}

function plLike(x) {    // the same kind of bet at the current price: same type, chance within 2.5 points, at least this much edge
  if (x.src === 'edge') { const h = x.hist || {}; return h.bets ? {n: h.bets, w: Math.round(plWon(h.won, h.bets) * h.bets), u: h.bets * h.roi} : null; }
  const early = x.src === 'early', T = ((TRU || {}).plan || {})[early ? 'lookup_open' : 'lookup_close'] || {}, fam = (x.truth || {}).fam, rows = T[(early ? PLFAM_OPEN : PLFAM)[fam] || fam];
  if (!rows) return null;
  const eb = x.edge >= .10 ? 4 : x.edge >= .06 ? 3 : x.edge >= .04 ? 2 : x.edge >= .02 ? 1 : 0;
  const pick = (dq, minE) => rows.filter(r => Math.abs(r[0] + .0125 - x.p) <= dq && r[1] >= minE).reduce((a, r) => ({n: a.n + r[2], w: a.w + r[3], u: a.u + r[4]}), {n: 0, w: 0, u: 0});
  let s = pick(.025, Math.max(0, eb - 1)); if (s.n < 40) s = pick(.05, Math.max(0, eb - 1)); if (s.n < 40) s = pick(.1, 0);
  return s.n >= 20 ? s : null;
}

function plSeasons(x) {
  if (x.src === 'edge') { const b = (x.hist || {}).by_season; return b ? Object.fromEntries(Object.entries(b).map(([k, v]) => [k, {...v, won: plWon(v.won, v.n)}])) : null; }
  const early = x.src === 'early', S = ((TRU || {}).plan || {})[early ? 'seasons_open' : 'seasons_close'] || {}, fam = (x.truth || {}).fam;
  return S[(early ? PLFAM_OPEN : PLFAM)[fam] || fam] || null;
}

const PLTYPE = {nhl_ml: 'Hockey moneyline (Locksmith model)', cfb_spread: 'College spread (Locksmith model)', cfb_total_move: 'College total (line-move model)', ufc_ml: 'UFC fighter (Locksmith model + market)', nfl_wind_under: 'NFL under in wind', cfb_total: 'College total (Locksmith model)', cfb_wind: 'College under in wind', nhl_total: 'Hockey total (Locksmith model)'};

function plDetails(x, stake, win) {
  const yrs = plSeasons(x), rows = yrs ? Object.entries(yrs).sort((a, z) => +a[0] - +z[0]).slice(-8) : [];
  const ladder = []; let a = +x.price;
  for (let i = 0; i < 7; i++) { const e = x.p - plImp(a); ladder.push([a, e]); a = a < 0 ? a - 5 : (a - 5 < 100 ? -105 : a - 5); }
  const lose = 1 - x.p;
  const why = (x.why && x.why.length ? x.why : [x.note].filter(Boolean)).map(w => `<li>${esc(w)}</li>`).join('');
  return `<details class="pldet"><summary>Details: why, backtest by season, price ladder</summary>
    <div class="pldet-g">
      <div><h4>Why this bet</h4><ul>${why || '<li>Locksmith’s chance is above the chance the price implies.</li>'}${x.alsoEdge ? `<li>Also picked by a current-price rule: ${esc(x.alsoEdge)}</li>` : ''}</ul>
        <p class="muted">Type: ${esc(x.src === 'edge' ? (x.rule_text || 'current-price rule') : (PLTYPE[(x.truth || {}).fam] || (x.truth || {}).fam || ''))}</p></div>
      <div><h4>Risk</h4><p>Wins about <b>${Math.round(x.p * 10)} in 10</b>, loses about ${Math.round(lose * 10)} in 10. A win pays <b class="pos">$${win.toFixed(2)}</b>; a loss costs <b>$${(stake * UNIT_USD).toFixed(2)}</b>. Expected: <b class="${x.p * tdPay(+x.price) - lose >= 0 ? 'pos' : 'neg'}">${(x.p * tdPay(+x.price) - lose) >= 0 ? '+' : '−'}$${Math.abs(stake * UNIT_USD * (x.p * tdPay(+x.price) - lose)).toFixed(2)}</b> per bet.</p></div>
      ${rows.length ? `<div><h4>Backtest by season</h4>${table([{l: 'Season'}, {l: 'Bets', r: 1}, {l: 'Won', r: 1}, {l: 'Profit a bet', r: 1}], rows.map(([s, v]) => `<tr><td>${s}</td><td class="r num">${v.n}</td><td class="r num">${pct(v.won, 1)}</td><td class="r num ${v.roi >= 0 ? 'pos' : 'neg'}">${sgn(100 * v.roi, 1)}%</td></tr>`))}</div>` : ''}
      <div><h4>Price ladder</h4>${table([{l: 'If the price is'}, {l: 'Price says', r: 1}, {l: 'Locksmith edge', r: 1}, {l: '', r: 1}], ladder.map(([pr, e]) => `<tr><td class="num">${tdAm(pr)}</td><td class="r num">${pct(plImp(pr))}</td><td class="r num ${e >= PL.edge - .002 ? 'pos' : e >= 0 ? '' : 'neg'}">${e >= -.0005 ? '+' : '−'}${Math.abs(100 * e).toFixed(1)} pts</td><td class="r">${x.downTo != null ? (pr >= x.downTo ? 'bet' : 'skip') : e >= PL.edge - .002 ? 'bet' : e >= -.0005 ? 'thin' : 'skip'}</td></tr>`))}</div>
    </div></details>`;
}

async function allRender() {
  $('#title').textContent = 'Game plan'; $('#weeks').style.display = 'none';
  $('#view').innerHTML = '<div class="card empty">Building the game plan…</div>';
  TRK = null; await Promise.allSettled([trkLoad(), truLoad()]);
  const now = Date.now();
  const live = x => x.start && new Date(x.start) > now && x.p != null && x.price != null;
  const edgesFor = k => ((TRK && TRK.edges) || []).filter(e => e.start_utc && new Date(e.start_utc).toLocaleDateString('en-CA') === tdDate(k)).map(e => ({
    sport: e.sport, kind: 'game', src: 'edge', id: e.event_id, start: e.start_utc, away: e.away, home: e.home, bet: e.bet, price: +e.price, p: +e.p,
    truth: {fam: 'edge:' + e.rule}, note: e.rule_text, rule_text: e.rule_text, why: e.why || [], hist: e.hist || {}, stake: null, fight: null,
    kstake: e.stake_pct_bankroll, downTo: e.bet_down_to != null ? +String(e.bet_down_to).replace('+', '') : null, thin: !!e.thin}));
  const planFor = async k => {
    let it = []; try { it = await tdCollect(tdDate(k)); } catch (e) {}
    const m = new Map();
    for (const x of it.filter(x => x.kind === 'game' && live(x)).map(x => ({...x, edge: x.p - plImp(+x.price)})).filter(plAllowed)) m.set(plSig(x), x);
    const earlyFor = ((TRK && TRK.early) || []).filter(e => e.start_utc && new Date(e.start_utc).toLocaleDateString('en-CA') === tdDate(k)).map(e => ({
      sport: e.sport, kind: 'game', src: 'early', id: e.event_id, start: e.start_utc, away: e.away, home: e.home, bet: e.bet, price: +e.price, p: +e.p, book: e.book,
      truth: {fam: e.fam}, note: `The line is still at its opener (opened ${e.opener}, now ${e.now}): this is the price Locksmith's best record was measured at.`, opener: e.opener}));
    for (const x of earlyFor.filter(live).map(x => ({...x, edge: x.p - plImp(+x.price), stake: tdKelly(x.p, x.price)}))) if (!m.has(plSig(x))) m.set(plSig(x), x);
    for (const x of edgesFor(k).filter(live).filter(x => !x.thin).map(x => ({...x, edge: x.p - plImp(+x.price), stake: x.kstake ? Math.min(2, Math.max(.5, Math.round(x.kstake * 2) / 2)) : tdKelly(x.p, x.price)}))) {
      const k2 = plSig(x), have = m.get(k2);
      if (have) { have.alsoEdge = x.rule_text; have.why = [...(have.why || []), ...(x.why || [])]; } else m.set(k2, x);
    }
    return plRoles([...m.values()]);
  };
  let plan = await planFor(PLDAY), next = null;
  if (!plan.length) for (let k = PLDAY + 1; k <= PLDAY + 7 && !next; k++) { const q = await planFor(k); if (q.length) next = {k, plan: q}; }
  // daily picks: the day's most likely winners that Locksmith's model agrees with, at prices that still pay (-250 or better)
  const taken = new Set(plan.map(plSig));
  const daily = ['nba', 'wnba', 'nhl', 'nfl', 'ufc'].flatMap(sp => { try { return lkCollect(sp); } catch (e) { return []; } })
    .filter(x => x.start && new Date(x.start).toLocaleDateString('en-CA') === tdDate(PLDAY) && x.price != null && +x.price >= -200 && +x.price <= 150 && x.p >= .55
      && x.model != null && x.model >= x.p - .01)
    .map(x => ({...x, price: +x.price, edge: x.p - plImp(+x.price), role: 'daily', src: 'daily', bet: x.bet, note: `${x.team} ${x.at} ${x.opp}`, kind: x.kind || 'ml'}))
    .filter(x => !taken.has(plSig(x)) && !plan.some(y => y.sport === x.sport && String(y.id) === String(x.id)))
    .sort((a, z) => (z.model - z.p) - (a.model - a.p) || z.p - a.p)
    .filter((x, i, L) => L.findIndex(y => y.sport === x.sport && String(y.id) === String(x.id)) === i).slice(0, 3);   // one per game
  if (SPORT !== 'all') return;
  const day = PLDAY, dayName = k => k === 0 ? 'Today' : k === 1 ? 'Tomorrow' : new Date(tdDate(k) + 'T12:00').toLocaleDateString([], {weekday: 'long'});
  const label = dayName(day);
  const ey = $('#eyebrow'); if (ey) ey.textContent = 'All sports · ' + new Date(tdDate(day) + 'T12:00').toLocaleDateString([], {weekday: 'long', month: 'long', day: 'numeric'});
  const order = {lock: 0, core: 1, value: 2, lean: 3};
  const sortPlan = L => L.sort((a, z) => order[a.role] - order[z.role] || new Date(a.start) - new Date(z.start));
  sortPlan(plan); if (next) sortPlan(next.plan);
  const PB = ((TRU || {}).plan || {}), BO = PB.current || {}, P = BO.plan;
  const stake = x => x.role === 'lean' || x.role === 'daily' ? .5 : x.role === 'lock' ? Math.max(1, x.stake || 1) : (x.stake || 1);
  const win = x => stake(x) * UNIT_USD * tdPay(+x.price);
  const summary = L => { const real = L.filter(x => x.role !== 'lean'); const exp = L.reduce((a, x) => a + stake(x) * UNIT_USD * (x.p * tdPay(+x.price) - (1 - x.p)), 0);
    let up = null; if (real.length && real.length <= 12) { up = 0; for (let m = 0; m < (1 << real.length); m++) { let pr = 1, u = 0; real.forEach((x, i) => { const w = (m >> i) & 1; pr *= w ? x.p : 1 - x.p; u += w ? win(x) : -stake(x) * UNIT_USD; }); if (u > 0) up += pr; } }
    return {real, exp, up, staked: L.reduce((a, x) => a + stake(x), 0)}; };
  const roleName = {lock: 'Lock of the day', core: 'Core bet', value: 'Value bet', lean: 'Optional lean', daily: 'Daily pick'};
  const roleRec = (r, x) => { const o = (x && x.src === 'early' ? (PB.open || {}) : BO)[r]; return o ? `${{lock: 'Locks', core: 'Core bets', value: 'Value bets', lean: 'Leans'}[r]} have won <b>${pct(o.won, 1)}</b> (${o.bets.toLocaleString()} bets), ${sgn(100 * o.roi, 1)}% a bet, ${o.seasons_up} of ${o.seasons} seasons up` : ''; };
  const card1 = x => {
    const lk = plLike(x), floor = x.downTo != null ? x.downTo : Math.round(plAm(x.p - (x.role === 'lean' ? 0 : PL.edge - .002)));
    const name = esc(String(x.bet).replace(/\s*\([+−-]?\d+\)\s*$/, ''));
    const who = x.sport === 'ufc' ? `<b>${name}</b>` : `${tlogo(x.away, 22, x.sport)}<span class="tk-at">@</span>${tlogo(x.home, 22, x.sport)} <b>${name}</b>`;
    return `<div class="ticket click plan-${x.role}" data-all="${x.sport}|${esc(String(x.id))}"><div class="tk-m"><div class="tk-g"><span class="badge ${x.role === 'lock' ? 'go' : x.role === 'lean' || x.role === 'daily' ? 'warn' : ''}">${roleName[x.role]}</span>${x.src === 'edge' || x.alsoEdge ? ' <span class="badge">current-price rule</span>' : ''}${x.src === 'early' ? ' <span class="badge">early price: bet before it moves</span>' : ''}<b>${who}</b>
        <span><span class="tdsp">${SPORTNAME[x.sport]}</span> ${tdWhen(x.start)} (${tdIn(x.start)})${x.sport === 'ufc' ? '' : ` · ${esc(x.away)} at ${esc(x.home)}`}</span></div></div>
      <div class="tk-b"><div class="tdfacts"><span>bet <b>${usd(stake(x))}</b> at <b>${tdAm(+x.price)}</b>${x.book ? ' (' + esc(x.book) + ')' : ''} to win <b class="pos">$${win(x).toFixed(2)}</b></span>
        <span>${x.role === 'daily' ? `market chance <b>${pct(x.p)}</b>, Locksmith <b>${pct(x.model)}</b>, price says ${pct(plImp(+x.price))}` : `Locksmith <b>${pct(x.p)}</b> vs the price's ${pct(plImp(+x.price))} <span class="${x.edge >= 0 ? 'pos' : 'neg'}">(${x.edge >= 0 ? '+' : '−'}${Math.abs(100 * x.edge).toFixed(1)} pts)</span>`}</span>
        ${x.role !== 'lean' && x.role !== 'daily' ? `<span>still a bet down to <b>${tdAm(floor)}</b></span>` : ''}</div>
        <div class="tk-n">${x.role === 'daily' ? (() => { const h = lkHist(x.kind === 'pl' ? 'nhl_pl' : x.sport, x.p); return `<b>Backtest at the current price:</b> ${h ? `favourites at this chance won <b>${pct(h.won, 1)}</b> of ${h.games.toLocaleString()} ${x.sport === 'ufc' ? 'fights' : 'games'}, ${h.roi != null ? sgn(100 * h.roi, 1) + '% a bet' : ''}` : 'no history for this exact spot'}. Locksmith's model agrees (${pct(x.model)}). No proven edge: small stake.`; })()
          : `${lk ? `<b>Backtest at ${x.src === 'early' ? 'this price (line still at its opener)' : 'the current price'}:</b> bets like this went <b>${lk.w}-${lk.n - lk.w}</b> (${pct(lk.w / lk.n, 1)}), ${sgn(100 * lk.u / lk.n, 1)}% a bet. ` : ''}${roleRec(x.role, x)}.`}</div>
        ${plDetails(x, stake(x), win(x))}</div>
      <div class="tk-r">${ring(x.p, 'to win')}</div></div>`;
  };
  const S = summary(plan), N = next ? summary(next.plan) : null, DS = summary(daily);
  const head = plan.length ? `<b>${label}'s plan: ${S.real.length} bet${S.real.length === 1 ? '' : 's'}${plan.length > S.real.length ? ' + 1 optional lean' : ''}.</b> Stake <b>${usd(S.staked)}</b>, expected profit <b class="pos">${S.exp >= 0 ? '+' : '−'}$${Math.abs(S.exp).toFixed(2)}</b>${S.up != null ? `, <b>${pct(S.up)}</b> chance to finish the day up` : ''}.`
    : daily.length ? `<b>${label}: ${daily.length} daily pick${daily.length === 1 ? '' : 's'}</b> at small stakes (${usd(DS.staked)} total). Nothing on ${label.toLowerCase()}'s board has a proven edge at its current price, so these are the most likely winners Locksmith agrees with, not edges.${next ? ` Next proven bets: <b>${dayName(next.k).toLowerCase()}</b>.` : ''}`
    : `<b>No bets ${label.toLowerCase()}.</b> No games with posted prices.${next ? ` Next bets: <b>${dayName(next.k).toLowerCase()}</b>.` : ''}`;
  // research: how efficient each market is at the current price, and what beat it
  const ER = (TRK && TRK.edge_research) || {};
  const resRows = Object.entries(ER).map(([s, r]) => `<tr><td><b>${SPORTNAME[s] || s}</b></td><td class="r num">${r.n_tested || '–'}</td><td>${(r.survivors || []).length ? r.survivors.map(h => `<div><b>${esc(h.text)}</b> <span class="muted">${(h.oos || {}).bets} bets, ${pct(plWon((h.oos || {}).won, (h.oos || {}).bets), 1)} won, ${sgn(100 * ((h.oos || {}).roi || 0), 1)}%, ${(h.oos || {}).seasons_up}/${(h.oos || {}).seasons} seasons</span></div>`).join('') : '<span class="muted">nothing survived</span>'}</td></tr>`);
  const resNotes = Object.entries(ER).map(([s, r]) => `<details><summary><b>${SPORTNAME[s] || s}</b>: ${r.n_tested || 0} ideas tested, ${(r.survivors || []).length} beat the current price</summary><p>${esc(r.summary || '')}</p>
    ${(r.top || []).length ? table([{l: 'Idea'}, {l: 'Bets', r: 1}, {l: 'Won', r: 1}, {l: 'Profit a bet', r: 1}, {l: 'Seasons up', r: 1}, {l: 'Verdict', r: 1}], r.top.map(h => { const o = h.oos || {}; return `<tr><td>${esc(h.text)}</td><td class="r num">${o.bets}</td><td class="r num">${pct(plWon(o.won, o.bets), 1)}</td><td class="r num ${o.roi >= 0 ? 'pos' : 'neg'}">${sgn(100 * (o.roi || 0), 1)}%</td><td class="r num">${o.seasons_up}/${o.seasons}</td><td class="r">${h.survives ? '<span class="badge go">used</span>' : h.bh_pass ? 'real but failed a check' : 'could be luck'}</td></tr>`; })) : ''}</details>`).join('');
  const R = ((TRK && TRK.bets) || []).filter(r => r.market !== 'prop' && r.status === 'graded' && r.result !== 'push' && r.p != null && r.price != null && r.p >= PL.lean && (String(r.fam || '').startsWith('edge:') || plAllowed({truth: {fam: r.fam}, edge: r.p - plImp(+r.price)})));
  const rw = R.filter(r => r.result === 'win').length, ru = R.reduce((a, r) => a + (+r.units || 0), 0);
  $('#view').innerHTML = `<div class="chips">${[0, 1, 2, 3, 4].map(k => `<button class="chip ${day === k ? 'on' : ''}" data-pld="${k}">${dayName(k)}</button>`).join('')}</div>
    <div class="verdict big1">${head}</div>
    ${plan.length ? `<div class="tickets">${plan.map(card1).join('')}</div>` : ''}
    ${daily.length ? `<div class="card"><div class="card-h"><div><h3>Daily picks</h3><p class="sub">Every day has bets: ${label === 'Today' ? 'today' : label}'s likely winners (55%+) that Locksmith's model rates highest compared with the market, at −200 or better. Small stakes: at the current price, bets like these have roughly broken even. They are for action, not edge.</p></div></div><div class="tickets">${daily.map(card1).join('')}</div></div>` : ''}
    ${plan.length ? '' : next ? `<div class="card"><div class="card-h"><div><h3>Next up: ${dayName(next.k).toLowerCase()}</h3><p class="sub">Stake ${usd(N.staked)}, expected profit ${N.exp >= 0 ? '+' : '−'}$${Math.abs(N.exp).toFixed(2)}${N.up != null ? `, ${pct(N.up)} chance to finish that day up` : ''}.</p></div></div><div class="tickets">${next.plan.map(card1).join('')}</div></div>` : ''}
    <div class="card"><div class="card-h"><div><h3>How to play it</h3></div></div>
      <ol class="plan-steps"><li><b>Bet at the price shown or better.</b> Every number here is at the current price. Each bet's Details show exactly how far the price can move.</li>
      <li><b>Only what wins at the current price.</b> Locksmith's bet types that made money at the last price before the game${P ? ` (${pct(P.won, 1)} won, ${sgn(100 * P.roi, 1)}% a bet over ${P.bets.toLocaleString()} bets)` : ''}, plus every rule that survived the research below.</li>
      <li><b>Early-price bets</b> are Locksmith's strongest edges, but only while the line is still at its opener. Each one says the opener; if the line has moved past it, skip it.</li>
      <li><b>Proven bets get full stakes; daily picks get small ones.</b> Proven bets have beaten the current price in past seasons. Daily picks are there so every day has action; bets like them have roughly broken even.</li>
      <li><b>Singles, never parlays.</b></li></ol></div>
    ${Object.keys(ER).length ? `<div class="card"><div class="card-h"><div><h3>Can the current line be beaten? The research</h3><p class="sub">Every idea was tested at the last price before the game, chosen on earlier seasons only and checked on later ones, then corrected for testing many ideas at once (so lucky streaks don't count).</p></div></div>
      ${table([{l: 'Sport'}, {l: 'Ideas tested', r: 1}, {l: 'What beat the current price'}], resRows)}${resNotes}</div>` : ''}
    <div class="card"><div class="card-h"><div><h3>Plan record</h3><p class="sub">Every bet of the plan's types that Locksmith showed, graded at the price it showed.</p></div></div>
      ${R.length ? `<div class="answer">${[['Record', `${rw}-${R.length - rw}`, 'graded so far'], ['Won', pct(rw / R.length, 1), 'of bets decided'], ['Profit', `${ru >= 0 ? '+' : '−'}$${Math.abs(ru * UNIT_USD).toFixed(0)}`, `at $${UNIT_USD} a unit`]].map(([l, v, s]) => `<div class="ans"><span class="l">${l}</span><b>${v}</b><span class="s">${s}</span></div>`).join('')}</div>` : '<p class="muted">Nothing graded yet.</p>'}</div>
    <div class="muted bb-unit">Unit size <input id="allUnit" type="number" min="1" step="1" value="${UNIT_USD}" style="width:70px"> dollars · stakes are a quarter of the Kelly amount (0.5 to 2 units)</div>`;
  document.querySelectorAll('[data-pld]').forEach(c => c.onclick = () => { PLDAY = +c.dataset.pld; allRender(); });
  document.querySelectorAll('[data-all]').forEach(el => el.onclick = e => {
    if (e.target.closest('details')) return;                 // opening Details stays on the page
    const [s, id] = el.dataset.all.split('|');
    if (s === 'nhl') NGAME = +id; else if (s === 'nba' || s === 'wnba') BGAME = +id; else if (s === 'ufc') UFIGHT = id; else if (s === 'nfl') GAME = id; else if (s === 'cfb' && typeof CGAME !== 'undefined') CGAME = +id;
    VIEW = 'game'; setSport(s);
  });
  const u = $('#allUnit'); if (u) u.onchange = () => { const v = +u.value; if (v > 0) { UNIT_USD = v; try { localStorage.setItem('ls_unit', String(v)); } catch (e) {} allRender(); } };
  clearTimeout(TD.allTimer);
  TD.allTimer = setTimeout(() => { if (SPORT === 'all' && VIEW === 'slate' && !document.querySelector('details[open]')) allRender(); }, 120000);
}
