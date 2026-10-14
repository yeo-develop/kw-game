using System.Collections;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // 멘헤라 카톡 탄막: 미래 카톡이 무대 위로 하나씩 쏟아짐. 답장(멘헤라 pending 끝)하면 걷힘.
    public partial class GameController
    {
        static readonly Color KakaoYellow = new Color32(0xFE, 0xE5, 0x00, 0xF2);
        static readonly Color KakaoText = new Color32(0x19, 0x19, 0x19, 0xFF);
        VisualElement barrage;

        VisualElement Barrage()
        {
            if (barrage != null) return barrage;
            barrage = new VisualElement(); Ui.Fill(barrage); barrage.pickingMode = PickingMode.Ignore;
            stage.Insert(stage.IndexOf(panel), barrage);   // 선택지·대사창·토스트 아래, 미래 위 (답장 버튼을 가리지 않게)
            return barrage;
        }

        IEnumerator KakaoBarrage(string[] msgs)
        {
            var b = Barrage(); b.Clear();
            float w = Mathf.Max(600, stage.resolvedStyle.width), h = Mathf.Max(400, stage.resolvedStyle.height);
            var rng = new System.Random(msgs.Length * 7919 + (int)(Time.realtimeSinceStartup * 10));
            for (int i = 0; i < msgs.Length; i++)
            {
                var bub = Ui.Box(KakaoYellow, 14, 18);
                bub.pickingMode = PickingMode.Ignore;
                bub.style.maxWidth = 420;
                var who = Ui.Label("미래 ♥", 16, new Color32(0x5A, 0x4A, 0x00, 0xFF), true); who.pickingMode = PickingMode.Ignore;
                var txt = Ui.Label(msgs[i], 26, KakaoText, true); txt.pickingMode = PickingMode.Ignore;
                bub.Add(who); bub.Add(txt);
                // 위에서부터 지그재그로 쌓이다가 화면이 차면 다시 위로 (겹쳐도 됨 — 탄막)
                float rows = Mathf.Max(4, Mathf.Floor((h - 220) / 70));
                float y = 40 + (i % rows) * 70 + (float)rng.NextDouble() * 24;
                float x = (i % 2 == 0 ? 0.05f : 0.45f) * w + (float)rng.NextDouble() * w * 0.25f;
                Ui.Abs(bub, Mathf.Min(x, w - 440), y);
                bub.style.rotate = new Rotate(new Angle((float)(rng.NextDouble() * 12 - 6)));
                bub.style.scale = new Scale(new Vector3(0.6f, 0.6f, 1));
                b.Add(bub);
                yield return null;
                bub.style.scale = new Scale(Vector3.one);
                bub.style.transitionProperty = new StyleList<StylePropertyName>(new System.Collections.Generic.List<StylePropertyName> { new StylePropertyName("scale") });
                bub.style.transitionDuration = new StyleList<TimeValue>(new System.Collections.Generic.List<TimeValue> { new TimeValue(0.12f) });
                yield return new WaitForSeconds(autoSkipDialog ? 0.03f : 0.11f);
            }
        }

        /// 멘헤라가 끝났으면 탄막 걷기 (RenderAll 에서)
        void BarrageSync()
        {
            if (barrage != null && S?.pending?.t != "menhera") barrage.Clear();
        }
    }
}
