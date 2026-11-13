// PROTOTYPE - NOT FOR PRODUCTION
// Question: 상태창이 시키는 대로 알바 → 방 → 투자 → 집으로 올라가는 한 판이, 뭘 해야 할지 늘 분명하면서 20분 동안 재미있는가?
// Date: 2026-11-13
// 화면과 입력. 규칙은 rules.js, 그림은 art.js, 미니게임은 minigames.js, 조율 값은 config.js.
// play 화면은 구역 다섯 개(hud · me · quest · today · board)로 나뉘고, 글 대신 아이콘(Art.icon)을 쓴다. 아이콘의 뜻은 title 과 도움말(?)에 있다.
// 처음 하는 사람에게는 첫 판 안내(coach)가 첫날을 따라가며 한 곳씩 짚어 주고, 처음 하는 알바는 하는 법부터 보여 준다.
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
  for (const k in PAL) document.documentElement.style.setProperty('--' + k, PAL[k]);
  document.documentElement.style.setProperty('--font', FONT);

  let scene = 'title', S = null; // S = 규칙의 상태 (window.game.state 가 요약해서 보여 줌)
  const ui = { tab: 'ladder', sel: 'daejang', lev: 2, share: 0.25, from: null, askNew: false, modal: null, queue: [], guard: 0, mute: false, fresh: {}, flash: {}, cash: 0, worth: 0, flyN: 0, name: '', ending: false, say: null, sayT: 0, newAch: [], tut: false, coach: '', coachDirty: false };

  // 판 밖에 남는 것: 업적 · 기록 · 설정 (판 저장과 따로)
  function loadMeta() {
    const d = { ach: {}, runs: 0, wins: 0, bestDay: 0, bestRank: '', bestPct: 0, fxOff: false, tut: 0, seen: {} }; // tut: 첫 판 안내를 0 안 봄 · 1 보는 중 · 2 끝냄(또는 끔). seen: 한 번씩만 뜨는 설명 중 본 것
    if (MANUAL) return d;
    try { Object.assign(d, JSON.parse(localStorage.getItem(META) || '{}')); } catch (e) { /* 못 읽으면 처음부터 */ }
    if (!d.seen || typeof d.seen !== 'object') d.seen = {};
    return d;
  }
  const meta = loadMeta();
  function saveMeta() { if (MANUAL) return; try { localStorage.setItem(META, JSON.stringify(meta)); } catch (e) { /* 저장을 못 써도 게임은 됨 */ } }
  const achCount = () => Object.keys(meta.ach).length;
  const GUIDES = ['flyer', 'loading', 'store', 'delivery', 'stock', 'coin']; // 한 번씩만 뜨는 설명: 알바 하는 법 넷 · 주식 · 코인
  function guideOff() { meta.tut = 2; for (const id of GUIDES) meta.seen[id] = 1; saveMeta(); }
  function guideOn() { meta.tut = 0; meta.seen = {}; saveMeta(); }

  const A = window.Art || {};
  function art(fn) { try { return A[fn] ? A[fn].apply(A, Array.prototype.slice.call(arguments, 1)) : ''; } catch (e) { return ''; } }
  const I = (n, title, cls) => '<span class="ic' + (cls ? ' ' + cls : '') + '"' + (title ? ' title="' + title + '"' : '') + '>' + art('icon', n) + '</span>'; // 아이콘 (뜻은 title 로)
  const won = R.won;
  const pct = (v, d) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(d == null ? 1 : d) + '%';
  const sign = n => (n >= 0 ? '+' : '') + won(n);
  const cls = v => (v > 0 ? 'up' : v < 0 ? 'down' : 'dim');
  const arrow = (v, title) => '<span class="' + cls(v) + '">' + I(v > 0 ? 'up' : 'down', title || (v > 0 ? '오름' : '내림'), 's') + '</span>';
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ── 화면 맞춤: 1280×720 을 창에 맞춰 통째로 ──
  function fit() {
    const k = Math.min(innerWidth / 1280, innerHeight / 720);
    stage.style.transform = 'translate(' + Math.round((innerWidth - 1280 * k) / 2) + 'px,' + Math.round((innerHeight - 720 * k) / 2) + 'px) scale(' + k + ')';
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
  };

  // ── 손맛: 폭죽 · 흔들림 (고정 걸음으로 돈다. "효과 줄이기"나 OS 의 움직임 줄이기면 꺼짐) ──
  const fx = { parts: [], seed: 20261113, dirty: false };
  const calm = () => meta.fxOff || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const fr = () => (fx.seed = (Math.imul(fx.seed, 1664525) + 1013904223) >>> 0) / 4294967296; // 효과 전용 난수 (게임 난수와 무관)
  function burst(x, y, n, spread) {
    if (calm()) return;
    const cols = [PAL.gold, PAL.sys, PAL.up, PAL.good, PAL.warm, PAL.text];
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (fr() - 0.5) * spread, v = 240 + fr() * 460; fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.9 + fr() * 0.8, c: cols[i % cols.length], s: 5 + fr() * 6, r: fr() * 6 }); }
  }
  function stepFx() {
    if (!fx.parts.length) return;
    for (const p of fx.parts) { p.vy += 900 * STEP; p.x += p.vx * STEP; p.y += p.vy * STEP; p.life -= STEP; p.r += 8 * STEP; }
    fx.parts = fx.parts.filter(p => p.life > 0 && p.y < 760);
    fx.dirty = true;
  }
  function drawFx() {
    if (!fx.dirty) return;
    const c = $('fxc').getContext('2d');
    c.clearRect(0, 0, 1280, 720);
    for (const p of fx.parts) { c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.globalAlpha = Math.min(1, p.life * 2); c.fillStyle = p.c; c.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66); c.restore(); }
    fx.dirty = fx.parts.length > 0;
  }
  function shake() { if (calm()) return; const el = $('s-play'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

  // ── 입력: 키는 한 걸음에 하나씩 처리, 클릭은 data-do 로 ──
  const hit = [];
  const hold = n => { ui.guard = Math.max(ui.guard, n); }; // n 걸음 동안 누름을 버림 (60걸음 = 1초)
  const rearm = () => hold(15); // 창이 막힌 동안 또 누르면 조금 더 막는다: 연타로는 안 넘어가고, 멈췄다 눌러야 넘어간다
  const GUARD = { night: 36, quest: 36, tier: 36, liq: 36, intro: 36, perk: 30, event: 24, confirm: 24 }; // 창마다 처음 막는 걸음 수
  addEventListener('keydown', e => {
    startAudio();
    if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Enter') { e.preventDefault(); hit.push('Enter'); } return; }
    if (e.repeat) return;
    hit.push(e.code);
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
  });
  const mgPress = code => { try { ui.modal.mg.press(code); } catch (e) { /* 미니게임의 오류가 판을 멈추지 않게 */ } };
  stage.addEventListener('pointerdown', e => {
    startAudio();
    const m = ui.modal;
    if (!m || m.type !== 'mg' || m.res || m.wait) return;
    const b = e.target.closest('[data-mg]'); // 미니게임 버튼은 누르는 순간 반응
    if (b) { mgPress(b.dataset.mg); e.preventDefault(); return; }
    if (e.target.id === 'mgc') { // 그림을 직접 눌러도 됨: 가로로 나눈 칸이 조작 버튼 순서와 같다
      const cs = m.mg.controls || [], r = e.target.getBoundingClientRect();
      if (cs.length) { mgPress(cs[clamp(Math.floor((e.clientX - r.left) / r.width * cs.length), 0, cs.length - 1)].code); e.preventDefault(); }
    }
  });
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
    $('fx').innerHTML = ''; $('toasts').innerHTML = ''; ui.coachDirty = true;
  }
  function hasSave() { if (MANUAL) return null; try { return R.load(localStorage.getItem(SAVE) || ''); } catch (e) { return null; } }
  function newGame(seed) {
    seed = seed || Number(params.get('seed'));
    if (!seed) {
      let runs = 0;
      if (!MANUAL) try { runs = Number(localStorage.getItem(RUNS)) || 0; localStorage.setItem(RUNS, String(runs + 1)); } catch (e) { /* 저장을 못 써도 게임은 됨 */ }
      seed = CONFIG.seed + runs * 101; // 판마다 시세가 다르게
    }
    S = R.create(seed, ui.name);
    ui.tut = GUIDE && meta.tut !== 2; // 안내를 끝낸 적이 없으면 첫날을 따라가며 알려 준다
    const mark = ui.tut ? 1 : meta.tut === 1 ? 0 : meta.tut; // "보는 중"(1)은 늘 지금 판을 가리킨다: 안내 없이 연 새 판이 보던 판을 갈아 치우면 "안 봄"으로 되돌림
    if (mark !== meta.tut) { meta.tut = mark; saveMeta(); }
    begin();
  }
  function begin() {
    ui.tab = 'ladder'; ui.sel = 'daejang'; ui.fresh = {}; ui.flash = {}; ui.queue = []; ui.modal = null; ui.ending = false; ui.say = null; ui.sayT = 0; ui.newAch = [];
    if (S.pending) { const id = S.pending; S.pending = null; if (R.doJob(S, id, null)) S.log.push({ day: S.day, text: '하다 만 알바는 대충 한 것으로 처리했습니다.', tone: 'warn' }); }
    const missed = (S.ach || []).filter(id => !meta.ach[id]); // 알림이 뜨기 전에 새로 고쳐서 판 저장에만 남은 업적
    if (missed.length) { for (const id of missed) meta.ach[id] = 1; saveMeta(); }
    ui.cash = S.cash; ui.worth = R.worth(S);
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
      else if (what === 'tuttoggle') {
        if (meta.tut === 2) { guideOn(); toast(I('info') + '<span>새 판을 시작하면 첫날을 따라가며 알려 줍니다</span>', 'tip', 260); }
        else { guideOff(); toast(I('info') + '<span>첫 판 안내를 껐습니다</span>', 'tip', 200); }
        sfx.click(); renderTitle();
      }
      return;
    }
    if (scene === 'results') {
      if (what === 'again') { sfx.click(); ui.askNew = false; renderTitle(); show('title'); }
      else if (what === 'copy') copyCard();
      return;
    }
    if (scene !== 'play') return;
    if (m) { // 창이 떠 있으면 창의 버튼만
      if (what === 'ok') closeModal(true);
      else if (what === 'no') closeModal(false);
      else if (what === 'mgstart' && m.type === 'mg' && m.wait) { m.wait = false; m.mg.idle = false; meta.seen[m.id] = 1; saveMeta(); S.pending = m.id; saveNow(); sfx.click(); renderVeil(); }
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
    if (what === 'tab') { ui.tab = arg; ui.fresh[arg] = false; sfx.click(); renderQuest(); renderBoard(); return; }
    if (what === 'sel') { ui.sel = arg; sfx.click(); renderBoard(); return; }
    if (what === 'lev') { ui.lev = Number(arg); sfx.click(); renderBoard(); return; }
    if (what === 'share') { ui.share = Number(arg); sfx.click(); renderBoard(); return; }
    if (what === 'job') { startJob(arg); return; }
    if (what === 'skip') { if (R.doJob(S, arg, null)) { sfx.pay(); hold(20); } else deny('체력이 모자랍니다'); done(); return; }
    if (what === 'rest') { if (R.doRest(S)) { sfx.click(); hold(20); } done(); return; }
    if (what === 'study') { if (R.doStudy(S)) { sfx.ding(); hold(20); if (ui.tab === 'ladder') ui.tab = 'stock'; } done(); return; }
    if (what === 'endday') { // 그냥 자면 손해가 나는 밤은 한 번 더 묻는다 (Space 연타로 넘어가지 않게)
      const b = R.bill(S), short = b && b.inDays === 0 && S.cash < b.amt, lastDay = S.day >= tune.days;
      if (S.slot >= 3 && (short || lastDay)) { openModal({ type: 'confirm', kind: 'sleep', short, lastDay, b }); return; }
      sleepNow(); return;
    }
    if (what === 'buy') { const amt = arg === 'all' ? S.cash : Number(arg); if (R.buy(S, ui.sel, amt)) sfx.click(); done(); return; }
    if (what === 'sell') { if (R.sell(S, ui.sel, Number(arg))) sfx.pay(); done(); return; }
    if (what === 'long' || what === 'short') { if (R.levOpen(S, what === 'long' ? 1 : -1, Math.floor(S.cash * ui.share), ui.lev)) { sfx.click(); hold(24); } done(); return; }
    if (what === 'close') { if (R.levClose(S)) { sfx.pay(); hold(24); } done(); return; }
    if (what === 'move') {
      const to = Number(arg), info = R.moveInfo(S, to);
      if (!info.ok) { deny(info.why); return; }
      if (to === 1) { R.move(S, to); sfx.up(); hold(20); done(); return; }
      openModal({ type: 'confirm', kind: 'move', to, info });
      return;
    }
    if (what === 'house') {
      if (R.worth(S) < R.housePrice(S)) { deny('순자산이 집값에 못 미칩니다'); return; }
      openModal({ type: 'confirm', kind: 'house' });
    }
  }
  function sleepNow() {
    if (!R.endDay(S)) return;
    const down = S.ev.splice(0).some(e => e.t === 'tier' && !e.up && e.from >= 2); // 밤의 사건은 정산 창이 보여 주므로 비우되, 쫓겨난 것은 흔들림으로도 알림
    openModal({ type: 'night', sum: S.last }); render();
    if (down) { sfx.bad(); shake(); } else sfx.night();
  }
  function done() { drain(); render(); if (!S.ended && !(ui.modal && ui.modal.type === 'mg')) saveNow(); } // 행동 하나마다 저장 (새로 고쳐서 되돌리기 없음)
  function toast(html, kind, life) {
    const box = $('toasts');
    for (const o of box.children) if (o._key === html) { o._life = life || 240; return; } // 같은 말은 쌓지 않고 시간만 다시 잰다
    const d = document.createElement('div');
    d.className = 'toast ' + (kind || ''); d.innerHTML = html; d._key = html; d._life = life || 240;
    box.appendChild(d);
    while (box.children.length > 3) box.firstChild.remove();
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
      if (m.type === 'mg' && !m.res) { if (!m.wait) mgPress(code); else if (ui.guard === 0 && (code === 'Space' || code === 'Enter')) run('mgstart'); return; }
      if (ui.guard > 0) { rearm(); return; }
      if (m.type === 'perk') { const o = d && S.offer && S.offer[Number(d[1]) - 1]; if (o) run('perk', o); return; } // 특성은 꼭 하나 골라야 닫힘
      if (m.type === 'event' && !m.done) { if (d && d[1] === '1') run('ev', 'a'); else if (d && d[1] === '2') run('ev', 'b'); return; }
      if (m.type === 'confirm') { if (code === 'Enter') closeModal(true); else if (code === 'Space' || code === 'Escape') closeModal(false); return; } // 확인 창은 늘 같다: Enter = 한다, Space · Esc = 돌아간다 (연타해도 안전한 쪽)
      if (code === 'Space' || code === 'Enter') closeModal(true);
      return;
    }
    if (ui.guard > 0) return;
    const c = coachNow();
    if (c && c.ok) { if (code === 'Space' || code === 'Enter') run('coachok'); else if (d) nudge(); return; } // 읽고 넘기는 안내 (숫자 키로 다른 것을 고르려 하면 무엇을 누를지 알려 줌)
    if (d && S.slot < 3) { const a = R.acts(S)[Number(d[1]) - 1]; if (a && !a.ok) deny(a.why); else if (a) run(a.kind === 'job' ? 'job' : a.kind, a.id); return; }
    if (code === 'Space' && S.slot >= 3) run('endday'); // Enter 는 확인 창의 "한다"라서 여기서는 안 받음
  }

  // ── 규칙이 쌓아 둔 사건을 화면으로 ──
  function drain() {
    const evs = S.ev.splice(0);
    const homeQuest = evs.some(e => e.t === 'quest_done' && /^(roof|address|oneroom)$/.test(e.quest.id)); // 이사로 끝난 퀘스트 창이 "열림"을 이미 알려 줌
    const flies = [], quests = { done: [], skipped: [], next: null, at: -1 }; // 한꺼번에 끝난 퀘스트는 창 한 장으로 모은다
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      events.push(e);
      if (e.t === 'money' && e.amt > 0) flies.push(['+' + won(e.amt), 'gold', null]);
      else if (e.t === 'tick') { for (const id in e.chg) ui.flash[id] = e.chg[id]; stamps(e.chg); }
      else if (e.t === 'while') flies.push([sign(e.delta), cls(e.delta), { x: 860, y: 330 }]);
      else if (e.t === 'quest_done') { quests.done.push(e.quest); quests.next = null; if (quests.at < 0) quests.at = ui.queue.length; }
      else if (e.t === 'quest_skip') { quests.skipped.push(e.quest); quests.next = null; }
      else if (e.t === 'quest_new') { quests.next = e.quest; ping(); } // 마지막에 나온 것이 지금 할 퀘스트
      else if (e.t === 'intro') ui.queue.push({ type: 'intro', next: e.quest });
      else if (e.t === 'perk') ping();
      else if (e.t === 'tier') {
        if (e.up && e.to === 2) ui.fresh.stock = true;
        if (e.up && e.to === 3) ui.fresh.coin = true;
        if (e.up && !homeQuest) ui.queue.push({ type: 'tier', e });
      }
      else if (e.t === 'liq') { ui.queue.push({ type: 'liq', e }); shake(); }
      else if (e.t === 'deny') deny(e.why);
      else if (e.t === 'sys') { ui.say = e; ui.sayT = 420; ping(); }
      else if (e.t === 'ending') ui.ending = true;
      else if (e.t === 'ach') { ui.newAch.push(e.id); if (!meta.ach[e.id]) { meta.ach[e.id] = 1; saveMeta(); } toast(I(e.icon) + '<div><span>업적</span><b>' + esc(e.name) + '</b></div>', '', 300); sfx.ding(); }
    }
    if (quests.done.length) ui.queue.splice(quests.at, 0, { type: 'quest', done: quests.done, skipped: quests.skipped, next: quests.next });
    else for (const q of quests.skipped) toast(I('skip') + '<div><span>때가 지나 건너뛴 퀘스트</span><b>' + esc(q.title) + '</b></div>', '', 300);
    if (!ui.modal && !ui.queue.length && !S.offer && !S.event && !ui.ending) for (const f of flies) fly(f[0], f[1], f[2]); // 창이 뜰 참이면 창 위에 겹치므로 내지 않음 (숫자는 위쪽 띠에서 굴러감)
    pump();
  }
  function pump() { // 뜰 창이 남았으면 하나씩: 알림 → 특성 고르기 → 돌발 사건 → 엔딩
    if (ui.modal) return;
    if (ui.queue.length) { openModal(ui.queue.shift()); return; }
    if (S && !S.ended && S.offer) { openModal({ type: 'perk' }); return; }
    if (S && !S.ended && S.event) { openModal({ type: 'event', view: R.eventView(S), done: null }); return; }
    if (ui.ending) finish();
  }
  function finish() {
    ui.ending = false; hold(45); clearSave();
    const e = S.ended, home = e.kind === 'home';
    meta.runs++; if (home) { meta.wins++; if (!meta.bestDay || e.day < meta.bestDay) { meta.bestDay = e.day; meta.bestRank = e.rank; } } else meta.bestPct = Math.max(meta.bestPct || 0, e.pct);
    saveMeta();
    renderResults(); show('results');
    if (home) { sfx.up(); burst(640, 420, 140, 2.6); } else sfx.bad();
  }
  const clearFlies = () => { for (const e of $('fx').querySelectorAll('.fly')) e.remove(); }; // 떠오르던 숫자가 새로 뜬 창 위에 겹치지 않게
  function openModal(m) {
    clearFlies();
    ui.modal = m; hold(GUARD[m.type] || 18); $('veil').classList.add('arming'); // 0.3~0.6초: 연달아 누른 것이 새 창을 닫지 않게 (그동안 버튼이 흐림)
    if (m.type === 'quest') { sfx.ding(); burst(640, 330, 28, 2.2); }
    else if (m.type === 'perk') { sfx.level(); burst(640, 300, 70, 2.8); }
    else if (m.type === 'tier') sfx.up(); else if (m.type === 'liq') sfx.bad(); else if (m.type === 'intro' || m.type === 'event') sfx.ding();
    renderVeil();
  }
  function closeModal(yes) {
    const m = ui.modal;
    if (!m || m.type === 'perk' || (m.type === 'event' && !m.done)) return; // 고르기 전에는 닫히지 않음
    hold(16);
    if (m.type === 'mg') { if (!m.res) return; ui.modal = null; ui.from = { x: 640, y: 330 }; renderVeil(); sfx.pay(); done(); return; }
    if (m.type === 'night') { ui.modal = null; R.nextDay(S); if (!S.ended) saveNow(); renderVeil(); done(); return; }
    if (m.type === 'event') { ui.modal = null; renderVeil(); done(); return; }
    if (m.type === 'confirm') {
      ui.modal = null; renderVeil();
      if (yes && m.kind === 'sleep') { sleepNow(); return; }
      if (yes) { if (m.kind === 'move') { if (R.move(S, m.to)) sfx.up(); } else if (m.kind === 'house') R.buyHouse(S); }
      done(); return;
    }
    ui.modal = null; sfx.click(); renderVeil(); pump(); render();
  }
  function ping() { const el = $('quest'); el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping'); }
  function fly(text, color, from) { // 번 자리에서 떠서 위쪽 띠의 현금 칸으로
    const d = document.createElement('div'), o = from || ui.from || { x: 640, y: 200 }, n = ui.flyN++ % 4;
    d.className = 'fly ' + color; d.textContent = text; d.style.animationDelay = (n * 0.1) + 's'; // 여러 개면 줄을 달리하고 조금씩 늦게
    const x = clamp(o.x - 40, 20, 1180), y = clamp(o.y - 30 + n * 34, 70, 660);
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
  function copyCard() { // 결과 카드를 클립보드로 (막혀 있으면 글을 골라 둠)
    const text = R.resultCard(S), ok = () => toast(I('check') + '<span>결과 카드를 복사했습니다</span>', '', 180);
    const pick = () => { const pre = document.querySelector('.e-card pre'); if (!pre) return; const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); try { if (document.execCommand('copy')) ok(); } catch (e) { /* 골라 둔 채로 둠 */ } };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, pick); else pick(); } catch (e) { pick(); }
    sfx.click();
  }

  // ── 미니게임 ──
  function fallbackGame(opts) { // minigames.js 가 없을 때를 위한 가장 단순한 것 (막대가 가운데일 때 누르기)
    const g = { w: 880, h: 380, title: '타이밍', howto: '막대가 가운데일 때 Space', controls: [{ code: 'Space', label: '누르기' }], done: false, result: null, t: 0, hits: 0, tries: 0 };
    g.update = dt => { g.t += dt; if (g.t > opts.seconds + 0.8) { g.done = true; g.result = { score: clamp(g.hits / 5, 0, 1), hits: g.hits, total: 5 }; } };
    g.press = () => { if (g.t < 0.8 || g.tries >= 5) return; g.tries++; if (Math.abs(Math.sin(g.t * 3)) < 0.3) g.hits++; };
    g.draw = c => { c.fillStyle = PAL.night0; c.fillRect(0, 0, 880, 380); c.fillStyle = PAL.night3; c.fillRect(140, 170, 600, 40); c.fillStyle = PAL.good; c.fillRect(390, 170, 100, 40); c.fillStyle = PAL.gold; c.fillRect(436 + Math.sin(g.t * 3) * 290, 150, 8, 80); };
    return g;
  }
  function startJob(id) {
    const a = R.acts(S).find(x => x.id === id);
    if (!a || !a.ok) { deny(a ? a.why : ''); return; }
    const opts = { rng: () => R.rnd2(S), level: a.lv, seconds: tune.mg_seconds, pal: PAL, font: FONT };
    let mg = null;
    try { mg = window.Minigames ? window.Minigames.create(id, opts) : null; } catch (e) { mg = null; }
    if (!mg) mg = fallbackGame(opts);
    sfx.click();
    const wait = GUIDE && !meta.seen[id]; // 처음 하는 알바는 하는 법을 읽고 "시작"을 눌러야 시간이 간다
    if (!wait) { S.pending = id; saveNow(); } // 하다가 새로 고치면 "대충" 한 것으로 처리된다 (하는 법을 읽는 동안은 아직 시작 전이라 칸을 쓰지 않는다)
    clearFlies();
    ui.modal = { type: 'mg', id, act: a, mg, res: null, wait }; ui.guard = 0;
    if (wait) { mg.idle = true; hold(24); $('veil').classList.add('arming'); } // idle: "준비" 띠 없이 첫 장면을 그대로 보여 줌
    renderVeil();
  }
  function finishMg() {
    const m = ui.modal, r = m.mg.result || { score: 0 };
    const score = clamp(Number(r.score) || 0, 0, 1);
    S.pending = null;
    R.doJob(S, m.id, score);
    saveNow();
    const j = S.ev.find(e => e.t === 'job') || { pay: 0, base: 0, grade: 'ok', gradeName: '보통', mult: 1, hp: 0, combo: 0, comboMult: 1, extra: 1 };
    m.res = { j, tip: S.ev.find(e => e.t === 'tip'), wh: S.ev.find(e => e.t === 'while') };
    hold(54); $('veil').classList.add('arming'); // 미니게임을 하던 누름이 결과 창을 닫지 않게 (0.9초)
    if (j.grade === 'miss') sfx.deny(); else if (j.grade === 'perfect') { sfx.up(); burst(640, 300, 36, 2.4); } else sfx.ding();
    renderVeil();
  }
  function drawMg() {
    const m = ui.modal;
    if (!m || m.type !== 'mg') return;
    const cv = $('mgc');
    if (!cv) return;
    const c = cv.getContext('2d');
    c.setTransform(cv.width / m.mg.w, 0, 0, cv.height / m.mg.h, 0, 0);
    try { m.mg.draw(c); } catch (e) { /* 그리기 실패는 판을 멈추지 않는다 */ }
  }

  // ── 첫 판 안내: 한 번에 한 곳만 밝히고 한 줄만 말한다 ──
  // 단계는 판의 상태에서 읽는다 (저장했다 이어 해도 맞는 자리에서 이어진다).
  // ring = 고리를 두를 곳, lit = 고리 없이 밝혀 둘 곳, only = 그 단계에서 받는 누름, ok = 읽고 넘기는 단계의 버튼 글, at = 말풍선 자리.
  const moveOk = () => R.moveInfo(S, 1).ok, flyerOk = () => R.acts(S).some(a => a.id === 'flyer' && a.ok); // 짚은 것을 할 수 없는 상태면 막지 않는다 (갇히지 않게)
  const TODAY = ['job', 'skip', 'rest', 'study', 'why', 'tip']; // 오늘 칸에서 하는 것들
  const COACH = {
    job: { n: 1, at: 'below', ring: ['#today [data-arg="flyer"]'], lit: ['#quest'], only: (w, a) => !flyerOk() || (w === 'job' && a === 'flyer'),
      html: () => '<b>전단지</b>를 눌러 첫 돈을 번다 <span class="key">1</span><i>왼쪽 아래 상태창의 퀘스트가 지금 할 일입니다</i>' },
    slots: { n: 2, at: 'below', ring: ['#today', '#me .me-row'], lit: ['#quest'], only: w => TODAY.indexOf(w) >= 0,
      html: () => '<b>카드를 골라</b> 남은 칸을 쓴다<i>하루는 세 칸입니다. 알바는 체력 ' + I('hp', '', 's') + ' 을 쓰고, 쉬기는 채웁니다. ' + I('skip', '', 's') + ' 는 미니게임 없이 덜 받는 "대충"</i>' },
    endday: { n: 3, at: 'below', ring: ['#today [data-do="endday"]'], lit: ['#quest'], only: w => w === 'endday' || w === 'tip',
      html: () => '다 썼으면 <b>하루 마치기</b> <span class="key">Space</span><i>밤마다 번 돈과 쓴 돈이 한 장으로 정리되고, 자는 동안 체력이 돌아옵니다</i>' },
    move: { n: 4, at: 'right', ring: ['#board .rung:nth-child(2)'], lit: ['#quest'], only: (w, a) => w === 'move' && Number(a) === 1,
      html: () => '<b>옮기기</b>를 눌러 찜질방으로<i>지붕 아래에서 자면 체력이 두 배로 돌아옵니다</i>' },
    earn: { n: 4, at: 'right', ring: ['#board .rung:nth-child(2)'], lit: ['#quest', '#today', '#me', '#hud'], // 찜질방 요금이 없을 때: 막지 않고, 벌 수 있게 오늘 칸을 밝혀 둔다
      html: () => '현금 ' + won(R.saunaCost(S)) + '이 모이면 <b>옮기기</b>가 켜진다<i>그때까지는 알바로 벌어 둡니다</i>' },
    goal: { n: 5, at: 'above', ring: ['#quest', '#hud .goal'], lit: ['#hud [data-do="help"]'], ok: '알겠다',
      html: () => '안내는 여기까지<i>할 일은 늘 이 <b>상태창</b>에 뜹니다. 끝은 위쪽의 집값 ' + I('key', '', 's') + ' — ' + tune.days + '일 안에 순자산으로 따라잡으면 됩니다. 모르는 아이콘은 오른쪽 위 ' + I('help', '', 's') + '</i>' },
    stock: { lab: '주식 — 처음 열었을 때', num: true, at: [660, 78], ring: ['#board .newsbox', '#board .alist', '#board .order'], ok: '알겠다',
      html: () => '<p><u>1</u>소식이 여기 뜬다 — 화살표가 방향, 점이 많을수록 확실</p><p><u>2</u>종목을 고르고</p><p><u>3</u>금액을 눌러 산다. 오르면 판다 — 팔아야 내 돈</p>' },
    coin: { lab: '코인 — 처음 열었을 때', num: true, at: [660, 78], ring: ['#board .levform', '#board .order'], ok: '알겠다',
      html: () => '<p><u>1</u>배율과 걸 돈을 고르고</p><p><u>2</u>오른다 = 롱, 내린다 = 숏</p><i>반대로 가면 건 돈을 전부 잃습니다 (청산). 배율이 높을수록 가깝습니다</i>' },
  };
  for (const id in COACH) COACH[id].id = id;
  function coachNow() {
    if (scene !== 'play' || !S || S.ended || ui.modal || ui.queue.length) return null;
    if (ui.tut) {
      if (S.day === 1) return S.slot >= 3 ? COACH.endday : S.slot === 0 && !S.stats.jobsDone ? COACH.job : COACH.slots;
      return S.tier > 0 ? COACH.goal : moveOk() ? COACH.move : COACH.earn;
    }
    if (!GUIDE) return null;
    if (ui.tab === 'stock' && R.unlocked(S, 'stock') && !meta.seen.stock) return COACH.stock;
    if (ui.tab === 'coin' && R.unlocked(S, 'coin') && !meta.seen.coin && !S.lev) return COACH.coin;
    return null;
  }
  function renderCoach() {
    const box = $('coach'), c = coachNow();
    if (!c) { ui.coach = ''; box.className = 'hide'; box.innerHTML = ''; return; }
    const sr = stage.getBoundingClientRect(), k = 1280 / sr.width, px = v => v.toFixed(1);
    const rect = sel => { const e = document.querySelector(sel), r = e && e.getBoundingClientRect(); return r && r.width ? { x: (r.left - sr.left) * k - 5, y: (r.top - sr.top) * k - 5, w: r.width * k + 10, h: r.height * k + 10 } : null; };
    const rings = c.ring.map(rect).filter(Boolean), holes = rings.concat((c.lit || []).map(rect).filter(Boolean));
    const fresh = ui.coach !== c.id;
    box.className = ''; // 숨긴 채로는 말풍선의 크기를 잴 수 없다
    box.innerHTML = '<svg viewBox="0 0 1280 720"><defs><mask id="cmask"><rect width="1280" height="720" fill="#fff"/>' + holes.map(r => '<rect x="' + px(r.x) + '" y="' + px(r.y) + '" width="' + px(r.w) + '" height="' + px(r.h) + '" rx="12" fill="#000"/>').join('') + '</mask></defs><rect width="1280" height="720" mask="url(#cmask)"/></svg>' +
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
  function howHtml(m) { // 처음 하는 알바: "시작"을 누르기 전에는 시간이 가지 않는다
    const lines = m.mg.how || [m.mg.howto || '']; // how 가 없는 것은 minigames.js 없이 도는 대역(fallbackGame)뿐
    return '<div class="mg-how"><div class="l"><em>처음 하는 알바 — 하는 법</em><ol>' + lines.map(t => '<li>' + esc(t) + '</li>').join('') + '</ol>' +
      '<div class="keys">' + (m.mg.controls || []).map(c => '<span>' + esc(c.label) + ' <span class="key">' + keyName(c.code) + '</span></span>').join('') +
      '<i>화면의 버튼을 눌러도 됩니다 · 잘할수록 일당 ×' + tune.mult_miss + ' ~ ×' + tune.mult_perfect + '</i></div></div>' +
      '<button class="btn main" data-do="mgstart">시작 <span class="key">Space</span></button></div>';
  }

  // ── 구역 hud: 날짜 · 시간 · 돈 · 집 목표 · 단추 ──
  function renderHud() {
    const price = R.housePrice(S), w = R.worth(S), left = tune.days - S.day + 1, p = clamp(w / price, 0, 9.99); // left: 오늘 포함
    $('hud').innerHTML =
      '<div class="zh" title="' + R.weekOf(S.day) + '주차 ' + S.day + '일째">' + I('calendar') + '<b>' + R.weekOf(S.day) + '주</b>' + S.day + '일</div>' +
      '<div class="slots">' + SLOT_IC.map((n, i) => '<span class="' + (i < S.slot ? 'done' : i === S.slot ? 'now' : '') + '" title="' + SLOTS[i] + '">' + art('icon', n) + '</span>').join('') + '</div>' +
      (S.combo ? '<div class="money gold" title="콤보 ' + S.combo + ' — 다음 알바 일당 +' + Math.round((tune.combo_bonus + tune.perk_streak * R.perk(S, 'streak')) * S.combo * 100) + '%. 직접 해서 잘함 이상이면 쌓이고, 실수하거나 대충 하면 끊깁니다"><span class="ic" style="color:var(--gold)">' + art('icon', 'fire') + '</span><b>' + S.combo + '</b></div>' : '') +
      '<div class="grow"></div>' +
      '<div class="money" title="현금">' + I('cash') + '<i>현금</i><b id="cash">' + won(ui.cash) + '</b></div>' +
      '<div class="money" title="순자산 = 현금 + 보증금 + 투자한 돈">' + I('wallet') + '<i>순자산</i><b id="worth">' + won(ui.worth) + '</b></div>' +
      '<div class="goal" title="집값과 거기까지 온 만큼">' + I('key') + '<span>' + won(price) + '</span><div class="bar"><div style="width:' + (Math.min(1, p) * 100).toFixed(1) + '%"></div></div><b>' + Math.floor(p * 100) + '%</b></div>' +
      '<div class="money" title="남은 날 (오늘 포함)">' + I('clock') + '<i>남은</i><b>' + left + '일</b></div>' +
      '<div class="hbtns">' +
      '<button class="btn sq" data-do="achs" title="업적 (숫자는 이번 판에 얻은 수)">' + I('trophy') + (S.ach.length ? '<span class="n">' + S.ach.length + '</span>' : '') + '</button>' +
      '<button class="btn sq" data-do="help" title="도움말">' + I('help') + '</button>' +
      '<button class="btn sq" data-do="mute" title="소리 (M)">' + I(ui.mute ? 'mute' : 'sound') + '</button>' +
      '<button class="btn sq" data-do="quit" title="제목 화면으로 (지금까지는 저장됨)">' + I('home') + '</button></div>';
  }

  // ── 구역 me: 사는 곳 · 체력 · 레벨 · 특성 ──
  function renderMe() {
    const x = R.xpView(S), mx = R.hpMax(S), low = S.hp < 25, perks = R.perksView(S);
    $('me').innerHTML =
      '<div class="zh">' + I('door', '지금 사는 곳') + '<span>' + R.HOMES[S.tier].name + '</span><span class="dim" style="font-weight:400">' + esc(S.name) + ' · ' + esc(S.title) + '</span>' +
      '<span class="r lvb" title="레벨 ' + x.lv + ' — 경험치 ' + x.xp + ' / ' + x.need + '. 오르면 특성을 하나 고릅니다">' + I('star', '', 's') + 'Lv.' + x.lv + '<i class="xpbar"><i style="width:' + (x.xp / x.need * 100).toFixed(0) + '%"></i></i></span></div>' +
      '<div class="scene">' + art('scene', Math.min(3, S.tier), PHASE[Math.min(3, S.slot)]) + '</div>' +
      '<div class="me-row' + (low ? ' low' : '') + '" title="체력 — 알바에 쓰고, 쉬거나 자면 돌아옵니다">' + I('hp') + '<div class="bar"><div style="width:' + (S.hp / mx * 100).toFixed(0) + '%"></div></div><b>' + Math.round(S.hp) + ' / ' + mx + '</b></div>' +
      '<div class="perks">' + (perks.length ? perks.map(p => { const t = esc(p.name + (p.n > 1 ? ' ×' + p.n : '') + ' — ' + p.desc); return '<span class="pk' + (p.n > 1 ? ' x' + p.n : '') + '" data-do="tip" data-arg="' + t + '" title="' + t + '">' + art('icon', p.icon) + '</span>'; }).join('')
        : '<span class="none" title="레벨이 오르면 특성이 여기에 쌓입니다">' + I('star', '', 's') + I('plus', '', 's') + '</span>') + '</div>';
  }

  // ── 구역 quest: 상태창 (지금 퀘스트 하나 · 시스템의 한마디 · 다가오는 것) ──
  function progText(q) { return q.unit === '원' ? won(q.cur) + ' / ' + won(q.goal) : q.cur + ' / ' + q.goal; }
  function renderQuest() {
    const q = R.questView(S), b = R.bill(S), rise = R.riseIn(S), say = ui.say || S.log[S.log.length - 1]; // 시스템의 마지막 한마디 (잠깐 밝다가 흐려짐)
    const go = q && q.go && q.go !== ui.tab && (q.go === 'ladder' || R.unlocked(S, q.go)) ? '<button class="chip hot go" data-do="tab" data-arg="' + q.go + '">' + I({ ladder: 'house', stock: 'chart', coin: 'bolt' }[q.go], '', 's') + ({ ladder: '사다리', stock: '주식', coin: '코인' })[q.go] + '</button>' : '';
    const news = R.unlocked(S, 'stock') ? R.todayNews(S).filter(n => n.asset !== 'coin' || R.unlocked(S, 'coin')).length : 0;
    $('quest').innerHTML =
      '<div class="zh">' + I('quest') + '<span>상태창</span>' + (q ? '<span class="r">' + q.n + ' / ' + q.of + '</span>' : '') + '</div>' +
      (q ? '<div class="q-in"><div class="q-title">' + esc(q.title) + '</div><div class="q-desc">' + esc(q.desc) + '</div>' +
        '<div class="q-prog"><div class="bar"><div style="width:' + (q.pct * 100).toFixed(1) + '%"></div></div><b>' + progText(q) + '</b></div>' +
        '<div class="q-row"><span class="rw" title="끝내면 받는 것">' + I('gift', '', 's') + esc(q.reward) + '</span>' + (q.near ? '<span class="near">거의 다 됨</span>' : '') + go + '</div></div>' : '<div class="q-in"><div class="q-title">모든 퀘스트 완료</div></div>') +
      '<div class="q-line"></div>' +
      (say ? '<div class="q-say ' + (say.tone || '') + (ui.sayT > 400 ? ' in' : ui.sayT === 0 ? ' old' : '') + '">' + esc(say.text) + '</div>' : '') +
      '<div class="q-due">' +
      (b ? '<span class="chip' + (b.inDays <= 1 ? ' hot' : '') + '" title="고정비: ' + (b.inDays === 0 ? '오늘 밤' : b.inDays + '일 뒤 밤') + '에 ' + won(b.amt) + '">' + I('bill', '', 's') + '고정비 ' + (b.inDays === 0 ? '오늘 밤' : 'D-' + b.inDays) + ' ' + won(b.amt) + '</span>' : '') +
      (rise ? '<span class="chip' + (rise <= 1 ? ' hot' : '') + '" title="집값이 ' + rise + '일 뒤에 오릅니다">' + I('rise', '', 's') + '집값 D-' + rise + '</span>' : '') +
      (news ? '<span class="chip" title="오늘 소식 ' + news + '건">' + I('news', '', 's') + '소식 ' + news + '</span>' : '') +
      '</div>';
  }

  // ── 구역 today: 지금 칸에서 고를 것 ──
  function renderToday() {
    const head = '<div class="zh" title="지금 칸 — 하루는 오전 · 오후 · 저녁 세 칸입니다">' + I(S.slot < 3 ? SLOT_IC[S.slot] : 'zzz') + '<span>' + (S.slot < 3 ? SLOTS[S.slot] : '밤') + '</span><span class="pips" title="하루 세 칸 중 남은 칸">' + [0, 1, 2].map(i => '<i class="' + (i >= S.slot ? 'on' : '') + '"></i>').join('') + '</span>' +
      (S.buff && S.buff.nextJob ? '<span class="r"><span class="chip hot" title="대타: 다음 알바 일당 ×' + S.buff.nextJob + '">' + I('swap', '', 's') + '×' + S.buff.nextJob + '</span></span>' : '') + '</div>';
    if (S.slot >= 3) {
      const b = R.bill(S), due = b && b.inDays === 0;
      $('today').innerHTML = head + '<div class="cards"><button class="card wide go" data-do="endday"><span class="pic">' + art('act', 'rest') + '</span><span><span class="big">하루 마치기</span>' +
        (S.day >= tune.days ? '<b class="bad">마지막 밤 — 집을 계약하지 않으면 끝납니다</b>' : due ? '<b class="gold">' + I('bill', '', 's') + ' 오늘 밤 고정비 ' + won(b.amt) + (S.cash < b.amt ? ' — 현금이 모자랍니다' : '') + '</b>' : '<span class="dim">' + ((coachNow() || {}).id === 'endday' ? '밤 정산 뒤 다음 날로 넘어갑니다' : '자기 전에 매매 · 이사를 할 수 있습니다') + '</span>') + '</span><span class="key">Space</span></button></div>';
      return;
    }
    const gotFree = !!(S.market.intel && S.market.intel.free && S.market.intel.madeOn === S.day); // 오늘 리포트를 공짜로 받음: 공부해도 새로 얻는 것이 없다
    const first = (coachNow() || {}).id === 'job'; // 안내가 첫 알바를 짚는 동안은 "대충"을 감춘다 (미니게임을 한 번은 해 보게)
    $('today').innerHTML = head + '<div class="cards">' + R.acts(S).map((a, i) => {
      const k = '<span class="key">' + (i + 1) + '</span>', off = a.ok ? 'data-do="' + a.kind + '"' + (a.kind === 'job' ? ' data-arg="' + a.id + '"' : '') + ' role="button"' : 'data-do="why" data-arg="' + esc(a.why) + '"';
      if (a.kind === 'job') {
        const lv = '<span class="lv" title="숙련도: 직접 한 횟수가 ' + tune.skill_n1 + ' · ' + tune.skill_n2 + ' · ' + tune.skill_n3 + '번이 되면 일당이 ' + Math.round(tune.skill_bonus * 100) + '%씩 오릅니다">' + [1, 2, 3].map(n => '<s class="' + (a.lv >= n ? 'on' : '') + '"></s>').join('') + '</span>';
        return '<div class="card ' + (a.ok ? 'go' : 'off') + '" ' + off + ' title="' + esc(a.name + ' — ' + a.note) + '">' + k + lv + '<span class="pic">' + art('job', a.id) + '</span><span class="nm">' + a.name + '</span>' +
          '<span class="st"><span class="pay" title="일당">' + I('coin', '', 's') + won(a.pay) + '</span><span class="' + (a.ok ? 'cost' : 'lack') + '" title="드는 체력' + (a.ok ? '' : ' — 모자랍니다') + '">' + I('hp', '', 's') + '−' + a.hp + '</span></span>' +
          (a.ok && !first ? '<button class="skip" data-do="skip" data-arg="' + a.id + '" title="대충: 미니게임 없이 일당의 ' + Math.round(R.skipMult(S) * 100) + '%만 받고 넘어갑니다. 숙련도와 콤보는 오르지 않습니다">' + I('skip', '', 's') + '×' + R.skipMult(S).toFixed(1) + '</button>' : '') + '</div>';
      }
      return '<div class="card ' + (a.ok ? 'go' : 'off') + '" ' + off + ' title="' + (a.kind === 'rest' ? '쉬기 — 체력을 채웁니다' : gotFree ? '공부 — 내일 리포트는 이미 받았습니다. 지금 공부해도 새로 얻는 것은 없습니다' : '공부 — 한 칸을 써서 내일 소식의 진짜 방향을 미리 봅니다') + '">' + k + '<span class="pic">' + art('act', a.id) + '</span><span class="nm">' + a.name + '</span>' +
        '<span class="st">' + (a.kind === 'rest' ? '<span class="gain">' + I('hp', '', 's') + '+' + (-a.hp) + '</span>' : a.ok ? (gotFree ? '<span class="dim">' + I('check', '', 's') + '이미 받음</span>' : '<span class="sys">' + I('news', '', 's') + '내일 소식</span>') : '<span class="lack">' + I('check', '', 's') + '읽음</span>') + '</span></div>';
    }).join('') + '</div>';
  }

  // ── 구역 board: 사다리 / 주식 / 코인 ──
  function renderBoard() {
    const tabs = [['ladder', '사다리', 'house', '주거 사다리']];
    if (R.unlocked(S, 'stock')) tabs.push(['stock', '주식', 'chart', '주식 매매']);
    if (R.unlocked(S, 'coin')) tabs.push(['coin', '코인', 'bolt', '코인 레버리지']);
    if (!tabs.some(t => t[0] === ui.tab)) ui.tab = 'ladder';
    if (ui.tab === 'stock' && ui.sel === 'coin') ui.sel = 'daejang';
    $('board').innerHTML = '<div class="zh tabs">' + tabs.map(t => '<button class="' + (ui.tab === t[0] ? 'on' : ui.fresh[t[0]] ? 'new' : '') + '" data-do="tab" data-arg="' + t[0] + '" title="' + t[3] + '">' + I(t[2], '', 's') + t[1] + '</button>').join('') + '</div>' +
      '<div class="pbody">' + (ui.tab === 'ladder' ? ladderHtml() : tradeHtml(ui.tab)) + '</div>';
    if (ui.tab !== 'ladder') drawChart($('chart'), ui.tab === 'coin' ? 'coin' : ui.sel);
    ui.flash = {}; ui.coachDirty = true;
  }
  function ladderHtml() {
    const price = R.housePrice(S), w = R.worth(S), rise = R.riseIn(S);
    const row = (ic, title, text) => '<span title="' + title + '">' + I(ic, '', 's') + text + '</span>';
    const rows = [
      [row('meal', '끼니: 하루 ' + won(R.mealCost(S)), won(R.mealCost(S))), row('bed', '자면 돌아오는 체력', '+' + tune.sleep_station)],
      [row('cash', '하룻밤 요금', '하룻밤 ' + won(R.saunaCost(S))), row('meal', '끼니: 하루 ' + won(R.mealCost(S)), won(R.mealCost(S))), row('bed', '자면 돌아오는 체력', '+' + tune.sleep_sauna)],
      [row('cash', '보증금 (나갈 때 돌려받음)', '보증금 ' + won(tune.gosiwon_deposit)), row('bill', '고정비: 매주 일요일 밤 (끼니 포함)', '주 ' + won(R.weekCost(S, 2))), row('bed', '자면 돌아오는 체력', '+' + tune.sleep_gosiwon)],
      [row('cash', '보증금 (나갈 때 돌려받음)', '보증금 ' + won(tune.oneroom_deposit)), row('bill', '고정비: 매주 일요일 밤 (끼니 포함)', '주 ' + won(R.weekCost(S, 3))), row('bed', '자면 돌아오는 체력', '+' + tune.sleep_oneroom)],
      [row('key', '집값', won(price)), row('rise', '매주 오르는 비율', '+' + Math.round((R.housePrice(S, 8) / R.housePrice(S, 1) - 1) * 100) + '%')],
    ];
    const open = (svg, title) => '<span title="' + title + '">' + svg + '</span>';
    const opens = [
      open(art('job', 'flyer'), '전단지 알바') + open(art('job', 'loading'), '상하차 알바'),
      open(art('job', 'store'), '편의점 알바'),
      open(art('job', 'delivery'), '배달 알바') + open(art('icon', 'chart'), '주식 계좌') + open(art('icon', 'book'), '공부(리포트)'),
      open(art('asset', 'coin'), '코인') + open(art('icon', 'bolt'), '레버리지'),
      open(art('icon', 'trophy'), '엔딩'),
    ];
    return '<div class="ladder">' + R.HOMES.map((h, t) => {
      const far = t > S.tier + 1 && t < 4, past = t < S.tier;
      let foot;
      if (t === 4) {
        const ok = w >= price;
        foot = '<div class="bar"><div style="width:' + (clamp(w / price, 0, 1) * 100).toFixed(1) + '%"></div></div>' +
          (ok ? '<button class="btn warm" data-do="house">' + I('key') + '계약</button>' : '<div class="why" title="순자산이 ' + won(price - w) + ' 더 있어야 합니다">' + I('wallet', '', 's') + won(price - w) + ' 더</div>');
      } else if (t === S.tier) foot = '<div class="why sys">' + I('check', '', 's') + '여기</div>';
      else if (past) foot = '<div class="why">' + I('check', '지나옴', 's') + '</div>';
      else if (t === S.tier + 1) { const info = R.moveInfo(S, t); foot = info.ok ? '<button class="btn main" data-do="move" data-arg="' + t + '">' + I('door') + '옮기기</button>' : '<div class="why" title="' + info.why + '">' + I('cash', '', 's') + won(info.need - S.cash) + ' 더</div>'; }
      else foot = '<div class="why">' + I('lock', '앞 단계부터', 's') + '</div>';
      return '<div class="rung ' + (t === S.tier ? 'here' : past ? 'past' : far ? 'far' : '') + '"><div class="th">' + art('thumb', t) + '</div><div class="in"><div class="nm">' + h.name + '</div>' +
        (past || far ? '' : '<div class="rows">' + rows[t].join('') + '</div><div class="opens">' + opens[t] + '</div>') + '<div class="foot">' + foot + '</div></div></div>';
    }).join('') + '</div>';
  }
  function todayChg(id) { const h = S.market.hist[id], open = h[h.length - 1 - Math.min(3, S.slot)]; return S.slot === 0 ? null : S.market.px[id] / open - 1; }
  const pxText = id => Math.round(S.market.px[id]).toLocaleString('en-US') + '원';
  const REL = { official: 3, article: 2, rumor: 1 };
  function newsHtml() {
    const coin = R.unlocked(S, 'coin');
    const today = R.todayNews(S).filter(n => n.asset !== 'coin' || coin), intel = R.intelView(S);
    const item = n => '<div class="nitem"><span class="src ' + n.src + '" title="' + n.srcName + ' — ' + n.srcNote + '">' + n.srcName + '<span class="rel">' + [1, 2, 3].map(k => '<i class="' + (REL[n.src] >= k ? 'on' : '') + '"></i>').join('') + '</span></span>' + arrow(n.dir, n.dir > 0 ? '호재' : '악재') +
      '<span class="tx">' + esc(n.head) + '</span>' + (n.report ? '<span class="rep ' + cls(n.report) + '" title="리포트: 실제로는 ' + (n.report > 0 ? '오름' : '내림') + '">' + I('book', '', 's') + I(n.report > 0 ? 'up' : 'down', '', 's') + '</span>' : '') + '</div>';
    const left = '<h4 title="오늘 소식 — 점이 많을수록 믿을 만합니다 (공시 · 기사 · 찌라시)">' + I('news', '', 's') + '오늘</h4>' + (today.length ? today.map(item).join('') : '<div class="nitem dim">조용함</div>');
    let right;
    if (intel) {
      const its = intel.items.filter(i => i.asset !== 'coin' || coin), ht = intel.ht;
      const htText = ht.phase === 'gather' ? (ht.soon ? '급등 임박' : '사 모으는 중') : ht.phase === 'pump' ? '폭락 임박' : ht.phase === 'dump' ? '폭락 중' : ht.soon ? '곧 움직임' : '잠잠';
      right = '<h4 title="내일 소식의 진짜 방향 (리포트 · ' + Math.round(R.studyAcc(S) * 100) + '% 맞음). 시세는 소식 말고도 출렁입니다">' + I('book', '', 's') + '내일 <span>' + Math.round(R.studyAcc(S) * 100) + '%</span></h4>' +
        its.map(i => '<div class="nitem"><span class="em">' + art('asset', i.asset) + '</span><span class="tx">' + i.name + '</span>' + arrow(i.dir) + '</div>').join('') +
        '<div class="nitem" title="한탕바이오의 지금 흐름 (리포트를 읽은 때 기준)"><span class="em">' + art('asset', 'hantang') + '</span><span class="tx warm">' + htText + '</span></div>';
    } else right = '<h4 title="한 칸을 공부에 쓰면 내일 소식의 진짜 방향이 여기에 뜹니다">' + I('book', '', 's') + '내일</h4><div class="nitem dim">' + I('lock', '', 's') + '공부하면 보임</div>';
    return '<div class="newsbox"><div>' + left + '</div><div>' + right + '</div></div>';
  }
  function tradeHtml(tab) {
    const coinTab = tab === 'coin', cur = coinTab ? 'coin' : ui.sel, a = R.ASSETS.find(x => x.id === cur), c = todayChg(cur);
    let left, main;
    if (coinTab) { // 왼쪽 = 주문 칸(또는 내 포지션), 오른쪽 = 차트와 버튼. 정리 버튼은 롱 · 숏과 다른 자리에 둔다
      const l = S.lev, fund = n => (n * tune.lev_fund * 100).toFixed(1) + '%';
      if (l) {
        const v = R.levValue(S), p = v - l.put, side = l.dir > 0 ? '<b class="up">롱</b>' : '<b class="down">숏</b>';
        left = '<div class="levform"><div class="pos"><span title="' + (l.dir > 0 ? '롱: 오르면 이익' : '숏: 내리면 이익') + '">' + I(l.dir > 0 ? 'up' : 'down') + side + ' ' + l.lev + '배</span><span title="건 돈(증거금)"><i>건 돈</i>' + won(l.put) + '</span>' +
          '<span title="지금 정리하면 돌려받는 돈" class="' + cls(p) + '"><i>지금</i>' + won(v) + '</span><span title="청산가: 시세가 여기에 닿으면 증거금을 전부 잃습니다" class="bad"><i>청산</i>' + Math.round(R.levLiq(l)).toLocaleString('en-US') + '원</span>' +
          '<span title="유지비: 들고 있으면 칸마다 증거금에서 나갑니다" class="dim"><i>유지비</i>칸마다 −' + fund(l.lev) + '</span></div></div>';
        main = '<div class="mine-line"><span>' + side + ' ' + l.lev + '배</span><span class="' + cls(p) + '"><b>' + sign(p) + '</b> (' + pct(p / l.put) + ')</span></div>' +
          '<div class="order" style="justify-content:flex-end"><button class="btn warm" data-do="close" title="포지션을 정리해 현금으로 돌려받습니다">' + I('check') + '정리</button></div>';
      } else {
        const m = Math.floor(S.cash * ui.share), dis = m < 100000 ? ' disabled' : '';
        left = '<div class="levform"><div class="row" title="배율: 맞히면 움직임의 몇 배를 벌고, 틀리면 그만큼 잃습니다">' + I('bolt') + '<div class="seg pick">' + [1, 2, 3, 5].map(n => '<button class="' + (ui.lev === n ? 'on' : '') + '" data-do="lev" data-arg="' + n + '">' + n + '배</button>').join('') + '</div></div>' +
          '<div class="row" title="증거금: 현금에서 얼마를 걸지">' + I('cash') + '<div class="seg pick">' + [0.25, 0.5, 1].map(n => '<button class="' + (ui.share === n ? 'on' : '') + '" data-do="share" data-arg="' + n + '">' + Math.round(n * 100) + '%</button>').join('') + '</div></div>' +
          '<div class="note" title="유지비: 들고 있으면 칸마다 증거금에서 나갑니다. 포지션은 한 번에 하나">' + I('bill', '', 's') + '유지비 칸마다 −' + fund(ui.lev) + '</div></div>';
        main = '<div class="mine-line"><span title="걸 돈">' + I('cash', '', 's') + '<b>' + won(m) + '</b> ×' + ui.lev + '</span><span class="bad" title="반대로 ' + Math.round(100 / ui.lev) + '% 움직이면 증거금을 전부 잃습니다 (청산)">' + I('skull', '', 's') + '−' + Math.round(100 / ui.lev) + '%</span>' + (m < 100000 ? '<span class="dim">10만부터</span>' : '') + '</div>' +
          '<div class="order"><button class="btn up" data-do="long"' + dis + ' title="롱: 오른다에 건다">' + I('up') + '롱</button><button class="btn down" data-do="short"' + dis + ' title="숏: 내린다에 건다">' + I('down') + '숏</button></div>';
      }
    } else {
      left = R.ASSETS.filter(x => x.kind === 'stock').map(x => {
        const d = todayChg(x.id), h = S.hold[x.id], v = R.holdValue(S, x.id), f = ui.flash[x.id];
        return '<button class="arow ' + (x.id === cur ? 'on' : '') + (f > 0 ? ' flash-up' : f < 0 ? ' flash-down' : '') + '" data-do="sel" data-arg="' + x.id + '" title="' + x.name + ' — ' + x.hint + '"><span class="em">' + art('asset', x.id) + '</span><span class="bd">' +
          '<span class="l1"><span class="nm">' + x.name + '<i>' + x.tag + '</i></span><span class="px">' + pxText(x.id) + '</span></span>' +
          '<span class="l2"><span class="mine' + (h.units > 0 ? ' ' + cls(v - h.cost) : '') + '">' + (h.units > 0 ? I('wallet', '보유', 's') + won(v) : '') + '</span><span class="chg ' + (d == null ? 'dim' : cls(d)) + '" title="오늘 움직임">' + (d == null ? '' : pct(d)) + '</span></span></span></button>';
      }).join('');
      const h = S.hold[cur], v = R.holdValue(S, cur), dis = ok => (ok ? '' : ' disabled');
      main = '<div class="mine-line">' + (h.units > 0 ? '<span title="보유 (지금 값)">' + I('wallet', '', 's') + '<b>' + won(v) + '</b></span><span class="dim" title="산 값">' + I('cart', '', 's') + won(h.cost) + '</span><span class="' + cls(v - h.cost) + '" title="평가 손익">' + sign(v - h.cost) + ' (' + pct(v / h.cost - 1) + ')</span>' : '<span class="dim">' + a.hint + '</span>') + '</div>' +
        '<div class="order">' + I('cart', '사기') + '<div class="seg">' + [100000, 500000, 1000000].map(n => '<button data-do="buy" data-arg="' + n + '"' + dis(S.cash >= n) + '>' + won(n) + '</button>').join('') + '<button data-do="buy" data-arg="all"' + dis(S.cash >= 10000) + ' title="현금 전부">전부</button></div>' +
        '<span style="flex:1"></span>' + I('sell', '팔기') + '<div class="seg"><button data-do="sell" data-arg="0.5"' + dis(h.units > 0) + '>절반</button><button data-do="sell" data-arg="1"' + dis(h.units > 0) + '>전부</button></div></div>';
    }
    return newsHtml() + '<div class="trade"><div class="alist">' + left + '</div><div class="tmain">' +
      '<div class="thead"><b>' + a.name + '</b><span class="p">' + pxText(cur) + '</span><span class="' + (c == null ? 'dim' : cls(c)) + '" title="오늘 움직임">' + (c == null ? '' : pct(c)) + '</span>' +
      '<span class="h" title="' + (coinTab ? '포지션을 열 때 수수료: 증거금 × 배율 × ' + (tune.lev_fee * 100).toFixed(1) + '%' : '사고팔 때 수수료') + '">' + I('percent', '', 's') + '수수료 ' + ((coinTab ? tune.lev_fee : tune.fee * (R.perk(S, 'vip') ? 0.5 : 1)) * 100).toFixed(2).replace(/0$/, '') + '%' + (coinTab ? ' × 배율' : '') + '</span></div>' +
      '<div class="chart"><canvas id="chart" width="1092" height="232"></canvas></div>' + main + '</div></div>';
  }
  function drawChart(cv, id) {
    if (!cv) return;
    const c = cv.getContext('2d'), Wc = cv.width, Hc = cv.height, h = S.market.hist[id].slice(-61), n = h.length;
    c.clearRect(0, 0, Wc, Hc);
    const lines = [];
    if (id === 'coin' && S.lev) { lines.push([S.lev.entry, PAL.gold, '진입']); lines.push([R.levLiq(S.lev), PAL.bad, '청산']); }
    else if (id !== 'coin' && S.hold[id].units > 0) lines.push([S.hold[id].cost / S.hold[id].units, PAL.gold, '산 값']);
    let lo = Math.min.apply(null, h), hi = Math.max.apply(null, h);
    for (const l of lines) if (l[0] > lo * 0.7 && l[0] < hi * 1.3) { lo = Math.min(lo, l[0]); hi = Math.max(hi, l[0]); }
    const pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
    const X = i => 16 + (Wc - 120) * i / (n - 1), Y = v => Hc - 14 - (Hc - 28) * (v - lo) / (hi - lo);
    const real = S.market.tick - 17; // 판이 시작된 뒤의 틱 수
    c.font = '26px ' + FONT; c.textBaseline = 'top';
    for (let i = 0; i < n; i++) { // 하루의 경계선
      const r = real - (n - 1 - i);
      if (r >= 0 && r % 3 === 0) { c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(X(i), 0, 2, Hc); if (((r / 3) % 2 === 0 || n < 30) && X(i) < Wc - 190) { c.fillStyle = PAL.dim; c.fillText((r / 3 + 1) + '일', X(i) + 6, 4); } } // 오른쪽 끝은 선 이름(진입 · 청산 · 산 값) 자리
    }
    const up = h[n - 1] >= h[Math.max(0, n - 1 - Math.max(1, Math.min(3, S.slot)))], col = up ? PAL.up : PAL.down;
    const g = c.createLinearGradient(0, 0, 0, Hc); g.addColorStop(0, up ? 'rgba(255,93,108,0.28)' : 'rgba(91,140,255,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.beginPath(); c.moveTo(X(0), Y(h[0])); for (let i = 1; i < n; i++) c.lineTo(X(i), Y(h[i]));
    c.lineTo(X(n - 1), Hc); c.lineTo(X(0), Hc); c.closePath(); c.fillStyle = g; c.fill();
    c.beginPath(); c.moveTo(X(0), Y(h[0])); for (let i = 1; i < n; i++) c.lineTo(X(i), Y(h[i]));
    c.strokeStyle = col; c.lineWidth = 4; c.lineJoin = 'round'; c.stroke();
    c.beginPath(); c.arc(X(n - 1), Y(h[n - 1]), 8, 0, 6.3); c.fillStyle = col; c.fill();
    c.textBaseline = 'middle';
    for (const l of lines) {
      const y = clamp(Y(l[0]), 14, Hc - 14);
      c.setLineDash([12, 10]); c.strokeStyle = l[1]; c.lineWidth = 2; c.beginPath(); c.moveTo(16, y); c.lineTo(Wc - 104, y); c.stroke(); c.setLineDash([]);
      c.fillStyle = l[1]; c.fillText(l[2], Wc - 96, y);
    }
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
    v.classList.toggle('hide', !m);
    if (!m) { v.innerHTML = ''; return; }
    if (m.type === 'mg') {
      if (!v.querySelector('.mg')) {
        v.innerHTML = '<div class="win mg corner"><div class="mg-head"><b>' + esc(m.mg.title || m.act.name) + '</b><span>' + esc(m.mg.howto || '') + '</span><i title="일당 — 잘할수록 ×' + tune.mult_miss + '~' + tune.mult_perfect + '">' + I('coin', '', 's') + won(m.act.pay) + (S.combo ? ' · ' + I('fire', '콤보', 's') + S.combo : '') + '</i></div>' +
          '<canvas id="mgc" class="mg-canvas" width="1760" height="760"></canvas><div class="mg-ctl"></div><div id="mgres"></div></div>';
      }
      const ctl = v.querySelector('.mg-ctl');
      if (m.wait) { ctl.className = 'mg-ctl how'; ctl.innerHTML = howHtml(m); } // 하는 법은 그림을 가리지 않게 그림 아래에. 시작한 뒤에도 그 높이를 지켜 그림이 움직이지 않는다
      else if (!m.res) { if (ctl.classList.contains('how')) ctl.style.minHeight = ctl.offsetHeight + 'px'; ctl.innerHTML = (m.mg.controls || []).map(c => '<button class="btn" data-mg="' + c.code + '">' + esc(c.label) + ' <span class="key">' + keyName(c.code) + '</span></button>').join(''); }
      else {
        const j = m.res.j, w = m.res.wh;
        $('mgres').innerHTML = '<div class="mg-res"><div class="g ' + j.grade + '">' + j.gradeName + '</div><div class="m">' + I('coin', '', 'l') + '+' + won(j.pay + (m.res.tip ? m.res.tip.amt : 0)) + '</div>' +
          '<div class="s"><span title="일당 × 등급 배율">' + won(j.base) + ' ×' + j.mult + '</span>' + (j.comboMult > 1 ? '<span class="gold" title="콤보 보너스">' + I('fire', '', 's') + '+' + Math.round((j.comboMult - 1) * 100) + '%</span>' : '') + (j.extra > 1 ? '<span class="gold" title="대타">' + I('swap', '', 's') + '×' + j.extra + '</span>' : '') +
          (m.res.tip ? '<span class="gold" title="팁">' + I('gift', '', 's') + '+' + won(m.res.tip.amt) + '</span>' : '') + '<span title="쓴 체력">' + I('hp', '', 's') + '−' + j.hp + '</span>' +
          (j.combo > 0 ? '<span class="gold" title="콤보: 잘함 이상이면 쌓입니다">' + I('fire', '', 's') + j.combo + '</span>' : j.comboWas > 0 ? '<span class="bad" title="콤보가 끊겼습니다">' + I('fire', '', 's') + '0</span>' : '') + '</div>' +
          (w ? '<div class="w ' + cls(w.delta) + '" title="일하는 동안 내 투자가 움직인 만큼">' + I('chart', '', 's') + '일하는 동안 ' + sign(w.delta) + ' (' + pct(w.pct) + ')</div>' : '') + okBtn() + '</div>';
        ctl.innerHTML = '';
      }
      drawMg();
      return;
    }
    if (m.type === 'intro') {
      v.innerHTML = '<div class="win pop corner"><div class="sweep"></div><h2>' + I('quest', '', 's') + '시스템</h2><h3>상태창이 열렸습니다</h3><p>' + esc(S.name) + ' 님, 각성을 축하합니다. 현금 0원. 주소 없음. 이 창은 당신에게만 보입니다.</p>' +
        '<div class="rewardbox" title="이 판의 목표">' + I('key') + '<span><b class="gold">' + tune.days + '일 안에 집값 ' + won(R.housePrice(S)) + '</b>을 모아 집을 산다. 아마도.</span></div>' + nextBox(m.next) + okBtn('시작') + '</div>';
    } else if (m.type === 'quest') {
      const one = m.done.length + m.skipped.length === 1, q0 = m.done[0];
      v.innerHTML = '<div class="win pop corner"><div class="sweep"></div><h2>' + I('check', '', 's') + '퀘스트 완료' + (m.done.length > 1 ? ' ×' + m.done.length : '') + '</h2>' +
        (one ? '<h3>' + esc(q0.title) + '</h3><div class="rewardbox">' + I('gift') + '<b class="gold">' + esc(q0.reward) + '</b></div>'
          : '<div class="qdone">' + m.done.map(q => '<div>' + I('check', '', 's') + '<b>' + esc(q.title) + '</b><span class="gold">' + I('gift', '', 's') + esc(q.reward) + '</span></div>').join('') +
            m.skipped.map(q => '<div class="off">' + I('skip', '', 's') + '<b>' + esc(q.title) + '</b><span>때가 지나 건너뜀</span></div>').join('') + '</div>') + nextBox(m.next) + okBtn() + '</div>';
    } else if (m.type === 'perk') {
      const cards = R.offerView(S) || [];
      v.innerHTML = '<div class="win lvup corner"><div class="sweep"></div><h2>' + I('star', '', 's') + 'LEVEL UP</h2><h3>Lv.' + (S.lv - S.picks + 1) + ' — 특성을 하나 고르세요</h3><div class="pcards">' + cards.map((p, i) =>
        '<button class="pcard" data-do="perk" data-arg="' + p.id + '"><span class="key">' + (i + 1) + '</span>' + I(p.icon) + '<b>' + p.name + '</b><span>' + p.desc + '</span><i class="have" title="같은 특성을 겹쳐 고를 수 있는 횟수">보유 ' + p.n + ' / ' + p.max + '</i></button>').join('') + '</div></div>';
    } else if (m.type === 'event') {
      const e = m.view, cost = c => (c.cost ? '<span class="cost" title="고르면 드는 돈">' + I('cash', '', 's') + '−' + won(c.cost) + '</span>' : '');
      v.innerHTML = '<div class="win evt corner"><div class="sweep"></div><div class="evt-top">' + I(e.icon) + '<div><h2>' + I('dice', '', 's') + '돌발</h2><h3>' + esc(e.title) + '</h3></div></div><p>' + esc(m.done || e.text) + '</p>' +
        (m.done ? evFx(m.fx) + okBtn() : '<div class="evt-btns"><button class="btn" data-do="ev" data-arg="a"' + (e.a.ok ? '' : ' disabled') + '><span class="key">1</span>' + esc(e.a.label) + cost(e.a) + '</button><button class="btn" data-do="ev" data-arg="b"><span class="key">2</span>' + esc(e.b.label) + cost(e.b) + '</button></div>') + '</div>';
    } else if (m.type === 'tier') {
      v.innerHTML = '<div class="win pop corner"><div class="sweep"></div><h2>' + I('door', '', 's') + '주거 변경</h2><h3>' + esc(m.e.name) + '</h3><div class="rewardbox">' + I('gift') + '<b class="gold">' + esc(m.e.unlock || '') + '</b></div>' + okBtn() + '</div>';
    } else if (m.type === 'liq') {
      v.innerHTML = '<div class="win pop corner bad"><h2>' + I('skull', '', 's') + '청산</h2><h3>증거금 ' + won(m.e.lost) + '이 사라졌습니다</h3><p>' + m.e.lev + '배 ' + (m.e.dir > 0 ? '롱' : '숏') + '이 반대로 갔습니다.' + (m.e.saved ? ' 강심장으로 ' + won(m.e.saved) + '은 건졌습니다.' : '') + ' 배율을 낮추거나, 확실할 때만 크게 거세요.</p>' + okBtn() + '</div>';
    } else if (m.type === 'confirm') {
      if (m.kind === 'move') {
        const h = R.HOMES[m.to], wk = R.weekCost(S, m.to), after = S.cash - m.info.pay, tonight = S.day % 7 === 0 ? Math.round(wk / 7 / 1000) * 1000 : 0;
        const row = (ic, html, c) => '<div' + (c ? ' class="' + c + '"' : '') + '>' + I(ic) + '<span>' + html + '</span></div>';
        v.innerHTML = '<div class="win pop corner"><h2>' + I('door', '', 's') + '입주 확인</h2><h3>' + h.name + '에 입주할까요?</h3><div class="crows">' +
          row('cash', '보증금 <b>' + won(m.info.dep) + '</b> <span class="dim">나갈 때 돌려받음</span>') +
          (m.info.settle ? row('bill', '살던 ' + R.HOMES[S.tier].name + ' 정산 <b>' + won(m.info.settle) + '</b> <span class="dim">이번 주에 산 날만큼</span>') : '') +
          row('bill', '고정비 <b class="gold">주 ' + won(wk) + '</b> <span class="dim">일요일 밤 · 끼니 포함 · 두 번 밀리면 쫓겨남</span>') +
          (tonight ? row('warn', '오늘이 일요일 — 오늘 밤 하루치 <b>' + won(tonight) + '</b>' + (after < tonight ? ' · 모자랍니다' : ''), after < tonight ? 'bad' : 'gold') : '') +
          row('wallet', '입주 뒤 현금 <b>' + won(after) + '</b>') +
          row('gift', '<b class="gold">' + h.unlock + '</b> 열림') + '</div>' +
          '<div class="foot"><button class="btn" data-do="no">아직 <span class="key">Space</span></button><button class="btn main" data-do="ok">입주 <span class="key">Enter</span></button></div></div>';
      } else if (m.kind === 'sleep') {
        const can = R.worth(S) >= R.housePrice(S);
        v.innerHTML = '<div class="win pop corner bad"><h2>' + I('warn', '', 's') + '확인</h2><h3>' + (m.lastDay ? (can ? '집을 살 수 있습니다' : '마지막 밤입니다') : '고정비를 못 냅니다') + '</h3><p>' +
          (m.lastDay ? (can ? '순자산이 집값을 넘었습니다. 사다리에서 <b class="gold">계약</b>을 누르지 않고 자면 이 판은 실패로 끝납니다.' : '오늘 밤이 지나면 이 판은 끝납니다. 순자산 ' + won(R.worth(S)) + ' · 집값 ' + won(R.housePrice(S)) + '.')
            : '오늘 밤 고정비 <b class="gold">' + won(m.b.amt) + '</b>인데 현금이 ' + won(m.b.amt - S.cash) + ' 모자랍니다. 주식 · 코인을 팔면 현금이 됩니다. 그냥 자면 연체료가 붙고, 두 번 연속이면 쫓겨납니다.') + '</p>' +
          '<div class="foot"><button class="btn" data-do="ok">' + (m.lastDay ? '이대로 끝낸다' : '그래도 잔다') + ' <span class="key">Enter</span></button><button class="btn main" data-do="no">돌아가기 <span class="key">Space</span></button></div></div>';
      } else {
        v.innerHTML = '<div class="win pop corner"><h2>' + I('key', '', 's') + '계약 확인</h2><h3>집을 계약할까요?</h3><p>집값 <b class="gold">' + won(R.housePrice(S)) + '</b> · 순자산 <b>' + won(R.worth(S)) + '</b><br>가진 주식 · 코인 · 보증금을 모두 정리해 치릅니다. 이 판은 여기서 끝납니다.</p>' +
          '<div class="foot"><button class="btn" data-do="no">아직 <span class="key">Space</span></button><button class="btn warm" data-do="ok">계약 <span class="key">Enter</span></button></div></div>';
      }
    } else if (m.type === 'night') v.innerHTML = nightHtml(m.sum);
    else if (m.type === 'achs') v.innerHTML = achsHtml();
    else if (m.type === 'help') v.innerHTML = helpHtml();
    const w = v.firstElementChild; // 꺾쇠를 창보다 먼저 그리려고 틀을 한 겹 둠
    if (w && w.classList.contains('corner')) { const f = document.createElement('div'); f.className = 'frame corner'; w.classList.remove('corner'); v.replaceChild(f, w); f.appendChild(w); }
  }
  function nightHtml(n) {
    const rows = (list, sgn) => (list.length ? list.map(r => '<div class="n-row"><span>' + esc(r.label) + '</span><span class="' + (sgn > 0 ? 'gold' : '') + '">' + (sgn > 0 ? '+' : '−') + won(r.amt) + '</span></div>').join('') : '<div class="n-row none"><span>없음</span><span></span></div>');
    const d = n.worthEnd - n.worthStart, b = R.bill(S), rise = R.riseIn(S);
    const next = [];
    if (!n.lastDay) {
      if (b) { const dd = b.inDays === 0 ? 7 : b.inDays, amt = b.inDays === 0 ? R.weekCost(S) + S.arrears : b.amt; next.push('<span class="chip' + (dd <= 2 ? ' hot' : '') + '" title="다음 고정비">' + I('bill', '', 's') + '고정비 D-' + dd + ' ' + won(amt) + '</span>'); }
      if (rise) next.push('<span class="chip' + (rise <= 1 ? ' hot' : '') + '" title="집값이 오르기까지">' + I('rise', '', 's') + '집값 D-' + rise + '</span>');
      next.push('<span class="chip" title="남은 날">' + I('clock', '', 's') + '남은 ' + (tune.days - n.day) + '일</span>');
    }
    return '<div class="win night corner"><h2>' + I('moon', '', 's') + n.day + '일째 밤</h2><h3>' + n.home + '에서 잠듭니다</h3>' +
      '<div class="n-cols"><div class="n-col"><h4>' + I('plus', '', 's') + '번 돈</h4>' + rows(n.income, 1) + '<div class="n-row sum"><span>합계</span><span class="gold">+' + won(n.labor) + '</span></div></div>' +
      '<div class="n-col"><h4>' + I('minus', '', 's') + '쓴 돈</h4>' + rows(n.expense, -1) + '<div class="n-row sum"><span>합계</span><span>−' + won(n.spent) + '</span></div></div></div>' +
      '<div class="n-big">' + (R.unlocked(S, 'stock') || n.invest ? I('chart', '투자 손익 (오늘)') + '<b class="' + cls(n.invest) + '">' + sign(n.invest) + '</b>' : '') +
      I('wallet', '순자산') + '<b>' + won(n.worthStart) + ' → ' + won(n.worthEnd) + ' <span class="' + cls(d) + '" style="font-size:16px">(' + sign(d) + ')</span></b>' +
      I('hp', '체력') + '<b>' + Math.round(n.hp.mid) + ' → ' + Math.round(n.hp.after) + ' <span class="good" style="font-size:16px">(' + I('zzz', '', 's') + '+' + Math.round(n.hp.sleep) + ')</span></b></div>' +
      (n.billed && n.billed.paid ? '<div class="n-notes good">고정비 ' + won(n.billed.amt) + '을 냈습니다' + (n.billed.days < 7 ? ' (이번 주는 ' + n.billed.days + '일만 살아서 그만큼만)' : '') + '.</div>' : '') +
      (n.notes.length ? '<div class="n-notes">' + n.notes.map(x => '<div class="' + x.tone + '">' + esc(x.text) + '</div>').join('') + '</div>' : '') +
      '<div class="n-house" title="집값까지 온 만큼">' + I('key') + '<div class="bar"><div style="width:' + (clamp(n.house.pct, 0, 1) * 100).toFixed(1) + '%"></div></div><b>' + Math.floor(n.house.pct * 100) + '%</b><span class="dim">' + won(n.house.price) + '</span></div>' +
      (next.length ? '<div class="n-next">' + next.join('') + '</div>' : '') + okBtn(n.lastDay ? '결과 보기' : '다음 날') + '</div>';
  }
  function achsHtml() {
    const list = R.achList(), run = S ? S.ach : [];
    return '<div class="win book corner"><h2>' + I('trophy', '', 's') + '업적 ' + achCount() + ' / ' + list.length + '</h2><div class="achs">' + list.map(a => {
      const got = !!meta.ach[a.id] || run.indexOf(a.id) >= 0;
      return '<div class="ach' + (got ? ' got' : '') + '" title="' + a.hint + '">' + I(got ? a.icon : 'lock') + '<b>' + (got ? a.name : '???') + '</b>' + (got ? '' : '<span>' + a.hint + '</span>') + '</div>';
    }).join('') + '</div><div class="rec">' + recChips() + '</div>' + okBtn('닫기') + '</div>';
  }
  function recChips() { // 판 밖에 남는 기록: 판 수 · 집을 산 횟수 · 가장 좋은 기록
    return '<span class="chip" title="한 판 수">' + I('dice', '', 's') + meta.runs + '판</span><span class="chip" title="집을 산 판">' + I('key', '', 's') + '집 ' + meta.wins + '번</span>' +
      (meta.bestDay ? '<span class="chip hot" title="가장 빨리 집을 산 기록">' + I('crown', '', 's') + '최단 ' + meta.bestDay + '일 · ' + meta.bestRank + '</span>' : meta.bestPct ? '<span class="chip" title="집값에 가장 가까이 간 기록">' + I('target', '', 's') + '최고 ' + Math.floor(meta.bestPct * 100) + '%</span>' : '');
  }
  function helpHtml() { // 아이콘 사전: 구역마다 그 구역에 나오는 아이콘과 뜻
    const c = (ic, t) => '<span>' + I(ic, '', 's') + t + '</span>';
    const dots = (n, t) => '<span><span class="rel">' + [1, 2, 3].map(k => '<i class="' + (n >= k ? 'on' : '') + '"></i>').join('') + '</span>' + t + '</span>';
    const sec = (ic, name, chips, note) => '<div class="hz"><b>' + I(ic, '', 's') + name + '</b><div>' + chips.join('') + (note ? '<em>' + note + '</em>' : '') + '</div></div>';
    return '<div class="win book corner"><h2>' + I('help', '', 's') + '도움말</h2><h3>아이콘 읽는 법</h3><div class="hzs">' +
      sec('calendar', '위쪽 띠', [c('calendar', '날짜'), c('sun', '오전'), c('noon', '오후'), c('moon', '저녁'), c('fire', '콤보'), c('cash', '현금'), c('wallet', '순자산'), c('key', '집값과 거기까지 온 만큼'), c('clock', '남은 날'), c('trophy', '업적'), c('sound', '소리'), c('home', '제목으로 (저장됨)')]) +
      sec('door', '나', [c('door', '지금 사는 곳'), c('star', '레벨과 경험치'), c('hp', '체력'), c('plus', '고른 특성이 쌓이는 줄')], '알바 · 퀘스트 · 이익 · 공부로 경험치가 쌓이고, 레벨이 오르면 특성 셋 중 하나를 고릅니다. 고른 특성은 아이콘을 누르면 설명이 뜹니다') +
      sec('quest', '상태창', [c('quest', '지금 할 퀘스트'), c('gift', '끝내면 받는 것'), c('bill', '고정비까지 남은 날과 금액'), c('rise', '집값이 오르기까지 남은 날'), c('news', '오늘 소식 수')], 'D-3 = 3일 뒤. 고정비를 두 번 연속 못 내면 한 단계 내려갑니다') +
      sec('sun', '오늘', [c('coin', '일당'), c('hp', '드는 체력'), c('skip', '대충'), c('swap', '대타 (다음 일당 1.5배)')], '대충 = 미니게임 없이 일당의 일부만 받습니다. 직접 하면 실수해도 대충보다 덜 받지 않고, 숙련도(카드 위 네모 셋)와 콤보는 직접 해야 오릅니다') +
      sec('house', '사다리', [c('cash', '내는 돈 (하룻밤 요금 · 보증금)'), c('bill', '주 고정비'), c('meal', '하루 끼니값'), c('bed', '자면 돌아오는 체력'), c('lock', '아직 잠김'), c('key', '집값'), c('rise', '매주 오르는 비율')], '보증금은 나갈 때 돌려받습니다. 올라가면 알바와 투자가 열립니다') +
      sec('news', '소식', [dots(3, '공시 (거의 확실)'), dots(2, '기사 (대체로)'), dots(1, '찌라시 (반반)'), c('up', '호재 · 오름'), c('down', '악재 · 내림'), c('book', '리포트가 본 진짜 방향')], '공부 = 한 칸을 써서 내일 소식의 진짜 방향을 미리 봅니다. 하루 한 번. 소식의 화살표와 책 옆의 화살표가 다르면 책 쪽이 더 믿을 만합니다') +
      sec('chart', '주식 · 코인', [c('cart', '사기 · 산 값'), c('sell', '팔기'), c('wallet', '보유'), c('percent', '수수료'), c('bolt', '배율'), c('skull', '청산'), c('bill', '유지비')], '청산 = 반대로 크게 움직이면 건 돈을 전부 잃습니다. 배율이 높을수록 가깝습니다') +
      '</div><div class="foot"><button class="btn small" data-do="fxtoggle" title="폭죽 · 흔들림 · 도장을 끕니다">' + I(meta.fxOff ? 'check' : 'sparkle', '', 's') + '효과 줄이기: ' + (meta.fxOff ? '켜짐' : '꺼짐') + '</button><span style="flex:1"></span><button class="btn main" data-do="ok">닫기 <span class="key">Space</span></button></div></div>';
  }

  // ── 제목 · 결과 · 등장물 ──
  function renderTitle() {
    const s = hasSave(), total = R.achList().length;
    $('s-title').innerHTML = '<div class="bg">' + art('title') + '</div><div class="t-box"><div class="tag">무일푼에서 내 집까지 · ' + tune.days + '일</div><h1>서울역<br>상태창</h1>' +
      '<div class="lead">서울역 벤치에서 눈을 떴더니 나에게만 보이는 상태창이 떴다. 알바로 버티고, 방을 구하고, 투자로 불려서 집을 사라.</div>' +
      '<div class="t-form"><label for="name">이름</label><input id="name" maxlength="8" placeholder="나" value="' + esc(ui.name) + '" autocomplete="off"><label for="code" title="같은 코드면 같은 시세의 판이 시작됩니다">' + I('dice', '', 's') + '판 코드</label><input id="code" maxlength="7" placeholder="비우면 새 판" autocomplete="off"></div>' +
      '<div class="t-btns">' + (s ? '<button class="btn main" data-do="continue">이어하기 (' + s.day + '일째) <span class="key">Enter</span></button>' : '') +
      '<button class="btn' + (s ? (ui.askNew === 'new' ? ' warm' : '') : ' main') + '" data-do="new">' + (ui.askNew === 'new' ? '하던 판을 지우고 새로 시작' : '새로 시작') + (s ? '' : ' <span class="key">Enter</span>') + '</button>' +
      '<button class="btn' + (ui.askNew === 'daily' ? ' warm' : '') + '" data-do="daily" title="오늘 날짜로 정해지는 판 — 누구나 같은 시세">' + I('calendar') + (ui.askNew === 'daily' ? '하던 판을 지우고 오늘의 판' : '오늘의 판') + '</button></div>' +
      '<div class="rec"><button class="chip go" data-do="help">' + I('help', '', 's') + '도움말</button>' + (GUIDE ? '<button class="chip go" data-do="tuttoggle" title="' + (meta.tut === 2 ? '끝냈거나 끈 안내입니다 — 누르면 다음 새 판에서 다시 봅니다' : '새 판을 시작하면 첫날을 따라가며 알려 줍니다 (하던 판에는 뜨지 않음) — 누르면 끕니다') + '">' + I('info', '', 's') + '첫 판 안내 ' + (meta.tut === 2 ? '꺼짐' : '켜짐') + '</button>' : '') + '<button class="chip go" data-do="achs">' + I('trophy', '', 's') + '업적 ' + achCount() + ' / ' + total + '</button>' + recChips() + '</div>' +
      '<div class="t-keys"><b>마우스</b>만으로 전부 됩니다. 키보드: <b>1~6</b> 고르기 · <b>Space</b> 넘기기 · <b>M</b> 소리</div></div>';
  }
  function renderResults() {
    const e = S.ended, st = S.stats, home = e.kind === 'home';
    const tips = [], mx = Math.max(st.maxTier || 0, S.tier);
    if (!home) {
      if (mx < 2) tips.push('고시원에 들어가지 못했습니다. 주소가 없으면 계좌도 없습니다.');
      else if (mx < 3) tips.push('원룸에 가지 못했습니다. 알바와 주식만으로는 오르는 집값을 따라잡기 어렵습니다.');
      if (st.evicted) tips.push('고정비를 두 번 연속 못 내 쫓겨났습니다. 일요일 밤에는 현금을 남겨 두세요.');
      if (st.liq) tips.push('청산을 ' + st.liq + '번 당했습니다. 확실하지 않을 때는 배율을 낮추거나 작게 거세요.');
      if (mx >= 2 && !st.bought && !st.levOpens) tips.push('투자를 한 번도 하지 않았습니다. 알바만으로는 집값의 60%쯤이 한계입니다.');
      else if (mx >= 2 && S.studied < 3) tips.push('공부를 ' + S.studied + '번 했습니다. 자산이 커지면 내일을 아는 것이 알바 한 칸보다 값집니다.');
      if (!tips.length) tips.push(e.pct >= 0.8 ? '아깝습니다. 확실한 소식(공시 · 리포트)이 나온 날에 조금 더 크게 거는 것이 차이를 만듭니다.' : '확실한 소식(공시 · 리포트)이 나온 날에만 걸고, 나머지 날은 알바로 채워 보세요.');
      tips.splice(3);
    }
    const stat = (ic, title, val, c) => '<div>' + I(ic, '', 's') + '<span>' + title + '</span><b' + (c ? ' class="' + c + '"' : '') + '>' + val + '</b></div>'; // 결과 화면은 한 번 읽는 곳이라 이름을 붙여 둠
    const got = R.achList().filter(a => ui.newAch.indexOf(a.id) >= 0);
    $('s-results').innerHTML = '<div class="bg">' + art('ending', home ? 'home' : 'fail') + '</div><div class="e-box corner">' +
      '<h2>' + (home ? '최종 퀘스트 완료' : tune.days + '일이 지났습니다') + '</h2><h1>' + (home ? '내 집 마련' : '올해도 무주택') + '</h1>' + (home ? '<div class="rank" title="며칠째에 샀는지로 정해지는 등급">' + e.rank + '</div>' : '') +
      '<p>' + (home ? esc(S.name) + ' 님은 ' + e.day + '일째에 순자산 ' + won(e.worth) + '으로 ' + won(e.price) + '짜리 집을 계약했습니다. 서울역 벤치는 다음 사람에게 양보합니다.' : '순자산 ' + won(e.worth) + ' — 집값 ' + won(e.price) + '의 <b class="gold">' + Math.floor(e.pct * 100) + '%</b>까지 왔습니다. 집은 기다려 주지 않았습니다.') + '</p>' +
      '<div class="e-stats">' + stat('coin', '알바', won(st.alba)) + stat('chart', '투자', sign(st.trade), cls(st.trade)) + stat('bill', '고정비', won(st.fixed)) +
      stat('star', '레벨', 'Lv.' + S.lv) + stat('sparkle', '완벽', st.perfect + '번') + stat('skull', '청산', st.liq + '번') + '</div>' +
      (tips.length ? '<div class="e-tips">' + tips.map(esc).join('<br>') + '</div>' : '') +
      '<div class="e-card"><pre>' + esc(R.resultCard(S)) + '</pre><button class="btn" data-do="copy" title="결과 카드를 복사해 붙여 넣을 수 있습니다">' + I('copy') + '복사</button></div>' +
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
    if (scene === 'play' && m && m.type === 'mg' && !m.res && !m.wait) {
      try { m.mg.update(STEP); } catch (e) { m.mg.done = true; m.mg.result = m.mg.result || { score: 0.5 }; }
      if (m.mg.done) finishMg();
    }
    if (scene === 'play' && S) { // 숫자가 굴러가며 따라붙음
      const w = R.worth(S);
      if (ui.cash !== S.cash) { const dlt = S.cash - ui.cash; ui.cash = Math.abs(dlt) < 600 ? S.cash : ui.cash + dlt * 0.22; bump('cash', won(ui.cash)); }
      if (ui.worth !== w) { const dlt = w - ui.worth; ui.worth = Math.abs(dlt) < 600 ? w : ui.worth + dlt * 0.22; bump('worth', won(ui.worth)); }
      if (ui.sayT > 0 && --ui.sayT === 0) { const el = document.querySelector('.q-say'); if (el) el.classList.add('old'); } // 시스템의 한마디는 잠깐 밝다가 흐려짐
    }
    const box = $('toasts');
    for (let i = box.children.length - 1; i >= 0; i--) if (--box.children[i]._life <= 0) box.children[i].remove();
    stepFx();
    if (ui.coachDirty) { ui.coachDirty = false; try { renderCoach(); } catch (e) { $('coach').className = 'hide'; } } // 화면이 다시 그려진 뒤에 자리를 잰다 (안내의 오류가 판을 멈추지 않게)
  }
  function bump(id, text) { const el = $(id); if (!el || el.textContent === text) return; el.textContent = text; if (!el.classList.contains('bump')) { el.classList.add('bump'); el.addEventListener('animationend', () => el.classList.remove('bump'), { once: true }); } }
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
      return { day: S.day, slot: S.slot, phase: S.phase, cash: S.cash, worth: R.worth(S), hp: S.hp, tier: S.tier, quest: S.quest, title: S.title, lv: S.lv, combo: S.combo, modal: ui.modal ? ui.modal.type : '', guard: ui.guard, coach: (coachNow() || {}).id || '', wait: !!(ui.modal && ui.modal.wait), tut: ui.tut, ended: S.ended, goal: !!(S.ended && S.ended.kind === 'home'), housePrice: R.housePrice(S), raw: S };
    },
    press(code) { hit.push(code); },
    hold() { /* 이 게임은 누르고 있는 조작이 없음 */ },
    get events() { return events; },
    step(n, draw) { for (let i = 0; i < (n || 1); i++) step(); if (draw !== false) { drawMg(); drawFx(); } },
    run, // 점검용: 버튼과 같은 길
    render, // 점검용: 상태를 손으로 고친 뒤 다시 그림
    get mg() { return ui.modal && ui.modal.type === 'mg' ? ui.modal.mg : null; }, // 점검용: 지금 열린 미니게임
    get fx() { return { parts: fx.parts.length, off: calm() }; }, // 점검용: 떠 있는 효과 입자 수
    get meta() { return meta; },
  };

  renderTitle();
  const first = params.get('scene') || 'title';
  if (first === 'figures') { renderFigures(); show('figures'); }
  else if (first === 'play') { newGame(); }
  else show('title');
  last = clock.now();
  if (!MANUAL) { requestAnimationFrame(frame); setInterval(timer, 50); }
})();
