using System;
using System.Collections.Generic;
using System.Linq;
using KwGame.Sim;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // 장 보기 — 트레이딩 데스크 (docs/UI_V2.md): 방 화면을 덮는 전용 화면. 맨 위 상태 띠(StripH) 아래 전부를 씀.
    // 왼쪽 종목 목록 · 가운데 큰 차트(봉 + 거래량) · 오른쪽 분석가 → 주문 → 내 포지션 · 아래 왼쪽 소식 띠 · 아래 오른쪽 미래 작은 창.
    // 누를 곳은 오른쪽 한 곳 (목록은 고르기만). 주문 명령 · 실패 이유 · 두 번 누르기는 폰 증권 앱(GameController.Chart.cs)의 것을 그대로 씀.
    public partial class GameController
    {
        // 1920×1080 기준: 띠 아래 1000 = 위칸 796 + 아래칸 170 (+ 여백). 가운데 차트 칸 폭 = 1920 − 24 − 380 − 470 − 20 = 1026
        const float DeskPad = 12, DeskGap = 10, DeskListW = 380, DeskRightW = 470, DeskBottomH = 170;
        /// 큰 주문 (두 번 누르기) 문턱 — OrderBar 의 위험 주문 문턱(증거금 100만)과 같은 값
        const double DeskBig = 1e6;
        const float DeskSayHold = 5f, DeskBlinkSec = 8f;
        static readonly Color DeskBg = new Color32(0x0a, 0x0c, 0x12, 0xff);
        static readonly Color DeskGall = new Color32(0x9a, 0xa6, 0xff, 0xff);   // 주갤 꼬리표 (디시 파랑을 어두운 바탕에서 읽히게 밝힘)

        VisualElement deskEl, deskList, deskCenter, deskHead, deskChartHost, deskAn, deskOrder, deskPos, deskPosHead, deskFeedBox, deskMirai, deskFace;
        ScrollView deskListSv, deskPosSv;
        Label deskBubble;
        /// 큰 차트는 다시 그릴 때도 같은 요소를 씀 (0.3초마다 새로 만들면 축 글자 깜빡임 · 십자선 끊김)
        CandleChart deskChart; string deskChartKey; List<Candle> deskChartHist;

        /// 소식 띠 한 줄: 꼬리표 · 색 · 글 · 시각
        class DeskLine { public string tag, text, time; public Color c; }
        readonly List<DeskLine> deskFeed = new List<DeskLine>();
        GameSim deskFeedFor; int deskFeedVer, deskFeedAnimVer; string deskFeedSig;
        /// 전조가 뜬 종목 → 목록 줄이 깜빡이는 끝 시각
        readonly Dictionary<string, float> deskBlink = new Dictionary<string, float>();
        string deskSay, deskFaceShown; float deskSayUntil;

        bool DeskActive => G != null && G.v4 && S.pending?.t == "watch";

        // ---------- 뼈대 (한 번) ----------
        void BuildDesk()
        {
            deskEl = new VisualElement { name = "desk" };
            Ui.Abs(deskEl, 0, StripH, 0, 0);
            deskEl.style.backgroundColor = DeskBg;   // 불투명: 방 화면이 비치지 않게
            Ui.Pad(deskEl, DeskPad);
            deskEl.style.flexDirection = FlexDirection.Column;
            deskEl.style.display = DisplayStyle.None;
            stage.Add(deskEl);

            var top = new VisualElement(); top.style.flexDirection = FlexDirection.Row; top.style.alignItems = Align.Stretch;
            top.style.flexGrow = 1; top.style.flexShrink = 1; top.style.minHeight = 0; deskEl.Add(top);

            // 왼쪽: 종목 목록
            deskList = DeskPanel(); deskList.style.width = DeskListW; deskList.style.flexShrink = 0; deskList.style.marginRight = DeskGap; top.Add(deskList);
            var lh = Ui.Label("종목 · 등락 · 주갤 온도", 18, StkAxis); lh.style.marginBottom = 8; lh.style.flexShrink = 0; deskList.Add(lh);
            deskListSv = DeskScroll(); deskList.Add(deskListSv);

            // 가운데: 머리(이름 · 가격 · 범위) + 큰 차트
            deskCenter = DeskPanel(); deskCenter.style.flexGrow = 1; deskCenter.style.flexShrink = 1; deskCenter.style.minWidth = 0; deskCenter.style.marginRight = DeskGap; top.Add(deskCenter);
            deskHead = new VisualElement(); deskHead.style.flexShrink = 0; deskCenter.Add(deskHead);
            deskChartHost = new VisualElement(); deskChartHost.style.flexGrow = 1; deskChartHost.style.flexShrink = 1; deskChartHost.style.minHeight = 0; deskChartHost.style.marginTop = 8; deskCenter.Add(deskChartHost);

            // 오른쪽: 분석가 → 주문 → 내 포지션 (포지션이 많으면 스크롤)
            var right = new VisualElement(); right.style.width = DeskRightW; right.style.flexShrink = 0; right.style.flexDirection = FlexDirection.Column; top.Add(right);
            deskAn = DeskPanel(); deskAn.style.flexShrink = 0; deskAn.style.marginBottom = DeskGap; deskAn.style.paddingBottom = 8; right.Add(deskAn);
            deskOrder = new VisualElement(); deskOrder.style.flexShrink = 0; deskOrder.style.marginBottom = DeskGap; Ui.Radius(deskOrder, 12); deskOrder.style.overflow = Overflow.Hidden; right.Add(deskOrder);
            deskPos = DeskPanel(); deskPos.style.flexGrow = 1; deskPos.style.flexShrink = 1; deskPos.style.minHeight = 0; right.Add(deskPos);
            deskPosHead = Ui.Row(); deskPosHead.style.flexShrink = 0; deskPosHead.style.marginBottom = 6; deskPos.Add(deskPosHead);
            deskPosSv = DeskScroll(); deskPos.Add(deskPosSv);

            // 아래: 소식 띠 + 미래 작은 창
            var bot = new VisualElement(); bot.style.flexDirection = FlexDirection.Row; bot.style.alignItems = Align.Stretch;
            bot.style.height = DeskBottomH; bot.style.flexShrink = 0; bot.style.marginTop = DeskGap; deskEl.Add(bot);
            deskFeedBox = DeskPanel(); deskFeedBox.style.flexGrow = 1; deskFeedBox.style.flexShrink = 1; deskFeedBox.style.minWidth = 0; deskFeedBox.style.marginRight = DeskGap; deskFeedBox.style.overflow = Overflow.Hidden; bot.Add(deskFeedBox);
            deskMirai = DeskPanel(); deskMirai.style.width = DeskRightW; deskMirai.style.flexShrink = 0; deskMirai.style.flexDirection = FlexDirection.Row; deskMirai.style.alignItems = Align.Center; deskMirai.style.overflow = Overflow.Hidden; bot.Add(deskMirai);
            deskFace = new VisualElement(); deskFace.style.width = 150; deskFace.style.height = 146; deskFace.style.flexShrink = 0; Ui.Radius(deskFace, 10);
            deskFace.style.backgroundColor = new Color(1, 1, 1, 0.05f);
            deskFace.style.backgroundSize = new BackgroundSize(BackgroundSizeType.Cover);
            deskFace.style.backgroundPositionY = new BackgroundPosition(BackgroundPositionKeyword.Top);
            deskFace.pickingMode = PickingMode.Ignore; deskMirai.Add(deskFace);
            deskBubble = Ui.Label("", 20, Ui.Ink); deskBubble.style.backgroundColor = Color.white; Ui.Radius(deskBubble, 14);
            deskBubble.style.paddingLeft = 14; deskBubble.style.paddingRight = 14; deskBubble.style.paddingTop = 10; deskBubble.style.paddingBottom = 10;
            deskBubble.style.marginLeft = 12; deskBubble.style.flexGrow = 1; deskBubble.style.flexShrink = 1; deskBubble.pickingMode = PickingMode.Ignore; deskMirai.Add(deskBubble);

            deskEl.schedule.Execute(DeskMiraiSync).Every(250);   // 표정이 평소로 돌아오고 말풍선이 끝나는 걸 다시 그리기 없이 반영
        }

        static VisualElement DeskPanel()
        {
            var p = Ui.Box(StkCard, 12, 12); Ui.Border(p, StkLine, 1);
            return p;
        }
        static ScrollView DeskScroll()
        {
            var sv = new ScrollView(ScrollViewMode.Vertical); sv.style.flexGrow = 1; sv.style.flexShrink = 1; sv.style.minHeight = 0;
            sv.contentViewport.style.overflow = Overflow.Hidden;   // 테마 USS 가 없어서 직접 잘라야 함
            MoreHint(sv);
            return sv;
        }

        /// 도움말 카드가 짚을 곳
        VisualElement DeskPart(string name)
        {
            switch (name)
            {
                case "list": return deskList;
                case "chart": return deskCenter;
                case "order": return deskOrder;
                case "pos": return deskPos;
                case "feed": return deskFeedBox;
                case "mirai": return deskMirai;
            }
            return null;
        }

        // ---------- 그리기 ----------
        void RenderDesk()
        {
            if (deskEl == null) return;
            bool on = DeskActive && S.mk != null;
            deskEl.style.display = on ? DisplayStyle.Flex : DisplayStyle.None;
            if (!on) { deskChartKey = null; return; }
            if (deskFeedFor != G) { deskFeedFor = G; deskFeed.Clear(); deskBlink.Clear(); DeskFeedSeed(); }
            DeskFixSel();
            if (stkSel == null || !D.TK.ContainsKey(stkSel)) return;
            var t = D.TK[stkSel];
            DeskListRender();
            DeskCenterRender(t);
            DeskAnRender(t);
            deskOrder.Clear();
            deskOrder.Add(OrderBar(t, "app", G.stockFee("app") + G.sickSlip(), true));   // 장 보기에서 폰으로 살 때와 같은 수수료 (where = app)
            DeskPosRender();
            DeskFeedRender();
            DeskMiraiSync();
        }

        /// 고를 수 있는 종목: 열린 종목 중 주식은 장중에만 (밤 · 주말엔 코인만)
        bool DeskPickable(string id) => id != null && D.TK.ContainsKey(id) && G.tkOpen(id) && (!D.TK[id].IsStock || G.stockOpen());
        void DeskFixSel()
        {
            if (stkBars != 24 && stkBars != 48 && stkBars != 96) stkBars = 48;   // 12h · 24h · 48h (30분봉)
            if (DeskPickable(stkSel)) return;
            stkSel = D.TKList.Where(x => DeskPickable(x.id)).Select(x => x.id).FirstOrDefault() ?? D.TKList.Where(x => G.tkOpen(x.id)).Select(x => x.id).FirstOrDefault();
            stkAmt = null; stkSellF = 1; stkMsg = "";
        }
        void DeskSelect(string tk)
        {
            if (stkSel == tk || !DeskPickable(tk)) return;
            stkSel = tk; stkAmt = null; stkSellF = 1; stkMsg = "";
            RenderAll();
        }

        // ---------- 왼쪽: 종목 목록 ----------
        void DeskListRender()
        {
            var body = deskListSv.contentContainer; body.Clear();
            bool sOpen = G.stockOpen(); float now = Time.realtimeSinceStartup;
            void Group(string title, List<Ticker> list)
            {
                if (list.Count == 0) return;
                var h = Ui.Label(title, 18, StkAxis, true); h.style.marginTop = body.childCount > 0 ? 10 : 0; h.style.marginBottom = 6; body.Add(h);
                foreach (var x in list) body.Add(DeskRow(x, sOpen, now));
            }
            Group(sOpen ? "주식 · 장중" : G.weekend() ? "주식 · 주말 휴장" : "주식 · 장 마감 (09:00~15:30)", D.TKList.Where(x => x.IsStock && G.tkOpen(x.id)).ToList());
            Group("코인 · 24시간", D.TKList.Where(x => !x.IsStock && G.tkOpen(x.id)).ToList());
        }

        VisualElement DeskRow(Ticker x, bool sOpen, float now)
        {
            string id = x.id; var mk = S.mk.tk[id]; double r = Rr(id);
            bool sel = id == stkSel, stock = x.IsStock, shut = stock && !sOpen, locked = stock && G.opLocked(id);
            Color line = sel ? Ui.Accent : StkLine; float lw = sel ? 2 : 1;
            var it = Ui.Box(sel ? Color.Lerp(StkCard, Ui.Accent, 0.22f) : StkBg, 10, 10); it.style.marginBottom = 6; Ui.Border(it, line, lw);
            var top = Ui.Row(); it.Add(top);
            var nm = Ui.Label(x.name, 22, Ui.Text, true); nm.style.flexShrink = 1; nm.style.minWidth = 0; nm.style.whiteSpace = WhiteSpace.NoWrap; nm.style.overflow = Overflow.Hidden; nm.style.textOverflow = TextOverflow.Ellipsis; top.Add(nm);
            if (PosPnl(id).HasValue) top.Add(Badge("보유", Ui.Gold));
            if (locked) top.Add(Badge("하한가 잠김", Ui.Bad));
            else if (shut) top.Add(Badge("휴장", StkAxis));
            else if (G.limitUp(id)) top.Add(Badge("상한가", StkUp));
            else if (G.limitDn(id)) top.Add(Badge("하한가", StkDn));
            var sp = new VisualElement(); sp.style.flexGrow = 1; top.Add(sp);
            var rl = Ui.Label(GameSim.pct(r), 22, UpDn(r), true); rl.style.whiteSpace = WhiteSpace.NoWrap; rl.style.flexShrink = 0; rl.style.marginLeft = 8; top.Add(rl);
            if (stock)
            {   // 주갤 온도 막대 (0~100) + 거래량 배수 (2배 이상이면 금색 굵게)
                double temp = G.opTemp(id), vol = G.volNow(id);
                var tr = Ui.Row(); tr.style.marginTop = 6; it.Add(tr);
                var track = Ui.Box(new Color(1, 1, 1, 0.08f), 0, 4); track.style.height = 8; track.style.flexGrow = 1; track.style.marginRight = 10; tr.Add(track);
                var fill = Ui.Box(Color.Lerp(Ui.Gold, StkUp, Mathf.Clamp01((float)temp / 100f)), 0, 4); fill.style.height = Length.Percent(100);
                fill.style.width = Length.Percent(Mathf.Clamp((float)temp, 0, 100)); track.Add(fill);
                tr.Add(Ui.Label($"{G.fmtP(mk.p)} · 온도 {temp:0} · ", 18, StkAxis));
                var vl = Ui.Label($"×{vol:0.0}", 18, vol >= 2 ? Ui.Gold : StkAxis, vol >= 2); vl.style.whiteSpace = WhiteSpace.NoWrap; tr.Add(vl);
            }
            else
            {
                var sub = Ui.Label($"{G.fmtP(mk.p)} · 24시간 · 최대 {x.maxLev:0}배", 18, StkAxis); sub.style.marginTop = 2; it.Add(sub);
            }
            if (shut) it.style.opacity = 0.45f;
            if (deskBlink.TryGetValue(id, out var until) && until > now)
            {   // 큰손 매도 전조: 몇 초 동안 테두리가 주황으로 깜빡임
                it.schedule.Execute(() =>
                {
                    float tn = Time.realtimeSinceStartup; bool blink = tn < until && ((int)(tn * 4)) % 2 == 0;
                    Ui.Border(it, blink ? Ui.Bad : line, blink ? 3 : lw);
                }).Every(125);
            }
            if (!shut) it.RegisterCallback<ClickEvent>(_ => DeskSelect(id));
            return it;
        }

        // ---------- 가운데: 큰 차트 ----------
        void DeskCenterRender(Ticker t)
        {
            var mk = S.mk.tk[t.id]; double r = Rr(t.id);
            deskHead.Clear();
            var hr = Ui.Row(); hr.style.alignItems = Align.FlexEnd; deskHead.Add(hr);
            var nm = Ui.Label(t.name, 32, Ui.Text, true); nm.style.whiteSpace = WhiteSpace.NoWrap; hr.Add(nm);
            var pl = Ui.Label(" " + G.fmtP(mk.p), 36, UpDn(r), true); pl.style.whiteSpace = WhiteSpace.NoWrap; hr.Add(pl);
            var rl = Ui.Label(" " + GameSim.pct(r), 26, UpDn(r), true); rl.style.whiteSpace = WhiteSpace.NoWrap; rl.style.marginBottom = 3; hr.Add(rl);
            var sp = new VisualElement(); sp.style.flexGrow = 1; hr.Add(sp);
            foreach (var (n, l) in new[] { (24, "12h"), (48, "24h"), (96, "48h") })
            {
                int nn = n; var c = Ui.Chip(l, () => { stkBars = nn; RenderAll(); }, false, stkBars == n ? Ui.Accent : StkBg);
                c.style.marginBottom = 0; c.Q<Label>().style.whiteSpace = WhiteSpace.NoWrap; hr.Add(c);
            }
            string state = t.IsStock ? (G.opLocked(t.id) ? "하한가 잠김" : G.stockOpen() ? "장중" : G.weekend() ? "주말 휴장" : "장 마감") : "24시간";
            string sub = $"{t.cat ?? (t.IsStock ? "주식" : "코인")} · {state} · {D.RULES.RT_CANDLE}분봉 · 기준 {G.fmtP(mk.ref0)}" + (t.IsStock ? $" (±{D.RULES.RT_LIMIT * 100:0}%)" : " (자정)");
            if (t.IsStock) sub += $" · 주갤 온도 {G.opTemp(t.id):0} · 거래량 ×{G.volNow(t.id):0.0}";
            var sl = Ui.Label(sub, 18, StkAxis); sl.style.marginTop = 4; deskHead.Add(sl);
            var lg = Ui.Row(); lg.style.marginTop = 2; deskHead.Add(lg);
            lg.Add(Ui.Label("MA5 ", 18, CandleChart.Ma5C, true)); lg.Add(Ui.Label("MA20 ", 18, CandleChart.Ma20C, true));
            lg.Add(Ui.Label("· 아래 막대 = 거래량 (평소의 몇 배, 2배 이상 금색) · 마우스 올리면 시고저종", 18, StkAxis));

            var lines = ChartLines(t.id);
            string key = $"{t.id}|{stkBars}";
            if (deskChart != null && deskChartKey == key && ReferenceEquals(deskChartHist, mk.hist) && deskChart.parent == deskChartHost)
                deskChart.Set(mk.p, lines);
            else
            {
                deskChartHost.Clear();
                deskChart = new CandleChart(mk.hist, stkBars, mk.p, lines, G.fmtP, false, 130);
                deskChart.style.flexGrow = 1;
                deskChartHost.Add(deskChart);
                deskChartKey = key; deskChartHist = mk.hist;
            }
        }
        /// 조용한 분마다 (LiveChart): 큰 차트만 새 시세로
        void DeskChartTick()
        {
            if (deskChart == null || deskChart.panel == null || !DeskActive || stkSel == null || !S.mk.tk.Has(stkSel)) return;
            deskChart.Set(S.mk.tk[stkSel].p, ChartLines(stkSel));
        }

        // ---------- 오른쪽 ①: 분석가 칩 ----------
        void DeskAnRender(Ticker t)
        {
            deskAn.Clear();
            var R = D.RULES; var rs = G.rsch(); var ans = G.analysts(); double rf = R.RT_RSCH_FEE;
            bool dis = rs.paid >= R.RSCH_PAID_MAX || S.cash < rf;
            var hd = Ui.Label($"리포트 — 누구 말을 들을까 · 유료 {G.man(rf)}원 ({rs.paid}/{R.RSCH_PAID_MAX})", 18, StkAxis); hd.style.marginBottom = 6; deskAn.Add(hd);
            var row = Ui.Row(); row.style.flexWrap = Wrap.Wrap; deskAn.Add(row);
            Button Small(Button b) { b.style.paddingTop = 5; b.style.paddingBottom = 5; b.style.marginBottom = 6; return b; }
            row.Add(Small(Ui.Chip(ans.Count > 0 ? G.T("v4.an.free", "a", rs.free, "b", G.freeMax()) : $"무료 리포트 {rs.free}/{G.freeMax()}",
                () => { onSent = ReportMsg; Send("report", "paid", false); }, rs.free >= G.freeMax())));
            if (ans.Count > 0)
                foreach (var a in ans)
                {   // 분석가마다 칩 하나: 이름 + 전적. 두 번 눌러야 삼 (폰 증권 앱과 같은 대기)
                    string aid = a.id; bool armed = rptArmId == aid && Time.realtimeSinceStartup - rptArm < 4;
                    var pb = Small(Ui.Chip(armed && !dis ? $"{a.name} — 한 번 더" : $"{a.name} {G.srcRec(aid)}",
                        () => { if (rptArmId == aid && Time.realtimeSinceStartup - rptArm < 4) { rptArm = -10; rptArmId = null; onSent = ReportMsg; Send("report", "paid", true, "who", aid); } else { rptArm = Time.realtimeSinceStartup; rptArmId = aid; RenderAll(); } },
                        dis, armed && !dis ? (Color?)Ui.Bad : null));
                    pb.tooltip = a.flav; row.Add(pb);
                }
            else
            {
                bool armed = Time.realtimeSinceStartup - rptArm < 4;
                row.Add(Small(Ui.Chip(armed && !dis ? $"{ManW(rf)} 냄? 한 번 더" : "유료 리포트",
                    () => { if (Time.realtimeSinceStartup - rptArm < 4) { rptArm = -10; onSent = ReportMsg; Send("report", "paid", true); } else { rptArm = Time.realtimeSinceStartup; RenderAll(); } },
                    dis, armed && !dis ? (Color?)Ui.Bad : null)));
            }
            // 이 종목에 걸린 정보 (두 줄까지)
            var tips = G.activeTips(t.id);
            foreach (var tp in tips.Take(2))
            {
                var s0 = G.srcOf(tp);
                var l = Ui.Label($"{s0.name} {(tp.dir > 0 ? "▲ 오른다" : "▼ 내린다")} · {G.tipWhen(tp)} · {(s0.an ? "전적" : "기록")} {G.srcRec(tp.who)}", 18, tp.dir > 0 ? StkUp : StkDn, true);
                l.style.whiteSpace = WhiteSpace.NoWrap; l.style.overflow = Overflow.Hidden; l.style.textOverflow = TextOverflow.Ellipsis; deskAn.Add(l);
            }
            if (tips.Count == 0) deskAn.Add(Ui.Label($"{t.name} 정보 없음 — 감으로 하는 거임", 18, StkAxis));
            else if (tips.Select(x => x.dir).Distinct().Count() > 1) deskAn.Add(Ui.Label("의견 갈림 — 정보 수첩 성적표 참고", 18, Ui.Gold));
        }

        // ---------- 오른쪽 ③: 내 포지션 ----------
        void DeskPosRender()
        {
            deskPosHead.Clear();
            var hl = Ui.Label("내 포지션", 20, Ui.Text, true); hl.style.flexGrow = 1; deskPosHead.Add(hl);
            if (G.hasPos()) { double u = G.unreal(); deskPosHead.Add(Ui.Label($"평가손익 {G.sgnMan(u)}", 20, UpDn(u), true)); }
            if (S.cps.Count >= 2)
            {   // 코인 전부 정리는 늘 두 번 (내 계좌 탭과 같음)
                bool armed = OrdArmed("closeCoins");
                var b = Ui.Chip(armed ? "한 번 더: 코인 전부" : "코인 전부 정리", Confirm("closeCoins", true, () => Order("코인 정리", "다 정리했어. 이제 현금이 왕이야", "다 정리했어… 현금이라도 남았네", "closeCoins")), false, armed ? (Color?)Ui.Bad : null);
                b.style.marginLeft = 10; b.style.marginRight = 0; b.style.marginBottom = 0; b.style.paddingTop = 4; b.style.paddingBottom = 4; deskPosHead.Add(b);
            }
            var body = deskPosSv.contentContainer; body.Clear();
            int n = 0;
            foreach (var k in G.STK().Where(k => S.hold.Has(k)).ToList()) { body.Add(DeskStockRow(k)); n++; }
            foreach (var c in S.cps.ToList()) { body.Add(DeskCoinRow(c)); n++; }
            if (n == 0) { var e = Ui.Label("포지션 없음 — 위에서 금액을 고르고 매수 · 롱 · 숏", 20, StkAxis); e.style.marginTop = 6; body.Add(e); }
        }

        /// 손익 큰 숫자 (1080p 기준 40)
        static Label DeskPnl(string text, Color c)
        {
            var l = Ui.Label(text, 40, c, true); l.style.whiteSpace = WhiteSpace.NoWrap; l.style.unityTextAlign = TextAnchor.MiddleRight; l.style.flexShrink = 0; l.style.marginLeft = 8;
            return l;
        }
        /// 포지션 이름 쪽을 누르면 그 종목을 고름
        VisualElement DeskPosInfo(VisualElement row, string tk)
        {
            var info = new VisualElement(); info.style.flexGrow = 1; info.style.flexShrink = 1; info.style.minWidth = 0; row.Add(info);
            info.RegisterCallback<ClickEvent>(_ => DeskSelect(tk));
            return info;
        }

        VisualElement DeskStockRow(string k)
        {
            var x = S.hold[k]; double v = x.q * S.mk.tk[k].p, pl = v - x.cost;
            var box = Ui.Box(StkBg, 10, 10); box.style.marginBottom = 8; box.style.borderLeftWidth = 4; box.style.borderLeftColor = UpDn(pl);
            var row = Ui.Row(); box.Add(row);
            var info = DeskPosInfo(row, k);
            info.Add(Ui.Label($"{D.TK[k].name} · 주식", 22, Ui.Text, true));
            info.Add(Ui.Label($"{G.man(x.cost)} → {G.man(v)} ({GameSim.pct(x.cost > 0 ? v / x.cost - 1 : 0)})", 18, StkAxis));
            row.Add(DeskPnl(G.sgnMan(pl), UpDn(pl)));
            // 못 파는 이유: 하한가 잠김(작전주 설거지) · 장 마감
            string why = G.sellLockWhy(k) ?? (!G.stockTradeOk() ? (G.weekend() ? "주말 휴장 · 코인만" : "장 마감 · 국장 09:00~15:30") : null);
            var br = Ui.Row(); br.style.marginTop = 8; br.style.alignItems = Align.Stretch; box.Add(br);
            foreach (var (label, frac) in new[] { ("절반 팔기", 0.5), ("전부 팔기", 1.0) })
            {   // 한 번에. 큰 건(100만 이상)만 두 번
                double f = frac; bool danger = v * f >= DeskBig; string key = $"sell|{k}|{f}"; bool armed = danger && why == null && OrdArmed(key);
                var b = Ui.Button(armed ? "한 번 더 누르기" : label,
                    Confirm(key, danger, () => Order(f >= 1 ? "전량 매도" : "절반 매도", "익절은 과학이다", "손절도 과학이다 (눈물)", "sell", "tk", k, "frac", f, "where", "app")),
                    null, why != null, armed ? Ui.Bad : f >= 1 ? StkDn : Ui.Panel2, 22);
                b.style.flexGrow = 1; b.style.flexBasis = 0; b.style.marginBottom = 0; b.style.alignItems = Align.Center;
                if (f < 1) b.style.marginRight = 8;
                br.Add(b);
            }
            if (why != null) { var wl = Ui.Label(why, 18, Ui.Bad, true); wl.style.whiteSpace = WhiteSpace.Normal; wl.style.marginTop = 4; box.Add(wl); }
            return box;
        }

        VisualElement DeskCoinRow(CoinPos c)
        {
            double pl = G.cpnl(c) + c.bonus; int id = c.id; bool lk = !S.rt && c.t0 == G.Tnow();
            var box = Ui.Box(StkBg, 10, 10); box.style.marginBottom = 8; box.style.borderLeftWidth = 4; box.style.borderLeftColor = c.dir > 0 ? StkUp : StkDn;
            var row = Ui.Row(); box.Add(row);
            var info = DeskPosInfo(row, c.tk);
            info.Add(Ui.Label($"{(c.mirai ? "미래 " : "")}{D.TK[c.tk].name} {c.lev:0}x {(c.dir > 0 ? "롱" : "숏")}", 22, c.dir > 0 ? StkUp : StkDn, true));
            info.Add(Ui.Label($"증거금 {G.man(c.margin)} · 청산가 {G.fmtP(GameSim.liqPx(c))} · {GameSim.pct(c.margin > 0 ? pl / c.margin : 0)}", 18, StkAxis));
            row.Add(DeskPnl(G.sgnMan(pl), UpDn(pl)));
            // 닫기: 큰 건(증거금+손익 100만 이상 · 25배 이상)만 두 번
            bool danger = c.margin + pl >= DeskBig || c.lev >= 25; string key = $"close|{id}"; bool armed = danger && !lk && OrdArmed(key);
            var b = Ui.Button(lk ? "다음 칸부터" : armed ? "한 번 더 누르면 닫기" : "닫기",
                Confirm(key, danger, () => Order("정리", "익절 ㅋㅋ 나 천재?", "…손절. 괜찮아. 괜찮아.", "close", "id", id)),
                null, lk, armed ? Ui.Bad : Ui.Panel2, 22);
            b.style.marginTop = 8; b.style.marginBottom = 0; b.style.alignItems = Align.Center; box.Add(b);
            if (G.v4) StopsRow(box, c);   // 예약 손절 · 익절 칩 (폰 내 계좌와 같은 것)
            return box;
        }

        // ---------- 아래 왼쪽: 소식 띠 ----------
        void DeskFeed(string tag, Color c, string text)
        {
            if (string.IsNullOrEmpty(text) || G == null) return;
            if (deskFeedFor != G) { deskFeedFor = G; deskFeed.Clear(); deskBlink.Clear(); }
            deskFeed.Insert(0, new DeskLine { tag = tag, c = c, text = Ui.Clean(text), time = G.clockNow() });
            while (deskFeed.Count > 12) deskFeed.RemoveAt(deskFeed.Count - 1);
            deskFeedVer++;
            DeskFeedRender();
        }
        /// 데스크를 처음 열 때: 오늘 쌓인 뉴스 몇 줄로 시작 (빈 띠 대신)
        void DeskFeedSeed()
        {
            foreach (var f in S.feed.Where(f => f.kind == "news" || f.kind == "tip").Reverse().Take(3).Reverse())
                deskFeed.Insert(0, new DeskLine { tag = f.kind == "tip" ? "발표" : "뉴스", c = f.kind == "tip" ? Ui.Gold : StkAxis, text = Ui.Clean(f.x), time = "" });
            deskFeedVer++;
        }
        /// 가장 빠른 분석가 리포트 기한 한 줄 (없으면 null)
        string DeskDueLine()
        {
            var t = G.activeTips().Where(x => G.srcOf(x).an).OrderBy(x => x.Td > 0 ? x.Td : x.Tr).FirstOrDefault();
            return t == null ? null : $"리포트 기한: {G.srcOf(t).name} → {D.TK[t.tk].name} {(t.dir > 0 ? "▲" : "▼")} · {G.tipWhen(t)}";
        }
        void DeskFeedRender()
        {
            if (deskFeedBox == null || G == null || S.mk == null) return;
            string due = DeskDueLine(), sig = deskFeedVer + "|" + due;
            if (sig == deskFeedSig) return;   // 바뀐 게 없으면 그대로 (새 줄 애니메이션이 다시 돌지 않게)
            deskFeedSig = sig;
            bool fresh = deskFeedVer != deskFeedAnimVer; deskFeedAnimVer = deskFeedVer;
            deskFeedBox.Clear();
            int max = due != null ? 3 : 4;
            VisualElement first = null;
            for (int i = 0; i < deskFeed.Count && i < max; i++)
            {
                var L = deskFeed[i];
                var r = Ui.Row(); r.style.marginBottom = 6; r.style.flexShrink = 0; deskFeedBox.Add(r);
                var tg = Ui.Label(L.tag, 18, L.c, true); Ui.Border(tg, L.c, 2); Ui.Radius(tg, 12);
                tg.style.paddingLeft = 10; tg.style.paddingRight = 10; tg.style.paddingTop = 1; tg.style.paddingBottom = 1; tg.style.marginRight = 12;
                tg.style.minWidth = 70; tg.style.flexShrink = 0; tg.style.unityTextAlign = TextAnchor.MiddleCenter; r.Add(tg);
                var tx = Ui.Label(L.text, 20, Ui.Text, i == 0); tx.style.flexShrink = 1; tx.style.minWidth = 0;
                tx.style.whiteSpace = WhiteSpace.NoWrap; tx.style.overflow = Overflow.Hidden; tx.style.textOverflow = TextOverflow.Ellipsis; r.Add(tx);
                if (!string.IsNullOrEmpty(L.time)) { var tm = Ui.Label(L.time, 18, StkAxis); tm.style.marginLeft = 12; tm.style.flexShrink = 0; r.Add(tm); }
                if (i == 0) first = r;
            }
            if (deskFeed.Count == 0) { var e = Ui.Label("아직 소식 없음 — 속보 · 큰손 매도 · 발표가 여기에 뜸", 20, StkAxis); e.style.marginBottom = 6; deskFeedBox.Add(e); }
            if (due != null) { var dl = Ui.Label(due, 20, StkAxis); dl.style.whiteSpace = WhiteSpace.NoWrap; dl.style.overflow = Overflow.Hidden; dl.style.textOverflow = TextOverflow.Ellipsis; deskFeedBox.Add(dl); }
            if (fresh && first != null && !Ui.FxOff)
            {   // 새 줄은 위에서 내려오며 들어옴
                var fr = first; fr.style.opacity = 0;
                Fx(Tween(0.25f, p => { fr.style.opacity = p; fr.style.translate = new Translate(0, -12 * (1 - p)); }));
            }
        }

        // ---------- 아래 오른쪽: 미래 작은 창 ----------
        /// 미래 한마디: 데스크면 작은 창 말풍선, 아니면 토스트 (주문 결과 · 배율 반응)
        void MiraiLine(string text, string face)
        {
            SetFace(face);
            if (DeskActive) DeskSay(text); else Toast("미래: " + text, "bubble");
        }
        void DeskSay(string text)
        {
            if (string.IsNullOrEmpty(text)) return;
            deskSay = Ui.Clean(text); deskSayUntil = Time.realtimeSinceStartup + DeskSayHold;
            KwGame.Audio.GameAudioManager.Play(KwGame.Audio.SoundCue.ToastPop);
            DeskMiraiSync();
        }
        void DeskMiraiSync()
        {
            if (deskMirai == null || deskBubble == null || G == null || S.mk == null || !DeskActive) return;
            if (faceNow != deskFaceShown)
            {
                deskFaceShown = faceNow; var s = ArtCatalog.Mirai(faceNow);
                deskFace.style.backgroundImage = s != null ? new StyleBackground(s) : new StyleBackground(StyleKeyword.None);
            }
            string txt = Time.realtimeSinceStartup < deskSayUntil && !string.IsNullOrEmpty(deskSay) ? deskSay : DeskIdleLine();
            if (deskBubble.text != txt) deskBubble.text = txt;
        }
        /// 할 말이 없을 때 한마디 (포지션 상태만 봄. 전조 · 숨은 값에는 반응하지 않음 — "말이 없으면 안전" 누수 방지)
        string DeskIdleLine()
        {
            double near = S.cps.Where(c => c.lev * c.mult > 1.2).Select(c => Math.Abs(S.mk.tk[c.tk].p / GameSim.liqPx(c) - 1)).DefaultIfEmpty(1.0).Min();
            if (near < 0.05) return "청산가 코앞이야… 자기야 진짜 괜찮아?";
            if (!G.hasPos()) return G.stockOpen() ? "뭐 살 거야? 왼쪽에서 골라 봐." : "주식장은 닫혔어. 지금은 코인만 돼.";
            double u = G.unreal();
            return u > 0 ? "오 벌고 있네? 욕심내지 말고." : u < 0 ? "괜찮아… 아직 안 판 거잖아." : "들고 있는 거 잘 보고 있어.";
        }

        // ---------- 사건 (Play 가 사건마다 부름. true = 데스크가 다 보여줌 → 기본 처리 건너뜀) ----------
        bool DeskEvent(SimEvent e)
        {
            if (e == null || !DeskActive) return false;
            switch (e.t)
            {
                case "toast":
                    {
                        string app = e.Str("app"), room = e.Str("room"), kind = e.Str("kind"), text = e.Str("text");
                        if (room == "op") return true;   // 작전주 전조 · 설거지 토스트: 바로 뒤 opPre · opDump 가 같은 글로 한 줄 넣음 (두 줄 안 되게)
                        if (room == "report" || room == "stop") return false;   // 발표 · 예약 체결은 planEv · stopFill 이 줄을 넣고, 이 토스트는 Play 가 거름
                        if (app == "news")
                        {
                            bool flash = room == "flash";
                            Color nc = flash ? Ui.Accent : kind == "liq" ? Ui.Bad : room == "follow" ? Ui.Gold : StkAxis;
                            DeskFeed(flash ? "속보" : room == "follow" ? "후속" : "뉴스", nc, text);
                            if (flash) CoachCtx("news");   // 첫 칸 시작 속보 → 속보 설명 카드 (Play 의 토스트 처리를 건너뛰므로 여기서)
                            return true;
                        }
                        if (app == "gall") { DeskFeed("주갤", DeskGall, text); HoldFace("annoyed"); return true; }
                        return false;
                    }
                case "bubble":
                    {
                        SetFace(e.Str("face")); DeskSay(e.Str("text"));
                        return true;
                    }
                case "tip":
                    {
                        if (e.Str("bubble") == null) return false;
                        SetFace(e.Str("face")); DeskSay(e.Str("bubble"));
                        return true;
                    }
                case "opPre":
                    {   // 큰손 매도 전조 (진짜 · 헛것 같은 모양). 미래는 반응하지 않음
                        string px = G.T("v4.op.pre", "n", e.Str("n")), ptag = "체결";
                        int pb = px.IndexOf(']');
                        if (px.StartsWith("[") && pb > 1) { ptag = px.Substring(1, pb - 1); px = px.Substring(pb + 1).Trim(); }
                        DeskFeed(ptag, Ui.Bad, px);
                        string ptk = e.Str("tk"); if (ptk != null) deskBlink[ptk] = Time.realtimeSinceStartup + DeskBlinkSec;
                        return true;
                    }
                case "opDump":
                    {   // 설거지: 소식 띠 + 위쪽 가운데 배너. 들고 있었으면 데스크 흔들림 + 미래 놀람
                        bool dHold = e["hold"] is bool dh && dh;
                        string dx = G.T("v4.op.dump", "n", e.Str("n"), "p", GameSim.pct(e.Num("r")));
                        DeskFeed("설거지", Ui.Bad, dx);
                        Banner(dx, Ui.Bad, dHold ? "보유 중" : null);
                        if (dHold)
                        {
                            HoldFace("shocked", true); DeskSay("자기야… 그거 우리 거잖아. 하한가야…");
                            if (deskEl != null) Shake(deskEl, 18);
                        }
                        return true;
                    }
                case "planEv":
                    {   // 리포트 발표: 줄만 넣고 배너는 H 쪽(ReportBanner)이 그대로. 후속 속보는 토스트(room follow)가 이미 줄을 넣음
                        if (e.Str("k") == "report")
                        {
                            bool rUp = e["up"] is bool ru && ru, rOk = e["ok"] is bool ro && ro; string who = e.Str("who");
                            DeskFeed("발표", Ui.Gold, $"{e.Str("n")} {(rUp ? "▲" : "▼")}" + (string.IsNullOrEmpty(who) ? "" : $" · {who} {(rOk ? "적중" : "빗나감")}"));
                        }
                        return false;
                    }
                case "stopFill":
                    {
                        bool sTp = e["tp"] is bool st && st; double sPnl = e.Num("pnl");
                        DeskFeed("예약", UpDn(sPnl), $"{(sTp ? "익절" : "손절")} 체결 — {e.Str("n")} {G.sgnMan(sPnl)}");
                        return false;
                    }
                case "liveLiq":
                    {
                        DeskFeed("청산", Ui.Bad, $"청산 {e.Num("n"):0}건 — 증거금이 날아감");
                        return false;
                    }
            }
            return false;
        }

        // ---------- 캡처 모드 · 데모용 (GameController.WebShots.cs 가 부를 것) ----------
        /// 주문 패널 값 넣기: amt null = 기본(최대의 25%) · 배율 · 방향(1 롱 / −1 숏)
        void DeskOrderSet(double? amt, double lev = 10, int dir = 1)
        {
            stkAmt = amt; stkLev = lev; stkDir = dir; stkMore = false; stkMsg = "";
            RenderAll();
        }
        /// 차트 범위: 24 = 12h · 48 = 24h · 96 = 48h
        void DeskRange(int bars) { stkBars = bars; RenderAll(); }
    }
}
