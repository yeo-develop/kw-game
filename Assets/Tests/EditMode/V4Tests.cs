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
        /// 집이 나올 때까지 무난하게 넘김 (유물 첫째 · 이벤트 첫 선택지 · 멘헤라 착한 답장 · 이자 냄)
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
            Assert.That(S.cash, Is.GreaterThanOrEqualTo(Data.RULES.V4_P2_CASH), "2부 판돈 (굴릴 돈 바닥)");
            Assert.That(g.analysts().All(a => S.srcStat[a.id][1] == Data.RULES.V4_AN_PRIOR), "2부: 분석가 전적도 새로");
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

        /// ⑥-1: 배율은 1일차부터 자유, 대신 증거금 합계가 그 주 상한을 넘는 주문은 거절. 숏은 2주차부터, 대출은 첫 납부 통과 뒤
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
            Assert.That(g.shortOk(), Is.False);
            Go(g, "open", "tk", coin.id, "dir", -1, "lev", 1, "amt", 100000);
            Assert.That(S.cps.Count, Is.EqualTo(0), "숏은 2주차부터");
            Assert.That(g.loanOk(), Is.False);
            Go(g, "loanOpen");
            Assert.That(g.Apply(C("borrow", "amt", 1000000.0)).Any(e => e.t == "error"), "대출은 첫 납부 통과 뒤");
        }

        /// ⑥-7·8: 7일째 밤 이자 다음에 원금 분납. 통과하면 유물 하나 + 대출이 열리고, 증거금 상한·숏은 주차로 열림. 다음 주 요구액은 더 큼
        [Test]
        public void WeeklyGateGrowsAndPassingRewardsRelic()
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
            Assert.That(S.pending?.t, Is.EqualTo("relic"), "통과 보상: 유물 고르기");
            Assert.That(S.pending.offer.Count, Is.GreaterThan(0));
            Go(g, "pickRelic", "i", 0);
            Assert.That(S.augs.Count, Is.EqualTo(relics0 + 1));
            ToHome(g);
            Assert.That(S.month, Is.EqualTo(2)); Assert.That(S.gateTier, Is.EqualTo(1)); Assert.That(S.missN, Is.EqualTo(0));
            Assert.That(g.marginCap(), Is.EqualTo(R.V4_MARGIN_CAP[1]), "증거금 상한은 주차로 오름");
            Assert.That(g.shortOk(), "숏은 2주차부터"); Assert.That(g.loanOk(), "대출은 첫 통과 뒤");
            Assert.That(S.kk["kim"].Any(m => m.x.Contains(g.T("v4.gate.upLoan"))), "김사장 카톡으로 열린 것 알림");
            ToGate(g);
            Assert.That(S.pending.stage, Is.EqualTo("gate"));
            Assert.That(S.pending.due, Is.GreaterThan(need1), "요구액이 주마다 커짐");
        }

        /// 김사장 돈 = 관문을 넘기는 비싼 다리: 이번 주에 빌린 돈은 이번 주 원금 분납에서 빠지고 다음 주 몫이 됨. 한 주에 빌릴 수 있는 돈엔 한도
        [Test]
        public void LoanThisWeekIsDueNextWeekAndHasAWeeklyLimit()
        {
            var g = New(); var S = g.S; S.cash = 20000000; var R = Data.RULES;
            ToGate(g); Go(g, "payday", "k", "gatePay"); ToHome(g);
            Assert.That(S.month, Is.EqualTo(2)); Assert.That(g.loanOk());
            double p0 = g.gatePrincipal(), debt = S.debt, lim = R.V4_LOAN_WEEK;
            Assert.That(lim, Is.GreaterThan(0)); Assert.That(g.loanWeekRoom(), Is.EqualTo(lim));
            double L = R.LOAN_AMTS.Where(x => x <= lim).Max();
            Go(g, "loanOpen"); Go(g, "borrow", "amt", L);
            Assert.That(S.debt, Is.EqualTo(debt + L)); Assert.That(S.loanWeek, Is.EqualTo(L));
            Assert.That(g.gatePrincipal(), Is.EqualTo(p0), "이번 주에 빌린 돈은 이번 주 요구액에 안 얹힘");
            Assert.That(g.loanWeekRoom(), Is.EqualTo(lim - L));
            if (lim - L < R.LOAN_AMTS.Min()) Assert.That(g.Apply(C("borrow", "amt", R.LOAN_AMTS.Min())).Any(e => e.t == "error"), "주당 한도를 넘으면 거절");
            Go(g, "loanDone"); ToHome(g);
            ToGate(g);
            Assert.That(S.pending.due, Is.EqualTo(p0), "관문 요구액에도 안 얹힘");
            Go(g, "payday", "k", "gatePay");
            Assert.That(S.debt, Is.EqualTo(R.V4_GATE_CAP[1] + L), "통과한 뒤 빚 = 상한 + 이번 주에 빌린 돈");
            Assert.That(S.loanWeek, Is.EqualTo(0));
            ToHome(g);
            Assert.That(S.month, Is.EqualTo(3));
            Assert.That(g.gatePrincipal(), Is.EqualTo(S.debt - R.V4_GATE_CAP[2]), "다음 주엔 그 돈까지 요구액");
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

        /// 가진 만큼만 내면 못 낸 원금에만 연체료 · 유물 없음 · 대출은 안 열림. 그래도 증거금 상한은 주차로 오름 (첫 미납이 끝이 아니게). 다음 주에 다 내면 미납 기록이 지워짐
        [Test]
        public void PartialGatePaymentChargesLateFeeOnShortfall()
        {
            var g = New(); var S = g.S; var R = Data.RULES;
            S.cash = g.interestDue() + 500000;   // 이자 내고 50만 남음
            ToGate(g);
            double need = S.pending.due, debt = S.debt; int relics0 = S.augs.Count;
            Assert.That(need, Is.GreaterThan(500000));
            Go(g, "payday", "k", "gatePart");
            double shortA = need - 500000;
            Assert.That(S.debt, Is.EqualTo(debt - 500000 + MathK.Round1k(shortA * R.V4_LATE_FEE)), "50만 갚고, 못 낸 원금의 연체료가 빚에 붙음");
            Assert.That(S.missN, Is.EqualTo(1)); Assert.That(S.gateTier, Is.EqualTo(0));
            ToHome(g);
            Assert.That(S.month, Is.EqualTo(2)); Assert.That(S.ending, Is.Null);
            Assert.That(S.augs.Count, Is.EqualTo(relics0), "미납이면 유물 없음");
            Assert.That(g.loanOk(), Is.False, "통과한 적이 없으면 대출은 잠김");
            Assert.That(g.marginCap(), Is.EqualTo(R.V4_MARGIN_CAP[1]), "증거금 상한은 미납과 상관없이 주차로");
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

        // ---------- 읽어야 하는 시장: 분석가 · 발표 갭 · 후속 속보 · 예약 주문 (docs/BLUEPRINT.md ①③ · ⑥-4·10) ----------
        /// 분석가 4명의 진짜 적중률은 판마다 섞여 숨어 있고, 화면엔 지난 전적만 보임 (첫날부터 읽을 거리). 2부에선 다시 섞임
        [Test]
        public void AnalystsHaveHiddenShuffledAccuracyAndAVisibleRecord()
        {
            var R = Data.RULES; var g = New(); var S = g.S;
            var A = g.analysts();
            Assert.That(A.Count, Is.EqualTo(R.V4_AN_ACC.Length)); Assert.That(A.Count, Is.GreaterThanOrEqualTo(3));
            Assert.That(A.Select(a => g.anAcc(a.id)).OrderBy(x => x), Is.EqualTo(R.V4_AN_ACC.OrderBy(x => x)), "적중률은 정해진 값들을 한 명씩 나눠 가짐");
            Assert.That(A.Select(a => a.trust).Distinct().Count(), Is.EqualTo(1), "신뢰 별로는 구분이 안 됨");
            foreach (var a in A) { Assert.That(S.srcStat.ContainsKey(a.id)); Assert.That(S.srcStat[a.id][1], Is.EqualTo(R.V4_AN_PRIOR), "지난 전적이 깔려 있음"); Assert.That(g.srcRec(a.id), Does.Contain("/")); }
            string order(GameSim x) => string.Join(",", x.analysts().OrderByDescending(a => x.anAcc(a.id)).Select(a => a.id));
            Assert.That(Enumerable.Range(1, 12).Select(sd => order(New(sd))).Distinct().Count(), Is.GreaterThan(1), "판마다 누가 잘 맞히는지 다름");
            // 전적은 진짜 적중률을 따라감: 여러 판을 모으면 1등 분석가의 지난 전적이 꼴찌보다 뚜렷이 좋음
            double best = 0, worst = 0; int n = 0;
            for (int sd = 1; sd <= 20; sd++) { var x = New(sd); var L = x.analysts().OrderByDescending(a => x.anAcc(a.id)).ToList(); best += x.S.srcStat[L[0].id][0]; worst += x.S.srcStat[L[L.Count - 1].id][0]; n += R.V4_AN_PRIOR; }
            Assert.That(best / n, Is.GreaterThan(worst / n + 0.4));
            Assert.That(Enumerable.Range(1, 12).Any(sd => { var x = New(sd); string p1 = order(x); x.S.part = 2; return order(x) != p1; }), "2부에선 다시 섞임");
        }

        /// 무료 리포트 = 아무 분석가, 유료 = 분석가를 골라서. 결과 시점은 기한만 보임 (정확한 칸은 숨김)
        [Test]
        public void FreeReportIsFromAnyAnalystAndPaidReportPicksOne()
        {
            var R = Data.RULES; var g = New(); var S = g.S; S.cash = 5000000;
            Go(g, "watch");
            int n0 = S.tips.Count;
            Go(g, "report", "paid", false);
            var t = S.tips.Last(); Assert.That(S.tips.Count, Is.EqualTo(n0 + 1));
            Assert.That(g.srcOf(t).an, "v4 리포트는 분석가가 씀");
            Assert.That(t.Td, Is.GreaterThanOrEqualTo(t.Tr)); Assert.That(t.Tr, Is.GreaterThan(g.Tnow()));
            Assert.That(g.tipWhen(t), Does.EndWith(g.T("v4.an.by", "w", "")), "화면엔 '~까지' 기한만");
            string who = g.analysts().Last().id; double cash = S.cash;
            Go(g, "report", "paid", true, "who", who);
            Assert.That(S.tips.Last().who, Is.EqualTo(who), "유료 = 고른 분석가");
            Assert.That(S.cash, Is.EqualTo(cash - R.RT_RSCH_FEE));
            var ev = g.Apply(C("report", "paid", true, "who", "없는사람"));
            Assert.That(ev.Any(e => e.t == "report" && e["ok"] is bool ok && !ok), "없는 분석가면 안 받아짐");
            Assert.That(S.cash, Is.EqualTo(cash - R.RT_RSCH_FEE), "돈도 안 나감");
            Assert.That(g.freeMax(), Is.EqualTo(1 + R.V4_FREE_REP));
        }

        /// 리포트 결과 = 발표 순간의 갭: 맞으면 리포트 방향, 틀리면 반대로 한 번에 뜀 (예약 손절이 못 피함). 전적은 발표가 맞았나로 셈
        [Test]
        public void ReportResultLandsAsAGapAndWrongCallsGoTheOtherWay()
        {
            int seen = 0, anti = 0;
            for (int sd = 1; sd <= 12 && (seen < 3 || anti < 1); sd++)
            {
                var g = New(sd); var S = g.S; S.cash = 5000000;
                Go(g, "watch"); Go(g, "report", "paid", false);
                var t = S.tips.Last(); if (!Data.TK[t.tk].IsCoin) continue;
                int h0 = S.srcStat[t.who][0], n0 = S.srcStat[t.who][1];
                bool real = t.kind == "real"; Assert.That(real || t.kind == "anti", "분석가 리포트는 맞거나 반대로 가거나");
                // 발표 칸까지 감 (장 보기로 시간만 흘림) → 발표 사건이 뜨는 1분의 등락을 잼
                Go(g, "watchEnd"); ToHome(g);
                double jump = double.NaN; bool announced = false;
                for (int guard = 0; guard < 8 && !announced && string.IsNullOrEmpty(t.res); guard++)
                {
                    if (g.Tnow() < t.Tr) { Go(g, "rest"); ToHome(g); continue; }
                    Go(g, "watch");
                    while (S.pending?.t == "watch" && !announced)
                    {
                        double p0 = S.mk.tk[t.tk].p;
                        var ev = g.Apply(C("tick", "m", 1));
                        if (ev.Any(e => e.t == "planEv" && e.Str("k") == "report" && e.Str("tk") == t.tk)) { announced = true; jump = S.mk.tk[t.tk].p / p0 - 1; }
                    }
                    if (S.pending?.t == "watch") Go(g, "watchEnd");
                    ToHome(g);
                }
                Assert.That(announced, $"발표가 그 칸 안에 뜸 (씨앗 {sd})");
                int want = real ? t.dir : -t.dir;
                Assert.That(System.Math.Sign(jump), Is.EqualTo(want), "맞으면 리포트 방향, 틀리면 반대");
                Assert.That(System.Math.Abs(jump), Is.GreaterThan(t.mag * 0.6), "한 번에 뜀 (1분 사이의 갭)");
                while (string.IsNullOrEmpty(t.res) && S.pending?.t == "home") { Go(g, "rest"); ToHome(g); }
                Assert.That(t.res, Is.EqualTo(real ? "hit" : "miss"));
                Assert.That(S.srcStat[t.who][1], Is.EqualTo(n0 + 1)); Assert.That(S.srcStat[t.who][0], Is.EqualTo(h0 + (real ? 1 : 0)), "전적은 발표가 맞았나로");
                seen++; if (!real) anti++;
            }
            Assert.That(seen, Is.GreaterThanOrEqualTo(3)); Assert.That(anti, Is.GreaterThanOrEqualTo(1), "틀린 리포트도 한 번은 봄");
        }

        /// 후속 속보(확정/부인)는 대체로 맞지만 가끔 틀림
        [Test]
        public void FollowUpNewsIsUsuallyButNotAlwaysRight()
        {
            int n = 0, right = 0;
            for (int sd = 1; sd <= 80; sd++)
            {
                var g = New(sd); var S = g.S;
                if (S.news == null) continue;
                Go(g, "watch"); g.Apply(C("tick", "m", 1));
                var e = S.mplan?.evs.FirstOrDefault(x => x.k == "follow"); if (e == null) continue;
                n++; if (e.ok == !S.news.fake) right++;
            }
            Assert.That(n, Is.GreaterThanOrEqualTo(15));
            Assert.That((double)right / n, Is.InRange(0.6, 0.95), "대체로 맞음");
            Assert.That(right, Is.LessThan(n), "가끔 틀림 (답안지가 아님)");
        }

        /// ⑥-4: 예약 손절은 자리를 비운 사이에도 체결. 장 보기 칸에서만 걸 수 있음 (집에서 급히 잡으면 예약 없이 감)
        [Test]
        public void StopLossFillsWhileAwayAndOnlyWatchCanSetIt()
        {
            var g = New(5); var S = g.S; S.cash = 3000000;
            var coin = Data.TKList.First(t => t.IsCoin && g.tkOpen(t.id) && t.maxLev >= 5 && !t.meme);
            Go(g, "open", "tk", coin.id, "dir", 1, "lev", 2, "amt", 200000, "sl", 0.3);
            Assert.That(S.cps.Single().sl, Is.EqualTo(0), "집에선 예약이 안 걸림");
            Go(g, "close", "id", S.cps[0].id);
            Go(g, "watch");
            Go(g, "open", "tk", coin.id, "dir", 1, "lev", 5, "amt", 500000, "sl", 0.3);
            var c = S.cps.Single(); Assert.That(c.sl, Is.EqualTo(0.3));
            Go(g, "watchEnd"); ToHome(g);
            Assert.That(S.cps.Count, Is.EqualTo(1));
            S.mk.tk[coin.id].p = c.entry * 0.92;   // 5배 × −8% = 증거금 −40% (예약선 −30% 밖, 청산선 안)
            double liq0 = S.st.liq;
            Go(g, "map"); Go(g, "goTo", "loc", "work");
            if (S.pending.t == "encounter") Go(g, "encounter", "ask", false);
            var ev = g.Apply(C("act", "k", "l-cafe")); ev.AddRange(g.Apply(C("mgSetup"))); ev.AddRange(g.Apply(C("mgResult", "score", 0.8)));
            ToHome(g);
            Assert.That(S.cps.Count, Is.EqualTo(0), "알바하는 사이 예약 손절 체결");
            Assert.That(S.st.liq, Is.EqualTo(liq0), "청산이 아니라 손절");
        }

        /// 체력 삭제 (BLUEPRINT ②): 알바해도 체력이 안 깎이고, 알바 차이는 일당 대 스트레스
        [Test]
        public void ThereIsNoHpAndJobsDifferByStress()
        {
            var R = Data.RULES; var g = New(); var S = g.S;
            Assert.That(g.hpOff);
            Assert.That(g.restHint(), Does.Not.Contain("체력"));
            Assert.That(Data.AUGS.Where(x => x.d != null && x.d.Contains("체력")).Select(x => x.id), Is.Empty, "유물 설명도 v4 규칙으로 (체력 얘기 없음)");
            Assert.That(Data.AUGS.First(x => x.id == "loanbro").d, Does.Contain("주 이자"));
            var opts = g.Query(() => g.locOpts("work"));
            Assert.That(opts.All(o => !o.sub.Contains("체력")), "알바 설명에 체력이 없음");
            Assert.That(opts.All(o => o.sub.Contains("스트레스")));
            Assert.That(g.workStress(Data.JOBS["ware"], 1), Is.GreaterThan(g.workStress(Data.JOBS["cafe"], 1)), "많이 주는 알바가 더 힘듦");
            Assert.That(g.jobPay(Data.JOBS["ware"], 0.5), Is.GreaterThan(g.jobPay(Data.JOBS["cafe"], 0.5)));
            double st0 = S.stress;
            Go(g, "map"); Go(g, "goTo", "loc", "work");
            if (S.pending.t == "encounter") Go(g, "encounter", "ask", false);
            Go(g, "act", "k", "l-ware"); Go(g, "mgSetup"); Go(g, "mgResult", "score", 0.8); ToHome(g);
            Assert.That(S.hp, Is.EqualTo(R.HP_MAX), "체력은 늘 가득");
            Assert.That(S.stress, Is.GreaterThan(st0));
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

        // ---------- 알바 중 실시간 · 몰래 폰 보기 (docs/BLUEPRINT.md ⑥-2·3) ----------
        /// (lev > 0 이면 그 배율 롱 50만을 들고) 알바 미니게임 준비까지. mul ≠ 1 이면 미니게임 직전에 시세를 진입가 × mul 로
        static GameSim ToWork(int seed, string job, double lev, out string tk, double mul = 1)
        {
            var g = New(seed); var S = g.S; S.cash = 2000000;
            var coin = Data.TKList.First(t => t.IsCoin && g.tkOpen(t.id) && t.maxLev >= 25);
            if (lev > 0) { Go(g, "open", "tk", coin.id, "dir", 1, "lev", lev, "amt", 500000); Assert.That(S.cps.Single().lev, Is.EqualTo(lev)); }
            tk = coin.id;
            Go(g, "map"); Go(g, "goTo", "loc", "work");
            if (S.pending.t == "encounter") Go(g, "encounter", "ask", false);
            if (lev > 0 && mul != 1) S.mk.tk[coin.id].p = S.cps[0].entry * mul;
            Go(g, "act", "k", "l-" + job); Go(g, "mgSetup");
            return g;
        }
        /// ⑥-2: 알바 미니게임이 도는 동안 시세가 분 단위로 흐름 (칸 끝 1분 전까지)
        [Test]
        public void PricesMoveWhileTheWorkMinigameRuns()
        {
            var g = ToWork(5, "cafe", 0, out var tk); var S = g.S;
            int m0 = S.min, T0 = g.Tnow(); double p0 = S.mk.tk[tk].p;
            Go(g, "workTick", "m", 30);
            Assert.That(S.min, Is.EqualTo(m0 + 30)); Assert.That(S.pending.t, Is.EqualTo("work")); Assert.That(g.Tnow(), Is.EqualTo(T0));
            Assert.That(S.mk.tk[tk].p, Is.Not.EqualTo(p0), "일하는 동안 시세가 움직임");
            Go(g, "workTick", "m", 600);
            Assert.That(S.min, Is.EqualTo(g.slotEndMin(S.slot) - 1), "칸 끝 1분 전까지만 (마무리는 결과 뒤에)");
            Assert.That(S.pending.t, Is.EqualTo("work"));
            double cash = S.cash;
            Go(g, "mgResult", "score", 0.8);
            Assert.That(S.cash, Is.GreaterThan(cash), "일당");
            ToHome(g);
            Assert.That(g.Tnow(), Is.EqualTo(T0 + 1), "알바 = 한 칸");
            // 연습 판에선 시계가 안 감
            var h = New(5); Go(h, "map"); Go(h, "goTo", "loc", "work");
            if (h.S.pending.t == "encounter") Go(h, "encounter", "ask", false);
            Go(h, "act", "k", "l-cafe"); Go(h, "mgSetup", "practice", true);
            Assert.That(h.Apply(C("workTick", "m", 10)).Any(e => e.t == "error"));
        }
        /// ⑥-3: 레버리지 포지션 손실이 깊어지면 한 칸에 한 번 알림. 몰래 폰을 보면 정리되지만 볼 때마다 일당이 깎이고, 들키면 그 칸 일당 0
        [Test]
        public void WorkAlertFiresOnceAndPeekClosesAtACost()
        {
            var R = Data.RULES; int caught = 0, clean = 0;
            for (int sd = 1; sd <= 30 && (caught == 0 || clean < 2); sd++)
            {
                var g = ToWork(sd, "cafe", 10, out var tk, 0.93); var S = g.S;   // 10배 × −7% = 증거금 −70%
                var ev = g.Apply(C("workTick", "m", 1));
                Assert.That(ev.Count(e => e.t == "workAlert"), Is.EqualTo(1), "문턱(60%)을 넘으면 알림");
                Assert.That(g.Apply(C("workTick", "m", 5)).Any(e => e.t == "workAlert"), Is.False, "한 칸에 한 번만");
                if (S.cps.Count == 0) continue;   // 그 사이 청산됨 (드묾)
                Assert.That(g.peekOk());
                var full = ToWork(sd, "cafe", 0, out _);   // 같은 씨앗으로 폰을 안 본 판의 일당
                Go(full, "mgResult", "score", 0.8); double payFull = full.S.today.Last(l => l.kind == "work").amt;
                Go(g, "workPeek", "id", 0);
                Assert.That(S.cps.Count, Is.EqualTo(0), "몰래 폰 봄 = 정리");
                Assert.That(S.pending.peeks, Is.EqualTo(1));
                bool c = S.pending.caught;
                Go(g, "mgResult", "score", 0.8);
                double pay = S.today.Where(l => l.kind == "work").Sum(l => l.amt);
                if (c) { caught++; Assert.That(pay, Is.EqualTo(0), "들키면 그 칸 일당 0"); }
                else { clean++; Assert.That(pay, Is.EqualTo(MathK.Round1k(payFull * (1 - R.V4_PEEK_PAY))), "볼 때마다 일당이 깎임"); }
                ToHome(g); Assert.That(S.pending?.t, Is.EqualTo("home").Or.EqualTo("ending").Or.EqualTo("event"));
            }
            Assert.That(clean, Is.GreaterThanOrEqualTo(2)); Assert.That(caught, Is.GreaterThanOrEqualTo(1), "가끔 들킴");
        }
        /// 알바마다 폰 보기가 다름: 상하차는 일당이 센 대신 폰을 못 꺼냄. 알바 중 청산은 따로 셈 (도전과제)
        [Test]
        public void WareCannotPeekAndLiquidationAtWorkIsCounted()
        {
            var g = ToWork(5, "ware", 10, out _, 0.93); var S = g.S;
            Assert.That(g.peekRisk("ware"), Is.GreaterThanOrEqualTo(1)); Assert.That(g.peekRisk("cafe"), Is.LessThan(g.peekRisk("mart")));
            Assert.That(g.peekOk(), Is.False);
            Assert.That(g.Apply(C("workPeek", "id", 0)).Any(e => e.t == "error"), "상하차 중엔 폰을 못 봄");
            Assert.That(S.cps.Count, Is.EqualTo(1));
            S.mk.tk[S.cps[0].tk].p = S.cps[0].entry * 0.90;   // 청산선 밖
            Go(g, "workTick", "m", 1);
            Assert.That(S.cps.Count, Is.EqualTo(0)); Assert.That(S.liqWork, Is.GreaterThanOrEqualTo(1), "알바 중 청산 집계");
            var h = ToWork(5, "cafe", 1, out _, 0.3);   // 1배 현물은 알림 없음
            Assert.That(h.Apply(C("workTick", "m", 1)).Any(e => e.t == "workAlert"), Is.False);
        }

        // ---------- 하루 결과: 정산 · 밤의 미래 · 호감 버프 · 손님 정보 (docs/BLUEPRINT.md ⑥-5·6, 기둥 연결) ----------
        /// 아침부터 저녁 칸 시작까지 쉬어 넘김 → 그 사이 나온 이벤트 전부
        static List<SimEvent> ToEvening(GameSim g)
        {
            var all = new List<SimEvent>();
            for (int i = 0; i < 4 && g.S.slot < 2; i++) { all.AddRange(g.Apply(C("rest"))); if (g.S.pending != null && g.S.pending.t != "home" && g.S.pending.t != "event") ToHome(g); }
            return all;
        }
        /// ⑥-5·6: 저녁에 낮 결과를 한 번에 정산하고 (일당 · 매매 · 청산), 그 결과 4종에 따라 미래의 밤 대사가 다른 묶음에서 나옴
        [Test]
        public void EveningSettlesTheDayAndMiraiReactsToIt()
        {
            var R = Data.RULES;
            (GameSim g, List<SimEvent> ev) Day(System.Action<GameState> mut)
            {
                var g = New(7); mut(g.S);
                return (g, ToEvening(g));
            }
            string[] lines(string cls) => Data.SA("v4.night." + cls).ToArray();
            bool from(string line, string cls) => lines(cls).Any(t => { int i = t.IndexOf('{'); return line.StartsWith(i < 0 ? t : t.Substring(0, i)); });

            var (a, ea) = Day(S => { S.realized += R.V4_NIGHT_BIG * 2; });
            var st = ea.Single(e => e.t == "settle");
            Assert.That(st.Str("cls"), Is.EqualTo("jackpot")); Assert.That(st.Num("pnl"), Is.EqualTo(R.V4_NIGHT_BIG * 2));
            Assert.That(a.S.dayRes, Is.EqualTo("jackpot")); Assert.That(a.S.greed, Is.GreaterThanOrEqualTo(R.V4_NIGHT_GREED), "대박이면 미래 욕심이 오름");
            Assert.That(from(ea.Single(e => e.t == "night").Str("line"), "jackpot"), "대박 묶음");
            Assert.That(a.S.hl.t, Is.EqualTo(ea.Single(e => e.t == "night").Str("line")), "그날 밤 집 대사"); Assert.That(a.S.hl.T, Is.EqualTo(a.Tnow()));

            var (b, eb) = Day(S => { S.realized -= R.V4_NIGHT_LOSS * 2; });
            Assert.That(eb.Single(e => e.t == "settle").Str("cls"), Is.EqualTo("loss")); Assert.That(from(eb.Single(e => e.t == "night").Str("line"), "loss"));

            var (c, ec) = Day(S => { });
            Assert.That(ec.Any(e => e.t == "settle"), Is.False, "아무 일도 없던 날은 정산 카드 없음");
            Assert.That(from(ec.Single(e => e.t == "night").Str("line"), "normal"));

            var (d, ed) = Day(S => { S.st.liq += 1; S.realized -= 300000; });
            Assert.That(ed.Single(e => e.t == "settle").Str("cls"), Is.EqualTo("liq")); Assert.That(ed.Single(e => e.t == "settle").Num("liq"), Is.EqualTo(1));
            Assert.That(d.S.pending?.t, Is.EqualTo("event"), "청산당한 날 밤 장면");
            Assert.That(d.S.pending.evId, Is.EqualTo("v4_liqnight"));
            double aff = d.S.aff; Go(d, "evPick", "k", d.S.pending.opts[0].k);
            Assert.That(d.S.aff, Is.GreaterThan(aff), "위로받으면 호감↑");
            ToHome(d); Assert.That(d.S.pending.t, Is.EqualTo("home"), "하루 한 번만");
            // 손으로 넣은 수치 말고 진짜 청산도 '청산'으로 정산됨
            var q = New(7); var Q = q.S; Q.cash = 3000000;
            var qc = Data.TKList.First(t => t.IsCoin && q.tkOpen(t.id) && t.maxLev >= 25);
            Go(q, "watch"); Go(q, "open", "tk", qc.id, "dir", 1, "lev", 10, "amt", 500000);
            Q.mk.tk[qc.id].p = Q.cps[0].entry * 0.89; Go(q, "tick", "m", 1); Assert.That(Q.cps.Count, Is.EqualTo(0));
            Go(q, "watchEnd"); if (Q.pending.t != "home") ToHome(q);
            var eq2 = ToEvening(q); var sq = eq2.Single(e => e.t == "settle");
            Assert.That(sq.Str("cls"), Is.EqualTo("liq")); Assert.That(sq.Num("liq"), Is.EqualTo(1)); Assert.That(sq.Num("pnl"), Is.LessThan(0));
            // 알바한 날: 일당이 정산에 잡힘
            var w = ToWork(7, "cafe", 0, out _); Go(w, "mgResult", "score", 0.8); ToHome(w);
            var ew = ToEvening(w); var sw = ew.Single(e => e.t == "settle");
            Assert.That(sw.Num("wage"), Is.GreaterThan(0)); Assert.That(sw.Str("cls"), Is.EqualTo("normal")); Assert.That(sw.Num("net"), Is.EqualTo(sw.Num("wage") + sw.Num("pnl") + sw.Num("other")));
        }
        /// 기둥 연결: 호감 40 도시락(아침 스트레스 −) · 60 미래의 감(그날 첫 가짜 속보를 알아챔) · 80 응원(일당 +)
        [Test]
        public void AffectionTiersGiveBuffs()
        {
            var R = Data.RULES; var g = New(); var S = g.S; var A = R.V4_BUFF_AFF;
            Assert.That(A.Length, Is.EqualTo(3));
            S.aff = A[0] - 1; Assert.That(g.buffTier(), Is.EqualTo(0)); Assert.That(g.buffs(), Is.Empty);
            S.aff = A[0]; Assert.That(g.buffTier(), Is.EqualTo(1));
            S.aff = A[1]; Assert.That(g.buffTier(), Is.EqualTo(2));
            var job = Data.JOBS["cafe"]; S.aff = A[2] - 1; double p0 = g.jobPay(job, 0.5);
            S.aff = A[2]; Assert.That(g.buffTier(), Is.EqualTo(3)); Assert.That(g.buffs().Count, Is.EqualTo(3));
            Assert.That(g.jobPay(job, 0.5), Is.EqualTo(MathK.Round1k(p0 * R.V4_BUFF_CHEER)).Within(1000), "응원 = 일당 +10%");
            // 도시락: 다음 날 아침 알림
            S.aff = A[1] - 1; var ev = new List<SimEvent>();   // 밤사이 호감이 좀 깎여도(부탁·안 놀아 줌) 40 은 넘게
            for (int i = 0; i < 6 && S.day == 1; i++)
            {
                ev.AddRange(g.Apply(C("rest")));
                for (int k = 0; k < 10 && S.pending != null && S.pending.t != "home"; k++)
                {   // 사이에 끼는 장면도 이벤트를 모으며 넘김
                    var P = S.pending;
                    ev.AddRange(g.Apply(P.t == "event" ? C("evPick", "k", P.opts.First(o => !o.dis).k) : P.t == "menhera" || P.t == "impulse" ? C("reply", "i", P.opts.FindIndex(o => o.ok)) : P.t == "tempt" ? C("tempt", "k", "no") : C("pickRelic", "i", 0)));
                }
            }
            Assert.That(S.day, Is.EqualTo(2)); Assert.That(g.buffTier(), Is.GreaterThanOrEqualTo(1));
            Assert.That(ev.Any(e => e.t == "toast" && (e.Str("text") ?? "").Contains("도시락")), "아침에 도시락");
            // 미래의 감: 호감 60↑ 이면 그날 첫 속보에 대해 한 번 말해 줌 (쎄하다 / 괜찮다). 대체로 맞지만 가끔 틀림 → '말이 없으면 진짜'가 되지 않음
            int n = 0, right = 0;
            for (int sd = 1; sd <= 80; sd++)
            {
                var h = New(sd); var H = h.S; H.aff = A[1] + 5;
                var e1 = h.Apply(C("rest")); if (H.pending.t != "home") ToHome(h);
                if (H.slot != 1 || H.news == null || H.news.tk == "MKT") continue;
                var se = e1.SingleOrDefault(e => e.t == "sense"); Assert.That(se, Is.Not.Null, "그날 첫 속보엔 진짜든 가짜든 한마디");
                Assert.That(H.senseD, Is.EqualTo(h.absDay()));
                n++; if ((se["warn"] is bool w && w) == H.news.fake) right++;
                var e2 = h.Apply(C("rest"));
                Assert.That(e2.Any(e => e.t == "sense"), Is.False, "하루 한 번");
            }
            Assert.That(n, Is.GreaterThanOrEqualTo(20));
            Assert.That((double)right / n, Is.InRange(R.V4_SENSE_ACC - 0.2, 0.97), "대체로 맞음"); Assert.That(right, Is.LessThan(n), "가끔 틀림");
        }
        /// 기둥 연결: 알바를 잘하면 손님이 분석가 전적 한 건을 흘림 (읽을 거리가 알바에서 옴)
        [Test]
        public void GoodWorkShiftBringsAnalystInfo()
        {
            var R = Data.RULES;
            int total(GameSim x) => x.analysts().Sum(a => x.S.srcStat[a.id][1]);
            var g = ToWork(5, "cafe", 0, out _); int n0 = total(g);
            var ev = g.Apply(C("mgResult", "score", System.Math.Min(1, R.V4_WORK_INFO + 0.1)));
            Assert.That(total(g), Is.EqualTo(n0 + 1), "전적 +1건"); Assert.That(ev.Any(e => e.t == "workInfo"));
            var h = ToWork(5, "cafe", 0, out _); int m0 = total(h);
            Go(h, "mgResult", "score", System.Math.Max(0, R.V4_WORK_INFO - 0.2));
            Assert.That(total(h), Is.EqualTo(m0), "대충 하면 정보 없음");
        }

        // ---------- 독립 검토에서 나온 구멍들 (docs/PROGRESS.md) ----------
        /// 리포트 한 건을 상태에 직접 심음 (who = 분석가, 다음 칸 발표). withShock 이면 실제 게임처럼 그 칸 시세 계획에도 충격을 얹음
        static Tip Plant(GameSim g, string tk, int dir, bool real, double mag, bool withShock)
        {
            var S = g.S; int Tr = g.Tnow() + 1;
            var t = new Tip { id = S.gid++, who = g.analysts()[0].id, tier = "rep", tk = tk, dir = dir, mag = mag, T0 = g.Tnow(), Tr = Tr, Td = Tr, kind = real ? "real" : "anti", p0 = S.mk.tk[tk].p, res = "" };
            S.tips.Add(t);
            if (withShock)
            {
                if (!S.shocks.TryGetValue(Tr, out var o)) S.shocks[Tr] = o = new Dictionary<string, double>();
                o[tk] = (o.TryGetValue(tk, out var v) ? v : 0) + (real ? 1 : -1) * dir * mag;
            }
            return t;
        }
        /// 장 보기로 한 칸을 1분씩 흘리며: 발표가 뜬 순간마다 (리포트 id, 그 1분의 등락) · 발표 전 최저가/시가
        static List<(int id, double jump)> WatchSlot(GameSim g, string tk, out double preLow)
        {
            var S = g.S; var outp = new List<(int, double)>(); Go(g, "watch"); double so = S.mk.tk[tk].p, low = so; bool any = false;
            while (S.pending?.t == "watch")
            {
                double p0 = S.mk.tk[tk].p;
                var ev = g.Apply(C("tick", "m", 1));
                foreach (var e in ev.Where(e => e.t == "planEv" && e.Str("k") == "report" && e.Str("tk") == tk)) { outp.Add(((int)e.Num("id"), S.mk.tk[tk].p / p0 - 1)); any = true; }
                if (!any) low = System.Math.Min(low, S.mk.tk[tk].p);
            }
            preLow = low / so;
            return outp;
        }
        /// 같은 종목·같은 칸에 발표가 둘이면 각자 자기 순간에 따로 뜀 (상쇄돼서 둘 다 "적중"인데 시세는 제자리가 되지 않게)
        [Test]
        public void TwoReportsOnOneTickerLandAsSeparateGaps()
        {
            var g = New(4); var S = g.S; string tk = "BTK";
            var a = Plant(g, tk, +1, true, 0.12, true); var b = Plant(g, tk, -1, true, 0.12, true);   // ▲ 적중 + ▼ 적중
            Go(g, "rest"); ToHome(g);
            var J = WatchSlot(g, tk, out _);
            Assert.That(J.Count, Is.EqualTo(2), "발표 두 번");
            Assert.That(J.Single(x => x.id == a.id).jump, Is.GreaterThan(0.07), "▲ 발표는 위로 갭");
            Assert.That(J.Single(x => x.id == b.id).jump, Is.LessThan(-0.07), "▼ 발표는 아래로 갭");
            ToHome(g);
            Assert.That(a.res, Is.EqualTo("hit")); Assert.That(b.res, Is.EqualTo("hit"));
        }
        /// 가격제한에 걸린 주식: 호재 발표인데 발표 전에 먼저 크게 빠졌다가 튀는 일이 없어야 함 (갭 크기를 제한 적용 뒤 값으로)
        [Test]
        public void StockAtPriceLimitDoesNotDipBeforeAGoodAnnouncement()
        {
            var g = New(4); var S = g.S; var stk = Data.TKList.First(t => t.IsStock && !t.inv && g.tkOpen(t.id) && t.vol <= 0.012);
            Plant(g, stk.id, +1, true, 0.12, true);
            Go(g, "rest"); ToHome(g);
            Assert.That(S.slot, Is.EqualTo(1)); Assert.That(g.weekend(), Is.False);
            S.mk.tk[stk.id].ref0 = S.mk.tk[stk.id].p / 1.26;   // 이미 +26% (상한 +30% 바로 밑)
            var J = WatchSlot(g, stk.id, out double preLow);
            Assert.That(J.Count, Is.EqualTo(1));
            Assert.That(preLow, Is.GreaterThan(0.95), "발표 전에 반대로 크게 밀리지 않음");
            Assert.That(J[0].jump, Is.InRange(0.0, 0.06), "상한까지만 갭");
        }
        /// 갭이 청산선을 넘으면 예약 손절이 아니라 청산으로 처리 (손절을 걸었다고 더 잃지 않게)
        [Test]
        public void StopDoesNotPreemptLiquidationBeyondTheLiqLine()
        {
            var g = New(5); var S = g.S; S.cash = 3000000;
            var coin = Data.TKList.First(t => t.IsCoin && g.tkOpen(t.id) && t.maxLev >= 25);
            Go(g, "watch");
            Go(g, "open", "tk", coin.id, "dir", 1, "lev", 10, "amt", 500000, "sl", 0.3);
            var c = S.cps.Single(); double liq0 = S.st.liq;
            S.mk.tk[coin.id].p = c.entry * 0.88;   // 10배 × −12% = 증거금 −120% (청산선 밖)
            var ev = g.Apply(C("tick", "m", 1));
            Assert.That(S.cps.Count, Is.EqualTo(0));
            Assert.That(ev.Any(e => e.t == "stop"), Is.False, "손절로 처리되지 않음");
            Assert.That(S.st.liq, Is.EqualTo(liq0 + 1), "청산으로 처리");
        }
        /// 2부 판돈은 순자산(현금 + 보유) 기준: 현금만 비워 두고 또 받을 수 없음. 카톡 금액 = 실제로 넣어 준 돈
        [Test]
        public void Part2SeedIsByEquityNotCash()
        {
            var R = Data.RULES; var g = New(); var S = g.S; S.cash = 3000000;
            var coin = Data.TKList.First(t => t.IsCoin && g.tkOpen(t.id));
            Go(g, "open", "tk", coin.id, "dir", 1, "lev", 1, "amt", 1000000);
            double eq = S.cash + g.holdVal(); Assert.That(eq, Is.LessThan(R.V4_P2_CASH));
            g.p2Seed();
            Assert.That(S.cash + g.holdVal(), Is.EqualTo(R.V4_P2_CASH).Within(1), "모자란 만큼만 채움");
            double c1 = S.cash; g.p2Seed(); Assert.That(S.cash, Is.EqualTo(c1), "이미 넘으면 안 줌");
        }
        /// 사나운 코인의 발표 폭은 그 코인 변동성만큼 큼 (잡음에 묻히지 않게)
        [Test]
        public void CoinAnnouncementSizeScalesWithItsVolatility()
        {
            var R = Data.RULES; double baseMax = 0, wildMin = 9; int wild = 0, calm = 0;
            for (int sd = 1; sd <= 12; sd++)
            {
                var g = New(sd); var S = g.S; S.month = 3; S.day = 2; Go(g, "watch");   // 3주차: 코인이 다 상장된 뒤
                for (int i = 0; i < 3; i++) { var ev = g.Apply(C("report", "paid", false)); if (ev.Any(e => e.t == "error")) break; }
                foreach (var t in S.tips.Where(t => g.srcOf(t).an && Data.TK[t.tk].IsCoin))
                {
                    double ratio = System.Math.Min(R.V4_AN_VOLX, System.Math.Max(1, Data.TK[t.tk].vol / R.V4_AN_VOL0));
                    Assert.That(t.mag, Is.InRange(0.099 * R.V4_AN_COIN * ratio, System.Math.Min(0.6, 0.151 * R.V4_AN_COIN * ratio)));
                    if (ratio > 1.5) { wild++; wildMin = System.Math.Min(wildMin, t.mag); } else { calm++; baseMax = System.Math.Max(baseMax, t.mag); }
                }
            }
            Assert.That(calm, Is.GreaterThan(0)); Assert.That(wild, Is.GreaterThan(0));
            Assert.That(wildMin, Is.GreaterThan(baseMax), "사나운 코인 쪽이 늘 더 큼");
        }
        /// 루프 재설계 전 저장 호환: 없어진 경보 화면에서 저장한 판은 이어지고, 하루 기준점이 없는 판은 그날 정산을 건너뜀
        [Test]
        public void OldSavesKeepWorking()
        {
            var g = ToWork(5, "cafe", 0, out _); var S = g.S;
            Go(g, "mgResult", "score", 0.8);
            // 예전 빌드라면 여기서 경보 화면(pending liqAlert)이 끼어들 수 있었음 → 그 상태로 저장했다고 치고 불러옴
            S.flow.Clear(); S.pending = new Pending("liqAlert"); S.owe = 30;
            g.EnableRt();
            Assert.That(S.pending?.t, Is.EqualTo("home").Or.EqualTo("event").Or.EqualTo("menhera").Or.EqualTo("impulse"), "막히지 않고 이어짐");
            // 기준점 없는 옛 저장 (청산 이력 있음): 그날 저녁에 가짜 '청산' 정산이 안 나옴
            var h = New(7); var H = h.S; H.st.liq = 3; H.realized = 5000000; H.dayBase = 0; H.dayReal0 = 0; H.dayLiq0 = 0;
            var ev = ToEvening(h);
            Assert.That(ev.Any(e => e.t == "settle"), Is.False); Assert.That(H.pending.t, Is.EqualTo("home")); Assert.That(H.dayRes, Is.Null);
        }

        /// 밸런스 범위 (판 수 적게, 범위 넓게 — 정확한 값은 docs/V4.md §7 300판). 루프 기준 (BLUEPRINT ⑥): 전적을 읽는 사람 > 전부 따라 타는 사람 · 알바만으론 못 깸 · 장만 봐선 못 이김 · 포지션 들고 알바 감
        [Test]
        public void BalanceBandsHold()
        {
            RtBots.Summary Sum(string st) => RtBots.Summarize(Data, st, 40, 1, 40);
            var pro = Sum("pro"); var work = Sum("work"); var gamble = Sum("gamble"); var casual = Sum("casual"); var blind = Sum("proall"); var trader = Sum("trader");
            foreach (var x in new[] { pro, casual, blind, trader, work, gamble }) TestContext.WriteLine(x);
            Assert.That(pro.clear, Is.InRange(0.15, 0.7), "잘하는 사람은 꽤 깸");
            Assert.That(casual.clear, Is.LessThanOrEqualTo(0.35), "보통 사람은 가끔");
            Assert.That(work.clear, Is.EqualTo(0), "알바만으론 못 깸");
            Assert.That(gamble.bad, Is.GreaterThanOrEqualTo(0.75), "도박 몰빵은 대부분 망함");
            Assert.That(pro.errs + work.errs + gamble.errs + casual.errs + blind.errs + trader.errs, Is.EqualTo(0));
            foreach (var a in new[] { "watch", "work", "date" }) Assert.That(pro.acts.TryGetValue(a, out var v) ? v : 0, Is.GreaterThan(0.1), $"pro 가 {a} 를 씀 (죽은 선택지 없음)");
            // ⑥-10: 리포트를 전부 따라 타면 남는 게 없고 (답안지 아님), 전적을 읽으면 번다
            double tipPro = pro.pnl.TryGetValue("tip", out var tp) ? tp : 0, tipBlind = blind.pnl.TryGetValue("tip", out var tb) ? tb : 0;
            Assert.That(tipBlind, Is.LessThan(4000000), "전부 따라 타기는 엔진이 못 됨");
            Assert.That(tipPro, Is.GreaterThan(tipBlind + 3000000), "전적을 읽는 쪽이 뚜렷이 더 범");
            Assert.That(pro.clear, Is.GreaterThan(blind.clear), "읽는 사람이 더 자주 깸");
            Assert.That(pro.tipFade, Is.GreaterThan(0.1), "거꾸로 타는 것도 실력 (꼴찌 분석가)"); Assert.That(pro.tipSkip, Is.GreaterThan(0.05), "거를 줄도 앎");
            // 장만 보는 사람이 알바 병행을 못 이김 (하루 종일 장 보기가 정답이 아니게)
            Assert.That(trader.clear, Is.LessThan(pro.clear));
            // ⑥-11: 제목의 장면 — 레버리지 포지션을 들고 알바 감
            Assert.That(pro.workHeld, Is.GreaterThanOrEqualTo(5)); Assert.That(casual.workHeld, Is.GreaterThanOrEqualTo(3));
            // ⑥-13·15: 대출 없이도 깸 · 원금이 첫 주부터 줄어듦
            Assert.That(pro.noLoanClear, Is.GreaterThanOrEqualTo(0.3)); Assert.That(pro.firstRepay, Is.LessThanOrEqualTo(7));
        }

        // ---------- 화면 계약 (docs/UIUX.md) ----------
        /// UIUX #13: 정산 카드의 숫자가 실제 현금 변화와 맞아떨어짐 — 그 밖 = 일당·매매 말고 오늘 벌거나 쓴 돈만 (이자·대출·상환은 '옮긴 돈'), 아침 기준점 전의 돈은 두 번 세지 않음
        [Test]
        public void SettleCardAddsUpToTheCashChange()
        {
            double fee = Data.RULES.RT_RSCH_FEE;
            // (1) 실제 경로로: 낮에 유료 리포트를 사고(쓴 돈) 은행에서 이자를 미리 냄(옮긴 돈)
            var g = New(7); var S = g.S; double c0 = S.cash;
            Assert.That(S.dayCash0, Is.EqualTo(c0), "아침 현금 기준점"); Assert.That(S.dayLed0, Is.EqualTo(S.today.Count));
            Go(g, "watch"); Go(g, "report", "paid", true, "who", g.analysts().Last().id); Go(g, "watchEnd"); ToHome(g);
            double intr = g.interestDue();
            Go(g, "map"); Go(g, "goTo", "loc", "bank");
            if (S.pending.t == "encounter") Go(g, "encounter", "ask", false);
            var ev = Go(g, "act", "k", "l-payint"); if (S.pending.t != "home") ToHome(g);
            Assert.That(S.paidMonth, Is.EqualTo(S.month), "이자를 미리 냄");
            ev.AddRange(ToEvening(g));
            var st = ev.Single(e => e.t == "settle");
            Assert.That(st.Num("other"), Is.EqualTo(-fee), "유료 리포트만 '그 밖' (이자는 아님)");
            Assert.That(st.Num("net"), Is.EqualTo(st.Num("wage") + st.Num("pnl") - fee));
            Assert.That(st.Num("cash0"), Is.EqualTo(c0)); Assert.That(st.Num("cash"), Is.EqualTo(S.cash));
            Assert.That(st.Num("move"), Is.EqualTo(-intr).Within(1e-6), "이자는 번 것도 쓴 것도 아니라 옮긴 돈");
            Assert.That(st.Num("due"), Is.EqualTo(g.gateDue())); Assert.That(st.Num("gap"), Is.EqualTo(System.Math.Max(0, g.gateDue() - S.cash)));
            Assert.That(st.Num("dd"), Is.EqualTo(g.gateDays())); Assert.That(g.gateDays(), Is.EqualTo(Data.RULES.MONTH_DAYS - S.day));
            Assert.That(g.equity(), Is.EqualTo(S.cash + g.holdVal()));

            // (2) 아침 사건으로 들어온 돈은 아침 현금에 이미 들어 있음 → '그 밖'에 또 세지 않음
            bool sawMorning = false;
            for (int sd = 1; sd <= 40 && !sawMorning; sd++)
            {
                var h = New(sd); var H = h.S;
                ToEvening(h); Go(h, "rest"); if (H.pending.t != "home") ToHome(h);   // 다음 날 아침
                if (h.absDay() != 2 || H.dayLed0 == 0) continue;   // 아침 기준점 전에 장부가 있는 날 (아침 사건 · 배당 · 선물)
                double early = H.today.Take(H.dayLed0).Sum(x => x.amt); if (early == 0) continue;
                sawMorning = true;
                Go(h, "watch"); Go(h, "report", "paid", true, "who", h.analysts().Last().id); Go(h, "watchEnd"); ToHome(h);
                var s2 = ToEvening(h).Single(e => e.t == "settle");
                string[] skip = { "work", "invest", "debt", "loan", "repay", "interest" };
                double after = H.today.Skip(H.dayLed0).Where(x => !skip.Contains(x.kind)).Sum(x => x.amt);
                Assert.That(s2.Num("other"), Is.EqualTo(after).Within(1e-6), $"씨앗 {sd}: 아침 기준점 뒤의 장부만 셈");
                Assert.That(s2.Num("move"), Is.EqualTo(0).Within(1e-6), $"씨앗 {sd}: 아침 사건 돈({early})을 두 번 세면 여기가 어긋남");
            }
            Assert.That(sawMorning, "아침에 돈이 들어온 날을 한 번은 봄");

            // (3) 옛 저장(아침 현금 기준점 없음): 아침 현금을 모른다고 알려 줌
            var o = New(7); o.S.dayCash0 = -1; o.S.cash -= fee; o.S.today.Add(new Ledger { kind = "ev", amt = -fee, label = "유료 리포트" });
            var s3 = ToEvening(o).Single(e => e.t == "settle");
            Assert.That(s3.Num("cash0"), Is.EqualTo(-1)); Assert.That(s3.Num("move"), Is.EqualTo(0));
        }
        /// UIUX #24: 알바 설명 카드에서 다른 알바를 고르러 돌아갈 수 있고 (칸을 안 씀), 시작한 뒤에는 못 돌아감
        [Test]
        public void WorkCanBeCancelledBeforeItStarts()
        {
            var g = New(5); var S = g.S; int t0 = g.Tnow(), m0 = S.min;
            Go(g, "map"); Go(g, "goTo", "loc", "work");
            if (S.pending.t == "encounter") Go(g, "encounter", "ask", false);
            uint rng0 = S.rng;
            Go(g, "act", "k", "l-ware");
            Assert.That(S.pending.t, Is.EqualTo("work")); Assert.That(S.pending.setup, Is.Null);
            Go(g, "workBack");
            Assert.That(S.pending.t, Is.EqualTo("loc")); Assert.That(S.pending.key, Is.EqualTo("work"));
            Assert.That(g.Tnow(), Is.EqualTo(t0), "칸을 안 씀"); Assert.That(S.min, Is.EqualTo(m0));
            Assert.That(S.rng, Is.EqualTo(rng0), "들락거려도 난수가 안 밀림");
            Go(g, "act", "k", "l-cafe"); Assert.That(S.pending.key, Is.EqualTo("cafe"), "다른 알바를 고름");
            Go(g, "mgSetup");
            Assert.That(g.Apply(C("workBack")).Any(e => e.t == "error"), "시작한 알바는 취소 못 함");
        }
        /// UIUX #16: 발표·예약 체결을 배너로 띄울 수 있게 사건에 종목 이름 · 분석가 · 방향 · 보유 여부가 실려 옴
        [Test]
        public void AnnouncementAndStopEventsCarryBannerFields()
        {
            bool sawReport = false;
            for (int sd = 1; sd <= 12 && !sawReport; sd++)
            {
                var g = New(sd); var S = g.S; S.cash = 5000000;
                Go(g, "watch"); Go(g, "report", "paid", false);
                var t = S.tips.Last(); if (!Data.TK[t.tk].IsCoin) continue;
                Go(g, "open", "tk", t.tk, "dir", t.dir, "lev", 1, "amt", 100000);
                Go(g, "watchEnd"); ToHome(g);
                for (int guard = 0; guard < 8 && !sawReport && string.IsNullOrEmpty(t.res); guard++)
                {
                    if (g.Tnow() < t.Tr) { Go(g, "rest"); ToHome(g); continue; }
                    Go(g, "watch");
                    while (S.pending?.t == "watch" && !sawReport)
                    {
                        bool held = S.cps.Any(c => c.tk == t.tk); double p0 = S.mk.tk[t.tk].p;
                        var e = g.Apply(C("tick", "m", 1)).FirstOrDefault(x => x.t == "planEv" && x.Str("k") == "report" && x.Str("tk") == t.tk);
                        if (e == null) continue;
                        sawReport = true;
                        Assert.That(e.Str("n"), Is.EqualTo(Data.TK[t.tk].name)); Assert.That(e.Str("who"), Is.EqualTo(Data.SRC[t.who].name));
                        Assert.That((bool)e["up"], Is.EqualTo(S.mk.tk[t.tk].p > p0), "실제로 간 방향");
                        Assert.That((bool)e["hold"], Is.EqualTo(held));
                    }
                    if (S.pending?.t == "watch") Go(g, "watchEnd");
                    ToHome(g);
                }
            }
            Assert.That(sawReport, "발표 사건을 한 번은 봄");

            var h = New(5); var H = h.S; H.cash = 3000000;
            var coin = Data.TKList.First(x => x.IsCoin && h.tkOpen(x.id) && x.maxLev >= 5 && !x.meme);
            Go(h, "watch"); Go(h, "open", "tk", coin.id, "dir", 1, "lev", 5, "amt", 500000, "sl", 0.3);
            H.mk.tk[coin.id].p = H.cps[0].entry * 0.92;
            var sf = g_tick(h).FirstOrDefault(x => x.t == "stopFill");
            Assert.That(sf, Is.Not.Null, "예약 체결 사건"); Assert.That(sf.Str("n"), Is.EqualTo(coin.name)); Assert.That((bool)sf["tp"], Is.False); Assert.That(sf.Num("pnl"), Is.LessThan(0));
        }
        static List<SimEvent> g_tick(GameSim g) => g.Apply(C("tick", "m", 1));
        /// UIUX #27 · #8 · #7: 1부 첫날엔 돌발 이벤트가 없고(둘째 날부터는 뜸), v4 화면 문구에 체력이 안 나오며, 수치 이름은 스트레스 하나
        [Test]
        public void DayOneHasNoRandomEventAndTextUsesV4Terms()
        {
            int later = 0;
            for (int sd = 1; sd <= 30; sd++)
            {
                var g = GameSim.Create(Data, sd, new GameSim.Opts { rt = true }); var S = g.S;
                Go(g, "start");
                for (int i = 0; i < 60 && g.absDay() <= 3 && S.pending != null && S.pending.t != "ending"; i++)
                {
                    var P = S.pending;
                    switch (P.t)
                    {
                        case "event":
                            if (g.absDay() <= 1) Assert.That(P.evId, Does.StartWith("v4_"), $"씨앗 {sd}: 첫날 돌발 이벤트 {P.evId}");
                            else if (!P.evId.StartsWith("v4_")) later++;
                            Go(g, "evPick", "k", P.opts.First(o => !o.dis).k); break;
                        case "relic": Go(g, "pickRelic", "i", 0); break;
                        case "home": Go(g, "rest"); break;
                        case "menhera": case "impulse": Go(g, "reply", "i", P.opts.FindIndex(o => o.ok)); break;
                        case "tempt": Go(g, "tempt", "k", "no"); break;
                        default: Assert.Fail($"씨앗 {sd}: 모르는 대기 상태 {P.t}"); break;
                    }
                }
                Assert.That(g.absDay(), Is.GreaterThan(1), $"씨앗 {sd}: 첫날을 끝까지 지남");
            }
            Assert.That(later, Is.GreaterThan(0), "둘째·셋째 날엔 돌발 이벤트가 뜸 (검사가 실제로 이벤트를 볼 수 있다는 대조군)");
            // 2부 첫날은 예외가 아님 · 턴 모드도 그대로 (규칙 분기 확인)
            var q = New(3);
            foreach (var o in q.Query(() => q.locOpts("park"))) { Assert.That(o.sub ?? "", Does.Not.Contain("체력")); Assert.That(o.sub ?? "", Does.Not.Contain("멘탈")); }
            Assert.That(Data.S("v4.res.hit"), Does.Contain("적중")); Assert.That(Data.S("v4.res.miss"), Does.Contain("빗나감"));
            Assert.That(q.noHpText("체력 -4 · 멘탈 회복"), Is.EqualTo("스트레스 ↓"));
            Assert.That(q.noHpText("멘탈 크게 회복"), Is.EqualTo("스트레스 크게 ↓")); Assert.That(q.noHpText("멘탈 완전 회복"), Is.EqualTo("스트레스 크게 ↓"));
            Assert.That(q.noHpText("1.5만 원 · 체력 -5"), Is.EqualTo("1.5만 원")); Assert.That(q.noHpText(null), Is.Null);
            var turn = GameSim.Create(Data, 3, new GameSim.Opts { rt = false });
            Assert.That(turn.noHpText("체력 -4 · 멘탈 회복"), Is.EqualTo("체력 -4 · 멘탈 회복"), "턴 모드 문구는 그대로");
            // UIUX #3: 만 단위 표기 — v4 는 100만 미만이면 소수 한 자리까지 (1.5만이 2만으로 보이지 않게), 턴 모드는 그대로
            Assert.That(q.man(15000), Is.EqualTo("1.5만")); Assert.That(q.man(180000), Is.EqualTo("18만")); Assert.That(q.man(187000), Is.EqualTo("18.7만"));
            Assert.That(q.man(2345000), Is.EqualTo("235만")); Assert.That(q.man(6000), Is.EqualTo("6,000")); Assert.That(turn.man(15000), Is.EqualTo("2만"));
        }
        /// 사용자 결정(11-11): 패시브 아이템은 '유물'. '유품'·'부모님 유품'은 미래가 가족을 다 잃은 것처럼 읽혀서 안 씀 (BLUEPRINT_V3 ⑥-19-4)
        [Test]
        public void RelicsAreNeverCalledKeepsakes()
        {
            string dir = System.IO.Path.Combine(UnityEngine.Application.dataPath, "Resources", "Data");
            var files = System.IO.Directory.GetFiles(dir, "*.json");
            Assert.That(files.Length, Is.GreaterThan(10));
            foreach (var f in files) Assert.That(System.IO.File.ReadAllText(f), Does.Not.Contain("유" + "품"), System.IO.Path.GetFileName(f));
            foreach (var f in System.IO.Directory.GetFiles(System.IO.Path.Combine(UnityEngine.Application.dataPath, "Scripts"), "*.cs", System.IO.SearchOption.AllDirectories))
                Assert.That(System.IO.File.ReadAllText(f), Does.Not.Contain("유" + "품"), System.IO.Path.GetFileName(f));
            Assert.That(Data.S("aug.reasonStart"), Does.Contain("유물"));
        }

        // ---------- 작전주 (docs/BLUEPRINT_V3.md ⑥-1~10). 화면이 붙기 전이라 데이터에선 꺼 둠(V4_OP 0) → 테스트에서만 켬 ----------
        static void OpOn(System.Action body) { double v0 = Data.RULES.V4_OP; Data.RULES.V4_OP = 1; try { body(); } finally { Data.RULES.V4_OP = v0; } }
        /// 한 칸 쉬고 집으로 (시세는 그 칸만큼 흐름)
        static void RestSlot(GameSim g) { if (g.S.pending?.t == "home") Go(g, "rest"); if (g.S.pending != null && g.S.pending.t != "home" && g.S.pending.t != "ending") ToHome(g); }
        /// ⑥-1·2: 1주차엔 작전이 없고, 2주차부터 그 주에 상장된 후보 주식 하나에 매집 → 끌어올리기 → (설거지 | 식음)이 순서대로. 매집 구간은 거래량이 평소의 2배 이상
        [Test]
        public void OperationsStartInWeekTwoAndRunInOrder() => OpOn(() =>
        {
            var R = Data.RULES; int seenPump = 0, seenEnd = 0;
            for (int sd = 1; sd <= 6; sd++)
            {
                var g = New(sd); var S = g.S; var maxPh = new Dictionary<string, int>(); double accVol = 0; int accN = 0;
                for (int i = 0; i < 3 * 14 && S.pending?.t != "ending" && g.absDay() <= 14; i++)
                {
                    if (S.month == 1) Assert.That(S.ops, Is.Empty, $"씨앗 {sd}: 1주차엔 작전 없음");
                    foreach (var o in S.ops)
                    {
                        Assert.That(R.V4_OP_TK, Does.Contain(o.tk)); Assert.That(Data.TK[o.tk].IsStock && !Data.TK[o.tk].inv); Assert.That(g.absDay(), Is.GreaterThanOrEqualTo(Data.TK[o.tk].day), "상장된 종목만");
                        int p0 = maxPh.TryGetValue(o.tk, out var q) ? q : 0; Assert.That(o.ph, Is.GreaterThanOrEqualTo(p0), $"씨앗 {sd}: 단계는 뒤로 안 감 ({p0}→{o.ph})"); maxPh[o.tk] = o.ph;
                        if (o.ph == 1 && g.stockOpen()) { accVol += g.volAvg(o.tk, 3); accN++; }
                        if (o.ph == 2) { seenPump++; Assert.That(o.heat, Is.LessThanOrEqualTo(o.cap + 1e-9), "열기는 상한을 안 넘음"); }
                        if (o.ph >= 3) seenEnd++;
                    }
                    RestSlot(g);
                }
                if (S.pending?.t != "ending") Assert.That(maxPh.Count, Is.GreaterThanOrEqualTo(1), $"씨앗 {sd}: 2주차에 작전이 하나는 있음");
                if (accN > 0) Assert.That(accVol / accN, Is.GreaterThanOrEqualTo(1.6), $"씨앗 {sd}: 매집 구간 거래량");
            }
            Assert.That(seenPump, Is.GreaterThan(0)); Assert.That(seenEnd, Is.GreaterThan(0), "끌어올린 작전은 설거지나 식음으로 끝남");
        });
        /// ⑥-3: 설거지 확률은 열기 25 이하에서 0 이고 그 위로 계속 커짐 (위험이 0 인 문턱이 60 같은 높은 곳에 없음)
        [Test]
        public void DumpHazardRisesContinuouslyWithHeat() => OpOn(() =>
        {
            var g = New(3); var R = Data.RULES;
            Assert.That(g.opHazard(R.V4_OP_HZ0), Is.EqualTo(0)); Assert.That(g.opHazard(R.V4_OP_HZ0 + 5), Is.GreaterThan(0));
            double prev = 0; for (int h = 30; h <= 100; h += 10) { double z = g.opHazard(h); Assert.That(z, Is.GreaterThan(prev), $"열기 {h}"); prev = z; }
            Assert.That(g.opHazard(100), Is.EqualTo(R.V4_OP_HZ).Within(1e-9)); Assert.That(g.opHazard(55), Is.LessThan(0.03), "중간 온도에선 아직 낮음");
        });
        /// ⑥-4·5·7·10: 설거지당한 주식은 그날 안 팔리고(관문 급매 포함) 다음 거래일에 풀림 · 큰 주문일수록 값이 나빠짐(나눠 팔면 더 받음) · 알바 중 몰래 폰으로 주식을 팔 수 있음 · 끌어올리는 종목은 분석가·속보에서 빠짐
        [Test]
        public void DumpLocksTheStockAndBigOrdersSlip() => OpOn(() =>
        {
            var R = Data.RULES; bool sawDump = false, sawSlip = false;
            for (int sd = 1; sd <= 30 && !(sawDump && sawSlip); sd++)
            {
                var g = New(sd); var S = g.S;
                for (int i = 0; i < 3 * 20 && S.pending?.t == "home" && g.absDay() <= 20 && !(sawDump && sawSlip); i++)
                {
                    var live = S.ops.FirstOrDefault(o => o.ph == 2);
                    if (live != null && !sawSlip && S.slot <= 1 && !g.weekend())
                    {   // 끌어올리는 중: 분석가 후보에서 빠지고, 미끄러짐은 주문 크기에 비례
                        Go(g, "watch"); while (S.pending?.t == "watch" && !g.stockOpen()) g.Apply(C("tick", "m", 10));
                        if (S.pending?.t == "watch" && live.ph == 2)
                        {
                            Assert.That(g.anTickers(), Does.Not.Contain(live.tk), "끌어올리는 종목은 분석가가 안 다룸");
                            double s1 = g.opSlip(live.tk, 2e6, true), s2 = g.opSlip(live.tk, 2e7, true);
                            Assert.That(s1, Is.GreaterThan(0)); Assert.That(s2, Is.GreaterThan(s1)); Assert.That(s2, Is.LessThanOrEqualTo(R.V4_OP_SLIP_MAX + 1e-9));
                            Assert.That(2e7 * (1 - s2), Is.LessThan(2 * 1e7 * (1 - g.opSlip(live.tk, 1e7, true))), "두 봉에 나눠 팔면 더 받음");
                            S.cash = 5000000; double c0 = S.cash; Go(g, "buy", "tk", live.tk, "amt", 2000000, "where", "app");
                            var h = S.hold.Get(live.tk); Assert.That(h, Is.Not.Null); Assert.That(h.q * S.mk.tk[live.tk].p, Is.LessThan(2000000 * (1 - s1 * 0.9)), "산 만큼 못 받음 (미끄러짐)");
                            sawSlip = true;
                        }
                        if (S.pending?.t == "watch") Go(g, "watchEnd"); if (S.pending?.t != "home") ToHome(g);
                        continue;
                    }
                    var lk = S.ops.FirstOrDefault(o => o.ph == 4 && g.opLocked(o.tk));
                    if (lk != null && !sawDump)
                    {
                        sawDump = true; var s = S.mk.tk[lk.tk];
                        Assert.That(g.limitDn(lk.tk), "하한가에 붙음"); Assert.That(g.sellLockWhy(lk.tk), Is.Not.Null);
                        S.hold.Set(lk.tk, new Holding { q = 10, cost = s.p * 10, t0 = g.Tnow(), bday = g.absDay() });
                        Assert.That(g.Query(() => g.opOf(lk.tk) != null));
                        int day = g.absDay(); double px = s.p;
                        // 잠긴 날: 장 보기에서도, 관문 급매 경로(closeAll)에서도 안 팔림
                        if (S.slot <= 1 && !g.weekend()) { Go(g, "watch"); while (S.pending?.t == "watch" && !g.stockOpen() && S.min < R.RT_STOCK[1]) g.Apply(C("tick", "m", 10)); if (S.pending?.t == "watch" && g.stockOpen()) { var ev = g.Apply(C("sell", "tk", lk.tk, "frac", 1, "where", "app")); Assert.That(S.hold.Has(lk.tk), "잠긴 날엔 안 팔림"); Assert.That(s.p, Is.EqualTo(px).Within(px * 0.002), "하한가에 고정"); } if (S.pending?.t == "watch") Go(g, "watchEnd"); if (S.pending?.t != "home") ToHome(g); }
                        // 다음 거래일: 갭으로 내려 시작하고 팔림
                        for (int j = 0; j < 12 && S.pending?.t == "home" && !(g.absDay() >= lk.lockDay && S.slot == 0); j++) RestSlot(g);
                        if (S.pending?.t == "home" && g.absDay() == lk.lockDay && S.hold.Has(lk.tk))
                        {
                            Assert.That(g.opLocked(lk.tk), Is.False, "다음 거래일에 풀림");
                            Go(g, "watch"); while (S.pending?.t == "watch" && S.min < R.RT_STOCK[0] + 30) g.Apply(C("tick", "m", 10));
                            if (S.pending?.t == "watch") { Assert.That(s.p, Is.LessThan(px * 0.95), "풀리는 날 갭으로 한 번 더 내림"); Go(g, "sell", "tk", lk.tk, "frac", 1, "where", "app"); Assert.That(S.hold.Has(lk.tk), Is.False, "풀린 뒤엔 팔림"); Go(g, "watchEnd"); }
                            if (S.pending?.t != "home") ToHome(g);
                        }
                        continue;
                    }
                    RestSlot(g);
                }
            }
            Assert.That(sawSlip, "끌어올리는 작전을 한 번은 봄"); Assert.That(sawDump, "설거지를 한 번은 봄");

            // 알바 중 몰래 폰으로 주식을 팖 (장이 열려 있을 때)
            var w = New(5); var W = w.S; W.cash = 2000000;
            Go(w, "watch"); while (W.pending?.t == "watch" && !w.stockOpen()) w.Apply(C("tick", "m", 10));
            var stk = Data.TKList.First(t => t.IsStock && !t.inv && w.tkOpen(t.id)); Go(w, "buy", "tk", stk.id, "amt", 500000, "where", "app"); Assert.That(W.hold.Has(stk.id));
            Go(w, "watchEnd"); if (W.pending?.t != "home") ToHome(w);
            Assert.That(W.slot, Is.EqualTo(1), "오후 칸 (장중)");
            Go(w, "map"); Go(w, "goTo", "loc", "work"); if (W.pending.t == "encounter") Go(w, "encounter", "ask", false);
            Go(w, "act", "k", "l-cafe"); Go(w, "mgSetup");
            Go(w, "workPeek", "tk", stk.id);
            Assert.That(W.hold.Has(stk.id), Is.False, "몰래 폰으로 주식 정리"); Assert.That(W.pending.peeks, Is.EqualTo(1));
        });
    }
}
