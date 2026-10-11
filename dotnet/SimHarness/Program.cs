using System; using System.IO; using System.Linq; using System.Collections.Generic;
using KwGame.Sim; using Newtonsoft.Json.Linq;
static class P {
  static bool Same(JToken a, JToken b) {
    var A = (JObject)a; var B = (JObject)b;
    var ka = A.Properties().Where(p => p.Value.Type != JTokenType.Null).Select(p => p.Name).OrderBy(x=>x).ToList();
    var kb = B.Properties().Where(p => p.Value.Type != JTokenType.Null).Select(p => p.Name).OrderBy(x=>x).ToList();
    if (!ka.SequenceEqual(kb)) return false;
    foreach (var k in ka) { var x = A[k]; var y = B[k];
      bool nx = x.Type == JTokenType.Integer || x.Type == JTokenType.Float, ny = y.Type == JTokenType.Integer || y.Type == JTokenType.Float;
      if (nx && ny) { if ((double)x != (double)y) return false; }
      else if (!JToken.DeepEquals(x, y)) return false; }
    return true;
  }
  static int Main(string[] a) {
    string root = Environment.GetEnvironmentVariable("GOLDEN_ROOT") ?? Path.Combine(AppContext.BaseDirectory, "../../../../../Assets/Tests/EditMode/Golden");
    uint s = 1; var o = new List<uint>(); for (int i=0;i<5;i++) o.Add(Rng.Next(ref s));
    Console.WriteLine("seed1: " + string.Join(",", o) + " state " + s);
    s = 1; Console.WriteLine($"{Rng.Float(ref s):R} {Rng.Float(ref s):R} {Rng.Float(ref s):R} {Rng.Gauss(ref s):R} {Rng.Gauss(ref s):R} {Rng.Gauss(ref s):R} st {s}");
    Console.WriteLine($"{Rng.PExp(-0.5):R} {BitConverter.DoubleToInt64Bits(Rng.PExp(2.5)):x16} {BitConverter.DoubleToInt64Bits(Rng.PLog(1000)):x16} {Fnv.Fnv1a("abc")} {Fnv.Fnv1a("")}");
    var files = Directory.GetFiles(root + "/data", "*.json").Select(f => new KeyValuePair<string,string>(Path.GetFileName(f), File.ReadAllText(f)));
    var D = GameData.Load(files);
    int pass = 0, fail = 0; string only = a.Length > 0 ? a[0] : null;
    foreach (var f in Directory.GetFiles(root + "/vectors", "*.json").OrderBy(x => x, StringComparer.Ordinal)) {
      var v = JObject.Parse(File.ReadAllText(f)); string name = (string)v["name"];
      if (only != null && !name.Contains(only)) continue;
      var g = GameSim.Create(D, (int)v["seed"]); int nev = 0; int ci = 0; string exc = null;
      try { foreach (JObject c in v["commands"]) { nev += g.Apply(new SimCommand(c)).Count; ci++; } } catch (Exception e) { exc = $"cmd#{ci} {v["commands"][ci]} {e}"; }
      var ex = v["expected"]; string dg = Digest.Of(g.S), h = Fnv.Fnv1a(dg);
      bool ok = exc == null && h == (string)ex["hash"] && nev == (int)ex["events"];

      if (ok) pass++; else { fail++;
        Console.WriteLine($"FAIL {name}: hash {h} vs {ex["hash"]} events {nev} vs {ex["events"]} {exc}");
        var A = ((string)v["digest"]).Split(';'); var B = dg.Split(';');
        for (int i=0;i<Math.Min(A.Length,B.Length);i++) if (A[i]!=B[i]) { Console.WriteLine($"  first diff [{i}] {A[i]} != {B[i]}"); break; }
      }
    }
    Console.WriteLine($"golden: {pass} pass, {fail} fail");
    int bp = 0, bf = 0;
    foreach (var f in Directory.GetFiles(root + "/vectors", "*.json").OrderBy(x => x, StringComparer.Ordinal)) {
      var v = JObject.Parse(File.ReadAllText(f)); string name = (string)v["name"];
      var cmds = (JArray)v["commands"];
      var r = Bots.Run(D, (int)v["seed"], (string)v["strat"], true);
      int n = cmds.Count; bool ok = name.Contains("first") ? r.cmds.Count >= n : r.cmds.Count == n; int bad = -1;
      for (int i = 0; i < Math.Min(n, r.cmds.Count); i++) if (!Same(cmds[i], r.cmds[i])) { bad = i; ok = false; break; }
      if (ok) bp++; else { bf++; Console.WriteLine($"BOT FAIL {name}: n {r.cmds.Count} vs {n} first diff #{bad} {(bad>=0?cmds[bad].ToString(Newtonsoft.Json.Formatting.None):"")} vs {(bad>=0?r.cmds[bad].ToString(Newtonsoft.Json.Formatting.None):"")}"); }
    }
    Console.WriteLine($"bots: {bp} pass, {bf} fail");
    return fail;
  }
}
