using System;
using System.Collections.Generic;
using System.Linq;

namespace KwGame.Sim
{
    /// 실시간 모드 밸런스 봇 (헤드리스). 전략별로 여러 판 돌려 클리어율·파산율·수입을 잰다 (BalanceTests · ./unity simtest balance).
    /// work = 알바만 · smart = 김사장 400만 종잣돈 + 알바 + 리포트·박대리 따라 주식, 다 갚을 수 있을 때 한 번에 상환 · smart0 = 종잣돈 없이 · gamble = 알바 + 홀짝·고배율 코인 · random = 아무거나
    /// 봇 난수는 System.Random(seed) 따로 (sim 난수와 섞지 않음)
    public class RtBots
    {
        public class Result
        {
            public int seed; public string strat, end = "none", variant = "";
            public int day, steps, errs, works, faints, menheras, sickDays;
            public int sells; public double sellRet;
            public double debt, cash, earned, interest, repaid, gnet, invest;
            public string lastErr, relic;
        }
        public class Summary
        {
            public string strat; public int n;
            public double sellRet, sells, clear, bad, alive, clearDay, clear28, p25, p50, p75, badDay, debtEnd, earnPerDay, gnet, invest, errs, faints, menheras, sickDays;
            /// 엔딩 종류(+변형)별 비율: clear · clear/gamble · clear/rich · bad1 · bad2 · bad3(과로) · bad4(멘헤라)
            public Dictionary<string, double> ends = new Dictionary<string, double>();
            public double End(string kind) => ends.Where(kv => kv.Key == kind || kv.Key.StartsWith(kind + "/")).Sum(kv => kv.Value);
            public override string ToString() =>
                $"{strat,-7} n={n} 클리어 {clear:P0} (평균 {clearDay:F1}일, 4주 안 {clear28:P0}, 25/50/75% {p25}/{p50}/{p75}일) · 배드 {bad:P0} (평균 {badDay:F1}일) · 생존 {alive:P0} · 남은빚 {debtEnd / 1e4:F0}만 · 알바 {earnPerDay / 1e4:F1}만/일 · 투자 {invest / 1e4:F0}만 · 도박 {gnet / 1e4:F0}만 · 기절 {faints:F1} · 멘헤라 {menheras:F1} · 아픈날 {sickDays:F1} · 매도 {sells:F0}회 평균 {sellRet:P1} · 에러 {errs:F1}"
                + (ends.Count > 0 ? "\n        엔딩 " + string.Join(" · ", ends.OrderBy(kv => kv.Key, StringComparer.Ordinal).Select(kv => $"{kv.Key} {kv.Value:P1}")) : "");
        }

        public const string RES = "리서치", PARK = "박대리";
        static bool Follow(Tip x) => x.who == RES || x.who == PARK;
        /// 하루마다 한 줄 (하네스 BAL_TRACE)
        public static Action<string> Trace;
        /// 시작 유품 고정 (하네스 BAL_FORCE · 테스트) — 첫 상자에서 이걸 집음
        public static string ForceRelic;
        int traceDay;
        readonly GameData D; readonly string strat; readonly Random r; readonly double mgLo, mgHi;
        GameSim G; GameState S => G.S; Rules R => D.RULES;
        string wantLoc, wantAct; double repayAmt;
        int lastSickT = -1; bool seeded; int loanT = -1, lottoT = -1;
        readonly HashSet<int> tipDone = new HashSet<int>();
        readonly Result res;

        RtBots(GameData d, int seed, string strat, double mgLo, double mgHi)
        {
            D = d; this.strat = strat; r = new Random(seed * 7919 + 13); this.mgLo = mgLo; this.mgHi = mgHi;
            res = new Result { seed = seed, strat = strat };
        }

        public static Result Run(GameData data, int seed, string strat, int maxDays = 70, double mgLo = 0.55, double mgHi = 0.85)
            => new RtBots(data, seed, strat, mgLo, mgHi).Play(maxDays);

        public static Summary Summarize(GameData data, string strat, int seeds, int seed0 = 1, int maxDays = 70, double mgLo = 0.55, double mgHi = 0.85)
        {
            var L = Enumerable.Range(seed0, seeds).Select(s => Run(data, s * 104729, strat, maxDays, mgLo, mgHi)).ToList();
            var cl = L.Where(x => x.end == "clear").ToList();
            return new Summary
            {
                strat = strat, n = L.Count,
                clear = (double)cl.Count / L.Count, bad = (double)L.Count(x => x.end != "clear" && x.end != "none") / L.Count, alive = (double)L.Count(x => x.end == "none") / L.Count,
                clearDay = cl.Count > 0 ? cl.Average(x => x.day) : 0, clear28 = (double)cl.Count(x => x.day <= 28) / L.Count,
                p25 = Pct(L, 0.25), p50 = Pct(L, 0.5), p75 = Pct(L, 0.75),
                badDay = L.Any(x => x.end != "clear" && x.end != "none") ? L.Where(x => x.end != "clear" && x.end != "none").Average(x => x.day) : 0,
                debtEnd = L.Average(x => x.end == "clear" ? 0 : x.debt), earnPerDay = L.Average(x => x.earned / Math.Max(1, x.day)),
                sells = L.Average(x => x.sells), sellRet = L.Sum(x => x.sellRet) / Math.Max(1, L.Sum(x => x.sells)),
                gnet = L.Average(x => x.gnet), invest = L.Average(x => x.invest), errs = L.Average(x => x.errs),
                faints = L.Average(x => x.faints), menheras = L.Average(x => x.menheras), sickDays = L.Average(x => x.sickDays),
                ends = L.Where(x => x.end != "none").GroupBy(x => x.end + (x.variant != "" ? "/" + x.variant : "")).ToDictionary(g => g.Key, g => (double)g.Count() / L.Count),
            };
        }

        /// 클리어 일수 분위 (못 깬 판 = 무한대 → 999)
        static double Pct(List<Result> L, double q) { var d = L.Select(x => x.end == "clear" ? x.day : 999).OrderBy(x => x).ToList(); return d[Math.Min(d.Count - 1, (int)(q * d.Count))]; }

        static SimCommand C(string t, params object[] kv) => new SimCommand(t, kv);

        Result Play(int maxDays)
        {
            G = GameSim.Create(D, res.seed, new GameSim.Opts { rt = true });
            Go(C("start"));
            for (int i = 0; i < 60000 && S.pending != null && G.absDay() <= maxDays; i++)
            {
                if (S.pending.t == "ending")
                {
                    res.end = S.pending.kind; break;
                }
                var c = Decide();
                if (c == null) { res.lastErr = "no cmd @" + S.pending.t; res.errs++; break; }
                Go(c);
                if (!string.IsNullOrEmpty(S.sick) && G.Tnow() / R.SLOTS != lastSickT) { lastSickT = G.Tnow() / R.SLOTS; res.sickDays++; }
                if (Trace != null && G.absDay() != traceDay) { traceDay = G.absDay(); Trace($"d{traceDay} 빚 {S.debt / 1e4:F0} 현금 {S.cash / 1e4:F0} 주식 {G.holdVal() / 1e4:F0} hp {S.hp:F0} st {S.stress:F0} 병 {S.sick} 유품 {string.Join(",", S.augs)}"); }
            }
            if (S.pending != null && S.pending.t != "ending" && G.absDay() <= maxDays) { res.errs++; res.lastErr = "step cap @" + S.pending.t; }   // 6만 수 안에 70일을 못 채움 = 봇이 헛돎
            if (S.ending != null) { res.end = S.ending; res.variant = S.endInfo?.variant ?? ""; }
            res.day = G.absDay(); res.debt = S.debt; res.cash = S.cash; res.earned = S.st.earned; res.interest = S.st.interest;
            res.repaid = S.st.repaid; res.gnet = S.st.gnet; res.invest = S.realized; res.faints = (int)S.st.faint;
            res.menheras = (int)(S.st.menOk + S.st.menBad); res.relic = S.augs.FirstOrDefault();
            return res;
        }
        void Go(SimCommand c)
        {
            res.steps++;
            foreach (var e in G.Apply(c)) if (e.t == "error") { res.errs++; res.lastErr = c.t + " @" + (S.pending?.t ?? "-"); }
        }

        /// smart0 = smart 인데 김사장 종잣돈 없이 시작 (처음 하는 사람)
        bool Smart => strat == "smart" || strat == "smart0";
        bool Careful => strat == "work" || Smart;
        double Due => S.paidMonth == S.month ? 0 : G.interestDue();
        /// 이자일까지 남은 날 (0 = 오늘 저녁)
        int DaysToPay => R.MONTH_DAYS - S.day;

        SimCommand Decide()
        {
            var P = S.pending;
            switch (P.t)
            {
                case "relic":
                    if (ForceRelic != null && S.augs.Count == 0 && P.offer != null && P.offer.Count > 0 && D.AUGS.Any(a => a.id == ForceRelic)) { if (!P.offer.Contains(ForceRelic)) P.offer[0] = ForceRelic; return C("pickRelic", "i", P.offer.IndexOf(ForceRelic)); }
                    return C("pickRelic", "i", r.Next(Math.Max(1, P.offer?.Count ?? 1)));
                case "home": return strat == "random" ? RandomHome() : Home();
                case "map":
                    {
                        var L = wantLoc; wantLoc = null;
                        if (strat == "random") { var open = D.LOCList.Where(x => x.open.Contains(S.slot) && (!x.rt || S.rt) && !G.locHidden(x.id)).ToList(); return open.Count == 0 || r.NextDouble() < 0.1 ? C("goTo", "loc", "home") : C("goTo", "loc", open[r.Next(open.Count)].id); }
                        return L != null && D.LOCS.TryGetValue(L, out var Lc) && Lc.open.Contains(S.slot) ? C("goTo", "loc", L) : C("goTo", "loc", "home");
                    }
                case "loc":
                    {
                        var opts = G.Query(() => G.locOpts(P.key)).Where(o => !o.dis && o.k != "l-trade").ToList();
                        if (strat == "random")
                        {
                            if (r.NextDouble() < 0.3) return C("tick", "m", r.Next(1, 20));
                            return opts.Count == 0 || r.NextDouble() < 0.2 ? C("leave") : C("act", "k", opts[r.Next(opts.Count)].k);
                        }
                        var a = wantAct; wantAct = null;
                        return a != null && opts.Any(o => o.k == a) ? C("act", "k", a) : C("leave");
                    }
                case "encounter": return C("encounter", "ask", false);
                case "work": return P.setup == null ? C("mgSetup") : C("mgResult", "score", mgLo + r.NextDouble() * (mgHi - mgLo));
                case "casino":
                    {
                        // 도박 봇 = 매판 올인 (턴 모드 bots 와 같음), 하이로우는 유리한 쪽
                        if (strat != "gamble" || S.cash < 10000) return C("casinoLeave");
                        int ch = P.kind == "card" ? (P.A <= 7 ? 1 : 0) : P.kind == "ladder" ? r.Next(3) : r.Next(2);
                        return C("bet", "stake", Math.Floor(S.cash / 10000) * 10000, "choice", ch);
                    }
                case "race": return C("raceLeave");
                case "scratch": return strat != "gamble" ? C("scratchDone") : P.card != null && !P.card.done ? C("scratchReveal") : P.n < 5 && S.cash >= 5000 ? C("scratchBuy") : C("scratchDone");
                case "lotto":   // 하루 한도 다 샀으면 사도 0장 → 칸마다 한 번만 시도
                    if (strat == "gamble" && P.n == 0 && S.cash >= 50000 && lottoT != G.Tnow()) { lottoT = G.Tnow(); return C("lottoBuy", "k", 5); }
                    return C("lottoDone");
                case "shop": return C("shopDone");
                case "relicShop": return C("relicDone");
                case "repay": { double a = Math.Min(repayAmt, P.mx); repayAmt = 0; return C("repay", "amt", Math.Max(0, Math.Floor(a / 10000) * 10000)); }
                case "brokerTrade": return C("brokerClose");
                case "watch":
                    {
                        // v4 장 보기: 매매할 게 있으면 하고, 아니면 시계를 흘림 (칸 끝나면 알아서 나감). 아침 장 열리기 전엔 9시까지
                        var t = strat == "random" ? (r.NextDouble() < 0.1 ? C("watchEnd") : null) : Trade(); if (t != null) return t;
                        if (strat != "random" && !(Smart && PendingBuy() != null) && (S.min >= R.RT_STOCK[0] || !Smart)) return C("watchEnd");
                        return C("tick", "m", Math.Max(1, Math.Min(60, G.slotEndMin(S.slot) - S.min)));
                    }
                case "loan":
                    {
                        double want = Smart ? (P.took == 0 ? 3000000 : P.took < 4000000 ? 1000000 : 0)
                            : strat == "gamble" ? R.LOAN_AMTS.Reverse().FirstOrDefault(a => S.debt + a <= G.loanCap() && S.cash < 3000000)
                            : P.took == 0 ? R.LOAN_AMTS[r.Next(R.LOAN_AMTS.Length)] : 0;
                        return want > 0 && S.debt + want <= G.loanCap() ? C("borrow", "amt", want) : C("loanDone");
                    }
                case "menhera": case "impulse":
                    {
                        int ok = P.opts.FindIndex(o => o.ok);
                        return C("reply", "i", Careful && r.NextDouble() < 0.75 ? ok : r.Next(P.opts.Count));
                    }
                case "event": { var o = P.opts.Where(x => !x.dis).ToList(); return C("evPick", "k", o[r.Next(o.Count)].k); }
                case "tempt": return C("tempt", "k", strat == "gamble" && S.cash >= 10000 ? "go" : "no");
                case "payday":
                    {
                        if (P.stage == "side") return C("payday", "k", "odd");
                        if (P.stage == "repay") return C("payday", "k", G.v4 && G.daysLeft() <= 0 ? "repayAll" : "keep");
                        if (G.v4 && G.daysLeft() <= 0 && P.opts.Any(o => o.k == "sell" && !o.dis)) return C("payday", "k", "sell");
                        foreach (var k in new[] { "pay", "sell", "loan", "bet" }) if (P.opts.Any(o => o.k == k && !o.dis)) return C("payday", "k", k);
                        return null;
                    }
            }
            return null;
        }

        // ---------- 집: 전략별 ----------
        SimCommand Home()
        {
            if (S.kun.TryGetValue("m", out var un) && un > 0) return C("read", "what", "kakao", "room", "m");   // 사람은 카톡 읽음 (안 읽으면 매시간 멘탈↑)
            if (strat == "smart" && !seeded) { seeded = true; return C("loanOpen"); }
            var t = Trade(); if (t != null) return t;
            // 상환: smart 는 다 갚을 수 있을 때 한 번에 (밑천 굴림), 나머지는 이자 낼 돈만 남기고 수시로
            double eq = S.cash + G.holdVal();
            if (Smart && S.debt > 0 && eq >= S.debt + Due)
            {
                if (S.cash >= S.debt) { repayAmt = S.debt; return C("repayOpen"); }
                if (G.stockOpen()) { var k = S.hold.Keys.FirstOrDefault(); if (k != null) return C("sell", "tk", k, "frac", 1, "where", "app"); }
            }
            double keep = Due * (DaysToPay <= 2 ? 1.05 : 0.6) + 150000;
            if (strat != "gamble" && !Smart && S.debt > 0 && S.cash - keep >= 100000) { repayAmt = Math.Min(S.debt, S.cash - keep); return C("repayOpen"); }
            bool eve = S.slot == R.SLOTS - 1;
            int left = G.slotEndMin(S.slot) - S.min;
            if (G.v4) return HomeV4(eve);
            // 장 열리기 전 아침: 살 리포트가 있으면 9시까지 기다림
            if (Smart && S.min < R.RT_STOCK[0] && PendingBuy() != null) return C("tick", "m", R.RT_STOCK[0] - S.min);
            // 오전 장중엔 증권사 박대리 정보 (하루 한 번)
            if (Smart && S.slot == 0 && G.stockOpen() && S.repT != G.Tnow() && S.hp >= 50 && S.min <= 600 && !G.locHidden("broker")) return Go("broker", "l-tip");
            // 몸 관리
            if (S.hp < 32) return C("rest");
            if (S.stress >= 58 || (G.Query(() => G.sickP()) >= 0.15 && !eve))
            {
                if (eve && S.cash >= 40000 && G.relaxCount("soju") == 0) return Go("bar", "l-soju");
                if (G.relaxCount("walk") < 2) return Go("park", "l-walk");
            }
            if (!string.IsNullOrEmpty(S.sick) && S.cash >= 200000 && S.slot < 2) return Go("hosp", "l-pharm");
            // 도박
            if (strat == "gamble")
            {
                // 턴 모드 gamble 봇과 같은 성향: 300만 밑이면 한도까지 땡김 → 저녁·점심은 카지노 올인, 아침은 복권, 빈털터리면 알바
                if (S.debt > 0 && S.cash >= S.debt + Due) { repayAmt = S.debt; return C("repayOpen"); }
                if (S.cash < 3000000 && S.debt + R.LOAN_AMTS[0] <= G.loanCap() && loanT != G.Tnow()) { loanT = G.Tnow(); return C("loanOpen"); }
                if (S.stress >= 80 || S.hp < 12) return C("rest");
                if (S.cash < 100000 && S.hp >= 45) return Go("work", "l-cafe");
                if (S.slot >= 1 && S.cash >= 10000) return Go("casino", new[] { "l-oddeven", "l-card", "l-slot", "l-ladder" }[r.Next(4)]);
                if (S.cash >= 10000) return Go("lotto", r.NextDouble() < 0.5 ? "l-lotto" : "l-scratch");
            }
            // 알바 (저녁은 끝까지 5시간 안 남으면 잠)
            if (S.hp >= 40 && (!eve || left >= R.RT_WORK - 60)) return Go("work", "l-cafe");
            if (eve) return C("rest");
            return C("tick", "m", Math.Max(1, Math.Min(60, left)));
        }
        /// v4: 행동 하나 = 칸 하나 (시계는 장 볼 때만). smart = 아침엔 장 보며 리포트 매매 · 부탁 지킴 · 저녁엔 미래랑 놀거나 쉼
        SimCommand HomeV4(bool eve)
        {
            // 만기 직전: 들고 있는 거 정리해서 갚을 수 있는 만큼 갚음 (빚 절반 밑이면 엔딩이 달라짐)
            if (G.daysLeft() <= 1 && strat != "random")
            {
                if (G.stockOpen() && S.hold.Count > 0) return C("sell", "tk", S.hold.Keys.First(), "frac", 1, "where", "app");
                if (S.cps.Count > 0) return C("closeCoins");
                double spare = S.cash - Due - 50000;
                if (S.debt > 0 && spare >= 100000) { repayAmt = Math.Min(S.debt, spare); return C("repayOpen"); }
            }
            var pr = G.promNow(); bool careful = Careful;
            if (S.hp < 32) return C("rest");
            if (careful && pr != null && pr.@do == "date" && !S.promDone && (eve || S.stress >= 50)) return C("date");
            if (S.stress >= 58) return careful || r.NextDouble() < 0.5 ? C("date") : C("rest");
            if (strat == "gamble")
            {
                if (S.debt > 0 && S.cash >= S.debt + Due) { repayAmt = S.debt; return C("repayOpen"); }
                if (S.cash < 3000000 && S.debt + R.LOAN_AMTS[0] <= G.loanCap() && loanT != G.Tnow()) { loanT = G.Tnow(); return C("loanOpen"); }
                if (S.cash < 100000 && S.hp >= 45) return Go("work", "l-cafe");
                if (S.slot >= 1 && S.cash >= 10000) return Go("casino", new[] { "l-oddeven", "l-slot" }[r.Next(2)]);
                if (S.cash >= 10000) return Go("lotto", "l-lotto");
            }
            if (Smart && S.slot <= 1 && !G.weekend() && (PendingBuy() != null || S.hold.Count > 0)) return C("watch");
            if (eve) return careful && S.aff < 70 ? C("date") : C("rest");
            if (S.hp >= 40) return Go("work", "l-cafe");
            return C("rest");
        }
        Tip PendingBuy() => G.activeTips().FirstOrDefault(x => Follow(x) && x.dir > 0 && x.Tr >= G.Tnow() && !tipDone.Contains(x.id));
        SimCommand Go(string loc, string act) { wantLoc = loc; wantAct = act; return C("map"); }

        /// 폰 매매 (시간 안 씀). smart = 리포트 따라 주식, gamble = 고배율 코인
        SimCommand Trade()
        {
            bool open = G.stockOpen();
            if (Smart)
            {
                var rs = G.rsch();
                if (rs.free < G.freeMax()) return C("report", "paid", false);
                if (rs.paid < R.RSCH_PAID_MAX && S.cash >= 1500000 && S.cash + G.holdVal() >= 8000000 && Due <= S.cash * 0.5) return C("report", "paid", true);   // 10만짜리는 굴릴 돈이 클 때만 본전
                if (!open) return null;
                // 결과 나온(또는 지난) 정보 종목은 팔기
                foreach (var k in S.hold.Keys.ToList())
                    if (!G.activeTips(k).Any(x => Follow(x) && x.dir > 0))
                    {
                        var h = S.hold.Get(k); double ret = h.q * S.mk.tk[k].p / h.cost - 1; res.sells++; res.sellRet += ret;
                        var lt = S.tips.LastOrDefault(x => x.tk == k && x.who == RES);
                        Trace?.Invoke($"   매도 {k} {ret:P1} (산 칸 {h.t0}, 지금 {G.Tnow()} {S.min / 60}시, 정보 {lt?.kind} {lt?.res} Tr {lt?.Tr} rr {lt?.rr:P0})");
                        return C("sell", "tk", k, "frac", 1, "where", "app");
                    }
                // 오를 거라는 리포트 → 이자 낼 돈 빼고 거의 다 (새 리포트가 여럿이면 나눠서)
                var tip = PendingBuy();
                if (tip != null)
                {
                    tipDone.Add(tip.id);
                    double reserve = Due * (DaysToPay <= 1 ? 1.05 : 0);
                    int more = G.activeTips().Count(x => Follow(x) && x.dir > 0 && x.Tr >= G.Tnow() && !tipDone.Contains(x.id));
                    double amt = Math.Floor((S.cash - reserve) * 0.95 / (1 + more) / 1000) * 1000;
                    Trace?.Invoke($"   매수 {tip.tk} {amt / 1e4:F0}만 (현금 {S.cash / 1e4:F0}, {S.min / 60}시, 정보 Tr {tip.Tr} 지금 {G.Tnow()})");
                    if (amt >= 10000) return C("buy", "tk", tip.tk, "amt", amt, "where", "app");
                }
                return null;
            }
            if (strat == "gamble")
            {
                foreach (var c in S.cps.ToList()) if (c.t0 < G.Tnow() || r.NextDouble() < 0.3) return C("close", "id", c.id);
                if (S.cps.Count == 0 && S.cash >= 50000 && r.NextDouble() < 0.25)
                {
                    var cs = D.TKList.Where(x => x.IsCoin && G.tkOpen(x.id) && !x.inv).ToList(); var tk = cs[r.Next(cs.Count)];
                    return C("open", "tk", tk.id, "dir", r.Next(2) * 2 - 1, "lev", tk.maxLev >= 50 ? 50 : tk.maxLev, "amt", Math.Floor(S.cash * 0.25 / 1000) * 1000);
                }
            }
            return null;
        }

        SimCommand RandomHome()
        {
            double x = r.NextDouble();
            if (G.v4 && x < 0.5) return x < 0.2 ? C("watch") : x < 0.3 ? C("date") : C("map");
            if (x < 0.5) return C("tick", "m", r.Next(1, 40));
            if (x < 0.58) return C("rest");
            if (x < 0.7 && G.stockOpen()) { var ks = G.STK().Where(G.tkOpen).ToList(); return C("buy", "tk", ks[r.Next(ks.Count)], "amt", S.cash * 0.3, "where", "app"); }
            if (x < 0.8) { var cs = D.TKList.Where(t => t.IsCoin && G.tkOpen(t.id)).ToList(); var t0 = cs[r.Next(cs.Count)]; return C("open", "tk", t0.id, "dir", r.Next(2) * 2 - 1, "lev", new[] { 1, 5, 25, 50 }[r.Next(4)], "amt", S.cash * 0.2); }
            if (x < 0.85) return C("closeCoins");
            if (x < 0.88 && G.stockOpen()) { var h = S.hold.Keys.FirstOrDefault(); if (h != null) return C("sell", "tk", h, "frac", 1, "where", "app"); }
            if (x < 0.9 && S.cash < 100000) return C("loanOpen");
            return C("map");
        }
    }
}
