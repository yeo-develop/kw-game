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

    public class Candle { public double o, h, l, c; }
    public class TkState { public double p; public int tr; public List<Candle> hist = new List<Candle>(); }
    public class MarketState { public int reg; public OMap<TkState> tk = new OMap<TkState>(); }
    public class MarketPlan { public Dictionary<string, double> r = new Dictionary<string, double>(); public Dictionary<string, double[]> w = new Dictionary<string, double[]>(); public bool whale; public int T = int.MinValue; }
    public class Move { public double o, c, h, l, r; }
    public class News { public string tk, h; public int dir; public double r; public bool fake; }
    public class Holding { public double q, cost; public int t0, bday; }
    public class CoinPos { public int id; public string tk; public int dir; public double lev, margin, entry, mult; public int t0; public double bonus; }
    public class Ledger { public string kind; public double amt; public string label; }
    public class KMsg { public string w, x, t; public int d; }
    public class Cm { public string au, x; public double up; public int res, tipc; }
    public class Post
    {
        public int id, T; public string lab, au, tag, title, body; public double up, dn; public List<Cm> cm = new List<Cm>(); public bool best;
        public int mine, pend; public string wk, wtk; public bool ok, big; public double pnl; public int? tip; public int res; public double rr; public bool pd; public double fm; public int myUp;
    }
    public class Tip { public int id; public string who, tier, tk; public int dir; public double mag; public int T0, Tr; public string kind; public bool pre; public double p0; public string res = ""; public double rr; public string via; public int? pid; }
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
        public int A, As, rounds, race, n, bought, pulls, si;
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
        public Dictionary<string, List<KMsg>> kk = new Dictionary<string, List<KMsg>> { ["m"] = new List<KMsg>(), ["kim"] = new List<KMsg>(), ["hy"] = new List<KMsg>() };
        public Dictionary<string, int> kun = new Dictionary<string, int> { ["m"] = 0, ["kim"] = 0, ["hy"] = 0 };
        public KQState kq; public List<Post> posts = new List<Post>(); public int gid = 1; public List<Tip> tips = new List<Tip>();
        public Dictionary<int, int> wrote = new Dictionary<int, int>(); public int gNew, gReact;
        public List<Feed> feed = new List<Feed>(); public int fUnread;
        public Dictionary<int, Dictionary<string, double>> shocks = new Dictionary<int, Dictionary<string, double>>();
        public Dictionary<string, int[]> srcStat = new Dictionary<string, int[]>();
        public Rsch rsch; public double realized; public List<EqPoint> eqh = new List<EqPoint>(); public MarketPlan mplan; public int startT = -1;
        public int workStreak; public string menKey = ""; public double galFame; public string lastJob = ""; public bool needMorning;
        public List<string> augs = new List<string>(); public MarketState mk; public OMap<Holding> hold = new OMap<Holding>(); public List<CoinPos> cps = new List<CoinPos>(); public int pid = 1;
        public News news; public Whale whale; public List<LottoTicket> lotto = new List<LottoTicket>(); public int paidMonth; public bool insUsed; public HomeLine hl;
        public int faint = -1, cleared = 0; public Dictionary<string, int> endSeen = new Dictionary<string, int>(); public List<string> resume; public RelicOffer relicOffer; public int gday;
        public Stats st = new Stats();
        public string tg = ""; public int tgT; public Dictionary<string, int> tutSeen = new Dictionary<string, int>(); public int mgN;
        public Pending pending; public List<string> flow = new List<string>(); public string ending; public EndInfo endInfo;
        // JS 에서 처음엔 undefined 인 보조 필드
        public bool optTut; public int? kimpDay, kimBig, menCool, temptT, gT, repT; public double invIn; public Visit visit; public int dbgAug;
    }
}
