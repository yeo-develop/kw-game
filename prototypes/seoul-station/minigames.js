// PROTOTYPE - NOT FOR PRODUCTION
// Question: 상태창이 시키는 대로 알바 → 방 → 투자 → 집으로 올라가는 한 판이, 뭘 해야 할지 늘 분명하면서 20분 동안 재미있는가?
// Date: 2026-11-12
// 알바 미니게임 4종: 전단지(flyer) · 상하차(loading) · 편의점(store) · 배달(delivery).
// 약속: window.Minigames = { list, create(id, opts), sprites() }.
// 결정적: 난수는 opts.rng 만, 시간은 update(dt) 로만 흐른다. 같은 씨앗 + 같은 입력이면 같은 result.
// 숙련도(level): 판 전체가 (1 + 0.08 x level) 배 빨라진다 = 같은 7초에 더 빨리, 더 많이 온다.
// 자동 점검용으로 game._state (내부 상태, 읽기만) 를 내놓는다.
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const W = 880, H = 380;            // 논리 크기
  const READY = 0.8, OUTRO = 0.5;    // 준비 · 마무리 길이(초)
  const TAU = Math.PI * 2, EPS = 1e-9;

  // palette.js 가 안 불렸을 때만 쓰는 예비 색 (같은 값)
  const SPARE_PAL = {
    night0: '#0b1022', night1: '#131b36', night2: '#1d2850', night3: '#2a3768', ground: '#1a2038', stone: '#39415f', stoneLit: '#4c5780',
    warm: '#ffb454', warmDim: '#c9853a', lamp: '#ffe2b0', sys: '#53e0ff', sysDim: '#2a8fb0', sysDeep: '#0f3a52',
    text: '#eaf2ff', dim: '#93a0c0', ink: '#0b1022', up: '#ff5d6c', down: '#5b8cff', gold: '#ffd166', good: '#6fe3a1', bad: '#ff8a5c',
    skin: '#f2c9a5', skinShade: '#d9a985', hair: '#2a2433', hood: '#7483a6', hoodShade: '#55638a', pants: '#39415f', shoe: '#dfe5f5',
  };
  function spareRng(seed) { // opts.rng 가 없을 때만 (고정 씨앗)
    let a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---------- 셈 도우미 ----------
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOut(t) { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); }
  function pop(t) { t = clamp(t, 0, 1); const u = t - 1, c = 1.70158; return 1 + (c + 1) * u * u * u + c * u * u; } // 살짝 넘쳤다 돌아옴
  function bump(t) { return t > 0 ? Math.sin(clamp(t, 0, 1) * Math.PI) : 0; }                                       // 0 에서 1 로 올랐다가 다시 0
  function decay(v, dt, dur) { return v > 0 ? Math.max(0, v - dt / dur) : 0; }
  function shuffle(a, rng) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.min(i, Math.floor(rng() * (i + 1))); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  // ---------- 색 도우미 ('#rrggbb' 만 받는다) ----------
  const rgbCache = {};
  function rgb(c) {
    let v = rgbCache[c];
    if (!v) { const n = parseInt(c.slice(1), 16); v = rgbCache[c] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    return v;
  }
  function mix(a, b, t) { const x = rgb(a), y = rgb(b); return 'rgb(' + Math.round(lerp(x[0], y[0], t)) + ',' + Math.round(lerp(x[1], y[1], t)) + ',' + Math.round(lerp(x[2], y[2], t)) + ')'; }
  function fade(c, a) { const x = rgb(c); return 'rgba(' + x[0] + ',' + x[1] + ',' + x[2] + ',' + a + ')'; }

  // ---------- 도형 도우미 ----------
  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function box(ctx, x, y, w, h, r, c) { ctx.fillStyle = c; rrect(ctx, x, y, w, h, r); ctx.fill(); }
  function disc(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  function oval(ctx, x, y, rx, ry, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); }
  function poly(ctx, pts, c) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath(); ctx.fill();
  }
  function roundPoly(ctx, pts, r) { // 꼭짓점을 둥글린 다각형 길 (채우기는 부르는 쪽에서)
    const n = pts.length / 2;
    ctx.beginPath();
    ctx.moveTo((pts[0] + pts[2 * n - 2]) / 2, (pts[1] + pts[2 * n - 1]) / 2);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; ctx.arcTo(pts[2 * i], pts[2 * i + 1], pts[2 * j], pts[2 * j + 1], r); }
    ctx.closePath();
  }
  function line(ctx, x1, y1, x2, y2, w, c) {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function crossMark(ctx, x, y, r, w, c) { line(ctx, x - r, y - r, x + r, y + r, w, c); line(ctx, x + r, y - r, x - r, y + r, w, c); }
  function checkMark(ctx, x, y, r, w, c) {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x - r * 0.3, y + r * 0.7); ctx.lineTo(x + r, y - r * 0.7); ctx.stroke();
  }
  function brackets(ctx, x, y, w, h, len, lw, c) { // 네 모서리 꺾쇠
    ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const c4 = [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]];
    for (const k of c4) { ctx.beginPath(); ctx.moveTo(k[0] + k[2] * len, k[1]); ctx.lineTo(k[0], k[1]); ctx.lineTo(k[0], k[1] + k[3] * len); ctx.stroke(); }
  }
  // 도형으로 그린 굵은 화살표. dir: 0 왼쪽 · 1 오른쪽 · 2 위
  function arrowShape(ctx, cx, cy, size, dir, c) {
    const s = size / 2;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(dir === 0 ? Math.PI : dir === 1 ? 0 : -Math.PI / 2);
    poly(ctx, [s, 0, 0, -0.92 * s, 0, -0.36 * s, -s, -0.36 * s, -s, 0.36 * s, 0, 0.36 * s, 0, 0.92 * s], c);
    ctx.restore();
  }

  // ---------- 손맛: 번쩍 · 튀는 숫자 · 조각 · 가위표 · 약한 흔들림 ----------
  function age(list, dt, life) { for (let i = list.length - 1; i >= 0; i--) { list[i].t += dt / life; if (list[i].t >= 1) list.splice(i, 1); } }
  function makeFx(P) {
    const floats = [], rings = [], bits = [], marks = [];
    const fx = { shake: 0, clock: 0, flashA: 0, flashC: P.text };
    fx.float = function (x, y, text, color) { floats.push({ x: x, y: y, text: text, color: color, t: 0 }); };
    fx.ring = function (x, y, color, r0, r1) { rings.push({ x: x, y: y, color: color, r0: r0, r1: r1, t: 0 }); };
    fx.burst = function (x, y, color, n, power) { // 난수 없이 정해진 각도로 퍼짐
      for (let i = 0; i < n; i++) {
        const a = i * 2.399963 + 0.6, sp = power * (0.55 + 0.45 * ((i * 3) % 4) / 3);
        bits.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - power * 0.4, color: color, t: 0 });
      }
    };
    fx.cross = function (x, y, r) { marks.push({ x: x, y: y, r: r, t: 0 }); };
    fx.kick = function (a) { if (a > fx.shake) fx.shake = a; };          // 흔들림(픽셀). 3 을 넘기지 않는다
    fx.flash = function (color, a) { fx.flashC = color; fx.flashA = a; };
    fx.update = function (dt) {
      fx.clock += dt;
      fx.shake = Math.max(0, fx.shake - dt * 20);
      fx.flashA = Math.max(0, fx.flashA - dt * 1.8);
      age(floats, dt, 0.6); age(rings, dt, 0.28); age(bits, dt, 0.36); age(marks, dt, 0.45);
      for (const b of bits) { b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 520 * dt; }
    };
    fx.offset = function () { return fx.shake > 0 ? [Math.sin(fx.clock * 90) * fx.shake, Math.cos(fx.clock * 70) * fx.shake * 0.6] : [0, 0]; };
    fx.draw = function (ctx, font) {
      for (const r of rings) {
        ctx.globalAlpha = 1 - r.t; ctx.strokeStyle = r.color; ctx.lineWidth = 5 * (1 - r.t) + 1;
        ctx.beginPath(); ctx.arc(r.x, r.y, lerp(r.r0, r.r1, easeOut(r.t)), 0, TAU); ctx.stroke();
      }
      for (const b of bits) {
        const s = 7 * (1 - b.t * 0.5);
        ctx.globalAlpha = 1 - b.t; ctx.fillStyle = b.color;
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 6); ctx.fillRect(-s / 2, -s / 2, s, s); ctx.restore();
      }
      for (const m of marks) {
        ctx.globalAlpha = m.t < 0.6 ? 1 : 1 - (m.t - 0.6) / 0.4;
        crossMark(ctx, m.x, m.y, m.r * pop(m.t * 4), Math.max(4, m.r * 0.36), P.bad);
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const f of floats) {
        const y = f.y - 34 * easeOut(f.t * 1.6), size = Math.round(24 * (1 + 0.5 * bump(f.t * 5)));
        ctx.globalAlpha = f.t < 0.6 ? 1 : 1 - (f.t - 0.6) / 0.4;
        ctx.font = '800 ' + size + 'px ' + font;
        ctx.fillStyle = P.ink; ctx.fillText(f.text, f.x + 2, y + 2);
        ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, y);
      }
      ctx.globalAlpha = 1;
    };
    return fx;
  }

  // ---------- 공통 틀: 준비 0.8초, 본 게임 seconds 초, 마무리 0.5초 ----------
  function bigText(ctx, P, font, text, size, color) {
    ctx.font = '800 ' + Math.round(size) + 'px ' + font;
    ctx.fillStyle = P.ink; ctx.fillText(text, W / 2 + 3, H / 2 + 4);
    ctx.fillStyle = color; ctx.fillText(text, W / 2, H / 2);
  }
  function build(opts, make) {
    opts = opts || {};
    const P = opts.pal || root.PAL || SPARE_PAL;
    const font = opts.font || root.FONT || 'sans-serif';
    const seconds = +opts.seconds > 0 ? +opts.seconds : 7;
    const level = clamp(+opts.level || 0, 0, 3);
    const rng = typeof opts.rng === 'function' ? opts.rng : spareRng(1);
    const fx = makeFx(P);
    const env = {
      P: P, font: font, seconds: seconds, level: level, speed: 1 + 0.08 * level, rng: rng, fx: fx,
      pick: function (n) { return Math.min(n - 1, Math.floor(rng() * n)); },
    };
    const impl = make(env);
    let t = 0, phase = 'ready', endT = 0, pending = null;
    impl.state.wt = -READY; impl.state.phase = phase;
    const game = {
      w: W, h: H, title: impl.title, howto: impl.howto, how: impl.how || [impl.howto], controls: impl.controls,   // howto = 창 머리의 한 줄, how = 처음 할 때 보여 주는 하는 법
      done: false, result: null,
      _state: impl.state,
      update: function (dt) {
        dt = +dt || 0;
        if (game.done || dt <= 0) return;
        t += dt;
        const wt = t - READY;                       // 본 게임 시각 (준비 동안은 음수)
        if (phase === 'ready' && wt >= -EPS) phase = 'play';
        impl.tick(dt, wt, phase === 'play');
        fx.update(dt);
        if (phase === 'play' && wt >= seconds - EPS) { phase = 'end'; pending = impl.finish(); }
        else if (phase === 'end') { endT += dt; if (endT >= OUTRO - EPS) { game.done = true; game.result = pending; } }
        impl.state.wt = wt; impl.state.phase = game.done ? 'done' : phase;
      },
      press: function (code) { if (phase === 'play' && !game.done) impl.press(code); },
      draw: function (ctx) {
        const wt = t - READY, o = fx.offset();
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
        ctx.fillStyle = P.night0; ctx.fillRect(0, 0, W, H);
        ctx.save(); ctx.translate(o[0], o[1]);
        impl.draw(ctx, wt);
        fx.draw(ctx, font);
        ctx.restore();
        if (fx.flashA > 0) { ctx.fillStyle = fade(fx.flashC, Math.min(0.3, fx.flashA)); ctx.fillRect(0, 0, W, H); }
        // 남은 시간: 위쪽 얇은 막대
        const left = clamp(1 - wt / seconds, 0, 1);
        box(ctx, 16, 7, W - 32, 8, 4, P.night3);
        if (left > 0) box(ctx, 16, 7, Math.max(8, (W - 32) * left), 8, 4, left < 0.25 ? P.gold : P.sys);
        // 준비 · 시작 · 끝
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (phase === 'ready' && !game.idle) {   // idle = 하는 법을 읽는 동안: 띠 없이 첫 장면만
          ctx.fillStyle = fade(P.night0, 0.66); ctx.fillRect(0, H / 2 - 58, W, 116);
          ctx.fillStyle = P.sys; ctx.fillRect(0, H / 2 - 58, W, 3); ctx.fillRect(0, H / 2 + 55, W, 3);
          bigText(ctx, P, font, '준비', 68 * Math.max(0.3, pop(t / 0.18)), P.text);
        } else if (phase === 'play' && wt < 0.45) {
          ctx.globalAlpha = 1 - wt / 0.45;
          bigText(ctx, P, font, '시작!', 68 * (1 + wt * 0.6), P.gold);
          ctx.globalAlpha = 1;
        } else if (phase === 'end') {
          const k = clamp(endT / 0.15, 0, 1);
          ctx.fillStyle = fade(P.night0, 0.5 * k); ctx.fillRect(0, 0, W, H);
          bigText(ctx, P, font, '끝!', 68 * Math.max(0.3, pop(k)), P.text);
        }
        ctx.restore();
      },
    };
    return game;
  }

  // =====================================================================
  // 1. 전단지 돌리기 — 옆에서 본 거리. 걷는 사람이 "건네는 자리"에 겹칠 때 Space
  // =====================================================================
  function drawFlyerSheet(ctx, P, x, y, s, rot) { // 전단지 한 장 (가운데 기준)
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
    box(ctx, -13, -18, 26, 36, 3, P.text);
    box(ctx, -13, -18, 26, 11, 3, P.warm);
    poly(ctx, [13, 8, 13, 18, 3, 18], P.lamp);          // 접힌 귀
    ctx.fillStyle = P.dim; ctx.fillRect(-8, -3, 16, 3); ctx.fillRect(-8, 3, 16, 3); ctx.fillRect(-8, 9, 9, 3);
    ctx.restore();
  }
  // 걷는 행인 (왼쪽을 봄). x, y = 발 가운데. o: { look 0~2, phase 걸음, flyer 받았는지, hop }
  function drawWalker(ctx, P, x, y, s, o) {
    o = o || {};
    const look = o.look || 0, sw = Math.sin(o.phase == null ? 0.9 : o.phase) * 0.5;
    const coat = [P.hood, P.warmDim, P.sysDim][look];
    const coatSh = [P.hoodShade, mix(P.warmDim, P.ink, 0.32), mix(P.sysDim, P.ink, 0.32)][look];
    const hipY = -46, shY = -90;
    const foot = function (a) { return [-Math.sin(a) * 44, hipY + Math.cos(a) * 44]; };
    const hand = function (a) { return [-2 - Math.sin(a) * 30, shY + Math.cos(a) * 30]; };
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    oval(ctx, 0, 3, 30, 6, fade(P.ink, 0.4));
    ctx.translate(0, -(o.hop || 0));
    // 뒤쪽 다리 · 팔
    let f = foot(-sw), h = hand(sw);
    line(ctx, 3, hipY, f[0] + 3, f[1] - 7, 16, mix(P.pants, P.ink, 0.3)); box(ctx, f[0] - 12, f[1] - 9, 22, 10, 4, mix(P.shoe, P.ink, 0.35));
    line(ctx, 2, shY, h[0] + 4, h[1], 12, coatSh);
    if (look === 2) box(ctx, 10, -102, 26, 46, 9, P.stoneLit);                 // 배낭
    if (look === 1) box(ctx, 0, -148, 28, 66, 13, P.hair);                     // 긴 머리
    // 앞쪽 다리
    f = foot(sw);
    line(ctx, -3, hipY, f[0] - 3, f[1] - 7, 16, P.pants); box(ctx, f[0] - 17, f[1] - 9, 22, 10, 4, P.shoe);
    // 몸
    if (look === 0) {          // 패딩
      box(ctx, -22, -104, 44, 64, 16, coat);
      ctx.fillStyle = coatSh; ctx.fillRect(-22, -86, 44, 3); ctx.fillRect(-22, -70, 44, 3);
    } else if (look === 1) {   // 긴 코트 + 목도리
      box(ctx, -19, -104, 38, 30, 12, coat);
      poly(ctx, [-18, -92, 18, -92, 27, -34, -27, -34], coat);
      box(ctx, -18, -109, 36, 12, 5, P.lamp); box(ctx, 6, -104, 11, 28, 4, P.lamp);
    } else {                   // 점퍼
      box(ctx, -21, -104, 42, 62, 14, coat);
      ctx.fillStyle = coatSh; ctx.fillRect(-9, -100, 3, 54);
    }
    // 앞쪽 팔 (전단지를 받으면 들고 간다)
    h = hand(o.flyer ? 1.15 : -sw);
    line(ctx, -2, shY, h[0], h[1], 12, coatSh); disc(ctx, h[0], h[1], 6.5, P.skin);
    if (o.flyer) drawFlyerSheet(ctx, P, h[0] - 9, h[1] - 10, 0.85, -0.25);
    // 머리
    disc(ctx, 0, -128, 26, P.hair); disc(ctx, -5, -125, 22.5, P.skin); oval(ctx, -17, -127, 2.6, 3.8, P.ink);
    if (look === 0) {          // 비니 + 방울
      ctx.fillStyle = P.warm; ctx.beginPath(); ctx.arc(-1, -131, 27, Math.PI, 0); ctx.closePath(); ctx.fill();
      box(ctx, -29, -136, 56, 9, 4, mix(P.warm, P.ink, 0.25)); disc(ctx, -1, -161, 7, P.lamp);
    } else if (look === 2) {   // 챙 모자
      ctx.fillStyle = P.stoneLit; ctx.beginPath(); ctx.arc(-1, -132, 26.5, Math.PI, 0); ctx.closePath(); ctx.fill();
      box(ctx, -46, -137, 34, 7, 3, P.stoneLit);
    }
    ctx.restore();
  }
  // 서류 가방 들고 뛰는 "바쁜 사람" (왼쪽으로). 앞으로 기운 몸 + 가방 + 날리는 넥타이 + 속도선
  function drawRunner(ctx, P, x, y, s, o) {
    o = o || {};
    const sw = Math.sin(o.phase == null ? 1.2 : o.phase) * 0.95;
    const suit = o.angry ? mix(P.stoneLit, P.bad, 0.5) : P.stoneLit, suitSh = mix(P.stoneLit, P.ink, 0.35);
    const hipY = -46;
    const foot = function (a) { return [4 - Math.sin(a) * 46, hipY + Math.cos(a) * 46 * (a < 0 ? 0.68 : 1)]; };
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    oval(ctx, 0, 3, 34, 6, fade(P.ink, 0.4));
    line(ctx, 46, -120, 86, -120, 4, fade(P.dim, 0.55)); line(ctx, 54, -90, 108, -90, 4, fade(P.dim, 0.4)); line(ctx, 46, -60, 80, -60, 4, fade(P.dim, 0.55));
    let f = foot(-sw);
    line(ctx, 6, hipY, f[0], f[1] - 7, 15, suitSh); box(ctx, f[0] - 10, f[1] - 9, 22, 10, 4, P.hair);
    f = foot(sw);
    line(ctx, 2, hipY, f[0], f[1] - 7, 15, mix(P.stoneLit, P.ink, 0.18)); box(ctx, f[0] - 16, f[1] - 9, 22, 10, 4, P.hair);
    ctx.translate(4, hipY); ctx.rotate(-0.3); ctx.translate(-4, -hipY);   // 윗몸을 앞으로 기울임
    line(ctx, 4, -92, 4 + Math.sin(sw) * 26 + 12, -92 + 24, 12, suitSh);   // 뒤쪽 팔
    box(ctx, -19, -104, 40, 62, 7, suit);
    poly(ctx, [-19, -101, -3, -101, -19, -76], P.text);                   // 셔츠 깃
    poly(ctx, [-13, -100, 20, -113, 25, -103, -10, -91], P.bad);          // 뒤로 날리는 넥타이
    const a = -sw * 0.7 + 0.35, hx = -2 - Math.sin(a) * 32, hy = -90 + Math.cos(a) * 32;
    line(ctx, -2, -90, hx, hy, 12, suitSh); disc(ctx, hx, hy, 6, P.skin);
    ctx.strokeStyle = mix(P.bad, P.ink, 0.4); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(hx, hy + 7, 8, Math.PI, 0); ctx.stroke();
    box(ctx, hx - 21, hy + 6, 42, 29, 4, P.bad);                           // 서류 가방
    ctx.fillStyle = mix(P.bad, P.ink, 0.4); ctx.fillRect(hx - 21, hy + 16, 42, 4); ctx.fillRect(hx - 3, hy + 13, 6, 10);
    disc(ctx, 0, -128, 25, P.hair); disc(ctx, -6, -125, 22, P.skin);
    box(ctx, -22, -155, 40, 16, 7, P.hair);                                // 넘긴 머리
    oval(ctx, -18, -128, 2.6, 3.8, P.ink); oval(ctx, -19, -113, 4, 3, P.ink);
    poly(ctx, [24, -150, 33, -155, 37, -149, 32, -145], P.sys); poly(ctx, [34, -134, 43, -138, 46, -132, 41, -129], P.sys); // 땀
    ctx.restore();
  }
  // 나: 후드티, 오른쪽을 보고 전단지를 내민다. o: { reach 0~1, droop 0~1, empty }
  function drawFlyerMe(ctx, P, x, y, s, o) {
    o = o || {};
    const hx = 50 + (o.reach || 0) * 28, hy = -92 + (o.droop || 0) * 16;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    oval(ctx, 0, 3, 34, 7, fade(P.ink, 0.4));
    line(ctx, -9, -46, -10, -13, 17, P.pants); line(ctx, 9, -46, 10, -13, 17, P.pants);
    box(ctx, -20, -10, 24, 11, 4, P.shoe); box(ctx, 0, -10, 26, 11, 4, P.shoe);
    disc(ctx, -5, -128, 31, P.hoodShade);                                  // 후드
    box(ctx, -25, -106, 50, 66, 17, P.hood);
    box(ctx, -13, -66, 28, 15, 7, P.hoodShade);                            // 앞주머니
    box(ctx, -36, -86, 24, 34, 3, P.lamp); box(ctx, -33, -90, 24, 34, 3, P.text); box(ctx, -33, -90, 24, 9, 3, P.warm); // 전단지 묶음
    line(ctx, -14, -92, -22, -64, 13, P.hoodShade); disc(ctx, -23, -62, 7, P.skin);
    disc(ctx, 3, -126, 23.5, P.skin);
    ctx.fillStyle = P.hair; ctx.beginPath(); ctx.arc(3, -126, 23.5, Math.PI * 0.95, Math.PI * 1.7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.hood; ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(1, -127, 27, Math.PI * 0.62, Math.PI * 1.6); ctx.stroke();
    oval(ctx, 15, -126, 2.8, 4, P.ink);
    line(ctx, 12, -92, hx, hy, 14, P.hood); box(ctx, hx - 5, hy - 8, 9, 16, 3, P.hoodShade); disc(ctx, hx + 7, hy, 7.5, P.skin);
    if (!o.empty) drawFlyerSheet(ctx, P, hx + 17, hy - 13, 1, 0.12);
    ctx.restore();
  }
  function drawLamp(ctx, P, x, y, s) { // 가로등. x, y = 기둥 발 (등은 왼쪽으로 68 나와 있음)
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    disc(ctx, -68, -250, 34, fade(P.lamp, 0.07)); disc(ctx, -68, -250, 18, fade(P.lamp, 0.12));
    box(ctx, -4, -262, 8, 262, 3, P.stone); box(ctx, -9, -16, 18, 16, 4, P.stoneLit);
    box(ctx, -72, -262, 76, 7, 3, P.stone); box(ctx, -88, -268, 40, 13, 6, P.stoneLit);
    box(ctx, -83, -256, 30, 7, 3, P.lamp);
    ctx.restore();
  }
  function streetBack(ctx, P, gy) { // 밤거리 배경 (좁은 밝기 범위)
    const g = ctx.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, P.night0); g.addColorStop(1, P.night1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, gy);
    const far = [[0, 124, 150], [128, 96, 112], [228, 150, 176], [398, 116, 126], [520, 170, 196], [698, 104, 142], [806, 80, 180]];
    for (let i = 0; i < far.length; i++) {
      const b = far[i], top = gy - 12 - b[2];
      ctx.fillStyle = i % 2 ? P.night2 : mix(P.night1, P.night2, 0.6); ctx.fillRect(b[0], top, b[1], b[2]);
      for (let r = 0; r * 30 + 34 < b[2]; r++) for (let c = 0; c * 26 + 30 < b[1]; c++) {
        const lit = (i * 7 + r * 5 + c * 3) % 6 === 0;
        ctx.fillStyle = lit ? fade(P.warmDim, 0.5) : P.night3; ctx.fillRect(b[0] + 12 + c * 26, top + 14 + r * 30, 12, 14);
      }
    }
    ctx.fillStyle = P.ground; ctx.fillRect(0, gy - 12, W, H - gy + 12);
    ctx.fillStyle = P.stone; ctx.fillRect(0, gy - 12, W, 3);
    ctx.fillStyle = P.night2; for (let x = 40; x < W; x += 96) ctx.fillRect(x, gy + 18, 54, 3);
  }

  function makeFlyer(env) {
    const P = env.P, rng = env.rng, fx = env.fx, seconds = env.seconds, speed = env.speed;
    const GY = 318, ZX = 240, ZH = 46, MX = 112;       // 바닥 · 건네는 자리 가운데 · 꺾쇠 반폭 · 내 자리
    const JH = ZH + 10;                                // 판정 반폭: 몸이 꺾쇠에 걸치면 인정 (눈에 보이는 것보다 박하지 않게)
    const n = Math.max(3, Math.round(9 * speed * seconds / 7));
    const busyAt = [], nBusy = Math.max(1, Math.round(n * 0.22));
    for (let guard = 0; busyAt.length < nBusy && guard < 80; guard++) {  // 첫 사람은 늘 보통 행인, 바쁜 사람끼리 연달아 오지 않음
      const i = 1 + env.pick(n - 1);
      if (busyAt.every(function (b) { return Math.abs(b - i) > 1; })) busyAt.push(i);
    }
    const first = 0.8, step = (seconds - 0.45 - first) / (n - 1), jit = Math.min(0.11, step * 0.16);
    const people = [];
    for (let i = 0; i < n; i++) {
      const busy = busyAt.indexOf(i) >= 0;
      const at = first + step * i + (rng() * 2 - 1) * jit;                 // 자리 한가운데에 닿는 시각
      const v = (busy ? 470 + 70 * rng() : 230 + 150 * rng()) * speed;     // 저마다 다른 속도
      people.push({ busy: busy, at: at, v: v, look: env.pick(3), state: 'walk', x: W + 300, hop: 0 });
    }
    const S = { people: people, total: n - busyAt.length, hits: 0, busyHits: 0, empties: 0, misses: 0, zoneX: ZX, zoneHalf: JH, lock: 0, reach: 0, glow: 0, warn: 0, papers: [] };
    function inZone() {
      for (const p of people) if (p.state === 'walk' && Math.abs(p.x - ZX) <= JH) return p;
      return null;
    }
    return {
      title: '전단지 돌리기', howto: '걷는 사람만, 손 앞에 오면 Space',
      how: ['걷는 사람이 꺾쇠 안에 들어오면 Space', '뛰어가는 사람에게 내밀거나, 아무도 없을 때 누르면 감점'],
      controls: [{ code: 'Space', label: '건네기' }],
      state: S,
      tick: function (dt, wt, playing) {
        for (const p of people) {
          p.x = ZX + p.v * (p.at - wt);
          p.hop = decay(p.hop, dt, 0.22);
          if (playing && p.state === 'walk' && !p.busy && p.x < ZX - JH) { p.state = 'missed'; S.misses++; S.warn = Math.max(S.warn, 0.7); }
        }
        S.lock = Math.max(0, S.lock - dt);
        S.reach = decay(S.reach, dt, 0.2); S.glow = decay(S.glow, dt, 0.3); S.warn = decay(S.warn, dt, 0.3);
        for (const q of S.papers) { q.t += dt; q.x += q.vx * dt; q.y = Math.min(GY - 4, q.y + q.vy * dt); q.vy += 900 * dt; }
      },
      press: function (code) {
        if (code !== 'Space' || S.lock > EPS) return;
        const p = inZone(), hx = ZX - 40, hy = GY - 92;
        S.reach = 1;
        if (!p) {                       // 헛누름
          S.empties++; S.lock = 0.2; S.warn = 1;
          fx.cross(hx + 22, hy - 40, 11); fx.kick(1.5);
        } else if (p.busy) {            // 바쁜 사람에게 내밀었다
          p.state = 'angry'; S.busyHits++; S.warn = 1;
          fx.cross(p.x, GY - 186, 16); fx.float(p.x + 40, GY - 180, '-1', P.bad); fx.kick(3); fx.flash(P.bad, 0.2);
          S.papers.push({ x: hx + 30, y: hy, vx: -70, vy: -220, t: 0 });
        } else {                        // 받아 감
          p.state = 'got'; p.hop = 1; S.hits++; S.glow = 1;
          fx.ring(hx + 30, hy, P.gold, 8, 46); fx.burst(hx + 30, hy, P.gold, 6, 150); fx.float(p.x, GY - 184, '+1', P.gold);
        }
      },
      finish: function () {
        return { score: clamp((S.hits - S.busyHits - 0.5 * S.empties) / S.total, 0, 1), hits: S.hits, total: S.total };
      },
      draw: function (ctx) {
        streetBack(ctx, P, GY);
        // 가로등 불빛이 떨어지는 곳 = 건네는 자리
        poly(ctx, [ZX - 15, 60, ZX + 15, 60, ZX + 66, GY + 8, ZX - 66, GY + 8], fade(P.lamp, 0.08));
        oval(ctx, ZX, GY + 6, 66, 10, fade(P.warm, 0.2));
        drawLamp(ctx, P, ZX + 68, GY - 10, 1);
        const here = inZone();
        const zc = S.warn > 0.05 ? P.bad : S.glow > 0.05 ? P.gold : here ? P.text : P.sys;
        const grow = 4 * bump(Math.max(S.glow, S.warn));
        ctx.globalAlpha = here || S.glow > 0.05 || S.warn > 0.05 ? 1 : 0.75;
        brackets(ctx, ZX - ZH - grow, GY - 172 - grow, ZH * 2 + grow * 2, 182 + grow * 2, 18, here ? 6 : 4, zc);
        ctx.globalAlpha = 1;
        // 행인: 보통 사람 먼저, 바쁜 사람이 위
        for (let pass = 0; pass < 2; pass++) for (const p of people) {
          if (p.busy !== (pass === 1) || p.x < -90 || p.x > W + 110) continue;
          if (p.busy) drawRunner(ctx, P, p.x, GY, 1, { phase: p.x / 22, angry: p.state === 'angry' });
          else drawWalker(ctx, P, p.x, GY, 1, { look: p.look, phase: p.x / 15, flyer: p.state === 'got', hop: 12 * bump(p.hop) });
        }
        const out = S.reach > 0 ? Math.sin(Math.PI * S.reach * S.reach) : 0;   // 누른 뒤 0.06초에 가장 길게
        drawFlyerMe(ctx, P, MX, GY, 1, { reach: out, droop: S.lock > 0 ? 0.6 : 0, empty: S.glow > 0.45 });
        for (const q of S.papers) if (q.t < 0.9) { ctx.globalAlpha = 1 - q.t / 0.9; drawFlyerSheet(ctx, P, q.x, q.y, 0.9, q.t * 7); ctx.globalAlpha = 1; }
      },
    };
  }

  // =====================================================================
  // 2. 상하차 — 컨베이어로 내려오는 상자를 분류선에서 표시된 방향키로 보낸다
  // =====================================================================
  const DIR_CODES = ['ArrowLeft', 'ArrowRight', 'ArrowUp'];
  function dirColor(P, d) { return d === 0 ? P.sys : d === 1 ? P.up : P.text; }   // 왼쪽 청록 · 오른쪽 빨강 · 위 흰색
  function drawSticker(ctx, P, x, y, size, dir) { // 방향 딱지: 색 바탕 + 도형 화살표
    box(ctx, x - size / 2, y - size / 2, size, size, size * 0.2, dirColor(P, dir));
    arrowShape(ctx, x, y, size * 0.68, dir, P.ink);
  }
  // 상자 (가운데 기준, 앞면 + 윗면 + 옆면). o: { rot, bad, plain 딱지 없음 }
  function drawCrate(ctx, P, x, y, s, dir, o) {
    o = o || {};
    const front = o.bad ? mix(P.warmDim, P.bad, 0.5) : P.warmDim;
    ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(s, s);
    poly(ctx, [25, -19, 33, -29, 33, 17, 25, 27], mix(P.warmDim, P.ink, 0.4));       // 옆면
    poly(ctx, [-33, -19, -25, -29, 33, -29, 25, -19], mix(P.warm, P.lamp, 0.4));      // 윗면
    poly(ctx, [-8, -19, 0, -29, 8, -29, 0, -19], P.lamp);                             // 테이프
    box(ctx, -33, -19, 58, 46, 3, front);                                             // 앞면
    ctx.fillStyle = mix(P.warmDim, P.ink, 0.22); ctx.fillRect(-33, 21, 58, 6);
    if (!o.plain) drawSticker(ctx, P, -4, 1, 36, dir);
    ctx.restore();
  }
  // 트럭 (옆에서 봄, 가운데 기준). 기본은 머리가 왼쪽 · 짐칸 뒤(오른쪽)가 열림. o: { flip, dir, pile, squash }
  function drawTruck(ctx, P, x, y, s, o) {
    o = o || {};
    const dir = o.dir || 0, f = o.flip ? -1 : 1, sq = (o.squash || 0) * 4;
    const cab = dir === 0 ? P.sysDim : mix(P.up, P.night2, 0.45);
    ctx.save(); ctx.translate(x, y); ctx.scale(s * f, s);
    oval(ctx, 0, 70, 130, 8, fade(P.ink, 0.45));
    ctx.fillStyle = P.night0; ctx.beginPath(); ctx.arc(-84, 50, 21, 0, TAU); ctx.arc(76, 50, 21, 0, TAU); ctx.fill();   // 바퀴
    disc(ctx, -84, 50, 9, P.stoneLit); disc(ctx, 76, 50, 9, P.stoneLit); disc(ctx, -84, 50, 3, P.dim); disc(ctx, 76, 50, 3, P.dim);
    ctx.translate(0, sq);
    box(ctx, -122, 34, 248, 10, 3, P.night3);                                         // 차대
    box(ctx, -40, -80, 168, 118, 8, P.stone);                                         // 짐칸
    box(ctx, -40, -80, 168, 13, 6, P.stoneLit);
    box(ctx, 44, -60, 84, 96, 4, P.night0);                                           // 열린 안쪽
    for (let i = 0; i < Math.min(o.pile || 0, 6); i++) drawCrate(ctx, P, 68 + (i % 2) * 36, 20 - Math.floor(i / 2) * 29, 0.56, dir, { plain: true });
    box(ctx, 124, -80, 8, 64, 3, P.stoneLit);                                         // 젖혀 둔 문
    box(ctx, -128, -36, 92, 74, 14, cab);                                             // 운전석
    poly(ctx, [-116, -26, -62, -26, -62, 4, -122, 4], P.night0);                      // 창
    line(ctx, -104, -18, -92, -2, 4, fade(P.text, 0.25));
    box(ctx, -130, 12, 10, 14, 3, P.lamp); box(ctx, -132, 30, 98, 9, 4, P.stoneLit);  // 전조등 · 범퍼
    ctx.restore();
    drawSticker(ctx, P, x + f * 2 * s, y + (sq - 24) * s, 46 * s, dir);               // 방향 표지 (뒤집히지 않게 따로)
  }
  // 선반 (가운데 기준). 위 방향 상자가 쌓인다
  function drawShelf(ctx, P, x, y, s, o) {
    o = o || {};
    ctx.save(); ctx.translate(x, y + (o.squash || 0) * 3); ctx.scale(s, s);
    box(ctx, -112, -26, 8, 54, 2, P.stoneLit); box(ctx, 104, -26, 8, 54, 2, P.stoneLit);
    poly(ctx, [-108, -22, 108, 22, 108, 26, -108, -18], P.stone);                     // 버팀대
    box(ctx, -116, 16, 232, 8, 3, P.stoneLit); box(ctx, -116, -30, 232, 6, 3, P.stone);
    for (let i = 0; i < Math.min(o.pile || 0, 5); i++) drawCrate(ctx, P, -72 + i * 37, 1, 0.52, 2, { plain: true });
    ctx.restore();
    drawSticker(ctx, P, x - 146 * s, y, 40 * s, 2);
  }
  // 작업 장갑 낀 내 손 (가운데 기준, 소매는 아래로). flip 이면 엄지가 왼쪽
  function drawGlove(ctx, P, x, y, s, flip, sleeve) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * (flip ? -1 : 1), s);
    box(ctx, -13, 24, 26, sleeve || 150, 8, P.hood);                                  // 소매
    box(ctx, -16, 12, 32, 16, 5, P.warm);                                             // 손목 띠
    box(ctx, -15, -12, 30, 30, 9, P.lamp);                                            // 손바닥
    for (let i = 0; i < 3; i++) box(ctx, -15 + i * 10.5, -26, 9, 22, 4.5, P.lamp);    // 손가락
    ctx.save(); ctx.translate(14, 0); ctx.rotate(0.6); box(ctx, -4, -14, 10, 20, 5, P.lamp); ctx.restore(); // 엄지
    ctx.fillStyle = mix(P.lamp, P.warmDim, 0.5); ctx.fillRect(-9, 2, 18, 3);
    ctx.restore();
  }

  function makeLoading(env) {
    const P = env.P, rng = env.rng, fx = env.fx, seconds = env.seconds, speed = env.speed;
    const BX = 440, BW = 116, LINE = 250, WIN = 36, TOP = 82, END = 344, GAP = 84, ACC = 0.5;
    const v0 = 128 * speed;                                   // 벨트 처음 속도. 끝날 때는 1.5배
    const travel = function (wt) {                            // 벨트가 흐른 거리
      if (wt <= 0) return v0 * wt;
      const w = Math.min(wt, seconds);
      return v0 * (w + ACC * w * w / (2 * seconds)) + v0 * (1 + ACC) * Math.max(0, wt - seconds);
    };
    const d0 = v0 * 0.85;
    const n = Math.max(3, 1 + Math.floor((travel(seconds - 0.45) - d0) / GAP));
    const dirs = [];
    for (let i = 0; i < n; i++) dirs.push(i % 3);
    shuffle(dirs, rng);
    for (let i = 2; i < n; i++) if (dirs[i] === dirs[i - 1] && dirs[i] === dirs[i - 2]) {     // 같은 방향 3연속은 풀어 준다
      for (let j = i + 1; j < n; j++) if (dirs[j] !== dirs[i]) { const t = dirs[i]; dirs[i] = dirs[j]; dirs[j] = t; break; }
    }
    const boxes = dirs.map(function (dir, i) { return { dir: dir, d: d0 + i * GAP, state: 'belt', x: BX, y: -200, t: 0, x0: 0, y0: 0, kx: 0 }; });
    const DEST = [[196, 226], [684, 226], [BX, 40]];          // 날아가 닿는 곳: 왼쪽 트럭 · 오른쪽 트럭 · 선반
    const S = { boxes: boxes, total: n, hits: 0, wrongs: 0, misses: 0, empties: 0, lineY: LINE, win: WIN, pile: [0, 0, 0], bounce: [0, 0, 0], push: 0, pushDir: 2, glow: 0, warn: 0, belt: 0 };
    function atLine() {
      for (const b of boxes) if (b.state === 'belt' && Math.abs(b.y - LINE) <= WIN) return b;
      return null;
    }
    return {
      title: '상하차', howto: '상자가 선에 오면 표시된 방향키',
      how: ['상자가 점선에 닿으면, 상자에 그려진 방향키', '다른 방향을 누르거나, 상자가 없을 때 누르면 감점'],
      controls: [{ code: 'ArrowLeft', label: '왼쪽 트럭' }, { code: 'ArrowUp', label: '위 선반' }, { code: 'ArrowRight', label: '오른쪽 트럭' }],
      state: S,
      tick: function (dt, wt, playing) {
        S.belt = travel(wt);
        for (const b of boxes) {
          if (b.state === 'belt') {
            b.y = LINE - b.d + S.belt;
            if (playing && b.y > LINE + WIN) { b.state = 'lost'; b.t = 0; S.misses++; S.warn = 1; fx.cross(BX, LINE + WIN + 8, 14); fx.kick(2); }   // 놓침
          } else if (b.state === 'fly') {
            b.t += dt / 0.24;
            if (b.t >= 1) { b.state = 'stored'; S.pile[b.dir]++; S.bounce[b.dir] = 1; }
          } else if (b.state === 'lost' || b.state === 'wrong') {
            b.t += dt / 0.45; b.y += 250 * dt; b.x += b.kx * 230 * dt;
            if (b.t >= 1) b.state = 'gone';
          }
        }
        S.push = decay(S.push, dt, 0.16); S.glow = decay(S.glow, dt, 0.25); S.warn = decay(S.warn, dt, 0.3);
        for (let i = 0; i < 3; i++) S.bounce[i] = decay(S.bounce[i], dt, 0.18);
      },
      press: function (code) {
        const dir = DIR_CODES.indexOf(code);
        if (dir < 0) return;
        const b = atLine(), sx = dir === 0 ? -1 : dir === 1 ? 1 : 0;
        S.push = 1; S.pushDir = dir;
        if (!b) {                       // 헛누름: 선에 상자가 없다
          S.empties++; S.warn = Math.max(S.warn, 0.6);
          fx.cross(BX + sx * 96, LINE - (dir === 2 ? 58 : 0), 10); fx.kick(1.5);
        } else if (b.dir === dir) {     // 맞음: 그쪽으로 날아감
          S.hits++; b.state = 'fly'; b.t = 0; b.x0 = b.x; b.y0 = b.y; S.glow = 1;
          fx.ring(BX, b.y, P.good, 22, 62); fx.burst(BX, b.y, P.gold, 6, 160); fx.float(BX - sx * 10, b.y - 40, '+1', P.gold);
        } else {                        // 틀린 키: 상자를 떨어뜨림
          S.wrongs++; b.state = 'wrong'; b.t = 0; b.kx = sx; S.warn = 1;
          fx.cross(BX, b.y, 20); fx.kick(3); fx.flash(P.bad, 0.18);
        }
      },
      finish: function () {
        return { score: clamp((S.hits - 0.34 * S.empties) / S.total, 0, 1), hits: S.hits, total: S.total };
      },
      draw: function (ctx) {
        // 창고 벽과 바닥
        ctx.fillStyle = P.night1; ctx.fillRect(0, 0, W, 302);
        ctx.fillStyle = P.night2; for (let x = 30; x < W; x += 170) ctx.fillRect(x, 0, 6, 302);
        ctx.fillStyle = P.ground; ctx.fillRect(0, 302, W, H - 302);
        ctx.fillStyle = P.stone; ctx.fillRect(0, 302, W, 3);
        // 벨트
        box(ctx, BX - BW / 2 - 9, TOP - 10, BW + 18, END - TOP + 10, 6, P.stone);
        ctx.fillStyle = P.night2; ctx.fillRect(BX - BW / 2, TOP - 10, BW, END - TOP + 4);
        ctx.fillStyle = P.night3;
        for (let y = TOP - 10 + ((S.belt % 26) + 26) % 26; y < END - 8; y += 26) ctx.fillRect(BX - BW / 2, y, BW, 4);
        box(ctx, BX - BW / 2 - 9, END - 10, BW + 18, 14, 7, P.stoneLit);
        // 분류선
        const here = atLine();
        const lc = S.warn > 0.05 ? P.bad : S.glow > 0.05 ? P.good : here ? P.gold : P.sys;
        ctx.fillStyle = fade(lc, here ? 0.2 : 0.1); ctx.fillRect(BX - BW / 2, LINE - WIN, BW, WIN * 2);
        ctx.fillStyle = lc; for (let x = BX - BW / 2 + 4; x < BX + BW / 2 - 8; x += 22) ctx.fillRect(x, LINE - 2, 14, 4);
        poly(ctx, [BX - BW / 2 - 26, LINE - 12, BX - BW / 2 - 10, LINE, BX - BW / 2 - 26, LINE + 12], lc);
        poly(ctx, [BX + BW / 2 + 26, LINE - 12, BX + BW / 2 + 10, LINE, BX + BW / 2 + 26, LINE + 12], lc);
        // 벨트 위 상자 (먼 것부터)
        for (let i = boxes.length - 1; i >= 0; i--) {
          const b = boxes[i];
          if (b.state === 'belt' && b.y > TOP - 60) drawCrate(ctx, P, b.x + 4, b.y, b === here ? 1.08 : 1, b.dir);
          else if (b.state === 'lost' || b.state === 'wrong') { ctx.globalAlpha = 1 - b.t; drawCrate(ctx, P, b.x + 4, b.y, 1 - b.t * 0.3, b.dir, { rot: b.t * (b.kx || 0.6) * 1.6, bad: true }); ctx.globalAlpha = 1; }
        }
        // 벨트가 나오는 벽 구멍 + 선반
        ctx.fillStyle = P.night1; ctx.fillRect(BX - BW / 2 - 30, 0, BW + 60, TOP - 12);
        box(ctx, BX - BW / 2 - 14, TOP - 18, BW + 28, 18, 5, P.night0);
        ctx.fillStyle = P.stone; for (let x = BX - BW / 2 - 6; x < BX + BW / 2; x += 18) ctx.fillRect(x, TOP - 14, 12, 16);
        drawShelf(ctx, P, BX, 40, 1, { pile: S.pile[2], squash: bump(S.bounce[2]) });
        drawTruck(ctx, P, 166, 232, 1, { dir: 0, pile: S.pile[0], squash: bump(S.bounce[0]) });
        drawTruck(ctx, P, 714, 232, 1, { dir: 1, flip: true, pile: S.pile[1], squash: bump(S.bounce[1]) });
        // 내 손: 누른 쪽으로 밀어낸다
        const k = bump(S.push), px = (S.pushDir === 0 ? -1 : S.pushDir === 1 ? 1 : 0) * 18 * k, py = (S.pushDir === 2 ? -20 : 0) * k;
        drawGlove(ctx, P, BX - BW / 2 - 40 + px, LINE + 36 + py, 1, false);
        drawGlove(ctx, P, BX + BW / 2 + 40 + px, LINE + 36 + py, 1, true);
        // 날아가는 상자 (포물선)
        for (const b of boxes) if (b.state === 'fly') {
          const e = easeOut(b.t), d = DEST[b.dir];
          const arc = Math.sin(e * Math.PI);                 // 위로 가는 상자는 벨트 옆으로 돌아서 간다 (내려오는 상자를 안 가리게)
          drawCrate(ctx, P, lerp(b.x0, d[0], e) + (b.dir === 2 ? 104 * arc : 0), lerp(b.y0, d[1], e) - (b.dir === 2 ? 0 : 46 * arc), lerp(1.12, 0.56, e), b.dir, { rot: (b.dir === 0 ? -1 : 1) * e * 0.5 });
        }
      },
    };
  }

  // =====================================================================
  // 3. 편의점 계산 — 말풍선에 뜬 순서대로 진열대 번호(1~4)를 고른다
  // =====================================================================
  const ITEM_NAMES = ['삼각김밥', '컵라면', '캔커피', '우유'];
  const DIGIT_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
  function drawItem(ctx, P, id, x, y, s) { // 물건 그림 (가운데 기준, 높이 70쯤). 넷 다 윤곽이 다르다
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (id === 0) {            // 삼각김밥: 둥근 세모 + 김
      roundPoly(ctx, [0, -34, 36, 28, -36, 28], 10); ctx.fillStyle = P.text; ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = P.hair; ctx.fillRect(-40, 4, 80, 30); ctx.restore();
      box(ctx, -9, -14, 18, 9, 4, P.warm);
    } else if (id === 1) {     // 컵라면: 위가 넓은 컵 + 뚜껑 + 김
      roundPoly(ctx, [-27, -18, 27, -18, 20, 33, -20, 33], 5); ctx.fillStyle = P.up; ctx.fill();
      poly(ctx, [-25.4, -5, 25.4, -5, 23, 12, -23, 12], P.text);
      box(ctx, -8, 0, 16, 7, 3, P.up);
      box(ctx, -31, -27, 62, 11, 5, P.lamp); poly(ctx, [16, -27, 35, -39, 31, -22], P.lamp);
      ctx.strokeStyle = fade(P.text, 0.55); ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-12, -33); ctx.quadraticCurveTo(-18, -39, -12, -45); ctx.moveTo(2, -33); ctx.quadraticCurveTo(-4, -39, 2, -45); ctx.stroke();
    } else if (id === 2) {     // 캔커피: 좁고 긴 캔 + 금색 띠
      box(ctx, -17, -34, 34, 68, 7, P.warmDim);
      box(ctx, -17, -34, 34, 10, 5, P.dim); box(ctx, -17, 26, 34, 8, 4, P.dim); box(ctx, -5, -39, 10, 6, 2, P.stoneLit);
      ctx.fillStyle = P.gold; ctx.fillRect(-17, -14, 34, 30);
      ctx.save(); ctx.translate(0, 1); ctx.rotate(0.5); oval(ctx, 0, 0, 6.5, 10, P.hair); ctx.fillStyle = P.gold; ctx.fillRect(-1, -9, 2, 18); ctx.restore();
    } else {                   // 우유: 지붕 달린 종이갑 + 파란 물결
      box(ctx, -23, -12, 46, 48, 4, P.text);
      poly(ctx, [-23, -12, 23, -12, 13, -30, -13, -30], mix(P.text, P.down, 0.3));
      box(ctx, -13, -40, 26, 11, 2, P.text);
      ctx.fillStyle = P.down; ctx.beginPath(); ctx.moveTo(-23, 8); ctx.quadraticCurveTo(-11, -4, 0, 8); ctx.quadraticCurveTo(11, 20, 23, 8); ctx.lineTo(23, 30); ctx.lineTo(-23, 30); ctx.closePath(); ctx.fill();
      poly(ctx, [0, -8, 6, 2, 0, 7, -6, 2], P.down);
    }
    ctx.restore();
  }
  // 손님 윗몸. x = 가운데, y = 계산대 윗선. o: { look 0~3, mood 0 보통 · 1 웃음 · 2 시무룩 }
  function drawCustomer(ctx, P, x, y, s, o) {
    o = o || {};
    const look = o.look || 0, mood = o.mood || 0;
    const jacket = [P.hood, P.stoneLit, P.warmDim, P.sysDim][look];
    const shade = mix(jacket, P.ink, 0.3);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    if (look === 0) disc(ctx, 0, -106, 45, P.hoodShade);                               // 후드
    if (look === 2) for (let i = 0; i < 7; i++) disc(ctx, -36 + i * 12, -134 + Math.abs(i - 3) * 7, 15, P.dim);   // 뽀글 머리
    box(ctx, -54, -66, 108, 90, 28, jacket);                                           // 어깨
    box(ctx, -13, -80, 26, 26, 8, P.skinShade);
    if (look === 0) { line(ctx, -9, -58, -11, -34, 4, P.text); line(ctx, 9, -58, 11, -34, 4, P.text); }
    else if (look === 1) { poly(ctx, [-20, -66, 20, -66, 0, -30], P.text); poly(ctx, [-6, -62, 6, -62, 4, -22, 0, -16, -4, -22], P.up); }
    else if (look === 2) { poly(ctx, [-16, -66, 16, -66, 0, -20], P.lamp); disc(ctx, 0, -12, 4, shade); }
    else { ctx.fillStyle = shade; ctx.fillRect(-3, -64, 6, 64); box(ctx, -40, -50, 26, 16, 4, P.gold); }
    disc(ctx, 0, -110, 36, P.skin);                                                    // 얼굴
    if (look === 0) { ctx.fillStyle = P.hair; ctx.beginPath(); ctx.arc(0, -110, 36, Math.PI * 1.08, Math.PI * 1.92); ctx.closePath(); ctx.fill(); }
    else if (look === 1) {     // 가르마 + 안경
      ctx.fillStyle = P.hair; ctx.beginPath(); ctx.arc(0, -110, 36.5, Math.PI * 0.98, Math.PI * 1.86); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = P.ink; ctx.lineWidth = 3; rrect(ctx, -25, -116, 20, 15, 5); ctx.stroke(); rrect(ctx, 5, -116, 20, 15, 5); ctx.stroke(); line(ctx, -5, -110, 5, -110, 3, P.ink);
    } else if (look === 2) { for (let i = 0; i < 5; i++) disc(ctx, -26 + i * 13, -138 + Math.abs(i - 2) * 4, 12, P.dim); }
    else {                     // 챙 모자
      ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(0, -116, 37, Math.PI, 0); ctx.closePath(); ctx.fill();
      box(ctx, -42, -122, 84, 10, 5, mix(P.gold, P.ink, 0.25));
    }
    oval(ctx, -13, -106, 3.4, 4.6, P.ink); oval(ctx, 13, -106, 3.4, 4.6, P.ink);
    ctx.strokeStyle = P.ink; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath();
    if (mood === 1) ctx.arc(0, -96, 9, Math.PI * 0.15, Math.PI * 0.85);
    else if (mood === 2) ctx.arc(0, -82, 9, Math.PI * 1.2, Math.PI * 1.8);
    else { ctx.moveTo(-6, -90); ctx.lineTo(6, -90); }
    ctx.stroke();
    ctx.restore();
  }
  // 계산대 화면: 칸 수 = 만점 기준, 맞힌 만큼 금색으로 찬다 (가운데 기준)
  function drawRegister(ctx, P, x, y, s, o) {
    o = o || {};
    const par = o.par || 8, filled = o.filled || 0, cols = Math.ceil(par / 2), size = 22, gap = 9;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    box(ctx, -20, 40, 40, 30, 4, P.stone); box(ctx, -60, 62, 120, 14, 6, P.stoneLit);
    box(ctx, -92, -56, 184, 106, 12, P.stone); box(ctx, -84, -48, 168, 90, 8, P.sysDeep);
    const x0 = -(cols * size + (cols - 1) * gap) / 2;
    for (let i = 0; i < par; i++) {
      const px = x0 + (i % cols) * (size + gap), py = -30 + Math.floor(i / cols) * 34;
      const on = i < filled, k = on && i === filled - 1 ? 1 + 0.35 * (o.pop || 0) : 1;
      box(ctx, px + size / 2 - size * k / 2, py + size / 2 - size * k / 2, size * k, size * k, 5, on ? P.gold : fade(P.sys, 0.22));
    }
    ctx.restore();
  }

  function makeStore(env) {
    const P = env.P, rng = env.rng, fx = env.fx, seconds = env.seconds, speed = env.speed, font = env.font;
    const par = Math.max(3, Math.round(8 * speed * seconds / 7));     // 만점 기준 개수 (보통 손님 3명 분)
    const TRANS = 0.25, CX = 150, CY = 184, BX0 = 250, BY0 = 32, BH = 128;
    const counts = shuffle([3, 3, 2], rng), customers = [];
    let lastLook = -1;
    for (let c = 0; c < 48; c++) {                                    // 빠른 사람에게는 네 번째 손님부터 계속 온다
      const k = c < 3 ? counts[c] : (rng() < 0.5 ? 2 : 3), items = [];
      for (let i = 0; i < k; i++) { let it = env.pick(4); if (i > 0 && it === items[i - 1]) it = (it + 1 + env.pick(3)) % 4; items.push(it); }
      let look = env.pick(4); if (look === lastLook) look = (look + 1) % 4; lastLook = look;
      customers.push({ items: items, look: look, marks: items.map(function () { return 0; }) });
    }
    const S = { customers: customers, cur: 0, idx: 0, trans: 0, par: par, hits: 0, wrongs: 0, served: 0, enter: 0, cellPop: [0, 0, 0, 0], cellBad: [0, 0, 0, 0], fly: [], leaving: null, pip: 0 };
    function cur() { return customers[S.cur % customers.length]; }
    function slot(c, i) { return [BX0 + 58 + i * 88, BY0 + 58]; }
    function cell(i) { return [28 + i * 208 + 112, 298]; }
    function drawBubble(ctx, c, k, alpha, idx) {
      const bw = 28 + c.items.length * 88;
      ctx.save(); ctx.globalAlpha = alpha;
      ctx.translate(BX0, BY0 + BH - 30); ctx.scale(k, k); ctx.translate(-BX0, -(BY0 + BH - 30));
      poly(ctx, [BX0 + 8, BY0 + BH - 56, BX0 - 30, BY0 + BH - 30, BX0 + 8, BY0 + BH - 18], P.text);
      box(ctx, BX0, BY0, bw, BH, 24, P.text); box(ctx, BX0 + 4, BY0 + 4, bw - 8, BH - 8, 20, P.night2);
      poly(ctx, [BX0 + 8, BY0 + BH - 50, BX0 - 20, BY0 + BH - 30, BX0 + 8, BY0 + BH - 24], P.night2);
      for (let i = 0; i < c.items.length; i++) {
        const p = slot(c, i), m = c.marks[i], now = i === idx;
        if (now) { box(ctx, p[0] - 40, BY0 + 12, 80, BH - 24, 14, fade(P.gold, 0.16)); box(ctx, p[0] - 24, BY0 + BH - 22, 48, 6, 3, P.gold); }
        ctx.globalAlpha = alpha * (m ? 0.3 : 1);
        drawItem(ctx, P, c.items[i], p[0], p[1] - (now ? 3 + 3 * Math.sin(env.fx.clock * 9) : 0), now ? 1.05 : 0.92);
        ctx.globalAlpha = alpha;
        if (m === 1) checkMark(ctx, p[0], p[1], 20, 9, P.good);
        if (m === 2) crossMark(ctx, p[0], p[1], 17, 9, P.bad);
      }
      ctx.restore();
    }
    return {
      title: '편의점 계산', howto: '말풍선 순서대로 번호 1~4',
      how: ['손님 말풍선의 물건을 왼쪽부터 차례로, 아래 번호 1~4 로 찍는다', '틀리면 감점 — 마구 누르지 않는다'],
      controls: ITEM_NAMES.map(function (name, i) { return { code: DIGIT_CODES[i], label: name }; }),
      state: S,
      tick: function (dt, wt) {
        S.enter = S.cur === 0 && S.served === 0 ? clamp((wt + 0.45) / 0.3, 0, 1) : Math.min(1, S.enter + dt / TRANS);
        S.trans = Math.max(0, S.trans - dt); S.pip = decay(S.pip, dt, 0.2);
        if (S.leaving) { S.leaving.t += dt / 0.3; if (S.leaving.t >= 1) S.leaving = null; }
        for (let i = 0; i < 4; i++) { S.cellPop[i] = decay(S.cellPop[i], dt, 0.18); S.cellBad[i] = decay(S.cellBad[i], dt, 0.3); }
        age(S.fly, dt, 0.16);
      },
      press: function (code) {
        const k = DIGIT_CODES.indexOf(code);
        if (k < 0 || S.trans > EPS) return;          // 손님이 바뀌는 0.25초는 받지 않는다 (벌점 없음)
        const c = cur(), p = slot(c, S.idx), q = cell(k);
        if (k === c.items[S.idx]) {     // 맞음
          S.hits++; c.marks[S.idx] = 1; S.cellPop[k] = 1; S.pip = 1;
          S.fly.push({ item: k, x0: q[0], y0: q[1], x1: p[0], y1: p[1], t: 0 });
          fx.ring(q[0], q[1], P.good, 30, 78); fx.burst(p[0], p[1], P.gold, 5, 130); fx.float(q[0] + 56, q[1] - 36, '+1', P.gold);
        } else {                        // 틀림: 그 물건은 실수로 치고 다음으로
          S.wrongs++; c.marks[S.idx] = 2; S.cellBad[k] = 1;
          fx.cross(q[0], q[1], 24); fx.kick(3); fx.flash(P.bad, 0.16);
        }
        S.idx++;
        if (S.idx >= c.items.length) {  // 이 손님 끝: 다음 손님
          S.leaving = { c: c, t: 0, marks: c.marks.slice(), happy: c.marks.every(function (m) { return m === 1; }) };
          S.cur++; S.idx = 0; S.served++; S.trans = TRANS; S.enter = 0;
          const nx = cur(); for (let i = 0; i < nx.marks.length; i++) nx.marks[i] = 0;
        }
      },
      finish: function () {
        return { score: clamp((S.hits - S.wrongs) / S.par, 0, 1), hits: Math.min(S.hits, S.par), total: S.par };   // 틀리면 그 물건을 잃고 1개만큼 더 깎인다 (번호 연타 막기)
      },
      draw: function (ctx, wt) {
        // 가게 안: 뒷벽 · 뒤쪽 진열장
        ctx.fillStyle = P.night1; ctx.fillRect(0, 0, W, CY);
        box(ctx, 22, 26, 96, CY - 26, 6, P.night0); ctx.fillStyle = fade(P.warm, 0.1); ctx.fillRect(30, 34, 80, 60);
        for (let i = 0; i < 5; i++) {
          const x = 300 + i * 118;
          box(ctx, x, 28, 104, CY - 28, 4, P.night2);
          for (let r = 0; r < 3; r++) {
            ctx.fillStyle = P.night3; ctx.fillRect(x + 6, 70 + r * 42, 92, 4);
            for (let j = 0; j < 5; j++) ctx.fillRect(x + 10 + j * 18, 70 + r * 42 - 14 - ((i + r + j) % 3) * 5, 12, 14 + ((i + r + j) % 3) * 5);
          }
        }
        // 손님 (나가는 손님은 왼쪽으로, 새 손님은 오른쪽에서)
        const c = cur(), lv = S.leaving;
        if (lv) { ctx.globalAlpha = 1 - lv.t; drawCustomer(ctx, P, CX - 170 * easeOut(lv.t), CY, 1, { look: lv.c.look, mood: lv.happy ? 1 : 2 }); ctx.globalAlpha = 1; }
        ctx.globalAlpha = S.enter; drawCustomer(ctx, P, CX + 150 * (1 - easeOut(S.enter)), CY, 1, { look: c.look, mood: 0 }); ctx.globalAlpha = 1;
        // 계산대
        ctx.fillStyle = P.stoneLit; ctx.fillRect(0, CY, W, 12);
        ctx.fillStyle = P.stone; ctx.fillRect(0, CY + 12, W, 22);
        drawRegister(ctx, P, 754, 106, 1, { par: S.par, filled: Math.min(S.hits, S.par), pop: bump(S.pip) });
        // 진열대 4칸 + 번호
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let i = 0; i < 4; i++) {
          const x = 28 + i * 208, q = cell(i), k = bump(S.cellPop[i]);
          box(ctx, x, 240, 200, 130, 14, P.stone); box(ctx, x, 228, 200, 128, 14, S.cellBad[i] > 0 ? mix(P.night2, P.bad, 0.45 * S.cellBad[i]) : P.night2);
          if (k > 0) { ctx.strokeStyle = fade(P.good, k); ctx.lineWidth = 5; rrect(ctx, x + 3, 231, 194, 122, 12); ctx.stroke(); }
          drawItem(ctx, P, i, q[0] + (S.cellBad[i] > 0 ? Math.sin(S.cellBad[i] * 40) * 4 : 0), q[1] - 8 * k, 1.2 * (1 + 0.16 * k));
          box(ctx, x + 12, 240, 40, 40, 10, P.text);
          ctx.font = '800 28px ' + font; ctx.fillStyle = P.ink; ctx.fillText(String(i + 1), x + 32, 262);
        }
        // 말풍선
        if (lv) drawBubble(ctx, lv.c === c ? { items: c.items, marks: lv.marks } : { items: lv.c.items, marks: lv.marks }, 1, 1 - lv.t, -1);
        if (wt >= 0 && S.trans <= 0.1) drawBubble(ctx, c, pop(1 - S.trans / 0.1), 1, S.idx);
        // 진열대에서 말풍선으로 날아가는 물건
        for (const f of S.fly) { const e = easeOut(f.t); drawItem(ctx, P, f.item, lerp(f.x0, f.x1, e), lerp(f.y0, f.y1, e) - 30 * Math.sin(e * Math.PI), lerp(1.2, 0.9, e)); }
      },
    };
  }

  // =====================================================================
  // 4. 배달 — 위에서 본 3차선. 좌우로 차를 피하고 초록 "배달 완료 지점"을 밟는다
  // =====================================================================
  // 내 스쿠터 (위에서 봄, 가운데 기준, 위쪽이 앞). o: { lean -1~1, pop 0~1 }
  function drawScooter(ctx, P, x, y, s, o) {
    o = o || {};
    const k = 1 + 0.14 * (o.pop || 0);
    ctx.save(); ctx.translate(x, y); ctx.rotate((o.lean || 0) * 0.24); ctx.scale(s, s);
    poly(ctx, [-7, -32, 7, -32, 30, -104, -30, -104], fade(P.lamp, 0.13));              // 전조등 빛
    oval(ctx, 4, 6, 20, 38, fade(P.ink, 0.4));
    box(ctx, -4, -38, 8, 18, 4, P.ink); box(ctx, -4, 26, 8, 14, 4, P.ink);              // 바퀴
    box(ctx, -10, -26, 20, 56, 9, P.text);                                              // 차체
    box(ctx, -20, -25, 40, 6, 3, P.stoneLit); disc(ctx, -21, -24, 4.5, P.dim); disc(ctx, 21, -24, 4.5, P.dim);   // 핸들 · 거울
    box(ctx, -5, -32, 10, 7, 3, P.lamp);
    line(ctx, -13, -8, -18, -21, 7, P.hood); line(ctx, 13, -8, 18, -21, 7, P.hood);     // 팔
    box(ctx, -17, -13, 34, 19, 9, P.hood);                                              // 어깨
    disc(ctx, 0, -7, 11.5, P.text); box(ctx, -8, -17, 16, 6, 3, P.sys);                 // 헬멧 · 가리개
    ctx.save(); ctx.translate(0, 21); ctx.scale(k, k);
    box(ctx, -16, -13, 32, 27, 6, P.warm); box(ctx, -16, -13, 32, 9, 5, P.lamp);        // 배달통
    ctx.fillStyle = P.warmDim; ctx.fillRect(-2, -4, 4, 18);
    ctx.restore();
    ctx.restore();
  }
  // 승용차 (위에서 봄, 가운데 기준, 길이 84). 꼬리등이 아래쪽
  function drawCar(ctx, P, x, y, s, color) {
    const body = color || P.stoneLit;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    box(ctx, -23, -37, 54, 84, 15, fade(P.ink, 0.4));
    ctx.fillStyle = P.ink; ctx.fillRect(-31, -29, 8, 18); ctx.fillRect(23, -29, 8, 18); ctx.fillRect(-31, 12, 8, 18); ctx.fillRect(23, 12, 8, 18);   // 바퀴
    box(ctx, -27, -42, 54, 84, 15, body);
    box(ctx, -33, -17, 7, 7, 2, body); box(ctx, 26, -17, 7, 7, 2, body);                // 거울
    poly(ctx, [-20, -20, 20, -20, 16, -6, -16, -6], P.night0);                          // 앞유리
    box(ctx, -16, -6, 32, 27, 5, mix(body, P.text, 0.18));                              // 지붕
    poly(ctx, [-16, 21, 16, 21, 19, 30, -19, 30], P.night0);                            // 뒷유리
    box(ctx, -23, -42, 12, 5, 2, P.lamp); box(ctx, 11, -42, 12, 5, 2, P.lamp);
    box(ctx, -24, 36, 13, 6, 3, P.up); box(ctx, 11, 36, 13, 6, 3, P.up);                // 꼬리등
    ctx.restore();
  }
  // 버스 (위에서 봄, 길이 150). 길고 넓은 몸 + 튀어나온 거울 + 지붕 냉방기
  function drawBus(ctx, P, x, y, s) {
    const body = mix(P.down, P.night2, 0.3), roof = mix(P.down, P.text, 0.3), deep = mix(P.down, P.night0, 0.55);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    box(ctx, -29, -70, 66, 150, 12, fade(P.ink, 0.4));
    ctx.fillStyle = P.ink; for (const wy of [-52, 22, 44]) { ctx.fillRect(-37, wy, 8, 18); ctx.fillRect(29, wy, 8, 18); }
    box(ctx, -33, -75, 66, 150, 12, body);
    box(ctx, -45, -70, 13, 8, 3, body); box(ctx, 32, -70, 13, 8, 3, body);              // 거울(귀)
    box(ctx, -27, -70, 54, 15, 5, P.night0);                                            // 앞유리
    box(ctx, -25, -50, 50, 114, 8, deep);
    box(ctx, -17, -40, 34, 28, 5, roof); box(ctx, -17, 22, 34, 28, 5, roof);            // 냉방기 둘
    box(ctx, -9, -6, 18, 20, 3, body);                                                  // 환기구
    box(ctx, -29, 68, 15, 6, 3, P.up); box(ctx, 14, 68, 15, 6, 3, P.up);
    ctx.restore();
  }
  // 배달 완료 지점 (초록 핀 + 바닥 고리). o: { pulse 0~1 }
  function drawPin(ctx, P, x, y, s, o) {
    o = o || {};
    const bob = 4 * (o.pulse || 0);
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.strokeStyle = fade(P.good, 0.6); ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(0, 14, 32 + bob, 13 + bob * 0.4, 0, 0, TAU); ctx.stroke();
    oval(ctx, 0, 14, 16, 6.5, fade(P.good, 0.45));
    ctx.fillStyle = P.good; ctx.beginPath(); ctx.arc(0, -18 - bob, 16, Math.PI * 5 / 6, Math.PI / 6); ctx.lineTo(0, 12 - bob); ctx.closePath(); ctx.fill();
    poly(ctx, [-7, -15 - bob, 0, -24 - bob, 7, -15 - bob, 7, -9 - bob, -7, -9 - bob], P.ink);   // 핀 안의 집
    ctx.restore();
  }

  function makeDelivery(env) {
    const P = env.P, rng = env.rng, fx = env.fx, seconds = env.seconds, speed = env.speed;
    const LANE_W = 108, RX0 = W / 2 - LANE_W * 1.5, RX1 = W / 2 + LANE_W * 1.5, SY = 298;
    const v = 280 * speed, gap = 0.62 / speed, T0 = 1.05;                   // 길 속도 · 줄 간격(초) · 첫 줄
    const R = Math.max(3, Math.floor((seconds - 0.37 - T0) / gap) + 1);     // 차가 오는 줄 수
    const nPins = Math.max(2, Math.min(R, Math.round(R * 0.6)));
    const laneX = function (l) { return RX0 + LANE_W * (l + 0.5); };
    const CAR_COLORS = [P.stoneLit, P.hood, P.warmDim, P.sysDim];
    // 길 짜기: 틈 g(줄 g-1 과 줄 g 사이)에서 안전한 차선 L[g]. 줄 k 는 L[k] 와 L[k+1] 을 늘 비워 둔다
    // (= 빠져나갈 차선이 앞뒤 줄에 걸쳐 열려 있어서 바늘귀 꿰기를 시키지 않는다).
    function plan() {
      const L = [rng() < 0.5 ? 0 : 2];
      let run = 0;
      for (let g = 1; g <= R; g++) {
        const a = L[g - 1], before = g > 1 ? L[g - 2] : 1, r = rng();
        let b;
        if (a !== 1) b = r < 0.58 && run === 0 ? a : 1;                                  // 가장자리: 한 번 더 머물거나 가운데로
        else if (r < 0.1 && run === 0) b = 1;
        else b = before === 1 ? (r < 0.55 ? 0 : 2) : (r < 0.72 ? 2 - before : before);   // 가운데: 대개 건너편으로
        run = b === a ? run + 1 : 0;
        L.push(b);
      }
      const rows = [];
      for (let k = 0; k < R; k++) {
        const a = L[k], b = L[k + 1];
        let blocked = [0, 1, 2].filter(function (x) { return x !== a && x !== b; });
        if (a === b && rng() < 0.36) blocked = [a === 1 ? (rng() < 0.5 ? 0 : 2) : (rng() < 0.8 ? 1 : 2 - a)];
        rows.push(blocked);
      }
      const order = []; for (let g = 1; g < R; g++) order.push(g);
      shuffle(order, rng);
      const pinGaps = [0].concat(order.slice(0, nPins - 1));              // 첫 지점은 늘 차가 오기 전, 옆 차선에
      return { L: L, rows: rows, pinGaps: pinGaps };
    }
    function stillScore(pl, lane) {                                      // 한 차선에 가만히 있을 때의 점수
      const crashes = pl.rows.filter(function (b) { return b.indexOf(lane) >= 0; }).length;
      const got = pl.pinGaps.filter(function (g) { return pl.L[g] === lane; }).length;
      return { crashes: crashes, score: 0.5 + 0.5 * got / nPins - 0.25 * crashes };
    }
    let pl = plan(), tries = 1;
    while (tries < 300 && ![0, 1, 2].every(function (l) { const s = stillScore(pl, l); return s.crashes >= 2 && s.score < 0.3; })) { pl = plan(); tries++; }
    const obs = [], pins = [];
    for (let k = 0; k < R; k++) {
      let bus = false;
      for (const lane of pl.rows[k]) {
        const isBus = !bus && rng() < 0.3; bus = bus || isBus;
        obs.push({ lane: lane, at: T0 + k * gap, bus: isBus, half: isBus ? 75 : 42, color: CAR_COLORS[env.pick(4)], y: -999, hit: false, row: k });
      }
    }
    for (const g of pl.pinGaps) pins.push({ lane: pl.L[g], at: T0 + (g - 0.5) * gap, y: -999, got: false, t: 0 });
    const S = { lane: 1, x: laneX(1), lean: 0, inv: 0, crashes: 0, got: 0, total: nPins, obs: obs, pins: pins, safe: pl.L, rowAt: function (k) { return T0 + k * gap; }, rows: R, tries: tries, pop: 0, edge: 0, edgeDir: 0, road: 0 };
    return {
      title: '배달', howto: '좌우로 차를 피하고 초록 지점 밟기',
      how: ['방향키로 차선을 바꿔 차를 피한다', '초록 핀이 있는 차선으로 지나가면 배달 완료 — 부딪히면 감점'],
      controls: [{ code: 'ArrowLeft', label: '왼쪽 차선' }, { code: 'ArrowRight', label: '오른쪽 차선' }],
      state: S,
      tick: function (dt, wt, playing) {
        S.road = wt * v;
        S.x += (laneX(S.lane) - S.x) * Math.min(1, dt * 26);
        S.lean = Math.abs(laneX(S.lane) - S.x) < 2 ? S.lean * 0.7 : S.lean;
        S.inv = Math.max(0, S.inv - dt); S.pop = decay(S.pop, dt, 0.2); S.edge = decay(S.edge, dt, 0.15);
        for (const o of obs) {
          o.y = SY - (o.at - wt) * v;
          if (playing && !o.hit && S.inv <= 0 && o.lane === S.lane && Math.abs(o.y - SY) < o.half + 22) {   // 부딪힘
            o.hit = true; S.crashes++; S.inv = 0.5;
            fx.flash(P.bad, 0.3); fx.kick(3); fx.cross(S.x, SY - 52, 18); fx.burst(S.x, SY - 30, P.bad, 7, 210);
          }
        }
        for (const p of pins) {
          p.y = SY - (p.at - wt) * v;
          if (p.got) p.t += dt / 0.25;
          else if (playing && p.lane === S.lane && Math.abs(p.y - SY) < 44) {                               // 배달 완료
            p.got = true; S.got++; S.pop = 1;
            fx.ring(laneX(p.lane), SY, P.good, 14, 60); fx.burst(laneX(p.lane), SY - 10, P.good, 6, 160); fx.float(laneX(p.lane) + 40, SY - 40, '+1', P.gold);
          }
        }
      },
      press: function (code) {
        const d = code === 'ArrowLeft' ? -1 : code === 'ArrowRight' ? 1 : 0;
        if (!d) return;
        if (S.lane + d < 0 || S.lane + d > 2) { S.edge = 1; S.edgeDir = d; return; }    // 길 끝: 살짝 튕기기만
        S.lane += d; S.lean = d;
      },
      finish: function () {
        return { score: clamp(0.5 + 0.5 * S.got / S.total - 0.25 * S.crashes, 0, 1), hits: S.got, total: S.total };
      },
      draw: function (ctx) {
        const off = S.road;
        // 길 밖: 보도 · 지붕 · 가로등 (어둡게, 길과 함께 흐름)
        ctx.fillStyle = P.night1; ctx.fillRect(RX0 - 44, 0, 44, H); ctx.fillRect(RX1, 0, 44, H);
        for (let idx = Math.floor((off - H) / 190); idx <= Math.floor(off / 190) + 1; idx++) {
          const y = off - idx * 190, h = ((idx * 53) % 5 + 5) % 5;
          box(ctx, 18, y + 12, RX0 - 80, 150 - h * 6, 6, h % 2 ? P.night1 : P.night2); box(ctx, 40 + h * 9, y + 34, 46, 30, 4, P.night3);
          box(ctx, RX1 + 62, y + 60, W - RX1 - 80, 150 - (4 - h) * 6, 6, h % 2 ? P.night2 : P.night1); box(ctx, RX1 + 96 + h * 12, y + 86, 40, 34, 4, P.night3);
          disc(ctx, RX0 - 22, y + 40, 30, fade(P.lamp, 0.07)); disc(ctx, RX0 - 22, y + 40, 5, P.warm);
          disc(ctx, RX1 + 22, y + 135, 30, fade(P.lamp, 0.07)); disc(ctx, RX1 + 22, y + 135, 5, P.warm);
        }
        // 길 · 차선
        ctx.fillStyle = P.ground; ctx.fillRect(RX0, 0, RX1 - RX0, H);
        ctx.fillStyle = P.stoneLit; ctx.fillRect(RX0 - 4, 0, 4, H); ctx.fillRect(RX1, 0, 4, H);
        ctx.fillStyle = P.stone;
        for (let y = ((off % 80) + 80) % 80 - 80; y < H; y += 80) { ctx.fillRect(RX0 + LANE_W - 3, y, 6, 36); ctx.fillRect(RX0 + LANE_W * 2 - 3, y, 6, 36); }
        // 배달 완료 지점 · 차
        for (const p of pins) {
          if (p.y < -60 || p.y > H + 60 || p.t >= 1) continue;
          if (p.got) { ctx.globalAlpha = 1 - p.t; drawPin(ctx, P, laneX(p.lane), p.y - 30 * p.t, 1 + 0.5 * p.t, {}); ctx.globalAlpha = 1; }
          else drawPin(ctx, P, laneX(p.lane), p.y, 1, { pulse: 0.5 + 0.5 * Math.sin(fx.clock * 8) });
        }
        for (const o of obs) {
          if (o.y < -110 || o.y > H + 110) continue;
          if (o.bus) drawBus(ctx, P, laneX(o.lane), o.y, 1); else drawCar(ctx, P, laneX(o.lane), o.y, 1, o.color);
          if (o.hit && S.inv > 0.25) { ctx.fillStyle = fade(P.bad, 0.45); rrect(ctx, laneX(o.lane) - 30, o.y - o.half, 60, o.half * 2, 14); ctx.fill(); }
        }
        // 내 스쿠터 (부딪힌 뒤 0.5초는 깜빡임)
        if (S.inv <= 0 || Math.floor((0.5 - S.inv) * 14) % 2 === 0) drawScooter(ctx, P, S.x + S.edgeDir * 7 * bump(S.edge), SY, 1.15, { lean: S.lean * clamp(Math.abs(laneX(S.lane) - S.x) / 40, 0, 1), pop: bump(S.pop) });
      },
    };
  }

  // =====================================================================
  // 내놓기
  // =====================================================================
  const MAKERS = { flyer: makeFlyer, loading: makeLoading, store: makeStore, delivery: makeDelivery };
  root.Minigames = {
    list: ['flyer', 'loading', 'store', 'delivery'],
    create: function (id, opts) {
      if (!MAKERS[id]) throw new Error('Minigames.create: 모르는 미니게임 "' + id + '"');
      return build(opts, MAKERS[id]);
    },
    // 미니게임에 나오는 모든 등장물. draw(ctx, x, y, s): x, y = 그림 가운데, s = 배율 (1 = 게임 안 크기)
    sprites: function () {
      const P = root.PAL || SPARE_PAL;
      const S = function (name, draw) { return { name: name, draw: draw }; };
      return [
        S('나 (전단지 알바)', function (c, x, y, s) { drawFlyerMe(c, P, x - 10 * s, y + 78 * s, s, {}); }),
        S('행인 (비니)', function (c, x, y, s) { drawWalker(c, P, x, y + 82 * s, s, { look: 0 }); }),
        S('행인 (긴 머리)', function (c, x, y, s) { drawWalker(c, P, x, y + 76 * s, s, { look: 1 }); }),
        S('행인 (모자와 배낭)', function (c, x, y, s) { drawWalker(c, P, x, y + 78 * s, s, { look: 2 }); }),
        S('바쁜 사람', function (c, x, y, s) { drawRunner(c, P, x - 10 * s, y + 78 * s, s, {}); }),
        S('전단지', function (c, x, y, s) { drawFlyerSheet(c, P, x, y, s, 0); }),
        S('가로등', function (c, x, y, s) { drawLamp(c, P, x + 42 * s, y + 134 * s, s); }),
        S('상자 (왼쪽)', function (c, x, y, s) { drawCrate(c, P, x, y, s, 0); }),
        S('상자 (오른쪽)', function (c, x, y, s) { drawCrate(c, P, x, y, s, 1); }),
        S('상자 (위)', function (c, x, y, s) { drawCrate(c, P, x, y, s, 2); }),
        S('왼쪽 트럭', function (c, x, y, s) { drawTruck(c, P, x, y, s, { dir: 0, pile: 3 }); }),
        S('오른쪽 트럭', function (c, x, y, s) { drawTruck(c, P, x, y, s, { dir: 1, flip: true, pile: 3 }); }),
        S('선반', function (c, x, y, s) { drawShelf(c, P, x + 16 * s, y, s, { pile: 3 }); }),
        S('작업 장갑', function (c, x, y, s) { drawGlove(c, P, x, y - 14 * s, s, false, 44); }),
        S('손님 (학생)', function (c, x, y, s) { drawCustomer(c, P, x, y + 64 * s, s, { look: 0 }); }),
        S('손님 (직장인)', function (c, x, y, s) { drawCustomer(c, P, x, y + 64 * s, s, { look: 1 }); }),
        S('손님 (할머니)', function (c, x, y, s) { drawCustomer(c, P, x, y + 64 * s, s, { look: 2, mood: 1 }); }),
        S('손님 (모자)', function (c, x, y, s) { drawCustomer(c, P, x, y + 64 * s, s, { look: 3 }); }),
        S('삼각김밥', function (c, x, y, s) { drawItem(c, P, 0, x, y, s); }),
        S('컵라면', function (c, x, y, s) { drawItem(c, P, 1, x, y, s); }),
        S('캔커피', function (c, x, y, s) { drawItem(c, P, 2, x, y, s); }),
        S('우유', function (c, x, y, s) { drawItem(c, P, 3, x, y, s); }),
        S('계산대 화면', function (c, x, y, s) { drawRegister(c, P, x, y - 10 * s, s, { par: 8, filled: 3 }); }),
        S('내 스쿠터', function (c, x, y, s) { drawScooter(c, P, x, y + 30 * s, s * 1.15, {}); }),
        S('승용차', function (c, x, y, s) { drawCar(c, P, x, y, s, P.stoneLit); }),
        S('버스', function (c, x, y, s) { drawBus(c, P, x, y, s); }),
        S('배달 완료 지점', function (c, x, y, s) { drawPin(c, P, x, y + 6 * s, s, {}); }),
      ];
    },
  };
})();
