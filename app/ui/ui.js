// Locksmith :: shared visual building blocks (loaded before app.js): team logos, player photos, team colours,
// bet tickets and the matchup header. Images come from the leagues' / ESPN's public image servers and fall back
// to a lettered badge when offline.
const LOGO_NFL = {LA: 'lar', WAS: 'wsh'};
const LOGO_NHL = {};
function logoURL(sport, code) {
  if (!code) return '';
  if (sport === 'nhl') return `https://assets.nhle.com/logos/nhl/svg/${LOGO_NHL[code] || code}_${document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'}.svg`;
  if (sport === 'cfb') return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/ncaa/500/${code}.png&w=96&h=96`;
  const lg = sport === 'nba' || sport === 'wnba' ? sport : 'nfl', c = (sport === 'nba' || sport === 'wnba' ? code : (LOGO_NFL[code] || code)).toLowerCase();
  return `https://a.espncdn.com/combiner/i?img=/i/teamlogos/${lg}/500/${c}.png&w=96&h=96`;
}
function tlogo(code, size = 28, sport) {
  sport = sport || (typeof SPORT !== 'undefined' ? SPORT : 'nfl');
  return `<span class="tlg" style="--s:${size}px"><i>${esc(String(code || '').slice(0, 3))}</i><img src="${logoURL(sport, code)}" alt="" loading="lazy" onload="this.parentNode.classList.add('ok')" onerror="this.remove()"></span>`;
}
function headURL(sport, id) {
  if (!id) return '';
  if (sport === 'nhl') return `https://assets.nhle.com/mugs/nhl/latest/${id}.png`;
  return `https://a.espncdn.com/combiner/i?img=/i/headshots/${sport === 'nba' || sport === 'wnba' ? sport : sport === 'ufc' ? 'mma' : 'nfl'}/players/full/${id}.png&w=96&h=70&cb=1`;
}
function hshot(sport, id, name, size = 40) {
  const ini = String(name || '').split(' ').map(w => w[0] || '').slice(0, 2).join('');
  return `<span class="hs" style="--s:${size}px"><i>${esc(ini)}</i>${id ? `<img src="${headURL(sport, id)}" alt="" loading="lazy" onload="this.parentNode.classList.add('ok')" onerror="this.remove()">` : ''}</span>`;
}
// a team colour that reads on the current background (dark navy on a dark page is invisible)
function _lum(hex) { const h = hex.replace('#', ''); if (h.length < 6) return .5; const v = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2]; }
function tcolor(code, sport) {
  sport = sport || (typeof SPORT !== 'undefined' ? SPORT : 'nfl');
  const pal = sport === 'nhl' ? (typeof NHL_COL !== 'undefined' && NHL_COL[code]) : sport === 'nba' ? (typeof NBA_COL !== 'undefined' && NBA_COL[code]) : (typeof TEAMC !== 'undefined' && TEAMC[code]);
  if (!pal) return '#7f8c86';
  const light = document.documentElement.dataset.theme === 'light';
  const okc = c => light ? _lum(c) < .45 : _lum(c) > .09;
  const c = pal.find(okc);
  return c || (light ? pal[0] : `color-mix(in srgb, ${pal[0]} 50%, #fff)`);
}
// two teams whose colours clash (two reds) -> the home side uses its next colour that differs
function _rgb(h) { h = String(h).replace('#', ''); return h.length >= 6 ? [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) : null; }
function tpair(a, h, sport) {
  const ca = tcolor(a, sport); let ch = tcolor(h, sport);
  const x = _rgb(ca), y = _rgb(ch);
  if (x && y && Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 90) {
    const pal = (sport === 'nhl' ? NHL_COL : sport === 'nba' ? NBA_COL : (typeof TEAMC !== 'undefined' ? TEAMC : {}))[h] || [];
    const light = document.documentElement.dataset.theme === 'light';
    const alt = pal.find(c => { const z = _rgb(c); return z && Math.hypot(x[0] - z[0], x[1] - z[1], x[2] - z[2]) >= 90 && (light ? _lum(c) < .6 : _lum(c) > .09); });
    ch = alt || (light ? '#5b6a62' : '#c6d2ca');
  }
  return [ca, ch];
}
// win-chance ring
function ring(p, label = 'to win', size = 58) {
  const r = 22, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, +p || 0));
  return `<span class="ring" style="--s:${size}px"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="${r}" class="rt"/><circle cx="26" cy="26" r="${r}" class="rv" stroke-dasharray="${(v * c).toFixed(1)} ${c.toFixed(1)}"/></svg><b>${Math.round(100 * v)}<small>%</small></b><em>${label}</em></span>`;
}
// one bet as a ticket: o = {sport, away, home, when, bet, price, chance, chanceLabel, stars, note, attrs, tag}
function ticket(o) {
  const [ca, ch] = tpair(o.away, o.home, o.sport);
  return `<div class="ticket click" ${o.attrs || ''} style="--ca:${ca};--ch:${ch}">
    <div class="tk-m">${tlogo(o.away, 30, o.sport)}<span class="tk-at">@</span>${tlogo(o.home, 30, o.sport)}<div class="tk-g"><b>${esc(o.away)} at ${esc(o.home)}</b><span>${esc(o.when || '')}</span></div></div>
    <div class="tk-b"><div class="tk-bet">${esc(o.bet)}${o.price != null && o.price !== '' ? ` <span class="tk-px">${esc(o.price)}</span>` : ''}${o.stars ? ` <span class="tk-st">${starHTML(o.stars)}</span>` : ''}</div>
      ${o.note ? `<div class="tk-n">${o.note}</div>` : ''}${o.tag ? `<div class="tk-tag">${o.tag}</div>` : ''}</div>
    <div class="tk-r">${ring(o.chance, o.chanceLabel || 'to win')}</div></div>`;
}
// matchup header: o = {sport, away, home, awaySub, homeSub, score:[home, away], avg:[home, away], unit, pHome, eyebrow}
function matchupHero(o) {
  const hw = o.pHome >= .5, [ca, ch] = tpair(o.away, o.home, o.sport);
  const side = (code, sub, pts, avg, win, r) => `<div class="mh-t${r ? ' r' : ''}">${tlogo(code, o.compact ? 40 : 64, o.sport)}<div class="mh-n"><span class="mh-ab">${esc(code)}</span><span class="mh-sub">${sub || ''}</span></div>
    <div class="mh-s${win ? ' win' : ''}">${pts}</div>${avg != null ? `<span class="mh-avg">average ${fx(avg, 1)}${o.unit ? ' ' + o.unit : ''}</span>` : ''}</div>`;
  return `<div class="mhero${o.compact ? ' compact' : ''}" style="--ca:${ca};--ch:${ch}">${o.eyebrow ? `<div class="eyebrow mh-eb">${o.eyebrow}</div>` : ''}
    <div class="mh-row">${side(o.away, o.awaySub, o.score[1], o.avg && o.avg[1], !hw, false)}<div class="mh-mid">at</div>${side(o.home, o.homeSub, o.score[0], o.avg && o.avg[0], hw, true)}</div>
    ${winbar(o.pHome, o.home, o.away, o.sport)}</div>`;
}
function gameChips(list, cur, attr, sport) {
  return `<div class="chips gchips">${list.map(x => `<button class="chip gchip${x.game_id === cur ? ' on' : ''}" ${attr}="${x.game_id}">${tlogo(x.away, 18, sport)}<span>${x.away} @ ${x.home}</span>${tlogo(x.home, 18, sport)}</button>`).join('')}</div>`;
}
// one player prop as a ticket: o = {sport, pid, player, team, game, bet, price, chance, note, attrs}
function propTicket(o) {
  const c = tcolor(o.team, o.sport);
  return `<div class="ticket ptk${o.attrs ? ' click' : ''}" ${o.attrs || ''} style="--ca:${c};--ch:${c}">
    <div class="tk-m">${hshot(o.sport, o.pid, o.player, 44)}<div class="tk-g"><b>${esc(o.player)}</b><span>${tlogo(o.team, 14, o.sport)} ${esc(o.team || '')}${o.game ? ' · ' + esc(o.game) : ''}</span></div></div>
    <div class="tk-b"><div class="tk-bet">${esc(o.bet)}${o.price ? ` <span class="tk-px">${esc(o.price)}</span>` : ''}</div>${o.note ? `<div class="tk-n">${o.note}</div>` : ''}</div>
    <div class="tk-r">${ring(o.chance, 'to win')}</div></div>`;
}

// what a record is worth going forward: results vs what the line moves say the bets were worth (luck removed)
function expectBox(O, BS) {
  if (!O || O.exp_roi == null) return '';
  const ys = Object.keys(BS || {}), cur = ys.length ? BS[ys[ys.length - 1]] : null;
  const luck = cur && cur.exp_roi != null && cur.bets >= 8 ? ` This season so far: ${cur.wins}-${cur.losses} (${sgn(100 * cur.roi, 1)}%), while the lines moved toward these bets ${cur.avg_clv != null ? 'by ' + fx(Math.abs(cur.avg_clv), cur.avg_clv < 1 ? 2 : 1) + ' on average' : ''}, worth about ${sgn(100 * cur.exp_roi, 1)}%: ${cur.roi < cur.exp_roi ? 'that gap is bad luck, not a broken model' : 'results are running ahead of the line moves, so expect some give-back'}.` : '';
  return `<div class="verdict blue"><b>What to expect from here:</b> judged only by how far the lines moved toward these bets after they were placed (game luck removed), they were worth about <b>${sgn(100 * O.exp_roi, 1)}%</b> per bet${O.exp_roi < O.roi ? `, less than the ${sgn(100 * O.roi, 1)}% they actually returned. Past results ran ahead of the edge, so plan on the lower number, and only at the opening line.` : ', in line with the results.'}${luck}</div>`;
}
