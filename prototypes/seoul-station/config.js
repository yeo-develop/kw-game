// PROTOTYPE - NOT FOR PRODUCTION
// Question: 상태창이 시키는 대로 알바 → 방 → 투자 → 집으로 올라가는 한 판이, 뭘 해야 할지 늘 분명하면서 20분 동안 재미있는가?
// Date: 2026-11-12
// 조율 값은 전부 여기 있다. 값마다 value · min · max · step. 게임은 tune.<이름> 으로 그때그때 읽는다.
// 돈의 단위는 원. 시세가 움직이는 한 번을 "틱"이라 부른다 (하루 3틱 = 칸마다 1틱).
window.CONFIG = {
  seed: 1, // 게임의 모든 난수는 이 씨앗에서 나온다 (주소에 ?seed= 로 바꿀 수 있음)
  volume: { value: 0.5, min: 0, max: 1, step: 0.05 },

  // ── 한 판의 목표: 기한 없음. 내 집(1막 끝) → 아파트 → 주택 → 별장 → 호텔 → 한국 최고 부자(엔딩). 값은 오르지 않는다 ──
  price_home: { value: 11000000, min: 5000000, max: 100000000, step: 1000000 }, // 내 집 (현금으로만). 봇 biz 중앙 24일째. 그 위는 사업 배수와 같은 5배 간격
  price_apt: { value: 52000000, min: 20000000, max: 600000000, step: 5000000 }, // 아파트 (주담대는 여기부터)
  price_house: { value: 240000000, min: 100000000, max: 3000000000, step: 50000000 }, // 주택
  price_villa: { value: 1100000000, min: 500000000, max: 10000000000, step: 100000000 }, // 별장
  price_hotel: { value: 5400000000, min: 2000000000, max: 40000000000, step: 500000000 }, // 호텔
  top_worth: { value: 18000000000, min: 10000000000, max: 200000000000, step: 1000000000 }, // 한국 최고 부자: 호텔에서 순자산이 이만큼이면 선언 = 엔딩
  week_home: { value: 2200000, min: 0, max: 5000000, step: 50000 }, // 주 고정비 (관리비 · 세금). 일요일 밤, 그 주에 산 날만큼
  week_apt: { value: 10000000, min: 0, max: 20000000, step: 100000 },
  week_house: { value: 49000000, min: 0, max: 100000000, step: 500000 },
  week_villa: { value: 230000000, min: 0, max: 500000000, step: 5000000 },
  week_hotel: { value: 1100000000, min: 0, max: 2500000000, step: 25000000 },
  act1_s: { value: 21, min: 5, max: 60, step: 1 }, // 1막 끝(내 집) 등급: 이 날까지 S · 다음 A · 다음 B · 그 뒤 C
  act1_a: { value: 25, min: 5, max: 80, step: 1 },
  act1_b: { value: 31, min: 5, max: 100, step: 1 },
  rank_s: { value: 70, min: 20, max: 200, step: 1 }, // 엔딩(최고 부자) 등급: 걸린 날 수
  rank_a: { value: 84, min: 20, max: 250, step: 1 }, // 2026-11-20: 조심스러운 봇의 중앙값(84일)이 A 에 들게
  rank_b: { value: 94, min: 20, max: 300, step: 1 },
  // 주담대 (아파트부터): 집값의 loan_ltv 까지 빌린다. 일요일 밤마다 loan_weeks 회에 나눠 갚고(원금 = 빌린 돈 ÷ 회수), 남은 돈에는 한 주에 loan_rate 씩 이자가 붙는다
  loan_ltv: { value: 0.8, min: 0, max: 0.9, step: 0.05 }, // 집값 가운데 빌릴 수 있는 몫 (나머지는 현금 · 살던 집 판 돈)
  loan_rate: { value: 0.02, min: 0, max: 0.05, step: 0.001 }, // 한 주 이자 (남은 돈에)
  loan_weeks: { value: 4, min: 2, max: 60, step: 1 }, // 몇 회(일요일)에 나눠 갚나. 적을수록 매주 짐이 무겁다 — 최대로 빌리고 사업을 못 키우면 버티기 어렵게. 2026-11-20: 5 → 4 (되는 대로 빌리는 봇의 압류 4% → 12%, 조심스러운 봇은 +1일. 3 이면 압류 34%지만 한 판이 10일 길어진다)
  foreclose_rate: { value: 0.95, min: 0.3, max: 1, step: 0.05 }, // 두 번 연속 못 내면 압류: 그때 시세의 이만큼에 팔리고 바로 아래 집으로 (늘 한 단계. 못 갚은 빚은 가진 현금 · 주식 · 상가로 먼저 갚고, 그래도 남으면 아래 집 대출에 얹힘)
  // 사업: 알바 → 가게 → 법인 → 그룹 → 대기업 → 재벌. 일당 × biz_mult^단계. 단계 n 은 사는 곳 tier 3 + n(가게 = 내 집 …)부터
  biz_mult: { value: 5, min: 1.5, max: 10, step: 0.5 },
  // 자동 수입: 가게부터는 직원이 있어서, 일하지 않은 칸(쉬기 · 공부)에도 그 칸의 "보통" 일당 × 이만큼이 들어온다 (반영되는 단계 기준)
  biz_auto_1: { value: 0.3, min: 0, max: 1, step: 0.05 },
  biz_auto_2: { value: 0.5, min: 0, max: 1, step: 0.05 },
  biz_auto_3: { value: 0.7, min: 0, max: 1, step: 0.05 },
  biz_auto_4: { value: 0.7, min: 0, max: 1, step: 0.05 },
  biz_auto_5: { value: 0.85, min: 0, max: 1, step: 0.05 },
  biz_cost_1: { value: 2800000, min: 1000000, max: 50000000, step: 1000000 }, // 가게 (쓴 돈은 자산으로 안 남는다)
  biz_cost_2: { value: 13000000, min: 5000000, max: 300000000, step: 5000000 }, // 법인
  biz_cost_3: { value: 61000000, min: 20000000, max: 1000000000, step: 10000000 }, // 그룹
  biz_cost_4: { value: 290000000, min: 50000000, max: 5000000000, step: 50000000 }, // 대기업
  biz_cost_5: { value: 1300000000, min: 200000000, max: 30000000000, step: 100000000 }, // 재벌
  // 돈의 크기: 정해진 금액(돌발 사건 · 퀘스트 보상 · 도박장 판돈)에 사는 곳마다 곱하는 배수 (원룸까지는 1)
  tier_scale_4: { value: 3, min: 1, max: 20, step: 1 },
  tier_scale_5: { value: 15, min: 1, max: 100, step: 1 },
  tier_scale_6: { value: 75, min: 1, max: 1000, step: 5 },
  tier_scale_7: { value: 375, min: 1, max: 5000, step: 25 },
  tier_scale_8: { value: 1875, min: 1, max: 20000, step: 125 },
  // 내 집부터 밤에 자면 돌아오는 체력. 2026-11-19 "집 올라갈수록 체력 많이차도록": 서울역 15 → 호텔 100 까지 한 단계에 10~13씩
  regen_max: { value: 100, min: 30, max: 120, step: 1 }, // 하룻밤 잠 + 아침형 인간으로 돌아오는 체력의 상한 (2026-11-19: "집 올라갈수록 체력 많이차도록" → 호텔이면 다 찬다)
  sleep_home: { value: 54, min: 0, max: 100, step: 1 },
  sleep_apt: { value: 66, min: 0, max: 100, step: 1 },
  sleep_house: { value: 78, min: 0, max: 100, step: 1 },
  sleep_villa: { value: 90, min: 0, max: 100, step: 1 },
  sleep_hotel: { value: 100, min: 0, max: 100, step: 1 },

  // ── 알바: 한 칸 일당과 체력 소모 ─────────────────────────────
  pay_flyer: { value: 90000, min: 30000, max: 300000, step: 10000 },
  pay_loading: { value: 170000, min: 50000, max: 500000, step: 10000 },
  pay_store: { value: 130000, min: 50000, max: 400000, step: 10000 },
  pay_delivery: { value: 180000, min: 50000, max: 500000, step: 10000 },
  hp_flyer: { value: 12, min: 0, max: 50, step: 1 },
  hp_loading: { value: 28, min: 0, max: 60, step: 1 },
  hp_store: { value: 12, min: 0, max: 50, step: 1 },
  hp_delivery: { value: 30, min: 0, max: 60, step: 1 },
  // 미니게임 결과별 일당 배율 (실수 · 보통 · 잘함 · 완벽 · 대충 하기)
  mult_miss: { value: 0.7, min: 0.2, max: 1, step: 0.05 }, // 2026-11-17 어렵게: 0.8 → 0.7
  mult_ok: { value: 1.0, min: 0.5, max: 1.5, step: 0.05 },
  mult_good: { value: 1.2, min: 0.8, max: 2, step: 0.05 },
  mult_perfect: { value: 1.4, min: 1, max: 3, step: 0.05 },
  mult_skip: { value: 0.7, min: 0.2, max: 1.2, step: 0.05 }, // 2026-11-17 어렵게: 0.8 → 0.7 (직접 하면 이보다 덜 받지는 않는다)
  // 미니게임 점수(0~1) → 등급. 완벽은 흠 없이 해야 나온다 (2026-11-17 어렵게: 0.9 · 0.7 · 0.4 → 0.95 · 0.75 · 0.4)
  grade_perfect: { value: 0.95, min: 0.6, max: 1, step: 0.01 },
  grade_good: { value: 0.75, min: 0.4, max: 0.95, step: 0.01 },
  grade_ok: { value: 0.4, min: 0.1, max: 0.8, step: 0.01 },
  mg_seconds: { value: 7, min: 4, max: 15, step: 0.5 }, // 미니게임 한 번의 길이 (초)
  mg_level_speed: { value: 0.16, min: 0, max: 0.4, step: 0.02 }, // 숙련 단계마다 미니게임 기본 속도 +
  mg_ramp: { value: 0.4, min: 0, max: 1.5, step: 0.05 }, // 한 판 안에서 끝으로 갈수록 빨라지는 정도 (끝에서 +40%)
  // 알바 강도 하(0) · 중(1) · 상(2) · 최상(3). 일당 · 체력은 중이 기준(1). 일당 배율은 "보통" 이상에만 붙는다 (실수 · 대충은 보너스 없음)
  int_pay_0: { value: 0.8, min: 0.5, max: 1, step: 0.05 },
  int_pay_1: { value: 1, min: 1, max: 1, step: 0.05 }, // 기준 (바꾸지 않음)
  int_pay_2: { value: 1.2, min: 1, max: 2, step: 0.05 },
  int_pay_3: { value: 1.5, min: 1, max: 3, step: 0.05 },
  int_hp_0: { value: 0.85, min: 0.5, max: 1, step: 0.05 }, // 드는 체력 = max(1, round(hp_알바 × 이 값))
  int_hp_1: { value: 1, min: 1, max: 1, step: 0.05 },
  int_hp_2: { value: 1.1, min: 1, max: 2, step: 0.05 },
  int_hp_3: { value: 1.25, min: 1, max: 2, step: 0.05 },
  // 미니게임 속도 배율. 2026-11-17 "미니게임 너무쉬움" → 전체를 어렵게(예전 0.85 · 1 · 1.3 · 1.6). 판정 폭 · 머무는 시간 · 간격의 강도별 표는 minigames.js 에 있다.
  // tools/mg-model.js 로 잰 평균 점수(숙련 0 → 3): 잘하는 사람 하 0.98→0.96 · 중 0.93→0.89 · 상 0.86→0.81 · 최상 0.77→0.69 / 보통 사람 0.87→0.79 · 0.66→0.54 · 0.41→0.32 · 0.29→0.23
  mg_int_0: { value: 1.2, min: 0.5, max: 2.5, step: 0.05 },
  mg_int_1: { value: 1.6, min: 0.5, max: 2.5, step: 0.05 },
  mg_int_2: { value: 2, min: 0.5, max: 2.5, step: 0.05 },
  mg_int_3: { value: 2.4, min: 0.5, max: 2.5, step: 0.05 }, // 상한 2.5 = minigames.js 의 pace 자르기
  // 숙련도: 같은 알바를 n1 · n2 · n3 번 하면 한 단계씩 오르고, 단계마다 일당이 skill_bonus 만큼 오른다
  skill_bonus: { value: 0.08, min: 0, max: 0.3, step: 0.01 },
  skill_n1: { value: 3, min: 1, max: 10, step: 1 },
  skill_n2: { value: 7, min: 2, max: 20, step: 1 },
  skill_n3: { value: 12, min: 3, max: 40, step: 1 },

  // ── 체력 ────────────────────────────────────────────────────
  start_hp: { value: 45, min: 10, max: 100, step: 5 },
  rest_hp: { value: 22, min: 5, max: 60, step: 1 }, // 쉬기 한 칸
  rest_hp_station: { value: 12, min: 0, max: 60, step: 1 }, // 서울역에서는 쉬어도 덜 풀린다
  sleep_station: { value: 12, min: 0, max: 100, step: 1 }, // 밤에 자면 돌아오는 체력 (잠만으로는 다 안 찬다 — 무거운 알바 셋을 매일 뛸 수 없게)
  sleep_sauna: { value: 22, min: 0, max: 100, step: 1 },
  sleep_gosiwon: { value: 30, min: 0, max: 100, step: 1 },
  sleep_oneroom: { value: 40, min: 0, max: 100, step: 1 },
  meal_cost: { value: 20000, min: 0, max: 100000, step: 5000 }, // 하루 끼니 (서울역 · 찜질방에서만. 고시원부터는 주 고정비에 들어 있음)
  meal_skip_hp: { value: 15, min: 0, max: 50, step: 1 }, // 돈이 없어 굶으면 깎이는 체력

  // ── 주거: 보증금(나갈 때 돌려받는 돈 — 순자산에 그대로 남는다)과 매주 나가는 돈 ──
  // 2026-11-19 "보증금 부활" · "월세 전세 매매": 고시원 = 월세(예치금), 원룸 = 월세 또는 전세, 내 집부터 매매(아파트 · 주택은 전세도)
  sauna_night: { value: 15000, min: 0, max: 100000, step: 5000 }, // 찜질방 하룻밤
  gosiwon_dep: { value: 500000, min: 0, max: 3000000, step: 100000 }, // 고시원 예치금
  gosiwon_week: { value: 1200000, min: 0, max: 2000000, step: 50000 }, // 고시원 주 고정비 (방세 · 끼니 · 통신). 일요일 밤, 그 주에 산 날만큼
  oneroom_dep: { value: 2000000, min: 0, max: 20000000, step: 500000 }, // 원룸 월세 보증금
  oneroom_week: { value: 2600000, min: 0, max: 5000000, step: 100000 }, // 원룸 월세의 주 고정비 (월세 + 생활비)
  oneroom_jeonse: { value: 6500000, min: 1000000, max: 50000000, step: 500000 }, // 원룸 전세 보증금 (월세는 없다)
  oneroom_jweek: { value: 900000, min: 0, max: 5000000, step: 50000 }, // 원룸 전세의 주 고정비 (관리비 + 생활비)
  jeonse_ratio: { value: 0.6, min: 0.3, max: 0.9, step: 0.05 }, // 아파트 · 주택 전세 보증금 = 그때 집값 × 이만큼 (대출 없이, 주 고정비는 같음)
  late_fee: { value: 0.1, min: 0, max: 0.5, step: 0.05 }, // 연체료

  // ── 시세: 틱마다의 움직임 (비율) ─────────────────────────────
  fee: { value: 0.003, min: 0, max: 0.02, step: 0.001 }, // 주식 매매 수수료
  lev_fee: { value: 0.001, min: 0, max: 0.01, step: 0.0005 }, // 코인: 포지션을 열 때, 포지션 크기(증거금 × 배율)에 붙는 수수료
  lev_fund: { value: 0.001, min: 0, max: 0.01, step: 0.0005 }, // 코인: 포지션을 들고 있으면 틱마다 포지션 크기에서 나가는 값
  d_drift: { value: 0.0012, min: -0.01, max: 0.01, step: 0.0002 }, // 대장전자: 조금씩 오름
  d_sigma: { value: 0.009, min: 0, max: 0.05, step: 0.001 },
  b_sigma: { value: 0.02, min: 0, max: 0.08, step: 0.002 }, // 화끈식품: 뉴스가 없으면 그냥 출렁임
  h_quiet_drift: { value: -0.002, min: -0.02, max: 0.02, step: 0.001 }, // 한탕바이오: 잠잠 → 매집 → 급등 → 폭락
  h_quiet_sigma: { value: 0.012, min: 0, max: 0.05, step: 0.001 },
  h_gather: { value: 0.015, min: 0, max: 0.06, step: 0.002 }, // 매집 칸마다 오르는 몫
  h_pump: { value: 0.09, min: 0.02, max: 0.25, step: 0.01 },
  h_gather_sigma: { value: 0.015, min: 0, max: 0.05, step: 0.002 }, // 매집 칸의 출렁임
  h_gather_min: { value: 1, min: 1, max: 8, step: 1 }, // 매집 길이 (틱)
  h_gather_max: { value: 4, min: 1, max: 10, step: 1 },
  h_real_p: { value: 0.6, min: 0, max: 1, step: 0.05 }, // 매집이 진짜(급등까지 감)일 확률. 아니면 털고 바로 폭락. 알림은 둘 다 똑같다
  h_pump_min: { value: 1, min: 1, max: 5, step: 1 }, // 급등 길이 (틱)
  h_pump_max: { value: 3, min: 1, max: 6, step: 1 },
  h_dump_base: { value: 0.12, min: 0, max: 0.4, step: 0.01 }, // 폭락 = 매집 뒤 오른 만큼(로그) + 이만큼, 두 칸에 나눠
  h_dump_first: { value: 0.75, min: 0.5, max: 1, step: 0.05 }, // 폭락 첫 칸에 몰리는 몫
  c_sigma: { value: 0.05, min: 0, max: 0.15, step: 0.005 }, // 달나라코인
  c_momentum: { value: 0.12, min: 0, max: 0.8, step: 0.05 }, // 직전 움직임이 이어지는 정도
  // 뉴스: 아침마다 종목별로 나올 확률, 하루 동안 움직이는 크기, 출처별로 사실일 확률
  news_p_buldak: { value: 0.8, min: 0, max: 1, step: 0.05 },
  news_p_daejang: { value: 0.5, min: 0, max: 1, step: 0.05 },
  news_p_coin: { value: 0.7, min: 0, max: 1, step: 0.05 },
  news_mag_buldak: { value: 0.12, min: 0, max: 0.3, step: 0.01 },
  news_mag_daejang: { value: 0.05, min: 0, max: 0.2, step: 0.005 },
  news_mag_coin: { value: 0.1, min: 0, max: 0.4, step: 0.01 },
  rel_official: { value: 0.9, min: 0.5, max: 1, step: 0.05 }, // 공시
  rel_article: { value: 0.72, min: 0.5, max: 1, step: 0.02 }, // 기사
  rel_rumor: { value: 0.5, min: 0.3, max: 1, step: 0.05 }, // 찌라시
  fake_back: { value: 0.6, min: 0, max: 1.5, step: 0.1 }, // 거짓 뉴스일 때 반대로 가는 크기 (뉴스 크기 대비)
  study_acc: { value: 0.56, min: 0.5, max: 1, step: 0.01 }, // 공부(리포트)가 맞을 확률 — 1단계. 2 · 4 · 6단계에서 know_acc_step 씩 오른다 (6단계 0.68 — 예전의 고정 0.62 는 그 사이). 확신이 아니라 한쪽으로 기울여 주는 단서
  study_hp: { value: 8, min: 0, max: 30, step: 1 }, // 공부 한 번에 드는 체력 (가벼운 알바 수준)
  news_priced: { value: 0.9, min: 0, max: 1, step: 0.05 }, // 밤사이 갭: 아침 장 전에 값에 먼저 들어가는 몫 (소식의 기대 움직임 대비). 1이면 소식만 보고 사서는 못 먹는다
  chat_acc: { value: 0.62, min: 0.5, max: 1, step: 0.01 }, // 리딩방 방장이 맞을 확률
  // 속보: 예고 없이(공부로도 안 보임) 한 종목이 한 칸에 크게 움직인다. 종목별 크기는 rules.js 의 표, 여기는 전체 배율
  shock_p: { value: 0.14, min: 0, max: 1, step: 0.02 }, // 하루에 속보가 날 확률
  shock_from: { value: 8, min: 1, max: 28, step: 1 }, // 속보가 나기 시작하는 날
  shock_mag: { value: 1, min: 0, max: 2, step: 0.1 }, // 속보 크기 배율

  // ── 레벨 · 특성 ──────────────────────────────────────────────
  xp_job: { value: 10, min: 0, max: 50, step: 1 }, // 알바 한 번 (등급에 따라 ×0.4~1.6)
  xp_quest: { value: 30, min: 0, max: 200, step: 5 },
  xp_study: { value: 8, min: 0, max: 50, step: 1 },
  xp_day: { value: 5, min: 0, max: 50, step: 1 }, // 하루를 넘길 때
  xp_profit: { value: 1, min: 0, max: 10, step: 0.5 }, // 실현 이익 1만 원당
  xp_profit_cap: { value: 40, min: 0, max: 200, step: 5 }, // 한 번의 매매로 얻는 상한
  lv_base: { value: 40, min: 10, max: 200, step: 5 }, // 레벨 1 → 2 에 드는 경험치
  lv_step: { value: 30, min: 0, max: 100, step: 5 }, // 레벨마다 더 드는 양
  perk_iron: { value: 15, min: 0, max: 50, step: 5 }, // 강철 체력: 최대 체력
  perk_sleep: { value: 8, min: 0, max: 30, step: 1 }, // 꿀잠: 밤 회복
  perk_hustle: { value: 0.05, min: 0, max: 0.3, step: 0.01 }, // 일머리: 일당
  perk_hands: { value: 0.08, min: 0, max: 0.3, step: 0.01 }, // 금손: 미니게임 점수에 더함
  perk_lazy: { value: 0.1, min: 0, max: 0.3, step: 0.05 }, // 요령: 대충 배율
  perk_streak: { value: 0.01, min: 0, max: 0.05, step: 0.005 }, // 리듬: 콤보 한 단계의 보너스
  perk_thrift: { value: 0.12, min: 0, max: 0.4, step: 0.01 }, // 짠돌이: 끼니 · 찜질방 · 고정비
  perk_early: { value: 6, min: 0, max: 20, step: 1 }, // 아침형 인간: 아침 체력
  perk_quest: { value: 1, min: 0, max: 2, step: 0.1 }, // 보상 사냥꾼: 퀘스트 현금 보상
  perk_legs: { value: 0.03, min: 0, max: 0.1, step: 0.01 }, // 발품: 집 · 사업 값을 깎음
  perk_sense: { value: 0.03, min: 0, max: 0.1, step: 0.01 }, // 눈치: 리포트 정확도
  perk_guts: { value: 0.3, min: 0, max: 0.8, step: 0.05 }, // 강심장: 청산 때 건지는 비율
  perk_tip_acc: { value: 0.6, min: 0.5, max: 1, step: 0.05 }, // 정보통: 아침 귀띔이 맞을 확률
  // 양날 특성: 얻는 것 + 대신 못 하는 것. 이 간격의 레벨(3 · 6 · 9)에서 고르는 세 장 중 한 장으로만 나온다
  aug_every: { value: 3, min: 1, max: 10, step: 1 },
  perk_coinonly: { value: 0.3, min: 0, max: 1, step: 0.05 }, // 코인 외길: 코인 이익 (주식을 못 삼)
  perk_stockonly: { value: 0.2, min: 0, max: 1, step: 0.05 }, // 주식 외길: 주식 이익 · 수수료 0 (코인을 못 함)
  perk_workaholic: { value: 0.2, min: 0, max: 1, step: 0.05 }, // 일중독: 일당 (쉬지 못함)
  perk_beast: { value: 0.4, min: 0, max: 1, step: 0.05 }, // 야수의 심장: 코인 이익 (낮은 배율을 못 검)
  beast_min_lev: { value: 3, min: 1, max: 5, step: 1 }, // 야수의 심장: 이 배율 미만은 못 건다

  // ── 콤보 · 팁 · 돌발 사건 ────────────────────────────────────
  combo_bonus: { value: 0.015, min: 0, max: 0.1, step: 0.005 }, // 콤보 한 단계마다 일당
  combo_max: { value: 10, min: 1, max: 30, step: 1 },
  tip_p: { value: 0.25, min: 0, max: 1, step: 0.05 }, // 완벽일 때 팁이 붙을 확률
  tip_min: { value: 10000, min: 0, max: 100000, step: 5000 },
  tip_max: { value: 30000, min: 0, max: 200000, step: 5000 },
  event_p: { value: 0.5, min: 0, max: 1, step: 0.05 }, // 조용한 아침(퀘스트 완료 · 레벨 업이 없는 아침)에 돌발 사건이 뜰 확률
  event_from: { value: 3, min: 2, max: 10, step: 1 }, // 돌발 사건이 뜨기 시작하는 날
  ev_sleep_pen: { value: 15, min: 0, max: 50, step: 5 }, // 잠을 설칠 때 깎이는 회복
  // 도박장: 친구의 전화(고시원부터, 다시 올 수 있음) → 주사위 둘 홀짝. 맞히면 판돈 × den_pay 를 돌려받는다 (자릿세만큼 손해)
  den_from: { value: 6, min: 1, max: 28, step: 1 }, // 친구의 전화가 오기 시작하는 날
  den_gap: { value: 3, min: 1, max: 14, step: 1 }, // 다시 전화가 오기까지 최소 며칠
  den_rounds: { value: 5, min: 1, max: 20, step: 1 }, // 한 번 가면 몇 판까지
  den_pay: { value: 1.9, min: 1, max: 2, step: 0.05 }, // 맞혔을 때 돌려받는 배수 (판돈 포함)
  den_bet_1: { value: 10000, min: 1000, max: 1000000, step: 1000 }, // 고를 수 있는 판돈 넷
  den_bet_2: { value: 50000, min: 1000, max: 1000000, step: 1000 },
  den_bet_3: { value: 100000, min: 1000, max: 1000000, step: 1000 },
  den_bet_4: { value: 300000, min: 1000, max: 3000000, step: 10000 },

  // ── 퀘스트 보상 (원) ─────────────────────────────────────────
  q_survive_cash: { value: 20000, min: 0, max: 200000, step: 10000 },
  q_stock_cash: { value: 30000, min: 0, max: 300000, step: 10000 },
  q_study_cash: { value: 100000, min: 0, max: 500000, step: 10000 },
  q_gain_cash: { value: 50000, min: 0, max: 500000, step: 10000 },
  q_worth_cash: { value: 100000, min: 0, max: 1000000, step: 10000 },
  q_pump_cash: { value: 100000, min: 0, max: 1000000, step: 10000 },
  q_lev_cash: { value: 100000, min: 0, max: 2000000, step: 50000 },
  q_repay_cash: { value: 200000, min: 0, max: 2000000, step: 50000 }, // 원리금을 처음 제때 냈을 때 (× 사는 곳 배수)
  q_meal_cash: { value: 10000, min: 0, max: 100000, step: 5000 },
  q_prop_cash: { value: 300000, min: 0, max: 5000000, step: 50000 }, // 첫 상가 (× 사는 곳 배수)

  // ── 2026-11-19 피드백: "체력이 드라마틱하게 작용하지 않음 — 제일 중요 (고정비 압박이 크지 않음)" ──
  // 컨디션: 체력 비율이 cond_good 이상이면 "쌩쌩"(일당 +), cond_tired 아래면 "지침"(일당 −). 일을 시작할 때의 체력으로 본다
  job_per_day: { value: 1, min: 0, max: 3, step: 1 }, // 같은 알바는 하루에 이만큼만 (0 = 제한 없음). 하루 세 칸을 채우려면 다른 알바를 섞거나 쉬어야 한다 — 편한 알바 하나만 되풀이하지 못하게
  cond_good: { value: 0.7, min: 0.4, max: 1, step: 0.05 },
  cond_good_pay: { value: 0.08, min: 0, max: 0.3, step: 0.01 },
  cond_tired: { value: 0.25, min: 0, max: 0.5, step: 0.05 },
  cond_tired_cut: { value: 0.12, min: 0, max: 0.5, step: 0.01 },
  // 무리: 체력이 모자라도 일은 할 수 있다. 끝나면 (모자란 몫 + collapse_base) 의 확률로 쓰러진다 (collapse_min 아래로는 안 내려감)
  collapse_base: { value: 0.15, min: 0, max: 0.5, step: 0.05 },
  collapse_min: { value: 0.25, min: 0, max: 1, step: 0.05 },
  hospital_fee: { value: 150000, min: 0, max: 1000000, step: 10000 }, // 응급실비 (× 사는 곳 배수). 쓰러지면 남은 칸과 다음 날 오전도 잃는다
  hospital_sleep: { value: 35, min: 0, max: 100, step: 1 }, // 병원에서 보낸 밤에 돌아오는 체력 — 사는 곳의 밤 회복을 넘지는 않는다 (서울역 · 찜질방에서 일부러 쓰러지는 쪽이 낫지 않게)
  // 사 먹기 (하루 한 번, 칸을 안 씀): 돈으로 체력을. 셋째는 사는 곳 배수만큼 비싸진다
  food_1_cost: { value: 5000, min: 0, max: 100000, step: 1000 }, food_1_hp: { value: 6, min: 0, max: 50, step: 1 },
  food_2_cost: { value: 12000, min: 0, max: 100000, step: 1000 }, food_2_hp: { value: 12, min: 0, max: 50, step: 1 },
  food_3_cost: { value: 40000, min: 0, max: 500000, step: 5000 }, food_3_hp: { value: 20, min: 0, max: 80, step: 1 },

  // ── 신용: 점수 300~1000, 등급 1(900↑) · 2(800↑) · 3(700↑) · 4(600↑) · 5(500↑) · 6(400↑) · 7(그 아래 = 대출 불가) ──
  credit_start: { value: 350, min: 300, max: 1000, step: 10 },
  credit_addr: { value: 100, min: 0, max: 300, step: 10 }, // 처음 주소가 생겼을 때 (고시원)
  credit_ontime: { value: 15, min: 0, max: 100, step: 1 }, // 일요일 정산을 제때 냈을 때
  credit_late: { value: 70, min: 0, max: 300, step: 5 }, // 못 냈을 때 (−)
  credit_evict: { value: 150, min: 0, max: 500, step: 10 }, // 쫓겨남 · 압류 (−)
  credit_contract: { value: 30, min: 0, max: 200, step: 5 }, // 전세 계약
  credit_home: { value: 50, min: 0, max: 200, step: 5 }, // 집을 샀을 때 (매매)
  credit_title: { value: 25, min: 0, max: 100, step: 5 }, // 칭호가 오를 때 (벌이 · 자산이 늘었다는 뜻)
  credit_loan_done: { value: 30, min: 0, max: 200, step: 5 }, // 주담대를 다 갚았을 때
  // 마이너스 통장(신용대출): 한도 = cl_limit_사는곳 × cl_mult_등급. 이자만 일요일 밤마다, 원금은 아무 때나 갚는다. 정산 때 현금이 모자라면 한도 안에서 자동으로 빌려 낸다
  cl_limit_2: { value: 1000000, min: 0, max: 20000000, step: 100000 },
  cl_limit_3: { value: 3000000, min: 0, max: 50000000, step: 500000 },
  cl_limit_4: { value: 5000000, min: 0, max: 200000000, step: 1000000 },
  cl_limit_5: { value: 20000000, min: 0, max: 1000000000, step: 5000000 },
  cl_limit_6: { value: 100000000, min: 0, max: 5000000000, step: 10000000 },
  cl_limit_7: { value: 500000000, min: 0, max: 20000000000, step: 100000000 },
  cl_limit_8: { value: 2500000000, min: 0, max: 100000000000, step: 500000000 },
  cl_mult_1: { value: 1, min: 0, max: 2, step: 0.05 }, cl_mult_2: { value: 0.85, min: 0, max: 2, step: 0.05 }, cl_mult_3: { value: 0.7, min: 0, max: 2, step: 0.05 },
  cl_mult_4: { value: 0.55, min: 0, max: 2, step: 0.05 }, cl_mult_5: { value: 0.4, min: 0, max: 2, step: 0.05 }, cl_mult_6: { value: 0.25, min: 0, max: 2, step: 0.05 },
  cl_rate_1: { value: 0.01, min: 0, max: 0.1, step: 0.001 }, cl_rate_2: { value: 0.013, min: 0, max: 0.1, step: 0.001 }, cl_rate_3: { value: 0.017, min: 0, max: 0.1, step: 0.001 },
  cl_rate_4: { value: 0.022, min: 0, max: 0.1, step: 0.001 }, cl_rate_5: { value: 0.028, min: 0, max: 0.1, step: 0.001 }, cl_rate_6: { value: 0.036, min: 0, max: 0.1, step: 0.001 }, // 한 주 이자 (등급이 나쁠수록 비싸다)
  // 주담대: 빌릴 수 있는 몫(LTV)과 이자가 등급을 따른다. 이자 = 그 등급의 마이너스 통장 이자 × mort_k (담보가 있어 싸다)
  ltv_1: { value: 0.8, min: 0, max: 0.9, step: 0.05 }, ltv_2: { value: 0.75, min: 0, max: 0.9, step: 0.05 }, ltv_3: { value: 0.7, min: 0, max: 0.9, step: 0.05 },
  ltv_4: { value: 0.6, min: 0, max: 0.9, step: 0.05 }, ltv_5: { value: 0.5, min: 0, max: 0.9, step: 0.05 }, ltv_6: { value: 0.4, min: 0, max: 0.9, step: 0.05 },
  mort_k: { value: 0.8, min: 0.3, max: 1, step: 0.05 },

  // ── 부동산: 시세 지수(일요일 밤마다 움직임 — 호황 · 보합 · 침체가 몇 주씩 이어진다) · 상가(임대수익) ──
  re_sigma: { value: 0.008, min: 0, max: 0.05, step: 0.001 },
  re_boom: { value: 0.012, min: -0.05, max: 0.05, step: 0.001 }, re_flat: { value: 0.002, min: -0.05, max: 0.05, step: 0.001 }, re_slump: { value: -0.01, min: -0.05, max: 0.05, step: 0.001 },
  re_min: { value: 3, min: 1, max: 12, step: 1 }, re_max: { value: 6, min: 1, max: 20, step: 1 }, // 한 국면이 이어지는 주 수
  prop_1: { value: 7300000, min: 1000000, max: 100000000, step: 1000000 }, // 골목 상가 한 칸 (원룸부터)
  prop_2: { value: 34000000, min: 5000000, max: 500000000, step: 5000000 }, // 역 앞 상가 (내 집부터)
  prop_3: { value: 160000000, min: 20000000, max: 3000000000, step: 10000000 }, // 꼬마빌딩 (아파트부터)
  prop_4: { value: 750000000, min: 100000000, max: 10000000000, step: 50000000 }, // 오피스 빌딩 (주택부터)
  prop_5: { value: 3500000000, min: 500000000, max: 50000000000, step: 250000000 }, // 랜드마크 타워 (별장부터)
  prop_yield: { value: 0.025, min: 0, max: 0.1, step: 0.001 }, // 한 주 임대수익 (그때 시세 대비). 공실이면 0
  prop_tax: { value: 0.03, min: 0, max: 0.1, step: 0.005 }, // 살 때 취득세 · 중개비 (자산으로 안 남는다)
  prop_fee: { value: 0.02, min: 0, max: 0.1, step: 0.005 }, // 팔 때 중개비 · 세금
  prop_vacant_p: { value: 0.1, min: 0, max: 0.5, step: 0.01 }, // 일요일마다 세입자가 나갈 확률 (공실 1~2주)

  // ── 종목 더: 튼튼은행(배당) · 번쩍배터리(성장) · 꿀잼게임즈(신작) · 뚝딱건설(부동산 시세를 따라감) ──
  bk_drift: { value: 0.0003, min: -0.01, max: 0.01, step: 0.0001 }, bk_sigma: { value: 0.005, min: 0, max: 0.05, step: 0.001 },
  bk_div: { value: 0.012, min: 0, max: 0.05, step: 0.001 }, // 일요일 밤 배당 (한 주 내내 들고 있던 만큼의 지금 값 대비)
  bt_drift: { value: 0.0016, min: -0.01, max: 0.01, step: 0.0002 }, bt_sigma: { value: 0.022, min: 0, max: 0.08, step: 0.002 },
  g_quiet_drift: { value: -0.0005, min: -0.01, max: 0.01, step: 0.0005 }, g_quiet_sigma: { value: 0.012, min: 0, max: 0.05, step: 0.001 },
  g_hype: { value: 0.004, min: 0, max: 0.03, step: 0.001 }, g_hype_sigma: { value: 0.02, min: 0, max: 0.06, step: 0.002 }, // 출시를 발표한 뒤 기대감
  g_hype_ticks: { value: 9, min: 3, max: 21, step: 1 }, // 발표부터 출시까지 (틱 — 9 = 사흘)
  g_hit_p: { value: 0.5, min: 0, max: 1, step: 0.05 }, g_hit: { value: 0.22, min: 0, max: 0.6, step: 0.01 }, g_flop: { value: 0.26, min: 0, max: 0.6, step: 0.01 }, // 출시 칸: 흥행이면 +, 아니면 −
  g_gap_min: { value: 12, min: 3, max: 60, step: 1 }, g_gap_max: { value: 20, min: 3, max: 90, step: 1 }, // 다음 발표까지 (틱)
  bd_drift: { value: 0.0005, min: -0.01, max: 0.01, step: 0.0001 }, bd_sigma: { value: 0.012, min: 0, max: 0.05, step: 0.001 },
  bd_beta: { value: 2.5, min: 0, max: 6, step: 0.5 }, // 일요일 밤 부동산 시세가 움직인 만큼의 몇 배로 따라 움직인다
  news_p_battery: { value: 0.5, min: 0, max: 1, step: 0.05 }, news_mag_battery: { value: 0.09, min: 0, max: 0.3, step: 0.01 },
  news_p_bank: { value: 0.2, min: 0, max: 1, step: 0.05 }, news_mag_bank: { value: 0.03, min: 0, max: 0.2, step: 0.005 },
  news_p_build: { value: 0.3, min: 0, max: 1, step: 0.05 }, news_mag_build: { value: 0.06, min: 0, max: 0.2, step: 0.005 },

  // ── 공부 = 성장: 공부한 횟수가 쌓여 단계가 오른다 (1 → 6). 정확도는 2 · 4 · 6단계에서 know_acc_step 씩, 3단계부터 한 번에 두 종목 ──
  know_n2: { value: 2, min: 1, max: 20, step: 1 }, know_n3: { value: 5, min: 1, max: 40, step: 1 }, know_n4: { value: 9, min: 1, max: 60, step: 1 },
  know_n5: { value: 14, min: 1, max: 80, step: 1 }, know_n6: { value: 20, min: 1, max: 100, step: 1 },
  know_acc_step: { value: 0.04, min: 0, max: 0.15, step: 0.01 }, // 6단계에서 리포트를 따라 하루 든 화끈식품의 기대 수익이 5% 아래에 머물게 ("공부하기가 너무 사기" 뒤의 선)

  // ── 물건 (가게): 옷은 입은 한 벌만 효과, 살림 · 사치품은 사면 그대로 ──
  cost_vest: { value: 300000, min: 0, max: 5000000, step: 50000 }, item_vest: { value: 0.15, min: 0, max: 0.5, step: 0.05 }, // 작업 조끼: 상하차 · 배달 체력 −
  cost_padding: { value: 800000, min: 0, max: 10000000, step: 100000 }, item_padding: { value: 6, min: 0, max: 30, step: 1 }, // 롱패딩: 밤 회복 +
  cost_suit: { value: 5000000, min: 0, max: 50000000, step: 500000 }, item_suit: { value: 0.1, min: 0, max: 0.5, step: 0.05 }, // 정장: 사업 매출 · 대출 한도 +
  cost_gold: { value: 30000000, min: 0, max: 500000000, step: 1000000 }, item_gold: { value: 0.05, min: 0, max: 0.3, step: 0.01 }, // 금빛 운동복: 일당 +
  cost_mat: { value: 1500000, min: 0, max: 20000000, step: 100000 }, item_mat: { value: 5, min: 0, max: 30, step: 1 }, // 매트리스: 밤 회복 +
  cost_chair: { value: 6000000, min: 0, max: 50000000, step: 500000 }, item_chair: { value: 8, min: 0, max: 30, step: 1 }, // 안마의자: 쉬기 +
  cost_ginseng: { value: 2000000, min: 0, max: 20000000, step: 100000 }, item_ginseng: { value: 10, min: 0, max: 50, step: 1 }, // 홍삼: 최대 체력 +
  cost_watch: { value: 100000000, min: 0, max: 1000000000, step: 10000000 }, item_watch: { value: 40, min: 0, max: 200, step: 5 }, // 손목시계: 신용점수 +
  cost_car: { value: 1000000000, min: 0, max: 10000000000, step: 100000000 }, item_car: { value: 10, min: 0, max: 50, step: 1 }, // 스포츠카: 최대 체력 +
  // 꿈(이야기)의 둘째 장면에서 얻는 것
  dream_family: { value: 8, min: 0, max: 30, step: 1 }, // 가족과 한 지붕: 밤 회복 +
  dream_sign: { value: 0.1, min: 0, max: 0.5, step: 0.05 }, // 간판을 다시 건다: 사업 매출 +
  dream_landlord: { value: 0.1, min: 0, max: 0.5, step: 0.05 }, // 쫓겨나지 않는 사람: 임대수익 +

  // ── 미니게임의 시작: 준비 시간 · 느린 시작 ("시작이 너무 빠름 키보드로 손 가다가 몇개 놓침 — 천천히 가다가 점점 빨라지는 방식") ──
  mg_ready: { value: 1.3, min: 0.5, max: 3, step: 0.1 }, // "준비" 가 떠 있는 시간(초)
  mg_warm: { value: 0.55, min: 0.3, max: 1, step: 0.05 }, // 시작할 때의 빠르기 (본래의 몇 배) — mg_warm_sec 동안 1 까지 올라간다
  mg_warm_sec: { value: 2.6, min: 0, max: 6, step: 0.2 },
};
