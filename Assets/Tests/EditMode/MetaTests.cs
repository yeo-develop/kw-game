using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using KwGame.Persistence;
using KwGame.Sim;
using NUnit.Framework;
using UnityEngine;

namespace KwGame.Tests
{
    // 메타 (GameSim.Meta.cs · MetaStore): 판 코드 · 오늘의 판 · 결과/업적 · 누적 기록 · 기록 파일
    public class MetaTests
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
        /// V4Tests.ToHome 과 같음
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
        /// V4Tests.AtMaturity 와 같은 흐름: 28일째 밤 → 이자 내고 만기 결산. 엔딩 이벤트도 돌려줌
        static GameSim AtMaturity(double debt, double aff, out SimEvent endEv, string diff = null)
        {
            var g = GameSim.Create(Data, 3, new GameSim.Opts { rt = true, diff = diff });
            Go(g, "start"); ToHome(g);
            Assert.That(g.v4, "unity_v4.json 이 켜져 있어야 함");
            var S = g.S;
            S.month = 4; S.day = 7; S.slot = 2; S.min = g.slotStartMin(2); S.paidMonth = 3;
            S.debt = debt; S.aff = aff; S.cash = 20000000;
            endEv = null;
            var e = Go(g, "rest");
            endEv = e.FirstOrDefault(x => x.t == "ending");
            for (int i = 0; i < 10 && S.pending?.t != "ending"; i++)
            {
                var P = S.pending; Assert.That(P, Is.Not.Null);
                if (P.t == "payday") e = Go(g, "payday", "k", P.stage == "repay" ? "keep" : "pay");
                else { e = new List<SimEvent>(); ToHome(g); }
                endEv = endEv ?? e.FirstOrDefault(x => x.t == "ending");
            }
            Assert.That(S.pending?.t, Is.EqualTo("ending"));
            return g;
        }

        [Test]
        public void SeedCodeRoundTripsAndParsesVariants()
        {
            foreach (int s in new[] { 1, 35, 36, 12345, 999999, int.MaxValue })
            {
                string c = GameSim.SeedCode(s);
                Assert.That(c, Does.StartWith("KW-"));
                Assert.That(GameSim.TryParseSeedCode(c, out var a), Is.True); Assert.That(a, Is.EqualTo(s));
                Assert.That(GameSim.TryParseSeedCode("  " + c.ToLowerInvariant() + " ", out var b), Is.True, "소문자·공백 무시"); Assert.That(b, Is.EqualTo(s));
                string body = c.Substring(3);
                if (!body.All(char.IsDigit)) { Assert.That(GameSim.TryParseSeedCode(body, out var d), Is.True, "KW- 없이도"); Assert.That(d, Is.EqualTo(s)); }
            }
            Assert.That(GameSim.SeedCode(36), Is.EqualTo("KW-10"));
            Assert.That(GameSim.TryParseSeedCode("123", out var n), Is.True); Assert.That(n, Is.EqualTo(123), "접두어 없는 숫자 = 10진 씨앗");
            Assert.That(GameSim.TryParseSeedCode("kw-lflr", out var m), Is.True); Assert.That(m, Is.EqualTo(999999));
        }

        [Test]
        public void SeedCodeRejectsInvalid()
        {
            foreach (var t in new[] { null, "", "   ", "KW-", "KW-0", "0", "-5", "KW-!!", "KW-12 3", "ZZZZZZZZZZZZZZ" })
                Assert.That(GameSim.TryParseSeedCode(t, out _), Is.False, "'" + t + "'");
        }

        [Test]
        public void DailySeedIsDeterministicAndInRange()
        {
            int a = GameSim.DailySeed(2026, 11, 10);
            Assert.That(GameSim.DailySeed(2026, 11, 10), Is.EqualTo(a));
            var all = new HashSet<int>();
            for (int d = 1; d <= 28; d++)
            {
                int s = GameSim.DailySeed(2026, 2, d);
                Assert.That(s, Is.InRange(1, 999999));
                all.Add(s);
            }
            Assert.That(all.Count, Is.GreaterThan(20), "날마다 거의 다른 판");
        }

        [Test]
        public void MaturityDuoResultAchievementsAndCard()
        {
            var g = AtMaturity(10000000, 80, out var endEv, "hard");
            var r = g.Result();
            Assert.That(r, Is.Not.Null);
            Assert.That(r.endKey, Is.EqualTo("bad1:duo"));
            Assert.That(r.diff, Is.EqualTo("hard"));
            Assert.That(r.repaidPct, Is.EqualTo(67).Within(1));
            Assert.That(r.cleared, Is.False);
            var ach = g.CheckAchievements();
            Assert.That(ach, Does.Contain("first_end"));
            Assert.That(ach, Does.Contain("duo"));
            Assert.That(ach, Does.Not.Contain("hard_clear"), "클리어 아님");
            var ids = GameSim.Achievements(Data).Select(a => a.id).ToList();
            Assert.That(ach.All(ids.Contains), "V4_ACH 에 있는 id 만");

            string card = g.ResultCard();
            Assert.That(card, Does.Contain(GameSim.SeedCode(g.S.seed)));
            Assert.That(card, Does.Contain(Data.S("v4.tag.duo")));
            Assert.That(card, Does.Contain(Data.S("v4.diff.hard")));
            Assert.That(endEv, Is.Not.Null);
            Assert.That(endEv.d["card"], Is.EqualTo(card), "엔딩 이벤트에 카드");
            Assert.That(endEv.d["kind"], Is.EqualTo("bad1"));
        }

        [Test]
        public void CatalogAndAchievementsLoad()
        {
            var A = GameSim.Achievements(Data);
            Assert.That(A.Count, Is.GreaterThanOrEqualTo(16));
            Assert.That(A.Select(a => a.id).Distinct().Count(), Is.EqualTo(A.Count));
            Assert.That(A.All(a => !string.IsNullOrEmpty(a.name) && !string.IsNullOrEmpty(a.hint)));
            Assert.That(A.First(a => a.id == "liq_work").secret, Is.True);
            var E = GameSim.EndingCatalog(Data);
            Assert.That(E.Select(e => e.key), Does.Contain("clear:true").And.Contain("bad1:duo").And.Contain("heist"));
            foreach (var d in new[] { "easy", "normal", "hard" }) Assert.That(Data.S("v4.diff." + d), Is.Not.Empty);
        }

        [Test]
        public void ApplyTwiceDoesNotDoubleCount()
        {
            var r = AtMaturity(10000000, 80, out _).Result();
            var M = new MetaProgress();
            var u = M.Apply(r, "2026-11-10T00:00:00Z");
            Assert.That(u, Is.Not.Null);
            Assert.That(u.newEndings, Is.EqualTo(new[] { "bad1:duo" }));
            Assert.That(u.newAch, Does.Contain("duo"));
            Assert.That(M.Apply(r, "2026-11-10T00:01:00Z"), Is.Null, "같은 판 다시 = 안 셈");
            Assert.That(M.runs, Is.EqualTo(1));
            Assert.That(M.endings["bad1:duo"], Is.EqualTo(1));
            Assert.That(M.recent.Count, Is.EqualTo(1));
        }

        [Test]
        public void MetaProgressJsonRoundTrip()
        {
            var r = AtMaturity(10000000, 80, out _).Result();
            var M = new MetaProgress(); M.Apply(r, "2026-11-10T00:00:00Z");
            var B = MetaProgress.FromJson(M.ToJson());
            Assert.That(B.runs, Is.EqualTo(M.runs));
            Assert.That(B.EndingCount, Is.EqualTo(M.EndingCount));
            Assert.That(B.AchCount, Is.EqualTo(M.AchCount));
            Assert.That(B.recent[0].seed, Is.EqualTo(r.seed));
            Assert.That(B.recent[0].when, Is.EqualTo("2026-11-10T00:00:00Z"));
            Assert.That(MetaProgress.FromJson(null).runs, Is.EqualTo(0));
            Assert.That(MetaProgress.FromJson("{ 망가짐").runs, Is.EqualTo(0));
        }

        [Test]
        public void MetaStoreLoadsSavesAndSurvivesCorruption()
        {
            string dir = Path.Combine(Path.GetTempPath(), "kw-meta-tests-" + Guid.NewGuid().ToString("N"));
            try
            {
                var store = new MetaStore(dir);
                var fresh = store.Load();
                Assert.That(fresh.runs, Is.EqualTo(0), "파일 없음 = 새 기록");
                var r = AtMaturity(10000000, 80, out _).Result();
                var M = new MetaProgress(); M.Apply(r, "2026-11-10T00:00:00Z");
                Assert.That(store.TrySave(M, out var err), Is.True, err);
                Assert.That(store.TrySave(M, out err), Is.True, "덮어쓰기도 " + err);
                var L = store.Load();
                Assert.That(L.runs, Is.EqualTo(1));
                Assert.That(L.EndingCount, Is.EqualTo(M.EndingCount));
                Assert.That(L.AchCount, Is.EqualTo(M.AchCount));
                File.WriteAllText(store.MetaPath, "\u0000garbage{{");
                Assert.That(store.Load().runs, Is.EqualTo(0), "망가진 파일 = 새 기록");
            }
            finally { if (Directory.Exists(dir)) Directory.Delete(dir, true); }
        }
    }
}
