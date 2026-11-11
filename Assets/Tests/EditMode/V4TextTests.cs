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

        /// 예전 규칙 흔적. "5%" 는 앞이 숫자·점이 아닐 때만 (0.05% · 25% 같은 수수료·유물 수치는 통과)
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
            // 유물 설명(aug.*)은 제 수치(선이자 5% 등)라 제외
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
            string raw = string.Join("\n", Strings(Data.J["SCENES"]["opening"], "opening").Select(x => x.text));
            // 이자·현금은 난이도별이라 자리표시자 ({rate} {due} {cash} {debt}) → 화면(GameController.FillRules)이 이 판 값으로 채움. 여기선 같은 치환으로 보통 난이도 값을 확인
            Assert.That(raw, Does.Contain("{rate}%").And.Contain("{due}").And.Contain("{cash}"), "오프닝은 자리표시자로 (난이도별 수치)");
            var g = GameSim.Create(Data, 3, new GameSim.Opts { rt = true });
            string all = raw.Replace("{rate}", (g.rate() * 100).ToString("0.#", ci)).Replace("{due}", g.won(g.interestDue())).Replace("{cash}", g.won(g.S.cash)).Replace("{debt}", g.won(g.debtStart()));
            Assert.That(all, Does.Contain((R.RT_RATE * 100).ToString("0.#", ci) + "%"), "주 이자율");
            Assert.That(all, Does.Contain(g.won(MathK.Round1k(R.DEBT0 * R.RT_RATE))), "주 이자 금액");
            Assert.That(all, Does.Contain(g.won(R.RT_CASH0)), "시작 현금");
            Assert.That(all, Does.Contain(R.V4_DAYS + "일"), "만기");
            var hard = GameSim.Create(Data, 3, new GameSim.Opts { rt = true, diff = "hard" });
            Assert.That(raw.Replace("{rate}", (hard.rate() * 100).ToString("0.#", ci)), Does.Not.Contain((R.RT_RATE * 100).ToString("0.#", ci) + "%"), "매운맛은 다른 이자율이 보임");
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

        // ---------- 스토리 "미래의 미래" 문구 (docs/BLUEPRINT_V3.md ⑥-18 · 19-3 · 19-4, 인물표 docs/story/MIRAI.md) ----------
        static readonly string[] TextKeys = { "STR", "SCENES", "EVENTS", "KQ", "KQ_X", "MEN_SETS", "MEN_SETS_X", "IMPULSE", "IMPULSE_X", "JOBS", "AUGS", "ITEMS", "ML", "V4_PROM", "MORNING_EV", "MORNING_EV_X", "PC_EV", "PC_EV_X" };
        /// v4 에서 화면에 나올 수 있는 문구 전부 (V4_STR · V4_SCENES · V4_EVENTS 를 덮은 뒤)
        static IEnumerable<(string path, string text)> V4Text() => TextKeys.Where(k => Data.J[k] != null).SelectMany(k => Strings(Data.J[k], k));

        /// ⑥-18 · 19-4: 고친 모순이 다시 들어오지 않게 — 미래가 알바하는 말 · 아들/손주 · 가족을 다 잃은 듯한 말 · 2부 반전을 1부에서 미리 쓰는 말 · 실존 상표
        [Test]
        public void StoryContradictionsStayFixed()
        {
            string[] gone = {
                "미래 씨는 차트", "나 알바 {n}연속", "퇴근! 알바 진짜", "허리 매도했어", "나 대신 알바", "편순이 아니거든", "알바 점장이 나보고", "…알바 가야 되네.",
                "형님 아들이면", "형님 딸이면", "손주 장가",
                "부모님", "돌아가신", "아빠가 남긴", "상속 포기 기한은 지난달",
                "넷플", "박카스" };
            Assert.That(V4Text().Count(), Is.GreaterThan(1000));
            var bad = V4Text().Where(x => gone.Any(g => x.text.Contains(g))).Select(x => $"{x.path}: {x.text}").ToList();
            Assert.That(bad, Is.Empty, string.Join("\n", bad));
        }

        /// 장면이 막다른 길 없이 닫힌다(선택지 2개 이상 · 고르면 결과 대사). 미래 대사는 대사창 두 줄 안(60자), 화자 · 표정은 있는 것만, 자리표시자는 규칙이 채우는 {n} · {b} 뿐
        [Test]
        public void StoryScenesAreWellFormed()
        {
            var faces = new HashSet<string>(((JObject)Data.J["FACES"]).Properties().Select(p => p.Name));
            var who = new HashSet<string> { "m", "me", "kim", "nar" };
            var ph = new Regex(@"\{(\w+)\}");
            var story = Data.EVENTS.Where(e => e.id.StartsWith("v4_")).ToList();
            Assert.That(story.Count, Is.GreaterThanOrEqualTo(20));
            var bad = new List<string>();
            foreach (var e in story)
            {
                if (e.opts == null || e.opts.Count < 2) bad.Add(e.id + ": 선택지가 2개 미만");
                foreach (var l in e.lines)
                {
                    if (!who.Contains(l[0])) bad.Add(e.id + ": 화자 " + l[0]);
                    if (l.Length > 2 && !faces.Contains(l[2])) bad.Add(e.id + ": 표정 " + l[2]);
                    if (l[0] == "m" && l[1].Length > 60) bad.Add(e.id + ": 60자 넘음 — " + l[1]);
                    foreach (Match m in ph.Matches(l[1])) if (m.Groups[1].Value != "n" && m.Groups[1].Value != "b") bad.Add(e.id + ": 자리표시자 " + m.Value);
                }
                foreach (var o in e.opts ?? new List<EvOpt>())
                    foreach (var r in new[] { o, o.fail })
                    {
                        if (r == null) continue;
                        if (string.IsNullOrEmpty(r.res)) { bad.Add(e.id + ": 결과 대사 없음 — " + o.l); continue; }
                        if ((r.who ?? o.who ?? "m") == "m" && r.res.Length > 60) bad.Add(e.id + ": 60자 넘음 — " + r.res);
                        if (r.face != null && !faces.Contains(r.face)) bad.Add(e.id + ": 표정 " + r.face);
                        foreach (Match m in ph.Matches(r.res + (o.sub ?? "") + o.l)) if (m.Groups[1].Value != "n" && m.Groups[1].Value != "b") bad.Add(e.id + ": 자리표시자 " + m.Value);
                    }
            }
            Assert.That(bad, Is.Empty, string.Join("\n", bad));
        }

        /// 갈래 묶음(grp)은 같은 날 · 같은 칸에 걸린 서로 반대 조건의 짝 → 어떤 판에서도 둘이 같이 뜨지 않는다. 조건이 붙은 날짜 장면은 전부 묶음 안에 (묶음 밖이면 다음 날 다른 갈래가 또 뜸)
        [Test]
        public void StoryBranchGroupsArePairsOfOppositeConditions()
        {
            var pair = new Dictionary<string, string> { ["momKnows"] = "momNot", ["momNot"] = "momKnows", ["fundOk"] = "fundBroken", ["fundBroken"] = "fundOk", ["calm"] = "ride", ["ride"] = "calm", ["regYes"] = "regNo", ["regNo"] = "regYes" };
            var groups = Data.EVENTS.Where(e => e.grp != null).GroupBy(e => e.grp).ToList();
            Assert.That(groups.Select(g => g.Key), Is.EquivalentTo(new[] { "v4_mom", "v4_reg", "v4_dad", "v4_after" }));
            foreach (var g in groups)
            {
                var L = g.ToList();
                Assert.That(L.Count, Is.EqualTo(2), g.Key);
                Assert.That(L[0].day, Is.EqualTo(L[1].day), g.Key); Assert.That(L[0].part, Is.EqualTo(L[1].part), g.Key); Assert.That(L[0].slots, Is.EqualTo(L[1].slots), g.Key);
                Assert.That(pair.TryGetValue(L[0].when ?? "", out var other) && other == L[1].when, g.Key + ": " + L[0].when + " / " + L[1].when);
            }
            Assert.That(Data.EVENTS.Where(e => e.day > 0 && e.when != null && e.grp == null).Select(e => e.id), Is.Empty, "조건 붙은 날짜 장면이 묶음 밖에 있음");
        }

        /// ⑥-19-3: 2부 장 카드 4장에 미래 한마디가 있고, 찢긴 보증인 칸을 회수하는 장면이 2부에 있다
        [Test]
        public void Part2CardsSpeakAndGuarantorSceneExists()
        {
            for (int i = 1; i <= 4; i++)
            {
                var sc = Data.J["SCENES"]["p2ch" + i] as JArray;
                Assert.That(sc, Is.Not.Null, "p2ch" + i);
                Assert.That(sc.Any(s => (string)s["say"] == "m" && !string.IsNullOrEmpty((string)s["text"])), "2부 " + i + "장 카드에 미래 대사");
            }
            var g = Data.EVENTS.FirstOrDefault(e => e.id == "v4_p2_guar");
            Assert.That(g, Is.Not.Null); Assert.That(g.part, Is.EqualTo(2));
        }
    }
}
