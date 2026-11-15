// PROTOTYPE - NOT FOR PRODUCTION
// 픽셀 그림 — 타이틀 · 엔딩 화면 전체 배경 (320×180 점, 화면에서 4배 = 1280×720).
// 불려 올 때 window.Art 의 title · ending 을 감싼다. 그릴 수 있으면 <img class="px">, 아니면 예전 벡터 그림(art.js).
// 그리는 도구 · 주인공 · 상태창은 window.PxArt(pxart.js) 것을 다시 쓴다. 색은 window.PX + PxArt.XC 만.
// 글 상자 자리 (점 좌표):
//   타이틀 .t-box  x 160~313, y 15~139  → 그 뒤는 하늘 · 구름 · 먼 도시만. 볼거리는 왼쪽(x 0~155)과 아래 띠(y 140~179).
//   엔딩   .e-box  x 133~313, y 10~136  → 주인공 · 소품은 왼쪽(x 0~130)과 아래 띠(y 137~179).
// Math.random 을 쓰지 않는다(같은 입력이면 같은 그림). 오류가 나도 예전 Art 가 남게 전체를 try/catch 로 싼다.
(function () {
  try {
    const Old = window.Art, A = window.PxArt;
    if (!Old || !A || !window.PX || typeof document === 'undefined') return;
    const { P, box, map, disc, line, dither, sparkle, mk } = A;
    const W = 320, H = 180;

    // 고정 난수 (씨앗이 같으면 같은 그림)
    function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

    // 하늘 띠: [[시작 줄, 색], …] — 띠 사이는 한 줄씩 점무늬로 섞는다 (pxart 의 drawSky 와 같은 방식, 높이만 자유)
    function sky(g, x, y, w, h, bands) {
      for (let i = 0; i < bands.length; i++) {
        const y0 = y + bands[i][0], y1 = i + 1 < bands.length ? y + bands[i + 1][0] : y + h;
        P(g, x, y0, w, y1 - y0, bands[i][1]);
        if (i > 0) { dither(g, x, y0, w, 1, bands[i - 1][1], 0); dither(g, x, y0 - 1, w, 1, bands[i][1], 1); }
      }
    }
    // 큰 뭉게구름 (폭 w, 아래 그늘 sh)
    function bigCloud(g, x, y, w, k, sh) {
      const h = Math.max(4, Math.round(w / 4));
      P(g, x + 2, y + h - 3, w - 4, 3, k);
      disc(g, x + Math.round(w * .3), y + h - 4, Math.round(h * .55), k, k);
      disc(g, x + Math.round(w * .58), y + h - 5, Math.round(h * .75), k, k);
      disc(g, x + Math.round(w * .8), y + h - 3, Math.round(h * .45), k, k);
      P(g, x + 3, y + h, w - 6, 1, sh); P(g, x + 6, y + h - 1, Math.round(w * .3), 1, sh);
    }
    function sun(g, cx, cy, r, rays) {
      if (rays) for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4, x = Math.round(cx + Math.cos(t) * (r + 4)), y = Math.round(cy + Math.sin(t) * (r + 4)); P(g, x, y, 2, 2, 'Y'); }
      disc(g, cx, cy, r + 1, 'Y', 'Y'); disc(g, cx, cy, r, 'y', 'y'); disc(g, cx - 1, cy - 1, r - 2, 'Y', 'Y'); P(g, cx - r + 3, cy - r + 3, 2, 2, 'w');
    }
    function bird(g, x, y, k) { P(g, x, y, 1, 1, k); P(g, x + 1, y + 1, 1, 1, k); P(g, x + 2, y, 1, 1, k); P(g, x + 3, y - 1, 1, 1, k); P(g, x - 1, y - 1, 1, 1, k); }

    // 먼 도시 실루엣 (base 줄에 붙음, 높이는 고정 난수)
    function skyline(g, x0, x1, base, hmin, hmax, k, win, seed) {
      const r = rng(seed);
      for (let x = x0; x < x1;) {
        const w = 6 + Math.floor(r() * 10), h = hmin + Math.floor(r() * (hmax - hmin));
        P(g, x, base - h, w, h, k);
        if (r() < .3) P(g, x + Math.floor(w / 2), base - h - 3, 1, 3, k); // 안테나
        if (win) for (let yy = base - h + 2; yy < base - 1; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (r() < .35) P(g, xx, yy, 1, 1, win);
        x += w + (r() < .3 ? 1 : 0);
      }
    }

    // ───── 주인공: 웃는 얼굴 + 오른팔을 번쩍 들어 열쇠 (22×31 + 팔 · 열쇠는 위 · 오른쪽으로 삐져나옴) ─────
    function rowsJoy() {
      const r = A.HERO.slice();
      const put = (y, x, s) => { r[y] = r[y].slice(0, x) + s + r[y].slice(x + s.length); };
      // 웃는 눈 (^ ^)
      put(9, 6, 'pkp'); put(9, 13, 'pkp');
      put(10, 5, 'pkpkp'); put(10, 12, 'pkpkp');
      put(11, 5, 'ppppp'); put(11, 12, 'ppppp'); put(11, 7, 'p'); put(11, 14, 'p');
      // 크게 벌린 입
      put(12, 9, 'kkkk'); put(13, 9, 'kRRk'); put(14, 10, 'kk');
      // 오른팔(그림 오른쪽)을 지운다 → 몸통 옆선만
      for (let y = 16; y <= 23; y++) { put(y, 17, 'k'); put(y, 18, '....'); }
      put(15, 17, 'kk..'); put(16, 16, 'bk');
      put(24, 17, '....');
      return r;
    }
    function drawKey(g, x, y) { // 열쇠: 고리 (x..x+6, y..y+6) + 아래로 대 · 이
      disc(g, x + 3, y + 3, 3, 'y', 'k'); P(g, x + 2, y + 2, 3, 3, 'k'); P(g, x + 3, y + 3, 1, 1, 'k'); P(g, x + 2, y + 2, 3, 3, 'Y'); P(g, x + 3, y + 3, 1, 1, 'k');
      P(g, x + 3, y + 1, 1, 1, 'Y'); P(g, x + 1, y + 3, 1, 1, 'Y');
      P(g, x + 2, y + 7, 3, 7, 'k'); P(g, x + 3, y + 7, 1, 6, 'y');
      P(g, x + 4, y + 10, 3, 1, 'k'); P(g, x + 4, y + 12, 2, 1, 'k'); P(g, x + 6, y + 11, 1, 1, 'k');
      P(g, x + 4, y + 11, 2, 1, 'y'); P(g, x + 4, y + 13, 1, 1, 'y');
    }
    function drawHeroCheer(g, x, y, glow) {
      // 열쇠 둘레 빛 (점무늬)
      if (glow) for (let j = -6; j <= 8; j++) for (let i = -6; i <= 8; i++) { const d = Math.hypot(i - 1, j - 1); if (d < 8 && d > 4 && ((x + i + y + j) & 1)) P(g, x + 22 + i, y - 18 + j, 1, 1, glow); }
      // 머리 위 삐침 + 몸
      P(g, x + 11, y - 2, 1, 2, 'k'); P(g, x + 12, y - 3, 2, 1, 'k'); P(g, x + 10, y - 1, 1, 1, 'k');
      map(g, x, y, rowsJoy());
      // 들어 올린 팔: 어깨(x+16..21, y+15) → 머리 옆 위로 비스듬히
      for (let j = 0; j < 14; j++) {
        const ax = x + 18 + Math.round(j * 0.25), ay = y + 16 - j;
        P(g, ax - 1, ay, 1, 1, 'k'); P(g, ax, ay, 3, 1, 'l'); P(g, ax + 1, ay, 1, 1, 'b'); P(g, ax + 3, ay, 1, 1, 'k');
      }
      P(g, x + 17, y + 17, 4, 1, 'k'); P(g, x + 18, y + 16, 2, 1, 'b');
      // 소매 끝 + 주먹
      P(g, x + 20, y + 2, 5, 1, 'k'); P(g, x + 21, y + 3, 3, 1, 'b');
      map(g, x + 19, y - 4, ['.kkkk.', 'kppppk', 'kpPppk', '.kkkk.'].map(s => s.replace(/\./g, '.')));
      drawKey(g, x + 19, y - 17);
      sparkle(g, x + 29, y - 18, 'w'); sparkle(g, x + 15, y - 12, 'w'); P(g, x + 30, y - 9, 1, 1, 'Y');
    }

    // 엔딩용 큰 주인공: 1배로 그린 것을 EPX(Scale2x)로 두 배 — 대각선이 계단 대신 매끈하게
    function heroBig(g, x, y, glow) { // (x, y) = 두 배 그림의 왼쪽 위. 발바닥 = y + 102
      const ow = 40, oh = 52, [c1, g1] = mk(ow, oh);
      drawHeroCheer(g1, 4, 20, null);
      const src = g1.getImageData(0, 0, ow, oh), s32 = new Uint32Array(src.data.buffer);
      const [c2, g2] = mk(ow * 2, oh * 2), dst = g2.createImageData(ow * 2, oh * 2), d32 = new Uint32Array(dst.data.buffer);
      const at = (i, j) => (i < 0 || j < 0 || i >= ow || j >= oh) ? 0 : s32[j * ow + i];
      for (let j = 0; j < oh; j++) for (let i = 0; i < ow; i++) {
        const p = at(i, j), a = at(i, j - 1), b = at(i + 1, j), cc = at(i - 1, j), d = at(i, j + 1);
        let e1 = p, e2 = p, e3 = p, e4 = p;
        if (cc === a && cc !== d && a !== b) e1 = a;
        if (a === b && a !== cc && b !== d) e2 = b;
        if (d === cc && d !== b && cc !== a) e3 = cc;
        if (b === d && b !== a && d !== cc) e4 = d;
        const o = (j * 2) * ow * 2 + i * 2; d32[o] = e1; d32[o + 1] = e2; d32[o + ow * 2] = e3; d32[o + ow * 2 + 1] = e4;
      }
      g2.putImageData(dst, 0, 0);
      if (glow) for (let j = -14; j <= 14; j++) for (let i = -14; i <= 14; i++) { const dd = Math.hypot(i, j); if (dd < 14 && dd > 8 && ((x + i + y + j) & 1)) P(g, x + 52 + i, y + 12 + j, 1, 1, glow); }
      g.drawImage(c2, x, y);
      sparkle(g, x + 70, y + 2, 'w'); sparkle(g, x + 36, y + 14, 'w'); sparkle(g, x + 72, y + 24, 'Y');
    }

    // ───── 큰 서울역 역사 (지어낸 돔 역사, 폭 148 · 높이 ~76) ─────
    function bigStation(g, ox, base) {
      const brick = (x, y, w, h) => { // 붉은 벽돌 결 (줄눈 점)
        box(g, x, y, w, h, 'N');
        for (let yy = y + 3; yy < y + h - 1; yy += 3) for (let xx = x + 1 + ((yy / 3) & 1) * 3; xx < x + w - 1; xx += 6) P(g, xx, yy, 2, 1, 'P');
      };
      const cornice = (x, y, w) => { P(g, x - 1, y, w + 2, 3, 'c'); P(g, x - 1, y, w + 2, 1, 'k'); P(g, x - 1, y + 3, w + 2, 1, 'k'); P(g, x, y + 2, w, 1, 'd'); P(g, x - 1, y + 1, 1, 2, 'k'); P(g, x + w, y + 1, 1, 2, 'k'); };
      const archWin = (x, y, w, h) => {
        P(g, x + 1, y, w - 2, 1, 'k'); P(g, x, y + 1, 1, h - 1, 'k'); P(g, x + w - 1, y + 1, 1, h - 1, 'k'); P(g, x, y + h, w, 1, 'k');
        P(g, x + 1, y + 1, w - 2, h - 1, 'S'); P(g, x + 1, y + 1, 1, h - 3, 'w'); P(g, x + Math.floor(w / 2), y + 1, 1, h - 1, 'c'); P(g, x + 1, y + Math.floor(h / 2), w - 2, 1, 'c');
        P(g, x - 1, y + h + 1, w + 2, 1, 'c'); P(g, x - 1, y + h + 2, w + 2, 1, 'd'); // 창턱
        P(g, x + 1, y - 1, w - 2, 1, 'c'); // 아치 돌
      };
      // 양 날개
      for (const wx of [ox, ox + 100]) {
        brick(wx, base - 38, 48, 38);
        cornice(wx, base - 41, 48);
        P(g, wx + 1, base - 5, 46, 4, 'C'); P(g, wx + 1, base - 5, 46, 1, 'd'); // 아랫단 돌
        for (let i = 0; i < 5; i++) archWin(wx + 4 + i * 9, base - 31, 6, 20);
        // 모서리 돌
        for (let yy = base - 37; yy < base - 5; yy += 4) { P(g, wx + 1, yy, 2, 2, 'c'); P(g, wx + 45, yy, 2, 2, 'c'); }
      }
      // 날개 끝 작은 탑 (초록 지붕)
      for (const tx of [ox + 1, ox + 137]) {
        box(g, tx, base - 50, 10, 10, 'N'); P(g, tx + 1, base - 49, 8, 1, 'c'); archWin(tx + 3, base - 47, 4, 5);
        map(g, tx - 1, base - 57, ['....kkkk....', '..kkhgggkk..', '.khggggggGk.', 'kGGGGGGGGGGk', 'kkkkkkkkkkkk']);
        P(g, tx + 4, base - 59, 2, 2, 'k'); P(g, tx + 4, base - 60, 2, 1, 'y');
      }
      // 가운데 몸채
      const cx = ox + 48, cw = 52;
      brick(cx, base - 52, cw, 52);
      cornice(cx, base - 55, cw);
      P(g, cx + 1, base - 5, cw - 2, 4, 'C'); P(g, cx + 1, base - 5, cw - 2, 1, 'd');
      for (let yy = base - 51; yy < base - 5; yy += 4) { P(g, cx + 1, yy, 2, 2, 'c'); P(g, cx + cw - 3, yy, 2, 2, 'c'); }
      // 돔 아래 둥근 몸통 (작은 창이 둘린 드럼)
      box(g, cx + 11, base - 69, cw - 22, 16, 'C'); P(g, cx + 12, base - 68, cw - 24, 1, 'c');
      for (let i = 0; i < 5; i++) { const x = cx + 14 + i * 5; P(g, x, base - 65, 3, 6, 'k'); P(g, x + 1, base - 64, 1, 4, 'S'); }
      // 세모 박공 + 시계
      for (let j = 0; j < 9; j++) { P(g, cx + 8 + j * 2, base - 56 - j, cw - 16 - j * 4, 1, j === 8 ? 'k' : 'c'); P(g, cx + 7 + j * 2, base - 56 - j, 2, 1, 'k'); P(g, cx + cw - 9 - j * 2, base - 56 - j, 2, 1, 'k'); }
      P(g, cx + 10, base - 57, cw - 20, 1, 'd');
      disc(g, cx + 26, base - 43, 6, 'w', 'k'); P(g, cx + 26, base - 47, 1, 4, 'k'); P(g, cx + 26, base - 43, 4, 1, 'k'); P(g, cx + 22, base - 43, 1, 1, 'e'); P(g, cx + 30, base - 43, 1, 1, 'e'); P(g, cx + 26, base - 38, 1, 1, 'e');
      // 돔
      map(g, cx + 6, base - 82, [
        '...................kkkk...................',
        '...............kkkkhhggkkkk...............',
        '............kkkhhhhggggggggkkk............',
        '..........kkhhhhggggggggggggGGkk..........',
        '.........khhhgggggggggggggggggGGk.........',
        '........khhgggggggggggggggggggggGGk.......',
        '.......khhggggggggggggggggggggggGGGk......',
        '......khgggggggggggggggggggggggggGGGk.....',
        '......kgggggggggggggggggggggggggggGGk.....',
        '.....kggggggggggggggggggggggggggggGGGk....',
        '.....kGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGk....',
        '....kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk...',
        '....kcccccccccccccccccccccccccccccccccck..',
        '....kddddddddddddddddddddddddddddddddddk..',
        '....kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk..',
      ].map(s => s.slice(0, 42)));
      // 돔 줄무늬 (이음매)
      for (const dx of [14, 21, 28]) for (let j = 3; j < 10; j++) P(g, cx + 6 + dx, base - 82 + j, 1, 1, j < 5 ? 'g' : 'G');
      // 꼭대기 첨탑
      P(g, cx + 25, base - 88, 2, 6, 'k'); P(g, cx + 24, base - 85, 4, 1, 'k'); P(g, cx + 25, base - 90, 2, 2, 'y'); P(g, cx + 25, base - 90, 1, 1, 'Y');
      // 큰 아치 문 셋
      for (const [dx, w, h] of [[5, 9, 20], [19, 14, 28], [38, 9, 20]]) {
        const x = cx + dx, y = base - 2 - h;
        P(g, x + 2, y, w - 4, 1, 'k'); P(g, x + 1, y + 1, 1, 1, 'k'); P(g, x + w - 2, y + 1, 1, 1, 'k'); P(g, x, y + 2, 1, h - 2, 'k'); P(g, x + w - 1, y + 2, 1, h - 2, 'k');
        P(g, x + 2, y + 1, w - 4, 1, 'O'); P(g, x + 1, y + 2, w - 2, h - 2, 'O'); P(g, x + 2, y + 3, w - 4, h - 3, 'n');
        P(g, x + 2, y + 3, w - 4, Math.floor(h / 3), 'S'); P(g, x + 2, y + 3, 1, Math.floor(h / 3), 'w'); // 문 위 유리
        P(g, x + Math.floor(w / 2), y + 3, 1, h - 3, 'k');
        P(g, x - 1, y - 1, w + 2, 1, 'c'); // 아치 돌
      }
      // 계단
      P(g, cx + 2, base - 2, cw - 4, 1, 'L'); P(g, cx, base - 1, cw, 1, 'e');
    }

    // 유리 빌딩 (pxart 의 drawTower 와 같은 결, 더 크게)
    function glassTower(g, x, y, w, base) {
      box(g, x, y, w, base - y, 'l');
      for (let yy = y + 4; yy < base - 1; yy += 5) P(g, x + 1, yy, w - 2, 1, 'b');
      for (let xx = x + 6; xx < x + w - 1; xx += 7) P(g, xx, y + 1, 1, base - y - 2, 's');
      P(g, x + 1, y + 1, 4, base - y - 2, 'S'); P(g, x + 2, y + 1, 1, base - y - 2, 'w');
      // 해 비친 창 몇 칸
      for (const [i, j] of [[1, 2], [2, 5], [1, 9], [3, 12], [2, 14]]) if (x + 6 + i * 7 + 5 < x + w - 1) P(g, x + 7 + i * 7, y + 5 + j * 5, 5, 4, 'S');
      P(g, x - 1, y - 2, w + 2, 2, 'B'); P(g, x - 1, y - 2, w + 2, 1, 'k');
    }

    // 소파: (x, y) = 등받이 위 왼쪽, h = 다리까지. f 천 · sh 그늘 · hi 밝은 결 · leg 다리
    function sofa(g, x, y, w, h, f, sh, hi, leg) {
      const bh = Math.round(h * .5), bot = y + h - 3;
      box(g, x + 5, y, w - 10, bh + 2, f); P(g, x + 6, y + 1, w - 12, 1, hi);
      const n = Math.max(2, Math.round((w - 20) / 34)), cw = Math.floor((w - 20) / n);
      for (let i = 1; i < n; i++) P(g, x + 10 + i * cw, y + 2, 1, bh - 2, sh);
      for (let i = 0; i < n; i++) P(g, x + 12 + i * cw, y + 3, 2, 1, hi);
      box(g, x + 6, y + bh, w - 12, bot - y - bh - 3, f); P(g, x + 7, y + bh + 1, w - 14, 1, hi); P(g, x + 7, bot - 5, w - 14, 2, sh);
      for (let i = 1; i < n; i++) P(g, x + 10 + i * cw, y + bh + 1, 1, 5, sh);
      for (const ax of [x, x + w - 10]) { box(g, ax, y + bh - 5, 10, bot - y - bh + 5, f); P(g, ax + 1, y + bh - 4, 8, 1, hi); P(g, ax + 1, bot - 3, 8, 2, sh); }
      P(g, x + 1, bot - 1, w - 2, 1, 'k');
      for (const lx of [x + 3, x + w - 6]) { P(g, lx, bot, 3, 3, 'k'); P(g, lx + 1, bot, 1, 2, leg); }
    }

    // 화분 (꽃 핀 사각 화분, 아래 = base)
    function planter(g, x, base, w, seed) {
      const r = rng(seed);
      box(g, x, base - 9, w, 9, 'N'); P(g, x + 1, base - 8, w - 2, 1, 'c'); P(g, x + 1, base - 2, w - 2, 1, 'n');
      for (let i = 0; i < w; i += 3) disc(g, x + 2 + i, base - 11, 3, 'g', 'k');
      for (let i = 0; i < w; i += 3) { P(g, x + 1 + i, base - 13, 2, 1, 'h'); }
      for (let i = 0; i < Math.floor(w / 3); i++) { const fx = x + 2 + Math.floor(r() * (w - 4)), fy = base - 15 + Math.floor(r() * 5), k = ['r', 'y', 'w', 'o'][i % 4]; P(g, fx, fy, 2, 2, k); P(g, fx, fy, 1, 1, 'w'); }
    }
    function flyingPigeon(g, x, y) { map(g, x, y, ['k......kk', 'ek....keek', '.eek.keek.', '..keeeek..', '.kOeeeEek.', '..kkkkkk..']); }

    // ───── 타이틀: 아침의 서울역 광장 ─────
    function drawTitle(g) {
      const base = 132;
      sky(g, 0, 0, W, base, [[0, 's'], [34, 'q'], [70, 'S'], [104, 'Y'], [124, 'p']]);
      sun(g, 30, 28, 8, true);
      // 구름: 왼쪽 위 · 글 상자 뒤 · 오른쪽 끝
      bigCloud(g, 62, 14, 44, 'w', 'S'); bigCloud(g, 8, 52, 30, 'w', 'S');
      bigCloud(g, 200, 4, 40, 'w', 'S'); bigCloud(g, 268, 30, 50, 'w', 'S'); bigCloud(g, 176, 62, 34, 'w', 'S');
      bird(g, 120, 22, 'E'); bird(g, 128, 18, 'E'); bird(g, 134, 25, 'E');
      // 먼 도시 (뿌연 하늘색) → 가까운 도시 (파랑)
      skyline(g, 0, W, base, 14, 40, 'q', 'S', 7);
      skyline(g, 150, W, base, 10, 30, 'l', 'S', 19);
      glassTower(g, 126, 40, 30, base);
      // 역사
      bigStation(g, 2, base);
      // 광장 바닥: 크림 돌판 + 원근 줄눈
      P(g, 0, base, W, H - base, 'C'); P(g, 0, base, W, 1, 'd'); P(g, 0, base + 1, W, 1, 'c');
      { let y = base + 4, gap = 4; while (y < H) { P(g, 0, y, W, 1, 'd'); gap += 1; y += gap; } }
      for (let i = -12; i <= 24; i++) { const xt = 76 + i * 14, xb = 76 + i * 40; line(g, xt, base + 2, xb, H - 1, 'd'); }
      // 보도 무늬 띠 (붉은 벽돌 한 줄)
      P(g, 0, base + 11, W, 2, 'P'); P(g, 0, base + 13, W, 1, 'd');
      // 아래 띠 오른쪽: 화분 · 비둘기 · 전단지
      planter(g, 196, 176, 26, 3); planter(g, 288, 176, 30, 5);
      A.drawPigeon(g, 236, 166, true); A.drawPigeon(g, 252, 170, false); A.drawPigeon(g, 170, 172, true);
      P(g, 240, 160, 1, 1, 'O'); P(g, 246, 163, 1, 1, 'O'); P(g, 233, 162, 1, 1, 'O'); // 모이
      bird(g, 104, 50, 'E'); bird(g, 112, 46, 'E'); bird(g, 290, 6, 'E');
      // 가로등 (켜지지 않은 아침)
      P(g, 28, 171, 30, 2, 'd');
      A.drawLamp(g, 36, 104, 172, false);
      // 그늘 · 벤치 · 주인공 (앉음) · 전단지
      P(g, 60, 168, 62, 2, 'd');
      A.drawBenchBack(g, 62, 144, 56);
      A.drawHeroTop(g, 74, 134, 'calm');
      A.drawBenchSeat(g, 62, 158, 56);
      A.drawHeroLegs(g, 74, 134);
      A.drawFlyers(g, 100, 153);
      // 종이컵
      box(g, 66, 152, 5, 6, 'w'); P(g, 66, 152, 5, 1, 'k'); P(g, 67, 154, 3, 1, 'o');
      A.drawTree(g, 12, 176, 7); A.drawPigeon(g, 46, 172, false); A.drawPigeon(g, 132, 167, true);
      // 떠 있는 상태창 + 반짝
      A.drawStatusWin(g, 104, 108, 40, 26, 'w');
      sparkle(g, 148, 104, 'w'); sparkle(g, 100, 102, 'w'); sparkle(g, 150, 132, 'Y');
    }

    // ───── 엔딩 공통: 큰 창 너머 해 뜨는 도시 ─────
    function sunrise(g, x, y, w, h, horizon, sunX) {
      sky(g, x, y, w, h, [[0, 'l'], [Math.round(horizon * .3), 's'], [Math.round(horizon * .55), 'S'], [Math.round(horizon * .78), 'Y'], [horizon - 6, 'y']]);
      // 해 + 빛 고리
      const sy = y + horizon - 12;
      for (let j = -17; j <= 17; j++) for (let i = -17; i <= 17; i++) { const d = Math.hypot(i, j); if (d > 12 && d < 17 && ((i + j) & 1)) P(g, x + sunX + i, sy + j, 1, 1, 'w'); }
      disc(g, x + sunX, sy, 10, 'y', 'O'); disc(g, x + sunX, sy, 8, 'Y', 'Y'); disc(g, x + sunX - 1, sy - 1, 5, 'w', 'w');
    }

    // ───── 엔딩 top: 호텔 맨 위층의 아침 ─────
    function drawTop(g) {
      // 벽: 짙은 파랑 고급 벽지 + 금 줄
      P(g, 0, 0, W, H, 'B');
      for (let x = 2; x < W; x += 8) P(g, x, 0, 1, H, 'b');
      // 통창 (금색 틀) x 22~319, y 6~150
      const fx = 22, fy = 6, fw = 298, fh = 146, ix = fx + 4, iy = fy + 4, iw = fw - 8, ih = fh - 8, hz = 76;
      sunrise(g, ix, iy, iw, hz + 2, hz, 22);
      // 저 아래 도시: 지평선 → 아래로 갈수록 크게, 위에서 내려다본 지붕
      const gb = iy + hz;
      P(g, ix, gb, iw, ih - hz, 'q');
      skyline(g, ix, ix + iw, gb + 2, 3, 8, 'S', null, 31);
      P(g, ix, gb + 4, iw, 3, 's'); P(g, ix, gb + 5, iw, 1, 'w'); dither(g, ix, gb + 4, iw, 1, 'S', 1); // 강
      for (let k = 0; k < 3; k++) { // 줄마다 가까워지는 빌딩 (지붕이 보인다)
        const r = rng(41 + k), top = gb + 8 + k * 14, sz = 7 + k * 5;
        for (let x = ix - 4 + k * 3; x < ix + iw;) {
          const w = sz + Math.floor(r() * sz), h = 10 + k * 8 + Math.floor(r() * 10), yy = top + Math.floor(r() * 4);
          const k1 = ['l', 'L', 'S', 'w', 'q'][Math.floor(r() * 5)];
          P(g, x, yy, w, h, k === 2 ? 'b' : 'l'); P(g, x, yy, w, 2 + k, k1); P(g, x, yy, w, 1, 'k'); P(g, x, yy, 1, h, 'k');
          for (let wy = yy + 4 + k; wy < yy + h; wy += 3) for (let wx = x + 2; wx < x + w - 1; wx += 3) P(g, wx, wy, 1, 1, ((wx + wy) % 5) ? 'S' : 'Y');
          P(g, x + w - 2, yy + 2 + k, 1, h, 'y'); // 해 받은 옆면
          x += w + 1 + Math.floor(r() * 3);
        }
      }
      // 창살 (금) — 세로 셋 · 가로 하나
      const gold = (x, y, w, h) => { P(g, x, y, w, h, 'y'); P(g, x, y, 1, h, 'Y'); P(g, x + w - 1, y, 1, h, 'O'); P(g, x, y, w, 1, 'Y'); };
      for (const mx of [ix + 100, ix + 196]) { P(g, mx - 1, iy, 1, ih, 'k'); gold(mx, iy, 3, ih); P(g, mx + 3, iy, 1, ih, 'k'); }
      P(g, ix, iy + 30, iw, 1, 'k'); gold(ix, iy + 31, iw, 2); P(g, ix, iy + 33, iw, 1, 'k');
      // 바깥 틀
      P(g, fx, fy, fw, 4, 'k'); gold(fx + 1, fy + 1, fw - 1, 3);
      P(g, fx, fy, 4, fh, 'k'); gold(fx + 1, fy + 1, 3, fh - 1);
      P(g, fx, fy + fh - 4, fw, 4, 'k'); gold(fx + 1, fy + fh - 3, fw - 1, 2);
      P(g, ix, iy, iw, 1, 'O');
      // 반짝 (유리)
      for (const [x, y] of [[ix + 8, iy + 6], [ix + 112, iy + 40], [ix + 210, iy + 8]]) { line(g, x, y + 8, x + 8, y, 'w'); line(g, x + 4, y + 8, x + 8, y + 4, 'w'); }
      // 바닥: 대리석 (흰 · 회 바둑) + 붉은 카펫
      const fl = fy + fh;
      P(g, 0, fl, W, H - fl, 'c');
      for (let y = fl; y < H; y += 7) for (let x = (((y - fl) / 7) & 1) * 10; x < W; x += 20) { P(g, x, y, 10, 7, 'C'); P(g, x + 2, y + 2, 2, 1, 'w'); }
      for (let y = fl + 7; y < H; y += 7) P(g, 0, y, W, 1, 'd');
      P(g, 0, fl, W, 1, 'k'); P(g, 0, fl + 1, W, 1, 'e');
      P(g, 34, fl + 10, 150, H - fl - 10, 'r'); P(g, 34, fl + 10, 150, 1, 'R'); P(g, 36, fl + 12, 146, 1, 'y'); P(g, 36, H - 3, 146, 1, 'y');
      for (let x = 40; x < 180; x += 8) P(g, x, fl + 16, 2, 2, 'y');
      // 왼쪽 커튼 (붉은 벨벳 + 금 끈)
      for (let y = 0; y < fl; y++) { const w = 18 - Math.max(0, Math.round((y - 70) * .12)); P(g, 0, y, w, 1, 'r'); P(g, w, y, 1, 1, 'k'); for (let x = 3; x < w; x += 5) P(g, x, y, 1, 1, 'R'); }
      P(g, 0, 70, 20, 3, 'y'); P(g, 0, 70, 20, 1, 'k'); P(g, 0, 73, 20, 1, 'O'); P(g, 18, 70, 2, 8, 'y'); P(g, 18, 78, 2, 2, 'O');
      P(g, 0, 0, 30, 4, 'O'); P(g, 0, 0, 30, 3, 'y'); P(g, 0, 4, 30, 1, 'k'); for (let x = 1; x < 30; x += 3) P(g, x, 5, 1, 2, 'y');
      // 샹들리에 (왼쪽 위, 글 상자 밖)
      P(g, 74, 0, 1, 8, 'k');
      map(g, 56, 8, [
        '..........kkk..........',
        '.........kyYyk.........',
        '......kkkyyyyykkk......',
        '....kkyYYYYYYYYYykk....',
        '..kkyyyyyyyyyyyyyyykk..',
        '.kOyyOyyOyyOyyOyyOyyOk.',
        '..kkk..kk..kk..kk..kkk.',
        '..kwk..kwk.kwk.kwk.kwk.',
        '..kYk..kYk.kYk.kYk.kYk.',
        '..kYk..kYk.kYk.kYk.kYk.',
        '...k....k...k...k...k..',
        '..........kYk..........',
        '...........w...........',
      ]);
      sparkle(g, 54, 12, 'Y'); sparkle(g, 82, 22, 'Y'); sparkle(g, 66, 26, 'w');
      // 아래 띠 오른쪽: 금빛 둥근 탁자 + 샴페인 + 1인 소파
      // 소파 (붉은 벨벳)
      sofa(g, 218, 142, 76, 32, 'r', 'R', 'w', 'y');
      // 탁자
      P(g, 186, 164, 22, 2, 'O'); box(g, 184, 150, 26, 5, 'y'); P(g, 185, 151, 24, 1, 'Y'); P(g, 196, 155, 2, 9, 'O'); P(g, 196, 155, 1, 9, 'k'); P(g, 191, 163, 12, 2, 'k');
      // 샴페인 병 · 잔 둘
      map(g, 188, 136, ['.kk.', '.kk.', '.kGk', 'kGGk', 'kGgk', 'kyyk', 'kGGk', 'kGGk', 'kGGk', 'kGGk', 'kGGk', 'kGGk', 'kkkk']);
      for (const gx of [196, 202]) map(g, gx, 141, ['kwwk', 'kYYk', 'kYYk', '.kk.', '.kk.', '.kk.', '.kk.', 'kkkk']);
      sparkle(g, 200, 136, 'w');
      // 화분 (큰 잎)
      box(g, 296, 160, 18, 16, 'y'); P(g, 297, 161, 16, 1, 'Y'); P(g, 297, 170, 16, 1, 'O');
      for (const [x, y, r] of [[300, 154, 4], [309, 152, 5], [304, 147, 4], [314, 157, 3]]) disc(g, x, y, r, 'g', 'k');
      P(g, 302, 146, 2, 2, 'h'); P(g, 307, 150, 2, 2, 'h');
      // 주인공 (왼쪽, 카펫 위) + 작은 상태창
      P(g, 30, 175, 50, 3, 'R');
      heroBig(g, 18, 74, 'Y');
      A.drawStatusWin(g, 98, 70, 30, 22, 'Y');
      // 금 반짝이 (왼쪽 빈 곳)
      for (const [x, y] of [[44, 96], [30, 128], [122, 92], [52, 120]]) sparkle(g, x, y, 'Y');
    }

    // ───── 엔딩 home: 내 집 거실의 아침 ─────
    function drawHome(g) {
      // 벽: 연한 하늘색 + 세로 줄무늬 벽지, 아래 걸레받이
      P(g, 0, 0, W, H, 'q');
      for (let x = 3; x < W; x += 10) { P(g, x, 0, 2, H, 'S'); }
      // 큰 창 (흰 나무 틀) x 36~319, y 10~146
      const fx = 36, fy = 10, fw = 284, fh = 136, ix = fx + 4, iy = fy + 4, iw = fw - 8, ih = fh - 8, hz = 84;
      sunrise(g, ix, iy, iw, hz + 2, hz, 22);
      bigCloud(g, ix + 8, iy + 18, 28, 'w', 'Y'); bigCloud(g, ix + 140, iy + 10, 40, 'w', 'S');
      const gb = iy + hz;
      P(g, ix, gb, iw, ih - hz, 'h');
      skyline(g, ix, ix + iw, gb + 1, 4, 14, 'l', 'Y', 13);
      // 가까운 동네: 낮은 집 지붕 · 나무
      { const r = rng(23); for (let x = ix - 6; x < ix + iw;) { const w = 14 + Math.floor(r() * 10), h = 10 + Math.floor(r() * 10), y = gb + 30 - h + Math.floor(r() * 6), rk = ['o', 'r', 'b', 'O'][Math.floor(r() * 4)];
        box(g, x, y, w, ih - (y - iy), 'c');
        for (let j = 0; j < 5; j++) { P(g, x + 3 - j, y - 5 + j, w - 6 + 2 * j, 1, rk); P(g, x + 3 - j, y - 5 + j, 1, 1, 'k'); P(g, x + w - 4 + j, y - 5 + j, 1, 1, 'k'); }
        P(g, x + 3, y - 6, w - 6, 1, 'k'); P(g, x - 2, y, w + 4, 1, 'k');
        P(g, x + 3, y + 3, 3, 3, 'S'); if (w > 18) P(g, x + w - 6, y + 3, 3, 3, 'Y');
        x += w + 4; if (r() < .6) { disc(g, x - 2, gb + 26, 3, 'g', 'k'); P(g, x - 3, gb + 23, 2, 1, 'h'); } } }
      // 창살 (흰 틀)
      const wood = (x, y, w, h) => { P(g, x, y, w, h, 'w'); P(g, x + w - 1, y, 1, h, 'L'); };
      for (const mx of [ix + 92, ix + 184]) { P(g, mx - 1, iy, 1, ih, 'k'); wood(mx, iy, 3, ih); P(g, mx + 3, iy, 1, ih, 'k'); }
      P(g, fx, fy, fw, 4, 'k'); wood(fx + 1, fy + 1, fw - 1, 3);
      P(g, fx, fy, 4, fh, 'k'); wood(fx + 1, fy + 1, 3, fh - 1);
      P(g, fx - 3, fy + fh - 4, fw + 3, 5, 'k'); wood(fx - 2, fy + fh - 3, fw + 2, 3); P(g, fx - 2, fy + fh, fw + 2, 1, 'd'); // 창턱
      for (const [x, y] of [[ix + 10, iy + 8], [ix + 100, iy + 30], [ix + 196, iy + 12]]) { line(g, x, y + 7, x + 7, y, 'w'); line(g, x + 4, y + 7, x + 7, y + 4, 'w'); }
      // 창턱 화분
      box(g, 50, 136, 8, 6, 'o'); P(g, 51, 137, 6, 1, 'y'); disc(g, 54, 132, 3, 'g', 'k'); P(g, 53, 130, 2, 1, 'h');
      // 바닥: 나무 마루
      const fl = 150;
      P(g, 0, fl, W, H - fl, 'N'); P(g, 0, fl, W, 2, 'n'); P(g, 0, fl - 3, W, 3, 'w'); P(g, 0, fl - 3, W, 1, 'k'); P(g, 0, fl, W, 1, 'k');
      for (let y = fl + 6; y < H; y += 6) { P(g, 0, y, W, 1, 'n'); for (let x = ((y / 6) & 1) * 20 + 4; x < W; x += 40) P(g, x, y - 5, 1, 5, 'n'); }
      for (let y = fl + 2; y < H; y += 6) P(g, 0, y, W, 1, 'c'); // 해 비친 결
      // 소파 (창 아래 오른쪽, 등받이 위가 아래 띠 안)
      sofa(g, 170, 140, 120, 34, 'b', 'B', 'l', 'n');
      // 쿠션
      box(g, 182, 146, 14, 12, 'y'); P(g, 183, 147, 12, 1, 'Y'); P(g, 183, 156, 12, 1, 'O');
      box(g, 264, 146, 14, 12, 'o'); P(g, 265, 147, 12, 1, 'y'); P(g, 265, 156, 12, 1, 'O');
      // 이삿짐 상자 셋 (왼쪽)
      const carton = (x, y, w, h, open) => {
        box(g, x, y, w, h, 'N'); P(g, x + 1, y + 1, w - 2, 1, 'c'); P(g, x + w - 3, y + 1, 2, h - 2, 'n');
        P(g, x + Math.floor(w / 2) - 2, y + 1, 4, Math.floor(h / 2), 'C'); // 테이프
        box(g, x + 3, y + h - 8, 10, 5, 'w'); P(g, x + 4, y + h - 6, 7, 1, 'E');
        if (open) { P(g, x - 3, y - 4, 8, 4, 'N'); P(g, x - 3, y - 4, 8, 1, 'k'); P(g, x - 3, y - 4, 1, 4, 'k'); P(g, x + w - 5, y - 4, 8, 4, 'N'); P(g, x + w + 2, y - 4, 1, 4, 'k'); P(g, x + w - 5, y - 4, 8, 1, 'k'); }
      };
      carton(4, 150, 30, 26, false); carton(8, 128, 24, 22, false); carton(36, 160, 22, 16, true);
      P(g, 39, 157, 4, 3, 'o'); P(g, 45, 155, 6, 5, 'w'); P(g, 45, 155, 6, 1, 'k'); // 상자에서 삐져나온 물건
      // 벽시계 (왼쪽 위) · 액자
      disc(g, 18, 22, 7, 'w', 'k'); P(g, 18, 17, 1, 5, 'k'); P(g, 18, 22, 4, 1, 'k'); P(g, 18, 15, 1, 1, 'r');
      box(g, 8, 44, 20, 16, 'n'); box(g, 10, 46, 16, 12, 'S'); P(g, 11, 53, 14, 4, 'g'); disc(g, 21, 49, 2, 'Y', 'y'); // 산과 해 그림
      // 주인공 (왼쪽, 열쇠를 든다) + 작은 상태창
      P(g, 62, 175, 50, 3, 'n');
      heroBig(g, 50, 74, 'Y');
      A.drawStatusWin(g, 100, 40, 28, 20, 'w');
    }

    // ───── 감싸기 (이름별 캐시) ─────
    const cache = {};
    function img(key, alt, draw) {
      if (!cache[key]) {
        const [c, g] = mk(W, H);
        A.setMap(null); try { draw(g); } finally { A.setMap(null); } // 그리다 오류가 나도 색 표가 남지 않게
        cache[key] = `<img class="px" alt="${alt}" src="${c.toDataURL()}" width="${W}" height="${H}">`;
      }
      return cache[key];
    }
    const ENDING = { top: ['호텔 맨 위층의 아침', drawTop], home: ['내 집 거실의 아침', drawHome] };
    const old = { title: Old.title, ending: Old.ending };
    const safe = (name, fn) => function () {
      try { const r = fn.apply(this, arguments); if (r != null) return r; } catch (e) { if (window.console) console.warn('pxtitle', name, e); }
      return old[name] ? old[name].apply(this, arguments) : '';
    };
    Old.title = safe('title', () => img('title', '아침의 서울역 광장', drawTitle));
    Old.ending = safe('ending', kind => ENDING[kind] ? img('ending_' + kind, ENDING[kind][0], ENDING[kind][1]) : null);
    window.PxTitle = { drawTitle, drawTop, drawHome, drawHeroCheer, W, H }; // 견본 · 점검용
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('pxtitle.js 를 불러오지 못해 예전 그림을 씁니다', e);
  }
})();
