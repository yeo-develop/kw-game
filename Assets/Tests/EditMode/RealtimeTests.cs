using System.Collections.Generic;
using System.IO;
using System.Linq;
using KwGame.Sim;
using NUnit.Framework;
using UnityEngine;

namespace KwGame.Tests
{
    // 실시간 모드 (GameSim.Realtime.cs): 시간이 흐르고 분 단위 시세 · 가격제한 · 실시간 청산 · 상장폐지
    public class RealtimeTests
    {
        static GameData _data;
        static GameData Data => _data ??= GameData.Load(Directory.GetFiles(Path.Combine(Application.dataPath, "Resources/Data"), "*.json").Where(f => Path.GetFileName(f) != "unity_v4.json")   // v4 이전 실시간 규칙 (v4 는 V4Tests)

            .Select(f => new KeyValuePair<string, string>(Path.GetFileName(f), File.ReadAllText(f))));

        static SimCommand C(string t, params object[] kv) => new SimCommand(t, kv);

        static SimCommand Respond(GameSim g, System.Random r)
        {
            var S = g.S; var P = S.pending; var D = g.D;
            switch (P.t)
            {
                case "relic": return C("pickRelic", "i", 0);
                case "home":
                    {
                        double x = r.NextDouble();
                        if (x < 0.5) return C("tick", "m", r.Next(1, 40));
                        if (x < 0.58) return C("rest");
                        if (x < 0.7 && g.stockOpen()) { var k = g.STK().ToList()[r.Next(g.STK().Count())]; return C("buy", "tk", k, "amt", S.cash * 0.3, "where", "app"); }
                        if (x < 0.8) { var cs = D.TKList.Where(t => t.IsCoin && g.tkOpen(t.id)).ToList(); var t0 = cs[r.Next(cs.Count)]; return C("open", "tk", t0.id, "dir", r.Next(2) * 2 - 1, "lev", new[] { 1, 5, 25, 50 }[r.Next(4)], "amt", S.cash * 0.2); }
                        if (x < 0.85) return C("closeCoins");
                        if (x < 0.88 && g.stockOpen()) { var h = S.hold.Keys.FirstOrDefault(); if (h != null) return C("sell", "tk", h, "frac", 1, "where", "app"); }
                        return C("map");
                    }
                case "map":
                    {
                        var open = D.LOCList.Where(L => L.open.Contains(S.slot)).ToList();
                        return open.Count == 0 || r.NextDouble() < 0.1 ? C("goTo", "loc", "home") : C("goTo", "loc", open[r.Next(open.Count)].id);
                    }
                case "loc":
                    {
                        if (r.NextDouble() < 0.3) return C("tick", "m", r.Next(1, 20));
                        var opts = g.Query(() => g.locOpts(P.key)).Where(o => !o.dis && o.k != "l-trade").ToList();
                        return opts.Count == 0 || r.NextDouble() < 0.2 ? C("leave") : C("act", "k", opts[r.Next(opts.Count)].k);
                    }
                case "encounter": return C("encounter", "ask", false);
                case "work": return P.setup == null ? C("mgSetup") : C("mgResult", "score", 0.6);
                case "casino": return C("casinoLeave");
                case "race": return C("raceLeave");
                case "scratch": return C("scratchDone");
                case "lotto": return C("lottoDone");
                case "shop": return C("shopDone");
                case "relicShop": return C("relicDone");
                case "repay": return C("repay", "amt", 0);
                case "brokerTrade": return C("brokerClose");
                case "loan": return C("loanDone");
                case "menhera": case "impulse": return C("reply", "i", 0);
                case "event": return C("evPick", "k", P.opts.First(o => !o.dis).k);
                case "tempt": return C("tempt", "k", "no");
                case "payday": return C("payday", "k", P.opts.First(o => !o.dis).k);
            }
            return null;
        }

        [Test]
        public void TimeFlowsThroughDaysWithLimitsAndNoErrors()
        {
            int days = 0, delist = 0, liveLiq = 0, slotOver = 0;
            for (int seed = 1; seed <= 12; seed++)
            {
                var g = GameSim.Create(Data, seed * 104729, new GameSim.Opts { rt = true });
                var S = g.S; var r = new System.Random(seed);
                Assert.That(S.rt && S.min == 480);
                Assert.That(S.mk.tk["GSE"].hist.Count, Is.EqualTo(26), "주식 이틀치 30분봉 (09:00~15:30)"); Assert.That(S.mk.tk["BTK"].hist.Count, Is.EqualTo(64), "코인 이틀치 30분봉 (08~24시)");
                g.Apply(C("start"));
                int d0 = g.absDay();
                for (int i = 0; i < 6000 && S.pending != null && S.pending.t != "ending" && g.absDay() < 22; i++)
                {
                    var c = Respond(g, r);
                    Assert.That(c, Is.Not.Null, "pending " + S.pending.t);
                    var evs = g.Apply(c);
                    var e = evs.FirstOrDefault(x => x.t == "error");
                    Assert.That(e, Is.Null, $"seed {seed} #{i} {c} @ {S.pending?.t}: {e}");
                    delist += evs.Count(x => x.t == "delist"); liveLiq += evs.Count(x => x.t == "liveLiq"); slotOver += evs.Count(x => x.t == "slotOver");
                    Assert.That(S.min, Is.InRange(480, 1440));
                    foreach (var t in Data.TKList.Where(t => t.IsStock))
                    {
                        var s = S.mk.tk[t.id];
                        Assert.That(s.p, Is.InRange(s.ref0 * 0.7 * 0.999, s.ref0 * 1.3 * 1.001), $"{t.id} 가격제한");
                    }
                }
                days += g.absDay() - d0;
            }
            Debug.Log($"[rt] days {days} · slotOver {slotOver} · liveLiq {liveLiq} · delist {delist}");
            Assert.That(days, Is.GreaterThan(60));
            Assert.That(slotOver, Is.GreaterThan(20));
            Assert.That(liveLiq, Is.GreaterThan(0));
        }

        [Test]
        public void StockMarketHoursAndInverseFollowsGse()
        {
            var g = GameSim.Create(Data, 777, new GameSim.Opts { rt = true });
            g.Apply(C("start")); g.Apply(C("pickRelic", "i", 0));
            var S = g.S;
            while (S.pending.t != "home") g.Apply(Respond(g, new System.Random(1)));
            Assert.That(g.stockOpen(), Is.False, "08:00 은 장 전");
            double gse0 = S.mk.tk["GSE"].p;
            g.Apply(C("tick", "m", 30)); Assert.That(S.mk.tk["GSE"].p, Is.EqualTo(gse0), "장 전엔 주식 안 움직임");
            g.Apply(C("tick", "m", 40)); Assert.That(g.stockOpen(), Is.True, "09:10");
            Assert.That(g.clockNow(), Is.EqualTo("09:10"));
            for (int i = 0; i < 20; i++)
            {
                g.Apply(C("tick", "m", 7));
                if (!g.stockOpen()) break;
                var gs = S.mk.tk["GSE"]; var iv = S.mk.tk["INV"];
                Assert.That(iv.p / iv.so - 1, Is.EqualTo(-2 * (gs.p / gs.so - 1)).Within(0.0005), "장중에도 곱버스 = 갓성 × −2");
            }
            // 곱버스: 갓성 시간대 수익률의 −2배 (+ 작은 잡음)
            int same = 0, n = 0;
            var plan = typeof(GameSim).GetMethod("planMarket", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            for (int i = 0; i < 300; i++)
            {
                var P = (MarketPlan)plan.Invoke(g, new object[] { new Dictionary<string, double>(), false, null });
                if (System.Math.Abs(P.r["GSE"]) < 0.01) continue;
                n++; if (System.Math.Sign(P.r["GSE"]) == System.Math.Sign(P.r["INV"])) same++;
            }
            Assert.That(n, Is.GreaterThan(30));
            Assert.That(same, Is.LessThan(n / 10 + 1), "갓성 오르면 곱버스는 내려야 함");
        }

        [Test]
        public void RepayFromHome()
        {
            var g = GameSim.Create(Data, 4242, new GameSim.Opts { rt = true });
            g.Apply(C("start")); g.Apply(C("pickRelic", "i", 0));
            var S = g.S; var r = new System.Random(3);
            while (S.pending.t != "home") g.Apply(Respond(g, r));
            double debt0 = S.debt, cash0 = S.cash; int min0 = S.min;
            g.Apply(C("repayOpen"));
            Assert.That(S.pending.t, Is.EqualTo("repay"));
            var evs = g.Apply(C("repay", "amt", 100000));
            Assert.That(evs.Any(e => e.t == "error"), Is.False);
            Assert.That(S.debt, Is.EqualTo(debt0 - 100000));
            Assert.That(S.cash, Is.EqualTo(cash0 - 100000));
            Assert.That(S.min, Is.EqualTo(min0), "집 상환은 시간 안 씀");
            Assert.That(S.pending.t, Is.EqualTo("home"));
            g.Apply(C("repayOpen")); g.Apply(C("repay", "amt", 0));
            Assert.That(S.pending.t, Is.EqualTo("home"), "취소");
        }

        [Test]
        public void TickersListWeekByWeek()
        {
            var g = GameSim.Create(Data, 31, new GameSim.Opts { rt = true });
            g.Apply(C("start")); g.Apply(C("pickRelic", "i", 0));
            var S = g.S;
            string[] Open() => g.D.TKList.Where(t => g.tkOpen(t.id)).Select(t => t.id).OrderBy(x => x).ToArray();
            Assert.That(Open(), Is.EqualTo(new[] { "BTK", "GSE", "GUK" }), "1일차: 주식 2 · 코인 1");
            S.min = g.D.RULES.RT_STOCK[0] + 30;
            g.Apply(C("buy", "tk", "GSE", "amt", 100000, "where", "app")); Assert.That(S.hold.Has("GSE"), "열린 종목은 삼");
            g.Apply(C("buy", "tk", "BAT", "amt", 100000, "where", "app")); Assert.That(S.hold.Has("BAT"), Is.False, "아직 상장 전 종목은 못 삼");
            S.month = 2; S.day = 1; Assert.That(Open(), Does.Contain("BAT").And.Contain("GLD").And.Contain("TOK").And.Not.Contain("TAL"), "2주차");
            S.month = 3; Assert.That(Open(), Does.Contain("TAL").And.Contain("INV").And.Not.Contain("JHS"), "3주차");
            S.month = 4; Assert.That(Open(), Does.Contain("JHS").And.Contain("GAE").And.Not.Contain("MMC"), "4주차 (멍멍은 유품)");
            S.month = 1; S.hold.Set("JHS", new Holding { q = 1, cost = 470 });
            Assert.That(g.tkOpen("JHS"), "들고 있는 종목은 팔 수 있게 열림");
        }

        [Test]
        public void OldTurnSaveMissingNewTickersContinuesInRealtime()
        {
            var g = GameSim.Create(Data, 99, new GameSim.Opts { rt = false });
            g.Apply(C("start")); g.Apply(C("pickRelic", "i", 0));
            var S = g.S; var r = new System.Random(5);
            while (S.pending.t != "home") g.Apply(Respond(g, r));
            g.Query(() => 0);   // 계획이 만들어져 있게
            foreach (var k in new[] { "GAE", "JHS", "TAL" }) { S.mk.tk.Remove(k); S.mplan?.r.Remove(k); S.mplan?.w.Remove(k); }   // 예전 저장 흉내
            var g2 = new GameSim(Data, S);
            g2.EnableRt();
            Assert.That(S.rt && S.mk.tk.Has("GAE"));
            for (int i = 0; i < 2000 && g2.absDay() < 4 && S.pending.t != "ending"; i++)
            {
                var evs = g2.Apply(Respond(g2, r));
                Assert.That(evs.FirstOrDefault(e => e.t == "error"), Is.Null);
            }
            Assert.That(g2.absDay(), Is.GreaterThanOrEqualTo(3));
        }

        [Test]
        public void WorkSpamWearsDownBodyAndMind()
        {
            // 피드백: 알바만 계속 해도 체력 30 밑으로 안 가고 멘탈도 안 나빠짐 → 실시간에선 깎여야 함
            var g = GameSim.Create(Data, 31337, new GameSim.Opts { rt = true });
            g.Apply(C("start")); g.Apply(C("pickRelic", "i", System.Math.Max(0, g.S.pending.offer.FindIndex(id => id != "ginseng"))));   // 인삼(알바 체력 ×0.7) 말고
            var S = g.S; var r = new System.Random(9);
            double minHp = 100, maxSt = 0; int works = 0;
            for (int i = 0; i < 5000 && g.absDay() < 9 && S.pending.t != "ending"; i++)
            {
                var P = S.pending; SimCommand c;
                if (P.t == "home") c = g.isEve() ? C("rest") : C("map");
                else if (P.t == "map") c = C("goTo", "loc", g.isEve() ? "home" : "work");
                else if (P.t == "loc") { var o = g.Query(() => g.locOpts(P.key)).FirstOrDefault(x => !x.dis && x.k == "l-cafe"); c = o != null ? C("act", "k", o.k) : C("leave"); }
                else if (P.t == "work" && P.setup != null) { works++; c = C("mgResult", "score", 0.7); }
                else c = Respond(g, r);
                Assert.That(g.Apply(c).FirstOrDefault(e => e.t == "error"), Is.Null);
                minHp = System.Math.Min(minHp, S.hp); maxSt = System.Math.Max(maxSt, S.stress);
            }
            Debug.Log($"[rt] work spam ({string.Join(",", S.augs)}): works {works} · minHp {minHp} · maxStress {maxSt}");
            Assert.That(works, Is.GreaterThan(5));
            Assert.That(minHp, Is.LessThan(D_HP_LOW), "알바만 하면 체력이 바닥남");
            Assert.That(maxSt, Is.GreaterThanOrEqualTo(40), "알바만 하면 멘탈이 불안 이상으로");
        }
        static double D_HP_LOW => Data.RULES.HP_LOW;

        [Test]
        public void CoinStuckAtFloorGetsDelistedInsteadOfBouncing()
        {
            // 피드백: 종목마다 더 안 떨어지는 최저가가 있어서 거기서 몰빵하면 무조건 오름 (1조 2천억) → 바닥 근처면 상폐
            var g = GameSim.Create(Data, 2024, new GameSim.Opts { rt = true });
            g.Apply(C("start")); g.Apply(C("pickRelic", "i", 0));
            var S = g.S; var r = new System.Random(4);
            while (S.pending.t != "home") g.Apply(Respond(g, r));
            g.Apply(C("tick", "m", 1));
            const string K = "MMC"; var t = g.D.TK[K]; if (!S.augs.Contains("meme")) S.augs.Add("meme");   // 밈코인 해금 유물
            Assert.That(g.Apply(C("open", "tk", K, "dir", 1, "lev", 1, "amt", 100000)).FirstOrDefault(e => e.t == "error"), Is.Null);
            Assert.That(g.Apply(C("open", "tk", K, "dir", -1, "lev", 1, "amt", 100000)).FirstOrDefault(e => e.t == "error"), Is.Null);
            var s = S.mk.tk[K];
            s.p = s.so = t.p0 * 0.01;   // 바닥 근처로 끌어내림
            double cash0 = S.cash; bool gone = false;
            for (int i = 0; i < 400 && !gone; i++)
            {
                var evs = g.Apply(S.pending.t == "home" ? C("tick", "m", 10) : Respond(g, r));
                Assert.That(evs.FirstOrDefault(e => e.t == "error"), Is.Null);
                gone = evs.Any(e => e.t == "delist" && (string)e.d["tk"] == K);
            }
            Assert.That(gone, Is.True, "바닥에 붙은 코인은 시간대 끝에 상폐");
            Assert.That(S.cps.Any(c => c.tk == K), Is.False, "포지션 정리");
            Assert.That(S.cash - cash0, Is.GreaterThan(150000), "숏은 폭락만큼 벌어서 정산");
            Assert.That(S.mk.tk[K].p, Is.GreaterThanOrEqualTo(t.p0 * 0.5), "재상장가로 리셋");
        }

        static GameSim HomeRt(int seed)
        {
            var g = GameSim.Create(Data, seed, new GameSim.Opts { rt = true });
            g.Apply(C("start")); g.Apply(C("pickRelic", "i", System.Math.Max(0, g.S.pending.offer.FindIndex(id => id != "ginseng"))));
            var r = new System.Random(seed);
            while (g.S.pending.t != "home") g.Apply(Respond(g, r));
            return g;
        }
        static void NextMorning(GameSim g)
        {
            var r = new System.Random(1); int d0 = g.absDay();
            for (int i = 0; i < 500 && g.absDay() == d0; i++)
            {
                var P = g.S.pending;
                var evs = g.Apply(P.t == "home" ? C("tick", "m", 120) : P.t == "map" ? C("goTo", "loc", "home") : P.t == "loc" ? C("leave") : Respond(g, r));
                Assert.That(evs.FirstOrDefault(e => e.t == "error"), Is.Null);
            }
            for (int i = 0; i < 50 && g.S.pending.t != "home"; i++) g.Apply(Respond(g, r));
        }

        [Test]
        public void StressMakesYouSickAndSicknessHurtsWorkAndTrades()
        {
            // 피드백: 스트레스 수치가 무의미 → 높으면 병 걸리고, 병은 알바·투자 효율을 깎아야 함
            var g = HomeRt(555); var S = g.S;
            S.stress = 0; S.hp = 100;
            Assert.That(g.sickP(), Is.LessThan(0.05), "멀쩡하면 거의 안 아픔");
            S.stress = 100; S.hp = 10;
            Assert.That(g.sickP(), Is.GreaterThan(0.35), "스트레스 만땅·체력 바닥이면 잘 아픔");
            for (int d = 0; d < 12 && S.sick == null; d++) { S.stress = 100; S.hp = 10; NextMorning(g); }
            Assert.That(S.sick, Is.Not.Null, "스트레스 계속 높으면 결국 병 걸림");
            Assert.That(g.sickSleep(), Is.LessThan(1), "아프면 잠 회복 줄어듦");
            Assert.That(g.workMult(), Is.EqualTo(1), "실시간 모드 일당은 컨디션 상관없음 (피드백)");
            Assert.That(g.sickSlip(), Is.GreaterThan(0), "아프면 매매 손해");

            // 같은 돈으로 산 주식 수: 아플 때 < 안 아플 때
            S.cash = 2000000; g.Apply(C("tick", "m", System.Math.Max(1, 600 - S.min)));
            while (S.pending.t != "home") g.Apply(Respond(g, new System.Random(2)));
            Assume.That(g.stockOpen(), Is.True);
            var buy = typeof(GameSim).GetMethod("buyStock", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            buy.Invoke(g, new object[] { "GSE", 1000000.0, 0.0 }); double qSick = S.hold["GSE"].q; S.hold.Remove("GSE");
            string sk = S.sick; S.sick = null;
            buy.Invoke(g, new object[] { "GSE", 1000000.0, 0.0 }); double qOk = S.hold["GSE"].q; S.hold.Remove("GSE");
            S.sick = sk;
            Assert.That(qSick, Is.LessThan(qOk * 0.995), "아프면 같은 돈에 덜 삼");

            // 병원 수액 = 바로 나음
            S.cash = 1000000; g.Apply(C("map")); g.Apply(C("goTo", "loc", "hosp"));
            while (S.pending.t == "encounter") g.Apply(C("encounter", "ask", false));
            Assert.That(S.pending.t, Is.EqualTo("loc"));
            Assert.That(g.Apply(C("act", "k", "l-clinic")).FirstOrDefault(e => e.t == "error"), Is.Null);
            Assert.That(S.sick, Is.Null, "수액 맞으면 나음");
        }

        [Test]
        public void RtJobPayIs70kTo140kRegardlessOfCondition()
        {
            // 피드백: 알바비 7만~14만 · 컨디션 따라 돈 변동 없어도 됨
            var g = HomeRt(808); var S = g.S; var J = Data.JOBS["cafe"];
            Assert.That(g.jobPay(J, 0), Is.EqualTo(70000)); Assert.That(g.jobPay(J, 1), Is.EqualTo(140000));
            S.hp = 5; S.stress = 100;
            Assert.That(g.workMult(), Is.EqualTo(1), "체력 바닥·멘헤라여도 일당 그대로");
            var t = GameSim.Create(Data, 808);
            Assert.That(t.jobPay(J, 1), Is.EqualTo(J.@base + J.var), "턴 모드는 원래 일당");
        }

        [Test]
        public void RtHiLowIsWorseThanTurnMode()
        {
            // 피드백: 하이로우로 돈 불리기 너무 쉬움 → 실시간은 같은 숫자 = 딜러 승, 배당 ×0.9
            var g = HomeRt(909);
            Assert.That(g.hlEdge(), Is.LessThan(1));
            double ev = 0, evTurn = 0;
            for (int a = 1; a <= 13; a++)
            {
                bool hi = a <= 7; int n = hi ? 13 - a : a - 1;
                ev += n / 13.0 * GameSim.hlMult(a, hi, g.hlEdge());              // 같음 = 0
                evTurn += n / 13.0 * GameSim.hlMult(a, hi) + 1 / 13.0;           // 같음 = 반환
            }
            ev /= 13; evTurn /= 13;
            Assert.That(ev, Is.LessThan(0.82), "실시간 하이로우 기대값 확 낮음");
            Assert.That(evTurn, Is.GreaterThan(0.9));
        }

        [Test]
        public void ImpulseBuyAnnouncesItselfInRt()
        {
            // 피드백: 멘헤라 돌발 매수가 안 보임 → 체결 알림 이벤트
            var g = HomeRt(4242); var S = g.S; S.cash = 3000000;
            g.Apply(C("debug", "k", "impulse"));
            Assume.That(S.pending?.t, Is.EqualTo("impulse"));
            var evs = g.Apply(C("reply", "i", S.pending.opts.FindIndex(o => !o.ok)));
            var e = evs.FirstOrDefault(x => x.t == "impBuy");
            Assert.That(e, Is.Not.Null, "돌발 매수 체결 알림");
            Assert.That(e.Num("cash0") - e.Num("cash1"), Is.GreaterThan(0), "현금 얼마 빠졌는지");
        }

        [Test]
        public void IgnoringMiraiKakaoWearsDownMental()
        {
            // 피드백: 카톡·디시 볼 이유가 없음 → 미래 카톡 읽씹하면 멘탈 깎임
            var g = HomeRt(4321); var S = g.S;
            S.stress = 10; S.kun["m"] = 0; g.Apply(C("tick", "m", 120)); double calm = S.stress;
            S.stress = 10; S.kun["m"] = 5; g.Apply(C("tick", "m", 120));
            Assert.That(S.stress, Is.GreaterThan(calm + 4), "안 읽은 카톡이 쌓이면 시간마다 멘탈 나빠짐");
        }

        [Test]
        public void RelaxSpotsWorkButSameFunWearsOff()
        {
            var g = HomeRt(808); var S = g.S; var r = new System.Random(3);
            double Walk()
            {
                S.stress = 80; S.kun["m"] = 0;   // 카톡 읽씹 페널티 빼고
                g.Apply(C("map")); g.Apply(C("goTo", "loc", "park"));
                while (S.pending.t == "encounter") g.Apply(C("encounter", "ask", false));
                Assert.That(S.pending.t, Is.EqualTo("loc"));
                Assert.That(g.Apply(C("act", "k", "l-walk")).FirstOrDefault(e => e.t == "error"), Is.Null);
                double d = 80 - S.stress;
                for (int i = 0; i < 50 && S.pending.t != "home"; i++) g.Apply(S.pending.t == "loc" ? C("leave") : Respond(g, r));
                return d;
            }
            double a = Walk(), b = Walk();
            Assert.That(a, Is.GreaterThanOrEqualTo(10), "산책 = 멘탈 회복");
            Assert.That(b, Is.LessThan(a), "같은 날 또 하면 덜 먹힘");
            // 포차는 저녁만, 부어라 마셔라 = 숙취 → 다음 날 아침 체력 깎임
            while (!g.isEve()) { g.Apply(S.pending.t == "home" ? C("tick", "m", 60) : Respond(g, r)); }
            while (S.pending.t != "home") g.Apply(Respond(g, r));
            S.cash = 1000000; S.stress = 90; S.kun["m"] = 0;
            g.Apply(C("map")); g.Apply(C("goTo", "loc", "bar"));
            while (S.pending.t == "encounter") g.Apply(C("encounter", "ask", false));
            Assert.That(g.Apply(C("act", "k", "l-drunk")).FirstOrDefault(e => e.t == "error"), Is.Null);
            Assert.That(S.stress, Is.LessThanOrEqualTo(50), "술 = 멘탈 대폭 회복");
            Assert.That(S.hang, Is.True, "부어라 마셔라 = 숙취 확정");
            Assert.That(g.sickP(), Is.GreaterThan(g.D.RULES.SICK_P0), "숙취면 아플 확률 오름");
        }

        [Test]
        public void MissedInterestIsAlwaysTakenAwayInRealtime()
        {
            var bad = typeof(GameSim).GetMethod("badKind", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
            var rt = GameSim.Create(Data, 1, new GameSim.Opts { rt = true }); rt.S.addict = 95;
            Assert.That(bad.Invoke(rt, null), Is.EqualTo("bad1"), "실시간: 중독도 높아도 이자 못 내면 끌려감");
            var turn = GameSim.Create(Data, 1); turn.S.addict = 95;
            Assert.That(bad.Invoke(turn, null), Is.EqualTo("bad2"), "턴 모드(웹 골든)는 그대로");
        }
    }
}
