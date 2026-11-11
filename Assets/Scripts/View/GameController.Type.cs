using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // 대사 타자 효과를 화면에 칠하는 쪽 + "넘기기 누름" 보호
    public partial class GameController
    {
        // ---------- 타자 효과 ----------
        Label dlgText;
        /// 어느 글자까지 보일지 (TypeReveal.cs). 화면은 글리프마다 "이 글리프는 원문 몇 번째 글자인가"만 물어서 불투명도를 칠한다
        readonly TypeReveal dlgType = new TypeReveal();
        /// 글리프가 알려 주는 원문 위치의 단위: 0 아직 모름 · 1 글자(UTF-16) · 2 바이트(UTF-8)
        int typeUnit; string typeUnitText; int[] typeByteToChar;

        Label NewDialogueText()
        {
            var l = new Label { name = "dialogueText", enableRichText = false };   // 대사엔 서식 태그가 없음 → 글리프 위치 = 글자 위치
            l.PostProcessTextVertices = DlgGlyphs;
            return l;
        }

        /// 대사 글자를 다시 칠함. fresh = 새 대사 (글 자체를 바꿈)
        void DlgPaint(bool fresh)
        {
            if (fresh) { dlgText.text = dlgType.Text; typeUnit = 0; }
            dlgText.MarkDirtyRepaint();
        }

        /// 글자 메시가 만들어질 때마다 불림: 아직 안 나온 글자는 투명하게, 방금 나온 글자는 옅게.
        /// 글리프와 글자를 짝짓는 건 엔진이 주는 원문 범위(textRange)만 쓴다 — 줄 높이 · 공백으로 추측하지 않음.
        void DlgGlyphs(TextElement.GlyphsEnumerable glyphs)
        {
            if (!dlgType.Typing) return;   // 다 나온 뒤엔 손대지 않음
            string text = dlgType.Text;
            bool ranged = dlgText.resolvedStyle.unityTextGenerator == TextGeneratorType.Advanced;   // 표준 생성기는 범위를 안 줌 (읽으면 예외)
            if (ranged && (typeUnit == 0 || typeUnitText != text))
            {
                int maxEnd = 0;
                foreach (var g in glyphs) { var r = g.textRange; if (r.start + r.length > maxEnd) maxEnd = r.start + r.length; }
                typeUnit = maxEnd > text.Length ? 2 : 1; typeUnitText = text;
                if (typeUnit == 2) typeByteToChar = ByteToChar(text);
            }
            int k = 0;   // 표준 생성기: 보이는 글자만 원문 순서대로 나옴
            foreach (var g in glyphs)
            {
                int ci;
                if (ranged) { int st = g.textRange.start; ci = typeUnit == 2 ? (st < typeByteToChar.Length ? typeByteToChar[st] : text.Length) : st; }
                else { while (k < text.Length && (char.IsWhiteSpace(text[k]) || text[k] == Ui.WJ)) k++; ci = k++; }
                byte a = dlgType.Alpha(ci);
                if (a == 255) continue;
                var vs = g.vertices;
                for (int i = 0; i < vs.Length; i++) { var v = vs[i]; var c = v.tint; c.a = (byte)(c.a * a / 255); v.tint = c; vs[i] = v; }
            }
        }

        /// UTF-8 바이트 위치 → 글자 위치 (엔진이 바이트 단위로 줄 때만 씀)
        static int[] ByteToChar(string s)
        {
            var m = new int[System.Text.Encoding.UTF8.GetByteCount(s) + 1];
            int b = 0;
            for (int i = 0; i < s.Length; i++)
            {
                int n = s[i] < 0x80 ? 1 : s[i] < 0x800 ? 2 : char.IsHighSurrogate(s[i]) ? 4 : 3;
                for (int j = 0; j < n && b < m.Length; j++) m[b++] = i;
                if (n == 4) i++;
            }
            for (; b < m.Length; b++) m[b] = s.Length;
            return m;
        }

        // ---------- 넘기기 누름 보호 ----------
        // 대사 · 카드는 "아무 데나 눌러 넘기기"를 Update 에서 받는데, 버튼 클릭 판정(UI Toolkit)은 그 프레임의 Update · 코루틴이 다 돈 뒤에 처리된다.
        // 그래서 마지막 대사를 넘긴 바로 그 누름이, 같은 프레임에 그 자리에 생긴 선택지 · 계획판 버튼까지 눌렀다 (유물이 저절로 골라짐 · 선택지가 바로 눌림).
        // 넘기기로 쓴 누름 뒤 GuardSec 동안은 화면 버튼이 누름을 받지 않고, 그 사이 연타는 보호 시간을 다시 늘린다 = 손을 한 번 멈춘 뒤 누른 것만 선택.
        const float GuardSec = 0.35f;
        float uiGuardUntil;
        bool uiSwallow;

        void GuardUi() => uiGuardUntil = Mathf.Max(uiGuardUntil, Time.unscaledTime + GuardSec);
        bool GuardOn => Time.unscaledTime < uiGuardUntil;

        void BuildGuard()
        {
            // 뿌리에서 내려가는 단계에 걸어 둠 → 어떤 버튼보다 먼저 봄
            root.RegisterCallback<PointerDownEvent>(e => { uiSwallow = GuardOn; if (uiSwallow) { GuardUi(); e.StopImmediatePropagation(); } }, TrickleDown.TrickleDown);
            root.RegisterCallback<PointerUpEvent>(e => { if (uiSwallow) e.StopImmediatePropagation(); }, TrickleDown.TrickleDown);
            root.RegisterCallback<MouseDownEvent>(e => { if (uiSwallow) e.StopImmediatePropagation(); }, TrickleDown.TrickleDown);
            root.RegisterCallback<MouseUpEvent>(e => { if (uiSwallow) e.StopImmediatePropagation(); }, TrickleDown.TrickleDown);
            root.RegisterCallback<ClickEvent>(e => { if (uiSwallow) e.StopImmediatePropagation(); }, TrickleDown.TrickleDown);
        }

        /// "아무 데나 누르면 닫힘" 카드(청산 경보 · 알바 설명 · 알바 결과)용: 눌렀으면 그 누름이 뒤 화면 버튼에 닿지 않게 보호까지
        bool AnyPressGuard()
        {
            if (!AnyPress()) return false;
            GuardUi(); return true;
        }
    }
}
