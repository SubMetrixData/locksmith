// Locksmith :: player props page shared by basketball and hockey.
// cfg = {P: props object from app_data, books: today's games, sport: 'nba'|'nhl', name: 'basketball'|'hockey', team: code -> name}
let PS = {stat: '', game: '', q: '', sort: 'edge', open: null, show: 40};
const PSTAT = {nba: {pts: 'Points', reb: 'Rebounds', ast: 'Assists', fg3m: 'Threes', pra: 'Pts+Reb+Ast', pr: 'Pts+Reb', pa: 'Pts+Ast', ra: 'Reb+Ast', stl: 'Steals', blk: 'Blocks', sb: 'Stl+Blk', tov: 'Turnovers'},
  nhl: {points: 'Points', assists: 'Assists', sog: 'Shots on goal', goal: 'Goals'}};
PSTAT.wnba = PSTAT.nba;
const pAm = x => ok(x) ? (x > 0 ? '+' : '') + Math.round(x) : '–';
const pKey = x => `${x.pid}|${x.stat}|${x.line}`;

function propsView(cfg) {
  const {P, books, sport, name} = cfg, SN = PSTAT[sport];
  const gids = new Set(books.map(b => +b.game_id)), gl_ = {};
  books.forEach(b => gl_[+b.game_id] = `${b.away} @ ${b.home}`);
  const ALL = (P.lines || []).filter(x => gids.has(+x.game_id));
  const R = P.record || {}, picks = ALL.filter(x => x.pick), leans = ALL.filter(x => x.lean);
  const pickBest = {};                                                     // one play per player: the bets on one player win or lose together
  picks.sort((a, z) => z.ev - a.ev).forEach(x => { if (!pickBest[x.pid]) pickBest[x.pid] = x; });
  const plays = Object.values(pickBest);
  const stats = [...new Set(ALL.map(x => x.stat))].sort((a, z) => Object.keys(SN).indexOf(a) - Object.keys(SN).indexOf(z));
  let L = ALL.filter(x => (!PS.stat || x.stat === PS.stat) && (!PS.game || +x.game_id === +PS.game) && (!PS.q || x.player.toLowerCase().includes(PS.q.toLowerCase())));
  const sorters = {edge: (a, z) => z.edge - a.edge, ev: (a, z) => z.ev - a.ev, move: (a, z) => Math.abs(mv(z)) - Math.abs(mv(a)), player: (a, z) => a.player.localeCompare(z.player)};
  L = L.sort(sorters[PS.sort] || sorters.edge);
  const day = books.length ? (dayName(books[0].date) === 'Today' ? 'today' : 'on ' + dayName(books[0].date)) : 'today';
  const rules = P.rules || [];
  const head = !ALL.length ? `<div class="verdict big1"><b>No DraftKings player props are posted ${day} yet.</b> They usually go up the morning of the game; update again later.</div>`
    : plays.length ? `<div class="verdict big1"><b>${plays.length} tested prop play${plays.length > 1 ? 's' : ''} ${day}.</b> ${ALL.length} DraftKings lines priced. A play needs a rule that already made money on earlier days of this season (graded at the opening price, rules chosen only from earlier days).</div>`
    : `<div class="verdict big1"><b>No tested prop plays ${day}.</b> ${ALL.length} DraftKings lines priced. ${rules.length ? 'None of tonight’s lines fits a rule that has made money so far.' : `No ${name} prop rule has enough history yet (at least 150 graded bets over 25 games and 7 days, profitable on earlier days only). Until then everything below is a lean, not a play.`}</div>`;
  const rec = R.n ? `<div class="tiles">${tile(R.n.toLocaleString(), `real lines graded (${R.games} games)`)}${tile(pct((R.clv || {}).toward), 'of price moves went toward Locksmith', ((R.clv || {}).toward || 0) > .5 ? 'good' : '')}${tile(fx(R.ll.locksmith, 3) + ' / ' + fx(R.ll.book_open, 3), 'accuracy: Locksmith / DraftKings opener (lower is better)')}${tile((R.walk_forward || {}).bets ? sgn(100 * R.walk_forward.roi, 1) + '%' : '—', (R.walk_forward || {}).bets ? `tested plays so far (${R.walk_forward.wins}-${R.walk_forward.losses})` : 'tested plays so far (none yet)', ((R.walk_forward || {}).roi || 0) > 0 ? 'good' : '')}</div>` : '';
  const filt = `<div class="pfilt"><div class="chips">${['', ...stats].map(s => `<button class="chip ${PS.stat === s ? 'on' : ''}" data-ps="${s}">${s ? SN[s] || s : 'All'}</button>`).join('')}</div>
    <div class="row-flex"><input id="pq" class="search" placeholder="Search for a player…" value="${esc(PS.q)}"><select id="pg" class="search"><option value="">All games</option>${books.map(b => `<option value="${b.game_id}" ${+PS.game === +b.game_id ? 'selected' : ''}>${b.away} @ ${b.home}</option>`).join('')}</select>
    <select id="psort" class="search">${[['edge', 'Biggest disagreement'], ['ev', 'Best value'], ['move', 'Biggest line move'], ['player', 'Player A–Z']].map(([k, l]) => `<option value="${k}" ${PS.sort === k ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="muted">${L.length} lines</span></div></div>`;
  $('#view').innerHTML = head + rec
    + (plays.length ? card('Tested plays', `Best side at the current price. ${rulesText(rules, SN)}`, `<div class="plist2">${plays.map(x => propRow(x, cfg, gl_, true)).join('')}</div>`) : '')
    + (leans.length ? card('Biggest disagreements (untested leans)', 'Where Locksmith’s projection is furthest from DraftKings, blended with the market so the chances stay honest. These are not tested plays — treat them as a starting point.', `<div class="plist2">${leans.sort((a, z) => z.ev - a.ev).slice(0, 12).map(x => propRow(x, cfg, gl_, false)).join('')}</div>`) : '')
    + (ALL.length ? card('Every prop', 'Tap a line to see the full picture: the chance of each outcome, the last 10 games, why the projection is where it is, and how the price has moved.', filt + `<div class="plist2">${L.slice(0, PS.show).map(x => propRow(x, cfg, gl_, false)).join('')}</div>${L.length > PS.show ? `<button class="btn" id="pmore">Show more (${L.length - PS.show} left)</button>` : ''}`) : '')
    + propsRecord(cfg);
  document.querySelectorAll('[data-ps]').forEach(b => b.onclick = () => { PS.stat = b.dataset.ps; PS.show = 40; cfg.rerender(); });
  const q = $('#pq');
  if (q) {
    q.oninput = () => { clearTimeout(window.__pqt); window.__pqt = setTimeout(() => { PS.q = q.value; PS.show = 40; cfg.rerender(); const x = $('#pq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 220); };
    $('#pg').onchange = e => { PS.game = e.target.value; cfg.rerender(); };
    $('#psort').onchange = e => { PS.sort = e.target.value; cfg.rerender(); };
  }
  const more = $('#pmore'); if (more) more.onclick = () => { PS.show += 60; cfg.rerender(); };
  document.querySelectorAll('[data-pk]').forEach(el => el.onclick = e => { if (e.target.closest('.pdet')) return; PS.open = PS.open === el.dataset.pk ? null : el.dataset.pk; cfg.rerender(); });
}
const mv = x => ok(x.p_open) ? x.p_book - x.p_open : 0;

function rulesText(rules, SN) {
  if (!rules.length) return '';
  return 'Rules in force: ' + rules.slice(0, 4).map(r => `${r.stat === 'any' ? 'any prop' : (SN[r.stat] || r.stat).toLowerCase()} ${r.side === 'both' ? 'either side' : r.side + 's'} when Locksmith disagrees by ${Math.round(100 * r.edge)}%+ (${r.n} graded bets, ${sgn(100 * r.roi, 1)}%)`).join('; ') + '.';
}

function propRow(x, cfg, gl_, isPlay) {
  const SN = PSTAT[cfg.sport], pl = (cfg.P.players || {})[x.pid] || {}, k = pKey(x), open = PS.open === k;
  const pw = x.side === 'over' ? x.p_over : 1 - x.p_over, price = x.side === 'over' ? x.over_price : x.under_price;
  const h = x.hit10 || [0, 0];
  const tag = x.pick ? '<span class="badge good">tested play</span>' : x.lean ? '<span class="badge warn">lean</span>' : '';
  return `<div class="prop ${open ? 'open' : ''} ${isPlay ? 'play' : ''}" data-pk="${k}">
    <div class="ph"><div class="pwho">${hshot(cfg.sport, x.pid, x.player, 42)}<div class="who"><b>${esc(x.player)} ${tag}</b><span class="muted">${tlogo(x.team, 16, cfg.sport)} ${esc(x.team)} · ${esc(gl_[+x.game_id] || '')}</span></div></div>
      <div class="pbet"><b>${x.side === 'over' ? 'Over' : 'Under'} ${x.line}</b> ${SN[x.stat] || x.stat} <span class="muted">${pAm(price)}</span></div></div>
    <div class="pnums"><span><small>Locksmith</small><b>${fx(x.proj, 1)}</b></span><span><small>Chance ${x.side}</small><b>${pct(pw)}</b></span><span><small>DraftKings</small><b>${pct(x.side === 'over' ? x.p_book : 1 - x.p_book)}</b></span><span><small>${x.side === 'over' ? 'Over' : 'Under'} in last ${h[1] || 10}</small><b>${h[1] ? `${x.side === 'over' ? h[0] : h[1] - h[0]}/${h[1]}` : '–'}</b></span></div>
    ${open ? propDetail(x, pl, cfg) : ''}</div>`;
}

function propDetail(x, pl, cfg) {
  const SN = PSTAT[cfg.sport], lab = (SN[x.stat] || x.stat).toLowerCase();
  const d = (pl.dist || {})[x.stat];
  const last = (pl.last || {})[x.stat] || [], dates = (pl.last || {}).dates || [];
  const moveTxt = (() => {
    if (!ok(x.over_open)) return 'No opening price recorded.';
    const lm = ok(x.line_open) && x.line_open !== x.line ? ` The line moved from ${x.line_open} to ${x.line}.` : '';
    const dir = mv(x), tw = (x.side === 'over' ? dir > 0 : dir < 0);
    return `Opened over ${pAm(x.over_open)} / under ${pAm(x.under_open)}; now ${pAm(x.over_price)} / ${pAm(x.under_price)}.${lm} ${Math.abs(dir) < .01 ? 'Hardly moved.' : tw ? '<b class="pos">The market has moved toward Locksmith’s side</b> (a good sign: sharp money moves prop prices).' : '<span class="neg">The market has moved against Locksmith’s side.</span>'}`;
  })();
  const why = (cfg.sport === 'nba' || cfg.sport === 'wnba') ? ((pl.why || {})[x.stat] || []) : [];
  const whyMin = (cfg.sport === 'nba' || cfg.sport === 'wnba') ? ((pl.why || {}).min || []) : [];
  const ctx = (cfg.sport === 'nba' || cfg.sport === 'wnba')
    ? `Projected <b>${fx((pl.proj || {}).min, 0)} minutes</b> (usual ${fx(pl.usual_min, 0)})${whyMin.length ? ': ' + whyMin.map(w => `${esc(w.why.toLowerCase())} ${sgn(w.d, 1)}`).join(', ') : ''}. ${pl.team_total ? `Team expected to score ${fx(pl.team_total, 1)}.` : ''} ${pl.team_out_min > 20 ? `Teammates out tonight take about ${Math.round(pl.team_out_min)} minutes a game with them.` : ''} ${pl.status ? `<span class="badge warn">${esc(pl.status)}</span> (assumed to play)` : ''}`
    : `Projected <b>${fx(pl.toi, 1)} minutes</b> of ice time${pl.pp_unit ? `, on the ${esc(pl.pp_unit)} power play` : ''}. Expected ${fx((pl.proj || {}).sog, 1)} shots, ${fx((pl.proj || {}).goal, 2)} goals, ${fx((pl.proj || {}).assists, 2)} assists.`;
  const ms = (cfg.P.milestones || []).filter(m => m.pid === x.pid && m.stat === x.stat).sort((a, z) => a.k - z.k);
  return `<div class="pdet">
    <div class="grid g2">
      <div><h4>Chance of each outcome</h4>${d ? pDistSVG(d, x.line) : '<p class="muted">—</p>'}
        <p class="note">Locksmith alone: <b>${pct(x.p_model)}</b> over. With DraftKings’ price blended in (the honest number): <b>${pct(x.p_over)}</b>. DraftKings’ fair price: ${pct(x.p_book)} over${ok(x.p_open) ? ` (opened at ${pct(x.p_open)})` : ''}. Value at the current price: <b class="${x.ev > 0 ? 'pos' : 'neg'}">${sgn(100 * x.ev, 1)}%</b>.</p></div>
      <div><h4>Last ${last.length} games vs ${x.line}</h4>${last.length ? `<div class="l10">${last.map((v, i) => `<span class="${v > x.line ? 'ov' : 'un'}" title="${esc(dates[i] || '')}">${v}</span>`).join('')}</div><p class="note">${last.filter(v => v > x.line).length} of ${last.length} over ${x.line}. Average ${fx(last.reduce((a, b) => a + b, 0) / last.length, 1)}.</p>` : '<p class="muted">No games yet.</p>'}
        <h4>Why ${fx(x.proj, 1)} ${lab}</h4><p class="note">${ctx}</p>
        ${why.length ? `<div class="why">${why.map(w => `<div><span>${esc(w.why)}</span><b class="${w.d >= 0 ? 'pos' : 'neg'}">${sgn(w.d, 1)}</b></div>`).join('')}</div><p class="note">Each number is how much that factor moves tonight’s projection, compared with an average night.</p>` : ''}
        <h4>Price</h4><p class="note">${moveTxt}</p>
        ${ms.length ? `<h4>Milestones</h4>${table([{l: 'Bet'}, {l: 'DraftKings', r: 1}, {l: 'Locksmith', r: 1}], ms.map(m => `<tr><td>${m.k}+</td><td class="r num">${pAm(m.price)} <span class="muted">${pct(m.p_price)}</span></td><td class="r num ${m.p_model > m.p_price ? 'pos' : ''}">${pct(m.p_model)}</td></tr>`))}<p class="note">Milestones are one-sided and carry extra margin; they have not tested as profitable, so they are shown for information only.</p>` : ''}
      </div></div></div>`;
}

function pDistSVG(d, line) {
  const k0 = d[0], p = d[1], n = p.length, W = 320, H = 120, bw = W / n, mx = Math.max(...p, 1e-6);
  const over = p.reduce((a, v, i) => a + (k0 + i > line ? v : 0), 0);
  const step = n > 24 ? 5 : n > 12 ? 2 : 1;
  return `<svg viewBox="0 0 ${W} ${H + 18}" class="dist" role="img" aria-label="Chance of each outcome">
    ${p.map((v, i) => { const k = k0 + i, h = (H - 14) * v / mx; return `<rect x="${i * bw + 1}" y="${H - h}" width="${Math.max(bw - 2, 1)}" height="${h}" class="${k > line ? 'ov' : 'un'}"><title>${k}: ${(100 * v).toFixed(1)}%</title></rect>`; }).join('')}
    <line x1="${(line - k0 + 0.5) * bw}" x2="${(line - k0 + 0.5) * bw}" y1="0" y2="${H}" class="ln"/>
    <text x="${Math.min(W - 70, Math.max(4, (line - k0 + 0.5) * bw + 4))}" y="11" class="lt">line ${line}: ${(100 * over).toFixed(0)}% over</text>
    ${p.map((v, i) => (k0 + i) % step === 0 ? `<text x="${i * bw + bw / 2}" y="${H + 14}" class="ax">${k0 + i}</text>` : '').join('')}</svg>`;
}

function propsRecord(cfg) {
  const R = cfg.P.record || {}, SN = PSTAT[cfg.sport], MT = cfg.P.model_test;
  if (!R.n) return card('How props are tested', '', '<p class="note">Not enough graded lines yet.</p>');
  const bs = R.by_stat || {}, c = R.clv || {}, wf = R.walk_forward || {};
  const rows = Object.entries(bs).sort((a, z) => z[1].n - a[1].n).map(([k, v]) => `<tr><td>${SN[k] || k}</td><td class="r num">${v.n}</td><td class="r num">${pct(v.over_rate)} / ${pct(v.book_over)}</td><td class="r num ${v.ll_locksmith <= v.ll_open ? 'pos' : ''}">${fx(v.ll_locksmith, 3)} / ${fx(v.ll_open, 3)}</td><td class="r num">${(v.clv || {}).lines ? pct(v.clv.toward) : '–'}</td></tr>`);
  const tiers = (R.tiers || []).map(t => `<tr><td>${Math.round(100 * t.edge_at_least)}%+</td><td class="r num">${t.bets}</td><td class="r num">${t.bets ? t.wins + '-' + t.losses : '–'}</td><td class="r num ${t.roi >= 0 ? 'pos' : 'neg'}">${t.bets ? sgn(100 * t.roi, 1) + '%' : '–'}</td></tr>`);
  const mt = MT && MT.stats ? card('Is the projection any good?', `Every player-game of ${MT.seasons[0]}-${String((MT.seasons[MT.seasons.length - 1] + 1) % 100).padStart(2, '0')} (${MT.player_games.toLocaleString()} of them), each season projected by a model trained only on earlier seasons. Average miss — lower is better.`,
    table([{l: 'Stat'}, {l: 'Locksmith', r: 1}, {l: 'Old model', r: 1}, {l: 'Recent average', r: 1}], Object.entries(MT.stats).filter(([k]) => SN[k]).map(([k, v]) => `<tr><td>${SN[k]}</td><td class="r num pos"><b>${fx(v.mae_locksmith, 2)}</b></td><td class="r num">${fx(v.mae_v1, 2)}</td><td class="r num">${fx(v.mae_recent_avg, 2)}</td></tr>`))
    + (MT.mae_minutes && MT.teammate_out ? `<p class="note">Minutes: Locksmith misses by ${fx(MT.mae_minutes.locksmith, 2)} on average vs ${fx(MT.mae_minutes.recent_avg, 2)} for a recent average. When a 20-minute teammate is out, players gained ${sgn(MT.teammate_out.min_gain_actual, 2)} minutes on average; Locksmith expected ${sgn(MT.teammate_out.min_gain_locksmith, 2)}.</p>` : '')) : '';
  return `<div class="grid g2">${card('How props are tested', `${R.n.toLocaleString()} real DraftKings over/unders from ${R.dates[0]} to ${R.dates[1]} (${R.games} games), each priced by a model that never saw that game and graded on the box score at the OPENING line and price. Latest prices on finished games can be in-game prices, so they are never used.`,
      table([{l: 'Prop'}, {l: 'Lines', r: 1}, {l: 'Over hit / priced', r: 1}, {l: 'Accuracy: Locksmith / DK', r: 1}, {l: 'Moved toward', r: 1}], rows)
      + `<p class="note">Accuracy is log loss (lower is better). "Moved toward" = when the price moved between open and a genuine pre-game close, how often it moved toward Locksmith’s side (${c.lines || 0} lines; 50% would be no skill).</p>`)}
    ${card('If you bet every disagreement at the opener', 'Locksmith’s side at DraftKings’ opening price, by how much Locksmith disagreed. These are not the plays — the plays only come from rules that worked on earlier days.',
      table([{l: 'Disagreement'}, {l: 'Bets', r: 1}, {l: 'Won-lost', r: 1}, {l: 'Return', r: 1}], tiers)
      + `<p class="note">Rules chosen day by day from earlier days only: ${wf.bets ? `<b>${wf.wins}-${wf.losses}, ${sgn(100 * wf.roi, 1)}%</b>` : 'no bets yet (no rule qualified)'}.</p>`)}
    ${mt}</div>`;
}

function pPlays(P, books) {
  const gids = new Set(books.map(b => +b.game_id)), best = {};
  ((P || {}).lines || []).filter(x => x.pick && gids.has(+x.game_id)).sort((a, z) => z.ev - a.ev).forEach(x => { if (!best[x.pid]) best[x.pid] = x; });
  return Object.values(best);
}
function pPlaysHTML(PP, sport, books) {
  const g = {}; books.forEach(b => g[+b.game_id] = `${b.away} at ${b.home}`);
  return `<div class="tickets">${PP.slice(0, 8).map(x => propTicket({sport, pid: x.pid, player: x.player, team: x.team, game: g[+x.game_id] || '', bet: `${x.side === 'over' ? 'Over' : 'Under'} ${x.line} ${(PSTAT[sport][x.stat] || x.stat).toLowerCase()}`, price: pAm(x.side === 'over' ? x.over_price : x.under_price), chance: x.side === 'over' ? x.p_over : 1 - x.p_over, note: `Locksmith ${fx(x.proj, 1)} · DraftKings ${pct(x.side === 'over' ? x.p_book : 1 - x.p_book)}`})).join('')}</div>`;
}
