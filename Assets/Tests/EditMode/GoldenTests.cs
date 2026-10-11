using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using KwGame.Sim;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEngine;

namespace KwGame.Tests
{
    // 웹 sim(픽스처 커밋 = Golden/REF.txt, 현재 4ff230c)과 C# sim 이 비트 단위로 같은지: 난수 규격 테스트 값 + 골든 벡터 24개 + 봇 명령열.
    // 픽스처: Assets/Tests/EditMode/Golden/{data,vectors} (./unity sync-golden [ref] 로 갱신)
    public class GoldenTests
    {
        static string Root => Path.Combine(Application.dataPath, "Tests/EditMode/Golden");
        static GameData _data;
        static GameData Data => _data ??= GameData.Load(Directory.GetFiles(Path.Combine(Root, "data"), "*.json")
            .Select(f => new KeyValuePair<string, string>(Path.GetFileName(f), File.ReadAllText(f))));

        public static IEnumerable<string> Vectors() =>
            Directory.GetFiles(Path.Combine(Application.dataPath, "Tests/EditMode/Golden/vectors"), "*.json")
                .Select(Path.GetFileNameWithoutExtension).OrderBy(x => x, StringComparer.Ordinal);

        static JObject Load(string name) => JObject.Parse(File.ReadAllText(Path.Combine(Root, "vectors", name + ".json")));

        [Test]
        public void Mulberry32SpecValues()
        {
            uint s = 1; var o = new uint[5];
            for (int i = 0; i < 5; i++) o[i] = Rng.Next(ref s);
            Assert.That(o, Is.EqualTo(new uint[] { 2693262067, 11749833, 2265367787, 4213581821, 4159151403 }));
            Assert.That(s, Is.EqualTo(567894474u));
            s = 42; for (int i = 0; i < 5; i++) o[i] = Rng.Next(ref s);
            Assert.That(o, Is.EqualTo(new uint[] { 2581720956, 1925393290, 3661312704, 2876485805, 750819978 }));
            s = 20261011; for (int i = 0; i < 5; i++) o[i] = Rng.Next(ref s);
            Assert.That(o, Is.EqualTo(new uint[] { 1488163886, 3496767163, 2460547021, 1222184908, 208299103 }));
        }

        [Test]
        public void FloatGaussSpecValues()
        {
            uint s = 1;
            Assert.That(Rng.Float(ref s), Is.EqualTo(0.6270739405881613));
            Assert.That(Rng.Float(ref s), Is.EqualTo(0.002735721180215478));
            Assert.That(Rng.Float(ref s), Is.EqualTo(0.5274470399599522));
            Assert.That(Rng.Gauss(ref s), Is.EqualTo(0.7189959576353431));
            Assert.That(Rng.Gauss(ref s), Is.EqualTo(-1.496482246555388));
            Assert.That(Rng.Gauss(ref s), Is.EqualTo(0.45057579781860113));
            Assert.That(s, Is.EqualTo(2711589972u));
        }

        static string Bits(double x) => BitConverter.DoubleToInt64Bits(x).ToString("x16");

        [Test]
        public void ExpLogFnvSpecValues()
        {
            Assert.That(Bits(Rng.PExp(-0.5)), Is.EqualTo("3fe368b2fc6f960c"));
            Assert.That(Bits(Rng.PExp(0.1)), Is.EqualTo("3ff1aec7b35a00d2"));
            Assert.That(Bits(Rng.PExp(2.5)), Is.EqualTo("40285d6fd931e0bd"));
            Assert.That(Bits(Rng.PLog(0.5)), Is.EqualTo("bfe62e42fefa39ef"));
            Assert.That(Bits(Rng.PLog(1.1)), Is.EqualTo("3fb8663f793c46cc"));
            Assert.That(Bits(Rng.PLog(1000)), Is.EqualTo("401ba18a998fffa0"));
            Assert.That(Fnv.Fnv1a("abc"), Is.EqualTo("1a47e90b"));
            Assert.That(Fnv.Fnv1a(""), Is.EqualTo("811c9dc5"));
        }

        [Test]
        public void RoundHalfUpIsNotBankers()
        {
            Assert.That(MathK.RoundHalfUp(2.5), Is.EqualTo(3));
            Assert.That(MathK.RoundHalfUp(-2.5), Is.EqualTo(-2));
            Assert.That(MathK.RoundHalfUp(0.5), Is.EqualTo(1));
            Assert.That(MathK.Round1k(1500), Is.EqualTo(2000));
            Assert.That(JsFmt.ToFixed(1.005, 2), Is.EqualTo("1.00"));
            Assert.That(JsFmt.ToFixed(0.125, 2), Is.EqualTo("0.13"));
            Assert.That(JsFmt.Loc(1234567), Is.EqualTo("1,234,567"));
            Assert.That(JsFmt.Num(0.1 + 0.2), Is.EqualTo("0.30000000000000004"));
        }

        [TestCaseSource(nameof(Vectors))]
        public void GoldenVector(string name)
        {
            var v = Load(name);
            var g = GameSim.Create(Data, (int)v["seed"]);
            int nev = 0;
            foreach (JObject c in v["commands"]) nev += g.Apply(new SimCommand(c)).Count;
            var S = g.S; var ex = v["expected"];
            string dg = Digest.Of(S);
            if (dg != (string)v["digest"])
            {
                var a = ((string)v["digest"]).Split(';'); var b = dg.Split(';');
                int i = Enumerable.Range(0, Math.Min(a.Length, b.Length)).FirstOrDefault(j => a[j] != b[j]);
                Assert.Fail($"digest 첫 차이 [{i}]: 기대 {a[i]} · 실제 {b[i]}");
            }
            Assert.That(Fnv.Fnv1a(dg), Is.EqualTo((string)ex["hash"]), "hash");
            Assert.That(nev, Is.EqualTo((int)ex["events"]), "events");
            Assert.That(S.ending ?? "", Is.EqualTo((string)ex["end"]), "end");
            Assert.That(S.month, Is.EqualTo((int)ex["month"]));
            Assert.That(S.day, Is.EqualTo((int)ex["day"]));
            Assert.That(S.slot, Is.EqualTo((int)ex["slot"]));
            Assert.That(S.cash, Is.EqualTo((double)ex["cash"]), "cash");
            Assert.That(S.debt, Is.EqualTo((double)ex["debt"]), "debt");
            Assert.That(S.galFame, Is.EqualTo((double)ex["galFame"]));
            Assert.That(S.augs, Is.EqualTo(ex["augs"].Select(x => (string)x).ToList()));
            Assert.That(S.rng, Is.EqualTo((uint)ex["rng"]));
            Assert.That(S.fx, Is.EqualTo((uint)ex["fx"]));
            Assert.That(S.pending?.t ?? "", Is.EqualTo((string)ex["pending"]));
        }

        /// C# 봇이 벡터를 만든 JS 봇과 같은 명령열을 내는지
        [TestCaseSource(nameof(Vectors))]
        public void BotReproducesCommands(string name)
        {
            var v = Load(name);
            var cmds = (JArray)v["commands"];
            var r = Bots.Run(Data, (int)v["seed"], (string)v["strat"], record: true);
            if (name.Contains("first")) Assert.That(r.cmds.Count, Is.GreaterThanOrEqualTo(cmds.Count));
            else Assert.That(r.cmds.Count, Is.EqualTo(cmds.Count));
            for (int i = 0; i < cmds.Count; i++)
                Assert.That(Same(cmds[i], r.cmds[i]), Is.True, $"명령 #{i}: 기대 {cmds[i].ToString(Newtonsoft.Json.Formatting.None)} · 실제 {r.cmds[i].ToString(Newtonsoft.Json.Formatting.None)}");
        }

        static bool Same(JToken a, JToken b)
        {
            var A = (JObject)a; var B = (JObject)b;
            var ka = A.Properties().Where(p => p.Value.Type != JTokenType.Null).Select(p => p.Name).OrderBy(x => x, StringComparer.Ordinal).ToList();
            var kb = B.Properties().Where(p => p.Value.Type != JTokenType.Null).Select(p => p.Name).OrderBy(x => x, StringComparer.Ordinal).ToList();
            if (!ka.SequenceEqual(kb)) return false;
            foreach (var k in ka)
            {
                var x = A[k]; var y = B[k];
                bool nx = x.Type == JTokenType.Integer || x.Type == JTokenType.Float, ny = y.Type == JTokenType.Integer || y.Type == JTokenType.Float;
                if (nx && ny) { if ((double)x != (double)y) return false; }
                else if (!JToken.DeepEquals(x, y)) return false;
            }
            return true;
        }
    }
}
