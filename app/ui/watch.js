// Locksmith game theater v2: a simulated NFL game presented like a live broadcast.
// Every snap comes from reports/sims/<game_id>.json (python -m locksmith.playsim). The renderer is a canvas with a
// perspective sideline camera that follows the ball, 22 players with real jersey numbers, and broadcast graphics.
'use strict';

const TEAMC = {
  ARI: ['#97233F', '#FFB612', '#FFFFFF'], ATL: ['#A71930', '#111111', '#FFFFFF'], BAL: ['#241773', '#9E7C0C', '#111111'], BUF: ['#00338D', '#C60C30', '#FFFFFF'],
  CAR: ['#0085CA', '#101820', '#BFC0BF'], CHI: ['#0B162A', '#C83803', '#0B162A'], CIN: ['#FB4F14', '#111111', '#111111'], CLE: ['#311D00', '#FF3C00', '#FF3C00'],
  DAL: ['#003594', '#869397', '#869397'], DEN: ['#FB4F14', '#002244', '#002244'], DET: ['#0076B6', '#B0B7BC', '#B0B7BC'], GB: ['#203731', '#FFB612', '#FFB612'],
  HOU: ['#03202F', '#A71930', '#03202F'], IND: ['#002C5F', '#A2AAAD', '#FFFFFF'], JAX: ['#006778', '#D7A22A', '#111111'], KC: ['#E31837', '#FFB81C', '#E31837'],
  LV: ['#111111', '#A5ACAF', '#A5ACAF'], LAC: ['#0080C6', '#FFC20E', '#FFFFFF'], LA: ['#003594', '#FFA300', '#FFFFFF'], MIA: ['#008E97', '#FC4C02', '#FFFFFF'],
  MIN: ['#4F2683', '#FFC62F', '#4F2683'], NE: ['#002244', '#C60C30', '#B0B7BC'], NO: ['#101820', '#D3BC8D', '#D3BC8D'], NYG: ['#0B2265', '#A71930', '#0B2265'],
  NYJ: ['#125740', '#FFFFFF', '#FFFFFF'], PHI: ['#004C54', '#A5ACAF', '#A5ACAF'], PIT: ['#101820', '#FFB612', '#FFB612'], SF: ['#AA0000', '#B3995D', '#B3995D'],
  SEA: ['#002244', '#69BE28', '#A5ACAF'], TB: ['#D50A0A', '#34302B', '#B1BABF'], TEN: ['#0C2340', '#4B92DB', '#FFFFFF'], WAS: ['#5A1414', '#FFB612', '#FFB612']};
const tc = (t, k = 0) => (TEAMC[t] || ['#334455', '#8899aa', '#ffffff'])[k];
const NOW = () => (W.vnow != null ? W.vnow : performance.now());
const W = {gid: null, data: null, si: 0, i: -1, playing: false, speed: 1, tab: 'players', cache: {}, cam: 'tv', sound: false, token: 0, anim: null};
const QNAME = q => q <= 4 ? ['1st', '2nd', '3rd', '4th'][q - 1] : 'OT';
const ORD = d => ['1st', '2nd', '3rd', '4th'][d - 1] || '';
const tsec = p => p.q <= 4 ? (p.q - 1) * 900 + (900 - p.c) : 3600 + (600 - p.c);
const clockTxt = c => { c = Math.max(0, Math.round(c)); return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}`; };
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const FW = 160 / 3, CYW = FW / 2, HASH = [23.58, FW - 23.58];
const losX = (yl, r) => r ? 110 - yl : 10 + yl;
const SCRIMK = ['run', 'pass', 'inc', 'sack', 'int', 'fum', 'td', 'pen', 'kneel', 'punt', 'fg', 'fgx', 'saf'];
function rng(seed) { let a = (seed * 2654435761) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shortName(n) { if (!n) return '?'; if (/^[A-Z][a-zA-Z']*\.[A-Z]/.test(n)) return n; const s = n.replace(/ (Jr\.|Sr\.|III|II|IV)$/, '').split(' '); return s.length > 1 ? `${s[0][0]}.${s[s.length - 1]}` : n; }

async function loadSim(gid) {
  if (W.cache[gid]) return W.cache[gid];
  let d;
  try { d = (window.pywebview && window.pywebview.api && window.pywebview.api.get_sim) ? await window.pywebview.api.get_sim(gid) : await (await fetch(`../../reports/sims/${gid}.json`, {cache: 'no-store'})).json(); }
  catch (e) { d = {error: 'No play-by-play simulation for this game yet. Click Update all.'}; }
  W.cache[gid] = d;
  return d;
}

// ================================================================ view
async function watch() {
  const qs = new URLSearchParams(location.search);
  if (qs.get('watch') && !W._qs) { W._qs = true; W.gid = qs.get('watch'); W.si = +(qs.get('sim') || 0); W.i = +(qs.get('at') ?? -1); if (qs.get('cam')) W.cam = qs.get('cam'); if (qs.get('frac')) W.freeze = +qs.get('frac'); const bb = D.books.find(x => x.game_id === W.gid); if (bb) WEEK = bb.week; }
  const bk = books();
  if (!W.gid || !bk.find(b => b.game_id === W.gid)) W.gid = (GAME && bk.find(b => b.game_id === GAME)) ? GAME : bk[0]?.game_id;
  if (!W.gid) { $('#view').innerHTML = card('Watch', '', '<p class="note">No games this week.</p>'); return; }
  const chips = `<div class="chips wgames">${bk.map(x => `<button class="chip${x.game_id === W.gid ? ' on' : ''}" data-wg="${x.game_id}">${x.away} @ ${x.home}</button>`).join('')}</div>`;
  $('#view').innerHTML = chips + `<div id="wbody"><div class="card empty">Loading the broadcast…</div></div>`;
  document.querySelectorAll('[data-wg]').forEach(el => el.onclick = () => { stopPlay(); W.gid = el.dataset.wg; W.si = 0; W.i = -1; watch(); });
  const d = await loadSim(W.gid);
  if (VIEW !== 'watch') return;
  if (!d || d.error) { $('#wbody').innerHTML = card('Watch', '', `<p class="note">${esc(d && d.error || 'Simulation not available.')}</p>`); return; }
  W.data = d;
  buildStage();
}

function buildStage() {
  const d = W.data, S = d.sims[W.si], H = d.home, A = d.away;
  W.P = S.plays; W.total = Math.max(3600, ...W.P.map(tsec));
  W.roster = buildRoster(d);
  const sims = `<div class="wsub"><b>Locksmith’s most likely game</b><span>Predicted final: ${esc(nmTeam(A))} ${PFW(d)[1]} – ${esc(nmTeam(H))} ${PFW(d)[0]} · ${esc(nmTeam(d.dist.p_home_win >= .5 ? H : A))} win ${pct(Math.max(d.dist.p_home_win, 1 - d.dist.p_home_win))} of ${d.dist.n} simulated games. This simulated game ends on that exact score.</span></div>`;
  const bug = `<div class="bug" style="--ca:${tc(A)};--ch:${tc(H)}">
      <div class="bugt a"><span class="bugab">${A}</span><span class="bugto" id="toA"></span><span class="bugpts" id="sbA">0</span><span class="bugpos" id="pbA"></span></div>
      <div class="bugt h"><span class="bugab">${H}</span><span class="bugto" id="toH"></span><span class="bugpts" id="sbH">0</span><span class="bugpos" id="pbH"></span></div>
      <div class="bugm"><span id="sbQ">1st</span><span id="sbC" class="bugclk">15:00</span></div>
      <div class="bugdd" id="sbDD">KICKOFF</div><div class="bugpc" id="sbPC"></div></div>`;
  const ctl = `<div class="wctl">
      <button class="wbtn" id="wPrev" title="Previous play (←)"><svg viewBox="0 0 24 24"><path d="M6 5v14M19 5l-10 7 10 7z"/></svg></button>
      <button class="wbtn big" id="wPlay" title="Play / pause (space)"><svg viewBox="0 0 24 24" id="wPlayIc"><path d="M7 4l13 8-13 8z"/></svg></button>
      <button class="wbtn" id="wNext" title="Next play (→)"><svg viewBox="0 0 24 24"><path d="M18 5v14M5 5l10 7-10 7z"/></svg></button>
      <div class="wspeed">${[[0.5, '½×'], [1, '1×'], [2, '2×'], [4, '4×'], [10, '10×']].map(([x, l]) => `<button data-sp="${x}" class="${x === W.speed ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="wjump">${['Q1', 'Q2', 'Q3', 'Q4'].concat(W.P.some(p => p.q === 5) ? ['OT'] : []).map((q, k) => `<button data-jq="${k + 1}">${q}</button>`).join('')}<button data-jq="end">End</button></div></div>
    <div class="wtl" id="wtl"><div class="wtlq">${[1, 2, 3].map(q => `<i style="left:${q * 900 / W.total * 100}%"></i>`).join('')}${W.total > 3600 ? `<i style="left:${3600 / W.total * 100}%"></i>` : ''}</div>
      <div class="wtlfill" id="wtlfill"></div><div class="wtlm" id="wtlm"></div><div class="wtlhead" id="wtlhead"></div></div>`;
  const right = `<div class="wside"><div class="card wodds"><div class="card-h"><div><span class="eyebrow">Live odds · updates every play</span></div><span class="muted" id="oddsClock"></span></div><div id="oddsBoard"></div></div><div class="card wwp"><div class="card-h"><div><span class="eyebrow">Win probability</span><div class="wwpnow" id="wpNow"></div></div></div><div id="wpChart"></div></div>
      <div class="card wpanel"><div class="tabs wtabs">${[['players', 'Players'], ['plays', 'Plays'], ['stats', 'Team'], ['drives', 'Drives']].map(([k, l]) => `<button data-wt="${k}" class="${k === W.tab ? 'on' : ''}">${l}</button>`).join('')}</div><div id="wpane" class="wpane"></div></div></div>`;
  $('#wbody').innerHTML = sims + `<div class="wgrid"><div class="wmain"><div class="card wstage">
      <div class="tv" id="tv"><canvas id="tvc"></canvas>${bug}
        <div class="tvtools"><button id="wCam" title="Camera">${W.cam === 'tv' ? 'Sideline cam' : 'All-22'}</button><button id="wSnd" title="Crowd sound">${W.sound ? '🔊' : '🔇'}</button><button id="wFull" title="Full screen">⛶</button></div>
        <div class="lower" id="lower"></div><div class="ticker" id="ticker"></div><div class="wbanner" id="wbanner"></div><div class="wintro" id="wintro"></div></div>
      ${ctl}</div></div>${right}</div>`;
  document.querySelectorAll('[data-ws]').forEach(el => el.onclick = () => { stopPlay(); W.si = +el.dataset.ws; W.i = -1; buildStage(); });
  document.querySelectorAll('[data-wt]').forEach(el => el.onclick = () => { W.tab = el.dataset.wt; document.querySelectorAll('[data-wt]').forEach(x => x.classList.toggle('on', x === el)); drawPane(); });
  document.querySelectorAll('[data-sp]').forEach(el => el.onclick = () => { W.speed = +el.dataset.sp; document.querySelectorAll('[data-sp]').forEach(x => x.classList.toggle('on', x === el)); });
  document.querySelectorAll('[data-jq]').forEach(el => el.onclick = () => { const v = el.dataset.jq; const idx = v === 'end' ? W.P.length - 1 : W.P.findIndex(p => p.q === +v); if (idx >= 0) { stopPlay(); seek(v === 'end' ? idx : Math.max(-1, idx - 1)); } });
  $('#wPlay').onclick = togglePlay; $('#wPrev').onclick = () => { stopPlay(); seek(Math.max(-1, W.i - 1)); }; $('#wNext').onclick = () => { stopPlay(); stepOnce(); };
  $('#wCam').onclick = () => { W.cam = W.cam === 'tv' ? 'all22' : 'tv'; $('#wCam').textContent = W.cam === 'tv' ? 'Sideline cam' : 'All-22'; };
  $('#wSnd').onclick = () => { W.sound = !W.sound; $('#wSnd').textContent = W.sound ? '🔊' : '🔇'; SND.toggle(W.sound); };
  // real fullscreen where the browser allows it; iPhone Safari doesn't, so fill the screen with the picture instead
  const maxi = on => { const el = $('#tv'); if (!el) return; el.classList.toggle('tvmax', on); document.body.classList.toggle('tvmax-on', on); setTimeout(() => window.dispatchEvent(new Event('resize')), 30); };
  $('#wFull').onclick = () => { const el = $('#tv');
    if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (el.classList.contains('tvmax')) { maxi(false); return; }
    const rq = el.requestFullscreen || el.webkitRequestFullscreen;
    if (rq) { const r = rq.call(el); if (r && r.catch) r.catch(() => maxi(true)); } else maxi(true); };
  const tl = $('#wtl'); tl.onclick = e => { const r = tl.getBoundingClientRect(); const t = (e.clientX - r.left) / r.width * W.total; let k = W.P.findIndex(p => tsec(p) >= t); if (k < 0) k = W.P.length - 1; stopPlay(); seek(k); };
  wpChart();
  TV.init($('#tvc'));
  seek(W.i);
  const adv = new URLSearchParams(location.search).get('advance');
  if (adv && !W._adv) { W._adv = true; W.vnow = 0; TV.lastNow = 0; W.speed = +(new URLSearchParams(location.search).get('speed') || 1); startPlay();
    W._errs = []; for (let t = 0; t < +adv; t += 16) { W.vnow += 16; try { TV.frame(W.vnow); } catch (e) { if (W._errs.length < 5) W._errs.push(String(e && e.stack || e).slice(0, 200)); } }
    if (new URLSearchParams(location.search).get('dbg')) { const st = stepAnim(W.vnow); caption(`DBG i=${W.i}/${W.P.length} errs=${W._errs.length} ${W._errs.join(' || ')} camX=${TV.camX} camY=${TV.camY} camZ=${TV.camZ} zoom=${TV.zoom} w=${TV.w} h=${TV.h} fade=${st.fade} phase=${W.anim && W.anim.phase} actors=${(st.actors||[]).length} a0=${st.actors && st.actors[0] && st.actors[0].x}`, null, false); } return; }
  if (new URLSearchParams(location.search).get('autoplay') && !W._ap) { W._ap = true; W.speed = +(new URLSearchParams(location.search).get('speed') || 1); setTimeout(() => startPlay(), 50); }
  if (W.freeze != null) { startAnim(W.i + 1, false); if (W.anim) { W.anim.phase = 'live'; W.anim.t0 = NOW(); TV.camX = W.anim.ch.focus(W.freeze); const b0 = W.anim.ch.ball(W.freeze); TV.camY = clamp(b0[1], 10, 44); TV.camZ = Math.min(10, Math.max(0, b0[2] - 2) * .62); TV.zoom = W.anim.ch.zoom || 1; } }
}

// ================================================================ roster & names
function buildRoster(d) {
  const R = {};
  for (const t of [d.home, d.away]) {
    const L = (d.lineups || {})[t] || {};
    const off = (L.off || []).map(x => ({...x})), def = (L.def || []).map(x => ({...x}));
    const fill = (arr, slots) => { slots.forEach((s, k) => { if (!arr[k]) arr[k] = {slot: s, name: s, short: s, num: null}; }); return arr; };
    const want = ['QB', 'LT', 'LG', 'C', 'RG', 'RT', 'RB', 'WR', 'WR', 'WR', 'TE'];
    const o = {}; want.forEach(s => o[s] = o[s] || []);
    off.forEach(p => { (o[p.slot] = o[p.slot] || []).push(p); });
    const offOrd = [o.QB?.[0], o.LT?.[0], o.LG?.[0], o.C?.[0], o.RG?.[0], o.RT?.[0], o.RB?.[0], o.WR?.[0], o.WR?.[1], o.WR?.[2], o.TE?.[0]];
    const offF = fill(offOrd.map(x => x || null), want);
    const dd = {DL: [], LB: [], CB: [], S: []}; def.forEach(p => (dd[p.slot] = dd[p.slot] || []).push(p));
    const defF = [];
    const needs = [['DL', 4], ['LB', 3], ['CB', 2], ['S', 2]];
    let pool = [...dd.DL, ...dd.LB, ...dd.CB, ...dd.S];
    for (const [s, n] of needs) for (let k = 0; k < n; k++) { const p = (dd[s] || []).shift() || pool.find(q => !defF.includes(q)) || {slot: s, name: s, short: s, num: null}; if (!defF.includes(p)) defF.push({...p, slot: s}); }
    R[t] = {off: offF, def: defF.slice(0, 11), skill: (L.skill || []), k: L.k, p: L.p, kr: L.kr, pr: L.pr};
  }
  return R;
}
const numFor = (team, name) => { const R = W.roster[team]; if (!R || !name) return null; const s = shortName(name);
  const all = [...R.off, ...R.def, ...(R.skill || []), R.k, R.p, R.kr, R.pr].filter(Boolean); const m = all.find(x => x.short === s || x.name === name); return m ? m.num : null; };

// ================================================================ renderer
const TV = {
  cv: null, ctx: null, w: 0, h: 0, dpr: 1, camX: 60, camY: CYW, camZ: 0, zoom: 1, raf: null, crowd: null, actors: [], ball: null, marks: null, flag: null, tag: null, ezTeams: null,
  init(cv) {
    this.cv = cv; this.ctx = cv.getContext('2d');
    this.resize(); window.removeEventListener('resize', this._rs); this._rs = () => this.resize(); window.addEventListener('resize', this._rs);
    if (!this.crowd) this.crowd = makeCrowd();
    if (!this.grain) this.grain = makeGrain();
    this.tex = null; this.bench = null; this.refs = null;
    cancelAnimationFrame(this.raf); const loop = () => { this.frame(NOW()); this.raf = requestAnimationFrame(loop); }; this.raf = requestAnimationFrame(loop);   // one clock for everything
  },
  resize() { const r = this.cv.getBoundingClientRect(); this.dpr = Math.min(2, window.devicePixelRatio || 1); this.w = Math.max(240, r.width); this.h = Math.max(135, r.height);
    this.cv.width = Math.round(this.w * this.dpr); this.cv.height = Math.round(this.h * this.dpr); },
  camera() {
    const tx = this.camX, z = this.zoom;
    let C, T, f;
    const dy = (this.camY - CYW) * .85, hz = this.camZ;
    if (W.cam === 'tv') { C = [tx, -30 - 14 * (1 / z - 1) + dy, 21 + 9 * (1 / z - 1) + hz * .5]; T = [tx, 25 + dy, hz]; f = this.w * 1.62 * z; }
    else { C = [tx, -14, 74]; T = [tx, 25, 0]; f = this.w * 0.82 * z; }
    const fw = norm(sub(T, C)), rt = norm(cross(fw, [0, 0, 1])), up = cross(rt, fw);
    return {C, fw, rt, up, f};
  },
  P(x, y, z = 0) {
    const c = this.cam, v = [x - c.C[0], y - c.C[1], z - c.C[2]];
    const zc = dot(v, c.fw); if (zc < 0.5) return null;
    return {x: this.w / 2 + c.f * dot(v, c.rt) / zc, y: this.h * 0.52 - c.f * dot(v, c.up) / zc, s: c.f / zc};
  },
  frame(now) {
    if (!this.cv || !document.body.contains(this.cv)) { cancelAnimationFrame(this.raf); return; }
    const dt = this.lastNow ? Math.min(.1, (now - this.lastNow) / 1000) : .016; this.lastNow = now;
    const st = stepAnim(now);
    const k = r => 1 - Math.exp(-dt * r);
    this.camX += (clamp(st.focusX ?? 60, 18, 102) - this.camX) * k(3.2);
    this.zoom += ((st.zoom ?? 1) - this.zoom) * k(2.2);
    const bz = st.ball ? st.ball[2] : 0, by = st.ball ? st.ball[1] : CYW;
    if (W.freeze == null) { this.camY += (clamp(st.live ? by : CYW, 10, 44) - this.camY) * k(2.6); this.camZ += (Math.min(10, Math.max(0, bz - 2) * .62) - this.camZ) * k(3.5); }
    this.cam = this.camera();
    const c = this.ctx; c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawWorld(c, this, st);
    if (st.fade > 0) { c.fillStyle = `rgba(6,10,14,${st.fade})`; c.fillRect(0, 0, this.w, this.h); }
    if (this.parts && this.parts.length) { this.parts = this.parts.filter(q => (q.life -= dt) > 0);
      for (const q of this.parts) { q.vy += 260 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.r += q.vr * dt; c.save(); c.translate(q.x, q.y); c.rotate(q.r); c.globalAlpha = Math.min(1, q.life * 1.5); c.fillStyle = q.col; c.fillRect(-4, -2, 8, 4); c.restore(); } }
  }
};
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

function lightMode() {
  const v = (W.data && W.data.venue) || {}, roof = String(v.roof || '');
  if (/dome|closed/.test(roof)) return 'dome';
  const hr = +((String(v.kick || '').match(/ (\d{1,2}):\d\d/) || [])[1] || 13);
  return hr >= 19 ? 'night' : (hr >= 16 ? 'dusk' : 'day');
}
function crowdTex(seed, dot, homeCol, awayCol) {
  // a stadium bowl of fans (mostly home colors), row seams and aisles
  const c = document.createElement('canvas'); c.width = 1600; c.height = 300; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, '#11161c'); g.addColorStop(1, '#232a33'); x.fillStyle = g; x.fillRect(0, 0, 1600, 300);
  const r = rng(seed), cols = [homeCol, homeCol, homeCol, '#e9edf1', '#c9ced6', '#2f343b', awayCol, '#8d949e', '#f2d16b'];
  for (let i = 0; i < 26000 / dot; i++) { const yy = r() * 300, sz = dot * (0.7 + yy / 300 * .7); x.fillStyle = cols[Math.floor(r() * cols.length)]; x.globalAlpha = .35 + r() * .55;
    x.fillRect(r() * 1600, yy, sz, sz * 1.25); }
  x.globalAlpha = 1;
  for (let k = 0; k < 14; k++) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, k * 22 + 10, 1600, 2); }
  for (let a = 0; a < 1600; a += 200) { x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(a + 90, 0, 7, 300); }
  return c;
}
function drawStadium(c, V, st) {
  const w = V.w, h = V.h, d = W.data, mode = lightMode();
  // sky
  const sky = c.createLinearGradient(0, 0, 0, h * .6);
  const S = {day: ['#5b9bd5', '#a9cdea'], dusk: ['#2c2350', '#e08a5a'], night: ['#05070d', '#152033'], dome: ['#0b0e13', '#1a1f27']}[mode];
  sky.addColorStop(0, S[0]); sky.addColorStop(1, S[1]); c.fillStyle = sky; c.fillRect(0, 0, w, h);
  if (mode === 'night') { const r = rng(3); c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 70; i++) c.fillRect(r() * w, r() * h * .25, 1.2, 1.2); }
  if (mode === 'day') { c.fillStyle = 'rgba(255,255,255,.35)'; const r = rng(5), ox = -V.camX * 1.5; for (let i = 0; i < 6; i++) { const cx = ((r() * w * 1.5 + ox) % (w * 1.5) + w * 1.5) % (w * 1.5) - w * .2, cy = r() * h * .12 + 8;
    c.beginPath(); c.ellipse(cx, cy, 60 + r() * 50, 10 + r() * 6, 0, 0, 7); c.fill(); } }
  const far = V.P(V.camX, FW + 12), wall = far ? far.y : h * .2;
  if (wall <= 0) return;
  if (!V.tex) V.tex = {lo: crowdTex(11, 3.2, tc(d.home), tc(d.away)), hi: crowdTex(29, 2.2, tc(d.home), tc(d.away))};
  const lowH = Math.max(40, h * .30), fasc = Math.max(10, h * .035), hiH = Math.max(40, h * .26);
  const lowTop = wall - lowH, hiTop = lowTop - fasc - hiH;
  const tile = (img, y0, hh, par) => { const ox = ((V.camX * par) % 1600 + 1600) % 1600; const sw = 1600 * (w / 1100);
    c.drawImage(img, 0, 0, 1600, 300, -ox * (sw / 1600), y0, sw, hh); c.drawImage(img, 0, 0, 1600, 300, -ox * (sw / 1600) + sw, y0, sw, hh); };
  tile(V.tex.hi, hiTop, hiH, 6); tile(V.tex.lo, lowTop, lowH, 10);
  if (mode === 'day') { c.fillStyle = 'rgba(255,248,230,.10)'; c.fillRect(0, lowTop, w, lowH); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, hiTop, w, hiH * .55); }
  if (mode === 'dusk') { c.fillStyle = 'rgba(255,170,110,.07)'; c.fillRect(0, hiTop, w, hiH + fasc + lowH); }
  // LED ribbon board between the decks: live score and odds scroll by
  const rb = c.createLinearGradient(0, lowTop - fasc, 0, lowTop); rb.addColorStop(0, '#0b0f14'); rb.addColorStop(1, '#151b22'); c.fillStyle = rb; c.fillRect(0, lowTop - fasc, w, fasc);
  const pl = W.P && W.P[Math.max(0, W.i)] , sc = pl ? pl.s : [0, 0];
  const msg = `   LOCKSMITH   ●   ${d.away} ${sc[1]}   ${d.home} ${sc[0]}   ●   ${(W.oddsTxt || '')}   ●   ${nmTeam(d.home).toUpperCase()}   ●  `;
  c.save(); c.beginPath(); c.rect(0, lowTop - fasc, w, fasc); c.clip();
  c.font = `700 ${Math.round(fasc * .72)}px "Barlow Condensed", Arial, sans-serif`; c.textBaseline = 'middle';
  const tw = c.measureText(msg).width || 400, off = ((NOW() * .04) % tw);
  c.fillStyle = tc(d.home, 1) === '#111111' ? '#ffd84d' : tc(d.home, 1);
  for (let x0 = -off; x0 < w; x0 += tw) c.fillText(msg, x0, lowTop - fasc / 2);
  c.restore();
  // roof edge and light rigs
  c.fillStyle = mode === 'day' ? 'rgba(40,46,56,.92)' : '#07090d'; c.fillRect(0, hiTop - h * .02, w, h * .02);
  if (mode !== 'day') { const n = 5; for (let k = 0; k < n; k++) { const lx = ((k / n) * w * 1.4 - V.camX * 3) % (w * 1.4); const x = (lx + w * 1.4) % (w * 1.4) - w * .2, y = hiTop - h * .06;
    const gl = c.createRadialGradient(x, y, 2, x, y, h * .22); gl.addColorStop(0, 'rgba(255,252,235,.85)'); gl.addColorStop(.2, 'rgba(255,250,230,.25)'); gl.addColorStop(1, 'rgba(255,250,230,0)');
    c.fillStyle = gl; c.fillRect(x - h * .25, y - h * .25, h * .5, h * .5); c.fillStyle = '#fffbe6'; c.fillRect(x - 18, y - 4, 36, 8); } }
}
function drawSidelines(c, V, st) {
  const d = W.data;
  // team areas: players and coaches standing behind the white border (home far side, away near side)
  if (!V.bench) { const r = rng(17); V.bench = {far: [], near: []}; for (let k = 0; k < 34; k++) { V.bench.far.push([36 + r() * 48, FW + 4.2 + r() * 3.2, Math.floor(r() * 99)]); V.bench.near.push([36 + r() * 48, -4.2 - r() * 3.2, Math.floor(r() * 99)]); } }
  const items = [];
  V.bench.far.forEach(b => items.push({a: {team: d.home, x: b[0], y: b[1], num: b[2], spd: 0, side: true}}));
  V.bench.near.forEach(b => items.push({a: {team: d.away, x: b[0], y: b[1], num: b[2], spd: 0, side: true}}));
  // chain crew on the far sideline: rod at the line to gain, rod at the previous spot, the down box at the ball
  if (st.los != null && st.fdl != null) {
    const y = FW + 2.6, a = Math.min(st.los, st.fdl), b = Math.max(st.los, st.fdl);
    seg(c, V, [st.fdl, y, 0], [st.fdl, y, 2.6], .09, '#ff8a1f'); seg(c, V, [st.fdl - (st.dir || 1) * 10, y, 0], [st.fdl - (st.dir || 1) * 10, y, 2.6], .09, '#ff8a1f');
    seg(c, V, [st.fdl - (st.dir || 1) * 10, y, .2], [st.fdl, y, .2], .03, '#d8d8d8');
    seg(c, V, [st.los, y + .8, 0], [st.los, y + .8, 2.8], .07, '#cccccc');
    const top = V.P(st.los, y + .8, 2.9);
    if (top && st.ddTxt) { const n = (st.ddTxt.match(/^\d/) || ['1'])[0]; const sz = Math.max(10, top.s * .7); c.fillStyle = '#ff8a1f'; c.fillRect(top.x - sz / 2, top.y - sz, sz, sz);
      c.fillStyle = '#111'; c.font = `700 ${sz * .8}px "Barlow Condensed", Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(n, top.x, top.y - sz / 2); }
    items.push({a: {team: '__crew', x: st.fdl, y: y + .5, num: null, spd: 0, side: true, crew: true}}, {a: {team: '__crew', x: st.los, y: y + 1.3, num: null, spd: 0, side: true, crew: true}});
  }
  items.map(it => ({...it, p: V.P(it.a.x, it.a.y)})).filter(it => it.p).sort((u, v) => u.p.s - v.p.s).forEach(it => drawPlayer(c, V, it.a, it.p));
}
function officials(st) {
  // referee behind the offense, umpire behind the defensive line, wings on the sidelines, deep judge downfield
  const los = st.los ?? (st.ball ? st.ball[0] : TV.camX), dir = st.dir || 1, bx = st.ball ? st.ball[0] : los, by = st.ball ? st.ball[1] : CYW;
  const want = [[los - dir * 12, CYW + 2.5], [los + dir * 6, CYW - 1.5], [los, -0.9], [los, FW + 0.9], [los + dir * 24, CYW + 6]];
  if (st.live) { want[1] = [lerp(want[1][0], bx, .25), lerp(want[1][1], by, .25)]; want[2][0] = lerp(los, bx, .5); want[3][0] = lerp(los, bx, .5); want[4] = [lerp(want[4][0], bx, .3), lerp(want[4][1], by, .3)]; }
  const now = NOW(), dt = TV._refT ? Math.min(.1, (now - TV._refT) / 1000) : .016; TV._refT = now;
  TV.refs = TV.refs || want.map(q => [...q]);
  const k = 1 - Math.exp(-dt * 2.2 * Math.max(1, W.speed));
  return TV.refs.map((r_, i) => { const ox = r_[0], oy = r_[1]; r_[0] += (want[i][0] - r_[0]) * k; r_[1] += (want[i][1] - r_[1]) * k;
    const spd = Math.hypot(r_[0] - ox, r_[1] - oy) / dt; TV._refLeg = (TV._refLeg || 0) + Math.min(spd, 20) * dt * .25;
    return {team: '__ref', ref: true, x: r_[0], y: r_[1], num: null, spd, leg: TV._refLeg + i, vx: (r_[0] - ox) / dt}; });
}
function makeGrain() {
  const c = document.createElement('canvas'); c.width = 400; c.height = 225; const x = c.getContext('2d'), im = x.createImageData(400, 225);
  for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0); return c;
}
function makeCrowd() {
  const c = document.createElement('canvas'); c.width = 1200; c.height = 260; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 260); g.addColorStop(0, '#0b0f14'); g.addColorStop(1, '#1b2129'); x.fillStyle = g; x.fillRect(0, 0, 1200, 260);
  const r = rng(7), cols = ['#c8ccd2', '#8a919c', '#d64545', '#3f6fd0', '#e9c46a', '#2a9d8f', '#f4f1de', '#6c757d'];
  for (let i = 0; i < 9000; i++) { x.fillStyle = cols[Math.floor(r() * cols.length)]; x.globalAlpha = 0.25 + r() * 0.45; const yy = r() * 250; x.fillRect(r() * 1200, yy, 1.6 + yy / 120, 1.6 + yy / 120); }
  x.globalAlpha = 1; for (let k = 0; k < 6; k++) { x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(0, 40 * k + 20, 1200, 2); }
  return c;
}

// ---------------------------------------------------------------- world drawing
function quad(c, V, pts, fill) { const P = pts.map(p => V.P(p[0], p[1], p[2] || 0)); if (P.some(p => !p)) return; c.beginPath(); P.forEach((p, k) => k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.closePath(); c.fillStyle = fill; c.fill(); }
function seg(c, V, a, b, wYd, col, alpha = 1) { const p = V.P(a[0], a[1], a[2] || 0), q = V.P(b[0], b[1], b[2] || 0); if (!p || !q) return; c.globalAlpha = alpha; c.strokeStyle = col; c.lineWidth = Math.max(0.6, wYd * (p.s + q.s) / 2); c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); c.globalAlpha = 1; }
function groundText(c, V, txt, x, y, size, rot, col, font = '700', alpha = 1) {
  // text painted flat on the turf: local affine from the projection at (x, y)
  const p0 = V.P(x, y), ux = V.P(x + Math.cos(rot), y + Math.sin(rot)), uy = V.P(x - Math.sin(rot), y + Math.cos(rot));
  if (!p0 || !ux || !uy) return;
  c.save(); c.globalAlpha = alpha;
  c.setTransform(V.dpr * (ux.x - p0.x), V.dpr * (ux.y - p0.y), V.dpr * -(uy.x - p0.x), V.dpr * -(uy.y - p0.y), V.dpr * p0.x, V.dpr * p0.y);
  c.font = `${font} ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = col; c.fillText(txt, 0, 0);
  c.restore();
}

function drawWorld(c, V, st) {
  const w = V.w, h = V.h, d = W.data;
  drawStadium(c, V, st);
  // ground outside the field + padded wall
  quad(c, V, [[-20, -30], [140, -30], [140, FW + 12], [-20, FW + 12]], '#1f4f2d');
  quad(c, V, [[-20, FW + 11.5, 0], [140, FW + 11.5, 0], [140, FW + 11.5, 1.4], [-20, FW + 11.5, 1.4]], tc(d.home));
  quad(c, V, [[-20, FW + 11.5, 1.4], [140, FW + 11.5, 1.4], [140, FW + 11.5, 1.7], [-20, FW + 11.5, 1.7]], '#0b0f14');
  // benches (away near side, home far side)
  quad(c, V, [[35, -10], [85, -10], [85, -6.5], [35, -6.5]], hexA(tc(d.away), .55));
  quad(c, V, [[35, FW + 6.5], [85, FW + 6.5], [85, FW + 9.5], [35, FW + 9.5]], hexA(tc(d.home), .55));
  // white border
  quad(c, V, [[-2, -2], [122, -2], [122, FW + 2], [-2, FW + 2]], '#e8efe9');
  // turf stripes
  for (let k = 0; k < 20; k++) { const x0 = 10 + 5 * k; quad(c, V, [[x0, 0], [x0 + 5, 0], [x0 + 5, FW], [x0, FW]], k % 2 ? '#2f7a43' : '#2b7140'); }
  // end zones in the colors of the team defending them this quarter
  const ez = st.ez || [d.home, d.away];
  quad(c, V, [[0, 0], [10, 0], [10, FW], [0, FW]], tc(ez[0])); quad(c, V, [[110, 0], [120, 0], [120, FW], [110, FW]], tc(ez[1]));
  groundText(c, V, nmTeam(ez[0]).toUpperCase(), 5, CYW, 3.4, Math.PI / 2, 'rgba(255,255,255,.92)', '700');
  groundText(c, V, nmTeam(ez[1]).toUpperCase(), 115, CYW, 3.4, -Math.PI / 2, 'rgba(255,255,255,.92)', '700');
  // lines
  for (let x = 10; x <= 110; x += 5) seg(c, V, [x, 0], [x, FW], x % 10 === 0 ? 0.14 : 0.11, '#ffffff', x === 10 || x === 110 ? 1 : 0.85);
  seg(c, V, [0, 0], [120, 0], 0.15, '#fff'); seg(c, V, [0, FW], [120, FW], 0.15, '#fff'); seg(c, V, [0, 0], [0, FW], 0.15, '#fff'); seg(c, V, [120, 0], [120, FW], 0.15, '#fff');
  for (let x = 11; x < 110; x++) { if (x % 5 === 0) continue; seg(c, V, [x, HASH[0] - .35], [x, HASH[0] + .35], .07, '#fff', .75); seg(c, V, [x, HASH[1] - .35], [x, HASH[1] + .35], .07, '#fff', .75);
    seg(c, V, [x, .4], [x, 1.1], .07, '#fff', .7); seg(c, V, [x, FW - 1.1], [x, FW - .4], .07, '#fff', .7); }
  [10, 20, 30, 40, 50, 40, 30, 20, 10].forEach((n, k) => { const x = 20 + 10 * k;
    groundText(c, V, String(n), x, 12, 2.2, 0, 'rgba(255,255,255,.85)'); groundText(c, V, String(n), x, FW - 12, 2.2, Math.PI, 'rgba(255,255,255,.85)'); });
  // midfield logo
  const mid = []; for (let a = 0; a < 40; a++) mid.push([60 + 4.2 * Math.cos(a / 40 * 2 * Math.PI), CYW + 4.2 * Math.sin(a / 40 * 2 * Math.PI)]);
  quad(c, V, mid, hexA(tc(d.home), .7)); groundText(c, V, d.home, 60, CYW, 3, 0, '#fff');
  // scrimmage + first-down lines and the on-field down marker
  if (st.los != null) {
    if (st.fdl != null && st.fdl > 0 && st.fdl < 120) { c.shadowColor = 'rgba(255,220,40,.8)'; c.shadowBlur = 8; quad(c, V, [[st.fdl - .18, 0], [st.fdl + .18, 0], [st.fdl + .18, FW], [st.fdl - .18, FW]], '#ffd92e'); c.shadowBlur = 0; }
    quad(c, V, [[st.los - .16, 0], [st.los + .16, 0], [st.los + .16, FW], [st.los - .16, FW]], 'rgba(70,150,255,.95)');
    if (st.ddTxt) { const xm = st.los + (st.dir || 1) * 2.6; groundText(c, V, st.ddTxt, xm, FW - 6, 1.5, 0, '#ffe66b', '700', .95); }
  }
  // goal posts (3D)
  for (const gx of [-0.3, 120.3]) { seg(c, V, [gx, CYW, 0], [gx, CYW, 3.3], .22, '#f2c230'); seg(c, V, [gx, CYW - 3.08, 3.3], [gx, CYW + 3.08, 3.3], .2, '#f2c230');
    seg(c, V, [gx, CYW - 3.08, 3.3], [gx, CYW - 3.08, 15], .16, '#f2c230'); seg(c, V, [gx, CYW + 3.08, 3.3], [gx, CYW + 3.08, 15], .16, '#f2c230'); }
  // stadium lighting: afternoon shadow of the stands, or light pools under the night lights
  const L_ = lightMode();
  if (L_ === 'day') quad(c, V, [[-20, FW * .58], [140, FW * .7], [140, FW + 12], [-20, FW + 12]], 'rgba(10,20,30,.16)');
  drawSidelines(c, V, st);
  // trajectory trail of the ball in flight
  if (st.trail && st.trail.length > 1) { c.strokeStyle = 'rgba(255,255,255,.55)'; c.setLineDash([6, 6]); c.lineWidth = 2; c.beginPath(); let started = false;
    for (const t of st.trail) { const p = V.P(t[0], t[1], t[2]); if (!p) continue; if (!started) { c.moveTo(p.x, p.y); started = true; } else c.lineTo(p.x, p.y); } c.stroke(); c.setLineDash([]); }
  // flag
  if (st.flag) { const p = V.P(st.flag[0], st.flag[1], st.flag[2] || 0); if (p) { c.fillStyle = '#ffd400'; c.beginPath(); c.arc(p.x, p.y, Math.max(3, p.s * .35), 0, 7); c.fill(); } }
  // players (far to near), ball
  const items = [];
  for (const a of (st.actors || [])) { const p = V.P(a.x, a.y); if (p) items.push({kind: 'p', a, p}); }
  for (const a of officials(st)) { const p = V.P(a.x, a.y); if (p) items.push({kind: 'p', a, p}); }
  if (st.ball) { const p = V.P(st.ball[0], st.ball[1], st.ball[2]); const g = V.P(st.ball[0], st.ball[1], 0); if (p && g) items.push({kind: 'b', p, g, b: st.ball}); }
  items.sort((u, v) => u.p.s - v.p.s);
  for (const it of items) it.kind === 'p' ? drawPlayer(c, V, it.a, it.p) : drawBall(c, V, it);
  // carrier tag
  if (st.tag) { const p = V.P(st.tag.x, st.tag.y, 2.6); if (p) { const txt = st.tag.txt; c.font = '700 13px Inter, Segoe UI, sans-serif'; const tw = c.measureText(txt).width + 16;
    c.fillStyle = st.tag.col; c.strokeStyle = '#fff'; c.lineWidth = 1.5; rr(c, p.x - tw / 2, p.y - 24, tw, 20, 10); c.fill(); c.stroke(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, p.x, p.y - 14); } }
  // night lights: warm pools on the turf; then a soft broadcast vignette
  if (L_ === 'night' || L_ === 'dome') { c.save(); c.globalCompositeOperation = 'lighter'; const lg = c.createRadialGradient(w / 2, h * .62, 10, w / 2, h * .62, w * .75);
    lg.addColorStop(0, 'rgba(255,250,235,.10)'); lg.addColorStop(1, 'rgba(255,250,235,0)'); c.fillStyle = lg; c.fillRect(0, 0, w, h); c.restore(); }
  const vg = c.createRadialGradient(w / 2, h * .55, h * .3, w / 2, h * .55, h * .95); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.32)'); c.fillStyle = vg; c.fillRect(0, 0, w, h);
  if (TV.grain) { c.globalAlpha = .05; c.drawImage(TV.grain, 0, 0, w, h); c.globalAlpha = 1; }
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

function drawPlayer(c, V, a, p) {
  const s = p.s, team = a.team, isRef = a.ref, crew = a.crew;
  const helm = isRef ? '#111' : crew ? '#ff8a1f' : (tc(team, 1) === '#111111' ? '#22272e' : tc(team, 1));
  const pants = isRef ? '#f2f2f2' : crew ? '#333' : (tc(team, 2) === '#FFFFFF' ? '#dfe4ea' : tc(team, 2));
  if (a.down) {           // on the turf after the tackle
    const h = V.P(a.x + .95, a.y), f = V.P(a.x - .95, a.y); if (!h || !f) return;
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(p.x, p.y + 1, s * 1.05, s * .26, 0, 0, 7); c.fill();
    c.lineCap = 'round'; c.strokeStyle = pants; c.lineWidth = Math.max(2, s * .32); c.beginPath(); c.moveTo(f.x, f.y - s * .1); c.lineTo(p.x, p.y - s * .14); c.stroke();
    c.strokeStyle = (W.data && team === W.data.away) ? '#eef1f4' : tc(team); c.lineWidth = Math.max(3, s * .5); c.beginPath(); c.moveTo(p.x, p.y - s * .16); c.lineTo(h.x, h.y - s * .2); c.stroke();
    c.fillStyle = helm; c.beginPath(); c.arc(h.x + s * .12, h.y - s * .22, Math.max(2, s * .25), 0, 7); c.fill(); return;
  }
  const crouch = a.pose === 'set' ? .74 : 1, jz = a.jump || 0;
  const lean = clamp((a.vx || 0) / 9, -1, 1) * s * .16 + (a.pose === 'set' ? (a.facing || 1) * s * .12 : 0);
  const top = V.P(a.x, a.y, 1.95 * crouch + jz), hip = V.P(a.x, a.y, 0.95 * crouch + jz), jt = V.P(a.x, a.y, 1.62 * crouch + jz), foot = V.P(a.x, a.y, jz);
  if (!top || !hip || !jt || !foot) return;
  const bw = Math.max(3, s * (a.side ? .7 : .78));
  c.fillStyle = 'rgba(0,0,0,.32)'; c.beginPath(); c.ellipse(p.x + s * .15, p.y, s * .5 * (1 - jz * .3), s * .17, 0, 0, 7); c.fill();
  // legs: stride amplitude and frequency follow this player's own speed
  const amp = clamp((a.spd || 0) / 7, 0, 1), sw = Math.sin(a.leg || 0) * s * .2 * amp, spread_ = a.pose === 'set' ? 1.6 : 1;
  c.strokeStyle = pants; c.lineWidth = Math.max(1.6, s * .22); c.lineCap = 'round';
  c.beginPath(); c.moveTo(hip.x - bw * .17 + lean * .3, hip.y); c.lineTo(foot.x - bw * .18 * spread_ + sw, foot.y - 1); c.moveTo(hip.x + bw * .17 + lean * .3, hip.y); c.lineTo(foot.x + bw * .18 * spread_ - sw, foot.y - 1); c.stroke();
  c.strokeStyle = isRef ? '#111' : '#f4f4f4'; c.lineWidth = Math.max(1.6, s * .23); c.beginPath(); c.moveTo(foot.x - bw * .18 * spread_ + sw, foot.y - 1 - s * .18); c.lineTo(foot.x - bw * .18 * spread_ + sw, foot.y - 1);
  c.moveTo(foot.x + bw * .18 * spread_ - sw, foot.y - 1 - s * .18); c.lineTo(foot.x + bw * .18 * spread_ - sw, foot.y - 1); c.stroke();
  const road = W.data && team === W.data.away;
  const jc = isRef ? '#f7f7f7' : crew ? '#2a2f36' : (road ? '#f4f6f8' : tc(team)), nc = road ? tc(team) : '#ffffff';
  const jx = hip.x + lean * .6;
  // shoulder pads + jersey (lit from above)
  const g = c.createLinearGradient(jx - bw / 2, jt.y, jx + bw / 2, hip.y);
  g.addColorStop(0, isRef || road ? '#ffffff' : crew ? '#3a4048' : hexLight(tc(team), .28)); g.addColorStop(1, isRef ? '#e6e6e6' : crew ? '#20252b' : (road ? '#d9dee4' : tc(team)));
  c.fillStyle = g; c.beginPath(); c.ellipse(jx, jt.y + s * .06, bw * .62, s * .17, 0, 0, 7); c.fill();
  c.strokeStyle = a.hl ? '#ffe14a' : (road ? tc(team) : 'rgba(255,255,255,.85)'); c.lineWidth = a.hl ? 2.6 : (road ? 1.4 : 1);
  rr(c, jx - bw / 2, jt.y, bw, hip.y - jt.y + 1, Math.min(6, bw * .3)); c.fill(); if (!isRef) c.stroke();
  if (isRef) { c.strokeStyle = '#111'; c.lineWidth = Math.max(1, bw * .12); for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(jx + k * bw * .3, jt.y + 1); c.lineTo(jx + k * bw * .3, hip.y); c.stroke(); } }
  // arms: swing with the stride, or the pose (throw / reach for the catch / celebrate / signal)
  c.strokeStyle = isRef ? '#f7f7f7' : jc; c.lineWidth = Math.max(1.4, s * .16);
  const sh = (side) => [jx + side * bw * .5, jt.y + s * .12];
  const hand = (side) => {
    if (a.pose === 'throw' && side === (a.facing || 1)) { const q = V.P(a.x - (a.facing || 1) * .2, a.y, 2.45 * crouch + jz); return q ? [q.x, q.y] : null; }
    if (a.pose === 'catch' || a.pose === 'cele' || a.pose === 'signal') { const q = V.P(a.x + side * .25, a.y, 2.5 + jz); return q ? [q.x, q.y] : null; }
    const aw = Math.sin((a.leg || 0) + Math.PI) * s * .14 * amp * side; return [jx + side * bw * .62 + aw, jt.y + s * .5];
  };
  for (const side of [-1, 1]) { const h0 = sh(side), h1 = hand(side); if (!h1) continue; c.beginPath(); c.moveTo(h0[0], h0[1]); c.lineTo(h1[0], h1[1]); c.stroke(); }
  if (!isRef && !crew && a.num != null && bw > 9) { c.fillStyle = nc; c.font = `700 ${Math.max(8, bw * .66)}px "Barlow Condensed", Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(a.num), jx, (jt.y + hip.y) / 2 + 1); }
  // helmet (or official's cap) with a highlight, stripe and face mask
  const hx = top.x + lean, hy = top.y + s * .12, hr = Math.max(2, s * (isRef || crew ? .22 : .27));
  c.fillStyle = isRef || crew ? '#f2d8c2' : helm; c.beginPath(); c.arc(hx, hy, hr, 0, 7); c.fill();
  if (isRef || crew) { c.fillStyle = isRef ? '#111' : '#ff8a1f'; c.beginPath(); c.arc(hx, hy - hr * .25, hr, Math.PI, 0); c.fill(); return; }
  c.strokeStyle = road ? tc(team) : '#ffffff'; c.lineWidth = Math.max(1, s * .06); c.beginPath(); c.moveTo(hx, hy - hr); c.lineTo(hx, hy + hr * .2); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(hx - hr * .35, hy - hr * .35, hr * .35, 0, 7); c.fill();
  c.strokeStyle = 'rgba(230,230,230,.9)'; c.lineWidth = Math.max(1, s * .05); c.beginPath(); c.moveTo(hx - hr * .6, hy + hr * .55); c.lineTo(hx + hr * .6, hy + hr * .55); c.stroke();
}
function hexLight(hex, f) { const n = parseInt(hex.slice(1), 16); const L = v => Math.round(v + (255 - v) * f); return `rgb(${L(n >> 16)},${L((n >> 8) & 255)},${L(n & 255)})`; }
function drawBall(c, V, it) {
  const {p, g, b} = it, s = p.s;
  c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(g.x, g.y, Math.max(2, s * .22), Math.max(1, s * .08), 0, 0, 7); c.fill();
  if (b[2] > 2.2) { const r0 = Math.max(9, s * .7); const hg = c.createRadialGradient(p.x, p.y, 1, p.x, p.y, r0); hg.addColorStop(0, 'rgba(255,240,200,.75)'); hg.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = hg; c.beginPath(); c.arc(p.x, p.y, r0, 0, 7); c.fill(); }
  c.save(); c.translate(p.x, p.y); c.rotate(b[3] || -0.4);
  const rx = Math.max(4, s * .3), ry = Math.max(2.5, s * .18);
  const gr = c.createRadialGradient(-rx * .3, -ry * .4, 1, 0, 0, rx); gr.addColorStop(0, '#c8833f'); gr.addColorStop(1, '#5f3313'); c.fillStyle = gr;
  c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = Math.max(.8, s * .02); c.beginPath(); c.moveTo(-rx * .35, 0); c.lineTo(rx * .35, 0); c.stroke(); c.restore();
}

// ================================================================ choreography: a play becomes 22 moving players + a ball
function teamsOf(p) { const d = W.data; const off = p.p === 0 ? d.home : d.away, def = p.p === 0 ? d.away : d.home; return {off, def}; }

function formation(p, j) {
  // pre-snap spots for the offense and defense of play p (world yards)
  const r = rng(j * 7919 + 13), {off, def} = teamsOf(p), dir = p.r ? 1 : -1, L = losX(p.y ?? 75, p.r);
  const hashY = CYW;                                          // ball spotted in the middle so the center and the ball line up
  const ox = along => L - dir * along, oy = lat => hashY + dir * lat;       // lat > 0 = QB's left
  const kind = p.k, R_ = W.roster;
  const O = R_[off].off, Dd = R_[def].def;
  const shotgun = kind === 'pass' || kind === 'inc' || kind === 'int' || kind === 'sack' || (kind === 'td' && p.comp) || r() < .45;
  const A = [];
  const push = (team, pl, x, y, role) => A.push({team, num: pl.num, short: pl.short, slot: pl.slot, role, x, y, sx: x, sy: y});
  if (kind === 'punt' || (kind === 'td' && p.punt)) {
    const PP = R_[off].p || {num: null, short: 'P'};
    const line = [-6, -4, -2, 0, 2, 4, 6].map(l => [ox(.6), oy(l)]);
    O.slice(1, 8).forEach((pl, k) => push(off, pl, line[k][0], line[k][1], 'cov'));
    push(off, O[8], ox(.6), oy(18), 'gunner'); push(off, O[9], ox(.6), oy(-18), 'gunner'); push(off, O[10], ox(7), oy(1.5), 'pp');
    push(off, {...PP, slot: 'P'}, ox(14), oy(0), 'punter');
    Dd.slice(0, 9).forEach((pl, k) => push(def, pl, L + dir * (1 + (k > 5 ? 6 : 0)), oy(-8 + k * 2), 'rush'));
    push(def, Dd[9], L + dir * 12, oy(16), 'jam'); push(def, {...(R_[def].pr || Dd[10]), slot: 'PR'}, L + dir * 42, oy(0), 'returner');
    return A;
  }
  if (kind === 'fg' || kind === 'fgx' || kind === 'xp') {
    const K = R_[off].k || {num: null, short: 'K'}, PP = R_[off].p || {num: null, short: 'H'};
    [-5, -3.5, -2, -.8, 0, .8, 2, 3.5, 5].forEach((l, k) => push(off, O[(k + 1) % O.length] || O[0], ox(.6), oy(l), 'line'));
    push(off, {...PP, slot: 'H'}, ox(7), oy(.5), 'holder'); push(off, {...K, slot: 'K'}, ox(9.8), oy(-1.2), 'kicker');
    Dd.forEach((pl, k) => push(def, pl, L + dir * (1 + (k > 8 ? 4 : 0)), oy(-6 + k * 1.3), 'block'));
    return A;
  }
  // regular offense: QB LT LG C RG RT RB WR WR WR TE
  const [QB, LT, LG, C_, RG, RT, RB, WR1, WR2, WR3, TE] = O;
  push(off, C_, ox(.6), oy(0), 'ol'); push(off, LG, ox(.75), oy(1.3), 'ol'); push(off, RG, ox(.75), oy(-1.3), 'ol'); push(off, LT, ox(.9), oy(2.6), 'ol'); push(off, RT, ox(.9), oy(-2.6), 'ol');
  const teSide = r() < .5 ? 1 : -1;
  push(off, TE, ox(1.1), oy(teSide * 4.0), 'te');
  push(off, QB, ox(shotgun ? 5 : 1.2), oy(0), 'qb');
  push(off, RB, ox(shotgun ? 5 : 7), oy(shotgun ? -teSide * 1.6 : 0), 'rb');
  const wide = clamp(18 + r() * 3, 14, 22);
  push(off, WR1, ox(.9), oy(-teSide * wide), 'wr'); push(off, WR2, ox(1.1), oy(teSide * (wide - 1)), 'wr'); push(off, WR3, ox(1.1), oy(-teSide * (wide - 7)), 'wr');
  // defense: 4 DL, 3 LB, 2 CB, 2 S (CBs over the outside receivers)
  const [d1, d2, d3, d4, l1, l2, l3, c1, c2, s1, s2] = Dd;
  const dx = along => L + dir * along;
  push(def, d1, dx(1), oy(3.3), 'dl'); push(def, d2, dx(1), oy(1), 'dl'); push(def, d3, dx(1), oy(-1), 'dl'); push(def, d4, dx(1), oy(-3.3), 'dl');
  push(def, l1, dx(4.6), oy(4.2), 'lb'); push(def, l2, dx(4.8), oy(0), 'lb'); push(def, l3, dx(4.6), oy(-4.2), 'lb');
  push(def, c1, dx(6.5), oy(-teSide * wide), 'cb'); push(def, c2, dx(6.5), oy(teSide * (wide - 1)), 'cb');
  push(def, s1, dx(12.5), oy(9), 's'); push(def, s2, dx(13), oy(-9), 's');
  return A;
}

function kickoffFormation(p, j) {
  // 2025 dynamic kickoff: kicker at his own 35, coverage at the receiving 40, return team set up between their 30 and 35
  const {off: rec, def: kick} = teamsOf(p), dir = p.r ? 1 : -1, R_ = W.roster;
  const recX = yl => losX(yl, p.r);                  // positions in receiving-team coordinates
  const A = [];
  const K = R_[kick].k || {num: null, short: 'K'};
  const KR = R_[rec].kr || R_[rec].off[7];
  A.push({team: kick, num: K.num, short: K.short, slot: 'K', role: 'kicker', x: recX(35) + dir * 6, y: CYW});
  R_[kick].def.slice(0, 10).forEach((pl, k) => A.push({team: kick, num: pl.num, short: pl.short, slot: pl.slot, role: 'cov', x: recX(60), y: 4 + k * 5}));
  R_[rec].off.slice(1, 10).forEach((pl, k) => A.push({team: rec, num: pl.num, short: pl.short, slot: pl.slot, role: 'blk', x: recX(67 + (k % 3)), y: 6 + k * 5}));
  A.push({team: rec, num: KR.num, short: KR.short, slot: 'KR', role: 'returner', x: recX(96), y: CYW});
  A.push({team: rec, num: R_[rec].off[0].num, short: R_[rec].off[0].short, slot: 'QB', role: 'sideline', x: recX(50), y: -5});
  A.forEach(a => { a.sx = a.x; a.sy = a.y; });
  return A;
}

// path helpers
function kf(points) { // [[t,x,y],...] smooth curve through every point: starts and ends at rest, carries speed through waypoints
  const n = points.length;
  if (n === 1) return () => [points[0][1], points[0][2]];
  const m = points.map((q, i) => {
    if (i === 0 || i === n - 1) return [0, 0];
    const a = points[i - 1], b = points[i + 1], dt = Math.max(1e-6, b[0] - a[0]);
    return [(b[1] - a[1]) / dt, (b[2] - a[2]) / dt];
  });
  for (let i = 0; i < n - 1; i++) { const a = points[i], b = points[i + 1]; if (Math.hypot(b[1] - a[1], b[2] - a[2]) < 1e-3) { m[i] = [0, 0]; m[i + 1] = [0, 0]; } }
  return t => {
    if (t <= points[0][0]) return [points[0][1], points[0][2]];
    for (let k = 0; k < n - 1; k++) { const a = points[k], b = points[k + 1]; if (t <= b[0]) {
      const h = Math.max(1e-6, b[0] - a[0]), u = (t - a[0]) / h, u2 = u * u, u3 = u2 * u;
      const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
      return [h00 * a[1] + h10 * h * m[k][0] + h01 * b[1] + h11 * h * m[k + 1][0], h00 * a[2] + h10 * h * m[k][1] + h01 * b[2] + h11 * h * m[k + 1][1]]; } }
    const z = points[n - 1]; return [z[1], z[2]];
  };
}

function choreograph(p, j) {
  // returns {dur, actors:[{...,path(t)}], ball(t)->[x,y,z,rot], carrier(t)->actor|null, events:[{t,kind}], focus(t)->x, zoom}
  const r = rng(j * 104729 + 7), dir = p.r ? 1 : -1, k = p.k;
  const L = losX(p.y ?? 75, p.r), X = yl => losX(clamp(yl, -9, 109), p.r);
  const {off, def} = teamsOf(p);
  const isKO = k === 'ko' || (k === 'td' && /kicks off/.test(p.x));
  const F = isKO ? kickoffFormation(p, j) : formation(p, j);
  const find = (team, pred) => F.find(a => a.team === team && pred(a));
  const qb = find(off, a => a.role === 'qb'), rb = find(off, a => a.role === 'rb');
  const byName = (team, name) => { if (!name) return null; const s = shortName(name); return F.find(a => a.team === team && (a.short === s)); };
  const ret = {dur: 2600, actors: F, events: [], zoom: 1, trail: null};
  F.forEach(a => { a.path = kf([[0, a.x, a.y], [1, a.x, a.y]]); });
  const ends = yl => [X(yl), null];
  let ballFn = t => [L - dir * 0.5, CYW, 0.3, 0], carrierFn = () => null;
  const pursue = (from, tx, ty, t0, spread, frac = 1, follow = null) => {
    // defenders chase the ball carrier (follow) from where they are at t0; the closest one arrives to make the tackle,
    // the rest pile in around him, far-away players arrive late
    const order = F.filter(a => a.team === from).map(a => { const q = a.path(t0); return [a, Math.hypot(q[0] - tx, q[1] - ty)]; }).sort((u, v) => u[1] - v[1]);
    order.forEach(([a, dist], i) => { const base = a.path; const ang = r() * 2 * Math.PI; const rad = i === 0 ? 0.75 : spread * (0.7 + r()) + i * 0.3;
      const ox = Math.cos(ang) * rad, oy = Math.sin(ang) * rad, late = clamp(dist / 45, 0, .45);
      a.path = t => { if (t <= t0) return base(t); const [bx, by] = base(t0); const u = clamp((t - t0) / (1 - t0), 0, 1);
        const [cx, cy] = follow ? follow(t) : [tx, ty];
        const k = easeOut(clamp(u / (1 - late * .6), 0, 1)) * (i === 0 ? 1 : frac * (1 - late * .35));
        return [lerp(bx, cx + ox, k), lerp(by, cy + oy, k)]; }; });
  };
  const blockers = (team, t1, push) => F.filter(a => a.team === team && ['ol', 'line', 'te', 'dl', 'block', 'rush'].includes(a.role)).forEach(a => { a.path = kf([[0, a.x, a.y], [.1, a.x, a.y], [t1, a.x + push * (r() * .6 + .7), a.y + (r() - .5) * 1.2]]); });

  if (['pass', 'inc', 'int'].includes(k) || (k === 'td' && (p.comp || p.target) && !p.td_def) || (k === 'fum' && p.target) || (k === 'td' && p.td_def && p.target) || k === 'two') {
    const air = p.air ?? (k === 'two' ? 3 : 8), catchYl = (p.y ?? 50) - air;
    const cx = X(catchYl), side = /left/.test(p.x) ? 1 : /right/.test(p.x) ? -1 : 0;
    const tgt = byName(off, p.target) || find(off, a => a.role === 'wr') || F[0];
    if (p.target && tgt && shortName(p.target) !== tgt.short) { tgt.short = shortName(p.target); tgt.num = numFor(off, p.target); }
    const cy = clamp(CYW + dir * side * (8 + r() * 8) + (r() - .5) * 4, 3, FW - 3);
    const tThrow = .3, flight = clamp(.12 + air * .009, .14, .4), tCatch = tThrow + flight;
    const endYl = k === 'pass' || k === 'td' || k === 'fum' ? (k === 'td' ? -1 : (p.e ?? catchYl)) : catchYl;
    ret.dur = 2600 + air * 22 + (k === 'pass' && (p.gain || 0) > 15 ? 700 : 0);
    ret.zoom = air > 22 ? .78 : 1;
    const drop = [qb.x - dir * (qb.x === L - dir * 5 ? 2 : 5), qb.y];
    qb.path = kf([[0, qb.x, qb.y], [.08, qb.x, qb.y], [tThrow - .02, drop[0], drop[1]], [1, drop[0] + dir * .5, drop[1]]]);
    blockers(off, tThrow + .1, -dir * 1.3); blockers(def, tThrow + .1, -dir * 1.6);
    // receivers run routes; the target arrives at the catch point when the ball does
    F.filter(a => a.team === off && ['wr', 'te', 'rb'].includes(a.role) && a !== tgt).forEach(a => { const dpt = 4 + r() * 14; const lat = (r() - .5) * 10;
      a.path = kf([[0, a.x, a.y], [.1, a.x, a.y], [tCatch, a.x + dir * dpt, clamp(a.y + lat, 2, FW - 2)], [1, a.x + dir * (dpt + 3), clamp(a.y + lat * 1.2, 2, FW - 2)]]); });
    const tEnd = k === 'inc' ? [cx + dir * 2, cy] : [X(endYl), clamp(cy + (r() - .5) * 8, 2, FW - 2)];
    tgt.path = kf([[0, tgt.x, tgt.y], [.1, tgt.x, tgt.y], [tCatch, cx, cy], [1, tEnd[0], tEnd[1]]]);
    // coverage: corners trail receivers, safeties drive on the ball
    F.filter(a => a.team === def && a.role === 'cb').forEach((a, i) => { const recv = F.filter(o => o.team === off && o.role === 'wr')[i] || tgt; const rp = recv.path;
      a.path = t => { const [x, y] = rp(Math.max(0, t - .06)); return t < .1 ? [a.x, a.y] : [lerp(a.x, x + dir * 1.3, Math.min(1, (t - .1) * 4)), lerp(a.y, y, Math.min(1, (t - .1) * 4))]; }; });
    F.filter(a => a.team === def && ['s', 'lb'].includes(a.role)).forEach(a => { a.path = kf([[0, a.x, a.y], [.1, a.x, a.y], [tCatch, lerp(a.x, cx, .55) + dir * 2, lerp(a.y, cy, .55)]]); });
    if (k === 'int') {
      const picker = F.filter(a => a.team === def && ['cb', 's'].includes(a.role)).sort((u, v) => Math.hypot(u.x - cx, u.y - cy) - Math.hypot(v.x - cx, v.y - cy))[0];
      const fin = catchYl <= 0 ? 20 : catchYl + (p.ret || 0);
      picker.path = kf([[0, picker.x, picker.y], [.1, picker.x, picker.y], [tCatch, cx + dir * .8, cy], [1, X(fin), clamp(cy + (r() - .5) * 10, 2, FW - 2)]]);
      if (p.x) { const nm = (p.x.match(/by ([A-Z][\w'.-]+)/) || [])[1]; if (nm) { picker.short = nm; picker.num = numFor(def, nm) ?? picker.num; } }
      pursue(off, X(fin), picker.path(1)[1], tCatch + .05, 2.5, 1, picker.path);
      carrierFn = t => t >= tCatch ? picker : (t >= .1 && t < tThrow ? qb : null);
      ret.events.push({t: tCatch, kind: 'int'});
    } else if (k === 'inc') {
      carrierFn = t => (t >= .1 && t < tThrow ? qb : null);
      F.filter(a => a.team === def && a.role !== 'dl').forEach(a => { const b = a.path; a.path = t => b(Math.min(t, tCatch + .1)); });
    } else {
      pursue(def, tEnd[0], tEnd[1], tCatch + .03, k === 'td' ? 4 : 1.8, k === 'td' ? .7 : 1, tgt.path);
      carrierFn = t => t >= tCatch ? tgt : (t >= .1 && t < tThrow ? qb : null);
    }
    const q0 = () => qb.path(tThrow);
    ballFn = t => {
      if (t < .06) return [L - dir * .5, CYW, .3, 0];
      if (t < .1) { const u = (t - .06) / .04, [qx, qy] = qb.path(t); return [lerp(L - dir * .5, qx, u), lerp(CYW, qy, u), lerp(.3, 1.3, u), 0]; }
      if (t < tThrow) { const [qx, qy] = qb.path(t); return [qx + dir * .2, qy - .3, 1.5, 0]; }
      if (t < tCatch) { const u = (t - tThrow) / flight, [x0, y0] = q0(); const hgt = 1.8 + Math.sin(Math.PI * u) * (1.5 + air * .16); return [lerp(x0, cx, u), lerp(y0, cy, u), hgt, dir > 0 ? -.2 : 3.34]; }
      const c_ = carrierFn(t);
      if (k === 'inc') { const u = clamp((t - tCatch) / .2, 0, 1); return [cx + dir * u * 2.5, cy + u, Math.max(0, 1.2 * (1 - u) + Math.abs(Math.sin(u * 6)) * .5 * (1 - u)), u * 4]; }
      if (c_) { const [x, y] = c_.path(t); return [x + dir * .15, y - .25, 1.0, 0]; }
      return [cx, cy, 1, 0];
    };
    ret.trail = {t0: tThrow, t1: tCatch}; ret.tThrow = tThrow; ret.tCatch = tCatch; ret.qb = qb; ret.tgt = tgt;
    ret.events.push({t: tCatch, kind: k === 'inc' ? 'inc' : 'catch'});
    ret.focus = t => t < tThrow ? L + dir * 3 : ballFn(t)[0];
  } else if (k === 'sack') {
    const sacker = F.filter(a => a.team === def && a.role === 'dl')[Math.floor(r() * 4)] || F[11];
    const nm = (p.x.match(/sacked by ([A-Z][\w'.-]+)/) || [])[1]; if (nm && sacker) { sacker.short = nm; sacker.num = numFor(def, nm) ?? sacker.num; }
    const endX = X(p.e ?? (p.y + 7));
    qb.path = kf([[0, qb.x, qb.y], [.1, qb.x, qb.y], [.5, qb.x - dir * 3, qb.y], [.75, endX, qb.y + (r() - .5) * 2], [1, endX, qb.y + (r() - .5) * 2]]);
    blockers(off, .5, -dir * 1.5); blockers(def, .5, -dir * 2.5);
    sacker.path = kf([[0, sacker.x, sacker.y], [.1, sacker.x, sacker.y], [.75, endX + dir * .5, qb.y], [1, endX + dir * .2, qb.y]]);
    F.filter(a => a.team === off && ['wr', 'te', 'rb'].includes(a.role)).forEach(a => { const dpt = 5 + r() * 10; a.path = kf([[0, a.x, a.y], [.1, a.x, a.y], [.75, a.x + dir * dpt, a.y], [1, a.x + dir * (dpt - 1), a.y]]); });
    carrierFn = t => t >= .1 ? qb : null; ret.dur = 2300; ret.events.push({t: .75, kind: 'hit'});
    ballFn = t => { const c_ = carrierFn(t); if (!c_) return [L - dir * .5, CYW, .3, 0]; const [x, y] = c_.path(t); return [x + dir * .2, y - .3, t > .75 ? .6 : 1.4, 0]; };
    ret.focus = t => qb.path(t)[0];
  } else if (k === 'run' || k === 'kneel' || (k === 'td' && p.carrier) || (k === 'fum' && p.carrier) || k === 'saf' || (k === 'td' && p.td_def && !p.target && !p.punt && !isKO)) {
    const scramble = p.carrier && qb && shortName(p.carrier) === qb.short;
    const runner = scramble ? qb : (byName(off, p.carrier) || rb);
    if (p.carrier && runner && shortName(p.carrier) !== runner.short) { runner.short = shortName(p.carrier); runner.num = numFor(off, p.carrier); }
    const endYl = k === 'td' ? -1.5 : (p.e ?? p.y), lane = /left/.test(p.x) ? 1 : /right/.test(p.x) ? -1 : 0;
    const holeY = qb.y + dir * lane * (2 + r() * 3);
    const endY = clamp(holeY + dir * lane * (Math.abs((p.gain || 0)) * .25) + (r() - .5) * 6, 2, FW - 2);
    if (k === 'kneel') { qb.path = kf([[0, qb.x, qb.y], [.2, L - dir * 1.8, qb.y], [1, L - dir * 1.8, qb.y]]); ret.dur = 1300; carrierFn = t => t > .1 ? qb : null;
      ballFn = t => { const [x, y] = qb.path(t); return t < .1 ? [L - dir * .5, CYW, .3, 0] : [x + dir * .3, y, .5, 0]; }; }
    else {
      ret.dur = 2300 + Math.min(1600, Math.abs(p.gain || 0) * 45);
      if (!scramble) {
        const mesh = [qb.x - dir * .6, qb.y - dir * lane * .6];
        qb.path = kf([[0, qb.x, qb.y], [.08, qb.x, qb.y], [.16, mesh[0], mesh[1]], [.5, mesh[0] - dir * 1.5, mesh[1] - dir * lane * 2], [1, mesh[0] - dir * 2, mesh[1] - dir * lane * 2]]);
        runner.path = kf([[0, runner.x, runner.y], [.1, runner.x, runner.y], [.18, mesh[0] + dir * .4, mesh[1]], [.4, L - dir * .4, holeY], [1, X(endYl), endY]]);
      } else {
        runner.path = kf([[0, runner.x, runner.y], [.1, runner.x, runner.y], [.32, runner.x - dir * 2, runner.y], [.55, L, holeY], [1, X(endYl), endY]]);
      }
      blockers(off, .45, dir * 1.6); blockers(def, .45, -dir * .8);
      F.filter(a => a.team === off && ['wr', 'te'].includes(a.role)).forEach(a => { a.path = kf([[0, a.x, a.y], [.1, a.x, a.y], [.6, a.x + dir * (3 + r() * 5), a.y + (r() - .5) * 3]]); });
      pursue(def, X(endYl), endY, .35, k === 'td' ? 3.5 : 1.5, k === 'td' ? .75 : 1, runner.path);
      carrierFn = t => t >= .17 ? runner : (t >= .08 ? qb : null);
      ballFn = t => { if (t < .08) return [L - dir * .5, CYW, .3, 0]; const c_ = carrierFn(t); const [x, y] = c_.path(t); return [x + dir * .25, y - .25, 1.0, 0]; };
    }
    ret.focus = t => ballFn(t)[0];
    if (k === 'fum') ret.events.push({t: .96, kind: 'fumble'});
  } else if (k === 'punt' || (k === 'td' && p.punt)) {
    const punter = find(off, a => a.role === 'punter'), retn = find(def, a => a.role === 'returner');
    const land = k === 'td' ? X(p.y - 45) : X(p.e ?? (p.y - 42));
    const fin = k === 'td' ? losX(100, p.r) - dir * 2 : land;
    retn.x = land; retn.y = CYW; retn.path = kf([[0, land, CYW], [.62, land, CYW], [1, fin + (k === 'td' ? 0 : dir * 1.5), CYW + (r() - .5) * 8]]);
    F.filter(a => a.team === off && a.role !== 'punter').forEach(a => { const b = [a.x, a.y]; a.path = kf([[0, b[0], b[1]], [.18, b[0], b[1]], [1, lerp(b[0], land, .85), lerp(b[1], CYW, .4)]]); });
    F.filter(a => a.team === def && a.role !== 'returner').forEach(a => { const b = [a.x, a.y]; a.path = kf([[0, b[0], b[1]], [.2, b[0] + dir * 1, b[1]], [1, lerp(b[0], land, .6), lerp(b[1], CYW, .3)]]); });
    ret.dur = 3600; ret.zoom = .7;
    ballFn = t => { if (t < .08) return [L - dir * .5, CYW, .3, 0]; if (t < .18) { const u = (t - .08) / .1; return [lerp(L, punter.x, u), lerp(CYW, punter.y, u), .8, 0]; }
      if (t < .62) { const u = (t - .18) / .44; return [lerp(punter.x, land, u), CYW, 1.5 + Math.sin(Math.PI * u) * 16, u * 9]; }
      const [x, y] = retn.path(t); return [x, y - .2, 1, 0]; };
    carrierFn = t => t >= .62 ? retn : null; ret.trail = {t0: .18, t1: .62};
    ret.focus = t => ballFn(t)[0]; ret.events.push({t: .18, kind: 'kick'});
  } else if (isKO) {
    const kicker = F.find(a => a.role === 'kicker'), retn = F.find(a => a.role === 'returner');
    const st = k === 'td' ? -1 : (p.e ?? 70), recX = yl => losX(clamp(yl, -9, 109), p.r);
    const land = st === 65 ? recX(103) : recX(Math.min(97, st + 22 + r() * 6));
    retn.path = kf([[0, retn.x, retn.y], [.5, land, CYW + (r() - .5) * 4], [st === 65 ? .9 : 1, st === 65 ? land : recX(st), CYW + (r() - .5) * 10]]);
    kicker.path = kf([[0, kicker.x, kicker.y], [.12, recX(35), CYW], [1, recX(55), CYW]]);
    F.filter(a => a.role === 'cov').forEach(a => { a.path = kf([[0, a.x, a.y], [.45, a.x, a.y], [1, lerp(a.x, recX(st === 65 ? 80 : st), .9), lerp(a.y, CYW, .5)]]); });
    F.filter(a => a.role === 'blk').forEach(a => { a.path = kf([[0, a.x, a.y], [.45, a.x, a.y], [1, lerp(a.x, recX(st === 65 ? 80 : st), .7), lerp(a.y, CYW, .3)]]); });
    ret.dur = 3600; ret.zoom = .66;
    ballFn = t => { if (t < .12) return [recX(35), CYW, .2, 0]; if (t < .5) { const u = (t - .12) / .38; return [lerp(recX(35), land, u), CYW, .4 + Math.sin(Math.PI * u) * 19, u * 10]; }
      const [x, y] = retn.path(t); return [x, y - .2, 1, 0]; };
    carrierFn = t => t >= .5 ? retn : null; ret.trail = {t0: .12, t1: .5};
    ret.focus = t => ballFn(t)[0]; ret.events.push({t: .12, kind: 'kick'});
  } else if (k === 'fg' || k === 'fgx' || k === 'xp') {
    const holder = find(off, a => a.role === 'holder'), kicker = find(off, a => a.role === 'kicker');
    const good = k === 'fg' || (k === 'xp' && !/NO GOOD/.test(p.x)), postX = losX(-10.3, p.r);
    const missY = good ? CYW : CYW + (r() < .5 ? 1 : -1) * (3.6 + r() * 3);
    kicker.path = kf([[0, kicker.x, kicker.y], [.18, kicker.x, kicker.y], [.26, holder.x - dir * .6, holder.y - .4], [1, holder.x - dir * .2, holder.y - .4]]);
    blockers(off, .4, -dir * .4); blockers(def, .4, -dir * 1.2);
    ret.dur = 2700; ret.zoom = .8;
    ballFn = t => { if (t < .08) return [L - dir * .5, CYW, .3, 0]; if (t < .26) { const u = Math.min(1, (t - .08) / .08); return [lerp(L, holder.x, u), lerp(CYW, holder.y, u), .3, 0]; }
      const u = clamp((t - .26) / .6, 0, 1); return [lerp(holder.x, postX, u), lerp(holder.y, missY, u), .3 + Math.sin(Math.PI * u * .62) * 14 + u * 2, u * 12]; };
    ret.trail = {t0: .26, t1: .86}; ret.focus = t => lerp(L, postX, clamp((t - .26) / .6, 0, 1) * .7);
    ret.events.push({t: .26, kind: 'kick'}, {t: .86, kind: good ? 'good' : 'nogood'});
  } else if (k === 'pen') {
    const ny = X(p.e ?? p.y);
    ret.dur = 1700; ret.flag = [L + dir * 2, CYW + 6, 0];
    F.forEach(a => { a.path = kf([[0, a.x, a.y], [.12, a.x + (a.team === off ? dir : -dir) * .6, a.y], [1, a.x + (a.team === off ? dir : -dir) * .5, a.y]]); });
    ballFn = t => [lerp(L - dir * .5, ny - dir * .5, clamp((t - .6) / .4, 0, 1)), CYW, .3, 0];
    ret.events.push({t: .1, kind: 'flag'});
    ret.focus = () => L;
  } else {
    ret.dur = 1200;
  }
  ret.ball = ballFn; ret.carrier = carrierFn;
  ret.focus = ret.focus || (t => ballFn(t)[0]);
  return ret;
}

// ================================================================ playback state machine
// phases per play: 'pre' (huddle -> set, play clock, game clock ticks) -> 'live' (the snap) -> 'post' (whistle, result)
function trackMotion(A, actors, now) {
  // per-player speed and stride phase (legs move with the player's own speed, not in lockstep)
  const dt = A.lastNow ? Math.max(1e-3, (now - A.lastNow) / 1000) : 0.016;
  A.prevPos = A.prevPos || actors.map(a => [a.x, a.y]); A.legs = A.legs || actors.map((_, i) => i * 1.7);
  actors.forEach((a, i) => { const pp = A.prevPos[i] || [a.x, a.y]; const vx = (a.x - pp[0]) / dt, vy = (a.y - pp[1]) / dt, spd = Math.hypot(vx, vy);
    A.legs[i] += Math.min(spd, 40) * dt * 1.15; a.leg = A.legs[i]; a.spd = spd; a.vx = vx; A.prevPos[i] = [a.x, a.y]; });
  A.lastNow = now;
}

function stepAnim(now) {
  const A = W.anim, d = W.data;
  if (!A) return W.rest || {};
  const el = (now - A.t0) * W.speed;
  const p = W.P[A.j];
  if (A.phase === 'event') {
    if (el >= A.hold) { W.anim = null; banner(null);
      if (A.j >= W.P.length - 1) { stopPlay(); showFinal(); }
      else if (A.chain && W.playing) startAnim(A.j + 1, true); }
    return {...(W.rest || {}), ez: endzones((W.P[A.j + 1] || p).q)};
  }
  if (A.phase === 'pre') {
    const u = clamp(el / A.pre, 0, 1);
    const st = {...A.setState};
    st.actors = A.ch.actors.map((a, i) => {
      const from = A.from[i], to = a.path(0), hud = A.huddle ? A.huddle[i] : null;
      let x, y;
      if (hud) {             // jog back to the huddle, call the play, break and set
        if (u < .38) { const v = ease(u / .38); x = lerp(from[0], hud[0], v); y = lerp(from[1], hud[1], v); }
        else if (u < .55) { x = hud[0]; y = hud[1]; }
        else { const v = ease((u - .55) / .45); x = lerp(hud[0], to[0], v); y = lerp(hud[1], to[1], v); }
      } else { const v = ease(u); x = lerp(from[0], to[0], v); y = lerp(from[1], to[1], v); }
      const facing = a.team === teamsOf(p).off ? (p.r ? 1 : -1) : (p.r ? -1 : 1);
      return {...a, x, y, facing, pose: (u > .84 && ['ol', 'dl', 'te', 'line', 'block', 'rush'].includes(a.role)) ? 'set' : null};
    });
    trackMotion(A, st.actors, now);
    st.ball = A.ch.ball(0);
    if (A.clockFrom != null) setClock(lerp(A.clockFrom, p.c, clamp(u * 1.05, 0, 1)));
    const pc = Math.round(lerp(A.pcFrom, A.pcTo, u)); const pce = $('#sbPC'); if (pce) { pce.textContent = A.showPC ? `:${String(pc).padStart(2, '0')}` : ''; pce.classList.toggle('low', pc <= 5); }
    st.focusX = A.focusPre; st.zoom = 1;
    st.fade = A.cut ? clamp(1 - (now - A.cut) / 380, 0, 1) : 0;
    if (u >= 1) { A.phase = 'live'; A.t0 = now; SND.snap(); if (W.speed <= 2) caption(callLine(p, A.j, 'snap'), p, false); }
    return st;
  }
  if (A.phase === 'live') {
    const t = W.freeze != null ? W.freeze : clamp(el / A.ch.dur, 0, 1);
    while (A.ev < A.ch.events.length && A.ch.events[A.ev].t <= t) { onEvent(A.ch.events[A.ev], p); A.ev++; }
    const cr = A.ch.carrier(t);
    const st = {...A.setState};
    const offT = teamsOf(p).off;
    st.actors = A.ch.actors.map(a => { const [x, y] = a.path(t); const facing = a.team === offT ? (p.r ? 1 : -1) : (p.r ? -1 : 1);
      let pose = null;
      if (t < .07 && ['ol', 'dl', 'te', 'line', 'block', 'rush'].includes(a.role)) pose = 'set';
      if (A.ch.tThrow != null && a === A.ch.qb && Math.abs(t - A.ch.tThrow) < .06) pose = 'throw';
      if (A.ch.tCatch != null && a === A.ch.tgt && t > A.ch.tCatch - .06 && t < A.ch.tCatch + .02) pose = 'catch';
      return {...a, x, y, hl: a === cr, facing, pose}; });
    trackMotion(A, st.actors, now);
    st.ball = A.ch.ball(t);
    if (A.ch.trail && t >= A.ch.trail.t0) { const n = 18, t1 = Math.min(t, A.ch.trail.t1); st.trail = []; for (let q = 0; q <= n; q++) { const tt = lerp(A.ch.trail.t0, t1, q / n); st.trail.push(A.ch.ball(tt)); } }
    st.flag = A.ch.flag && t > .1 ? A.ch.flag : null;
    if (cr && t > .2) { const [x, y] = cr.path(t); st.tag = {x, y, txt: cr.short + (cr.num != null ? ` #${cr.num}` : ''), col: tc(cr.team)}; }
    st.focusX = A.ch.focus(t); st.zoom = A.ch.zoom || 1; st.live = true;
    if (t >= 1) {
      A.phase = 'post'; A.t0 = now;
      A.endActors = st.actors.map(a => [a.x, a.y]); A.endVel = st.actors.map(a => [(a.vx || 0), 0]); A.endBall = st.ball;
      // the ball carrier goes down at the end of a tackled play (not on scores, incompletions or kicks)
      const tackled = ['run', 'pass', 'sack', 'fum', 'int', 'kneel', 'saf'].includes(p.k) || (p.k === 'punt' && !/Touchback|Fair catch/.test(p.x)) || (p.k === 'ko' && p.e !== 65);
      A.downIdx = tackled && cr ? A.ch.actors.indexOf(cr) : -1;
      if (A.downIdx >= 0) { const c0 = A.endActors[A.downIdx]; let best = -1, bd = 1e9;
        A.ch.actors.forEach((a, i) => { if (a.team !== cr.team) { const dd = Math.hypot(A.endActors[i][0] - c0[0], A.endActors[i][1] - c0[1]); if (dd < bd) { bd = dd; best = i; } } });
        A.tackler = bd < 2.5 ? best : -1; }
      finishPlay(A.j);
    }
    return st;
  }
  // post: whistle, players pull up, the tackled man is on the turf
  const st = {...A.setState};
  const u = clamp(el / A.post, 0, 1);
  const cele = p.k === 'td' || p.k === 'fg';
  const scorers = p.k === 'td' && p.td_def ? teamsOf(p).def : teamsOf(p).off;
  st.actors = A.ch.actors.map((a, i) => { const e = A.endActors[i], drift = Math.min(1.2, Math.abs(A.endVel[i][0]) * .08) * (1 - Math.exp(-u * 4));
    const party = cele && a.team === scorers && (i % 3 !== 1);
    return {...a, x: e[0] + Math.sign(A.endVel[i][0]) * drift * (i === A.downIdx ? 0 : 1), y: e[1], down: i === A.downIdx || (i === A.tackler && u < .6),
      pose: party ? 'cele' : null, jump: party ? Math.abs(Math.sin(now / 160 + i)) * .55 : 0}; });
  trackMotion(A, st.actors, now);
  st.ball = A.endBall; st.focusX = A.endBall ? A.endBall[0] : A.focusPre; st.zoom = 1;
  st.los = null;
  W.rest = {...st, actors: st.actors.map(a => ({...a, down: false}))};
  if (el >= A.post) {
    W.anim = null;
    if (A.chain && W.playing && A.j + 1 < W.P.length) startAnim(A.j + 1, true);
    else if (A.j >= W.P.length - 1) { stopPlay(); showFinal(); }
  }
  return st;
}

function onEvent(e, p) {
  if (e.kind === 'catch') SND.crowd(.25, .4);
  if (e.kind === 'inc') SND.crowd(-.1, .3);
  if (e.kind === 'int' || e.kind === 'fumble') SND.crowd(.6, 1.2);
  if (e.kind === 'kick') SND.thump();
  if (e.kind === 'good') SND.crowd(.5, 1);
  if (e.kind === 'flag') SND.whistle(.3);
}

function setClock(c) { const e = $('#sbC'); if (e) e.textContent = clockTxt(c); }

function huddleSpots(p) {
  // offense huddles about 7 yards behind the ball, defense gathers a few yards off it
  const dir = p.r ? 1 : -1, L = losX(p.y ?? 75, p.r), {off} = teamsOf(p);
  return (team, k) => { const isOff = team === off; const cx = isOff ? L - dir * 7.5 : L + dir * 5.5;
    const ang = (k / 11) * 2 * Math.PI + (isOff ? 0 : .3), rad = isOff ? 1.8 : 3.2;
    return [cx + Math.cos(ang) * rad * (isOff ? 1 : .9), clamp(CYW + Math.sin(ang) * rad * (isOff ? 1.1 : 2.2), 3, FW - 3)]; };
}

function startAnim(j, chain) {
  const P = W.P, p = P[j]; if (!p) return;
  const d = W.data;
  banner(null);
  // non-play events (timeouts, quarter ends, two-minute warning...): show and move on
  if (!SCRIMK.includes(p.k) && !['ko', 'xp', 'two'].includes(p.k) && !(p.k === 'td')) {
    renderBoard(j, p); W.i = j; renderWP(j + 1); drawPane();
    const B = {qend: [p.x.replace('.', '').toUpperCase(), '#2a3a33', `${d.away} ${p.s[1]} – ${d.home} ${p.s[0]}`], '2mw': ['TWO-MINUTE WARNING', '#2a3a33', ''],
      timeout: [p.x.replace(/ at .*/, '').replace('.', '').toUpperCase(), '#2a3a33', ''], ot: ['OVERTIME', '#2a3a33', 'Both teams get the ball'], start: ['KICKOFF', '#2a3a33', p.x],
      end: ['FINAL', '#2a3a33', `${d.away} ${p.s[1]} – ${d.home} ${p.s[0]}`]}[p.k];
    if (B) banner(B[0], B[1], B[2]);
    if (p.k === 'qend') SND.whistle(.5);
    caption(p.x, p, true);
    W.token++;
    W.anim = {j, phase: 'event', t0: NOW(), hold: (p.k === 'qend' || p.k === 'end' || p.k === 'ot' ? 2600 : 1400), chain};
    return;
  }
  W.token++;
  const ch = choreograph(p, j);
  const prev = W.rest && W.rest.actors;
  const prevPlay = (() => { for (let q = j - 1; q >= 0; q--) if (SCRIMK.includes(P[q].k) || ['ko', 'xp', 'two'].includes(P[q].k)) return P[q]; return null; })();
  // a regular snap gets a huddle; kicks, PATs and two-point tries line up directly
  const regular = ['run', 'pass', 'inc', 'sack', 'int', 'fum', 'td', 'kneel', 'saf'].includes(p.k) && p.d != null && !p.spike && !(W.P[j - 1] && W.P[j - 1].k === 'pen' && W.P[j - 1].p === p.p && W.P[j - 1].d != null);
  const hs = regular ? huddleSpots(p) : null;
  const counts = {};
  const huddle = hs ? ch.actors.map(a => { counts[a.team] = (counts[a.team] || 0) + 1; return hs(a.team, counts[a.team] - 1); }) : null;
  let from = ch.actors.map((a, i) => {
    const m = prev && prev.find(q => q.team === a.team && q.num === a.num && q.num != null);
    return m ? [m.x, m.y] : null;
  });
  // broadcast cut instead of 22 players sprinting across the field: new quarter (teams switch ends), kicks, turnovers, long gains
  const target = ch.actors.map((a, i) => huddle ? huddle[i] : a.path(0));
  const known = from.filter(Boolean).length;
  const meanMove = known ? from.reduce((acc, f, i) => acc + (f ? Math.hypot(f[0] - target[i][0], f[1] - target[i][1]) : 0), 0) / known : 99;
  const cut = !prev || known < 16 || meanMove > 20 || !prevPlay || prevPlay.q !== p.q || ['ko'].includes(p.k);
  if (cut) from = target.map(t => [t[0], t[1]]);
  else from = from.map((f, i) => f || target[i]);
  const setState = boardState(p);
  const running = prevPlay && prevPlay.q === p.q && prevPlay.c > p.c && !['td', 'fg', 'xp', 'two'].includes(prevPlay.k);
  const pre = huddle ? 2600 : (['ko', 'xp', 'two', 'fg', 'fgx'].includes(p.k) ? 1100 : 1500);
  const focusPre = setState.los ?? (p.y != null ? losX(p.y, p.r) : (W.rest?.focusX ?? 60));
  if (cut) { TV.camX = clamp(focusPre, 18, 102); TV.camY = CYW; TV.camZ = 0; }
  W.anim = {j, phase: 'pre', t0: NOW(), pre, post: 1300, ch, from, huddle, setState, chain, ev: 0, cut: cut ? NOW() : null,
    clockFrom: running ? prevPlay.c : null, pcFrom: 40, pcTo: running ? Math.max(1, 40 - Math.round((prevPlay.c - p.c) * .6)) : 15, showPC: SCRIMK.includes(p.k),
    focusPre};
  renderBoard(j, p);
  caption(callLine(p, j, 'pre'), p, false);
}

function boardState(p) {
  const d = W.data;
  const st = {ez: endzones(p.q)};
  if (p.y != null && p.r != null && SCRIMK.includes(p.k) && p.k !== 'punt' && p.k !== 'fg' && p.k !== 'fgx') {
    st.los = losX(p.y, p.r); st.dir = p.r ? 1 : -1;
    if (p.d && p.g != null && p.y - p.g > 0) st.fdl = losX(p.y - p.g, p.r);
    if (p.d) st.ddTxt = `${ORD(p.d).toUpperCase()} & ${p.g != null && p.y <= p.g ? 'GOAL' : p.g}`;
  } else if (p.y != null && p.r != null && ['punt', 'fg', 'fgx'].includes(p.k)) { st.los = losX(p.y, p.r); st.dir = p.r ? 1 : -1; }
  return st;
}
function endzones(q) { const d = W.data, homeAttRight = q === 1 || q === 3 || q === 5; return homeAttRight ? [d.home, d.away] : [d.away, d.home]; }

function finishPlay(j) {
  const p = W.P[j], d = W.data;
  W.i = j;
  renderBoard(j + 1, W.P[j + 1] && W.P[j + 1].q === p.q ? W.P[j + 1] : p, true);
  renderWP(j + 1); drawPane();
  caption(callLine(p, j, 'result'), p, true);
  const who = p.target && (p.comp || p.k === 'td' || p.k === 'fum') ? p.target : p.carrier;
  if (who && (p.p === 0 || p.p === 1) && !p.td_def) { const ps = playerStats(j + 1), x = ps[(p.p === 0 ? d.home : d.away) + '|' + shortName(who)];
    if (x) { const el = $('#lower .ltxt'); if (el) el.insertAdjacentHTML('beforeend', `<div class="lstat"><b>${esc(x.n)}</b> ${esc(statLine(x))} · <b class="lfp">${fx(x.fp, 1)} FPTS</b></div>`); } }
  SND.whistle(.25);
  const team = p.p === 0 ? d.home : p.p === 1 ? d.away : null, opp = p.p === 0 ? d.away : d.home;
  const B = {td: ['TOUCHDOWN', p.td_def ? tc(opp) : tc(team), p.td_def ? `${nmTeam(opp)} defense` : nmTeam(team || '')],
    fg: ['FIELD GOAL', tc(team), `${p.dist_fg} yards`], fgx: ['NO GOOD', '#444', `${p.dist_fg}-yard try`], int: ['INTERCEPTED', tc(opp), ''],
    fum: ['FUMBLE', tc(opp), 'Turnover'], saf: ['SAFETY', tc(opp), '2 points']}[p.k];
  if (B) { banner(B[0], B[1], B[2]); SND.crowd(p.k === 'td' || p.k === 'int' ? 1 : .6, 2.2); if (W.anim) W.anim.post = (p.k === 'td' ? 2600 : 1800); }
  if (p.k === 'td') { const tm = p.td_def ? opp : team, cols = [tc(tm), tc(tm, 1), '#ffffff', '#ffd84d']; TV.parts = (TV.parts || []).concat(Array.from({length: 150}, (_, i) => ({x: TV.w / 2 + (Math.random() - .5) * 120, y: TV.h * .38, vx: (Math.random() - .5) * 520, vy: -180 - Math.random() * 320, r: Math.random() * 6, vr: (Math.random() - .5) * 12, life: 1.6 + Math.random(), col: cols[i % cols.length]}))); }
  if (p.to && p.k === 'inc') { banner('TURNOVER ON DOWNS', '#444', ''); if (W.anim) W.anim.post = 1700; }
  if (p.k === 'two' || p.k === 'xp') { if (W.anim) W.anim.post = 900; }
  // drive summary graphic when a possession ends
  if (W.anim && ['td', 'fg', 'fgx', 'punt', 'int', 'fum'].includes(p.k) && !p.td_def) {
    const dv = drives(j + 1).filter(x => x.t === p.p).pop();
    if (dv && dv.plays >= 3) setTimeout(() => lowerThird(`${team} DRIVE`, `${dv.plays} plays · ${(dv.start ?? 0) - (dv.end ?? 0)} yards · ${clockTxt(Math.round(dv.c1 - dv.c0))} · ${dv.res}`, tc(team)), 900 / W.speed);
  }
}

// ---------------------------------------------------------------- broadcast copy
function callLine(p, j, phase) {
  const d = W.data, team = p.p === 0 ? d.home : p.p === 1 ? d.away : null, opp = p.p === 0 ? d.away : d.home;
  const r = rng(j * 31 + (phase === 'pre' ? 1 : 2));
  const pick = a => a[Math.floor(r() * a.length)];
  const spot = p.y == null ? '' : p.y === 50 ? 'midfield' : p.y > 50 ? `${team} ${100 - p.y}` : `${opp} ${p.y}`;
  if (phase === 'pre') {
    if (p.k === 'ko') return `${nmTeam(opp)} kicking off to ${nmTeam(team)}.`;
    if (p.k === 'xp') return `${nmTeam(team)} will try the extra point.`;
    if (p.k === 'two') return `${nmTeam(team)} going for two!`;
    if (p.k === 'punt') return pick([`Fourth down. ${nmTeam(team)} will punt it away.`, `${nmTeam(team)} sends out the punt team.`]);
    if (p.k === 'fg' || p.k === 'fgx') return `${p.dist_fg}-yard field-goal attempt coming up.`;
    if (p.d) { const dd = `${ORD(p.d)} and ${p.g != null && p.y <= p.g ? 'goal' : p.g}`; return pick([`${dd} for ${nmTeam(team)} at the ${spot}.`, `${nmTeam(team)} ball, ${dd}, ${spot}.`, `${dd}. ${nmTeam(team)} lines up at the ${spot}.`]); }
    return '';
  }
  if (phase === 'snap') {
    const qbn = (p.x.split(' ')[0] || '').replace(/\.$/, '');
    if (['pass', 'inc', 'int'].includes(p.k) || (p.k === 'td' && p.comp)) return pick([`${qbn} drops back…`, `Shotgun snap, ${qbn} looks downfield…`, `${qbn} in the pocket…`]);
    if (p.k === 'sack') return `${qbn} drops back… pressure!`;
    if (p.k === 'run' || (p.k === 'td' && p.carrier)) { const c_ = p.carrier ? shortName(p.carrier) : ''; return c_ && c_ === qbn ? pick([`${qbn} keeps it…`, `${qbn} takes off…`]) : pick(['Handoff…', 'They hand it off…', `Give to ${c_.split('.').pop()}…`]); }
    if (p.k === 'punt') return 'Snap to the punter…'; if (p.k === 'fg' || p.k === 'fgx' || p.k === 'xp') return 'The snap, the hold, the kick…';
    return '';
  }
  // result: broadcast-style call of the play
  const g = p.gain ?? 0, carrier = p.carrier ? shortName(p.carrier) : null, target = p.target ? shortName(p.target) : null, qbn = (p.x.split(' ')[0] || '');
  if (p.k === 'td') {
    if (p.td_def) return `${p.x.replace(' TOUCHDOWN!', '')} ${pick(['Pick-six!', 'The defense scores!', 'What a turnaround!'])}`;
    if (p.comp || target) return `${qbn} finds ${target} — ${pick(['TOUCHDOWN!', 'he is IN! Touchdown!', 'six points!'])} ${g} yards.`;
    return `${carrier} ${pick(['punches it in!', 'walks in for the score!', 'breaks the plane — touchdown!'])} ${g > 10 ? `${g} yards!` : ''}`;
  }
  if (p.k === 'pass') return g >= 20 ? `${qbn} ${pick(['airs it out', 'lets it fly'])}… ${target} hauls it in! ${g} yards${p.fd ? ' and a first down' : ''}.` :
    `${qbn} to ${target} for ${g === 0 ? 'no gain' : g + ' yard' + (g === 1 ? '' : 's')}${p.fd ? ' — first down!' : '.'}`;
  if (p.k === 'inc') return p.spike ? `${qbn} spikes it to stop the clock.` : `${qbn} looking for ${target}… ${pick(['incomplete.', 'broken up!', 'off the fingertips.', 'overthrown.'])}`;
  if (p.k === 'int') return `${qbn} throws… ${pick(['INTERCEPTED!', 'picked off!'])} ${(p.x.match(/by ([A-Z][\w'.-]+)/) || [])[1] || ''} with the takeaway.`;
  if (p.k === 'sack') return `${qbn} is SACKED${(p.x.match(/sacked by ([A-Z][\w'.-]+)/) || [])[1] ? ' by ' + p.x.match(/sacked by ([A-Z][\w'.-]+)/)[1] : ''}! Loss of ${-g}.`;
  if (p.k === 'run') return g >= 12 ? `${carrier} ${pick(['breaks free', 'bounces it outside', 'finds a crease'])}… ${g} yards!${p.fd ? ' First down.' : ''}` : g <= 0 ? `${carrier} ${pick(['stuffed at the line.', 'goes nowhere.', 'met in the backfield.'])}` :
    `${carrier} ${pick(['picks up', 'grinds out', 'gets'])} ${g}${p.fd ? ' — first down!' : '.'}`;
  if (p.k === 'kneel') return `${qbn} takes a knee.`;
  return p.x;
}

function caption(txt, p, result) {
  const el = $('#lower'); if (!el) return;
  const d = W.data, team = p && (p.p === 0 ? d.home : p.p === 1 ? d.away : null);
  if (!txt) { el.className = 'lower'; return; }
  const chips = [];
  if (result && p) { if (p.gain != null && ['run', 'pass', 'sack', 'td'].includes(p.k)) chips.push(`<span class="cc ${p.gain >= 0 ? 'g' : 'b'}">${p.gain >= 0 ? '+' : ''}${p.gain} YDS</span>`);
    if (p.fd) chips.push('<span class="cc y">1ST DOWN</span>'); if (p.pen) chips.push('<span class="cc y">FLAG</span>'); if (p.to) chips.push('<span class="cc b">TURNOVER</span>'); }
  el.innerHTML = `<div class="lbar" style="background:${team ? tc(team) : '#333'}"></div><div class="ltxt">${esc(txt)}</div>${chips.length ? `<div class="lchips">${chips.join('')}</div>` : ''}`;
  el.className = 'lower on';
}
function lowerThird(title, sub, col) {
  const el = $('#wbanner'); if (!el || el.classList.contains('on')) return;
  el.innerHTML = `<div class="l3" style="--bc:${col}"><b>${esc(title)}</b><span>${esc(sub)}</span></div>`; el.className = 'wbanner on l3w';
  const tok = W.token; setTimeout(() => { if (W.token === tok || true) { const e2 = $('#wbanner'); if (e2 && e2.classList.contains('l3w')) e2.className = 'wbanner'; } }, 2200 / Math.max(1, W.speed / 2));
}
function banner(txt, color, sub) {
  const b = $('#wbanner'); if (!b) return;
  if (!txt) { b.className = 'wbanner'; return; }
  b.innerHTML = `<div class="big" style="--bc:${color}"><b>${esc(txt)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
  b.className = 'wbanner on';
}

// ---------------------------------------------------------------- scorebug
function renderBoard(k, p, after) {
  const d = W.data, prev = k > 0 ? W.P[k - 1] : null, score = prev ? prev.s : [0, 0];
  $('#sbH').textContent = score[0]; $('#sbA').textContent = score[1];
  const to = timeouts(k);
  $('#toH').innerHTML = [0, 1, 2].map(j => `<i class="${j < to[0] ? 'on' : ''}"></i>`).join('');
  $('#toA').innerHTML = [0, 1, 2].map(j => `<i class="${j < to[1] ? 'on' : ''}"></i>`).join('');
  if (!p || k >= W.P.length) { const last = W.P[W.P.length - 1]; $('#sbQ').textContent = last.q === 5 ? 'FINAL/OT' : 'FINAL'; $('#sbC').textContent = ''; $('#sbDD').textContent = ''; $('#pbH').classList.remove('on'); $('#pbA').classList.remove('on'); $('#sbPC').textContent = ''; return; }
  $('#sbQ').textContent = QNAME(p.q).toUpperCase(); if (!after || !W.anim) setClock(p.c);
  $('#pbH').classList.toggle('on', p.p === 0); $('#pbA').classList.toggle('on', p.p === 1);
  const team = p.p === 0 ? d.home : d.away, opp = p.p === 0 ? d.away : d.home;
  if (p.d && p.y != null && SCRIMK.includes(p.k) && !['punt', 'fg', 'fgx'].includes(p.k)) {
    const goal = p.g != null && p.y <= p.g + 0.01, spot = p.y === 50 ? '50' : (p.y > 50 ? `${team} ${100 - p.y}` : `${opp} ${p.y}`);
    $('#sbDD').textContent = `${ORD(p.d).toUpperCase()} & ${goal ? 'GOAL' : p.g} · ${spot}`;
  } else $('#sbDD').textContent = {ko: 'KICKOFF', xp: 'PAT', two: '2-PT TRY', punt: 'PUNT', fg: 'FIELD GOAL', fgx: 'FIELD GOAL', timeout: 'TIMEOUT', qend: 'END OF QTR', '2mw': '2:00 WARNING', start: 'COIN TOSS', end: 'FINAL', ot: 'OVERTIME'}[p.k] || '';
}
function timeouts(k) {
  const used = [0, 0], d = W.data, ref = W.P[Math.max(0, Math.min(k, W.P.length - 1))] || {q: 1};
  const half = ref.q >= 3 ? (ref.q === 5 ? 3 : 2) : 1;
  for (let j = 0; j < k && j < W.P.length; j++) { const p = W.P[j]; if (p.k !== 'timeout') continue; const h2 = p.q >= 3 ? (p.q === 5 ? 3 : 2) : 1; if (h2 !== half) continue;
    if (p.x.includes(`by ${d.home} `)) used[0]++; else if (p.x.includes(`by ${d.away} `)) used[1]++; }
  const max = half === 3 ? 2 : 3; return [Math.max(0, max - used[0]), Math.max(0, max - used[1])];
}

// ---------------------------------------------------------------- seek / play controls
function seek(k) {
  W.token++; W.anim = null;
  W.i = Math.max(-1, Math.min(k, W.P.length - 1));
  let nxt = W.P[W.i + 1];
  let n2 = W.i + 1; while (nxt && !SCRIMK.includes(nxt.k) && !['ko', 'xp', 'two'].includes(nxt.k) && n2 < W.P.length - 1) { n2++; nxt = W.P[n2]; }
  renderBoard(W.i + 1, W.P[W.i + 1] || null);
  if (nxt) { const ch = choreograph(nxt, n2); const st = boardState(nxt); W.rest = {...st, actors: ch.actors.map(a => { const [x, y] = a.path(0); return {...a, x, y}; }), ball: ch.ball(0), focusX: st.los ?? (nxt.y != null ? losX(nxt.y, nxt.r) : 60)}; }
  else W.rest = {ez: endzones(W.P[W.P.length - 1].q)};
  TV.camX = W.rest.focusX ?? 60;
  caption(W.i >= 0 ? W.P[W.i].x : null, W.P[W.i], true);
  renderWP(W.i + 1); drawPane(); banner(null);
  const intro = $('#wintro');
  if (W.i < 0) { const d = W.data, S = d.sims[W.si];
    intro.innerHTML = `<div><span class="eyebrow">Locksmith’s most likely game · ${esc(d.venue && d.venue.kick || '')}</span><h3>${esc(nmTeam(d.away))} at ${esc(nmTeam(d.home))}</h3><p>Every snap is simulated from real NFL play data with this week’s real lineups. Of ${d.dist.n} simulated games, this is the one that matches Locksmith’s projection best: score, yards, turnovers and winner.</p><button class="btn primary" id="wGo">▶ Watch live</button></div>`;
    intro.className = 'wintro on'; $('#wGo').onclick = () => { intro.className = 'wintro'; startPlay(); }; }
  else if (W.i >= W.P.length - 1) showFinal();
  else intro.className = 'wintro';
}
// the predicted final this simulation was chosen to end on (falls back to the game book, then to rounding)
const PFW = d => d.pred_final || PF((D.books.find(x => x.game_id === d.game_id) || {}).score) || [Math.round(d.proj[0]), Math.round(d.proj[1])];
function showFinal() {
  const intro = $('#wintro'); if (!intro) return;
  caption(null);
  const s = W.P[W.P.length - 1].s, d = W.data, win = s[0] > s[1] ? d.home : s[1] > s[0] ? d.away : null;
  renderBoard(W.P.length, null);
  intro.innerHTML = `<div><span class="eyebrow">Final${W.P[W.P.length - 1].q === 5 ? ' · overtime' : ''}</span><h3>${d.away} ${s[1]} – ${d.home} ${s[0]}</h3><p>${win ? `${esc(nmTeam(win))} win.` : 'A tie.'} Locksmith’s predicted final was ${d.away} ${PFW(d)[1]} – ${d.home} ${PFW(d)[0]}${PFW(d)[0] === s[0] && PFW(d)[1] === s[1] ? ' (right on the number)' : ''}, with ${esc(nmTeam(d.dist.p_home_win >= .5 ? d.home : d.away))} winning ${pct(Math.max(d.dist.p_home_win, 1 - d.dist.p_home_win))} of ${d.dist.n} simulated games.</p>
    ${(() => { const ps = Object.values(playerStats(W.P.length)).sort((a, z) => z.fp - a.fp), own = fantasyOwners(); const top = ps.slice(0, 5);
      const mine = ps.filter(x => own[x.team + '|' + x.n]);
      return `<div class="ftop"><span class="eyebrow">Top fantasy scorers</span>${top.map(x => `<div><b>${esc(x.n)}</b> <span class="muted">${x.team} ${x.pos}</span> <span class="num">${fx(x.fp, 1)}</span></div>`).join('')}
        ${mine.length ? `<span class="eyebrow" style="margin-top:6px">Your fantasy matchup</span>${mine.map(x => `<div><b>${esc(x.n)}</b> <span class="muted">${own[x.team + '|' + x.n] === 'you' ? 'yours' : 'opponent'}</span> <span class="num">${fx(x.fp, 1)}</span></div>`).join('')}` : ''}</div>`; })()}
    <div class="row-flex"><button class="btn" id="wAgain">▶ Watch again</button></div></div>`;
  intro.className = 'wintro on'; const ag = $('#wAgain'); if (ag) ag.onclick = () => { seek(-1); startPlay(); };
}
function stepOnce() { if (W.i < W.P.length - 1) { W.playing = false; setPlayIcon(); startAnim(W.i + 1, false); } }
function togglePlay() { W.playing ? stopPlay() : startPlay(); }
function setPlayIcon() { const ic = $('#wPlayIc'); if (ic) ic.innerHTML = W.playing ? '<path d="M7 4h4v16H7zM14 4h4v16h-4z"/>' : '<path d="M7 4l13 8-13 8z"/>'; }
function startPlay() { if (W.i >= W.P.length - 1) seek(-1); W.playing = true; setPlayIcon(); const intro = $('#wintro'); if (intro) intro.className = 'wintro'; if (W.sound) SND.toggle(true); startAnim(W.i + 1, true); }
function stopPlay() { W.playing = false; setPlayIcon(); if (W.anim) W.anim.chain = false; }

// ================================================================ sound (Web Audio, synthesized: crowd, whistle, kick)
const SND = {
  ctx: null, crowdGain: null, on: false,
  toggle(on) { this.on = on; if (!on) { if (this.crowdGain) this.crowdGain.gain.setTargetAtTime(0, this.ctx.currentTime, .3); return; }
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      const len = this.ctx.sampleRate * 3, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), x = buf.getChannelData(0); let b = 0;
      for (let i = 0; i < len; i++) { b = (b + .02 * (Math.random() * 2 - 1)) / 1.02; x[i] = b * 3.5; }
      const src = this.ctx.createBufferSource(); src.buffer = buf; src.loop = true; const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      this.crowdGain = this.ctx.createGain(); this.crowdGain.gain.value = 0; src.connect(lp); lp.connect(this.crowdGain); this.crowdGain.connect(this.ctx.destination); src.start(); }
    this.ctx.resume(); this.crowdGain.gain.setTargetAtTime(.10, this.ctx.currentTime, .5); },
  crowd(level, secs) { if (!this.on || !this.ctx) return; const g = this.crowdGain.gain, t = this.ctx.currentTime; g.cancelScheduledValues(t); g.setTargetAtTime(clamp(.1 + level * .35, .02, .55), t, .12); g.setTargetAtTime(.1, t + secs, .8); },
  whistle(len = .3) { if (!this.on || !this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), o2 = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = 2900; o2.frequency.value = 3150; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + .02); g.gain.setValueAtTime(.06, t + len); g.gain.linearRampToValueAtTime(0, t + len + .05);
    o.connect(g); o2.connect(g); g.connect(this.ctx.destination); o.start(t); o2.start(t); o.stop(t + len + .1); o2.stop(t + len + .1); },
  thump() { if (!this.on || !this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + .15);
    g.gain.setValueAtTime(.35, t); g.gain.exponentialRampToValueAtTime(.001, t + .2); o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + .25); },
  snap() { }
};

// ================================================================ side panels (win probability, play-by-play, stats, drives)
function scorer(p, k) { const prev = k > 0 ? W.P[k - 1].s : [0, 0]; return p.s[0] > prev[0] ? 0 : (p.s[1] > prev[1] ? 1 : (p.p ?? 0)); }
function wpCol(t) { return colFor(t); }
function _rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
function _lum(h) { const [r, g, b] = _rgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }
function _readable(h) { return _lum(h) < 0.25 ? hexLight(h, .5) : h; }
function colFor(t) {
  // chart / board colors: each team's own color lifted to be readable, and never two teams in near-identical colors
  const d = W.data; if (!d) return tc(t);
  if (!W._cols || W._cols.gid !== d.game_id) {
    const H = d.home, A = d.away, toHex = c => c.startsWith('rgb') ? '#' + c.match(/\d+/g).slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join('') : c;
    let ch = toHex(_readable(tc(H))), ca = toHex(_readable(tc(A)));
    const dist = (x, y) => { const a = _rgb(x), b = _rgb(y); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };
    if (dist(ch, ca) < 110) { ca = toHex(_readable(tc(A, 1))); if (dist(ch, ca) < 110 || _lum(ca) > .85) ca = '#f2994a'; }
    W._cols = {gid: d.game_id, [H]: ch, [A]: ca};
  }
  return W._cols[t] || tc(t);
}
function wpChart() {
  const P = W.P, d = W.data, Wd = 360, Hh = 150, pad = 8;
  const xs = t => pad + t / W.total * (Wd - 2 * pad), ys = w => pad + (1 - w) * (Hh - 2 * pad);
  W.wpxs = xs;
  const pts = [[0, P[0] ? P[0].w : .5]].concat(P.map(p => [tsec(p), p.w]));
  const path = pts.map(([t, w], k) => `${k ? 'L' : 'M'}${xs(t).toFixed(1)},${ys(w).toFixed(1)}`).join(' ');
  $('#wpChart').innerHTML = `<svg viewBox="0 0 ${Wd} ${Hh + 18}" width="100%"><defs>
      <clipPath id="wpclip"><rect id="wpclipr" x="0" y="0" width="0" height="${Hh}"/></clipPath>
      <clipPath id="wpTop"><rect x="0" y="0" width="${Wd}" height="${ys(.5)}"/></clipPath><clipPath id="wpBot"><rect x="0" y="${ys(.5)}" width="${Wd}" height="${Hh}"/></clipPath></defs>
    <rect x="0" y="0" width="${Wd}" height="${Hh}" fill="var(--panel2)" rx="6"/>
    ${[900, 1800, 2700].map(t => `<line x1="${xs(t)}" x2="${xs(t)}" y1="${pad}" y2="${Hh - pad}" stroke="var(--rule)"/>`).join('')}
    <line x1="${pad}" x2="${Wd - pad}" y1="${ys(.5)}" y2="${ys(.5)}" stroke="var(--muted)" stroke-dasharray="3 4" stroke-opacity=".7"/>
    <g clip-path="url(#wpclip)"><path d="${path} L${xs(W.total)},${ys(.5)} L${xs(0)},${ys(.5)} Z" fill="${wpCol(d.home)}" fill-opacity=".75" clip-path="url(#wpTop)"/>
      <path d="${path} L${xs(W.total)},${ys(.5)} L${xs(0)},${ys(.5)} Z" fill="${wpCol(d.away)}" fill-opacity=".75" clip-path="url(#wpBot)"/>
      <path d="${path}" fill="none" stroke="var(--ink)" stroke-width="2"/></g>
    <line id="wpcur" x1="0" x2="0" y1="${pad}" y2="${Hh - pad}" stroke="var(--accent)" stroke-width="2"/>
    <text x="${pad + 4}" y="${pad + 13}" font-size="12" fill="var(--ink2)" font-weight="700">${d.home} ▲</text><text x="${pad + 4}" y="${Hh - pad - 5}" font-size="12" fill="var(--ink2)" font-weight="700">${d.away} ▼</text>
    ${['Q1', 'Q2', 'Q3', 'Q4'].map((q, k) => `<text x="${xs(k * 900 + 450)}" y="${Hh + 13}" font-size="10.5" text-anchor="middle" fill="var(--muted)">${q}</text>`).join('')}</svg>`;
}
function amOdds(p) {
  // American moneyline with a standard 4.5% hold; books take a side off the board past 99%
  if (p >= .995) return '—'; if (p <= .005) return '—';
  const q = Math.min(.995, p + .0225);
  return q >= .5 ? `−${Math.round(100 * q / (1 - q) / 5) * 5}` : `+${Math.round(100 * (1 - q) / q / 5) * 5}`;
}
function liveAt(k) {
  // odds after play k-1 (k = number of plays completed)
  const d = W.data; if (k <= 0) return d.live_pre || {w: W.P[0]?.w ?? .5, ls: 0, lt: 45};
  const r = W.P[Math.min(k, W.P.length) - 1]; return {w: r.w ?? .5, ls: r.ls ?? 0, lt: r.lt ?? 45};
}
function renderOdds(k) {
  const d = W.data, H = d.home, A = d.away, o = liveAt(k), pr = liveAt(k - 1);
  const arrow = (now, was, good) => now === was || was == null ? '' : `<i class="mv ${(now > was) === good ? 'up' : 'dn'}">${now > was ? '▲' : '▼'}</i>`;
  const sp = v => v === 0 ? 'PK' : (v > 0 ? `+${v}` : `−${Math.abs(v)}`);
  const final = k >= W.P.length;
  const rows = [[A, 1 - o.w, -o.ls, 1 - pr.w, -pr.ls], [H, o.w, o.ls, pr.w, pr.ls]].map(([t, pw, spv, pw0, sp0]) => `<tr><td><b style="color:${wpCol(t)}">${t}</b></td>
      <td class="r num">${final ? '' : amOdds(pw)} ${final ? '' : arrow(pw, pw0, true)}</td><td class="r num">${final ? '' : sp(spv)}</td><td class="r num">${pct(pw)}</td></tr>`).join('');
  const ob = $('#oddsBoard'); if (!ob) return;
  ob.innerHTML = final ? `<p class="note">Final. Live betting closed.</p>` :
    `<div class="tbl"><table class="oddst"><thead><tr><th></th><th class="r">Moneyline</th><th class="r">Spread</th><th class="r">Win</th></tr></thead><tbody>${rows}</tbody></table></div>
     <div class="otot">Total <b class="num">${o.lt}</b> ${arrow(o.lt, pr.lt, true)} <span class="muted">· o/u, both −110</span></div>`;
  W.oddsTxt = final ? 'FINAL' : `LIVE  ${A} ${amOdds(1 - o.w)}  ${H} ${amOdds(o.w)}  ·  ${H} ${sp(o.ls)}  ·  O/U ${o.lt}`;
  const tk = $('#ticker'); if (tk) tk.innerHTML = final ? '' : `<span class="tl">LIVE</span><span>${A} <b>${amOdds(1 - o.w)}</b></span><span>${H} <b>${amOdds(o.w)}</b></span><span>${H} <b>${sp(o.ls)}</b></span><span>O/U <b>${o.lt}</b></span>`;
}
function renderWP(k) {
  renderOdds(k);
  const d = W.data, t = k <= 0 ? 0 : tsec(W.P[Math.min(k, W.P.length) - 1]);
  const w = k <= 0 ? (W.P[0] ? W.P[0].w : .5) : W.P[Math.min(k, W.P.length) - 1].w;
  const cr = $('#wpclipr'); if (!cr) return;
  cr.setAttribute('width', W.wpxs(t) + 1); $('#wpcur').setAttribute('x1', W.wpxs(t)); $('#wpcur').setAttribute('x2', W.wpxs(t));
  const fav = w >= .5 ? d.home : d.away;
  $('#wpNow').innerHTML = `<i class="wpdot" style="background:${wpCol(fav)}"></i>${esc(nmTeam(fav))} <span class="num">${pct(Math.max(w, 1 - w))}</span>`;
  $('#wtlfill').style.width = `${t / W.total * 100}%`; $('#wtlhead').style.left = `${t / W.total * 100}%`;
  $('#wtlm').innerHTML = W.P.slice(0, Math.max(0, k)).map((p, j) => (p.k === 'td' || p.k === 'fg' || p.k === 'saf' || (p.k === 'two' && p.two)) ? `<i title="${esc(p.x)}" style="left:${tsec(p) / W.total * 100}%;background:${tc(scorer(p, j) === 0 ? d.home : d.away)}"></i>` : '').join('');
}
function teamStats(k) {
  const P = W.P, T = [0, 1].map(() => ({plays: 0, yds: 0, py: 0, ry: 0, cmp: 0, att: 0, car: 0, fd: 0, td: 0, to: 0, sk: 0, pen: 0, peny: 0, top: 0, third: 0, thirdc: 0}));
  const pl = {};
  const P_ = (n, t) => (pl[n + '|' + t] = pl[n + '|' + t] || {n, t, cmp: 0, att: 0, py: 0, ptd: 0, int: 0, car: 0, ry: 0, rtd: 0, rec: 0, tgt: 0, yds: 0, recTd: 0});
  for (let j = 0; j < k && j < P.length; j++) {
    const p = P[j], t = p.p; if (t !== 0 && t !== 1) continue;
    const S = T[t], g = p.gain || 0, nm = p.x.split(' ')[0];
    const nxt = P[j + 1]; if (nxt && ['run', 'pass', 'inc', 'sack', 'int', 'fum', 'td', 'pen', 'kneel'].includes(p.k)) S.top += Math.max(0, tsec(nxt) - tsec(p));
    if (p.d === 3 && ['run', 'pass', 'inc', 'sack', 'int', 'fum', 'td'].includes(p.k)) { S.third++; if (p.fd || (p.k === 'td' && !p.td_def)) S.thirdc++; }
    if (p.k === 'pen') { const on0 = p.x.includes(`on ${W.data.home},`); const tt = on0 ? 0 : 1; T[tt].pen++; T[tt].peny += Math.abs((p.e ?? 0) - (p.y ?? 0)); continue; }
    const isPass = (p.k === 'pass' || (p.k === 'inc' && !p.spike) || p.k === 'int' || (p.k === 'td' && p.comp) || (p.k === 'fum' && p.target)) && !p.td_def;
    const isRun = (p.k === 'run' || (p.k === 'td' && p.carrier) || (p.k === 'fum' && p.carrier && !p.target)) && !p.td_def;
    if (p.fd) S.fd++;
    if (isPass || isRun || p.k === 'sack') S.plays++;
    if (isPass) { S.att++; const q = P_(nm, t); q.att++; if (p.comp || p.k === 'td' || (p.k === 'fum' && p.target)) { S.cmp++; q.cmp++; S.py += g; q.py += g; const r = P_(shortName(p.target), t); r.rec++; r.tgt++; r.yds += g; if (p.k === 'td') { q.ptd++; r.recTd++; } } else if (p.target) P_(shortName(p.target), t).tgt++; if (p.k === 'int') q.int++; }
    if (isRun) { S.car++; S.ry += g; const r = P_(shortName(p.carrier), t); r.car++; r.ry += g; if (p.k === 'td') r.rtd++; }
    if (p.k === 'sack') { S.sk++; S.py += g; }
    if (p.k === 'td' && !p.td_def) S.td++;
    if (p.to && ['int', 'fum'].includes(p.k)) S.to++;
  }
  T.forEach(S => S.yds = S.py + S.ry);
  return {T, pl: Object.values(pl)};
}
// ---------------------------------------------------------------- live player stats + fantasy points (your league's scoring)
const SCORING = () => (D.fantasy && D.fantasy.league && D.fantasy.league.scoring) || {pass_yd: .04, pass_td: 4, pass_int: -2, rush_yd: .1, rush_td: 6, rec: .5, rec_yd: .1, rec_td: 6, fum_lost: -2, bonus_rec_te: 0};
function posFor(team, short) {
  const R = W.roster[team]; if (!R) return '';
  const m = [...(R.skill || []), ...R.off].find(x => x && x.short === short); return m ? (m.slot || '') : '';
}
function fpts(x) {
  const S = SCORING();
  return (x.py || 0) * (S.pass_yd || 0) + (x.ptd || 0) * (S.pass_td || 0) + (x.int || 0) * (S.pass_int || 0) + (x.ry || 0) * (S.rush_yd || 0) + (x.rtd || 0) * (S.rush_td || 0)
    + (x.rec || 0) * (S.rec || 0) + (x.yds || 0) * (S.rec_yd || 0) + (x.recTd || 0) * (S.rec_td || 0) + (x.fl || 0) * (S.fum_lost || 0) + (x.pos === 'TE' ? (x.rec || 0) * (S.bonus_rec_te || 0) : 0);
}
function playerStats(k) {
  // every player's line after k plays: passing, rushing, receiving, turnovers, fantasy points
  const P = W.P, d = W.data, out = {};
  const get = (name, t) => { const n = shortName(name), team = t === 0 ? d.home : d.away, key = team + '|' + n;
    return out[key] = out[key] || {n, team, pos: posFor(team, n), num: numFor(team, name), cmp: 0, att: 0, py: 0, ptd: 0, int: 0, car: 0, ry: 0, rtd: 0, tgt: 0, rec: 0, yds: 0, recTd: 0, fl: 0}; };
  for (let j = 0; j < k && j < P.length; j++) {
    const p = P[j], t = p.p; if (t !== 0 && t !== 1 || p.td_def) continue;
    const g = p.gain || 0, passer = (p.x.split(' ')[0] || '');
    const isPass = p.k === 'pass' || (p.k === 'inc' && !p.spike) || p.k === 'int' || (p.k === 'td' && p.comp) || (p.k === 'fum' && p.target);
    const isRun = p.k === 'run' || (p.k === 'td' && p.carrier) || (p.k === 'fum' && p.carrier && !p.target);
    if (isPass) { const q = get(passer, t); q.att++; if (p.k === 'int') q.int++;
      if (p.target) { const r = get(p.target, t); r.tgt++;
        if (p.comp || p.k === 'td' || (p.k === 'fum' && p.target)) { q.cmp++; q.py += g; r.rec++; r.yds += g; if (p.k === 'td') { q.ptd++; r.recTd++; } if (p.k === 'fum') r.fl++; } } }
    if (isRun && p.carrier) { const r = get(p.carrier, t); r.car++; r.ry += g; if (p.k === 'td') r.rtd++; if (p.k === 'fum') r.fl++; }
  }
  Object.values(out).forEach(x => x.fp = fpts(x));
  return out;
}
function statLine(x) {
  const a = [];
  if (x.att) a.push(`${x.cmp}/${x.att}, ${x.py} yds${x.ptd ? `, ${x.ptd} TD` : ''}${x.int ? `, ${x.int} INT` : ''}`);
  if (x.car) a.push(`${x.car} car, ${x.ry} yds${x.rtd ? `, ${x.rtd} TD` : ''}`);
  if (x.tgt) a.push(`${x.rec}/${x.tgt} rec, ${x.yds} yds${x.recTd ? `, ${x.recTd} TD` : ''}`);
  if (x.fl) a.push(`${x.fl} fum lost`);
  return a.join(' · ') || '—';
}
function projections() {
  // Locksmith's pregame projection for each player in this game, scored with the league's settings
  if (W._proj && W._proj.gid === W.data.game_id) return W._proj.map;
  const b = D.books.find(x => x.game_id === W.data.game_id), map = {};
  const S = SCORING(), m = v => (v && v.mean) || 0;
  if (b && b.players) for (const [team, d] of Object.entries(b.players)) { if (!d || !d.players) continue;
    if (d.qb && d.qb.proj) { const q = d.qb.proj; map[team + '|' + shortName(d.qb.name)] = m(q.pass_yds) * S.pass_yd + m(q.pass_td) * S.pass_td + m(q.ints) * S.pass_int + m(q.rush_yds) * S.rush_yd + m(q.rush_td) * S.rush_td; }
    d.players.forEach(pl => { const q = pl.proj; map[team + '|' + shortName(pl.name)] = m(q.receptions) * (S.rec + (pl.pos === 'TE' ? (S.bonus_rec_te || 0) : 0)) + m(q.rec_yds) * S.rec_yd + m(q.rec_td) * S.rec_td + m(q.rush_yds) * S.rush_yd + m(q.rush_td) * S.rush_td; }); }
  W._proj = {gid: W.data.game_id, map}; return map;
}
function fantasyOwners() {
  // which players in this game are on your Sleeper roster or your opponent's
  const F = D.fantasy, own = {};
  if (!F || !F.my_team) return own;
  const add = (lst, who) => (lst || []).forEach(x => { if (x && x.name && x.team) own[x.team + '|' + shortName(x.name)] = who; });
  add(F.my_team.optimal, 'you'); add(F.my_team.bench, 'you');
  if (F.my_team.opponent) add(F.my_team.opponent.optimal, 'opp');
  return own;
}

function drives(k) {
  const P = W.P, out = []; let cur = null;
  for (let j = 0; j < k && j < P.length; j++) {
    const p = P[j];
    if (!SCRIMK.includes(p.k) || p.p == null || p.p < 0 || (p.k === 'pen' && p.d == null)) continue;
    if (!cur || cur.dr !== p.dr || cur.t !== p.p) { cur = {dr: p.dr, t: p.p, start: p.y, q: p.q, c0: tsec(p), plays: 0, end: p.y, res: '', c1: tsec(p)}; out.push(cur); }
    if (p.k !== 'pen') cur.plays++;
    cur.end = p.e ?? cur.end; cur.c1 = tsec(P[j + 1] || p);
    cur.res = p.k === 'td' ? (p.td_def ? 'Defensive TD' : 'Touchdown') : p.k === 'fg' ? 'Field goal' : p.k === 'fgx' ? 'Missed FG' : p.k === 'punt' ? 'Punt' : p.k === 'int' ? 'Interception' : p.k === 'fum' ? 'Fumble' : p.k === 'saf' ? 'Safety' : (p.to ? 'Downs' : (p.k === 'kneel' ? 'Kneel' : ''));
  }
  return out;
}
function drawPane() {
  const k = W.i + 1, d = W.data, H = d.home, A = d.away, P = W.P, pane = $('#wpane');
  if (!pane) return;
  if (W.tab === 'players') {
    const ps = Object.values(playerStats(k)), proj = projections(), own = fantasyOwners();
    const mine = ps.filter(x => own[x.team + '|' + x.n]);
    const row = x => { const key = x.team + '|' + x.n, o = own[key], pj = proj[key];
      return `<tr class="${o ? 'own-' + o : ''}"><td><b>${esc(x.n)}</b> <span class="muted">${x.pos || ''}${x.num != null ? ' #' + x.num : ''}</span>${o ? ` <span class="badge ${o === 'you' ? 'good' : 'info'}">${o === 'you' ? 'your team' : 'opponent'}</span>` : ''}<div class="sl">${statLine(x)}</div></td>
        <td class="r num"><b class="fp">${fx(x.fp, 1)}</b>${pj != null ? `<div class="muted pj">proj ${fx(pj, 1)}</div>` : ''}</td></tr>`; };
    const sec = (team) => { const L = ps.filter(x => x.team === team).sort((a, z) => z.fp - a.fp);
      return `<div class="pteam"><div class="pth" style="--tcol:${wpCol(team)}"><b>${esc(nmTeam(team))}</b><span class="muted">fantasy pts · ${D.fantasy && D.fantasy.league ? esc(D.fantasy.league.name) + ' scoring' : 'half-PPR'}</span></div>
        ${L.length ? `<table class="pstat">${L.map(row).join('')}</table>` : '<p class="note">No stats yet.</p>'}</div>`; };
    pane.innerHTML = (mine.length ? `<div class="pmine"><span class="eyebrow">Your fantasy matchup in this game</span>${mine.sort((a, z) => z.fp - a.fp).map(x => `<div><b>${esc(x.n)}</b> <span class="badge ${own[x.team + '|' + x.n] === 'you' ? 'good' : 'info'}">${own[x.team + '|' + x.n] === 'you' ? 'yours' : 'opponent'}</span> <span class="num">${fx(x.fp, 1)} pts</span></div>`).join('')}</div>` : '')
      + sec(A) + sec(H);
  } else if (W.tab === 'plays') {
    let html = '';
    for (let j = Math.min(k, P.length) - 1; j >= 0; j--) {
      const p = P[j], team = p.p === 0 ? H : p.p === 1 ? A : null, big = p.big || p.k === 'td' || p.k === 'fg';
      const sit = p.d && p.y != null && team ? `${QNAME(p.q)} ${clockTxt(p.c)} · ${ORD(p.d)} & ${p.g != null && p.y <= p.g ? 'Goal' : (p.g ?? '')} at ${p.y === 50 ? '50' : (p.y > 50 ? `${team} ${100 - p.y}` : `${team === H ? A : H} ${p.y}`)}` : `${QNAME(p.q)} ${clockTxt(p.c)}`;
      html += `<div class="fp${j === W.i ? ' cur' : ''}${big ? ' big' : ''}${['qend', 'timeout', '2mw', 'start', 'end', 'ot'].includes(p.k) ? ' ev' : ''}" data-fp="${j}" style="--tcol:${team ? tc(team) : 'var(--rule)'}">
        <div class="fps">${team ? `<b>${team}</b> · ` : ''}${sit}${(['td', 'fg', 'saf', 'xp', 'two'].includes(p.k)) ? ` <span class="fpsc">${A} ${p.s[1]} – ${H} ${p.s[0]}</span>` : ''}</div><div class="fpx">${esc(p.x)}</div></div>`;
    }
    pane.innerHTML = html || '<p class="note">Press play. Plays appear here as they happen, newest first.</p>';
    pane.querySelectorAll('[data-fp]').forEach(el => el.onclick = () => { stopPlay(); seek(+el.dataset.fp); });
  } else if (W.tab === 'stats') {
    const {T, pl} = teamStats(k);
    const row = (l, f) => `<tr><td>${l}</td><td class="r num">${f(T[1])}</td><td class="r num">${f(T[0])}</td></tr>`;
    const mm = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
    const lead = (t, key, fmt) => { const x = pl.filter(q => q.t === t).sort((a, z) => z[key] - a[key])[0]; return x && x[key] ? fmt(x) : '–'; };
    pane.innerHTML = `<div class="tbl"><table><thead><tr><th></th><th class="r">${A}</th><th class="r">${H}</th></tr></thead><tbody>
      ${row('Total yards', S => S.yds)}${row('Passing', S => `${S.cmp}/${S.att}, ${S.py}`)}${row('Rushing', S => `${S.car}–${S.ry}`)}${row('First downs', S => S.fd)}
      ${row('3rd down', S => `${S.thirdc}/${S.third}`)}${row('Sacks allowed', S => S.sk)}${row('Turnovers', S => S.to)}${row('Penalties', S => `${S.pen}–${S.peny}`)}${row('Possession', S => mm(S.top))}</tbody></table></div>
      <div class="lead">${[[A, 1], [H, 0]].map(([tm, t]) => `<div><span class="eyebrow">${tm} leaders</span>
        <p><b>Pass</b> ${lead(t, 'py', x => `${x.n} ${x.cmp}/${x.att}, ${x.py} yds, ${x.ptd} TD${x.int ? `, ${x.int} INT` : ''}`)}</p>
        <p><b>Rush</b> ${lead(t, 'ry', x => `${x.n} ${x.car}–${x.ry}${x.rtd ? `, ${x.rtd} TD` : ''}`)}</p>
        <p><b>Rec</b> ${lead(t, 'yds', x => `${x.n} ${x.rec}–${x.yds}${x.recTd ? `, ${x.recTd} TD` : ''}`)}</p></div>`).join('')}</div>`;
  } else {
    const Dv = drives(k);
    pane.innerHTML = Dv.length ? Dv.slice().reverse().map(v => { const tm = v.t === 0 ? H : A, yds = (v.start ?? 0) - (v.end ?? 0);
      return `<div class="drv" style="--tcol:${tc(tm)}"><div><b>${tm}</b> <span class="muted">${QNAME(v.q)}</span></div><div class="muted">${v.plays} plays · ${yds} yds · ${clockTxt(Math.round(v.c1 - v.c0))}</div><div class="drvres ${/Touchdown|Field goal/.test(v.res) ? 'good' : ''}">${esc(v.res || '…')}</div></div>`; }).join('')
      : '<p class="note">Drives appear here as they finish.</p>';
  }
}

document.addEventListener('keydown', e => {
  if (VIEW !== 'watch' || !W.P || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowRight') { stopPlay(); stepOnce(); }
  else if (e.key === 'ArrowLeft') { stopPlay(); seek(Math.max(-1, W.i - 1)); }
});
