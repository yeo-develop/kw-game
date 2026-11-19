// PROTOTYPE - NOT FOR PRODUCTION
// Question: 상태창이 시키는 대로 알바 → 방 → 투자 → 집으로 올라가는 한 판이, 뭘 해야 할지 늘 분명하면서 20분 동안 재미있는가?
// Date: 2026-11-13
// 화면과 입력. 규칙은 rules.js, 그림은 art.js, 미니게임은 minigames.js, 조율 값은 config.js.
// play 화면은 구역 다섯 개(hud · me · quest · today · board)로 나뉘고, 글 대신 아이콘(Art.icon)을 쓴다. 아이콘의 뜻은 title 과 도움말(?)에 있다.
// board 는 투자가 열리기 전에는 로드맵(서울역 → 한국 최고 부자, 열 단계), 열린 뒤에는 주식 · 코인 탭. 로드맵은 그 뒤 '나' 구역 머리의 버튼으로 여는 창.
// 기한은 없다("N일째"로만 센다). 내 집 = 1막 끝(축하 창 뒤 계속), 호텔에서 "한국 최고 부자" 선언 = 엔딩. 사업 줄 · 대출 줄은 생긴 뒤에만 '나' 구역에 붙는다.
// 돈은 숫자로(R.won · 좁은 곳은 R.num). 위쪽 띠의 현금 · 순자산과 미니게임 일당 · 밤 정산 합계는 step() 안에서 프레임으로 굴러간다(rolls).
// 처음 하는 사람에게는 첫 판 안내(coach)가 첫날을 따라가며 한 곳씩 짚어 주고, 알바는 늘 시작 전 화면(시연 · 강도 고르기)부터.
(function () {
  'use strict';

  // ── 점검이 읽는 것들: 고정 간격 · 시계 · window.game · play/figures 장면 ──
  const params = new URLSearchParams(location.search);
  const CONFIG = window.CONFIG, PAL = window.PAL, FONT = window.FONT, R = window.Rules;
  const tune = new Proxy({}, { get: (_, k) => { const c = CONFIG[k]; return c && typeof c === 'object' ? c.value : c; } }); // 늘 지금 값을 읽는다
  R.setTune(tune);
  const STEP = 1 / 60;
  const clock = window.GAME_CLOCK || { now: () => performance.now() / 1000 };
  const MANUAL = params.get('manual') === '1';
  const GUIDE = params.get('tut') === '1' || (params.get('tut') !== '0' && !MANUAL); // 처음 하는 사람을 위한 안내를 쓰는 창인가 (점검 도구는 ?tut=1 일 때만)
  const SAVE = 'seoul-station-save-v1', RUNS = 'seoul-station-runs', META = 'seoul-station-meta-v1';
  const SLOTS = ['오전', '오후', '저녁'], SLOT_IC = ['sun', 'noon', 'moon'], PHASE = ['morning', 'day', 'evening', 'night'];
  const events = [];
  const $ = id => document.getElementById(id);
  const stage = $('stage');
  // 화면 색은 px.js 가 :root 에 --k · --c … (window.PX) 로 넣는다. PAL(예전 밤 색)은 벡터 그림 · 미니게임 몫
  const PX = window.PX || {};

  let scene = 'title', S = null; // S = 규칙의 상태 (window.game.state 가 요약해서 보여 줌)
  const ui = { tab: 'road', sview: 'market', sel: 'daejang', qty: 1, bamt: 0, lev: 2, share: 0.25, from: null, askNew: false, modal: null, queue: [], guard: 0, mute: false, fresh: {}, flash: {}, cash: 0, worth: 0, flyN: 0, name: '', ending: false, say: null, sayT: 0, newAch: [], tut: false, coach: '', coachDirty: false, toastQ: [], toastCap: 2 };

  // 판 밖에 남는 것: 업적 · 기록 · 설정 (판 저장과 따로)
  function loadMeta() {
    // runs: 시작한 판 · homes: 내 집(1막 끝)에 간 판 · act1Best/act1Rank: 가장 빨리 산 내 집 · wins: 엔딩(한국 최고 부자) · bestDay/bestRank: 가장 빠른 엔딩 · bestTier: 가장 높이 간 곳
    const d = { mv: 2, ach: {}, runs: 0, homes: 0, act1Best: 0, act1Rank: '', wins: 0, bestDay: 0, bestRank: '', bestTier: 0, fxOff: false, tut: 0, seen: {}, look: 0 }; // look: 고른 후드 색 // tut: 첫 판 안내를 0 안 봄 · 1 보는 중 · 2 끝냄(또는 끔). seen: 한 번씩만 뜨는 설명 중 본 것
    if (MANUAL) return d;
    let old = {};
    try { old = JSON.parse(localStorage.getItem(META) || '{}') || {}; } catch (e) { /* 못 읽으면 처음부터 */ }
    if (old.mv !== 2) { // 28일 · 집 = 엔딩이던 때의 기록: 집을 산 것은 이제 1막 끝(내 집)
      old.homes = old.wins || 0; old.act1Best = old.bestDay || 0; old.act1Rank = old.bestRank || '';
      old.wins = 0; old.bestDay = 0; old.bestRank = ''; delete old.bestPct; old.mv = 2;
    }
    Object.assign(d, old);
    if (!d.seen || typeof d.seen !== 'object') d.seen = {};
    return d;
  }
  const meta = loadMeta();
  function saveMeta() { if (MANUAL) return; try { localStorage.setItem(META, JSON.stringify(meta)); } catch (e) { /* 저장을 못 써도 게임은 됨 */ } }
  const achCount = () => Object.keys(meta.ach).length;
  const GUIDES = ['flyer', 'loading', 'store', 'delivery', 'stock', 'coin']; // 한 번씩만 뜨는 설명: 알바 하는 법 넷 · 주식 · 코인(연습)
  function guideOff() { meta.tut = 2; for (const id of GUIDES) meta.seen[id] = 1; saveMeta(); }
  function guideOn() { meta.tut = 0; meta.seen = {}; saveMeta(); }

  const A = window.Art || {};
  function art(fn) { try { return A[fn] ? A[fn].apply(A, Array.prototype.slice.call(arguments, 1)) : ''; } catch (e) { return ''; } }
  const I = (n, title, cls) => '<span class="ic' + (cls ? ' ' + cls : '') + '"' + (title ? ' title="' + title + '"' : '') + '>' + art('icon', n) + '</span>'; // 아이콘 (뜻은 title 로)
  const won = R.won, num = R.num;
  const pct = (v, d) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(d == null ? 1 : d) + '%';
  const sign = n => (n >= 0 ? '+' : '') + won(n);
  const cls = v => (v > 0 ? 'up' : v < 0 ? 'down' : 'dim');
  const arrow = (v, title) => '<span class="' + cls(v) + '">' + I(v > 0 ? 'up' : 'down', title || (v > 0 ? '오름' : '내림'), 's') + '</span>';
  const wid = t => [...String(t)].reduce((w, ch) => w + (ch.charCodeAt(0) > 0x2e7f ? 2 : 1), 0); // 둥근모꼴의 폭: 한글 등은 2칸, 영문 · 숫자 · 기호는 1칸 (16px 글자에서 1칸 = 8px)
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const r1k = n => Math.round(n / 1000) * 1000;
  const loanWeekly = (L, rate) => (L > 0 ? r1k(L * (rate == null ? R.creditView(S).mort : rate)) + Math.min(L, r1k(L / tune.loan_weeks)) : 0); // 빌린 돈 L 의 한 주 원리금 (rules 의 homeInfo.weekly 와 같은 셈 — 이자는 지금 신용등급의 것)
  const jo = (w, a, b) => ((w.charCodeAt(w.length - 1) - 0xAC00) % 28 ? a : b); // 받침이 있으면 a
  const eok = n => { const v = n / 1e8; return (v >= 10 ? Math.floor(v) : Math.floor(v * 10) / 10) + '억'; }; // 1억 이상 금액의 단위 길잡이 (숫자 표기는 그대로, 옆에 작게)
  const eokTag = n => (n >= 1e8 ? ' <i class="u">' + eok(n) + '</i>' : '');
  const shortWon = n => (n >= 1e8 ? eok(n) : num(n)); // 좁은 칸의 금액: 1억이 넘으면 "350억"처럼 (전부는 title)
  const BY = { study: '리포트', tip: '귀띔', chat: '리딩방' }; // 리포트를 어디서 얻었나

  // ── 화면 맞춤: 1280×720 을 창에 맞춰 통째로 ──
  // 창이 무대보다 크면(f ≥ 1) 점 하나가 화면의 점(기기 픽셀) 정수 개가 되는 배율로 내려 맞춘다: n = floor(f × dpr), k = n / dpr.
  // 기기 배율이 1.25 · 1.5 인 화면(윈도우 125% 등)에서는 k 가 1보다 작아질 수 있다 — 점이 고른 것이 먼저(예: dpr 1.25 · f 1.3 → n 1 → k 0.8).
  // n 이 1도 안 되면(f × dpr < 1) 그대로 f. 창이 더 작으면(f < 1) 그대로 줄인다. 남는 테두리는 같은 바둑판, 무대는 가운데.
  function fit() {
    const f = Math.min(innerWidth / 1280, innerHeight / 720), dpr = window.devicePixelRatio || 1;
    const n = Math.floor(f * dpr + 1e-6), k = f >= 1 ? Math.max(1, n / dpr) : f; // 창이 커지는데 무대가 작아지는 일은 없게: 1배 아래로는 내려 맞추지 않는다
    const snap = v => Math.round(v * dpr) / dpr, x = snap((innerWidth - 1280 * k) / 2), y = snap((innerHeight - 720 * k) / 2);
    stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + k + ')';
    const bs = document.body && document.body.style;
    if (bs) { bs.backgroundSize = 48 * k + 'px ' + 48 * k + 'px'; bs.backgroundPosition = x + 'px ' + y + 'px'; } // 테두리의 바둑판이 무대의 바둑판과 이어지게
  }
  addEventListener('resize', fit); fit();

  // ── 소리: 첫 입력 때 켜짐, M 으로 끔 ──
  let audio = null;
  function startAudio() {
    if (!audio) {
      try {
        const ac = window.GAME_AUDIO || new (window.AudioContext || window.webkitAudioContext)();
        const out = ac.createGain(); out.gain.value = ui.mute ? 0 : tune.volume; out.connect(ac.destination); audio = { ac, out };
      } catch (e) { audio = null; return; }
    }
    if (audio.ac.state === 'suspended') audio.ac.resume();
  }
  function setMute(m) { ui.mute = m; if (audio) audio.out.gain.value = m ? 0 : tune.volume; if (scene === 'play') renderHud(); }
  addEventListener('tune', () => setMute(ui.mute));
  function tone(freq, dur, type, vol, delay) {
    if (!audio || ui.mute) return;
    const t = audio.ac.currentTime + (delay || 0), o = audio.ac.createOscillator(), g = audio.ac.createGain();
    o.type = type || 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(audio.out); o.start(t); o.stop(t + dur);
  }
  const sfx = {
    click: () => tone(520, 0.05, 'square', 0.08),
    pay: () => { tone(660, 0.09, 'triangle', 0.22); tone(990, 0.16, 'triangle', 0.22, 0.08); },
    ding: () => { tone(784, 0.12, 'sine', 0.25); tone(988, 0.12, 'sine', 0.25, 0.09); tone(1319, 0.3, 'sine', 0.25, 0.18); },
    up: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 'triangle', 0.22, i * 0.09)); },
    level: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.2, 'square', 0.12, i * 0.07)); },
    deny: () => tone(150, 0.16, 'sawtooth', 0.12),
    bad: () => { tone(330, 0.2, 'sawtooth', 0.16); tone(196, 0.4, 'sawtooth', 0.16, 0.16); },
    night: () => { tone(392, 0.25, 'sine', 0.16); tone(294, 0.4, 'sine', 0.16, 0.2); },
    stamp: () => tone(110, 0.12, 'square', 0.2),
    tick: () => tone(1760, 0.018, 'square', 0.035), // 숫자가 굴러가는 동안 (다라라락)
    dice: () => tone(240 + fr() * 160, 0.03, 'square', 0.05),
  };

  // ── 굴러가는 숫자: 값이 바뀌면 ROLL 걸음(0.6초) 동안 굴러서 따라간다. step() 이 한 걸음씩 민다 (수동 걸음에서도 같음). 효과 줄이기면 바로 ──
  const ROLL = 36, rolls = {}; // key → { v(보이는 값), from, to, f, n, id(글자를 바꿀 요소), fmt }
  const ease = t => 1 - Math.pow(1 - t, 3);
  function rollTo(key, to, id, fmt, from) { // from 을 주면 그 값에서 새로 굴림 (창이 새로 뜬 때)
    let r = rolls[key];
    if (!r) r = rolls[key] = { v: from == null ? to : from, from: 0, to: from == null ? to : from, f: 0, n: 0 };
    if (from != null) r.v = from;
    r.id = id; r.fmt = fmt;
    if (r.to !== to || from != null) { r.from = r.v; r.to = to; r.f = 0; r.n = calm() ? 0 : Math.round(ROLL * rollSize(r.v, to)[0]); r.big = to > r.v && rollSize(r.v, to)[1] >= 2; if (!r.n) r.v = to; }
    return r.v;
  }
  // 금액의 크기: 바뀌는 돈 ÷ 그때 가진 돈 → [굴러가는 길이 배수, 단계 0~3] (가진 돈이 적을 때는 100,000원을 바닥으로 — 첫 일당도 크게 느껴지게)
  function rollSize(from, to) { const r = Math.abs(to - from) / Math.max(Math.abs(from), 100000); return r < 0.02 ? [0.5, 0] : r < 0.15 ? [1, 1] : r < 0.6 ? [1.7, 2] : [2.6, 3]; }
  function rollNow(key, v) { rolls[key] = { v, from: v, to: v, f: 0, n: 0 }; } // 굴리지 않고 그 값으로 (판을 열 때)
  function stepRolls() {
    let ticked = false;
    for (const key in rolls) {
      const r = rolls[key];
      if (r.v === r.to) continue;
      r.f++;
      r.v = r.f >= r.n ? r.to : r.from + (r.to - r.from) * ease(r.f / r.n);
      const el = r.id && $(r.id);
      if (el) { const t = r.fmt(r.v); if (el.textContent !== t) { el.textContent = t; if (!ticked && r.f % 3 === 1) { tone(1300 + 900 * (r.n ? r.f / r.n : 1), 0.02, 'square', 0.04); ticked = true; } } } // 다라라락: 끝으로 갈수록 높아진다
      if (r.v === r.to && r.big) { r.big = false; sfx.pay(); if (el) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); } } // 큰돈이면 다 굴렀을 때 한 번 더
    }
  }
  const rolling = () => Object.keys(rolls).some(k => rolls[k].v !== rolls[k].to);

  // ── 손맛: 폭죽 · 흔들림 (고정 걸음으로 돈다. "효과 줄이기"나 OS 의 움직임 줄이기면 꺼짐) ──
  const fx = { parts: [], seed: 20261113, dirty: false };
  const calm = () => meta.fxOff || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const fr = () => (fx.seed = (Math.imul(fx.seed, 1664525) + 1013904223) >>> 0) / 4294967296; // 효과 전용 난수 (게임 난수와 무관)
  function burst(x, y, n, spread) {
    if (calm()) return;
    const cols = [PX.y, PX.b, PX.r, PX.g, PX.o, PX.w];
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (fr() - 0.5) * spread, v = 240 + fr() * 460; fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.9 + fr() * 0.8, c: cols[i % cols.length], s: 5 + fr() * 6, r: fr() * 6 }); }
  }
  function coins(from, amt) { // 번 자리에서 위쪽 띠의 현금으로 날아가는 동전: 금액이 클수록 많이 (3 · 7 · 14 · 26개)
    if (calm() || !(amt > 0)) return;
    const el = $('cash'), sr = stage.getBoundingClientRect(), k = sr.width ? 1280 / sr.width : 1, q = el ? el.getBoundingClientRect() : null;
    const tx = q ? (q.left + q.width / 2 - sr.left) * k : 520, ty = q ? (q.top + q.height / 2 - sr.top) * k : 38, o = from || ui.from || { x: 640, y: 300 };
    const n = [3, 7, 14, 26][rollSize(S.cash - amt, S.cash)[1]];
    for (let i = 0; i < n; i++) fx.parts.push({ coin: 1, x: o.x, y: o.y, x0: o.x + (fr() - 0.5) * 60, y0: o.y + (fr() - 0.5) * 30, cx: (o.x + tx) / 2 + (fr() - 0.5) * 220, cy: Math.min(o.y, ty) - 60 - fr() * 120, x1: tx, y1: ty, t: -i * 0.035, d: 0.5 + fr() * 0.25, life: 9, s: 8 });
    fx.dirty = true;
  }
  function stepFx() {
    if (!fx.parts.length) return;
    for (const p of fx.parts) {
      if (p.coin) { p.t += STEP / p.d; const t = clamp(p.t, 0, 1), a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t; p.x = a * p.x0 + b * p.cx + c * p.x1; p.y = a * p.y0 + b * p.cy + c * p.y1; if (p.t >= 1) { p.life = 0; if (!p.hit) { p.hit = 1; tone(1900, 0.03, 'square', 0.03); } } continue; }
      p.vy += 900 * STEP; p.x += p.vx * STEP; p.y += p.vy * STEP; p.life -= STEP; p.r += 8 * STEP;
    }
    fx.parts = fx.parts.filter(p => p.life > 0 && p.y < 760);
    fx.dirty = true;
  }
  function drawFx() {
    if (!fx.dirty) return;
    const c = $('fxc').getContext('2d');
    c.clearRect(0, 0, 1280, 720);
    const w = ui.modal && !/^(mg|den|drill)$/.test(ui.modal.type) && document.querySelector('#veil .win'), sr = stage.getBoundingClientRect();
    c.save();
    if (w && sr.width) { const q = w.getBoundingClientRect(), k = 1280 / sr.width; c.beginPath(); c.rect(0, 0, 1280, 720); c.rect((q.left - sr.left) * k, (q.top - sr.top) * k, q.width * k, q.height * k); c.clip('evenodd'); } // 창이 떠 있으면 색종이는 창 바깥에만 (창 제목 · 글을 가리지 않게)
    for (const p of fx.parts) {
      if (p.coin) { if (p.t < 0) continue; const x = Math.round(p.x / 2) * 2 - 5, y = Math.round(p.y / 2) * 2 - 5; c.fillStyle = PX.k; c.fillRect(x, y, 10, 10); c.fillStyle = PX.y; c.fillRect(x + 2, y + 2, 6, 6); c.fillStyle = PX.Y; c.fillRect(x + 2, y + 2, 2, 2); continue; } // 동전: 외곽선 + 노랑 + 밝은 점
      const s = Math.round(p.s / 2) * 2; c.fillStyle = p.c; c.fillRect(Math.round(p.x / 2) * 2 - s / 2, Math.round(p.y / 2) * 2 - s / 2, s, Math.cos(p.r) > 0 ? s : s / 2);
    } // 픽셀 조각: 돌리지 않고 2px 칸에 맞춰 (도는 것은 높이가 바뀌는 것으로)
    c.restore();
    fx.dirty = fx.parts.length > 0;
  }
  function shake() { if (calm()) return; const el = $('s-play'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

  // ── 입력: 키는 한 걸음에 하나씩 처리, 클릭은 data-do 로 ──
  const hit = [];
  const hold = n => { ui.guard = Math.max(ui.guard, n); }; // n 걸음 동안 누름을 버림 (60걸음 = 1초)
  const rearm = () => hold(15); // 창이 막힌 동안 또 누르면 조금 더 막는다: 연타로는 안 넘어가고, 멈췄다 눌러야 넘어간다
  const GUARD = { night: 36, quest: 36, tier: 36, liq: 36, intro: 36, perk: 30, event: 24, confirm: 24, den: 30, roadmap: 12, buy: 24, repay: 18, study: 12, act1: 45, foreclose: 36, biz: 30, drill: 24, shock: 30, collapse: 45, story: 36, lease: 24 }; // 창마다 처음 막는 걸음 수
  const DEN_ROLL = 42, DEN_AFTER = 24; // 도박장: 주사위가 구르는 걸음 수(0.7초) · 결과가 뜬 뒤 누름을 버리는 걸음 수
  addEventListener('keydown', e => {
    startAudio();
    if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Enter') { e.preventDefault(); if (e.target.id === 'qty') e.target.blur(); else hit.push('Enter'); } return; } // 수량 칸의 Enter = 적은 수를 확정 (사기 · 팔기는 버튼으로)
    if (e.repeat) return;
    hit.push(e.code);
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
  });
  const mgPress = code => { try { ui.modal.mg.press(code); } catch (e) { /* 미니게임의 오류가 판을 멈추지 않게 */ } };
  stage.addEventListener('pointerdown', e => {
    startAudio();
    const m = ui.modal;
    if (!m || m.type !== 'mg' || m.res || m.pre) return;
    const b = e.target.closest('[data-mg]'); // 미니게임 버튼은 누르는 순간 반응
    if (b) { mgPress(b.dataset.mg); e.preventDefault(); return; }
    if (e.target.id === 'mgc') { // 그림을 직접 눌러도 됨: 가로로 나눈 칸이 조작 버튼 순서와 같다
      const cs = m.mg.controls || [], r = e.target.getBoundingClientRect();
      if (cs.length) { mgPress(cs[clamp(Math.floor((e.clientX - r.left) / r.width * cs.length), 0, cs.length - 1)].code); e.preventDefault(); }
    }
  });
  stage.addEventListener('input', e => { if (e.target && e.target.id === 'qty' && scene === 'play' && S) qtyTyped(e.target); });
  stage.addEventListener('change', e => { if (e.target && e.target.id === 'qty' && scene === 'play' && S && !ui.modal) qtyTyped(e.target, true); }); // 칸에서 손을 뗄 때: 다시 그리지 않는다 (바로 이어 누른 "사기"의 누름이 씹히지 않게)
  stage.addEventListener('click', e => {
    const sr = stage.getBoundingClientRect();
    ui.from = { x: (e.clientX - sr.left) / sr.width * 1280, y: (e.clientY - sr.top) / sr.height * 720 }; // 번 돈 숫자가 떠오를 자리
    const el = e.target.closest('[data-do]');
    if (!el || el.disabled) return;
    if (ui.guard > 0) { if (ui.modal) rearm(); return; } // 창이 막 뜨거나 닫힌 직후의 누름은 버림 (같은 누름이 다음 것까지 누르지 않게)
    run(el.dataset.do, el.dataset.arg);
  });

  // ── 장면 전환 · 저장 ──
  function show(name) {
    scene = name;
    for (const n of ['title', 'play', 'results', 'figures']) $('s-' + n).classList.toggle('hide', n !== name);
    if (name !== 'play') { ui.modal = null; ui.queue = []; renderVeil(); }
    $('fx').innerHTML = ''; $('toasts').innerHTML = ''; ui.toastQ = []; ui.coachDirty = true;
  }
  function hasSave() { if (MANUAL) return null; try { const s = R.load(localStorage.getItem(SAVE) || ''); if (s && s.ended) { clearSave(); return null; } return s; } catch (e) { return null; } } // 끝난 판의 저장(예전 버전)은 이어 할 것이 없으니 지움
  function newGame(seed) {
    seed = seed || Number(params.get('seed'));
    if (!seed) {
      let runs = 0;
      if (!MANUAL) try { runs = Number(localStorage.getItem(RUNS)) || 0; localStorage.setItem(RUNS, String(runs + 1)); } catch (e) { /* 저장을 못 써도 게임은 됨 */ }
      seed = CONFIG.seed + runs * 101; // 판마다 시세가 다르게
    }
    S = R.create(seed, ui.name); R.setLook(S, meta.look || 0);
    ui.tut = GUIDE && meta.tut !== 2; // 안내를 끝낸 적이 없으면 첫날을 따라가며 알려 준다
    const mark = ui.tut ? 1 : meta.tut === 1 ? 0 : meta.tut; // "보는 중"(1)은 늘 지금 판을 가리킨다: 안내 없이 연 새 판이 보던 판을 갈아 치우면 "안 봄"으로 되돌림
    meta.tut = mark; meta.runs++; saveMeta(); // 판 수는 시작한 판으로 센다 (끝이 멀어서)
    begin();
  }
  function begin() {
    ui.tab = R.unlocked(S, 'stock') ? 'stock' : 'road'; ui.sview = 'market'; ui.sel = 'daejang'; ui.qty = 1; ui.bamt = 0; ui.fresh = {}; ui.flash = {}; ui.queue = []; ui.modal = null; ui.ending = false; ui.say = null; ui.sayT = 0; ui.newAch = [];
    if (S.pending) { const p = typeof S.pending === 'string' ? { id: S.pending, n: 1 } : S.pending; S.pending = null; if (R.quitJob(S, p.id, p.n)) S.log.push({ day: S.day, text: '하다 만 알바는 대충 한 것으로 처리했습니다.', tone: 'warn' }); } // 하는 중에 새로 고침: 칸은 반드시 쓴다 (예전 저장은 알바 이름 하나 = 중)
    const missed = (S.ach || []).filter(id => !meta.ach[id]); // 알림이 뜨기 전에 새로 고쳐서 판 저장에만 남은 업적
    if (missed.length) { for (const id of missed) meta.ach[id] = 1; saveMeta(); }
    ui.queue = (S.unseen || []).map(x => ({ type: x.type, e: x.e })); // 1막 끝 · 사업 확장 창을 보기 전에 새로 고쳤으면 다시 띄움
    ui.cash = S.cash; ui.worth = R.worth(S); rollNow('cash', ui.cash); rollNow('worth', ui.worth);
    show('play');
    drain(); render();
  }
  function saveNow() { if (MANUAL) return; try { localStorage.setItem(SAVE, R.save(S)); } catch (e) { /* 무시 */ } }
  function clearSave() { if (MANUAL) return; try { localStorage.removeItem(SAVE); } catch (e) { /* 무시 */ } }

  // ── 누름 처리 ──
  function run(what, arg) {
    if (what === 'mute') { setMute(!ui.mute); return; }
    const m = ui.modal;
    if (m && (m.type === 'achs' || m.type === 'help')) { // 어느 장면에서나 뜨는 책 두 권
      if (what === 'fxtoggle') { meta.fxOff = !meta.fxOff; saveMeta(); renderVeil(); }
      else if (what === 'ok') { ui.modal = null; hold(12); sfx.click(); renderVeil(); if (scene === 'play') pump(); }
      return;
    }
    if (what === 'achs' || what === 'help') { if (!m) { sfx.click(); openModal({ type: what }); } return; }
    if (scene === 'title') {
      if (what === 'new' || what === 'daily') {
        const i = $('name'), c = $('code'), code = c ? c.value.trim() : '';
        ui.name = i ? i.value : '';
        let seed = 0;
        if (what === 'daily') { const d = new Date(); seed = R.dailySeed(d.getFullYear(), d.getMonth() + 1, d.getDate()); } // 오늘의 판: 날짜가 씨앗 (게임 진행에는 시계를 쓰지 않음)
        else if (code) { seed = R.seedOf(code); if (!seed) { deny('판 코드는 SS-0A1B 같은 모양입니다'); return; } }
        if (hasSave() && ui.askNew !== what) { ui.askNew = what; sfx.deny(); renderTitle(); return; } // 저장이 있으면 같은 버튼을 한 번 더 눌러야 지워짐
        ui.askNew = false; sfx.up(); newGame(seed);
        saveNow(); // 새 판을 고른 순간 하던 판의 저장을 덮는다 ("보는 중"인 안내가 예전 판에 붙지 않게). ?scene=play 로 바로 여는 점검 길은 저장을 건드리지 않는다
      } else if (what === 'continue') { const s = hasSave(); if (s) { S = s; ui.tut = GUIDE && meta.tut === 1; sfx.click(); begin(); } }
      else if (what === 'look') { meta.look = clamp(Number(arg) || 0, 0, 3); saveMeta(); sfx.click(); renderTitle(); }
      else if (what === 'tuttoggle') {
        if (meta.tut === 2) { guideOn(); toast(I('info') + '<span>새 판을 시작하면 첫날을 따라가며 알려 줍니다</span>', 'tip', 260); }
        else { guideOff(); toast(I('info') + '<span>첫 판 안내를 껐습니다</span>', 'tip', 200); }
        sfx.click(); renderTitle();
      }
      return;
    }
    if (scene === 'results') {
      if (what === 'again') { sfx.click(); ui.askNew = false; renderTitle(); show('title'); }
      else if (what === 'copy') copyCard('end');
      return;
    }
    if (scene !== 'play') return;
    if (m && m.type === 'roadmap' && (what === 'move' || what === 'house' || what === 'top')) { ui.modal = null; hold(12); renderVeil(); } // 로드맵 창의 옮기기 · 사기 · 선언: 창을 닫고 아래의 같은 길로
    else if (m) { // 창이 떠 있으면 창의 버튼만
      if (m.type === 'den') { denRun(what, arg); return; }
      if (m.type === 'drill') { drillRun(what, arg); return; }
      if (what === 'ok') closeModal(true);
      else if (what === 'no') closeModal(false);
      else if (what === 'opt' && m.opts) { const i = Number(arg); if (m.opts[i]) { m.pick = i; sfx.click(); renderVeil(); } } // 집 사기 · 미리 갚기: 고르고 Enter
      else if (what === 'studyasset' && m.type === 'study') studyPick(arg);
      else if (what === 'studygo' && m.type === 'study') studyGo();
      else if (what === 'dream' && m.type === 'intro') { m.dream = arg; sfx.click(); renderVeil(); }
      else if (what === 'copy' && m.type === 'act1') copyCard('act1');
      else if (what === 'why') deny(arg);
      else if (what === 'mgstart' && m.type === 'mg' && m.pre) beginMg();
      else if (what === 'int' && m.type === 'mg' && m.pre) pickInt(Number(arg));
      else if (what === 'perk' && m.type === 'perk') { if (R.pickPerk(S, arg)) { sfx.ding(); ui.modal = null; hold(16); renderVeil(); done(); } }
      else if (what === 'ev' && m.type === 'event' && !m.done) {
        if (R.choose(S, arg)) { const d = S.ev.find(e => e.t === 'event_done'); m.done = d ? d.text : ''; m.fx = d ? d.fx : null; saveNow(); sfx.click(); hold(20); $('veil').classList.add('arming'); renderVeil(); } // 고르자마자 저장 (새로 고쳐서 다시 고르기 없음)
        else { S.ev.length = 0; deny('현금이 모자랍니다'); }
      }
      return;
    }
    if (what === 'coachoff') { ui.tut = false; guideOff(); sfx.click(); toast(I('info') + '<span>안내를 껐습니다. 제목 화면에서 다시 켤 수 있습니다</span>', 'tip', 300); render(); return; }
    const c = coachNow();
    if (what === 'coachok') { if (c && c.ok) { if (c.id === 'goal') { ui.tut = false; meta.tut = 2; } else meta.seen[c.id] = 1; saveMeta(); sfx.click(); hold(12); render(); } return; }
    if (c && what !== 'quit' && (c.ok || (c.only && !c.only(what, arg)))) { nudge(); return; } // 안내가 한 곳을 짚는 동안은 그것만 받는다
    if (what === 'quit') { saveNow(); sfx.click(); ui.askNew = false; renderTitle(); show('title'); return; }
    if (what === 'why') { deny(arg); return; }
    if (what === 'tip') { sfx.click(); toast(I('info') + '<span>' + esc(arg) + '</span>', 'tip', 260); return; } // 아이콘을 누르면 뜻이 뜬다 (마우스를 못 올리는 화면에서도)
    if (what === 'roadmap') { sfx.click(); openModal({ type: 'roadmap' }); return; }
    if (what === 'tab') {
      ui.tab = arg; ui.fresh[arg] = false; if (arg === 'stock' && ui.sview === 'detail' && !R.visible(S, ui.sel)) ui.sview = 'market'; sfx.click(); renderQuest(); renderBoard();
      if (arg === 'coin' && GUIDE && !meta.seen.coin && !S.lev && R.unlocked(S, 'coin')) openModal(drillNew()); // 코인 탭을 처음 열면: 설명 대신 직접 눌러 보는 연습 (진짜 돈 아님)
      return;
    }
    if (what === 'drill') { sfx.click(); openModal(drillNew()); return; } // 코인 탭의 "연습"으로 다시
    if (what === 'sview') { ui.sview = arg; sfx.click(); renderBoard(); return; } // 주식 탭: 장 보기 · 내 보유
    if (what === 'sel') { ui.sel = arg; ui.sview = 'detail'; ui.qty = 1; ui.tab = 'stock'; sfx.click(); renderBoard(); return; } // 종목을 누르면 그 종목의 상세로
    if (what === 'qty') { setQty(arg); sfx.click(); renderBoard(); return; }
    if (what === 'buyq') { if (R.buyUnits(S, ui.sel, ui.qty)) sfx.click(); done(); return; }
    if (what === 'sellq') { const h = S.hold[ui.sel]; if (R.sellUnits(S, ui.sel, Math.min(ui.qty, h ? h.units : 0))) sfx.pay(); done(); return; }
    if (what === 'eat') { ui.from = { x: 240, y: 400 }; if (R.eat(S, arg)) sfx.ding(); done(); return; }
    if (what === 'item') { if (R.buyItem(S, arg)) sfx.up(); done(); return; }
    if (what === 'wear') { if (R.wear(S, arg)) sfx.click(); done(); return; }
    if (what === 'bamt') { setBamt(arg); sfx.click(); renderBoard(); return; }
    if (what === 'borrow') { if (R.borrow(S, ui.bamt)) { sfx.pay(); ui.bamt = 0; } done(); return; }
    if (what === 'repaycl') { if (R.repayCl(S, ui.bamt || S.cl)) { sfx.click(); ui.bamt = 0; } done(); return; }
    if (what === 'propbuy' || what === 'propsell') {
      const v = R.propView(S).rows.find(r => r.id === arg);
      if (!v) return;
      if (what === 'propbuy' && !v.ok) { deny(v.why); return; }
      openModal({ type: 'confirm', kind: what === 'propbuy' ? 'propbuy' : 'propsell', v }); return;
    }
    if (what === 'lease') { // 원룸 월세 → 전세로 갈아타기
      const info = R.moveInfo(S, 3, 'jeonse');
      if (!info.ok) { deny(info.why || '지금은 전세로 바꿀 수 없습니다'); return; }
      openModal({ type: 'confirm', kind: 'swap', info }); return;
    }
    if (what === 'lev') { ui.lev = Number(arg); sfx.click(); renderBoard(); return; }
    if (what === 'share') { ui.share = Number(arg); sfx.click(); renderBoard(); return; }
    if (what === 'job') { startJob(arg); return; }
    if (what === 'skip') { ui.from = { x: 1200, y: 100 }; if (R.doJob(S, arg, null)) { sfx.pay(); hold(20); } else deny('체력이 모자랍니다 — 쉬거나 사 먹기'); done(); return; } // 번 돈은 오늘 칸의 머리줄에서 뜬다 (마지막 칸이면 그 자리에 "하루 마치기"가 들어서므로 그림 위에 겹치지 않게)
    if (what === 'rest') { if (R.doRest(S)) { sfx.click(); hold(20); } done(); return; }
    if (what === 'study') { // 공부: 종목을 고르는 창 → 고른 종목 하나의 내일
      const a = R.acts(S).find(x => x.kind === 'study');
      if (!a || !a.ok) { deny(a ? a.why : ''); return; }
      sfx.click(); openModal({ type: 'study', assets: a.assets, auto: a.auto, picks: a.picks || 1, sel: [] }); return;
    }
    if (what === 'endday') { // 그냥 자면 손해가 나는 밤은 한 번 더 묻는다 (Space 연타로 넘어가지 않게)
      const b = R.bill(S), lack = b && b.inDays === 0 ? b.amt - b.income - S.cash : 0, room = R.creditView(S).room, short = lack > 0; // 모자란 돈: 같은 밤에 들어올 임대수익 · 배당을 빼고
      if (S.slot >= 3 && short) { openModal({ type: 'confirm', kind: 'sleep', short, b, lack, auto: Math.ceil(lack / 10000) * 10000 <= room }); return; }
      sleepNow(); return;
    }
    if (what === 'buy') { const f = Number(arg), amt = arg === 'all' ? S.cash : f > 0 && f <= 1 ? Math.floor(S.cash * f) : f; if (R.buy(S, ui.sel, amt)) sfx.click(); done(); return; } // 버튼은 현금의 비율(0.25 · 0.5 · 1), 점검 도구는 금액도 넣는다
    if (what === 'sell') { if (R.sell(S, ui.sel, Number(arg))) sfx.pay(); done(); return; }
    if (what === 'long' || what === 'short') { if (R.levOpen(S, what === 'long' ? 1 : -1, Math.floor(S.cash * ui.share), ui.lev)) { sfx.click(); hold(24); } done(); return; }
    if (what === 'close') { if (R.levClose(S)) { sfx.pay(); hold(24); } done(); return; }
    if (what === 'move') {
      const to = Number(arg), info = R.moveInfo(S, to), alt = to === 3 ? R.moveInfo(S, 3, 'jeonse') : null;
      if (!info.ok && !(alt && alt.ok)) { deny(info.why); return; }
      if (to === 1) { R.move(S, to); sfx.up(); hold(20); done(); return; }
      if (to === 3) { openModal(leaseModal()); return; } // 원룸: 월세 · 전세를 고른다
      openModal({ type: 'confirm', kind: 'move', to, info });
      return;
    }
    if (what === 'house') { // 내 집부터: 한 단계 위 집을 산다 (내 집은 현금으로만, 아파트부터는 대출을 고름)
      const to = S.tier + 1;
      if (to < 4 || to > 8) { deny(to < 4 ? '원룸부터 집을 살 수 있습니다' : '호텔이 마지막 집입니다 — 이제 "선언"으로 끝냅니다'); return; }
      const info = R.homeInfo(S, to), jeonse = info.leases.indexOf('jeonse') >= 0 ? R.homeInfo(S, to, 'jeonse') : null;
      if (!info.ok && !(jeonse && jeonse.ok)) { deny(info.why); return; }
      openModal(buyModal(to, info, jeonse)); return;
    }
    if (what === 'repay') {
      const l = R.loanView(S);
      if (!l) { deny('갚을 대출이 없습니다'); return; }
      sfx.click(); openModal(repayModal(l)); return;
    }
    if (what === 'bizup') {
      const v = R.bizView(S);
      if (!v.next || !v.next.ok) { deny(v.next ? v.next.why : '더 키울 수 없습니다'); return; }
      openModal({ type: 'confirm', kind: 'biz', v }); return;
    }
    if (what === 'top') {
      const g = R.goalView(S);
      if (g.kind !== 'top' || !g.canBuy) { deny(g.kind !== 'top' ? '호텔부터 선언할 수 있습니다' : '순자산이 ' + won(g.price - g.have) + ' 모자랍니다'); return; }
      openModal({ type: 'confirm', kind: 'top', g }); return;
    }
  }
  function buyModal(to, info, jeonse) { // 고를 것: (아파트 · 주택은) 전세 · 대출 최대 · 절반 · 없이 (내 집은 현금 하나). 고른 것마다 지금 낼 현금 · 일요일 밤마다 나갈 돈
    const loans = info.loanMax > 0 ? [info.loanMax, Math.floor(info.loanMax / 2 / 10000) * 10000, 0] : [0];
    const names = info.loanMax > 0 ? ['최대로 빌려 산다', '절반만 빌려 산다', '대출 없이 산다'] : [to === 4 ? '현금으로 산다' : '대출 없이 산다'];
    const opts = loans.map((loan, i) => {
      const cash = info.full - loan, weekly = loan > 0 ? r1k(loan * info.rate) + Math.min(loan, r1k(loan / tune.loan_weeks)) : 0, ok = S.cash >= cash;
      return { name: names[i], lease: 'own', loan, cash, weekly, fixed: info.fixed, ok, why: ok ? '' : '현금이 ' + won(cash - S.cash) + ' 모자랍니다' };
    });
    if (jeonse) opts.unshift({ name: '전세로 들어간다', lease: 'jeonse', loan: 0, cash: jeonse.full, deposit: jeonse.deposit, weekly: 0, fixed: jeonse.fixed, ok: jeonse.ok, why: jeonse.ok ? '' : '현금이 ' + won(jeonse.full - S.cash) + ' 모자랍니다' });
    const pick = Math.max(0, opts.findIndex(o => o.ok));
    return { type: 'buy', to, info, jeonse, opts, pick };
  }
  function dayEarn() { // 지금 벌이(견줄 숫자): 하루 세 칸을 돈 많이 주는 알바부터 보통으로 했을 때. 같은 알바는 하루 job_per_day 번이라 한 가지만 세 번 하지 못한다
    const pays = R.acts(S).filter(a => a.kind === 'job').map(a => a.pay).sort((x, y) => y - x), per = tune.job_per_day > 0 ? tune.job_per_day : 3;
    let left = 3, sum = 0;
    for (const p of pays) { const k = Math.min(left, per); sum += p * k; left -= k; if (left <= 0) break; }
    return r1k(sum * tune.mult_ok);
  }
  function leaseModal() { // 원룸 입주: 월세 · 전세. 고른 것마다 걸 보증금 · 지금 나갈 현금 · 일요일 밤마다 나갈 돈
    const opts = ['rent', 'jeonse'].map(lease => { const info = R.moveInfo(S, 3, lease); return { name: R.LEASE[lease], lease, info, ok: info.ok, why: info.why }; });
    return { type: 'lease', to: 3, opts, pick: Math.max(0, opts.findIndex(o => o.ok)) };
  }
  function setQty(arg) { // 수량: −10 · −1 · +1 · +10 · 살 수 있는 만큼의 25% · 50% · 전부 · 가진 만큼
    const h = S.hold[ui.sel] || { units: 0 }, max = R.maxUnits(S, ui.sel), top = Math.max(1, max, Math.floor(h.units));
    const q = arg === 'max' ? max : arg === 'q50' ? Math.floor(max / 2) : arg === 'q25' ? Math.floor(max / 4) : arg === 'all' ? Math.ceil(h.units) : /^=/.test(arg) ? Number(arg.slice(1)) : ui.qty + Number(arg);
    ui.qty = clamp(Math.floor(q) || 1, 1, Math.max(1, top));
  }
  function setBamt(arg) { // 은행에서 빌리거나 갚을 금액: 한도 · 잔액 안에서
    const v = R.creditView(S), top = Math.max(v.room, v.balance), unit = top >= 1e8 ? 1e7 : top >= 1e7 ? 1e6 : 1e5;
    const q = arg === 'room' ? v.room : arg === 'bal' ? Math.min(v.balance, Math.floor(S.cash / 10000) * 10000) : arg === 'half' ? Math.floor(v.room / 2 / 10000) * 10000 : ui.bamt + Number(arg) * unit;
    ui.bamt = clamp(Math.floor(q / 10000) * 10000, 0, Math.max(0, top));
  }
  function repayModal(l) { // 미리 갚기: 잔액의 25% · 50% · 전부. 고른 것마다 갚은 뒤 잔액 · 이번 일요일 원리금 (대출 줄과 같은 기준: 이번 일요일에 실제로 나갈 돈 — 이사한 주는 산 날만큼)
    const b = R.bill(S), wf = (b ? b.days : 7) / 7;
    const per = l.orig / tune.loan_weeks, leftOf = bal => (bal > 0 ? Math.ceil(bal / per - 1e-9) : 0);
    const interest = bal => { let t = 0, f = wf, g = 0; while (bal > 0 && g++ < 200) { t += r1k(bal * l.rate * f); bal -= Math.min(bal, r1k(per * f)); f = 1; } return t; }; // 이대로 다 갚을 때까지 낼 이자 (원금은 매주 같은 몫이라 미리 갚으면 남은 회가 준다)
    const all = interest(l.balance);
    const opts = [0.25, 0.5, 1].map(f => {
      const amt = f === 1 ? l.balance : Math.floor(l.balance * f / 10000) * 10000, bal = l.balance - amt, ok = amt > 0 && S.cash >= amt;
      const next = bal > 0 ? r1k(bal * l.rate * wf) + Math.min(bal, r1k(l.orig / tune.loan_weeks * wf)) : 0; // rules 의 loanDue 와 같은 셈 (이자는 빌릴 때 정해진 것)
      return { name: f === 1 ? '전부' : Math.round(f * 100) + '%', amt, bal, next, left: leftOf(bal), saved: all - interest(bal), ok, why: ok ? '' : '현금이 ' + won(amt - S.cash) + ' 모자랍니다' };
    });
    const pick = Math.max(0, opts.findIndex(o => o.ok));
    return { type: 'repay', l, opts, pick, due: b ? b.loan : l.weekly, days: b ? b.days : 7 };
  }
  function studyPick(id) { // 한 종목만 읽는 단계면 누르는 대로, 두 종목을 읽는 단계(3단계부터)면 골라 두고 "공부한다"
    const m = ui.modal;
    if (m.picks > 1) { const i = m.sel.indexOf(id); if (i >= 0) m.sel.splice(i, 1); else { if (m.sel.length >= m.picks) m.sel.shift(); m.sel.push(id); } sfx.click(); renderVeil(); return; }
    m.sel = [id]; studyGo();
  }
  function studyGo() {
    const m = ui.modal, ids = (m.sel || []).slice();
    if (!ids.length) { deny('종목을 고르세요'); return; }
    ui.modal = null; hold(20); renderVeil();
    if (R.doStudy(S, ids)) sfx.ding(); else deny('지금은 공부할 수 없습니다');
    done();
  }
  function sleepNow() {
    if (!R.endDay(S)) return;
    const evs = S.ev.splice(0), down = evs.some(e => e.t === 'tier' && !e.up && e.from >= 2); // 밤의 사건은 정산 창이 보여 주므로 비우되, 쫓겨난 것은 흔들림으로도 알림
    const fc = evs.find(e => e.t === 'foreclose'); if (fc) ui.queue.push({ type: 'foreclose', e: fc }); // 압류는 정산 창을 닫은 뒤 숫자로 한 장 더
    for (const e of evs) if (e.t === 'ach') { ui.newAch.push(e.id); if (!meta.ach[e.id]) { meta.ach[e.id] = 1; saveMeta(); } }
    rollTo('nightin', S.last.labor, 'nightin', v => '+' + won(v), 0); rollTo('nightout', S.last.spent, 'nightout', v => (v ? '−' : '') + won(v), 0); // 합계가 0 에서 굴러감
    openModal({ type: 'night', sum: S.last }); render();
    if (down) { sfx.bad(); shake(); } else sfx.night();
  }
  function done() { drain(); render(); if (!S.ended && !(ui.modal && ui.modal.type === 'mg')) saveNow(); } // 행동 하나마다 저장 (새로 고쳐서 되돌리기 없음)
  const busy = () => !!(ui.modal || ui.queue.length || (S && scene === 'play' && !S.ended && (S.offer || S.event || S.den))); // 창이 떠 있거나 곧 뜰 참
  // 알림은 모두 한 줄(높이 28px). 장면 칸의 위쪽 가장자리에 쌓이므로, 한 번에 보이는 수는 주인공 얼굴을 가리지 않는 만큼(renderMe 가 ui.toastCap 을 잰다: 둘 또는 하나)
  const toastCap = () => (scene === 'play' ? ui.toastCap || 2 : 2);
  const TOAST_W = 43; // 한 줄에 들어가는 글 폭(둥근모꼴 칸 수, 1칸 = 8px): 알림 380px − 틀 12 − 안쪽 4 − 아이콘 16 − 틈 4
  const plain = h => String(h).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  const fitLine = list => list.find(h => wid(plain(h)) <= TOAST_W) || list[list.length - 1]; // 한 줄에 드는 첫 글 (뒤로 갈수록 짧게 줄인 것)
  const cwon = n => (n < 0 ? '−' : '') + (Math.abs(n) >= 1e8 ? eok(Math.abs(n)) : Math.abs(n) >= 1e5 ? Math.round(Math.abs(n) / 1e4).toLocaleString('en-US') + '만' : num(Math.abs(n))); // 알림이 넘칠 때만 쓰는 줄인 금액 (152만 · 12억)
  const csign = n => (n >= 0 ? '+' : '') + cwon(n);
  function toast(html, kind, life, day) {
    const box = $('toasts'), cap = toastCap();
    for (const o of box.children) if (o._key === html) { o._life = life || 240; return; } // 같은 말은 쌓지 않고 시간만 다시 잰다
    const big = /gap/.test(kind || ''); // 밤사이 · 거래량 알림은 업적 알림보다 먼저: 떠 있던 보통 알림 하나를 줄 뒤로 돌려보내고 그 자리에
    if (day == null) day = S ? S.day : 0; // 언제 생긴 알림인지 (줄에서 오래 기다렸으면 버림)
    if (big && !busy() && box.children.length >= cap) { const o = [...box.children].find(x => !/gap|deny/.test(x._kind)); if (o) { ui.toastQ.unshift([o._key, o._kind, Math.max(120, o._life), o._day]); o.remove(); } }
    if (kind !== 'deny' && kind !== 'tip' && (busy() || box.children.length >= cap)) { if (!ui.toastQ.some(q => q[0] === html)) ui.toastQ[big ? 'unshift' : 'push']([html, kind, life, day]); return; } // 거절 이유 · 누른 것의 뜻(tip)은 바로. 알림은 한 번에 cap 개까지, 창이 떠 있으면 창이 닫힌 뒤에 (창 글을 가리지 않게 · 사건 창 뒤에서 사라지지 않게)
    const d = document.createElement('div');
    d.className = 'toast ' + (kind || ''); d.innerHTML = html; d._key = html; d._life = life || 240; d._kind = kind || ''; d._day = day;
    box.appendChild(d);
    while (box.children.length > cap) { const o = box.firstChild; if (o._kind !== 'deny' && o._kind !== 'tip') ui.toastQ.unshift([o._key, o._kind, Math.max(120, o._life), o._day]); o.remove(); } // 밀려난 보통 알림은 줄 앞으로 (사라지지 않게 — 밤사이 알림은 매매 알림이 지나간 뒤 다시 뜬다)
  }
  function deny(why) { sfx.deny(); if (why) toast(I('warn') + '<span>' + esc(why) + '</span>', 'deny', 150); }

  function key(code) {
    if (code === 'KeyM') { setMute(!ui.mute); return; }
    const m = ui.modal;
    if (m && (m.type === 'achs' || m.type === 'help')) { if (ui.guard === 0 && (code === 'Space' || code === 'Enter' || code === 'Escape')) run('ok'); return; }
    if (scene === 'title') { if (code === 'Enter') run(hasSave() ? 'continue' : 'new'); return; }
    if (scene === 'results') { if (ui.guard === 0 && (code === 'Enter' || code === 'KeyR')) run('again'); return; }
    if (scene !== 'play') return;
    const d = /^Digit([1-9])$/.exec(code) || /^Numpad([1-9])$/.exec(code);
    if (m) {
      if (m.type === 'mg' && !m.res) { // 시작 전: Space · Enter 시작 · Esc 돌아가기 · ← → 강도 (숫자 키는 편의점의 1~4 와 헷갈려 안 씀)
        if (!m.pre) mgPress(code);
        else if (ui.guard === 0) { if (code === 'Space' || code === 'Enter') run('mgstart'); else if (code === 'Escape') run('no'); else if (code === 'ArrowLeft' || code === 'ArrowRight') stepInt(code === 'ArrowLeft' ? -1 : 1); }
        return;
      }
      if (ui.guard > 0) { rearm(); return; }
      if (m.type === 'den') { // 1~4 판돈 · ← 홀 · → 짝 · Enter 따블 · Space 그만 (확인 창과 같은 뜻: Enter = 한다, Space = 돌아간다)
        if (m.fin) { if (code === 'Space' || code === 'Enter' || code === 'Escape') denRun('ok'); return; }
        if (d && Number(d[1]) <= 4) denRun('denamt', String(Number(d[1]) - 1));
        else if (code === 'ArrowLeft') denRun('denpick', 'odd');
        else if (code === 'ArrowRight') denRun('denpick', 'even');
        else if (code === 'Enter') denRun('dendouble');
        else if (code === 'Space' || code === 'Escape') denRun('denleave');
        return;
      }
      if (m.type === 'perk') { const o = d && S.offer && S.offer[Number(d[1]) - 1]; if (o) run('perk', o); return; } // 특성은 꼭 하나 골라야 닫힘
      if (m.type === 'event' && !m.done) { if (d && d[1] === '1') run('ev', 'a'); else if (d && d[1] === '2') run('ev', 'b'); return; }
      if (m.type === 'study') { const a = d && m.assets[Number(d[1]) - 1]; if (a) run('studyasset', a.id); else if (code === 'Enter' && m.picks > 1) run('studygo'); else if (code === 'Space' || code === 'Escape') closeModal(false); return; } // 종목 고르기: 숫자 = 그 종목, Space = 돌아가기 (두 종목을 읽는 단계면 고른 뒤 Enter)
      if (m.type === 'intro' && d) { const dr = R.dreamList()[Number(d[1]) - 1]; if (dr) run('dream', dr.id); return; } // 첫 창: 숫자로 꿈을 고른다
      if (m.type === 'drill') { if (d && d[1] === '1') drillRun('drillgo', 'long'); else if (d && d[1] === '2') drillRun('drillgo', 'short'); else if (code === 'Escape') drillRun('drillskip'); else if (code === 'Space' || code === 'Enter') drillRun('ok'); return; } // 연습: 1 롱 · 2 숏 · Space 다음 · Esc 건너뛰기
      if (m.opts && d) { run('opt', String(Number(d[1]) - 1)); return; } // 집 사기 · 미리 갚기: 숫자로 고르고 Enter
      if (m.type === 'confirm' || m.type === 'buy' || m.type === 'repay' || m.type === 'lease') { if (code === 'Enter') closeModal(true); else if (code === 'Space' || code === 'Escape') closeModal(false); return; } // 확인 창은 늘 같다: Enter = 한다, Space · Esc = 돌아간다 (연타해도 안전한 쪽)
      if (code === 'Space' || code === 'Enter') closeModal(true);
      return;
    }
    if (ui.guard > 0) return;
    const c = coachNow();
    if (c && c.ok) { if (code === 'Space' || code === 'Enter') run('coachok'); else if (d) nudge(); return; } // 읽고 넘기는 안내 (숫자 키로 다른 것을 고르려 하면 무엇을 누를지 알려 줌)
    if (d && S.slot < 3) { const a = R.acts(S)[Number(d[1]) - 1]; if (a && !(a.kind === 'job' ? a.any || a.push : a.ok)) deny(a.why); else if (a) run(a.kind === 'job' ? 'job' : a.kind, a.id); return; }
    if (code === 'Space' && S.slot >= 3) run('endday'); // Enter 는 확인 창의 "한다"라서 여기서는 안 받음
  }

  // ── 규칙이 쌓아 둔 사건을 화면으로 ──
  function drain() {
    const evs = S.ev.splice(0);
    const homeQuest = evs.some(e => e.t === 'quest_done' && /^(roof|address|oneroom|jeonse)$/.test(e.quest.id)); // 이사로 끝난 퀘스트 창이 "열림"을 이미 알려 줌
    const flies = [], quests = { done: [], skipped: [], next: null, at: -1 }; // 한꺼번에 끝난 퀘스트는 창 한 장으로 모은다
    const heldShock = evs.some(e => e.t === 'shock' && e.held), liqNow = evs.some(e => e.t === 'liq'); // 내 것에 속보가 터진 칸: 도장 대신 속보 띠가 한 번 (청산까지 가면 흔들림은 청산이)
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      events.push(e);
      if (e.t === 'money' && e.amt > 0 && e.label !== '사업 매출') flies.push(['+' + won(e.amt), 'gold', null, e.amt]);
      else if (e.t === 'auto') flies.push(['매출 +' + won(e.amt), 'gold', autoFrom(), e.amt]); // 쉬기 · 공부 칸에도 들어온 사업 매출: 카드 줄 위(오늘 칸 머리줄)에서 떠오름 (카드 이름을 가리지 않게)
      else if (e.t === 'gap') gapToast(e);
      else if (e.t === 'act1') { ui.queue.push({ type: 'act1', e }); S.unseen = (S.unseen || []).filter(x => x.type !== 'act1').concat([{ type: 'act1', e }]); meta.homes = (meta.homes || 0) + 1; if (!meta.act1Best || e.day < meta.act1Best) { meta.act1Best = e.day; meta.act1Rank = e.rank; } saveMeta(); }
      else if (e.t === 'biz') { ui.queue.push({ type: 'biz', e }); S.unseen = (S.unseen || []).filter(x => x.type !== 'biz').concat([{ type: 'biz', e }]); } // 창을 닫기 전에 새로 고쳐도 다시 뜨게 (판 저장에 남김)
      else if (e.t === 'gm_alert') toast(I('warn') + '<div><span class="lab">꿀잼게임즈 신작 발표</span> · <b>' + Math.round(tune.g_hype_ticks / 3) + '일 뒤 출시</b></div>', 'gap up', 480);
      else if (e.t === 'ht_alert') toast(I('warn') + '<div><span class="lab">한탕바이오 거래량 급증</span> · <b>누가 사 모으는 중</b></div>', 'gap up', 480); // 알림은 모두 한 줄 · 줄인 글만으로 뜻이 통하게 (#toasts 는 누름을 통과시켜 title 이 안 뜬다)
      else if (e.t === 'trade' && e.side === 'sell') { const t = (a, p) => '<div><span class="lab">' + esc(e.name) + ' 팔기</span> ' + a + ' · <b class="' + cls(e.pnl) + '">손익 ' + p + '</b></div>'; toast(I('sell') + fitLine([t(num(e.amt), sign(e.pnl)), t(cwon(e.amt), csign(e.pnl))]), '', 300); }
      else if (e.t === 'trade') { const fee = e.fee != null ? e.fee : Math.round(e.amt * tune.fee * (R.perk(S, 'stockonly') ? 0 : R.perk(S, 'vip') ? 0.5 : 1)), t = (a, f) => '<div><span class="lab">' + esc(e.name) + ' 사기</span> ' + a + ' · <b>' + (fee ? '수수료 −' + f : '수수료 없음') + '</b></div>'; toast(I('cart') + fitLine([t(num(e.amt), num(fee)), t(cwon(e.amt), num(fee)), t(cwon(e.amt), cwon(fee))]), 'tip', 260); } // "대장전자 사기 1,980,000 · 수수료 −5,940" (말이 끊기지 않게)
      else if (e.t === 'repay') { const t = (a, b) => '<div><span class="lab">' + (e.credit ? '마이너스 통장 갚음' : '미리 갚음') + '</span> ' + a + ' · <b>잔액 ' + b + '</b></div>'; toast(I('check') + fitLine([t(num(e.amt), num(e.balance)), t(cwon(e.amt), cwon(e.balance))]), '', 240); }
      else if (e.t === 'foreclose') ui.queue.push({ type: 'foreclose', e });
      else if (e.t === 'collapse') { ui.queue.push({ type: 'collapse', e }); shake(); } // 쓰러짐: 한 장으로 크게
      else if (e.t === 'push_ok') toast(I('warn') + '<div><span class="lab">무리했지만</span> <b>버텼다</b> · 쓰러질 확률 ' + Math.round(e.risk * 100) + '%였음</div>', 'gap up', 300);
      else if (e.t === 'sick') toast(I('clinic') + '<div><span class="lab">퇴원 수속</span> <b>오전이 지나갔다</b></div>', 'deny', 300);
      else if (e.t === 'eat') flies.push(['체력 +' + e.hp, 'good', { x: 230, y: 330 }]);
      else if (e.t === 'item') toast(I('gift') + '<div><span class="lab">샀다</span> <b>' + esc(e.name) + '</b></div>', '', 260);
      else if (e.t === 'borrow' && !e.auto) toast(I('bank') + '<div><span class="lab">마이너스 통장</span> <b>+' + cwon(e.amt) + '</b> · 빚 ' + cwon(e.balance) + '</div>', 'tip', 280);
      else if (e.t === 'prop') toast(I('building') + '<div><span class="lab">' + esc(e.name) + (e.side === 'buy' ? ' 삼' : ' 팖') + '</span> <b>' + cwon(e.amt) + '</b>' + (e.side === 'sell' ? ' · <b class="' + cls(e.pnl) + '">손익 ' + csign(e.pnl) + '</b>' : '') + '</div>', '', 300);
      else if (e.t === 'credit' && (Math.abs(e.delta) >= 20 || e.grade !== e.was)) toast(I('bank') + '<div><span class="lab">신용점수</span> <b class="' + (e.delta > 0 ? 'good' : 'bad') + '">' + (e.delta > 0 ? '+' : '−') + Math.abs(e.delta) + '</b> · ' + e.score + '점 ' + e.grade + '등급</div>', e.delta > 0 ? '' : 'deny', 300);
      else if (e.t === 'know') { toast(I('book') + '<div><span class="lab">투자 공부 ' + e.lv + '단계</span> <b>' + esc(e.name) + '</b></div>', '', 360); sfx.level(); burst(860, 360, 36, 2.4); ui.fresh.info = ui.tab !== 'info'; }
      else if (e.t === 'alert') toast(I('warn') + '<div><span class="lab">속보 경보</span> <b>' + esc(e.name) + '</b> · 오늘 큰 소식</div>', 'gap up', 420);
      else if (e.t === 'dream') { ui.queue.push({ type: 'story', e }); }
      else if (e.t === 'tick') { for (const id in e.chg) ui.flash[id] = e.chg[id]; if (!heldShock) stamps(e.chg); }
      else if (e.t === 'shock') ui.queue.push({ type: 'shock', e, still: liqNow }); // 속보 띠: 다른 창과 같은 줄에 서서 하나씩
      else if (e.t === 'while') flies.push([sign(e.delta), cls(e.delta), { x: 860, y: 330 }]);
      else if (e.t === 'quest_done') { quests.done.push(e.quest); quests.next = null; if (quests.at < 0) quests.at = ui.queue.length; }
      else if (e.t === 'quest_skip') { quests.skipped.push(e.quest); quests.next = null; }
      else if (e.t === 'quest_new') { quests.next = e.quest; ping(); } // 마지막에 나온 것이 지금 할 퀘스트
      else if (e.t === 'intro') ui.queue.push({ type: 'intro', next: e.quest });
      else if (e.t === 'perk') ping();
      else if (e.t === 'tier') {
        if (e.up && e.to === 1) { ui.fresh.stock = true; ui.fresh.info = true; }
        if (e.up && e.to === 2) ui.fresh.bank = true;
        if (e.up && e.to === 3 && !e.swap) { ui.fresh.coin = true; ui.fresh.realty = true; }
        if (e.up && (!homeQuest || e.swap) && e.to !== 4) ui.queue.push({ type: 'tier', e }); // 내 집은 1막 끝 창이 알려 줌
        meta.bestTier = Math.max(meta.bestTier || 0, e.to); saveMeta();
      }
      else if (e.t === 'liq') { ui.queue.push({ type: 'liq', e }); shake(); }
      else if (e.t === 'deny') deny(e.why);
      else if (e.t === 'sys') { ui.say = e; ui.sayT = 420; ping(); }
      else if (e.t === 'ending') ui.ending = true;
      else if (e.t === 'ach') { ui.newAch.push(e.id); if (!meta.ach[e.id]) { meta.ach[e.id] = 1; saveMeta(); } toast(I(e.icon) + '<div><span class="lab">업적</span> <b>' + esc(e.name) + '</b></div>', '', 300); sfx.ding(); } // 규칙(achTick)이 판마다 한 번만 낸다 (S.ach 에 남아 이어하기 · 새로 고침 뒤에도 다시 안 냄)
    }
    if (quests.done.length) ui.queue.splice(quests.at, 0, { type: 'quest', done: quests.done, skipped: quests.skipped, next: quests.next });
    else for (const q of quests.skipped) toast(I('skip') + fitLine(['<div><span class="lab">때가 지나 건너뛴 퀘스트</span> <b>' + esc(q.title) + '</b></div>', '<div><span class="lab">건너뛴 퀘스트</span> <b>' + esc(q.title) + '</b></div>']), '', 300);
    if (!ui.modal && !ui.queue.length && !S.offer && !S.event && !ui.ending) for (const f of flies) { fly(f[0], f[1], f[2]); if (f[3]) coins(f[2], f[3]); } // 창이 뜰 참이면 창 위에 겹치므로 내지 않음 (숫자는 위쪽 띠에서 굴러감)
    pump();
  }
  function autoFrom() { // 사업 매출이 떠오를 자리: 쉬기 · 공부 카드(오른쪽 끝) 위, 오늘 칸 머리줄 높이 — 카드 이름을 가리지 않게 (키보드로 골라도 같은 자리)
    const c = document.querySelector('#today .card.auto'), sr = stage.getBoundingClientRect();
    if (!c || !sr.width) return { x: 1100, y: 118 };
    const q = c.getBoundingClientRect(), k = 1280 / sr.width;
    return { x: (q.left + q.width / 2 - sr.left) * k, y: 118 };
  }
  function pump() { // 뜰 창이 남았으면 하나씩: 알림 → 특성 고르기 → 돌발 사건 → 엔딩
    if (ui.modal) return;
    if (ui.queue.length) { openModal(ui.queue.shift()); return; }
    if (S && !S.ended && S.offer) { openModal({ type: 'perk' }); return; }
    if (S && !S.ended && S.event) { openModal({ type: 'event', view: R.eventView(S), done: null }); return; }
    if (S && !S.ended && S.den) { openModal(denOpen()); return; }
    if (ui.ending) finish();
  }

  // ── 도박장: 판돈 → 홀 / 짝 → 주사위가 굴러 멈추고 결과. 규칙은 바로 정해지고, 화면은 DEN_ROLL 걸음 동안 굴린 뒤 보여 준다 ──
  function denOpen() {
    const v = R.denView(S), first = v.bets.find(b => b.ok);
    return { type: 'den', view: v, amt: first ? first.amt : 0, roll: null, res: null, fin: null, face: v.last ? v.last.dice.slice() : [5, 2] };
  }
  function denRun(what, arg) {
    const m = ui.modal;
    if (!m || m.type !== 'den' || m.roll) return; // 구르는 동안은 안 받음
    if (m.fin) { if (what === 'ok') { ui.modal = null; hold(16); sfx.click(); renderVeil(); done(); } return; }
    const v = m.view;
    if (what === 'denamt') { const b = v.bets[Number(arg)]; if (!b) return; if (!b.ok) { deny('현금이 모자랍니다'); return; } m.amt = b.amt; sfx.click(); renderDen(); return; }
    if (what === 'denpick') { denBet(m.amt, arg); return; }
    if (what === 'dendouble') { if (v.canDouble && m.res && m.amt !== v.doubleAmt) { m.prev = m.amt; m.amt = v.doubleAmt; sfx.click(); renderDen(); } return; } // 따블: 방금 받은 돈을 판돈으로 고른다 — 홀 · 짝은 새로 고름
    if (what === 'denleave') { R.denLeave(S); const f = S.ev.find(e => e.t === 'den_done'); m.fin = f ? { net: f.net, rounds: f.rounds } : { net: v.net, rounds: v.round }; m.res = null; drain(); sfx.click(); hold(DEN_AFTER); saveNow(); renderDen(); render(); }
  }
  function denBet(amt, pick) {
    const m = ui.modal, v = m.view;
    if (!amt) { deny('판돈을 먼저 고르세요 (1~4)'); return; }
    if (!R.denBet(S, amt, pick)) { drain(); return; } // 이유는 알림으로
    const r = S.ev.find(e => e.t === 'den_roll'), f = S.ev.find(e => e.t === 'den_done');
    drain(); saveNow(); // 굴리자마자 저장 (새로 고쳐서 다시 굴리기 없음)
    m.view = R.denView(S) || Object.assign({}, v, { round: f ? f.rounds : v.round + 1, streak: r.streak, net: f ? f.net : v.net + r.pay - r.bet, bets: v.bets.map(b => ({ amt: b.amt, ok: false })), canDouble: false, doubleAmt: 0 });
    if (m.prev != null) { m.amt = m.prev; m.prev = null; } // 따블 뒤에는 따블 전의 판돈으로 되돌린다 (가장 큰 판돈으로 바뀌지 않게)
    if (!m.view.bets.some(b => b.ok && b.amt === m.amt)) { const b = m.view.bets.filter(x => x.ok && x.amt <= m.amt).pop() || m.view.bets.find(x => x.ok); m.amt = b ? b.amt : 0; } // 걸던 판돈이 모자라면 그보다 작은 것 가운데 가장 큰 것으로
    m.old = v; m.res = null; m.fin = f ? { net: f.net, rounds: f.rounds } : null; m.next = r; // 구르는 동안은 굴리기 전의 숫자(연승 · 판 수 · 손익)를 보여 준다
    m.roll = { f: 0, n: calm() ? 6 : DEN_ROLL };
    hold(m.roll.n + DEN_AFTER); $('veil').classList.add('arming'); sfx.click(); renderDen(); render();
  }
  function stepDen() { // 구르는 동안 주사위 면을 바꾸고, 멈추면 결과
    const m = ui.modal;
    if (!m || m.type !== 'den' || !m.roll) return;
    const k = ++m.roll.f;
    if (k < m.roll.n) {
      if (k % 4 === 1) { m.face = [1 + Math.floor(fr() * 6), 1 + Math.floor(fr() * 6)]; drawDice(m, true); sfx.dice(); }
      return;
    }
    const r = m.next; m.roll = null; m.face = r.dice.slice(); m.res = r;
    renderDen();
    if (r.win) { rollTo('denpay', r.pay, 'denpay', v => '+' + won(v), 0); sfx.up(); const b = document.querySelector('.den-dice'), sr = stage.getBoundingClientRect(), k2 = 1280 / sr.width; if (b) { const q = b.getBoundingClientRect(); burst((q.left + q.width / 2 - sr.left) * k2, (q.top - sr.top) * k2, 46, 2.4); } else burst(640, 300, 46, 2.4); }
    else { sfx.bad(); if (!calm()) { const w = document.querySelector('.win.den'); if (w) { w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake'); } } }
  }
  function drawDice(m, tumbling) {
    const box = document.querySelector('.den-dice');
    if (!box) return;
    if (box.classList.contains('covered')) { box.innerHTML = '<span class="cover">' + art('cup') + '</span>'; return; } // 굴리기 전: 컵이 덮고 있다 (지난 결과로 읽히지 않게)
    box.innerHTML = m.face.map(k => '<span class="die"' + (tumbling ? ' style="transform:translateY(' + -2 * Math.floor(fr() * 8) + 'px) rotate(' + 90 * Math.floor(fr() * 4) + 'deg)"' : '') + '>' + art('die', k) + '</span>').join(''); // 픽셀 그림은 비스듬히 돌리면 계단이 깨져서 직각으로만
  }
  function renderDen() {
    const m = ui.modal, box = $('denbody');
    if (!box || !m || m.type !== 'den') return;
    const rolling = !!m.roll, v = rolling ? m.old : m.view, r = rolling ? null : m.res, fin = !rolling && m.fin, off = rolling ? ' disabled' : '';
    const edge = Math.round((1 - tune.den_pay / 2) * 100), pickName = p => (p === 'odd' ? '홀' : '짝');
    let res;
    if (rolling) res = '<span class="dim">' + pickName(m.next.pick) + '에 ' + won(m.next.bet) + '</span><b class="big">굴리는 중</b>';
    else if (r) res = '<span class="dim">합 ' + (r.dice[0] + r.dice[1]) + ' = ' + pickName((r.dice[0] + r.dice[1]) % 2 ? 'odd' : 'even') + ' · 고른 것 ' + pickName(r.pick) + '</span>' +
      (r.win ? '<b class="big up">맞힘</b><span class="up pay"><span id="denpay">' + (calm() ? '+' + won(r.pay) : '+' + won(rolls.denpay ? rolls.denpay.v : 0)) + '</span> 돌려받음</span>' : '<b class="big down">틀림</b><span class="down pay">−' + won(r.bet) + '</span>');
    else res = '<span class="dim">판돈을 고르고</span><b class="big">홀일까, 짝일까</b>';
    const lack = !fin && !v.bets.some(b => b.ok);
    box.innerHTML = '<div class="den-top"><div><h2>' + I('dice', '', 's') + '도박장</h2><h3>홀짝 — 주사위 둘의 합</h3></div><div class="den-rule" title="맞히면 판돈의 ' + tune.den_pay + '배를 돌려받습니다. 반반 게임이라 자릿세만큼 손해 보는 셈입니다">맞히면 ' + tune.den_pay + '배 · 자릿세 ' + edge + '%</div></div>' +
      '<div class="den-table' + (r ? (r.win ? '' : ' lose') : ' calm') + '"><span class="den-cup">' + art('cup') + '</span><div class="den-dice' + (!rolling && !r && !fin ? ' covered' : '') + '"></div><div class="den-res">' + res + '</div></div>' +
      '<div class="den-stats"><span title="연속으로 맞힌 판">' + I('fire', '', 's') + '연승 <b>' + v.streak + '</b></span><span title="한 번 가면 ' + v.max + '판까지">' + I('dice', '', 's') + '<b>' + v.round + ' / ' + v.max + '</b>판</span><span title="이번에 도박장에서 번(잃은) 돈">' + I('cash', '', 's') + '오늘 손익 <b class="' + cls(v.net) + '">' + sign(v.net) + '</b></span></div>' +
      (fin ? '<div class="den-fin">' + I('door') + '<span>' + (fin.rounds >= v.max ? v.max + '판을 다 했습니다. 문이 닫힙니다.' : '그만하고 나옵니다.') + ' ' + fin.rounds + '판 · 합계 <b class="' + cls(fin.net) + '">' + sign(fin.net) + '</b></span></div>' +
        '<div class="foot"><button class="btn main" data-do="ok">나간다 <span class="key">Space</span></button></div>'
        : '<div class="den-bets"><span class="lab">판돈</span>' + (v.canDouble && r && r.win && m.amt === v.doubleAmt && !v.bets.some(b => b.amt === m.amt) ? '<span class="dbet on dbl" title="방금 받은 돈을 그대로 겁니다">따블 ' + num(v.doubleAmt) + '</span>' : '') + v.bets.map((b, i) => '<button class="dbet' + (m.amt === b.amt ? ' on' : '') + '" data-do="denamt" data-arg="' + i + '"' + (b.ok && !rolling ? '' : ' disabled') + ' title="' + won(b.amt) + ' 걸기' + (b.ok ? '' : ' — 현금이 모자랍니다') + '"><span class="key">' + (i + 1) + '</span>' + num(b.amt) + '</button>').join('') + '</div>' +
          '<div class="den-picks"><button class="btn dpick" data-do="denpick" data-arg="odd"' + (lack ? ' disabled' : off) + ' title="합이 홀수에 건다"><span class="key">' + keyName('ArrowLeft') + '</span>홀</button><button class="btn dpick" data-do="denpick" data-arg="even"' + (lack ? ' disabled' : off) + ' title="합이 짝수에 건다">짝<span class="key">' + keyName('ArrowRight') + '</span></button></div>' +
          '<div class="foot">' + (lack ? '<span class="dim lackline">현금이 모자라 더 걸 수 없습니다</span>' : '') + '<button class="btn" data-do="denleave"' + off + '>그만하고 나간다 <span class="key">Space</span></button>' +
          (v.canDouble && r && r.win && m.amt !== v.doubleAmt ? '<button class="btn warm" data-do="dendouble" title="방금 돌려받은 돈 ' + won(v.doubleAmt) + '을 판돈으로 고릅니다. 홀 · 짝은 새로 고릅니다">따블: 받은 ' + num(v.doubleAmt) + ' 다시 걸기 <span class="key">Enter</span></button>' : '') + '</div>');
    drawDice(m, rolling);
  }
  // ── 코인 연습: 진짜 돈이 아닌 100,000원 · 3배로 세 박자 (롱 → 숏 → 틀린 롱 = 청산). 판 상태(S)와 난수는 건드리지 않는다 ──
  // 값은 규칙의 식(R.levValue · R.levLiq)에 연습용 포지션을 넣어 셈한다. 차트는 step() 이 DRILL_MOVE 걸음 동안 민다 (수동 걸음에서도 같음)
  const DRILL = [
    { side: 'long', chg: 0.06, ask: '오를 것 같다 → <b class="up">롱</b>을 누른다', why: '지금은 오를 것 같은 차례 — 롱을 누릅니다' },
    { side: 'short', chg: -0.06, ask: '내릴 것 같다 → <b class="down">숏</b>을 누른다', why: '지금은 내릴 것 같은 차례 — 숏을 누릅니다' },
    { side: 'long', chg: -0.34, ask: '방향이 틀리면? → <b class="up">롱</b>을 눌러 본다', why: '틀리면 어떻게 되는지 볼 차례 — 롱을 누릅니다' },
  ];
  const DRILL_PUT = 100000, DRILL_LEV = 3, DRILL_PX = 1000, DRILL_MOVE = 72, DRILL_BASE = [];
  for (let i = 0; i < 30; i++) DRILL_BASE.push(Math.round(DRILL_PX * (1 + 0.03 * Math.sin(i * 0.7 + 1) * (1 - i / 30) + 0.012 * Math.sin(i * 2.1) * (1 - i / 30)))); // 연습 차트의 지난 값 (늘 같은 모양, 끝 = 1,000원)
  DRILL_BASE[29] = DRILL_PX;
  const drillPos = side => ({ dir: side === 'long' ? 1 : -1, lev: DRILL_LEV, put: DRILL_PUT, margin: DRILL_PUT, entry: DRILL_PX }); // 수수료 · 유지비는 빼고 (창에 따로 적음)
  const drillVal = (pos, px) => Math.round(R.levValue({ lev: pos, market: { px: { coin: px } } }));
  function drillNew() { return { type: 'drill', beat: 0, ph: 'ask', f: 0, n: 0, pos: null, px: DRILL_PX, hist: DRILL_BASE.slice(), why: '', res: null }; }
  function drillDone() { // 끝까지 봤거나 건너뜀: 한 번만 뜨는 설명으로 기록
    ui.modal = null; meta.seen.coin = 1; saveMeta(); hold(16); sfx.click(); renderVeil(); pump(); render();
  }
  function drillRun(what, arg) {
    const m = ui.modal;
    if (!m || m.type !== 'drill' || m.ph === 'move') return; // 차트가 움직이는 동안은 안 받음
    if (what === 'drillskip') { drillDone(); return; }
    const b = DRILL[m.beat];
    if (m.ph === 'ask') {
      if (what === 'drillgo' && arg === b.side) { // 맞는 버튼: 연습 포지션을 열고 차트를 움직인다
        m.pos = drillPos(b.side); m.ph = 'move'; m.f = 0; m.n = calm() ? 12 : DRILL_MOVE; m.why = '';
        hold(m.n + 20); $('veil').classList.add('arming'); sfx.click(); renderDrill(); return;
      }
      m.why = b.why; sfx.deny(); renderDrill(); // 다른 것을 누름: 이유를 보이고 그 자리를 흔든다
      const a = document.querySelector('.drill-ask'); if (a) { a.classList.remove('nudge'); void a.offsetWidth; a.classList.add('nudge'); }
      return;
    }
    if (what !== 'ok') return;
    if (m.ph === 'show') { m.beat++; m.ph = m.beat < DRILL.length ? 'ask' : 'end'; m.pos = null; m.px = DRILL_PX; m.hist = DRILL_BASE.slice(); m.res = null; hold(12); sfx.click(); renderDrill(); return; }
    if (m.ph === 'end') drillDone();
  }
  function stepDrill() {
    const m = ui.modal;
    if (!m || m.type !== 'drill' || m.ph !== 'move') return;
    const b = DRILL[m.beat], t = ++m.f / m.n, k = Math.max(1, Math.round(m.n / 12));
    m.px = DRILL_PX * (1 + b.chg * ease(Math.min(1, t)) + 0.008 * Math.sin(t * Math.PI * 5) * (1 - t));
    if (m.f % k === 0 || m.f >= m.n) m.hist.push(m.f >= m.n ? DRILL_PX * (1 + b.chg) : m.px);
    if (m.f >= m.n) {
      m.px = DRILL_PX * (1 + b.chg);
      const v = drillVal(m.pos, m.px);
      m.res = { v, pnl: v - DRILL_PUT, liq: v <= 0 };
      m.ph = 'show'; renderDrill();
      if (m.res.liq) { sfx.bad(); if (!calm()) { const w = document.querySelector('.win.drill'); if (w) { w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake'); } } }
      else { sfx.up(); const c = document.getElementById('drillc'), sr = stage.getBoundingClientRect(); if (c) { const q = c.getBoundingClientRect(), k2 = 1280 / sr.width; burst((q.right - 40 - sr.left) * k2, (q.top + 20 - sr.top) * k2, 30, 2.2); } }
      return;
    }
    drawDrill(m);
    const el = $('drillnow'), v = drillVal(m.pos, m.px);
    if (el) { el.textContent = won(v); el.className = cls(v - DRILL_PUT); }
  }
  function renderDrill() {
    const m = ui.modal, box = $('drillbody');
    if (!box || !m || m.type !== 'drill') return;
    const head = '<div class="drill-top"><div><h2>' + I('bolt', '', 's') + '코인 연습 <span class="dim">진짜 돈 아님</span></h2>';
    if (m.ph === 'end') {
      const row = (ic, html, c) => '<div' + (c ? ' class="' + c + '"' : '') + '>' + I(ic) + '<span>' + html + '</span></div>';
      box.innerHTML = head + '<h3>진짜 돈은 아래에서 건다 — 작게 걸어 본다</h3></div></div><div class="crows">' +
        row('up', '오를 것 같으면 <b class="up">롱</b>, 내릴 것 같으면 <b class="down">숏</b> — 맞히면 움직인 만큼 × 배율', 'good') +
        row('skull', '거꾸로 가면 같은 셈으로 잃고, 크게 거꾸로 가면 건 돈이 전부 사라진다 (청산: 3배면 33%)', 'bad') +
        row('cash', '열 때 수수료 · 들고 있는 동안 유지비가 조금씩 빠진다. 처음에는 현금의 25% · 1~2배로', 'gold') + '</div>' +
        '<div class="foot"><span class="dim fl">코인 탭의 "연습"으로 다시 볼 수 있습니다</span><button class="btn main" data-do="ok">알겠다 <span class="key">Space</span></button></div>';
      return;
    }
    const b = DRILL[m.beat], v = m.pos ? drillVal(m.pos, m.px) : DRILL_PUT, pc = Math.round(Math.abs(b.chg) * 100);
    let res = '';
    if (m.ph === 'show') {
      const r = m.res;
      res = r.liq ? '<div class="drill-res bad"><b class="big">청산</b><span>건 돈 <b>' + won(DRILL_PUT) + '</b>이 전부 사라짐. ' + DRILL_LEV + '배는 ' + Math.floor(100 / DRILL_LEV) + '% 거꾸로 가면 끝</span></div>'
        : '<div class="drill-res"><b class="big ' + cls(r.pnl) + '">' + sign(r.pnl) + '</b><span>= ' + won(DRILL_PUT) + ' × ' + pc + '% × ' + DRILL_LEV + '배' + (b.side === 'short' ? ' — <b>숏은 내려도 번다</b>' : ' — 오른 만큼의 ' + DRILL_LEV + '배') + '</span></div>';
    } else if (m.ph === 'move') res = '<div class="drill-res dim"><span>' + (b.side === 'long' ? '롱' : '숏') + ' ' + DRILL_LEV + '배 — 차트가 움직이는 중</span></div>';
    else res = '<div class="drill-res dim"><span>' + (m.beat === 2 ? '롱은 오르면 벌지만, 내리면 3배로 잃는다' : '눌러 보면 차트가 움직인다') + '</span></div>';
    const go = (side, ic) => '<button class="btn ' + (side === 'long' ? 'up' : 'down') + ' dgo" data-do="drillgo" data-arg="' + side + '"' + (m.ph === 'ask' ? '' : ' disabled') + '><span class="key">' + (side === 'long' ? 1 : 2) + '</span>' + I(ic) + (side === 'long' ? '롱' : '숏') + '</button>';
    box.innerHTML = head + '<p class="drill-ask' + (m.why ? ' no' : '') + '">' + (m.why ? I('warn', '', 's') + esc(m.why) : b.ask) + '</p></div><span class="drill-n">' + (m.beat + 1) + ' / ' + DRILL.length + '</span></div>' +
      '<div class="drill-bar"><span>' + I('cash', '', 's') + '연습 돈 <b>' + won(DRILL_PUT) + '</b></span><span>' + I('bolt', '', 's') + '<b>' + DRILL_LEV + '배</b> 고정</span><span class="r">지금 <b id="drillnow" class="' + cls(v - DRILL_PUT) + '">' + won(v) + '</b></span></div>' +
      '<div class="drill-chart"><canvas id="drillc" width="1176" height="300"></canvas></div>' + res +
      '<div class="foot"><button class="btn small skipd" data-do="drillskip" title="연습을 건너뜁니다. 코인 탭의 &quot;연습&quot;으로 다시 볼 수 있습니다">건너뛰기 <span class="key">Esc</span></button><span style="flex:1"></span>' +
      (m.ph === 'show' ? '<button class="btn main" data-do="ok">' + (m.beat + 1 < DRILL.length ? '다음' : '마무리') + ' <span class="key">Space</span></button>' : go('long', 'up') + go('short', 'down')) + '</div>';
    drawDrill(m);
  }
  function drawDrill(m) {
    const cv = $('drillc');
    if (!cv) return;
    fitCanvas(cv);
    const c = cv.getContext('2d'), Wc = cv.width, Hc = cv.height, h = m.hist.concat(m.ph === 'move' ? [m.px] : []), n = Math.max(h.length, DRILL_BASE.length + 13);
    c.clearRect(0, 0, Wc, Hc);
    const lo = DRILL_PX * 0.6, hi = DRILL_PX * 1.12, X = i => 16 + (Wc - 140) * i / (n - 1), Y = v => Hc - 14 - (Hc - 28) * (v - lo) / (hi - lo);
    const last = h[h.length - 1], up = last >= DRILL_PX;
    pxLine(c, h.map((v, i) => [X(i), Y(v)]), Hc, up ? PX.r : PX.b, up ? PX.R : PX.B, true);
    const lines = m.pos ? [[DRILL_PX, PX.O, '진입'], [R.levLiq(m.pos), PX.R, '청산']] : [[DRILL_PX, PX.E, '지금']], labs = [];
    for (const l of lines) {
      if (l[0] < lo || l[0] > hi) continue; // 숏의 청산선은 위로 멀어 차트 밖
      const y = Y(l[0]);
      pxDash(c, y, 16, Wc - 116, l[1]);
      labs.push([Math.round((Wc - 104) / 2), clamp(Math.round(y / 2) - 10, 0, Hc / 2 - 20), l[1], l[2], 'ln']);
    }
    chartLabels(cv, labs);
  }
  function chartLabels(cv, labs) { // 차트 위 글자: 캔버스 옆에 16px 글자로 (점 글꼴이 또렷하게). labs = [[x, y, 색, 글, 종류]] (화면 px)
    const box = cv.parentElement, ln = labs.filter(l => l[4] === 'ln').sort((a, b) => a[1] - b[1]), H = box.clientHeight;
    for (let i = 1; i < ln.length; i++) ln[i][1] = Math.max(ln[i][1], ln[i - 1][1] + 16); // 선 이름(진입 · 청산 · 산 값)이 가까우면 한 줄씩 벌림
    const over = ln.length ? ln[ln.length - 1][1] + 16 - H : 0;
    if (over > 0) for (const l of ln) l[1] = Math.max(0, l[1] - over); // 아래로 넘치면 함께 올림
    for (const e of box.querySelectorAll('.cl')) e.remove();
    for (const [x, y, k, t, kind] of labs) { const s = document.createElement('span'); s.className = 'cl ' + kind; s.style.left = x + 'px'; s.style.top = y + 'px'; s.style.color = k; s.textContent = t; box.appendChild(s); }
  }
  function finish() {
    ui.ending = false; hold(45); clearSave();
    const e = S.ended; // 끝은 하나뿐: 한국 최고 부자 선언 (기한이 없어 실패 엔딩은 없다)
    meta.wins = (meta.wins || 0) + 1; meta.bestTier = 9; if (!meta.bestDay || e.day < meta.bestDay) { meta.bestDay = e.day; meta.bestRank = e.rank; }
    saveMeta();
    renderResults(); show('results');
    sfx.up(); burst(640, 420, 140, 2.6);
  }
  function gapToast(e) { // 밤사이 갭: 아침 소식이 장 전에 먼저 값에 들어간 만큼. 가진 것이 움직였으면 눈에 띄게, 아니면 차분하게
    if (!R.unlocked(S, 'stock')) return;
    const ids = Object.keys(e.pct || {}).filter(id => id !== 'coin' || R.unlocked(S, 'coin'));
    if (!ids.length) return;
    // 한 줄: "밤사이 화끈식품 −5.7% 외 1 · 내 손익 +1,521,830". 앞에 세우는 종목은 내가 가진 것 가운데 가장 크게 움직인 것. 넘치면 "외 N" → 금액 순으로 줄임 ("내 손익"은 끝까지 남김)
    const held = Math.abs(e.delta || 0) >= 1, mine = id => (id === 'coin' ? !!S.lev : !!(S.hold[id] && S.hold[id].units > 0));
    const order = ids.slice().sort((a, b) => (mine(b) - mine(a)) || Math.abs(e.pct[b]) - Math.abs(e.pct[a])), top = order[0], more = order.length - 1;
    const line = (m, p) => '<div><span class="lab">밤사이</span> <b class="' + cls(e.pct[top]) + '">' + R.ASSETS.find(a => a.id === top).name + ' ' + pct(e.pct[top]) + '</b>' + (m && more ? '<span class="lab"> 외 ' + more + '</span>' : '') + (held ? ' · <b class="pl ' + cls(e.delta) + '">내 손익 ' + p + '</b>' : '') + '</div>';
    toast(I(held ? (e.delta > 0 ? 'up' : 'down') : 'news') + fitLine([line(1, sign(e.delta)), line(0, sign(e.delta)), line(1, csign(e.delta)), line(0, csign(e.delta))]), 'gap ' + (held ? cls(e.delta) : 'calm'), held ? 480 : 300);
  }
  const clearFlies = () => { for (const e of $('fx').querySelectorAll('.fly')) e.remove(); }; // 떠오르던 숫자가 새로 뜬 창 위에 겹치지 않게
  function openModal(m) {
    clearFlies();
    for (const o of [...$('toasts').children].reverse()) if (o._kind !== 'deny') { ui.toastQ.unshift([o._key, o._kind, Math.max(120, o._life), o._day]); o.remove(); } // 떠 있던 알림은 창이 닫힌 뒤에 다시 (창 글 위로 올라오지 않게)
    ui.modal = m; hold(GUARD[m.type] || 18); $('veil').classList.add('arming'); // 0.3~0.6초: 연달아 누른 것이 새 창을 닫지 않게 (그동안 버튼이 흐림)
    if (m.type === 'quest') { sfx.ding(); burst(640, 330, 28, 2.2); }
    else if (m.type === 'perk') { sfx.level(); burst(640, 300, 70, 2.8); }
    else if (m.type === 'act1') { sfx.up(); burst(640, 300, 120, 2.6); }
    else if (m.type === 'biz') { sfx.level(); burst(640, 300, 50, 2.4); }
    else if (m.type === 'shock') { const e = m.e; if (!e.held) sfx.ding(); else if (e.delta < 0) { sfx.bad(); if (!m.still) shake(); } else { sfx.up(); burst(640, 120, 40, 2.4); } } // 든 종목이면 한 번만 크게, 아니면 차분하게
    else if (m.type === 'tier') sfx.up(); else if (m.type === 'liq' || m.type === 'foreclose') sfx.bad(); else if (m.type === 'intro' || m.type === 'event' || m.type === 'den' || m.type === 'drill') sfx.ding();
    renderVeil();
  }
  function closeModal(yes) {
    const m = ui.modal;
    if (!m || m.type === 'perk' || m.type === 'den' || (m.type === 'event' && !m.done)) return; // 고르기 전에는 닫히지 않음 (도박장은 "그만"으로만)
    hold(16);
    if (m.type === 'mg' && m.pre) { if (!yes) { ui.modal = null; sfx.click(); renderVeil(); render(); } return; } // 돌아가기: 아무것도 쓰지 않는다
    if (m.type === 'mg') { if (!m.res) return; ui.modal = null; ui.from = { x: 640, y: 330 }; renderVeil(); sfx.pay(); done(); return; }
    if (m.type === 'night') { ui.modal = null; R.nextDay(S); if (!S.ended) saveNow(); renderVeil(); done(); return; }
    if (m.type === 'event') { ui.modal = null; renderVeil(); done(); return; }
    if (m.type === 'confirm') {
      ui.modal = null; renderVeil();
      if (yes && m.kind === 'sleep') { sleepNow(); return; }
      if (yes) { if (m.kind === 'move') { if (R.move(S, m.to)) sfx.up(); } else if (m.kind === 'swap') { if (R.move(S, 3, 'jeonse')) sfx.up(); } else if (m.kind === 'biz') { if (R.bizUp(S)) sfx.level(); } else if (m.kind === 'top') R.declareTop(S);
        else if (m.kind === 'propbuy') { if (R.buyProp(S, m.v.id)) sfx.up(); } else if (m.kind === 'propsell') { if (R.sellProp(S, m.v.id)) sfx.pay(); } }
      done(); return;
    }
    if (m.type === 'intro') { R.setDream(S, m.dream || R.dreamList()[0].id); saveNow(); } // 고른 꿈으로 판을 시작한다
    if (m.type === 'buy' || m.type === 'repay' || m.type === 'lease') {
      const o = m.opts[m.pick];
      if (yes && !(o && o.ok)) { deny(o ? o.why : ''); return; } // 못 하는 것을 고른 채 Enter: 창은 그대로
      ui.modal = null; renderVeil();
      if (yes) { if (m.type === 'buy') { if (R.buyHome(S, m.to, o.loan, o.lease)) sfx.up(); } else if (m.type === 'lease') { if (R.move(S, 3, o.lease)) sfx.up(); } else if (R.repay(S, o.amt)) sfx.pay(); }
      done(); return;
    }
    if (m.type === 'act1' || m.type === 'biz') { S.unseen = (S.unseen || []).filter(x => x.type !== m.type); saveNow(); } // 본 창은 저장에서 지움
    ui.modal = null; sfx.click(); renderVeil(); pump(); render();
  }
  function ping() { const el = $('quest'); el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping'); }
  function fly(text, color, from) { // 번 자리에서 떠서 위쪽 띠의 현금 칸으로
    const d = document.createElement('div'), o = from || ui.from || { x: 640, y: 200 }, n = ui.flyN++ % 4;
    d.className = 'fly ' + color; d.textContent = text; d.style.animationDelay = (n * 0.1) + 's'; // 여러 개면 줄을 달리하고 조금씩 늦게
    const x = clamp(o.x - 40, 20, 1260 - wid(text) * 16), y = clamp(o.y - 30 + n * 34, 70, 660); // 32px 글자: 영문 · 숫자 한 칸 16px (오른쪽 끝에서 잘리지 않게)
    d.style.left = x + 'px'; d.style.top = y + 'px';
    d.style.setProperty('--dx', (780 - x) + 'px'); d.style.setProperty('--dy', (30 - y) + 'px');
    $('fx').appendChild(d);
    d.addEventListener('animationend', () => d.remove());
    while ($('fx').children.length > 6) $('fx').firstChild.remove();
  }
  function stamps(chg) { // 내가 든 것이 한 칸에 크게 움직이면 도장
    if (calm()) return;
    let best = null;
    for (const a of R.ASSETS) {
      const mine = a.kind === 'coin' ? (S.lev ? S.lev.dir : 0) : (S.hold[a.id].units > 0 ? 1 : 0), v = (chg[a.id] || 0) * mine;
      if (mine && Math.abs(v) >= 0.08 && (!best || Math.abs(v) > Math.abs(best.v))) best = { a, v, raw: chg[a.id] };
    }
    if (!best) return;
    const d = document.createElement('div');
    d.className = 'stamp ' + (best.v > 0 ? 'up' : 'down');
    d.innerHTML = (best.v > 0 ? '떡상' : '떡락') + '<i>' + best.a.name + ' ' + pct(best.raw, 0) + '</i>';
    $('fx').appendChild(d); // 구역은 곧 다시 그려지므로 그 위 층에 찍는다
    d.addEventListener('animationend', () => d.remove());
    sfx.stamp();
  }
  function copyCard(which) { // 결과 카드(1막 끝 · 엔딩)를 클립보드로 (막혀 있으면 글을 골라 둠)
    const text = R.resultCard(S, which), ok = () => toast(I('check') + '<span>결과 카드를 복사했습니다</span>', '', 180);
    const pick = () => { const pre = [...document.querySelectorAll('.e-card pre')].find(e => e.offsetParent); if (!pre) return; const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); try { if (document.execCommand('copy')) ok(); } catch (e) { /* 골라 둔 채로 둠 */ } };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, pick); else pick(); } catch (e) { pick(); }
    sfx.click();
  }

  // ── 미니게임 ──
  function fallbackGame(opts) { // minigames.js 가 없을 때를 위한 가장 단순한 것 (막대가 가운데일 때 누르기)
    const g = { w: 880, h: 380, title: '타이밍', howto: '막대가 가운데일 때 Space', controls: [{ code: 'Space', label: '누르기' }], done: false, result: null, t: 0, hits: 0, tries: 0 };
    g.update = dt => { g.t += dt; if (g.t > opts.seconds + 0.8) { g.done = true; g.result = { score: clamp(g.hits / 5, 0, 1), hits: g.hits, total: 5 }; } };
    g.press = () => { if (g.t < 0.8 || g.tries >= 5) return; g.tries++; if (Math.abs(Math.sin(g.t * 3)) < 0.3) g.hits++; };
    g.draw = c => { // 밝은 크림 바탕 · 어두운 외곽선 · 굵은 점 (4px 칸에 맞춤)
      const q = v => Math.round(v / 4) * 4, x = q(436 + Math.sin(g.t * 3) * 290);
      c.fillStyle = PX.c || '#fff4d6'; c.fillRect(0, 0, 880, 380);
      c.fillStyle = PX.k || '#2b1d2e'; c.fillRect(136, 166, 608, 48); c.fillStyle = PX.L || '#d4d8e0'; c.fillRect(140, 170, 600, 40);
      c.fillStyle = PX.g || '#5cc04a'; c.fillRect(392, 170, 96, 40);
      c.fillStyle = PX.k || '#2b1d2e'; c.fillRect(x - 4, 146, 16, 88); c.fillStyle = PX.o || '#f28a2e'; c.fillRect(x, 150, 8, 80);
    };
    return g;
  }
  // 알바 카드를 누르면 언제나 "시작 전 화면": 그림 자리에 시연이 돌고, 강도를 고른 뒤 "시작"을 눌러야 칸 · 체력 · 난수를 쓴다
  const mgOpts = (a, n) => ({ rng: () => R.rnd2(S), level: a.lv, seconds: tune.mg_seconds, pal: window.MGPAL || PAL, font: window.PXFONT || FONT, ramp: tune.mg_ramp, levelSpeed: tune.mg_level_speed, intensity: n, pace: tune['mg_int_' + n], ready: tune.mg_ready, warm: tune.mg_warm, warmSec: tune.mg_warm_sec }); // 준비 시간 · 느린 시작
  function demoFor(m) { // 고른 강도의 실제 속도로 새로 돈다. minigames.js 가 없으면 대역의 첫 장면만 (움직이지 않음)
    m.lit = '';
    try { m.demo = window.Minigames && window.Minigames.demo ? window.Minigames.demo(m.id, mgOpts(m.act, m.n)) : null; } catch (e) { m.demo = null; }
    m.still = !m.demo; if (m.still) m.demo = fallbackGame(mgOpts(m.act, m.n));
  }
  function startJob(id) {
    const a = R.acts(S).find(x => x.id === id);
    if (!a || !(a.any || a.push)) { deny(a ? a.why : ''); return; }
    sfx.click(); clearFlies();
    for (const o of [...$('toasts').children]) if (o._kind === 'deny') o.remove(); // 방 그림 위에 떠 있던 "모자랍니다" 류는 지운다 (창과 겹치지 않게)
    const first = GUIDE && !meta.seen[id]; // 처음 하는 알바는 하는 법에 머리글을 달고 더 오래 막는다
    ui.modal = { type: 'mg', id, act: a, n: a.use, mg: null, demo: null, res: null, pre: true, first }; ui.guard = 0; // n: 기억한 강도 이하에서 할 수 있는 가장 높은 것 (내려서 열어도 기억은 그대로)
    demoFor(ui.modal);
    hold(first ? 24 : 15); $('veil').classList.add('arming'); // 카드를 두 번 누른 것이 시작 · 강도 버튼까지 누르지 않게
    renderVeil();
  }
  function pickInt(n) {
    const m = ui.modal, L = m.act.levels[n];
    if (!L || n === m.n) return;
    if (!L.can) { sfx.deny(); m.why = L.name + (n ? '은' : '는') + ' 체력 ' + L.hp + ' 필요 (지금 ' + Math.floor(S.hp) + ')'; m.whyT = 120; renderVeil(); return; } // 알림 대신 창 안 맨 아래 줄에 2초 (창 위로 뜨는 알림이 그림을 가리지 않게)
    m.n = n; m.why = ''; R.setInt(S, m.id, n); saveNow(); sfx.click(); demoFor(m); renderVeil();
  }
  function stepInt(d) { // ← → : 할 수 있는 강도 사이에서만. 막히면 바로 옆이 왜 안 되는지
    const m = ui.modal, lv = m.act.levels;
    for (let k = m.n + d; k >= 0 && k <= 3; k += d) if (lv[k].can) { pickInt(k); return; }
    if (lv[m.n + d]) pickInt(m.n + d); else sfx.deny();
  }
  function beginMg() { // 시작: 진짜 판을 고른 강도로. 여기서부터 칸을 쓰고, 하다가 새로 고치면 "대충"
    const m = ui.modal, opts = mgOpts(m.act, m.n);
    let mg = null;
    try { mg = window.Minigames ? window.Minigames.create(m.id, opts) : null; } catch (e) { mg = null; }
    m.mg = mg || fallbackGame(opts); m.demo = null; m.pre = false;
    meta.seen[m.id] = 1; saveMeta(); S.pending = { id: m.id, n: m.n }; saveNow(); sfx.click(); renderVeil(); // 하다가 새로 고치면 그 강도의 체력으로 "대충" (R.quitJob)
  }
  function finishMg() {
    const m = ui.modal, r = m.mg.result || { score: 0 };
    const score = clamp(Number(r.score) || 0, 0, 1);
    S.pending = null;
    R.doJob(S, m.id, score, m.n);
    saveNow();
    const j = S.ev.find(e => e.t === 'job') || { pay: 0, base: 0, grade: 'ok', gradeName: '보통', mult: 1, gmult: 1, imult: 1, int: m.n, intName: R.INT[m.n], hp: 0, combo: 0, comboWas: 0, comboMult: 1, extra: 1 };
    m.res = { j, tip: S.ev.find(e => e.t === 'tip'), wh: S.ev.find(e => e.t === 'while') };
    rollTo('mgpay', j.pay + (m.res.tip ? m.res.tip.amt : 0), 'mgpay', v => '+' + won(v), 0); // 일당이 0 에서 굴러 올라감
    hold(54); $('veil').classList.add('arming'); // 미니게임을 하던 누름이 결과 창을 닫지 않게 (0.9초)
    if (j.grade === 'miss') sfx.deny(); else if (j.grade === 'perfect') { sfx.up(); burst(640, 300, 36, 2.4); } else sfx.ding();
    renderVeil();
  }
  function drawMg() {
    const m = ui.modal, g = m && m.type === 'mg' && (m.mg || m.demo);
    const cv = g && $('mgc');
    if (!cv) return;
    const c = cv.getContext('2d');
    c.setTransform(cv.width / g.w, 0, 0, cv.height / g.h, 0, 0);
    try { g.draw(c); } catch (e) { /* 그리기 실패는 판을 멈추지 않는다 */ }
  }
  function litKeys(m) { // 시연이 방금 누른 키: 조작 키 딱지를 눌린 모양으로(0.15초) + 그림 아래 가운데에 크게(0.35초)
    const p = m.demo.lastPress, on = p && p.age < 0.15 ? p.code : '', big = p && p.age < 0.35 ? p : null, e = document.querySelector('#veil .mg-press');
    if (big !== m.big && e) {
      const c = big && (m.demo.controls || []).find(x => x.code === big.code);
      m.big = big; e.classList.toggle('hide', !big);
      if (big) { e.innerHTML = '<span class="key">' + keyName(big.code) + '</span>' + esc(c ? c.label : ''); e.classList.remove('in'); void e.offsetWidth; e.classList.add('in'); }
    }
    if (on === m.lit) return;
    m.lit = on;
    for (const e of document.querySelectorAll('#veil .keys .key')) { e.classList.toggle('on', e.dataset.k === on); e.parentNode.classList.toggle('on', e.dataset.k === on); } // 이름도 함께 (저 때 저 키)
  }

  // ── 첫 판 안내: 한 번에 한 곳만 밝히고 한 줄만 말한다 ──
  // 단계는 판의 상태에서 읽는다 (저장했다 이어 해도 맞는 자리에서 이어진다).
  // ring = 고리를 두를 곳, lit = 고리 없이 밝혀 둘 곳, only = 그 단계에서 받는 누름, ok = 읽고 넘기는 단계의 버튼 글, at = 말풍선 자리.
  const moveOk = () => R.moveInfo(S, 1).ok, flyerOk = () => R.acts(S).some(a => a.id === 'flyer' && a.any); // 짚은 것을 할 수 없는 상태면 막지 않는다 (갇히지 않게)
  const TODAY = ['job', 'skip', 'rest', 'study', 'why', 'tip', 'tab', 'eat', 'item', 'wear']; // 오늘 칸에서 하는 것들 + 판의 탭(가게에서 사 먹기)
  const COACH = {
    job: { n: 1, at: 'below', ring: ['#today [data-arg="flyer"]'], lit: ['#quest'], only: (w, a) => !flyerOk() || (w === 'job' && a === 'flyer'),
      html: () => '<b>전단지</b>를 눌러 첫 돈을 번다 <span class="key">1</span><i>시연을 보고 강도를 고른 뒤 시작. 할 일은 왼쪽 아래 상태창의 퀘스트에</i>' },
    slots: { n: 2, at: 'below', ring: ['#today', '#me .me-row'], lit: ['#quest'], only: w => TODAY.indexOf(w) >= 0,
      html: () => '<b>카드를 골라</b> 남은 칸을 쓴다<i>하루는 세 칸, 같은 알바는 하루 한 번. 알바는 체력 ' + I('hp', '', 's') + ' 을 쓰고 쉬기는 채웁니다. 모자란 채 일하면(무리) 쓰러질 수 있어요. 아래 <b>가게</b>에서 사 먹으면 체력이 찹니다</i>' },
    endday: { n: 3, at: 'below', ring: ['#today [data-do="endday"]'], lit: ['#quest'], only: w => w === 'endday' || w === 'tip',
      html: () => '다 썼으면 <b>하루 마치기</b> <span class="key">Space</span><i>밤마다 번 돈과 쓴 돈이 한 장으로 정리되고, 자는 동안 체력이 돌아옵니다</i>' },
    move: { n: 4, at: 'right', ring: ['#board .rung.next [data-do="move"]'], lit: ['#quest', '#board .rung.next'], only: (w, a) => w === 'move' && Number(a) === 1, // 로드맵의 다음 칸(찜질방) 옮기기 버튼. 상태창의 같은 버튼도 받는다
      html: () => '<b>옮기기</b>를 눌러 찜질방으로<i>지붕 아래에서 자면 밤에 체력이 더 돌아옵니다 (+' + tune.sleep_station + '\u00a0→\u00a0+' + tune.sleep_sauna + ')</i>' },
    earn: { n: 4, at: 'right', ring: ['#board .rung.next'], lit: ['#quest', '#today', '#me', '#hud'], // 찜질방 요금이 없을 때: 막지 않고, 벌 수 있게 오늘 칸을 밝혀 둔다
      html: () => '현금 ' + won(R.saunaCost(S)) + '이 모이면 <b>옮기기</b>가 켜진다<i>그때까지는 알바로 벌어 둡니다</i>' },
    goal: { n: 5, at: 'above', ring: ['#quest', '#hud .goal'], lit: ['#hud [data-do="help"]'], ok: '알겠다',
      html: () => '안내는 여기까지<i>할 일은 늘 이 <b>상태창</b>에 뜹니다. 위쪽 ' + I('key', '', 's') + ' 은 다음 목표 — 기한 없이 한 단계씩 올라 한국 최고 부자까지. 주식 계좌도 열렸습니다(오른쪽 아래 탭). 모르는 아이콘은 오른쪽 위 ' + I('help', '', 's') + '</i>' },
    stock: { lab: '주식 — 처음 열었을 때', num: true, at: [660, 78], ring: ['#board .mlist', '#board .svtabs [data-arg="mine"]', '#board .tabs [data-arg="info"]'], ok: '알겠다',
      html: () => '<p><u>1</u><b>종목을 누르면</b> 차트가 뜨고, 몇 주를 살지 골라 산다. 팔아야 내 돈</p><p><u>2</u>가진 것은 <b>내 보유</b>에서 한눈에</p><p><u>3</u>소식과 공부는 <b>뉴스·공부</b> 탭에. 오늘 소식은 이미 값에 들어가 있다</p>' },
  };
  for (const id in COACH) COACH[id].id = id;
  function coachNow() {
    if (scene !== 'play' || !S || S.ended || ui.modal || ui.queue.length) return null;
    if (ui.tut) {
      if (S.day === 1) return S.slot >= 3 ? COACH.endday : S.slot === 0 && !S.stats.jobsDone ? COACH.job : COACH.slots;
      return S.tier > 0 ? COACH.goal : moveOk() ? COACH.move : COACH.earn;
    }
    if (!GUIDE) return null;
    if (ui.tab === 'stock' && ui.sview === 'market' && R.unlocked(S, 'stock') && !meta.seen.stock) return COACH.stock;
    return null;
  }
  function renderCoach() {
    const box = $('coach'), c = coachNow();
    if (!c) { ui.coach = ''; box.className = 'hide'; box.innerHTML = ''; return; }
    const sr = stage.getBoundingClientRect(), k = 1280 / sr.width, px = v => String(Math.round(v)); // 반 픽셀에 걸리지 않게 정수로
    const rect = sel => { const e = document.querySelector(sel), r = e && e.getBoundingClientRect(); return r && r.width ? { x: (r.left - sr.left) * k - 5, y: (r.top - sr.top) * k - 5, w: r.width * k + 10, h: r.height * k + 10 } : null; };
    const rings = c.ring.map(rect).filter(Boolean), holes = rings.concat((c.lit || []).map(rect).filter(Boolean));
    const fresh = ui.coach !== c.id;
    box.className = ''; // 숨긴 채로는 말풍선의 크기를 잴 수 없다
    const dk = PX.k || '#2b1d2e'; // 짚지 않은 곳은 창 뒤와 같은 한 겹(PX.k · 불투명도 0.6)으로 덮는다 (점 무늬는 늘이고 줄이면 지글거림)
    box.innerHTML = '<svg viewBox="0 0 1280 720"><defs><mask id="cmask"><rect width="1280" height="720" fill="#fff"/>' + holes.map(r => '<rect x="' + Math.round(r.x) + '" y="' + Math.round(r.y) + '" width="' + Math.round(r.w) + '" height="' + Math.round(r.h) + '" fill="#000"/>').join('') + '</mask></defs><rect width="1280" height="720" fill="' + dk + '" fill-opacity="0.6" mask="url(#cmask)"/></svg>' +
      rings.map((r, i) => '<div class="ring" style="left:' + px(r.x) + 'px;top:' + px(r.y) + 'px;width:' + px(r.w) + 'px;height:' + px(r.h) + 'px">' + (c.num ? '<u>' + (i + 1) + '</u>' : '') + '</div>').join('') +
      '<div class="bubble' + (fresh ? ' in' : '') + '"><em><span class="lab">' + (c.n ? '안내 ' + c.n + ' / 5' : c.lab) + '</span><span class="no">' + (c.ok ? '읽었으면 "' + c.ok + '"를 누릅니다' : '지금은 노란 고리 안만 눌립니다') + '</span></em><div class="tx">' + c.html() + '</div>' + // no = 다른 것을 눌렀을 때 이름표 자리에 뜨는 이유
      (c.n || c.ok ? '<div class="foot">' + (c.n ? '<button data-do="coachoff" title="안내를 끄고 혼자 해 봅니다. 제목 화면에서 다시 켤 수 있습니다">안내 끄기</button>' : '<span></span>') + (c.ok ? '<button class="btn main small" data-do="coachok">' + c.ok + ' <span class="key">Space</span></button>' : '') + '</div>' : '') + '</div>';
    const b = box.querySelector('.bubble'), bw = b.offsetWidth, bh = b.offsetHeight, t = rings[0];
    let x = 470, y = 286, side = '';
    if (Array.isArray(c.at)) { x = c.at[0]; y = c.at[1]; }
    else if (t && c.at === 'below') { x = t.x + t.w / 2 - bw / 2; y = t.y + t.h + 12; side = 'up'; }
    else if (t && c.at === 'above') { x = t.x + t.w / 2 - bw / 2; y = t.y - bh - 12; side = 'down'; }
    else if (t && c.at === 'right') { x = t.x + t.w + 12; y = t.y + t.h / 2 - bh / 2; side = 'left'; }
    x = clamp(x, side === 'up' ? 446 : 12, 1268 - bw); y = clamp(y, 12, 708 - bh); // 아래로 다는 말풍선은 오른쪽 단(오늘 · 판) 안에서만: 왼쪽의 체력 · 상태창을 가리지 않게
    b.style.left = px(x) + 'px'; b.style.top = px(y) + 'px';
    if (side) { b.classList.add(side); b.style.setProperty('--a', px(side === 'left' ? clamp(t.y + t.h / 2 - y, 20, bh - 20) : clamp(t.x + t.w / 2 - x, 20, bw - 20)) + 'px'); } // 화살표가 짚은 곳의 가운데를 가리키게
    if (fresh) { ui.coach = c.id; if (c.ok) hold(30); } // 읽고 넘기는 안내는 연타로 넘어가지 않게
    if (c.ok && ui.guard > 0) box.className = 'arming';
  }
  function nudge() { // 짚은 곳 말고 다른 것을 누름: 말풍선이 흔들려 다시 알려 준다
    sfx.deny();
    const b = document.querySelector('#coach .bubble');
    if (b) { b.classList.remove('in', 'nudge'); void b.offsetWidth; b.classList.add('nudge'); }
  }
  // ── 미니게임 창의 아래쪽: 하는 법(+ 조작 키) · 가운데 줄(시작 전: 강도 넷 + 시작, 하는 중: 조작 버튼) · 고른 강도의 한 줄 ──
  const ich = (n, long) => '<em class="ich i' + n + '" title="알바 강도 — 올릴수록 미니게임이 빠르고 판정이 좁아지며, 일당이 늘고, 체력이 조금 더 듭니다">' + (long ? '강도 ' : '') + R.INT[n] + '</em>';
  const INT_WHAT = { // 강도에 따라 게임마다 달라지는 것 (하 · 상 · 최상)
    flyer: ['꺾쇠가 넓고 뛰는 사람이 드물다', '꺾쇠가 좁고 뛰는 사람이 는다', '꺾쇠가 아주 좁고 사람이 몰린다'],
    loading: ['선이 넓고 벨트가 느리다', '선이 좁고 상자가 잦다', '선이 아주 좁고 쉴 틈이 없다'],
    store: ['찍을 물건이 적다', '찍을 물건이 늘어난다', '찍을 물건이 아주 많다'],
    delivery: ['한 줄에 한 차선만 막힌다', '차가 더 촘촘히 온다', '차가 아주 촘촘히 온다'],
  };
  function intLine(m) { // 결과 판이 떠 있으면 숨긴다 (자리는 지켜 그림 · 창이 안 움직이게)
    const n = m.n, w = INT_WHAT[m.id];
    const t = ['천천히', '기준 빠르기', '빠르다', '아주 빠르다'][n] + (w && n !== 1 ? ' · ' + w[n ? n - 1 : 0] : '');
    const arrow = c => (m.pre ? '<span class="key" title="← → 로 강도를 바꿉니다">' + keyName(c) + '</span>' : ''); // 시작 전에는 딱지 양옆에 ← → (강도를 바꾸는 키)
    return '<div class="mg-line' + (m.res ? ' gone' : '') + '">' + arrow('ArrowLeft') + ich(n, true) + arrow('ArrowRight') + (m.why ? '<b class="bad why">' + I('warn', '', 's') + esc(m.why) + '</b>' : m.pre && !m.act.levels[n].ok ? '<b class="bad why">' + I('warn', '', 's') + '체력이 모자랍니다 (' + Math.floor(S.hp) + ' / ' + m.act.levels[n].hp + ') — 무리하면 끝나고 쓰러질 확률 ' + Math.round(m.act.levels[n].risk * 100) + '%</b>' : '<span>' + t + '</span>' + (n >= 2 ? '<b class="bad">' + I('warn', '', 's') + '실수하면 보너스 없음</b>' : '')) +
      (m.pre ? '<button class="btn small r" data-do="no">돌아가기 <span class="key">Esc</span></button>' : '') + '</div>';
  }
  function calcLine(j) { // "기준 170,000 · 잘함 ×1.2 · 최상 ×1.5" — 중이거나 실수면 강도 조각은 없음. 요령으로 대충 바닥에 걸리면 그 값
    const parts = ['기준 ' + num(j.base), j.gradeName + ' ×' + j.gmult];
    if (j.int !== 1 && j.grade !== 'miss') parts.push(j.intName + ' ×' + j.imult);
    if (j.mult > j.gmult * j.imult + 1e-9) parts.push('대충 바닥 ×' + j.mult);
    return parts.join(' · ');
  }
  function ctlHtml(m) {
    const g = m.mg || m.demo, lines = g.how || [g.howto || '']; // how 가 없는 것은 minigames.js 없이 도는 대역(fallbackGame)뿐
    const how = '<div class="mg-how"><ol>' + (m.first ? '<em>처음 하는 알바 — 하는 법</em>' : '') + lines.map(t => '<li>' + esc(t) + '</li>').join('') + '</ol>' +
      '<div class="keys' + ((g.controls || []).length === 3 ? ' n3' : '') + '">' + (g.controls || []).map(c => '<span>' + esc(c.label) + '<span class="key" data-k="' + c.code + '">' + keyName(c.code) + '</span></span>').join('') + '</div></div>';
    const lv = m.act.levels, act = m.pre
      ? lv.map(L => '<button class="btn ib' + (L.n === m.n ? ' on' : '') + (L.ok ? '' : L.can ? ' risk' : ' lock') + '" data-do="int" data-arg="' + L.n + '" title="' + L.name + ' — 일당(보통) ' + won(L.pay) + ' · 체력 ' + L.hp + (L.ok ? '' : L.can ? ' (모자랍니다 — 무리하면 쓰러질 확률 ' + Math.round(L.risk * 100) + '%)' : ' (모자랍니다)') + '"><b>' + L.name + '</b>' + (L.ok ? '<span class="h">' + I('hp', '', 's') + '−' + L.hp + '</span><span class="p">' + I('coin', '', 's') + num(L.pay) + '</span>' : L.can ? '<span class="h">' + I('warn', '', 's') + '</span><span class="p risk">무리 ' + Math.round(L.risk * 100) + '%</span>' : '<span class="h">' + I('lock', '', 's') + '</span><span class="p">' + I('hp', '체력', 's') + L.hp + ' 필요</span>') + '</button>').join('') +
        '<button class="btn ' + (lv[m.n].ok ? 'main' : 'up') + ' go" data-do="mgstart">' + (lv[m.n].ok ? '시작' : '무리') + '<span class="key">Space</span></button>'
      : m.res ? '<button class="btn main" data-do="ok">확인 <span class="key">Space</span></button>' // 확인은 조작 버튼이 있던 자리에
        : (g.controls || []).map(c => '<button class="btn" data-mg="' + c.code + '">' + esc(c.label) + ' <span class="key">' + keyName(c.code) + '</span></button>').join('');
    return how + '<div class="mg-act' + (m.pre ? ' pick' : '') + '">' + act + '</div>' + intLine(m);
  }

  // ── 구역 hud: 날짜 · 시간 · 돈 · 다음 목표 · 단추 ──
  function weekStrip(wk) { // 이번 주 일곱 칸: 지난 날 · 오늘 · 남은 날, 일요일 칸에는 고정비. 고정비가 생긴 뒤(고시원부터)에만 — 그 전에는 "7일 기한"으로 읽히지 않게 아예 안 보임
    if (!wk.billDay) return '';
    const b = wk.bill, t = wk.week + '주차 ' + wk.dow + '일 / 7일' + (wk.billDay ? ' — 일요일(7일째) 밤 정산: ' + R.billName(b) + ' ' + won(b.amt) + (b.income ? ' · 들어올 돈(임대수익 · 배당) ' + won(b.income) : '') + (b.inDays === 0 ? ', 오늘 밤' : '') : '');
    return '<div class="wk" title="' + t + '">' + [1, 2, 3, 4, 5, 6, 7].map(i => {
      const c = i < wk.dow ? 'past' : i === wk.dow ? 'now' : '';
      return i === 7 ? '<span class="bill ' + c + (b.inDays <= 1 ? ' due' : '') + '">' + art('icon', 'bill') + '</span>' : '<i class="' + c + '"></i>';
    }).join('') + '<span class="wkl' + (b.inDays <= 1 ? ' due' : '') + '">' + (b.net > 0 ? '−' + cwon(b.net) : b.net < 0 ? '+' + cwon(-b.net) : '정산') + '</span></div>'; // 이번 일요일에 나갈 돈(들어올 돈을 뺀 것)을 늘 보인다
  }
  function goalHtml() { // 다음 목표: 이름 · 값 · 거기까지 온 만큼. 살 수 있으면 그 자리가 버튼 (옮기기 · 사기 · 선언)
    const g = R.goalView(S), top = g.kind === 'top', ic = top ? 'crown' : 'key';
    if (g.canBuy && !(ui.tut && S.day === 1)) { // 첫날 안내 중에는 버튼으로 안 보임 (안내가 그 단계에 오기 전에는 눌러도 안 되므로)
      const act = top ? 'data-do="top"' : g.tier <= 3 ? 'data-do="move" data-arg="' + g.tier + '"' : 'data-do="house"';
      const label = top ? '최고 부자 선언' : g.tier <= 3 ? g.name + '으로 옮기기' : g.name + ' 사기';
      const t = top ? '순자산이 ' + won(g.price) + '을 넘었습니다 — 누르면 한국 최고 부자 선언 확인 (엔딩)' : g.tier <= 3 ? g.name + '으로 옮길 수 있습니다' : g.name + '에 들어갈 수 있습니다 — 누르면 전세 · 대출을 고르는 창';
      return '<div class="goal"><button class="btn warm small goal-go" ' + act + ' title="' + t + '">' + I(ic) + label + '</button></div>';
    }
    const t = top ? '마지막 목표: 호텔에서 순자산 ' + won(g.price) + '을 넘기면 한국 최고 부자 선언 (지금 ' + won(g.have) + ')'
      : g.tier <= 1 ? '다음 목표: ' + g.name + ' — 현금 ' + won(g.price) + '이면 들어갑니다'
        : g.tier <= 3 ? '다음 목표: ' + g.name + ' — 보증금 ' + won(g.price) + ' (나갈 때 돌려받는 돈 · 살던 곳의 보증금이 보태집니다)'
          : '다음 목표: ' + g.name + ' ' + won(g.price) + ' — ' + (g.tier === 4 ? '현금으로만 (전세 보증금은 돌려받아 보태집니다)' : (g.loanMax ? '대출을 최대(' + won(g.loanMax) + ')로 끼거나 ' : '') + '전세(보증금 ' + won(g.jeonse) + ')로 들어가면') + ' 현금 ' + won(g.need) + '이 있으면 됩니다. 막대는 지금 현금';
    return '<div class="goal" title="' + t + '">' + I(ic) + '<span class="gn">' + g.name + '</span><span class="gp">' + shortWon(g.price) + '</span><div class="bar"><div style="width:' + (g.pct * 100).toFixed(1) + '%"></div></div><b>' + Math.floor(g.pct * 100) + '%</b></div>';
  }
  function renderHud() {
    const wk = R.week(S);
    $('hud').innerHTML =
      '<div class="zh" title="' + wk.week + '주차 ' + wk.dow + '일 — 판을 시작하고 ' + S.day + '일째 (기한 없음)">' + I('calendar') + '<b>' + S.day + '일째</b>' + weekStrip(wk) + '</div>' +
      '<div class="slots">' + SLOT_IC.map((n, i) => '<span class="' + (i < S.slot ? 'done' : i === S.slot ? 'now' : '') + '" title="' + SLOTS[i] + (i === S.slot ? ' — 지금' : i < S.slot ? ' — 지남' : '') + '">' + art('icon', n) + '<i>' + SLOTS[i] + '</i></span>').join('') + (S.slot >= 3 ? '<span class="now" title="밤 — 세 칸을 다 썼습니다. 하루 마치기로 잠듭니다">' + art('icon', 'zzz') + '<i>밤</i></span>' : '') + '</div>' + // 지금 칸만 글자까지, 나머지는 아이콘만 (뜻은 title). 세 칸을 다 쓴 밤에는 "밤" 칩이 켜짐
      (S.combo ? '<div class="money gold" title="콤보 ' + S.combo + ' — 다음 알바 일당 +' + Math.round((tune.combo_bonus + tune.perk_streak * R.perk(S, 'streak')) * S.combo * 100) + '%. 직접 해서 잘함 이상이면 쌓이고, 실수하거나 대충 하면 끊깁니다"><span class="ic" style="color:var(--O)">' + art('icon', 'fire') + '</span><b>' + S.combo + '</b></div>' : '') +
      '<div class="money" title="현금">' + I('cash') + '<i>현금</i><b id="cash">' + won(ui.cash) + '</b></div>' +
      '<div class="money" title="순자산 = 현금 + 투자한 돈 + 집(산 값) − 대출 − 밀린 돈">' + I('wallet') + '<i>순자산</i><b id="worth">' + won(ui.worth) + '</b></div>' +
      goalHtml() +
      '<div class="hbtns">' +
      '<button class="btn sq" data-do="achs" title="업적 (숫자는 이번 판에 얻은 수)">' + I('trophy') + (S.ach.length ? '<span class="n">' + S.ach.length + '</span>' : '') + '</button>' +
      '<button class="btn sq" data-do="help" title="도움말">' + I('help') + '</button>' +
      '<button class="btn sq" data-do="mute" title="소리 (M)">' + I(ui.mute ? 'mute' : 'sound') + '</button>' +
      '<button class="btn sq" data-do="quit" title="제목 화면으로 (지금까지는 저장됨)">' + I('home') + '</button></div>';
    fitHud();
  }
  function fitHud() { // 넘치지 않을 때까지 한 단계씩 줄인다 (index.html 의 #hud.k1~k4: "현금" · "순자산" 이름은 끝까지, 마지막은 목표 알약에 …). 잴 때는 굴러가는 숫자 대신 도착할 숫자(더 긴 쪽)를 넣고 잰다
    const hud = $('hud'), goal = hud.querySelector('#hud > .goal'), cash = $('cash'), worth = $('worth');
    const keep = [cash && cash.textContent, worth && worth.textContent], longer = (a, b) => (won(a).length >= won(b).length ? won(a) : won(b));
    if (cash) cash.textContent = longer(S.cash, ui.cash); if (worth) worth.textContent = longer(R.worth(S), ui.worth);
    const over = () => hud.scrollWidth > hud.clientWidth + 0.5 || (goal && goal.scrollWidth > goal.clientWidth + 0.5);
    const steps = ['', ' k1', ' k2', ' k3', ' k4'];
    for (let i = 0; i < steps.length; i++) { hud.className = 'zone' + steps[i]; if (!over()) break; }
    if (cash) cash.textContent = keep[0]; if (worth) worth.textContent = keep[1];
  }

  // ── 구역 me: 사는 곳 · 체력 · 레벨 · 특성 ──
  function bizRow() { // 사업: 지금 단계 · 일당 배수(사는 곳 때문에 덜 반영되면 그 표시) · 키우기 (내 집부터, 또는 이미 차린 뒤)
    const v = R.bizView(S), n = v.next;
    if (S.tier < 4 && !v.lv) return '';
    const cut = v.eff < v.lv ? '<span class="bad cut" title="지금 사는 곳(' + R.HOMES[S.tier].name + ')에서는 ' + v.effName + '까지만 일당에 반영됩니다. 다시 올라가면 돌아옵니다">반영 ×' + num(v.effMult) + '</span>' : '';
    const auto = v.eff ? Math.round(tune['biz_auto_' + v.eff] * 100) : 0;
    const go = !n ? '<span class="r dim">끝까지 키움</span>'
      : n.ok ? '<button class="chip hot go r" data-do="bizup" title="' + n.name + jo(n.name, '을', '를') + ' 차립니다: ' + won(n.cost) + ' · 일당 ×' + num(n.mult) + '">' + I('up', '', 's') + n.name + ' ' + num(n.cost) + '</button>'
        : '<button class="chip off r" data-do="why" data-arg="' + esc(n.why) + '" title="' + esc(n.name + ' ' + won(n.cost) + ' — ' + n.why) + '">' + I('lock', '', 's') + n.name + ' ' + num(n.cost) + '</button>';
    return '<div class="me-row biz" title="사업 — 같은 알바를 해도 일당 ×' + num(v.effMult) + (auto ? '. 쉬기 · 공부 칸에도 일당의 ' + auto + '%가 사업 매출로 들어옵니다' : '') + '">' + I('rocket') + '<b class="bn">' + v.name + '</b><span class="gold">×' + num(v.mult) + '</span>' + cut + go + '</div>';
  }
  function loanRow() { // 빚: 주담대 + 마이너스 통장. 합계 · 이번 일요일에 나갈 원리금과 이자 · 은행 탭으로 (빚이 있을 때만)
    const l = R.loanView(S), cv = R.creditView(S), total = (l ? l.balance : 0) + cv.balance;
    if (!total) return '';
    const b = R.bill(S), due = (b ? b.loan + b.credit : (l ? l.weekly : 0) + cv.week), part = !!(b && b.days < 7 && l);
    const tip = '빚 ' + won(total) + (l ? ' — 주담대 ' + won(l.balance) + ' (남은 ' + l.left + '회 · 한 주 이자 ' + pct1(l.rate) + ')' : '') + (cv.balance ? ' — 마이너스 통장 ' + won(cv.balance) + ' (한 주 이자 ' + pct1(cv.rate) + ')' : '') + '. 일요일 밤마다 고정비와 함께 나가고, 두 번 연속 못 내면 한 단계 아래로';
    return '<div class="me-row loan" title="' + tip + '">' + I('bill') + '<span class="lab">빚</span><b>' + shortWon(total) + '</b>' +
      '<span class="dim" title="이번 일요일에 나갈 원리금 · 이자 ' + won(due) + (part ? ' (' + b.days + '일치 — 이사한 주는 산 날만큼)' : '') + '">' + (part ? '이번 ' + num(due) + ' (' + b.days + '일치)' : '주 ' + num(due) + (l ? ' · ' + l.left + '회' : '')) + '</span>' +
      '<button class="chip go r" data-do="tab" data-arg="bank" title="은행 — 신용등급 · 마이너스 통장 · 미리 갚기 · 이번 일요일 정산">은행</button></div>';
  }
  const pct1 = v => (Math.round(v * 1000) / 10) + '%'; // 0.022 → 2.2%
  function condChip() { // 컨디션: 쌩쌩(일당 +) · 지침(일당 −). 보통일 때는 없음
    const c = R.condOf(S);
    if (c === 'good') return '<span class="cond good" title="쌩쌩 — 체력이 ' + Math.round(tune.cond_good * 100) + '% 이상이면 알바 일당 +' + Math.round(tune.cond_good_pay * 100) + '%">쌩쌩 +' + Math.round(tune.cond_good_pay * 100) + '%</span>';
    if (c === 'tired') return '<span class="cond tired" title="지침 — 체력이 ' + Math.round(tune.cond_tired * 100) + '% 아래면 알바 일당 −' + Math.round(tune.cond_tired_cut * 100) + '%. 체력이 모자란 채 일하면(무리) 쓰러질 수 있습니다">지침 −' + Math.round(tune.cond_tired_cut * 100) + '%</span>';
    return '';
  }
  function renderMe() {
    const x = R.xpView(S), mx = R.hpMax(S), low = S.hp < 25, perks = R.perksView(S), extra = bizRow() + loanRow(), rows = (extra.match(/class="me-row/g) || []).length;
    // 그림 칸: 줄이 없으면 216px(128×72 를 3배) 전부. 사업 · 대출 줄이 하나 붙을 때마다 34px 낮아지고, 그림은 3배 그대로 가운데를 맞춰 위아래가 잘린다.
    // 보이는 높이와 위치를 3의 배수로 맞춰 맨 윗줄 · 아랫줄 점이 반만 보이지 않게 한다. 줄이 둘이면 49줄(y 11~59)이 보여 그림의 약속(y 12~59)이 다 들어간다.
    const vis = Math.min(72, Math.floor((216 - 34 * rows) / 3)), sh = vis * 3 + 12, sy = -3 * Math.floor((72 - vis) / 2), lease = R.leaseOf(S);
    try { if (window.PxArt && window.PxArt.setWear) window.PxArt.setWear(S.wear, S.look); } catch (e) { /* 옷 색을 못 바꿔도 그림은 뜬다 */ }
    // 알림은 그림 칸 위쪽 가장자리(안쪽 위 +2px)에 한 줄(28px)씩 쌓인다. 주인공 얼굴(그림 상자 위 + 9점: 더듬이 · 머리카락 아래)이 가려지지 않는 만큼만: 둘(+60px까지) 또는 하나
    const sb = window.PxArt && window.PxArt.SCENE_BOX && window.PxArt.SCENE_BOX[S.tier], faceTop = sb ? sy + (sb.hero[1] + 9) * 3 : 216;
    ui.toastCap = faceTop >= 60 ? 2 : 1;
    if ($('toasts').children.length > ui.toastCap) { const o = $('toasts').firstChild; if (o._kind !== 'deny' && o._kind !== 'tip') ui.toastQ.unshift([o._key, o._kind, Math.max(120, o._life), o._day]); o.remove(); } // 칸이 낮아진 순간 넘친 것은 줄로
    $('me').innerHTML =
      '<div class="zh">' + I('door', '지금 사는 곳') + '<span class="place">' + R.HOMES[S.tier].name + '</span>' + (lease ? '<span class="lease" title="계약: ' + R.LEASE[lease] + (S.deposit ? ' — 보증금 ' + won(S.deposit) + ' (나갈 때 돌려받음)' : '') + '">' + R.LEASE[lease] + '</span>' : '') +
      '<span class="who chip hot" title="' + esc(S.name + ' · 칭호 ' + S.title) + '">' + esc(S.title) + '</span>' + // 칭호만 (이름까지 붙이면 잘림)
      '<span class="r lvb" title="레벨 ' + x.lv + ' — 경험치 ' + x.xp + ' / ' + x.need + '. 오르면 특성을 하나 고릅니다">' + I('star', '', 's') + 'Lv.' + x.lv + '<i class="xpbar"><i style="width:' + (x.xp / x.need * 100).toFixed(0) + '%"></i></i></span></div>' +
      '<div class="scene" style="height:' + sh + 'px;--sy:' + sy + 'px">' + art('scene', S.tier, PHASE[Math.min(3, S.slot)]) + '</div>' +
      '<div class="me-row hp' + (low ? ' low' : '') + '" title="체력 — 알바 · 공부에 쓰고, 쉬거나 자면 돌아옵니다">' + I('hp') + '<div class="bar"><div style="width:' + (S.hp / mx * 100).toFixed(0) + '%"></div></div><b>' + Math.round(S.hp) + ' / ' + mx + '</b>' + condChip() + '</div>' + extra +
      '<div class="perks' + (perks.length > 10 ? ' many' : '') + '"><span class="pl" title="레벨이 오를 때 고른 특성">특성</span><span class="pks">' + (perks.length ? perks.map(p => '<span class="pk' + (p.n > 1 ? ' x' + p.n : '') + (p.aug ? ' aug' : '') + '" data-do="tip" data-arg="' + perkTip(p) + '" title="' + perkTip(p) + '">' + art('icon', p.icon) + '</span>').join('')
        : '<span class="none" title="레벨이 오르면 특성이 여기에 쌓입니다">' + I('star', '', 's') + I('plus', '', 's') + '</span>') + '</span>' +
      '</div>'; // 로드맵 · 은행 · 가게는 오른쪽 아래 판의 탭에 있다
    fitPerks($('me').querySelector('.pks'), perks);
  }
  const perkTip = p => esc(p.name + (p.n > 1 ? ' ×' + p.n : '') + (p.aug ? ' (양날)' : '') + ' — ' + p.desc + (p.aug ? '. 대신: ' + p.con : '') + (p.excl ? '. ' + p.excl : ''));
  function fitPerks(box, perks) { // 특성 아이콘이 칸을 넘으면 뒤에서부터 접고 "+n" (누르면 접힌 것의 이름)
    if (!box || !perks.length || box.scrollWidth <= box.clientWidth) return;
    const pk = [...box.querySelectorAll('.pk')], more = document.createElement('span');
    more.className = 'more'; more.dataset.do = 'tip'; box.appendChild(more);
    let n = 0;
    while (n < pk.length - 1 && (n === 0 || box.scrollWidth > box.clientWidth)) {
      pk[pk.length - 1 - n].style.display = 'none'; n++;
      const hid = perks.slice(perks.length - n).map(p => p.name + (p.n > 1 ? ' ×' + p.n : '')).join(' · ');
      more.textContent = '+' + n; more.title = '특성 ' + n + '개 더: ' + hid; more.dataset.arg = '특성 더: ' + hid;
    }
  }

  // ── 구역 quest: 상태창 (지금 퀘스트 하나 · 시스템의 한마디 · 다가오는 것) ──
  function progText(q) { return q.unit === '원' ? won(q.cur) + ' / ' + won(q.goal) : q.cur + ' / ' + q.goal; }
  function questGo(q) { // 퀘스트 그 자리에서 누르는 버튼: 옮기기 · 집 계약 · 주식/코인 탭
    if (!q || !q.go) return '';
    if (q.go === 'move') {
      const to = S.tier + 1, info = R.moveInfo(S, to), alt = to === 3 ? R.moveInfo(S, 3, 'jeonse') : null;
      if (to > 3) return '';
      const label = I('door', '', 's') + R.HOMES[to].name + '으로 옮기기';
      return info.ok || (alt && alt.ok) ? '<button class="chip hot go" data-do="move" data-arg="' + to + '" title="' + R.HOMES[to].name + '으로 옮깁니다">' + label + '</button>'
        : '<button class="chip off" data-do="why" data-arg="' + esc(info.why) + '" title="' + esc(info.why) + '">' + label + '</button>';
    }
    if (q.go === 'house') { // 다음 집 사기 (살 수 있을 때만)
      const to = S.tier + 1;
      return to >= 4 && to <= 8 && R.goalView(S).canBuy ? '<button class="chip hot go warmgo" data-do="house" title="' + R.HOMES[to].name + ' — ' + (to === 4 ? '현금으로만' : '전세 · 대출을 고르는 창') + '">' + I('key', '', 's') + R.HOMES[to].name + (to === 4 ? ' 사기' : ' 들어가기') + '</button>' : '';
    }
    if (q.go === 'biz') { // 사업 키우기
      const n = R.bizView(S).next;
      if (!n) return '';
      return n.ok ? '<button class="chip hot go" data-do="bizup" title="' + n.name + ' 차리기 — ' + won(n.cost) + '">' + I('rocket', '', 's') + n.name + ' 차리기</button>'
        : '<button class="chip off" data-do="why" data-arg="' + esc(n.why) + '" title="' + esc(n.why) + '">' + I('rocket', '', 's') + n.name + ' 차리기</button>';
    }
    if (q.go === 'jeonse') { // 원룸 월세 → 전세
      if (S.tier !== 3 || R.leaseOf(S) !== 'rent') return '';
      const info = R.moveInfo(S, 3, 'jeonse'), label = I('key', '', 's') + '전세로 갈아타기';
      return info.ok ? '<button class="chip hot go" data-do="lease" data-arg="jeonse" title="원룸을 전세로 바꿉니다 — 보증금 ' + won(info.need) + '">' + label + '</button>' : '<button class="chip off" data-do="why" data-arg="' + esc(info.why) + '" title="' + esc(info.why) + '">' + label + '</button>';
    }
    if (q.go === 'shop' || q.go === 'bank' || q.go === 'realty') return q.go !== ui.tab && (q.go === 'shop' || R.unlocked(S, q.go)) ? '<button class="chip hot go" data-do="tab" data-arg="' + q.go + '">' + I(TAB_IC[q.go], '', 's') + TAB_NAME[q.go] + '</button>' : '';
    if (q.go === 'top') return R.goalView(S).canBuy && R.goalView(S).kind === 'top' ? '<button class="chip hot go warmgo" data-do="top" title="한국 최고 부자 선언 — 이 판의 끝">' + I('crown', '', 's') + '최고 부자 선언</button>' : '';
    if (q.go !== ui.tab && R.unlocked(S, q.go)) return '<button class="chip hot go" data-do="tab" data-arg="' + q.go + '">' + I(q.go === 'coin' ? 'bolt' : 'chart', '', 's') + (q.go === 'coin' ? '코인' : '주식') + '</button>';
    return '';
  }
  function renderQuest() {
    const q = R.questView(S), say = ui.say || S.log[S.log.length - 1]; // 시스템의 마지막 한마디 (잠깐 밝다가 흐려짐)
    const go = questGo(q), notes = R.notices(S), dr = R.dreamView(S);
    const news = R.unlocked(S, 'stock') ? R.todayNews(S).filter(n => n.asset !== 'coin' || R.unlocked(S, 'coin')).length : 0;
    $('quest').innerHTML =
      '<div class="zh">' + I('quest') + '<span>상태창</span>' + (q || news ? '<span class="r">' + (news ? '<span class="nw" title="오늘 소식 ' + news + '건 — 오른쪽 주식 탭의 소식 칸">' + I('news', '', 's') + news + '건</span>' : '') + (q ? '퀘스트 ' + q.n + ' / ' + q.of : '') + '</span>' : '') + '</div>' + // 오늘 소식 수는 머리줄에 (아래 알림 줄이 한 줄로 들게)
      (q ? '<div class="q-in"><div class="q-title">' + esc(q.title) + '</div><div class="q-desc" title="' + esc(q.desc) + '">' + esc(q.desc) + '</div>' + // 줄 수는 fitQuest 가 (네 줄까지, 넘치면 … · 전부는 title)
        '<div class="q-prog"><div class="bar"><div style="width:' + (q.pct * 100).toFixed(1) + '%"></div></div><b>' + progText(q) + '</b></div>' +
        '<div class="q-row"><span class="rw" title="끝내면 받는 것: ' + esc(q.reward) + '">' + I('gift', '', 's') + '<span>' + esc(q.reward) + '</span></span>' + (q.near ? '<span class="near">거의 다 됨</span>' : '') + go + '</div></div>' : '<div class="q-in"><div class="q-title">모든 퀘스트 완료</div></div>') + // 보상이 길면 버튼이 다음 줄로 (보상 글은 자르지 않음)
      (say ? '<div class="q-say ' + (say.tone || '') + (ui.sayT > 400 ? ' in' : ui.sayT === 0 ? ' old' : '') + '" title="' + esc(say.text) + '">' + esc(say.text) + '</div>' : '') + // 앞에 "[시스템] " 이 붙는다. 줄 수는 fitQuest 가
      '<div class="q-due">' + // 알림 줄: 고정비(+ 원리금)는 전날(차분하게)과 당일(눈에 띄게)에만
      notes.map(n => '<span class="note plain ' + n.kind + ' ' + n.when + '" title="정산(고정비 · 원리금 · 이자)은 일요일 밤에 현금에서 나갑니다. 모자라면 마이너스 통장에서 자동으로 빌리고, 그래도 안 되면 연체 — 두 번 연속이면 한 단계 아래로">' + I('bill', '', 's') + esc(n.text) + '</span>').join('') +
      (dr.set ? '<span class="note plain dream" title="꿈: ' + esc(dr.name + ' — ' + dr.line + '. 장면 ' + dr.done + ' / ' + dr.of + (dr.on ? ' · 얻은 힘: ' + dr.gain : ' · 둘째 장면에서 얻는 힘: ' + dr.gain)) + '">' + I('star', '', 's') + '꿈 · ' + esc(dr.name) + ' ' + dr.done + '/' + dr.of + '</span>' : '') +
      '</div>';
    fitQuest();
  }
  function fitQuest() { // 상태창은 위에서부터 쌓고 알림 줄이 맨 아래. 자리가 있으면 설명 · 시스템 한마디를 다 보인다(줄 수 제한 없음).
    // 넘칠 때만: 시스템 한마디를 한 줄씩 → 설명을 한 줄씩 줄이고(줄인 글은 … · 전부는 title), 둘 다 한 줄인데도 넘치면 시스템 한마디를 숨긴다(맨 아래 고정비 알림이 잘리지 않게)
    const box = $('quest'), d = box.querySelector('.q-desc'), s = box.querySelector('.q-say');
    const set = (el, n) => { if (el) { el.style.webkitLineClamp = String(n); el.style.maxHeight = (n * 20 + (el === s ? 12 : 0)) + 'px'; } };
    const need = el => { if (!el) return 0; set(el, 99); return Math.max(1, Math.round((el.offsetHeight - (el === s ? 12 : 0)) / 20)); };
    const over = () => box.scrollHeight > box.clientHeight + 0.5;
    let dn = need(d), sn = need(s);
    set(d, dn); set(s, sn);
    while (over() && (sn > 1 || dn > 1)) { if (sn > 1) sn--; else dn--; set(d, dn); set(s, sn); }
    if (over() && s) s.style.display = 'none';
  }

  // ── 구역 today: 지금 칸에서 고를 것 ──
  function renderToday() {
    const head = '<div class="zh" title="지금 칸 — 하루는 오전 · 오후 · 저녁 세 칸입니다">' + I(S.slot < 3 ? SLOT_IC[S.slot] : 'zzz') + '<span>오늘 · ' + (S.slot < 3 ? SLOTS[S.slot] : '밤') + '</span><span class="pips" title="하루 세 칸 중 남은 칸">' + [0, 1, 2].map(i => '<i class="' + (i >= S.slot ? 'on' : '') + '"></i>').join('') + '</span>' +
      '<span class="r">' + (S.slot < 3 ? '<span>남은 칸 ' + (3 - S.slot) + ' · 하나를 고르세요</span>' : '<span>다 썼으면 하루 마치기</span>') + (S.buff && S.buff.nextJob ? '<span class="chip hot" title="대타: 다음 알바 일당 ×' + S.buff.nextJob + '">' + I('swap', '', 's') + '×' + S.buff.nextJob + '</span>' : '') + '</span></div>';
    if (S.slot >= 3) {
      const b = R.bill(S), due = b && b.inDays === 0;
      $('today').innerHTML = head + '<div class="cards"><button class="card wide go" data-do="endday"><span class="pic">' + art('act', 'rest') + '</span><span><span class="big">하루 마치기</span>' +
        (due ? '<b class="gold">' + I('bill', '', 's') + ' 오늘 밤 ' + (b.loan ? '고정비 · 원리금 ' : '고정비 ') + won(b.amt) + (b.days < 7 ? ' (' + b.days + '일치)' : '') + (S.cash < b.amt ? ' — 현금이 모자랍니다' : '') + '</b>' : '<span class="dim">' + ((coachNow() || {}).id === 'endday' ? '밤 정산 뒤 다음 날로 넘어갑니다' : '자기 전에 매매 · 이사를 할 수 있습니다') + '</span>') + '</span><span class="key">Space</span></button></div>';
      return;
    }
    const first = (coachNow() || {}).id === 'job'; // 안내가 첫 알바를 짚는 동안은 "대충"을 감춘다 (미니게임을 한 번은 해 보게)
    const can = a => (a.kind === 'job' ? a.any || a.push : a.ok); // 알바는 어느 강도로든 할 수 있으면 켜짐 — 체력이 모자라도 조금이라도 있으면 "무리"로 (대충은 중의 체력이 있을 때만)
    const list = R.acts(S), q = R.questView(S) || {}, jobs = list.filter(a => a.kind === 'job' && a.any);
    const want = q.id === 'first_job' ? 'flyer' : q.id === 'study' ? 'study' : '';
    const rec = want && list.some(a => a.id === want && can(a)) ? want : !jobs.length && list.some(a => a.kind === 'rest' && a.ok) ? 'rest' : ''; // 상태창 추천: 퀘스트가 바로 가리키는 카드(할 수 있을 때), 아니면 일할 체력이 없을 때 쉬기 (그 밖에는 없음)
    const tag = a => (a.id === rec && can(a) ? '<span class="tag chip hot" title="지금 퀘스트(또는 체력)로 보아 상태창이 권하는 것">' + I('quest', '', 's') + '<span class="tl">상태창 </span>추천</span>' : '');
    const autoLine = a => (a.auto ? '<span class="auto" title="' + (a.kind === 'rest' ? '쉬어도' : '공부해도') + ' 사업 매출 ' + won(a.auto) + '이 들어옵니다 (직원이 일함)"><i>' + (a.kind === 'rest' ? '쉬어도' : '공부해도') + '</i><b>+' + num(a.auto) + '</b></span>' : '');
    const jl = a => a.levels[a.any || a.push ? a.use : 1], short = list.some(a => a.kind === 'job' && num(jl(a).pay).length > 11), jw = n => (short ? cwon(n) : num(n)); // 알바 카드의 금액: 하나라도 줄이면 다 줄임 (한 줄에서 "721,913,000"과 "13억"이 섞이지 않게, 전부는 title)
    $('today').innerHTML = head + '<div class="cards' + (list.length >= 5 ? ' n5' : '') + '">' + list.map((a, i) => {
      const go = can(a);
      const k = '<span class="key">' + (i + 1) + '</span>', off = go ? 'data-do="' + a.kind + '"' + (a.kind === 'job' ? ' data-arg="' + a.id + '"' : '') + ' role="button"' : 'data-do="why" data-arg="' + esc(a.why) + '"';
      if (a.kind === 'job') {
        const lv = '<span class="lv" title="숙련도: 직접 한 횟수가 ' + tune.skill_n1 + ' · ' + tune.skill_n2 + ' · ' + tune.skill_n3 + '번이 되면 일당이 ' + Math.round(tune.skill_bonus * 100) + '%씩 오릅니다">' + [1, 2, 3].map(n => '<s class="' + (a.lv >= n ? 'on' : '') + '"></s>').join('') + '</span>';
        const L = jl(a); // 기억한 강도(체력이 모자라면 할 수 있는 가장 높은 것)의 일당 · 체력
        const pt = jw(L.pay), long = pt.length > 8 ? ' long' : '', sk = Math.round(a.pay * R.skipMult(S) / 1000) * 1000; // 사업이 커져 일당이 길면 일당 · 체력을 두 줄로. sk = "대충"이 받는 돈 (늘 중 기준)
        const risk = a.push ? Math.round(L.risk * 100) : 0; // 무리: 어느 강도도 체력이 모자람 — 하더라도 쓰러질 수 있다
        return '<div class="card ' + (go ? 'go' : 'off') + long + (a.push ? ' push' : '') + (a.closed ? ' closed' : '') + (a.id === rec && go ? ' sug' : '') + '" ' + off + ' title="' + esc(a.name + ' — ' + (a.closed ? '오늘은 이 알바를 마쳤습니다 (같은 알바는 하루 한 번)' : a.note + (a.bizMult > 1 ? ' (사업 ×' + num(a.bizMult) + ')' : '') + (a.push ? ' · 체력이 모자랍니다 — 무리하면 쓰러질 확률 ' + risk + '%' : go ? ' · 강도 ' + L.name : ''))) + '">' + k + (go && !a.push && L.n !== 1 ? ich(L.n) : '') + (a.push ? '<em class="ich i3" title="체력이 모자란 채 일합니다 — 끝나고 쓰러질 확률 ' + risk + '%">무리</em>' : '') + lv + tag(a) + '<span class="pic">' + pic('job', a.id, !go) + '</span><span class="nm">' + a.name + '</span>' + // 강도 딱지는 하 · 상 · 최상만 (중은 기본이라 안 닮), 숫자 키 옆

          '<span class="st"><span class="pay" title="일당(보통) ' + won(L.pay) + (a.bizMult > 1 ? ' — 사업 ×' + num(a.bizMult) + ' 포함' : '') + '">' + I('coin', '', 's') + pt + '</span>' + (a.closed ? '<span class="lack" title="같은 알바는 하루 한 번">' + I('check', '', 's') + '오늘 마감</span>' : '<span class="' + (go && !a.push ? 'cost' : 'lack') + '" title="드는 체력' + (go && !a.push ? '' : ' — 모자랍니다') + '">' + I('hp', '', 's') + '−' + L.hp + '</span>') + '</span>' +
          (a.ok && !first ? '<button class="skip" data-do="skip" data-arg="' + a.id + '" title="대충: 미니게임 없이 중 강도 일당의 ' + Math.round(R.skipMult(S) * 100) + '% (' + won(sk) + ') · 체력 −' + a.hp + ' · 숙련도와 콤보는 오르지 않음">대충 ' + (num(sk).length > 9 ? cwon(sk) : jw(sk)) + '</button>' : '') + '</div>';
      }
      const st = a.kind === 'rest' ? (a.ok ? '<span class="gain">' + I('hp', '', 's') + '+' + (-a.hp) + '</span>' : '<span class="lack">' + I('lock', '', 's') + esc(a.why.split(':')[0]) + '</span>') // 일중독(양날): 할 수 있는 알바가 있으면 못 쉼
        : a.ok ? '<span class="' + (a.hp > S.hp ? 'lack' : 'cost') + '" title="드는 체력">' + I('hp', '', 's') + '−' + a.hp + '</span><span class="sys" title="고른 종목의 내일 소식">' + I('news', '', 's') + '내일</span>' : '<span class="lack">' + I('check', '', 's') + (/읽었/.test(a.why) ? '읽음' : '체력') + '</span>';
      return '<div class="card ' + (a.ok ? 'go' : 'off') + (a.auto ? ' auto' : '') + (a.id === rec && a.ok ? ' sug' : '') + '" ' + off + ' title="' + (a.kind === 'rest' ? '쉬기 — 체력을 채웁니다' : '공부 — 체력 ' + a.hp + '과 한 칸을 써서, 고른 종목' + (a.picks > 1 ? ' 둘' : ' 하나') + '의 내일 소식이 오르는 쪽인지 내리는 쪽인지 리포트를 봅니다 (' + Math.round(R.studyAcc(S) * 100) + '% 맞음). 공부가 쌓이면 단계가 오릅니다') + '">' + k + tag(a) + '<span class="pic">' + pic('act', a.id, !a.ok) + '</span><span class="nm">' + a.name + '</span>' +
        '<span class="st">' + st + '</span>' + autoLine(a) + '</div>';
    }).join('') + '</div>';
  }

  const grayCache = {};
  function pic(kind, id, off) { // 카드 그림. 잠긴 카드는 팔레트 안의 회색판(pxart.js 의 GRAY 표로 다시 그림 — 반투명으로 흐리지 않음). 픽셀 그림이 없으면 보통 그림
    if (!off) return art(kind, id);
    const key = kind + ':' + id;
    if (grayCache[key] == null) {
      grayCache[key] = '';
      try {
        const P = window.PxArt, draw = P && P.GRAY && (kind === 'job' ? P.JOB : P.ACT)[id];
        if (draw) { const [c, g] = P.mk(32, 32); P.setMap(P.GRAY); try { draw(g); } finally { P.setMap(null); } grayCache[key] = '<img class="px" alt="잠김" src="' + c.toDataURL() + '" width="32" height="32">'; }
      } catch (e) { grayCache[key] = ''; }
    }
    return grayCache[key] || '<span class="old-off">' + art(kind, id) + '</span>'; // 회색판을 못 만들면(pxart.js 가 안 불림) 예전처럼 흐리게 — 잠긴 카드가 열린 카드와 똑같아 보이지 않게
  }

  // ── 구역 board: 투자가 열리기 전에는 로드맵, 열린 뒤에는 주식 / 코인 ──
  const TABS = ['road', 'stock', 'coin', 'info', 'realty', 'bank', 'shop'];
  const TAB_NAME = { road: '로드맵', stock: '주식', coin: '코인', info: '뉴스·공부', realty: '부동산', bank: '은행', shop: '가게' };
  const TAB_IC = { road: 'map', stock: 'chart', coin: 'bolt', info: 'news', realty: 'building', bank: 'bank', shop: 'cart' };
  const TAB_TIP = { road: '로드맵 — 서울역에서 한국 최고 부자까지 열 단계', stock: '주식 — 장 보기 · 내 보유 · 종목 상세', coin: '코인 레버리지', info: '뉴스·공부 — 오늘 소식 · 내일 리포트 · 투자 공부 단계',
    realty: '부동산 — 시세 · 상가와 건물 (임대수익)', bank: '은행 — 신용등급 · 마이너스 통장 · 이번 일요일 정산', shop: '가게 — 사 먹기 · 옷 · 살림' };
  const tabsOpen = () => TABS.filter(t => t === 'road' || t === 'shop' || R.unlocked(S, t === 'info' ? 'stock' : t)); // 아직 못 쓰는 탭은 아예 안 보인다
  function renderBoard() {
    const tabs = tabsOpen();
    if (ui.tut && S.day >= 2 && S.tier === 0) ui.tab = 'road'; // 첫 판 안내가 로드맵의 "옮기기"를 짚는 동안
    if (tabs.indexOf(ui.tab) < 0) ui.tab = 'road';
    const t = ui.tab;
    const extra = t === 'coin' ? '<button class="chip go drillbtn" data-do="drill" title="코인 연습 — 진짜 돈이 아닌 ' + won(DRILL_PUT) + '으로 롱 · 숏 · 청산을 직접 눌러 봅니다 (판에는 영향 없음)">' + I('play', '', 's') + '연습</button>'
      : t === 'road' ? '<button class="chip go drillbtn" data-do="roadmap" title="로드맵을 큰 창으로 — 열 단계의 값 · 고정비 · 열리는 것을 전부">' + I('map', '', 's') + '크게 보기</button>' : '';
    $('board').innerHTML = '<div class="zh tabs">' + tabs.map(k => '<button class="' + (t === k ? 'on' : ui.fresh[k] ? 'new' : '') + '" data-do="tab" data-arg="' + k + '" title="' + TAB_TIP[k] + '">' + I(TAB_IC[k], '', 's') + TAB_NAME[k] + '</button>').join('') +
      (extra ? '<span class="r">' + extra + '</span>' : '') + '</div><div class="pbody tb-' + t + '">' +
      (t === 'road' ? roadmapHtml() : t === 'stock' ? stockHtml() : t === 'coin' ? coinHtml() : t === 'info' ? infoHtml() : t === 'realty' ? realtyHtml() : t === 'bank' ? bankHtml() : shopHtml()) + '</div>';
    if (t === 'road') roadDraw($('board'));
    else if (t === 'coin') drawChart($('chart'), 'coin');
    else if (t === 'stock' && ui.sview === 'detail') drawChart($('chart'), ui.sel);
    else if (t === 'realty') drawRe($('rechart'));
    ui.flash = {}; ui.coachDirty = true;
  }
  function roadDraw(el) { try { if (window.PXUI) window.PXUI.road(el.querySelector('.ladder.ten')); } catch (e) { /* 길 그림이 없어도 칸은 읽힌다 */ } }
  function roadmapHtml(full) { // 열 단계(다섯씩 두 줄): 지금 위치 · 열리는 것 · 값(또는 입주 기준) · 주 고정비, 다음 단계에 옮기기 · 사기 · 선언 (판 자리와 로드맵 창이 같이 씀)
    // 판 자리(full 아님)에서는 지금 · 다음만 다 보이고, 지나온 곳은 이름만, 먼 곳은 값 한 줄만 흐리게. 로드맵 창은 전부
    const row = (ic, title, html, c) => '<div class="rr' + (c ? ' ' + c : '') + '" title="' + title + '">' + I(ic, '', 's') + '<span>' + html + '</span></div>';
    const sleep = t => row('bed', '자면 돌아오는 체력', '잠 +' + tune[R.HOMES[t].sleep]);
    const dep = (n, name) => row('wallet', (name || '보증금') + ' ' + won(n) + ' — 나갈 때 돌려받는 돈입니다 (순자산에 그대로 남음)', (name ? name + ' ' : '') + num(n), 'need'); // 보증금: 걸어 두는 돈 (돌려받는다는 말은 설명과 창 머리글에)
    const week = t => row('bill', '고정비: 매주 일요일 밤' + (t >= 5 ? ' (대출이 있으면 원리금도 함께)' : t === 4 ? ' (관리비 · 세금)' : t === 3 ? ' — 월세 ' + won(R.weekCost(S, 3, 'rent')) + ' · 전세 ' + won(R.weekCost(S, 3, 'jeonse')) + ' (끼니 포함)' : ' (끼니 포함)'), '주 ' + num(R.weekCost(S, t, t === S.tier ? '' : 'rent')));
    const cv = R.creditView(S), jt = t => (R.HOMES[t].lease.indexOf('jeonse') >= 0 ? ' 전세 보증금은 값의 ' + Math.round(tune.jeonse_ratio * 100) + '%.' : '');
    const price = t => row('key', t === 4 ? '값 — 현금으로만 삽니다 (부동산 시세를 따라 움직입니다)' : '값 — 부동산 시세를 따라 움직입니다. 대출은 신용등급에 따라(지금 ' + cv.grade + '등급 = 값의 ' + Math.round(cv.ltv * 100) + '%까지).' + jt(t) + ' 살던 집은 그때 시세에 팔려 보태집니다', num(R.homePrice(S, t)), 'need');
    const rows = t => t === 0 ? [row('meal', '끼니: 하루 ' + won(R.mealCost(S)), '끼니 ' + num(R.mealCost(S))), sleep(0)]
      : t === 1 ? [row('cash', '하룻밤 요금 (밤마다)', '하룻밤 ' + num(R.saunaCost(S))), sleep(1)]
        : t === 2 ? [dep(tune.gosiwon_dep, '예치금'), week(2)] : t === 3 ? [dep(tune.oneroom_dep, '보증금'), week(3)].concat(full ? [row('wallet', '전세로 들어가면: 보증금 ' + won(tune.oneroom_jeonse) + ' (나갈 때 돌려받음) · 일요일 밤마다 ' + won(R.weekCost(S, 3, 'jeonse')), '전세 ' + cwon(tune.oneroom_jeonse) + '·주 ' + cwon(R.weekCost(S, 3, 'jeonse')))] : [])
          : t <= 8 ? [price(t), week(t)]
            : [row('crown', '호텔에 살면서 순자산이 이만큼 되면 선언합니다', num(tune.top_worth), 'need'), row('wallet', '값이 아니라 순자산 기준 (현금 + 투자 + 집 − 대출)', '순자산 기준')];
    const open = (svg, title, big) => '<span' + (big ? ' class="big"' : '') + ' title="' + title + '">' + svg + '</span>'; // big = 알바 · 종목 그림(32×32)은 제 크기로
    const chip = (ic, text, title) => '<span class="oc" title="' + title + '">' + I(ic, '', 's') + '<b>' + text + '</b></span>'; // 판 자리에서는 아이콘만 (이름은 title)
    const opens = t => t === 0 ? open(art('job', 'flyer'), '전단지 알바', 1) + open(art('job', 'loading'), '상하차 알바', 1)
      : t === 1 ? open(art('job', 'store'), '편의점 알바', 1) + open(art('icon', 'chart'), '주식 계좌') + open(art('icon', 'book'), '공부(리포트)')
        : t === 2 ? open(art('job', 'delivery'), '배달 알바', 1) + open(art('icon', 'bank'), '은행 (신용 · 마이너스 통장)')
          : t === 3 ? open(art('asset', 'coin'), '코인', 1) + open(art('icon', 'building'), '부동산 (상가)')
            : t <= 8 ? chip('rocket', R.BIZ[t - 3].name, '사업 ' + (t - 3) + '단계 ' + R.BIZ[t - 3].name + ' — 일당 ×' + num(Math.pow(tune.biz_mult, t - 3))) + (t === 5 ? chip('bill', '대출', '주담대: 신용등급에 따라 값의 ' + Math.round(tune.ltv_6 * 100) + '~' + Math.round(tune.ltv_1 * 100) + '%까지 · ' + tune.loan_weeks + '회에 나눠 갚음') : '')
              : chip('trophy', '엔딩', '한국 최고 부자 선언 — 이 판의 끝');
    const bar = p => '<div class="bar"><div style="width:' + (clamp(p, 0, 1) * 100).toFixed(1) + '%"></div></div>';
    const why = (ic, amt, title) => '<div class="why" title="' + esc(title) + '">' + I(ic, '', 's') + num(amt) + ' 더</div>';
    return '<div class="ladder ten' + (full ? ' full' : '') + '">' + R.HOMES.map((h, t) => {
      const next = t === S.tier + 1, past = t < S.tier, here = t === S.tier;
      let foot;
      if (here) foot = full ? '<div class="why sys">' + I('check', '', 's') + '지금 사는 곳' + (R.leaseOf(S) ? ' · ' + R.LEASE[R.leaseOf(S)] : '') + '</div>' : ''; // 그림 칸에는 내 모습이 서 있다
      else if (past) foot = full ? '<div class="why">' + I('check', '', 's') + '지나옴</div>' : '';
      else if (next && t <= 3) {
        const info = R.moveInfo(S, t), alt = t === 3 ? R.moveInfo(S, 3, 'jeonse') : null, lack = Math.max(0, info.need - info.have);
        foot = info.ok || (alt && alt.ok) ? '<button class="btn main" data-do="move" data-arg="' + t + '">' + I('door') + '옮기기</button>'
          : (t >= 2 ? bar(info.have / info.need) : '') + why('cash', lack, (t === 1 ? '현금 ' : '보증금에 ') + won(lack) + ' 더 — ' + info.why);
      } else if (next && t <= 8) {
        const info = R.homeInfo(S, t), g = R.goalView(S);
        foot = g.canBuy ? '<button class="btn warm" data-do="house" title="' + h.name + ' — ' + (t === 4 ? '현금으로만' : '전세 · 대출을 고르는 창') + '">' + I('key') + (t === 4 ? '사기' : '들어가기') + '</button>'
          : bar(g.need ? S.cash / g.need : 1) + why('cash', g.need - S.cash, (t === 4 ? '현금으로만 삽니다. ' : '전세로 들어가거나 대출을 최대로 끼면 ') + '현금 ' + won(g.need) + '이 있어야 합니다 — ' + info.why);
      } else if (next) {
        const g = R.goalView(S);
        foot = g.canBuy ? '<button class="btn warm" data-do="top">' + I('crown') + '선언</button>' : bar(g.pct) + why('wallet', g.price - g.have, '순자산이 ' + won(g.price - g.have) + ' 더 있어야 선언합니다');
      } else foot = ''; // 아직 먼 단계: 자물쇠는 그림 칸 모서리에 (칸 아래에 따로 두면 아랫줄 것처럼 보임)
      const all = rows(t), show = full || here || (next && t < 9) ? all : past ? null : all.slice(0, 1);
      const cond = next && t >= 5 && t <= 8 && (full || R.goalView(S).canBuy) ? row('cash', '들어가는 조건: 전세로 가거나 대출을 최대로 끼면 지금 현금 ' + won(R.goalView(S).need) + ' (살던 집을 판 돈 · 돌려받는 보증금 포함)', (full ? '현금 ' : '') + num(R.goalView(S).need) + '부터', 'need') : ''; // 다음 집에 들어가는 조건
      const big = t >= 4 ? (t === 9 ? tune.top_worth : R.homePrice(S, t)) : 0; // 1억이 넘는 값은 그림 위에 "100억" 길잡이 (자리를 더 쓰지 않게)
      const flag = here ? '<span class="mehere" title="지금 여기 — ' + esc(S.name) + ' 님이 사는 곳">' + art('hero') + '</span>' : next ? '<span class="flag chip hot" title="다음 목표">다음 목표</span>' : ''; // 지금 사는 칸에는 글자 대신 내 모습이 서 있다 (입은 옷 그대로)
      const far = !(here || past || next);
      return '<div class="rung ' + (here ? 'here' : past ? 'past' : next ? 'next' : 'far') + '" style="--gr:' + (t < 5 ? 1 : 2) + ';--gc:' + (t < 5 ? t + 1 : 10 - t) + '"><div class="th">' + flag + art('thumb', t, far) + (far ? '<span class="lk" title="앞 단계부터 — 아직 잠김">' + art('icon', 'lock') + '</span>' : '') + (big >= 1e8 && !here ? '<span class="eok" title="' + won(big) + '">' + eok(big) + '</span>' : '') + '</div>' + // 윗줄 1→5, 아랫줄은 오른쪽부터 6→10 (S자 길). 아직 먼 단계는 회색 그림 + 모서리 자물쇠
        (show ? '<div class="opens">' + opens(t) + '</div>' : '') + '<div class="in"><div class="nm">' + h.name + '</div>' +
        (show ? '<div class="rows">' + (cond ? [all[0], cond] : show).join('') + '</div>' : '') + '<div class="foot">' + foot + '</div></div></div>';
    }).join('') + '</div>';
  }
  function todayChg(id) { const h = S.market.hist[id], open = h[h.length - 1 - Math.min(3, S.slot)]; return S.slot === 0 ? null : S.market.px[id] / open - 1; }
  const pxText = id => Math.round(S.market.px[id]).toLocaleString('en-US') + '원';
  const REL = { official: 3, article: 2, rumor: 1 };
  const newsLine = n => { // 소식 한 줄: 출처(믿을 만한 정도) · 호재/악재 · 머리글 · 밤사이 이미 들어간 만큼 · 리포트가 본 방향
    const gap = (S.market.gap || {})[n.asset];
    return '<div class="nitem"><span class="src ' + n.src + '" title="' + n.srcName + ' — ' + n.srcNote + '">' + n.srcName + '<span class="rel">' + [1, 2, 3].map(k => '<i class="' + (REL[n.src] >= k ? 'on' : '') + '"></i>').join('') + '</span></span>' + arrow(n.dir, n.dir > 0 ? '호재' : '악재') +
      '<span class="tx" title="' + esc(n.head) + '">' + esc(n.head) + '</span>' + (gap ? '<span class="gp ' + cls(gap) + '" title="밤사이 장 전에 이미 값에 들어간 만큼">밤사이 ' + pct(gap, 0) + '</span>' : '') +
      (n.report ? '<span class="rep ' + cls(n.report) + '" title="' + (BY[n.by] || '리포트') + ': 이 소식은 진짜로는 ' + (n.report > 0 ? '오르는' : '내리는') + ' 쪽">' + (BY[n.by] || '리포트') + I(n.report > 0 ? 'up' : 'down', '', 's') + '</span>' : '') + '</div>';
  };
  const visNews = () => R.todayNews(S).filter(n => n.asset !== 'coin' || R.unlocked(S, 'coin'));
  function infoHtml() { // 뉴스·공부: 왼쪽 = 오늘 소식, 오른쪽 = 투자 공부(단계 · 다음에 열리는 것) + 내일 리포트
    const today = visNews(), intel = R.intelView(S), k = R.knowView(S), coin = R.unlocked(S, 'coin'), act = R.acts(S).find(a => a.kind === 'study');
    const nm = id => R.ASSETS.find(a => a.id === id).name;
    const alerts = k.lv >= 5 ? S.market.shocks.filter(x => x.day === S.day && x.slot >= S.slot && R.visible(S, x.asset)) : []; // 속보 경보: 아직 안 터진 오늘의 속보 (종목만, 방향은 모름)
    const left = '<h4 title="오늘 소식 — 점이 많을수록 믿을 만합니다 (공시 · 기사 · 찌라시). 오늘 소식은 아침 장 전에 믿을 만한 만큼 이미 값에 들어갔습니다">' + I('news', '', 's') + '오늘 소식<span class="pre">아침 값에 이미 들어감 — 보고 사면 늦음</span></h4>' +
      (today.length ? today.map(newsLine).join('') : '<div class="nitem dim">조용함</div>') +
      alerts.map(x => '<div class="nitem alert" title="공부 5단계: 오늘 이 종목에 예고 없는 큰 소식이 터질 수 있습니다 (오를지 내릴지는 모릅니다)">' + I('warn', '', 's') + '<span class="tx">속보 경보 — ' + esc(nm(x.asset)) + '</span></div>').join('');
    let rep;
    if (intel && intel.assets.length) { // 공부한 종목만: 소식이 있으면 리포트가 본 방향, 없으면 조용함, 한탕바이오 · 꿀잼게임즈는 기울기
      rep = intel.assets.filter(id => id !== 'coin' || coin).map(id => {
        if (id === 'hantang') return '<div class="nitem ht" title="한탕바이오 — 리포트를 읽은 때 기준. 매집 알림은 진짜 · 가짜에 똑같이 뜹니다"><span class="em">' + art('asset', 'hantang') + '</span><span class="tx ' + (intel.ht && intel.ht.stale ? 'dim' : 'warm') + '">' + esc(R.htText(intel.ht) || '조용합니다') + '</span></div>';
        if (id === 'game') return '<div class="nitem ht" title="꿀잼게임즈 — 신작을 발표한 뒤에만 흥행 쪽 · 혹평 쪽 기울기가 보입니다"><span class="em">' + art('asset', 'game') + '</span><span class="tx ' + (intel.gm && intel.gm.stale ? 'dim' : 'warm') + '">' + esc(R.gmText(intel.gm) || '신작 소식이 없습니다') + '</span></div>';
        const its = intel.items.filter(i => i.asset === id);
        return its.length ? its.map(i => '<div class="nitem"><span class="em">' + art('asset', i.asset) + '</span><span class="tx">' + i.name + '</span>' + arrow(i.dir) + '<span class="' + cls(i.dir) + '">' + (i.dir > 0 ? '오르는' : '내리는') + ' 쪽</span></div>').join('')
          : '<div class="nitem"><span class="em">' + art('asset', id) + '</span><span class="tx">' + nm(id) + '</span><span class="dim">소식 없음</span></div>';
      }).join('');
    } else rep = '<div class="nitem dim">' + I('lock', '', 's') + '오늘 공부하면 여기에 뜹니다</div>';
    const pcA = Math.round(k.acc * 100), bar = k.next ? (k.xp - k.from) / (k.next - k.from) : 1;
    const steps = k.list.map(x => '<span class="ks' + (x.got ? ' got' : '') + (x.lv === k.lv ? ' now' : '') + '" title="' + x.lv + '단계 ' + x.name + ' (공부 ' + x.at + '번) — ' + x.gain + '">' + x.lv + '</span>').join('');
    const go = act && act.ok ? '<button class="btn main small studygo" data-do="study" title="한 칸과 체력 ' + act.hp + '을 써서 공부합니다 — 리포트 ' + k.picks + '종목 + 공부 횟수 1">' + I('book', '', 's') + '공부하기 <i>' + I('hp', '', 's') + '−' + act.hp + '</i></button>'
      : '<span class="dim studyno">' + (act ? (/읽었/.test(act.why) ? '오늘은 이미 공부했습니다' : S.slot >= 3 ? '오늘 칸을 다 썼습니다' : '체력이 모자랍니다') : '') + '</span>';
    const right = '<div class="know" title="투자 공부 — 공부한 횟수가 쌓여 단계가 오릅니다. 지금 ' + k.lv + '단계 ' + k.name + ' (공부 ' + k.xp + '번)"><div class="kh">' + I('book') + '<b>투자 공부</b><em>' + k.lv + '단계 · ' + k.name + '</em><span class="steps">' + steps + '</span></div>' +
      '<div class="kbar"><div class="bar"><div style="width:' + (clamp(bar, 0, 1) * 100).toFixed(0) + '%"></div></div><b>' + (k.next ? k.xp + ' / ' + k.next + '번' : '다 배움') + '</b></div>' +
      '<div class="kl"><span title="리포트가 맞을 확률">리포트 <b>' + pcA + '%</b> 맞음</span><span title="한 번 공부에 읽는 종목 수">한 번에 <b>' + k.picks + '종목</b></span></div>' +
      (k.next ? '<div class="kn" title="다음 단계에서 열리는 것">' + I('gift', '', 's') + '<span>' + (k.lv + 1) + '단계 ' + k.nextName + ': ' + esc(k.nextGain) + '</span></div>' : '') + '</div>' +
      '<h4 title="공부한 종목의 내일 소식이 오르는 쪽인지 내리는 쪽인지 (리포트 · ' + pcA + '% 맞음). 시세는 소식 말고도 출렁입니다. 맞았는지는 밤 정산에서 알려 줍니다">' + I('eye', '', 's') + '내일 리포트' + go + '</h4>' + rep;
    return '<div class="info2"><div class="icol news">' + left + '</div><div class="icol study">' + right + '</div></div>';
  }

  const augWhy = id => { const p = R.perk(S, id) && R.perksView(S).find(x => x.id === id); return p ? p.name + ' — 대신 ' + p.con : ''; }; // 양날 특성 때문에 못 하는 것: 버튼을 잠그고 누르면 이 이유
  const lockBtn = (why, cls2, html, title) => '<button class="' + cls2 + ' lock" data-do="why" data-arg="' + esc(why) + '" title="' + esc(why) + '">' + html + '</button>';
  const unitsText = n => (Math.abs(n - Math.round(n)) < 1e-6 ? num(Math.round(n)) : (Math.floor(n * 100) / 100).toFixed(2)) + '주';
  const feeRate = () => tune.fee * (R.perk(S, 'stockonly') ? 0 : R.perk(S, 'vip') ? 0.5 : 1);
  // ── 주식 탭: 장 보기(종목 목록) · 내 보유 · 종목 상세(차트 + 수량으로 주문) ──
  function stockHtml() {
    const hv = R.holdings(S), tot = hv.total;
    if (ui.sview === 'detail' && !hv.rows.some(r => r.id === ui.sel)) ui.sview = 'market';
    if (ui.sview === 'detail') return detailHtml(hv);
    const sv = ui.sview, mineN = hv.rows.filter(r => r.units > 0).length + (hv.lev ? 1 : 0);
    const head = '<div class="svtabs"><button class="' + (sv === 'market' ? 'on' : '') + '" data-do="sview" data-arg="market" title="장 보기 — 살 수 있는 종목과 오늘 시세. 종목을 누르면 차트와 주문">' + I('chart', '', 's') + '장 보기</button>' +
      '<button class="' + (sv === 'mine' ? 'on' : '') + '" data-do="sview" data-arg="mine" title="내 보유 — 가진 종목의 수량 · 평가액 · 손익">' + I('wallet', '', 's') + '내 보유' + (mineN ? '<i>' + mineN + '</i>' : '') + '</button>' +
      '<span class="hsum" title="내가 든 것 전부 — 지금 값과 산 값 대비 손익">' + (tot.cost ? '<i>보유 합계</i><b>' + won(tot.value) + '</b><span class="' + cls(tot.pnl) + '">' + sign(tot.pnl) + ' (' + pct(tot.pct) + ')</span>' : '<span class="dim">가진 것 없음 — 종목을 눌러 삽니다</span>') + '</span></div>';
    return head + (sv === 'mine' ? mineHtml(hv) : '<div class="mlist">' + hv.rows.map(marketRow).join('') + '</div>');
  }
  function marketRow(x) { // 장 보기의 한 칸: 종목 · 값 / 오늘 소식 · 내가 가진 만큼 · 오늘 움직임
    const d = todayChg(x.id), f = ui.flash[x.id], n = R.todayNews(S).find(q => q.asset === x.id);
    const badge = x.id === 'hantang' && R.htAlert(S) ? '<i class="vol" title="오늘 거래량 알림 — 누군가 사 모으는 중 (진짜면 급등, 아니면 폭락)">' + I('up', '', 's') + '거래량</i>'
      : x.id === 'game' && R.gmAlert(S) ? '<i class="vol" title="신작 출시를 앞두고 있습니다 — 흥행이면 급등, 혹평이면 급락">' + I('warn', '', 's') + '신작</i>' : '<i>' + x.tag + '</i>';
    return '<button class="arow' + (x.units > 0 ? ' mine' : '') + (f > 0 ? ' flash-up' : f < 0 ? ' flash-down' : '') + '" data-do="sel" data-arg="' + x.id + '" title="' + esc(x.name + ' — ' + x.hint + ' (누르면 차트와 주문)') + '"><span class="em">' + art('asset', x.id) + '</span><span class="bd">' +
      '<span class="l1"><span class="nm">' + x.name + badge + '</span><span class="px">' + pxText(x.id) + '</span></span>' +
      '<span class="l2"><span class="mine' + (x.units > 0 ? '' : ' dim') + '">' + (n ? '<span class="' + cls(n.dir) + '" title="오늘 소식: ' + esc(n.head) + ' (' + n.srcName + ')">' + I('news', '', 's') + '</span>' : '') +
      (x.units > 0 ? '<span title="내가 가진 수량 · 산 값 대비 손익 ' + sign(x.pnl) + '">내 것 ' + unitsText(x.units) + ' <em class="' + cls(x.pnl) + '">' + pct(x.pct) + '</em></span>' : '<span title="이 종목은 가진 것이 없습니다">내 것 없음</span>') + '</span>' +
      '<span class="chg ' + (d == null ? 'dim' : cls(d)) + '" title="오늘 시세 움직임 (내 손익 아님)">' + (d == null ? '' : '오늘 ' + pct(d)) + '</span></span></span></button>';
  }
  function mineHtml(hv) { // 내 보유: 가진 종목만. 칸마다 수량 · 평가액 / 산 값 · 손익
    const rows = hv.rows.filter(r => r.units > 0), lv = hv.lev;
    if (!rows.length && !lv) return '<div class="empty">' + I('wallet', '', 'l') + '<span>아직 가진 것이 없습니다.<br><b>장 보기</b>에서 종목을 누르면 차트와 주문이 뜹니다.</span></div>';
    const sw = n => (n < 0 ? '−' : '+') + (Math.abs(n) >= 1e8 ? eok(Math.abs(n)) : num(Math.abs(n))); // 손익: 1억이 넘으면 줄임 (전부는 title)
    const cell = (id, name, tag, l1, l2, tip, pnl, pc, act) => '<button class="arow mine" ' + act + ' title="' + esc(name) + ' — 누르면 차트와 주문"><span class="em">' + art('asset', id) + '</span><span class="bd">' +
      '<span class="l1"><span class="nm">' + name + '<i>' + tag + '</i></span><span class="px" title="지금 값(평가액)">' + l1 + '</span></span>' +
      '<span class="l2"><span class="mine dim" title="' + tip + '">' + l2 + '</span><span class="chg ' + cls(pnl) + '" title="손익 (산 값 대비) ' + sign(pnl) + '">' + sw(pnl) + ' (' + pct(pc) + ')</span></span></span></button>';
    return '<div class="mlist own">' + rows.map(x => cell(x.id, x.name, x.tag, won(x.value), unitsText(x.units) + ' · 산 값 ' + shortWon(x.cost), '수량 · 산 값 ' + won(x.cost), x.pnl, x.pct, 'data-do="sel" data-arg="' + x.id + '"')).join('') +
      (lv ? cell('coin', '달나라코인', (lv.dir > 0 ? '롱' : '숏') + ' ' + lv.lev + '배', won(lv.value), '건 돈 ' + shortWon(lv.put), '건 돈(증거금) ' + won(lv.put), lv.pnl, lv.pct, 'data-do="tab" data-arg="coin"') : '') + '</div>';
  }

  function detailHtml(hv) { // 종목 상세: 차트 · 오늘 소식 · 내 보유 · 수량을 골라 사고판다
    const x = hv.rows.find(r => r.id === ui.sel), a = R.ASSETS.find(q => q.id === x.id), c = todayChg(x.id), h = S.hold[x.id], fr = feeRate(), px = S.market.px[x.id];
    ui.qty = clamp(Math.floor(ui.qty) || 1, 1, Math.max(1, x.max, Math.floor(h.units)));
    const q = ui.qty, qt = R.quote(S, x.id, q), cost = qt.buy, sq = Math.min(q, h.units), get = qt.sell, no = augWhy('coinonly'); // 버튼의 금액 = 규칙이 실제로 오가게 하는 돈 (같은 식)
    const ns = R.todayNews(S).filter(n => n.asset === x.id);
    const note = ns.length ? ns.map(newsLine).join('') : '<div class="nitem dim">' + I('info', '', 's') + '<span class="tx">' + esc(a.hint) + (x.id === 'bank' ? ' (지난 정산 뒤로 내내 든 만큼의 ' + pct1(tune.bk_div) + ')' : '') + '</span></div>';
    const alert = x.id === 'hantang' && R.htAlert(S) ? '<i class="vol">' + I('up', '', 's') + '거래량</i>' : x.id === 'game' && R.gmAlert(S) ? '<i class="vol">' + I('warn', '', 's') + '신작 출시 대기</i>' : '';
    const st = (arg, t, tip, dis) => '<button data-do="qty" data-arg="' + arg + '"' + (dis ? ' disabled' : '') + ' title="' + tip + '">' + t + '</button>';
    return '<div class="dt"><div class="thead"><button class="chip go back" data-do="sview" data-arg="market" title="종목 목록으로">' + I('up', '', 's') + '목록</button><span class="em">' + art('asset', x.id) + '</span><b>' + x.name + '</b><i class="tg">' + x.tag + '</i>' + alert +
      '<span class="p">' + pxText(x.id) + '</span><span class="' + (c == null ? 'dim' : cls(c)) + '" title="오늘 움직임">' + (c == null ? '' : pct(c)) + '</span>' +
      '<span class="h" title="사고팔 때 수수료">' + I('percent', '', 's') + '수수료 ' + (fr * 100).toFixed(2).replace(/0$/, '') + '%</span></div>' +
      '<div class="chart"><canvas id="chart" width="1560" height="232"></canvas></div><div class="dnews">' + note + '</div>' +
      '<div class="mine-line">' + (h.units > 0 ? '<span title="가진 수량">' + I('wallet', '', 's') + '<b>' + unitsText(h.units) + '</b></span><span title="지금 값">' + won(x.value) + '</span><span class="dim" title="산 값">' + I('cart', '', 's') + won(x.cost) + '</span><span class="' + cls(x.pnl) + '" title="평가 손익">' + sign(x.pnl) + ' (' + pct(x.pct) + ')</span>' : '<span class="dim">가진 것 없음 · 현금 ' + won(S.cash) + ' — 최대 ' + num(x.max) + '주</span>') + '</div>' +
      '<div class="order2"><span class="olab" title="몇 주를 사고팔지">수량</span><div class="seg qty">' + st('-10', '−10', '10주 줄이기', q <= 1) + st('-1', '−1', '1주 줄이기', q <= 1) +
      '<input id="qty" class="qin" inputmode="numeric" maxlength="7" autocomplete="off" value="' + q + '" title="주 수를 직접 적습니다" aria-label="주 수">' + st('+1', '+1', '1주 늘리기') + st('+10', '+10', '10주 늘리기') + '</div>' +
      '<div class="seg pre">' + st('q25', '25%', '살 수 있는 만큼의 25% — ' + num(Math.floor(x.max / 4)) + '주', x.max < 4) + st('q50', '50%', '살 수 있는 만큼의 절반 — ' + num(Math.floor(x.max / 2)) + '주', x.max < 2) + st('max', '최대', '현금으로 살 수 있는 만큼 — ' + num(x.max) + '주', x.max < 1) + st('all', '보유', '가진 만큼 — ' + unitsText(h.units), h.units <= 0) + '</div>' +
      (no ? lockBtn(no, 'btn up ob', I('lock') + '사기') : '<button class="btn up ob" data-do="buyq"' + (cost > S.cash ? ' disabled' : '') + ' title="' + num(q) + '주 사기 — ' + won(cost) + ' (수수료 포함)' + (cost > S.cash ? ' · 현금이 모자랍니다' : '') + '"><b>사기</b><i id="buyamt">' + num(cost) + '</i></button>') +
      '<button class="btn down ob" data-do="sellq"' + (h.units > 0 ? '' : ' disabled') + ' title="' + (h.units > 0 ? unitsText(sq) + ' 팔기 — ' + won(get) + ' (수수료 뺌)' : '가진 것이 없습니다') + '"><b>팔기</b><i id="sellamt">' + (h.units > 0 ? num(get) : '—') + '</i></button></div></div>';
  }
  function qtyTyped(el, done) { // 수량 칸에 직접 적는 동안: 다시 그리지 않고 금액만 바꾼다 (글자 넣는 자리가 날아가지 않게). done = 칸에서 손을 뗌 — 살 수 있는 · 가진 만큼 안으로 맞춰 적는다
    const h = S.hold[ui.sel], px = S.market.px[ui.sel], fr = feeRate(), n = Math.floor(Number(String(el.value).replace(/[^0-9]/g, ''))) || 0;
    ui.qty = Math.max(1, n);
    if (done) { ui.qty = clamp(ui.qty, 1, Math.max(1, R.maxUnits(S, ui.sel), Math.floor(h.units))); el.value = ui.qty; for (const q of document.querySelectorAll('#board [data-do="qty"]')) if (q.dataset.arg === '-1' || q.dataset.arg === '-10') q.disabled = ui.qty <= 1; }
    const b = $('buyamt'), s = $('sellamt'), qt = R.quote(S, ui.sel, ui.qty), cost = qt.buy;
    if (b) { b.textContent = num(cost); b.parentNode.disabled = cost > S.cash; }
    if (s && h.units > 0) s.textContent = num(qt.sell);
  }
  // ── 코인 탭: 왼쪽 = 주문 칸(또는 내 포지션), 오른쪽 = 차트와 버튼. 정리 버튼은 롱 · 숏과 다른 자리에 둔다 ──
  function coinHtml() {
    const a = R.ASSETS.find(x => x.id === 'coin'), c = todayChg('coin'), l = S.lev, fund = n => (n * tune.lev_fund * 100).toFixed(1) + '%';
    let left, main;
    if (l) {
      const v = R.levValue(S), p = v - l.put, side = l.dir > 0 ? '<b class="up">롱</b>' : '<b class="down">숏</b>';
      left = '<div class="levform"><div class="pos"><span title="' + (l.dir > 0 ? '롱: 오르면 이익' : '숏: 내리면 이익') + '">' + I(l.dir > 0 ? 'up' : 'down') + side + ' ' + l.lev + '배</span><span title="건 돈(증거금)"><i>건 돈</i>' + won(l.put) + '</span>' +
        '<span title="지금 정리하면 돌려받는 돈" class="' + cls(p) + '"><i>지금</i>' + won(v) + '</span><span title="청산가: 시세가 여기에 닿으면 증거금을 전부 잃습니다" class="bad"><i>청산</i>' + Math.round(R.levLiq(l)).toLocaleString('en-US') + '원</span>' +
        '<span title="유지비: 들고 있으면 칸마다 증거금에서 나갑니다" class="dim"><i>유지비</i>칸마다 −' + fund(l.lev) + '</span></div></div>';
      main = '<div class="mine-line"><span>' + side + ' ' + l.lev + '배</span><span class="' + cls(p) + '"><b>' + sign(p) + '</b> (' + pct(p / l.put) + ')</span></div>' +
        '<div class="order" style="justify-content:flex-end"><button class="btn warm" data-do="close" title="포지션을 정리해 현금으로 돌려받습니다">' + I('check') + '정리</button></div>';
    } else {
      const m = Math.floor(S.cash * ui.share), dis = m < 100000 ? ' disabled' : '';
      const beast = augWhy('beast'), minLev = beast ? tune.beast_min_lev : 1;
      if (ui.lev < minLev) ui.lev = [1, 2, 3, 5].find(n => n >= minLev) || 5; // 야수의 심장: 낮은 배율은 잠김
      left = '<div class="levform"><div class="row" title="배율: 맞히면 움직임의 몇 배를 벌고, 틀리면 그만큼 잃습니다">' + I('bolt') + '<div class="seg pick">' + [1, 2, 3, 5].map(n => n < minLev ? lockBtn(beast, '', I('lock', '', 's') + n + '배') : '<button class="' + (ui.lev === n ? 'on' : '') + '" data-do="lev" data-arg="' + n + '">' + n + '배</button>').join('') + '</div></div>' +
        '<div class="row" title="증거금: 현금에서 얼마를 걸지">' + I('cash') + '<div class="seg pick">' + [0.25, 0.5, 1].map(n => '<button class="' + (ui.share === n ? 'on' : '') + '" data-do="share" data-arg="' + n + '">' + Math.round(n * 100) + '%</button>').join('') + '</div></div>' +
        '<div class="note" title="유지비: 들고 있으면 칸마다 증거금에서 나갑니다. 포지션은 한 번에 하나">' + I('bill', '', 's') + '유지비 칸마다 −' + fund(ui.lev) + '</div></div>';
      main = '<div class="mine-line"><span title="걸 돈">' + I('cash', '', 's') + '<b>' + won(m) + '</b> ×' + ui.lev + '</span><span class="bad" title="반대로 ' + Math.round(100 / ui.lev) + '% 움직이면 증거금을 전부 잃습니다 (청산)">' + I('skull', '', 's') + '−' + Math.round(100 / ui.lev) + '%</span>' + (m < 100000 ? '<span class="dim">' + won(100000) + '부터</span>' : '') + '</div>' +
        (augWhy('stockonly') ? '<div class="order">' + lockBtn(augWhy('stockonly'), 'btn up', I('lock') + '롱') + lockBtn(augWhy('stockonly'), 'btn down', I('lock') + '숏') + '</div>' // 주식 외길: 코인을 못 함
          : '<div class="order"><button class="btn up" data-do="long"' + dis + ' title="롱: 오른다에 건다">' + I('up') + '롱</button><button class="btn down" data-do="short"' + dis + ' title="숏: 내린다에 건다">' + I('down') + '숏</button></div>');
    }
    const ns = R.todayNews(S).filter(n => n.asset === 'coin');
    return '<div class="trade coin"><div class="alist">' + left + '<div class="dnews">' + (ns.length ? ns.map(newsLine).join('') : '<div class="nitem dim">' + I('news', '', 's') + '<span class="tx">오늘 코인 소식 없음</span></div>') + '</div></div><div class="tmain">' +
      '<div class="thead"><span class="em">' + art('asset', 'coin') + '</span><b>' + a.name + '</b><span class="p">' + pxText('coin') + '</span><span class="' + (c == null ? 'dim' : cls(c)) + '" title="오늘 움직임">' + (c == null ? '' : pct(c)) + '</span>' +
      '<span class="h" title="포지션을 열 때 수수료: 증거금 × 배율 × ' + (tune.lev_fee * 100).toFixed(1) + '%">' + I('percent', '', 's') + '수수료 ' + (tune.lev_fee * 100).toFixed(2).replace(/0$/, '') + '% × 배율</span></div>' +
      '<div class="chart"><canvas id="chart" width="1092" height="232"></canvas></div>' + main + '</div></div>';
  }
  // ── 부동산 탭: 시세 · 내 집 · 상가와 건물 (사 두면 일요일 밤마다 임대수익) ──
  function realtyHtml() {
    const v = R.propView(S), up = v.idx - 1, home = R.HOMES[S.tier], lease = v.lease;
    const fc = v.forecast ? '<span class="chip ' + (v.forecast.dir > 0 ? 'hot' : '') + '" title="공부 4단계: 다음 일요일에 시세가 어느 쪽으로 움직일지 (' + Math.round(v.forecast.acc * 100) + '% 맞음)">' + I('eye', '', 's') + '다음 주 ' + (v.forecast.dir > 0 ? '오르는' : '내리는') + ' 쪽</span>'
      : '<span class="dim" title="투자 공부 4단계부터 다음 주 전망이 보입니다">' + I('lock', '', 's') + '전망은 공부 4단계부터</span>';
    const mine = lease === 'own' ? '내 ' + home.name + ' 시세 <b>' + won(v.home) + '</b>' : lease ? home.name + ' ' + R.LEASE[lease] + ' · 보증금 <b>' + won(v.deposit) + '</b>' : '집 없음';
    const row = r => {
      const st = r.have ? (r.vacant ? '<span class="bad" title="세입자가 나갔습니다 — ' + r.vacant + '주 동안 임대수익 없음">' + I('warn', '', 's') + '공실 ' + r.vacant + '주</span>' : '<span class="good" title="세 든 가게가 있습니다 — 일요일 밤마다 임대수익">' + I('check', '', 's') + '임대 중</span>') + '<span class="' + cls(r.pnl) + '" title="산 값 ' + won(r.paid) + ' 대비 지금 시세 ' + sign(r.pnl) + '">' + (r.pnl >= 0 ? '+' : '') + cwon(r.pnl) + '</span>' : '';
      const btn = r.have ? '<button class="btn small" data-do="propsell" data-arg="' + r.id + '" title="' + r.name + ' 팔기 — 중개비 · 세금을 떼고 ' + won(r.sellNet) + '">팔기</button>'
        : r.ok ? '<button class="btn main small" data-do="propbuy" data-arg="' + r.id + '" title="' + r.name + ' 사기 — ' + won(r.buy) + ' + 취득세 · 중개비 ' + won(r.tax) + '">사기</button>'
          : '<button class="btn small lock" data-do="why" data-arg="' + esc(r.why) + '" title="' + esc(r.why) + '">' + I('lock', '', 's') + (r.open ? '사기' : R.HOMES[r.tier].name + '부터') + '</button>';
      return '<div class="prow' + (r.have ? ' have' : r.open ? '' : ' far') + '" title="' + esc(r.name + ' — ' + r.note) + '"><span class="em">' + art('prop', r.id, !r.open && !r.have) + '</span><span class="nm"><b>' + r.name + '</b><i>' + esc(r.note) + '</i></span>' +
        '<span class="pp" title="지금 시세' + (r.have ? '' : ' (살 때는 취득세 · 중개비 ' + won(r.tax) + ' 더)') + '">' + num(r.price) + '</span><span class="pr" title="일요일 밤마다 들어오는 임대수익 ' + won(r.rent) + ' (비면 0)">' + I('coin', '', 's') + '주 +' + shortWon(r.rent) + '</span><span class="ps">' + st + '</span>' + btn + '</div>';
    };
    return '<div class="retop"><div class="rechart" title="부동산 시세 — 일요일 밤마다 움직입니다. 집값 · 가진 집 · 상가 · 뚝딱건설이 따라갑니다"><canvas id="rechart" width="240" height="72"></canvas></div>' +
      '<div class="reinfo"><div><span class="lab">' + I('building', '', 's') + '부동산 시세</span><b class="' + cls(up) + '">' + pct(up) + '</b><span class="dim">처음 대비</span>' + (v.hist.length > 1 ? '<span class="' + cls(v.last) + '" title="지난 일요일에 움직인 만큼">지난주 ' + pct(v.last) + '</span>' : '') + fc + '</div>' +
      '<div><span class="lab">' + I('door', '', 's') + mine + '</span><span class="lab">' + I('coin', '', 's') + '임대수익 주 <b class="gold">+' + num(v.rent) + '</b></span><span class="dim" title="상가 값은 순자산에 그대로 들어갑니다">가진 건물 ' + won(v.value) + '</span></div></div></div>' +
      '<div class="plist">' + v.rows.map(row).join('') + '</div>';
  }
  function drawRe(cv) { // 부동산 시세의 작은 차트 (처음 = 1)
    if (!cv) return;
    fitCanvas(cv);
    const c = cv.getContext('2d'), Wc = cv.width, Hc = cv.height, h = (S.re && S.re.hist ? S.re.hist : [1]).slice(-24), pts = h.length > 1 ? h : [h[0], h[0]];
    c.clearRect(0, 0, Wc, Hc);
    let lo = Math.min.apply(null, pts.concat([1])), hi = Math.max.apply(null, pts.concat([1])); const pad = (hi - lo) * 0.2 || 0.02; lo -= pad; hi += pad;
    const X = i => 8 + (Wc - 24) * i / (pts.length - 1), Y = v => Hc - 8 - (Hc - 16) * (v - lo) / (hi - lo), up = pts[pts.length - 1] >= 1;
    pxDash(c, Y(1), 8, Wc - 8, PX.E);
    pxLine(c, pts.map((v, i) => [X(i), Y(v)]), Hc, up ? PX.r : PX.b, up ? PX.R : PX.B, true);
  }
  // ── 은행 탭: 신용등급 · 마이너스 통장 · 이번 일요일 정산 (주담대 미리 갚기) ──
  function bankHtml() {
    const v = R.creditView(S), b = v.bill, l = R.loanView(S), g = v.grade, bar = g > 1 ? clamp((v.score - (g >= 7 ? 300 : v.next - 100)) / 100, 0, 1) : 1;
    ui.bamt = clamp(ui.bamt, 0, Math.max(v.room, v.balance, 0));
    const line = (name, amt, c, tip) => '<div class="bl' + (c ? ' ' + c : '') + '"' + (tip ? ' title="' + tip + '"' : '') + '><span>' + name + '</span><b>' + amt + '</b></div>';
    const credit = '<div class="bcol"><h4>' + I('shield', '', 's') + '신용</h4><div class="grade g' + g + '" title="신용점수 ' + v.score + '점 — 900 · 800 · 700 · 600 · 500 · 400점이 1 ~ 6등급의 문턱, 그 아래(7등급)는 대출이 안 나옵니다"><b>' + g + '</b><i>등급</i><span>' + v.score + '점</span></div>' +
      '<div class="kbar" title="' + (g > 1 ? '다음 등급(' + (g - 1) + '등급)까지 ' + v.toNext + '점' : '가장 높은 등급입니다') + '"><div class="bar"><div style="width:' + (bar * 100).toFixed(0) + '%"></div></div><b>' + (g > 1 ? (g - 1) + '등급까지 ' + v.toNext + '점' : '최고 등급') + '</b></div>' +
      line('정산을 제때 내면', '+' + tune.credit_ontime, 'good', '일요일 밤 정산(고정비 · 원리금 · 이자)을 제때 낼 때마다') + line('못 내면', '−' + tune.credit_late, 'bad', '연체 한 번에. 쫓겨나거나 압류되면 −' + tune.credit_evict) +
      line('주담대', g >= 7 ? '안 나옴' : '값의 ' + Math.round(v.ltv * 100) + '% · 주 ' + pct1(v.mort), '', '아파트부터. 빌릴 수 있는 몫과 이자는 빌릴 때의 등급으로 정해집니다') + '</div>';
    const step = (arg, t, tip, dis) => '<button data-do="bamt" data-arg="' + arg + '"' + (dis ? ' disabled' : '') + ' title="' + tip + '">' + t + '</button>';
    const cl = '<div class="bcol"><h4>' + I('bank', '', 's') + '마이너스 통장</h4>' + line('한도', won(v.limit), '', '사는 곳이 올라갈수록, 등급이 좋을수록 커집니다') + line('쓴 돈', won(v.balance), v.balance ? 'bad' : '') + line('한 주 이자', pct1(v.rate) + (v.balance ? ' = ' + num(v.week) : ''), '', '이자만 일요일 밤마다 나가고, 원금은 아무 때나 갚습니다. 정산 때 현금이 모자라면 남은 한도에서 자동으로 빌려 냅니다') +
      (v.limit || v.balance ? '<div class="seg qty bq">' + step('-1', '−', '줄이기', ui.bamt <= 0) + '<span class="bamt" id="bamt" title="빌리거나 갚을 금액">' + num(ui.bamt) + '</span>' + step('1', '+', '늘리기') + '</div><div class="seg bq2">' + step('half', '한도 절반', '남은 한도의 절반', v.room <= 0) + step('room', '한도까지', '남은 한도 ' + won(v.room) + ' 전부', v.room <= 0) + step('bal', '빚 전부', '갚을 수 있는 만큼 (빚 ' + won(v.balance) + ')', v.balance <= 0) + '</div>' +
        '<div class="brow"><button class="btn warm small" data-do="borrow"' + (ui.bamt > 0 && ui.bamt <= v.room ? '' : ' disabled') + ' title="' + won(ui.bamt) + ' 빌리기 — 현금이 늘고 빚이 생깁니다 (순자산은 그대로)">빌리기</button><button class="btn main small" data-do="repaycl"' + (v.balance > 0 && S.cash > 0 ? '' : ' disabled') + ' title="' + (ui.bamt ? won(Math.min(ui.bamt, v.balance)) : '전부') + ' 갚기">갚기</button></div>'
        : '<div class="bl dim"><span>' + (g >= 7 ? '6등급(400점)부터 쓸 수 있습니다' : '고시원부터 쓸 수 있습니다') + '</span></div>') + '</div>';
    const due = b ? '<div class="bcol"><h4>' + I('calendar', '', 's') + '이번 일요일 정산' + (b.inDays ? '<i>' + b.inDays + '일 뒤</i>' : '<i class="bad">오늘 밤</i>') + '</h4>' +
      (b.week ? line('고정비' + (b.days < 7 ? ' (' + b.days + '일치)' : ''), '−' + num(b.week)) : '') + (b.loan ? line('주담대 원리금', '−' + num(b.loan), '', '이자 ' + won(b.interest) + ' + 원금 ' + won(b.principal) + (l ? ' · 남은 ' + l.left + '회' : '')) : '') + (b.credit ? line('마이너스 통장 이자', '−' + num(b.credit)) : '') + (b.arrears ? line('밀린 돈', '−' + num(b.arrears), 'bad') : '') +
      (b.rent ? line('임대수익', '+' + num(b.rent), 'good') : '') + (b.div ? line('배당', '+' + num(b.div), 'good') : '') + line('합계', (b.net > 0 ? '−' : '+') + num(Math.abs(b.net)), 'sum ' + (b.net > S.cash ? 'bad' : ''), '나갈 돈에서 들어올 돈을 뺀 것. 지금 현금 ' + won(S.cash)) +
      (l ? '<div class="brow"><span class="dim" title="주담대 잔액">' + '주담대 ' + shortWon(l.balance) + '</span><button class="btn small" data-do="repay" title="주담대 미리 갚기 — 칸을 쓰지 않습니다. 잔액이 줄면 다음 주 이자가 줍니다">미리 갚기</button></div>' : '') + '</div>'
      : '<div class="bcol"><h4>' + I('calendar', '', 's') + '일요일 정산</h4><div class="bl dim"><span>아직 매주 나가는 돈이 없습니다. 고시원부터 일요일 밤마다 고정비가 나갑니다.</span></div></div>';
    return '<div class="bank3">' + credit + cl + due + '</div>';
  }
  // ── 가게 탭: 사 먹기(하루 한 번) · 옷(입은 한 벌만 효과) · 살림 · 사치품 ──
  function shopHtml() {
    const v = R.shopView(S), FIC = { kimbap: 'kimbap', gukbap: 'gukbap', feast: 'feast' }, IIC = { mat: 'bed', ginseng: 'ginseng', chair: 'chair', watch: 'watch', car: 'car' };
    const food = f => '<div class="sitem food' + (f.ok ? '' : ' off') + '" title="' + esc(f.name + ' — 체력 +' + f.hp + (f.why ? ' · ' + f.why : '')) + '"><span class="em">' + I(FIC[f.id], '', 'l') + '</span><span class="nm"><b>' + f.name + '</b><i>' + I('hp', '', 's') + '체력 +' + f.hp + '</i></span>' +
      (f.ok ? '<button class="btn main small" data-do="eat" data-arg="' + f.id + '">' + num(f.cost) + '</button>' : '<button class="btn small lock" data-do="why" data-arg="' + esc(f.why) + '">' + (v.ate ? I('check', '', 's') + '먹음' : num(f.cost)) + '</button>') + '</div>';
    const item = it => {
      const wear = it.cat === 'wear', pic = wear ? art('hero', it.id, v.look) : I(IIC[it.id] || 'gift', '', 'l');
      const btn = it.have ? (wear ? (it.on ? '<span class="chip hot" title="지금 입은 옷">입는 중</span>' : '<button class="btn small" data-do="wear" data-arg="' + it.id + '" title="갈아입기 — 효과는 입은 한 벌만">입기</button>') : '<span class="chip" title="가지고 있습니다">' + I('check', '', 's') + '있음</span>')
        : it.ok ? '<button class="btn warm small" data-do="item" data-arg="' + it.id + '" title="' + it.name + ' 사기 — ' + won(it.cost) + '">' + cwon(it.cost) + '</button>'
          : '<button class="btn small lock" data-do="why" data-arg="' + esc(it.why) + '" title="' + esc(it.why) + '">' + (it.open ? cwon(it.cost) : I('lock', '', 's') + R.HOMES[it.needTier].name) + '</button>';
      return '<div class="sitem ' + it.cat + (it.have ? ' have' : it.open ? '' : ' far') + '" title="' + esc(it.name + ' — ' + it.desc + ' · ' + won(it.cost)) + '"><span class="em' + (wear ? ' hero' : '') + '">' + pic + '</span><span class="nm"><b>' + it.name + '</b><i>' + esc(it.desc) + '</i></span>' + btn + '</div>';
    };
    const base = '<div class="sitem wear have" title="후드티 — 처음부터 입던 옷 (효과 없음)"><span class="em hero">' + art('hero', '', v.look) + '</span><span class="nm"><b>후드티</b><i>처음부터 입던 옷</i></span>' + (v.wear ? '<button class="btn small" data-do="wear" data-arg="">입기</button>' : '<span class="chip hot">입는 중</span>') + '</div>';
    return '<div class="shop">' + v.foods.map(food).join('') + base + v.items.map(item).join('') + '</div>';
  }

  function pxLine(c, pts, Hc, col, dark, noFill) { // 차트 선을 2px 점으로: 점과 점 사이를 계단으로 잇고, 아래는 옅은 색으로 칠함 (그라디언트 · 흐림 없이)
    const u = 4, q = v => Math.round(v / u) * u;
    if (!noFill) { c.fillStyle = PX.C; for (let i = 1; i < pts.length; i++) { const x0 = q(pts[i - 1][0]), x1 = q(pts[i][0]); for (let x = x0; x < x1; x += u) { const y = q(pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * (x - x0) / Math.max(1, x1 - x0)); c.fillRect(x, y, u, Hc - y); } } }
    for (const [k, w] of [[dark, u * 2], [col, u]]) {
      c.fillStyle = k;
      for (let i = 1; i < pts.length; i++) { const [xa, ya] = pts[i - 1], [xb, yb] = pts[i], n = Math.max(1, Math.ceil(Math.max(Math.abs(xb - xa), Math.abs(yb - ya)) / u)); for (let j = 0; j <= n; j++) c.fillRect(q(xa + (xb - xa) * j / n) - w / 2, q(ya + (yb - ya) * j / n) - w / 2, w, w); }
    }
    const [lx, ly] = pts[pts.length - 1]; c.fillStyle = dark; c.fillRect(q(lx) - u * 2, q(ly) - u * 2, u * 4, u * 4); c.fillStyle = col; c.fillRect(q(lx) - u, q(ly) - u, u * 2, u * 2);
  }
  function pxDash(c, y, x0, x1, k) { y = Math.round(y / 4) * 4; c.fillStyle = k; for (let x = x0; x < x1; x += 24) c.fillRect(x, y - 2, 12, 4); } // 점선 (2px 굵기, 2px 칸에 맞춤)
  function fitCanvas(cv) { const w = cv.clientWidth * 2, h = cv.clientHeight * 2; if (w && h && (cv.width !== w || cv.height !== h)) { cv.width = w; cv.height = h; } } // 보이는 크기의 2배로 (글자가 눌리지 않게)
  function drawChart(cv, id) {
    if (!cv) return;
    fitCanvas(cv);
    const c = cv.getContext('2d'), Wc = cv.width, Hc = cv.height, h = S.market.hist[id].slice(-61), n = h.length;
    c.clearRect(0, 0, Wc, Hc);
    const lines = [];
    if (id === 'coin' && S.lev) { lines.push([S.lev.entry, PX.O, '진입']); lines.push([R.levLiq(S.lev), PX.R, '청산']); }
    else if (id !== 'coin' && S.hold[id].units > 0) lines.push([S.hold[id].cost / S.hold[id].units, PX.O, '산 값']);
    let lo = Math.min.apply(null, h), hi = Math.max.apply(null, h);
    for (const l of lines) if (l[0] > lo * 0.7 && l[0] < hi * 1.3) { lo = Math.min(lo, l[0]); hi = Math.max(hi, l[0]); }
    const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
    const X = i => 16 + (Wc - 120) * i / (n - 1), Y = v => Hc - 14 - (Hc - 28) * (v - lo) / (hi - lo);
    const real = S.market.tick - 17, labs = []; // 판이 시작된 뒤의 틱 수
    let lastX = -99;
    for (let i = 0; i < n; i++) { // 하루의 경계선 (날짜 글자는 64px 넘게 떨어진 것만 — 빽빽하면 선 위에 겹쳐서)
      const r = real - (n - 1 - i);
      if (r >= 0 && r % 3 === 0) { const x = Math.round(X(i) / 2) * 2; c.fillStyle = PX.d; c.fillRect(x, 0, 2, Hc); if (x / 2 - lastX >= 64 && X(i) < Wc - 190) { lastX = x / 2; labs.push([x / 2 + 3, 0, '', (r / 3 + 1) + '일', 'day']); } } // 오른쪽 끝은 선 이름(진입 · 청산 · 산 값) 자리
    }
    const up = h[n - 1] >= h[Math.max(0, n - 1 - Math.max(1, Math.min(3, S.slot)))], col = up ? PX.r : PX.b, dark = up ? PX.R : PX.B;
    pxLine(c, h.map((v, i) => [X(i), Y(v)]), Hc, col, dark); // 계단진 선 + 아래 칠 (한 점 = 2px)
    for (const l of lines) {
      const y = clamp(Y(l[0]), 14, Hc - 14);
      pxDash(c, y, 16, Wc - 104, l[1]);
      labs.push([Math.round((Wc - 96) / 2), clamp(Math.round(y / 2) - 8, 0, Hc / 2 - 16), l[1], l[2], 'ln']);
    }
    chartLabels(cv, labs);
  }

  // ── 겹쳐 뜨는 창 ──
  const okBtn = t => '<div class="foot"><button class="btn main" data-do="ok">' + (t || '확인') + ' <span class="key">Space</span></button></div>';
  function evFx(f) { // 사건이 바꾼 것: 현금 · 체력 · 경험치 · 잠
    const out = [];
    if (!f) return '';
    if (f.cash) out.push('<span class="' + (f.cash > 0 ? 'gold' : 'bad') + '">' + I('cash', '', 's') + sign(f.cash) + '</span>');
    if (f.hp) out.push('<span class="' + (f.hp > 0 ? 'good' : 'bad') + '">' + I('hp', '', 's') + (f.hp > 0 ? '+' : '−') + Math.abs(f.hp) + '</span>');
    if (f.hpMax) out.push('<span class="good">' + I('muscle', '', 's') + '최대 체력 +' + f.hpMax + '</span>');
    if (f.xp) out.push('<span class="sys">' + I('star', '', 's') + '경험치 +' + f.xp + '</span>');
    if (f.nights > 0) out.push('<span class="bad">' + I('zzz', '', 's') + (f.nights > 1 ? f.nights + '일 동안 ' : '오늘 ') + '밤 회복 −' + tune.ev_sleep_pen + '</span>');
    return out.length ? '<div class="evfx">' + out.join('') + '</div>' : '';
  }
  function nextBox(q) { return q ? '<div class="nextbox"><i>' + I('quest', '', 's') + '다음 ' + q.n + ' / ' + q.of + '</i><b>' + esc(q.title) + '</b><span>' + esc(q.desc) + '</span></div>' : ''; }
  const ARROW = { ArrowLeft: -90, ArrowRight: 90, ArrowUp: 0, ArrowDown: 180 };
  const keyName = c => (c in ARROW ? '<span class="ic s" style="transform:rotate(' + ARROW[c] + 'deg)">' + art('icon', 'up') + '</span>' : c.replace('Digit', '').replace('Key', '')); // 방향키는 위 화살표 아이콘을 돌려서
  function renderVeil() {
    const v = $('veil'), m = ui.modal;
    ui.coachDirty = true;
    v.classList.toggle('hide', !m); v.classList.toggle('top', !!m && m.type === 'shock'); // 속보는 위쪽 띠
    if (!m) { v.innerHTML = ''; return; }
    if (m.type === 'mg') {
      const g = m.mg || m.demo, L = m.act.levels[m.n];
      if (!v.querySelector('.mg')) { // 틀은 한 번만 (강도를 바꿔도 뜨는 연출이 다시 돌지 않게). 머리줄 · 아래쪽은 그릴 때마다
        v.innerHTML = '<div class="win mg corner"><div class="mg-head"></div><div class="mg-pic"><canvas id="mgc" class="mg-canvas" width="1760" height="760"></canvas><span class="mg-demo" title="스스로 하는 시연 — 시작을 누르면 내 차례">' + I('eye', '', 's') + '자동 시연</span><span class="mg-press chip hide"></span></div><div class="mg-ctl"></div><div id="mgres"></div></div>';
      }
      v.querySelector('.mg-head').innerHTML = '<b>' + esc(g.title || m.act.name) + '</b>' + (m.pre ? '' : ich(m.n, true)) + '<i title="일당(보통) — 잘할수록 ×' + tune.mult_miss + '~' + tune.mult_perfect + ', 강도 ' + L.name + ' ×' + L.payMult + '">' + I('coin', '', 's') + won(L.pay) + (S.combo ? ' · ' + I('fire', '콤보', 's') + S.combo : '') + '</i>';
      v.querySelector('.mg-demo').classList.toggle('hide', !m.pre); if (!m.pre) v.querySelector('.mg-press').classList.add('hide');
      v.querySelector('.mg-ctl').innerHTML = ctlHtml(m); m.lit = ''; // 다시 그리면 눌린 키 딱지가 지워지므로 다음 걸음에 다시 켠다 // 세 줄의 높이가 시작 전 · 하는 중 · 결과에 같아 그림이 움직이지 않는다
      if (m.res) {
        const j = m.res.j, w = m.res.wh;
        const det = m.mg.result && m.mg.result.detail; // 한 줄 내역 (왜 이 등급인지): "배달 4 / 5건 · 충돌 2번"
        const lost = j.grade === 'miss' && j.int >= 2, broke = j.combo === 0 && j.comboWas > 0; // 상 · 최상에서 실수: 체력은 그 강도만큼, 보너스는 없음
        $('mgres').innerHTML = '<div class="mg-res"><div class="g ' + j.grade + '">' + j.gradeName + '</div>' + (det ? '<div class="d">' + esc(det) + '</div>' : '') + '<div class="m">' + I('coin', '', 'l') + '<span id="mgpay">+' + won(rolls.mgpay.v) + '</span></div>' +
          (lost ? '<div class="nb">' + I('warn', '', 's') + '실수 — 강도 보너스 없음</div>' : '') +
          '<div class="s"><span title="일당(중) × 등급 배율 × 강도 배율">' + calcLine(j) + '</span>' + (j.comboMult > 1 ? '<span class="gold" title="콤보 보너스: 잘함 이상이 이어진 만큼 일당에 얹힘">콤보 ' + (broke ? '' : '보너스 ') + '+' + Math.round((j.comboMult - 1) * 100) + '%' + (broke ? ' (이번에 끊김)' : '') + '</span>' : '') + (j.extra > 1 ? '<span class="gold" title="대타">' + I('swap', '', 's') + '×' + j.extra + '</span>' : '') +
          (m.res.tip ? '<span class="gold" title="팁">' + I('gift', '', 's') + '+' + won(m.res.tip.amt) + '</span>' : '') + '<span title="쓴 체력">' + I('hp', '', 's') + '−' + j.hp + '</span>' +
          (j.combo > 0 ? '<span class="gold" title="콤보: 잘함 이상이면 쌓입니다">' + I('fire', '', 's') + '콤보 ' + j.combo + '</span>' : broke && j.comboMult <= 1 ? '<span class="bad" title="콤보가 끊겼습니다">' + I('fire', '', 's') + '콤보 끊김</span>' : '') + '</div>' +
          (w ? '<div class="w ' + cls(w.delta) + '" title="일하는 동안 내 투자가 움직인 만큼">' + I('chart', '', 's') + '일하는 동안 ' + sign(w.delta) + ' (' + pct(w.pct) + ')</div>' : '') + '</div>';
      }
      drawMg();
      return;
    }
    if (m.type === 'den') { // 틀은 한 번만 만들고(뜨는 연출이 판마다 다시 돌지 않게) 속만 바꾼다
      if (!v.querySelector('.win.den')) v.innerHTML = '<div class="frame corner"><div class="win den"><div id="denbody"></div></div></div>';
      renderDen();
      return;
    }
    if (m.type === 'drill') { // 도박장처럼 틀은 한 번만 (차트가 움직이는 동안 창이 다시 뜨지 않게)
      if (!v.querySelector('.win.drill')) v.innerHTML = '<div class="frame corner"><div class="win drill"><div id="drillbody"></div></div></div>';
      renderDrill();
      return;
    }
    if (m.type === 'roadmap') {
      v.innerHTML = '<div class="win book road corner"><h2>' + I('map', '', 's') + '로드맵</h2><h3>서울역에서 한국 최고 부자까지 <span class="dim">지금: ' + R.HOMES[S.tier].name + '</span></h3><p class="road-note">고시원 · 원룸은 보증금을 걸고 들어갑니다(나갈 때 돌려받는 돈). 내 집은 현금으로 사고, 아파트부터는 전세로 들어가거나 대출을 끼고 삽니다. 고정비는 매주 일요일 밤.</p>' +
        roadmapHtml(true) + okBtn('닫기') + '</div>';
      requestAnimationFrame(() => roadDraw(v)); roadDraw(v);
    } else if (m.type === 'intro') {
      const road = [0, 1, 2, 3, 4, 9], dreams = R.dreamList(); // 첫 창의 한 줄: 원룸 · 내 집까지 보이고, 그 뒤는 줄여서 끝(한국 최고 부자)만
      if (!m.dream) m.dream = dreams[0].id;
      const dr = dreams.find(d => d.id === m.dream) || dreams[0];
      v.innerHTML = '<div class="win pop intro corner"><h2>' + I('quest', '', 's') + '시스템</h2><h3>상태창이 열렸습니다</h3><p>' + esc(S.name) + ' 님, 각성을 축하합니다. 현금 0원. 주소 없음. 이 창은 당신에게만 보입니다.</p>' +
        '<div class="rewardbox" title="이 판의 목표 — 기한은 없습니다">' + I('crown') + '<span>목표는 <b class="gold">한국 최고 부자</b>. 먼저 현금 ' + won(R.homePrice(S, 4)) + '으로 내 집부터. 기한은 없다.</span></div>' +
          '<div class="introroad" title="로드맵: 퀘스트를 따라 한 칸씩 올라갑니다. 내 집 뒤로 아파트 · 주택 · 별장 · 호텔이 있습니다">' + road.map((t, i) => (i ? '<span class="arr' + (t === 9 ? ' far' : '') + '">' + I('up', '', 's') + '</span>' : '') + '<span class="st' + (t === 0 ? ' here' : '') + '"><span class="th">' + art('thumb', t) + '</span><i>' + (t === 9 ? '최고 부자' : R.HOMES[t].name) + '</i></span>').join('') + '</div>' +
        '<div class="dl" title="꿈 — 이 판의 이야기입니다. 조건이 되면 장면이 뜨고, 둘째 장면에서 작은 힘을 얻습니다">' + I('star', '', 's') + '꿈을 하나 고른다 <i>판마다 다른 이야기와 작은 힘</i></div><div class="dreams">' + dreams.map((d, i) => '<button class="dcard' + (d.id === m.dream ? ' on' : '') + '" data-do="dream" data-arg="' + d.id + '" title="' + esc(d.line + ' — 둘째 장면에서: ' + d.gain) + '"><span class="key">' + (i + 1) + '</span><b>' + esc(d.name) + '</b></button>').join('') + '</div>' +
        '<p class="dintro">' + esc(dr.intro) + ' <i>' + esc(dr.line) + '.</i></p>' + nextBox(m.next) + okBtn('시작') + '</div>';
    } else if (m.type === 'shock') { // 속보: 머리글 · 종목 · 몇 %. 든 종목이면 내 손익을 크게
      const e = m.e, a = R.ASSETS.find(x => x.id === e.asset), tone = e.held ? cls(e.delta) || 'dim' : 'calm';
      v.innerHTML = '<div class="win shock ' + tone + ' corner"><div class="sh-tag">' + I('news') + '<b>속보</b></div>' +
        '<div class="sh-body"><b class="sh-head">' + esc(e.head) + '</b><span class="sh-asset"><span class="em">' + art('asset', e.asset) + '</span>' + esc(e.name) + ' <b class="' + cls(e.pct) + '">' + pct(e.pct, 0) + '</b><i>예고 없이 터진 소식 — 공부로도 안 보입니다</i></span></div>' +
        (e.held ? '<div class="sh-pl"><i>' + (a && a.kind === 'coin' ? '내 코인 포지션' : '내 ' + esc(e.name)) + '</i><b class="' + cls(e.delta) + '">' + sign(e.delta) + '</b></div>'
          : '<div class="sh-pl calm"><i>내 손익</i><span>든 것 없음</span></div>') + okBtn() + '</div>';
    } else if (m.type === 'quest') {
      const one = m.done.length + m.skipped.length === 1, q0 = m.done[0];
      v.innerHTML = '<div class="win pop corner"><h2>' + I('check', '', 's') + '퀘스트 완료' + (m.done.length > 1 ? ' ×' + m.done.length : '') + '</h2>' +
        (one ? '<h3>' + esc(q0.title) + '</h3><div class="rewardbox">' + I('gift') + '<b class="gold">' + esc(q0.reward) + '</b></div>'
          : '<div class="qdone">' + m.done.map(q => '<div>' + I('check', '', 's') + '<b>' + esc(q.title) + '</b><span class="gold">' + I('gift', '', 's') + esc(q.reward) + '</span></div>').join('') +
            m.skipped.map(q => '<div class="off">' + I('skip', '', 's') + '<b>' + esc(q.title) + '</b><span>때가 지나 건너뜀</span></div>').join('') + '</div>') + nextBox(m.next) + okBtn() + '</div>';
    } else if (m.type === 'perk') {
      const cards = R.offerView(S) || [];
      v.innerHTML = '<div class="win lvup corner"><h2>' + I('star', '', 's') + '레벨 업</h2><h3>Lv.' + (S.lv - S.picks + 1) + ' — 특성을 하나 고르세요</h3><div class="pcards">' + cards.map((p, i) =>
        '<button class="pcard' + (p.aug ? ' aug' : '') + '" data-do="perk" data-arg="' + p.id + '"' + (p.aug ? ' title="양날 특성: 크게 얻는 대신 못 하게 되는 것이 있습니다"' : '') + '><span class="key">' + (i + 1) + '</span>' + (p.aug ? '<em class="edge">양날</em>' : '') + I(p.icon) + '<b>' + p.name + '</b>' +
        (p.aug ? '<span class="gain">' + esc(p.desc) + '</span><em class="con">대신: ' + esc(p.con) + '</em>' : '<span>' + p.desc + '</span>') + (p.excl ? '<em class="excl">' + I('lock', '', 's') + esc(p.excl) + '</em>' : '') + '<i class="have" title="같은 특성을 겹쳐 고를 수 있는 횟수">보유 ' + p.n + ' / ' + p.max + '</i></button>').join('') + '</div></div>';
    } else if (m.type === 'event') {
      const e = m.view, cost = c => (c.cost ? '<span class="cost" title="고르면 드는 돈">' + I('cash', '', 's') + '−' + won(c.cost) + '</span>' : '');
      v.innerHTML = '<div class="win evt corner"><div class="evt-top">' + I(e.icon) + '<div><h2>' + I('dice', '', 's') + '돌발</h2><h3>' + esc(e.title) + '</h3></div></div><p>' + esc(m.done || e.text) + '</p>' +
        (m.done ? evFx(m.fx) + okBtn() : '<div class="evt-btns"><button class="btn" data-do="ev" data-arg="a"' + (e.a.ok ? '' : ' disabled') + '><span class="key">1</span>' + esc(e.a.label) + cost(e.a) + '</button><button class="btn" data-do="ev" data-arg="b"><span class="key">2</span>' + esc(e.b.label) + cost(e.b) + '</button></div>') + '</div>';
    } else if (m.type === 'tier') {
      const e = m.e, row = (ic, html, c) => '<div' + (c ? ' class="' + c + '"' : '') + '>' + I(ic) + '<span>' + html + '</span></div>';
      v.innerHTML = '<div class="win pop corner"><h2>' + I('door', '', 's') + '주거 변경</h2><h3>' + esc(e.name) + (e.lease ? ' · ' + R.LEASE[e.lease] : '') + '</h3>' + (e.unlock ? '<div class="rewardbox">' + I('gift') + '<b class="gold">' + esc(e.unlock) + '</b> 열림</div>' : '') +
        (e.deposit ? '<div class="crows">' + row('wallet', (e.to === 2 ? '예치금 ' : '보증금 ') + '<b>' + won(e.deposit) + '</b> <span class="dim">나갈 때 돌려받는 돈 — 순자산은 그대로</span>' + (e.refund ? ' <span class="dim">살던 곳의 ' + won(e.refund) + '은 돌려받음</span>' : ''), 'good') + row('bill', '일요일 밤마다 고정비 <b class="gold">' + won(R.weekCost(S, e.to)) + '</b>' + (e.to >= 5 ? '' : ' <span class="dim">끼니 포함</span>')) + '</div>' : '') +
        (e.price ? '<div class="crows">' + row('key', '값 <b>' + won(e.price) + '</b>' + (e.sold ? ' <span class="dim">살던 집 ' + won(e.sold) + '에 팔림</span>' : '')) +
          (e.loan ? row('bill', '주담대 <b>' + won(e.loan) + '</b> <span class="dim">한 주 이자 ' + pct1(e.rate) + '</span> — 일요일 밤마다 고정비와 함께 <b class="gold">' + won(R.weekCost(S, e.to) + r1k(e.loan * e.rate) + Math.min(e.loan, r1k(e.loan / tune.loan_weeks))) + '</b>', 'gold') : row('check', '대출 없음 — 일요일 밤 고정비 <b>' + won(R.weekCost(S, e.to)) + '</b>만', 'good')) + '</div>' : '') + okBtn() + '</div>';
    } else if (m.type === 'act1') { // 1막 끝: 내 집을 처음 산 순간. 등급 · 결과 카드 복사 · 계속한다
      const a = S.act1 || { day: m.e.day, rank: m.e.rank };
      v.innerHTML = '<div class="win act1 corner"><h2>' + I('key', '', 's') + '1막 끝</h2><h3>내 집 마련</h3><div class="rank" title="며칠째에 샀는지로 정해지는 등급 (' + tune.act1_s + '일까지 S · ' + tune.act1_a + '일까지 A · ' + tune.act1_b + '일까지 B)">' + a.rank + '</div>' +
        '<p>' + esc(S.name) + ' 님은 <b class="gold">' + a.day + '일째</b>에 내 집을 샀습니다. 서울역 벤치는 다음 사람에게 양보합니다. 이제 월세 대신 관리비 · 세금만 나가고, <b>가게</b>를 차릴 수 있습니다.</p>' +
        '<div class="e-card"><pre>' + esc(R.resultCard(S, 'act1')) + '</pre><button class="btn" data-do="copy" title="1막 결과 카드를 복사해 붙여 넣을 수 있습니다">' + I('copy') + '복사</button></div>' +
        '<p class="next2">등급: S ' + tune.act1_s + '일 · A ' + tune.act1_a + '일 · B ' + tune.act1_b + '일 안, 그 뒤는 C. 다음은 아파트 → 주택 → 별장 → 호텔, 그리고 <b class="gold">한국 최고 부자</b>.</p>' + okBtn('계속한다') + '</div>';
    } else if (m.type === 'biz') {
      const e = m.e, v2 = R.bizView(S), auto = v2.eff ? Math.round(tune['biz_auto_' + v2.eff] * 100) : 0;
      v.innerHTML = '<div class="win pop corner"><h2>' + I('rocket', '', 's') + '사업 확장</h2><h3>' + esc(e.name) + '</h3><div class="rewardbox">' + I('coin') + '<span>같은 알바를 해도 일당 <b class="gold">×' + num(e.mult) + '</b>' + (auto ? ' · 쉬기 · 공부 칸에도 가장 많이 주는 알바 일당의 ' + auto + '%' : '') + '</span></div>' +
        (v2.eff < v2.lv ? '<p class="bad">지금 사는 곳에서는 ' + v2.effName + '(×' + num(v2.effMult) + ')까지만 반영됩니다.</p>' : '') + okBtn() + '</div>';
    } else if (m.type === 'foreclose') { // 압류: 무슨 일이 일어났는지 숫자로
      const e = m.e, row = (ic, html, c) => '<div' + (c ? ' class="' + c + '"' : '') + '>' + I(ic) + '<span>' + html + '</span></div>';
      v.innerHTML = '<div class="win pop corner bad"><h2>' + I('skull', '', 's') + '압류</h2><h3>' + R.HOMES[e.from].name + ' → ' + R.HOMES[e.to].name + '</h3><p>원리금 · 고정비를 두 번 연속 못 내 ' + R.HOMES[e.from].name + jo(R.HOMES[e.from].name, '이', '가') + ' 압류되었습니다.</p><div class="crows">' +
        row('key', '시세의 ' + Math.round(tune.foreclose_rate * 100) + '%에 팔림 <b>' + won(e.sold) + '</b>') +
        row('bill', '그 돈으로 갚은 대출 · 빚 <b>' + won(e.repaid) + '</b>') +
        (e.carried ? row('warn', '판 돈으로 다 못 갚은 빚 <b>' + won(e.carried) + '</b> — 아래 집(' + R.HOMES[e.to].name + ') 대출로 넘어감', 'bad') : '') +
        (e.left ? row('check', '탕감 <b>' + won(e.left) + '</b>', 'good') : '') +
        (e.loan ? row('bill', R.HOMES[e.to].name + ' 대출 <b>' + won(e.loan) + '</b> <span class="dim">= 넘어온 빚 + ' + R.HOMES[e.to].name + ' 값 중 현금으로 못 낸 몫</span><br>일요일 밤마다 고정비와 함께 <b class="gold">' + won(R.weekCost(S, e.to) + loanWeekly(e.loan)) + '</b>', 'gold') : '') +
        row('door', '<b>' + R.HOMES[e.to].name + '</b>' + jo(R.HOMES[e.to].name, '으로', '로') + ' 내려갔습니다' + (e.to < 4 ? ' (빌려 사는 곳)' : '')) +
        row('wallet', '순자산 변화 <b class="down">−' + won(Math.max(0, e.lost)) + '</b> <span class="dim">압류 전과 견준 차이 · 지금 순자산 ' + won(R.worth(S)) + '</span>', 'bad') + '</div>' + okBtn() + '</div>';
    } else if (m.type === 'collapse') { // 쓰러짐: 무슨 일이 일어났는지 숫자로
      const e = m.e, row = (ic, html, c) => '<div' + (c ? ' class="' + c + '"' : '') + '>' + I(ic) + '<span>' + html + '</span></div>';
      v.innerHTML = '<div class="win pop corner bad"><h2>' + I('clinic', '', 's') + '쓰러짐</h2><h3>눈을 뜨니 응급실</h3><p>체력이 모자란 채 일하다 쓰러졌습니다 <span class="dim">(쓰러질 확률 ' + Math.round(e.risk * 100) + '%)</span>.</p><div class="crows">' +
        row('cash', '응급실비 <b>' + won(e.fee) + '</b>' + (e.owe ? ' <span class="dim">못 낸 ' + won(e.owe) + '은 외상 — 일요일 정산에</span>' : e.paid < e.fee ? ' <span class="dim">가진 ' + won(e.paid) + '만 냄</span>' : ''), 'bad') +
        row('clock', (e.lost ? '오늘 남은 <b>' + e.lost + '칸</b>과 ' : '') + '<b>내일 오전</b>을 병원에서 보냅니다', 'bad') +
        row('bed', '오늘 밤은 병원에서 — 체력 <b>+' + R.sleepGain(S) + '</b> <span class="dim">찜질방 요금 · 끼니는 안 나감</span>') +
        row('meal', '체력이 모자라면 <b>쉬거나 가게에서 사 먹고</b> 일하세요. 집이 좋을수록 밤에 더 많이 돌아옵니다', 'good') + '</div>' + okBtn() + '</div>';
    } else if (m.type === 'story') { // 꿈의 장면
      const e = m.e;
      v.innerHTML = '<div class="win pop story corner"><h2>' + I('star', '', 's') + '꿈 · ' + e.n + ' / ' + e.of + '</h2><h3>' + esc(e.name) + '</h3><p class="st">' + esc(e.text) + '</p>' +
        (e.gain ? '<div class="rewardbox">' + I('gift') + '<b class="gold">' + esc(e.gain) + '</b></div>' : '') + okBtn() + '</div>';
    } else if (m.type === 'study') { // 공부: 종목 고르기
      const k = R.knowView(S), two = m.picks > 1;
      v.innerHTML = '<div class="win pop corner"><h2>' + I('book', '', 's') + '공부 · ' + k.lv + '단계 ' + k.name + '</h2><h3>어느 종목의 내일을 볼까요?' + (two ? ' <span class="dim" style="font-size:16px">둘까지 (' + m.sel.length + ' / 2)</span>' : '') + '</h3><p class="sub">한 칸과 체력 ' + tune.study_hp + '을 써서 고른 종목' + (two ? ' 둘' : ' 하나') + '의 내일 소식이 오르는 쪽인지 내리는 쪽인지 봅니다 (' + Math.round(k.acc * 100) + '% 맞음 — 맞았는지는 밤에 알려 줌). 공부 횟수가 쌓이면 단계가 오릅니다' + (k.next ? ' (' + k.xp + ' / ' + k.next + ')' : '') + '.' + (m.auto ? ' 공부하는 동안에도 사업 매출 ' + won(m.auto) + '.' : '') + '</p>' +
        '<div class="spick">' + m.assets.map((a, i) => { const ar = R.ASSETS.find(x => x.id === a.id); return '<button class="sbtn' + (m.sel.indexOf(a.id) >= 0 ? ' on' : '') + '" data-do="studyasset" data-arg="' + a.id + '" title="' + esc(a.name + ' — ' + ar.hint) + '"><span class="key">' + (i + 1) + '</span><span class="em">' + art('asset', a.id) + '</span><b>' + a.name + '</b><i>' + ar.tag + '</i></button>'; }).join('') + '</div>' +
        '<div class="foot"><button class="btn" data-do="no">돌아가기 <span class="key">Space</span></button>' + (two ? '<button class="btn main" data-do="studygo"' + (m.sel.length ? '' : ' disabled') + '>공부한다 <span class="key">Enter</span></button>' : '') + '</div></div>';
    } else if (m.type === 'buy' || m.type === 'repay' || m.type === 'lease') v.innerHTML = optsHtml(m);
    else if (m.type === 'liq') {
      v.innerHTML = '<div class="win pop corner bad"><h2>' + I('skull', '', 's') + '청산</h2><h3>증거금 ' + won(m.e.lost) + '이 사라졌습니다</h3><p>' + m.e.lev + '배 ' + (m.e.dir > 0 ? '롱' : '숏') + '이 반대로 갔습니다.' + (m.e.saved ? ' 강심장으로 ' + won(m.e.saved) + '은 건졌습니다.' : '') + ' 배율을 낮추거나, 확실할 때만 크게 거세요.</p>' + okBtn() + '</div>';
    } else if (m.type === 'confirm') {
      if (m.kind === 'move') {
        const h = R.HOMES[m.to], wk = R.weekCost(S, m.to), after = S.cash - m.info.pay, tonight = S.day % 7 === 0 ? Math.round(wk / 7 / 1000) * 1000 : 0;
        const row = (ic, html, c) => '<div' + (c ? ' class="' + c + '"' : '') + '>' + I(ic) + '<span>' + html + '</span></div>';
        v.innerHTML = '<div class="win pop corner"><h2>' + I('door', '', 's') + '입주 확인</h2><h3>' + h.name + '에 입주할까요?</h3><div class="crows">' +
          row('wallet', (m.to === 2 ? '예치금 ' : '보증금 ') + '<b>' + won(m.info.need) + '</b> <span class="dim">걸어 두는 돈</span>') +
          row('check', '<b>나갈 때 돌려받습니다</b> — 순자산은 그대로입니다', 'good') +
          (S.arrears ? row('warn', '밀린 고정비 <b>' + won(S.arrears) + '</b>을 갚고 나갑니다', 'bad') : '') +
          (m.info.settle ? row('bill', '살던 ' + R.HOMES[S.tier].name + ' 정산 <b>' + won(m.info.settle) + '</b> <span class="dim">이번 주에 산 날만큼</span>') : '') +
          row('bill', '매주 일요일 밤 고정비 <b class="gold">' + won(wk) + '</b> <span class="dim">끼니 포함 · 두 번 밀리면 쫓겨남</span>') +
          (tonight ? row('warn', '오늘이 일요일 — 오늘 밤 하루치 <b>' + won(tonight) + '</b>' + (after < tonight ? ' · 모자랍니다' : ''), after < tonight ? 'bad' : 'gold') : '') +
          row('wallet', '입주 뒤 현금 <b>' + won(after) + '</b>') +
          row('gift', '<b class="gold">' + h.unlock + '</b> 열림') + '</div>' +
          '<div class="foot"><button class="btn" data-do="no">아직 <span class="key">Space</span></button><button class="btn main" data-do="ok">입주 <span class="key">Enter</span></button></div></div>';
      } else if (m.kind === 'swap') { // 원룸 월세 → 전세
        const i = m.info, row = (ic, html, c) => '<div' + (c ? ' class="' + c + '"' : '') + '>' + I(ic) + '<span>' + html + '</span></div>';
        v.innerHTML = '<div class="win pop corner"><h2>' + I('key', '', 's') + '계약 바꾸기</h2><h3>원룸을 전세로 바꿀까요?</h3><div class="crows">' +
          row('wallet', '전세 보증금 <b>' + won(i.need) + '</b> <span class="dim">나갈 때 돌려받는 돈</span>') +
          (i.refund ? row('gift', '월세 보증금 <b class="good">' + won(i.refund) + '</b>은 돌려받아 보탭니다', 'good') : '') +
          (i.settle ? row('bill', '어제까지의 월세 정산 <b>' + won(i.settle) + '</b>') : '') +
          row('cash', '지금 나가는 현금 <b class="gold">' + won(i.pay) + '</b> <span class="dim">순자산은 그대로</span>') +
          row('bill', '일요일 밤마다 고정비 <b>' + won(R.weekCost(S, 3, 'rent')) + '</b> → <b class="good">' + won(i.week) + '</b>', 'good') +
          row('shield', '신용점수 <b>+' + tune.credit_contract + '</b>') + '</div>' +
          '<div class="foot"><span class="dim fl">현금 ' + won(S.cash) + '</span><button class="btn" data-do="no">아직 <span class="key">Space</span></button><button class="btn main" data-do="ok">바꾼다 <span class="key">Enter</span></button></div></div>';
      } else if (m.kind === 'propbuy' || m.kind === 'propsell') { // 상가 사기 · 팔기
        const r = m.v, buy = m.kind === 'propbuy', row = (ic, html, c) => '<div' + (c ? ' class="' + c + '"' : '') + '>' + I(ic) + '<span>' + html + '</span></div>';
        v.innerHTML = '<div class="win pop corner"><h2>' + I('building', '', 's') + '부동산</h2><h3>' + esc(r.name) + jo(r.name, '을', '를') + (buy ? ' 살까요?' : ' 팔까요?') + '</h3><div class="crows">' +
          (buy ? row('key', '값 <b>' + won(r.buy) + '</b>' + eokTag(r.buy) + ' <span class="dim">자산으로 남음 — 시세를 따라 오르내림</span>') + row('bill', '취득세 · 중개비 <b>' + won(r.tax) + '</b> <span class="dim">쓴 돈 (순자산이 그만큼 줆)</span>', 'bad') +
            row('coin', '일요일 밤마다 임대수익 <b class="gold">+' + won(r.rent) + '</b> <span class="dim">세입자가 나가면 1~2주는 0</span>', 'good') + row('wallet', '산 뒤 현금 <b>' + won(S.cash - r.cost) + '</b>')
            : row('key', '지금 시세 <b>' + won(r.price) + '</b>' + eokTag(r.price) + ' <span class="dim">산 값 ' + won(r.paid) + '</span>') + row('bill', '중개비 · 세금 <b>' + won(r.price - r.sellNet) + '</b>', 'bad') +
            row('cash', '받는 돈 <b class="gold">' + won(r.sellNet) + '</b> <span class="' + cls(r.sellNet - r.paid) + '">손익 ' + sign(r.sellNet - r.paid) + '</span>') + row('coin', '임대수익 주 ' + won(r.rent) + '은 더 들어오지 않습니다', 'bad')) + '</div>' +
          '<div class="foot"><button class="btn" data-do="no">아직 <span class="key">Space</span></button><button class="btn ' + (buy ? 'warm' : 'main') + '" data-do="ok">' + (buy ? '산다' : '판다') + ' <span class="key">Enter</span></button></div></div>';
      } else if (m.kind === 'sleep') {
        const own = S.tier >= 4 && R.leaseOf(S) === 'own';
        v.innerHTML = '<div class="win pop corner bad"><h2>' + I('warn', '', 's') + '확인</h2><h3>' + (m.auto ? '정산에 현금이 모자랍니다' : '정산을 못 냅니다') + '</h3><p>' +
          '오늘 밤 ' + R.billName(m.b) + ' <b class="gold">' + won(m.b.amt) + '</b>인데 현금이 ' + won(m.lack) + ' 모자랍니다' + (m.b.income ? ' (들어올 임대수익 · 배당 ' + won(m.b.income) + '을 쳐도)' : '') + '. 주식 · 코인을 팔면 현금이 됩니다. ' +
          (m.auto ? '그냥 자면 모자란 만큼을 <b>마이너스 통장에서 자동으로 빌려</b> 냅니다 (한 주 이자 ' + pct1(R.creditView(S).rate) + ').' : '그냥 자면 연체료가 붙고 신용점수가 깎이며, 두 번 연속이면 ' + (S.tier < 2 ? '빚이 계속 불어납니다.' : own ? '집이 압류되어 한 단계 아래로 내려갑니다.' : '쫓겨납니다.') + (S.missed ? ' <b class="bad">지난번에도 밀렸습니다 — 오늘이 두 번째입니다.</b>' : '')) + '</p>' +
          '<div class="foot"><button class="btn" data-do="ok">그래도 잔다 <span class="key">Enter</span></button><button class="btn main" data-do="no">돌아가기 <span class="key">Space</span></button></div></div>';
      } else if (m.kind === 'biz') {
        const n = m.v.next, auto = Math.round((tune['biz_auto_' + Math.min(n.lv, Math.max(0, S.tier - 3))] || 0) * 100);
        const row = (ic, html, c) => '<div' + (c ? ' class="' + c + '"' : '') + '>' + I(ic) + '<span>' + html + '</span></div>';
        v.innerHTML = '<div class="win pop corner"><h2>' + I('rocket', '', 's') + '사업 키우기</h2><h3>' + n.name + jo(n.name, '을', '를') + ' 차릴까요?</h3><div class="crows">' +
          row('cash', '차리는 돈 <b class="gold">' + won(n.cost) + '</b> <span class="dim">쓴 돈은 자산으로 남지 않음 (순자산이 그만큼 줆)</span>') +
          row('coin', '같은 알바를 해도 일당 <b>×' + num(n.mult) + '</b> <span class="dim">지금 ×' + num(m.v.mult) + '</span>', 'good') +
          (auto ? row('zzz', '쉬기 · 공부 칸에도 가장 많이 주는 알바 일당의 <b>' + auto + '%</b>가 사업 매출로', 'good') : '') +
          row('wallet', '차린 뒤 현금 <b>' + won(S.cash - n.cost) + '</b>') + '</div>' +
          '<div class="foot"><button class="btn" data-do="no">아직 <span class="key">Space</span></button><button class="btn warm" data-do="ok">차린다 <span class="key">Enter</span></button></div></div>';
      } else if (m.kind === 'top') {
        v.innerHTML = '<div class="win pop corner"><h2>' + I('crown', '', 's') + '선언 확인</h2><h3>한국 최고 부자를 선언할까요?</h3><p>순자산 <b class="gold">' + won(R.worth(S)) + '</b>' + eokTag(R.worth(S)) + ' · 기준 ' + won(tune.top_worth) + eokTag(tune.top_worth) + '<br>' + S.day + '일째. 선언하면 이 판은 여기서 끝납니다.</p>' +
          '<div class="foot"><button class="btn" data-do="no">아직 <span class="key">Space</span></button><button class="btn warm" data-do="ok">선언 <span class="key">Enter</span></button></div></div>';
      }
    } else if (m.type === 'night') v.innerHTML = nightHtml(m.sum);
    else if (m.type === 'achs') v.innerHTML = achsHtml();
    else if (m.type === 'help') v.innerHTML = helpHtml();
    const w = v.firstElementChild; // 꺾쇠를 창보다 먼저 그리려고 틀을 한 겹 둠
    if (w && w.classList.contains('corner')) { const f = document.createElement('div'); f.className = 'frame corner'; w.classList.remove('corner'); v.replaceChild(f, w); f.appendChild(w); }
  }
  function nightHtml(n) {
    const keep = t => esc(t).replace(/\([^)]*\)/g, m => m.replace(/ /g, '\u00a0')); // 괄호 덧붙임은 한 덩어리로 (줄이 바뀌면 통째로 다음 줄에 — 금액 바로 옆에서 끊기지 않게)
    const rows = (list, sgn) => (list.length ? list.map(r => '<div class="n-row"><span>' + keep(r.label) + '</span><span class="' + (sgn > 0 ? 'gold' : '') + '">' + (sgn > 0 ? '+' : '−') + won(r.amt) + '</span></div>').join('') : '<div class="n-row none"><span>없음</span><span></span></div>');
    const reps = (n.reports || []).map(r => { const nm = BY[r.by] || '리포트', way = d => (d > 0 ? '오르는' : '내리는') + ' 쪽'; // 리포트 채점: 소식의 하루가 끝난 밤에 한 줄씩
      return '<div class="' + (r.right ? 'good' : 'bad') + '">' + I('book', '', 's') + '<b>' + nm + ' ' + (r.right ? '맞음' : '틀림') + '</b> — ' + esc(r.name) + (r.asset === 'hantang' ? ' 매집, 리포트는 ' + (r.said > 0 ? '진짜' : '털기') + ' 쪽 · 실제는 ' + (r.real > 0 ? '진짜' : '털기') : ', 리포트는 ' + way(r.said) + ' · 실제 소식은 ' + way(r.real)) + '</div>'; }).join('');
    const d = n.worthEnd - n.worthStart;
    const next = []; // 내일 일어날 것만 (고정비 · 원리금은 전날에 미리)
    for (const x of R.notices(S)) if (x.when === 'tomorrow') next.push('<span class="chip hot" title="내일 밤 현금에서 나갑니다">' + I('bill', '', 's') + esc(x.text) + '</span>');
    const g = n.goal || R.goalView(S);
    return '<div class="win night corner"><h2>' + I('moon', '', 's') + n.day + '일째 밤</h2><h3>' + n.home + '에서 잠듭니다</h3>' +
      '<div class="n-cols"><div class="n-col"><h4>' + I('plus', '', 's') + '번 돈</h4>' + rows(n.income, 1) + '<div class="n-row sum"><span>합계</span><span class="gold" id="nightin">+' + won(rolls.nightin ? rolls.nightin.v : n.labor) + '</span></div></div>' +
      '<div class="n-col"><h4>' + I('minus', '', 's') + '쓴 돈</h4>' + rows(n.expense, -1) + '<div class="n-row sum"><span>합계</span><span id="nightout">' + (n.spent ? '−' : '') + won(rolls.nightout ? rolls.nightout.v : n.spent) + '</span></div></div></div>' +
      '<div class="n-big">' + (R.unlocked(S, 'stock') || n.invest ? I('chart', '투자 손익 (오늘)') + '<i>투자</i><b class="' + cls(n.invest) + '">' + sign(n.invest) + '</b>' : '') +
      I('wallet', '순자산') + '<i>순자산</i><b>' + won(n.worthStart) + ' → ' + won(n.worthEnd) + ' <span class="' + cls(d) + '" style="font-size:16px">(' + sign(d) + ')</span></b>' +
      I('hp', '체력') + '<i>체력</i><b>' + Math.round(n.hp.mid) + ' → ' + Math.round(n.hp.after) + ' <span class="good" style="font-size:16px">(' + I('zzz', '', 's') + '+' + Math.round(n.hp.sleep) + ')</span></b></div>' +
      (reps ? '<div class="n-notes n-reps">' + reps + '</div>' : '') +
      (n.billed && n.billed.paid ? '<div class="n-notes good">' + (n.billed.name || '고정비') + ' ' + won(n.billed.amt) + '을 냈습니다' + (n.billed.days < 7 && n.billed.amt ? ' (' + n.billed.days + '일치 — 이번 주는 ' + n.billed.days + '일만 살아서)' : '') + '.</div>' : '') +
      (n.credit && n.credit.to !== n.credit.from ? '<div class="n-notes ' + (n.credit.to > n.credit.from ? 'good' : 'bad') + '">' + I('shield', '', 's') + ' 신용점수 ' + n.credit.from + ' → <b>' + n.credit.to + '</b> (' + n.credit.grade + '등급)</div>' : '') +
      (n.re ? '<div class="n-notes ' + cls(n.re.pct) + '" title="부동산 시세는 일요일 밤마다 움직입니다 — 집값 · 가진 집 · 상가 · 뚝딱건설이 따라갑니다">' + I('building', '', 's') + ' 부동산 시세 ' + pct(n.re.pct) + ' <span class="dim">(처음 대비 ' + pct(n.re.idx - 1) + ')</span></div>' : '') +
      (n.notes.length ? '<div class="n-notes">' + n.notes.map(x => '<div class="' + x.tone + '">' + esc(x.text) + '</div>').join('') + '</div>' : '') +
      '<div class="n-house" title="다음 목표까지 온 만큼">' + I(g.kind === 'top' ? 'crown' : 'key') + '<span class="gn">' + g.name + '</span><div class="bar"><div style="width:' + (clamp(g.pct, 0, 1) * 100).toFixed(1) + '%"></div></div><b>' + Math.floor(g.pct * 100) + '%</b><span class="dim">' + won(g.price) + '</span></div>' +
      (next.length ? '<div class="n-next">' + next.join('') + '</div>' : '') + okBtn('다음 날') + '</div>';
  }
  function optsHtml(m) { // 집 사기(대출 고르기) · 미리 갚기: 고를 것 한 줄씩, 숫자 키로 고르고 Enter
    const row = (ic, html, c) => '<div' + (c ? ' class="' + c + '"' : '') + '>' + I(ic) + '<span>' + html + '</span></div>';
    const opt = (o, i, body) => '<button class="opt' + (i === m.pick ? ' on' : '') + (o.ok ? '' : ' no') + '" data-do="opt" data-arg="' + i + '"><span class="key">' + (i + 1) + '</span><span class="ob"><b>' + body[0] + '</b><span>' + body[1] + '</span>' + (body[2] ? '<span>' + body[2] + '</span>' : '') + (body[3] ? '<span>' + body[3] + '</span>' : '') + (o.ok ? '' : '<span class="bad lk">' + I('lock', '잠김', 's') + esc(o.why) + '</span>') + '</span></button>';
    if (m.type === 'lease') { // 원룸 입주: 월세 · 전세
      const body = o => [o.name + (o.lease === 'jeonse' ? ' — 목돈을 걸고 월세가 없다' : ' — 보증금이 작고 매주 월세가 나간다'),
        '보증금 ' + won(o.info.need) + ' <i>나갈 때 돌려받음</i> · 지금 나갈 현금 <b class="gold">' + won(Math.max(0, o.info.pay)) + '</b>',
        '일요일 밤마다 고정비 <b class="' + (o.lease === 'jeonse' ? 'good' : 'gold') + '">' + won(o.info.week) + '</b> <i>끼니 포함</i>'];
      const i0 = m.opts[0].info;
      return '<div class="win pop wide corner"><h2>' + I('door', '', 's') + '입주</h2><h3>원룸에 어떻게 들어갈까요?</h3><div class="crows">' +
        row('gift', '<b class="gold">' + R.HOMES[3].unlock + '</b> 열림') +
        (i0.refund ? row('wallet', '고시원 예치금 <b class="good">' + won(i0.refund) + '</b>은 돌려받아 보탭니다', 'good') : '') +
        (i0.settle ? row('bill', '살던 고시원의 이번 주 고정비 <b>' + won(i0.settle) + '</b> <span class="dim">산 날만큼 — 나가면서 냄</span>') : '') +
        (S.arrears ? row('warn', '밀린 돈 <b>' + won(S.arrears) + '</b>을 갚고 나갑니다', 'bad') : '') + '</div>' +
        '<div class="opts">' + m.opts.map((o, i) => opt(o, i, body(o))).join('') + '</div>' +
        '<div class="crows">' + (() => { const we = dayEarn() * 7, sh = o => (we > 0 ? Math.round(o.info.week / we * 100) : 0), a = sh(m.opts[0]), b = sh(m.opts[1]);
          const hot = n => (n >= 60 ? ' class="bad" title="벌이의 절반을 훌쩍 넘습니다 — 빠듯합니다"' : ''); // 고정비가 벌이의 60%를 넘으면 빨갛게 (대충만 누르면 적자가 되는 선)
          return row(a >= 60 ? 'warn' : 'coin', '<span title="하루 세 칸을 돈 많이 주는 알바부터 보통으로 했을 때 (같은 알바는 하루 한 번)">지금 벌이는 주 약 <b>' + won(we) + '</b></span> — 고정비가 그중 월세 <b' + hot(a) + '>' + a + '%</b> · 전세 <b' + hot(b) + '>' + b + '%</b>'); })() +
          row('check', '보증금은 걸어 두는 돈이라 <b>순자산은 그대로</b>입니다. 월세로 들어갔다가 나중에 전세로 갈아탈 수 있습니다', 'good') + '</div>' +
        '<div class="foot"><span class="dim fl">현금 ' + won(S.cash) + '</span><button class="btn" data-do="no">아직 <span class="key">Space</span></button><button class="btn main" data-do="ok">입주 <span class="key">Enter</span></button></div></div>';
    }
    if (m.type === 'buy') {
      const h = R.HOMES[m.to], info = m.info, from = R.HOMES[S.tier].name;
      const days = (7 - (S.day % 7)) % 7 + 1, f = days / 7; // 첫 일요일은 산 날만큼만 (대출 줄 · 미리 갚기 창과 같은 셈)
      const first = r1k(m.opts[m.pick].fixed * f) + (m.opts[m.pick].loan ? r1k(m.opts[m.pick].loan * info.rate * f) + Math.min(m.opts[m.pick].loan, r1k(m.opts[m.pick].loan / tune.loan_weeks * f)) : 0); // 고른 것의 첫 일요일
      const body = o => o.lease === 'jeonse' ? [o.name + ' — 대출 없이, 집값이 올라도 내 것은 아니다', '보증금 ' + won(o.deposit) + ' <i>나갈 때 돌려받음</i> · 지금 낼 현금 <b class="gold">' + won(o.cash) + '</b> · 일요일 밤마다 고정비 <b>' + won(o.fixed) + '</b>']
        : [o.name + (o.loan && o.loan === info.loanMax ? ' (현금 ' + won(o.cash) + '만 있으면 됨)' : ''),
          (o.loan ? '<span title="빌리는 돈 ' + won(o.loan) + '">대출 ' + cwon(o.loan) + '</span> · ' : '') + '지금 낼 현금 <b class="gold">' + won(o.cash) + '</b> · 일요일 밤마다 ' + (o.loan ? '<b class="gold">' + won(o.fixed + o.weekly) + '</b> <i title="고정비 ' + won(o.fixed) + ' + 원리금 ' + won(o.weekly) + ' (' + tune.loan_weeks + '회에 나눠 갚음)">고정비 ' + cwon(o.fixed) + ' + 원리금 ' + cwon(o.weekly) + ' × ' + tune.loan_weeks + '회</i>' : '고정비 <b' + (R.perk(S, 'thrift') ? ' title="짠돌이 −' + Math.round(tune.perk_thrift * R.perk(S, 'thrift') * 100) + '% 적용"' : '') + '>' + won(o.fixed) + '</b>')]; // 한 줄에: 빌리는 돈 · 지금 낼 현금 · 매주 나갈 돈 (짠돌이로 깎인 것은 설명에)
      const earn = dayEarn(); // 지금 벌이 (견줄 숫자)
      const sold = R.leaseOf(S) === 'own' && S.tier >= 4;
      return '<div class="win pop wide' + (m.to > 4 ? ' buy' : '') + ' corner"><h2>' + I('key', '', 's') + (m.jeonse ? '집 들어가기' : '집 사기') + '</h2><h3>' + h.name + (m.jeonse ? '에 어떻게 들어갈까요?' : jo(h.name, '을', '를') + ' 살까요?') + '</h3><div class="crows">' +
        row('key', '값 <b>' + won(info.price) + '</b>' + eokTag(info.price) + (m.to === 4 ? ' <span class="dim">현금으로만</span>' : ' <span class="dim">부동산 시세를 따라 오르내림</span>')) +
        (m.to > 4 ? row('shield', '신용 <b>' + info.grade + '등급</b> — ' + (info.loanMax ? '값의 ' + Math.round(info.ltv * 100) + '%(' + won(info.loanMax) + ')까지 빌릴 수 있고 한 주 이자 ' + pct1(info.rate) : '대출이 나오지 않습니다 (6등급 = 400점부터)'), info.loanMax ? '' : 'bad') : '') +
        (info.sell > 0 ? row('gift', (sold ? '살던 ' + from + jo(from, '이', '가') + ' 팔려' : '살던 ' + from + '의 보증금을 돌려받아') + ' 보태지는 돈 <b class="good">' + won(info.sell) + '</b>' + (sold ? ' <span class="dim">지금 시세 − 대출</span>' : ''), 'good')
          : info.sell < 0 ? row('warn', '살던 ' + from + jo(from, '을', '를') + ' 팔아도 대출이 <b>' + won(-info.sell) + '</b> 남습니다 <span class="dim">들어가면서 함께 갚음 (지금 낼 현금에 들어 있음)</span>', 'bad') : '') +
        (S.arrears ? row('warn', '밀린 고정비 <b>' + won(S.arrears) + '</b> — 사면서 먼저 갚습니다', 'bad') : '') +
        (info.settle ? row('bill', '살던 ' + from + '의 이번 주 고정비 <b>' + won(info.settle) + '</b> <span class="dim">산 날만큼 — 나가면서 냄</span>') : '') + '</div>' +
        '<div class="opts">' + m.opts.map((o, i) => opt(o, i, body(o))).join('') + '</div>' +
        '<div class="crows">' + (days < 7 ? row('calendar', '첫 일요일은 산 날만큼(' + days + '일치)만: 고른 것이면 ' + won(first) + ' — 그다음부터 위의 금액') : '') +
        (m.to > 4 ? row('warn', '<span title="하루 세 칸을 돈 많이 주는 알바부터 보통으로 했을 때 (같은 알바는 하루 한 번)">지금 벌이는 주 약 <b>' + won(earn * 7) + '</b>.</span> 대출 이자 한 주 ' + pct1(info.rate) + ' — <b>두 번 연속 못 내면 압류되어 한 단계 아래로</b>', 'bad') : m.to === 4 ? row('check', '내 집을 사면 <b>1막 끝</b> — 축하 뒤 계속합니다', 'good') : '') + '</div>' +
        '<div class="foot"><span class="dim fl">현금 ' + won(S.cash) + '</span><button class="btn" data-do="no">아직 <span class="key">Space</span></button><button class="btn warm" data-do="ok">' + (m.jeonse ? '들어간다' : '산다') + ' <span class="key">Enter</span></button></div></div>';
    }
    const l = m.l, body = o => [o.name + ' 갚기 — ' + won(o.amt), '갚은 뒤 잔액 ' + won(o.bal) + ' · 남은 회 ' + l.left + ' → <b>' + o.left + '</b> · 앞으로 낼 이자 <b class="good">−' + won(o.saved) + '</b>', '이번 일요일 원리금 <b class="gold">' + won(o.next) + '</b> <i>안 갚으면 ' + num(m.due) + '</i>'];
    return '<div class="win pop wide corner"><h2>' + I('bill', '', 's') + '미리 갚기</h2><h3>대출을 얼마나 갚을까요?</h3><div class="crows">' +
      row('bill', '잔액 <b>' + won(l.balance) + '</b> · 남은 ' + l.left + '회 · 한 주 이자 ' + pct1(l.rate)) +
      row('calendar', '이번 일요일 원리금 <b>' + won(m.due) + '</b>' + (m.days < 7 ? ' (' + m.days + '일치 — 이사한 주는 산 날만큼)' : '') + ' · 한 주 전체로는 ' + won(l.weekly)) +
      row('check', '칸을 쓰지 않습니다. 원금은 매주 같은 몫이라, 미리 갚으면 남은 회가 줄고 앞으로 낼 이자가 줍니다', 'good') + '</div>' +
      '<div class="opts">' + m.opts.map((o, i) => opt(o, i, body(o))).join('') + '</div>' +
      '<div class="foot"><span class="dim fl">현금 ' + won(S.cash) + '</span><button class="btn" data-do="no">돌아가기 <span class="key">Space</span></button><button class="btn main" data-do="ok">갚는다 <span class="key">Enter</span></button></div></div>';
  }
  function achsHtml() {
    const list = R.achList(), run = S ? S.ach : [];
    return '<div class="win book corner"><h2>' + I('trophy', '', 's') + '업적 ' + achCount() + ' / ' + list.length + '</h2><div class="achs">' + list.map(a => {
      const got = !!meta.ach[a.id] || run.indexOf(a.id) >= 0;
      return '<div class="ach' + (got ? ' got' : '') + '" title="' + a.hint + '">' + I(got ? a.icon : 'lock') + '<b>' + (got ? a.name : '???') + '</b>' + (got ? '' : '<span>' + a.hint + '</span>') + '</div>';
    }).join('') + '</div><div class="rec">' + recChips() + '</div>' + okBtn('닫기') + '</div>';
  }
  function recChips() { // 판 밖에 남는 기록: 시작한 판 · 내 집(1막 끝) 최단 · 엔딩(한국 최고 부자) 최단, 아직 엔딩이 없으면 가장 높이 간 곳
    return '<span class="chip" title="시작한 판 수">' + I('dice', '', 's') + meta.runs + '판</span>' +
      (meta.homes ? '<span class="chip" title="내 집을 산 판(1막 끝) ' + meta.homes + '번 · 가장 빨리 산 날">' + I('key', '', 's') + '내 집 최단 ' + meta.act1Best + '일 · ' + meta.act1Rank + '</span>' : '') +
      (meta.bestDay ? '<span class="chip hot" title="한국 최고 부자 선언 ' + meta.wins + '번 · 가장 빨리 한 날">' + I('crown', '', 's') + '최고 부자 최단 ' + meta.bestDay + '일 · ' + meta.bestRank + '</span>'
        : meta.bestTier ? '<span class="chip" title="가장 높이 올라간 곳">' + I('target', '', 's') + '최고 ' + R.HOMES[Math.min(9, meta.bestTier)].name + '</span>' : '');
  }
  function helpHtml() { // 아이콘 사전: 구역마다 그 구역에 나오는 아이콘과 뜻
    const c = (ic, t) => '<span>' + I(ic, '', 's') + t + '</span>';
    const dots = (n, t) => '<span><span class="rel">' + [1, 2, 3].map(k => '<i class="' + (n >= k ? 'on' : '') + '"></i>').join('') + '</span>' + t + '</span>';
    const sec = (ic, name, chips, note) => '<div class="hz"><b>' + I(ic, '', 's') + name + '</b><div>' + chips.join('') + (note ? '<em>' + note + '</em>' : '') + '</div></div>';
    return '<div class="win book help corner"><h2>' + I('help', '', 's') + '도움말</h2><h3>아이콘 읽는 법</h3><div class="hzs">' +
      sec('calendar', '위쪽 띠', [c('calendar', '며칠째 (이번 주 일곱 칸)'), c('bill', '일요일 칸: 정산 날과 나갈 돈'), c('sun', '오전'), c('noon', '오후'), c('moon', '저녁'), c('fire', '콤보'), c('cash', '현금'), c('wallet', '순자산'), c('key', '다음 목표 (되면 버튼)'), c('trophy', '업적'), c('home', '제목으로 (저장됨)')], '기한은 없습니다. 내 집을 사면 1막 끝, 호텔에서 한국 최고 부자를 선언하면 엔딩') +
      sec('door', '나', [c('door', '사는 곳 · 계약(월세 · 전세 · 매매)'), c('star', '레벨과 경험치'), c('hp', '체력 · 컨디션'), c('rocket', '사업 · 키우기 (내 집부터)'), c('bill', '빚 (주담대 + 마이너스 통장)'), c('plus', '고른 특성')], '체력: 집이 좋을수록 밤에 많이 돌아옵니다 (서울역 ' + tune.sleep_station + ' → 호텔 ' + tune.sleep_hotel + '). 체력이 넉넉하면 "쌩쌩"(일당 +' + Math.round(tune.cond_good_pay * 100) + '%), 바닥이면 "지침"(−' + Math.round(tune.cond_tired_cut * 100) + '%). 모자란 채 일하면(무리) 끝나고 쓰러질 수 있습니다 — 응급실비 · 남은 칸 · 다음 날 오전을 잃습니다') +
      sec('quest', '상태창', [c('quest', '지금 할 퀘스트'), c('gift', '끝내면 받는 것'), c('door', '옮기기 · 사기 · 차리기 버튼'), c('bill', '정산 알림 (전날 · 당일)'), c('star', '고른 꿈과 본 장면')], '정산(고정비 · 원리금 · 이자)은 일요일 밤에 현금에서 나갑니다. 모자라면 마이너스 통장에서 자동으로 빌려 내고, 그래도 안 되면 연체 — 신용점수가 깎이고, 두 번 연속이면 한 단계 내려갑니다') +
      sec('sun', '오늘', [c('coin', '일당'), c('hp', '드는 체력'), c('skip', '대충'), c('check', '오늘 마감'), c('warn', '무리 (쓰러질 확률)'), c('book', '공부'), c('rocket', '쉬어도 + : 사업 매출')], '같은 알바는 하루 한 번입니다. 대충 = 미니게임 없이 일당의 일부. 강도(하 · 중 · 상 · 최상)는 시작 전 화면에서 고릅니다 — 올릴수록 빠르고 일당 ×' + tune.int_pay_0 + '~×' + tune.int_pay_3 + ' · 체력이 더 듭니다. 미니게임은 천천히 시작해 점점 빨라집니다') +
      sec('map', '로드맵', [c('cash', '하룻밤 요금'), c('wallet', '보증금 (돌려받는 돈)'), c('bill', '주 고정비'), c('bed', '자면 돌아오는 체력'), c('key', '집 값'), c('rocket', '열리는 사업'), c('lock', '아직 잠김')], '고시원은 예치금, 원룸은 월세(보증금 작음 · 고정비 큼) 또는 전세(보증금 큼 · 고정비 작음), 내 집은 현금으로 삽니다. 아파트 · 주택은 전세로 들어가거나 주담대를 끼고 삽니다. 지금 사는 칸에는 내 모습이 서 있습니다') +
      sec('chart', '주식 · 코인', [c('chart', '장 보기'), c('wallet', '내 보유'), c('cart', '사기'), c('sell', '팔기'), c('percent', '수수료'), c('bolt', '배율'), c('skull', '청산'), c('play', '코인 연습')], '주식은 찜질방부터. 종목을 누르면 차트가 뜨고 몇 주를 살지 골라 삽니다(직접 적어도 됩니다). 종목은 사는 곳을 따라 늘어납니다 — 튼튼은행은 일요일마다 배당, 꿀잼게임즈는 신작 출시 날 급등 · 급락, 뚝딱건설은 부동산 시세를 따라갑니다') +
      sec('news', '뉴스·공부', [dots(3, '공시'), dots(2, '기사'), dots(1, '찌라시'), c('up', '호재'), c('down', '악재'), c('eye', '리포트가 본 방향'), c('book', '투자 공부 단계')], '오늘 소식은 아침 장 전에 이미 값에 들어가 있습니다. 공부 = 한 칸과 체력을 써서 고른 종목의 내일을 미리 봅니다. 공부가 쌓이면 단계가 올라 더 잘 맞고(' + Math.round(tune.study_acc * 100) + '% → ' + Math.round((tune.study_acc + 3 * tune.know_acc_step) * 100) + '%), 두 종목을 읽고, 부동산 전망 · 속보 경보가 열립니다') +
      sec('building', '부동산 · 은행 · 가게', [c('building', '상가 · 건물'), c('coin', '임대수익'), c('shield', '신용등급'), c('bank', '마이너스 통장'), c('cart', '사 먹기 · 옷 · 살림')], '상가를 사 두면 일요일 밤마다 임대수익이 들어옵니다(세입자가 나가면 잠시 0). 신용등급은 정산을 제때 내면 오르고, 대출 한도 · 이자 · 주담대로 빌릴 수 있는 몫을 정합니다. 가게에서는 하루 한 번 사 먹어 체력을 채우고, 옷(입은 한 벌만 효과)과 살림을 삽니다') +
      '</div><div class="foot"><button class="btn small" data-do="fxtoggle" title="폭죽 · 흔들림 · 도장 · 동전을 끕니다">' + I(meta.fxOff ? 'check' : 'sparkle', '', 's') + '효과 줄이기: ' + (meta.fxOff ? '켜짐' : '꺼짐') + '</button><span style="flex:1"></span><button class="btn main" data-do="ok">닫기 <span class="key">Space</span></button></div></div>';
  }


  // ── 제목 · 결과 · 등장물 ──
  function renderTitle() {
    const s = hasSave(), total = R.achList().length;
    $('s-title').innerHTML = '<div class="bg">' + art('title') + '</div><div class="t-box"><div class="tag">무일푼에서 한국 최고 부자까지</div><h1>서울역<br>상태창</h1>' +
      '<div class="lead">서울역 벤치에서 눈을 떴더니 나에게만 보이는 상태창이 떴다. 꿈 하나를 품고 알바로 버티고, 방을 구하고, 내 집을 사고, 사업과 건물을 키워 한국 최고 부자가 되어라.</div>' +
      '<div class="t-form"><label for="name">이름</label><input id="name" maxlength="8" placeholder="나" value="' + esc(ui.name) + '" autocomplete="off"><label for="code" title="같은 코드면 같은 시세의 판이 시작됩니다">' + I('dice', '', 's') + '판 코드</label><input id="code" maxlength="7" placeholder="비우면 새 판" autocomplete="off"></div>' +
      '<div class="t-looks" title="후드 색 — 꾸미기만 (효과 없음). 옷은 판 안의 가게에서 삽니다"><label>후드 색</label>' + [0, 1, 2, 3].map(n => '<button class="look' + ((meta.look || 0) === n ? ' on' : '') + '" data-do="look" data-arg="' + n + '" title="' + ['파랑', '빨강', '초록', '회색'][n] + '">' + art('hero', '', n) + '</button>').join('') + '</div>' +
      '<div class="t-hint">판 코드: 같은 코드면 같은 시세의 판 (결과 카드에 적힘) · 오늘의 판: 오늘은 누구나 같은 판</div>' +
      '<div class="t-btns">' + (s ? '<button class="btn main" data-do="continue">이어하기 (' + s.day + '일째) <span class="key">Enter</span></button>' : '') +
      '<button class="btn' + (s ? (ui.askNew === 'new' ? ' warm' : '') : ' main') + '" data-do="new">' + (ui.askNew === 'new' ? '하던 판을 지우고 새로 시작' : '새로 시작') + (s ? '' : ' <span class="key">Enter</span>') + '</button>' +
      '<button class="btn' + (ui.askNew === 'daily' ? ' warm' : '') + '" data-do="daily" title="오늘 날짜로 정해지는 판 — 누구나 같은 시세">' + I('calendar') + (ui.askNew === 'daily' ? '하던 판을 지우고 오늘의 판' : '오늘의 판') + '</button></div>' +
      '<div class="rec"><button class="chip go" data-do="help">' + I('help', '', 's') + '도움말</button>' + (GUIDE ? '<button class="chip go" data-do="tuttoggle" title="' + (meta.tut === 2 ? '끝냈거나 끈 안내입니다 — 누르면 다음 새 판에서 다시 봅니다' : '새 판을 시작하면 첫날을 따라가며 알려 줍니다 (하던 판에는 뜨지 않음) — 누르면 끕니다') + '">' + I('info', '', 's') + '첫 판 안내 ' + (meta.tut === 2 ? '꺼짐' : '켜짐') + '</button>' : '') + '<button class="chip go" data-do="achs">' + I('trophy', '', 's') + '업적 ' + achCount() + ' / ' + total + '</button>' + recChips() + '</div>' +
      '<div class="t-keys"><b>마우스</b>만으로 전부 됩니다. 키보드: <b>1~6</b> 고르기 · <b>Space</b> 넘기기 · <b>M</b> 소리</div></div>';
  }
  function renderResults() {
    const e = S.ended, st = S.stats, a = S.act1; // 끝은 한국 최고 부자 선언 하나뿐 (실패 결과 화면은 없다)
    const stat = (ic, title, val, c) => '<div>' + I(ic, '', 's') + '<span>' + title + '</span><b' + (c ? ' class="' + c + '"' : '') + '>' + val + '</b></div>'; // 결과 화면은 한 번 읽는 곳이라 이름을 붙여 둠
    const got = R.achList().filter(x => ui.newAch.indexOf(x.id) >= 0);
    $('s-results').innerHTML = '<div class="bg">' + art('ending', 'top') + '</div><div class="e-box corner">' +
      '<h2>최종 퀘스트 완료</h2><h1>한국 최고 부자</h1><div class="rank" title="며칠 만에 선언했는지로 정해지는 등급 (' + tune.rank_s + '일까지 S · ' + tune.rank_a + '일까지 A · ' + tune.rank_b + '일까지 B)">' + e.rank + '</div>' +
      '<p class="grades">등급: S ' + tune.rank_s + '일 · A ' + tune.rank_a + '일 · B ' + tune.rank_b + '일 안, 그 뒤는 C</p>' +
      '<p>' + esc(S.name) + ' 님은 <b class="gold">' + e.day + '일 만에</b> 순자산 ' + won(e.worth) + eokTag(e.worth) + '으로 한국 최고 부자를 선언했습니다.' + (a ? ' 서울역 벤치에서 내 집까지 ' + a.day + '일(' + a.rank + '), 거기서 호텔 맨 위층까지 ' + (e.day - a.day) + '일.' : '') + '</p>' +
      (S.dream ? '<p class="epi" title="꿈: ' + esc(R.dreamView(S).name) + '">' + I('star', '', 's') + ' ' + esc(R.dreamView(S).end) + '</p>' : '') +
      '<div class="e-stats">' + stat('coin', '알바 · 사업', won(st.alba)) + stat('chart', '투자', sign(st.trade), cls(st.trade)) + stat('bill', '고정비', won(st.fixed)) +
      stat('rocket', '사업', R.BIZ[S.biz || 0].name) + stat('skull', '압류', (st.foreclosed || 0) + '번') + stat('star', '레벨', 'Lv.' + S.lv) + '</div>' +
      '<div class="e-card"><pre>' + esc(R.resultCard(S, 'end')) + '</pre><button class="btn" data-do="copy" title="결과 카드를 복사해 붙여 넣을 수 있습니다">' + I('copy') + '복사</button></div>' +
      (got.length ? '<div class="e-new">' + got.map(a => '<span class="chip hot" title="' + a.hint + '">' + I(a.icon, '', 's') + a.name + '</span>').join('') + '</div>' : '') +
      '<div class="foot"><button class="btn main" data-do="again">다시 하기 <span class="key">Enter</span></button><i>' + I('trophy', '', 's') + ' 업적 ' + achCount() + ' / ' + R.achList().length + ' · 판 코드로 같은 판을 다시 할 수 있습니다</i></div></div>';
  }
  function renderFigures() {
    const figs = (art('figures') || []), icons = (art('icons') || []);
    $('s-figures').innerHTML = '<div class="figs">' + figs.map(f => '<div class="fig"><div class="p">' + f.svg + '</div>' + esc(f.name) + '</div>').join('') + '</div>';
    const box = $('s-figures').firstChild;
    let sp = [];
    try { sp = window.Minigames && window.Minigames.sprites ? window.Minigames.sprites() : []; } catch (e) { sp = []; }
    for (const s of sp) {
      const d = document.createElement('div'); d.className = 'fig';
      d.innerHTML = '<div class="p"><canvas width="200" height="124" style="width:100px;height:62px"></canvas></div>' + esc(s.name);
      box.appendChild(d);
      const c = d.querySelector('canvas').getContext('2d');
      try { // 게임 안 크기로 따로 그린 뒤, 그려진 부분만 잘라 칸에 맞춤 (등장물마다 크기가 달라서)
        const off = document.createElement('canvas'); off.width = 560; off.height = 440;
        const o = off.getContext('2d'); s.draw(o, 280, 220, 1);
        const px = o.getImageData(0, 0, 560, 440).data; let x0 = 560, y0 = 440, x1 = 0, y1 = 0;
        for (let y = 0; y < 440; y += 2) for (let x = 0; x < 560; x += 2) if (px[(y * 560 + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 > x0 && y1 > y0) { const w = x1 - x0 + 4, h = y1 - y0 + 4, k = Math.min(186 / w, 114 / h, 1.6); c.drawImage(off, x0 - 2, y0 - 2, w, h, (200 - w * k) / 2, (124 - h * k) / 2, w * k, h * k); }
      } catch (e) { /* 그리기 실패는 넘어감 */ }
    }
    for (const n of icons) { const d = document.createElement('div'); d.className = 'fig icn'; d.title = n; d.innerHTML = '<div class="p">' + art('icon', n) + '</div>'; box.appendChild(d); }
  }

  function render() {
    if (scene !== 'play') return;
    renderHud(); renderMe(); renderQuest(); renderToday(); renderBoard();
  }

  // ── 고정 간격 걸음 ──
  function step() {
    if (ui.guard > 0 && --ui.guard === 0) { $('veil').classList.remove('arming'); $('coach').classList.remove('arming'); }
    let n = 0;
    while (hit.length && n++ < 8) key(hit.shift());
    const m = ui.modal;
    if (scene === 'play' && m && m.type === 'mg' && m.pre) { if (m.whyT && --m.whyT === 0) { m.why = ''; renderVeil(); } if (!m.still) { try { m.demo.update(STEP); litKeys(m); } catch (e) { m.still = true; } } } // 시연은 판 상태 · 게임 난수를 건드리지 않는다
    else if (scene === 'play' && m && m.type === 'mg' && !m.res) {
      try { m.mg.update(STEP); } catch (e) { m.mg.done = true; m.mg.result = m.mg.result || { score: 0.5 }; }
      if (m.mg.done) finishMg();
    }
    if (scene === 'play' && S) { // 위쪽 띠의 현금 · 순자산은 값이 바뀌면 굴러서 따라감 (도박장 주사위가 구르는 동안은 결과가 새지 않게 멈춤)
      stepDen(); stepDrill();
      if (!(m && m.type === 'den' && m.roll)) {
        const w = R.worth(S);
        if (rolls.cash.to !== S.cash) bump('cash');
        if (rolls.worth.to !== w) bump('worth');
        rollTo('cash', S.cash, 'cash', won); rollTo('worth', w, 'worth', won);
      }
      stepRolls(); ui.cash = rolls.cash.v; ui.worth = rolls.worth.v;
      if (ui.sayT > 0 && --ui.sayT === 0) { const el = document.querySelector('.q-say'); if (el) el.classList.add('old'); } // 시스템의 한마디는 잠깐 밝다가 흐려짐
    }
    const box = $('toasts');
    for (let i = box.children.length - 1; i >= 0; i--) if (--box.children[i]._life <= 0) box.children[i].remove();
    if (ui.toastQ.length && S) ui.toastQ = ui.toastQ.filter(q => q[3] == null || S.day - q[3] <= 1); // 이틀 넘게 기다린 알림은 버림 — 줄 전체에서 (앞에 새 알림이 끼어도 뒤의 낡은 것이 남지 않게). 업적은 업적 창에 남아 있음
    if (ui.toastQ.length && box.children.length < toastCap() && !busy()) { const q = ui.toastQ.shift(); toast(q[0], q[1], q[2], q[3]); } // 미뤄 둔 알림을 차례로
    stepFx();
    if (ui.coachDirty) { ui.coachDirty = false; try { renderCoach(); } catch (e) { $('coach').className = 'hide'; } } // 화면이 다시 그려진 뒤에 자리를 잰다 (안내의 오류가 판을 멈추지 않게)
  }
  function bump(id) { const el = $(id); if (!el || calm() || el.classList.contains('bump')) return; el.classList.add('bump'); el.addEventListener('animationend', () => el.classList.remove('bump'), { once: true }); } // 굴러가기 시작할 때 한 번 튐
  let last, acc = 0;
  function tick() {
    const now = clock.now();
    acc += Math.min(now - last, 0.25); last = now;
    while (acc >= STEP) { step(); acc -= STEP; }
    drawMg(); drawFx();
  }
  function frame() { try { tick(); } finally { requestAnimationFrame(frame); } } // 한 번의 오류가 화면을 멈추지 않게
  function timer() { if (document.visibilityState === 'visible' && clock.now() - last > 0.1) tick(); }

  // ── 점검이 읽고 움직이는 것 (?manual=1 이면 스스로 돌지 않음) ──
  window.game = {
    get scene() { return scene; },
    get state() {
      if (!S) return { scene };
      return { day: S.day, slot: S.slot, phase: S.phase, cash: S.cash, worth: R.worth(S), hp: S.hp, tier: S.tier, quest: S.quest, title: S.title, lv: S.lv, combo: S.combo, modal: ui.modal ? ui.modal.type : '', guard: ui.guard, coach: (coachNow() || {}).id || '', pre: !!(ui.modal && ui.modal.pre), int: ui.modal && ui.modal.type === 'mg' ? ui.modal.n : -1, tut: ui.tut, ended: S.ended, goal: !!(S.ended && S.ended.kind === 'top'), act1: S.act1, next: R.goalView(S), housePrice: R.housePrice(S), rolling: rolling(), den: ui.modal && ui.modal.type === 'den' ? { rolling: !!ui.modal.roll, fin: ui.modal.fin, amt: ui.modal.amt, res: ui.modal.res } : null, drill: ui.modal && ui.modal.type === 'drill' ? { beat: ui.modal.beat, ph: ui.modal.ph, res: ui.modal.res, why: ui.modal.why } : null, queue: ui.queue.map(q => q.type), raw: S };
    },
    press(code) { hit.push(code); },
    hold() { /* 이 게임은 누르고 있는 조작이 없음 */ },
    get events() { return events; },
    step(n, draw) { for (let i = 0; i < (n || 1); i++) step(); if (draw !== false) { drawMg(); drawFx(); } },
    run, // 점검용: 버튼과 같은 길
    render, // 점검용: 상태를 손으로 고친 뒤 다시 그림
    get mg() { return ui.modal && ui.modal.type === 'mg' ? ui.modal.mg : null; }, // 점검용: 지금 하는 미니게임 (시작 전에는 null)
    get demo() { return ui.modal && ui.modal.type === 'mg' && ui.modal.pre && !ui.modal.still ? ui.modal.demo : null; }, // 점검용: 시작 전 화면의 시연
    get fx() { return { parts: fx.parts.length, off: calm() }; }, // 점검용: 떠 있는 효과 입자 수
    get meta() { return meta; },
  };

  renderTitle();
  try { document.fonts.load('16px DungGeunMo').then(() => { if (scene === 'play') render(); ui.coachDirty = true; }, () => {}); } catch (e) { /* 글꼴을 못 불러도 게임은 됨 */ } // 둥근모꼴이 늦게 들어오면 한 번 더 그려 자리(말풍선 · 길)를 다시 잼
  const first = params.get('scene') || 'title';
  if (first === 'figures') { renderFigures(); show('figures'); }
  else if (first === 'play') { newGame(); }
  else show('title');
  last = clock.now();
  if (!MANUAL) { requestAnimationFrame(frame); setInterval(timer, 50); }
})();
