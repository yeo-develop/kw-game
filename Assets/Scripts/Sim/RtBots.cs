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
            public double debt, cash, earned, interest, repaid, gnet, invest, aff, greed, promOk, promN; public int heistMax; public bool heistGo;
            public string lastErr, relic;
            /// v4 행동(칸) 사용 횟수: watch · work · date · rest · casino · lotto · park · 기타
            public Dictionary<string, int> acts = new Dictionary<string, int>();
        }
        public class Summary
        {
            public string strat; public int n;
            public double[] heist = new double[4]; public double aff, greed, promRate, sellRet, sells, clear, bad, alive, clearDay, clear28, p25, p50, p75, badDay, debtEnd, earnPerDay, gnet, invest, errs, faints, menheras, sickDays;
            /// 엔딩 종류(+변형)별 비율: clear · clear/gamble · clear/rich · bad1 · bad2 · bad3(과로) · bad4(멘헤라)
            public Dictionary<string, double> ends = new Dictionary<string, double>();
            /// 행동별 평균 비율 (v4)
            public Dictionary<string, double> acts = new Dictionary<string, double>();
            public double End(string kind) => ends.Where(kv => kv.Key == kind || kv.Key.StartsWith(kind + "/")).Sum(kv => kv.Value);
            public override string ToString() =>
                $"{strat,-7} n={n} 클리어 {clear:P0} (평균 {clearDay:F1}일, 4주 안 {clear28:P0}, 25/50/75% {p25}/{p50}/{p75}일) · 배드 {bad:P0} (평균 {badDay:F1}일) · 생존 {alive:P0} · 남은빚 {debtEnd / 1e4:F0}만 · 알바 {earnPerDay / 1e4:F1}만/일 · 투자 {invest / 1e4:F0}만 · 도박 {gnet / 1e4:F0}만 · 기절 {faints:F1} · 멘헤라 {menheras:F1} · 아픈날 {sickDays:F1} · 매도 {sells:F0}회 평균 {sellRet:P1} · 에러 {errs:F1}"
                + (ends.Count > 0 ? "\n        엔딩 " + string.Join(" · ", ends.OrderBy(kv => kv.Key, StringComparer.Ordinal).Select(kv => $"{kv.Key} {kv.Value:P1}")) : "")
                + (aff > 0 ? $"\n        호감 {aff:F0} · 욕심 {greed:F0} · 부탁 지킴 {promRate:P0}" : "")
                + (heist[0] > 0 ? $"\n        털기 루트 1단계 {heist[0]:P0} · 2단계 {heist[1]:P0} · 3단계 {heist[2]:P0} · 턴다 {heist[3]:P0}" : "") + (acts.Count > 0 ? "\n        행동 " + string.Join(" · ", acts.OrderByDescending(kv => kv.Value).Select(kv => $"{kv.Key} {kv.Value:P0}")) : "");
        }

        public const string RES = "리서치", PARK = "박대리";
        static bool Follow(Tip x) => x.who == RES || x.who == PARK;
        /// 하루마다 한 줄 (하네스 BAL_TRACE)
        public static Action<string> Trace;
        /// 시작 유품 고정 (하네스 BAL_FORCE · 테스트) — 첫 상자에서 이걸 집음
        public static string ForceRelic;
        /// v4 2부(빚 1억)부터 시작 (하네스 BAL_PART2)
        public static bool Part2;
        int traceDay;
        readonly GameData D; readonly string strat; readonly bool heistRoute; readonly Random r; readonly double mgLo, mgHi;
        GameSim G; GameState S => G.S; Rules R => D.RULES;
        string wantLoc, wantAct; double repayAmt;
        int lastSickT = -1; bool seeded; int bullLoan; int loanT = -1, lottoT = -1, casinoT = -1;
        readonly HashSet<int> tipDone = new HashSet<int>();
        /// v4 속보 매매: 칸 시작 속보 보고 산 종목 → 산 칸 번호 (그 칸 끝나기 전엔 안 팖). 가짜인지는 봇도 모름
        readonly Dictionary<string, int> newsPos = new Dictionary<string, int>(); int newsT = -1;
        readonly Result res;

        RtBots(GameData d, int seed, string strat, double mgLo, double mgHi)
        {
            heistRoute = strat.EndsWith("+heist"); if (heistRoute) strat = strat.Substring(0, strat.Length - 6);   // "pro+heist" = pro 인데 털기 루트를 끝까지 탐
            D = d; this.strat = strat; r = new Random(seed * 7919 + 13); this.mgLo = mgLo; this.mgHi = mgHi;
            res = new Result { seed = seed, strat = strat + (heistRoute ? "+heist" : "") };
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
                heist = new[] { L.Average(x => x.heistMax >= 1 ? 1.0 : 0), L.Average(x => x.heistMax >= 2 ? 1.0 : 0), L.Average(x => x.heistMax >= 3 ? 1.0 : 0), L.Average(x => x.heistGo ? 1.0 : 0) },
                aff = L.Average(x => x.aff), greed = L.Average(x => x.greed), promRate = L.Sum(x => x.promOk) / Math.Max(1, L.Sum(x => x.promN)),
                acts = L.SelectMany(x => x.acts.Keys).Distinct().ToDictionary(k => k, k => L.Average(x => { double n = x.acts.Values.Sum(); return n > 0 && x.acts.TryGetValue(k, out var v) ? v / n : 0; })),
            };
        }

        /// 클리어 일수 분위 (못 깬 판 = 무한대 → 999)
        static double Pct(List<Result> L, double q) { var d = L.Select(x => x.end == "clear" ? x.day : 999).OrderBy(x => x).ToList(); return d[Math.Min(d.Count - 1, (int)(q * d.Count))]; }

        static SimCommand C(string t, params object[] kv) => new SimCommand(t, kv);

        Result Play(int maxDays)
        {
            G = GameSim.Create(D, res.seed, new GameSim.Opts { rt = true });
            Go(C("start"));
            if (Part2 && G.v4) { S.part = 2; S.debt = R.V4_PART2_DEBT; S.st.maxDebt = S.st.minDebt = S.debt; }   // 2부부터 바로 (밸런스 측정용)
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
            res.menheras = (int)(S.st.menOk + S.st.menBad); res.relic = S.augs.FirstOrDefault(); res.aff = S.aff; res.greed = S.greed;
            return res;
        }
        void Go(SimCommand c)
        {
            res.steps++;
            int d0 = G.absDay(); string ps0 = G.v4 ? G.promState() : null;
            string ak = c.t == "watch" || c.t == "date" || c.t == "rest" ? c.t
                : c.t == "act" ? (c.Str("k") is string k ? (k.StartsWith("l-cafe") || k == "l-store" || k == "l-ware" || k == "l-mart" ? "work" : k == "l-oddeven" || k == "l-slot" || k == "l-card" || k == "l-ladder" ? "casino" : k == "l-lotto" || k == "l-scratch" ? "lotto" : "out:" + k.Substring(2)) : null) : null;
            if (ak != null && G.v4) res.acts[ak] = (res.acts.TryGetValue(ak, out var n0) ? n0 : 0) + 1;
            foreach (var e in G.Apply(c)) if (e.t == "error") { res.errs++; res.lastErr = c.t + " @" + (S.pending?.t ?? "-"); }
            if (ps0 != null && G.absDay() != d0) { res.promN++; if (ps0 == "ok") res.promOk++; }   // 자정 넘긴 명령 직전 부탁 상태
            res.heistMax = Math.Max(res.heistMax, S.heist); res.heistGo |= S.heistGo;
        }

        /// smart0 = smart 인데 김사장 종잣돈 없이 시작 (처음 하는 사람)
        bool Smart => strat == "smart" || strat == "smart0" || strat == "pro" || strat == "casual";
        /// v4 사람 봇: pro = 잘하는 사람 (장 보며 리포트 매매 · 국면 타기 · 부탁 지킴 · 미래 챙김), casual = 보통 사람 (섞어서 · 실수 · 가끔 도박/고배율)
        bool Human => strat == "pro" || strat == "casual";
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
                        if (heistRoute && S.heist > 0 && casinoT != G.Tnow() && S.cash >= 50000) { casinoT = G.Tnow(); return C("bet", "stake", 50000, "choice", r.Next(2)); }   // 털기 루트: 욕심 채우러 한 판만
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
                        if (strat != "random" && G.daysLeft() <= 3 && S.hold.Count > 0 && G.stockTradeOk()) return C("sell", "tk", S.hold.Keys.First(), "frac", 1, "where", "app");   // 만기 직전 정리
                        var t = strat == "random" ? (r.NextDouble() < 0.1 ? C("watchEnd") : null) : Trade(); if (t != null) return t;
                        if (Smart && S.debt > 0 && S.cash >= S.debt + Due) return C("watchEnd");   // 다 팔았으면 집에 가서 갚기
                        if (strat != "random" && !(Smart && PendingBuy() != null) && (S.min >= R.RT_STOCK[0] || !Smart || G.weekend())) return C("watchEnd");
                        return C("tick", "m", Math.Max(1, Math.Min(60, G.slotEndMin(S.slot) - S.min)));
                    }
                case "loan":
                    {
                        double want = strat == "pro" && bullLoan == 1 ? (G.loanCap() - S.debt >= 3000000 && P.took < 6000000 ? 3000000 : 0) : strat == "casual" ? (P.took == 0 ? 1000000 : 0) : Smart ? (P.took == 0 ? 3000000 : P.took < 4000000 ? 1000000 : 0)
                            : strat == "gamble" ? R.LOAN_AMTS.Reverse().FirstOrDefault(a => S.debt + a <= G.loanCap() && S.cash < 3000000)
                            : P.took == 0 ? R.LOAN_AMTS[r.Next(R.LOAN_AMTS.Length)] : 0;
                        return want > 0 && S.debt + want <= G.loanCap() ? C("borrow", "amt", want) : C("loanDone");
                    }
                case "menhera": case "impulse":
                    {
                        int ok = P.opts.FindIndex(o => o.ok);
                        double acc = strat == "pro" ? 0.95 : strat == "casual" ? 0.7 : 0.75;
                        return C("reply", "i", Careful && r.NextDouble() < acc ? ok : r.Next(P.opts.Count));
                    }
                case "event":
                    {
                        var o = P.opts.Where(x => !x.dis).ToList();
                        var ev = D.EVENTS.FirstOrDefault(e => e.id == P.evId);
                        if (ev != null && heistRoute)
                        {
                            // 털기 루트: 다음 단계로 가는 선택지 (없으면 아래 보통 고르기)
                            for (int i = 0; i < ev.opts.Count; i++)
                                if ((ev.opts[i].go || ev.opts[i].heist > S.heist) && !P.opts[i].dis) return C("evPick", "k", P.opts[i].k);
                        }
                        if (ev != null && (strat == "pro" || (strat == "casual" && r.NextDouble() < 0.5)))
                        {
                            // 호감·현금·멘탈을 대충 더해 제일 좋아 보이는 걸 (확률 선택지는 기대값)
                            double Val(EvOpt x) => x == null ? 0 : x.aff * 1.5 - x.greed * 0.3 + x.cash / 100000 - x.st * 0.3 + x.hp * 0.2 - x.debtPct * S.debt / 300000 - x.addict * 0.5;
                            var best = o.OrderByDescending(x => { var e0 = ev.opts[P.opts.IndexOf(x)]; return e0.p < 1 && e0.fail != null ? e0.p * Val(e0) + (1 - e0.p) * Val(e0.fail) : Val(e0); }).First();
                            return C("evPick", "k", best.k);
                        }
                        return C("evPick", "k", o[r.Next(o.Count)].k);
                    }
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
            if ((strat == "smart" || strat == "pro") && !seeded) { seeded = true; return C("loanOpen"); }
            // 잘하는 사람: 2장 불장 들어가면 김사장 돈 더 땡겨서 탐 (빚 내서 빚 갚기)
            if (strat == "pro" && G.v4 && G.chapter() == 2 && bullLoan == 0) { bullLoan = 1; return C("loanOpen"); }
            var t = Trade(); if (t != null) return t;
            // 상환: smart 는 다 갚을 수 있을 때 한 번에 (밑천 굴림), 나머지는 이자 낼 돈만 남기고 수시로
            double eq = S.cash + G.holdVal();
            if (Smart && S.debt > 0 && eq >= S.debt + Due)
            {
                if (S.cash >= S.debt) { repayAmt = S.debt; return C("repayOpen"); }
                if (S.cps.Count > 0) return C("closeCoins");
                if (G.stockTradeOk()) { var k = S.hold.Keys.FirstOrDefault(); if (k != null) return C("sell", "tk", k, "frac", 1, "where", "app"); }
                if (G.v4 && S.hold.Count > 0 && S.slot <= 1 && !G.weekend()) return C("watch");   // v4: 국장은 장 보기에서 팔아야 함
            }
            double keep = Due * (DaysToPay <= 2 ? 1.05 : 0.6) + 150000;
            if (strat != "gamble" && !Smart && S.debt > 0 && S.cash - keep >= 100000) { repayAmt = Math.Min(S.debt, S.cash - keep); return C("repayOpen"); }
            bool eve = S.slot == R.SLOTS - 1;
            int left = G.slotEndMin(S.slot) - S.min;
            if (G.v4) return HomeV4(eve);
            // 장 열리기 전 아침: 살 리포트가 있으면 9시까지 기다림
            if (Smart && S.min < R.RT_STOCK[0] && PendingBuy() != null) return C("tick", "m", R.RT_STOCK[0] - S.min);
            // 오전 장중엔 증권사 박대리 정보 (하루 한 번)
            if (Smart && S.slot == 0 && G.stockTradeOk() && S.repT != G.Tnow() && S.hp >= 50 && S.min <= 600 && !G.locHidden("broker")) return Go("broker", "l-tip");
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
            if (G.daysLeft() <= 3 && strat != "random")
            {
                if (G.stockTradeOk() && S.hold.Count > 0) return C("sell", "tk", S.hold.Keys.First(), "frac", 1, "where", "app");
                if (G.stockOpen() && S.hold.Count > 0) return C("watch");   // v4: 국장은 장 보기 칸에서만 팔 수 있음
                if (S.cps.Count > 0) return C("closeCoins");
                double spare = S.cash - Due - 50000;
                if (S.debt > 0 && spare >= 100000) { repayAmt = Math.Min(S.debt, spare); return C("repayOpen"); }
            }
            var pr = G.promNow(); bool careful = Careful;
            if (Human) return HomeHuman(eve, pr);
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
            if (Smart && S.slot <= 1 && !G.weekend() && (DaysToPay <= 2 && S.cash < Due * 1.05 && S.hold.Count > 0 || PendingBuy() != null || S.hold.Count > 0 || S.slot == 0 && G.rsch().free < G.freeMax())) return C("watch");
            if (eve) return careful && S.aff < 70 ? C("date") : C("rest");
            if (S.hp >= 40) return Go("work", "l-cafe");
            return C("rest");
        }
        /// v4 사람 봇. 칸 하나 = 행동 하나 → 칸마다 제일 값진 것: 장중 리포트·국면 → 장 보기, 미래 부탁·호감 → 놀기, 나머지 알바
        SimCommand HomeHuman(bool eve, GameSim.Prom pr)
        {
            bool pro = strat == "pro"; double slip = pro ? 0 : 0.25;   // casual 은 가끔 엉뚱한 선택
            bool keep = pro || r.NextDouble() < 0.6;                     // 부탁을 신경 쓰는지
            if (S.hp < 30) return C("rest");
            if (!pro && r.NextDouble() < slip)
            {
                double x = r.NextDouble();
                if (x < 0.25 && S.cash >= 50000 && S.slot >= 1 && !(keep && pr?.avoid == "gamble")) return Go("casino", r.NextDouble() < 0.5 ? "l-oddeven" : "l-slot");
                if (x < 0.4 && S.cash >= 20000) return Go("lotto", "l-lotto");
                if (x < 0.6) return Go("park", "l-walk");
                if (x < 0.8) return C("watch");
                return C("rest");
            }
            // 털기 루트: 미래 각오(욕심)가 모자라면 카지노 한 판 (도박 금지 부탁인 날은 참음)
            if (heistRoute && S.heist > 0 && S.greed < R.V4_GREED_HEIST + 5 && S.slot >= 1 && S.cash >= 100000 && pr?.avoid != "gamble") return Go("casino", "l-oddeven");
            if (keep && pr != null && !S.promDone)
            {
                if (pr.@do == "date" && (eve || G.weekend() || S.stress >= 50)) return C("date");
                if (pr.@do == "datenight" && eve) return C("date");
                if (pr.@do == "work" && !eve && S.hp >= 40 && !(S.slot == 0 && PendingBuy() != null)) return Go("work", "l-cafe");
            }
            if (S.stress >= 60) return S.dateN == 0 && S.aff < 85 ? C("date") : Go("park", "l-walk");
            bool stockSlot = S.slot <= 1 && !G.weekend();
            // 좋은 속보가 떴으면 장 보러 감 (코인 뉴스는 밤·주말에도)
            if (S.news != null && S.news.dir > 0 && D.TK.TryGetValue(S.news.tk, out var ntk) && !ntk.inv && (ntk.IsCoin || stockSlot) && (pro || r.NextDouble() < 0.5) && S.cash >= 400000) return C("watch");
            if (stockSlot && (DaysToPay <= 2 && S.cash < Due * 1.05 && S.hold.Count > 0 || PendingBuy() != null || S.hold.Count > 0 || (pro && RideWanted()) || S.slot == 0 && G.rsch().free < G.freeMax())) return C("watch");
            if (eve)
            {
                if (S.aff < (heistRoute && S.heist > 0 ? 80 : pro ? 70 : 65)) return C("date");   // 호감은 엔딩 문턱(60)보다 조금 위로만 — 남는 밤은 야간 알바 (털기 루트면 미래가 믿고 따라오게 80)
                return S.hp >= 55 ? Go("work", "l-cafe") : C("rest");
            }
            if (G.weekend() && S.aff < 70 && S.dateN == 0) return C("date");
            return S.hp >= 40 ? Go("work", "l-cafe") : C("rest");
        }
        /// 국면 타기 (잘하는 사람): 2장 불장 = 대장코인 2배 롱 · 3장 과열 = 고베타 대형주 · 4장 폭락 = 곱버스. 장이 바뀌면 갈아탐
        string RideTk()
        {
            if (!G.v4 || G.daysLeft() <= 3) return null;
            int ch = G.chapter();
            if (ch == 2) return "BTK";
            if (ch == 3) return G.STK().Where(G.tkOpen).Where(k => !D.TK[k].junk && !D.TK[k].inv && !D.TK[k].meme).OrderByDescending(k => D.TK[k].beta).FirstOrDefault();
            if (ch == 4) return D.TKList.FirstOrDefault(t => t.inv && G.tkOpen(t.id))?.id;
            return null;
        }
        double Spare => Math.Floor((S.cash - Due * 1.05 - 300000) / 1000) * 1000;
        bool RideWanted() => RideTk() is string k && (D.TK[k].IsCoin ? !S.cps.Any(c => c.tk == k) : !S.hold.Has(k)) && Spare >= 500000;
        Tip PendingBuy() => G.activeTips().FirstOrDefault(x => Follow(x) && x.dir > 0 && x.Tr >= G.Tnow() && !tipDone.Contains(x.id));
        SimCommand Go(string loc, string act) { wantLoc = loc; wantAct = act; return C("map"); }

        /// 폰 매매 (시간 안 씀). smart = 리포트 따라 주식, gamble = 고배율 코인
        SimCommand Trade()
        {
            bool open = G.stockTradeOk();
            if (Smart)
            {
                // 다 갚을 수 있으면 정리 (장 보기 중이면 여기서 팔고, 집에 가서 갚음)
                if (G.v4 && S.debt > 0 && S.cash + G.holdVal() >= S.debt + Due && S.cash < S.debt + Due)
                {
                    if (S.cps.Count > 0) return C("closeCoins");
                    if (open && S.hold.Count > 0) return C("sell", "tk", S.hold.Keys.First(), "frac", 1, "where", "app");
                }
                var rs = G.rsch();
                bool canRep = !G.v4 || S.pending?.t == "watch";   // v4: 리포트는 장 보기 칸에서만
                if (canRep && rs.free < G.freeMax()) return C("report", "paid", false);
                if (canRep && rs.paid < R.RSCH_PAID_MAX && S.cash >= 1500000 && S.cash + G.holdVal() >= 8000000 && Due <= S.cash * 0.5) return C("report", "paid", true);   // 10만짜리는 굴릴 돈이 클 때만 본전
                // v4 금요일: 이자 낼 현금이 모자라면 주식 정리 (주말 지나 이자일에 급매하면 20% 손해)
                if (G.v4 && open && DaysToPay <= 2 && S.cash < Due * 1.05 && S.hold.Count > 0)
                {
                    var k0 = S.hold.Keys.OrderByDescending(k => S.hold.Get(k).q * S.mk.tk[k].p).First();
                    double need = Due * 1.05 - S.cash, v = S.hold.Get(k0).q * S.mk.tk[k0].p;
                    return C("sell", "tk", k0, "frac", Math.Min(1, Math.Ceiling(need / Math.Max(1, v) * 20) / 20 + 0.05), "where", "app");
                }
                // 속보 매매 (pro 항상 · casual 반쯤): 좋은 속보면 그 종목을 이번 칸에 삼, 다음 칸에 정리
                if (G.v4 && S.pending?.t == "watch" && (strat == "pro" || strat == "casual") && newsT != G.Tnow() && S.news != null && S.news.dir > 0 && D.TK.TryGetValue(S.news.tk, out var nt) && G.tkOpen(nt.id) && !nt.inv)
                {
                    newsT = G.Tnow();
                    if (strat == "pro" || r.NextDouble() < 0.5)
                    {
                        double amt = Math.Floor(Math.Max(0, S.cash - Due * (DaysToPay <= 2 ? 1.05 : 0) - 200000) * 0.6 / 1000) * 1000;
                        if (amt >= 100000 && nt.IsCoin && !S.cps.Any(c => c.tk == nt.id)) { newsPos[nt.id] = G.Tnow(); return C("open", "tk", nt.id, "dir", 1, "lev", 1, "amt", amt); }
                        if (amt >= 100000 && nt.IsStock && open) { newsPos[nt.id] = G.Tnow(); return C("buy", "tk", nt.id, "amt", amt, "where", "app"); }
                    }
                }
                foreach (var kv in newsPos.ToList())
                    if (kv.Value < G.Tnow())
                    {
                        newsPos.Remove(kv.Key);
                        var c0 = S.cps.FirstOrDefault(c => c.tk == kv.Key && c.lev == 1); if (c0 != null) return C("close", "id", c0.id);
                    }
                // 결과 나온(또는 지난) 정보 종목은 팔기
                string ride = strat == "pro" ? RideTk() : null;
                if (strat == "pro" && G.v4)
                {
                    // 국면 바뀌면 지난 탈 것 정리 (코인 롱 · 주식)
                    foreach (var c in S.cps.ToList()) if (c.tk != ride && !newsPos.ContainsKey(c.tk)) return C("close", "id", c.id);
                    if (open) foreach (var k in S.hold.Keys.ToList()) if (k != ride && (k == "INV" || D.TK[k].beta >= 1.2) && !G.activeTips(k).Any(x => Follow(x) && x.dir > 0)) return C("sell", "tk", k, "frac", 1, "where", "app");
                    if (ride != null && D.TK[ride].IsCoin && RideWanted() && PendingBuy() == null) return C("open", "tk", ride, "dir", 1, "lev", 2, "amt", Spare);
                }
                if (ride != null && S.hold.Has(ride) && PendingBuy() != null && S.cash < 500000 && open) return C("sell", "tk", ride, "frac", 1, "where", "app");
                if (strat == "casual" && G.v4 && S.cps.Count == 0 && S.cash >= 300000 && r.NextDouble() < 0.04 && !(G.promNow()?.avoid == "coin" && r.NextDouble() < 0.6))
                {
                    var cs = D.TKList.Where(x => x.IsCoin && G.tkOpen(x.id) && !x.inv).ToList(); var tk = cs[r.Next(cs.Count)];
                    return C("open", "tk", tk.id, "dir", 1, "lev", 10, "amt", Math.Floor(S.cash * 0.2 / 1000) * 1000);
                }
                if (strat == "casual") foreach (var c in S.cps.ToList()) if (c.t0 < G.Tnow() - 2) return C("close", "id", c.id);
                if (!open) return null;
                foreach (var k in S.hold.Keys.ToList())
                    if (k != ride && !(newsPos.TryGetValue(k, out var nT) && nT == G.Tnow()) && !G.activeTips(k).Any(x => Follow(x) && x.dir > 0))
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
                    double reserve = Due * (DaysToPay <= (G.v4 ? 2 : 1) ? 1.05 : 0);   // v4: 주말엔 국장 못 파니 금요일부터 이자 남김
                    int more = G.activeTips().Count(x => Follow(x) && x.dir > 0 && x.Tr >= G.Tnow() && !tipDone.Contains(x.id));
                    double amt = Math.Floor((S.cash - reserve) * 0.95 / (1 + more) / 1000) * 1000;
                    Trace?.Invoke($"   매수 {tip.tk} {amt / 1e4:F0}만 (현금 {S.cash / 1e4:F0}, {S.min / 60}시, 정보 Tr {tip.Tr} 지금 {G.Tnow()})");
                    if (amt >= 10000) return C("buy", "tk", tip.tk, "amt", amt, "where", "app");
                }
                if (ride != null && !D.TK[ride].IsCoin && RideWanted() && PendingBuy() == null) return C("buy", "tk", ride, "amt", Spare, "where", "app");
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
            if (x < 0.7 && G.stockTradeOk()) { var ks = G.STK().Where(G.tkOpen).ToList(); return C("buy", "tk", ks[r.Next(ks.Count)], "amt", S.cash * 0.3, "where", "app"); }
            if (x < 0.8) { var cs = D.TKList.Where(t => t.IsCoin && G.tkOpen(t.id)).ToList(); var t0 = cs[r.Next(cs.Count)]; return C("open", "tk", t0.id, "dir", r.Next(2) * 2 - 1, "lev", new[] { 1, 5, 25, 50 }[r.Next(4)], "amt", S.cash * 0.2); }
            if (x < 0.85) return C("closeCoins");
            if (x < 0.88 && G.stockTradeOk()) { var h = S.hold.Keys.FirstOrDefault(); if (h != null) return C("sell", "tk", h, "frac", 1, "where", "app"); }
            if (x < 0.9 && S.cash < 100000) return C("loanOpen");
            return C("map");
        }
    }
}
