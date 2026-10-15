using System.Collections;
using System.Collections.Generic;
using UnityEngine;
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
        VisualElement barrage, menDark, menFx;
        IVisualElementScheduledItem menTick;
        int menSeed;

        VisualElement Barrage()
        {
            if (barrage != null) return barrage;
            // 까만 막 = 배경 위·미래 아래 (미래만 어둠 속에 떠 보이게)
            menDark = new VisualElement(); Ui.Fill(menDark); menDark.pickingMode = PickingMode.Ignore; menDark.style.backgroundColor = new Color(0.02f, 0f, 0.01f, 0.93f);
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
            for (int i = 0; i < 70; i++)
            {
                bool white = i % 9 == 0;
                // 미래 쪽(왼쪽)에 몰리게, 나머지는 화면 전체
                float cx = i % 3 == 0 ? (float)rng.NextDouble() * W : (float)(0.05 + rng.NextDouble() * 0.45) * W;
                float cy = (float)rng.NextDouble() * H;
                float a = (float)(0.35 + rng.NextDouble() * 0.5);
                p.strokeColor = white ? new Color(1, 1, 1, a * 0.45f) : new Color(0.8f + (float)rng.NextDouble() * 0.15f, 0.04f, 0.08f, a);
                p.lineWidth = (float)(1.2 + rng.NextDouble() * (white ? 1.0 : 2.2));
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
            miraiEl.style.unityBackgroundImageTintColor = on ? new Color(0.78f, 0.62f, 0.66f) : Color.white;
            menTick?.Pause(); menTick = null;
            if (!on) { miraiEl.style.translate = new Translate(0, 0); barrage.style.translate = new Translate(0, 0); return; }
            // 떨림: 미래·카톡이 따로 덜덜, 낙서는 다시 휘갈김 (0.09초마다)
            menTick = menFx.schedule.Execute(() =>
            {
                menSeed++; menFx.MarkDirtyRepaint();
                float k = 5f; var rr = new System.Random(menSeed * 31);
                miraiEl.style.translate = new Translate((float)(rr.NextDouble() - 0.5) * k, (float)(rr.NextDouble() - 0.5) * k);
                barrage.style.translate = new Translate((float)(rr.NextDouble() - 0.5) * k * 0.6f, (float)(rr.NextDouble() - 0.5) * k * 0.6f);
            }).Every(90);
        }

        IEnumerator KakaoBarrage(string[] msgs)
        {
            var b = Barrage(); b.Clear();
            MenheraFx(true);
            float w = Mathf.Max(600, stage.resolvedStyle.width), h = Mathf.Max(400, stage.resolvedStyle.height);
            var rng = new System.Random(msgs.Length * 7919 + (int)(Time.realtimeSinceStartup * 10));
            // 뒤에 깔리는 빨간 글씨 (자기야 자기야 왜…)
            for (int i = 0; i < 22; i++)
            {
                var t = Ui.Label(MenWords[rng.Next(MenWords.Length)], 26 + rng.Next(46), MenRedDim, true); t.pickingMode = PickingMode.Ignore;
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

        /// 멘헤라가 끝났으면 탄막·어둠 걷기 (RenderAll 에서)
        void BarrageSync()
        {
            if (barrage != null && S?.pending?.t != "menhera") { barrage.Clear(); MenheraFx(false); }
        }
    }
}
