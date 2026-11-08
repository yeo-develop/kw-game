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
      RtBots.Part2 = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("BAL_PART2"));
      string tr = Environment.GetEnvironmentVariable("BAL_TRACE");
      if (tr != null) { RtBots.Trace = Console.WriteLine; var rr = RtBots.Run(BD, int.Parse(tr) * 104729, strats[0]); Console.WriteLine($"{rr.end} d{rr.day} errs {rr.errs} {rr.lastErr}"); return 0; }
      if (Environment.GetEnvironmentVariable("BAL_MKT") != null) {
        // 시장 국면 진단: 쉬기만 하면서 28일 → 장마다(시작·끝 아침) 종목별 로그 수익을 그 장의 국면 이름별로 평균 (v4 는 판마다 시나리오가 달라서 국면별로 묶음)
        var sums = new Dictionary<string, Dictionary<string, double>>(); var cnt = new Dictionary<string, int>();
        void add(GameSim g, int ch, Dictionary<string, double> p0) {
          string rg = g.regime(ch) ?? (ch + "장"); cnt[rg] = (cnt.TryGetValue(rg, out var c0) ? c0 : 0) + 1;
          if (!sums.ContainsKey(rg)) sums[rg] = new Dictionary<string, double>();
          foreach (var t in BD.TKList) if (p0.ContainsKey(t.id)) sums[rg][t.id] = (sums[rg].TryGetValue(t.id, out var v0) ? v0 : 0) + Math.Log(g.S.mk.tk[t.id].p / p0[t.id]);
        }
        for (int sd = 1; sd <= n; sd++) {
          var g = GameSim.Create(BD, sd * 104729, new GameSim.Opts { rt = true }); g.Apply(new SimCommand("start"));
          if (RtBots.Part2) g.S.part = 2;
          var p0 = new Dictionary<string, double>(); int lastCh = 0;
          for (int i = 0; i < 4000 && g.S.pending != null && g.S.pending.t != "ending"; i++) {
            var P = g.S.pending; int ch = g.absDay() >= 29 ? 5 : g.chapter();
            if (P.t == "home" && g.S.slot == 0 && ch != lastCh) {
              if (lastCh > 0) add(g, lastCh, p0);
              p0.Clear(); foreach (var t in BD.TKList) p0[t.id] = g.S.mk.tk[t.id].p;
              lastCh = ch;
            }
            SimCommand c = P.t == "home" ? new SimCommand("rest") : P.t == "relic" ? new SimCommand("pickRelic", "i", 0) : P.t == "event" ? new SimCommand("evPick", "k", P.opts.First(o => !o.dis).k)
              : P.t == "menhera" || P.t == "impulse" ? new SimCommand("reply", "i", 0) : P.t == "payday" ? new SimCommand("payday", "k", P.stage == "repay" ? "keep" : P.opts.FirstOrDefault(o => !o.dis)?.k ?? "pay") : P.t == "tempt" ? new SimCommand("tempt", "k", "no") : null;
            if (c == null) break;
            if (P.t == "payday" && P.stage == "choose") g.S.cash = Math.Max(g.S.cash, P.due + 1);
            if (P.t == "payday" && g.absDay() >= 28 && p0.Count > 0) { add(g, 4, p0); p0.Clear(); }
            g.Apply(c);
          }
        }
        foreach (var t in BD.TKList) Console.WriteLine($"{t.id,-6} beta {t.beta,4} " + string.Join("  ", sums.Keys.OrderBy(k => k).Select(rg => $"{rg} {(sums[rg].TryGetValue(t.id, out var v) ? Math.Exp(v / cnt[rg]) - 1 : 0),7:P1}")));
        return 0;
      }
      if (Environment.GetEnvironmentVariable("BAL_RELIC") != null) {
        foreach (var st in strats) {
          var L = Enumerable.Range(1, n).Select(s => RtBots.Run(BD, s * 104729, st)).ToList();
          foreach (var g in L.GroupBy(x => x.relic).OrderBy(g => g.Key))
            Console.WriteLine($"{st} {g.Key,-9} n={g.Count(),3} 클리어 {(double)g.Count(x => x.end == "clear") / g.Count():P0} 평균 {(g.Any(x => x.end == "clear") ? g.Where(x => x.end == "clear").Average(x => x.day) : 0):F1}일 배드 {(double)g.Count(x => x.end != "clear" && x.end != "none") / g.Count():P0} 남은빚 {g.Average(x => x.end == "clear" ? 0 : x.debt) / 1e4:F0}만");
        }
        return 0;
      }
      if (Environment.GetEnvironmentVariable("BAL_SCEN") != null) {
        // 국면 시나리오별 결과 (v4: 판마다 씨앗으로 시나리오)
        foreach (var st in strats) {
          var L = Enumerable.Range(1, n).Select(s => RtBots.Run(BD, s * 104729, st)).ToList();
          foreach (var g in L.GroupBy(x => x.scen).OrderBy(g => g.Key))
            Console.WriteLine($"{st} {g.Key,-28} n={g.Count(),3} 클리어 {(double)g.Count(x => x.end == "clear") / g.Count():P0} 같이 {(double)g.Count(x => x.variant == "duo") / g.Count():P0} 남은빚 {g.Average(x => x.end == "clear" ? 0 : x.debt) / 1e4:F0}만 투자 {g.Average(x => x.invest) / 1e4:F0}만");
        }
        return 0;
      }
      foreach (var st in strats) {
        var mg = (Environment.GetEnvironmentVariable("MG") ?? "0.55,0.85").Split(',').Select(double.Parse).ToArray();
        Console.WriteLine(RtBots.Summarize(BD, st, n, int.Parse(Environment.GetEnvironmentVariable("BAL_SEED0") ?? "1"), 70, mg[0], mg[1]));   // BAL_SEED0 = 다른 씨앗 구간으로 (잡음 확인)
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
