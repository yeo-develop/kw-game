using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using DG.Tweening;
using Febucci.TextAnimatorForUnity;
using KwGame.Sim;
using KwGame.Persistence;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // 화면 구성 (docs/UI_V2.md): 맨 위 상태 띠 · 장면 + 대사창 · 가운데 선택지 상자 · 폰(장면 위 오버레이) · 모달(아침 결산·규칙) · 토스트
    public partial class GameController
    {
        static readonly string[] PHONE_OK = { "home", "map", "loc", "brokerTrade", "watch" };

        // 비주얼노벨식 한 화면: 장면이 화면 전체. 맨 위 상태 띠(누르면 상태 카드), 집 = 계획판 (GameController.Plan.cs), 장 보기 = 데스크 (GameController.Desk.cs),
        // 그 밖엔 아래 대사창 + 고를 게 있을 때만 가운데 선택지 상자, 폰은 오른쪽에서 열고 닫음(P). 퀵메뉴 · 미니 시세는 옛 칸 방식만.
        VisualElement mini, quickBar; Label idleText;
        static readonly Color Glass = new Color(0.05f, 0.05f, 0.09f, 0.93f);
        static VisualElement GlassBox(float pad = 16, float radius = 16)
        {
            var b = Ui.Box(Glass, pad, radius); Ui.Border(b, new Color(1, 1, 1, 0.14f), 2);
            return b;
        }

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
            root.style.width = Length.Percent(100); root.style.height = Length.Percent(100);

            // 장면 (화면 전체)
            stage = Ui.Box(BG["room"]); stage.style.flexGrow = 1; stage.style.position = Position.Relative; stage.style.overflow = Overflow.Hidden;
            root.Add(stage);
            BuildStageArt();   // 배경 · 미래 · NPC · CG (GameController.Art.cs)
            miraiEl.style.left = Length.Percent(18);
            stage.RegisterCallback<GeometryChangedEvent>(_ => FitFigures());
            stageTitle = Ui.Label("", 20, Ui.Dim); stageTitle.style.display = DisplayStyle.None;   // 장소 이름은 상태 카드에

            // 장 보기 데스크 (GameController.Desk.cs): 선택지 · 대사창 · 폰 · 알림이 그 위에 그려지게 먼저 넣음
            BuildDesk();
            // v4 집 = 하루 계획판 (GameController.Plan.cs)
            BuildPlan();

            // 오른쪽 위 미니 시세창 (옛 칸 방식만, 누르면 폰)
            mini = GlassBox(14, 16); Ui.Abs(mini, null, 24, 24); mini.style.width = 400;
            mini.RegisterCallback<ClickEvent>(_ => { if (!phoneOpen) TogglePhone(); });
            stage.Add(mini);

            // 가운데 선택지 상자 (고를 게 있을 때만)
            panel = GlassBox(24, 18);
            panel.style.position = Position.Absolute; panel.style.left = Length.Percent(50); panel.style.translate = new Translate(Length.Percent(-50), 0);
            panel.style.bottom = 330; panel.style.width = 780; panel.style.maxHeight = 620;
            panelTitle = Ui.Label("", 30, Ui.Gold, true); panelTitle.style.marginBottom = 12; panelTitle.style.flexShrink = 0; panel.Add(panelTitle);
            var sv = new ScrollView(ScrollViewMode.Vertical); sv.style.flexShrink = 1; sv.contentViewport.style.overflow = Overflow.Hidden;
            panelBody = sv.contentContainer; panelSv = sv;
            panel.Add(sv);
            // 넘칠 때 아래쪽 "▼ 더 있음" (누르면 조금 내림). 겹쳐 띄워서 상자 높이는 안 바꿈
            panelMore = Ui.Label("▼ 더 있음", 20, Ui.Gold, true); Ui.Abs(panelMore, null, null, 24, 10);
            panelMore.style.backgroundColor = new Color(0.05f, 0.05f, 0.09f, 0.96f); Ui.Radius(panelMore, 8); Ui.Border(panelMore, new Color(1, 1, 1, 0.18f), 1);
            panelMore.style.paddingLeft = 12; panelMore.style.paddingRight = 12; panelMore.style.paddingTop = 4; panelMore.style.paddingBottom = 4; panelMore.style.display = DisplayStyle.None;
            panelMore.RegisterCallback<ClickEvent>(_ => panelSv.scrollOffset = new Vector2(0, panelSv.scrollOffset.y + 240));
            panel.Add(panelMore);
            sv.contentContainer.RegisterCallback<GeometryChangedEvent>(_ => PanelMoreSync());
            sv.contentViewport.RegisterCallback<GeometryChangedEvent>(_ => PanelMoreSync());
            sv.verticalScroller.valueChanged += _ => PanelMoreSync();
            stage.Add(panel);

            // 대사창 (항상): 이름 · 대사 / 평소 한마디 · 퀵메뉴
            dlg = Ui.Box(new Color(0.05f, 0.05f, 0.09f, 0.92f), 28, 18);
            Ui.Abs(dlg, 40, null, 40, 24); dlg.style.minHeight = 250;
            Ui.Border(dlg, new Color(1, 1, 1, 0.16f), 2);
            dlgName = Ui.Label("", 30, Ui.Accent, true); dlg.Add(dlgName);
            dialogueTiming = ScriptableObject.CreateInstance<TypingDelaysByCharacter>();
            dialogueTiming.hideFlags = HideFlags.DontSave;
            dialogueTiming.avoidMultiplePunctuationWait = true;
            dialogueTiming.waitForLastCharacter = false;
            dialogueAnimation = ScriptableObject.CreateInstance<AnimatorSettingsScriptable>();
            dialogueAnimation.hideFlags = HideFlags.DontSave;
            dialogueAnimation.Settings.defaultAppearanceTags = new[] { "fade" };
            dlgText = new AnimatedLabel { name = "dialogueText", TimingSettings = dialogueTiming, AnimationSettings = dialogueAnimation };
            dlgText.style.fontSize = 32; dlgText.style.color = Ui.Text;
            dlgText.style.whiteSpace = WhiteSpace.Normal;
            dlgText.style.marginTop = 10;
            dlgText.style.paddingLeft = 0; dlgText.style.paddingRight = 0;
            dlgText.style.flexGrow = 1;
            dlgText.style.display = DisplayStyle.None;
            dlg.Add(dlgText);
            idleText = Ui.Label("", 30, Ui.Text); idleText.style.whiteSpace = WhiteSpace.Normal; idleText.style.marginTop = 10; idleText.style.flexGrow = 1; dlg.Add(idleText);
            dlgHint = Ui.Label("클릭 / Space ▶", 18, Ui.Dim); Ui.Abs(dlgHint, null, 16, 24); dlgHint.style.display = DisplayStyle.None; dlg.Add(dlgHint);
            quickBar = Ui.Row(); quickBar.style.alignItems = Align.Center; quickBar.style.marginTop = 12; quickBar.style.paddingTop = 10;
            quickBar.style.borderTopWidth = 1; quickBar.style.borderTopColor = new Color(1, 1, 1, 0.1f); quickBar.style.flexShrink = 0;
            dlg.Add(quickBar);
            saveControls = quickBar;
            stage.Add(dlg);
            panel.PlaceInFront(dlg);   // 폰이 열려 선택지 상자가 아래로 내려오면 대사창 글줄과 겹침 → 상자가 위에 그려지게 (퀵메뉴 줄까진 안 내려옴)
            panel.schedule.Execute(PanelMoreSync).Every(300);   // 배치가 끝난 뒤에도 "더 있음"이 맞게

            // 폰 (오른쪽에서 밀려 나옴)
            phone = Ui.Box(new Color(0.04f, 0.04f, 0.06f, 0.99f), 12, 40);   // 폰 테두리(베젤) — 안쪽 앱 화면은 RenderPhone
            Ui.Abs(phone, null, StripH + 12, 20, 20); phone.style.width = 880; Ui.Border(phone, new Color(0.32f, 0.32f, 0.38f), 3); phone.style.overflow = Overflow.Hidden;   // 상태 띠(그만 보기) 아래부터
            phone.style.display = DisplayStyle.None;
            stage.Add(phone);

            // 알림 (왼쪽, 상태 띠 아래, 3개까지)
            toastCol = new VisualElement(); Ui.Abs(toastCol, 24, StripH + 12);
            toastCol.style.width = 520; toastCol.style.alignItems = Align.FlexStart; toastCol.pickingMode = PickingMode.Ignore;
            stage.Add(toastCol);

            // 발표 · 예약 체결 배너 (띠 아래 가운데, 토스트와 따로 쌓임)
            bannerCol = new VisualElement(); Ui.Abs(bannerCol, null, StripH + 12); bannerCol.style.alignItems = Align.Center; bannerCol.pickingMode = PickingMode.Ignore;
            stage.Add(bannerCol);
            bannerCol.RegisterCallback<GeometryChangedEvent>(_ => PlaceAlerts());

            // 맨 위 상태 띠 (모든 화면 공통, 데스크 · 인물보다 위). 누르면 자세한 상태 카드
            hudBar = new VisualElement(); Ui.Abs(hudBar, 0, 0, 0); hudBar.style.height = StripH;
            hudBar.style.backgroundColor = new Color(0.05f, 0.05f, 0.09f, 0.95f);
            hudBar.style.borderBottomWidth = 2; hudBar.style.borderBottomColor = new Color(1, 1, 1, 0.14f);
            hudBar.style.flexDirection = FlexDirection.Row; hudBar.style.alignItems = Align.Center;
            hudBar.style.paddingLeft = 24; hudBar.style.paddingRight = 24; hudBar.style.overflow = Overflow.Hidden;
            hudBar.RegisterCallback<ClickEvent>(ev =>
            {   // 속도 칩 · 그만 보기 같은 띠 안 버튼은 제 일만
                for (var v = ev.target as VisualElement; v != null && v != hudBar; v = v.parent) if (v is Button) return;
                ToggleStatusCard();
            });
            stage.Add(hudBar);
            PlaceAlerts();

            modal = Ui.Box(new Color(0, 0, 0, 0.72f)); Ui.Fill(modal);
            modal.style.alignItems = Align.Center; modal.style.justifyContent = Justify.Center; modal.style.display = DisplayStyle.None;
            root.Add(modal);
        }

        void TogglePhone()
        {
            phoneOpen = !phoneOpen;
            KwGame.Audio.GameAudioManager.Play(phoneOpen ? KwGame.Audio.SoundCue.PhoneOpen : KwGame.Audio.SoundCue.PhoneClose);
            RenderAll();
            if (phoneOpen)
            {
                phone.style.opacity = 0; phone.style.translate = new Translate(60, 0);
                DOTween.To(() => 0f, v => { phone.style.opacity = v; phone.style.translate = new Translate(60 * (1 - v), 0); }, 1f, 0.18f).SetEase(Ease.OutCubic).SetLink(gameObject);
            }
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

        /// 장면 자막 카드 (인트로 회상): 큰 제목 + 설명 + 그려지는 차트 (up = 불장, crash = 오르다 폭락)
        string storyNow;
        IEnumerator StoryCard(string h, string t, string sub, string chart)
        {
            storyNow = h;
            modal.Clear(); modal.style.display = DisplayStyle.Flex;
            var card = Ui.Box(new Color(0.05f, 0.05f, 0.08f, 0.94f), 48, 20); card.style.width = 1100; card.style.alignItems = Align.Center;
            var hl = Ui.Label(h ?? "", 56, Ui.Gold, true); hl.style.unityTextAlign = TextAnchor.MiddleCenter; card.Add(hl);
            if (!string.IsNullOrEmpty(t)) { var tl = Ui.Label(t, 28, Ui.Text); tl.style.unityTextAlign = TextAnchor.MiddleCenter; tl.style.marginTop = 14; card.Add(tl); }
            StoryChart sc = null;
            if (!string.IsNullOrEmpty(chart)) { sc = new StoryChart(chart == "crash"); sc.style.width = 900; sc.style.height = 300; sc.style.marginTop = 24; card.Add(sc); }
            Label sl = null;
            if (!string.IsNullOrEmpty(sub)) { sl = Ui.Label(sub, 32, chart == "crash" ? StkDn : StkUp, true); sl.style.unityTextAlign = TextAnchor.MiddleCenter; sl.style.marginTop = 18; sl.style.opacity = sc != null ? 0 : 1; card.Add(sl); }
            card.Add(Ui.Label("(클릭해서 계속)", 20, Ui.Dim));
            modal.Add(card);
            if (sc != null && !autoSkipDialog)
            {
                for (float a = 0; a < 1.6f; a += Time.unscaledDeltaTime) { sc.t = a / 1.6f; sc.MarkDirtyRepaint(); if (Input.GetMouseButtonDown(0)) break; yield return null; }
                yield return null;
            }
            if (sc != null) { sc.t = 1; sc.MarkDirtyRepaint(); }
            if (sl != null) sl.style.opacity = 1;
            if (sc != null && sc.crash) Shake(card, 22);
            yield return WaitClick();
            modal.style.display = DisplayStyle.None;
            storyNow = null;
        }
        class StoryChart : VisualElement
        {
            public float t; public readonly bool crash; readonly float[] ys;
            public StoryChart(bool crash)
            {
                this.crash = crash; var r = new System.Random(crash ? 7 : 3);
                ys = new float[60]; float y = 0.15f;
                for (int i = 0; i < ys.Length; i++)
                {
                    float f = (float)i / (ys.Length - 1);
                    float trend = crash ? (f < 0.55f ? 0.022f : f < 0.62f ? -0.16f : -0.012f) : 0.013f;
                    y = Mathf.Clamp(y + trend + ((float)r.NextDouble() - 0.5f) * 0.05f, 0.02f, 0.98f); ys[i] = y;
                }
                generateVisualContent += ctx =>
                {
                    var rc = contentRect; var p = ctx.painter2D; int n = Mathf.Max(2, Mathf.CeilToInt(t * ys.Length));
                    p.strokeColor = new Color(1, 1, 1, 0.12f); p.lineWidth = 2; p.BeginPath(); p.MoveTo(new Vector2(0, rc.height)); p.LineTo(new Vector2(rc.width, rc.height)); p.Stroke();
                    p.lineWidth = 6; p.lineJoin = LineJoin.Round; p.BeginPath();
                    for (int i = 0; i < n; i++)
                    {
                        var v = new Vector2(rc.width * i / (ys.Length - 1), rc.height * (1 - ys[i]));
                        if (i == 0) p.MoveTo(v); else p.LineTo(v);
                    }
                    p.strokeColor = crash && n > ys.Length * 0.56f ? StkDn : StkUp; p.Stroke();
                };
            }
        }

        /// v4 저녁 정산 한 장 (settle 이벤트, docs/UI_V2.md "저녁 정산"): 상태 띠 아래, 왼쪽 미래(결과 표정 + 말풍선) · 오른쪽 큰 카드(계획판 자리).
        /// 카드: 오전 · 오후 줄(한 일 + 칸 손익) · 그 밖 → 오늘 합계 → 현금 A → B · 옮긴 돈 → 이번 주 납부 막대 → 리포트 · 포지션 → [밤으로]. 줄이 하나씩 (클릭하면 바로 다)
        VisualElement settleEl;
        IEnumerator SettleCard(SimEvent e)
        {
            SettleClose();
            string cls = e.Str("cls");
            double wage = e.Num("wage"), pnl = e.Num("pnl"), other = e.Num("other"), unreal = e.Num("unreal"), net = e.Num("net");
            int liq = (int)e.Num("liq"), hit = (int)e.Num("hit"), miss = (int)e.Num("miss");
            // 칸 손익엔 그 칸의 다른 돈도 들어가 오전 + 오후가 일당 + 매매와 다를 수 있음 → 합계는 사건의 net 그대로, 그 밖 = net − (오전 + 오후) 로 그려 한 장 안 덧셈을 맞춤
            bool slots = G.v4 && (G.slotActOf(0) != null || G.slotActOf(1) != null);
            double am = slots ? G.slotNetOf(0) : 0, pm = slots ? G.slotNetOf(1) : 0, rest = slots ? net - am - pm : other;

            // 띠 아래 전부를 쓰는 층 (토스트 · 배너 · 띠보다 아래). 계획판 · 대사창 · 선택지 상자 · 데스크는 이 동안 숨김 (DlgSync · LayoutForMode)
            settleEl = new VisualElement { name = "settle" }; Ui.Abs(settleEl, 0, StripH, 0, 0);
            stage.Insert(Math.Max(0, stage.IndexOf(toastCol)), settleEl);
            if (deskEl != null) deskEl.style.display = DisplayStyle.None;
            SetBg("room", G.isEve()); npcKey = null; kimKey = null; cgKey = null; miraiOn = true;
            SetFace(cls == "jackpot" ? "happy" : cls == "loss" ? "pout" : cls == "liq" ? "panic" : net > 0 ? "smug" : "neutral"); DrawStage();
            LayoutForMode();
            miraiEl.style.left = PlanMiraiX;

            // 왼쪽: 미래 한마디 (계획판 말풍선과 같은 자리 · 모양)
            string say = cls == "jackpot" ? $"오늘 {G.man(Math.Abs(net))} 벌었네? 나 치킨 먹어도 돼?"
                : cls == "liq" ? "자기야… 청산 났어? 오늘은 그냥 안아 줄게."
                : cls == "loss" ? "괜찮아… 내일은 오를 거야. 아마도."
                : net > 0 ? "오늘 수고했어. 조금이라도 벌었네." : net < 0 ? "오늘은 좀 샜네… 내일 다시 하자." : "오늘도 버텼다. 잘했어.";
            var bub = Ui.Box(new Color(1, 1, 1, 0.96f), 16, 18); Ui.Abs(bub, PlanBubbleX, 20); bub.style.maxWidth = PlanBubbleW; bub.pickingMode = PickingMode.Ignore;
            var bt = Ui.Label(say, 22, Ui.Ink); bt.style.whiteSpace = WhiteSpace.Normal; bt.pickingMode = PickingMode.Ignore; bub.Add(bt);
            settleEl.Add(bub);

            // 오른쪽: 큰 카드 (계획판 자리 x 820~1880)
            var card = GlassBox(32, 18); Ui.Abs(card, null, PlanTopGap, PlanRight); card.style.width = PlanW;
            float H = stage.layout.height > 10 ? stage.layout.height : 1080;
            card.style.maxHeight = H - StripH - PlanTopGap - 24; card.style.overflow = Overflow.Hidden;
            settleEl.Add(card);
            var head = Ui.Row(); head.style.alignItems = Align.Center; head.style.flexShrink = 0; card.Add(head);
            string dayTxt = G.v4 ? $" · {G.absDay()}일째 ({"월화수목금토일"[(Math.Max(1, S.day) - 1) % 7]})" : "";
            var ttl = Ui.Label(G.T("v4.settle.title") + dayTxt, 36, Ui.Gold, true); ttl.style.flexGrow = 1; head.Add(ttl);
            Color sc = cls == "jackpot" ? Ui.Gold : cls == "loss" ? new Color(0.55f, 0.62f, 0.75f) : cls == "liq" ? Ui.Bad : Ui.Dim;
            var stamp = Ui.Label(G.T(cls == "jackpot" ? "v4.settle.jackpot" : cls == "loss" ? "v4.settle.loss" : cls == "liq" ? "v4.settle.liqC" : "v4.settle.normal"), 30, sc, true);
            Ui.Border(stamp, sc, 4); Ui.Radius(stamp, 10); stamp.style.paddingLeft = 14; stamp.style.paddingRight = 14; stamp.style.paddingTop = 2; stamp.style.paddingBottom = 2;
            stamp.style.rotate = new Rotate(new Angle(-8)); stamp.style.opacity = 0; head.Add(stamp);

            var rows = new List<VisualElement>();
            VisualElement Add(VisualElement r) { r.style.opacity = 0; r.style.flexShrink = 0; card.Add(r); rows.Add(r); return r; }
            // 한 줄: 이름(왼쪽 고정 폭) · 설명(가운데) · 금액(오른쪽). v == null 이면 금액 없음
            void Row(string k, string mid, string v, Color kc, Color mc, Color vc, float size = 24)
            {
                var r = Ui.Row(); r.style.alignItems = Align.Center; r.style.marginTop = 10;
                var kl = Ui.Label(k, size, kc, true); kl.style.width = 120; kl.style.flexShrink = 0; r.Add(kl);
                var ml = Ui.Label(mid ?? "", size, mc); ml.style.flexGrow = 1; ml.style.flexShrink = 1; ml.style.whiteSpace = WhiteSpace.Normal; r.Add(ml);
                if (v != null) { var vl = Ui.Label(v, size, vc, true); vl.style.whiteSpace = WhiteSpace.NoWrap; vl.style.flexShrink = 0; vl.style.marginLeft = 12; r.Add(vl); }
                Add(r);
            }
            void Line() { var ln = Ui.Box(new Color(1, 1, 1, 0.16f)); ln.style.height = 2; ln.style.marginTop = 16; ln.style.marginBottom = 6; ln.style.flexShrink = 0; card.Add(ln); }

            if (slots)
            {   // 칸별 줄: 계획판이 끝난 칸에 쓰는 이름 풀이 그대로
                for (int s = 0; s < 2; s++)
                {
                    string act = G.slotActOf(s); double v = s == 0 ? am : pm;
                    Row(SlotName(s), SlotActName(act, s), G.sgnMan(v), Ui.Accent, act == null ? Ui.Dim : Ui.Text, UpDn(v));
                }
                Row(SlotName(2), "지금 — 미래랑 놀기 · 야간 알바 · 자기", null, Ui.Accent, Ui.Dim, Ui.Dim);
                if (Math.Abs(rest) >= 1) Row("그 밖", "리포트 · 사건 · 도박 · 칸 사이에 오간 돈", G.sgnMan(rest), Ui.Dim, Ui.Dim, UpDn(rest));
            }
            else
            {   // 칸 기록이 없는 날 (옛 칸 방식 · 옛 저장): 일당 · 매매 · 그 밖
                if (wage != 0) Row(G.T("v4.settle.wage"), null, G.sgnMan(wage), Ui.Text, Ui.Dim, UpDn(wage));
                if (pnl != 0) Row(G.T("v4.settle.pnl"), null, G.sgnMan(pnl), Ui.Text, Ui.Dim, UpDn(pnl));
                if (other != 0) Row("그 밖", "리포트 · 사건 · 도박 등", G.sgnMan(other), Ui.Dim, Ui.Dim, UpDn(other));
            }
            if (liq > 0) Row("", G.T("v4.settle.liq", "n", liq), null, Ui.Bad, Ui.Bad, Ui.Bad);
            Line();
            {   // 오늘 합계 (크게)
                var r = Ui.Row(); r.style.alignItems = Align.Center; r.style.marginTop = 4;
                var k = Ui.Label(G.T("v4.settle.net"), 32, Ui.Text, true); k.style.flexGrow = 1; r.Add(k);
                var v = Ui.Label(G.sgnMan(net), 52, UpDn(net), true); v.style.whiteSpace = WhiteSpace.NoWrap; r.Add(v);
                Add(r);
            }
            // 현금 · 옮긴 돈 · 이번 주 납부 (규칙 쪽 settle 필드: cash0 · cash · move · due · gap · dd). 옛 사건엔 cash 가 없음
            if (e["cash"] != null)
            {
                double cash0 = e.Num("cash0"), cash = e.Num("cash"), move = e.Num("move");
                if (cash0 >= 0)   // 옛 저장을 낮에 불러온 날은 아침 현금을 모름 → 지금 현금만
                {
                    Row(G.T("v4.settle.cash"), null, $"{Man(cash0)} → {Man(cash)}", Ui.Dim, Ui.Dim, Ui.Good);
                    if (Math.Abs(move) >= 1) Row("옮긴 돈", G.T("v4.settle.move"), G.sgnMan(move), Ui.Dim, Ui.Dim, Ui.Dim, 20);   // 포지션에 넣거나 뺀 돈 · 대출 · 상환 · 이자 (번 것도 쓴 것도 아님)
                }
                else Row(G.T("v4.settle.cash"), null, Man(cash), Ui.Dim, Ui.Dim, Ui.Good);
                double due = e.Num("due");
                if (G.gateOn && due > 0)
                {   // 이번 주 납부 막대: 상태 띠와 같은 규칙 (현금 ÷ 납부액)
                    double gap = e.Num("gap"), dd = e.Num("dd"); bool full = gap <= 0;
                    string ddT = dd <= 0 ? "D-DAY" : $"D-{dd:0}";
                    var box = new VisualElement(); box.style.marginTop = 16;
                    var hr = Ui.Row(); box.Add(hr);
                    var hl = Ui.Label($"이번 주 납부 {Man(due)}", 22, Ui.Gold, true); hl.style.flexGrow = 1; hr.Add(hl);
                    hr.Add(Ui.Label(full ? $"{G.T("v4.settle.gapOk")} · {ddT}" : G.T("v4.settle.gap", "a", Man(gap), "d", ddT), 22, full ? Ui.Good : Ui.Gold, true));
                    var tr = Ui.Box(new Color(1, 1, 1, 0.14f), 0, 7); tr.style.height = 14; tr.style.marginTop = 8;
                    var f = Ui.Box(full ? Ui.Good : Ui.Gold, 0, 7); f.style.height = Length.Percent(100); f.style.width = Length.Percent((float)(Math.Min(1, Math.Max(0, cash / due)) * 100)); tr.Add(f);
                    box.Add(tr);
                    Add(box);
                }
            }
            // 리포트 적중/빗나감 · 들고 있는 포지션 (있을 때만)
            if (hit + miss > 0 || unreal != 0)
            {
                var r = Ui.Row(); r.style.flexWrap = Wrap.Wrap; r.style.marginTop = 12;
                if (hit + miss > 0) r.Add(Ui.Label(G.T("v4.settle.rep", "h", hit, "m", miss), 20, Ui.Text));
                if (unreal != 0)
                {
                    var ul = Ui.Label((hit + miss > 0 ? "  ·  " : "") + G.T("v4.settle.unreal", "a", G.sgnMan(unreal)), 20, UpDn(unreal)); r.Add(ul);
                }
                Add(r);
            }
            var go = Ui.Button("밤으로", RequestAdvance, "클릭 · Space · Enter", false, Ui.Accent, 26);
            go.name = "settle-go"; go.style.marginTop = 18; go.style.marginBottom = 0; go.style.alignItems = Align.Center; go.style.flexShrink = 0; card.Add(go);

            if (!autoSkipDialog)
            {
                float step = Mathf.Min(0.18f, 1.1f / Mathf.Max(1, rows.Count)); bool skip = false;
                card.style.translate = new Translate(40, 0);
                yield return Tween(0.16f, p => card.style.translate = new Translate(40 * (1 - EaseOut(p)), 0));
                foreach (var r in rows)
                {
                    for (float t = 0; t < step && !skip; t += Time.unscaledDeltaTime)
                    {
                        float p = t / step; r.style.opacity = p; r.style.translate = new Translate(14 * (1 - p), 0);
                        if (AnyPress()) skip = true;
                        yield return null;
                    }
                    r.style.opacity = 1; r.style.translate = new Translate(0, 0);
                }
                if (!skip) yield return Tween(0.22f, p => { stamp.style.opacity = p; stamp.style.scale = new Scale(Vector3.one * Mathf.Lerp(1.8f, 1f, EaseOut(p))); });
            }
            card.style.translate = new Translate(0, 0);
            foreach (var r in rows) { r.style.opacity = 1; r.style.translate = new Translate(0, 0); }
            stamp.style.opacity = 1; stamp.style.scale = new Scale(Vector3.one);
            if (cls == "jackpot" || cls == "liq") Shake(stamp, 8);
            yield return WaitClick();
            SettleClose();
        }
        void SettleClose()
        {
            if (settleEl == null) return;
            settleEl.RemoveFromHierarchy(); settleEl = null;
            LayoutForMode(); RenderDesk();
        }

        /// 캐릭터 그림을 장면 높이에 맞춤 (그림은 739×1080)
        void FitFigures()
        {
            float h = stage.resolvedStyle.height; if (float.IsNaN(h) || h <= 0) return;
            float mh = Mathf.Min(900, h * 0.86f), nh = Mathf.Min(800, h * 0.8f);
            miraiEl.style.height = mh; miraiEl.style.width = mh * 739f / 1080f;
            npcEl.style.height = nh; npcEl.style.width = nh * 739f / 1080f;
        }
        /// 미니게임 중엔 장면 위 카드를 다 걷음. 집(고를 것 없음)에선 선택지 상자 숨김
        string layoutSig;
        void LayoutForMode()
        {
            var P = S?.pending;
            bool mgFull = P?.t == "work" && P.setup != null;
            string sig = (P?.t ?? "") + "|" + mgFull + "|" + phoneOpen;
            if (sig != layoutSig) { layoutSig = sig; CloseStatusCard(); }   // 화면이 바뀌면 떠 있던 상태 카드는 닫음 (같은 화면을 다시 그릴 땐 그대로)
            DisplayStyle Show(bool b) => b ? DisplayStyle.Flex : DisplayStyle.None;
            bool v4 = G != null && G.v4, home = v4 && P?.t == "home";
            hudBar.style.display = Show(!mgFull);
            mini.style.display = Show(!v4 && !mgFull && S?.rt == true && P?.t != "start" && S.phase != "opening");   // v4 는 시세를 데스크에서
            quickBar.style.display = Show(!v4);   // v4 집 행동은 계획판에만
            panel.style.display = Show(!mgFull && P != null && P.t != "home" && !DeskActive && settleEl == null);
            panel.style.left = Length.Percent(phoneOpen ? 26 : 50);   // 폰 열리면 선택지는 왼쪽으로
            // 폰이 열리면 아래로 내림 (대사 글줄은 가려도 됨: "위에서 골라 줘"뿐). 위쪽은 상태 띠 아래까지만. 스크롤 영역에 최대 높이를 직접 줘야 넘칠 때 스크롤 · "더 있음"이 됨
            bool low = !mgFull && phoneOpen;
            float H = stage.layout.height > 10 ? stage.layout.height : 1080;
            float pb = low ? 190 : 330, pm = Mathf.Max(240, Mathf.Min(low ? 380 : 620, H - pb - StripH - 24));
            panel.style.bottom = pb; panel.style.maxHeight = pm;
            if (panelSv != null) panelSv.style.maxHeight = pm - 100;
            phone.style.display = Show(!mgFull && phoneOpen);
            dlg.style.right = !mgFull && phoneOpen ? PhoneW + 20 + 16 : 40;   // 폰 열리면 대사창을 폰 왼쪽까지만
            // 집: 미래는 왼쪽, 오른쪽은 계획판 (겹치지 않게 왼쪽으로 붙임)
            if (home || settleEl != null) miraiEl.style.left = PlanMiraiX; else miraiEl.style.left = Length.Percent(18);   // 정산 한 장도 오른쪽이 카드
            PlanLayout(stage.layout.width > 10 ? stage.layout.width : 1920, H);
            DlgSync();
            PlaceAlerts();
        }

        const float PhoneW = 880, HudW = 520;
        /// 맨 위 상태 띠 높이 (1080p 기준). 데스크 · 계획판 · 알림이 이 아래부터
        const float StripH = 80;
        VisualElement bannerCol, panelMore; ScrollView panelSv;

        /// 알림 자리 (화면 모드별): 토스트 · 배너 · 카톡 팝업
        /// 평소 = 토스트는 띠 아래 왼쪽, 배너는 띠 아래 가운데 · 데스크 = 가운데 차트 칸 위쪽 (종목 목록 · 주문 패널을 안 가림) · 미니게임 = 토스트는 하단 가운데 · 폰 열림 = 띠 아래 폰 왼쪽
        /// 카톡 팝업 = 집 · 데스크에선 왼쪽 아래 (계획판 · 주문 패널을 안 가림), 그 밖엔 대사창 바로 위
        void PlaceAlerts()
        {
            if (toastCol == null || bannerCol == null || hudBar == null) return;
            var P = G?.S?.pending;
            bool mgFull = P?.t == "work" && P.setup != null;
            bool desk = DeskActive, home = G != null && G.v4 && P?.t == "home";
            float W = stage.layout.width > 10 ? stage.layout.width : 1920;
            float top = StripH + 12;
            float bh = bannerCol.childCount > 0 && !float.IsNaN(bannerCol.layout.height) ? bannerCol.layout.height + 8 : 0;
            void Center(VisualElement v, float w) { v.style.left = Length.Percent(50); v.style.translate = new Translate(Length.Percent(-50), 0); v.style.width = w; }
            void At(VisualElement v, float x, float w) { v.style.left = x; v.style.translate = new Translate(0, 0); v.style.width = w; }
            toastCol.style.bottom = StyleKeyword.Auto; toastCol.style.alignItems = Align.FlexStart; bannerCol.style.top = top;
            if (mgFull)
            {   // 미니게임: 손님 줄 · 주문표가 있는 위쪽을 비우고 하단 가운데 (띠도 숨음)
                Center(toastCol, 640); toastCol.style.top = StyleKeyword.Auto; toastCol.style.bottom = 40; toastCol.style.alignItems = Align.Center;
                Center(bannerCol, 760); bannerCol.style.top = 24;
            }
            else if (phoneOpen)
            {   // 띠 아래, 폰 왼쪽: 배너 → 그 아래 토스트
                float w = Mathf.Max(320, W - 24 - PhoneW - 20 - 16);
                At(bannerCol, 24, w);
                At(toastCol, 24, Mathf.Min(HudW, w)); toastCol.style.top = top + bh;
            }
            else if (desk)
            {   // 데스크: 가운데 차트 칸 위쪽 (왼쪽 종목 목록 380 · 오른쪽 주문 패널 470 사이)
                float lw = DeskPart("list") is VisualElement dl && dl.layout.width > 10 ? dl.layout.width : 380, rw = DeskPart("order") is VisualElement dord && dord.layout.width > 10 ? dord.layout.width : 470;
                float x = 24 + lw + 16, w = Mathf.Max(320, W - x - rw - 24 - 16);
                At(bannerCol, x, w);
                At(toastCol, x, w); toastCol.style.top = top + bh;
            }
            else
            {
                At(toastCol, 24, HudW); toastCol.style.top = top;
                Center(bannerCol, 760);
            }
            if (bannerCol.parent != null && bannerCol.parent.IndexOf(bannerCol) < bannerCol.parent.childCount - 1) bannerCol.BringToFront();   // 폰보다 위
            // 카톡 팝업 (GameController.Phone.cs 가 처음 띄울 때 만듦)
            if (kkPopCol != null)
            {
                if (!mgFull && desk)
                {   // 데스크: 차트 칸 왼쪽 아래 (차트는 누르는 곳이 아님 · 소식 띠와 종목 목록을 안 가림)
                    float lw2 = DeskPart("list") is VisualElement dl2 && dl2.layout.width > 10 ? dl2.layout.width : 380;
                    kkPopCol.style.left = 24 + lw2 + 16; kkPopCol.style.right = StyleKeyword.Auto; kkPopCol.style.bottom = 12 + 170 + 10 + 12;
                }
                else if (!mgFull && home)
                {   // 집: 누를 곳(계획판 · 띠)이 없는 왼쪽 아래
                    kkPopCol.style.left = 24; kkPopCol.style.right = StyleKeyword.Auto; kkPopCol.style.bottom = 24;
                }
                else
                {
                    float dh = dlg.resolvedStyle.display != DisplayStyle.None && dlg.layout.height > 1 ? dlg.layout.height + 24 + 12 : 24;
                    // 폰이 열리면 선택지 상자가 아래로 내려와 있음 → 그 위로 올려서 버튼을 안 가리게
                    bool boxLow = !mgFull && phoneOpen && panel.resolvedStyle.display != DisplayStyle.None;
                    float ph = panel.layout.height > 1 ? panel.layout.height : 380;
                    kkPopCol.style.left = StyleKeyword.Auto;
                    kkPopCol.style.bottom = boxLow ? 190 + ph + 12 : dh;
                    kkPopCol.style.right = !mgFull && phoneOpen ? PhoneW + 20 + 16 : 24;
                }
            }
        }

        /// 선택지 상자가 넘치면 아래쪽 "▼ 더 있음"
        void PanelMoreSync()
        {
            if (panelSv == null || panelMore == null) return;
            // 마지막 선택지의 아래 끝이 스크롤 영역 밖이면 더 있음 (스크롤 뷰 내부 높이 값에 기대지 않고 화면 좌표로 봄)
            var last = panelBody != null && panelBody.childCount > 0 ? panelBody[panelBody.childCount - 1] : null;
            bool more = last != null && !float.IsNaN(last.worldBound.yMax) && !float.IsNaN(panelSv.worldBound.yMax) && last.worldBound.yMax > panelSv.worldBound.yMax + 6;
            panelMore.style.display = more ? DisplayStyle.Flex : DisplayStyle.None;
        }

        // ---------- 공통 ----------
        void RenderAll()
        {
            RenderHud(G.HudSnapOf());
            RenderStage();
            RenderPanel();
            RenderPhone();
            RenderMini();
            RenderSaveControls();
            BarrageSync();
            SickSync();
            MinigameSync();
            LayoutForMode(); RenderDesk();
            CoachMaybe();
        }

        /// 대사가 없을 때 대사창: 집이면 미래 한마디 (v4 는 미래 옆 말풍선), 밖이면 지금 있는 곳
        void SetIdle()
        {
            if (dlgText.style.display == DisplayStyle.Flex) return;
            var P = S?.pending;
            if (P?.t == "home" && G.v4 && planBubbleText != null)
            {
                planBubbleText.text = Ui.Clean(HomeLine() ?? "");
                dlgName.style.display = DisplayStyle.None; idleText.text = "";
            }
            else if (P?.t == "home") { dlgName.text = "미래"; dlgName.style.display = DisplayStyle.Flex; idleText.text = Ui.Clean(HomeLine() ?? ""); idleText.style.color = Ui.Text; }
            else
            {
                dlgName.style.display = DisplayStyle.None;
                idleText.text = P == null ? "" : P.t == "start" ? StartLine()
                    : P.t == "ending" ? (S.endInfo?.ok == true ? "빚 0원. 해냈다." : "끝. 스코어보드를 보고 새 게임으로.") : Ui.Clean(LocTitle()) + " — 위에서 골라 줘";
                idleText.style.color = Ui.Dim;
            }
        }

        /// 시작 화면 한 줄 (숫자는 rules 에서: v4 = 주 이자 RT_RATE · 만기 V4_DAYS)
        string StartLine()
        {
            var R = D.RULES;
            return G.v4 ? $"빚 {G.man(R.DEBT0)} 원. 만기 {R.V4_DAYS}일. 매주({R.MONTH_DAYS}일) 이자 {G.rate() * 100:0.#}% ({G.man(G.interestDue())} 원).\n하루 세 번: 장 보기 · 알바 · 미래랑 놀기 중에 골라."
                : $"빚 {G.man(R.DEBT0)} 원. 매달({R.MONTH_DAYS}일) 이자 {G.rate() * 100:0.#}%. 알바·주식·코인·도박… 갚을 방법은 많다.";
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
            if (kind == "bubble" || kind == "" || kind == null) KwGame.Audio.GameAudioManager.Play(KwGame.Audio.SoundCue.ToastPop);   // 돈·속보 토스트는 자기 소리가 있음
            var t = Ui.Box(kind == "good" ? new Color(0.12f, 0.3f, 0.18f, 0.95f) : kind == "liq" ? new Color(0.35f, 0.1f, 0.12f, 0.95f) : kind == "big" ? new Color(0.4f, 0.3f, 0.05f, 0.95f) : new Color(0.15f, 0.15f, 0.22f, 0.95f), 14, 10);
            t.style.marginBottom = 8; t.pickingMode = PickingMode.Ignore;
            if (icon != null) { t.style.flexDirection = FlexDirection.Row; t.style.alignItems = Align.Center; t.Add(Icon(icon, 56)); }
            var l = Ui.Label(text, kind == "big" ? 28 : 21, Ui.Text, kind == "big"); l.pickingMode = PickingMode.Ignore; t.Add(l);
            t.style.opacity = 0;
            t.style.translate = new Translate(0, 14, 0);
            toastCol.Add(t);
            while (toastCol.childCount > 3) toastCol.RemoveAt(0);
            var animation = DOTween.Sequence().SetTarget(t).SetLink(gameObject).SetUpdate(true);
            animation.Append(DOTween.To(() => 0f, value =>
            {
                t.style.opacity = value;
                t.style.translate = new Translate(0, 14 * (1 - value), 0);
            }, 1f, 0.22f).SetEase(Ease.OutCubic));
            animation.AppendInterval(kind == "big" ? 4.6f : 3.4f);
            animation.Append(DOTween.To(() => 1f, value =>
            {
                t.style.opacity = value;
                t.style.translate = new Translate(0, 8 * (1 - value), 0);
            }, 0f, 0.18f).SetEase(Ease.InQuad));
            animation.OnComplete(() => t.RemoveFromHierarchy());
            t.RegisterCallback<DetachFromPanelEvent>(_ => animation.Kill());
        }

        // ---------- 맨 위 상태 띠 (한 줄). 자세한 건 띠를 누르면 상태 카드 ----------
        void RenderHud(HudSnap h)
        {
            hudBar.Clear(); hudCash = null;
            Label L(string t, float size, Color c, bool bold = false) { var l = Ui.Label(t, size, c, bold); l.style.whiteSpace = WhiteSpace.NoWrap; l.style.flexShrink = 0; l.pickingMode = PickingMode.Ignore; return l; }
            if (h.phase == "opening" || S.pending?.t == "start")
            {
                hudBar.Add(L("롱잡고알바감", 34, Ui.Accent, true));
                CloseStatusCard();
                return;
            }
            // 좁은 화면(4:3)에서 띠가 넘치면 이 글부터 줄어듦 (맨 끝 "그만 보기" · 호감이 잘리지 않게)
            Label Soft(Label l) { l.style.flexShrink = 1; l.style.minWidth = 0; l.style.overflow = Overflow.Hidden; l.style.textOverflow = TextOverflow.Ellipsis; return l; }
            VisualElement Chip(string t, Color fg, Color bg)
            {
                var c = Ui.Box(bg, 0, 6); c.style.marginLeft = 10; c.style.paddingLeft = 8; c.style.paddingRight = 8; c.style.paddingTop = 2; c.style.paddingBottom = 2; c.style.flexShrink = 0; c.pickingMode = PickingMode.Ignore;
                c.Add(L(t, 18, fg, true)); hudBar.Add(c); return c;
            }
            void Gap() { var g = new VisualElement(); g.style.width = 2; g.style.height = 36; g.style.marginLeft = 18; g.style.marginRight = 18; g.style.flexShrink = 0; g.style.backgroundColor = new Color(1, 1, 1, 0.14f); g.pickingMode = PickingMode.Ignore; hudBar.Add(g); }
            Label M(string k, string v, Color c)
            {
                var b = Ui.Row(); b.style.marginRight = 22; b.style.flexShrink = 0; b.pickingMode = PickingMode.Ignore;
                b.Add(L(k, 20, Ui.Dim)); var vl = L(v, 24, c, true); vl.style.marginLeft = 6; b.Add(vl); hudBar.Add(b); return vl;
            }
            int MD = D.RULES.MONTH_DAYS;
            bool watch = G.v4 && S.pending?.t == "watch";
            if (watch)
            {   // 장 보기: 시계(흰색) + 장중 칩 + 속도 (키 1 · 2 · 4 · Space)
                hudBar.Add(L(G.clockNow(), 30, Ui.Text, true));
                if (G.stockOpen()) Chip("장중", StkUp, new Color(1f, 0.3f, 0.37f, 0.16f));
                var g0 = new VisualElement(); g0.style.width = 14; g0.style.flexShrink = 0; hudBar.Add(g0);
                foreach (var (v0, l) in new[] { (0, "Ⅱ"), (1, "1x"), (2, "2x"), (4, "4x") })
                {
                    int v = v0; var c = Ui.Chip(l, () => SetSpeed(v), false, rtSpeed == v ? Ui.Accent : new Color(1, 1, 1, 0.06f));
                    c.style.marginLeft = 0; c.style.marginRight = 6; c.style.marginBottom = 0; c.style.flexShrink = 0; c.Q<Label>().style.whiteSpace = WhiteSpace.NoWrap; hudBar.Add(c);
                }
                hudBar.Add(Soft(L(rtSpeed == 0 ? "멈춤 · Space 재개" : "Space 멈춤", 18, Ui.Dim)));
                Gap();
            }
            else
            {   // 날짜 · 칸
                string dayTxt = G.v4 ? $"{G.absDay()}일째 ({"월화수목금토일"[(h.day - 1) % 7]})" : $"{h.month}개월 {h.day}일";   // v4: 1주 = 월~일, 토·일 휴장
                string slotTxt = (G.v4 ? new[] { "오전", "오후", "밤" } : D.SLOT_NAME.ToArray())[Math.Min(h.slot, 2)];
                hudBar.Add(L($"{dayTxt} · {slotTxt}", 24, Ui.Text, true));
                if (S.rt && !G.v4) hudBar.Add(L("  " + G.clockNow(), 20, Ui.Dim));   // 옛 칸 방식 실시간
                Gap();
                M("빚", Man(h.debt), Ui.Bad);
            }
            hudCash = M("현금", Man(h.cash), Ui.Good);
            // 현금이 바뀌면 어떤 경로든(매매 · 리포트 · 대출 · 상점 …) 옆에 ± 숫자. 새 판·불러오기 직후엔 기준만 잡음
            if (hudCashG != G) { hudCashG = G; hudCashPrev = h.cash; }
            else if (Math.Abs(h.cash - hudCashPrev) >= 1) { CashFloat(h.cash - hudCashPrev); hudCashPrev = h.cash; }
            if (watch) M("평가", Man(h.hv), Ui.Text);
            else if (G.v4) M("순자산", Man(G.equity()), Ui.Text);
            else if (h.hv != 0) M("평가", Man(h.hv), Ui.Text);
            Gap();
            if (G.gateOn)
            {   // 이번 주 납부: 금액 · 막대(현금 ÷ 납부액) · 숫자 · D-n
                double due = G.gateDue();
                int gd = G.gateDays(); string dd = gd <= 0 ? "D-DAY" : $"D-{gd}";
                if (due <= 0)
                {
                    bool lastWk = h.month >= D.RULES.V4_GATE_CAP.Length;
                    var ok = L(lastWk ? "이번 주 납부 끝" : G.T("v4.gate.hudOk", "cap", G.man(G.gateCap(h.month + 1))), 22, Ui.Good, true); ok.style.flexShrink = 1; ok.style.overflow = Overflow.Hidden; hudBar.Add(ok);
                }
                else
                {
                    hudBar.Add(L(watch ? $"납부 {Man(due)}" : $"이번 주 납부 {Man(due)}", 22, Ui.Gold, true));
                    bool full = h.cash >= due; double fr = Math.Min(1, Math.Max(0, h.cash / due));
                    var tr = Ui.Box(new Color(1, 1, 1, 0.14f), 0, 6); tr.style.height = 12; tr.style.flexGrow = 1; tr.style.flexShrink = 1; tr.style.minWidth = 60; tr.style.maxWidth = 240;
                    tr.style.marginLeft = 12; tr.style.marginRight = 12; tr.pickingMode = PickingMode.Ignore;
                    var f = Ui.Box(full ? Ui.Good : Ui.Gold, 0, 6); f.style.height = Length.Percent(100); f.style.width = Length.Percent((float)(fr * 100)); f.pickingMode = PickingMode.Ignore; tr.Add(f);
                    hudBar.Add(tr);
                    hudBar.Add(Soft(full ? L($"다 모음 · 내면 {Man(h.cash - due)} 남음", 20, Ui.Good, true) : L($"현금 {Man(h.cash)} / 납부 {Man(due)}", 20, Ui.Text, true)));   // 가득 찬 막대도 '내고 나면 얼마 남나'로 읽히게
                    Chip(dd, gd <= 1 ? Ui.Ink : Ui.Gold, gd <= 1 ? Ui.Bad : new Color(1f, 0.82f, 0.4f, 0.16f));
                }
                if (S.missN > 0) Chip($"미납 {S.missN}/{D.RULES.V4_MISS_MAX}", Ui.Ink, Ui.Bad);
            }
            else hudBar.Add(L(h.paidMonth == h.month ? (G.v4 ? "이번 주 이자 냄" : "이번 달 이자 냄") : $"이자 {(MD - h.day == 0 ? "D-DAY" : $"D-{MD - h.day}")} · {Man(MathK.Round1k(h.debt * G.rate()))}", 22, h.paidMonth == h.month ? Ui.Good : Ui.Gold, true));
            var sp = new VisualElement(); sp.style.flexGrow = 1; sp.style.minWidth = 12; sp.pickingMode = PickingMode.Ignore; hudBar.Add(sp);
            if (watch)
            {   // 그만 보기: 포지션을 들고 있으면 4초 안에 한 번 더 (Chart 의 rptArm 방식)
                int nPos = S.cps.Count + G.STK().Count(hk => S.hold.Has(hk));
                bool armed = nPos > 0 && Time.realtimeSinceStartup - watchEndArm < 4;
                var end = Ui.Chip(armed ? "한 번 더 누르면 넘김" : "그만 보기", () =>
                {
                    if (nPos == 0 || Time.realtimeSinceStartup - watchEndArm < 4) { watchEndArm = -10; Send("watchEnd"); }
                    else { watchEndArm = Time.realtimeSinceStartup; Toast($"포지션 {nPos}개를 든 채로 시간이 흘러가요 · 4초 안에 다시 누르기", ""); RenderHud(G.HudSnapOf()); }
                }, false, new Color(0, 0, 0, 0));
                Ui.Border(end, armed ? Ui.Bad : new Color(1, 1, 1, 0.35f), 2); end.style.marginRight = 0; end.style.marginBottom = 0; end.style.flexShrink = 0; end.Q<Label>().style.whiteSpace = WhiteSpace.NoWrap;
                hudBar.Add(end);
            }
            else
            {   // 스트레스 · 호감 (찰수록 경고색 · 같이 엔딩 문턱 넘으면 분홍)
                hudBar.Add(L($"스트레스 {h.stress:0}", 22, h.stress >= G.menLine() ? Ui.Bad : h.stress >= 40 ? Ui.Gold : Ui.Dim, true));
                if (G.v4) hudBar.Add(L($" · 호감 {S.aff:0}", 22, S.aff >= D.RULES.V4_AFF_GOOD ? new Color(1f, 0.45f, 0.65f) : S.aff < 30 ? Ui.Bad : Ui.Dim, true));
            }
            if (statusCard != null) RenderStatusCard();
        }

        // ---------- 자세한 상태 카드 (띠 아래): 띠를 다시 누르거나 바깥 클릭 · Esc 로 닫힘 ----------
        VisualElement statusCard; ScrollView statusSv; bool statusHooked;
        void ToggleStatusCard() { if (statusCard != null) CloseStatusCard(); else OpenStatusCard(); }
        void CloseStatusCard() { statusCard?.RemoveFromHierarchy(); statusCard = null; statusSv = null; }
        void OpenStatusCard()
        {
            if (G == null || S.pending?.t == "start" || S.phase == "opening") return;
            CloseStatusCard();
            if (!statusHooked)
            {   // 바깥을 누르면 닫기 (카드 · 띠를 누른 건 빼고 — 띠는 자기 클릭으로 닫음)
                statusHooked = true;
                root.RegisterCallback<PointerDownEvent>(ev =>
                {
                    if (statusCard == null) return;
                    for (var v = ev.target as VisualElement; v != null; v = v.parent) if (v == statusCard || v == hudBar) return;
                    CloseStatusCard();
                }, TrickleDown.TrickleDown);
            }
            statusCard = GlassBox(22, 16); Ui.Border(statusCard, Ui.Gold, 2); Ui.Abs(statusCard, 24, StripH + 8); statusCard.style.width = 760;
            float H = stage.layout.height > 10 ? stage.layout.height : 1080;
            statusCard.style.maxHeight = H - StripH - 32;
            statusSv = new ScrollView(ScrollViewMode.Vertical); statusSv.style.flexShrink = 1; statusSv.style.maxHeight = H - StripH - 32 - 44 - 80;
            statusSv.contentViewport.style.overflow = Overflow.Hidden;
            statusCard.Add(statusSv);
            stage.Add(statusCard);
            RenderStatusCard();
        }
        /// 예전 왼쪽 위 상태판에 있던 것 전부 (장 · 만기 · 목표 · 부탁 · 털기 · 납부 내역 · 막대 · 버프 · 유물) + 도움말 · 설정 · 저장 · 타이틀
        void RenderStatusCard()
        {
            if (statusCard == null || statusSv == null || G == null) return;
            var h = G.HudSnapOf();
            var body = statusSv.contentContainer; body.Clear();
            while (statusCard.childCount > 1) statusCard.RemoveAt(statusCard.childCount - 1);   // 스크롤 영역만 남기고 (스크롤 위치 유지)
            Label T(string t, float size, Color c, bool bold = false, float top = 6)
            {
                var l = Ui.Label(t, size, c, bold); l.style.whiteSpace = WhiteSpace.Normal; l.style.marginTop = top; l.pickingMode = PickingMode.Ignore; body.Add(l); return l;
            }
            void Head(string t) { var l = T(t, 22, Ui.Gold, true, 16); l.style.paddingTop = 10; l.style.borderTopWidth = 1; l.style.borderTopColor = new Color(1, 1, 1, 0.12f); }
            int MD = D.RULES.MONTH_DAYS;
            if (G.v4)
            {
                T($"{(S.part > 1 ? "2부 " : "")}{G.chapter()}장 {G.chapterName()} · 만기 D-{G.daysLeft()}" + (G.weekend() ? " · 주말 휴장" : ""), 26, G.daysLeft() <= 3 ? Ui.Bad : Ui.Gold, true, 0);
                T("목표: 빚 0원 = 클리어", 24, Ui.Text, true);
                T(DuoGoal(), 20, DuoOk() ? Ui.Good : Ui.Dim);
                var p = G.promNow(); string ps = G.promState();
                if (p != null) T($"미래 부탁: {p.hud} · " + (ps == "bad" ? "어김" : ps == "todo" ? "아직" : "지킴"), 22, ps == "bad" ? Ui.Bad : ps == "todo" ? Ui.Gold : Ui.Good, true);
                // 털기 루트: 준비 단계 + 미래 각오 (숫자 대신 뭐가 모자란지만)
                if (S.heist > 0)
                {
                    string mind = S.aff < D.RULES.V4_AFF_HEIST ? "아직 날 덜 믿음 (호감)" : S.greed < D.RULES.V4_GREED_HEIST ? "아직 겁먹음 (욕심)" : "단단함";
                    T($"금고 털기 준비 {S.heist}/3 · 미래 각오: {mind}" + (S.heistGo ? " · 오늘 밤 턴다" : ""), 22, G.heistOk() ? Ui.Good : Ui.Gold, true);
                }
            }
            else T($"{h.month}개월 {h.day}일 · {G.clockNow()}", 26, Ui.Gold, true, 0);
            T("지금 있는 곳: " + Ui.Clean(LocTitle()), 20, Ui.Dim);
            // 돈 · 납부 내역
            Head("돈");
            T($"빚 {Man(h.debt)} · 현금 {Man(h.cash)}" + (h.hv != 0 ? $" · 평가 {Man(h.hv)}" : "") + (G.v4 ? $" · 순자산 {Man(G.equity())}" : ""), 22, Ui.Text);
            if (G.gateOn)
            {
                double due = G.gateDue(), intr = h.paidMonth == h.month ? 0 : G.interestDue();
                int gd = G.gateDays(); string dd = gd <= 0 ? "D-DAY" : $"D-{gd}";
                if (due > 0) T($"이번 주 납부 {Man(due)} ({dd}) = 이자 {Man(intr)} + 원금 {Man(G.gatePrincipal())}", 22, gd <= 1 ? Ui.Bad : Ui.Gold, true);
                else T("이번 주 납부는 다 냈어요", 22, Ui.Good, true);
                if (S.missN > 0) T($"미납 {S.missN}/{D.RULES.V4_MISS_MAX} — 이번 주도 못 내면 원양어선", 20, Ui.Bad, true);
            }
            else T(h.paidMonth == h.month ? (G.v4 ? "이번 주 이자 냄" : "이번 달 이자 냄") : $"이자 {(MD - h.day == 0 ? "D-DAY" : $"D-{MD - h.day}")} · {Man(MathK.Round1k(h.debt * G.rate()))}", 22, h.paidMonth == h.month ? Ui.Good : Ui.Gold, true);
            // 막대
            Head("몸 · 마음");
            var bars = Ui.Row(); bars.style.marginTop = 8; bars.style.flexWrap = Wrap.Wrap; body.Add(bars);
            void Bar(string k, double v, Color c, string tail, double tick = -1)
            {
                var b = new VisualElement(); b.style.width = Length.Percent(48); b.style.marginRight = Length.Percent(2); b.style.marginBottom = 8; b.style.overflow = Overflow.Hidden;
                b.Add(Ui.Label($"{k} {v:0}{tail}", 20, Ui.Text));
                var tr = Ui.Box(new Color(1, 1, 1, 0.12f), 0, 5); tr.style.height = 10; tr.style.marginTop = 4;
                var f = Ui.Box(c, 0, 5); f.style.height = Length.Percent(100); f.style.width = Length.Percent((float)Math.Max(0, Math.Min(100, v))); tr.Add(f);
                if (tick >= 0)   // 목표 눈금 (호감 = 같이 엔딩)
                {
                    var tk = new VisualElement(); tk.style.position = Position.Absolute; tk.style.left = Length.Percent((float)tick); tk.style.top = -3; tk.style.bottom = -3; tk.style.width = 2;
                    tk.style.backgroundColor = Color.white; tk.pickingMode = PickingMode.Ignore; tr.Add(tk);
                }
                b.Add(tr); bars.Add(b);
            }
            if (!G.hpOff) Bar("체력", h.hp, h.hp < D.RULES.HP_LOW ? Ui.Bad : Ui.Good, h.faint ? " 기절" : "");
            string men = h.stress >= G.menLine() ? " 멘헤라" : h.stress >= 40 ? " 불안" : "";
            Bar("스트레스", h.stress, h.stress >= G.menLine() ? Ui.Bad : h.stress >= 40 ? Ui.Gold : Ui.Dim, men);
            if (G.v4) Bar("호감", S.aff, S.aff >= D.RULES.V4_AFF_GOOD ? new Color(1f, 0.45f, 0.65f) : S.aff < 30 ? Ui.Bad : Ui.Gold, "", D.RULES.V4_AFF_GOOD);
            Bar("중독", h.addict, h.addict >= 60 ? Ui.Bad : h.addict >= 30 ? Ui.Gold : Ui.Dim, "");
            // 몸 상태 (옛 칸 방식: 병 · 숙취 · 내일 아플 확률)
            if (S.rt && !G.v4)
            {
                double sickPr = G.sickP();
                string sick = G.sickName() != null ? $"{G.sickName()} 앓는 중 · {S.sickD}일 남음" : $"내일 아플 확률 {sickPr * 100:0}%";
                if (S.hang) sick += " · 숙취";
                T(sick, 20, G.sickName() != null || sickPr >= 0.2 ? Ui.Bad : Ui.Dim, G.sickName() != null);
            }
            // 호감 버프와 효과
            if (G.v4 && G.buffs() is List<string> bfs && bfs.Count > 0)
            {
                Head("호감 버프");
                var segs = (G.T("v4.buff.help") ?? "").Split(new[] { " · " }, StringSplitOptions.RemoveEmptyEntries);
                for (int i = 0; i < bfs.Count; i++)
                {
                    string name = Ui.Clean(bfs[i]), bd = i < segs.Length ? segs[i].Trim() : G.T("v4.buff.help");
                    if (!bd.StartsWith("호감")) bd = "호감 " + bd;
                    T(name, 22, new Color(1f, 0.75f, 0.85f), true, 8);
                    T(bd, 20, Ui.Text, false, 2);
                }
            }
            // 유물: 아이콘 + 이름 + 효과
            if (h.augs.Count > 0)
            {
                Head($"유물 {h.augs.Count}개");
                foreach (var id in h.augs)
                {
                    var a = D.AUGS.FirstOrDefault(x => x.id == id);
                    var r = Ui.Row(); r.style.alignItems = Align.FlexStart; r.style.marginTop = 10; r.pickingMode = PickingMode.Ignore;
                    var ic = Icon(ArtCatalog.Relic(id), 48); ic.style.marginRight = 12; ic.style.flexShrink = 0; r.Add(ic);
                    var col = new VisualElement(); col.style.flexShrink = 1; col.pickingMode = PickingMode.Ignore; r.Add(col);
                    col.Add(Ui.Label(a?.name ?? id, 22, Ui.Gold, true));
                    if (!string.IsNullOrEmpty(a?.d)) col.Add(Ui.Label(a.d, 20, Ui.Text));
                    body.Add(r);
                }
            }
            // 맨 아래: 집이 아닌 화면에서도 갈 수 있게
            var foot = Ui.Row(); foot.style.marginTop = 14; foot.style.flexShrink = 0; foot.style.paddingTop = 12; foot.style.borderTopWidth = 1; foot.style.borderTopColor = new Color(1, 1, 1, 0.12f);
            statusCard.Add(foot);
            void B(string t, Action a, bool dis) { var b = Ui.Chip(t, () => { CloseStatusCard(); a(); }, dis, new Color(1, 1, 1, 0.06f)); b.style.marginBottom = 0; b.style.flexShrink = 0; foot.Add(b); }
            B("도움말", CoachStart, playing);
            B("설정", OpenSettings, playing);
            B("저장", () => SaveCheckpoint(true), !CanSave);
            B("타이틀", ReturnToTitle, playing);
            var fs = new VisualElement(); fs.style.flexGrow = 1; foot.Add(fs);
            var hint = Ui.Label("띠를 다시 누르거나 Esc", 18, Ui.Dim); hint.style.whiteSpace = WhiteSpace.NoWrap; foot.Add(hint);
        }


        // ---------- 현금 ± 숫자 (cash 이벤트) ----------
        Label hudCash; double cashAcc, hudCashPrev; bool cashFlushQueued; GameSim hudCashG;
        /// 한 프레임에 들어온 cash 이벤트를 합쳐서 HUD 현금 숫자 옆에 0.8초 떠올림
        void CashFloat(double d)
        {
            if (d == 0) return;
            cashAcc += d;
            if (cashFlushQueued) return;
            cashFlushQueued = true;
            root.schedule.Execute(() =>
            {
                cashFlushQueued = false; double v = cashAcc; cashAcc = 0;
                if (Math.Abs(v) < 1 || hudCash == null || hudCash.panel == null) return;
                var wb = hudCash.worldBound; if (wb.width < 1) return;
                var p = stage.WorldToLocal(new Vector2(wb.xMax, wb.yMin));
                var f = Ui.Label(G.sgnMan(v), 24, v > 0 ? Ui.Good : Ui.Text, true); f.pickingMode = PickingMode.Ignore; f.style.whiteSpace = WhiteSpace.NoWrap;   // 손익이 아니라 현금 변화(포지션에 넣은 돈도 포함)라 손익 색을 안 씀
                Ui.Abs(f, p.x + 8, p.y); f.style.opacity = 0;
                stage.Add(f);
                var seq = DOTween.Sequence().SetTarget(f).SetLink(gameObject).SetUpdate(true);
                seq.Append(DOTween.To(() => 0f, x => { f.style.opacity = Mathf.Min(1, x * 4); f.style.translate = new Translate(0, -26 * x); }, 1f, 0.8f).SetEase(Ease.OutCubic));
                seq.Append(DOTween.To(() => 1f, x => f.style.opacity = x, 0f, 0.2f));
                seq.OnComplete(() => f.RemoveFromHierarchy());
                f.RegisterCallback<DetachFromPanelEvent>(_ => seq.Kill());
            });
        }

        // ---------- 발표 · 예약 체결 배너 (위쪽 가운데 2.5초, 토스트와 따로) ----------
        void ReportBanner(SimEvent e)
        {
            bool up = e["up"] is bool u && u, ok = e["ok"] is bool o && o, hold = e["hold"] is bool hd && hd;
            string n = e.Str("n") ?? (e.Str("tk") != null && D.TK.TryGetValue(e.Str("tk"), out var td) ? td.name : "");
            string who = e.Str("who");
            string text = $"발표 — {n} {(up ? "▲" : "▼")}" + (string.IsNullOrEmpty(who) ? "" : $" · {who} {(ok ? "적중" : "빗나감")}");
            Banner(text, UpDn(up ? 1 : -1), hold ? "· 보유 중" : null);
        }
        void StopBanner(SimEvent e)
        {
            bool tp = e["tp"] is bool t && t; double pnl = e.Num("pnl");
            Banner($"예약 {(tp ? "익절" : "손절")} 체결 — {e.Str("n")} {G.sgnMan(pnl)}", UpDn(pnl), null);
        }
        void Banner(string text, Color c, string strong)
        {
            var b = Ui.Box(new Color(0.05f, 0.05f, 0.09f, 0.96f), 14, 12); Ui.Border(b, c, 3); b.style.marginBottom = 8; b.pickingMode = PickingMode.Ignore;
            b.style.flexDirection = FlexDirection.Row; b.style.flexWrap = Wrap.Wrap; b.style.alignItems = Align.Center; b.style.justifyContent = Justify.Center;
            var l = Ui.Label(text, 26, c, true); l.pickingMode = PickingMode.Ignore; b.Add(l);
            if (strong != null)
            {
                var s = Ui.Label(strong, 24, Ui.Ink, true); s.pickingMode = PickingMode.Ignore; s.style.backgroundColor = Ui.Gold; Ui.Radius(s, 6);
                s.style.marginLeft = 10; s.style.paddingLeft = 8; s.style.paddingRight = 8; b.Add(s);
            }
            b.style.opacity = 0;
            bannerCol.Add(b);
            while (bannerCol.childCount > 3) bannerCol.RemoveAt(0);
            PlaceAlerts();
            var seq = DOTween.Sequence().SetTarget(b).SetLink(gameObject).SetUpdate(true);
            seq.Append(DOTween.To(() => 0f, v => { b.style.opacity = v; b.style.scale = new Scale(Vector3.one * Mathf.Lerp(1.15f, 1f, v)); }, 1f, 0.2f).SetEase(Ease.OutCubic));
            seq.AppendInterval(2.5f);
            seq.Append(DOTween.To(() => 1f, v => b.style.opacity = v, 0f, 0.25f));
            seq.OnComplete(() => b.RemoveFromHierarchy());
            b.RegisterCallback<DetachFromPanelEvent>(_ => seq.Kill());
        }

        // ---------- 키: 장 보기 = 1/2/4 속도 · Space 멈춤/재개 · 그 밖 선택지 = 숫자 1~9 ----------
        int rtSpeedLast = 1;
        void SetSpeed(int v) { if (v > 0) rtSpeedLast = v; rtSpeed = v; RenderHud(G.HudSnapOf()); }
        /// 선택지 상자에 Btn/IconBtn 으로 넣은 순서대로 (null = 잠김)
        readonly List<Action> panelActs = new List<Action>();
        void PanelKeys()
        {
            if (G == null || coach != null) return;
            var t = S.pending?.t;
            if (t == "watch")
            {
                if (Input.GetKeyDown(KeyCode.Alpha1) || Input.GetKeyDown(KeyCode.Keypad1)) SetSpeed(1);
                else if (Input.GetKeyDown(KeyCode.Alpha2) || Input.GetKeyDown(KeyCode.Keypad2)) SetSpeed(2);
                else if (Input.GetKeyDown(KeyCode.Alpha4) || Input.GetKeyDown(KeyCode.Keypad4)) SetSpeed(4);
                else if (Input.GetKeyDown(KeyCode.Space)) SetSpeed(rtSpeed == 0 ? Math.Max(1, rtSpeedLast) : 0);
                return;
            }
            bool plan = G.v4 && t == "home" && planEl != null && planEl.resolvedStyle.display != DisplayStyle.None;   // 집 = 계획판 지금 칸의 행동 카드 순서
            if (plan && (phoneOpen || statusCard != null)) return;   // 폰 · 상태 카드가 판을 덮고 있으면 안 보이는 행동이 나가지 않게
            if (!plan && panel.resolvedStyle.display == DisplayStyle.None) return;
            for (int i = 0; i < 9 && i < panelActs.Count; i++)
            {
                if (!Input.GetKeyDown(KeyCode.Alpha1 + i) && !Input.GetKeyDown(KeyCode.Keypad1 + i)) continue;
                var a = panelActs[i];
                KwGame.Audio.GameAudioManager.Play(a == null ? KwGame.Audio.SoundCue.UiDenied : KwGame.Audio.SoundCue.ButtonClick);
                a?.Invoke();
                return;
            }
        }

        // ---------- 미니 시세창 (오른쪽 위) ----------
        void RenderMini()
        {
            mini.Clear();
            if (G == null || G.v4 || !S.rt || S.mk == null) return;   // v4 는 시세를 데스크에서
            Label L(string t, float size, Color c, bool bold = false) { var l = Ui.Label(t, size, c, bold); l.style.whiteSpace = WhiteSpace.NoWrap; l.pickingMode = PickingMode.Ignore; return l; }
            var head = Ui.Row(); head.style.alignItems = Align.Center; head.pickingMode = PickingMode.Ignore; mini.Add(head);
            head.Add(L("개미증권", 20, Ui.Text, true));
            var sp = new VisualElement(); sp.style.flexGrow = 1; head.Add(sp);
            head.Add(L(G.stockOpen() ? "● 장중" : "○ 장 마감 · 코인만", 18, G.stockOpen() ? StkUp : StkAxis));
            int unread = G.kUnread();
            // 보유 포지션
            int n = 0;
            foreach (var k in G.STK().Where(k => S.hold.Has(k)).ToList())
            {
                if (n++ >= 3) break;
                var x = S.hold[k]; double v = x.q * S.mk.tk[k].p - x.cost;
                var r = Ui.Row(); r.style.marginTop = 6; r.pickingMode = PickingMode.Ignore; mini.Add(r);
                r.Add(L(D.TK[k].name, 18, Ui.Text)); var s0 = new VisualElement(); s0.style.flexGrow = 1; r.Add(s0);
                r.Add(L($"{G.sgnMan(v)} ({GameSim.pct(v / Math.Max(1, x.cost))})", 18, UpDn(v), true));
            }
            foreach (var c in S.cps.ToList())
            {
                if (n++ >= 4) break;
                double pl = G.cpnl(c) + c.bonus, p = S.mk.tk[c.tk].p, liq = GameSim.liqPx(c), gap = Math.Abs(p / liq - 1);
                var r = Ui.Row(); r.style.marginTop = 6; r.pickingMode = PickingMode.Ignore; mini.Add(r);
                r.Add(L($"{D.TK[c.tk].name} {c.lev:0}x {(c.dir > 0 ? "롱" : "숏")}", 18, c.dir > 0 ? StkUp : StkDn)); var s0 = new VisualElement(); s0.style.flexGrow = 1; r.Add(s0);
                r.Add(L($"{G.sgnMan(pl)} ({GameSim.pct(pl / Math.Max(1, c.margin))})", 18, UpDn(pl), true));
                if (c.lev * c.mult > 1.2 && gap < 0.05) mini.Add(L($"   주의: 청산가까지 {gap * 100:0.0}%", 18, Ui.Bad, true));
            }
            // 보던 종목 미니 차트
            string tk = stkSel != null && S.mk.tk.Has(stkSel) ? stkSel : D.TKList.First(t => G.tkOpen(t.id)).id;
            var mk = S.mk.tk[tk]; double dr = G.dayR(tk);
            var pr = Ui.Row(); pr.style.marginTop = 10; pr.style.alignItems = Align.FlexEnd; pr.pickingMode = PickingMode.Ignore; mini.Add(pr);
            pr.Add(L(D.TK[tk].name, 18, StkAxis)); var s1 = new VisualElement(); s1.style.flexGrow = 1; pr.Add(s1);
            pr.Add(L(G.fmtP(mk.p), 24, UpDn(dr), true)); pr.Add(L(" " + GameSim.pct(dr), 18, UpDn(dr), true));
            var sl = new LineChart(mk.hist.Skip(Math.Max(0, mk.hist.Count - 24)).Select(c => c.c).Concat(new[] { mk.p }).ToList(), false, null);
            sl.style.height = 56; sl.style.marginTop = 4; mini.Add(sl);
            mini.Add(L(phoneOpen ? "폰 열림 · P 로 닫기" : $"눌러서 폰 열기 (P){(unread > 0 ? $" · 카톡 {unread}" : "")}", 18, Ui.Dim));
        }

        // ---------- 행동 패널 (pending 마다) ----------
        void Title(string t) => panelTitle.text = Ui.Clean(t);
        void Btn(string text, Action a, string sub = null, bool dis = false, Color? bg = null) { var b = Ui.Button(text, a, sub, dis, bg); KeyBadge(b, a, dis, bg); panelBody.Add(b); }
        /// 선택지 숫자 키 (1~9): 넣은 순서대로 번호. 버튼 오른쪽 위에 작게 표시
        void KeyBadge(Button b, Action a, bool dis, Color? bg = null)
        {
            panelActs.Add(dis ? null : a);
            int n = panelActs.Count;
            if (n > 9 || S.pending?.t == "watch") return;
            var k = Ui.Label(n.ToString(), 18, bg.HasValue && Ui.IsLight(bg.Value) && !dis ? Ui.InkSub : Ui.Dim, true); k.pickingMode = PickingMode.Ignore;
            Ui.Abs(k, null, 8, 12); b.Add(k);
        }
        /// 아이콘 붙은 버튼 (유물 고르기·상점)
        void IconBtn(Sprite icon, string text, Action a, string sub = null, bool dis = false)
        {
            var b = Ui.Button(text, a, sub, dis);
            var col = new VisualElement(); col.style.flexShrink = 1; col.pickingMode = PickingMode.Ignore;
            while (b.childCount > 0) col.Add(b[0]);
            b.style.flexDirection = FlexDirection.Row; b.style.alignItems = Align.Center;
            var ic = Icon(icon, 72); ic.style.marginRight = 16; ic.style.flexShrink = 0;
            if (dis) ic.style.opacity = 0.5f;
            b.Add(ic); b.Add(col);
            KeyBadge(b, a, dis);
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
            panelBody.Clear(); panelActs.Clear();
            var P = S.pending;
            SetIdle();
            stageTitle.text = Ui.Clean(LocTitle());
            if (P == null) { Title("…"); return; }
            switch (P.t)
            {
                case "start":
                    Title("롱잡고알바감");
                    Info(StartLine(), 26, Ui.Text);
                    Btn("새 게임 시작", () => Send("start"), $"시드 {S.seed}", false, Ui.Accent);
                    Btn($"AI 뉴스·대사 (Claude): {(LlmSettings.On ? "켜짐" : "꺼짐")}", () => LlmToggle(!LlmSettings.On),
                        string.IsNullOrEmpty(LlmSettings.Url) ? "서버 URL 없음" : (LlmSettings.On ? "끄면 내장 문구만 씀" : "켜면 뉴스·대사를 AI 가 씀 (실패하면 내장 문구)"), string.IsNullOrEmpty(LlmSettings.Url));
                    break;
                case "relic":
                    Title("집안 유물 상자");
                    Info(P.reason ?? "", 22);
                    for (int i = 0; i < P.offer.Count; i++)
                    {
                        int k = i; var a = D.AUGS.First(x => x.id == P.offer[i]);
                        IconBtn(ArtCatalog.Relic(a.id), $"{a.name}  [{(D.TIER.TryGetValue(a.tier.ToString(), out var tn) ? tn : a.tier.ToString())}]", () => Send("pickRelic", "i", k), a.d);
                    }
                    Btn("상자 더 뒤지기 (1회)", () => Send("relicReroll"), null, P.rerolled);
                    break;
                case "home":   // 집은 선택지 상자 없이: v4 = 계획판 (GameController.Plan.cs) · 옛 칸 방식 = 대사창 퀵메뉴
                    Title($"집 · {D.SLOT_NAME[Math.Min(S.slot, D.SLOT_NAME.Count - 1)]}");
                    RenderPlan();
                    break;
                case "watch" when G.v4:   // 장 보기 = 데스크 (GameController.Desk.cs) · 속도 · 그만 보기는 상태 띠
                    Title("장 보기");
                    CoachCtx("watch");   // 첫 장 보기 → 장 보기 설명 카드
                    break;
                case "watch":
                    Title(G.weekend() ? "장 보기 · 주말 (코인만)" : G.stockOpen() ? "장 보기 · 장중" : "장 보기 · 장 닫힘 (코인만)");
                    Info($"{G.clockNow()} · 이 칸 끝({GameSim.clockOf(G.slotEndMin(S.slot))})까지 시세가 실시간으로 움직여요. 폰(P)으로 사고팔기.", 22, Ui.Text);
                    Btn(phoneOpen ? "폰 닫기 (P)" : "폰 열기 (P)", TogglePhone);
                    {   // 그만 보기: 폰 버튼과 떼어 놓고 테두리만 있는 다른 모양. 포지션을 들고 있으면 한 번 더 눌러야 (Chart 의 rptArm 방식)
                        int nPos = S.cps.Count + G.STK().Count(hk => S.hold.Has(hk));
                        bool armed = nPos > 0 && Time.realtimeSinceStartup - watchEndArm < 4;
                        var gapEl = new VisualElement(); gapEl.style.height = 2; gapEl.style.marginTop = 14; gapEl.style.marginBottom = 16; gapEl.style.backgroundColor = new Color(1, 1, 1, 0.12f); panelBody.Add(gapEl);
                        var end = Ui.Button(armed ? "한 번 더 누르면 남은 시간 넘김" : "그만 보기 (남은 시간 넘기기)", () =>
                        {
                            if (nPos == 0 || Time.realtimeSinceStartup - watchEndArm < 4) { watchEndArm = -10; Send("watchEnd"); }
                            else { watchEndArm = Time.realtimeSinceStartup; RenderPanel(); }
                        }, nPos > 0 ? (armed ? $"포지션 {nPos}개를 든 채로 시간이 흘러가요 · 4초 안에 다시 누르기" : $"포지션 {nPos}개를 들고 있어요 · 한 번 더 확인해요") : "이 칸 남은 시간을 건너뛰어요", false, new Color(0, 0, 0, 0));
                        Ui.Border(end, armed ? Ui.Bad : new Color(1, 1, 1, 0.35f), 2); end.style.alignSelf = Align.FlexEnd;
                        panelBody.Add(end);
                    }
                    CoachCtx("watch");   // 첫 장 보기 → 장 보기 설명 카드
                    break;
                case "map":
                    Title("어디 갈까?");
                    CoachCtx("map");   // 첫 외출 → 외출 설명 카드
                    Btn("집으로", () => Send("goTo", "loc", "home"));
                    foreach (var L in D.LOCList.Where(L => (!L.rt || S.rt) && !G.locHidden(L.id)))
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
                    Btn(S.visit != null && S.visit.used && !S.rt ? "나가기 (칸 끝)" : "나가기", () => Send("leave"), null, false, Ui.Panel);
                    break;
                case "loan":
                    Title("김사장 캐피탈");
                    Info($"빚 {G.won(S.debt)} / 한도 {G.won(G.loanCap())} · 선이자 {G.loanFee() * 100:0}%", 22, Ui.Text);
                    if (!G.loanOk() && G.gateOn) Info("김사장: \"신규 고객님은 한 주 약속 지켜 보시고 오세요^^\"\n" + G.T("v4.gate.loanNext"), 22, Ui.Gold);   // 관문 규칙: 첫 납부 통과 뒤
                    else if (!G.loanOk())
                    {   // 옛 규칙: 대출 = 이자일에 이자 내면 열림. 미리 내기는 매매 실현수익 V4_LEV_PROFIT[1] 넘어야 인정
                        var LP = D.RULES.V4_LEV_PROFIT; int dl = D.RULES.MONTH_DAYS - S.day;
                        Info(G.T("v4.loanLock", "next", G.creditNext() ?? "", "dd", dl <= 0 ? "D-DAY" : $"D-{dl}",
                            "r", G.sgnMan(S.realized), "p", G.man(LP != null && LP.Length > 1 ? LP[1] : 0)), 22, Ui.Gold);
                    }
                    if (G.loanOk() && G.loanWeekHint() is string lwh) Info(lwh, 22, Ui.Gold);   // 관문 규칙: 주당 한도
                    foreach (var amt in D.RULES.LOAN_AMTS) { var a = amt; Btn($"{G.man(a)}원 빌리기", () => Send("borrow", "amt", a), $"실수령 {G.won(MathK.RoundHalfUp(a * (1 - G.loanFee())))}", S.debt + a > G.loanCap() || !G.loanOk() || a > G.loanWeekRoom()); }
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
                    Title(P.loc == "home" ? "빚 갚기 (김사장 계좌로 이체)" : "원금 상환");
                    Info($"빚 {G.won(S.debt)} · 현금 {G.won(S.cash)}" + (P.due > 0 ? $" · {(G.v4 ? "이번 주" : "이번 달")} 이자 {G.won(P.due)} 남겨 둘 것" : ""), 22, Ui.Text);
                    {
                        var seen = new HashSet<double>();
                        foreach (var (a, l) in new[] { (P.mx, P.mx >= S.debt ? "빚 전부 갚기" : "가진 돈 전부"), (Math.Max(0, Math.Floor((P.mx - P.due) / 10000) * 10000), "이자 몫은 남기고"), (Math.Floor(P.mx / 20000) * 10000, "절반"), (100000.0, "10만 원만") })
                        {
                            if (a <= 0 || a < 10000 && a < S.debt || a > P.mx || !seen.Add(a)) continue;   // 만 원 밑은 "빚 전부 갚기"(자투리)만
                            var amt = a; Btn($"{l} · {G.won(amt)}", () => Send("repay", "amt", amt), $"갚으면 빚 {G.won(S.debt - amt)} · 이자 {G.won(MathK.Round1k((S.debt - amt) * G.rate()))}로 줄어듦");
                        }
                    }
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
                    Title("수상한 유물 상점");
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
                case "event":
                    {   // 제목 = 이벤트 제목, 상황(마지막 대사)을 카드에 남김 — 대사창이 "… 위에서 골라 줘"로 바뀌어도 뭘 고르는지 보이게
                        var ev = D.EVENTS.FirstOrDefault(ed => ed.id == P.evId);
                        Title(!string.IsNullOrEmpty(ev?.title) ? $"{ev.title} — 어떻게 할까?" : "돌발 상황 — 어떻게 할까?");
                        var last = ev?.lines?.LastOrDefault(ln => ln != null && ln.Length > 1 && !string.IsNullOrEmpty(ln[1]));
                        if (last != null)
                        {
                            string who = last[0] == "m" ? "미래: " : last[0] == "kim" ? "김사장: " : last[0] == "me" ? "나: " : "";
                            Info(who + FillRules(last[1]), 22, Ui.Text);
                        }
                    }
                    foreach (var o in P.opts) { var k = o.k; Btn(o.l, () => Send("evPick", "k", k), o.sub, o.dis); }
                    break;
                case "tempt":
                    Title("도박 유혹");
                    foreach (var o in P.opts) { var k = o.k; Btn(o.l, () => Send("tempt", "k", k), o.sub, o.dis); }
                    break;
                case "payday":
                    Title(P.stage == "gate" ? "원금 분납" : P.stage == "repay" ? "이자 냄 — 원금도 갚을까?" : P.stage == "side" ? "김사장 홀짝" : $"이자일 — {G.won(P.due)}");
                    if (P.stage == "gate") Info($"이번 주 원금 {G.won(P.due)} · 내고 나면 빚 {G.won(G.gateCap())}" + (S.missN > 0 ? $" · 지금 미납 {S.missN}/{D.RULES.V4_MISS_MAX}" : ""), 22, Ui.Text);
                    foreach (var o in P.opts) { var k = o.k; Btn(o.l, () => Send("payday", "k", k), o.sub, o.dis, k == "gatePay" ? Ui.Accent : (Color?)null); }
                    break;
                case "ending": RenderEnding(P); break;
                default: Title(P.t); Info("(이 화면은 아직 없음)"); break;
            }
            NoShrink(panelBody);   // 스크롤 상자 안 버튼이 눌려 글자 겹치지 않게
        }

        /// 알바 설명 카드의 한 줄 요약 (조작법 전문은 미니게임 시작 때 그림 안내가 보여 줌)
        static readonly Dictionary<string, string> MG_SUMMARY = new Dictionary<string, string>
        {
            ["cafe"] = "주문표대로 음료를 담아 서빙해요. 손님 3명.",
            ["store"] = "바늘이 초록 구간에 올 때 찍어요. 4번.",
            ["ware"] = "연타로 박스를 올려요. 6초.",
            ["mart"] = "떨어지는 박스와 카트를 피하며 9초 버텨요.",
        };
        float watchEndArm = -10;   // 장 보기 "그만 보기" 확인 대기 (누른 시각)

        void RenderWork(Pending P)
        {
            var J = D.JOBS[P.key];
            Title(J.name);
            if (P.setup == null)
            {
                // 일당 · 난이도 · 한 줄 요약만 (조작법 전문은 바로 뒤 그림 안내가 맡음)
                Info($"일당 {G.man(G.jobPay(J, 0))}~{G.man(G.jobPay(J, 1))}원{(G.hpOff ? "" : $" · 체력 −{G.jobHp(J)}")} · 난이도 ×{G.mgHard():0.00}", 24, Ui.Gold);
                Info(MG_SUMMARY.TryGetValue(P.key, out var sum) ? sum : "", 22, Ui.Text);
                if (G.workMult() < 1 && !G.hpOff) Info($"체력이 낮아 점수 ×{G.workMult():0.00}", 20, Ui.Bad);
                Btn("일 시작", () => Send("mgSetup"), "조작법 그림을 본 뒤 3·2·1 하고 시작", false, Ui.Accent);
                Btn("다른 알바 고르기", () => Send("workBack"), "아직 시작 전이라 시간은 안 써요", false, Ui.Panel);
                return;
            }
            if (P.setup.hpm < 1) Info($"{(G.hpOff ? "스트레스" : "체력·스트레스")} 때문에 점수 ×{P.setup.hpm:0.00}", 20, Ui.Bad);
            MinigameEnsure(P);
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
                    if (S.rt) Info("같은 숫자 나오면 딜러 승 (판돈 몰수)", 20, Ui.Bad);
                    Btn("하이 (더 높다)", () => Send("bet", "stake", stake, "choice", 1), $"×{GameSim.hlMult(P.A, true, G.hlEdge()):0.00} · 적중 확률 {(13 - P.A) / 13.0 * 100:0}%", cant || GameSim.hlMult(P.A, true) == 0);
                    Btn("로우 (더 낮다)", () => Send("bet", "stake", stake, "choice", 0), $"×{GameSim.hlMult(P.A, false, G.hlEdge()):0.00} · 적중 확률 {(P.A - 1) / 13.0 * 100:0}%", cant || GameSim.hlMult(P.A, false) == 0);
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
            // v4 만기 결산(이자는 냄)은 "이자 미납" 태그 대신 만기 태그
            bool matured = G.v4 && E != null && E.kind == "bad1" && E.days >= D.RULES.V4_DAYS && S.paidMonth == S.month;
            Title(matured ? G.T(E.variant == "duo" ? "v4.tag.duo" : "v4.tag.sea") : E?.tag ?? "엔딩");
            if (E == null) return;
            Info($"판 코드 {GameSim.SeedCode(S.seed)} · {G.DiffName()}", 20, Ui.Dim);
            Info(E.h, 32, E.ok ? Ui.Good : Ui.Bad);
            Info(E.lead, 22, Ui.Text);
            UnlockStrip();
            // 버튼을 먼저 (스코어보드가 길어 상자 아래로 잘리지 않게)
            if (P.cont) Btn(G.v4 && S.part == 1 ? "2부: 아빠의 차용증 →" : "계속하기 (빚 없는 자유 모드)", () => Send("continue"), G.v4 && S.part == 1 ? "김사장이 또 문을 두드린다" : null, false, Ui.Accent);
            Btn("새 게임", () => NewGame(UnityEngine.Random.Range(1, 1000000), S.diff ?? "normal"), null, false, P.cont ? (Color?)null : Ui.Accent);
            ResultCardBox();
            var sb = E.sb;
            Info("스코어보드", 26, Ui.Gold);
            void Row(string k, string v) { var r = Ui.Row(); r.style.justifyContent = Justify.SpaceBetween; r.style.marginBottom = 4; r.Add(Ui.Label(k, 22, Ui.Dim)); r.Add(Ui.Label(v, 22, Ui.Text, true)); panelBody.Add(r); }
            Row("버틴 날", G.v4 ? $"{sb.days}일 / {D.RULES.V4_DAYS}일" : $"{sb.days}일 ({sb.month}개월 {sb.day}일)");
            Row("남은 빚", G.won(sb.debt)); Row("갚은 빚", G.won(sb.repaid)); Row("낸 이자", G.won(sb.interest));
            Row("알바로 번 돈", G.won(sb.earned)); Row("투자 손익", G.sgnWon(sb.profit)); Row("도박 순손익", G.sgnWon(sb.gnet));
            Row("최대 자산", G.won(sb.maxAsset)); Row("도박 승/판", $"{sb.gW}/{sb.gN}"); Row("투자 승/매도", $"{sb.iW}/{sb.iN} · 청산 {sb.liq}");
            Row("갤 명성", $"{sb.fame} ({sb.rank})"); Row("중독도", $"{sb.addict}"); Row("기절 · 돌발 매수", $"{sb.faint} · {sb.impulse}");
        }

        // ---------- 엔딩 기록 · 결과 카드 ----------
        string metaRunStamp; MetaUnlock lastUnlock; bool unlockSoundPlayed;

        /// 엔딩 이벤트 때 한 번: 결과 → 메타 진행(엔딩·도전과제) 저장. 같은 판을 두 번 적지 않게 도장(seed:part:days:kind)
        void RecordMeta()
        {
            var E = S.endInfo;
            if (E == null) return;
            string stamp = $"{S.seed}:{S.part}:{E.days}:{E.kind}";
            if (stamp == metaRunStamp) return;
            metaRunStamp = stamp; lastUnlock = null; unlockSoundPlayed = false;
            var r = G.Result();   // newAch 포함
            var meta = MetaStore.Default.Load();
            var u = meta.Apply(r, DateTime.UtcNow.ToString("O"));
            if (u != null && !ShotMode.On && MetaStore.Default.TrySave(meta, out _)) FlushPrefs();   // 웹 캡처 모드: 화면에 'NEW 엔딩'만 보이고 기록은 안 씀   // WebGL 에서 기록 파일이 브라우저에 남게
            bool any = u != null && (u.newEndings?.Count > 0 || u.newAch?.Count > 0);
            lastUnlock = any ? u : null;
        }

        /// 새로 얻은 엔딩·도전과제 띠 (처음 보일 때 해금 소리 한 번)
        void UnlockStrip()
        {
            var u = lastUnlock;
            if (u == null) return;
            var box = Ui.Box(new Color(0.4f, 0.3f, 0.05f, 0.95f), 14, 10); Ui.Border(box, Ui.Gold, 2); box.style.marginBottom = 12;
            if (u.newEndings?.Count > 0)
            {
                var cat = GameSim.EndingCatalog(D);
                var names = u.newEndings.Select(k => cat.FirstOrDefault(c => c.key == k)?.name ?? k);
                box.Add(Ui.Label("NEW 엔딩: " + string.Join(", ", names), 24, Ui.Gold, true));
            }
            if (u.newAch?.Count > 0)
            {
                var ach = GameSim.Achievements(D);
                var names = u.newAch.Select(id => ach.FirstOrDefault(a => a.id == id)?.name ?? id);
                var l = Ui.Label("도전과제 달성: " + string.Join(", ", names), 22, Ui.Text, true); l.style.marginTop = 4; box.Add(l);
            }
            panelBody.Add(box);
            if (!unlockSoundPlayed) { unlockSoundPlayed = true; KwGame.Audio.GameAudioManager.Play(KwGame.Audio.SoundCue.Unlock); }
        }

        /// 결과 카드 (친구한테 보낼 글) + 복사 버튼
        void ResultCardBox()
        {
            string text = G.ResultCard();
            if (string.IsNullOrEmpty(text)) return;
            var box = Ui.Box(new Color(1, 1, 1, 0.05f), 16, 10); Ui.Border(box, new Color(1, 1, 1, 0.12f), 1); box.style.marginBottom = 14;
            var head = Ui.Row(); head.style.marginBottom = 8; box.Add(head);
            head.Add(Ui.Label("결과 카드", 24, Ui.Gold, true));
            var sp = new VisualElement(); sp.style.flexGrow = 1; head.Add(sp);
            Button copy = null;
            copy = Ui.Chip("복사", () =>
            {
                CopyText(text);
                Toast("복사했어요 · 안 되면 글을 드래그해서 복사하세요", "good");
                var l = copy.Q<Label>(); l.text = "복사됨";
                copy.schedule.Execute(() => l.text = "복사").ExecuteLater(2000);
            });
            copy.style.marginRight = 0; copy.style.marginBottom = 0; copy.style.flexShrink = 0;
            head.Add(copy);
            var body = Ui.Label(text, 20, Ui.Text); body.selection.isSelectable = true; box.Add(body);
            panelBody.Add(box);
        }

#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] static extern void KwCopyText(string s);
#endif
        static void CopyText(string text)
        {
            GUIUtility.systemCopyBuffer = text;
#if UNITY_WEBGL && !UNITY_EDITOR
            KwCopyText(text);
#endif
        }
    }
}
