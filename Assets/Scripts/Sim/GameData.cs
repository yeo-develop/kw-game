using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace KwGame.Sim
{
    // data/*.json 을 평평하게 합친 테이블 (web/src/sim/core.js D). JSON 키 순서를 그대로 유지한다 (규칙이 순서에 기대는 곳이 있음).

    public class Rules
    {
        public double DEBT0, CASH0, RATE, DEBT_CAP, FEE_APP, FEE_BROKER, COIN_FEE, FUNDING, INTRA, ENCOUNTER_P, RSCH_FEE;
        public int MONTH_DAYS, SLOTS, RSCH_PAID_MAX, WRITE_MAX, SCRATCH_MAX, LOTTO_MAX;
        public double SCRATCH_PRICE, LOTTO_PRICE, LOAN_FEE, LOAN_FEE_BRO;
        public int[] STOCK_SLOTS;
        public double[] LOAN_CAP, LOAN_AMTS, LIQ_LOSS, RELIC_TIER_W;
        public Dictionary<string, double> PC_COST, HP_COST, ADD_GAIN, RELIC_PRICE;
        public double HP_MAX, HP_SLEEP, HP_REST, HP_REST_EVE, HP_LOW, HP_FAINT_BACK, HP_FAINT_COST;
        public double ADD_DECAY, ADD_SLOT_DECAY, ADD_STICKY, ADD_NAG, ADD_SECRET, ADD_TEMPT, ADD_WITHDRAW, ADD_COIN_LEV;
        public double IMPULSE_P, IMPULSE_CASH, GACHA_PRICE, GACHA_JUNK;
        /// 목장갑(grind) 일당 배율. 996af67 데이터엔 없음(코드 상수 1.3) → v3.3b 에서 rules.json 으로 빠짐 (1.15)
        public double GRIND_PAY = 1.3;
        // 실시간 모드 (GameSim.Realtime.cs). 시각은 하루 중 분 (480 = 08:00)
        public int RT_DAY0 = 480, RT_CANDLE = 30, RT_HIST = 160, RT_REST = 180, RT_ACT = 120, RT_WORK = 300;
        public int[] RT_SLOT_END = { 720, 1080, 1440 }, RT_STOCK = { 540, 930 };
        public double RT_VOL = 2, RT_LIMIT = 0.3, RT_SPEED = 10.0 / 15, RT_WARN_P = 0.05, RT_WARN_LOW_P = 0.15, RT_DELIST_P = 0.5, RT_DELIST_AT = 0.03;
        // 실시간 모드 체력·멘탈: 알바 무지성 반복·집에서 쉬기만 하기 막기 (턴 모드는 위 HP_* 그대로)
        public double RT_HP_SLEEP = 35, RT_HP_REST = 20, RT_HP_REST_EVE = 10, RT_REST_ST = -8, RT_WORK_ST = 12, RT_WORK_ST_STREAK = 4, RT_DUE_ST = 2, RT_ANX_PAY = 0.9, RT_MEN_PAY = 0.7;

        // 실시간 모드 스트레스 관리·병 (GameSim.Health.cs): 놀거리는 같은 날 반복할수록 효과 ×RELAX_DIM, 병 확률 = (기본 + 스트레스·체력·숙취) × 운동
        // 실시간 모드 밸런스 (피드백: OP 유물·유료 리포트)
        public double RT_DIVI = 0.003, RT_WHALE_HIT = 0.6, RT_WHALE_VOL = 1.5, RT_MEME_UP = 0.42, RT_INSURE = 0.3, RT_INVERSE = 0.1, RT_RSCH_FEE = 100000, RT_REP_ACC = -0.12, RT_IGNORE_N = 3, RT_IGNORE_ST = 3;
        // 알바·하이로우 (피드백: 알바비 7만~14만 · 컨디션 따라 일당 안 바뀜 · 하이로우 너무 쉬움 → 같은 숫자면 딜러 승 + 배당 ×0.9)
        public double RT_JOB_PAY0 = 70000, RT_JOB_PAYV = 70000, RT_HL_EDGE = 0.9, RT_VIP_ACC = 0.07, RT_CASH0 = 300000;
        /// 실시간 주 이자율. 바꾸면 하드코딩된 '5%' 문구도 같이: GameController.Screens.cs · scenes.json(150만) · tutorial.json · augments.json(loanbro 5→4%)
        public double RT_RATE = 0.05;
        /// 실시간 엔딩 추가분: bad3 = 기절 N번째(과로) · bad4 = 멘헤라 나쁜 답장 연속 N번(착한 답장이면 리셋, 마지막 답장 직전 스트레스 꽉 참) · 클리어 rich = 갚는 순간 총자산(현금+보유) 이상
        public double RT_FAINT_END = 3, RT_MEN_END_BAD = 10, RT_MEN_END_ST = 100, RT_RICH = 50000000;
        public Dictionary<string, RelaxDef> RELAX; public Dictionary<string, SickDef> SICK;
        public double RELAX_DIM = 0.6, SICK_P0 = 0.02, SICK_ST0 = 50, SICK_ST_K = 0.006, SICK_HP = 0.2, SICK_HANG = 0.1, SICK_FIT = 0.5, SICK_FLU_ST = 80, HANG_HP = 10, PHARM_COST = 8000, CLINIC_COST = 60000, VITA_COST = 15000;

        // v4 리디자인 (docs/V4.md, unity_v4.json V4_RULES). V4 = 0 이면 예전 실시간 그대로
        public int V4 = 0, V4_DAYS = 28, V4_WEEKDAYS = 5;
        public double V4_WATCH_SPEED = 2, V4_AFF0 = 50, V4_AFF_GOOD = 60, V4_AFF_HEIST = 85, V4_GREED_HEIST = 50, V4_DATE_AFF = 6, V4_DATE_ST = -12, V4_PROM_OK = 8, V4_PROM_BAD = -10, V4_AFF_SOFT = 120, V4_AFF_DECAY = 4, V4_DUO_DEBT = 0.5, V4_GREED_DECAY = 3, V4_GREED_DECAY_HEIST = 1, V4_PART2_DEBT = 100000000;
        /// 장(=달)별 시장 국면 기본값 (V4_SCEN 시나리오가 없을 때): 시장 수익률 가산(칸당) · 코인 가산 · 변동성 배수
        public double[] V4_CH_MKT = { 0, 0.006, 0.004, -0.012 }, V4_CH_COIN = { 0, 0.015, 0.01, -0.025 }, V4_CH_VOL = { 1, 1, 1.5, 1.3 };
        public string[] V4_HIDE_LOCS = { };
        /// 장별 좋은 뉴스 확률 · 칸마다 뉴스 확률 · 이자일 급매 손해 · 직종 배율
        public double[] V4_CH_NEWSUP = { 0.5, 0.7, 0.6, 0.25 };
        /// 국면 시나리오 (판마다 씨앗으로 하나, 2부는 다른 것): V4_REG 이름 → [시장 가산, 코인 가산, 변동성 배수, 좋은 뉴스 확률]. V4_SCEN = 장 1~4 국면 순서 목록. 없으면 V4_CH_* 고정
        public Dictionary<string, double[]> V4_REG; public string[][] V4_SCEN;
        /// 가짜 뉴스 되돌림: 가짜 속보 종목은 실제로 반대 방향 (뉴스 크기 × 이 범위, '선반영 후 되돌림')
        public double V4_FAKE_LO = 0, V4_FAKE_HI = 0;
        /// 밤에 푹 자면 다음 날 무료 리포트 +이만큼
        public int V4_SLEEP_RSCH = 0;
        public double V4_NEWS_P = 0.5, V4_FIRESALE = 0.2;
        /// 2부: 알바 경력 배율 · 국면 세기 배율 (빚 1억이라 1부 수치로는 못 갚음)
        public double V4_P2_PAY = 1, V4_P2_REGIME = 1;
        /// 2부 시작 때 굴릴 돈 바닥 (가진 돈이 이보다 적으면 김사장이 채워 줌 — 1억에 포함된 판돈). 0 = 없음
        public double V4_P2_CASH;
        public Dictionary<string, double> V4_JOB_MULT;
        /// v4 체력 삭제 (BLUEPRINT ②: 자원 = 현금·빚·스트레스·호감). 1 이면 체력이 안 깎이고 화면에서도 뺌. 알바 차이는 스트레스로 (V4_JOB_ST: 알바별 스트레스 배수)
        /// v4 하루 무료 리포트 (기본 1 에 더하는 수)
        public int V4_FREE_REP = 1;
        public int V4_NO_HP; public Dictionary<string, double> V4_JOB_ST;
        /// 알바 중 몰래 폰 보기 (BLUEPRINT ①): 알바별 들킬 확률 (1 이상 = 폰을 못 꺼냄. 없으면 예전 경보 확률) · 볼 때마다 일당이 깎이는 비율
        public Dictionary<string, double> V4_PEEK; public double V4_PEEK_PAY = 0.15;
        /// 작전주 (GameSim.Op.cs · docs/BLUEPRINT_V3.md): 켜기 · 후보 주식 · 주차별 개수 · 봉당 상승 · 봉당 열기 · 열기 상한 범위 · 설거지 확률 계수와 시작 열기 · 전조/헛전조 확률 · 풀리는 날 갭
        public double V4_OP = 0; public string[] V4_OP_TK = { }; public int[] V4_OP_WEEK = { };
        public double[] V4_OP_UP = { 0.007, 0.015 }, V4_OP_HEAT = { 2, 4 }, V4_OP_CAP = { 35, 100 }, V4_OP_GAP = { 0.10, 0.20 }, V4_OP_VOL_ACC = { 2, 3 }, V4_OP_VOL_PUMP = { 4, 8 };
        public double V4_OP_HZ = 0.12, V4_OP_HZ0 = 25, V4_OP_PRE = 0.85, V4_OP_FAKEPRE = 0.12, V4_OP_FAKE = 0.35, V4_OP_VOL_DUMP = 10, V4_OP_TEMP_NOISE = 8;
        /// 미끄러짐 = V4_OP_SLIP × 주문 금액 ÷ (봉당 거래대금 × 그 봉 거래량 배수), 최대 V4_OP_SLIP_MAX
        public double V4_OP_SLIP = 0.5, V4_OP_SLIP_MAX = 0.15, V4_OP_TURN = 4e7; public Dictionary<string, double> V4_OP_TURN_TK;
        /// 기둥 연결: 호감 구간 버프 문턱 [도시락, 미래의 감, 응원] · 도시락 = 아침 스트레스 −N · 응원 = 일당 배수 · 알바 점수가 이 이상이면 손님 정보(분석가 전적 +1건)
        public double[] V4_BUFF_AFF; public double V4_BUFF_LUNCH = 5, V4_BUFF_CHEER = 1.1, V4_WORK_INFO = 0.7;
        /// 미래의 감이 맞을 확률 (그날 첫 속보가 진짜인지 가짜인지 — 틀릴 때도 있음. 100% 면 "경고가 없으면 진짜"가 돼 버림)
        public double V4_SENSE_ACC = 0.8;
        /// 그날 결과 4종 (정산 카드 · 밤의 미래): 낮 매매 실현손익이 +BIG 이상 = 대박, −LOSS 이하 = 손실 (청산이 있었으면 청산). 대박이면 욕심 +GREED
        public double V4_NIGHT_BIG = 1000000, V4_NIGHT_LOSS = 500000, V4_NIGHT_GREED = 4;
        /// 신용 단계(이자 낸 횟수): 김사장 대출 열리는 단계 (초반 = 시드머니 모으기)
        public int V4_CREDIT_LOAN = 0;
        /// 레버리지 = 실적: 실현수익 누적이 V4_LEV_PROFIT[i] 넘으면 코인 최대 배율 V4_LEV_CAP[i] (한 번 열리면 계속)
        public double[] V4_LEV_PROFIT = { 0 }, V4_LEV_CAP = { 1000 };
        /// 숏 해금 = 실적: 매매 실현수익 누적이 이만큼 넘으면 (한 번 열리면 계속)
        public double V4_SHORT_PROFIT = 0;
        /// 시간대 비중: 평일 낮 놀기 호감 배수 · 저녁 놀기 호감 배수 · 저녁 알바 일당 배수
        public double V4_DATE_DAY = 1, V4_DATE_EVE = 1, V4_WORK_EVE = 1;
        /// 난이도 (easy·normal·hard) 배수: rate(주 이자, 절대값) · cash(시작 현금) · pay(알바) · duo(같이 원양어선 빚 문턱, 절대값) · decay(호감 감쇠) · imp(돌발 매수 확률)
        public Dictionary<string, Dictionary<string, double>> V4_DIFF;
        /// 알바 중 청산 경보: 레버리지 포지션 손실이 증거금의 V4_ALERT_LOSS 를 넘으면 한 칸에 한 번 끼어듦 (0 = 끔). 몰래 폰 보면 일당 ×V4_ALERT_PAY, V4_ALERT_CAUGHT 확률로 들켜 일당 0
        public double V4_ALERT_LOSS = 0, V4_ALERT_PAY = 0.7, V4_ALERT_CAUGHT = 0.35;
        /// 주간 납부 관문 (docs/BLUEPRINT.md ②③): 주 w 이자일 뒤 빚이 V4_GATE_CAP[w-1] 이하여야 함 (원금 분납). null = 끔 (이자만)
        /// 못 낸 원금엔 V4_LATE_FEE 연체료, V4_MISS_MAX 주 연속 미납이면 만기 전에 끌려감. 통과할 때마다 유물 1개 + 증거금 상한 한 단계
        public double[] V4_GATE_CAP; public double V4_LATE_FEE = 0.1; public int V4_MISS_MAX = 2, V4_SHORT_WEEK = 2, V4_LOAN_GATE = 1;   // 숏은 2주차부터 · 대출은 첫 납부 통과 뒤
        /// 관문 규칙: 한 주에 새로 빌릴 수 있는 돈 (그 주 원금 분납에선 빼 줌 = 다음 주로 미루는 다리). 0 = 제한 없음
        public double V4_LOAN_WEEK;
        /// 코인 증거금 합계 상한 = 주차별 (마지막 값이 끝까지). 배율은 처음부터 자유 — 기능이 아니라 금액을 묶음. 무제한 없음 (장만 보는 게 알바를 이기지 않게)
        public double[] V4_MARGIN_CAP;
        /// 읽어야 하는 시장 (BLUEPRINT ①③): 후속 속보(확정/부인)가 뜰 확률 · 그게 맞을 확률
        public double V4_FOLLOW_P = 0, V4_FOLLOW_ACC = 1;
        /// 분석가 (unity_v4.json V4_AN): 리포트는 분석가 중 하나가 씀. 적중률 V4_AN_ACC 를 판마다 섞어 숨김 (전적으로만 드러남), 틀리면 반대로 움직임. 코인 리포트 비율 · 코인일 때 충격 배수
        public double[] V4_AN_ACC; public double V4_AN_COINP = 0.5, V4_AN_COIN = 1;
        /// 코인 발표 폭 = 기본 × (그 코인 변동성 / V4_AN_VOL0), 최대 V4_AN_VOLX 배 (대장코인 기준 1배)
        public double V4_AN_VOL0 = 0.037, V4_AN_VOLX = 3.5;
        /// 분석가마다 시작할 때 보이는 지난 전적 건수 (진짜 적중률로 뽑음 → 첫날부터 읽을 거리)
        public int V4_AN_PRIOR;
        /// 속보 종목의 칸 초반(30% 지점) 움직임 = 뉴스 크기 × [lo, hi] 사이 (진짜·가짜 같은 분포 → 초반 시세만으론 못 가림). null = 끔
        public double[] V4_EARLY;
        /// 신호 대 잡음: v4 변동성 배수(0 = RT_VOL 그대로) · 속보 종목 뽑기에서 코인 가중 · 리포트가 코인을 다룰 확률 (결과가 1~2칸 뒤 → 잡고 자리를 비울 이유)
        public double V4_VOL = 0, V4_NEWS_COIN_W = 1, V4_NEWS_COIN_MAG = 1, V4_TIP_MAG = 1;   // V4_TIP_MAG = 찌라시(리포트 말고) 충격 배수

        /// 스토리 "미래의 미래" (GameSim.Story.cs): 복학 통장 금액(0 = 기능 꺼짐) · 드러나는 날 · 등록 마감일 · 깨는 단위 · 깰 때 호감/스트레스 · 욕심 단계 문턱 3개 · 날짜 장면이 밀릴 수 있는 날 수
        public double V4_FUND, V4_FUND_UNIT, V4_FUND_AFF, V4_FUND_ST; public int V4_FUND_DAY, V4_REG_DAY, V4_EV_LATE; public double[] V4_GREED_STEPS;

        public double HpCost(string k) => HP_COST != null && HP_COST.TryGetValue(k, out var v) ? v : 0;
        public double Gain(string k) => ADD_GAIN != null && ADD_GAIN.TryGetValue(k, out var v) ? v : 0;
    }

    public class Ticker
    {
        public string id, name, type, ic, d, @lock;
        public double p0, vol, beta, tr, maxLev;
        public bool inv, meme;
        /// inv 가 따라가는 종목 (없으면 시장 전체 반대). junk = 관리종목·상장폐지 대상. cat = 화면 분류. nmag = 뉴스 크기 배수
        public string of, cat; public bool junk; public double nmag = 1;
        /// 실시간: 이 날(absDay)부터 상장. 0 = 처음부터. 초보 과부하 줄이려고 주차마다 늘림
        public int day;
        public bool IsCoin => type == "coin";
        public bool IsStock => type == "stock";
    }

    public class Job { public string id, name, ic, bg; public double @base, var, hp; public List<string> lines; }

    public class Source
    {
        public string id, tier, ic, name, npc, line;
        public double acc, pd, trust, ret, cost;
        /// bar = 포차 옆 테이블 (길거리 만남엔 안 나옴)
        public bool bar;
        public double? pre, up;
        public double[] mag; public int[] lag;
        public bool stock, coin, meme;
        /// v4 분석가 (리포트를 쓰는 사람). 적중률은 판마다 섞임 — GameSim.anAcc
        public bool an; public string flav;
    }

    public class Aug { public string id, cat, ic, name, d, fl; public int tier; }
    public class Item { public string id, type, ic, name, d, line; public double p; public double? st; }
    /// rt = 실시간 모드에만 있는 장소 (공원·포차·병원)
    public class Loc { public string id, name, ic, bg, npc, hint; public double[] pos; public int[] open; public bool rt; }
    /// 놀거리 한 번: 돈 · 멘탈 · 체력 · 숙취 확률 · 운동(내일 병 확률↓) · 정보 들을 확률
    public class RelaxDef { public double cost, st, hp, hang, tip; public bool fit; }
    /// 병: 알바 점수 배율 · 매매 손떨림(체결가 손해) · 잠 회복 배율 · 아침마다 멘탈 · 앓는 날 [최소, 최대]
    public class SickDef { public string name, ic; public double pay, slip, sleep, st; public int[] d; }
    public class RandEv { public string t; public double cash, st, fame, hp; }
    public class KQDef { public string q, ok, good, bad; public string[] no; }
    /// 돌발 이벤트 (unity_events.json). lines = [who, text, face?] 목록, who: m·me·kim·nar
    /// day = v4 이야기 이벤트: 그 날(absDay, 2부도 1부터) 집에 오면 무조건 (랜덤 풀엔 안 들어감). part = 몇 부 이야기인지 (0 = 아무 때나)
    public class EvDef { /** when = 조건으로 뜨는 장면 ("liq" = 청산당한 날 밤). day 대신 */ public string when; /** 같은 묶음의 갈래는 한 번만 (본 표식 = (grp ?? id)@부) */ public string grp; public string id, title, bg, face; public List<string[]> lines; public int[] slots; public int minDay, maxDay, day, part, heistMin; public double minCash, minAddict; public List<EvOpt> opts; }
    /// v4: aff = 미래 호감 · greed = 욕심 · debtPct = 빚 비율 변화 (−0.3 = 30% 탕감)
    public class EvOpt { public string l, sub, who, res, face; public double need, p = 1, cash, st, hp, fame, addict, aff, greed, debtPct, debt; public int heist = -1; public bool go; public EvOpt fail; /** 스토리: fund = 복학 통장을 이 금액으로 엶 · reg 1 등록 / 2 안 함 · calm/ride = 말림/같이 탐 횟수 · mom 1 = 엄마가 빚을 앎 · fundBet 1 = 통장 전액을 판돈으로 · fundFill 1 = 모자란 통장을 현금으로 채움 */ public double fund; public int reg, calm, ride, mom, fundBet, fundFill; }   // heist: 털기 단계로 (−1 = 그대로) · go: 만기 밤에 턴다
    public class MenSet { public string[] msgs; public string last, ok, good, bad; public string[] no; /** "momNot" = 엄마가 빚을 알면 건너뜀 */ public string when; }
    public class ImpulseSet { public string line, ok, good, bad; public string[] no; }
    public class EndingDef
    {
        public string tag, h, bg, face; public bool ok;
        public Dictionary<string, string> hv, bgv; public Dictionary<string, int> noCharV;
    }
    public class GnDef { public double acc, w; public string ic, d; }

    public class GameData
    {
        public JObject J;
        public Rules RULES;
        public List<Ticker> TKList = new List<Ticker>();
        public Dictionary<string, Ticker> TK = new Dictionary<string, Ticker>();
        public Dictionary<string, List<(string h, int dir)>> NEWS = new Dictionary<string, List<(string, int)>>();
        public List<Job> JOBList = new List<Job>();
        public Dictionary<string, Job> JOBS = new Dictionary<string, Job>();
        public List<Source> SRCList = new List<Source>();
        public Dictionary<string, Source> SRC = new Dictionary<string, Source>();
        public List<Aug> AUGS;
        public Dictionary<string, string> TIER;
        public List<string> RELIC_JUNK;
        public List<Item> ITEMS;
        public Dictionary<string, string> DECOR_END;
        public List<Loc> LOCList = new List<Loc>();
        public Dictionary<string, Loc> LOCS = new Dictionary<string, Loc>();
        public Dictionary<string, List<string>> GREET;
        public List<string> SLOT_NAME, SLOT_IC, SLOT_CLOCK, SCRATCH_SYM, SLOT_SYM, RK, SU, HORSES, HY_TALK;
        public Dictionary<string, string> CAS_TITLE;
        public List<(string s, double amt, double p)> SC_PRIZE = new List<(string, double, double)>();
        public Dictionary<int, double> LOTTO_PRIZE = new Dictionary<int, double>();
        public List<(string name, double per, string unit)> CONV = new List<(string, double, string)>();
        public Dictionary<string, List<string[]>> GAL;
        public List<string> GNKeys; public Dictionary<string, GnDef> GN;
        public Dictionary<string, double> FAME;
        public List<(double f, string name, string desc)> RANKS = new List<(double, string, string)>();
        public Dictionary<string, List<string[]>> TIPT;
        public Dictionary<string, List<string>> CM, TIP_RES, MYCM, ML, KIM_DM, TIP_REACT;
        public Dictionary<string, string> GR_T;
        public Dictionary<string, int> HOT;
        public List<MenSet> MEN_SETS; public List<ImpulseSet> IMPULSE; public List<RandEv> MORNING_EV, PC_EV; public List<KQDef> KQ; public List<EvDef> EVENTS = new List<EvDef>();
        public Dictionary<string, EndingDef> ENDINGS;
        public JObject STR;
        public Dictionary<string, string> NPC_NAME = new Dictionary<string, string>();

        /// 파일별 JSON 문자열들을 이름순으로 합친다 (tools/load-data.mjs 와 같음)
        public static GameData Load(IEnumerable<KeyValuePair<string, string>> files)
        {
            var root = new JObject();
            foreach (var kv in files.OrderBy(k => k.Key, StringComparer.Ordinal))
            {
                var o = JObject.Parse(kv.Value);
                foreach (var p in o.Properties()) root[p.Name] = p.Value;
            }
            return FromJObject(root);
        }

        public static GameData FromJObject(JObject j)
        {
            mergeV4(j);
            var d = new GameData { J = j };
            d.RULES = j["RULES"].ToObject<Rules>();
            foreach (var p in ((JObject)j["TK"]).Properties())
            {
                var t = p.Value.ToObject<Ticker>(); t.id = p.Name;
                d.TKList.Add(t); d.TK[p.Name] = t;
            }
            foreach (var p in ((JObject)j["NEWS"]).Properties())
                d.NEWS[p.Name] = p.Value.Select(x => ((string)x[0], (int)x[1])).ToList();
            foreach (var p in ((JObject)j["JOBS"]).Properties())
            {
                var t = p.Value.ToObject<Job>(); t.id = p.Name; d.JOBList.Add(t); d.JOBS[p.Name] = t;
            }
            foreach (var p in ((JObject)j["SRC"]).Properties())
            {
                var t = p.Value.ToObject<Source>(); t.id = p.Name; d.SRCList.Add(t); d.SRC[p.Name] = t;
            }
            d.AUGS = j["AUGS"].ToObject<List<Aug>>();
            d.TIER = j["TIER"].ToObject<Dictionary<string, string>>();
            d.RELIC_JUNK = j["RELIC_JUNK"].ToObject<List<string>>();
            d.ITEMS = j["ITEMS"].ToObject<List<Item>>();
            d.DECOR_END = j["DECOR_END"].ToObject<Dictionary<string, string>>();
            foreach (var p in ((JObject)j["LOCS"]).Properties())
            {
                var t = p.Value.ToObject<Loc>(); t.id = p.Name; d.LOCList.Add(t); d.LOCS[p.Name] = t;
            }
            d.GREET = j["GREET"].ToObject<Dictionary<string, List<string>>>();
            d.SLOT_NAME = j["SLOT_NAME"].ToObject<List<string>>();
            d.SLOT_IC = j["SLOT_IC"].ToObject<List<string>>();
            d.SLOT_CLOCK = j["SLOT_CLOCK"].ToObject<List<string>>();
            d.SCRATCH_SYM = j["SCRATCH_SYM"].ToObject<List<string>>();
            d.CAS_TITLE = j["CAS_TITLE"].ToObject<Dictionary<string, string>>();
            d.SLOT_SYM = j["SLOT_SYM"].ToObject<List<string>>();
            d.RK = j["RK"].ToObject<List<string>>();
            d.SU = j["SU"].ToObject<List<string>>();
            d.HORSES = j["HORSES"].ToObject<List<string>>();
            foreach (var x in j["SC_PRIZE"]) d.SC_PRIZE.Add(((string)x[0], (double)x[1], (double)x[2]));
            foreach (var p in ((JObject)j["LOTTO_PRIZE"]).Properties()) d.LOTTO_PRIZE[int.Parse(p.Name)] = (double)p.Value;
            foreach (var x in j["CONV"]) d.CONV.Add(((string)x[0], (double)x[1], (string)x[2]));
            d.GAL = j["GAL"].ToObject<Dictionary<string, List<string[]>>>();
            d.GNKeys = ((JObject)j["GN"]).Properties().Select(p => p.Name).ToList();
            d.GN = j["GN"].ToObject<Dictionary<string, GnDef>>();
            d.FAME = j["FAME"].ToObject<Dictionary<string, double>>();
            foreach (var x in j["RANKS"]) d.RANKS.Add(((double)x[0], (string)x[1], (string)x[2]));
            d.TIPT = j["TIPT"].ToObject<Dictionary<string, List<string[]>>>();
            d.CM = j["CM"].ToObject<Dictionary<string, List<string>>>();
            d.TIP_RES = j["TIP_RES"].ToObject<Dictionary<string, List<string>>>();
            d.MYCM = j["MYCM"].ToObject<Dictionary<string, List<string>>>();
            d.GR_T = j["GR_T"].ToObject<Dictionary<string, string>>();
            d.HOT = j["HOT"].ToObject<Dictionary<string, int>>();
            d.ML = j["ML"].ToObject<Dictionary<string, List<string>>>();
            d.MEN_SETS = j["MEN_SETS"].ToObject<List<MenSet>>();
            d.IMPULSE = j["IMPULSE"].ToObject<List<ImpulseSet>>();
            d.MORNING_EV = j["MORNING_EV"].ToObject<List<RandEv>>();
            d.PC_EV = j["PC_EV"].ToObject<List<RandEv>>();
            d.KQ = j["KQ"].ToObject<List<KQDef>>();
            // unity_events.json (Unity 전용, 웹 데이터·골든 고정 데이터엔 없음): 문구 풀 추가분 + 돌발 이벤트
            void more<T>(List<T> to, string k) { if (j[k] != null) to.AddRange(j[k].ToObject<List<T>>()); }
            more(d.MORNING_EV, "MORNING_EV_X"); more(d.PC_EV, "PC_EV_X"); more(d.KQ, "KQ_X"); more(d.MEN_SETS, "MEN_SETS_X"); more(d.IMPULSE, "IMPULSE_X"); more(d.EVENTS, "EVENTS");
            d.KIM_DM = j["KIM_DM"].ToObject<Dictionary<string, List<string>>>();
            d.HY_TALK = j["HY_TALK"].ToObject<List<string>>();
            d.TIP_REACT = j["TIP_REACT"].ToObject<Dictionary<string, List<string>>>();
            d.ENDINGS = j["ENDINGS"].ToObject<Dictionary<string, EndingDef>>();
            d.STR = (JObject)j["STR"];
            foreach (var p in ((JObject)j["NPCS"]).Properties()) d.NPC_NAME[p.Name] = (string)p.Value["name"];
            return d;
        }

        /// unity_v4.json (v4 리디자인, docs/V4.md): V4_* 키를 같은 이름의 원본 객체에 덮어씀 (파일 병합은 최상위 키 통째 교체라 따로)
        static void mergeV4(JObject j)
        {
            void into(string from, string to)
            {
                if (!(j[from] is JObject src)) return;
                if (!(j[to] is JObject dst)) { j[to] = dst = new JObject(); }
                foreach (var p in src.Properties()) dst[p.Name] = p.Value.DeepClone();
            }
            into("V4_RULES", "RULES"); into("V4_STR", "STR"); into("V4_SCENES", "SCENES"); into("V4_ENDINGS", "ENDINGS");
            if (j["V4_LOCS"] is JObject vl && j["LOCS"] is JObject locs)   // 장소는 필드만 덮음 (설명 등)
                foreach (var p in vl.Properties()) if (locs[p.Name] is JObject L0 && p.Value is JObject L1) foreach (var f in L1.Properties()) L0[f.Name] = f.Value.DeepClone();
            if (j["V4_AN"] is JArray an && j["SRC"] is JObject src0)   // 분석가 = 리포트 출처 (tier rep). 신뢰 별은 다 같게 (적중률은 전적으로만)
                foreach (var a in an.OfType<JObject>()) { var o = (JObject)a.DeepClone(); string id = (string)o["id"]; o.Remove("id"); o["tier"] = "rep"; o["an"] = true; o["trust"] = 3; o["acc"] = 0.5; if (o["lag"] == null) o["lag"] = new JArray(1, 2); src0[id] = o; }
            if (j["V4_AUG_D"] is JObject ad && j["AUGS"] is JArray augs)   // 유물 설명: v4 규칙에서 뜻이 달라진 것만 덮음 (주 이자 · 체력 삭제 · 분석가 리포트 · 숨긴 장소)
                foreach (var a in augs.OfType<JObject>()) if (ad[(string)a["id"]] is JToken nd) a["d"] = nd.DeepClone();
            if (j["V4_EVENTS"] is JArray ev) { if (!(j["EVENTS"] is JArray e0)) j["EVENTS"] = e0 = new JArray(); foreach (var x in ev) e0.Add(x.DeepClone()); }
        }

        public string S(string key)
        {
            var t = STR[key];
            if (t == null) throw new Exception("STR missing: " + key);
            return (string)t;
        }
        public List<string> SA(string key)
        {
            var t = STR[key] as JArray;
            if (t == null) throw new Exception("STR array missing: " + key);
            return t.Select(x => (string)x).ToList();
        }
        public string U(string k) => (string)STR["U"][k];
    }
}
