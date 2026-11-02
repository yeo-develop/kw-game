using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // 연출 이펙트 — pixelfx(github.com/patch-gg/pixelfx) 의 방법만 빌려 게임 그림체(매끈한 벡터 UI)로 다시 그림:
    // 첫 프레임 흰 섬광 · 빨리 들어오고 천천히 빠짐 · 파편/잔불 같은 2차 움직임 · 정해진 씨앗 · 끝날 땐 깨끗이 사라짐.
    // Painter2D 로 그리는 층(JuiceLayer)을 부모 위에 덮었다가 끝나면 걷음. 클릭은 통과.
    public partial class GameController
    {
        abstract class Juice
        {
            public float t; public abstract float Dur { get; }
            public JuiceLayer L;
            public virtual void Start() { }
            public virtual void Step(float dt) { }
            public abstract void Draw(Painter2D p);
        }

        class JuiceLayer : VisualElement
        {
            readonly Juice j; float last;
            public JuiceLayer(Juice j)
            {
                this.j = j; j.L = this; pickingMode = PickingMode.Ignore; Ui.Fill(this);
                generateVisualContent += ctx => j.Draw(ctx.painter2D);
                last = Time.unscaledTime;
                schedule.Execute(Tick).Every(16).Until(() => parent == null);
            }
            void Tick()
            {
                float now = Time.unscaledTime, dt = Mathf.Min(0.05f, now - last); last = now;
                j.t += dt; j.Step(dt);
                if (j.t >= j.Dur) { RemoveFromHierarchy(); return; }
                MarkDirtyRepaint();
            }
        }

        static VisualElement PlayJuice(VisualElement parent, Juice j)
        {
            if (parent == null) return null;
            var L = new JuiceLayer(j); parent.Add(L); j.Start(); return L;
        }

        // ---------- 그리기 도구 ----------
        static float OutCubic(float u) { u = Mathf.Clamp01(u); return 1 - (1 - u) * (1 - u) * (1 - u); }
        static float OutBack(float u) { u = Mathf.Clamp01(u); const float c = 1.9f; return 1 + (c + 1) * Mathf.Pow(u - 1, 3) + c * Mathf.Pow(u - 1, 2); }
        static Color A(Color c, float a) => new Color(c.r, c.g, c.b, c.a * Mathf.Clamp01(a));
        static Vector2 Rot(Vector2 v, float a) { float c = Mathf.Cos(a), s = Mathf.Sin(a); return new Vector2(v.x * c - v.y * s, v.x * s + v.y * c); }
        static void Disc(Painter2D p, Vector2 c, float r, Color col)
        {
            if (r <= 0.3f || col.a <= 0.005f) return;
            p.fillColor = col; p.BeginPath(); p.Arc(c, r, Angle.Degrees(0), Angle.Degrees(360)); p.Fill();
        }
        static void Ring(Painter2D p, Vector2 c, float r, float w, Color col)
        {
            if (r <= 0.5f || w <= 0.2f || col.a <= 0.005f) return;
            p.strokeColor = col; p.lineWidth = w; p.BeginPath(); p.Arc(c, r, Angle.Degrees(0), Angle.Degrees(360)); p.Stroke();
        }
        /// 부드러운 빛 (블러 대신 겹친 원)
        static void Glow(Painter2D p, Vector2 c, float r, Color col, float a)
        {
            for (int k = 0; k < 5; k++) Disc(p, c, r * (1 - k * 0.17f), A(col, a * 0.16f));
        }
        static void Poly(Painter2D p, List<Vector2> pts, Color fill, Color? line = null, float lw = 0)
        {
            if (pts.Count < 3) return;
            p.BeginPath(); p.MoveTo(pts[0]); for (int i = 1; i < pts.Count; i++) p.LineTo(pts[i]); p.ClosePath();
            if (fill.a > 0.005f) { p.fillColor = fill; p.Fill(); }
            if (line is Color lc && lw > 0 && lc.a > 0.005f) { p.strokeColor = lc; p.lineWidth = lw; p.lineJoin = LineJoin.Round; p.Stroke(); }
        }
        static float Rnd(System.Random r, float a, float b) => a + (float)r.NextDouble() * (b - a);

        // ---------- 1. 청산: 만화 폭발 + "청산!" ----------
        class LiqBurst : Juice
        {
            readonly Vector2 c; readonly float s; readonly float[] spikes = new float[16];
            readonly List<(Vector2 p, Vector2 v, float a, float va, float sz)> shards = new List<(Vector2, Vector2, float, float, float)>();
            Label txt;
            static readonly Color Dark = new Color32(0x5a, 0x0f, 0x1f, 0xff), Red = new Color32(0xf0, 0x3a, 0x52, 0xff), Hot = new Color32(0xff, 0x9a, 0x6a, 0xff);
            public override float Dur => 1.15f;
            public LiqBurst(Vector2 c, float s, int seed)
            {
                this.c = c; this.s = s; var R = new System.Random(seed);
                for (int i = 0; i < spikes.Length; i++) spikes[i] = Rnd(R, 0.82f, 1.15f);
                for (int i = 0; i < 12; i++)
                {
                    float a = i / 12f * Mathf.PI * 2 + Rnd(R, -0.2f, 0.2f), sp = Rnd(R, 380, 620) * s;
                    shards.Add((c, new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * sp, Rnd(R, 0, 6), Rnd(R, -14, 14), Rnd(R, 7, 13) * s));
                }
            }
            public override void Start()
            {
                txt = Ui.Label("청산!", 68 * s, Color.white, true); txt.pickingMode = PickingMode.Ignore;
                txt.style.position = Position.Absolute; txt.style.width = 400 * s; txt.style.left = c.x - 200 * s; txt.style.top = c.y - 48 * s;
                txt.style.unityTextAlign = TextAnchor.MiddleCenter; txt.style.unityTextOutlineColor = Dark; txt.style.unityTextOutlineWidth = 3;
                L.Add(txt); Step(0);
            }
            float K => t < 0.12f ? OutBack(t / 0.12f) : t < 0.72f ? 1 : 1 - OutCubic((t - 0.72f) / 0.3f);
            public override void Step(float dt)
            {
                for (int i = 0; i < shards.Count; i++)
                {
                    var (p, v, a, va, sz) = shards[i];
                    v *= Mathf.Pow(0.02f, dt); v.y += 900 * s * dt;   // 공기 저항 + 중력
                    shards[i] = (p + v * dt, v, a + va * dt, va, sz);
                }
                float k = K, shake = t < 0.3f ? (1 - t / 0.3f) * 6 * s : 0;
                txt.style.scale = new Scale(Vector3.one * Mathf.Max(0.01f, k * 1.05f));
                txt.style.translate = new Translate(Mathf.Sin(t * 70) * shake, 0);
                txt.style.opacity = Mathf.Clamp01(k * 1.5f);
            }
            public override void Draw(Painter2D p)
            {
                float k = K;
                if (t < 0.1f) Glow(p, c, 150 * s * (0.6f + t * 4), Color.white, 1 - t / 0.1f);   // 첫 순간 흰 섬광
                float u = Mathf.Clamp01(t / 0.45f);
                Ring(p, c, (50 + 190 * OutCubic(u)) * s, 7 * s * (1 - u), A(Red, 1 - u));
                foreach (var (sp, _, a, _, sz) in shards)
                {
                    float f = 1 - Mathf.Clamp01((t - 0.35f) / 0.45f); if (f <= 0) break;
                    var pts = new List<Vector2> { sp + Rot(new Vector2(sz, 0), a), sp + Rot(new Vector2(-sz * 0.6f, sz * 0.5f), a), sp + Rot(new Vector2(-sz * 0.5f, -sz * 0.6f), a) };
                    Poly(p, pts, A(Red, f));
                }
                if (k <= 0.01f) return;
                float wob = Mathf.Sin(t * 9) * 0.04f;
                foreach (var (col, rr, lw) in new[] { (Dark, 1.12f, 0f), (Red, 1f, 0f), (Hot, 0.62f, 0f) })
                {
                    var pts = new List<Vector2>();
                    for (int i = 0; i < spikes.Length * 2; i++)
                    {
                        float a = i / (spikes.Length * 2f) * Mathf.PI * 2 + wob, r = (i % 2 == 0 ? 112 * spikes[i / 2] : 70) * s * rr * k;
                        pts.Add(c + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * r);
                    }
                    Poly(p, pts, col);
                }
            }
        }

        // ---------- 2. 일당 코인: 튀어 올랐다가 금액으로 빨려 들어감 ----------
        class CoinFly : Juice
        {
            readonly Vector2 from, to; readonly float s;
            readonly List<(Vector2 v, float delay, float spin, float arrive)> coins = new List<(Vector2, float, float, float)>();
            static readonly Color Gold = new Color32(0xff, 0xcf, 0x4a, 0xff), Rim = new Color32(0xc2, 0x84, 0x10, 0xff), Shine = new Color32(0xff, 0xf3, 0xc0, 0xff);
            public override float Dur => 1.75f;
            public CoinFly(Vector2 from, Vector2 to, float s, int n, int seed)
            {
                this.from = from; this.to = to; this.s = s; var R = new System.Random(seed);
                for (int i = 0; i < n; i++)
                    coins.Add((new Vector2(Rnd(R, -260, 260), Rnd(R, -720, -480)) * s, i * 0.035f, Rnd(R, 8, 14), 0.75f + i * 0.06f));
            }
            Vector2 Pos(int i, out float alpha)
            {
                var (v, d, _, arr) = coins[i]; float tt = t - d; alpha = 1;
                if (tt < 0) { alpha = 0; return from; }
                const float Up = 0.42f; var g = new Vector2(0, 1500 * s);
                if (tt < Up) return from + v * tt + 0.5f * g * tt * tt;   // 포물선으로 튀어 오름
                var top = from + v * Up + 0.5f * g * Up * Up;
                float u = Mathf.Clamp01((tt - Up) / (arr - Up)); u = u * u * u;   // 천천히 → 빨려 들어감
                var mid = new Vector2((top.x + to.x) / 2, Mathf.Min(top.y, to.y) - 120 * s);
                if (tt >= arr) alpha = 0;
                return (1 - u) * (1 - u) * top + 2 * (1 - u) * u * mid + u * u * to;
            }
            public override void Draw(Painter2D p)
            {
                for (int i = 0; i < coins.Count; i++)
                {
                    var (_, d, spin, arr) = coins[i];
                    float since = t - d - arr;
                    if (since >= 0 && since < 0.25f) { float f = 1 - since / 0.25f; Glow(p, to, 46 * s * (1.2f - f * 0.4f), Gold, f); Ring(p, to, 18 * s + 40 * s * (1 - f), 3 * s * f, A(Shine, f)); }   // 도착 반짝
                    var c = Pos(i, out float al); if (al <= 0) continue;
                    float r = 17 * s, w = Mathf.Max(0.18f, Mathf.Abs(Mathf.Cos((t - d) * spin)));   // 빙글 (가로 폭만 줄임)
                    var pts = new List<Vector2>(); for (int k = 0; k < 20; k++) { float a = k / 20f * Mathf.PI * 2; pts.Add(c + new Vector2(Mathf.Cos(a) * r * w, Mathf.Sin(a) * r)); }
                    Poly(p, pts, Gold, Rim, 3 * s);
                    var sh = new List<Vector2>(); for (int k = 0; k < 12; k++) { float a = k / 12f * Mathf.PI * 2; sh.Add(c + new Vector2(-r * 0.3f * w + Mathf.Cos(a) * r * 0.22f * w, -r * 0.35f + Mathf.Sin(a) * r * 0.22f)); }
                    Poly(p, sh, A(Shine, 0.9f));
                }
            }
        }

        // ---------- 3. 하트 깨짐: 반으로 갈라져 떨어짐 ----------
        class HeartBreak : Juice
        {
            readonly Vector2 c; readonly float s;
            static readonly Color Body = new Color32(0xff, 0x4d, 0x6d, 0xff), Edge = new Color32(0x8a, 0x12, 0x2e, 0xff);
            public override float Dur => 0.95f;
            public HeartBreak(Vector2 c, float s) { this.c = c; this.s = s; }
            static Vector2 H(float a) => new Vector2(16 * Mathf.Pow(Mathf.Sin(a), 3), -(13 * Mathf.Cos(a) - 5 * Mathf.Cos(2 * a) - 2 * Mathf.Cos(3 * a) - Mathf.Cos(4 * a)));
            static readonly Vector2[] Crack = { new Vector2(0, -5), new Vector2(2.5f, -0.5f), new Vector2(-2, 4), new Vector2(2, 9), new Vector2(-1, 13), new Vector2(0, 17) };
            List<Vector2> Half(bool right, Vector2 off, float rot, float sc)
            {
                var pts = new List<Vector2>();
                float a0 = right ? 0 : Mathf.PI, a1 = right ? Mathf.PI : Mathf.PI * 2;
                for (int i = 0; i <= 16; i++) pts.Add(H(Mathf.Lerp(a0, a1, i / 16f)));
                if (right) for (int i = Crack.Length - 1; i >= 0; i--) pts.Add(Crack[i]); else foreach (var q in Crack) pts.Add(q);
                for (int i = 0; i < pts.Count; i++) pts[i] = c + off + Rot(pts[i] * sc, rot);
                return pts;
            }
            public override void Draw(Painter2D p)
            {
                float sc = 2.1f * s * (t < 0.12f ? OutBack(t / 0.12f) : 1);
                if (t < 0.22f)
                {
                    if (t < 0.08f) Glow(p, c, 70 * s, Color.white, 1 - t / 0.08f);
                    Poly(p, Half(true, Vector2.zero, 0, sc), Body, Edge, 3 * s); Poly(p, Half(false, Vector2.zero, 0, sc), Body, Edge, 3 * s);
                    return;
                }
                float u = t - 0.22f, f = 1 - Mathf.Clamp01(u / 0.73f);
                for (int side = -1; side <= 1; side += 2)
                {
                    var off = new Vector2(side * 70 * s * u, -60 * s * u + 700 * s * u * u);
                    Poly(p, Half(side > 0, off, side * 2.4f * u, sc), A(Body, f), A(Edge, f), 3 * s);
                }
            }
        }

        // ---------- 4. 빚 청산 꽃가루 (양쪽 아래에서) ----------
        class Confetti : Juice
        {
            readonly float W, H;
            readonly List<(Vector2 p, Vector2 v, float a, float va, float ph, Color col, bool round)> bits = new List<(Vector2, Vector2, float, float, float, Color, bool)>();
            static readonly Color[] Cols = { new Color32(0xff, 0x6b, 0x9d, 0xff), new Color32(0xff, 0xd1, 0x66, 0xff), new Color32(0x6e, 0xe7, 0xb7, 0xff), new Color32(0x7c, 0xc4, 0xff, 0xff), new Color32(0xc3, 0xa6, 0xff, 0xff), Color.white };
            public override float Dur => 3.4f;
            public Confetti(float W, float H, int seed)
            {
                this.W = W; this.H = H; var R = new System.Random(seed);
                for (int i = 0; i < 90; i++)
                {
                    int side = i % 2 == 0 ? 1 : -1;
                    var p = new Vector2(side > 0 ? W * 0.06f : W * 0.94f, H + 10);
                    var v = new Vector2(side * Rnd(R, 250, 750), -Rnd(R, 1900, 2500));   // 화면 위쪽까지 솟구침
                    bits.Add((p, v, Rnd(R, 0, 6), Rnd(R, -9, 9), Rnd(R, 0, 6), Cols[R.Next(Cols.Length)], R.NextDouble() < 0.25));
                }
            }
            public override void Step(float dt)
            {
                for (int i = 0; i < bits.Count; i++)
                {
                    var (p, v, a, va, ph, col, rd) = bits[i];
                    v.y += 1100 * dt; v *= Mathf.Pow(0.35f, dt);
                    if (v.y > 230) v.y = 230;   // 종이처럼 천천히 내려옴
                    p += v * dt + new Vector2(Mathf.Sin(t * 5 + ph) * 70 * dt, 0);
                    bits[i] = (p, v, a + va * dt, va, ph, col, rd);
                }
            }
            public override void Draw(Painter2D p)
            {
                float f = 1 - Mathf.Clamp01((t - 2.6f) / 0.8f);
                foreach (var (q, _, a, _, ph, col, rd) in bits)
                {
                    var cc = A(col, f);
                    if (rd) { Disc(p, q, 5, cc); continue; }
                    float w = 9 * Mathf.Max(0.15f, Mathf.Abs(Mathf.Cos(t * 7 + ph))), h = 5;   // 뒤집히며 펄럭
                    Poly(p, new List<Vector2> { q + Rot(new Vector2(-w, -h), a), q + Rot(new Vector2(w, -h), a), q + Rot(new Vector2(w, h), a), q + Rot(new Vector2(-w, h), a) }, cc);
                }
            }
        }

        // ---------- 5. 화면 열림 (원형 와이프) ----------
        class IrisOpen : Juice
        {
            readonly float W, H; readonly Vector2 c;
            public override float Dur => 0.55f;
            public IrisOpen(float W, float H) { this.W = W; this.H = H; c = new Vector2(W / 2, H / 2); }
            public override void Draw(Painter2D p)
            {
                float r = Mathf.Sqrt(W * W + H * H) / 2 * OutCubic(t / Dur) + 1;
                p.fillColor = new Color(0.05f, 0.04f, 0.08f, 1);
                p.BeginPath(); p.MoveTo(new Vector2(-4, -4)); p.LineTo(new Vector2(W + 4, -4)); p.LineTo(new Vector2(W + 4, H + 4)); p.LineTo(new Vector2(-4, H + 4)); p.ClosePath();
                p.MoveTo(c + new Vector2(r, 0)); p.Arc(c, r, Angle.Degrees(0), Angle.Degrees(180)); p.Arc(c, r, Angle.Degrees(180), Angle.Degrees(360)); p.ClosePath();
                p.Fill(FillRule.OddEven);
                Ring(p, c, r, 4, A(Ui.Accent, 0.7f * (1 - t / Dur)));
            }
        }

        // ---------- 6. 카운트다운 숫자 뒤 쓸고 지나가는 고리 ----------
        class SweepRing : Juice
        {
            readonly Vector2 c; readonly Color col;
            public override float Dur => 0.42f;
            public SweepRing(Vector2 c, Color col) { this.c = c; this.col = col; }
            public override void Draw(Painter2D p)
            {
                float u = t / Dur, f = u < 0.75f ? 1 : 1 - (u - 0.75f) / 0.25f;
                p.strokeColor = A(col, 0.85f * f); p.lineWidth = 9; p.lineCap = LineCap.Round;
                p.BeginPath(); p.Arc(c, 150, Angle.Degrees(-90), Angle.Degrees(-90 + 360 * OutCubic(u * 1.3f))); p.Stroke();
                Ring(p, c, 150 + 30 * u, 2, A(col, 0.35f * (1 - u)));
            }
        }

        // ---------- 붙이는 곳에서 부르는 것 ----------
        int juiceSeed = 1;
        VisualElement JuiceLiq(VisualElement parent, float x, float y, float s = 1) { var v = PlayJuice(parent, new LiqBurst(new Vector2(x, y), s, juiceSeed++)); v?.BringToFront(); return v; }
        VisualElement JuiceCoins(VisualElement parent, Vector2 from, Vector2 to, int n = 9) => PlayJuice(parent, new CoinFly(from, to, 1, n, juiceSeed++));
        VisualElement JuiceHeart(VisualElement parent, float x, float y, float s = 1) => PlayJuice(parent, new HeartBreak(new Vector2(x, y), s));
        VisualElement JuiceConfetti(VisualElement parent) { var v = PlayJuice(parent, new Confetti(SizeOf(parent).x, SizeOf(parent).y, juiceSeed++)); v?.BringToFront(); return v; }
        VisualElement JuiceIris(VisualElement parent) => PlayJuice(parent, new IrisOpen(SizeOf(parent).x, SizeOf(parent).y));
        static Vector2 SizeOf(VisualElement v) => v != null && v.layout.width > 10 ? new Vector2(v.layout.width, v.layout.height) : new Vector2(1920, 1080);
        VisualElement JuiceSweep(VisualElement parent, Vector2 c, Color col) => PlayJuice(parent, new SweepRing(c, col));

        /// 검증용: `-kwFxShots <폴더>` → 이펙트마다 중간을 찍고 종료
        System.Collections.IEnumerator FxShots(string dir)
        {
            System.IO.Directory.CreateDirectory(dir);
            yield return new WaitForSeconds(1f);
            var shots = new (string k, float at, Func<VisualElement> run)[]
            {
                ("liq_a", 0.06f, () => JuiceLiq(root, 960, 470)), ("liq_b", 0.35f, () => JuiceLiq(root, 960, 470)),
                ("coin_a", 0.35f, () => JuiceCoins(root, new Vector2(760, 820), new Vector2(1100, 300))), ("coin_b", 0.95f, () => JuiceCoins(root, new Vector2(760, 820), new Vector2(1100, 300))),
                ("heart_a", 0.1f, () => JuiceHeart(root, 960, 540)), ("heart_b", 0.45f, () => JuiceHeart(root, 960, 540)),
                ("confetti", 1.2f, () => JuiceConfetti(root)), ("iris", 0.2f, () => JuiceIris(root)), ("sweep", 0.25f, () => JuiceSweep(root, new Vector2(960, 540), Ui.Accent)),
            };
            foreach (var (k, at, run) in shots)
            {
                var v = run();
                yield return new WaitForSeconds(at);
                yield return new WaitForEndOfFrame();
                ScreenCapture.CaptureScreenshot(System.IO.Path.Combine(dir, "fx_" + k + ".png"));
                yield return new WaitForSeconds(0.15f);
                v?.RemoveFromHierarchy();
            }
            Application.Quit();
        }
    }
}
