using System;
using System.Collections.Generic;
using System.Linq;
using KwGame.Sim;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // 폰 → 개미증권 앱 (web/src/view/phone2.js 의 stMkt·stDetail·stAcct 대응 + 이평선·거래량·십자선)
    // 탭: 시세(카드 + 스파크라인) / 차트·주문(캔들 차트 + 주문창) / 내 계좌(손익 곡선 + 포지션)
    // 한국 증시 색: 오르면 빨강, 내리면 파랑.
    public partial class GameController
    {
        static readonly Color StkUp = new Color32(0xff, 0x4d, 0x5e, 0xff);
        static readonly Color StkDn = new Color32(0x4e, 0x8c, 0xff, 0xff);
        static readonly Color StkBg = new Color32(0x0d, 0x0f, 0x16, 0xff);
        static readonly Color StkCard = new Color32(0x17, 0x1a, 0x26, 0xff);
        static readonly Color StkLine = new Color32(0x2a, 0x2f, 0x42, 0xff);
        static readonly Color StkAxis = new Color32(0x6b, 0x71, 0x86, 0xff);
        static Color UpDn(double v) => v >= 0 ? StkUp : StkDn;

        string stkTab = "mkt", stkSel, stkMsg = "";
        double? stkAmt; double stkLev = 10; int stkDir = 1, stkBars = 40; bool stkLineMode;
        /// 칸이 넘어가 새 봉이 생기면 마지막 봉을 자라나게 그림 (종목별로 본 봉 수 기억)
        readonly Dictionary<string, int> stkSeen = new Dictionary<string, int>();
        /// Send 직후 이번 명령의 이벤트를 받는 1회용 콜백 (주문 결과 메시지용)
        Action<List<SimEvent>> onSent;
        // 실시간: 차트는 폰을 다시 그려도 같은 걸 다시 붙여 씀 (축 글자 깜빡임 방지), 금액 막대 끄는 중엔 폰 다시 안 그림, 시세 띠 위치 유지
        CandleChart liveChart; string liveChartKey; bool stkDragging; float tapeX;

        /// 등락: 실시간이면 오늘(전일 종가·자정 대비), 아니면 마지막 칸
        double Rr(string id) => S.rt ? G.dayR(id) : LastR(S.mk.tk[id]);
        string RrLabel => S.rt ? "오늘" : "지난 칸";

        List<(double y, Color c, string l)> ChartLines(string tk)
        {
            var lines = new List<(double y, Color c, string l)>();
            var h0 = S.hold.Get(tk);
            if (h0 != null && h0.q > 0) lines.Add((h0.cost / h0.q, Ui.Gold, "평단"));
            foreach (var c in S.cps.Where(c => c.tk == tk).Take(2))
            {
                lines.Add((c.entry, Ui.Gold, $"진입 {c.lev:0}x {(c.dir > 0 ? "롱" : "숏")}"));
                if (c.lev * c.mult > 1.2) lines.Add((GameSim.liqPx(c), new Color32(0xff, 0x3b, 0x4f, 0xff), "청산가"));
            }
            if (S.rt && D.TK[tk].IsStock && S.mk.tk[tk].ref0 > 0)
            {
                lines.Add((S.mk.tk[tk].ref0 * (1 + D.RULES.RT_LIMIT), new Color(1f, 0.3f, 0.37f, 0.5f), "상한가"));
                lines.Add((S.mk.tk[tk].ref0 * (1 - D.RULES.RT_LIMIT), new Color(0.3f, 0.55f, 1f, 0.5f), "하한가"));
            }
            return lines;
        }
        /// 조용한 분마다: 보고 있는 차트만 새 시세로
        void LiveChart()
        {
            if (liveChart == null || liveChart.panel == null || stkSel == null || !S.mk.tk.Has(stkSel)) return;
            liveChart.Set(S.mk.tk[stkSel].p, ChartLines(stkSel));
        }

        void StockApp(VisualElement body, string where)
        {
            var R = D.RULES; double fee = G.stockFee(where);
            // 위: 시세 띠 (전 종목 등락이 흘러감). 실시간 차트 화면엔 관심종목 목록이 있어서 생략
            if (!(S.rt && stkTab == "detail")) body.Add(TickerTape());

            var head = Ui.Row(); head.style.flexWrap = Wrap.Wrap; head.style.marginTop = 14; head.style.marginBottom = 10; body.Add(head);
            foreach (var (k, n) in new[] { ("mkt", "시세"), ("detail", "차트·주문"), ("acct", "내 계좌") })
            {
                var kk = k; head.Add(Ui.Chip(n, () => { stkTab = kk; stkMsg = ""; RenderAll(); }, false, stkTab == k ? Ui.Accent : (Color?)null));
            }
            var rs = G.rsch();
            head.Add(Ui.Chip($"무료 리포트 {rs.free}/{G.freeMax()}", () => { onSent = ReportMsg; Send("report", "paid", false); }, rs.free >= G.freeMax()));
            head.Add(Ui.Chip($"유료 리포트 {G.man(R.RSCH_FEE)}", () => { onSent = ReportMsg; Send("report", "paid", true); }, rs.paid >= R.RSCH_PAID_MAX || S.cash < R.RSCH_FEE));

            double pl = G.unreal();
            var sum = Ui.Row(); sum.style.flexWrap = Wrap.Wrap; sum.style.marginBottom = 10; body.Add(sum);
            void Sum(string k, string v, Color c) { var b = Ui.Row(); b.style.marginRight = 22; var kl = Ui.Label(k, 20, StkAxis); kl.style.marginRight = 6; b.Add(kl); b.Add(Ui.Label(v, 22, c, true)); sum.Add(b); }
            Sum("현금", G.won(S.cash), Ui.Text);
            Sum("평가", G.won(G.holdVal()), Ui.Text);
            if (G.hasPos()) Sum("평가손익", G.sgnWon(pl), UpDn(pl));
            Sum(G.stockOpen() ? "● 주식장" : "○ 주식장", G.stockOpen() ? $"열림 · 수수료 {fee * 100:0.0}%" : S.rt ? "마감 (09:00~15:30)" : "마감 (아침·점심만)", G.stockOpen() ? StkUp : StkAxis);
            Sum("코인", "24시간", Ui.Gold);
            { var m = Ui.Label(stkMsg == "" ? " " : stkMsg, 20, Ui.Gold, true); m.style.marginBottom = 8; m.style.whiteSpace = WhiteSpace.NoWrap; body.Add(m); }   // 체결 줄은 늘 자리 차지 (주문 버튼이 밀리지 않게)

            if (stkTab == "detail") StkDetail(body, where, fee);
            else if (stkTab == "acct") StkAcct(body, where);
            else StkMarket(body);
            NoShrink(body);
        }

        /// 스크롤 안 세로 줄들이 눌려서 글자가 겹치지 않게 (테마 USS 가 없어 기본 flexShrink=1)
        static void NoShrink(VisualElement v)
        {
            bool col = v.style.flexDirection.value != FlexDirection.Row;   // 가로 줄은 그대로 (폭은 줄어들어야 함)
            foreach (var c in v.Children()) { if (col) c.style.flexShrink = 0; if (!(c is CandleChart) && !(c is LineChart)) NoShrink(c); }
        }

        void ReportMsg(List<SimEvent> evs)
        {
            var e = evs.FirstOrDefault(x => x.t == "report");
            var tp = e != null && e["ok"] is bool ok && ok ? S.tips.FirstOrDefault(x => x.id == (int)e.Num("id")) : null;
            stkMsg = tp != null ? $"리포트: {D.TK[tp.tk].name} {(tp.dir > 0 ? "▲ 오른다" : "▼ 내린다")} · {G.whenLabel(tp.Tr)}" : "리포트 못 받음 (오늘 다 씀 / 현금 부족)";
        }

        /// 주문 보내고 결과를 메시지 + 미래 반응으로
        void Order(string what, string bubbleOk, string bubbleBad, params object[] kv)
        {
            onSent = evs =>
            {
                var e = evs.FirstOrDefault(x => x.t == "trade");
                bool ok = e != null && e["ok"] is bool b && b;
                double pnl = e?.Num("pnl") ?? 0;
                string tkn = e?.Str("tk") != null && D.TK.TryGetValue(e.Str("tk"), out var t) ? t.name : "";
                string op = e?.Str("op");
                stkMsg = !ok ? (S.rt ? $"{what} 실패 (장 마감 / 현금 부족)" : $"{what} 실패 (장 마감 / 현금 부족 / 이번 칸에 진입함)")
                    : op == "buy" ? $"체결: {tkn} {G.won(e.Num("amt"))} 매수"
                    : op == "open" ? $"체결: {tkn} {e.Num("lev"):0}x {(e.Num("dir") > 0 ? "롱" : "숏")} · 증거금 {G.won(e.Num("margin"))}"
                    : $"체결: {tkn} {what} {G.sgnWon(pnl)}";
                if (!ok) return;
                bool good = op == "buy" || op == "open" || pnl >= 0;
                string line = good ? bubbleOk : bubbleBad;
                if (line != null) { Toast("미래: " + line, "bubble"); SetFace(good ? (op == "buy" || op == "open" ? "smug" : "happy") : "cry"); }
            };
            Send(new SimCommand(kv[0] as string, kv.Skip(1).ToArray()));
        }

        // ---------- 시세 띠 ----------
        VisualElement TickerTape()
        {
            var tape = Ui.Box(StkBg, 0, 8); tape.style.height = 38; tape.style.overflow = Overflow.Hidden; tape.pickingMode = PickingMode.Ignore;
            var run = Ui.Row(); run.style.position = Position.Absolute; run.style.top = 5; run.pickingMode = PickingMode.Ignore; tape.Add(run);
            for (int rep = 0; rep < 3; rep++)
                foreach (var t in D.TKList.Where(x => G.tkOpen(x.id)))
                {
                    var mk = S.mk.tk[t.id]; double r = Rr(t.id);
                    var l = Ui.Label($"{t.name} {G.fmtP(mk.p)} {GameSim.pct(r)}", 20, UpDn(r), true); l.style.marginRight = 36; l.pickingMode = PickingMode.Ignore;
                    run.Add(l);
                }
            run.style.left = tapeX;
            tape.schedule.Execute(() =>
            {
                float w = run.resolvedStyle.width / 3; if (float.IsNaN(w) || w <= 0) return;
                tapeX -= 1.2f; if (tapeX < -w) tapeX += w;
                run.style.left = tapeX;
            }).Every(16);
            return tape;
        }

        static double LastR(TkState mk) => mk.hist.Count > 0 ? mk.hist[mk.hist.Count - 1].c / mk.hist[mk.hist.Count - 1].o - 1 : 0;
        static double SpanR(TkState mk, int n) => mk.hist.Count > n ? mk.p / mk.hist[mk.hist.Count - n].o - 1 : 0;

        // ---------- 시세 ----------
        void StkMarket(VisualElement body)
        {
            VisualElement grid = null; int col = 0;
            foreach (var t in D.TKList)
            {
                if (col++ % 2 == 0) { grid = Ui.Row(); grid.style.alignItems = Align.Stretch; body.Add(grid); }
                var mk = S.mk.tk[t.id]; bool lk = !G.tkOpen(t.id); double r = Rr(t.id), r4 = SpanR(mk, 4);
                var card = Ui.Box(StkCard, 16, 14); card.style.flexBasis = 0; card.style.flexGrow = 1; card.style.marginRight = col % 2 == 1 ? 12 : 0; card.style.marginBottom = 12;
                Ui.Border(card, Math.Abs(r) >= 0.1 && !lk ? UpDn(r) : StkLine, 2);
                var top = Ui.Row(); card.Add(top);
                top.Add(Ui.Label(t.name, 26, Ui.Text, true));
                top.Add(Badge(t.cat ?? (t.IsCoin ? "코인" : "주식"), t.IsCoin ? Ui.Gold : StkAxis));
                if (!lk && G.limitUp(t.id)) top.Add(Badge("상한가", StkUp));
                else if (!lk && G.limitDn(t.id)) top.Add(Badge("하한가", StkDn));
                else if (!lk && Math.Abs(r) >= 0.1) top.Add(Badge(r > 0 ? "급등" : "급락", UpDn(r)));
                if (mk.warn) top.Add(Badge("관리종목", Ui.Bad));
                var po = PosPnl(t.id);
                if (po.HasValue) top.Add(Badge("보유 " + G.sgnMan(po.Value), UpDn(po.Value)));
                if (lk) { card.Add(Ui.Label($"잠김 — 유품 '{LockName(t)}' 필요", 20, StkAxis)); }
                else
                {
                    var pr = Ui.Row(); pr.style.marginTop = 6; card.Add(pr);
                    pr.Add(Ui.Label(G.fmtP(mk.p), 34, Ui.Text, true));
                    var rl = Ui.Label(GameSim.pct(r), 24, UpDn(r), true); rl.style.marginLeft = 12; pr.Add(rl);
                    var sp = new LineChart(mk.hist.Skip(Math.Max(0, mk.hist.Count - 16)).Select(c => c.c).Concat(new[] { mk.p }).ToList(), false, null);
                    sp.style.height = 70; sp.style.marginTop = 6; card.Add(sp);
                    card.Add(Ui.Label(S.rt ? Ui.Clean(t.d) + (mk.relist > 0 ? $" · 재상장 {mk.relist}회" : "") : $"{Ui.Clean(t.d)} · 4칸 {GameSim.pct(r4)}", 18, StkAxis));
                    string id = t.id;
                    card.RegisterCallback<ClickEvent>(_ => { stkSel = id; stkTab = "detail"; stkAmt = null; stkMsg = ""; RenderAll(); });
                    card.RegisterCallback<PointerEnterEvent>(_ => card.style.backgroundColor = Color.Lerp(StkCard, Ui.Accent, 0.12f));
                    card.RegisterCallback<PointerLeaveEvent>(_ => card.style.backgroundColor = StkCard);
                }
                grid.Add(card);
            }
            if (col % 2 == 1) { var fill = new VisualElement(); fill.style.flexBasis = 0; fill.style.flexGrow = 1; grid.Add(fill); }
            TipCards(body, null);
        }

        string LockName(Ticker t) => D.AUGS.FirstOrDefault(a => a.id == t.@lock)?.name ?? t.@lock;

        static Label Badge(string text, Color c)
        {
            var b = Ui.Label(text, 16, c, true); b.style.marginLeft = 8; Ui.Border(b, c, 1); Ui.Radius(b, 6);
            b.style.paddingLeft = 6; b.style.paddingRight = 6; b.style.paddingTop = 1; b.style.paddingBottom = 1;
            return b;
        }

        double? PosPnl(string k)
        {
            var h = S.hold.Get(k); var cs = S.cps.Where(c => c.tk == k).ToList();
            if (h == null && cs.Count == 0) return null;
            double v = h != null ? h.q * S.mk.tk[k].p - h.cost : 0;
            foreach (var c in cs) v += G.cpnl(c) + c.bonus;
            return v;
        }

        void TipCards(VisualElement body, string tk)
        {
            var tips = G.activeTips(tk);
            var hd = Ui.Label(tk == null ? "받은 정보 (진행 중)" : "이 종목 정보", 22, Ui.Gold, true); hd.style.marginTop = 8; hd.style.marginBottom = 6; body.Add(hd);
            var row = Ui.Row(); row.style.flexWrap = Wrap.Wrap; row.style.alignItems = Align.FlexStart; body.Add(row);
            foreach (var t in tips.Skip(Math.Max(0, tips.Count - 6)))
            {
                var s0 = G.srcOf(t);
                var c = Ui.Box(StkCard, 12, 10); c.style.marginRight = 10; c.style.marginBottom = 10; c.style.borderLeftWidth = 4; c.style.borderLeftColor = t.dir > 0 ? StkUp : StkDn;
                c.Add(Ui.Label($"{s0.name} · 신뢰 {GameSim.stars(s0.trust)}", 17, StkAxis));
                c.Add(Ui.Label($"{D.TK[t.tk].name} {(t.dir > 0 ? "▲ 오른다" : "▼ 내린다")}", 22, t.dir > 0 ? StkUp : StkDn, true));
                c.Add(Ui.Label(G.whenLabel(t.Tr), 17, Ui.Text));
                row.Add(c);
            }
            if (S.whale != null && S.whale.T == G.Tnow() && (tk == null || tk == S.whale.tk))
            {
                var c = Ui.Box(StkCard, 12, 10); c.style.marginBottom = 10; Ui.Border(c, Ui.Gold, 2);
                c.Add(Ui.Label(S.rt ? "새벽 고래 · 이번 시간대 70%" : "새벽 고래 · 이번 칸 70%", 17, Ui.Gold));
                c.Add(Ui.Label($"{D.TK[S.whale.tk].name} {(S.whale.dir > 0 ? "▲ 매집" : "▼ 투매")}", 22, S.whale.dir > 0 ? StkUp : StkDn, true));
                row.Add(c);
            }
            if (row.childCount == 0) row.Add(Ui.Label("정보 없음. 감으로 하는 거임 (정보는 증권사·갤·길거리에서)", 20, StkAxis));
        }

        // ---------- 차트·주문 ----------
        void StkDetail(VisualElement body, string where, double fee)
        {
            var R = D.RULES;
            if (stkSel == null || !D.TK.ContainsKey(stkSel) || !G.tkOpen(stkSel)) stkSel = D.TKList.First(x => G.tkOpen(x.id)).id;
            var t = D.TK[stkSel]; var mk = S.mk.tk[stkSel]; bool isC = t.IsCoin; double r = Rr(stkSel);

            // 종목 고르기: 실시간이면 왼쪽 세로 관심종목, 아니면 칩 띠
            if (S.rt)
            {
                var cols0 = Ui.Row(); cols0.style.alignItems = Align.FlexStart; body.Add(cols0);
                var wl = new VisualElement(); wl.style.width = 230; wl.style.flexShrink = 0; wl.style.marginRight = 14; cols0.Add(wl);
                foreach (var x in D.TKList.Where(y => G.tkOpen(y.id)))
                {
                    string id = x.id; var xm = S.mk.tk[id]; double rx = Rr(id); bool sel = id == stkSel;
                    var it = Ui.Box(sel ? Color.Lerp(StkCard, Ui.Accent, 0.28f) : StkCard, 10, 8); it.style.marginBottom = 6; it.style.paddingLeft = 12; it.style.paddingRight = 12; it.style.paddingTop = 6; it.style.paddingBottom = 6;
                    it.style.borderLeftWidth = 4; it.style.borderLeftColor = sel ? Ui.Accent : (Color)StkLine;
                    var nr = Ui.Row(); it.Add(nr);
                    var nm = Ui.Label(x.name, 19, Ui.Text, true); nm.style.flexGrow = 1; nm.style.whiteSpace = WhiteSpace.NoWrap; nm.style.overflow = Overflow.Hidden; nm.style.textOverflow = TextOverflow.Ellipsis; nr.Add(nm);
                    if (G.limitUp(id)) nr.Add(Badge("상", StkUp)); else if (G.limitDn(id)) nr.Add(Badge("하", StkDn));
                    if (xm.warn) nr.Add(Badge("관리", Ui.Bad));
                    var pr0 = Ui.Row(); pr0.style.justifyContent = Justify.SpaceBetween; it.Add(pr0);
                    pr0.Add(Ui.Label(G.fmtP(xm.p), 17, StkAxis)); pr0.Add(Ui.Label(GameSim.pct(rx), 17, UpDn(rx), true));
                    foreach (var ch in it.Children()) ch.pickingMode = PickingMode.Ignore;
                    it.RegisterCallback<ClickEvent>(_ => { stkSel = id; stkAmt = null; stkMsg = ""; RenderAll(); });
                    wl.Add(it);
                }
                body = new VisualElement(); body.style.flexGrow = 1; body.style.flexShrink = 1; body.style.minWidth = 0; cols0.Add(body);
            }
            var strip = Ui.Row(); strip.style.flexWrap = Wrap.Wrap; if (!S.rt) body.Add(strip);
            foreach (var x in D.TKList.Where(y => G.tkOpen(y.id) && !S.rt))
            {
                string id = x.id; double rx = Rr(id);
                var b = Ui.Chip($"{x.name} {GameSim.pct(rx)}", () => { stkSel = id; stkAmt = null; stkMsg = ""; RenderAll(); }, false, id == stkSel ? Ui.Accent : (Color?)null);
                b.Q<Label>().style.color = id == stkSel ? Color.white : UpDn(rx);
                strip.Add(b);
            }

            // 폰 폭이 좁아서 차트 위, 주문창 아래 (주문창은 가로로 두 칸)
            var left = new VisualElement(); body.Add(left);
            var right = Ui.Box(StkCard, 18, 14); right.style.marginTop = 10; Ui.Border(right, StkLine, 2); body.Add(right);

            // 종목 머리
            var th = Ui.Row(); th.style.alignItems = Align.FlexEnd; left.Add(th);
            if (S.rt)
            {   // 좁은 칸: 1줄 이름·배지, 2줄 가격·등락
                var nmL = Ui.Label(t.name, 28, Ui.Text, true); nmL.style.whiteSpace = WhiteSpace.NoWrap; th.Add(nmL);
                th.Add(Badge(isC ? $"{t.cat ?? "코인"} · {t.maxLev:0}x" : t.cat ?? "주식", isC ? Ui.Gold : StkAxis));
                if (G.limitUp(stkSel)) th.Add(Badge("상한가", StkUp)); else if (G.limitDn(stkSel)) th.Add(Badge("하한가", StkDn));
                if (mk.warn) th.Add(Badge("관리종목", Ui.Bad));
                var pr = Ui.Row(); pr.style.alignItems = Align.FlexEnd; left.Add(pr);
                var pl0 = Ui.Label(G.fmtP(mk.p), 36, UpDn(r), true); pl0.style.whiteSpace = WhiteSpace.NoWrap; pr.Add(pl0);
                var rl0 = Ui.Label(" " + GameSim.pct(r), 22, UpDn(r), true); rl0.style.whiteSpace = WhiteSpace.NoWrap; rl0.style.marginBottom = 4; pr.Add(rl0);
                var rf = Ui.Label($"  기준 {G.fmtP(mk.ref0)}" + (t.IsStock ? $" · ±{D.RULES.RT_LIMIT * 100:0}%" : " · 자정"), 16, StkAxis); rf.style.marginBottom = 6; rf.style.whiteSpace = WhiteSpace.NoWrap; pr.Add(rf);
            }
            else th.Add(Ui.Label(t.name, 32, Ui.Text, true));
            if (!S.rt)
            {
                th.Add(Badge(isC ? $"{t.cat ?? "코인"} · 최대 {t.maxLev:0}x" : t.cat ?? "주식", isC ? Ui.Gold : StkAxis));
                var sp0 = new VisualElement(); sp0.style.flexGrow = 1; th.Add(sp0);
                th.Add(Ui.Label(G.fmtP(mk.p), 40, UpDn(r), true));
                var rl = Ui.Label(" " + GameSim.pct(r), 26, UpDn(r), true); th.Add(rl);
                var hi = mk.hist.Count > 0 ? mk.hist.Max(c => c.h) : mk.p; var lo = mk.hist.Count > 0 ? mk.hist.Min(c => c.l) : mk.p;
                left.Add(Ui.Label($"{Ui.Clean(t.d)} · 4칸 {GameSim.pct(SpanR(mk, 4))} · 최근 {mk.hist.Count}칸 고가 {G.fmtP(hi)} / 저가 {G.fmtP(lo)}", 18, StkAxis));
            }

            // 차트 옵션
            var opt = Ui.Row(); opt.style.marginTop = 8; left.Add(opt);
            foreach (var n in S.rt ? new[] { 24, 48, 96 } : new[] { 12, 24, 40 }) { int nn = n; var oc = Ui.Chip(S.rt ? $"{n / 2}h" : $"{n}칸", () => { stkBars = nn; RenderAll(); }, false, stkBars == n ? Ui.Panel2 : StkBg); oc.Q<Label>().style.whiteSpace = WhiteSpace.NoWrap; opt.Add(oc); }
            { var lc = Ui.Chip(stkLineMode ? "라인" : "캔들", () => { stkLineMode = !stkLineMode; RenderAll(); }, false, StkBg); lc.Q<Label>().style.whiteSpace = WhiteSpace.NoWrap; opt.Add(lc); }
            var lg = Ui.Row(); lg.style.marginLeft = 10; opt.Add(lg);
            lg.Add(Ui.Label("MA5 ", 18, CandleChart.Ma5C, true)); lg.Add(Ui.Label("MA20 ", 18, CandleChart.Ma20C, true)); lg.Add(Ui.Label(S.rt ? "· 30분봉" : "· 1봉 = 1칸 · 마우스 올리면 시고저종", 16, StkAxis));
            foreach (var ch in lg.Children()) ch.style.whiteSpace = WhiteSpace.NoWrap;

            // 차트
            if (S.rt && stkBars < 24) stkBars = 48;
            var lines = ChartLines(stkSel);
            string ck = $"{stkSel}|{stkBars}|{stkLineMode}";
            if (S.rt && liveChart != null && liveChartKey == ck)
            {
                liveChart.RemoveFromHierarchy(); left.Add(liveChart); liveChart.Set(mk.p, lines);
            }
            else
            {
                int seen = stkSeen.TryGetValue(stkSel, out var sv) ? sv : -1;
                int nowT = G.Tnow();
                bool grow = !S.rt && seen >= 0 && seen != nowT;
                stkSeen[stkSel] = nowT;
                var chart = new CandleChart(mk.hist, stkBars, mk.p, lines, G.fmtP, stkLineMode);
                chart.style.height = S.rt ? 300 : 340; chart.style.marginTop = 8;
                left.Add(chart);
                if (grow) chart.Grow();
                liveChart = chart; liveChartKey = ck;
            }

            // 포지션 (코인)
            foreach (var c in S.cps.Where(c => c.tk == stkSel)) left.Add(CoinRow(c));
            if (!S.rt) TipCards(left, stkSel);   // 실시간 화면은 주문창이 먼저 보이게 — 정보는 한 줄씩만 (자세한 건 정보 수첩)
            else TipStrip(left, stkSel);

            // 주문창
            OrderPanel(right, t, mk, where, fee);
        }

        VisualElement CoinRow(CoinPos c)
        {
            double pl = G.cpnl(c) + c.bonus; bool lk = !S.rt && c.t0 == G.Tnow(); int id = c.id;
            var row = Ui.Box(StkCard, 12, 10); row.style.flexDirection = FlexDirection.Row; row.style.alignItems = Align.Center; row.style.marginTop = 8; row.style.borderLeftWidth = 4; row.style.borderLeftColor = c.dir > 0 ? StkUp : StkDn;
            var info = new VisualElement(); info.style.flexGrow = 1; row.Add(info);
            info.Add(Ui.Label($"{D.TK[c.tk].name} {c.lev:0}x {(c.dir > 0 ? "롱" : "숏")}{(c.mult > 1 ? " (올인 ×1.5)" : "")}", 22, c.dir > 0 ? StkUp : StkDn, true));
            info.Add(Ui.Label($"증거금 {G.man(c.margin)} · 진입 {G.fmtP(c.entry)} · 청산가 {G.fmtP(GameSim.liqPx(c))}", 18, StkAxis));
            var pv = Ui.Label(G.sgnWon(pl), 24, UpDn(pl), true); pv.style.marginRight = 12; row.Add(pv);
            row.Add(Ui.Chip(lk ? "다음 칸부터" : "정리", () => Order("정리", "익절 ㅋㅋ 나 천재?", "…손절. 괜찮아. 괜찮아.", "close", "id", id), lk));
            return row;
        }

        void OrderPanel(VisualElement right, Ticker t, TkState mk, string where, double fee)
        {
            var R = D.RULES; bool isC = t.IsCoin, open = isC || G.stockOpen();
            if (isC && stkLev > t.maxLev) stkLev = t.maxLev;
            double maxAmt = Math.Max(0, Math.Floor((isC ? S.cash / (1 + stkLev * R.COIN_FEE) : S.cash) / 10000) * 10000);
            if (stkAmt == null) stkAmt = Math.Round(maxAmt * 0.25 / 10000) * 10000;
            stkAmt = Math.Max(0, Math.Min(stkAmt.Value, maxAmt));
            double amt = stkAmt.Value;

            right.Add(Ui.Label(isC ? "코인 주문 · 24시간" : open ? $"주식 주문 · 수수료 {fee * 100:0.0}%" : "주식 주문 · 장 마감", 22, open ? Ui.Gold : StkAxis, true));
            var amtL = Ui.Label(G.won(amt), 40, Ui.Text, true); amtL.style.marginTop = 8; right.Add(amtL);
            right.Add(Ui.Label(isC ? "증거금" : "매수 금액", 18, StkAxis));

            // 금액 막대 (끌어서 조절)
            var track = Ui.Box(StkBg, 0, 10); track.style.height = 26; track.style.marginTop = 10; track.style.marginBottom = 8; Ui.Border(track, StkLine, 2);
            var fill = Ui.Box(isC ? (stkDir > 0 ? StkUp : StkDn) : StkUp, 0, 8); fill.style.height = Length.Percent(100); fill.pickingMode = PickingMode.Ignore; track.Add(fill);
            void SetFrac(float f, bool rerender)
            {
                f = Mathf.Clamp01(f); stkAmt = Math.Floor(maxAmt * f / 10000) * 10000;
                fill.style.width = Length.Percent(maxAmt > 0 ? (float)(stkAmt.Value / maxAmt) * 100 : 0);
                amtL.text = G.won(stkAmt.Value);
                if (rerender) RenderAll();
            }
            fill.style.width = Length.Percent(maxAmt > 0 ? (float)(amt / maxAmt) * 100 : 0);
            if (maxAmt >= 10000 && open)
            {
                track.RegisterCallback<PointerDownEvent>(e => { stkDragging = true; track.CapturePointer(e.pointerId); SetFrac(e.localPosition.x / track.resolvedStyle.width, false); });
                track.RegisterCallback<PointerMoveEvent>(e => { if (track.HasPointerCapture(e.pointerId)) SetFrac(e.localPosition.x / track.resolvedStyle.width, false); });
                track.RegisterCallback<PointerUpEvent>(e => { stkDragging = false; if (track.HasPointerCapture(e.pointerId)) { track.ReleasePointer(e.pointerId); SetFrac(e.localPosition.x / track.resolvedStyle.width, true); } });
                track.RegisterCallback<PointerCaptureOutEvent>(_ => stkDragging = false);
            }
            right.Add(track);
            var q = Ui.Row(); right.Add(q);
            foreach (var (f, l) in new[] { (0.1, "10%"), (0.25, "25%"), (0.5, "50%"), (1.0, isC ? "최대" : "전부") })
            { double ff = f; q.Add(Ui.Chip(l, () => { stkAmt = Math.Floor(maxAmt * ff / 10000) * 10000; RenderAll(); }, !open || maxAmt < 10000)); }

            if (isC)
            {
                var levs = new[] { 1.0, 2, 3, 5, 10, 25, 50 }.Where(l => l <= t.maxLev);
                var lr = Ui.Row(); lr.style.flexWrap = Wrap.Wrap; lr.style.marginTop = 6; right.Add(lr);
                foreach (var l in levs)
                {
                    double ll = l;
                    var b = Ui.Chip($"{l:0}x", () => { stkLev = ll; stkAmt = null; if (ll >= 25) { Toast("미래: " + (ll >= 50 ? "50배!!! 자기 최고야 사랑해" : "오 좀 치네?"), "bubble"); SetFace("happy"); } RenderAll(); }, false,
                        stkLev == l ? (l >= 25 ? (Color)StkUp : Ui.Accent) : (Color?)null);
                    b.style.marginBottom = 6; lr.Add(b);
                }
                var dr = Ui.Row(); dr.style.marginTop = 4; right.Add(dr);
                var lb = Ui.Button("롱 ▲", () => { stkDir = 1; RenderAll(); }, null, false, stkDir > 0 ? StkUp : Ui.Panel2, 26); lb.style.flexGrow = 1; lb.style.marginRight = 8; lb.style.alignItems = Align.Center; dr.Add(lb);
                var sb = Ui.Button("숏 ▼", () => { stkDir = -1; RenderAll(); }, null, false, stkDir < 0 ? StkDn : Ui.Panel2, 26); sb.style.flexGrow = 1; sb.style.alignItems = Align.Center; dr.Add(sb);

                double allin = G.has("allin") && amt * (1 + stkLev * R.COIN_FEE) >= S.cash * 0.95 ? 1.5 : 1;
                double estLiq = mk.p * (1 - stkDir * 0.9 / (stkLev * allin));
                right.Add(Ui.Label($"청산가 ≈ {G.fmtP(estLiq)} ({90 / stkLev:0.0}% 역행)", 20, Ui.Text));
                if (stkLev > 1)
                {
                    double odds = G.liqOdds(stkLev * allin, t.vol * (G.isEve() && G.has("whale") ? 2 : 1));
                    right.Add(Ui.Label($"{(S.rt ? "이번 시간대" : "이번 칸")} 청산 확률 ≈ {odds * 100:0}%", 22, odds >= 0.3 ? StkUp : Ui.Gold, true));
                    right.Add(RiskBar((float)odds));
                }
                right.Add(Ui.Label($"수수료 {G.won(amt * stkLev * R.COIN_FEE)}" + (stkLev > 1 ? $" · 펀딩비 {(S.rt ? "시간대당" : "칸당")} {G.won(amt * stkLev * R.FUNDING)}" : ""), 18, StkAxis));
                if (G.has("allin")) right.Add(Ui.Label("올인 유품: 현금 95% 이상 넣으면 손익 ×1.5", 18, Ui.Gold));
                var go = Ui.Button($"{(stkDir > 0 ? "롱" : "숏")} {stkLev:0}x 진입", () =>
                    Order("진입", stkDir > 0 ? "롱 가즈아아아" : "숏 잡았다. 떨어져라 떨어져라", null, "open", "tk", t.id, "dir", stkDir, "lev", stkLev, "amt", stkAmt ?? 0),
                    $"증거금 {G.man(amt)}", amt < 10000, stkDir > 0 ? StkUp : StkDn, 28);
                go.style.marginTop = 12; go.style.alignItems = Align.Center; right.Add(go);
            }
            else
            {
                var buy = Ui.Button("매수", () => Order("매수", "가즈아. 이건 우상향이다 (희망)", null, "buy", "tk", t.id, "amt", stkAmt ?? 0, "where", where),
                    open ? $"{G.won(amt)} · 수수료 {G.won(amt * fee)}" : S.rt ? "장 마감 (09:00~15:30)" : "장 마감 (아침·점심만)", amt < 10000 || !open, StkUp, 28);
                buy.style.marginTop = 12; buy.style.alignItems = Align.Center; right.Add(buy);
                var h = S.hold.Get(t.id);
                if (h != null && h.q > 0)
                {
                    double hv = h.q * mk.p, pl = hv - h.cost;
                    var box = Ui.Box(StkBg, 12, 10); box.style.marginBottom = 10; right.Add(box);
                    box.Add(Ui.Label($"보유 {h.q:0.##}주 · 평단 {G.fmtP(h.cost / h.q)}", 19, Ui.Text));
                    box.Add(Ui.Label($"평가 {G.won(hv)}", 19, Ui.Text));
                    box.Add(Ui.Label($"{G.sgnWon(pl)} ({GameSim.pct(hv / h.cost - 1)})", 26, UpDn(pl), true));
                    if (!S.rt) box.Add(Ui.Label($"{G.Tnow() - h.t0}칸 보유", 17, StkAxis));
                }
                else right.Add(Ui.Label("보유 없음", 20, StkAxis));
                var sr = Ui.Row(); right.Add(sr);
                bool can = h != null && open;
                var half = Ui.Button("절반 매도", () => Order("절반 매도", "익절은 과학이다", "손절도 과학이다 (눈물)", "sell", "tk", t.id, "frac", 0.5, "where", where), null, !can, StkDn, 22);
                half.style.flexGrow = 1; half.style.marginRight = 8; half.style.alignItems = Align.Center; sr.Add(half);
                var all = Ui.Button("전량 매도", () => Order("전량 매도", "익절은 과학이다", "손절도 과학이다 (눈물)", "sell", "tk", t.id, "frac", 1, "where", where), null, !can, StkDn, 22);
                all.style.flexGrow = 1; all.style.alignItems = Align.Center; sr.Add(all);
            }
        }

        static VisualElement RiskBar(float p)
        {
            var bar = Ui.Box(StkBg, 0, 6); bar.style.height = 12; bar.style.marginTop = 4; bar.style.marginBottom = 8;
            var f = Ui.Box(Color.Lerp(Ui.Gold, StkUp, p * 2), 0, 6); f.style.height = Length.Percent(100); f.style.width = Length.Percent(Mathf.Clamp01(p) * 100); bar.Add(f);
            return bar;
        }

        // ---------- 내 계좌 ----------
        void StkAcct(VisualElement body, string where)
        {
            double hv = G.holdVal(), pl = G.unreal(), tot = S.realized + pl, ret = S.invIn != 0 ? tot / S.invIn : 0;
            var cards = Ui.Row(); cards.style.flexWrap = Wrap.Wrap; body.Add(cards);
            void Card(string k, string v, Color c)
            {
                var b = Ui.Box(StkCard, 14, 12); b.style.marginRight = 10; b.style.marginBottom = 10; b.style.minWidth = 200;
                b.Add(Ui.Label(k, 18, StkAxis)); b.Add(Ui.Label(v, 28, c, true)); cards.Add(b);
            }
            Card("현금", G.won(S.cash), Ui.Text);
            Card("평가액", G.won(hv), Ui.Text);
            Card("평가손익", G.sgnWon(pl), UpDn(pl));
            Card("실현손익 누적", G.sgnWon(S.realized), UpDn(S.realized));
            Card("투입금 대비", GameSim.pct(ret), UpDn(ret));

            var eh = Ui.Label($"누적 투자손익 (실현+평가, {(S.rt ? "시간대마다" : "칸마다")}) · 투입 원금 누적 {G.won(S.invIn)}", 20, Ui.Gold, true); eh.style.marginTop = 6; body.Add(eh);
            var pts = S.eqh.Select(p => p.v).Concat(new[] { tot }).ToList();
            var eq = new LineChart(pts, true, v => G.sgnMan(v)); eq.style.height = 220; eq.style.marginTop = 6; eq.style.marginBottom = 12;
            body.Add(eq);

            var ph = Ui.Row(); ph.style.marginBottom = 6; body.Add(ph);
            ph.Add(Ui.Label("보유 포지션", 22, Ui.Gold, true));
            if (S.cps.Any(c => S.rt || c.t0 != G.Tnow())) { var b = Ui.Chip("코인 전부 정리", () => Order("코인 정리", "다 정리함. 이제 현금이 왕", "다 정리함… 현금이라도 남았네", "closeCoins")); b.style.marginLeft = 12; ph.Add(b); }
            int n = 0;
            foreach (var k in G.STK().Where(k => S.hold.Has(k)).ToList())
            {
                var x = S.hold[k]; double v = x.q * S.mk.tk[k].p; string kk = k;
                var row = Ui.Box(StkCard, 12, 10); row.style.flexDirection = FlexDirection.Row; row.style.alignItems = Align.Center; row.style.marginBottom = 8; row.style.borderLeftWidth = 4; row.style.borderLeftColor = UpDn(v - x.cost);
                var info = new VisualElement(); info.style.flexGrow = 1; row.Add(info);
                info.Add(Ui.Label($"{D.TK[k].name} · 주식", 22, Ui.Text, true));
                info.Add(Ui.Label($"{G.man(x.cost)} → {G.man(v)}" + (S.rt ? "" : $" · {G.Tnow() - x.t0}칸 보유"), 18, StkAxis));
                var pv = Ui.Label(G.sgnWon(v - x.cost), 24, UpDn(v - x.cost), true); pv.style.marginRight = 12; row.Add(pv);
                row.Add(Ui.Chip(G.stockOpen() ? "전량 매도" : "장 마감", () => Order("전량 매도", "익절은 과학이다", "손절도 과학이다 (눈물)", "sell", "tk", kk, "frac", 1, "where", where), !G.stockOpen()));
                body.Add(row); n++;
            }
            foreach (var c in S.cps.ToList()) { body.Add(CoinRow(c)); n++; }
            if (n == 0) body.Add(Ui.Label("없음. 미래: \"현금 들고 있으면 인플레이션한테 지는 거임\" (빚은 더 빨리 큼)", 20, StkAxis));
        }
    }

    /// 캔들(또는 라인) + 이동평균 5·20 + 거래량 + 가격선(평단·진입·청산가) + 현재가 꼬리표 + 마우스 십자선
    class CandleChart : VisualElement
    {
        public static readonly Color Ma5C = new Color32(0xff, 0xd1, 0x66, 0xff);
        public static readonly Color Ma20C = new Color32(0xb4, 0x8c, 0xff, 0xff);
        const float PadL = 8, PadR = 150, PadT = 14, PadB = 26, VolH = 70, Gap = 10;

        readonly List<Candle> all; readonly int bars; int n, off; double last;
        List<(double y, Color c, string l)> lines; readonly Func<double, string> fmt; readonly bool lineMode;
        double[] ma5, ma20;
        double lo, hi; int hover = -1; float grow = 1;
        readonly VisualElement labels; readonly Label tip;

        public CandleChart(List<Candle> hist, int bars, double lastPx, List<(double y, Color c, string l)> lines, Func<double, string> fmt, bool lineMode)
        {
            all = hist; this.bars = bars; this.fmt = fmt; this.lineMode = lineMode;
            style.backgroundColor = (Color)new Color32(0x0d, 0x0f, 0x16, 0xff); Ui.Radius(this, 10); style.overflow = Overflow.Hidden;
            labels = new VisualElement(); Ui.Fill(labels); labels.pickingMode = PickingMode.Ignore; Add(labels);
            tip = Ui.Label("", 18, Ui.Text, true); Ui.Abs(tip, 14, 10); tip.style.backgroundColor = new Color(0.05f, 0.06f, 0.1f, 0.92f); Ui.Pad(tip, 8); Ui.Radius(tip, 8);
            tip.pickingMode = PickingMode.Ignore; tip.style.display = DisplayStyle.None; Add(tip);

            Recalc(lastPx, lines);
            generateVisualContent += Draw;
            RegisterCallback<GeometryChangedEvent>(_ => Relabel());
            RegisterCallback<PointerMoveEvent>(e => { int h = IndexAt(e.localPosition.x); if (h != hover) { hover = h; Hover(); } });
            RegisterCallback<PointerLeaveEvent>(_ => { hover = -1; Hover(); });
        }

        /// 봉 목록(같은 List, sim 이 실시간으로 늘림)·현재가·가격선이 바뀌면 다시 계산
        void Recalc(double lastPx, List<(double y, Color c, string l)> ls)
        {
            last = lastPx; lines = ls;
            n = Math.Max(1, bars); off = Math.Max(0, all.Count - n);
            ma5 = Ma(5); ma20 = Ma(20);
            lo = double.MaxValue; hi = double.MinValue;
            for (int i = off; i < all.Count; i++) { lo = Math.Min(lo, all[i].l); hi = Math.Max(hi, all[i].h); }
            if (all.Count == off) { lo = hi = last; }
            // 가격선은 화면 근처일 때만 범위에 넣음 (상·하한가 ±30% 가 차트를 납작하게 만들지 않게)
            double c0 = Math.Max(hi - lo, last * 0.01);
            foreach (var L in lines) if (L.y >= lo - c0 * 0.6 && L.y <= hi + c0 * 0.6) { lo = Math.Min(lo, L.y); hi = Math.Max(hi, L.y); }
            double span = Math.Max(hi - lo, last * 0.01), mid = (hi + lo) / 2; lo = mid - span * 0.56; hi = mid + span * 0.56;
            if (hover >= all.Count) hover = -1;
        }
        public void Set(double lastPx, List<(double y, Color c, string l)> ls)
        {
            Recalc(lastPx, ls);
            Relabel(); MarkDirtyRepaint();
            if (hover >= 0) Hover();
        }

        double[] Ma(int k)
        {
            var m = new double[all.Count]; double s = 0;
            for (int i = 0; i < all.Count; i++) { s += all[i].c; if (i >= k) s -= all[i - k].c; m[i] = i >= k - 1 ? s / k : double.NaN; }
            return m;
        }

        /// 새 칸: 마지막 봉이 시가에서 종가까지 자라남
        public void Grow()
        {
            grow = 0; float t0 = Time.unscaledTime;
            schedule.Execute(() => { grow = Mathf.Clamp01((Time.unscaledTime - t0) / 0.7f); MarkDirtyRepaint(); }).Until(() => grow >= 1);
        }

        float W => contentRect.width; float Hh => contentRect.height;
        float PriceBottom => Hh - PadB - VolH - Gap;
        float Cw => (W - PadL - PadR) / n;
        float X(int i) => PadL + (i - off) * Cw + Cw / 2;
        float Y(double v) => PadT + (float)((hi - v) / (hi - lo)) * (PriceBottom - PadT);
        int IndexAt(float x) { if (x < PadL || x > W - PadR) return -1; int i = off + (int)((x - PadL) / Cw); return i >= off && i < all.Count ? i : -1; }

        Candle Bar(int i)
        {
            var b = all[i];
            if (i != all.Count - 1 || grow >= 1) return b;
            float g = 1 - (1 - grow) * (1 - grow);
            double c = b.o + (b.c - b.o) * g;
            return new Candle { o = b.o, c = c, h = Math.Max(Math.Max(b.o, c), b.o + (b.h - b.o) * g), l = Math.Min(Math.Min(b.o, c), b.o + (b.l - b.o) * g) };
        }

        void Draw(MeshGenerationContext ctx)
        {
            if (W <= PadL + PadR || Hh <= PadT + PadB + VolH) return;
            if (ma5.Length != all.Count) Recalc(last, lines);   // sim 이 봉을 늘린 뒤 아직 Set 안 받았으면
            var p = ctx.painter2D;
            // 격자
            p.lineWidth = 1; p.strokeColor = new Color32(0x1c, 0x20, 0x30, 0xff);
            for (int k = 0; k <= 4; k++) { float y = PadT + k * (PriceBottom - PadT) / 4; Seg(p, PadL, y, W - PadR, y); }
            float vt = PriceBottom + Gap; Seg(p, PadL, vt, W - PadR, vt);

            // 거래량 (봉 크기로 추정)
            double vmax = 1e-9; var vol = new double[all.Count];
            for (int i = off; i < all.Count; i++) { var b = all[i]; vol[i] = (b.h - b.l) / Math.Max(1e-9, b.o) + 2 * Math.Abs(b.c - b.o) / Math.Max(1e-9, b.o); vmax = Math.Max(vmax, vol[i]); }
            for (int i = off; i < all.Count; i++)
            {
                var b = Bar(i); float h = (float)(vol[i] / vmax) * (VolH - 6) * (i == all.Count - 1 ? grow : 1);
                var c = b.c >= b.o ? Up : Dn; c.a = 0.45f;
                Rect(p, X(i) - Cw * 0.34f, Hh - PadB - h, Cw * 0.68f, h, c);
            }

            if (lineMode)
            {
                p.strokeColor = last >= (all.Count > off ? all[off].o : last) ? Up : Dn; p.lineWidth = 3; p.lineJoin = LineJoin.Round;
                p.BeginPath();
                for (int i = off; i < all.Count; i++) { var pt = new Vector2(X(i), Y(Bar(i).c)); if (i == off) p.MoveTo(pt); else p.LineTo(pt); }
                p.Stroke();
            }
            else
                for (int i = off; i < all.Count; i++)
                {
                    var b = Bar(i); var c = b.c >= b.o ? Up : Dn; float x = X(i);
                    p.strokeColor = c; p.lineWidth = 2; Seg(p, x, Y(b.h), x, Y(b.l));
                    float y1 = Y(Math.Max(b.o, b.c)), y2 = Y(Math.Min(b.o, b.c));
                    Rect(p, x - Cw * 0.34f, y1, Cw * 0.68f, Mathf.Max(2, y2 - y1), c);
                }

            // 이동평균
            Poly(p, ma5, CandleChart.Ma5C); Poly(p, ma20, CandleChart.Ma20C);

            // 가격선
            foreach (var L in lines) { if (L.y < lo || L.y > hi) continue; p.strokeColor = L.c; p.lineWidth = 2; Dash(p, PadL, Y(L.y), W - PadR, Y(L.y)); }
            p.strokeColor = new Color(1, 1, 1, 0.35f); p.lineWidth = 1; Dash(p, PadL, Y(last), W - PadR, Y(last));

            // 십자선
            if (hover >= 0)
            {
                p.strokeColor = new Color(1, 1, 1, 0.3f); p.lineWidth = 1;
                Seg(p, X(hover), PadT, X(hover), Hh - PadB);
                Rect(p, X(hover) - Cw / 2, PadT, Cw, Hh - PadB - PadT, new Color(1, 1, 1, 0.05f));
            }
        }

        static readonly Color Up = new Color32(0xff, 0x4d, 0x5e, 0xff);
        static readonly Color Dn = new Color32(0x4e, 0x8c, 0xff, 0xff);

        void Poly(Painter2D p, double[] m, Color c)
        {
            p.strokeColor = c; p.lineWidth = 2; p.lineJoin = LineJoin.Round; bool started = false;
            p.BeginPath();
            for (int i = off; i < all.Count; i++)
            {
                if (double.IsNaN(m[i])) continue;
                var pt = new Vector2(X(i), Y(m[i]));
                if (!started) { p.MoveTo(pt); started = true; } else p.LineTo(pt);
            }
            if (started) p.Stroke();
        }
        static void Seg(Painter2D p, float x0, float y0, float x1, float y1) { p.BeginPath(); p.MoveTo(new Vector2(x0, y0)); p.LineTo(new Vector2(x1, y1)); p.Stroke(); }
        static void Dash(Painter2D p, float x0, float y, float x1, float y1)
        {
            for (float x = x0; x < x1; x += 18) Seg(p, x, y, Mathf.Min(x + 10, x1), y);
        }
        static void Rect(Painter2D p, float x, float y, float w, float h, Color c)
        {
            p.fillColor = c; p.BeginPath();
            p.MoveTo(new Vector2(x, y)); p.LineTo(new Vector2(x + w, y)); p.LineTo(new Vector2(x + w, y + h)); p.LineTo(new Vector2(x, y + h)); p.ClosePath();
            p.Fill();
        }

        void Relabel()
        {
            labels.Clear();
            if (W <= PadL + PadR) return;
            Label L(string t, float x, float y, Color c, float size = 17, bool bold = false) { var l = Ui.Label(t, size, c, bold); Ui.Abs(l, x, y); l.pickingMode = PickingMode.Ignore; labels.Add(l); return l; }
            var axis = new Color32(0x6b, 0x71, 0x86, 0xff);
            for (int k = 0; k <= 4; k++) { float y = PadT + k * (PriceBottom - PadT) / 4; L(fmt(hi - k * (hi - lo) / 4), W - PadR + 8, y - 11, axis); }
            L("거래량", PadL + 4, PriceBottom + Gap + 2, axis, 15);
            for (int i = all.Count - 1, k = 0; i >= off; i -= 6, k += 6) L(k == 0 ? "지금" : $"-{k}봉", X(i) - 16, Hh - PadB + 4, axis, 15);
            foreach (var Ln in lines)
            {
                if (Ln.y < lo || Ln.y > hi) continue;
                var l = L(Ln.l, PadL + 6, Y(Ln.y) - 24, Ln.c, 17, true);
                l.style.backgroundColor = new Color(0.05f, 0.06f, 0.1f, 0.8f); l.style.paddingLeft = 4; l.style.paddingRight = 4;
            }
            // 현재가 꼬리표
            var tag = L(fmt(last), W - PadR + 2, Y(last) - 14, Color.black, 18, true); tag.style.whiteSpace = WhiteSpace.NoWrap;
            tag.style.backgroundColor = (Color)new Color32(0xe8, 0xea, 0xf2, 0xff); tag.style.paddingLeft = 6; tag.style.paddingRight = 6; tag.style.paddingTop = 2; tag.style.paddingBottom = 2; Ui.Radius(tag, 4);
            tag.style.width = PadR - 6;
        }

        void Hover()
        {
            MarkDirtyRepaint();
            if (hover < 0 || hover >= all.Count) { hover = -1; tip.style.display = DisplayStyle.None; return; }
            if (ma5.Length != all.Count) Recalc(last, lines);
            var b = all[hover]; double r = b.c / b.o - 1; int ago = all.Count - 1 - hover;
            tip.text = $"{(ago == 0 ? "지금 봉" : $"{ago}봉 전")}  시 {fmt(b.o)}  고 {fmt(b.h)}  저 {fmt(b.l)}  종 {fmt(b.c)}  {GameSim.pct(r)}"
                + (!double.IsNaN(ma5[hover]) ? $"  MA5 {fmt(ma5[hover])}" : "");
            tip.style.color = r >= 0 ? Up : Dn;
            tip.style.display = DisplayStyle.Flex;
        }
    }

    /// 선 그래프: 스파크라인(축 없음) 또는 0 기준선 + 위아래 값 표시 (누적 손익)
    class LineChart : VisualElement
    {
        readonly List<double> v; readonly bool zero; readonly Func<double, string> fmt;
        static readonly Color Up = new Color32(0xff, 0x4d, 0x5e, 0xff), Dn = new Color32(0x4e, 0x8c, 0xff, 0xff);

        public LineChart(List<double> values, bool zeroLine, Func<double, string> fmt)
        {
            v = values; zero = zeroLine; this.fmt = fmt; pickingMode = PickingMode.Ignore;
            if (zero) { style.backgroundColor = (Color)new Color32(0x0d, 0x0f, 0x16, 0xff); Ui.Radius(this, 10); }
            generateVisualContent += Draw;
            if (fmt != null) RegisterCallback<GeometryChangedEvent>(_ => Relabel());
        }

        float Pad => zero ? 16 : 2; float PadR => fmt != null ? 120 : 2;
        (double lo, double hi) Range()
        {
            double lo = v.Count > 0 ? v.Min() : 0, hi = v.Count > 0 ? v.Max() : 0;
            if (zero) { lo = Math.Min(0, lo); hi = Math.Max(0, hi); if (hi - lo < 1e5) { hi += 5e4; lo -= 5e4; } }
            else if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
            return (lo, hi);
        }
        float X(int i) => Pad + (v.Count <= 1 ? 0 : (float)i / (v.Count - 1)) * (contentRect.width - Pad - PadR);
        float Y(double x, double lo, double hi) => Pad + (float)((hi - x) / (hi - lo)) * (contentRect.height - Pad * 2);

        void Draw(MeshGenerationContext ctx)
        {
            if (v.Count < 2 || contentRect.width < 10) return;
            var (lo, hi) = Range(); var p = ctx.painter2D;
            double baseV = zero ? 0 : v[0]; bool up = v[v.Count - 1] >= baseV; var c = up ? Up : Dn;
            float yb = zero ? Y(0, lo, hi) : contentRect.height;
            // 아래 채움
            var fc = c; fc.a = 0.14f; p.fillColor = fc;
            p.BeginPath(); p.MoveTo(new Vector2(X(0), yb));
            for (int i = 0; i < v.Count; i++) p.LineTo(new Vector2(X(i), Y(v[i], lo, hi)));
            p.LineTo(new Vector2(X(v.Count - 1), yb)); p.ClosePath(); p.Fill();
            if (zero)
            {
                p.strokeColor = new Color32(0x2e, 0x33, 0x46, 0xff); p.lineWidth = 1;
                for (float x = Pad; x < contentRect.width - PadR; x += 18) { p.BeginPath(); p.MoveTo(new Vector2(x, yb)); p.LineTo(new Vector2(Mathf.Min(x + 10, contentRect.width - PadR), yb)); p.Stroke(); }
            }
            p.strokeColor = c; p.lineWidth = zero ? 3 : 2.5f; p.lineJoin = LineJoin.Round;
            p.BeginPath();
            for (int i = 0; i < v.Count; i++) { var pt = new Vector2(X(i), Y(v[i], lo, hi)); if (i == 0) p.MoveTo(pt); else p.LineTo(pt); }
            p.Stroke();
            // 끝점
            p.fillColor = c; p.BeginPath(); p.Arc(new Vector2(X(v.Count - 1), Y(v[v.Count - 1], lo, hi)), 5, Angle.Degrees(0), Angle.Degrees(360)); p.Fill();
        }

        void Relabel()
        {
            Clear();
            if (v.Count < 2) { var e = Ui.Label("아직 기록 없음 — 칸이 지나면 그려짐", 20, new Color32(0x6b, 0x71, 0x86, 0xff)); Ui.Abs(e, 20, contentRect.height / 2 - 12); Add(e); return; }
            var (lo, hi) = Range(); var axis = new Color32(0x6b, 0x71, 0x86, 0xff);
            void L(string t, double y) { var l = Ui.Label(t, 17, axis); Ui.Abs(l, contentRect.width - PadR + 8, Y(y, lo, hi) - 11); l.pickingMode = PickingMode.Ignore; Add(l); }
            L(fmt(hi), hi); L(fmt(lo), lo); if (zero && hi > 0 && lo < 0) L("0", 0);
        }
    }
}
