using System.Collections.Generic;
using KwGame.Audio;
using KwGame.Sim;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;

namespace KwGame.Tests
{
    public class SoundTests
    {
        static SimEvent Event(string type, params object[] values)
        {
            var fields = new Dictionary<string, object>();
            for (int i = 0; i < values.Length; i += 2) fields.Add((string)values[i], values[i + 1]);
            return new SimEvent { t = type, d = fields };
        }

        [TestCase("buy")]
        [TestCase("sell")]
        [TestCase("open")]
        [TestCase("close")]
        public void OnlySuccessfulTradeProducesOrderSound(string operation)
        {
            Assert.That(SoundEventAdapter.IsSuccessfulOrder(Event("trade", "op", operation, "ok", true), 0), Is.True);
            Assert.That(SoundEventAdapter.IsSuccessfulOrder(Event("trade", "op", operation, "ok", false), 0), Is.False);
        }

        [Test]
        public void EmptyCloseCoinsDoesNotProduceOrderOrFinancialSound()
        {
            var e = Event("trade", "op", "closeCoins", "ok", true, "pnl", 0d);
            Assert.That(SoundEventAdapter.IsSuccessfulOrder(e, 0), Is.False);
            Assert.That(SoundEventAdapter.FinancialCue(e), Is.Null);
            Assert.That(SoundEventAdapter.IsSuccessfulOrder(e, 1), Is.True);
        }

        [TestCase("buy")]
        [TestCase("open")]
        public void PrincipalAndMarginAreNotLosses(string operation)
        {
            Assert.That(SoundEventAdapter.FinancialCue(Event("trade", "op", operation, "ok", true, "amt", 50000d, "margin", 50000d)), Is.Null);
        }

        [TestCase("sell", 15000, SoundCue.Income)]
        [TestCase("sell", -5000, SoundCue.Loss)]
        [TestCase("close", 15000, SoundCue.Income)]
        [TestCase("close", -5000, SoundCue.Loss)]
        [TestCase("closeCoins", 15000, SoundCue.Income)]
        [TestCase("closeCoins", -5000, SoundCue.Loss)]
        public void RealizedTradeProfitDeterminesFinancialSound(string operation, double pnl, SoundCue expected)
        {
            var e = Event("trade", "op", operation, "ok", true, "pnl", pnl);
            Assert.That(SoundEventAdapter.FinancialCue(e, 2), Is.EqualTo(expected));
            e.d["ok"] = false;
            Assert.That(SoundEventAdapter.FinancialCue(e, 2), Is.Null);
        }

        [TestCase("cash", "d")]
        [TestCase("casino", "net")]
        [TestCase("race", "net")]
        public void FinancialEventsUseTheirSignedResult(string type, string field)
        {
            Assert.That(SoundEventAdapter.FinancialCue(Event(type, field, 100d)), Is.EqualTo(SoundCue.Income));
            Assert.That(SoundEventAdapter.FinancialCue(Event(type, field, -100d)), Is.EqualTo(SoundCue.Loss));
            Assert.That(SoundEventAdapter.FinancialCue(Event(type, field, 0d)), Is.Null);
        }

        [Test]
        public void ScratchUsesCurrentPrizeNotCumulativeWinnings()
        {
            Assert.That(SoundEventAdapter.FinancialCue(Event("scratch", "prize", null, "got", 100000d)), Is.Null);
            Assert.That(SoundEventAdapter.FinancialCue(Event("scratch", "prize", new object[] { "gold", 10000d, 0.5 }, "got", 100000d)), Is.EqualTo(SoundCue.Income));
            Assert.That(SoundEventAdapter.FinancialCue(Event("lottoDraw", "tot", 0d)), Is.Null);
            Assert.That(SoundEventAdapter.FinancialCue(Event("lottoDraw", "tot", 10000d)), Is.EqualTo(SoundCue.Income));
        }

        [TestCase("stake")]
        [TestCase("repaid")]
        [TestCase("debt")]
        [TestCase("morning")]
        [TestCase("tick")]
        [TestCase("toast")]
        [TestCase("addictEv")]
        [TestCase("report")]
        public void PrincipalMovementsAndRepeatedPresentationAreSilent(string type)
        {
            var e = Event(type, "d", 10000d, "net", -10000d, "amt", 10000d, "ok", true);
            Assert.That(SoundEventAdapter.IsSuccessfulOrder(e, 0), Is.False);
            Assert.That(SoundEventAdapter.FinancialCue(e), Is.Null);
        }

        [Test]
        public void OnlyLiquidationEffectProducesLossSound()
        {
            Assert.That(SoundEventAdapter.FinancialCue(Event("fx", "k", "ash")), Is.EqualTo(SoundCue.Loss));
            Assert.That(SoundEventAdapter.FinancialCue(Event("fx", "k", "flex", "amt", 10000d)), Is.Null);
            Assert.That(SoundEventAdapter.FinancialCue(Event("fx", "k", "crack", "amt", -10000d)), Is.Null);
        }

        [Test]
        public void DefaultCatalogReferencesAllFiveClipsWithCorrectImportSettings()
        {
            var catalog = Resources.Load<SoundCatalog>(SoundCatalog.ResourcePath);
            Assert.That(catalog, Is.Not.Null);
            foreach (SoundCue cue in System.Enum.GetValues(typeof(SoundCue)))
            {
                var clip = catalog.Get(cue).clip;
                Assert.That(clip, Is.Not.Null, cue.ToString());
                Assert.That(clip.length, Is.GreaterThan(0));
                var importer = (AudioImporter)AssetImporter.GetAtPath(AssetDatabase.GetAssetPath(clip));
                bool music = cue == SoundCue.BackgroundMusic;
                Assert.That(importer.defaultSampleSettings.loadType, Is.EqualTo(music ? AudioClipLoadType.Streaming : AudioClipLoadType.DecompressOnLoad));
                Assert.That(importer.defaultSampleSettings.preloadAudioData, Is.EqualTo(!music));
            }
        }
    }
}
