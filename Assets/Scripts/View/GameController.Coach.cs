using System;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // v4 첫 집 화면 튜토리얼 (피드백: 프롤로그 뒤 설명 · 첫 화면 기능/해금/롱숏).
    // 짚을 UI 를 뺀 나머지를 어둡게 덮고(구멍 4장) 금테 + 설명 카드. 클릭/Space = 다음, 건너뛰기, 퀵메뉴 "도움말"로 다시.
    public partial class GameController
    {
        const string CoachPref = "kw.v4.coach", CoachName = "kw-coach";
        VisualElement coach;
        int coachStep;

        // (짚을 UI 이름 · 제목 · 본문). 이름은 RenderSaveControls 의 버튼 name, 또는 "hud"/"mini"/"mirai"/null(가운데)
        static readonly (string target, string title, string body)[] COACH = {
            (null, "목표: 28일 안에 빚 3,000만", "7일마다 밤에 김사장이 이자(3%)를 받으러 와요.\n다 갚으면 엔딩, 28일 만기에 못 갚으면… 원양어선."),
            ("hud", "상태 카드", "빚 · 현금 · 날짜 · 미래 호감.\n호감이 높아야 둘이 같이 웃는 엔딩이에요."),
            ("act-row", "하루 = 오전 · 오후 · 밤 3칸", "행동 하나 고르면 그 칸이 끝나요.\n시계는 멈춰 있으니 천천히 골라도 돼요."),
            ("act-watch", "장 보기 (돈 버는 핵심)", "그 칸 동안 시세가 실시간으로 움직이고 폰으로 사고팔아요.\n주식 주문·리포트는 장 보기 칸에서만, 코인은 언제든."),
            ("mini", "속보 = 이번 칸 시세", "칸이 시작할 때 뉴스가 떠요. 호재면 오르고 악재면 내려요.\n단 30%는 가짜! 출처랑 본문 단서로 가려내기."),
            ("act-phone", "롱 / 숏", "롱 = 오르는 데 걸기, 숏 = 내리는 데 걸기.\n주식은 '곱버스'를 사면 숏. 코인은 롱·숏 둘 다 되고 배율을 올릴수록\n크게 벌지만, 반대로 가면 청산 (넣은 돈 전부 증발)."),
            ("act-date", "미래 (호감)", "놀아 주면 호감 ↑, 하루 종일 안 놀아 주면 ↓.\n아침마다 부탁 하나 → 지키면 ↑ 어기면 ↓."),
            ("act-map", "외출", "알바 = 미니게임으로 느리지만 안전한 돈.\n카지노 · 한강 · 김사장 캐피탈도 여기서."),
            (null, "해금 · 주말", "종목은 장마다 새로 상장돼요 (8 · 15 · 22일).\n6·7일째(주말)는 주식장 휴장 → 금요일에 들고 갈지 정리할지!\n이 설명은 아래 '도움말'로 언제든 다시 볼 수 있어요."),
        };

        /// RenderAll 끝에서: v4 첫 집 화면이면 한 번 띄움
        void CoachMaybe()
        {
            if (coach != null || autoSkipDialog || G == null || !G.v4 || playing || S.pending?.t != "home" || modal.style.display == DisplayStyle.Flex) return;
            int seen = 0;
            try { seen = PlayerPrefs.GetInt(CoachPref, 0); } catch { }
            if (seen == 0) CoachStart();
        }

        void CoachStart()
        {
            CoachClose();
            coachStep = 0;
            // 덮개를 먼저 달아 둠: 아래 RenderAll 이 CoachMaybe 로 또 시작하면 덮개가 하나 더 남아 클릭을 다 먹음 (튜토리얼 끝나도 클릭 안 되던 버그)
            coach = new VisualElement { name = CoachName }; Ui.Fill(coach);
            coach.RegisterCallback<ClickEvent>(_ => CoachNext());
            root.Add(coach);
            if (phoneOpen) { phoneOpen = false; RenderAll(); }
            // 한 프레임 뒤에 (버튼 위치가 잡힌 다음) 그림
            coach.schedule.Execute(CoachDraw);
        }

        void CoachNext() { if (coach == null) { CoachClose(); return; } coachStep++; if (coachStep >= COACH.Length) CoachEnd(); else CoachDraw(); }
        void CoachEnd()
        {
            try { PlayerPrefs.SetInt(CoachPref, 1); PlayerPrefs.Save(); } catch { }
            CoachClose();
        }
        void CoachClose()
        {   // 혹시 남은 덮개까지 전부 걷기
            foreach (var c in root.Children().Where(c => c.name == CoachName).ToList()) c.RemoveFromHierarchy();
            coach = null;
        }

        /// Update 에서: 튜토리얼 중엔 키로 넘기기 (다른 입력은 막힘 — 덮개가 클릭을 먹음)
        bool CoachKeys()
        {
            if (coach == null) return false;
            if (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.RightArrow)) CoachNext();
            else if (Input.GetKeyDown(KeyCode.Escape)) CoachEnd();
            return true;
        }

        VisualElement CoachTarget(string name) => name switch
        {
            null => null,
            "hud" => hudBar,
            "mini" => mini,
            "act-row" => saveControls,
            _ => saveControls.Q(name),
        };

        void CoachDraw()
        {
            if (coach == null) return;
            coach.Clear();
            var (tn, title, body) = COACH[coachStep];
            var tgt = CoachTarget(tn);
            Rect r = default; bool has = false;
            if (tgt != null && tgt.resolvedStyle.display != DisplayStyle.None)
            {
                var wb = tgt.worldBound;
                if (wb.width > 1 && wb.height > 1)
                {
                    var tl = root.WorldToLocal(wb.min); var br = root.WorldToLocal(wb.max);
                    const float pad = 10;
                    r = Rect.MinMaxRect(tl.x - pad, tl.y - pad, br.x + pad, br.y + pad); has = true;
                }
            }
            float W = root.layout.width, H = root.layout.height;
            var dimC = new Color(0, 0, 0, 0.66f);
            VisualElement Dim(float x, float y, float w, float h)
            {
                var d = Ui.Box(dimC); d.style.position = Position.Absolute; d.style.left = x; d.style.top = y; d.style.width = Mathf.Max(0, w); d.style.height = Mathf.Max(0, h);
                coach.Add(d); return d;
            }
            if (has)
            {   // 구멍 뚫린 덮개: 위 · 아래 · 왼 · 오
                Dim(0, 0, W, r.yMin); Dim(0, r.yMax, W, H - r.yMax);
                Dim(0, r.yMin, r.xMin, r.height); Dim(r.xMax, r.yMin, W - r.xMax, r.height);
                var ring = new VisualElement(); ring.pickingMode = PickingMode.Ignore; ring.style.position = Position.Absolute;
                ring.style.left = r.xMin; ring.style.top = r.yMin; ring.style.width = r.width; ring.style.height = r.height;
                Ui.Border(ring, Ui.Gold, 4); Ui.Radius(ring, 14); coach.Add(ring);
                ring.schedule.Execute(() => ring.style.opacity = 0.55f + 0.45f * Mathf.Abs(Mathf.Sin(Time.unscaledTime * 3))).Every(40);
            }
            else Dim(0, 0, W, H);

            var card = Ui.Box(new Color(0.08f, 0.07f, 0.12f, 0.98f), 30, 20); card.style.width = 760; Ui.Border(card, Ui.Gold, 3);
            card.style.position = Position.Absolute;
            var top = Ui.Row(); top.style.justifyContent = Justify.SpaceBetween; top.style.alignItems = Align.Center;
            top.Add(Ui.Label(title, 32, Ui.Gold, true));
            top.Add(Ui.Label($"{coachStep + 1} / {COACH.Length}", 20, Ui.Dim));
            card.Add(top);
            var b = Ui.Label(body, 25, Ui.Text); b.style.whiteSpace = WhiteSpace.Normal; b.style.marginTop = 12; card.Add(b);
            var row = Ui.Row(); row.style.justifyContent = Justify.FlexEnd; row.style.marginTop = 18;
            if (coachStep < COACH.Length - 1)
            {
                var skip = Ui.Chip("건너뛰기 (Esc)", CoachEnd); skip.focusable = false; skip.RegisterCallback<ClickEvent>(e => e.StopPropagation()); row.Add(skip);
            }
            var next = Ui.Chip(coachStep < COACH.Length - 1 ? "다음 ▶ (Space)" : "시작! (Space)", CoachNext, false, Ui.Accent);
            next.focusable = false; next.RegisterCallback<ClickEvent>(e => e.StopPropagation()); next.style.marginLeft = 10; row.Add(next);
            card.Add(row);
            coach.Add(card);

            // 카드 위치: 짚은 곳이 아래쪽이면 그 위에, 위쪽이면 그 아래에, 없으면 가운데
            float cw = 760;
            if (!has) { card.style.left = (W - cw) / 2; card.style.top = H * 0.3f; }
            else
            {
                float cx = Mathf.Clamp(r.center.x - cw / 2, 24, W - cw - 24);
                card.style.left = cx;
                if (r.center.y > H / 2) { card.style.top = StyleKeyword.Auto; card.style.bottom = H - r.yMin + 24; }
                else card.style.top = Mathf.Min(r.yMax + 24, H - 320);
            }
            card.style.opacity = 0;
            card.schedule.Execute(() => card.style.opacity = 1).ExecuteLater(30);
        }
    }
}
