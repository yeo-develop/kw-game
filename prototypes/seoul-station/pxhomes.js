// PROTOTYPE - NOT FOR PRODUCTION
// 픽셀 장면 — 사는 곳 5~8 (아파트 고층 거실 · 주택 마당 · 바닷가 별장 · 호텔 맨 위층 스위트), 시간대 넷씩.
// 불려 올 때 window.Art.scene 을 한 번 더 감싼다: tier 5~8(9 = 최고 부자는 호텔 그림)이면 128×72 픽셀 그림을,
// 아니면 앞의 Art.scene(pxart.js 가 감싼 것)을 그대로 부른다. 그리다 오류가 나면 앞의 것으로 돌아간다.
// 그리는 도구 · 주인공 · 상태창은 window.PxArt(pxart.js), 색은 window.PX + PxArt.XC + 아래 HC(넷)만.
// 보이는 띠: 그림 칸이 가장 낮을 때 y 12~59 만 보인다 → 주인공 · 상태창은 그 안에, 천장(0~11) · 바닥(60~71)은 잘려도 된다.
// Math.random 을 쓰지 않는다(같은 입력이면 같은 그림).
(function () {
  try {
    const A = window.PxArt, PX = window.PX, Art = window.Art;
    if (!A || !PX || !Art || typeof Art.scene !== 'function' || typeof document === 'undefined') return;
    const { P, box, map, disc, line, dither, sparkle, drawHero, drawHeroTop, drawHeroLegs, drawStatusWin, drawCloud } = A;
    if (![P, box, map, disc, line, dither, sparkle, drawHero, drawHeroTop, drawHeroLegs, drawStatusWin, drawCloud].every(f => typeof f === 'function')) return;
    const setMap = typeof A.setMap === 'function' ? A.setMap : () => {};

    // ───── 이 파일 전용 색 (넷) ─────
    const HC = {
      sea: '#2a9fd4',    // 바다 (하늘 's' 보다 진한 청록빛 파랑)
      seaDk: '#1d65a8',  // 저녁 · 밤 바다, 물결 그늘
      gold: '#e0a526',   // 금색 틀 가운데 (노랑 'y' 와 주황 'O' 사이)
      goldDk: '#9a6418', // 금색 틀 그늘
    };

    // ───── 공통: 시간대 ─────
    const KEYS = ['morning', 'day', 'evening', 'night'];
    const lit = key => key === 'evening' || key === 'night'; // 실내 불 켜는 때
    const SKY = { // [높이 비율, 색] — 사이는 점무늬로 섞는다
      morning: [[0, 'q'], [0.34, 'S'], [0.64, 'Y'], [0.86, 'p']],
      day: [[0, 's'], [0.5, 'q'], [0.8, 'S']],
      evening: [[0, 'duskHi'], [0.3, 'dusk'], [0.62, 'o'], [0.86, 'y']],
      night: [[0, 'nite0'], [0.45, 'nite1'], [0.8, 'B']],
    };
    function sky(g, x, y, w, h, key) {
      const b = SKY[key];
      for (let i = 0; i < b.length; i++) {
        const y0 = y + Math.round(b[i][0] * h), y1 = i + 1 < b.length ? y + Math.round(b[i + 1][0] * h) : y + h;
        P(g, x, y0, w, y1 - y0, b[i][1]);
        if (i > 0) { dither(g, x, y0, w, 1, b[i - 1][1], 0); dither(g, x, y0 - 1, w, 1, b[i][1], 1); }
      }
    }
    function lcg(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
    function stars(g, x, y, w, h, seed, n) {
      const r = lcg(seed);
      for (let i = 0; i < n; i++) P(g, x + Math.floor(r() * w), y + Math.floor(r() * h), 1, 1, i % 4 ? 'w' : 'Y');
    }
    function moon(g, cx, cy, bite) { disc(g, cx, cy, 4, 'Y', 'Y'); disc(g, cx + 2, cy - 2, 3, bite, bite); P(g, cx - 3, cy, 1, 2, 'w'); }
    function sun(g, cx, cy, r, key) { disc(g, cx, cy, r, 'Y', key === 'evening' ? 'o' : 'y'); P(g, cx - r + 2, cy - r + 2, 2, 1, 'w'); }
    function glowDots(g, cx, cy, r, k) { // 불빛 번짐: 둘레를 한 칸 건너 하나
      for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2; if (a & 1) continue; P(g, Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r * 0.8), 1, 1, k); }
    }
    function pool(g, cx, cy, rx, ry, k) { // 바닥에 떨어진 불빛 (점무늬)
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (d <= 0.35) P(g, cx + x, cy + y, 1, 1, k); else if (d <= 1 && ((cx + x + cy + y) & 1)) P(g, cx + x, cy + y, 1, 1, k);
      }
    }
    function beam(g, x0, x1, y, h, slant, k) { // 창으로 든 볕: 바닥에 비스듬한 띠 (가운데는 꽉, 가장자리 두 칸만 점무늬)
      for (let j = 0; j < h; j++) {
        const o = Math.round(j * slant), a = x0 + o, b = x1 + o, edge = j === 0 || j === h - 1;
        for (let x = a; x < b; x++) { const rim = edge || x < a + 2 || x >= b - 2; if (!rim || ((x + y + j) & 1) === 0) P(g, x, y + j, 1, 1, k); }
      }
    }
    function glass(g, x, y, key) { // 유리에 비친 반짝임: 창 칸 왼쪽 위의 짧은 빗금 둘 (2칸 굵기 · 1칸 굵기)
      if (key === 'night') return;
      for (let j = 0; j < 9; j++) { P(g, x + 8 - j, y + j, 2, 1, 'w'); if (j > 2 && j < 8) P(g, x + 13 - j, y + j, 1, 1, 'w'); }
    }

    // ───── 공통: 소품 ─────
    function mug(g, x, y) { box(g, x, y, 5, 5, 'w'); P(g, x + 1, y + 1, 3, 1, 'n'); P(g, x + 5, y + 1, 1, 3, 'k'); P(g, x + 1, y - 2, 1, 1, 'L'); P(g, x + 3, y - 3, 1, 1, 'L'); }
    const SH = { e: 'E', L: 'e', w: 'L', o: 'O', r: 'R', y: 'o', b: 'B', l: 'b', N: 'n', c: 'C', C: 'd', g: 'G', s: 'l', S: 's' };
    function sofaBack(g, x, y, w, c) { // y = 앉는 면 위. 등받이는 y-13 부터
      box(g, x + 3, y - 13, w - 6, 14, c); P(g, x + 4, y - 12, w - 8, 1, 'w');
      for (let xx = x + 3 + Math.floor((w - 6) / 3); xx < x + w - 6; xx += Math.floor((w - 6) / 3)) P(g, xx, y - 10, 1, 9, SH[c] || 'k');
      P(g, x + 4, y - 2, w - 8, 2, SH[c] || 'k');
    }
    function sofaFront(g, x, y, w, c) {
      box(g, x + 2, y, w - 4, 6, c); P(g, x + 3, y + 1, w - 6, 1, 'w'); P(g, x + 3, y + 4, w - 6, 1, SH[c] || 'k');
      for (const ax of [x, x + w - 7]) { box(g, ax, y - 7, 7, 13, c); P(g, ax + 1, y - 6, 5, 1, 'w'); P(g, ax + 1, y + 3, 5, 2, SH[c] || 'k'); }
      for (const lx of [x + 2, x + w - 4]) P(g, lx, y + 6, 2, 3, 'H');
    }
    function pillow(g, x, y, c) { box(g, x, y, 8, 7, c); P(g, x + 1, y + 1, 6, 1, 'w'); P(g, x + 1, y + 5, 6, 1, SH[c] || 'k'); }
    function plant(g, x, floor, big) { // x = 화분 왼쪽, floor = 화분 바닥
      const pw = big ? 10 : 8, ph = big ? 8 : 6, top = floor - ph;
      const L = big ? [[-4, -18, 6], [4, -22, 6], [10, -16, 6], [1, -12, 7], [-3, -8, 5], [8, -8, 5]] : [[-2, -12, 5], [5, -14, 5], [1, -8, 5]];
      for (const [dx, dy, r] of L) disc(g, x + pw / 2 + dx, top + dy + r, Math.floor(r / 2) + 1, 'g', 'k');
      for (const [dx, dy, r] of L) { P(g, x + pw / 2 + dx - 1, top + dy + r - 1, 2, 1, 'h'); P(g, x + pw / 2 + dx, top + dy + r + 1, 1, 2, 'G'); }
      P(g, x + pw / 2 - 1, top - 6, 2, 6, 'G');
      box(g, x, top, pw, ph, 'o'); P(g, x - 1, top, pw + 2, 2, 'O'); P(g, x - 1, top, pw + 2, 1, 'k'); P(g, x - 1, top, 1, 2, 'k'); P(g, x + pw, top, 1, 2, 'k'); P(g, x + 1, top + 2, 2, ph - 3, 'y');
    }
    function floorLamp(g, x, top, floor, on) { // 스탠드: 기둥 x+3, 갓 폭 8
      P(g, x + 3, top + 6, 2, floor - top - 6, 'E'); P(g, x + 3, top + 6, 1, floor - top - 6, 'k'); P(g, x + 1, floor - 1, 6, 2, 'k');
      map(g, x, top, ['..kkkk..', '.kYYYYk.', '.kYwwYk.', 'kYYYYYYk', 'kYYYYYYk', 'kkkkkkkk'].map(r => on ? r : r.replace(/Y/g, 'c').replace(/w/g, 'w')));
      if (on) { glowDots(g, x + 4, top + 3, 7, 'Y'); }
    }

    // ───── 공통: 창밖 도시 (높은 층에서 내려다본 건물 꼭대기) ─────
    const CITY = {
      morning: { far: 'P', near: 'l', top: 'S', win: 'Y', road: 'e', car: ['w', 'r'] },
      day: { far: 'l', near: 'b', top: 'S', win: 'S', road: 'e', car: ['w', 'r', 'y'] },
      evening: { far: 'duskHi', near: 'B', top: 'b', win: 'Y', road: 'E', car: ['Y', 'r'] },
      night: { far: 'nite1', near: 'nite0', top: 'nite1', win: 'Y', road: 'E', car: ['Y', 'r', 'y'] },
    };
    function city(g, x, w, bot, key, seed, tall, tiny) { // bot = 창 아래 끝(포함 안 함). tall = 가장 높은 건물 높이
      const c = CITY[key], r = lcg(seed);
      // 먼 줄
      for (let xx = x; xx < x + w;) { const bw = (tiny ? 2 : 4) + Math.floor(r() * (tiny ? 3 : 6)), bh = Math.floor(tall * 0.45 + r() * tall * 0.55); P(g, xx, bot - 3 - bh, Math.min(bw, x + w - xx), bh, c.far); if (lit(key) && !tiny) for (let yy = bot - 1 - bh; yy < bot - 4; yy += 2) for (let x2 = xx + 1; x2 < Math.min(xx + bw, x + w) - 1; x2 += 2) if (r() < 0.35) P(g, x2, yy, 1, 1, c.win); xx += bw + (r() < 0.3 ? 1 : 0); }
      // 가까운 줄
      const t2 = Math.max(2, Math.floor(tall * 0.62));
      for (let xx = x - 2; xx < x + w;) {
        const bw = (tiny ? 2 : 6) + Math.floor(r() * (tiny ? 2 : 6)), bh = Math.floor(t2 * 0.4 + r() * t2 * 0.6), x0 = Math.max(x, xx), ww = Math.min(xx + bw, x + w) - x0;
        if (ww > 0) {
          P(g, x0, bot - 2 - bh, ww, bh, c.near); P(g, x0, bot - 2 - bh, ww, 1, c.top);
          if (!tiny) for (let yy = bot - bh; yy < bot - 3; yy += 2) for (let x2 = x0 + 1; x2 < x0 + ww - 1; x2 += 2) if (lit(key) ? r() < 0.55 : (x2 + yy) % 4 === 0) P(g, x2, yy, 1, 1, c.win);
          else if (lit(key)) for (let x2 = x0; x2 < x0 + ww; x2 += 2) if (r() < 0.6) P(g, x2, bot - 1 - bh + Math.floor(r() * bh), 1, 1, c.win);
        }
        xx += bw + 1;
      }
      // 저 아래 도로 + 차 불빛
      P(g, x, bot - 2, w, 2, c.road);
      for (let xx = x + 2; xx < x + w; xx += 5) P(g, xx, bot - 2 + ((xx >> 2) & 1), 1, 1, c.car[(xx >> 1) % c.car.length]);
    }

    // ───── 5. 아파트 고층 거실 — 벽 하나가 통유리, 창밖 아래로 도시 ─────
    function sceneApt(g, key) {
      const on = lit(key);
      // 벽 · 천장 · 바닥
      P(g, 0, 0, 128, 72, 'w'); P(g, 0, 0, 128, 4, 'L'); P(g, 0, 4, 128, 1, 'e');
      P(g, 0, 51, 128, 21, 'C'); P(g, 0, 51, 128, 1, 'e'); P(g, 0, 52, 128, 1, 'w');
      for (const [y, o] of [[55, 0], [60, 9], [66, 4]]) { P(g, 0, y, 128, 1, 'd'); for (let x = o; x < 128; x += 18) P(g, x, y - (y === 55 ? 2 : 4), 1, y === 55 ? 2 : 4, 'd'); }
      // 통유리 (x 2~125, y 6~48)
      const gx = 2, gy = 6, gw = 124, gh = 43;
      sky(g, gx, gy, gw, gh, key);
      if (key === 'night') { stars(g, gx, gy, gw, 20, 57, 24); moon(g, 108, 14, 'nite0'); }
      if (key === 'morning') sun(g, 24, 22, 4, key);
      if (key === 'day') sun(g, 48, 14, 3, key);
      if (key === 'evening') sun(g, 84, 22, 5, key);
      if (key === 'morning' || key === 'day') { drawCloud(g, 60, 12, 'w', key === 'day' ? 'S' : 'p'); drawCloud(g, 8, 13, 'w', key === 'day' ? 'S' : 'p'); }
      if (key === 'evening') { drawCloud(g, 38, 14, 'dusk', 'duskHi'); }
      city(g, gx, gw, gy + gh, key, 57, 24, false);
      for (const px of [5, 36, 67, 98]) glass(g, px, gy + 2, key);
      // 유리틀: 가늘고 길게 (현대식)
      P(g, gx - 2, gy - 2, gw + 4, 2, 'E'); P(g, gx - 2, gy - 2, gw + 4, 1, 'k');
      for (const mx of [gx - 2, 33, 64, 95, gx + gw]) { P(g, mx, gy - 1, 2, gh + 1, 'L'); P(g, mx, gy - 1, 1, gh + 1, 'k'); P(g, mx + 1, gy - 1, 1, gh + 1, 'E'); }
      P(g, 0, gy + gh, 128, 2, 'E'); P(g, 0, gy + gh, 128, 1, 'k'); // 창턱
      // 볕 · 불빛
      if (key === 'morning') beam(g, 6, 40, 53, 7, 1.5, 'Y');
      if (key === 'day') beam(g, 20, 60, 53, 7, 0.8, 'w');
      if (on) pool(g, 38, 56, 14, 4, 'Y');
      // 큰 화분 (왼쪽)
      plant(g, 8, 57, true);
      // 옆 탁자 + 탁상 스탠드
      box(g, 30, 46, 14, 3, 'N'); P(g, 31, 47, 12, 1, 'c'); P(g, 32, 49, 2, 8, 'n'); P(g, 40, 49, 2, 8, 'n'); P(g, 32, 49, 1, 8, 'k'); P(g, 41, 49, 1, 8, 'k');
      map(g, 32, 34, ['..kkkkkk..', '.kccccccK.', 'kccccccccK', 'kkkkkkkkkk'].map(r => r.replace(/c/g, on ? 'Y' : 'o').replace(/K/g, 'k')));
      P(g, 36, 38, 2, 8, 'E'); P(g, 34, 45, 6, 1, 'k');
      if (on) glowDots(g, 37, 36, 8, 'Y');
      // 소파 (회색, 주황 · 노랑 쿠션) + 주인공 (머그를 든다)
      const sx = 50, sw = 54, seat = 51, hx = 66, hy = 27;
      sofaBack(g, sx, seat, sw, 'e');
      pillow(g, sx + 6, seat - 9, 'o'); pillow(g, sx + sw - 15, seat - 9, 'y');
      drawHeroTop(g, hx, hy, 'calm');
      mug(g, hx + 15, hy + 18);
      sofaFront(g, sx, seat, sw, 'e');
      drawHeroLegs(g, hx, hy);
      // 러그 (보이는 띠 아래쪽)
      P(g, 22, 61, 96, 6, 's'); P(g, 22, 61, 96, 1, 'l'); for (let x = 24; x < 116; x += 4) P(g, x, 63, 2, 1, 'S');
      // 상태창
      drawStatusWin(g, 96, 14, 28, 20, key === 'night' ? 'l' : 'w');
      sparkle(g, 92, 10, key === 'night' ? 'Y' : 'w'); sparkle(g, 125, 36, key === 'night' ? 'Y' : 'w');
    }

    // ───── 6. 주택 마당 — 큰 미닫이 유리문 너머 마당 (잔디 · 담장 · 나무 · 강아지) ─────
    const OUT_MAP = { evening: { h: 'g', g: 'G', w: 'C', L: 'd', N: 'n' }, night: { h: 'G', g: 'G', G: 'H', w: 'e', L: 'E', N: 'n', n: 'H', C: 'd', c: 'C', y: 'o' } };
    function dog(g, x, y) { // 옆모습 강아지 (왼쪽 보기, 14×9)
      box(g, x + 4, y + 2, 9, 5, 'c'); P(g, x + 5, y + 3, 7, 1, 'w'); P(g, x + 8, y + 3, 3, 2, 'N');
      P(g, x + 5, y + 7, 1, 2, 'k'); P(g, x + 7, y + 7, 1, 2, 'k'); P(g, x + 10, y + 7, 1, 2, 'k'); P(g, x + 11, y + 7, 1, 2, 'k');
      P(g, x + 13, y + 1, 1, 2, 'k'); P(g, x + 14, y, 1, 1, 'k');
      box(g, x, y, 6, 5, 'c'); P(g, x + 3, y - 1, 3, 3, 'N'); P(g, x + 3, y - 1, 3, 1, 'k'); P(g, x + 5, y, 1, 3, 'k');
      P(g, x + 2, y + 2, 1, 1, 'k'); P(g, x, y + 3, 1, 1, 'k'); P(g, x + 1, y + 4, 2, 1, 'r');
    }
    function sceneHouse(g, key) {
      const on = lit(key);
      // 벽 (크림) · 천장 띠 · 징두리 · 나무 바닥
      P(g, 0, 0, 128, 72, 'c'); P(g, 0, 0, 128, 4, 'C'); P(g, 0, 4, 128, 1, 'd');
      P(g, 0, 40, 34, 12, 'C'); P(g, 0, 40, 34, 1, 'N'); P(g, 0, 41, 34, 1, 'w');
      for (let x = 3; x < 34; x += 8) P(g, x, 43, 1, 8, 'd');
      P(g, 0, 52, 128, 20, 'N'); P(g, 0, 52, 128, 1, 'k'); P(g, 0, 53, 128, 1, 'c');
      for (const [y, o] of [[57, 0], [62, 7], [68, 3]]) { P(g, 0, y, 128, 1, 'n'); for (let x = o; x < 128; x += 16) P(g, x, y - 4, 1, 4, 'n'); }
      // 미닫이 유리문 (x 38~125, y 7~52) — 바깥
      const dx = 38, dy = 7, dw = 88, dh = 45;
      setMap(OUT_MAP[key] || null);
      sky(g, dx, dy, dw, 26, key);
      if (key === 'night') { stars(g, dx, dy, dw, 18, 66, 18); moon(g, 58, 15, 'nite0'); }
      if (key === 'morning') sun(g, 52, 24, 4, key);
      if (key === 'day') sun(g, 54, 13, 3, key);
      if (key === 'evening') sun(g, 62, 27, 5, key);
      if (key === 'morning' || key === 'day') drawCloud(g, 66, 11, 'w', key === 'day' ? 'S' : 'p');
      // 먼 언덕 · 담장
      for (let x = dx; x < dx + dw; x++) { const hgt = 3 + Math.round(2 * Math.sin((x - dx) / 9)); P(g, x, dy + 26 - hgt, 1, hgt, 'G'); }
      P(g, dx, dy + 24, dw, 7, 'C'); P(g, dx, dy + 24, dw, 1, 'k'); P(g, dx, dy + 25, dw, 1, 'w');
      for (let x = dx + 2; x < dx + dw; x += 8) { P(g, x, dy + 27, 7, 1, 'd'); P(g, x + 4, dy + 29, 7, 1, 'd'); }
      // 잔디 · 꽃
      P(g, dx, dy + 31, dw, 9, 'g'); P(g, dx, dy + 31, dw, 1, 'G');
      for (let x = dx + 1; x < dx + dw; x += 3) P(g, x, dy + 32 + ((x * 7) % 5), 1, 1, 'h');
      for (const [fx, fk] of [[44, 'r'], [48, 'y'], [52, 'r'], [76, 'y'], [80, 'w']]) { P(g, fx, dy + 29, 2, 2, fk); P(g, fx, dy + 31, 1, 2, 'G'); }
      // 나무 (오른쪽)
      P(g, 111, dy + 14, 4, 22, 'n'); P(g, 111, dy + 14, 1, 22, 'k'); P(g, 114, dy + 14, 1, 22, 'k');
      disc(g, 113, dy + 10, 9, 'g', 'k'); disc(g, 104, dy + 16, 5, 'g', 'k'); P(g, 109, dy + 3, 4, 2, 'h'); P(g, 107, dy + 5, 2, 2, 'h'); P(g, 101, dy + 13, 3, 1, 'h');
      P(g, 112, dy + 15, 5, 1, 'G'); P(g, 117, dy + 8, 2, 1, 'G'); P(g, 118, dy + 12, 1, 1, 'r'); P(g, 108, dy + 9, 1, 1, 'r'); P(g, 115, dy + 4, 1, 1, 'r');
      // 강아지
      dog(g, 86, dy + 31);
      // 데크 (바깥 나무 마루)
      P(g, dx, dy + 40, dw, 5, 'C'); P(g, dx, dy + 40, dw, 1, 'd'); for (let x = dx + 3; x < dx + dw; x += 7) P(g, x, dy + 41, 1, 4, 'd');
      setMap(null);
      glass(g, dx + 3, dy + 2, key); glass(g, dx + 49, dy + 2, key);
      // 문틀 (흰 나무, 두 짝 — 오른쪽 짝이 앞)
      P(g, dx - 3, dy - 3, dw + 6, 3, 'w'); P(g, dx - 3, dy - 3, dw + 6, 1, 'k'); P(g, dx - 3, dy - 1, dw + 6, 1, 'L');
      for (const fx of [dx - 3, dx + dw]) { P(g, fx, dy - 3, 3, dh + 3, 'w'); P(g, fx, dy - 3, 1, dh + 3, 'k'); P(g, fx + 2, dy - 3, 1, dh + 3, 'L'); }
      P(g, dx + 42, dy, 4, dh, 'w'); P(g, dx + 42, dy, 1, dh, 'k'); P(g, dx + 45, dy, 1, dh, 'k'); P(g, dx + 43, dy + 22, 2, 5, 'e'); // 가운데 문살 · 손잡이
      P(g, dx - 3, dy + dh - 1, dw + 6, 2, 'L'); P(g, dx - 3, dy + dh, dw + 6, 1, 'k'); // 문턱
      // 볕 · 불빛
      if (key === 'morning') beam(g, 40, 90, 54, 6, -1.2, 'Y');
      if (key === 'day') beam(g, 44, 100, 54, 6, 0.6, 'd');
      if (key === 'evening') beam(g, 50, 96, 54, 6, -1.6, 'y');
      if (on) pool(g, 12, 56, 12, 4, 'Y');
      // 벽 액자 (언덕 그림)
      box(g, 9, 13, 18, 13, 'n'); box(g, 10, 14, 16, 11, 'S'); P(g, 11, 21, 14, 3, 'g'); P(g, 14, 19, 6, 2, 'g'); P(g, 15, 18, 4, 1, 'g'); P(g, 21, 16, 2, 2, 'y'); P(g, 11, 23, 14, 1, 'G');
      // 스탠드 + 1인 소파
      floorLamp(g, 2, 26, 56, on);
      const ax = 10, aw = 24, seat = 47;
      box(g, ax + 2, seat - 12, aw - 4, 13, 'o'); P(g, ax + 3, seat - 11, aw - 6, 1, 'y'); P(g, ax + 3, seat - 2, aw - 6, 2, 'O');
      box(g, ax + 2, seat, aw - 4, 5, 'o'); P(g, ax + 3, seat + 1, aw - 6, 1, 'y');
      for (const sx of [ax, ax + aw - 6]) { box(g, sx, seat - 6, 6, 11, 'o'); P(g, sx + 1, seat - 5, 4, 1, 'y'); P(g, sx + 1, seat + 2, 4, 2, 'O'); }
      P(g, ax + 2, seat + 5, 2, 3, 'H'); P(g, ax + aw - 4, seat + 5, 2, 3, 'H');
      // 주인공 (문 앞에 선다)
      P(g, 50, 56, 22, 2, 'n');
      drawHero(g, 50, 26, 'calm');
      // 상태창
      drawStatusWin(g, 80, 14, 28, 20, key === 'night' ? 'l' : 'w');
      sparkle(g, 76, 13, key === 'night' ? 'Y' : 'w'); sparkle(g, 76, 38, key === 'night' ? 'Y' : 'w');
    }

    // ───── 7. 바닷가 별장 — 높은 박공 천장 · 통창 너머 바다와 수평선 · 물에 비친 해/달 ─────
    function sceneVilla(g, key) {
      const on = lit(key);
      // 나무 벽 · 바닥 (밝은 통나무)
      P(g, 0, 0, 128, 72, 'N'); for (let x = 2; x < 128; x += 6) P(g, x, 0, 1, 52, 'n');
      P(g, 0, 51, 128, 21, 'C'); P(g, 0, 51, 128, 1, 'k'); P(g, 0, 52, 128, 1, 'w');
      for (const [y, o] of [[56, 0], [61, 10], [67, 5]]) { P(g, 0, y, 128, 1, 'd'); for (let x = o; x < 128; x += 20) P(g, x, y - 4, 1, 4, 'd'); }
      // 박공 통창: 옆 x 6~121, 처마 줄 y 24, 꼭대기 (64, 3), 아래 y 48
      const L0 = 6, R0 = 122, eave = 27, peak = 7, bot = 48, cx = 64;
      const inside = (x, y) => y >= peak && y < bot && x >= L0 && x < R0 && (y >= eave || Math.abs(x + 0.5 - cx) <= (y - peak) / (eave - peak) * (cx - L0));
      // 하늘 · 바다를 사각형에 그린 뒤, 박공 밖은 벽으로 덮는다
      const hz = 31; // 수평선
      sky(g, L0, peak, R0 - L0, hz - peak, key);
      if (key === 'night') stars(g, L0, peak, R0 - L0, 22, 77, 26);
      const orb = { morning: [30, 25, 4], day: [44, 15, 3], evening: [40, 26, 5], night: [44, 16, 4] }[key];
      if (key === 'night') moon(g, orb[0], orb[1], 'nite0'); else sun(g, orb[0], orb[1], orb[2], key);
      if (key === 'morning' || key === 'day') { drawCloud(g, 44, 16, 'w', key === 'day' ? 'S' : 'p'); }
      if (key === 'evening') drawCloud(g, 30, 18, 'dusk', 'duskHi');
      // 먼 섬
      map(g, 12, hz - 5, ['......kkk.........', '...kkkGGGkk.......', '.kkGGGGGGGGkkk....', 'kGGGGGGGGGGGGGkkkk'].map(r => key === 'night' ? r.replace(/G/g, 'B').replace(/k/g, 'nite0') : r));
      // 바다
      const sea = key === 'night' ? 'B' : key === 'evening' ? HC.seaDk : HC.sea, seaSh = key === 'night' ? 'nite0' : HC.seaDk;
      P(g, L0, hz, R0 - L0, bot - hz, sea); P(g, L0, hz, R0 - L0, 1, key === 'night' ? 'nite0' : 'B');
      dither(g, L0, bot - 4, R0 - L0, 4, seaSh, 0);
      for (const [wx, wy] of [[14, 37], [40, 40], [62, 36], [104, 41], [20, 44], [80, 45]]) P(g, wx, wy, 5, 1, key === 'night' ? 'nite1' : 'S');
      const refl = key === 'day' ? 'w' : 'Y'; // 물에 비친 해/달: 아래로 갈수록 좁아지는 반짝이는 점무늬 기둥
      const RF = [[[-5, 4], [1, 5]], [[-3, 3], [2, 2]], [[-4, 2], [0, 3]], [[-2, 2], [3, 1]], [[-1, 3]], [[-3, 1], [1, 1]], [[0, 1]]]; // [x 어긋남, 길이]
      RF.forEach((row, i) => row.forEach(([dx2, len]) => P(g, orb[0] + dx2, hz + 2 + i * 2, len, 1, i % 2 && key !== 'day' ? 'y' : refl)));
      // 모래톱
      P(g, L0, bot - 2, R0 - L0, 2, key === 'night' ? 'd' : 'Y'); dither(g, L0, bot - 3, R0 - L0, 1, key === 'night' ? 'd' : 'Y', 1);
      // 박공 밖 = 벽(통나무)
      for (let y = peak; y < eave; y++) for (let x = L0; x < R0; x++) if (!inside(x, y)) P(g, x, y, 1, 1, (x - 2) % 6 === 0 ? 'n' : 'N');
      glass(g, 66, peak + 4, key);
      // 창틀: 비스듬한 서까래(두껍게) + 세로 창살 + 가로 들보
      for (const s of [-1, 1]) {
        const xe = s < 0 ? L0 - 1 : R0;
        line(g, xe, eave, s < 0 ? cx - 1 : cx, peak - 1, 'k', 1); line(g, xe + s, eave + 1, (s < 0 ? cx - 1 : cx) + 0, peak, 'H', 1); line(g, xe + 2 * s, eave + 2, s < 0 ? cx - 1 : cx, peak + 1, 'n', 1);
      }
      for (const mx of [L0 - 2, 35, 63, 92, R0 - 1]) { const top = mx < L0 || mx >= R0 - 1 ? eave : Math.max(peak, Math.ceil(peak + Math.abs(mx + 1 - cx) / (cx - L0) * (eave - peak))); P(g, mx, top, 3, bot - top, 'n'); P(g, mx, top, 1, bot - top, 'k'); P(g, mx + 2, top, 1, bot - top, 'H'); }
      P(g, L0 - 2, eave, R0 - L0 + 4, 2, 'n'); P(g, L0 - 2, eave, R0 - L0 + 4, 1, 'k'); P(g, L0 - 2, eave + 2, R0 - L0 + 4, 1, 'H');
      P(g, L0 - 2, bot, R0 - L0 + 4, 3, 'n'); P(g, L0 - 2, bot, R0 - L0 + 4, 1, 'k'); P(g, L0 - 2, bot + 1, R0 - L0 + 4, 1, 'N');
      // 저녁 · 밤: 박공을 따라 꼬마전구
      if (on) for (let i = 1; i < 15; i++) { const t = i / 15, x1 = Math.round(L0 + (cx - L0) * t), y1 = Math.round(eave - (eave - peak) * t) + 2; P(g, x1, y1, 1, 1, i % 3 ? 'Y' : 'y'); P(g, 2 * cx - x1, y1, 1, 1, i % 3 ? 'Y' : 'y'); }
      // 볕 · 불빛
      if (key === 'morning') beam(g, 10, 50, 53, 6, 1.3, 'Y');
      if (key === 'day') beam(g, 30, 80, 53, 6, 0.7, 'w');
      if (key === 'evening') beam(g, 70, 112, 53, 6, -1.4, 'y');
      if (on) pool(g, 30, 57, 12, 3, 'Y');
      // 서핑보드 (왼쪽, 벽에 기대 둠)
      for (let y = 20; y <= 55; y++) { // 끝이 뾰족한 흰 보드 + 빨간 가운데 줄
        const t = (y - 40) / (y < 40 ? 20 : 15), hw = Math.max(1, Math.round(4.5 * Math.sqrt(Math.max(0, 1 - t * t)))), x = 16 + Math.round((55 - y) / 8);
        P(g, x - hw - 1, y, 1, 1, 'k'); P(g, x - hw, y, hw * 2, 1, 'w'); P(g, x + hw, y, 1, 1, 'k'); P(g, x + hw - 1, y, 1, 1, 'L'); if (y > 22 && y < 54) P(g, x - 1, y, 1, 1, 'r');
      }
      P(g, 19, 19, 2, 1, 'k'); P(g, 14, 56, 4, 1, 'k'); P(g, 13, 50, 2, 3, 'k');
      // 랜턴 (바닥)
      box(g, 27, 47, 7, 9, on ? 'Y' : 'L'); P(g, 28, 46, 5, 1, 'k'); P(g, 30, 44, 1, 2, 'k'); P(g, 30, 48, 1, 7, 'k'); P(g, 28, 50, 5, 1, 'k');
      if (on) glowDots(g, 30, 51, 8, 'Y');
      // 흰 데이베드 (하늘색 · 노랑 쿠션) + 주인공 (머그)
      const sx = 42, sw = 52, seat = 51, hx = 57, hy = 27;
      sofaBack(g, sx, seat, sw, 'w');
      pillow(g, sx + 5, seat - 9, 's'); pillow(g, sx + sw - 13, seat - 9, 'y');
      drawHeroTop(g, hx, hy, 'calm');
      mug(g, hx + 15, hy + 18);
      sofaFront(g, sx, seat, sw, 'w');
      drawHeroLegs(g, hx, hy);
      // 큰 화분 (오른쪽)
      plant(g, 106, 58, true);
      // 상태창
      drawStatusWin(g, 92, 14, 28, 20, key === 'night' ? 'l' : 'w');
      sparkle(g, 88, 13, key === 'night' ? 'Y' : 'w');
    }

    // ───── 8. 호텔 맨 위층 스위트 — 아주 높은 천장 · 샹들리에 · 금색 틀 통창 · 구름 아래 아주 작은 도시 ─────
    function goldBar(g, x, y, w, h) { // 금색 틀 (세로면 w=3, 가로면 h=3)
      P(g, x, y, w, h, HC.gold);
      if (w <= h) { P(g, x, y, 1, h, HC.goldDk); P(g, x + 1, y, 1, h, 'y'); P(g, x + w - 1, y, 1, h, HC.goldDk); }
      else { P(g, x, y, w, 1, HC.goldDk); P(g, x, y + 1, w, 1, 'y'); P(g, x, y + h - 1, w, 1, HC.goldDk); }
    }
    function sceneHotel(g, key) {
      const on = lit(key);
      // 벽 (크림 판넬, 금 몰딩) · 크림 대리석 바닥
      P(g, 0, 0, 128, 72, 'c'); P(g, 0, 0, 128, 3, HC.goldDk); P(g, 0, 1, 128, 1, 'y');
      P(g, 0, 52, 128, 20, 'c'); P(g, 0, 52, 128, 1, HC.goldDk); P(g, 0, 53, 128, 1, 'y');
      for (let x = 0; x < 128; x += 16) { line(g, x, 54, x + 8, 71, 'C'); line(g, x + 16, 54, x + 8, 71, 'C'); }
      for (const [gx2, gy2] of [[10, 56], [44, 58], [116, 57], [30, 66]]) { P(g, gx2, gy2, 2, 1, 'w'); P(g, gx2 + 1, gy2 + 1, 2, 1, 'w'); }
      // 통창 (x 16~111, y 8~50), 세 칸 — 위는 둥근 아치(띠 안에 보이게 낮춤)
      const wx = 16, wy = 8, ww = 96, wb = 50, R = 10;
      sky(g, wx, wy, ww, wb - wy, key);
      if (key === 'night') { stars(g, wx, wy, ww, 24, 91, 30); moon(g, 102, 20, 'nite0'); }
      if (key === 'day') sun(g, 100, 20, 3, key);
      if (key === 'evening') sun(g, 98, 30, 5, key);
      // 저 아래 아주 작은 도시 + 그 위를 덮는 구름 바다 (구름보다 높다)
      const cl = { morning: ['w', 'p'], day: ['w', 'S'], evening: ['dusk', 'duskHi'], night: ['nite1', 'nite0'] }[key];
      city(g, wx, ww, wb, key, 83, 6, true);
      for (const [cx2, cy2] of [[12, 36], [34, 39], [58, 35], [82, 38], [100, 36]]) drawCloud(g, cx2, cy2, cl[0], cl[1]);
      if (key === 'morning' || key === 'day') drawCloud(g, 52, 18, 'w', cl[1]);
      for (const px of [wx + 2, wx + 34, wx + 66]) glass(g, px, wy + R + 2, key);
      // 아치 머리: 칸마다 반타원 밖을 벽으로 덮고 금 테를 두른다
      for (let b = 0; b < 3; b++) {
        const bx = wx + b * 32, cxa = bx + 15.5;
        for (let y = 0; y < R; y++) for (let x = 0; x < 32; x++) {
          const ex = (bx + x - cxa) / 16, ey = (R - y) / R;
          if (ex * ex + ey * ey > 1) P(g, bx + x, wy + y, 1, 1, 'c');
        }
        for (let a = 0; a <= 40; a++) { const t = Math.PI * a / 40, ax = Math.round(cxa + Math.cos(t) * 16), ay = Math.round(wy + R - Math.sin(t) * R); P(g, ax - 1, ay - 1, 2, 2, HC.gold); P(g, ax - 1, ay - 2, 2, 1, HC.goldDk); }
        P(g, bx + 14, wy - 3, 4, 3, 'y'); P(g, bx + 15, wy - 4, 2, 1, HC.goldDk); // 쐐기돌
      }
      for (const mx of [wx - 1, wx + 31, wx + 63, wx + 95]) goldBar(g, mx, wy + R - 1, 3, wb - wy - R + 1);
      goldBar(g, wx - 2, wb, ww + 4, 3);
      // 커튼 (빨강 벨벳, 양쪽) + 금 끈
      for (const [cx0, flip] of [[0, false], [113, true]]) {
        P(g, cx0, 3, 15, 50, 'r'); for (let x = 2; x < 15; x += 4) P(g, cx0 + x, 3, 1, 50, 'R'); P(g, cx0 + (flip ? 0 : 14), 3, 1, 50, 'k');
        P(g, cx0 + 1, 3, 13, 1, 'w');
        P(g, cx0 + 1, 34, 13, 2, HC.gold); P(g, cx0 + 1, 34, 13, 1, 'y'); P(g, cx0 + (flip ? 3 : 10), 36, 2, 4, HC.gold); P(g, cx0 + (flip ? 3 : 10), 39, 2, 1, HC.goldDk);
      }
      // 바닥 빨간 카펫 (금 테)
      P(g, 26, 56, 76, 16, 'r'); P(g, 26, 56, 76, 1, HC.goldDk); P(g, 27, 57, 74, 1, 'y'); P(g, 26, 56, 1, 16, HC.goldDk); P(g, 101, 56, 1, 16, HC.goldDk);
      for (let x = 30; x < 98; x += 6) P(g, x, 60, 2, 2, 'R');
      if (on) pool(g, 64, 58, 22, 3, 'Y');
      if (key === 'morning') beam(g, 28, 60, 54, 2, 1, 'Y');
      // 둥근 탁자 + 꽃병 (왼쪽)
      box(g, 18, 44, 18, 3, HC.gold); P(g, 19, 45, 16, 1, 'y'); P(g, 26, 47, 2, 9, HC.goldDk); P(g, 22, 55, 10, 2, HC.goldDk);
      box(g, 24, 37, 6, 7, 'w'); P(g, 25, 38, 1, 4, 'S');
      for (const [fx, fy, fk] of [[22, 31, 'r'], [26, 29, 'y'], [30, 31, 'r'], [24, 34, 'o'], [29, 34, 'w']]) { P(g, fx, fy, 3, 3, fk); P(g, fx + 1, fy + 1, 1, 1, 'k'); }
      P(g, 25, 33, 1, 4, 'G'); P(g, 28, 33, 1, 4, 'G');
      // 샹들리에 (긴 사슬 = 높은 천장, 보이는 띠 안까지 내려온다)
      const chx = 40;
      for (let y = 0; y < 13; y += 2) { P(g, chx, y, 1, 1, HC.goldDk); P(g, chx + 1, y + 1, 1, 1, HC.gold); }
      if (on) { glowDots(g, chx + 0.5, 18, 17, 'Y'); glowDots(g, chx + 0.5, 18, 13, 'Y'); }
      box(g, chx - 2, 12, 6, 5, 'y'); P(g, chx - 1, 13, 1, 2, 'Y'); P(g, chx - 1, 15, 4, 1, 'O');      // 가운데 몸
      box(g, chx - 13, 17, 28, 4, 'y'); P(g, chx - 12, 18, 26, 1, 'Y'); P(g, chx - 12, 19, 26, 1, 'O'); // 위 팔
      box(g, chx - 8, 21, 18, 4, 'y'); P(g, chx - 7, 22, 16, 1, 'Y'); P(g, chx - 7, 23, 16, 1, 'O');   // 아래 그릇
      P(g, chx - 6, 25, 14, 1, 'k'); P(g, chx - 4, 26, 10, 1, HC.goldDk);
      const flame = on ? 'Y' : 'w';
      for (const fx of [chx - 12, chx - 6, chx + 7, chx + 13]) { P(g, fx, 14, 1, 3, 'w'); P(g, fx - 1, 14, 1, 3, 'k'); P(g, fx + 1, 14, 1, 3, 'k'); P(g, fx, 12, 1, 2, flame); if (on) P(g, fx, 11, 1, 1, 'y'); }
      for (const [px, py, n] of [[chx - 12, 21, 2], [chx + 13, 21, 2], [chx - 4, 27, 2], [chx + 1, 27, 3], [chx + 5, 27, 2], [chx - 8, 25, 1], [chx + 9, 25, 1]]) { P(g, px, py, 1, n, 'S'); P(g, px, py + n, 1, 1, 'w'); }
      if (!on) { sparkle(g, chx - 16, 24, 'w'); sparkle(g, chx + 17, 13, 'w'); }
      // 주인공 (뜬 눈 · 반짝)
      P(g, 53, 56, 22, 2, 'R');
      drawHero(g, 53, 26, 'open');
      sparkle(g, 49, 30, 'Y'); sparkle(g, 79, 44, 'Y'); P(g, 47, 40, 1, 1, 'Y');
      // 상태창 (금빛 테두리)
      drawStatusWin(g, 84, 15, 28, 20, 'Y');
      sparkle(g, 80, 11, 'Y');
    }

    // ───── 감싸기 (이름별 캐시) ─────
    const SCENE_NAME = { 5: '아파트 고층 거실', 6: '주택 마당', 7: '바닷가 별장', 8: '호텔 맨 위층 스위트' };
    const DRAW = { 5: sceneApt, 6: sceneHouse, 7: sceneVilla, 8: sceneHotel };
    // 주인공 · 상태창 잘림 상자 (점 좌표, x1 · y1 은 바로 다음 칸). 상태창은 빛 점 · 꼬리까지 = [x-2, y-2, x+w+2, y+h+5]
    const BOX = {
      5: { hero: [66, 24, 88, 58], win: [94, 12, 126, 39] },
      6: { hero: [50, 23, 72, 57], win: [78, 12, 110, 39] },
      7: { hero: [57, 24, 79, 58], win: [90, 12, 122, 39] },
      8: { hero: [53, 23, 75, 57], win: [82, 13, 114, 40] },
    };
    A.SCENE_BOX = A.SCENE_BOX || {};
    for (const t in BOX) A.SCENE_BOX[t] = BOX[t];

    const cache = {};
    function draw(t, key) {
      const id = 'home' + t + '_' + key;
      if (!cache[id]) {
        const c = document.createElement('canvas'); c.width = 128; c.height = 72;
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
        setMap(null);
        try { DRAW[t](g, key); } finally { setMap(null); }
        cache[id] = `<img class="px" alt="${SCENE_NAME[t]}" src="${c.toDataURL()}" width="128" height="72">`;
      }
      return cache[id];
    }
    const prev = Art.scene;
    Art.scene = function (tier, phase) {
      const t = Math.max(0, Math.min(8, Math.round(Number(tier) || 0))); // 9(최고 부자)는 호텔 그림
      if (t >= 5) {
        try { return draw(t, KEYS.indexOf(phase) >= 0 ? phase : 'day'); } catch (e) { if (window.console) console.warn('pxhomes', t, e); }
      }
      return prev.apply(this, arguments);
    };
    window.PxHomes = { draw: (g, t, key) => DRAW[t](g, KEYS.indexOf(key) >= 0 ? key : 'day'), HC, BOX };
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('pxhomes.js 를 불러오지 못해 앞의 그림을 씁니다', e);
  }
})();
