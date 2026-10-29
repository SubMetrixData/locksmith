// Locksmith Hockey broadcast: a simulated NHL game, event by event, from reports/nhl/sims/<game_id>.json.
// Canvas renderer with a perspective camera that follows the puck, 12 players in formation, live odds and stats.
'use strict';
const HW = {gid: null, d: null, i: -1, playing: false, speed: 1, tab: 'players', cache: {}, anim: null, vnow: null, token: 0};
const hNOW = () => (HW.vnow != null ? HW.vnow : performance.now());
const hl = (a, b, t) => a + (b - a) * t, hc = (v, a, b) => Math.max(a, Math.min(b, v)), hease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const HDUR = {fo: 1.0, shot: 2.1, miss: 1.5, block: 1.5, hit: 1.4, stop: 1.1, pen: 3.0, ppend: .9, goal: 5.2, pull: 2.2, pend: 3.2, ot: 2.6, so: 2.2, so_att: 2.6, so_end: 3.4, final: 4.5, start: 1.6};
const hCol = (t, k = 0) => (NHL_COL[t] || ['#456', '#ddd'])[k];
const hName = n => { n = String(n || ''); const p = n.split(' '); return p.length < 2 || n.includes('.') ? n : p[0][0] + '. ' + p.slice(1).join(' '); };

async function hLoad(gid) {
  if (HW.cache[gid]) return HW.cache[gid];
  let d; try { d = (window.pywebview && window.pywebview.api && window.pywebview.api.get_nhl_sim) ? await window.pywebview.api.get_nhl_sim(gid) : await (await fetch(`../../reports/nhl/sims/${gid}.json`, {cache: 'no-store'})).json(); }
  catch (e) { d = {error: 'No simulation for this game yet. Click Update all.'}; }
  HW.cache[gid] = d; return d;
}
function hStop() { HW.playing = false; HW.token++; const ic = $('#hPlayIc'); if (ic) ic.innerHTML = '<path d="M7 4l13 8-13 8z"/>'; }

async function nWatch() {
  const qs = new URLSearchParams(location.search);
  if (qs.get('hwatch') && !HW._qs) { HW._qs = true; HW.gid = +qs.get('hwatch'); HW.i = +(qs.get('at') ?? -1); const b = N.books.find(x => x.game_id === HW.gid); if (b) NDATE = b.date; nhlChips(); }
  const bk = nbooks();
  if (!HW.gid || !bk.find(b => b.game_id === HW.gid)) HW.gid = (NGAME && bk.find(b => b.game_id === NGAME)) ? NGAME : bk[0] && bk[0].game_id;
  if (!HW.gid) { $('#view').innerHTML = card('Watch', '', '<p class="note">No games on this day.</p>'); return; }
  $('#view').innerHTML = `<div class="chips wgames">${bk.map(x => `<button class="chip${x.game_id === HW.gid ? ' on' : ''}" data-hg="${x.game_id}">${x.away} @ ${x.home}</button>`).join('')}</div><div id="hbody"><div class="card empty">Loading the broadcast…</div></div>`;
  document.querySelectorAll('[data-hg]').forEach(el => el.onclick = () => { hStop(); HW.gid = +el.dataset.hg; HW.i = -1; nWatch(); });
  const d = await hLoad(HW.gid);
  if (VIEW !== 'watch' || SPORT !== 'nhl') return;
  if (!d || d.error) { $('#hbody').innerHTML = card('Watch', '', `<p class="note">${esc((d && d.error) || 'Simulation not available.')}</p>`); return; }
  HW.d = d; HW.E = d.events; hBuild();
}

function hBuild() {
  const d = HW.d, H = d.home, A = d.away, pf = d.pred_final, b = N.books.find(x => x.game_id === d.game_id);
  HW.total = Math.max(3600, ...HW.E.map(e => Math.min(e.t, 3990)));
  const sub = `<div class="wsub"><b>Locksmith’s most likely game</b><span>Predicted final: ${esc(nTeam(A))} ${pf[1]} – ${esc(nTeam(H))} ${pf[0]} · ${esc(nTeam(d.p_home >= .5 ? H : A))} win ${pct(Math.max(d.p_home, 1 - d.p_home))} of 20,000 simulated games. This one ends on that exact score.</span></div>`;
  const bug = `<div class="bug hbug" style="--ca:${hCol(A)};--ch:${hCol(H)}">
      <div class="bugt a"><span class="bugab">${A}</span><span class="hsog" id="hsA">SOG 0</span><span class="bugpts" id="hgA">0</span></div>
      <div class="bugt h"><span class="bugab">${H}</span><span class="hsog" id="hsH">SOG 0</span><span class="bugpts" id="hgH">0</span></div>
      <div class="bugm"><span id="hP">1st</span><span id="hC" class="bugclk">20:00</span></div><div class="bugdd" id="hST"></div></div>`;
  const ctl = `<div class="wctl"><button class="wbtn" id="hPrev" title="Previous event"><svg viewBox="0 0 24 24"><path d="M6 5v14M19 5l-10 7 10 7z"/></svg></button>
      <button class="wbtn big" id="hPlay" title="Play / pause"><svg viewBox="0 0 24 24" id="hPlayIc"><path d="M7 4l13 8-13 8z"/></svg></button>
      <button class="wbtn" id="hNext" title="Next event"><svg viewBox="0 0 24 24"><path d="M18 5v14M5 5l10 7-10 7z"/></svg></button>
      <div class="wspeed">${[[1, '1×'], [2, '2×'], [4, '4×'], [10, '10×']].map(([x, l]) => `<button data-hsp="${x}" class="${x === HW.speed ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="wjump">${['P1', 'P2', 'P3'].concat(HW.E.some(e => e.p >= 4) ? ['OT'] : []).map((q, k) => `<button data-hj="${k + 1}">${q}</button>`).join('')}<button data-hj="goal" title="Next goal">Next goal</button><button data-hj="end">End</button></div></div>
    <div class="wtl" id="htl"><div class="wtlq">${[1, 2].map(q => `<i style="left:${q * 1200 / HW.total * 100}%"></i>`).join('')}${HW.total > 3600 ? `<i style="left:${3600 / HW.total * 100}%"></i>` : ''}</div><div class="wtlfill" id="htlfill"></div>
      <div class="wtlm">${HW.E.filter(e => e.k === 'goal').map(e => `<i style="left:${Math.min(e.t, HW.total) / HW.total * 100}%;background:${hCol(e.tm === 0 ? H : A)}"></i>`).join('')}</div><div class="wtlhead" id="htlhead"></div></div>`;
  const right = `<div class="wside"><div class="card wodds"><div class="card-h"><span class="eyebrow">Live odds · updates every event</span></div><div id="hOdds"></div></div>
      <div class="card wwp"><div class="card-h"><div><span class="eyebrow">Win probability</span><div class="wwpnow" id="hWPn"></div></div></div><div id="hWP"></div></div>
      <div class="card wpanel"><div class="tabs wtabs">${[['players', 'Players'], ['plays', 'Plays'], ['team', 'Team']].map(([k, l]) => `<button data-ht="${k}" class="${k === HW.tab ? 'on' : ''}">${l}</button>`).join('')}</div><div id="hpane" class="wpane"></div></div></div>`;
  $('#hbody').innerHTML = sub + `<div class="wgrid"><div class="wmain"><div class="card wstage"><div class="tv" id="htv"><canvas id="hcv"></canvas>${bug}
      <div class="tvtools"><button id="hFull" title="Full screen">⛶</button></div><div class="lower" id="hlow"></div><div class="wbanner" id="hban"></div><div class="wintro" id="hintro"></div></div>${ctl}</div></div>${right}</div>`;
  document.querySelectorAll('[data-ht]').forEach(el => el.onclick = () => { HW.tab = el.dataset.ht; document.querySelectorAll('[data-ht]').forEach(x => x.classList.toggle('on', x === el)); hPane(); });
  document.querySelectorAll('[data-hsp]').forEach(el => el.onclick = () => { HW.speed = +el.dataset.hsp; document.querySelectorAll('[data-hsp]').forEach(x => x.classList.toggle('on', x === el)); });
  document.querySelectorAll('[data-hj]').forEach(el => el.onclick = () => { const v = el.dataset.hj; let k;
    if (v === 'end') k = HW.E.length - 1; else if (v === 'goal') k = HW.E.findIndex((e, j) => j > HW.i && e.k === 'goal'); else k = HW.E.findIndex(e => e.p === +v) - 1;
    if (k >= -1) { hStop(); hSeek(k < 0 && v === 'goal' ? HW.i : k); } });
  $('#hPlay').onclick = () => HW.playing ? hStop() : hPlay(); $('#hPrev').onclick = () => { hStop(); hSeek(Math.max(-1, HW.i - 1)); }; $('#hNext').onclick = () => { hStop(); hSeek(Math.min(HW.E.length - 1, HW.i + 1)); };
  $('#hFull').onclick = () => { const el = $('#htv'); if (document.fullscreenElement) { document.exitFullscreen(); return; } if (el.classList.contains('tvmax')) { el.classList.remove('tvmax'); document.body.classList.remove('tvmax-on'); HR.resize(); return; }
    const rq = el.requestFullscreen || el.webkitRequestFullscreen; const mx = () => { el.classList.add('tvmax'); document.body.classList.add('tvmax-on'); setTimeout(() => HR.resize(), 30); };
    if (rq) { const r = rq.call(el); if (r && r.catch) r.catch(mx); } else mx(); };
  const tl = $('#htl'); tl.onclick = e => { const r = tl.getBoundingClientRect(), t = (e.clientX - r.left) / r.width * HW.total; let k = HW.E.findIndex(x => x.t >= t); if (k < 0) k = HW.E.length - 1; hStop(); hSeek(k); };
  HR.init($('#hcv'));
  hWPchart();
  hSeek(HW.i);
  const adv = new URLSearchParams(location.search).get('advance');
  if (adv && !HW._adv) { HW._adv = true; HW.vnow = 0; HW.speed = +(new URLSearchParams(location.search).get('speed') || 1); hPlay(); for (let t = 0; t < +adv; t += 16) { HW.vnow += 16; hTick(HW.vnow); } }
}

// ---------------------------------------------------------------- state after event k
function hState(k) {
  const d = HW.d, st = {score: [0, 0], sog: [0, 0], pp: [0, 0], ppg: [0, 0], hits: [0, 0], fo: [0, 0], pens: [0, 0], players: {}, strength: '', pulled: [false, false], box: [0, 0]};
  for (let j = 0; j <= k && j < HW.E.length; j++) { const e = HW.E[j], t = e.tm;
    if (e.s) st.score = e.s.slice();
    if (e.k === 'shot' || (e.k === 'goal' && e.st !== 'EN')) st.sog[t]++;
    if (e.k === 'hit') st.hits[t]++;
    if (e.k === 'fo' && t != null) st.fo[t]++;
    if (e.k === 'pen') { st.pens[t]++; st.pp[1 - t]++; st.box[t] = 1; }
    if (e.k === 'ppend') st.box[t] = 0;
    if (e.k === 'goal') { if (e.st === 'PP') { st.ppg[t]++; st.box[1 - t] = 0; } st.pulled = [false, false]; }
    if (e.k === 'pull') st.pulled[t] = true;
    if (e.k === 'pend') { st.pulled = [false, false]; }
    const P = st.players, add = (id, f, v = 1) => { if (id == null) return; P[id] = P[id] || {g: 0, a: 0, sog: 0, hits: 0}; P[id][f] += v; };
    if (e.k === 'goal') { add(e.sc, 'g'); (e.ast || []).forEach(a => add(a, 'a')); if (e.st !== 'EN') add(e.sc, 'sog'); }
    if (e.k === 'shot') add(e.sh, 'sog');
  }
  st.strength = st.pulled[0] || st.pulled[1] ? 'EMPTY NET' : st.box[0] && !st.box[1] ? `${d.away} POWER PLAY` : st.box[1] && !st.box[0] ? `${d.home} POWER PLAY` : st.box[0] && st.box[1] ? '4 ON 4' : '';
  return st;
}

// ---------------------------------------------------------------- playback
function hSeek(k) { HW.i = k; HW.anim = null; HR.place(k, 1); hBoard(k); }
function hPlay() { if (HW.i >= HW.E.length - 1) HW.i = -1; HW.playing = true; const tok = ++HW.token; const ic = $('#hPlayIc'); if (ic) ic.innerHTML = '<path d="M7 4h4v16H7zM14 4h4v16h-4z"/>';
  hStart(HW.i + 1); if (HW.vnow == null) { const loop = () => { if (tok !== HW.token || VIEW !== 'watch' || SPORT !== 'nhl') return; hTick(hNOW()); requestAnimationFrame(loop); }; requestAnimationFrame(loop); } }
function hStart(k) { if (k >= HW.E.length) { hStop(); return; } const e = HW.E[k]; HW.anim = {k, t0: hNOW(), dur: (HDUR[e.k] || 1.2) * 1000 / HW.speed}; HR.begin(k); hBanner(e); hLower(e); }
function hTick(now) {
  const a = HW.anim; if (!a) { HR.draw(now, 1); return; }
  const f = hc((now - a.t0) / a.dur, 0, 1);
  HR.draw(now, f);
  hClock(a.k, f);
  if (f >= 1) { HW.i = a.k; hBoard(HW.i); if (HW.E[a.k].k === 'final') { hStop(); hFinal(); return; } if (HW.playing) hStart(a.k + 1); else HW.anim = null; }
}
function hClock(k, f) {
  const e = HW.E[k], p = HW.E[k - 1], t = p && p.p === e.p ? hl(p.t, e.t, f) : e.t, per = e.p;
  const len = per <= 3 ? 1200 : 300, base = per <= 3 ? (per - 1) * 1200 : 3600, rem = Math.max(0, len - (t - base));
  const c = $('#hC'); if (c) c.textContent = per >= 5 || e.k.startsWith('so') ? 'SO' : `${Math.floor(rem / 60)}:${String(Math.floor(rem % 60)).padStart(2, '0')}`;
  const P = $('#hP'); if (P) P.textContent = e.k.startsWith('so') ? 'SO' : per <= 3 ? ['1st', '2nd', '3rd'][per - 1] : 'OT';
  const pct_ = Math.min(t, HW.total) / HW.total * 100; const hf = $('#htlfill'), hh = $('#htlhead'); if (hf) hf.style.width = pct_ + '%'; if (hh) hh.style.left = pct_ + '%';
}
function hBanner(e) {
  const el = $('#hban'); if (!el) return; const d = HW.d, team = e.tm === 0 ? d.home : e.tm === 1 ? d.away : null;
  const show = (html, col, ms) => { el.innerHTML = html; el.style.setProperty('--bc', col); el.classList.add('on'); clearTimeout(HW._bt); HW._bt = setTimeout(() => el.classList.remove('on'), ms / HW.speed); };
  if (e.k === 'goal') show(`<div class="big"><b>GOAL</b><span>${esc(team)} · ${esc(hName((d.players[e.sc] || {}).n))}${e.tag && e.tag !== 'goal' ? ' · ' + esc(e.tag) : ''}</span></div>`, hCol(team), 3600);
  else if (e.k === 'pen') show(`<div class="l3"><b>POWER PLAY · ${esc(e.tm === 0 ? d.away : d.home)}</b><span>${esc(e.txt.replace(/^Penalty: /, '').split('.')[0])}</span></div>`, hCol(e.tm === 0 ? d.away : d.home), 2600);
  else if (e.k === 'pull') show(`<div class="l3"><b>EMPTY NET</b><span>${esc(team)} pull the goalie for an extra attacker</span></div>`, hCol(team), 2200);
  else if (e.k === 'pend' || e.k === 'ot' || e.k === 'so') show(`<div class="l3"><b>${e.k === 'ot' ? 'OVERTIME' : e.k === 'so' ? 'SHOOTOUT' : esc(e.txt.split('.')[0].toUpperCase())}</b><span>${d.away} ${e.s[1]} · ${d.home} ${e.s[0]}</span></div>`, '#1b2430', 2600);
  else if (e.k === 'so_end') show(`<div class="big"><b>SHOOTOUT WIN</b><span>${esc(nTeam(team))}</span></div>`, hCol(team), 3000);
}
function hLower(e) { const el = $('#hlow'); if (!el) return; const d = HW.d, team = e.tm === 0 ? d.home : e.tm === 1 ? d.away : null;
  if (['fo', 'stop', 'ppend'].includes(e.k) && HW.speed > 2) return;
  el.innerHTML = `<span class="lbar" style="background:${team ? hCol(team) : '#888'}"></span><div class="ltxt">${esc(e.txt)}</div>`; el.classList.add('on'); }
function hBoard(k) {
  const d = HW.d, st = hState(k), e = HW.E[Math.max(0, k)] || {};
  const s = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  s('#hgA', st.score[1]); s('#hgH', st.score[0]); s('#hsA', 'SOG ' + st.sog[1]); s('#hsH', 'SOG ' + st.sog[0]);
  const ste = $('#hST'); if (ste) { ste.textContent = st.strength; ste.style.display = st.strength ? '' : 'none'; }
  if (k < 0) { s('#hP', '1st'); s('#hC', '20:00'); } else hClock(k, 1);
  hOdds(k); hWPdot(k); hPane(k, st);
}
function hOdds(k) {
  const d = HW.d, e = k >= 0 ? HW.E[k] : null, w = e && e.w != null ? e.w : d.p_home, lt = e && e.lt != null ? e.lt : d.pre_total, fin = e && e.k === 'final';
  const amO = p => p >= .995 || p <= .005 ? '—' : (q => q >= .5 ? '−' + Math.round(100 * q / (1 - q) / 5) * 5 : '+' + Math.round(100 * (1 - q) / q / 5) * 5)(Math.min(.995, p + .0225));
  const el = $('#hOdds'); if (!el) return;
  el.innerHTML = fin ? '<p class="note">Final. Live betting closed.</p>' : `<div class="tbl"><table class="oddst"><thead><tr><th></th><th class="r">Moneyline</th><th class="r">Win</th></tr></thead><tbody>
    <tr><td><b style="color:${hcLight(d.away)}">${d.away}</b></td><td class="r num">${amO(1 - w)}</td><td class="r num">${pct(1 - w)}</td></tr><tr><td><b style="color:${hcLight(d.home)}">${d.home}</b></td><td class="r num">${amO(w)}</td><td class="r num">${pct(w)}</td></tr></tbody></table></div>
    <div class="otot">Total goals <b class="num">${fx(lt, 1)}</b> <span class="muted">· o/u</span></div>`;
  const wn = $('#hWPn'); if (wn) wn.innerHTML = `<span class="wpdot" style="background:${hcLight(w >= .5 ? d.home : d.away)}"></span>${esc(nTeam(w >= .5 ? d.home : d.away))} ${pct(Math.max(w, 1 - w))}`;
}
function hcLight(t) { const c = hCol(t), n = parseInt(c.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255; const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255; if (lum > .25) return c;
  const m = v => Math.round(v + (255 - v) * .45); return `rgb(${m(r)},${m(g)},${m(b)})`; }
function hWPchart() {
  const W_ = 360, H_ = 130, E = HW.E, xs = t => 6 + Math.min(t, HW.total) / HW.total * (W_ - 12), ys = w => 8 + (1 - w) * (H_ - 16);
    const el = $('#hWP'); if (!el) return;
  el.innerHTML = `<svg viewBox="0 0 ${W_} ${H_}" width="100%" class="hwp"><rect x="6" y="8" width="${W_ - 12}" height="${H_ - 16}" rx="6" fill="var(--panel2)"/><line x1="6" x2="${W_ - 6}" y1="${ys(.5)}" y2="${ys(.5)}" stroke="var(--muted)" stroke-dasharray="3 4" opacity=".6"/>
    ${[1200, 2400, 3600].filter(t => t < HW.total).map(t => `<line x1="${xs(t)}" x2="${xs(t)}" y1="8" y2="${H_ - 8}" stroke="var(--rule)"/>`).join('')}
    <polyline id="hwpl" points="" fill="none" stroke="${hcLight(HW.d.home)}" stroke-width="2.4"/><circle id="hwpd" r="4" fill="var(--accent)" cx="-10" cy="-10"/>
    <text x="10" y="20" font-size="11" fill="var(--muted)">${HW.d.home} ▲</text><text x="10" y="${H_ - 12}" font-size="11" fill="var(--muted)">${HW.d.away} ▼</text></svg>`;
}
function hWPdot(k) { const E = HW.E, W_ = 360, H_ = 130, xs = t => 6 + Math.min(t, HW.total) / HW.total * (W_ - 12), ys = w => 8 + (1 - w) * (H_ - 16);
  const sub = E.slice(0, Math.max(0, k) + 1).filter(e => e.w != null); const l = $('#hwpl'), dd = $('#hwpd'); if (!l) return;
  l.setAttribute('points', [`${xs(0)},${ys(HW.d.p_home)}`].concat(sub.map(e => `${xs(e.t).toFixed(1)},${ys(e.w).toFixed(1)}`)).join(' '));
  const last = sub[sub.length - 1]; if (last) { dd.setAttribute('cx', xs(last.t)); dd.setAttribute('cy', ys(last.w)); } }
function hPane(k = HW.i, st = hState(HW.i)) {
  const el = $('#hpane'); if (!el) return; const d = HW.d;
  if (HW.tab === 'players') {
    const sec = t => { const L = (d.lines[t] || []).map(p => ({...p, s: st.players[p.id] || {g: 0, a: 0, sog: 0}})).sort((a, z) => (z.s.g * 2 + z.s.a + z.s.sog * .1) - (a.s.g * 2 + a.s.a + a.s.sog * .1));
      return `<div class="pteam"><div class="pth" style="--tcol:${hcLight(t)}"><b>${esc(nTeam(t))}</b><span class="muted">G · A · PTS · SOG</span></div><table class="pstat">${L.slice(0, 12).map(p => `<tr><td><b>${esc(hName(p.n))}</b> <span class="muted">${p.pos}${p.num != null ? ' #' + p.num : ''}</span></td><td class="r num">${p.s.g} · ${p.s.a} · <b>${p.s.g + p.s.a}</b> · ${p.s.sog}</td></tr>`).join('')}</table></div>`; };
    const gk = t => { const g = d.goalies[t]; const opp = t === d.home ? 1 : 0; const sa = st.sog[opp], ga = HW.E.slice(0, k + 1).filter(e => e.k === 'goal' && e.tm === opp && e.st !== 'EN').length;
      return g ? `<p class="note"><b>${esc(hName(g.name))}</b> (${t}): ${sa - ga} saves on ${sa} shots${sa ? ` (${fx(100 * (sa - ga) / sa, 1)}%)` : ''}</p>` : ''; };
    el.innerHTML = sec(d.away) + sec(d.home) + gk(d.away) + gk(d.home);
  } else if (HW.tab === 'plays') {
    const L = HW.E.slice(0, k + 1).map((e, j) => [e, j]).filter(([e]) => ['goal', 'pen', 'pull', 'pend', 'so_att', 'so_end', 'final', 'shot'].includes(e.k)).reverse().slice(0, 80);
    el.innerHTML = L.map(([e, j]) => { const t = e.tm === 0 ? d.home : e.tm === 1 ? d.away : null;
      return `<div class="fp${e.k === 'goal' ? ' big' : ''}${j === k ? ' cur' : ''}" style="--tcol:${t ? hcLight(t) : 'var(--muted)'}" data-hseek="${j}"><div class="fps"><b>${e.p <= 3 ? ['1st', '2nd', '3rd'][e.p - 1] : 'OT'} ${e.c}</b> ${t || ''}<span class="fpsc">${d.away} ${e.s[1]}–${e.s[0]} ${d.home}</span></div><div class="fpx">${esc(e.txt)}</div></div>`; }).join('') || '<p class="note">Nothing yet.</p>';
    el.querySelectorAll('[data-hseek]').forEach(x => x.onclick = () => { hStop(); hSeek(+x.dataset.hseek); });
  } else {
    el.innerHTML = table([{l: ''}, {l: d.away, r: 1}, {l: d.home, r: 1}], [['Goals', st.score[1], st.score[0]], ['Shots on goal', st.sog[1], st.sog[0]], ['Power plays', st.pp[1], st.pp[0]], ['Power-play goals', st.ppg[1], st.ppg[0]],
      ['Hits', st.hits[1], st.hits[0]], ['Faceoffs won', st.fo[1], st.fo[0]], ['Penalties', st.pens[1], st.pens[0]]].map(r => `<tr><td>${r[0]}</td><td class="r num">${r[1]}</td><td class="r num">${r[2]}</td></tr>`))
      + `<p class="note">Projected before the game: shots ${d.away} ${fx(d.proj_sog[1], 0)}, ${d.home} ${fx(d.proj_sog[0], 0)}.</p>`;
  }
}
function hFinal() {
  const d = HW.d, el = $('#hintro'); if (!el) return; const s = HW.E[HW.E.length - 1].s, w = s[0] > s[1] ? d.home : d.away, st = hState(HW.E.length - 1);
  const top = Object.entries(st.players).map(([id, x]) => ({id, ...x, n: (d.players[id] || {}).n, t: (d.players[id] || {}).team})).sort((a, z) => (z.g * 2 + z.a) - (a.g * 2 + a.a)).slice(0, 3);
  el.innerHTML = `<div><span class="eyebrow">Final${d.end !== 'REG' ? ' · ' + d.end : ''}</span><h3>${d.away} ${s[1]} – ${d.home} ${s[0]}</h3><p>${esc(nTeam(w))} win. Locksmith’s predicted final was ${d.away} ${d.pred_final[1]} – ${d.home} ${d.pred_final[0]}${d.pred_final[0] === s[0] && d.pred_final[1] === s[1] ? ' (right on the number)' : ''}.</p>
    <div class="ftop"><span class="eyebrow">Three stars</span>${top.map((x, k) => `<div><b>${'★'.repeat(3 - k)} ${esc(hName(x.n))}</b> <span class="muted">${x.t}</span> <span class="num">${x.g} G, ${x.a} A</span></div>`).join('')}</div>
    <div class="row-flex"><button class="btn" id="hAgain">▶ Watch again</button></div></div>`;
  el.className = 'wintro on'; $('#hAgain').onclick = () => { el.className = 'wintro'; hSeek(-1); hPlay(); };
}

// ================================================================ the rink renderer
const HR = {
  init(cv) { this.cv = cv; this.ctx = cv.getContext('2d'); this.camX = 0; this.pk = {x: 0, y: 0}; this.crowd = this.crowd || this.makeCrowd(); this.resize(); window.removeEventListener('resize', this._rs); this._rs = () => this.resize(); window.addEventListener('resize', this._rs);
    this.place(HW.i, 1); this.draw(hNOW(), 1); },
  resize() { const r = this.cv.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1); this.w = Math.max(240, r.width); this.h = Math.max(135, r.height);
    this.cv.width = this.w * this.dpr; this.cv.height = this.h * this.dpr; this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); if (this.from) this.draw(hNOW(), 1); },
  makeCrowd() { const c = document.createElement('canvas'); c.width = 600; c.height = 120; const x = c.getContext('2d'); const R = rng(7);
    x.fillStyle = '#0d1117'; x.fillRect(0, 0, 600, 120);
    for (let row = 0; row < 12; row++) for (let i = 0; i < 90; i++) { const px = i * 6.7 + (row % 2) * 3 + R() * 2, py = 8 + row * 9 + R() * 2;
      x.fillStyle = ['#c9c2b8', '#8b2a2a', '#2b4c7e', '#d9d4cc', '#444', '#a88f63', '#1f6f50'][Math.floor(R() * 7)]; x.globalAlpha = .55 + R() * .4; x.beginPath(); x.arc(px, py, 2.1, 0, 7); x.fill(); }
    return c; },
  // perspective camera: world x along the rink (-100..100 ft), y across (-42.5 near .. +42.5 far), z up
  P(x, y, z = 0) { const cx = this.camX, cy = -118, cz = 58, th = 0.47, f = this.h * 2.05;
    const dx = x - cx, dy = y - cy, dz = z - cz; const zc = dy * Math.cos(th) - dz * Math.sin(th), yc = dy * Math.sin(th) + dz * Math.cos(th);
    return [this.w / 2 + f * dx / zc, this.h * .50 - f * yc / zc, f / zc]; },
  dir(team, per) { const homeRight = per % 2 === 1; return (team === 0) === homeRight ? 1 : -1; },
  world(e) { const per = Math.min(e.p || 1, 4), d = this.dir(e.tm, per); return {x: (e.x ?? 0) * d, y: (e.y ?? 0) * d}; },
  // players: 5 skaters + goalie a side, formation around the puck, numbers from tonight's lines
  lineFor(team, t) { const L = (HW.d.lines[team] || []); const F = L.filter(p => p.pos !== 'D'), D = L.filter(p => p.pos === 'D');
    const shift = Math.floor((t || 0) / 47); const fl = shift % 4, dl = shift % 3;
    const f3 = F.slice(fl * 3, fl * 3 + 3); while (f3.length < 3 && F.length) f3.push(F[f3.length % F.length]);
    const d2 = D.slice(dl * 2, dl * 2 + 2); while (d2.length < 2 && D.length) d2.push(D[d2.length % D.length]);
    return [...f3, ...d2]; },
  formation(k) {
    const E = HW.E, e = E[Math.max(0, k)] || {t: 0, p: 1, tm: 0}, per = Math.min(e.p || 1, 4), puck = this.pkAt(k);
    const st = hState(k), poss = e.tm == null ? 0 : e.tm;
    const out = [];
    for (const team of [0, 1]) {
      const dir = this.dir(team, per), attacking = team === poss, code = team === 0 ? HW.d.home : HW.d.away;
      const L = this.lineFor(code, e.t);
      const own = -89 * dir, opp = 89 * dir;
      const px = puck.x, py = puck.y, inOZ = attacking ? px * dir > 25 : px * dir < -25;
      let spots;
      if (attacking) spots = inOZ ? [[px, py], [opp - 9 * dir, hc(-py * .4, -8, 8)], [px - 18 * dir, -py * .6 + (py > 0 ? -14 : 14)], [27 * dir + 3 * dir, 19], [27 * dir + 3 * dir, -19]]
        : [[px, py], [px + 14 * dir, hc(py + 20, -38, 38)], [px + 12 * dir, hc(py - 20, -38, 38)], [px - 22 * dir, 15], [px - 24 * dir, -15]];
      else spots = inOZ ? [[px - 5 * dir, py * .7], [own + 14 * dir, hc(py * .3 + 9, -12, 12)], [own + 14 * dir, hc(py * .3 - 9, -12, 12)], [own + 34 * dir, 14], [own + 36 * dir, -14]]
        : [[px - 10 * dir, py * .8], [px - 20 * dir, hc(py + 15, -36, 36)], [px - 20 * dir, hc(py - 15, -36, 36)], [hl(px, own, .45), 10], [hl(px, own, .45), -10]];
      const box = st.box[team] ? 1 : 0, empty = st.pulled[team];
      L.forEach((p, j) => { if (box && j === 2) return; const s = spots[j]; out.push({team, code, num: p.num, id: p.id, x: hc(s[0], -95, 95), y: hc(s[1], -39, 39), role: j}); });
      if (empty) { const s = spots[2]; out.push({team, code, num: (L[2] || {}).num, x: hc(s[0] + 6 * dir, -95, 95), y: hc(s[1] + 6, -39, 39), role: 9}); }
      else { const g = HW.d.goalies[code]; out.push({team, code, num: null, goalie: true, x: own + 3.5 * dir, y: hc(py * .08, -3, 3), role: 5, gname: g && g.name}); }
    }
    // the event's player handles the puck
    if (e.sc || e.sh) { const id = e.sc || e.sh, m = out.find(o => o.id === id), c = out.find(o => o.team === poss && o.role === 0);
      if (!m && c) { const pl = HW.d.players[id]; if (pl) { c.num = pl.num; c.id = id; } } }
    return out; },
  pkAt(k) { for (let j = k; j >= 0; j--) { const e = HW.E[j]; if (e && e.x != null) return this.world(e); if (e && (e.k === 'goal' || e.k === 'pend' || e.k === 'start')) return {x: 0, y: 0}; } return {x: 0, y: 0}; },
  place(k, f) { this.from = this.formation(k); this.to = this.from; this.pkFrom = this.pkAt(k); this.pkTo = this.pkFrom; this.pkPath = null; this.camX = hc(this.pkFrom.x * .9, -62, 62); },
  begin(k) {
    const e = HW.E[k], prev = this.formationNow ? this.formationNow : this.from;
    this.from = prev; this.to = this.formation(k); this.pkFrom = this.pkNow || this.pkAt(k - 1);
    const per = Math.min(e.p || 1, 4);
    if (['shot', 'goal', 'miss', 'block'].includes(e.k) && e.x != null) {
      const w = this.world(e), net = {x: 89 * this.dir(e.tm, per), y: 0};
      const tgt = e.k === 'goal' ? {x: net.x - Math.sign(net.x) * 1.0, y: (Math.random() - .5) * 4} : e.k === 'miss' ? {x: net.x + Math.sign(net.x) * 4, y: (Math.random() < .5 ? -1 : 1) * (5 + Math.random() * 5)} : e.k === 'block' ? {x: w.x + Math.sign(net.x) * 7, y: w.y * .9} : {x: net.x - Math.sign(net.x) * 2.5, y: (Math.random() - .5) * 3};
      this.pkPath = [this.pkFrom, {x: hl(this.pkFrom.x, w.x, .6), y: hl(this.pkFrom.y, w.y, .6) + 6}, w, tgt]; this.shotAt = .55; this.pkTo = tgt;
    } else if (e.k === 'fo' || e.k === 'start' || e.k === 'pend') { const fx_ = e.x != null ? this.world(e).x : 0; this.pkPath = [this.pkFrom, {x: fx_, y: 0}]; this.pkTo = {x: fx_, y: 0}; this.shotAt = 1; }
    else { const w = e.x != null ? this.world(e) : {x: this.pkFrom.x + (Math.random() - .5) * 20, y: hc(this.pkFrom.y + (Math.random() - .5) * 20, -36, 36)}; this.pkPath = [this.pkFrom, w]; this.pkTo = w; this.shotAt = 1; }
    this.ev = e; this.light = e.k === 'goal' ? {team: e.tm, t0: hNOW() + (HDUR.goal * 1000 / HW.speed) * .3} : this.light;
  },
  puckAt(f) { const P = this.pkPath; if (!P) return this.pkTo || {x: 0, y: 0};
    if (P.length === 2) { const t = hease(f); return {x: hl(P[0].x, P[1].x, t), y: hl(P[0].y, P[1].y, t)}; }
    const s = this.shotAt; if (f < s) { const t = hease(f / s); const a = P[0], b = P[1], c = P[2]; return {x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * b.x + t * t * c.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * b.y + t * t * c.y}; }
    const t = Math.min(1, (f - s) / Math.max(.12, (1 - s) * .35)); return {x: hl(P[2].x, P[3].x, t), y: hl(P[2].y, P[3].y, t), z: Math.sin(t * Math.PI) * (this.ev && this.ev.k === 'miss' ? 3 : 1.5)}; },
  draw(now, f) {
    const c = this.ctx; if (!c) return; const W_ = this.w, H_ = this.h;
    const pk = this.puckAt(f); this.pkNow = {x: pk.x, y: pk.y};
    this.camX = hl(this.camX, hc(pk.x * .9, -62, 62), 0.07);
    // arena
    const g = c.createLinearGradient(0, 0, 0, H_); g.addColorStop(0, '#05070b'); g.addColorStop(.5, '#11161f'); g.addColorStop(1, '#0a0d12'); c.fillStyle = g; c.fillRect(0, 0, W_, H_);
    const far = this.P(this.camX, 42.5, 0), farTop = this.P(this.camX, 42.5, 16);
    const ch = Math.max(30, farTop[1] + 4); c.globalAlpha = .9; for (let k = -2; k <= 2; k++) c.drawImage(this.crowd, W_ / 2 - 300 + k * 600 - (this.camX * 4 % 600), 0, 600, ch); c.globalAlpha = 1;
    const cg = c.createLinearGradient(0, 0, 0, ch); cg.addColorStop(0, 'rgba(5,7,11,.75)'); cg.addColorStop(1, 'rgba(5,7,11,0)'); c.fillStyle = cg; c.fillRect(0, 0, W_, ch);
    // light rigs
    c.fillStyle = 'rgba(255,250,235,.10)'; for (let k = 0; k < 6; k++) { const x = (k + .5) / 6 * W_; c.beginPath(); c.ellipse(x, 10, 40, 8, 0, 0, 7); c.fill(); }
    // ice
    const rink = this.rinkPath(); c.save(); c.beginPath(); rink.forEach((p, k) => k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
    const ig = c.createLinearGradient(0, far[1], 0, H_); ig.addColorStop(0, '#d9e4ec'); ig.addColorStop(1, '#f4f8fb'); c.fillStyle = ig; c.fill(); c.clip();
    this.markings(c);
    // reflections of the lights on the ice
    c.fillStyle = 'rgba(255,255,255,.16)'; for (let k = -4; k <= 4; k++) { const p = this.P(k * 22, 8); c.beginPath(); c.ellipse(p[0], p[1], 9 * p[2], 2 * p[2], 0, 0, 7); c.fill(); }
    c.restore();
    // far boards + glass + benches
    this.boards(c, 42.5, true);
    // players and puck, far to near
    const from = this.from || [], to = this.to || [], ef = hease(Math.min(1, f * 1.4));
    this.formationNow = to.map((p, j) => { const q = from.find(o => o.team === p.team && o.role === p.role) || p; return {...p, x: hl(q.x, p.x, ef), y: hl(q.y, p.y, ef)}; });
    const actors = this.formationNow.slice().sort((a, b) => b.y - a.y);
    const near = this.formationNow.reduce((m, p) => p.team === (this.ev ? this.ev.tm : 0) && !p.goalie && (m == null || Math.hypot(p.x - pk.x, p.y - pk.y) < Math.hypot(m.x - pk.x, m.y - pk.y)) ? p : m, null);
    if (near && this.ev && f < (this.shotAt || 1)) { near.x = hl(near.x, pk.x - 2 * Math.sign(this.camX || 1), .6); near.y = hl(near.y, pk.y - 1.5, .6); }
    let puckDrawn = false;
    for (const p of actors) { if (!puckDrawn && p.y < pk.y) { this.puck(c, pk); puckDrawn = true; } this.player(c, p, now); }
    if (!puckDrawn) this.puck(c, pk);
    this.nets(c);
    // goal light
    if (this.light && now >= this.light.t0 && now - this.light.t0 < 2600 / HW.speed) { const team = this.light.team, x = 89 * this.dir(team, Math.min(this.ev.p || 1, 4)); const p = this.P(x + Math.sign(x) * 6, 0, 9);
      const a = .55 + .45 * Math.sin((now - this.light.t0) / 90); const rg = c.createRadialGradient(p[0], p[1], 2, p[0], p[1], 22 * p[2]); rg.addColorStop(0, `rgba(255,40,30,${a})`); rg.addColorStop(1, 'rgba(255,40,30,0)'); c.fillStyle = rg; c.fillRect(p[0] - 200, p[1] - 200, 400, 400); }
    // near boards (low, in front)
    this.boards(c, -42.5, false);
    // vignette
    const vg = c.createRadialGradient(W_ / 2, H_ * .55, H_ * .3, W_ / 2, H_ * .55, W_ * .8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)'); c.fillStyle = vg; c.fillRect(0, 0, W_, H_);
  },
  rinkPath() { const pts = [], R = 28, X = 100, Y = 42.5;
    const arc = (cx, cy, a0, a1) => { for (let k = 0; k <= 10; k++) { const a = a0 + (a1 - a0) * k / 10; pts.push(this.P(cx + R * Math.cos(a), cy + R * Math.sin(a))); } };
    arc(X - R, Y - R, 0, Math.PI / 2); arc(-X + R, Y - R, Math.PI / 2, Math.PI); arc(-X + R, -Y + R, Math.PI, 1.5 * Math.PI); arc(X - R, -Y + R, 1.5 * Math.PI, 2 * Math.PI); return pts; },
  line(c, x0, y0, x1, y1, col, wft) { const a = this.P(x0, y0), b = this.P(x1, y1); c.strokeStyle = col; c.lineWidth = Math.max(1, wft * (a[2] + b[2]) / 2); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); },
  circle(c, cx, cy, r, col, wft, fill) { c.beginPath(); for (let k = 0; k <= 40; k++) { const a = k / 40 * 2 * Math.PI, p = this.P(cx + r * Math.cos(a), cy + r * Math.sin(a)); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }
    if (fill) { c.fillStyle = fill; c.fill(); } if (col) { c.strokeStyle = col; c.lineWidth = Math.max(1, wft * this.P(cx, cy)[2]); c.stroke(); } },
  markings(c) {
    const red = '#c8102e', blue = '#0b4ea2', H = HW.d.home;
    this.line(c, 0, -42.5, 0, 42.5, red, 1.0); [-25, 25].forEach(x => this.line(c, x, -42.5, x, 42.5, blue, 1.0)); [-89, 89].forEach(x => this.line(c, x, -36.5, x, 36.5, red, .2));
    this.circle(c, 0, 0, 15, blue, .2); this.circle(c, 0, 0, 1, null, 0, blue);
    // center ice logo: home team colour medallion
    this.circle(c, 0, 0, 10.5, null, 0, hCol(H) + 'cc'); const p = this.P(0, 0); c.fillStyle = hCol(H, 1) || '#fff'; c.font = `700 ${Math.max(8, 8 * p[2])}px Barlow Condensed, Arial Narrow, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.save(); c.translate(p[0], p[1]); c.scale(1, .42); c.fillText(H, 0, 0); c.restore();
    for (const sx of [-1, 1]) { this.circle(c, 69 * sx, 22, 15, red, .2); this.circle(c, 69 * sx, -22, 15, red, .2); [[69, 22], [69, -22], [20, 22], [20, -22]].forEach(([x, y]) => this.circle(c, x * sx, y, 1, null, 0, red));
      // crease
      c.beginPath(); for (let k = 0; k <= 20; k++) { const a = -Math.PI / 2 + k / 20 * Math.PI, q = this.P(89 * sx - sx * 6 * Math.cos(a), 6 * Math.sin(a) * 0.67 * 1.5); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.closePath(); c.fillStyle = 'rgba(40,120,220,.45)'; c.fill(); }
  },
  boards(c, y, far) {
    const xs = []; for (let x = -72; x <= 72; x += 6) xs.push(x);
    const top = xs.map(x => this.P(x, y, far ? 3.5 : 3.5)), bot = xs.map(x => this.P(x, y, 0)), glass = xs.map(x => this.P(x, y, 9));
    if (far) { c.beginPath(); glass.forEach((p, k) => k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); for (let k = top.length - 1; k >= 0; k--) c.lineTo(top[k][0], top[k][1]); c.closePath(); c.fillStyle = 'rgba(170,200,220,.10)'; c.fill(); }
    c.beginPath(); top.forEach((p, k) => k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); for (let k = bot.length - 1; k >= 0; k--) c.lineTo(bot[k][0], bot[k][1]); c.closePath(); c.fillStyle = far ? '#eef1f4' : 'rgba(238,241,244,.18)'; c.fill();
    c.beginPath(); bot.forEach((p, k) => k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.strokeStyle = '#f0c419'; c.lineWidth = 2; c.stroke();
    // dasher ads
    const ads = ['LOCKSMITH', 'NHL', 'HOCKEY NIGHT', 'LOCKSMITH', 'POWER PLAY', 'LOCKSMITH'];
    for (let k = 0; k < 6; k++) { const x = -60 + k * 24, a = this.P(x, y, 1.8); c.fillStyle = far ? 'rgba(20,40,80,.75)' : 'rgba(20,40,80,.55)'; if (!far) continue; c.font = `700 ${Math.max(6, 2.0 * a[2])}px Barlow Condensed, Arial Narrow, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ads[k], a[0], a[1]); }
    if (far) { // benches and penalty boxes
      for (const [x0, x1, col] of [[-42, -14, hCol(HW.d.away)], [14, 42, hCol(HW.d.home)], [-7, -2, '#333'], [2, 7, '#333']]) { const a = this.P(x0, y + 1, 3.6), b = this.P(x1, y + 1, 7.5); c.fillStyle = col + '55'; c.fillRect(a[0], b[1], b[0] - a[0], a[1] - b[1]); } }
  },
  nets(c) { for (const sx of [-1, 1]) { const x = 89 * sx, b = [this.P(x, -3, 0), this.P(x, 3, 0)], t = [this.P(x, -3, 4), this.P(x, 3, 4)], bk = this.P(x + sx * 3.4, 0, 1.5);
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1; c.beginPath(); c.moveTo(t[0][0], t[0][1]); c.lineTo(bk[0], bk[1]); c.lineTo(t[1][0], t[1][1]); c.moveTo(b[0][0], b[0][1]); c.lineTo(bk[0], bk[1]); c.lineTo(b[1][0], b[1][1]); c.stroke();
    c.strokeStyle = '#d0021b'; c.lineWidth = Math.max(2, 0.35 * b[0][2]); c.beginPath(); c.moveTo(b[0][0], b[0][1]); c.lineTo(t[0][0], t[0][1]); c.lineTo(t[1][0], t[1][1]); c.lineTo(b[1][0], b[1][1]); c.stroke(); } },
  puck(c, pk) { const p = this.P(pk.x, pk.y, (pk.z || 0)), s = this.P(pk.x, pk.y, 0); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(s[0], s[1], Math.max(2.5, .9 * s[2]), Math.max(1, .35 * s[2]), 0, 0, 7); c.fill();
    c.fillStyle = '#111'; c.beginPath(); c.ellipse(p[0], p[1] - 1, Math.max(2.4, .55 * p[2]), Math.max(1.4, .25 * p[2]), 0, 0, 7); c.fill(); },
  player(c, p, now) {
    const b = this.P(p.x, p.y, 0), top = this.P(p.x, p.y, 6.1), s = b[2] * 3.2, h = b[1] - top[1], w = h * .36;
    const col = p.team === 0 ? hCol(p.code) : '#f4f6f8', trim = p.team === 0 ? (hCol(p.code, 1) || '#fff') : hCol(p.code);
    c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(b[0], b[1], w * .9, w * .3, 0, 0, 7); c.fill();
    const bob = Math.sin(now / 160 + p.x) * h * .015;
    // legs + skates
    c.fillStyle = '#1b1f26'; c.fillRect(b[0] - w * .32, b[1] - h * .42 + bob, w * .26, h * .40); c.fillRect(b[0] + w * .06, b[1] - h * .42 + bob, w * .26, h * .40);
    c.fillStyle = '#ddd'; c.fillRect(b[0] - w * .4, b[1] - h * .04, w * .36, h * .04); c.fillRect(b[0] + w * .04, b[1] - h * .04, w * .36, h * .04);
    // jersey
    const jy = b[1] - h * .80 + bob; c.fillStyle = col; c.beginPath(); c.roundRect ? c.roundRect(b[0] - w * .5, jy, w, h * .42, w * .18) : c.rect(b[0] - w * .5, jy, w, h * .42); c.fill();
    c.fillStyle = trim; c.fillRect(b[0] - w * .5, jy + h * .30, w, h * .05);
    if (p.goalie) { c.fillStyle = '#e9ecef'; c.fillRect(b[0] - w * .55, b[1] - h * .46, w * 1.1, h * .44); c.strokeStyle = trim; c.lineWidth = 1; c.strokeRect(b[0] - w * .55, b[1] - h * .46, w * 1.1, h * .44); }
    // helmet
    c.fillStyle = p.goalie ? '#e5e5e5' : (p.team === 0 ? trim : hCol(p.code)); c.beginPath(); c.arc(b[0], b[1] - h * .88 + bob, w * .27, 0, 7); c.fill();
    // stick
    c.strokeStyle = '#7a5a2e'; c.lineWidth = Math.max(1, s * .25); c.beginPath(); c.moveTo(b[0] + w * .45, jy + h * .18); c.lineTo(b[0] + w * 1.15, b[1] - h * .02); c.stroke();
    if (p.num != null && h > 16) { c.fillStyle = p.team === 0 ? '#fff' : hCol(p.code); c.font = `700 ${Math.max(8, h * .2)}px Barlow Condensed, Arial Narrow, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(p.num), b[0], jy + h * .17); }
  },
};
