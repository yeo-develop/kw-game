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
      v: 1, seed: seed | 0, rng: seed | 0, rng2: (Math.imul(seed | 0, 7919) + 13) | 0, name: (name || '').trim() || '나',
      day: 1, slot: 0, phase: 'day', cash: 0, hp: T.start_hp, tier: 0, deposit: 0, arrears: 0, missed: 0, movedDay: 0, rentPaid: 0,
      jobs: { flyer: 0, loading: 0, store: 0, delivery: 0 }, studied: 0,
      market: { tick: 0, px: {}, hist: {}, chg: {}, news: [], nid: 0, ht: { phase: 'quiet', left: 4 }, intel: null, brief: null }, // intel = 오늘 공부해서 안 내일 것 · brief = 어제 공부해서 아는 오늘 것
      hold: {}, lev: null, quest: 0, title: TITLES[0][1],
      today: null, last: null,
      stats: { alba: 0, jobsDone: 0, bought: 0, trade: 0, gain: 0, htGain: 0, levGain: 0, levOpens: 0, fees: 0, fixed: 0, liq: 0, perfect: 0, quests: 0, maxTier: 0, evicted: 0 },
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
  function housePrice(s, day) { return Math.round(T.house_price * Math.pow(1 + T.house_growth, weekOf(day || s.day) - 1) / 10000) * 10000; }
  function holdValue(s, id) { return s.hold[id].units * s.market.px[id]; }
  function levValue(s) { const l = s.lev; if (!l) return 0; return Math.max(0, l.margin * (1 + l.dir * l.lev * (s.market.px.coin / l.entry - 1))); }
  function levLiq(l) { return l.entry * (1 - l.dir / l.lev); }
  function invested(s) { let v = levValue(s); for (const a of ASSETS) if (a.kind === 'stock') v += holdValue(s, a.id); return v; }
  function worth(s) { return Math.round(s.cash + s.deposit + invested(s) - s.arrears); }
  function weekCost(s, tier) { tier = tier == null ? s.tier : tier; return tier === 2 ? T.gosiwon_week : tier === 3 ? T.oneroom_week : 0; }
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
      out.push({ kind: 'job', id: j.id, name: j.name, note: j.note, pay: round1k(T['pay_' + j.id] * (1 + T.skill_bonus * lv)), hp, lv, toNext: skillNext(s, j.id), ok: s.hp >= hp, why: s.hp >= hp ? '' : '체력이 모자랍니다' });
    }
    out.push({ kind: 'rest', id: 'rest', name: '쉬기', hp: -(s.tier === 0 ? T.rest_hp_station : T.rest_hp), ok: true, why: '', note: s.tier === 0 ? '벤치에서는 덜 풀린다' : '' });
    if (unlocked(s, 'study')) { const read = !!(s.market.intel && s.market.intel.madeOn === s.day); out.push({ kind: 'study', id: 'study', name: '공부', hp: 0, ok: !read, why: read ? '오늘 리포트는 이미 읽었습니다' : '', note: '내일 나올 소식을 미리 안다' }); }
    return out;
  }

  // ── 칸 행동 ─────────────────────────────────────────────────
  function canAct(s) { return !s.ended && s.phase === 'day' && s.slot < 3; }
  function doJob(s, id, score) { // score: 0~1, null 이면 "대충 하기"
    const a = acts(s).find(x => x.id === id);
    if (!canAct(s) || !a || !a.ok) return false;
    const g = score == null ? 'skip' : grade(score);
    const pay = round1k(a.pay * T['mult_' + g]);
    const before = skill(s, id);
    s.hp -= a.hp; s.stats.jobsDone = (s.stats.jobsDone || 0) + 1; s.stats.alba += pay; if (g === 'perfect') s.stats.perfect++;
    if (score != null) s.jobs[id]++; // 대충 하면 숙련도는 오르지 않는다
    ev(s, 'job', { id, name: a.name, pay, grade: g, gradeName: GRADE[g], mult: T['mult_' + g], hp: a.hp });
    income(s, a.name + ' 알바', pay);
    if (skill(s, id) > before) sys(s, a.name + ' 숙련도가 올랐습니다. 일당 +' + Math.round(T.skill_bonus * 100) + '%.', 'good');
    endSlot(s);
    return true;
  }
  function doRest(s) {
    if (!canAct(s)) return false;
    const gain = s.tier === 0 ? T.rest_hp_station : T.rest_hp, before = s.hp;
    s.hp = Math.min(100, s.hp + gain);
    ev(s, 'rest', { hp: s.hp - before });
    endSlot(s);
    return true;
  }
  function doStudy(s) {
    if (!canAct(s) || !unlocked(s, 'study') || (s.market.intel && s.market.intel.madeOn === s.day)) return false;
    const day = s.day + 1;
    const items = s.market.news.filter(n => n.day === day).map(n => {
      const eff = n.truth ? n.dir : -n.dir;
      return { nid: n.id, asset: n.asset, dir: rnd(s) < T.study_acc ? eff : -eff };
    });
    const ht = s.market.ht;
    s.market.intel = { day, madeOn: s.day, items, ht: { phase: ht.phase, soon: ht.left <= 2 } }; // 한탕바이오는 "가깝다/멀다"까지만
    s.studied++;
    ev(s, 'study', { count: items.length });
    sys(s, items.length ? '리포트 입수. 내일 소식 ' + items.length + '건의 진짜 방향을 표시했습니다(' + Math.round(T.study_acc * 100) + '% 맞음). 시세는 소식 말고도 출렁입니다.' : '리포트 입수. 내일은 조용합니다. 조용한 것도 정보입니다.');
    endSlot(s);
    return true;
  }
  function endSlot(s) {
    tick(s, false);
    s.slot++;
    after(s);
  }
  function after(s) { titleTick(s); questTick(s); }

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
        const l = s.lev; s.lev = null; s.stats.liq++; s.stats.trade -= l.put;
        ev(s, 'liq', { lost: l.put, dir: l.dir, lev: l.lev });
        sys(s, '청산되었습니다. 증거금 ' + won(l.put) + '이 사라졌습니다. 레버리지 ' + l.lev + '배는 ' + Math.round(100 / l.lev) + '% 역방향이면 끝입니다.', 'bad');
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
    const fee = Math.round(amt * T.fee), h = s.hold[id];
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
    const gross = h.units * frac * s.market.px[id], fee = Math.round(gross * T.fee), net = Math.round(gross - fee), cost = h.cost * frac, pnl = Math.round(net - cost);
    h.units -= h.units * frac; h.cost -= cost; if (h.units < 1e-9) { h.units = 0; h.cost = 0; }
    s.cash += net; s.stats.fees += fee; s.stats.trade += pnl; if (pnl > 0) { s.stats.gain += pnl; if (id === 'hantang') s.stats.htGain = (s.stats.htGain || 0) + pnl; }
    ev(s, 'trade', { side: 'sell', id, name: a.name, amt: net, pnl });
    after(s);
    return true;
  }
  function levOpen(s, dir, margin, lev) {
    if (!canFree(s) || !unlocked(s, 'coin')) return fail(s, '원룸부터 할 수 있습니다');
    if (s.lev) return fail(s, '이미 포지션이 있습니다. 먼저 정리하세요');
    margin = Math.floor(Math.min(Number(margin), s.cash)); lev = clamp(Math.round(Number(lev)) || 1, 1, 5);
    if (!Number.isFinite(margin) || margin < 100000) return fail(s, '증거금이 모자랍니다 (최소 10만 원)');
    const fee = Math.round(margin * lev * T.lev_fee);
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
    s.cash += v; s.lev = null; s.stats.trade += pnl; if (pnl > 0) { s.stats.gain += pnl; s.stats.levGain += pnl; }
    ev(s, 'lev', { side: 'close', pnl, value: v });
    after(s);
    return true;
  }

  // ── 주거 ────────────────────────────────────────────────────
  function moveInfo(s, to) { // 옮길 수 있는지와 드는 돈
    if (to !== s.tier + 1 || to > 3) return { ok: false, why: '' };
    if (to === 1) return { ok: s.cash >= T.sauna_night, need: T.sauna_night, pay: 0, why: s.cash >= T.sauna_night ? '' : '하룻밤 요금 ' + won(T.sauna_night) + '이 있어야 합니다' };
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
    sys(s, to === 1 ? '찜질방 입장. 인류는 지붕을 발명했습니다. 하룻밤 ' + won(T.sauna_night) + '씩 나갑니다.'
      : to === 2 ? '고시원 입주. 주소가 생겼습니다. 주식 계좌가 열렸고, 매주 일요일 밤 고정비 ' + won(T.gosiwon_week) + '이 나갑니다(끼니 포함).'
        : '원룸 입주. 코인과 레버리지가 열렸습니다. 고정비는 주 ' + won(T.oneroom_week) + '. 숨만 쉬어도 나갑니다.', 'good');
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
        s.missed++; s.arrears = owed;
        billed = { paid: false, amt: b.amt, days: b.days, arrears: owed, evicted: s.missed >= 2 };
        if (s.missed >= 2) evict(s, notes);
        else notes.push({ tone: 'bad', text: '고정비 ' + won(b.amt) + '을 못 냈습니다. 연체료가 붙어 빚 ' + won(owed) + '이 되었고 다음 일요일에 함께 내야 합니다. 한 번 더 밀리면 쫓겨납니다.' });
      }
    }
    if (s.tier === 1) {
      if (s.cash >= T.sauna_night) expense(s, '찜질방', T.sauna_night);
      else { s.tier = 0; notes.push({ tone: 'bad', text: '찜질방 요금이 없어 서울역에서 잤습니다.' }); ev(s, 'tier', { from: 1, to: 0, name: HOMES[0].name, up: false }); }
    }
    if (s.tier < 2) {
      if (s.cash >= T.meal_cost) expense(s, '끼니', T.meal_cost);
      else { s.hp = Math.max(0, s.hp - T.meal_skip_hp); notes.push({ tone: 'bad', text: '끼니를 걸렀습니다. 체력 −' + T.meal_skip_hp }); }
    }
    const sleep = T[HOMES[s.tier].sleep], hpMid = s.hp;
    s.hp = Math.min(100, s.hp + sleep);
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
    s.movedDay = s.day + 1; s.stats.evicted = (s.stats.evicted || 0) + 1;
    notes.push({ tone: 'bad', text: '고정비를 두 번 연속 못 내 ' + HOMES[from].name + '에서 쫓겨났습니다. 보증금에서 빚 ' + won(paid) + '을 제하고 ' + HOMES[s.tier].name + '으로 내려갑니다. 여기서 못 쓰는 계좌는 정리되었습니다.' + (left > 0 ? ' 못 갚은 ' + won(left) + '은 탕감되었습니다.' : '') });
    ev(s, 'tier', { from, to: s.tier, name: HOMES[s.tier].name, up: false });
  }
  function nextDay(s) {
    if (s.ended || s.phase !== 'night') return false;
    if (s.day >= T.days) {
      const w = worth(s), price = housePrice(s);
      s.ended = { kind: 'fail', day: s.day, worth: w, price, pct: w / price };
      ev(s, 'ending', { kind: 'fail' });
      return true;
    }
    const before = housePrice(s);
    s.day++; s.slot = 0; s.phase = 'day';
    s.market.news = s.market.news.filter(n => n.day >= s.day);
    s.market.brief = s.market.intel && s.market.intel.day === s.day ? s.market.intel : null; s.market.intel = null; // 어제 읽은 리포트는 오늘 소식 옆에 붙는다
    genNews(s, s.day + 1);
    beginDay(s);
    ev(s, 'day', { day: s.day });
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
  const QUESTS = [
    { id: 'first_job', title: '첫 끼니를 벌어라', desc: '알바를 한 번 해낸다. 전단지가 가볍다.', cur: s => Math.min(1, totalJobs(s)), goal: () => 1, unit: '회',
      reward: s => { s.hp = Math.min(100, s.hp + 10); }, rtext: '삼각김밥 (체력 +10)' },
    { id: 'survive', title: '오늘을 버텨라', desc: '세 칸을 다 쓰고 "하루 마치기"로 밤을 넘긴다.', cur: s => (s.day > 1 ? 1 : 0), goal: () => 1, unit: '일',
      reward: s => income(s, '퀘스트 보상', T.q_survive_cash), rtext: () => won(T.q_survive_cash) },
    { id: 'roof', title: '지붕 아래에서 자라', desc: '찜질방으로 옮긴다. 자고 나면 체력이 두 배로 돌아온다.', cur: s => (s.tier >= 1 ? 1 : 0), goal: () => 1, unit: '', go: 'ladder',
      reward: s => { s.hp = Math.min(100, s.hp + 10); }, rtext: '씻었다 (체력 +10) · 편의점 알바 열림' },
    { id: 'address', title: '주소를 만들어라', desc: '보증금을 모아 고시원에 입주한다. 주소가 있어야 계좌를 연다.', cur: s => (s.tier >= 2 ? T.gosiwon_deposit : Math.min(s.cash, T.gosiwon_deposit)), goal: () => T.gosiwon_deposit, unit: '원', go: 'ladder',
      done: s => s.tier >= 2, reward: () => { }, rtext: '주식 계좌 · 배달 알바 · 공부 열림' },
    { id: 'first_stock', title: '첫 주식을 사라', desc: '아무 주식이나 10만 원어치 이상 산다. 대장전자가 얌전하다.', cur: s => Math.min(s.stats.bought, 100000), goal: () => 100000, unit: '원', go: 'stock',
      skip: s => s.tier >= 3, reward: s => income(s, '퀘스트 보상', T.q_stock_cash), rtext: () => won(T.q_stock_cash) },
    { id: 'study', title: '내일을 미리 읽어라', desc: '한 칸을 "공부"에 쓴다. 내일 나올 소식의 진짜 방향이 리포트로 보인다.', cur: s => Math.min(1, s.studied), goal: () => 1, unit: '회',
      skip: s => s.tier >= 3, reward: s => income(s, '퀘스트 보상', T.q_study_cash), rtext: () => won(T.q_study_cash) + ' (알바 한 칸 값)' },
    { id: 'gain', title: '수익을 실현하라', desc: '오른 주식을 팔아 이익 5만 원 이상을 확정한다. 팔기 전까지는 내 돈이 아니다.', cur: s => Math.min(s.stats.gain, 50000), goal: () => 50000, unit: '원', go: 'stock',
      skip: s => s.tier >= 3, reward: s => income(s, '퀘스트 보상', T.q_gain_cash), rtext: () => won(T.q_gain_cash) },
    { id: 'pump', title: '세력에 올라타라', desc: '한탕바이오는 누가 사 모으면 천천히 오르다 급등하고, 곧 폭락한다. 폭락 전에 팔아 이익 10만 원 이상.', cur: s => Math.min(s.stats.htGain || 0, 100000), goal: () => 100000, unit: '원', go: 'stock',
      skip: s => s.tier >= 3, reward: s => income(s, '퀘스트 보상', T.q_pump_cash), rtext: () => won(T.q_pump_cash) },
    { id: 'worth', title: '순자산 300만', desc: '현금 + 보증금 + 투자한 돈을 합쳐 300만 원.', cur: s => Math.min(worth(s), 3000000), goal: () => 3000000, unit: '원',
      reward: s => income(s, '퀘스트 보상', T.q_worth_cash), rtext: () => won(T.q_worth_cash) },
    { id: 'oneroom', title: '원룸으로 올라가라', desc: '보증금 500만 원으로 원룸에 입주한다. 고시원 보증금은 돌려받아 보탠다.', cur: s => (s.tier >= 3 ? T.oneroom_deposit : Math.min(s.cash + s.deposit, T.oneroom_deposit)), goal: () => T.oneroom_deposit, unit: '원', go: 'ladder',
      done: s => s.tier >= 3, reward: () => { }, rtext: '코인 · 레버리지 열림' },
    { id: 'lev', title: '레버리지를 다뤄라', desc: '코인 포지션을 이익 5만 원 이상으로 정리한다. 작게 걸어 본다. 방향을 틀리면 증거금이 통째로 사라진다.', cur: s => Math.min(s.stats.levGain, 50000), goal: () => 50000, unit: '원', go: 'coin',
      skip: s => worth(s) >= housePrice(s) * 0.6 || s.day >= 22, reward: s => income(s, '퀘스트 보상', T.q_lev_cash), rtext: () => won(T.q_lev_cash) },
    { id: 'house', title: '집을 사라', desc: '순자산이 집값을 넘으면 사다리에서 "집 계약"을 누른다. 집값은 매주 오른다.', cur: s => Math.min(worth(s), housePrice(s)), goal: s => housePrice(s), unit: '원', go: 'ladder',
      done: s => !!(s.ended && s.ended.kind === 'home'), reward: () => { }, rtext: '내 집' },
  ];
  function questDone(s, q) { return q.done ? q.done(s) : q.cur(s) >= q.goal(s); }
  function questView(s) {
    const q = QUESTS[s.quest];
    if (!q) return null;
    const cur = q.cur(s), goal = q.goal(s);
    return { id: q.id, n: s.quest + 1, of: QUESTS.length, title: q.title, desc: q.desc, cur, goal, unit: q.unit, pct: goal ? clamp(cur / goal, 0, 1) : 0, near: goal > 1 && cur / goal >= 0.8 && cur < goal, reward: typeof q.rtext === 'function' ? q.rtext() : q.rtext, go: q.go || '' };
  }
  function questTick(s) {
    let guard = 0;
    while (s.quest < QUESTS.length && !s.ended && guard++ < 20) {
      const q = QUESTS[s.quest], view = questView(s);
      if (questDone(s, q)) { s.quest++; s.stats.quests++; ev(s, 'quest_done', { quest: view }); q.reward(s); }
      else if (q.skip && q.skip(s)) { s.quest++; ev(s, 'quest_skip', { quest: view }); } // 때가 지난 퀘스트는 보상 없이 넘김
      else break;
      if (s.quest < QUESTS.length) ev(s, 'quest_new', { quest: questView(s) });
    }
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
  function load(json) { try { const s = JSON.parse(json); if (!s || s.v !== 1 || !s.market) return null; s.ev = []; return s; } catch (e) { return null; } }

  return {
    setTune, HOMES, JOBS, ASSETS, SRC, QUESTS, GRADE, create, acts, canAct, doJob, doRest, doStudy, endDay, nextDay,
    buy, sell, levOpen, levClose, levValue, levLiq, move, moveInfo, buyHouse, worth, invested, holdValue, housePrice, weekOf, bill, riseIn,
    skill, grade, unlocked, todayNews, intelView, questView, rnd2, won, save, load, weekCost,
  };
});
