// PROTOTYPE - NOT FOR PRODUCTION
// 픽셀 그림 — 하늘 창 · 장면(서울역) · 카드 그림(알바 · 행동 · 종목) · 로드맵 건물 · 주사위 · 컵.
// 불려 올 때 window.Art 의 scene · thumb · job · act · asset · die · cup 을 감싼다.
// 픽셀 그림이 있으면 <img class="px">(원래 점 크기)를, 없으면 예전 벡터 그림(art.js)을 돌려준다.
// 주거 장면에는 window.PX와 XC를 쓰고 하늘 창에는 시간대별 팔레트를 쓴다.
// 오류가 나도 예전 Art 가 남게 전체를 try/catch 로 싼다.
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
    // 주인공의 옷: 산 옷(WEAR) > 그 장면의 옷(찜질복 · 집 옷 — MAP.outfit) > 고른 후드 색(LOOK). 그 위에 밤 색 바꾸기(MAP)가 덮인다
    let HERO_ON = false, WEAR = null, LOOK = null, WKEY = '_0';
    const LOOKS = [null, { b: 'R', l: 'r' }, { b: 'G', l: 'g' }, { b: 'E', l: 'e' }]; // 후드 색: 파랑(처음) · 빨강 · 초록 · 회색
    const WEARS = { vest: { b: 'O', l: 'o' }, padding: { b: 'k', l: 'E', E: 'k' }, suit: { b: 'k', l: 'B', E: 'B' }, gold: { b: 'O', l: 'y', E: 'o' } }; // 작업 조끼 · 롱패딩 · 정장 · 금빛 운동복
    function setWear(id, look) { WEAR = WEARS[id] || null; LOOK = LOOKS[look | 0] || null; WKEY = (WEAR ? id : '') + '_' + (look | 0); }
    function withWear(wear, look, draw) {
      if (wear == null) return draw();
      const w0 = WEAR, l0 = LOOK, k0 = WKEY;
      setWear(wear, look);
      try { return draw(); } finally { WEAR = w0; LOOK = l0; WKEY = k0; }
    }
    function P(g, x, y, w, h, k) {
      let kk = k;
      if (HERO_ON) { const o = WEAR || (MAP && MAP.outfit ? MAP : LOOK); if (o && o[kk]) kk = o[kk]; if (MAP && !MAP.outfit && MAP[kk]) kk = MAP[kk]; }
      else if (MAP && MAP[kk]) kk = MAP[kk];
      g.fillStyle = COL[kk] || kk; g.fillRect(x, y, w, h);
    }
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
    function drawHeroTop(g, x, y, face) { HERO_ON = true; try { heroAhoge(g, x, y); map(g, x, y, heroRows(face).slice(0, 25)); } finally { HERO_ON = false; } }
    function drawHeroLegs(g, x, y) { HERO_ON = true; try { map(g, x, y + 25, HERO.slice(25)); } finally { HERO_ON = false; } }
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
      P(g, 34, 63, 56, 2, 'd');
      drawBenchBack(g, 34, 39, 54);
      MAP = null;
      // 주인공 (밤에도 색 그대로)
      drawHeroTop(g, 44, 29, 'calm');
      MAP = ph.map;
      drawBenchSeat(g, 34, 53, 54);
      MAP = null;
      drawHeroLegs(g, 44, 29);
      MAP = ph.map;
      drawFlyers(g, 70, 48);
      drawPigeon(g, 24, 59, false); drawPigeon(g, 98, 61, true);
      MAP = null;
      drawLamp(g, 16, 14, 64, ph.lamp);
      // 떠 있는 상태창 + 반짝
      drawStatusWin(g, 70, 15, 28, 20, key === 'night' ? 'l' : 'w');
      const sp = key === 'night' ? 'Y' : 'w';
      sparkle(g, 103, 14, sp); sparkle(g, 66, 11, sp); sparkle(g, 104, 32, sp);
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
      // 2026-11-21: 새 일 여섯
      cafe: g => { // 카페: 김이 오르는 테이크아웃 컵 + 원두
        P(g, 6, 30, 21, 1, 'd');
        map(g, 11, 0, ['..k....k..', '.k....k...', '..k....k..', '.k....k...', '..k....k..']);
        box(g, 6, 6, 20, 5, 'w'); P(g, 7, 7, 18, 1, 'L'); P(g, 8, 5, 16, 1, 'k'); P(g, 9, 6, 14, 1, 'w');
        map(g, 7, 11, [
          'kkkkkkkkkkkkkkkkkk',
          'kwwwwwwwwwwwwwwwLk',
          '.kwwwwwwwwwwwwwLk.',
          '.kNNNNNNNNNNNNNnk.',
          '.kNNNNNkkkkNNNNnk.',
          '.kNNNNkGGGGkNNNnk.',
          '.kNNNNkGhhGkNNNnk.',
          '.kNNNNkGGGGkNNNnk.',
          '.kNNNNNkkkkNNNNnk.',
          '..kNNNNNNNNNNNnk..',
          '..kwwwwwwwwwwwLk..',
          '..kwwwwwwwwwwwLk..',
          '..kwwwwwwwwwwwLk..',
          '...kwwwwwwwwwLk...',
          '...kwwwwwwwwwLk...',
          '...kLLLLLLLLLLk...',
          '....kkkkkkkkkk....',
        ]);
        map(g, 1, 24, ['.kkk.', 'knHnk', 'knHnk', '.kkk.']); map(g, 26, 22, ['.kkk.', 'knHnk', 'knHnk', '.kkk.']);
      },
      tutor: g => { // 과외: 채점한 시험지 + 빨간 색연필
        P(g, 4, 30, 22, 1, 'd');
        box(g, 3, 2, 22, 27, 'w'); P(g, 4, 3, 20, 4, 'S'); P(g, 6, 4, 9, 2, 'b'); P(g, 23, 4, 1, 24, 'L');
        for (const y of [10, 15, 20, 25]) { P(g, 6, y, 8, 1, 'E'); P(g, 6, y + 2, 5, 1, 'L'); }
        map(g, 15, 8, ['.rrrr.', 'r....r', 'r....r', 'r....r', '.rrrr.']);
        map(g, 15, 14, ['....rr', '...rr.', 'r.rr..', 'rrr...', '.r....']);
        map(g, 15, 20, ['.rrrr.', 'r....r', 'r....r', 'r....r', '.rrrr.']);
        map(g, 17, 14, [
          '...........kk.',
          '..........kRrk',
          '.........kRrrk',
          '........kRrrk.',
          '.......kRrrk..',
          '......kRrrk...',
          '.....kRrrk....',
          '....kRrrk.....',
          '...kRrrk......',
          '..kpprk.......',
          '.kpppk........',
          '.kkpk.........',
          'kk.k..........',
        ]);
      },
      driver: g => { // 대리: 운전대 + 초승달
        P(g, 5, 30, 22, 1, 'd');
        for (let y = -13; y <= 13; y++) for (let x = -13; x <= 13; x++) { const d = Math.hypot(x, y); if (d <= 12.5 && d > 7.5) P(g, 15 + x, 17 + y, 1, 1, d > 11.5 || d <= 8.5 ? 'k' : x + y < -3 ? 'e' : 'E'); }
        P(g, 6, 15, 18, 1, 'k'); P(g, 7, 16, 16, 3, 'E'); P(g, 6, 19, 18, 1, 'k'); P(g, 13, 19, 1, 8, 'k'); P(g, 14, 19, 3, 7, 'E'); P(g, 17, 19, 1, 8, 'k');
        disc(g, 15, 17, 3, 'L', 'k'); P(g, 14, 16, 2, 1, 'w');
        map(g, 22, 0, ['...kkkk.', '..kyyk..', '.kyyk...', '.kyyk...', '.kyyk...', '.kyyyk..', '..kyyykk', '...kkkk.']);
        P(g, 3, 3, 1, 1, 'y'); P(g, 8, 1, 1, 1, 'w'); sparkle(g, 19, 3, 'Y');
      },
      lecture: g => { // 강연: 연단과 마이크 + 말풍선
        P(g, 4, 30, 24, 1, 'd');
        map(g, 5, 14, [
          'kkkkkkkkkkkkkkkkkkkkkk',
          'kNNNNNNNNNNNNNNNNNNNNk',
          'kkkkkkkkkkkkkkkkkkkkkk',
          '.knnnnnnnnnnnnnnnnnnk.',
          '.knnnnnnkkkkkknnnnnnk.',
          '.knnnnnkyyyyyyknnnnnk.',
          '.knnnnnkyYyyyyknnnnnk.',
          '.knnnnnkyyyyyyknnnnnk.',
          '.knnnnnnkkkkkknnnnnnk.',
          '.knnnnnnnnnnnnnnnnnnk.',
          '.knnnnnnnnnnnnnnnnnnk.',
          '.knnnnnnnnnnnnnnnnnnk.',
          '.knnnnnnnnnnnnnnnnnnk.',
          '.kHHHHHHHHHHHHHHHHHHk.',
          '.kkkkkkkkkkkkkkkkkkkk.',
        ]);
        P(g, 10, 8, 1, 6, 'k'); P(g, 11, 8, 1, 6, 'E'); box(g, 8, 3, 6, 6, 'E'); P(g, 9, 4, 4, 1, 'L'); P(g, 9, 6, 4, 1, 'e');
        map(g, 16, 0, [
          '.kkkkkkkkkkkkk.',
          'kwwwwwwwwwwwwwk',
          'kwbbbbwwbbbbbwk',
          'kwwwwwwwwwwwwwk',
          'kwbbbbbbbwwwwwk',
          'kwwwwwwwwwwwwwk',
          '.kkkkwwkkkkkkk.',
          '....kwk........',
          '....kk.........',
        ]);
      },
      tv: g => { // 방송: 삼각대 위의 방송 카메라 + 빨간 불
        P(g, 4, 30, 24, 1, 'd');
        box(g, 3, 8, 19, 13, 'E'); P(g, 4, 9, 17, 2, 'e'); P(g, 4, 18, 17, 2, 'k'); box(g, 5, 12, 8, 5, 'S'); P(g, 6, 13, 3, 1, 'w');
        map(g, 21, 9, ['kkkkkkkk', 'kEEEkllk', 'kEEkllbk', 'kEEkllbk', 'kEEkllbk', 'kEEkllbk', 'kEEkllbk', 'kEEkbbbk', 'kEEEkbbk', 'kkkkkkkk']);
        box(g, 8, 3, 8, 6, 'E'); disc(g, 17, 5, 2, 'r', 'k'); P(g, 16, 4, 1, 1, 'w'); P(g, 20, 2, 1, 1, 'r'); P(g, 21, 5, 2, 1, 'r'); P(g, 20, 8, 1, 1, 'r');
        P(g, 11, 21, 3, 3, 'k'); line(g, 12, 23, 5, 30, 'k', 1); line(g, 13, 23, 20, 30, 'k', 1); P(g, 12, 23, 1, 7, 'k'); P(g, 4, 30, 3, 1, 'k'); P(g, 19, 30, 3, 1, 'k');
      },
      advise: g => { // 자문: 서류 가방 + 오르는 화살표
        P(g, 3, 30, 26, 1, 'd');
        map(g, 10, 7, ['.kkkkkkkkkk.', 'kNNkkkkkkNNk', 'kNk......kNk']);
        box(g, 2, 10, 28, 19, 'n'); P(g, 3, 11, 26, 2, 'N'); P(g, 3, 19, 26, 1, 'k'); P(g, 3, 20, 26, 1, 'H'); P(g, 28, 13, 1, 15, 'H');
        box(g, 13, 17, 6, 6, 'y'); P(g, 15, 19, 2, 2, 'O');
        map(g, 17, 0, ['....kkkkkkk', '.....kggggk', '......kgggk', '.....kgkggk', '....kgk.kgk', '...kgk...kk', '..kgk......', '.kgk.......', 'kgk........', 'kk.........']);
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
      bank: g => { // 튼튼은행: 박공지붕 아래 기둥 넷
        map(g, 4, 4, [
          '...........kk...........',
          '.........kkBBkk.........',
          '.......kkBBllBBkk.......',
          '.....kkBBllyyllBBkk.....',
          '...kkBBllllyyllllBBkk...',
          '.kkBBllllllllllllllBBkk.',
          'kkkkkkkkkkkkkkkkkkkkkkkk',
          'kwwwwwwwwwwwwwwwwwwwwwwk',
          'kkkkkkkkkkkkkkkkkkkkkkkk',
          '.kwLk.kwLk....kwLk.kwLk.',
          '.kwLk.kwLk....kwLk.kwLk.',
          '.kwLk.kwLk.kk.kwLk.kwLk.',
          '.kwLk.kwLkkNNkkwLk.kwLk.',
          '.kwLk.kwLkkNNkkwLk.kwLk.',
          '.kwLk.kwLkkNNkkwLk.kwLk.',
          '.kwLk.kwLkkNykkwLk.kwLk.',
          '.kwLk.kwLkkNNkkwLk.kwLk.',
          'kkkkkkkkkkkkkkkkkkkkkkkk',
          'kwwwwwwwwwwwwwwwwwwwwwwk',
          'kLLLLLLLLLLLLLLLLLLLLLLk',
          'kkkkkkkkkkkkkkkkkkkkkkkk',
        ]);
        P(g, 2, 25, 28, 1, 'd'); P(g, 3, 26, 26, 1, 'd');
      },
      battery: g => { // 번쩍배터리: 초록 전지 + 번개
        P(g, 4, 28, 24, 1, 'd');
        box(g, 3, 9, 23, 15, 'g'); P(g, 4, 10, 21, 2, 'h'); P(g, 4, 21, 21, 2, 'G'); P(g, 4, 12, 1, 9, 'h');
        box(g, 25, 13, 4, 7, 'L'); P(g, 26, 14, 2, 1, 'w');
        P(g, 9, 12, 1, 9, 'G'); P(g, 20, 12, 1, 9, 'G');
        map(g, 11, 11, ['....kk.', '...kyk.', '..kyyk.', '.kyyykk', 'kyyyyyk', 'kkyyyk.', '.kyyk..', '.kyk...', '.kk....']);
        P(g, 12, 15, 1, 1, 'Y'); sparkle(g, 27, 6, 'y'); P(g, 6, 5, 1, 1, 'y');
      },
      game: g => { // 꿀잼게임즈: 게임패드
        P(g, 6, 26, 20, 1, 'd');
        map(g, 4, 9, [
          '....kkkkkkkkkkkkkkkk....',
          '..kkbbbbbbbbbbbbbbbbkk..',
          '.kbbllllllllllllllllbbk.',
          'kbblbbbbbbbbbbbbbbbblbbk',
          'kbbbbkkbbbbbbbbbbrrbbbbk',
          'kbbkkkkkkbbbbbbyybrrbbbk',
          'kbbkkkkkkbbbbbbyybbbbbbk',
          'kbbbbkkbbbbwwbbbbbbbbbbk',
          'kbbbbbbbbbbbbbbbbbbbbbbk',
          'kbbbBBBBkkkkkkkkBBBBbbbk',
          '.kbBBBBk........kBBBBbk.',
          '.kkBBkk..........kkBBkk.',
          '..kkkk............kkkk..',
        ]);
        sparkle(g, 26, 6, 'y'); P(g, 5, 6, 1, 1, 'y');
      },
      build: g => { // 뚝딱건설: 안전모 + 벽돌
        map(g, 5, 5, [
          '.......kkkkkkkk.......',
          '.....kkyyyyyyyykk.....',
          '....kyyYYyykkyyyyk....',
          '...kyyYYyyykkyyyyyk...',
          '...kyyYyyyykkyyyyyk...',
          '..kyyyyyyyykkyyyyyyk..',
          '..kyyyyyyyyyyyyyyyyk..',
          '.kkkkkkkkkkkkkkkkkkkk.',
          'koooooooooooooooooooOk',
          '.kkkkkkkkkkkkkkkkkkkk.',
        ]);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const x = 4 + c * 6 + (r % 2 ? 3 : 0), y = 18 + r * 4; if (x + 6 <= 29) box(g, x, y, 6, 4, r === 1 ? 'N' : 'o'); }
        P(g, 3, 30, 26, 1, 'd');
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
      // 2026-11-21: 새 종목 여덟
      etf: g => { // 다담아ETF: 네 조각 원 그래프
        for (let y = -13; y <= 13; y++) for (let x = -13; x <= 13; x++) {
          const d = Math.hypot(x, y); if (d > 12.5) continue;
          const col = d > 11.5 ? 'k' : (x === 0 || y === 0) ? 'k' : x > 0 && y < 0 ? 'r' : x > 0 ? 'y' : y > 0 ? 'g' : 'b';
          P(g, 16 + x, 16 + y, 1, 1, col);
        }
        P(g, 18, 6, 4, 1, 'w'); P(g, 21, 7, 2, 1, 'w'); P(g, 7, 9, 3, 1, 'l'); P(g, 6, 10, 1, 2, 'l'); disc(g, 16, 16, 3, 'w', 'k');
      },
      gold: g => { // 황금ETF: 쌓은 금괴 셋
        P(g, 2, 29, 28, 1, 'd');
        const bar = (x, y) => map(g, x, y, ['..kkkkkkkkkk..', '.kYYYYYYYYYYk.', 'kYyyyyyyyyyyOk', 'kyyyyyyyyyyyOk', 'kyyyyyyyyyyOOk', 'kOOOOOOOOOOOOk', 'kkkkkkkkkkkkkk']);
        bar(2, 21); bar(16, 21); bar(9, 14);
        sparkle(g, 24, 9, 'Y'); P(g, 6, 9, 1, 1, 'y'); P(g, 27, 15, 1, 1, 'w');
      },
      insure: g => { // 든든보험: 큰 우산
        map(g, 2, 3, [
          '............kkkk............',
          '.........kkkbbllkkk.........',
          '.......kkbbbbbllllbkk.......',
          '.....kkbbbbbbbbllllbbkk.....',
          '....kbbbbbbbbbbbllllbbbk....',
          '...kbbbbbbbbbbbbbllllbbbk...',
          '..kbbbbbbbbbbbbbbblllbbbbk..',
          '.kbbbbbbbbbbbbbbbbbllbbbbBk.',
          '.kbbbbbbbbbbbbbbbbbbbbbbBBk.',
          'kbbbbkkbbbbbbkkbbbbbbkkbbBBk',
          'kkkkk..kkkkkk..kkkkkk..kkkkk',
        ]);
        P(g, 15, 13, 2, 13, 'k'); P(g, 15, 13, 1, 13, 'E'); map(g, 10, 25, ['k....kk', 'k....kk', 'kk..kk.', '.kkkk..']);
        P(g, 15, 1, 2, 2, 'k');
      },
      air: g => { // 날개항공: 오른쪽 위로 나는 여객기
        map(g, 1, 3, [
          '......................kkkk....',
          '....................kkwwwk....',
          '..................kkwwwwLk....',
          '.......kkkk.....kkwwwsswLk....',
          '.......kbbbk..kkwwwwsswLk.....',
          '........kbbbkkwwwwwwwwLk......',
          '........kkbbbwwwwwwwwLkk......',
          '......kkwwwwwwwwwwwwLk........',
          '....kkwwwwwwwwwwwwwwbkkkkkk...',
          '..kkwwwwwwwwwwwwwwbbbbbbbbbk..',
          '.kwwwwwwwwwwwwwkkkkbbbbbbbkk..',
          'kLLLLLLLLLLLkkk....kkkkkkk....',
          '.kkkkkkkkkkk..................',
        ]);
        P(g, 4, 22, 6, 1, 'S'); P(g, 1, 25, 9, 1, 'S'); P(g, 6, 28, 5, 1, 'S');
      },
      energy: g => { // 훈훈에너지: 가스 불꽃
        P(g, 5, 30, 22, 1, 'd');
        map(g, 8, 1, [
          '.......kk.......',
          '......kook......',
          '......koook.....',
          '.....koooook....',
          '....kooyyoook...',
          '...kooyyyyook...',
          '...kooyyyyyook..',
          '..kooyyYYyyook..',
          '..koyyYYYYyyok..',
          '.kooyyYwwYyyook.',
          '.kooyYYwwYYyook.',
          '.kooyYwwwwYyook.',
          '.kkoyYwllwYyokk.',
          '..koylllllyyok..',
          '...kklllllkkk...',
          '.....kkkkk......',
        ]);
        box(g, 6, 18, 20, 4, 'E'); P(g, 7, 19, 18, 1, 'L'); box(g, 9, 22, 14, 7, 'e'); P(g, 10, 23, 12, 1, 'L'); P(g, 13, 25, 6, 2, 'k');
      },
      defense: g => { // 방패방산: 별이 새겨진 방패
        map(g, 4, 2, [
          '.kkkkkkkkkkkkkkkkkkkkkk.',
          'kllllllllllllBBBBBBBBBBk',
          'klbbbbbbbbbbbBBbbbbbbbBk',
          'klbbbbbbbbbbbBBbbbbbbbBk',
          'klbbbbbbbbbyyBBbbbbbbbBk',
          'klbbbbbbbbyyyyBbbbbbbbBk',
          'klbbbbbbyyyyyyyybbbbbbBk',
          'klbbbbyyyyyyyyyyyybbbbBk',
          'klbbbbbbyyyyyyyybbbbbbBk',
          'klbbbbbbbyyyyyybbbbbbbBk',
          'klbbbbbbbyyybyyybbbbbbBk',
          'klbbbbbbyyybbbyyybbbbbBk',
          '.klbbbbbbbbbBBbbbbbbbBk.',
          '.klbbbbbbbbbBBbbbbbbbBk.',
          '..klbbbbbbbbBBbbbbbbBk..',
          '..klbbbbbbbbBBbbbbbbBk..',
          '...klbbbbbbbBBbbbbbBk...',
          '....klbbbbbbBBbbbbBk....',
          '.....kklbbbbBBbbBkk.....',
          '.......kklbbBBBkk.......',
          '.........kkBBkk.........',
          '...........kk...........',
        ]);
        P(g, 6, 27, 20, 1, 'd');
      },
      inv: g => { // 거꾸로ETF: 내려가는 화살표 차트
        box(g, 2, 3, 28, 24, 'w'); P(g, 3, 4, 26, 1, 'L'); for (const y of [10, 16, 22]) P(g, 4, y, 24, 1, 'L');
        line(g, 5, 8, 11, 12, 'b', 2); line(g, 11, 12, 15, 10, 'b', 2); line(g, 15, 10, 24, 20, 'b', 2);
        map(g, 19, 16, ['......k', '.....kb', '....kbb', '...kbbb', '..kbbbb', '.kbbbbb', 'kkkkkkk']);
        P(g, 2, 28, 28, 1, 'd'); map(g, 5, 19, ['kkkkkkk', 'k.....k', 'k.kkk.k', 'k.....k', 'kkkkkkk'].map(r => r.replace(/k/g, 'E')));
      },
      doge: g => { // 멍멍코인: 강아지가 새겨진 금화
        disc(g, 16, 16, 13, 'y', 'k');
        for (let y = -14; y <= 14; y++) for (let x = -14; x <= 14; x++) { const d = Math.hypot(x, y); if (d > 10.5 && d <= 12.5 && x + y > 4) P(g, 16 + x, 16 + y, 1, 1, 'O'); if (d > 10.5 && d <= 12.5 && x + y < -4) P(g, 16 + x, 16 + y, 1, 1, 'Y'); }
        map(g, 8, 8, [
          'kkk.........kkk.',
          'kNNk.......kNNk.',
          'kNNNkkkkkkkNNNk.',
          'kNNNNNNNNNNNNNk.',
          '.kNNNNNNNNNNNk..',
          '.kNkkNNNNNkkNk..',
          '.kNkkNNNNNkkNk..',
          '.kNNNNNNNNNNNk..',
          '.kNNNwwkkwwNNk..',
          '.kNNwwwkkwwwNk..',
          '..kNwwwwwwwNk...',
          '..kNNwkrrkwNk...',
          '...kNNwrrwNk....',
          '....kkkkkkk.....',
        ]);
      },
    };

    // ───── 상가 · 건물 다섯 (32×32): 몸통 · 창 · 차양 · 지붕 ─────
    function drawProp(g, o) {
      const base = 28;
      P(g, 1, base + 1, 30, 2, 'e'); P(g, 1, base + 1, 30, 1, 'L');
      box(g, o.x, o.top, o.w, base - o.top + 1, o.wall); P(g, o.x + 1, o.top + 1, o.w - 2, 1, 'w'); P(g, o.x + o.w - 2, o.top + 2, 1, base - o.top - 2, sh(o.wall));
      const step = Math.floor((o.w - 3) / o.cols);
      for (let wy = o.top + 3, f = 0; wy + 3 <= base - (o.awning ? 9 : 7); wy += 4, f++) for (let c = 0; c < o.cols; c++) box(g, o.x + 2 + c * step, wy, 3, 3, (f + c) % 3 === 1 ? 'Y' : 'S');
      if (o.awning) { for (let i = 0; i < o.w + 2; i++) P(g, o.x - 1 + i, base - 7, 1, 2, i % 4 < 2 ? o.awning : 'w'); P(g, o.x - 1, base - 5, o.w + 2, 1, 'k'); P(g, o.x - 1, base - 8, o.w + 2, 1, 'k'); }
      box(g, o.x + (o.w >> 1) - 2, base - 4, 5, 5, 'N'); P(g, o.x + (o.w >> 1) + 1, base - 2, 1, 1, 'y');
      if (o.awning) { box(g, o.x + 1, base - 4, 4, 3, 'S'); box(g, o.x + o.w - 5, base - 4, 4, 3, 'S'); }
      P(g, o.x - 1, o.top - 2, o.w + 2, 3, 'k'); P(g, o.x, o.top - 1, o.w, 1, o.roof);
      if (o.ant) { P(g, o.x + (o.w >> 1), o.top - 7, 1, 5, 'k'); P(g, o.x + (o.w >> 1) - 1, o.top - 8, 3, 1, 'r'); }
      if (o.sign) { box(g, o.x + 2, o.top + 2, o.w - 4, 4, o.sign); P(g, o.x + 4, o.top + 3, o.w - 8, 1, 'w'); }
    }
    const PROP = {
      stall: g => drawProp(g, { x: 8, w: 16, top: 15, wall: 'c', cols: 3, awning: 'r', roof: 'N', sign: 'r' }),
      shop: g => drawProp(g, { x: 5, w: 22, top: 10, wall: 'C', cols: 4, awning: 'b', roof: 'n' }),
      bldg: g => drawProp(g, { x: 8, w: 16, top: 5, wall: 'L', cols: 3, awning: 'g', roof: 'E' }),
      office: g => drawProp(g, { x: 4, w: 24, top: 4, wall: 's', cols: 5, roof: 'B' }),
      tower: g => drawProp(g, { x: 10, w: 13, top: 9, wall: 'l', cols: 2, roof: 'B', ant: true }),
    };
    const PROP_NAME = { stall: '골목 상가 한 칸', shop: '역 앞 상가', bldg: '꼬마빌딩', office: '오피스 빌딩', tower: '랜드마크 타워' };

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

    // ═════ 실내 (2단계) ═════
    const SHADE = { o: 'O', g: 'G', r: 'R', b: 'B', l: 'b', N: 'n', n: 'H', y: 'o', s: 'l', c: 'C', C: 'd', d: 'N', p: 'P', w: 'L', L: 'e', e: 'E', h: 'g', S: 's', Y: 'y', q: 's', P: 'n' };
    const sh = k => SHADE[k] || 'k';
    const isLit = key => key === 'evening' || key === 'night';
    function drawRoom(g, o) {
      const W = o.w || 128, H = o.h || 72, fy = o.floorY || 54;
      P(g, 0, 0, W, fy, o.wall);
      if (o.wallLine) for (let x = o.wallLine[1] - 1; x < W; x += o.wallLine[1]) P(g, x, 0, 1, fy, o.wallLine[0]);
      if (o.ceil) { P(g, 0, 0, W, 3, o.ceil); P(g, 0, 3, W, 1, 'k'); }
      P(g, 0, fy, W, H - fy, o.floor);
      if (o.floorLine) { let r = 0; for (let y = fy + 3; y < H; y += o.floorLine[1], r++) { P(g, 0, y, W, 1, o.floorLine[0]); for (let x = (r % 2) * 9 + 4; x < W; x += 18) P(g, x, y - o.floorLine[1] + 1 < fy ? fy + 1 : y - o.floorLine[1] + 1, 1, y - Math.max(fy + 1, y - o.floorLine[1] + 1), o.floorLine[0]); } }
      P(g, 0, fy - 2, W, 2, o.trim || 'w'); P(g, 0, fy, W, 1, 'k');
    }
    const WIN_SKY = { morning: ['q', 'S', 'Y', 'p'], day: ['s', 's', 'q', 'S'], evening: ['duskHi', 'dusk', 'o', 'y'], night: ['nite0', 'nite1', 'nite1', 'B'] };
    function drawWindow(g, x, y, w, h, key, o) {
      o = o || {}; const fr = o.frame || 'w', ix = x + 2, iy = y + 2, iw = w - 4, ih = h - 4, s = WIN_SKY[key] || WIN_SKY.day;
      const saved = MAP; MAP = null;
      box(g, x, y, w, h, fr);
      for (let i = 0; i < 4; i++) { const y0 = iy + Math.floor(ih * i / 4), y1 = iy + Math.floor(ih * (i + 1) / 4); P(g, ix, y0, iw, y1 - y0, s[i]); if (i) dither(g, ix, y0, iw, 1, s[i - 1], 0); }
      if (key === 'night') {
        let r = x * 7 + y; for (let i = 0; i < Math.max(2, (iw * ih) >> 5); i++) { r = (r * 73 + 19) % 997; P(g, ix + r % iw, iy + (r >> 3) % Math.max(1, ih >> 1), 1, 1, i % 3 ? 'w' : 'Y'); }
        if (iw > 8) { disc(g, ix + iw - 4, iy + 3, 2, 'Y', 'Y'); P(g, ix + iw - 3, iy + 1, 2, 2, 'nite0'); }
      } else if (key === 'day') { if (iw > 14) { P(g, ix + 2, iy + 3, 7, 2, 'w'); P(g, ix + 3, iy + 2, 4, 1, 'w'); } }
      else if (iw > 8) disc(g, ix + Math.floor(iw * .3), iy + ih - (key === 'evening' ? 4 : 6), 2, 'Y', 'y');
      const lit = isLit(key) ? 'Y' : null;
      if (o.view === 'city') {
        const fc = { morning: 'P', day: 'l', evening: 'duskHi', night: 'nite0' }[key] || 'l';
        let xx = ix, r = 3;
        while (xx < ix + iw) { r = (r * 31 + 7) % 23; const bw = 4 + r % 4, bh = Math.max(3, Math.floor(ih * (.25 + (r % 5) * .08))), ww = Math.min(bw, ix + iw - xx);
          P(g, xx, iy + ih - bh, ww, bh, fc); if (lit) for (let yy = iy + ih - bh + 1; yy < iy + ih - 1; yy += 2) for (let x2 = xx + 1; x2 < xx + ww - 1; x2 += 2) if ((x2 + yy + r) % 3) P(g, x2, yy, 1, 1, lit);
          xx += bw + 1; }
      } else if (o.view === 'sea') {
        const hz = iy + Math.floor(ih * .6), sc = { morning: 's', day: 'b', evening: 'o', night: 'B' }[key] || 'b';
        P(g, ix, hz, iw, iy + ih - hz, sc); for (let yy = hz + 2; yy < iy + ih; yy += 2) dither(g, ix, yy, iw, 1, key === 'night' ? 'nite1' : 'w', yy & 2 ? 1 : 0);
      }
      if (!isLit(key) && iw > 6) { P(g, ix + iw - 4, iy + 1, 1, 1, 'w'); P(g, ix + iw - 5, iy + 2, 1, 1, 'w'); P(g, ix + iw - 6, iy + 3, 1, 1, 'w'); }
      if (o.cross !== false) { const cx = x + Math.floor(w / 2) - 1; P(g, cx, y + 1, 2, h - 2, fr); if (h > 18) P(g, x + 1, y + Math.floor(h / 2) - 1, w - 2, 2, fr); }
      if (o.sill) { box(g, x - 2, y + h - 1, w + 4, 3, fr); }
      if (o.curtain) {
        const c = o.curtain, cw = Math.max(4, Math.floor(w / 5));
        for (const [cx0, dir] of [[x - 2, 1], [x + w + 2 - cw, -1]]) {
          P(g, cx0, y - 2, cw, h + 2, 'k'); P(g, cx0 + 1, y - 1, cw - 2, h, c);
          for (let i = 2; i < cw - 1; i += 2) P(g, cx0 + i, y - 1, 1, h, sh(c));
          P(g, cx0 + (dir > 0 ? cw - 2 : 1), y + Math.floor(h * .55), 1, 2, 'y');
        }
        P(g, x - 4, y - 3, w + 8, 2, 'n'); P(g, x - 4, y - 3, w + 8, 1, 'k');
      }
      MAP = saved;
    }
    function sunPatch(g, x, y, w, h, key) {
      if (key === 'night') return; const k = key === 'day' ? 'w' : 'Y';
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const px = x + i + j, py = y + j; if (((px + py) & 1) === 0) P(g, px, py, 1, 1, k); }
    }
    function drawStand(g, x, fy, on) {
      const top = fy - 26;
      if (on) for (const [dx, dy] of [[-2, 1], [-2, 4], [10, 1], [10, 4], [0, -2], [4, -2], [8, -2], [-1, 9], [9, 9]]) P(g, x + dx, top + dy, 1, 1, 'Y');
      map(g, x, top, ['..kkkkk..', '.kSSSSSk.', '.kSSSSSk.', 'kSSSSSSSk', 'kSSSSSSSk', 'kkkkkkkkk'].map(r => r.replace(/S/g, on ? 'Y' : 'c')));
      if (on) P(g, x + 2, top + 1, 2, 1, 'w');
      P(g, x + 4, top + 6, 1, 18, 'k'); P(g, x + 4, top + 6, 1, 18, 'E');
      P(g, x + 3, top + 6, 1, 18, 'k'); P(g, x + 5, top + 6, 1, 18, 'k');
      P(g, x + 1, fy - 2, 7, 2, 'k'); P(g, x + 2, fy - 2, 5, 1, 'E');
    }
    function drawSofa(g, x, y, w, col, part) {
      const s = sh(col);
      const arms = () => { for (const ax of [x, x + w - 6]) { box(g, ax, y - 5, 6, 12, col); P(g, ax + 1, y - 4, 4, 1, 'w'); P(g, ax + 1, y + 5, 4, 1, s); } };
      if (part !== 'front') {
        box(g, x + 3, y - 10, w - 6, 12, col); P(g, x + 4, y - 9, w - 8, 1, 'w');
        const mid = x + Math.floor(w / 2); P(g, mid, y - 8, 1, 9, s);
        P(g, x + 4, y - 1, w - 8, 2, s);
        arms();
      }
      if (part !== 'back') {
        box(g, x + 4, y, w - 8, 6, col); P(g, x + 5, y + 1, w - 10, 1, 'w'); P(g, x + Math.floor(w / 2), y + 1, 1, 4, s); P(g, x + 5, y + 4, w - 10, 1, s);
        arms();
        P(g, x + 2, y + 7, 2, 2, 'k'); P(g, x + w - 4, y + 7, 2, 2, 'k');
      }
    }
    function drawPlant(g, x, fy, big) {
      if (big) {
        map(g, x, fy - 20, ['....kk......', '...khgk..kk.', '..khggk.kgk.', '.khgggkkhgk.', '.kgggGkhggk.', 'kkhggGkgggGk', 'khggGkhgggGk', 'kgggGkgggGk.', '.kGGkhggGk..', '..kkkgGGk...', '....kkkk....', '..kkkkkkkk..', '..kOooooOk..', '..kOooooOk..', '...kOoooOk..', '...kOoooOk..', '...kOoooOk..', '...kOoooOk..', '...kOOOOOk..', '...kkkkkkk..']);
      } else {
        map(g, x, fy - 14, ['...kk....', '..khgk.k.', '.khgkkhk.', '.kggkhgk.', 'kkhgGgGk.', 'khggGkk..', '.kkGkk...', '.kkkkkkk.', '.kOoooOk.', '.kOoooOk.', '..kOooOk.', '..kOooOk.', '..kOOOOk.', '..kkkkkk.']);
      }
    }
    function drawFrame(g, x, y, w, h, kind) {
      box(g, x, y, w, h, 'n'); P(g, x + 1, y + 1, w - 2, 1, 'N');
      const ix = x + 2, iy = y + 2, iw = w - 4, ih = h - 4;
      P(g, ix, iy, iw, ih, 'S');
      if (kind === 'sea') { P(g, ix, iy + (ih >> 1), iw, ih - (ih >> 1), 'b'); P(g, ix + 1, iy + (ih >> 1) + 1, iw - 3, 1, 'l'); P(g, ix + iw - 3, iy + 1, 2, 2, 'y'); }
      else if (kind === 'dot') { P(g, ix, iy, iw, ih, 'c'); P(g, ix + 1, iy + 1, 3, 3, 'r'); P(g, ix + iw - 4, iy + ih - 4, 3, 3, 'b'); P(g, ix + (iw >> 1), iy + 1, 2, 2, 'y'); }
      else { for (let i = 0; i < iw; i++) { const hh = Math.max(1, Math.round((ih * .6) - Math.abs(i - iw * .4) * .6)); P(g, ix + i, iy + ih - hh, 1, hh, 'g'); } P(g, ix, iy + ih - 1, iw, 1, 'G'); P(g, ix + iw - 3, iy + 1, 2, 2, 'y'); }
      P(g, x + (w >> 1), y - 2, 1, 2, 'k');
    }
    function drawHeroLying(g, x, y, blanket, len) {
      const b = blanket || 'l', L = len || 30;
      box(g, x - 2, y + 7, 26, 9, 'w'); P(g, x - 1, y + 14, 24, 1, 'L');
      HERO_ON = true; try { map(g, x, y, HERO.slice(0, 15)); } finally { HERO_ON = false; }
      box(g, x + 17, y + 9, L, 10, b); P(g, x + 18, y + 10, L - 2, 2, 'w'); P(g, x + 18, y + 17, L - 2, 1, sh(b));
      for (let i = x + 24; i < x + 17 + L - 2; i += 7) P(g, i, y + 13, 1, 3, sh(b));
    }
    const OUTFIT = {
      sauna: { b: 'O', l: 'o', w: 'p', E: 'O' },
      home: { b: 'G', l: 'g', w: 'h' },
      suit: { b: 'k', l: 'E', E: 'k' },
    };
    for (const k in OUTFIT) Object.defineProperty(OUTFIT[k], 'outfit', { value: true }); // 장면의 옷이라는 표시 (산 옷이 있으면 그쪽이 먼저)
    function drawKey(g, x, y) { map(g, x, y, ['.kkk...', 'kyYyk..', 'kykykkk', 'kyyyyOk', '.kkk.k.']); }

    // 김 (위로 오르는 점 두 줄)
    function steam(g, x, y, k) { map(g, x, y, ['.k..k', 'k..k.', '.k..k', 'k..k.'].map(r => r.replace(/k/g, k || 'L'))); }

    // ── 1 찜질방 수면실 ──
    function sceneSauna(g, key) {
      const lit = isLit(key), fy = 50;
      drawRoom(g, { wall: 'C', wallLine: ['d', 7], floor: 'N', floorLine: ['n', 6], floorY: fy, trim: 'n', ceil: 'n' });
      // 높은 작은 창
      drawWindow(g, 66, 11, 24, 15, key, { frame: 'c', cross: true });
      if (!lit) sunPatch(g, 64, 28, 6, 5, key);
      // 불가마 문 (둥근 아치 + 이글거리는 불빛)
      const kx = 4, ky = 16, kw = 30;
      for (let y = ky; y < fy; y++) for (let x = kx; x < kx + kw; x++) {
        const cx = kx + kw / 2 - .5, r = kw / 2, top = ky + r, inArch = y >= top || Math.hypot(x - cx, y - top) <= r;
        if (!inArch) continue;
        const d = y >= top ? Math.min(x - kx, kx + kw - 1 - x) : r - Math.hypot(x - cx, y - top);
        P(g, x, y, 1, 1, d < 1 ? 'k' : d < 5 ? ((x + y) % 4 === 0 ? 'E' : 'e') : d < 6 ? 'k' : d < 8 ? 'O' : d < 10 ? 'o' : lit ? 'Y' : 'y');
      }
      for (let x = kx + 5; x < kx + kw - 5; x += 3) P(g, x, fy - 3, 2, 2, 'R');
      // ♨ 표시판
      box(g, 40, 13, 22, 13, 'w'); P(g, 41, 14, 20, 1, 'r');
      map(g, 44, 16, ['.r..r..r..', 'r..r..r...', '.r..r..r..']); P(g, 43, 21, 15, 1, 'r'); P(g, 42, 20, 1, 2, 'r'); P(g, 58, 20, 1, 2, 'r'); P(g, 44, 22, 13, 1, 'r');
      // 천장 등
      P(g, 100, 4, 1, 3, 'k'); box(g, 96, 6, 9, 4, lit ? 'Y' : 'c'); if (lit) { P(g, 94, 11, 1, 1, 'Y'); P(g, 100, 12, 1, 1, 'Y'); P(g, 106, 11, 1, 1, 'Y'); }
      // 수면 매트 셋 (뒤 → 앞)
      box(g, 86, 46, 40, 6, 'r'); P(g, 87, 47, 38, 1, 'p');
      box(g, 34, 51, 60, 8, 'r'); P(g, 35, 52, 58, 1, 'p'); P(g, 35, 57, 58, 1, 'R');
      // 옆 사람 (이불 덩어리 + 양머리)
      disc(g, 91, 44, 3, 'p', 'k'); P(g, 89, 44, 2, 1, 'k'); P(g, 90, 46, 1, 1, 'r'); box(g, 87, 39, 9, 4, 'w'); disc(g, 87, 41, 2, 'w', 'k'); P(g, 87, 41, 1, 1, 'L');
      box(g, 96, 40, 26, 8, 'g'); P(g, 97, 41, 24, 1, 'h'); P(g, 104, 43, 1, 3, 'G'); P(g, 112, 43, 1, 3, 'G');
      // 목침
      box(g, 36, 47, 10, 5, 'N'); P(g, 37, 48, 8, 1, 'c');
      // 주인공: 주황 찜질복 · 양머리 수건, 매트 위에 앉음
      const hx = 52, hy = 27;
      MAP = OUTFIT.sauna; drawHeroTop(g, hx, hy, 'calm'); MAP = null;
      box(g, hx + 4, hy - 2, 14, 5, 'w'); P(g, hx + 5, hy - 1, 12, 1, 'L');
      disc(g, hx + 4, hy + 1, 3, 'w', 'k'); P(g, hx + 4, hy + 1, 1, 1, 'L'); disc(g, hx + 17, hy + 1, 3, 'w', 'k'); P(g, hx + 17, hy + 1, 1, 1, 'L');
      MAP = OUTFIT.sauna; drawHeroLegs(g, hx, hy); MAP = null;
      // 삶은 달걀 바구니 · 식혜
      box(g, 78, 50, 12, 6, 'N'); P(g, 79, 51, 10, 1, 'd');
      disc(g, 81, 49, 2, 'c', 'k'); disc(g, 86, 49, 2, 'c', 'k'); P(g, 80, 48, 1, 1, 'w'); P(g, 85, 48, 1, 1, 'w');
      box(g, 91, 50, 5, 7, 'w'); P(g, 92, 51, 3, 3, 'Y'); P(g, 92, 51, 3, 1, 'y');
      steam(g, 84, 41, 'w');
      // 상태창
      drawStatusWin(g, 98, 17, 24, 16, lit ? 'l' : 'w');
      sparkle(g, 95, 15, 'w');
    }

    // ── 2 고시원 방 ──
    function sceneGosi(g, key) {
      const lit = isLit(key);
      // 좁은 상자 방: 뒷벽 · 양 옆벽 · 천장 · 바닥 (원근)
      const bx0 = 30, bx1 = 98, by0 = 8, by1 = 50;
      P(g, 0, 0, 128, 72, 'S');
      for (let y = 0; y < 72; y++) {
        const t = y < by0 ? 1 - y / by0 : y > by1 ? (y - by1) / (72 - by1) : 0;
        const l = Math.round(bx0 * t), r = Math.round(128 - (128 - bx1) * t);
        if (y < by0) { P(g, 0, y, 128, 1, 'L'); }
        else if (y > by1) { P(g, 0, y, 128, 1, 'd'); }
        else { P(g, 0, y, bx0, 1, 'q'); P(g, bx1, y, 128 - bx1, 1, 'q'); }
      }
      // 옆벽 · 바닥 · 천장의 모서리선
      for (let y = 0; y < by0; y++) { const x = Math.round(bx0 * y / by0); P(g, 0, y, x, 1, 'e'); P(g, 128 - x, y, x, 1, 'e'); }
      for (let y = by0; y <= by1; y++) { P(g, 0, y, bx0, 1, 'q'); }
      line(g, 0, 0, bx0, by0, 'k'); line(g, 127, 0, bx1, by0, 'k'); line(g, 0, 71, bx0, by1, 'k'); line(g, 127, 71, bx1, by1, 'k');
      P(g, bx0, by0, bx1 - bx0 + 1, 1, 'k'); P(g, bx0, by1, bx1 - bx0 + 1, 1, 'k'); P(g, bx0, by0, 1, by1 - by0, 'k'); P(g, bx1, by0, 1, by1 - by0, 'k');
      // 뒷벽 벽지 점무늬
      for (let y = by0 + 3; y < by1 - 1; y += 4) for (let x = bx0 + 3 + ((y >> 2) & 1) * 2; x < bx1 - 1; x += 4) P(g, x, y, 1, 1, 'q');
      for (let y = 54; y < 72; y += 5) P(g, 0, y, 128, 1, 'N');
      // 형광등
      box(g, 50, 2, 28, 3, lit ? 'Y' : 'w'); if (lit) for (let x = 48; x < 82; x += 4) P(g, x, 7, 1, 1, 'Y');
      // 작은 창
      drawWindow(g, 38, 13, 18, 13, key, { frame: 'w', cross: true, sill: true });
      if (!lit) sunPatch(g, 40, 30, 8, 6, key);
      // 옷걸이 (오른쪽 옆벽)
      P(g, 106, 18, 8, 1, 'k'); map(g, 104, 19, ['..kkkkkk...', '.kbllllbk..', 'kbllllllbk.', 'kblllllllbk', '.kbllllbk..', '.kbllllbk..', '.kbllllbk..', '.kbbbbbbk..', '..kkkkkk...']);
      // 좁은 침대 (왼쪽 옆벽에 붙음)
      box(g, 4, 40, 44, 6, 'w'); P(g, 5, 41, 42, 1, 'w'); box(g, 6, 36, 10, 6, 'w'); P(g, 7, 37, 8, 1, 'L');
      box(g, 22, 39, 26, 7, 'l'); P(g, 23, 40, 24, 1, 'S');
      // 책상 · 의자 없음 · 컵라면 · 책 · 스탠드
      box(g, 70, 38, 32, 4, 'N'); P(g, 71, 39, 30, 1, 'c'); P(g, 72, 42, 2, 13, 'n'); P(g, 98, 42, 2, 13, 'n'); P(g, 72, 42, 1, 13, 'k'); P(g, 99, 42, 1, 13, 'k');
      P(g, 74, 42, 24, 6, 'N'); P(g, 74, 42, 24, 1, 'k'); P(g, 74, 47, 24, 1, 'k'); P(g, 85, 44, 3, 1, 'k');
      map(g, 86, 31, ['kkkkkkkk', 'kwwwwwwk', 'krrrrrrk', 'kwrwwrwk', '.kwwwwk.', '.kkkkkk.']); // 컵라면
      steam(g, 88, 25, lit ? 'w' : 'L');
      box(g, 73, 34, 11, 4, 'r'); P(g, 74, 35, 9, 1, 'w'); box(g, 74, 31, 10, 4, 'y'); P(g, 75, 32, 8, 1, 'w'); box(g, 73, 28, 11, 4, 'g'); P(g, 74, 29, 9, 1, 'h');
      map(g, 92, 26, ['.kkkk.', 'kYYYYk', 'kkkkkk', '...k..', '...k..', '...k..', '...k..', '..kkk.'].map(r => lit ? r : r.replace(/Y/g, 'c')));
      if (lit) { P(g, 90, 33, 1, 1, 'Y'); P(g, 99, 33, 1, 1, 'Y'); }
      // 주인공: 침대 끝에 앉음
      const hx = 40, hy = 26;
      drawHeroTop(g, hx, hy, 'calm');
      box(g, 2, 49, 48, 6, 'w'); P(g, 3, 50, 46, 1, 'L'); P(g, 4, 55, 2, 3, 'k'); P(g, 46, 55, 2, 3, 'k');
      drawHeroLegs(g, hx, hy);
      // 상태창
      drawStatusWin(g, 64, 14, 22, 14, lit ? 'l' : 'w');
    }

    // ── 3 원룸 ──
    function sceneOneroom(g, key) {
      const lit = isLit(key), fy = 54;
      drawRoom(g, { wall: 'c', floor: 'N', floorLine: ['n', 6], floorY: fy, trim: 'w' });
      P(g, 0, 0, 128, 2, 'C');
      // 큰 창 (도시)
      drawWindow(g, 22, 10, 40, 30, key, { frame: 'w', cross: true, view: 'city', sill: true });
      if (!lit) sunPatch(g, 30, 56, 18, 8, key);
      // 천장 등
      P(g, 70, 0, 1, 3, 'k'); map(g, 66, 3, ['.kkkkkkk.', 'kccccccck', '.kkkkkkk.'].map(r => lit ? r.replace(/c/g, 'Y') : r));
      if (lit) for (const [x, y] of [[64, 8], [70, 9], [76, 8]]) P(g, x, y, 1, 1, 'Y');
      // 작은 냉장고
      box(g, 4, 30, 15, 24, 'w'); P(g, 5, 31, 1, 22, 'w'); P(g, 17, 31, 1, 22, 'L'); P(g, 5, 39, 13, 1, 'k');
      P(g, 15, 33, 1, 4, 'E'); P(g, 15, 42, 1, 6, 'E'); box(g, 7, 43, 4, 4, 'y'); P(g, 8, 34, 3, 2, 'r');
      box(g, 5, 26, 7, 4, 'g'); P(g, 6, 27, 2, 1, 'h'); // 냉장고 위 화분 상자
      // 벽 시계 · 포스터
      disc(g, 70, 16, 4, 'w', 'k'); P(g, 70, 13, 1, 3, 'k'); P(g, 70, 16, 3, 1, 'k');
      box(g, 113, 12, 12, 16, 'w'); P(g, 114, 13, 10, 7, 'o'); P(g, 115, 22, 8, 1, 'E'); P(g, 115, 24, 6, 1, 'E'); disc(g, 119, 16, 2, 'y', 'y');
      // 침대 (오른쪽, 머리판)
      box(g, 120, 30, 6, 26, 'n'); P(g, 121, 31, 4, 1, 'N');
      box(g, 62, 42, 60, 8, 'w'); P(g, 63, 43, 58, 1, 'w');
      box(g, 106, 38, 14, 6, 'w'); P(g, 107, 39, 12, 1, 'L');
      box(g, 88, 41, 32, 9, 'l'); P(g, 89, 42, 30, 2, 'S'); P(g, 89, 48, 30, 1, 'b');
      // 주인공: 침대 끝에 앉음
      const hx = 66, hy = 26;
      drawHeroTop(g, hx, hy, 'calm');
      box(g, 60, 49, 64, 6, 'w'); P(g, 61, 50, 62, 1, 'L'); P(g, 61, 54, 62, 1, 'e'); P(g, 62, 55, 3, 3, 'k'); P(g, 118, 55, 3, 3, 'k');
      box(g, 88, 49, 34, 3, 'l');
      drawHeroLegs(g, hx, hy);
      // 러그
      P(g, 52, 62, 52, 4, 'o'); P(g, 54, 66, 48, 1, 'O'); for (let x = 54; x < 102; x += 4) P(g, x, 63, 2, 1, 'y');
      // 상태창
      drawStatusWin(g, 87, 14, 22, 15, lit ? 'l' : 'w');
    }

    // ── 4 내 집 거실 ──
    function sceneHome(g, key) {
      const lit = isLit(key), fy = 54;
      drawRoom(g, { wall: 'Y', floor: 'N', floorLine: ['n', 6], floorY: fy, trim: 'w' });
      P(g, 0, 36, 128, fy - 38, 'c'); P(g, 0, 36, 128, 1, 'w'); P(g, 0, 37, 128, 1, 'd');
      for (let x = 6; x < 128; x += 10) P(g, x, 38, 1, fy - 40, 'C');
      // 커튼 친 창
      drawWindow(g, 10, 13, 30, 22, key, { frame: 'w', cross: true, view: 'sky', curtain: 'r', sill: true });
      if (!lit) sunPatch(g, 14, 56, 18, 8, key);
      // 화분 · 액자
      drawPlant(g, 2, fy, true);
      drawFrame(g, 112, 16, 13, 11, 'hill');
      // 러그
      P(g, 22, 58, 84, 7, 'o'); P(g, 22, 58, 84, 1, 'O'); P(g, 22, 64, 84, 1, 'O'); for (let x = 24; x < 104; x += 4) { P(g, x, 60, 2, 1, 'y'); P(g, x + 2, 62, 2, 1, 'y'); }
      // 스탠드 + 불빛
      if (lit) lightPool(g, 106, 58, 10, 3);
      drawStand(g, 102, fy, lit);
      // 소파 + 주인공 + 열쇠
      const sx = 42, sy = 45, hx = 58, hy = sy - 24;
      drawSofa(g, sx, sy, 50, 'g', 'back');
      drawHeroTop(g, hx, hy, 'calm');
      drawSofa(g, sx, sy, 50, 'g', 'front');
      drawHeroLegs(g, hx, hy);
      drawKey(g, hx + 17, hy + 20);
      sparkle(g, hx + 25, hy + 18, 'w');
      // 작은 탁자 + 컵
      box(g, 24, 47, 14, 3, 'N'); P(g, 26, 50, 2, 6, 'n'); P(g, 34, 50, 2, 6, 'n'); box(g, 28, 43, 5, 5, 'w'); P(g, 29, 44, 3, 1, 'n');
      // 상태창
      drawStatusWin(g, 84, 14, 22, 15, lit ? 'l' : 'w');
    }

    const SCENE_BOX = {
      0: { hero: [44, 26, 66, 60], win: [68, 13, 100, 40] },
      1: { hero: [52, 24, 74, 58], win: [96, 15, 124, 38] },
      2: { hero: [40, 23, 62, 57], win: [62, 12, 88, 33] },
      3: { hero: [66, 23, 88, 57], win: [85, 12, 111, 34] },
      4: { hero: [58, 18, 84, 52], win: [82, 12, 108, 34] },
    };
    const SCENES = [sceneStation, sceneSauna, sceneGosi, sceneOneroom, sceneHome];

    const HUD_SKY = [
      { sky: ['#5ba5d7', '#88c8e9', '#b2dbed', '#ffdcb4'], sun: '#ffe79a', halo: '#ffd497', cloud: '#ebf2de', mist: '#84abc1', hill: '#597e93', fore: '#3d535f', city: '#596c78', brick: '#a76851', roof: '#424755', window: '#ccaf86', rail: '#516973' },
      { sky: ['#468ed1', '#63aee1', '#9ed7ef', '#c5ecf5'], sun: '#fff8a8', halo: '#ffdf68', cloud: '#f3f8f4', mist: '#6f9fb9', hill: '#4e8291', fore: '#335c64', city: '#436a7c', brick: '#b77250', roof: '#454858', window: '#e9c69a', rail: '#517c83' },
      { sky: ['#725e99', '#9d6f9c', '#d88e9d', '#ffad7f'], sun: '#ffe195', halo: '#ffc284', cloud: '#ffd1a1', mist: '#886b8e', hill: '#684e74', fore: '#443b62', city: '#504467', brick: '#7c4a55', roof: '#4a3d54', window: '#ffcf77', rail: '#655072' },
      { sky: ['#172440', '#22385a', '#30496b', '#466480'], sun: '#edf2ff', cloud: '#9ab6d4', mist: '#49607a', hill: '#354761', fore: '#242f48', city: '#303a56', brick: '#424458', roof: '#302d43', window: '#ffd879', rail: '#3c4d66' },
    ];
    const HUD_RIDGES = [
      [[0, 21, 14], [21, 26, 12], [26, 31, 11], [31, 36, 10], [36, 44, 9], [44, 48, 10], [48, 51, 11], [51, 55, 10], [55, 60, 8], [60, 63, 7], [63, 67, 8], [67, 71, 9], [71, 76, 11], [76, 82, 12]],
      [[0, 28, 15], [28, 33, 14], [33, 39, 13], [39, 43, 14], [43, 50, 15], [50, 55, 14], [55, 59, 13], [59, 67, 12], [67, 72, 13], [72, 76, 14], [76, 82, 15]],
    ];
    function hudDisc(g, x, y, r, color) {
      for (let dy = -r; dy <= r; dy++) {
        const half = Math.floor(Math.sqrt(r * r - dy * dy));
        P(g, x - half, y + dy, 2 * half + 1, 1, color);
      }
    }
    function drawHudSky(g, slot) {
      MAP = null;
      const p = HUD_SKY[slot], [sunX, sunY] = [[36, 10], [50, 5], [72, 10], [73, 5]][slot];
      P(g, 0, 0, 82, 18, p.sky[0]); P(g, 0, 3, 82, 4, p.sky[1]);
      P(g, 0, 7, 82, 5, p.sky[2]); P(g, 0, 12, 82, 6, p.sky[3]);
      if (slot < 3) {
        hudDisc(g, sunX, sunY, 5, p.halo); hudDisc(g, sunX, sunY, 3, p.sun);
        const clouds = [[[28, 4, 12], [53, 4, 8], [69, 6, 10]], [[29, 5, 10], [63, 5, 13], [69, 8, 10]], [[28, 6, 12], [44, 5, 12], [58, 4, 8]]][slot];
        for (const [x, y, w] of clouds) {
          P(g, x, y, w, 1, p.cloud); P(g, x + 2, y - 1, w - 4, 1, p.cloud);
          P(g, x + 3, y + 1, w - 6, 1, p.sky[3]);
        }
      } else {
        hudDisc(g, sunX, sunY, 3, p.sun); hudDisc(g, sunX + 2, sunY - 2, 3, p.sky[1]);
        for (const [x, y] of [[29, 3], [34, 6], [41, 3], [46, 6], [52, 2], [57, 4], [64, 3], [78, 2], [80, 6]]) P(g, x, y, 1, 1, p.cloud);
        sparkle(g, 47, 2, p.cloud);
      }
      HUD_RIDGES.forEach((ridge, i) => {
        for (const [left, right, y] of ridge) P(g, left, y, right - left, 18 - y, i ? p.hill : p.mist);
      });
      // 남산타워와 서울역은 시간대마다 같은 자리에 둔다.
      P(g, 61, 3, 1, 8, p.fore); P(g, 60, 5, 3, 1, p.fore);
      P(g, 59, 6, 5, 1, p.fore); P(g, 60, 7, 3, 1, p.fore);
      if (slot >= 2) P(g, 61, 3, 1, 1, p.window);
      for (const [x, y, w] of [[26, 14, 4], [30, 13, 4], [34, 14, 3], [38, 15, 4], [64, 13, 4], [69, 12, 4], [74, 13, 4], [79, 11, 3]]) {
        P(g, x, y, w, 18 - y, p.city);
        if (slot >= 2) P(g, x + 1, y + 1, 1, 1, p.window);
      }
      P(g, 38, 15, 26, 2, p.brick); P(g, 42, 14, 17, 1, p.roof); P(g, 46, 13, 9, 1, p.brick);
      P(g, 48, 12, 6, 1, p.roof); P(g, 49, 11, 4, 1, p.roof); P(g, 50, 10, 2, 1, p.roof);
      for (const x of [40, 43, 46, 50, 54, 58, 61]) P(g, x, 15, 1, 1, p.window);
      P(g, 50, 12, 2, 1, p.window); P(g, 49, 16, 4, 1, p.fore);
      P(g, 0, 17, 82, 1, p.fore);
      for (const x of [27, 37, 45, 56, 66, 75]) P(g, x, 17, 5, 1, p.rail);
    }

    // ───── 감싸기 (이름별 캐시) ─────
    const cache = {};
    function img(key, w, h, alt, draw) {
      if (!cache[key]) {
        const [c, g] = mk(w, h); const saved = MAP; try { draw(g); } finally { MAP = saved; } // 그리다 오류가 나도 색 바꾸기 표가 다음 그림에 남지 않게
        cache[key] = `<img class="px" alt="${alt}" src="${c.toDataURL()}" width="${w}" height="${h}">`;
      }
      return cache[key];
    }
    const SCENE_ALT = { morning: '아침의 서울역 광장 벤치', day: '낮의 서울역 광장 벤치', evening: '저녁의 서울역 광장 벤치', night: '밤의 서울역 광장 벤치' };
    const THUMB_NAME = ['서울역', '찜질방', '고시원', '원룸', '내 집', '아파트', '주택', '별장', '호텔', '한국 최고 부자'];
    const JOB_NAME = { flyer: '전단지 알바', loading: '상하차 알바', store: '편의점 알바', delivery: '배달 알바', cafe: '카페 알바', tutor: '과외', driver: '대리운전', lecture: '강연', tv: '방송 출연', advise: '투자 자문' };
    const ACT_NAME = { rest: '쉬기', study: '공부' };
    const ASSET_NAME = { daejang: '대장전자', buldak: '화끈식품', hantang: '한탕바이오', coin: '달나라코인', bank: '튼튼은행', battery: '번쩍배터리', game: '꿀잼게임즈', build: '뚝딱건설',
      etf: '다담아ETF', gold: '황금ETF', insure: '든든보험', air: '날개항공', energy: '훈훈에너지', defense: '방패방산', inv: '거꾸로ETF', doge: '멍멍코인' };

    const old = { scene: Old.scene, thumb: Old.thumb, job: Old.job, act: Old.act, asset: Old.asset, die: Old.die, cup: Old.cup };
    const safe = (name, fn) => function () { try { const r = fn.apply(this, arguments); if (r != null) return r; } catch (e) { if (window.console) console.warn('pxart', name, e); } return old[name] ? old[name].apply(this, arguments) : ''; };

    const SCENE_NAME = ['서울역 광장 벤치', '찜질방 수면실', '고시원 방', '원룸', '내 집 거실'];
    Old.scene = safe('scene', (tier, phase) => {
      const t = Math.max(0, Math.round(Number(tier) || 0));
      if (t > 4) return null; // 5~8 은 pxhomes.js (없으면 예전 그림)
      const key = Object.prototype.hasOwnProperty.call(PHASES, phase) ? phase : 'day'; // 'constructor' 같은 이름이 들어와도 낮으로
      const alt = t === 0 ? SCENE_ALT[key] : SCENE_NAME[t];
      return img('scene' + t + '_' + key + '_' + WKEY, 128, 72, alt, g => { MAP = null; try { SCENES[t](g, key); } finally { MAP = null; } }); // 옷이 바뀌면 다시 그린다
    });
    Old.thumb = safe('thumb', (tier, gray) => {
      const t = Math.max(0, Math.min(9, Math.round(Number(tier) || 0)));
      return img('thumb' + t + (gray ? 'g' : ''), 32, 32, THUMB_NAME[t] + (gray ? ' (잠김)' : ''), g => { MAP = gray ? GRAY : null; try { BUILD[t](g); } finally { MAP = null; } }); // 그리다 오류가 나도 회색 표가 다음 그림에 남지 않게
    });
    Old.hudSky = safe('hudSky', slot => img('hudSky_' + slot, 82, 18, '', g => drawHudSky(g, slot)));
    Old.job = safe('job', id => JOB[id] ? img('job_' + id, 32, 32, JOB_NAME[id], JOB[id]) : null);
    Old.act = safe('act', id => ACT[id] ? img('act_' + id, 32, 32, ACT_NAME[id], ACT[id]) : null);
    Old.asset = safe('asset', id => ASSET[id] ? img('asset_' + id, 32, 32, ASSET_NAME[id], ASSET[id]) : null);
    old.prop = old.hero = () => '';
    Old.prop = safe('prop', (id, gray) => PROP[id] ? img('prop_' + id + (gray ? 'g' : ''), 32, 32, PROP_NAME[id] + (gray ? ' (잠김)' : ''), g => { MAP = gray ? GRAY : null; try { PROP[id](g); } finally { MAP = null; } }) : null);
    // 주인공만 (22×34, 머리 삐침까지): wear 를 주면 그 옷을 입은 모습 (가게의 옷 그림), 안 주면 지금 입은 대로 (로드맵의 "지금 여기")
    Old.hero = safe('hero', (wear, look) => withWear(wear, look,
      () => img('hero_' + WKEY, 22, 34, '나', g => { MAP = null; drawHero(g, 0, 3, 'open'); })));
    Old.die = safe('die', v => { const k = Math.max(1, Math.min(6, Math.round(Number(v) || 1))); return img('die' + k, 16, 16, '주사위 ' + k, g => drawDie(g, k)); });
    Old.cup = safe('cup', () => img('cup', 32, 32, '주사위 컵', drawCup));

    // 2단계에서 다시 쓸 그리는 함수들
    window.PxArt = {
      COL, XC, GRAY, PHASES, HERO, mk, P, box, map, disc, line, dither, sparkle,
      setMap: m => { MAP = m || null; }, setWear, withWear, wearKey: () => WKEY, PROP, LOOKS, WEARS,
      drawHero, drawHeroTop, drawHeroLegs, drawStatusWin, drawBenchBack, drawBenchSeat, drawLamp, lightPool,
      drawPigeon, drawTree, drawFlyers, drawCloud, drawSky, drawStars, drawMoon, drawStation, drawTower, drawFar,
      sceneStation, drawBuilding: (g, t) => BUILD[t](g), drawDie, drawCup, JOB, ACT, ASSET,
      isLit, drawRoom, drawWindow, sunPatch, drawStand, drawSofa, drawPlant, drawFrame, drawHeroLying, OUTFIT, drawKey, SCENE_BOX,
      steam, sceneSauna, sceneGosi, sceneOneroom, sceneHome, SHADE,
    };
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('pxart.js 를 불러오지 못해 예전 그림을 씁니다', e);
  }
})();
