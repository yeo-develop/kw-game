using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using KwGame.Sim;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEngine;

namespace KwGame.Tests
{
    // v4 화면 문구 (unity_v4.json V4_STR · V4_SCENES 를 덮은 뒤): 예전 규칙(월 5% · 시간 제한 없음 · 개월차)이 플레이어 눈에 안 남게
    public class V4TextTests
    {
        static GameData _data;
        static GameData Data => _data ??= GameData.Load(Directory.GetFiles(Path.Combine(Application.dataPath, "Resources/Data"), "*.json")
            .Select(f => new KeyValuePair<string, string>(Path.GetFileName(f), File.ReadAllText(f))));

        /// 예전 규칙 흔적. "5%" 는 앞이 숫자·점이 아닐 때만 (0.05% · 25% 같은 수수료·유품 수치는 통과)
        static readonly Regex Stale = new Regex(@"(?<![\d.])5%|시간 제한 없음|개월차|이번 달|다음 달");

        static IEnumerable<(string path, string text)> Strings(JToken t, string path)
        {
            if (t is JValue v && v.Type == JTokenType.String) { yield return (path, (string)v); yield break; }
            if (t is JObject o) foreach (var p in o.Properties()) foreach (var x in Strings(p.Value, path + "." + p.Name)) yield return x;
            if (t is JArray a) for (int i = 0; i < a.Count; i++) foreach (var x in Strings(a[i], $"{path}[{i}]")) yield return x;
        }

        [Test]
        public void MergedStringsHaveNoOldMonthlyRules()
        {
            Assert.That(Data.RULES.V4, Is.GreaterThan(0), "unity_v4.json 이 켜져 있어야 함");
            // 유품 설명(aug.*)은 제 수치(선이자 5% 등)라 제외
            var bad = Data.STR.Properties().Where(p => !p.Name.StartsWith("aug."))
                .SelectMany(p => Strings(p.Value, "STR." + p.Name)).Where(x => Stale.IsMatch(x.text)).Select(x => $"{x.path}: {x.text}").ToList();
            Assert.That(bad, Is.Empty, string.Join("\n", bad));
        }

        [Test]
        public void MergedScenesHaveNoOldMonthlyRules()
        {
            var bad = Strings(Data.J["SCENES"], "SCENES").Where(x => Stale.IsMatch(x.text)).Select(x => $"{x.path}: {x.text}").ToList();
            Assert.That(bad, Is.Empty, string.Join("\n", bad));
        }

        [Test]
        public void OpeningStatesV4NumbersFromRules()
        {
            var R = Data.RULES; var ci = CultureInfo.InvariantCulture;
            string all = string.Join("\n", Strings(Data.J["SCENES"]["opening"], "opening").Select(x => x.text));
            Assert.That(all, Does.Contain((R.RT_RATE * 100).ToString("0.#", ci) + "%"), "주 이자율");
            Assert.That(all, Does.Contain(MathK.Round1k(R.DEBT0 * R.RT_RATE) / 10000 + "만"), "주 이자 금액");
            Assert.That(all, Does.Contain(R.RT_CASH0.ToString("#,0", ci) + "원"), "시작 현금");
            Assert.That(all, Does.Contain(R.V4_DAYS + "일"), "만기");
            int says = Data.J["SCENES"]["opening"].Count(s => s["say"] != null);
            Assert.That(says, Is.LessThanOrEqualTo(12), "오프닝 대사는 핵심만");
        }

        [Test]
        public void V4ViewKeysExist()
        {
            var g = GameSim.Create(Data, 3, new GameSim.Opts { rt = true });
            foreach (var k in new[] { "v4.goalDuo", "v4.tag.duo", "v4.tag.sea", "v4.loanLock", "v4.credit.next1" })
                Assert.That(g.T(k), Is.Not.Null.And.Not.Empty, k);
            Assert.That(g.T("v4.tag.duo"), Does.Not.Contain("이자 미납"));
            Assert.That(g.T("v4.goalDuo", "t", "1,800만", "a", 60, "d", "3,000만"), Is.EqualTo("만기 목표: 빚 1,800만 이하 + 호감 60 → 미래랑 같이 (지금 3,000만)"));
        }
    }
}
