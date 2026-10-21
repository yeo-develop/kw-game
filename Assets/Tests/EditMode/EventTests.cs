using System.Collections.Generic;
using System.IO;
using System.Linq;
using KwGame.Sim;
using NUnit.Framework;
using UnityEngine;

namespace KwGame.Tests
{
    // 돌발 이벤트 (Resources/Data/unity_events.json, GameSim.Events.cs)
    public class EventTests
    {
        static GameData _data;
        static GameData Data => _data ??= GameData.Load(Directory.GetFiles(Path.Combine(Application.dataPath, "Resources/Data"), "*.json")
            .Select(f => new KeyValuePair<string, string>(Path.GetFileName(f), File.ReadAllText(f))));
        static readonly string[] WHO = { "m", "me", "kim", "nar" };
        static readonly string[] FACES = { "neutral", "happy", "smug", "sad", "panic", "tired", "angry", "menhera", "flex", "cry", "shy", "yami", "pout", "love" };

        [Test]
        public void EventDataIsWellFormed()
        {
            Assert.That(Data.EVENTS.Count, Is.GreaterThanOrEqualTo(10));
            Assert.That(Data.EVENTS.Select(e => e.id).Distinct().Count(), Is.EqualTo(Data.EVENTS.Count), "id 중복");
            foreach (var e in Data.EVENTS)
            {
                Assert.That(e.title, Is.Not.Empty, e.id);
                Assert.That(e.opts.Count, Is.InRange(2, 3), e.id);
                foreach (var ln in e.lines)
                {
                    Assert.That(WHO, Does.Contain(ln[0]), e.id);
                    if (ln.Length > 2) Assert.That(FACES, Does.Contain(ln[2]), e.id);
                }
                foreach (var o in e.opts.Concat(e.opts.Where(o => o.fail != null).Select(o => o.fail)))
                {
                    if (o.face != null) Assert.That(FACES, Does.Contain(o.face), e.id);
                    if (o.who != null) Assert.That(WHO, Does.Contain(o.who), e.id);
                }
                foreach (var o in e.opts) if (o.p < 1) Assert.That(o.fail, Is.Not.Null, e.id + " 확률 선택지엔 fail 필요");
            }
        }

        [Test]
        public void BotsPlayThroughEventsWithoutErrors()
        {
            int seen = 0;
            foreach (var strat in new[] { "random", "steady" })
                for (int s = 1; s <= 30; s++)
                {
                    var r = Bots.Run(Data, s * 7919, strat);
                    Assert.That(r.errs, Is.Zero, $"{strat} seed {s}");
                    seen += r.game.S.evSeen.Count;
                }
            Assert.That(seen, Is.GreaterThan(100));
        }

        [Test]
        public void ExtraPoolsAreMerged()
        {
            Assert.That(Data.MORNING_EV.Count, Is.GreaterThanOrEqualTo(20));
            Assert.That(Data.KQ.Count, Is.GreaterThanOrEqualTo(25));
            Assert.That(Data.MEN_SETS.Count, Is.GreaterThanOrEqualTo(8));
        }
    }
}
