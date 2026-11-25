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
    { id: 'station', name: '서울역', kind: 'rent', lease: [], sleep: 'sleep_station', blurb: '벤치. 자도 체력이 조금만 돌아온다.', unlock: '전단지 · 상하차', price: 0 },
    { id: 'sauna', name: '찜질방', kind: 'rent', lease: [], sleep: 'sleep_sauna', blurb: '씻고 잔다. 하룻밤씩 낸다.', unlock: '편의점 알바 · 주식 계좌 · 공부', price: 0 },
    { id: 'gosiwon', name: '고시원', kind: 'rent', lease: ['rent'], sleep: 'sleep_gosiwon', week: 'gosiwon_week', blurb: '주소가 생긴다. 예치금을 걸고 매주 고정비.', unlock: '배달 알바 · 은행 · 종목 셋 더', price: 0 },
    { id: 'oneroom', name: '원룸', kind: 'rent', lease: ['rent', 'jeonse'], sleep: 'sleep_oneroom', week: 'oneroom_week', blurb: '발 뻗고 잔다. 월세는 무겁고 전세는 목돈이 든다.', unlock: '카페 알바 · 코인 · 부동산 · 황금ETF', price: 0 },
    { id: 'home', name: '내 집', kind: 'own', lease: ['own'], sleep: 'sleep_home', week: 'week_home', blurb: '현금으로만 산다. 월세는 없고 관리비 · 세금만.', unlock: '과외 · 가게 · 종목 셋 더', get price() { return tp('price_home'); } },
    { id: 'apt', name: '아파트', kind: 'own', lease: ['jeonse', 'own'], sleep: 'sleep_apt', week: 'week_apt', blurb: '전세로 들어가거나 주담대를 끼고 산다.', unlock: '대리 · 주담대 · 법인 · 종목 둘 더', get price() { return tp('price_apt'); } },
    { id: 'house', name: '주택', kind: 'own', lease: ['jeonse', 'own'], sleep: 'sleep_house', week: 'week_house', blurb: '마당이 있다. 고정비도 마당만큼.', unlock: '강연 · 그룹 · 거꾸로ETF', get price() { return tp('price_house'); } },
    { id: 'villa', name: '별장', kind: 'own', lease: ['own'], sleep: 'sleep_villa', week: 'week_villa', blurb: '집이 두 채. 숨만 쉬어도 나가는 돈도 두 배.', unlock: '방송 · 대기업', get price() { return tp('price_villa'); } },
    { id: 'hotel', name: '호텔', kind: 'own', lease: ['own'], sleep: 'sleep_hotel', week: 'week_hotel', blurb: '방이 수백 개. 내 방은 맨 위층.', unlock: '자문 · 재벌', get price() { return tp('price_hotel'); } },
    { id: 'top', name: '한국 최고 부자', kind: 'top', lease: [], blurb: '끝.', unlock: '엔딩', get price() { return tp('top_worth'); } },
  ];
  const OWN = 4, TOP = 9; // 내 집부터 산다 · 끝
  const LEASE = { rent: '월세', jeonse: '전세', own: '매매' }; // 계약: 고시원 = 월세 · 원룸 = 월세/전세 · 내 집 = 매매 · 아파트 · 주택 = 전세/매매 · 별장 · 호텔 = 매매
  // 사업: 알바가 커진다 (같은 미니게임, 일당 × biz_mult^단계). 단계 n 은 사는 곳 tier 3 + n 부터
  const BIZ = [
    { lv: 0, name: '알바' }, { lv: 1, name: '가게' }, { lv: 2, name: '법인' }, { lv: 3, name: '그룹' }, { lv: 4, name: '대기업' }, { lv: 5, name: '재벌' },
  ];
  // 알바 열 가지: tier = 그 일이 열리는 사는 곳 (집을 한 단계 올릴 때마다 하나씩 — 2026-11-21 "집 업그레이드 될수록 일할수있는 종목 늘려").
  // out = 밖에서 하는 일(날씨를 탄다) · shop = 가게에서 하는 일(정전이면 닫는다) · slots = 할 수 있는 칸(없으면 아무 때나)
  const JOBS = [
    { id: 'flyer', name: '전단지', tier: 0, note: '가볍다', out: true },
    { id: 'loading', name: '상하차', tier: 0, note: '많이 주지만 힘들다' },
    { id: 'store', name: '편의점', tier: 1, note: '덜 힘들다', shop: true },
    { id: 'delivery', name: '배달', tier: 2, note: '많이 주고 힘들다 · 폭우엔 할증', out: true },
    { id: 'cafe', name: '카페', tier: 3, note: '가볍다 · 오전이면 더 준다', shop: true },
    { id: 'tutor', name: '과외', tier: 4, note: '투자 공부 단계만큼 더 받는다' },
    { id: 'driver', name: '대리', tier: 5, note: '저녁에만 · 많이 준다', out: true, slots: [2] },
    { id: 'lecture', name: '강연', tier: 6, note: '정장을 입으면 더 받는다' },
    { id: 'tv', name: '방송', tier: 7, note: '잘하면 내일 사업 매출이 는다' },
    { id: 'advise', name: '자문', tier: 8, note: '신용등급이 좋을수록 더 받는다' },
  ];
  // tier = 그 종목이 보이기 시작하는 사는 곳 (찜질방 셋 → 고시원 둘 더 → 원룸 둘 더 + 코인). 가진 것은 내려가도 계속 보인다
  const ASSETS = [
    { id: 'daejang', name: '대장전자', tag: '우량주', kind: 'stock', tier: 1, px: 52000, hint: '느리지만 꾸준히 오르는 편' },
    { id: 'bank', name: '튼튼은행', tag: '배당주', kind: 'stock', tier: 1, px: 41200, hint: '거의 안 움직인다. 일요일 밤마다 배당' },
    { id: 'buldak', name: '화끈식품', tag: '테마주', kind: 'stock', tier: 1, px: 18400, hint: '소식에 크게 움직인다' },
    { id: 'battery', name: '번쩍배터리', tag: '성장주', kind: 'stock', tier: 2, px: 87500, hint: '크게 오르내리지만 길게 보면 오르는 편' },
    { id: 'hantang', name: '한탕바이오', tag: '작전주', kind: 'stock', tier: 2, px: 3150, hint: '누가 사 모으면 튀거나, 털고 끝난다' },
    { id: 'game', name: '꿀잼게임즈', tag: '신작주', kind: 'stock', tier: 3, px: 26300, hint: '신작이 흥행하면 급등, 아니면 급락' },
    { id: 'build', name: '뚝딱건설', tag: '건설주', kind: 'stock', tier: 3, px: 9840, hint: '부동산 시세를 따라 움직인다' },
    { id: 'coin', name: '달나라코인', tag: '코인', kind: 'coin', tier: 3, px: 1270, hint: '하루에도 크게 출렁인다' },
    // 2026-11-21 "투자종목 늘려". der = 다른 종목에서 값이 나오는 것(ETF) · quiet = 소식이 없는 것(공부할 것이 없다)
    { id: 'etf', name: '다담아ETF', tag: '지수', kind: 'stock', tier: 2, px: 10000, hint: '작전주만 빼고 고루 담았다. 평균만큼 움직인다', der: true, quiet: true },
    { id: 'gold', name: '황금ETF', tag: '안전자산', kind: 'stock', tier: 3, px: 12500, hint: '평소엔 잠잠하다. 세상이 흉흉하면 오른다', quiet: true },
    { id: 'insure', name: '든든보험', tag: '보험주', kind: 'stock', tier: 4, px: 33400, hint: '꾸준히 오르지만 재난이 나면 크게 내린다' },
    { id: 'air', name: '날개항공', tag: '항공주', kind: 'stock', tier: 4, px: 21700, hint: '날씨 · 유가 · 연휴에 크게 움직인다' },
    { id: 'energy', name: '훈훈에너지', tag: '에너지주', kind: 'stock', tier: 5, px: 46800, hint: '한파 · 폭염이 오거나 유가가 뛰면 오른다' },
    { id: 'defense', name: '방패방산', tag: '방산주', kind: 'stock', tier: 5, px: 68200, hint: '평소엔 조용하다. 긴장이 높아지면 뛴다' },
    { id: 'inv', name: '거꾸로ETF', tag: '인버스', kind: 'stock', tier: 6, px: 8000, hint: '시장이 내리면 오른다. 길게 들면 조금씩 깎인다', der: true, quiet: true },
    { id: 'doge', name: '멍멍코인', tag: '밈코인', kind: 'coin', tier: 4, px: 860, hint: '달나라코인보다 더 크게 출렁인다. 배율은 3배까지', maxLev: 3 }, // maxLev: 한 칸의 출렁임(8.5%)이 5배의 청산 거리(20%)에 비해 너무 커서, 5배로는 청산 값을 뚫고 지나간 손실이 공짜가 된다(어느 쪽으로 걸어도 하루 +2~3% — 2026-11-21 독립 검토 뒤에 잼)
  ];
  const SHARES = ASSETS.filter(a => a.kind === 'stock' && !a.der && a.id !== 'gold').map(a => a.id); // 주식 전부 (ETF · 금 빼고) — 세상 사건의 "증시 전체"가 움직이는 것
  const BASKET = SHARES.filter(id => id !== 'hantang'); // 다담아ETF 가 담은 것: 작전주(한탕바이오)는 뺀다 — 늘 무너지는 한 종목이 바구니를 끌어내려 "평균만큼"이 아니게 되고, 거꾸로ETF 가 들고만 있어도 남는 것이 된다 (2026-11-21 독립 검토)
  const FLOOR = 10, MERGE_AT = 20, MERGE = 100; // 값의 바닥 · 코인은 바닥 가까이 가면 100:1 로 합쳐 표기만 올린다(바닥에서는 더 못 내려가 롱이 공짜가 되는 것을 막는다)
  const SRC = { official: { name: '공시', note: '거의 확실', rel: 'rel_official' }, article: { name: '기사', note: '대체로 맞음', rel: 'rel_article' }, rumor: { name: '찌라시', note: '반반', rel: 'rel_rumor' } };
  const HEAD = {
    buldak: { 1: ['화끈식품, 해외 수출 계약 체결', '화끈식품 신제품 품절 대란', '화끈식품 분기 실적 예상 웃돌아'], '-1': ['화끈식품 제품 회수 조치', '화끈식품 원재료 값 급등', '화끈식품 대주주 지분 매각설'] },
    daejang: { 1: ['대장전자, 대형 공급 계약', '대장전자 배당 확대 발표'], '-1': ['대장전자 공장 가동 차질', '대장전자 실적 전망 낮춰'] },
    coin: { 1: ['달나라코인, 대형 거래소 상장설', '유명인이 달나라코인을 언급'], '-1': ['달나라코인 해킹 의혹', '당국, 코인 단속 예고'] },
    battery: { 1: ['번쩍배터리, 완성차 납품 계약', '번쩍배터리 새 공장 가동', '번쩍배터리 주행거리 신기록 발표'], '-1': ['번쩍배터리 납품 지연', '번쩍배터리 원료 값 급등', '번쩍배터리 증자 검토설'] },
    bank: { 1: ['튼튼은행 분기 이익 늘어', '튼튼은행 배당 유지 발표'], '-1': ['튼튼은행 연체율 소폭 상승', '튼튼은행 금리 인하 압박'] },
    build: { 1: ['뚝딱건설, 재개발 시공사 선정', '뚝딱건설 분양 완판'], '-1': ['뚝딱건설 미분양 늘어', '뚝딱건설 공사비 갈등'] },
    air: { 1: ['날개항공 새 노선 취항', '날개항공 예약률 사상 최고'], '-1': ['날개항공 조종사 파업 예고', '날개항공 기체 결함으로 결항'] },
    energy: { 1: ['훈훈에너지 요금 인상 승인', '훈훈에너지 새 가스전 계약'], '-1': ['훈훈에너지 요금 동결 압박', '훈훈에너지 설비 점검으로 공급 차질'] },
    insure: { 1: ['든든보험 손해율 개선', '든든보험 신상품 가입 몰려'], '-1': ['든든보험 보험금 지급 늘어', '든든보험 불완전 판매 조사'] },
    defense: { 1: ['방패방산, 해외 수출 계약', '방패방산 신형 장비 시험 통과'], '-1': ['방패방산 납품 지연', '방패방산 예산 삭감 우려'] },
    doge: { 1: ['멍멍코인 밈, 하루 만에 천만 조회', '유명 래퍼가 멍멍코인 가사에'], '-1': ['멍멍코인 개발자 "장난이었다"', '멍멍코인 큰손 지갑에서 대량 이동'] },
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
    { asset: 'battery', pct: -0.22, head: '번쩍배터리 탑재 차량 화재' },
    { asset: 'battery', pct: 0.2, head: '번쩍배터리, 해외 보조금 대상 선정' },
    { asset: 'bank', pct: -0.09, head: '튼튼은행 지점 횡령 사고' },
    { asset: 'game', pct: -0.18, head: '꿀잼게임즈 서버 사흘째 먹통' },
    { asset: 'build', pct: -0.17, head: '뚝딱건설 현장 부실시공 적발' },
    { asset: 'air', pct: -0.16, head: '날개항공 여객기 회항 소동' },
    { asset: 'air', pct: 0.14, head: '날개항공, 경쟁사 노선 통째로 넘겨받아' },
    { asset: 'energy', pct: -0.13, head: '훈훈에너지 배관 누출 사고' },
    { asset: 'insure', pct: -0.11, head: '든든보험 고객 정보 유출' },
    { asset: 'defense', pct: 0.19, head: '방패방산, 사상 최대 수주' },
    { asset: 'defense', pct: -0.15, head: '방패방산 시험 발사 실패' },
    { asset: 'doge', pct: -0.3, head: '멍멍코인 마스코트 개, 사실은 고양이' },
    { asset: 'doge', pct: 0.32, head: '억만장자가 멍멍코인 강아지 사진을 올림' },
  ];
  // 세상 사건 (2026-11-21 "천재지변같은 돌발이벤트같은거 많이 넣어"): 아침에 닥쳐 알바 · 밤 회복 · 시세 · 부동산 · 가진 집과 건물을 흔든다.
  // warn = 전날 아침에 예보가 뜬다(빗나갈 수 있음 — sure 면 늘 맞음) · season = 그 계절에만(0 가을 · 1 겨울 · 2 봄 · 3 여름) · days = 이어지는 날 · from = 이 날부터 · w = 뽑힐 무게
  // fx = 시세(종목 → 비율, ALL = 주식 전부) · re = 부동산 시세 · hp = 내 체력 · job(j) = 그날 알바가 달라지는 것 { ban | pay | hp } · sleep = { tier 이하에 살면 밤 회복 −n } · dmg = { p 확률로 값의 rate 만큼 수리비 }
  const W_OUT = why => j => (j.out ? { ban: why } : null), W_HARD = k => j => (j.out ? { hp: k } : null);
  const WORLD = [
    { id: 'typhoon', kind: '날씨', name: '태풍', icon: 'typhoon', warn: true, season: [3, 0], w: 3, head: '태풍이 상륙했습니다', miss: '태풍이 비켜 갔습니다',
      fx: { air: -0.09, insure: -0.07, build: 0.05, buldak: 0.04 }, job: W_OUT('태풍 — 오늘은 밖에서 일할 수 없습니다'), sleep: { tier: 0, n: 10 }, dmg: { p: 0.25, rate: 0.01 }, sum: '야외 알바 불가 · 서울역의 밤 회복 −10' },
    { id: 'rain', kind: '날씨', name: '폭우', icon: 'umbrella', warn: true, season: [3, 0, 2], w: 3, head: '폭우가 쏟아집니다', miss: '비구름이 흩어졌습니다',
      fx: { insure: -0.05, air: -0.03, build: 0.03 }, job: j => (j.id === 'flyer' ? { ban: '폭우 — 전단지가 다 젖습니다' } : j.id === 'delivery' ? { pay: 1.3, hp: 1.3 } : j.out ? { hp: 1.2 } : null), dmg: { p: 0.15, rate: 0.006 }, sum: '전단지 불가 · 배달 일당 +30% · 체력도 더 든다' },
    { id: 'snow', kind: '날씨', name: '폭설', icon: 'snow', warn: true, season: [1], w: 3, head: '폭설로 길이 막혔습니다', miss: '눈은 진눈깨비로 그쳤습니다',
      fx: { air: -0.07, energy: 0.04 }, job: j => (j.id === 'delivery' || j.id === 'driver' ? { ban: '폭설 — 길이 막혔습니다' } : j.out ? { hp: 1.3 } : null), sleep: { tier: 0, n: 6 }, sum: '배달 · 대리 불가 · 전단지는 체력이 더 든다' },
    { id: 'cold', kind: '날씨', name: '한파', icon: 'thermo', warn: true, season: [1], days: 2, w: 3, head: '한파가 몰아칩니다', miss: '추위가 한풀 꺾였습니다',
      fx: { energy: 0.08, air: -0.02 }, job: W_HARD(1.3), sleep: { tier: 0, n: 8 }, sum: '야외 알바의 체력 +30% · 서울역의 밤 회복 −8' },
    { id: 'heat', kind: '날씨', name: '폭염', icon: 'sun', warn: true, season: [3], days: 2, w: 3, head: '폭염 경보가 내렸습니다', miss: '소나기가 더위를 식혔습니다',
      fx: { energy: 0.06, buldak: -0.03 }, job: j => (j.out || j.id === 'loading' ? { hp: 1.3 } : null), sleep: { tier: 0, n: 6 }, sum: '야외 알바 · 상하차의 체력 +30% · 서울역의 밤 회복 −6' },
    { id: 'dust', kind: '날씨', name: '황사', icon: 'cloud', warn: true, season: [2], w: 3, head: '황사가 하늘을 덮었습니다', miss: '바람이 황사를 밀어냈습니다',
      fx: { air: -0.02 }, job: W_HARD(1.2), sum: '야외 알바의 체력 +20%' },
    { id: 'holiday', kind: '날씨', name: '명절 연휴', icon: 'gift', warn: true, sure: true, days: 2, from: 12, w: 2, head: '명절 연휴가 시작됐습니다',
      fx: { air: 0.08, buldak: 0.04 }, job: j => (j.id === 'store' || j.id === 'cafe' || j.id === 'delivery' ? { pay: 1.2 } : null), sum: '편의점 · 카페 · 배달 일당 +20% (대목)' },
    { id: 'quake', kind: '재난', name: '지진', icon: 'quake', from: 10, w: 2, head: '새벽에 지진이 났습니다',
      fx: { ALL: -0.04, insure: -0.12, build: 0.07, gold: 0.05 }, re: -0.03, hp: -6, dmg: { p: 0.35, rate: 0.015 }, sum: '주식 전체 하락 · 부동산 시세 −3% · 놀라서 체력 −6' },
    { id: 'blackout', kind: '재난', name: '대정전', icon: 'bulb', w: 2, head: '도시 절반이 정전됐습니다',
      fx: { daejang: -0.06, energy: -0.08, coin: -0.06, doge: -0.06 }, job: j => (j.shop ? { ban: '정전 — 가게 문을 닫았습니다' } : null), sum: '편의점 · 카페 알바 불가' },
    { id: 'fire', kind: '재난', name: '산불', icon: 'fire', season: [2, 1], w: 2, head: '큰 산불이 번지고 있습니다',
      fx: { insure: -0.08, build: 0.03 }, job: W_HARD(1.2), dmg: { p: 0.2, rate: 0.01, villa: 0.6 }, sum: '연기로 야외 알바의 체력 +20% · 별장은 불탈 수 있다' },
    { id: 'flu', kind: '재난', name: '독감 유행', icon: 'mask', season: [1, 0], days: 3, from: 8, w: 2, head: '독감이 크게 돌고 있습니다',
      fx: { air: -0.1, hantang: 0.1, game: 0.06 }, job: j => (j.shop ? { pay: 0.85 } : j.id === 'delivery' ? { pay: 1.2 } : null), sleep: { tier: 2, n: 5 }, sum: '편의점 · 카페 일당 −15% · 배달 +20% · 고시원 아래는 밤 회복 −5' },
    { id: 'hike', kind: '경제', name: '기준금리 인상', icon: 'percent', from: 10, w: 2, head: '중앙은행이 기준금리를 올렸습니다',
      fx: { bank: 0.05, build: -0.06, battery: -0.06, gold: -0.04, coin: -0.05, doge: -0.07 }, re: -0.015, sum: '은행주 상승 · 건설 · 성장주 · 금 · 코인 하락 · 부동산 시세 −1.5%' },
    { id: 'cut', kind: '경제', name: '기준금리 인하', icon: 'percent', from: 10, w: 2, head: '중앙은행이 기준금리를 내렸습니다',
      fx: { bank: -0.03, build: 0.06, battery: 0.05, gold: 0.02, coin: 0.05, doge: 0.07 }, re: 0.015, sum: '건설 · 성장주 · 금 · 코인 상승 · 부동산 시세 +1.5%' },
    { id: 'oil', kind: '경제', name: '유가 급등', icon: 'up', w: 2, head: '국제 유가가 하루 만에 뛰었습니다',
      fx: { energy: 0.1, air: -0.09, battery: 0.04 }, sum: '에너지 상승 · 항공 하락' },
    { id: 'tension', kind: '경제', name: '국경 긴장', icon: 'shield', from: 12, w: 2, head: '국경의 긴장이 높아졌습니다',
      fx: { ALL: -0.03, defense: 0.16, gold: 0.04 }, sum: '방산 급등 · 금 상승 · 주식 전체 하락' },
    { id: 'peace', kind: '경제', name: '평화 회담', icon: 'bird', from: 12, w: 1, head: '평화 회담이 열렸습니다',
      fx: { ALL: 0.02, defense: -0.1, gold: -0.03 }, sum: '방산 · 금 하락 · 주식 전체 상승' },
    { id: 'crash', kind: '경제', name: '검은 월요일', icon: 'down', from: 20, w: 1, head: '증시가 개장과 함께 무너졌습니다',
      fx: { ALL: -0.08, gold: 0.06, coin: -0.1, doge: -0.14 }, sum: '주식 전체 급락 · 금 상승 · 거꾸로ETF 급등' },
    { id: 'rally', kind: '경제', name: '깜짝 랠리', icon: 'rocket', from: 12, w: 2, head: '증시가 개장과 함께 뛰었습니다',
      fx: { ALL: 0.05, gold: -0.04, coin: 0.06, doge: 0.09 }, sum: '주식 전체 급등 · 금 하락 · 거꾸로ETF 급락' },
    { id: 'ease', kind: '경제', name: '부동산 규제 완화', icon: 'building', from: 14, w: 1, head: '정부가 부동산 규제를 풀었습니다',
      fx: { build: 0.08 }, re: 0.03, sum: '부동산 시세 +3% · 건설 상승' },
    { id: 'curb', kind: '경제', name: '부동산 규제 강화', icon: 'building', from: 14, w: 1, head: '정부가 부동산 규제를 조였습니다',
      fx: { build: -0.08 }, re: -0.03, sum: '부동산 시세 −3% · 건설 하락' },
  ];
  const SEASONS = ['가을', '겨울', '봄', '여름'];
  const DISASTER = ['typhoon', 'rain', 'quake', 'fire']; // 복구 봉사 · 재난 지원금이 따라오는 것
  // 상가 · 건물: 사 두면 일요일 밤마다 임대수익이 들어온다 (값은 부동산 시세를 따른다). tier = 살 수 있게 되는 사는 곳
  const PROPS = [
    { id: 'stall', name: '골목 상가 한 칸', tier: 3, price: 'prop_1', note: '분식집이 세 들어 있다' },
    { id: 'shop', name: '역 앞 상가', tier: 4, price: 'prop_2', note: '1층 편의점 · 2층 학원' },
    { id: 'bldg', name: '꼬마빌딩', tier: 5, price: 'prop_3', note: '5층. 엘리베이터는 없다' },
    { id: 'office', name: '오피스 빌딩', tier: 6, price: 'prop_4', note: '로비에 경비실이 있다' },
    { id: 'tower', name: '랜드마크 타워', tier: 7, price: 'prop_5', note: '지도에 이름이 나온다' },
  ];
  // 사 먹기: 하루 한 번, 칸을 쓰지 않고 돈으로 체력을 채운다. scale = 사는 곳에 따라 값이 커진다
  const FOODS = [
    { id: 'kimbap', name: '삼각김밥 세트', cost: 'food_1_cost', hp: 'food_1_hp' },
    { id: 'gukbap', name: '국밥 한 그릇', cost: 'food_2_cost', hp: 'food_2_hp' },
    { id: 'feast', name: '고기 한 상', cost: 'food_3_cost', hp: 'food_3_hp', scale: true },
  ];
  // 물건: wear = 옷(입은 한 벌만 효과) · home = 살림(사면 그대로) · lux = 사치품. tier = 살 수 있게 되는 사는 곳
  const ITEMS = [
    { id: 'vest', cat: 'wear', name: '작업 조끼', tier: 0, desc: () => '상하차 · 배달에 드는 체력 −' + pc(T.item_vest) },
    { id: 'padding', cat: 'wear', name: '롱패딩', tier: 0, desc: () => '밤마다 체력을 ' + T.item_padding + ' 더 회복' },
    { id: 'suit', cat: 'wear', name: '정장', tier: 3, desc: () => '사업 매출 · 통장 한도 +' + pc(T.item_suit) }, // 통장 = 마이너스 통장 (주담대 한도에는 붙지 않는다). 가게 칸이 좁아 짧게
    { id: 'gold', cat: 'wear', name: '금빛 운동복', tier: 4, desc: () => '알바 일당 +' + pc(T.item_gold) },
    { id: 'mat', cat: 'home', name: '매트리스', tier: 2, desc: () => '밤 회복 +' + T.item_mat + ' (이사해도 가져간다)' },
    { id: 'ginseng', cat: 'home', name: '홍삼 한 박스', tier: 2, desc: () => '최대 체력 +' + T.item_ginseng },
    { id: 'chair', cat: 'home', name: '안마의자', tier: 3, desc: () => '쉬기 한 칸의 회복 +' + T.item_chair },
    { id: 'watch', cat: 'lux', name: '손목시계', tier: 5, desc: () => '신용점수 +' + T.item_watch },
    { id: 'car', cat: 'lux', name: '스포츠카', tier: 6, desc: () => '최대 체력 +' + T.item_car },
  ];
  // 꿈: 판을 시작할 때 하나를 고른다. 장면은 조건이 되면 한 번씩 뜨고, 둘째 장면에서 작은 힘을 얻는다 (끝 장면은 엔딩에)
  const DREAMS = [
    { id: 'family', name: '가족과 한 지붕', line: '흩어진 가족을 다시 한 집에 모은다',
      intro: '가게가 넘어가던 날 가족은 뿔뿔이 흩어졌다. 주머니에는 딸이 그려 준 집 그림 한 장.',
      beats: [
        { when: s => reached(s, 2), text: '주소가 생겼다. 딸에게 처음으로 엽서를 부쳤다. "방 생겼다. 좁다."' },
        { when: s => reached(s, OWN), text: '내 집 현관에 신발이 세 켤레 놓였다. 그림 속 집보다 작지만 지붕은 진짜다.', gain: () => '집밥 — 밤마다 체력을 ' + T.dream_family + ' 더 회복' },
      ],
      end: '딸의 그림은 이제 호텔 로비에 걸려 있다. 액자가 그림 속 집보다 비쌌다.' },
    { id: 'sign', name: '간판을 다시 건다', line: '넘어간 가게의 간판을 되찾아 불을 켠다',
      intro: '폐업하던 날 간판을 고물상에 넘겼다. 이만 원을 받았고, 그 돈은 그날 저녁에 없어졌다.',
      beats: [
        { when: s => reached(s, 2), text: '고시원 벽에 메뉴판을 다시 적어 붙였다. 손님은 아직 나 하나다.' },
        { when: s => (s.biz || 0) >= 1, text: '고물상에서 옛 간판을 되샀다. 사십만 원을 불렀고, 깎지 않았다.', gain: () => '단골 — 사업 매출 +' + pc(T.dream_sign) },
      ],
      end: '옛 간판은 본사 1층에 걸려 있다. 전구 하나가 여전히 깜빡인다. 일부러 안 고쳤다.' },
    { id: 'landlord', name: '쫓겨나지 않는 사람', line: '다시는 방 빼라는 말을 듣지 않는다',
      intro: '방을 빼 달라는 문자를 세 번 받았다. 네 번째는 받지 않기로 했다. 그래서 오늘은 여기서 잔다.',
      beats: [
        { when: s => leaseOf(s) === 'jeonse' || reached(s, OWN), text: '집주인 번호가 떠도 가슴이 내려앉지 않는 첫 밤이다.' },
        { when: s => propCount(s) >= 1, text: '세입자가 월세를 하루 늦게 보냈다. 독촉 문자를 썼다가 지웠다.', gain: () => '좋은 집주인 — 임대수익 +' + pc(T.dream_landlord) },
      ],
      end: '이제 내가 문자를 보내는 쪽이다. "이번 달은 천천히 주셔도 됩니다."' },
  ];
  // 투자 공부의 단계 (공부한 횟수가 쌓여 오른다)
  const KNOW = [null,
    { name: '입문', gain: '리포트를 읽는다 (종목 하나)' },
    { name: '초급', gain: '리포트가 더 잘 맞는다' },
    { name: '중급', gain: '한 번에 두 종목을 읽는다' },
    { name: '고급', gain: '리포트가 더 잘 맞는다 · 부동산 전망이 보인다' },
    { name: '전문가', gain: '속보 경보 — 큰 소식이 터질 종목을 아침에 안다' },
    { name: '고수', gain: '리포트가 더 잘 맞는다' },
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
      v: 5, biz: 0, loan: null, homeVal: 0, act1: null, seed: seed | 0, rng: seed | 0, rng2: (Math.imul(seed | 0, 7919) + 13) | 0, rng3: (Math.imul(seed | 0, 104729) + 71) | 0, name: (name || '').trim() || '나',
      lv: 1, xp: 0, perks: {}, offer: null, picks: 0, combo: 0, buff: {}, event: null, evSeen: [], evDay: {}, ach: [], hpBonus: 0, gutsUsed: false, den: null, inten: {}, // inten: 알바마다 마지막으로 고른 강도
      day: 1, slot: 0, phase: 'day', cash: 0, hp: T.start_hp, tier: 0, deposit: 0, lease: '', arrears: 0, missed: 0, movedDay: 0, rentPaid: 0,
      credit: T.credit_start, cl: 0, clAcc: 0, addr: 0, re: { idx: 1, trend: 0, left: 0, next: 0, hint: 0.5, last: 0, hist: [1] }, props: {}, know: 0, items: {}, wear: '', look: 0, ate: 0, sick: 0, hosp: 0, dream: '', dreamSet: 0, beats: [], // 신용 · 마이너스 통장 · 부동산 시세 · 상가 · 공부 횟수 · 물건 · 옷 · 꿈
      cr: { pay: 0, debt: 0, age: 0, asset: 0, mix: 0 }, crLog: [], crStreak: 0, crWeeks: 0, crSpend: 0, spent: 0, clBoost: 0, ever: {}, // 신용의 다섯 항목 · 변동 내역 · 연속 납부 · 주소가 생긴 뒤의 주 수 · 소비 실적 · 해 본 알바
      jobs: JOBS.reduce((o, j) => { o[j.id] = 0; return o; }, {}), studied: 0,
      market: { tick: 0, px: {}, hist: {}, chg: {}, news: [], nid: 0, ht: { phase: 'quiet', left: 4 }, gm: { phase: 'quiet', left: 14 }, intel: null, brief: null, shocks: [], gap: {}, world: [] }, // intel = 오늘 공부해서 안 내일 것 · brief = 어제 공부해서 아는 오늘 것
      hold: {}, lev: null, quest: 0, title: TITLES[0][1],
      today: null, last: null,
      stats: { alba: 0, jobsDone: 0, bought: 0, trade: 0, gain: 0, htGain: 0, levGain: 0, levOpens: 0, levWins: 0, fees: 0, fixed: 0, liq: 0, perfect: 0, quests: 0, maxTier: 0, evicted: 0,
        comboBest: 0, tips: 0, saunaNights: 0, lossSells: 0, bestGain: 0, missedTotal: 0, lotto: 0, kind: 0, events: 0, foreclosed: 0, loanPaid: 0, loanDone: 0, bizSpent: 0 },
      log: [], ended: null, ev: [],
    };
    for (const a of ASSETS) { s.market.px[a.id] = a.px; s.market.hist[a.id] = [a.px]; s.market.chg[a.id] = 0; s.hold[a.id] = { units: 0, cost: 0, min: 0 }; } // min: 지난 정산 뒤로 내내 들고 있던 수량 (배당은 이만큼만)
    for (let i = 0; i < 17; i++) tick(s, true); // 차트가 비어 보이지 않게 지난 며칠치를 미리 굴림
    reNext(s); // 첫 일요일에 부동산 시세가 움직일 만큼
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
  const has = (s, id) => !!(s.items && s.items[id]); // 가진 물건
  const wearing = (s, id) => s.wear === id; // 입은 옷 (한 벌만 효과)
  const topTier = s => Math.max(s.tier, (s.stats && s.stats.maxTier) || 0); // 가장 높이 살아 본 곳 (계좌 · 종목 · 가게는 내려가도 닫히지 않는다)
  const leaseOf = s => s.lease || (s.tier >= OWN ? 'own' : s.tier >= 2 ? 'rent' : ''); // 지금 집의 계약 (예전 저장에는 없다)
  const dreamOn = (s, id) => s.dream === id && (s.beats || []).indexOf(id + '2') >= 0; // 꿈의 둘째 장면까지 봤나 (그때부터 힘이 붙는다)
  const hpMax = s => 100 + T.perk_iron * perk(s, 'iron') + (s.hpBonus || 0) + (has(s, 'ginseng') ? T.item_ginseng : 0) + (has(s, 'car') ? T.item_car : 0);
  const thrift = s => 1 - T.perk_thrift * perk(s, 'thrift'); // 끼니 · 찜질방 · 고정비에 곱함
  const mealCost = s => round1k(T.meal_cost * thrift(s)), saunaCost = s => round1k(T.sauna_night * thrift(s));
  const feeMult = s => (perk(s, 'stockonly') ? 0 : perk(s, 'vip') ? 0.5 : 1);
  const legs = s => 1 - T.perk_legs * perk(s, 'legs'); // 발품: 집 · 사업 값에 곱함
  const reIdx = s => (s.re && s.re.idx) || 1; // 부동산 시세 지수 (판을 시작할 때 1)
  function homePrice(s, tier) { tier = tier == null ? OWN : tier; const h = HOMES[tier]; if (!h || h.kind !== 'own') return h ? h.price : 0; return Math.round(h.price * reIdx(s) * legs(s) / 10000) * 10000; } // 집값은 부동산 시세를 따라 일요일 밤마다 움직인다
  function depositFor(s, tier, lease) { // 그 계약의 보증금 (나갈 때 돌려받는 돈)
    if (lease === 'rent') return tier === 2 ? T.gosiwon_dep : tier === 3 ? T.oneroom_dep : 0;
    if (lease === 'jeonse') return tier === 3 ? T.oneroom_jeonse : Math.round(homePrice(s, tier) * T.jeonse_ratio / 10000) * 10000;
    return 0;
  }
  const propPrice = (s, p) => Math.round(T[p.price] * reIdx(s) / 10000) * 10000; // 상가의 지금 시세
  const propCount = s => PROPS.filter(p => s.props && s.props[p.id]).length;
  const propValue = s => PROPS.reduce((v, p) => v + (s.props && s.props[p.id] ? propPrice(s, p) : 0), 0);
  function housePrice(s) { return homePrice(s, OWN); } // 예전 이름 (= 내 집 값)
  function scale(s) { return s.tier >= OWN ? T['tier_scale_' + Math.min(8, s.tier)] || 1 : 1; } // 정해진 금액(사건 · 퀘스트 보상 · 도박장 판돈)에 곱함
  const sc = (s, amt) => round1k(amt * scale(s));
  function holdValue(s, id) { return s.hold[id].units * s.market.px[id]; }
  const levId = l => (l && l.id) || 'coin'; // 포지션을 연 코인 (예전 저장에는 없다 = 달나라코인)
  function levValue(s) { const l = s.lev; if (!l) return 0; return Math.max(0, l.margin * (1 + l.dir * l.lev * (s.market.px[levId(l)] / l.entry - 1))); }
  function levLiq(l) { return l.entry * (1 - l.dir / l.lev); }
  const levMax = id => (byId(ASSETS, id) || {}).maxLev || 5; // 그 코인에 걸 수 있는 가장 큰 배율
  function invested(s) { let v = levValue(s); for (const a of ASSETS) if (a.kind === 'stock') v += holdValue(s, a.id); return v; }
  const loanBal = s => (s.loan ? s.loan.balance : 0);
  function worth(s) { return Math.round(s.cash + (s.deposit || 0) + invested(s) + (s.homeVal || 0) + propValue(s) - loanBal(s) - (s.cl || 0) - s.arrears); } // 보증금 · 집 · 상가는 자산, 주담대 · 마이너스 통장 · 밀린 돈은 빚
  function weekCost(s, tier, lease) { // 주 고정비. 원룸은 월세와 전세가 다르다 (그 밖에는 계약과 무관)
    tier = tier == null ? s.tier : tier; lease = lease || (tier === s.tier ? leaseOf(s) : '');
    const h = HOMES[tier], k = h && (tier === 3 && lease === 'jeonse' ? 'oneroom_jweek' : h.week);
    return round1k((k ? T[k] : 0) * thrift(s));
  }
  function sleepGain(s, home) { // 집이 좋을수록 많이 돌아온다 (서울역 12 → 호텔 100). 병원에서 보낸 밤은 hospital_sleep 까지만 — 사는 곳의 회복을 넘지는 않는다 (home = 병원이 아닌 밤의 값)
    if (s.hosp === s.day && !home) return Math.min(T.hospital_sleep, sleepGain(s, true));
    return Math.max(0, sleepRaw(s) - (s.buff.sleepPen > 0 ? T.ev_sleep_pen : 0) - worldSleepPen(s)); // 잠을 설쳐도 · 태풍이 와도 자면서 체력이 깎이지는 않는다
  }
  function sleepRaw(s) { // 깎이기 전의 밤 회복 (사는 곳 · 특성 · 옷 · 살림 · 꿈)
    const base = T[HOMES[Math.min(s.tier, 8)].sleep] + T.perk_sleep * perk(s, 'sleep') + (wearing(s, 'padding') ? T.item_padding : 0) + (has(s, 'mat') ? T.item_mat : 0) + (dreamOn(s, 'family') ? T.dream_family : 0);
    return Math.min(T.regen_max - T.perk_early * perk(s, 'early'), base);
  }
  function worldSleepPen(s) { const w = worldNow(s); return w && w.def.sleep && s.tier <= w.def.sleep.tier && s.hosp !== s.day ? w.def.sleep.n : 0; } // 한파 · 태풍의 서울역, 독감의 고시원 아래 (병원에서 잔 밤은 빼고)
  // ── 신용: 점수 → 등급 → 마이너스 통장 한도 · 이자, 주담대의 빌릴 수 있는 몫 · 이자 ──
  const GRADE_AT = [900, 800, 700, 600, 500, 400]; // 1 ~ 6등급의 아래 끝 (그 밑은 7등급 = 대출 불가)
  const gradeOf = score => { const i = GRADE_AT.findIndex(x => score >= x); return i < 0 ? 7 : i + 1; };
  const creditGrade = s => gradeOf(s.credit == null ? T.credit_start : s.credit);
  // 점수의 다섯 항목 (2026-11-21 "신용등급 구체화해"): 바뀔 때마다 어느 항목인지(cat)와 까닭을 적어 둔다 — 신용 보고서가 보여 준다
  const CR_CATS = [['pay', '상환 이력'], ['debt', '부채 수준'], ['age', '거래 기간'], ['asset', '소득과 자산'], ['mix', '계약과 소비']];
  const GRADE_NAME = ['', '최우량', '우량', '양호', '보통', '주의', '위험', '대출 불가'];
  function creditAdd(s, n, why, cat) {
    if (!n || s.ended) return;
    const g0 = creditGrade(s), was = s.credit == null ? T.credit_start : s.credit;
    s.credit = clamp(Math.round(was + n), 300, 1000);
    if (s.credit === was) return;
    const g1 = creditGrade(s), d = s.credit - was, k = cat && CR_CATS.some(c => c[0] === cat) ? cat : 'mix';
    const cr = s.cr || (s.cr = { pay: 0, debt: 0, age: 0, asset: 0, mix: 0 }); cr[k] = (cr[k] || 0) + d;
    const log = s.crLog || (s.crLog = []), last = log[log.length - 1];
    if (last && last.day === s.day && last.why === (why || '') && last.cat === k) last.n += d; else log.push({ day: s.day, n: d, why: why || '', cat: k }); // 같은 날 같은 까닭은 한 줄로
    if (log.length > 12) log.shift();
    ev(s, 'credit', { delta: d, score: s.credit, grade: g1, was: g0, why: why || '', cat: k });
    if (g1 !== g0) sys(s, '신용등급이 ' + g0 + '등급에서 ' + g1 + '등급이 되었습니다 (' + s.credit + '점). ' + (g1 < g0 ? '대출 한도가 늘고 이자가 내려갑니다.' : '대출 한도가 줄고 이자가 오릅니다.'), g1 < g0 ? 'good' : 'bad');
  }
  const clRate = s => T['cl_rate_' + Math.min(6, creditGrade(s))]; // 마이너스 통장의 한 주 이자
  function clLimit(s, tier, grade) { // 마이너스 통장 한도: 사는 곳이 올라갈수록, 등급이 좋을수록 크다. 주소가 없으면(고시원 전) 0. grade 를 주면 그 등급일 때의 한도 (등급표)
    tier = tier == null ? s.tier : tier; const g = grade || creditGrade(s);
    if (g >= 7 || tier < 2) return 0;
    return Math.round(T['cl_limit_' + Math.min(8, tier)] * T['cl_mult_' + g] * (wearing(s, 'suit') ? 1 + T.item_suit : 1) * (1 + (s.clBoost || 0)) / 10000) * 10000; // clBoost: 은행이 올려 준 한도 (사건)
  }
  const ltvOf = s => { const g = creditGrade(s); return g >= 7 ? 0 : T['ltv_' + g]; }; // 주담대: 집값 가운데 빌릴 수 있는 몫
  const mortRate = s => Math.round(clRate(s) * T.mort_k * 10000) / 10000; // 주담대의 한 주 이자 (빌릴 때의 등급으로 정해진다)
  const loanRate = l => (l && l.rate != null ? l.rate : T.loan_rate);
  function weekIncome(s) { // 일요일 밤에 먼저 들어오는 돈: 임대수익(공실은 0) + 배당(지난 정산 뒤로 내내 들고 있던 만큼)
    let rent = 0;
    for (const p of PROPS) { const o = s.props && s.props[p.id]; if (o && !(o.vacant > 0)) rent += round1k(propPrice(s, p) * T.prop_yield * (dreamOn(s, 'landlord') ? 1 + T.dream_landlord : 1)); }
    const h = s.hold && s.hold.bank, div = h && h.units > 0 ? round1k(Math.min(h.units, h.min == null ? h.units : h.min) * s.market.px.bank * T.bk_div) : 0;
    return { rent, div, total: rent + div };
  }
  const billName = b => [b.week ? '고정비' : '', b.loan ? '원리금' : '', b.credit ? '이자' : ''].filter(Boolean).join(' · ') || '밀린 돈'; // 정산에 든 것의 이름
  const weekStart = day => Math.floor((day - 1) / 7) * 7 + 1;
  const livedFrom = (s, day) => Math.max(weekStart(day), s.movedDay || 1); // 그 주에 지금 집에서 산 첫날
  function loanDue(s, days) { // 이번 주 원리금: 이자 = 잔액 × 이율, 원금 = 처음 빌린 돈 ÷ 기간 (잔액까지만). 그 주에 낀 날만큼
    const l = s.loan;
    if (!l || l.balance <= 0) return { loan: 0, interest: 0, principal: 0 };
    const f = (days == null ? 7 : days) / 7, interest = round1k(l.balance * loanRate(l) * f), principal = Math.min(l.balance, round1k(l.orig / T.loan_weeks * f));
    return { loan: interest + principal, interest, principal };
  }
  function bill(s) { // 다음 정산: 고정비 + 원리금 + 마이너스 통장 이자 + 밀린 돈, 며칠 뒤 밤에. 매주 일요일(7 · 14 · 21 …일) 밤, 고정비는 그 주에 산 날만큼만.
    // income = 같은 밤에 먼저 들어오는 돈(임대수익 · 배당), net = 나갈 돈 − 들어올 돈
    const cl = s.cl || 0, inc = weekIncome(s), acc = s.clAcc || 0; // acc: 이번 주에 밤마다 쌓인 마이너스 통장 이자 (빌렸다가 일요일 낮에 갚아도 쓴 밤만큼은 낸다)
    if (s.tier < 2 && !cl && !s.arrears && !inc.total && !(acc > 0)) return null;
    const inDays = (7 - (s.day % 7)) % 7, due = s.day + inDays, days = s.tier >= 2 ? due - livedFrom(s, due) + 1 : 7;
    const week = s.tier >= 2 ? round1k(weekCost(s) * days / 7) : 0, ld = loanDue(s, days), credit = round1k(acc + cl * clRate(s) * (inDays + 1) / 7), amt = week + ld.loan + credit + s.arrears; // credit: 쌓인 이자 + 지금 잔액을 일요일 밤까지 그대로 둘 때의 몫
    return { amt, week, loan: ld.loan, interest: ld.interest, principal: ld.principal, credit, arrears: s.arrears, days, inDays, income: inc.total, rent: inc.rent, div: inc.div, net: amt - inc.total };
  }
  function owedOld(s) { // 이사 나갈 때: 살던 곳의 이번 주 고정비(와 대출 이자)를 어제까지 산 날만큼
    if (s.tier < 2) return 0;
    const days = Math.max(0, s.day - livedFrom(s, s.day));
    return round1k(weekCost(s) * days / 7) + (s.loan ? round1k(s.loan.balance * loanRate(s.loan) * days / 7) : 0);
  }
  function riseIn() { return null; } // 집값은 이제 오르지 않는다 (이름만 남김)
  function skill(s, id) { const n = s.jobs[id]; return n >= T.skill_n3 ? 3 : n >= T.skill_n2 ? 2 : n >= T.skill_n1 ? 1 : 0; }
  function skillNext(s, id) { const n = s.jobs[id]; const at = [T.skill_n1, T.skill_n2, T.skill_n3].find(x => n < x); return at ? at - n : 0; }
  function grade(score) { return score >= T.grade_perfect - 1e-9 ? 'perfect' : score >= T.grade_good - 1e-9 ? 'good' : score >= T.grade_ok - 1e-9 ? 'ok' : 'miss'; } // 기준은 config 의 grade_*
  function unlocked(s, what) { // 주식 · 공부는 찜질방부터(한 번 열리면 내려가도 그대로), 은행은 고시원(주소)부터, 코인은 원룸에 사는 동안, 부동산은 원룸부터
    return what === 'stock' || what === 'study' ? topTier(s) >= 1 : what === 'coin' ? s.tier >= 3 : what === 'bank' ? topTier(s) >= 2 : what === 'realty' ? topTier(s) >= 3 || propCount(s) > 0 : true;
  }
  const visible = (s, id) => { const a = byId(ASSETS, id); return !!a && (a.kind === 'coin' ? unlocked(s, 'coin') && (topTier(s) >= a.tier || levId(s.lev) === id && !!s.lev) : topTier(s) >= a.tier || !!(s.hold[id] && s.hold[id].units > 0)); }; // 그 종목이 보이나 (코인은 원룸에 사는 동안, 멍멍코인은 내 집에 살아 본 뒤)

  // 지금 칸에서 고를 수 있는 것
  const LOW_HP = '체력이 모자랍니다 — 쉬거나 사 먹기', CLOSED = '오늘은 이 알바를 마쳤습니다 — 다른 일을';
  const doneToday = (s, id) => (s.did && s.did.day === s.day && s.did.n[id]) || 0; // 오늘 그 알바를 한 횟수
  // 컨디션: 체력이 넉넉하면 일당이 붙고, 바닥이면 깎인다 (일을 시작할 때의 체력으로)
  function condOf(s) { const r = s.hp / hpMax(s); return r >= T.cond_good ? 'good' : r < T.cond_tired ? 'tired' : 'ok'; }
  const condMult = s => { const c = condOf(s); return c === 'good' ? 1 + T.cond_good_pay : c === 'tired' ? 1 - T.cond_tired_cut : 1; };
  const riskOf = (hp, need) => (hp >= need ? 0 : clamp((need - hp) / need + T.collapse_base, T.collapse_min, 0.95)); // 무리: 모자란 몫이 클수록 쓰러지기 쉽다
  const jobHp = (s, id) => T['hp_' + id] * (wearing(s, 'vest') && (id === 'loading' || id === 'delivery') ? 1 - T.item_vest : 1); // 작업 조끼
  // 알바의 그날 사정: 칸(대리는 저녁에만) · 일마다의 덤(카페의 오전 · 과외의 공부 단계 · 강연의 정장 · 자문의 신용등급) · 세상 사건(태풍엔 야외 일 불가 …)
  function jobMod(s, j) {
    let pay = 1, hp = 1, ban = '', plus = '', by = '';
    if (j.slots && s.slot < 3 && j.slots.indexOf(s.slot) < 0) { ban = '저녁 칸에만 할 수 있습니다'; by = 'slot'; }
    if (j.id === 'cafe' && s.slot === 0 && T.job_cafe_am) { pay *= 1 + T.job_cafe_am; plus = '오전 +' + pc(T.job_cafe_am); }
    if (j.id === 'tutor' && knowLv(s) > 1 && T.job_tutor_know) { pay *= 1 + T.job_tutor_know * (knowLv(s) - 1); plus = '공부 ' + knowLv(s) + '단계 +' + pc(T.job_tutor_know * (knowLv(s) - 1)); }
    if (j.id === 'lecture' && wearing(s, 'suit') && T.job_lecture_suit) { pay *= 1 + T.job_lecture_suit; plus = '정장 +' + pc(T.job_lecture_suit); }
    if (j.id === 'advise' && creditGrade(s) < 7 && T.job_advise_grade) { pay *= 1 + T.job_advise_grade * (7 - creditGrade(s)); plus = '신용 ' + creditGrade(s) + '등급 +' + pc(T.job_advise_grade * (7 - creditGrade(s))); }
    const w = worldNow(s), m = w && w.def.job ? w.def.job(j) : null;
    if (m) { if (m.ban && !ban) { ban = m.ban; by = 'world'; } if (m.pay) pay *= m.pay; if (m.hp) hp *= m.hp; }
    return { pay, hp, ban, by, plus, world: m ? w.def.name : '', wpay: m && m.pay ? m.pay : 1, whp: m && m.hp ? m.hp : 1 }; // by: 못 하는 까닭이 칸(slot)인지 세상 사건(world)인지
  }
  function acts(s) {
    const out = [], bm = bizMult(s), cm = condMult(s);
    for (const j of JOBS) {
      if (s.tier < j.tier) continue; // 아직 못 하는 알바는 아예 안 보임
      const mod = jobMod(s, j), banned = !!mod.ban; // 오늘 · 이 칸에는 못 하는 일 (태풍 · 정전 · 저녁에만)
      const hp0 = jobHp(s, j.id) * mod.hp, hp = hp0 > 0 ? Math.max(1, Math.round(hp0)) : 0, lv = skill(s, j.id), closed = T.job_per_day > 0 && doneToday(s, j.id) >= T.job_per_day; // closed: 오늘은 그 알바를 다 했다
      const raw = T['pay_' + j.id] * (1 + T.skill_bonus * lv) * (1 + T.perk_hustle * perk(s, 'hustle')) * (1 + T.perk_workaholic * perk(s, 'workaholic')) * (wearing(s, 'gold') ? 1 + T.item_gold : 1) * bm, pay = round1k(raw * cm * mod.pay), pay0 = round1k(raw); // pay0: 컨디션 · 그날 사정을 뺀 일당 (사업 자동 수입의 기준)
      // 강도마다: ok = 체력이 됨 · can = 체력이 모자라도 조금이라도 있으면 무리해서 할 수 있음 · risk = 그때 쓰러질 확률
      const levels = INT.map((name, n) => { const payMult = T['int_pay_' + n], hpMult = T['int_hp_' + n], h = hp0 > 0 ? Math.max(1, Math.round(hp0 * hpMult)) : 0, ok = !closed && !banned && s.hp >= h; return { n, name, pay: round1k(pay * payMult), hp: h, ok, can: !closed && !banned && (ok || s.hp > 0), risk: ok || closed || banned ? 0 : riskOf(s.hp, h), payMult, hpMult }; });
      const int = intOf(s, j.id); let use = int; while (use >= 0 && !levels[use].ok) use--; // 기억한 강도가 안 되면 할 수 있는 가장 높은 강도로
      const push = !closed && !banned && use < 0 && s.hp > 0; // 어느 강도도 체력이 모자람: 무리해서만 할 수 있다 (가장 낮은 강도부터)
      out.push({ kind: 'job', id: j.id, name: j.name, note: j.note, tier: j.tier, pay, pay0, bizMult: bm, hp, lv, toNext: skillNext(s, j.id), ok: !closed && !banned && s.hp >= hp, why: closed ? CLOSED : banned ? mod.ban : s.hp >= hp || push ? '' : LOW_HP, levels, any: levels[0].ok, push, closed, banned, mod, int, use: push ? 0 : use, cond: cm }); // pay · hp · ok 는 "중" 기준. 체력이 안 드는 알바(설정 0)는 어느 강도도 0
    }
    const noRest = perk(s, 'workaholic') && out.some(a => a.kind === 'job' && a.ok); // 일중독: 할 수 있는 알바가 하나도 없을 때만 쉰다 (갇히지 않게)
    const auto = autoPay(s, out); // 사업 자동 수입: 일하지 않은 칸에도 들어오는 돈 (가게부터)
    out.push({ kind: 'rest', id: 'rest', name: '쉬기', hp: -restHp(s), auto, ok: !noRest, why: noRest ? '일중독: 할 수 있는 알바가 있으면 쉬지 않는다' : '', note: s.tier === 0 ? '벤치에서는 덜 풀린다' : '' });
    if (unlocked(s, 'study')) { const read = studied(s), hp = T.study_hp, ok = !read && s.hp >= hp; out.push({ kind: 'study', id: 'study', name: '공부', hp, auto, ok, why: read ? '오늘 리포트는 이미 읽었습니다' : ok ? '' : LOW_HP, note: '고른 종목의 내일을 한쪽으로 기울여 보고, 공부가 쌓이면 단계가 오른다', assets: studyAssets(s), picks: studyPicks(s) }); }
    return out;
  }
  const restHp = s => (s.tier === 0 ? T.rest_hp_station : T.rest_hp) + (has(s, 'chair') ? T.item_chair : 0); // 쉬기 한 칸 (안마의자)

  // ── 칸 행동 ─────────────────────────────────────────────────
  const studied = s => !!(s.market.intel && s.market.intel.madeOn === s.day && !s.market.intel.free); // 오늘 한 칸을 써서 읽었나 (공짜로 얻은 리포트는 안 침)
  function canAct(s) { return !s.ended && s.phase === 'day' && s.slot < 3 && !s.event && !s.den; } // 돌발 사건 · 도박장이 떠 있으면 먼저 끝내야 함
  const skipMult = s => T.mult_skip + T.perk_lazy * perk(s, 'lazy'); // "대충"의 일당 배율 (특성 '요령' 포함)
  const INT = ['하', '중', '상', '최상']; // 알바 강도 (중 = 기준)
  const intOf = (s, id) => { const v = s.inten && s.inten[id]; return Number.isInteger(v) && v >= 0 && v <= 3 ? v : 1; }; // 예전 저장에는 inten 이 없다 · 엉뚱한 값은 중
  function setInt(s, id, n) { if (!Number.isInteger(n) || n < 0 || n > 3 || !byId(JOBS, id)) return false; (s.inten || (s.inten = {}))[id] = n; return true; }
  function doJob(s, id, score, n, quit) { // score: 0~1, null 이면 "대충 하기"(강도 무관 = 중). n: 강도 0~3 (안 주면 중). quit: quitJob 만 씀
    if (!quit && (score == null || n == null)) n = 1;
    const a = acts(s).find(x => x.id === id), L = a && a.levels && a.levels[n];
    if (!canAct(s) || !L || !(quit ? !a.closed && !a.banned : score == null ? L.ok : L.can)) return false; // 대충은 체력이 될 때만. 직접 하는 판은 체력이 조금이라도 있으면 무리해서 할 수 있다. 하다 만 판은 칸을 반드시 쓰되(체력이 없어도), 오늘 이미 한 알바 · 오늘 못 하는 알바(태풍 날의 야외 일 · 저녁이 아닌 대리)로는 안 된다
    const g = score == null ? 'skip' : grade(score + T.perk_hands * perk(s, 'hands')), sk = skipMult(s), ip = g === 'skip' || g === 'miss' ? 1 : L.payMult; // 실수 · 대충에는 강도 보너스 없음
    const gmult = g === 'skip' ? sk : g === 'miss' ? Math.max(T.mult_miss, sk) : T['mult_' + g], mult = Math.max(sk, gmult * ip); // 직접 하면 어느 강도에서도 "대충"보다 덜 받지 않는다
    const comboWas = s.combo, comboMult = 1 + (T.combo_bonus + T.perk_streak * perk(s, 'streak')) * comboWas, extra = s.buff.nextJob || 1;
    const pay = round1k(a.pay * mult * comboMult * extra);
    const before = skill(s, id);
    delete s.buff.nextJob;
    if (g === 'good' || g === 'perfect') s.combo = Math.min(T.combo_max, s.combo + 1); else if (g !== 'ok') s.combo = 0; // 잘함 이상이면 쌓이고, 실수 · 대충이면 끊김
    s.stats.comboBest = Math.max(s.stats.comboBest || 0, s.combo);
    const hp0 = s.hp, hp = Math.min(L.hp, s.hp), risk = riskOf(hp0, L.hp); // 무리한 판은 남은 체력까지만 쓰고, 끝난 뒤 쓰러질지 굴린다
    s.hp -= hp; s.stats.jobsDone = (s.stats.jobsDone || 0) + 1; s.stats.alba += pay; if (g === 'perfect') s.stats.perfect++;
    if (score != null) s.jobs[id]++; // 대충 하면 숙련도는 오르지 않는다
    if (!s.did || s.did.day !== s.day) s.did = { day: s.day, n: {} };
    s.did.n[id] = (s.did.n[id] || 0) + 1; // 같은 알바는 하루에 job_per_day 번까지
    (s.ever || (s.ever = {}))[id] = 1; // 해 본 일 (업적)
    if (id === 'tv' && (g === 'good' || g === 'perfect') && T.job_tv_promo) { s.buff.promo = s.day + 1; if (bizEff(s) && T['biz_auto_' + bizEff(s)] > 0) sys(s, '방송이 잘 나갔습니다. 내일 사업 매출 +' + pc(T.job_tv_promo) + '.', 'good'); } // 방송: 잘하면 다음 날 사업 매출이 는다 (자동 수입이 없는 단계면 알릴 것이 없다)
    ev(s, 'job', { id, name: a.name, pay, base: a.pay, grade: g, gradeName: GRADE[g], mult, hp, combo: s.combo, comboWas, comboMult, extra, int: n, intName: INT[n], imult: ip, gmult, risk, cond: a.cond });
    const eff = bizEff(s);
    income(s, eff ? BIZ[eff].name + ' 수입 (' + a.name + ')' : a.name + ' 알바', pay);
    if (g === 'perfect' && rnd3(s) < T.tip_p) { const tip = round1k((T.tip_min + rnd3(s) * (T.tip_max - T.tip_min)) * a.bizMult); s.stats.tips = (s.stats.tips || 0) + 1; income(s, '팁', tip); ev(s, 'tip', { amt: tip }); }
    if (skill(s, id) > before) sys(s, a.name + ' 숙련도가 올랐습니다. 일당 +' + Math.round(T.skill_bonus * 100) + '%.', 'good');
    gainXp(s, Math.round(T.xp_job * XPF[g]));
    endSlot(s);
    if (risk > 0 && hp0 > 0) { s.stats.pushed = (s.stats.pushed || 0) + 1; if (rnd3(s) < risk) collapse(s, risk); else { ev(s, 'push_ok', { risk }); sys(s, '무리했지만 버텼습니다 (쓰러질 확률 ' + Math.round(risk * 100) + '%였음). 체력이 바닥입니다.', 'warn'); } }
    return true;
  }
  function collapse(s, risk) { // 쓰러짐: 응급실비 · 오늘 남은 칸 · 내일 오전을 잃는다. 오늘 밤은 병원에서 (찜질방 요금 · 끼니는 안 나간다)
    const fee = sc(s, T.hospital_fee), paid = Math.min(Math.max(0, s.cash), fee), owe = fee - paid;
    if (paid) expense(s, '응급실', paid);
    if (owe > 0) { s.arrears += owe; add(s.today.expense, '응급실 (외상 — 일요일 정산에)', owe); } // 못 낸 병원비는 밀린 돈으로 — 주소가 없어도 남는다 (현금을 주식에 넣어 두고 쓰러져도 일요일에 받아 간다)
    let lost = 0;
    while (s.slot < 3) { autoIncome(s); endSlot(s); lost++; } // 남은 칸은 누워서 보낸다 (시세는 그대로 흐르고, 가게는 직원이 돌린다)
    s.sick = s.day + 1; s.hosp = s.day; s.hp = 0; s.combo = 0; s.stats.collapsed = (s.stats.collapsed || 0) + 1;
    ev(s, 'collapse', { risk, fee, paid, owe, lost });
    sys(s, '쓰러졌습니다. 응급실비 ' + won(fee) + (owe > 0 ? ' (못 낸 ' + won(owe) + '은 외상 — 일요일 정산에)' : '') + '. 오늘 남은 칸과 내일 오전을 병원에서 보냅니다.', 'bad');
  }
  function quitJob(s, id, n) { // 하다 만 알바(하는 중에 새로 고침): 돈 · 숙련 · 콤보 · 경험치는 "대충", 체력은 시작한 강도만큼. 칸은 반드시 쓴다
    return doJob(s, id, null, Number.isInteger(n) && n >= 0 && n <= 3 ? n : 1, true);
  }
  function autoPay(s, jobs) { // 지금 열려 있는 알바 가운데 가장 많이 주는 것(직원이 하는 일이라 내 체력과 무관)의 "보통" 일당(숙련 · 사업 배수 포함, 콤보 · 팁 제외) × biz_auto_단계
    const eff = bizEff(s);
    if (!eff) return 0;
    const best = Math.max(0, ...(jobs || acts(s)).filter(a => a.kind === 'job').map(a => a.pay0));
    return round1k(best * T.mult_ok * T['biz_auto_' + eff] * (wearing(s, 'suit') ? 1 + T.item_suit : 1) * (dreamOn(s, 'sign') ? 1 + T.dream_sign : 1) * (s.buff && s.buff.promo === s.day ? 1 + T.job_tv_promo : 1)); // 직원이 하는 일이라 내 컨디션 · 그날 날씨와 무관 · 정장 · 꿈(단골) · 어제 방송이 잘 나갔으면
  }
  function autoIncome(s) { const amt = autoPay(s); if (amt) { income(s, '사업 매출', amt); ev(s, 'auto', { amt, slot: s.slot }); } } // 쉬기 · 공부 칸에 (칸을 넘기기 전에)
  function doRest(s) {
    if (!canAct(s)) return false;
    const r = acts(s).find(a => a.kind === 'rest');
    if (!r.ok) return fail(s, r.why);
    const before = s.hp;
    s.hp = Math.min(hpMax(s), s.hp + restHp(s));
    ev(s, 'rest', { hp: s.hp - before });
    autoIncome(s);
    endSlot(s);
    return true;
  }
  const studyAssets = s => ASSETS.filter(a => !a.quiet && visible(s, a.id)).map(a => ({ id: a.id, name: a.name })); // ETF 는 소식이 없어 읽을 리포트가 없다
  // 공부 = 성장: 공부한 횟수(s.know)가 쌓여 단계가 오른다. 정확도는 2 · 4 · 6단계에서, 3단계부터 한 번에 두 종목
  const knowAt = () => [0, T.know_n2, T.know_n3, T.know_n4, T.know_n5, T.know_n6];
  const knowLv = s => { const x = s.know || 0, at = knowAt(); let lv = 1; for (let i = 1; i < at.length; i++) if (x >= at[i]) lv = i + 1; return lv; };
  const studyPicks = s => (knowLv(s) >= 3 ? 2 : 1);
  function knowView(s) {
    const lv = knowLv(s), at = knowAt(), x = s.know || 0;
    return { lv, name: KNOW[lv].name, xp: x, from: at[lv - 1], next: lv < 6 ? at[lv] : 0, nextName: lv < 6 ? KNOW[lv + 1].name : '', nextGain: lv < 6 ? KNOW[lv + 1].gain : '', acc: studyAcc(s), picks: studyPicks(s),
      list: KNOW.slice(1).map((k, i) => ({ lv: i + 1, name: k.name, gain: k.gain, at: at[i], got: lv >= i + 1 })) };
  }
  function doStudy(s, pick) { // 공부 한 번 = 고른 종목(3단계부터 둘까지)의 내일 + 공부 횟수 1. 체력을 쓴다
    const ids = [...new Set(Array.isArray(pick) ? pick : [pick])].slice(0, studyPicks(s)), list = studyAssets(s);
    if (!canAct(s) || !unlocked(s, 'study') || studied(s) || s.hp < T.study_hp || !ids.length || !ids.every(id => list.some(a => a.id === id))) return false;
    const it = s.market.intel, wasFree = !!(it && it.madeOn === s.day && it.free), lv0 = knowLv(s);
    if (it && it.madeOn === s.day) it.free = false; // 귀띔으로 이미 받은 종목이면 다시 뽑지 않고 그대로 (다시 굴려서 고르는 길을 막음)
    const counts = ids.map(asset => (wasFree && (it.assets || []).indexOf(asset) >= 0 ? it.items.filter(i => i.asset === asset).length + (asset === 'hantang' || asset === 'game' ? 1 : 0) : readReport(s, asset)));
    s.hp -= T.study_hp; s.studied++; s.know = (s.know || 0) + 1;
    ev(s, 'study', { asset: ids[0], assets: ids, count: counts.reduce((a, b) => a + b, 0) });
    autoIncome(s);
    const acc = accText(studyAcc(s));
    const say = ids.map((asset, i) => {
      const nm = byId(ASSETS, asset).name, said = counts[i] && asset !== 'hantang' && asset !== 'game' ? (s.market.intel.items.find(x => x.asset === asset) || {}).dir : 0;
      return asset === 'hantang' ? nm + ' — ' + htText(s.market.intel.ht) : asset === 'game' ? nm + ' — ' + gmText(s.market.intel.gm) : said ? '내일 ' + nm + ' 소식은 ' + (said > 0 ? '오르는' : '내리는') + ' 쪽' : '내일 ' + nm + jo(nm, '은', '는') + ' 소식 없음';
    });
    sys(s, '리포트: ' + say.join(' · ') + ' (' + acc + '). 맞았는지는 나중에 알려 드립니다.');
    if (knowLv(s) > lv0) { const lv = knowLv(s); ev(s, 'know', { lv, name: KNOW[lv].name, gain: KNOW[lv].gain }); sys(s, '투자 공부 ' + lv + '단계(' + KNOW[lv].name + '): ' + KNOW[lv].gain + '.', 'good'); }
    gainXp(s, T.xp_study);
    endSlot(s);
    return true;
  }
  const studyAcc = s => Math.min(1, T.study_acc + T.know_acc_step * Math.floor(knowLv(s) / 2) + T.perk_sense * perk(s, 'sense')); // 1단계 0.56 → 6단계 0.68
  const accText = acc => '열에 ' + ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉', '열'][clamp(Math.round(acc * 10), 0, 10)] + ' 번쯤 맞음'; // 62% → "열에 여섯 번쯤 맞음" (확률로 오른다는 뜻으로 읽히지 않게)
  function endSlot(s) {
    const had = invested(s);
    tick(s, false);
    if (had > 0) { const now = invested(s); ev(s, 'while', { delta: Math.round(now - had), pct: now / had - 1 }); } // 그 칸 동안 내 투자가 움직인 만큼
    s.slot++;
    after(s);
  }
  function after(s) { titleTick(s); questTick(s); dreamTick(s); achTick(s); }

  // ── 시세 한 틱 ──────────────────────────────────────────────
  function tick(s, warm) {
    const m = s.market, imp = {};
    for (const a of ASSETS) imp[a.id] = 0;
    if (!warm) {
      const am = clamp(T.news_am == null ? 1 : T.news_am, 0, 1), w = [am, (1 - am) * 0.6, (1 - am) * 0.4][s.slot] || 0; // 소식의 참 · 거짓이 값에 드러나는 몫: 오전 칸에 news_am, 나머지는 오후 · 저녁에 6:4
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
    r.coin = clamp(T.c_momentum * (m.chg.coin || 0) - T.c_sigma * T.c_sigma / 2 + T.c_sigma * gauss(s), -0.3, 0.3); // − 출렁임의 제곱 / 2: 값의 평균 비율을 1 로 (로그 평균이 0 이면 출렁임만으로 롱이 칸마다 그만큼씩 남는다 — 2026-11-21 독립 검토)
    r.bank = T.bk_drift + T.bk_sigma * gauss(s);
    r.battery = T.bt_drift + T.bt_sigma * gauss(s);
    const gm = m.gm || (m.gm = { phase: 'quiet', left: 14 }), launch = gm.phase === 'hype' && gm.left <= 1; // 꿀잼게임즈: 조용 → 신작 발표(기대감) → 출시 칸에 흥행 / 혹평
    r.game = (gm.phase === 'hype' ? T.g_hype + T.g_hype_sigma * gauss(s) : T.g_quiet_drift + T.g_quiet_sigma * gauss(s)) + (launch ? (gm.hit ? T.g_hit : -T.g_flop) : 0);
    r.build = T.bd_drift + T.bd_sigma * gauss(s);
    r.gold = T.gd_drift + T.gd_sigma * gauss(s);
    r.insure = T.in_drift + T.in_sigma * gauss(s);
    r.air = T.ar_drift + T.ar_sigma * gauss(s);
    r.energy = T.en_drift + T.en_sigma * gauss(s);
    r.defense = T.df_sigma * gauss(s);
    r.doge = clamp(T.dg_momentum * (m.chg.doge || 0) - T.dg_sigma * T.dg_sigma / 2 + T.dg_sigma * gauss(s), -0.4, 0.4); // 같은 까닭 (멍멍코인은 출렁임이 커서 5배 롱을 들고만 있어도 하루 +7% 였다)
    const x = {};
    for (const a of ASSETS) if (!a.der) x[a.id] = clamp(r[a.id] + imp[a.id], -0.45, 0.45);
    x.etf = BASKET.reduce((v, id) => v + x[id], 0) / BASKET.length; // 다담아ETF: 담은 종목의 평균만큼
    x.inv = -x.etf - T.iv_fee; // 거꾸로ETF: 그 반대로, 칸마다 조금씩 깎인다
    for (const a of ASSETS) {
      m.px[a.id] = Math.max(FLOOR, m.px[a.id] * Math.exp(x[a.id]));
      m.chg[a.id] = x[a.id];
      m.hist[a.id].push(m.px[a.id]);
      if (m.hist[a.id].length > 120) m.hist[a.id].shift();
      if (a.kind === 'coin' && m.px[a.id] < MERGE_AT) coinMerge(s, a.id);
    }
    m.tick++;
    ht.left--;
    if (ht.left <= 0) {
      const span = (a, b) => a + Math.floor(rnd(s) * (b - a + 1));
      const toDump = () => { ht.phase = 'dump'; ht.left = 2; ht.drop = (ht.from ? Math.max(0, Math.log(m.px.hantang / ht.from)) : 0) + T.h_dump_base; }; // 예전 저장(from 없음)은 기본 폭락만
      if (ht.phase === 'quiet') { // 매집 시작: 진짜(급등까지 감)인지, 털고 끝나는지는 여기서 시세 난수로 정해 둔다. 알림은 둘 다 똑같이
        ht.phase = 'gather'; ht.left = span(T.h_gather_min, T.h_gather_max); ht.real = rnd(s) < T.h_real_p; ht.hint = rnd(s); ht.from = m.px.hantang;
        if (!warm && visible(s, 'hantang')) {
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
    gm.left--;
    if (gm.left <= 0) {
      if (gm.phase === 'quiet') { // 신작 발표: 흥행할지는 여기서 시세 난수로 정해 둔다
        gm.phase = 'hype'; gm.left = T.g_hype_ticks; gm.hit = rnd(s) < T.g_hit_p; gm.hint = rnd(s); gm.from = m.px.game;
        if (!warm && visible(s, 'game')) {
          m.gmAlert = s.day;
          for (const k of ['intel', 'brief']) if (m[k] && m[k].gm && m[k].gm.state === 'quiet') m[k].gm.stale = true;
          ev(s, 'gm_alert', {});
          sys(s, '꿀잼게임즈가 신작 출시일을 발표했습니다 — ' + Math.round(T.g_hype_ticks / 3) + '일 뒤. 흥행이면 급등, 혹평이면 급락합니다.', 'warn');
        }
      } else { // 출시: 이 칸의 값에 이미 들어갔다
        if (!warm) {
          const pct = Math.exp(gm.hit ? T.g_hit : -T.g_flop) - 1, held = s.hold.game.units > 0, delta = held ? Math.round(s.hold.game.units * (m.px.game - px0.game)) : 0;
          if (m.gmRead && m.gmRead.from === gm.from) {
            const said = m.gmRead.lean, real = gm.hit ? 1 : -1, r2 = { asset: 'game', name: '꿀잼게임즈', said, real, right: said === real, by: 'study' };
            m.gmRead = null; if (s.today) (s.today.reports || (s.today.reports = [])).push(r2);
            ev(s, 'report_check', { list: [r2] });
          }
          if (visible(s, 'game')) {
            const head = gm.hit ? '꿀잼게임즈 신작, 첫날 동시 접속 신기록' : '꿀잼게임즈 신작, 첫날부터 혹평';
            ev(s, 'shock', { asset: 'game', name: '꿀잼게임즈', pct, head, held, delta, launch: true });
            sys(s, '신작 출시: ' + head + '. 꿀잼게임즈 ' + signPct(pct) + '.' + (held ? ' 내 손익 ' + (delta >= 0 ? '+' : '') + won(delta) + '.' : ''), gm.hit ? 'good' : 'bad');
          }
        }
        gm.phase = 'quiet'; gm.left = T.g_gap_min + Math.floor(rnd(s) * (T.g_gap_max - T.g_gap_min + 1));
      }
    }
    if (!warm) {
      ev(s, 'tick', { chg: Object.assign({}, m.chg) });
      for (const k of hits) {
        const a = byId(ASSETS, k.asset), coin = a.kind === 'coin', held = coin ? !!s.lev && levId(s.lev) === k.asset : s.hold[k.asset].units > 0;
        if (!visible(s, k.asset)) continue; // 아직 못 보는 종목의 속보는 알리지 않는다 (시세는 그대로 움직임)
        const delta = !held ? 0 : Math.round(coin ? levValue(s) - lev0 : s.hold[k.asset].units * (m.px[k.asset] - px0[k.asset]));
        ev(s, 'shock', { asset: k.asset, name: a.name, pct: k.pct, head: k.head, held, delta });
        sys(s, '속보: ' + k.head + '. ' + a.name + ' ' + signPct(k.pct) + '.' + (held ? ' 내 손익 ' + (delta >= 0 ? '+' : '') + won(delta) + '.' : ''), k.pct < 0 ? 'bad' : 'good');
      }
      if (s.lev) s.lev.margin -= s.lev.put * s.lev.lev * T.lev_fund; // 포지션을 들고 있는 값 (틱마다)
      if (s.lev && levValue(s) <= 0) liquidate(s);
    }
  }
  function coinMerge(s, id) { // 코인 값이 바닥 가까이 내려가면 100:1 로 합친다: 표기만 100배, 포지션의 손익은 그대로 (진입 값도 같이 옮긴다). 바닥(10원)에 닿아 "더는 못 내려가는 코인의 롱"이 공짜가 되는 일이 없다
    const m = s.market, nm = byId(ASSETS, id).name;
    m.px[id] *= MERGE; m.hist[id] = m.hist[id].map(v => v * MERGE);
    if (s.lev && levId(s.lev) === id) s.lev.entry *= MERGE;
    ev(s, 'merge', { id, name: nm, by: MERGE });
    sys(s, nm + ' ' + MERGE + ':1 병합 — 표시 값이 ' + MERGE + '배가 됐습니다. 포지션의 손익은 그대로입니다.');
  }
  function liquidate(s) { // 틱 · 밤사이 갭이 함께 씀
    const l = s.lev, saved = perk(s, 'guts') && !s.gutsUsed ? Math.round(l.put * T.perk_guts) : 0;
    if (saved) { s.gutsUsed = true; s.cash += saved; }
    s.lev = null; s.stats.liq++; s.stats.trade -= l.put - saved;
    ev(s, 'liq', { lost: l.put - saved, saved, dir: l.dir, lev: l.lev, id: levId(l) });
    sys(s, '청산되었습니다. 증거금 ' + won(l.put - saved) + '이 사라졌습니다.' + (saved ? ' 강심장으로 ' + won(saved) + '은 건졌습니다(한 번뿐).' : '') + ' 레버리지 ' + l.lev + '배는 ' + Math.round(100 / l.lev) + '% 역방향이면 끝입니다.', 'bad');
  }
  function genNews(s, day) {
    const m = s.market;
    for (const id of ['buldak', 'daejang', 'coin', 'battery', 'bank', 'build', 'air', 'energy', 'insure', 'defense', 'doge']) {
      if (rnd(s) >= T['news_p_' + id]) continue;
      const dir = rnd(s) < (id === 'coin' || id === 'doge' ? 0.5 : 0.55) ? 1 : -1;
      const x = rnd(s), src = x < 0.2 ? 'official' : x < 0.65 ? 'article' : 'rumor';
      const n = { id: ++m.nid, day, asset: id, dir, src, truth: rnd(s) < T[SRC[src].rel], mag: T['news_mag_' + id] * (0.7 + 0.6 * rnd(s)), head: pick(s, HEAD[id][dir]) }, rel = T[SRC[src].rel];
      const priced = byId(ASSETS, id).kind === 'coin' && T.news_priced_coin != null ? T.news_priced_coin : T.news_priced; // 코인은 전부 먼저 들어간다: 주식은 남은 몫이 수수료(오갈 때 0.6%)에 묻히지만 코인은 열고 드는 값이 작아(배율당 0.2%) 소식 방향으로 걸기만 해도 남았다
      n.pre = priced * dir * n.mag * (rel - (1 - rel) * T.fake_back); // 시장은 아침 장 전에 "믿을 만한 만큼" 먼저 움직인다
      m.news.push(n);
    }
    if (day >= T.shock_from && rnd(s) < T.shock_p) { // 속보도 시세 난수로 미리 정해 둔다 (판 코드가 같으면 같은 속보)
      const k = pick(s, SHOCKS);
      m.shocks.push({ id: ++m.nid, day, slot: Math.min(2, Math.floor(rnd(s) * 3)), asset: k.asset, pct: k.pct * T.shock_mag, head: k.head });
    }
    genWorld(s, day);
  }
  // ── 세상 사건: 날씨 · 재난 · 경제 (시세 난수로 미리 정해 둔다 — 판 코드가 같으면 같은 날 같은 일이 난다) ──
  const seasonOf = day => Math.floor((Math.max(1, day) - 1) / T.season_days) % 4; // 0 가을 · 1 겨울 · 2 봄 · 3 여름
  const worldDef = w => byId(WORLD, w.type);
  const worldEnd = w => w.day + (w.days || 1) - 1;
  function genWorld(s, day) { // day 에 닥칠 사건을 하나 정한다 (전날 아침에 불린다). 앞 사건이 끝난 뒤에만
    const m = s.market, list = m.world || (m.world = []);
    if (day < T.world_from || list.some(w => worldEnd(w) >= day) || rnd(s) >= T.world_p) return;
    const pool = WORLD.filter(w => day >= (w.from || 0) && (!w.season || w.season.indexOf(seasonOf(day)) >= 0)), total = pool.reduce((v, w) => v + (w.w || 1), 0);
    let x = rnd(s) * total, def = pool[pool.length - 1];
    for (const w of pool) { x -= w.w || 1; if (x < 0) { def = w; break; } }
    list.push({ id: ++m.nid, type: def.id, day, days: def.days || 1, warn: !!def.warn, truth: !def.warn || !!def.sure || rnd(s) < T.world_acc }); // truth: 예보가 맞는가 (예고 없는 사건은 늘 닥친다)
  }
  const worldAcc = def => (def.sure ? 1 : T.world_acc);
  function worldFx(def) { // 종목마다의 움직임(로그). ALL = 주식 전부. ETF 는 담은 것에서 나온다
    const out = {}, k = T.world_mag, add = (id, pct) => { out[id] = (out[id] || 0) + Math.log(1 + clamp(pct * k, -0.6, 0.6)); };
    for (const id in def.fx || {}) { if (id === 'ALL') for (const a of SHARES) add(a, def.fx.ALL); else if (byId(ASSETS, id)) add(id, def.fx[id]); }
    return out;
  }
  function worldNow(s) { // 오늘 닥쳐 있는 사건 (예보가 빗나간 것은 빼고)
    const list = s.market && s.market.world;
    if (!list) return null;
    for (const w of list) if (w.truth && w.done && s.day >= w.day && s.day <= worldEnd(w)) return { w, def: worldDef(w), left: worldEnd(w) - s.day };
    return null;
  }
  function worldNext(s) { // 내일의 예보 (예고 없는 사건은 안 보인다)
    const list = s.market && s.market.world;
    if (list) for (const w of list) if (w.warn && w.day === s.day + 1) return { w, def: worldDef(w), acc: worldAcc(worldDef(w)) };
    return null;
  }
  function reBump(s, d) { // 부동산 시세가 그 자리에서 움직인다 (집값 · 가진 집 · 상가)
    const re = s.re, was = re.idx || 1;
    re.idx = clamp(was * Math.exp(d), 0.4, 4); const h = re.hist || (re.hist = [1]); h[h.length - 1] = re.idx; // 차트는 일요일마다 한 점 — 마지막 점을 옮긴다
    if (s.homeVal) s.homeVal = Math.round(s.homeVal * re.idx / was / 10000) * 10000;
    return re.idx / was - 1;
  }
  function worldTick(s) { // 아침: 오늘 닥친 사건(또는 빗나간 예보)과 내일 예보. 시세는 openGap 이 이미 옮겨 놓았다
    const m = s.market; let struck = false;
    for (const w of m.world || []) {
      const def = worldDef(w);
      if (!def) continue;
      if (w.day === s.day && !w.done) {
        w.done = 1;
        if (!w.truth) { s.stats.wmiss = (s.stats.wmiss || 0) + 1; ev(s, 'world', { type: def.id, name: def.name, icon: def.icon, kind: def.kind, miss: true, text: def.miss }); sys(s, '예보가 빗나갔습니다 — ' + def.miss + '. 미리 움직였던 시세는 되돌아갔습니다.', 'good'); continue; }
        struck = true; s.stats.world = (s.stats.world || 0) + 1; s.wlast = { type: def.id, day: s.day };
        const lines = [def.sum]; let cost = 0, owe = 0;
        const rePct = def.re ? reBump(s, def.re) : 0;
        if (def.hp) s.hp = clamp(s.hp + def.hp, 0, hpMax(s));
        if (def.dmg) { // 가진 집과 건물의 수리비 (플레이어 쪽 난수 — 가진 것에 따라 시세 난수가 흔들리지 않게)
          const hit = [];
          if (s.homeVal > 0 && leaseOf(s) === 'own' && rnd3(s) < (s.tier === 7 && def.dmg.villa ? def.dmg.villa : def.dmg.p)) hit.push([HOMES[s.tier].name, s.homeVal]);
          for (const p of PROPS) if (s.props && s.props[p.id] && rnd3(s) < def.dmg.p) hit.push([p.name, propPrice(s, p)]);
          for (const h of hit) cost += round1k(h[1] * def.dmg.rate * T.world_dmg);
          if (cost > 0) {
            const paid = Math.min(Math.max(0, s.cash), cost); owe = cost - paid;
            if (paid) expense(s, def.name + ' 수리비', paid);
            if (owe > 0) { s.arrears += owe; add(s.today.expense, def.name + ' 수리비 (외상 — 일요일 정산에)', owe); }
            s.stats.repair = (s.stats.repair || 0) + cost;
            lines.push(hit.map(h => h[0]).join(' · ') + ' 수리비 ' + won(cost) + (owe > 0 ? ' (못 낸 ' + won(owe) + '은 외상)' : ''));
          }
        }
        const fx = worldFx(def), moved = Object.keys(fx).filter(id => visible(s, id)).map(id => ({ id, name: byId(ASSETS, id).name, pct: Math.exp(fx[id]) - 1 })).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
        ev(s, 'world', { type: def.id, name: def.name, icon: def.icon, kind: def.kind, head: def.head, sum: def.sum, days: w.days || 1, moved, re: rePct, hp: def.hp || 0, cost, owe, warn: !!w.warn });
        sys(s, def.kind + ': ' + def.head + ' — ' + lines.join('. ') + '.' + (w.days > 1 ? ' ' + w.days + '일 동안 이어집니다.' : ''), def.kind === '날씨' && def.id === 'holiday' ? 'good' : 'warn');
      }
      if (w.warn && w.day === s.day + 1 && !w.told) { w.told = 1; ev(s, 'forecast', { type: def.id, name: def.name, icon: def.icon, acc: worldAcc(def), sum: def.sum }); sys(s, '예보: 내일 ' + def.name + (def.sure ? '' : ' (' + accText(worldAcc(def)) + ')') + ' — ' + def.sum + '.', 'warn'); }
    }
    return struck;
  }
  function worldView(s) { // 화면용: 계절 · 오늘의 사건 · 내일 예보
    const sn = seasonOf(s.day), now = worldNow(s), nx = worldNext(s), left = T.season_days - ((s.day - 1) % T.season_days);
    const one = (x, extra) => Object.assign({ type: x.def.id, name: x.def.name, icon: x.def.icon, kind: x.def.kind, sum: x.def.sum, head: x.def.head }, extra);
    return { season: sn, seasonName: SEASONS[sn], seasonLeft: left, nextSeason: SEASONS[(sn + 1) % 4], now: now ? one(now, { left: now.left, sleepPen: worldSleepPen(s) }) : null, next: nx ? one(nx, { acc: nx.acc, sure: !!nx.def.sure }) : null };
  }
  function todayChange(s, id) {
    const h = s.market.hist[id];
    if (s.slot === 0 || !h?.length) return null;
    const openIndex = h.length - 1 - Math.min(3, s.slot);
    const base = h[Math.max(0, openIndex)];
    return base > 0 ? { pct: s.market.px[id] / base - 1, fromOpen: openIndex >= 0 } : null;
  }
  function todayNews(s) {
    const intel = s.market.brief && s.market.brief.day === s.day ? s.market.brief : null;
    return s.market.news.filter(n => n.day === s.day && (n.asset === 'coin' || visible(s, n.asset))).map(n => { // 아직 못 보는 종목의 소식은 안 보인다 (달나라코인은 부르는 쪽이 가린다)
      const it = intel && intel.items.find(i => i.nid === n.id);
      return { id: n.id, asset: n.asset, name: byId(ASSETS, n.asset).name, dir: n.dir, src: n.src, srcName: SRC[n.src].name, srcNote: SRC[n.src].note, head: n.head, report: it ? it.dir : 0, by: it ? it.by || 'study' : '' }; // by: 리포트를 어디서 얻었나 (study 공부 · tip 정보통 · chat 리딩방)
    });
  }
  function intelView(s) { // 공부로 얻은 "내일" 정보 (오늘 공부했을 때만 보임)
    const it = s.market.intel;
    if (!it || it.madeOn !== s.day) return null;
    return { day: it.day, assets: (it.assets || []).slice(), items: it.items.map(i => ({ asset: i.asset, name: byId(ASSETS, i.asset).name, dir: i.dir })), ht: it.ht, gm: it.gm || null };
  }

  // ── 매매 (칸을 쓰지 않음) ────────────────────────────────────
  function fail(s, why) { ev(s, 'deny', { why }); return false; }
  const canFree = s => !s.ended && s.phase === 'day' && !s.den; // 칸을 안 쓰는 행동(매매 · 이사 · 계약)도 낮에만, 도박장 밖에서
  function buy(s, id, amt) { // 금액으로 사기 (봇 · 사건이 쓴다. 화면은 buyUnits)
    const a = byId(ASSETS, id);
    if (!canFree(s) || !a || a.kind !== 'stock' || !unlocked(s, 'stock')) return fail(s, '아직 계좌가 없습니다');
    if (!visible(s, id)) return fail(s, '아직 살 수 없는 종목입니다');
    if (perk(s, 'coinonly')) return fail(s, '코인 외길: 주식을 살 수 없습니다');
    if (s.market.px[id] <= FLOOR) return fail(s, '거래 정지 — 값이 바닥까지 내려간 종목입니다'); // 더 내려갈 수 없는 값에서 사면 잃을 것이 없다
    amt = Math.floor(Math.min(Number(amt), s.cash));
    if (!Number.isFinite(amt) || amt < 10000) return fail(s, '현금이 모자랍니다 (최소 10,000원)');
    const fee = Math.round(amt * T.fee * feeMult(s)), h = s.hold[id];
    h.units += (amt - fee) / s.market.px[id]; h.cost += amt; s.cash -= amt; s.stats.fees += fee; s.stats.bought += amt;
    ev(s, 'trade', { side: 'buy', id, name: a.name, amt, fee });
    after(s);
    return true;
  }
  const maxUnits = (s, id) => Math.max(0, Math.floor(s.cash / (s.market.px[id] * (1 + T.fee * feeMult(s)) + 1e-9))); // 지금 현금으로 살 수 있는 주 수 (수수료 포함)
  function buyUnits(s, id, n) { // 수량으로 사기: n 주의 값 + 수수료
    const a = byId(ASSETS, id);
    if (!canFree(s) || !a || a.kind !== 'stock' || !unlocked(s, 'stock')) return fail(s, '아직 계좌가 없습니다');
    if (!visible(s, id)) return fail(s, '아직 살 수 없는 종목입니다');
    if (perk(s, 'coinonly')) return fail(s, '코인 외길: 주식을 살 수 없습니다');
    if (s.market.px[id] <= FLOOR) return fail(s, '거래 정지 — 값이 바닥까지 내려간 종목입니다');
    n = Math.floor(Number(n));
    if (!(n >= 1)) return fail(s, '한 주 이상 골라야 합니다');
    const gross = n * s.market.px[id], fee = Math.round(gross * T.fee * feeMult(s)), cost = Math.round(gross + fee), h = s.hold[id];
    if (cost > s.cash) return fail(s, '현금이 ' + won(cost - s.cash) + ' 모자랍니다');
    h.units += n; h.cost += cost; s.cash -= cost; s.stats.fees += fee; s.stats.bought += cost;
    ev(s, 'trade', { side: 'buy', id, name: a.name, amt: cost, fee, units: n });
    after(s);
    return true;
  }
  function quote(s, id, n) { // 화면의 사기 · 팔기 버튼에 적을 금액 — 규칙이 실제로 오가게 하는 돈과 같은 식 (반올림 · 수수료 · 주식 외길의 덤까지)
    const h = s.hold[id] || { units: 0, cost: 0 }, px = s.market.px[id], f = T.fee * feeMult(s);
    n = Math.max(1, Math.floor(Number(n)) || 1);
    const g = n * px, buy = Math.round(g + Math.round(g * f));
    let sell = 0;
    if (h.units > 0) {
      const frac = clamp(Math.min(n, h.units) / h.units, 0, 1), gross = h.units * frac * px;
      sell = Math.round(gross - Math.round(gross * f));
      const pnl = Math.round(sell - h.cost * frac);
      if (pnl > 0 && perk(s, 'stockonly')) sell += Math.round(pnl * T.perk_stockonly);
    }
    return { buy, sell };
  }
  function sellUnits(s, id, n) { // 수량으로 팔기 (가진 것보다 많으면 전부)
    const h = s.hold[id];
    if (!h || h.units <= 0) return fail(s, '가진 것이 없습니다');
    n = Math.min(Number(n), h.units);
    if (!(n > 0)) return fail(s, '한 주 이상 골라야 합니다');
    return sell(s, id, n / h.units);
  }
  function sell(s, id, frac) {
    const a = byId(ASSETS, id), h = s.hold[id];
    if (!canFree(s) || !a || !h || h.units <= 0) return fail(s, '가진 것이 없습니다');
    frac = clamp(Number(frac) || 0, 0, 1);
    if (frac <= 0) return fail(s, '');
    const gross = h.units * frac * s.market.px[id], fee = Math.round(gross * T.fee * feeMult(s)), cost = h.cost * frac;
    let net = Math.round(gross - fee), pnl = Math.round(net - cost);
    if (pnl > 0 && perk(s, 'stockonly')) { const bonus = Math.round(pnl * T.perk_stockonly); net += bonus; pnl += bonus; } // 주식 외길: 이익에 얹어 줌
    const sold = h.units * frac;
    h.units -= sold; h.cost -= cost; if (Math.abs(h.units - Math.round(h.units)) < 1e-6) h.units = Math.round(h.units); if (h.units < 1e-9) { h.units = 0; h.cost = 0; }
    if (h.min != null) h.min = Math.min(h.min, h.units); // 배당은 내내 들고 있던 만큼만
    s.cash += net; s.stats.fees += fee; s.stats.trade += pnl; if (pnl > 0) { s.stats.gain += pnl; if (id === 'hantang') s.stats.htGain = (s.stats.htGain || 0) + pnl; if (id === 'inv') s.stats.invGain = (s.stats.invGain || 0) + pnl; }
    if (pnl < 0) s.stats.lossSells = (s.stats.lossSells || 0) + 1;
    s.stats.bestGain = Math.max(s.stats.bestGain || 0, pnl);
    ev(s, 'trade', { side: 'sell', id, name: a.name, amt: net, pnl, units: sold });
    profitXp(s, pnl);
    after(s);
    return true;
  }
  function levOpen(s, dir, margin, lev, id) { // id: 어느 코인 (안 주면 달나라코인)
    id = id || 'coin';
    const ca = byId(ASSETS, id);
    if (!canFree(s) || !unlocked(s, 'coin')) return fail(s, '원룸부터 할 수 있습니다');
    if (!ca || ca.kind !== 'coin' || !visible(s, id)) return fail(s, ca && ca.kind === 'coin' ? HOMES[ca.tier].name + '부터 할 수 있는 코인입니다' : '코인이 아닙니다');
    if (perk(s, 'stockonly')) return fail(s, '주식 외길: 코인을 할 수 없습니다');
    if (s.lev) return fail(s, '이미 포지션이 있습니다. 먼저 정리하세요');
    margin = Math.floor(Math.min(Number(margin), s.cash)); lev = clamp(Math.round(Number(lev)) || 1, 1, levMax(id));
    if (perk(s, 'beast') && lev < T.beast_min_lev) return fail(s, '야수의 심장: ' + T.beast_min_lev + '배 미만으로는 걸 수 없습니다');
    if (!Number.isFinite(margin) || margin < 100000) return fail(s, '증거금이 모자랍니다 (최소 100,000원)');
    const fee = Math.round(margin * lev * T.lev_fee * feeMult(s));
    s.cash -= margin; s.stats.fees += fee; s.stats.levOpens = (s.stats.levOpens || 0) + 1;
    s.lev = { dir: dir > 0 ? 1 : -1, lev, put: margin, margin: margin - fee, entry: s.market.px[id], day: s.day, id };
    ev(s, 'lev', { side: 'open', dir: s.lev.dir, lev, margin, id, name: ca.name });
    after(s);
    return true;
  }
  function levClose(s) {
    const l = s.lev;
    if (!canFree(s) || !l) return fail(s, '포지션이 없습니다');
    let v = Math.round(levValue(s)), pnl = v - l.put;
    if (pnl > 0) { const bonus = Math.round(pnl * (T.perk_coinonly * perk(s, 'coinonly') + T.perk_beast * perk(s, 'beast'))); v += bonus; pnl += bonus; } // 코인 외길 · 야수의 심장
    s.cash += v; s.lev = null; s.stats.trade += pnl; if (pnl > 0) { s.stats.gain += pnl; s.stats.levGain += pnl; s.stats.levWins = (s.stats.levWins || 0) + 1; if (levId(l) === 'doge') s.stats.dogeGain = (s.stats.dogeGain || 0) + pnl; }
    s.stats.bestGain = Math.max(s.stats.bestGain || 0, pnl);
    ev(s, 'lev', { side: 'close', pnl, value: v, id: levId(l) });
    profitXp(s, pnl);
    after(s);
    return true;
  }

  // ── 주거 ────────────────────────────────────────────────────
  function moveInfo(s, to, lease) { // 셋방으로 옮길 수 있는지 (찜질방 · 고시원 · 원룸). 보증금은 나갈 때 돌려받는 돈이라 순자산은 그대로다.
    // 같은 원룸에서 월세 → 전세로 갈아타는 것도 여기 (to = 3 · lease = 'jeonse'). need = 걸 보증금, have = 보증금에 댈 수 있는 돈
    const swap = to === s.tier && to === 3 && lease === 'jeonse' && leaseOf(s) === 'rent';
    if (!(to === s.tier + 1 && to <= 3) && !swap) return { ok: false, why: '' };
    if (to === 1) { const c = saunaCost(s), ok = s.cash >= c; return { ok, lease: '', need: c, have: s.cash, refund: 0, pay: 0, settle: 0, week: 0, why: ok ? '' : '하룻밤 요금 ' + won(c) + '이 있어야 합니다' }; }
    lease = HOMES[to].lease.indexOf(lease) >= 0 ? lease : HOMES[to].lease[0];
    const need = depositFor(s, to, lease), refund = s.deposit || 0, settle = owedOld(s), have = s.cash + refund - s.arrears - settle, pay = need - have + s.cash; // pay: 현금에서 나가는 돈 (돌려받는 보증금을 빼고, 밀린 돈 · 정산을 더해)
    const why = have >= need ? '' : (to === 2 ? '예치금 ' : LEASE[lease] + ' 보증금 ') + won(need) + '에 ' + won(need - have) + ' 모자랍니다' + (refund ? ' (돌려받을 보증금 ' + won(refund) + ' 포함)' : '') + (invested(s) > 0 ? ' (투자한 돈은 팔아야 현금)' : '');
    return { ok: !why, lease, swap, need, have, refund, pay, settle, week: weekCost(s, to, lease), why };
  }
  function move(s, to, lease) {
    const info = moveInfo(s, to, lease);
    if (!canFree(s) || !info.ok) return fail(s, info.why || '지금은 옮길 수 없습니다');
    const from = s.tier;
    if (to >= 2) {
      if (s.arrears) { s.cash -= s.arrears; s.arrears = 0; s.missed = 0; } // 빚 갚기: 순자산은 그대로 (못 낸 날 이미 깎였음)
      if (info.settle) { expense(s, HOMES[from].name + ' 고정비 (산 날만큼)', info.settle); s.stats.fixed += info.settle; }
      s.cash += info.refund - info.need; s.deposit = info.need; // 보증금: 살던 곳 것을 돌려받고 새로 건다 (순자산은 그대로)
    }
    const stockOpened = to === 1 && !unlocked(s, 'stock');
    s.lease = info.lease; s.tier = to; s.movedDay = s.day; s.stats.maxTier = Math.max(s.stats.maxTier || 0, to);
    ev(s, 'tier', { from, to, name: HOMES[to].name, unlock: info.swap || (to === 1 && !stockOpened) ? '' : HOMES[to].unlock, stockOpened, up: true, lease: info.lease, deposit: to >= 2 ? info.need : 0, refund: info.refund, swap: !!info.swap });
    if (to >= 2 && !s.addr) { s.addr = 1; creditAdd(s, T.credit_addr, '주소가 생김', 'age'); }
    if (info.lease === 'jeonse') { s.stats.jeonse = 1; creditAdd(s, T.credit_contract, '전세 계약', 'mix'); }
    const wk = won(weekCost(s));
    sys(s, to === 1 ? '찜질방 입장. 인류는 지붕을 발명했습니다. 하룻밤 ' + won(saunaCost(s)) + '씩 나갑니다.'
      : to === 2 ? '고시원 입주. 예치금 ' + won(info.need) + '을 걸었습니다(나갈 때 돌려받음). 주소가 생겨 은행이 열렸고, 매주 일요일 밤 고정비 ' + wk + '이 나갑니다(끼니 포함).'
        : info.lease === 'jeonse' ? '원룸 전세 계약. 보증금 ' + won(info.need) + '을 걸었고(나갈 때 돌려받음) 월세가 없어 주 고정비는 ' + wk + '입니다.' + (info.swap ? '' : ' 코인과 부동산이 열렸습니다.')
          : '원룸 입주(월세). 보증금 ' + won(info.need) + ' · 주 고정비 ' + wk + '. 코인과 부동산이 열렸습니다. 숨만 쉬어도 나갑니다.', 'good');
    after(s);
    return true;
  }
  // ── 집 사기 (내 집부터) · 주담대 · 압류 ─────────────────────────
  const loanCap = (s, tier) => (tier > OWN ? Math.floor(homePrice(s, tier) * ltvOf(s) / 10000) * 10000 : 0); // 주담대는 아파트부터. 빌릴 수 있는 몫은 신용등급을 따른다
  const rankOf = (day, a, b, c) => (day <= a ? 'S' : day <= b ? 'A' : day <= c ? 'B' : 'C');
  function homeInfo(s, to, lease) { // 한 단계 위 집에 들어갈 수 있는지 — 매매(기본) 또는 전세(아파트 · 주택). 살던 집은 그때 시세에 팔려 대출을 갚고 남은 돈이, 셋집이면 보증금이 보태진다
    const h = HOMES[to], own = !!(h && h.kind === 'own');
    lease = own && h.lease.indexOf(lease) >= 0 ? lease : 'own';
    const jeonse = lease === 'jeonse', price = own ? homePrice(s, to) : 0, deposit = own && jeonse ? depositFor(s, to, 'jeonse') : 0;
    const sell = (s.tier >= OWN && leaseOf(s) === 'own' ? (s.homeVal || 0) - loanBal(s) : 0) + (s.deposit || 0), /* 음수일 수 있다: 팔아도 대출이 남으면 그만큼 현금이 더 든다 */ settle = own ? owedOld(s) : 0, pay = s.arrears + settle;
    const canLoan = own && !jeonse && to > OWN, loanMax = canLoan ? loanCap(s, to) : 0, rate = mortRate(s);
    const full = own ? Math.max(0, (jeonse ? deposit : price) - sell + pay) : 0, down = Math.max(0, full - loanMax);
    const weekly = loanMax > 0 ? round1k(loanMax * rate) + round1k(loanMax / T.loan_weeks) : 0, fixed = own ? weekCost(s, to, lease) : 0;
    const base = { price, deposit, lease, leases: own ? h.lease.slice() : [], sell, loanMax, down, full, weekly, fixed, canLoan, settle, pay, have: s.cash, rate, ltv: ltvOf(s), grade: creditGrade(s) };
    if (!own || to !== s.tier + 1) return Object.assign(base, { ok: false, why: own ? HOMES[s.tier + 1].name + '부터 차례로 올라갑니다' : '' });
    const short = down - s.cash, inv = invested(s) > 0 ? ' (투자한 돈은 팔아야 현금)' : '';
    const why = short <= 0 ? '' : jeonse ? '전세 보증금 ' + won(deposit) + '에 현금이 ' + won(short) + ' 모자랍니다' + inv
      : to === OWN ? '내 집은 현금으로만 삽니다. 현금이 ' + won(short) + ' 모자랍니다' + inv
        : loanMax > 0 ? '대출을 최대(' + won(loanMax) + ')로 껴도 현금이 ' + won(short) + ' 모자랍니다' + inv : '신용등급이 낮아 대출이 나오지 않습니다. 현금이 ' + won(short) + ' 모자랍니다' + inv;
    return Object.assign(base, { ok: !why, why });
  }
  function buyHome(s, to, loan, lease) { // loan: 빌릴 돈 (0 ~ loanMax, 만 원 단위로 내림). lease: 'own'(기본) | 'jeonse'
    const info = homeInfo(s, to, lease), jeonse = info.lease === 'jeonse';
    if (!canFree(s) || !info.ok) return fail(s, info.why || '지금은 살 수 없습니다');
    loan = jeonse ? 0 : clamp(Math.floor((Number(loan) || 0) / 10000) * 10000, 0, info.loanMax);
    const need = info.full - loan;
    if (s.cash < need) return fail(s, '대출 ' + won(loan) + '이면 현금이 ' + won(need - s.cash) + ' 모자랍니다');
    const from = s.tier, oldVal = leaseOf(s) === 'own' ? s.homeVal || 0 : 0, repaid = loanBal(s), refund = s.deposit || 0;
    if (s.arrears) { s.cash -= s.arrears; s.arrears = 0; s.missed = 0; } // 밀린 돈은 이미 순자산에서 빠져 있음
    if (info.settle) { expense(s, HOMES[from].name + ' 고정비 (산 날만큼)', info.settle); s.stats.fixed += info.settle; }
    if (oldVal || repaid) { s.cash += oldVal - repaid; s.loan = null; s.homeVal = 0; } // 살던 집을 팔아 대출을 갚는다
    if (refund) { s.cash += refund; s.deposit = 0; } // 살던 셋집의 보증금을 돌려받는다
    if (jeonse) { s.cash -= info.deposit; s.deposit = info.deposit; s.homeVal = 0; s.loan = null; s.stats.jeonse = 1; }
    else { s.cash += loan - info.price; s.homeVal = info.price; s.loan = loan > 0 ? { balance: loan, orig: loan, day: s.day, rate: info.rate } : null; }
    s.lease = info.lease; s.tier = to; s.movedDay = s.day; s.stats.maxTier = Math.max(s.stats.maxTier || 0, to);
    ev(s, 'tier', { from, to, name: HOMES[to].name, unlock: HOMES[to].unlock, up: true, lease: info.lease, price: jeonse ? 0 : info.price, deposit: jeonse ? info.deposit : 0, loan, rate: info.rate, sold: oldVal, repaid, refund });
    creditAdd(s, jeonse ? T.credit_contract : T.credit_home, jeonse ? '전세 계약' : '집을 삼', 'mix');
    sys(s, jeonse ? HOMES[to].name + ' 전세 계약. 보증금 ' + won(info.deposit) + '을 걸었습니다(나갈 때 돌려받음). 대출은 없고 주 고정비 ' + won(weekCost(s)) + '.'
      : HOMES[to].name + ' 계약. ' + won(info.price) + (loan ? ', 그중 ' + won(loan) + '은 주담대입니다. 일요일 밤마다 고정비와 함께 ' + T.loan_weeks + '회에 나눠 갚고, 남은 돈에는 한 주에 ' + (Math.round(info.rate * 1000) / 10) + '%씩 이자가 붙습니다' : '. 대출은 없습니다') + '. 주 고정비 ' + won(weekCost(s)) + '.', 'good');
    if (to === OWN && !s.act1) { s.act1 = { day: s.day, rank: rankOf(s.day, T.act1_s, T.act1_a, T.act1_b), worth: worth(s), price: info.price }; ev(s, 'act1', { day: s.act1.day, rank: s.act1.rank }); }
    after(s);
    return true;
  }
  function buyHouse(s) { return buyHome(s, OWN, 0); } // 예전 이름 (= 내 집을 현금으로)
  function loanView(s) {
    const l = s.loan;
    if (!l) return null;
    const d = loanDue(s, 7), per = l.orig / T.loan_weeks;
    return { balance: l.balance, orig: l.orig, weekly: d.loan, interest: d.interest, principal: d.principal, left: Math.ceil(l.balance / per - 1e-9), rate: loanRate(l) };
  }
  function loanGone(s, moved) { s.loan = null; if (!moved) { s.stats.loanDone = (s.stats.loanDone || 0) + 1; creditAdd(s, T.credit_loan_done, '주담대를 다 갚음', 'debt'); } /* 빚으로 넘어가 정리된 것은 다 갚은 것이 아니다 (업적 · 기록에 안 셈) */ ev(s, 'loan_done', { moved: !!moved }); sys(s, moved ? '주담대 원금이 다 밀린 빚으로 넘어가 대출은 없어졌습니다. 밀린 빚 ' + won(s.arrears) + '은 다음 일요일에 냅니다.' : '주담대를 다 갚았습니다. 이제 원리금은 없습니다.', moved ? 'warn' : 'good'); } // moved: 못 낸 원금이 빚으로 옮겨 가 잔액이 0 이 된 때
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
    let repaid = Math.min(sold, debt); // 판 돈으로 먼저 갚고, 남으면 현금으로
    let carry = debt - repaid, left = 0, loan = 0, price = 0;
    s.cash += sold - repaid; s.homeVal = 0; s.loan = null; s.arrears = 0; s.missed = 0;
    const closed = [];
    if (carry > 0) { // 집을 판 돈으로 못 갚은 빚: 현금 → 주식 · 코인 → 상가 순으로 정리해 먼저 갚는다. 다른 재산을 두고 빚을 탕감하지 않는다 (그래도 남을 때만 아래 집 대출에 얹거나 탕감)
      if (s.cash < carry && (s.lev || ASSETS.some(a => a.kind === 'stock' && s.hold[a.id].units > 0))) { sellAll(s); closed.push('주식 · 코인'); }
      if (s.cash < carry && propCount(s) > 0) { sellProps(s); closed.push('상가'); }
      const more = Math.min(Math.max(0, s.cash), carry); s.cash -= more; carry -= more; repaid += more;
    }
    creditAdd(s, -T.credit_evict, '압류', 'pay'); // 아래 집에 새로 지는 대출의 이자는 깎인 뒤의 등급으로 정해진다
    if (to >= OWN) {
      price = homePrice(s, to);
      const pay = Math.min(s.cash, price);
      loan = price - pay + carry;
      if (loan > price) { left = loan - price; carry -= left; loan = price; }
      s.cash -= pay; s.homeVal = price; s.loan = loan > 0 ? { balance: loan, orig: loan, day: s.day, rate: mortRate(s) } : null; s.lease = 'own';
    } else { left = carry; carry = 0; s.lease = 'rent'; s.deposit = Math.min(Math.max(0, s.cash), depositFor(s, to, 'rent')); s.cash -= s.deposit; } // 내 집에서 밀리면 원룸 월세로 (남은 빚은 탕감, 보증금은 있는 만큼만)
    s.tier = to; s.movedDay = s.day + 1; s.combo = 0; s.stats.foreclosed = (s.stats.foreclosed || 0) + 1;
    ev(s, 'foreclose', { from, to, sold, repaid, carried: carry, left, loan, lost: w0 - worth(s), closed });
    ev(s, 'tier', { from, to, name: HOMES[to].name, up: false });
    const fn = HOMES[from].name, tn = HOMES[to].name;
    const text = '원리금 · 고정비를 두 번 연속 못 내 ' + fn + jo(fn, '이', '가') + ' 압류되었습니다. ' + won(sold) + '에 팔려 대출과 빚 ' + won(repaid) + '을 갚고 ' + tn
      + (to >= OWN ? jo(tn, '으로', '로') + ' 옮겼습니다.' + (loan ? ' 대출 ' + won(loan) + (carry ? '(못 갚은 빚 ' + won(carry) + ' 포함)' : '') + '을 새로 나눠 갚습니다.' : '') : '으로 내려갑니다.')
      + (closed.length ? ' 모자란 빚은 ' + closed.join(' · ') + '을 그 자리 값에 팔아 갚았습니다.' : '') + (left > 0 ? ' 못 갚은 ' + won(left) + '은 탕감되었습니다.' : '');
    notes.push({ tone: 'bad', text }); sys(s, text, 'bad');
  }

  function sellAll(s) { // 압류 · 쫓겨남: 코인 포지션과 주식을 그 자리 값에 정리
    if (s.lev) { const v = Math.round(levValue(s)); s.cash += v; s.stats.trade += v - s.lev.put; s.lev = null; }
    for (const a of ASSETS) if (a.kind === 'stock' && s.hold[a.id].units > 0) { const h = s.hold[a.id], v = Math.round(holdValue(s, a.id)); s.cash += v; s.stats.trade += v - Math.round(h.cost); h.units = 0; h.cost = 0; h.min = 0; } // min: 배당은 내내 들고 있던 만큼만 — 다 팔렸으면 0
  }
  function sellProps(s) { // 압류 · 쫓겨남: 가진 상가를 그 자리 시세에 팔아(중개비를 떼고) 현금으로. 돌려주는 값 = 들어온 돈
    let got = 0;
    for (const p of PROPS) if (s.props && s.props[p.id]) { const price = propPrice(s, p), net = price - round1k(price * T.prop_fee); s.cash += net; got += net; delete s.props[p.id]; }
    return got;
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

  // ── 가게: 사 먹기(하루 한 번) · 옷 · 살림 · 사치품 (칸을 쓰지 않는다) ──
  const foodCost = (s, f) => (f.scale ? sc(s, T[f.cost]) : T[f.cost]);
  const SPEND_AT = [100000, 1000000, 10000000, 100000000, 1000000000]; // 소비 실적: 가게에서 쓴 돈이 이만큼을 넘을 때마다 신용점수가 오른다
  function spendTick(s, cost) {
    s.spent = (s.spent || 0) + cost;
    const n = SPEND_AT.filter(x => s.spent >= x).length;
    if (n > (s.crSpend || 0)) { const up = n - (s.crSpend || 0); s.crSpend = n; creditAdd(s, T.credit_spend * up, '가게 소비 실적 ' + n + '단계', 'mix'); }
  }
  function eat(s, id) {
    const f = byId(FOODS, id);
    if (!canFree(s) || !f) return fail(s, '지금은 사 먹을 수 없습니다 (낮에만)');
    if (s.ate === s.day) return fail(s, '오늘은 이미 사 먹었습니다 (하루 한 번)');
    const cost = foodCost(s, f), before = s.hp;
    if (s.cash < cost) return fail(s, '현금이 ' + won(cost - s.cash) + ' 모자랍니다');
    expense(s, '사 먹기 (' + f.name + ')', cost); s.hp = Math.min(hpMax(s), s.hp + T[f.hp]); s.ate = s.day; s.stats.meals = (s.stats.meals || 0) + 1; spendTick(s, cost);
    ev(s, 'eat', { id, name: f.name, hp: s.hp - before, cost });
    after(s);
    return true;
  }
  function buyItem(s, id) {
    const it = byId(ITEMS, id);
    if (!canFree(s) || !it) return fail(s, '지금은 살 수 없습니다 (낮에만)');
    if (has(s, id)) return fail(s, '이미 가지고 있습니다');
    if (topTier(s) < it.tier) return fail(s, HOMES[it.tier].name + '부터 살 수 있습니다');
    const cost = T['cost_' + id];
    if (s.cash < cost) return fail(s, '현금이 ' + won(cost - s.cash) + ' 모자랍니다');
    expense(s, it.name, cost); (s.items || (s.items = {}))[id] = 1; s.stats.shopSpent = (s.stats.shopSpent || 0) + cost;
    if (it.cat === 'wear') s.wear = id; // 산 옷은 바로 입는다
    if (id === 'ginseng') s.hp = Math.min(hpMax(s), s.hp + T.item_ginseng); // 늘어난 만큼은 채워 줌
    if (id === 'car') s.hp = Math.min(hpMax(s), s.hp + T.item_car);
    if (id === 'watch') creditAdd(s, T.item_watch, '손목시계', 'asset');
    spendTick(s, cost);
    ev(s, 'item', { id, name: it.name, cat: it.cat, cost });
    sys(s, it.name + jo(it.name, '을', '를') + ' 샀습니다 — ' + it.desc() + '.', 'good');
    after(s);
    return true;
  }
  function wear(s, id) { // 옷 갈아입기 ('' = 처음부터 입던 후드티). 효과는 입은 한 벌만
    if (!canFree(s)) return false;
    id = id || '';
    if (id && !(has(s, id) && (byId(ITEMS, id) || {}).cat === 'wear')) return fail(s, '가지고 있지 않은 옷입니다');
    s.wear = id; ev(s, 'wear', { id });
    after(s);
    return true;
  }
  function setLook(s, n) { n = Math.round(Number(n)); if (!(n >= 0 && n <= 3)) return false; s.look = n; return true; } // 후드티 색 (꾸미기만, 효과 없음)
  function shopView(s) {
    const ate = s.ate === s.day;
    return { ate, wear: s.wear || '', look: s.look || 0,
      foods: FOODS.map(f => { const cost = foodCost(s, f); return { id: f.id, name: f.name, cost, hp: T[f.hp], ok: !ate && s.cash >= cost, why: ate ? '오늘은 이미 사 먹었습니다 (하루 한 번)' : s.cash < cost ? '현금이 ' + won(cost - s.cash) + ' 모자랍니다' : '' }; }),
      items: ITEMS.map(it => { const cost = T['cost_' + it.id], have = has(s, it.id), open = topTier(s) >= it.tier;
        return { id: it.id, cat: it.cat, name: it.name, desc: it.desc(), cost, have, on: s.wear === it.id, open, needTier: it.tier, ok: !have && open && s.cash >= cost, why: have ? '' : !open ? HOMES[it.tier].name + '부터 살 수 있습니다' : s.cash < cost ? '현금이 ' + won(cost - s.cash) + ' 모자랍니다' : '' }; }) };
  }

  // ── 은행: 신용등급 · 마이너스 통장 (이자만 일요일 밤마다, 원금은 아무 때나 갚는다) ──
  function creditView(s) {
    const g = creditGrade(s), limit = clLimit(s), bal = s.cl || 0, rate = clRate(s), score = s.credit == null ? T.credit_start : s.credit;
    const cr = s.cr || {}, use = limit > 0 ? bal / limit : bal > 0 ? 1 : 0, streak = s.crStreak || 0, weeks = s.crWeeks || 0, missed = (s.stats && s.stats.missedTotal) || 0, lost = ((s.stats && s.stats.evicted) || 0) + ((s.stats && s.stats.foreclosed) || 0);
    const toStreak = T.credit_streak_n - (streak % T.credit_streak_n), ageGot = Math.min(T.credit_age_max, Math.floor(weeks / T.credit_age_n)), toAge = ageGot < T.credit_age_max ? T.credit_age_n - (weeks % T.credit_age_n) : 0;
    // 다섯 항목: pts = 지금까지 그 항목에서 오르내린 점수 · state = 지금 상태(좋음 · 보통 · 나쁨) · line = 내 숫자 · tip = 어떻게 오르내리나 · next = 다음에 오를 일
    const factors = [
      { id: 'pay', name: '상환 이력', pts: cr.pay || 0, state: s.missed > 0 || s.arrears > 0 ? 'bad' : streak >= T.credit_streak_n ? 'good' : 'ok',
        line: '제때 ' + (s.rentPaid || 0) + '번 · 연속 ' + streak + '번' + (missed ? ' · 연체 ' + missed + '번' : '') + (lost ? ' · 쫓겨남 · 압류 ' + lost + '번' : ''),
        tip: '정산을 제때 내면 +' + T.credit_ontime + ' · ' + T.credit_streak_n + '번 연속마다 +' + T.credit_streak + ' 더 · 못 내면 −' + T.credit_late + ' · 쫓겨남 · 압류 −' + T.credit_evict,
        next: s.addr ? toStreak + '번 더 제때 내면 +' + T.credit_streak : '주소가 생긴 뒤의 정산부터 쌓인다' },
      { id: 'debt', name: '부채 수준', pts: cr.debt || 0, state: use > T.credit_use_hi ? 'bad' : use > 0.5 ? 'ok' : 'good',
        line: limit > 0 || bal > 0 ? '통장 사용률 ' + Math.round(use * 100) + '%' + (s.loan ? ' · 주담대 ' + Math.ceil(s.loan.balance / (s.loan.orig / T.loan_weeks) - 1e-9) + '회 남음' : '') : '쓰는 통장 없음' + (s.loan ? ' · 주담대 있음' : ''),
        tip: '일요일 밤 통장을 한도의 ' + Math.round(T.credit_use_hi * 100) + '% 넘게 쓰고 있으면 −' + T.credit_use_pen + ' · 주담대를 다 갚으면 +' + T.credit_loan_done,
        next: use > T.credit_use_hi ? '한도의 ' + Math.round(T.credit_use_hi * 100) + '% 아래로 갚아 두면 깎이지 않는다' : '' },
      { id: 'age', name: '거래 기간', pts: cr.age || 0, state: !s.addr ? 'bad' : weeks >= 8 ? 'good' : 'ok',
        line: s.addr ? '주소가 생긴 지 ' + weeks + '주' : '주소 없음',
        tip: '주소가 생기면 +' + T.credit_addr + ' · 그 뒤 ' + T.credit_age_n + '주마다 +' + T.credit_age + ' (' + T.credit_age_max + '번까지)',
        next: !s.addr ? '고시원에 입주하면 +' + T.credit_addr : toAge ? toAge + '주 뒤 +' + T.credit_age : '' },
      { id: 'asset', name: '소득과 자산', pts: cr.asset || 0, state: (cr.asset || 0) >= 100 ? 'good' : (cr.asset || 0) > 0 ? 'ok' : 'bad',
        line: '칭호 — ' + s.title, tip: '순자산이 늘어 칭호가 오를 때마다 +' + T.credit_title + ' · 손목시계 +' + T.item_watch, next: '' },
      { id: 'mix', name: '계약과 소비', pts: cr.mix || 0, state: (cr.mix || 0) >= 80 ? 'good' : (cr.mix || 0) > 0 ? 'ok' : 'bad',
        line: (s.stats && s.stats.jeonse ? '전세 계약 · ' : '') + (s.tier >= OWN && leaseOf(s) === 'own' ? '내 집 · ' : '') + '가게 소비 ' + (s.crSpend || 0) + ' / ' + SPEND_AT.length + '단계',
        tip: '전세 계약 +' + T.credit_contract + ' · 집을 사면 +' + T.credit_home + ' · 가게 소비 ' + won(SPEND_AT[0]) + '부터 열 배마다 +' + T.credit_spend + ' (' + SPEND_AT.length + '번)',
        next: (s.crSpend || 0) < SPEND_AT.length ? '가게에서 ' + won(SPEND_AT[s.crSpend || 0] - (s.spent || 0)) + ' 더 쓰면 +' + T.credit_spend : '' },
    ];
    const row = k => ({ grade: k, name: GRADE_NAME[k], from: k <= 6 ? GRADE_AT[k - 1] : 300, to: k > 1 ? GRADE_AT[k - 2] - 1 : 1000, limit: clLimit(s, null, k), rate: k < 7 ? T['cl_rate_' + k] : 0, ltv: k < 7 ? T['ltv_' + k] : 0, mort: k < 7 ? Math.round(T['cl_rate_' + k] * T.mort_k * 10000) / 10000 : 0, me: k === g });
    return { score, grade: g, name: GRADE_NAME[g], next: g > 1 ? GRADE_AT[g - 2] : 0, toNext: g > 1 ? GRADE_AT[g - 2] - score : 0, limit, balance: bal, room: Math.max(0, limit - bal), rate, week: round1k(bal * rate),
      ltv: ltvOf(s), mort: mortRate(s), open: unlocked(s, 'bank'), bill: bill(s),
      use, streak, weeks, factors, table: [1, 2, 3, 4, 5, 6, 7].map(row), up: g > 1 ? row(g - 1) : null, log: (s.crLog || []).slice().reverse(), base: T.credit_start };
  }
  function borrow(s, amt) {
    if (!canFree(s)) return fail(s, s.den ? '도박장 안에서는 빌릴 수 없습니다' : '지금은 빌릴 수 없습니다 (낮에만)');
    if (!unlocked(s, 'bank')) return fail(s, '주소가 있어야 은행 거래를 할 수 있습니다 (고시원부터)');
    const v = creditView(s);
    if (v.grade >= 7) return fail(s, '신용등급이 낮아 빌릴 수 없습니다 (6등급 = 400점부터)');
    amt = Math.floor(Number(amt) / 10000) * 10000;
    if (!(amt > 0)) return fail(s, '10,000원 단위로 빌립니다');
    if (amt > v.room) return fail(s, v.room > 0 ? '한도가 ' + won(v.room) + ' 남았습니다' : s.tier < 2 ? '주소가 없어 한도가 없습니다' : '한도를 다 썼습니다');
    s.cl = (s.cl || 0) + amt; s.cash += amt; s.stats.borrowed = (s.stats.borrowed || 0) + amt;
    ev(s, 'borrow', { amt, balance: s.cl });
    after(s);
    return true;
  }
  function repayCl(s, amt) {
    if (!canFree(s)) return fail(s, s.den ? '도박장 안에서는 갚을 수 없습니다' : '지금은 갚을 수 없습니다 (낮에만)');
    amt = Math.floor(Math.min(Number(amt), s.cash, s.cl || 0));
    if (!Number.isFinite(amt) || amt <= 0) return fail(s, (s.cl || 0) > 0 ? '현금이 모자랍니다' : '갚을 돈이 없습니다');
    s.cl -= amt; s.cash -= amt;
    ev(s, 'repay', { amt, balance: s.cl, credit: true });
    after(s);
    return true;
  }

  // ── 부동산: 상가 · 건물 (사 두면 일요일 밤마다 임대수익, 값은 시세를 따른다) ──
  function propView(s) {
    const re = s.re || { idx: 1 }, yieldK = T.prop_yield * (dreamOn(s, 'landlord') ? 1 + T.dream_landlord : 1);
    const rows = PROPS.map(p => {
      const o = s.props && s.props[p.id], price = propPrice(s, p), buy = Math.round(price / 10000) * 10000, tax = round1k(buy * T.prop_tax) /* 발품(집 · 사업 값 −)은 상가에 붙지 않는다: 살 때만 깎이면 사고팔기만 해도 남는다 */, cost = buy + tax, open = topTier(s) >= p.tier;
      return { id: p.id, name: p.name, note: p.note, tier: p.tier, price, buy, tax, cost, rent: round1k(price * yieldK), open, have: !!o, vacant: o ? o.vacant || 0 : 0, paid: o ? o.cost : 0, pnl: o ? price - o.cost : 0, sellNet: price - round1k(price * T.prop_fee),
        ok: !o && open && s.cash >= cost, why: o ? '' : !open ? HOMES[p.tier].name + '부터 살 수 있습니다' : s.cash < cost ? '현금이 ' + won(cost - s.cash) + ' 모자랍니다' + (invested(s) > 0 ? ' (투자한 돈은 팔아야 현금)' : '') : '' };
    });
    const acc = studyAcc(s), fc = knowLv(s) >= 4 && re.next != null ? { dir: (re.hint < acc) === (re.next >= 0) ? 1 : -1, acc } : null; // 공부 4단계부터: 다음 일요일에 오를지 내릴지 (리포트만큼 맞는다)
    return { idx: re.idx || 1, last: re.last || 0, hist: (re.hist || [1]).slice(), rows, value: propValue(s), rent: weekIncome(s).rent, forecast: fc, home: s.homeVal || 0, lease: leaseOf(s), deposit: s.deposit || 0, open: unlocked(s, 'realty') };
  }
  function buyProp(s, id) {
    const p = byId(PROPS, id), v = p && propView(s).rows.find(r => r.id === id);
    if (!canFree(s) || !v) return fail(s, '지금은 살 수 없습니다 (낮에만)');
    if (!v.ok) return fail(s, v.why || '이미 가지고 있습니다');
    s.cash -= v.buy; expense(s, p.name + ' 취득세 · 중개비', v.tax); // 값은 자산으로 남고, 세금 · 중개비만 쓴 돈
    s.props[id] = { cost: v.buy, day: s.day, vacant: 0 }; s.stats.props = (s.stats.props || 0) + 1;
    ev(s, 'prop', { side: 'buy', id, name: p.name, amt: v.buy, tax: v.tax, rent: v.rent });
    sys(s, p.name + jo(p.name, '을', '를') + ' 샀습니다. ' + won(v.buy) + ' + 취득세 · 중개비 ' + won(v.tax) + '. 일요일 밤마다 임대수익 ' + won(v.rent) + '쯤이 들어옵니다 (비면 0).', 'good');
    after(s);
    return true;
  }
  function sellProp(s, id) {
    const p = byId(PROPS, id), o = p && s.props && s.props[id];
    if (!canFree(s) || !o) return fail(s, o ? '지금은 팔 수 없습니다 (낮에만)' : '가진 건물이 아닙니다');
    const price = propPrice(s, p), fee = round1k(price * T.prop_fee), pnl = price - fee - o.cost;
    s.cash += price; expense(s, p.name + ' 중개비 · 세금', fee); delete s.props[id];
    s.stats.propGain = (s.stats.propGain || 0) + pnl; s.stats.trade += pnl;
    ev(s, 'prop', { side: 'sell', id, name: p.name, amt: price - fee, pnl });
    profitXp(s, pnl);
    after(s);
    return true;
  }

  // ── 꿈: 고른 꿈의 장면이 조건이 되면 한 번씩 뜬다 ──
  const dreamOf = s => byId(DREAMS, s.dream) || DREAMS[0];
  function setDream(s, id) { if (s.dreamSet || !byId(DREAMS, id)) return false; s.dream = id; s.dreamSet = 1; ev(s, 'dream_set', { id }); return true; } // 판을 시작할 때 한 번
  function dreamTick(s) {
    if (s.ended || !s.dream) return;
    const d = dreamOf(s); s.beats = s.beats || [];
    d.beats.forEach((b, i) => {
      const key = d.id + (i + 1);
      if (s.beats.indexOf(key) >= 0 || (i > 0 && s.beats.indexOf(d.id + i) < 0) || !b.when(s)) return; // 장면은 차례로
      s.beats.push(key);
      ev(s, 'dream', { id: d.id, n: i + 1, of: d.beats.length, name: d.name, text: b.text, gain: b.gain ? b.gain() : '' });
      gainXp(s, 30);
    });
  }
  function dreamView(s) { const d = dreamOf(s), done = (s.beats || []).filter(k => k.indexOf(d.id) === 0).length; return { id: d.id, set: !!s.dream, name: d.name, line: d.line, intro: d.intro, done, of: d.beats.length, end: d.end, gain: d.beats[1].gain(), on: dreamOn(s, d.id) }; }
  const dreamList = () => DREAMS.map(d => ({ id: d.id, name: d.name, line: d.line, intro: d.intro, gain: d.beats[1].gain() }));


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
    if (to < OWN) { const i = moveInfo(s, to), have = to === 1 ? s.cash : i.have; return { tier: to, name: HOMES[to].name, kind: 'home', price: i.need, need: i.need, have, pct: i.need > 0 ? clamp(have / i.need, 0, 1) : 1, canBuy: i.ok }; }
    const i = homeInfo(s, to), j = HOMES[to].lease.indexOf('jeonse') >= 0 ? homeInfo(s, to, 'jeonse') : null, need = j ? Math.min(i.down, j.down) : i.down; // 전세로도 갈 수 있으면 둘 중 적게 드는 쪽
    return { tier: to, name: HOMES[to].name, kind: 'home', price: i.price, need, have: s.cash, pct: need ? clamp(s.cash / need, 0, 1) : 1, canBuy: i.ok || !!(j && j.ok), loanMax: i.loanMax, jeonse: j ? j.deposit : 0, ltv: i.ltv };
  }

  // ── 밤: 하루 마치기 ─────────────────────────────────────────
  function endDay(s) {
    if (s.ended || s.phase !== 'day' || s.slot < 3 || s.den) return false;
    const notes = [], hpBefore = s.hp, sunday = s.day % 7 === 0, inHosp = s.hosp === s.day, credit0 = s.credit;
    let billed = null;
    const b = bill(s), got = sunday ? payWeekly(s) : null; // 일요일 밤: 임대수익 · 배당은 낼 것이 없어도(찜질방) 들어오고, 배당의 기준 수량을 새로 잡는다
    if (b && b.inDays === 0 && b.amt > 0) { // 일요일 밤 정산: 들어올 돈(임대수익 · 배당)이 먼저, 그다음 고정비 + 원리금 + 이자 (끼니는 고시원부터 고정비에 들어 있음)
      const home = HOMES[s.tier].name, own = s.tier >= OWN && leaseOf(s) === 'own', name = billName(b);
      if (s.cash < b.amt) { // 모자라면 마이너스 통장에서, 한도 안에서 다 메울 수 있을 때만 자동으로 빌려 낸다
        const room = clLimit(s) - (s.cl || 0), x = Math.ceil((b.amt - s.cash) / 10000) * 10000;
        if (x > 0 && x <= room) { s.cl = (s.cl || 0) + x; s.cash += x; s.stats.borrowed = (s.stats.borrowed || 0) + x; ev(s, 'borrow', { amt: x, balance: s.cl, auto: true }); notes.push({ tone: 'warn', text: '현금이 모자라 마이너스 통장에서 ' + won(x) + '을 빌려 냈습니다 (한 주 이자 ' + (Math.round(clRate(s) * 1000) / 10) + '%).' }); }
      }
      if (s.cash >= b.amt) {
        const old = s.arrears;
        s.cash -= old; expense(s, home + ' 고정비', b.week); s.stats.fixed += b.amt; s.arrears = 0; s.missed = 0; s.rentPaid++;
        if (b.loan) { expense(s, '주담대 이자', b.interest); s.cash -= b.principal; s.loan.balance -= b.principal; s.stats.loanPaid = (s.stats.loanPaid || 0) + 1; } // 원금은 빚이 줄어드는 만큼이라 순자산은 그대로
        if (b.credit) expense(s, '마이너스 통장 이자', b.credit);
        billed = { paid: true, amt: b.amt, name, loan: b.loan, credit: b.credit, days: b.days, income: got.total, foreclosed: false };
        if (old) notes.push({ tone: 'good', text: '밀린 돈 ' + won(old) + '도 함께 갚았습니다.' });
        if (s.loan && s.loan.balance <= 0) loanGone(s);
        if (s.tier >= 2) { // 주소가 있는 곳의 정산만 신용이 된다
          creditAdd(s, T.credit_ontime, '정산을 제때 냄', 'pay'); s.crStreak = (s.crStreak || 0) + 1;
          if (T.credit_streak && s.crStreak % T.credit_streak_n === 0) creditAdd(s, T.credit_streak, '정산을 ' + s.crStreak + '번 연속 제때 냄', 'pay');
        }
      } else {
        const noAddr = s.tier < 2, owed = noAddr ? b.amt : round1k(b.amt * (1 + T.late_fee)); // 주소가 없는 곳(서울역 · 찜질방)의 외상 · 남은 빚은 그대로 남기만 한다 — 연체료 · 신용 감점 · 쫓겨남 셈 없음 (갚을 길이 생길 때까지 불어나지 않게)
        if (b.principal) s.loan.balance -= b.principal; // 못 낸 원금은 대출에서 빚으로 옮겨 간다
        add(s.today.expense, (b.week ? home + ' ' : '') + name + ' (못 내서 빚)', owed - s.arrears - b.principal); // 현금은 안 나갔지만 순자산은 그만큼 줄었다
        s.arrears = owed;
        if (!noAddr) { s.missed++; s.stats.missedTotal = (s.stats.missedTotal || 0) + 1; s.crStreak = 0; creditAdd(s, -T.credit_late, '정산을 못 냄', 'pay'); }
        const out = s.missed >= 2 && s.tier >= 2;
        billed = { paid: false, amt: b.amt, name, loan: b.loan, credit: b.credit, days: b.days, arrears: owed, income: got.total, evicted: out && !own, foreclosed: out && own };
        if (out) { if (own) foreclose(s, notes); else evict(s, notes); }
        else if (noAddr) notes.push({ tone: 'bad', text: '갚을 돈 ' + won(b.amt) + '을 못 냈습니다. 빚으로 남아 다음 일요일 밤에 다시 나갑니다 (주소가 없는 동안은 연체료가 붙지 않습니다).' });
        else notes.push({ tone: 'bad', text: name + ' ' + won(b.amt) + '을 못 냈습니다. 연체료가 붙어 빚 ' + won(owed) + '이 되었고 다음 일요일에 함께 내야 합니다. 신용점수도 깎였습니다.' + (s.tier >= 2 ? ' 한 번 더 밀리면 ' + (own ? '집이 압류되어 한 단계 아래로 내려갑니다.' : '쫓겨납니다.') : '') });
        if (!out && s.loan && s.loan.balance <= 0) loanGone(s, true); // 경고 뒤에 따로: 마지막 원금까지 빚으로 넘어가 대출은 정리 (빚은 arrears 로 남음)
      }
    }
    if (sunday && s.addr) { // 신용의 주간 셈: 거래 기간(주소가 생긴 뒤 몇 주마다) · 부채 수준(통장을 한도 가까이 쓰고 있으면)
      s.crWeeks = (s.crWeeks || 0) + 1;
      if (T.credit_age && s.crWeeks % T.credit_age_n === 0 && s.crWeeks / T.credit_age_n <= T.credit_age_max) creditAdd(s, T.credit_age, '거래 기간 ' + s.crWeeks + '주', 'age');
      const lim = clLimit(s);
      // 한도가 0 인 7등급은 재지 않는다 (갚아 나가는 사람을 매주 더 깎지 않게)
      if (s.cl > 0 && T.credit_use_pen && lim > 0 && s.cl / lim > T.credit_use_hi) { creditAdd(s, -T.credit_use_pen, '통장을 한도 가까이 씀', 'debt'); notes.push({ tone: 'warn', text: '마이너스 통장을 한도의 ' + Math.round(T.credit_use_hi * 100) + '% 넘게 쓰고 있어 신용점수가 ' + T.credit_use_pen + '점 깎였습니다.' }); }
    }
    if (sunday) s.clAcc = 0; else if (s.cl > 0) s.clAcc = (s.clAcc || 0) + s.cl * clRate(s) / 7; // 마이너스 통장 이자: 밤마다 그날 잔액의 몫이 쌓이고 일요일 정산에서 걷는다 (정산에 들어갔으면 0 으로)
    if (sunday) reTick(s, notes); // 부동산 시세가 움직이고 상가 세입자가 드나든다 (정산 뒤에 · 누구에게나 같은 시세)
    if (s.tier === 1 && !(billed && billed.evicted) && !inHosp) { // 고시원에서 쫓겨난 그 밤은 찜질방 요금을 안 받는다 (한 번에 한 단계만)
      if (s.cash >= saunaCost(s)) { expense(s, '찜질방', saunaCost(s)); s.stats.saunaNights = (s.stats.saunaNights || 0) + 1; }
      else { s.tier = 0; notes.push({ tone: 'bad', text: '찜질방 요금이 없어 서울역에서 잤습니다.' }); ev(s, 'tier', { from: 1, to: 0, name: HOMES[0].name, up: false }); }
    }
    if (inHosp) notes.push({ tone: 'bad', text: '병원에서 밤을 보냈습니다. 내일 오전은 퇴원 수속으로 지나갑니다.' });
    else if (s.tier < 2) {
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
    const sleep = sleepGain(s), hpMid = s.hp, wpen = worldSleepPen(s);
    const wLost = Math.min(wpen, sleepRaw(s)), eLost = s.buff.sleepPen > 0 ? Math.min(T.ev_sleep_pen, sleepRaw(s) - wLost) : 0; // 안내에는 실제로 깎인 만큼만 (회복은 0 아래로 안 내려간다)
    if (wpen > 0) notes.push({ tone: 'bad', text: worldNow(s).def.name + ' 때문에 잠을 설쳤습니다. 회복 −' + wLost + ' (' + HOMES[worldNow(s).def.sleep.tier + 1].name + '부터는 괜찮습니다).' });
    if (s.buff.sleepPen > 0) { notes.push({ tone: 'bad', text: '잠을 설쳤습니다.' + (eLost > 0 ? ' 회복 −' + eLost : '') }); if (--s.buff.sleepPen <= 0) delete s.buff.sleepPen; }
    s.hp = Math.min(hpMax(s), s.hp + sleep);
    gainXp(s, T.xp_day);
    const w = worth(s), labor = sum(s.today.income), spent = sum(s.today.expense), goal = goalView(s);
    s.last = {
      day: s.day, income: s.today.income, expense: s.today.expense, labor, spent,
      invest: w - s.today.startWorth - labor + spent, worthStart: s.today.startWorth, worthEnd: w,
      hp: { before: hpBefore, mid: hpMid, after: s.hp, sleep: s.hp - hpMid }, home: HOMES[s.tier].name, notes, billed, reports: checked,
      credit: { from: credit0, to: s.credit, grade: creditGrade(s) }, re: sunday ? { pct: s.re.last || 0, idx: s.re.idx } : null, hosp: inHosp, // 밤사이 신용점수 · 일요일의 부동산 시세 · 병원에서 잔 밤 // reports: [{ asset, name, said, real, right, by: 'study'|'tip'|'chat' }]
      house: { price: goal.price, pct: goal.pct }, goal, lastDay: false, // house: 예전 이름 (다음 목표의 값 · 진행률). 기한이 없어 lastDay 는 늘 false
    };
    s.phase = 'night';
    ev(s, 'night', {});
    return true;
  }
  function payWeekly(s) { // 일요일 밤: 임대수익과 배당이 먼저 들어온다
    const w = weekIncome(s);
    if (w.rent) { income(s, '임대수익', w.rent); s.stats.rent = (s.stats.rent || 0) + w.rent; }
    if (w.div) { income(s, '배당 (튼튼은행)', w.div); s.stats.div = (s.stats.div || 0) + w.div; }
    const h = s.hold.bank; if (h) h.min = h.units; // 다음 배당은 지금부터 내내 들고 있던 만큼
    return w;
  }
  // 부동산 시세: 호황 · 보합 · 침체가 몇 주씩 이어진다. 다음 일요일에 움직일 만큼(next)을 미리 정해 둔다 — 공부 4단계의 전망이 이것을 본다
  function reNext(s) {
    const re = s.re;
    if (!(re.left > 0)) { const x = rnd(s); re.trend = x < 0.3 ? 1 : x < 0.75 ? 0 : -1; re.left = T.re_min + Math.floor(rnd(s) * (T.re_max - T.re_min + 1)); }
    re.left--; re.next = (re.trend > 0 ? T.re_boom : re.trend < 0 ? T.re_slump : T.re_flat) + T.re_sigma * gauss(s); re.hint = rnd(s);
  }
  function reTick(s, notes) { // 일요일 밤: 시세가 움직이고(집 · 상가 값 · 뚝딱건설이 따라감) 상가 세입자가 나가거나 들어온다
    const re = s.re, d = re.next || 0, was = re.idx || 1, m = s.market;
    re.idx = clamp(was * Math.exp(d), 0.4, 4); re.last = re.idx / was - 1; (re.hist = re.hist || [1]).push(re.idx); if (re.hist.length > 40) re.hist.shift();
    if (s.homeVal) s.homeVal = Math.round(s.homeVal * re.idx / was / 10000) * 10000;
    const mv = { build: T.bd_beta * d, etf: T.bd_beta * d / BASKET.length, inv: -T.bd_beta * d / BASKET.length }; // 뚝딱건설이 따라가고, 그것을 담은 ETF 둘도 그 몫만큼
    for (const id in mv) { m.px[id] = Math.max(FLOOR, m.px[id] * Math.exp(mv[id])); const h = m.hist[id]; h[h.length - 1] = m.px[id]; } // 차트의 마지막 점을 옮긴다 (하루 3점을 지키려고)
    for (const p of PROPS) { // 공실 굴림은 플레이어 쪽 난수 (가진 건물 수가 시세 난수를 흔들지 않게)
      const o = s.props && s.props[p.id];
      if (!o) continue;
      if (o.vacant > 0) { if (--o.vacant === 0) notes.push({ tone: 'good', text: p.name + '에 새 세입자가 들어왔습니다.' }); }
      else if (rnd3(s) < T.prop_vacant_p) { o.vacant = 1 + Math.floor(rnd3(s) * 2); notes.push({ tone: 'bad', text: p.name + ' 세입자가 나갔습니다. ' + o.vacant + '주 동안 임대수익이 없습니다.' }); }
    }
    reNext(s);
    ev(s, 're', { pct: re.last, idx: re.idx });
  }
  function evict(s, notes) { // 셋집(월세 · 전세)에서 두 번 연속 못 냄: 보증금을 돌려받아 밀린 돈을 갚고 한 단계 아래로
    const from = s.tier, hadLev = !!s.lev, hadStock = ASSETS.some(a => a.kind === 'stock' && s.hold[a.id].units > 0), refund = s.deposit || 0;
    s.cash += refund; s.deposit = 0;
    if (s.lev && from - 1 < 3) { const v = Math.round(levValue(s)); s.cash += v; s.stats.trade += v - s.lev.put; s.lev = null; } // 코인은 원룸부터: 그 아래로 내려가면 먼저 정리
    const short = s.cash < s.arrears;
    if (short) sellAll(s); // 빚은 현금에서, 모자라면 주식부터 정리해 갚는다
    const soldProps = s.cash < s.arrears && propCount(s) > 0; if (soldProps) sellProps(s); // 그래도 모자라면 상가도 (다른 재산을 두고 빚을 탕감하지 않는다)
    const paid = Math.min(Math.max(0, s.cash), s.arrears), left = s.arrears - paid;
    s.cash -= paid; s.arrears = 0; s.missed = 0;
    creditAdd(s, -T.credit_evict, '쫓겨남', 'pay'); // 내려앉은 곳이 내 집이면 그 대출의 이자는 깎인 뒤의 등급으로
    s.tier = from - 1; // 한 단계 아래로. 내려간 곳의 계약: 내 집이면 그 자리에서 사고(모자라면 대출), 전세 · 월세면 있는 돈만큼 보증금을 건다
    if (s.tier === OWN) { const price = homePrice(s, OWN), pay = Math.min(Math.max(0, s.cash), price), loan = price - pay; s.cash -= pay; s.homeVal = price; s.loan = loan > 0 ? { balance: loan, orig: loan, day: s.day, rate: mortRate(s) } : null; s.lease = 'own'; }
    else if (s.tier > OWN) { const dep = Math.min(Math.max(0, s.cash), depositFor(s, s.tier, 'jeonse')); s.cash -= dep; s.deposit = dep; s.lease = 'jeonse'; }
    else if (s.tier >= 2) { const dep = Math.min(Math.max(0, s.cash), depositFor(s, s.tier, 'rent')); s.cash -= dep; s.deposit = dep; s.lease = 'rent'; }
    else s.lease = '';
    s.movedDay = s.day + 1; s.stats.evicted = (s.stats.evicted || 0) + 1; s.combo = 0;
    const to = HOMES[s.tier].name, sold = hadStock && short, closed = [hadLev && !s.lev ? '코인 포지션' : '', sold ? '주식' : '', soldProps ? '상가' : ''].filter(Boolean); // 알림 글은 실제로 일어난 일만
    notes.push({ tone: 'bad', text: '정산을 두 번 연속 못 내 ' + HOMES[from].name + '에서 쫓겨났습니다. ' + (refund ? '보증금 ' + won(refund) + '을 돌려받아 ' : '') + (paid > 0 ? '빚 ' + won(paid) + '을 갚고 ' : '') + to + jo(to, '으로', '로') + ' 내려갑니다.'
      + (closed.length ? ' ' + closed.join(' · ') + jo(closed[closed.length - 1], '은', '는') + ' 그 자리 값에 팔아 현금으로 바꿨습니다.' : '') + (left > 0 ? ' 못 갚은 ' + won(left) + '은 탕감되었습니다.' : '') + (s.tier === 1 ? ' 오늘 밤 찜질방 요금은 받지 않습니다.' : '') });
    ev(s, 'tier', { from, to: s.tier, name: to, up: false, lease: s.lease, deposit: s.deposit || 0 });
  }
  function nextDay(s) {
    if (s.ended || s.phase !== 'night') return false; // 기한은 없다 ("N일째"로만 센다)
    const quest0 = s.quest;
    s.day++; s.slot = 0; s.phase = 'day';
    s.market.news = s.market.news.filter(n => n.day >= s.day); s.market.shocks = s.market.shocks.filter(k => k.day >= s.day);
    s.market.world = (s.market.world || []).filter(w => worldEnd(w) >= s.day);
    s.market.brief = s.market.intel && s.market.intel.day === s.day ? s.market.intel : null; s.market.intel = null; // 어제 읽은 리포트는 오늘 소식 옆에 붙는다
    genNews(s, s.day + 1); // 내일 것을 먼저 정한다 — 내일 날씨 예보는 오늘 아침 값에 미리 들어간다
    openGap(s);
    if (perk(s, 'early')) s.hp = Math.min(hpMax(s), s.hp + T.perk_early * perk(s, 'early'));
    beginDay(s);
    ev(s, 'day', { day: s.day });
    const struck = worldTick(s); // 오늘 닥친 세상 사건 · 내일 예보
    if (s.buff && s.buff.promo === s.day && autoPay(s) > 0) ev(s, 'promo', { pct: T.job_tv_promo }); // 어제 방송이 잘 나갔다: 오늘 사업 매출이 는다 (아침에 한 번 알림)
    if (perk(s, 'tipster')) tipster(s);
    const b = bill(s);
    if (b && b.inDays === 0 && b.amt > 0) sys(s, '오늘 밤 ' + billName(b) + ' ' + won(b.amt) + '이 나갑니다.' + (b.income ? ' 들어올 돈(임대수익 · 배당) ' + won(b.income) + '.' : '') + ' 현금으로 준비하세요.', 'warn');
    if (knowLv(s) >= 5) for (const k of s.market.shocks) if (k.day === s.day && visible(s, k.asset)) { const nm = byId(ASSETS, k.asset).name; ev(s, 'alert', { asset: k.asset, name: nm }); sys(s, '속보 경보: 오늘 ' + nm + '에 큰 소식이 터질 수 있습니다 (어느 쪽인지는 모릅니다).', 'warn'); } // 공부 5단계부터
    if (s.sick === s.day) { sys(s, '퇴원 수속으로 오전이 지나갔습니다.', 'warn'); ev(s, 'sick', {}); autoIncome(s); endSlot(s); } // 쓰러진 다음 날: 오전 칸을 잃는다
    if (unlocked(s, 'stock')) for (const n of todayNews(s)) if (n.asset !== 'coin' || unlocked(s, 'coin')) ev(s, 'news', { news: n });
    after(s);
    if (s.quest === quest0 && !s.offer && !struck) rollEvent(s); // 퀘스트 완료 · 특성 고르기 · 세상 사건이 뜨는 아침에는 돌발 사건을 겹치지 않는다
    return true;
  }
  const sum = rows => rows.reduce((a, r) => a + r.amt, 0);

  // ── 칭호 · 퀘스트 ───────────────────────────────────────────
  function titleTick(s) {
    const w = worth(s); let t = TITLES[0][1];
    for (const [at, name] of TITLES) if (w >= at) t = name;
    const rank = n => TITLES.findIndex(x => x[1] === n);
    if (rank(t) > rank(s.title)) { s.title = t; sys(s, '칭호 획득: ' + t + '.', 'good'); creditAdd(s, T.credit_title, '칭호가 오름', 'asset'); }
  }
  const totalJobs = s => s.stats.jobsDone || 0;
  const qamt = (s, amt) => round1k(amt * scale(s) * (1 + T.perk_quest * perk(s, 'quester'))); // 사는 곳에 따라 커진다
  const qcash = (s, amt) => income(s, '퀘스트 보상', qamt(s, amt));
  const FIRST_MEAL_HP = 10;
  const QUESTS = [
    { id: 'first_job', title: '첫 끼니를 벌어라', desc: '알바를 한 번 해낸다. 전단지가 가볍다.', cur: s => Math.min(1, totalJobs(s)), goal: () => 1, unit: '회',
      rewardHp: FIRST_MEAL_HP, reward: s => { s.hp = Math.min(hpMax(s), s.hp + FIRST_MEAL_HP); }, rtext: '삼각김밥 (체력 +' + FIRST_MEAL_HP + ')' },
    { id: 'survive', title: '오늘을 버텨라', desc: '세 칸을 다 쓰고 "하루 마치기"로 밤을 넘긴다.', cur: s => (s.day > 1 ? 1 : 0), goal: () => 1, unit: '일',
      reward: s => qcash(s, T.q_survive_cash), rtext: s => won(qamt(s, T.q_survive_cash)) },
    { id: 'roof', title: '지붕 아래에서 자라', desc: '찜질방으로 옮긴다. 자고 나면 체력이 더 많이 돌아오고, 폰으로 주식 계좌를 연다.', cur: s => (s.tier >= 1 ? 1 : 0), goal: () => 1, unit: '', go: 'move',
      reward: s => { s.hp = Math.min(hpMax(s), s.hp + 10); }, rtext: '체력 +10' },
    { id: 'meal', title: '든든하게 먹어라', desc: '가게에서 밥을 한 번 사 먹는다. 하루 한 번, 칸을 쓰지 않고 돈으로 체력을 채운다. 체력이 모자란 채 무리하면 쓰러진다.', cur: s => Math.min(1, s.stats.meals || 0), goal: () => 1, unit: '회', go: 'shop',
      skip: s => s.tier >= 3, reward: s => qcash(s, T.q_meal_cash), rtext: s => won(qamt(s, T.q_meal_cash)) },
    { id: 'first_stock', title: '첫 주식을 사라', desc: '아무 주식이나 한 주 이상(50,000원어치) 산다. 대장전자가 얌전하고, 튼튼은행은 일요일마다 배당을 준다.', cur: s => Math.min(s.stats.bought, 50000), goal: () => 50000, unit: '원', go: 'stock',
      skip: s => s.tier >= 3, reward: s => qcash(s, T.q_stock_cash), rtext: s => won(qamt(s, T.q_stock_cash)) },
    { id: 'address', title: '주소를 만들어라', desc: () => '예치금 ' + won(T.gosiwon_dep) + '을 모아 고시원에 입주한다. 예치금은 나갈 때 돌려받는다. 주소가 있어야 은행이 상대해 준다.', cur: s => (s.tier >= 2 ? T.gosiwon_dep : clamp(s.cash, 0, T.gosiwon_dep)), goal: () => T.gosiwon_dep, unit: '원', go: 'move',
      done: s => s.tier >= 2, reward: () => { }, rtext: '배달 알바 · 은행 · 종목 둘 더 열림' },
    { id: 'study', title: '내일을 미리 읽어라', desc: () => '한 칸과 체력 ' + T.study_hp + '을 "공부"에 쓴다. 고른 종목의 내일 소식이 오르는 쪽인지 내리는 쪽인지 리포트가 알려 준다 (' + accText(T.study_acc) + '). 공부가 쌓이면 단계가 올라 더 잘 맞는다.', cur: s => Math.min(1, s.studied), goal: () => 1, unit: '회',
      skip: s => s.tier >= 3, reward: s => qcash(s, T.q_study_cash), rtext: s => won(qamt(s, T.q_study_cash)) },
    { id: 'gain', title: '수익을 실현하라', desc: '오른 주식을 팔아 이익 50,000원 이상을 확정한다. 팔기 전까지는 내 돈이 아니다.', cur: s => Math.min(s.stats.gain, 50000), goal: () => 50000, unit: '원', go: 'stock',
      skip: s => s.tier >= 3, reward: s => qcash(s, T.q_gain_cash), rtext: s => won(qamt(s, T.q_gain_cash)) },
    { id: 'pump', title: '세력에 올라타라', desc: '한탕바이오에 "거래량" 알림이 뜨면 누가 사 모으는 중이다. 진짜면 급등하고, 아니면 털고 폭락한다. 폭락 전에 팔아 이익 100,000원 이상.', cur: s => Math.min(s.stats.htGain || 0, 100000), goal: () => 100000, unit: '원', go: 'stock',
      skip: s => s.tier >= 3, reward: s => qcash(s, T.q_pump_cash), rtext: s => won(qamt(s, T.q_pump_cash)) },
    { id: 'credit', title: '신용을 쌓아라', desc: '일요일 밤 정산을 제때 내면 신용점수가 오르고, 밀리면 크게 깎인다. 500점(5등급)이 되면 마이너스 통장의 한도가 늘고 이자가 내려간다.', cur: s => Math.min(s.credit || 0, 500), goal: () => 500, unit: '점', go: 'bank',
      skip: s => s.tier >= OWN, reward: s => qcash(s, T.q_worth_cash), rtext: s => won(qamt(s, T.q_worth_cash)) },
    { id: 'oneroom', title: '원룸으로 올라가라', desc: () => '원룸에 입주한다. 월세는 보증금 ' + won(T.oneroom_dep) + '에 주 고정비 ' + won(T.oneroom_week) + ', 전세는 보증금 ' + won(T.oneroom_jeonse) + '에 주 ' + won(T.oneroom_jweek) + '. 보증금은 나갈 때 돌려받는다.',
      cur: s => (s.tier >= 3 ? T.oneroom_dep : clamp(s.cash + (s.deposit || 0), 0, T.oneroom_dep)), goal: () => T.oneroom_dep, unit: '원', go: 'move',
      done: s => s.tier >= 3, reward: () => { }, rtext: '코인 · 레버리지 · 부동산 열림' },
    { id: 'jeonse', title: '전세로 갈아타라', desc: () => '보증금 ' + won(T.oneroom_jeonse) + '을 모아 원룸을 전세로 바꾼다. 매주 나가는 돈이 ' + won(T.oneroom_week) + '에서 ' + won(T.oneroom_jweek) + '으로 줄고, 보증금은 나갈 때 그대로 돌려받는다.',
      cur: s => (s.stats.jeonse || s.tier >= OWN ? T.oneroom_jeonse : clamp(s.cash + (s.deposit || 0), 0, T.oneroom_jeonse)), goal: () => T.oneroom_jeonse, unit: '원', go: 'jeonse',
      done: s => !!s.stats.jeonse, skip: s => s.tier >= OWN || s.cash + (s.deposit || 0) >= housePrice(s), reward: () => { }, rtext: () => '고정비가 준다 · 신용점수 +' + T.credit_contract }, // 내 집을 바로 살 수 있으면 건너뜀
    { id: 'lev', title: '레버리지를 다뤄라', desc: '코인 포지션을 이익 50,000원 이상으로 정리한다. 작게 걸어 본다. 방향을 틀리면 증거금이 통째로 사라진다.', cur: s => Math.min(s.stats.levGain, 50000), goal: () => 50000, unit: '원', go: 'coin',
      skip: s => worth(s) >= housePrice(s) * 0.6 || s.tier >= OWN, reward: s => qcash(s, T.q_lev_cash), rtext: s => won(qamt(s, T.q_lev_cash)) },
    { id: 'house', title: '내 집을 사라', desc: s => '현금 ' + won(housePrice(s)) + '으로 내 집을 산다. 대출 없이 현금으로만 사고(전세 보증금은 돌려받아 보태진다 · 투자한 돈은 팔아서), 집값은 부동산 시세를 따라 움직인다.', cur: s => (reached(s, OWN) ? housePrice(s) : clamp(s.cash + (s.deposit || 0), 0, housePrice(s))), goal: s => housePrice(s), unit: '원', go: 'house',
      done: s => reached(s, OWN), reward: () => { }, rtext: '1막 끝 · 가게를 차릴 수 있다' },
    bizQuest('shop', 1, '가게를 차려라', '알바를 가게로 키운다. 같은 일을 해도 일당이 몇 배가 된다. 차리는 돈은 자산으로 남지 않는다.'),
    { id: 'landlord', title: '첫 상가를 사라', desc: '부동산 탭에서 상가를 하나 산다. 일요일 밤마다 임대수익이 들어와 고정비를 메운다. 값은 부동산 시세를 따라 오르내린다.', cur: s => Math.min(1, s.stats.props || 0), goal: () => 1, unit: '채', go: 'realty',
      skip: s => s.tier >= 5, reward: s => qcash(s, T.q_prop_cash), rtext: s => won(qamt(s, T.q_prop_cash)) }, // 상가 없이 아파트로 올라갔으면 건너뜀
    homeQuest('apt', 5, '아파트로 올라가라', s => '아파트는 전세(보증금 = 값의 ' + Math.round(T.jeonse_ratio * 100) + '%, 대출 없음)로 들어가거나 주담대를 끼고 산다. 빌릴 수 있는 몫과 이자는 신용등급을 따른다 (지금 ' + creditGrade(s) + '등급 = 값의 ' + Math.round(ltvOf(s) * 100) + '%까지). 원리금은 일요일 밤 고정비와 함께 나가고, 두 번 연속 못 내면 압류되어 한 단계 아래로 내려간다.'),
    { id: 'repay1', title: '원리금을 제때 내라', desc: '일요일 밤 고정비와 주담대 원리금을 한 번 제때 낸다. 미리 갚으면 다음 주 이자가 준다.', cur: s => Math.min(1, s.stats.loanPaid || 0), goal: () => 1, unit: '회',
      skip: s => !s.loan && !(s.stats.loanPaid > 0), reward: s => qcash(s, T.q_repay_cash), rtext: s => won(qamt(s, T.q_repay_cash)) },
    bizQuest('corp', 2, '법인으로 키워라', '가게를 법인으로 키운다.'),
    homeQuest('house2', 6, '주택으로 올라가라', '마당 있는 주택. 전세로 갈지, 대출을 얼마나 낄지는 내가 고른다.'),
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
    const view = { id: q.id, n: s.quest + 1, of: QUESTS.length, title: q.title, desc: typeof q.desc === 'function' ? q.desc(s) : q.desc, cur, goal, unit: q.unit, pct: goal ? clamp(cur / goal, 0, 1) : 0, near: goal > 1 && cur / goal >= 0.8 && cur < goal, reward: typeof q.rtext === 'function' ? q.rtext(s) : q.rtext, go: q.go || '' };
    if (q.rewardHp) view.rewardHp = q.rewardHp;
    return view;
  }
  function questTick(s) {
    let guard = 0;
    while (s.quest < QUESTS.length && !s.ended && guard++ < 20) {
      const q = QUESTS[s.quest], view = questView(s);
      if (questDone(s, q)) {
        s.quest++; s.stats.quests++; ev(s, 'quest_done', { quest: view });
        const hp = s.hp;
        q.reward(s);
        if (q.rewardHp) view.recoveredHp = Math.max(0, s.hp - hp);
        gainXp(s, T.xp_quest);
      }
      else if (q.skip && q.skip(s)) { s.quest++; ev(s, 'quest_skip', { quest: view }); } // 때가 지난 퀘스트는 보상 없이 넘김
      else break;
      if (s.quest < QUESTS.length) ev(s, 'quest_new', { quest: questView(s) });
    }
  }

  // ── 레벨 · 특성 ─────────────────────────────────────────────
  const XPF = { miss: 0.5, ok: 1, good: 1.3, perfect: 1.6, skip: 0.4 };
  const pc = v => Math.round(v * 100) + '%';
  const perkPercent = v => Number((v * 100).toFixed(6));
  // desc는 보유 설명과 획득 알림에 쓰고, label · value · note는 선택 카드에 쓴다.
  const PERKS = [
    { id: 'iron', name: '강철 체력', icon: 'muscle', max: 3, desc: () => '최대 체력 +' + T.perk_iron,
      label: '최대 체력', value: () => '+' + T.perk_iron },
    { id: 'sleep', name: '꿀잠', icon: 'zzz', max: 2, desc: () => '밤마다 체력을 ' + T.perk_sleep + ' 더 회복',
      label: '밤 체력 회복', value: () => '+' + T.perk_sleep },
    { id: 'hustle', name: '일머리', icon: 'coin', max: 3, grp: 'work', desc: () => '알바 일당 +' + pc(T.perk_hustle),
      label: '알바 일당', value: () => '+' + perkPercent(T.perk_hustle) + '%' },
    { id: 'hands', name: '금손', icon: 'sparkle', max: 2, desc: () => '미니게임 판정이 후해진다',
      label: '미니게임', value: () => '판정 완화' },
    { id: 'lazy', name: '요령', icon: 'skip', max: 2, desc: () => '"대충" 배율 +' + T.perk_lazy + ', 실수해도 그만큼은 받는다',
      label: '"대충" 배율', value: () => '+' + T.perk_lazy, note: '실수해도 그만큼은 받는다.' },
    { id: 'streak', name: '리듬', icon: 'fire', max: 2, desc: () => '콤보 한 단계의 보너스 +' + pc(T.perk_streak) + 'p',
      label: '콤보 한 단계의 보너스', value: () => '+' + perkPercent(T.perk_streak) + '%p' },
    { id: 'thrift', name: '짠돌이', icon: 'tag', max: 2, desc: () => '끼니 · 찜질방 · 고정비 −' + pc(T.perk_thrift),
      label: '끼니 · 찜질방 · 고정비', value: () => '−' + perkPercent(T.perk_thrift) + '%' },
    { id: 'early', name: '아침형 인간', icon: 'sun', max: 2, desc: () => '매일 아침 체력 +' + T.perk_early,
      label: '매일 아침 체력', value: () => '+' + T.perk_early },
    { id: 'quester', name: '보상 사냥꾼', icon: 'gift', max: 1, desc: () => '퀘스트 현금 보상 +' + pc(T.perk_quest),
      label: '퀘스트 현금 보상', value: () => '+' + perkPercent(T.perk_quest) + '%' },
    { id: 'legs', name: '발품', icon: 'rise', max: 2, desc: () => '집 · 사업 값 −' + pc(T.perk_legs),
      label: '집 · 사업 값', value: () => '−' + perkPercent(T.perk_legs) + '%' },
    { id: 'sense', name: '눈치', icon: 'eye', max: 2, need: s => s.tier >= 2, desc: () => '리포트가 맞을 확률 +' + pc(T.perk_sense) + 'p',
      label: '리포트가 맞을 확률', value: () => '+' + perkPercent(T.perk_sense) + '%p' },
    { id: 'vip', name: '수수료 우대', icon: 'percent', max: 1, need: s => s.tier >= 2, desc: () => '매매 수수료 절반',
      label: '매매 수수료', value: () => '절반' },
    { id: 'tipster', name: '정보통', icon: 'news', max: 1, need: s => s.tier >= 2, desc: () => '아침마다 소식 하나의 진짜 방향을 귀띔받는다 (' + pc(T.perk_tip_acc) + ' 맞음)',
      label: '귀띔 적중률', value: () => perkPercent(T.perk_tip_acc) + '%', note: '아침마다 소식 하나의 방향을 귀띔받는다.' },
    { id: 'guts', name: '강심장', icon: 'shield', max: 1, need: s => s.tier >= 3, desc: () => '청산될 때 한 번, 증거금의 ' + pc(T.perk_guts) + '를 건진다',
      label: '청산 시 증거금 회수', value: () => perkPercent(T.perk_guts) + '%', note: '한 판에 한 번 발동한다.' },
    // 양날: 얻는 것 + 대신 못 하는 것(con). 레벨 3 · 6 · 9 의 고르기에 한 장씩만. 같은 무리(grp)에서는 한 판에 한 가지 (일머리 · 일중독도 'work' 한 무리 — 일머리는 3장까지 겹쳐 찍을 수 있다)
    { id: 'coinonly', name: '코인 외길', icon: 'bolt', max: 1, aug: true, grp: 'invest', con: '이 판 끝까지 주식을 살 수 없다 (가진 주식은 팔 수 있다)', need: s => s.tier >= 3, desc: () => '코인 이익 +' + pc(T.perk_coinonly),
      label: '코인 이익', value: () => '+' + perkPercent(T.perk_coinonly) + '%' },
    { id: 'stockonly', name: '주식 외길', icon: 'chart', max: 1, aug: true, grp: 'invest', con: '이 판 끝까지 코인을 할 수 없다 (연 포지션은 정리할 수 있다)', need: s => s.tier >= 2, desc: () => '주식 이익 +' + pc(T.perk_stockonly) + ' · 수수료 0',
      label: '주식 이익', value: () => '+' + perkPercent(T.perk_stockonly) + '%', note: '매매 수수료 0' },
    { id: 'workaholic', name: '일중독', icon: 'clock', max: 1, aug: true, grp: 'work', con: '쉴 수 없다 (할 수 있는 알바가 없을 때만)', desc: () => '알바 일당 +' + pc(T.perk_workaholic),
      label: '알바 일당', value: () => '+' + perkPercent(T.perk_workaholic) + '%', offerCon: '할 수 있는 알바가 없을 때만 쉴 수 있다' },
    { id: 'beast', name: '야수의 심장', icon: 'skull', max: 1, aug: true, grp: 'invest', get con() { return T.beast_min_lev + '배 미만으로는 걸 수 없다'; }, need: s => s.tier >= 3, desc: () => '코인 이익 +' + pc(T.perk_beast),
      label: '코인 이익', value: () => '+' + perkPercent(T.perk_beast) + '%' },
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
  const offerView = s => (s.offer ? s.offer.map(id => {
    const p = byId(PERKS, id), card = perkCard(s, p);
    return { ...card, con: p.offerCon || card.con, label: p.label, value: p.value(), note: p.note || '' };
  }) : null);
  const perksView = s => PERKS.filter(p => perk(s, p.id) > 0).map(p => perkCard(s, p));
  const xpView = s => ({ lv: s.lv, xp: s.xp, need: xpNeed(s.lv) });

  // ── 돌발 사건: 아침에 가끔, 선택지 둘 ────────────────────────
  const heal = (s, n) => { s.hp = Math.min(hpMax(s), s.hp + n); }, hurt = (s, n) => { s.hp = Math.max(0, s.hp - n); };
  function readReport(s, asset) { // 고른 종목 하나의 내일 (공부 · 단골이 함께 씀). 같은 날 여러 종목이면 합쳐 둔다
    const day = s.day + 1, m = s.market, acc = studyAcc(s);
    const it = m.intel && m.intel.madeOn === s.day && m.intel.assets ? m.intel : (m.intel = { day, madeOn: s.day, assets: [], items: [], ht: null, gm: null });
    if (it.assets.indexOf(asset) < 0) it.assets.push(asset);
    if (asset === 'hantang') { // 단계 · 시점은 안 알려 준다. 매집 중일 때만 "진짜 쪽 / 털기 쪽" 기울기 (맞을 확률 acc, 시세 난수로 미리 정해 둔 값이라 다시 읽어도 같음)
      const ht = m.ht;
      it.ht = ht.phase === 'gather' ? { state: 'lean', lean: (ht.hint < acc) === ht.real ? 1 : -1 } : { state: ht.phase === 'quiet' ? 'quiet' : 'late', lean: 0 };
      if (it.ht.state === 'lean') m.htRead = { lean: it.ht.lean, from: ht.from, day: s.day }; // 이번 매집이 끝날 때 맞았는지 채점
      return 1;
    }
    if (asset === 'game') { // 신작을 발표한 뒤에만 "흥행 쪽 / 혹평 쪽" 기울기 (출시 날 채점)
      const gm = m.gm;
      it.gm = gm.phase === 'hype' ? { state: 'lean', lean: (gm.hint < acc) === gm.hit ? 1 : -1 } : { state: 'quiet', lean: 0 };
      if (it.gm.state === 'lean') m.gmRead = { lean: it.gm.lean, from: gm.from, day: s.day };
      return 1;
    }
    const items = m.news.filter(n => n.day === day && n.asset === asset).map(n => { const eff = n.truth ? n.dir : -n.dir; return { nid: n.id, asset: n.asset, dir: rnd3(s) < acc ? eff : -eff, by: 'study' }; });
    it.items = it.items.filter(i => i.asset !== asset).concat(items);
    return items.length;
  }
  const htText = h => (!h ? '' : h.stale ? '리포트 뒤에 거래량이 늘었습니다 (읽을 때는 조용했음)' : h.state === 'lean' ? (h.lean > 0 ? '이번 매집은 진짜 쪽으로 보입니다' : '이번 매집은 털고 끝날 쪽으로 보입니다') : h.state === 'quiet' ? '지금은 조용합니다' : '이미 움직였습니다');
  const gmText = h => (!h ? '' : h.stale ? '리포트 뒤에 신작 발표가 났습니다 (읽을 때는 조용했음)' : h.state === 'lean' ? (h.lean > 0 ? '이번 신작은 흥행 쪽으로 보입니다' : '이번 신작은 혹평 쪽으로 보입니다') : '신작 소식이 없습니다');
  function openGap(s) { // 밤사이: 오늘 소식은 아침 장 전에 "믿을 만한 만큼" 먼저 값에 들어간다. 하루 3점을 지키려 차트의 어제 마지막 점을 옮긴다
    // gap 사건의 delta = 밤 정산의 순자산 → 아침 순자산 차이 (갭으로 청산되면 그것까지)
    const m = s.market, g = {}, w0 = worth(s), pct = {};
    for (const n of m.news) if (n.day === s.day && n.pre) g[n.asset] = (g[n.asset] || 0) + n.pre;
    for (const w of m.world || []) { // 세상 사건: 닥친 아침에 값에 바로. 날씨 예보는 뜬 아침에 믿을 만한 만큼 먼저 들어가고, 빗나가면 되돌아간다 (보고 사서는 못 먹는다)
      const def = worldDef(w);
      if (!def) continue;
      const fx = worldFx(def), pre = !w.warn ? 0 : def.sure ? 1 : T.world_priced * worldAcc(def); // 빗나갈 일이 없는 예보(명절)는 뜬 아침에 전부 — 남겨 두면 보고 사서 남는다
      if (w.day === s.day) for (const id in fx) g[id] = (g[id] || 0) + (w.truth ? fx[id] : 0) - (w.pre ? pre * fx[id] : 0);
      else if (w.warn && w.day === s.day + 1 && !w.pre) { w.pre = 1; for (const id in fx) g[id] = (g[id] || 0) + pre * fx[id]; }
    }
    const eg = BASKET.reduce((v, id) => v + (g[id] || 0), 0) / BASKET.length; // ETF 는 담은 것의 평균만큼
    if (Math.abs(eg) > 1e-9) { g.etf = eg; g.inv = -eg; }
    m.gap = {};
    for (const id in g) { pct[id] = Math.exp(g[id]) - 1; m.gap[id] = pct[id]; m.px[id] = Math.max(FLOOR, m.px[id] * Math.exp(g[id])); const h = m.hist[id]; h[h.length - 1] = m.px[id]; if (byId(ASSETS, id).kind === 'coin' && m.px[id] < MERGE_AT) coinMerge(s, id); }
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
    const n = m.news.find(x => x.day === s.day && visible(s, x.asset) && !m.brief.items.some(i => i.nid === x.id));
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
      a: { label: '믿고 산다', cost: 200000, run: s => { const n = Math.floor(sc(s, 200000) / (s.market.px.hantang * (1 + T.fee))); if (!buyUnits(s, 'hantang', n)) return '살 수가 없었다. 돈은 그대로다.'; return n + '주를 샀다. 이제 기도뿐이다.'; } },
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
    { id: 'gym', icon: 'muscle', tier: [2, 8], title: '헬스장 전단지', text: s => '"석 달 등록 ' + won(sc(s, 90000)) + '." 계단만 올라도 숨이 차는 요즘이다.',
      a: { label: '등록한다', cost: 90000, run: s => { expense(s, '헬스장', sc(s, 90000)); s.hpBonus = (s.hpBonus || 0) + 5; heal(s, 5); return '사흘 나갔다. 그래도 몸은 기억한다. 최대 체력 +5.'; } },
      b: { label: '계단으로 만족한다', run: s => { heal(s, 4); return '엘리베이터 대신 계단을 탔다.'; } } },
    { id: 'tenant', icon: 'door', tier: [3, 8], again: true, when: s => PROPS.some(p => s.props && s.props[p.id] && !s.props[p.id].vacant) && !(s.evDay.tenant && s.day - s.evDay.tenant < 10), title: '세입자의 부탁', text: '세 든 가게 사장이 찾아왔다. "이번 달만 조금 늦게 드려도 될까요."',
      a: { label: '기다려 준다', run: s => { gainXp(s, 25); heal(s, 5); creditAdd(s, 5, '좋은 집주인', 'mix'); return '고맙다는 문자가 길게 왔다. 밀린 것까지 제날짜에 들어왔다.'; } },
      b: { label: '안 된다고 한다', run: s => { const p = PROPS.find(q => s.props[q.id] && !s.props[q.id].vacant); if (p && rnd3(s) < 0.4) { s.props[p.id].vacant = 2; return '사장은 짐을 쌌다. ' + p.name + jo(p.name, '이', '가') + ' 2주 동안 빈다.'; } return '월세는 제날짜에 들어왔다. 인사는 없었다.'; } } },
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
    // 2026-11-21 "돌발이벤트같은거 많이 넣어": 열셋 더
    { id: 'phish', icon: 'phone', tier: [2, 8], title: '수상한 문자', text: '"[튼튼은행] 고객님만을 위한 특별 한도 안내. 아래 링크에서 확인하세요." 은행 로고가 어딘가 번져 있다.',
      a: { label: '눌러 본다', run: s => { if (rnd3(s) < 0.45) { creditAdd(s, 10, '은행 우대 고객', 'mix'); return '진짜 은행 행사였다. 우대 고객으로 올랐다. 신용점수 +10.'; } const x = Math.min(Math.max(0, s.cash), sc(s, 200000)); if (x > 0) expense(s, '스미싱 피해', x); creditAdd(s, -20, '금융 사기 피해', 'mix'); return '스미싱이었다. ' + (x > 0 ? won(x) + '이 빠져나갔고 ' : '') + '신용점수도 깎였다.'; } },
      b: { label: '지운다', run: s => { gainXp(s, 10); return '지우고 번호를 차단했다. 은행은 링크를 보내지 않는다.'; } } },
    { id: 'cosign', icon: 'envelope', tier: [2, 8], title: '보증 부탁', text: s => '옛 동료가 찾아왔다. "딱 ' + won(sc(s, 500000)) + '만 보증 서 줘. 석 달이면 갚아."',
      a: { label: '서 준다', run: s => { if (rnd3(s) < 0.6) { income(s, '사례금', sc(s, 60000)); creditAdd(s, 10, '보증을 무사히 마침', 'mix'); gainXp(s, 20); return '동료는 약속대로 갚았다. 사례금 ' + won(sc(s, 60000)) + '과 함께 고기를 샀다. 신용점수 +10.'; } const x = sc(s, 500000); s.arrears += x; add(s.today.expense, '보증 사고 (빚 — 일요일 정산에)', x); creditAdd(s, -30, '보증 사고', 'pay'); return '동료가 잠적했다. 보증 선 ' + won(x) + '이 내 빚이 되었다 (일요일 정산에 나간다).'; } },
      b: { label: '미안하다고 한다', run: s => { gainXp(s, 5); return '밥만 사고 보냈다. 계산서는 내가 집었다.'; } } },
    { id: 'limit', icon: 'bank', tier: [2, 8], when: s => creditGrade(s) <= 5 && (s.clBoost || 0) < 0.1, title: '은행의 전화', text: '"고객님, 신용이 좋으셔서 마이너스 통장 한도를 올려 드릴 수 있습니다."',
      a: { label: '올린다', run: s => { s.clBoost = 0.1; return '한도가 10% 늘었다. 쓸 수 있는 돈과 써도 되는 돈은 다르다.'; } },
      b: { label: '괜찮다고 한다', run: s => { creditAdd(s, 5, '필요 없는 한도를 사양함', 'debt'); return '정중히 끊었다. 신용점수 +5.'; } } },
    { id: 'subway', icon: 'clock', tier: [1, 5], title: '지하철 고장', text: '출근길 지하철이 터널에서 멈췄다. 안내 방송은 "잠시만"을 되풀이한다.',
      a: { label: '내려서 택시를 탄다', cost: 20000, run: s => { expense(s, '택시', sc(s, 20000)); return '제시간에 닿았다. 기사님은 지름길을 알았다.'; } },
      b: { label: '역 사이를 걷는다', run: s => { hurt(s, 8); gainXp(s, 8); return '두 정거장을 걸었다. 다리는 아프고 지각은 면했다.'; } } },
    { id: 'coldish', icon: 'clinic', tier: [0, 8], title: '감기 기운', text: '목이 칼칼하고 몸이 으슬으슬하다.',
      a: { label: '약을 사 먹는다', cost: 10000, run: s => { expense(s, '감기약', sc(s, 10000)); heal(s, 4); return '초기에 잡았다.'; } },
      b: { label: '버틴다', run: s => { if (rnd3(s) < 0.5) { hurt(s, 14); return '몸살로 번졌다. 온몸이 쑤신다.'; } gainXp(s, 8); return '자고 나니 멀쩡하다. 몸이 이겼다.'; } } },
    { id: 'used', icon: 'cart', tier: [1, 4], when: s => !has(s, 'padding'), title: '중고 거래', text: s => '"롱패딩 급처, ' + won(sc(s, 100000)) + '. 쿨거래 시 택배비 포함." 새것은 ' + won(T.cost_padding) + '이다.',
      a: { label: '입금한다', cost: 100000, run: s => { expense(s, '중고 거래', sc(s, 100000)); if (rnd3(s) < 0.55) { (s.items || (s.items = {})).padding = 1; if (!s.wear) s.wear = 'padding'; return '진짜가 왔다. 롱패딩을 얻었다 — 밤마다 체력을 ' + T.item_padding + ' 더 회복한다.'; } return '벽돌이 왔다. 판매자는 탈퇴했다.'; } },
      b: { label: '직거래만 한다고 답한다', run: s => { gainXp(s, 8); return '답이 없다. 그렇다는 뜻이다.'; } } },
    { id: 'blood', icon: 'hp', tier: [0, 3], title: '헌혈의 집', text: '"헌혈하고 영화표 받아 가세요." 간호사가 손짓한다.',
      a: { label: '한다', run: s => { hurt(s, 8); gainXp(s, 25); return '초코 과자와 영화표를 받았다. 뿌듯하고 조금 어지럽다.'; } },
      b: { label: '다음에', run: s => { gainXp(s, 3); return '고개만 숙이고 지나갔다.'; } } },
    { id: 'fair', icon: 'target', tier: [0, 2], title: '일자리 박람회', text: '구청 앞에 천막이 섰다. "오늘 면접 보면 내일부터 출근."',
      a: { label: '줄을 선다', run: s => { hurt(s, 5); s.buff.nextJob = 1.5; return '소개받은 자리는 일당이 세다. 다음 알바는 1.5배다.'; } },
      b: { label: '지나친다', run: s => { heal(s, 3); return '그 시간에 벤치에서 눈을 붙였다.'; } } },
    { id: 'tax', icon: 'bill', tier: [5, 8], title: '세금 고지서', text: '두꺼운 봉투가 왔다. 종합소득세. 숫자를 세다 말았다.',
      a: { label: '세무사에게 맡긴다', cost: 200000, run: s => { expense(s, '세무사', sc(s, 200000)); return '깔끔하게 끝났다. 공제를 꼼꼼히 찾아 줬다.'; } },
      b: { label: '직접 신고한다', run: s => { if (rnd3(s) < 0.5) { const x = Math.min(Math.max(0, s.cash), sc(s, 500000)); if (x > 0) expense(s, '가산세', x); return '칸 하나를 잘못 적었다. 가산세 ' + won(x) + '.'; } hurt(s, 6); gainXp(s, 20); return '밤을 새워 끝냈다. 한 푼도 더 내지 않았다.'; } } },
    { id: 'unlisted', icon: 'rocket', tier: [3, 8], title: '확실한 정보', text: s => '사촌이 속삭인다. "상장만 하면 열 배야. ' + won(sc(s, 1000000)) + '만 넣어."',
      a: { label: '넣는다', cost: 1000000, run: s => { expense(s, '비상장 투자', sc(s, 1000000)); if (rnd3(s) < 0.25) { income(s, '비상장 대박', sc(s, 3400000)); return '정말로 상장했다. ' + won(sc(s, 3400000)) + '이 되어 돌아왔다. 사촌이 더 놀랐다.'; } return '회사는 다음 달에 간판을 내렸다. 사촌도 전화를 안 받는다.'; } }, // 기대값은 본전의 85%
      b: { label: '안 넣는다', run: s => { gainXp(s, 8); return '확실한 정보는 나한테까지 오지 않는다.'; } } },
    { id: 'reunion', icon: 'gift', tier: [4, 8], title: '동창회', text: '"요즘 잘나간다며?" 단체방에 이름이 불렸다.',
      a: { label: '나간다', cost: 100000, run: s => { expense(s, '동창회 회비', sc(s, 100000)); gainXp(s, 30); heal(s, 4); s.buff.promo = s.day; return '명함을 스무 장 돌렸다. 오늘 사업 매출 +' + pc(T.job_tv_promo) + '.'; } },
      b: { label: '바쁘다고 한다', run: s => { heal(s, 5); return '답장 대신 이모티콘을 보냈다.'; } } },
    { id: 'volunteer', icon: 'umbrella', tier: [0, 8], again: true, hot: true, when: s => afterDisaster(s) && !(s.evDay.volunteer && s.day - s.evDay.volunteer < 7), title: '복구 봉사', text: '재난이 지나간 동네에서 일손을 찾는다.',
      a: { label: '성금을 보낸다', cost: 30000, run: s => { expense(s, '성금', sc(s, 30000)); gainXp(s, 15); return won(sc(s, 30000)) + '을 보냈다. 영수증은 버렸다.'; } },
      b: { label: '몸으로 돕는다', run: s => { hurt(s, 12); gainXp(s, 40); creditAdd(s, 5, '봉사 활동', 'mix'); return '종일 흙을 퍼냈다. 누군가 건넨 믹스커피가 유난히 달았다. 신용점수 +5.'; } } },
    { id: 'relief', icon: 'cash', tier: [0, 3], again: true, hot: true, when: s => afterDisaster(s) && !(s.evDay.relief && s.day - s.evDay.relief < 7), title: '재난 지원금', text: '주민센터에서 재난 지원금을 준다고 한다. 줄이 건물을 한 바퀴 돌았다.',
      a: { label: '줄을 선다', run: s => { hurt(s, 6); income(s, '재난 지원금', 100000); return '세 시간을 서서 ' + won(100000) + '을 받았다.'; } },
      b: { label: '포기한다', run: s => { heal(s, 3); return '줄을 보고 돌아섰다.'; } } },
  ];
  const afterDisaster = s => !!(s.wlast && DISASTER.indexOf(s.wlast.type) >= 0 && s.day - s.wlast.day >= 1 && s.day - s.wlast.day <= 3); // 재난이 지나간 뒤 사흘 안
  function rollEvent(s) {
    if (s.event || s.ended || s.day < T.event_from || rnd3(s) >= T.event_p) return;
    const pool = EVENTS.filter(e => s.tier >= e.tier[0] && s.tier <= e.tier[1] && (e.again || s.evSeen.indexOf(e.id) < 0) && (!e.when || e.when(s))); // again: 다시 올 수 있는 사건
    if (!pool.length) return;
    const hot = pool.filter(e => e.hot), from = hot.length && rnd3(s) < 0.6 ? hot : pool; // hot: 방금 일어난 일에 딸린 사건(재난 뒤의 봉사 · 지원금)은 그때 잘 뜬다
    s.event = from[Math.floor(rnd3(s) * from.length)].id;
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
    { id: 'allskill', name: '알바의 신', hint: '알바 네 가지를 숙련 3단계', icon: 'crown', ok: s => JOBS.filter(j => skill(s, j.id) >= 3).length >= 4 },
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
    { id: 'collapse', name: '과로', hint: '무리하다 쓰러진다', icon: 'clinic', ok: s => (s.stats.collapsed || 0) >= 1 },
    { id: 'jeonse', name: '전세 계약', hint: '전세로 들어간다', icon: 'key', ok: s => !!s.stats.jeonse },
    { id: 'landlord', name: '조물주 위 건물주', hint: '상가를 산다', icon: 'house', ok: s => (s.stats.props || 0) >= 1 },
    { id: 'tower', name: '랜드마크', hint: '랜드마크 타워를 산다', icon: 'crown', ok: s => !!(s.props && s.props.tower) },
    { id: 'grade1', name: '신용 1등급', hint: '신용점수 900점', icon: 'shield', ok: s => (s.credit || 0) >= 900 },
    { id: 'dividend', name: '배당 받는 삶', hint: '배당을 받는다', icon: 'gift', ok: s => (s.stats.div || 0) > 0 },
    { id: 'know6', name: '투자 고수', hint: '투자 공부 6단계', icon: 'book', ok: s => knowLv(s) >= 6 },
    { id: 'dream', name: '꿈은 이루어진다', hint: '꿈의 둘째 장면을 본다', icon: 'star', ok: s => (s.beats || []).some(k => /2$/.test(k)) },
    { id: 'jobs10', name: 'N잡러', hint: '알바 열 가지를 모두 해 본다', icon: 'swap', ok: s => JOBS.every(j => s.ever && s.ever[j.id]) },
    { id: 'storm', name: '비 온 뒤 땅', hint: '세상 사건을 다섯 번 겪는다', icon: 'umbrella', ok: s => (s.stats.world || 0) >= 5 },
    { id: 'forecast', name: '예보는 예보일 뿐', hint: '날씨 예보가 빗나간다', icon: 'eye', ok: s => (s.stats.wmiss || 0) >= 1 },
    { id: 'repair', name: '집주인의 무게', hint: '재난으로 수리비를 낸다', icon: 'wrench', ok: s => (s.stats.repair || 0) > 0 },
    { id: 'hedge', name: '거꾸로 사는 사람', hint: '거꾸로ETF로 이익을 낸다', icon: 'down', ok: s => (s.stats.invGain || 0) > 0 },
    { id: 'basket', name: '여러 바구니', hint: '주식 다섯 종목을 한꺼번에 든다', icon: 'chart', ok: s => ASSETS.filter(a => a.kind === 'stock' && s.hold[a.id] && s.hold[a.id].units > 0).length >= 5 },
    { id: 'streak4', name: '성실 납부자', get hint() { return '정산을 ' + T.credit_streak_n + '번 연속 제때 낸다'; }, icon: 'calendar', ok: s => (s.crStreak || 0) >= T.credit_streak_n },
    { id: 'doge', name: '멍멍', hint: '멍멍코인으로 이익을 낸다', icon: 'bolt', ok: s => (s.stats.dogeGain || 0) > 0 },
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
    const tail = ['알바 ' + won(st.alba) + ' · 투자 ' + (st.trade >= 0 ? '+' : '') + won(st.trade) + ' · 청산 ' + st.liq + '번 · Lv.' + s.lv + ' · 업적 ' + s.ach.length + '개', (s.dream ? '꿈 ' + dreamOf(s).name + ' · ' : '') + '신용 ' + creditGrade(s) + '등급 · 판 코드 ' + codeOf(s.seed)];
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
      const s = JSON.parse(json); if (!s || [1, 2, 3, 4, 5].indexOf(s.v) < 0 || !s.market) return null;
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
      if (s.v === 3) { // v3: 보증금 · 신용 · 부동산 · 새 종목이 없던 때. 살던 곳은 그대로(보증금 0), 신용은 그동안 낸 정산만큼 쳐 준다
        s.v = 4; for (const k in s.hold) if (s.hold[k] && s.hold[k].min == null) s.hold[k].min = 0; // 배당의 기준 수량: 예전 보유는 0 부터 (불러온 날 사서 바로 배당을 받지 못하게)
        s.lease = s.tier >= OWN ? 'own' : s.tier >= 2 ? 'rent' : ''; s.addr = s.tier >= 2 || (s.stats.maxTier || 0) >= 2 ? 1 : 0;
        s.credit = clamp(T.credit_start + (s.addr ? T.credit_addr : 0) + (s.rentPaid || 0) * T.credit_ontime + (s.tier >= OWN ? T.credit_home : 0), 300, 1000); s.cl = 0;
        s.re = { idx: 1, trend: 0, left: 3, next: T.re_flat, hint: 0.5, last: 0, hist: [1] }; s.props = {}; s.know = s.studied || 0; s.items = {}; s.wear = ''; s.look = 0; s.ate = 0; s.sick = 0; s.hosp = 0;
        s.dream = 'family'; s.dreamSet = 1; s.beats = [];
        m.gm = { phase: 'quiet', left: 14 };
        for (const a of ASSETS) if (m.px[a.id] == null) { m.px[a.id] = a.px; m.hist[a.id] = [a.px]; m.chg[a.id] = 0; s.hold[a.id] = { units: 0, cost: 0, min: 0 }; }
        if (s.loan && s.loan.rate == null) s.loan.rate = T.loan_rate;
      }
      if (s.v === 4) { // v4: 알바 넷 · 종목 여덟 · 세상 사건 · 신용 항목이 없던 때. 하던 판은 그대로, 새것은 처음 값으로
        s.v = 5;
        for (const j of JOBS) if (s.jobs[j.id] == null) s.jobs[j.id] = 0;
        for (const a of ASSETS) if (m.px[a.id] == null) { m.px[a.id] = a.px; m.hist[a.id] = [a.px]; m.chg[a.id] = 0; s.hold[a.id] = { units: 0, cost: 0, min: 0 }; }
        m.world = [];
        const age = s.addr ? T.credit_addr : 0; // 신용 항목: 주소 몫은 거래 기간에, 나머지는 상환 이력에 (그동안의 내역은 없다)
        s.cr = { pay: (s.credit == null ? T.credit_start : s.credit) - T.credit_start - age, debt: 0, age, asset: 0, mix: 0 }; s.crLog = []; s.crStreak = 0; s.crWeeks = 0; s.crSpend = 0; s.spent = 0; s.clBoost = 0;
        s.ever = {}; for (const j of JOBS) if (s.jobs[j.id] > 0) s.ever[j.id] = 1;
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
    if (b && b.inDays <= 1 && b.amt > 0) out.push({ kind: 'bill', when: b.inDays ? 'tomorrow' : 'today', amt: b.amt, income: b.income, text: (b.inDays ? '내일' : '오늘') + ' 밤 ' + billName(b) + ' ' + won(b.amt) + (b.days < 7 && b.week ? ' (' + b.days + '일치)' : '') }); // 이사한 주는 산 날만큼
    return out;
  }
  function holdings(s) { // 내가 든 것 전부 (주식 3종은 안 가져도 줄이 있음)
    const rows = ASSETS.filter(a => a.kind === 'stock' && visible(s, a.id)).map(a => { // 보이는 종목만 (찜질방 셋 → 고시원 여섯 → 원룸 아홉 → 내 집 열하나 → 아파트 열셋 → 주택 열넷)
      const h = s.hold[a.id], value = Math.round(holdValue(s, a.id)), cost = Math.round(h.cost), pnl = value - cost;
      return { id: a.id, name: a.name, tag: a.tag, hint: a.hint, units: h.units, px: s.market.px[a.id], value, cost, pnl, pct: cost ? pnl / cost : 0, max: maxUnits(s, a.id) };
    });
    const l = s.lev, lv = l ? Math.round(levValue(s)) : 0;
    const lev = l ? { dir: l.dir, lev: l.lev, put: l.put, value: lv, pnl: lv - l.put, pct: (lv - l.put) / l.put, id: levId(l), name: byId(ASSETS, levId(l)).name } : null;
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
    skill, skipMult, setInt, quitJob, INT, unlocked, todayNews, todayChange, intelView, questView, rnd2, won, num, save, load, weekCost, week, notices, holdings, denView, denBet, denLeave, SHOCKS,
    hpMax, mealCost, saunaCost, sleepGain, studyAcc, perk, pickPerk, offerView, perksView, xpView, PERKS,
    eventView, choose, EVENTS, achList, codeOf, seedOf, dailySeed, resultCard, htText, accText,
    htAlert: s => !!(s.market && s.market.htAlert === s.day), // 오늘 한탕바이오 거래량 알림이 떴나
    gmAlert: s => !!(s.market && s.market.gm && s.market.gm.phase === 'hype'), // 꿀잼게임즈 신작 출시를 기다리는 중인가
    // 2026-11-19: 체력 · 계약 · 신용 · 부동산 · 수량 매매 · 공부 성장 · 가게 · 꿈
    LEASE, PROPS, FOODS, ITEMS, leaseOf, depositFor, condOf, restHp, visible, buyUnits, sellUnits, maxUnits, quote, knowView, knowLv, gmText, billName,
    eat, buyItem, wear, setLook, shopView, creditView, creditGrade, borrow, repayCl, propView, buyProp, sellProp, setDream, dreamView, dreamList, weekIncome, topTier,
    // 2026-11-21: 알바 열 가지 · 세상 사건 · 종목 열여섯 · 신용 보고서
    JOBS, WORLD, SEASONS, GRADE_NAME, worldView, worldNow, worldNext, seasonOf, levId, levMax, jobMod,
  };
});
