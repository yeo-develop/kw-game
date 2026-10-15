using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using KwGame.Sim;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // 멘헤라 연출: 화면이 까매지고 → 빨간 낙서가 부글부글 → 미래가 떨림 → 카톡이 탄막으로 쏟아짐. 답장(멘헤라 pending 끝)하면 걷힘.
    public partial class GameController
    {
        static readonly Color MenBubble = new Color(0.04f, 0.02f, 0.03f, 0.92f);
        static readonly Color MenRed = new Color(0.86f, 0.1f, 0.14f, 1f);
        static readonly Color MenRedDim = new Color(0.62f, 0.05f, 0.09f, 0.55f);
        static readonly string[] MenWords = { "자기야", "왜", "읽었잖아", "답장", "나만", "보고싶어", "어디야", "누구랑", "1", "왜안읽어", "자기야자기야" };
        VisualElement barrage, menDark, menFx; Label menBig, menBigEcho;
        IVisualElementScheduledItem menTick;
        int menSeed;

        VisualElement Barrage()
        {
            if (barrage != null) return barrage;
            // 까만 막 = 배경 위·미래 아래 (미래만 어둠 속에 떠 보이게)
            menDark = new VisualElement(); Ui.Fill(menDark); menDark.pickingMode = PickingMode.Ignore; menDark.style.backgroundColor = new Color(0.02f, 0f, 0.01f, 0.96f);
            menDark.style.display = DisplayStyle.None; stage.Insert(stage.IndexOf(miraiEl), menDark);
            // 낙서·글씨 = 미래 위, 카톡 아래
            menFx = new VisualElement(); Ui.Fill(menFx); menFx.pickingMode = PickingMode.Ignore; menFx.style.display = DisplayStyle.None;
            menFx.generateVisualContent += DrawScribble;
            barrage = new VisualElement(); Ui.Fill(barrage); barrage.pickingMode = PickingMode.Ignore;
            stage.Insert(stage.IndexOf(panel), barrage);   // 선택지·대사창·토스트 아래, 미래 위 (답장 버튼을 가리지 않게)
            stage.Insert(stage.IndexOf(barrage), menFx);
            return barrage;
        }

        /// 빨간 낙서: 매 프레임 다른 씨앗으로 다시 그려서 손그림처럼 부글거림
        void DrawScribble(MeshGenerationContext ctx)
        {
            var r = menFx.contentRect; if (r.width < 10) return;
            var p = ctx.painter2D; var rng = new System.Random(menSeed);
            float W = r.width, H = r.height;
            p.lineCap = LineCap.Round; p.lineJoin = LineJoin.Round;
            for (int i = 0; i < 130; i++)
            {
                bool white = i % 9 == 0;
                // 미래 쪽(왼쪽)에 몰리게, 나머지는 화면 전체
                float cx = i % 3 == 0 ? (float)rng.NextDouble() * W : (float)(0.05 + rng.NextDouble() * 0.45) * W;
                float cy = (float)rng.NextDouble() * H;
                float a = (float)(0.35 + rng.NextDouble() * 0.5);
                p.strokeColor = white ? new Color(1, 1, 1, a * 0.45f) : new Color(0.8f + (float)rng.NextDouble() * 0.15f, 0.04f, 0.08f, a);
                p.lineWidth = (float)(1.6 + rng.NextDouble() * (white ? 1.4 : 3.4));
                p.BeginPath(); p.MoveTo(new Vector2(cx, cy));
                float dir = (float)(rng.NextDouble() * Mathf.PI * 2), len = (float)(18 + rng.NextDouble() * 55);
                int segs = 8 + rng.Next(14);
                for (int s = 0; s < segs; s++)
                {
                    dir += (float)(rng.NextDouble() < 0.35 ? Mathf.PI * (0.7 + rng.NextDouble() * 0.5) : (rng.NextDouble() - 0.5) * 1.2);   // 확 꺾어서 되돌아오며 휘갈김 (볼펜 낙서)
                    var c1 = new Vector2(cx + Mathf.Cos(dir) * len * 0.6f, cy + Mathf.Sin(dir) * len * 0.6f);
                    cx += Mathf.Cos(dir) * len; cy += Mathf.Sin(dir) * len;
                    p.QuadraticCurveTo(c1, new Vector2(cx, cy));
                }
                p.Stroke();
            }
        }

        void MenheraFx(bool on)
        {
            Barrage();
            bool was = menDark.style.display == DisplayStyle.Flex;
            if (on == was) return;
            menDark.style.display = menFx.style.display = on ? DisplayStyle.Flex : DisplayStyle.None;
            miraiEl.style.unityBackgroundImageTintColor = on ? new Color(0.85f, 0.5f, 0.55f) : Color.white;
            menTick?.Pause(); menTick = null;
            menBig?.RemoveFromHierarchy(); menBigEcho?.RemoveFromHierarchy(); menBig = menBigEcho = null;
            if (!on) { miraiEl.style.translate = new Translate(0, 0); miraiEl.style.scale = new Scale(Vector3.one); barrage.style.translate = new Translate(0, 0); menDark.style.backgroundColor = new Color(0.02f, 0f, 0.01f, 0.96f); return; }
            // 가운데 큰 글씨 (빨강 + 어긋난 잔상) — 몇 박자마다 다른 말로 바뀜
            menBigEcho = Ui.Label("", 150, new Color(0.2f, 0.9f, 1f, 0.35f), true); menBig = Ui.Label("", 150, MenRed, true);
            foreach (var l in new[] { menBigEcho, menBig }) { Ui.Fill(l); l.pickingMode = PickingMode.Ignore; l.style.unityTextAlign = TextAnchor.MiddleCenter; l.style.opacity = 0.85f; menFx.Add(l); }
            // 떨림: 미래·카톡이 따로 덜덜, 낙서는 다시 휘갈김, 배경은 심장 박동처럼 붉게 울렁 (0.07초마다). 가끔 크게 덜컥
            int beat = 0;
            menTick = menFx.schedule.Execute(() =>
            {
                menSeed++; beat++; menFx.MarkDirtyRepaint();
                var rr = new System.Random(menSeed * 31);
                bool jolt = beat % 14 == 0;
                float k = jolt ? 34f : 11f;
                miraiEl.style.translate = new Translate((float)(rr.NextDouble() - 0.5) * k, (float)(rr.NextDouble() - 0.5) * k);
                miraiEl.style.scale = new Scale(Vector3.one * (jolt ? 1.06f : 1f + (float)rr.NextDouble() * 0.015f));
                barrage.style.translate = new Translate((float)(rr.NextDouble() - 0.5) * k * 0.7f, (float)(rr.NextDouble() - 0.5) * k * 0.7f);
                float pulse = Mathf.Pow(Mathf.Abs(Mathf.Sin(beat * 0.45f)), 6);   // 쿵… 쿵…
                menDark.style.backgroundColor = jolt ? new Color(0.55f, 0f, 0.05f, 0.96f) : Color.Lerp(new Color(0.02f, 0f, 0.01f, 0.96f), new Color(0.32f, 0f, 0.04f, 0.96f), pulse);
                if (beat % 9 == 1) menBig.text = menBigEcho.text = MenWords[rr.Next(MenWords.Length)];
                menBig.style.translate = new Translate((float)(rr.NextDouble() - 0.5) * 16, (float)(rr.NextDouble() - 0.5) * 16);
                menBigEcho.style.translate = new Translate(10 + (float)(rr.NextDouble() - 0.5) * 22, -6 + (float)(rr.NextDouble() - 0.5) * 12);
                menBig.style.opacity = rr.NextDouble() < 0.12 ? 0.15f : 0.85f;   // 지직
                // 뒤 글씨도 깜빡깜빡
                foreach (var c in barrage.Children()) if (c is Label wl && wl.name == "menW") wl.style.opacity = rr.NextDouble() < 0.25 ? 0.2f : 1f;
            }).Every(70);
        }

        IEnumerator KakaoBarrage(string[] msgs)
        {
            var b = Barrage(); b.Clear();
            MenheraFx(true);
            float w = Mathf.Max(600, stage.resolvedStyle.width), h = Mathf.Max(400, stage.resolvedStyle.height);
            var rng = new System.Random(msgs.Length * 7919 + (int)(Time.realtimeSinceStartup * 10));
            // 뒤에 깔리는 빨간 글씨 (자기야 자기야 왜…)
            for (int i = 0; i < 40; i++)
            {
                var t = Ui.Label(MenWords[rng.Next(MenWords.Length)], 26 + rng.Next(60), MenRedDim, true); t.pickingMode = PickingMode.Ignore; t.name = "menW";
                Ui.Abs(t, (float)rng.NextDouble() * (w - 200), (float)rng.NextDouble() * (h - 120));
                t.style.rotate = new Rotate(new Angle((float)(rng.NextDouble() * 50 - 25)));
                b.Add(t);
            }
            for (int i = 0; i < msgs.Length; i++)
            {
                var row = Ui.Row(); row.pickingMode = PickingMode.Ignore; row.style.alignItems = Align.FlexEnd;
                var bub = Ui.Box(MenBubble, 14, 18);
                bub.pickingMode = PickingMode.Ignore;
                bub.style.maxWidth = 420;
                bub.style.borderTopWidth = bub.style.borderBottomWidth = bub.style.borderLeftWidth = bub.style.borderRightWidth = 2;
                bub.style.borderTopColor = bub.style.borderBottomColor = bub.style.borderLeftColor = bub.style.borderRightColor = MenRed;
                var who = Ui.Label("미래 ♥", 16, MenRed, true); who.pickingMode = PickingMode.Ignore;
                var txt = Ui.Label(msgs[i], 26, new Color(1f, 0.9f, 0.9f), true); txt.pickingMode = PickingMode.Ignore;
                bub.Add(who); bub.Add(txt);
                var one = Ui.Label("1", 18, new Color32(0xFE, 0xE5, 0x00, 0xFF), true); one.pickingMode = PickingMode.Ignore; one.style.marginLeft = 6;   // 안 읽음 1
                row.Add(bub); row.Add(one);
                // 위에서부터 지그재그로 쌓이다가 화면이 차면 다시 위로 (겹쳐도 됨 — 탄막)
                float rows = Mathf.Max(4, Mathf.Floor((h - 220) / 70));
                float y = 40 + (i % rows) * 70 + (float)rng.NextDouble() * 24;
                float x = (i % 2 == 0 ? 0.05f : 0.45f) * w + (float)rng.NextDouble() * w * 0.25f;
                Ui.Abs(row, Mathf.Min(x, w - 460), y);
                row.style.rotate = new Rotate(new Angle((float)(rng.NextDouble() * 14 - 7)));
                row.style.scale = new Scale(new Vector3(1.5f, 1.5f, 1));
                b.Add(row);
                yield return null;
                row.style.scale = new Scale(Vector3.one);
                row.style.transitionProperty = new StyleList<StylePropertyName>(new List<StylePropertyName> { new StylePropertyName("scale") });
                row.style.transitionDuration = new StyleList<TimeValue>(new List<TimeValue> { new TimeValue(0.08f) });
                yield return new WaitForSeconds(autoSkipDialog ? 0.03f : 0.11f);
            }
        }

        /// 미래 돌발 풀매수 체결 알림: 화면 가운데 빨간 카드 (피드백: 갑자기 돈이 사라져서 찾아보니 주식을 사 놨음)
        IEnumerator ImpulseAlert(SimEvent e)
        {
            string tk = e.Str("tk"); string nm = tk != null && D.TK.TryGetValue(tk, out var t) ? t.name : tk;
            var dim = new VisualElement(); Ui.Fill(dim); dim.style.backgroundColor = new Color(0.25f, 0f, 0.03f, 0.55f); dim.style.alignItems = Align.Center; dim.style.justifyContent = Justify.Center;
            var card = Ui.Box(new Color(0.08f, 0.02f, 0.03f, 0.97f), 36, 22); card.style.width = 760; card.style.alignItems = Align.Center; Ui.Border(card, MenRed, 5);
            card.Add(Ui.Label("체결 알림 · 개미증권", 22, new Color(1f, 0.75f, 0.75f), true));
            var h = Ui.Label("미래가 몰래 풀매수함", 54, MenRed, true); h.style.marginTop = 6; card.Add(h);
            var n = Ui.Label($"{nm} {(e["coin"] is bool c && c ? "1x 롱" : "매수")}", 40, Ui.Text, true); n.style.marginTop = 10; card.Add(n);
            var a = Ui.Label($"−{G.won(e.Num("amt"))}", 64, MenRed, true); a.style.marginTop = 4; card.Add(a);
            card.Add(Ui.Label($"현금 {G.won(e.Num("cash0"))} → {G.won(e.Num("cash1"))}", 26, Ui.Gold, true));
            var hint = Ui.Label("내 계좌에서 확인 · 클릭 / Space", 18, Ui.Dim); hint.style.marginTop = 16; card.Add(hint);
            dim.Add(card); stage.Add(dim);
            HoldFace("mental", true);
            float tt = 0;
            card.style.scale = new Scale(Vector3.one * 1.4f);
            while (tt < 0.25f) { tt += Time.unscaledDeltaTime; float p = EaseOut(tt / 0.25f); card.style.scale = new Scale(Vector3.one * Mathf.Lerp(1.4f, 1f, p)); card.style.translate = new Translate(Mathf.Sin(tt * 90) * 18 * (1 - p), 0); yield return null; }
            card.style.scale = new Scale(Vector3.one); card.style.translate = new Translate(0, 0);
            yield return null;
            float wait = autoSkipDialog ? 0.4f : 6f; tt = 0;
            while (tt < wait && !AnyPress()) { tt += Time.unscaledDeltaTime; a.style.opacity = 0.6f + 0.4f * Mathf.Abs(Mathf.Sin(tt * 5)); yield return null; }
            dim.RemoveFromHierarchy();
        }

        /// 멘헤라가 끝났으면 탄막·어둠 걷기 (RenderAll 에서)
        void BarrageSync()
        {
            if (barrage != null && S?.pending?.t != "menhera") { barrage.Clear(); MenheraFx(false); }
        }
    }
}
