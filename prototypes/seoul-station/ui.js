// PROTOTYPE - NOT FOR PRODUCTION
// Question: 상태창이 시키는 대로 알바 → 방 → 투자 → 집으로 올라가는 한 판이, 뭘 해야 할지 늘 분명하면서 20분 동안 재미있는가?
// Date: 2026-11-12
// 화면과 입력. 규칙은 rules.js, 그림은 art.js, 미니게임은 minigames.js, 조율 값은 config.js.
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
  const SAVE = 'seoul-station-save-v1', RUNS = 'seoul-station-runs';
  const SLOTS = ['오전', '오후', '저녁'], PHASE = ['morning', 'day', 'evening', 'night'];
  const events = [];
  const $ = id => document.getElementById(id);
  const stage = $('stage');
  for (const k in PAL) document.documentElement.style.setProperty('--' + k, PAL[k]);
  document.documentElement.style.setProperty('--font', FONT);

  let scene = 'title', S = null; // S = 규칙의 상태 (window.game.state 가 요약해서 보여 줌)
  const ui = { tab: 'ladder', sel: 'daejang', lev: 2, share: 0.25, from: null, askNew: false, modal: null, queue: [], guard: 0, mute: false, fresh: {}, flash: {}, cash: 0, worth: 0, flyN: 0, name: '', ending: false };

  const A = window.Art || {};
  function art(fn) { try { return A[fn] ? A[fn].apply(A, Array.prototype.slice.call(arguments, 1)) : ''; } catch (e) { return ''; } }
  const ic = n => '<span class="ic">' + art('icon', n) + '</span>';
  const won = R.won;
  const pct = (v, d) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(d == null ? 1 : d) + '%';
  const sign = n => (n >= 0 ? '+' : '') + won(n);
  const cls = v => (v > 0 ? 'up' : v < 0 ? 'down' : 'dim');
  const arrow = v => (v > 0 ? '오름' : '내림');
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
  function setMute(m) { ui.mute = m; if (audio) audio.out.gain.value = m ? 0 : tune.volume; if (scene === 'play') renderTop(); }
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
    deny: () => tone(150, 0.16, 'sawtooth', 0.12),
    bad: () => { tone(330, 0.2, 'sawtooth', 0.16); tone(196, 0.4, 'sawtooth', 0.16, 0.16); },
    tickUp: () => tone(880, 0.05, 'sine', 0.1), tickDown: () => tone(440, 0.05, 'sine', 0.1),
    night: () => { tone(392, 0.25, 'sine', 0.16); tone(294, 0.4, 'sine', 0.16, 0.2); },
  };

  // ── 입력: 키는 한 걸음에 하나씩 처리, 클릭은 data-do 로 ──
  const hit = [];
  addEventListener('keydown', e => {
    startAudio();
    if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Enter') { e.preventDefault(); hit.push('Enter'); } return; }
    if (e.repeat) return;
    hit.push(e.code);
    if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
  });
  stage.addEventListener('pointerdown', e => {
    startAudio();
    const b = e.target.closest('[data-mg]'); // 미니게임 버튼은 누르는 순간 반응
    if (b && ui.modal && ui.modal.type === 'mg' && !ui.modal.res) { try { ui.modal.mg.press(b.dataset.mg); } catch (err) { /* 무시 */ } e.preventDefault(); return; }
    if (e.target.id === 'mgc' && ui.modal && ui.modal.type === 'mg' && !ui.modal.res) { // 그림을 직접 눌러도 됨: 가로로 나눈 칸이 조작 버튼 순서와 같다
      const cs = ui.modal.mg.controls || [], r = e.target.getBoundingClientRect();
      if (cs.length) { try { ui.modal.mg.press(cs[clamp(Math.floor((e.clientX - r.left) / r.width * cs.length), 0, cs.length - 1)].code); } catch (err) { /* 무시 */ } e.preventDefault(); }
    }
  });
  const hold = n => { ui.guard = Math.max(ui.guard, n); }; // n 걸음 동안 누름을 버림 (60걸음 = 1초)
  stage.addEventListener('click', e => {
    const sr = stage.getBoundingClientRect();
    ui.from = { x: (e.clientX - sr.left) / sr.width * 1280, y: (e.clientY - sr.top) / sr.height * 720 }; // 번 돈 숫자가 떠오를 자리
    const el = e.target.closest('[data-do]');
    if (!el || el.disabled) return;
    if (ui.guard > 0) return; // 창이 막 뜨거나 닫힌 직후의 누름은 버림 (같은 누름이 다음 것까지 누르지 않게)
    run(el.dataset.do, el.dataset.arg);
  });

  // ── 장면 전환 ──
  function show(name) {
    scene = name;
    for (const n of ['title', 'play', 'results', 'figures']) $('s-' + n).classList.toggle('hide', n !== name);
    if (name !== 'play') { ui.modal = null; ui.queue = []; renderVeil(); }
    $('fx').innerHTML = ''; $('toast').innerHTML = '';
  }

  function hasSave() { if (MANUAL) return null; try { return R.load(localStorage.getItem(SAVE) || ''); } catch (e) { return null; } }
  function newGame() {
    let seed = Number(params.get('seed'));
    if (!seed) {
      let runs = 0;
      if (!MANUAL) try { runs = Number(localStorage.getItem(RUNS)) || 0; localStorage.setItem(RUNS, String(runs + 1)); } catch (e) { /* 저장을 못 써도 게임은 됨 */ }
      seed = CONFIG.seed + runs * 101; // 판마다 시세가 다르게
    }
    S = R.create(seed, ui.name);
    begin();
  }
  function begin() {
    ui.tab = 'ladder'; ui.sel = 'daejang'; ui.fresh = {}; ui.flash = {}; ui.queue = []; ui.modal = null; ui.ending = false;
    if (S.pending) { const id = S.pending; S.pending = null; if (R.doJob(S, id, null)) S.log.push({ day: S.day, text: '하다 만 알바는 대충 한 것으로 처리했습니다.', tone: 'warn' }); }
    ui.cash = S.cash; ui.worth = R.worth(S);
    show('play');
    drain(); render();
  }
  function saveNow() { if (MANUAL) return; try { localStorage.setItem(SAVE, R.save(S)); } catch (e) { /* 무시 */ } }
  function clearSave() { if (MANUAL) return; try { localStorage.removeItem(SAVE); } catch (e) { /* 무시 */ } }

  // ── 누름 처리 ──
  function run(what, arg) {
    if (what === 'mute') { setMute(!ui.mute); return; }
    if (scene === 'title') {
      if (what === 'new') {
        const i = $('name'); ui.name = i ? i.value : '';
        if (hasSave() && !ui.askNew) { ui.askNew = true; sfx.deny(); renderTitle(); return; } // 저장이 있으면 한 번 더 눌러야 지워짐
        ui.askNew = false; sfx.up(); newGame();
      }
      else if (what === 'continue') { const s = hasSave(); if (s) { S = s; sfx.click(); begin(); } }
      return;
    }
    if (scene === 'results') { if (what === 'again') { sfx.click(); ui.askNew = false; renderTitle(); show('title'); } return; }
    if (scene !== 'play') return;
    const m = ui.modal;
    if (m) { // 창이 떠 있으면 창의 버튼만
      if (what === 'ok') closeModal(true);
      else if (what === 'no') closeModal(false);
      return;
    }
    if (what === 'quit') { saveNow(); sfx.click(); ui.askNew = false; renderTitle(); show('title'); return; }
    if (what === 'why') { deny(arg); return; }
    if (what === 'tab') { ui.tab = arg; ui.fresh[arg] = false; sfx.click(); renderStatus(); renderPanel(); return; }
    if (what === 'sel') { ui.sel = arg; sfx.click(); renderPanel(); return; }
    if (what === 'lev') { ui.lev = Number(arg); sfx.click(); renderPanel(); return; }
    if (what === 'share') { ui.share = Number(arg); sfx.click(); renderPanel(); return; }
    if (what === 'job') { startJob(arg); return; }
    if (what === 'skip') { if (R.doJob(S, arg, null)) { sfx.pay(); hold(20); } else deny('체력이 모자랍니다'); done(); return; }
    if (what === 'rest') { if (R.doRest(S)) { sfx.click(); hold(20); } done(); return; }
    if (what === 'study') { if (R.doStudy(S)) { sfx.ding(); hold(20); } ui.tab = R.unlocked(S, 'stock') && ui.tab === 'ladder' ? 'stock' : ui.tab; done(); return; }
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
      return;
    }
  }
  function sleepNow() { if (R.endDay(S)) { sfx.night(); S.ev.length = 0; openModal({ type: 'night', sum: S.last }); render(); } }
  function done() { drain(); render(); if (!S.ended && !(ui.modal && ui.modal.type === 'mg')) saveNow(); } // 행동 하나마다 저장 (새로 고쳐서 되돌리기 없음)
  function deny(why) {
    sfx.deny();
    if (!why) return;
    $('toast').innerHTML = '<div>' + esc(why) + '</div>';
  }

  function key(code) {
    if (code === 'KeyM') { setMute(!ui.mute); return; }
    if (scene === 'title') { if (code === 'Enter') run(hasSave() ? 'continue' : 'new'); return; }
    if (scene === 'results') { if (ui.guard === 0 && (code === 'Enter' || code === 'KeyR')) run('again'); return; }
    if (scene !== 'play') return;
    const m = ui.modal;
    if (m) {
      if (m.type === 'mg' && !m.res) { try { m.mg.press(code); } catch (e) { /* 미니게임의 오류가 판을 멈추지 않게 */ } return; }
      if (ui.guard > 0) return;
      if (m.type === 'confirm' && m.kind === 'sleep') { if (code === 'Space' || code === 'Enter' || code === 'Escape') closeModal(false); return; } // 키로는 돌아가기만: 자는 건 버튼으로
      if (code === 'Space' || code === 'Enter') closeModal(true);
      else if (code === 'Escape' && m.type === 'confirm') closeModal(false);
      return;
    }
    if (ui.guard > 0) return;
    const d = /^Digit([1-9])$/.exec(code) || /^Numpad([1-9])$/.exec(code);
    if (d && S.slot < 3) { const a = R.acts(S)[Number(d[1]) - 1]; if (a && !a.ok) deny(a.why); else if (a) run(a.kind === 'job' ? 'job' : a.kind, a.id); return; }
    if ((code === 'Space' || code === 'Enter') && S.slot >= 3) run('endday');
  }

  // ── 규칙이 쌓아 둔 사건을 화면으로 ──
  function drain() {
    const evs = S.ev.splice(0);
    const homeQuest = evs.some(e => e.t === 'quest_done' && /^(roof|address|oneroom)$/.test(e.quest.id)); // 이사로 끝난 퀘스트 창이 "열림"을 이미 알려 줌
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      events.push(e);
      if (e.t === 'money' && e.amt > 0) fly('+' + won(e.amt), 'gold', e.label === '퀘스트 보상' ? { x: 250, y: 600 } : null);
      else if (e.t === 'tick') { for (const id in e.chg) ui.flash[id] = e.chg[id]; }
      else if (e.t === 'quest_done') { // 다음 퀘스트: 다음 완료 전까지 나온 것 중 마지막 (보상 지급 · 건너뛰기가 사이에 낌)
        let nx = null;
        for (let j = i + 1; j < evs.length && evs[j].t !== 'quest_done'; j++) if (evs[j].t === 'quest_new') nx = evs[j].quest;
        ui.queue.push({ type: 'quest', done: e.quest, next: nx });
      }
      else if (e.t === 'intro') ui.queue.push({ type: 'intro', next: e.quest });
      else if (e.t === 'quest_skip' || e.t === 'quest_new') pingStatus();
      else if (e.t === 'tier') {
        if (e.up && e.to === 2) ui.fresh.stock = true;
        if (e.up && e.to === 3) ui.fresh.coin = true;
        if (e.up && !homeQuest) ui.queue.push({ type: 'tier', e });
      }
      else if (e.t === 'liq') ui.queue.push({ type: 'liq', e });
      else if (e.t === 'deny') deny(e.why);
      else if (e.t === 'sys') pingStatus();
      else if (e.t === 'ending') ui.ending = true;
    }
    pump();
  }
  function pump() { // 뜰 창이 남았으면 하나씩
    if (ui.modal) return;
    if (ui.queue.length) { openModal(ui.queue.shift()); return; }
    if (ui.ending) { ui.ending = false; ui.guard = 45; clearSave(); renderResults(); show('results'); if (S.ended.kind === 'home') sfx.up(); else sfx.bad(); }
  }
  function openModal(m) {
    ui.modal = m; hold(m.type === 'night' ? 30 : 18); $('veil').classList.add('arming'); // 0.3~0.5초: 연달아 누른 것이 새 창을 닫지 않게 (그동안 버튼이 흐림)
    if (m.type === 'quest') sfx.ding(); else if (m.type === 'tier') sfx.up(); else if (m.type === 'liq') sfx.bad(); else if (m.type === 'intro') sfx.ding();
    renderVeil();
  }
  function closeModal(yes) {
    const m = ui.modal;
    if (!m) return;
    hold(16);
    if (m.type === 'mg') { if (!m.res) return; ui.modal = null; ui.from = { x: 640, y: 330 }; renderVeil(); sfx.pay(); done(); return; }
    if (m.type === 'night') { ui.modal = null; R.nextDay(S); if (!S.ended) saveNow(); renderVeil(); done(); return; }
    if (m.type === 'confirm') {
      ui.modal = null; renderVeil();
      if (yes && m.kind === 'sleep') { sleepNow(); return; }
      if (yes) { if (m.kind === 'move') { if (R.move(S, m.to)) sfx.up(); } else if (m.kind === 'house') R.buyHouse(S); }
      done(); return;
    }
    ui.modal = null; sfx.click(); renderVeil(); pump(); render();
  }
  function pingStatus() { const el = $('status'); el.classList.remove('ping'); void el.offsetWidth; el.classList.add('ping'); }
  function fly(text, color, from) {
    const d = document.createElement('div'), o = from || ui.from || { x: 640, y: 200 }, n = ui.flyN++ % 3;
    d.className = 'fly ' + color; d.textContent = text;
    const x = clamp(o.x - 40 + n * 12, 20, 1180), y = clamp(o.y - 30 + n * 24, 70, 660);
    d.style.left = x + 'px'; d.style.top = y + 'px';
    d.style.setProperty('--dx', (640 - x) + 'px'); d.style.setProperty('--dy', (34 - y) + 'px'); // 위쪽 띠의 현금 칸으로
    $('fx').appendChild(d);
    d.addEventListener('animationend', () => d.remove());
    while ($('fx').children.length > 6) $('fx').firstChild.remove();
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
    S.pending = id; saveNow(); // 하다가 새로 고치면 "대충" 한 것으로 처리된다
    ui.modal = { type: 'mg', id, act: a, mg, res: null }; ui.guard = 0;
    renderVeil();
  }
  function finishMg() {
    const m = ui.modal, r = m.mg.result || { score: 0 };
    const score = clamp(Number(r.score) || 0, 0, 1);
    S.pending = null;
    R.doJob(S, m.id, score);
    saveNow();
    const j = S.ev.find(e => e.t === 'job') || { pay: 0, grade: 'ok', gradeName: '보통', mult: 1, hp: 0 };
    m.res = { score, pay: j.pay, grade: j.grade, gradeName: j.gradeName, mult: j.mult, hp: j.hp };
    hold(36); $('veil').classList.add('arming'); // 미니게임의 마지막 누름이 결과 창을 닫지 않게
    if (j.grade === 'miss') sfx.deny(); else if (j.grade === 'perfect') sfx.up(); else sfx.ding();
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

  // ── 그리기: 위쪽 띠 ──
  function renderTop() {
    const price = R.housePrice(S), w = R.worth(S), left = tune.days - S.day + 1; // 오늘 포함
    $('top').innerHTML =
      '<div class="day"><b>' + R.weekOf(S.day) + '주차</b>' + S.day + '일째</div>' +
      '<div class="slots">' + SLOTS.map((n, i) => '<span class="' + (i < S.slot ? 'done' : i === S.slot ? 'now' : '') + '">' + n + '</span>').join('') + '</div>' +
      '<div class="grow"></div>' +
      '<div class="money"><i>현금</i><b id="cash">' + won(ui.cash) + '</b></div>' +
      '<div class="money"><i>순자산</i><b id="worth">' + won(ui.worth) + '</b></div>' +
      '<div class="house"><i>집값 ' + won(price) + ' · ' + (left > 1 ? '남은 날 ' + left + '일' : '오늘이 마지막 날') + '</i><div class="bar"><div style="width:' + (clamp(w / price, 0, 1) * 100).toFixed(1) + '%"></div></div><b>' + Math.floor(clamp(w / price, 0, 9.99) * 100) + '%</b></div>' +
      '<button class="btn small" data-do="mute" title="소리 (M)">' + ic(ui.mute ? 'mute' : 'sound') + '</button>' +
      '<button class="btn small quit" data-do="quit" title="제목 화면으로 (지금까지는 저장됨)">처음</button>';
  }

  // ── 그리기: 장면 + 상태창 ──
  function renderScene() {
    const ph = PHASE[Math.min(3, S.slot)];
    $('scene').innerHTML = art('scene', Math.min(3, S.tier), ph) + '<div class="where">' + R.HOMES[S.tier].name + ' · ' + (S.slot < 3 ? SLOTS[S.slot] : '밤') + '</div>';
  }
  function progText(q) {
    if (q.unit === '원') return won(q.cur) + ' / ' + won(q.goal);
    return q.cur + ' / ' + q.goal + (q.unit || '');
  }
  function renderStatus() {
    const q = R.questView(S), b = R.bill(S), rise = R.riseIn(S), last = S.log[S.log.length - 1];
    const goBtn = q && q.go && q.go !== ui.tab && (q.go === 'ladder' || R.unlocked(S, q.go)) ? '<button class="chip hot go" data-do="tab" data-arg="' + q.go + '">' + ({ ladder: '사다리', stock: '주식', coin: '코인' })[q.go] + ' 탭 열기</button>' : '';
    const news = R.unlocked(S, 'stock') ? R.todayNews(S).filter(n => n.asset !== 'coin' || R.unlocked(S, 'coin')).length : 0;
    $('status').innerHTML =
      '<div class="st-head"><span class="tag">상태창</span><span class="name">' + esc(S.name) + '</span><span class="title">' + esc(S.title) + '</span></div>' +
      '<div class="st-hp">' + ic('hp') + '<span>체력</span><div class="bar' + (S.hp < 25 ? ' low' : '') + '"><div style="width:' + S.hp + '%"></div></div><b>' + Math.round(S.hp) + ' / 100</b></div>' +
      '<div class="st-line"></div>' +
      (q ? '<div class="q-top">' + ic('quest') + '<span>퀘스트 ' + q.n + ' / ' + q.of + '</span>' + (q.near ? '<span class="near">거의 다 됨</span>' : '') + goBtn + '</div>' +
        '<div class="q-title">' + esc(q.title) + '</div><div class="q-desc">' + esc(q.desc) + '</div>' +
        '<div class="q-prog"><div class="bar"><div style="width:' + (q.pct * 100).toFixed(1) + '%"></div></div><b>' + progText(q) + '</b></div>' +
        '<div class="q-reward">보상 <b>' + esc(q.reward) + '</b></div>' : '<div class="q-title">모든 퀘스트 완료</div>') +
      '<div class="st-line"></div>' +
      '<div class="st-log">' + (last ? '<div class="' + last.tone + '">[시스템] ' + esc(last.text) + '</div>' : '') + '</div>' +
      '<div class="st-due">' +
      (b ? '<span class="chip' + (b.inDays <= 1 ? ' hot' : '') + '">고정비 ' + (b.inDays === 0 ? '오늘 밤' : b.inDays + '일 뒤') + ' · ' + won(b.amt) + '</span>' : '') +
      (rise ? '<span class="chip' + (rise <= 1 ? ' hot' : '') + '">집값 인상 ' + (rise === 1 ? '내일' : rise + '일 뒤') + '</span>' : '') +
      (news ? '<span class="chip">오늘 소식 ' + news + '건</span>' : '') + '</div>';
  }

  // ── 그리기: 지금 할 일 ──
  function renderActs() {
    if (S.slot >= 3) {
      const b = R.bill(S), due = b && b.inDays === 0;
      $('acts').innerHTML = '<div class="sec-h">오늘 할 일을 다 했습니다 <i>자기 전에 매매 · 이사를 할 수 있습니다</i></div><div class="cards">' +
        '<button class="card wide go" data-do="endday"><span class="pic">' + art('act', 'rest') + '</span><span><span class="big">하루 마치기</span><br><span class="sub">' +
        (S.day >= tune.days ? '<b class="bad">마지막 밤입니다. 집을 계약하지 않으면 여기서 끝납니다.</b>' : due ? '<b class="gold">오늘 밤 고정비 ' + won(b.amt) + (S.cash < b.amt ? ' — 현금이 모자랍니다</b>' : '</b>') : '밤 정산을 보고 잠듭니다') + '</span></span><span class="key">Space</span></button></div>';
      return;
    }
    const acts = R.acts(S);
    $('acts').innerHTML = '<div class="sec-h">지금 할 일 — ' + SLOTS[S.slot] + ' <i>한 칸에 하나' + (R.unlocked(S, 'stock') ? ' · 고르면 시세가 한 번 움직입니다' : ' · "대충"은 미니게임 없이 일당의 ' + Math.round(tune.mult_skip * 100) + '%만') + '</i></div><div class="cards">' + acts.map((a, i) => {
      const k = '<span class="key">' + (i + 1) + '</span>';
      if (a.kind === 'job') {
        const lv = '<span class="lv" title="숙련도: 직접 한 횟수가 ' + tune.skill_n1 + ' · ' + tune.skill_n2 + ' · ' + tune.skill_n3 + '번이 되면 일당이 ' + Math.round(tune.skill_bonus * 100) + '%씩 오릅니다">' + [1, 2, 3].map(n => '<s class="' + (a.lv >= n ? 'on' : '') + '"></s>').join('') + '</span>';
        return '<div class="card ' + (a.ok ? 'go' : 'off') + '" ' + (a.ok ? 'data-do="job" data-arg="' + a.id + '" role="button"' : 'data-do="why" data-arg="' + a.why + '"') + '>' + k + lv +
          '<span class="pic">' + art('job', a.id) + '</span><span class="nm">' + a.name + '</span><span class="pay">+' + won(a.pay) + '</span>' +
          (a.ok ? '<span class="sub">체력 −' + a.hp + '</span><button class="skip" data-do="skip" data-arg="' + a.id + '" title="미니게임 없이 일당의 ' + Math.round(tune.mult_skip * 100) + '%만 받고 넘어갑니다. 숙련도는 오르지 않습니다.">대충 ×' + tune.mult_skip + '</button>' : '<span class="why">' + a.why + ' (−' + a.hp + ')</span>') + '</div>';
      }
      return '<div class="card ' + (a.ok ? 'go' : 'off') + '" ' + (a.ok ? 'data-do="' + a.kind + '" role="button"' : 'data-do="why" data-arg="' + a.why + '"') + '>' + k + '<span class="pic">' + art('act', a.id) + '</span><span class="nm">' + a.name + '</span>' +
        (a.kind === 'rest' ? '<span class="pay good">체력 +' + (-a.hp) + '</span>' : '<span class="pay sys">리포트</span>') + (a.ok ? '<span class="sub">' + (a.note || '') + '</span>' : '<span class="why">' + a.why + '</span>') + '</div>';
    }).join('') + '</div>';
  }

  // ── 그리기: 사다리 / 주식 / 코인 ──
  function renderPanel() {
    const tabs = [['ladder', '주거 사다리']];
    if (R.unlocked(S, 'stock')) tabs.push(['stock', '주식']);
    if (R.unlocked(S, 'coin')) tabs.push(['coin', '코인']);
    if (!tabs.some(t => t[0] === ui.tab)) ui.tab = 'ladder';
    if (ui.tab === 'stock' && ui.sel === 'coin') ui.sel = 'daejang';
    const hint = ui.tab === 'ladder' ? '올라가면 잠이 좋아지고 새 일이 열립니다' : '매매는 칸을 안 씁니다 · 시세는 칸(오전 · 오후 · 저녁)마다 움직입니다';
    $('panel').innerHTML = '<div class="tabs">' + tabs.map(t => '<button class="' + (ui.tab === t[0] ? 'on' : ui.fresh[t[0]] ? 'new' : '') + '" data-do="tab" data-arg="' + t[0] + '">' + t[1] + '</button>').join('') +
      '<span class="hint">' + hint + '</span></div><div class="pbody">' + (ui.tab === 'ladder' ? ladderHtml() : tradeHtml(ui.tab)) + '</div>';
    if (ui.tab !== 'ladder') drawChart($('chart'), ui.tab === 'coin' ? 'coin' : ui.sel);
    ui.flash = {};
  }
  function ladderHtml() {
    const price = R.housePrice(S), w = R.worth(S), rise = R.riseIn(S);
    const rows = [
      [['끼니', '하루 ' + won(tune.meal_cost)], ['잠', '체력 +' + tune.sleep_station]],
      [['하룻밤', won(tune.sauna_night)], ['끼니', '하루 ' + won(tune.meal_cost)], ['잠', '체력 +' + tune.sleep_sauna]],
      [['보증금', won(tune.gosiwon_deposit)], ['매주', won(tune.gosiwon_week)], ['잠', '체력 +' + tune.sleep_gosiwon]],
      [['보증금', won(tune.oneroom_deposit)], ['매주', won(tune.oneroom_week)], ['잠', '체력 +' + tune.sleep_oneroom]],
      [['집값', won(price)], ['매주', '+' + Math.round(tune.house_growth * 100) + '% 오름']],
    ];
    return '<div class="ladder">' + R.HOMES.map((h, t) => {
      let foot;
      if (t === 4) {
        const ok = w >= price;
        foot = '<div class="bar"><div style="width:' + (clamp(w / price, 0, 1) * 100).toFixed(1) + '%"></div></div>' +
          (ok ? '<button class="btn warm" data-do="house">집 계약</button>' : '<div class="why">순자산 ' + won(price - w) + ' 더' + (rise ? '<br>인상까지 ' + rise + '일' : '') + '</div>');
      } else if (t === S.tier) foot = '<div class="why sys">지금 여기</div>';
      else if (t < S.tier) foot = '<div class="why">지나옴</div>';
      else if (t === S.tier + 1) { const info = R.moveInfo(S, t); foot = info.ok ? '<button class="btn main" data-do="move" data-arg="' + t + '">옮기기</button>' : '<div class="why">' + info.why + '</div>'; }
      else foot = '<div class="why">앞 단계부터</div>';
      return '<div class="rung ' + (t === S.tier ? 'here' : t < S.tier ? 'past' : '') + '"><div class="th">' + art('thumb', t) + '</div><div class="in"><div class="nm">' + h.name + (t === S.tier ? '<i>여기</i>' : '') + '</div>' +
        (t < S.tier || (t > S.tier + 1 && t < 4) ? '' : '<dl>' + rows[t].map(r => '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>').join('') + '</dl>') + // 지나온 곳 · 아직 먼 곳은 숫자를 접어 둠
        (t < S.tier || (t > S.tier + 1 && t < 4) ? '' : '<div class="open">열림: ' + h.unlock + '</div>') + '<div class="foot">' + foot + '</div></div></div>';
    }).join('') + '</div>';
  }
  function todayChg(id) { const h = S.market.hist[id], open = h[h.length - 1 - Math.min(3, S.slot)]; return S.slot === 0 ? null : S.market.px[id] / open - 1; }
  const pxText = id => Math.round(S.market.px[id]).toLocaleString('en-US') + '원';
  function newsHtml() {
    const coin = R.unlocked(S, 'coin');
    const today = R.todayNews(S).filter(n => n.asset !== 'coin' || coin), intel = R.intelView(S);
    const item = n => '<div class="nitem"><span class="src ' + n.src + '" title="' + n.srcNote + '">' + n.srcName + '</span><span class="tx"><b class="' + cls(n.dir) + '">' + (n.dir > 0 ? '호재' : '악재') + '</b> ' + esc(n.head) + '</span>' + (n.report ? '<b class="rep ' + cls(n.report) + '">리포트: ' + arrow(n.report) + '</b>' : '') + '</div>';
    const left = '<h4>오늘 소식 <span class="dim">— 공시는 거의 확실 · 기사는 대체로 · 찌라시는 반반</span></h4>' + (today.length ? today.map(item).join('') : '<div class="nitem dim">오늘은 조용합니다.</div>');
    let right;
    if (intel) {
      const its = intel.items.filter(i => i.asset !== 'coin' || coin), ht = intel.ht;
      const htText = ht.phase === 'gather' ? (ht.soon ? '사 모으는 중 · 급등이 가깝다' : '사 모으는 중 · 급등은 아직') : ht.phase === 'pump' ? '급등 중 · 폭락이 가깝다' : ht.phase === 'dump' ? '폭락 중' : ht.soon ? '잠잠 · 곧 움직인다' : '잠잠';
      right = '<h4>내일 리포트 <span class="dim">— 진짜 방향 · ' + Math.round(tune.study_acc * 100) + '% 맞음</span></h4>' + (its.length ? its.map(i => '<div class="nitem"><span class="tx">' + i.name + '</span><b class="rep ' + cls(i.dir) + '">' + arrow(i.dir) + '</b></div>').join('') : '<div class="nitem dim">내일은 소식이 없습니다.</div>') +
        '<div class="nitem"><span class="tx">한탕바이오</span><b class="rep warm">' + htText + '</b></div>';
    } else right = '<h4>내일 리포트</h4><div class="nitem dim wrap">한 칸을 "공부"에 쓰면 내일 소식의 진짜 방향이 여기에 뜹니다.</div>';
    return '<div class="newsbox"><div>' + left + '</div><div>' + right + '</div></div>';
  }
  function tradeHtml(tab) {
    const coinTab = tab === 'coin', cur = coinTab ? 'coin' : ui.sel, a = R.ASSETS.find(x => x.id === cur), c = todayChg(cur);
    let left, main;
    if (coinTab) { // 왼쪽 = 주문 칸(또는 내 포지션), 오른쪽 = 차트와 버튼. 정리 버튼은 롱 · 숏과 다른 자리에 둔다
      const l = S.lev;
      if (l) {
        const v = R.levValue(S), p = v - l.put, side = l.dir > 0 ? '<b class="up">롱</b>' : '<b class="down">숏</b>';
        left = '<div class="levform"><div class="lab">내 포지션</div><dl class="pos"><dt>방향</dt><dd>' + side + (l.dir > 0 ? ' (오르면 이익)' : ' (내리면 이익)') + '</dd><dt>배율</dt><dd>' + l.lev + '배</dd><dt>증거금</dt><dd>' + won(l.put) + '</dd><dt>지금 값</dt><dd class="' + cls(p) + '">' + won(v) + '</dd><dt>청산가</dt><dd class="bad">' + Math.round(R.levLiq(l)).toLocaleString('en-US') + '원</dd></dl>' +
          '<div class="note">칸마다 증거금의 ' + (l.lev * tune.lev_fund * 100).toFixed(1) + '%가 유지비로 나갑니다.</div></div>';
        main = '<div class="mine-line"><span>' + side + ' ' + l.lev + '배</span><span>지금 <b class="' + cls(p) + '">' + won(v) + ' (' + sign(p) + ')</b></span></div>' +
          '<div class="order" style="justify-content:space-between"><span class="note" style="margin:0">청산가에 닿으면 증거금을 전부 잃습니다</span><button class="btn warm" data-do="close">정리하기</button></div>';
      } else {
        const m = Math.floor(S.cash * ui.share);
        left = '<div class="levform"><div class="lab">배율</div><div class="seg">' + [1, 2, 3, 5].map(n => '<button class="' + (ui.lev === n ? 'on' : '') + '" data-do="lev" data-arg="' + n + '">' + n + '배</button>').join('') + '</div>' +
          '<div class="lab">증거금 (현금에서)</div><div class="seg">' + [0.25, 0.5, 1].map(n => '<button class="' + (ui.share === n ? 'on' : '') + '" data-do="share" data-arg="' + n + '">' + Math.round(n * 100) + '%</button>').join('') + '</div>' +
          '<div class="note">들고 있으면 칸마다 증거금의 ' + (ui.lev * tune.lev_fund * 100).toFixed(1) + '%가 유지비로 나갑니다. 소식이 맞아도 코인은 제멋대로 출렁입니다. 포지션은 한 번에 하나.</div></div>';
        main = '<div class="mine-line"><span>' + ui.lev + '배 · 증거금 <b>' + won(m) + '</b></span><span class="dim">맞히면 움직임의 ' + ui.lev + '배 · 반대로 <b class="bad">' + Math.round(100 / ui.lev) + '%</b> 가면 전부 잃음(청산)</span></div>' +
          '<div class="order"><button class="btn up" data-do="long"' + (m < 100000 ? ' disabled' : '') + '>롱 — 오른다에 건다</button><button class="btn down" data-do="short"' + (m < 100000 ? ' disabled' : '') + '>숏 — 내린다에 건다</button>' + (m < 100000 ? '<span class="note" style="margin:0">증거금은 10만 원부터</span>' : '') + '</div>';
      }
    } else {
      left = R.ASSETS.filter(x => x.kind === 'stock').map(x => {
        const d = todayChg(x.id), h = S.hold[x.id], v = R.holdValue(S, x.id), f = ui.flash[x.id];
        return '<button class="arow ' + (x.id === cur ? 'on' : '') + (f > 0 ? ' flash-up' : f < 0 ? ' flash-down' : '') + '" data-do="sel" data-arg="' + x.id + '"><span class="em">' + art('asset', x.id) + '</span><span class="bd">' +
          '<span class="l1"><span class="nm">' + x.name + '<i>' + x.tag + '</i></span><span class="px">' + pxText(x.id) + '</span></span>' +
          '<span class="l2"><span class="mine' + (h.units > 0 ? ' ' + cls(v - h.cost) : '') + '">' + (h.units > 0 ? '보유 ' + won(v) : '보유 없음') + '</span><span class="chg ' + (d == null ? 'dim' : cls(d)) + '">' + (d == null ? '오늘 —' : '오늘 ' + pct(d)) + '</span></span></span></button>';
      }).join('');
      const h = S.hold[cur], v = R.holdValue(S, cur), dis = ok => (ok ? '' : ' disabled style="opacity:.4"');
      main = '<div class="mine-line">' + (h.units > 0 ? '<span>보유 <b>' + won(v) + '</b></span><span>산 값 ' + won(h.cost) + '</span><span class="' + cls(v - h.cost) + '">평가 ' + sign(v - h.cost) + ' (' + pct(v / h.cost - 1) + ')</span>' : '<span class="dim">아직 없음 — ' + a.hint + '</span>') + '</div>' +
        '<div class="order"><span class="lab">사기</span><div class="seg">' + [100000, 500000, 1000000].map(n => '<button data-do="buy" data-arg="' + n + '"' + dis(S.cash >= n) + '>' + won(n) + '</button>').join('') + '<button data-do="buy" data-arg="all"' + dis(S.cash >= 10000) + '>현금 전부</button></div>' +
        '<span class="lab" style="margin-left:8px">팔기</span><div class="seg"><button data-do="sell" data-arg="0.5"' + dis(h.units > 0) + '>절반</button><button data-do="sell" data-arg="1"' + dis(h.units > 0) + '>전부</button></div></div>';
    }
    return newsHtml() + '<div class="trade"><div class="alist">' + left + '</div><div class="tmain">' +
      '<div class="thead"><b>' + a.name + '</b><span class="p">' + pxText(cur) + '</span><span class="' + (c == null ? 'dim' : cls(c)) + '">' + (c == null ? '' : '오늘 ' + pct(c)) + '</span><span class="h">' + a.tag + (coinTab ? ' · 열 때 수수료 ' + (tune.lev_fee * 100).toFixed(1) + '% × 배율' : ' · 사고팔 때 수수료 ' + (tune.fee * 100).toFixed(1) + '%') + '</span></div>' +
      '<div class="chart"><canvas id="chart" width="1020" height="232"></canvas></div>' + main + '</div></div>';
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
      if (r >= 0 && r % 3 === 0) { c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(X(i), 0, 2, Hc); if ((r / 3) % 2 === 0 || n < 30) { c.fillStyle = PAL.dim; c.fillText((r / 3 + 1) + '일', X(i) + 6, 4); } }
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

  // ── 그리기: 겹쳐 뜨는 창 ──
  const okBtn = t => '<div class="foot"><button class="btn main" data-do="ok">' + (t || '확인') + ' <span class="key">Space</span></button></div>';
  function nextBox(q) { return q ? '<div class="nextbox"><i>다음 퀘스트 ' + q.n + ' / ' + q.of + '</i><b>' + esc(q.title) + '</b><span>' + esc(q.desc) + '</span></div>' : ''; }
  function renderVeil() {
    const v = $('veil'), m = ui.modal;
    v.classList.toggle('hide', !m);
    if (!m) { v.innerHTML = ''; return; }
    if (m.type === 'mg') {
      if (!v.querySelector('.mg')) {
        v.innerHTML = '<div class="win mg corner"><div class="mg-head"><b>' + esc(m.mg.title || m.act.name) + '</b><span>' + esc(m.mg.howto || '') + '</span><i>일당 ' + won(m.act.pay) + ' · 잘할수록 ×' + tune.mult_miss + '~' + tune.mult_perfect + '</i></div>' +
          '<canvas id="mgc" class="mg-canvas" width="1760" height="760"></canvas><div class="mg-ctl">' + (m.mg.controls || []).map(c => '<button class="btn" data-mg="' + c.code + '">' + esc(c.label) + ' <span class="key">' + keyName(c.code) + '</span></button>').join('') + '</div><div id="mgres"></div></div>';
      }
      if (m.res) {
        $('mgres').innerHTML = '<div class="mg-res"><div class="g ' + m.res.grade + '">' + m.res.gradeName + '</div><div class="m">+' + won(m.res.pay) + '</div><div class="s">일당 ' + won(m.act.pay) + ' × ' + m.res.mult + ' · 체력 −' + m.res.hp + '</div>' + okBtn() + '</div>';
        v.querySelector('.mg-ctl').innerHTML = '';
      }
      drawMg();
      return;
    }
    if (m.type === 'intro') {
      v.innerHTML = '<div class="win pop corner"><div class="sweep"></div><h2>[시스템]</h2><h3>상태창이 열렸습니다</h3><p>' + esc(S.name) + ' 님, 각성을 축하합니다. 현금 0원. 주소 없음. 이 창은 당신에게만 보입니다. 시키는 대로 하면 집을 살 수 있습니다. 아마도.</p><p class="dim">' + tune.days + '일 안에 집값만큼 모으면 됩니다. 집값은 매주 오릅니다.</p>' + nextBox(m.next) + okBtn('시작') + '</div>';
    } else if (m.type === 'quest') {
      v.innerHTML = '<div class="win pop corner"><div class="sweep"></div><h2>[시스템] 퀘스트 완료</h2><h3>' + esc(m.done.title) + '</h3><div class="rewardbox">보상 <b class="gold">' + esc(m.done.reward) + '</b></div>' + nextBox(m.next) + okBtn() + '</div>';
    } else if (m.type === 'tier') {
      v.innerHTML = '<div class="win pop corner"><div class="sweep"></div><h2>[시스템] 주거 변경</h2><h3>' + esc(m.e.name) + '</h3><div class="rewardbox">열림 <b class="gold">' + esc(m.e.unlock || '') + '</b></div>' + okBtn() + '</div>';
    } else if (m.type === 'liq') {
      v.innerHTML = '<div class="win pop corner bad"><h2>[시스템] 청산</h2><h3>증거금 ' + won(m.e.lost) + '이 사라졌습니다</h3><p>' + m.e.lev + '배 ' + (m.e.dir > 0 ? '롱' : '숏') + ' 포지션이 반대로 ' + Math.round(100 / m.e.lev) + '% 움직였습니다. 배율을 낮추거나, 확실할 때만 크게 거세요.</p>' + okBtn() + '</div>';
    } else if (m.type === 'confirm') {
      if (m.kind === 'move') {
        const h = R.HOMES[m.to], wk = R.weekCost(S, m.to), after = S.cash - m.info.pay, tonight = S.day % 7 === 0 ? Math.round(wk / 7 / 1000) * 1000 : 0;
        v.innerHTML = '<div class="win pop corner"><h2>[시스템] 입주 확인</h2><h3>' + h.name + '에 입주할까요?</h3><p>보증금 <b>' + won(m.info.dep) + '</b> (나갈 때 돌려받으니 순자산은 그대로)' + (S.deposit ? '<br>지금 보증금 ' + won(S.deposit) + '을 돌려받아, 현금은 <b>' + won(m.info.pay) + '</b>이 나갑니다' : '') + (m.info.settle ? '<br>살던 ' + R.HOMES[S.tier].name + '의 이번 주 고정비는 산 날만큼 ' + won(m.info.settle) + '을 지금 정산합니다' : '') + '<br>매주 일요일 밤 고정비 <b class="gold">' + won(wk) + '</b> (끼니 포함 · 첫 주는 산 날만큼) — 두 번 연속 못 내면 쫓겨납니다<br>입주 뒤 남는 현금 <b>' + won(after) + '</b>' + (tonight ? ' · 오늘이 일요일이라 <b class="' + (after < tonight ? 'bad' : 'gold') + '">오늘 밤 하루치 ' + won(tonight) + '</b>이 바로 나갑니다' + (after < tonight ? ' — 모자랍니다' : '') : '') + '</p><div class="rewardbox">열림 <b class="gold">' + h.unlock + '</b></div>' +
          '<div class="foot"><button class="btn" data-do="no">아직 <span class="key">Esc</span></button><button class="btn main" data-do="ok">입주 <span class="key">Space</span></button></div></div>';
      } else if (m.kind === 'sleep') {
        const can = R.worth(S) >= R.housePrice(S);
        v.innerHTML = '<div class="win pop corner bad"><h2>[시스템] 확인</h2><h3>' + (m.lastDay ? (can ? '집을 살 수 있습니다' : '마지막 밤입니다') : '고정비를 못 냅니다') + '</h3><p>' +
          (m.lastDay ? (can ? '순자산이 집값을 넘었습니다. 사다리 탭에서 <b class="gold">집 계약</b>을 누르지 않고 자면 이 판은 실패로 끝납니다.' : '오늘 밤이 지나면 이 판은 끝납니다. 순자산 ' + won(R.worth(S)) + ' · 집값 ' + won(R.housePrice(S)) + '.')
            : '오늘 밤 고정비 <b class="gold">' + won(m.b.amt) + '</b>인데 현금이 ' + won(m.b.amt - S.cash) + ' 모자랍니다. 주식 · 코인을 팔면 현금이 됩니다. 그냥 자면 연체료가 붙고, 두 번 연속이면 쫓겨납니다.') + '</p>' +
          '<div class="foot"><button class="btn" data-do="ok">' + (m.lastDay ? '이대로 끝낸다' : '그래도 잔다') + '</button><button class="btn main" data-do="no">돌아가기 <span class="key">Space</span></button></div></div>';
      } else {
        v.innerHTML = '<div class="win pop corner"><h2>[시스템] 계약 확인</h2><h3>집을 계약할까요?</h3><p>집값 <b class="gold">' + won(R.housePrice(S)) + '</b> · 순자산 <b>' + won(R.worth(S)) + '</b><br>가진 주식 · 코인 · 보증금을 모두 정리해 치릅니다. 이 판은 여기서 끝납니다.</p>' +
          '<div class="foot"><button class="btn" data-do="no">아직 <span class="key">Esc</span></button><button class="btn warm" data-do="ok">계약 <span class="key">Space</span></button></div></div>';
      }
    } else if (m.type === 'night') v.innerHTML = nightHtml(m.sum);
    const w = v.firstElementChild; // 꺾쇠를 창보다 먼저 그리려고 틀을 한 겹 둠
    if (w && w.classList.contains('corner')) { const f = document.createElement('div'); f.className = 'frame corner'; w.classList.remove('corner'); v.replaceChild(f, w); f.appendChild(w); }
  }
  const keyName = c => ({ Space: 'Space', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' }[c] || c.replace('Digit', '').replace('Key', ''));
  function nightHtml(n) {
    const rows = (list, sgn) => (list.length ? list.map(r => '<div class="n-row"><span>' + esc(r.label) + '</span><span class="' + (sgn > 0 ? 'gold' : '') + '">' + (sgn > 0 ? '+' : '−') + won(r.amt) + '</span></div>').join('') : '<div class="n-row none"><span>없음</span><span></span></div>');
    const d = n.worthEnd - n.worthStart, b = R.bill(S), rise = R.riseIn(S);
    const next = [];
    if (!n.lastDay) {
      if (b) { const d = b.inDays === 0 ? 7 : b.inDays, amt = b.inDays === 0 ? R.weekCost(S) + S.arrears : b.amt; next.push('<span class="chip' + (d <= 2 ? ' hot' : '') + '">고정비 ' + (d === 1 ? '내일 밤' : d + '일 뒤') + ' · ' + won(amt) + '</span>'); }
      if (rise) next.push('<span class="chip' + (rise <= 1 ? ' hot' : '') + '">집값 인상 ' + (rise === 1 ? '내일 아침' : rise + '일 뒤') + '</span>');
      next.push('<span class="chip">남은 날 ' + (tune.days - n.day) + '일</span>');
    }
    return '<div class="win night corner"><h2>[시스템] ' + n.day + '일째 밤 — 정산</h2><h3>' + n.home + '에서 잠듭니다</h3>' +
      '<div class="n-cols"><div class="n-col"><h4>번 돈</h4>' + rows(n.income, 1) + '<div class="n-row sum"><span>합계</span><span class="gold">+' + won(n.labor) + '</span></div></div>' +
      '<div class="n-col"><h4>쓴 돈</h4>' + rows(n.expense, -1) + '<div class="n-row sum"><span>합계</span><span>−' + won(n.spent) + '</span></div></div></div>' +
      '<div class="n-big">' + (R.unlocked(S, 'stock') || n.invest ? '<i>투자 손익</i><b class="' + cls(n.invest) + '">' + sign(n.invest) + '</b>' : '') +
      '<i>순자산</i><b>' + won(n.worthStart) + ' → ' + won(n.worthEnd) + ' <span class="' + cls(d) + '" style="font-size:16px">(' + sign(d) + ')</span></b>' +
      '<i>체력</i><b>' + Math.round(n.hp.mid) + ' → ' + Math.round(n.hp.after) + ' <span class="good" style="font-size:16px">(잠 +' + Math.round(n.hp.sleep) + ')</span></b></div>' +
      (n.billed && n.billed.paid ? '<div class="n-notes good">고정비 ' + won(n.billed.amt) + '을 냈습니다' + (n.billed.days < 7 ? ' (이번 주는 ' + n.billed.days + '일만 살아서 그만큼만)' : '') + '. 다음은 7일 뒤입니다.</div>' : '') +
      (n.notes.length ? '<div class="n-notes">' + n.notes.map(x => '<div class="' + x.tone + '">' + esc(x.text) + '</div>').join('') + '</div>' : '') +
      '<div class="n-house"><span>집까지</span><div class="bar"><div style="width:' + (clamp(n.house.pct, 0, 1) * 100).toFixed(1) + '%"></div></div><b>' + Math.floor(n.house.pct * 100) + '%</b><span class="dim">집값 ' + won(n.house.price) + '</span></div>' +
      (next.length ? '<div class="n-next">' + next.join('') + '</div>' : '') + okBtn(n.lastDay ? '결과 보기' : '다음 날') + '</div>';
  }

  // ── 그리기: 제목 · 결과 · 등장물 ──
  function renderTitle() {
    const s = hasSave();
    $('s-title').innerHTML = '<div class="bg">' + art('title') + '</div><div class="t-box"><div class="tag">무일푼에서 내 집까지 · 28일</div><h1>서울역<br>상태창</h1>' +
      '<div class="lead">서울역 벤치에서 눈을 떴더니 나에게만 보이는 상태창이 떴다. 알바로 버티고, 방을 구하고, 투자로 불려서 집을 사라.</div>' +
      '<div class="t-form"><label for="name">이름</label><input id="name" maxlength="8" placeholder="나" value="' + esc(ui.name) + '" autocomplete="off"></div>' +
      '<div class="t-btns">' + (s ? '<button class="btn main" data-do="continue">이어하기 (' + s.day + '일째) <span class="key">Enter</span></button><button class="btn' + (ui.askNew ? ' warm' : '') + '" data-do="new">' + (ui.askNew ? '하던 판을 지우고 새로 시작' : '새로 시작') + '</button>' : '<button class="btn main" data-do="new">새로 시작 <span class="key">Enter</span></button>') + '</div>' +
      '<div class="t-keys"><b>마우스</b>만으로 전부 됩니다.<br>키보드: <b>1~6</b> 행동 고르기 · <b>Space</b> 넘기기 · <b>M</b> 소리 끄기<br>알바 미니게임의 키는 그때그때 화면에 나옵니다.</div></div>';
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
    $('s-results').innerHTML = '<div class="bg">' + art('ending', home ? 'home' : 'fail') + '</div><div class="e-box corner">' +
      '<h2>[시스템] ' + (home ? '최종 퀘스트 완료' : tune.days + '일이 지났습니다') + '</h2><h1>' + (home ? '내 집 마련' : '올해도 무주택') + '</h1>' + (home ? '<div class="rank">' + e.rank + '</div>' : '') +
      '<p>' + (home ? esc(S.name) + ' 님은 ' + e.day + '일째에 ' + won(e.price) + '짜리 집을 계약했습니다. 서울역 벤치는 다음 사람에게 양보합니다.' : '순자산 ' + won(e.worth) + ' — 집값 ' + won(e.price) + '의 <b class="gold">' + Math.floor(e.pct * 100) + '%</b>까지 왔습니다. 집은 기다려 주지 않았습니다.') + '</p>' +
      '<div class="e-stats"><div><i>알바로 번 돈</i><b>' + won(st.alba) + '</b></div><div><i>투자 손익</i><b class="' + cls(st.trade) + '">' + sign(st.trade) + '</b></div><div><i>낸 고정비</i><b>' + won(st.fixed) + '</b></div><div><i>완벽한 알바</i><b>' + st.perfect + '번</b></div><div><i>청산</i><b>' + st.liq + '번</b></div><div><i>끝낸 퀘스트</i><b>' + st.quests + ' / ' + R.QUESTS.length + '</b></div></div>' +
      (tips.length ? '<div class="e-tips">' + tips.map(esc).join('<br>') + '</div>' : '<div class="e-tips">2막 — 더 큰 판(큰손 · 회사 · 자산가)은 아직 만들지 않았습니다.</div>') +
      '<div class="foot"><button class="btn main" data-do="again">다시 하기 <span class="key">Enter</span></button><i>칭호: ' + esc(home ? '집주인' : S.title) + '</i></div></div>';
  }
  function renderFigures() {
    const figs = (art('figures') || []);
    $('s-figures').innerHTML = '<div class="figs">' + figs.map(f => '<div class="fig"><div class="p">' + f.svg + '</div>' + esc(f.name) + '</div>').join('') + '</div>';
    const box = $('s-figures').firstChild;
    let sp = [];
    try { sp = window.Minigames && window.Minigames.sprites ? window.Minigames.sprites() : []; } catch (e) { sp = []; }
    for (const s of sp) {
      const d = document.createElement('div'); d.className = 'fig';
      d.innerHTML = '<div class="p"><canvas width="224" height="148" style="width:112px;height:74px"></canvas></div>' + esc(s.name);
      box.appendChild(d);
      const c = d.querySelector('canvas').getContext('2d');
      try { // 게임 안 크기로 따로 그린 뒤, 그려진 부분만 잘라 칸에 맞춤 (등장물마다 크기가 달라서)
        const off = document.createElement('canvas'); off.width = 560; off.height = 440;
        const o = off.getContext('2d'); s.draw(o, 280, 220, 1);
        const px = o.getImageData(0, 0, 560, 440).data; let x0 = 560, y0 = 440, x1 = 0, y1 = 0;
        for (let y = 0; y < 440; y += 2) for (let x = 0; x < 560; x += 2) if (px[(y * 560 + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 > x0 && y1 > y0) { const w = x1 - x0 + 4, h = y1 - y0 + 4, k = Math.min(208 / w, 136 / h, 1.6); c.drawImage(off, x0 - 2, y0 - 2, w, h, (224 - w * k) / 2, (148 - h * k) / 2, w * k, h * k); }
      } catch (e) { /* 그리기 실패는 넘어감 */ }
    }
  }

  function render() {
    if (scene !== 'play') return;
    renderTop(); renderScene(); renderStatus(); renderActs(); renderPanel();
  }

  // ── 고정 간격 걸음 ──
  function step() {
    if (ui.guard > 0 && --ui.guard === 0) $('veil').classList.remove('arming');
    let n = 0;
    while (hit.length && n++ < 8) key(hit.shift());
    const m = ui.modal;
    if (scene === 'play' && m && m.type === 'mg' && !m.res) {
      try { m.mg.update(STEP); } catch (e) { m.mg.done = true; m.mg.result = m.mg.result || { score: 0.5 }; }
      if (m.mg.done) finishMg();
    }
    if (scene === 'play' && S) { // 숫자가 굴러가며 따라붙음
      const w = R.worth(S);
      if (ui.cash !== S.cash) { const dlt = S.cash - ui.cash; ui.cash = Math.abs(dlt) < 600 ? S.cash : ui.cash + dlt * 0.22; bump('cash', won(ui.cash)); }
      if (ui.worth !== w) { const dlt = w - ui.worth; ui.worth = Math.abs(dlt) < 600 ? w : ui.worth + dlt * 0.22; bump('worth', won(ui.worth)); }
    }
  }
  function bump(id, text) { const el = $(id); if (!el || el.textContent === text) return; el.textContent = text; if (!el.classList.contains('bump')) { el.classList.add('bump'); el.addEventListener('animationend', () => el.classList.remove('bump'), { once: true }); } }
  let last, acc = 0;
  function tick() {
    const now = clock.now();
    acc += Math.min(now - last, 0.25); last = now;
    while (acc >= STEP) { step(); acc -= STEP; }
    drawMg();
  }
  function frame() { try { tick(); } finally { requestAnimationFrame(frame); } } // 한 번의 오류가 화면을 멈추지 않게
  function timer() { if (document.visibilityState === 'visible' && clock.now() - last > 0.1) tick(); }

  // ── 점검이 읽고 움직이는 것 (?manual=1 이면 스스로 돌지 않음) ──
  window.game = {
    get scene() { return scene; },
    get state() {
      if (!S) return { scene };
      return { day: S.day, slot: S.slot, phase: S.phase, cash: S.cash, worth: R.worth(S), hp: S.hp, tier: S.tier, quest: S.quest, title: S.title, modal: ui.modal ? ui.modal.type : '', ended: S.ended, goal: !!(S.ended && S.ended.kind === 'home'), housePrice: R.housePrice(S), raw: S };
    },
    press(code) { hit.push(code); },
    hold() { /* 이 게임은 누르고 있는 조작이 없음 */ },
    get events() { return events; },
    step(n, draw) { for (let i = 0; i < (n || 1); i++) step(); if (draw !== false) drawMg(); },
    run, // 점검용: 버튼과 같은 길
    get mg() { return ui.modal && ui.modal.type === 'mg' ? ui.modal.mg : null; }, // 점검용: 지금 열린 미니게임
  };

  renderTitle();
  const first = params.get('scene') || 'title';
  if (first === 'figures') { renderFigures(); show('figures'); }
  else if (first === 'play') { newGame(); }
  else show('title');
  last = clock.now();
  if (!MANUAL) { requestAnimationFrame(frame); setInterval(timer, 50); }
})();
