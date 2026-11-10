using System;
using System.Collections.Generic;
using System.Linq;
using KwGame.Sim;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // v4 집 = 하루 계획판 (docs/UI_V2.md "집"): 왼쪽 미래 + 말풍선, 오른쪽 "오늘" 판(오전 · 오후 · 밤), 판 아래 작은 줄.
    // 누를 곳은 판 한 곳 — 지도 화면 없이 quick 명령으로 바로 알바 설명 카드 · 장소 화면.
    public partial class GameController
    {
        /// 1080p 기준 자리: 판 = 오른쪽 40 띄우고 폭 1060 (x 820~1880), 띠 아래 40 부터 · 작은 줄 = 판 아래 (바닥 24, 높이 64) · 미래 = 왼쪽 140 (폭 약 616 → 판과 안 겹침)
        const float PlanW = 1060, PlanRight = 40, PlanTopGap = 40, PlanFootH = 64, PlanFootBottom = 24, PlanMiraiX = 140, PlanBubbleX = 340, PlanBubbleW = 440;
        static readonly string[] SLOT3 = { "오전", "오후", "밤" };
        VisualElement planEl, planBody, planFoot, planBubble, planCur;
        Label planBubbleText;
        ScrollView planSv;

        bool PlanHome => G != null && G.v4 && S.pending?.t == "home";

        void BuildPlan()
        {
            planEl = GlassBox(24, 18); Ui.Abs(planEl, null, StripH + PlanTopGap, PlanRight); planEl.style.width = PlanW;
            planSv = new ScrollView(ScrollViewMode.Vertical); planSv.style.flexShrink = 1; planSv.contentViewport.style.overflow = Overflow.Hidden;
            planBody = planSv.contentContainer; planEl.Add(planSv);
            planEl.style.display = DisplayStyle.None;
            stage.Add(planEl);

            planFoot = GlassBox(10, 14); Ui.Abs(planFoot, null, null, PlanRight, PlanFootBottom); planFoot.style.width = PlanW; planFoot.style.height = PlanFootH;
            planFoot.style.flexDirection = FlexDirection.Row; planFoot.style.alignItems = Align.Center; planFoot.style.paddingLeft = 14; planFoot.style.paddingRight = 14;
            planFoot.style.display = DisplayStyle.None;
            stage.Add(planFoot);

            // 말풍선: 예전 대사창의 "평소 한마디" (흰 바탕 · 어두운 글자)
            planBubble = Ui.Box(new Color(1, 1, 1, 0.96f), 16, 18); Ui.Abs(planBubble, PlanBubbleX, StripH + 20); planBubble.style.maxWidth = PlanBubbleW; planBubble.pickingMode = PickingMode.Ignore;
            planBubbleText = Ui.Label("", 22, Ui.Ink); planBubbleText.style.whiteSpace = WhiteSpace.Normal; planBubbleText.pickingMode = PickingMode.Ignore; planBubble.Add(planBubbleText);
            planBubble.style.display = DisplayStyle.None;
            stage.Add(planBubble);
        }

        /// 화면 크기에 맞춰 판 폭 · 최대 높이 (넘치면 판 안에서 스크롤). 좁은 화면(4:3)에선 왼쪽 미래 · 말풍선(x ~780)과 안 겹치게 판을 줄임
        void PlanLayout(float W, float H)
        {
            if (planEl == null) return;
            float pw = Mathf.Clamp(W - PlanRight - (PlanBubbleX + PlanBubbleW + 20), 640, PlanW);
            planEl.style.width = pw; planFoot.style.width = pw;
            float mx = Mathf.Max(300, H - (StripH + PlanTopGap) - (PlanFootBottom + PlanFootH + 16));
            planEl.style.maxHeight = mx; planSv.style.maxHeight = mx - 48;
        }

        /// 대사창 · 계획판 · 말풍선 보이기. v4 집 · 데스크에선 대사가 실제로 나오는 동안만 대사창, 집에선 그 동안 판 · 말풍선을 숨김
        void DlgSync()
        {
            if (dlg == null || dlgText == null) return;
            var P = G != null ? S.pending : null;
            bool mgFull = P?.t == "work" && P.setup != null;
            bool talking = dlgText.style.display == DisplayStyle.Flex;
            bool quiet = G != null && G.v4 && (P?.t == "home" || DeskActive);
            bool settle = settleEl != null;   // 정산 한 장 동안은 판 · 대사창 · 말풍선 다 숨김 (GameController.Screens.cs SettleCard)
            dlg.style.display = !settle && (talking || (!mgFull && !quiet)) ? DisplayStyle.Flex : DisplayStyle.None;
            if (planEl == null) return;
            bool board = PlanHome && !mgFull && !talking && !settle;
            planEl.style.display = board ? DisplayStyle.Flex : DisplayStyle.None;
            planFoot.style.display = board ? DisplayStyle.Flex : DisplayStyle.None;
            planBubble.style.display = board && !string.IsNullOrEmpty(planBubbleText.text) ? DisplayStyle.Flex : DisplayStyle.None;
            planEl.SetEnabled(!playing);   // 재생 중엔 판은 그대로 두되 안 눌리게
        }

        static string Hm(int m) => m >= 1440 ? "24:00" : GameSim.clockOf(m);
        string SlotName(int s) => SLOT3[Math.Max(0, Math.Min(s, SLOT3.Length - 1))];
        string SlotRange(int s) => $"{Hm(G.slotStartMin(s))} ~ {Hm(G.slotEndMin(s))}";

        /// 끝난 칸에 한 일 (G.slotActOf: "watch" · "date" · "rest" · "work:cafe" · "out:park" · null)
        string SlotActName(string act, int s)
        {
            if (string.IsNullOrEmpty(act)) return "기록 없음";
            if (act == "watch") return "장 보기";
            if (act == "date") return "미래랑 놀기";
            if (act == "rest") return s >= SLOT3.Length - 1 ? "자기" : "쉬기";
            if (act.StartsWith("work:")) return D.JOBS.TryGetValue(act.Substring(5), out var J) ? J.name : "알바";
            if (act.StartsWith("out:")) return D.LOCS.TryGetValue(act.Substring(4), out var L) ? L.name : "외출";
            return act;
        }

        /// 남은 칸의 성격 한 줄 (숫자는 rules: 장 시간 RT_STOCK · 밤 놀기 V4_DATE_EVE · 야간 알바 V4_WORK_EVE · 낮 놀기 V4_DATE_DAY)
        string SlotTrait(int s)
        {
            var R = D.RULES;
            if (G.weekend()) return "주말 · 국장 휴장 (코인만)";
            var parts = new List<string>();
            if (s >= R.SLOTS - 1)
            {
                parts.Add($"미래 시간 · 호감 ×{R.V4_DATE_EVE:0.##}");
                if (R.V4_WORK_EVE < 1) parts.Add($"야간 알바 일당 ×{R.V4_WORK_EVE:0.##}");
            }
            else
            {
                int a = Math.Max(G.slotStartMin(s), R.RT_STOCK[0]), b = Math.Min(G.slotEndMin(s), R.RT_STOCK[1]);
                parts.Add(a < b ? $"장중 {Hm(b)} 까지" : "장 마감 · 코인만");
                if (R.V4_DATE_DAY != 1) parts.Add($"놀기 호감 ×{R.V4_DATE_DAY:0.##}");
            }
            return string.Join(" · ", parts);
        }

        /// 계획판 다시 그리기 (RenderPanel 의 home, Play 시작). 행동 카드는 panelActs 순서 = 숫자 키
        void RenderPlan()
        {
            if (planEl == null || !PlanHome) return;
            planBody.Clear(); panelActs.Clear(); planCur = null;
            var R = D.RULES;
            int cur = Math.Max(0, Math.Min(S.slot, R.SLOTS - 1));
            bool wkd = G.weekend();
            var head = Ui.Row(); head.style.alignItems = Align.FlexEnd; planBody.Add(head);
            head.Add(Ui.Label("오늘", 30, Ui.Gold, true));
            var hs = Ui.Label("행동 하나 = 한 칸 · " + (wkd ? "주말엔 국장 휴장" : $"장은 {Hm(R.RT_STOCK[0])}~{Hm(R.RT_STOCK[1])}"), 20, Ui.Dim); hs.style.marginLeft = 20; head.Add(hs);
            // 칸을 시간 순서로: 지금 칸은 크게, 나머지는 작은 카드 줄
            VisualElement row = null;
            for (int s = 0; s < R.SLOTS; s++)
            {
                if (s == cur) { row = null; planBody.Add(PlanNow(s)); continue; }
                if (row == null) { row = Ui.Row(); row.style.alignItems = Align.Stretch; row.style.marginTop = 12; planBody.Add(row); }
                var c = PlanSlot(s, s < cur);
                if (row.childCount > 0) c.style.marginLeft = 12;
                row.Add(c);
            }
            PlanChips();
            PlanYesterday();
            NoShrink(planBody);
            RenderPlanFoot();
            if (S.slot >= 1) CoachCtx("map");   // 판을 한 번 써 본 뒤 → 알바 · 외출 설명 카드
        }

        /// 지금 칸 (분홍 테두리): 장 보기 · 미래랑 놀기 · 알바 가기(종류가 카드 안에 바로)
        VisualElement PlanNow(int s)
        {
            var R = D.RULES;
            bool eve = G.isEve(), wkd = G.weekend();
            var box = Ui.Box(new Color(1f, 0.42f, 0.62f, 0.07f), 18, 16); Ui.Border(box, Ui.Accent, 3); box.style.marginTop = 14; box.name = "plan-now";
            planCur = box;
            var hr = Ui.Row(); box.Add(hr);
            hr.Add(Ui.Label($"{SlotName(s)} · 지금", 26, Ui.Accent, true));
            var tl = Ui.Label(SlotRange(s), 20, Ui.Dim); tl.style.marginLeft = 16; hr.Add(tl);

            var ar = Ui.Row(); ar.style.alignItems = Align.Stretch; ar.style.marginTop = 12; box.Add(ar);
            Button Act(string title, string sub, string extra, Action a)
            {
                var b = Ui.Button(title, a, sub, false, Ui.Panel2, 26);
                b.style.flexGrow = 1; b.style.flexBasis = 0; b.style.marginBottom = 0;
                if (extra != null) { var x = Ui.Label(extra, 20, Ui.Gold); x.style.marginTop = 6; x.pickingMode = PickingMode.Ignore; b.Add(x); }
                KeyBadge(b, a, false);
                ar.Add(b); return b;
            }
            // 부제는 예전 퀵메뉴와 같은 글 (시간대 비중: 낮 = 장 · 알바, 밤 = 미래 · 생활)
            string wh = wkd ? "주말 휴장 · 코인만" : eve ? "밤 · 코인만" : "시세 보며 실시간 매매";
            Act("장 보기", wh, null, () => Send("watch")).name = "act-watch";
            double dm = G.dateMult(), da = (S.dateN == 0 ? R.V4_DATE_AFF : 2) * dm;
            string dmT = dm > 1 ? " · 밤 보너스" : dm < 1 ? " · 낮엔 반만" : "";
            var pm = G.promNow();
            var bd = Act("미래랑 놀기", (S.dateN == 0 ? $"호감 +{da:0.#} · 스트레스 풀림" : $"오늘 또? 호감 +{da:0.#}") + dmT, pm != null ? "부탁: " + pm.hud : null, () => Send("date"));
            bd.name = "act-date"; bd.style.marginLeft = 12;

            // 알바 가기: 장소 화면이 보여 주던 글 그대로 (locOpts("work"): 일당 · 폰 보기 쉬움/눈치/못 봄). 누르면 quick → 알바 설명 카드
            var wb = Ui.Box(new Color(1, 1, 1, 0.04f), 14, 12); Ui.Border(wb, new Color(1, 1, 1, 0.12f), 1); wb.style.marginTop = 12; wb.name = "act-map"; box.Add(wb);
            var wr = Ui.Row(); wb.Add(wr);
            wr.Add(Ui.Label("알바 가기", 26, Ui.Text, true));
            var wsp = new VisualElement(); wsp.style.flexGrow = 1; wr.Add(wsp);
            string wn = (eve && !wkd && R.V4_WORK_EVE < 1 ? $"야간 알바는 일당 ×{R.V4_WORK_EVE:0.##} · " : "") + "누르면 설명 카드 · 포지션은 들고 감";
            var wl = Ui.Label(wn, 18, Ui.Dim); wl.style.flexShrink = 1; wr.Add(wl);
            bool wOpen = D.LOCS.TryGetValue("work", out var WL) && WL.open.Contains(S.slot) && !G.locHidden("work") && (!WL.rt || S.rt);
            var grid = Ui.Row(); grid.style.flexWrap = Wrap.Wrap; grid.style.alignItems = Align.Stretch; grid.style.marginTop = 8; wb.Add(grid);
            foreach (var o in G.Query(() => G.locOpts("work")))
            {
                string k = o.k; bool dis = o.dis || !wOpen;
                Action a = () => Send("quick", "loc", "work", "k", k);
                var b = Ui.Button(o.l, a, o.sub, dis, null, 22);
                b.style.width = Length.Percent(49); b.style.marginBottom = 8;
                if (grid.childCount % 2 == 1) b.style.marginLeft = Length.Percent(2);
                KeyBadge(b, a, dis);
                grid.Add(b);
            }
            if (!wOpen) { var cl = Ui.Label("지금 칸엔 알바 자리가 닫혀 있어요", 20, Ui.Dim); cl.style.marginTop = 4; wb.Add(cl); }
            return box;
        }

        /// 끝난 칸 = 한 일 + 그 칸 손익 (이익 빨강 · 손실 파랑 · 0 회색) · 남은 칸 = 그 칸의 성격 한 줄
        VisualElement PlanSlot(int s, bool done)
        {
            var c = Ui.Box(new Color(1, 1, 1, 0.04f), 14, 12); Ui.Border(c, new Color(1, 1, 1, 0.12f), 1); c.style.flexGrow = 1; c.style.flexBasis = 0;
            var hr = Ui.Row(); c.Add(hr);
            hr.Add(Ui.Label(SlotName(s), 22, done ? Ui.Dim : Ui.Text, true));
            var tl = Ui.Label(SlotRange(s), 18, Ui.Dim); tl.style.marginLeft = 10; hr.Add(tl);
            if (done)
            {
                string act = G.slotActOf(s); double net = G.slotNetOf(s);
                var r = Ui.Row(); r.style.marginTop = 6; r.style.justifyContent = Justify.SpaceBetween; c.Add(r);
                var al = Ui.Label(SlotActName(act, s), 22, act == null ? Ui.Dim : Ui.Text); al.style.flexShrink = 1; r.Add(al);
                if (act != null) r.Add(Ui.Label(G.sgnMan(net), 22, UpDn(net), true));
            }
            else
            {
                var t = Ui.Label(SlotTrait(s), 20, Ui.Dim); t.style.marginTop = 6; c.Add(t);
            }
            return c;
        }

        /// 칩 줄: 쉬기/자기 · 빚 갚기 · 대출 · 알바가 아닌 보이는 장소마다 하나 (지도 화면과 같은 조건, 닫힌 칸이면 잠김 + 이유)
        void PlanChips()
        {
            bool eve = G.isEve();
            var cr = Ui.Row(); cr.style.flexWrap = Wrap.Wrap; cr.style.marginTop = 14; cr.name = "plan-chips"; planBody.Add(cr);
            Button C(string text, Action a, bool dis = false, Color? bg = null)
            {
                var b = Ui.Chip(text, a, dis, bg ?? new Color(1, 1, 1, 0.06f)); b.style.marginBottom = 8; b.style.flexShrink = 0; b.Q<Label>().style.whiteSpace = WhiteSpace.NoWrap;
                cr.Add(b); return b;
            }
            string rh = G.restHint();
            C((eve ? "자기" : "쉬기") + (string.IsNullOrEmpty(rh) ? "" : " · " + rh), () => Send("rest"));
            bool canPay = S.cash >= 10000 && S.debt > 0;
            C($"빚 갚기 ({G.man(S.debt)})", () => Send("repayOpen"), !canPay, canPay ? new Color(0.16f, 0.36f, 0.24f, 1f) : (Color?)null);
            foreach (var L in D.LOCList.Where(L => (!L.rt || S.rt) && !G.locHidden(L.id) && L.id != "work"))
            {
                bool open = L.open.Contains(S.slot); string id = L.id;
                C(open ? L.name : $"{L.name} ({string.Join("·", L.open.Select(x => SlotName(x)))}만)", () => Send("quick", "loc", id), !open);
            }
            // 잠긴 대출도 누르면 김사장 창에서 이유를 자세히 (예전 퀵메뉴와 같음)
            C(G.loanOk() ? "대출" : $"대출 ({(G.gateOn ? "첫 납부 뒤" : "잠김")})", () => Send("loanOpen"), false, G.loanOk() ? (Color?)null : new Color(1, 1, 1, 0.03f));
        }

        /// 칩 줄 아래 "어제: 오전 카페 알바 +9만원 · 오후 장 보기 −12만원 · 밤 미래랑 놀기 · 합계 −3만원" (손익 0 은 숫자 생략). 어제 기록이 없으면 안 그림
        void PlanYesterday()
        {
            if (!G.slotYHas()) return;
            var parts = new List<(string t, Color c, bool b)>();
            double sum = 0;
            for (int s = 0; s < D.RULES.SLOTS; s++)
            {
                string act = G.slotActYOf(s); double net = G.slotNetYOf(s); sum += net;
                if (act == null && Math.Abs(net) < 1) continue;
                if (parts.Count > 0) parts.Add(("·", Ui.Dim, false));
                parts.Add(($"{SlotName(s)} {SlotActName(act, s)}", Ui.Text, false));
                if (Math.Abs(net) >= 1) parts.Add((G.sgnMan(net), UpDn(net), true));
            }
            if (parts.Count == 0) return;
            if (Math.Abs(sum) >= 1) { parts.Add(("· 합계", Ui.Dim, false)); parts.Add((G.sgnMan(sum), UpDn(sum), true)); }
            var yr = Ui.Row(); yr.style.flexWrap = Wrap.Wrap; yr.style.alignItems = Align.Center; yr.style.marginTop = 6; yr.name = "plan-yesterday"; yr.pickingMode = PickingMode.Ignore;
            planBody.Add(yr);
            var hl = Ui.Label("어제:", 20, Ui.Dim, true); hl.pickingMode = PickingMode.Ignore; yr.Add(hl);
            foreach (var (t, c, b) in parts) { var l = Ui.Label(t, 20, c, b); l.style.whiteSpace = WhiteSpace.NoWrap; l.style.marginLeft = 8; l.pickingMode = PickingMode.Ignore; yr.Add(l); }
        }

        /// 판 아래 작은 줄: P 폰(안 읽은 카톡) · 유물(= 상태 카드) · 저장 상태 · 도움말 · 설정 · 저장 · 타이틀
        void RenderPlanFoot()
        {
            if (planFoot == null || G == null) return;
            planFoot.Clear();
            Button F(string text, Action a, bool dis = false, Color? bg = null)
            {
                var b = Ui.Chip(text, a, dis, bg ?? new Color(1, 1, 1, 0.06f)); b.style.marginBottom = 0; b.style.flexShrink = 0; b.Q<Label>().style.whiteSpace = WhiteSpace.NoWrap;
                planFoot.Add(b); return b;
            }
            int un = G.kUnread();
            F(phoneOpen ? "P 폰 닫기" : un > 0 ? $"P 폰 · 카톡 {un}" : "P 폰", TogglePhone, false, phoneOpen || un > 0 ? Ui.Accent : (Color?)null).name = "act-phone";
            F($"유물 {S.augs.Count}", OpenStatusCard);
            var sp = new VisualElement(); sp.style.flexGrow = 1; planFoot.Add(sp);
            var st = Ui.Label(saveMessage, 18, Ui.Dim); st.name = "saveStatus"; st.style.marginRight = 10; st.style.whiteSpace = WhiteSpace.NoWrap; st.style.flexShrink = 1; st.style.overflow = Overflow.Hidden; planFoot.Add(st);
            F("도움말", CoachStart, playing);
            F("설정", OpenSettings, playing).name = "settingsButton";
            F("저장", () => SaveCheckpoint(true), !CanSave).name = "saveGameButton";
            F("타이틀", ReturnToTitle, playing).name = "returnToTitleButton";
        }
    }
}
