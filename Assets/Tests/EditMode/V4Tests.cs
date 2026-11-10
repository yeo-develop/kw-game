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
                    case "liqAlert": Go(g, "alertHold"); break;
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
            double a0 = S.aff; int s0 = S.slot; double dm = g.dateMult();
            Go(g, "date"); ToHome(g);
            Assert.That(S.aff, Is.EqualTo(a0 + Data.RULES.V4_DATE_AFF * dm * (1 - a0 / Data.RULES.V4_AFF_SOFT)).Within(0.51), "높을수록 덜 오르는 만큼 (시간대 배수 포함)");
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
            double a0 = S.aff, dm = g.dateMult();
            Go(g, "date"); ToHome(g);
            Assert.That(S.promDone, Is.True);
            while (S.slot != 0 || S.day == 1) { Go(g, "rest"); ToHome(g); }
            double afterDate = a0 + Data.RULES.V4_DATE_AFF * dm * (1 - a0 / Data.RULES.V4_AFF_SOFT);
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
                if (P.t == "payday") Go(g, "payday", "k", P.stage == "repay" ? "keep" : P.stage == "gate" ? "gateSkip" : "pay"); else ToHome(g);
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

        // ---------- 주간 납부 관문 · 증거금 상한 (docs/BLUEPRINT.md ⑥-1·7·8·9) ----------
        /// 이자일 밤으로 보내고 이자까지 냄 → 원금 분납 단계(또는 이미 통과)에서 멈춤
        static void ToGate(GameSim g)
        {
            var S = g.S;
            S.day = Data.RULES.MONTH_DAYS; S.slot = 2; S.min = g.slotStartMin(2);
            Go(g, "rest");
            for (int i = 0; i < 12; i++)
            {
                var P = S.pending; Assert.That(P, Is.Not.Null);
                if (P.t == "payday" && P.stage == "gate") return;
                if (P.t == "relic" || P.t == "ending" || (P.t == "home" && S.day == 1)) return;   // 이미 통과했거나 끝남
                if (P.t == "payday") Go(g, "payday", "k", "pay"); else ToHome(g);
            }
            Assert.Fail("ToGate: " + S.pending?.t);
        }

        /// ⑥-1: 배율은 1일차부터 자유, 대신 증거금 합계가 상한(30만)을 넘는 주문은 거절. 숏·대출은 첫 납부 통과 뒤
        [Test]
        public void LeverageIsOpenFromDayOneButMarginIsCapped()
        {
            var g = New(); var S = g.S; S.cash = 5000000; var R = Data.RULES;
            Assert.That(g.gateOn); Assert.That(S.gateTier, Is.EqualTo(0));
            Assert.That(g.marginCap(), Is.EqualTo(R.V4_MARGIN_CAP[0]));
            var coin = Data.TKList.First(t => t.IsCoin && g.tkOpen(t.id) && t.maxLev >= 25);
            Go(g, "open", "tk", coin.id, "dir", 1, "lev", 10, "amt", R.V4_MARGIN_CAP[0]);
            Assert.That(S.cps.Single().lev, Is.EqualTo(10), "1일차에 10배가 열림");
            Assert.That(g.marginRoom(), Is.EqualTo(0));
            Go(g, "open", "tk", coin.id, "dir", 1, "lev", 2, "amt", 100000);
            Assert.That(S.cps.Count, Is.EqualTo(1), "상한을 넘는 주문은 거절");
            Go(g, "close", "id", S.cps[0].id);
            Go(g, "open", "tk", coin.id, "dir", 1, "lev", 1, "amt", R.V4_MARGIN_CAP[0] + 10000);
            Assert.That(S.cps.Count, Is.EqualTo(0), "1배여도 금액이 넘으면 거절 (배율이 아니라 금액을 묶음)");
            Go(g, "open", "tk", coin.id, "dir", -1, "lev", 1, "amt", 100000);
            Assert.That(S.cps.Count, Is.EqualTo(0), "숏은 첫 납부 통과 뒤");
            Assert.That(g.loanOk(), Is.False);
            Go(g, "loanOpen");
            Assert.That(g.Apply(C("borrow", "amt", 1000000.0)).Any(e => e.t == "error"), "대출도 첫 납부 통과 뒤");
        }

        /// ⑥-7·8: 7일째 밤 이자 다음에 원금 분납. 통과하면 유품 하나 + 증거금 상한·숏·대출이 열리고, 다음 주 요구액은 더 큼
        [Test]
        public void WeeklyGateGrowsAndPassingRewardsRelicAndRaisesMarginCap()
        {
            var g = New(); var S = g.S; S.cash = 20000000; var R = Data.RULES;
            int relics0 = S.augs.Count; double debt0 = S.debt;
            Assert.That(g.gatePrincipal(), Is.EqualTo(debt0 - R.V4_GATE_CAP[0]));
            ToGate(g);
            Assert.That(S.pending.stage, Is.EqualTo("gate"));
            double need1 = S.pending.due;
            Assert.That(need1, Is.EqualTo(debt0 - R.V4_GATE_CAP[0]), "1주차 원금 분납 = 빚 − 상한");
            Go(g, "payday", "k", "gatePay");
            Assert.That(S.debt, Is.EqualTo(R.V4_GATE_CAP[0]));
            Assert.That(S.pending?.t, Is.EqualTo("relic"), "통과 보상: 유품 고르기");
            Assert.That(S.pending.offer.Count, Is.GreaterThan(0));
            Go(g, "pickRelic", "i", 0);
            Assert.That(S.augs.Count, Is.EqualTo(relics0 + 1));
            ToHome(g);
            Assert.That(S.month, Is.EqualTo(2)); Assert.That(S.gateTier, Is.EqualTo(1)); Assert.That(S.missN, Is.EqualTo(0));
            Assert.That(g.marginCap(), Is.EqualTo(R.V4_MARGIN_CAP[1]), "증거금 상한 한 단계 위");
            Assert.That(g.shortOk()); Assert.That(g.loanOk());
            Assert.That(S.kk["kim"].Any(m => m.x.Contains(g.T("v4.gate.upShort"))), "김사장 카톡으로 열린 것 알림");
            // 주중에 빌리면 이번 주에 갚을 원금이 그만큼 늘어남 (대출 = 주 단위 단기 자금)
            double p0 = g.gatePrincipal();
            Go(g, "loanOpen"); Go(g, "borrow", "amt", 1000000.0); Go(g, "loanDone"); ToHome(g);
            Assert.That(g.gatePrincipal(), Is.EqualTo(p0 + 1000000));
            ToGate(g);
            Assert.That(S.pending.stage, Is.EqualTo("gate"));
            Assert.That(S.pending.due, Is.GreaterThan(need1), "요구액이 주마다 커짐");
        }

        /// 주중에 미리 갚아 상한 밑이면 이자만 내고 바로 통과
        [Test]
        public void RepayingEarlyPassesTheGateWithoutAsking()
        {
            var g = New(); var S = g.S; S.cash = 5000000;
            S.debt = Data.RULES.V4_GATE_CAP[0];
            Assert.That(g.gatePrincipal(), Is.EqualTo(0));
            ToGate(g);
            Assert.That(S.pending?.t, Is.EqualTo("relic"), "원금 단계 없이 통과 보상으로");
            Assert.That(S.gateTier, Is.EqualTo(1));
        }

        /// 가진 만큼만 내면 못 낸 원금에만 연체료. 다음 주에 다 내면 미납 기록이 지워짐
        [Test]
        public void PartialGatePaymentChargesLateFeeOnShortfall()
        {
            var g = New(); var S = g.S; var R = Data.RULES;
            S.cash = g.interestDue() + 1000000;   // 이자 내고 100만 남음
            ToGate(g);
            double need = S.pending.due, debt = S.debt;
            Go(g, "payday", "k", "gatePart");
            double shortA = need - 1000000;
            Assert.That(S.debt, Is.EqualTo(debt - 1000000 + MathK.Round1k(shortA * R.V4_LATE_FEE)), "100만 갚고, 못 낸 원금의 연체료가 빚에 붙음");
            Assert.That(S.missN, Is.EqualTo(1)); Assert.That(S.gateTier, Is.EqualTo(0), "미납이면 증거금 상한 그대로");
            ToHome(g);
            Assert.That(S.month, Is.EqualTo(2)); Assert.That(S.ending, Is.Null);
            S.cash = 20000000;
            ToGate(g); Go(g, "payday", "k", "gatePay");
            Assert.That(S.missN, Is.EqualTo(0), "통과하면 미납 기록 지움");
            Assert.That(S.debt, Is.EqualTo(R.V4_GATE_CAP[1]));
        }

        /// ⑥-9: 2주 연속 미납이면 28일 전에 원양어선
        [Test]
        public void TwoMissedGatesInARowEndTheRunBeforeMaturity()
        {
            var g = New(); var S = g.S;
            S.cash = g.interestDue() + 50000;
            ToGate(g); Go(g, "payday", "k", "gateSkip");
            Assert.That(S.missN, Is.EqualTo(1)); Assert.That(S.ending, Is.Null);
            ToHome(g);
            S.cash = g.interestDue() + 50000;
            ToGate(g);
            Assert.That(S.pending.stage, Is.EqualTo("gate"));
            Go(g, "payday", "k", "gateSkip");
            Assert.That(S.ending, Is.EqualTo("bad1"));
            Assert.That(g.absDay(), Is.LessThan(Data.RULES.V4_DAYS), "만기 전에 끝남");
        }

        /// 국면 시나리오: 판(씨앗)마다 장 순서가 다르고, 2부는 1부와 다른 순서. 장 이름엔 국면이 안 드러남
        [Test]
        public void RegimeScenarioVariesBySeedAndChapterNamesStayNeutral()
        {
            var R = Data.RULES;
            Assert.That(R.V4_SCEN, Is.Not.Null.And.Not.Empty);
            var seen = new HashSet<string>();
            for (int s = 1; s <= 40; s++)
            {
                var g = GameSim.Create(Data, s * 104729, new GameSim.Opts { rt = true });
                string p1 = string.Join(">", Enumerable.Range(1, 4).Select(c => g.regime(c)));
                seen.Add(p1);
                Assert.That(Enumerable.Range(1, 4).All(c => R.V4_REG.ContainsKey(g.regime(c))), p1);
                g.S.part = 2;
                string p2 = string.Join(">", Enumerable.Range(1, 4).Select(c => g.regime(c)));
                Assert.That(p2, Is.Not.EqualTo(p1), "2부는 1부와 다른 순서");
            }
            Assert.That(seen.Count, Is.GreaterThanOrEqualTo(3), "판마다 국면 순서가 달라짐");
            var h = New();
            foreach (var part in new[] { 1, 2 })
            {
                h.S.part = part;
                for (int c = 1; c <= 4; c++)
                    foreach (var w in new[] { "불장", "폭락", "과열", "횡보", "반등" }) Assert.That(h.chapterName(c), Does.Not.Contain(w), $"{part}부 {c}장 이름에 국면 노출");
            }
            foreach (var key in new[] { "ch1", "ch2", "ch3", "ch4", "p2ch1", "p2ch2", "p2ch3", "p2ch4" })
            {
                string txt = Data.J["SCENES"][key].ToString();
                foreach (var w in new[] { "불장", "폭락", "횡보", "과열" }) Assert.That(txt, Does.Not.Contain(w), $"{key} 장 카드가 국면을 단정");
            }
        }

        /// 가짜 속보 = 선반영 후 되돌림: 같은 판에서 진짜 호재면 오르고, 가짜 호재면 오히려 내림
        [Test]
        public void FakeNewsMovesPriceTheOtherWay()
        {
            double Move(bool fake)
            {
                var g = New(); var S = g.S;
                var coin = Data.TKList.First(t => t.IsCoin && g.tkOpen(t.id) && !t.meme);
                S.news = new News { tk = coin.id, h = "테스트 호재", dir = 1, r = 0.5, fake = fake };
                S.mplan = null;   // 이 속보로 다시 계획
                double p0 = S.mk.tk[coin.id].p;
                Go(g, "rest"); ToHome(g);
                return S.mk.tk[coin.id].p / p0 - 1;
            }
            double real = Move(false), fake = Move(true);
            Assert.That(real, Is.GreaterThan(0.2), "진짜 호재는 오름");
            Assert.That(fake, Is.LessThan(0), "가짜 호재는 되돌림으로 내림");
        }

        /// 미래 돌발 매수 코인은 내가 '코인 금지'를 어긴 게 아님 (열 때도, 자정에 들고 있어도)
        [Test]
        public void MiraiImpulseCoinDoesNotBreakNoCoinPromise()
        {
            var g = New(); var S = g.S;
            S.cash = 5000000; S.prom = "nocoin"; S.promBad = false;
            S.slot = 2; S.min = g.slotStartMin(2);   // 밤 = 국장 닫힘 → 돌발 매수는 코인
            var p = g.promNow();
            Go(g, "debug", "k", "impulse");
            Assert.That(S.pending?.t, Is.EqualTo("impulse"));
            Go(g, "reply", "i", S.pending.opts.FindIndex(o => !o.ok));   // 못 말림 → 미래가 삼
            Assert.That(S.cps.Count, Is.EqualTo(1), "미래가 코인 삼");
            Assert.That(S.cps[0].mirai, Is.True);
            Assert.That(S.promBad, Is.False, "미래가 산 건 부탁 어김 아님");
            if (S.pending == null) { S.flow = new List<string> { "home" }; g.Apply(C("debug", "k", "noop")); }   // 디버그로 띄운 돌발 매수라 집 흐름으로 되돌림
            ToHome(g);
            int d0 = g.absDay();
            while (g.absDay() == d0) { Go(g, "rest"); ToHome(g); }
            Assert.That(S.kk["m"].Any(m => m.x == p.endOk), "자정 판정 = 지킴 (코인 들고 있어도 미래 것)");
            Assert.That(S.kk["m"].Any(m => m.x == p.endBad), Is.False);
        }

        /// 클리어 '도박으로 갚음'은 도박 순익이 알바 수입·매매 실현수익보다 클 때만 (매매로 갚고 도박 1만 딴 사람 ≠ 도박 클리어 → 진엔딩)
        [Test]
        public void TraderWhoWonALittleGamblingStillGetsTrueEnding()
        {
            var g = New(); var S = g.S;
            S.debt = 100000; S.cash = 1000000; S.aff = 80;
            S.st.gnet = 10000; S.st.earned = 0; S.realized = 5000000;
            Go(g, "repayOpen"); Go(g, "repay", "amt", 100000);
            Go(g, "rest");
            for (int i = 0; i < 10 && S.pending?.t != "ending"; i++) ToHome(g);
            Assert.That((S.ending, S.endInfo.variant), Is.EqualTo(("clear", "true")));

            var h = New(); var H = h.S;
            H.debt = 100000; H.cash = 1000000; H.aff = 80;
            H.st.gnet = 8000000; H.st.earned = 1000000; H.realized = 0;
            Go(h, "repayOpen"); Go(h, "repay", "amt", 100000);
            Go(h, "rest");
            for (int i = 0; i < 10 && H.pending?.t != "ending"; i++) ToHome(h);
            Assert.That((H.ending, H.endInfo.variant), Is.EqualTo(("clear", "gamble")), "진짜 도박으로 갚았으면 도박 클리어");
        }

        /// 밤에 푹 자면 다음 장날 무료 리포트 +1 (금요일 밤이면 월요일)
        [Test]
        public void NightSleepGivesFreeReportNextTradingDay()
        {
            var R = Data.RULES;
            Assert.That(R.V4_SLEEP_RSCH, Is.GreaterThan(0));
            var g = New(); var S = g.S;
            int f0 = g.freeMax();
            S.slot = 2; S.min = g.slotStartMin(2);
            Assert.That(g.restHint(), Does.Contain("리포트"), "밤 쉬기 부제에 보너스 표시");
            Go(g, "rest"); ToHome(g);
            Assert.That(S.day, Is.EqualTo(2));
            Assert.That(g.freeMax(), Is.EqualTo(f0 + R.V4_SLEEP_RSCH), "다음 날 무료 리포트 +1");
            Go(g, "rest"); ToHome(g);
            Go(g, "rest"); ToHome(g);
            Go(g, "date"); ToHome(g);   // 밤에 안 자면 보너스 없음
            Assert.That(S.day, Is.EqualTo(3)); Assert.That(g.freeMax(), Is.EqualTo(f0), "하루만");

            var h = New(); var H = h.S;
            H.day = R.V4_WEEKDAYS; H.slot = 2; H.min = h.slotStartMin(2);   // 금요일 밤
            Go(h, "rest"); ToHome(h);
            Assert.That(H.sleepD, Is.EqualTo(R.MONTH_DAYS + 1), "주말 건너 월요일(다음 주 1일)");
        }

        /// 같이/혼자 원양어선 문구 = 실제 갚은 비율 (문턱 V4_DUO_DEBT 와 안 어긋나게)
        [Test]
        public void DuoEndingTextShowsRepaidPercent()
        {
            var a = AtMaturity(10000000, 80);
            Assert.That(a.S.endInfo.variant, Is.EqualTo("duo"));
            Assert.That(a.S.endInfo.lead, Does.Contain("67%"));
            Assert.That(a.S.endInfo.lead, Does.Not.Contain("절반"));
        }

        /// 시간대 비중: 평일 낮은 장·알바, 저녁은 미래 시간
        [Test]
        public void EveningIsForMiraiAndDaytimeForWork()
        {
            var g = New(); var S = g.S;
            Assert.That(g.weekend(), Is.False);
            S.slot = 0; double day = g.dateMult(); var job = Data.JOBS.Values.First();
            double payDay = g.jobPay(job, 0.5);
            S.slot = 2; double eve = g.dateMult(); double payEve = g.jobPay(job, 0.5);
            Assert.That(eve, Is.GreaterThan(day), "저녁 놀기 호감이 낮보다 큼");
            Assert.That(payEve, Is.LessThan(payDay), "야간 알바는 덜 벌림");
            S.day = Data.RULES.V4_WEEKDAYS + 1;
            Assert.That(g.dateMult(), Is.EqualTo(1), "주말은 시간대 상관없음");
        }

        // ---------- 난이도 (docs/STORE.md §3 ④) ----------
        [Test]
        public void DifficultyChangesInterestCashAndThreshold()
        {
            var easy = GameSim.Create(Data, 3, new GameSim.Opts { rt = true, diff = "easy" });
            var normal = GameSim.Create(Data, 3, new GameSim.Opts { rt = true });
            var hard = GameSim.Create(Data, 3, new GameSim.Opts { rt = true, diff = "hard" });
            Assert.That(normal.S.diff, Is.EqualTo("normal"));
            Assert.That(easy.rate(), Is.LessThan(normal.rate())); Assert.That(hard.rate(), Is.GreaterThan(normal.rate()));
            Assert.That(easy.S.cash, Is.GreaterThan(normal.S.cash)); Assert.That(hard.S.cash, Is.LessThan(normal.S.cash));
            Assert.That(easy.duoDebt(), Is.GreaterThan(normal.duoDebt())); Assert.That(hard.duoDebt(), Is.LessThan(normal.duoDebt()));
            Assert.That(easy.DiffName(), Is.Not.EqualTo(hard.DiffName()));
            Go(easy, "start"); ToHome(easy);
            Assert.That(easy.interestDue(), Is.EqualTo(MathK.Round1k(easy.S.debt * easy.rate())));
        }

        // ---------- 알바 중 청산 경보 (docs/STORE.md §3 ⑦) ----------
        /// 10배 롱을 들고 알바 → 시세가 7% 빠지면(손실 70%) 알바 시간 중 경보가 한 번 끼어듦
        static GameSim ToAlert(int seed, out string tk)
        {
            var g = New(seed); var S = g.S;
            S.gateTier = 3; S.cash = 2000000;   // 증거금 상한 없는 단계 (상한은 다른 테스트)
            var coin = Data.TKList.First(t => t.IsCoin && g.tkOpen(t.id) && t.maxLev >= 25);
            Go(g, "open", "tk", coin.id, "dir", 1, "lev", 10, "amt", 500000);
            Assert.That(S.cps.Single().lev, Is.EqualTo(10));
            tk = coin.id;
            // 알바: 지도 → 일터 → 카페 → 미니게임 결과
            Go(g, "map"); Go(g, "goTo", "loc", "work");
            if (S.pending.t == "encounter") Go(g, "encounter", "ask", false);
            var opt = g.Query(() => g.locOpts("work")).First(o => !o.dis && o.k == "l-cafe");
            // 미니게임 직전에 시세를 떨어뜨려 둠 (알바 뒤 시간이 흐르자마자 손실 70%)
            S.mk.tk[coin.id].p = S.cps[0].entry * 0.93;
            Go(g, "act", "k", opt.k); Go(g, "mgSetup"); Go(g, "mgResult", "score", 0.8);
            return g;
        }
        [Test]
        public void LiqAlertInterruptsWorkOncePerSlot()
        {
            var g = ToAlert(5, out var tk); var S = g.S;
            Assert.That(S.pending?.t, Is.EqualTo("liqAlert"), "알바 시간 중 경보");
            var P = S.pending;
            Assert.That(P.tk, Is.EqualTo(tk)); Assert.That(P.n0, Is.InRange(0.6, 1)); Assert.That(P.took, Is.GreaterThan(0)); Assert.That(P.key, Is.EqualTo("cafe"));
            Assert.That(S.owe, Is.GreaterThan(0), "남은 알바 시간은 선택 뒤로");
            double cash = S.cash, liq0 = S.st.liq;
            Go(g, "alertHold");
            Assert.That(S.pending?.t, Is.Not.EqualTo("liqAlert"), "참으면 한 칸에 다시 안 뜸");
            Assert.That(S.cash, Is.EqualTo(cash).Within(1e-6).Or.GreaterThan(cash), "참으면 일당 안 깎임");
            ToHome(g);
            Assert.That(S.cps.Count == 0 || S.st.liq == liq0, "참은 뒤 청산됐으면 포지션이 없음");
            if (S.st.liq > liq0) Assert.That(S.liqWork, Is.GreaterThanOrEqualTo(1), "알바 중 청산 집계 (도전과제 liq_work)");
        }
        [Test]
        public void LiqAlertPeekClosesPositionsAndCutsPay()
        {
            var g = ToAlert(5, out _); var S = g.S;
            Assert.That(S.pending?.t, Is.EqualTo("liqAlert"));
            double took = S.pending.took, pay = S.lastPay;
            Go(g, "alertPeek");
            Assert.That(S.cps.Count, Is.EqualTo(0), "몰래 폰 봄 = 전부 정리");
            var led = S.today.Last(l => l.kind == "work");
            Assert.That(-led.amt, Is.EqualTo(took).Or.EqualTo(pay), "일당 깎임 또는 들켜서 전부");
            ToHome(g);
            Assert.That(S.pending?.t, Is.EqualTo("home").Or.EqualTo("ending"));
        }
        [Test]
        public void LiqAlertNeedsLeverageAndWork()
        {
            var g = New(5); var S = g.S;
            S.cash = 2000000; S.gateTier = 3;
            var coin = Data.TKList.First(t => t.IsCoin && g.tkOpen(t.id));
            Go(g, "open", "tk", coin.id, "dir", 1, "lev", 1, "amt", 500000);   // 1배 = 경보 없음
            Go(g, "map"); Go(g, "goTo", "loc", "work");
            if (S.pending.t == "encounter") Go(g, "encounter", "ask", false);
            var opt = g.Query(() => g.locOpts("work")).First(o => !o.dis && o.k == "l-cafe");
            S.mk.tk[coin.id].p = S.cps[0].entry * 0.3;
            Go(g, "act", "k", opt.k); Go(g, "mgSetup"); Go(g, "mgResult", "score", 0.8);
            ToHome(g);
            Assert.That(S.alertT, Is.EqualTo(-1), "1배 현물은 경보 없음");
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
