using System.Collections.Generic;
using System.IO;
using System.Linq;
using KwGame.Sim;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEngine;

namespace KwGame.Tests
{
    // 실시간 모드 밸런스 (RtBots, 고정 시드 40판 × 70일). 수치 바꾸면 ./unity simtest balance 300 으로 다시 재고 밴드도 같이 손볼 것.
    // 목표: 알바만 = 제자리(못 갚지만 안 망함) · 리포트 정석 = 대부분 클리어 · 올인 도박 = 대부분 금방 끌려감(가끔 대박) · 막 하기 = 못 갚음
    // 40판 값은 300판 문서 표(docs/UNITY.md §3.1)와 조금 다름 (예: 도박 클리어 40판 10% vs 300판 4%). 난수 쓰는 순서가 바뀌면 밴드 가장자리(도박 클리어 ≤15%, VIP 중앙 ≥18일)가 먼저 깨질 수 있음 → 300판으로 다시 재고 판단.
    // 1분쯤 걸림: 빠르게 돌릴 땐 ./unity test edit 에 필터 (예: RealtimeTests)
    [Category("Balance")]
    public class BalanceTests
    {
        const int N = 40;
        static GameData _data;
        static GameData Data => _data ??= GameData.Load(Directory.GetFiles(Path.Combine(Application.dataPath, "Resources/Data"), "*.json").Where(f => Path.GetFileName(f) != "unity_v4.json")   // v4 이전 실시간 규칙 (v4 는 V4Tests)

            .Select(f => new KeyValuePair<string, string>(Path.GetFileName(f), File.ReadAllText(f))));
        static readonly Dictionary<string, RtBots.Summary> cache = new Dictionary<string, RtBots.Summary>();
        static RtBots.Summary Sum(string strat, double lo = 0.55, double hi = 0.85, string relic = null)
        {
            string k = strat + lo + hi + relic;
            if (cache.TryGetValue(k, out var s)) return s;
            RtBots.ForceRelic = relic;
            try { s = RtBots.Summarize(Data, strat, N, 1, 70, lo, hi); } finally { RtBots.ForceRelic = null; }
            TestContext.WriteLine(s);
            return cache[k] = s;
        }
        const double MAN = 10000;

        [Test]
        public void BotsPlayWithoutCommandErrors()
        {
            foreach (var st in new[] { "work", "smart", "smart0", "gamble", "random" })
                Assert.That(Sum(st).errs, Is.EqualTo(0), st + " 봇이 잘못된 명령을 보냄");
        }

        [Test]
        public void WorkOnlyStaysAfloatButNeverClears()
        {
            var s = Sum("work");
            Assert.That(s.clear, Is.EqualTo(0), "알바만으로 10주 안에 빚을 다 갚으면 안 됨");
            Assert.That(s.bad, Is.EqualTo(0), "평균 실력 알바만으로 끌려가면 안 됨");
            Assert.That(s.debtEnd, Is.InRange(2400 * MAN, 3200 * MAN), "알바만 = 이자 겨우 냄 (빚 거의 제자리)");
            Assert.That(s.earnPerDay, Is.InRange(15 * MAN, 25 * MAN), "알바 하루 2탕 ≈ 15~25만");
            Assert.That(s.menheras, Is.LessThan(12), "카톡 읽고 쉬어 가며 일하면 멘헤라는 가끔");
        }

        [Test]
        public void LowSkillWorkSlowlySinks()
        {
            var lo = Sum("work", 0.2, 0.4); var hi = Sum("work", 0.8, 1.0);
            Assert.That(lo.debtEnd, Is.GreaterThan(Sum("work").debtEnd), "미니게임 못하면 빚이 늘어남");
            Assert.That(hi.debtEnd, Is.LessThan(Sum("work").debtEnd), "잘하면 조금씩 줄어듦");
            Assert.That(hi.clear, Is.EqualTo(0), "잘해도 알바만으론 못 갚음");
        }

        [Test]
        public void ReportTraderUsuallyClears()
        {
            var s = Sum("smart");
            Assert.That(s.clear, Is.GreaterThanOrEqualTo(0.8), "종잣돈 + 리포트·박대리 정보 따라가면 대부분 클리어");
            Assert.That(s.p50, Is.InRange(25, 50), "클리어 중앙값 4~7주");
            Assert.That(s.sellRet, Is.InRange(0.05, 0.2), "정보 따라 한 매매 평균 수익 5~20% (너무 세면 리포트 OP)");
            Assert.That(s.bad, Is.EqualTo(0));
        }

        [Test]
        public void FirstTimerWithoutLoanCanStillClimbOut()
        {
            var s0 = Sum("smart0"); var s = Sum("smart");
            Assert.That(s0.clear, Is.GreaterThanOrEqualTo(0.6), "김사장 돈 안 빌려도 시작 현금으로 굴려서 빠져나올 수 있어야 함 (RT_CASH0)");
            Assert.That(s0.p50, Is.GreaterThan(s.p50), "종잣돈 빌리는 쪽이 더 빠름 (사채가 의미 있는 선택)");
        }

        [Test]
        public void AllInGamblerMostlyGetsDraggedAway()
        {
            var s = Sum("gamble");
            Assert.That(s.bad, Is.GreaterThanOrEqualTo(0.8), "한도까지 땡겨 올인 = 대부분 끌려감");
            Assert.That(s.badDay, Is.LessThan(21), "망하는 건 금방 (3주 안)");
            Assert.That(s.clear, Is.InRange(0.0, 0.15), "대박 클리어는 드물게");
        }

        [Test]
        public void OverworkAndMenheraEndingsStayRare()
        {
            // bad3(기절 3번 = 과로) · bad4(멘헤라 나쁜 답장 6번 + 스트레스 꽉 참) 는 쉬고 카톡 읽으면 피함 → 정석·알바 봇은 0, 도박 봇은 가끔
            foreach (var st in new[] { "work", "smart", "smart0", "gamble" }) Assert.That(Sum(st).End("bad3"), Is.EqualTo(0), st + " 과로 엔딩");
            foreach (var st in new[] { "work", "smart", "smart0" }) Assert.That(Sum(st).End("bad4"), Is.EqualTo(0), st + " 멘헤라 엔딩");
            Assert.That(Sum("gamble").End("bad4"), Is.LessThan(0.1), "도박 봇은 대부분 이자로 끌려감 (멘헤라 엔딩은 가끔)");
        }

        [Test]
        public void RandomPlayDoesNotClear()
        {
            var s = Sum("random");
            Assert.That(s.clear, Is.LessThanOrEqualTo(0.05));
            Assert.That(s.debtEnd, Is.GreaterThan(Sum("work").debtEnd), "막 하면 알바만 한 것보다 못함");
        }

        [Test]
        public void VipRelicIsStrongButNotAutoWin()
        {
            var v = Sum("smart", relic: "vip"); var g = Sum("smart", relic: "grind");
            Assert.That(v.p50, Is.GreaterThanOrEqualTo(18), "VIP(무료 리포트 2개) 강제여도 3주는 걸려야 함");
            Assert.That(v.p50, Is.GreaterThanOrEqualTo(g.p50 * 0.65), "VIP 가 다른 유품보다 압도적으로 빠르면 안 됨");
        }

        [Test]
        public void RealtimeStartCashMatchesIntroCard()
        {
            var g = GameSim.Create(Data, 1, new GameSim.Opts { rt = true });
            Assert.That(g.S.cash, Is.EqualTo(Data.RULES.RT_CASH0));
            Assert.That(GameSim.Create(Data, 1).S.cash, Is.EqualTo(Data.RULES.CASH0), "턴 모드 시작 현금은 그대로");
            var scenes = JObject.Parse(File.ReadAllText(Path.Combine(Application.dataPath, "Resources/Data/scenes.json")));
            var cards = scenes.Descendants().OfType<JObject>().Where(o => (string)o["do"] == "card" && o["sub"] != null).Select(o => (string)o["sub"]).ToList();
            Assert.That(cards.Any(c => c.Contains(g.won(Data.RULES.RT_CASH0))), "인트로 카드의 '남은 돈'이 실제 시작 현금과 같아야 함: " + string.Join(" / ", cards));
        }

        // ---------- 카지노: 모든 판이 장기적으론 손해 ----------
        static double CasinoEv(string kind, int n = 20000)
        {
            var g = GameSim.Create(Data, 777, new GameSim.Opts { rt = true }); var S = g.S; var r = new System.Random(5);
            S.cash = 1e12; S.visit = new Visit { key = "casino" };
            double staked = 0, back = 0;
            for (int i = 0; i < n; i++)
            {
                int A = 1 + r.Next(13);
                S.pending = new Pending("casino") { kind = kind, loc = "casino", A = A, rounds = 0, before = S.cash };
                int ch = kind == "card" ? (A <= 7 ? 1 : 0) : kind == "ladder" ? r.Next(3) : r.Next(2);
                double c0 = S.cash;
                g.Apply(new SimCommand("bet", "stake", 10000, "choice", ch));
                staked += 10000; back += S.cash - c0 + 10000;
            }
            return back / staked;
        }

        [Test]
        public void CasinoGamesAllHaveAHouseEdge()
        {
            foreach (var k in new[] { "oddeven", "slot", "ladder", "card" })
            {
                double ev = CasinoEv(k);
                TestContext.WriteLine($"{k} 기대값 {ev:F3}");
                Assert.That(ev, Is.LessThan(1.0), k + " 은 장기적으로 손해여야 함");
                Assert.That(ev, Is.GreaterThan(0.7), k + " 이 너무 짜면 아무도 안 함");
            }
            Assert.That(CasinoEv("card"), Is.InRange(0.72, 0.86), "실시간 하이로우 ≈ 0.79 (같은 숫자 = 딜러 승, 배당 ×0.9)");
            double sc = Data.SC_PRIZE.Sum(p => p.amt * p.p) / Data.RULES.SCRATCH_PRICE;
            Assert.That(sc, Is.InRange(0.6, 1.0), "즉석 복권 기대값");
        }
    }
}
