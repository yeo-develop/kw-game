// PROTOTYPE - NOT FOR PRODUCTION
// Question: 상태창이 시키는 대로 알바 → 방 → 투자 → 집으로 올라가는 한 판이, 뭘 해야 할지 늘 분명하면서 20분 동안 재미있는가?
// Date: 2026-11-15
// 픽셀 UI 의 디자인 시스템(틀 · 버튼 · 무늬). 색은 palette.js 의 window.PX 만 쓴다.
// 불려 오는 즉시 캔버스에 점을 찍어 9-slice 틀을 만들고, data URL 을 :root 의 CSS 변수로 넣는다(index.html 의 CSS 가 border-image 로 씀).
//   틀(border-image, 9px 또는 6px): --fr-panel(크림 패널) · --fr-blue(파란 제목 띠) · --fr-sys(상태창 하늘) · --fr-card(흰 카드) · --fr-cardq(금빛 카드)
//     --fr-well(움푹한 칸) · --fr-chip(흰 칩) · --fr-chipy(노란 칩) · --fr-lock(잠긴 회색) · --fr-here(초록: 지금) · --fr-next(노랑: 다음)
//     --fr-rband(빨간 제목 띠) · --sc-w/y/r/b(작은 딱지, 4px)
//     --pl-lock · --pl-here · --pl-next · --pl-past(로드맵 그림 칸, 4px)
//     --fr-red(빨강 테두리 · 위험) · --fr-blu(파랑 테두리) · --fr-felt(도박장 초록 판) · --fr-dark(어두운 그림 칸) · --fr-key(키 딱지, 3px)
//   버튼(아래에 눌림 턱): --bt-c(크림) · --bt-o(주황 · 주된 것) · --bt-y(노랑) · --bt-g(초록) · --bt-r(빨강) · --bt-b(파랑) · --bt-e(회색 · 꺼짐)
//     각각 눌린 모양 --bt-?-d. 작은 버튼은 --bs-? / --bs-?-d (틀 6px, 턱 4px)
//   무늬: --tile-bg(연하늘 바둑판) · --dither(창 뒤를 덮는 점 무늬) · --tick(막대 눈금) · --tip-up/down/left(말풍선 꼬리)
// 함수: window.PXUI.frame(opts) · PXUI.road(ladder)(로드맵의 S자 길을 그림)
(function () {
  'use strict';
  const PX = window.PX || {};
  const root = document.documentElement.style;
  for (const k in PX) root.setProperty('--' + k, PX[k]); // --k · --c · --b … (대소문자 구분)
  root.setProperty('--px-font', window.PXFONT || "'DungGeunMo', monospace");

  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return [c, g]; }
  const col = k => PX[k] || k;

  // 9-slice 틀: n 칸 모서리(계단) + 어두운 외곽선 + 위 · 왼쪽 밝은 한 칸 + 아래 · 오른쪽 어두운 한 칸. u = 한 칸의 화면 px.
  // lip = 아래 눌림 턱(칸 수). down = 눌린 모양(몸통이 lip 만큼 내려앉고 턱이 없어짐 — 그림 크기는 같다).
  function frame(o) {
    const u = o.u || 3, n = o.n || 3, N = n * 2 + 2, lip = o.lip || 0, H = N + lip, out = o.out || 'k';
    const [c, g] = mk(N * u, H * u);
    const shape = (x, y) => x >= 0 && y >= 0 && x < N && y < N && Math.min(x, N - 1 - x) + Math.min(y, N - 1 - y) >= 2;
    const px = (x, y, k) => { if (!k) return; g.fillStyle = col(k); g.fillRect(x * u, y * u, u, u); };
    const edge = (x, y) => !shape(x - 1, y) || !shape(x + 1, y) || !shape(x, y - 1) || !shape(x, y + 1);
    const dy = o.down ? lip : 0;
    if (lip && !o.down) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (shape(x, y)) px(x, y + lip, edge(x, y) ? out : o.lipc);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (!shape(x, y)) continue;
      if (edge(x, y)) { px(x, y + dy, out); continue; }
      const tl = !shape(x - 2, y) || !shape(x, y - 2) || !shape(x - 1, y - 1);
      const br = !shape(x + 2, y) || !shape(x, y + 2) || !shape(x + 1, y + 1);
      px(x, y + dy, tl && o.hi ? o.hi : br && o.lo ? o.lo : o.fill);
    }
    return 'url(' + c.toDataURL() + ')';
  }

  const F = {
    'fr-panel': { fill: 'c', hi: 'w', lo: 'd' },
    'fr-blue': { fill: 'b', hi: 'l', lo: 'B' },
    'fr-sys': { fill: 'S', hi: 'w', lo: 's', out: 'B' },
    'fr-card': { fill: 'w', hi: 'w', lo: 'C' },
    'fr-cardq': { fill: 'Y', hi: 'w', lo: 'y', out: 'O' },
    'fr-red': { fill: 'c', hi: 'w', lo: 'd', out: 'R' },
    'fr-blu': { fill: 'c', hi: 'w', lo: 'd', out: 'B' },
    'fr-felt': { fill: 'g', hi: 'h', lo: 'G', out: 'G' },
    'fr-dark': { u: 2, fill: 'k', hi: 'H', lo: 'k', out: 'k' },
    'fr-well': { u: 2, fill: 'C', hi: 'd', lo: 'w' },
    'fr-chip': { u: 2, fill: 'w', hi: 'w', lo: 'L' },
    'fr-chipy': { u: 2, fill: 'y', hi: 'Y', lo: 'o' },
    'fr-chipg': { u: 2, fill: 'h', hi: 'w', lo: 'g', out: 'G' },
    'fr-chipr': { u: 2, fill: 'r', hi: 'w', lo: 'R', out: 'R' },
    'fr-chipb': { u: 2, fill: 'l', hi: 'S', lo: 'b', out: 'B' },
    'fr-lock': { u: 2, fill: 'L', hi: 'w', lo: 'e', out: 'E' },
    'fr-here': { u: 2, fill: 'h', hi: 'w', lo: 'g', out: 'G' },
    'fr-next': { u: 2, fill: 'Y', hi: 'w', lo: 'y', out: 'O' },
    'fr-past': { u: 2, fill: 'C', hi: 'c', lo: 'd', out: 'N' },
    'fr-key': { u: 1, fill: 'w', hi: 'w', lo: 'L', out: 'E' },
    'fr-rband': { fill: 'r', hi: 'P', lo: 'R' },
    // 작은 딱지(4px 틀, 높이 24px): 칭호 · 지금 여기 · 다음 목표 · 추천 · 탭
    'sc-w': { u: 2, n: 2, fill: 'w', hi: 'w', lo: 'L' },
    'sc-y': { u: 2, n: 2, fill: 'y', hi: 'Y', lo: 'o' },
    'sc-r': { u: 2, n: 2, fill: 'r', hi: 'P', lo: 'R' },
    'sc-b': { u: 2, n: 2, fill: 'l', hi: 'S', lo: 'b' },
    // 로드맵 그림 칸(4px 틀): 64px 그림 + 틀 = 72px
    'pl-lock': { u: 2, n: 2, fill: 'L', hi: 'w', lo: 'e', out: 'E' },
    'pl-here': { u: 2, n: 2, fill: 'h', hi: 'w', lo: 'g', out: 'G' },
    'pl-next': { u: 2, n: 2, fill: 'Y', hi: 'w', lo: 'y', out: 'O' },
    'pl-past': { u: 2, n: 2, fill: 'C', hi: 'c', lo: 'd', out: 'N' },
  };
  for (const k in F) root.setProperty('--' + k, frame(F[k]));
  const B = { c: ['c', 'w', 'd', 'N'], o: ['o', 'y', 'O', 'O'], y: ['y', 'Y', 'o', 'O'], g: ['g', 'h', 'G', 'G'], r: ['r', 'w', 'R', 'R'], b: ['l', 'S', 'b', 'B'], e: ['L', 'w', 'e', 'E'] };
  for (const k in B) {
    const [fill, hi, lo, lipc] = B[k], out = k === 'e' ? 'E' : 'k';
    root.setProperty('--bt-' + k, frame({ fill, hi, lo, lip: 2, lipc, out }));
    root.setProperty('--bt-' + k + '-d', frame({ fill, hi, lo, lip: 2, lipc, out, down: true }));
    root.setProperty('--bs-' + k, frame({ u: 2, fill, hi, lo, lip: 2, lipc, out }));
    root.setProperty('--bs-' + k + '-d', frame({ u: 2, fill, hi, lo, lip: 2, lipc, out, down: true }));
  }

  // 무늬
  function tile(w, h, s, draw) { const [c, g] = mk(w, h); draw((x, y, ww, hh, k) => { g.fillStyle = col(k); g.fillRect(x, y, ww, hh); }); const [c2, g2] = mk(w * s, h * s); g2.drawImage(c, 0, 0, w * s, h * s); return 'url(' + c2.toDataURL() + ')'; }
  root.setProperty('--tile-bg', tile(16, 16, 3, P => { P(0, 0, 16, 16, 'S'); P(0, 0, 8, 8, 'q'); P(8, 8, 8, 8, 'q'); P(3, 11, 1, 1, 'w'); P(12, 3, 1, 1, 'w'); }));
  root.setProperty('--dither', tile(2, 2, 2, P => { P(0, 0, 1, 1, 'k'); P(1, 1, 1, 1, 'k'); }));
  root.setProperty('--tick', tile(6, 1, 2, P => { P(5, 0, 1, 1, 'k'); }));
  const tip = rows => tile(rows[0].length, rows.length, 2, P => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') P(x, y, 1, 1, ch); })));
  root.setProperty('--tip-down', tip(['kkkkkkkkk', '.kcccccK.', '..kcccK..', '...kcK...', '....k....'].map(r => r.replace(/K/g, 'k'))));
  root.setProperty('--tip-up', tip(['....k....', '...kck...', '..kccck..', '.kccccck.', 'kkkkkkkkk']));
  root.setProperty('--tip-left', tip(['....k', '...kk', '..kck', '.kcck', 'kccck', '.kcck', '..kck', '...kk', '....k']));

  // 로드맵의 S자 길: 윗줄 1→5, 오른쪽 끝에서 둥글게 꺾어 아랫줄 5→1 (아랫줄은 오른쪽부터 6→10).
  // ladder 안의 .th(그림 칸)들의 가운데를 이어, 뒤에 깐 캔버스에 점을 찍어 그린다 (화면 2px = 점 하나).
  function road(lad) {
    if (!lad || !lad.offsetWidth) return;
    const th = [...lad.querySelectorAll('.rung > .th')];
    if (th.length < 10) return;
    let cv = lad.querySelector(':scope > canvas.road');
    if (!cv) { cv = document.createElement('canvas'); cv.className = 'road px'; cv.setAttribute('aria-hidden', 'true'); lad.insertBefore(cv, lad.firstChild); }
    const u = 2, W = Math.ceil(lad.clientWidth / u), H = Math.ceil(lad.clientHeight / u);
    cv.width = W; cv.height = H; cv.style.width = W * u + 'px'; cv.style.height = H * u + 'px';
    const g = cv.getContext('2d');
    const ctr = e => { const r = e.parentElement; return [(r.offsetLeft + e.offsetLeft + e.offsetWidth / 2) / u, (r.offsetTop + e.offsetTop + e.offsetHeight / 2) / u]; };
    const p = th.map(ctr), y1 = Math.round(p[0][1]), y2 = Math.round(p[5][1]), gx = W - 8, rr = 7;
    const pts = [];
    const line = (xa, ya, xb, yb) => { const n = Math.max(Math.abs(xb - xa), Math.abs(yb - ya)); for (let i = 0; i <= n; i++) pts.push([xa + (xb - xa) * i / n, ya + (yb - ya) * i / n]); };
    const arc = (cx, cy, a0, a1) => { for (let i = 0; i <= 24; i++) { const a = a0 + (a1 - a0) * i / 24; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } };
    line(Math.round(p[0][0]), y1, gx - rr, y1); arc(gx - rr, y1 + rr, -Math.PI / 2, 0); line(gx, y1 + rr, gx, y2 - rr); arc(gx - rr, y2 - rr, 0, Math.PI / 2); line(gx - rr, y2, Math.round(p[9][0]), y2);
    const stamp = (w, k) => { g.fillStyle = col(k); const h = Math.floor(w / 2); for (const [x, y] of pts) g.fillRect(Math.round(x) - h, Math.round(y) - h, w, w); };
    g.clearRect(0, 0, W, H);
    stamp(9, 'n'); stamp(7, 'N'); stamp(5, 'd');
    g.fillStyle = col('N'); pts.forEach(([x, y], i) => { if (i % 6 === 0) g.fillRect(Math.round(x), Math.round(y), 1, 1); });
  }

  window.PXUI = { frame, road, mk };
})();
