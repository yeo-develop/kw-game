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
    // ./unity simtest balance [판 수] [전략,..] — 실시간 밸런스 봇 (현재 Resources/Data)
    if (a.Length > 0 && a[0] == "balance") {
      // BAL_RULES='{"RT_X":1}' = rules.json 덮어써서 실험 (파일은 안 바꿈)
      string patch = Environment.GetEnvironmentVariable("BAL_RULES");
      var BD = GameData.Load(Directory.GetFiles(Path.Combine(AppContext.BaseDirectory, "../../../../../Assets/Resources/Data"), "*.json").Select(f => {
        string txt = File.ReadAllText(f);
        if (patch != null && Path.GetFileName(f) == "rules.json") { var j = JObject.Parse(txt); ((JObject)j["RULES"]).Merge(JObject.Parse(patch), new JsonMergeSettings { MergeArrayHandling = MergeArrayHandling.Replace }); txt = j.ToString(); }
        if (patch != null && Path.GetFileName(f) == "unity_v4.json") { var j = JObject.Parse(txt); ((JObject)j["V4_RULES"]).Merge(JObject.Parse(patch), new JsonMergeSettings { MergeArrayHandling = MergeArrayHandling.Replace }); txt = j.ToString(); }   // v4 규칙은 rules.json 위에 덮이니 같이
        return new KeyValuePair<string,string>(Path.GetFileName(f), txt); }));
      int n = a.Length > 1 ? int.Parse(a[1]) : 60;
      var strats = a.Length > 2 ? a[2].Split(',') : new[] { "work", "smart", "gamble", "random" };
      RtBots.ForceRelic = Environment.GetEnvironmentVariable("BAL_FORCE");
      string tr = Environment.GetEnvironmentVariable("BAL_TRACE");
      if (tr != null) { RtBots.Trace = Console.WriteLine; var rr = RtBots.Run(BD, int.Parse(tr) * 104729, strats[0]); Console.WriteLine($"{rr.end} d{rr.day} errs {rr.errs} {rr.lastErr}"); return 0; }
      if (Environment.GetEnvironmentVariable("BAL_RELIC") != null) {
        foreach (var st in strats) {
          var L = Enumerable.Range(1, n).Select(s => RtBots.Run(BD, s * 104729, st)).ToList();
          foreach (var g in L.GroupBy(x => x.relic).OrderBy(g => g.Key))
            Console.WriteLine($"{st} {g.Key,-9} n={g.Count(),3} 클리어 {(double)g.Count(x => x.end == "clear") / g.Count():P0} 평균 {(g.Any(x => x.end == "clear") ? g.Where(x => x.end == "clear").Average(x => x.day) : 0):F1}일 배드 {(double)g.Count(x => x.end != "clear" && x.end != "none") / g.Count():P0} 남은빚 {g.Average(x => x.end == "clear" ? 0 : x.debt) / 1e4:F0}만");
        }
        return 0;
      }
      foreach (var st in strats) {
        var mg = (Environment.GetEnvironmentVariable("MG") ?? "0.55,0.85").Split(',').Select(double.Parse).ToArray();
        Console.WriteLine(RtBots.Summarize(BD, st, n, 1, 70, mg[0], mg[1]));
        if (Environment.GetEnvironmentVariable("BAL_SEEDS") != null)
          Console.WriteLine("  못 깬 시드: " + string.Join(",", Enumerable.Range(1, n).Where(s => RtBots.Run(BD, s * 104729, st).end != "clear")));
      }
      return 0;
    }
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
    // LLM 녹화 응답 픽스처 (web/tests/llm → ./unity sync-llm → Assets/Tests/EditMode/Llm)
    string lroot = Environment.GetEnvironmentVariable("LLM_ROOT") ?? Path.Combine(root, "../Llm");
    int lf = 0;
    if (File.Exists(lroot + "/fixture.json")) {
      var LD = GameData.Load(Directory.GetFiles(lroot + "/data", "*.json").Select(f => new KeyValuePair<string,string>(Path.GetFileName(f), File.ReadAllText(f))));
      var bad = LlmFixture.Check(LD, JObject.Parse(File.ReadAllText(lroot + "/fixture.json")));
      foreach (var b in bad.Take(10)) Console.WriteLine("LLM FAIL " + b);
      lf = bad.Count;
      Console.WriteLine(bad.Count == 0 ? "llm fixture: pass" : $"llm fixture: {bad.Count} fail");
    } else Console.WriteLine("llm fixture: 없음 (" + lroot + ")");
    return fail + lf;
  }
}
