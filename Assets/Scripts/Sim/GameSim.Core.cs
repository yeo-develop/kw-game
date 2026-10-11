using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;

namespace KwGame.Sim
{
    /// sim 이벤트 (sim → view). d = 필드, h = HUD 스냅샷(Hud 옵션 켤 때)
    public class SimEvent
    {
        public string t; public Dictionary<string, object> d; public HudSnap h;
        public object this[string k] => d != null && d.TryGetValue(k, out var v) ? v : null;
        public string Str(string k) => this[k] as string;
        public double Num(string k) { var v = this[k]; return v is double x ? x : v is int i ? i : 0; }
        public override string ToString() => t + (d == null ? "" : " " + string.Join(", ", d.Select(kv => kv.Key + "=" + JsFmt.Str(kv.Value))));
    }

    public class HudSnap
    {
        public string phase; public int month, day, slot, paidMonth; public double cash, debt, hp, stress, addict, hv, galFame; public List<string> augs; public bool faint;
    }

    /// 게임 규칙 실행기 (web/src/sim/* 을 한 클래스의 partial 파일들로 옮김. JS 의 st() = 이 인스턴스의 S).
    public partial class GameSim
    {
        public readonly GameData D;
        public GameState S;
        public bool Hud;   // view 용: 이벤트마다 HUD 스냅샷
        List<SimEvent> ev = new List<SimEvent>();
        Rules R => D.RULES;

        public GameSim(GameData data, GameState state = null) { D = data; S = state; }

        // ---------- 이벤트 ----------
        void Emit(string t, params object[] kv)
        {
            var e = new SimEvent { t = t };
            if (kv.Length > 0)
            {
                e.d = new Dictionary<string, object>();
                for (int i = 0; i + 1 < kv.Length; i += 2) e.d[(string)kv[i]] = kv[i + 1];
            }
            if (Hud) e.h = HudSnapOf();
            ev.Add(e);
        }
        static Dictionary<string, object> V(params object[] kv)
        {
            var d = new Dictionary<string, object>();
            for (int i = 0; i + 1 < kv.Length; i += 2) d[(string)kv[i]] = kv[i + 1];
            return d;
        }

        // ---------- 난수 (S.rng · S.fx) ----------
        double rnd() => Rng.Float(ref S.rng);
        double frnd() => Rng.Float(ref S.fx);
        double gauss() => Rng.Gauss(ref S.rng);
        T pick<T>(IList<T> a) => a[(int)Math.Floor(rnd() * a.Count)];
        T fpick<T>(IList<T> a) => a[(int)Math.Floor(frnd() * a.Count)];
        static double sq(double x) => x * x;
        static double floor(double x) => Math.Floor(x);
        static double rhu(double x) => MathK.RoundHalfUp(x);
        static double round1k(double x) => MathK.Round1k(x);
        static double clamp(double v, double a, double b) => MathK.Clamp(v, a, b);
        static double max(double a, double b) => Math.Max(a, b);
        static double min(double a, double b) => Math.Min(a, b);

        // ---------- 포맷 (fmt.js) ----------
        static string loc(double n) => JsFmt.Loc(n);
        public string won(double n) => loc(rhu(n)) + D.U("won");
        public string sgnWon(double n) => (n > 0 ? "+" : n < 0 ? "−" : "±") + loc(Math.Abs(rhu(n))) + D.U("won");
        public string man(double n)
        {
            double a = Math.Abs(n);
            string s = a >= 1e8 ? Regex.Replace(JsFmt.ToFixed(a / 1e8, 2), @"\.?0+$", "") + D.U("eok") : a >= 1e4 ? loc(rhu(a / 1e4)) + D.U("man") : loc(rhu(a));
            return (n < 0 ? "−" : "") + s;
        }
        public string sgnMan(double n) => (n > 0 ? "+" : n < 0 ? "" : "±") + man(n) + D.U("won");
        public static string pct(double r) => (r > 0 ? "▲" : r < 0 ? "▼" : "±") + JsFmt.ToFixed(Math.Abs(r * 100), 1) + "%";
        public string fmtP(double p) => p >= 100 ? loc(rhu(p)) : p >= 1 ? JsFmt.ToFixed(p, 2) : JsFmt.ToFixed(p, 4);
        public static string stars(double n) { var sb = new StringBuilder(); for (int i = 0; i < n; i++) sb.Append('★'); for (int i = 0; i < 5 - n; i++) sb.Append('☆'); return sb.ToString(); }
        static readonly Regex TplRx = new Regex(@"\{([A-Za-z0-9_]+)\}");
        public static string fill(string x, Dictionary<string, object> v) => TplRx.Replace(x ?? "", m => v != null && v.TryGetValue(m.Groups[1].Value, out var o) && o != null ? JsFmt.Str(o) : "");
        public string T(string key) => D.S(key);
        public string T(string key, Dictionary<string, object> v) { var x = D.S(key); return v != null ? fill(x, v) : x; }
        public string T(string key, params object[] kv) => T(key, V(kv));
        List<string> TA(string key) => D.SA(key);
        /// JS String.replace(문자열, 문자열): 첫 번째만
        static string replace1(string s, string a, string b) { int i = s.IndexOf(a, StringComparison.Ordinal); return i < 0 ? s : s.Substring(0, i) + b + s.Substring(i + a.Length); }
        /// 돈 환산 드립 (연출 난수)
        public string conv(double n)
        {
            double a = Math.Abs(n);
            var ok = D.CONV.Where(c => a / c.per >= 1 && a / c.per < 100000).ToList();
            if (ok.Count == 0) return T("convNone");
            var c0 = ok[(int)Math.Floor(frnd() * ok.Count)];
            double k = Math.Floor(a / c0.per);
            return c0.name + " " + loc(k) + c0.unit;
        }

        // ---------- 상태 읽기 (state.js) ----------
        public IEnumerable<string> TKS() => D.TKList.Select(t => t.id);
        public IEnumerable<string> STK() => D.TKList.Where(t => t.type == "stock").Select(t => t.id);
        public bool has(string id) => S != null && S.augs.Contains(id);
        public double rate() => R.RATE - (has("loanbro") ? 0.01 : 0);
        public double interestDue() => round1k(S.debt * rate());
        public double menLine() => has("posi") ? 90 : 70;
        public string mental() => S.stress >= menLine() ? "men" : S.stress >= 40 ? "anx" : "calm";
        public int absDay() => (S.month - 1) * R.MONTH_DAYS + S.day;
        public int Tnow() => (absDay() - 1) * R.SLOTS + S.slot;
        public double loanCap() => R.LOAN_CAP[(int)clamp(S.month, 1, 3) - 1];
        public bool stockOpen() => R.STOCK_SLOTS.Contains(S.slot);
        public bool isEve() => S.slot == R.SLOTS - 1;
        public bool tkOpen(string k) => string.IsNullOrEmpty(D.TK[k].@lock) || has(D.TK[k].@lock);
        public double stockVal() { double a = 0; foreach (var k in STK()) { var h = S.hold.Get(k); a = a + (h != null ? h.q * S.mk.tk[k].p : 0); } return a; }
        public double cpnl(CoinPos c, double? p = null) => Math.Max(-c.margin, c.margin * c.lev * c.mult * c.dir * ((p ?? S.mk.tk[c.tk].p) / c.entry - 1));
        public double cEq(CoinPos c) => c.margin + cpnl(c) + c.bonus;
        public double coinVal() { double a = 0; foreach (var c in S.cps) a = a + cEq(c); return a; }
        public double holdVal() => stockVal() + coinVal();
        public static double liqPx(CoinPos c) => c.entry * (1 - c.dir * 0.9 / (c.lev * c.mult));
        public double unreal()
        {
            double a = 0;
            foreach (var k in STK()) { var h = S.hold.Get(k); a = a + (h != null ? h.q * S.mk.tk[k].p - h.cost : 0); }
            double b = 0; foreach (var c in S.cps) b = b + cpnl(c) + c.bonus;
            return a + b;
        }
        public bool hasPos() => STK().Any(k => S.hold.Has(k)) || S.cps.Count > 0;
        public int kUnread() => S.kun["m"] + S.kun["kim"] + S.kun["hy"];
        public (double f, string name, string desc) rankOf(double f) => D.RANKS.Where(r => f >= r.f).Last();
        public double todayPnl() { double a = 0; foreach (var x in S.today) if (x.kind == "invest" || x.kind == "gamble") a = a + x.amt; return a; }
        public bool todayLiq() => S.today.Any(x => (x.label ?? "").Contains(D.S("liqWord")));
        public int wroteToday() => S.wrote.TryGetValue(absDay(), out var n) ? n : 0;
        public string moodFace() { var m = mental(); return m == "men" ? "menhera" : m == "anx" || S.hp < R.HP_LOW ? "tired" : S.stress < 25 ? "happy" : "neutral"; }
        public double hpMult() { double lo = R.HP_LOW; return S.hp >= lo ? 1 : 0.4 + 0.6 * S.hp / lo; }
        public double hpCost(string k) { double c = R.HpCost(k); return c > 0 && has("ginseng") ? rhu(c * 0.7) : c; }
        public double jobHp(Job J) => has("ginseng") ? rhu(J.hp * 0.7) : J.hp;
        public string clockNow() => S != null && S.phase != "title" ? (S.phase == "payday" ? "23:50" : (S.slot < D.SLOT_CLOCK.Count ? D.SLOT_CLOCK[S.slot] : "09:00")) : "09:00";
        /// UI 용 청산 확률 (상태에 안 들어감 → Math 써도 됨)
        public double liqOdds(double lev, double vol)
        {
            double a = Math.Log(1 / (1 - Math.Min(0.99, 0.9 / lev))), sg = vol * Math.Sqrt(1 + R.INTRA * R.INTRA);
            double z = a / sg, t = 1 / (1 + 0.3275911 * z / Math.Sqrt(2));
            double erfc = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.Exp(-z * z / 2);
            return Math.Min(0.99, erfc);
        }
        public HudSnap HudSnapOf() => new HudSnap
        {
            phase = S.phase, month = S.month, day = S.day, slot = S.slot, cash = S.cash, debt = S.debt, hp = S.hp, stress = S.stress, addict = S.addict,
            paidMonth = S.paidMonth, hv = S.mk != null ? holdVal() : 0, augs = S.augs.ToList(), galFame = S.galFame, faint = S.faint >= Tnow()
        };
    }
}
