using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // 픽셀 이펙트 (pixelfx, MIT — github.com/patch-gg/pixelfx). 시트는 tools/fx/build.py 로 Resources/Fx 에 구워 둠.
    // 코인 수령 · 청산 REKT · 목숨 깨짐 · 빚 청산 축하 · 미니게임 카운트다운 · 아이리스 전환
    public partial class GameController
    {
        [Serializable] class FxInfo { public string key; public int fps, n, w, h, cols, px, py; }
        [Serializable] class FxIndex { public List<FxInfo> items; }

        static Dictionary<string, FxInfo> fxIdx;
        static readonly Dictionary<string, Sprite[]> fxFrames = new Dictionary<string, Sprite[]>();

        static FxInfo FxMeta(string key)
        {
            if (fxIdx == null)
            {
                fxIdx = new Dictionary<string, FxInfo>();
                var ta = Resources.Load<TextAsset>("Fx/index");
                if (ta != null) foreach (var f in JsonUtility.FromJson<FxIndex>(ta.text).items) fxIdx[f.key] = f;
            }
            return fxIdx.TryGetValue(key, out var m) ? m : null;
        }

        static Sprite[] FxSprites(string key, FxInfo m)
        {
            if (fxFrames.TryGetValue(key, out var fr)) return fr;
            var tex = Resources.Load<Texture2D>("Fx/" + key);
            if (tex == null) return fxFrames[key] = null;
            fr = new Sprite[m.n];
            for (int i = 0; i < m.n; i++)
            {
                int cx = i % m.cols, cy = i / m.cols;   // 시트는 왼쪽 위부터, 텍스처 좌표는 아래부터
                fr[i] = Sprite.Create(tex, new Rect(cx * m.w, tex.height - (cy + 1) * m.h, m.w, m.h), new Vector2(0.5f, 0.5f), 100, 0, SpriteMeshType.FullRect);
            }
            return fxFrames[key] = fr;
        }

        /// parent 안 (x, y) 에 이펙트 기준점(발밑·중심)을 맞춰 한 번 재생. scale = 픽셀 배율, from = 시작 시각(초)
        VisualElement PixelFx(VisualElement parent, string key, float x, float y, float scale = 4, float from = 0)
        {
            var m = FxMeta(key); var fr = m != null ? FxSprites(key, m) : null;
            if (parent == null || fr == null) return null;
            var v = new VisualElement { pickingMode = PickingMode.Ignore };
            v.style.position = Position.Absolute; v.style.width = m.w * scale; v.style.height = m.h * scale;
            v.style.left = x - m.px * scale; v.style.top = y - m.py * scale;
            v.style.backgroundSize = new BackgroundSize(Length.Percent(100), Length.Percent(100));
            parent.Add(v);
            float t0 = Time.unscaledTime - from; int last = -1;
            void Tick()
            {
                int i = (int)((Time.unscaledTime - t0) * m.fps);
                if (i >= m.n) { v.RemoveFromHierarchy(); return; }
                if (i != last) { last = i; v.style.backgroundImage = new StyleBackground(fr[i]); }
            }
            Tick();
            v.schedule.Execute(Tick).Every(16).Until(() => v.parent == null);
            return v;
        }

        /// 화면(무대) 가운데쯤에 — 1920×1080 기준
        VisualElement StageFx(string key, float x = 960, float y = 540, float scale = 5) { var v = PixelFx(stage, key, x, y, scale); v?.BringToFront(); return v; }

        /// 검증용: `-kwFxShots <폴더>` → 이펙트마다 재생 중간을 찍고 종료
        System.Collections.IEnumerator FxShots(string dir)
        {
            System.IO.Directory.CreateDirectory(dir);
            yield return new WaitForSeconds(1f);
            foreach (var (k, at, x, y, sc) in new[] { ("rekt", 0.4f, 960f, 470f, 5f), ("coin", 0.9f, 580f, 900f, 4f), ("heart", 0.2f, 960f, 540f, 3f),
                ("confetti", 1.0f, 960f, 1060f, 8f), ("clear", 0.8f, 960f, 170f, 5f), ("countdown", 0.5f, 960f, 520f, 5f), ("iris", 0.2f, 0f, 0f, 6f) })
            {
                var v = PixelFx(root, k, x, y, sc, k == "iris" ? 1.0f : 0);
                yield return new WaitForSeconds(at);
                yield return new WaitForEndOfFrame();
                ScreenCapture.CaptureScreenshot(System.IO.Path.Combine(dir, "fx_" + k + ".png"));
                yield return new WaitForSeconds(0.2f);
                v?.RemoveFromHierarchy();
            }
            Application.Quit();
        }

        static float FxLength(string key) { var m = FxMeta(key); return m == null ? 0 : (float)m.n / m.fps; }
    }
}
