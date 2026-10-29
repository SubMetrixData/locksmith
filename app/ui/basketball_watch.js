// Locksmith Basketball broadcast: a simulated NBA game, possession by possession, from reports/nba/sims/<game_id>.json.
'use strict';
const BW = {gid: null, d: null, i: -1, playing: false, speed: 1, tab: 'players', cache: {}, anim: null, vnow: null, token: 0};
const bNOW = () => (BW.vnow != null ? BW.vnow : performance.now());
const bl = (a, b, t) => a + (b - a) * t, bc = (v, a, b) => Math.max(a, Math.min(b, v)), bease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const BDUR = {make: 2.6, miss: 2.2, oreb: 1.2, dreb: 1.4, tov: 1.8, ft: 2.4, to: 1.6, qend: 3.0, ot: 2.6, start: 1.8, final: 4.5};
const bName = n => { n = String(n || ''); const p = n.split(' '); return p.length < 2 ? n : p[0][0] + '. ' + p.slice(1).join(' '); };
const bLight = t => { const c = bCol(t), n = parseInt(c.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255; if ((0.299 * r + 0.587 * g + 0.114 * b) / 255 > .25) return c; const m = v => Math.round(v + (255 - v) * .45); return `rgb(${m(r)},${m(g)},${m(b)})`; };

async function bLoadSim(gid) {
  if (BW.cache[gid]) return BW.cache[gid];
  let d; try { d = (window.pywebview && window.pywebview.api && window.pywebview.api.get_nba_sim) ? await window.pywebview.api.get_nba_sim(gid) : await (await fetch(`../../reports/nba/sims/${gid}.json`, {cache: 'no-store'})).json(); }
  catch (e) { d = {error: 'No simulation for this game yet. Click Update all.'}; }
  BW.cache[gid] = d; return d;
}
function bStop() { BW.playing = false; BW.token++; const ic = $('#bPlayIc'); if (ic) ic.innerHTML = '<path d="M7 4l13 8-13 8z"/>'; }

async function bWatch() {
  const qs = new URLSearchParams(location.search);
  if (qs.get('bwatch') && !BW._qs) { BW._qs = true; BW.gid = +qs.get('bwatch'); BW.i = +(qs.get('at') ?? -1); const b = NB.books.find(x => x.game_id === BW.gid); if (b) BDATE = b.date; nbaChips(); }
  const bk = bbooks();
  if (!BW.gid || !bk.find(b => b.game_id === BW.gid)) BW.gid = (BGAME && bk.find(b => b.game_id === BGAME)) ? BGAME : bk[0] && bk[0].game_id;
  if (!BW.gid) { $('#view').innerHTML = card('Watch', '', '<p class="note">No games on this day.</p>'); return; }
  $('#view').innerHTML = `<div class="chips wgames">${bk.map(x => `<button class="chip${x.game_id === BW.gid ? ' on' : ''}" data-bwg="${x.game_id}">${x.away} @ ${x.home}</button>`).join('')}</div><div id="bbody"><div class="card empty">Loading the broadcast…</div></div>`;
  document.querySelectorAll('[data-bwg]').forEach(el => el.onclick = () => { bStop(); BW.gid = +el.dataset.bwg; BW.i = -1; bWatch(); });
  const d = await bLoadSim(BW.gid);
  if (VIEW !== 'watch' || SPORT !== 'nba') return;
  if (!d || d.error) { $('#bbody').innerHTML = card('Watch', '', `<p class="note">${esc((d && d.error) || 'Simulation not available.')}</p>`); return; }
  BW.d = d; BW.E = d.events; BW.total = Math.max(2880, ...BW.E.map(e => e.t)); bBuild();
}

function bBuild() {
  const d = BW.d, H = d.home, A = d.away, pf = d.pred_final;
  const bug = `<div class="bug hbug" style="--ca:${bCol(A)};--ch:${bCol(H)}"><div class="bugt a"><span class="bugab">${A}</span><span class="bugpts" id="bgA">0</span></div><div class="bugt h"><span class="bugab">${H}</span><span class="bugpts" id="bgH">0</span></div>
      <div class="bugm"><span id="bQ">1st</span><span id="bC" class="bugclk">12:00</span></div><div class="bugdd" id="bRun"></div></div>`;
  const ctl = `<div class="wctl"><button class="wbtn" id="bPrev"><svg viewBox="0 0 24 24"><path d="M6 5v14M19 5l-10 7 10 7z"/></svg></button><button class="wbtn big" id="bPlay"><svg viewBox="0 0 24 24" id="bPlayIc"><path d="M7 4l13 8-13 8z"/></svg></button>
      <button class="wbtn" id="bNext"><svg viewBox="0 0 24 24"><path d="M18 5v14M5 5l10 7-10 7z"/></svg></button><div class="wspeed">${[[1, '1×'], [2, '2×'], [4, '4×'], [10, '10×']].map(([x, l]) => `<button data-bsp="${x}" class="${x === BW.speed ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="wjump">${['Q1', 'Q2', 'Q3', 'Q4'].concat(BW.E.some(e => e.p >= 5) ? ['OT'] : []).map((q, k) => `<button data-bj="${k + 1}">${q}</button>`).join('')}<button data-bj="end">End</button></div></div>
    <div class="wtl" id="btl"><div class="wtlq">${[1, 2, 3].map(q => `<i style="left:${q * 720 / BW.total * 100}%"></i>`).join('')}</div><div class="wtlfill" id="btlfill"></div><div class="wtlhead" id="btlhead"></div></div>`;
  const right = `<div class="wside"><div class="card wodds"><div class="card-h"><span class="eyebrow">Live odds · updates every possession</span></div><div id="bOdds"></div></div>
      <div class="card wwp"><div class="card-h"><div><span class="eyebrow">Win probability</span><div class="wwpnow" id="bWPn"></div></div></div><div id="bWP"></div></div>
      <div class="card wpanel"><div class="tabs wtabs">${[['players', 'Players'], ['plays', 'Plays'], ['team', 'Team']].map(([k, l]) => `<button data-bwt="${k}" class="${k === BW.tab ? 'on' : ''}">${l}</button>`).join('')}</div><div id="bpane" class="wpane"></div></div></div>`;
  $('#bbody').innerHTML = `<div class="wsub"><b>Locksmith’s most likely game</b><span>Predicted final: ${esc(bTeam(A))} ${pf[1]} – ${esc(bTeam(H))} ${pf[0]} · ${esc(bTeam(d.p_home >= .5 ? H : A))} win ${pct(Math.max(d.p_home, 1 - d.p_home))} of 20,000 simulated games. This one ends on that exact score.</span></div>`
    + `<div class="wgrid"><div class="wmain"><div class="card wstage"><div class="tv" id="btv"><canvas id="bcv"></canvas>${bug}<div class="tvtools"><button id="bFull">⛶</button></div><div class="lower" id="blow"></div><div class="wbanner" id="bban"></div><div class="wintro" id="bintro"></div></div>${ctl}</div></div>${right}</div>`;
  document.querySelectorAll('[data-bwt]').forEach(el => el.onclick = () => { BW.tab = el.dataset.bwt; document.querySelectorAll('[data-bwt]').forEach(x => x.classList.toggle('on', x === el)); bPane(); });
  document.querySelectorAll('[data-bsp]').forEach(el => el.onclick = () => { BW.speed = +el.dataset.bsp; document.querySelectorAll('[data-bsp]').forEach(x => x.classList.toggle('on', x === el)); });
  document.querySelectorAll('[data-bj]').forEach(el => el.onclick = () => { const v = el.dataset.bj; const k = v === 'end' ? BW.E.length - 1 : BW.E.findIndex(e => e.p === +v) - 1; bStop(); bSeek(Math.max(-1, k)); });
  $('#bPlay').onclick = () => BW.playing ? bStop() : bPlay(); $('#bPrev').onclick = () => { bStop(); bSeek(Math.max(-1, BW.i - 1)); }; $('#bNext').onclick = () => { bStop(); bSeek(Math.min(BW.E.length - 1, BW.i + 1)); };
  $('#bFull').onclick = () => { const el = $('#btv'); if (document.fullscreenElement) { document.exitFullscreen(); return; } if (el.classList.contains('tvmax')) { el.classList.remove('tvmax'); document.body.classList.remove('tvmax-on'); BR.resize(); return; }
    const rq = el.requestFullscreen || el.webkitRequestFullscreen, mx = () => { el.classList.add('tvmax'); document.body.classList.add('tvmax-on'); setTimeout(() => BR.resize(), 30); }; if (rq) { const r = rq.call(el); if (r && r.catch) r.catch(mx); } else mx(); };
  const tl = $('#btl'); tl.onclick = e => { const r = tl.getBoundingClientRect(), t = (e.clientX - r.left) / r.width * BW.total; let k = BW.E.findIndex(x => x.t >= t); if (k < 0) k = BW.E.length - 1; bStop(); bSeek(k); };
  BR.init($('#bcv')); bWPchart(); bSeek(BW.i);
  const adv = new URLSearchParams(location.search).get('advance');
  if (adv && !BW._adv) { BW._adv = true; BW.vnow = 0; BW.speed = +(new URLSearchParams(location.search).get('speed') || 1); bPlay(); for (let t = 0; t < +adv; t += 16) { BW.vnow += 16; bTick(BW.vnow); } }
}
function bStats(k) {
  const st = {sc: [0, 0], p: {}, fgm: [0, 0], fga: [0, 0], f3m: [0, 0], reb: [0, 0], tov: [0, 0], run: null};
  const add = (id, f, v = 1) => { if (id == null) return; st.p[id] = st.p[id] || {pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fg3m: 0}; st.p[id][f] += v; };
  let lastTeam = null, run = 0;
  for (let j = 0; j <= k && j < BW.E.length; j++) { const e = BW.E[j]; if (e.s) st.sc = e.s.slice();
    if (e.k === 'make') { add(e.sh, 'pts', e.pts); add(e.ast, 'ast'); st.fgm[e.tm]++; st.fga[e.tm]++; if (e.three) { add(e.sh, 'fg3m'); st.f3m[e.tm]++; } if (e.tm === lastTeam) run += e.pts; else { lastTeam = e.tm; run = e.pts; } }
    if (e.k === 'miss') { st.fga[e.tm]++; add(e.blk, 'blk'); }
    if (e.k === 'ft' && e.pts) { add(e.sh, 'pts', e.pts); }
    if (e.k === 'oreb' || e.k === 'dreb') { add(e.rb, 'reb'); st.reb[e.tm]++; }
    if (e.k === 'tov') { add(e.stl, 'stl'); st.tov[e.tm]++; } }
  st.run = run >= 7 && lastTeam != null ? `${lastTeam === 0 ? BW.d.home : BW.d.away} ${run}-0 RUN` : '';
  return st;
}
function bSeek(k) { BW.i = k; BW.anim = null; BR.place(k); bBoard(k); }
function bPlay() { if (BW.i >= BW.E.length - 1) BW.i = -1; BW.playing = true; const tok = ++BW.token; const ic = $('#bPlayIc'); if (ic) ic.innerHTML = '<path d="M7 4h4v16H7zM14 4h4v16h-4z"/>';
  bStart(BW.i + 1); if (BW.vnow == null) { const loop = () => { if (tok !== BW.token || VIEW !== 'watch' || SPORT !== 'nba') return; bTick(bNOW()); requestAnimationFrame(loop); }; requestAnimationFrame(loop); } }
function bStart(k) { if (k >= BW.E.length) { bStop(); return; } const e = BW.E[k]; BW.anim = {k, t0: bNOW(), dur: (BDUR[e.k] || 1.4) * 1000 / BW.speed}; BR.begin(k); bBanner(e); bLower(e); }
function bTick(now) { const a = BW.anim; if (!a) { BR.draw(now, 1); return; } const f = bc((now - a.t0) / a.dur, 0, 1); BR.draw(now, f); bClock(a.k, f);
  if (f >= 1) { BW.i = a.k; bBoard(BW.i); if (BW.E[a.k].k === 'final') { bStop(); bFinal(); return; } if (BW.playing) bStart(a.k + 1); else BW.anim = null; } }
function bClock(k, f) { const e = BW.E[k], p = BW.E[k - 1], t = p && p.p === e.p ? bl(p.t, e.t, f) : e.t, q = e.p, len = q <= 4 ? 720 : 300, base = q <= 4 ? (q - 1) * 720 : 2880 + (q - 5) * 300, rem = Math.max(0, len - (t - base));
  const c = $('#bC'); if (c) c.textContent = `${Math.floor(rem / 60)}:${String(Math.floor(rem % 60)).padStart(2, '0')}`; const Q = $('#bQ'); if (Q) Q.textContent = q <= 4 ? ['1st', '2nd', '3rd', '4th'][q - 1] : 'OT';
  const pc = Math.min(t, BW.total) / BW.total * 100, a = $('#btlfill'), b = $('#btlhead'); if (a) a.style.width = pc + '%'; if (b) b.style.left = pc + '%'; }
function bBanner(e) { const el = $('#bban'); if (!el) return; const d = BW.d, team = e.tm === 0 ? d.home : e.tm === 1 ? d.away : null;
  const show = (h, col, ms) => { el.innerHTML = h; el.style.setProperty('--bc', col); el.classList.add('on'); clearTimeout(BW._bt); BW._bt = setTimeout(() => el.classList.remove('on'), ms / BW.speed); };
  if (e.k === 'make' && (e.big || e.kind === 'dunk')) show(`<div class="big"><b>${e.kind === 'dunk' ? 'SLAM' : 'BANG'}</b><span>${esc(team)} · ${esc(bName((d.players[e.sh] || {}).n))}</span></div>`, bCol(team), 2200);
  else if (e.k === 'qend' || e.k === 'ot') show(`<div class="l3"><b>${esc(e.txt.split('.')[0].toUpperCase())}</b><span>${d.away} ${e.s[1]} · ${d.home} ${e.s[0]}</span></div>`, '#1b2430', 2400); }
function bLower(e) { const el = $('#blow'); if (!el) return; if (['dreb', 'oreb', 'to'].includes(e.k) && BW.speed > 2) return; const team = e.tm === 0 ? BW.d.home : e.tm === 1 ? BW.d.away : null;
  el.innerHTML = `<span class="lbar" style="background:${team ? bCol(team) : '#888'}"></span><div class="ltxt">${esc(e.txt)}</div>`; el.classList.add('on'); }
function bBoard(k) {
  const d = BW.d, st = bStats(k); const s = (id, v) => { const el = $(id); if (el) el.textContent = v; };
  s('#bgA', st.sc[1]); s('#bgH', st.sc[0]); const r = $('#bRun'); if (r) r.textContent = st.run;
  if (k < 0) { s('#bQ', '1st'); s('#bC', '12:00'); } else bClock(k, 1);
  const e = k >= 0 ? BW.E[k] : null, w = e && e.w != null ? e.w : d.p_home, lt = e && e.lt != null ? e.lt : d.pre_total, ls = e && e.ls != null ? e.ls : -d.pre_margin, fin = e && e.k === 'final';
  const amO = p => p >= .995 || p <= .005 ? '—' : (q => q >= .5 ? '−' + Math.round(100 * q / (1 - q) / 5) * 5 : '+' + Math.round(100 * (1 - q) / q / 5) * 5)(Math.min(.995, p + .0225));
  const el = $('#bOdds'); if (el) el.innerHTML = fin ? '<p class="note">Final. Live betting closed.</p>' : `<div class="tbl"><table class="oddst"><thead><tr><th></th><th class="r">Moneyline</th><th class="r">Spread</th><th class="r">Win</th></tr></thead><tbody>
    <tr><td><b style="color:${bLight(d.away)}">${d.away}</b></td><td class="r num">${amO(1 - w)}</td><td class="r num">${spr(-ls)}</td><td class="r num">${pct(1 - w)}</td></tr><tr><td><b style="color:${bLight(d.home)}">${d.home}</b></td><td class="r num">${amO(w)}</td><td class="r num">${spr(ls)}</td><td class="r num">${pct(w)}</td></tr></tbody></table></div><div class="otot">Total <b class="num">${fx(lt, 1)}</b> <span class="muted">· o/u</span></div>`;
  const wn = $('#bWPn'); if (wn) wn.innerHTML = `<span class="wpdot" style="background:${bLight(w >= .5 ? d.home : d.away)}"></span>${esc(bTeam(w >= .5 ? d.home : d.away))} ${pct(Math.max(w, 1 - w))}`;
  bWPdot(k); bPane(k, st);
}
function bWPchart() { const W_ = 360, H_ = 130, el = $('#bWP'); if (!el) return; const xs = t => 6 + Math.min(t, BW.total) / BW.total * (W_ - 12), ys = w => 8 + (1 - w) * (H_ - 16);
  el.innerHTML = `<svg viewBox="0 0 ${W_} ${H_}" width="100%"><rect x="6" y="8" width="${W_ - 12}" height="${H_ - 16}" rx="6" fill="var(--panel2)"/><line x1="6" x2="${W_ - 6}" y1="${ys(.5)}" y2="${ys(.5)}" stroke="var(--muted)" stroke-dasharray="3 4" opacity=".6"/>
    ${[720, 1440, 2160].map(t => `<line x1="${xs(t)}" x2="${xs(t)}" y1="8" y2="${H_ - 8}" stroke="var(--rule)"/>`).join('')}<polyline id="bwpl" points="" fill="none" stroke="${bLight(BW.d.home)}" stroke-width="2.4"/><circle id="bwpd" r="4" fill="var(--accent)" cx="-10" cy="-10"/>
    <text x="10" y="20" font-size="11" fill="var(--muted)">${BW.d.home} ▲</text><text x="10" y="${H_ - 12}" font-size="11" fill="var(--muted)">${BW.d.away} ▼</text></svg>`; }
function bWPdot(k) { const W_ = 360, H_ = 130, xs = t => 6 + Math.min(t, BW.total) / BW.total * (W_ - 12), ys = w => 8 + (1 - w) * (H_ - 16); const l = $('#bwpl'), d0 = $('#bwpd'); if (!l) return;
  const sub = BW.E.slice(0, Math.max(0, k) + 1).filter(e => e.w != null); l.setAttribute('points', [`${xs(0)},${ys(BW.d.p_home)}`].concat(sub.map(e => `${xs(e.t).toFixed(1)},${ys(e.w).toFixed(1)}`)).join(' '));
  const last = sub[sub.length - 1]; if (last) { d0.setAttribute('cx', xs(last.t)); d0.setAttribute('cy', ys(last.w)); } }
function bPane(k = BW.i, st = bStats(BW.i)) {
  const el = $('#bpane'); if (!el) return; const d = BW.d;
  if (BW.tab === 'players') {
    const sec = t => { const L = (d.lines[t] || []).map(p => ({...p, s: st.p[p.id] || {pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, fg3m: 0}})).sort((a, z) => z.s.pts - a.s.pts || z.min - a.min);
      return `<div class="pteam"><div class="pth" style="--tcol:${bLight(t)}"><b>${esc(bTeam(t))}</b><span class="muted">PTS · REB · AST</span></div><table class="pstat">${L.slice(0, 11).map(p => `<tr><td><b>${esc(bName(p.n))}</b> <span class="muted">${p.pos}</span><div class="sl muted">proj ${fx((d.proj[p.id] || {}).pts, 0)} pts</div></td><td class="r num"><b>${p.s.pts}</b> · ${p.s.reb} · ${p.s.ast}${p.s.fg3m ? ` <span class="muted">${p.s.fg3m}×3</span>` : ''}</td></tr>`).join('')}</table></div>`; };
    el.innerHTML = sec(d.away) + sec(d.home);
  } else if (BW.tab === 'plays') {
    const L = BW.E.slice(0, k + 1).map((e, j) => [e, j]).filter(([e]) => ['make', 'ft', 'tov', 'qend', 'final'].includes(e.k)).reverse().slice(0, 90);
    el.innerHTML = L.map(([e, j]) => { const t = e.tm === 0 ? d.home : e.tm === 1 ? d.away : null; return `<div class="fp${e.big ? ' big' : ''}${j === k ? ' cur' : ''}" style="--tcol:${t ? bLight(t) : 'var(--muted)'}" data-bseek="${j}"><div class="fps"><b>Q${Math.min(e.p, 5) === 5 ? 'OT' : e.p} ${e.c}</b> ${t || ''}<span class="fpsc">${d.away} ${e.s[1]}–${e.s[0]} ${d.home}</span></div><div class="fpx">${esc(e.txt)}</div></div>`; }).join('') || '<p class="note">Nothing yet.</p>';
    el.querySelectorAll('[data-bseek]').forEach(x => x.onclick = () => { bStop(); bSeek(+x.dataset.bseek); });
  } else {
    el.innerHTML = table([{l: ''}, {l: d.away, r: 1}, {l: d.home, r: 1}], [['Points', st.sc[1], st.sc[0]], ['Field goals', `${st.fgm[1]}/${st.fga[1]}`, `${st.fgm[0]}/${st.fga[0]}`], ['Threes', st.f3m[1], st.f3m[0]], ['Rebounds', st.reb[1], st.reb[0]], ['Turnovers', st.tov[1], st.tov[0]]].map(r => `<tr><td>${r[0]}</td><td class="r num">${r[1]}</td><td class="r num">${r[2]}</td></tr>`));
  }
}
function bFinal() { const d = BW.d, el = $('#bintro'); if (!el) return; const s = BW.E[BW.E.length - 1].s, w = s[0] > s[1] ? d.home : d.away, st = bStats(BW.E.length - 1);
  const top = Object.entries(st.p).map(([id, x]) => ({id, ...x, n: (d.players[id] || {}).n, t: (d.players[id] || {}).team})).sort((a, z) => (z.pts + z.reb + z.ast) - (a.pts + a.reb + a.ast)).slice(0, 4);
  el.innerHTML = `<div><span class="eyebrow">Final${d.ot ? ' · OT' : ''}</span><h3>${d.away} ${s[1]} – ${d.home} ${s[0]}</h3><p>${esc(bTeam(w))} win. Locksmith’s predicted final was ${d.away} ${d.pred_final[1]} – ${d.home} ${d.pred_final[0]}${d.pred_final[0] === s[0] && d.pred_final[1] === s[1] ? ' (right on the number)' : ''}.</p>
    <div class="ftop"><span class="eyebrow">Top performers</span>${top.map(x => `<div><b>${esc(bName(x.n))}</b> <span class="muted">${x.t}</span> <span class="num">${x.pts} pts, ${x.reb} reb, ${x.ast} ast</span></div>`).join('')}</div><div class="row-flex"><button class="btn" id="bAgain">▶ Watch again</button></div></div>`;
  el.className = 'wintro on'; $('#bAgain').onclick = () => { el.className = 'wintro'; bSeek(-1); bPlay(); }; }

// ================================================================ the court renderer
const BR = {
  init(cv) { this.cv = cv; this.ctx = cv.getContext('2d'); this.camX = 0; this.crowd = this.crowd || this.makeCrowd(); this.resize(); window.removeEventListener('resize', this._rs); this._rs = () => this.resize(); window.addEventListener('resize', this._rs); this.place(BW.i); this.draw(bNOW(), 1); },
  resize() { const r = this.cv.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1); this.w = Math.max(240, r.width); this.h = Math.max(135, r.height); this.cv.width = this.w * this.dpr; this.cv.height = this.h * this.dpr; this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); if (this.from) this.draw(bNOW(), 1); },
  makeCrowd() { const c = document.createElement('canvas'); c.width = 600; c.height = 140; const x = c.getContext('2d'), R = rng(11); x.fillStyle = '#0c0f14'; x.fillRect(0, 0, 600, 140);
    for (let row = 0; row < 14; row++) for (let i = 0; i < 90; i++) { x.fillStyle = ['#c9c2b8', '#8b2a2a', '#2b4c7e', '#e5e0d8', '#3b3b3b', '#b8a06a', '#1f6f50'][Math.floor(R() * 7)]; x.globalAlpha = .5 + R() * .45; x.beginPath(); x.arc(i * 6.7 + (row % 2) * 3 + R() * 2, 8 + row * 9.5 + R() * 2, 2.2, 0, 7); x.fill(); } return c; },
  P(x, y, z = 0) { const cx = this.camX, cy = -62, cz = 30, th = 0.42, f = this.h * 1.75; const dx = x - cx, dy = y - cy, dz = z - cz; const zc = dy * Math.cos(th) - dz * Math.sin(th), yc = dy * Math.sin(th) + dz * Math.cos(th); return [this.w / 2 + f * dx / zc, this.h * .52 - f * yc / zc, f / zc]; },
  dir(team, q) { const homeRight = q <= 2; return (team === 0) === homeRight ? 1 : -1; },
  world(e, team = e.tm) { const s = this.dir(team, e.p || 1); if (e.x == null) return null; return s > 0 ? {x: 47 - e.y, y: e.x - 25} : {x: -47 + e.y, y: 25 - e.x}; },
  onCourt(team, k) { const d = BW.d, code = team === 0 ? d.home : d.away; const L = (d.lines[code] || []).slice().sort((a, z) => z.min - a.min); const e = BW.E[Math.max(0, k)] || {t: 0};
    const seg = Math.floor((e.t % 720) / 240); let five = seg === 0 ? L.slice(0, 5) : [L[0], L[1], L[2], L[5 + (seg % 3)] || L[3], L[6 + (seg % 2)] || L[4]].filter(Boolean);
    const want = [e.sh, e.ast, e.rb, e.stl, e.blk, e.pl].filter(id => id != null && (d.players[id] || {}).team === code);
    want.forEach(id => { if (!five.find(p => p.id === id)) { const p = L.find(q => q.id === id); if (p) five[4] = p; } }); return five.slice(0, 5); },
  ballAt(k) { for (let j = k; j >= 0; j--) { const e = BW.E[j]; if (!e) break; const w = this.world(e); if (w) return {...w, off: e.k === 'dreb' ? e.tm : (e.k === 'make' || e.k === 'ft' || e.k === 'tov') ? 1 - e.tm : e.tm}; if (e.k === 'start' || e.k === 'qend') return {x: 0, y: 0, off: 0}; } return {x: 0, y: 0, off: 0}; },
  formation(k) {
    const e = BW.E[Math.max(0, k)] || {p: 1, tm: 0}, q = e.p || 1, ball = this.ballAt(k), off = ball.off == null ? 0 : ball.off, out = [];
    const spots = [[0, 0], [3, -22], [3, 22], [14, -17], [14, 17]];          // (distance from baseline, across): handler, corners, wings
    for (const team of [0, 1]) { const s = this.dir(team, q), code = team === 0 ? BW.d.home : BW.d.away, five = this.onCourt(team, k);
      five.forEach((p, j) => { let x, y;
        if (team === off) { if (j === 0) { x = ball.x; y = ball.y; } else { x = s * (47 - spots[j][0]); y = spots[j][1]; } }
        else { const oS = this.dir(off, q); const mx = j === 0 ? ball.x : oS * (47 - spots[j][0]), my = j === 0 ? ball.y : spots[j][1]; const bx = oS * 41.75; x = bl(mx, bx, .3); y = bl(my, 0, .3); }
        out.push({team, code, id: p.id, num: (BW.d.players[p.id] || {}).num, x: bc(x, -46, 46), y: bc(y, -24, 24), role: j}); }); }
    return out; },
  place(k) { this.from = this.formation(k); this.to = this.from; const b = this.ballAt(k); this.bFrom = {x: b.x, y: b.y, z: 4}; this.bPath = null; this.camX = bc(b.x * .7, -26, 26); },
  begin(k) { const e = BW.E[k]; this.from = this.now || this.from; this.to = this.formation(k); this.bFrom = this.bNow || this.bFrom; this.ev = e; const q = e.p || 1;
    const w = this.world(e);
    if ((e.k === 'make' || e.k === 'miss') && w) { const s = this.dir(e.tm, q), rim = {x: s * 41.75, y: 0, z: 10}; this.bPath = {pts: [this.bFrom, {x: w.x, y: w.y, z: 4}], shot: rim, make: e.k === 'make', at: .45}; }
    else if (e.k === 'ft') { const s = this.dir(e.tm, q); this.bPath = {pts: [this.bFrom, {x: s * 28, y: 0, z: 4}], shot: {x: s * 41.75, y: 0, z: 10}, make: true, at: .35}; }
    else { const b = this.ballAt(k); this.bPath = {pts: [this.bFrom, {x: b.x, y: b.y, z: 4}]}; } },
  ballPos(f) { const P = this.bPath; if (!P) return this.bFrom;
    if (!P.shot) { const t = bease(f); return {x: bl(P.pts[0].x, P.pts[1].x, t), y: bl(P.pts[0].y, P.pts[1].y, t), z: 3 + Math.abs(Math.sin(f * Math.PI * 6)) * 1.2}; }
    if (f < P.at) { const t = bease(f / P.at); return {x: bl(P.pts[0].x, P.pts[1].x, t), y: bl(P.pts[0].y, P.pts[1].y, t), z: 3 + Math.abs(Math.sin(t * Math.PI * 4)) * 1.2}; }
    const t = Math.min(1, (f - P.at) / ((1 - P.at) * .6)), a = P.pts[1], r = P.shot;
    const x = bl(a.x, r.x, t), y = bl(a.y, r.y, t), z = bl(7, r.z, t) + Math.sin(t * Math.PI) * (6 + Math.hypot(a.x - r.x, a.y - r.y) * .25);
    if (t >= 1) { const after = (f - P.at - (1 - P.at) * .6) / ((1 - P.at) * .4); return P.make ? {x: r.x, y: r.y, z: Math.max(0.8, r.z - after * 9)} : {x: r.x - Math.sign(r.x) * after * 6, y: r.y + after * 5, z: Math.max(1, 10 + Math.sin(after * Math.PI) * 4 - after * 8)}; }
    return {x, y, z}; },
  draw(now, f) {
    const c = this.ctx; if (!c) return; const W_ = this.w, H_ = this.h, b = this.ballPos(f); this.bNow = {x: b.x, y: b.y, z: b.z || 4};
    this.camX = bl(this.camX, bc(b.x * .7, -26, 26), .07);
    c.fillStyle = '#07090d'; c.fillRect(0, 0, W_, H_);
    const top = this.P(this.camX, 25, 12); const ch = Math.max(30, top[1] + 6); for (let k = -2; k <= 2; k++) c.drawImage(this.crowd, W_ / 2 - 300 + k * 600 - (this.camX * 5 % 600), 0, 600, ch);
    // floor
    const corners = [[-50, -28], [50, -28], [50, 28], [-50, 28]].map(([x, y]) => this.P(x, y)); c.beginPath(); corners.forEach((p, k) => k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fillStyle = '#5b3f22'; c.fill();
    const court = [[-47, -25], [47, -25], [47, 25], [-47, 25]].map(([x, y]) => this.P(x, y)); c.save(); c.beginPath(); court.forEach((p, k) => k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath();
    const g = c.createLinearGradient(0, court[2][1], 0, court[0][1]); g.addColorStop(0, '#c99a5f'); g.addColorStop(1, '#e3b77c'); c.fillStyle = g; c.fill(); c.clip();
    c.strokeStyle = 'rgba(120,80,40,.18)'; c.lineWidth = 1; for (let y = -25; y <= 25; y += 2.5) { const a = this.P(-47, y), z = this.P(47, y); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(z[0], z[1]); c.stroke(); }
    this.lines(c); c.restore();
    // players, ball, baskets
    const ef = bease(Math.min(1, f * 1.5)); this.now = (this.to || []).map(p => { const q = (this.from || []).find(o => o.team === p.team && o.role === p.role) || p; return {...p, x: bl(q.x, p.x, ef), y: bl(q.y, p.y, ef)}; });
    const actors = this.now.slice().sort((a, z) => z.y - a.y); let drawn = false;
    for (const p of actors) { if (!drawn && p.y < b.y) { this.ball(c, b); drawn = true; } this.player(c, p, now); }
    if (!drawn) this.ball(c, b);
    this.basket(c, 1); this.basket(c, -1);
    const vg = c.createRadialGradient(W_ / 2, H_ * .55, H_ * .3, W_ / 2, H_ * .55, W_ * .8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)'); c.fillStyle = vg; c.fillRect(0, 0, W_, H_);
  },
  path(c, pts) { c.beginPath(); pts.forEach((p, k) => { const q = this.P(p[0], p[1]); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); },
  lines(c) {
    const H = BW.d.home, s = p => p[2]; c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = Math.max(1.2, this.P(0, 0)[2] * .17);
    this.path(c, [[-47, -25], [47, -25], [47, 25], [-47, 25], [-47, -25]]); c.stroke(); this.path(c, [[0, -25], [0, 25]]); c.stroke();
    const circ = (cx, cy, r, a0 = 0, a1 = 2 * Math.PI, fill) => { const pts = []; for (let k = 0; k <= 36; k++) { const a = a0 + (a1 - a0) * k / 36; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } this.path(c, pts); if (fill) { c.fillStyle = fill; c.fill(); } c.stroke(); };
    circ(0, 0, 6, 0, 2 * Math.PI, bCol(H) + 'cc'); const p0 = this.P(0, 0); c.fillStyle = bCol(H, 1); c.font = `700 ${Math.max(8, 4.2 * p0[2])}px Barlow Condensed, Arial Narrow, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.save(); c.translate(p0[0], p0[1]); c.scale(1, .42); c.fillText(H, 0, 0); c.restore();
    for (const sx of [-1, 1]) { const bx = sx * 47;
      this.path(c, [[bx, -8], [bx - sx * 19, -8], [bx - sx * 19, 8], [bx, 8]]); c.fillStyle = bCol(H) + '99'; c.fill(); c.stroke();
      circ(bx - sx * 19, 0, 6, -Math.PI / 2, Math.PI / 2 * (sx > 0 ? 3 : 1) * (sx > 0 ? 1 : 1)); circ(sx * 41.75, 0, 4, sx > 0 ? Math.PI / 2 : -Math.PI / 2, sx > 0 ? 1.5 * Math.PI : Math.PI / 2);
      this.path(c, [[bx, -22], [bx - sx * 14, -22]]); c.stroke(); this.path(c, [[bx, 22], [bx - sx * 14, 22]]); c.stroke();
      const a = Math.asin(22 / 23.75); circ(sx * 41.75, 0, 23.75, sx > 0 ? Math.PI - a : -a, sx > 0 ? Math.PI + a : a); }
  },
  basket(c, sx) { const bx = sx * 47, st = this.P(bx + sx * 2, 0, 0), bb1 = this.P(bx - sx * 4, -3, 13.5), bb2 = this.P(bx - sx * 4, 3, 13.5), bb3 = this.P(bx - sx * 4, 3, 10), bb4 = this.P(bx - sx * 4, -3, 10), rim = this.P(sx * 41.75, 0, 10);
    c.strokeStyle = '#2c2c2c'; c.lineWidth = Math.max(2, st[2] * .5); c.beginPath(); c.moveTo(st[0], st[1]); c.lineTo(bb4[0], (bb1[1] + bb4[1]) / 2); c.stroke();
    c.fillStyle = 'rgba(235,240,245,.75)'; c.beginPath(); [bb1, bb2, bb3, bb4].forEach((p, k) => k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); c.fill(); c.strokeStyle = '#d33'; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = '#ff6a13'; c.lineWidth = Math.max(1.5, rim[2] * .25); c.beginPath(); c.ellipse(rim[0], rim[1], Math.max(4, .75 * rim[2]), Math.max(1.5, .25 * rim[2]), 0, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(rim[0] + k * .3 * rim[2], rim[1]); c.lineTo(rim[0] + k * .18 * rim[2], rim[1] + 1.4 * rim[2]); c.stroke(); } },
  ball(c, b) { const p = this.P(b.x, b.y, b.z || 4), s = this.P(b.x, b.y, 0); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(s[0], s[1], Math.max(2.5, .6 * s[2]), Math.max(1, .25 * s[2]), 0, 0, 7); c.fill();
    c.fillStyle = '#e06b1f'; c.beginPath(); c.arc(p[0], p[1], Math.max(3, .45 * p[2]), 0, 7); c.fill(); c.strokeStyle = '#3a1a05'; c.lineWidth = 1; c.stroke(); },
  player(c, p, now) { const b = this.P(p.x, p.y, 0), top = this.P(p.x, p.y, 6.6), h = b[1] - top[1], w = h * .33;
    const col = p.team === 0 ? '#f5f6f7' : bCol(p.code), trim = p.team === 0 ? bCol(p.code) : (bCol(p.code, 1) || '#fff');
    c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(b[0], b[1], w * .9, w * .28, 0, 0, 7); c.fill();
    const bob = Math.sin(now / 140 + p.x) * h * .02; c.fillStyle = '#6b4a35'; c.fillRect(b[0] - w * .3, b[1] - h * .42 + bob, w * .22, h * .40); c.fillRect(b[0] + w * .08, b[1] - h * .42 + bob, w * .22, h * .40);
    c.fillStyle = trim; c.fillRect(b[0] - w * .42, b[1] - h * .5 + bob, w * .84, h * .16);
    c.fillStyle = col; c.beginPath(); c.roundRect ? c.roundRect(b[0] - w * .45, b[1] - h * .84 + bob, w * .9, h * .36, w * .15) : c.rect(b[0] - w * .45, b[1] - h * .84 + bob, w * .9, h * .36); c.fill(); c.strokeStyle = trim; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#6b4a35'; c.beginPath(); c.arc(b[0], b[1] - h * .92 + bob, w * .24, 0, 7); c.fill();
    if (p.num != null && h > 16) { c.fillStyle = trim; c.font = `700 ${Math.max(8, h * .17)}px Barlow Condensed, Arial Narrow, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(p.num), b[0], b[1] - h * .66 + bob); } },
};
