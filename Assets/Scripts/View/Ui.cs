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
        /// 경고 · 빚 (주황). 상승 빨강(StkUp #ff4d5e)과 헷갈리지 않게. 어두운 패널 위 명암비 약 7
        public static readonly Color Bad = new Color32(0xff, 0x8c, 0x42, 0xff);
        public static readonly Color Text = new Color32(0xee, 0xee, 0xf4, 0xff);
        public static readonly Color Dim = new Color32(0x9a, 0x9a, 0xb0, 0xff);
        public static readonly Color Gold = new Color32(0xff, 0xd1, 0x66, 0xff);
        /// 밝은 배경(분홍 Accent · 초록 · 금색) 위 글자: 본문 · 부제 (분홍 위 명암비 6.9 · 5.8)
        public static readonly Color Ink = new Color32(0x1a, 0x10, 0x20, 0xff);
        public static readonly Color InkSub = new Color32(0x3a, 0x1a, 0x28, 0xff);
        public static bool IsLight(Color c) => c.a > 0.5f && c.grayscale > 0.58f;   // 분홍(0.62) · 주황 · 금색은 밝음, 상승 빨강(0.52) · 하락 파랑(0.53)은 흰 글자 그대로
        /// 화면 효과 끔 (설정 · PlayerPrefs "kw.fx" = 0): 흔들림 · 폭죽 · 청산 터짐 · 멘헤라 탄막 생략
        public static bool FxOff;

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

        /// 낱말 이음표 (U+2060): 폭 0 · 안 보임 · 그 앞뒤에서는 줄이 안 끊김
        public const char WJ = '⁠';
        /// 글자(숫자 · 기호 제외)가 이 수까지인 낱말만 묶음. 더 긴 덩어리(ㅋㅋㅋㅋ…)는 좁은 칸에서 넘치지 않게 그대로 둠
        public const int KeepMax = 10;

        /// 한글 낱말이 글자 중간에서 줄바꿈되지 않게 ("무서워 ㅠ / ㅠ" · "미 / 래가") 낱말 안 글자 사이에 이음표를 넣는다.
        /// 이 Unity 의 기본 텍스트 생성기(Advanced)엔 '낱말 단위 줄바꿈' 설정이 없어서 글 쪽에서 막음. 띄어쓰기 없는 한 낱말은 그대로 (비교 · 좁은 칸).
        public static string KeepAll(string s)
        {
            if (string.IsNullOrEmpty(s) || s.IndexOf(WJ) >= 0) return s ?? "";
            int sp = -1;
            for (int i = 0; i < s.Length; i++) if (char.IsWhiteSpace(s[i])) { sp = i; break; }
            if (sp < 0) return s;
            var sb = new StringBuilder(s.Length * 2);
            int a = 0;
            while (a < s.Length)
            {
                if (char.IsWhiteSpace(s[a])) { sb.Append(s[a++]); continue; }
                int b = a, letters = 0;
                for (; b < s.Length && !char.IsWhiteSpace(s[b]); b++) if (!(s[b] < 0x80 && (char.IsDigit(s[b]) || char.IsPunctuation(s[b]) || char.IsSymbol(s[b])))) letters++;
                bool join = letters <= KeepMax;   // 숫자 · 쉼표 · 기호는 안 셈: "30,000,000원," 도 한 덩어리
                for (int i = a; i < b; i++) { if (join && i > a) sb.Append(WJ); sb.Append(s[i]); }
                a = b;
            }
            return sb.ToString();
        }
        /// 이음표를 뺀 원래 글 (글자 비교 · 길이 계산용)
        public static string Plain(string s) => s == null ? null : s.IndexOf(WJ) < 0 ? s : s.Replace(WJ.ToString(), "");
        /// 화면에 올릴 글: 이모지 정리 + 낱말 단위 줄바꿈. 보통 굵기 글에만 쓴다 (굵은 글은 Clean — Ui.Label 주석)
        public static string Show(string s) => KeepAll(Clean(s));

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
            // 굵은 글씨엔 이음표를 넣지 않음: 굵게(가짜 굵기)는 글자마다 간격을 더하는데 이음표에도 붙어서 자간이 5~9% 벌어짐. 굵은 글은 제목 · 숫자라 대부분 한 줄
            var l = new Label(bold ? Clean(text) : Show(text));
            l.style.fontSize = size;
            l.style.color = color ?? Text;
            l.style.whiteSpace = WhiteSpace.Normal;
            if (bold) l.style.unityFontStyleAndWeight = FontStyle.Bold;
            l.style.marginBottom = 0; l.style.marginTop = 0; l.style.paddingLeft = 0; l.style.paddingRight = 0;
            return l;
        }

        public static Button Button(string text, Action onClick, string sub = null, bool disabled = false, Color? bg = null, float size = 24)
            => Button(text, onClick, sub, disabled, bg, size, KwGame.Audio.SoundCue.ButtonClick);
        static Button Button(string text, Action onClick, string sub, bool disabled, Color? bg, float size, KwGame.Audio.SoundCue click)
        {
            // 잠긴 버튼도 누르면 '띡' (왜 안 되지? 를 소리로)
            Button b = null;
            b = new Button(() => { KwGame.Audio.GameAudioManager.Play(disabled ? KwGame.Audio.SoundCue.UiDenied : click); b.Blur(); if (!disabled) onClick?.Invoke(); }) { text = "" };   // Blur: 누른 버튼이 포커스를 쥐고 있으면 Space(대사 넘기기 · 일시정지)에 또 눌림. Tab 이동은 그대로 됨
            bool light = !disabled && IsLight(bg ?? Panel2);
            b.style.flexDirection = FlexDirection.Column;
            b.style.alignItems = Align.FlexStart;
            b.style.backgroundColor = disabled ? new Color(0.18f, 0.18f, 0.22f, 1) : (bg ?? Panel2);
            Border(b, disabled ? new Color(0.25f, 0.25f, 0.3f) : new Color(1, 1, 1, 0.12f), 1);
            Radius(b, 10);
            b.style.paddingLeft = 18; b.style.paddingRight = 18; b.style.paddingTop = 12; b.style.paddingBottom = 12;
            b.style.marginBottom = 10; b.style.marginLeft = 0; b.style.marginRight = 0;
            var l = Label(text, size, disabled ? Dim : light ? Ink : Text, true);
            l.pickingMode = PickingMode.Ignore;
            b.Add(l);
            if (!string.IsNullOrEmpty(sub))
            {
                var s = Label(sub, Mathf.Max(18, size * 0.85f), disabled ? Dim : light ? InkSub : Dim);
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
            var b = Button(text, onClick, null, disabled, bg, 20, KwGame.Audio.SoundCue.UiSelect);
            b.style.marginRight = 8; b.style.paddingTop = 8; b.style.paddingBottom = 8; b.style.paddingLeft = 12; b.style.paddingRight = 12;
            return b;
        }
    }
}
