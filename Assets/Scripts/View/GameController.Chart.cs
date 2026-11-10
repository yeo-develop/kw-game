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
        internal static readonly Color StkUp = new Color32(0xff, 0x4d, 0x5e, 0xff);
        internal static readonly Color StkDn = new Color32(0x4e, 0x8c, 0xff, 0xff);
        /// 등락이 정확히 0 (보합): 빨강·파랑 어느 쪽도 아님 → 축 글자보다 밝은 회색
        internal static readonly Color StkFlat = new Color32(0xc3, 0xc7, 0xd3, 0xff);
        static readonly Color StkBg = new Color32(0x0d, 0x0f, 0x16, 0xff);
        static readonly Color StkCard = new Color32(0x17, 0x1a, 0x26, 0xff);
        static readonly Color StkLine = new Color32(0x2a, 0x2f, 0x42, 0xff);
        /// 보조 글자·차트 축 (배경 StkCard 위 명암비 5.4 · StkBg 위 6.0)
        internal static readonly Color StkAxis = new Color32(0x8a, 0x90, 0xa6, 0xff);
        /// 등락·손익 색 (한국식: 이익·상승 빨강 · 손실·하락 파랑 · 0 회색) — 폰·차트·알바 구석 손익 공용
        internal static Color UpDn(double v) => v > 0 ? StkUp : v < 0 ? StkDn : StkFlat;

        string stkTab = "mkt", stkSel, stkMsg = "", stkCat = "all";
        float rptArm = -10; string rptArmId;   // 유료 리포트 확인 대기 (누른 시각 · v4: 어느 분석가)
        double? stkAmt; double stkSellF = 1; double stkLev = 10; double stkSl, stkTp; int stkDir = 1, stkBars = 40; bool stkLineMode;
        /// 주문 바: 부가 정보(예약·청산가) 펼침 · 결과 줄이 실패인가 · 실패한 시각(버튼 흔들림) · 예약을 고치는 중인 포지션 id
        bool stkMore, stkMsgBad; float stkFailT = -10; int stkStopEdit;
        /// 위험한 조작 확인 대기 (rptArm 과 같은 방식: 첫 누름에 글자가 바뀌고 4초 뒤 풀림). 키 = 무엇을 할지 (금액·배율이 바뀌면 다시 확인)
        float ordArm = -10; string ordArmKey;
        bool OrdArmed(string key) => ordArmKey == key && Time.realtimeSinceStartup - ordArm < 4;
        /// danger 면 두 번 눌러야 act 실행, 아니면 바로
        Action Confirm(string key, bool danger, Action act) => () =>
        {
            if (!danger || OrdArmed(key)) { ordArm = -10; ordArmKey = null; act(); }
            else { ordArm = Time.realtimeSinceStartup; ordArmKey = key; RenderAll(); }
        };
        /// 결과 금액은 만 단위 (시세는 그대로 fmtP)
        string ManW(double v) => G.man(v) + "원";
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
            DeskChartTick();   // 장 보기 데스크의 큰 차트 (GameController.Desk.cs)
            if (liveChart == null || liveChart.panel == null || stkSel == null || !S.mk.tk.Has(stkSel)) return;
            liveChart.Set(S.mk.tk[stkSel].p, ChartLines(stkSel));
        }

        /// dock: 차트·주문 탭의 주문 바를 붙일 곳 (폰이면 스크롤 밖 아래). null 이면 body 맨 아래
        void StockApp(VisualElement body, string where, VisualElement dock = null)
        {
            var R = D.RULES; double fee = G.stockFee(where) + G.sickSlip();   // 아프면 손 떨림만큼 더 잃음
            // 위: 시세 띠 (전 종목 등락이 흘러감). 실시간 차트 화면엔 관심종목 목록이 있어서 생략
            if (!(S.rt && stkTab == "detail")) body.Add(TickerTape());

            var head = Ui.Row(); head.style.flexWrap = Wrap.Wrap; head.style.marginTop = 14; head.style.marginBottom = 10; body.Add(head);
            foreach (var (k, n) in new[] { ("mkt", "시세"), ("detail", "차트·주문"), ("acct", "내 계좌") })
            {
                var kk = k; head.Add(Ui.Chip(n, () => { stkTab = kk; stkMsg = ""; RenderAll(); }, false, stkTab == k ? Ui.Accent : (Color?)null));
            }
            var rs = G.rsch();
            bool rptSlot = !G.v4 || S.pending?.t == "watch";   // v4: 리포트는 장 보기 칸에서만 → 잠긴 이유를 칩에
            var ans = G.analysts();
            head.Add(Ui.Chip(!rptSlot ? "무료 리포트 · 장 보기 칸에서" : ans.Count > 0 ? G.T("v4.an.free", "a", rs.free, "b", G.freeMax()) : $"무료 리포트 {rs.free}/{G.freeMax()}", () => { onSent = ReportMsg; Send("report", "paid", false); }, rs.free >= G.freeMax() || !rptSlot));
            if (ans.Count > 0)
            {   // v4: 분석가 골라서 묻기 (유료). 분석가마다 실력이 다름 → 전적이 유일한 단서. 장 보기 칸에서만
                double rf = R.RT_RSCH_FEE; bool dis = rs.paid >= R.RSCH_PAID_MAX || S.cash < rf || !rptSlot;
                if (!rptSlot) head.Add(Ui.Chip("유료 리포트 · 장 보기 칸에서", () => { }, true));
                else
                {
                    var strip = Ui.Row(); strip.style.flexWrap = Wrap.Wrap; strip.style.alignItems = Align.Center; strip.style.marginBottom = 4; body.Add(strip);
                    var hd = Ui.Label($"골라서 묻기 {G.man(rf)} ({rs.paid}/{R.RSCH_PAID_MAX})", 18, StkAxis, true); hd.style.marginRight = 8; strip.Add(hd);
                    foreach (var a in ans)
                    {   // 분석가마다 칩 하나: 이름 + 전적. 두 번 눌러야 삼 (분석가별로 따로 대기)
                        string aid = a.id; bool armed = rptArmId == aid && Time.realtimeSinceStartup - rptArm < 4;
                        var pb = Ui.Chip(armed && !dis ? $"{a.name} — 한 번 더 누르기" : $"{a.name} {G.srcRec(aid)}",
                            () => { if (rptArmId == aid && Time.realtimeSinceStartup - rptArm < 4) { rptArm = -10; rptArmId = null; onSent = ReportMsg; Send("report", "paid", true, "who", aid); } else { rptArm = Time.realtimeSinceStartup; rptArmId = aid; RenderAll(); } },
                            dis, armed && !dis ? (Color?)Ui.Bad : null);
                        pb.tooltip = a.flav; pb.style.marginBottom = 4; strip.Add(pb);
                    }
                    if (stkTab == "mkt") { var hl = Ui.Label(G.T("v4.an.help"), 20, Ui.Dim); hl.style.whiteSpace = WhiteSpace.Normal; hl.style.marginBottom = 8; body.Add(hl); }
                }
            }
            else
            {   // 유료는 두 번 눌러야 삼 (피드백: 막 누르다 10만 원씩 증발)
                double rf = S.rt ? R.RT_RSCH_FEE : R.RSCH_FEE; bool armed = Time.realtimeSinceStartup - rptArm < 4;
                bool dis = rs.paid >= R.RSCH_PAID_MAX || S.cash < rf || G.v4 && S.pending?.t != "watch";
                var pc = Ui.Chip(!rptSlot ? "유료 리포트 · 장 보기 칸에서" : dis ? $"유료 리포트 {G.man(rf)} ({rs.paid}/{R.RSCH_PAID_MAX})" : armed ? $"{ManW(rf)} 냄? 한 번 더 누르기" : $"유료 리포트 {G.man(rf)} ({rs.paid}/{R.RSCH_PAID_MAX})",
                    () => { if (Time.realtimeSinceStartup - rptArm < 4) { rptArm = -10; onSent = ReportMsg; Send("report", "paid", true); } else { rptArm = Time.realtimeSinceStartup; RenderAll(); } },
                    dis, armed && !dis ? (Color?)Ui.Bad : null);
                head.Add(pc);
            }

            double pl = G.unreal();
            var sum = Ui.Row(); sum.style.flexWrap = Wrap.Wrap; sum.style.marginBottom = 10; body.Add(sum);
            void Sum(string k, string v, Color c) { var b = Ui.Row(); b.style.marginRight = 22; var kl = Ui.Label(k, 20, StkAxis); kl.style.marginRight = 6; b.Add(kl); b.Add(Ui.Label(v, 22, c, true)); sum.Add(b); }
            Sum("현금", ManW(S.cash), Ui.Text);
            Sum("평가", ManW(G.holdVal()), Ui.Text);
            if (G.hasPos()) Sum("평가손익", G.sgnMan(pl), UpDn(pl));
            Sum(G.stockOpen() ? "● 주식장" : "○ 주식장", G.stockOpen() ? $"열림 · 수수료 {fee * 100:0.0}%" : S.rt ? "마감 (09:00~15:30)" : "마감 (아침·점심만)", G.stockOpen() ? Ui.Text : StkAxis);   // 열림 = 흰색 (빨강은 상승 전용)
            Sum("코인", "24시간", Ui.Gold);
            if (G.sickName() != null) Sum(G.sickName(), $"손 떨림 · 체결 −{G.sickSlip() * 100:0.0}%p (코인은 배율당 {G.sickSlip() * 20:0.0}%p)", Ui.Bad);
            ReportList(body);
            if (stkTab == "mkt") body.Add(MsgLine());   // 차트·주문 탭은 주문 바 안 (버튼 바로 위) · 내 계좌는 보유 포지션 머리 아래

            if (stkTab == "detail") StkDetail(body, where, fee, dock);
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
            bool paid = e != null && e["paid"] is bool pd && pd;
            var an = tp != null && G.srcOf(tp).an ? G.srcOf(tp) : null;   // v4: 누가 썼나 (분석가)
            // 분석가 이름만 (이모지 아이콘은 글꼴에 없어 지워지면서 "리포트( 이름)" 빈칸이 생김)
            stkMsg = tp != null ? $"리포트{(an != null ? $"({an.name})" : "")}: {D.TK[tp.tk].name} {(tp.dir > 0 ? "▲ 오른다" : "▼ 내린다")} · {G.tipWhen(tp)}" : "리포트 못 받음 (오늘 다 씀 / 현금 부족)";
            stkMsgBad = tp == null;
            // 돈 나간 것·받은 내용이 확실히 보이게 큰 알림
            if (tp != null) Toast((paid ? $"유료 리포트 −{ManW(S.rt ? D.RULES.RT_RSCH_FEE : D.RULES.RSCH_FEE)}\n" : "무료 리포트\n") + (an != null ? $"{an.name} · 전적 {G.srcRec(an.id)}\n" : "") + $"{D.TK[tp.tk].name} {(tp.dir > 0 ? "▲ 오른다" : "▼ 내린다")} · {G.tipWhen(tp)}", paid ? "big" : "good");
            else { Toast(stkMsg, "liq"); OrderFailed(); }
        }

        /// 오늘 받은 리포트 (증권사 리서치) — 받은 게 화면에 남아 있어야 또 안 삼
        void ReportList(VisualElement body)
        {
            int day = G.Tnow() / D.RULES.SLOTS;
            var list = S.tips.Where(x => (x.who == "리서치" || G.srcOf(x).an) && x.T0 / D.RULES.SLOTS == day).ToList();
            if (list.Count == 0) return;
            var box = Ui.Row(); box.style.flexWrap = Wrap.Wrap; box.style.alignItems = Align.Center; box.style.marginBottom = 6; body.Add(box);
            box.Add(Ui.Label("오늘 받은 리포트", 18, StkAxis, true));
            foreach (var x in list)
            {   // 칩 = 누가 썼나(이름 + 전적 "6/10") · 종목 · 방향 · 기한 · 결과. 누르면 그 종목 차트·주문으로
                string res = string.IsNullOrEmpty(x.res) ? "" : x.res == "hit" ? " · 적중" : " · 빗나감";
                string rec = S.srcStat.TryGetValue(x.who ?? "", out var g) && g[1] != 0 ? $" {g[0]}/{g[1]}" : "";
                string tk = x.tk; bool can = G.tkOpen(tk);
                var c = Ui.Chip($"{G.srcOf(x).name}{rec} · {D.TK[tk].name} {(x.dir > 0 ? "▲" : "▼")} {G.tipWhen(x)}{res}" + (can ? " ›" : ""),
                    () => { stkSel = tk; stkTab = "detail"; stkAmt = null; stkMsg = ""; RenderAll(); }, !can, StkCard);
                c.Q<Label>().style.color = x.dir > 0 ? StkUp : StkDn;
                c.style.marginLeft = 8; c.style.marginBottom = 4; c.style.paddingTop = 4; c.style.paddingBottom = 4;
                box.Add(c);
            }
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
                stkMsg = !ok ? $"{what} 실패 ({OrderFailWhy(evs, kv[0] as string, kv)})"
                    : op == "buy" ? $"체결: {tkn} {ManW(e.Num("amt"))} 매수"
                    : op == "open" ? $"체결: {tkn} {e.Num("lev"):0}x {(e.Num("dir") > 0 ? "롱" : "숏")} · 증거금 {ManW(e.Num("margin"))}"
                    : $"체결: {tkn} {what} {G.sgnMan(pnl)}";
                stkMsgBad = !ok;
                if (!ok) { OrderFailed(); return; }
                if (op == "open") { stkSl = 0; stkTp = 0; }   // 예약 칩은 주문마다 새로 고름 (지난 주문 것이 조용히 따라붙지 않게)
                bool good = op == "buy" || op == "open" || pnl >= 0;
                string line = good ? bubbleOk : bubbleBad;
                if (line != null) MiraiLine(line, good ? (op == "buy" || op == "open" ? "smug" : "happy") : "cry");
            };
            Send(new SimCommand(kv[0] as string, kv.Skip(1).ToArray()));
        }

        /// 실패: 거절음 + 주문 바 버튼이 짧게 흔들림 (폰이 바로 다시 그려지므로 시각만 적어 두고 FailShake 가 새 버튼에)
        void OrderFailed()
        {
            stkFailT = Time.realtimeSinceStartup;
            KwGame.Audio.GameAudioManager.Play(KwGame.Audio.SoundCue.UiDenied);
        }
        void FailShake(VisualElement v)
        {
            const float DUR = 0.45f; float el = Time.realtimeSinceStartup - stkFailT;
            if (el >= DUR || el < 0 || Ui.FxOff) return;
            float rest = DUR - el;
            Fx(Tween(rest, p => { float q = (el + p * rest) / DUR; v.style.translate = new Translate(Mathf.Sin(q * 40) * 12 * (1 - q), 0); }));
        }
        /// 체결·실패 한 줄 (늘 자리 차지: 버튼이 밀리지 않게)
        Label MsgLine()
        {
            var m = Ui.Label(stkMsg == "" ? " " : stkMsg, 20, stkMsgBad ? Ui.Bad : Ui.Gold, true);
            m.style.marginBottom = 6; m.style.whiteSpace = WhiteSpace.NoWrap; m.style.overflow = Overflow.Hidden; m.style.textOverflow = TextOverflow.Ellipsis;
            return m;
        }

        /// 주문 실패 이유: sim error 이벤트(Api.cs: watchOnly · locked · phone@…)가 있으면 그걸, 없으면 지금 상태로 짐작
        string OrderFailWhy(List<SimEvent> evs, string cmd, object[] kv)
        {
            string msg = evs.FirstOrDefault(x => x.t == "error")?.Str("msg");
            if (msg == "watchOnly") return "국장 주문은 장 보기 칸에서만 · 집 → 장 보기";
            if (msg == "locked") return "아직 상장 전 종목";
            if (msg != null && msg.StartsWith("phone@")) return "지금은 폰 주문 불가 (고르는 중)";
            if (msg != null) return "지금은 주문 안 됨";
            object Arg(string k) { for (int i = 1; i + 1 < kv.Length; i += 2) if (kv[i] as string == k) return kv[i + 1]; return null; }
            string tk = Arg("tk") as string;
            bool stock = tk != null && D.TK.TryGetValue(tk, out var t) && t.IsStock;
            if (cmd == "open" && Arg("amt") != null && Convert.ToDouble(Arg("amt")) > G.marginRoom() + 0.5)   // 증거금 합계 상한 (v4 관문 규칙)
                return G.T("v4.margin.over", "a", G.man(G.marginCap()), "u", G.man(G.marginUsed()), "r", G.man(G.marginRoom()));
            if (stock && !G.stockOpen()) return G.weekend() ? "주말 휴장 · 코인만" : "장 마감 · 국장 09:00~15:30";
            if (cmd == "open" && G.shortLockWhy() is string slw && Arg("dir") != null && Convert.ToDouble(Arg("dir")) < 0) return slw;
            if (cmd == "open" && Arg("lev") != null && Convert.ToDouble(Arg("lev")) > G.levCap()) return $"배율 잠김 · 지금 최대 {G.levCap():0}배";
            if ((cmd == "buy" || cmd == "open") && S.cash < 10000) return "현금 부족";
            return S.rt ? "현금 부족 / 증거금 상한" : "장 마감 / 현금 부족 / 이번 칸에 진입함";
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
            // 분류 탭: 주식·코인 / 성격(얌전·출렁·도박) / 보유 중
            var tabs = Ui.Row(); tabs.style.flexWrap = Wrap.Wrap; tabs.style.marginBottom = 10; body.Add(tabs);
            foreach (var (k, n) in new[] { ("all", "전체"), ("stock", "주식"), ("coin", "코인"), ("얌전", "얌전"), ("출렁", "출렁"), ("도박", "도박"), ("mine", "보유 중") })
            {
                var kk = k; var ch = Ui.Chip(n, () => { stkCat = kk; RenderAll(); }, false, stkCat == k ? Ui.Accent : (Color?)null); ch.style.marginRight = 6; ch.style.marginBottom = 4; tabs.Add(ch);
            }
            bool Pick(Ticker t) => stkCat == "all" || (stkCat == "stock" ? !t.IsCoin : stkCat == "coin" ? t.IsCoin : stkCat == "mine" ? PosPnl(t.id).HasValue : Shake(t) == stkCat);
            VisualElement grid = null; int col = 0;
            foreach (var t in D.TKList.Where(x => G.tkListed(x.id) && Pick(x)))
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
                if (po.HasValue) top.Add(Badge($"보유 {G.sgnMan(po.Value)} ({GameSim.pct(PosPct(t.id))})", UpDn(po.Value)));
                if (lk) { card.Add(Ui.Label($"잠김 — 유물 '{LockName(t)}' 필요", 20, StkAxis)); }
                else
                {
                    var pr = Ui.Row(); pr.style.marginTop = 6; card.Add(pr);
                    pr.Add(Ui.Label(G.fmtP(mk.p), 34, Ui.Text, true));
                    var rl = Ui.Label(GameSim.pct(r), 24, UpDn(r), true); rl.style.marginLeft = 12; pr.Add(rl);
                    var sp = new LineChart(mk.hist.Skip(Math.Max(0, mk.hist.Count - 16)).Select(c => c.c).Concat(new[] { mk.p }).ToList(), false, null);
                    sp.style.height = 70; sp.style.marginTop = 6; card.Add(sp);
                    card.Add(Ui.Label(S.rt ? Ui.Clean(t.d) + (mk.relist > 0 ? $" · 재상장 {mk.relist}회" : "") : $"{Ui.Clean(t.d)} · 4칸 {GameSim.pct(r4)}", 18, StkAxis));
                    var nat = Ui.Label(Nature(t), 18, Ui.Gold); nat.style.marginTop = 4; card.Add(nat);
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
            var b = Ui.Label(text, 18, c, true); b.style.marginLeft = 8; Ui.Border(b, c, 1); Ui.Radius(b, 6);
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
        /// 들어간 돈(주식 원금 + 코인 증거금) 대비 수익률
        double PosPct(string k)
        {
            var h = S.hold.Get(k); double basis = (h?.cost ?? 0) + S.cps.Where(c => c.tk == k).Sum(c => c.margin);
            return basis > 0 ? (PosPnl(k) ?? 0) / basis : 0;
        }
        /// 종목 성격 (사전 정보 없이도 알게): 출렁임 · 시장 따라감 · 거래 시간
        static string Shake(Ticker t) => t.vol < 0.012 ? "얌전" : t.vol < 0.03 ? "출렁" : "도박";
        string Nature(Ticker t)
        {
            int st = t.vol < 0.006 ? 1 : t.vol < 0.012 ? 2 : t.vol < 0.03 ? 3 : t.vol < 0.1 ? 4 : 5;
            string mood = t.inv ? "갓성 반대로 2배" : t.IsCoin ? "코인끼리 따로 놂" : t.beta < 0 ? "시장 무너질 때 오름" : t.beta >= 1.2 ? "시장보다 크게 출렁" : t.beta >= 0.8 ? "시장 따라감" : "시장 영향 적음";
            return $"출렁임 {new string('●', st)}{new string('○', 5 - st)} · {mood} · {(t.IsCoin ? "24시간" : "09:00~15:30")}" + (t.junk ? " · ⚠ 상폐 위험" : "") + (t.meme ? " · ⚠ 바닥가면 상폐" : "");
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
                c.Add(Ui.Label(s0.an ? $"{s0.name} · 전적 {G.srcRec(s0.id)}" : $"{s0.name} · 신뢰 {GameSim.stars(s0.trust)}", 18, StkAxis));   // 분석가는 별이 다 같음 → 전적만 단서
                c.Add(Ui.Label($"{D.TK[t.tk].name} {(t.dir > 0 ? "▲ 오른다" : "▼ 내린다")}", 22, t.dir > 0 ? StkUp : StkDn, true));
                c.Add(Ui.Label(G.tipWhen(t), 18, Ui.Text));
                row.Add(c);
            }
            if (S.whale != null && S.whale.T == G.Tnow() && (tk == null || tk == S.whale.tk))
            {
                var c = Ui.Box(StkCard, 12, 10); c.style.marginBottom = 10; Ui.Border(c, Ui.Gold, 2);
                c.Add(Ui.Label("새벽 고래 · 이번 칸 70%", 18, Ui.Gold));
                c.Add(Ui.Label($"{D.TK[S.whale.tk].name} {(S.whale.dir > 0 ? "▲ 매집" : "▼ 투매")}", 22, S.whale.dir > 0 ? StkUp : StkDn, true));
                row.Add(c);
            }
            if (row.childCount == 0) row.Add(Ui.Label("정보 없음. 감으로 하는 거임 (정보는 증권사·갤·길거리에서)", 20, StkAxis));
        }

        // ---------- 차트·주문 ----------
        void StkDetail(VisualElement body, string where, double fee, VisualElement dock)
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
                    pr0.Add(Ui.Label(G.fmtP(xm.p), 18, StkAxis)); pr0.Add(Ui.Label(GameSim.pct(rx), 18, UpDn(rx), true));
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
                if (id != stkSel) b.Q<Label>().style.color = UpDn(rx);   // 고른 칩(분홍 바탕)은 Ui.Button 이 글자색을 정함
                strip.Add(b);
            }

            // 스크롤 안 = 차트 · 내 포지션 · 정보. 주문은 아래 고정 바 (OrderBar)
            var left = new VisualElement(); body.Add(left);

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
                var rf = Ui.Label($"  기준 {G.fmtP(mk.ref0)}" + (t.IsStock ? $" · ±{D.RULES.RT_LIMIT * 100:0}%" : " · 자정"), 18, StkAxis); rf.style.marginBottom = 6; rf.style.whiteSpace = WhiteSpace.NoWrap; pr.Add(rf);
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
            lg.Add(Ui.Label("MA5 ", 18, CandleChart.Ma5C, true)); lg.Add(Ui.Label("MA20 ", 18, CandleChart.Ma20C, true)); lg.Add(Ui.Label(S.rt ? "· 30분봉" : "· 1봉 = 1칸 · 마우스 올리면 시고저종", 18, StkAxis));
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

            // 주문 바: 폰이면 스크롤 밖 아래에 고정 (스크롤해도 금액·배율·방향·진입 버튼이 늘 보임)
            (dock ?? body).Add(OrderBar(t, where, fee));
        }

        VisualElement CoinRow(CoinPos c)
        {
            double pl = G.cpnl(c) + c.bonus; bool lk = !S.rt && c.t0 == G.Tnow(); int id = c.id;
            var box = Ui.Box(StkCard, 12, 10); box.style.marginTop = 8; box.style.borderLeftWidth = 4; box.style.borderLeftColor = c.dir > 0 ? StkUp : StkDn;
            var row = Ui.Row(); box.Add(row);
            var info = new VisualElement(); info.style.flexGrow = 1; info.style.flexShrink = 1; row.Add(info);
            info.Add(Ui.Label($"{D.TK[c.tk].name} {c.lev:0}x {(c.dir > 0 ? "롱" : "숏")}{(c.mult > 1 ? " (올인 ×1.5)" : "")}", 22, c.dir > 0 ? StkUp : StkDn, true));
            info.Add(Ui.Label($"증거금 {ManW(c.margin)} · 진입 {G.fmtP(c.entry)} · 청산가 {G.fmtP(GameSim.liqPx(c))}", 18, StkAxis));
            var pv = Ui.Label($"{G.sgnMan(pl)}\n{GameSim.pct(c.margin > 0 ? pl / c.margin : 0)}", 24, UpDn(pl), true); pv.style.marginRight = 12; pv.style.unityTextAlign = TextAnchor.MiddleRight; row.Add(pv);
            row.Add(Ui.Chip(lk ? "다음 칸부터" : "정리", () => Order("정리", "익절 ㅋㅋ 나 천재?", "…손절. 괜찮아. 괜찮아.", "close", "id", id), lk));
            if (!(stkTab == "detail" && stkSel == c.tk)) GoChart(info, c.tk);
            if (G.v4) StopsRow(box, c);
            return box;
        }

        /// 이미 잡은 포지션의 예약 손절·익절 붙이기·바꾸기 (sim "stops" → setStops: 증거금 대비 비율, 손절 0~0.85 · 익절 0~50). 장 보기 칸에서만 걸림
        void StopsRow(VisualElement box, CoinPos c)
        {
            string Desc(double sl, double tp) => sl > 0 || tp > 0 ? G.T("v4.stop.row", "x", string.Join(" · ", new[] { sl > 0 ? $"손절 −{sl * 100:0}%" : null, tp > 0 ? $"익절 +{tp * 100:0}%" : null }.Where(x => x != null))) : "예약 없음";
            int id = c.id; bool on = c.sl > 0 || c.tp > 0, ok = G.stopsOk(), edit = ok && stkStopEdit == id;
            var sr = Ui.Row(); sr.style.flexWrap = Wrap.Wrap; sr.style.marginTop = 6; box.Add(sr);
            var cur = Ui.Label(Desc(c.sl, c.tp), 18, on ? Ui.Gold : StkAxis, on); cur.style.marginRight = 10; sr.Add(cur);
            if (!ok) { var why = Ui.Label("· " + G.T("v4.stop.homeNo"), 18, Ui.Dim); why.style.flexShrink = 1; sr.Add(why); return; }   // 걸 수 없는 이유
            var tg = Ui.Chip(edit ? "예약 닫기 ▲" : on ? "예약 바꾸기 ▼" : "예약 걸기 ▼", () => { stkStopEdit = stkStopEdit == id ? 0 : id; RenderAll(); }, false, StkBg); tg.style.marginBottom = 0; sr.Add(tg);
            if (!edit) return;
            string nm = D.TK[c.tk].name;
            void Set(double sl, double tp)
            {
                onSent = evs =>
                {
                    var e = evs.FirstOrDefault(x => x.t == "trade" && x.Str("op") == "stops");
                    bool done = e != null && e["ok"] is bool b && b;
                    stkMsg = done ? $"예약 바꿈: {nm} {Desc(sl, tp)}" : "예약 못 바꿈 (장 보기 칸에서만)"; stkMsgBad = !done;
                    if (!done) OrderFailed();
                };
                Send("stops", "id", id, "sl", sl, "tp", tp);
            }
            var r1 = Ui.Row(); r1.style.flexWrap = Wrap.Wrap; r1.style.marginTop = 6; box.Add(r1);
            foreach (var v in new[] { 0, 0.3, 0.5, 0.7 }) { double vv = v; var b = Ui.Chip(v == 0 ? "손절 " + G.T("v4.stop.off") : G.T("v4.stop.slOpt", "p", Math.Round(v * 100)), () => Set(vv, c.tp), false, Math.Abs(c.sl - v) < 1e-9 ? (Color?)StkDn : null); b.style.marginBottom = 4; r1.Add(b); }
            var r2 = Ui.Row(); r2.style.flexWrap = Wrap.Wrap; box.Add(r2);
            foreach (var v in new[] { 0, 0.5, 1.0, 2.0 }) { double vv = v; var b = Ui.Chip(v == 0 ? "익절 " + G.T("v4.stop.off") : G.T("v4.stop.tpOpt", "p", Math.Round(v * 100)), () => Set(c.sl, vv), false, Math.Abs(c.tp - v) < 1e-9 ? (Color?)StkUp : null); b.style.marginBottom = 4; r2.Add(b); }
        }

        /// 보유 포지션 이름 쪽을 누르면 그 종목 차트·주문으로 (피드백)
        void GoChart(VisualElement info, string tk)
        {
            info.Add(Ui.Label("눌러서 차트 보기 ›", 18, Ui.Accent));
            foreach (var ch in info.Children()) ch.pickingMode = PickingMode.Ignore;
            info.pickingMode = PickingMode.Position;
            info.RegisterCallback<ClickEvent>(_ => { stkSel = tk; stkTab = "detail"; stkAmt = null; stkSellF = 1; stkMsg = ""; RenderAll(); });
        }

        /// Ui.Button 의 부제(두 번째 글자)가 18 아래로 작아지지 않게 (Ui.Button 은 본문 × 0.72)
        static void SubMin(Button b, float min = 18)
        {
            var sub = b.Children().OfType<Label>().Skip(1).FirstOrDefault();
            if (sub != null && sub.style.fontSize.value.value < min) sub.style.fontSize = min;
        }

        /// 주문 바 한 덩어리: 금액 · 배율 · 롱/숏(매수/매도) · 결과 줄 · 진입 버튼. 부가 정보(예약 · 청산가 · 수수료)는 접었다 펴기.
        /// 폰 요소에 묶지 않음 (돌려준 요소를 아무 데나 붙임) → 장 보기 전용 화면에서도 그대로 재사용
        /// desk = 장 보기 데스크 오른쪽 주문 패널 (청산 확률 막대를 접힌 상태에서도 보임)
        VisualElement OrderBar(Ticker t, string where, double fee, bool desk = false)
        {
            var R = D.RULES; var mk = S.mk.tk[t.id]; bool isC = t.IsCoin, open = isC || G.stockTradeOk();   // v4: 국장은 장 보기 칸에서만
            var bar = Ui.Box(StkCard); bar.style.flexShrink = 0;
            bar.style.paddingLeft = 16; bar.style.paddingRight = 16; bar.style.paddingTop = 10; bar.style.paddingBottom = 4;
            bar.style.borderTopWidth = 2; bar.style.borderTopColor = StkLine;
            if (isC && (phoneOpen || desk)) CoachCtx("coin");   // 첫 코인 주문 화면 → 롱/숏 설명 카드 (폰 위에 덮음)
            if (isC && stkLev > t.maxLev) stkLev = t.maxLev;
            if (isC && stkDir < 0 && !G.shortOk()) stkDir = 1;   // v4: 숏 잠김 (이유 = G.shortLockWhy)
            double maxAmt = Math.Max(0, Math.Floor((isC ? S.cash / (1 + stkLev * (R.COIN_FEE + G.sickSlip() / 5)) : S.cash) / 10000) * 10000);
            if (isC && G.marginCap() != double.MaxValue) maxAmt = Math.Min(maxAmt, Math.Floor(G.marginRoom() / 10000) * 10000);   // 증거금 합계 상한 → "최대" = 현금과 남은 상한 중 작은 쪽
            if (stkAmt == null) stkAmt = Math.Round(maxAmt * 0.25 / 10000) * 10000;
            stkAmt = Math.Max(0, Math.Min(stkAmt.Value, maxAmt));
            double amt = stkAmt.Value;

            // 1줄: 무슨 주문 · 금액
            var hr = Ui.Row(); bar.Add(hr);
            var ttl = Ui.Label(isC ? $"{t.name} · 코인 주문 · 24시간" : open ? $"{t.name} · 주식 주문 · 수수료 {fee * 100:0.0}%" : G.v4 && G.stockOpen() ? $"{t.name} · 주식 주문은 장 보기 칸에서만" : $"{t.name} · 주식장 마감", 20, open ? Ui.Gold : StkAxis, true);
            ttl.style.flexGrow = 1; ttl.style.flexShrink = 1; hr.Add(ttl);
            hr.Add(Ui.Label(isC ? "증거금 " : "매수 ", 20, StkAxis));
            var amtL = Ui.Label(ManW(amt), 30, Ui.Text, true); amtL.style.whiteSpace = WhiteSpace.NoWrap; hr.Add(amtL);

            // 2줄: 금액 막대 (끌어서 조절) + 빠른 칩
            var ar = Ui.Row(); ar.style.marginTop = 6; bar.Add(ar);
            var track = Ui.Box(StkBg, 0, 10); track.style.height = 26; track.style.flexGrow = 1; track.style.marginRight = 10; Ui.Border(track, StkLine, 2);
            var fill = Ui.Box(isC ? (stkDir > 0 ? StkUp : StkDn) : StkUp, 0, 8); fill.style.height = Length.Percent(100); fill.pickingMode = PickingMode.Ignore; track.Add(fill);
            void SetFrac(float f, bool rerender)
            {
                f = Mathf.Clamp01(f); stkAmt = Math.Floor(maxAmt * f / 10000) * 10000;
                fill.style.width = Length.Percent(maxAmt > 0 ? (float)(stkAmt.Value / maxAmt) * 100 : 0);
                amtL.text = ManW(stkAmt.Value);
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
            ar.Add(track);
            foreach (var (f, l) in new[] { (0.1, "10%"), (0.25, "25%"), (0.5, "50%"), (1.0, isC ? "최대" : "전부") })
            { double ff = f; var qc = Ui.Chip(l, () => { stkAmt = Math.Floor(maxAmt * ff / 10000) * 10000; RenderAll(); }, !open || maxAmt < 10000); qc.style.marginBottom = 0; ar.Add(qc); }

            if (isC)
            {
                // 3줄: 배율 칩 + 부가 정보 펼치기
                var lr = Ui.Row(); lr.style.flexWrap = Wrap.Wrap; lr.style.marginTop = 6; bar.Add(lr);
                foreach (var l in new[] { 1.0, 2, 3, 5, 10, 25, 50 }.Where(x => x <= t.maxLev))
                {
                    double ll = l;
                    var b = Ui.Chip($"{l:0}x", () => { stkLev = ll; stkAmt = null; if (ll >= 25) MiraiLine(ll >= 50 ? "50배!!! 자기 최고야 사랑해" : "오 좀 치네?", "happy"); RenderAll(); }, false,
                        stkLev == l ? (l >= 25 ? (Color)StkUp : Ui.Accent) : (Color?)null);
                    b.style.marginBottom = 4; lr.Add(b);
                }
                var gap = new VisualElement(); gap.style.flexGrow = 1; lr.Add(gap);
                var mo = Ui.Chip(stkMore ? "접기 ▲" : (G.v4 ? "예약·청산가 ▼" : "청산가·수수료 ▼"), () => { stkMore = !stkMore; RenderAll(); }, false, StkBg); mo.style.marginBottom = 4; mo.style.marginRight = 0; lr.Add(mo);

                double allin = G.has("allin") && amt * (1 + stkLev * R.COIN_FEE) >= S.cash * 0.95 ? 1.5 : 1;
                double estLiq = mk.p * (1 - stkDir * 0.9 / (stkLev * allin));
                double odds = stkLev > 1 ? G.liqOdds(stkLev * allin, t.vol * (G.isEve() && G.has("whale") ? 2 : 1)) : 0;
                if (!stkMore)
                {   // 접힌 상태: 한 줄 요약 (청산 위험이 크면 빨강 굵게)
                    string st = G.v4 && G.stopsOk() && (stkSl > 0 || stkTp > 0) ? " · 예약 " + string.Join(" ", new[] { stkSl > 0 ? $"손절 −{stkSl * 100:0}%" : null, stkTp > 0 ? $"익절 +{stkTp * 100:0}%" : null }.Where(x => x != null)) : "";
                    var sm = Ui.Label($"청산가 ≈ {G.fmtP(estLiq)} ({90 / stkLev:0.0}% 역행)" + (stkLev > 1 ? $" · 이번 칸 청산 확률 ≈ {odds * 100:0}%" : "") + st, 18, odds >= 0.3 ? StkUp : StkAxis, odds >= 0.3);
                    sm.style.marginTop = 2; sm.style.marginBottom = 4; bar.Add(sm);
                    if (desk && stkLev > 1) bar.Add(RiskBar((float)odds));   // 데스크는 자리가 있으니 청산 확률을 막대로도
                    // 증거금 상한 · 숏 잠김 이유는 접힌 상태에서도 보임 (펴야만 보이면 왜 주문이 안 되는지 모름)
                    if (G.v4 && G.gateOn) { var mr = Ui.Label($"증거금 상한 {G.man(G.marginCap())}원 중 {G.man(Math.Max(0, G.marginRoom()))}원 남음", 18, G.marginRoom() < amt ? Ui.Bad : StkAxis); mr.style.marginBottom = 4; bar.Add(mr); }
                    if (G.shortLockWhy() is string slw0) { var sl0 = Ui.Label(slw0, 18, Ui.Gold); sl0.style.whiteSpace = WhiteSpace.Normal; sl0.style.marginBottom = 4; bar.Add(sl0); }
                }
                else
                {
                    var more = Ui.Box(StkBg, 12, 10); more.style.marginTop = 2; more.style.marginBottom = 6; bar.Add(more);
                    if (G.shortLockWhy() is string slw) { var cl = Ui.Label(slw, 20, Ui.Gold); cl.style.whiteSpace = WhiteSpace.Normal; more.Add(cl); }
                    if (G.marginNext() is string mn)
                    {
                        var ml = Ui.Label(mn + (G.marginUsed() > 0 ? $" · 지금 {G.man(G.marginUsed())} 쓰는 중" : ""), 20, Ui.Dim); ml.style.whiteSpace = WhiteSpace.Normal; ml.style.marginTop = 4; more.Add(ml);
                    }
                    if (G.v4)
                    {   // 예약 손절·익절 (증거금 대비). 장 보기 칸에서만 걸 수 있음
                        var sh = Ui.Label(G.T("v4.stop.lbl"), 18, Ui.Gold, true); sh.style.marginTop = 6; more.Add(sh);
                        if (G.stopsOk())
                        {
                            var sr = Ui.Row(); sr.style.flexWrap = Wrap.Wrap; sr.style.marginTop = 4; more.Add(sr);
                            foreach (var v in new[] { 0, 0.3, 0.5, 0.7 }) { double vv = v; var b = Ui.Chip(v == 0 ? "손절 " + G.T("v4.stop.off") : G.T("v4.stop.slOpt", "p", Math.Round(v * 100)), () => { stkSl = vv; RenderAll(); }, false, Math.Abs(stkSl - v) < 1e-9 ? (Color?)StkDn : null); b.style.marginBottom = 4; sr.Add(b); }
                            var tr0 = Ui.Row(); tr0.style.flexWrap = Wrap.Wrap; more.Add(tr0);
                            foreach (var v in new[] { 0, 0.5, 1.0, 2.0 }) { double vv = v; var b = Ui.Chip(v == 0 ? "익절 " + G.T("v4.stop.off") : G.T("v4.stop.tpOpt", "p", Math.Round(v * 100)), () => { stkTp = vv; RenderAll(); }, false, Math.Abs(stkTp - v) < 1e-9 ? (Color?)StkUp : null); b.style.marginBottom = 4; tr0.Add(b); }
                        }
                        else { var hn = Ui.Label(G.T("v4.stop.homeNo"), 20, Ui.Dim); hn.style.whiteSpace = WhiteSpace.Normal; more.Add(hn); }
                    }
                    var lq = Ui.Label($"청산가 ≈ {G.fmtP(estLiq)} ({90 / stkLev:0.0}% 역행)", 20, Ui.Text); lq.style.marginTop = 6; more.Add(lq);
                    if (stkLev > 1)
                    {
                        more.Add(Ui.Label($"이번 칸 청산 확률 ≈ {odds * 100:0}%", 22, odds >= 0.3 ? StkUp : Ui.Gold, true));
                        more.Add(RiskBar((float)odds));
                    }
                    more.Add(Ui.Label($"수수료 {ManW(amt * stkLev * (R.COIN_FEE + G.sickSlip() / 5))}" + (stkLev > 1 ? $" · 펀딩비 칸당 {ManW(amt * stkLev * R.FUNDING)}" : ""), 18, StkAxis));
                    if (G.has("allin")) more.Add(Ui.Label("올인 유물: 현금 95% 이상 넣으면 손익 ×1.5", 18, Ui.Gold));
                }

                // 결과 줄 바로 아래: 롱 · 숏 · 진입 (한 줄)
                bar.Add(MsgLine());
                var act = Ui.Row(); act.style.alignItems = Align.Stretch; bar.Add(act);
                var lb = Ui.Button("롱 ▲", () => { stkDir = 1; RenderAll(); }, null, false, stkDir > 0 ? StkUp : Ui.Panel2, 24); lb.style.flexGrow = 1; lb.style.flexBasis = 0; lb.style.marginRight = 8; lb.style.alignItems = Align.Center; lb.style.justifyContent = Justify.Center; act.Add(lb);
                var sb = Ui.Button(G.shortOk() ? "숏 ▼" : "숏 ▼ 잠김", () => { stkDir = -1; RenderAll(); }, null, !G.shortOk(), stkDir < 0 ? StkDn : Ui.Panel2, 24); sb.style.flexGrow = 1; sb.style.flexBasis = 0; sb.style.marginRight = 8; sb.style.alignItems = Align.Center; sb.style.justifyContent = Justify.Center; act.Add(sb);
                if (!G.shortOk() && G.shortLockWhy() is string why) sb.tooltip = why;
                // 위험한 주문(25배 이상 · 증거금 100만 이상 · 이번 칸 청산 확률 30% 이상)만 한 번 더 눌러야 나감. 기본 10배 소액은 한 번 (매번 확인시키면 정작 위험할 때 안 읽음)
                bool danger = stkLev >= 25 || amt >= 1e6 || odds >= 0.3; string key = $"open|{t.id}|{stkDir}|{stkLev}|{amt}"; bool armed = danger && OrdArmed(key);
                var go = Ui.Button(armed ? "한 번 더 누르면 진입" : $"{(stkDir > 0 ? "롱" : "숏")} {stkLev:0}x 진입",
                    Confirm(key, danger, () => Order("진입", stkDir > 0 ? "롱 가즈아아아" : "숏 잡았다. 떨어져라 떨어져라", null, G.v4 && G.stopsOk()   // 예약 손절·익절은 장 보기 칸에서만 같이 보냄
                        ? new object[] { "open", "tk", t.id, "dir", stkDir, "lev", stkLev, "amt", stkAmt ?? 0, "sl", stkSl, "tp", stkTp }
                        : new object[] { "open", "tk", t.id, "dir", stkDir, "lev", stkLev, "amt", stkAmt ?? 0 })),
                    armed ? $"{stkLev:0}배 · 증거금 {ManW(amt)} · 4초 안에" : $"증거금 {ManW(amt)}" + (danger ? " · 두 번 눌러 확인" : ""),
                    amt < 10000, armed ? Ui.Bad : stkDir > 0 ? StkUp : StkDn, 26);
                go.style.flexGrow = 2; go.style.flexBasis = 0; go.style.alignItems = Align.Center; go.style.justifyContent = Justify.Center; SubMin(go); act.Add(go);
                FailShake(act);
            }
            else
            {
                var h = S.hold.Get(t.id); bool has = h != null && h.q > 0;
                double hvNow = has ? h.q * mk.p : 0;
                if (has)
                {
                    double hpl = hvNow - h.cost;
                    var hl = Ui.Label($"보유 {h.q:0.##}주 · 평단 {G.fmtP(h.cost / h.q)} · 평가 {ManW(hvNow)} · {G.sgnMan(hpl)} ({GameSim.pct(hvNow / h.cost - 1)})" + (S.rt ? "" : $" · {G.Tnow() - h.t0}칸 보유"), 18, UpDn(hpl), true);
                    hl.style.marginTop = 6; bar.Add(hl);
                }
                else { var nh = Ui.Label("보유 없음 · 매도할 주식 없음", 18, StkAxis); nh.style.marginTop = 6; bar.Add(nh); }
                // 매도: 비율 막대로 원하는 만큼 (피드백: 절반·전량만 있어서 답답) + 빠른 칩
                string lockWhy = G.sellLockWhy(t.id);   // 작전주 설거지 → 하한가 잠김 (그날은 안 팔림)
                bool can = has && open && lockWhy == null;
                stkSellF = Math.Max(0.01, Math.Min(1, stkSellF));
                if (has)
                {
                    var sellL = Ui.Label("", 18, can ? Ui.Text : StkAxis, true); sellL.style.marginTop = 4; bar.Add(sellL);
                    void SellText() => sellL.text = $"매도 {stkSellF * 100:0}% · {h.q * stkSellF:0.##}주 ≈ {ManW(hvNow * stkSellF)}";
                    SellText();
                    var sr = Ui.Row(); sr.style.marginTop = 4; bar.Add(sr);
                    var strack = Ui.Box(StkBg, 0, 10); strack.style.height = 22; strack.style.flexGrow = 1; strack.style.marginRight = 10; Ui.Border(strack, StkLine, 2); sr.Add(strack);
                    var sfill = Ui.Box(StkDn, 0, 8); sfill.style.height = Length.Percent(100); sfill.pickingMode = PickingMode.Ignore; strack.Add(sfill);
                    sfill.style.width = Length.Percent((float)stkSellF * 100);
                    if (can)
                    {
                        void SetSell(float f, bool rerender) { stkSellF = Math.Max(0.01, Math.Round(Mathf.Clamp01(f) * 100) / 100); sfill.style.width = Length.Percent((float)stkSellF * 100); SellText(); if (rerender) RenderAll(); }
                        strack.RegisterCallback<PointerDownEvent>(e => { stkDragging = true; strack.CapturePointer(e.pointerId); SetSell(e.localPosition.x / strack.resolvedStyle.width, false); });
                        strack.RegisterCallback<PointerMoveEvent>(e => { if (strack.HasPointerCapture(e.pointerId)) SetSell(e.localPosition.x / strack.resolvedStyle.width, false); });
                        strack.RegisterCallback<PointerUpEvent>(e => { stkDragging = false; if (strack.HasPointerCapture(e.pointerId)) { strack.ReleasePointer(e.pointerId); SetSell(e.localPosition.x / strack.resolvedStyle.width, true); } });
                        strack.RegisterCallback<PointerCaptureOutEvent>(_ => stkDragging = false);
                    }
                    foreach (var (f, l) in new[] { (0.1, "10%"), (0.25, "25%"), (0.5, "50%"), (1.0, "전량") })
                    { double ff = f; var sc = Ui.Chip(l, () => { stkSellF = ff; RenderAll(); }, !can, Math.Abs(stkSellF - ff) < 1e-9 ? (Color?)StkDn : null); sc.style.marginBottom = 0; sr.Add(sc); }
                }
                // 작전 종목: 한 번에 많이 사고팔수록 값이 나빠짐 (미리 보기 = 누적 안 함). 0.1% 넘을 때만
                double bSlip = open && amt >= 10000 ? G.opSlip(t.id, amt, true) : 0;
                if (bSlip > 0.001) { var bl = Ui.Label($"예상 미끄러짐 −{bSlip * 100:0.0}% (약 −{G.man(amt * bSlip)}원) — 한 번에 많이 살수록 비싸게 삼", 18, Ui.Bad, true); bl.style.whiteSpace = WhiteSpace.Normal; bl.style.marginTop = 4; bar.Add(bl); }
                double sSlip = can ? G.opSlip(t.id, hvNow * stkSellF, true) : 0;
                if (sSlip > 0.001) { var sl2 = Ui.Label($"매도 미끄러짐 −{sSlip * 100:0.0}% (약 −{G.man(hvNow * stkSellF * sSlip)}원) — 나눠 팔면 덜 깎임", 18, Ui.Bad, true); sl2.style.whiteSpace = WhiteSpace.Normal; sl2.style.marginTop = 4; bar.Add(sl2); }
                if (has && lockWhy != null) { var lw = Ui.Label(lockWhy, 18, Ui.Bad, true); lw.style.whiteSpace = WhiteSpace.Normal; lw.style.marginTop = 4; bar.Add(lw); }

                // 결과 줄 바로 아래: 매수 · 매도 (한 줄)
                bar.Add(MsgLine());
                var act = Ui.Row(); act.style.alignItems = Align.Stretch; bar.Add(act);
                bool invLk = t.inv && !G.shortOk();   // 곱버스 = 주식 숏 → 숏이랑 같이 잠김
                var buy = Ui.Button("매수", () => Order("매수", "가즈아. 이건 우상향이다 (희망)", null, "buy", "tk", t.id, "amt", stkAmt ?? 0, "where", where),
                    invLk ? G.shortLockWhy() ?? "숏 잠김" : open ? $"{ManW(amt)} · 수수료 {ManW(amt * fee)}" : G.v4 && G.stockOpen() ? "장 보기 칸에서만 주문" : S.rt ? "장 마감 (09:00~15:30)" : "장 마감 (아침·점심만)", amt < 10000 || !open || invLk, StkUp, 26);
                buy.style.flexGrow = 1; buy.style.flexBasis = 0; buy.style.marginRight = 8; buy.style.alignItems = Align.Center; buy.style.justifyContent = Justify.Center; SubMin(buy); act.Add(buy);
                // 전량 매도는 한 번 더 눌러야 나감
                bool all = stkSellF >= 1; string skey = $"sell|{t.id}|all"; bool sArmed = all && can && OrdArmed(skey);
                var sell = Ui.Button(sArmed ? "한 번 더 누르면 전량 매도" : all ? "전량 매도" : $"{stkSellF * 100:0}% 매도",
                    Confirm(skey, all, () => Order(all ? "전량 매도" : "일부 매도", "익절은 과학이다", "손절도 과학이다 (눈물)", "sell", "tk", t.id, "frac", stkSellF, "where", where)),
                    !has ? "보유 없음" : lockWhy != null ? "하한가 잠김" : sArmed ? "4초 안에 한 번 더" : all ? "두 번 눌러 확인" : null, !can, sArmed ? Ui.Bad : StkDn, 26);
                sell.style.flexGrow = 1; sell.style.flexBasis = 0; sell.style.alignItems = Align.Center; sell.style.justifyContent = Justify.Center; SubMin(sell); act.Add(sell);
                FailShake(act);
            }
            NoShrink(bar);
            return bar;
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
            Card("현금", ManW(S.cash), Ui.Text);
            Card("평가액", ManW(hv), Ui.Text);
            Card("평가손익", G.sgnMan(pl), UpDn(pl));
            Card("실현손익 누적", G.sgnMan(S.realized), UpDn(S.realized));
            Card("투입금 대비", GameSim.pct(ret), UpDn(ret));

            var eh = Ui.Label($"누적 투자손익 (실현+평가, 칸마다) · 투입 원금 누적 {ManW(S.invIn)}", 20, Ui.Gold, true); eh.style.marginTop = 6; body.Add(eh);
            var pts = S.eqh.Select(p => p.v).Concat(new[] { tot }).ToList();
            var eq = new LineChart(pts, true, v => G.sgnMan(v)); eq.style.height = 220; eq.style.marginTop = 6; eq.style.marginBottom = 12;
            body.Add(eq);

            var ph = Ui.Row(); ph.style.marginBottom = 6; body.Add(ph);
            ph.Add(Ui.Label("보유 포지션", 22, Ui.Gold, true));
            if (S.cps.Any(c => S.rt || c.t0 != G.Tnow()))
            {   // 전부 정리는 한 번 더 눌러야 나감
                bool armed = OrdArmed("closeCoins");
                var b = Ui.Chip(armed ? "한 번 더 누르면 코인 전부 정리" : "코인 전부 정리", Confirm("closeCoins", true, () => Order("코인 정리", "다 정리했어. 이제 현금이 왕이야", "다 정리했어… 현금이라도 남았네", "closeCoins")), false, armed ? (Color?)Ui.Bad : null);
                b.style.marginLeft = 12; ph.Add(b);
            }
            body.Add(MsgLine());   // 정리·매도 결과는 버튼 가까이 (보유 포지션 머리 바로 아래)
            int n = 0;
            foreach (var k in G.STK().Where(k => S.hold.Has(k)).ToList())
            {
                var x = S.hold[k]; double v = x.q * S.mk.tk[k].p; string kk = k;
                var row = Ui.Box(StkCard, 12, 10); row.style.flexDirection = FlexDirection.Row; row.style.alignItems = Align.Center; row.style.marginBottom = 8; row.style.borderLeftWidth = 4; row.style.borderLeftColor = UpDn(v - x.cost);
                var info = new VisualElement(); info.style.flexGrow = 1; row.Add(info);
                info.Add(Ui.Label($"{D.TK[k].name} · 주식", 22, Ui.Text, true));
                info.Add(Ui.Label($"{ManW(x.cost)} → {ManW(v)}" + (S.rt ? "" : $" · {G.Tnow() - x.t0}칸 보유"), 18, StkAxis));
                var pv = Ui.Label($"{G.sgnMan(v - x.cost)}\n{GameSim.pct(x.cost > 0 ? v / x.cost - 1 : 0)}", 24, UpDn(v - x.cost), true); pv.style.marginRight = 12; pv.style.unityTextAlign = TextAnchor.MiddleRight; row.Add(pv);
                row.Add(Ui.Chip(G.stockTradeOk() ? "절반" : G.v4 && G.stockOpen() ? "장 보기에서" : "장 마감", () => Order("절반 매도", "익절은 과학이다", "손절도 과학이다 (눈물)", "sell", "tk", kk, "frac", 0.5, "where", where), !G.stockTradeOk()));
                if (G.stockTradeOk())
                {   // 전량 매도는 한 번 더 눌러야 나감
                    string sk = $"sell|{kk}|all"; bool armed = OrdArmed(sk);
                    row.Add(Ui.Chip(armed ? "한 번 더: 전량" : "전량", Confirm(sk, true, () => Order("전량 매도", "익절은 과학이다", "손절도 과학이다 (눈물)", "sell", "tk", kk, "frac", 1, "where", where)), false, armed ? (Color?)Ui.Bad : null));
                }
                GoChart(info, kk);
                body.Add(row); n++;
            }
            foreach (var c in S.cps.ToList()) { body.Add(CoinRow(c)); n++; }
            if (n == 0) body.Add(Ui.Label("없음. 미래: \"현금 들고 있으면 인플레이션한테 지는 거야\" (빚은 더 빨리 큼)", 20, StkAxis));
        }
    }

    /// 캔들(또는 라인) + 이동평균 5·20 + 거래량 + 가격선(평단·진입·청산가) + 현재가 꼬리표 + 마우스 십자선
    class CandleChart : VisualElement
    {
        public static readonly Color Ma5C = new Color32(0xff, 0xd1, 0x66, 0xff);
        public static readonly Color Ma20C = new Color32(0xb4, 0x8c, 0xff, 0xff);
        const float PadL = 8, PadR = 150, PadT = 14, PadB = 26, Gap = 10;
        /// 거래량 막대 칸 높이 (폰 70 · 장 보기 데스크는 더 크게)
        readonly float VolH;
        /// 거래량 배수가 이 이상이면 금색 (작전 매집 · 끌어올리기 · 가짜 매집을 눈에 띄게)
        const double VolHot = 2;

        readonly List<Candle> all; readonly int bars; int n, off; double last;
        List<(double y, Color c, string l)> lines; readonly Func<double, string> fmt; readonly bool lineMode;
        double[] ma5, ma20;
        double lo, hi; int hover = -1; float grow = 1;
        readonly VisualElement labels; readonly Label tip;

        public CandleChart(List<Candle> hist, int bars, double lastPx, List<(double y, Color c, string l)> lines, Func<double, string> fmt, bool lineMode, float volH = 70)
        {
            all = hist; this.bars = bars; this.fmt = fmt; this.lineMode = lineMode; VolH = volH;
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

            // 거래량 (봉의 v = 평소의 몇 배). 최소 눈금 2배: 평소 봉이 꽉 차 보이지 않게
            double vmax = VolHot;
            for (int i = off; i < all.Count; i++) vmax = Math.Max(vmax, Vol(all[i]));
            for (int i = off; i < all.Count; i++)
            {
                var b = Bar(i); double vv = Vol(all[i]); float h = (float)(vv / vmax) * (VolH - 6) * (i == all.Count - 1 ? grow : 1);
                Color c; if (vv >= VolHot) { c = Ui.Gold; c.a = 0.85f; } else { c = b.c >= b.o ? Up : Dn; c.a = 0.45f; }
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

        static Color Up => GameController.StkUp;
        static Color Dn => GameController.StkDn;
        /// 옛 저장의 봉은 거래량이 없음 (0 이하) → 평소 1배
        static double Vol(Candle b) => b.v > 0 ? b.v : 1;

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
            Label L(string t, float x, float y, Color c, float size = 18, bool bold = false) { var l = Ui.Label(t, size, c, bold); Ui.Abs(l, x, y); l.pickingMode = PickingMode.Ignore; labels.Add(l); return l; }
            Color axis = GameController.StkAxis;
            for (int k = 0; k <= 4; k++) { float y = PadT + k * (PriceBottom - PadT) / 4; L(fmt(hi - k * (hi - lo) / 4), W - PadR + 8, y - 11, axis); }
            L("거래량", PadL + 4, PriceBottom + Gap + 2, axis, 18);
            for (int i = all.Count - 1, k = 0; i >= off; i -= 6, k += 6) L(k == 0 ? "지금" : $"-{k}봉", X(i) - 16, Hh - PadB + 2, axis, 18);
            foreach (var Ln in lines)
            {
                if (Ln.y < lo || Ln.y > hi) continue;
                var l = L(Ln.l, PadL + 6, Y(Ln.y) - 26, Ln.c, 18, true);
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
                + (!double.IsNaN(ma5[hover]) ? $"  MA5 {fmt(ma5[hover])}" : "") + $"  거래량 ×{Vol(b):0.0}";
            tip.style.color = GameController.UpDn(r);
            tip.style.display = DisplayStyle.Flex;
        }
    }

    /// 선 그래프: 스파크라인(축 없음) 또는 0 기준선 + 위아래 값 표시 (누적 손익)
    class LineChart : VisualElement
    {
        readonly List<double> v; readonly bool zero; readonly Func<double, string> fmt;
        static Color Up => GameController.StkUp; static Color Dn => GameController.StkDn;

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
            if (v.Count < 2) { var e = Ui.Label("아직 기록 없음 — 칸이 지나면 그려짐", 20, GameController.StkAxis); Ui.Abs(e, 20, contentRect.height / 2 - 12); Add(e); return; }
            var (lo, hi) = Range(); Color axis = GameController.StkAxis;
            void L(string t, double y) { var l = Ui.Label(t, 18, axis); Ui.Abs(l, contentRect.width - PadR + 8, Y(y, lo, hi) - 11); l.pickingMode = PickingMode.Ignore; Add(l); }
            L(fmt(hi), hi); L(fmt(lo), lo); if (zero && hi > 0 && lo < 0) L("0", 0);
        }
    }
}
