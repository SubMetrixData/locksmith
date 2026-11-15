// Locksmith :: Bettor tools (More -> Bettor tools). The edges an ordinary bettor really has, as plain arithmetic on prices.
//   Boost checker  an odds boost or a profit boost against the market's no-vig chance (bets.json 'fair' for that side): worth it
//                  or not, in dollars, with the break-even price. Anything not on the board: type its normal prices.
//   Bonus bets     turn a bonus ("free") bet or a no-sweat bet into cash: the bonus on a long price at one book, cash on the
//                  other side at another, so the result is the same whatever happens. Prices per book from
//                  reports/toolkit.json (python -m locksmith.toolkit); without it, the best prices on the board (bets.json).
//   Arbitrage      two books whose prices add up to under 100% (toolkit.json 'arbs'), with stakes for $100.
//   Middles        two numbers on one game where both bets can win (toolkit.json 'middles'), and Locksmith tickets / opening
//                  numbers the line has since moved away from ('own_middles').
// Nothing here grades a game or changes a bet: Today and Games stay the one source of truth (bets.json). Money is shown at the
// user's unit (lkUnit(), Settings) and per $100.
let TK = null, TK_ERR = null, TK_AT = 0;
const TKS = Object.assign({tab: 'boost', bmode: 'odds', sp: 'all', q: '', sel: null, boost: '', pbPct: 50, pbMax: null, pbBook: null,
  bAmt: 100, bBook: 'any', bKind: 'bonus', cA: '', cB: '', cLab: ''}, (() => {
  try { const s = JSON.parse(localStorage.getItem('lk-tools') || '{}'); return s && typeof s === 'object' ? s : {}; } catch (e) { return {}; } })());
const tkSave = () => { try { localStorage.setItem('lk-tools', JSON.stringify({tab: TKS.tab, bmode: TKS.bmode, sp: TKS.sp, pbPct: TKS.pbPct, pbMax: TKS.pbMax, pbBook: TKS.pbBook, bAmt: TKS.bAmt, bBook: TKS.bBook, bKind: TKS.bKind})); } catch (e) {} };
const TK_CAUTION = 'Prices move fast and books limit arbitrage bettors; check both prices before you bet.';

// ---------------------------------------------------------------- price math (American prices; "pay" = profit per $1 staked)
const tPay = a => a < 0 ? 100 / -a : a / 100;
const tDec = a => 1 + tPay(a);
const tAm = pay => !(pay > 0) || !isFinite(pay) ? null : pay >= 1 ? Math.round(pay * 100) : -Math.round(100 / pay);
const tPx = a => a == null || !isFinite(a) ? '–' : (a > 0 ? '+' : '−') + Math.abs(Math.round(a));      // +150 / −120
function tParse(s) {           // "+150", "-120", "−120", "150" -> American; "2.50" (decimal odds) -> +150; anything else -> null
  s = String(s ?? '').trim().replace(/[−–—]/g, '-').replace(/[\s$,]/g, '');
  if (!s) return null;
  const x = parseFloat(s); if (!isFinite(x)) return null;
  if (s.includes('.') && x > 1 && x < 51) return tAm(x - 1);
  return Math.abs(x) >= 100 ? x : null;
}
function tUsd(v, sign = false, dp = null) {   // $12.34 under $100, whole dollars above; sign: +$ / −$
  if (v == null || !isFinite(v)) return '–';
  const d = dp != null ? dp : Math.abs(v) < 100 ? 2 : 0, r = Math.abs(v).toLocaleString(undefined, {minimumFractionDigits: d, maximumFractionDigits: d});
  return (sign ? (v > 0.004 ? '+' : v < -0.004 ? '−' : '') : v < -0.004 ? '−' : '') + '$' + r;
}
const tPct = (p, d = 1) => p == null || !isFinite(p) ? '–' : (100 * p).toFixed(d).replace(/\.0$/, '') + '%';
const tNum = (s, dflt) => { const x = parseFloat(String(s ?? '').replace(/[$,\s]/g, '')); return isFinite(x) && x > 0 ? x : dflt; };
const tWhen = iso => { try { const d = new Date(iso); return isFinite(d) ? d.toLocaleDateString([], {weekday: 'short'}) + ' ' + d.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) : ''; } catch (e) { return ''; } };
const tSp = s => (typeof SPNAME !== 'undefined' && SPNAME[s]) || String(s || '').toUpperCase();
// break-even price for a fair chance: the price at which the bet is worth exactly 0
const tBreakEven = f => f > 0 && f < 1 ? tAm((1 - f) / f) : null;

// ---------------------------------------------------------------- data
async function tkLoad(force) {
  if (TK && !force) return TK;
  const r = await lkFetch('get_toolkit', 'toolkit.json');
  if (r && !r.__err && (Array.isArray(r.markets) || Array.isArray(r.arbs))) { TK = r; TK_ERR = null; } else { TK = null; TK_ERR = (r && r.__err) || 'not built yet'; }
  TK_AT = Date.now();
  return TK;
}
// every side on the board that has not started, with its price and the market's no-vig chance (bets.json)
function tkSides() {
  const now = Date.now(), out = [];
  for (const g of (BETS && BETS.games) || []) {
    if (g.started || (g.start && new Date(g.start) <= now)) continue;
    for (const s of g.sides || []) if (s.price != null && isFinite(s.price) && s.fair != null && isFinite(s.fair) && s.fair > 0 && s.fair < 1)
      out.push(Object.assign({key: `${g.sport}|${g.id}|${s.mk}|${s.lab}`, g, s}, tkFresh(g, s)));
  }
  return out.sort((a, b) => String(a.g.start || '9').localeCompare(String(b.g.start || '9')) || String(a.g.id).localeCompare(String(b.g.id)));
}
// the same side in toolkit.json when its prices are newer than bets.json's: the books' current no-vig chance (same method as
// bets.json 'fair': the median of the books' no-vig chances), so a boost is judged on today's number, not this morning's
function tkFresh(g, s) {
  const base = {fair: s.fair, price: s.price, book: s.book, at: g.lines_at, n: null};
  try {
    if (!TK || !(TK.markets || []).length || !TK.source || !TK.source.prices_at) return base;
    if (g.lines_at && new Date(String(TK.source.prices_at).replace(' ', 'T')) <= new Date(String(g.lines_at).replace(' ', 'T'))) return base;
    const m = TK.markets.find(m => m.sport === g.sport && String(m.game_id) === String(g.id) && m.mk === s.mk && m.sides.some(x => x.lab === s.lab) && !m.from);
    const x = m && m.sides.find(x => x.lab === s.lab);
    if (!x || !(x.fair > 0 && x.fair < 1)) return base;
    const bb = Object.entries(x.books || {}).reduce((a, c) => !a || tPay(c[1]) > tPay(a[1]) ? c : a, null);
    return {fair: x.fair, price: bb ? bb[1] : s.price, book: bb ? bb[0] : s.book, at: TK.source.prices_at, n: m.n_books};
  } catch (e) { return base; }
}
// two-way markets with each side's price at every book: toolkit.json, else built from bets.json's best price per side
function tkMarkets() {
  const now = Date.now();
  const live = m => !m.start || new Date(m.start) > now;
  if (TK && Array.isArray(TK.markets) && TK.markets.length) return TK.markets.filter(live);
  const out = [];
  for (const g of (BETS && BETS.games) || []) {
    if (g.started || (g.start && new Date(g.start) <= now)) continue;
    const by = {};
    (g.sides || []).forEach(s => { if (s.price != null && s.fair != null) (by[s.mk] = by[s.mk] || []).push(s); });
    for (const mk in by) if (by[mk].length === 2) out.push({sport: g.sport, game_id: g.id, game: g.fight ? `${g.away} vs ${g.home}` : `${g.away} at ${g.home}`, start: g.start, mk,
      sides: by[mk].map(s => ({lab: s.lab, fair: s.fair, books: {[s.book || 'Best price']: s.price}}))});
  }
  return out;
}
const tkBooks = () => [...new Set(tkMarkets().flatMap(m => m.sides.flatMap(s => Object.keys(s.books || {}))))].filter(b => b !== 'Best price').sort();
function tkSourceLine() {
  if (TK && TK.source && TK.source.prices_at && (TK.markets || []).length) {
    const n = (TK.source.books || []).length, at = new Date(String(TK.source.prices_at).replace(' ', 'T'));
    const age = (Date.now() - at) / 6e4, ago = !isFinite(age) ? '' : age < 90 ? ` (${Math.max(1, Math.round(age))} min ago)` : ` (${Math.round(age / 60)} h ago)`;
    return `Prices from ${isFinite(at) ? at.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) : esc(TK.source.prices_at)}${ago}${n ? ` at ${n} sportsbooks` : ''}.`;
  }
  return 'Per-book prices are not loaded, so these use the best price on the board for each side.';
}

// ---------------------------------------------------------------- page
const TK_TABS = [['boost', 'Boost checker'], ['bonus', 'Bonus bets'], ['arb', 'Arbitrage'], ['middle', 'Middles']];
function tkCSS() {
  if (document.getElementById('lk-tools-css')) return;
  const st = document.createElement('style'); st.id = 'lk-tools-css';
  st.textContent = `
.bt-card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.bt-card h3{margin:0;font:700 17px/1.3 var(--body);color:var(--ink)}
.bt-help{margin:0;font-size:14px;line-height:1.5;color:var(--ink-2)}
.bt-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.bt-field{display:flex;flex-direction:column;gap:4px;font:500 13px var(--body);color:var(--muted)}
.bt-in{width:140px;padding:9px 11px;border-radius:9px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font:600 15px var(--mono)}
.bt-in:focus{outline:2px solid var(--brand);outline-offset:1px}
.bt-search{flex:1;min-width:180px;font-family:var(--body);font-weight:500}
.bt-list{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--bg)}
.bt-opt{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 12px;align-items:center;width:100%;padding:9px 12px;border:0;border-top:1px solid var(--line);background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.bt-list>.bt-opt:first-child{border-top:0}
.bt-opt:hover{background:var(--hover)}
.bt-opt.on{background:var(--brand-soft);box-shadow:inset 3px 0 0 var(--brand)}
.bt-opt b{font-weight:600;color:var(--ink)} .bt-opt small{color:var(--muted);font-size:12.5px}
.bt-opt .px{font:600 14px var(--mono);color:var(--ink);text-align:right}
.bt-opt .px small{display:block;font:500 12px var(--body)}
.bt-sel{border:1px solid var(--line);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:var(--surface-2)}
.bt-sel .t{font-weight:600;color:var(--ink)} .bt-sel .t small{font-weight:400;color:var(--muted);margin-left:6px}
.bt-res{display:flex;flex-direction:column;gap:8px}
.bt-verdict{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:15.5px;color:var(--ink-2);line-height:1.45}
.bt-verdict b{color:var(--ink)}
.bt-go,.bt-no{font:700 14px var(--body);padding:4px 12px;border-radius:999px;white-space:nowrap}
.bt-go{background:var(--win);color:var(--win-ink)} .bt-no{border:1px solid var(--loss);color:var(--loss)}
.bt-lines{border:1px solid var(--line);border-radius:10px;overflow:hidden}
.bt-line{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px 14px;align-items:center;padding:11px 14px;border-top:1px solid var(--line);font-size:14.5px;color:var(--ink-2);line-height:1.5}
.bt-lines>.bt-line:first-child{border-top:0}
.bt-line b{color:var(--ink);font-weight:600}
.bt-line .k{font:600 15px var(--mono);text-align:right;white-space:nowrap}
.bt-line .k small{display:block;font:500 12px var(--body);color:var(--muted);text-align:right}
.bt-line .s{grid-column:1/-1;font-size:12.5px;color:var(--muted)}
.bt-mono{font-family:var(--mono);font-variant-numeric:tabular-nums}
.bt-rg{font-size:13px;color:var(--muted);line-height:1.55;margin:0;border-top:1px solid var(--line);padding-top:12px}
.bt-cust summary{cursor:pointer;color:var(--info);font:500 13.5px var(--body)}
.bt-cust[open] summary{margin-bottom:8px}
@media (max-width:760px){
  .bt-card{padding:13px 14px;gap:10px}
  .bt-in{width:118px}
  .bt-search{min-width:0;width:100%;flex-basis:100%}
  .bt-line{grid-template-columns:minmax(0,1fr);padding:10px 12px}
  .bt-line .k,.bt-line .k small{text-align:left}
  .bt-line[data-bonus] .k{display:none}
  .bt-opt small{display:block}
  .bt-tabs{display:grid;grid-template-columns:1fr 1fr;gap:4px}
  .bt-tabs button{padding:8px 6px;font-size:14px}
}`;
  document.head.appendChild(st);
}
async function toolsRender() {
  tkCSS();
  $('#title').textContent = 'Bettor tools';
  $('#eyebrow').textContent = 'Promos, arbitrage and middles · plain math on today’s prices';
  const v = $('#view');
  if (!BETS && !BETS_ERR) { v.innerHTML = '<div class="lk-empty">Loading prices…</div>'; await betsLoad(); }
  if ((!TK && !TK_ERR) || Date.now() - TK_AT > 5 * 60e3) await tkLoad(true);     // prices move: reload after 5 minutes
  if (VIEW !== 'tools') return;
  if (!TK_TABS.some(t => t[0] === TKS.tab)) TKS.tab = 'boost';
  const tab = ([k, l]) => `<button type="button" class="${TKS.tab === k ? 'on' : ''}" data-tktab="${k}">${l}</button>`;
  v.innerHTML = `<p class="lk-lead">Our numbers mostly agree with the market. The edges left for an ordinary bettor are <b>promos</b> and <b>price gaps between books</b>. These tools do that math.</p>
    <div class="lk-tabs bt-tabs" role="tablist">${TK_TABS.map(tab).join('')}</div>
    <div id="tkBody"></div>
    <p class="bt-rg"><b>Bet with a budget.</b> Promos come with rules (minimum odds, expiry dates, one per person): read them before you bet. Books can limit accounts that only take promos, arbitrage or middles. A price gap can close before both bets are in. Every bet can lose. 21+, where legal only. Gambling problem? Call 1-800-GAMBLER.</p>`;
  v.querySelectorAll('[data-tktab]').forEach(b => b.onclick = () => { TKS.tab = b.dataset.tktab; tkSave(); toolsRender(); });
  ({boost: tkBoost, bonus: tkBonus, arb: tkArbs, middle: tkMiddles})[TKS.tab]();
}

// ---------------------------------------------------------------- 1. boost checker
function tkBoost() {
  const body = $('#tkBody'), S = tkSides(), sports = [...new Set(S.map(x => x.g.sport))].sort((a, b) => (LK_ORDER || []).indexOf(a) - (LK_ORDER || []).indexOf(b));
  if (TKS.sp !== 'all' && !sports.includes(TKS.sp)) TKS.sp = 'all';
  const mode = TKS.bmode === 'profit' ? 'profit' : 'odds';
  body.innerHTML = `<div class="bt-card">
    <div class="lk-chips"><button type="button" class="chip${mode === 'odds' ? ' on' : ''}" data-bmode="odds">Odds boost</button><button type="button" class="chip${mode === 'profit' ? ' on' : ''}" data-bmode="profit">Profit boost</button></div>
    <p class="bt-help">${mode === 'odds' ? 'A book raises the price on one side. Pick the side, type the boosted price, and see if it pays more than the market’s fair chance says it should.' : 'A book adds a percentage to your winnings, up to a maximum bet. Pick the side, type the boost and the maximum bet.'}</p>
    <div class="lk-chips">${['all', ...sports].map(s => `<button type="button" class="chip${TKS.sp === s ? ' on' : ''}" data-tksp="${s}">${s === 'all' ? 'All' : tSp(s)}</button>`).join('')}</div>
    <div class="bt-row"><input id="tkQ" class="bt-in bt-search" type="search" placeholder="Search a team or fighter" value="${esc(TKS.q)}" aria-label="Search a team or fighter"></div>
    <div id="tkList"></div>
    <details class="bt-cust"${TKS.sel === 'custom' ? ' open' : ''}><summary>Not on the list (a prop, a parlay)? Type its normal prices</summary>
      <div class="bt-row"><label class="bt-field">Your side, normal price<input id="tkCA" class="bt-in" inputmode="text" placeholder="-110" value="${esc(TKS.cA)}"></label>
        <label class="bt-field">Other side (optional)<input id="tkCB" class="bt-in" inputmode="text" placeholder="-110" value="${esc(TKS.cB)}"></label>
        <button type="button" class="chip" id="tkCGo">Use these prices</button></div></details>
    <div id="tkSel"></div></div>`;
  body.querySelectorAll('[data-bmode]').forEach(b => b.onclick = () => { TKS.bmode = b.dataset.bmode; tkSave(); tkBoost(); });
  body.querySelectorAll('[data-tksp]').forEach(b => b.onclick = () => { TKS.sp = b.dataset.tksp; tkSave(); body.querySelectorAll('[data-tksp]').forEach(c => c.classList.toggle('on', c === b)); tkList(); });
  $('#tkQ').oninput = e => { TKS.q = e.target.value; tkList(); };
  $('#tkCGo').onclick = () => { TKS.cA = $('#tkCA').value; TKS.cB = $('#tkCB').value; TKS.sel = 'custom'; tkList(); tkSelRender(); };
  tkList(); tkSelRender();
}
function tkAsOf(at) {   // when the game's prices were taken (bets.json lines_at; the file itself can be rebuilt later)
  try { const t = new Date(String(at || BETS.generated).replace(' ', 'T')); return isFinite(t) ? ', prices of ' + t.toLocaleDateString([], {weekday: 'short'}) + ' ' + t.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}) : ''; } catch (e) { return ''; }
}
function tkPick() {   // the chosen side: {lab, game, price, fair, note} or null
  if (TKS.sel === 'custom') {
    const a = tParse(TKS.cA), b = tParse(TKS.cB);
    if (a == null) return null;
    const ia = 1 / tDec(a), fair = b != null ? ia / (ia + 1 / tDec(b)) : ia / 1.045;
    return {lab: 'Your bet', game: b != null ? 'your two prices, book’s cut removed' : 'one price: assumes the usual 4.5% book cut', price: a, fair, custom: true};
  }
  const x = tkSides().find(x => x.key === TKS.sel);
  return x ? {lab: x.s.lab, game: `${x.g.fight ? `${x.g.away} vs ${x.g.home}` : `${x.g.away} at ${x.g.home}`} · ${tWhen(x.g.start)}`, price: x.price, fair: x.fair, book: x.book, sport: x.g.sport, at: x.at, n: x.n} : null;
}
function tkList() {
  const el = $('#tkList'); if (!el) return;
  const q = String(TKS.q || '').trim().toLowerCase();
  const S = tkSides().filter(x => (TKS.sp === 'all' || x.g.sport === TKS.sp) && (!q || `${x.s.lab} ${x.g.away} ${x.g.home}`.toLowerCase().includes(q)));
  if (!S.length) { el.innerHTML = `<p class="bt-help">${tkSides().length ? 'No side matches. Try another name.' : 'No upcoming games on the board right now.'}</p>`; return; }
  const sel = S.find(x => x.key === TKS.sel), shown = S.slice(0, 8);
  if (sel && !shown.includes(sel)) shown.unshift(sel);
  el.innerHTML = `<div class="bt-list" role="listbox" aria-label="Pick a side">${shown.map(x => `<button type="button" class="bt-opt${x.key === TKS.sel ? ' on' : ''}" data-tkpick="${esc(x.key)}" role="option" aria-selected="${x.key === TKS.sel}">
      <span><b>${tLab(x.s.lab)}</b> <small>${tSp(x.g.sport)} · ${esc(x.g.fight ? `${x.g.away} vs ${x.g.home}` : `${x.g.away} at ${x.g.home}`)} · ${esc(tWhen(x.g.start))}</small></span>
      <span class="px">${tPx(x.price)}<small>Market ${tPct(x.fair, 0)}</small></span></button>`).join('')}</div>
    ${S.length > shown.length ? `<p class="lk-small">${S.length - shown.length} more. Search to narrow it down.</p>` : ''}`;
  el.querySelectorAll('[data-tkpick]').forEach(b => b.onclick = () => { TKS.sel = b.dataset.tkpick; tkList(); tkSelRender(); });
}
function tkSelRender() {
  const el = $('#tkSel'); if (!el) return;
  const P = tkPick(), mode = TKS.bmode === 'profit' ? 'profit' : 'odds', u = lkUnit();
  if (!P) { el.innerHTML = `<p class="bt-help">${TKS.sel === 'custom' ? 'Type a normal price like −110 or +150.' : 'Pick a side above.'}</p>`; return; }
  const be = tBreakEven(P.fair);
  if (TKS.pbMax == null) TKS.pbMax = u;
  el.innerHTML = `<div class="bt-sel"><div class="t">${tLab(P.lab)} <span class="bt-mono">${tPx(P.price)}</span><small>${esc(P.game)}</small></div>
    <div class="bt-help">Vegas’s fair chance: <b>${tPct(P.fair)}</b> (${P.n ? P.n + ' books’ prices' : 'the books’ price'} with their cut removed${P.custom ? '' : tkAsOf(P.at)}). Break-even price: <b class="bt-mono">${tPx(be)}</b>. ${P.custom ? '' : `Normal price: ${tPx(P.price)}${P.book ? ' at ' + esc(P.book) : ''}.`}</div>
    ${mode === 'odds' ? `<div class="bt-row"><label class="bt-field">Boosted price<input id="tkBoost" class="bt-in" inputmode="text" placeholder="+150" value="${esc(TKS.boost)}" aria-label="Boosted price"></label></div>`
      : `<div class="bt-row"><label class="bt-field">Profit boost %<input id="tkPb" class="bt-in" inputmode="decimal" value="${esc(TKS.pbPct)}" aria-label="Profit boost percent"></label>
         <label class="bt-field">Maximum bet $<input id="tkPbMax" class="bt-in" inputmode="decimal" value="${esc(TKS.pbMax)}" aria-label="Maximum bet in dollars"></label></div>`}
    <div id="tkRes" class="bt-res"></div></div>`;
  const upd = () => tkBoostRes(P);
  if (mode === 'odds') $('#tkBoost').oninput = e => { TKS.boost = e.target.value; upd(); };
  else { $('#tkPb').oninput = e => { TKS.pbPct = e.target.value; tkSave(); upd(); }; $('#tkPbMax').oninput = e => { TKS.pbMax = e.target.value; tkSave(); upd(); }; }
  upd();
}
function tkBoostRes(P) {
  const el = $('#tkRes'); if (!el) return;
  const u = lkUnit(), f = P.fair, be = tBreakEven(f);
  if (TKS.bmode !== 'profit') {
    const a = tParse(TKS.boost);
    if (a == null) { el.innerHTML = `<p class="bt-help">Type the boosted price, like ${tPx(tAm(tPay(P.price) * 1.25))}. It is worth taking at <b class="bt-mono">${tPx(be)}</b> or better.</p>`; return; }
    const ev = 100 * (f * tPay(a) - (1 - f));
    el.innerHTML = `<div class="bt-verdict"><span class="${ev > 0 ? 'bt-go' : 'bt-no'}">${ev > 0 ? 'Bet it' : 'Skip it'}</span>
      <span>Worth <b class="bt-mono">${tUsd(ev, true)}</b> per $100 vs Vegas’s fair chance (${tPct(f)}).</span></div>
      <p class="bt-help">At your ${tUsd(u, false, 0)} unit that is <b class="bt-mono">${tUsd(ev * u / 100, true)}</b> on average. Break-even is ${tPx(be)}: ${ev > 0 ? `the boost pays ${tPx(a)}, better than that.` : `the boost pays ${tPx(a)}, not enough.`} It still loses ${tPct(1 - f, 0)} of the time.</p>`;
    return;
  }
  const b = tNum(TKS.pbPct, 0) / 100, m = tNum(TKS.pbMax, u);
  if (!(b > 0)) { el.innerHTML = '<p class="bt-help">Type the boost, like 25 or 50 (percent).</p>'; return; }
  const pay = tPay(P.price) * (1 + b), ev1 = f * pay - (1 - f), bp = tAm(pay);
  el.innerHTML = `<div class="bt-verdict"><span class="${ev1 > 0 ? 'bt-go' : 'bt-no'}">${ev1 > 0 ? 'Bet it' : 'Skip it'}</span>
      <span>Boosted price <b class="bt-mono">${tPx(bp)}</b> (from ${tPx(P.price)}). Worth <b class="bt-mono">${tUsd(100 * ev1, true)}</b> per $100 vs Vegas’s fair chance (${tPct(f)}).</span></div>
    <p class="bt-help">On your ${tUsd(m, false, m < 100 ? 2 : 0).replace('.00', '')} maximum bet: <b class="bt-mono">${tUsd(m * ev1, true)}</b> on average. A profit boost is worth most on a longer price with a small book cut.</p>
    ${tkBestBoost(b)}`;
  el.querySelectorAll('[data-pbbook]').forEach(c => c.onclick = () => { TKS.pbBook = c.dataset.pbbook; tkSave(); tkBoostRes(P); });
}
function tkBestBoost(b) {   // where a profit boost is worth most today, at one book (prices per book from toolkit.json)
  if (!TK || !(TK.markets || []).length) return '';
  const books = tkBooks(); if (!books.length) return '';
  if (!books.includes(TKS.pbBook)) TKS.pbBook = books.includes('DraftKings') ? 'DraftKings' : books[0];
  const rows = [];
  for (const m of tkMarkets()) for (const s of m.sides) { const px = (s.books || {})[TKS.pbBook]; if (px == null || !(s.fair > 0)) continue; const ev = s.fair * tPay(px) * (1 + b) - (1 - s.fair); rows.push({m, s, px, ev}); }
  rows.sort((x, y) => y.ev - x.ev);
  return `<div class="bt-help">Best places for a ${Math.round(b * 100)}% profit boost today at:</div>
    <div class="lk-chips">${books.map(k => `<button type="button" class="chip${k === TKS.pbBook ? ' on' : ''}" data-pbbook="${esc(k)}">${esc(k)}</button>`).join('')}</div>
    <div class="bt-lines">${rows.slice(0, 3).map(r => `<div class="bt-line"><span><b>${tLab(r.s.lab)}</b> <span class="bt-mono">${tPx(r.px)}</span> → <span class="bt-mono">${tPx(tAm(tPay(r.px) * (1 + b)))}</span> · ${tSp(r.m.sport)} ${esc(r.m.game)} · ${esc(tWhen(r.m.start))}</span>
      <span class="k ${r.ev > 0 ? 'pos' : 'neg'}">${tUsd(100 * r.ev, true)}<small>per $100</small></span></div>`).join('') || '<div class="bt-line">No prices at this book right now.</div>'}</div>`;
}

// ---------------------------------------------------------------- 2. bonus bets and no-sweat bets
// bonus B on side X at decimal dX pays only the profit B(dX-1); cash C = B(dX-1)/dY on the other side at dY returns the same either
// way, so you keep B(dX-1)(dY-1)/dY whatever happens. No-sweat: cash S on X; if X loses the book refunds S as a bonus bet worth
// about r*S (r = today's best conversion at that book); hedge H = S(dX - r)/dY so both results are equal.
function tkHedges(bonusBook) {
  const rows = [], named = !!(TK && (TK.markets || []).length);   // with per-book prices, only books you can name (not 'Best price')
  for (const m of tkMarkets()) for (let i = 0; i < 2; i++) {
    const s = m.sides[i], o = m.sides[1 - i], ob = Object.entries(o.books || {}).filter(([b]) => !named || b !== 'Best price');
    if (!ob.length) continue;
    const [hb, hp] = ob.reduce((a, c) => tPay(c[1]) > tPay(a[1]) ? c : a);
    for (const [bk, px] of Object.entries(s.books || {})) {
      if ((bonusBook !== 'any' && bk !== bonusBook) || (named && bk === 'Best price')) continue;
      const dx = tDec(px), dy = tDec(hp);
      rows.push({m, s, o, bk, px, hb, hp, dx, dy, keep: (dx - 1) * (dy - 1) / dy});
    }
  }
  return rows.sort((a, b) => b.keep - a.keep);
}
function tkBonus() {
  const body = $('#tkBody'), books = tkBooks(), kind = TKS.bKind === 'nosweat' ? 'nosweat' : 'bonus';
  if (TKS.bBook !== 'any' && !books.includes(TKS.bBook)) TKS.bBook = 'any';
  body.innerHTML = `<div class="bt-card">
    <div class="lk-chips"><button type="button" class="chip${kind === 'bonus' ? ' on' : ''}" data-bkind="bonus">Bonus bet</button><button type="button" class="chip${kind === 'nosweat' ? ' on' : ''}" data-bkind="nosweat">No-sweat bet</button></div>
    <p class="bt-help">${kind === 'bonus' ? 'A bonus bet pays only the winnings, never the stake back. Put it on a long price and bet cash on the other side at another book: you keep the same amount whatever happens.'
      : 'A no-sweat bet refunds your stake as a bonus bet if it loses. Bet it on a long price and hedge the other side with cash: you keep about the same either way, counting the refund at today’s best conversion.'}</p>
    <div class="bt-row"><label class="bt-field">${kind === 'bonus' ? 'Bonus amount' : 'No-sweat bet'} $<input id="tkBAmt" class="bt-in" inputmode="decimal" value="${esc(TKS.bAmt)}" aria-label="Amount in dollars"></label></div>
    <div class="bt-help">My ${kind === 'bonus' ? 'bonus' : 'no-sweat bet'} is at:</div>
    <div class="lk-chips">${['any', ...books].map(k => `<button type="button" class="chip${TKS.bBook === k ? ' on' : ''}" data-bbook="${esc(k)}">${k === 'any' ? 'Any book' : esc(k)}</button>`).join('')}</div>
    ${TK && TK.source && TK.source.stale_note ? `<div class="lk-note warn">These prices are ${Math.round(TK.source.age_h || 0)} hours old. Check both prices at the books before you bet.</div>` : ''}
    <div id="tkBRes" class="bt-res"></div>
    <p class="lk-small">${tkSourceLine()} Check each book’s rules: some set a minimum price for bonus bets or exclude some markets. Both bets must be on the same game and the same line.</p></div>`;
  body.querySelectorAll('[data-bkind]').forEach(b => b.onclick = () => { TKS.bKind = b.dataset.bkind; tkSave(); tkBonus(); });
  body.querySelectorAll('[data-bbook]').forEach(b => b.onclick = () => { TKS.bBook = b.dataset.bbook; tkSave(); tkBonus(); });
  $('#tkBAmt').oninput = e => { TKS.bAmt = e.target.value; tkSave(); tkBonusRes(); };
  tkBonusRes();
}
function tkBonusRes() {
  const el = $('#tkBRes'); if (!el) return;
  const B = tNum(TKS.bAmt, 0), kind = TKS.bKind === 'nosweat' ? 'nosweat' : 'bonus';
  if (!(B > 0)) { el.innerHTML = '<p class="bt-help">Type an amount, like 100.</p>'; return; }
  const H = tkHedges(TKS.bBook);
  if (!H.length) { el.innerHTML = `<p class="bt-help">No two-way prices${TKS.bBook !== 'any' ? ' at ' + esc(TKS.bBook) : ''} right now.</p>`; return; }
  const seen = new Set(), top = [];
  if (kind === 'bonus') {
    for (const h of H) { const k = h.m.game + '|' + h.m.mk; if (seen.has(k)) continue; seen.add(k); top.push(h); if (top.length >= 3) break; }
    el.innerHTML = `<div class="bt-lines">${top.map((h, i) => {
      const C = Math.round(B * (h.dx - 1) / h.dy), kWin = B * (h.dx - 1) - C, kLose = C * (h.dy - 1), K = Math.min(kWin, kLose);
      return `<div class="bt-line" data-bonus="${i}"><span>Bet <b>${tUsd(B)} bonus</b> on <b>${tLab(h.s.lab)}</b> at <span class="bt-mono">${tPx(h.px)}</span> (${esc(h.bk)}), <b>${tUsd(C)} cash</b> on <b>${tLab(h.o.lab)}</b> at <span class="bt-mono">${tPx(h.hp)}</span> (${esc(h.hb)}): you keep about <b>${tUsd(K)}</b> whatever happens (${tPct(K / B, 0)} of the bonus).</span>
        <span class="k pos">${tUsd(K)}<small>${tPct(K / B, 0)} kept</small></span>
        <span class="s">${tSp(h.m.sport)} · ${esc(h.m.game)} · ${esc(tWhen(h.m.start))}. If ${tLab(h.s.lab)} wins: ${tUsd(B * (h.dx - 1))} winnings − ${tUsd(C)} cash = ${tUsd(kWin)}. If ${tLab(h.o.lab)} wins: ${tUsd(C * (h.dy - 1))}.</span></div>`;
    }).join('')}</div>
    <p class="lk-small">Most people get 60 to 75% of a bonus this way; betting the bonus alone on a favorite returns far less on average.</p>`;
    return;
  }
  // no-sweat: r = today's best conversion of a bonus at that book (the refund is a bonus bet there)
  const rAt = bk => { const x = tkHedges(bk)[0]; return x ? Math.min(0.85, x.keep) : 0.65; };
  const rows = H.map(h => { const r = rAt(h.bk), Hc = B * (h.dx - r) / h.dy; return Object.assign({r, Hc, K: B * (h.dx - 1) - Hc}, h); }).sort((a, b) => b.K - a.K);
  for (const h of rows) { const k = h.m.game + '|' + h.m.mk; if (seen.has(k)) continue; seen.add(k); top.push(h); if (top.length >= 3) break; }
  el.innerHTML = `<div class="bt-lines">${top.map(h => {
    const Hc = Math.round(h.Hc), kWin = B * (h.dx - 1) - Hc, kLose = Hc * (h.dy - 1) - B + h.r * B;
    return `<div class="bt-line"><span>Bet <b>${tUsd(B)}</b> no-sweat on <b>${tLab(h.s.lab)}</b> at <span class="bt-mono">${tPx(h.px)}</span> (${esc(h.bk)}), <b>${tUsd(Hc)} cash</b> on <b>${tLab(h.o.lab)}</b> at <span class="bt-mono">${tPx(h.hp)}</span> (${esc(h.hb)}): you end up about <b>${tUsd(Math.min(kWin, kLose), true)}</b> either way.</span>
      <span class="k ${Math.min(kWin, kLose) > 0 ? 'pos' : 'neg'}">${tUsd(Math.min(kWin, kLose), true)}<small>${tPct(Math.min(kWin, kLose) / B, 0)} of the stake</small></span>
      <span class="s">${tSp(h.m.sport)} · ${esc(h.m.game)} · ${esc(tWhen(h.m.start))}. If ${tLab(h.s.lab)} wins: ${tUsd(kWin, true)}. If it loses: ${tUsd(Hc * (h.dy - 1) - B, true)} now plus a ${tUsd(B)} bonus bet, worth about ${tUsd(h.r * B)} when you convert it here (${tPct(h.r, 0)}).</span></div>`;
  }).join('')}</div>`;
}

// ---------------------------------------------------------------- 3. arbitrage
function tkArbs() {
  const body = $('#tkBody'), A = (TK && TK.arbs) || [];
  const stale = TK && TK.source && TK.source.stale_note;
  const list = A.filter(a => !a.start || new Date(a.start) > Date.now());
  body.innerHTML = `<div class="bt-card"><h3>Arbitrage</h3>
    <p class="bt-help">When two books disagree enough, betting both sides wins the same amount whatever happens. Stakes below are for <b>$100 in total</b>.</p>
    <div class="lk-note warn">${TK_CAUTION}</div>
    ${!TK ? `<p class="bt-help">The price scan has not run yet. It runs with each update (python -m locksmith.toolkit).</p>`
      : list.length ? `<div class="bt-lines">${list.slice(0, 12).map(a => {
        const st = a.sides.map(s => Math.round(100 * s.stake_share * 100) / 100), ret = Math.min(...a.sides.map((s, i) => st[i] * tDec(s.price))), lock = ret - st.reduce((x, y) => x + y, 0);
        return `<div class="bt-line"><span>${a.sides.map((s, i) => `<b>${tLab(s.lab)}</b> <span class="bt-mono">${tPx(s.price)}</span> (${esc(s.book)}) <b class="bt-mono">${tUsd(st[i], false, 2)}</b>`).join(' + ')}</span>
          <span class="k pos">${tUsd(lock, true, 2)}<small>locks in, ${a.profit_pct}%</small></span>
          <span class="s">${tSp(a.sport)} · ${esc(a.game)} · ${esc(tWhen(a.start))}. Locks in ${tUsd(lock, false, 2)} whatever the result, if both bets go in at these prices.</span></div>`; }).join('')}</div>`
      : `<p class="bt-help">No arbitrage right now${stale ? '' : ` among ${(TK.source && TK.source.games) || 0} games at ${((TK.source && TK.source.books) || []).length} sportsbooks`}. They are rare between big US books and usually close within minutes.</p>`}
    <p class="lk-small">${stale ? esc(stale[0].toUpperCase() + stale.slice(1)) + '. ' : ''}${tkSourceLine()}</p></div>`;
}

// ---------------------------------------------------------------- 4. middles
const tLab = s => esc(String(s ?? '').replace(/(^|\s)-(\d)/g, '$1−$2'));   // "BOS -8.5" with a real minus sign
function tkSay(m, x) {   // an outcome in words: "BOS by 9", "a tie", "6 goals" / "the total is 221"
  if (m.mk !== 'spread') return String(x);
  const g = String(m.game).split(' at '), away = g[0], home = g[1] || 'home';
  return x === 0 ? 'a tie' : x > 0 ? `${home} by ${x}` : `${away} by ${-x}`;
}
function tkMidWin(m) {   // "the total lands 221 to 223" / "the result is BOS by 9"
  const w = m.window;
  if (!w) return '';
  if (m.mk === 'spread') return w[0] === w[1] ? `the result is ${tkSay(m, w[0])}` : `the result is between ${tkSay(m, w[0])} and ${tkSay(m, w[1])}`;
  return w[0] === w[1] ? `the total is exactly ${w[0]}` : `the total lands ${w[0]} to ${w[1]}`;
}
function tkPushWin(m) {  // the whole number where one bet pushes and the other wins
  const n = [m.lo, m.hi].filter(x => x != null && Number.isInteger(+x)).map(x => tkSay(m, +x));
  return n.length ? (m.mk === 'spread' ? `the result is ${n.join(' or ')}` : `the total is exactly ${n.join(' or ')}`) : 'it lands on the whole number';
}
function tkMore(list, n, row, label) {   // the first n lines, the rest behind one click (one line per item, nothing dense)
  if (!list.length) return '';
  const head = `<div class="bt-lines">${list.slice(0, n).map(row).join('')}</div>`;
  return list.length <= n ? head : head + `<details class="lk-more"><summary>${label} (${list.length - n} more)</summary><div class="bt-lines" style="margin-top:8px">${list.slice(n).map(row).join('')}</div></details>`;
}
function tkMiddles() {
  const body = $('#tkBody'), now = Date.now(), up = x => !x.start || new Date(x.start) > now;
  const M = ((TK && TK.middles) || []).filter(up), O = ((TK && TK.own_middles) || []).filter(up);
  const T = O.filter(x => x.kind === 'ticket'), Op = O.filter(x => x.kind === 'opener'), u = lkUnit();
  const bookRow = m => {
    const s = m.legs.map(l => 100 * l.stake_share);
    const parts = [];
    if (m.no_lose) parts.push(`Locks in at least ${tUsd(Math.min(m.miss_per_100 ?? 1e9, m.push_per_100 ?? 1e9), false, 2)} whatever the result.`);
    if (m.window) parts.push(`Both win if ${tkMidWin(m)} (about ${tPct(m.p_middle, 0)}): ${tUsd(m.hit_per_100, true)}.`);
    if (m.p_push > 0) parts.push(`One bet pushes and the other wins if ${tkPushWin(m)} (about ${tPct(m.p_push, 0)}): ${tUsd(m.push_per_100, true)}.`);
    if (m.miss_per_100 != null && !m.no_lose) parts.push(`Otherwise ${tUsd(m.miss_per_100, true)}.`);
    return `<div class="bt-line"><span>${m.legs.map((l, i) => `<b>${tLab(l.lab)}</b> <span class="bt-mono">${tPx(l.price)}</span> (${esc(l.book)}) <b class="bt-mono">${tUsd(s[i], false, 2)}</b>`).join(' + ')}</span>
      <span class="k ${m.ev_per_100 >= 0 ? 'pos' : 'neg'}">${tUsd(m.ev_per_100, true)}<small>per $100 on average</small></span>
      <span class="s">${tSp(m.sport)} · ${esc(m.game)} · ${esc(tWhen(m.start))}. ${parts.join(' ')}</span></div>`;
  };
  const ownRow = m => {
    const add = m.add.stake_per_100_held * u / 100, how = m.window ? `Both win if ${tkMidWin(m)}` : `One pushes and the other wins if ${tkPushWin(m)}`;
    return `<div class="bt-line"><span>You hold <b>${tLab(m.held.lab)}</b> <span class="bt-mono">${tPx(m.held.price)}</span>${m.held.book ? ` (${esc(m.held.book)})` : ''}. Add <b>${tLab(m.add.lab)}</b> at <span class="bt-mono">${tPx(m.add.price)}</span> (${esc(m.add.book)}): <b class="bt-mono">${tUsd(add, false, 2)}</b> per ${tUsd(u, false, 0)} held.</span>
      <span class="k">${tPct(m.p_middle || m.p_push, 0)}<small>${m.window ? 'both win' : 'push + win'}</small></span>
      <span class="s">${tSp(m.sport)} · ${esc(m.game)} · ${esc(tWhen(m.start))}. ${how}: ${tUsd(m.hit_per_100_held * u / 100, true)}. Otherwise about ${tUsd(m.worst_per_100_held * u / 100, true)}. Adding it costs about ${tUsd(-m.add_ev_per_100_held * u / 100, false, 2)} on average (the book’s cut).</span></div>`;
  };
  const none = !TK ? 'The price scan has not run yet. It runs with each update (python -m locksmith.toolkit).'
    : TK.source && TK.source.stale_note ? esc(TK.source.stale_note) + '.'
    : 'No middle worth taking right now: the books’ numbers are too close together. They open up when news moves one book before the others.';
  body.innerHTML = `<div class="bt-card"><h3>Middles between books</h3>
    <p class="bt-help">Two books post different numbers on the same game, say Over 220.5 at one and Under 223.5 at another. Bet both: if the result lands in between, both win; otherwise one wins and the other loses, which costs a little. Stakes are for $100 in total. The chance of landing in between comes from past final scores, set to agree with the market’s line.</p>
    <div class="lk-note warn">${TK_CAUTION}</div>
    ${M.length ? tkMore(M, 5, bookRow, 'Show the rest') : `<p class="bt-help">${none}</p>`}
    ${T.length ? `<h3>Your Locksmith tickets</h3><p class="bt-help">The line has moved since these were suggested. If you placed one, betting the other side now can win both. Amounts are for your ${tUsd(u, false, 0)} unit.</p>${tkMore(T, 4, ownRow, 'More tickets')}` : ''}
    ${Op.length ? `<h3>If you bet the opening number</h3><p class="bt-help">For anyone who took the first number a book posted: the line has moved enough to bet the other side for a middle.</p>${tkMore(Op, 3, ownRow, 'More games')}` : ''}
    <p class="lk-small">${tkSourceLine()}</p></div>`;
}
