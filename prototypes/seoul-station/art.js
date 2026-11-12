// PROTOTYPE - NOT FOR PRODUCTION
// Question: 상태창이 시키는 대로 알바 → 방 → 투자 → 집으로 올라가는 한 판이, 뭘 해야 할지 늘 분명하면서 20분 동안 재미있는가?
// Date: 2026-11-12
// 그림 모듈 — 그림 파일 없이 전부 인라인 SVG 문자열로 그린다. DOM 을 쓰지 않아 node 로도 불러올 수 있다.
// 규칙: 외곽선 없이 면 + 한 단계 그림자 · 색은 PAL 과 그 혼합만 · 글자/이모지/글꼴 기호 없음 · Math.random 없음.
(function () {
  'use strict';
  const P = window.PAL;

  // ───────── 기본 도구 ─────────
  let seq = 0;                                   // 그라디언트 · clipPath id 가 호출마다 달라지게 하는 카운터
  const uid = p => 'art-' + p + '-' + (++seq);
  const n = v => Math.round(v * 100) / 100;
  const rgb = h => [1, 3, 5].map(i => parseInt(h.substr(i, 2), 16));
  // 팔레트 색 두 개를 섞는다 (t=0 이면 a, 1 이면 b)
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const ex = e => (e ? ' ' + e : '');
  const op = v => `opacity="${n(v)}"`;
  const R = (x, y, w, h, f, rx, e) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rx ? ` rx="${rx}"` : ''} fill="${f}"${ex(e)}/>`;
  const E = (cx, cy, rx, ry, f, e) => `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${f}"${ex(e)}/>`;
  const D = (d, f, e) => `<path d="${d}" fill="${f}"${ex(e)}/>`;
  const S = (d, c, w, e) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${ex(e)}/>`;
  const PG = (pts, f, e) => `<polygon points="${pts}" fill="${f}"${ex(e)}/>`;
  const G = (body, tr, e) => `<g${tr ? ` transform="${tr}"` : ''}${ex(e)}>${body}</g>`;
  const at = (x, y, s) => `translate(${n(x)} ${n(y)})` + (s && s !== 1 ? ` scale(${s})` : '');
  const stops = list => list.map(st => `<stop offset="${st[0]}" stop-color="${st[1]}"${st[2] == null ? '' : ` stop-opacity="${st[2]}"`}/>`).join('');
  const lin = (id, x1, y1, x2, y2, list) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;
  const rad = (id, cx, cy, r, list) => `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${cx}" cy="${cy}" r="${r}">${stops(list)}</radialGradient>`;
  const svg = (w, h, body, mode, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="xMidYMid ${mode}" role="img" aria-label="${label}" style="display:block">${body}</svg>`;
  // 둥글게 퍼지는 빛 (가로등 · 스탠드 · 상태창)
  const glow = (cx, cy, r, c, o) => { const id = uid('g'); return `<defs>${rad(id, cx, cy, r, [[0, c, n(o)], [1, c, 0]])}</defs><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})"/>`; };
  // 바닥에 납작하게 번지는 빛
  const pool = (cx, cy, rx, ry, c, o) => G(glow(0, 0, rx, c, o), `translate(${cx} ${cy}) scale(1 ${n(ry / rx)})`);
  // 위에서 아래로 변하는 하늘/벽
  const skyFill = (x, y, w, h, list) => { const id = uid('s'); return `<defs>${lin(id, 0, y, 0, y + h, list)}</defs>` + R(x, y, w, h, `url(#${id})`); };
  // 씨앗이 같으면 늘 같은 수열 (별 · 눈 · 빌딩 높이)
  const rng = seed => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const stars = (seed, count, x, y, w, h, o) => {
    const r = rng(seed); let s = '';
    for (let i = 0; i < count; i++) {
      const sx = n(x + r() * w), sy = n(y + r() * h), k = n(.7 + r() * 1.1);
      s += D(`M${sx},${n(sy - k)} L${n(sx + k)},${sy} L${sx},${n(sy + k)} L${n(sx - k)},${sy} Z`, P.text, op(o * (.35 + r() * .5)));
    }
    return s;
  };
  // 직사각 빌딩 줄. lit 를 주면 불 켜진 창을 드문드문 찍는다
  const skyline = (x, base, w, seed, hMin, hMax, col, lit) => {
    const r = rng(seed); let s = '', cx = x;
    while (cx < x + w) {
      const bw = 14 + Math.floor(r() * 5) * 6, bh = hMin + r() * (hMax - hMin), ww = Math.min(bw, x + w - cx);
      s += R(cx, base - bh, ww, bh, col);
      if (lit) for (let wy = base - bh + 5; wy < base - 6; wy += 8) for (let wx = cx + 4; wx < cx + ww - 5; wx += 7) if (r() < .22) s += R(wx, wy, 3, 3.5, lit);
      cx += bw;
    }
    return s;
  };

  // ───────── 시간대 ─────────
  // top/bot = 하늘, tint/k = 사물에 섞는 빛, lamp = 가로등 · 스탠드 세기(0~1), beam = 창으로 드는 빛
  const PHASE = {
    morning: { top: mix(P.night2, P.down, .18), bot: mix(mix(P.night3, P.bad, .42), P.lamp, .22), tint: mix(P.down, P.night3, .5), k: .14, lamp: .3, beam: P.lamp, beamOp: .09, star: .3 },
    day: { top: mix(P.night3, P.down, .4), bot: mix(P.night3, P.text, .46), tint: mix(P.text, P.down, .3), k: .24, lamp: 0, beam: P.text, beamOp: .09, star: 0 },
    evening: { top: mix(P.night2, P.up, .24), bot: mix(mix(P.warm, P.up, .3), P.night2, .2), tint: mix(P.warm, P.up, .35), k: .2, lamp: .7, beam: P.warm, beamOp: .13, star: 0 },
    night: { top: P.night0, bot: P.night2, tint: P.night0, k: .3, lamp: 1, beam: null, beamOp: 0, star: 1 },
  };
  const amb = ph => c => mix(c, ph.tint, ph.k);            // 배경 · 가구
  const toneOf = ph => c => mix(c, ph.tint, ph.k * .5);    // 인물 (배경보다 덜 물든다)
  const skyOf = ph => [[0, ph.top], [1, ph.bot]];

  // ───────── 서명: 청록 홀로그램 창 (모서리 꺾쇠 + 줄 세 개) ─────────
  function holo(x, y, w, h, o) {
    o = o || {};
    const b = Math.min(w, h) * .26, m = Math.max(2, w * .04), sw = o.sw || Math.max(1.6, w * .028), lw = Math.max(1.6, h * .07);
    let s = glow(n(x + w / 2), n(y + h / 2), n(w * .95), P.sys, .2);
    s += R(x, y, w, h, P.sysDeep, 1.5, 'fill-opacity=".66"') + R(x, y, w, h * .2, P.sys, 1.5, op(.16));
    const c = (px, py, dx, dy) => `M${n(px)},${n(py + dy * b)} V${n(py)} H${n(px + dx * b)}`;
    s += S(c(x - m, y - m, 1, 1) + c(x + w + m, y - m, -1, 1) + c(x - m, y + h + m, 1, -1) + c(x + w + m, y + h + m, -1, -1), P.sys, sw, 'stroke-linecap="square" stroke-linejoin="miter"');
    s += S(`M${n(x + w * .14)},${n(y + h * .38)} H${n(x + w * .58)}`, P.sys, lw);
    s += S(`M${n(x + w * .14)},${n(y + h * .6)} H${n(x + w * .86)} M${n(x + w * .14)},${n(y + h * .8)} H${n(x + w * .46)}`, P.sys, lw * .8, op(.55));
    return G(s, '', o.op == null ? '' : op(o.op));
  }

  // ───────── 주인공 ─────────
  // 원점 = 후드티 밑단 가운데(엉덩이). 머리 폭 46, 선 키 약 119 → 약 3등신. 빛은 오른쪽(상태창)에서 온다.
  // o: pose 'stand'|'sit'|'cross'|'none' · face · armL/armR 'pocket'|'lap'|'down'|'up'|'hold' · item 'key'|'mug'
  //    lap 'paper' · hat 'sheep'|'snow' · glow 색(false 면 없음) · warm(왼쪽에 가로등빛) · tilt(머리 기울기) · tone(색 물들임)
  const ARM = { pocket: [[24, -25], [10, -11]], lap: [[24, -24], [13, -4]], down: [[24.5, -23], [24, -6]], up: [[30, -45], [34, -63]], hold: [[25, -24], [14, -21]] };
  function face(kind, dx, ink, shade, blushCol) {
    const ey = -62, mx = n(dx * .9);
    const both = fn => fn(n(-9 + dx), -1) + fn(n(9 + dx), 1);
    const open = x => E(x, ey, 2.5, 3.3, ink);
    const arcUp = x => S(`M${n(x - 3.2)},${ey + 1.2} q3.2,-4.2 6.4,0`, ink, 2);
    const arcDn = x => S(`M${n(x - 3.2)},${ey - .8} q3.2,3.4 6.4,0`, ink, 2);
    const half = x => D(`M${n(x - 2.8)},${ey - .2} a2.8,3 0 0 0 5.6,0 Z`, ink) + S(`M${n(x - 3.6)},${ey - .4} h7.2`, ink, 1.8) + S(`M${n(x - 3)},${ey + 5.4} q3,1.5 6,0`, shade, 1.2);
    const droop = (x, k) => S(`M${n(x - 4 * k)},${ey - 7.8} L${n(x + 4.4 * k)},${ey - 5.6}`, ink, 1.7);
    const blush = (x, k) => E(x + 4.5 * k, -56, 3.8, 2.3, blushCol, op(.55));
    const mouth = { flat: `M${mx - 3},-53 h6`, frown: `M${mx - 3.5},-52 q3.5,-2.2 7,0`, smile: `M${mx - 4.5},-54.5 q4.5,4.2 9,0`, tiny: `M${mx - 1.8},-53 h3.6` };
    if (kind === 'tired') return both(half) + both(droop) + S(mouth.frown, ink, 1.8);
    if (kind === 'sad') return both(arcDn) + both(droop) + S(mouth.frown, ink, 1.8);
    if (kind === 'content') return both(arcDn) + both(blush) + S(mouth.smile, ink, 1.8);
    if (kind === 'sleep') return both(arcDn) + S(mouth.tiny, ink, 1.8);
    if (kind === 'smile') return both(open) + both(blush) + S(mouth.smile, ink, 1.8);
    if (kind === 'joy') return both(arcUp) + both(blush) + D(`M${mx - 5.5},-55.5 q5.5,9 11,0 Z`, mix(P.up, P.hair, .45));
    return both(open) + S(mouth.flat, ink, 1.8);
  }
  function hero(o) {
    const t = o.tone || (c => c), lightCol = o.glow === false ? null : (o.glow || P.sys);
    const hood = t(P.hood), hoodSh = t(P.hoodShade), hoodHi = lightCol ? mix(hood, lightCol, .09) : hood;
    const skin = t(P.skin), skinSh = t(P.skinShade), hair = t(P.hair);
    const pants = t(P.pants), pantsSh = t(mix(P.pants, P.night0, .32)), shoe = t(P.shoe), shoeSh = t(mix(P.shoe, P.hoodShade, .45));
    const pose = o.pose || 'stand', aL = ARM[o.armL || 'pocket'], aR = ARM[o.armR || 'pocket'];
    let s = '';
    // 다리
    if (pose === 'stand') {
      s += R(-14, -3, 12, 30, pantsSh, 2) + R(2, -3, 12, 30, pants, 2) + R(-18, 24, 17, 8, shoeSh, 4) + R(1, 24, 17, 8, shoe, 4);
    } else if (pose === 'sit') {
      s += R(-14, 6, 11, 15, pantsSh, 2) + R(3, 6, 11, 15, pantsSh, 2) + R(-17, 18, 15, 8, shoeSh, 4) + R(2, 18, 15, 8, shoe, 4);
      s += R(-16.5, -4, 15, 14, pants, 6) + R(1.5, -4, 15, 14, pants, 6);
    } else if (pose === 'cross') {
      s += D('M-31,7 Q-31,-5 -17,-5 H17 Q31,-5 31,7 Q31,14 21,14 H-21 Q-31,14 -31,7 Z', pants);
      s += D('M-21,14 Q-31,14 -31,7 Q-31,4 -29,2 L-3,9 L-7,14 Z', pantsSh) + E(-7, 11.5, 6.5, 3.4, skinSh) + E(8, 11.5, 6.5, 3.4, skin);
    }
    // 후드(뒤) · 몸통 · 한 단계 그림자
    s += E(0, -46.5, 22, 8.5, hoodSh);
    s += D('M-20,-38 Q-20,-46 -12,-46 H12 Q20,-46 20,-38 L22,-3 Q22,0 19,0 H-19 Q-22,0 -22,-3 Z', hood);
    s += D('M-20,-38 Q-20,-46 -12,-46 H-6 L-5,0 H-19 Q-22,0 -22,-3 Z', hoodSh);
    // 팔 → 주머니 · 끈 → 든 것 → 손
    const arm = (k, p, col) => S(`M${19 * k},-40 L${p[0][0] * k},${p[0][1]} L${p[1][0] * k},${p[1][1]}`, col, 10.5);
    s += arm(-1, aL, hoodSh) + arm(1, aR, hoodHi);
    s += D('M-12,-17 H12 L15,-3 H-15 Z', hoodSh) + S('M-4,-44 V-35 M4,-44 V-36', t(mix(P.text, P.hood, .35)), 1.6);
    if (o.lap === 'paper') {                      // 무릎 덮은 신문지
      const pp = t(mix(P.text, P.night3, .3)), ppSh = t(mix(P.text, P.night3, .5));
      s += PG('-23,-9 22,-11 26,15 -21,18', pp) + PG('4,-10.2 22,-11 26,15 6,16.4', ppSh);
      s += S('M-18,-4 L-2,-4.8 M-18,1 L-2,.3 M-17.5,6 L-1.5,5.4 M-17,11 L-7,10.6', t(P.stone), 1.3, op(.7)) + R(9, -6, 11, 8, t(P.stone), 1, op(.5));
    }
    if (o.item === 'key') s += S('M39.5,-80 L50,-98.5 L54.2,-96.2 M47.3,-93.7 L51,-91.6', P.gold, 3.2) + `<circle cx="36" cy="-74.5" r="6" fill="none" stroke="${P.gold}" stroke-width="3.4"/>` + D('M61,-112 l1.7,4.6 4.6,1.7 -4.6,1.7 -1.7,4.6 -1.7,-4.6 -4.6,-1.7 4.6,-1.7 Z', P.lamp);
    if (o.item === 'mug') { const mg = t(mix(P.text, P.warm, .22)); s += S('M20,-28 q5,2.6 0,5.6', mg, 2) + R(9, -32, 11.5, 12, mg, 2) + S('M12,-36 q-2,-3 0,-6 M17,-36 q-2,-3 0,-6', t(P.text), 1.2, op(.4)); }
    if (o.armL && o.armL !== 'pocket') s += E(-aL[1][0], aL[1][1], 4.8, 4.8, skinSh);
    if (o.armR && o.armR !== 'pocket') s += E(aR[1][0], aR[1][1], 4.8, 4.8, skin);
    // 머리
    let h = E(-23, -62, 3.2, 4.2, skinSh) + E(23, -62, 3.2, 4.2, skin) + E(0, -66, 23, 21, skin);
    h += D('M-12,-83.9 A23,21 0 0 0 -12,-48.1 A30,30 0 0 1 -12,-83.9 Z', o.warm ? P.warm : skinSh, o.warm ? op(.45) : '');
    h += D('M-24.5,-65 C-25,-97 25,-97 24.5,-65 L22,-73 Q12,-70 4,-75 Q-4,-80 -16,-76 L-22,-69 Z', hair) + (o.hat ? '' : PG('-4,-88 2,-95 6,-87', hair));
    h += face(o.face || 'calm', o.look == null ? 2.5 : o.look, hair, skinSh, t(mix(P.skin, P.up, .45)));
    if (o.hat === 'sheep') {                      // 양머리 수건
      const tw = t(mix(P.text, P.warm, .14)), twSh = t(mix(mix(P.text, P.warm, .14), P.hoodShade, .42));
      h += D('M-24.5,-68 C-25,-98 25,-98 24.5,-68 Q0,-78 -24.5,-68 Z', tw);
      [-1, 1].forEach(k => { h += E(26 * k, -77, 8.5, 8.5, k < 0 ? twSh : tw) + S(`M${26 * k - 4.5},-77 a4.5,4.5 0 1 1 4.5,4.5 a2.4,2.4 0 1 1 -2.4,-2.4`, k < 0 ? tw : twSh, 1.8); });
    }
    if (o.hat === 'snow') h += D('M-22,-77 C-22,-97 22,-97 22,-77 Q15,-81 8,-78 Q0,-83 -8,-79 Q-16,-83 -22,-77 Z', mix(P.text, P.stoneLit, .08));
    if (lightCol) h += D('M12,-83.9 A23,21 0 0 1 12,-48.1 A30,30 0 0 0 12,-83.9 Z', lightCol, op(o.glowOp || .5));
    s += G(h, o.tilt ? `rotate(${o.tilt} 0 -48)` : '');
    if (o.hat === 'snow') s += E(-15, -45.5, 7, 2.6, mix(P.text, P.stoneLit, .08)) + E(15, -45.5, 7, 2.6, mix(P.text, P.stoneLit, .08));
    return s;
  }

  // ───────── 되풀이해 쓰는 배경 조각 ─────────
  // 옛 서울역 역사(돔 · 시계 · 좌우 날개). 폭 300 × 높이 165, 바닥선 y=165. c.lit = 불 켜진 날개 창 번호(0~5)
  function station(c) {
    const arch = (x, y, w, h, f) => D(`M${x},${y + h} V${y + w / 2} A${w / 2},${w / 2} 0 0 1 ${x + w},${y + w / 2} V${y + h} Z`, f);
    let s = R(0, 84, 300, 81, c.wall) + R(0, 80, 300, 5, c.trim);
    s += R(0, 68, 22, 14, c.wall) + PG('-2,68 11,58 24,68', c.roof) + R(278, 68, 22, 14, c.wall) + PG('276,68 289,58 302,68', c.roof);
    [26, 52, 78, 209, 235, 261].forEach((x, i) => { s += arch(x, 100, 13, 38, c.lit && c.lit.indexOf(i) >= 0 ? c.glow : c.win); });
    s += R(0, 150, 300, 15, c.base);
    s += D('M118,42 A32,26 0 0 1 182,42 Z', c.roof) + R(145, 8, 10, 10, c.wallHi) + PG('143,9 150,0 157,9', c.roof) + R(114, 40, 72, 12, c.wallHi);
    s += R(105, 56, 90, 109, c.wallHi) + PG('99,57 150,40 201,57', c.trim);
    s += arch(134, 94, 32, 56, c.lit ? c.glow : c.win) + S('M150,95 V150 M134,122 H166', c.wallHi, 1.6) + arch(111, 102, 11, 34, c.win) + arch(178, 102, 11, 34, c.win);
    s += R(105, 150, 90, 15, c.base);
    s += E(150, 73, 12, 12, c.trim) + E(150, 73, 9.8, 9.8, c.clock) + S('M150,73 V66.5 M150,73 L154.5,75.5', c.hand, 1.8);
    return s;
  }
  const stationCol = (a, lit, wings) => ({
    wall: a(mix(P.night2, P.stone, .3)), wallHi: a(mix(P.night2, P.stone, .58)), trim: a(mix(P.stone, P.stoneLit, .4)), roof: a(mix(P.night3, P.sysDim, .28)),
    base: a(mix(P.night1, P.stone, .28)), win: a(mix(P.night0, P.night2, .5)), glow: mix(P.warmDim, P.night1, .3),
    lit: lit ? wings : null, clock: lit ? mix(P.lamp, P.night3, .15) : a(mix(P.text, P.stoneLit, .4)), hand: P.night0,
  });
  // 가로등: x, 바닥 y, 높이, 켜짐(0~1), 기둥 색, 빛 반경
  function lampPost(x, y, h, lit, col, r) {
    const top = y - h;
    let s = lit > 0 ? glow(x, top + 6, r || 80, P.warm, .42 * lit) : '';
    s += R(x - 2, top + 12, 4, h - 12, col) + R(x - 5, y - 9, 10, 9, col, 1);
    s += PG(`${x - 6},${top + 12} ${x + 6},${top + 12} ${x + 9},${top} ${x - 9},${top}`, lit > 0 ? mix(col, P.lamp, .35 + .65 * lit) : mix(col, P.stoneLit, .45));
    return s + R(x - 11, top - 3, 22, 3.5, col, 1) + R(x - 3, top - 7, 6, 4.5, col, 1);
  }
  // 벤치: 왼쪽 x, 앉는 면 y, 폭
  function bench(x, y, w, a) {
    const wood = a(mix(P.warmDim, P.night2, .5)), woodHi = a(mix(P.warmDim, P.night2, .32)), metal = a(mix(P.stone, P.night1, .35));
    return R(x + 10, y - 37, 4, 68, metal) + R(x + w - 14, y - 37, 4, 68, metal) + R(x, y - 36, w, 8.5, wood, 1.5) + R(x, y - 23, w, 8.5, wood, 1.5)
      + R(x - 4, y, w + 8, 6, woodHi, 1.5) + R(x - 4, y + 6, w + 8, 3, wood);
  }
  // 실내 창: 틀 + 시간대 하늘 (+ 밤에는 별)
  function windowBox(x, y, w, h, ph, frame, seed) {
    let s = R(x - 4, y - 4, w + 8, h + 8, frame, 2) + skyFill(x, y, w, h, skyOf(ph));
    if (ph.star) s += stars(seed, Math.round(w * h / 1100), x + 3, y + 3, w - 6, h * .5, ph.star);
    return s;
  }
  // 모니터 (차트 선 또는 봉)
  function monitor(x, y, w, h, a, kind) {
    const bz = a(mix(P.night0, P.stone, .35)), sc = mix(P.night0, P.night2, .5), ix = x + 3, iy = y + 3, iw = w - 6, ih = h - 6;
    let s = R(x + w / 2 - 4, y + h, 8, 6, bz) + R(x + w / 2 - 13, y + h + 5, 26, 3, bz, 1.5) + R(x, y, w, h, bz, 3) + R(ix, iy, iw, ih, sc, 1);
    if (kind === 'line') s += S(`M${n(ix + iw * .08)},${n(iy + ih * .78)} L${n(ix + iw * .26)},${n(iy + ih * .56)} L${n(ix + iw * .42)},${n(iy + ih * .68)} L${n(ix + iw * .62)},${n(iy + ih * .34)} L${n(ix + iw * .76)},${n(iy + ih * .46)} L${n(ix + iw * .93)},${n(iy + ih * .16)}`, P.up, Math.max(1.4, h * .05));
    else [[.14, .5, .3, P.down], [.34, .3, .36, P.up], [.54, .42, .34, P.down], [.74, .16, .44, P.up]].forEach(q => { s += R(ix + iw * q[0], iy + ih * q[1], iw * .11, ih * q[2], q[3], .5) + R(ix + iw * (q[0] + .045), iy + ih * (q[1] - .1), iw * .02, ih * (q[2] + .2), q[3]); });
    return s;
  }
  // 종이 상자 (테이프 · 한 단계 그림자)
  function carton(x, y, w, h, label) {
    const bx = mix(P.warmDim, P.lamp, .16), sh = mix(P.warmDim, P.night2, .34), tape = mix(P.lamp, P.warmDim, .22);
    return R(x, y, w, h, bx, Math.max(1.5, w * .04)) + R(x + w * .76, y, w * .24, h, sh, Math.max(1.5, w * .04)) + R(x + w * .72, y, w * .1, h, sh) + R(x + w * .36, y, w * .15, h * .36, tape)
      + (label ? R(x + w * .1, y + h * .52, w * .3, h * .28, mix(P.text, P.night3, .12), 1) + S(`M${n(x + w * .15)},${n(y + h * .62)} h${n(w * .2)} M${n(x + w * .15)},${n(y + h * .71)} h${n(w * .13)}`, P.stone, Math.max(.8, w * .028)) : '');
  }

  // ───────── 장면 4곳 (460×300) ─────────
  const SCENE_NAME = ['서울역 광장 벤치', '찜질방 수면실', '고시원 방', '원룸'];

  function sceneStation(ph, key) {
    const a = amb(ph), tone = toneOf(ph), L = ph.lamp, far = a(mix(P.night1, P.night2, .7));
    let b = skyFill(0, 0, 460, 212, skyOf(ph));
    if (ph.star) b += stars(11, 24, 0, 0, 460, 110, ph.star);
    // 먼 건물 (대비 낮게) → 역사 → 광장 바닥
    b += R(300, 152, 42, 56, far) + R(342, 130, 46, 78, far) + R(388, 158, 34, 50, far) + R(422, 140, 38, 68, far);
    if (L > .5) b += R(350, 142, 4, 5, P.warmDim, 0, op(.55)) + R(364, 160, 4, 5, P.warmDim, 0, op(.55)) + R(432, 152, 4, 5, P.warmDim, 0, op(.55));
    b += G(station(stationCol(a, L > .5, [0, 1])), at(0, 42));
    b += R(0, 207, 460, 93, a(P.ground)) + R(0, 207, 460, 2.5, a(mix(P.ground, P.stone, .6))) + S('M0,240 H460 M0,276 H460', a(P.stone), 1, op(.4));
    // 가로등 (왼쪽) · 벤치 · 접힌 신문
    if (L > 0) b += pool(70, 262, 130, 22, P.warm, .2 * L);
    b += lampPost(38, 258, 176, L, a(mix(P.stone, P.night1, .3)), 108);
    b += E(224, 253, 106, 5.5, P.night0, op(.4)) + bench(138, 220, 172, a);
    b += R(150, 214.5, 36, 5.5, a(mix(P.text, P.night3, .32)), 1) + S('M154,217.2 H182', a(P.stone), 1, op(.6));
    // 주인공 (지침) + 상태창
    b += G(hero({ pose: 'sit', face: 'tired', lap: 'paper', tilt: 4, warm: L > .5, tone }), at(224, 220, 1.05));
    return b + holo(272, 94, 78, 50);
  }

  function sceneSauna(ph, key) {
    const a = amb(ph), tone = toneOf(ph), L = ph.lamp;
    const wall = a(mix(P.warmDim, P.night1, .64)), wallSh = a(mix(P.warmDim, P.night0, .76)), floor = a(mix(P.warmDim, P.night2, .5));
    const mat = a(mix(P.up, P.night2, .68)), matSh = a(mix(P.up, P.night1, .8)), wood = a(mix(P.warmDim, P.lamp, .08)), woodSh = a(mix(P.warmDim, P.night1, .4));
    let b = R(0, 0, 460, 206, wall);
    for (let i = 1; i < 10; i++) b += R(i * 46, 0, 1.5, 200, wallSh, 0, op(.55));
    b += R(0, 198, 460, 8, wallSh) + R(0, 206, 460, 94, floor);
    // 높은 창 · 창으로 드는 빛 · 벽등
    b += windowBox(44, 36, 92, 54, ph, wallSh, 4) + R(89, 36, 2, 54, wallSh) + R(36, 94, 108, 4, wallSh, 1);
    if (L > 0) b += glow(398, 76, 96, P.warm, .4 * L);
    b += R(396, 52, 4, 13, wallSh) + PG('386,64 410,64 405,83 391,83', L > 0 ? mix(P.warmDim, P.lamp, .3 + .7 * L) : a(mix(P.warmDim, P.stone, .5)));
    // 탕 표시 나무패 (그릇 + 김 세 줄)
    const sign = L > 0 ? mix(P.warmDim, P.warm, .3 + .5 * L) : a(mix(P.warmDim, P.lamp, .25));
    b += R(170, 40, 50, 46, wallSh, 5) + S('M181,68 a14,9 0 0 0 28,0', sign, 3) + S('M187,66 q-3,-4 0,-7.5 q3,-3.5 0,-7 M195,68 q-3,-4.5 0,-9 q3,-4.5 0,-9 M203,66 q-3,-4 0,-7.5 q3,-3.5 0,-7', sign, 2.4);
    // 매트 세 장 + 목침
    const matAt = (cx, px) => PG(`${cx - 56},228 ${cx + 56},228 ${cx + 66},282 ${cx - 66},282`, mat) + R(cx - 66, 282, 132, 5, matSh) + R(cx + px - 19, 219, 38, 14, wood, 4) + R(cx + px - 19, 228.5, 38, 4.5, woodSh, 2);
    b += matAt(66, 0) + matAt(222, 40) + matAt(378, 0);
    // 구운 계란 · 식혜
    b += R(152, 266, 38, 4, wood, 2) + E(161, 262, 4.4, 5.4, a(mix(P.warmDim, P.skin, .45))) + E(171, 263, 4.4, 5.4, a(mix(P.warmDim, P.skin, .28)));
    b += PG('177,250 187,250 185.5,266 178.5,266', a(mix(P.text, P.warm, .25))) + S('M183,250 L186,242', a(P.stoneLit), 1.4);
    // 주인공 (양머리 수건, 한숨 돌림) + 상태창
    b += E(222, 268, 40, 4, P.night0, op(.28));
    b += G(hero({ pose: 'cross', face: 'content', hat: 'sheep', armL: 'lap', armR: 'lap', warm: false, tone }), at(222, 252, 1.05));
    return b + holo(274, 106, 78, 50);
  }

  function sceneGosi(ph, key) {
    const a = amb(ph), tone = toneOf(ph), L = ph.lamp;
    const wall = a(mix(P.stone, P.night2, .42)), wallSh = a(mix(P.stone, P.night1, .62)), floor = a(mix(P.warmDim, P.night2, .66));
    const edge = mix(P.night2, P.stone, .25), next = mix(P.night1, P.night0, .4), slab = mix(P.night1, P.night2, .4);
    const wood = a(mix(P.warmDim, P.night2, .42)), woodSh = a(mix(P.warmDim, P.night1, .62));
    // 건물 단면: 양옆은 어두운 옆방, 가운데 좁은 칸이 내 방
    let b = R(0, 0, 460, 300, P.night0) + R(0, 26, 88, 210, next) + R(372, 26, 88, 210, next) + R(20, 48, 38, 30, mix(P.night1, P.night2, .35), 1) + R(402, 48, 38, 30, mix(P.night1, P.night2, .35), 1);
    b += R(96, 26, 268, 210, wall) + R(96, 26, 268, 9, wallSh) + R(96, 236, 268, 10, floor);
    b += R(0, 0, 460, 16, next) + R(0, 256, 460, 44, next) + R(96, 256, 268, 44, mix(P.night1, P.night0, .15)) + R(0, 16, 460, 10, slab) + R(0, 246, 460, 10, slab) + R(88, 0, 8, 300, edge) + R(364, 0, 8, 300, edge);
    // 작은 창 · 스탠드 불빛
    b += windowBox(118, 50, 50, 40, ph, wallSh, 6) + R(112, 94, 62, 3.5, wallSh, 1);
    if (L > 0) b += glow(330, 150, 84, P.warm, .42 * L);
    // 침대 (베개 · 갠 이불)
    b += R(102, 216, 152, 20, woodSh, 2) + R(102, 202, 152, 16, a(mix(P.stoneLit, P.night3, .25)), 3) + R(106, 192, 34, 12, a(mix(P.text, P.night3, .35)), 5);
    b += R(216, 188, 36, 15, a(mix(P.down, P.night3, .62)), 4) + R(216, 196, 36, 7, a(mix(P.down, P.night2, .7)), 3);
    // 좁은 책상 · 컵라면 · 스탠드
    b += R(274, 175, 4, 61, woodSh) + R(352, 175, 4, 61, woodSh) + R(278, 175, 74, 26, woodSh, 0, op(.6)) + R(268, 169, 94, 6, wood, 1.5);
    b += S('M282,138 q-4,-5 0,-10 q4,-5 0,-10 M293,140 q-4,-5 0,-10 q4,-5 0,-9', a(P.text), 1.8, op(.32));
    b += S('M292,152 L302,134 M296,152 L307,136', a(mix(P.warmDim, P.lamp, .3)), 1.8);
    b += PG('276,149 300,149 297,169 279,169', a(mix(P.text, P.warm, .12))) + PG('277,155 299,155 298,162 278,162', a(P.up)) + R(274.5, 146.5, 27, 3.5, a(mix(P.text, P.night3, .15)), 1.5);
    b += R(337, 165.5, 18, 3.5, woodSh, 1.5) + S('M346,166 V147 L335,139', a(mix(P.stone, P.night1, .2)), 2.6);
    b += PG('323,137 338,131 343,143 329,150', L > 0 ? mix(P.warmDim, P.lamp, .2 + .6 * L) : a(P.stoneLit));
    if (L > 0) b += PG('329,150 343,143 356,169 310,169', P.lamp, op(.14 * L));
    // 주인공 (담담) + 상태창
    b += G(hero({ pose: 'sit', face: 'calm', armL: 'lap', armR: 'lap', warm: false, tone }), at(184, 202, 1));
    return b + holo(270, 66, 76, 48);
  }

  function sceneOneroom(ph, key) {
    const a = amb(ph), tone = toneOf(ph), L = ph.lamp;
    const wall = a(mix(P.night3, P.warmDim, .14)), wallSh = a(mix(P.night2, P.warmDim, .08)), floor = a(mix(P.warmDim, P.night2, .56));
    const frame = a(mix(P.stoneLit, P.night3, .2)), wood = a(mix(P.warmDim, P.night2, .34)), woodSh = a(mix(P.warmDim, P.night1, .6)), metal = a(mix(P.stone, P.night1, .3));
    let b = R(0, 0, 460, 232, wall) + R(0, 224, 460, 8, wallSh) + R(0, 232, 460, 68, floor);
    // 큰 창 + 도시
    b += windowBox(26, 30, 178, 84, ph, frame, 8) + skyline(26, 114, 178, 21, 12, 40, mix(ph.bot, P.night0, key === 'night' ? .3 : .5), L > .5 ? P.warmDim : null);
    b += R(113.5, 30, 3, 84, frame) + R(16, 116, 198, 5, frame, 1) + R(22, 26, 16, 96, a(mix(P.hood, P.night2, .45)), 2);
    if (ph.beam) b += PG('70,238 226,238 286,298 104,298', ph.beam, op(ph.beamOp));
    // 책상 + 모니터 두 대
    if (L > 0) b += glow(120, 150, 84, mix(P.down, P.text, .4), .14 * L);
    b += R(42, 184, 5, 48, woodSh) + R(209, 184, 5, 48, woodSh) + R(150, 184, 59, 40, woodSh, 2) + R(155, 190, 49, 2.5, wood, 1) + R(155, 206, 49, 2.5, wood, 1);
    b += monitor(50, 130, 66, 42, a, 'line') + monitor(122, 130, 66, 42, a, 'bars') + R(36, 178, 186, 6, wood, 1.5) + R(96, 174.5, 46, 3.5, a(mix(P.stone, P.night1, .2)), 1.5);
    // 침대 · 스탠드
    if (L > 0) b += glow(438, 110, 96, P.warm, .4 * L);
    b += R(437, 112, 2.5, 96, metal) + PG('426,114 451,114 446,93 431,93', L > 0 ? mix(P.warmDim, P.lamp, .3 + .7 * L) : a(mix(P.stoneLit, P.lamp, .2)));
    b += R(338, 212, 122, 22, woodSh, 2) + R(338, 200, 122, 15, a(mix(P.stoneLit, P.night3, .2)), 4) + R(342, 189, 32, 13, a(mix(P.text, P.night3, .32)), 5);
    b += R(378, 197, 82, 24, a(mix(P.down, P.night3, .6)), 5) + R(378, 197, 82, 7, a(mix(P.down, P.stoneLit, .55)), 3.5);
    // 깔개 · 의자 · 주인공 (여유, 머그잔) + 상태창
    const chair = a(mix(P.stone, P.night1, .25)), chairHi = a(mix(P.stone, P.stoneLit, .3));
    b += E(272, 246, 34, 4, P.night0, op(.3)) + S('M250,244 L272,237 L294,244', metal, 4) + R(269.5, 212, 5, 27, metal) + R(239, 132, 66, 78, chair, 14) + R(239, 132, 9, 78, a(mix(P.stone, P.night0, .45)), 4.5)
      + R(233, 184, 9, 5, chairHi, 2.5) + R(302, 184, 9, 5, chairHi, 2.5) + R(236, 188, 3, 18, metal) + R(305, 188, 3, 18, metal) + R(241, 204, 62, 10, chairHi, 5);
    b += G(hero({ pose: 'sit', face: 'smile', armL: 'lap', armR: 'hold', item: 'mug', warm: false, tone }), at(272, 205, 1.02));
    return b + holo(322, 92, 78, 50);
  }

  function scene(tier, phase) {
    const key = PHASE[phase] ? phase : 'day', t = Math.max(0, Math.min(3, Math.round(Number(tier) || 0)));
    return svg(460, 300, [sceneStation, sceneSauna, sceneGosi, sceneOneroom][t](PHASE[key], key), 'slice', SCENE_NAME[t]);
  }

  // ───────── 사다리 카드 썸네일 (160×100) ─────────
  const THUMB_NAME = ['서울역', '찜질방', '고시원', '원룸', '내 집'];
  function thumb(tier) {
    const t = Math.max(0, Math.min(4, Math.round(Number(tier) || 0))), a = c => c, N = PHASE.night;
    let b = '';
    if (t === 0) {            // 돔과 시계 · 가로등 · 벤치
      b += skyFill(0, 0, 160, 84, skyOf(N)) + stars(3, 9, 0, 0, 160, 34, .9);
      b += G(station(stationCol(amb(N), true, [1, 4])), at(8, 84 - 165 * .46, .46)) + R(0, 84, 160, 16, P.ground) + R(0, 84, 160, 1.5, mix(P.ground, P.stone, .5));
      b += E(128, 93, 34, 5, P.warm, op(.12)) + G(lampPost(0, 0, 112, 1, mix(P.stone, P.night1, .2), 78), at(142, 95, .5)) + G(bench(0, 0, 150, a), at(52, 86, .34));
    } else if (t === 1) {     // 불가마 문 · 김 오르는 탕 표시 · 매트와 목침
      const wall = mix(P.warmDim, P.night1, .64), wallSh = mix(P.warmDim, P.night0, .74);
      b += R(0, 0, 160, 68, wall);
      for (let i = 1; i < 6; i++) b += R(i * 27, 0, 1.2, 66, wallSh, 0, op(.5));
      b += R(0, 65, 160, 3, wallSh) + R(0, 68, 160, 32, mix(P.warmDim, P.night2, .5)) + glow(40, 50, 50, P.warm, .32);
      b += D('M12,68 V42 A28,28 0 0 1 68,42 V68 Z', mix(P.warmDim, P.night2, .3)) + D('M23,68 V44 A17,17 0 0 1 57,44 V68 Z', mix(P.warm, P.bad, .35)) + D('M30,68 V48 A10,10 0 0 1 50,48 V68 Z', P.lamp, op(.7));
      b += S('M96,34 a21,13 0 0 0 42,0', P.warm, 3.6) + S('M105,32 q-4,-5 0,-10 q4,-5 0,-9 M117,34 q-4,-6 0,-12 q4,-6 0,-12 M129,32 q-4,-5 0,-10 q4,-5 0,-9', P.warm, 3);
      b += PG('84,76 150,76 158,95 78,95', mix(P.up, P.night2, .62)) + R(78, 95, 80, 3, mix(P.up, P.night1, .78)) + R(100, 69, 32, 11, mix(P.warmDim, P.lamp, .08), 3.5) + R(100, 76, 32, 4, mix(P.warmDim, P.night1, .4), 2);
    } else if (t === 2) {     // 어두운 칸들 사이, 불 켜진 좁은 내 칸 (침대 · 책상 · 컵라면)
      const slab = mix(P.night1, P.night2, .5), next = mix(P.night1, P.night0, .25), edge = mix(P.night2, P.stone, .3);
      b += R(0, 0, 160, 100, P.night0) + R(4, 14, 48, 74, next) + R(108, 14, 48, 74, next) + R(8, 74, 26, 6, P.night2, 2) + R(126, 74, 26, 6, P.night2, 2) + R(16, 26, 18, 14, P.night2, 1) + R(122, 26, 18, 14, P.night2, 1);
      b += R(56, 14, 48, 74, mix(P.stone, P.warmDim, .25)) + glow(80, 30, 44, P.warm, .5) + S('M80,14 V22', P.stone, 1.2) + E(80, 25.5, 2.6, 3.4, P.lamp);
      b += R(58, 78, 30, 10, mix(P.warmDim, P.night1, .55)) + R(58, 71, 30, 8, mix(P.stoneLit, P.text, .2), 2) + R(59, 66, 11, 6.5, mix(P.text, P.night3, .15), 2.5);
      b += R(98, 66, 2.5, 22, mix(P.warmDim, P.night1, .5)) + R(88, 63, 15, 3, mix(P.warmDim, P.night2, .2), 1) + PG('90.5,54 99.5,54 98.5,63 91.5,63', mix(P.text, P.warm, .1)) + R(90.5, 56.5, 9, 2.6, P.up) + S('M95,51 q-2,-3 0,-6', P.text, 1.2, op(.5));
      b += R(0, 8, 160, 6, slab) + R(0, 88, 160, 6, slab) + R(52, 8, 4, 86, edge) + R(104, 8, 4, 86, edge);
    } else if (t === 3) {     // 큰 창의 야경 · 모니터 두 대
      const wall = mix(mix(P.night3, P.warmDim, .14), P.night0, .2);
      b += R(0, 0, 160, 80, wall) + R(0, 80, 160, 20, mix(P.warmDim, P.night2, .6)) + R(0, 77, 160, 3, mix(wall, P.night0, .3));
      b += windowBox(11, 13, 70, 44, N, mix(P.stoneLit, P.night3, .2), 5) + skyline(11, 57, 70, 5, 8, 26, mix(P.night1, P.night3, .5), P.warmDim) + R(45, 13, 2, 44, mix(P.stoneLit, P.night3, .2)) + R(5, 59, 82, 3, mix(P.stoneLit, P.night3, .2), 1);
      b += glow(123, 50, 40, mix(P.down, P.text, .4), .26) + R(96, 68, 3, 12, mix(P.warmDim, P.night1, .55)) + R(149, 68, 3, 12, mix(P.warmDim, P.night1, .55));
      b += monitor(94, 36, 28, 22, a, 'line') + monitor(124, 36, 28, 22, a, 'bars') + R(91, 65, 64, 4, mix(P.warmDim, P.night2, .3), 1);
    } else {                  // 해 뜨는 하늘 아래 불 켜진 집
      const wallc = mix(P.lamp, P.stoneLit, .5), roof = mix(P.up, P.night2, .5);
      b += skyFill(0, 0, 160, 88, [[0, mix(P.night2, P.down, .22)], [.6, mix(P.night3, P.up, .32)], [1, mix(P.warm, P.up, .2)]]) + glow(122, 86, 62, P.lamp, .55) + E(122, 88, 15, 15, P.lamp);
      b += R(0, 86, 160, 14, mix(P.night2, P.good, .2)) + PG('72,86 90,86 100,100 62,100', mix(P.stone, P.warmDim, .25));
      b += R(100, 26, 9, 18, mix(roof, P.night1, .3)) + R(50, 48, 62, 38, wallc) + R(50, 48, 15, 38, mix(wallc, P.night3, .32)) + PG('41,50 81,19 121,50', roof) + PG('41,50 81,19 81,24 48,50', mix(roof, P.night1, .3));
      b += R(74, 62, 14, 24, mix(P.warmDim, P.night2, .3), 2) + E(84.5, 75, 1.3, 1.3, P.gold) + R(55, 58, 13, 12, P.warm, 1) + R(93, 58, 13, 12, P.warm, 1) + S('M61.5,58 V70 M99.5,58 V70', mix(P.warmDim, P.night2, .2), 1.2);
      b += R(23, 68, 4, 18, mix(P.warmDim, P.night1, .5)) + PG('13,74 25,42 37,74', mix(P.good, P.night2, .62));
    }
    return svg(160, 100, b, 'slice', THUMB_NAME[t]);
  }

  // ───────── 알바 (96×96) ─────────
  const JOB_NAME = { flyer: '전단지 알바', loading: '상하차 알바', store: '편의점 알바', delivery: '배달 알바' };
  const paper = mix(P.text, P.night3, .08), paperSh = mix(P.text, P.night3, .32), steel = P.stoneLit, steelHi = mix(P.stoneLit, P.text, .4);
  function job(id) {
    let b = '';
    if (id === 'loading') {           // 손수레에 쌓은 상자
      b += R(8, 90, 82, 2.5, P.stone, 1.2) + carton(34, 44, 44, 34, true) + carton(39, 18, 32, 26, false);
      b += S('M12,17 Q23,9 27,22 L31,79', steel, 4.5) + S('M12,17 Q17,13 21,13', P.warm, 5.5) + R(29, 77, 54, 4.5, steel, 2) + PG('27,66 36,66 35,82 29,82', steel);
      b += E(32, 82.5, 8.5, 8.5, mix(P.stone, P.night1, .15)) + E(32, 82.5, 3.4, 3.4, steelHi);
    } else if (id === 'store') {      // 불 켜진 편의점 앞
      const band = mix(P.good, P.sysDim, .4), wall = mix(P.stone, P.night3, .25);
      b += PG('10,90 62,90 70,96 2,96', P.lamp, op(.16)) + R(10, 30, 76, 58, wall, 2) + R(6, 16, 84, 17, band, 3) + R(6, 28, 84, 5, P.lamp, 2) + R(38, 19.5, 20, 6, mix(P.text, band, .25), 3);
      b += R(14, 39, 44, 43, mix(P.lamp, P.text, .35), 2) + R(14, 52, 44, 2.2, P.warmDim) + R(14, 67, 44, 2.2, P.warmDim);
      [[17, P.up], [23.5, P.gold], [30, P.down], [36.5, P.good], [43, P.up], [49.5, P.gold]].forEach((q, i) => { b += R(q[0], 44, 5, 8, q[1], 1) + R(q[0], 58 + (i % 2), 5, 9 - (i % 2), [P.good, P.up, P.gold, P.down, P.good, P.down][i], 1); });
      [[17, P.gold], [23.5, P.down], [30, P.up], [36.5, P.gold], [43, P.good], [49.5, P.up]].forEach(q => { b += R(q[0], 73, 5, 9, q[1], 1); });
      b += R(61, 38, 22, 50, steel, 1.5) + R(64, 41, 16, 44, mix(P.lamp, P.text, .55), 1) + PG('64,41 72,41 64,56', P.text, op(.5)) + R(66.5, 58, 2.4, 13, P.stone, 1.2) + R(6, 88, 84, 4, steel, 1.5);
    } else if (id === 'delivery') {   // 배달통 실은 스쿠터
      const body = mix(P.shoe, P.stoneLit, .12), bodySh = mix(P.stoneLit, P.shoe, .25), tire = mix(P.stone, P.night1, .15);
      b += R(6, 90, 84, 2.5, P.stone, 1.2) + S('M0,62 H6 M2,71 H9', P.stone, 2.2);
      b += S('M72,58 L75,80', steel, 3.6) + E(24, 80, 10, 10, tire) + E(24, 80, 3.8, 3.8, steelHi) + E(75, 80, 10, 10, tire) + E(75, 80, 3.8, 3.8, steelHi);
      b += D('M11,72 Q10,57 24,57 H47 L52,72 Z', body) + D('M11,72 Q10.6,66 12.5,62 H49 L52,72 Z', bodySh) + R(46, 68, 22, 5.5, bodySh, 2.5) + PG('62,74 66,37 73,37 78,62 72,63 70,74', body) + R(31, 51, 19, 6.5, P.stone, 3) + R(10.5, 61, 3.5, 6, P.up, 1);
      b += S('M61,33 L73,36', P.stone, 3.6) + S('M68,34 L71,25', steel, 2) + E(71.5, 23.5, 3.4, 2.6, steelHi) + E(74.5, 47, 3, 4.2, P.lamp);
      b += R(3, 25, 28, 27, P.warm, 3) + R(3, 44, 28, 8, P.warmDim, 3) + R(3, 44, 28, 3, P.warmDim) + R(3, 30.5, 28, 2.2, P.warmDim) + R(12, 35, 10, 7, P.lamp, 2) + R(8, 52, 22, 5, steel, 1);
    } else {                          // flyer: 전단지를 내미는 손
      const sheet = (ang, f, inner) => G(R(-18, -54, 36, 54, f, 2) + inner, `translate(50 66) rotate(${ang})`);
      b += sheet(-34, mix(P.text, P.night3, .5), '') + sheet(-11, paperSh, R(-14, -50, 28, 9, P.warmDim, 1));
      b += sheet(13, paper, R(-14, -50, 28, 11, P.warm, 1) + R(-14, -35, 12, 12, P.down, 1) + S('M2,-32 H13 M2,-26 H10 M-13,-17 H13 M-13,-11 H6', P.stone, 2, op(.75)));
      b += PG('0.1,86.7 34.1,65.2 45.9,83.8 11.9,105.3', P.hood) + PG('6,96 40,74.5 45.9,83.8 11.9,105.3', P.hoodShade) + PG('27.6,69.3 34.1,65.2 45.9,83.8 39.4,87.9', mix(P.hoodShade, P.night1, .25));
      b += E(49, 72, 11.5, 9.5, P.skin, 'transform="rotate(-28 49 72)"') + D('M41,79 Q50,84 58,75 L60,78 Q51,88 40,82 Z', P.skinShade) + E(46.5, 63.5, 4.6, 7.5, P.skin, 'transform="rotate(-18 46.5 63.5)"');
      id = 'flyer';
    }
    return svg(96, 96, b, 'meet', JOB_NAME[id] || JOB_NAME.flyer);
  }

  // ───────── 행동 (96×96) ─────────
  const ACT_NAME = { rest: '쉬기', study: '공부' };
  function act(id) {
    let b = '';
    if (id === 'study') {             // 펼친 책 + 오르는 차트 선
      const cover = mix(P.down, P.night3, .45);
      b += S('M12,8 V50 H86', P.stoneLit, 2.2, op(.7)) + S('M19,42 L32,31 L44,37 L60,21 L75,12.5', P.up, 4.2) + PG('85,7.5 72.4,7.6 77.4,17.4', P.up);
      b += PG('7,63 48,69 89,63 89,87 48,93 7,87', cover) + PG('11,59 48,65 48,89 11,83', paper) + PG('48,65 85,59 85,83 48,89', mix(paper, P.stoneLit, .22));
      b += S('M16,66 L43,70.4 M16,72 L43,76.4 M16,78 L34,81', P.stone, 1.7, op(.6)) + S('M53,70.4 L80,66 M53,76.4 L80,72 M53,82.4 L69,79.8', P.stone, 1.7, op(.6)) + S('M48,65 V89', P.stone, 1.4, op(.7));
    } else {                          // rest: 이불 덮고 자는 주인공 + 초승달
      id = 'rest';
      const blanket = mix(P.down, P.night3, .5), blanketHi = mix(P.down, P.stoneLit, .5), pillow = mix(P.text, P.night3, .16);
      b += R(15, 14, 66, 46, pillow, 12) + R(15, 46, 66, 14, mix(pillow, P.night3, .25), 7);
      b += G(hero({ pose: 'none', face: 'sleep', look: 0, glow: false }), at(48, 102, .95));
      b += D('M8,74 Q8,63 20,63 Q48,56 76,63 Q88,63 88,74 V86 Q88,93 81,93 H15 Q8,93 8,86 Z', blanket) + D('M8,74 Q8,63 20,63 Q48,56 76,63 Q88,63 88,74 V75 Q48,65 8,75 Z', blanketHi) + S('M28,82 Q48,77 68,82', mix(P.down, P.night2, .6), 2.2);
      b += D('M84,3 a8.5,8.5 0 1 0 7.5,12.5 a6.6,6.6 0 1 1 -7.5,-12.5 Z', P.gold) + D('M70,8 l1,2.6 2.6,1 -2.6,1 -1,2.6 -1,-2.6 -2.6,-1 2.6,-1 Z', P.lamp);
    }
    return svg(96, 96, b, 'meet', ACT_NAME[id]);
  }

  // ───────── 종목 문장 (48×48) ─────────
  const ASSET_NAME = { daejang: '대장전자', buldak: '화끈식품', hantang: '한탕바이오', coin: '달나라코인' };
  function asset(id) {
    let b = '';
    if (id === 'buldak') {            // 그릇 위로 오르는 불꽃
      const bowl = mix(P.up, P.night2, .38);
      b += D('M24,2 C30,9 36,14 34,22 C33,28 29,32 24,32 C19,32 14,28 14,22 C14,18 16,15 18,12 C19,15 20,16.5 21.5,16.5 C20.5,11 21.5,6 24,2 Z', mix(P.up, P.warm, .5));
      b += D('M24,15 C27,18.5 29.5,21.5 28.5,25 C27.8,28 26,30 24,30 C22,30 19.6,28 19.6,25 C19.6,21.5 22,19 24,15 Z', P.gold);
      b += D('M6,28 H42 C42,38 35,44 24,44 C13,44 6,38 6,28 Z', bowl) + D('M6,28 H42 C42,30 41.7,32 41,34 H7 C6.3,32 6,30 6,28 Z', mix(P.up, P.lamp, .2)) + R(17, 43, 14, 3.5, mix(bowl, P.night1, .3), 1.5);
    } else if (id === 'hantang') {    // 플라스크와 알약
      const glass = mix(P.stoneLit, P.text, .3), liq = P.good;
      b += D('M19,8 H29 V19 L41,39 Q43,44 38,44 H10 Q5,44 7,39 L19,19 Z', glass) + D('M14.2,27 H33.8 L41,39 Q43,44 38,44 H10 Q5,44 7,39 Z', liq) + D('M24,27 H33.8 L41,39 Q43,44 38,44 H24 Z', mix(P.good, P.sysDim, .35));
      b += E(19, 36, 2.6, 2.6, mix(P.good, P.text, .6)) + E(26.5, 32, 1.8, 1.8, mix(P.good, P.text, .6)) + E(23.5, 22, 1.7, 1.7, mix(glass, P.text, .6)) + R(16.5, 4.5, 15, 4.5, mix(P.stoneLit, P.text, .6), 2.2);
      b += G(R(-7, -3.6, 14, 7.2, P.text, 3.6) + D('M0,-3.6 H3.4 A3.6,3.6 0 0 1 3.4,3.6 H0 Z', P.up), 'translate(38.5 13.5) rotate(-42)');
    } else if (id === 'coin') {       // 육각 동전 (가운데 마름모)
      const gs = mix(P.gold, P.warmDim, .62);
      b += PG('24,3 42.2,13.5 42.2,34.5 24,45 5.8,34.5 5.8,13.5', P.gold) + PG('24,9 37,16.5 37,31.5 24,39 11,31.5 11,16.5', gs) + PG('24,39 37,31.5 37,16.5 34,14.8 34,29.8 21,37.2', mix(gs, P.night2, .25));
      b += PG('24,14.5 30.5,24 24,33.5 17.5,24', P.gold) + PG('24,19.5 27,24 24,28.5 21,24', gs);
    } else {                          // daejang: 반도체 칩
      id = 'daejang';
      const body = mix(P.night3, P.down, .5), pin = mix(P.gold, P.lamp, .45), die = mix(P.down, P.text, .45);
      [15, 24, 33].forEach(p => { b += R(p - 1.8, 3.5, 3.6, 9, pin, 1) + R(p - 1.8, 35.5, 3.6, 9, pin, 1) + R(3.5, p - 1.8, 9, 3.6, pin, 1) + R(35.5, p - 1.8, 9, 3.6, pin, 1); });
      b += R(9.5, 9.5, 29, 29, body, 4.5) + PG('38.5,14 38.5,34 34,38.5 14,38.5', mix(body, P.night1, .35)) + R(16, 16, 16, 16, die, 2.5) + R(20.5, 20.5, 7, 7, body, 1.2) + E(13.6, 13.6, 1.5, 1.5, die);
    }
    return svg(48, 48, b, 'meet', ASSET_NAME[id]);
  }

  // ───────── 화면용 아이콘 (24×24, currentColor) ─────────
  const F = 'fill="currentColor" stroke="none"';      // 면만
  const FS = 'fill="currentColor"';                   // 면 + 둥근 테두리(선 굵기만큼 통통해진다)
  const ICON = {
    cash: '<path d="M6.5 5.5h13a2 2 0 0 1 2 2v7"/><rect x="2.5" y="8.5" width="16" height="10.5" rx="2"/><circle cx="10.5" cy="13.75" r="2.3"/><path d="M5.6 13.75h.01M15.4 13.75h.01"/>',
    hp: `<path ${F} fill-rule="evenodd" d="M12 20.8C5.4 15.8 2.8 12.5 2.8 8.9c0-2.8 2.1-4.9 4.7-4.9 1.8 0 3.5 1 4.5 2.7C13 5 14.7 4 16.5 4c2.6 0 4.7 2.1 4.7 4.9 0 3.6-2.6 6.9-9.2 11.9zM13.2 7.8l-4 5.2h2.7l-1.1 3.7 4-5.3h-2.7z"/>`,
    house: '<path d="M3.5 11.5 12 4l8.5 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
    quest: `<path d="M6 21V3.5M3.5 21h5"/><path ${F} d="M7 4h11.5l-3 4 3 4H7z"/>`,
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5"/>',
    news: `<path d="M3.5 5h13v12.5a2 2 0 0 0 2 2h-13a2 2 0 0 1-2-2z"/><path d="M16.5 9.5h4v8a2 2 0 0 1-2 2"/><rect ${F} x="6.5" y="8" width="4" height="4" rx=".5"/><path d="M13 8.5h.8M13 11.5h.8M6.5 15.5h7"/>`,
    chart: '<path d="M4 4v16h16"/><path d="M7.5 15.5l3.5-4 3 2.5 5-6.5"/>',
    sound: `<path ${F} d="M3.5 9.5h3.5l5-4.3v13.6l-5-4.3h-3.5z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.3a8 8 0 0 1 0 11.4"/>`,
    mute: `<path ${F} d="M3.5 9.5h3.5l5-4.3v13.6l-5-4.3h-3.5z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>`,
    up: `<path ${F} d="M12 3l8 9h-4.8v8.5H8.8V12H4z"/>`,
    down: `<path ${F} d="M12 21l8-9h-4.8V3.5H8.8V12H4z"/>`,
    warn: '<path d="M12 3.5 21.5 20h-19z"/><path d="M12 10v4.5M12 17.3h.01"/>',
    check: '<path stroke-width="2.8" d="M4.5 12.5l5 5L19.5 6.5"/>',
    bed: `<path d="M3 5.5V19M3 14.5h18V19M11.5 14.5V12a1.5 1.5 0 0 1 1.5-1.5h5a3 3 0 0 1 3 3v1"/><rect ${F} x="5" y="10" width="4.5" height="3" rx="1.5"/>`,
    meal: '<path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0zM9 20.5h6"/><path d="M14.5 3.5 12.8 8.5M18.5 4.5l-3.7 4.3"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/>',
    rise: '<path d="M2.5 14.5 8 9.5l5.5 5"/><path d="M4 13.5v7h8v-7"/><path d="M15 9.5l5.5-5.5M16.5 4h4v4"/>',
    // ── 시간
    sun: '<path d="M2.5 18.5h19M7 18.5a5 5 0 0 1 10 0"/><path d="M12 9.5v-6M9.5 6 12 3.5 14.5 6M4.6 11.5l1.8 1.8M19.4 11.5l-1.8 1.8"/>',
    noon: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    moon: '<path d="M20.5 13.2A8.7 8.7 0 1 1 10.8 3.5a6.9 6.9 0 0 0 9.7 9.7z"/>',
    calendar: `<rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M3.5 10.5h17M8 3.5v4M16 3.5v4"/><rect ${F} x="13.5" y="13.5" width="4" height="4" rx="1"/>`,
    bill: '<path d="M6 3.5h12v17l-2-1.6-2 1.6-2-1.6-2 1.6-2-1.6-2 1.6z"/><path d="M9 8h6M9 11.5h6M9 15h3"/>', // 청구서: 매주 나가는 고정비
    // ── 돈 · 목표
    wallet: '<rect x="3" y="6.5" width="18" height="13.5" rx="2.5"/><path d="M21 11.5h-4a2 2 0 0 0 0 4h4M6.5 6.5 16 3.5v3"/>',
    coin: '<circle cx="10.5" cy="12" r="7.5"/><path d="M13.5 4.5a7.5 7.5 0 0 1 0 15M10.5 4.5h3M10.5 19.5h3M10.5 8.5l2.3 3.5-2.3 3.5L8.2 12z"/>',
    gift: '<rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5V20h14v-7.5M12 8.5V20"/><path d="M12 8.5c-1-3-3-4.5-4.5-4.5a2 2 0 0 0-2 2c0 1.5 1.5 2.5 6.5 2.5zM12 8.5c1-3 3-4.5 4.5-4.5a2 2 0 0 1 2 2c0 1.5-1.5 2.5-6.5 2.5z"/>',
    target: `<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle ${F} cx="12" cy="12" r="1.4"/>`,
    key: '<circle cx="7.5" cy="16.5" r="4"/><path d="M10.4 13.6 20 4M17 7l2.5 2.5M14 10l2 2"/>',
    percent: '<path d="M6 18.5 18 5.5"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    tag: `<path d="M3.5 3.5h8.2l8.9 8.9a1.5 1.5 0 0 1 0 2.1l-6.1 6.1a1.5 1.5 0 0 1-2.1 0L3.5 11.7z"/><circle ${F} cx="7.8" cy="7.8" r="1.4"/>`,
    // ── 상태 · 성장
    star: `<path ${FS} d="M12 3.5l2.5 5.3 5.8.8-4.2 4 1 5.8-5.1-2.8-5.1 2.8 1-5.8-4.2-4 5.8-.8z"/>`,
    fire: '<path d="M12 21.5c-3.8 0-6.5-2.7-6.5-6.3 0-2.4 1.3-4.3 2.8-5.7.3 1.5 1 2.4 2 2.7-.5-3.7.7-6.7 3.4-8.7.2 3.2 4.8 5.8 4.8 11.5 0 3.7-2.7 6.5-6.5 6.5z"/><path d="M12 21.5c-1.5 0-2.5-1-2.5-2.4 0-1.2.9-2.1 2.5-3.6 1.6 1.5 2.5 2.4 2.5 3.6 0 1.4-1 2.4-2.5 2.4z"/>',
    trophy: '<path d="M7 3.5h10v6a5 5 0 0 1-10 0z"/><path d="M7 5.5H4V7a3 3 0 0 0 3 3M17 5.5h3V7a3 3 0 0 1-3 3M12 14.5v3M8 20.5h8M9.5 17.5h5"/>',
    crown: '<path d="M3.5 8 8 12.5l4-7 4 7L20.5 8 19 18.5H5z"/>',
    sparkle: '<path d="M10 5.5c.7 5 2.5 6.8 7.5 7.5-5 .7-6.8 2.5-7.5 7.5-.7-5-2.5-6.8-7.5-7.5 5-.7 6.8-2.5 7.5-7.5z"/><path d="M18.5 3v5M16 5.5h5"/>',
    muscle: `<path ${F} d="M22 17c0-4.5-2.5-7.5-5.5-7.5-2 0-3.5 1.3-4.5 3.5l-.8-4.4c1.6-.3 2.6-1.6 2.6-3.2C13.8 3.5 12.3 2 10.4 2H8C6 2 4.6 3.5 4.6 5.4c0 1.6.2 2.6-.3 4.1C3 12.5 2 14.5 2 17c0 2.8 2.2 5 5 5h10c2.8 0 5-2.2 5-5z"/>`,
    zzz: '<path d="M4 11.5h7l-7 8.5h7M14 4h6l-6 7h6"/>',
    shield: '<path d="M12 3l7.5 2.8v5.7c0 4.5-3 8-7.5 9.5-4.5-1.5-7.5-5-7.5-9.5V5.8z"/>',
    eye: '<path d="M2.5 12c2.5-4.3 5.7-6.5 9.5-6.5s7 2.2 9.5 6.5c-2.5 4.3-5.7 6.5-9.5 6.5S5 16.3 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    bolt: `<path ${FS} d="M13 3.5 6 13h5l-.8 7.5L18 11h-5z"/>`,
    // ── 행동
    skip: `<path ${FS} d="M4.5 6.5v11l7-5.5zM13 6.5v11l7-5.5z"/>`,
    book: '<path d="M12 6.5c-2-1.5-4.5-2-8.5-2V18c4 0 6.5.5 8.5 2 2-1.5 4.5-2 8.5-2V4.5c-4 0-6.5.5-8.5 2zM12 6.5V20"/>',
    cart: `<path d="M2.5 3.5h2.8L7.5 15h10.8l2.2-8.5H6"/><circle ${F} cx="9" cy="19.5" r="1.6"/><circle ${F} cx="17" cy="19.5" r="1.6"/>`,
    sell: '<path d="M12 11V3M8.5 6.5 12 3l3.5 3.5"/><path d="M2.5 14.5v6M2.5 15.5H7l3 1.5h3.5a1.3 1.3 0 0 1 0 2.6H10M2.5 20H4l4 1.5h5.5l7-4a1.4 1.4 0 0 0-1.5-2.4l-3.5 2.4"/>',
    door: `<path d="M3.5 21h17M6.5 21V4.5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1V21"/><circle ${F} cx="14.3" cy="12.5" r="1.3"/>`,
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M5.5 15.5H5A1.5 1.5 0 0 1 3.5 14V5A1.5 1.5 0 0 1 5 3.5h9A1.5 1.5 0 0 1 15.5 5v.5"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.3 1-1.3 2M12 16.8h.01"/>',
    home: `<path ${F} fill-rule="evenodd" d="M9.5 21.5v-7.3L16 8.8l6.5 5.4v7.3zM14.6 21.5h2.8v-4h-2.8z"/><path d="M7 3.5 3 7.5l4 4M3 7.5h8.5a4 4 0 0 1 3.5 2"/>`,
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11.5v5M12 7.8h.01"/>',
    // ── 시세
    rocket: '<path d="M20.5 3.5c-5.5 0-9.5 2.5-12 7l5 5c4.5-2.5 7-6.5 7-12z"/><circle cx="15" cy="9" r="1.7"/><path d="M9.8 8.5H6l-2.5 3.5 4.3.3M15.5 14.2V18L12 20.5l-.3-4.3M7.8 14.2c-2.5.5-3.8 2.5-4.3 5.8 3.3-.5 5.3-1.8 6.3-3.8"/>',
    drop: '<path d="M3 6.5 9.5 13 13 9.5l8 8M21 12v5.5h-5.5"/>',
    skull: `<path d="M12 3.5a8 8 0 0 0-8 8c0 2.3 1 4.3 2.5 5.6V19A1.5 1.5 0 0 0 8 20.5h8a1.5 1.5 0 0 0 1.5-1.5v-1.9c1.5-1.3 2.5-3.3 2.5-5.6a8 8 0 0 0-8-8zM10.5 20.5V18M13.5 20.5V18"/><circle ${F} cx="9" cy="11.5" r="1.9"/><circle ${F} cx="15" cy="11.5" r="1.9"/>`,
    // ── 돌발 사건
    dice: `<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/>${[[8.2, 8.2], [15.8, 8.2], [12, 12], [8.2, 15.8], [15.8, 15.8]].map(p => `<circle ${F} cx="${p[0]}" cy="${p[1]}" r="1.4"/>`).join('')}`,
    purse: `<path d="M6.5 9.5h11c2.5 2.5 3.5 5.5 2.5 8-.7 1.8-2.2 2.5-4 2.5H8c-1.8 0-3.3-.7-4-2.5-1-2.5 0-5.5 2.5-8zM7 9.5a5 3.5 0 0 1 10 0"/><circle ${F} cx="10.8" cy="4.7" r="1.4"/><circle ${F} cx="13.2" cy="4.7" r="1.4"/>`,
    bird: '<path d="M13.5 8.5c0-2.5 1.3-4 3-4a2.7 2.7 0 0 1 2.7 2.7l2.3.9-2.5.9c-.3 5-3.5 9.5-8.5 9.5h-3l-4.5 1 3.5-5.5c1.5-3 4-5.5 7-5.5zM16.6 7.3h.01M10.5 18.5v3M8.5 21.5h4"/>',
    egg: `<path d="M12 3C8.5 3 5.5 8.2 5.5 13.2a6.5 6.5 0 0 0 13 0C18.5 8.2 15.5 3 12 3z"/><circle ${F} cx="12" cy="13.5" r="2.9"/>`,
    lunchbox: `<rect x="3" y="6.5" width="18" height="13" rx="2.5"/><path d="M12.5 6.5v13M12.5 13H21M5 3.5h14M15.5 9.8h2.5"/><circle ${F} cx="7.7" cy="13" r="1.7"/>`,
    chat: '<path d="M5 4.5h14a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2h-7.5L7 21v-4H5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2zM8 10.8h.01M12 10.8h.01M16 10.8h.01"/>',
    envelope: `<rect x="3" y="5.5" width="18" height="13.5" rx="2"/><path d="M3.5 7l8.5 4.5L20.5 7"/><path ${F} d="M12 17.8c-1.6-1.2-2.3-1.9-2.3-2.8 0-.7.5-1.2 1.2-1.2.4 0 .8.2 1.1.6.3-.4.7-.6 1.1-.6.7 0 1.2.5 1.2 1.2 0 .9-.7 1.6-2.3 2.8z"/>`,
    ticket: `<path d="M3.5 8A1.5 1.5 0 0 1 5 6.5h14A1.5 1.5 0 0 1 20.5 8v2a2 2 0 0 0 0 4v2a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 16v-2a2 2 0 0 0 0-4zM9.5 7.5V9M9.5 11.25v1.5M9.5 15v1.5"/><path ${F} d="M15 9.6l2 2.4-2 2.4-2-2.4z"/>`,
    play: `<rect x="3" y="5" width="18" height="14" rx="3"/><path ${FS} stroke-width="1.5" d="M10.2 9.2l4.6 2.8-4.6 2.8z"/>`,
    wrench: '<path d="M16.4 3.6 14.1 5.85l4.05 4.05L20.4 7.6A5 5 0 0 1 13.8 13.2l-6 6a2.11 2.11 0 0 1-3-3l6-6A5 5 0 0 1 16.4 3.6z"/>',
    clinic: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9.5 4.5V3h5v1.5M12 9.5V16M8.8 12.75h6.4"/>',
    swap: '<path d="M4 8.5h15M15.5 5 19 8.5 15.5 12M20 15.5H5M8.5 12 5 15.5 8.5 19"/>',
    umbrella: '<path d="M3 12.5a9 9 0 0 1 18 0zM12 12.5V19a2 2 0 0 1-4 0M12 3.5v-1"/>',
    cat: `<path d="M4.5 4l4.3 3.3c1-.4 2-.6 3.2-.6s2.2.2 3.2.6L19.5 4v9c0 4-3.3 7.5-7.5 7.5S4.5 17 4.5 13z"/><path stroke-width="2.6" d="M9 12.5h.01M15 12.5h.01"/><path ${FS} stroke-width="1" d="M11 15.3h2l-1 1.3z"/>`,
  };
  // 아이콘 이름 전부 (도움말 화면 · 점검용)
  function icons() { return Object.keys(ICON); }
  function icon(name) {
    const body = ICON[name] || '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block">${body}</svg>`;
  }

  // ───────── 제목 화면 배경 (1280×720) ─────────
  // 왼쪽에 역사 · 가로등 · 벤치의 주인공. 오른쪽 절반(x 640~1240, y 120~620)은 글자 자리라 어둡게 비운다.
  function title() {
    const a = amb(PHASE.night), post = mix(P.stone, P.night1, .35);
    let b = skyFill(0, 0, 1280, 632, [[0, P.night0], [.7, mix(P.night0, P.night1, .8)], [1, mix(P.night1, P.night2, .7)]]);
    b += stars(5, 56, 0, 0, 620, 350, .9) + stars(9, 14, 640, 0, 640, 100, .5);
    b += D('M96,92 a30,30 0 1 0 26,44 a24,24 0 1 1 -26,-44 Z', mix(P.lamp, P.night2, .25));
    // 먼 건물 → 역사
    const far = mix(P.night1, P.night0, .35);
    b += R(522, 560, 58, 72, far) + R(582, 588, 44, 44, far);
    b += G(station(stationCol(a, true, [0, 1])), at(-64, 632 - 165 * 1.95, 1.95));
    // 광장 바닥
    b += R(0, 632, 1280, 88, P.ground) + R(0, 632, 1280, 4, mix(P.ground, P.stone, .5)) + S('M0,668 H1280 M0,704 H1280', P.stone, 1.5, op(.3));
    // 가로등 · 벤치 · 작은 주인공 · 작은 청록 창
    b += pool(330, 676, 230, 30, P.warm, .2) + G(lampPost(0, 0, 150, 1, post, 108), at(296, 668, 1.7));
    b += E(442, 660, 112, 6, P.night0, op(.45)) + G(bench(0, 0, 172, a), at(356, 628, 1));
    b += G(hero({ pose: 'sit', face: 'tired', lap: 'paper', tilt: 4, warm: true, tone: toneOf(PHASE.night) }), at(440, 628, 1));
    b += holo(486, 528, 76, 50);
    // 오른쪽으로 갈수록 더 어둡게
    const v = uid('v');
    b += `<defs>${lin(v, 560, 0, 900, 0, [[0, P.night0, 0], [1, P.night0, .55]])}</defs>` + R(560, 0, 720, 720, `url(#${v})`);
    return svg(1280, 720, b, 'slice', '밤의 서울역 광장');
  }

  // ───────── 엔딩 (1280×720) ─────────
  // 둘 다 가운데~오른쪽(x 520~1200, y 140~600)에 글자가 올라가므로 그 뒤는 하늘(그라디언트)만 둔다.
  function ending(kind) {
    let b = '';
    if (kind === 'home') {            // 내 집 거실: 큰 창으로 해 뜨는 도시, 열쇠를 든 주인공
      const wall = mix(P.night3, P.warmDim, .3), frame = mix(wall, P.lamp, .32), floor = mix(P.warmDim, P.night2, .42);
      const sk = uid('s'), cp = uid('c'), sofa = mix(P.hood, P.night2, .42);
      b += R(0, 0, 1280, 720, wall) + R(0, 0, 446, 720, mix(wall, P.night1, .22));
      b += `<defs>${lin(sk, 0, 96, 0, 652, [[0, mix(P.night2, P.down, .2)], [.6, mix(P.night3, P.up, .3)], [1, mix(P.warm, P.up, .16)]])}<clipPath id="${cp}"><rect x="470" y="96" width="766" height="556"/></clipPath></defs>`;
      b += R(458, 84, 790, 580, frame, 4) + R(470, 96, 766, 556, `url(#${sk})`);
      b += G(glow(524, 650, 340, P.lamp, .55) + E(524, 650, 47, 47, P.lamp) + skyline(470, 652, 150, 31, 6, 15, mix(P.night2, P.up, .16)) + skyline(620, 652, 616, 32, 12, 46, mix(P.night2, P.up, .16)), '', `clip-path="url(#${cp})"`);
      b += R(446, 652, 814, 16, frame, 3) + R(0, 668, 1280, 52, floor) + R(0, 668, 1280, 5, mix(P.warmDim, P.night1, .5)) + PG('470,673 1236,673 1170,720 300,720', P.lamp, op(.1));
      // 소파 (창 아래, 낮게)
      b += R(806, 612, 356, 86, mix(sofa, P.night1, .3), 16) + R(830, 648, 308, 44, sofa, 10) + R(792, 634, 46, 66, sofa, 14) + R(1130, 634, 46, 66, mix(sofa, P.lamp, .12), 14) + R(820, 698, 12, 10, P.night1) + R(1136, 698, 12, 10, P.night1);
      // 이삿짐 상자 · 주인공
      b += carton(34, 572, 132, 118, true) + carton(54, 478, 96, 94, false);
      b += E(290, 694, 96, 9, P.night0, op(.35)) + G(hero({ pose: 'stand', face: 'joy', armL: 'down', armR: 'up', item: 'key', glow: P.lamp, glowOp: .6, look: 3 }), at(290, 600, 2.9));
      return svg(1280, 720, b, 'slice', '내 집 거실의 아침');
    }
    // fail: 눈 오는 새벽의 서울역 벤치
    const a = c => mix(c, P.stoneLit, .2), snow = mix(P.text, P.stoneLit, .1), snowDim = mix(P.text, P.stoneLit, .45), ground = mix(P.stoneLit, P.text, .28);
    b += skyFill(0, 0, 1280, 612, [[0, mix(P.night1, P.stone, .2)], [1, mix(P.night3, P.stoneLit, .6)]]);
    const st = stationCol(a, false, null);
    b += G(station(st) + R(0, 78, 300, 2.6, snowDim, 1.3) + PG('99,57 150,40 201,57 195,57.5 150,43.6 105,57.5', snowDim) + D('M123,33 A32,26 0 0 1 177,33 A38,38 0 0 0 123,33 Z', snowDim) + PG('-2,68 11,58 24,68 20,68.5 11,61.3 2,68.5', snowDim) + PG('276,68 289,58 302,68 298,68.5 289,61.3 280,68.5', snowDim), at(-24, 608 - 165 * 1.5, 1.5));
    b += R(0, 608, 1280, 112, ground) + R(0, 608, 1280, 7, mix(P.stone, P.stoneLit, .7));
    b += G(lampPost(0, 0, 160, .4, mix(P.stone, P.night1, .2), 100) + R(-11, -164.5, 22, 3, snow, 1.5), at(98, 644, 1.5));
    b += E(292, 656, 150, 8, mix(P.stone, P.night2, .3), op(.4)) + G(bench(0, 0, 172, a) + R(0, -38.5, 172, 3.5, snow, 1.5) + R(-4, -2.5, 54, 3.5, snow, 1.5) + R(120, -2.5, 56, 3.5, snow, 1.5), at(172, 614, 1.4));
    b += G(hero({ pose: 'sit', face: 'sad', lap: 'paper', hat: 'snow', tilt: 5, glowOp: .3, tone: a }), at(292, 614, 1.4));
    b += E(340, 548, 8, 4.5, P.text, op(.13)) + holo(380, 476, 92, 58, { op: .5 });
    // 눈 (글자 자리에는 드물고 흐리게)
    const r = rng(77);
    for (let i = 0; i < 120; i++) {
      const x = r() * 1280, y = r() * 720, k = r(), inText = x > 500 && x < 1220 && y > 120 && y < 620;
      if (inText && i % 3) continue;
      b += E(x, y, 1.6 + k * 2.6, 1.6 + k * 2.6, snow, op(inText ? .2 : .35 + k * .45));
    }
    return svg(1280, 720, b, 'slice', '눈 오는 새벽의 서울역 벤치');
  }

  // ───────── 한눈에 보기 (그림 목록) ─────────
  function figures() {
    const out = [];
    ['flyer', 'loading', 'store', 'delivery'].forEach(id => out.push({ name: JOB_NAME[id], svg: job(id) }));
    ['rest', 'study'].forEach(id => out.push({ name: ACT_NAME[id], svg: act(id) }));
    THUMB_NAME.forEach((nm, i) => out.push({ name: nm + ' (사다리)', svg: thumb(i) }));
    ['daejang', 'buldak', 'hantang', 'coin'].forEach(id => out.push({ name: ASSET_NAME[id], svg: asset(id) }));
    SCENE_NAME.forEach((nm, i) => out.push({ name: nm + ' (밤)', svg: scene(i, 'night') }));
    return out;
  }

  window.Art = { scene, thumb, job, act, asset, icon, icons, title, ending, figures };
})();
