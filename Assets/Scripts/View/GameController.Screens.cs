using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using KwGame.Sim;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // 화면 구성: HUD(위) · 장면+대사창(왼쪽) · 행동 패널(오른쪽) · 폰(장면 위 오버레이) · 모달(아침 결산·규칙) · 토스트
    public partial class GameController
    {
        static readonly string[] PHONE_OK = { "home", "map", "loc", "brokerTrade" };

        void BuildUi()
        {
            var ps = ScriptableObject.CreateInstance<PanelSettings>();
            ps.scaleMode = PanelScaleMode.ScaleWithScreenSize;
            ps.referenceResolution = new Vector2Int(1920, 1080);
            ps.screenMatchMode = PanelScreenMatchMode.MatchWidthOrHeight;
            ps.match = 0.5f;
            ps.clearColor = true;
            ps.colorClearValue = Ui.Bg;
            var go = new GameObject("UI");
            go.SetActive(false);
            go.transform.SetParent(transform, false);
            doc = go.AddComponent<UIDocument>();
            doc.panelSettings = ps;
            go.SetActive(true);
            root = doc.rootVisualElement;
            root.style.backgroundColor = Ui.Bg;
            if (font != null) root.style.unityFontDefinition = new StyleFontDefinition(FontDefinition.FromFont(font));
            root.style.color = Ui.Text;
            root.style.flexDirection = FlexDirection.Column;
            root.style.width = Length.Percent(100); root.style.height = Length.Percent(100);

            // HUD
            hudBar = Ui.Box(Ui.Panel, 0);
            hudBar.style.height = 120; hudBar.style.flexDirection = FlexDirection.Row; hudBar.style.alignItems = Align.Center;
            hudBar.style.paddingLeft = 24; hudBar.style.paddingRight = 24;
            hudBar.style.borderBottomColor = new Color(1, 1, 1, 0.08f); hudBar.style.borderBottomWidth = 2;
            root.Add(hudBar);

            var main = Ui.Row(); main.style.flexGrow = 1; main.style.alignItems = Align.Stretch;
            root.Add(main);

            // 장면
            stage = Ui.Box(BG["room"]); stage.style.flexGrow = 1; stage.style.position = Position.Relative; stage.style.overflow = Overflow.Hidden;
            main.Add(stage);
            BuildStageArt();   // 배경 · 미래 · NPC · CG (GameController.Art.cs)
            stageTitle = Ui.Label("", 30, Ui.Text, true); Ui.Abs(stageTitle, 32, 24);
            stageTitle.style.backgroundColor = new Color(0, 0, 0, 0.55f); Ui.Radius(stageTitle, 10);
            stageTitle.style.paddingLeft = 18; stageTitle.style.paddingRight = 18; stageTitle.style.paddingTop = 8; stageTitle.style.paddingBottom = 8;
            stageTitle.pickingMode = PickingMode.Ignore; stage.Add(stageTitle);

            // 대사창
            dlg = Ui.Box(new Color(0.06f, 0.06f, 0.09f, 0.94f), 28, 16);
            Ui.Abs(dlg, 32, null, 32, 28); dlg.style.minHeight = 200;
            Ui.Border(dlg, new Color(1, 1, 1, 0.15f), 2);
            dlgName = Ui.Label("", 30, Ui.Accent, true); dlg.Add(dlgName);
            dlgText = Ui.Label("", 32); dlgText.style.marginTop = 10; dlg.Add(dlgText);
            var hint = Ui.Label("클릭 / Space ▶", 18, Ui.Dim); Ui.Abs(hint, null, null, 20, 12); dlg.Add(hint);
            dlg.style.display = DisplayStyle.None;
            dlg.RegisterCallback<PointerDownEvent>(_ => { if (waiting) clicked = true; });
            stage.Add(dlg);

            // 폰 오버레이
            phone = Ui.Box(new Color(0.08f, 0.08f, 0.12f, 0.97f), 24, 24);
            Ui.Abs(phone, 40, 30, 40, 30); Ui.Border(phone, Ui.Accent, 3);
            phone.style.display = DisplayStyle.None;
            stage.Add(phone);

            // 행동 패널
            panel = Ui.Box(Ui.Panel, 28);
            panel.style.width = 640; panel.style.borderLeftColor = new Color(1, 1, 1, 0.08f); panel.style.borderLeftWidth = 2;
            panelTitle = Ui.Label("", 34, Ui.Gold, true); panelTitle.style.marginBottom = 16; panel.Add(panelTitle);
            var sv = new ScrollView(ScrollViewMode.Vertical); sv.style.flexGrow = 1;
            panelBody = sv.contentContainer;
            panel.Add(sv);
            main.Add(panel);

            // 토스트 · 모달
            // 토스트는 오른쪽 아래(대사창 위)에 쌓음 — 위쪽에 두면 NPC 얼굴을 가림
            toastCol = new VisualElement(); Ui.Abs(toastCol, null, null, 24, 250); toastCol.style.width = 500; toastCol.pickingMode = PickingMode.Ignore;
            stage.Insert(stage.IndexOf(dlg), toastCol);   // 대사창·폰 아래에 깔림
            modal = Ui.Box(new Color(0, 0, 0, 0.72f)); Ui.Fill(modal);
            modal.style.alignItems = Align.Center; modal.style.justifyContent = Justify.Center; modal.style.display = DisplayStyle.None;
            modal.RegisterCallback<PointerDownEvent>(_ => { if (waiting) clicked = true; });
            root.Add(modal);
        }

        VisualElement Card(float width)
        {
            var c = Ui.Box(Ui.Panel, 40, 20); c.style.width = width; Ui.Border(c, Ui.Accent, 3);
            return c;
        }

        IEnumerator RulesCard()
        {
            modal.Clear(); modal.style.display = DisplayStyle.Flex;
            var card = Card(1200);
            card.Add(Ui.Label("게임 규칙", 40, Ui.Gold, true));
            foreach (var t in (D.J["RULES_TEXT"] as JArray) ?? new JArray()) { var l = Ui.Label((string)t, 26); l.style.marginTop = 10; card.Add(l); }
            card.Add(Ui.Label("(클릭해서 계속)", 20, Ui.Dim));
            modal.Add(card);
            yield return WaitClick();
            modal.style.display = DisplayStyle.None;
        }

        // ---------- 공통 ----------
        void RenderAll()
        {
            RenderHud(G.HudSnapOf());
            RenderStage();
            RenderPanel();
            RenderPhone();
        }

        string LocTitle()
        {
            var P = S.pending;
            string key = P?.key ?? P?.loc;
            if (key != null && D.LOCS.TryGetValue(key, out var L)) return L.name;
            if (P?.t != "home" && S.visit?.key != null && D.LOCS.TryGetValue(S.visit.key, out L)) return L.name;
            return P?.t == "map" ? "동네 지도" : "원룸";
        }

        void Toast(string text, string kind, Sprite icon = null)
        {
            if (string.IsNullOrEmpty(text)) return;
            var t = Ui.Box(kind == "good" ? new Color(0.12f, 0.3f, 0.18f, 0.95f) : kind == "liq" ? new Color(0.35f, 0.1f, 0.12f, 0.95f) : kind == "big" ? new Color(0.4f, 0.3f, 0.05f, 0.95f) : new Color(0.15f, 0.15f, 0.22f, 0.95f), 14, 10);
            t.style.marginBottom = 8; t.pickingMode = PickingMode.Ignore;
            if (icon != null) { t.style.flexDirection = FlexDirection.Row; t.style.alignItems = Align.Center; t.Add(Icon(icon, 56)); }
            var l = Ui.Label(text, kind == "big" ? 28 : 21, Ui.Text, kind == "big"); l.pickingMode = PickingMode.Ignore; t.Add(l);
            toastCol.Add(t);
            while (toastCol.childCount > 5) toastCol.RemoveAt(0);
            t.schedule.Execute(() => t.RemoveFromHierarchy()).StartingIn(kind == "big" ? 5000 : 3800);
        }

        // ---------- HUD ----------
        void RenderHud(HudSnap h)
        {
            hudBar.Clear();
            if (h.phase == "opening" || S.pending?.t == "start")
            {
                hudBar.Add(Ui.Label("롱잡고알바감", 40, Ui.Accent, true));
                return;
            }
            VisualElement Stat(string k, string v, Color? c = null, float w = 0)
            {
                var b = new VisualElement(); b.style.marginRight = 34; if (w > 0) b.style.width = w;
                b.Add(Ui.Label(k, 18, Ui.Dim)); b.Add(Ui.Label(v, 28, c ?? Ui.Text, true));
                return b;
            }
            int MD = D.RULES.MONTH_DAYS;
            hudBar.Add(Stat("빚", G.won(h.debt), Ui.Bad));
            hudBar.Add(Stat("현금", G.won(h.cash), Ui.Good));
            hudBar.Add(Stat("평가액", G.won(h.hv)));
            hudBar.Add(Stat("날짜", $"{h.month}개월 {h.day}일 · {D.SLOT_NAME[Math.Min(h.slot, D.SLOT_NAME.Count - 1)]}"));
            hudBar.Add(Stat("이자", h.paidMonth == h.month ? "이번 달 냄" : (MD - h.day == 0 ? "D-DAY " : $"D-{MD - h.day} ") + G.man(MathK.Round1k(h.debt * G.rate())), h.paidMonth == h.month ? Ui.Good : Ui.Gold));
            // 체력바
            var hpBox = new VisualElement(); hpBox.style.marginRight = 34;
            hpBox.Add(Ui.Label($"체력 {h.hp:0}" + (h.faint ? " (기절)" : ""), 18, Ui.Dim));
            var bar = Ui.Box(new Color(1, 1, 1, 0.12f), 0, 6); bar.style.width = 200; bar.style.height = 22; bar.style.marginTop = 6;
            var fill = Ui.Box(h.hp < D.RULES.HP_LOW ? Ui.Bad : Ui.Good, 0, 6); fill.style.height = Length.Percent(100); fill.style.width = Length.Percent((float)Math.Max(0, Math.Min(100, h.hp)));
            bar.Add(fill); hpBox.Add(bar); hudBar.Add(hpBox);
            string men = h.stress >= G.menLine() ? "멘헤라" : h.stress >= 40 ? "불안" : "평온";
            hudBar.Add(Stat("멘탈", $"{men} {h.stress:0}", h.stress >= G.menLine() ? Ui.Bad : h.stress >= 40 ? Ui.Gold : Ui.Good));
            hudBar.Add(Stat("중독", $"{h.addict:0}", h.addict >= 60 ? Ui.Bad : h.addict >= 30 ? Ui.Gold : Ui.Dim));
            // 유품 슬롯: 아이콘 (최대 7개 + 나머지 개수)
            var rl = new VisualElement(); rl.style.marginRight = 24; rl.style.flexShrink = 1;
            rl.Add(Ui.Label("유품", 18, Ui.Dim));
            var icons = Ui.Row(); icons.style.marginTop = 4; rl.Add(icons);
            foreach (var id in h.augs.Take(7)) { var ic = Icon(ArtCatalog.Relic(id), 48); ic.style.marginRight = 4; ic.tooltip = D.AUGS.FirstOrDefault(a => a.id == id)?.name ?? id; icons.Add(ic); }
            if (h.augs.Count > 7) icons.Add(Ui.Label($"+{h.augs.Count - 7}", 22, Ui.Gold, true));
            if (h.augs.Count == 0) icons.Add(Ui.Label("없음", 22, Ui.Dim));
            hudBar.Add(rl);
            var sp = new VisualElement(); sp.style.flexGrow = 1; hudBar.Add(sp);
            bool canPhone = PHONE_OK.Contains(S.pending?.t);
            var pb = Ui.Chip(phoneOpen ? "폰 닫기" : "폰", () => { phoneOpen = !phoneOpen; RenderAll(); }, !canPhone, Ui.Accent);
            int unread = G.kUnread();
            if (unread > 0 && !phoneOpen) ((Label)pb[0]).text = $"폰 ({unread})";
            hudBar.Add(pb);
        }

        // ---------- 행동 패널 (pending 마다) ----------
        void Title(string t) => panelTitle.text = Ui.Clean(t);
        void Btn(string text, Action a, string sub = null, bool dis = false, Color? bg = null) => panelBody.Add(Ui.Button(text, a, sub, dis, bg));
        /// 아이콘 붙은 버튼 (유품 고르기·상점)
        void IconBtn(Sprite icon, string text, Action a, string sub = null, bool dis = false)
        {
            var b = Ui.Button(text, a, sub, dis);
            var col = new VisualElement(); col.style.flexShrink = 1; col.pickingMode = PickingMode.Ignore;
            while (b.childCount > 0) col.Add(b[0]);
            b.style.flexDirection = FlexDirection.Row; b.style.alignItems = Align.Center;
            var ic = Icon(icon, 72); ic.style.marginRight = 16; ic.style.flexShrink = 0;
            if (dis) ic.style.opacity = 0.5f;
            b.Add(ic); b.Add(col);
            panelBody.Add(b);
        }
        static VisualElement Icon(Sprite s, float size)
        {
            var v = new VisualElement(); v.style.width = size; v.style.height = size; v.pickingMode = PickingMode.Ignore;
            v.style.backgroundColor = new Color(1, 1, 1, 0.08f); Ui.Radius(v, 8);
            if (s != null) { v.style.backgroundImage = new StyleBackground(s); v.style.backgroundSize = new BackgroundSize(BackgroundSizeType.Contain); }
            return v;
        }
        void Info(string text, float size = 22, Color? c = null) { var l = Ui.Label(text, size, c ?? Ui.Dim); l.style.marginBottom = 12; panelBody.Add(l); }
        VisualElement ChipRow() { var r = Ui.Row(); r.style.flexWrap = Wrap.Wrap; r.style.marginBottom = 8; panelBody.Add(r); return r; }

        void RenderPanel()
        {
            panelBody.Clear();
            var P = S.pending;
            stageTitle.text = Ui.Clean(LocTitle());
            if (P == null) { Title("…"); return; }
            switch (P.t)
            {
                case "start":
                    Title("롱잡고알바감");
                    Info("빚 3천만 원. 매달(7일) 이자 5%. 알바·주식·코인·도박… 갚을 방법은 많다.", 26, Ui.Text);
                    Btn("새 게임 시작", () => Send("start"), $"시드 {S.seed}", false, Ui.Accent);
                    break;
                case "relic":
                    Title("부모님 유품 상자");
                    Info(P.reason ?? "", 22);
                    for (int i = 0; i < P.offer.Count; i++)
                    {
                        int k = i; var a = D.AUGS.First(x => x.id == P.offer[i]);
                        IconBtn(ArtCatalog.Relic(a.id), $"{a.name}  [{(D.TIER.TryGetValue(a.tier.ToString(), out var tn) ? tn : a.tier.ToString())}]", () => Send("pickRelic", "i", k), a.d);
                    }
                    Btn("상자 더 뒤지기 (1회)", () => Send("relicReroll"), null, P.rerolled);
                    break;
                case "home":
                    Title($"집 · {D.SLOT_NAME[S.slot]}");
                    if (S.hl != null) Info("미래: " + S.hl.t, 24, Ui.Accent);
                    Btn("지도 열기 (외출)", () => Send("map"), "장소로 이동");
                    Btn(G.isEve() ? "일찍 자기" : "쉬기", () => Send("rest"), $"칸 소모 · 체력 +{(G.isEve() ? D.RULES.HP_REST_EVE : D.RULES.HP_REST)} · 스트레스 −22");
                    Btn("김사장에게 돈 땡기기", () => Send("loanOpen"), $"사채 (선이자 {G.loanFee() * 100:0}%) · 한도 {G.man(G.loanCap())}");
                    Btn("폰 보기", () => { phoneOpen = true; RenderAll(); }, "증권·코인·카톡·주갤·정보 (칸 소모 없음)");
                    break;
                case "map":
                    Title("어디 갈까?");
                    Btn("집으로", () => Send("goTo", "loc", "home"));
                    foreach (var L in D.LOCList)
                    {
                        bool open = L.open.Contains(S.slot);
                        Btn(L.name, () => Send("goTo", "loc", L.id), open ? L.hint : $"닫힘 ({string.Join("·", L.open.Select(x => D.SLOT_NAME[x]))}만)", !open);
                    }
                    break;
                case "encounter":
                    Title(D.SRC.TryGetValue(P.id, out var src) ? src.name : "길거리");
                    Info(src?.line ?? "", 22, Ui.Text);
                    foreach (var o in P.opts) { var k = o.k; Btn(o.l, () => Send("encounter", "ask", k == "enc-ask"), o.sub, o.dis); }
                    break;
                case "loc":
                    Title(LocTitle());
                    if (D.GREET.TryGetValue(P.key, out var gl) && gl.Count > 0 && P.first) Info(gl[0], 22);
                    foreach (var o in G.Query(() => G.locOpts(P.key))) { var k = o.k; Btn(o.l, () => Send("act", "k", k), o.sub, o.dis); }
                    Btn(S.visit != null && S.visit.used ? "나가기 (칸 끝)" : "나가기", () => Send("leave"), null, false, Ui.Panel);
                    break;
                case "loan":
                    Title("김사장 캐피탈");
                    Info($"빚 {G.won(S.debt)} / 한도 {G.won(G.loanCap())} · 선이자 {G.loanFee() * 100:0}%", 22, Ui.Text);
                    foreach (var amt in D.RULES.LOAN_AMTS) { var a = amt; Btn($"{G.man(a)}원 빌리기", () => Send("borrow", "amt", a), $"실수령 {G.won(MathK.RoundHalfUp(a * (1 - G.loanFee())))}", S.debt + a > G.loanCap()); }
                    Btn("됐어요", () => Send("loanDone"), null, false, Ui.Panel);
                    break;
                case "work": RenderWork(P); break;
                case "casino": RenderCasino(P); break;
                case "race": RenderRace(P); break;
                case "scratch":
                    Title("즉석 복권");
                    Info($"{P.n}장 샀음 · 쓴 돈 {G.won(P.spent)} · 당첨 {G.won(P.got)}", 22, Ui.Text);
                    if (P.card != null) Info("카드: " + string.Join(" ", P.card.done ? P.card.sym : P.card.sym.Select(_ => "?")) + (P.card.done ? (P.card.prize != null ? $" → {G.won(P.card.prize.Value.amt)}" : " → 꽝") : ""), 24, Ui.Gold);
                    if (P.card != null && !P.card.done) Btn("긁기 (6칸 다)", () => Send("scratchReveal"));
                    else Btn($"한 장 사기 ({G.won(D.RULES.SCRATCH_PRICE)})", () => Send("scratchBuy"), null, P.n >= D.RULES.SCRATCH_MAX || S.cash < D.RULES.SCRATCH_PRICE);
                    Btn("그만", () => Send("scratchDone"), null, false, Ui.Panel);
                    break;
                case "lotto":
                    Title("빚또 4/20 (오늘 저녁 추첨)");
                    Info($"오늘 산 표 {G.lottoToday()}장 · 한 장 {G.won(D.RULES.LOTTO_PRICE)}", 22, Ui.Text);
                    Btn("자동 1장", () => Send("lottoBuy", "k", 1));
                    Btn("자동 5장", () => Send("lottoBuy", "k", 5));
                    Btn("됐어", () => Send("lottoDone"), null, false, Ui.Panel);
                    break;
                case "repay":
                    Title("원금 상환");
                    Info($"빚 {G.won(S.debt)} · 현금 {G.won(S.cash)}" + (P.due > 0 ? $" · 이번 달 이자 {G.won(P.due)} 남겨 둘 것" : ""), 22, Ui.Text);
                    foreach (var a in new[] { P.mx, Math.Floor(P.mx / 20000) * 10000, Math.Max(0, Math.Floor((P.mx - P.due) / 10000) * 10000), 100000 }.Distinct().Where(x => x >= 10000 && x <= P.mx))
                    { var amt = a; Btn($"{G.won(amt)} 갚기", () => Send("repay", "amt", amt)); }
                    Btn("취소", () => Send("repay", "amt", 0), null, false, Ui.Panel);
                    break;
                case "shop":
                    Title("상점 · 꾸미기");
                    foreach (var it in D.ITEMS)
                    {
                        var id = it.id; bool own = it.type == "outfit" ? S.owned.Has(id) : S.props.Has(id);
                        Btn($"{it.name}  {(own ? (S.outfit == id ? "(입는 중)" : "(보유)") : G.won(it.p))}", () => Send("shopBuy", "id", id), it.d, !own && S.cash < it.p);
                    }
                    Btn("다 샀다", () => Send("shopDone"), null, false, Ui.Panel);
                    break;
                case "relicShop":
                    Title("수상한 유품 상점");
                    if (P.last != null)
                    {
                        var lr = Ui.Row(); lr.style.marginBottom = 12; panelBody.Add(lr);
                        var ic = Icon(P.last.junk.HasValue ? ArtCatalog.Junk(P.last.junk.Value) : ArtCatalog.Relic(P.last.id), 96); ic.style.marginRight = 16; lr.Add(ic);
                        var lt = Ui.Label(P.last.junk.HasValue ? "방금 뽑기: 꽝 — " + D.RELIC_JUNK[P.last.junk.Value] : "방금 뽑기: " + D.AUGS.First(a => a.id == P.last.id).name, 22, Ui.Gold); lt.style.flexShrink = 1; lr.Add(lt);
                    }
                    Btn($"랜덤 뽑기 ({G.won(D.RULES.GACHA_PRICE)})", () => Send("gachaRelic"), $"꽝 {D.RULES.GACHA_JUNK * 100:0}%", S.cash < D.RULES.GACHA_PRICE);
                    foreach (var id in G.Query(() => G.relicOffer()))
                    {
                        var a = D.AUGS.First(x => x.id == id); double pr = G.relicPrice(id); var rid = id;
                        IconBtn(ArtCatalog.Relic(id), $"{a.name}  {G.won(pr)}", () => Send("buyRelic", "id", rid), a.d, S.cash < pr);
                    }
                    Btn("나가기", () => Send("relicDone"), null, false, Ui.Panel);
                    break;
                case "brokerTrade":
                    Title("증권사 창구 매매");
                    Info("창구 수수료가 앱보다 쌈. 폰 화면의 증권 탭으로 매매 (창구 수수료 적용).", 22, Ui.Text);
                    if (!phoneOpen) { phoneOpen = true; phoneTab = "stock"; }
                    Btn("거래 끝", () => Send("brokerClose"), null, false, Ui.Panel);
                    break;
                case "menhera":
                case "impulse":
                    Title(P.t == "menhera" ? "미래 멘헤라 — 받아치기" : "미래 돌발 풀매수! — 말리기");
                    for (int i = 0; i < P.opts.Count; i++) { int k = i; Btn(P.opts[i].l, () => Send("reply", "i", k)); }
                    break;
                case "tempt":
                    Title("도박 유혹");
                    foreach (var o in P.opts) { var k = o.k; Btn(o.l, () => Send("tempt", "k", k), o.sub, o.dis); }
                    break;
                case "payday":
                    Title(P.stage == "repay" ? "이자 냄 — 원금도 갚을까?" : P.stage == "side" ? "김사장 홀짝" : $"이자일 — {G.won(P.due)}");
                    foreach (var o in P.opts) { var k = o.k; Btn(o.l, () => Send("payday", "k", k), o.sub, o.dis); }
                    break;
                case "ending": RenderEnding(P); break;
                default: Title(P.t); Info("(이 화면은 아직 없음)"); break;
            }
        }

        void RenderWork(Pending P)
        {
            var J = D.JOBS[P.key];
            Title(J.name);
            if (P.setup == null)
            {
                Info($"일당 {G.man(J.@base)}~{G.man(J.@base + J.var)}원 · 체력 −{G.jobHp(J)} · 난이도 ×{G.mgHard():0.00}", 22, Ui.Text);
                Btn("일 시작 (미니게임)", () => Send("mgSetup"));
                return;
            }
            Info("[미니게임 자리] 실제 미니게임 대신 점수를 직접 고른다 (0~1).", 22, Ui.Gold);
            if (P.setup.hpm < 1) Info($"체력이 낮아 점수 ×{P.setup.hpm:0.00}", 20, Ui.Bad);
            var lbl = Ui.Label($"점수 {mgScore:0.00}", 28, Ui.Text, true); panelBody.Add(lbl);
            var bar = Ui.ScoreBar(560, v => { mgScore = v; lbl.text = $"점수 {v:0.00}  → 예상 일당 {G.won(MathK.Round1k(J.@base + J.var * v * P.setup.hpm))}"; }, mgScore);
            bar.style.marginBottom = 16; panelBody.Add(bar);
            var r = ChipRow();
            foreach (var v in new[] { 0.3f, 0.6f, 0.8f, 1f }) { var x = v; r.Add(Ui.Chip($"{x:0.0}", () => Send("mgResult", "score", (double)x))); }
            Btn("결과 제출", () => Send("mgResult", "score", (double)mgScore), null, false, Ui.Accent);
        }

        double Stake(double frac) { double mx = Math.Floor(S.cash / 10000) * 10000; return Math.Max(10000, Math.Floor(mx * frac / 10000) * 10000); }
        void StakeChips()
        {
            var r = ChipRow();
            foreach (var f in new[] { 0.1, 0.3, 0.5, 1.0 }) { var x = f; r.Add(Ui.Chip(x >= 1 ? "올인" : $"{x * 100:0}%", () => { stakeFrac = x; RenderPanel(); }, false, Math.Abs(stakeFrac - x) < 1e-9 ? Ui.Accent : (Color?)null)); }
            Info($"판돈 {G.won(Stake(stakeFrac))} (현금 {G.won(S.cash)})", 22, Ui.Text);
        }
        void RenderCasino(Pending P)
        {
            Title(Ui.Clean(D.CAS_TITLE[P.kind]) + $" · {P.rounds}/3판 · 누적 {G.sgnWon(P.total)}");
            StakeChips();
            double stake = Stake(stakeFrac); bool cant = S.cash < 10000;
            switch (P.kind)
            {
                case "oddeven": Btn("홀", () => Send("bet", "stake", stake, "choice", 1), "적중 2배", cant); Btn("짝", () => Send("bet", "stake", stake, "choice", 0), "적중 2배", cant); break;
                case "card":
                    Info($"지금 카드: {D.RK[P.A]}{D.SU[P.As]}", 30, Ui.Gold);
                    Btn("하이 (더 높다)", () => Send("bet", "stake", stake, "choice", 1), $"×{GameSim.hlMult(P.A, true):0.00}", cant || GameSim.hlMult(P.A, true) == 0);
                    Btn("로우 (더 낮다)", () => Send("bet", "stake", stake, "choice", 0), $"×{GameSim.hlMult(P.A, false):0.00}", cant || GameSim.hlMult(P.A, false) == 0);
                    break;
                case "slot": Btn("레버 당기기", () => Send("bet", "stake", stake, "choice", 0), "777 = 50배", cant); break;
                case "ladder": for (int i = 0; i < 3; i++) { int k = i; Btn("ABC"[i] + " 출발", () => Send("bet", "stake", stake, "choice", k), "당첨 2.8배", cant); } break;
            }
            Btn("일어나기", () => Send("casinoLeave"), null, false, Ui.Panel);
        }
        void RenderRace(Pending P)
        {
            Title($"경마 · {P.race}일차 경주");
            StakeChips();
            double stake = Stake(stakeFrac);
            for (int i = 0; i < P.H.Count; i++) { int k = i; var h = P.H[i]; Btn($"{i + 1}번 {h.name}", () => Send("raceBet", "i", k, "stake", stake), $"배당 {h.odds:0.0}배 · 승률 {h.p * 100:0}%", S.cash < 10000); }
            Btn("안 건다", () => Send("raceLeave"), null, false, Ui.Panel);
        }

        void RenderEnding(Pending P)
        {
            var E = S.endInfo;
            Title(E?.tag ?? "엔딩");
            if (E == null) return;
            Info(E.h, 32, E.ok ? Ui.Good : Ui.Bad);
            Info(E.lead, 22, Ui.Text);
            var sb = E.sb;
            Info("── 스코어보드 ──", 26, Ui.Gold);
            void Row(string k, string v) { var r = Ui.Row(); r.style.justifyContent = Justify.SpaceBetween; r.style.marginBottom = 4; r.Add(Ui.Label(k, 22, Ui.Dim)); r.Add(Ui.Label(v, 22, Ui.Text, true)); panelBody.Add(r); }
            Row("버틴 날", $"{sb.days}일 ({sb.month}개월 {sb.day}일)");
            Row("남은 빚", G.won(sb.debt)); Row("갚은 빚", G.won(sb.repaid)); Row("낸 이자", G.won(sb.interest));
            Row("알바로 번 돈", G.won(sb.earned)); Row("투자 손익", G.sgnWon(sb.profit)); Row("도박 순손익", G.sgnWon(sb.gnet));
            Row("최대 자산", G.won(sb.maxAsset)); Row("도박 승/판", $"{sb.gW}/{sb.gN}"); Row("투자 승/매도", $"{sb.iW}/{sb.iN} · 청산 {sb.liq}");
            Row("갤 명성", $"{sb.fame} ({sb.rank})"); Row("중독도", $"{sb.addict}"); Row("기절 · 돌발 매수", $"{sb.faint} · {sb.impulse}");
            panelBody.Add(new VisualElement { style = { height = 16 } });
            if (P.cont) Btn("계속하기 (빚 없는 자유 모드)", () => Send("continue"), null, false, Ui.Accent);
            Btn("새 게임", () => NewGame(UnityEngine.Random.Range(1, 1000000)));
        }

        // ---------- 폰 ----------
        void RenderPhone()
        {
            bool can = PHONE_OK.Contains(S.pending?.t);
            if (!can) phoneOpen = false;
            phone.style.display = phoneOpen ? DisplayStyle.Flex : DisplayStyle.None;
            phone.Clear();
            if (!phoneOpen) return;
            var tabs = Ui.Row(); tabs.style.marginBottom = 12; phone.Add(tabs);
            foreach (var (k, n) in new[] { ("stock", "개미증권"), ("kakao", $"카톡{(G.kUnread() > 0 ? $"({G.kUnread()})" : "")}"), ("gall", "주갤"), ("tips", "정보 수첩") })
            {
                var kk = k; tabs.Add(Ui.Chip(n, () => { phoneTab = kk; if (kk == "kakao") { Send("read", "what", "kakao", "room", "m"); Send("read", "what", "kakao", "room", "kim"); Send("read", "what", "kakao", "room", "hy"); } RenderAll(); }, false, phoneTab == k ? Ui.Accent : (Color?)null));
            }
            var sp = new VisualElement(); sp.style.flexGrow = 1; tabs.Add(sp);
            tabs.Add(Ui.Chip("닫기", () => { phoneOpen = false; RenderAll(); }));
            var sv = new ScrollView(); sv.style.flexGrow = 1; phone.Add(sv);
            var body = sv.contentContainer;
            void L(string t, float s = 22, Color? c = null) { var l = Ui.Label(t, s, c ?? Ui.Text); l.style.marginBottom = 6; body.Add(l); }
            VisualElement R() { var r = Ui.Row(); r.style.flexWrap = Wrap.Wrap; r.style.marginBottom = 10; body.Add(r); return r; }
            string where = S.pending?.t == "brokerTrade" ? "broker" : "app";
            switch (phoneTab)
            {
                case "stock":
                    L(G.stockOpen() ? $"주식장 열림 ({D.SLOT_NAME[S.slot]}) · 수수료 {G.stockFee(where) * 100:0.0}%" : "주식장 닫힘 (코인은 24시간)", 22, Ui.Gold);
                    {
                        var rr = R();
                        var rs = G.rsch();
                        rr.Add(Ui.Chip($"무료 리포트 ({rs.free}/{G.freeMax()})", () => Send("report", "paid", false), rs.free >= G.freeMax()));
                        rr.Add(Ui.Chip($"유료 리포트 {G.man(D.RULES.RSCH_FEE)}", () => Send("report", "paid", true), rs.paid >= D.RULES.RSCH_PAID_MAX || S.cash < D.RULES.RSCH_FEE));
                    }
                    foreach (var t in D.TKList.Where(x => G.tkOpen(x.id)))
                    {
                        var mk = S.mk.tk[t.id]; double r0 = mk.hist.Count > 0 ? mk.hist[mk.hist.Count - 1].c / mk.hist[mk.hist.Count - 1].o - 1 : 0;
                        var h = S.hold.Get(t.id);
                        L($"{t.name}  {G.fmtP(mk.p)}  {GameSim.pct(r0)}" + (h != null ? $"   보유 {G.won(h.q * mk.p)} ({GameSim.pct(h.q * mk.p / h.cost - 1)})" : ""), 24, r0 >= 0 ? Ui.Good : Ui.Bad);
                        var row = R(); string tk = t.id;
                        if (t.IsStock)
                        {
                            bool so = G.stockOpen();
                            row.Add(Ui.Chip("10% 사기", () => Send("buy", "tk", tk, "amt", Math.Floor(S.cash * 0.1 / 1000) * 1000, "where", where), !so || S.cash < 10000));
                            row.Add(Ui.Chip("50% 사기", () => Send("buy", "tk", tk, "amt", Math.Floor(S.cash * 0.5 / 1000) * 1000, "where", where), !so || S.cash < 20000));
                            row.Add(Ui.Chip("전부 팔기", () => Send("sell", "tk", tk, "frac", 1, "where", where), !so || h == null));
                        }
                        else
                        {
                            foreach (var (dir, lev) in new[] { (1, 1.0), (1, 10.0), (-1, 10.0), (1, Math.Min(50, t.maxLev)) }.Distinct())
                            {
                                int d = dir; double lv = lev;
                                row.Add(Ui.Chip($"{(d > 0 ? "롱" : "숏")} x{lv:0} 10%", () => Send("open", "tk", tk, "dir", d, "lev", lv, "amt", Math.Floor(S.cash * 0.1 / 1000) * 1000), S.cash < 20000));
                            }
                        }
                    }
                    if (S.cps.Count > 0)
                    {
                        L("코인 포지션", 24, Ui.Gold);
                        foreach (var c in S.cps.ToList())
                        {
                            var row = R(); int id = c.id; double pnl = G.cpnl(c) + c.bonus;
                            row.Add(Ui.Label($"{D.TK[c.tk].name} {(c.dir > 0 ? "롱" : "숏")} x{c.lev:0} 증거금 {G.man(c.margin)} 손익 {G.sgnWon(pnl)}  청산가 {G.fmtP(GameSim.liqPx(c))}", 20, pnl >= 0 ? Ui.Good : Ui.Bad));
                            row.Add(Ui.Chip("청산(종료)", () => Send("close", "id", id), c.t0 == G.Tnow()));
                        }
                    }
                    break;
                case "kakao":
                    if (S.kq != null)
                    {
                        L("미래가 답장 기다림: " + D.KQ[S.kq.i].q, 24, Ui.Accent);
                        for (int i = 0; i < S.kq.opts.Count; i++) { int k = i; body.Add(Ui.Button(S.kq.opts[i].l, () => Send("kqReply", "i", k))); }
                    }
                    foreach (var room in new[] { "m", "kim", "hy" })
                    {
                        L(room == "m" ? "── 미래 ♥" : room == "kim" ? "── 김사장" : "── 형나믿지", 22, Ui.Gold);
                        foreach (var m in S.kk[room].Skip(Math.Max(0, S.kk[room].Count - 5))) L($"[{m.t}] {(m.w == "me" ? "나" : m.w == "sys" ? "시스템" : m.w == "m" ? "미래" : m.w == "kim" ? "김사장" : "형")}: {m.x}", 20, m.w == "me" ? Ui.Dim : Ui.Text);
                    }
                    break;
                case "gall":
                    L($"주식 갤러리 · 명성 {S.galFame} ({G.rankOf(S.galFame).name}) · 오늘 쓴 글 {G.wroteToday()}/{D.RULES.WRITE_MAX}", 22, Ui.Gold);
                    {
                        var row = R();
                        foreach (var gw in (D.J["GW"] as JArray) ?? new JArray())
                        {
                            string k = (string)gw["k"]; var dr = G.Query(() => G.draft(k));
                            row.Add(Ui.Chip((string)gw["l"] + (dr != null && !dr.ok ? " (주작각)" : ""), () => Send("post", "k", k), G.wroteToday() >= D.RULES.WRITE_MAX));
                        }
                    }
                    foreach (var p in S.posts.AsEnumerable().Reverse().Take(10))
                        L($"[{p.tag}] {p.title}  — {p.au} · 추 {p.up:0}" + (p.best ? " · 개념글" : ""), 20, p.mine != 0 ? Ui.Accent : Ui.Text);
                    break;
                case "tips":
                    var tips = G.activeTips();
                    if (tips.Count == 0) L("받은 정보 없음. 증권사 리포트·길거리·갤 찌라시로 모으기.", 22, Ui.Dim);
                    foreach (var t in tips)
                    {
                        var s0 = G.srcOf(t);
                        L($"{s0.name}: {D.TK[t.tk].name} {(t.dir > 0 ? "상승" : "하락")} · {G.whenLabel(t.Tr)} · 신뢰 {GameSim.stars(s0.trust)} · 기록 {G.srcRec(t.who)}", 21);
                    }
                    break;
            }
        }
    }
}
