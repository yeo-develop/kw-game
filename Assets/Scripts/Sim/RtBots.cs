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
            /// 속보 매매: 산 칸 다음 칸까지 그 종목 수익 (가짜 속보 되돌림이 먹히는지)
            public int newsN; public double newsRet;
            public double debt, cash, earned, interest, repaid, gnet, invest, aff, greed, promOk, promN; public int heistMax; public bool heistGo;
            public string lastErr, relic;
            /// v4 알바 중 청산 경보 횟수 · 그중 몰래 폰 본 횟수 · 경보 뒤 실제 청산(알바 중)
            public int alerts, peeks, liqWork;
            /// 루프 지표 (docs/BLUEPRINT.md ⑥): 7일째 자산 · 원금 첫 상환일 · 2배↑ 포지션 들고 알바 간 칸 · 대출 누계 · 관문 통과/미납 · 매도 수익률들
            public double asset7 = -1, asset14 = -1, borrowed; public int firstRepay, workHeld, gatePass, gateMiss; public List<double> sellRets = new List<double>();
            /// 실현 손익을 어디서 벌었나 (봇이 잡은 이유별): ride 기본 포지션 · tip 코인 리포트 · news 속보 · punt 한 방 · stock 주식 · etc
            public Dictionary<string, double> pnl = new Dictionary<string, double>(); public Dictionary<string, int> pnlN = new Dictionary<string, int>();
            /// 분석가 리포트를 본 횟수와 태도 (따라 탐 · 반대로 탐 · 거름) · 유료 리포트 · 코인 리포트 매매의 증거금 대비 수익률 합/건수 · 만기 주 전에 미납한 적 있나
            public int tipFollow, tipFade, tipSkip, paidRep, tipRetN; public double tipRetSum; public bool missEarly;
            /// 주차별 (1~4): 그 주 끝까지 쌓인 매매 실현손익 · 그 주 시작 때 굴릴 돈(현금+보유) · 그 주에 연 코인 포지션 수와 증거금 합
            public double[] wkReal = new double[5], wkBank = new double[5], wkMargin = new double[5]; public int[] wkOpens = new int[5];
            /// v4 이번 판 국면 시나리오 (장 1~4, 하네스 BAL_SCEN 진단용)
            public string scen;
            /// v4 행동(칸) 사용 횟수: watch · work · date · rest · casino · lotto · park · 기타
            public Dictionary<string, int> acts = new Dictionary<string, int>();
        }
        public class Summary
        {
            public string strat; public int n;
            public double[] heist = new double[4]; public double newsN, newsRet, aff, greed, promRate, sellRet, sells, clear, bad, alive, clearDay, clear28, p25, p50, p75, badDay, debtEnd, earnPerDay, gnet, invest, errs, faints, menheras, sickDays;
            /// 엔딩 종류(+변형)별 비율: clear · clear/gamble · clear/rich · bad1 · bad2 · bad3(과로) · bad4(멘헤라)
            public Dictionary<string, double> ends = new Dictionary<string, double>();
            /// 행동별 평균 비율 (v4)
            public Dictionary<string, double> acts = new Dictionary<string, double>();
            /// v4 경보: 판당 평균 횟수 · 경보가 한 번이라도 뜬 판 비율 · 몰래 폰 본 비율 · 알바 중 청산 판당
            public double alerts, alertRuns, peekRate, liqWork;
            /// 루프 지표: 7일째 자산 중앙 · 원금 첫 상환일 중앙 · 포지션 들고 알바 칸/판 · 만기 전 탈락 · 대출 없이 깬 비율(클리어 중) · 관문 통과/미납 · 매도 수익률 중앙
            public double asset7, asset14, firstRepay, workHeld, early, noLoanClear, gatePass, gateMiss, sellMed;
            /// 읽기 지표: 리포트 판당 건수 · 따라/반대/거름 비율 · 유료 판당 · 코인 리포트 매매 건당 증거금 대비 수익률 · 만기 주 전에 미납한 판 비율 · 그중 만기까지 간 비율 · 판당 대출
            public double tips, tipFollow, tipFade, tipSkip, paidRep, tipRet, missRuns, missRecover, borrowed;
            /// 주차별 평균 (그 주까지 살아 있던 판만): 그 주에 번 매매 손익 · 주 시작 때 굴릴 돈 · 연 포지션 수 · 포지션당 증거금
            public double[] wkPnl = new double[5], wkBank = new double[5], wkOpens = new double[5], wkMargin = new double[5], wkAlive = new double[5];
            /// 끝났을 때 남은 빚 분위 (10/25/50/75/90%, 클리어 = 0)
            public double[] debtQ = new double[5];
            public Dictionary<string, double> pnl = new Dictionary<string, double>(), pnlN = new Dictionary<string, double>();
            public double End(string kind) => ends.Where(kv => kv.Key == kind || kv.Key.StartsWith(kind + "/")).Sum(kv => kv.Value);
            public override string ToString() =>
                $"{strat,-7} n={n} 클리어 {clear:P0} (평균 {clearDay:F1}일, 4주 안 {clear28:P0}, 25/50/75% {p25}/{p50}/{p75}일) · 배드 {bad:P0} (평균 {badDay:F1}일) · 생존 {alive:P0} · 남은빚 {debtEnd / 1e4:F0}만 · 알바 {earnPerDay / 1e4:F1}만/일 · 투자 {invest / 1e4:F0}만 · 도박 {gnet / 1e4:F0}만 · 기절 {faints:F1} · 멘헤라 {menheras:F1} · 아픈날 {sickDays:F1} · 매도 {sells:F0}회 평균 {sellRet:P1}" + (newsN > 0 ? $" · 속보 매매 {newsN:F1}회 평균 {newsRet:P1}" : "") + $" · 에러 {errs:F1}"
                + $"\n        루프 7일째 자산 {asset7 / 1e4:F0}만 · 14일째 번 것 {asset14 / 1e4:F0}만 · 원금 첫 상환 {firstRepay:F0}일째 · 포지션 들고 알바 {workHeld:F1}칸/판 · 만기 전 탈락 {early:P0} · 대출 없이 클리어 {noLoanClear:P0} · 관문 통과 {gatePass:F1}/미납 {gateMiss:F1} · 매도 중앙 {sellMed:P1}"
                + (tips > 0 ? $"\n        읽기 리포트 {tips:F1}건/판 (따라 {tipFollow:P0} · 반대 {tipFade:P0} · 거름 {tipSkip:P0}) · 유료 {paidRep:F1}건/판 · 코인 리포트 매매 건당 {tipRet:+0%;-0%} (증거금 대비) · 미납한 판 {missRuns:P0} 중 만기까지 {missRecover:P0} · 대출 {borrowed / 1e4:F0}만/판" : "")
                + (wkAlive[1] > 0 ? $"\n        남은 빚 분위 10/25/50/75/90% = {string.Join(" / ", debtQ.Select(x => (x / 1e4).ToString("F0")))}만" : "")
                + (wkAlive[1] > 0 ? "\n        주차 " + string.Join(" · ", Enumerable.Range(1, 4).Select(w => $"{w}주 [{wkAlive[w]:P0} 생존] 굴릴 돈 {wkBank[w] / 1e4:F0} → 매매 {wkPnl[w] / 1e4:+0;-0}만 ({wkOpens[w]:F1}건 × {wkMargin[w] / 1e4:F0}만)")) : "")
                + (pnl.Count > 0 ? "\n        손익(판당) " + string.Join(" · ", pnl.OrderByDescending(kv => Math.Abs(kv.Value)).Select(kv => $"{kv.Key} {kv.Value / 1e4:+0;-0}만({pnlN[kv.Key]:F1}건)")) : "")
                + (alerts > 0 ? $" · 경보 {alerts:F2}회/판 ({alertRuns:P0} 판, 폰 봄 {peekRate:P0}, 알바 중 청산 {liqWork:F2}회/판)" : "")
                + (ends.Count > 0 ? "\n        엔딩 " + string.Join(" · ", ends.OrderBy(kv => kv.Key, StringComparer.Ordinal).Select(kv => $"{kv.Key} {kv.Value:P1}")) : "")
                + (aff > 0 ? $"\n        호감 {aff:F0} · 욕심 {greed:F0} · 부탁 지킴 {promRate:P0}" : "")
                + (heist[0] > 0 ? $"\n        털기 루트 1단계 {heist[0]:P0} · 2단계 {heist[1]:P0} · 3단계 {heist[2]:P0} · 턴다 {heist[3]:P0}" : "") + (acts.Count > 0 ? "\n        행동 " + string.Join(" · ", acts.OrderByDescending(kv => kv.Value).Select(kv => $"{kv.Key} {kv.Value:P0}")) : "");
        }

        public const string RES = "리서치", PARK = "박대리";
        static bool Follow(Tip x) => x.who == RES || x.who == PARK;
        /// 분석가 리포트를 어떻게 받아들이나 (관문 규칙): +1 따라 탐 · −1 반대로 탐 · 0 거름.
        /// pro = 전적을 읽음 (맞힌 게 틀린 것보다 2번 넘게 많아야 믿고, 그 반대면 거꾸로 탐) · casual = 전적이 눈에 띄게 나쁠 때만 거름 · proall = 전부 따라 탐
        int Stance(Tip x)
        {
            if (!G.gateOn) return Follow(x) ? 1 : 0;
            if (!G.srcOf(x).an) return 0;
            if (blind) return 1;
            int n = 0, h = 0; if (S.srcStat.TryGetValue(x.who, out var g)) { h = g[0]; n = g[1]; }
            if (strat != "pro") return n >= 3 && h * 2.5 < n ? 0 : 1;
            return n < 4 ? 0 : h >= n * ProTrust ? 1 : h <= n * (1 - ProTrust) ? -1 : 0;
        }
        /// 리포트가 가리키는 쪽 × 내 태도 = 내가 탈 방향 (0 = 안 탐)
        int Eff(Tip x) => x.dir * Stance(x);
        /// pro 가 분석가를 믿는(또는 거꾸로 타는) 전적 문턱: 적중률 ProTrust 이상 = 따라 탐 · 1 − ProTrust 이하 = 반대로
        public static double ProTrust = 0.65;
        readonly HashSet<int> tipNoted = new HashSet<int>();
        /// 믿을 만한(또는 거꾸로 탈 만한) 분석가 중 전적이 가장 뚜렷한 사람 — 유료 리포트를 물어볼 상대
        string BestAnalyst()
        {
            string best = null;
            double bq = 0;
            foreach (var a in G.analysts()) { if (!S.srcStat.TryGetValue(a.id, out var g) || g[1] < 4) continue; double q = Math.Abs((double)g[0] / g[1] - 0.5); if (q >= ProTrust - 0.5 && q > bq) { bq = q; best = a.id; } }
            return best;
        }
        /// 하루마다 한 줄 (하네스 BAL_TRACE)
        public static Action<string> Trace;
        /// 시작 유품 고정 (하네스 BAL_FORCE · 테스트) — 첫 상자에서 이걸 집음
        public static string ForceRelic;
        /// v4 2부(빚 1억)부터 시작 (하네스 BAL_PART2)
        public static bool Part2;
        /// 난이도 (하네스 BAL_DIFF=easy|normal|hard)
        public static string Diff = "normal";
        int traceDay, wkSeen, peekT = -1;
        readonly GameData D; readonly string strat; readonly bool heistRoute; readonly Random r; readonly double mgLo, mgHi;
        /// pro 변형 (측정용): trader = 알바 없이 칸마다 장만 봄 · proloan = 납부일에 모자라면 김사장 돈으로 메움 · proall = 전적을 안 읽고 리포트를 전부 따라 탐
        readonly bool allWatch, bridge, blind;
        GameSim G; GameState S => G.S; Rules R => D.RULES;
        string wantLoc, wantAct; double repayAmt;
        int lastSickT = -1; bool seeded; int bullLoan; int loanT = -1, lottoT = -1, casinoT = -1;
        readonly HashSet<int> tipDone = new HashSet<int>();
        /// v4 속보 매매: 칸 시작 속보 보고 산 종목 → 산 칸 번호 (그 칸 끝나기 전엔 안 팖). 가짜인지는 봇도 모름
        readonly Dictionary<string, int> newsPos = new Dictionary<string, int>(); readonly Dictionary<string, double> newsPx = new Dictionary<string, double>(); int newsT = -1;
        /// 국면 읽기 (pro): 이번 장에 본 속보 방향(좋은/전체) + 장 시작 뒤 시세 흐름. 국면 이름은 화면에 안 나오니 플레이어가 볼 수 있는 것만으로
        const int MN = 3; const double UP = 0.7;   // 국면 판단: 속보 MN개 이상 보고 좋은 뉴스 비율 UP 이상(이하) + 시세 같은 방향
        int obsCh = -1, obsUp, obsN, obsT = -1, rideDir; double obsP0, obsC0;
        readonly Result res;

        RtBots(GameData d, int seed, string strat, double mgLo, double mgHi)
        {
            heistRoute = strat.EndsWith("+heist"); if (heistRoute) strat = strat.Substring(0, strat.Length - 6);   // "pro+heist" = pro 인데 털기 루트를 끝까지 탐
            string name = strat;
            allWatch = strat == "trader"; blind = strat == "proall"; if (allWatch || blind || strat == "proloan") strat = "pro";
            D = d; this.strat = strat; r = new Random(seed * 7919 + 13); this.mgLo = mgLo; this.mgHi = mgHi;
            bridge = name == "proloan" || strat == "casual" && r.NextDouble() < 0.5;   // 보통 사람의 절반은 모자라면 빌려서 메움
            res = new Result { seed = seed, strat = name + (heistRoute ? "+heist" : "") };
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
                newsN = L.Average(x => x.newsN), newsRet = L.Sum(x => x.newsRet) / Math.Max(1, L.Sum(x => x.newsN)),
                gnet = L.Average(x => x.gnet), invest = L.Average(x => x.invest), errs = L.Average(x => x.errs),
                faints = L.Average(x => x.faints), menheras = L.Average(x => x.menheras), sickDays = L.Average(x => x.sickDays),
                ends = L.Where(x => x.end != "none").GroupBy(x => x.end + (x.variant != "" ? "/" + x.variant : "")).ToDictionary(g => g.Key, g => (double)g.Count() / L.Count),
                heist = new[] { L.Average(x => x.heistMax >= 1 ? 1.0 : 0), L.Average(x => x.heistMax >= 2 ? 1.0 : 0), L.Average(x => x.heistMax >= 3 ? 1.0 : 0), L.Average(x => x.heistGo ? 1.0 : 0) },
                asset7 = Med(L.Where(x => x.asset7 >= 0).Select(x => x.asset7)), asset14 = Med(L.Where(x => x.asset14 >= 0).Select(x => x.asset14)), firstRepay = Med(L.Where(x => x.firstRepay > 0).Select(x => (double)x.firstRepay)),
                workHeld = L.Average(x => x.workHeld), early = L.Average(x => x.end != "clear" && x.end != "none" && x.day < data.RULES.V4_DAYS ? 1.0 : 0),
                noLoanClear = cl.Count > 0 ? cl.Average(x => x.borrowed <= 0 ? 1.0 : 0) : 0, gatePass = L.Average(x => x.gatePass), gateMiss = L.Average(x => x.gateMiss),
                sellMed = Med(L.SelectMany(x => x.sellRets)),
                debtQ = new[] { 0.1, 0.25, 0.5, 0.75, 0.9 }.Select(q => { var a = L.Select(x => x.end == "clear" ? 0 : x.debt).OrderBy(x => x).ToList(); return a[Math.Min(a.Count - 1, (int)(q * a.Count))]; }).ToArray(),
                wkAlive = Enumerable.Range(0, 5).Select(w => w == 0 ? 0 : L.Average(x => x.day > (w - 1) * 7 ? 1.0 : 0)).ToArray(),
                wkBank = Enumerable.Range(0, 5).Select(w => w == 0 ? 0 : Avg(L.Where(x => x.day > (w - 1) * 7).Select(x => x.wkBank[w]))).ToArray(),
                wkPnl = Enumerable.Range(0, 5).Select(w => w == 0 ? 0 : Avg(L.Where(x => x.day > (w - 1) * 7).Select(x => x.wkReal[w] - x.wkReal[w - 1]))).ToArray(),
                wkOpens = Enumerable.Range(0, 5).Select(w => w == 0 ? 0 : Avg(L.Where(x => x.day > (w - 1) * 7).Select(x => (double)x.wkOpens[w]))).ToArray(),
                wkMargin = Enumerable.Range(0, 5).Select(w => w == 0 ? 0 : L.Where(x => x.day > (w - 1) * 7).Sum(x => x.wkMargin[w]) / Math.Max(1, L.Where(x => x.day > (w - 1) * 7).Sum(x => (double)x.wkOpens[w]))).ToArray(),
                tips = L.Average(x => (double)(x.tipFollow + x.tipFade + x.tipSkip)), tipFollow = Share(L, x => x.tipFollow), tipFade = Share(L, x => x.tipFade), tipSkip = Share(L, x => x.tipSkip),
                paidRep = L.Average(x => (double)x.paidRep), tipRet = L.Sum(x => x.tipRetSum) / Math.Max(1, L.Sum(x => x.tipRetN)), borrowed = L.Average(x => x.borrowed),
                missRuns = L.Average(x => x.missEarly ? 1.0 : 0), missRecover = L.Any(x => x.missEarly) ? L.Where(x => x.missEarly).Average(x => x.end == "clear" || x.day >= data.RULES.V4_DAYS ? 1.0 : 0) : 0,
                pnl = L.SelectMany(x => x.pnl.Keys).Distinct().ToDictionary(k => k, k => L.Average(x => x.pnl.TryGetValue(k, out var v) ? v : 0)),
                pnlN = L.SelectMany(x => x.pnl.Keys).Distinct().ToDictionary(k => k, k => L.Average(x => x.pnlN.TryGetValue(k, out var v) ? (double)v : 0)),
                alerts = L.Average(x => x.alerts), alertRuns = L.Average(x => x.alerts > 0 ? 1.0 : 0), peekRate = L.Sum(x => x.peeks) / Math.Max(1.0, L.Sum(x => x.alerts)), liqWork = L.Average(x => x.liqWork),
                aff = L.Average(x => x.aff), greed = L.Average(x => x.greed), promRate = L.Sum(x => x.promOk) / Math.Max(1, L.Sum(x => x.promN)),
                acts = L.SelectMany(x => x.acts.Keys).Distinct().ToDictionary(k => k, k => L.Average(x => { double n = x.acts.Values.Sum(); return n > 0 && x.acts.TryGetValue(k, out var v) ? v / n : 0; })),
            };
        }

        static double Share(List<Result> L, Func<Result, int> f) => L.Sum(x => (double)f(x)) / Math.Max(1, L.Sum(x => (double)(x.tipFollow + x.tipFade + x.tipSkip)));
        static double Avg(IEnumerable<double> xs) { var a = xs.ToList(); return a.Count == 0 ? 0 : a.Average(); }
        static double Med(IEnumerable<double> xs) { var a = xs.OrderBy(x => x).ToList(); return a.Count == 0 ? 0 : a[a.Count / 2]; }
        /// 클리어 일수 분위 (못 깬 판 = 무한대 → 999)
        static double Pct(List<Result> L, double q) { var d = L.Select(x => x.end == "clear" ? x.day : 999).OrderBy(x => x).ToList(); return d[Math.Min(d.Count - 1, (int)(q * d.Count))]; }

        static SimCommand C(string t, params object[] kv) => new SimCommand(t, kv);

        Result Play(int maxDays)
        {
            G = GameSim.Create(D, res.seed, new GameSim.Opts { rt = true, diff = Diff });
            Go(C("start"));
            if (Part2 && G.v4) { S.part = 2; S.debt = R.V4_PART2_DEBT; S.st.maxDebt = S.st.minDebt = S.debt; G.p2Seed(); G.Query(() => { G.anSeedPublic(); return 0; }); }   // 2부부터 바로 (밸런스 측정용): 판돈·분석가 전적도 2부 것으로
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
                if (Trace != null && G.absDay() != traceDay) { traceDay = G.absDay(); Trace($"d{traceDay} 빚 {S.debt / 1e4:F0} 현금 {S.cash / 1e4:F0} 주식 {G.stockVal() / 1e4:F0} 코인 {G.coinVal() / 1e4:F0}({S.cps.Count}개 증거금 {G.marginUsed() / 1e4:F0}) 납부 {(G.gateOn ? G.gateDue() : 0) / 1e4:F0} 단계 {S.gateTier} 미납 {S.missN} 알바누계 {S.st.earned / 1e4:F0} 실현 {S.realized / 1e4:F0} 호감 {S.aff:F0} st {S.stress:F0} 유품 {string.Join(",", S.augs)}"); }
            }
            if (S.pending != null && S.pending.t != "ending" && G.absDay() <= maxDays) { res.errs++; res.lastErr = "step cap @" + S.pending.t; }   // 6만 수 안에 70일을 못 채움 = 봇이 헛돎
            if (S.ending != null) { res.end = S.ending; res.variant = S.endInfo?.variant ?? ""; }
            if (G.v4) res.scen = string.Join(">", Enumerable.Range(1, 4).Select(c => G.regime(c)));
            res.day = G.absDay(); res.debt = S.debt; res.cash = S.cash; res.earned = S.st.earned; res.interest = S.st.interest;
            res.repaid = S.st.repaid; res.gnet = S.st.gnet; res.invest = S.realized; res.faints = (int)S.st.faint;
            res.menheras = (int)(S.st.menOk + S.st.menBad); res.relic = S.augs.FirstOrDefault(); res.aff = S.aff; res.liqWork = S.liqWork; res.borrowed = S.st.borrowed; res.greed = S.greed;
            return res;
        }
        void Go(SimCommand c)
        {
            res.steps++;
            int d0 = G.absDay(); string ps0 = G.v4 ? G.promState() : null;
            string ak = c.t == "watch" || c.t == "date" || c.t == "rest" ? c.t
                : c.t == "act" ? (c.Str("k") is string k ? (k.StartsWith("l-cafe") || k == "l-store" || k == "l-ware" || k == "l-mart" ? "work" : k == "l-oddeven" || k == "l-slot" || k == "l-card" || k == "l-ladder" ? "casino" : k == "l-lotto" || k == "l-scratch" ? "lotto" : "out:" + k.Substring(2)) : null) : null;
            if (ak != null && G.v4) res.acts[ak] = (res.acts.TryGetValue(ak, out var n0) ? n0 : 0) + 1;
            if (ak == "work" && S.cps.Any(x => !x.mirai && x.lev * x.mult >= 2)) res.workHeld++;   // 제목의 장면: 레버리지 포지션을 들고 알바 감
            if (G.v4) { int w = Math.Min(4, Math.Max(1, S.month)); if (wkSeen < w) { wkSeen = w; res.wkBank[w] = S.cash + G.holdVal(); } }
            if (res.asset7 < 0 && G.absDay() >= 7) res.asset7 = S.cash + G.holdVal();
            if (res.asset14 < 0 && G.absDay() >= 14) res.asset14 = S.cash + G.holdVal() + (S.st.repaid - S.st.borrowed);   // 14일째: 가진 것 + 그동안 갚은 원금 (순 진행)
            if (c.t == "report" && c.Truthy("paid")) res.paidRep++;
            if (c.t == "workPeek") res.peeks++;
            double cash0 = S.cash; int cps0 = S.cps.Count;
            double real0 = S.realized; var ids0 = G.v4 ? S.cps.Select(x => x.id).ToList() : null; var mg0 = G.v4 ? S.cps.ToDictionary(x => x.id, x => x.margin) : null;
            var evs = G.Apply(c);
            if (ids0 != null)
            {   // 손익 귀속: 이번 명령으로 사라진 포지션의 종류 (여럿이면 첫째 것으로)
                var gone = ids0.Where(id => S.cps.All(x => x.id != id)).ToList();
                double dR = S.realized - real0;
                string cat = gone.Count > 0 ? (rideIds.Contains(gone[0]) ? "ride" : tipPos.ContainsKey(gone[0]) ? "tip" : posCat.TryGetValue(gone[0], out var pc) ? pc : "etc") : c.t == "sell" || c.t == "buy" ? "stock" : null;
                if (cat != null && dR != 0) { res.pnl[cat] = (res.pnl.TryGetValue(cat, out var pv) ? pv : 0) + dR; if (gone.Count > 0 || c.t == "sell") res.pnlN[cat] = (res.pnlN.TryGetValue(cat, out var pn) ? pn : 0) + 1; }
                if (cat == "tip" && gone.Count == 1 && mg0[gone[0]] > 0) { res.tipRetSum += dR / mg0[gone[0]]; res.tipRetN++; }
                if (S.cps.Count > cps0 && c.t == "open") posCat[S.cps[S.cps.Count - 1].id] = nextCat ?? "etc";
                nextCat = null;
            }
            if (G.v4) { int w = Math.Min(4, Math.Max(1, wkSeen)); for (int i = w; i <= 4; i++) res.wkReal[i] = S.realized; if (c.t == "open" && S.cps.Count > cps0) { res.wkOpens[w]++; res.wkMargin[w] += S.cps[S.cps.Count - 1].margin; } }
            if (rideNext) { rideNext = false; if (S.cps.Count > cps0) rideIds.Add(S.cps[S.cps.Count - 1].id); }
            if (tipNextTr >= 0) { if (S.cps.Count > cps0) tipPos[S.cps[S.cps.Count - 1].id] = tipNextTr; tipNextTr = -1; }
            if (Trace != null && G.v4)
            {
                if (c.t == "open") Trace($"   코인 {(S.cps.Count > cps0 ? "진입" : "거절")} {c.Str("tk")} {(c.Int("dir", 0) > 0 ? "롱" : "숏")} {c.Num("lev")}배 {c.Num("amt") / 1e4:F0}만 (s{S.slot} {S.min / 60}시)");
                else if (c.t == "close" || c.t == "closeCoins" || c.t == "workPeek") Trace($"   코인 정리 {(S.cash - cash0) / 1e4:+0;-0}만 (s{S.slot} {S.min / 60}시)");
                foreach (var e in evs)
                {
                    if (e.t == "gate") Trace($"   관문 {(e["ok"] is bool b0 && b0 ? "통과" : "미납")} 빚 {S.debt / 1e4:F0} 현금 {S.cash / 1e4:F0}");
                    else if (e.t == "stop") Trace($"   예약 {e.Str("k")} {e.Str("tk")} {e.Num("pnl") / 1e4:+0;-0}만");
                    else if (e.t == "liveLiq") Trace($"   청산! (s{S.slot} {S.min / 60}시)");
                }
            }
            foreach (var e in evs)
            {
                if (e.t == "error") { res.errs++; res.lastErr = c.t + " @" + (S.pending?.t ?? "-"); }
                else if (e.t == "gate") { if (e["ok"] is bool ok && ok) res.gatePass++; else { res.gateMiss++; if (G.absDay() < R.V4_DAYS) res.missEarly = true; } }
                else if (e.t == "workAlert") res.alerts++;
            }
            if (res.firstRepay == 0 && S.st.repaid > 0) res.firstRepay = G.absDay();
            if (ps0 != null && G.absDay() != d0) { res.promN++; if (ps0 == "ok") res.promOk++; }   // 자정 넘긴 명령 직전 부탁 상태
            res.heistMax = Math.Max(res.heistMax, S.heist); res.heistGo |= S.heistGo;
        }

        /// smart0 = smart 인데 김사장 종잣돈 없이 시작 (처음 하는 사람)
        bool Smart => strat == "smart" || strat == "smart0" || strat == "pro" || strat == "casual";
        /// v4 사람 봇: pro = 잘하는 사람 (장 보며 리포트 매매 · 국면 타기 · 부탁 지킴 · 미래 챙김), casual = 보통 사람 (섞어서 · 실수 · 가끔 도박/고배율)
        bool Human => strat == "pro" || strat == "casual";
        bool Careful => strat == "work" || Smart;
        /// 이번 주 이자 (아직 안 냈으면)
        double Int => S.paidMonth == S.month ? 0 : G.interestDue();
        /// 이자일에 낼 돈: 관문 규칙이면 이자 + 원금 분납
        double Due => G.v4 && G.gateOn ? G.gateDue() : Int;
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
                case "work":
                    {
                        if (P.setup == null) return C("mgSetup");
                        int left = G.v4 ? G.slotEndMin(S.slot) - 1 - S.min : 0;
                        if (left > 0 && S.cps.Any(x => !x.mirai))
                        {   // 포지션을 들고 일하는 중: 30분씩 흘리며 지켜봄 (사람 = 미니게임 구석의 내 포지션). 손실이 깊으면 몰래 폰을 볼지 정함 (한 칸에 한 번)
                            var worst = S.cps.Where(x => !x.mirai && x.lev * x.mult >= 2).OrderByDescending(x => G.posLoss(x)).FirstOrDefault();
                            if (worst != null && G.posLoss(worst) >= R.V4_ALERT_LOSS && G.peekOk() && peekT != G.Tnow())
                            {
                                peekT = G.Tnow();
                                // pro: 발표를 기다리는 리포트 포지션은 잡음에 밀려도 안 건드림 (발표가 이미 틀렸고 남은 증거금이 크면 정리). casual 은 반반
                                bool waiting = tipPos.TryGetValue(worst.id, out var tid) && S.tips.Any(q => q.id == tid && string.IsNullOrEmpty(q.res) && q.Tr >= G.Tnow() && !(S.mplan != null && S.mplan.evs.Any(e => e.k == "report" && e.id == tid && e.done)));
                                bool peek = strat == "pro" ? !waiting && worst.margin * (1 - G.posLoss(worst)) >= 600000 : Human && r.NextDouble() < 0.5;
                                if (peek) return C("workPeek", "id", strat == "pro" ? worst.id : 0);
                            }
                            return C("workTick", "m", Math.Min(30, left));
                        }
                        return C("mgResult", "score", mgLo + r.NextDouble() * (mgHi - mgLo));
                    }
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
                case "repay": { double a = Math.Min(repayAmt, P.mx); repayAmt = 0; return C("repay", "amt", a >= S.debt ? S.debt : Math.Max(0, Math.Floor(a / 10000) * 10000)); }   // 다 갚을 땐 자투리까지
                case "brokerTrade": return C("brokerClose");
                case "watch":
                    {
                        // v4 장 보기: 매매할 게 있으면 하고, 아니면 시계를 흘림 (칸 끝나면 알아서 나감). 아침 장 열리기 전엔 9시까지
                        if (strat != "random" && G.daysLeft() <= 3 && S.hold.Count > 0 && G.stockTradeOk()) return C("sell", "tk", S.hold.Keys.First(), "frac", 1, "where", "app");   // 만기 직전 정리
                        if (G.gateOn && Human) return TradeGate() ?? C("watchEnd");
                        var t = strat == "random" ? (r.NextDouble() < 0.1 ? C("watchEnd") : null) : Trade(); if (t != null) return t;
                        if (Smart && S.debt > 0 && S.cash >= S.debt + Int) return C("watchEnd");   // 다 팔았으면 집에 가서 갚기
                        if (strat == "pro" && G.gateOn && newsPos.Any(kv => kv.Value == G.Tnow() && !PastFollow(kv.Key))) return C("tick", "m", 10);   // 속보로 들어갔으면 후속 속보가 뜰 때까지 지켜봄
                        if (strat != "random" && !(Smart && PendingBuy() != null) && (S.min >= R.RT_STOCK[0] || !Smart || G.weekend())) return C("watchEnd");
                        return C("tick", "m", Math.Max(1, Math.Min(60, G.slotEndMin(S.slot) - S.min)));
                    }
                case "loan":
                    {
                        if (G.gateOn && Human)
                        {   // 돌려막기: 모자란 만큼만 (선이자 10% 떼고 받으니 조금 넉넉히), 주당 한도 안에서
                            double lack = (Due - S.cash) / (1 - G.loanFee()) + 20000;
                            double amt = lack <= 0 ? 0 : R.LOAN_AMTS.Where(a => a <= G.loanWeekRoom() && S.debt + a <= G.loanCap()).OrderBy(a => a >= lack ? 0 : 1).ThenBy(a => a >= lack ? a : -a).FirstOrDefault();
                            return amt > 0 && G.loanOk() ? C("borrow", "amt", amt) : C("loanDone");
                        }
                        double want = strat == "pro" && bullLoan == 1 ? (G.loanCap() - S.debt >= 3000000 && P.took < 9000000 ? 3000000 : 0) : strat == "casual" ? (P.took == 0 ? 1000000 : 0) : Smart ? (P.took == 0 ? 3000000 : P.took < 6000000 ? 1000000 : 0)
                            : strat == "gamble" ? R.LOAN_AMTS.Reverse().FirstOrDefault(a => S.debt + a <= G.loanCap() && S.cash < 3000000)
                            : P.took == 0 ? R.LOAN_AMTS[r.Next(R.LOAN_AMTS.Length)] : 0;
                        return want > 0 && S.debt + want <= G.loanCap() && G.loanOk() && want <= G.loanWeekRoom() ? C("borrow", "amt", want) : C("loanDone");
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
                        if (P.stage == "gate")
                        {   // 원금 분납: 낼 수 있으면 냄. 모자라면 — 이번이 마지막 기회(연속 미납 직전·만기)면 급매해서라도, 아니면 가진 만큼만
                            bool can(string k0) => P.opts.Any(o => o.k == k0 && !o.dis);
                            if (can("gatePay")) return C("payday", "k", "gatePay");
                            bool must = S.missN + 1 >= R.V4_MISS_MAX || G.daysLeft() <= 0;
                            if (can("gateSell") && (must || strat == "random" && r.NextDouble() < 0.5)) return C("payday", "k", "gateSell");
                            return C("payday", "k", can("gatePart") ? "gatePart" : "gateSkip");
                        }
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
            if ((strat == "smart" || strat == "pro") && !seeded && G.loanOk() && !G.gateOn) { seeded = true; return C("loanOpen"); }   // v4: 종잣돈 대출은 신용 1단계(첫 이자) 뒤에
            // 잘하는 사람: 2장 불장 들어가면 김사장 돈 더 땡겨서 탐 (빚 내서 빚 갚기)
            if (strat == "pro" && G.v4 && !G.gateOn && Mood() >= 0 && G.chapter() <= 3 && G.loanOk() && bullLoan == 0) { bullLoan = 1; return C("loanOpen"); }   // 관문 규칙: 빌린 돈은 그 주에 갚아야 해서 종잣돈 대출은 안 함
            if (G.v4 && G.gateOn && Human)
            {   // 관문 규칙의 사람 봇 (docs/BLUEPRINT.md): 아침에 장 보며 잡고 예약 걸고 → 낮엔 알바 → 밤엔 미래. 주말엔 납부 준비
                var tg = TradeHomeGate(); if (tg != null) return tg;
                if (S.debt > 0 && S.cash >= S.debt + Int) { repayAmt = S.debt; return C("repayOpen"); }
                // 납부일 저녁인데 다 정리해도 모자람 → 김사장 돈으로 메움 (이번 주에 빌린 돈은 다음 주 몫. 만기 주엔 소용없음)
                if (bridge && DaysToPay == 0 && S.slot == R.SLOTS - 1 && G.daysLeft() > 0 && G.loanOk() && S.cash < Due && S.cash + G.holdVal() * 0.8 < Due && loanT != G.Tnow()
                    && R.LOAN_AMTS.Any(a => a <= G.loanWeekRoom() && S.debt + a <= G.loanCap())) { loanT = G.Tnow(); return C("loanOpen"); }
                return HomeGate(S.slot == R.SLOTS - 1, G.promNow());
            }
            var t = Trade(); if (t != null) return t;
            // 상환: smart 는 다 갚을 수 있을 때 한 번에 (밑천 굴림), 나머지는 이자 낼 돈만 남기고 수시로
            double eq = S.cash + G.holdVal();
            if (Smart && S.debt > 0 && eq >= S.debt + Int)
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
                if (S.debt > 0 && S.cash >= S.debt + Int) { repayAmt = S.debt; return C("repayOpen"); }
                if (S.cash < 3000000 && S.debt + R.LOAN_AMTS[0] <= G.loanCap() && G.loanOk() && loanT != G.Tnow()) { loanT = G.Tnow(); return C("loanOpen"); }
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
            if (G.gateOn && Careful && DaysToPay == 0 && S.cash < Due * 1.02 && S.cps.Any(c => !c.mirai)) return C("closeCoins");   // 납부일: 현금이 모자라면 코인부터 정리 (급매 손해 없음)
            var pr = G.promNow(); bool careful = Careful;
            if (Human) return HomeHuman(eve, pr);
            if (S.hp < 32) return C("rest");
            if (careful && pr != null && pr.@do == "date" && !S.promDone && (eve || S.stress >= 50)) return C("date");
            if (S.stress >= 58) return careful || r.NextDouble() < 0.5 ? C("date") : C("rest");
            if (strat == "gamble")
            {
                if (S.debt > 0 && S.cash >= S.debt + Int) { repayAmt = S.debt; return C("repayOpen"); }
                if (S.cash < 3000000 && S.debt + R.LOAN_AMTS[0] <= G.loanCap() && G.loanOk() && loanT != G.Tnow()) { loanT = G.Tnow(); return C("loanOpen"); }
                if (S.cash < 100000 && S.hp >= 45) return Go("work", "l-cafe");
                if (S.slot >= 1 && S.cash >= 10000) return Go("casino", new[] { "l-oddeven", "l-slot" }[r.Next(2)]);
                if (S.cash >= 10000) return Go("lotto", "l-lotto");
            }
            if (Smart && S.slot <= 1 && !G.weekend() && (DaysToPay <= 2 && S.cash < Due * 1.05 && S.hold.Count > 0 || PendingBuy() != null || S.hold.Count > 0 || S.slot == 0 && G.rsch().free < G.freeMax())) return C("watch");
            if (eve) return careful && S.aff < (strat == "work" ? 55 : 70) ? C("date") : C("rest");   // work = 알바만 하는 사람: 미래는 호감 55 밑으로 떨어질 때만 챙김
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
            if (S.news != null && S.news.dir > 0 && D.TK.TryGetValue(S.news.tk, out var ntk) && !ntk.inv && (ntk.IsCoin || stockSlot) && (pro ? Mood() >= 0 : r.NextDouble() < 0.5) && S.cash >= 400000) return C("watch");
            if (stockSlot && (DaysToPay <= 2 && S.cash < Due * 1.05 && S.hold.Count > 0 || PendingBuy() != null || S.hold.Count > 0 || (pro && RideWanted()) || S.slot == 0 && G.rsch().free < G.freeMax())) return C("watch");
            if (eve)
            {
                if (S.aff < (heistRoute && S.heist > 0 ? 80 : pro ? 70 : 65)) return C("date");   // 호감은 엔딩 문턱(60)보다 조금 위로만 — 남는 밤은 야간 알바 (털기 루트면 미래가 믿고 따라오게 80)
                if (pro && S.cash + G.holdVal() >= 10000000 && G.daysLeft() > 3) return C("rest");   // 밤에 푹 자면 다음 장날 무료 리포트 +1 (굴릴 돈이 1천만↑면 야간 알바만큼 값어치)
                return S.hp >= 55 ? Go("work", "l-cafe") : C("rest");
            }
            if (G.weekend() && S.aff < 70 && S.dateN == 0) return C("date");
            return S.hp >= 40 ? Go("work", "l-cafe") : C("rest");
        }
        /// 국면 읽기: 장이 바뀌면 처음부터. 칸마다 속보 방향을 세고(가짜도 섞여 있지만 방향 비율은 국면을 따름), 대형주·대장코인 흐름을 봄
        void Observe()
        {
            int ch = G.chapter();
            if (ch != obsCh) { obsCh = ch; obsUp = obsN = 0; rideDir = 0; obsP0 = S.mk.tk["GSE"].p; obsC0 = S.mk.tk["BTK"].p; }
            if (S.news != null && obsT != G.Tnow()) { obsT = G.Tnow(); obsN++; if (S.news.dir > 0) obsUp++; }
        }
        /// 지금 장 분위기: +1 오르는 장 · −1 내리는 장 · 0 모름/횡보. 한 번 정하면 반대 신호가 확실할 때만 바꿈
        int Mood()
        {
            Observe();
            double u = (obsUp + 1.0) / (obsN + 2.0), tr = Math.Log(S.mk.tk["GSE"].p / obsP0) + 0.5 * Math.Log(S.mk.tk["BTK"].p / obsC0);
            if (obsN >= MN && u >= UP && tr > 0 && rideDir <= 0) rideDir = 1;                        // 좋은 속보가 확실히 많고 시세도 오름 = 불장
            else if ((obsN >= MN && u <= 1 - UP && tr < 0 || G.gateOn && tr < -0.10) && rideDir >= 0) rideDir = -1;   // 나쁜 속보가 확실히 많고 시세도 내림 = 폭락 (관문 규칙: 대형주·대장코인이 10% 넘게 빠져도)
            else if (G.gateOn && rideDir < 0 && tr > 0.04 && u >= 0.5) rideDir = 0;                 // 폭락인 줄 알았는데 다시 오름 → 판단 보류
            return rideDir;
        }
        /// 국면 타기 (잘하는 사람): 오르는 장 = 대장코인 2배 롱 · 내리는 장 = 곱버스(숏 열렸으면). 장이 바뀌면 다시 읽음
        string RideTk()
        {
            if (!G.v4 || G.daysLeft() <= 3) return null;
            int m = Mood();
            if (m > 0 || m == 0 && G.gateOn) return "BTK";   // 관문 규칙: 폭락만 아니면 대장코인 롱이 기본 (잡고 알바 가는 포지션)
            if (m < 0) return G.shortOk() ? D.TKList.FirstOrDefault(t => t.inv && G.tkOpen(t.id))?.id : null;   // 숏 잠겼으면 곱버스 못 삼
            return null;
        }
        /// 여윳돈: 관문 규칙이면 주 초엔 다 굴리고 금요일부터 납부금을 남김
        double Spare => Math.Floor((S.cash - (G.gateOn ? (DaysToPay <= 2 ? Due * 1.05 : 0) + 100000 : Due * 1.05 + 300000)) / 1000) * 1000;
        /// 국면 타기는 여윳돈 절반만 (나머지는 리포트 매매 몫)
        double RideAmt => Math.Floor(Spare * (G.gateOn ? 0.8 : 0.5) / 1000) * 1000;
        bool RideWanted() => RideTk() is string k && (D.TK[k].IsCoin ? !S.cps.Any(c => c.tk == k) : !S.hold.Has(k)) && Spare >= (G.gateOn ? 150000 : 500000) && !(G.gateOn && DaysToPay == 0);
        // ---------- 관문 규칙의 사람 봇 (pro · casual) ----------
        /// 집: 칸 고르기. 평일 오전 = 장 보기 한 번(리포트·주문·예약), 낮 = 알바(포지션은 들고), 밤 = 미래 또는 야간 알바
        SimCommand HomeGate(bool eve, GameSim.Prom pr)
        {
            bool pro = strat == "pro"; bool keep = pro || r.NextDouble() < 0.6;
            if (S.hp < 30) return C("rest");
            if (!pro && r.NextDouble() < 0.25)
            {   // casual: 가끔 엉뚱한 선택
                double x = r.NextDouble();
                if (x < 0.25 && S.cash >= 50000 && S.slot >= 1 && !(keep && pr?.avoid == "gamble")) return Go("casino", r.NextDouble() < 0.5 ? "l-oddeven" : "l-slot");
                if (x < 0.4 && S.cash >= 20000) return Go("lotto", "l-lotto");
                if (x < 0.6) return Go("park", "l-walk");
                if (x < 0.8) return C("watch");
                return C("rest");
            }
            if (heistRoute && S.heist > 0 && S.greed < R.V4_GREED_HEIST + 5 && S.slot >= 1 && S.cash >= 100000 && pr?.avoid != "gamble") return Go("casino", "l-oddeven");
            if (keep && pr != null && !S.promDone)
            {
                if (pr.@do == "date" && (eve || G.weekend() || S.stress >= 50)) return C("date");
                if (pr.@do == "datenight" && eve) return C("date");
            }
            if (S.stress >= 60) return S.dateN == 0 && S.aff < 85 ? C("date") : C("rest");
            bool stockSlot = S.slot <= 1 && !G.weekend();
            if (allWatch) return eve && S.aff < 70 ? C("date") : C("watch");                                                           // trader: 알바 없이 칸마다 장만 봄
            if (S.slot == 0 && (pro || r.NextDouble() < (stockSlot ? 0.85 : 0.5))) return C("watch");                                  // 아침 장 보기 (주말엔 코인 리포트)
            if (stockSlot && S.slot == 1 && DaysToPay <= 2 && S.cash < Due * 1.05 && S.hold.Count > 0) return C("watch");               // 금요일 오후: 납부금 모자라면 주식 정리
            if (stockSlot && S.slot == 1 && S.debt > 0 && S.hold.Count > 0 && S.cash + G.holdVal() >= S.debt + Int) return C("watch");  // 다 갚을 수 있으면 팔러 감
            // 장 닫힌 시간(밤·주말)의 코인 속보: pro 는 잠깐 보고 잡음
            // (예전엔 밤·주말 코인 속보마다 장을 보러 갔는데, 속보 한 건의 기대값이 알바 한 칸보다 작아서 뺌 — 장 보기는 아침 한 번)
            if (eve)
            {
                if (S.aff < (heistRoute && S.heist > 0 ? 80 : pro ? 70 : 65)) return C("date");
                return S.hp >= 55 ? Work() : C("rest");
            }
            return S.hp >= 40 ? Work() : C("rest");
        }
        /// 알바 고르기: pro 는 체력이 되는 한 많이 주는 것 (상하차 ×1.4 > 마트 ×1.2 > 카페), casual 은 섞어서
        SimCommand Work()
        {
            double x = strat == "pro" ? 0 : r.NextDouble();
            if (G.hpOff)
            {   // 체력 삭제 뒤: 알바 차이 = 일당 대 스트레스. 스트레스 여유가 있으면 많이 주는 것
                double room = 55 - S.stress; bool held = strat == "pro" && S.cps.Any(c => !c.mirai && c.lev * c.mult >= 2);
                bool ok(string id) => G.workStress(D.JOBS[id], S.workStreak + 1) <= room && !(held && G.peekRisk(id) >= 1);
                return Go("work", x < 0.3 && ok("ware") ? "l-ware" : x < 0.6 && ok("mart") ? "l-mart" : x < 0.8 ? "l-cafe" : "l-store");
            }
            return Go("work", S.hp >= 80 && x < 0.3 ? "l-ware" : S.hp >= 62 && x < 0.6 ? "l-mart" : x < 0.8 ? "l-cafe" : "l-store");
        }
        /// 집에서 폰으로 하는 일: 납부일 현금 모자라면 코인 정리 · 지난 속보 포지션 정리 · (pro) 폭락인데 롱을 들고 있으면 정리
        SimCommand TradeHomeGate()
        {
            if (DaysToPay == 0 && S.slot >= 1 && S.cash < Due * 1.02 && S.cps.Any(c => !c.mirai)) return C("closeCoins");
            foreach (var kv in newsPos.ToList())
                if (kv.Value < G.Tnow())
                {
                    newsPos.Remove(kv.Key);
                    if (newsPx.TryGetValue(kv.Key, out var px0)) { newsPx.Remove(kv.Key); res.newsN++; res.newsRet += Math.Max(-1, Math.Min(1, S.mk.tk[kv.Key].p / px0 - 1)); }
                    var c0 = S.cps.FirstOrDefault(c => c.tk == kv.Key && !c.mirai && !rideIds.Contains(c.id)); if (c0 != null) return C("close", "id", c0.id);
                }
            foreach (var kv in tipPos.ToList())
            {   // 리포트 보고 잡은 코인: 결과 칸이 지나면 정리
                var tc = S.cps.FirstOrDefault(c => c.id == kv.Key);
                if (tc == null) { tipPos.Remove(kv.Key); continue; }
                var tq = S.tips.FirstOrDefault(q => q.id == kv.Value);
                if (tq == null || !string.IsNullOrEmpty(tq.res)) { tipPos.Remove(kv.Key); return C("close", "id", tc.id); }
            }
            if (strat == "pro") { var rc = S.cps.FirstOrDefault(c => rideIds.Contains(c.id)); if (rc != null && RideDir() != rc.dir) { rideIds.Remove(rc.id); return C("close", "id", rc.id); } }
            if (strat == "casual") foreach (var c in S.cps.ToList()) if (!c.mirai && !tipPos.ContainsKey(c.id) && c.t0 < G.Tnow() - 2) return C("close", "id", c.id);
            return null;
        }
        readonly HashSet<int> rideIds = new HashSet<int>();
        /// 코인 리포트로 잡은 포지션 id → 그 리포트 id (결과가 발표되면 정리)
        readonly Dictionary<int, int> tipPos = new Dictionary<int, int>(); int tipNextTr = -1;
        /// 탈 방향 (pro): 폭락만 아니면 대장코인 롱, 폭락이면 숏(열렸으면) 아니면 쉼. 납부일엔 새로 안 탐
        int RideDir() { int m = Mood(); return m < 0 ? (G.shortOk() ? -1 : 0) : 1; }
        /// 장 보기 칸 안에서 하는 일 (한 번에 명령 하나, 더 없으면 null → 그만 보기)
        SimCommand TradeGate()
        {
            bool pro = strat == "pro", open = G.stockTradeOk();
            var th = TradeHomeGate(); if (th != null) return th;
            // 다 갚을 수 있으면 전부 정리
            if (S.debt > 0 && S.cash + G.holdVal() >= S.debt + Int && S.cash < S.debt + Int)
            {
                if (S.cps.Count > 0) return C("closeCoins");
                if (open && S.hold.Count > 0) return C("sell", "tk", S.hold.Keys.First(), "frac", 1, "where", "app");
            }
            // 후속 속보가 오보라고 하면 pro 는 바로 정리
            if (pro && S.mplan != null)
                foreach (var e in S.mplan.evs)
                    if (e.done && e.k == "follow" && !e.ok && newsPos.TryGetValue(e.tk, out var eT) && eT == G.Tnow() && evDone.Add(G.Tnow() + ":" + e.tk))
                    {
                        var cf = S.cps.FirstOrDefault(c => c.tk == e.tk && !c.mirai); if (cf != null) return C("close", "id", cf.id);
                        if (open && S.hold.Has(e.tk)) return C("sell", "tk", e.tk, "frac", 1, "where", "app");
                    }
            var rs = G.rsch();
            if (rs.free < G.freeMax()) return C("report", "paid", false);
            foreach (var x in G.activeTips()) if (G.srcOf(x).an && tipNoted.Add(x.id)) { int st = Stance(x); if (st > 0) res.tipFollow++; else if (st < 0) res.tipFade++; else res.tipSkip++; }
            // 금요일부터: 납부금이 이미 있으면 그건 안 건드리고 남는 돈만 굴림. 모자라면 가만있어 봐야 미납이니 계속 굴림 (pro). casual 은 겁나서 멈춤
            double reserve = DaysToPay <= 2 && (!pro || S.cash >= Due * 1.05) ? Due * 1.05 : 0, free = S.cash - reserve - 50000;
            if (open)
            {
                // 주식 팔기: 결과 나온 것 · (pro) 내린다는 리포트가 붙은 것
                foreach (var k in S.hold.Keys.ToList())
                {
                    if (newsPos.TryGetValue(k, out var nT) && nT == G.Tnow()) continue;
                    bool up = G.activeTips(k).Any(x => Eff(x) > 0), down = G.activeTips(k).Any(x => Eff(x) < 0);
                    if (up && !(pro && down)) continue;
                    var h = S.hold.Get(k); double ret = h.q * S.mk.tk[k].p / h.cost - 1; res.sells++; res.sellRet += ret; res.sellRets.Add(ret);
                    Trace?.Invoke($"   매도 {k} {ret:P1} (산 칸 {h.t0}, 지금 {G.Tnow()})");
                    return C("sell", "tk", k, "frac", 1, "where", "app");
                }
                // 금요일: 납부금이 모자라면 주식부터 (주말엔 못 팔고, 이자일 급매는 20% 손해)
                if (DaysToPay <= 2 && S.cash < Due * 1.05 && S.hold.Count > 0)
                {
                    var k0 = S.hold.Keys.OrderByDescending(k => S.hold.Get(k).q * S.mk.tk[k].p).First();
                    double need = Due * 1.05 - S.cash, v = S.hold.Get(k0).q * S.mk.tk[k0].p;
                    return C("sell", "tk", k0, "frac", Math.Min(1, Math.Ceiling(need / Math.Max(1, v) * 20) / 20 + 0.05), "where", "app");
                }
            }
            // 코인 리포트: 결과가 1~2칸 뒤 → 지금 잡고 예약 걸어 두고 자리를 비움 (제목의 장면). pro 는 전적을 보고 따라 타거나 거꾸로 탐 (숏은 열렸을 때만) + 예약 손절. casual 은 오른다는 것만 예약 없이
            var ctip = G.activeTips().FirstOrDefault(x => Stance(x) != 0 && D.TK[x.tk].IsCoin && x.Tr >= G.Tnow() && !tipDone.Contains(x.id));
            if (ctip != null)
            {
                tipDone.Add(ctip.id); int ed = Eff(ctip);
                bool takeC = pro ? ed > 0 || G.shortOk() : r.NextDouble() < (ed > 0 ? 0.85 : G.shortOk() ? 0.5 : 0);   // casual: 내린다는 리포트엔 반쯤만 숏
                // 한 건에 굴릴 돈(현금 + 걸어 둔 증거금)의 PlayFrac 만큼 — 리포트가 둘이면 둘 다 탈 수 있게 (남은 현금 안에서)
                double ac = Room(Math.Floor(Math.Min(Math.Max(0, free), (S.cash + G.marginUsed()) * (pro ? PlayFrac : 0.4)) / 1000) * 1000);
                if (takeC && ac >= 100000 && !S.cps.Any(c => c.tk == ctip.tk && !c.mirai && !rideIds.Contains(c.id)))
                {
                    tipNextTr = ctip.id; nextCat = "tip";
                    Trace?.Invoke($"   리포트 매매 {ctip.who} 진짜적중률 {G.anAcc(ctip.who):F2} 전적 {G.srcRec(ctip.who)} 태도 {Stance(ctip)} 종류 {ctip.kind} 기한 +{ctip.Td - G.Tnow()} 증거금 {ac / 1e4:F0}만");
                    // pro: 사나운 코인일수록 배율을 낮춤 (발표 폭도 잡음도 변동성만큼 큼). casual 은 늘 같은 배율
                    double plev = Math.Max(1, Math.Min(D.TK[ctip.tk].maxLev, Math.Round(PlayLev * R.V4_AN_VOL0 / Math.Max(R.V4_AN_VOL0, D.TK[ctip.tk].vol))));
                    return pro ? C("open", "tk", ctip.tk, "dir", ed, "lev", plev, "amt", ac, "sl", PlaySl) : C("open", "tk", ctip.tk, "dir", ed, "lev", Math.Min(D.TK[ctip.tk].maxLev, CasualLev), "amt", ac);   // casual: 예약 없이
                }
            }
            // 탈 것 (pro): 폭락만 아니면 대장코인 롱을 기본으로 깔고 감 (제목의 포지션). 장 보기 칸에서만 잡음 = 예약 손절을 걸 수 있어서. 납부일엔 새로 안 잡음
            if (pro && DaysToPay > 0 && !S.cps.Any(c => rideIds.Contains(c.id)))
            {
                rideIds.Clear(); int rd = RideDir(); double a = Room(Math.Floor(Math.Max(0, free) * RideFrac / 1000) * 1000);
                if (rd != 0 && a >= 100000 && !S.cps.Any(c => c.tk == "BTK" && !c.mirai))
                {
                    rideNext = true;
                    return C("open", "tk", "BTK", "dir", rd, "lev", RideLev, "amt", a, "sl", RideSl);
                }
            }
            // 속보 매매: 좋은 속보(숏이 열렸으면 나쁜 코인 속보도)에 들어감. pro 는 코인에 레버리지 + 예약 손절
            if (newsT != G.Tnow() && S.news != null && D.TK.TryGetValue(S.news.tk, out var nt) && G.tkOpen(nt.id) && !nt.inv && !nt.meme)
            {
                newsT = G.Tnow(); int nd = S.news.dir;
                bool take = pro ? (nd > 0 ? Mood() >= 0 : nt.IsCoin && G.shortOk()) : nd > 0 && r.NextDouble() < 0.5;
                if (take)
                {
                    double amt = Math.Floor(Math.Max(0, free) * 0.6 / 1000) * 1000;
                    if (nt.IsCoin)
                    {
                        amt = Room(pro ? Math.Floor(Math.Max(0, free) * PlayFrac / 1000) * 1000 : amt);
                        double nlev = pro ? Math.Min(nt.maxLev, nt.vol <= 0.04 ? PlayLev : PlayLev - 1) : 1;
                        if (amt >= 100000 && !S.cps.Any(c => c.tk == nt.id && !rideIds.Contains(c.id))) { newsPos[nt.id] = G.Tnow(); newsPx[nt.id] = S.mk.tk[nt.id].p; nextCat = "news"; return pro ? C("open", "tk", nt.id, "dir", nd, "lev", nlev, "amt", amt, "sl", 0.5) : C("open", "tk", nt.id, "dir", 1, "lev", 1, "amt", amt); }
                    }
                    else if (nd > 0 && amt >= 100000 && open) { newsPos[nt.id] = G.Tnow(); newsPx[nt.id] = S.mk.tk[nt.id].p; return C("buy", "tk", nt.id, "amt", amt, "where", "app"); }
                }
            }
            // 리포트 매수: 오른다는 리포트 종목 (여럿이면 나눠서)
            var tip = PendingBuy();
            if (tip != null && open)
            {
                tipDone.Add(tip.id);
                int more = G.activeTips().Count(x => Eff(x) > 0 && !D.TK[x.tk].IsCoin && x.Tr >= G.Tnow() && !tipDone.Contains(x.id));
                double amt = Math.Floor(free * (pro ? 0.9 : 0.6) / (1 + more) / 1000) * 1000;
                Trace?.Invoke($"   매수 {tip.tk} {amt / 1e4:F0}만 (현금 {S.cash / 1e4:F0})");
                if (amt >= 50000) return C("buy", "tk", tip.tk, "amt", amt, "where", "app");
            }
            if (tip != null && !open && !G.weekend() && S.slot == 0 && S.min < R.RT_STOCK[0]) return C("tick", "m", R.RT_STOCK[0] - S.min);   // 장 열릴 때까지
            // casual: 가끔 10배 한 방 (예약 없이)
            if (!pro && S.cps.Count == 0 && S.cash >= 300000 && r.NextDouble() < 0.15 && !(G.promNow()?.avoid == "coin" && r.NextDouble() < 0.6))
            {
                var cs = D.TKList.Where(x => x.IsCoin && G.tkOpen(x.id) && !x.inv).ToList(); var tk = cs[r.Next(cs.Count)];
                double a10 = Room(Math.Floor(S.cash * 0.2 / 1000) * 1000);
                if (a10 >= 10000) { nextCat = "punt"; return C("open", "tk", tk.id, "dir", 1, "lev", Math.Min(10, tk.maxLev), "amt", a10); }
            }
            // 유료 리포트 (pro): 할 일을 다 했는데 걸 돈이 남았고 전적이 뚜렷한 분석가가 있으면 골라서 물어봄 → 다음 판단에서 그 리포트로 매매
            if (pro && !blind && rs.paid < R.RSCH_PAID_MAX && free >= R.RT_RSCH_FEE + 200000 && (G.marginRoom() >= 200000 || open && free >= 500000) && BestAnalyst() is string ba)
                return C("report", "paid", true, "who", ba);
            if (pro && newsPos.Any(kv => kv.Value == G.Tnow() && !PastFollow(kv.Key))) return C("tick", "m", 10);   // 후속 속보가 뜰 때까지 지켜봄
            return null;
        }
        bool rideNext; string nextCat; readonly Dictionary<int, string> posCat = new Dictionary<int, string>();
        /// pro 의 기본 포지션: 배율 · 예약 손절(증거금 대비) · 여윳돈 중 비중 (하네스 BAL_RIDE="배율,손절,비중" 으로 실험)
        public static double RideLev = 3, RideSl = 0.5, RideFrac = 0;   // 기본 포지션은 끔 (정보 매매가 증거금을 다 씀). BAL_RIDE 로 실험만
        /// pro 의 정보 매매(코인 리포트·속보): 배율 · 여윳돈 중 비중
        public static double PlayLev = 5, PlayFrac = 0.5;
        /// 리포트 매매의 예약 손절 (증거금 대비, 0 = 안 검). 발표는 갭이라 손절이 못 피하고 그 전 잡음에만 걸려서 pro 는 안 검
        public static double PlaySl = 0;
        /// casual 이 코인 리포트에 거는 배율 (예약 없이 — 보통 사람은 배율부터 올림). 하네스 BAL_CASUAL
        public static double CasualLev = 5;
        readonly HashSet<string> evDone = new HashSet<string>();
        /// 이 종목 장 시간의 40% 를 지났나 (후속 속보는 35% 지점에 뜸 — 사람이 그때까지 지켜보는 것)
        bool PastFollow(string tk)
        {
            int a = G.slotStartMin(S.slot), b = G.slotEndMin(S.slot);
            if (D.TK[tk].IsStock) { a = Math.Max(a, R.RT_STOCK[0]); b = Math.Min(b, R.RT_STOCK[1]); }
            return b <= a || S.min >= a + 0.4 * (b - a);
        }
        /// 코인 증거금: 상한에 남은 만큼만 (관문 규칙)
        double Room(double amt) => G.v4 ? Math.Min(amt, Math.Floor(G.marginRoom() / 1000) * 1000) : amt;
        Tip PendingBuy() => G.activeTips().FirstOrDefault(x => Eff(x) > 0 && x.Tr >= G.Tnow() && !tipDone.Contains(x.id) && !(G.gateOn && D.TK[x.tk].IsCoin));
        SimCommand Go(string loc, string act) { wantLoc = loc; wantAct = act; return C("map"); }

        /// 폰 매매 (시간 안 씀). smart = 리포트 따라 주식, gamble = 고배율 코인
        SimCommand Trade()
        {
            bool open = G.stockTradeOk();
            if (Smart)
            {
                // 다 갚을 수 있으면 정리 (장 보기 중이면 여기서 팔고, 집에 가서 갚음)
                if (G.v4 && S.debt > 0 && S.cash + G.holdVal() >= S.debt + Int && S.cash < S.debt + Int)
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
                // 후속 속보가 '오보'라고 하면 pro 는 바로 정리 (이번 칸에 속보 보고 들어간 것만)
                if (strat == "pro" && G.gateOn && S.pending?.t == "watch" && S.mplan != null)
                    foreach (var e in S.mplan.evs)
                        if (e.done && e.k == "follow" && !e.ok && newsPos.TryGetValue(e.tk, out var eT) && eT == G.Tnow() && evDone.Add(G.Tnow() + ":" + e.tk))
                        {
                            var cf = S.cps.FirstOrDefault(c => c.tk == e.tk && !c.mirai); if (cf != null) return C("close", "id", cf.id);
                            if (open && S.hold.Has(e.tk)) return C("sell", "tk", e.tk, "frac", 1, "where", "app");
                        }
                if (G.v4 && S.pending?.t == "watch" && (strat == "pro" || strat == "casual") && newsT != G.Tnow() && S.news != null && S.news.dir > 0 && D.TK.TryGetValue(S.news.tk, out var nt) && G.tkOpen(nt.id) && !nt.inv)
                {
                    newsT = G.Tnow();
                    if ((strat == "pro" && Mood() >= 0) || (strat == "casual" && r.NextDouble() < 0.5))   // pro 는 내리는 장이면 좋은 속보도 거름
                    {
                        double amt = Math.Floor(Math.Max(0, S.cash - Due * (DaysToPay <= 2 ? 1.05 : 0) - 200000) * 0.6 / 1000) * 1000;
                        if (nt.IsCoin) amt = Room(amt);
                        // 관문 규칙: pro 는 코인 속보에 레버리지 (변동성 큰 코인은 낮게) + 예약 손절
                        double nlev = strat == "pro" && G.gateOn && !nt.meme ? Math.Min(nt.maxLev, nt.vol <= 0.04 ? 5 : 3) : 1;
                        if (amt >= 100000 && nt.IsCoin && !S.cps.Any(c => c.tk == nt.id)) { newsPos[nt.id] = G.Tnow(); newsPx[nt.id] = S.mk.tk[nt.id].p; return nlev > 1 ? C("open", "tk", nt.id, "dir", 1, "lev", nlev, "amt", amt, "sl", 0.5) : C("open", "tk", nt.id, "dir", 1, "lev", 1, "amt", amt); }
                        if (amt >= 100000 && nt.IsStock && open) { newsPos[nt.id] = G.Tnow(); newsPx[nt.id] = S.mk.tk[nt.id].p; return C("buy", "tk", nt.id, "amt", amt, "where", "app"); }
                    }
                }
                foreach (var kv in newsPos.ToList())
                    if (kv.Value < G.Tnow())
                    {
                        newsPos.Remove(kv.Key);
                        if (newsPx.TryGetValue(kv.Key, out var px0)) { newsPx.Remove(kv.Key); res.newsN++; res.newsRet += Math.Max(-1, Math.Min(1, S.mk.tk[kv.Key].p / px0 - 1)); }   // ±100% 로 자름 (밈코인 바닥 반등 같은 튀는 값)
                        var c0 = S.cps.FirstOrDefault(c => c.tk == kv.Key && !c.mirai && c.tk != (strat == "pro" ? RideTk() : null)); if (c0 != null) return C("close", "id", c0.id);
                    }
                // 결과 나온(또는 지난) 정보 종목은 팔기
                string ride = strat == "pro" ? RideTk() : null;
                if (strat == "pro" && G.v4)
                {
                    // 국면 바뀌면 지난 탈 것 정리 (코인 롱 · 주식)
                    foreach (var c in S.cps.ToList()) if (c.tk != ride && !newsPos.ContainsKey(c.tk)) return C("close", "id", c.id);
                    if (open) foreach (var k in S.hold.Keys.ToList()) if (k != ride && (k == "INV" || D.TK[k].beta >= 1.2) && !G.activeTips(k).Any(x => Follow(x) && x.dir > 0)) return C("sell", "tk", k, "frac", 1, "where", "app");
                    if (ride != null && D.TK[ride].IsCoin && RideWanted() && PendingBuy() == null && Room(RideAmt) >= 100000) return G.gateOn ? C("open", "tk", ride, "dir", 1, "lev", 3, "amt", Room(RideAmt), "sl", 0.5) : C("open", "tk", ride, "dir", 1, "lev", 2, "amt", Room(RideAmt));
                }
                if (ride != null && S.hold.Has(ride) && PendingBuy() != null && S.cash < 500000 && open) return C("sell", "tk", ride, "frac", 1, "where", "app");
                if (strat == "casual" && G.v4 && S.cps.Count == 0 && S.cash >= 300000 && r.NextDouble() < 0.04 && !(G.promNow()?.avoid == "coin" && r.NextDouble() < 0.6))
                {
                    var cs = D.TKList.Where(x => x.IsCoin && G.tkOpen(x.id) && !x.inv).ToList(); var tk = cs[r.Next(cs.Count)];
                    double a10 = Room(Math.Floor(S.cash * 0.2 / 1000) * 1000);
                    if (a10 >= 10000) return C("open", "tk", tk.id, "dir", 1, "lev", 10, "amt", a10);
                }
                if (strat == "casual") foreach (var c in S.cps.ToList()) if (c.t0 < G.Tnow() - 2) return C("close", "id", c.id);
                if (!open) return null;
                foreach (var k in S.hold.Keys.ToList())
                    if (k != ride && !(newsPos.TryGetValue(k, out var nT) && nT == G.Tnow()) && !G.activeTips(k).Any(x => Follow(x) && x.dir > 0))
                    {
                        var h = S.hold.Get(k); double ret = h.q * S.mk.tk[k].p / h.cost - 1; res.sells++; res.sellRet += ret; res.sellRets.Add(ret);
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
                if (ride != null && !D.TK[ride].IsCoin && RideWanted() && PendingBuy() == null) return C("buy", "tk", ride, "amt", RideAmt, "where", "app");
                return null;
            }
            if (strat == "gamble")
            {
                foreach (var c in S.cps.ToList()) if (c.t0 < G.Tnow() || r.NextDouble() < 0.3) return C("close", "id", c.id);
                if (S.cps.Count == 0 && S.cash >= 50000 && r.NextDouble() < 0.25)
                {
                    var cs = D.TKList.Where(x => x.IsCoin && G.tkOpen(x.id) && !x.inv).ToList(); var tk = cs[r.Next(cs.Count)];
                    double ag = Room(Math.Floor(S.cash * 0.25 / 1000) * 1000);
                    if (ag >= 10000) return C("open", "tk", tk.id, "dir", G.shortOk() ? r.Next(2) * 2 - 1 : 1, "lev", Math.Min(tk.maxLev >= 50 ? 50 : tk.maxLev, G.levCap()), "amt", ag);
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
            if (x < 0.8) { var cs = D.TKList.Where(t => t.IsCoin && G.tkOpen(t.id)).ToList(); var t0 = cs[r.Next(cs.Count)]; return C("open", "tk", t0.id, "dir", r.Next(2) * 2 - 1, "lev", new[] { 1, 5, 25, 50 }[r.Next(4)], "amt", Room(S.cash * 0.2)); }
            if (x < 0.85) return C("closeCoins");
            if (x < 0.88 && G.stockTradeOk()) { var h = S.hold.Keys.FirstOrDefault(); if (h != null) return C("sell", "tk", h, "frac", 1, "where", "app"); }
            if (x < 0.9 && S.cash < 100000) return C("loanOpen");
            return C("map");
        }
    }
}
