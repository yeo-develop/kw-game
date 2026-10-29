using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace KwGame.Sim
{
    public class NewsFact { public int slotId; public string tk; public int s; public string h, body, src, ev, arc; public int? step; }
    public class NewsLog { public int slotId; public string tk; public int dir; public string h; public bool fake; public string arc; public int? step; }

    // news.js — LLM 뉴스 디렉터 연동 (docs/LLM.md). S.llm 이 꺼져 있으면 genNews 는 예전 그대로 (골든 동일).
    public partial class GameSim
    {
        public static readonly string[] STRENGTHS = { "weak", "mid", "strong" };
        const int LOG_MAX = 12, RECENT = 6, CAP_WIN = 6, CAP_N = 2, ARC_WIN = 12, ARC_MAX = 5;
        public const int LIM_HEADLINE = 60, LIM_BODY = 300, LIM_SOURCE = 20, LIM_EVENT = 60;
        static readonly Regex BadRx = new Regex("[\\u0000-\\u001f\\u007f-\\u009f\\u00a0\\u2000-\\u200f\\u2028-\\u202f\\u205f\\u3000\\ufeff<>{}`\\\\]");
        static readonly Regex Spaces = new Regex(" {2,}"), Edge = new Regex("^ +| +$"), ArcRx = new Regex(@"^[a-z0-9_-]{1,24}\z");

        /// 뉴스 난수: 시드·칸 번호로만 정해짐 (S.rng·S.fx 와 무관)
        Func<double> hstream(int G)
        {
            uint a = unchecked((uint)S.seed ^ ((uint)(G + 1) * 0x9E3779B1u));
            return () => Rng.Float(ref a);
        }
        List<string> newsPool() => TKS().Where(k => k != "INV" && tkOpen(k)).Concat(new[] { "MKT" }).ToList();
        JObject tkInfo(string k) => k == "MKT"
            ? new JObject { ["k"] = k, ["name"] = T("tick.all"), ["type"] = "market" }
            : new JObject { ["k"] = k, ["name"] = D.TK[k].name, ["type"] = D.TK[k].meme ? "meme" : D.TK[k].type };
        static JToken jn(string s) => s == null ? JValue.CreateNull() : new JValue(s);
        static JToken jn(int? v) => v.HasValue ? new JValue(v.Value) : JValue.CreateNull();

        /// 이번 칸 끝에 굴릴 뉴스 요청 (newsReq). 없으면 null. 호스트(view)가 LLM 에 보낼 JSON 그대로.
        public JObject NewsReq() => Query(newsReq);
        /// v4: 다음 칸 요청을 한 칸 미리 (칸이 행동 하나로 금방 끝나서, 지금 칸 요청만으론 답이 늦음). v4 가 아니면 null
        public JObject NewsReqNext() => Query(() => v4 ? newsReq(Tnow() + 1) : null);
        JObject newsReq() => newsReq(Tnow());
        /// 칸 G 끝에 굴릴 뉴스 요청. v4 는 로그를 G−2 칸까지만 봄 → 한 칸 전에 미리 물어도 칸 G 에 다시 물었을 때와 같은 값
        JObject newsReq(int G)
        {
            if (!S.llm) return null;
            var h = hstream(G);
            if (h() >= (v4 ? R.V4_NEWS_P : 0.32)) return null;
            var P = newsPool();
            int day = G / R.SLOTS + 1, ch = (int)clamp((day - 1) / R.MONTH_DAYS + 1, 1, 4);
            double pp = 0;
            if (v4) pp = R.V4_CH_NEWSUP[ch - 1];   // 장별 국면 = 호재 확률 (내장 생성기 newsDir 과 같은 값)
            else { foreach (var k in P) { var L = D.NEWS[k]; pp += (double)L.Count(x => x.dir > 0) / L.Count; } pp /= P.Count; }
            int dir = h() < pp ? 1 : -1; bool fake = h() < 0.3; int tier = (int)Math.Floor(h() * 3);
            var log = (S.nlog ?? new List<NewsLog>()).Where(x => !v4 || x.slotId <= G - 2).ToList();
            var last = log.Skip(Math.Max(0, log.Count - CAP_WIN)).ToList();
            var ok = P.Where(k => last.Count(x => x.tk == k) < CAP_N).ToList();
            if (ok.Count == 0) ok = P;
            var sc = S.nstr ?? new[] { 0, 0, 0 }; int mn = Math.Min(sc[0], Math.Min(sc[1], sc[2]));
            var strengths = new JArray(); for (int i = 0; i < 3; i++) if (sc[i] <= mn + 1) strengths.Add(STRENGTHS[i]);
            var arcs = new List<NewsLog>();
            foreach (var x in log)
            {
                if (x.arc == null || x.slotId < G - ARC_WIN) continue;
                var a = arcs.FirstOrDefault(y => y.arc == x.arc);
                if (a != null) { a.tk = x.tk; a.step = x.step; a.h = x.h; a.slotId = x.slotId; }
                else arcs.Add(new NewsLog { arc = x.arc, tk = x.tk, step = x.step, h = x.h, slotId = x.slotId });
            }
            var q = new JObject
            {
                ["slotId"] = G, ["month"] = (day - 1) / R.MONTH_DAYS + 1, ["day"] = day, ["slot"] = G % R.SLOTS, ["dir"] = dir, ["fake"] = fake, ["tier"] = tier,
                ["tickers"] = new JArray(ok.Select(tkInfo)), ["strengths"] = strengths,
                ["recent"] = new JArray(log.Skip(Math.Max(0, log.Count - RECENT)).Select(x => new JObject
                {
                    ["slotId"] = x.slotId, ["tk"] = x.tk, ["dir"] = x.dir, ["h"] = x.h, ["fake"] = x.fake, ["arc"] = jn(x.arc), ["step"] = jn(x.step),
                })),
                ["arcs"] = new JArray(arcs.Where(a => a.step < ARC_MAX).Select(a => new JObject
                {
                    ["id"] = a.arc, ["tk"] = a.tk, ["step"] = jn(a.step), ["h"] = a.h, ["slotId"] = a.slotId,
                })),
            };
            // v4: 이야기 맥락 (장 국면 · 2부 · 김사장 털기 준비 단계) → 기사에 국면 분위기·김사장 캐피탈 소문을 섞게
            if (v4) { q["ch"] = ch; q["part"] = S.part; q["kim"] = S.heist; }
            return q;
        }

        public static string CleanText(JToken v, int max)
        {
            if (v == null || v.Type != JTokenType.String) return null;
            string x = Edge.Replace(Spaces.Replace(BadRx.Replace((string)v, " "), " "), "");
            return x.Length > 0 && x.Length <= max ? x : null;
        }
        /// 명령 newsFact 검증 → S.nfact (틀리면 false, 상태 그대로)
        bool newsFact(SimCommand c)
        {
            // 지금 칸, 또는 (v4) 다음 칸 사실
            double sid = c.Num("slotId");
            if (sid != Tnow() && !(v4 && sid == Tnow() + 1)) return false;
            var q = newsReq((int)sid);
            if (q == null || c.Num("dir") != (int)q["dir"]) return false;
            var tkv = c.J["ticker"]; if (tkv == null || tkv.Type != JTokenType.String) return false;
            string tk = (string)tkv;
            if (!q["tickers"].Any(x => (string)x["k"] == tk)) return false;
            var sv = c.J["strength"]; if (sv == null || sv.Type != JTokenType.String) return false;
            string str = (string)sv;
            if (!q["strengths"].Any(x => (string)x == str)) return false;
            string h = CleanText(c.J["headline"], LIM_HEADLINE), body = CleanText(c.J["body"], LIM_BODY), src = CleanText(c.J["source"], LIM_SOURCE), ev0 = CleanText(c.J["event"], LIM_EVENT);
            if (h == null || body == null || src == null || ev0 == null) return false;
            var av = c.J["arcId"];
            string arc = av != null && av.Type == JTokenType.String && ArcRx.IsMatch((string)av) ? (string)av : null;
            double n = c.Num("arcStep");
            int? step = arc == null ? (int?)null : (!double.IsNaN(n) && !double.IsInfinity(n) && Math.Floor(n) == n && n >= 1 && n <= ARC_MAX ? (int)n : 1);
            var f = new NewsFact { slotId = (int)q["slotId"], tk = tk, s = Array.IndexOf(STRENGTHS, str), h = h, body = body, src = src, ev = ev0, arc = arc, step = step };
            if (f.slotId == Tnow()) S.nfact = f; else S.nfactN = f;
            return true;
        }

        void logNews(News n)
        {
            if (n == null) return;
            if (S.nlog == null) S.nlog = new List<NewsLog>();
            S.nlog.Add(new NewsLog { slotId = Tnow(), tk = n.tk, dir = n.dir, h = n.h, fake = n.fake, arc = n.arc, step = n.step });
            while (S.nlog.Count > LOG_MAX) S.nlog.RemoveAt(0);
        }

        News genNewsLlm()
        {
            var q = newsReq();
            var f = S.nfact != null && q != null && S.nfact.slotId == (int)q["slotId"] ? S.nfact : null;
            S.nfact = S.nfactN != null && S.nfactN.slotId == Tnow() + 1 ? S.nfactN : null; S.nfactN = null;   // v4: 미리 받아 둔 다음 칸 사실을 올림
            if (q == null) return null;
            int dir = (int)q["dir"]; bool fake = (bool)q["fake"];
            News n;
            if (f != null)
            {
                D.TK.TryGetValue(f.tk, out var t); double u = rnd();
                Func<double, double, double> part = (lo, w) => lo + w * (f.s + u) / 3;
                double mag = f.tk == "MKT" ? part(0.02, 0.02) : t.type == "stock" ? part(0.05, 0.07) : t.meme ? 0.4 : part(0.07, 0.09);
                if (S.nstr == null) S.nstr = new[] { 0, 0, 0 };
                S.nstr[f.s]++;
                n = new News { tk = f.tk, h = f.h, dir = dir, r = dir * mag, fake = fake, llm = true, body = f.body, src = f.src, ev = f.ev, arc = f.arc, step = f.step };
            }
            else
            {
                // 응답 없음: 요청의 방향·가짜·종목 목록을 지키는 내장 생성기
                string tk = pick(q["tickers"].Select(x => (string)x["k"]).ToList());
                var L = D.NEWS[tk].Where(x => x.dir == dir).ToList();
                var nw = pick(L.Count > 0 ? L : D.NEWS[tk]);
                D.TK.TryGetValue(tk, out var t);
                double mag = tk == "MKT" ? 0.02 + rnd() * 0.02 : t.type == "stock" ? 0.05 + rnd() * 0.07 : t.meme ? 0.4 : 0.07 + rnd() * 0.09;
                n = new News { tk = tk, h = nw.h, dir = dir, r = dir * mag, fake = fake };
            }
            logNews(n);
            return n;
        }

        /// 테스트·저장용: 뉴스 로그를 JS 와 같은 모양의 JSON 으로
        public JArray NewsLogJson() => new JArray((S.nlog ?? new List<NewsLog>()).Select(x => new JObject
        {
            ["slotId"] = x.slotId, ["tk"] = x.tk, ["dir"] = x.dir, ["h"] = x.h, ["fake"] = x.fake, ["arc"] = jn(x.arc), ["step"] = jn(x.step),
        }));
    }
}
