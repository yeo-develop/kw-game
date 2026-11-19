// 미니게임 난이도를 사람 손 모형으로 잰다 (브라우저 없이).
// 쓰는 법: node tools/mg-model.js [폴더] [씨앗 수] [pace 넷을 쉼표로]   예) node tools/mg-model.js . 40 1.2,1.6,2,2.4 (안 주면 config.js 의 mg_int_0..3)
//          node tools/mg-model.js [폴더] demo [pace 넷]   — 시연 확인: 게임 넷 × 강도 넷 × 숙련 0 · 3. 30초에 오류 · 누름 · loops · rng 를 보고,
//          점수 평균은 같은 시연을 5분까지 이어서 (30초 = 세 판이라 한 판의 실수에 너무 흔들림)
// 손 셋: 완벽한 손 · 잘하는 사람 · 보통 사람. 손은 minigames.js 의 Minigames._hand (시연과 같은 손, 화면에 보이는 것만 읽음)에
// 반응 · 박자 오차 · 헷갈림을 입힌 것. 손의 난수는 판의 난수와 따로.
const fs = require('fs'), path = require('path'), vm = require('vm');
const dir = process.argv[2] || '.';
const demoMode = process.argv[3] === 'demo';
const seeds = demoMode ? 0 : Math.max(1, +process.argv[3] || 40);
global.window = {}; require(path.resolve(dir, 'config.js'));
const paces = process.argv[4] ? process.argv[4].split(',').map(Number) : [0, 1, 2, 3].map(n => window.CONFIG['mg_int_' + n].value);   // 기본은 config.js 의 값
const cv = (k, d) => (process.env.NOWARM ? d : window.CONFIG[k] ? window.CONFIG[k].value : d);
const START = { ready: cv('mg_ready', 0.8), warm: cv('mg_warm', 1), warmSec: cv('mg_warm_sec', 0) };   // 준비 시간 · 느린 시작 (NOWARM=1 이면 끄고 잰다 — 견주기용)
const file = path.join(dir, 'minigames.js');
const ctx = { console: console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
const M = ctx.Minigames;
function mulberry(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const INT = ['하', '중', '상', '최상'], DT = 1 / 60;

if (demoMode) {
  let bad = 0;
  console.log('게임\t강도\tloops(30초)\t누름(30초)\trng\t숙련0 판·평균\t숙련3 판·평균\t오류');
  for (const id of M.list) for (let n = 0; n < 4; n++) {
    let calls = 0, presses = 0, loops = 0, err = '';
    const sc = [[], []];
    try {
      for (const li of [0, 1]) {
        const d = M.demo(id, Object.assign({ rng: function () { calls++; return 0.5; }, intensity: n, pace: paces[n], level: li * 3 }, START));
        let last = null;
        for (let f = 0; f < 18000; f++) {
          d.update(DT);
          if (f === 1799 && !li) loops = d.loops;
          if (d.lastPress && d.lastPress.age === 0 && f < 1800 && !li) presses++;
          if (d.result && d.result !== last) { last = d.result; sc[li].push(d.result.score); }
          if (d.done) throw new Error('done 이 true');
        }
      }
    } catch (e) { err = e.message; }
    const avg = function (a) { return a.reduce(function (x, y) { return x + y; }, 0) / Math.max(1, a.length); };
    const ok = !err && presses > 0 && loops >= 2 && calls === 0 && avg(sc[0]) >= 0.85 && avg(sc[1]) >= 0.85;
    if (!ok) bad++;
    console.log([id, INT[n], loops, presses, calls, sc[0].length + '·' + avg(sc[0]).toFixed(3), sc[1].length + '·' + avg(sc[1]).toFixed(3), err || (ok ? '-' : '기준 미달')].join('\t'));
  }
  console.log(bad ? '실패 ' + bad : '모두 통과');
  process.exit(bad ? 1 : 0);
}

const HANDS = [
  ['완벽한 손', null],
  ['잘하는 사람', { react: 0.22, rsd: 0.04, rlo: 0.12, rhi: 0.4, tsd: 0.035, wrong: 0.02, chain: 0.11, pick: 0.12 }],
  ['보통 사람', { react: 0.30, rsd: 0.07, rlo: 0.18, rhi: 0.5, tsd: 0.06, wrong: 0.06, chain: 0.15, pick: 0.2 }],
];
const GR = ['grade_ok', 'grade_good', 'grade_perfect'].map(k => window.CONFIG[k].value);   // 등급 기준은 config.js 에서
function grade(x) { return x >= GR[2] - 1e-9 ? 3 : x >= GR[1] - 1e-9 ? 2 : x >= GR[0] - 1e-9 ? 1 : 0; }
function run(id, n, level, prof, seed) {
  const g = M.create(id, Object.assign({ rng: mulberry(seed), intensity: n, pace: paces[n], level: level, font: 'x' }, START));
  const hand = M._hand(id, prof, mulberry(seed * 977 + 13));
  for (let f = 0; !g.done && f < 60 * 20; f++) {
    const code = hand(g._state, DT);
    if (code) g.press(code);
    g.update(DT);
  }
  return g.result.score;
}
console.log('pace ' + paces.join(' · ') + ' · 준비 ' + START.ready + '초 · 느린 시작 ×' + START.warm + ' → 1 (' + START.warmSec + '초) · 씨앗 ' + seeds + ' · 칸: 평균 (실수/보통/잘함/완벽 %)');
console.log(['게임', '강도', '숙련'].concat(HANDS.map(function (h) { return h[0]; })).join('\t'));
const sum = {};
for (const id of M.list) for (let n = 0; n < 4; n++) for (const level of [0, 3]) {
  const cells = HANDS.map(function (h, hi) {
    const dist = [0, 0, 0, 0];
    let tot = 0;
    for (let s = 1; s <= seeds; s++) { const x = run(id, n, level, h[1], s * 7 + 1000 * level + 1); tot += x; dist[grade(x)]++; }
    const k = hi + '/' + n + '/' + level;
    sum[k] = (sum[k] || 0) + tot / seeds / M.list.length;
    return (tot / seeds).toFixed(2) + ' (' + dist.map(function (c) { return Math.round(100 * c / seeds); }).join('/') + ')';
  });
  console.log([id, INT[n], level].concat(cells).join('\t'));
}
console.log('-- 네 게임 평균');
for (let n = 0; n < 4; n++) for (const level of [0, 3]) console.log(['평균', INT[n], level].concat(HANDS.map(function (h, hi) { return sum[hi + '/' + n + '/' + level].toFixed(2); })).join('\t'));
