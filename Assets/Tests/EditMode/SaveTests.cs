using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using KwGame.Persistence;
using KwGame.Sim;
using Newtonsoft.Json.Linq;
using NUnit.Framework;
using UnityEngine;

namespace KwGame.Tests
{
    public class SaveTests
    {
        string directory;
        SaveStore store;
        GameData data;
        [SetUp]
        public void SetUp()
        {
            directory = Path.Combine(Path.GetTempPath(), "kw-save-tests-" + Guid.NewGuid().ToString("N"));
            store = new SaveStore(directory);
            data = GameData.Load(Resources.LoadAll<TextAsset>("Data").Select(a => new KeyValuePair<string, string>(a.name + ".json", a.text)));
        }
        [TearDown]
        public void TearDown() { if (Directory.Exists(directory)) Directory.Delete(directory, true); }
        GameSim Started() { var g = GameSim.Create(data, 87654); g.Apply(new SimCommand("start")); return g; }
        void Save(GameState s) { Assert.That(store.TrySave(s, out var error), Is.True, error); }
        GameState Load() { Assert.That(store.TryLoad(out var r, out var error), Is.True, error); return r.State; }
        static void EqualState(GameState a, GameState b) => Assert.That(JToken.DeepEquals(JToken.FromObject(a), JToken.FromObject(b)), Is.True, "전체 게임 상태가 달라졌습니다.");

        [Test]
        public void MissingSaveDoesNotCreateFiles()
        {
            Assert.That(store.TryLoad(out _, out var error), Is.False);
            Assert.That(error, Is.Null);
            Assert.That(Directory.Exists(directory), Is.False);
        }
        [Test]
        public void OrderedMapsNestedArraysAndNullableTuplesRoundTrip()
        {
            var s = Started().S;
            s.owned.Set("second", 2); s.owned.Set("third", 3);
            s.hold.Set("test", new Holding { q = 2.125, cost = 1234.5 });
            s.st.g = new Dictionary<string, double[]> { ["slot"] = new[] { 1d, 2d, 3d } };
            s.pending = new Pending("scratch") { loc = "lotto", card = new ScratchCard { sym = new List<string> { "a", "b", "c" }, prize = ("gold", 12345.25, 0.125), done = true }, setup = new WorkSetup { orders = new List<int[]> { new[] { 1, 2 } }, u = new[] { 0.25 }, drops = new List<double[]> { new[] { 0.5, 2d } } } };
            s.shocks[12] = new Dictionary<string, double> { ["test"] = 0.0125 };
            s.kimpDay = 3;
            Save(s); var loaded = Load();
            EqualState(s, loaded);
            Assert.That(loaded.owned.Keys, Is.EqualTo(s.owned.Keys));
            Assert.That(loaded.pending.card.prize.Value.amt, Is.EqualTo(12345.25));
            Assert.That(loaded.rng, Is.EqualTo(s.rng)); Assert.That(loaded.fx, Is.EqualTo(s.fx));
        }
        [Test]
        public void CorruptPrimaryLoadsBackupAndRepairKeepsLastGoodBackup()
        {
            var s = Started().S; Save(s); double previous = s.cash;
            s.cash += 100; Save(s);
            File.WriteAllText(store.SavePath, "{broken");
            Assert.That(store.TryLoad(out var r, out _), Is.True);
            Assert.That(r.FromBackup, Is.True); Assert.That(r.State.cash, Is.EqualTo(previous));
            s.cash += 100; Save(s);
            File.WriteAllText(store.SavePath, "broken again");
            Assert.That(Load().cash, Is.EqualTo(previous));
        }
        [Test]
        public void ModifiedPayloadAndUnsupportedVersionAreRejected()
        {
            Save(Started().S);
            var json = JObject.Parse(File.ReadAllText(store.SavePath));
            json["checksum"] = "wrong";
            File.WriteAllText(store.SavePath, json.ToString());
            Assert.That(store.TryLoad(out _, out _), Is.False);
            json["formatVersion"] = 999;
            File.WriteAllText(store.SavePath, json.ToString());
            Assert.That(store.TryLoad(out _, out var error), Is.False); Assert.That(error, Does.Contain("버전"));
        }
        [Test]
        public void FailedWritePreservesPreviousSave()
        {
            var s = Started().S; Save(s); byte[] previous = File.ReadAllBytes(store.SavePath);
            using (var locked = new FileStream(store.SavePath, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
            {
                s.cash += 200;
                Assert.That(store.TrySave(s, out _), Is.False);
            }
            Assert.That(File.ReadAllBytes(store.SavePath), Is.EqualTo(previous));
            Assert.That(File.Exists(store.SavePath + ".tmp"), Is.False);
        }
        [Test]
        public void InvalidStateDoesNotOverwriteSave()
        {
            var s = Started().S; Save(s); var bytes = File.ReadAllBytes(store.SavePath);
            s.rngv = 1;
            Assert.That(store.TrySave(s, out _), Is.False);
            Assert.That(File.ReadAllBytes(store.SavePath), Is.EqualTo(bytes));
        }
        [TestCaseSource(typeof(GoldenTests), nameof(GoldenTests.Vectors))]
        public void ResumeMatchesUninterruptedCommandsAndFullState(string name)
        {
            var root = Path.Combine(Application.dataPath, "Tests/EditMode/Golden");
            var goldenData = GameData.Load(Directory.GetFiles(Path.Combine(root, "data"), "*.json").Select(f => new KeyValuePair<string, string>(Path.GetFileName(f), File.ReadAllText(f))));
            var vector = JObject.Parse(File.ReadAllText(Path.Combine(root, "vectors", name + ".json")));
            var commands = ((JArray)vector["commands"]).Cast<JObject>().ToArray();
            var original = GameSim.Create(goldenData, (int)vector["seed"]);
            int split = Math.Max(1, commands.Length / 2);
            for (int i = 0; i < split; i++) original.Apply(new SimCommand(commands[i]));
            Save(original.S);
            var resumed = new GameSim(goldenData, Load());
            EqualState(original.S, resumed.S);
            for (int i = split; i < commands.Length; i++)
            {
                var a = original.Apply(new SimCommand(commands[i]));
                var b = resumed.Apply(new SimCommand(commands[i]));
                Assert.That(JToken.DeepEquals(JToken.FromObject(a), JToken.FromObject(b)), Is.True, "복원 후 이벤트가 달라졌습니다: " + i);
            }
            EqualState(original.S, resumed.S);
        }
    }
}
