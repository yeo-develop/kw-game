using System.Collections.Generic;
using System.IO;
using System.Linq;
using KwGame.Sim;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEngine;

namespace KwGame.Tests
{
    // v4 리디자인 (docs/V4.md, GameSim.V4.cs): 하루 3칸 · 장 보기만 실시간 · 주말 휴장 · 4장 28일 · 미래 호감/부탁 · 만기 엔딩 · 2부
    public class V4Tests
    {
        static GameData _data;
        static GameData Data => _data ??= GameData.Load(Directory.GetFiles(Path.Combine(Application.dataPath, "Resources/Data"), "*.json")
            .Select(f => new KeyValuePair<string, string>(Path.GetFileName(f), File.ReadAllText(f))));
        static SimCommand C(string t, params object[] kv) => new SimCommand(t, kv);

        static List<SimEvent> Go(GameSim g, string t, params object[] kv)
        {
            var e = g.Apply(C(t, kv));
            Assert.That(e.FirstOrDefault(x => x.t == "error"), Is.Null, $"{t} @ {g.S.pending?.t}");
            return e;
        }
        /// 집이 나올 때까지 무난하게 넘김 (유품 첫째 · 이벤트 첫 선택지 · 멘헤라 착한 답장 · 이자 냄)
        static void ToHome(GameSim g)
        {
            for (int i = 0; i < 40 && g.S.pending != null && g.S.pending.t != "home" && g.S.pending.t != "ending"; i++)
            {
                var P = g.S.pending;
                switch (P.t)
                {
                    case "relic": Go(g, "pickRelic", "i", 0); break;
                    case "event": Go(g, "evPick", "k", P.opts.First(o => !o.dis).k); break;
                    case "menhera": case "impulse": Go(g, "reply", "i", P.opts.FindIndex(o => o.ok)); break;
                    case "tempt": Go(g, "tempt", "k", "no"); break;
                    case "payday": Go(g, "payday", "k", P.stage == "repay" ? "keep" : P.opts.First(o => !o.dis).k); break;
                    default: Assert.Fail("ToHome: " + P.t); break;
                }
            }
        }
        static GameSim New(int seed = 3)
        {
            var g = GameSim.Create(Data, seed, new GameSim.Opts { rt = true });
            Go(g, "start"); ToHome(g);
            Assert.That(g.v4, "unity_v4.json 이 켜져 있어야 함");
            return g;
        }

        [Test]
        public void ClockOnlyMovesWhileWatchingAndEachActionTakesASlot()
        {
            var g = New(); var S = g.S;
            int m0 = S.min;
            Go(g, "tick", "m", 30);
            Assert.That(S.min, Is.EqualTo(m0), "집에선 시계 멈춤");
            Go(g, "rest"); ToHome(g);
            Assert.That(S.slot, Is.EqualTo(1), "쉬기 = 칸 하나");
            Assert.That(S.min, Is.EqualTo(g.slotStartMin(1)));
            Go(g, "watch");
            Assert.That(S.pending.t, Is.EqualTo("watch"));
            Go(g, "tick", "m", 30);
            Assert.That(S.min, Is.EqualTo(g.slotStartMin(1) + 30), "장 보는 동안만 시간이 흐름");
            Go(g, "watchEnd"); ToHome(g);
            Assert.That(S.slot, Is.EqualTo(2), "그만 보기 = 칸 끝");
        }

        [Test]
        public void WeekendClosesStocksButNotCoins()
        {
            var g = New(); var S = g.S;
            S.day = 6; S.slot = 1; S.min = 600;
            Assert.That(g.weekend(), Is.True);
            Assert.That(g.stockOpen(), Is.False, "주말 국장 휴장");
            S.day = 5;
            Assert.That(g.stockOpen(), Is.True, "평일 10시는 장중");
        }

        [Test]
        public void ChapterFollowsWeeksAndDaysLeftCountsToMaturity()
        {
            var g = New(); var S = g.S;
            Assert.That(g.chapter(), Is.EqualTo(1)); Assert.That(g.daysLeft(), Is.EqualTo(27));
            S.month = 3; S.day = 2;
            Assert.That(g.chapter(), Is.EqualTo(3)); Assert.That(g.daysLeft(), Is.EqualTo(12));
        }

        [Test]
        public void DateRaisesAffectionAndUsesTheSlot()
        {
            var g = New(); var S = g.S;
            double a0 = S.aff; int s0 = S.slot;
            Go(g, "date"); ToHome(g);
            Assert.That(S.aff, Is.EqualTo(a0 + Data.RULES.V4_DATE_AFF * (1 - a0 / Data.RULES.V4_AFF_SOFT)).Within(0.51), "높을수록 덜 오르는 만큼");
            Assert.That(S.slot, Is.EqualTo(s0 + 1));
        }

        [Test]
        public void BrokenPromiseCostsAffectionAtMidnight()
        {
            var g = New(); var S = g.S;
            S.prom = "nocoin"; S.promBad = false; S.cash = 5000000;
            var coin = Data.TKList.First(t => t.IsCoin && g.tkOpen(t.id));
            Go(g, "open", "tk", coin.id, "dir", 1, "lev", 1, "amt", 100000);
            Assert.That(S.promBad, Is.True, "코인 열면 '코인 금지' 어김");
            double a0 = S.aff;
            while (S.slot != 0 || S.day == 1) { Go(g, "rest"); ToHome(g); }
            Assert.That(S.aff, Is.LessThan(a0), "자정 판정에서 호감 깎임");
        }

        [Test]
        public void KeptDoPromiseRaisesAffection()
        {
            var g = New(); var S = g.S;
            S.prom = "date"; S.promDone = false;
            double a0 = S.aff;
            Go(g, "date"); ToHome(g);
            Assert.That(S.promDone, Is.True);
            while (S.slot != 0 || S.day == 1) { Go(g, "rest"); ToHome(g); }
            double afterDate = a0 + Data.RULES.V4_DATE_AFF * (1 - a0 / Data.RULES.V4_AFF_SOFT);
            Assert.That(S.aff, Is.GreaterThan(afterDate + 1), "놀아 준 것 + 부탁 지킨 보상");
        }

        /// 28일째 밤: 이자 내고 나면 만기 결산
        static GameSim AtMaturity(double debt, double aff, double greed = 0, bool go = false)
        {
            var g = New(); var S = g.S;
            S.month = 4; S.day = 7; S.slot = 2; S.min = g.slotStartMin(2); S.paidMonth = 3;
            S.debt = debt; S.aff = aff; S.greed = greed; S.cash = 20000000;
            if (go) { S.heist = 3; S.heistGo = true; }
            Go(g, "rest");
            for (int i = 0; i < 10 && S.pending?.t != "ending"; i++)
            {
                var P = S.pending; Assert.That(P, Is.Not.Null);
                if (P.t == "payday") Go(g, "payday", "k", P.stage == "repay" ? "keep" : "pay"); else ToHome(g);
            }
            Assert.That(S.pending?.t, Is.EqualTo("ending"));
            return g;
        }

        [Test]
        public void MaturityEndingsFollowDebtAndAffection()
        {
            var a = AtMaturity(10000000, 80);
            Assert.That((a.S.ending, a.S.endInfo.variant), Is.EqualTo(("bad1", "duo")), "절반 이하 + 호감 = 같이 원양어선");
            var b = AtMaturity(10000000, 30);
            Assert.That((b.S.ending, b.S.endInfo.variant), Is.EqualTo(("bad1", "sea")), "절반 이하 + 호감 없음 = 혼자");
            var c = AtMaturity(25000000, 90, 60);
            Assert.That(c.S.ending, Is.EqualTo("bad1"), "털기 루트를 안 탔으면 호감·욕심이 높아도 안 텀");
        }

        [Test]
        public void HeistRouteEndsBySuccessOrCapture()
        {
            var R = Data.RULES;
            Assert.That(AtMaturity(25000000, R.V4_AFF_HEIST + 5, R.V4_GREED_HEIST + 5, go: true).S.ending, Is.EqualTo("heist"), "믿음 + 각오 = 성공");
            Assert.That(AtMaturity(10000000, R.V4_AFF_HEIST + 5, R.V4_GREED_HEIST + 5, go: true).S.ending, Is.EqualTo("heist"), "턴다고 했으면 빚이 적어도 텀");
            Assert.That(AtMaturity(25000000, R.V4_AFF_HEIST - 10, R.V4_GREED_HEIST + 5, go: true).S.ending, Is.EqualTo("heistFail"), "호감 모자람 = 잡힘");
            var f = AtMaturity(25000000, R.V4_AFF_HEIST + 5, 0, go: true);
            Assert.That(f.S.ending, Is.EqualTo("heistFail"), "욕심(각오) 모자람 = 잡힘");
            Assert.That(Data.ENDINGS["heistFail"].ok, Is.False);
            Assert.That(f.S.endInfo.lead, Does.Contain("CCTV"));
        }

        [Test]
        public void HeistStoryStepsUnlockInOrder()
        {
            // 11일째 오후 = 금고 이야기 → 첫 선택지로 털기 1단계
            var g = New(); var S = g.S;
            S.month = 2; S.day = 4; S.slot = 1; S.min = g.slotStartMin(1); S.pending = null; S.flow = new List<string> { "home" };
            g.Apply(C("debug", "k", "noop"));
            Assert.That(S.pending?.evId, Is.EqualTo("v4_h1_safe"));
            Go(g, "evPick", "k", "ev0");
            Assert.That(S.heist, Is.EqualTo(1));
            // 17일째 아침 비번 이야기는 1단계가 있어야
            var h = New(); var H = h.S;
            H.month = 3; H.day = 3; H.slot = 0; H.min = h.slotStartMin(0); H.pending = null; H.flow = new List<string> { "home" };
            h.Apply(C("debug", "k", "noop"));
            Assert.That(H.pending?.evId, Is.Not.EqualTo("v4_h2_code"), "루트 안 탔으면 비번 이야기 없음");
            var k = New(); var K = k.S; K.heist = 1;
            K.month = 3; K.day = 3; K.slot = 0; K.min = k.slotStartMin(0); K.pending = null; K.flow = new List<string> { "home" };
            k.Apply(C("debug", "k", "noop"));
            Assert.That(K.pending?.evId, Is.EqualTo("v4_h2_code"));
            // 23일째 도주 차량: 현금 없으면 김사장 돈으로 사는 길
            var m = New(); var M = m.S; M.heist = 2; M.cash = 0; double d0 = M.debt;
            M.month = 4; M.day = 2; M.slot = 0; M.min = m.slotStartMin(0); M.pending = null; M.flow = new List<string> { "home" };
            m.Apply(C("debug", "k", "noop"));
            Assert.That(M.pending?.evId, Is.EqualTo("v4_h3_car"));
            Assert.That(M.pending.opts[0].dis, "현금 200만 없으면 현금 구매는 막힘");
            Go(m, "evPick", "k", "ev1");
            Assert.That((M.heist, M.debt - d0), Is.EqualTo((3, 2000000.0)));
        }

        [Test]
        public void LlmNewsIsAskedOneSlotAheadAndUsed()
        {
            var g = New(); var S = g.S;
            g.Apply(C("llmMode", "on", true));
            JObject q = null;
            for (int i = 0; i < 30 && q == null; i++) { q = g.NewsReqNext(); if (q == null) { Go(g, "rest"); ToHome(g); } }
            Assert.That(q, Is.Not.Null, "30칸 안에 다음 칸 뉴스 요청이 있음");
            int sid = (int)q["slotId"];
            Assert.That(sid, Is.EqualTo(g.Tnow() + 1));
            var ev = g.Apply(new SimCommand(new JObject
            {
                ["t"] = "newsFact", ["slotId"] = sid, ["dir"] = q["dir"], ["ticker"] = q["tickers"][0]["k"], ["strength"] = q["strengths"][0],
                ["event"] = "테스트 사건", ["headline"] = "미리 받은 테스트 속보", ["body"] = "본문 한 줄.", ["source"] = "테스트일보",
            }));
            Assert.That(ev.Any(e => e.t == "error"), Is.False, "다음 칸 사실을 받아 둠");
            Go(g, "rest"); ToHome(g);
            Assert.That(g.Tnow(), Is.EqualTo(sid));
            Assert.That(JToken.DeepEquals(g.NewsReq(), q), "한 칸 전에 물은 요청 = 그 칸에 다시 물은 요청");
            Go(g, "rest"); ToHome(g);
            Assert.That(S.feed.Any(f => f.x.Contains("미리 받은 테스트 속보")), "그 칸 끝 뉴스 = 받아 둔 AI 기사 (다음 칸 시작 속보)");
        }

        [Test]
        public void ClearVariantDependsOnAffectionAndLeadsToPart2()
        {
            var g = New(); var S = g.S;
            S.debt = 100000; S.cash = 1000000; S.aff = 80;
            Go(g, "repayOpen"); Go(g, "repay", "amt", 100000);
            Go(g, "rest");
            for (int i = 0; i < 10 && S.pending?.t != "ending"; i++) ToHome(g);
            Assert.That((S.ending, S.endInfo.variant), Is.EqualTo(("clear", "true")));
            Go(g, "continue");
            Assert.That(S.part, Is.EqualTo(2)); Assert.That(S.debt, Is.EqualTo(Data.RULES.V4_PART2_DEBT));
            Assert.That((S.month, S.day), Is.EqualTo((1, 1)));
            Assert.That(g.loanCap(), Is.GreaterThan(Data.RULES.V4_PART2_DEBT), "2부 한도도 1억 기준");
            ToHome(g);
            Assert.That(S.pending.t, Is.EqualTo("home"));

            var h = New(); h.S.debt = 100000; h.S.cash = 1000000; h.S.aff = 20;
            Go(h, "repayOpen"); Go(h, "repay", "amt", 100000); Go(h, "rest");
            for (int i = 0; i < 10 && h.S.pending?.t != "ending"; i++) ToHome(h);
            Assert.That(h.S.endInfo.variant, Is.EqualTo("lonely"), "호감 낮으면 돈만 갚고 미래는 떠남");
        }

        [Test]
        public void StoryEventsFireOnTheirDay()
        {
            var g2 = New(); var S2 = g2.S;   // 15일째 아침 집 = 김사장의 제안
            S2.month = 3; S2.day = 1; S2.slot = 0; S2.min = g2.slotStartMin(0); S2.pending = null; S2.flow = new List<string> { "home" };
            g2.Apply(C("debug", "k", "noop"));
            Assert.That(S2.pending?.t, Is.EqualTo("event")); Assert.That(S2.pending.evId, Is.EqualTo("v4_kim_offer"));
            Assert.That(Data.EVENTS.Where(e => e.day > 0).All(e => e.opts.Count >= 2));
        }

        [Test]
        public void HiddenPlacesAreClosedAndBotsRunClean()
        {
            var g = New();
            Go(g, "map");
            var e = g.Apply(C("goTo", "loc", "broker"));
            Assert.That(e.Any(x => x.t == "error"), "v4 에선 증권사 숨김");
            foreach (var st in new[] { "smart", "work", "gamble", "random" })
                for (int s = 1; s <= 4; s++)
                {
                    var r = RtBots.Run(Data, s * 104729, st, 40);
                    Assert.That(r.errs, Is.EqualTo(0), $"{st} seed {s}: {r.lastErr}");
                    Assert.That(r.end, Is.Not.EqualTo("none"), $"{st} seed {s}: 28일 안에 끝나야 함 (만기)");
                }
        }

        [Test]
        public void StockOrdersAndReportsOnlyWhileWatching()
        {
            var g = New(); var S = g.S;
            S.slot = 1; S.min = 720; S.cash = 5000000;
            var stk = Data.TKList.First(t => t.IsStock && g.tkOpen(t.id) && !t.inv);
            var e = g.Apply(C("buy", "tk", stk.id, "amt", 100000, "where", "app"));
            Assert.That(e.Any(x => x.t == "error"), "집에선 국장 주문 안 됨");
            Assert.That(g.Apply(C("report", "paid", false)).Any(x => x.t == "error"), "리포트도 장 보기에서만");
            var coin = Data.TKList.First(t => t.IsCoin && g.tkOpen(t.id));
            Go(g, "open", "tk", coin.id, "dir", 1, "lev", 1, "amt", 100000);   // 코인은 어디서나
            Go(g, "watch");
            Go(g, "buy", "tk", stk.id, "amt", 100000, "where", "app");
            Go(g, "report", "paid", false);
            Assert.That(S.hold.Has(stk.id));
        }

        [Test]
        public void NewsFlashShowsBeforeTheSlotMoves()
        {
            var g = New(); var S = g.S;
            bool seen = false;
            for (int i = 0; i < 12 && !seen; i++)
            {
                Go(g, "rest"); ToHome(g);
                seen = S.feed.Any(f => f.x.StartsWith("속보"));
            }
            Assert.That(seen, "칸 시작 속보가 피드에 뜸");
        }

        [Test]
        public void WeekendStockMovesLandOnMondayAndPaydaySellIsAFireSale()
        {
            var g = New(); var S = g.S;
            var stk = Data.TKList.First(t => t.IsStock && !t.inv);
            S.wkGap[stk.id] = 0.1; S.day = 1; S.slot = 0; S.mplan = null; S.gapT = -1;   // 새 월요일 오전 칸처럼 (같은 칸 재계획은 갭을 안 건드림)
            double p0 = S.mk.tk[stk.id].p;
            Go(g, "rest"); ToHome(g);   // 월요일 오전 칸 = 갭 반영
            Assert.That(S.wkGap.ContainsKey(stk.id), Is.False, "월요일 오전에 갭 소진");
            var h = New(); var T = h.S;
            T.month = 1; T.day = 7; T.slot = 2; T.min = h.slotStartMin(2); T.cash = 0; T.debt = 30000000;
            T.hold[stk.id] = new Holding { q = 1000, cost = 1000 * T.mk.tk[stk.id].p };
            double sv = h.stockVal();
            Go(h, "rest");
            Assert.That(T.pending.t, Is.EqualTo("payday"));
            Go(h, "payday", "k", "sell");
            Assert.That(T.today.Any(l => l.label == h.T("v4.fireSale") && l.amt < 0), "이자일 전량 매도 = 급매 손해");
            Assert.That(T.cash, Is.LessThan(sv * 0.85));
        }

        [Test]
        public void AffectionDecaysWithoutDatesAndGainsSoftCap()
        {
            var g = New(); var S = g.S;
            S.aff = 60; S.prom = null;
            for (int i = 0; i < 3; i++) { Go(g, "rest"); ToHome(g); }
            Assert.That(S.aff, Is.LessThan(60), "하루 종일 안 놀아 주면 식음");
            var h = New(); h.S.aff = 100; h.S.prom = null;
            Go(h, "date"); ToHome(h);
            Assert.That(h.S.aff, Is.LessThanOrEqualTo(100));
            var k = New(); k.S.aff = 90; k.S.prom = null; double a0 = k.S.aff;
            Go(k, "date"); ToHome(k);
            Assert.That(k.S.aff - a0, Is.LessThan(Data.RULES.V4_DATE_AFF), "높을수록 덜 오름");
        }

        [Test]
        public void HoldingCoinsAtMidnightBreaksNoCoinPromise()
        {
            var g = New(); var S = g.S;
            var coin = Data.TKList.First(t => t.IsCoin && g.tkOpen(t.id));
            S.prom = null; S.cash = 5000000;
            Go(g, "open", "tk", coin.id, "dir", 1, "lev", 1, "amt", 100000);
            S.prom = "nocoin"; S.promBad = false;   // 부탁 전부터 들고 있던 코인
            double a0 = S.aff;
            while (S.slot != 0 || S.day == 1) { Go(g, "rest"); ToHome(g); }
            Assert.That(S.aff, Is.LessThan(a0), "자정에 코인 들고 있으면 어김");
        }

        /// 밸런스 범위 (판 수 적게, 범위 넓게 — 정확한 값은 docs/V4.md §7 300판)
        [Test]
        public void BalanceBandsHold()
        {
            RtBots.Summary Sum(string st) => RtBots.Summarize(Data, st, 40, 1, 40);
            var pro = Sum("pro"); var work = Sum("work"); var gamble = Sum("gamble"); var casual = Sum("casual");
            TestContext.WriteLine(pro); TestContext.WriteLine(casual); TestContext.WriteLine(work); TestContext.WriteLine(gamble);
            Assert.That(pro.clear, Is.InRange(0.2, 0.7), "잘하는 사람은 꽤 깸");
            Assert.That(pro.clear + pro.End("bad1/duo"), Is.GreaterThanOrEqualTo(0.6));
            Assert.That(casual.clear + casual.End("bad1/duo"), Is.InRange(0.15, 0.7));
            Assert.That(work.clear, Is.EqualTo(0), "알바만으론 못 깸");
            Assert.That(gamble.bad, Is.GreaterThanOrEqualTo(0.75), "도박 몰빵은 대부분 망함");
            Assert.That(pro.errs + work.errs + gamble.errs + casual.errs, Is.EqualTo(0));
            foreach (var a in new[] { "watch", "work", "date" }) Assert.That(pro.acts.TryGetValue(a, out var v) ? v : 0, Is.GreaterThan(0.1), $"pro 가 {a} 를 씀 (죽은 선택지 없음)");
        }
    }
}
