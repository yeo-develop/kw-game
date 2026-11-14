// PROTOTYPE - NOT FOR PRODUCTION
// Question: 상태창이 시키는 대로 알바 → 방 → 투자 → 집으로 올라가는 한 판이, 뭘 해야 할지 늘 분명하면서 20분 동안 재미있는가?
// Date: 2026-11-12
// 조율 값은 전부 여기 있다. 값마다 value · min · max · step. 게임은 tune.<이름> 으로 그때그때 읽는다.
// 돈의 단위는 원. 시세가 움직이는 한 번을 "틱"이라 부른다 (하루 3틱 = 칸마다 1틱).
window.CONFIG = {
  seed: 1, // 게임의 모든 난수는 이 씨앗에서 나온다 (주소에 ?seed= 로 바꿀 수 있음)
  volume: { value: 0.5, min: 0, max: 1, step: 0.05 },

  // ── 한 판의 목표: 기한 없음. 내 집(1막 끝) → 아파트 → 주택 → 별장 → 호텔 → 한국 최고 부자(엔딩). 값은 오르지 않는다 ──
  price_home: { value: 15000000, min: 5000000, max: 100000000, step: 1000000 }, // 내 집 (현금으로만). 봇 biz 중앙 24일째. 그 위는 사업 배수와 같은 5배 간격
  price_apt: { value: 80000000, min: 20000000, max: 600000000, step: 5000000 }, // 아파트 (주담대는 여기부터)
  price_house: { value: 400000000, min: 100000000, max: 3000000000, step: 50000000 }, // 주택
  price_villa: { value: 2000000000, min: 500000000, max: 10000000000, step: 100000000 }, // 별장
  price_hotel: { value: 10000000000, min: 2000000000, max: 40000000000, step: 500000000 }, // 호텔
  top_worth: { value: 35000000000, min: 10000000000, max: 200000000000, step: 1000000000 }, // 한국 최고 부자: 호텔에서 순자산이 이만큼이면 선언 = 엔딩
  week_home: { value: 600000, min: 0, max: 5000000, step: 50000 }, // 주 고정비 (관리비 · 세금). 일요일 밤, 그 주에 산 날만큼
  week_apt: { value: 3000000, min: 0, max: 20000000, step: 100000 },
  week_house: { value: 15000000, min: 0, max: 100000000, step: 500000 },
  week_villa: { value: 75000000, min: 0, max: 500000000, step: 5000000 },
  week_hotel: { value: 375000000, min: 0, max: 2500000000, step: 25000000 },
  act1_s: { value: 20, min: 5, max: 60, step: 1 }, // 1막 끝(내 집) 등급: 이 날까지 S · 다음 A · 다음 B · 그 뒤 C
  act1_a: { value: 24, min: 5, max: 80, step: 1 },
  act1_b: { value: 30, min: 5, max: 100, step: 1 },
  rank_s: { value: 70, min: 20, max: 200, step: 1 }, // 엔딩(최고 부자) 등급: 걸린 날 수
  rank_a: { value: 76, min: 20, max: 250, step: 1 },
  rank_b: { value: 86, min: 20, max: 300, step: 1 },
  // 주담대 (아파트부터): 집값의 loan_ltv 까지 빌린다. 일요일 밤마다 loan_weeks 회에 나눠 갚고(원금 = 빌린 돈 ÷ 회수), 남은 돈에는 한 주에 loan_rate 씩 이자가 붙는다
  loan_ltv: { value: 0.8, min: 0, max: 0.9, step: 0.05 }, // 집값 가운데 빌릴 수 있는 몫 (나머지는 현금 · 살던 집 판 돈)
  loan_rate: { value: 0.02, min: 0, max: 0.05, step: 0.001 }, // 한 주 이자 (남은 돈에)
  loan_weeks: { value: 6, min: 2, max: 60, step: 1 }, // 몇 회(일요일)에 나눠 갚나. 적을수록 매주 짐이 무겁다 — 최대로 빌리고 사업을 못 키우면 버티기 어렵게
  foreclose_rate: { value: 0.95, min: 0.3, max: 1, step: 0.05 }, // 두 번 연속 못 내면 압류: 산 값의 이만큼에 팔리고 바로 아래 집으로 (늘 한 단계. 못 갚은 빚은 아래 집 대출에 얹힘)
  // 사업: 알바 → 가게 → 법인 → 그룹 → 대기업 → 재벌. 일당 × biz_mult^단계. 단계 n 은 사는 곳 tier 3 + n(가게 = 내 집 …)부터
  biz_mult: { value: 5, min: 1.5, max: 10, step: 0.5 },
  // 자동 수입: 가게부터는 직원이 있어서, 일하지 않은 칸(쉬기 · 공부)에도 그 칸의 "보통" 일당 × 이만큼이 들어온다 (반영되는 단계 기준)
  biz_auto_1: { value: 0.3, min: 0, max: 1, step: 0.05 },
  biz_auto_2: { value: 0.5, min: 0, max: 1, step: 0.05 },
  biz_auto_3: { value: 0.7, min: 0, max: 1, step: 0.05 },
  biz_auto_4: { value: 0.7, min: 0, max: 1, step: 0.05 },
  biz_auto_5: { value: 0.85, min: 0, max: 1, step: 0.05 },
  biz_cost_1: { value: 3000000, min: 1000000, max: 50000000, step: 1000000 }, // 가게 (쓴 돈은 자산으로 안 남는다)
  biz_cost_2: { value: 15000000, min: 5000000, max: 300000000, step: 5000000 }, // 법인
  biz_cost_3: { value: 75000000, min: 20000000, max: 1000000000, step: 10000000 }, // 그룹
  biz_cost_4: { value: 375000000, min: 50000000, max: 5000000000, step: 50000000 }, // 대기업
  biz_cost_5: { value: 1875000000, min: 200000000, max: 30000000000, step: 100000000 }, // 재벌
  // 돈의 크기: 정해진 금액(돌발 사건 · 퀘스트 보상 · 도박장 판돈)에 사는 곳마다 곱하는 배수 (원룸까지는 1)
  tier_scale_4: { value: 3, min: 1, max: 20, step: 1 },
  tier_scale_5: { value: 15, min: 1, max: 100, step: 1 },
  tier_scale_6: { value: 75, min: 1, max: 1000, step: 5 },
  tier_scale_7: { value: 375, min: 1, max: 5000, step: 25 },
  tier_scale_8: { value: 1875, min: 1, max: 20000, step: 125 },
  // 내 집부터 밤에 자면 돌아오는 체력 (다 차지 않게 — 무거운 알바 셋 = 72 보다 작게)
  regen_max: { value: 66, min: 30, max: 120, step: 1 }, // 하룻밤 잠 + 아침형 인간으로 돌아오는 체력의 상한 (특성을 몰아도 무거운 알바 셋 = 72 를 못 메움)
  sleep_home: { value: 58, min: 0, max: 100, step: 1 },
  sleep_apt: { value: 60, min: 0, max: 100, step: 1 },
  sleep_house: { value: 62, min: 0, max: 100, step: 1 },
  sleep_villa: { value: 64, min: 0, max: 100, step: 1 },
  sleep_hotel: { value: 66, min: 0, max: 100, step: 1 },

  // ── 알바: 한 칸 일당과 체력 소모 ─────────────────────────────
  pay_flyer: { value: 90000, min: 30000, max: 300000, step: 10000 },
  pay_loading: { value: 170000, min: 50000, max: 500000, step: 10000 },
  pay_store: { value: 130000, min: 50000, max: 400000, step: 10000 },
  pay_delivery: { value: 180000, min: 50000, max: 500000, step: 10000 },
  hp_flyer: { value: 10, min: 0, max: 50, step: 1 },
  hp_loading: { value: 24, min: 0, max: 60, step: 1 },
  hp_store: { value: 9, min: 0, max: 50, step: 1 },
  hp_delivery: { value: 24, min: 0, max: 60, step: 1 },
  // 미니게임 결과별 일당 배율 (실수 · 보통 · 잘함 · 완벽 · 대충 하기)
  mult_miss: { value: 0.8, min: 0.2, max: 1, step: 0.05 },
  mult_ok: { value: 1.0, min: 0.5, max: 1.5, step: 0.05 },
  mult_good: { value: 1.2, min: 0.8, max: 2, step: 0.05 },
  mult_perfect: { value: 1.4, min: 1, max: 3, step: 0.05 },
  mult_skip: { value: 0.8, min: 0.2, max: 1.2, step: 0.05 },
  mg_seconds: { value: 7, min: 4, max: 15, step: 0.5 }, // 미니게임 한 번의 길이 (초)
  mg_level_speed: { value: 0.16, min: 0, max: 0.4, step: 0.02 }, // 숙련 단계마다 미니게임 기본 속도 +
  mg_ramp: { value: 0.4, min: 0, max: 1.5, step: 0.05 }, // 한 판 안에서 끝으로 갈수록 빨라지는 정도 (끝에서 +40%)
  // 숙련도: 같은 알바를 n1 · n2 · n3 번 하면 한 단계씩 오르고, 단계마다 일당이 skill_bonus 만큼 오른다
  skill_bonus: { value: 0.08, min: 0, max: 0.3, step: 0.01 },
  skill_n1: { value: 3, min: 1, max: 10, step: 1 },
  skill_n2: { value: 7, min: 2, max: 20, step: 1 },
  skill_n3: { value: 12, min: 3, max: 40, step: 1 },

  // ── 체력 ────────────────────────────────────────────────────
  start_hp: { value: 45, min: 10, max: 100, step: 5 },
  rest_hp: { value: 22, min: 5, max: 60, step: 1 }, // 쉬기 한 칸
  rest_hp_station: { value: 12, min: 0, max: 60, step: 1 }, // 서울역에서는 쉬어도 덜 풀린다
  sleep_station: { value: 20, min: 0, max: 100, step: 5 }, // 밤에 자면 돌아오는 체력 (잠만으로는 다 안 찬다 — 무거운 알바 셋을 매일 뛸 수 없게)
  sleep_sauna: { value: 35, min: 0, max: 100, step: 5 },
  sleep_gosiwon: { value: 45, min: 0, max: 100, step: 5 },
  sleep_oneroom: { value: 55, min: 0, max: 100, step: 5 },
  meal_cost: { value: 20000, min: 0, max: 100000, step: 5000 }, // 하루 끼니 (서울역 · 찜질방에서만. 고시원부터는 주 고정비에 들어 있음)
  meal_skip_hp: { value: 15, min: 0, max: 50, step: 1 }, // 돈이 없어 굶으면 깎이는 체력

  // ── 주거: 들어갈 기준(순자산, 가져가지 않음)과 매주 나가는 돈 ──
  sauna_night: { value: 15000, min: 0, max: 100000, step: 5000 }, // 찜질방 하룻밤
  gosiwon_need: { value: 1500000, min: 100000, max: 3000000, step: 100000 }, // 고시원 입주 기준 순자산 (보증금 없음)
  gosiwon_week: { value: 500000, min: 0, max: 2000000, step: 50000 }, // 고시원 주 고정비 (방세 · 끼니 · 통신). 일요일 밤, 그 주에 산 날만큼
  oneroom_need: { value: 5000000, min: 1000000, max: 20000000, step: 500000 }, // 원룸 입주 기준 순자산
  oneroom_week: { value: 1800000, min: 0, max: 5000000, step: 100000 }, // 원룸 주 고정비
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
  study_acc: { value: 0.62, min: 0.5, max: 1, step: 0.01 }, // 공부(리포트)가 맞을 확률. 확신이 아니라 한쪽으로 기울여 주는 단서
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
};
