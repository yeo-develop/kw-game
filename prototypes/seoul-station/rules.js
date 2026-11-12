// PROTOTYPE - NOT FOR PRODUCTION
// Question: 상태창이 시키는 대로 알바 → 방 → 투자 → 집으로 올라가는 한 판이, 뭘 해야 할지 늘 분명하면서 20분 동안 재미있는가?
// Date: 2026-11-12
// 게임의 규칙만 (화면 없음). 브라우저에서는 window.Rules, Node 에서는 require 로 같은 파일을 쓴다.
// 화면(ui.js)은 여기 함수를 부르고, 함수가 state.ev 에 쌓아 둔 사건을 꺼내 보여 준다.
(function (root, factory) {
  const R = factory();
  if (typeof module === 'object' && module.exports) module.exports = R; else root.Rules = R;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let T = null; // 조율 값 (config.js). 화면 쪽이 Rules.setTune 으로 넣어 준다
  function setTune(t) { T = t; }

  const HOMES = [
    { id: 'station', name: '서울역', sleep: 'sleep_station', blurb: '벤치. 자도 체력이 조금만 돌아온다.', unlock: '전단지 · 상하차' },
    { id: 'sauna', name: '찜질방', sleep: 'sleep_sauna', blurb: '씻고 잔다. 하룻밤씩 낸다.', unlock: '편의점 알바' },
    { id: 'gosiwon', name: '고시원', sleep: 'sleep_gosiwon', blurb: '주소가 생긴다. 매주 고정비.', unlock: '주식 계좌 · 배달 알바 · 공부' },
    { id: 'oneroom', name: '원룸', sleep: 'sleep_oneroom', blurb: '발 뻗고 잔다. 고정비가 크다.', unlock: '코인 · 레버리지' },
    { id: 'home', name: '내 집', blurb: '1차 목표.', unlock: '엔딩' },
  ];
  const JOBS = [
    { id: 'flyer', name: '전단지', tier: 0, note: '가볍다' },
    { id: 'loading', name: '상하차', tier: 0, note: '많이 주지만 힘들다' },
    { id: 'store', name: '편의점', tier: 1, note: '덜 힘들다' },
    { id: 'delivery', name: '배달', tier: 2, note: '가장 많이 준다' },
  ];
  const ASSETS = [
    { id: 'daejang', name: '대장전자', tag: '우량주', kind: 'stock', px: 52000, hint: '느리지만 꾸준히 오르는 편' },
    { id: 'buldak', name: '화끈식품', tag: '테마주', kind: 'stock', px: 18400, hint: '소식에 크게 움직인다' },
    { id: 'hantang', name: '한탕바이오', tag: '작전주', kind: 'stock', px: 3150, hint: '천천히 오르다 급등, 그리고 폭락' },
    { id: 'coin', name: '달나라코인', tag: '코인', kind: 'coin', px: 1270, hint: '하루에도 크게 출렁인다' },
  ];
  const SRC = { official: { name: '공시', note: '거의 확실', rel: 'rel_official' }, article: { name: '기사', note: '대체로 맞음', rel: 'rel_article' }, rumor: { name: '찌라시', note: '반반', rel: 'rel_rumor' } };
  const HEAD = {
    buldak: { 1: ['화끈식품, 해외 수출 계약 체결', '화끈식품 신제품 품절 대란', '화끈식품 분기 실적 예상 웃돌아'], '-1': ['화끈식품 제품 회수 조치', '화끈식품 원재료 값 급등', '화끈식품 대주주 지분 매각설'] },
    daejang: { 1: ['대장전자, 대형 공급 계약', '대장전자 배당 확대 발표'], '-1': ['대장전자 공장 가동 차질', '대장전자 실적 전망 낮춰'] },
    coin: { 1: ['달나라코인, 대형 거래소 상장설', '유명인이 달나라코인을 언급'], '-1': ['달나라코인 해킹 의혹', '당국, 코인 단속 예고'] },
  };
  const TITLES = [[0, '서울역 신입'], [500000, '성실한 일용직'], [3000000, '개미'], [10000000, '슈퍼 개미'], [20000000, '여의도 유망주']];
  const GRADE = { miss: '실수', ok: '보통', good: '잘함', perfect: '완벽', skip: '대충' };
  const byId = (list, id) => list.find(x => x.id === id);

  // ── 난수 (씨앗에서만) ────────────────────────────────────────
  function next(s, key) {
    s[key] = (s[key] + 0x6D2B79F5) | 0;
    let t = Math.imul(s[key] ^ (s[key] >>> 15), s[key] | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const rnd = s => next(s, 'rng');       // 시세 · 소식
  const rnd2 = s => next(s, 'rng2');     // 미니게임 (화면 쪽이 가져다 씀)
  const rnd3 = s => next(s, 'rng3');     // 플레이어가 하는 일에 딸린 굴림 (리포트 · 팁 · 사건 · 특성 후보) — 시세 난수와 섞이지 않는다
  function gauss(s) { let u = 0; while (u < 1e-9) u = rnd(s); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd(s)); }
  const pick = (s, arr) => arr[Math.min(arr.length - 1, Math.floor(rnd(s) * arr.length))];
  const round1k = n => Math.round(n / 1000) * 1000;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ── 사건 · 시스템 메시지 ─────────────────────────────────────
  function ev(s, t, d) { s.ev.push(Object.assign({ t }, d || {})); }
  function sys(s, text, tone) { s.log.push({ day: s.day, text, tone: tone || '' }); if (s.log.length > 40) s.log.shift(); ev(s, 'sys', { text, tone: tone || '' }); }
  function income(s, label, amt) { if (!amt) return; s.cash += amt; add(s.today.income, label, amt); ev(s, 'money', { amt, label }); }
  function expense(s, label, amt) { if (!amt) return; s.cash -= amt; add(s.today.expense, label, amt); ev(s, 'money', { amt: -amt, label }); }
  function add(rows, label, amt) { const r = rows.find(x => x.label === label); if (r) r.amt += amt; else rows.push({ label, amt }); }

  // ── 새 판 ───────────────────────────────────────────────────
  function create(seed, name) {
    const s = {
      v: 1, seed: seed | 0, rng: seed | 0, rng2: (Math.imul(seed | 0, 7919) + 13) | 0, rng3: (Math.imul(seed | 0, 104729) + 71) | 0, name: (name || '').trim() || '나',
      lv: 1, xp: 0, perks: {}, offer: null, picks: 0, combo: 0, buff: {}, event: null, evSeen: [], ach: [], hpBonus: 0, gutsUsed: false,
      day: 1, slot: 0, phase: 'day', cash: 0, hp: T.start_hp, tier: 0, deposit: 0, arrears: 0, missed: 0, movedDay: 0, rentPaid: 0,
      jobs: { flyer: 0, loading: 0, store: 0, delivery: 0 }, studied: 0,
      market: { tick: 0, px: {}, hist: {}, chg: {}, news: [], nid: 0, ht: { phase: 'quiet', left: 4 }, intel: null, brief: null }, // intel = 오늘 공부해서 안 내일 것 · brief = 어제 공부해서 아는 오늘 것
      hold: {}, lev: null, quest: 0, title: TITLES[0][1],
      today: null, last: null,
      stats: { alba: 0, jobsDone: 0, bought: 0, trade: 0, gain: 0, htGain: 0, levGain: 0, levOpens: 0, levWins: 0, fees: 0, fixed: 0, liq: 0, perfect: 0, quests: 0, maxTier: 0, evicted: 0,
        comboBest: 0, tips: 0, saunaNights: 0, lossSells: 0, bestGain: 0, missedTotal: 0, lotto: 0, kind: 0, events: 0 },
      log: [], ended: null, ev: [],
    };
    for (const a of ASSETS) { s.market.px[a.id] = a.px; s.market.hist[a.id] = [a.px]; s.market.chg[a.id] = 0; s.hold[a.id] = { units: 0, cost: 0 }; }
    for (let i = 0; i < 17; i++) tick(s, true); // 차트가 비어 보이지 않게 지난 며칠치를 미리 굴림
    genNews(s, 1); genNews(s, 2);
    beginDay(s);
    s.ev.length = 0; s.log.length = 0;
    sys(s, '각성을 축하합니다. 현금 0원. 축하할 일인지는 모르겠습니다.');
    ev(s, 'intro', { quest: questView(s) });
    return s;
  }
  function beginDay(s) { s.today = { income: [], expense: [], startWorth: worth(s), startHp: s.hp }; }

  // ── 값 읽기 ─────────────────────────────────────────────────
  const weekOf = day => Math.floor((day - 1) / 7) + 1;
  const perk = (s, id) => (s.perks && s.perks[id]) || 0;
  const hpMax = s => 100 + T.perk_iron * perk(s, 'iron') + (s.hpBonus || 0);
  const thrift = s => 1 - T.perk_thrift * perk(s, 'thrift'); // 끼니 · 찜질방 · 고정비에 곱함
  const mealCost = s => round1k(T.meal_cost * thrift(s)), saunaCost = s => round1k(T.sauna_night * thrift(s));
  const feeMult = s => (perk(s, 'vip') ? 0.5 : 1);
  function housePrice(s, day) { const g = Math.max(0, T.house_growth - T.perk_legs * perk(s, 'legs')); return Math.round(T.house_price * Math.pow(1 + g, weekOf(day || s.day) - 1) / 10000) * 10000; }
  function holdValue(s, id) { return s.hold[id].units * s.market.px[id]; }
  function levValue(s) { const l = s.lev; if (!l) return 0; return Math.max(0, l.margin * (1 + l.dir * l.lev * (s.market.px.coin / l.entry - 1))); }
  function levLiq(l) { return l.entry * (1 - l.dir / l.lev); }
  function invested(s) { let v = levValue(s); for (const a of ASSETS) if (a.kind === 'stock') v += holdValue(s, a.id); return v; }
  function worth(s) { return Math.round(s.cash + s.deposit + invested(s) - s.arrears); }
  function weekCost(s, tier) { tier = tier == null ? s.tier : tier; return round1k((tier === 2 ? T.gosiwon_week : tier === 3 ? T.oneroom_week : 0) * thrift(s)); }
  function sleepGain(s) { return T[HOMES[s.tier].sleep] + T.perk_sleep * perk(s, 'sleep') - (s.buff.sleepPen > 0 ? T.ev_sleep_pen : 0); }
  const weekStart = day => Math.floor((day - 1) / 7) * 7 + 1;
  const livedFrom = (s, day) => Math.max(weekStart(day), s.movedDay || 1); // 그 주에 지금 집에서 산 첫날
  function bill(s) { // 다음 고정비: 얼마를, 며칠 뒤 밤에. 매주 일요일(7 · 14 · 21 · 28일) 밤, 그 주에 산 날만큼만
    if (s.tier < 2) return null;
    const inDays = (7 - (s.day % 7)) % 7, due = s.day + inDays, days = due - livedFrom(s, due) + 1;
    const week = round1k(weekCost(s) * days / 7);
    return { amt: week + s.arrears, week, days, inDays };
  }
  function owedOld(s) { // 이사 나갈 때: 살던 곳의 이번 주 고정비를 어제까지 산 날만큼
    if (s.tier < 2) return 0;
    return round1k(weekCost(s) * Math.max(0, s.day - livedFrom(s, s.day)) / 7);
  }
  function riseIn(s) { const d = 7 - ((s.day - 1) % 7); return s.day + d > T.days ? null : d; } // 집값이 오르기까지 남은 날 (마지막 주엔 없음)
  function skill(s, id) { const n = s.jobs[id]; return n >= T.skill_n3 ? 3 : n >= T.skill_n2 ? 2 : n >= T.skill_n1 ? 1 : 0; }
  function skillNext(s, id) { const n = s.jobs[id]; const at = [T.skill_n1, T.skill_n2, T.skill_n3].find(x => n < x); return at ? at - n : 0; }
  function grade(score) { return score >= 0.9 ? 'perfect' : score >= 0.7 ? 'good' : score >= 0.4 ? 'ok' : 'miss'; }
  function unlocked(s, what) { return what === 'stock' || what === 'study' ? s.tier >= 2 : what === 'coin' ? s.tier >= 3 : true; }

  // 지금 칸에서 고를 수 있는 것
  function acts(s) {
    const out = [];
    for (const j of JOBS) {
      if (s.tier < j.tier) continue; // 아직 못 하는 알바는 아예 안 보임
      const hp = T['hp_' + j.id], lv = skill(s, j.id);
      out.push({ kind: 'job', id: j.id, name: j.name, note: j.note, pay: round1k(T['pay_' + j.id] * (1 + T.skill_bonus * lv) * (1 + T.perk_hustle * perk(s, 'hustle'))), hp, lv, toNext: skillNext(s, j.id), ok: s.hp >= hp, why: s.hp >= hp ? '' : '체력이 모자랍니다' });
    }
    out.push({ kind: 'rest', id: 'rest', name: '쉬기', hp: -(s.tier === 0 ? T.rest_hp_station : T.rest_hp), ok: true, why: '', note: s.tier === 0 ? '벤치에서는 덜 풀린다' : '' });
    if (unlocked(s, 'study')) { const read = !!(s.market.intel && s.market.intel.madeOn === s.day); out.push({ kind: 'study', id: 'study', name: '공부', hp: 0, ok: !read, why: read ? '오늘 리포트는 이미 읽었습니다' : '', note: '내일 나올 소식을 미리 안다' }); }
    return out;
  }

  // ── 칸 행동 ─────────────────────────────────────────────────
  function canAct(s) { return !s.ended && s.phase === 'day' && s.slot < 3 && !s.event; } // 돌발 사건이 떠 있으면 먼저 골라야 함
  function doJob(s, id, score) { // score: 0~1, null 이면 "대충 하기"
    const a = acts(s).find(x => x.id === id);
    if (!canAct(s) || !a || !a.ok) return false;
    const g = score == null ? 'skip' : grade(score + T.perk_hands * perk(s, 'hands'));
    const mult = g === 'skip' ? T.mult_skip + T.perk_lazy * perk(s, 'lazy') : T['mult_' + g];
    const comboWas = s.combo, comboMult = 1 + (T.combo_bonus + T.perk_streak * perk(s, 'streak')) * comboWas, extra = s.buff.nextJob || 1;
    const pay = round1k(a.pay * mult * comboMult * extra);
    const before = skill(s, id);
    delete s.buff.nextJob;
    if (g === 'good' || g === 'perfect') s.combo = Math.min(T.combo_max, s.combo + 1); else if (g !== 'ok') s.combo = 0; // 잘함 이상이면 쌓이고, 실수 · 대충이면 끊김
    s.stats.comboBest = Math.max(s.stats.comboBest || 0, s.combo);
    s.hp -= a.hp; s.stats.jobsDone = (s.stats.jobsDone || 0) + 1; s.stats.alba += pay; if (g === 'perfect') s.stats.perfect++;
    if (score != null) s.jobs[id]++; // 대충 하면 숙련도는 오르지 않는다
    ev(s, 'job', { id, name: a.name, pay, base: a.pay, grade: g, gradeName: GRADE[g], mult, hp: a.hp, combo: s.combo, comboWas, comboMult, extra });
    income(s, a.name + ' 알바', pay);
    if (g === 'perfect' && rnd3(s) < T.tip_p) { const tip = round1k(T.tip_min + rnd3(s) * (T.tip_max - T.tip_min)); s.stats.tips = (s.stats.tips || 0) + 1; income(s, '팁', tip); ev(s, 'tip', { amt: tip }); }
    if (skill(s, id) > before) sys(s, a.name + ' 숙련도가 올랐습니다. 일당 +' + Math.round(T.skill_bonus * 100) + '%.', 'good');
    gainXp(s, Math.round(T.xp_job * XPF[g]));
    endSlot(s);
    return true;
  }
  function doRest(s) {
    if (!canAct(s)) return false;
    const gain = s.tier === 0 ? T.rest_hp_station : T.rest_hp, before = s.hp;
    s.hp = Math.min(hpMax(s), s.hp + gain);
    ev(s, 'rest', { hp: s.hp - before });
    endSlot(s);
    return true;
  }
  function doStudy(s) {
    if (!canAct(s) || !unlocked(s, 'study') || (s.market.intel && s.market.intel.madeOn === s.day)) return false;
    const count = readReport(s);
    s.studied++;
    ev(s, 'study', { count });
    sys(s, count ? '리포트 입수. 내일 소식 ' + count + '건의 진짜 방향을 표시했습니다(' + Math.round(studyAcc(s) * 100) + '% 맞음). 시세는 소식 말고도 출렁입니다.' : '리포트 입수. 내일은 조용합니다. 조용한 것도 정보입니다.');
    gainXp(s, T.xp_study);
    endSlot(s);
    return true;
  }
  const studyAcc = s => Math.min(1, T.study_acc + T.perk_sense * perk(s, 'sense'));
  function endSlot(s) {
    const had = invested(s);
    tick(s, false);
    if (had > 0) { const now = invested(s); ev(s, 'while', { delta: Math.round(now - had), pct: now / had - 1 }); } // 그 칸 동안 내 투자가 움직인 만큼
    s.slot++;
    after(s);
  }
  function after(s) { titleTick(s); questTick(s); achTick(s); }

  // ── 시세 한 틱 ──────────────────────────────────────────────
  function tick(s, warm) {
    const m = s.market, imp = { daejang: 0, buldak: 0, hantang: 0, coin: 0 };
    if (!warm) {
      const w = [0.5, 0.3, 0.2][s.slot] || 0;
      for (const n of m.news) if (n.day === s.day) imp[n.asset] += (n.truth ? n.dir : -n.dir * T.fake_back) * n.mag * w;
    }
    const r = {};
    r.daejang = T.d_drift + T.d_sigma * gauss(s);
    r.buldak = T.b_sigma * gauss(s);
    const ht = m.ht, z = gauss(s);
    r.hantang = ht.phase === 'quiet' ? T.h_quiet_drift + T.h_quiet_sigma * z : ht.phase === 'gather' ? T.h_gather + 0.01 * z : ht.phase === 'pump' ? T.h_pump + 0.02 * z : T.h_dump + 0.03 * z;
    r.coin = clamp(T.c_momentum * (m.chg.coin || 0) + T.c_sigma * gauss(s), -0.3, 0.3);
    for (const a of ASSETS) {
      const x = clamp(r[a.id] + imp[a.id], -0.45, 0.45);
      m.px[a.id] = Math.max(10, m.px[a.id] * Math.exp(x));
      m.chg[a.id] = x;
      m.hist[a.id].push(m.px[a.id]);
      if (m.hist[a.id].length > 120) m.hist[a.id].shift();
    }
    m.tick++;
    ht.left--;
    if (ht.left <= 0) {
      if (ht.phase === 'quiet') { ht.phase = 'gather'; ht.left = 4 + Math.floor(rnd(s) * 3); if (!warm && unlocked(s, 'stock')) sys(s, '한탕바이오 거래량이 눈에 띄게 늘고 있습니다. 누군가 사 모으는 중입니다.', 'warn'); }
      else if (ht.phase === 'gather') { ht.phase = 'pump'; ht.left = 2 + Math.floor(rnd(s) * 2); }
      else if (ht.phase === 'pump') { ht.phase = 'dump'; ht.left = 2; }
      else { ht.phase = 'quiet'; ht.left = 5 + Math.floor(rnd(s) * 5); }
    }
    if (!warm) {
      ev(s, 'tick', { chg: Object.assign({}, m.chg) });
      if (s.lev) s.lev.margin -= s.lev.put * s.lev.lev * T.lev_fund; // 포지션을 들고 있는 값 (틱마다)
      if (s.lev && levValue(s) <= 0) {
        const l = s.lev, saved = perk(s, 'guts') && !s.gutsUsed ? Math.round(l.put * T.perk_guts) : 0;
        if (saved) { s.gutsUsed = true; s.cash += saved; }
        s.lev = null; s.stats.liq++; s.stats.trade -= l.put - saved;
        ev(s, 'liq', { lost: l.put - saved, saved, dir: l.dir, lev: l.lev });
        sys(s, '청산되었습니다. 증거금 ' + won(l.put - saved) + '이 사라졌습니다.' + (saved ? ' 강심장으로 ' + won(saved) + '은 건졌습니다(한 번뿐).' : '') + ' 레버리지 ' + l.lev + '배는 ' + Math.round(100 / l.lev) + '% 역방향이면 끝입니다.', 'bad');
      }
    }
  }
  function genNews(s, day) {
    const m = s.market;
    for (const id of ['buldak', 'daejang', 'coin']) {
      if (rnd(s) >= T['news_p_' + id]) continue;
      const dir = rnd(s) < (id === 'coin' ? 0.5 : 0.55) ? 1 : -1;
      const x = rnd(s), src = x < 0.2 ? 'official' : x < 0.65 ? 'article' : 'rumor';
      m.news.push({ id: ++m.nid, day, asset: id, dir, src, truth: rnd(s) < T[SRC[src].rel], mag: T['news_mag_' + id] * (0.7 + 0.6 * rnd(s)), head: pick(s, HEAD[id][dir]) });
    }
  }
  function todayNews(s) {
    const intel = s.market.brief && s.market.brief.day === s.day ? s.market.brief : null;
    return s.market.news.filter(n => n.day === s.day).map(n => {
      const it = intel && intel.items.find(i => i.nid === n.id);
      return { id: n.id, asset: n.asset, name: byId(ASSETS, n.asset).name, dir: n.dir, src: n.src, srcName: SRC[n.src].name, srcNote: SRC[n.src].note, head: n.head, report: it ? it.dir : 0 };
    });
  }
  function intelView(s) { // 공부로 얻은 "내일" 정보 (오늘 공부했을 때만 보임)
    const it = s.market.intel;
    if (!it || it.madeOn !== s.day) return null;
    return { day: it.day, items: it.items.map(i => ({ asset: i.asset, name: byId(ASSETS, i.asset).name, dir: i.dir })), ht: it.ht };
  }

  // ── 매매 (칸을 쓰지 않음) ────────────────────────────────────
  function fail(s, why) { ev(s, 'deny', { why }); return false; }
  const canFree = s => !s.ended && s.phase === 'day'; // 칸을 안 쓰는 행동(매매 · 이사 · 계약)도 낮에만
  function buy(s, id, amt) {
    const a = byId(ASSETS, id);
    if (!canFree(s) || !a || a.kind !== 'stock' || !unlocked(s, 'stock')) return fail(s, '아직 계좌가 없습니다');
    amt = Math.floor(Math.min(Number(amt), s.cash));
    if (!Number.isFinite(amt) || amt < 10000) return fail(s, '현금이 모자랍니다 (최소 1만 원)');
    const fee = Math.round(amt * T.fee * feeMult(s)), h = s.hold[id];
    h.units += (amt - fee) / s.market.px[id]; h.cost += amt; s.cash -= amt; s.stats.fees += fee; s.stats.bought += amt;
    ev(s, 'trade', { side: 'buy', id, name: a.name, amt });
    after(s);
    return true;
  }
  function sell(s, id, frac) {
    const a = byId(ASSETS, id), h = s.hold[id];
    if (!canFree(s) || !a || !h || h.units <= 0) return fail(s, '가진 것이 없습니다');
    frac = clamp(Number(frac) || 0, 0, 1);
    if (frac <= 0) return fail(s, '');
    const gross = h.units * frac * s.market.px[id], fee = Math.round(gross * T.fee * feeMult(s)), net = Math.round(gross - fee), cost = h.cost * frac, pnl = Math.round(net - cost);
    h.units -= h.units * frac; h.cost -= cost; if (h.units < 1e-9) { h.units = 0; h.cost = 0; }
    s.cash += net; s.stats.fees += fee; s.stats.trade += pnl; if (pnl > 0) { s.stats.gain += pnl; if (id === 'hantang') s.stats.htGain = (s.stats.htGain || 0) + pnl; }
    if (pnl < 0) s.stats.lossSells = (s.stats.lossSells || 0) + 1;
    s.stats.bestGain = Math.max(s.stats.bestGain || 0, pnl);
    ev(s, 'trade', { side: 'sell', id, name: a.name, amt: net, pnl });
    profitXp(s, pnl);
    after(s);
    return true;
  }
  function levOpen(s, dir, margin, lev) {
    if (!canFree(s) || !unlocked(s, 'coin')) return fail(s, '원룸부터 할 수 있습니다');
    if (s.lev) return fail(s, '이미 포지션이 있습니다. 먼저 정리하세요');
    margin = Math.floor(Math.min(Number(margin), s.cash)); lev = clamp(Math.round(Number(lev)) || 1, 1, 5);
    if (!Number.isFinite(margin) || margin < 100000) return fail(s, '증거금이 모자랍니다 (최소 10만 원)');
    const fee = Math.round(margin * lev * T.lev_fee * feeMult(s));
    s.cash -= margin; s.stats.fees += fee; s.stats.levOpens = (s.stats.levOpens || 0) + 1;
    s.lev = { dir: dir > 0 ? 1 : -1, lev, put: margin, margin: margin - fee, entry: s.market.px.coin, day: s.day };
    ev(s, 'lev', { side: 'open', dir: s.lev.dir, lev, margin });
    after(s);
    return true;
  }
  function levClose(s) {
    const l = s.lev;
    if (!canFree(s) || !l) return fail(s, '포지션이 없습니다');
    const v = Math.round(levValue(s)), pnl = v - l.put;
    s.cash += v; s.lev = null; s.stats.trade += pnl; if (pnl > 0) { s.stats.gain += pnl; s.stats.levGain += pnl; s.stats.levWins = (s.stats.levWins || 0) + 1; }
    s.stats.bestGain = Math.max(s.stats.bestGain || 0, pnl);
    ev(s, 'lev', { side: 'close', pnl, value: v });
    profitXp(s, pnl);
    after(s);
    return true;
  }

  // ── 주거 ────────────────────────────────────────────────────
  function moveInfo(s, to) { // 옮길 수 있는지와 드는 돈
    if (to !== s.tier + 1 || to > 3) return { ok: false, why: '' };
    if (to === 1) return { ok: s.cash >= saunaCost(s), need: saunaCost(s), pay: 0, why: s.cash >= saunaCost(s) ? '' : '하룻밤 요금 ' + won(saunaCost(s)) + '이 있어야 합니다' };
    const dep = to === 2 ? T.gosiwon_deposit : T.oneroom_deposit, settle = owedOld(s), pay = dep - s.deposit + s.arrears + settle;
    return { ok: s.cash >= pay, need: pay, pay, dep, settle, why: s.cash >= pay ? '' : '현금 ' + won(pay - s.cash) + '이 더 필요합니다' + (invested(s) > 0 ? ' (투자한 돈은 팔아야 현금)' : '') };
  }
  function move(s, to) {
    const info = moveInfo(s, to);
    if (!canFree(s) || !info.ok) return fail(s, info.why || '지금은 옮길 수 없습니다');
    const from = s.tier;
    if (to >= 2) {
      if (s.arrears) { s.cash -= s.arrears; s.arrears = 0; s.missed = 0; } // 빚 갚기: 순자산은 그대로 (못 낸 날 이미 깎였음)
      if (info.settle) { expense(s, HOMES[from].name + ' 고정비 (산 날만큼)', info.settle); s.stats.fixed += info.settle; }
      s.cash += s.deposit; s.cash -= info.dep; s.deposit = info.dep; // 보증금은 자산으로 남는다 (지출이 아님)
    }
    s.tier = to; s.movedDay = s.day; s.stats.maxTier = Math.max(s.stats.maxTier || 0, to);
    ev(s, 'tier', { from, to, name: HOMES[to].name, unlock: HOMES[to].unlock, up: true });
    sys(s, to === 1 ? '찜질방 입장. 인류는 지붕을 발명했습니다. 하룻밤 ' + won(saunaCost(s)) + '씩 나갑니다.'
      : to === 2 ? '고시원 입주. 주소가 생겼습니다. 주식 계좌가 열렸고, 매주 일요일 밤 고정비 ' + won(weekCost(s)) + '이 나갑니다(끼니 포함).'
        : '원룸 입주. 코인과 레버리지가 열렸습니다. 고정비는 주 ' + won(weekCost(s)) + '. 숨만 쉬어도 나갑니다.', 'good');
    after(s);
    return true;
  }
  function buyHouse(s) {
    const price = housePrice(s);
    if (!canFree(s)) return false;
    if (worth(s) < price) return fail(s, '순자산이 집값에 못 미칩니다');
    const w = worth(s), d = s.day;
    s.ended = { kind: 'home', day: d, worth: w, price, rank: d <= 18 ? 'S' : d <= 22 ? 'A' : d <= 26 ? 'B' : 'C' };
    s.quest = QUESTS.length; s.stats.quests++;
    achTick(s);
    ev(s, 'ending', { kind: 'home' });
    return true;
  }

  // ── 밤: 하루 마치기 ─────────────────────────────────────────
  function endDay(s) {
    if (s.ended || s.phase !== 'day' || s.slot < 3) return false;
    const notes = [], hpBefore = s.hp;
    let billed = null;
    const b = bill(s);
    if (b && b.inDays === 0) { // 고정비가 먼저 (끼니는 고시원부터 고정비에 들어 있음)
      const home = HOMES[s.tier].name;
      if (s.cash >= b.amt) {
        const old = s.arrears;
        s.cash -= old; expense(s, home + ' 고정비', b.week); s.stats.fixed += b.amt; s.arrears = 0; s.missed = 0; s.rentPaid++;
        billed = { paid: true, amt: b.amt, days: b.days };
        if (old) notes.push({ tone: 'good', text: '밀린 고정비 ' + won(old) + '도 함께 갚았습니다.' });
      } else {
        const owed = round1k(b.amt * (1 + T.late_fee));
        add(s.today.expense, home + ' 고정비 (못 내서 빚)', owed - s.arrears); // 현금은 안 나갔지만 순자산은 그만큼 줄었다
        s.missed++; s.arrears = owed; s.stats.missedTotal = (s.stats.missedTotal || 0) + 1;
        billed = { paid: false, amt: b.amt, days: b.days, arrears: owed, evicted: s.missed >= 2 };
        if (s.missed >= 2) evict(s, notes);
        else notes.push({ tone: 'bad', text: '고정비 ' + won(b.amt) + '을 못 냈습니다. 연체료가 붙어 빚 ' + won(owed) + '이 되었고 다음 일요일에 함께 내야 합니다. 한 번 더 밀리면 쫓겨납니다.' });
      }
    }
    if (s.tier === 1) {
      if (s.cash >= saunaCost(s)) { expense(s, '찜질방', saunaCost(s)); s.stats.saunaNights = (s.stats.saunaNights || 0) + 1; }
      else { s.tier = 0; notes.push({ tone: 'bad', text: '찜질방 요금이 없어 서울역에서 잤습니다.' }); ev(s, 'tier', { from: 1, to: 0, name: HOMES[0].name, up: false }); }
    }
    if (s.tier < 2) {
      if (s.buff.freeMeal) { delete s.buff.freeMeal; notes.push({ tone: 'good', text: '챙겨 둔 도시락으로 끼니를 때웠습니다.' }); }
      else if (s.cash >= mealCost(s)) expense(s, '끼니', mealCost(s));
      else { s.hp = Math.max(0, s.hp - T.meal_skip_hp); notes.push({ tone: 'bad', text: '끼니를 걸렀습니다. 체력 −' + T.meal_skip_hp }); }
    }
    const sleep = sleepGain(s), hpMid = s.hp;
    if (s.buff.sleepPen > 0) { notes.push({ tone: 'bad', text: '잠을 설쳤습니다. 회복 −' + T.ev_sleep_pen }); if (--s.buff.sleepPen <= 0) delete s.buff.sleepPen; }
    s.hp = Math.min(hpMax(s), s.hp + sleep);
    gainXp(s, T.xp_day);
    const w = worth(s), labor = sum(s.today.income), spent = sum(s.today.expense), price = housePrice(s);
    s.last = {
      day: s.day, income: s.today.income, expense: s.today.expense, labor, spent,
      invest: w - s.today.startWorth - labor + spent, worthStart: s.today.startWorth, worthEnd: w,
      hp: { before: hpBefore, mid: hpMid, after: s.hp, sleep: s.hp - hpMid }, home: HOMES[s.tier].name, notes, billed,
      house: { price, pct: w / price }, lastDay: s.day >= T.days,
    };
    s.phase = 'night';
    ev(s, 'night', {});
    return true;
  }
  function evict(s, notes) {
    const from = s.tier;
    const sellAll = () => { for (const a of ASSETS) if (a.kind === 'stock' && s.hold[a.id].units > 0) { const h = s.hold[a.id], v = Math.round(holdValue(s, a.id)); s.cash += v; s.stats.trade += v - Math.round(h.cost); h.units = 0; h.cost = 0; } };
    if (s.lev) { const v = Math.round(levValue(s)); s.cash += v; s.stats.trade += v - s.lev.put; s.lev = null; }
    s.cash += s.deposit; s.deposit = 0;
    if (s.cash < s.arrears) sellAll(); // 빚을 갚으려면 주식부터 정리
    const paid = Math.min(s.cash, s.arrears), left = s.arrears - paid;
    s.cash -= paid; s.arrears = 0; s.missed = 0;
    if (from === 3 && s.cash >= T.gosiwon_deposit) { s.tier = 2; s.cash -= T.gosiwon_deposit; s.deposit = T.gosiwon_deposit; }
    else { s.tier = 1; sellAll(); }
    s.movedDay = s.day + 1; s.stats.evicted = (s.stats.evicted || 0) + 1; s.combo = 0;
    notes.push({ tone: 'bad', text: '고정비를 두 번 연속 못 내 ' + HOMES[from].name + '에서 쫓겨났습니다. 보증금에서 빚 ' + won(paid) + '을 제하고 ' + HOMES[s.tier].name + '으로 내려갑니다. 여기서 못 쓰는 계좌는 정리되었습니다.' + (left > 0 ? ' 못 갚은 ' + won(left) + '은 탕감되었습니다.' : '') });
    ev(s, 'tier', { from, to: s.tier, name: HOMES[s.tier].name, up: false });
  }
  function nextDay(s) {
    if (s.ended || s.phase !== 'night') return false;
    if (s.day >= T.days) {
      const w = worth(s), price = housePrice(s);
      s.ended = { kind: 'fail', day: s.day, worth: w, price, pct: w / price };
      achTick(s);
      ev(s, 'ending', { kind: 'fail' });
      return true;
    }
    const before = housePrice(s);
    s.day++; s.slot = 0; s.phase = 'day';
    s.market.news = s.market.news.filter(n => n.day >= s.day);
    s.market.brief = s.market.intel && s.market.intel.day === s.day ? s.market.intel : null; s.market.intel = null; // 어제 읽은 리포트는 오늘 소식 옆에 붙는다
    genNews(s, s.day + 1);
    if (perk(s, 'early')) s.hp = Math.min(hpMax(s), s.hp + T.perk_early * perk(s, 'early'));
    beginDay(s);
    ev(s, 'day', { day: s.day });
    if (perk(s, 'tipster')) tipster(s);
    rollEvent(s);
    const now = housePrice(s);
    if (now > before) sys(s, '집값이 올랐습니다. ' + won(before) + ' → ' + won(now) + '. 집은 기다려 주지 않습니다.', 'warn');
    const b = bill(s);
    if (b && b.inDays === 0) sys(s, '오늘 밤 고정비 ' + won(b.amt) + '이 나갑니다. 현금으로 준비하세요.', 'warn');
    if (unlocked(s, 'stock')) for (const n of todayNews(s)) if (n.asset !== 'coin' || unlocked(s, 'coin')) ev(s, 'news', { news: n });
    after(s);
    return true;
  }
  const sum = rows => rows.reduce((a, r) => a + r.amt, 0);

  // ── 칭호 · 퀘스트 ───────────────────────────────────────────
  function titleTick(s) {
    const w = worth(s); let t = TITLES[0][1];
    for (const [at, name] of TITLES) if (w >= at) t = name;
    const rank = n => TITLES.findIndex(x => x[1] === n);
    if (rank(t) > rank(s.title)) { s.title = t; sys(s, '칭호 획득: ' + t + '.', 'good'); }
  }
  const totalJobs = s => s.stats.jobsDone || 0;
  const qamt = (s, amt) => round1k(amt * (1 + T.perk_quest * perk(s, 'quester')));
  const qcash = (s, amt) => income(s, '퀘스트 보상', qamt(s, amt));
  const QUESTS = [
    { id: 'first_job', title: '첫 끼니를 벌어라', desc: '알바를 한 번 해낸다. 전단지가 가볍다.', cur: s => Math.min(1, totalJobs(s)), goal: () => 1, unit: '회',
      reward: s => { s.hp = Math.min(hpMax(s), s.hp + 10); }, rtext: '삼각김밥 (체력 +10)' },
    { id: 'survive', title: '오늘을 버텨라', desc: '세 칸을 다 쓰고 "하루 마치기"로 밤을 넘긴다.', cur: s => (s.day > 1 ? 1 : 0), goal: () => 1, unit: '일',
      reward: s => qcash(s, T.q_survive_cash), rtext: s => won(qamt(s, T.q_survive_cash)) },
    { id: 'roof', title: '지붕 아래에서 자라', desc: '찜질방으로 옮긴다. 자고 나면 체력이 두 배로 돌아온다.', cur: s => (s.tier >= 1 ? 1 : 0), goal: () => 1, unit: '', go: 'ladder',
      reward: s => { s.hp = Math.min(hpMax(s), s.hp + 10); }, rtext: '씻었다 (체력 +10) · 편의점 알바 열림' },
    { id: 'address', title: '주소를 만들어라', desc: '보증금을 모아 고시원에 입주한다. 주소가 있어야 계좌를 연다.', cur: s => (s.tier >= 2 ? T.gosiwon_deposit : Math.min(s.cash, T.gosiwon_deposit)), goal: () => T.gosiwon_deposit, unit: '원', go: 'ladder',
      done: s => s.tier >= 2, reward: () => { }, rtext: '주식 계좌 · 배달 알바 · 공부 열림' },
    { id: 'first_stock', title: '첫 주식을 사라', desc: '아무 주식이나 10만 원어치 이상 산다. 대장전자가 얌전하다.', cur: s => Math.min(s.stats.bought, 100000), goal: () => 100000, unit: '원', go: 'stock',
      skip: s => s.tier >= 3, reward: s => qcash(s, T.q_stock_cash), rtext: s => won(qamt(s, T.q_stock_cash)) },
    { id: 'study', title: '내일을 미리 읽어라', desc: '한 칸을 "공부"에 쓴다. 내일 나올 소식의 진짜 방향이 리포트로 보인다.', cur: s => Math.min(1, s.studied), goal: () => 1, unit: '회',
      skip: s => s.tier >= 3, reward: s => qcash(s, T.q_study_cash), rtext: s => won(qamt(s, T.q_study_cash)) + ' (알바 한 칸 값)' },
    { id: 'gain', title: '수익을 실현하라', desc: '오른 주식을 팔아 이익 5만 원 이상을 확정한다. 팔기 전까지는 내 돈이 아니다.', cur: s => Math.min(s.stats.gain, 50000), goal: () => 50000, unit: '원', go: 'stock',
      skip: s => s.tier >= 3, reward: s => qcash(s, T.q_gain_cash), rtext: s => won(qamt(s, T.q_gain_cash)) },
    { id: 'pump', title: '세력에 올라타라', desc: '한탕바이오는 누가 사 모으면 천천히 오르다 급등하고, 곧 폭락한다. 폭락 전에 팔아 이익 10만 원 이상.', cur: s => Math.min(s.stats.htGain || 0, 100000), goal: () => 100000, unit: '원', go: 'stock',
      skip: s => s.tier >= 3, reward: s => qcash(s, T.q_pump_cash), rtext: s => won(qamt(s, T.q_pump_cash)) },
    { id: 'worth', title: '순자산 300만', desc: '현금 + 보증금 + 투자한 돈을 합쳐 300만 원.', cur: s => Math.min(worth(s), 3000000), goal: () => 3000000, unit: '원',
      reward: s => qcash(s, T.q_worth_cash), rtext: s => won(qamt(s, T.q_worth_cash)) },
    { id: 'oneroom', title: '원룸으로 올라가라', desc: '보증금 500만 원으로 원룸에 입주한다. 고시원 보증금은 돌려받아 보탠다.', cur: s => (s.tier >= 3 ? T.oneroom_deposit : Math.min(s.cash + s.deposit, T.oneroom_deposit)), goal: () => T.oneroom_deposit, unit: '원', go: 'ladder',
      done: s => s.tier >= 3, reward: () => { }, rtext: '코인 · 레버리지 열림' },
    { id: 'lev', title: '레버리지를 다뤄라', desc: '코인 포지션을 이익 5만 원 이상으로 정리한다. 작게 걸어 본다. 방향을 틀리면 증거금이 통째로 사라진다.', cur: s => Math.min(s.stats.levGain, 50000), goal: () => 50000, unit: '원', go: 'coin',
      skip: s => worth(s) >= housePrice(s) * 0.6 || s.day >= 22, reward: s => qcash(s, T.q_lev_cash), rtext: s => won(qamt(s, T.q_lev_cash)) },
    { id: 'house', title: '집을 사라', desc: '순자산이 집값을 넘으면 사다리에서 "집 계약"을 누른다. 집값은 매주 오른다.', cur: s => Math.min(worth(s), housePrice(s)), goal: s => housePrice(s), unit: '원', go: 'ladder',
      done: s => !!(s.ended && s.ended.kind === 'home'), reward: () => { }, rtext: '내 집' },
  ];
  function questDone(s, q) { return q.done ? q.done(s) : q.cur(s) >= q.goal(s); }
  function questView(s) {
    const q = QUESTS[s.quest];
    if (!q) return null;
    const cur = q.cur(s), goal = q.goal(s);
    return { id: q.id, n: s.quest + 1, of: QUESTS.length, title: q.title, desc: q.desc, cur, goal, unit: q.unit, pct: goal ? clamp(cur / goal, 0, 1) : 0, near: goal > 1 && cur / goal >= 0.8 && cur < goal, reward: typeof q.rtext === 'function' ? q.rtext(s) : q.rtext, go: q.go || '' };
  }
  function questTick(s) {
    let guard = 0;
    while (s.quest < QUESTS.length && !s.ended && guard++ < 20) {
      const q = QUESTS[s.quest], view = questView(s);
      if (questDone(s, q)) { s.quest++; s.stats.quests++; ev(s, 'quest_done', { quest: view }); q.reward(s); gainXp(s, T.xp_quest); }
      else if (q.skip && q.skip(s)) { s.quest++; ev(s, 'quest_skip', { quest: view }); } // 때가 지난 퀘스트는 보상 없이 넘김
      else break;
      if (s.quest < QUESTS.length) ev(s, 'quest_new', { quest: questView(s) });
    }
  }

  // ── 레벨 · 특성 ─────────────────────────────────────────────
  const XPF = { miss: 0.5, ok: 1, good: 1.3, perfect: 1.6, skip: 0.4 };
  const pc = v => Math.round(v * 100) + '%';
  const PERKS = [
    { id: 'iron', name: '강철 체력', icon: 'muscle', max: 3, desc: () => '최대 체력 +' + T.perk_iron },
    { id: 'sleep', name: '꿀잠', icon: 'zzz', max: 3, desc: () => '밤마다 체력을 ' + T.perk_sleep + ' 더 회복' },
    { id: 'hustle', name: '일머리', icon: 'coin', max: 3, desc: () => '알바 일당 +' + pc(T.perk_hustle) },
    { id: 'hands', name: '금손', icon: 'sparkle', max: 2, desc: () => '미니게임 판정이 후해진다' },
    { id: 'lazy', name: '요령', icon: 'skip', max: 2, desc: () => '"대충"의 일당 배율 +' + T.perk_lazy },
    { id: 'streak', name: '리듬', icon: 'fire', max: 2, desc: () => '콤보 한 단계의 보너스 +' + pc(T.perk_streak) + 'p' },
    { id: 'thrift', name: '짠돌이', icon: 'tag', max: 2, desc: () => '끼니 · 찜질방 · 고정비 −' + pc(T.perk_thrift) },
    { id: 'early', name: '아침형 인간', icon: 'sun', max: 2, desc: () => '매일 아침 체력 +' + T.perk_early },
    { id: 'quester', name: '보상 사냥꾼', icon: 'gift', max: 1, desc: () => '퀘스트 현금 보상 +' + pc(T.perk_quest) },
    { id: 'legs', name: '발품', icon: 'rise', max: 2, desc: () => '집값이 매주 ' + pc(T.perk_legs) + 'p 덜 오른다' },
    { id: 'sense', name: '눈치', icon: 'eye', max: 2, need: s => s.tier >= 2, desc: () => '리포트가 맞을 확률 +' + pc(T.perk_sense) + 'p' },
    { id: 'vip', name: '수수료 우대', icon: 'percent', max: 1, need: s => s.tier >= 2, desc: () => '매매 수수료 절반' },
    { id: 'tipster', name: '정보통', icon: 'news', max: 1, need: s => s.tier >= 2, desc: () => '아침마다 소식 하나의 진짜 방향을 귀띔받는다 (' + pc(T.perk_tip_acc) + ' 맞음)' },
    { id: 'guts', name: '강심장', icon: 'shield', max: 1, need: s => s.tier >= 3, desc: () => '청산될 때 한 번, 증거금의 ' + pc(T.perk_guts) + '를 건진다' },
  ];
  const xpNeed = lv => T.lv_base + T.lv_step * (lv - 1);
  function gainXp(s, n) {
    if (!(n > 0) || s.ended) return;
    s.xp += n;
    while (s.xp >= xpNeed(s.lv)) { s.xp -= xpNeed(s.lv); s.lv++; s.picks = (s.picks || 0) + 1; ev(s, 'level', { lv: s.lv }); }
    if (s.picks > 0 && !s.offer) makeOffer(s);
  }
  const profitXp = (s, pnl) => { if (pnl > 0) gainXp(s, Math.min(T.xp_profit_cap, Math.floor(pnl / 10000 * T.xp_profit))); };
  function makeOffer(s) { // 아직 다 안 찍은 특성 가운데 셋
    const pool = PERKS.filter(p => perk(s, p.id) < p.max && (!p.need || p.need(s))), out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rnd3(s) * pool.length), 1)[0].id);
    s.offer = out.length ? out : null;
    if (!s.offer) s.picks = 0; else ev(s, 'offer', { lv: s.lv });
  }
  function pickPerk(s, id) {
    if (!s.offer || s.offer.indexOf(id) < 0) return false;
    const p = byId(PERKS, id);
    s.perks[id] = perk(s, id) + 1; s.picks--; s.offer = null;
    if (id === 'iron') s.hp = Math.min(hpMax(s), s.hp + T.perk_iron); // 늘어난 만큼은 채워 줌
    ev(s, 'perk', { id, name: p.name });
    sys(s, '특성 획득: ' + p.name + ' — ' + p.desc() + '.', 'good');
    if (s.picks > 0) makeOffer(s);
    after(s);
    return true;
  }
  const perkCard = (s, p) => ({ id: p.id, name: p.name, icon: p.icon, desc: p.desc(), n: perk(s, p.id), max: p.max });
  const offerView = s => (s.offer ? s.offer.map(id => perkCard(s, byId(PERKS, id))) : null);
  const perksView = s => PERKS.filter(p => perk(s, p.id) > 0).map(p => perkCard(s, p));
  const xpView = s => ({ lv: s.lv, xp: s.xp, need: xpNeed(s.lv) });

  // ── 돌발 사건: 아침에 가끔, 선택지 둘 ────────────────────────
  const heal = (s, n) => { s.hp = Math.min(hpMax(s), s.hp + n); }, hurt = (s, n) => { s.hp = Math.max(0, s.hp - n); };
  function readReport(s) { // 내일 소식의 진짜 방향 (공부 · 귀띔이 함께 씀)
    const day = s.day + 1, ht = s.market.ht;
    const items = s.market.news.filter(n => n.day === day).map(n => { const eff = n.truth ? n.dir : -n.dir; return { nid: n.id, asset: n.asset, dir: rnd3(s) < studyAcc(s) ? eff : -eff }; });
    s.market.intel = { day, madeOn: s.day, items, ht: { phase: ht.phase, soon: ht.left <= 2 } }; // 한탕바이오는 "가깝다/멀다"까지만
    return items.length;
  }
  function verifyToday(s) { // 오늘 소식 전부의 진짜 방향
    const m = s.market;
    m.brief = { day: s.day, madeOn: s.day - 1, ht: null, items: m.news.filter(n => n.day === s.day).map(n => ({ nid: n.id, asset: n.asset, dir: n.truth ? n.dir : -n.dir })) };
  }
  function tipster(s) { // 정보통: 아침마다 아직 모르는 오늘 소식 하나
    const m = s.market;
    if (!unlocked(s, 'stock')) return;
    if (!m.brief || m.brief.day !== s.day) m.brief = { day: s.day, madeOn: s.day - 1, items: [], ht: null };
    const n = m.news.find(x => x.day === s.day && (x.asset !== 'coin' || unlocked(s, 'coin')) && !m.brief.items.some(i => i.nid === x.id));
    if (n) { const eff = n.truth ? n.dir : -n.dir; m.brief.items.push({ nid: n.id, asset: n.asset, dir: rnd3(s) < T.perk_tip_acc ? eff : -eff }); } // 공부한 리포트보다는 덜 정확
  }
  const EVENTS = [
    { id: 'purse', icon: 'purse', tier: [0, 1], title: '떨어진 지갑', text: '벤치 밑에 지갑이 떨어져 있다. 현금이 꽤 들었다.',
      a: { label: '주인을 찾아 준다', run: s => { s.stats.kind = 1; gainXp(s, 20); heal(s, 5); if (rnd3(s) < 0.4) { income(s, '사례금', 50000); return '주인이 사례금 5만을 쥐여 줬다. 마음도 든든하다.'; } return '주인은 고맙다는 말만 남기고 갔다. 그래도 마음은 든든하다.'; } },
      b: { label: '현금만 챙긴다', run: s => { income(s, '주운 돈', 30000); hurt(s, 6); return '3만을 챙겼다. 종일 뒤통수가 따갑다.'; } } },
    { id: 'bird', icon: 'bird', tier: [0, 0], title: '비둘기의 습격', text: '비둘기 떼가 아침으로 먹으려던 삼각김밥을 노린다.',
      a: { label: '맞서 싸운다', run: s => { if (rnd3(s) < 0.6) { heal(s, 10); return '지켜 냈다. 아침이 든든하다.'; } hurt(s, 8); return '졌다. 비둘기는 강했다.'; } },
      b: { label: '반을 떼어 준다', run: s => { gainXp(s, 12); return '나눠 먹었다. 해탈에 한 걸음 가까워졌다.'; } } },
    { id: 'soup', icon: 'meal', tier: [0, 1], title: '무료 급식', text: '역 광장에 무료 급식 줄이 늘어섰다. 국밥 냄새가 난다.',
      a: { label: '줄을 선다', run: s => { heal(s, 14); return '뜨끈한 국밥 한 그릇. 살 것 같다.'; } },
      b: { label: '줄에 전단지를 돌린다', run: s => { income(s, '짬짬이 전단지', 20000); return '줄 선 사람들에게 전단지를 돌려 2만을 벌었다.'; } } },
    { id: 'egg', icon: 'egg', tier: [1, 1], title: '식혜 내기', text: '옆자리 아저씨가 가위바위보로 2만 내기를 하자고 한다.',
      a: { label: '한다', cost: 20000, run: s => { if (rnd3(s) < 0.5) { income(s, '내기', 20000); return '이겼다. 2만과 식혜를 얻었다.'; } expense(s, '내기', 20000); return '졌다. 2만이 식혜와 함께 사라졌다.'; } },
      b: { label: '잠이나 잔다', run: s => { heal(s, 8); return '아저씨의 한숨을 자장가 삼아 잤다.'; } } },
    { id: 'lunchbox', icon: 'lunchbox', tier: [1, 2], title: '폐기 도시락', text: '편의점 사장이 유통기한이 임박한 도시락을 내민다.',
      a: { label: '지금 먹는다', run: s => { heal(s, 12); return '제육 도시락이었다. 힘이 난다.'; } },
      b: { label: '저녁으로 아껴 둔다', cond: s => s.tier < 2, run: s => { if (s.tier < 2) s.buff.freeMeal = 1; heal(s, 4); return s.tier < 2 ? '가방에 넣어 뒀다. 오늘 끼니값이 굳는다.' : '아껴 뒀다가 야식으로 먹었다.'; } } },
    { id: 'swap', icon: 'swap', tier: [1, 3], title: '대타 요청', text: '알바 사장이 급하게 대타를 찾는다. 웃돈을 얹어 준단다.',
      a: { label: '간다', run: s => { s.buff.nextJob = 1.5; return '다음 알바는 일당이 1.5배다.'; } },
      b: { label: '오늘은 쉰다', run: s => { heal(s, 10); return '전화를 끄고 쉬었다.'; } } },
    { id: 'snore', icon: 'zzz', tier: [2, 3], title: '옆방 코골이', text: '벽 너머에서 탱크가 지나간다. 오늘 밤도 저럴 것이다.',
      a: { label: '귀마개를 산다', cost: 10000, run: s => { expense(s, '귀마개', 10000); return '세상이 조용해졌다.'; } },
      b: { label: '참는다', run: s => { s.buff.sleepPen = Math.max(s.buff.sleepPen || 0, 1); return '참기로 했다. 오늘 밤은 길겠다.'; } } },
    { id: 'chat', icon: 'chat', tier: [2, 3], title: '유료 리딩방', text: '"오늘의 급등주 알려 드립니다. 입장료 5만." 모르는 번호의 초대다.',
      a: { label: '들어간다', cost: 50000, run: s => { expense(s, '리딩방 입장료', 50000); if (rnd3(s) < 0.6) { verifyToday(s); return '방장이 진짜였다. 오늘 소식의 진짜 방향이 전부 표시됐다.'; } return '입금하자마자 방이 사라졌다.'; } },
      b: { label: '차단한다', run: s => { gainXp(s, 10); return '차단했다. 현명했다.'; } } },
    { id: 'envelope', icon: 'envelope', tier: [2, 3], title: '청첩장', text: '고등학교 동창의 청첩장이 왔다. 고시원 주소는 어떻게 알았을까.',
      a: { label: '축의금을 낸다', cost: 50000, run: s => { expense(s, '축의금', 50000); gainXp(s, 30); heal(s, 10); return '5만을 냈다. 뷔페는 맛있었다.'; } },
      b: { label: '모른 척한다', run: s => { hurt(s, 4); return '단체방 알림을 껐다. 조금 찝찝하다.'; } } },
    { id: 'play', icon: 'play', tier: [2, 3], title: '주식 방송', text: '구독자 3만 유튜버가 "한탕바이오, 이건 무조건 갑니다"라고 한다.',
      a: { label: '믿고 20만 산다', cost: 200000, run: s => { buy(s, 'hantang', 200000); return '샀다. 이제 기도뿐이다.'; } },
      b: { label: '끈다', run: s => { heal(s, 5); return '귀가 편해졌다.'; } } },
    { id: 'regular', icon: 'eye', tier: [2, 3], title: '단골의 귀띔', text: '편의점 단골이 "내일 큰 소식 있다더라"고 속삭인다.',
      a: { label: '믿어 본다', run: s => { if (rnd3(s) < 0.5) { readReport(s); return '진짜였다. 내일 리포트를 공짜로 얻었다.'; } gainXp(s, 5); return '헛소문이었다. 단골은 벌써 가고 없다.'; } },
      b: { label: '흘려듣는다', run: s => { gainXp(s, 5); return '웃어넘겼다.'; } } },
    { id: 'clinic', icon: 'clinic', tier: [2, 3], title: '건강검진 문자', text: '"올해 검진 대상자입니다." 몇 년째 미뤘다.',
      a: { label: '받는다', cost: 30000, run: s => { expense(s, '검진', 30000); s.hpBonus = (s.hpBonus || 0) + 5; heal(s, 5); return '생각보다 멀쩡했다. 최대 체력 +5.'; } },
      b: { label: '미룬다', run: s => { gainXp(s, 5); return '내년의 나에게 맡겼다.'; } } },
    { id: 'wrench', icon: 'wrench', tier: [3, 3], title: '보일러 고장', text: '보일러가 숨을 거뒀다. 집주인은 전화를 안 받는다.',
      a: { label: '내 돈으로 고친다', cost: 150000, run: s => { expense(s, '보일러 수리', 150000); return '15만을 냈다. 방이 다시 따뜻하다.'; } },
      b: { label: '버틴다', run: s => { s.buff.sleepPen = 3; return '패딩을 입고 자기로 했다. 사흘은 춥겠다.'; } } },
    { id: 'ticket', icon: 'ticket', tier: [0, 3], title: '복권 가게', text: '"1등 3번 나온 집." 간판이 유난히 반짝인다.',
      a: { label: '한 장 산다', cost: 5000, run: s => { expense(s, '복권', 5000); const r = rnd3(s); if (r < 0.03) { s.stats.lotto = 1; income(s, '복권 당첨', 1000000); return '1등은 아니지만 100만이 됐다. 손이 떨린다.'; } if (r < 0.2) { income(s, '복권 당첨', 30000); return '3만 당첨. 본전은 넘겼다.'; } return '꽝. 종이 한 장이 남았다.'; } },
      b: { label: '지나친다', run: s => { gainXp(s, 5); return '확률을 아는 사람의 뒷모습이다.'; } } },
    { id: 'umbrella', icon: 'umbrella', tier: [0, 3], title: '소나기', text: '갑자기 비가 쏟아진다. 우산 없는 사람들이 뛴다.',
      a: { label: '우산을 떼다 판다', cost: 20000, run: s => { expense(s, '우산 떼기', 20000); if (rnd3(s) < 0.6) { income(s, '우산 장사', 80000); return '불티나게 팔렸다. 6만을 남겼다.'; } return '사자마자 비가 그쳤다. 우산 열 개가 남았다.'; } },
      b: { label: '비를 피한다', run: s => { heal(s, 5); return '처마 밑에서 비 구경을 했다.'; } } },
    { id: 'cat', icon: 'cat', tier: [0, 3], title: '길고양이', text: '고양이 한 마리가 다리에 몸을 비빈다. 배가 고픈 눈이다.',
      a: { label: '참치캔을 산다', cost: 3000, run: s => { expense(s, '참치캔', 3000); gainXp(s, 15); heal(s, 3); return '골골거린다. 나도 조금 나아졌다.'; } },
      b: { label: '지나간다', run: s => { gainXp(s, 3); return '고양이가 한심하다는 듯 쳐다봤다.'; } } },
  ];
  function rollEvent(s) {
    if (s.event || s.day < 2 || rnd3(s) >= T.event_p) return;
    const pool = EVENTS.filter(e => s.tier >= e.tier[0] && s.tier <= e.tier[1] && s.evSeen.indexOf(e.id) < 0);
    if (!pool.length) return;
    s.event = pool[Math.floor(rnd3(s) * pool.length)].id;
    ev(s, 'event', { id: s.event });
  }
  function eventView(s) {
    const e = byId(EVENTS, s.event);
    if (!e) return null;
    const c = k => ({ label: e[k].label, cost: e[k].cost || 0, ok: s.cash >= (e[k].cost || 0) });
    return { id: e.id, icon: e.icon, title: e.title, text: e.text, a: c('a'), b: c('b') };
  }
  function choose(s, k) {
    const e = byId(EVENTS, s.event);
    if (!e || s.ended || (k !== 'a' && k !== 'b')) return false;
    if (s.cash < (e[k].cost || 0)) return fail(s, '현금이 모자랍니다');
    s.event = null; s.evSeen.push(e.id); s.stats.events = (s.stats.events || 0) + 1;
    const text = e[k].run(s);
    ev(s, 'event_done', { id: e.id, icon: e.icon, title: e.title, text });
    sys(s, e.title + ' — ' + text);
    after(s);
    return true;
  }

  // ── 업적 (한 판 안에서 얻고, 화면 쪽이 판 밖에 모아 둠) ────────
  const ACH = [
    { id: 'first_pay', name: '첫 일당', hint: '알바를 한 번 해낸다', icon: 'coin', ok: s => totalJobs(s) >= 1 },
    { id: 'perfect5', name: '완벽주의', hint: '알바에서 완벽 5번', icon: 'sparkle', ok: s => s.stats.perfect >= 5 },
    { id: 'combo10', name: '리듬 탔다', hint: '콤보를 끝까지 쌓는다', icon: 'fire', ok: s => (s.stats.comboBest || 0) >= T.combo_max },
    { id: 'allskill', name: '알바의 신', hint: '알바 네 가지 모두 숙련 3단계', icon: 'crown', ok: s => JOBS.every(j => skill(s, j.id) >= 3) },
    { id: 'sauna', name: '찜질방 단골', hint: '찜질방에서 사흘 밤', icon: 'bed', ok: s => (s.stats.saunaNights || 0) >= 3 },
    { id: 'address', name: '주소 생김', hint: '고시원에 입주한다', icon: 'door', ok: s => (s.stats.maxTier || 0) >= 2 },
    { id: 'oneroom', name: '발 뻗고 잔다', hint: '원룸에 입주한다', icon: 'house', ok: s => (s.stats.maxTier || 0) >= 3 },
    { id: 'first_stock', name: '개미 입문', hint: '주식을 처음 산다', icon: 'chart', ok: s => s.stats.bought > 0 },
    { id: 'cut', name: '손절도 실력', hint: '손해를 보고 판다', icon: 'drop', ok: s => (s.stats.lossSells || 0) >= 1 },
    { id: 'bigwin', name: '익절은 언제나 옳다', hint: '한 번에 50만 이상 번다', icon: 'rocket', ok: s => (s.stats.bestGain || 0) >= 500000 },
    { id: 'pump', name: '세력 탑승', hint: '한탕바이오로 이익을 낸다', icon: 'up', ok: s => (s.stats.htGain || 0) > 0 },
    { id: 'liq', name: '수업료', hint: '청산을 당한다', icon: 'skull', ok: s => s.stats.liq >= 1 },
    { id: 'lev3', name: '롱숏 달인', hint: '코인 포지션을 이익으로 3번 정리', icon: 'bolt', ok: s => (s.stats.levWins || 0) >= 3 },
    { id: 'study7', name: '리포트 중독', hint: '공부를 7번 한다', icon: 'book', ok: s => s.studied >= 7 },
    { id: 'rent3', name: '고정비 개근', hint: '고정비를 3번 제때 낸다', icon: 'calendar', ok: s => s.rentPaid >= 3 },
    { id: 'late', name: '다음 주에 드릴게요', hint: '고정비를 한 번 밀린다', icon: 'warn', ok: s => (s.stats.missedTotal || 0) >= 1 },
    { id: 'evicted', name: '방 빼', hint: '쫓겨난다', icon: 'door', ok: s => (s.stats.evicted || 0) >= 1 },
    { id: 'lv5', name: '각성자', hint: '레벨 5', icon: 'star', ok: s => s.lv >= 5 },
    { id: 'lv9', name: '고인물', hint: '레벨 9', icon: 'star', ok: s => s.lv >= 9 },
    { id: 'rich', name: '천만 클럽', hint: '순자산 1,000만', icon: 'wallet', ok: s => worth(s) >= 10000000 },
    { id: 'kind', name: '서울역의 양심', hint: '주운 것을 돌려준다', icon: 'purse', ok: s => !!s.stats.kind },
    { id: 'lotto', name: '인생 한 방', hint: '복권에 당첨된다', icon: 'ticket', ok: s => !!s.stats.lotto },
    { id: 'home', name: '내 집 마련', hint: '집을 계약한다', icon: 'key', ok: s => !!(s.ended && s.ended.kind === 'home') },
    { id: 'rankS', name: '부동산의 신', hint: '18일 안에 집을 산다', icon: 'trophy', ok: s => !!(s.ended && s.ended.kind === 'home' && s.ended.rank === 'S') },
  ];
  function achTick(s) { for (const a of ACH) if (s.ach.indexOf(a.id) < 0 && a.ok(s)) { s.ach.push(a.id); ev(s, 'ach', { id: a.id, name: a.name, icon: a.icon }); } }
  const achList = () => ACH.map(a => ({ id: a.id, name: a.name, hint: a.hint, icon: a.icon }));

  // ── 판 코드 · 결과 카드 ──────────────────────────────────────
  const codeOf = seed => 'SS-' + ((seed >>> 0) % 1679616).toString(36).toUpperCase().padStart(4, '0');
  function seedOf(code) { const m = /^(?:SS-?)?([0-9A-Z]{1,4})$/i.exec(String(code || '').trim()); return m ? parseInt(m[1], 36) || 0 : 0; }
  const dailySeed = (y, mo, d) => ((y * 372 + mo * 31 + d) * 7919) % 1679615 + 1; // 같은 날이면 누구나 같은 판
  function resultCard(s) {
    const e = s.ended;
    if (!e) return '';
    const home = e.kind === 'home', st = s.stats;
    return ['[서울역 상태창] ' + (home ? '내 집 마련 · ' + e.rank + '등급' : '올해도 무주택 · 집값의 ' + Math.floor(e.pct * 100) + '%'),
      s.name + ' · ' + (home ? e.day + '일째에 ' + won(e.price) + '짜리 집 계약' : e.day + '일 동안 순자산 ' + won(e.worth)),
      '알바 ' + won(st.alba) + ' · 투자 ' + (st.trade >= 0 ? '+' : '') + won(st.trade) + ' · 청산 ' + st.liq + '번 · Lv.' + s.lv + ' · 업적 ' + s.ach.length + '개',
      '판 코드 ' + codeOf(s.seed)].join('\n');
  }

  // ── 표시용 ──────────────────────────────────────────────────
  function won(n) { // 12.5만 · 345만 · 2,940만 · 1억 2,000만
    n = Math.round(n); const neg = n < 0; n = Math.abs(n);
    let out;
    if (n < 10000) out = n.toLocaleString('en-US') + '원';
    else if (n < 1000000) { const v = Math.round(n / 1000) / 10; out = (v % 1 ? v.toFixed(1) : String(v)) + '만'; }
    else { const man = Math.round(n / 10000), eok = Math.floor(man / 10000), rest = man % 10000; out = eok ? eok + '억' + (rest ? ' ' + rest.toLocaleString('en-US') + '만' : '') : man.toLocaleString('en-US') + '만'; }
    return (neg ? '−' : '') + out;
  }
  function save(s) { const c = Object.assign({}, s); c.ev = []; return JSON.stringify(c); }
  function load(json) {
    try {
      const s = JSON.parse(json); if (!s || s.v !== 1 || !s.market) return null;
      const d = { lv: 1, xp: 0, perks: {}, offer: null, picks: 0, combo: 0, buff: {}, event: null, evSeen: [], ach: [], hpBonus: 0, gutsUsed: false }; // 예전 저장에 없던 칸
      for (const k in d) if (s[k] == null && d[k] !== null) s[k] = d[k]; else if (!(k in s)) s[k] = d[k];
      if (s.rng3 == null) s.rng3 = (Math.imul(s.seed | 0, 104729) + 71) | 0;
      s.ev = []; return s;
    } catch (e) { return null; }
  }

  return {
    setTune, HOMES, JOBS, ASSETS, SRC, QUESTS, GRADE, create, acts, canAct, doJob, doRest, doStudy, endDay, nextDay,
    buy, sell, levOpen, levClose, levValue, levLiq, move, moveInfo, buyHouse, worth, invested, holdValue, housePrice, weekOf, bill, riseIn,
    skill, grade, unlocked, todayNews, intelView, questView, rnd2, won, save, load, weekCost,
    hpMax, mealCost, saunaCost, sleepGain, studyAcc, perk, pickPerk, offerView, perksView, xpView, PERKS,
    eventView, choose, EVENTS, achList, ACH, codeOf, seedOf, dailySeed, resultCard,
  };
});
