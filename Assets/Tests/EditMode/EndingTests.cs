using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using KwGame.Sim;
using KwGame.View;
using NUnit.Framework;
using UnityEngine;

namespace KwGame.Tests
{
    // 미래 새 표정(yami·pout·love·shy·flex) + 엔딩 추가분(클리어 rich · bad3 과로 · bad4 멘헤라). 새 엔딩은 실시간 전용 (턴 모드 = 웹 골든 그대로)
    public class EndingTests
    {
        static GameData _data;
        static GameData Data => _data ??= GameData.Load(Directory.GetFiles(Path.Combine(Application.dataPath, "Resources/Data"), "*.json").Where(f => Path.GetFileName(f) != "unity_v4.json")   // v4 이전 실시간 규칙 (v4 는 V4Tests)

            .Select(f => new KeyValuePair<string, string>(Path.GetFileName(f), File.ReadAllText(f))));
        static SimCommand C(string t, params object[] kv) => new SimCommand(t, kv);
        static void Call(GameSim g, string m) => typeof(GameSim).GetMethod(m, BindingFlags.NonPublic | BindingFlags.Instance).Invoke(g, null);

        /// 집 화면까지 (rt = 실시간). 턴 모드는 아침 연출 등 몇 단계를 대충 넘김
        static GameSim Home(bool rt, int seed = 4242)
        {
            var g = GameSim.Create(Data, seed, new GameSim.Opts { rt = rt });
            g.Apply(C("start"));
            for (int i = 0; i < 50 && g.S.pending.t != "home"; i++)
                g.Apply(g.S.pending.t == "relic" ? C("pickRelic", "i", System.Math.Max(0, g.S.pending.offer.FindIndex(id => id != "posi"))) : C("evPick", "k", g.S.pending.opts?.FirstOrDefault(o => !o.dis)?.k));
            Assert.That(g.S.pending.t, Is.EqualTo("home"));
            return g;
        }

        // ---------- 표정 ----------
        [Test]
        public void YamiFaceAboveNinety()
        {
            var g = Home(true); var S = g.S;
            S.stress = 89; Assert.That(g.moodFace(), Is.EqualTo("menhera"));
            S.stress = 90; Assert.That(g.moodFace(), Is.EqualTo("yami"));
            Assert.That(g.mental(), Is.EqualTo("men"), "야미는 표정만, 멘탈 단계는 그대로 3개");
            S.stress = 50; Assert.That(g.moodFace(), Is.EqualTo("tired"));
            S.augs.Add("posi");   // 긍정일기장: 멘헤라 선 90 → 야미 선 100
            Assert.That(g.yamiLine(), Is.EqualTo(100));
            S.stress = 95; Assert.That(g.moodFace(), Is.EqualTo("menhera"));
            S.stress = 100; Assert.That(g.moodFace(), Is.EqualTo("yami"));
        }

        [Test]
        public void NewFacesFallBackToOldSpritesWhenArtIsMissing()
        {
            var old = new Dictionary<string, string> { ["shy"] = "base", ["flex"] = "excited", ["yami"] = "mental", ["pout"] = "annoyed", ["love"] = "excited" };
            foreach (var kv in old)
            {
                Assert.That(ArtCatalog.FaceSprite(kv.Key, _ => false), Is.EqualTo(kv.Value), kv.Key + " 그림 없을 때");
                Assert.That(ArtCatalog.FaceSprite(kv.Key, _ => true), Is.EqualTo(kv.Key), kv.Key + " 그림 있을 때");
            }
            Assert.That(ArtCatalog.FaceSprite("angry", _ => true), Is.EqualTo("annoyed"), "예전 표정은 그대로");
            Assert.That(ArtCatalog.FaceSprite("menhera", _ => true), Is.EqualTo("mental"));
            Assert.That(ArtCatalog.FaceSprite("nope", _ => true), Is.Null);
            Assert.That(ArtCatalog.EndingCg("clear", "gamble", _ => true), Is.EqualTo("ending_clear_gamble"));
            Assert.That(ArtCatalog.EndingCg("clear", "gamble", k => k == "ending_clear"), Is.EqualTo("ending_clear"), "변형 CG 없으면 종류 CG");
            Assert.That(ArtCatalog.EndingCg("clear", "lonely", k => k == "ending_bad4_run" || k == "ending_clear"), Is.EqualTo("ending_bad4_run"), "v4 변형은 뜻 맞는 그림으로");
            Assert.That(ArtCatalog.EndingCg("heist", "", _ => false), Is.Null, "그림 없으면 배경만");
            Assert.That(ArtCatalog.EndingCg("bad3", "", _ => true), Is.EqualTo("ending_bad3"));
        }

        [Test]
        public void MenheraUsesYamiWhenStressIsVeryHighOrReplyGoesBad()
        {
            var g = Home(true); var S = g.S;
            var ev = g.Apply(C("debug", "k", "menhera"));   // 스트레스 95
            Assert.That(ev.First(e => e.t == "menhera").Str("face"), Is.EqualTo("yami"));
            Assert.That(ev.Last(e => e.t == "say" && e.Str("who") == "m").Str("face"), Is.EqualTo("yami"));
            ev = g.Apply(C("reply", "i", S.pending.opts.FindIndex(o => !o.ok)));
            Assert.That(ev.First(e => e.t == "say" && e.Str("who") == "m").Str("face"), Is.EqualTo("yami"), "나쁜 답장 = 야미");
            Assert.That(S.ending, Is.Null);
        }

        // ---------- bad4 멘헤라 (연속 나쁜 답장) ----------
        static int Need => (int)Data.RULES.RT_MEN_END_BAD;
        static List<SimEvent> MenReply(GameSim g, int runBefore, double stress, bool ok = false)
        {
            var S = g.S;
            if (S.pending == null) S.pending = new Pending("home");   // debug 멘헤라는 흐름 밖이라 답장 뒤 pending 이 빔 → 집으로 되돌림
            g.Apply(C("debug", "k", "menhera"));
            Assert.That(S.pending.t, Is.EqualTo("menhera"));
            S.menRun = runBefore; S.stress = stress;
            return g.Apply(C("reply", "i", S.pending.opts.FindIndex(o => o.ok == ok)));
        }
        static bool Warned(List<SimEvent> ev) => ev.Any(e => e.t == "toast" && e.Str("text") == Data.S("men.warn"));

        [Test]
        public void Bad4WhenBadStreakReachesThresholdAtMaxStress()
        {
            var g = Home(true);
            MenReply(g, Need - 1, 100);
            Assert.That(g.S.ending, Is.EqualTo("bad4"));
            Assert.That(g.S.endInfo.face, Is.EqualTo("yami"));
            Assert.That(g.S.endInfo.tag, Does.Contain("멘헤라"));
            Assert.That(g.S.endInfo.variant, Is.EqualTo(g.hasPos() ? "sell" : "run"));
            Assert.That(g.S.endSeen["bad4"], Is.EqualTo(1));
        }

        [Test]
        public void BadStreakCountsUpAndGoodReplyResetsIt()
        {
            var g = Home(true); var S = g.S;
            MenReply(g, 0, 80); Assert.That(S.menRun, Is.EqualTo(1));
            double bad0 = S.st.menBad;
            MenReply(g, S.menRun, 80); Assert.That(S.menRun, Is.EqualTo(2));
            Assert.That(S.st.menBad, Is.EqualTo(bad0 + 1), "menBad = 누적 그대로");
            MenReply(g, Need - 1, 100, ok: true);
            Assert.That(S.menRun, Is.EqualTo(0), "착한 답장 = 연속 리셋");
            Assert.That(S.ending, Is.Null);
            MenReply(g, S.menRun, 100); Assert.That(S.ending, Is.Null, "리셋 뒤엔 다시 처음부터");
        }

        [Test]
        public void Bad4WarnsOneStepBeforeAndIsAvoidable()
        {
            var g = Home(true); var ev = MenReply(g, Need - 2, 100);
            Assert.That(g.S.ending, Is.Null); Assert.That(g.S.menRun, Is.EqualTo(Need - 1));
            Assert.That(Warned(ev), Is.True, "한 번 전엔 경고");
            g = Home(true); ev = MenReply(g, Need - 3, 100);
            Assert.That(Warned(ev), Is.False, "두 번 전엔 경고 없음");
            g = Home(true); MenReply(g, Need - 1, 99); Assert.That(g.S.ending, Is.Null, "스트레스가 꽉 안 찼으면 안 끝남");
            g = Home(true); g.S.st.menBad = 50; MenReply(g, 0, 100); Assert.That(g.S.ending, Is.Null, "누적 menBad 는 상관없음 (연속만)");
            g = Home(false); MenReply(g, Need + 5, 100); Assert.That(g.S.ending, Is.Null, "턴 모드(웹 골든)엔 없음");
        }

        [Test]
        public void Bad4AlsoFromImpulseBuyGoingBad()
        {
            var g = Home(true); var S = g.S; S.cash = 1000000;
            g.Apply(C("debug", "k", "impulse"));
            Assert.That(S.pending.t, Is.EqualTo("impulse"));
            S.menRun = Need - 1; S.stress = 100;
            g.Apply(C("reply", "i", S.pending.opts.FindIndex(o => !o.ok)));
            Assert.That(S.ending, Is.EqualTo("bad4"));
        }

        [Test]
        public void BadStreakIsSavedAndLoaded()
        {
            string dir = Path.Combine(Path.GetTempPath(), "kw-ending-tests-" + System.Guid.NewGuid().ToString("N"));
            try
            {
                var store = new KwGame.Persistence.SaveStore(dir);
                var g = Home(true); g.S.menRun = Need - 1;
                Assert.That(store.TrySave(g.S, out var err), Is.True, err);
                Assert.That(store.TryLoad(out var r, out err), Is.True, err);
                Assert.That(r.State.menRun, Is.EqualTo(Need - 1));
            }
            finally { if (Directory.Exists(dir)) Directory.Delete(dir, true); }
        }

        // ---------- bad3 과로 ----------
        [Test]
        public void Bad3OnThirdFaintInRealtimeOnly()
        {
            int n = (int)Data.RULES.RT_FAINT_END;
            var g = Home(true); g.S.st.faint = n - 2; g.S.hp = 0; Call(g, "faintCheck");
            Assert.That(g.S.ending, Is.Null, "두 번째 기절까진 버팀");
            Assert.That(g.S.st.faint, Is.EqualTo(n - 1));
            g = Home(true); g.S.st.faint = n - 1; g.S.hp = 0; Call(g, "faintCheck");
            Assert.That(g.S.ending, Is.EqualTo("bad3"));
            Assert.That(g.S.endInfo.tag, Is.EqualTo("GAME OVER · 과로"));
            Assert.That(g.S.endInfo.bg, Is.EqualTo("hosp"));
            Assert.That(g.S.endInfo.face, Is.EqualTo("cry"));
            Assert.That(g.S.pending.cont, Is.False);
            g = Home(true); g.S.st.faint = n - 1; g.S.hp = 10; Call(g, "faintCheck");
            Assert.That(g.S.ending, Is.Null, "체력 남아 있으면 기절 안 함");
            g = Home(false); g.S.st.faint = n + 3; g.S.hp = 0; Call(g, "faintCheck");
            Assert.That(g.S.ending, Is.Null, "턴 모드(웹 골든)엔 없음");
        }

        // ---------- 클리어 rich ----------
        static GameSim Clear(bool rt, double cash, double gnet = 0)
        {
            var g = Home(rt); var S = g.S;
            S.debt = 0; S.cash = cash; S.st.gnet = gnet; S.st.earned = 1000000;
            Call(g, "checkEnd");
            Assert.That(S.ending, Is.EqualTo("clear"));
            return g;
        }

        [Test]
        public void RichClearWhenAssetsAtClearAreHigh()
        {
            double rich = Data.RULES.RT_RICH;
            var g = Clear(true, rich);
            Assert.That(g.S.endInfo.variant, Is.EqualTo("rich"));
            Assert.That(g.S.endInfo.face, Is.EqualTo("flex"));
            Assert.That(g.S.endInfo.h, Is.EqualTo(Data.ENDINGS["clear"].hv["rich"]));
            Assert.That(g.S.endInfo.lead, Does.Contain(g.won(rich)));
            Assert.That(g.S.pending.cont, Is.True, "클리어라 계속하기 됨");
            Assert.That(Clear(true, rich - 10000).S.endInfo.variant, Is.EqualTo(""), "기준 밑이면 보통 클리어");
            Assert.That(Clear(true, rich, gnet: 2000000).S.endInfo.variant, Is.EqualTo("gamble"), "도박으로 갚았으면 gamble 이 먼저");
            Assert.That(Clear(false, rich * 2).S.endInfo.variant, Is.EqualTo(""), "턴 모드엔 rich 없음");
        }

        // ---------- 예전 엔딩 그대로 ----------
        [Test]
        public void ExistingEndingsUnchanged()
        {
            var g = Home(true); g.S.debt = Data.RULES.DEBT_CAP + 1; g.S.galFame = 0; Call(g, "checkEnd");
            Assert.That(g.S.ending, Is.EqualTo("bad1")); Assert.That(g.S.endInfo.variant, Is.EqualTo("sea"));
            g = Home(false); g.S.debt = Data.RULES.DEBT_CAP + 1; g.S.addict = 95; Call(g, "checkEnd");
            Assert.That(g.S.ending, Is.EqualTo("bad2"), "턴 모드: 중독 높고 한도 초과 = 도박 엔딩");
            var c = Clear(true, 1000000);
            Assert.That(c.S.endInfo.variant, Is.EqualTo("")); Assert.That(c.S.endInfo.face, Is.EqualTo(c.S.stress < 60 ? "happy" : "tired"));
            foreach (var k in new[] { "clear", "bad1", "bad2", "bad3", "bad4" }) Assert.That(Data.ENDINGS.ContainsKey(k), k);
        }
    }
}
