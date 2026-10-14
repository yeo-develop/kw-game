using System;
using System.Collections.Generic;
using System.Linq;

namespace KwGame.Sim
{
    // 실시간 모드 (S.rt). 웹 sim 에 없는 Unity 전용 규칙이라 골든 벡터(턴 모드)엔 안 걸림.
    // 하루 = 08:00~24:00 게임 시간이 흐름 (view 가 "tick" 명령으로 분 단위 전달). 아침·점심·저녁은 시간대 이름으로만 남고,
    // 시간대 끝 처리(시세 결산·정보 결과·뉴스·이자일)는 시계가 경계를 넘을 때 기존 칸 끝 흐름(AFTER_SLOT)을 그대로 돈다.
    // 시세: 시간대마다 정해 둔 종가(planMarket)까지 1분씩 브라운 다리로 움직이고 30분봉을 쌓음. 국장은 09:00~15:30, 하루 ±30%.
    public partial class GameSim
    {
        static readonly string[] TICK_OK = { "home", "map", "loc", "brokerTrade" };

        public int slotStartMin(int s) => s <= 0 ? R.RT_DAY0 : R.RT_SLOT_END[s - 1];
        public int slotEndMin(int s) => R.RT_SLOT_END[Math.Min(s, R.RT_SLOT_END.Length - 1)];
        public static string clockOf(int m) => $"{m / 60 % 24:00}:{m % 60:00}";
        double rtVol() => S.rt ? R.RT_VOL : 1;
        public bool limitUp(string k) { var t = D.TK[k]; var s = S.mk.tk[k]; return S.rt && t.IsStock && s.ref0 > 0 && s.p >= s.ref0 * (1 + R.RT_LIMIT) * 0.999; }
        public bool limitDn(string k) { var t = D.TK[k]; var s = S.mk.tk[k]; return S.rt && t.IsStock && s.ref0 > 0 && s.p <= s.ref0 * (1 - R.RT_LIMIT) * 1.001; }
        /// 하루 등락 (기준가 = 전날 마감 / 코인은 자정)
        public double dayR(string k) { var s = S.mk.tk[k]; return s.ref0 > 0 ? s.p / s.ref0 - 1 : 0; }

        /// 턴 모드 저장을 실시간으로 바꾸기 + 데이터에 새로 생긴 종목 채우기
        public void EnableRt()
        {
            foreach (var t in D.TKList.Where(t => !S.mk.tk.Has(t.id))) S.mk.tk[t.id] = new TkState { p = t.p0, tr = rnd() < 0.5 ? 1 : -1 };
            foreach (var kv in S.mk.tk) { if (kv.Value.ref0 <= 0) kv.Value.ref0 = kv.Value.p; }
            if (S.rt) return;
            S.rt = true; S.min = slotStartMin(S.slot); S.owe = 0;
            foreach (var kv in S.mk.tk) { kv.Value.sT = int.MinValue; kv.Value.cb = int.MinValue; kv.Value.ref0 = kv.Value.p; }
        }

        // ---------- 시세 1분 ----------
        void rtOpen(TkState s, int T) { if (s.sT == T) return; s.sT = T; s.so = s.p; s.sh = s.p; s.sl = s.p; }
        double limit(TkState s, double p) => s.ref0 > 0 ? clamp(p, s.ref0 * (1 - R.RT_LIMIT), s.ref0 * (1 + R.RT_LIMIT)) : p;
        double rtClose(Ticker t, TkState s, MarketPlan P) { double c = Math.Max(s.so * (1 + P.r[t.id]), t.p0 * 0.001); return t.IsStock ? limit(s, c) : c; }
        (int a, int b) rtWindow(Ticker t, int slot)
        {
            int a = slotStartMin(slot), b = slotEndMin(slot);
            if (t.IsStock) { a = Math.Max(a, R.RT_STOCK[0]); b = Math.Min(b, R.RT_STOCK[1]); }
            return (a, b);
        }
        void rtStep(MarketState M, MarketPlan P, int T, int slot, int m, int day)
        {
            foreach (var t in D.TKList)
            {
                var s = M.tk[t.id]; rtOpen(s, T);
                var (a, b) = rtWindow(t, slot);
                if (m < a || m >= b) continue;
                double L = b - a, u = (m - a) / L, dt = 1 / L;
                double X1 = Math.Log(rtClose(t, s, P) / s.so), x = Math.Log(s.p / s.so), x2;
                if (u + dt >= 1 - 1e-9) x2 = X1;
                else
                {
                    double sig = t.vol * R.INTRA * rtVol() * (P.whale && !t.IsStock ? 2 : 1) * (t.meme ? 0.4 : 1);
                    x2 = x + (X1 - x) * dt / (1 - u) + gauss() * sig * Math.Sqrt(dt * (1 - u - dt) / (1 - u));
                }
                double p = s.so * Math.Exp(x2);
                if (t.IsStock) p = limit(s, p);
                int bk = day * 1000 + m / R.RT_CANDLE;
                if (s.cb != bk)
                {
                    s.hist.Add(new Candle { o = s.p, h = s.p, l = s.p, c = s.p }); s.cb = bk;
                    while (s.hist.Count > R.RT_HIST) s.hist.RemoveAt(0);
                }
                var k = s.hist[s.hist.Count - 1]; k.h = Math.Max(k.h, p); k.l = Math.Min(k.l, p); k.c = p;
                s.p = p; s.sh = Math.Max(s.sh, p); s.sl = Math.Min(s.sl, p);
            }
        }
        /// 시간대 끝: 계획한 종가로 맞춤 (장 닫힌 시간대의 주식은 여기서 갭) → 시간대 전체 움직임
        Dictionary<string, Move> rtSnap(MarketState M, MarketPlan P, int T)
        {
            var outp = new Dictionary<string, Move>();
            foreach (var t in D.TKList)
            {
                var s = M.tk[t.id]; rtOpen(s, T);
                double o = s.so, c = rtClose(t, s, P);
                s.p = c; s.sh = Math.Max(s.sh, c); s.sl = Math.Min(s.sl, c);
                outp[t.id] = new Move { o = o, c = c, h = s.sh, l = s.sl, r = c / o - 1 };
            }
            return outp;
        }
        /// 새 게임: 이틀치 30분봉을 미리 그려 둠
        void rtInitMarket(MarketState M)
        {
            for (int d = 0; d < 2; d++)
            {
                foreach (var kv in M.tk) kv.Value.ref0 = kv.Value.p;
                for (int sl = 0; sl < R.SLOTS; sl++)
                {
                    var P = planMarket(new Dictionary<string, double>(), sl == R.SLOTS - 1, M); int T = -1000 + d * R.SLOTS + sl;
                    for (int m = slotStartMin(sl); m < slotEndMin(sl); m++) rtStep(M, P, T, sl, m, d - 2);
                    rtSnap(M, P, T);
                }
            }
            foreach (var kv in M.tk) { kv.Value.ref0 = kv.Value.p; kv.Value.sT = int.MinValue; }
        }

        // ---------- 시계 ----------
        /// mins 분 흘려보냄. 시간대 경계에 닿으면 남은 시간은 S.owe 로 미루고 칸 끝 흐름을 걸어 둠 (true)
        bool clockRun(int mins)
        {
            var liqs = new List<Liq>();
            bool over = false;
            while (true)
            {
                if (S.min >= slotEndMin(S.slot)) { S.owe += mins; over = true; break; }
                if (mins <= 0) break;
                var P = curPlan();
                rtStep(S.mk, P, Tnow(), S.slot, S.min, absDay());
                S.min++; mins--;
                rtLiq(liqs);
            }
            if (liqs.Count > 0)
            {
                face("panic");
                double lost = 0; foreach (var x in liqs) lost += x.lost;
                Emit("liveLiq", "n", liqs.Count);
                react(-lost, new ReactCtx { liq = true, lev = liqs[0].c.lev });
            }
            if (over) after(AFTER_SLOT);
            return over;
        }
        /// 실시간 청산: 가격이 청산가를 건드리는 순간
        void rtLiq(List<Liq> liqs)
        {
            foreach (var c in S.cps.ToList())
            {
                double p = S.mk.tk[c.tk].p;
                if (c.margin > 0 && c.lev * c.mult * c.dir * (p / c.entry - 1) > -0.9) continue;
                var LL = R.LIQ_LOSS; double loss = LL[0] + rnd() * (LL[1] - LL[0]);
                double back = Math.Max(0, rhu(c.margin * (1 - loss)));
                if (has("insure") && !S.insUsed) { S.insUsed = true; back = Math.Max(back, rhu(c.margin / 2)); }
                S.cash += back; S.cps.Remove(c); S.st.liq++; S.st.iN++; S.realized += back - c.margin;
                S.today.Add(new Ledger { kind = "invest", amt = back - c.margin, label = T("lbl.liq", "n", D.TK[c.tk].name, "lev", c.lev, "b", T("lbl.liqBack", "p", rhu(loss * 100))) });
                liqs.Add(new Liq { c = c, back = back, lost = c.margin + c.bonus - back });
            }
        }
        /// 행동이 쓴 시간
        int actMinutes() { int m = S.actMin > 0 ? S.actMin : R.RT_ACT; S.actMin = 0; return m; }
        static int rtActMin(string k) => k == "l-cafe" || k == "l-store" || k == "l-ware" || k == "l-mart" ? -1 : 0;
        void setActMin(string k) => S.actMin = rtActMin(k) < 0 ? R.RT_WORK : R.RT_ACT;
        void spend()
        {
            int o = S.owe; S.owe = 0;
            if (!clockRun(o)) after("home");
        }
        bool tickCmd(SimCommand c)
        {
            if (!S.rt) return false;
            if (!TICK_OK.Contains(S.pending?.t)) return true;   // 선택 대기 중엔 시간 멈춤
            int m = (int)clamp(c.Int("m", 1), 1, 120);
            if (clockRun(m)) { S.pending = null; S.visit = null; Emit("slotOver"); }
            return true;
        }

        // ---------- 하루 넘어갈 때: 기준가 · 관리종목 · 상장폐지 ----------
        void rtDayRoll()
        {
            foreach (var t in D.TKList.Where(x => x.junk))
            {
                var s = S.mk.tk[t.id];
                if (s.warn)
                {
                    s.warn = false;
                    if (rnd() < R.RT_DELIST_P) { delist(t); continue; }
                    pushF("📰", T("rt.unwarn", "n", t.name), "news"); toast(T("rt.unwarn", "n", t.name), "news", "news");
                }
                else if (rnd() < (s.p < t.p0 * 0.5 ? R.RT_WARN_LOW_P : R.RT_WARN_P))
                {
                    s.warn = true;
                    pushF("🚨", T("rt.warn", "n", t.name), "news"); toast(T("rt.warn", "n", t.name), "liq", "news");
                }
            }
            foreach (var kv in S.mk.tk) kv.Value.ref0 = kv.Value.p;
        }
        void delist(Ticker t)
        {
            var s = S.mk.tk[t.id]; double lost = 0;
            var h = S.hold.Get(t.id);
            if (h != null)
            {
                lost += h.cost; S.realized -= h.cost; S.st.iN++;
                S.today.Add(new Ledger { kind = "invest", amt = -h.cost, label = T("rt.delistLbl", "n", t.name) });
                S.hold.Remove(t.id);
            }
            foreach (var c in S.cps.Where(c => c.tk == t.id).ToList())
            {
                lost += c.margin; S.realized -= c.margin; S.st.iN++;
                S.today.Add(new Ledger { kind = "invest", amt = -c.margin, label = T("rt.delistLbl", "n", t.name) });
                S.cps.Remove(c);
            }
            foreach (var tp in S.tips.Where(x => x.tk == t.id && string.IsNullOrEmpty(x.res))) tp.res = "void";
            s.relist++; s.p = rhu(t.p0 * (0.6 + rnd() * 0.8) * 100) / 100; s.hist.Clear(); s.cb = int.MinValue; s.sT = int.MinValue; s.ref0 = s.p;
            pushF("☠️", T("rt.delist", "n", t.name), "news"); toast(T("rt.delist", "n", t.name), "liq", "news");
            Emit("delist", "tk", t.id, "lost", lost);
            if (lost > 0) { fx("crack", "amt", -lost); react(-lost); }
        }
    }
}
