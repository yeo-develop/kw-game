using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace KwGame.Sim
{
    /// LLM 녹화 응답 픽스처 재생 (web/tests/llm/common.mjs 대응). EditMode 테스트·dotnet SimHarness 공용.
    /// 픽스처 = {seed, commands[], reqs[{at, req}], expected{hash, events, factErrors, …, nstr, nlog, newsFeed}}
    public static class LlmFixture
    {
        /// 틀린 항목 목록 (비면 통과)
        public static List<string> Check(GameData D, JObject v)
        {
            var bad = new List<string>();
            var g = GameSim.Create(D, (int)v["seed"]);
            var reqs = (JArray)v["reqs"]; int ri = 0, n = 0, nev = 0, errs = 0;
            void reqOk()
            {
                while (ri < reqs.Count && (int)reqs[ri]["at"] == n)
                {
                    var q = g.NewsReq();
                    if (!JToken.DeepEquals(q, reqs[ri]["req"])) bad.Add($"req#{ri} @{n}: {q?.ToString(Newtonsoft.Json.Formatting.None)} != {reqs[ri]["req"].ToString(Newtonsoft.Json.Formatting.None)}");
                    ri++;
                }
            }
            reqOk();
            foreach (JObject c in (JArray)v["commands"])
            {
                var evs = g.Apply(new SimCommand(c)); nev += evs.Count;
                errs += evs.Count(e => e.t == "error" && e.Str("msg") == "newsFact");
                n++; reqOk();
            }
            if (ri != reqs.Count) bad.Add($"reqs checked {ri}/{reqs.Count}");
            var S = g.S; var ex = (JObject)v["expected"];
            void eq(string k, JToken got) { if (!JToken.DeepEquals(ex[k], got)) bad.Add($"{k}: expected {ex[k]?.ToString(Newtonsoft.Json.Formatting.None)} got {got?.ToString(Newtonsoft.Json.Formatting.None)}"); }
            eq("hash", Fnv.Fnv1a(Digest.Of(S)));
            eq("events", nev); eq("factErrors", errs);
            eq("end", S.ending ?? ""); eq("month", S.month); eq("day", S.day); eq("slot", S.slot);
            eq("rng", S.rng); eq("fx", S.fx);
            eq("nstr", new JArray(S.nstr));
            eq("nlog", g.NewsLogJson());
            eq("newsFeed", new JArray(S.feed.Where(f => f.kind == "news").Select(f => new JObject
            {
                ["x"] = f.x, ["rows"] = f.rows == null ? (JToken)JValue.CreateNull() : new JArray(f.rows),
            })));
            return bad;
        }
    }
}
