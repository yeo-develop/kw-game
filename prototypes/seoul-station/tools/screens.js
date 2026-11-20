// PROTOTYPE - NOT FOR PRODUCTION
// 게임이 불러오지 않는 개발용 도구. 화면 없는 브라우저(Playwright)는 KW_PLAYWRIGHT 환경 변수로 위치를 줄 수 있다.
// "모든 화면" 모음 한 장을 만든다 (와이어프레임 검사 · 화면 검토용). 창 없이 돈다.
//   1) 기존 도구 넷이 찍은 화면을 쓴다: <내보낼 폴더>/c (check.js) · t (tut.js) · w (worst.js) · r (rt.js). 폴더가 없으면 그 도구를 돌려 만든다.
//   2) 그 도구들이 안 찍는 화면을 더 찍는다: <내보낼 폴더>/x (미니게임 열의 하는 중 — 완벽한 손이 2.4초쯤 한 때)
//   3) 화면 목록(tools/screens.json: 묶음 · 파일 · 이름 · 설명)대로 index.html 한 장을 만든다 — 그림은 data URI 로 안에 넣는다(파일 하나 = 주소 하나인 곳에 그대로 올림).
// node tools/screens.js <게임 폴더> <내보낼 폴더>     없는 그림이 있으면 그 이름을 적고 1 로 끝난다.
const path = require('path'), fs = require('fs'), cp = require('child_process');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..')), out = path.resolve(process.argv[3] || path.join(dir, 'evidence', 'screens'));
fs.mkdirSync(out, { recursive: true });
const sub = n => path.join(out, n);
const TOOLS = { c: ['check.js', dir, sub('c'), '5', 'study'], t: ['tut.js', dir, sub('t')], w: ['worst.js', dir, sub('w')], r: ['rt.js', dir, sub('r')] };
for (const k in TOOLS) {
  if (fs.existsSync(sub(k)) && fs.readdirSync(sub(k)).some(f => f.endsWith('.png'))) continue;
  const a = TOOLS[k];
  console.log('찍는 중:', a[0]);
  const r = cp.spawnSync('node', [path.join(dir, 'tools', a[0])].concat(a.slice(1)), { encoding: 'utf8', timeout: 400000, maxBuffer: 1 << 26 });
  if (r.status !== 0) console.log('  (끝난 코드 ' + r.status + ' — 찍힌 그림은 그대로 씀)');
}

async function extras() {
  const { chromium } = require(process.env.KW_PLAYWRIGHT || '/Users/admin/projects/outsourcing/high-order-front/node_modules/playwright');
  fs.mkdirSync(sub('x'), { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('file://' + path.join(dir, 'index.html') + '?manual=1&seed=5');
  const G = (fn, arg) => page.evaluate(fn, arg);
  await page.click('[data-do="new"]');
  // st: 창이 막 뜬 직후에는 누름이 잠깐 막힌다(guard) — 그만큼 더 흘려보낸 뒤에 누른다
  await G(() => { const g = window.game; window.__st = n => { g.step(n); const left = g.state.guard || 0; if (left) g.step(left + 1); }; window.__clear = () => { for (let i = 0; i < 12 && g.state.modal; i++) { g.press(g.state.modal === 'mg' ? 'Escape' : 'Space'); window.__st(30); } return g.state.modal; }; window.__st(30); window.__clear(); });
  for (const id of ['flyer', 'loading', 'store', 'delivery', 'cafe', 'tutor', 'driver', 'lecture', 'tv', 'advise']) { // 하는 중: 중 강도 · 숙련 0, 완벽한 손이 3초쯤 한 때 (새 일 여섯은 호텔 · 저녁 칸에서)
    const r = await G(id => {
      const g = window.game, S = g.state.raw, st = window.__st;
      const late = ['cafe', 'tutor', 'driver', 'lecture', 'tv', 'advise'].indexOf(id) >= 0;
      Object.assign(S, { tier: late ? 8 : 3, lease: late ? 'own' : 'rent', homeVal: late ? 8000000000 : 0, slot: late ? 2 : 0, quest: 99, offer: null, picks: 0, event: null, hp: 100, inten: {}, did: null }); S.market.world = []; g.render();
      g.run('job', id); st(10); g.press('Space'); st(4);
      if (!g.mg) return '시작되지 않음 (창: ' + g.state.modal + ')';
      const hand = window.Minigames._hand(id, null, () => 0.5);
      for (let i = 0; i < 230 && g.mg && !g.mg.done; i++) { const code = hand(g.mg._state, 1 / 60); if (code) g.press(code); g.step(1); }
      return '';
    }, id);
    if (r) { errs.push(id + ': ' + r); continue; }
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(sub('x'), 'mg_' + id + '.png') });
    await G(() => { const g = window.game; for (let i = 0; i < 900 && g.state.modal === 'mg' && !document.querySelector('.mg-res'); i++) g.step(1); window.__st(80); g.press('Space'); window.__st(30); for (let i = 0; i < 12 && g.state.modal; i++) { g.press('Space'); window.__st(30); if (g.state.modal === 'perk') { g.press('Digit1'); window.__st(30); } } });
  }
  await browser.close();
  if (errs.length) { console.log('더 찍는 중 오류:', errs.join(' | ')); process.exitCode = 1; }
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function build() {
  const M = JSON.parse(fs.readFileSync(path.join(__dirname, 'screens.json'), 'utf8'));
  const missing = [];
  let n = 0;
  const secs = M.sections.map((sec, si) => {
    const cards = sec.items.map(it => {
      const f = path.join(out, it.f + '.png');
      if (!fs.existsSync(f)) { missing.push(it.f); return ''; }
      n++;
      const code = sec.code + '-' + String(sec.items.indexOf(it) + 1).padStart(2, '0');
      const src = 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
      return '<figure class="shot" id="' + code + '"><button type="button" class="pic" data-code="' + code + '" data-name="' + esc(it.t) + '" aria-label="' + esc(it.t) + ' 크게 보기"><img loading="lazy" alt="' + esc(it.t) + '" src="' + src + '"></button>' +
        '<figcaption><span class="code">' + code + '</span><b>' + esc(it.t) + '</b><p>' + esc(it.d || '') + '</p></figcaption></figure>';
    }).join('\n');
    return '<section id="s' + (si + 1) + '"><h2><span class="code">' + sec.code + '</span>' + esc(sec.title) + '<small>' + sec.items.length + '장</small></h2>' + (sec.note ? '<p class="note">' + esc(sec.note) + '</p>' : '') + '<div class="grid">' + cards + '</div></section>';
  }).join('\n');
  const nav = M.sections.map((sec, si) => '<a href="#s' + (si + 1) + '"><span class="code">' + sec.code + '</span>' + esc(sec.short || sec.title) + '</a>').join('');
  const zones = M.zones.map(z => { // 낮은 띠(위쪽 띠)는 이름 · 설명을 한 줄에 왼쪽부터, 나머지는 가운데에 두 줄
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2, flat = z.h <= 120;
    return '<g><rect x="' + z.x + '" y="' + z.y + '" width="' + z.w + '" height="' + z.h + '" class="z"/>' +
      (flat ? '<text x="' + (z.x + 24) + '" y="' + cy + '" class="zt" style="text-anchor:start">' + esc(z.name) + '</text><text x="' + (z.x + 170) + '" y="' + (cy + 1) + '" class="zd" style="text-anchor:start">' + esc(z.what) + '</text>'
        : '<text x="' + cx + '" y="' + (cy - 14) + '" class="zt">' + esc(z.name) + '</text><text x="' + cx + '" y="' + (cy + 22) + '" class="zd">' + esc(z.what) + '</text>') + '</g>';
  }).join('');
  const flow = M.flow.map(s => '<li>' + (s.code ? '<a href="#' + s.code + '">' : '<span>') + '<b>' + esc(s.t) + '</b><i>' + esc(s.d) + '</i>' + (s.code ? '</a>' : '</span>') + '</li>').join('');
  const html = fs.readFileSync(path.join(__dirname, 'screens.tpl.html'), 'utf8')
    .replace('{{TITLE}}', esc(M.title)).replace('{{TITLE2}}', esc(M.title)).replace('{{LEAD}}', esc(M.lead)).replace('{{FACTS}}', M.facts.map(f => '<li><b>' + esc(f[0]) + '</b>' + esc(f[1]) + '</li>').join(''))
    .replace('{{COUNT}}', String(n)).replace('{{DATE}}', esc(M.date)).replace('{{NAV}}', nav).replace('{{FLOW}}', flow).replace('{{ZONES}}', zones).replace('{{SECTIONS}}', () => secs);
  fs.writeFileSync(path.join(out, 'index.html'), html);
  console.log('화면 ' + n + '장 · ' + M.sections.length + '묶음 · ' + Math.round(fs.statSync(path.join(out, 'index.html')).size / 1024) + ' KB → ' + path.join(out, 'index.html'));
  if (missing.length) { console.log('없는 그림 ' + missing.length + ': ' + missing.join(', ')); process.exitCode = 1; }
}

(async () => {
  if (!fs.existsSync(sub('x')) || fs.readdirSync(sub('x')).length < 4) await extras();
  build();
})().catch(e => { console.error('실패', e); process.exit(2); });
