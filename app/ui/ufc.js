// Locksmith :: UFC. Data: reports/ufc/app_data.json (python -m locksmith.ufc.card)
let UF = null, UEV = null, UFIGHT = null, UTAB = 'tape';
const UTITLES = {slate: 'UFC picks', game: 'Fight center', live: 'Live betting', props: 'Fight props', record: 'UFC track record', model: 'UFC model accuracy', research: 'UFC research'};
const UFC_VIEWS = ['slate', 'game', 'live', 'props', 'record', 'model', 'research'];
const UCOL = ['#d4483b', '#3b7bd4'];                       // red corner / blue corner
const uam = x => ok(x) ? (x > 0 ? '+' : '') + Math.round(x) : '–';
const ufights = () => (UF && UF.fights ? UF.fights.filter(f => !UEV || f.event_id === UEV) : []).slice().sort((a, z) => z.order - a.order);
const ushort = n => { const p = String(n || '').split(' '); return p.length > 1 ? p.slice(1).join(' ') : n; };
const uface = (f, side, size = 44) => hshot('ufc', f[side].espn_id, f[side].name, size);
const METH = {KO: 'KO/TKO', SUB: 'submission', DEC: 'decision'};

async function ufcLoad() {
  if (UF) return UF;
  try { UF = (window.pywebview && window.pywebview.api && window.pywebview.api.get_ufc) ? await window.pywebview.api.get_ufc() : await (await fetch('../../reports/ufc/app_data.json', {cache: 'no-store'})).json(); }
  catch (e) { UF = {error: String(e)}; }
  if (UF && UF.fights && UF.fights.length && !UEV) UEV = UF.fights[0].event_id;
  return UF;
}
async function ufcRender() {
  $('#title').textContent = UTITLES[VIEW] || 'UFC';
  if (!UF) { $('#view').innerHTML = '<div class="card empty">Loading UFC…</div>'; await ufcLoad(); }
  if (!UF || UF.error || !UF.fights) { $('#view').innerHTML = `<div class="card empty">${esc((UF && UF.error) || 'No UFC data yet.')}</div>`; return; }
  const evs = [...new Map(UF.fights.map(f => [f.event_id, f])).values()];
  $('#eyebrow').textContent = evs.length ? `${evs[0].event} · ${new Date(evs[0].start).toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric'})}` : 'UFC';
  $('#weeks').innerHTML = evs.length > 1 ? evs.map(e => `<button class="chip${e.event_id === UEV ? ' on' : ''}" data-uev="${e.event_id}">${esc(e.event)}</button>`).join('') : '';
  $('#weeks').style.display = evs.length > 1 ? '' : 'none';
  document.querySelectorAll('[data-uev]').forEach(c => c.onclick = () => { UEV = c.dataset.uev; UFIGHT = null; ufcRender(); });
  ({slate: uPicks, game: uGame, props: uProps, record: uRecord, model: uModel, research: uResearch}[VIEW] || uPicks)();
}

// ---------------------------------------------------------------- picks
function fightTicket(f, opts = {}) {
  const p = f.pick, side = p.side || 'A', me = f[side], them = f[side === 'A' ? 'B' : 'A'];
  const chance = opts.thin ? p.win_chance : p.win_chance;
  return `<div class="ticket click ufct" data-uf="${f.fight_id}" style="--ca:${UCOL[side === 'A' ? 0 : 1]};--ch:${UCOL[side === 'A' ? 1 : 0]}">
    <div class="tk-m">${uface(f, side, 46)}<div class="tk-g"><b>${esc(me.name)}</b><span>vs ${esc(them.name)} · ${esc(f.wclass)}${f.rounds === 5 ? ' · 5 rounds' : ''}</span></div></div>
    <div class="tk-b"><div class="tk-bet">${opts.thin ? esc(p.at_open) : esc(p.bet)}${!opts.thin && p.stars ? ` <span class="tk-st">${starHTML(p.stars)}</span>` : ''}</div>
      <div class="tk-n">${opts.thin ? `Opened at this price; the line has moved. Still a bet at <b>${uam(p.playable_at)} or better</b>.` : `Opened ${uam(p.open)}, now ${uam(p.price)} · Locksmith ${pct(p.win_chance)} vs the opener’s ${pct(p.win_chance - p.edge)} · most likely: ${esc(ushort(f[f.likely.side].name))} by ${METH[f.likely.method]}`}</div></div>
    <div class="tk-r">${ring(chance, 'to win')}</div></div>`;
}
function fightRow(f) {
  const pA = f.p_win, w = pA >= .5 ? 'A' : 'B', L = f.likely;
  return `<div class="frow click" data-uf="${f.fight_id}">
    <div class="fr-f">${uface(f, 'A', 38)}<div><b>${esc(f.A.name)}</b><span class="muted">${esc(f.A.record || '')}</span></div></div>
    <div class="fr-m"><div class="fr-bar"><span style="width:${100 * pA}%;background:${UCOL[0]}"></span><span style="width:${100 * (1 - pA)}%;background:${UCOL[1]}"></span></div>
      <div class="fr-l"><b>${pct(pA)}</b><span class="muted">${esc(f.wclass)}${f.rounds === 5 ? ' · 5 rds' : ''}</span><b>${pct(1 - pA)}</b></div>
      <div class="fr-x">${f.state === 'post' ? `<b>Final: ${esc(ushort((f.A.winner ? f.A : f.B.winner ? f.B : {name: 'no result'}).name))} won</b> · ` : f.state === 'in' ? '<span class="badge warn">in progress</span> ' : ''}${esc(ushort(f[L.side].name))} by ${METH[L.method]} (${pct(L.p)})${f.pick.bet !== 'Pass' ? ` · <span class="badge good">pick: ${esc(ushort(f[f.pick.side].name))}</span>` : f.pick.at_open ? ` · <span class="badge warn">better price only</span>` : ''}</div></div>
    <div class="fr-f r"><div><b>${esc(f.B.name)}</b><span class="muted">${esc(f.B.record || '')}</span></div>${uface(f, 'B', 38)}</div></div>`;
}
function uPicks() {
  const F = ufights(), picks = F.filter(f => f.pick.bet !== 'Pass'), thin = F.filter(f => f.pick.at_open);
  const E = ((UF.backtest || {}).strategies || {}).early || {}, wf = E.walk_forward || {}, sc = E.same_bets_at_close || {};
  $('#view').innerHTML = `<div class="verdict big1">${picks.length ? `<b>${picks.length} pick${picks.length > 1 ? 's' : ''} on ${esc(F[0] ? F[0].event : 'the card')}.</b>` : '<b>No picks on this card.</b>'} ${F.length} fights priced.</div>
    ${wf.bets ? `<div class="verdict blue"><b>Track record of these bets:</b> ${wf.wins}-${wf.losses}, ${sgn(wf.units, 0)} units (${sgn(100 * wf.roi, 1)}%) at the opening price, every year chosen with earlier years only. <a href="#" id="toRecU">See the record</a></div>` : ''}
    <div class="verdict amber"><b>Only at the opening price or better.</b> Locksmith reads where UFC lines will move; once they move, the value is gone${sc.bets ? ` (the same bets at the closing price returned ${sgn(100 * sc.roi, 1)}%)` : ''}. Each pick below is still at or better than its opener (best price across books). Never picked: debut fights, and fights where the line has moved 10+ points against Locksmith’s side (that usually means news; those bets lost in testing).</div>`
    + (picks.length ? card('Picks', `${TAP} one to see why. % = Locksmith’s chance (blended with the opening line).`, `<div class="tickets">${picks.sort((a, z) => z.pick.edge - a.pick.edge).map(f => fightTicket(f)).join('')}</div>`) : '')
    + (thin.length ? card('Only at a better price', 'Locksmith liked these at the opener, but the line has moved past it.', `<div class="tickets">${thin.map(f => fightTicket(f, {thin: true})).join('')}</div>`) : '')
    + card('The card', 'Win chance (red corner left, blue corner right) and the most likely way each fight ends.', `<div class="frows">${F.map(fightRow).join('')}</div>`);
  document.querySelectorAll('[data-uf]').forEach(el => el.onclick = () => { UFIGHT = el.dataset.uf; UTAB = 'tape'; go('game'); });
  const tr = $('#toRecU'); if (tr) tr.onclick = e => { e.preventDefault(); go('record'); };
}

// ---------------------------------------------------------------- fight center
const TAPE = [['Record', t => null, 'record'], ['UFC fights', t => t.n, 'n', 0], ['Age', t => t.age, 'age', 1, -1], ['Height (in)', t => t.height, 'height', 0], ['Reach (in)', t => t.reach, 'reach', 0],
  ['Sig. strikes landed / min', t => t.slpm, 'slpm', 2], ['Sig. strikes absorbed / min', t => t.sapm, 'sapm', 2, -1], ['Striking accuracy', t => t.sig_acc, 'sig_acc', 'p'], ['Striking defence', t => t.sig_def, 'sig_def', 'p'],
  ['Takedowns / 15 min', t => t.td15, 'td15', 2], ['Takedown accuracy', t => t.td_acc, 'td_acc', 'p'], ['Takedown defence', t => t.td_def, 'td_def', 'p'], ['Submission attempts / 15', t => t.sub15, 'sub15', 2],
  ['Control time share', t => t.ctrl_sh, 'ctrl_sh', 'p'], ['Knockdowns / 15', t => t.kd15, 'kd15', 2], ['Knocked down / 15', t => t.okd15, 'okd15', 2, -1],
  ['Wins by KO', t => t.ko_w_rate, 'ko_w_rate', 'p'], ['Wins by submission', t => t.sub_w_rate, 'sub_w_rate', 'p'], ['Losses by KO', t => t.ko_l_rate, 'ko_l_rate', 'p', -1],
  ['Striking vs opponents’ norm', t => t.adj_off, 'adj_off', 2], ['Defence vs opponents’ norm', t => t.adj_def, 'adj_def', 2], ['Rating (Elo)', t => t.elo, 'elo', 0]];
function tapeTable(f) {
  const a = f.A.tape || {}, b = f.B.tape || {};
  const v = (x, k) => x == null ? '–' : k === 'p' ? pct(x) : fx(x, k);
  return `<div class="tape">${TAPE.map(([lab, g, key, d, better = 1]) => {
    if (key === 'record') return `<div class="tp"><b>${esc(f.A.record || '–')}</b><span>${lab}</span><b>${esc(f.B.record || '–')}</b></div>`;
    const x = g(a), y = g(b); if (x == null && y == null) return '';
    const win = x == null || y == null ? 0 : (x - y) * better > 0 ? 1 : (x - y) * better < 0 ? -1 : 0;
    const tot = Math.abs(x || 0) + Math.abs(y || 0) || 1;
    return `<div class="tp"><b class="${win > 0 ? 'w' : ''}">${v(x, d)}</b><span>${lab}<i class="tpbar"><i style="width:${50 * Math.abs(x || 0) / tot}%;background:${UCOL[0]}"></i><i style="width:${50 * Math.abs(y || 0) / tot}%;background:${UCOL[1]}"></i></i></span><b class="${win < 0 ? 'w' : ''}">${v(y, d)}</b></div>`;
  }).join('')}</div><p class="note">Rates are recency-weighted over UFC fights and shrunk toward the weight class (so a fighter with one short fight isn’t judged on it). “Vs opponents’ norm” = output compared with what those opponents usually allow.</p>`;
}
function endsChart(f) {
  const P = f.props, cells = [['A', 'KO'], ['A', 'SUB'], ['A', 'DEC'], ['B', 'KO'], ['B', 'SUB'], ['B', 'DEC']];
  const mx = Math.max(...cells.map(([s, m]) => P[`${s}_${m}`]));
  const er = P.end_round || [];
  return `<div class="ends2">${cells.map(([s, m]) => `<div class="e2"><span>${esc(ushort(f[s].name))} by ${METH[m]}</span><i><i style="width:${100 * P[`${s}_${m}`] / mx}%;background:${UCOL[s === 'A' ? 0 : 1]}"></i></i><b>${pct(P[`${s}_${m}`])}</b><small>fair ${uam(amFairU(P[`${s}_${m}`]))}</small></div>`).join('')}</div>
    <h4 class="u4">When it ends</h4><div class="rbars">${er.map((p, i) => `<div><i style="height:${Math.min(100, 300 * p)}%"></i><b>${pct(p)}</b><span>R${i + 1}</span></div>`).join('')}<div class="dec"><i style="height:${Math.min(100, 300 * P.distance / 2)}%"></i><b>${pct(P.distance)}</b><span>Decision</span></div></div>`;
}
const amFairU = p => !(p > 0 && p < 1) ? null : p >= .5 ? -100 * p / (1 - p) : 100 * (1 - p) / p;
function propsTable(f) {
  const P = f.props, R = P.rounds || {};
  const rows = [[`${f.A.name} wins`, f.p_win], [`${f.B.name} wins`, 1 - f.p_win], ['Fight goes the distance', P.distance], ['Fight does not go the distance', 1 - P.distance],
    ...Object.entries(R).flatMap(([L, v]) => [[`Over ${L} rounds`, v.over], [`Under ${L} rounds`, v.under]]),
    [`${f.A.name} by KO/TKO`, P.A_KO], [`${f.A.name} by submission`, P.A_SUB], [`${f.A.name} by decision`, P.A_DEC], [`${f.B.name} by KO/TKO`, P.B_KO], [`${f.B.name} by submission`, P.B_SUB], [`${f.B.name} by decision`, P.B_DEC]];
  return table([{l: 'Bet'}, {l: 'Locksmith', r: 1}, {l: 'Fair price', r: 1}], rows.map(([l, p]) => `<tr><td>${esc(l)}</td><td class="r num">${pct(p)}</td><td class="r num">${uam(amFairU(p))}</td></tr>`))
    + `<p class="note">A fair price is the break-even: a sportsbook offering longer odds than this is offering value, if Locksmith is right. Method and round props have not been tested against real prop prices yet, so treat them as a guide.</p>`;
}
function whyList(f) {
  const a = f.A.tape || {}, b = f.B.tape || {}, A = ushort(f.A.name), B = ushort(f.B.name), out = [];
  const d = (k) => (a[k] ?? 0) - (b[k] ?? 0);
  if (a.elo != null && b.elo != null) out.push([Math.abs(d('elo')) / 40, `${d('elo') > 0 ? A : B} has the better record against stronger opposition (rating ${fx(Math.max(a.elo, b.elo), 0)} vs ${fx(Math.min(a.elo, b.elo), 0)}).`]);
  if (a.slpm != null) { const net = (a.slpm - a.sapm) - (b.slpm - b.sapm); out.push([Math.abs(net), `${net > 0 ? A : B} wins the striking exchanges by more: ${fx(Math.abs(net), 1)} more significant strikes per minute (landed minus absorbed).`]); }
  if (a.td15 != null) { const g = (a.td15 * (1 - b.td_def)) - (b.td15 * (1 - a.td_def)); out.push([Math.abs(g) * 1.2, `${g > 0 ? A : B} should land more takedowns (${fx(Math.max(a.td15 * (1 - b.td_def), b.td15 * (1 - a.td_def)), 1)} expected per 15 minutes vs ${fx(Math.min(a.td15 * (1 - b.td_def), b.td15 * (1 - a.td_def)), 1)}).`]); }
  if (a.okd15 != null && Math.abs(d('okd15')) > 0.1) out.push([Math.abs(d('okd15')) * 3, `${d('okd15') > 0 ? A : B} gets knocked down more often (${fx(Math.max(a.okd15, b.okd15), 2)} per 15 minutes): a durability question.`]);
  if (a.age != null && b.age != null && Math.abs(d('age')) >= 3) out.push([Math.abs(d('age')) / 3, `${d('age') > 0 ? B : A} is ${fx(Math.abs(d('age')), 0)} years younger${Math.max(a.age, b.age) >= 34 ? ` (${d('age') > 0 ? A : B} is ${fx(Math.max(a.age, b.age), 0)})` : ''}.`]);
  if (a.reach != null && b.reach != null && Math.abs(d('reach')) >= 2) out.push([Math.abs(d('reach')) / 3, `${d('reach') > 0 ? A : B} has a ${fx(Math.abs(d('reach')), 0)}-inch reach advantage.`]);
  if (a.n != null && b.n != null && Math.min(a.n, b.n) <= 1) out.push([2, `${a.n <= b.n ? A : B} has ${fx(Math.min(a.n, b.n), 0)} UFC fight${Math.min(a.n, b.n) === 1 ? '' : 's'}: little UFC data, so Locksmith leans on the betting line here and never bets debut fights.`]);
  if (a.layoff != null && b.layoff != null && Math.max(a.layoff, b.layoff) > 400) out.push([1, `${a.layoff > b.layoff ? A : B} has been out ${fx(Math.max(a.layoff, b.layoff) / 30.4, 0)} months.`]);
  return out.sort((x, y) => y[0] - x[0]).slice(0, 6).map(x => `<li>${esc(x[1])}</li>`).join('');
}
function uGame() {
  const F = ufights(); if (!F.length) return;
  const f = F.find(x => x.fight_id === UFIGHT) || F[0]; UFIGHT = f.fight_id;
  const m = f.market || {}, p = f.pick, pA = f.p_win;
  const chips = `<div class="chips gchips">${F.map(x => `<button class="chip${x.fight_id === UFIGHT ? ' on' : ''}" data-ufc="${x.fight_id}">${esc(ushort(x.A.name))} vs ${esc(ushort(x.B.name))}</button>`).join('')}</div>`;
  const side = (s, r) => `<div class="uh-f${r ? ' r' : ''}">${uface(f, s, 96)}<div><b>${esc(f[s].name)}</b><span>${esc(f[s].record || '')}${f[s].tape && f[s].tape.n != null ? ` · ${fx(f[s].tape.n, 0)} UFC` : ''}</span><em style="color:${UCOL[s === 'A' ? 0 : 1]}">${pct(s === 'A' ? pA : 1 - pA)}</em></div></div>`;
  const hero = `<div class="card uhero" style="--ca:${UCOL[0]};--ch:${UCOL[1]}"><div class="eyebrow">${esc(f.event)} · ${esc(f.wclass)} · ${f.rounds} rounds${f.order === f.n_fights - 1 ? ' · main event' : ''}</div>
    <div class="uh-row">${side('A', false)}<div class="uh-vs">VS</div>${side('B', true)}</div>
    <div class="winbar"><span style="width:${100 * pA}%;background:${UCOL[0]}"></span><span style="width:${100 * (1 - pA)}%;background:${UCOL[1]}"></span></div>
    ${answer([
      {l: 'Who wins', v: `${esc(pA >= .5 ? f.A.name : f.B.name)}`, s: `${pct(Math.max(pA, 1 - pA))} (Locksmith ${pct(Math.max(f.p_model, 1 - f.p_model))} on its own, blended with the opening line)`},
      {l: 'How', v: `${esc(ushort(f[f.likely.side].name))} by ${METH[f.likely.method]}`, s: `the single most likely outcome (${pct(f.likely.p)}) · goes the distance ${pct(f.props.distance)}`},
      {l: 'Betting line', v: m.open_A != null ? `${esc(ushort(f.A.name))} ${uam(m.open_A)} → ${uam(m.now_A)}` : 'not posted', s: m.open_A != null ? `opened ${pct(m.p_open_A)}, now ${pct(m.p_now_A)} (no-vig) · ${esc(ushort(f.B.name))} ${uam(m.open_B)} → ${uam(m.now_B)}` : ''},
      {l: 'The bet', v: p.bet !== 'Pass' ? esc(p.bet) + ' ' + starHTML(p.stars) : 'No bet', s: p.bet !== 'Pass' ? `${pct(p.win_chance)} to win · ${fx(100 * p.edge, 1)}% more than the opening line gave · only at ${uam(p.open)} or better` : p.at_open ? `${esc(p.at_open)} was the bet at the opener; the line has moved past it (still a bet at ${uam(p.playable_at)} or better)` : p.moved_against ? `Locksmith liked ${esc(p.moved_against.split(':')[0])}, but the line has moved sharply the other way (${esc(p.moved_against.split(': ')[1])}). Moves that big usually mean news (injury, short notice); in testing those bets lost, so no bet.` : Math.min((f.A.tape || {}).n ?? 9, (f.B.tape || {}).n ?? 9) === 0 ? 'debut fight: Locksmith never bets these' : 'no edge big enough against the opening line', cls: p.bet !== 'Pass' ? 'go' : 'pass'}])}</div>`;
  const tabs = [['tape', 'Tale of the tape'], ['ends', 'How it ends'], ['props', 'Fair prices'], ['why', 'Why']];
  const body = UTAB === 'ends' ? card('How the fight ends', 'Chance of each finish for each fighter, and the round it ends in.', endsChart(f))
    : UTAB === 'props' ? card('Fair prices', 'Locksmith’s chance and break-even price for every common fight bet.', propsTable(f))
    : UTAB === 'why' ? card('Why Locksmith leans this way', 'The biggest differences between the two fighters, as the model sees them.', `<ul class="ulist">${whyList(f)}</ul>`)
    : card('Tale of the tape', `${esc(f.A.name)} (red) vs ${esc(f.B.name)} (blue). The better number is highlighted.`, tapeTable(f));
  $('#view').innerHTML = chips + hero + `<div class="tabs">${tabs.map(([k, l]) => `<button class="${UTAB === k ? 'on' : ''}" data-ut="${k}">${l}</button>`).join('')}</div>` + body;
  document.querySelectorAll('[data-ufc]').forEach(c => c.onclick = () => { UFIGHT = c.dataset.ufc; uGame(); });
  document.querySelectorAll('[data-ut]').forEach(c => c.onclick = () => { UTAB = c.dataset.ut; uGame(); });
}

// ---------------------------------------------------------------- props, record, model, research
function uProps() {
  const F = ufights();
  $('#view').innerHTML = `<div class="verdict big1"><b>Fair prices for every fight on ${esc(F[0] ? F[0].event : 'the card')}.</b> Compare them with your sportsbook: longer odds than the fair price are value if Locksmith is right. Method and round props are a guide, not tested picks.</div>`
    + F.map(f => card(`${esc(f.A.name)} vs ${esc(f.B.name)}`, `${esc(f.wclass)} · ${f.rounds} rounds`, propsTable(f))).join('');
}
function uRecord() {
  const BT = UF.backtest || {}, S = BT.strategies || {}, E = S.early || {}, FD = S.fightday || {}, wf = E.walk_forward || {}, sc = E.same_bets_at_close || {}, c = BT.clv || {};
  if (!wf.bets) { $('#view').innerHTML = card('Track record', '', '<p class="note">Not enough odds history yet.</p>'); return; }
  const by = E.by_year || {}, yrs = Object.keys(by).sort();
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> betting the side Locksmith likes at the <b>opening</b> price went <b>${wf.wins}-${wf.losses}</b> for <b>${sgn(wf.units, 0)} units</b> (${sgn(100 * wf.roi, 1)}%), rules chosen each year from earlier years only.</div>
    <div class="verdict amber"><b>Only at the opening price.</b> The same bets at the closing price returned ${sgn(100 * (sc.roi || 0), 1)}%, and betting on fight day with the closing line went ${sgn(100 * ((FD.walk_forward || {}).roi || 0), 1)}%. Locksmith reads where UFC lines will move (the line moved its way ${pct(c.toward)} of the time), so the value is in betting early.</div>
    <div class="tiles">${tile(`${wf.wins}-${wf.losses}`, 'won–lost at the opener')}${tile(sgn(wf.units, 0), 'units, 1 unit per bet', wf.units >= 0 ? 'good' : 'bad')}${tile(sgn(100 * wf.roi, 1) + '%', 'return at the opener', wf.roi >= 0 ? 'good' : 'bad')}${tile(sgn(100 * (sc.roi || 0), 1) + '%', 'same bets at the close', (sc.roi || 0) >= 0 ? 'good' : 'bad')}</div>
    <div class="grid g2">${card('Year by year', 'At the opening price.', table([{l: 'Year'}, {l: 'Record', r: 1}, {l: 'Units', r: 1}, {l: 'Return', r: 1}], yrs.map(y => { const x = by[y]; return `<tr><td>${y}</td><td class="r num">${x.wins}-${x.losses}</td><td class="r num ${x.units >= 0 ? 'pos' : 'neg'}">${sgn(x.units, 1)}</td><td class="r num">${sgn(100 * x.roi, 1)}%</td></tr>`; })))}
      ${card('Latest graded bets', '', table([{l: 'Date'}, {l: 'Fighter'}, {l: 'Price', r: 1}, {l: 'Edge', r: 1}, {l: 'Result'}], (E.recent || []).slice().reverse().slice(0, 25).map(x => `<tr><td class="muted">${esc(String(x.date).slice(0, 10))}</td><td>${esc(x.key)}</td><td class="r num">${uam(x.price)}</td><td class="r num">${pct(x.edge, 1)}</td><td><span class="badge ${x.profit > 0 ? 'good' : 'bad'}">${x.profit > 0 ? 'win' : 'loss'}</span></td></tr>`), {h: 420}))}</div>`;
}
function uModel() {
  const M = UF.model_test || {}, w = M.win || {}, BT = UF.backtest || {}, l = BT.ll || {}, by = M.by_year || {};
  $('#view').innerHTML = `<div class="tiles">${tile(pct(w.acc_locksmith, 1), 'winners picked (Locksmith alone)')}${tile(pct(w.acc_elo, 1), 'winners picked by Elo alone')}${tile(fx(w.ll_locksmith, 3), 'log loss (lower is better)')}${tile(fx(l.close, 3), 'closing line log loss')}</div>`
    + `<div class="grid g2">${card('Every year, predicted from earlier years only', `${(M.fights || 0).toLocaleString()} fights.`, table([{l: 'Year'}, {l: 'Fights', r: 1}, {l: 'Winners picked', r: 1}, {l: 'Log loss', r: 1}], Object.entries(by).map(([y, x]) => `<tr><td>${y}</td><td class="r num">${x.n}</td><td class="r num">${pct(x.acc, 1)}</td><td class="r num">${fx(x.ll, 3)}</td></tr>`)))}
      ${card('Against the betting line', 'Log loss on fights with odds (lower is better).', table([{l: 'Source'}, {l: 'Log loss', r: 1}], [['Locksmith alone', l.locksmith], ['Opening line', l.open], ['Locksmith + opening line', (BT.ll_blend || {}).blend_open], ['Closing line', l.close]].map(([k, v]) => `<tr><td>${k}</td><td class="r num">${fx(v, 3)}</td></tr>`)))}</div>`;
}
function uResearch() {
  const F = UF.findings || [];
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> every idea below was tested on real UFC fights and real betting lines. Only the ones marked ✓ are used in the picks.</div>`
    + `<div class="grid g2">${F.map(x => `<div class="card finding"><span class="ic ${x.verdict}">${{works: '✓', doesnt: '✗', neutral: '•', lesson: '!'}[x.verdict] || '•'}</span><div><h3>${esc(x.title)}</h3><p class="note">${esc(x.text)}</p></div></div>`).join('')}</div>`;
}
