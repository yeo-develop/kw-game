using System.Collections.Generic;
using System.Linq;
using KwGame.Sim;
using Newtonsoft.Json.Linq;
using UnityEngine;

namespace KwGame.View
{
    // LLM 연동 (docs/LLM.md)
    //  A. 뉴스: sim 이 낸 요청(G.NewsReq)을 칸 시작에 미리 /news 로 보내고, 답이 오면 newsFact 명령으로 sim 에 넣음 (sim 이 검증, 늦거나 틀리면 sim 내장 생성기).
    //  B. 연출 문구(화면 전용, sim 영향 없음): 집 대사·미래 카톡(/line), 주갤 글(/gall). 실패·늦음 → 원래 문구.
    public partial class GameController
    {
        const float LINE_WAIT = 1.5f;     // 집 화면이 뜬 뒤 이 시간 안에 온 대사만 바꿔 끼움 (늦으면 원래 대사 유지)
        bool llmFlavor = true;            // 데모 화면 재생처럼 수백 칸을 몰아칠 땐 끔
        readonly HashSet<int> newsAsked = new HashSet<int>();
        int flavorT = int.MinValue, homeShownT = int.MinValue; float homeShownAt;
        (int T, string line) aiLine = (int.MinValue, null);
        readonly List<string> aiKakao = new List<string>();
        readonly List<(string lab, string title, string body, List<(string au, string x)> cm)> aiPosts = new List<(string, string, string, List<(string, string)>)>();
        int gallNewsSeen;

        void LlmNewGame()
        {
            newsAsked.Clear(); flavorT = int.MinValue; aiLine = (int.MinValue, null); aiKakao.Clear(); aiPosts.Clear(); gallNewsSeen = 0;
            if (LlmSettings.On) G.Apply(new SimCommand("llmMode", "on", true));
        }
        void LlmToggle(bool on)
        {
            LlmSettings.On = on;
            G.Apply(new SimCommand("llmMode", "on", LlmSettings.On));
            RenderAll();
        }

        /// 명령 처리 직후마다: 새 뉴스 요청·새 칸 연출 요청을 미리 보냄 (화면 재생이 끝나기 전부터 → 지연 숨김)
        void LlmTick()
        {
            if (!LlmSettings.On || S == null) return;
            var q = G.NewsReq();
            if (q != null)
            {
                int sid = (int)q["slotId"]; var g = G;
                if (newsAsked.Add(sid)) StartCoroutine(LlmClient.Post("/news", q, 12f, res => OnNews(g, sid, res)));
            }
            int T = G.Tnow();
            if (!llmFlavor || T == flavorT || S.phase != "home" || S.ending != null) return;
            flavorT = T;
            { var g = G; StartCoroutine(LlmClient.Post("/line", LineSummary(), 6f, res => OnLine(g, T, res))); }
            var news = S.feed.Where(f => f.kind == "news").ToList();
            double pnl = G.todayPnl();
            string topic = news.Count > gallNewsSeen ? news[news.Count - 1].x : System.Math.Abs(pnl) >= 300000 ? $"오늘 미래네 투자·도박 손익 {G.sgnWon(pnl)}" : null;
            gallNewsSeen = news.Count;
            if (topic != null) { var g = G; StartCoroutine(LlmClient.Post("/gall", GallSummary(topic), 10f, res => OnGall(g, res))); }
        }

        void OnNews(GameSim g, int sid, JObject res)
        {
            if (g != G || res == null || !(res["fact"] is JObject f)) return;
            var cmd = (JObject)f.DeepClone(); cmd["t"] = "newsFact";
            var evs = G.Apply(new SimCommand(cmd));
            if (evs.Any(e => e.t == "error")) Debug.Log($"[llm] news slot {sid}: sim 이 거부 (칸 지남·검증 실패) → 내장 뉴스");
            else Debug.Log($"[llm] news slot {sid}: {f.Value<string>("ticker")} {f.Value<string>("headline")}");
        }
        void OnLine(GameSim g, int T, JObject res)
        {
            if (g != G || res == null) return;
            string line = res.Value<string>("line"), kakao = res.Value<string>("kakao");
            bool inTime = homeShownT != T || Time.realtimeSinceStartup - homeShownAt <= LINE_WAIT;
            if (line != null && inTime && G.Tnow() == T) { aiLine = (T, line); if (!playing && S.pending?.t == "home") RenderAll(); }
            if (kakao != null) { aiKakao.Add($"[{G.clockNow()}] 미래: {kakao}"); if (aiKakao.Count > 5) aiKakao.RemoveAt(0); Toast("미래 카톡: " + kakao, "bubble"); }
        }
        void OnGall(GameSim g, JObject res)
        {
            if (g != G || !(res?["post"] is JObject p)) return;
            var cm = ((p["comments"] as JArray) ?? new JArray()).Select(c => (c.Value<string>("au"), c.Value<string>("x"))).ToList();
            aiPosts.Add(($"{S.month}-{S.day} {D.SLOT_NAME[S.slot]}", p.Value<string>("title"), p.Value<string>("body"), cm));
            if (aiPosts.Count > 10) aiPosts.RemoveAt(0);
            if (phoneTab == "gall" && !playing) RenderAll();
        }

        /// 집 화면 대사: 이번 칸 LLM 대사가 제때 왔으면 그것, 아니면 sim 대사(strings.json)
        string HomeLine()
        {
            int T = G.Tnow();
            if (homeShownT != T) { homeShownT = T; homeShownAt = Time.realtimeSinceStartup; }
            return aiLine.T == T && aiLine.line != null ? aiLine.line : S.hl?.t;
        }

        JObject LineSummary() => new JObject
        {
            ["month"] = S.month, ["day"] = S.day, ["slot"] = S.slot,
            ["debt"] = S.debt, ["cash"] = S.cash, ["hold"] = G.holdVal(), ["todayPnl"] = G.todayPnl(), ["interest"] = G.interestDue(),
            ["dday"] = Mathf.Clamp(D.RULES.MONTH_DAYS - S.day, 0, 7), ["paid"] = S.paidMonth == S.month || S.debt <= 0,
            ["hp"] = S.hp, ["stress"] = S.stress, ["addict"] = S.addict, ["mood"] = G.moodFace(),
            ["relics"] = new JArray(S.augs.Select(id => D.AUGS.FirstOrDefault(a => a.id == id)?.name ?? id).Take(20).Select(Trim(20))),
            ["recent"] = new JArray(S.feed.Skip(System.Math.Max(0, S.feed.Count - 4)).Select(f => f.x).Select(Trim(120))),
        };
        JObject GallSummary(string topic) => new JObject
        {
            ["month"] = S.month, ["day"] = S.day, ["slot"] = S.slot,
            ["debt"] = S.debt, ["cash"] = S.cash, ["todayPnl"] = G.todayPnl(), ["fame"] = S.galFame,
            ["topic"] = Trim(160)(topic),
            ["recent"] = new JArray(S.posts.Skip(System.Math.Max(0, S.posts.Count - 4)).Select(p => p.title).Select(Trim(120))),
        };
        static System.Func<string, string> Trim(int n) => s => s == null ? "" : s.Length <= n ? s : s.Substring(0, n);
    }
}
