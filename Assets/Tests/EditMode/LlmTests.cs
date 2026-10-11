using System.Collections.Generic;
using System.IO;
using System.Linq;
using KwGame.Sim;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEngine;

namespace KwGame.Tests
{
    // LLM 뉴스 디렉터 연동 (docs/LLM.md): 녹화된 LLM 응답을 JS·C# sim 에 똑같이 넣었을 때 같은 상태가 나오는지 + 검증 규칙.
    // 픽스처: Assets/Tests/EditMode/Llm/{fixture.json, data} (node web/tests/llm/gen.mjs → ./unity sync-llm)
    public class LlmTests
    {
        static string Root => Path.Combine(Application.dataPath, "Tests/EditMode/Llm");
        static GameData _data;
        static GameData Data => _data ??= GameData.Load(Directory.GetFiles(Path.Combine(Root, "data"), "*.json")
            .Select(f => new KeyValuePair<string, string>(Path.GetFileName(f), File.ReadAllText(f))));

        [Test]
        public void RecordedResponsesMatchJs()
        {
            var bad = LlmFixture.Check(Data, JObject.Parse(File.ReadAllText(Path.Combine(Root, "fixture.json"))));
            Assert.That(bad, Is.Empty, string.Join("\n", bad.Take(10)));
        }

        [Test]
        public void NoRequestWithoutLlmMode()
        {
            var g = GameSim.Create(Data, 31);
            Assert.That(g.NewsReq(), Is.Null);
            var evs = g.Apply(new SimCommand("newsFact", "slotId", 0, "dir", 1, "ticker", "GSE", "strength", "mid", "headline", "h", "body", "b", "source", "s", "event", "e"));
            Assert.That(evs.Any(e => e.t == "error" && e.Str("msg") == "newsFact"));
            Assert.That(g.S.nfact, Is.Null);
        }

        /// 요청이 생기는 첫 칸까지 진행 (llmMode 켜고 집에서 쉬기 반복)
        static (GameSim g, JObject q) FirstRequest()
        {
            var g = GameSim.Create(Data, 31);
            g.Apply(new SimCommand("llmMode", "on", true));
            g.Apply(new SimCommand("start"));
            g.Apply(new SimCommand("pickRelic", "i", 0));
            for (int i = 0; i < 200; i++)
            {
                var q = g.NewsReq();
                if (q != null && g.S.pending?.t == "home") return (g, q);
                var p = g.S.pending?.t;
                if (p == "home") g.Apply(new SimCommand("rest"));
                else if (p == "menhera" || p == "impulse") g.Apply(new SimCommand("reply", "i", 0));
                else if (p == "tempt") g.Apply(new SimCommand("tempt", "k", "no"));
                else if (p == "payday") g.Apply(new SimCommand("payday", "k", "loan"));
                else g.Apply(new SimCommand("noop"));
            }
            Assert.Fail("요청 안 나옴");
            return (null, null);
        }

        [Test]
        public void FactValidation()
        {
            var (g, q) = FirstRequest();
            int slot = (int)q["slotId"], dir = (int)q["dir"]; string tk = (string)q["tickers"][0]["k"], st = (string)q["strengths"][0];
            object[] F(params object[] over)
            {
                var d = new Dictionary<string, object> { ["slotId"] = slot, ["dir"] = dir, ["ticker"] = tk, ["strength"] = st, ["headline"] = "헤드라인", ["body"] = "본문", ["source"] = "출처", ["event"] = "사건" };
                for (int i = 0; i + 1 < over.Length; i += 2) d[(string)over[i]] = over[i + 1];
                return d.SelectMany(kv => new[] { kv.Key, kv.Value }).ToArray();
            }
            bool Rejected(params object[] over) => g.Apply(new SimCommand("newsFact", F(over))).Any(e => e.t == "error");
            Assert.That(Rejected("ticker", "INV"), "목록 밖 종목");
            Assert.That(Rejected("dir", -dir), "방향");
            Assert.That(Rejected("slotId", slot + 1), "칸");
            Assert.That(Rejected("strength", "huge"), "세기");
            Assert.That(Rejected("headline", new string('가', 61)), "길이");
            Assert.That(Rejected("body", ""), "빈 본문");
            Assert.That(g.S.nfact, Is.Null);
            Assert.That(!Rejected("headline", "  <b>{x}</b>\u0007 속보 ", "arcId", "BAD ID", "arcStep", 3));
            Assert.That(g.S.nfact.h, Is.EqualTo("b x /b 속보"));
            Assert.That(g.S.nfact.arc, Is.Null);
            g.Apply(new SimCommand("llmMode", "on", false));
            Assert.That(g.S.nfact, Is.Null, "모드 끄면 받은 사실 버림");
        }

        [Test]
        public void CleanText()
        {
            Assert.That(GameSim.CleanText(new JValue("a\u2028b\uFEFFc"), 10), Is.EqualTo("a b c"));
            Assert.That(GameSim.CleanText(new JValue("   "), 10), Is.Null);
            Assert.That(GameSim.CleanText(new JValue(3), 10), Is.Null);
        }
    }
}
