using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace KwGame.Sim
{
    // 메타 (판 바깥): 판 코드 · 오늘의 판 · 결과 카드 · 업적 · 엔딩 도감 · 누적 기록. 전부 읽기만 함 (rng·Stats 안 건드림 → 골든 그대로)

    /// 최근 판 기록 한 줄
    public class RunEntry { public string key, diff, when; public int seed, part, days; public double repaidPct; }
    /// Apply 로 새로 열린 것들
    public class MetaUnlock { public List<string> newEndings = new(), newAch = new(); }

    /// 판을 넘어 쌓이는 기록 (Newtonsoft 로 저장 — KwGame.Persistence.MetaStore)
    public class MetaProgress
    {
        public const int RECENT_MAX = 20;
        public int ver = 1, runs, clears;
        public Dictionary<string, int> endings = new();
        public HashSet<string> ach = new();
        /// 가장 빨리 깬 날 수 (0 = 아직 없음)
        public int bestDays;
        public double bestRealized;
        /// 최근 판 (새것이 앞, 최대 RECENT_MAX)
        public List<RunEntry> recent = new();

        [JsonIgnore] public int EndingCount => endings.Count;
        [JsonIgnore] public int AchCount => ach.Count;

        /// 판 결과 반영. 바로 앞 기록과 같은 판(씨앗·부·날·엔딩)이면 null (저장된 엔딩 화면을 다시 열어도 두 번 안 셈)
        public MetaUnlock Apply(GameSim.RunResult r, string whenIso)
        {
            if (r == null) return null;
            var last = recent.Count > 0 ? recent[0] : null;
            if (last != null && last.seed == r.seed && last.part == r.part && last.days == r.days && last.key == r.endKey) return null;
            var u = new MetaUnlock();
            runs++; if (r.cleared) clears++;
            endings.TryGetValue(r.endKey, out int n);
            if (n == 0) u.newEndings.Add(r.endKey);
            endings[r.endKey] = n + 1;
            foreach (var id in r.newAch) if (ach.Add(id)) u.newAch.Add(id);
            if (r.cleared && (bestDays == 0 || r.days < bestDays)) bestDays = r.days;
            bestRealized = runs == 1 ? r.realized : Math.Max(bestRealized, r.realized);
            recent.Insert(0, new RunEntry { key = r.endKey, diff = r.diff, when = whenIso, seed = r.seed, part = r.part, days = r.days, repaidPct = r.repaidPct });
            if (recent.Count > RECENT_MAX) recent.RemoveRange(RECENT_MAX, recent.Count - RECENT_MAX);
            return u;
        }

        public string ToJson() => JsonConvert.SerializeObject(this, Formatting.Indented);
        /// 망가진·빈 문자열이면 새 기록
        public static MetaProgress FromJson(string json)
        {
            if (string.IsNullOrWhiteSpace(json)) return new MetaProgress();
            try
            {
                var m = JsonConvert.DeserializeObject<MetaProgress>(json);
                if (m == null) return new MetaProgress();
                m.endings ??= new Dictionary<string, int>();
                m.ach ??= new HashSet<string>();
                m.recent ??= new List<RunEntry>();
                m.recent.RemoveAll(x => x == null);
                return m;
            }
            catch (Exception) { return new MetaProgress(); }
        }
    }

    public partial class GameSim
    {
        // GameData.EndingDef(엔딩 데이터)와 이름이 겹쳐서 결과·업적·도감 타입은 GameSim 안에 둠 (GameSim.RunResult · GameSim.AchDef · GameSim.EndingDef)
        /// 한 판 결과 요약 (엔딩 뒤 S.endInfo 가 있을 때만)
        public class RunResult
        {
            public string kind, variant, endKey, diff;
            public int seed, part, days, liq, liqWork, maxLev, promOk, promBad, levTier;
            public double repaidPct, realized, earned, maxAsset, aff, greed, borrowed;
            public bool cleared;
            /// 이번 판에 딴 업적 id (CheckAchievements). 처음 딴 건지는 MetaProgress.Apply 가 가림
            public List<string> newAch = new();
        }
        /// 업적 정의 (unity_v4.json V4_ACH)
        public class AchDef { public string id, name, hint; public bool secret; }
        /// 엔딩 도감 항목 (unity_v4.json V4_END_LIST). key = RunResult.endKey 와 같은 꼴 ("kind" 또는 "kind:variant")
        public class EndingDef { public string key, name, hint; }

        // ---------- 판 코드 ----------
        const string B36 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        /// 씨앗 → "KW-" + 36진수 대문자
        public static string SeedCode(int seed)
        {
            long v = Math.Abs((long)seed); if (v == 0) return "KW-0";
            var c = new List<char>();
            while (v > 0) { c.Insert(0, B36[(int)(v % 36)]); v /= 36; }
            return "KW-" + new string(c.ToArray());
        }
        /// 판 코드 읽기: "KW-XXXX"(대소문자·앞뒤 공백 무시) → 36진수, 접두어 없이 숫자만 → 10진 씨앗, 그 밖 글자 섞이면 36진수. 0 이하·이상하면 false
        public static bool TryParseSeedCode(string text, out int seed)
        {
            seed = 0;
            var t = (text ?? "").Trim().ToUpperInvariant();
            bool pre = t.StartsWith("KW-");
            if (pre) t = t.Substring(3).Trim();
            if (t.Length == 0 || t.Length > 12) return false;
            long v = 0;
            bool dec = !pre && t.All(ch => ch >= '0' && ch <= '9');
            int b = dec ? 10 : 36;
            foreach (char ch in t)
            {
                int d = B36.IndexOf(ch);
                if (d < 0 || d >= b) return false;
                v = v * b + d;
                if (v > int.MaxValue) return false;
            }
            if (v <= 0) return false;
            seed = (int)v;
            return true;
        }
        /// 오늘의 판: 날짜("yyyy-MM-dd") FNV-1a → 1..999999 (누구나 같은 날 같은 판)
        public static int DailySeed(int year, int month, int day)
        {
            string s = year.ToString("D4", CultureInfo.InvariantCulture) + "-" + month.ToString("D2", CultureInfo.InvariantCulture) + "-" + day.ToString("D2", CultureInfo.InvariantCulture);
            uint h = 0x811c9dc5;
            unchecked { foreach (char ch in s) { h ^= ch; h *= 0x01000193; } }
            return (int)(h % 999999u) + 1;
        }

        // ---------- 난이도 ----------
        public string DiffName() => D.STR["v4.diff." + S.diff] != null ? D.S("v4.diff." + S.diff) : D.S("v4.diff.normal");

        // ---------- 결과 ----------
        /// 판 결과 요약. 엔딩 전엔 null
        public RunResult Result()
        {
            var E = S.endInfo; if (E == null) return null;
            double d0 = v4 ? debtStart() : R.DEBT0;
            var r = new RunResult
            {
                kind = E.kind, variant = E.variant ?? "", endKey = string.IsNullOrEmpty(E.variant) ? E.kind : E.kind + ":" + E.variant, diff = S.diff ?? "normal",
                seed = S.seed, part = S.part, days = E.days, liq = (int)S.st.liq, liqWork = S.liqWork, maxLev = S.maxLev, promOk = S.promKept, promBad = S.promBroke, levTier = S.levTier,
                repaidPct = d0 > 0 ? clamp(Math.Round((d0 - S.debt) / d0 * 100), 0, 100) : 0,
                realized = S.realized, earned = S.st.earned, maxAsset = S.st.maxAsset, aff = S.aff, greed = S.greed, borrowed = S.st.borrowed,
                cleared = E.kind == "clear",
            };
            r.newAch = CheckAchievements();
            return r;
        }
        /// 엔딩 태그 (엔딩 화면 제목과 같음: v4 만기 결산이면 만기 태그)
        public string endTag()
        {
            var E = S.endInfo; if (E == null) return "";
            bool matured = v4 && E.kind == "bad1" && E.days >= R.V4_DAYS && S.paidMonth == S.month;
            return matured ? T(E.variant == "duo" ? "v4.tag.duo" : E.variant == "grad" ? "v4.tag.grad" : "v4.tag.sea") : E.tag ?? "";
        }
        /// 공유용 결과 카드 (여러 줄). 엔딩 전엔 ""
        public string ResultCard()
        {
            if (S.endInfo == null) return "";
            var r = Result();
            var L = new List<string>
            {
                T("v4.card.head", "tag", endTag()),
                T("v4.card.line1", "p", r.part > 1 ? T("v4.card.part2") : "", "diff", DiffName(), "d", r.days, "pct", r.repaidPct),
                T("v4.card.line2", "r", sgnMan(r.realized), "a", man(r.maxAsset) + D.U("won"), "n", r.liq, "w", r.liqWork > 0 ? T("v4.card.liqWork", "n", r.liqWork) : ""),
                T("v4.card.line3", "aff", r.aff >= 0 ? JsFmt.Num(rhu(r.aff)) : T("v4.card.none"), "lev", r.maxLev > 0 ? T("v4.card.lev", "x", r.maxLev) : T("v4.card.none")),
                T("v4.card.seed", "code", SeedCode(r.seed)),
                T("v4.card.tail"),
            };
            return string.Join("\n", L);
        }

        // ---------- 업적 · 엔딩 도감 ----------
        public static List<AchDef> Achievements(GameData D) => D.J["V4_ACH"] is JArray a ? a.ToObject<List<AchDef>>() : new List<AchDef>();
        public static List<EndingDef> EndingCatalog(GameData D) => D.J["V4_END_LIST"] is JArray a ? a.ToObject<List<EndingDef>>() : new List<EndingDef>();
        /// 이번 판에 딴 업적 id (엔딩 뒤에만, 순수 계산). V4_ACH 에 있는 것만
        public List<string> CheckAchievements()
        {
            var E = S.endInfo; var o = new List<string>(); if (E == null) return o;
            string k = E.kind, vr = E.variant ?? "";
            bool clr = k == "clear";
            void add(string id, bool ok) { if (ok) o.Add(id); }
            add("first_end", true);
            add("true_end", clr && vr == "true");
            add("lonely", clr && vr == "lonely");
            add("duo", k == "bad1" && vr == "duo");
            add("heist", k == "heist");
            add("heist_fail", k == "heistFail");
            add("no_loan", clr && S.st.borrowed == 0);
            add("work_only", S.st.invest == 0 && (clr || (k == "bad1" && (vr == "duo" || vr == "grad"))));
            add("lev100", clr && S.maxLev >= 100);
            add("liq_work", S.liqWork >= 1);
            add("liq5", S.st.liq >= 5);
            add("speed14", clr && E.days <= 14);
            add("aff100", S.aff >= 100);
            add("promise", S.promKept >= 10 && S.promBroke == 0);
            add("hard_clear", clr && S.diff == "hard");
            add("part2_true", clr && vr == "true" && S.part > 1);
            add("asset1e8", S.st.maxAsset >= 1e8);
            add("gamble_end", k == "bad2");
            add("grad", ((clr && vr == "true" && S.part > 1 && S.enroll == 1) || (k == "bad1" && vr == "grad")) && S.fundBrokeN == 0);   // 졸업식을 보는 엔딩 + 복학 통장을 한 번도 안 깸
            add("tuna", k == "bad1" && vr == "grad");
            var known = new HashSet<string>(Achievements(D).Select(a => a.id));
            return known.Count == 0 ? o : o.Where(known.Contains).ToList();
        }
    }
}
