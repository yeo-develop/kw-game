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
        double rtVol() => !S.rt ? 1 : v4 && R.V4_VOL > 0 ? R.V4_VOL : R.RT_VOL;   // v4: 잡음을 줄여 정보(속보·리포트)가 가격을 움직이게
        public bool limitUp(string k) { var t = D.TK[k]; var s = S.mk.tk[k]; return S.rt && t.IsStock && s.ref0 > 0 && s.p >= s.ref0 * (1 + R.RT_LIMIT) * 0.999; }
        public bool limitDn(string k) { var t = D.TK[k]; var s = S.mk.tk[k]; return S.rt && t.IsStock && s.ref0 > 0 && s.p <= s.ref0 * (1 - R.RT_LIMIT) * 1.001; }
        /// 하루 등락 (기준가 = 전날 마감 / 코인은 자정)
        public double dayR(string k) { var s = S.mk.tk[k]; return s.ref0 > 0 ? s.p / s.ref0 - 1 : 0; }

        /// 턴 모드 저장을 실시간으로 바꾸기 + 데이터에 새로 생긴 종목 채우기
        public void EnableRt()
        {
            foreach (var t in D.TKList.Where(t => !S.mk.tk.Has(t.id))) S.mk.tk[t.id] = new TkState { p = t.p0, tr = rnd() < 0.5 ? 1 : -1 };
            foreach (var kv in S.mk.tk) { if (kv.Value.ref0 <= 0) kv.Value.ref0 = kv.Value.p; }
            if (S.mplan != null && D.TKList.Any(t => !S.mplan.r.ContainsKey(t.id) || !S.mplan.w.ContainsKey(t.id))) S.mplan = null;   // 새 종목이 빠진 옛 시세 계획은 다시 짬
            if (S.rt) return;
            S.rt = true; S.min = slotStartMin(S.slot); S.owe = 0;
            foreach (var kv in S.mk.tk) { kv.Value.sT = int.MinValue; kv.Value.cb = int.MinValue; kv.Value.ref0 = kv.Value.p; }
        }

        // ---------- 시세 1분 ----------
        void rtOpen(TkState s, int T) { if (s.sT == T) return; s.sT = T; s.so = s.p; s.sh = s.p; s.sl = s.p; }
        double limit(TkState s, double p) => s.ref0 > 0 ? clamp(p, s.ref0 * (1 - R.RT_LIMIT), s.ref0 * (1 + R.RT_LIMIT)) : p;
        double rtClose(Ticker t, TkState s, MarketPlan P) { double c = Math.Max(s.so * (1 + P.r[t.id]), t.p0 * 0.001); return t.IsStock ? limit(s, c) : c; }
        /// 곱버스: 따라가는 종목의 시간대 등락 × −2 를 분마다 그대로 (장중에도 거울처럼)
        double invPx(MarketState M, Ticker t, TkState s)
        {
            var o = M.tk[t.of]; double r = o.so > 0 ? o.p / o.so - 1 : 0;
            double p = Math.Max(s.so * (1 - 2 * r), t.p0 * 0.001);
            return t.IsStock ? limit(s, p) : p;
        }
        (int a, int b) rtWindow(Ticker t, int slot)
        {
            int a = slotStartMin(slot), b = slotEndMin(slot);
            if (t.IsStock) { a = Math.Max(a, R.RT_STOCK[0]); b = Math.Min(b, R.RT_STOCK[1]); if (weekend()) b = a; }   // v4 주말 휴장
            return (a, b);
        }
        void rtStep(MarketState M, MarketPlan P, int T, int slot, int m, int day)
        {
            foreach (var t in D.TKList)
            {
                var s = M.tk[t.id]; rtOpen(s, T);
                var (a, b) = rtWindow(t, slot);
                if (m < a || m >= b) continue;
                if (t.inv && t.of != null && M.tk.Has(t.of)) { rtMove(s, invPx(M, t, s), day, m); continue; }
                double L = b - a, u = (m - a) / L, dt = 1 / L;
                double X1 = Math.Log(rtClose(t, s, P) / s.so), x = Math.Log(s.p / s.so), x2;
                // 발표 갭 (분석가 리포트 결과): 그 전까지는 발표 몫 J 를 뺀 길로 가다가 uj 에서 한 번에 뜀
                double later = 0, now = 0, done = 0;   // 아직 안 뜬 발표 몫 · 이번 1분에 뜨는 몫 · 이미 뜬 몫
                if (P.jmp != null && P.jmp.TryGetValue(t.id, out var jp))
                {
                    var JJ = jmpLogs(P, t, s, s.so);
                    for (int i = 0; i < JJ.Length; i++) { double uj = jp[2 * i]; if (u >= uj - 1e-9) done += JJ[i]; else if (u + dt >= uj - 1e-9) now += JJ[i]; else later += JJ[i]; }
                }
                double ub = 1, xb = X1 - later - now;   // 다음 목표: 경유점이 있으면 거기까지, 없으면 종가까지 (브라운 다리). 경유점은 발표 몫을 뺀 값
                if (P.way != null && P.way.TryGetValue(t.id, out var W)) for (int i = 0; i + 1 < W.Length; i += 2) if (W[i] > u + 1e-9) { ub = W[i]; xb = W[i + 1] + done; break; }
                if (now != 0) { x += now; xb += now; }   // 발표: 이번 1분에 갭
                if (u + dt >= ub - 1e-9) x2 = xb;
                else
                {
                    double sig = t.vol * R.INTRA * rtVol() * (P.whale && !t.IsStock ? R.RT_WHALE_VOL : 1) * (t.meme ? 0.4 : 1);
                    x2 = x + (xb - x) * dt / (ub - u) + gauss() * sig * Math.Sqrt(dt * (ub - u - dt) / (ub - u));
                }
                double p = s.so * Math.Exp(x2);
                if (t.IsStock) p = limit(s, p);
                rtMove(s, p, day, m);
            }
        }
        void rtMove(TkState s, double p, int day, int m)
        {
            int bk = day * 1000 + m / R.RT_CANDLE;
            if (s.cb != bk)
            {
                s.hist.Add(new Candle { o = s.p, h = s.p, l = s.p, c = s.p }); s.cb = bk;
                while (s.hist.Count > R.RT_HIST) s.hist.RemoveAt(0);
            }
            var k = s.hist[s.hist.Count - 1]; k.h = Math.Max(k.h, p); k.l = Math.Min(k.l, p); k.c = p;
            s.p = p; s.sh = Math.Max(s.sh, p); s.sl = Math.Min(s.sl, p);
        }
        /// 시간대 끝: 계획한 종가로 맞춤 (장 닫힌 시간대의 주식은 여기서 갭) → 시간대 전체 움직임
        Dictionary<string, Move> rtSnap(MarketState M, MarketPlan P, int T)
        {
            var outp = new Dictionary<string, Move>();
            foreach (var t in D.TKList)
            {
                var s = M.tk[t.id]; rtOpen(s, T);
                double o = s.so, c = t.inv && t.of != null && M.tk.Has(t.of) ? invPx(M, t, s) : rtClose(t, s, P);
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
                if (v4) { planEvFire(P); rtStops(); }
                rtLiq(liqs);
                if (S.min % 60 == 0 && (!v4 || S.pending?.t == "watch")) readIgnored();   // v4: 행동으로 몇 시간 건너뛸 땐 읽씹 페널티 안 쌓음 (장 볼 때만)
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
        /// 칸 중간 사건 알림 (후속 속보 · 리포트 결과 발표): 그 종목 장 시간의 u 지점을 지날 때 한 번
        void planEvFire(MarketPlan P)
        {
            if (P.evs == null) return;
            foreach (var e in P.evs)
            {
                if (e.done) continue;
                var (a, b) = rtWindow(D.TK[e.tk], S.slot);
                if (b <= a) { e.done = true; continue; }   // 이번 칸엔 장이 안 열림
                if ((S.min - a) / (double)(b - a) < e.u) continue;
                e.done = true;
                string nm = D.TK[e.tk].name;
                if (e.k == "report")
                {   // 분석가 리포트 결과 발표 (같은 1분에 시세가 갭으로 뜀)
                    var tp = S.tips.FirstOrDefault(q => q.id == e.id); if (tp == null) continue;
                    int up = e.ok ? tp.dir : -tp.dir; var d = srcOf(tp);
                    string x = T(e.ok ? "v4.an.hit" : "v4.an.miss", "ic", d.ic, "a", d.name, "n", nm, "d", T(up > 0 ? "v4.an.up" : "v4.an.dn"));
                    pushF("📊", x, "tip"); toast(x, "news", "news", "report");
                }
                else { string x = T(e.ok ? "v4.follow.ok" : "v4.follow.no", "n", nm); pushF("📰", x, "news"); toast(x, e.ok ? "good" : "liq", "news", "follow"); }
                Emit("planEv", "k", e.k, "tk", e.tk, "ok", e.ok, "id", e.id);
            }
        }
        /// 예약 손절·익절 (코인 포지션): 증거금 대비 손익이 걸어 둔 선에 닿으면 정리. 청산(−90%)보다 먼저 봄
        void rtStops()
        {
            foreach (var c in S.cps.ToList())
            {
                if (c.sl <= 0 && c.tp <= 0) continue;
                double g = c.lev * c.mult * c.dir * (S.mk.tk[c.tk].p / c.entry - 1);
                bool tp = c.tp > 0 && g >= c.tp, sl = c.sl > 0 && g <= -c.sl;
                if (!tp && !sl) continue;
                if (g <= -0.9) continue;   // 갭이 청산선까지 넘었으면 손절이 아니라 청산 (rtLiq) — 손절을 걸었다고 더 잃으면 안 됨
                double pnl = closeCoin(c, true) ?? 0;
                toast(T(tp ? "v4.stop.tp" : "v4.stop.sl", "n", D.TK[c.tk].name, "pnl", sgnWon(pnl)), tp ? "good" : "liq", "coin");
                Emit("stop", "id", c.id, "k", tp ? "tp" : "sl", "pnl", pnl, "tk", c.tk);
            }
        }
        /// 예약은 장 보기 칸에서만 걸 수 있음 (집에서 급히 잡은 포지션은 예약 없이 감)
        public bool stopsOk() => !v4 || S.pending?.t == "watch";
        bool setStops(CoinPos c, double sl, double tp)
        {
            if (c == null || !stopsOk()) return false;
            c.sl = double.IsNaN(sl) ? 0 : clamp(sl, 0, 0.85); c.tp = double.IsNaN(tp) ? 0 : clamp(tp, 0, 50);
            return true;
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
                if (has("insure") && !S.insUsed) { S.insUsed = true; back = Math.Max(back, rhu(c.margin * (S.rt ? R.RT_INSURE : 0.5))); }
                S.cash += back; S.cps.Remove(c); S.st.liq++; S.st.iN++; S.realized += back - c.margin;
                if (S.awayWork && S.pending?.t != "watch") S.liqWork++;   // 메타: 알바 나가 있는 동안 청산
                S.today.Add(new Ledger { kind = "invest", amt = back - c.margin, label = T("lbl.liq", "n", D.TK[c.tk].name, "lev", c.lev, "b", T("lbl.liqBack", "p", rhu(loss * 100))) });
                liqs.Add(new Liq { c = c, back = back, lost = c.margin + c.bonus - back });
            }
        }
        /// 행동이 쓴 시간
        int actMinutes() { int m = v4 ? slotLeft() : S.actMin > 0 ? S.actMin : R.RT_ACT; S.actMin = 0; return m; }   // v4: 행동 하나 = 칸 끝까지
        static int rtActMin(string k) => k == "l-cafe" || k == "l-store" || k == "l-ware" || k == "l-mart" ? -1 : 0;
        void setActMin(string k) => S.actMin = rtActMin(k) < 0 ? R.RT_WORK : R.RT_ACT;
        void spend()
        {
            int o = S.owe; S.owe = 0;
            if (!clockRun(o)) { S.awayWork = false; after("home"); }
        }
        bool tickCmd(SimCommand c)
        {
            if (!S.rt) return false;
            if (v4 ? S.pending?.t != "watch" : !TICK_OK.Contains(S.pending?.t)) return true;   // 선택 대기 중엔 시간 멈춤 (v4: 장 볼 때만 흐름)
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
            var nu = D.TKList.Where(t => t.day == absDay()).ToList();   // 주차별 신규 상장
            if (nu.Count > 0)
            {
                string ns = string.Join(", ", nu.Select(t => t.ic + " " + t.name));
                pushF("🔔", T("rt.list", "n", ns), "news"); toast(T("rt.list", "n", ns), "news", "news");
                pushK("m", T("rt.listM"));
            }
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
                if (c.dir < 0) { double back = rhu(cEq(c)); S.cash += back; S.realized += back - c.margin; S.st.iN++; S.today.Add(new Ledger { kind = "invest", amt = back - c.margin, label = T("rt.delistLbl", "n", t.name) }); S.cps.Remove(c); continue; }   // 숏은 지금 값으로 정산
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
