using System;
using System.Text;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    /// UI Toolkit 요소를 코드로 만드는 작은 도우미 (테마 스타일시트 없이 전부 인라인 스타일)
    public static class Ui
    {
        public static readonly Color Bg = new Color32(0x14, 0x14, 0x1c, 0xff);
        public static readonly Color Panel = new Color32(0x1f, 0x1f, 0x2b, 0xf2);
        public static readonly Color Panel2 = new Color32(0x2a, 0x2a, 0x3a, 0xff);
        public static readonly Color Accent = new Color32(0xff, 0x6b, 0x9d, 0xff);
        public static readonly Color Good = new Color32(0x5c, 0xd6, 0x8a, 0xff);
        public static readonly Color Bad = new Color32(0xff, 0x5c, 0x5c, 0xff);
        public static readonly Color Text = new Color32(0xee, 0xee, 0xf4, 0xff);
        public static readonly Color Dim = new Color32(0x9a, 0x9a, 0xb0, 0xff);
        public static readonly Color Gold = new Color32(0xff, 0xd1, 0x66, 0xff);

        /// 번들 폰트(Pretendard)에 없는 이모지(서로게이트 쌍·변형 선택자)를 화면 표시용으로만 지운다
        public static string Clean(string s)
        {
            if (string.IsNullOrEmpty(s)) return s ?? "";
            var sb = new StringBuilder(s.Length);
            for (int i = 0; i < s.Length; i++)
            {
                char c = s[i];
                if (char.IsHighSurrogate(c)) { i++; continue; }
                if (char.IsLowSurrogate(c) || c == '️' || c == '‍' || c == '⃣') continue;
                sb.Append(c);
            }
            return sb.ToString().Replace("<b>", "").Replace("</b>", "").TrimStart();
        }

        public static VisualElement Box(Color? bg = null, float pad = 0, float radius = 0)
        {
            var v = new VisualElement();
            if (bg.HasValue) v.style.backgroundColor = bg.Value;
            Pad(v, pad);
            if (radius > 0) Radius(v, radius);
            return v;
        }
        public static VisualElement Row(float gap = 0)
        {
            var v = new VisualElement();
            v.style.flexDirection = FlexDirection.Row;
            v.style.alignItems = Align.Center;
            return v;
        }
        public static void Pad(VisualElement v, float p) { v.style.paddingLeft = p; v.style.paddingRight = p; v.style.paddingTop = p; v.style.paddingBottom = p; }
        public static void Margin(VisualElement v, float m) { v.style.marginLeft = m; v.style.marginRight = m; v.style.marginTop = m; v.style.marginBottom = m; }
        public static void Radius(VisualElement v, float r) { v.style.borderTopLeftRadius = r; v.style.borderTopRightRadius = r; v.style.borderBottomLeftRadius = r; v.style.borderBottomRightRadius = r; }
        public static void Border(VisualElement v, Color c, float w)
        {
            v.style.borderLeftColor = c; v.style.borderRightColor = c; v.style.borderTopColor = c; v.style.borderBottomColor = c;
            v.style.borderLeftWidth = w; v.style.borderRightWidth = w; v.style.borderTopWidth = w; v.style.borderBottomWidth = w;
        }
        public static void Abs(VisualElement v, float? left = null, float? top = null, float? right = null, float? bottom = null)
        {
            v.style.position = Position.Absolute;
            if (left.HasValue) v.style.left = left.Value;
            if (top.HasValue) v.style.top = top.Value;
            if (right.HasValue) v.style.right = right.Value;
            if (bottom.HasValue) v.style.bottom = bottom.Value;
        }
        public static void Fill(VisualElement v) { Abs(v, 0, 0, 0, 0); }

        public static Label Label(string text, float size = 24, Color? color = null, bool bold = false)
        {
            var l = new Label(Clean(text));
            l.style.fontSize = size;
            l.style.color = color ?? Text;
            l.style.whiteSpace = WhiteSpace.Normal;
            if (bold) l.style.unityFontStyleAndWeight = FontStyle.Bold;
            l.style.marginBottom = 0; l.style.marginTop = 0; l.style.paddingLeft = 0; l.style.paddingRight = 0;
            return l;
        }

        public static Button Button(string text, Action onClick, string sub = null, bool disabled = false, Color? bg = null, float size = 24)
        {
            var b = new Button(() => { if (!disabled) onClick?.Invoke(); }) { text = "" };
            b.style.flexDirection = FlexDirection.Column;
            b.style.alignItems = Align.FlexStart;
            b.style.backgroundColor = disabled ? new Color(0.18f, 0.18f, 0.22f, 1) : (bg ?? Panel2);
            Border(b, disabled ? new Color(0.25f, 0.25f, 0.3f) : new Color(1, 1, 1, 0.12f), 1);
            Radius(b, 10);
            b.style.paddingLeft = 18; b.style.paddingRight = 18; b.style.paddingTop = 12; b.style.paddingBottom = 12;
            b.style.marginBottom = 10; b.style.marginLeft = 0; b.style.marginRight = 0;
            var l = Label(text, size, disabled ? Dim : Text, true);
            l.pickingMode = PickingMode.Ignore;
            b.Add(l);
            if (!string.IsNullOrEmpty(sub))
            {
                var s = Label(sub, size * 0.72f, Dim);
                s.pickingMode = PickingMode.Ignore;
                s.style.marginTop = 4;
                b.Add(s);
            }
            if (!disabled)
            {
                Color baseC = bg ?? Panel2;
                b.RegisterCallback<PointerEnterEvent>(_ => b.style.backgroundColor = Color.Lerp(baseC, Accent, 0.35f));
                b.RegisterCallback<PointerLeaveEvent>(_ => b.style.backgroundColor = baseC);
            }
            return b;
        }

        /// 작은 가로 버튼 (칩)
        public static Button Chip(string text, Action onClick, bool disabled = false, Color? bg = null)
        {
            var b = Button(text, onClick, null, disabled, bg, 20);
            b.style.marginRight = 8; b.style.paddingTop = 8; b.style.paddingBottom = 8; b.style.paddingLeft = 12; b.style.paddingRight = 12;
            return b;
        }

        /// 0~1 값을 클릭/드래그로 고르는 막대 (테마 없이 보이는 슬라이더)
        public static VisualElement ScoreBar(float width, Action<float> onChange, float init = 0.7f)
        {
            var bar = Box(new Color(1, 1, 1, 0.1f), 0, 8);
            bar.style.width = width; bar.style.height = 44;
            var fill = Box(Accent, 0, 8);
            fill.style.height = Length.Percent(100);
            fill.style.width = Length.Percent(init * 100);
            fill.pickingMode = PickingMode.Ignore;
            bar.Add(fill);
            bool drag = false;
            void Set(Vector2 p) { float v = Mathf.Clamp01(p.x / Mathf.Max(1, bar.resolvedStyle.width)); fill.style.width = Length.Percent(v * 100); onChange(v); }
            bar.RegisterCallback<PointerDownEvent>(e => { drag = true; Set(e.localPosition); bar.CapturePointer(e.pointerId); });
            bar.RegisterCallback<PointerMoveEvent>(e => { if (drag) Set(e.localPosition); });
            bar.RegisterCallback<PointerUpEvent>(e => { drag = false; bar.ReleasePointer(e.pointerId); });
            onChange(init);
            return bar;
        }
    }
}
