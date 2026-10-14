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
        static GameData Data => _data ??= GameData.Load(Directory.GetFiles(Path.Combine(Application.dataPath, "Resources/Data"), "*.json")
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
