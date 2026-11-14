// PROTOTYPE - NOT FOR PRODUCTION
// Question: 상태창이 시키는 대로 알바 → 방 → 투자 → 집으로 올라가는 한 판이, 뭘 해야 할지 늘 분명하면서 20분 동안 재미있는가?
// Date: 2026-11-12
// 조율 값은 전부 여기 있다. 값마다 value · min · max · step. 게임은 tune.<이름> 으로 그때그때 읽는다.
// 돈의 단위는 원. 시세가 움직이는 한 번을 "틱"이라 부른다 (하루 3틱 = 칸마다 1틱).
window.CONFIG = {
  seed: 1, // 게임의 모든 난수는 이 씨앗에서 나온다 (주소에 ?seed= 로 바꿀 수 있음)
  volume: { value: 0.5, min: 0, max: 1, step: 0.05 },

  // ── 한 판의 목표 ─────────────────────────────────────────────
  house_price: { value: 31000000, min: 10000000, max: 60000000, step: 1000000 }, // 1주차 집값
  house_growth: { value: 0.07, min: 0, max: 0.2, step: 0.01 }, // 매주 오르는 비율
  days: { value: 28, min: 7, max: 56, step: 7 }, // 한 판의 길이 (일)

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
  gosiwon_need: { value: 500000, min: 100000, max: 3000000, step: 100000 }, // 고시원 입주 기준 순자산 (보증금 없음)
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
  h_gather: { value: 0.02, min: 0, max: 0.06, step: 0.002 },
  h_pump: { value: 0.09, min: 0.02, max: 0.25, step: 0.01 },
  h_dump: { value: -0.17, min: -0.4, max: -0.02, step: 0.01 },
  c_sigma: { value: 0.05, min: 0, max: 0.15, step: 0.005 }, // 달나라코인
  c_momentum: { value: 0.12, min: 0, max: 0.8, step: 0.05 }, // 직전 움직임이 이어지는 정도
  // 뉴스: 아침마다 종목별로 나올 확률, 하루 동안 움직이는 크기, 출처별로 사실일 확률
  news_p_buldak: { value: 0.8, min: 0, max: 1, step: 0.05 },
  news_p_daejang: { value: 0.5, min: 0, max: 1, step: 0.05 },
  news_p_coin: { value: 0.7, min: 0, max: 1, step: 0.05 },
  news_mag_buldak: { value: 0.14, min: 0, max: 0.3, step: 0.01 },
  news_mag_daejang: { value: 0.05, min: 0, max: 0.2, step: 0.005 },
  news_mag_coin: { value: 0.1, min: 0, max: 0.4, step: 0.01 },
  rel_official: { value: 0.9, min: 0.5, max: 1, step: 0.05 }, // 공시
  rel_article: { value: 0.72, min: 0.5, max: 1, step: 0.02 }, // 기사
  rel_rumor: { value: 0.5, min: 0.3, max: 1, step: 0.05 }, // 찌라시
  fake_back: { value: 0.6, min: 0, max: 1.5, step: 0.1 }, // 거짓 뉴스일 때 반대로 가는 크기 (뉴스 크기 대비)
  study_acc: { value: 0.82, min: 0.5, max: 1, step: 0.05 }, // 공부(리포트)가 맞을 확률
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
  perk_legs: { value: 0.01, min: 0, max: 0.03, step: 0.005 }, // 발품: 집값 인상률을 깎음
  perk_sense: { value: 0.03, min: 0, max: 0.1, step: 0.01 }, // 눈치: 리포트 정확도
  perk_guts: { value: 0.3, min: 0, max: 0.8, step: 0.05 }, // 강심장: 청산 때 건지는 비율
  perk_tip_acc: { value: 0.75, min: 0.5, max: 1, step: 0.05 }, // 정보통: 아침 귀띔이 맞을 확률
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
};
