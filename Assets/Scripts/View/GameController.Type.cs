using System;
using System.Collections.Generic;
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
                typeUnit = TypePaint.Unit(maxEnd, text.Length); typeUnitText = text;
                if (typeUnit == 2) typeByteToChar = TypePaint.ByteToChar(text);
            }
            int k = 0;   // 표준 생성기: 보이는 글자만 원문 순서대로 나옴
            foreach (var g in glyphs)
            {
                int ci;
                if (ranged) ci = TypePaint.CharAt(g.textRange.start, typeUnit, typeByteToChar, text.Length);
                else { while (k < text.Length && (char.IsWhiteSpace(text[k]) || text[k] == Ui.WJ)) k++; ci = k++; }
                byte a = dlgType.Alpha(ci);
                if (a == 255) continue;
                var vs = g.vertices;
                for (int i = 0; i < vs.Length; i++) { var v = vs[i]; var c = v.tint; c.a = (byte)(c.a * a / 255); v.tint = c; vs[i] = v; }
            }
        }

        // ---------- 넘기기 누름 보호 ----------
        // 대사 · 카드는 "아무 데나 눌러 넘기기"를 Update 에서 받는데, 버튼 클릭 판정(UI Toolkit)은 그 프레임의 Update · 코루틴이 다 돈 뒤에 처리된다.
        // 그래서 마지막 대사를 넘긴 바로 그 누름이, 같은 프레임에 그 자리에 생긴 선택지 · 계획판 버튼까지 눌렀다 (유물이 저절로 골라짐 · 선택지가 바로 눌림).
        // 넘기기로 쓴 누름 뒤 GuardSec 동안은 화면 버튼이 누름을 받지 않는다. 그 사이 연타는 보호를 조금 늘리지만 넘긴 순간부터 GuardMax 까지만
        // (상한이 없으면 연타로 하는 미니게임 버튼이 영영 안 눌림).
        const float GuardSec = 0.35f, GuardMax = 0.7f;
        float uiGuardUntil, uiGuardFrom;
        /// 보호 중에 시작된 누름들 (포인터별): 그 누름의 뗌 · 클릭까지 같이 삼킴. 보호 전에 시작한 끌기는 건드리지 않음
        readonly HashSet<int> uiSwallowed = new HashSet<int>();
        /// 시계 (테스트에서 바꿔 끼움)
        Func<float> guardNow = () => Time.unscaledTime;

        /// 넘기기로 쓴 누름: 지금부터 GuardSec
        void GuardUi() { float t = guardNow(); uiGuardFrom = t; uiGuardUntil = t + GuardSec; }
        bool GuardOn => guardNow() < uiGuardUntil;
        void GuardExtend() { float t = guardNow(); uiGuardUntil = Mathf.Min(Mathf.Max(uiGuardUntil, t + GuardSec), uiGuardFrom + GuardMax); }

        void BuildGuard()
        {
            // 뿌리에서 내려가는 단계에 걸어 둠 → 어떤 버튼보다 먼저 봄
            root.RegisterCallback<PointerDownEvent>(e =>
            {
                if (GuardOn) { uiSwallowed.Add(e.pointerId); GuardExtend(); e.StopImmediatePropagation(); }
                else uiSwallowed.Remove(e.pointerId);
            }, TrickleDown.TrickleDown);
            root.RegisterCallback<PointerUpEvent>(e => { if (uiSwallowed.Contains(e.pointerId)) e.StopImmediatePropagation(); }, TrickleDown.TrickleDown);
            root.RegisterCallback<ClickEvent>(e => { if (uiSwallowed.Contains(e.pointerId)) e.StopImmediatePropagation(); }, TrickleDown.TrickleDown);
            root.RegisterCallback<MouseDownEvent>(e => { if (uiSwallowed.Contains(PointerId.mousePointerId)) e.StopImmediatePropagation(); }, TrickleDown.TrickleDown);
            root.RegisterCallback<MouseUpEvent>(e => { if (uiSwallowed.Contains(PointerId.mousePointerId)) e.StopImmediatePropagation(); }, TrickleDown.TrickleDown);
        }

        /// "아무 데나 누르면 닫힘" 카드(청산 경보 · 병 카드 · 알바 결과)용: 눌렀으면 그 누름이 뒤 화면 버튼에 닿지 않게 보호까지
        bool AnyPressGuard()
        {
            if (!AnyPress()) return false;
            GuardUi(); return true;
        }
    }
}
