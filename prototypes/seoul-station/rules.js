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

  // 주거 사다리 (tier 0~9). price 는 조율 값에서 그때그때 읽는다 (빌려 사는 곳은 0, 끝은 순자산 기준)
  const tp = k => (T ? T[k] : 0);
  const HOMES = [
    { id: 'station', name: '서울역', kind: 'rent', sleep: 'sleep_station', blurb: '벤치. 자도 체력이 조금만 돌아온다.', unlock: '전단지 · 상하차', price: 0 },
    { id: 'sauna', name: '찜질방', kind: 'rent', sleep: 'sleep_sauna', blurb: '씻고 잔다. 하룻밤씩 낸다.', unlock: '편의점 알바', price: 0 },
    { id: 'gosiwon', name: '고시원', kind: 'rent', sleep: 'sleep_gosiwon', week: 'gosiwon_week', blurb: '주소가 생긴다. 매주 고정비.', unlock: '주식 계좌 · 배달 알바 · 공부', price: 0 },
    { id: 'oneroom', name: '원룸', kind: 'rent', sleep: 'sleep_oneroom', week: 'oneroom_week', blurb: '발 뻗고 잔다. 고정비가 크다.', unlock: '코인 · 레버리지', price: 0 },
    { id: 'home', name: '내 집', kind: 'own', sleep: 'sleep_home', week: 'week_home', blurb: '현금으로만 산다. 월세는 없고 관리비 · 세금만.', unlock: '가게', get price() { return tp('price_home'); } },
    { id: 'apt', name: '아파트', kind: 'own', sleep: 'sleep_apt', week: 'week_apt', blurb: '주담대를 낄 수 있다. 매주 원리금.', unlock: '주담대 · 법인', get price() { return tp('price_apt'); } },
    { id: 'house', name: '주택', kind: 'own', sleep: 'sleep_house', week: 'week_house', blurb: '마당이 있다. 고정비도 마당만큼.', unlock: '그룹', get price() { return tp('price_house'); } },
    { id: 'villa', name: '별장', kind: 'own', sleep: 'sleep_villa', week: 'week_villa', blurb: '집이 두 채. 숨만 쉬어도 나가는 돈도 두 배.', unlock: '대기업', get price() { return tp('price_villa'); } },
    { id: 'hotel', name: '호텔', kind: 'own', sleep: 'sleep_hotel', week: 'week_hotel', blurb: '방이 수백 개. 내 방은 맨 위층.', unlock: '재벌', get price() { return tp('price_hotel'); } },
    { id: 'top', name: '한국 최고 부자', kind: 'top', blurb: '끝.', unlock: '엔딩', get price() { return tp('top_worth'); } },
  ];
  const OWN = 4, TOP = 9; // 내 집부터 산다 · 끝
  // 사업: 알바가 커진다 (같은 미니게임, 일당 × biz_mult^단계). 단계 n 은 사는 곳 tier 3 + n 부터
  const BIZ = [
    { lv: 0, name: '알바' }, { lv: 1, name: '가게' }, { lv: 2, name: '법인' }, { lv: 3, name: '그룹' }, { lv: 4, name: '대기업' }, { lv: 5, name: '재벌' },
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
    { id: 'hantang', name: '한탕바이오', tag: '작전주', kind: 'stock', px: 3150, hint: '누가 사 모으면 튀거나, 털고 끝난다' },
    { id: 'coin', name: '달나라코인', tag: '코인', kind: 'coin', px: 1270, hint: '하루에도 크게 출렁인다' },
  ];
  const SRC = { official: { name: '공시', note: '거의 확실', rel: 'rel_official' }, article: { name: '기사', note: '대체로 맞음', rel: 'rel_article' }, rumor: { name: '찌라시', note: '반반', rel: 'rel_rumor' } };
  const HEAD = {
    buldak: { 1: ['화끈식품, 해외 수출 계약 체결', '화끈식품 신제품 품절 대란', '화끈식품 분기 실적 예상 웃돌아'], '-1': ['화끈식품 제품 회수 조치', '화끈식품 원재료 값 급등', '화끈식품 대주주 지분 매각설'] },
    daejang: { 1: ['대장전자, 대형 공급 계약', '대장전자 배당 확대 발표'], '-1': ['대장전자 공장 가동 차질', '대장전자 실적 전망 낮춰'] },
    coin: { 1: ['달나라코인, 대형 거래소 상장설', '유명인이 달나라코인을 언급'], '-1': ['달나라코인 해킹 의혹', '당국, 코인 단속 예고'] },
  };
  // 속보: 예고 없이 한 종목이 한 칸에 크게 움직인다 (공부로도 안 보임). 지어낸 이름만. 크기 × T.shock_mag
  const SHOCKS = [
    { asset: 'daejang', pct: -0.12, head: '대장전자 회장 사생활 폭로' },
    { asset: 'daejang', pct: -0.10, head: '대장전자 공장 정전' },
    { asset: 'buldak', pct: -0.20, head: '화끈식품 라면에서 이물질' },
    { asset: 'buldak', pct: 0.18, head: '화끈식품 먹방 영상 1억 뷰' },
    { asset: 'hantang', pct: -0.28, head: '한탕바이오 임상 자료 조작 의혹' },
    { asset: 'coin', pct: -0.25, head: '달나라코인 거래소 해킹' },
    { asset: 'coin', pct: -0.22, head: '달나라 재단 대표 잠적' },
    { asset: 'coin', pct: 0.24, head: '억만장자가 달나라코인으로 프로필 변경' },
  ];
  const TITLES = [[0, '서울역 신입'], [500000, '성실한 일용직'], [3000000, '개미'], [10000000, '슈퍼 개미'], [20000000, '여의도 유망주'], [100000000, '억대 자산가'],
    [1000000000, '건물주 지망생'], [10000000000, '큰손'], [30000000000, '재계 인사']];
  const GRADE = { miss: '실수', ok: '보통', good: '잘함', perfect: '완벽', skip: '대충' };
  const byId = (list, id) => list.find(x => x.id === id);
  const jo = (w, a, b) => ((w.charCodeAt(w.length - 1) - 0xAC00) % 28 ? a : b); // 받침이 있으면 a (이 · 을 · 은), 없으면 b

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
    seed = ((seed >>> 0) % 1679616) || 1; // 판 코드(SS-XXXX)로 그대로 적을 수 있는 범위
    const s = {
      v: 3, biz: 0, loan: null, homeVal: 0, act1: null, seed: seed | 0, rng: seed | 0, rng2: (Math.imul(seed | 0, 7919) + 13) | 0, rng3: (Math.imul(seed | 0, 104729) + 71) | 0, name: (name || '').trim() || '나',
      lv: 1, xp: 0, perks: {}, offer: null, picks: 0, combo: 0, buff: {}, event: null, evSeen: [], evDay: {}, ach: [], hpBonus: 0, gutsUsed: false, den: null,
      day: 1, slot: 0, phase: 'day', cash: 0, hp: T.start_hp, tier: 0, deposit: 0, arrears: 0, missed: 0, movedDay: 0, rentPaid: 0,
      jobs: { flyer: 0, loading: 0, store: 0, delivery: 0 }, studied: 0,
      market: { tick: 0, px: {}, hist: {}, chg: {}, news: [], nid: 0, ht: { phase: 'quiet', left: 4 }, intel: null, brief: null, shocks: [], gap: {} }, // intel = 오늘 공부해서 안 내일 것 · brief = 어제 공부해서 아는 오늘 것
      hold: {}, lev: null, quest: 0, title: TITLES[0][1],
      today: null, last: null,
      stats: { alba: 0, jobsDone: 0, bought: 0, trade: 0, gain: 0, htGain: 0, levGain: 0, levOpens: 0, levWins: 0, fees: 0, fixed: 0, liq: 0, perfect: 0, quests: 0, maxTier: 0, evicted: 0,
        comboBest: 0, tips: 0, saunaNights: 0, lossSells: 0, bestGain: 0, missedTotal: 0, lotto: 0, kind: 0, events: 0, foreclosed: 0, loanPaid: 0, loanDone: 0, bizSpent: 0 },
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
  function beginDay(s) { s.today = { income: [], expense: [], startWorth: worth(s), startHp: s.hp, reports: [] }; } // reports: 오늘 채점된 리포트 (밤 정산에 한 줄씩)

  // ── 값 읽기 ─────────────────────────────────────────────────
  const weekOf = day => Math.floor((day - 1) / 7) + 1;
  const perk = (s, id) => (s.perks && s.perks[id]) || 0;
  const hpMax = s => 100 + T.perk_iron * perk(s, 'iron') + (s.hpBonus || 0);
  const thrift = s => 1 - T.perk_thrift * perk(s, 'thrift'); // 끼니 · 찜질방 · 고정비에 곱함
  const mealCost = s => round1k(T.meal_cost * thrift(s)), saunaCost = s => round1k(T.sauna_night * thrift(s));
  const feeMult = s => (perk(s, 'stockonly') ? 0 : perk(s, 'vip') ? 0.5 : 1);
  const legs = s => 1 - T.perk_legs * perk(s, 'legs'); // 발품: 집 · 사업 값에 곱함
  function homePrice(s, tier) { tier = tier == null ? OWN : tier; const h = HOMES[tier]; if (!h || h.kind !== 'own') return h ? h.price : 0; return Math.round(h.price * legs(s) / 10000) * 10000; } // 값은 오르지 않는다
  function housePrice(s) { return homePrice(s, OWN); } // 예전 이름 (= 내 집 값)
  function scale(s) { return s.tier >= OWN ? T['tier_scale_' + Math.min(8, s.tier)] || 1 : 1; } // 정해진 금액(사건 · 퀘스트 보상 · 도박장 판돈)에 곱함
  const sc = (s, amt) => round1k(amt * scale(s));
  function holdValue(s, id) { return s.hold[id].units * s.market.px[id]; }
  function levValue(s) { const l = s.lev; if (!l) return 0; return Math.max(0, l.margin * (1 + l.dir * l.lev * (s.market.px.coin / l.entry - 1))); }
  function levLiq(l) { return l.entry * (1 - l.dir / l.lev); }
  function invested(s) { let v = levValue(s); for (const a of ASSETS) if (a.kind === 'stock') v += holdValue(s, a.id); return v; }
  const loanBal = s => (s.loan ? s.loan.balance : 0);
  function worth(s) { return Math.round(s.cash + (s.deposit || 0) + invested(s) + (s.homeVal || 0) - loanBal(s) - s.arrears); } // 집은 산 값 그대로 자산 · 대출은 빚 (보증금은 없어졌다, 칸은 늘 0)
  function weekCost(s, tier) { tier = tier == null ? s.tier : tier; const k = HOMES[tier] && HOMES[tier].week; return round1k((k ? T[k] : 0) * thrift(s)); }
  function sleepGain(s) { return Math.min(T.regen_max - T.perk_early * perk(s, 'early'), T[HOMES[Math.min(s.tier, 8)].sleep] + T.perk_sleep * perk(s, 'sleep')) - (s.buff.sleepPen > 0 ? T.ev_sleep_pen : 0); } // 잠 + 아침형은 합쳐 regen_max 까지 (특성을 몰아도 무거운 알바 셋을 매일은 못 뛰게)
  const weekStart = day => Math.floor((day - 1) / 7) * 7 + 1;
  const livedFrom = (s, day) => Math.max(weekStart(day), s.movedDay || 1); // 그 주에 지금 집에서 산 첫날
  function loanDue(s, days) { // 이번 주 원리금: 이자 = 잔액 × 이율, 원금 = 처음 빌린 돈 ÷ 기간 (잔액까지만). 그 주에 낀 날만큼
    const l = s.loan;
    if (!l || l.balance <= 0) return { loan: 0, interest: 0, principal: 0 };
    const f = (days == null ? 7 : days) / 7, interest = round1k(l.balance * T.loan_rate * f), principal = Math.min(l.balance, round1k(l.orig / T.loan_weeks * f));
    return { loan: interest + principal, interest, principal };
  }
  function bill(s) { // 다음 청구: 고정비 + 원리금 + 밀린 돈, 며칠 뒤 밤에. 매주 일요일(7 · 14 · 21 …일) 밤, 그 주에 산 날만큼만
    if (s.tier < 2) return null;
    const inDays = (7 - (s.day % 7)) % 7, due = s.day + inDays, days = due - livedFrom(s, due) + 1;
    const week = round1k(weekCost(s) * days / 7), ld = loanDue(s, days);
    return { amt: week + ld.loan + s.arrears, week, loan: ld.loan, interest: ld.interest, principal: ld.principal, arrears: s.arrears, days, inDays };
  }
  function owedOld(s) { // 이사 나갈 때: 살던 곳의 이번 주 고정비(와 대출 이자)를 어제까지 산 날만큼
    if (s.tier < 2) return 0;
    const days = Math.max(0, s.day - livedFrom(s, s.day));
    return round1k(weekCost(s) * days / 7) + (s.loan ? round1k(s.loan.balance * T.loan_rate * days / 7) : 0);
  }
  function riseIn() { return null; } // 집값은 이제 오르지 않는다 (이름만 남김)
  function skill(s, id) { const n = s.jobs[id]; return n >= T.skill_n3 ? 3 : n >= T.skill_n2 ? 2 : n >= T.skill_n1 ? 1 : 0; }
  function skillNext(s, id) { const n = s.jobs[id]; const at = [T.skill_n1, T.skill_n2, T.skill_n3].find(x => n < x); return at ? at - n : 0; }
  function grade(score) { return score >= 0.9 ? 'perfect' : score >= 0.7 ? 'good' : score >= 0.4 ? 'ok' : 'miss'; }
  function unlocked(s, what) { return what === 'stock' || what === 'study' ? s.tier >= 2 : what === 'coin' ? s.tier >= 3 : true; }

  // 지금 칸에서 고를 수 있는 것
  const LOW_HP = '체력이 모자랍니다 — 쉬거나 가벼운 일을';
  function acts(s) {
    const out = [], bm = bizMult(s);
    for (const j of JOBS) {
      if (s.tier < j.tier) continue; // 아직 못 하는 알바는 아예 안 보임
      const hp = T['hp_' + j.id], lv = skill(s, j.id);
      out.push({ kind: 'job', id: j.id, name: j.name, note: j.note, pay: round1k(T['pay_' + j.id] * (1 + T.skill_bonus * lv) * (1 + T.perk_hustle * perk(s, 'hustle')) * (1 + T.perk_workaholic * perk(s, 'workaholic')) * bm), bizMult: bm, hp, lv, toNext: skillNext(s, j.id), ok: s.hp >= hp, why: s.hp >= hp ? '' : LOW_HP });
    }
    const noRest = perk(s, 'workaholic') && out.some(a => a.kind === 'job' && a.ok); // 일중독: 할 수 있는 알바가 하나도 없을 때만 쉰다 (갇히지 않게)
    const auto = autoPay(s, out); // 사업 자동 수입: 일하지 않은 칸에도 들어오는 돈 (가게부터)
    out.push({ kind: 'rest', id: 'rest', name: '쉬기', hp: -(s.tier === 0 ? T.rest_hp_station : T.rest_hp), auto, ok: !noRest, why: noRest ? '일중독: 할 수 있는 알바가 있으면 쉬지 않는다' : '', note: s.tier === 0 ? '벤치에서는 덜 풀린다' : '' });
    if (unlocked(s, 'study')) { const read = studied(s), hp = T.study_hp, ok = !read && s.hp >= hp; out.push({ kind: 'study', id: 'study', name: '공부', hp, auto, ok, why: read ? '오늘 리포트는 이미 읽었습니다' : ok ? '' : LOW_HP, note: '고른 종목 하나의 내일을 한쪽으로 기울여 본다', assets: studyAssets(s) }); }
    return out;
  }

  // ── 칸 행동 ─────────────────────────────────────────────────
  const studied = s => !!(s.market.intel && s.market.intel.madeOn === s.day && !s.market.intel.free); // 오늘 한 칸을 써서 읽었나 (공짜로 얻은 리포트는 안 침)
  function canAct(s) { return !s.ended && s.phase === 'day' && s.slot < 3 && !s.event && !s.den; } // 돌발 사건 · 도박장이 떠 있으면 먼저 끝내야 함
  const skipMult = s => T.mult_skip + T.perk_lazy * perk(s, 'lazy'); // "대충"의 일당 배율 (특성 '요령' 포함)
  function doJob(s, id, score) { // score: 0~1, null 이면 "대충 하기"
    const a = acts(s).find(x => x.id === id);
    if (!canAct(s) || !a || !a.ok) return false;
    const g = score == null ? 'skip' : grade(score + T.perk_hands * perk(s, 'hands'));
    const mult = g === 'skip' ? skipMult(s) : g === 'miss' ? Math.max(T.mult_miss, skipMult(s)) : T['mult_' + g]; // 직접 하면 실수해도 "대충"보다 덜 받지 않는다
    const comboWas = s.combo, comboMult = 1 + (T.combo_bonus + T.perk_streak * perk(s, 'streak')) * comboWas, extra = s.buff.nextJob || 1;
    const pay = round1k(a.pay * mult * comboMult * extra);
    const before = skill(s, id);
    delete s.buff.nextJob;
    if (g === 'good' || g === 'perfect') s.combo = Math.min(T.combo_max, s.combo + 1); else if (g !== 'ok') s.combo = 0; // 잘함 이상이면 쌓이고, 실수 · 대충이면 끊김
    s.stats.comboBest = Math.max(s.stats.comboBest || 0, s.combo);
    s.hp -= a.hp; s.stats.jobsDone = (s.stats.jobsDone || 0) + 1; s.stats.alba += pay; if (g === 'perfect') s.stats.perfect++;
    if (score != null) s.jobs[id]++; // 대충 하면 숙련도는 오르지 않는다
    ev(s, 'job', { id, name: a.name, pay, base: a.pay, grade: g, gradeName: GRADE[g], mult, hp: a.hp, combo: s.combo, comboWas, comboMult, extra });
    const eff = bizEff(s);
    income(s, eff ? BIZ[eff].name + ' 수입 (' + a.name + ')' : a.name + ' 알바', pay);
    if (g === 'perfect' && rnd3(s) < T.tip_p) { const tip = round1k((T.tip_min + rnd3(s) * (T.tip_max - T.tip_min)) * a.bizMult); s.stats.tips = (s.stats.tips || 0) + 1; income(s, '팁', tip); ev(s, 'tip', { amt: tip }); }
    if (skill(s, id) > before) sys(s, a.name + ' 숙련도가 올랐습니다. 일당 +' + Math.round(T.skill_bonus * 100) + '%.', 'good');
    gainXp(s, Math.round(T.xp_job * XPF[g]));
    endSlot(s);
    return true;
  }
  function autoPay(s, jobs) { // 지금 열려 있는 알바 가운데 가장 많이 주는 것(직원이 하는 일이라 내 체력과 무관)의 "보통" 일당(숙련 · 사업 배수 포함, 콤보 · 팁 제외) × biz_auto_단계
    const eff = bizEff(s);
    if (!eff) return 0;
    const best = Math.max(0, ...(jobs || acts(s)).filter(a => a.kind === 'job').map(a => a.pay));
    return round1k(best * T.mult_ok * T['biz_auto_' + eff]);
  }
  function autoIncome(s) { const amt = autoPay(s); if (amt) { income(s, '사업 매출', amt); ev(s, 'auto', { amt, slot: s.slot }); } } // 쉬기 · 공부 칸에 (칸을 넘기기 전에)
  function doRest(s) {
    if (!canAct(s)) return false;
    const r = acts(s).find(a => a.kind === 'rest');
    if (!r.ok) return fail(s, r.why);
    const gain = s.tier === 0 ? T.rest_hp_station : T.rest_hp, before = s.hp;
    s.hp = Math.min(hpMax(s), s.hp + gain);
    ev(s, 'rest', { hp: s.hp - before });
    autoIncome(s);
    endSlot(s);
    return true;
  }
  const studyAssets = s => ASSETS.filter(a => a.kind === 'stock' || unlocked(s, 'coin')).map(a => ({ id: a.id, name: a.name }));
  function doStudy(s, asset) { // 공부 한 번 = 고른 종목 하나의 내일 (체력을 쓴다)
    if (!canAct(s) || !unlocked(s, 'study') || studied(s) || s.hp < T.study_hp || !studyAssets(s).some(a => a.id === asset)) return false;
    const it = s.market.intel, free = it && it.madeOn === s.day && it.free && (it.assets || []).indexOf(asset) >= 0;
    if (it && it.madeOn === s.day) it.free = false; // 귀띔으로 이미 받은 종목이면 다시 뽑지 않고 그대로 (다시 굴려서 고르는 길을 막음)
    const count = free ? it.items.filter(i => i.asset === asset).length + (asset === 'hantang' ? 1 : 0) : readReport(s, asset);
    s.hp -= T.study_hp; s.studied++;
    ev(s, 'study', { asset, count });
    autoIncome(s);
    const nm = byId(ASSETS, asset).name;
    const said = count && asset !== 'hantang' ? (s.market.intel.items.find(i => i.asset === asset) || {}).dir : 0;
    sys(s, asset === 'hantang' ? '리포트: ' + nm + ' — ' + htText(s.market.intel.ht) + ' (' + accText(studyAcc(s)) + ').' : said ? '리포트: 내일 ' + nm + ' 소식은 ' + (said > 0 ? '오르는' : '내리는') + ' 쪽 (' + accText(studyAcc(s)) + '). 내일 밤에 맞았는지 알려 드립니다.' : '리포트: 내일 ' + nm + jo(nm, '은', '는') + ' 소식 없음.');
    gainXp(s, T.xp_study);
    endSlot(s);
    return true;
  }
  const studyAcc = s => Math.min(1, T.study_acc + T.perk_sense * perk(s, 'sense'));
  const accText = acc => '열에 ' + ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'][clamp(Math.round(acc * 10), 0, 10)] + ' 번쯤 맞음'; // 62% → "열에 여섯 번쯤 맞음" (확률로 오른다는 뜻으로 읽히지 않게)
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
      for (const n of m.news) if (n.day === s.day) imp[n.asset] += ((n.truth ? n.dir : -n.dir * T.fake_back) * n.mag - (n.pre || 0)) * w; // 아침 장 전에 들어간 몫(pre)은 빼고
    }
    const hits = warm ? [] : s.market.shocks.filter(k => k.day === s.day && k.slot === s.slot); // 이 칸에 터지는 속보 (평소 움직임에 더해짐)
    for (const k of hits) imp[k.asset] += Math.log(1 + k.pct);
    const px0 = Object.assign({}, m.px), lev0 = levValue(s);
    const r = {};
    r.daejang = T.d_drift + T.d_sigma * gauss(s);
    r.buldak = T.b_sigma * gauss(s);
    const ht = m.ht, z = gauss(s);
    r.hantang = ht.phase === 'quiet' ? T.h_quiet_drift + T.h_quiet_sigma * z : ht.phase === 'gather' ? T.h_gather + T.h_gather_sigma * z : ht.phase === 'pump' ? T.h_pump + 0.02 * z
      : -(ht.drop == null ? T.h_dump_base : ht.drop) * (ht.left >= 2 ? T.h_dump_first : 1 - T.h_dump_first) + 0.02 * z; // drop 이 없으면(예전 저장 · 시험에서 단계만 넣은 경우) 기본 폭락만 // 폭락: 매집 뒤 오른 만큼 + h_dump_base 를 두 칸에
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
      const span = (a, b) => a + Math.floor(rnd(s) * (b - a + 1));
      const toDump = () => { ht.phase = 'dump'; ht.left = 2; ht.drop = (ht.from ? Math.max(0, Math.log(m.px.hantang / ht.from)) : 0) + T.h_dump_base; }; // 예전 저장(from 없음)은 기본 폭락만
      if (ht.phase === 'quiet') { // 매집 시작: 진짜(급등까지 감)인지, 털고 끝나는지는 여기서 시세 난수로 정해 둔다. 알림은 둘 다 똑같이
        ht.phase = 'gather'; ht.left = span(T.h_gather_min, T.h_gather_max); ht.real = rnd(s) < T.h_real_p; ht.hint = rnd(s); ht.from = m.px.hantang;
        if (!warm && unlocked(s, 'stock')) {
          m.htAlert = s.day; // 화면이 그날 동안 한탕바이오 줄에 "거래량 ↑"
          for (const k of ['intel', 'brief']) if (m[k] && m[k].ht && m[k].ht.state === 'quiet') m[k].ht.stale = true; // "조용합니다" 리포트는 낡았다
          ev(s, 'ht_alert', {});
          sys(s, '한탕바이오 거래량이 눈에 띄게 늘고 있습니다. 누군가 사 모으는 중입니다.', 'warn');
        }
      }
      else if (ht.phase === 'gather') {
        if (ht.real) { ht.phase = 'pump'; ht.left = span(T.h_pump_min, T.h_pump_max); } else toDump();
      }
      else if (ht.phase === 'pump') toDump();
      else {
        if (!warm && m.htRead && m.htRead.from === ht.from) { // 리포트 채점은 이번 바퀴(급등 · 폭락)가 값에 다 드러나 조용해진 뒤에만 (앞으로의 시세를 알려 주지 않게 · 난수는 안 씀)
          const said = m.htRead.lean, real = ht.real ? 1 : -1, r = { asset: 'hantang', name: '한탕바이오', said, real, right: said === real, by: 'study' };
          m.htRead = null; if (s.today) (s.today.reports || (s.today.reports = [])).push(r);
          ev(s, 'report_check', { list: [r] });
          sys(s, '한탕바이오 리포트 ' + (r.right ? '맞음' : '틀림') + ': 지난 매집은 ' + (ht.real ? '진짜였습니다 (급등 뒤 털림)' : '가짜였습니다 (급등 없이 털림)') + '.', r.right ? 'good' : 'bad');
        }
        ht.phase = 'quiet'; ht.left = 5 + Math.floor(rnd(s) * 5);
      }
    }
    if (!warm) {
      ev(s, 'tick', { chg: Object.assign({}, m.chg) });
      for (const k of hits) {
        const a = byId(ASSETS, k.asset), coin = a.kind === 'coin', held = coin ? !!s.lev : s.hold[k.asset].units > 0;
        if (!unlocked(s, coin ? 'coin' : 'stock')) continue; // 아직 못 보는 종목의 속보는 알리지 않는다 (시세는 그대로 움직임)
        const delta = !held ? 0 : Math.round(coin ? levValue(s) - lev0 : s.hold[k.asset].units * (m.px[k.asset] - px0[k.asset]));
        ev(s, 'shock', { asset: k.asset, name: a.name, pct: k.pct, head: k.head, held, delta });
        sys(s, '속보: ' + k.head + '. ' + a.name + ' ' + signPct(k.pct) + '.' + (held ? ' 내 손익 ' + (delta >= 0 ? '+' : '') + won(delta) + '.' : ''), k.pct < 0 ? 'bad' : 'good');
      }
      if (s.lev) s.lev.margin -= s.lev.put * s.lev.lev * T.lev_fund; // 포지션을 들고 있는 값 (틱마다)
      if (s.lev && levValue(s) <= 0) liquidate(s);
    }
  }
  function liquidate(s) { // 틱 · 밤사이 갭이 함께 씀
    const l = s.lev, saved = perk(s, 'guts') && !s.gutsUsed ? Math.round(l.put * T.perk_guts) : 0;
    if (saved) { s.gutsUsed = true; s.cash += saved; }
    s.lev = null; s.stats.liq++; s.stats.trade -= l.put - saved;
    ev(s, 'liq', { lost: l.put - saved, saved, dir: l.dir, lev: l.lev });
    sys(s, '청산되었습니다. 증거금 ' + won(l.put - saved) + '이 사라졌습니다.' + (saved ? ' 강심장으로 ' + won(saved) + '은 건졌습니다(한 번뿐).' : '') + ' 레버리지 ' + l.lev + '배는 ' + Math.round(100 / l.lev) + '% 역방향이면 끝입니다.', 'bad');
  }
  function genNews(s, day) {
    const m = s.market;
    for (const id of ['buldak', 'daejang', 'coin']) {
      if (rnd(s) >= T['news_p_' + id]) continue;
      const dir = rnd(s) < (id === 'coin' ? 0.5 : 0.55) ? 1 : -1;
      const x = rnd(s), src = x < 0.2 ? 'official' : x < 0.65 ? 'article' : 'rumor';
      const n = { id: ++m.nid, day, asset: id, dir, src, truth: rnd(s) < T[SRC[src].rel], mag: T['news_mag_' + id] * (0.7 + 0.6 * rnd(s)), head: pick(s, HEAD[id][dir]) }, rel = T[SRC[src].rel];
      n.pre = T.news_priced * dir * n.mag * (rel - (1 - rel) * T.fake_back); // 시장은 아침 장 전에 "믿을 만한 만큼" 먼저 움직인다
      m.news.push(n);
    }
    if (day >= T.shock_from && rnd(s) < T.shock_p) { // 속보도 시세 난수로 미리 정해 둔다 (판 코드가 같으면 같은 속보)
      const k = pick(s, SHOCKS);
      m.shocks.push({ id: ++m.nid, day, slot: Math.min(2, Math.floor(rnd(s) * 3)), asset: k.asset, pct: k.pct * T.shock_mag, head: k.head });
    }
  }
  function todayNews(s) {
    const intel = s.market.brief && s.market.brief.day === s.day ? s.market.brief : null;
    return s.market.news.filter(n => n.day === s.day).map(n => {
      const it = intel && intel.items.find(i => i.nid === n.id);
      return { id: n.id, asset: n.asset, name: byId(ASSETS, n.asset).name, dir: n.dir, src: n.src, srcName: SRC[n.src].name, srcNote: SRC[n.src].note, head: n.head, report: it ? it.dir : 0, by: it ? it.by || 'study' : '' }; // by: 리포트를 어디서 얻었나 (study 공부 · tip 정보통 · chat 리딩방)
    });
  }
  function intelView(s) { // 공부로 얻은 "내일" 정보 (오늘 공부했을 때만 보임)
    const it = s.market.intel;
    if (!it || it.madeOn !== s.day) return null;
    return { day: it.day, assets: (it.assets || []).slice(), items: it.items.map(i => ({ asset: i.asset, name: byId(ASSETS, i.asset).name, dir: i.dir })), ht: it.ht };
  }

  // ── 매매 (칸을 쓰지 않음) ────────────────────────────────────
  function fail(s, why) { ev(s, 'deny', { why }); return false; }
  const canFree = s => !s.ended && s.phase === 'day' && !s.den; // 칸을 안 쓰는 행동(매매 · 이사 · 계약)도 낮에만, 도박장 밖에서
  function buy(s, id, amt) {
    const a = byId(ASSETS, id);
    if (!canFree(s) || !a || a.kind !== 'stock' || !unlocked(s, 'stock')) return fail(s, '아직 계좌가 없습니다');
    if (perk(s, 'coinonly')) return fail(s, '코인 외길: 주식을 살 수 없습니다');
    amt = Math.floor(Math.min(Number(amt), s.cash));
    if (!Number.isFinite(amt) || amt < 10000) return fail(s, '현금이 모자랍니다 (최소 10,000원)');
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
    const gross = h.units * frac * s.market.px[id], fee = Math.round(gross * T.fee * feeMult(s)), cost = h.cost * frac;
    let net = Math.round(gross - fee), pnl = Math.round(net - cost);
    if (pnl > 0 && perk(s, 'stockonly')) { const bonus = Math.round(pnl * T.perk_stockonly); net += bonus; pnl += bonus; } // 주식 외길: 이익에 얹어 줌
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
    if (perk(s, 'stockonly')) return fail(s, '주식 외길: 코인을 할 수 없습니다');
    if (s.lev) return fail(s, '이미 포지션이 있습니다. 먼저 정리하세요');
    margin = Math.floor(Math.min(Number(margin), s.cash)); lev = clamp(Math.round(Number(lev)) || 1, 1, 5);
    if (perk(s, 'beast') && lev < T.beast_min_lev) return fail(s, '야수의 심장: ' + T.beast_min_lev + '배 미만으로는 걸 수 없습니다');
    if (!Number.isFinite(margin) || margin < 100000) return fail(s, '증거금이 모자랍니다 (최소 100,000원)');
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
    let v = Math.round(levValue(s)), pnl = v - l.put;
    if (pnl > 0) { const bonus = Math.round(pnl * (T.perk_coinonly * perk(s, 'coinonly') + T.perk_beast * perk(s, 'beast'))); v += bonus; pnl += bonus; } // 코인 외길 · 야수의 심장
    s.cash += v; s.lev = null; s.stats.trade += pnl; if (pnl > 0) { s.stats.gain += pnl; s.stats.levGain += pnl; s.stats.levWins = (s.stats.levWins || 0) + 1; }
    s.stats.bestGain = Math.max(s.stats.bestGain || 0, pnl);
    ev(s, 'lev', { side: 'close', pnl, value: v });
    profitXp(s, pnl);
    after(s);
    return true;
  }

  // ── 주거 ────────────────────────────────────────────────────
  function moveInfo(s, to) { // 옮길 수 있는지. 고시원 · 원룸은 보증금 없이 순자산 기준만 넘으면 된다 (가져가지 않음)
    if (to !== s.tier + 1 || to > 3) return { ok: false, why: '' };
    const have = worth(s);
    if (to === 1) { const c = saunaCost(s), ok = s.cash >= c; return { ok, need: c, have, pay: 0, settle: 0, why: ok ? '' : '하룻밤 요금 ' + won(c) + '이 있어야 합니다' }; }
    const need = to === 2 ? T.gosiwon_need : T.oneroom_need, settle = owedOld(s), pay = s.arrears + settle; // pay: 나가는 현금 = 밀린 빚 + 살던 곳 정산
    const why = have < need ? '순자산이 ' + won(need - have) + ' 모자랍니다 (기준 ' + won(need) + ', 돈을 내는 것은 아님)'
      : s.cash < pay ? '밀린 고정비 ' + won(pay) + '을 낼 현금이 ' + won(pay - s.cash) + ' 모자랍니다' + (invested(s) > 0 ? ' (투자한 돈은 팔아야 현금)' : '') : '';
    return { ok: !why, need, have, pay, settle, why };
  }
  function move(s, to) {
    const info = moveInfo(s, to);
    if (!canFree(s) || !info.ok) return fail(s, info.why || '지금은 옮길 수 없습니다');
    const from = s.tier;
    if (to >= 2) {
      if (s.arrears) { s.cash -= s.arrears; s.arrears = 0; s.missed = 0; } // 빚 갚기: 순자산은 그대로 (못 낸 날 이미 깎였음)
      if (info.settle) { expense(s, HOMES[from].name + ' 고정비 (산 날만큼)', info.settle); s.stats.fixed += info.settle; }
    }
    s.tier = to; s.movedDay = s.day; s.stats.maxTier = Math.max(s.stats.maxTier || 0, to);
    ev(s, 'tier', { from, to, name: HOMES[to].name, unlock: HOMES[to].unlock, up: true });
    sys(s, to === 1 ? '찜질방 입장. 인류는 지붕을 발명했습니다. 하룻밤 ' + won(saunaCost(s)) + '씩 나갑니다.'
      : to === 2 ? '고시원 입주. 보증금은 없습니다. 주소가 생겨 주식 계좌가 열렸고, 매주 일요일 밤 고정비 ' + won(weekCost(s)) + '이 나갑니다(끼니 포함).'
        : '원룸 입주. 코인과 레버리지가 열렸습니다. 고정비는 주 ' + won(weekCost(s)) + '. 숨만 쉬어도 나갑니다.', 'good');
    after(s);
    return true;
  }
  // ── 집 사기 (내 집부터) · 주담대 · 압류 ─────────────────────────
  const loanCap = (s, tier) => (tier > OWN ? Math.floor(homePrice(s, tier) * T.loan_ltv / 10000) * 10000 : 0); // 주담대는 아파트부터
  const rankOf = (day, a, b, c) => (day <= a ? 'S' : day <= b ? 'A' : day <= c ? 'B' : 'C');
  function homeInfo(s, to) { // 한 단계 위 집을 살 수 있는지. 살던 집(내 집부터)은 산 값 그대로 팔려 대출을 갚고 남은 돈이 보태진다
    const h = HOMES[to], own = !!(h && h.kind === 'own'), price = own ? homePrice(s, to) : 0;
    const sell = s.tier >= OWN ? Math.max(0, (s.homeVal || 0) - loanBal(s)) : 0, settle = own ? owedOld(s) : 0, pay = s.arrears + settle;
    const canLoan = own && to > OWN, loanMax = own ? loanCap(s, to) : 0;
    const full = own ? Math.max(0, price - sell + pay) : 0, down = Math.max(0, full - loanMax);
    const weekly = canLoan ? round1k(loanMax * T.loan_rate) + round1k(loanMax / T.loan_weeks) : 0, fixed = own ? weekCost(s, to) : 0;
    const base = { price, sell, loanMax, down, full, weekly, fixed, canLoan, settle, pay, have: s.cash };
    if (!own || to !== s.tier + 1) return Object.assign(base, { ok: false, why: own ? HOMES[s.tier + 1].name + '부터 차례로 올라갑니다' : '' });
    const short = down - s.cash, inv = invested(s) > 0 ? ' (투자한 돈은 팔아야 현금)' : '';
    const why = short <= 0 ? '' : to === OWN ? '내 집은 현금으로만 삽니다. 현금이 ' + won(short) + ' 모자랍니다' + inv
      : '대출을 최대(' + won(loanMax) + ')로 껴도 현금이 ' + won(short) + ' 모자랍니다' + inv;
    return Object.assign(base, { ok: !why, why });
  }
  function buyHome(s, to, loan) { // loan: 빌릴 돈 (0 ~ loanMax, 만 원 단위로 내림)
    const info = homeInfo(s, to);
    if (!canFree(s) || !info.ok) return fail(s, info.why || '지금은 살 수 없습니다');
    loan = clamp(Math.floor((Number(loan) || 0) / 10000) * 10000, 0, info.loanMax);
    const need = info.full - loan;
    if (s.cash < need) return fail(s, '대출 ' + won(loan) + '이면 현금이 ' + won(need - s.cash) + ' 모자랍니다');
    const from = s.tier, oldVal = s.homeVal || 0, repaid = loanBal(s);
    if (s.arrears) { s.cash -= s.arrears; s.arrears = 0; s.missed = 0; } // 밀린 돈은 이미 순자산에서 빠져 있음
    if (info.settle) { expense(s, HOMES[from].name + ' 고정비 (산 날만큼)', info.settle); s.stats.fixed += info.settle; }
    if (from >= OWN) { s.cash += oldVal - repaid; s.loan = null; s.homeVal = 0; } // 살던 집을 팔아 대출을 갚는다
    s.cash += loan - info.price; s.homeVal = info.price;
    s.loan = loan > 0 ? { balance: loan, orig: loan, day: s.day } : null;
    s.tier = to; s.movedDay = s.day; s.stats.maxTier = Math.max(s.stats.maxTier || 0, to);
    ev(s, 'tier', { from, to, name: HOMES[to].name, unlock: HOMES[to].unlock, up: true, price: info.price, loan, sold: oldVal, repaid });
    sys(s, HOMES[to].name + ' 계약. ' + won(info.price) + (loan ? ', 그중 ' + won(loan) + '은 주담대입니다. 일요일 밤마다 고정비와 함께 ' + T.loan_weeks + '회에 나눠 갚고, 남은 돈에는 한 주에 ' + (Math.round(T.loan_rate * 1000) / 10) + '%씩 이자가 붙습니다' : '. 대출은 없습니다') + '. 주 고정비 ' + won(weekCost(s)) + '.', 'good');
    if (to === OWN && !s.act1) { s.act1 = { day: s.day, rank: rankOf(s.day, T.act1_s, T.act1_a, T.act1_b), worth: worth(s), price: info.price }; ev(s, 'act1', { day: s.act1.day, rank: s.act1.rank }); }
    after(s);
    return true;
  }
  function buyHouse(s) { return buyHome(s, OWN, 0); } // 예전 이름 (= 내 집을 현금으로)
  function loanView(s) {
    const l = s.loan;
    if (!l) return null;
    const d = loanDue(s, 7), per = l.orig / T.loan_weeks;
    return { balance: l.balance, orig: l.orig, weekly: d.loan, interest: d.interest, principal: d.principal, left: Math.ceil(l.balance / per - 1e-9) };
  }
  function loanGone(s, moved) { s.loan = null; if (!moved) s.stats.loanDone = (s.stats.loanDone || 0) + 1; /* 빚으로 넘어가 정리된 것은 다 갚은 것이 아니다 (업적 · 기록에 안 셈) */ ev(s, 'loan_done', { moved: !!moved }); sys(s, moved ? '주담대 원금이 다 밀린 빚으로 넘어가 대출은 없어졌습니다. 밀린 빚 ' + won(s.arrears) + '은 다음 일요일에 냅니다.' : '주담대를 다 갚았습니다. 이제 원리금은 없습니다.', moved ? 'warn' : 'good'); } // moved: 못 낸 원금이 빚으로 옮겨 가 잔액이 0 이 된 때
  function repay(s, amt) { // 미리 갚기 (칸 안 씀). 잔액이 줄면 다음 주 이자가 준다
    if (!canFree(s)) return fail(s, s.den ? '도박장 안에서는 갚을 수 없습니다' : '지금은 갚을 수 없습니다 (낮에만)');
    if (!s.loan || s.loan.balance <= 0) return fail(s, '갚을 대출이 없습니다');
    amt = Math.floor(Math.min(Number(amt), s.cash, s.loan.balance));
    if (!Number.isFinite(amt) || amt <= 0) return fail(s, '현금이 모자랍니다');
    s.cash -= amt; s.loan.balance -= amt;
    ev(s, 'repay', { amt, balance: s.loan.balance });
    if (s.loan.balance <= 0) loanGone(s);
    after(s);
    return true;
  }
  function foreclose(s, notes) { // 두 번 연속 못 내면: 집이 foreclose_rate 값에 팔려 대출 · 빚을 갚고, 남은 돈 + 필요한 만큼의 대출로 바로 아래 집에 (한 번의 압류 = 꼭 한 단계)
    // 판 돈으로 못 갚은 빚은 아래 집 대출에 얹되, 그 집값을 넘는 몫은 탕감. 내 집에서 밀리면 원룸으로 (남은 빚은 탕감)
    const from = s.tier, to = from - 1, sold = round1k((s.homeVal || 0) * T.foreclose_rate), debt = loanBal(s) + s.arrears, w0 = worth(s);
    const repaid = Math.min(sold, debt); // 판 돈으로 먼저 갚고, 남으면 현금으로
    let carry = debt - repaid, left = 0, loan = 0, price = 0;
    s.cash += sold - repaid; s.homeVal = 0; s.loan = null; s.arrears = 0; s.missed = 0;
    if (to >= OWN) {
      price = homePrice(s, to);
      const pay = Math.min(s.cash, price);
      loan = price - pay + carry;
      if (loan > price) { left = loan - price; carry -= left; loan = price; }
      s.cash -= pay; s.homeVal = price; s.loan = loan > 0 ? { balance: loan, orig: loan, day: s.day } : null;
    } else { left = carry; carry = 0; }
    s.tier = to; s.movedDay = s.day + 1; s.combo = 0; s.stats.foreclosed = (s.stats.foreclosed || 0) + 1;
    ev(s, 'foreclose', { from, to, sold, repaid, carried: carry, left, loan, lost: w0 - worth(s) });
    ev(s, 'tier', { from, to, name: HOMES[to].name, up: false });
    const fn = HOMES[from].name, tn = HOMES[to].name;
    const text = '원리금 · 고정비를 두 번 연속 못 내 ' + fn + jo(fn, '이', '가') + ' 압류되었습니다. ' + won(sold) + '에 팔려 대출과 빚 ' + won(repaid) + '을 갚고 ' + tn
      + (to >= OWN ? jo(tn, '으로', '로') + ' 옮겼습니다.' + (loan ? ' 대출 ' + won(loan) + (carry ? '(못 갚은 빚 ' + won(carry) + ' 포함)' : '') + '을 새로 나눠 갚습니다.' : '') : '으로 내려갑니다.')
      + (left > 0 ? ' 못 갚은 ' + won(left) + '은 탕감되었습니다.' : '');
    notes.push({ tone: 'bad', text }); sys(s, text, 'bad');
  }

  function sellAll(s) { // 압류 · 쫓겨남: 코인 포지션과 주식을 그 자리 값에 정리
    if (s.lev) { const v = Math.round(levValue(s)); s.cash += v; s.stats.trade += v - s.lev.put; s.lev = null; }
    for (const a of ASSETS) if (a.kind === 'stock' && s.hold[a.id].units > 0) { const h = s.hold[a.id], v = Math.round(holdValue(s, a.id)); s.cash += v; s.stats.trade += v - Math.round(h.cost); h.units = 0; h.cost = 0; }
  }
  function declareTop(s) { // 호텔에서 순자산이 기준을 넘으면 "한국 최고 부자" 선언 = 엔딩
    if (!canFree(s)) return false;
    if (s.tier < 8) return fail(s, '호텔부터 선언할 수 있습니다');
    const w = worth(s);
    if (w < T.top_worth) return fail(s, '순자산이 ' + won(T.top_worth - w) + ' 모자랍니다');
    s.ended = { kind: 'top', day: s.day, worth: w, rank: rankOf(s.day, T.rank_s, T.rank_a, T.rank_b) };
    s.stats.maxTier = TOP; s.quest = QUESTS.length; s.stats.quests++;
    achTick(s);
    ev(s, 'ending', { kind: 'top' });
    return true;
  }

  // ── 사업: 알바 → 가게 → 법인 → 그룹 → 대기업 → 재벌 ──────────────
  const bizEff = s => clamp(Math.min(s.biz || 0, s.tier - 3), 0, BIZ.length - 1); // 지금 사는 곳이 허락하는 단계까지만 일당에 반영
  const bizMult = s => Math.pow(T.biz_mult, bizEff(s));
  const bizCost = (s, lv) => Math.round(T['biz_cost_' + lv] * legs(s) / 10000) * 10000;
  function bizView(s) {
    const lv = s.biz || 0, eff = bizEff(s), n = lv + 1;
    let next = null;
    if (n < BIZ.length) {
      const cost = bizCost(s, n), needTier = 3 + n;
      const why = s.tier < needTier ? HOMES[needTier].name + '부터 차릴 수 있습니다' : s.cash < cost ? '현금이 ' + won(cost - s.cash) + ' 모자랍니다' : '';
      next = { lv: n, name: BIZ[n].name, cost, mult: Math.pow(T.biz_mult, n), needTier, ok: !why, why };
    }
    return { lv, name: BIZ[lv].name, mult: Math.pow(T.biz_mult, lv), eff, effName: BIZ[eff].name, effMult: Math.pow(T.biz_mult, eff), next };
  }
  function bizUp(s) { // 돈을 들여 한 단계 키운다 (쓴 돈은 자산으로 안 남는다)
    const v = bizView(s);
    if (!canFree(s) || !v.next || !v.next.ok) return fail(s, (v.next && v.next.why) || '더 키울 수 없습니다');
    const n = v.next;
    expense(s, n.name + ' 차리기', n.cost); s.stats.bizSpent = (s.stats.bizSpent || 0) + n.cost;
    s.biz = n.lv;
    ev(s, 'biz', { lv: n.lv, name: n.name, mult: n.mult, cost: n.cost });
    sys(s, n.name + jo(n.name, '을', '를') + ' 차렸습니다. 같은 일을 해도 일당이 ' + num(n.mult) + '배입니다.', 'good');
    after(s);
    return true;
  }
  function goalView(s) { // 위쪽 띠의 "다음 목표". need = 지금 내야 하는 현금(빌려 사는 곳은 순자산 기준), have = 견줄 값
    if (s.tier >= 8) { const price = T.top_worth, have = worth(s); return { tier: TOP, name: HOMES[TOP].name, kind: 'top', price, need: price, have, pct: clamp(have / price, 0, 1), canBuy: have >= price && !s.ended }; }
    const to = s.tier + 1;
    if (to < OWN) { const i = moveInfo(s, to), have = to === 1 ? s.cash : i.have; return { tier: to, name: HOMES[to].name, kind: 'home', price: i.need, need: i.need, have, pct: clamp(have / i.need, 0, 1), canBuy: i.ok }; }
    const i = homeInfo(s, to);
    return { tier: to, name: HOMES[to].name, kind: 'home', price: i.price, need: i.down, have: s.cash, pct: i.down ? clamp(s.cash / i.down, 0, 1) : 1, canBuy: i.ok, loanMax: i.loanMax };
  }

  // ── 밤: 하루 마치기 ─────────────────────────────────────────
  function endDay(s) {
    if (s.ended || s.phase !== 'day' || s.slot < 3 || s.den) return false;
    const notes = [], hpBefore = s.hp;
    let billed = null;
    const b = bill(s);
    if (b && b.inDays === 0) { // 고정비 + 원리금이 먼저 (끼니는 고시원부터 고정비에 들어 있음)
      const home = HOMES[s.tier].name, own = s.tier >= OWN;
      if (s.cash >= b.amt) {
        const old = s.arrears;
        s.cash -= old; expense(s, home + ' 고정비', b.week); s.stats.fixed += b.amt; s.arrears = 0; s.missed = 0; s.rentPaid++;
        if (b.loan) { expense(s, '주담대 이자', b.interest); s.cash -= b.principal; s.loan.balance -= b.principal; s.stats.loanPaid = (s.stats.loanPaid || 0) + 1; } // 원금은 빚이 줄어드는 만큼이라 순자산은 그대로
        billed = { paid: true, amt: b.amt, loan: b.loan, days: b.days, foreclosed: false };
        if (old) notes.push({ tone: 'good', text: '밀린 돈 ' + won(old) + '도 함께 갚았습니다.' });
        if (s.loan && s.loan.balance <= 0) loanGone(s);
      } else {
        const owed = round1k(b.amt * (1 + T.late_fee));
        if (b.principal) s.loan.balance -= b.principal; // 못 낸 원금은 대출에서 빚으로 옮겨 간다
        add(s.today.expense, home + (b.loan ? ' 고정비 · 원리금' : ' 고정비') + ' (못 내서 빚)', owed - s.arrears - b.principal); // 현금은 안 나갔지만 순자산은 그만큼 줄었다
        s.missed++; s.arrears = owed; s.stats.missedTotal = (s.stats.missedTotal || 0) + 1;
        const out = s.missed >= 2;
        billed = { paid: false, amt: b.amt, loan: b.loan, days: b.days, arrears: owed, evicted: out && !own, foreclosed: out && own };
        if (out) { if (own) foreclose(s, notes); else evict(s, notes); }
        else notes.push({ tone: 'bad', text: (b.loan ? '고정비와 원리금 ' : '고정비 ') + won(b.amt) + '을 못 냈습니다. 연체료가 붙어 빚 ' + won(owed) + '이 되었고 다음 일요일에 함께 내야 합니다. 한 번 더 밀리면 ' + (own ? '집이 압류되어 한 단계 아래로 내려갑니다.' : '쫓겨납니다.') });
        if (!out && s.loan && s.loan.balance <= 0) loanGone(s, true); // 경고 뒤에 따로: 마지막 원금까지 빚으로 넘어가 대출은 정리 (빚은 arrears 로 남음)
      }
    }
    if (s.tier === 1 && !(billed && billed.evicted)) { // 고시원에서 쫓겨난 그 밤은 찜질방 요금을 안 받는다 (한 번에 한 단계만)
      if (s.cash >= saunaCost(s)) { expense(s, '찜질방', saunaCost(s)); s.stats.saunaNights = (s.stats.saunaNights || 0) + 1; }
      else { s.tier = 0; notes.push({ tone: 'bad', text: '찜질방 요금이 없어 서울역에서 잤습니다.' }); ev(s, 'tier', { from: 1, to: 0, name: HOMES[0].name, up: false }); }
    }
    if (s.tier < 2) {
      if (s.buff.freeMeal) { delete s.buff.freeMeal; notes.push({ tone: 'good', text: '챙겨 둔 도시락으로 끼니를 때웠습니다.' }); }
      else if (s.cash >= mealCost(s)) expense(s, '끼니', mealCost(s));
      else { s.hp = Math.max(0, s.hp - T.meal_skip_hp); notes.push({ tone: 'bad', text: '끼니를 걸렀습니다. 체력 −' + T.meal_skip_hp }); }
    }
    const m = s.market, brief = m.brief && m.brief.day === s.day ? m.brief : null, checked = (s.today.reports || []).slice(); // 오늘 소식의 하루가 끝났다: 어제 받은 리포트(귀띔 · 리딩방 포함) 채점
    if (brief) for (const it of brief.items) {
      const n = m.news.find(x => x.id === it.nid);
      if (!n || n.day !== s.day || (it.asset === 'coin' && !unlocked(s, 'coin'))) continue;
      const real = n.truth ? n.dir : -n.dir;
      checked.push({ asset: it.asset, name: byId(ASSETS, it.asset).name, said: it.dir, real, right: it.dir === real, by: it.by || 'study' });
    }
    if (checked.length > (s.today.reports || []).length) ev(s, 'report_check', { list: checked.slice((s.today.reports || []).length) });
    const sleep = sleepGain(s), hpMid = s.hp;
    if (s.buff.sleepPen > 0) { notes.push({ tone: 'bad', text: '잠을 설쳤습니다. 회복 −' + T.ev_sleep_pen }); if (--s.buff.sleepPen <= 0) delete s.buff.sleepPen; }
    s.hp = Math.min(hpMax(s), s.hp + sleep);
    gainXp(s, T.xp_day);
    const w = worth(s), labor = sum(s.today.income), spent = sum(s.today.expense), goal = goalView(s);
    s.last = {
      day: s.day, income: s.today.income, expense: s.today.expense, labor, spent,
      invest: w - s.today.startWorth - labor + spent, worthStart: s.today.startWorth, worthEnd: w,
      hp: { before: hpBefore, mid: hpMid, after: s.hp, sleep: s.hp - hpMid }, home: HOMES[s.tier].name, notes, billed, reports: checked, // reports: [{ asset, name, said, real, right, by: 'study'|'tip'|'chat' }]
      house: { price: goal.price, pct: goal.pct }, goal, lastDay: false, // house: 예전 이름 (다음 목표의 값 · 진행률). 기한이 없어 lastDay 는 늘 false
    };
    s.phase = 'night';
    ev(s, 'night', {});
    return true;
  }
  function evict(s, notes) {
    const from = s.tier, hadLev = !!s.lev, hadStock = ASSETS.some(a => a.kind === 'stock' && s.hold[a.id].units > 0);
    if (s.lev) { const v = Math.round(levValue(s)); s.cash += v; s.stats.trade += v - s.lev.put; s.lev = null; } // 원룸에서만 열리는 코인은 먼저 정리
    const short = s.cash < s.arrears;
    if (short) sellAll(s); // 빚은 현금에서, 모자라면 주식부터 정리해 갚는다
    const paid = Math.min(s.cash, s.arrears), left = s.arrears - paid;
    s.cash -= paid; s.arrears = 0; s.missed = 0;
    s.tier = from - 1; // 한 단계 아래로
    if (s.tier < 2) sellAll(s);
    s.movedDay = s.day + 1; s.stats.evicted = (s.stats.evicted || 0) + 1; s.combo = 0;
    const to = HOMES[s.tier].name, sold = hadStock && (short || s.tier < 2), closed = [hadLev ? '코인 포지션' : '', sold ? '주식' : ''].filter(Boolean); // 알림 글은 실제로 일어난 일만
    notes.push({ tone: 'bad', text: '고정비를 두 번 연속 못 내 ' + HOMES[from].name + '에서 쫓겨났습니다. ' + (paid > 0 ? (short && hadStock ? '현금과 주식' : '현금') + '에서 빚 ' + won(paid) + '을 갚고 ' : '') + to + jo(to, '으로', '로') + ' 내려갑니다.'
      + (closed.length ? ' ' + closed.join('과 ') + '은 그 자리 값에 팔아 현금으로 바꿨습니다.' : '') + (left > 0 ? ' 못 갚은 ' + won(left) + '은 탕감되었습니다.' : '') + (s.tier === 1 ? ' 오늘 밤 찜질방 요금은 받지 않습니다.' : '') });
    ev(s, 'tier', { from, to: s.tier, name: to, up: false });
  }
  function nextDay(s) {
    if (s.ended || s.phase !== 'night') return false; // 기한은 없다 ("N일째"로만 센다)
    const quest0 = s.quest;
    s.day++; s.slot = 0; s.phase = 'day';
    s.market.news = s.market.news.filter(n => n.day >= s.day); s.market.shocks = s.market.shocks.filter(k => k.day >= s.day);
    s.market.brief = s.market.intel && s.market.intel.day === s.day ? s.market.intel : null; s.market.intel = null; // 어제 읽은 리포트는 오늘 소식 옆에 붙는다
    openGap(s);
    genNews(s, s.day + 1);
    if (perk(s, 'early')) s.hp = Math.min(hpMax(s), s.hp + T.perk_early * perk(s, 'early'));
    beginDay(s);
    ev(s, 'day', { day: s.day });
    if (perk(s, 'tipster')) tipster(s);
    const b = bill(s);
    if (b && b.inDays === 0) sys(s, '오늘 밤 ' + (b.loan ? '고정비와 원리금 ' : '고정비 ') + won(b.amt) + '이 나갑니다. 현금으로 준비하세요.', 'warn');
    if (unlocked(s, 'stock')) for (const n of todayNews(s)) if (n.asset !== 'coin' || unlocked(s, 'coin')) ev(s, 'news', { news: n });
    after(s);
    if (s.quest === quest0 && !s.offer) rollEvent(s); // 퀘스트 완료 · 특성 고르기가 뜨는 아침에는 사건을 겹치지 않는다
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
  const qamt = (s, amt) => round1k(amt * scale(s) * (1 + T.perk_quest * perk(s, 'quester'))); // 사는 곳에 따라 커진다
  const qcash = (s, amt) => income(s, '퀘스트 보상', qamt(s, amt));
  const QUESTS = [
    { id: 'first_job', title: '첫 끼니를 벌어라', desc: '알바를 한 번 해낸다. 전단지가 가볍다.', cur: s => Math.min(1, totalJobs(s)), goal: () => 1, unit: '회',
      reward: s => { s.hp = Math.min(hpMax(s), s.hp + 10); }, rtext: '삼각김밥 (체력 +10)' },
    { id: 'survive', title: '오늘을 버텨라', desc: '세 칸을 다 쓰고 "하루 마치기"로 밤을 넘긴다.', cur: s => (s.day > 1 ? 1 : 0), goal: () => 1, unit: '일',
      reward: s => qcash(s, T.q_survive_cash), rtext: s => won(qamt(s, T.q_survive_cash)) },
    { id: 'roof', title: '지붕 아래에서 자라', desc: '찜질방으로 옮긴다. 자고 나면 체력이 더 많이 돌아온다.', cur: s => (s.tier >= 1 ? 1 : 0), goal: () => 1, unit: '', go: 'move',
      reward: s => { s.hp = Math.min(hpMax(s), s.hp + 10); }, rtext: '씻었다 (체력 +10) · 편의점 알바 열림' },
    { id: 'address', title: '주소를 만들어라', desc: () => '순자산 ' + won(T.gosiwon_need) + '을 모아 고시원에 입주한다. 보증금은 없고 기준만 넘으면 된다. 주소가 있어야 계좌를 연다.', cur: s => (s.tier >= 2 ? T.gosiwon_need : clamp(worth(s), 0, T.gosiwon_need)), goal: () => T.gosiwon_need, unit: '원', go: 'move',
      done: s => s.tier >= 2, reward: () => { }, rtext: '주식 계좌 · 배달 알바 · 공부 열림' },
    { id: 'first_stock', title: '첫 주식을 사라', desc: '아무 주식이나 100,000원어치 이상 산다. 대장전자가 얌전하다.', cur: s => Math.min(s.stats.bought, 100000), goal: () => 100000, unit: '원', go: 'stock',
      skip: s => s.tier >= 3, reward: s => qcash(s, T.q_stock_cash), rtext: s => won(qamt(s, T.q_stock_cash)) },
    { id: 'study', title: '내일을 미리 읽어라', desc: () => '한 칸과 체력 ' + T.study_hp + '을 "공부"에 쓴다. 고른 종목 하나의 내일 소식이 오르는 쪽인지 내리는 쪽인지 리포트가 알려 준다 (' + accText(T.study_acc) + '). 굴리는 돈이 클수록 값어치가 있다.', cur: s => Math.min(1, s.studied), goal: () => 1, unit: '회',
      skip: s => s.tier >= 3, reward: s => qcash(s, T.q_study_cash), rtext: s => won(qamt(s, T.q_study_cash)) },
    { id: 'gain', title: '수익을 실현하라', desc: '오른 주식을 팔아 이익 50,000원 이상을 확정한다. 팔기 전까지는 내 돈이 아니다.', cur: s => Math.min(s.stats.gain, 50000), goal: () => 50000, unit: '원', go: 'stock',
      skip: s => s.tier >= 3, reward: s => qcash(s, T.q_gain_cash), rtext: s => won(qamt(s, T.q_gain_cash)) },
    { id: 'pump', title: '세력에 올라타라', desc: '한탕바이오에 "거래량" 알림이 뜨면 누가 사 모으는 중이다. 진짜면 급등하고, 아니면 털고 폭락한다. 폭락 전에 팔아 이익 100,000원 이상.', cur: s => Math.min(s.stats.htGain || 0, 100000), goal: () => 100000, unit: '원', go: 'stock',
      skip: s => s.tier >= 3, reward: s => qcash(s, T.q_pump_cash), rtext: s => won(qamt(s, T.q_pump_cash)) },
    { id: 'worth', title: '순자산 3,000,000원', desc: '현금과 투자한 돈을 합쳐 3,000,000원.', cur: s => Math.min(worth(s), 3000000), goal: () => 3000000, unit: '원',
      reward: s => qcash(s, T.q_worth_cash), rtext: s => won(qamt(s, T.q_worth_cash)) },
    { id: 'oneroom', title: '원룸으로 올라가라', desc: () => '순자산 ' + won(T.oneroom_need) + '이 되면 원룸에 입주한다. 보증금은 없고, 대신 주 고정비가 커진다.', cur: s => (s.tier >= 3 ? T.oneroom_need : clamp(worth(s), 0, T.oneroom_need)), goal: () => T.oneroom_need, unit: '원', go: 'move',
      done: s => s.tier >= 3, reward: () => { }, rtext: '코인 · 레버리지 열림' },
    { id: 'lev', title: '레버리지를 다뤄라', desc: '코인 포지션을 이익 50,000원 이상으로 정리한다. 작게 걸어 본다. 방향을 틀리면 증거금이 통째로 사라진다.', cur: s => Math.min(s.stats.levGain, 50000), goal: () => 50000, unit: '원', go: 'coin',
      skip: s => worth(s) >= housePrice(s) * 0.6 || s.tier >= OWN, reward: s => qcash(s, T.q_lev_cash), rtext: s => won(qamt(s, T.q_lev_cash)) },
    { id: 'house', title: '내 집을 사라', desc: s => '현금 ' + won(housePrice(s)) + '으로 내 집을 산다. 내 집은 대출 없이 현금으로만 산다(투자한 돈은 팔아서). 월세 대신 관리비 · 세금만 나간다.', cur: s => (reached(s, OWN) ? housePrice(s) : clamp(s.cash, 0, housePrice(s))), goal: s => housePrice(s), unit: '원', go: 'house',
      done: s => reached(s, OWN), reward: () => { }, rtext: '1막 끝 · 가게를 차릴 수 있다' },
    bizQuest('shop', 1, '가게를 차려라', '알바를 가게로 키운다. 같은 일을 해도 일당이 몇 배가 된다. 차리는 돈은 자산으로 남지 않는다.'),
    homeQuest('apt', 5, '아파트로 올라가라', s => '아파트는 주담대를 낄 수 있다. 값의 ' + Math.round((1 - T.loan_ltv) * 100) + '%만 현금으로 있으면 된다(살던 집을 판 돈 포함). 대신 매주 일요일 밤 원리금이 고정비와 함께 나가고, 두 번 연속 못 내면 압류되어 한 단계 아래로 내려간다.'),
    { id: 'repay1', title: '원리금을 제때 내라', desc: '일요일 밤 고정비와 주담대 원리금을 한 번 제때 낸다. 미리 갚으면 다음 주 이자가 준다.', cur: s => Math.min(1, s.stats.loanPaid || 0), goal: () => 1, unit: '회',
      skip: s => !s.loan && !(s.stats.loanPaid > 0), reward: s => qcash(s, T.q_repay_cash), rtext: s => won(qamt(s, T.q_repay_cash)) },
    bizQuest('corp', 2, '법인으로 키워라', '가게를 법인으로 키운다.'),
    homeQuest('house2', 6, '주택으로 올라가라', '마당 있는 주택. 대출을 얼마나 낄지는 내가 고른다.'),
    bizQuest('group', 3, '그룹으로 키워라', '법인을 그룹으로 키운다.'),
    homeQuest('villa', 7, '별장을 사라', '집이 두 채. 고정비도 두 배쯤.'),
    bizQuest('big', 4, '대기업으로 키워라', '그룹을 대기업으로 키운다.'),
    homeQuest('hotel', 8, '호텔을 사라', '마지막 건물. 내 방은 맨 위층.'),
    bizQuest('chaebol', 5, '재벌이 되어라', '대기업을 재벌로 키운다.'),
    { id: 'top', title: '한국 최고 부자', desc: () => '호텔에서 순자산 ' + won(T.top_worth) + '을 넘기고 선언한다.', cur: s => clamp(worth(s), 0, T.top_worth), goal: () => T.top_worth, unit: '원', go: 'top',
      done: s => !!(s.ended && s.ended.kind === 'top'), reward: () => { }, rtext: '엔딩' },
  ];
  function reached(s, tier) { return (s.stats.maxTier || 0) >= tier || s.tier >= tier; }
  function bizQuest(id, lv, title, desc) {
    return { id, title, desc: s => desc + ' 값 ' + won(bizCost(s, lv)) + ', 일당 ' + num(Math.pow(T.biz_mult, lv)) + '배.', cur: s => Math.min(s.biz || 0, lv), goal: () => lv, unit: '단계', go: 'biz', done: s => (s.biz || 0) >= lv, reward: () => { }, rtext: BIZ[lv].name };
  }
  function homeQuest(id, tier, title, desc) {
    return { id, title, desc: s => (typeof desc === 'function' ? desc(s) : desc) + ' 값 ' + won(homePrice(s, tier)) + '.', cur: s => (reached(s, tier) ? 1 : 0), goal: () => 1, unit: '', go: 'house', done: s => reached(s, tier), reward: () => { }, rtext: HOMES[tier].name };
  }
  function questDone(s, q) { return q.done ? q.done(s) : q.cur(s) >= q.goal(s); }
  function questView(s) {
    const q = QUESTS[s.quest];
    if (!q) return null;
    const cur = q.cur(s), goal = q.goal(s);
    return { id: q.id, n: s.quest + 1, of: QUESTS.length, title: q.title, desc: typeof q.desc === 'function' ? q.desc(s) : q.desc, cur, goal, unit: q.unit, pct: goal ? clamp(cur / goal, 0, 1) : 0, near: goal > 1 && cur / goal >= 0.8 && cur < goal, reward: typeof q.rtext === 'function' ? q.rtext(s) : q.rtext, go: q.go || '' };
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
    { id: 'sleep', name: '꿀잠', icon: 'zzz', max: 2, desc: () => '밤마다 체력을 ' + T.perk_sleep + ' 더 회복' },
    { id: 'hustle', name: '일머리', icon: 'coin', max: 3, grp: 'work', desc: () => '알바 일당 +' + pc(T.perk_hustle) },
    { id: 'hands', name: '금손', icon: 'sparkle', max: 2, desc: () => '미니게임 판정이 후해진다' },
    { id: 'lazy', name: '요령', icon: 'skip', max: 2, desc: () => '"대충" 배율 +' + T.perk_lazy + ', 실수해도 그만큼은 받는다' },
    { id: 'streak', name: '리듬', icon: 'fire', max: 2, desc: () => '콤보 한 단계의 보너스 +' + pc(T.perk_streak) + 'p' },
    { id: 'thrift', name: '짠돌이', icon: 'tag', max: 2, desc: () => '끼니 · 찜질방 · 고정비 −' + pc(T.perk_thrift) },
    { id: 'early', name: '아침형 인간', icon: 'sun', max: 2, desc: () => '매일 아침 체력 +' + T.perk_early },
    { id: 'quester', name: '보상 사냥꾼', icon: 'gift', max: 1, desc: () => '퀘스트 현금 보상 +' + pc(T.perk_quest) },
    { id: 'legs', name: '발품', icon: 'rise', max: 2, desc: () => '집 · 사업 값 −' + pc(T.perk_legs) },
    { id: 'sense', name: '눈치', icon: 'eye', max: 2, need: s => s.tier >= 2, desc: () => '리포트가 맞을 확률 +' + pc(T.perk_sense) + 'p' },
    { id: 'vip', name: '수수료 우대', icon: 'percent', max: 1, need: s => s.tier >= 2, desc: () => '매매 수수료 절반' },
    { id: 'tipster', name: '정보통', icon: 'news', max: 1, need: s => s.tier >= 2, desc: () => '아침마다 소식 하나의 진짜 방향을 귀띔받는다 (' + pc(T.perk_tip_acc) + ' 맞음)' },
    { id: 'guts', name: '강심장', icon: 'shield', max: 1, need: s => s.tier >= 3, desc: () => '청산될 때 한 번, 증거금의 ' + pc(T.perk_guts) + '를 건진다' },
    // 양날: 얻는 것 + 대신 못 하는 것(con). 레벨 3 · 6 · 9 의 고르기에 한 장씩만. 같은 무리(grp)에서는 한 판에 한 가지 (일머리 · 일중독도 'work' 한 무리 — 일머리는 3장까지 겹쳐 찍을 수 있다)
    { id: 'coinonly', name: '코인 외길', icon: 'bolt', max: 1, aug: true, grp: 'invest', con: '이 판 끝까지 주식을 살 수 없다 (가진 주식은 팔 수 있다)', need: s => s.tier >= 3, desc: () => '코인 이익 +' + pc(T.perk_coinonly) },
    { id: 'stockonly', name: '주식 외길', icon: 'chart', max: 1, aug: true, grp: 'invest', con: '이 판 끝까지 코인을 할 수 없다 (연 포지션은 정리할 수 있다)', need: s => s.tier >= 2, desc: () => '주식 이익 +' + pc(T.perk_stockonly) + ' · 수수료 0' },
    { id: 'workaholic', name: '일중독', icon: 'clock', max: 1, aug: true, grp: 'work', con: '쉴 수 없다 (할 수 있는 알바가 없을 때만)', desc: () => '알바 일당 +' + pc(T.perk_workaholic) },
    { id: 'beast', name: '야수의 심장', icon: 'skull', max: 1, aug: true, grp: 'invest', get con() { return T.beast_min_lev + '배 미만으로는 걸 수 없다'; }, need: s => s.tier >= 3, desc: () => '코인 이익 +' + pc(T.perk_beast) },
  ];
  const xpNeed = lv => T.lv_base + T.lv_step * (lv - 1);
  function gainXp(s, n) {
    if (!(n > 0) || s.ended) return;
    s.xp += n; s.stats.xp = (s.stats.xp || 0) + n;
    while (s.xp >= xpNeed(s.lv)) { s.xp -= xpNeed(s.lv); s.lv++; s.picks = (s.picks || 0) + 1; ev(s, 'level', { lv: s.lv }); }
    if (s.picks > 0 && !s.offer) makeOffer(s);
  }
  const profitXp = (s, pnl) => { if (pnl > 0) gainXp(s, Math.min(T.xp_profit_cap, Math.floor(pnl / 10000 * T.xp_profit))); };
  function makeOffer(s) { // 아직 다 안 찍은 특성 가운데 셋. 레벨 3 · 6 · 9 의 고르기에는 그중 한 장이 양날
    const free = p => perk(s, p.id) < p.max && (!p.need || p.need(s)) && !(p.grp && PERKS.some(q => q.grp === p.grp && q.id !== p.id && perk(s, q.id) > 0)); // 같은 무리의 다른 특성을 가졌으면 안 뜬다 (자기 자신은 max 로만 막는다)
    const augLv = (s.lv - s.picks + 1) % T.aug_every === 0; // 지금 고르는 것이 몇 레벨 몫인가 (한꺼번에 여러 레벨이 오를 때)
    const pool = PERKS.filter(p => !p.aug && free(p)), augs = augLv ? PERKS.filter(p => p.aug && free(p)) : [], out = [];
    while (out.length < (augs.length ? 2 : 3) && pool.length) out.push(pool.splice(Math.floor(rnd3(s) * pool.length), 1)[0].id);
    if (augs.length) out.splice(Math.floor(rnd3(s) * (out.length + 1)), 0, augs[Math.floor(rnd3(s) * augs.length)].id);
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
  const perkCard = (s, p) => ({ id: p.id, name: p.name, icon: p.icon, desc: p.desc(), n: perk(s, p.id), max: p.max, aug: !!p.aug, con: p.con || '', excl: exclText(p) });
  function exclText(p) { // 함께 가질 수 없는 특성 (같은 무리의 다른 것들)
    const o = p.grp ? PERKS.filter(q => q.grp === p.grp && q.id !== p.id).map(q => q.name) : [];
    return o.length ? o.join(' · ') + jo(o[o.length - 1], '과', '와') + ' 함께 가질 수 없다' : '';
  }
  const offerView = s => (s.offer ? s.offer.map(id => perkCard(s, byId(PERKS, id))) : null);
  const perksView = s => PERKS.filter(p => perk(s, p.id) > 0).map(p => perkCard(s, p));
  const xpView = s => ({ lv: s.lv, xp: s.xp, need: xpNeed(s.lv) });

  // ── 돌발 사건: 아침에 가끔, 선택지 둘 ────────────────────────
  const heal = (s, n) => { s.hp = Math.min(hpMax(s), s.hp + n); }, hurt = (s, n) => { s.hp = Math.max(0, s.hp - n); };
  function readReport(s, asset) { // 고른 종목 하나의 내일 (공부 · 단골이 함께 씀). 같은 날 여러 종목이면 합쳐 둔다
    const day = s.day + 1, m = s.market, acc = studyAcc(s);
    const it = m.intel && m.intel.madeOn === s.day && m.intel.assets ? m.intel : (m.intel = { day, madeOn: s.day, assets: [], items: [], ht: null });
    if (it.assets.indexOf(asset) < 0) it.assets.push(asset);
    if (asset === 'hantang') { // 단계 · 시점은 안 알려 준다. 매집 중일 때만 "진짜 쪽 / 털기 쪽" 기울기 (맞을 확률 acc, 시세 난수로 미리 정해 둔 값이라 다시 읽어도 같음)
      const ht = m.ht;
      it.ht = ht.phase === 'gather' ? { state: 'lean', lean: (ht.hint < acc) === ht.real ? 1 : -1 } : { state: ht.phase === 'quiet' ? 'quiet' : 'late', lean: 0 };
      if (it.ht.state === 'lean') m.htRead = { lean: it.ht.lean, from: ht.from, day: s.day }; // 이번 매집이 끝날 때 맞았는지 채점
      return 1;
    }
    const items = m.news.filter(n => n.day === day && n.asset === asset).map(n => { const eff = n.truth ? n.dir : -n.dir; return { nid: n.id, asset: n.asset, dir: rnd3(s) < acc ? eff : -eff, by: 'study' }; });
    it.items = it.items.filter(i => i.asset !== asset).concat(items);
    return items.length;
  }
  const htText = h => (!h ? '' : h.stale ? '리포트 뒤에 거래량이 늘었습니다 (읽을 때는 조용했음)' : h.state === 'lean' ? (h.lean > 0 ? '이번 매집은 진짜 쪽으로 보입니다' : '이번 매집은 털고 끝날 쪽으로 보입니다') : h.state === 'quiet' ? '지금은 조용합니다' : '이미 움직였습니다');
  function openGap(s) { // 밤사이: 오늘 소식은 아침 장 전에 "믿을 만한 만큼" 먼저 값에 들어간다. 하루 3점을 지키려 차트의 어제 마지막 점을 옮긴다
    // gap 사건의 delta = 밤 정산의 순자산 → 아침 순자산 차이 (갭으로 청산되면 그것까지)
    const m = s.market, g = {}, w0 = worth(s), pct = {};
    for (const n of m.news) if (n.day === s.day && n.pre) g[n.asset] = (g[n.asset] || 0) + n.pre;
    m.gap = {};
    for (const id in g) { pct[id] = Math.exp(g[id]) - 1; m.gap[id] = pct[id]; m.px[id] = Math.max(10, m.px[id] * Math.exp(g[id])); const h = m.hist[id]; h[h.length - 1] = m.px[id]; }
    const liq = !!(s.lev && levValue(s) <= 0);
    if (liq) liquidate(s);
    if (Object.keys(g).length) ev(s, 'gap', { pct, delta: worth(s) - w0, liq });
  }
  function verifyToday(s) { // 오늘 소식 전부의 진짜 방향
    const m = s.market;
    if (!m.brief || m.brief.day !== s.day) m.brief = { day: s.day, madeOn: s.day - 1, ht: null, items: [] }; // 이미 아는 것(어제 공부한 리포트 · 정보통 귀띔)은 덮어쓰지 않고, 모르는 소식만 채운다
    for (const n of m.news) if (n.day === s.day && !m.brief.items.some(i => i.nid === n.id)) { const eff = n.truth ? n.dir : -n.dir; m.brief.items.push({ nid: n.id, asset: n.asset, dir: rnd3(s) < T.chat_acc ? eff : -eff, by: 'chat' }); }
  }
  function tipster(s) { // 정보통: 아침마다 아직 모르는 오늘 소식 하나
    const m = s.market;
    if (!unlocked(s, 'stock')) return;
    if (!m.brief || m.brief.day !== s.day) m.brief = { day: s.day, madeOn: s.day - 1, items: [], ht: null };
    const n = m.news.find(x => x.day === s.day && (x.asset !== 'coin' || unlocked(s, 'coin')) && !m.brief.items.some(i => i.nid === x.id));
    if (n) { const eff = n.truth ? n.dir : -n.dir; m.brief.items.push({ nid: n.id, asset: n.asset, dir: rnd3(s) < T.perk_tip_acc ? eff : -eff, by: 'tip' }); } // 공부한 리포트보다는 덜 정확
  }
  // 돈은 sc(s, 금액) = 금액 × scale(s) (사는 곳에 따라 커짐). cost 도 같은 배수로 (eventView · choose 가 곱함)
  const EVENTS = [
    { id: 'purse', icon: 'purse', tier: [0, 1], title: '떨어진 지갑', text: '벤치 밑에 지갑이 떨어져 있다. 현금이 꽤 들었다.',
      a: { label: '주인을 찾아 준다', run: s => { s.stats.kind = 1; gainXp(s, 20); heal(s, 5); if (rnd3(s) < 0.4) { income(s, '사례금', sc(s, 50000)); return '주인이 사례금 ' + won(sc(s, 50000)) + '을 쥐여 줬다. 마음도 든든하다.'; } return '주인은 고맙다는 말만 남기고 갔다. 그래도 마음은 든든하다.'; } },
      b: { label: '현금만 챙긴다', run: s => { income(s, '주운 돈', sc(s, 30000)); hurt(s, 6); return won(sc(s, 30000)) + '을 챙겼다. 종일 뒤통수가 따갑다.'; } } },
    { id: 'bird', icon: 'bird', tier: [0, 0], title: '비둘기의 습격', text: '비둘기 떼가 아침으로 먹으려던 삼각김밥을 노린다.',
      a: { label: '맞서 싸운다', run: s => { if (rnd3(s) < 0.6) { heal(s, 10); return '지켜 냈다. 아침이 든든하다.'; } hurt(s, 8); return '졌다. 비둘기는 강했다.'; } },
      b: { label: '반을 떼어 준다', run: s => { gainXp(s, 12); return '나눠 먹었다. 해탈에 한 걸음 가까워졌다.'; } } },
    { id: 'soup', icon: 'meal', tier: [0, 1], title: '무료 급식', text: '역 광장에 무료 급식 줄이 늘어섰다. 국밥 냄새가 난다.',
      a: { label: '줄을 선다', run: s => { heal(s, 14); return '뜨끈한 국밥 한 그릇. 살 것 같다.'; } },
      b: { label: '그 시간에 전단지를 돌린다', run: s => { income(s, '짬짬이 전단지', sc(s, 20000)); return '점심 손님들에게 전단지를 돌려 ' + won(sc(s, 20000)) + '을 벌었다.'; } } },
    { id: 'egg', icon: 'egg', tier: [1, 1], title: '가위바위보 내기', text: s => '옆자리 아저씨가 삶은 달걀을 까며 ' + won(sc(s, 20000)) + ' 내기 가위바위보를 하자고 한다. 진 사람이 식혜도 산다.',
      a: { label: '한다', cost: 20000, run: s => { if (rnd3(s) < 0.5) { income(s, '내기', sc(s, 20000)); return '이겼다. ' + won(sc(s, 20000)) + '과 식혜를 얻었다.'; } expense(s, '내기', sc(s, 20000)); return '졌다. ' + won(sc(s, 20000)) + '이 식혜와 함께 사라졌다.'; } },
      b: { label: '잠이나 잔다', run: s => { heal(s, 8); return '아저씨의 한숨을 자장가 삼아 잤다.'; } } },
    { id: 'lunchbox', icon: 'lunchbox', tier: [1, 2], title: '폐기 도시락', text: '편의점 사장이 유통기한이 임박한 도시락을 내민다.',
      a: { label: '지금 먹는다', run: s => { heal(s, 12); return '제육 도시락이었다. 힘이 난다.'; } },
      b: { label: '저녁으로 아껴 둔다', cond: s => s.tier < 2, run: s => { if (s.tier < 2) s.buff.freeMeal = 1; heal(s, 4); return s.tier < 2 ? '가방에 넣어 뒀다. 오늘 끼니값이 굳는다.' : '아껴 뒀다가 야식으로 먹었다.'; } } },
    { id: 'swap', icon: 'swap', tier: [1, 3], title: '대타 요청', text: '알바 사장이 급하게 대타를 찾는다. 웃돈을 얹어 준단다.',
      a: { label: '간다', run: s => { s.buff.nextJob = 1.5; return '다음 알바는 일당이 1.5배다.'; } },
      b: { label: '오늘은 쉰다', run: s => { heal(s, 10); return '전화를 끄고 쉬었다.'; } } },
    { id: 'snore', icon: 'zzz', tier: [2, 3], title: '옆방 코골이', text: '벽 너머에서 탱크가 지나간다. 오늘 밤도 저럴 것이다.',
      a: { label: '귀마개를 산다', cost: 10000, run: s => { expense(s, '귀마개', sc(s, 10000)); return '세상이 조용해졌다.'; } },
      b: { label: '참는다', run: s => { s.buff.sleepPen = Math.max(s.buff.sleepPen || 0, 1); return '참기로 했다. 오늘 밤은 길겠다.'; } } },
    { id: 'chat', icon: 'chat', tier: [2, 8], title: '유료 리딩방', text: s => '"오늘의 급등주 알려 드립니다. 입장료 ' + won(sc(s, 50000)) + '." 모르는 번호의 초대다.',
      a: { label: '들어간다', cost: 50000, run: s => { expense(s, '리딩방 입장료', sc(s, 50000)); if (rnd3(s) < 0.6) { verifyToday(s); return '방장이 진짜였다. 오늘 소식마다 방장의 짐작이 표시됐다 (' + Math.round(T.chat_acc * 100) + '%쯤 맞음).'; } return '입금하자마자 방이 사라졌다.'; } },
      b: { label: '차단한다', run: s => { gainXp(s, 10); return '차단했다. 현명했다.'; } } },
    { id: 'envelope', icon: 'envelope', tier: [2, 8], title: '청첩장', text: '고등학교 동창의 청첩장이 왔다. 주소는 어떻게 알았을까.',
      a: { label: '축의금을 낸다', cost: 50000, run: s => { expense(s, '축의금', sc(s, 50000)); gainXp(s, 30); heal(s, 10); return won(sc(s, 50000)) + '을 냈다. 뷔페는 맛있었다.'; } },
      b: { label: '모른 척한다', run: s => { hurt(s, 4); return '단체방 알림을 껐다. 조금 찝찝하다.'; } } },
    { id: 'play', icon: 'play', tier: [2, 8], title: '주식 방송', text: '구독자 3만 유튜버가 "한탕바이오, 이건 무조건 갑니다"라고 한다.',
      a: { label: '믿고 산다', cost: 200000, run: s => { if (!buy(s, 'hantang', sc(s, 200000))) return '코인 외길이라 살 수가 없었다. 돈은 그대로다.'; return won(sc(s, 200000)) + '어치 샀다. 이제 기도뿐이다.'; } },
      b: { label: '끈다', run: s => { heal(s, 5); return '귀가 편해졌다.'; } } },
    { id: 'regular', icon: 'eye', tier: [2, 8], title: '단골의 귀띔', text: '단골 가게 사장이 "내일 큰 소식 있다더라"고 속삭인다.',
      a: { label: '믿어 본다', run: s => { if (rnd3(s) < 0.5) { const as = studyAssets(s), a = as[Math.floor(rnd3(s) * as.length)]; readReport(s, a.id); s.market.intel.free = true; return '진짜였다. 내일 ' + a.name + ' 리포트를 공짜로 얻었다.'; } gainXp(s, 5); return '헛소문이었다. 사장은 벌써 셔터를 내렸다.'; } },
      b: { label: '흘려듣는다', run: s => { gainXp(s, 5); return '웃어넘겼다.'; } } },
    { id: 'clinic', icon: 'clinic', tier: [2, 8], title: '건강검진 문자', text: '"올해 검진 대상자입니다." 몇 년째 미뤘다.',
      a: { label: '받는다', cost: 30000, run: s => { expense(s, '검진', sc(s, 30000)); s.hpBonus = (s.hpBonus || 0) + 5; heal(s, 5); return '생각보다 멀쩡했다. 최대 체력 +5.'; } },
      b: { label: '미룬다', run: s => { gainXp(s, 5); return '내년의 나에게 맡겼다.'; } } },
    { id: 'wrench', icon: 'wrench', tier: [3, 3], title: '보일러 고장', text: '보일러가 숨을 거뒀다. 집주인은 전화를 안 받는다.',
      a: { label: '내 돈으로 고친다', cost: 150000, run: s => { expense(s, '보일러 수리', sc(s, 150000)); return won(sc(s, 150000)) + '을 냈다. 방이 다시 따뜻하다.'; } },
      b: { label: '버틴다', run: s => { s.buff.sleepPen = 3; return '패딩을 입고 자기로 했다. 사흘은 춥겠다.'; } } },
    { id: 'ticket', icon: 'ticket', tier: [1, 8], title: '복권 가게', text: '"1등 3번 나온 집." 간판이 유난히 반짝인다.',
      a: { label: '산다', cost: 10000, run: s => { expense(s, '복권', sc(s, 10000)); const r = rnd3(s); if (r < 0.02) { s.stats.lotto = 1; income(s, '복권 당첨', sc(s, 300000)); return '3등. ' + won(sc(s, 300000)) + '이 됐다. 손이 떨린다.'; } if (r < 0.14) { income(s, '복권 당첨', sc(s, 30000)); return won(sc(s, 30000)) + ' 당첨. 본전은 넘겼다.'; } return '꽝. 종이 한 장이 남았다.'; } }, // 기대값은 본전에 조금 못 미친다 (0.02×30 + 0.12×3 − 1 = −0.04만)
      b: { label: '지나친다', run: s => { gainXp(s, 5); return '확률을 아는 사람의 뒷모습이다.'; } } },
    { id: 'umbrella', icon: 'umbrella', tier: [0, 8], title: '소나기', text: '갑자기 비가 쏟아진다. 우산 없는 사람들이 뛴다.',
      a: { label: '우산을 떼다 판다', cost: 20000, run: s => { expense(s, '우산 떼기', sc(s, 20000)); if (rnd3(s) < 0.6) { income(s, '우산 장사', sc(s, 80000)); return '불티나게 팔렸다. ' + won(sc(s, 60000)) + '을 남겼다.'; } return '사자마자 비가 그쳤다. 우산이 잔뜩 남았다.'; } },
      b: { label: '비를 피한다', run: s => { heal(s, 5); return '처마 밑에서 비 구경을 했다.'; } } },
    { id: 'cat', icon: 'cat', tier: [0, 8], title: '길고양이', text: '고양이 한 마리가 다리에 몸을 비빈다. 배가 고픈 눈이다.',
      a: { label: '참치캔을 산다', cost: 3000, run: s => { expense(s, '참치캔', sc(s, 3000)); gainXp(s, 15); heal(s, 3); return '골골거린다. 나도 조금 나아졌다.'; } },
      b: { label: '지나간다', run: s => { gainXp(s, 3); return '고양이가 한심하다는 듯 쳐다봤다.'; } } },
    { id: 'den', icon: 'dice', tier: [2, 8], again: true, when: s => s.day >= T.den_from && !(s.evDay.den && s.day - s.evDay.den < T.den_gap), title: '친구의 전화', text: '"야, 좋은 데 있어. 딱 한 판만 하고 가자." 동창이 도박장에 가자고 한다.',
      a: { label: '간다', run: s => { s.den = { round: 0, max: T.den_rounds, streak: 0, net: 0, last: null }; ev(s, 'den_open', {}); return '골목 끝 지하. 주사위 두 개가 굴러간다. 많아야 ' + T.den_rounds + '판.'; } },
      b: { label: '안 간다', run: s => { gainXp(s, 5); return '"다음에" 하고 끊었다. 통장은 무사하다.'; } } },
    // 내 집부터
    { id: 'leak', icon: 'wrench', tier: [4, 8], title: '윗집 누수', text: '천장에서 물이 똑똑 떨어진다. 이제는 내가 집주인이라 내가 고쳐야 한다.',
      a: { label: '바로 고친다', cost: 150000, run: s => { expense(s, '누수 공사', sc(s, 150000)); return won(sc(s, 150000)) + '을 들여 고쳤다. 집주인은 이런 기분이었구나.'; } },
      b: { label: '양동이를 받친다', run: s => { s.buff.sleepPen = 2; return '똑, 똑. 이틀은 잠이 얕겠다.'; } } },
    { id: 'interview', icon: 'news', tier: [4, 8], title: '경제 잡지 인터뷰', text: '"서울역에서 시작한 사람"을 취재하고 싶다는 연락이 왔다.',
      a: { label: '나간다', run: s => { gainXp(s, 30); hurt(s, 5); return '사진을 백 장 찍었다. 표지에는 한 장도 안 실렸다.'; } },
      b: { label: '사양한다', run: s => { heal(s, 6); return '조용히 일하기로 했다.'; } } },
    { id: 'alumni', icon: 'gift', tier: [4, 8], title: '모교 장학금', text: '모교에서 장학금을 부탁하는 편지가 왔다. 교복 입던 때가 떠오른다.',
      a: { label: '낸다', cost: 200000, run: s => { expense(s, '장학금', sc(s, 200000)); gainXp(s, 40); heal(s, 8); return won(sc(s, 200000)) + '을 보냈다. 감사 편지가 왔다.'; } },
      b: { label: '다음에', run: s => { gainXp(s, 3); return '편지를 서랍에 넣었다.'; } } },
  ];
  function rollEvent(s) {
    if (s.event || s.ended || s.day < T.event_from || rnd3(s) >= T.event_p) return;
    const pool = EVENTS.filter(e => s.tier >= e.tier[0] && s.tier <= e.tier[1] && (e.again || s.evSeen.indexOf(e.id) < 0) && (!e.when || e.when(s))); // again: 다시 올 수 있는 사건
    if (!pool.length) return;
    s.event = pool[Math.floor(rnd3(s) * pool.length)].id;
    ev(s, 'event', { id: s.event });
  }
  function eventView(s) {
    const e = byId(EVENTS, s.event);
    if (!e) return null;
    const c = k => ({ label: e[k].label, cost: sc(s, e[k].cost || 0), ok: s.cash >= sc(s, e[k].cost || 0) });
    return { id: e.id, icon: e.icon, title: e.title, text: typeof e.text === 'function' ? e.text(s) : e.text, a: c('a'), b: c('b') };
  }
  function choose(s, k) {
    const e = byId(EVENTS, s.event);
    if (!e || s.ended || (k !== 'a' && k !== 'b')) return false;
    if (s.cash < sc(s, e[k].cost || 0)) return fail(s, '현금이 모자랍니다');
    s.event = null; if (s.evSeen.indexOf(e.id) < 0) s.evSeen.push(e.id); s.evDay[e.id] = s.day; s.stats.events = (s.stats.events || 0) + 1;
    const was = { cash: s.cash, hp: s.hp, xp: s.stats.xp || 0, hpMax: hpMax(s), pen: s.buff.sleepPen || 0 };
    const text = e[k].run(s);
    const fx = { cash: s.cash - was.cash, hp: Math.round(s.hp - was.hp), xp: (s.stats.xp || 0) - was.xp, hpMax: hpMax(s) - was.hpMax, nights: (s.buff.sleepPen || 0) - was.pen }; // 고른 것이 바꾼 것 (화면이 숫자로 보여 줌)
    ev(s, 'event_done', { id: e.id, icon: e.icon, title: e.title, text, fx });
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
    { id: 'bigwin', name: '익절은 언제나 옳다', hint: '한 번에 500,000원 이상 번다', icon: 'rocket', ok: s => (s.stats.bestGain || 0) >= 500000 },
    { id: 'pump', name: '세력 탑승', hint: '한탕바이오로 이익을 낸다', icon: 'up', ok: s => (s.stats.htGain || 0) > 0 },
    { id: 'liq', name: '수업료', hint: '청산을 당한다', icon: 'skull', ok: s => s.stats.liq >= 1 },
    { id: 'lev3', name: '롱숏 달인', hint: '코인 포지션을 이익으로 3번 정리', icon: 'bolt', ok: s => (s.stats.levWins || 0) >= 3 },
    { id: 'study7', name: '리포트 중독', hint: '공부를 7번 한다', icon: 'book', ok: s => s.studied >= 7 },
    { id: 'rent3', name: '고정비 개근', hint: '고정비를 3번 제때 낸다', icon: 'calendar', ok: s => s.rentPaid >= 3 },
    { id: 'late', name: '다음 주에 드릴게요', hint: '고정비를 한 번 밀린다', icon: 'warn', ok: s => (s.stats.missedTotal || 0) >= 1 },
    { id: 'evicted', name: '방 빼', hint: '쫓겨난다', icon: 'door', ok: s => (s.stats.evicted || 0) >= 1 },
    { id: 'lv5', name: '각성자', hint: '레벨 5', icon: 'star', ok: s => s.lv >= 5 },
    { id: 'lv9', name: '고인물', hint: '레벨 9', icon: 'star', ok: s => s.lv >= 9 },
    { id: 'rich', name: '천만 클럽', hint: '순자산 10,000,000원', icon: 'wallet', ok: s => worth(s) >= 10000000 },
    { id: 'kind', name: '서울역의 양심', hint: '주운 것을 돌려준다', icon: 'purse', ok: s => !!s.stats.kind },
    { id: 'lotto', name: '인생 한 방', hint: '복권에 당첨된다', icon: 'ticket', ok: s => !!s.stats.lotto },
    { id: 'home', name: '내 집 마련', hint: '내 집을 산다', icon: 'key', ok: s => reached(s, OWN) },
    { id: 'den3', name: '홀짝 3연승', hint: '도박장에서 세 번 연속 맞힌다', icon: 'dice', ok: s => (s.stats.denStreak || 0) >= 3 },
    { id: 'denloss', name: '하우스는 언제나 이긴다', get hint() { return '도박장에서 한 번에 ' + won(T.den_bet_4) + ' 이상 잃는다'; }, icon: 'drop', ok: s => (s.stats.denWorst || 0) >= T.den_bet_4 },
    { id: 'rankS', name: '부동산의 신', get hint() { return T.act1_s + '일 안에 내 집을 산다'; }, icon: 'trophy', ok: s => !!(s.act1 && s.act1.day <= T.act1_s) },
    { id: 'apt', name: '영끌', hint: '아파트를 산다', icon: 'house', ok: s => reached(s, 5) },
    { id: 'hotel', name: '맨 위층', hint: '호텔을 산다', icon: 'crown', ok: s => reached(s, 8) },
    { id: 'chaebol', name: '재벌 1세', hint: '사업을 재벌까지 키운다', icon: 'rocket', ok: s => (s.biz || 0) >= 5 },
    { id: 'foreclosed', name: '경매 낙찰(남이)', hint: '집이 압류된다', icon: 'skull', ok: s => (s.stats.foreclosed || 0) >= 1 },
    { id: 'loanfree', name: '빚 없는 삶', hint: '주담대를 다 갚는다', icon: 'key', ok: s => (s.stats.loanDone || 0) >= 1 },
    { id: 'top', name: '한국 최고 부자', hint: '최고 부자를 선언한다', icon: 'trophy', ok: s => !!(s.ended && s.ended.kind === 'top') },
  ];
  function achTick(s) { for (const a of ACH) if (s.ach.indexOf(a.id) < 0 && a.ok(s)) { s.ach.push(a.id); ev(s, 'ach', { id: a.id, name: a.name, icon: a.icon }); } }
  const achList = () => ACH.map(a => ({ id: a.id, name: a.name, hint: a.hint, icon: a.icon }));

  // ── 판 코드 · 결과 카드 ──────────────────────────────────────
  const codeOf = seed => 'SS-' + ((seed >>> 0) % 1679616).toString(36).toUpperCase().padStart(4, '0');
  function seedOf(code) { const m = /^(?:SS-?)?([0-9A-Z]{1,4})$/i.exec(String(code || '').trim()); return m ? parseInt(m[1], 36) || 0 : 0; }
  const dailySeed = (y, mo, d) => ((y * 372 + mo * 31 + d) * 7919) % 1679615 + 1; // 같은 날이면 누구나 같은 판
  function resultCard(s, which) { // which: 'act1'(1막 끝) | 'end'(엔딩). 안 주면 엔딩이 있으면 엔딩, 없으면 1막 끝
    const e = s.ended, a = s.act1, st = s.stats, kind = which || (e ? 'end' : a ? 'act1' : '');
    const tail = ['알바 ' + won(st.alba) + ' · 투자 ' + (st.trade >= 0 ? '+' : '') + won(st.trade) + ' · 청산 ' + st.liq + '번 · Lv.' + s.lv + ' · 업적 ' + s.ach.length + '개', '판 코드 ' + codeOf(s.seed)];
    if (kind === 'act1' && a) return ['[서울역 상태창] 1막 끝 · 내 집 마련 · ' + a.rank + '등급', s.name + ' · ' + a.day + '일째에 ' + won(a.price) + '짜리 내 집 · 순자산 ' + won(a.worth)].concat(tail).join('\n');
    if (kind !== 'end' || !e) return '';
    if (e.kind === 'top') return ['[서울역 상태창] 한국 최고 부자 · ' + e.rank + '등급', s.name + ' · ' + e.day + '일 만에 순자산 ' + won(e.worth) + ' · 사업 ' + BIZ[s.biz || 0].name + ' · 압류 ' + (st.foreclosed || 0) + '번'].concat(tail).join('\n');
    const home = e.kind === 'home'; // 예전 저장의 엔딩
    return ['[서울역 상태창] ' + (home ? '내 집 마련 · ' + e.rank + '등급' : '올해도 무주택 · 집값의 ' + Math.floor(e.pct * 100) + '%'),
      s.name + ' · ' + (home ? e.day + '일째에 ' + won(e.price) + '짜리 집 계약 · 순자산 ' + won(e.worth) : e.day + '일 동안 순자산 ' + won(e.worth))].concat(tail).join('\n');
  }

  // ── 표시용 ──────────────────────────────────────────────────
  function num(n) { // 1,234,000 (원 없이 — 아이콘 옆 좁은 곳). 음수는 − 를 앞에
    n = Math.round(n);
    return (n < 0 ? '−' : '') + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function won(n) { return num(n) + '원'; } // 1,234,000원
  const signPct = v => (v < 0 ? '−' : '+') + Math.round(Math.abs(v) * 100) + '%';
  function save(s) { const c = Object.assign({}, s); c.ev = []; return JSON.stringify(c); }
  function load(json) {
    try {
      const s = JSON.parse(json); if (!s || (s.v !== 1 && s.v !== 2 && s.v !== 3) || !s.market) return null;
      const d = { lv: 1, xp: 0, perks: {}, offer: null, picks: 0, combo: 0, buff: {}, event: null, evSeen: [], evDay: {}, ach: [], hpBonus: 0, gutsUsed: false, den: null }; // 예전 저장에 없던 칸
      for (const k in d) if (s[k] == null && d[k] !== null) s[k] = d[k]; else if (!(k in s)) s[k] = d[k];
      if (s.rng3 == null) s.rng3 = (Math.imul(s.seed | 0, 104729) + 71) | 0;
      if (!s.market.shocks) s.market.shocks = [];
      const m = s.market, ht = m.ht || (m.ht = { phase: 'quiet', left: 4 }); // 공부 · 한탕바이오가 바뀌기 전 저장: 리포트는 새 모양으로, 한탕바이오는 진짜 매집으로 이어 간다
      if (!m.gap) m.gap = {};
      if (ht.phase !== 'quiet' && ht.from == null) { ht.from = m.px.hantang; if (ht.real == null) ht.real = true; if (ht.hint == null) ht.hint = 0; }
      delete ht.soon;
      for (const k of ['intel', 'brief']) { const it = m[k]; if (it && !it.assets) { it.assets = [...new Set((it.items || []).map(i => i.asset))]; it.ht = null; } }
      s.ev = [];
      if (s.v === 1) { // v1: 보증금이 있던 때. 보증금은 없어졌으니 현금으로 돌려준다 (순자산은 그대로)
        const dep = s.deposit || 0; s.deposit = 0; s.v = 2;
        if (dep) { s.cash += dep; sys(s, '보증금 제도가 없어져 ' + won(dep) + '을 현금으로 돌려받았습니다.', 'good'); }
      }
      if (s.v === 2) { // v2: 28일 기한 · 집 = 엔딩이던 때. 기한이 없어졌으니 그대로 이어 간다 (끝난 판은 끝난 그대로)
        s.v = 3; s.biz = 0; s.loan = null; s.homeVal = 0; s.act1 = null;
        for (const k of ['foreclosed', 'loanPaid', 'loanDone', 'bizSpent']) if (s.stats[k] == null) s.stats[k] = 0;
      }
      return s;
    } catch (e) { return null; }
  }

  // ── 한눈에 보기 (화면용) ─────────────────────────────────────
  function week(s) { // 날짜를 "N주차 M일"로, 그 주 일요일의 고정비
    const b = bill(s);
    return { week: weekOf(s.day), dow: (s.day - 1) % 7 + 1, day: s.day, billDay: !!b, bill: b }; // 기한이 없어 left 는 없앴다 ("N일째"만)
  }
  function notices(s) { // 고정비(+ 원리금)를 전날과 당일에만 알림
    const out = [], b = bill(s);
    if (b && b.inDays <= 1) out.push({ kind: 'bill', when: b.inDays ? 'tomorrow' : 'today', amt: b.amt, text: (b.inDays ? '내일' : '오늘') + ' 밤 ' + (b.loan ? '고정비 · 원리금 ' : '고정비 ') + won(b.amt) + (b.days < 7 ? ' (' + b.days + '일치)' : '') }); // 이사한 주는 산 날만큼
    return out;
  }
  function holdings(s) { // 내가 든 것 전부 (주식 3종은 안 가져도 줄이 있음)
    const rows = ASSETS.filter(a => a.kind === 'stock').map(a => {
      const h = s.hold[a.id], value = Math.round(holdValue(s, a.id)), cost = Math.round(h.cost), pnl = value - cost;
      return { id: a.id, name: a.name, tag: a.tag, units: h.units, value, cost, pnl, pct: cost ? pnl / cost : 0 };
    });
    const l = s.lev, lv = l ? Math.round(levValue(s)) : 0;
    const lev = l ? { dir: l.dir, lev: l.lev, put: l.put, value: lv, pnl: lv - l.put, pct: (lv - l.put) / l.put } : null;
    const value = rows.reduce((a, r) => a + r.value, 0) + (lev ? lev.value : 0), cost = rows.reduce((a, r) => a + r.cost, 0) + (lev ? lev.put : 0);
    return { rows, lev, total: { value, cost, pnl: value - cost, pct: cost ? (value - cost) / cost : 0 } };
  }

  // ── 도박장: 주사위 둘 홀짝. 굴림은 rnd3 (시세와 무관) ───────────
  const denBets = s => [T.den_bet_1, T.den_bet_2, T.den_bet_3, T.den_bet_4].map(x => (s ? sc(s, x) : x)); // 판돈도 사는 곳에 따라 커진다
  function denView(s) {
    const d = s.den;
    if (!d) return null;
    const open = d.round < d.max, last = d.last;
    const canDouble = !!(open && last && last.win && s.cash >= last.pay);
    return { round: d.round, max: d.max, streak: d.streak, net: d.net, bets: denBets(s).map(amt => ({ amt, ok: open && s.cash >= amt })), last: last ? Object.assign({}, last, { dice: last.dice.slice() }) : null, canDouble, doubleAmt: last && last.win ? last.pay : 0 };
  }
  function denBet(s, amt, pickS) { // pickS: 'odd' | 'even'. 맞히면 판돈 × den_pay 를 돌려받음
    const d = s.den;
    if (!d || s.ended) return fail(s, '도박장에 있지 않습니다');
    if (pickS !== 'odd' && pickS !== 'even') return fail(s, '홀 또는 짝을 고르세요');
    const v = denView(s); amt = Number(amt);
    if (!(denBets(s).indexOf(amt) >= 0 || (v.canDouble && amt === v.doubleAmt))) return fail(s, '그 판돈은 걸 수 없습니다');
    if (amt > s.cash) return fail(s, '현금이 모자랍니다');
    const dice = [1 + Math.floor(rnd3(s) * 6), 1 + Math.floor(rnd3(s) * 6)], win = ((dice[0] + dice[1]) % 2 === 1) === (pickS === 'odd'), pay = win ? Math.round(amt * T.den_pay) : 0;
    if (win) income(s, '도박장', pay - amt); else expense(s, '도박장', amt);
    d.round++; d.streak = win ? d.streak + 1 : 0; d.net += pay - amt; d.last = { dice, pick: pickS, win, bet: amt, pay };
    s.stats.denNet = (s.stats.denNet || 0) + pay - amt; s.stats.denStreak = Math.max(s.stats.denStreak || 0, d.streak); if (!win) s.stats.denWorst = Math.max(s.stats.denWorst || 0, amt);
    ev(s, 'den_roll', { dice: dice.slice(), pick: pickS, win, bet: amt, pay, streak: d.streak });
    if (d.round >= d.max) closeDen(s);
    after(s);
    return true;
  }
  function closeDen(s) { const d = s.den; s.den = null; ev(s, 'den_done', { net: d.net, rounds: d.round }); sys(s, '도박장에서 나왔습니다. ' + d.round + '판, ' + (d.net >= 0 ? '+' : '') + won(d.net) + '.', d.net >= 0 ? 'good' : 'bad'); }
  function denLeave(s) { if (!s.den) return false; closeDen(s); after(s); return true; }

  return {
    setTune, HOMES, ASSETS, create, acts, canAct, doJob, doRest, doStudy, endDay, nextDay,
    buy, sell, levOpen, levClose, levValue, levLiq, move, moveInfo, buyHouse, worth, invested, holdValue, housePrice, weekOf, bill, riseIn,
    homePrice, homeInfo, buyHome, repay, loanView, bizView, bizUp, BIZ, scale, goalView, declareTop,
    skill, skipMult, unlocked, todayNews, intelView, questView, rnd2, won, num, save, load, weekCost, week, notices, holdings, denView, denBet, denLeave, SHOCKS,
    hpMax, mealCost, saunaCost, sleepGain, studyAcc, perk, pickPerk, offerView, perksView, xpView, PERKS,
    eventView, choose, EVENTS, achList, codeOf, seedOf, dailySeed, resultCard, htText, accText,
    htAlert: s => !!(s.market && s.market.htAlert === s.day), // 오늘 한탕바이오 거래량 알림이 떴나
  };
});
