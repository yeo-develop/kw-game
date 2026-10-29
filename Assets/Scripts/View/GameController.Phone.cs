using System;
using System.Collections.Generic;
using System.Linq;
using KwGame.Sim;
using Newtonsoft.Json.Linq;
using DG.Tweening;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // 폰: 위 상태 표시줄 · 가운데 앱 화면 · 아래 앱 바(개미증권 / 카톡 / 주갤 / 뉴스 / 정보 수첩)
    // 앱마다 실제 서비스 느낌으로: 카톡(하늘색 배경·노란 말풍선) · 주갤(디시 파란 머리·흰 목록) · 뉴스(포털 흰 카드) · 정보 수첩(누런 종이)
    public partial class GameController
    {
        static readonly Color KkBg = new Color32(0xb2, 0xc7, 0xd9, 0xff), KkHead = new Color32(0xa9, 0xbd, 0xce, 0xff), KkMe = new Color32(0xfe, 0xe5, 0x00, 0xff);
        static readonly Color DcBlue = new Color32(0x3b, 0x48, 0x90, 0xff), DcRed = new Color32(0xd3, 0x19, 0x00, 0xff), DcLine = new Color32(0xe5, 0xe5, 0xe5, 0xff);
        static readonly Color Ink = new Color32(0x22, 0x22, 0x28, 0xff), Ink2 = new Color32(0x6e, 0x6e, 0x78, 0xff), Paper = new Color32(0xfb, 0xf5, 0xe1, 0xff), PaperLine = new Color32(0xe4, 0xd8, 0xb4, 0xff);
        static readonly Color NewsBg = new Color32(0xf2, 0xf3, 0xf5, 0xff), NewsGreen = new Color32(0x03, 0xc7, 0x5a, 0xff);
        static readonly Color OkGreen = new Color32(0x2e, 0x9e, 0x5b, 0xff), Purple = new Color32(0x8e, 0x44, 0xad, 0xff), Amber = new Color32(0xd9, 0x9a, 0x1e, 0xff), NoteGold = new Color32(0xc8, 0x9b, 0x3c, 0xff),
            DcSoft = new Color32(0xf3, 0xf4, 0xf9, 0xff), MinePink = new Color32(0xff, 0xf6, 0xf9, 0xff), BodyGray = new Color32(0xfa, 0xfa, 0xfb, 0xff), NoteBrown = new Color32(0x8a, 0x5a, 0x2b, 0xff), DueBg = new Color32(0xf3, 0xee, 0xdc, 0xff),
            TierRep = new Color32(0x1f, 0x6f, 0xd1, 0xff), TierWalk = new Color32(0x8a, 0x6a, 0x4a, 0xff), TierJji = new Color32(0xd9, 0x6a, 0x1e, 0xff);

        ScrollView phoneSv; string phoneSvKey;
        string kkRoom = "m", gallTab = "all"; int gallOpen;

        void RenderPhone()
        {
            bool can = PHONE_OK.Contains(S.pending?.t);
            phone.Clear();

            // 상태 표시줄
            var bar = Ui.Row(); bar.style.flexShrink = 0; bar.style.height = 40; bar.style.paddingLeft = 18; bar.style.paddingRight = 6; phone.Add(bar);
            bar.Add(Ui.Label(G.clockNow(), 20, Ui.Text, true));
            if (!can) { var lk = Ui.Label("  지금은 폰 못 봄", 18, Ui.Bad); bar.Add(lk); }
            var sp = new VisualElement(); sp.style.flexGrow = 1; bar.Add(sp);
            bar.Add(Ui.Label("LTE  ▮▮▮  " + Math.Max(5, 100 - (int)(S.rt ? (S.min - D.RULES.RT_DAY0) / 11 : S.slot * 30)) + "%", 18, Ui.Dim));
            var cl = Ui.Chip("닫기 (P)", TogglePhone, false, new Color(1, 1, 1, 0.08f)); cl.style.marginLeft = 14; cl.style.marginBottom = 0; cl.style.paddingTop = 4; cl.style.paddingBottom = 4; bar.Add(cl);

            // 앱 화면
            var screen = new VisualElement(); screen.style.flexGrow = 1; screen.style.flexShrink = 1; screen.style.minHeight = 0; Ui.Radius(screen, 18); screen.style.overflow = Overflow.Hidden;
            screen.style.backgroundColor = phoneTab == "kakao" ? KkBg : phoneTab == "gall" ? Color.white : phoneTab == "news" ? NewsBg : phoneTab == "tips" ? Paper : StkBg;
            phone.Add(screen);
            var head = AppHeader(screen);
            var sv = new ScrollView(); sv.style.flexGrow = 1; sv.contentViewport.style.overflow = Overflow.Hidden; screen.Add(sv);   // 테마 USS 가 없어서 직접 잘라야 함
            string scrollKey = phoneTab + "/" + stkTab + "/" + kkRoom + "/" + gallTab;   // 주문 버튼 눌러 다시 그려도 보던 자리 유지
            if (phoneSv != null && phoneSvKey == scrollKey) { var keep = phoneSv.scrollOffset; sv.schedule.Execute(() => sv.scrollOffset = keep); }
            else if (phoneTab == "kakao") sv.schedule.Execute(() => sv.scrollOffset = new Vector2(0, 1e6f));   // 카톡은 새 방 열면 맨 아래(최신)부터
            phoneSv = sv; phoneSvKey = scrollKey;
            var body = sv.contentContainer; body.style.paddingLeft = 16; body.style.paddingRight = 16; body.style.paddingTop = 12; body.style.paddingBottom = 16;
            sv.SetEnabled(can);
            string where = S.pending?.t == "brokerTrade" ? "broker" : "app";
            switch (phoneTab)
            {
                case "stock": StockApp(body, where); break;
                case "kakao": KakaoApp(head, body); break;
                case "gall": GallApp(head, body); break;
                case "news": NewsApp(body); break;
                case "tips": TipsApp(body); break;
            }
            NoShrink(body);

            // 앱 바
            var nav = Ui.Row(); nav.style.flexShrink = 0; nav.style.height = 70; nav.style.marginTop = 8; nav.style.justifyContent = Justify.SpaceAround; phone.Add(nav);
            int news = S.feed.Count(f => f.kind == "news") > 0 ? Math.Min(S.fUnread, 99) : 0;
            foreach (var (k, n, c, badge) in new[] {
                ("stock", "개미증권", StkUp, 0), ("kakao", "카톡", KkMe, G.kUnread()), ("gall", "주갤", DcBlue, Math.Min(S.gNew, 99)),
                ("news", "뉴스", NewsGreen, news), ("tips", "정보 수첩", NoteGold, G.activeTips().Count) })
            {
                string kk = k; bool on = phoneTab == k;
                var b = new VisualElement(); b.style.alignItems = Align.Center; b.style.width = 120; b.style.paddingTop = 4; Ui.Radius(b, 14);
                if (on) b.style.backgroundColor = new Color(1, 1, 1, 0.08f);
                var ic = Ui.Box(c, 0, 12); ic.style.width = 40; ic.style.height = 40; ic.style.alignItems = Align.Center; ic.style.justifyContent = Justify.Center;
                var il = Ui.Label(n.Substring(0, 1), 20, k == "kakao" ? Ink : Color.white, true); il.pickingMode = PickingMode.Ignore; ic.Add(il);
                if (badge > 0)
                {
                    var bd = Ui.Label(badge.ToString(), 14, Color.white, true); Ui.Abs(bd, null, -6, -10); bd.style.backgroundColor = DcRed; Ui.Radius(bd, 9);
                    bd.style.paddingLeft = 6; bd.style.paddingRight = 6; bd.pickingMode = PickingMode.Ignore; ic.Add(bd);
                }
                b.Add(ic);
                var nl = Ui.Label(n, 16, on ? Ui.Text : Ui.Dim, on); nl.style.marginTop = 3; b.Add(nl);
                foreach (var ch in b.Children()) ch.pickingMode = PickingMode.Ignore;
                b.RegisterCallback<ClickEvent>(_ => OpenApp(kk));
                nav.Add(b);
            }
        }

        void OpenApp(string k)
        {
            phoneTab = k;
            if (k == "kakao") Send("read", "what", "kakao", "room", kkRoom);
            if (k == "news") Send("read", "what", "news");
            if (k == "gall") Send("read", "what", "gall");
            RenderAll();
        }
        /// 정보 → 개미증권 차트·주문으로 바로
        void OpenTrade(string tk)
        {
            phoneTab = "stock"; stkTab = "detail"; stkSel = tk; stkAmt = null; stkMsg = "";
            RenderAll();
        }

        VisualElement AppHeader(VisualElement screen)
        {
            if (phoneTab == "stock") return null;
            var h = Ui.Row(); h.style.flexShrink = 0; h.style.minHeight = 64; h.style.paddingLeft = 20; h.style.paddingRight = 16; screen.Add(h);
            switch (phoneTab)
            {
                case "kakao": h.style.backgroundColor = KkHead; break;
                case "gall": h.style.backgroundColor = DcBlue; break;
                case "news":
                    h.style.backgroundColor = Color.white; h.style.borderBottomWidth = 1; h.style.borderBottomColor = DcLine;
                    h.Add(Ui.Label("개미뉴스", 26, NewsGreen, true)); h.Add(Ui.Label("  증권 · 코인 · 속보", 16, Ink2));
                    break;
                case "tips":
                    h.style.backgroundColor = NoteBrown;
                    h.Add(Ui.Label("정보 수첩", 26, Paper, true)); h.Add(Ui.Label($"  진행 중 {G.activeTips().Count}개", 16, new Color(1, 1, 1, 0.7f)));
                    break;
            }
            return h;
        }

        static VisualElement Avatar(string name, Color c, float size = 44)
        {
            var a = Ui.Box(c, 0, size * 0.38f); a.style.width = size; a.style.height = size; a.style.flexShrink = 0;
            a.style.alignItems = Align.Center; a.style.justifyContent = Justify.Center;
            string s = Ui.Clean(name ?? "?"); var l = Ui.Label(s.Length > 0 ? s.Substring(0, 1) : "?", size * 0.45f, Color.white, true); l.pickingMode = PickingMode.Ignore; a.Add(l);
            return a;
        }
        static Label Tag(string text, Color fg, Color bg, float size = 15)
        {
            var b = Ui.Label(text, size, fg, true); b.style.backgroundColor = bg; Ui.Radius(b, 5);
            b.style.paddingLeft = 6; b.style.paddingRight = 6; b.style.paddingTop = 1; b.style.paddingBottom = 1; b.style.marginRight = 6;
            return b;
        }
        static Button LinkBtn(string text, Action a, Color fg, Color bg)
        {
            var b = Ui.Chip(text, a, false, bg); b.Q<Label>().style.color = fg; b.style.marginBottom = 0; Ui.Border(b, new Color(0, 0, 0, 0.12f), 1);
            return b;
        }

        // ---------- 카톡 알림 (PC 카톡처럼 오른쪽 아래에서 올라옴, 누르면 그 방 열림) ----------
        VisualElement kkPopCol;
        readonly HashSet<KMsg> kkPopped = new HashSet<KMsg>();
        GameSim kkPopFor;

        /// sim 의 "kakao" 이벤트마다: 그 방에서 아직 안 띄운 상대 메시지를 띄움 (새 게임·불러오기 직후 쌓인 건 건너뜀)
        void KakaoNotify(string room)
        {
            if (kkPopFor != G) { kkPopFor = G; kkPopped.Clear(); foreach (var L in S.kk.Values) foreach (var m in L) kkPopped.Add(m); return; }
            if (room == null || !S.kk.TryGetValue(room, out var msgs)) return;
            foreach (var m in msgs)
            {
                if (!kkPopped.Add(m) || m.w == "me" || m.w == "sys") continue;
                if (phoneOpen && phoneTab == "kakao" && kkRoom == room) continue;   // 이미 그 방을 보고 있음
                KakaoPop(room, m.x);
            }
        }

        void KakaoPop(string room, string text)
        {
            if (kkPopCol == null)
            {
                kkPopCol = new VisualElement(); Ui.Abs(kkPopCol, null, null, 24, 24); kkPopCol.style.width = 460;
                kkPopCol.style.flexDirection = FlexDirection.ColumnReverse; kkPopCol.pickingMode = PickingMode.Ignore;
                stage.Add(kkPopCol);
            }
            kkPopCol.BringToFront();
            var r = ROOMS.First(x => x.k == room);
            var card = new VisualElement(); card.style.flexDirection = FlexDirection.Row; card.style.alignItems = Align.Center;
            card.style.backgroundColor = Color.white; Ui.Radius(card, 10); Ui.Pad(card, 14); card.style.marginTop = 10;
            Ui.Border(card, new Color(0, 0, 0, 0.12f), 1);
            var pic = new VisualElement(); pic.style.width = pic.style.height = 64; Ui.Radius(pic, 22); pic.style.backgroundColor = r.c; pic.style.flexShrink = 0; pic.style.overflow = Overflow.Hidden;
            var sp = room == "m" ? ArtCatalog.Mirai("base") : null;
            if (sp != null) { pic.style.backgroundImage = new StyleBackground(sp); pic.style.backgroundSize = new BackgroundSize(BackgroundSizeType.Cover); pic.style.backgroundPositionY = new BackgroundPosition(BackgroundPositionKeyword.Top); }
            else { var ini = Ui.Label(r.n.Substring(0, 1), 28, Color.white, true); ini.style.unityTextAlign = TextAnchor.MiddleCenter; ini.style.flexGrow = 1; pic.Add(ini); }
            card.Add(pic);
            var col = new VisualElement(); col.style.marginLeft = 14; col.style.flexShrink = 1; col.style.flexGrow = 1;
            var top = Ui.Row(); top.style.justifyContent = Justify.SpaceBetween;
            top.Add(Ui.Label(r.n, 20, Ink, true)); top.Add(Ui.Label("카카오톡", 15, Ink2));
            col.Add(top);
            var body = Ui.Label(text.Length > 60 ? text.Substring(0, 60) + "…" : text, 20, Ink); body.style.whiteSpace = WhiteSpace.Normal; body.style.marginTop = 4; col.Add(body);
            card.Add(col);
            card.RegisterCallback<ClickEvent>(_ => { card.RemoveFromHierarchy(); phoneOpen = true; phoneTab = "kakao"; kkRoom = room; Send("read", "what", "kakao", "room", room); RenderAll(); });
            kkPopCol.Insert(0, card);
            while (kkPopCol.childCount > 3) kkPopCol.RemoveAt(kkPopCol.childCount - 1);
            card.style.opacity = 0; card.style.translate = new Translate(0, 40);
            var seq = DOTween.Sequence().SetTarget(card).SetLink(gameObject).SetUpdate(true);
            seq.Append(DOTween.To(() => 0f, v => { card.style.opacity = v; card.style.translate = new Translate(0, 40 * (1 - v)); }, 1f, 0.25f).SetEase(Ease.OutCubic));
            seq.AppendInterval(5f);
            seq.Append(DOTween.To(() => 1f, v => card.style.opacity = v, 0f, 0.3f));
            seq.OnComplete(() => card.RemoveFromHierarchy());
            card.RegisterCallback<DetachFromPanelEvent>(_ => seq.Kill());
        }

        // ---------- 카톡 ----------
        static readonly (string k, string n, Color c)[] ROOMS = { ("m", "미래 ♥", (Color)new Color32(0xff, 0x8f, 0xb1, 0xff)), ("kim", "김사장 캐피탈", (Color)new Color32(0x44, 0x44, 0x4c, 0xff)), ("hy", "형나믿지", (Color)new Color32(0x6a, 0x9b, 0x5a, 0xff)) };
        void KakaoApp(VisualElement head, VisualElement body)
        {
            var room = ROOMS.First(r => r.k == kkRoom);
            head.Add(Ui.Label(room.n, 24, Ink, true));
            var sp = new VisualElement(); sp.style.flexGrow = 1; head.Add(sp);
            foreach (var r in ROOMS)
            {
                string k = r.k; int un = S.kun[k];
                var b = LinkBtn(r.n.Replace(" ♥", "") + (un > 0 ? $" {un}" : ""), () => { kkRoom = k; Send("read", "what", "kakao", "room", k); RenderAll(); }, k == kkRoom ? Ink : Ink2, k == kkRoom ? Color.white : new Color(1, 1, 1, 0.45f));
                b.style.marginLeft = 6; head.Add(b);
            }

            var msgs = S.kk[kkRoom]; int lastDay = -1;
            if (msgs.Count == 0) { var e = Ui.Label("대화 없음", 20, Ink2); e.style.alignSelf = Align.Center; e.style.marginTop = 30; body.Add(e); }
            foreach (var m in msgs.Skip(Math.Max(0, msgs.Count - 30)))
            {
                if (m.d != lastDay)
                {
                    lastDay = m.d;
                    var dl = Ui.Label($"{(m.d - 1) / D.RULES.MONTH_DAYS + 1}개월 {(m.d - 1) % D.RULES.MONTH_DAYS + 1}일", 15, Color.white); dl.style.alignSelf = Align.Center; dl.style.backgroundColor = new Color(0, 0, 0, 0.18f);
                    Ui.Radius(dl, 10); dl.style.paddingLeft = 10; dl.style.paddingRight = 10; dl.style.marginTop = 6; dl.style.marginBottom = 8; body.Add(dl);
                }
                KkBubble(body, m.w, m.x, m.t, room);
            }
            if (kkRoom == "m") foreach (var x in aiKakao) { int i = x.IndexOf("미래: "); KkBubble(body, "m", i >= 0 ? x.Substring(i + 4) : x, x.StartsWith("[") ? x.Substring(1, 5) : "", room); }   // LLM 카톡 (화면 전용)

            if (S.kq != null && kkRoom == "m")
            {   // 답장 고르기 = 키보드 자리
                var kb = Ui.Box(Color.white, 14, 14); kb.style.marginTop = 10; body.Add(kb);
                kb.Add(Ui.Label("미래가 답장 기다림 · " + D.KQ[S.kq.i].q, 19, Ink2, true));
                for (int i = 0; i < S.kq.opts.Count; i++)
                {
                    int k = i; var b = LinkBtn(S.kq.opts[i].l, () => Send("kqReply", "i", k), Ink, KkMe); b.style.marginTop = 8; b.style.alignSelf = Align.FlexStart; kb.Add(b);
                }
            }
            else if (S.kq != null) { var n = LinkBtn("미래가 답장 기다림 →", () => { kkRoom = "m"; Send("read", "what", "kakao", "room", "m"); RenderAll(); }, Ink, KkMe); n.style.marginTop = 10; n.style.alignSelf = Align.Center; body.Add(n); }
        }
        void KkBubble(VisualElement body, string w, string x, string t, (string k, string n, Color c) room)
        {
            if (w == "sys")
            {
                var s = Ui.Label(x, 16, Ink2); s.style.alignSelf = Align.Center; s.style.unityTextAlign = TextAnchor.MiddleCenter; s.style.marginBottom = 8; s.style.maxWidth = 600; body.Add(s);
                return;
            }
            bool me = w == "me";
            var row = Ui.Row(); row.style.alignItems = Align.FlexStart; row.style.marginBottom = 10; row.style.justifyContent = me ? Justify.FlexEnd : Justify.FlexStart; body.Add(row);
            if (!me) { var av = Avatar(room.n, room.c, 46); av.style.marginRight = 10; row.Add(av); }
            var col = new VisualElement(); col.style.maxWidth = 560; col.style.flexShrink = 1;
            if (!me) { var nm = Ui.Label(w == "m" ? "미래" : w == "kim" ? "김사장" : "형나믿지", 16, Ink); nm.style.marginBottom = 3; col.Add(nm); }
            var line = Ui.Row(); line.style.alignItems = Align.FlexEnd; line.style.flexDirection = me ? FlexDirection.RowReverse : FlexDirection.Row; col.Add(line);
            var bub = Ui.Label(x, 20, Ink); bub.style.backgroundColor = me ? KkMe : Color.white; Ui.Radius(bub, 14);
            bub.style.paddingLeft = 14; bub.style.paddingRight = 14; bub.style.paddingTop = 9; bub.style.paddingBottom = 9; bub.style.flexShrink = 1;
            line.Add(bub);
            var tl = Ui.Label(t ?? "", 13, Ink2); tl.style.marginLeft = 6; tl.style.marginRight = 6; tl.style.flexShrink = 0; line.Add(tl);
            row.Add(col);
        }

        // ---------- 주갤 (디시 느낌) ----------
        void GallApp(VisualElement head, VisualElement body)
        {
            var tc = new VisualElement(); tc.style.paddingTop = 8; tc.style.paddingBottom = 8; head.Add(tc);
            tc.Add(Ui.Label("주식 갤러리", 26, Color.white, true));
            tc.Add(Ui.Label($"내 명성 {S.galFame} · {G.rankOf(S.galFame).name} · 오늘 쓴 글 {G.wroteToday()}/{D.RULES.WRITE_MAX}", 15, new Color(1, 1, 1, 0.75f)));
            var sp = new VisualElement(); sp.style.flexGrow = 1; head.Add(sp);
            foreach (var (k, n) in new[] { ("all", "전체글"), ("best", "개념글"), ("tip", "찌라시") })
            {
                string kk = k; var b = LinkBtn(n, () => { gallTab = kk; gallOpen = 0; RenderAll(); }, kk == gallTab ? DcBlue : Color.white, kk == gallTab ? Color.white : new Color(1, 1, 1, 0.14f));
                b.style.marginLeft = 6; head.Add(b);
            }

            // 글쓰기 (말머리 버튼)
            var wr = Ui.Row(); wr.style.flexWrap = Wrap.Wrap; wr.style.marginBottom = 8; body.Add(wr);
            var wl = Ui.Label("글쓰기", 16, Ink2, true); wl.style.marginRight = 8; wr.Add(wl);
            foreach (var gw in (D.J["GW"] as JArray) ?? new JArray())
            {
                string k = (string)gw["k"]; var dr = G.Query(() => G.draft(k)); bool full = G.wroteToday() >= D.RULES.WRITE_MAX;
                var b = LinkBtn((string)gw["l"] + (dr != null && !dr.ok ? " (주작각)" : ""), () => Send("post", "k", k), full ? Ink2 : DcBlue, DcSoft);
                b.SetEnabled(!full); b.style.marginBottom = 6; wr.Add(b);
            }

            var tipsById = S.tips.ToDictionary(t => t.id);
            Tip TipOf(Post p) => p.tip.HasValue && tipsById.TryGetValue(p.tip.Value, out var t) ? t : null;
            IEnumerable<Post> list = S.posts.AsEnumerable().Reverse();
            if (gallTab == "best") list = list.Where(p => p.best);
            if (gallTab == "tip")
            {
                body.Add(Ui.Label("진행 중인 찌라시는 위로, 쓴 사람 적중률 높은 순. 결과는 시간 지나면 댓글로 박제됨.", 16, Ink2));
                list = list.Where(p => TipOf(p) != null).OrderBy(p => string.IsNullOrEmpty(TipOf(p).res) ? 0 : 1).ThenByDescending(p => HitRate(p.au)).ThenByDescending(p => p.id);
            }
            else if (gallTab == "all")
            {   // 고정 공지: 진행 중 찌라시
                int act = S.posts.Count(p => { var t = TipOf(p); return t != null && string.IsNullOrEmpty(t.res); });
                if (act > 0)
                {
                    var pin = Ui.Row(); pin.style.backgroundColor = DcSoft; Ui.Pad(pin, 10); pin.style.marginBottom = 4; body.Add(pin);
                    pin.Add(Tag("공지", Color.white, DcRed)); pin.Add(Ui.Label($"진행 중인 찌라시 {act}개 — 적중률 높은 순으로 보기", 19, Ink, true));
                    foreach (var ch in pin.Children()) ch.pickingMode = PickingMode.Ignore;
                    pin.RegisterCallback<ClickEvent>(_ => { gallTab = "tip"; gallOpen = 0; RenderAll(); });
                }
                foreach (var ap in aiPosts.AsEnumerable().Reverse().Take(3))   // LLM 글 (화면 전용)
                {
                    var r = GallRow(body, "실시간", ap.title, ap.cm.Count, ANON_AU, ap.lab, 0, false, null, false);
                    r.Add(Ui.Label(ap.body, 18, Ink)); foreach (var c in ap.cm) r.Add(Ui.Label($"ㄴ {c.au}: {c.x}", 16, Ink2));
                }
            }
            int n0 = 0;
            foreach (var p in list.Take(gallTab == "tip" ? 20 : 14))
            {
                n0++; var t = TipOf(p); bool open = gallOpen == p.id; int pid = p.id;
                var r = GallRow(body, p.tag, p.title, p.cm.Count, p.au, p.lab, p.up, p.best, t, p.mine != 0);
                r.RegisterCallback<ClickEvent>(_ => { gallOpen = gallOpen == pid ? 0 : pid; RenderAll(); });
                if (!open) continue;
                var bx = Ui.Box(BodyGray, 12, 6); bx.style.marginTop = 6; r.Add(bx);
                if (!string.IsNullOrEmpty(p.body)) bx.Add(Ui.Label(p.body, 19, Ink));
                var ud = Ui.Label($"추천 {p.up:0} · 비추 {p.dn:0}", 16, Ink2); ud.style.marginTop = 6; bx.Add(ud);
                foreach (var c in p.cm)
                {
                    var cr = Ui.Row(); cr.style.alignItems = Align.FlexStart; cr.style.marginTop = 6; bx.Add(cr);
                    var ca = Ui.Label(c.au, 16, c.res != 0 ? DcRed : Ink, true); ca.style.width = 110; ca.style.flexShrink = 0; cr.Add(ca);
                    var cx = Ui.Label(c.x, 17, Ink); cx.style.flexShrink = 1; cr.Add(cx);
                }
                if (t != null && string.IsNullOrEmpty(t.res) && G.tkOpen(t.tk))
                {
                    var go = LinkBtn($"{D.TK[t.tk].name} 차트·주문 보기 →", () => OpenTrade(t.tk), Color.white, DcBlue); go.style.marginTop = 10; go.style.alignSelf = Align.FlexStart; bx.Add(go);
                }
            }
            if (n0 == 0) { var e = Ui.Label(gallTab == "tip" ? "아직 찌라시 없음. 시간 지나면 고닉들이 씀." : "글 없음", 19, Ink2); e.style.marginTop = 20; e.style.alignSelf = Align.Center; body.Add(e); }
        }
        const string ANON_AU = "ㅇㅇ";
        double HitRate(string who) => S.srcStat.TryGetValue(who ?? "", out var g) && g[1] > 0 ? (double)g[0] / g[1] + g[1] * 0.001 : -1;

        VisualElement GallRow(VisualElement body, string tag, string title, int cm, string au, string lab, double up, bool best, Tip t, bool mine)
        {
            var r = new VisualElement(); r.style.paddingTop = 10; r.style.paddingBottom = 10; r.style.borderBottomWidth = 1; r.style.borderBottomColor = DcLine; body.Add(r);
            if (t != null) { r.style.borderLeftWidth = 4; r.style.borderLeftColor = t.dir > 0 ? StkUp : StkDn; r.style.paddingLeft = 10; }
            if (mine) r.style.backgroundColor = MinePink;
            var l1 = Ui.Row(); l1.pickingMode = PickingMode.Ignore; r.Add(l1);
            if (best) l1.Add(Tag("개념", Color.white, DcRed));
            l1.Add(Ui.Label($"[{Ui.Clean(tag)}]", 17, Ink2));
            var tl = Ui.Label(" " + title, 20, Ink, true); tl.style.flexShrink = 1; tl.style.whiteSpace = WhiteSpace.NoWrap; tl.style.overflow = Overflow.Hidden; tl.style.textOverflow = TextOverflow.Ellipsis; l1.Add(tl);
            if (cm > 0) { var cl = Ui.Label($" [{cm}]", 17, DcRed, true); cl.style.flexShrink = 0; l1.Add(cl); }
            var l2 = Ui.Row(); l2.style.marginTop = 4; l2.pickingMode = PickingMode.Ignore; r.Add(l2);
            l2.Add(Ui.Label((mine ? "나 · " : "") + au, 15, au == ANON_AU ? Ink2 : DcBlue, au != ANON_AU));
            if (t != null)
            {
                l2.Add(Ui.Label($"  적중 {G.srcRec(au)}", 15, Ink2));
                var res = t.res;
                string rl = string.IsNullOrEmpty(res) ? $"{D.TK[t.tk].name} {(t.dir > 0 ? "▲" : "▼")} · {G.whenLabel(t.Tr)}" : res == "hit" ? "적중" : res == "pd" ? "작전이었음" : res == "void" ? "흐지부지" : "빗나감";
                var tg = Tag(rl, Color.white, string.IsNullOrEmpty(res) ? (t.dir > 0 ? StkUp : StkDn) : res == "hit" ? OkGreen : Ink2); tg.style.marginLeft = 8; l2.Add(tg);
            }
            var sp = new VisualElement(); sp.style.flexGrow = 1; l2.Add(sp);
            l2.Add(Ui.Label($"{lab} · 추천 {up:0}", 15, Ink2));
            foreach (var ch in l1.Children().Concat(l2.Children())) ch.pickingMode = PickingMode.Ignore;
            return r;
        }

        // ---------- 뉴스 (포털 느낌) ----------
        static readonly string[] PRESS = { "개미경제", "한국찌라시일보", "코인데일리", "증권타임즈", "머니뚝딱" };
        void NewsApp(VisualElement body)
        {
            body.style.paddingLeft = 0; body.style.paddingRight = 0;
            var news = S.feed.Where(f => f.kind == "news").Reverse().Take(14).ToList();
            if (news.Count == 0) { var e = Ui.Label(S.rt ? "아직 뉴스 없음. 뉴스는 시간대가 끝날 때 시세랑 같이 뜸." : "아직 뉴스 없음. 뉴스는 시간대가 끝날 때 시세 결과와 같이 뜸.", 20, Ink2); e.style.marginTop = 30; e.style.alignSelf = Align.Center; body.Add(e); return; }
            bool first = true;
            foreach (var f in news)
            {
                bool hot = f.ic == "🚨" || f.ic == "☠️"; bool fake = f.rows != null && f.rows.Count > 0 && f.x.Contains("가짜");
                var card = Ui.Box(Color.white, 18, 0); card.style.marginBottom = 8; body.Add(card);
                var top = Ui.Row(); card.Add(top);
                string press = PRESS[Math.Abs((f.x ?? "").GetHashCode()) % PRESS.Length];
                top.Add(Avatar(press, NewsGreen, 26)); var pl = Ui.Label(" " + press, 16, Ink, true); top.Add(pl);
                top.Add(Ui.Label(" · " + f.lab, 15, Ink2));
                string x = f.x ?? ""; int arrow = x.LastIndexOf(" → ");
                var hl = Ui.Row(); hl.style.marginTop = 8; hl.style.flexWrap = Wrap.Wrap; card.Add(hl);
                if (hot) hl.Add(Tag("속보", Color.white, DcRed, 16));
                else if (first) hl.Add(Tag("단독", Color.white, NewsGreen, 16));
                var h = Ui.Label(arrow > 0 ? x.Substring(0, arrow) : x, first ? 26 : 22, Ink, true); h.style.flexShrink = 1; hl.Add(h);
                if (arrow > 0) { var tk = Ui.Label("관련 종목 · " + x.Substring(arrow + 3), 16, NewsGreen, true); tk.style.marginTop = 6; card.Add(tk); }
                if (f.rows != null) foreach (var r0 in f.rows) { var rl = Ui.Label(r0, 17, Ink2); rl.style.marginTop = 6; card.Add(rl); }
                first = false;
            }
        }

        // ---------- 정보 수첩 ----------
        void TipsApp(VisualElement body)
        {
            var tips = G.activeTips().OrderBy(t => t.Tr).ToList();
            void H(string t, string sub)
            {
                var hr = Ui.Row(); hr.style.marginTop = 14; hr.style.marginBottom = 8; hr.style.borderBottomWidth = 2; hr.style.borderBottomColor = PaperLine; hr.style.paddingBottom = 4; body.Add(hr);
                hr.Add(Ui.Label(t, 22, Ink, true)); if (sub != null) hr.Add(Ui.Label("  " + sub, 15, Ink2));
            }
            var intro = Ui.Label("누구 말을 믿고 걸지 정하는 곳. 출처마다 적중률이 쌓임 — 말 잘 맞히는 사람을 찾으면 그게 무기.", 17, Ink2); body.Add(intro);

            H("진행 중인 정보", tips.Count > 0 ? $"{tips.Count}개 · 마감 빠른 순" : null);
            if (tips.Count == 0) body.Add(Ui.Label("받은 정보 없음. 개미증권 리포트 · 주갤 찌라시 · 길거리 아저씨한테서 모으기.", 18, Ink2));
            foreach (var t in tips)
            {
                var s0 = G.srcOf(t); var mk = S.mk.tk[t.tk]; double since = t.p0 > 0 ? mk.p / t.p0 - 1 : 0;
                bool clash = tips.Any(o => o != t && o.tk == t.tk && o.dir != t.dir);
                var card = Ui.Box(Color.white, 14, 12); card.style.marginBottom = 10; card.style.borderLeftWidth = 5; card.style.borderLeftColor = t.dir > 0 ? StkUp : StkDn; body.Add(card);
                var r1 = Ui.Row(); card.Add(r1);
                r1.Add(Avatar(s0.name, TierColor(s0.tier), 40));
                var who = new VisualElement(); who.style.marginLeft = 10; who.style.flexGrow = 1; r1.Add(who);
                var wn = Ui.Row(); who.Add(wn); wn.Add(Ui.Label(s0.name, 19, Ink, true)); var tg = Tag(TierName(s0.tier), Color.white, TierColor(s0.tier), 13); tg.style.marginLeft = 8; wn.Add(tg);
                who.Add(Ui.Label($"신뢰 {GameSim.stars(s0.trust)} · 내 기록 {G.srcRec(t.who)}", 15, Ink2));
                var dd = Ui.Label(G.whenLabel(t.Tr), 16, Ink, true); dd.style.backgroundColor = DueBg; Ui.Radius(dd, 6); dd.style.paddingLeft = 8; dd.style.paddingRight = 8; r1.Add(dd);
                var r2 = Ui.Row(); r2.style.marginTop = 8; r2.style.flexWrap = Wrap.Wrap; card.Add(r2);
                r2.Add(Ui.Label($"{D.TK[t.tk].name} {(t.dir > 0 ? "▲ 오른다" : "▼ 내린다")}", 24, t.dir > 0 ? StkUp : StkDn, true));
                var sl = Ui.Label($"   받은 뒤 {GameSim.pct(since)}", 17, UpDn(since)); r2.Add(sl);
                var r3 = Ui.Row(); r3.style.marginTop = 8; r3.style.flexWrap = Wrap.Wrap; card.Add(r3);
                if (clash) r3.Add(Tag("의견 갈림", Color.white, Purple));
                if (S.hold.Has(t.tk) || S.cps.Any(c => c.tk == t.tk)) r3.Add(Tag("보유 중", Ink, Ui.Gold));
                if (t.tier == "rep") r3.Add(Tag("증권사는 대체로 맞음", Color.white, OkGreen));
                var sp = new VisualElement(); sp.style.flexGrow = 1; r3.Add(sp);
                string tk0 = t.tk;
                if (G.tkOpen(tk0)) r3.Add(LinkBtn("차트·주문 →", () => OpenTrade(tk0), Color.white, Ink));
            }

            // 출처 성적표
            var known = S.srcStat.Where(kv => kv.Value[1] > 0 && D.SRC.ContainsKey(kv.Key)).OrderByDescending(kv => (double)kv.Value[0] / kv.Value[1]).ThenByDescending(kv => kv.Value[1]).ToList();
            H("출처 성적표", "내가 겪어 본 결과");
            if (known.Count == 0) body.Add(Ui.Label("아직 결과 난 정보 없음. 정보가 맞았는지는 마감 시간이 지나면 기록됨.", 17, Ink2));
            foreach (var kv in known)
            {
                var s0 = D.SRC[kv.Key]; double rate = (double)kv.Value[0] / kv.Value[1];
                var row = Ui.Row(); row.style.marginBottom = 8; body.Add(row);
                row.Add(Avatar(s0.name, TierColor(s0.tier), 30));
                var nm = Ui.Label(" " + s0.name, 18, Ink, true); nm.style.width = 200; row.Add(nm);
                var track = Ui.Box(PaperLine, 0, 6); track.style.flexGrow = 1; track.style.height = 14; row.Add(track);
                var fill = Ui.Box(rate >= 0.6 ? OkGreen : rate >= 0.4 ? Amber : DcRed, 0, 6); fill.style.height = Length.Percent(100); fill.style.width = Length.Percent((float)rate * 100); track.Add(fill);
                var rl = Ui.Label($" {kv.Value[0]}/{kv.Value[1]} ({rate * 100:0}%)", 17, Ink); rl.style.width = 150; rl.style.unityTextAlign = TextAnchor.MiddleRight; row.Add(rl);
            }

            // 지난 정보
            var past = S.tips.Where(t => !string.IsNullOrEmpty(t.res) && t.res != "void").Reverse().Take(8).ToList();
            if (past.Count > 0)
            {
                H("지난 정보", "최근 8개");
                foreach (var t in past)
                {
                    var row = Ui.Row(); row.style.marginBottom = 6; body.Add(row);
                    string rl = t.res == "hit" ? "적중" : t.res == "pd" ? "작전" : "빗나감";
                    row.Add(Tag(rl, Color.white, t.res == "hit" ? OkGreen : t.res == "pd" ? Purple : Ink2));
                    var tl = Ui.Label($"{G.srcOf(t).name} · {D.TK[t.tk].name} {(t.dir > 0 ? "▲" : "▼")}", 18, Ink); tl.style.flexGrow = 1; row.Add(tl);
                    row.Add(Ui.Label($"실제 {GameSim.pct(t.rr)}", 17, UpDn(t.rr)));
                }
            }
        }
        static string TierName(string tier) => tier == "rep" ? "증권사" : tier == "walk" ? "길거리" : "찌라시";
        static Color TierColor(string tier) => tier == "rep" ? TierRep : tier == "walk" ? TierWalk : TierJji;

        /// 실시간 차트·주문: 이 종목에 걸린 정보 한 줄씩 (차트 아래, 주문창 위)
        void TipStrip(VisualElement left, string tk)
        {
            var tips = G.activeTips(tk);
            if (tips.Count == 0) return;
            var box = Ui.Box(StkCard, 10, 10); box.style.marginTop = 8; Ui.Border(box, StkLine, 1); left.Add(box);
            foreach (var t in tips.Take(3))
            {
                var s0 = G.srcOf(t); var r = Ui.Row(); r.style.marginBottom = 2; box.Add(r);
                r.Add(Tag(TierName(s0.tier), Color.white, TierColor(s0.tier), 13));
                var l = Ui.Label($"{s0.name} {(t.dir > 0 ? "▲ 오른다" : "▼ 내린다")} · {G.whenLabel(t.Tr)} · 기록 {G.srcRec(t.who)}", 17, t.dir > 0 ? StkUp : StkDn, true); l.style.flexShrink = 1; r.Add(l);
            }
            if (tips.Select(t => t.dir).Distinct().Count() > 1) box.Add(Ui.Label("의견 갈림 — 누구 말 믿을지는 정보 수첩 성적표 참고", 15, Ui.Gold));
        }
    }
}
