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
        List<(string target, string title, string body)> coachCards = new List<(string, string, string)>();
        string coachDonePref;   // 다 보거나 건너뛰면 1 로 적을 PlayerPrefs 키 (도움말 다시 보기는 null = 안 적음)
        bool coachIntro;        // 첫 3장 (마지막 버튼 "시작!")
        readonly List<string> coachQueue = new List<string>();   // 막혀서 못 띄운 상황 카드 id (다음 RenderAll 끝에)

        // (짚을 UI 이름 · 제목 · 본문). 이름은 RenderSaveControls 의 버튼 name, 또는 "hud"/"mini"/"mirai"/null(가운데)
        // 첫 집 화면: 3장만. 나머지는 처음 마주칠 때 한 장씩 (COACH_CTX)
        static readonly (string target, string title, string body)[] COACH_INTRO = {
            (null, "목표: 28일 안에 빚 3,000만", "7일마다 밤에 김사장이 이자({rate}%)와 원금 분납을 받으러 와요. 두 번 연속 못 내면 원양어선.\n다 갚으면 엔딩, 28일이 만기."),
            ("hud", "상태 카드", "빚 · 현금 · 날짜 · 미래 호감.\n호감이 높아야 둘이 같이 웃는 엔딩이에요."),
            ("act-row", "하루 = 오전 · 오후 · 밤 3칸", "행동 하나 고르면 그 칸이 끝나요. 시계는 멈춰 있으니 천천히.\n낮(오전·오후)은 장 · 알바, 밤은 미래 · 생활 시간 —\n밤에 놀아 주면 호감이 더 오르고, 야간 알바는 덜 벌려요.\n돈 버는 핵심은 '장 보기': 그 칸 동안 시세가 움직이고 폰(P)으로 사고팔아요."),
        };
        static readonly string[] CTX_ORDER = { "watch", "news", "coin", "mirai", "map", "unlock" };
        static readonly Dictionary<string, (string target, string title, string body)> COACH_CTX = new Dictionary<string, (string, string, string)>
        {
            ["watch"] = ("act-watch", "장 보기 (돈 버는 핵심)", "그 칸 동안 시세가 실시간으로 움직이고 폰으로 사고팔아요.\n주식 주문·리포트는 장 보기 칸에서만, 코인은 언제든.\n리포트는 분석가마다 실력이 달라요 — 전적을 보세요. 빗나가면 시세가 반대로 가고, 결과는 기한 안 어느 순간에 발표돼요."),
            ["news"] = ("mini", "속보 = 이번 칸 시세", "칸이 시작할 때 뉴스가 떠요. 호재면 오르고 악재면 내려요.\n단 30%는 가짜! 출처랑 본문 단서로 가려내기."),
            ["coin"] = ("act-phone", "롱 / 숏 · 증거금 상한", "롱 = 오르는 데 걸기, 숏 = 내리는 데 걸기. 배율은 처음부터 자유지만 증거금 합계에 상한이 있어요 (주문 바에 '상한 중 얼마 남음'으로 표시).\n반대로 가면 청산 = 넣은 돈 증발.\n상한은 주차마다 올라요. 숏은 2주차부터 저절로, 대출은 첫 주 납부를 통과하면 열려요.\n장 보기 칸에선 예약 손절·익절도 걸 수 있어요."),
            ["mirai"] = ("act-date", "미래 (호감)", "놀아 주면 호감 ↑, 하루 종일 안 놀아 주면 ↓.\n아침마다 부탁 하나 → 지키면 ↑ 어기면 ↓."),
            ["map"] = ("act-map", "외출", "알바 = 미니게임으로 느리지만 안전한 돈.\n단 알바 중에도 시세는 흘러요. 구석에 내 포지션 손익이 보이고, 몰래 폰 보기로 골라서 정리할 수 있어요 — 정리할 때마다 일당이 깎이고 들킬 수도 (상하차는 폰을 못 봐요).\n카지노 · 한강 · 김사장 캐피탈도 여기서."),
            ["unlock"] = (null, "해금 · 주말", "종목은 장마다 새로 상장돼요 (8 · 15 · 22일).\n6·7일째(주말)는 주식장 휴장 → 금요일에 들고 갈지 정리할지!\n이 설명은 아래 '도움말'로 언제든 다시 볼 수 있어요."),
        };

        static bool CoachSeen(string pref) { try { return PlayerPrefs.GetInt(pref, 0) != 0; } catch { return false; } }

        bool CoachBlocked() => coach != null || autoSkipDialog || ShotMode.On || G == null || !G.v4 || playing || mg != null || settingsEl != null || modal.style.display == DisplayStyle.Flex;

        /// RenderAll 끝에서: v4 첫 집 화면이면 3장, 아니면 밀려 있던 상황 카드 한 장
        void CoachMaybe()
        {
            if (CoachBlocked()) return;
            if (S.pending?.t == "home" && !CoachSeen(CoachPref)) { CoachOpen(COACH_INTRO.ToList(), CoachPref, true, true); return; }
            if (!CoachSeen(CoachPref)) return;   // 첫 3장 전엔 상황 카드도 기다림
            while (coachQueue.Count > 0)
            {
                string id = coachQueue[0]; coachQueue.RemoveAt(0);
                string pref = CoachPref + "." + id;
                if (CoachSeen(pref) || !COACH_CTX.TryGetValue(id, out var c)) continue;
                if (id == "watch" && S.pending?.t == "watch") c.target = null;   // 장 보기 화면에선 버튼이 없으니 가운데
                CoachOpen(new List<(string, string, string)> { c }, pref, false, false);
                return;
            }
        }

        /// 상황 카드: 처음 마주칠 때 한 번 (kw.v4.coach.&lt;id&gt;). 지금 못 띄우면 줄 세워 두고 다음 RenderAll 끝에
        void CoachCtx(string id)
        {
            if (autoSkipDialog || ShotMode.On || G == null || !G.v4 || coachQueue.Contains(id) || CoachSeen(CoachPref + "." + id)) return;
            coachQueue.Add(id);
            root.schedule.Execute(CoachMaybe);   // 그리는 도중이면 한 프레임 뒤에
        }

        /// 퀵메뉴 "도움말": 9장 전부 (기록은 안 바꿈)
        void CoachStart()
        {
            var all = COACH_INTRO.ToList();
            foreach (var id in CTX_ORDER) all.Add(COACH_CTX[id]);
            CoachOpen(all, null, true, false);
        }

        void CoachOpen(List<(string target, string title, string body)> cards, string donePref, bool closePhone, bool intro)
        {
            CoachClose();
            coachCards = cards; coachDonePref = donePref; coachIntro = intro;
            coachStep = 0;
            // 덮개를 먼저 달아 둠: 아래 RenderAll 이 CoachMaybe 로 또 시작하면 덮개가 하나 더 남아 클릭을 다 먹음 (튜토리얼 끝나도 클릭 안 되던 버그)
            coach = new VisualElement { name = CoachName }; Ui.Fill(coach);
            coach.RegisterCallback<ClickEvent>(_ => CoachNext());
            root.Add(coach);
            if (closePhone && phoneOpen) { phoneOpen = false; RenderAll(); }
            // 한 프레임 뒤에 (버튼 위치가 잡힌 다음) 그림
            coach.schedule.Execute(CoachDraw);
        }

        void CoachNext() { if (coach == null) { CoachClose(); return; } coachStep++; if (coachStep >= coachCards.Count) CoachEnd(); else CoachDraw(); }
        void CoachEnd()
        {
            if (coachDonePref != null) try { PlayerPrefs.SetInt(coachDonePref, 1); PlayerPrefs.Save(); } catch { }
            CoachClose();
            if (coachQueue.Count > 0) root.schedule.Execute(CoachMaybe);   // 밀린 상황 카드
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
            var (tn, title, body) = coachCards[coachStep];
            body = body.Replace("{rate}", (G.rate() * 100).ToString("0.#"));   // 난이도별 이자
            bool last = coachStep >= coachCards.Count - 1;
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
            top.Add(Ui.Label($"{coachStep + 1} / {coachCards.Count}", 20, Ui.Dim));
            card.Add(top);
            var b = Ui.Label(body, 25, Ui.Text); b.style.whiteSpace = WhiteSpace.Normal; b.style.marginTop = 12; card.Add(b);
            var row = Ui.Row(); row.style.justifyContent = Justify.FlexEnd; row.style.marginTop = 18;
            if (!last)
            {
                var skip = Ui.Chip("건너뛰기 (Esc)", CoachEnd); skip.focusable = false; skip.RegisterCallback<ClickEvent>(e => e.StopPropagation()); row.Add(skip);
            }
            var next = Ui.Chip(!last ? "다음 ▶ (Space)" : coachCards.Count == 1 ? "알겠어요 (Space)" : coachIntro ? "시작! (Space)" : "닫기 (Space)", CoachNext, false, Ui.Accent);
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
