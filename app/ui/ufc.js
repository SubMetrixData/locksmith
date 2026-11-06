// Locksmith :: UFC. Data: reports/ufc/app_data.json (python -m locksmith.ufc.card).
// Every verdict comes from reports/bets.json through the gp* helpers in props.js (the fight page leans the same fighter the
// Today line does, because it reads the same line); the win chance shown is the market's unless reports/certificate.json says
// Locksmith's fighter model beats it, and raw-model numbers sit inside "Show the numbers".
let UF = null, UEV = null, UFIGHT = null, UTAB = 'tape';
const UTITLES = {slate: 'UFC fights', game: 'UFC fight', live: 'Live betting', props: 'Fighter props', record: 'UFC record', model: 'UFC: us vs the market', research: 'UFC research'};
const UFC_VIEWS = ['slate', 'game', 'live', 'props', 'record', 'model', 'research'];
const UCOL = ['#d4483b', '#3b7bd4'];                       // red corner / blue corner (the corners' own colours, like team colours)
const uam = x => ok(x) ? (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(Math.round(x)) : '–';      // a real minus sign, as everywhere else
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
  if (VIEW === 'game' && UFIGHT != null) { const f = UF.fights.find(x => String(x.fight_id) === String(UFIGHT)); if (f && f.event_id !== UEV) UEV = f.event_id; }   // opened from a list: that fight's card
  await (VIEW === 'record' ? gpTrackLoad() : gpLoad());
  const evs = [...new Map(UF.fights.map(f => [f.event_id, f])).values()];
  $('#eyebrow').textContent = evs.length ? `${evs[0].event} · ${new Date(evs[0].start).toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric'})}` : 'UFC';
  $('#weeks').innerHTML = evs.length > 1 ? evs.map(e => `<button class="chip${e.event_id === UEV ? ' on' : ''}" data-uev="${e.event_id}">${esc(e.event)}</button>`).join('') : '';
  $('#weeks').style.display = evs.length > 1 ? '' : 'none';
  document.querySelectorAll('[data-uev]').forEach(c => c.onclick = () => { UEV = c.dataset.uev; UFIGHT = null; ufcRender(); });
  ({slate: uPicks, game: uGame, props: uProps, record: uRecord, model: uModel, research: uResearch}[VIEW] || uPicks)();
}

// ---------------------------------------------------------------- the card: one line per fight, the verdict from bets.json
function uPicks() {
  const F = ufights();
  $('#view').innerHTML = `<div class="verdict big1">${F.length ? `${gpCount('ufc', F.map(f => f.fight_id))} <span class="muted">${F.length} fights on ${esc(F[0].event)}.</span>` : '<b>No fights on this card.</b>'}</div>`
    + `<div class="gp-list">${F.map(f => { const G = gpGame('ufc', f.fight_id), ch = gpHomeChance('ufc', G, f.true_prob);
      const fav = ch ? `${esc(ushort(ch.p >= .5 ? f.A.name : f.B.name))} ${gpPct(Math.max(ch.p, 1 - ch.p))}` : '';
      const t = (() => { try { return new Date(f.start).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}); } catch (e) { return ''; } })();
      return `<div class="gp-row click" data-uf="${esc(f.fight_id)}"><span class="gp-t">${esc(t)}</span><span class="gp-m">${esc(f.A.name)} vs ${esc(f.B.name)}</span><span class="gp-p muted">${esc(f.wclass || '')}${f.state === 'post' ? ` · Final: ${esc(ushort((f.A.winner ? f.A : f.B.winner ? f.B : {name: 'no result'}).name))} won` : fav ? ` · ${ch.ours ? 'Our chance' : 'Market'}: ${fav}` : ''}</span><span class="gp-v">${gpShort('ufc', f.fight_id)}</span></div>`; }).join('')}</div>`;
  document.querySelectorAll('[data-uf]').forEach(el => el.onclick = () => { UFIGHT = el.dataset.uf; UTAB = 'tape'; go('game'); });
}

// ---------------------------------------------------------------- fight page
const TAPE = [['Record', t => null, 'record'], ['UFC fights', t => t.n, 'n', 0], ['Age', t => t.age, 'age', 1, -1], ['Height (in)', t => t.height, 'height', 0], ['Reach (in)', t => t.reach, 'reach', 0],
  ['Sig. strikes landed / min', t => t.slpm, 'slpm', 2], ['Sig. strikes absorbed / min', t => t.sapm, 'sapm', 2, -1], ['Striking accuracy', t => t.sig_acc, 'sig_acc', 'p'], ['Striking defence', t => t.sig_def, 'sig_def', 'p'],
  ['Takedowns / 15 min', t => t.td15, 'td15', 2], ['Takedown accuracy', t => t.td_acc, 'td_acc', 'p'], ['Takedown defence', t => t.td_def, 'td_def', 'p'], ['Submission attempts / 15', t => t.sub15, 'sub15', 2],
  ['Control time share', t => t.ctrl_sh, 'ctrl_sh', 'p'], ['Knockdowns / 15', t => t.kd15, 'kd15', 2], ['Knocked down / 15', t => t.okd15, 'okd15', 2, -1],
  ['Wins by KO', t => t.ko_w_rate, 'ko_w_rate', 'p'], ['Wins by submission', t => t.sub_w_rate, 'sub_w_rate', 'p'], ['Losses by KO', t => t.ko_l_rate, 'ko_l_rate', 'p', -1],
  ['Striking vs opponents’ norm', t => t.adj_off, 'adj_off', 2], ['Defence vs opponents’ norm', t => t.adj_def, 'adj_def', 2]];
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
  const P = f.props || {}, cells = [['A', 'KO'], ['A', 'SUB'], ['A', 'DEC'], ['B', 'KO'], ['B', 'SUB'], ['B', 'DEC']];
  const mx = Math.max(...cells.map(([s, m]) => P[`${s}_${m}`] || 0), 1e-6);
  const er = P.end_round || [];
  return `<div class="ends2">${cells.map(([s, m]) => `<div class="e2"><span>${esc(ushort(f[s].name))} by ${METH[m]}</span><i><i style="width:${100 * (P[`${s}_${m}`] || 0) / mx}%;background:${UCOL[s === 'A' ? 0 : 1]}"></i></i><b>${pct(P[`${s}_${m}`])}</b><small>fair ${uam(amFairU(P[`${s}_${m}`]))}</small></div>`).join('')}</div>
    <h4 class="u4">When it ends</h4><div class="rbars">${er.map((p, i) => `<div><i style="height:${Math.min(100, 300 * p)}%"></i><b>${pct(p)}</b><span>R${i + 1}</span></div>`).join('')}<div class="dec"><i style="height:${Math.min(100, 300 * (P.distance || 0) / 2)}%"></i><b>${pct(P.distance)}</b><span>Decision</span></div></div>`;
}
const amFairU = p => !(p > 0 && p < 1) ? null : p >= .5 ? -100 * p / (1 - p) : 100 * (1 - p) / p;
function propsTable(f) {
  const P = f.props || {}, R = P.rounds || {};
  const rows = [['Fight goes the distance', P.distance], ['Fight does not go the distance', 1 - P.distance],
    ...Object.entries(R).flatMap(([L, v]) => [[`Over ${L} rounds`, v.over], [`Under ${L} rounds`, v.under]]),
    [`${f.A.name} by KO/TKO`, P.A_KO], [`${f.A.name} by submission`, P.A_SUB], [`${f.A.name} by decision`, P.A_DEC], [`${f.B.name} by KO/TKO`, P.B_KO], [`${f.B.name} by submission`, P.B_SUB], [`${f.B.name} by decision`, P.B_DEC]];
  return table([{l: 'Bet'}, {l: 'Raw model', r: 1}, {l: 'Fair price', r: 1}], rows.map(([l, p]) => `<tr><td>${esc(l)}</td><td class="r num">${pct(p)}</td><td class="r num">${uam(amFairU(p))}</td></tr>`))
    + `<p class="note">A fair price is the break-even if the raw model were right. Method and round props have not been tested against real prop prices.</p>`;
}
// the biggest stat differences between the two fighters: facts from the tape, no lean of their own
function whyList(f) {
  const a = f.A.tape || {}, b = f.B.tape || {}, A = ushort(f.A.name), B = ushort(f.B.name), out = [];
  const d = (k) => (a[k] ?? 0) - (b[k] ?? 0);
  if (a.slpm != null && b.slpm != null) { const net = (a.slpm - a.sapm) - (b.slpm - b.sapm); out.push([Math.abs(net), `${net > 0 ? A : B} wins the striking exchanges by more: ${fx(Math.abs(net), 1)} more significant strikes per minute (landed minus absorbed).`]); }
  if (a.td15 != null && b.td15 != null) { const g = (a.td15 * (1 - b.td_def)) - (b.td15 * (1 - a.td_def)); out.push([Math.abs(g) * 1.2, `${g > 0 ? A : B} should land more takedowns (${fx(Math.max(a.td15 * (1 - b.td_def), b.td15 * (1 - a.td_def)), 1)} expected per 15 minutes vs ${fx(Math.min(a.td15 * (1 - b.td_def), b.td15 * (1 - a.td_def)), 1)}).`]); }
  if (a.okd15 != null && b.okd15 != null && Math.abs(d('okd15')) > 0.1) out.push([Math.abs(d('okd15')) * 3, `${d('okd15') > 0 ? A : B} gets knocked down more often (${fx(Math.max(a.okd15, b.okd15), 2)} per 15 minutes): a durability question.`]);
  if (a.age != null && b.age != null && Math.abs(d('age')) >= 3) out.push([Math.abs(d('age')) / 3, `${d('age') > 0 ? B : A} is ${fx(Math.abs(d('age')), 0)} years younger${Math.max(a.age, b.age) >= 34 ? ` (${d('age') > 0 ? A : B} is ${fx(Math.max(a.age, b.age), 0)})` : ''}.`]);
  if (a.reach != null && b.reach != null && Math.abs(d('reach')) >= 2) out.push([Math.abs(d('reach')) / 3, `${d('reach') > 0 ? A : B} has a ${fx(Math.abs(d('reach')), 0)}-inch reach advantage.`]);
  if (a.n != null && b.n != null && Math.min(a.n, b.n) <= 1) out.push([2, `${a.n <= b.n ? A : B} has ${fx(Math.min(a.n, b.n), 0)} UFC fight${Math.min(a.n, b.n) === 1 ? '' : 's'}: little UFC data, so the betting line carries most of the weight here.`]);
  if (a.layoff != null && b.layoff != null && Math.max(a.layoff, b.layoff) > 400) out.push([1, `${a.layoff > b.layoff ? A : B} has been out ${fx(Math.max(a.layoff, b.layoff) / 30.4, 0)} months.`]);
  return out.sort((x, y) => y[0] - x[0]).slice(0, 6).map(x => `<li>${esc(x[1])}</li>`).join('');
}
function uGame() {
  const F = ufights(); if (!F.length) { $('#view').innerHTML = '<div class="card empty">No fights on this card.</div>'; return; }
  const f = F.find(x => String(x.fight_id) === String(UFIGHT)) || F[0]; UFIGHT = f.fight_id;
  const G = gpGame('ufc', f.fight_id), m = f.market || {}, ch = gpHomeChance('ufc', G, f.true_prob), pA = ch ? ch.p : null;
  const side = (s, r) => `<div class="uh-f${r ? ' r' : ''}">${uface(f, s, 96)}<div><b>${esc(f[s].name)}</b><span>${esc(f[s].record || '')}${f[s].tape && f[s].tape.n != null ? ` · ${fx(f[s].tape.n, 0)} UFC` : ''}</span>${pA != null ? `<em style="color:${UCOL[s === 'A' ? 0 : 1]}">${gpPct(s === 'A' ? pA : 1 - pA)}</em>` : ''}</div></div>`;
  const hero = `<div class="card uhero" style="--ca:${UCOL[0]};--ch:${UCOL[1]}"><div class="eyebrow">${esc(f.event)} · ${esc(f.wclass)} · ${f.rounds} rounds${f.order === f.n_fights - 1 ? ' · main event' : ''}</div>
    <div class="uh-row">${side('A', false)}<div class="uh-vs">VS</div>${side('B', true)}</div>
    ${pA != null ? `<div class="winbar"><span style="width:${100 * pA}%;background:${UCOL[0]}"></span><span style="width:${100 * (1 - pA)}%;background:${UCOL[1]}"></span></div>` : ''}
    ${answer([gpWho(ch, f.A.name, f.B.name, null, null),
      {l: 'Betting line', v: m.best_A != null && m.best_B != null ? `${esc(ushort(f.A.name))} ${uam(m.best_A)} · ${esc(ushort(f.B.name))} ${uam(m.best_B)}` : m.now_A != null ? `${esc(ushort(f.A.name))} ${uam(m.now_A)} · ${esc(ushort(f.B.name))} ${uam(m.now_B)}` : 'Not posted yet',
        s: [m.best_A != null && m.best_B != null ? `best price across books (typical now ${uam(m.now_A)} / ${uam(m.now_B)})` : '', m.open_A != null ? `opened ${esc(ushort(f.A.name))} ${uam(m.open_A)}, ${esc(ushort(f.B.name))} ${uam(m.open_B)}` : ''].filter(Boolean).join(' · ')},
      f.state === 'post' ? {l: 'Result', v: `${esc((f.A.winner ? f.A : f.B.winner ? f.B : {name: 'No result'}).name)}${f.A.winner || f.B.winner ? ' won' : ''}`} : null])}</div>`;
  const tabs = [['tape', 'Tale of the tape'], ['why', 'Key differences']];
  const body = UTAB === 'why' ? card('Key differences', 'The biggest gaps between the two fighters’ numbers.', `<ul class="ulist">${whyList(f) || '<li>Not enough UFC data on these fighters.</li>'}</ul>`)
    : card('Tale of the tape', `${esc(f.A.name)} (red) vs ${esc(f.B.name)} (blue). The better number is highlighted.`, tapeTable(f));
  const chips = F.length > 1 ? card('Other fights', '', `<div class="chips gchips">${F.map(x => `<button class="chip${x.fight_id === UFIGHT ? ' on' : ''}" data-ufc="${esc(x.fight_id)}">${esc(ushort(x.A.name))} vs ${esc(ushort(x.B.name))}</button>`).join('')}</div>`) : '';
  $('#view').innerHTML = gpHead('ufc', f.fight_id) + hero + gpSides('ufc', f.fight_id) + `<div class="tabs">${tabs.map(([k, l]) => `<button class="${UTAB === k ? 'on' : ''}" data-ut="${k}">${l}</button>`).join('')}</div>` + body + chips + gpRaw(uNumbers(f, ch));
  document.querySelectorAll('[data-ufc]').forEach(c => c.onclick = () => { UFIGHT = c.dataset.ufc; uGame(); window.scrollTo(0, 0); });
  document.querySelectorAll('[data-ut]').forEach(c => c.onclick = () => { UTAB = c.dataset.ut; uGame(); });
}
// the raw fighter model: its chance on its own, the most likely finish, the finish and round chances, the fair prices
function uNumbers(f, ch) {
  const tp = f.true_prob || {}, L = f.likely || {}, m = f.market || {}, mNow = ch && ch.mkt != null ? ch.mkt : m.p_now_A;   // the same market number the page shows
  const raw = table([{l: ''}, {l: 'Chance', r: 1}], [
    f.p_model != null ? `<tr><td>${esc(f.A.name)}: raw model on its own</td><td class="r num">${pct(f.p_model, 1)}</td></tr>` : '',
    tp.A != null && tp.source && tp.source !== 'market' ? `<tr><td>${esc(f.A.name)}: model pooled with the price</td><td class="r num">${pct(tp.A, 1)}</td></tr>` : '',
    mNow != null ? `<tr><td>${esc(f.A.name)}: market now</td><td class="r num">${pct(mNow, 1)}</td></tr>` : '',
    m.p_open_A != null ? `<tr><td>${esc(f.A.name)}: market at the opener</td><td class="r num">${pct(m.p_open_A, 1)}</td></tr>` : '',
    L.side && f[L.side] ? `<tr><td>Most likely finish: ${esc(ushort(f[L.side].name))} by ${METH[L.method] || esc(L.method)}</td><td class="r num">${pct(L.p)}</td></tr>` : ''].filter(Boolean));
  return `<div class="grid g2">${card('The raw model on this fight', '', raw)}${f.props ? card('How the fight ends', 'Chance of each finish for each fighter, and the round it ends in.', endsChart(f)) : ''}</div>`
    + (f.props ? card('Fair prices', 'The raw model’s chance and break-even price for common fight bets.', propsTable(f)) : '');
}

// ---------------------------------------------------------------- fighter props, record, model, research
const SLAB = {sig: 'sig. strikes', r1sig: 'R1 sig. strikes', td: 'takedowns'};
const SCN = {self_KO: 'wins by KO', self_SUB: 'wins by sub', self_DEC: 'wins on points', opp_KO: 'gets KO’d', opp_SUB: 'gets subbed', opp_DEC: 'loses on points'};
const scriptNote = r => (r.scripts || []).slice().sort((a, b) => b.p - a.p).slice(0, 3).map(x => `${SCN[x.scen]} (${pct(x.p)}): ${fx(x.proj, 0)}`).join(' · ');
let UPF = 'plays';
function statRows(F, onlyPlays) {
  const out = [];
  F.forEach(f => ['A', 'B'].forEach(s => ((f.stat_props || {})[s] || []).forEach(r => { if (r.has_line && (!onlyPlays || r.play)) out.push({f, s, r}); })));
  return out.sort((a, b) => (b.r.ev ?? -9) - (a.r.ev ?? -9));
}
// (uStatLine, not statLine: watch.js has its own statLine for NFL players, and a second declaration here replaced it.)
// Fighter stat props are not graded by bets.json and have not been proven on real lines yet, so the best they can be is a
// Lean (no stake); the model's projection, chance and value are behind "Show the numbers".
function uStatLine({f, s, r}) {
  const px = r.best === 'over' ? r.px_over : r.px_under;
  return `<tr><td><b>${esc(f[s].name)}</b> ${r.best === 'over' ? 'Over' : 'Under'} ${fx(r.line, 1)} ${SLAB[r.stat] || esc(r.stat)}</td><td class="r num">${esc(String(px ?? '–'))}</td><td>${r.play ? '<span class="gp-pill g-lean">Lean</span> <span class="muted">no stake</span>' : '<span class="gp-pill">No bet</span>'}</td></tr>`;
}
function statRaw({f, s, r}) {
  const pp = r.best === 'over' ? r.p_over : 1 - r.p_over, camp = ((f.stat_props || {})[s + '_camp'] || {}).camp;
  return `<tr><td>${esc(f[s].name)} ${r.best === 'over' ? 'Over' : 'Under'} ${fx(r.line, 1)} ${SLAB[r.stat] || esc(r.stat)}${r.thin ? ' <small>(thin data)</small>' : ''}<br><small class="muted">${esc(scriptNote(r))}${camp ? ' · ' + esc(camp.trim()) : ''}</small></td><td class="r num">${fx(r.proj, 1)}</td><td class="r num">${pct(pp)}</td><td class="r num">${r.ev != null ? (r.ev >= 0 ? '+' : '') + pct(r.ev, 1) : '–'}</td></tr>`;
}
function uProps() {
  const F = ufights(), rows = statRows(F, UPF === 'plays'), pt = (UF && UF.props_test) || null;
  const chips = `<div class="chips">${[['plays', 'Leans'], ['all', 'All lines']].map(([k, l]) => `<button class="chip${UPF === k ? ' on' : ''}" data-upf="${k}">${l}</button>`).join('')}</div>`;
  const test = pt && pt.targets ? `<p class="note">Tested on past fights ${pt.years[0]}-${pt.years[1]} (each year predicted from earlier years): the projections missed by less than a book-style baseline on every stat (sig. strikes ${fx(pt.targets.sig.mae_model, 1)} vs ${fx(pt.targets.sig.mae_base, 1)} average miss). That is not a test against real prop prices; those results are logged each card and graded as they come in.</p>` : '';
  $('#view').innerHTML = `<div class="gp-line g-pass"><span class="gp-g">No bet</span><span class="gp-lab">Fighter props for ${esc(F[0] ? F[0].event : 'the card')} are not proven on real lines yet, so none is staked.</span></div><div class="gp-sub">Significant strikes, round-1 significant strikes and takedowns against the live Underdog lines.</div>`
    + card('Fighter props', `${rows.length} ${UPF === 'plays' ? 'leans' : 'lines'}`, chips + (rows.length ? table([{l: 'Bet'}, {l: 'Price', r: 1}, {l: 'Verdict'}], rows.map(uStatLine)) : '<p class="note">No lines posted yet.</p>'))
    + gpRaw((rows.length ? card('The raw model on each line', 'Projection, chance of the side shown and value at the posted price.', table([{l: 'Line'}, {l: 'Projection', r: 1}, {l: 'Chance', r: 1}, {l: 'Value', r: 1}], rows.map(statRaw))) : '') + test
      + F.map(f => f.props ? card(`${esc(f.A.name)} vs ${esc(f.B.name)}`, `${esc(f.wclass)} · ${f.rounds} rounds`, propsTable(f)) : '').join(''));
  document.querySelectorAll('[data-upf]').forEach(b => b.onclick = () => { UPF = b.dataset.upf; uProps(); });
}
// the live record of real logged bets leads; the backtest follows, labelled as past games
function uRecord() {
  const BT = UF.backtest || {}, S = BT.strategies || {}, E = S.early || {}, FD = S.fightday || {}, wf = E.walk_forward || {}, sc = E.same_bets_at_close || {}, c = BT.clv || {};
  const by = E.by_year || {}, yrs = Object.keys(by).sort();
  $('#view').innerHTML = gpLiveRecord('ufc', {name: 'UFC'})
    + gpPast(wf.bets ? `Betting the fighter Locksmith liked at the <b>opening</b> price, replayed on past fights with rules chosen each year from earlier years only: <b>${wf.wins}-${wf.losses}</b>, ${sgn(100 * wf.roi, 1)}% a bet. The same bets at the closing price returned ${sgn(100 * (sc.roi || 0), 1)}%, and betting on fight day at the closing line ${sgn(100 * ((FD.walk_forward || {}).roi || 0), 1)}%.${c.toward != null ? ` The line moved toward Locksmith’s fighter ${pct(c.toward)} of the time.` : ''}` : 'Not enough odds history yet.')
    + (wf.bets ? gpRaw(`<div class="grid g2">${card('Year by year', 'At the opening price.', table([{l: 'Year'}, {l: 'Record', r: 1}, {l: 'Units', r: 1}, {l: 'Return', r: 1}], yrs.map(y => { const x = by[y]; return `<tr><td>${y}</td><td class="r num">${x.wins}-${x.losses}</td><td class="r num ${x.units >= 0 ? 'pos' : 'neg'}">${sgn(x.units, 1)}</td><td class="r num">${sgn(100 * x.roi, 1)}%</td></tr>`; })))}
      ${card('Latest past bets graded', '', table([{l: 'Date'}, {l: 'Fighter'}, {l: 'Price', r: 1}, {l: 'Result'}], (E.recent || []).slice().reverse().slice(0, 25).map(x => `<tr><td class="muted">${esc(String(x.date).slice(0, 10))}</td><td>${esc(x.key)}</td><td class="r num">${uam(x.price)}</td><td><span class="badge ${x.profit > 0 ? 'good' : 'bad'}">${x.profit > 0 ? 'win' : 'loss'}</span></td></tr>`), {h: 420}))}</div>`, 'The backtest in detail (past fights, not live bets).') : '');
}
function uModel() {
  const M = UF.model_test || {}, w = M.win || {}, BT = UF.backtest || {}, l = BT.ll || {}, by = M.by_year || {}, cert = gpCert('ufc', 'win');
  const better = l.close != null && (BT.ll_blend || {}).blend_open != null ? (BT.ll_blend || {}).blend_open < l.close : null;
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> ${cert ? `${esc(cert.plain || 'Locksmith’s UFC win chances beat the closing odds on fights the model never saw.')} So the fight pages show Locksmith’s chance, marked “Beats the market”.` : `on its own, Locksmith’s fighter model is less accurate than the betting line. The fight pages show the market’s chance until a test on unseen fights says Locksmith’s beats it.`}</div>`
    + gpRaw(`<div class="tiles">${tile(pct(w.acc_locksmith, 1), 'winners picked (raw model alone)')}${tile(pct(w.acc_elo, 1), 'winners picked by Elo alone')}${tile(fx(w.ll_locksmith, 3), 'raw model log loss (lower is better)')}${tile(fx(l.close, 3), 'closing line log loss')}</div>`
    + `<div class="grid g2">${card('Every year, predicted from earlier years only', `${(M.fights || 0).toLocaleString()} fights.`, table([{l: 'Year'}, {l: 'Fights', r: 1}, {l: 'Winners picked', r: 1}, {l: 'Log loss', r: 1}], Object.entries(by).map(([y, x]) => `<tr><td>${y}</td><td class="r num">${x.n}</td><td class="r num">${pct(x.acc, 1)}</td><td class="r num">${fx(x.ll, 3)}</td></tr>`)))}
      ${card('Against the betting line', `Log loss on fights with odds (lower is better).${better != null ? ` Locksmith blended with the opening line ${better ? 'beat' : 'did not beat'} the closing line here.` : ''}`, table([{l: 'Source'}, {l: 'Log loss', r: 1}], [['Raw model alone', l.locksmith], ['Opening line', l.open], ['Raw model + opening line', (BT.ll_blend || {}).blend_open], ['Closing line', l.close]].map(([k, v]) => `<tr><td>${k}</td><td class="r num">${fx(v, 3)}</td></tr>`)))}</div>`, 'How the model was tested (past fights).');
}
function uResearch() {
  const F = UF.findings || [];
  $('#view').innerHTML = `<div class="verdict big1"><b>The short version:</b> every idea below was tested on past UFC fights and betting lines. ${typeof lkUsedHTML === 'function' ? lkUsedHTML('ufc', 'UFC') : 'These are tests on past games, not live bets.'}</div>`
    + `<div class="grid g2">${F.map(x => `<div class="card finding"><span class="ic ${x.verdict}">${{works: '✓', doesnt: '✗', neutral: '•', lesson: '!'}[x.verdict] || '•'}</span><div><h3>${esc(x.title)}</h3><p class="note">${esc(gpWords(x.text))}</p></div></div>`).join('')}</div>`;
}
