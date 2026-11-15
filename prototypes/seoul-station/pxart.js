// PROTOTYPE - NOT FOR PRODUCTION
// 픽셀 그림 — 장면(서울역) · 카드 그림(알바 · 행동 · 종목) · 로드맵 건물 · 주사위 · 컵.
// 불려 올 때 window.Art 의 scene · thumb · job · act · asset · die · cup 을 감싼다.
// 픽셀 그림이 있으면 <img class="px">(원래 점 크기)를, 없으면 예전 벡터 그림(art.js)을 돌려준다.
// 색은 window.PX(28색) + 장면 전용 XC(아래 넷)만. 오류가 나도 예전 Art 가 남게 전체를 try/catch 로 싼다.
// 2단계(다른 집 장면)에서 다시 쓸 그리는 함수는 window.PxArt 에 둔다.
(function () {
  try {
    const PX = window.PX, Old = window.Art;
    if (!PX || !Old || typeof document === 'undefined') return;

    // ───── 장면 전용 색 (저녁 · 밤 하늘에만 쓴다) ─────
    const XC = {
      duskHi: '#b8649e',  // 저녁 하늘 위쪽 자주
      dusk: '#f59ab0',    // 저녁 노을 분홍
      nite0: '#262f6e',   // 밤 하늘 맨 위 (남색이되 시커멓지 않게)
      nite1: '#33438f',   // 밤 하늘 가운데 · 먼 빌딩
    };
    const COL = Object.assign({}, PX, XC);

    // 잠긴 단계용 회색판 (팔레트 안의 회색으로)
    const GRAY = { k: 'k', w: 'L', c: 'L', C: 'L', d: 'e', Y: 'L', S: 'L', q: 'L', s: 'e', y: 'e', h: 'e', p: 'L', N: 'e', l: 'e', o: 'e', g: 'e', r: 'e',
      e: 'e', L: 'L', b: 'E', B: 'E', O: 'E', G: 'E', R: 'E', n: 'E', E: 'E', H: 'E', P: 'e' };

    // ───── 점 찍는 도구 ─────
    let MAP = null; // 색 바꾸기 표(밤 · 회색판). null 이면 그대로
    function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
    function P(g, x, y, w, h, k) { const kk = (MAP && MAP[k]) || k; g.fillStyle = COL[kk] || kk; g.fillRect(x, y, w, h); }
    function box(g, x, y, w, h, f, o) { P(g, x, y, w, h, o || 'k'); P(g, x + 1, y + 1, w - 2, h - 2, f); }
    function map(g, ox, oy, rows, flip) {
      rows.forEach((r, y) => { const s = flip ? [...r].reverse() : [...r]; s.forEach((ch, x) => { if (ch !== '.') P(g, ox + x, oy + y, 1, 1, ch); }); });
    }
    function disc(g, cx, cy, r, f, o) {
      for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
        const d = Math.hypot(x, y); if (d <= r + .5) P(g, cx + x, cy + y, 1, 1, d <= r - .5 ? f : (o || f));
      }
    }
    function line(g, x0, y0, x1, y1, k, t) { // 브레젠험, t = 두께(아래로)
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1; let e = dx + dy;
      for (;;) { P(g, x0, y0, 1, t || 1, k); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } }
    }
    function dither(g, x, y, w, h, k, odd) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (((x + i + y + j) & 1) === (odd ? 1 : 0)) P(g, x + i, y + j, 1, 1, k); }
    function sparkle(g, x, y, k) { P(g, x, y - 1, 1, 3, k); P(g, x - 1, y, 3, 1, k); }

    // ───── 주인공: 2등신 후드티 (22×31, 시안 가) ─────
    // 0~24 줄 = 머리부터 엉덩이(손 포함), 25~30 줄 = 다리 · 신발. 앉힐 때는 윗몸 → 의자판 → 다리 순으로 그린다.
    const HERO = [
      '......kkkkkkkkkk......',
      '....kkHHHHHHHHHHkk....',
      '...kHHHHHHHHHHHHHHk...',
      '..kHHHHHHHHHHHHHHHHk..',
      '..kHHHHHHHHHHHHHHHHk..',
      '.kHHHHHHHHHHHHHHHHHHk.',
      '.kHHHpHHHHHHHHHHpHHHk.',
      '.kHHppppHHHHHHppppHHk.',
      '.kHppppppppppppppppHk.',
      '.kppppppppppppppppppk.',
      '.kppppkkkppppkkkppppk.',
      '.kpppppPppppppPpppppk.',
      '.kprrpppppppppppprrpk.',
      '..kpppppppkkpppppppk..',
      '...kkppppppppppppkk...',
      '..kbbkkkppppppkkkbbk..',
      '.kbllllbkkkkkkbllllbk.',
      '.kbllllllllllllllllbk.',
      '.kblllllwllllwlllllbk.',
      '.kblllllwllllwlllllbk.',
      'kbllbllllllllllllbllbk',
      'kbllbllbbbbbbbbllbllbk',
      'kbllbllbllllllbllbllbk',
      'kpppkbbbbbbbbbbbbkpppk',
      '.kkk.kEEEEEEEEEEk.kkk.',
      '...kEEEEEEEEEEEEEEk...',
      '...kEEEEEEkkEEEEEEk...',
      '....kEEEEk..kEEEEk....',
      '....kEEEEk..kEEEEk....',
      '...kwwwwwk..kwwwwwk...',
      '...kkkkkkk..kkkkkkk...',
    ];
    // 눈 모양 바꾸기: 'calm'(감은 눈 · 시안 가) · 'open'(뜬 눈 + 반짝)
    function heroRows(face) {
      if (face !== 'open') return HERO;
      const r = HERO.slice();
      r[10] = '.kpppkwkppppppkwkpppk.';
      r[11] = '.kpppkkkPppppPkkkpppk.';
      return r;
    }
    function heroAhoge(g, x, y) { P(g, x + 11, y - 2, 1, 2, 'k'); P(g, x + 12, y - 3, 2, 1, 'k'); P(g, x + 10, y - 1, 1, 1, 'k'); }
    function drawHeroTop(g, x, y, face) { heroAhoge(g, x, y); map(g, x, y, heroRows(face).slice(0, 25)); }
    function drawHeroLegs(g, x, y) { map(g, x, y + 25, HERO.slice(25)); }
    function drawHero(g, x, y, face) { drawHeroTop(g, x, y, face); drawHeroLegs(g, x, y); } // 선 모습

    // ───── 떠 있는 상태창 (w×h, 꼬리 점은 왼쪽 아래로) ─────
    function drawStatusWin(g, x, y, w, h, glow) {
      // 은은한 빛 테두리(한 칸 건너 하나) → 떠 있는 창으로 읽히게
      for (let i = -1; i <= w; i++) { if ((i & 1) === 0) { P(g, x + i, y - 2, 1, 1, glow); P(g, x + i, y + h + 1, 1, 1, glow); } }
      for (let j = 0; j < h; j++) { if ((j & 1) === 0) { P(g, x - 2, y + j, 1, 1, glow); P(g, x + w + 1, y + j, 1, 1, glow); } }
      box(g, x, y, w, h, 'S', 'B');
      P(g, x + 1, y + 1, w - 2, 4, 'b'); P(g, x + 1, y + 5, w - 2, 1, 'B');
      P(g, x + 2, y + 2, 2, 2, 'w'); P(g, x + w - 4, y + 2, 2, 2, 'r'); // 창 표시 · 닫기 단추
      P(g, x + 6, y + 2, Math.min(9, w - 12), 1, 'l');
      P(g, x + 1, y + 6, w - 2, 1, 'w');
      P(g, x + 3, y + 8, w - 10, 1, 'B'); P(g, x + 3, y + 10, w - 6, 1, 'l'); P(g, x + 3, y + 12, w - 14, 1, 'l');
      box(g, x + w - 9, y + h - 7, 7, 5, 'y'); P(g, x + w - 6, y + h - 6, 1, 2, 'k'); P(g, x + w - 6, y + h - 4, 1, 1, 'O'); // 보상 상자
      P(g, x + 3, y + h - 4, w - 14, 2, 'L'); P(g, x + 3, y + h - 4, Math.max(2, Math.floor((w - 14) / 3)), 2, 'g'); // 진행 막대
      // 꼬리: 주인공 쪽으로 떨어지는 점 둘
      P(g, x + 1, y + h + 1, 2, 2, 'B'); P(g, x - 2, y + h + 4, 1, 1, 'B');
    }

    // ───── 소품 ─────
    function drawBenchBack(g, x, y, w) { // y = 등받이 위
      box(g, x, y, w, 4, 'N'); P(g, x + 1, y + 1, w - 2, 1, 'c');
      box(g, x, y + 4, w, 4, 'N'); P(g, x + 1, y + 5, w - 2, 1, 'c');
      P(g, x + 3, y + 8, 2, 6, 'E'); P(g, x + w - 5, y + 8, 2, 6, 'E'); // 등받이 기둥
    }
    function drawBenchSeat(g, x, y, w) { // y = 앉는 판 위
      box(g, x - 2, y, w + 4, 5, 'n'); P(g, x - 1, y + 1, w + 2, 1, 'N');
      for (const lx of [x + 3, x + w - 5]) { P(g, lx, y + 5, 2, 5, 'E'); P(g, lx, y + 5, 1, 5, 'k'); P(g, lx - 1, y + 10, 4, 1, 'k'); }
    }
    function drawLamp(g, x, top, ground, on) { // 가로등: 기둥 x..x+1
      P(g, x, top + 6, 2, ground - top - 6, 'E'); P(g, x, top + 6, 1, ground - top - 6, 'k'); P(g, x - 1, ground - 2, 4, 2, 'k');
      P(g, x - 2, top + 5, 6, 1, 'k');
      box(g, x - 3, top, 8, 6, on ? 'Y' : 'L'); P(g, x - 2, top + 1, 6, 1, on ? 'w' : 'w'); P(g, x - 1, top - 1, 4, 1, 'k');
      if (on) { // 빛 번짐(한 칸 건너 하나)
        for (const [dx, dy] of [[-5, 1], [-5, 3], [-5, 5], [6, 1], [6, 3], [6, 5], [-3, -3], [-1, -3], [1, -3], [3, -3], [5, -3], [-4, 8], [5, 8]]) P(g, x + dx, top + dy, 1, 1, 'Y');
      }
    }
    function lightPool(g, cx, cy, rx, ry) { // 땅에 떨어진 불빛 (점무늬)
      for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
        const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (d <= .45) P(g, cx + x, cy + y, 1, 1, 'Y'); else if (d <= 1 && ((cx + x + cy + y) & 1)) P(g, cx + x, cy + y, 1, 1, 'Y');
      }
    }
    const PIGEON = ['.kkk.....', 'keeek....', 'Oekeekkk.', 'kkeeeeeek', '.keeeeeEk', '..kkkkkk.', '...O..O..'];
    function drawPigeon(g, x, y, flip) { map(g, x, y, PIGEON, flip); }
    function drawTree(g, cx, base, r) {
      P(g, cx - 1, base - r - 2, 3, r + 2, 'n'); P(g, cx - 1, base - r - 2, 1, r + 2, 'k'); P(g, cx + 1, base - r - 2, 1, r + 2, 'k');
      disc(g, cx, base - r - 4, r, 'g', 'k'); P(g, cx - r + 2, base - 2 * r - 2, 3, 2, 'h'); P(g, cx - r + 1, base - 2 * r, 2, 2, 'h');
      P(g, cx + 2, base - r - 2, 2, 1, 'G'); P(g, cx - 2, base - r - 1, 5, 1, 'G');
    }
    function drawFlyers(g, x, y) { // 작은 전단지 뭉치 (아래 = y+5)
      box(g, x, y + 2, 10, 4, 'w'); P(g, x + 1, y + 3, 8, 1, 'e');
      box(g, x + 2, y, 10, 4, 'w'); P(g, x + 3, y + 1, 8, 1, 'r');
    }
    function drawCloud(g, x, y, k, sh) {
      P(g, x + 3, y, 6, 1, k); P(g, x + 1, y + 1, 12, 1, k); P(g, x, y + 2, 16, 2, k); P(g, x + 10, y + 1, 4, 1, k); P(g, x + 1, y + 4, 14, 1, sh);
    }

    // ───── 시간대 ─────
    // sky: [시작 줄, 색] 띠(사이는 점무늬로 섞는다) · far: 먼 빌딩 · win: 창 불 · lamp: 가로등 · map: 배경 색 바꾸기
    const NIGHT_MAP = { w: 'L', c: 'C', C: 'e', d: 'E', N: 'n', n: 'H', O: 'n', g: 'G', h: 'g', l: 'b', b: 'B', s: 'l', S: 'q', q: 's', e: 'E', L: 'e' };
    const PHASES = {
      morning: { sky: [[0, 'q'], [12, 'S'], [24, 'Y'], [34, 'p']], far: 'P', farWin: null, win: 'S', lamp: false, map: null, cloud: ['w', 'p'], sun: [60, 19, 4, 'Y', 'y'] },
      day: { sky: [[0, 's'], [20, 'q'], [34, 'S']], far: 'l', farWin: null, win: 'S', lamp: false, map: null, cloud: ['w', 'S'], sun: [60, 7, 3, 'Y', 'y'] },
      evening: { sky: [[0, 'duskHi'], [10, 'dusk'], [24, 'o'], [36, 'y']], far: 'duskHi', farWin: 'Y', win: 'mix', lamp: true, map: { C: 'p', d: 'P', S: 'p', s: 'dusk' }, cloud: ['dusk', 'duskHi'], sun: [84, 40, 6, 'Y', 'y'] },
      night: { sky: [[0, 'nite0'], [14, 'nite1'], [30, 'B'], [42, 'b']], far: 'nite0', farWin: 'Y', win: 'Y', lamp: true, map: NIGHT_MAP, cloud: null, sun: null },
    };
    function drawSky(g, w, h, ph) {
      const b = ph.sky;
      for (let i = 0; i < b.length; i++) {
        const y0 = b[i][0], y1 = i + 1 < b.length ? b[i + 1][0] : h;
        P(g, 0, y0, w, y1 - y0, b[i][1]);
        if (i > 0) { dither(g, 0, y0, w, 1, b[i - 1][1], 0); dither(g, 0, y0 - 1, w, 1, b[i][1], 1); }
      }
    }
    function drawStars(g, w, h) {
      let s = 11; const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
      for (let i = 0; i < 26; i++) { const x = Math.floor(r() * w), y = Math.floor(r() * h); P(g, x, y, 1, 1, i % 4 ? 'w' : 'Y'); }
      sparkle(g, 8, 14, 'w'); sparkle(g, 92, 6, 'Y'); sparkle(g, 76, 4, 'w');
    }
    function drawMoon(g, cx, cy) { disc(g, cx, cy, 4, 'Y', 'Y'); disc(g, cx + 2, cy - 2, 3, 'nite0', 'nite0'); P(g, cx - 3, cy, 1, 2, 'w'); }

    // ───── 서울역 역사 (돔이 있는 일반적인 옛 역사) ─────
    const DOME = [
      '.........kkkk.........',
      '.......kkhhggkk.......',
      '.....kkhhggggggkk.....',
      '....khhgggggggggGk....',
      '...khgggggggggggGGk...',
      '...kgggggggggggggGk...',
      '..kGGGGGGGGGGGGGGGGk..',
      '.kkkkkkkkkkkkkkkkkkkk.',
      '.kccccccccccccccccccck',
      '.kkkkkkkkkkkkkkkkkkkkk',
    ];
    function drawStation(g, ox, base, win) { // ox = 왼쪽, base = 땅 줄. 폭 66
      // 양 날개
      box(g, ox, base - 22, 66, 22, 'N');
      P(g, ox + 1, base - 21, 64, 2, 'c'); P(g, ox + 1, base - 19, 64, 1, 'd');
      P(g, ox + 1, base - 3, 64, 2, 'C'); P(g, ox, base - 3, 66, 1, 'k');
      let wi = 0;
      for (const wx of [2, 9, 15, 46, 53, 59]) { // 아치 창
        const x = ox + wx, y = base - 16;
        const k = typeof win === 'function' ? win(wi++) : win;
        P(g, x + 1, y, 3, 1, 'k'); P(g, x, y + 1, 1, 11, 'k'); P(g, x + 4, y + 1, 1, 11, 'k'); P(g, x, y + 12, 5, 1, 'k');
        P(g, x + 1, y + 1, 3, 11, k); P(g, x + 1, y + 6, 3, 1, 'k'); if (k === 'S') P(g, x + 1, y + 2, 1, 2, 'w');
      }
      // 가운데 앞으로 나온 몸채
      box(g, ox + 22, base - 30, 22, 30, 'N');
      P(g, ox + 23, base - 29, 20, 2, 'c'); P(g, ox + 23, base - 27, 20, 1, 'd');
      P(g, ox + 23, base - 3, 20, 2, 'C'); P(g, ox + 22, base - 3, 22, 1, 'k');
      // 돔 + 꼭대기
      map(g, ox + 22, base - 40, DOME);
      P(g, ox + 32, base - 44, 2, 4, 'k'); P(g, ox + 32, base - 45, 2, 1, 'y');
      // 시계
      disc(g, ox + 33, base - 22, 3, 'w', 'k'); P(g, ox + 33, base - 24, 1, 2, 'k'); P(g, ox + 33, base - 22, 2, 1, 'k');
      // 큰 아치 문
      map(g, ox + 27, base - 15, [
        '...kkkkkk...',
        '.kkOOOOOOkk.',
        'kOOnnnnnnOOk',
        'kOnnnnnnnnOk',
      ]);
      const dk = typeof win === 'function' ? win(99) : win;
      for (let j = 0; j < 9; j++) { P(g, ox + 27, base - 11 + j, 1, 1, 'k'); P(g, ox + 28, base - 11 + j, 1, 1, 'O'); P(g, ox + 37, base - 11 + j, 1, 1, 'O'); P(g, ox + 38, base - 11 + j, 1, 1, 'k'); P(g, ox + 29, base - 11 + j, 8, 1, dk === 'S' ? 'n' : dk); }
      P(g, ox + 32, base - 13, 2, 12, 'k');
      // 문 위 작은 창 둘
      box(g, ox + 24, base - 18, 3, 5, typeof win === 'function' ? win(7) : win); box(g, ox + 39, base - 18, 3, 5, typeof win === 'function' ? win(8) : win);
    }
    // 뒤의 유리 빌딩
    function drawTower(g, x, y, w, base, lit) {
      box(g, x, y, w, base - y, 'l');
      for (let yy = y + 3; yy < base - 1; yy += 4) P(g, x + 1, yy, w - 2, 1, 'b');
      for (let xx = x + 5; xx < x + w - 1; xx += 6) P(g, xx, y + 1, 1, base - y - 2, 's');
      P(g, x + 1, y + 1, 3, base - y - 2, 'S');
      if (lit) { let s = 5; for (let yy = y + 1; yy < base - 2; yy += 4) for (let xx = x + 6; xx < x + w - 2; xx += 6) { s = (s * 37 + 11) % 101; if (s % 3) P(g, xx, yy, 5, 2, lit); } }
    }
    function drawFar(g, k, lit) { // 역과 유리 빌딩 사이 먼 빌딩들
      const bl = [[64, 32, 9], [72, 27, 8], [80, 34, 10], [89, 29, 9]];
      for (const [x, y, w] of bl) { P(g, x, y, w, 48 - y, k); if (lit) for (let yy = y + 2; yy < 46; yy += 3) for (let xx = x + 2; xx < x + w - 1; xx += 3) if ((xx + yy) % 2) P(g, xx, yy, 1, 1, lit); }
    }

    // ───── 서울역 장면 (128×72) ─────
    function sceneStation(g, key) {
      const ph = PHASES[key] || PHASES.day;
      const W = 128, H = 72, base = 48;
      drawSky(g, W, base, ph);
      if (key === 'night') { drawStars(g, W, 30); drawMoon(g, 60, 9); }
      if (ph.sun) disc(g, ph.sun[0], ph.sun[1], ph.sun[2], ph.sun[3], ph.sun[4]);
      if (ph.cloud) { drawCloud(g, 4, 9, ph.cloud[0], ph.cloud[1]); drawCloud(g, 74, 3, ph.cloud[0], ph.cloud[1]); }
      drawFar(g, ph.far, ph.farWin);
      MAP = ph.map;
      drawTower(g, 100, 5, 26, base, key === 'night' ? 'Y' : key === 'evening' ? 'y' : null);
      const win = ph.win === 'mix' ? (i => (i % 3 === 1 ? 'S' : 'y')) : ph.win;
      drawStation(g, 2, base, win);
      // 광장 바닥
      P(g, 0, base, W, H - base, 'C'); P(g, 0, base, W, 1, 'd');
      for (let x = 4; x < W; x += 12) P(g, x, base + 1, 1, H - base - 1, 'd');
      for (let y = base + 6; y < H; y += 7) P(g, 0, y, W, 1, 'd');
      drawTree(g, 118, base + 6, 6);
      if (ph.lamp) { MAP = null; lightPool(g, 19, 64, 13, 5); MAP = ph.map; }
      // 벤치 그림자 · 등받이
      P(g, 34, 64, 56, 2, 'd');
      drawBenchBack(g, 34, 40, 54);
      MAP = null;
      // 주인공 (밤에도 색 그대로)
      drawHeroTop(g, 44, 30, 'calm');
      MAP = ph.map;
      drawBenchSeat(g, 34, 54, 54);
      MAP = null;
      drawHeroLegs(g, 44, 30);
      MAP = ph.map;
      drawFlyers(g, 70, 49);
      drawPigeon(g, 24, 59, false); drawPigeon(g, 98, 61, true);
      MAP = null;
      drawLamp(g, 16, 14, 64, ph.lamp);
      // 떠 있는 상태창 + 반짝
      drawStatusWin(g, 70, 13, 28, 20, key === 'night' ? 'l' : 'w');
      const sp = key === 'night' ? 'Y' : 'w';
      sparkle(g, 101, 12, sp); sparkle(g, 67, 9, sp); sparkle(g, 103, 30, sp);
      MAP = null;
    }

    // ───── 로드맵 건물 (32×32) — 단계가 오를수록 번듯하게 ─────
    function ground(g, k) { P(g, 0, 28, 32, 4, k || 'C'); P(g, 0, 28, 32, 1, 'k'); }
    const BUILD = [
      g => { // 0 서울역: 돔 역사
        ground(g);
        box(g, 2, 16, 28, 13, 'N'); P(g, 3, 17, 26, 1, 'c');
        box(g, 3, 20, 3, 5, 'S'); box(g, 7, 20, 3, 5, 'S'); box(g, 22, 20, 3, 5, 'S'); box(g, 26, 20, 3, 5, 'S');
        box(g, 10, 12, 12, 17, 'N'); P(g, 11, 13, 10, 1, 'c');
        map(g, 10, 6, ['....kkkk....', '..kkhhggkk..', '.khggggggGk.', 'kgggggggggGk', 'kkkkkkkkkkkk', '.kcccccccck.']);
        P(g, 15, 3, 2, 3, 'k'); P(g, 15, 2, 2, 1, 'y');
        disc(g, 16, 16, 1, 'w', 'k');
        map(g, 12, 21, ['.kkkkkk.', 'knnnnnnk', 'knnnknnk', 'knnnknnk', 'knnnknnk', 'knnnknnk', 'knnnknnk']);
      },
      g => { // 1 찜질방: 김 오르는 표시가 걸린 낮은 건물
        ground(g);
        map(g, 8, 1, ['.e..e..e.', 'e..e..e..', '.e..e..e.', 'e..e..e..']);
        box(g, 4, 10, 24, 19, 'c'); P(g, 5, 11, 22, 1, 'w');
        P(g, 2, 8, 28, 4, 'r'); P(g, 2, 8, 28, 1, 'k'); P(g, 2, 11, 28, 1, 'k'); P(g, 2, 8, 1, 4, 'k'); P(g, 29, 8, 1, 4, 'k'); P(g, 3, 9, 26, 1, 'R');
        box(g, 9, 13, 14, 8, 'w');
        map(g, 11, 14, ['.r..r..r.', 'r..r..r..', '.r..r..r.']); P(g, 11, 18, 10, 1, 'r'); P(g, 10, 17, 1, 2, 'r'); P(g, 21, 17, 1, 2, 'r'); P(g, 12, 19, 8, 1, 'r');
        box(g, 13, 22, 6, 7, 'n'); P(g, 14, 23, 4, 1, 'N'); P(g, 16, 23, 1, 5, 'k');
        box(g, 5, 22, 5, 4, 'S'); box(g, 22, 22, 5, 4, 'S');
      },
      g => { // 2 고시원: 좁고 높은 회색 건물, 작은 창 빼곡
        ground(g);
        box(g, 9, 3, 14, 26, 'L'); P(g, 10, 4, 12, 1, 'w'); P(g, 8, 3, 16, 1, 'k'); P(g, 9, 2, 14, 1, 'E');
        for (let y = 6; y < 23; y += 3) for (let x = 11; x < 21; x += 3) P(g, x, y, 2, 2, 'b');
        box(g, 23, 8, 4, 10, 'y'); P(g, 24, 10, 2, 1, 'k'); P(g, 24, 13, 2, 1, 'k'); P(g, 22, 9, 1, 1, 'k'); P(g, 22, 16, 1, 1, 'k');
        box(g, 13, 23, 6, 6, 'n'); P(g, 14, 24, 4, 1, 'N');
      },
      g => { // 3 원룸: 갈색 벽돌 빌라
        ground(g);
        box(g, 5, 6, 22, 23, 'N'); P(g, 6, 7, 20, 1, 'c'); P(g, 4, 5, 24, 2, 'E'); P(g, 4, 5, 24, 1, 'k'); P(g, 4, 6, 1, 1, 'k'); P(g, 27, 6, 1, 1, 'k');
        for (let y = 9; y < 22; y += 6) for (const x of [7, 14, 21]) { box(g, x, y, 5, 4, 'S'); P(g, x + 1, y + 1, 1, 1, 'w'); }
        box(g, 13, 22, 6, 7, 'n'); P(g, 14, 23, 4, 1, 'O'); P(g, 12, 21, 8, 1, 'k');
        box(g, 22, 22, 4, 3, 'L'); P(g, 23, 23, 2, 1, 'e');
      },
      g => { // 4 내 집: 주황 지붕 작은 집
        ground(g, 'h'); P(g, 0, 29, 32, 1, 'g');
        P(g, 21, 4, 3, 6, 'E'); P(g, 21, 4, 3, 1, 'k'); P(g, 20, 4, 1, 6, 'k'); P(g, 24, 4, 1, 6, 'k');
        map(g, 3, 4, [
          '............kk............',
          '..........kkookk..........',
          '........kkooooOOkk........',
          '......kkooooooooOOkk......',
          '....kkooooooooooooOOkk....',
          '..kkooooooooooooooooOOkk..',
          'kkkkkkkkkkkkkkkkkkkkkkkkkk',
        ].map(r => r.slice(0, 26)));
        box(g, 6, 11, 20, 18, 'c'); P(g, 7, 12, 18, 1, 'w');
        box(g, 13, 18, 6, 11, 'n'); P(g, 14, 19, 4, 1, 'N'); P(g, 17, 23, 1, 1, 'y');
        box(g, 8, 15, 4, 4, 'S'); P(g, 9, 16, 1, 1, 'w'); box(g, 20, 15, 4, 4, 'S'); P(g, 21, 16, 1, 1, 'w');
        P(g, 2, 25, 3, 3, 'g'); P(g, 27, 25, 3, 3, 'g'); P(g, 2, 24, 3, 1, 'k'); P(g, 27, 24, 3, 1, 'k');
      },
      g => { // 5 아파트: 흰 동 둘
        ground(g);
        box(g, 2, 2, 13, 27, 'w'); box(g, 16, 7, 14, 22, 'w');
        for (let y = 4; y < 27; y += 3) { P(g, 3, y, 11, 1, 'l'); P(g, 4, y + 1, 2, 1, 'S'); P(g, 9, y + 1, 2, 1, 'S'); }
        for (let y = 9; y < 27; y += 3) { P(g, 17, y, 12, 1, 'l'); P(g, 19, y + 1, 2, 1, 'S'); P(g, 25, y + 1, 2, 1, 'S'); }
        P(g, 1, 1, 15, 2, 'b'); P(g, 1, 1, 15, 1, 'k'); P(g, 15, 6, 16, 2, 'b'); P(g, 15, 6, 16, 1, 'k');
        box(g, 6, 24, 5, 5, 'S'); box(g, 21, 24, 5, 5, 'S');
      },
      g => { // 6 주택: 마당 있는 이층집 · 파란 지붕 · 나무 · 울타리
        ground(g, 'h'); P(g, 0, 29, 32, 1, 'g');
        map(g, 1, 5, [
          '.......kkkkkkkkkkkk......',
          '.....kkbbbbbbbbbbbbkk....',
          '...kkbbbbbbbbbbbbbbbBkk..',
          '.kkbbbbbbbbbbbbbbbbbBBBkk',
          'kkkkkkkkkkkkkkkkkkkkkkkkk',
        ]);
        box(g, 3, 10, 21, 19, 'w'); P(g, 4, 11, 19, 1, 'c'); P(g, 3, 19, 21, 1, 'C');
        box(g, 5, 12, 5, 5, 'S'); P(g, 6, 13, 1, 1, 'w'); box(g, 17, 12, 5, 5, 'S'); P(g, 18, 13, 1, 1, 'w');
        box(g, 5, 21, 6, 5, 'S'); P(g, 6, 22, 1, 1, 'w'); box(g, 15, 21, 6, 8, 'n'); P(g, 16, 22, 4, 1, 'N'); P(g, 19, 25, 1, 1, 'y');
        disc(g, 27, 18, 4, 'g', 'k'); P(g, 25, 16, 2, 2, 'h'); P(g, 27, 23, 1, 5, 'n');
        for (const x of [0, 2, 25, 27, 29, 31]) P(g, x, 24, 1, 4, 'w'); P(g, 0, 25, 3, 1, 'w'); P(g, 25, 25, 7, 1, 'w'); P(g, 0, 27, 3, 1, 'N'); P(g, 25, 27, 7, 1, 'N');
      },
      g => { // 7 별장: 바닷가 통나무 집 · 붉은 뾰족 지붕 · 소나무
        P(g, 0, 28, 32, 4, 'g'); P(g, 0, 28, 32, 1, 'k'); P(g, 20, 28, 12, 4, 's'); P(g, 20, 29, 12, 1, 'S'); P(g, 23, 31, 6, 1, 'w');
        map(g, 0, 5, ['...k...', '..kGk..', '..kGk..', '.kGgGk.', '.kGGGk.', 'kGgGGGk', 'kGGGGGk', 'kkkkkkk']);
        P(g, 3, 13, 1, 15, 'n');
        box(g, 8, 13, 18, 16, 'N'); for (let y = 15; y < 28; y += 2) P(g, 9, y, 16, 1, 'n');
        map(g, 5, 2, [
          '.........kk.........',
          '........kRRk........',
          '.......kRrrRk.......',
          '......kRrrrrRk......',
          '.....kRrrrrrrRk.....',
          '....kRrrrrrrrrRk....',
          '...kRrrrrrrrrrrRk...',
          '..kRrrrrrrrrrrrrRk..',
          '.kRrrrrrrrrrrrrrrRk.',
          'kRRRRRRRRRRRRRRRRRRk',
          'kkkkkkkkkkkkkkkkkkkk',
        ]);
        box(g, 13, 6, 6, 5, 'Y'); P(g, 15, 6, 1, 5, 'k');
        box(g, 10, 15, 5, 5, 'Y'); box(g, 15, 21, 5, 8, 'n'); P(g, 16, 22, 3, 1, 'N'); box(g, 20, 15, 5, 5, 'Y');
        P(g, 7, 28, 20, 1, 'n');
      },
      g => { // 8 호텔: 금빛 크림 고층 · 붉은 차양 · 깃발 · 별
        ground(g);
        box(g, 6, 5, 20, 24, 'Y'); P(g, 7, 6, 18, 1, 'w'); P(g, 5, 4, 22, 2, 'y'); P(g, 5, 4, 22, 1, 'k'); P(g, 5, 5, 1, 1, 'k'); P(g, 26, 5, 1, 1, 'k');
        for (let y = 8; y < 20; y += 3) for (let x = 8; x < 24; x += 4) { P(g, x, y, 2, 2, 'b'); P(g, x, y, 1, 1, 'l'); }
        map(g, 9, 0, ['k.......', 'krrr....', 'krr.....', 'k.......']); // 깃발
        map(g, 10, 20, ['yky.yky.yky', 'kyk.kyk.kyk']); // 별 셋
        P(g, 4, 22, 24, 3, 'r'); P(g, 4, 22, 24, 1, 'k'); P(g, 4, 24, 24, 1, 'R'); for (let x = 5; x < 28; x += 2) P(g, x, 25, 1, 1, 'r');
        box(g, 12, 25, 8, 4, 'S'); P(g, 15, 25, 2, 4, 'k');
        P(g, 6, 26, 2, 3, 'g'); P(g, 24, 26, 2, 3, 'g');
      },
      g => { // 9 한국 최고 부자: 왕관 쓴 금빛 빌딩
        ground(g, 'Y'); P(g, 0, 29, 32, 1, 'y');
        box(g, 2, 15, 7, 14, 'y'); box(g, 23, 13, 7, 16, 'y');
        for (let y = 17; y < 28; y += 3) { P(g, 4, y, 3, 1, 'O'); } for (let y = 15; y < 28; y += 3) { P(g, 25, y, 3, 1, 'O'); }
        box(g, 9, 9, 14, 20, 'y'); P(g, 10, 10, 2, 18, 'Y');
        for (let y = 11; y < 26; y += 3) P(g, 13, y, 8, 1, 'O');
        map(g, 8, 1, [
          'k...k..k...k....',
          'kk.kyk.kyk.kk...',
          'kykyykkyykkyk...',
          'kyyyyyrryyyyk...',
          'kyYyyyrryyyyk...',
          'kOOOOOOOOOOOk...',
          'kkkkkkkkkkkkkk..',
        ].map(r => r.slice(0, 16)));
        box(g, 13, 24, 6, 5, 'S'); P(g, 16, 24, 1, 5, 'k');
        sparkle(g, 4, 9, 'Y'); sparkle(g, 27, 6, 'Y'); P(g, 29, 10, 1, 1, 'w');
      },
    ];

    // ───── 알바 · 행동 · 종목 (32×32) ─────
    const JOB = {
      flyer: g => { // 전단지 뭉치 + 손
        P(g, 5, 29, 24, 2, 'd');
        box(g, 5, 9, 16, 19, 'w'); P(g, 6, 10, 14, 2, 'o');
        box(g, 9, 6, 17, 21, 'w'); P(g, 10, 7, 15, 2, 'y');
        box(g, 13, 3, 17, 24, 'w');
        P(g, 14, 4, 15, 5, 'r'); P(g, 16, 5, 7, 1, 'w'); P(g, 16, 7, 5, 1, 'w'); P(g, 14, 9, 15, 1, 'R');
        P(g, 15, 11, 12, 1, 'E'); P(g, 15, 13, 13, 1, 'E'); P(g, 15, 15, 9, 1, 'E');
        box(g, 21, 18, 8, 6, 'y'); P(g, 22, 19, 6, 1, 'Y'); P(g, 23, 21, 4, 1, 'O');
        P(g, 14, 25, 15, 1, 'C');
        map(g, 1, 17, ['..kkk...', '.kpppk..', 'kppppk..', 'kpppppkk', 'kpppppppk', 'kPpppppk.', '.kPPPPk..', '..kkkk...', '..kllk...', '..kllk...']);
      },
      loading: g => { // 손수레에 쌓은 상자
        P(g, 3, 30, 26, 1, 'd');
        P(g, 4, 1, 4, 2, 'k'); P(g, 6, 1, 2, 27, 'E'); P(g, 6, 1, 1, 27, 'k'); P(g, 8, 1, 1, 27, 'k');
        P(g, 6, 26, 20, 3, 'E'); P(g, 6, 26, 20, 1, 'k'); P(g, 6, 28, 20, 1, 'k'); P(g, 25, 26, 1, 3, 'k');
        disc(g, 9, 28, 2, 'E', 'k'); P(g, 9, 28, 1, 1, 'L');
        box(g, 9, 14, 16, 12, 'N'); P(g, 10, 15, 14, 1, 'C'); P(g, 16, 14, 2, 12, 'd'); P(g, 16, 14, 2, 1, 'k');
        box(g, 11, 3, 13, 12, 'N'); P(g, 12, 4, 11, 1, 'C'); P(g, 16, 3, 2, 12, 'd'); P(g, 16, 3, 2, 1, 'k');
        box(g, 18, 8, 5, 5, 'w'); P(g, 20, 9, 1, 3, 'k'); P(g, 19, 10, 3, 1, 'k'); P(g, 19, 9, 1, 1, 'w');
        P(g, 10, 22, 4, 1, 'n'); P(g, 10, 24, 3, 1, 'n');
      },
      store: g => { // 편의점: 뒤 매대 + 계산대 + 계산기
        box(g, 2, 2, 28, 15, 'N'); P(g, 3, 3, 26, 1, 'c');
        P(g, 3, 9, 26, 1, 'n'); P(g, 3, 15, 26, 1, 'n');
        const it = ['r', 'y', 'g', 'l', 'o', 'w', 'r', 'h'];
        for (let i = 0; i < 6; i++) { box(g, 4 + i * 4, 5, 4, 4, it[i]); }
        for (let i = 0; i < 6; i++) { box(g, 4 + i * 4, 11, 4, 4, it[(i + 3) % 8]); }
        box(g, 1, 18, 30, 12, 'w'); P(g, 2, 19, 28, 1, 'L'); P(g, 2, 23, 28, 2, 'r'); P(g, 2, 25, 28, 1, 'R'); P(g, 1, 30, 30, 1, 'd');
        box(g, 18, 11, 11, 8, 'E'); box(g, 20, 12, 7, 4, 'h'); P(g, 21, 13, 3, 1, 'G'); P(g, 19, 17, 9, 1, 'L');
        P(g, 22, 18, 3, 1, 'k');
        map(g, 6, 14, ['...kk...', '..kwwk..', '.kwwwwk.', 'kwkGGkwk', 'kwkGGkwk', '.kkkkkk.']);
      },
      delivery: g => { // 배달 스쿠터(옆모습, 오른쪽 보기) + 뒤 배달통
        P(g, 1, 30, 30, 1, 'd');
        box(g, 0, 4, 11, 12, 'o'); P(g, 1, 5, 9, 1, 'y'); P(g, 1, 14, 9, 1, 'O'); box(g, 2, 7, 7, 5, 'w'); P(g, 4, 8, 3, 3, 'r'); P(g, 5, 9, 1, 1, 'w');
        P(g, 0, 16, 12, 1, 'k');
        P(g, 10, 14, 9, 3, 'H'); P(g, 10, 14, 9, 1, 'k'); P(g, 10, 14, 1, 3, 'k'); P(g, 18, 14, 1, 3, 'k'); P(g, 11, 15, 6, 1, 'n');
        map(g, 2, 17, [
          'kkkkkkkkkkkkkkkkk.',
          'krrrrrrrrrrrrrrrrk',
          'kwrrrrrrrrrrrrrrRk',
          '.krrrrrrrrrrrrrRk.',
          '..kRRRk.....kRRk..',
          '...kkk.......kk...',
        ]);
        P(g, 15, 22, 8, 2, 'E'); P(g, 15, 22, 8, 1, 'L'); P(g, 15, 24, 8, 1, 'k');
        for (let y = 8; y <= 23; y++) { const x = 24 - Math.round((y - 8) * 3 / 15), wd = y < 13 ? 2 : 3 + Math.min(2, (y - 13) >> 2); P(g, x - wd + 1, y, 1, 1, 'k'); P(g, x - wd + 2, y, wd, 1, y < 13 ? 'E' : 'r'); P(g, x + 2, y, 1, 1, 'k'); if (y >= 13) P(g, x - wd + 2, y, 1, 1, 'w'); }
        P(g, 19, 7, 8, 2, 'k'); P(g, 19, 7, 2, 2, 'E');
        box(g, 25, 10, 4, 4, 'Y'); P(g, 26, 11, 1, 1, 'w');
        P(g, 20, 22, 9, 1, 'k'); P(g, 21, 23, 7, 1, 'r'); P(g, 20, 23, 1, 1, 'k'); P(g, 28, 23, 1, 1, 'k');
        disc(g, 7, 26, 3, 'E', 'k'); P(g, 7, 26, 1, 1, 'L');
        disc(g, 25, 26, 3, 'E', 'k'); P(g, 25, 26, 1, 1, 'L');
      },
    };
    const ACT = {
      rest: g => { // 침대에서 쉬기 + Zz
        P(g, 1, 30, 30, 1, 'd');
        box(g, 1, 12, 5, 18, 'n'); P(g, 2, 13, 3, 1, 'N');
        box(g, 26, 18, 5, 12, 'n'); P(g, 27, 19, 3, 1, 'N');
        box(g, 5, 22, 22, 5, 'N'); P(g, 6, 23, 20, 1, 'c');
        box(g, 5, 18, 8, 5, 'w');
        box(g, 11, 17, 16, 7, 'l'); P(g, 12, 18, 14, 1, 's'); P(g, 12, 20, 14, 1, 'S');
        disc(g, 9, 17, 3, 'p', 'k'); P(g, 6, 14, 6, 2, 'H'); P(g, 7, 13, 4, 1, 'k'); P(g, 6, 15, 1, 1, 'k'); P(g, 9, 18, 2, 1, 'k'); P(g, 11, 19, 1, 1, 'r');
        map(g, 15, 1, ['kkkk..........', '..k...........', '.k....kkk.....', 'kkkk....k.....', '.......k......', '......kkk.....']);
      },
      study: g => { // 펼친 책 + 오르는 차트 선
        box(g, 1, 19, 30, 10, 'b'); P(g, 2, 27, 28, 1, 'B');
        box(g, 2, 17, 14, 10, 'w'); box(g, 16, 17, 14, 10, 'w'); P(g, 15, 17, 2, 10, 'k');
        for (const y of [19, 21, 23]) { P(g, 4, y, 9, 1, 'L'); P(g, 18, y, 10, 1, 'L'); }
        P(g, 18, 23, 4, 1, 'y'); P(g, 1, 29, 30, 1, 'd');
        P(g, 2, 13, 26, 1, 'C'); P(g, 2, 2, 1, 12, 'C');
        line(g, 4, 13, 10, 8, 'G', 2); line(g, 10, 8, 14, 10, 'G', 2); line(g, 14, 10, 23, 3, 'G', 2);
        map(g, 20, 1, ['.kkkkk', '..kggk', '...kgk', '..kkgk', '.kk.kk']);
        P(g, 10, 8, 1, 1, 'h'); P(g, 14, 10, 1, 1, 'h');
      },
    };
    const ASSET = {
      daejang: g => { // 대장전자: 반도체 칩
        for (let i = 0; i < 5; i++) { const o = 9 + i * 3; P(g, o, 4, 2, 4, 'L'); P(g, o, 24, 2, 4, 'L'); P(g, 4, o, 4, 2, 'L'); P(g, 24, o, 4, 2, 'L');
          P(g, o, 4, 2, 1, 'E'); P(g, o, 27, 2, 1, 'E'); P(g, 4, o, 1, 2, 'E'); P(g, 27, o, 1, 2, 'E'); }
        box(g, 7, 7, 18, 18, 'E'); P(g, 8, 8, 16, 1, 'e'); P(g, 8, 8, 1, 16, 'e');
        box(g, 11, 11, 10, 10, 'b'); P(g, 12, 12, 8, 2, 'l'); P(g, 12, 12, 2, 2, 'S');
        P(g, 14, 15, 4, 1, 'S'); P(g, 15, 17, 2, 1, 'S');
        P(g, 9, 22, 2, 1, 'y');
      },
      buldak: g => { // 화끈식품: 그릇 위로 오르는 불꽃
        map(g, 6, 1, [
          '.........k..........',
          '........kok.........',
          '...k....koOk....k...',
          '..kok..kooOk...kok..',
          '..kook.koyoOk.koOk..',
          '..koyok.koyyOkkoOk..',
          '.kooyok.kyYyOkooOk..',
          '.koyYyokoyYYyOoyOk..',
          'koyyYyyoyYYYyoyyOk..',
          'koyYYYyyyYwYyyYyOk..',
          'koyYYwYyyYwYyYYyOOk.',
          '.kyYwwYyYwwwYyYwYOk.',
        ]);
        P(g, 2, 13, 28, 2, 'k'); P(g, 3, 14, 26, 1, 'w');
        map(g, 2, 15, [
          'kkkkkkkkkkkkkkkkkkkkkkkkkkkk',
          'krwwwwwwwwwwwwwwwwwwwwwwwwRk',
          '.krrrrrrrrrrrrrrrrrrrrrrrRk.',
          '.krrrrwrrrrrrwrrrrrrwrrrrRk.',
          '..krrrrrrrrrrrrrrrrrrrrrRk..',
          '...krrrrrrrrrrrrrrrrrrrRk...',
          '....kRRRRRRRRRRRRRRRRRRk....',
          '......kkkkkkkkkkkkkkkk......',
          '.......kRRRRRRRRRRRRk.......',
          '.......kkkkkkkkkkkkkk.......',
        ]);
      },
      hantang: g => { // 한탕바이오: 둥근 플라스크 + 거품
        P(g, 6, 30, 20, 1, 'd');
        box(g, 12, 1, 8, 4, 'N'); P(g, 13, 2, 6, 1, 'c');
        P(g, 12, 5, 8, 9, 'k'); P(g, 13, 5, 6, 9, 'S'); P(g, 14, 6, 1, 7, 'w');
        disc(g, 16, 20, 9, 'S', 'k');
        for (let y = 18; y <= 29; y++) for (let x = 6; x <= 26; x++) { const d = Math.hypot(x - 16, y - 20); if (d <= 8.5) P(g, x, y, 1, 1, y === 18 ? 'h' : 'g'); }
        for (let y = 20; y <= 29; y++) for (let x = 6; x <= 26; x++) { const d = Math.hypot(x - 16, y - 20); if (d > 7.5 && d <= 8.5 && x > 16 && y > 21) P(g, x, y, 1, 1, 'G'); }
        P(g, 10, 15, 2, 3, 'w'); P(g, 9, 17, 1, 2, 'w');
        disc(g, 13, 23, 1, 'h', 'h'); P(g, 19, 21, 2, 2, 'h'); P(g, 17, 26, 1, 1, 'h'); P(g, 21, 9, 2, 2, 'h'); P(g, 23, 6, 1, 1, 'h'); P(g, 21, 9, 1, 1, 'G');
      },
      coin: g => { // 달나라코인: 초승달이 새겨진 금화
        disc(g, 16, 16, 13, 'y', 'k');
        for (let y = -14; y <= 14; y++) for (let x = -14; x <= 14; x++) { const d = Math.hypot(x, y); if (d > 10.5 && d <= 12.5 && x + y > 4) P(g, 16 + x, 16 + y, 1, 1, 'O'); }
        for (let y = -14; y <= 14; y++) for (let x = -14; x <= 14; x++) { const d = Math.hypot(x, y); if (d > 10.5 && d <= 12.5 && x + y < -4) P(g, 16 + x, 16 + y, 1, 1, 'Y'); }
        for (let y = -11; y <= 11; y++) for (let x = -11; x <= 11; x++) { const d = Math.hypot(x, y); if (d > 9.5 && d <= 10.5) P(g, 16 + x, 16 + y, 1, 1, 'O'); }
        // 초승달
        for (let y = -7; y <= 7; y++) for (let x = -7; x <= 7; x++) {
          const a = Math.hypot(x, y) <= 6.5, b = Math.hypot(x - 3, y - 2) <= 4.8;
          if (a && !b) P(g, 15 + x, 15 + y, 1, 1, 'O');
        }
        sparkle(g, 20, 19, 'O'); P(g, 22, 13, 1, 1, 'O'); P(g, 23, 7, 1, 1, 'w'); P(g, 22, 8, 3, 1, 'w'); P(g, 23, 9, 1, 1, 'w'); P(g, 9, 9, 2, 1, 'w'); P(g, 8, 10, 1, 2, 'w');
      },
    };

    // ───── 주사위 (16×16) · 컵 (32×32) ─────
    const PIP = { 1: [[7, 6]], 2: [[4, 3], [10, 9]], 3: [[3, 3], [7, 6], [11, 9]], 4: [[4, 3], [10, 3], [4, 9], [10, 9]],
      5: [[3, 3], [11, 3], [7, 6], [3, 9], [11, 9]], 6: [[4, 2], [10, 2], [4, 6], [10, 6], [4, 10], [10, 10]] };
    function drawDie(g, v) {
      map(g, 0, 0, [
        '.kkkkkkkkkkkkkk.',
        'kwwwwwwwwwwwwwwk',
        'kwccccccccccccck',
        'kwccccccccccccck',
        'kwccccccccccccck',
        'kwccccccccccccck',
        'kwccccccccccccck',
        'kwccccccccccccck',
        'kwccccccccccccck',
        'kwccccccccccccck',
        'kwccccccccccccck',
        'kwccccccccccccck',
        'kCCCCCCCCCCCCCCk',
        'kddddddddddddddk',
        '.kkkkkkkkkkkkkk.',
        '................',
      ]);
      for (const [x, y] of PIP[v]) { if (v === 1) { P(g, x - 1, y - 1, 4, 4, 'r'); P(g, x - 1, y - 1, 1, 1, 'c'); P(g, x + 2, y - 1, 1, 1, 'c'); P(g, x - 1, y + 2, 1, 1, 'c'); P(g, x + 2, y + 2, 1, 1, 'c'); P(g, x, y, 1, 1, 'w'); } else P(g, x, y, 2, 2, 'k'); }
    }
    function drawCup(g) {
      P(g, 3, 30, 26, 1, 'd');
      for (let y = 3; y <= 26; y++) {
        const t = (y - 3) / 23, half = Math.round(7 + t * 5), l = 16 - half, r = 15 + half;
        P(g, l, y, 1, 1, 'k'); P(g, r, y, 1, 1, 'k'); P(g, l + 1, y, r - l - 1, 1, 'n');
        P(g, l + 2, y, 2, 1, 'N'); P(g, r - 3, y, 2, 1, 'H');
      }
      P(g, 9, 2, 14, 2, 'N'); P(g, 9, 2, 14, 1, 'k'); P(g, 8, 3, 1, 1, 'k'); P(g, 23, 3, 1, 1, 'k'); P(g, 11, 3, 6, 1, 'C');
      { const y = 7, half = Math.round(7 + ((y - 3) / 23) * 5); P(g, 17 - half, y, 2 * half - 2, 1, 'H'); for (let x = 18 - half; x < 15 + half; x += 3) P(g, x, y + 1, 1, 1, 'H'); }
      box(g, 2, 26, 28, 4, 'N'); P(g, 3, 27, 26, 1, 'C'); P(g, 3, 28, 26, 1, 'n');
      P(g, 7, 11, 1, 6, 'C'); P(g, 6, 19, 1, 4, 'C');
    }

    // ───── 감싸기 (이름별 캐시) ─────
    const cache = {};
    function img(key, w, h, alt, draw) {
      if (!cache[key]) {
        const [c, g] = mk(w, h); const saved = MAP; draw(g); MAP = saved;
        cache[key] = `<img class="px" alt="${alt}" src="${c.toDataURL()}" width="${w}" height="${h}">`;
      }
      return cache[key];
    }
    const SCENE_ALT = { morning: '아침의 서울역 광장 벤치', day: '낮의 서울역 광장 벤치', evening: '저녁의 서울역 광장 벤치', night: '밤의 서울역 광장 벤치' };
    const THUMB_NAME = ['서울역', '찜질방', '고시원', '원룸', '내 집', '아파트', '주택', '별장', '호텔', '한국 최고 부자'];
    const JOB_NAME = { flyer: '전단지 알바', loading: '상하차 알바', store: '편의점 알바', delivery: '배달 알바' };
    const ACT_NAME = { rest: '쉬기', study: '공부' };
    const ASSET_NAME = { daejang: '대장전자', buldak: '화끈식품', hantang: '한탕바이오', coin: '달나라코인' };

    const old = { scene: Old.scene, thumb: Old.thumb, job: Old.job, act: Old.act, asset: Old.asset, die: Old.die, cup: Old.cup };
    const safe = (name, fn) => function () { try { const r = fn.apply(this, arguments); if (r != null) return r; } catch (e) { if (window.console) console.warn('pxart', name, e); } return old[name] ? old[name].apply(this, arguments) : ''; };

    Old.scene = safe('scene', (tier, phase) => {
      const t = Math.round(Number(tier) || 0);
      if (t !== 0) return null; // 다른 집은 아직 예전 그림 (2단계)
      const key = PHASES[phase] ? phase : 'day';
      return img('scene0_' + key, 128, 72, SCENE_ALT[key], g => sceneStation(g, key));
    });
    Old.thumb = safe('thumb', (tier, gray) => {
      const t = Math.max(0, Math.min(9, Math.round(Number(tier) || 0)));
      return img('thumb' + t + (gray ? 'g' : ''), 32, 32, THUMB_NAME[t] + (gray ? ' (잠김)' : ''), g => { MAP = gray ? GRAY : null; BUILD[t](g); MAP = null; });
    });
    Old.job = safe('job', id => JOB[id] ? img('job_' + id, 32, 32, JOB_NAME[id], JOB[id]) : null);
    Old.act = safe('act', id => ACT[id] ? img('act_' + id, 32, 32, ACT_NAME[id], ACT[id]) : null);
    Old.asset = safe('asset', id => ASSET[id] ? img('asset_' + id, 32, 32, ASSET_NAME[id], ASSET[id]) : null);
    Old.die = safe('die', v => { const k = Math.max(1, Math.min(6, Math.round(Number(v) || 1))); return img('die' + k, 16, 16, '주사위 ' + k, g => drawDie(g, k)); });
    Old.cup = safe('cup', () => img('cup', 32, 32, '주사위 컵', drawCup));

    // 2단계에서 다시 쓸 그리는 함수들
    window.PxArt = {
      COL, XC, GRAY, PHASES, HERO, mk, P, box, map, disc, line, dither, sparkle,
      setMap: m => { MAP = m || null; },
      drawHero, drawHeroTop, drawHeroLegs, drawStatusWin, drawBenchBack, drawBenchSeat, drawLamp, lightPool,
      drawPigeon, drawTree, drawFlyers, drawCloud, drawSky, drawStars, drawMoon, drawStation, drawTower, drawFar,
      sceneStation, drawBuilding: (g, t) => BUILD[t](g), drawDie, drawCup, JOB, ACT, ASSET,
    };
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('pxart.js 를 불러오지 못해 예전 그림을 씁니다', e);
  }
})();
