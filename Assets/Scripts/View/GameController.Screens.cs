using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using DG.Tweening;
using Febucci.TextAnimatorForUnity;
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

        // 비주얼노벨식 한 화면: 장면이 화면 전체. 위에 작은 카드들(왼쪽 상태 · 오른쪽 미니 시세 · 가운데 알림),
        // 아래 대사창(평소엔 미래 한마디 + 퀵메뉴), 고를 게 있을 때만 가운데 선택지 상자, 폰은 오른쪽에서 열고 닫음(P).
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

            // 왼쪽 위 상태 카드 (예전 HUD)
            hudBar = GlassBox(18, 18); Ui.Abs(hudBar, 24, 24); hudBar.style.width = 520; hudBar.pickingMode = PickingMode.Ignore;
            stage.Add(hudBar);

            // 오른쪽 위 미니 시세창 (누르면 폰)
            mini = GlassBox(14, 16); Ui.Abs(mini, null, 24, 24); mini.style.width = 400;
            mini.RegisterCallback<ClickEvent>(_ => { if (!phoneOpen) TogglePhone(); });
            stage.Add(mini);

            // 가운데 선택지 상자 (고를 게 있을 때만)
            panel = GlassBox(24, 18);
            panel.style.position = Position.Absolute; panel.style.left = Length.Percent(50); panel.style.translate = new Translate(Length.Percent(-50), 0);
            panel.style.bottom = 330; panel.style.width = 780; panel.style.maxHeight = 620;
            panelTitle = Ui.Label("", 30, Ui.Gold, true); panelTitle.style.marginBottom = 12; panelTitle.style.flexShrink = 0; panel.Add(panelTitle);
            var sv = new ScrollView(ScrollViewMode.Vertical); sv.style.flexShrink = 1; sv.contentViewport.style.overflow = Overflow.Hidden;
            panelBody = sv.contentContainer;
            panel.Add(sv);
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

            // 폰 (오른쪽에서 밀려 나옴)
            phone = Ui.Box(new Color(0.04f, 0.04f, 0.06f, 0.99f), 12, 40);   // 폰 테두리(베젤) — 안쪽 앱 화면은 RenderPhone
            Ui.Abs(phone, null, 20, 20, 20); phone.style.width = 880; Ui.Border(phone, new Color(0.32f, 0.32f, 0.38f), 3); phone.style.overflow = Overflow.Hidden;
            phone.style.display = DisplayStyle.None;
            stage.Add(phone);

            // 알림 (왼쪽, 상태 카드 아래, 3개까지)
            toastCol = new VisualElement(); Ui.Abs(toastCol, 24, 330);   // 상태 카드 아래
            toastCol.style.width = 520; toastCol.style.alignItems = Align.FlexStart; toastCol.pickingMode = PickingMode.Ignore;
            stage.Add(toastCol);

            modal = Ui.Box(new Color(0, 0, 0, 0.72f)); Ui.Fill(modal);
            modal.style.alignItems = Align.Center; modal.style.justifyContent = Justify.Center; modal.style.display = DisplayStyle.None;
            root.Add(modal);
        }

        void TogglePhone()
        {
            phoneOpen = !phoneOpen;
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

        /// 캐릭터 그림을 장면 높이에 맞춤 (그림은 739×1080)
        void FitFigures()
        {
            float h = stage.resolvedStyle.height; if (float.IsNaN(h) || h <= 0) return;
            float mh = Mathf.Min(900, h * 0.86f), nh = Mathf.Min(800, h * 0.8f);
            miraiEl.style.height = mh; miraiEl.style.width = mh * 739f / 1080f;
            npcEl.style.height = nh; npcEl.style.width = nh * 739f / 1080f;
        }
        /// 미니게임 중엔 장면 위 카드를 다 걷음. 집(고를 것 없음)에선 선택지 상자 숨김
        void LayoutForMode()
        {
            var P = S?.pending;
            bool mgFull = P?.t == "work" && P.setup != null;
            DisplayStyle Show(bool b) => b ? DisplayStyle.Flex : DisplayStyle.None;
            hudBar.style.display = Show(!mgFull);
            mini.style.display = Show(!mgFull && S?.rt == true && P?.t != "start" && S.phase != "opening");
            dlg.style.display = Show(!mgFull);
            panel.style.display = Show(!mgFull && P != null && P.t != "home");
            panel.style.left = Length.Percent(phoneOpen ? 26 : 50);   // 폰 열리면 선택지는 왼쪽으로
            phone.style.display = Show(!mgFull && phoneOpen);
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
            MinigameSync();
            LayoutForMode();
        }

        /// 대사가 없을 때 대사창: 집이면 미래 한마디, 밖이면 지금 있는 곳
        void SetIdle()
        {
            if (dlgText.style.display == DisplayStyle.Flex) return;
            var P = S?.pending;
            if (P?.t == "home") { dlgName.text = "미래"; dlgName.style.display = DisplayStyle.Flex; idleText.text = Ui.Clean(HomeLine() ?? ""); idleText.style.color = Ui.Text; }
            else
            {
                dlgName.style.display = DisplayStyle.None;
                idleText.text = P == null ? "" : P.t == "start" ? "빚 3천만 원. 매달(7일) 이자 5%. 알바·주식·코인·도박… 갚을 방법은 많다."
                    : P.t == "ending" ? (S.endInfo?.ok == true ? "빚 0원. 해냈다." : "끝. 스코어보드를 보고 새 게임으로.") : Ui.Clean(LocTitle()) + " — 위에서 골라 줘";
                idleText.style.color = Ui.Dim;
            }
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

        // ---------- 상태 카드 (왼쪽 위) ----------
        void RenderHud(HudSnap h)
        {
            hudBar.Clear();
            if (h.phase == "opening" || S.pending?.t == "start")
            {
                hudBar.Add(Ui.Label("롱잡고알바감", 36, Ui.Accent, true));
                return;
            }
            Label L(string t, float size, Color c, bool bold = false) { var l = Ui.Label(t, size, c, bold); l.style.whiteSpace = WhiteSpace.NoWrap; l.pickingMode = PickingMode.Ignore; return l; }
            int MD = D.RULES.MONTH_DAYS;
            // 1줄: 어디 · 언제
            var top = Ui.Row(); top.style.alignItems = Align.FlexEnd; hudBar.Add(top);
            top.Add(L(S.rt ? G.clockNow() : D.SLOT_NAME[Math.Min(h.slot, D.SLOT_NAME.Count - 1)], 34, G.stockOpen() && S.rt ? StkUp : Ui.Text, true));
            var when = L($"  {h.month}개월 {h.day}일 · {D.SLOT_NAME[Math.Min(h.slot, D.SLOT_NAME.Count - 1)]}" + (S.rt && G.stockOpen() ? " · 장중" : ""), 19, Ui.Dim); when.style.marginBottom = 5; top.Add(when);
            var sp = new VisualElement(); sp.style.flexGrow = 1; top.Add(sp);
            var loc = L(Ui.Clean(LocTitle()), 19, Ui.Dim); loc.style.marginBottom = 5; top.Add(loc);
            // 시간 속도 (폰을 열어도 가리지 않게 상태 카드 안)
            if (S.rt)
            {
                var spd = Ui.Row(); spd.style.alignItems = Align.Center; spd.style.marginTop = 8; hudBar.Add(spd);
                bool flowing = PHONE_OK.Contains(S.pending?.t);
                spd.Add(L(!flowing ? "⏸ 고르는 중엔 멈춤" : rtSpeed == 0 ? "⏸ 멈춤" : "▶ 시간 흐름", 16, flowing && rtSpeed > 0 ? Ui.Good : Ui.Dim));
                var g0 = new VisualElement(); g0.style.flexGrow = 1; spd.Add(g0);
                foreach (var (v0, l) in new[] { (0, "Ⅱ"), (1, "1x"), (2, "2x"), (4, "4x") })
                {
                    int v = v0; var c = Ui.Chip(l, () => { rtSpeed = v; RenderHud(G.HudSnapOf()); }, false, rtSpeed == v ? Ui.Accent : new Color(1, 1, 1, 0.06f));
                    c.style.marginLeft = 4; c.style.marginRight = 0; c.style.paddingTop = 4; c.style.paddingBottom = 4; c.style.flexShrink = 0; c.Q<Label>().style.whiteSpace = WhiteSpace.NoWrap; spd.Add(c);
                }
            }
            // 2줄: 돈
            var money = Ui.Row(); money.style.marginTop = 8; hudBar.Add(money);
            VisualElement M(string k, string v, Color c) { var b = new VisualElement(); b.style.marginRight = 22; b.Add(L(k, 16, Ui.Dim)); b.Add(L(v, 24, c, true)); return b; }
            money.Add(M("빚", G.won(h.debt), Ui.Bad));
            money.Add(M("현금", G.won(h.cash), Ui.Good));
            money.Add(M("평가", G.won(h.hv), Ui.Text));
            hudBar.Add(L(h.paidMonth == h.month ? "이번 달 이자 냄" : $"이자 {(MD - h.day == 0 ? "D-DAY" : $"D-{MD - h.day}")} · {G.won(MathK.Round1k(h.debt * G.rate()))}", 19, h.paidMonth == h.month ? Ui.Good : Ui.Gold, true));
            // 3줄: 수치 막대 셋
            var bars = Ui.Row(); bars.style.marginTop = 10; hudBar.Add(bars);
            void Bar(string k, double v, Color c, string tail)
            {
                var b = new VisualElement(); b.style.flexGrow = 1; b.style.flexBasis = 0; b.style.marginRight = 12; b.style.overflow = Overflow.Hidden;   // 글자가 옆 막대로 넘어가지 않게
                b.Add(L($"{k} {v:0}{tail}", 16, Ui.Dim));
                var tr = Ui.Box(new Color(1, 1, 1, 0.12f), 0, 5); tr.style.height = 10; tr.style.marginTop = 4;
                var f = Ui.Box(c, 0, 5); f.style.height = Length.Percent(100); f.style.width = Length.Percent((float)Math.Max(0, Math.Min(100, v))); tr.Add(f);
                b.Add(tr); bars.Add(b);
            }
            Bar("체력", h.hp, h.hp < D.RULES.HP_LOW ? Ui.Bad : Ui.Good, h.faint ? " 기절" : "");
            string men = h.stress >= G.menLine() ? " 멘헤라" : h.stress >= 40 ? " 불안" : "";
            Bar("멘탈", h.stress, h.stress >= G.menLine() ? Ui.Bad : h.stress >= 40 ? Ui.Gold : new Color(0.55f, 0.75f, 1f), men);
            Bar("중독", h.addict, h.addict >= 60 ? Ui.Bad : h.addict >= 30 ? Ui.Gold : Ui.Dim, "");
            // 몸 상태 줄: 병·숙취·내일 아플 확률 (막대 글자에 붙이면 옆 막대를 가려서 따로 뺌)
            if (S.rt)
            {
                double sickPr = G.sickP();
                string body = G.sickName() != null ? $"{G.sickName()} 앓는 중 · {S.sickD}일 남음" : $"내일 아플 확률 {sickPr * 100:0}%";
                if (S.hang) body += " · 숙취";
                hudBar.Add(L(body, 16, G.sickName() != null || sickPr >= 0.2 ? Ui.Bad : Ui.Dim, G.sickName() != null));
            }
            // 4줄: 유품
            if (h.augs.Count > 0)
            {
                var icons = Ui.Row(); icons.style.marginTop = 10; icons.style.alignItems = Align.Center; hudBar.Add(icons);
                foreach (var id in h.augs.Take(9)) { var ic = Icon(ArtCatalog.Relic(id), 36); ic.style.marginRight = 4; ic.pickingMode = PickingMode.Position; ic.tooltip = D.AUGS.FirstOrDefault(a => a.id == id)?.name ?? id; icons.Add(ic); }
                if (h.augs.Count > 9) icons.Add(L($"+{h.augs.Count - 9}", 18, Ui.Gold, true));
            }
        }

        // ---------- 미니 시세창 (오른쪽 위) ----------
        void RenderMini()
        {
            mini.Clear();
            if (G == null || !S.rt || S.mk == null) return;
            Label L(string t, float size, Color c, bool bold = false) { var l = Ui.Label(t, size, c, bold); l.style.whiteSpace = WhiteSpace.NoWrap; l.pickingMode = PickingMode.Ignore; return l; }
            var head = Ui.Row(); head.style.alignItems = Align.Center; head.pickingMode = PickingMode.Ignore; mini.Add(head);
            head.Add(L("개미증권", 20, Ui.Text, true));
            var sp = new VisualElement(); sp.style.flexGrow = 1; head.Add(sp);
            head.Add(L(G.stockOpen() ? "● 장중" : "○ 장 마감 · 코인만", 16, G.stockOpen() ? StkUp : StkAxis));
            int unread = G.kUnread();
            // 보유 포지션
            int n = 0;
            foreach (var k in G.STK().Where(k => S.hold.Has(k)).ToList())
            {
                if (n++ >= 3) break;
                var x = S.hold[k]; double v = x.q * S.mk.tk[k].p - x.cost;
                var r = Ui.Row(); r.style.marginTop = 6; r.pickingMode = PickingMode.Ignore; mini.Add(r);
                r.Add(L(D.TK[k].name, 18, Ui.Text)); var s0 = new VisualElement(); s0.style.flexGrow = 1; r.Add(s0);
                r.Add(L($"{G.sgnWon(v)} ({GameSim.pct(v / Math.Max(1, x.cost))})", 18, UpDn(v), true));
            }
            foreach (var c in S.cps.ToList())
            {
                if (n++ >= 4) break;
                double pl = G.cpnl(c) + c.bonus, p = S.mk.tk[c.tk].p, liq = GameSim.liqPx(c), gap = Math.Abs(p / liq - 1);
                var r = Ui.Row(); r.style.marginTop = 6; r.pickingMode = PickingMode.Ignore; mini.Add(r);
                r.Add(L($"{D.TK[c.tk].name} {c.lev:0}x {(c.dir > 0 ? "롱" : "숏")}", 18, c.dir > 0 ? StkUp : StkDn)); var s0 = new VisualElement(); s0.style.flexGrow = 1; r.Add(s0);
                r.Add(L($"{G.sgnWon(pl)} ({GameSim.pct(pl / Math.Max(1, c.margin))})", 18, UpDn(pl), true));
                if (c.lev * c.mult > 1.2 && gap < 0.05) mini.Add(L($"   ⚠ 청산가까지 {gap * 100:0.0}%", 16, Ui.Bad, true));
            }
            // 보던 종목 미니 차트
            string tk = stkSel != null && S.mk.tk.Has(stkSel) ? stkSel : D.TKList.First(t => G.tkOpen(t.id)).id;
            var mk = S.mk.tk[tk]; double dr = G.dayR(tk);
            var pr = Ui.Row(); pr.style.marginTop = 10; pr.style.alignItems = Align.FlexEnd; pr.pickingMode = PickingMode.Ignore; mini.Add(pr);
            pr.Add(L(D.TK[tk].name, 18, StkAxis)); var s1 = new VisualElement(); s1.style.flexGrow = 1; pr.Add(s1);
            pr.Add(L(G.fmtP(mk.p), 24, UpDn(dr), true)); pr.Add(L(" " + GameSim.pct(dr), 18, UpDn(dr), true));
            var sl = new LineChart(mk.hist.Skip(Math.Max(0, mk.hist.Count - 24)).Select(c => c.c).Concat(new[] { mk.p }).ToList(), false, null);
            sl.style.height = 56; sl.style.marginTop = 4; mini.Add(sl);
            mini.Add(L(phoneOpen ? "폰 열림 · P 로 닫기" : $"눌러서 폰 열기 (P){(unread > 0 ? $" · 카톡 {unread}" : "")}", 15, Ui.Dim));
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
            SetIdle();
            stageTitle.text = Ui.Clean(LocTitle());
            if (P == null) { Title("…"); return; }
            switch (P.t)
            {
                case "start":
                    Title("롱잡고알바감");
                    Info("빚 3천만 원. 매달(7일) 이자 5%. 알바·주식·코인·도박… 갚을 방법은 많다.", 26, Ui.Text);
                    Btn("새 게임 시작", () => Send("start"), $"시드 {S.seed}", false, Ui.Accent);
                    Btn($"AI 뉴스·대사 (Claude): {(LlmSettings.On ? "켜짐" : "꺼짐")}", () => LlmToggle(!LlmSettings.On),
                        string.IsNullOrEmpty(LlmSettings.Url) ? "서버 URL 없음" : (LlmSettings.On ? "끄면 내장 문구만 씀" : "켜면 뉴스·대사를 AI 가 씀 (실패하면 내장 문구)"), string.IsNullOrEmpty(LlmSettings.Url));
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
                case "home":   // 집은 선택지 상자 없이 대사창 퀵메뉴로 (지도 · 쉬기 · 대출)
                    Title($"집 · {D.SLOT_NAME[S.slot]}");
                    break;
                case "map":
                    Title("어디 갈까?");
                    Btn("집으로", () => Send("goTo", "loc", "home"));
                    foreach (var L in D.LOCList.Where(L => !L.rt || S.rt))
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
                    Title(P.loc == "home" ? "빚 갚기 (김사장 계좌로 이체)" : "원금 상환");
                    Info($"빚 {G.won(S.debt)} · 현금 {G.won(S.cash)}" + (P.due > 0 ? $" · 이번 달 이자 {G.won(P.due)} 남겨 둘 것" : ""), 22, Ui.Text);
                    {
                        var seen = new HashSet<double>();
                        foreach (var (a, l) in new[] { (P.mx, P.mx >= S.debt ? "빚 전부 갚기" : "가진 돈 전부"), (Math.Max(0, Math.Floor((P.mx - P.due) / 10000) * 10000), "이자 몫은 남기고"), (Math.Floor(P.mx / 20000) * 10000, "절반"), (100000.0, "10만 원만") })
                        {
                            if (a < 10000 || a > P.mx || !seen.Add(a)) continue;
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
                case "event":
                    Title("돌발 상황 — 어떻게 할까?");
                    foreach (var o in P.opts) { var k = o.k; Btn(o.l, () => Send("evPick", "k", k), o.sub, o.dis); }
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
            NoShrink(panelBody);   // 스크롤 상자 안 버튼이 눌려 글자 겹치지 않게
        }

        static readonly Dictionary<string, string> MG_RULES = new Dictionary<string, string>
        {
            ["cafe"] = "주문표대로 음료를 담고 서빙. 손님은 주문을 잠깐만 보여 주고 폰 봄 → 까먹으면 R (주문당 1번, 인내심 깎임). '샷 추가' 주문엔 S. 손님 인내심 바닥나면 그냥 나감.\n1~5 음료 · 0 비우기 · S 샷 · Enter 서빙 · 손님 3명",
            ["store"] = "바늘이 초록 구간에 왔을 때 삑! 4개 찍기. 가운데 노란 칸이면 PERFECT. 찍을수록 바늘은 빨라지고 구간은 좁아지고 흔들림. 소주는 신분증(I) 먼저.\nSpace / 클릭 · I 신분증",
            ["ware"] = "연타로 박스 올리기. 무거운 박스는 3번 쳐야 올라감(+2). 중간에 깨지기 쉬움 박스가 오면 1초 동안 손 떼기 (치면 −3, 콤보 끊김). 허리는 소모품.\nSpace / 클릭 연타 · 6초",
            ["mart"] = "떨어지는 박스와 돌진하는 진상 카트 피하기. 위에 뜨는 경고 보고 미리 피하기, 아슬하게 피하면 콤보. 박카스 먹으면 목숨 +1. 9초 버티기, 맞을 때마다 일당 깎임.\n← → / A D / 화면 드래그 · 목숨 5개",
        };

        void RenderWork(Pending P)
        {
            var J = D.JOBS[P.key];
            Title(J.name);
            Info(MG_RULES.TryGetValue(P.key, out var rule) ? rule : "", 22, Ui.Text);
            if (P.setup == null)
            {
                Info($"일당 {G.man(G.jobPay(J, 0))}~{G.man(G.jobPay(J, 1))}원 · 체력 −{G.jobHp(J)} · 난이도 ×{G.mgHard():0.00}", 22, Ui.Gold);
                if (G.workMult() < 1) Info($"체력이 낮아 점수 ×{G.workMult():0.00}", 20, Ui.Bad);
                Btn("일 시작", () => Send("mgSetup"), "3·2·1 하고 바로 시작", false, Ui.Accent);
                return;
            }
            if (P.setup.hpm < 1) Info($"체력·멘탈 때문에 점수 ×{P.setup.hpm:0.00}", 20, Ui.Bad);
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
                    Btn("하이 (더 높다)", () => Send("bet", "stake", stake, "choice", 1), $"×{GameSim.hlMult(P.A, true, G.hlEdge()):0.00} · 맞힐 확률 {(13 - P.A) / 13.0 * 100:0}%", cant || GameSim.hlMult(P.A, true) == 0);
                    Btn("로우 (더 낮다)", () => Send("bet", "stake", stake, "choice", 0), $"×{GameSim.hlMult(P.A, false, G.hlEdge()):0.00} · 맞힐 확률 {(P.A - 1) / 13.0 * 100:0}%", cant || GameSim.hlMult(P.A, false) == 0);
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
            // 버튼을 먼저 (스코어보드가 길어 상자 아래로 잘리지 않게)
            if (P.cont) Btn("계속하기 (빚 없는 자유 모드)", () => Send("continue"), null, false, Ui.Accent);
            Btn("새 게임", () => NewGame(UnityEngine.Random.Range(1, 1000000)), null, false, P.cont ? (Color?)null : Ui.Accent);
            var sb = E.sb;
            Info("스코어보드", 26, Ui.Gold);
            void Row(string k, string v) { var r = Ui.Row(); r.style.justifyContent = Justify.SpaceBetween; r.style.marginBottom = 4; r.Add(Ui.Label(k, 22, Ui.Dim)); r.Add(Ui.Label(v, 22, Ui.Text, true)); panelBody.Add(r); }
            Row("버틴 날", $"{sb.days}일 ({sb.month}개월 {sb.day}일)");
            Row("남은 빚", G.won(sb.debt)); Row("갚은 빚", G.won(sb.repaid)); Row("낸 이자", G.won(sb.interest));
            Row("알바로 번 돈", G.won(sb.earned)); Row("투자 손익", G.sgnWon(sb.profit)); Row("도박 순손익", G.sgnWon(sb.gnet));
            Row("최대 자산", G.won(sb.maxAsset)); Row("도박 승/판", $"{sb.gW}/{sb.gN}"); Row("투자 승/매도", $"{sb.iW}/{sb.iN} · 청산 {sb.liq}");
            Row("갤 명성", $"{sb.fame} ({sb.rank})"); Row("중독도", $"{sb.addict}"); Row("기절 · 돌발 매수", $"{sb.faint} · {sb.impulse}");
        }
    }
}
