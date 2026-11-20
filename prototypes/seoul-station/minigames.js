// PROTOTYPE - NOT FOR PRODUCTION
// Question: 상태창이 시키는 대로 알바 → 방 → 투자 → 집으로 올라가는 한 판이, 뭘 해야 할지 늘 분명하면서 20분 동안 재미있는가?
// Date: 2026-11-12
// 알바 미니게임 10종: 전단지(flyer) · 상하차(loading) · 편의점(store) · 배달(delivery) + 2026-11-21 의 여섯 — 카페(cafe) · 과외(tutor) · 대리(driver) · 강연(lecture) · 방송(tv) · 자문(advise).
// 약속: window.Minigames = { list, create(id, opts), demo(id, opts), sprites() }.
// opts.intensity: 알바 강도 0 하 · 1 중 · 2 상 · 3 최상 (기본 1). 강도가 높을수록 판정 자리가 좁고, 머무는 시간이 짧고, 더 촘촘히 온다 (2026-11-17 전체를 어렵게: "미니게임 너무쉬움").
// opts.pace: 강도의 속도 배율 (기본 1, ui 가 config 의 mg_int_n 을 넘김, 2.5 에서 자름). 판 속도 = (1 + levelSpeed x level) x pace.
// demo(id, opts): 스스로 하는 시연 판. create 와 같은 모양 + lastPress { code, age } · loops(몇 판째). press 는 무시, done 은 늘 false, opts.rng 는 안 씀.
// 결정적: 난수는 opts.rng 만, 시간은 update(dt) 로만 흐른다. 같은 씨앗 + 같은 입력이면 같은 result.
// 숙련도(level): 판 전체가 (1 + levelSpeed x level) 배 빨라진다 (levelSpeed 기본 0.16) = 같은 7초에 더 빨리, 더 많이 온다.
// 점점 빨라짐(ramp): 한 판 안에서도 시작 -> 끝으로 갈수록 빨라진다 (ramp 기본 0.4 = 끝에서 약 +40%). 처음 1~2초는 거의 그대로.
// 느린 시작(2026-11-19 "시작이 너무 빠름 키보드로 손 가다가 몇개 놓침 — 천천히 가다가 점점 빨라지는 방식"): opts.ready = "준비" 시간(초, 기본 0.8),
//   opts.warm = 시작할 때의 빠르기(본래의 몇 배, 기본 1 = 없음) · opts.warmSec = 그 빠르기가 1 로 올라오는 데 걸리는 판 안의 시간. 판의 시계 자체를 늦추므로 네 게임에 똑같이 듣는다 (그만큼 한 판이 조금 길어진다).
// 빨라져도 등장물이 판정 자리에 머무는 시간은 강도별 바닥(STAY: 하 0.18 · 중 0.13 · 상 0.105 · 최상 0.09초) 아래로 내려가지 않게,
// 그리고 한 번 누른 뒤 다음 것까지의 틈도 강도별 바닥(게임마다) 아래로 내려가지 않게 각 게임이 속도 위쪽을 눌러 둔다 (사람 손으로 만점이 가능한 선).
// 자동 점검용으로 game._state (내부 상태, 읽기만) 를 내놓는다.
// 그림 (2026-11-16~): 밝은 낮의 픽셀 그림. 낮은 해상도 화면(294×127, 논리 1/3)에 PX 색으로 점을 찍고 정수 배로 키워 찍는다.
// 글자는 둥근모꼴(opts.font) 16 · 32 · 64px. 색 역할표 window.MGPAL 을 내놓는다(ui.js 가 opts.pal 로 넘김).
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const W = 880, H = 380;            // 논리 크기
  const READY = 0.8, OUTRO = 0.5;    // 준비 · 마무리 길이(초)
  const STAY = [0.18, 0.13, 0.105, 0.09];   // 강도별: 등장물이 판정 자리에 머무는 시간의 바닥(초)
  const EPS = 1e-9;

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

  // ---------- 점점 빨라짐 ----------
  // 속도 배율이 시작 1 에서 끝(seconds) 1 + r 까지 직선으로 오를 때, 흐른 양 tau(w) 와 그 거꾸로 inv(u). 준비 시간(w < 0)은 배율 1.
  function makeWarp(r, S) {
    const tS = S + r * S / 2;
    return {
      tau: function (w) { if (w <= 0) return w; const x = Math.min(w, S); return x + r * x * x / (2 * S) + (1 + r) * Math.max(0, w - S); },
      inv: function (u) { if (u <= 0) return u; if (u >= tS) return S + (u - tS) / (1 + r); return r < 1e-9 ? u : S * (Math.sqrt(1 + 2 * r * u / S) - 1) / r; },
    };
  }
  // 위쪽을 눌러 두는 부드러운 상한: knee 까지는 그대로, 그 위는 cap 에 천천히 다가간다 (cap 을 넘지 않음)
  function softCap(raw, cap, knee) {
    const k = cap * knee;
    return raw <= k ? raw : k + (cap - k) * (1 - Math.exp(-(raw - k) / (cap - k)));
  }

  // ---------- 색 도우미 ('#rrggbb' 만 받는다) ----------
  const rgbCache = {};
  function rgb(c) {
    let v = rgbCache[c];
    if (!v) { const n = parseInt(c.slice(1), 16); v = rgbCache[c] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    return v;
  }

  // ---------- 픽셀 그리기 도구 (그리기만 쓴다. 판정 · 시간 · 난수와 상관없음) ----------
  // 낮은 해상도 화면(LW×LH)에 PX 색으로 점을 찍고, 받은 캔버스에 정수 배(논리 3배 = 실제 6배)로 키워 찍는다.
  // 좌표: 논리(880×380) → 낮은 해상도는 L(v) = round(v / 3). 그림에는 rng 를 쓰지 않는다.
  const SC = 3, LW = 294, LH = 127;   // 294 x 3 = 882, 127 x 3 = 381: 오른쪽 · 아래 끝 한 줄 조금은 캔버스 밖으로 잘린다
  const SPARE_PX = { // palette.js 의 PX 가 없을 때만 (같은 값)
    k: '#2b1d2e', w: '#ffffff', c: '#fff4d6', C: '#f6e3b4', d: '#e3c58c', b: '#3b6fd8', B: '#23449a', l: '#6fa0f0',
    s: '#8fd3ff', S: '#c4ecff', q: '#b0e0f8', o: '#f28a2e', O: '#c45a1a', y: '#ffd23f', Y: '#fff09a',
    g: '#5cc04a', G: '#2f8a3a', h: '#a6e36b', r: '#e8505b', R: '#a8323f', e: '#9aa0b0', E: '#5c6274', L: '#d4d8e0',
    n: '#8a5a3a', N: '#c08a5a', H: '#4a3328', p: '#ffd0a8', P: '#e8a27c',
  };
  let PXT = null;
  function pxt() { if (!PXT) { const t = root.PX; PXT = t && t.k && t.w && t.b ? t : SPARE_PX; } return PXT; }
  function pc(k) { return pxt()[k] || k; }                 // 'k' 같은 PX 글자 또는 '#rrggbb'
  function L(v) { return Math.round(v / SC); }             // 논리 좌표 -> 낮은 해상도 점
  function fr(g, x, y, w, h, k) { g.fillStyle = pc(k); g.fillRect(x, y, w, h); }
  function OB(g, x, y, w, h, f, o) { fr(g, x, y, w, h, o || 'k'); if (w > 2 && h > 2) fr(g, x + 1, y + 1, w - 2, h - 2, f); }   // 외곽선 상자
  function SB(g, x, y, w, h, f, o) { // 모서리 한 점을 깎은 외곽선 상자 (픽셀 틀 느낌)
    fr(g, x + 1, y, w - 2, h, o || 'k'); fr(g, x, y + 1, w, h - 2, o || 'k');
    if (w > 2 && h > 2) fr(g, x + 1, y + 1, w - 2, h - 2, f);
  }
  function ell(g, cx, cy, rx, ry, k) { // 점으로 채운 타원 (가운데 cx, cy 는 반 점 단위 가능)
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) fr(g, x, y, 1, 1, k);
    }
  }
  function ring(g, cx, cy, r, k, t) { // 점으로 된 고리 (두께 t)
    const r2o = (r + 0.5) * (r + 0.5), r2i = Math.max(0, r - t + 0.5) * Math.max(0, r - t + 0.5);
    for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
      const d = x * x + y * y; if (d <= r2o && d > r2i) fr(g, cx + x, cy + y, 1, 1, k);
    }
  }
  function seg(g, x0, y0, x1, y1, k, t) { // 브레젠험 선, t×t 붓
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); t = t || 1;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
    for (;;) { fr(g, x0 - (t >> 1), y0 - (t >> 1), t, t, k); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
  }
  function rows(g, ox, oy, list, map) { // 글자 줄 그림 ('.' 은 투명, map 으로 역할 글자를 색으로)
    for (let y = 0; y < list.length; y++) for (let x = 0; x < list[y].length; x++) {
      const ch = list[y][x]; if (ch !== '.') fr(g, ox + x, oy + y, 1, 1, (map && map[ch]) || ch);
    }
  }
  function mkc(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g];
  }
  function outline(c, k) { // 불투명한 점 둘레(바깥 한 칸)에 외곽선. 반투명 점은 없앤다
    const g = c.getContext('2d'), w = c.width, h = c.height, id = g.getImageData(0, 0, w, h), d = id.data, a = new Uint8Array(w * h), col = rgb(pc(k || 'k'));
    for (let i = 0; i < w * h; i++) { a[i] = d[i * 4 + 3] >= 128 ? 1 : 0; d[i * 4 + 3] = a[i] ? 255 : 0; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (a[i] || !((x > 0 && a[i - 1]) || (x < w - 1 && a[i + 1]) || (y > 0 && a[i - w]) || (y < h - 1 && a[i + w]))) continue;
      d[i * 4] = col[0]; d[i * 4 + 1] = col[1]; d[i * 4 + 2] = col[2]; d[i * 4 + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    return c;
  }
  const SPR = {};
  // 등장물 하나를 낮은 해상도 캔버스에 한 번 찍어 둔다. ax, ay = 놓는 기준점(그림 안의 점)
  function spr(key, w, h, ax, ay, fn, noLine) {
    let c = SPR[key];
    if (!c) { const m = mkc(w, h); fn(m[1]); if (!noLine) outline(m[0]); c = SPR[key] = m[0]; c.ax = ax; c.ay = ay; }
    return c;
  }
  function flipped(c) { // 좌우 뒤집은 판 (한 번 만들어 둔다)
    if (!c.flip) { const m = mkc(c.width, c.height); m[1].translate(c.width, 0); m[1].scale(-1, 1); m[1].drawImage(c, 0, 0); c.flip = m[0]; c.flip.ax = c.width - 1 - c.ax; c.flip.ay = c.ay; c.flip.flip = c; }
    return c.flip;
  }
  function put(g, c, x, y, s) { // 기준점을 (x, y) 에. s 는 크기(가까운 점으로 키우거나 줄임)
    if (s == null || s === 1) { g.drawImage(c, Math.round(x - c.ax), Math.round(y - c.ay)); return; }
    const w = Math.max(1, Math.round(c.width * s)), h = Math.max(1, Math.round(c.height * s));
    g.drawImage(c, Math.round(x - c.ax * s), Math.round(y - c.ay * s), w, h);
  }
  let ROT = null, ROTPAL = null;
  const ROTNEAR = {}; // 색(rgb 한 덩어리) → 가장 가까운 PX 색의 번호 (한 번 찾은 것은 다시 찾지 않음)
  function putRot(g, c, x, y, rot, s) { // 돌리고 키운 그림을 작은 판에 그린 뒤 반투명 가장자리를 잘라(있다/없다) 찍는다
    if (!ROT) { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const cg = cv.getContext('2d', { willReadFrequently: true }); cg.imageSmoothingEnabled = false; ROT = [cv, cg]; } // 매 프레임 getImageData 로 읽으므로 읽기 빠른 판
    if (!ROTPAL) { const t = pxt(); ROTPAL = Object.keys(t).map(function (k) { return rgb(t[k]); }); } // 색 표는 한 번만
    const rg = ROT[1], pal = ROTPAL;
    rg.setTransform(1, 0, 0, 1, 0, 0); rg.clearRect(0, 0, 64, 64);
    rg.translate(32, 32); rg.rotate(rot || 0); rg.scale(s || 1, s || 1); rg.drawImage(c, -c.ax, -c.ay); rg.setTransform(1, 0, 0, 1, 0, 0);
    const id = rg.getImageData(0, 0, 64, 64), d = id.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) { d[i + 3] = 0; continue; }
      d[i + 3] = 255;
      const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      let best = ROTNEAR[key];
      if (best === undefined) { // 가장 가까운 PX 색으로
        let bd = 1e9; best = 0;
        for (let j = 0; j < pal.length; j++) { const q = pal[j], dd = (q[0] - d[i]) * (q[0] - d[i]) + (q[1] - d[i + 1]) * (q[1] - d[i + 1]) + (q[2] - d[i + 2]) * (q[2] - d[i + 2]); if (dd < bd) { bd = dd; best = j; } }
        ROTNEAR[key] = best;
      }
      d[i] = pal[best][0]; d[i + 1] = pal[best][1]; d[i + 2] = pal[best][2];
    }
    rg.putImageData(id, 0, 0);
    g.drawImage(ROT[0], Math.round(x) - 32, Math.round(y) - 32);
  }
  // 반투명 대신 점무늬(4×4 바이어)로 사라지게: 0 이면 안 보임, 1 이면 그대로
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const PAT = {};
  function bayer(g, n) {
    if (!PAT[n]) { const m = mkc(4, 4); for (let i = 0; i < 16; i++) if (BAYER[i] < n) fr(m[1], i % 4, i >> 2, 1, 1, '#000000'); PAT[n] = m[0]; }
    if (PAT[n].ctx !== g) { PAT[n].ctx = g; PAT[n].pat = g.createPattern(PAT[n], 'repeat'); } // 무늬는 그 판(점무늬 층)마다 한 번만 만든다
    return PAT[n].pat;
  }
  let LAYER = null;
  function faded(g, a, fn) { // fn(layer ctx) 로 그린 것을 점무늬 a 만큼만 g 에 옮긴다
    const n = Math.round(clamp(a, 0, 1) * 16);
    if (n <= 0) return;
    if (n >= 16) { fn(g); return; }
    if (!LAYER) LAYER = mkc(LW, LH);
    const lg = LAYER[1], t = g.getTransform();   // 낮은 해상도 화면에서만 부른다 (흔들림 이동을 그대로 따라감)
    lg.setTransform(1, 0, 0, 1, 0, 0); lg.clearRect(0, 0, LW, LH);
    lg.setTransform(t); fn(lg); lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = 'destination-in'; lg.fillStyle = bayer(lg, n); lg.fillRect(0, 0, LW, LH);
    lg.globalCompositeOperation = 'source-over';
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(LAYER[0], 0, 0); g.restore();
  }
  function dots(g, x, y, w, h, k, a) { faded(g, a, function (lg) { fr(lg, x, y, w, h, k); }); }   // 점무늬 덮개 (a 만큼)
  // 방향 딱지 색: 왼쪽 파랑 · 오른쪽 주황 · 위 초록 (상자 · 트럭 · 선반이 같은 색)
  const DIRK = ['b', 'o', 'g', 'r'], DIRSH = ['B', 'O', 'G', 'R'];   // 넷째(아래 = 빨강)는 강연 · 자문이 쓴다
  const ARROW = [
    ['...w...', '..ww...', '.wwwwww', 'wwwwwww', '.wwwwww', '..ww...', '...w...'],
    ['...w...', '...ww..', 'wwwwww.', 'wwwwwww', 'wwwwww.', '...ww..', '...w...'],
    ['...w...', '..www..', '.wwwww.', 'wwwwwww', '..www..', '..www..', '..www..'],
    ['..www..', '..www..', '..www..', 'wwwwwww', '.wwwww.', '..www..', '...w...'],
  ];
  function sticker(g, x, y, size, dir, col) { // 가운데 (x, y), 색 바탕 + 흰 화살표(그림자 한 칸). col = [바탕, 그늘] 을 주면 그 색으로
    const x0 = Math.round(x - size / 2), y0 = Math.round(y - size / 2);
    SB(g, x0, y0, size, size, col ? col[0] : DIRK[dir]);
    fr(g, x0 + 1, y0 + size - 2, size - 2, 1, col ? col[1] : DIRSH[dir]);
    const a = ARROW[dir], s = size >= 14 ? 2 : 1, ax = Math.round(x - 3.5 * s), ay = Math.round(y - 3.5 * s) - (size >= 14 ? 1 : 0);
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (a[j][i] === 'w') fr(g, ax + i * s + 1, ay + j * s + 1, s, s, 'k');
    for (let j = 0; j < 7; j++) for (let i = 0; i < 7; i++) if (a[j][i] === 'w') fr(g, ax + i * s, ay + j * s, s, s, 'w');
  }
  function xMark(g, cx, cy, r) { // 빨간 가위표 (외곽선)
    cx = Math.round(cx); cy = Math.round(cy); r = Math.max(2, Math.round(r));
    for (let i = -r; i <= r; i++) { fr(g, cx + i - 1, cy + i - 1, 4, 4, 'k'); fr(g, cx + i - 1, cy - i - 1, 4, 4, 'k'); }
    for (let i = -r; i <= r; i++) { fr(g, cx + i, cy + i, 2, 2, 'r'); fr(g, cx + i, cy - i, 2, 2, 'r'); }
  }
  function vMark(g, cx, cy, r) { // 초록 맞음 표시
    cx = Math.round(cx); cy = Math.round(cy); r = Math.max(3, Math.round(r));
    const pts = []; const a = Math.round(r * 0.5);
    for (let i = 0; i <= a; i++) pts.push([cx - r + i, cy + i - 1]);
    for (let i = 0; i <= r + a; i++) pts.push([cx - r + a + i, cy + a - 1 - Math.round(i * (r + a - 1) / (r + a))]);
    for (const p of pts) fr(g, p[0] - 1, p[1] - 1, 4, 4, 'k');
    for (const p of pts) fr(g, p[0], p[1], 2, 2, 'g');
  }
  function veil(g, x, y, w, h, k) { for (let j = 0; j < h; j++) for (let i = (j & 1); i < w; i += 2) fr(g, x + i, y + j, 1, 1, k); }   // 바둑판 점 덮개 (겹쳐 부를 수 있음)
  function corners(g, x0, y0, x1, y1, n, k, t) { // 네 모서리 꺾쇠 (x1, y1 은 바로 다음 칸). 외곽선 + 색, 두께 t
    for (let pass = 0; pass < 2; pass++) {
      const c = pass ? k : 'k', e = pass ? 0 : 1;
      for (const q of [[x0, y0, 1, 1], [x1 - t, y0, -1, 1], [x0, y1 - t, 1, -1], [x1 - t, y1 - t, -1, -1]]) {
        fr(g, (q[2] > 0 ? q[0] : q[0] + t - n) - e, q[1] - e, n + 2 * e, t + 2 * e, c);
        fr(g, q[0] - e, (q[3] > 0 ? q[1] : q[1] + t - n) - e, t + 2 * e, n + 2 * e, c);
      }
    }
  }

  // ---------- 손맛: 번쩍 · 튀는 숫자 · 조각 · 가위표 · 약한 흔들림 ----------
  function age(list, dt, life) { for (let i = list.length - 1; i >= 0; i--) { list[i].t += dt / life; if (list[i].t >= 1) list.splice(i, 1); } }
  function makeFx(P) {
    const floats = [], rings = [], bits = [], marks = [];
    const fx = { shake: 0, clock: 0, flashA: 0, flashC: P.text };
    const rise = function (t) { return 34 * easeOut(t * 1.6) + 8 * bump(t * 5); };   // 튀는 숫자가 떠오른 높이
    fx.float = function (x, y, text, color) { // 앞의 숫자가 아직 근처에 있으면 한 줄 위로 (겹쳐 뭉개지지 않게)
      for (let i = 0; i < floats.length; i++) { const f = floats[i], fy = f.y - rise(f.t); if (Math.abs(f.x - x) < 64 && Math.abs(fy - y) < 34) { y = fy - 34; i = -1; } }
      floats.push({ x: x, y: y, text: text, color: color, t: 0 });
    };
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
    // 효과 색: 받은 pal(예전 PAL 이든 MGPAL 이든)의 역할 색을 PX 점 색으로
    const TONE = {}; TONE[P.text] = 'w'; TONE[P.up] = 'r'; TONE[P.bad] = 'r'; TONE[P.good] = 'g'; TONE[P.gold] = 'y';
    fx.tone = function (c) { return TONE[c] || c; };
    const blink = function (t, from) { return t < from || Math.floor(t * 24) % 2 === 0; };   // 끝무렵엔 깜빡이다 사라짐 (반투명 대신)
    fx.drawPx = function (g) { // 낮은 해상도 화면에: 고리 · 조각 · 가위표
      for (const r of rings) {
        const rr = L(lerp(r.r0, r.r1, easeOut(r.t))), cx = L(r.x), cy = L(r.y);
        if (r.t < 0.55) { ring(g, cx, cy, rr + 1, 'k', 4); ring(g, cx, cy, rr, fx.tone(r.color), 2); }
        else if (blink(r.t, 0.75)) ring(g, cx, cy, rr, fx.tone(r.color), 1);
      }
      for (const b of bits) {
        if (!blink(b.t, 0.7)) continue;
        const s = b.t < 0.5 ? 3 : 2, x = L(b.x), y = L(b.y);
        fr(g, x - 1, y - 1, s + 2, s + 2, 'k'); fr(g, x, y, s, s, fx.tone(b.color));
      }
      for (const m of marks) if (blink(m.t, 0.6)) xMark(g, L(m.x), L(m.y), L(m.r * pop(m.t * 4)) + 1);
    };
    fx.drawText = function (ctx, font, ox, oy) { // 실제 크기 화면에: 튀는 숫자 (둥근모꼴 32px)
      for (const f of floats) {
        if (!blink(f.t, 0.6)) continue;
        ptext(ctx, font, f.text, f.x + ox, f.y - rise(f.t) + oy, 32, fx.tone(f.color));
      }
    };
    return fx;
  }

  // ---------- 공통 틀: 준비 0.8초, 본 게임 seconds 초, 마무리 0.5초 ----------
  // 둥근모꼴 글자: 크기는 16 · 32 · 64 만, 점 단위 외곽선(크기 / 16) + 아래 그림자. 반 점에 걸치지 않게 자리를 정수로
  function ptext(ctx, font, text, cx, cy, size, color) {
    ctx.font = size + 'px ' + font; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const o = size / 16, w = ctx.measureText(text).width;
    const x = Math.round((cx - w / 2) / o) * o, y = Math.round((cy - size / 2) / o) * o;
    ctx.fillStyle = pc('k');
    for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) ctx.fillText(text, x + dx * o, y + dy * o);
    ctx.fillStyle = pc(color); ctx.fillText(text, x, y);
  }
  function band(g, cy, half) { // 가로 띠: 파랑 + 외곽선 + 밝은 줄
    if (half <= 0) return;
    fr(g, 0, cy - half - 1, LW, half * 2 + 2, 'k');
    fr(g, 0, cy - half, LW, half * 2, 'b');
    fr(g, 0, cy - half, LW, 1, 'l'); fr(g, 0, cy + half - 1, LW, 1, 'B');
  }
  let FB = null;   // 낮은 해상도 화면 (한 번에 한 판만 그린다)
  function build(opts, make) {
    opts = opts || {};
    const P = opts.pal || root.PAL || SPARE_PAL;
    const font = opts.font || root.FONT || 'sans-serif';
    const seconds = +opts.seconds > 0 ? +opts.seconds : 7;
    const level = clamp(+opts.level || 0, 0, 3);
    const ramp = opts.ramp == null || !(+opts.ramp >= 0) ? 0.4 : Math.min(+opts.ramp, 1.5);                       // 한 판 안에서 끝에 +ramp 배
    const levelSpeed = opts.levelSpeed == null || !(+opts.levelSpeed >= 0) ? 0.16 : Math.min(+opts.levelSpeed, 0.4);   // 단계마다 +levelSpeed 배
    const intensity = opts.intensity == null ? 1 : clamp(Math.round(+opts.intensity) || 0, 0, 3);              // 알바 강도 0 하 · 1 중 · 2 상 · 3 최상
    const pace = +opts.pace > 0 ? Math.min(+opts.pace, 2.5) : 1;                                                    // 강도의 속도 배율 (안 주면 1)
    const rng = typeof opts.rng === 'function' ? opts.rng : spareRng(1);
    const ready = +opts.ready > 0 ? Math.min(+opts.ready, 3) : READY;                                                 // "준비"가 떠 있는 시간
    const warm = opts.warm == null || !(+opts.warm > 0) ? 1 : clamp(+opts.warm, 0.3, 1), warmSec = +opts.warmSec > 0 ? Math.min(+opts.warmSec, 6) : 0;   // 느린 시작
    const fx = makeFx(P);
    const cap = (+opts.perfect > 0 && +opts.perfect <= 1 ? +opts.perfect : 0.95) - 0.01;                           // 완벽 기준 바로 아래 (ui 가 config 의 grade_perfect 를 넘긴다)
    const env = {
      flawed: function (score, flaws) { return flaws > 0 ? Math.min(score, cap) : score; },   // 흠(틀림 · 넘침)이 하나라도 있으면 완벽은 없다 — 목표 수가 많은 게임에서 한 번 틀린 감점이 묻히지 않게 (2026-11-21 독립 검토). 특성 '금손'(판정이 후해진다)의 덤은 규칙이 이 뒤에 더하므로, 금손이 있으면 흠 하나쯤은 덮인다 — 예전 네 게임과 같은, 특성의 뜻 그대로
      P: P, font: font, seconds: seconds, level: level, speed: (1 + levelSpeed * level) * pace, lf: 1 + levelSpeed * level, intensity: intensity, ramp: ramp, rng: rng, fx: fx,   // lf = 숙련만의 빠르기 (강도의 pace 를 뺀 것 — 생각해서 누르는 게임이 쓴다)
      rate: function (wt) { return 1 + ramp * clamp(wt / seconds, 0, 1); },     // 지금 시각의 속도 배율 (1 -> 1 + ramp)
      warp: function (r) { return makeWarp(r, seconds); },
      pick: function (n) { return Math.min(n - 1, Math.floor(rng() * n)); },
    };
    const impl = make(env);
    let t = 0, phase = 'ready', endT = 0, pending = null;
    impl.state.wt = -ready; impl.state.phase = phase; impl.state.slow = 1;
    const game = {
      w: W, h: H, title: impl.title, howto: impl.howto, how: impl.how || [impl.howto], controls: impl.controls,   // howto = 창 머리의 한 줄, how = 처음 할 때 보여 주는 하는 법
      done: false, result: null,
      _state: impl.state,
      update: function (dt) {
        dt = +dt || 0;
        if (game.done || dt <= 0) return;
        const w0 = t - ready, k = phase === 'play' && warmSec > 0 && w0 < warmSec ? warm + (1 - warm) * clamp(w0 / warmSec, 0, 1) : 1, gd = dt * k;   // 느린 시작: 판의 시계가 warm 배로 시작해 warmSec 에 걸쳐 1 배로
        t += gd;
        const wt = t - ready;                       // 본 게임 시각 (준비 동안은 음수)
        if (phase === 'ready' && wt >= -EPS) phase = 'play';
        impl.tick(gd, wt, phase === 'play');
        fx.update(dt);
        if (phase === 'play' && wt >= seconds - EPS) { phase = 'end'; pending = impl.finish(); }
        else if (phase === 'end') { endT += dt; if (endT >= OUTRO - EPS) { game.done = true; game.result = pending; } }
        impl.state.wt = wt; impl.state.phase = game.done ? 'done' : phase; impl.state.slow = k;
      },
      press: function (code) { if (phase === 'play' && !game.done) impl.press(code); },
      draw: function (ctx) {
        if (typeof document === 'undefined') return;
        const wt = t - ready, o = fx.offset();
        if (!FB) FB = mkc(LW, LH);
        const g = FB[1], ox = Math.round(o[0] / SC), oy = Math.round(o[1] / SC);   // 흔들림도 점 단위로
        g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.imageSmoothingEnabled = false;
        fr(g, 0, 0, LW, LH, 'k');
        g.save(); g.translate(ox, oy);
        impl.draw(g, wt);
        fx.drawPx(g);
        g.restore();
        if (fx.flashA > 0) { // 번쩍: 테두리 + 점무늬
          const a = Math.min(0.3, fx.flashA), c = fx.tone(fx.flashC);
          const t3 = a > 0.15 ? 4 : 2;
          fr(g, 0, 0, LW, t3, c); fr(g, 0, LH - t3, LW, t3, c); fr(g, 0, 0, t3, LH, c); fr(g, LW - t3, 0, t3, LH, c);
        }
        // 남은 시간: 위쪽 외곽선 막대 (파랑, 4분의 1 아래는 노랑). 시연에는 없다 (내 판의 시간이 도는 것처럼 보이지 않게)
        if (!game.idle) {
          const left = clamp(1 - wt / seconds, 0, 1), bw = LW - 14, fw = left > 0 ? Math.max(2, Math.round(bw * left)) : 0;
          OB(g, 6, 2, bw + 2, 6, 'L');
          if (fw) { fr(g, 7, 3, fw, 4, left < 0.25 ? 'y' : 'b'); fr(g, 7, 3, fw, 1, left < 0.25 ? 'Y' : 'l'); }
        }
        // 준비 · 시작 · 끝 (띠는 점으로, 글자는 실제 크기로 나중에)
        let say = null;
        if (phase === 'ready' && !game.idle) {   // idle = 시연: "준비" · "시작!" 없이 장면만
          const k = Math.max(0.3, pop(t / 0.18));
          band(g, L(H / 2), Math.round(18 * Math.min(1, k)));
          say = ['준비', k > 0.7 ? 64 : 32, 'w', H / 2];
        } else if (phase === 'play' && wt < 0.45 && !game.idle) {
          if (wt < 0.3 || Math.floor(wt * 24) % 2 === 0) say = ['시작!', 64, 'y', (impl.startY || H / 2) - Math.round(wt * 30)]; // startY: 첫 장면의 중요한 것(편의점 첫 손님 말풍선)을 가리지 않는 높이
        } else if (phase === 'end') {
          const k = clamp(endT / 0.15, 0, 1);
          dots(g, 0, 0, LW, LH, 'k', 0.3 * k);
          band(g, L(H / 2), Math.round(18 * Math.min(1, Math.max(0.3, pop(k)))));
          say = ['끝!', k > 0.5 ? 64 : 32, 'w', H / 2];
        }
        // 낮은 해상도 화면을 정수 배로 키워 찍는다 (변환을 풀고 실제 점 크기로)
        ctx.save();
        ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
        ctx.imageSmoothingEnabled = false;
        const m = ctx.getTransform ? ctx.getTransform() : null;
        if (m && m.b === 0 && m.c === 0 && m.a > 0 && m.d > 0) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.drawImage(FB[0], Math.round(m.e), Math.round(m.f), Math.round(LW * SC * m.a), Math.round(LH * SC * m.d));
          ctx.setTransform(m);
        } else ctx.drawImage(FB[0], 0, 0, LW * SC, LH * SC);
        // 글자: 판 위의 글(번호 등) → 튀는 숫자 → 준비 · 시작 · 끝
        if (impl.text) impl.text(ctx, wt, ox * SC, oy * SC);
        fx.drawText(ctx, font, ox * SC, oy * SC);
        if (say) ptext(ctx, font, say[0], W / 2, say[3], say[1], say[2]);
        ctx.restore();
      },
    };
    return game;
  }

  // =====================================================================
  // 1. 전단지 돌리기 — 옆에서 본 거리. 걷는 사람이 "건네는 자리"에 겹칠 때 Space
  // =====================================================================
  // ---------- 주인공: 장면(pxart.js)과 같은 2등신 후드티 (22×31). PxArt 가 없으면 같은 점 그림 사본을 쓴다 ----------
  const HERO_SPARE = [
    '......kkkkkkkkkk......', '....kkHHHHHHHHHHkk....', '...kHHHHHHHHHHHHHHk...', '..kHHHHHHHHHHHHHHHHk..', '..kHHHHHHHHHHHHHHHHk..',
    '.kHHHHHHHHHHHHHHHHHHk.', '.kHHHpHHHHHHHHHHpHHHk.', '.kHHppppHHHHHHppppHHk.', '.kHppppppppppppppppHk.', '.kppppppppppppppppppk.',
    '.kppppkkkppppkkkppppk.', '.kpppppPppppppPpppppk.', '.kprrpppppppppppprrpk.', '..kpppppppkkpppppppk..', '...kkppppppppppppkk...',
    '..kbbkkkppppppkkkbbk..', '.kbllllbkkkkkkbllllbk.', '.kbllllllllllllllllbk.', '.kblllllwllllwlllllbk.', '.kblllllwllllwlllllbk.',
    'kbllbllllllllllllbllbk', 'kbllbllbbbbbbbbllbllbk', 'kbllbllbllllllbllbllbk', 'kpppkbbbbbbbbbbbbkpppk', '.kkk.kEEEEEEEEEEk.kkk.',
    '...kEEEEEEEEEEEEEEk...', '...kEEEEEEkkEEEEEEk...', '....kEEEEk..kEEEEk....', '....kEEEEk..kEEEEk....', '...kwwwwwk..kwwwwwk...',
    '...kkkkkkk..kkkkkkk...',
  ];
  function heroRows(face, armOut) {
    const H0 = root.PxArt && Array.isArray(root.PxArt.HERO) && root.PxArt.HERO.length === 31 ? root.PxArt.HERO : HERO_SPARE;
    const r = H0.slice();
    if (face === 'open') { r[10] = '.kpppkwkppppppkwkpppk.'; r[11] = '.kpppkkkPppppPkkkpppk.'; }
    if (armOut) { // 오른쪽(화면 오른쪽) 팔을 어깨 높이로 내민다: 늘어진 팔은 지운다
      for (const y of [20, 21, 22]) r[y] = r[y].slice(0, 17) + 'bk...';
      r[23] = r[23].slice(0, 17) + 'k....'; r[24] = r[24].slice(0, 17) + '.....';
    }
    return r;
  }
  function heroAt(g, x, y, face, armOut) { // (x, y) = 머리 왼쪽 위 (삐침 머리는 y-3 까지)
    fr(g, x + 11, y - 2, 1, 2, 'k'); fr(g, x + 12, y - 3, 2, 1, 'k'); fr(g, x + 10, y - 1, 1, 1, 'k');
    rows(g, x, y, heroRows(face, armOut));
  }
  // 전단지 한 장 (외곽선 포함 9×11, 가운데 기준)
  function sheetSprite() {
    return spr('sheet', 9, 11, 4, 5, function (g) {
      rows(g, 1, 1, ['ooooooo', 'ooOOooo', 'wwwwwww', 'wLLLLLw', 'wwwwwww', 'wLLLLww', 'wwwwwww', 'wLLLwYY', 'wwwwwY.']);
    });
  }
  function sheetSmall() { return spr('sheet-s', 6, 7, 3, 6, function (g) { rows(g, 1, 1, ['oooo', 'wwww', 'wLLw', 'wwww', 'wwww']); }); }
  // 나: 전단지 묶음을 왼손에, 오른손은 내밀기. reach 0~1, droop(헛손질 뒤 잠깐), empty(방금 건넴)
  function meSprite(reach, droop, empty) {
    const n = reach > 0.15 ? 2 + Math.round(reach * 6) : 0, key = 'me' + n + (droop ? 'd' : '') + (empty ? 'e' : '');
    return spr(key, 42, 40, 13, 36, function (g) {
      const X = 2, Y = 5;
      heroAt(g, X, Y, droop ? 'calm' : 'open', n > 0);
      if (n > 0) {
        fr(g, X + 20, Y + 16, n + 1, 1, 'k'); fr(g, X + 20, Y + 17, n, 2, 'l'); fr(g, X + 20, Y + 19, n, 1, 'b'); fr(g, X + 20, Y + 20, n + 1, 1, 'k');
        OB(g, X + 20 + n, Y + 15, 5, 6, 'p');
        if (!empty) rows(g, X + 19 + n, Y + 5, ['kkkkkkkk', 'kooooook', 'kwwwwwwk', 'kwLLLLwk', 'kwwwwwwk', 'kwLLLwwk', 'kwwwwwwk', 'kwwwwwwk', 'kwwwwwwk', 'kkkkkkkk']);
      } else if (!empty && !droop) rows(g, X + 17, Y + 17, ['kkkkkk', 'kooook', 'kwwwwk', 'kwLLwk', 'kwwwwk', 'kkkkkk']);
      // 왼손의 전단지 묶음
      rows(g, X - 2, Y + 17, ['.kkkkkk', 'kkoooook', 'kowwwwwk', 'kowLLLwk', 'kowwwwwk', 'kowLLwwk', 'kowwwwwk', 'kkwwwwwk', '.kkkkkkk']);
    }, true);
  }
  // 걷는 행인 (왼쪽을 봄, 24×38, 기준 = 발 가운데). look 0 비니 · 1 긴 머리 · 2 모자와 배낭, frame 0~3 걸음, got 전단지를 받아 듦
  const WALK_LOOK = [
    { hair: 'H', coat: 'g', shade: 'G', pants: 'b', back: 'B', shoe: 'w' },
    { hair: 'n', coat: 'r', shade: 'R', pants: 'E', back: 'k', shoe: 'H' },
    { hair: 'H', coat: 'y', shade: 'o', pants: 'n', back: 'H', shoe: 'w' },
  ];
  function walkerSprite(look, frame, got) {
    return spr('walk' + look + frame + (got ? 'g' : ''), 26, 40, 13, 36, function (g) {
      const K = WALK_LOOK[look], st = [[-3, 2], [0, 0], [2, -3], [0, 0]][frame], arm = [2, 0, -2, 0][frame], X = 1, Y = 1;
      if (look === 1) fr(g, X + 14, Y + 8, 6, 15, K.hair);                       // 긴 머리 (등 뒤)
      // 다리: 뒤쪽은 어둡게
      fr(g, X + 12 + st[1], Y + 27, 3, 6, K.back); fr(g, X + 11 + st[1], Y + 32, 4, 2, 'k');
      fr(g, X + 9 + st[0], Y + 27, 3, 6, K.pants); fr(g, X + 8 + st[0], Y + 32, 4, 2, K.shoe);
      // 몸
      fr(g, X + 7, Y + 17, 10, 11, K.coat); fr(g, X + 15, Y + 18, 2, 10, K.shade); fr(g, X + 7, Y + 27, 10, 1, K.shade);
      if (look === 0) { fr(g, X + 7, Y + 21, 8, 1, K.shade); fr(g, X + 7, Y + 24, 8, 1, K.shade); }
      if (look === 1) { fr(g, X + 7, Y + 16, 10, 3, 'Y'); fr(g, X + 13, Y + 18, 3, 5, 'Y'); fr(g, X + 13, Y + 22, 3, 1, 'o'); }   // 목도리
      if (look === 2) { fr(g, X + 16, Y + 17, 5, 10, 'E'); fr(g, X + 17, Y + 18, 3, 2, 'e'); fr(g, X + 10, Y + 17, 2, 5, 'E'); }    // 배낭 + 멜빵
      // 머리
      ell(g, X + 12, Y + 10, 8.6, 8.2, 'p');
      for (let y = Y; y < Y + 19; y++) for (let x = X + 2; x < X + 22; x++) {
        const dx = (x + 0.5 - X - 12) / 8.6, dy = (y + 0.5 - Y - 10) / 8.2;
        if (dx * dx + dy * dy > 1) continue;
        const ry = y - Y, rx = x - X;
        if (ry < 6 || (rx > 13 && ry < 14) || rx > 16) fr(g, x, y, 1, 1, K.hair);
      }
      fr(g, X + 14, Y + 10, 2, 3, 'p'); fr(g, X + 15, Y + 11, 1, 1, 'P');           // 귀
      fr(g, X + 5, Y + 9, 1, 2, 'k'); fr(g, X + 9, Y + 9, 1, 2, 'k');               // 눈
      fr(g, X + 4, Y + 12, 2, 1, 'r'); fr(g, X + 9, Y + 12, 2, 1, 'r');             // 볼
      if (look === 0) { // 비니 + 방울
        for (let y = Y; y < Y + 8; y++) for (let x = X + 2; x < X + 22; x++) {
          const dx = (x + 0.5 - X - 12) / 8.6, dy = (y + 0.5 - Y - 10) / 8.2;
          if (dx * dx + dy * dy <= 1.02) fr(g, x, y, 1, 1, y - Y >= 6 ? 'O' : 'o');
        }
        ell(g, X + 12, Y + 1, 2.2, 2, 'Y');
      } else if (look === 2) { // 챙 모자 (앞으로 챙)
        for (let y = Y; y < Y + 6; y++) for (let x = X + 2; x < X + 22; x++) {
          const dx = (x + 0.5 - X - 12) / 8.6, dy = (y + 0.5 - Y - 10) / 8.2;
          if (dx * dx + dy * dy <= 1.02) fr(g, x, y, 1, 1, 'b');
        }
        fr(g, X, Y + 5, 9, 2, 'B');
      }
      // 앞쪽 팔
      if (got) { fr(g, X + 3, Y + 18, 7, 3, K.coat); fr(g, X + 1, Y + 16, 3, 3, 'p'); rows(g, X - 1, Y + 9, ['oooo', 'wwww', 'wLLw', 'wwww', 'wwww', 'wwww']); }
      else { fr(g, X + 9 + arm, Y + 18, 3, 7, K.shade); fr(g, X + 9 + arm, Y + 25, 3, 2, 'p'); }
    });
  }
  // 서류 가방 들고 뛰는 "바쁜 사람" (왼쪽으로, 앞으로 기운 몸). frame 0/1, angry = 내밀었더니 화남
  function runnerSprite(frame, angry) {
    return spr('run' + frame + (angry ? 'a' : ''), 34, 40, 16, 36, function (g) {
      const X = 2, Y = 1, sk = angry ? 'P' : 'p';
      // 다리 (넓은 보폭)
      const a = frame ? [[14, 27, 8, 33], [16, 27, 23, 31]] : [[14, 27, 6, 32], [16, 27, 22, 33]];
      seg(g, X + a[1][0], Y + a[1][1], X + a[1][2], Y + a[1][3], 'k', 3); fr(g, X + a[1][2] - 1, Y + a[1][3], 4, 2, 'k');
      seg(g, X + a[0][0], Y + a[0][1], X + a[0][2], Y + a[0][3], 'E', 3); fr(g, X + a[0][2] - 3, Y + a[0][3], 5, 2, 'H');
      // 기운 몸 (정장)
      for (let y = 0; y < 12; y++) fr(g, X + 8 + Math.round((11 - y) * -0.35) + 3, Y + 16 + y, 10, 1, 'e');
      for (let y = 0; y < 12; y++) fr(g, X + 16 + Math.round((11 - y) * -0.35) + 3, Y + 16 + y, 2, 1, 'E');
      fr(g, X + 8, Y + 16, 4, 4, 'w'); fr(g, X + 9, Y + 17, 2, 5, 'r');                  // 셔츠 깃 + 넥타이
      seg(g, X + 11, Y + 17, X + 22, Y + 13, 'r', 2);                                  // 뒤로 날리는 넥타이
      seg(g, X + 17, Y + 18, X + 23, Y + 23, 'E', 3);                                  // 뒤쪽 팔
      // 머리 (앞으로)
      ell(g, X + 9, Y + 9, 8.2, 7.8, sk);
      for (let y = Y; y < Y + 18; y++) for (let x = X; x < X + 19; x++) {
        const dx = (x + 0.5 - X - 9) / 8.2, dy = (y + 0.5 - Y - 9) / 7.8;
        if (dx * dx + dy * dy <= 1 && (y - Y < 5 || (x - X > 11 && y - Y < 12) || x - X > 14)) fr(g, x, y, 1, 1, 'H');
      }
      fr(g, X + 3, Y + 9, 2, 1, 'k'); fr(g, X + 7, Y + 9, 2, 1, 'k');                     // 찌푸린 눈
      fr(g, X + 3, Y + 13, 3, 2, 'k');                                                  // 헉헉 입
      fr(g, X + 11, Y + 10, 2, 3, sk);
      // 앞팔 + 서류 가방
      seg(g, X + 8, Y + 19, X + 4, Y + 23, 'e', 3);
      fr(g, X + 2, Y + 22, 3, 2, 'p');
      fr(g, X, Y + 24, 9, 7, 'n'); fr(g, X, Y + 26, 9, 1, 'H'); fr(g, X + 3, Y + 23, 3, 1, 'H');
      if (angry) { fr(g, X + 15, Y - 0, 1, 3, 'r'); fr(g, X + 14, Y + 1, 3, 1, 'r'); fr(g, X + 18, Y + 2, 1, 3, 'r'); fr(g, X + 17, Y + 3, 3, 1, 'r'); }
      else { fr(g, X + 19, Y + 5, 2, 3, 's'); fr(g, X + 21, Y + 10, 2, 2, 's'); }        // 땀
    });
  }
  // 낮의 거리 (한 번 찍어 둔다): 하늘 · 먼 빌딩 · 가게 다섯 · 보도. gy = 발 닿는 줄
  function streetSprite(gy) {
    return spr('street', LW, LH, 0, 0, function (g) {
      fr(g, 0, 0, LW, LH, 's'); fr(g, 0, 34, LW, 26, 'q');
      for (let x = 0; x < LW; x += 2) fr(g, x + ((x >> 1) & 1), 33, 1, 1, 'q');
      // 구름
      for (const c of [[34, 14, 13], [150, 9, 10], [236, 18, 15]]) {
        ell(g, c[0], c[1], c[2], 4, 'w'); ell(g, c[0] - c[2] * 0.4, c[1] - 2, c[2] * 0.45, 4, 'w'); ell(g, c[0] + c[2] * 0.3, c[1] - 3, c[2] * 0.4, 4, 'w');
        fr(g, c[0] - c[2] + 2, c[1] + 2, c[2] * 2 - 4, 1, 'S');
      }
      // 먼 빌딩 (흐린 하늘색)
      for (const b of [[96, 16, 26], [126, 28, 18], [196, 8, 22], [252, 22, 30]]) {
        fr(g, b[0], b[1], b[2], 70, 'S');
        for (let y = b[1] + 4; y < 80; y += 6) for (let x = b[0] + 3; x < b[0] + b[2] - 3; x += 5) fr(g, x, y, 3, 3, 'q');
      }
      // 가게 다섯: [x, w, 지붕 y, 벽, 차양 색, 간판 그림]
      const shops = [[0, 60, 38, 'c', 'r', 0], [60, 58, 46, 'L', 'g', 1], [118, 60, 32, 'Y', 'b', 2], [178, 58, 44, 'C', 'o', 3], [236, 58, 36, 'S', 'g', 1]];
      for (const s of shops) {
        const x = s[0], w = s[1], top = s[2], base = gy - 9;
        OB(g, x, top, w + 1, base - top + 1, s[3]);
        fr(g, x + 1, top + 1, w - 1, 2, 'd'); fr(g, x + 1, top + 3, w - 1, 1, 'k');                        // 처마
        for (let wx = x + 6; wx + 9 < x + w; wx += 14) { OB(g, wx, top + 7, 9, 9, 'S'); fr(g, wx + 1, top + 8, 2, 2, 'w'); fr(g, wx + 4, top + 7, 1, 9, 'k'); }
        // 간판 (글 없이 그림만)
        const sy = top + 19;
        SB(g, x + 10, sy, w - 19, 9, 'w');
        const cx = x + Math.floor(w / 2);
        if (s[5] === 0) { OB(g, cx - 3, sy + 2, 6, 6, 'o'); fr(g, cx + 3, sy + 3, 2, 3, 'k'); }               // 컵
        else if (s[5] === 1) { ell(g, cx, sy + 4.5, 3.5, 3, 'r'); fr(g, cx - 1, sy + 1, 2, 2, 'g'); }            // 꽃
        else if (s[5] === 2) { OB(g, cx - 5, sy + 2, 10, 6, 'N'); fr(g, cx - 3, sy + 3, 1, 1, 'd'); fr(g, cx + 1, sy + 3, 1, 1, 'd'); } // 빵
        else { OB(g, cx - 4, sy + 2, 8, 6, 'b'); fr(g, cx - 2, sy + 4, 4, 1, 'w'); }                        // 책
        // 차양 (줄무늬 + 물결 끝)
        const ay = sy + 11;
        fr(g, x + 1, ay - 1, w - 1, 1, 'k');
        for (let i = 0; i < w - 1; i++) fr(g, x + 1 + i, ay, 1, 6, (Math.floor(i / 4) & 1) ? 'w' : s[4]);
        for (let i = 0; i < w - 1; i++) if ((i & 3) < 2) fr(g, x + 1 + i, ay + 6, 1, 1, (Math.floor(i / 4) & 1) ? 'w' : s[4]);
        for (let i = 0; i < w - 1; i++) fr(g, x + 1 + i, ay + ((i & 3) < 2 ? 7 : 6), 1, 1, 'k');
        // 진열창 + 문
        const wy = ay + 9;
        if (wy < base - 4) {
          OB(g, x + 4, wy, w - 22, base - wy, 'S'); fr(g, x + 6, wy + 2, 3, 1, 'w'); fr(g, x + 6, wy + 3, 1, 2, 'w');
          OB(g, x + w - 15, wy - 1, 11, base - wy + 2, 'n'); fr(g, x + w - 13, wy + 1, 7, base - wy - 4, 'N'); fr(g, x + w - 7, wy + 7, 1, 2, 'y');
        }
      }
      // 보도 (벽돌 무늬)
      const top = gy - 9;
      fr(g, 0, top, LW, LH - top, 'C'); fr(g, 0, top, LW, 1, 'k'); fr(g, 0, top + 1, LW, 1, 'd');
      const lines = [top + 4, top + 9, top + 15, top + 22, top + 30];
      for (let i = 0; i < lines.length; i++) {
        fr(g, 0, lines[i], LW, 1, 'd');
        const prev = i ? lines[i - 1] : top + 1, step = 14 + i * 4;
        for (let x = (i & 1) * (step >> 1); x < LW; x += step) fr(g, x, prev + 1, 1, lines[i] - prev - 1, 'd');
      }
      // 가로등 (낮이라 꺼짐) — 건네는 자리 오른쪽
      const lx = 233;
      fr(g, lx, 40, 2, gy - 41, 'E'); fr(g, lx, 40, 1, gy - 41, 'k'); fr(g, lx - 1, gy - 3, 4, 2, 'k');
      fr(g, lx - 2, 39, 6, 1, 'k'); OB(g, lx - 3, 33, 8, 6, 'L'); fr(g, lx - 2, 34, 6, 1, 'w'); fr(g, lx - 1, 32, 4, 1, 'k');
      // 화분 나무 (오른쪽 끝)
      ell(g, 280, gy - 22, 8, 8, 'g'); ell(g, 278, gy - 24, 4, 4, 'h'); OB(g, 276, gy - 12, 9, 9, 'n'); fr(g, 279, gy - 15, 3, 3, 'n');
    }, true);
  }

  function makeFlyer(env) {
    const P = env.P, rng = env.rng, fx = env.fx, seconds = env.seconds, speed = env.speed, rate = env.rate;
    const GY = 318, ZX = 240, ZH = [46, 35, 27, 22][env.intensity], MX = 112;       // 바닥 · 건네는 자리 가운데 · 꺾쇠 반폭(강도가 높으면 좁다) · 내 자리
    const BUSY = [0.24, 0.32, 0.38, 0.42][env.intensity], DENSE = [0.9, 0.72, 0.6, 0.52][env.intensity], MARG = 0.05;   // 강도: 바쁜 사람 비율 · 사람 간격 · 자리에서 앞사람과의 틈(누를 틈)
    const SPACE = [0.42, 0.34, 0.29, 0.26][env.intensity], FLOOR = STAY[env.intensity], VM = [1.1, 1.3, 1.4, 1.5][env.intensity];   // 앞사람과의 시간 간격 바닥 · 자리에 머무는 시간 바닥 · 걸음 속도 배율
    const JH = ZH + 8;                                 // 판정 반폭: 몸이 꺾쇠에 걸치면 인정 (눈에 보이는 것보다 박하지 않게)
    const CAP_WALK = 2 * JH / FLOOR, CAP_BUSY = 2 * JH / (FLOOR - 0.02);   // 걷는 속도 상한: 판정 자리를 FLOOR 초(바쁜 사람은 0.02초 덜)는 지나가게
    // 등장 시각: 간격이 (속도 x 점점 빨라짐) 에 반비례해 시작 0.72초 -> 끝으로 갈수록 줄어든다
    const first = 0.8, lastAt = seconds - 0.45, nominal = [];
    for (let t = first; nominal.length < 3 || t <= lastAt + EPS;) {
      const g = 0.72 * DENSE / (speed * rate(t));
      nominal.push(t + (rng() * 2 - 1) * Math.min(0.11, g * 0.16));
      t += g;
    }
    const n = nominal.length;
    const busyAt = [], nBusy = n >= 3 ? Math.max(1, Math.round(n * BUSY)) : 0;
    for (let guard = 0; busyAt.length < nBusy && guard < 80; guard++) {  // 첫 사람은 늘 보통 행인, 바쁜 사람끼리 연달아 오지 않음
      const i = 1 + env.pick(n - 1);
      if (busyAt.every(function (b) { return Math.abs(b - i) > 1; })) busyAt.push(i);
    }
    const people = [];
    let prevAt = 0, prevStay = 0;
    for (let i = 0; i < n; i++) {
      const busy = busyAt.indexOf(i) >= 0;
      const raw = (busy ? 470 + 70 * rng() : 230 + 150 * rng()) * speed * VM * rate(nominal[i]);   // 저마다 다른 속도, 뒤로 갈수록 빠름
      const v = busy ? softCap(raw, CAP_BUSY, 0.9) : softCap(raw, CAP_WALK, 0.8);
      const stay = 2 * JH / v;                                              // 판정 자리에 머무는 시간
      const at = i ? Math.max(nominal[i], prevAt + (prevStay + stay) / 2 + MARG, prevAt + SPACE) : nominal[i];   // 자리 한가운데에 닿는 시각 (앞사람과 자리에서 겹치지 않게, 너무 붙지도 않게)
      if (at > lastAt + EPS && people.length >= 3) break;
      people.push({ busy: busy, at: at, v: v, stay: stay, look: env.pick(3), state: 'walk', x: W + 300, hop: 0 });
      prevAt = at; prevStay = stay;
    }
    const nKept = people.filter(function (p) { return p.busy; }).length;
    const S = { people: people, total: Math.max(1, people.length - nKept), hits: 0, busyHits: 0, empties: 0, misses: 0, zoneX: ZX, zoneHalf: JH, lock: 0, reach: 0, glow: 0, warn: 0, papers: [] };
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
        return { score: clamp((S.hits - S.busyHits - 0.5 * S.empties) / S.total, 0, 1), hits: S.hits, total: S.total, // detail: 결과 창의 한 줄 내역
          detail: '건넨 전단지 ' + S.hits + ' / ' + S.total + (S.busyHits ? ' · 뛰는 사람에게 ' + S.busyHits + '번' : '') + (S.empties ? ' · 헛손질 ' + S.empties + '번' : '') };
      },
      draw: function (g) {
        const gy = L(GY), zx = L(ZX), zh = L(ZH);
        g.drawImage(streetSprite(gy), 0, 0);
        // 건네는 자리: 보도 위 노란 자리 + 네 모서리 꺾쇠 (사람이 들어오면 굵고 노랗게)
        const here = inZone();
        const zc = S.warn > 0.05 ? 'r' : S.glow > 0.05 ? 'g' : here ? 'y' : 'b';
        const grow = Math.round(2 * bump(Math.max(S.glow, S.warn)));
        for (let y = -3; y <= 3; y++) for (let x = -zh; x <= zh; x++) {
          const d = (x * x) / (zh * zh) + (y * y) / 12;
          if (d <= 1 && (here || S.glow > 0.05 || ((x + y) & 1) === 0)) fr(g, zx + x, gy + y, 1, 1, S.glow > 0.05 ? 'h' : 'Y');
        }
        corners(g, zx - zh - grow, gy - 46 - grow, zx + zh + 1 + grow, gy + 5 + grow, 7, zc, here || S.glow > 0.05 || S.warn > 0.05 ? 3 : 2);
        // 행인: 그림자 → 보통 사람 → 바쁜 사람이 위
        for (const p of people) if (p.x > -90 && p.x < W + 110) ell(g, L(p.x), gy, 7, 1.6, 'd');
        for (let pass = 0; pass < 2; pass++) for (const p of people) {
          if (p.busy !== (pass === 1) || p.x < -90 || p.x > W + 110) continue;
          const x = L(p.x);
          if (p.busy) {
            for (const s of [[13, 27, 7], [17, 20, 9], [13, 12, 6]]) fr(g, x + s[0], gy - s[1], s[2], 1, 'E');   // 속도선
            put(g, runnerSprite(((Math.floor(p.x / 22 / (Math.PI / 2)) % 2) + 2) % 2, p.state === 'angry'), x, gy);
          } else put(g, walkerSprite(p.look, ((Math.floor(p.x / 15 / (Math.PI / 2)) % 4) + 4) % 4, p.state === 'got'), x, gy - L(12 * bump(p.hop)));
        }
        const out = S.reach > 0 ? Math.sin(Math.PI * S.reach * S.reach) : 0;   // 누른 뒤 0.06초에 가장 길게
        ell(g, L(MX), gy, 8, 1.6, 'd');
        put(g, meSprite(out, S.lock > 0, S.glow > 0.45), L(MX), gy);
        for (const q of S.papers) if (q.t < 0.9) {   // 떨어지는 전단지: 90도씩 돌며 점무늬로 사라짐
          faded(g, 1 - q.t / 0.9, function (lg) {
            lg.save(); lg.translate(L(q.x), L(q.y)); lg.rotate(Math.round(q.t * 7 / (Math.PI / 2)) * Math.PI / 2); lg.drawImage(sheetSprite(), -4, -5); lg.restore();
          });
        }
      },
    };
  }

  // =====================================================================
  // 2. 상하차 — 컨베이어로 내려오는 상자를 분류선에서 표시된 방향키로 보낸다
  // =====================================================================
  const DIR_CODES = ['ArrowLeft', 'ArrowRight', 'ArrowUp'];
  // 상자 (25×22, 가운데 기준): 윗면 · 옆면 · 앞면 + 방향 딱지. bad = 떨어뜨린 상자(붉게)
  function crateSprite(dir, bad) {
    return spr('crate' + dir + (bad ? 'b' : ''), 25, 23, 12, 11, function (g) {
      const f = bad ? 'r' : 'N', sh = bad ? 'R' : 'n', tp = bad ? 'P' : 'd';
      for (let j = 0; j < 4; j++) fr(g, 4 - j, 1 + j, 19, 1, tp);                    // 윗면
      for (let x = 20; x <= 22; x++) fr(g, x, 4 - (x - 19), 1, 15, sh);              // 옆면
      fr(g, 1, 5, 19, 15, f); fr(g, 1, 5, 19, 1, sh); fr(g, 1, 18, 19, 2, sh);         // 앞면
      for (let j = 0; j < 4; j++) fr(g, 11 - j, 1 + j, 2, 1, 'Y');                   // 테이프
      fr(g, 9, 5, 2, 2, 'Y');
      sticker(g, 10, 12, 12, dir);
    });
  }
  function crateSmall() { // 쌓인 상자 (13×11)
    return spr('crate-s', 13, 11, 0, 0, function (g) { fr(g, 2, 1, 10, 2, 'd'); fr(g, 1, 3, 10, 6, 'N'); fr(g, 1, 8, 10, 1, 'n'); fr(g, 11, 2, 1, 7, 'n'); fr(g, 5, 1, 2, 3, 'Y'); });
  }
  // 트럭 (옆에서 봄, 92×54). 머리가 왼쪽 · 짐칸 뒤(오른쪽)가 열림. 기준 = 가운데
  function truckSprite(dir) {
    return spr('truck' + dir, 93, 54, 46, 27, function (g) {
      const cab = dir === 0 ? 'b' : 'o', cabSh = dir === 0 ? 'B' : 'O';
      fr(g, 2, 38, 88, 3, 'E'); fr(g, 2, 38, 88, 1, 'e');                           // 차대
      OB(g, 30, 2, 60, 37, 'w'); fr(g, 31, 3, 58, 1, 'L');                         // 짐칸
      for (let x = 34; x < 56; x += 5) fr(g, x, 5, 1, 32, 'L');
      OB(g, 57, 6, 31, 31, 'E'); fr(g, 58, 7, 29, 2, 'k'); fr(g, 58, 33, 29, 3, 'e'); // 열린 안쪽
      OB(g, 88, 4, 4, 27, 'L');                                                    // 젖혀 둔 문
      SB(g, 2, 14, 30, 25, cab); fr(g, 3, 36, 28, 2, cabSh);                       // 운전석
      OB(g, 5, 17, 14, 10, 'S'); fr(g, 7, 19, 2, 1, 'w'); fr(g, 7, 20, 1, 2, 'w');  // 창
      fr(g, 21, 18, 1, 16, cabSh); fr(g, 23, 25, 3, 1, cabSh);                       // 문 · 손잡이
      OB(g, 1, 29, 4, 5, 'Y');                                                     // 전조등
      OB(g, 0, 34, 33, 4, 'L');                                                    // 범퍼
      for (const cx of [18, 72]) { ell(g, cx, 45, 6, 6, 'k'); ell(g, cx, 45, 3.6, 3.6, 'E'); fr(g, cx - 1, 44, 2, 2, 'L'); }   // 바퀴
    }, true);
  }
  // 선반 (80×20, 가운데 기준). 위 방향 상자가 아래 판에 쌓인다
  function shelfSprite() {
    return spr('shelf', 82, 22, 41, 10, function (g) {
      fr(g, 4, 1, 3, 20, 'e'); fr(g, 75, 1, 3, 20, 'e'); fr(g, 4, 1, 1, 20, 'L'); fr(g, 75, 1, 1, 20, 'L');
      fr(g, 1, 1, 80, 3, 'n'); fr(g, 1, 1, 80, 1, 'N');
      fr(g, 1, 16, 80, 4, 'N'); fr(g, 1, 19, 80, 1, 'n');
    });
  }
  // 작업 장갑 낀 내 손 (16×46, 기준 = 손바닥 가운데). 소매는 주인공의 하늘색 후드
  function gloveSprite() {
    return spr('glove', 17, 47, 8, 12, function (g) {
      fr(g, 2, 2, 3, 8, 'Y'); fr(g, 5, 1, 3, 9, 'Y'); fr(g, 8, 2, 3, 8, 'Y');
      fr(g, 2, 8, 10, 10, 'Y'); fr(g, 2, 15, 10, 3, 'y'); fr(g, 5, 3, 1, 6, 'y'); fr(g, 8, 3, 1, 6, 'y');
      fr(g, 12, 9, 3, 6, 'Y'); fr(g, 12, 13, 3, 2, 'y');
      fr(g, 1, 18, 12, 4, 'o'); fr(g, 1, 21, 12, 1, 'O');
      fr(g, 3, 22, 9, 25, 'l'); fr(g, 9, 22, 3, 25, 'b');
    });
  }
  // 창고 (한 번 찍어 둔다): 밝은 벽 · 양쪽 하역문(밖은 낮) · 바닥 · 벨트 틀
  function warehouseSprite(bx0, bx1, top, end) {
    return spr('warehouse', LW, LH, 0, 0, function (g) {
      fr(g, 0, 0, LW, 101, 'L');
      for (const y of [18, 38, 58, 78]) fr(g, 0, y, LW, 1, 'e');
      for (let x = 2; x < LW; x += 4) for (const y of [18, 38, 58, 78]) fr(g, x, y + 1, 1, 1, 'w');
      // 하역문 둘 (밖: 하늘 · 먼 빌딩 · 땅)
      for (const o of [[6, 94], [194, 94]]) {
        const x = o[0], w = o[1];
        fr(g, x - 3, 28, w + 6, 74, 'k');
        for (let y = 29; y < 101; y++) { fr(g, x - 2, y, 2, 1, ((y >> 2) & 1) ? 'y' : 'k'); fr(g, x + w, y, 2, 1, ((y >> 2) & 1) ? 'y' : 'k'); }
        fr(g, x, 29, w, 72, 's'); fr(g, x, 60, w, 20, 'q');
        for (let i = 0; i < 5; i++) { const bx = x + 4 + i * 19, bh = 10 + ((i * 7) % 4) * 5; fr(g, bx, 80 - bh, 14, bh, 'S'); for (let wy = 82 - bh; wy < 78; wy += 4) fr(g, bx + 3, wy, 8, 1, 'q'); }
        fr(g, x, 80, w, 21, 'e'); fr(g, x, 80, w, 1, 'E');
        fr(g, x, 29, w, 6, 'E'); for (let i = 0; i < 3; i++) fr(g, x, 30 + i * 2, w, 1, 'e');   // 말아 올린 셔터
      }
      // 기둥
      for (const x of [0, 102, 186, 288]) { fr(g, x, 0, 6, 101, 'e'); fr(g, x + 4, 0, 2, 101, 'E'); fr(g, x + 1, 0, 1, 101, 'L'); }
      // 바닥 + 안전선
      fr(g, 0, 101, LW, LH - 101, 'e'); fr(g, 0, 101, LW, 1, 'k');
      for (let x = 0; x < LW; x++) fr(g, x, 102, 1, 2, (((x + 0) >> 2) & 1) ? 'y' : 'k');
      for (const y of [112, 122]) fr(g, 0, y, LW, 1, 'E');
      for (let x = 20; x < LW; x += 48) { fr(g, x, 104, 1, 8, 'E'); fr(g, x + 24, 113, 1, 9, 'E'); }
      // 벨트가 나오는 벽 구멍
      fr(g, bx0 - 6, top - 7, bx1 - bx0 + 13, 8, 'k'); fr(g, bx0 - 5, top - 6, bx1 - bx0 + 11, 6, 'E');
      for (let x = bx0 - 4; x < bx1 + 4; x += 4) fr(g, x, top - 6, 3, 6, 'H');
      // 벨트 틀 (다리 · 옆 난간 · 끝 롤러)
      for (const x of [bx0 - 2, bx1 - 1]) { fr(g, x, end, 3, 103 - end, 'E'); fr(g, x, end, 1, 103 - end, 'k'); }
      fr(g, bx0 - 4, top - 1, 4, end - top + 3, 'k'); fr(g, bx0 - 3, top - 1, 2, end - top + 2, 'L');
      fr(g, bx1, top - 1, 4, end - top + 3, 'k'); fr(g, bx1 + 1, top - 1, 2, end - top + 2, 'L');
      OB(g, bx0 - 4, end - 2, bx1 - bx0 + 8, 5, 'L'); fr(g, bx0 - 3, end + 1, bx1 - bx0 + 6, 1, 'e');
    }, true);
  }

  function makeLoading(env) {
    const P = env.P, rng = env.rng, fx = env.fx, seconds = env.seconds, speed = env.speed;
    const BX = 440, BW = 116, LINE = 250, WIN = [32, 25, 20, 17][env.intensity], TOP = 82, END = 344;   // 선 반폭(강도가 높으면 좁다)
    const FLOOR = STAY[env.intensity], SPACE = [0.39, 0.32, 0.275, 0.25][env.intensity];                 // 선에 머무는 시간 바닥 · 상자 사이 시간 바닥(세 방향을 고를 틈)
    const v0 = Math.min(2 * WIN / (FLOOR + 0.01), 128 * speed * [1.1, 1.3, 1.45, 1.55][env.intensity]);   // 벨트 처음 속도(강도가 높으면 조금 더). 선에 FLOOR 초는 머물게. 끝날 때는 (1 + ACC) 배
    // 벨트는 한 줄로 흐르기만 해서 가속이 덜 느껴진다: ramp 0.4 일 때 예전처럼 1.5배(ACC 0.5)가 되도록 1.25 배로 건다.
    // 상자가 선에 머무는 시간(2 x WIN / 속도)이 끝에서도 FLOOR 초 아래로 내려가지 않게 ACC 를 누른다.
    const ACC = Math.max(0, Math.min(env.ramp * 1.25, 2 * WIN / (FLOOR * v0) - 1));
    const GAP = Math.max(90, Math.ceil(v0 * (1 + ACC) * SPACE));   // 상자 간격: 선 반폭의 두 배보다 넓고(선에 늘 하나만), 가장 빠를 때도 SPACE 초는 벌어지게
    const wp = env.warp(ACC);
    const travel = function (wt) { return v0 * wp.tau(wt); };   // 벨트가 흐른 거리
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
    const S = { boxes: boxes, total: n, acc: ACC, hits: 0, wrongs: 0, misses: 0, empties: 0, lineY: LINE, win: WIN, pile: [0, 0, 0], bounce: [0, 0, 0], push: 0, pushDir: 2, glow: 0, warn: 0, belt: 0 };
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
        return { score: clamp((S.hits - 0.34 * S.empties - 0.34 * S.wrongs) / S.total, 0, 1), hits: S.hits, total: S.total,   // 틀린 방향: 그 상자를 잃고 감점도
          detail: '실은 상자 ' + S.hits + ' / ' + S.total + (S.wrongs ? ' · 떨어뜨림 ' + S.wrongs + '번' : '') + (S.empties ? ' · 헛누름 ' + S.empties + '번' : '') };
      },
      draw: function (g) {
        const bx0 = L(BX - BW / 2), bx1 = L(BX + BW / 2), top = L(TOP), end = L(END), ly = L(LINE), win = L(WIN), cx = L(BX);
        g.drawImage(warehouseSprite(bx0, bx1, top, end), 0, 0);
        // 벨트: 고무 바닥 + 흐르는 마디
        fr(g, bx0, top - 1, bx1 - bx0, end - top + 1, 'E');
        const sh = Math.round(((S.belt % 27) + 27) % 27 / SC);
        for (let y = top - 1 + sh; y < end - 1; y += 9) { fr(g, bx0, y, bx1 - bx0, 1, 'e'); fr(g, bx0, y + 1, bx1 - bx0, 1, 'k'); }
        // 분류선: 노란 줄 + 양옆 세모, 선 둘레(판정 폭)는 점무늬
        const here = atLine();
        const lc = S.warn > 0.05 ? 'r' : S.glow > 0.05 ? 'g' : here ? 'y' : 'w';
        dots(g, bx0, ly - win, bx1 - bx0, win * 2 + 1, here || S.glow > 0.05 || S.warn > 0.05 ? lc : 'Y', here ? 0.25 : 0.12);
        for (let x = bx0 + 1; x < bx1 - 1; x += 6) { fr(g, x - 1, ly - 2, 6, 4, 'k'); }
        for (let x = bx0 + 1; x < bx1 - 1; x += 6) { fr(g, x, ly - 1, 4, 2, lc); }
        for (let j = -4; j <= 4; j++) {
          const n = 5 - Math.abs(j);
          fr(g, bx0 - 6 - n - 1, ly + j - 1, n + 2, 3, 'k'); fr(g, bx1 + 5, ly + j - 1, n + 2, 3, 'k');
        }
        for (let j = -3; j <= 3; j++) { const n = 4 - Math.abs(j); fr(g, bx0 - 6 - n, ly + j, n, 1, lc); fr(g, bx1 + 6, ly + j, n, 1, lc); }
        // 벨트 위 상자 (먼 것부터)
        for (let i = boxes.length - 1; i >= 0; i--) {
          const b = boxes[i], x = L(b.x + 4), y = L(b.y);
          if (b.state === 'belt' && b.y > TOP - 60) {
            g.save(); g.beginPath(); g.rect(0, top - 1, LW, LH); g.clip();   // 벽 구멍에서 나오는 것처럼
            put(g, crateSprite(b.dir), x, y);
            g.restore();
            if (b === here) corners(g, x - 15, y - 14, x + 15, y + 14, 5, lc === 'w' ? 'y' : lc, 2);
          } else if (b.state === 'lost' || b.state === 'wrong') {
            faded(g, 1 - b.t, function (lg) { putRot(lg, crateSprite(b.dir, true), x, y, b.t * (b.kx || 0.6) * 1.6, 1 - b.t * 0.3); });
          }
        }
        // 선반 + 위 딱지
        const sy = L(40) + 4 + (S.bounce[2] > 0.3 ? 1 : 0);
        put(g, shelfSprite(), cx, sy);
        for (let i = 0; i < Math.min(S.pile[2], 5); i++) g.drawImage(crateSmall(), cx - 34 + i * 14, sy - 4);
        sticker(g, cx - 51, L(40) + 6, 15, 2);
        // 트럭 둘 (+ 쌓인 상자, 딱지는 뒤집지 않음)
        for (let d = 0; d < 2; d++) {
          const tx = L(d ? 714 : 166), ty = L(232) + (S.bounce[d] > 0.3 ? 1 : 0), spr0 = truckSprite(d), tl = tx - 46, tt = ty - 27;
          put(g, d ? flipped(spr0) : spr0, tx, ty);
          for (let i = 0; i < Math.min(S.pile[d], 6); i++) {
            const col = i % 2, row = Math.floor(i / 2);
            g.drawImage(crateSmall(), d ? tl + 20 - col * 13 : tl + 60 + col * 13, tt + 25 - row * 9);
          }
          sticker(g, d ? tl + 48 : tl + 44, tt + 20, 17, d);
        }
        // 내 손: 누른 쪽으로 밀어낸다
        const k = bump(S.push), px = (S.pushDir === 0 ? -1 : S.pushDir === 1 ? 1 : 0) * 18 * k, py = (S.pushDir === 2 ? -20 : 0) * k;
        put(g, gloveSprite(), L(BX - BW / 2 - 40 + px), L(LINE + 36 + py));
        put(g, flipped(gloveSprite()), L(BX + BW / 2 + 40 + px), L(LINE + 36 + py));
        // 날아가는 상자 (포물선)
        for (const b of boxes) if (b.state === 'fly') {
          const e = easeOut(b.t), d = DEST[b.dir];
          const arc = Math.sin(e * Math.PI);                 // 위로 가는 상자는 벨트 옆으로 돌아서 간다 (내려오는 상자를 안 가리게)
          const x = L(lerp(b.x0, d[0], e) + (b.dir === 2 ? 104 * arc : 0)), y = L(lerp(b.y0, d[1], e) - (b.dir === 2 ? 0 : 46 * arc)), s = lerp(1.12, 0.56, e);
          putRot(g, crateSprite(b.dir), x, y, (b.dir === 0 ? -1 : 1) * e * 0.5, s);
        }
      },
    };
  }

  // =====================================================================
  // 3. 편의점 계산 — 말풍선에 뜬 순서대로 진열대 번호(1~4)를 고른다
  // =====================================================================
  const ITEM_NAMES = ['삼각김밥', '컵라면', '캔커피', '우유'];
  const DIGIT_CODES = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
  // 물건 그림 (26×27, 가운데 기준). 넷 다 윤곽 · 색이 다르다
  function itemSprite(id) {
    return spr('item' + id, 26, 27, 13, 13, function (g) {
      if (id === 0) {            // 삼각김밥: 흰 세모 + 아래 김 + 주황 딱지
        for (let j = 0; j < 19; j++) {
          const half = Math.min(11, 1.5 + j * 0.55), x0 = Math.round(13 - half), w = Math.round(half * 2);
          const cut = j === 18 ? 1 : 0;
          fr(g, x0 + cut, 4 + j, w - cut * 2, 1, j >= 12 ? 'G' : 'w');
          if (j < 12) fr(g, x0 + w - 2, 4 + j, 2, 1, 'L');
        }
        fr(g, 6, 16, 14, 1, 'g');
        fr(g, 10, 9, 6, 3, 'o'); fr(g, 10, 11, 6, 1, 'O');
      } else if (id === 1) {     // 컵라면: 위가 넓은 빨간 컵 + 흰 띠 + 뚜껑 + 김
        for (let j = 0; j < 15; j++) { const half = 9 - j * 0.2, x0 = Math.round(13 - half); fr(g, x0, 9 + j, Math.round(half * 2), 1, j >= 4 && j <= 8 ? 'w' : 'r'); fr(g, x0 + Math.round(half * 2) - 2, 9 + j, 2, 1, j >= 4 && j <= 8 ? 'L' : 'R'); }
        fr(g, 11, 14, 4, 3, 'r');
        fr(g, 3, 6, 20, 3, 'Y'); fr(g, 3, 8, 20, 1, 'y'); fr(g, 19, 3, 4, 3, 'Y');
      } else if (id === 2) {     // 캔커피: 좁고 긴 갈색 캔 + 노란 띠 + 콩
        fr(g, 8, 1, 10, 2, 'L'); fr(g, 7, 3, 12, 20, 'n'); fr(g, 16, 3, 3, 20, 'H'); fr(g, 7, 23, 12, 2, 'e');
        fr(g, 7, 9, 12, 8, 'y'); fr(g, 16, 9, 3, 8, 'o');
        ell(g, 12, 13, 2.5, 3.2, 'H'); fr(g, 12, 11, 1, 4, 'y');
        fr(g, 9, 4, 1, 4, 'N');
      } else {                   // 우유: 지붕 달린 흰 종이갑 + 파란 물결
        fr(g, 9, 1, 8, 3, 'w');
        for (let j = 0; j < 6; j++) fr(g, 9 - j, 4 + j, 8 + j * 2, 1, j & 1 ? 'S' : 'w');
        fr(g, 4, 10, 18, 15, 'w'); fr(g, 19, 10, 3, 15, 'L');
        for (let x = 4; x < 22; x++) { const top = 16 + (((x >> 2) & 1) ? 1 : 0); fr(g, x, top, 1, 25 - top, x >= 19 ? 'B' : 'b'); }
        fr(g, 11, 12, 3, 1, 'b'); fr(g, 12, 11, 1, 3, 'b');
      }
    });
  }
  // 손님 윗몸 (44×60, 기준 = 가운데 · 계산대 윗선). look 0 학생 · 1 직장인 · 2 할머니 · 3 모자, mood 0 보통 · 1 웃음 · 2 시무룩
  function customerSprite(look, mood) {
    return spr('cust' + look + mood, 46, 62, 23, 50, function (g) {
      const X = 1, Y = 1, jacket = ['g', 'E', 'N', 'b'][look], shade = ['G', 'k', 'n', 'B'][look];
      if (look === 0) ell(g, X + 22, Y + 24, 17, 15, 'G');                              // 후드
      if (look === 2) for (let i = 0; i < 7; i++) ell(g, X + 8 + i * 4.6, Y + 7 + Math.abs(i - 3) * 1.5, 4.2, 4.2, 'L');   // 뽀글 머리
      // 어깨
      fr(g, X + 4, Y + 40, 36, 20, jacket); fr(g, X + 2, Y + 44, 40, 16, jacket); fr(g, X + 36, Y + 42, 4, 18, shade);
      fr(g, X + 18, Y + 34, 8, 8, 'P');                                                   // 목
      if (look === 0) { fr(g, X + 17, Y + 42, 1, 9, 'w'); fr(g, X + 26, Y + 42, 1, 9, 'w'); fr(g, X + 16, Y + 51, 2, 2, 'w'); fr(g, X + 26, Y + 51, 2, 2, 'w'); }
      else if (look === 1) { for (let j = 0; j < 9; j++) fr(g, X + 15 + j, Y + 40 + j, 14 - j * 2, 1, 'w'); fr(g, X + 21, Y + 41, 3, 12, 'r'); fr(g, X + 20, Y + 53, 5, 2, 'r'); }
      else if (look === 2) { fr(g, X + 15, Y + 40, 14, 3, 'w'); fr(g, X + 21, Y + 48, 3, 3, 'y'); }
      else { fr(g, X + 21, Y + 41, 2, 19, shade); OB(g, X + 8, Y + 47, 8, 5, 'y'); }
      // 얼굴
      ell(g, X + 22, Y + 22, 14, 13.5, 'p');
      for (let y = Y + 8; y < Y + 36; y++) for (let x = X + 7; x < X + 37; x++) {
        const dx = (x + 0.5 - X - 22) / 14, dy = (y + 0.5 - Y - 22) / 13.5;
        if (dx * dx + dy * dy > 1) continue;
        const ry = y - Y, rx = x - X;
        if (look === 0 && (ry < 15 || ((rx < 11 || rx > 33) && ry < 22))) fr(g, x, y, 1, 1, 'H');
        else if (look === 1 && (ry < 14 || (rx < 10 && ry < 21) || (rx > 34 && ry < 21) || (rx > 18 && ry < 16))) fr(g, x, y, 1, 1, 'H');
        else if (look === 2 && ry < 13) fr(g, x, y, 1, 1, 'L');
        else if (look === 3 && ry < 16) fr(g, x, y, 1, 1, 'y');
      }
      if (look === 1) fr(g, X + 18, Y + 9, 1, 6, 'p');                                   // 가르마
      if (look === 3) { fr(g, X + 6, Y + 15, 32, 3, 'o'); fr(g, X + 20, Y + 9, 4, 3, 'o'); }   // 모자 챙 · 단추
      fr(g, X + 7, Y + 22, 2, 4, 'p'); fr(g, X + 35, Y + 22, 2, 4, 'p');                   // 귀
      // 눈 · 볼 · 입
      fr(g, X + 15, Y + 22, 2, 3, 'k'); fr(g, X + 27, Y + 22, 2, 3, 'k');
      if (look === 1) { OB(g, X + 12, Y + 20, 8, 7, 'k'); fr(g, X + 13, Y + 21, 6, 5, 'p'); OB(g, X + 24, Y + 20, 8, 7, 'k'); fr(g, X + 25, Y + 21, 6, 5, 'p'); fr(g, X + 20, Y + 22, 4, 1, 'k'); fr(g, X + 15, Y + 22, 2, 3, 'k'); fr(g, X + 27, Y + 22, 2, 3, 'k'); }
      fr(g, X + 12, Y + 27, 3, 2, 'r'); fr(g, X + 29, Y + 27, 3, 2, 'r');
      if (mood === 1) { fr(g, X + 19, Y + 29, 1, 1, 'k'); fr(g, X + 20, Y + 30, 4, 1, 'k'); fr(g, X + 24, Y + 29, 1, 1, 'k'); }
      else if (mood === 2) { fr(g, X + 19, Y + 31, 1, 1, 'k'); fr(g, X + 20, Y + 30, 4, 1, 'k'); fr(g, X + 24, Y + 31, 1, 1, 'k'); fr(g, X + 29, Y + 19, 3, 1, 'k'); fr(g, X + 12, Y + 19, 3, 1, 'k'); }
      else fr(g, X + 20, Y + 30, 4, 1, 'k');
    });
  }
  // 계산대 화면 틀 (64×46, 기준 = 화면 가운데). 칸은 그릴 때 채운다
  function registerSprite() {
    return spr('register', 64, 46, 32, 17, function (g) {
      fr(g, 28, 34, 8, 6, 'E'); fr(g, 28, 34, 2, 6, 'e');
      OB(g, 16, 39, 32, 5, 'L');
      OB(g, 1, 1, 62, 34, 'e'); fr(g, 2, 2, 60, 1, 'L');
      OB(g, 4, 4, 56, 28, 'B');
    }, true);
  }
  // 편의점 안 (한 번 찍어 둔다): 벽 · 창 · 뒤 진열장 · 계산대 · 바닥. cy = 계산대 윗줄
  function storeSprite(cy) {
    return spr('store', LW, LH, 0, 0, function (g) {
      fr(g, 0, 0, LW, cy, 'S'); fr(g, 0, 0, LW, 3, 'w'); fr(g, 0, 3, LW, 1, 'L');
      // 창 (바깥은 낮의 거리)
      OB(g, 6, 8, 36, 50, 'w'); fr(g, 8, 10, 32, 46, 's'); fr(g, 8, 40, 32, 16, 'q');
      fr(g, 12, 24, 10, 26, 'S'); fr(g, 26, 30, 12, 20, 'S'); for (let y = 27; y < 48; y += 4) { fr(g, 14, y, 6, 1, 'q'); fr(g, 28, y + 3, 8, 1, 'q'); }
      ell(g, 16, 52, 8, 5, 'g'); ell(g, 32, 53, 7, 4, 'g'); fr(g, 8, 54, 32, 2, 'G');
      fr(g, 23, 10, 2, 46, 'w'); fr(g, 23, 10, 1, 46, 'L');
      seg(g, 11, 20, 17, 14, 'w', 1); seg(g, 11, 24, 21, 14, 'w', 1);
      // 뒤 진열장 (상표 없는 상품들)
      const prod = ['r', 'y', 'g', 'b', 'o', 'w', 'N', 'l'];
      for (let u = 0; u < 5; u++) {
        const x = 98 + u * 39;
        OB(g, x, 8, 38, cy - 7, 'L'); fr(g, x + 1, 9, 36, 2, 'w');
        for (let r = 0; r < 3; r++) {
          const by = 22 + r * 14;
          fr(g, x + 1, by, 36, 2, 'e'); fr(g, x + 1, by + 2, 36, 1, 'E');
          for (let j = 0; j < 6; j++) { const h = 5 + ((u + r * 2 + j) % 3) * 2, c = prod[(u * 3 + r * 5 + j * 7) % prod.length]; OB(g, x + 2 + j * 6, by - h, 6, h, c); fr(g, x + 3 + j * 6, by - h + 1, 1, 1, 'w'); }
        }
      }
      // 계산대
      fr(g, 0, cy - 1, LW, 1, 'k'); fr(g, 0, cy, LW, 3, 'N'); fr(g, 0, cy, LW, 1, 'd'); fr(g, 0, cy + 3, LW, 1, 'k');
      fr(g, 0, cy + 4, LW, 9, 'n'); for (let x = 30; x < LW; x += 60) fr(g, x, cy + 4, 1, 9, 'H'); fr(g, 0, cy + 13, LW, 1, 'k');
      // 바닥 (바둑판 타일)
      fr(g, 0, cy + 14, LW, LH - cy - 14, 'C');
      for (let y = cy + 14; y < LH; y += 8) for (let x = ((y - cy - 14) >> 3 & 1) * 8; x < LW; x += 16) fr(g, x, y, 8, 8, 'c');
    }, true);
  }

  function makeStore(env) {
    const P = env.P, rng = env.rng, fx = env.fx, seconds = env.seconds, speed = env.speed, font = env.font, rate = env.rate;
    // 만점 기준 개수 (하 · 숙련 0 이 12개 = 손님 네댓 명 분, 강도 · 숙련이 높으면 더). 상한은 강도별 16 · 18 · 20 · 21개(7초 기준) — 가장 빠른 사람이 물건 하나에 0.33초(손님 바뀜 포함)
    const par = Math.max(3, Math.min(Math.floor(seconds / [0.4375, 0.389, 0.35, 0.33][env.intensity] + 1e-6), Math.round(8 * [1.2, 1.4, 1.5, 1.6][env.intensity] * speed * seconds / 7)));
    const TRANS = 0.25, CX = 150, CY = 184, BX0 = 250, BY0 = 32, BH = 128;
    const counts = shuffle([3, 3, 2], rng), customers = [];
    let lastLook = -1;
    for (let c = 0; c < 48; c++) {                                    // 빠른 사람에게는 네 번째 손님부터 계속 온다
      const k = c < 3 ? counts[c] : (rng() < 0.5 ? 2 : 3), items = [];
      for (let i = 0; i < k; i++) { let it = env.pick(4); if (i > 0 && it === items[i - 1]) it = (it + 1 + env.pick(3)) % 4; items.push(it); }
      let look = env.pick(4); if (look === lastLook) look = (look + 1) % 4; lastLook = look;
      customers.push({ items: items, look: look, marks: items.map(function () { return 0; }) });
    }
    // 손님 한 명의 기다려 주는 시간: 처음엔 넉넉(물건 3개 3.9초), 속도가 오를수록 줄어든다. 사람이 누를 수 있는 바닥(0.4 + 0.3 x 개수)은 지킨다.
    const patienceFor = function (k, wt) { return Math.max(0.4 + 0.3 * k, (1.2 + 0.9 * k) / (speed * rate(wt))); };
    const S = { customers: customers, cur: 0, idx: 0, trans: 0, par: par, allow: 0, patience: 0, allows: [], timeouts: 0, hits: 0, wrongs: 0, served: 0, enter: 0, cellPop: [0, 0, 0, 0], cellBad: [0, 0, 0, 0], fly: [], leaving: null, pip: 0 };
    function cur() { return customers[S.cur % customers.length]; }
    function slot(c, i) { return [BX0 + 58 + i * 88, BY0 + 58]; }
    function cell(i) { return [28 + i * 208 + 112, 298]; }
    function nextCustomer(c) {      // 이 손님은 가고 다음 손님이 온다
      S.leaving = { c: c, t: 0, marks: c.marks.slice(), happy: c.marks.every(function (m) { return m === 1; }) };
      S.cur++; S.idx = 0; S.served++; S.trans = TRANS; S.enter = 0; S.allow = 0; S.patience = 0;
      const nx = cur(); for (let i = 0; i < nx.marks.length; i++) nx.marks[i] = 0;
    }
    function drawBubble(g, c, k, alpha, idx) { // 말풍선: 흰 픽셀 틀 + 손님 쪽 꼬리, 지금 찍을 물건은 노란 칸 + 밑줄
      const bx = L(BX0), by = L(BY0), bh = L(BH), bw = L(28 + c.items.length * 88);
      const body = function (lg) {
        SB(lg, bx, by, bw, bh, 'w');
        rows(lg, bx - 9, by + bh - 17, ['......kkkk', '....kkwwww', '..kkwwwwww', 'kkwwwwwwww', '.kkkkwwwww', '.....kkkkk']);
        fr(lg, bx + 1, by + bh - 2, bw - 2, 1, 'L');
        for (let i = 0; i < c.items.length; i++) {
          const p = slot(c, i), m = c.marks[i], now = i === idx, x = L(p[0]), y = L(p[1]);
          if (now) { fr(lg, x - 13, by + 3, 27, bh - 6, 'Y'); fr(lg, x - 9, by + bh - 6, 19, 2, 'o'); }
          if (m) { put(lg, itemSprite(c.items[i]), x, y); veil(lg, x - 13, y - 13, 26, 27, 'w'); }   // 끝난 물건은 흐리게(점무늬)
          else put(lg, itemSprite(c.items[i]), x, y - (now ? Math.round(1 + Math.sin(env.fx.clock * 9)) : 0));
          if (m === 1) vMark(lg, x, y + 1, 6);
          if (m === 2) xMark(lg, x, y, 5);
        }
      };
      if (k >= 0.999 && alpha >= 0.999) { body(g); return; }
      if (k < 0.999) { // 튀어나오기: 꼬리 쪽을 기준으로 작게 → 크게 (가까운 점으로)
        if (!drawBubble.m) drawBubble.m = mkc(LW, LH);
        const m = drawBubble.m, ax = bx - 9, ay = by + bh - 12;
        m[1].clearRect(0, 0, LW, LH); body(m[1]);
        const s = Math.max(0.2, k);
        g.drawImage(m[0], Math.round(ax - ax * s), Math.round(ay - ay * s), Math.round(LW * s), Math.round(LH * s));
        return;
      }
      faded(g, alpha, body);
    }
    return {
      title: '편의점 계산', howto: '말풍선 순서대로 번호 1~4', startY: 258,   // "시작!"은 말풍선 · 손님 아래 (번호 칸 위쪽)
      how: ['손님 말풍선의 물건을 왼쪽부터 차례로, 아래 번호 1~4 로 찍는다', '틀리면 감점 — 마구 누르지 않는다'],
      controls: ITEM_NAMES.map(function (name, i) { return { code: DIGIT_CODES[i], label: name }; }),
      state: S,
      tick: function (dt, wt, playing) {
        S.enter = S.cur === 0 && S.served === 0 ? clamp((wt + 0.45) / 0.3, 0, 1) : Math.min(1, S.enter + dt / TRANS);
        S.trans = Math.max(0, S.trans - dt); S.pip = decay(S.pip, dt, 0.2);
        if (S.leaving) { S.leaving.t += dt / 0.3; if (S.leaving.t >= 1) S.leaving = null; }
        for (let i = 0; i < 4; i++) { S.cellPop[i] = decay(S.cellPop[i], dt, 0.18); S.cellBad[i] = decay(S.cellBad[i], dt, 0.3); }
        age(S.fly, dt, 0.16);
        if (playing && S.trans <= EPS) {               // 손님이 기다리는 시간 (막대가 줄어든다). 다 되면 못 한 물건은 그냥 넘어가고 손님이 간다 (벌점 없음)
          const c = cur();
          if (S.allow === 0) { S.allow = S.patience = patienceFor(c.items.length, wt); S.allows.push({ wt: wt, allow: S.allow, items: c.items.length }); }
          S.patience -= dt;
          if (S.patience <= 0) {
            const q = slot(c, S.idx);
            for (let i = S.idx; i < c.items.length; i++) c.marks[i] = 3;
            S.timeouts++; fx.cross(q[0], q[1], 16); fx.kick(1.5);
            nextCustomer(c);
          }
        }
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
        if (S.idx >= c.items.length) nextCustomer(c);   // 이 손님 끝: 다음 손님
      },
      finish: function () {
        return { score: clamp((S.hits - S.wrongs) / S.par, 0, 1), hits: Math.min(S.hits, S.par), total: S.par,
          detail: '찍은 물건 ' + Math.min(S.hits, S.par) + ' / ' + S.par + (S.wrongs ? ' · 잘못 찍음 ' + S.wrongs + '번' : '') + (S.timeouts ? ' · 그냥 간 손님 ' + S.timeouts + '명' : '') };   // 틀리면 그 물건을 잃고 1개만큼 더 깎인다 (번호 연타 막기)
      },
      draw: function (g, wt) {
        const cy = L(CY);
        g.drawImage(storeSprite(cy), 0, 0);
        // 손님 (나가는 손님은 왼쪽으로, 새 손님은 오른쪽에서) — 계산대 아래는 가린다
        const c = cur(), lv = S.leaving;
        g.save(); g.beginPath(); g.rect(0, 0, LW, cy - 1); g.clip();
        if (lv) put(g, customerSprite(lv.c.look, lv.happy ? 1 : 2), L(CX - 170 * easeOut(lv.t)), cy);   // 반투명 대신 미끄러져 나가고 들어옴
        if (S.enter > 0.05) put(g, customerSprite(c.look, 0), L(CX + 150 * (1 - easeOut(S.enter))), cy);
        g.restore();
        // 계산대 화면: 칸 수 = 만점 기준, 맞힌 만큼 노랗게
        const rx = L(754), ry = L(106), par = S.par, filled = Math.min(S.hits, S.par), cols = Math.ceil(par / 2), pp = bump(S.pip);
        put(g, registerSprite(), rx, ry);
        const x0 = rx - Math.floor((cols * 6 + (cols - 1) * 2) / 2);
        for (let i = 0; i < par; i++) {
          const px = x0 + (i % cols) * 8, py = ry - 9 + Math.floor(i / cols) * 9, on = i < filled, big = on && i === filled - 1 && pp > 0.3 ? 1 : 0;
          OB(g, px - big, py - big, 6 + big * 2, 6 + big * 2, on ? 'y' : 'b', on ? 'k' : 'B');
          if (on) fr(g, px + 1 - big, py + 1 - big, 4 + big * 2, 1, 'Y');
        }
        // 진열대 4칸 (번호 글자는 text 에서)
        for (let i = 0; i < 4; i++) {
          const x = L(28 + i * 208), q = cell(i), k = bump(S.cellPop[i]), bad = S.cellBad[i] > 0;
          fr(g, x + 2, 79, 67, 45, 'd');
          SB(g, x, 76, 67, 45, bad ? 'P' : 'w');
          fr(g, x + 1, 77, 65, 2, bad ? 'r' : 'L');
          if (bad) veil(g, x + 2, 80, 63, 39, 'r');
          if (k > 0.05) { fr(g, x + 1, 77, 65, 2, 'g'); fr(g, x + 1, 117, 65, 2, 'g'); fr(g, x + 1, 77, 2, 42, 'g'); fr(g, x + 64, 77, 2, 42, 'g'); }
          const ix = L(q[0] + (bad ? Math.sin(S.cellBad[i] * 40) * 4 : 0)), iy = L(q[1] - 8 * k);
          ell(g, ix, 111, 10, 2, 'L');
          put(g, itemSprite(i), ix, iy);
          SB(g, x + 4, 81, 13, 13, 'Y');
        }
        // 말풍선
        if (lv && lv.t < 0.55) drawBubble(g, lv.c === c ? { items: c.items, marks: lv.marks } : { items: lv.c.items, marks: lv.marks }, 1, 1, -1);   // 나간 손님 말풍선은 잠깐 남았다가 사라짐
        if (wt >= 0 && S.trans <= 0.1) drawBubble(g, c, pop(1 - S.trans / 0.1), 1, S.idx);
        if (wt >= 0 && S.trans <= EPS && S.allow > 0) {   // 손님이 기다려 주는 시간: 말풍선 밑 막대
          const bw = L(28 + c.items.length * 88), f = clamp(S.patience / S.allow, 0, 1), bx = L(BX0), by = L(BY0 + BH) + 3;
          OB(g, bx, by, bw, 5, 'L');
          if (f > 0) { fr(g, bx + 1, by + 1, Math.max(1, Math.round((bw - 2) * f)), 3, f < 0.3 ? 'r' : 'b'); fr(g, bx + 1, by + 1, Math.max(1, Math.round((bw - 2) * f)), 1, f < 0.3 ? 'P' : 'l'); }
        }
        // 진열대에서 말풍선으로 날아가는 물건
        for (const f of S.fly) { const e = easeOut(f.t); put(g, itemSprite(f.item), L(lerp(f.x0, f.x1, e)), L(lerp(f.y0, f.y1, e) - 30 * Math.sin(e * Math.PI))); }
      },
      text: function (ctx, wt, ox, oy) { // 진열대 번호 (둥근모꼴 32px, 노란 딱지 위)
        ctx.font = '32px ' + font; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = pc('k');
        for (let i = 0; i < 4; i++) {
          const s = String(i + 1), w = ctx.measureText(s).width, bx = (L(28 + i * 208) + 4) * SC + ox, by = 81 * SC + oy;
          ctx.fillText(s, Math.round((bx + (13 * SC - w) / 2) / 2) * 2, by + 4);
        }
      },
    };
  }

  // =====================================================================
  // 4. 배달 — 위에서 본 3차선. 좌우로 차를 피하고 초록 "배달 완료 지점"을 밟는다
  // =====================================================================
  // 내 스쿠터 (위에서 봄, 가운데 기준, 위쪽이 앞). o: { lean -1~1, pop 0~1 }
  // 승용차 (위에서 봄, 20×32, 가운데 기준, 앞이 위). 몸 색 넷: 흰 · 빨강 · 노랑 · 초록
  const CAR_BODY = [['L', 'e'], ['r', 'R'], ['y', 'o'], ['g', 'G']];
  function carSprite(ci) {
    return spr('car' + ci, 21, 33, 10, 16, function (g) {
      const b = CAR_BODY[ci][0], sh = CAR_BODY[ci][1];
      for (const y of [6, 21]) { fr(g, 1, y, 2, 6, 'k'); fr(g, 18, y, 2, 6, 'k'); }   // 바퀴
      fr(g, 4, 1, 13, 31, b); fr(g, 3, 2, 15, 29, b); fr(g, 15, 2, 3, 29, sh);
      fr(g, 1, 10, 2, 2, b); fr(g, 18, 10, 2, 2, b);                                  // 거울
      fr(g, 5, 9, 11, 4, 'S'); fr(g, 6, 8, 9, 1, 'S'); fr(g, 6, 10, 2, 1, 'w');        // 앞유리
      fr(g, 5, 13, 11, 8, b); fr(g, 5, 13, 11, 1, sh); fr(g, 6, 14, 3, 1, 'w');         // 지붕
      fr(g, 5, 21, 11, 3, 'S'); fr(g, 5, 21, 11, 1, sh);                              // 뒷유리
      fr(g, 4, 1, 3, 2, 'Y'); fr(g, 14, 1, 3, 2, 'Y');                                // 전조등
      fr(g, 4, 30, 3, 2, ci === 1 ? 'R' : 'r'); fr(g, 14, 30, 3, 2, ci === 1 ? 'R' : 'r');   // 꼬리등
    });
  }
  // 버스 (위에서 봄, 26×54). 길고 넓은 몸 + 지붕 냉방기
  function busSprite() {
    return spr('bus', 29, 55, 14, 27, function (g) {
      for (const y of [6, 36, 44]) { fr(g, 2, y, 2, 6, 'k'); fr(g, 25, y, 2, 6, 'k'); }
      fr(g, 4, 1, 21, 53, 'b'); fr(g, 22, 1, 3, 53, 'B');
      fr(g, 1, 3, 3, 3, 'b'); fr(g, 25, 3, 3, 3, 'b');                                // 거울
      fr(g, 5, 2, 19, 5, 'S'); fr(g, 6, 3, 3, 1, 'w');                                // 앞유리
      fr(g, 6, 9, 17, 41, 'l'); fr(g, 6, 9, 17, 1, 'B');
      OB(g, 8, 12, 13, 10, 'L'); fr(g, 10, 14, 9, 1, 'e'); fr(g, 10, 17, 9, 1, 'e');   // 냉방기 둘
      OB(g, 8, 36, 13, 10, 'L'); fr(g, 10, 38, 9, 1, 'e'); fr(g, 10, 41, 9, 1, 'e');
      OB(g, 11, 26, 7, 6, 'b');                                                     // 환기구
      fr(g, 5, 52, 4, 2, 'r'); fr(g, 20, 52, 4, 2, 'r');
    });
  }
  // 내 스쿠터 (위에서 봄, 18×30, 앞이 위). lean -1 · 0 · 1, big = 배달통이 튐 (배달 완료 직후)
  function scooterSprite(lean, big) {
    return spr('scoot' + lean + (big ? 'b' : ''), 21, 32, 10, 15, function (g) {
      const X = 1, Y = 1, d = lean;
      fr(g, X + 8, Y, 3, 5, 'k'); fr(g, X + 8, Y + 25, 3, 5, 'k');                    // 바퀴
      fr(g, X + 7, Y + 3, 5, 22, 'w'); fr(g, X + 11, Y + 3, 1, 22, 'L');              // 차체
      fr(g, X + 8, Y + 2, 3, 1, 'Y');                                                // 전조등
      fr(g, X + 2, Y + 6 + (d > 0 ? 1 : 0), 7, 2, 'E'); fr(g, X + 10, Y + 6 + (d < 0 ? 1 : 0), 7, 2, 'E');   // 핸들
      fr(g, X + 1, Y + 5, 2, 2, 'e'); fr(g, X + 16, Y + 5, 2, 2, 'e');                // 거울
      const bw = big ? 14 : 12, bh = big ? 11 : 9;                                   // 배달통
      fr(g, X + 9 - (bw >> 1) + 1, Y + 17, bw, bh, 'o'); fr(g, X + 9 - (bw >> 1) + 1, Y + 17, bw, 3, 'Y'); fr(g, X + 9, Y + 17, 2, bh, 'O');
      fr(g, X + 4 + d, Y + 8, 3, 4, 'l'); fr(g, X + 12 + d, Y + 8, 3, 4, 'l');         // 팔
      fr(g, X + 4 + d, Y + 11, 11, 6, 'l'); fr(g, X + 12 + d, Y + 11, 3, 6, 'b');     // 어깨 (하늘색 후드)
      ell(g, X + 9.5 + d, Y + 11, 4.2, 4.2, 'w'); fr(g, X + 7 + d, Y + 7, 5, 2, 'b'); fr(g, X + 11 + d, Y + 10, 2, 3, 'L');   // 헬멧 · 가리개
    });
  }
  // 배달 완료 지점 (초록 핀, 16×20, 기준 = 뾰족한 끝)
  function pinSprite() {
    return spr('pin', 17, 21, 8, 18, function (g) {
      ell(g, 8.5, 7.5, 6.6, 6.6, 'g');
      for (let j = 0; j < 6; j++) fr(g, 4 + Math.round(j * 0.7), 12 + j, 9 - Math.round(j * 1.4), 1, 'g');
      fr(g, 11, 4, 2, 9, 'G');
      fr(g, 6, 6, 5, 4, 'w'); fr(g, 7, 5, 3, 1, 'w'); fr(g, 8, 4, 1, 1, 'w'); fr(g, 8, 8, 1, 2, 'G');   // 핀 안의 집
    });
  }
  // 길가 (64줄짜리 조각, 위아래로 이어 붙임): 잔디 · 지붕 · 나무
  function blockSprite(side) {
    return spr('block' + side, 92, 64, 0, 0, function (g) {
      fr(g, 0, 0, 92, 64, 'h');
      for (let y = 0; y < 64; y += 2) for (let x = (y >> 1) & 1 ? 1 : 0; x < 92; x += 6) fr(g, x, y, 1, 1, 'g');
      const roofs = side ? [[30, 4, 40, 26, 'o', 'O'], [6, 36, 30, 22, 'b', 'B']] : [[8, 6, 44, 24, 'r', 'R'], [40, 38, 34, 20, 'N', 'n']];
      for (const r of roofs) {
        OB(g, r[0], r[1], r[2], r[3], r[4]); fr(g, r[0] + 1, r[1] + (r[3] >> 1), r[2] - 2, 1, r[5]);
        for (let x = r[0] + 3; x < r[0] + r[2] - 3; x += 4) fr(g, x, r[1] + 2, 1, (r[3] >> 1) - 3, r[5]);
        OB(g, r[0] + r[2] - 11, r[1] + r[3] - 9, 7, 6, 'L');
      }
      const trees = side ? [[14, 14], [78, 44], [52, 56]] : [[70, 14], [20, 48], [84, 56]];
      for (const t of trees) { ell(g, t[0] + 2, t[1] + 2, 6, 5, 'G'); ell(g, t[0], t[1], 6, 6, 'g'); ell(g, t[0] - 2, t[1] - 2, 2.5, 2.5, 'h'); }
      fr(g, side ? 0 : 89, 0, 3, 64, 'C');
    }, true);
  }

  function makeDelivery(env) {
    const P = env.P, rng = env.rng, fx = env.fx, seconds = env.seconds, speed = env.speed;
    const LANE_W = 108, RX0 = W / 2 - LANE_W * 1.5, RX1 = W / 2 + LANE_W * 1.5, SY = 298;
    const PB = 80;                                                          // 초록 지점을 밟는 폭(앞뒤): 스쿠터와 핀 그림이 닿는 거리
    const easy = env.intensity === 0;                                           // 하: 한 줄에 한 차선만 막히고 줄 간격도 조금 넓다. 중부터는 두 차선이 막히는 줄이 섞인다
    const dsp = Math.pow(speed, 0.55) * [1, 1, 0.97, 0.95][env.intensity];   // 판 속도를 다 싣지 않는다(0.55 제곱): 줄 간격이 사람 손(차선 두 번 바꾸기)을 넘지 않게
    const vb = 280 * dsp, gap = 0.62 / dsp * (easy ? 1.15 : 1), T0 = 1.05;   // 길 처음 속도 · 줄 간격 · 첫 줄 (둘 다 '흐른 시간' tau 로 잰다)
    const rowT = function (k) { return T0 + k * gap; };
    // 길은 시작 vb -> 끝 vb x (1 + rEff). 초록 지점이 밟는 폭 안에 강도별 바닥(STAY + 0.02초)은 머물도록 rEff 를 누른다.
    const rEff = Math.max(0, Math.min(env.ramp, 2 * PB / (STAY[env.intensity] + 0.02) / vb - 1));
    const wp = env.warp(rEff);
    let R = 0; while (rowT(R) <= wp.tau(seconds - 0.37)) R++; R = Math.max(3, R);   // 차가 오는 줄 수
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
        if (a === b && (easy || rng() < 0.36)) blocked = [a === 1 ? (rng() < 0.5 ? 0 : 2) : (rng() < 0.8 ? 1 : 2 - a)];
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
        obs.push({ lane: lane, at: rowT(k), bus: isBus, half: isBus ? 75 : 42, color: CAR_COLORS[env.pick(4)], y: -999, hit: false, row: k });
      }
    }
    for (const g of pl.pinGaps) pins.push({ lane: pl.L[g], at: g ? (rowT(g - 1) + rowT(g)) / 2 : rowT(0) - 0.5 * gap, y: -999, got: false, t: 0 });
    const S = { lane: 1, x: laneX(1), lean: 0, inv: 0, crashes: 0, got: 0, total: nPins, obs: obs, pins: pins, safe: pl.L, rowAt: function (k) { return wp.inv(rowT(k)); }, rows: R, rEff: rEff, tries: tries, pop: 0, edge: 0, edgeDir: 0, road: 0 };
    return {
      title: '배달', howto: '좌우로 차를 피하고 초록 지점 밟기',
      how: ['방향키로 차선을 바꿔 차를 피한다', '초록 핀이 있는 차선으로 지나가면 배달 완료 — 부딪히면 감점'],
      controls: [{ code: 'ArrowLeft', label: '왼쪽 차선' }, { code: 'ArrowRight', label: '오른쪽 차선' }],
      state: S,
      tick: function (dt, wt, playing) {
        const u = wp.tau(wt);                                                // 흐른 시간 (점점 빨라짐 반영)
        S.road = u * vb;
        S.x += (laneX(S.lane) - S.x) * Math.min(1, dt * 26);
        S.lean = Math.abs(laneX(S.lane) - S.x) < 2 ? S.lean * 0.7 : S.lean;
        S.inv = Math.max(0, S.inv - dt); S.pop = decay(S.pop, dt, 0.2); S.edge = decay(S.edge, dt, 0.15);
        for (const o of obs) {
          o.y = SY - (o.at - u) * vb;
          if (playing && !o.hit && S.inv <= 0 && o.lane === S.lane && Math.abs(o.y - SY) < o.half + 22) {   // 부딪힘
            o.hit = true; S.crashes++; S.inv = 0.5;
            fx.flash(P.bad, 0.3); fx.kick(3); fx.cross(S.x, SY - 52, 18); fx.burst(S.x, SY - 30, P.bad, 7, 210);
          }
        }
        for (const p of pins) {
          p.y = SY - (p.at - u) * vb;
          if (p.got) p.t += dt / 0.25;
          else if (playing && p.lane === S.lane && Math.abs(p.y - SY) < PB) {                               // 배달 완료
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
        return { score: clamp(0.5 + 0.5 * S.got / S.total - 0.25 * S.crashes, 0, 1), hits: S.got, total: S.total, crashes: S.crashes,
          detail: '배달 ' + S.got + ' / ' + S.total + '건 · 충돌 ' + S.crashes + '번' };
      },
      draw: function (g) {
        const ro = Math.round(S.road / SC), r0 = L(RX0), r1 = L(RX1), lw = L(LANE_W);
        // 길 밖: 잔디 · 지붕 · 나무 (길과 함께 흐름) + 보도
        for (let y = ((ro % 64) + 64) % 64 - 64; y < LH; y += 64) { g.drawImage(blockSprite(0), r0 - 104, y); g.drawImage(blockSprite(1), r1 + 12, y); }
        fr(g, r0 - 12, 0, 10, LH, 'C'); fr(g, r1 + 3, 0, 10, LH, 'C');
        for (let y = ((ro % 8) + 8) % 8 - 8; y < LH; y += 8) { fr(g, r0 - 12, y, 10, 1, 'd'); fr(g, r1 + 3, y, 10, 1, 'd'); }
        fr(g, r0 - 13, 0, 1, LH, 'k'); fr(g, r1 + 13, 0, 1, LH, 'k');
        // 길 · 차선
        fr(g, r0 - 2, 0, r1 - r0 + 5, LH, 'L'); fr(g, r0 - 1, 0, 1, LH, 'k'); fr(g, r1 + 1, 0, 1, LH, 'k');
        fr(g, r0, 0, r1 - r0 + 1, LH, 'e');
        for (let y = ((ro % 27) + 27) % 27 - 27; y < LH; y += 27) { fr(g, r0 + lw - 1, y, 2, 12, 'w'); fr(g, r0 + lw * 2 - 1, y, 2, 12, 'w'); }
        // 배달 완료 지점 · 차
        for (const p of pins) {
          if (p.y < -60 || p.y > H + 60 || p.t >= 1) continue;
          const x = L(laneX(p.lane)), y = L(p.y);
          if (p.got) faded(g, 1 - p.t, function (lg) { put(lg, pinSprite(), x, L(p.y - 30 * p.t), 1 + 0.5 * p.t); });
          else {
            const pu = Math.round(2 * (0.5 + 0.5 * Math.sin(fx.clock * 8)));
            ell(g, x, y + 4, 9 + pu, 3 + (pu >> 1), 'G'); ell(g, x, y + 4, 8 + pu, 2 + (pu >> 1), 'h');
            put(g, pinSprite(), x, y + 4 - pu);
          }
        }
        for (const o of obs) {
          if (o.y < -110 || o.y > H + 110) continue;
          const x = L(laneX(o.lane)), y = L(o.y);
          put(g, o.bus ? busSprite() : carSprite(Math.max(0, CAR_COLORS.indexOf(o.color))), x, y);
          if (o.hit && S.inv > 0.25) dots(g, x - 11, y - L(o.half), 22, L(o.half) * 2, 'r', 0.5);
        }
        // 내 스쿠터 (부딪힌 뒤 0.5초는 깜빡임)
        const lean = S.lean * clamp(Math.abs(laneX(S.lane) - S.x) / 40, 0, 1);
        if (S.inv <= 0 || Math.floor((0.5 - S.inv) * 14) % 2 === 0) put(g, scooterSprite(lean > 0.3 ? 1 : lean < -0.3 ? -1 : 0, bump(S.pop) > 0.4), L(S.x + S.edgeDir * 7 * bump(S.edge)), L(SY));
      },
    };
  }

  // =====================================================================
  // 2026-11-21 "알바 다각화해": 새 일 여섯 — 카페 · 과외 · 대리 · 강연 · 방송 · 자문. 저마다 다른 손놀림
  // =====================================================================
  const DIRS4 = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];   // sticker 의 방향 번호 0 왼쪽 · 1 오른쪽 · 2 위 · 3 아래
  // 주인공 (22×31 후드티, 기준 = 발 가운데)
  function heroSprite(face, armOut) { return spr('hero-' + (face || 'calm') + (armOut ? 1 : 0), 30, 36, 15, 34, function (g) { heroAt(g, 4, 4, face, armOut); }, true); }
  // 기다려 주는 시간 막대 (낮은 해상도). f 0~1
  function waitBar(g, x, y, w, f) {
    OB(g, x, y, w, 5, 'L');
    if (f > 0) { const n = Math.max(1, Math.round((w - 2) * clamp(f, 0, 1))); fr(g, x + 1, y + 1, n, 3, f < 0.3 ? 'r' : 'b'); fr(g, x + 1, y + 1, n, 1, f < 0.3 ? 'P' : 'l'); }
  }
  // 아래쪽 누름 칸 (번호 칸처럼): 가운데 (cx, cy), 눌린 만큼 k, 틀림 bad
  function pad(g, cx, cy, w, h, col, k, bad) {
    const x = Math.round(cx - w / 2), y = Math.round(cy - h / 2) + (k > 0.3 ? 1 : 0);
    fr(g, x + 2, y + 3, w, h, 'd');
    SB(g, x, y, w, h, bad ? 'P' : col);
    fr(g, x + 1, y + 1, w - 2, 2, bad ? 'r' : 'w');
    if (bad) veil(g, x + 2, y + 3, w - 4, h - 5, 'r');
    if (k > 0.05) { fr(g, x + 1, y + 1, w - 2, 2, 'y'); fr(g, x + 1, y + h - 3, w - 2, 2, 'y'); fr(g, x + 1, y + 1, 2, h - 2, 'y'); fr(g, x + w - 3, y + 1, 2, h - 2, 'y'); }
  }

  // ---------------------------------------------------------------------
  // 5. 카페 — Space 로 붓기 시작, 선에 닿을 때 다시 Space 로 멈춘다
  // ---------------------------------------------------------------------
  function cupSprite() { // 유리잔 틀 (38×60, 기준 = 바닥 가운데). 안쪽은 그릴 때 채운다
    return spr('cup', 40, 62, 20, 60, function (g) {
      fr(g, 1, 0, 2, 60, 'L'); fr(g, 37, 0, 2, 60, 'L'); fr(g, 1, 58, 38, 2, 'L'); fr(g, 3, 56, 34, 2, 'S');
      fr(g, 0, 0, 4, 2, 'L'); fr(g, 36, 0, 4, 2, 'L');
    });
  }
  function cafeSprite() { // 배경: 벽 · 메뉴판 · 선반 · 나무 카운터 (294×127)
    return spr('cafe', LW, LH, 0, 0, function (g) {
      fr(g, 0, 0, LW, 93, 'c'); for (let x = 0; x < LW; x += 14) fr(g, x, 0, 1, 93, 'C');
      fr(g, 0, 60, LW, 2, 'C');
      OB(g, 8, 12, 64, 36, 'H'); fr(g, 10, 14, 60, 32, 'E'); for (let i = 0; i < 4; i++) { fr(g, 14, 18 + i * 7, 22 + (i * 7) % 12, 2, 'w'); fr(g, 54, 18 + i * 7, 10, 2, 'y'); }
      OB(g, 214, 34, 72, 4, 'N'); for (let i = 0; i < 5; i++) { OB(g, 220 + i * 13, 22, 9, 12, ['w', 'S', 'w', 'Y', 'w'][i]); fr(g, 222 + i * 13, 25, 5, 2, ['o', 'b', 'r', 'o', 'g'][i]); }
      OB(g, 232, 62, 40, 26, 'e'); fr(g, 234, 64, 36, 6, 'L'); OB(g, 240, 74, 8, 8, 'k'); OB(g, 256, 74, 8, 8, 'k'); fr(g, 242, 76, 4, 4, 'r'); fr(g, 258, 76, 4, 4, 'g');   // 에스프레소 기계
      fr(g, 0, 92, LW, 2, 'k'); fr(g, 0, 94, LW, 33, 'N'); fr(g, 0, 94, LW, 3, 'C'); fr(g, 0, 97, LW, 1, 'n');
      for (let x = 20; x < LW; x += 46) fr(g, x, 98, 1, 29, 'n');
    }, true);
  }
  const CAFE_PEN = 0.5;   // 카페: 빗나간 선 · 넘친 잔 하나의 감점 (선 반 개)
  function makeCafe(env) {
    const P = env.P, rng = env.rng, fx = env.fx, seconds = env.seconds, speed = env.speed, rate = env.rate, n = env.intensity;
    const TOL = [0.11, 0.07, 0.066, 0.055][n], HALF = 1.6 * TOL, CAPV = 2 * TOL / STAY[n], TWO = n >= 2;   // 판정 반폭(잔 높이 대비) · 아까운 자리 · 붓는 속도 상한(판정 자리를 STAY 초는 지나가게) · 상부터는 선이 둘(두 번에 나눠 붓는다)
    const TRANS = 0.34, WAIT = 1.6, CX = 441, BY = 270, CH = 168;          // 잔이 바뀌는 시간 · 안 누르고 버틸 수 있는 시간 · 잔 가운데 · 바닥 · 높이(논리)
    const vAt = function (wt) { return softCap(0.62 * speed * rate(wt), CAPV, 0.85); };
    const cups = [];
    let last = -1;
    for (let i = 0; i < 40; i++) {                 // 선의 높이: 하는 세 가지, 중은 아무 높이나(앞 잔과 다르게), 상부터는 아래 · 위 두 줄
      let t = n === 0 ? [0.55, 0.72, 0.88][env.pick(3)] : 0.42 + 0.5 * rng();
      if (Math.abs(t - last) < 0.12) t = t > 0.67 ? t - 0.2 : t + 0.2;
      last = t;
      cups.push({ targets: TWO ? [0.24 + 0.2 * rng(), 0.64 + 0.28 * rng()] : [t], res: [] });
    }
    let par = 0;
    for (let t = 0.3, i = 0; i < cups.length && t <= seconds; i++) {   // 만점 기준: 손이 빠른 사람이 맞출 수 있는 선의 수
      let lv = 0;
      for (const tg of cups[i].targets) { t += 0.14 + (tg - lv) / vAt(t); lv = tg; if (t <= seconds - 0.05) par++; }
      t += TRANS;
    }
    par = Math.max(3, par);
    const S = { cups: cups, cur: 0, step: 0, level: 0, st: 'idle', v: vAt(0), trans: 0, wait: WAIT, sum: 0, par: par, tol: TOL, perfects: 0, halves: 0, misses: 0, spills: 0, done: 0, glow: 0, bad: 0, leaving: null };
    function next() {
      const c = cups[S.cur % cups.length];
      S.leaving = { c: { targets: c.targets, res: c.res.slice() }, level: S.level, t: 0 };
      S.done++; S.cur++; S.step = 0; S.level = 0; S.st = 'idle'; S.trans = TRANS; S.wait = WAIT;
      cups[S.cur % cups.length].res = [];
    }
    function yOf(f) { return BY - CH * f; }
    // 지금까지 번 몫(선 단위): 아까운 선은 딱 맞춘 선이 모자란 자리만 반씩 채운다(빨리 대충 여러 번으로는 완벽이 안 된다) · 빗나간 선 · 넘친 잔은 감점. 점수와 진행 네모가 같은 식을 쓴다
    function units() { const got = Math.min(S.perfects, S.par); return Math.max(0, got + 0.5 * Math.min(S.halves, S.par - got) - CAFE_PEN * (S.misses + S.spills)); }
    return {
      title: '카페 음료', howto: '선에 닿을 때 멈춘다 (Space 로 붓고 · 멈추고)',
      how: ['Space 로 붓기 시작, 주황 선에 닿을 때 다시 Space 로 멈춘다' + (TWO ? ' — 선이 둘이면 한 번 더' : ''), '선에서 멀수록 감점 — 넘치면 그 잔은 버린다'],
      controls: [{ code: 'Space', label: '붓기 · 멈추기' }],
      state: S,
      tick: function (dt, wt, playing) {
        S.v = vAt(Math.max(0, wt)); S.trans = Math.max(0, S.trans - dt); S.glow = decay(S.glow, dt, 0.35); S.bad = decay(S.bad, dt, 0.35);
        if (S.leaving) { S.leaving.t += dt / TRANS; if (S.leaving.t >= 1) S.leaving = null; }
        if (!playing || S.trans > EPS) return;
        const c = cups[S.cur % cups.length];
        if (S.st === 'pour') {
          S.level += S.v * dt;
          if (S.level >= 1.04) { S.spills++; S.bad = 1; while (c.res.length < c.targets.length) c.res.push(3); fx.cross(CX, yOf(1) - 20, 16); fx.kick(3); fx.flash(P.bad, 0.16); fx.float(CX + 96, yOf(1), '넘침', P.bad); next(); }
        } else if ((S.wait -= dt) <= 0) { S.bad = 1; while (c.res.length < c.targets.length) c.res.push(3); fx.cross(CX, yOf(0.5), 14); next(); }   // 안 붓고 버티면 손님이 그냥 간다
      },
      press: function (code) {
        if (code !== 'Space' || S.trans > EPS) return;
        const c = cups[S.cur % cups.length];
        if (S.st === 'idle') { S.st = 'pour'; return; }
        const tg = c.targets[S.step], d = Math.abs(S.level - tg), ty = yOf(tg);
        if (d <= TOL + EPS) { S.perfects++; S.sum += 1; c.res.push(1); S.glow = 1; fx.ring(CX, ty, P.gold, 20, 70); fx.burst(CX, ty, P.gold, 6, 150); fx.float(CX + 96, ty, '딱!', P.gold); }
        else if (d <= HALF + EPS) { S.halves++; S.sum += 0.5; c.res.push(2); S.glow = 0.6; fx.float(CX + 96, ty, S.level < tg ? '모자람' : '넘겼다', P.text); }
        else { S.misses++; c.res.push(3); S.bad = 1; fx.cross(CX, yOf(S.level), 14); fx.kick(1.5); fx.float(CX + 96, ty, S.level < tg ? '한참 모자람' : '너무 많이', P.bad); }
        if (++S.step >= c.targets.length) next(); else { S.st = 'idle'; S.wait = WAIT; }
      },
      finish: function () {
        const got = Math.min(S.perfects, S.par), flaws = S.misses + S.spills;
        return { score: env.flawed(clamp(units() / S.par, 0, 1), flaws), hits: got, total: S.par,
          detail: '딱 맞춘 선 ' + got + ' / ' + S.par + (S.halves ? ' · 아까운 선 ' + S.halves : '') + (S.misses ? ' · 빗나간 선 ' + S.misses : '') + (S.spills ? ' · 넘친 잔 ' + S.spills : '') };
      },
      draw: function (g, wt) {
        g.drawImage(cafeSprite(), 0, 0);
        put(g, heroSprite(S.st === 'pour' ? 'open' : 'calm', S.st === 'pour'), 78, 92);
        fr(g, 0, 92, LW, 2, 'k'); fr(g, 0, 94, 120, 3, 'C');
        // 만점 기준 칸: 맞힌 만큼 노랗게 (반 칸은 옅게)
        const u = S.misses + S.spills > 0 ? Math.min(units(), S.par - 0.5) : units();   // 흠이 있으면 마지막 네모는 다 차지 않는다 (완벽이 아님을 하는 중에도 보이게)
        for (let i = 0; i < S.par; i++) { const on = i < Math.floor(u), half = !on && i < u; OB(g, 12 + (i % 8) * 9, 52 + Math.floor(i / 8) * 9, 7, 7, on ? 'y' : half ? 'Y' : 'b', on || half ? 'k' : 'B'); }
        const one = function (g, x, c, level, step, pouring) {   // 잔 하나 (g = 그릴 판: 나가는 잔은 점무늬 층에)
          const bx = Math.round(x), by = L(BY), h = L(CH), tol = Math.max(1, Math.round(h * S.tol));
          fr(g, bx - 17, by - h, 34, h, 'S');
          for (let i = 0; i < c.targets.length; i++) if (i >= step) { const ty = by - Math.round(h * c.targets[i]); fr(g, bx - 17, ty - tol, 34, tol * 2, i === step ? 'Y' : 'q'); }   // 맞는 자리 (선 위아래) — 지금 맞출 선만 노랗게
          const lv = Math.round(h * Math.min(level, 1.03));
          if (lv > 0) { fr(g, bx - 17, by - lv, 34, lv, 'n'); fr(g, bx - 17, by - lv, 34, 2, 'N'); fr(g, bx - 15, by - lv + 3, 2, Math.max(0, lv - 5), 'N'); }
          for (let i = 0; i < c.targets.length; i++) {
            const ty = by - Math.round(h * c.targets[i]), now = i === step, col = now ? 'o' : 'E', r = c.res[i];
            for (let xx = -17; xx < 17; xx += 4) fr(g, bx + xx, ty, 2, 1, col);                           // 선
            fr(g, bx - 24, ty - 1, 5, 3, col); fr(g, bx - 26, ty, 2, 1, col); fr(g, bx + 19, ty - 1, 5, 3, col); fr(g, bx + 24, ty, 2, 1, col);
            if (r === 1) vMark(g, bx + 33, ty, 4); else if (r === 3) xMark(g, bx + 33, ty, 3); else if (r === 2) fr(g, bx + 29, ty - 1, 8, 3, 'y');
          }
          put(g, cupSprite(), bx, by);
          if (pouring) { fr(g, bx - 1, 33, 3, by - lv - 33, 'n'); fr(g, bx - 1, 33, 1, by - lv - 33, 'N'); }
        };
        OB(g, 134, 20, 26, 10, 'e'); fr(g, 136, 22, 22, 3, 'L'); OB(g, 143, 28, 8, 5, 'E');               // 붓는 꼭지
        const c = cups[S.cur % cups.length], lv = S.leaving, k = S.trans > EPS ? 1 - S.trans / TRANS : 1;
        if (lv) faded(g, 1 - lv.t, function (lg) { one(lg, L(CX) - 50 * easeOut(lv.t), lv.c, lv.level, 9, false); });   // 나가는 잔: 조금 밀리며 점무늬로 사라진다
        if (wt >= -0.3) one(g, L(CX) + 150 * (1 - easeOut(k)), c, S.level, S.step, S.st === 'pour' && S.trans <= EPS);
        if (S.st === 'idle' && S.trans <= EPS && wt >= 0) waitBar(g, L(CX) - 20, L(BY) + 5, 40, S.wait / WAIT);
        for (let i = 1; i <= 2; i++) { const q = cups[(S.cur + i) % cups.length], x = 196 + i * 22; OB(g, x, 66, 14, 22, 'S', 'L'); for (const tg of q.targets) fr(g, x + 1, 87 - Math.round(20 * tg), 12, 1, 'o'); }   // 다음 잔 둘
      },
    };
  }

  // ---------------------------------------------------------------------
  // 6. 과외 — 답안지의 셈이 맞으면 ←(맞다), 틀리면 →(틀리다)
  // ---------------------------------------------------------------------
  function deskSprite() { // 배경: 방 벽 · 책장 · 책상 (294×127)
    return spr('desk', LW, LH, 0, 0, function (g) {
      fr(g, 0, 0, LW, 84, 'S'); fr(g, 0, 60, LW, 1, 'q');
      OB(g, 6, 8, 46, 50, 'N'); for (let r = 0; r < 3; r++) { fr(g, 8, 23 + r * 16, 42, 2, 'n'); for (let i = 0; i < 7; i++) fr(g, 10 + i * 6, 11 + r * 16, 4, 12, ['r', 'b', 'g', 'y', 'o', 'l', 'R'][(i + r * 3) % 7]); }
      OB(g, 236, 10, 50, 34, 'w'); fr(g, 238, 12, 46, 30, 'G'); fr(g, 242, 18, 26, 1, 'w'); fr(g, 242, 24, 34, 1, 'w'); fr(g, 242, 30, 18, 1, 'w');   // 칠판
      fr(g, 0, 83, LW, 2, 'k'); fr(g, 0, 85, LW, 42, 'N'); fr(g, 0, 85, LW, 3, 'C'); for (let x = 30; x < LW; x += 52) fr(g, x, 89, 1, 38, 'n');
    }, true);
  }
  function genSum(rng, n) { // 강도에 따라 어려워지는 셈. { text, ok, think(따져 보는 데 드는 시간) }
    const pick = function (k) { return Math.min(k - 1, Math.floor(rng() * k)); };
    const kind = n === 0 ? pick(2) : n === 1 ? pick(3) : n === 2 ? 1 + pick(3) : 2 + pick(3);
    let a, b, op, val;
    if (kind === 0) { a = 2 + pick(8); b = 2 + pick(8); op = '+'; val = a + b; }
    else if (kind === 1) { a = 11 + pick(40); b = 2 + pick(8); if (rng() < 0.5) { op = '+'; val = a + b; } else { op = '−'; val = a - b; } }
    else if (kind === 2) { a = 2 + pick(8); b = 2 + pick(8); op = '×'; val = a * b; }
    else if (kind === 3) { a = 12 + pick(60); b = 11 + pick(30); if (rng() < 0.5) { op = '+'; val = a + b; } else { if (b > a) { const t = a; a = b; b = t; } op = '−'; val = a - b; } }
    else { a = 11 + pick(20); b = 3 + pick(6); op = '×'; val = a * b; }
    const ok = rng() < 0.5; let shown = val;
    if (!ok) { shown = val + [1, -1, 2, -2, 10, -10][pick(6)]; if (shown < 0 || shown === val) shown = val + 1; }
    return { text: a + ' ' + op + ' ' + b + ' = ' + shown, ok: ok, think: [0.2, 0.34, 0.3, 0.55, 0.75][kind], mark: 0 };
  }
  function makeTutor(env) {
    const P = env.P, rng = env.rng, fx = env.fx, seconds = env.seconds, font = env.font, rate = env.rate, n = env.intensity, lf = env.lf;
    const lfs = 1 + (lf - 1) * 0.5;                                                                      // 셈은 숙련이 올라도 그만큼 빨라지지 않는다 (절반만)
    const par = Math.max(3, Math.min([8, 10, 11, 11][n], Math.round([6.4, 8.6, 9.0, 9.0][n] * lfs * seconds / 7)));
    const TRANS = 0.2, items = [];
    for (let i = 0; i < 40; i++) items.push(genSum(rng, n));
    const allowFor = function (wt) { return Math.max(1.0, [2.2, 1.9, 1.8, 1.8][n] / (lfs * rate(wt))); };
    const S = { items: items, cur: 0, trans: 0, allow: 0, patience: 0, par: par, hits: 0, wrongs: 0, timeouts: 0, padPop: [0, 0], padBad: [0, 0], leaving: null, pip: 0 };
    function next(mark) { const it = items[S.cur % items.length]; it.mark = mark; S.leaving = { it: it, mark: mark, t: 0 }; S.cur++; S.trans = TRANS; S.allow = 0; S.patience = 0; }
    return {
      title: '과외 채점', howto: '맞으면 ← 틀리면 →', startY: 300,
      how: ['답안지의 셈이 맞으면 ←(맞다), 틀리면 →(틀리다)', '잘못 채점하면 감점 — 찍지 않는다'],
      controls: [{ code: 'ArrowLeft', label: '맞다' }, { code: 'ArrowRight', label: '틀리다' }],
      state: S,
      tick: function (dt, wt, playing) {
        S.trans = Math.max(0, S.trans - dt); S.pip = decay(S.pip, dt, 0.2);
        for (let i = 0; i < 2; i++) { S.padPop[i] = decay(S.padPop[i], dt, 0.18); S.padBad[i] = decay(S.padBad[i], dt, 0.3); }
        if (S.leaving) { S.leaving.t += dt / 0.3; if (S.leaving.t >= 1) S.leaving = null; }
        if (!playing || S.trans > EPS) return;
        if (S.allow === 0) S.allow = S.patience = allowFor(wt);
        if ((S.patience -= dt) <= 0) { S.timeouts++; fx.cross(440, 150, 16); fx.kick(1.5); next(3); }   // 못 본 답안지는 그냥 넘어간다 (벌점 없음)
      },
      press: function (code) {
        const k = code === 'ArrowLeft' ? 0 : code === 'ArrowRight' ? 1 : -1;
        if (k < 0 || S.trans > EPS) return;
        const it = items[S.cur % items.length], right = (k === 0) === it.ok, px = k === 0 ? 150 : 730;
        if (right) { S.hits++; S.padPop[k] = 1; S.pip = 1; fx.ring(px, 318, P.good, 26, 70); fx.burst(440, 150, P.gold, 5, 130); fx.float(px, 270, '+1', P.gold); next(1); }
        else { S.wrongs++; S.padBad[k] = 1; fx.cross(px, 318, 22); fx.kick(3); fx.flash(P.bad, 0.16); next(2); }
      },
      finish: function () {
        return { score: env.flawed(clamp((Math.min(S.hits, S.par) - S.wrongs) / S.par, 0, 1), S.wrongs), hits: Math.min(S.hits, S.par), total: S.par,   // 틀린 것은 더 많이 해도 메워지지 않는다 (완벽은 흠 없이)
          detail: '맞게 채점 ' + Math.min(S.hits, S.par) + ' / ' + S.par + (S.wrongs ? ' · 잘못 채점 ' + S.wrongs + '번' : '') + (S.timeouts ? ' · 못 본 답안지 ' + S.timeouts + '장' : '') };
      },
      draw: function (g, wt) {
        g.drawImage(deskSprite(), 0, 0);
        put(g, heroSprite('open', false), 34, 84); put(g, customerSprite(0, S.padBad[0] + S.padBad[1] > 0 ? 2 : 0), 262, 84);
        fr(g, 0, 83, LW, 2, 'k');
        for (let i = 0; i < S.par; i++) { const on = i < Math.min(S.hits, S.par); OB(g, 62 + i * 9, 12, 7, 7, on ? 'y' : 'b', on ? 'k' : 'B'); }
        const sheet = function (y, mark) {
          fr(g, 92, y + 3, 114, 46, 'd'); SB(g, 90, y, 114, 46, 'w'); fr(g, 91, y + 1, 112, 6, 'S'); fr(g, 96, y + 3, 30, 2, 'l');
          for (let i = 0; i < 3; i++) fr(g, 96, y + 36 + i * 3, 102 - i * 20, 1, 'L');
          if (mark === 1) vMark(g, 188, y + 24, 8); else if (mark === 2) xMark(g, 188, y + 24, 7); else if (mark === 3) { fr(g, 180, y + 23, 16, 3, 'e'); }
        };
        const lv = S.leaving, k = S.trans > EPS ? 1 - S.trans / TRANS : 1;
        S.sheetY = wt >= -0.3 ? 30 + Math.round(60 * (1 - easeOut(k))) : 200; S.leaveY = lv ? 30 - Math.round(90 * easeOut(lv.t)) : -200;
        if (lv) sheet(S.leaveY, lv.mark);
        if (wt >= -0.3) sheet(S.sheetY, 0);
        if (wt >= 0 && S.trans <= EPS && S.allow > 0) waitBar(g, 107, 79, 80, S.patience / S.allow);
        // 아래 두 칸: 맞다(동그라미) · 틀리다(가위표)
        pad(g, 50, 106, 76, 32, 'h', bump(S.padPop[0]), S.padBad[0] > 0); ring(g, 36, 106, 9, 'k', 4); ring(g, 36, 106, 8, 'r', 2); sticker(g, 70, 106, 17, 0);
        pad(g, 243, 106, 76, 32, 'P', bump(S.padPop[1]), S.padBad[1] > 0); xMark(g, 229, 106, 7); sticker(g, 263, 106, 17, 1);
      },
      text: function (ctx, wt, ox, oy) { // 답안지의 셈 (둥근모꼴 32px)
        const lv = S.leaving, put1 = function (it, y) { if (y < -60 || y > 130) return; ctx.font = '32px ' + font; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = pc('k'); const w = ctx.measureText(it.text).width; ctx.fillText(it.text, Math.round((147 * SC - w / 2 + ox) / 2) * 2, (y + 13) * SC + oy); };
        if (lv) put1(lv.it, S.leaveY);
        if (wt >= -0.3) put1(items[S.cur % items.length], S.sheetY);
      },
    };
  }

  // ---------------------------------------------------------------------
  // 7. 대리 — 손님이 불러 준 길(화살표 줄)을 잠깐 보고 외워서, 갈림길마다 차례로 누른다
  // ---------------------------------------------------------------------
  function nightSprite() { // 배경: 밤거리 (294×127)
    return spr('night', LW, LH, 0, 0, function (g) {
      fr(g, 0, 0, LW, 96, 'B'); for (let i = 0; i < 26; i++) fr(g, (i * 53) % LW, (i * 29) % 40, 1, 1, i % 3 ? 'l' : 'w');
      for (let i = 0; i < 9; i++) { const x = i * 34 - 6, h = 30 + (i * 17) % 34; fr(g, x, 96 - h, 30, h, 'k'); for (let y = 96 - h + 4; y < 92; y += 7) for (let xx = x + 4; xx < x + 26; xx += 7) fr(g, xx, y, 3, 4, (xx + y + i) % 3 ? 'E' : 'y'); }
      fr(g, 0, 96, LW, 31, 'E'); fr(g, 0, 96, LW, 2, 'k'); fr(g, 0, 98, LW, 1, 'e');
      for (let x = 6; x < LW; x += 22) fr(g, x, 111, 12, 2, 'Y');
    }, true);
  }
  function sedanSprite() { // 손님 차 (옆모습, 오른쪽 보기, 46×20, 기준 = 바퀴 아래 가운데)
    return spr('sedan', 48, 22, 24, 20, function (g) {
      rows(g, 1, 1, [
        '............kkkkkkkkkkkkkkkk..................',
        '..........kkSSSSSSkwwwwwwwwkk................',
        '.........kSSSSSSSSkwwwwwwwwwwkk..............',
        '........kSSSSSSSSSkwwwwwwwwwwwwk.............',
        '...kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk....',
        '..kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwkk..',
        '.kwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwyk.',
        '.kLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLLyk.',
        '.krLLLLLkkkkkLLLLLLLLLLLLLLLLLLkkkkkLLLLLLLLk.',
        '..kkkkkkkEEEkkkkkkkkkkkkkkkkkkkkEEEkkkkkkkkk..',
        '.........kEEEk..................kEEEk.........',
        '..........kkk....................kkk..........',
      ]);
    }, true);
  }
  function makeDriver(env) {
    const P = env.P, rng = env.rng, fx = env.fx, seconds = env.seconds, n = env.intensity, lf = env.lf;
    const K = [3, 4, 5, 6][n], R = 2, total = R * K, GAP = 0.25, budget = (seconds - 0.2) / R;
    const SHOW = Math.max(0.55 + 0.07 * K, [1.0, 1.1, 1.15, 1.2][n] / lf), INPUT = budget - SHOW - GAP;   // 길을 보여 주는 시간 · 누를 수 있는 시간
    const rounds = [];
    for (let r = 0; r < R; r++) { const seq = []; for (let i = 0; i < K; i++) { let d = env.pick(3); if (i > 1 && d === seq[i - 1] && d === seq[i - 2]) d = (d + 1) % 3; seq.push(d); } rounds.push({ seq: seq, marks: seq.map(function () { return 0; }) }); }
    const S = { rounds: rounds, r: 0, ph: 'show', t: SHOW, idx: 0, K: K, total: total, hits: 0, wrongs: 0, timeouts: 0, showFor: SHOW, inputFor: INPUT, carX: 60, jolt: 0, padPop: [0, 0, 0], padBad: [0, 0, 0], fin: false };
    const ORDER = [0, 2, 1];   // 조작 칸의 왼쪽부터: 왼쪽 · 직진(위) · 오른쪽
    function endRound() { S.ph = 'gap'; S.t = GAP; }
    return {
      title: '대리운전', howto: '길을 외워 차례로 ← ↑ →', startY: 300,
      how: ['손님이 불러 준 길(화살표)을 잠깐 보여 준다 — 외운다', '가려지면 왼쪽부터 차례로 ← ↑ → 를 누른다. 틀리면 감점'],
      controls: [{ code: 'ArrowLeft', label: '왼쪽' }, { code: 'ArrowUp', label: '직진' }, { code: 'ArrowRight', label: '오른쪽' }],
      state: S,
      tick: function (dt, wt, playing) {
        S.jolt = decay(S.jolt, dt, 0.3);
        for (let i = 0; i < 3; i++) { S.padPop[i] = decay(S.padPop[i], dt, 0.18); S.padBad[i] = decay(S.padBad[i], dt, 0.3); }
        const want = 60 + (S.r * K + (S.ph === 'show' ? 0 : S.idx)) * (760 / total); S.carX += (want - S.carX) * Math.min(1, dt * 7);
        if (!playing || S.fin) return;
        S.t -= dt;
        if (S.ph === 'show' && S.t <= 0) { S.ph = 'input'; S.t = INPUT; S.idx = 0; }
        else if (S.ph === 'input' && S.t <= 0) { const rd = rounds[S.r]; for (let i = S.idx; i < K; i++) { rd.marks[i] = 3; S.timeouts++; } S.idx = K; fx.kick(1.5); endRound(); }
        else if (S.ph === 'gap' && S.t <= 0) { if (S.r + 1 < R) { S.r++; S.ph = 'show'; S.t = SHOW; S.idx = 0; } else S.fin = true; }
      },
      press: function (code) {
        const d = DIRS4.indexOf(code);
        if (d < 0 || d > 2 || S.ph !== 'input' || S.fin) return;        // 보여 주는 동안 · 바뀌는 동안은 받지 않는다 (벌점 없음)
        const rd = rounds[S.r], slot = ORDER.indexOf(d), x = 147 + (slot - 1) * 250;
        if (d === rd.seq[S.idx]) { S.hits++; rd.marks[S.idx] = 1; S.padPop[slot] = 1; fx.ring(x, 330, P.good, 24, 64); fx.float(S.carX + 40, 250, '+1', P.gold); }
        else { S.wrongs++; rd.marks[S.idx] = 2; S.padBad[slot] = 1; S.jolt = 1; fx.cross(x, 330, 20); fx.kick(3); fx.flash(P.bad, 0.16); }
        S.idx++;
        if (S.idx >= K) endRound();
      },
      finish: function () {
        return { score: env.flawed(clamp((S.hits - S.wrongs) / S.total, 0, 1), S.wrongs), hits: S.hits, total: S.total,   // 잘못 든 길은 한 칸을 통째로 깎는다: 아무 키나 누르면(셋 중 하나가 맞음) "보통"이 50판에 한 번꼴 — 감점이 0.5 · 0.75 면 하 강도에서 열에 한 번 나왔다 (길이 여섯 칸뿐이라)
          detail: '맞게 간 길 ' + S.hits + ' / ' + S.total + (S.wrongs ? ' · 잘못 든 길 ' + S.wrongs + '번' : '') + (S.timeouts ? ' · 못 누른 길 ' + S.timeouts + '번' : '') };
      },
      draw: function (g, wt) {
        g.drawImage(nightSprite(), 0, 0);
        const rd = rounds[S.r], show = S.ph === 'show' && wt >= 0, w = K * 22 + 14, x0 = Math.round(147 - w / 2);
        // 내비 화면: 길 순서 (보여 줄 때는 화살표, 가려진 뒤에는 누른 것만)
        fr(g, x0 + 2, 15, w, 34, 'k'); SB(g, x0, 12, w, 34, 'E'); fr(g, x0 + 2, 14, w - 4, 30, 'B'); fr(g, x0 + 2, 14, w - 4, 1, 'l');
        for (let i = 0; i < K; i++) {
          const cx = x0 + 18 + i * 22, m = rd.marks[i], now = S.ph === 'input' && i === S.idx;
          if (now) { fr(g, cx - 10, 17, 21, 24, 'b'); fr(g, cx - 8, 39, 17, 2, 'y'); }
          if (show || m === 1 || m === 2) sticker(g, cx, 28, 17, rd.seq[i]); else { SB(g, cx - 8, 20, 17, 17, 'e'); fr(g, cx - 2, 24, 5, 2, 'w'); fr(g, cx + 1, 26, 2, 3, 'w'); fr(g, cx - 1, 29, 2, 2, 'w'); fr(g, cx - 1, 33, 2, 2, 'w'); }
          if (m === 1) vMark(g, cx + 5, 39, 4); else if (m === 2) xMark(g, cx + 5, 39, 3); else if (m === 3) fr(g, cx - 4, 40, 9, 2, 'r');
        }
        if (wt >= 0 && !S.fin && S.ph !== 'gap') waitBar(g, x0, 49, w, S.t / (show ? SHOW : INPUT));
        // 길: 갈림길 표시와 손님 차
        for (let i = 0; i <= S.total; i++) { const x = L(60 + i * (760 / S.total)); fr(g, x, 99, 1, 6, i <= S.r * K + (S.ph === 'show' ? 0 : S.idx) ? 'g' : 'L'); }
        const cx = L(S.carX), jy = S.jolt > 0 ? Math.round(Math.sin(S.jolt * 30) * 2) : 0;
        ell(g, cx, 109, 20, 2, 'k'); put(g, sedanSprite(), cx, 109 + jy);
        if (S.jolt <= 0.05) { fr(g, cx - 8, 82, 5, 1, 'w'); fr(g, cx - 5, 83, 2, 1, 'w'); fr(g, cx - 8, 85, 5, 1, 'w'); fr(g, cx - 13, 87, 3, 1, 'w'); fr(g, cx - 13, 89, 3, 1, 'w'); }   // 뒷자리 손님은 잔다 (Zz)
        // 아래 세 칸: 왼쪽 · 직진 · 오른쪽
        for (let i = 0; i < 3; i++) { const px = 64 + i * 83; pad(g, px, 119, 60, 14, show || S.ph === 'gap' ? 'L' : 'w', bump(S.padPop[i]), S.padBad[i] > 0); sticker(g, px, 118, 11, ORDER[i]); }
      },
    };
  }

  // ---------------------------------------------------------------------
  // 8. 강연 — 큐카드의 화살표를 왼쪽부터 차례로, 빨리
  // ---------------------------------------------------------------------
  function hallSprite() { // 배경: 강연장 무대 · 막 · 연단 (294×127)
    return spr('hall', LW, LH, 0, 0, function (g) {
      fr(g, 0, 0, LW, 92, 'C'); fr(g, 0, 0, LW, 12, 'R'); for (let x = 0; x < LW; x += 12) { fr(g, x, 0, 6, 14, 'r'); fr(g, x + 5, 0, 1, 14, 'R'); }
      fr(g, 0, 14, LW, 1, 'k'); for (let x = 0; x < 30; x += 6) { fr(g, x, 15, 3, 70, 'r'); fr(g, LW - 3 - x, 15, 3, 70, 'r'); } fr(g, 30, 15, 1, 70, 'k'); fr(g, LW - 31, 15, 1, 70, 'k');
      fr(g, 0, 86, LW, 2, 'k'); fr(g, 0, 88, LW, 39, 'N'); fr(g, 0, 88, LW, 2, 'C'); for (let x = 16; x < LW; x += 40) fr(g, x, 91, 1, 36, 'n');
      OB(g, 54, 64, 30, 26, 'n'); fr(g, 56, 66, 26, 3, 'N'); OB(g, 62, 72, 14, 10, 'y'); fr(g, 68, 56, 2, 9, 'k'); OB(g, 66, 52, 6, 5, 'E');   // 연단 · 마이크
    }, true);
  }
  function makeLecture(env) {
    const P = env.P, rng = env.rng, fx = env.fx, seconds = env.seconds, n = env.intensity, lf = env.lf;
    const K = [4, 5, 5, 6][n], ND = n >= 2 ? 4 : 3, TRANS = 0.18, LOCK = 0.22;                          // 카드의 화살표 수 · 방향 가짓수(상부터 아래 방향이 섞인다)
    const par = Math.max(4, Math.min([22, 29, 33, 37][n], Math.round([18, 25, 29, 33][n] * (1 + (lf - 1) * 0.6) * seconds / 7)));
    const cards = [];
    for (let c = 0; c < 30; c++) { const a = []; for (let i = 0; i < K; i++) { let d = env.pick(ND); if (i > 0 && d === a[i - 1] && rng() < 0.7) d = (d + 1 + env.pick(ND - 1)) % ND; a.push(d); } cards.push({ seq: a, marks: a.map(function () { return 0; }) }); }
    const ORDER = ND === 4 ? [0, 2, 3, 1] : [0, 2, 1];                                                   // 조작 칸의 왼쪽부터: ← ↑ (↓) →
    const S = { cards: cards, c: 0, i: 0, K: K, par: par, trans: 0, lock: 0, hits: 0, wrongs: 0, done: 0, clap: 0, padPop: [0, 0, 0, 0], padBad: [0, 0, 0, 0], leaving: null, order: ORDER };
    return {
      title: '강연', howto: '큐카드의 화살표를 차례로, 빨리', startY: 250,
      how: ['큐카드의 화살표를 왼쪽부터 차례로 누른다 — 빠를수록 많이 넘긴다', '틀리면 감점이고 잠깐 말이 막힌다'],
      controls: ORDER.map(function (d) { return { code: DIRS4[d], label: ['왼쪽', '오른쪽', '위', '아래'][d] }; }),
      state: S,
      tick: function (dt) {
        S.trans = Math.max(0, S.trans - dt); S.lock = Math.max(0, S.lock - dt); S.clap = decay(S.clap, dt, 0.4);
        for (let i = 0; i < 4; i++) { S.padPop[i] = decay(S.padPop[i], dt, 0.16); S.padBad[i] = decay(S.padBad[i], dt, 0.3); }
        if (S.leaving) { S.leaving.t += dt / 0.25; if (S.leaving.t >= 1) S.leaving = null; }
      },
      press: function (code) {
        const d = DIRS4.indexOf(code), slot = ORDER.indexOf(d);
        if (slot < 0 || S.trans > EPS || S.lock > EPS) return;
        const cd = cards[S.c % cards.length], x = (294 / 2 + (slot - (ORDER.length - 1) / 2) * 60) * SC;
        if (d === cd.seq[S.i]) { S.hits++; cd.marks[S.i] = 1; S.padPop[slot] = 1; if (S.hits <= S.par) fx.float(x, 300, '+1', P.gold); }
        else { S.wrongs++; cd.marks[S.i] = 2; S.padBad[slot] = 1; S.lock = LOCK; fx.cross(x, 336, 18); fx.kick(3); fx.flash(P.bad, 0.14); }
        S.i++;
        if (S.i >= K) {                                                                                  // 카드 한 장 끝: 박수
          const clean = cd.marks.every(function (m) { return m === 1; });
          S.leaving = { cd: { seq: cd.seq.slice(), marks: cd.marks.slice() }, t: 0 }; S.done++; S.c++; S.i = 0; S.trans = TRANS;
          const nx = cards[S.c % cards.length]; for (let j = 0; j < K; j++) nx.marks[j] = 0;
          if (clean) { S.clap = 1; fx.burst(520, 150, P.gold, 8, 170); }
        }
      },
      finish: function () {
        return { score: env.flawed(clamp((Math.min(S.hits, S.par) - S.wrongs) / S.par, 0, 1), S.wrongs), hits: Math.min(S.hits, S.par), total: S.par,
          detail: '읽은 화살표 ' + Math.min(S.hits, S.par) + ' / ' + S.par + (S.wrongs ? ' · 말이 꼬임 ' + S.wrongs + '번' : '') + ' · 넘긴 카드 ' + S.done + '장' };
      },
      draw: function (g, wt) {
        g.drawImage(hallSprite(), 0, 0);
        put(g, heroSprite(S.lock > 0 ? 'calm' : 'open', false), 69, 64); OB(g, 54, 64, 30, 26, 'n'); fr(g, 56, 66, 26, 3, 'N'); OB(g, 62, 72, 14, 10, 'y');
        const card = function (cd, y, cur) {
          const w = K * 22 + 16, x0 = Math.round(180 - w / 2);
          fr(g, x0 + 2, y + 3, w, 36, 'd'); SB(g, x0, y, w, 36, 'w'); fr(g, x0 + 1, y + 1, w - 2, 4, 'Y');
          for (let i = 0; i < K; i++) {
            const cx = x0 + 19 + i * 22, m = cd.marks[i], now = i === cur;
            if (now) { fr(g, cx - 10, y + 7, 21, 25, 'Y'); fr(g, cx - 8, y + 30, 17, 2, 'o'); }
            sticker(g, cx, y + 19 - (now ? Math.round(1 + Math.sin(fx.clock * 9)) : 0), 17, cd.seq[i]);
            if (m) veil(g, cx - 9, y + 9, 19, 20, 'w');
            if (m === 1) vMark(g, cx, y + 20, 5); else if (m === 2) xMark(g, cx, y + 19, 4);
          }
        };
        const lv = S.leaving, k = S.trans > EPS ? 1 - S.trans / TRANS : 1;
        if (lv) card(lv.cd, 22 - Math.round(50 * easeOut(lv.t)), -1);
        if (wt >= -0.3) card(cards[S.c % cards.length], 22 + Math.round(70 * (1 - easeOut(k))), S.trans > EPS ? -1 : S.i);
        for (let i = 0; i < S.par; i++) { const on = i < Math.min(S.hits, S.par), cols = Math.ceil(S.par / 3), x0 = 258 - cols * 5; OB(g, x0 + (i % cols) * 5, 66 + Math.floor(i / cols) * 6, 4, 5, on ? 'y' : 'b', on ? 'k' : 'B'); }   // 만점 기준 칸 (세 줄, 오른쪽 막 앞)
        // 청중: 박수를 치면 들썩인다
        for (let i = 0; i < 12; i++) { const hx = 12 + i * 24, up = S.clap > 0 ? Math.round(2 * Math.abs(Math.sin(S.clap * 14 + i))) : 0; ell(g, hx, 100 - up, 7, 7, i % 3 === 0 ? 'H' : i % 3 === 1 ? 'n' : 'E'); fr(g, hx - 9, 105 - up, 18, 8, ['b', 'g', 'r', 'E'][i % 4]); }
        // 아래 누름 칸
        for (let i = 0; i < ORDER.length; i++) { const px = Math.round(147 + (i - (ORDER.length - 1) / 2) * 60); pad(g, px, 118, 48, 15, 'w', bump(S.padPop[i]), S.padBad[i] > 0); sticker(g, px, 117, 11, ORDER[i]); }
      },
    };
  }

  // ---------------------------------------------------------------------
  // 9. 방송 — 빨간 불이 켜진 카메라 쪽 키 (← ↑ →). 파란 불(대기)에는 누르지 않는다
  // ---------------------------------------------------------------------
  function studioSprite() { // 배경: 스튜디오 · 책상 (294×127)
    return spr('studio', LW, LH, 0, 0, function (g) {
      fr(g, 0, 0, LW, 96, 'b'); for (let x = 0; x < LW; x += 21) fr(g, x, 0, 1, 96, 'B'); fr(g, 0, 30, LW, 1, 'B'); fr(g, 0, 62, LW, 1, 'B');
      OB(g, 104, 34, 86, 40, 'S', 'k'); fr(g, 106, 36, 82, 36, 'l'); fr(g, 110, 40, 30, 3, 'w'); fr(g, 110, 46, 50, 2, 'S'); fr(g, 110, 51, 40, 2, 'S');   // 뒤 화면
      fr(g, 0, 96, LW, 31, 'E'); fr(g, 0, 96, LW, 2, 'k');
      OB(g, 96, 84, 102, 26, 'N'); fr(g, 98, 86, 98, 3, 'C'); fr(g, 98, 106, 98, 2, 'n'); OB(g, 132, 92, 30, 10, 'r'); fr(g, 136, 95, 22, 4, 'w');           // 책상 · 방송 딱지
    }, true);
  }
  function camSprite(up) { // 카메라 (30×24, 기준 = 가운데). up = 위에서 내려다보는 카메라(매달림)
    return spr('cam' + (up ? 1 : 0), 32, 26, 16, 13, function (g) {
      if (up) { fr(g, 14, 0, 4, 6, 'E'); }
      OB(g, 3, 5, 22, 14, 'E'); fr(g, 5, 7, 18, 2, 'e'); OB(g, 24, 8, 7, 8, 'k'); fr(g, 26, 10, 3, 4, 'l');
      if (!up) { fr(g, 12, 19, 4, 3, 'k'); fr(g, 6, 22, 16, 2, 'k'); }
    });
  }
  function makeTv(env) {
    const P = env.P, rng = env.rng, fx = env.fx, seconds = env.seconds, n = env.intensity, lf = env.lf, rate = env.rate;
    const WIN = [1.1, 0.68, 0.6, 0.5][n], FLOORW = [0.66, 0.53, 0.44, 0.37][n], GAP = [0.42, 0.32, 0.26, 0.22][n], DECOY = [0, 0.24, 0.28, 0.33][n];   // 불이 켜져 있는 시간 · 그 바닥 · 불 사이의 틈 · 파란 불(가짜) 비율
    const CAMS = [[120, 196], [440, 62], [760, 196]];                                                   // 왼쪽 · 위 · 오른쪽 카메라 (논리 좌표)
    const cues = [];
    let lastCam = -1;
    for (let t = 0.45; t < seconds - 0.5;) {
      const dur = Math.max(FLOORW, WIN / (lf * rate(t))), red = cues.length < 1 || cues[cues.length - 1].red === false || rng() >= DECOY;   // 첫 불은 늘 빨강, 파란 불이 연달아 오지 않는다
      let cam = env.pick(3); if (cam === lastCam && rng() < 0.6) cam = (cam + 1 + env.pick(2)) % 3; lastCam = cam;
      if (t + dur > seconds - 0.05) break;
      cues.push({ at: t, dur: dur, cam: cam, red: red, st: 0 });                                         // st: 0 아직 · 1 맞힘 · 2 놓침 · 3 가짜를 눌렀다 · 4 가짜를 잘 참았다
      t += dur + Math.max(0.16, GAP / (lf * rate(t)));
    }
    const total = Math.max(1, cues.filter(function (c) { return c.red; }).length);
    const S = { cues: cues, total: total, hits: 0, wrongs: 0, misses: 0, look: 1, lookT: 0, now: null, camPop: [0, 0, 0], camBad: [0, 0, 0], wt: 0 };
    const ORDER = [0, 2, 1];                                                                             // 카메라 번호(왼 · 위 · 오) → 방향 번호
    return {
      title: '방송 출연', howto: '빨간 불 카메라 쪽으로 ← ↑ →',
      how: ['빨간 불이 켜진 카메라 쪽 키(← ↑ →)를 불이 꺼지기 전에 누른다', '파란 불은 대기 화면 — 누르면 감점'],
      controls: [{ code: 'ArrowLeft', label: '왼쪽 카메라' }, { code: 'ArrowUp', label: '위 카메라' }, { code: 'ArrowRight', label: '오른쪽 카메라' }],
      state: S,
      tick: function (dt, wt, playing) {
        S.lookT = decay(S.lookT, dt, 0.5);
        for (let i = 0; i < 3; i++) { S.camPop[i] = decay(S.camPop[i], dt, 0.25); S.camBad[i] = decay(S.camBad[i], dt, 0.3); }
        S.now = null;
        for (const c of cues) {
          if (wt >= c.at && wt < c.at + c.dur) { if (c.st === 0) S.now = c; }
          else if (playing && wt >= c.at + c.dur && c.st === 0) { if (c.red) { c.st = 2; S.misses++; S.camBad[c.cam] = Math.max(S.camBad[c.cam], 0.6); } else c.st = 4; }
        }
      },
      press: function (code) {
        const d = DIRS4.indexOf(code), cam = ORDER.indexOf(d);
        if (cam < 0) return;
        const c = S.now, p = CAMS[cam];
        S.look = cam; S.lookT = 1;
        if (c && c.red && c.cam === cam) { c.st = 1; S.hits++; S.camPop[cam] = 1; S.now = null; fx.ring(p[0], p[1], P.gold, 18, 60); fx.float(p[0], p[1] - 50, '+1', P.gold); }
        else { S.wrongs++; S.camBad[cam] = 1; if (c && !c.red) { c.st = 3; S.now = null; } fx.cross(p[0], p[1], 18); fx.kick(2.5); fx.flash(P.bad, 0.14); }
      },
      finish: function () {
        return { score: env.flawed(clamp((S.hits - 0.5 * S.wrongs) / S.total, 0, 1), S.wrongs), hits: S.hits, total: S.total,
          detail: '맞춘 카메라 ' + S.hits + ' / ' + S.total + (S.misses ? ' · 놓친 불 ' + S.misses + '번' : '') + (S.wrongs ? ' · 엉뚱한 카메라 ' + S.wrongs + '번' : '') };
      },
      draw: function (g, wt) {
        g.drawImage(studioSprite(), 0, 0);
        put(g, heroSprite('open', false), 147, 91); OB(g, 96, 84, 102, 26, 'N'); fr(g, 98, 86, 98, 3, 'C'); fr(g, 98, 106, 98, 2, 'n'); OB(g, 132, 92, 30, 10, 'r'); fr(g, 136, 95, 22, 4, 'w');
        if (S.lookT > 0.05) { const p = CAMS[S.look]; seg(g, 147, 62, L(p[0]) + (S.look === 0 ? 14 : S.look === 2 ? -14 : 0), L(p[1]) + (S.look === 1 ? 10 : 0), 'Y', 1); }   // 눈길
        for (let i = 0; i < S.total; i++) { const on = i < S.hits; OB(g, 8 + i * 8, 116, 6, 7, on ? 'y' : 'b', on ? 'k' : 'B'); }
        const c = S.now;
        for (let i = 0; i < 3; i++) {
          const x = L(CAMS[i][0]), y = L(CAMS[i][1]), on = c && c.cam === i, k = bump(S.camPop[i]), bad = S.camBad[i] > 0.05;
          const im = camSprite(i === 1); put(g, i === 2 ? flipped(im) : im, x, y - Math.round(3 * k));
          const lx = x + (i === 2 ? 8 : -8), ly = y - (i === 1 ? 2 : 12), col = on ? (c.red ? 'r' : 'l') : bad ? 'R' : 'e';
          OB(g, lx - 3, ly - 3, 7, 7, col); if (on) fr(g, lx - 2, ly - 2, 2, 2, 'w');
          if (on) {                                                                                       // 켜진 불: 꺾쇠 + 남은 시간
            const f = clamp(1 - (wt - c.at) / c.dur, 0, 1);
            corners(g, x - 22, y - 18, x + 23, y + 17, 6, c.red ? 'r' : 'l', 2);
            waitBar(g, x - 16, y + 18, 32, f);
            sticker(g, x + (i === 0 ? 30 : i === 2 ? -30 : 0), y + (i === 1 ? 32 : 0), c.red ? 17 : 11, ORDER[i]);
            if (!c.red) xMark(g, x + (i === 0 ? 30 : i === 2 ? -30 : 0), y + (i === 1 ? 32 : 0), 3);
          }
          if (k > 0.3) vMark(g, x, y - 20, 6);
        }
      },
    };
  }

  // ---------------------------------------------------------------------
  // 10. 자문 — 차트의 끝이 처음보다 높으면 ↑(사라), 낮으면 ↓(팔아라)
  // ---------------------------------------------------------------------
  function boardSprite() { // 배경: 회의실 · 큰 화면 (294×127)
    return spr('board', LW, LH, 0, 0, function (g) {
      fr(g, 0, 0, LW, 92, 'L'); for (let x = 0; x < LW; x += 28) fr(g, x, 0, 1, 92, 'e'); fr(g, 0, 70, LW, 22, 'e'); fr(g, 0, 70, LW, 1, 'E');
      fr(g, 64, 9, 170, 76, 'k'); fr(g, 62, 6, 170, 76, 'E'); fr(g, 65, 9, 164, 70, 'k');
      fr(g, 0, 92, LW, 2, 'k'); fr(g, 0, 94, LW, 33, 'n'); fr(g, 0, 94, LW, 3, 'N');
      OB(g, 240, 40, 16, 30, 'g'); fr(g, 244, 30, 8, 12, 'G'); fr(g, 242, 34, 12, 6, 'g');   // 화분
    }, true);
  }
  function makeAdvise(env) {
    const P = env.P, rng = env.rng, fx = env.fx, seconds = env.seconds, n = env.intensity, lf = env.lf, rate = env.rate;
    const lfs = 1 + (lf - 1) * 0.6;
    const par = Math.max(3, Math.min([10, 12, 12, 12][n], Math.round([8, 10, 10, 10][n] * lfs * seconds / 7)));
    const TRANS = 0.2, NP = 14, items = [];
    for (let i = 0; i < 40; i++) {                                                                       // 차트: 처음 값에서 끝 값까지 출렁이며 간다. 강도가 높을수록 차이가 작고 출렁임이 크다
      const up = rng() < 0.5, d = ([0.28, 0.16, 0.1, 0.06][n] + [0.12, 0.14, 0.1, 0.08][n] * rng()) * (up ? 1 : -1), y0 = clamp(0.5 - d / 2 + (rng() - 0.5) * 0.2, 0.18, 0.82), y1 = clamp(y0 + d, 0.06, 0.94);
      const amp = [0.07, 0.12, 0.16, 0.2][n], pts = [];
      for (let j = 0; j < NP; j++) { const f = j / (NP - 1); pts.push(j === 0 ? y0 : j === NP - 1 ? y1 : clamp(y0 + (y1 - y0) * f + amp * (rng() * 2 - 1) * Math.sin(Math.PI * f) * 1.6, 0.04, 0.96)); }
      items.push({ pts: pts, up: y1 > y0, mark: 0 });
    }
    const allowFor = function (wt) { return Math.max(0.9, [2.0, 1.7, 1.6, 1.5][n] / (lfs * rate(wt))); };
    const S = { items: items, cur: 0, trans: 0, allow: 0, patience: 0, par: par, hits: 0, wrongs: 0, timeouts: 0, padPop: [0, 0], padBad: [0, 0], leaving: null, guide: n <= 1, think: [0.05, 0.12, 0.22, 0.3][n], hard: [1, 1.5, 2.5, 4][n] };
    function next(mark) { const it = items[S.cur % items.length]; it.mark = mark; S.leaving = { it: it, mark: mark, t: 0 }; S.cur++; S.trans = TRANS; S.allow = 0; S.patience = 0; }
    return {
      title: '투자 자문', howto: '끝이 처음보다 높으면 ↑ 낮으면 ↓', startY: 300,
      how: ['차트의 끝(흰 점)이 처음(파란 점)보다 높으면 ↑(사라), 낮으면 ↓(팔아라)', '틀리면 감점 — 찍지 않는다'],
      controls: [{ code: 'ArrowUp', label: '사라' }, { code: 'ArrowDown', label: '팔아라' }],
      state: S,
      tick: function (dt, wt, playing) {
        S.trans = Math.max(0, S.trans - dt);
        for (let i = 0; i < 2; i++) { S.padPop[i] = decay(S.padPop[i], dt, 0.18); S.padBad[i] = decay(S.padBad[i], dt, 0.3); }
        if (S.leaving) { S.leaving.t += dt / 0.22; if (S.leaving.t >= 1) S.leaving = null; }
        if (!playing || S.trans > EPS) return;
        if (S.allow === 0) S.allow = S.patience = allowFor(wt);
        if ((S.patience -= dt) <= 0) { S.timeouts++; fx.cross(441, 130, 16); fx.kick(1.5); next(3); }
      },
      press: function (code) {
        const k = code === 'ArrowUp' ? 0 : code === 'ArrowDown' ? 1 : -1;
        if (k < 0 || S.trans > EPS) return;
        const it = items[S.cur % items.length], right = (k === 0) === it.up, px = k === 0 ? 150 : 730;
        if (right) { S.hits++; S.padPop[k] = 1; fx.ring(px, 330, P.good, 24, 66); fx.float(px, 280, '+1', P.gold); next(1); }
        else { S.wrongs++; S.padBad[k] = 1; fx.cross(px, 330, 20); fx.kick(3); fx.flash(P.bad, 0.16); next(2); }
      },
      finish: function () {
        return { score: env.flawed(clamp((Math.min(S.hits, S.par) - S.wrongs) / S.par, 0, 1), S.wrongs), hits: Math.min(S.hits, S.par), total: S.par,
          detail: '맞힌 차트 ' + Math.min(S.hits, S.par) + ' / ' + S.par + (S.wrongs ? ' · 잘못 본 차트 ' + S.wrongs + '번' : '') + (S.timeouts ? ' · 못 본 차트 ' + S.timeouts + '장' : '') };
      },
      draw: function (g, wt) {
        g.drawImage(boardSprite(), 0, 0);
        put(g, heroSprite('open', true), 34, 92);
        for (let i = 0; i < S.par; i++) { const on = i < Math.min(S.hits, S.par); OB(g, 6 + (i % 6) * 9, 12 + Math.floor(i / 6) * 9, 7, 7, on ? 'y' : 'b', on ? 'k' : 'B'); }
        const chart = function (it, mark, a) {
          const X0 = 72, X1 = 222, Y0 = 16, Y1 = 72, X = function (j) { return Math.round(X0 + (X1 - X0) * j / (NP - 1)); }, Y = function (v) { return Math.round(Y1 - (Y1 - Y0) * v); };
          const col = mark === 0 ? 'y' : it.up ? 'r' : 'l';                                              // 답한 뒤에야 색이 갈린다 (오름 = 빨강 · 내림 = 파랑)
          const body = function (lg) {
            for (let y = Y0; y <= Y1; y += 14) fr(lg, X0 - 4, y, X1 - X0 + 8, 1, 'E');
            if (S.guide || mark) for (let x = X0; x < X1; x += 6) fr(lg, x, Y(it.pts[0]), 3, 1, 'l');   // 처음 값의 높이 (하 · 중에만 미리 보인다)
            for (let j = 1; j < NP; j++) seg(lg, X(j - 1), Y(it.pts[j - 1]), X(j), Y(it.pts[j]), col, 2);
            OB(lg, X(0) - 3, Y(it.pts[0]) - 3, 7, 7, 'l'); OB(lg, X(NP - 1) - 3, Y(it.pts[NP - 1]) - 3, 7, 7, 'w');
            if (mark === 1) vMark(lg, 208, 24, 7); else if (mark === 2) xMark(lg, 208, 24, 6);
          };
          if (a >= 0.999) body(g); else faded(g, a, body);
        };
        const lv = S.leaving;
        if (lv) chart(lv.it, lv.mark, 1 - lv.t);
        else if (wt >= -0.3 && S.trans <= EPS) chart(items[S.cur % items.length], 0, 1);
        if (wt >= 0 && S.trans <= EPS && S.allow > 0) waitBar(g, 107, 86, 80, S.patience / S.allow);
        // 아래 두 칸: 사라(위) · 팔아라(아래)
        pad(g, 50, 111, 76, 24, 'P', bump(S.padPop[0]), S.padBad[0] > 0); sticker(g, 50, 110, 17, 2, ['r', 'R']);    // 오름 = 빨강 · 내림 = 파랑 (시세 색과 같게)
        pad(g, 243, 111, 76, 24, 'S', bump(S.padPop[1]), S.padBad[1] > 0); sticker(g, 243, 110, 17, 3, ['b', 'B']);
      },
    };
  }

  // =====================================================================
  // 손: 판 상태에서 화면에 보이는 것만 읽고 "지금 할 일"을 골라 사람처럼 누른다 (시연 · tools/mg-model.js)
  // =====================================================================
  // 읽기는 { key, code, alt, eta, chain } 을 준다. code 가 null 이면 "안 누르는 게 맞음", alt = 헷갈렸을 때 누르는 키들,
  // eta = 가장 좋은 때까지 남은 초(null 이면 바로), chain = 같은 까닭으로 이어 누르는 것(두 칸 옮기기)은 다시 반응하지 않는다,
  // pick = 미리 볼 틈 없이 넷 중 하나를 찾아 눌러야 함(편의점: 물건 그림 → 번호) — 고르는 시간을 더한다.
  const READ = {
    flyer: function (s, done) {
      let p = null;
      for (const q of s.people) if (q.state === 'walk' && !done.has(q) && q.x < W && q.x >= s.zoneX - s.zoneHalf && (!p || q.x < p.x)) p = q;
      return p && { key: p, code: p.busy ? null : 'Space', alt: p.busy ? ['Space'] : [], eta: (p.x - s.zoneX) / p.v };
    },
    loading: function (s, done, m, dt) {
      const v = m.belt != null ? (s.belt - m.belt) / dt : 0;     // 벨트 속도는 눈으로 본 움직임에서
      m.belt = s.belt;
      let b = null;
      for (const q of s.boxes) if (q.state === 'belt' && !done.has(q) && q.y > 82 && q.y <= s.lineY + s.win && (!b || q.y > b.y)) b = q;   // 82 = 벽 구멍(상자 딱지가 보이기 시작)
      return b && { key: b, code: DIR_CODES[b.dir], alt: DIR_CODES.filter(function (c, i) { return i !== b.dir; }), eta: v > 0 ? (s.lineY - b.y) / v : 1 };
    },
    store: function (s) {
      if (s.trans > EPS) return null;
      const it = s.customers[s.cur % s.customers.length].items[s.idx];
      return it == null ? null : { key: s.cur + '.' + s.idx, code: DIGIT_CODES[it], alt: DIGIT_CODES.filter(function (c, i) { return i !== it; }), eta: null, pick: true };
    },
    delivery: function (s) {
      const SY = 298, ahead = s.obs.filter(function (o) { return o.y + o.half > 0 && o.y < SY + o.half + 22; });
      if (!ahead.length && !s.pins.some(function (p) { return !p.got && p.y > -12; })) return null;   // 핀: 그림 아래 끝(y + 21)의 세 점 · 땅 그림자가 화면에 들어온 때부터 보인다
      const r1 = ahead.length ? Math.min.apply(null, ahead.map(function (o) { return o.row; })) : -1;
      const lanes = function (r) { return ahead.filter(function (o) { return o.row === r; }).map(function (o) { return o.lane; }); };
      const b1 = lanes(r1), b2 = lanes(r1 + 1), y1 = ahead.length ? Math.max.apply(null, ahead.filter(function (o) { return o.row === r1; }).map(function (o) { return o.y; })) : -1e9;
      let pin = null;
      for (const p of s.pins) if (!p.got && p.y > -12 && p.y < SY + 80 && (!pin || p.y > pin.y)) pin = p;
      // 다음 두 줄에서 모두 빈 차선(길이 늘 하나는 남겨 둔다)이 있으면 그리로 — 버스가 지나자마자 다음 줄이 오는 때를 미리 피한다
      const free = function (l) { return b1.indexOf(l) < 0 && b2.indexOf(l) < 0; };
      let want = s.lane, why = 'r' + r1;
      if (pin && b1.indexOf(pin.lane) < 0 && (pin.y > y1 || b2.indexOf(pin.lane) < 0)) { want = pin.lane; why = 'p' + s.pins.indexOf(pin); }
      else if (!free(s.lane)) want = [0, 1, 2].filter(function (l) { return b1.indexOf(l) < 0; }).sort(function (a, b) { return free(b) - free(a) || Math.abs(a - s.lane) - Math.abs(b - s.lane); })[0];
      if (want == null || want === s.lane) return null;
      const d = want < s.lane ? 'ArrowLeft' : 'ArrowRight';
      return { key: why + ':' + s.lane, code: d, alt: [d === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft'], eta: null, chain: why };
    },
    // 새 일 여섯. think = 따져 보는 시간(셈 · 차트), hard = 헷갈리기 쉬운 정도(외운 길의 뒤쪽 · 비슷한 차트)
    cafe: function (s) {   // 붓기 시작은 보는 대로, 멈추기는 선에 닿을 때를 재서 (스스로 시작한 일이라 다시 놀라지 않는다 = chain)
      if (s.trans > EPS) return null;
      const c = s.cups[s.cur % s.cups.length], k = s.cur + '.' + s.step;
      return s.st === 'idle' ? { key: k + 's', code: 'Space', alt: [], eta: null, chain: 'c' + k, hard: 0.5 }
        : { key: k + 'e', code: 'Space', alt: [], eta: (c.targets[s.step] - s.level) / s.v, chain: 'c' + k, hard: 0.5 };
    },
    tutor: function (s) {
      if (s.trans > EPS) return null;
      const it = s.items[s.cur % s.items.length];
      return { key: s.cur, code: it.ok ? 'ArrowLeft' : 'ArrowRight', alt: [it.ok ? 'ArrowRight' : 'ArrowLeft'], eta: null, pick: true, think: it.think };
    },
    driver: function (s) {
      if (s.ph !== 'input' || s.fin || s.idx >= s.K) return null;
      const d = s.rounds[s.r].seq[s.idx];
      return { key: s.r + '.' + s.idx, code: DIRS4[d], alt: [0, 1, 2].filter(function (x) { return x !== d; }).map(function (x) { return DIRS4[x]; }), eta: null, hard: 1 + 1.2 * (s.K - 3) + 0.6 * s.idx };
    },
    lecture: function (s) {
      if (s.trans > EPS || s.lock > EPS) return null;
      const d = s.cards[s.c % s.cards.length].seq[s.i];
      return { key: s.c + '.' + s.i, code: DIRS4[d], alt: s.order.filter(function (x) { return x !== d; }).map(function (x) { return DIRS4[x]; }), eta: null, pick: s.i === 0 };
    },
    tv: function (s, done) {   // 한 번 누른 불은 다시 누르지 않는다 (엉뚱한 카메라를 눌렀어도)
      const c = s.now;
      if (!c || done.has(c)) return null;
      const d = [0, 2, 1][c.cam];
      return { key: c, code: c.red ? DIRS4[d] : null, alt: c.red ? [0, 1, 2].filter(function (x) { return x !== d; }).map(function (x) { return DIRS4[x]; }) : [DIRS4[d]], eta: null, pick: true };
    },
    advise: function (s) {
      if (s.trans > EPS) return null;
      const it = s.items[s.cur % s.items.length];
      return { key: s.cur, code: it.up ? 'ArrowUp' : 'ArrowDown', alt: [it.up ? 'ArrowDown' : 'ArrowUp'], eta: null, pick: true, think: s.think, hard: s.hard };
    },
  };
  // prof = { react, rsd, rlo, rhi (반응 초), tsd (박자 오차), wrong (헷갈림 확률), chain (이어 누르기 반응), pick (고르는 시간) }, 없으면 완벽한 손
  function makeHand(id, prof, rng) {
    const read = READ[id], done = new Set(), m = {};
    let t = 0, cur = null, since = 0, r = 0, e = 0, slip = false, lastChain = null;
    const gauss = function () { return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()); };
    return function (s, dt) {
      t += dt;
      const q = read(s, done, m, dt);
      if (!q) { cur = null; return null; }
      if (q.key !== cur) {                                // 새 할 일: 이때부터 반응 시간이 흘러야 누른다
        cur = q.key; since = t;
        r = prof ? clamp(prof.react + prof.rsd * gauss(), prof.rlo, prof.rhi) : 0;
        if (prof && q.chain != null && q.chain === lastChain) r = Math.min(r, prof.chain);
        if (prof && q.pick) r += prof.pick;
        if (prof && q.think) r += q.think * prof.pick / 0.12;   // 따져 보는 시간: 잘하는 사람(고르는 시간 0.12초) 기준, 느린 손일수록 더
        e = prof ? prof.tsd * gauss() : 0;
        slip = !!prof && rng() < prof.wrong * (q.hard || 1);
      }
      if (s.phase !== 'play' || t < since + r - EPS || (q.eta != null && q.eta + e > dt / 2)) return null;
      done.add(q.key); lastChain = q.chain;
      return slip ? (q.alt.length ? q.alt[Math.min(q.alt.length - 1, Math.floor(rng() * q.alt.length))] : null) : q.code;
    };
  }
  // 시연의 손: 잘하는 사람보다 빠르고 틀리지 않는다 (보는 사람이 맞는 플레이를 보게) — 가끔 한 번 놓친다
  const DEMO_HAND = { react: 0.15, rsd: 0.02, rlo: 0.1, rhi: 0.2, tsd: 0.015, wrong: 0, chain: 0.05, pick: 0.02 };   // 시연은 일부러 틀리지 않는다 (높은 강도에서도 맞는 플레이를 보이게 손이 빠르다 — 박자를 놓치는 일만 가끔)
  function demo(id, opts) {
    opts = opts || {};
    let game = null, hand = null, rest = 0;
    const self = { w: W, h: H, done: false, result: null, lastPress: null, loops: 0, press: function () {} };
    function next() {                                      // 새 씨앗으로 한 판 (opts.rng 는 쓰지 않는다)
      self.loops++;
      const o = {}, seed = 4099 + self.loops * 7919;
      for (const k in opts) o[k] = opts[k];
      o.rng = spareRng(seed);
      game = build(o, MAKERS[id]); hand = makeHand(id, DEMO_HAND, spareRng(seed * 31 + 7)); rest = 0;
      game.idle = true;
      for (let i = 0; i < 240 && game._state.phase === 'ready'; i++) game.update(1 / 60);   // 준비 시간을 건너뛴다: 열거나 강도를 바꾸자마자 하는 장면이 보이게
      self.title = game.title; self.howto = game.howto; self.how = game.how; self.controls = game.controls; self._state = game._state;
    }
    self.update = function (dt) {
      dt = +dt || 0;
      if (dt <= 0) return;
      if (self.lastPress) self.lastPress.age += dt;
      if (!game.done) {
        const code = hand(game._state, dt);
        if (code) { game.press(code); self.lastPress = { code: code, age: 0 }; }
        game.update(dt);
        if (game.done) self.result = game.result;
      } else if ((rest += dt) >= 0.6 - EPS) next();
    };
    self.draw = function (ctx) { game.draw(ctx); };
    next();
    return self;
  }

  // =====================================================================
  // 내놓기
  // =====================================================================
  const MAKERS = { flyer: makeFlyer, loading: makeLoading, store: makeStore, delivery: makeDelivery, cafe: makeCafe, tutor: makeTutor, driver: makeDriver, lecture: makeLecture, tv: makeTv, advise: makeAdvise };
  // 미니게임 색: 예전 PAL 과 같은 역할 이름, 값은 PX(밝은 낮의 픽셀 색). ui.js 가 opts.pal 로 넘긴다.
  // 그림은 PX 를 직접 쓰고, pal 은 효과 색(맞음 · 틀림 · 금빛 · 흰 글)의 역할을 알아보는 데만 쓴다 — 예전 PAL 이 와도 같은 그림.
  root.MGPAL = (function () {
    const X = pxt();
    return {
      night0: X.s, night1: X.S, night2: X.q, night3: X.L, ground: X.C, stone: X.e, stoneLit: X.L,
      warm: X.o, warmDim: X.O, lamp: X.Y, sys: X.b, sysDim: X.B, sysDeep: X.B,
      text: X.w, dim: X.e, ink: X.k, up: X.r, down: X.b, gold: X.y, good: X.g, bad: X.r,
      skin: X.p, skinShade: X.P, hair: X.H, hood: X.l, hoodShade: X.b, pants: X.E, shoe: X.w,
      sky: X.s, panel: X.c, line: X.k,   // 새 이름: 하늘 · 크림 패널 · 외곽선
    };
  })();
  root.Minigames = {
    list: ['flyer', 'loading', 'store', 'delivery', 'cafe', 'tutor', 'driver', 'lecture', 'tv', 'advise'],
    create: function (id, opts) {
      if (!MAKERS[id]) throw new Error('Minigames.create: 모르는 미니게임 "' + id + '"');
      return build(opts, MAKERS[id]);
    },
    demo: function (id, opts) {
      if (!MAKERS[id]) throw new Error('Minigames.demo: 모르는 미니게임 "' + id + '"');
      return demo(id, opts);
    },
    _hand: makeHand,   // 재는 도구(tools/mg-model.js)가 같은 손을 쓴다: _hand(id, prof 또는 null, rng) → (판 상태, dt) → 누를 키
    // 미니게임에 나오는 모든 등장물. draw(ctx, x, y, s): x, y = 그림 가운데, s = 배율 (1 = 게임 안 크기 = 점 하나가 논리 3px)
    sprites: function () {
      const S = function (name, make) {
        return { name: name, draw: function (c, x, y, s) {
          const im = make(), k = SC * (s || 1);
          c.imageSmoothingEnabled = false;
          c.drawImage(im, Math.round(x - im.width * k / 2), Math.round(y - im.height * k / 2), Math.round(im.width * k), Math.round(im.height * k));
        } };
      };
      const fig = function (key, w, h, fn) { return function () { return spr('fig-' + key, w, h, 0, 0, fn, true); }; };
      return [
        S('나 (전단지 알바)', function () { return meSprite(1, false, false); }),
        S('행인 (비니)', function () { return walkerSprite(0, 0, false); }),
        S('행인 (긴 머리)', function () { return walkerSprite(1, 0, false); }),
        S('행인 (모자와 배낭)', function () { return walkerSprite(2, 0, false); }),
        S('바쁜 사람', function () { return runnerSprite(0, false); }),
        S('전단지', sheetSprite),
        S('상자 (왼쪽)', function () { return crateSprite(0); }),
        S('상자 (오른쪽)', function () { return crateSprite(1); }),
        S('상자 (위)', function () { return crateSprite(2); }),
        S('왼쪽 트럭', fig('truck0', 93, 54, function (g) { g.drawImage(truckSprite(0), 0, 0); sticker(g, 44, 20, 17, 0); })),
        S('오른쪽 트럭', fig('truck1', 93, 54, function (g) { g.drawImage(flipped(truckSprite(1)), 0, 0); sticker(g, 48, 20, 17, 1); })),
        S('선반', fig('shelf', 100, 22, function (g) { g.drawImage(shelfSprite(), 18, 0); sticker(g, 8, 10, 15, 2); })),
        S('작업 장갑', gloveSprite),
        S('손님 (학생)', function () { return customerSprite(0, 0); }),
        S('손님 (직장인)', function () { return customerSprite(1, 0); }),
        S('손님 (할머니)', function () { return customerSprite(2, 1); }),
        S('손님 (모자)', function () { return customerSprite(3, 0); }),
        S('삼각김밥', function () { return itemSprite(0); }),
        S('컵라면', function () { return itemSprite(1); }),
        S('캔커피', function () { return itemSprite(2); }),
        S('우유', function () { return itemSprite(3); }),
        S('계산대 화면', registerSprite),
        S('내 스쿠터', function () { return scooterSprite(0, false); }),
        S('승용차', function () { return carSprite(0); }),
        S('버스', busSprite),
        S('배달 완료 지점', pinSprite),
        S('나 (새 일들)', function () { return heroSprite('open', false); }),
        S('유리잔', cupSprite),
        S('손님 차', sedanSprite),
        S('카메라', function () { return camSprite(false); }),
        S('위 카메라', function () { return camSprite(true); }),
      ];
    },
  };
})();
