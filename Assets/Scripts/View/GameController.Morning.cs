using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using KwGame.Sim;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // 아침 한 장: 저녁 정산과 같은 자리 · 같은 모양 (왼쪽 미래 + 말풍선, 오른쪽 카드).
    // 예전엔 글 15줄이 가운데 카드로 계획판 위에 겹쳐 떴다 → ① 납부 일정(4칸) ② 어제(표) ③ 오늘 달라진 것(꼬리표 줄)만.
    // 매일 같은 말은 빼고 "오늘 새로 생긴 것 · 오늘 해야 하는 것"만 줄로 올린다 (잠김 목록 · 한도는 주 첫날만).
    public partial class GameController
    {
        IEnumerator Morning(SimEvent e)
        {
            if (!(e["v4"] is bool v4 && v4)) { yield return MorningOld(e); yield break; }
            SettleClose();
            int ch = (int)e.Num("ch"), wday = (int)e.Num("day");
            int day = (int)((e.Num("month") - 1) * D.RULES.MONTH_DAYS + wday);
            bool first = day <= 1, wkd = e["wk"] is bool wk && wk, weekStart = wday == 1;
            double dd = e.Num("dd");

            // 띠 아래 전부를 쓰는 층. 계획판 · 대사창 · 선택지 상자는 이 동안 숨음 (정산 한 장과 같은 규칙: settleEl)
            settleEl = new VisualElement { name = "morning" }; Ui.Abs(settleEl, 0, StripH, 0, 0);
            stage.Insert(Math.Max(0, stage.IndexOf(toastCol)), settleEl);
            if (deskEl != null) deskEl.style.display = DisplayStyle.None;
            SetBg("room", false); npcKey = null; kimKey = null; cgKey = null; miraiOn = true;
            HoldFace("pajama");   // 밤잠 자고 일어난 아침
            DrawStage();
            LayoutForMode();
            miraiEl.style.left = PlanMiraiX;

            // 왼쪽: 미래 아침 한마디 (계획판 말풍선 자리)
            if (!string.IsNullOrEmpty(e.Str("mline")))
            {
                var bub = Ui.Box(new Color(1, 1, 1, 0.96f), 16, 18); Ui.Abs(bub, PlanBubbleX, 20); bub.style.maxWidth = PlanBubbleW; bub.pickingMode = PickingMode.Ignore;
                var say = Ui.Label(e.Str("mline"), 22, Ui.Ink); say.pickingMode = PickingMode.Ignore; bub.Add(say);
                settleEl.Add(bub);
            }

            // 오른쪽: 카드 (계획판 자리)
            var card = GlassBox(32, 18); card.name = "morning-card"; Ui.Abs(card, null, PlanTopGap, PlanRight); card.style.width = PlanW;
            float H = stage.layout.height > 10 ? stage.layout.height : 1080;
            card.style.maxHeight = H - StripH - PlanTopGap - 24; card.style.overflow = Overflow.Hidden;
            settleEl.Add(card);
            // 머리 · 시작 버튼은 늘 보이고, 가운데(body)만 넘치면 스크롤 — 줄이 많은 날에도 버튼이 잘리지 않음
            var sv = new ScrollView(ScrollViewMode.Vertical); sv.name = "morning-body"; sv.style.flexShrink = 1; sv.style.flexGrow = 0; sv.contentViewport.style.overflow = Overflow.Hidden;
            var body = sv.contentContainer;
            void Line() { var ln = Ui.Box(new Color(1, 1, 1, 0.16f)); ln.style.height = 2; ln.style.marginTop = 16; ln.style.marginBottom = 12; ln.style.flexShrink = 0; body.Add(ln); }
            Label Pill(string t, Color c)
            {
                var p = Ui.Label(t, 18, c, true); p.style.whiteSpace = WhiteSpace.NoWrap; p.style.flexShrink = 0;
                Ui.Border(p, c, 1); Ui.Radius(p, 8); p.style.paddingLeft = 10; p.style.paddingRight = 10; p.style.paddingTop = 2; p.style.paddingBottom = 2;
                return p;
            }

            // ── 머리: 며칠째 아침 · 장 · 만기까지
            var head = Ui.Row(); head.style.flexShrink = 0; card.Add(head);
            var ttl = Ui.Label($"{day}일째 아침 ({"월화수목금토일"[(Math.Max(1, wday) - 1) % 7]})", 36, Ui.Gold, true); ttl.style.flexGrow = 1; ttl.style.whiteSpace = WhiteSpace.NoWrap; head.Add(ttl);
            if (wkd) { var w = Pill("주말 · 국장 휴장", Ui.Accent); w.style.marginRight = 8; head.Add(w); }
            var chp = Pill($"{(e.Num("part") > 1 ? "2부 · " : "")}{ch}장 {G.chapterName(ch)}", Ui.Dim); chp.style.marginRight = 8; head.Add(chp);
            head.Add(Pill($"만기까지 {e.Num("left"):0}일", e.Num("left") <= 7 ? Ui.Bad : Ui.Text));
            card.Add(sv);

            // ── ① 납부 일정: 주마다 얼마 · 지금 돈으로 어디까지 닿나
            bool loanNow = G.loanOk(), shortNow = G.shortOk();
            var L = G.gateLadder();
            if (L.Count > 0)
            {
                var cap = Ui.Label("납부 일정 — 마지막 칸까지 내면 빚 0원", 20, Ui.Dim); cap.style.marginTop = 14; cap.style.flexShrink = 0; body.Add(cap);
                var lad = Ui.Row(); lad.name = "morning-ladder"; lad.style.marginTop = 8; lad.style.alignItems = Align.Stretch; lad.style.flexShrink = 0; body.Add(lad);
                for (int i = 0; i < L.Count; i++)
                {
                    var st = L[i]; bool now = st.state == 1, past = st.state == 0 || st.paid, last = i == L.Count - 1;
                    var tile = Ui.Box(now && !past ? new Color(1f, 0.82f, 0.4f, 0.10f) : new Color(1, 1, 1, 0.05f), 14, 12);
                    tile.style.flexGrow = 1; tile.style.flexBasis = 0; tile.style.marginRight = last ? 0 : 10;
                    Ui.Border(tile, now ? Ui.Gold : new Color(1, 1, 1, 0.12f), now ? 2 : 1);
                    var wl = Ui.Label(last ? $"{st.week}주 · 만기" : $"{st.week}주", 20, now ? Ui.Gold : Ui.Dim, true); wl.style.whiteSpace = WhiteSpace.NoWrap; tile.Add(wl);
                    var al = Ui.Label(past ? "냄" : G.man(st.due), 32, past ? Ui.Good : now ? Ui.Text : new Color(0.8f, 0.8f, 0.86f), true); al.style.whiteSpace = WhiteSpace.NoWrap; al.style.marginTop = 2; tile.Add(al);
                    string sub; Color sc;
                    if (past) { sub = now ? "이번 주 납부 끝" : ""; sc = Ui.Good; }
                    else if (now) { sub = (dd <= 0 ? "오늘 밤" : $"D-{dd:0}") + " · " + (st.gap <= 0 ? "다 모음" : $"{G.man(st.gap)} 모자람"); sc = st.gap <= 0 ? Ui.Good : dd <= 1 ? Ui.Bad : Ui.Gold; }
                    else { sub = st.gap <= 0 ? "지금 돈으로 가능" : $"{G.man(st.gap)} 더 벌어야"; sc = st.gap <= 0 ? Ui.Good : Ui.Dim; }
                    if (sub != "") { var sl = Ui.Label(sub, 18, sc, now); sl.style.marginTop = 2; tile.Add(sl); }
                    lad.Add(tile);
                }
                var cur = L.FirstOrDefault(x => x.state == 1);
                if (cur != null && !cur.paid)
                {
                    var br = Ui.Label($"이번 주 {G.man(cur.due)} = 이자 {G.man(cur.interest)} + 원금 {G.man(cur.principal)}", 20, Ui.Dim); br.style.marginTop = 10; br.style.flexShrink = 0; body.Add(br);
                }
                if (S.missN > 0) { var ml = Ui.Label($"미납 {S.missN}/{D.RULES.V4_MISS_MAX} — 이번 주도 못 내면 원양어선", 22, Ui.Bad, true); ml.style.marginTop = 6; ml.style.flexShrink = 0; body.Add(ml); }
                if (first || DuoOk()) { var gl = Ui.Label(DuoGoal(), 18, DuoOk() ? Ui.Good : Ui.Dim); gl.style.marginTop = 6; gl.style.flexShrink = 0; body.Add(gl); }
            }
            else
            {   // 관문 규칙이 아닌 판: 이자일만
                bool paid = e["paid"] is bool pd && pd;
                var il = Ui.Label(paid ? "이번 주 이자 냄" : $"이자일 {(dd <= 0 ? "오늘 밤" : $"D-{dd:0}")} · 이자 {Man(e.Num("due"))}", 24, paid ? Ui.Good : dd <= 1 ? Ui.Bad : Ui.Text, true); il.style.marginTop = 14; body.Add(il);
            }

            // ── ② 어제: 큰 것 3줄 + 합계 (표: 이름 왼쪽 · 금액 오른쪽)
            var Y = e["Y"] as List<Dictionary<string, object>>;
            if (Y != null && Y.Count > 0 && !first)
            {
                Line();
                var yr = Ui.Row(); yr.style.flexShrink = 0; body.Add(yr);
                var yk = Ui.Label("어제", 28, Ui.Text, true); yk.style.flexGrow = 1; yr.Add(yk);
                double net = e.Num("net");
                if (!string.IsNullOrEmpty(e.Str("netConv"))) { var nc = Ui.Label(e.Str("netConv"), 18, Ui.Dim); nc.style.marginRight = 14; nc.style.whiteSpace = WhiteSpace.NoWrap; yr.Add(nc); }
                var yv = Ui.Label(G.sgnMan(net), 36, net == 0 ? Ui.Text : UpDn(net), true); yv.style.whiteSpace = WhiteSpace.NoWrap; yr.Add(yv);
                var top = Y.OrderByDescending(y => Math.Abs(Convert.ToDouble(y["amt"]))).Take(3).ToList();
                foreach (var y in top)
                {
                    double amt = Convert.ToDouble(y["amt"]);
                    var r = Ui.Row(); r.style.marginTop = 6; r.style.flexShrink = 0; body.Add(r);
                    var kl = Ui.Label(Convert.ToString(y["label"]), 22, Ui.Dim); kl.style.flexGrow = 1; kl.style.flexShrink = 1; r.Add(kl);
                    var vl = Ui.Label(G.sgnMan(amt), 22, UpDn(amt), true); vl.style.whiteSpace = WhiteSpace.NoWrap; vl.style.flexShrink = 0; vl.style.marginLeft = 12; r.Add(vl);   // 돈 손익 = 폰과 같은 색 (이익 빨강 · 손실 파랑)
                }
                if (Y.Count > top.Count) { var more = Ui.Label($"그 밖 {Y.Count - top.Count}건", 18, Ui.Dim); more.style.marginTop = 6; more.style.flexShrink = 0; body.Add(more); }
            }

            // ── ③ 오늘: 새로 생긴 것 · 해야 하는 것만 (꼬리표 + 한 줄)
            var rows = new List<(string tag, Color c, string text)>();
            if (wkd) rows.Add(("주말", Ui.Accent, "국장이 쉬어요. 코인만 열리고, 하루 종일 미래 · 생활 칸이에요."));
            if (!string.IsNullOrEmpty(e.Str("ev"))) rows.Add(("사건", Ui.Gold, e.Str("ev")));
            if (G.promNow() is GameSim.Prom pm) { rows.Add(("부탁", Ui.Accent, pm.hud)); if (!first) CoachCtx("mirai"); }   // 둘째 날부터 첫 부탁 → 미래 설명 카드
            if (wkd) CoachCtx("unlock");   // 첫 주말 아침 (첫 해금이 먼저면 그때)
            {   // 오늘 새로 열린 것 (한 줄)
                var op = new List<string>();
                if (mShortSeen == false && shortNow) op.Add("숏 · 곱버스");
                if (mLoanSeen == false && loanNow) op.Add("대출");
                if (op.Count > 0) rows.Add(("열림", Ui.Good, string.Join(" · ", op) + " — 오늘부터 쓸 수 있어요."));
            }
            if (first || weekStart)
            {   // 주 첫날에만: 이번 주 한도 · 아직 잠긴 것 (한 줄)
                var wk1 = new List<string>();
                if (G.marginNext() is string mn) wk1.Add("코인 " + mn);
                if (!shortNow && G.shortLockWhy() is string sw) wk1.Add("숏: " + sw);
                if (!loanNow) wk1.Add("대출: " + (G.gateOn ? G.T("v4.gate.loanNext") : G.creditNext() ?? ""));
                if (wk1.Count > 0) rows.Add(("이번 주", Ui.Dim, string.Join(" · ", wk1)));
            }
            var bfs = G.buffs(); int bt = G.buffTier();
            if (bt != mBuffSeen && (bfs.Count > 0 || first)) rows.Add(("호감", new Color(1f, 0.6f, 0.75f), bfs.Count > 0 ? "켜진 버프: " + string.Join(" · ", bfs) : G.T("v4.buff.help")));
            mLoanSeen = loanNow; mShortSeen = shortNow; mBuffSeen = bt;
            if (rows.Count > 0)
            {
                Line();
                var tk = Ui.Label("오늘", 28, Ui.Text, true); tk.style.flexShrink = 0; body.Add(tk);
                foreach (var (tag, c, text) in rows)
                {
                    var r = Ui.Row(); r.style.alignItems = Align.FlexStart; r.style.marginTop = 8; r.style.flexShrink = 0; body.Add(r);
                    var pl = Pill(tag, c); pl.style.marginRight = 12; pl.style.marginTop = 1; pl.style.minWidth = 76; pl.style.unityTextAlign = TextAnchor.MiddleCenter; r.Add(pl);
                    var tl = Ui.Label(text, 22, c == Ui.Dim ? Ui.Dim : Ui.Text); tl.style.flexGrow = 1; tl.style.flexShrink = 1; tl.style.flexBasis = 0; r.Add(tl);
                }
            }

            var go = Ui.Button("오늘 시작", RequestAdvance, "클릭 · Space · Enter", false, Ui.Accent, 26);
            go.name = "morning-go"; go.style.marginTop = 18; go.style.marginBottom = 0; go.style.alignItems = Align.Center; go.style.flexShrink = 0; card.Add(go);

            if (!autoSkipDialog)
            {
                card.style.translate = new Translate(40, 0); card.style.opacity = 0;
                yield return Tween(0.16f, p => { card.style.translate = new Translate(40 * (1 - EaseOut(p)), 0); card.style.opacity = p; });
            }
            card.style.translate = new Translate(0, 0); card.style.opacity = 1;
            yield return WaitClick();
            SettleClose();
        }

        /// 옛 칸 방식(v4 아님) 아침 카드
        IEnumerator MorningOld(SimEvent e)
        {
            modal.Clear(); modal.style.display = DisplayStyle.Flex;
            HoldFace("pajama");
            var card = Card(900);
            card.Add(Ui.Label($"{e.Num("month")}개월차 {e.Num("day")}일 아침", 40, Ui.Gold, true));
            card.Add(Ui.Label(e["paid"] is bool p && p ? "이번 달 이자 냄" : $"이자일까지 D-{e.Num("dd")} · 이자 {Man(e.Num("due"))}", 26, Ui.Dim));
            var Y = e["Y"] as List<Dictionary<string, object>>;
            if (Y != null && Y.Count > 0)
            {
                card.Add(Ui.Label("어제 결산", 28, Ui.Text, true));
                foreach (var y in Y.Take(8)) card.Add(Ui.Label($"· {y["label"]}  {G.sgnMan(Convert.ToDouble(y["amt"]))}", 22, UpDn(Convert.ToDouble(y["amt"]))));
                card.Add(Ui.Label($"합계 {G.sgnMan(e.Num("net"))} ({e.Str("netConv")})", 24, e.Num("net") == 0 ? Ui.Text : UpDn(e.Num("net")), true));
            }
            if (!string.IsNullOrEmpty(e.Str("ev"))) card.Add(Ui.Label("오늘의 사건: " + e.Str("ev"), 24, Ui.Gold));
            card.Add(Ui.Label("미래: " + e.Str("mline"), 24, Ui.Accent));
            card.Add(Ui.Label("(클릭해서 계속)", 20, Ui.Dim));
            modal.Add(card);
            yield return WaitClick();
            modal.style.display = DisplayStyle.None;
        }
    }
}
