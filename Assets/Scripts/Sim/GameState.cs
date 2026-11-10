using System.Collections;
using System.Collections.Generic;
using System.Linq;

namespace KwGame.Sim
{
    // 상태 스키마 (web/src/sim/state.js newState). 필드 이름은 JS 그대로 (camelCase).
    // 돈·수치는 JS 와 같은 double (원 단위 정수 규칙은 RoundHalfUp 로 지킴).

    /// 삽입 순서를 지키는 문자열 키 맵 (JS 객체 키 순서 대응)
    public class OMap<T> : IEnumerable<KeyValuePair<string, T>>
    {
        readonly List<string> keys = new List<string>();
        readonly Dictionary<string, T> map = new Dictionary<string, T>();
        public int Count => keys.Count;
        public IReadOnlyList<string> Keys => keys;
        public bool Has(string k) => k != null && map.ContainsKey(k);
        public T Get(string k) => k != null && map.TryGetValue(k, out var v) ? v : default;
        public void Set(string k, T v) { if (!map.ContainsKey(k)) keys.Add(k); map[k] = v; }
        public void Remove(string k) { if (map.Remove(k)) keys.Remove(k); }
        public T this[string k] { get => Get(k); set => Set(k, value); }
        public IEnumerator<KeyValuePair<string, T>> GetEnumerator() { foreach (var k in keys) yield return new KeyValuePair<string, T>(k, map[k]); }
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();
    }

    public class Candle { public double o, h, l, c; /** 거래량 (평소 = 1). 옛 저장엔 없음 → 1 */ public double v = 1; }
    public class TkState
    {
        public double p; public int tr; public List<Candle> hist = new List<Candle>();
        // 실시간 모드 (GameSim.Realtime.cs): 시간대 시가·고가·저가, 지금 그리는 봉 번호, 하루 기준가(전일 종가), 관리종목·상폐 횟수
        public int sT = int.MinValue, cb = int.MinValue; public double so, sh, sl, ref0; public bool warn; public int relist;
    }
    public class MarketState { public int reg; public OMap<TkState> tk = new OMap<TkState>(); }
    public class MarketPlan
    {
        public Dictionary<string, double> r = new Dictionary<string, double>(); public Dictionary<string, double[]> w = new Dictionary<string, double[]>(); public bool whale; public int T = int.MinValue;
        /// v4 칸 안 경유점: 종목 → [u1, x1, u2, x2, …] (u = 장 시간 중 위치 0~1, x = 칸 시가 대비 로그수익). 없으면 종가까지 곧장
        public Dictionary<string, double[]> way = new Dictionary<string, double[]>();
        /// v4 칸 중간 사건 (후속 속보 · 리포트 결과 발표): u 지점에서 알림
        public List<PlanEv> evs = new List<PlanEv>();
        /// v4 분석가 리포트 결과 = 발표 순간의 갭: 종목 → [u, 충격(단순수익률)]. 그 전까지는 발표 몫을 뺀 길로 가다가 u 에서 한 번에 뜀 (예약 손절이 못 피함)
        public Dictionary<string, double[]> jmp = new Dictionary<string, double[]>();
    }
    public class PlanEv { public double u; public string k, tk; public bool ok, done; public int id; }
    public class Move { public double o, c, h, l, r; }
    public class News { public string tk, h; public int dir; public double r; public bool fake; public bool llm; public string body, src, ev, arc; public int? step; }
    public class Holding { public double q, cost; public int t0, bday; }
    public class CoinPos { public int id; public string tk; public int dir; public double lev, margin, entry, mult; public int t0; public double bonus; public bool mirai; public double sl, tp; }   // mirai = 미래 돌발 매수 (v4: '코인 금지' 부탁 어김으로 안 침)
    public class Ledger { public string kind; public double amt; public string label; }
    public class KMsg { public string w, x, t; public int d; }
    public class Cm { public string au, x; public double up; public int res, tipc; }
    public class Post
    {
        public int id, T; public string lab, au, tag, title, body; public double up, dn; public List<Cm> cm = new List<Cm>(); public bool best;
        public int mine, pend; public string wk, wtk; public bool ok, big; public double pnl; public int? tip; public int res; public double rr; public bool pd; public double fm; public int myUp;
    }
    public class Tip { public int id; public string who, tier, tk; public int dir; public double mag; public int T0, Tr; /** v4 분석가 리포트: 화면에 보이는 기한 (실제 발표 칸 Tr 은 그 안 어딘가 — 숨김) */ public int Td; public string kind; public bool pre; public double p0; public string res = ""; public double rr; public string via; public int? pid; }
    public class Feed { public string ic, x, kind, lab; public List<string> rows; }
    public class Rsch { public int d, free, paid; }
    public class EqPoint { public int T; public double v; }
    public class Whale { public string tk; public int dir, T; }
    public class LottoTicket { public int d; public List<int> n; }
    public class HomeLine { public int T; public string t; }
    public class RelicOffer { public int d; public List<string> ids; }
    public class Visit { public string key; public bool used; }
    public class KQState { public int i; public List<Opt> opts; public int T; }
    public class Opt { public string k, l, sub; public bool dis, ok; }
    public class Horse { public string name; public double w, p, odds; }
    public class ScratchCard { public List<string> sym; public (string s, double amt, double p)? prize; public bool done; }
    public class WorkSetup { public double H; public List<int[]> orders; public double[] u; public List<double[]> drops; public double w; public double hp, hpm; public bool practice; }
    public class GachaLast { public int? junk; public string id; }

    /// 입력 대기 (모든 종류 필드의 합집합; t 로 구분)
    public class Pending
    {
        public string t;
        public string key, loc, kind, id, reason, tk, stage;
        public bool first, jackpot, rerolled, betUsed, cont;
        public double n0, total, staked, before, spent, got, mx, due, took, half;
        public int A, As, rounds, race, n, bought, pulls, si; public string evId;
        public uint? rng0;   // 알바 설명 카드: 들어오기 전 난수 상태 (돌아가면 되돌림 — 들락거려 난수를 고르는 수 방지)
        /// 알바 중 몰래 폰 본 횟수 · 들켰나 (그 칸 일당 0)
        public int peeks; public bool caught;
        public WorkSetup setup; public List<Horse> H; public ScratchCard card; public GachaLast last;
        public List<Opt> opts; public List<string> offer;
        public Pending(string t) { this.t = t; }
    }

    public class Stats
    {
        public double work, gamble, invest, liq, earned, borrowed, decor, maxDebt, menOk, menBad, bigWin, interest, repaid, race, lotto, pc,
            gN, gW, gnet, iN, iW, maxAsset, minDebt, faint, gacha, impulse, tempt, secret;
        public Dictionary<string, double[]> g;
        /// digest 용 숫자 필드 (이름, 값)
        public IEnumerable<KeyValuePair<string, double>> Numbers()
        {
            var d = new Dictionary<string, double>
            {
                ["work"] = work, ["gamble"] = gamble, ["invest"] = invest, ["liq"] = liq, ["earned"] = earned, ["borrowed"] = borrowed, ["decor"] = decor,
                ["maxDebt"] = maxDebt, ["menOk"] = menOk, ["menBad"] = menBad, ["bigWin"] = bigWin, ["interest"] = interest, ["repaid"] = repaid, ["race"] = race,
                ["lotto"] = lotto, ["pc"] = pc, ["gN"] = gN, ["gW"] = gW, ["gnet"] = gnet, ["iN"] = iN, ["iW"] = iW, ["maxAsset"] = maxAsset, ["minDebt"] = minDebt,
                ["faint"] = faint, ["gacha"] = gacha, ["impulse"] = impulse, ["tempt"] = tempt, ["secret"] = secret,
            };
            return d;
        }
    }

    public class Scoreboard
    {
        public string kind, rank; public double profit, gnet, earned, maxAsset, repaid, debt, gW, gN, iW, iN, liq, fame, addict, interest, faint, impulse;
        public int days, month, day;
    }
    public class EndInfo
    {
        public string kind, variant, tag, h, bg, face, lead, rank; public bool ok, noChar, night, cont; public int days; public Scoreboard sb;
    }

    public class GameState
    {
        public const int STATE_VERSION = 34;
        public int version = STATE_VERSION, rngv = 2; public int seed; public uint rng, fx;
        public int month = 1, day = 1, slot = 0; public string phase = "opening";
        public double debt, cash, hp, stress = 20, addict = 0;
        public string outfit = "hoodie"; public OMap<int> owned = new OMap<int>(), props = new OMap<int>();
        public List<Ledger> yday = new List<Ledger>(), today = new List<Ledger>();
        /// 작전주 (GameSim.Op.cs): 이번 주 작전들 · 뽑은 주(부×10+주차) · 가짜 매집 종목과 요일 · 들고 있다 설거지 맞은 횟수
        public List<Op> ops = new List<Op>(); public int opKey; public string opFakeTk; public int opFakeDay, opHit;
        /// 하루 계획판 (docs/UI_V2.md): 오늘 칸마다 한 일("watch" · "date" · "rest" · "work:cafe" · "out:park")과 그 칸의 손익 · 기록한 날 · 칸 시작 기준점
        public string[] slotAct = new string[3]; public double[] slotNet = new double[3]; public int slotLogDay, slotLed0; public double slotReal0;
        /// 어제의 칸 기록 (계획판 "어제" 줄). slotLogDayY = 그 기록의 날 키
        public string[] slotActY; public double[] slotNetY; public int slotLogDayY;
        /// 계획판에서 바로 가기(quick): 도착하면 할 행동(없으면 null) · 그렇게 와서 알바 설명 카드에 있나 (돌아가면 집으로)
        public string quick; public bool quickFrom;
        public Dictionary<string, List<KMsg>> kk = new Dictionary<string, List<KMsg>> { ["m"] = new List<KMsg>(), ["kim"] = new List<KMsg>(), ["hy"] = new List<KMsg>() };
        public Dictionary<string, int> kun = new Dictionary<string, int> { ["m"] = 0, ["kim"] = 0, ["hy"] = 0 };
        public KQState kq; public List<Post> posts = new List<Post>(); public int gid = 1; public List<Tip> tips = new List<Tip>();
        public Dictionary<int, int> wrote = new Dictionary<int, int>(); public int gNew, gReact;
        public List<Feed> feed = new List<Feed>(); public int fUnread;
        public Dictionary<int, Dictionary<string, double>> shocks = new Dictionary<int, Dictionary<string, double>>();
        public Dictionary<string, int[]> srcStat = new Dictionary<string, int[]>();
        public Rsch rsch; public double realized; public List<EqPoint> eqh = new List<EqPoint>(); public MarketPlan mplan; public int startT = -1;
        public int workStreak; public string menKey = ""; public double galFame; public string lastJob = ""; public bool needMorning;
        /// v4: 숏 해금됨 (실현수익 누적이 V4_SHORT_PROFIT 을 한 번이라도 넘음)
        public bool shortOn; public int levTier;
        public List<string> augs = new List<string>(); public MarketState mk; public OMap<Holding> hold = new OMap<Holding>(); public List<CoinPos> cps = new List<CoinPos>(); public int pid = 1;
        public News news; public Whale whale; public List<LottoTicket> lotto = new List<LottoTicket>(); public int paidMonth; public bool insUsed; public HomeLine hl;
        public int faint = -1, cleared = 0; public Dictionary<string, int> endSeen = new Dictionary<string, int>(); public List<string> resume; public RelicOffer relicOffer; public int gday;
        public Stats st = new Stats();
        // 실시간 모드 병·숙취·운동·오늘 놀거리 횟수 (GameSim.Health.cs)
        public string sick; public int sickD; public bool hang, fit; public Dictionary<string, int> relaxN = new Dictionary<string, int>();
        public string tg = ""; public int tgT; public Dictionary<string, int> tutSeen = new Dictionary<string, int>(); public int mgN;
        public bool llm; public NewsFact nfact, nfactN; public List<NewsLog> nlog = new List<NewsLog>(); public int[] nstr = { 0, 0, 0 };   // LLM 뉴스 (GameSim.Llm.cs)
        public Pending pending; public List<string> flow = new List<string>(); public string ending; public EndInfo endInfo;
        // JS 에서 처음엔 undefined 인 보조 필드
        public bool optTut; public int? kimpDay, kimBig, menCool, temptT, gT, repT; public double invIn; public Visit visit; public int dbgAug;
        public List<string> evSeen = new List<string>(); public int? evCool, evT;   // 돌발 이벤트 (GameSim.Events.cs, 다이제스트 밖)
        // 실시간 모드 (GameSim.Realtime.cs, 다이제스트 밖): 하루 중 분(08:00 = 480), 행동이 아직 못 쓴 시간, 지금 행동이 쓸 시간
        public bool rt; public int min, owe, actMin;
        /// 멘헤라·돌발 매수를 연달아 나쁘게 받아친 횟수 (착한 답장이면 0). 실시간 bad4 판정용 (다이제스트 밖, 저장엔 들어감)
        public int menRun;
        // v4 리디자인 (GameSim.V4.cs, docs/V4.md, 다이제스트 밖): 미래 호감 · 욕심(숨김) · 몇 부 · 오늘 부탁(id, 어김, 해냄) · 본 장 카드 · 오늘 놀아준 횟수
        public double aff = -1, greed; public int part = 1; public string prom; public bool promBad, promDone; public int chSeen, dateN, nflashT = -1, gapT = -1, heist, earlyM, sleepD; public bool heistGo;   // heist = 털기 준비 단계(0~3), heistGo = 만기 밤에 턴다, earlyM = 실적 없이 이자 미리 낸 달(신용은 이자일에), sleepD = 밤에 푹 자서 무료 리포트 +1 받는 날(absDay)
        /// v4 주말 갭: 주말 동안 쌓인 국장 수익률 (월요일 오전에 반영)
        public Dictionary<string, double> wkGap = new Dictionary<string, double>();
        // 메타 (GameSim.Meta.cs, 다이제스트 밖): 난이도("easy"|"normal"|"hard") · 알바 중 청산 횟수 · 내가 연 코인 최고 배율 · 자정 부탁 판정(지킴/어김) 횟수 · 지금 알바 나가 있음(알바 끝 ~ 그 시간 다 흐를 때까지)
        public string diff = "normal"; public int liqWork, maxLev, promKept, promBroke; public bool awayWork;
        /// 알바 중 청산 경보: 마지막 일당 · 경보를 띄운 칸 (한 칸 1회)
        public double lastPay; public int alertT = -1;
        /// 하루 결과 (정산 카드 · 밤의 미래): 아침 기준 실현손익·청산 수 · 그날 결과 종류 · 정산/청산 밤 장면/미래의 감을 쓴 날
        /// dayCash0 < 0 = 아침 현금 기준점 없음(옛 저장) → 화면은 '아침 → 지금' 대신 지금 현금만. dayLed0 = 기준점을 잡을 때 장부 길이 (그 앞은 아침 현금에 이미 들어 있음)
        public double dayReal0, dayLiq0, dayCash0 = -1; public int dayLed0; public string dayRes; public int settleD, nightEvD, senseD;
        /// 하루 기준점(dayReal0·dayLiq0)을 잡은 날 (옛 저장·2부 시작처럼 기준점이 없으면 그날은 정산을 건너뜀)
        public int dayBase;
        /// 주간 납부 관문: 통과한 횟수(증거금 상한·숏·대출 해금 단계) · 연속 미납 횟수
        public int gateTier, missN;
        /// 이번 주에 김사장한테 빌린 돈 (이번 주 원금 분납에선 빼 줌 = 다음 주로 미루는 다리)
        public double loanWeek;   // promKept·promBroke = 누적 (오늘 어김 bool promBad 와 다름)
    }
}
