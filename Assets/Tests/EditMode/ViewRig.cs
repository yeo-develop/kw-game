using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using KwGame.Sim;
using KwGame.View;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.Tests
{
    /// 화면 테스트용 받침대: 진짜 GameController 로 화면을 만들고, 창 없이 배치(레이아웃)까지 계산해서 잰다.
    /// 그림은 안 그림 — 상자 크기 · 위치 · 줄바꿈만 확인 (글자가 실제로 칠해지는 건 배포본 캡처로).
    public sealed class ViewRig : IDisposable
    {
        const BindingFlags Any = BindingFlags.Instance | BindingFlags.NonPublic | BindingFlags.Public;
        public readonly GameObject go; public readonly GameController c; public readonly PanelSettings ps; public readonly VisualElement root;
        public GameSim G;
        public const float W = 1920, H = 1080;

        public ViewRig(bool sim = false, int seed = 3)
        {
            go = new GameObject("ViewRig"); c = go.AddComponent<GameController>();
            Set("font", Resources.Load<Font>("Fonts/Pretendard-Regular")); Set("fontBold", Resources.Load<Font>("Fonts/Pretendard-Bold"));
            var D = GameController.LoadData(); Set("D", D);
            Call("BuildUi");
            var doc = (UIDocument)Get("doc"); ps = doc.panelSettings; root = doc.rootVisualElement;
            // 창이 없으면 화면 크기가 제멋대로(4:3)라 기준 해상도로 고정: 1920×1080, 배율 1
            ps.scaleMode = PanelScaleMode.ConstantPixelSize; ps.scale = 1;
            root.style.width = W; root.style.height = H; root.style.flexGrow = 0; root.style.flexShrink = 0;
            if (!sim) return;
            G = GameSim.Create(D, seed, new GameSim.Opts { rt = true }); G.Hud = true;
            G.Apply(new SimCommand("start")); ToHome(G);
            Set("G", G);
            Render();
        }

        /// 집이 나올 때까지 무난하게 넘김 (V4Tests.ToHome 과 같은 규칙)
        public static void ToHome(GameSim g)
        {
            for (int i = 0; i < 40 && g.S.pending != null && g.S.pending.t != "home" && g.S.pending.t != "ending"; i++)
            {
                var P = g.S.pending;
                switch (P.t)
                {
                    case "relic": g.Apply(new SimCommand("pickRelic", "i", 0)); break;
                    case "event": g.Apply(new SimCommand("evPick", "k", P.opts.First(o => !o.dis).k)); break;
                    case "menhera": case "impulse": g.Apply(new SimCommand("reply", "i", P.opts.FindIndex(o => o.ok))); break;
                    case "tempt": g.Apply(new SimCommand("tempt", "k", "no")); break;
                    case "payday": g.Apply(new SimCommand("payday", "k", P.stage == "repay" ? "keep" : P.opts.First(o => !o.dis).k)); break;
                    default: throw new InvalidOperationException("ToHome: " + P.t);
                }
            }
        }

        /// 전체 다시 그림 + 첫 안내 카드는 걷음 (화면을 덮어서 재는 데 방해)
        public void Render() { Call("RenderAll"); Call("CoachClose"); Layout(); }

        /// 배치 계산 (창이 없어서 엔진이 알아서 안 돌림)
        public void Layout()
        {
            var p = root.panel;
            p.GetType().GetMethod("ValidateLayout", Any).Invoke(p, null);
        }

        public object Get(string name) => typeof(GameController).GetField(name, Any).GetValue(c);
        public T Get<T>(string name) => (T)Get(name);
        public void Set(string name, object value) => typeof(GameController).GetField(name, Any).SetValue(c, value);
        public object Prop(string name) => typeof(GameController).GetProperty(name, Any).GetValue(c);
        public object Call(string name, params object[] args)
        {
            var ms = typeof(GameController).GetMethods(Any).Where(m => m.Name == name && m.GetParameters().Length == args.Length).ToList();
            if (ms.Count == 0) throw new MissingMethodException(name + "/" + args.Length);
            try { return ms[0].Invoke(c, args); }
            catch (TargetInvocationException e) { throw new Exception(name + ": " + e.InnerException, e.InnerException); }
        }

        public void Dispose()
        {
            if (go != null) UnityEngine.Object.DestroyImmediate(go);
            if (ps != null) UnityEngine.Object.DestroyImmediate(ps);
        }

        // ---------- 배치 검사 ----------
        static bool Shown(VisualElement e) => e.resolvedStyle.display != DisplayStyle.None && e.resolvedStyle.visibility == Visibility.Visible && e.resolvedStyle.opacity > 0.01f;
        public static string Name(VisualElement e)
        {
            string s = e is TextElement t ? t.text : e.Query<TextElement>().First()?.text;
            s = Ui.Plain(s ?? "").Replace("\n", " "); if (s.Length > 26) s = s.Substring(0, 26) + "…";
            return $"{e.GetType().Name}{(string.IsNullOrEmpty(e.name) ? "" : "#" + e.name)}「{s}」";
        }

        /// scope 아래에서 눈에 보이는 배치 결함을 모음:
        ///  넘침 = 흐름 배치 아이의 상자가 부모 상자 밖으로 (말풍선이 두 줄인데 줄 높이는 한 줄 → 다음 줄과 겹침)
        ///  잘림 = 글이 잘라내는 조상(overflow hidden) 밖으로 나감 · 한 낱말이 칸보다 넓어 옆으로 삐져나감
        ///  글자 겹침 = 같은 층(가장 가까운 절대 배치 조상이 같음)의 글 두 개가 겹침
        public List<string> Lint(VisualElement scope = null, float tol = 1.5f)
        {
            var issues = new List<string>(); var texts = new List<(TextElement t, Rect r, VisualElement layer)>();
            Walk(scope ?? root, issues, texts, tol);
            for (int i = 0; i < texts.Count; i++)
                for (int j = i + 1; j < texts.Count; j++)
                {
                    if (texts[i].layer != texts[j].layer) continue;
                    var a = texts[i].r; var b = texts[j].r;
                    float ox = Mathf.Min(a.xMax, b.xMax) - Mathf.Max(a.x, b.x), oy = Mathf.Min(a.yMax, b.yMax) - Mathf.Max(a.y, b.y);
                    if (ox > tol + 1 && oy > tol + 1) issues.Add($"글자 겹침: {Name(texts[i].t)} 와 {Name(texts[j].t)} ({ox:0}x{oy:0})");
                }
            return issues;
        }

        static VisualElement Layer(VisualElement e)
        {
            for (var p = e.hierarchy.parent; p != null; p = p.hierarchy.parent) if (p.resolvedStyle.position == Position.Absolute) return p;
            return null;
        }

        static void Walk(VisualElement p, List<string> issues, List<(TextElement, Rect, VisualElement)> texts, float tol)
        {
            if (!Shown(p)) return;
            var kids = p.hierarchy.Children().Where(Shown).ToList();
            bool viewport = p.ClassListContains("unity-scroll-view__content-viewport");   // 스크롤 내용은 창보다 커도 정상
            foreach (var k in kids)
            {
                bool abs = k.resolvedStyle.position == Position.Absolute;
                var r = k.layout;
                if (!abs && !viewport && r.width > 0.5f && r.height > 0.5f && p.layout.width > 0.5f)
                    if (r.yMax > p.layout.height + tol || r.xMax > p.layout.width + tol || r.y < -tol || r.x < -tol)
                        issues.Add($"넘침: {Name(k)} ({r.x:0},{r.y:0} {r.width:0}x{r.height:0}) 가 {Name(p)} ({p.layout.width:0}x{p.layout.height:0}) 밖으로");
                if (k is TextElement t && !string.IsNullOrEmpty(Ui.Plain(t.text).Trim()))
                {
                    var wb = t.worldBound;
                    if (wb.width > 0.5f && wb.height > 0.5f)
                    {
                        // 줄바꿈 없는 글만 실제 글 폭을 잼 (칸보다 넓으면 옆으로 삐져나옴). 줄바꿈 글은 상자가 곧 글 크기 — 폭을 주고 재면 이 엔진은 높이를 다르게 돌려줘서 못 믿음
                        bool wrap = t.resolvedStyle.whiteSpace == WhiteSpace.Normal;
                        var cr = t.contentRect;
                        float ex = 0;
                        if (!wrap) { var m = t.MeasureTextSize(t.text, 0, VisualElement.MeasureMode.Undefined, 0, VisualElement.MeasureMode.Undefined); ex = Mathf.Max(0, m.x - cr.width - 1); }
                        // 글이 놓이는 안쪽 상자 (안 여백 제외). 세로는 글꼴 줄 간격 여유(글자 크기의 0.3배)만큼은 봐줌 — 줄 상자 아래쪽은 빈 공간
                        var tl = t.LocalToWorld(new Vector2(cr.x, cr.y)); float slackY = t.resolvedStyle.fontSize * 0.3f;
                        var tr = new Rect(tl.x, tl.y + slackY * 0.5f, cr.width + ex, Mathf.Max(1, cr.height - slackY));
                        if (ex > tol + 1) issues.Add($"잘림(가로): {Name(t)} 글이 상자보다 {ex:0} 넓음 (상자 {cr.width:0})");
                        for (var q = t.hierarchy.parent; q != null; q = q.hierarchy.parent)
                        {
                            if (q.style.overflow.value != Overflow.Hidden) continue;   // 이 게임은 스타일을 전부 코드로(인라인) 줌
                            var qb = q.worldBound; bool vp = q.ClassListContains("unity-scroll-view__content-viewport");
                            if (tr.x < qb.x - tol || tr.xMax > qb.xMax + tol || (!vp && (tr.y < qb.y - tol || tr.yMax > qb.yMax + tol)))
                                issues.Add($"잘림: {Name(t)} ({tr.x:0},{tr.y:0} {tr.width:0}x{tr.height:0}) 가 {Name(q)} ({qb.x:0},{qb.y:0} {qb.width:0}x{qb.height:0}) 에 잘림");
                            break;
                        }
                        texts.Add((t, new Rect(tr.x + 1, tr.y + 1, Mathf.Max(0, tr.width - 2), Mathf.Max(0, tr.height - 2)), Layer(t)));
                    }
                }
                Walk(k, issues, texts, tol);
            }
        }
    }
}
