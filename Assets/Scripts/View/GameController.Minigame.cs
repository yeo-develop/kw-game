using System;
using System.Collections;
using System.Collections.Generic;
using KwGame.Sim;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    // 알바 미니게임 4종 (web/src/view/minigames.js 대응). 장면 위를 덮는 판에서 직접 플레이 → 0~1 점수를 mgResult 로 보낸다.
    // 규칙·점수 계산은 웹과 같고, 판 구성 난수(주문·구간·깨지기 쉬움 시점·떨어지는 물건)는 sim 의 mgSetup 이 이미 굴려 setup 에 들어 있다.
    // 그림은 Resources/Art/Icons/Minigame/<키>.png 가 있으면 쓰고, 없으면 색 도형 + 글자로 그린다.
    public partial class GameController
    {
        VisualElement mg, mgBoard, mgTimerFill, mgFlash;
        Label mgTimerLbl, mgPerfLbl, mgComboLbl;
        WorkSetup mgFor;
        string mgLastBubble;
        Coroutine mgCo;
        int mgComboShown, mgBestCombo;

        static readonly Color MgCard = new Color32(0x26, 0x22, 0x33, 0xf5);
        static readonly Color MgLine = new Color(1, 1, 1, 0.14f);
        static readonly string[] DRINK = { "아아", "라떼", "바닐라", "녹차", "딸바" };
        static readonly string[] DRINK_KEY = { "drink_ice", "drink_latte", "drink_vanilla", "drink_greentea", "drink_strawberry" };
        static readonly Color[] DRINK_C = { new Color32(0x4a, 0x2c, 0x1a, 0xff), new Color32(0xc8, 0x9a, 0x6c, 0xff), new Color32(0xf1, 0xdc, 0x8f, 0xff), new Color32(0x7f, 0xb0, 0x69, 0xff), new Color32(0xf2, 0x8a, 0xa0, 0xff) };
        static readonly string[] PRODUCT = { "item_ramen", "item_chips", "item_soju" };   // 2 = 소주 (신분증 확인 필요)
        static readonly string[] PRODUCT_NAME = { "컵라면", "감자칩", "소주" };
        static readonly Color[] PRODUCT_C = { new Color32(0xd9, 0x3a, 0x2f, 0xff), new Color32(0xf2, 0xb1, 0x34, 0xff), new Color32(0x3e, 0x9e, 0x5a, 0xff) };
        static readonly Color32 BoxC = new Color32(0xb8, 0x86, 0x4b, 0xff), HeavyC = new Color32(0x6b, 0x4a, 0x2a, 0xff);

        // ---------- 시작·정리 ----------

        /// RenderWork 에서 부름: setup 이 생겼으면 판을 띄우고 한 번만 돌린다
        void MinigameEnsure(Pending P)
        {
            if (mg != null && mgFor == P.setup) return;
            MinigameClose();
            mgFor = P.setup; mgLastBubble = null; mgComboShown = 0; mgBestCombo = 0;
            mg = Ui.Box(new Color(0.05f, 0.04f, 0.08f, 1)); Ui.Fill(mg);
            var bg = new VisualElement(); Ui.Fill(bg); bg.pickingMode = PickingMode.Ignore;
            var s = ArtCatalog.Background(D.JOBS[P.key].bg, false);
            if (s != null) { bg.style.backgroundImage = new StyleBackground(s); bg.style.backgroundSize = new BackgroundSize(BackgroundSizeType.Cover); }
            bg.style.unityBackgroundImageTintColor = new Color(0.45f, 0.42f, 0.5f, 1);
            mg.Add(bg);
            var shade = Ui.Box(new Color(0.04f, 0.03f, 0.07f, 0.55f)); Ui.Fill(shade); shade.pickingMode = PickingMode.Ignore; mg.Add(shade);

            // 위: 제목 + 타이머
            var head = Ui.Row(); Ui.Abs(head, 40, 28, 40); head.style.height = 64;
            var J = D.JOBS[P.key];
            var title = Ui.Label(J.name, 34, Ui.Text, true);
            title.style.backgroundColor = new Color(0, 0, 0, 0.55f); Ui.Radius(title, 12);
            title.style.paddingLeft = 18; title.style.paddingRight = 18; title.style.paddingTop = 8; title.style.paddingBottom = 8;
            head.Add(title);
            mgPerfLbl = HeadChip("성과 0%", Ui.Text); head.Add(mgPerfLbl);
            mgComboLbl = HeadChip("", Ui.Gold); mgComboLbl.style.display = DisplayStyle.None; head.Add(mgComboLbl);
            if (P.setup.hpm < 1) head.Add(HeadChip($"{(S.rt ? "컨디션" : "체력")} ×{P.setup.hpm:0.00}", Ui.Bad));
            var tb =Ui.Box(new Color(1, 1, 1, 0.12f), 0, 12); tb.style.flexGrow = 1; tb.style.height = 24; tb.style.marginLeft = 24; tb.style.overflow = Overflow.Hidden;
            mgTimerFill = Ui.Box(Ui.Good, 0, 12); mgTimerFill.style.height = Length.Percent(100); mgTimerFill.style.width = Length.Percent(100); tb.Add(mgTimerFill);
            head.Add(tb);
            mgTimerLbl = Ui.Label("", 26, Ui.Text, true); mgTimerLbl.style.width = 96; mgTimerLbl.style.unityTextAlign = TextAnchor.MiddleRight; head.Add(mgTimerLbl);
            mg.Add(head);

            mgBoard = new VisualElement(); Ui.Abs(mgBoard, 40, 112, 40, 32);
            mg.Add(mgBoard);
            mgFlash = new VisualElement(); Ui.Fill(mgFlash); mgFlash.pickingMode = PickingMode.Ignore; mgFlash.style.opacity = 0; mg.Add(mgFlash);

            stage.Insert(stage.IndexOf(dlg), mg);   // 대사창·토스트 아래 (미래 말풍선은 위로 보임)
            mgCo = StartCoroutine(MinigameRun(P.key, P.setup));
        }

        /// pending 이 이 판이 아니게 되면 걷기 (RenderAll 에서)
        void MinigameSync()
        {
            if (mg == null) return;
            var P = S?.pending;
            if (P == null || P.t != "work" || P.setup != mgFor) MinigameClose();
        }

        void MinigameClose()
        {
            if (mgCo != null) { StopCoroutine(mgCo); mgCo = null; }
            mg?.RemoveFromHierarchy();
            mg = null; mgFor = null;
        }

        IEnumerator MinigameRun(string key, WorkSetup su)
        {
            // 데모·스크린샷: 판만 그려 두고 점수는 바깥(DemoShots)이 보낸다
            double score = -1;
            Action<double> done = v => score = v;
            IEnumerator game = key == "cafe" ? MgCafe(su, done) : key == "store" ? MgStore(su, done) : key == "mart" ? MgMart(su, done) : MgWare(su, done);
            if (autoSkipDialog) { game.MoveNext(); yield break; }
            yield return Countdown();
            yield return game;
            yield return ResultCard(key, su, score);
            mgCo = null;
            Send("mgResult", "score", score);
        }

        // ---------- 공통 연출 ----------

        IEnumerator Countdown()
        {
            foreach (var t in new[] { "3", "2", "1", "시작!" })
            {
                var l = Ui.Label(t, t.Length > 1 ? 120 : 180, t.Length > 1 ? Ui.Gold : Ui.Text, true);
                Ui.Fill(l); l.style.unityTextAlign = TextAnchor.MiddleCenter; l.pickingMode = PickingMode.Ignore;
                l.style.unityTextOutlineColor = Color.black; l.style.unityTextOutlineWidth = 2;
                mg.Add(l);
                yield return Tween(0.42f, p => { l.style.scale = new Scale(Vector3.one * Mathf.Lerp(1.6f, 1f, EaseOut(p * 2.5f))); l.style.opacity = p < 0.75f ? 1 : 1 - (p - 0.75f) / 0.25f; });
                l.RemoveFromHierarchy();
            }
        }

        void Timer(float remain01, float secLeft)
        {
            mgTimerFill.style.width = Length.Percent(Mathf.Clamp01(remain01) * 100);
            mgTimerFill.style.backgroundColor = remain01 > 0.5f ? Ui.Good : remain01 > 0.25f ? Ui.Gold : Ui.Bad;
            mgTimerLbl.text = $"{Mathf.Max(0, secLeft):0.0}초";
        }

        IEnumerator ResultCard(string key, WorkSetup su, double score)
        {
            var J = D.JOBS[key];
            double pay = MathK.Round1k(J.@base + J.var * score * su.hpm);
            string g = score >= 0.95 ? "S" : score >= 0.75 ? "A" : score >= 0.5 ? "B" : score >= 0.3 ? "C" : "F";
            string cm = g == "S" ? "알바의 신. 근데 일당은 그대로임" : g == "A" ? "점장: 내일도 나와" : g == "B" ? "평범하게 착취당함" : g == "C" ? "점장 표정 안 좋음" : "잘리기 직전";
            Color gc = g == "S" || g == "A" ? Ui.Gold : g == "F" ? Ui.Bad : Ui.Text;

            var dim = Ui.Box(new Color(0, 0, 0, 0.6f)); Ui.Fill(dim); dim.style.alignItems = Align.Center; dim.style.justifyContent = Justify.Center;
            var card = Ui.Box(MgCard, 40, 24); card.style.width = 620; card.style.alignItems = Align.Center; Ui.Border(card, gc, 4);
            card.Add(Ui.Label("알바 끝", 30, Ui.Dim, true));
            var gl = Ui.Label(g, 200, gc, true); gl.style.unityTextAlign = TextAnchor.MiddleCenter; gl.style.marginTop = -10; gl.style.marginBottom = -10; card.Add(gl);
            card.Add(Ui.Label(cm, 28, Ui.Text, true));
            var sl = Ui.Label($"성과 {score * 100:0}%{(su.hpm < 1 ? $" × {(S.rt ? "컨디션" : "체력")} {su.hpm:0.00}" : "")}", 24, Ui.Dim); sl.style.marginTop = 16; card.Add(sl);
            if (mgBestCombo >= 2) { var bc = Ui.Label($"최고 콤보 {mgBestCombo}", 24, Ui.Gold, true); bc.style.marginTop = 4; card.Add(bc); }
            var pl = Ui.Label($"예상 일당 {G.won(pay)}", 40, Ui.Good, true); pl.style.marginTop = 8; card.Add(pl);
            var hint = Ui.Label("클릭 / Space", 20, Ui.Dim); hint.style.marginTop = 18; card.Add(hint);
            dim.Add(card); mg.Add(dim);
            SetFace(g == "S" || g == "A" ? "smug" : g == "F" ? "cry" : "tired");
            yield return Tween(0.35f, p => { card.style.scale = new Scale(Vector3.one * Mathf.Lerp(0.6f, 1f, EaseOut(p))); card.style.opacity = p; });
            float t = 0;
            while (t < 4f) { t += Time.unscaledDeltaTime; if (t > 0.8f && AnyPress()) break; yield return null; }   // 연타하던 손에 바로 넘어가지 않게
        }

        static bool AnyPress() => Input.GetMouseButtonDown(0) || Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return);
        static float EaseOut(float p) { p = Mathf.Clamp01(p); return 1 - (1 - p) * (1 - p) * (1 - p); }

        IEnumerator Tween(float dur, Action<float> f)
        {
            float t = 0;
            while (t < dur) { f(t / dur); t += Time.unscaledDeltaTime; yield return null; }
            f(1);
        }
        void Fx(IEnumerator e) { if (isActiveAndEnabled) StartCoroutine(e); }

        void Flash(Color c) { mgFlash.style.backgroundColor = c; Fx(Tween(0.3f, p => { if (mgFlash != null) mgFlash.style.opacity = (1 - p) * 0.35f; })); }
        void Shake(VisualElement v, float amp = 14) => Fx(Tween(0.3f, p => v.style.translate = new Translate(Mathf.Sin(p * 40) * amp * (1 - p), 0)));
        void Pop(VisualElement v) => Fx(Tween(0.18f, p => v.style.scale = new Scale(Vector3.one * Mathf.Lerp(1.18f, 1f, p))));

        /// 떠오르며 사라지는 글자 (+1, 삑! 등)
        void Float(VisualElement parent, string text, float x, float y, Color c, float size = 44)
        {
            var l = Ui.Label(text, size, c, true); Ui.Abs(l, x, y); l.pickingMode = PickingMode.Ignore;
            l.style.unityTextOutlineColor = Color.black; l.style.unityTextOutlineWidth = 1.5f;
            parent.Add(l);
            Fx(Tween(0.7f, p => { l.style.translate = new Translate(0, -70 * EaseOut(p)); l.style.opacity = 1 - p * p; if (p >= 1) l.RemoveFromHierarchy(); }));
        }

        /// 미래 말풍선. 같은 말을 연달아 쌓지 않음 (편의점에서 연속으로 틀리면 같은 대사가 줄줄이 뜸)
        void Bubble(string text, string face) { if (text == mgLastBubble) return; mgLastBubble = text; Toast("미래: " + text, "bubble"); SetFace(face); }

        /// 그림이 있으면 그림, 없으면 색 도형 + 이름
        VisualElement Icon(string key, Color fallback, string label, float size)
        {
            var v = new VisualElement(); v.style.width = size; v.style.height = size; v.pickingMode = PickingMode.Ignore;
            var s = ArtCatalog.Minigame(key);
            if (s != null) { v.style.backgroundImage = new StyleBackground(s); v.style.backgroundSize = new BackgroundSize(BackgroundSizeType.Contain); return v; }
            v.style.alignItems = Align.Center; v.style.justifyContent = Justify.Center;
            var body = Ui.Box(fallback, 0, size * 0.18f); body.style.width = size * 0.72f; body.style.height = size * 0.82f;
            Ui.Border(body, new Color(1, 1, 1, 0.35f), 3); body.style.alignItems = Align.Center; body.style.justifyContent = Justify.Center; body.pickingMode = PickingMode.Ignore;
            var shine = Ui.Box(new Color(1, 1, 1, 0.22f), 0, 6); Ui.Abs(shine, size * 0.08f, size * 0.08f); shine.style.width = size * 0.12f; shine.style.height = size * 0.4f; body.Add(shine);
            if (label != null)
            {
                var l = Ui.Label(label, Mathf.Max(16, size * (label.Length <= 2 ? 0.34f : 0.2f)), fallback.grayscale > 0.6f ? new Color(0.15f, 0.12f, 0.1f) : Color.white, true);
                l.style.unityTextAlign = TextAnchor.MiddleCenter; l.pickingMode = PickingMode.Ignore; body.Add(l);
            }
            v.Add(body);
            return v;
        }

        static Label HeadChip(string text, Color c)
        {
            var l = Ui.Label(text, 24, c, true); l.style.backgroundColor = new Color(0, 0, 0, 0.55f); Ui.Radius(l, 12);
            l.style.paddingLeft = 14; l.style.paddingRight = 14; l.style.paddingTop = 8; l.style.paddingBottom = 8; l.style.marginLeft = 12;
            l.pickingMode = PickingMode.Ignore;
            return l;
        }

        /// 머리띠의 성과 % · 콤보
        void MgHud(int combo, double perf)
        {
            if (mgPerfLbl != null) mgPerfLbl.text = $"성과 {Math.Max(0, Math.Min(1, perf)) * 100:0}%";
            mgBestCombo = Math.Max(mgBestCombo, combo);
            if (mgComboLbl == null) return;
            mgComboLbl.text = $"{combo} COMBO";
            mgComboLbl.style.display = combo >= 2 ? DisplayStyle.Flex : DisplayStyle.None;
            if (combo >= 2 && combo != mgComboShown) Pop(mgComboLbl);
            mgComboShown = combo;
        }

        /// 화면 가운데 판정 글자 (PERFECT · COMBO 등)
        void Judge(string text, Color c, float size = 76)
        {
            if (mg == null) return;
            var l = Ui.Label(text, size, c, true); Ui.Abs(l, 0, 150, 0); l.style.unityTextAlign = TextAnchor.MiddleCenter; l.pickingMode = PickingMode.Ignore;
            l.style.unityTextOutlineColor = Color.black; l.style.unityTextOutlineWidth = 2;
            mg.Add(l);
            Fx(Tween(0.6f, p =>
            {
                l.style.scale = new Scale(Vector3.one * Mathf.Lerp(1.5f, 1f, EaseOut(p * 3)));
                l.style.opacity = p < 0.6f ? 1 : 1 - (p - 0.6f) / 0.4f;
                l.style.translate = new Translate(0, -30 * p);
                if (p >= 1) l.RemoveFromHierarchy();
            }));
        }

        /// 판 전체가 한 번 쿵
        void Punch(float s = 1.035f) { var b = mgBoard; if (b != null) Fx(Tween(0.16f, p => b.style.scale = new Scale(Vector3.one * Mathf.Lerp(s, 1, EaseOut(p))))); }

        /// setup 에 없는 화면용 변주(손님·상품·박스 종류·박카스)는 setup 값으로 씨앗을 만든 난수로 → 같은 판이면 같은 변주
        static System.Random MgRng(WorkSetup su)
        {
            long h = 1469598103934665603;
            void Mix(double v) { h = (h ^ BitConverter.DoubleToInt64Bits(v)) * 1099511628211; }
            Mix(su.H); Mix(su.w); Mix(su.hp);
            if (su.u != null) foreach (var v in su.u) Mix(v);
            if (su.orders != null) foreach (var o in su.orders) foreach (var c in o) Mix(c);
            if (su.drops != null) foreach (var d in su.drops) foreach (var v in d) Mix(v);
            return new System.Random((int)(h ^ (h >> 32)));
        }

        static Label KeyCap(string k)
        {
            var l = Ui.Label(k, 18, Ui.Text, true); l.style.backgroundColor = new Color(0, 0, 0, 0.55f); Ui.Radius(l, 6);
            l.style.paddingLeft = 8; l.style.paddingRight = 8; l.style.paddingTop = 2; l.style.paddingBottom = 2; l.pickingMode = PickingMode.Ignore;
            return l;
        }

        Button BigBtn(string text, string key, Action a, Color bg, float w, float h, float size = 30)
        {
            var b = new Button(() => ExecuteButtonAction(a)) { text = "", focusable = false };   // 포커스 받으면 Space/Enter 가 버튼도 눌러서 두 번 먹음
            b.style.width = w; b.style.height = h; b.style.backgroundColor = bg; Ui.Radius(b, 18); Ui.Border(b, new Color(1, 1, 1, 0.25f), 2);
            b.style.alignItems = Align.Center; b.style.justifyContent = Justify.Center; b.style.marginLeft = 8; b.style.marginRight = 8;
            var l = Ui.Label(text, size, Color.white, true); l.pickingMode = PickingMode.Ignore; l.style.unityTextAlign = TextAnchor.MiddleCenter; b.Add(l);
            if (key != null) { var k = KeyCap(key); Ui.Abs(k, null, 8, 10); b.Add(k); }
            b.RegisterCallback<PointerEnterEvent>(_ => b.style.backgroundColor = Color.Lerp(bg, Color.white, 0.15f));
            b.RegisterCallback<PointerLeaveEvent>(_ => b.style.backgroundColor = bg);
            return b;
        }

        static void ExecuteButtonAction(Action action)
        {
            KwGame.Audio.GameAudioManager.Play(KwGame.Audio.SoundCue.ButtonClick);
            action();
        }

        // ---------- ☕ 카페: 주문 맞추기 ----------
        // 손님 3명이 줄 섬. 지금 손님 인내심이 다 닳으면 나감(실패). 주문표는 잠깐만 보이고, 보이는 동안엔 쟁반이 맞는지 ✓ 로 체크됨.
        // 가끔 "샷 추가" 주문 → 샷 버튼(S) 켜고 서빙해야 정답.
        IEnumerator MgCafe(WorkSetup su, Action<double> done)
        {
            const int NO = 3;
            float SEC = 12f / (float)su.H, PEEK = 3.5f / (float)su.H, PATIENCE = SEC * 0.5f;
            var orders = su.orders; var rng = MgRng(su);
            int shotOrder = rng.NextDouble() < 0.6 ? rng.Next(NO) : -1;
            string[] CUST = { "넥타이 아저씨", "과제하는 대학생", "폰만 보는 손님", "등산복 사장님", "카공족", "헬스 끝난 형" };
            Color[] CUST_C = { new Color32(0x5a, 0x6b, 0x8c, 0xff), new Color32(0x8c, 0x6b, 0x5a, 0xff), new Color32(0x6b, 0x8c, 0x5a, 0xff), new Color32(0x8c, 0x5a, 0x7a, 0xff), new Color32(0x7a, 0x7a, 0x5a, 0xff), new Color32(0x5a, 0x8c, 0x8c, 0xff) };
            var cust = new int[NO]; for (int i = 0; i < NO; i++) cust[i] = rng.Next(CUST.Length);
            int oi = 0, ok = 0, combo = 0, pourIdx = -1; var tray = new int[5]; bool hidden = false, reUsed = false, shot = false; float peekLeft = PEEK, patience = PATIENCE;
            var ink = new Color(0.2f, 0.16f, 0.12f);

            var top = Ui.Row(); top.style.alignItems = Align.Stretch; top.style.height = 360; mgBoard.Add(top);
            // 손님 줄
            var queue = new VisualElement(); queue.style.width = 220; queue.style.marginRight = 20; top.Add(queue);
            var custBox = new VisualElement[NO]; var custFill = new VisualElement[NO]; var custMood = new Label[NO];
            for (int i = 0; i < NO; i++)
            {
                var cb = Ui.Box(MgCard, 12, 14); cb.style.height = 110; cb.style.marginBottom = 10; Ui.Border(cb, MgLine, 2);
                var r = Ui.Row(); cb.Add(r);
                var face = Ui.Box(CUST_C[cust[i]], 0, 22); face.style.width = 44; face.style.height = 44; face.style.marginRight = 10; Ui.Border(face, new Color(1, 1, 1, 0.3f), 2); r.Add(face);
                var nm = new VisualElement(); nm.style.flexShrink = 1; r.Add(nm);
                nm.Add(Ui.Label(CUST[cust[i]], 18, Ui.Text, true));
                var md = Ui.Label("줄 서는 중", 17, Ui.Dim); nm.Add(md); custMood[i] = md;
                var pb = Ui.Box(new Color(1, 1, 1, 0.12f), 0, 5); pb.style.height = 10; pb.style.marginTop = 10; pb.style.overflow = Overflow.Hidden; cb.Add(pb);
                var pf = Ui.Box(Ui.Good, 0, 5); pf.style.height = Length.Percent(100); pf.style.width = Length.Percent(100); pb.Add(pf);
                custBox[i] = cb; custFill[i] = pf; queue.Add(cb);
            }
            // 주문표
            var ticket = Ui.Box(new Color32(0xfb, 0xf6, 0xe9, 0xff), 24, 18); ticket.style.width = 470; ticket.style.marginRight = 20;
            ticket.style.rotate = new Rotate(new Angle(-1.5f));
            var tHead = Ui.Row(); tHead.style.justifyContent = Justify.SpaceBetween; ticket.Add(tHead);
            var tNo = Ui.Label("", 28, new Color(0.3f, 0.25f, 0.2f), true); tHead.Add(tNo);
            var tDots = Ui.Label("", 28, new Color(0.3f, 0.25f, 0.2f), true); tHead.Add(tDots);
            var tLine = Ui.Box(new Color(0, 0, 0, 0.15f)); tLine.style.height = 2; tLine.style.marginTop = 10; tLine.style.marginBottom = 12; ticket.Add(tLine);
            var tBody = new VisualElement(); tBody.style.flexGrow = 1; ticket.Add(tBody);
            var stamp = Ui.Label("", 80, Ui.Bad, true); Ui.Abs(stamp, null, 150, 30); stamp.style.rotate = new Rotate(new Angle(-14)); stamp.style.opacity = 0; stamp.pickingMode = PickingMode.Ignore; ticket.Add(stamp);
            top.Add(ticket);
            // 쟁반
            var trayBox = Ui.Box(MgCard, 20, 18); trayBox.style.flexGrow = 1; Ui.Border(trayBox, MgLine, 2);
            trayBox.Add(Ui.Label("내 쟁반", 24, Ui.Dim, true));
            var trayRow = Ui.Row(); trayRow.style.flexWrap = Wrap.Wrap; trayRow.style.marginTop = 12; trayRow.style.flexGrow = 1; trayRow.style.alignItems = Align.FlexStart; trayBox.Add(trayRow);
            var msg = Ui.Label("", 24, Ui.Gold, true); trayBox.Add(msg);
            top.Add(trayBox);

            // 음료 버튼
            var drinks = Ui.Row(); drinks.style.justifyContent = Justify.Center; drinks.style.marginTop = 26; mgBoard.Add(drinks);
            var dBtns = new Button[5]; Button againBtn = null, shotBtn = null;
            for (int i = 0; i < 5; i++)
            {
                int k = i;
                var b = new Button(() => ExecuteButtonAction(() => Add(k))) { text = "", focusable = false };
                b.style.width = 200; b.style.height = 230; b.style.backgroundColor = MgCard; Ui.Radius(b, 18); Ui.Border(b, MgLine, 2);
                b.style.alignItems = Align.Center; b.style.justifyContent = Justify.Center; b.style.marginLeft = 8; b.style.marginRight = 8;
                b.Add(Icon(DRINK_KEY[i], DRINK_C[i], null, 130));
                var nl = Ui.Label(DRINK[i], 28, Ui.Text, true); nl.pickingMode = PickingMode.Ignore; nl.style.marginTop = 6; b.Add(nl);
                var kc = KeyCap((i + 1).ToString()); Ui.Abs(kc, 10, 10); b.Add(kc);
                b.RegisterCallback<PointerEnterEvent>(_ => b.style.backgroundColor = Color.Lerp(MgCard, DRINK_C[k], 0.35f));
                b.RegisterCallback<PointerLeaveEvent>(_ => b.style.backgroundColor = MgCard);
                dBtns[i] = b; drinks.Add(b);
            }
            var acts = Ui.Row(); acts.style.justifyContent = Justify.Center; acts.style.marginTop = 20; mgBoard.Add(acts);
            acts.Add(BigBtn("비우기", "0", () => Clear(), new Color32(0x44, 0x40, 0x55, 0xff), 190, 84, 26));
            shotBtn = BigBtn("샷 추가", "S", () => ToggleShot(), new Color32(0x4a, 0x2c, 0x1a, 0xff), 200, 84, 26); acts.Add(shotBtn);
            againBtn = BigBtn("다시 말해 주세요", "R", () => Again(), new Color32(0x55, 0x48, 0x2a, 0xff), 290, 84, 24); acts.Add(againBtn);
            acts.Add(BigBtn("서빙!", "Enter", () => Serve(), Ui.Accent, 270, 84, 34));

            void Show()
            {
                var o = oi < NO ? orders[oi] : null;
                tNo.text = o == null ? "끝!" : $"주문 #{oi + 1}";
                tDots.text = new string('●', ok) + new string('○', Math.Max(0, oi - ok)) + new string('·', Math.Max(0, NO - oi));
                tBody.Clear();
                if (o != null && hidden)
                {
                    var h = Ui.Label("(손님 이미 폰 보는 중…)\n뭐였더라", 34, new Color(0.45f, 0.4f, 0.35f), true); h.style.marginTop = 30; h.style.unityTextAlign = TextAnchor.MiddleCenter; tBody.Add(h);
                }
                else if (o != null)
                {
                    var row = Ui.Row(); row.style.flexWrap = Wrap.Wrap; tBody.Add(row);
                    bool extra = false;
                    for (int i = 0; i < 5; i++)
                    {
                        if (o[i] == 0) { if (tray[i] > 0) extra = true; continue; }
                        var it = Ui.Row(); it.style.marginRight = 14; it.style.marginBottom = 6;
                        it.Add(Icon(DRINK_KEY[i], DRINK_C[i], null, 72));
                        it.Add(Ui.Label($"{DRINK[i]}\n× {o[i]}", 26, ink, true));
                        if (tray[i] > 0)
                        {
                            bool eq = tray[i] == o[i];
                            var ck = Ui.Label(eq ? "✓" : tray[i] > o[i] ? "✗" : $"{tray[i]}/{o[i]}", eq || tray[i] > o[i] ? 38 : 22, eq ? (Color)new Color32(0x2e, 0x9e, 0x55, 0xff) : tray[i] > o[i] ? Ui.Bad : (Color)ink, true);
                            ck.style.marginLeft = 6; it.Add(ck);
                        }
                        row.Add(it);
                    }
                    if (oi == shotOrder) { var sl = Ui.Label("+ 샷 추가!! (진하게)", 26, Ui.Bad, true); sl.style.marginTop = 2; tBody.Add(sl); }
                    if (extra) { var xl = Ui.Label("✗ 주문에 없는 거 들어감", 22, Ui.Bad, true); tBody.Add(xl); }
                    var pk = Ui.Box(new Color(0, 0, 0, 0.12f), 0, 4); pk.style.height = 8; pk.style.marginTop = 8; tBody.Add(pk);
                    var pf = Ui.Box(Ui.Accent, 0, 4); pf.style.height = Length.Percent(100); pf.name = "peekFill"; pk.Add(pf);
                }
                trayRow.Clear();
                int n = 0; VisualElement poured = null;
                for (int i = 0; i < 5; i++) for (int j = 0; j < tray[i]; j++)
                {
                    var ic = Icon(DRINK_KEY[i], DRINK_C[i], null, 64); trayRow.Add(ic); n++;
                    if (i == pourIdx && j == tray[i] - 1) poured = ic;
                }
                if (shot) { var sb = Ui.Label("샷+", 24, Color.white, true); sb.style.backgroundColor = (Color)new Color32(0x4a, 0x2c, 0x1a, 0xff); Ui.Radius(sb, 10); Ui.Pad(sb, 8); sb.style.alignSelf = Align.Center; trayRow.Add(sb); }
                if (n == 0 && !shot) trayRow.Add(Ui.Label("(빈 쟁반)", 26, Ui.Dim));
                if (poured != null) { var e = poured; Fx(Tween(0.22f, p => { e.style.translate = new Translate(0, Mathf.Lerp(-90, 0, EaseOut(p))); e.style.opacity = Mathf.Min(1, p * 2.5f); })); }
                pourIdx = -1;
                againBtn.SetEnabled(o != null && !reUsed && hidden);
                againBtn.style.opacity = o != null && !reUsed && hidden ? 1 : 0.4f;
                shotBtn.style.backgroundColor = shot ? (Color)new Color32(0xc0, 0x6a, 0x2a, 0xff) : (Color)new Color32(0x4a, 0x2c, 0x1a, 0xff);
                for (int c = 0; c < NO; c++)
                {
                    custBox[c].style.display = c < oi ? DisplayStyle.None : DisplayStyle.Flex;
                    Ui.Border(custBox[c], c == oi ? Ui.Accent : MgLine, c == oi ? 3 : 2);
                }
            }
            void Add(int i) { if (oi >= NO) return; tray[i]++; pourIdx = i; Show(); Pop(dBtns[i]); }
            void Clear() { tray = new int[5]; shot = false; Show(); }
            void ToggleShot() { if (oi >= NO) return; shot = !shot; Show(); Pop(shotBtn); }
            void Again()
            {
                if (oi >= NO || reUsed || !hidden) return;
                reUsed = true; hidden = false; peekLeft = 1.5f; patience -= PATIENCE * 0.15f; msg.text = "손님: (한숨) …다시 말씀드릴게요";
                Bubble("아 죄송함다 ㅎ 귀가 빚 때문에 막힘", "tired"); Show();
            }
            void Finish(bool right, string stampText, string line)
            {
                msg.text = line;
                stamp.text = stampText; stamp.style.color = right ? Ui.Good : Ui.Bad; Ui.Border(stamp, right ? Ui.Good : Ui.Bad, 5);
                stamp.style.paddingLeft = 14; stamp.style.paddingRight = 14; Ui.Radius(stamp, 12);
                Fx(Tween(0.6f, p => { stamp.style.opacity = p < 0.7f ? 1 : (1 - p) / 0.3f; stamp.style.scale = new Scale(Vector3.one * Mathf.Lerp(1.8f, 1f, EaseOut(p * 3))); }));
                if (right)
                {
                    ok++; combo++; Flash(Ui.Good); Float(trayBox, "+1", 40, 120, Ui.Good, 60); Punch();
                    bool fast = patience > PATIENCE * 0.55f;
                    Judge(combo >= 2 ? $"{(fast ? "PERFECT" : "GOOD")}  {combo} COMBO" : fast ? "PERFECT" : "GOOD", fast ? Ui.Gold : Ui.Good);
                }
                else { combo = 0; Flash(Ui.Bad); Shake(ticket); Judge("MISS", Ui.Bad, 64); }
                MgHud(combo, (double)ok / NO);
                if (oi < NO) custMood[oi].text = right ? "만족" : "불만";
                oi++; tray = new int[5]; shot = false; reUsed = false; hidden = false; peekLeft = PEEK; patience = PATIENCE; Show();
            }
            void Serve()
            {
                if (oi >= NO) return;
                bool match = true; for (int i = 0; i < 5; i++) if (tray[i] != orders[oi][i]) match = false;
                bool shotOk = shot == (oi == shotOrder), right = match && shotOk;
                Bubble(right ? "오 맞았다. 근데 팁은 없음 ㅅㅂ" : "아 몰라 다 아아로 통일해", right ? "smug" : "angry");
                Finish(right, right ? "완료" : "땡", right ? "손님: 감사합니다~" : match ? (shot ? "손님: 샷 추가 안 했는데요? 잠 못 자요" : "손님: 샷 추가 했다고요;;") : "손님: 이거 제가 시킨 거 아닌데요?");
            }
            void Leave()
            {
                Bubble("손님 나감 ㅋㅋ 오히려 좋아", "smug");
                Finish(false, "이탈", "손님: 됐어요 딴 데 갈게요 (별점 1개)");
            }

            Show(); MgHud(0, 0);
            float t = 0;
            while (t < SEC && oi < NO)
            {
                float dt = Time.unscaledDeltaTime; t += dt;
                Timer(1 - t / SEC, SEC - t);
                if (!hidden) { peekLeft -= dt; var pf = tBody.Q("peekFill"); if (pf != null) pf.style.width = Length.Percent(Mathf.Clamp01(peekLeft / PEEK) * 100); if (peekLeft <= 0) { hidden = true; Show(); } }
                patience -= dt;
                float pr = Mathf.Clamp01(patience / PATIENCE);
                custFill[oi].style.width = Length.Percent(pr * 100);
                custFill[oi].style.backgroundColor = pr > 0.5f ? Ui.Good : pr > 0.25f ? Ui.Gold : Ui.Bad;
                custMood[oi].text = pr > 0.5f ? "기다리는 중" : pr > 0.25f ? "(발 동동)" : "(한숨 푹푹)";
                custMood[oi].style.color = pr > 0.25f ? Ui.Dim : Ui.Bad;
                if (pr < 0.25f) custBox[oi].style.translate = new Translate(Mathf.Sin(t * 50) * 3, 0);
                if (patience <= 0) { custBox[oi].style.translate = new Translate(0, 0); Leave(); }
                if (oi < NO)
                {
                    for (int i = 0; i < 5; i++) if (Input.GetKeyDown(KeyCode.Alpha1 + i) || Input.GetKeyDown(KeyCode.Keypad1 + i)) ExecuteButtonAction(() => Add(i));
                    if (Input.GetKeyDown(KeyCode.Alpha0) || Input.GetKeyDown(KeyCode.Keypad0)) ExecuteButtonAction(Clear);
                    if (Input.GetKeyDown(KeyCode.S)) ExecuteButtonAction(ToggleShot);
                    if (Input.GetKeyDown(KeyCode.R) && againBtn.enabledInHierarchy) ExecuteButtonAction(Again);
                    if (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.Space)) ExecuteButtonAction(Serve);
                }
                yield return null;
            }
            Timer(Mathf.Max(0, 1 - t / SEC), SEC - t);
            yield return new WaitForSecondsRealtime(0.4f);
            done((double)ok / NO);
        }

        // ---------- 🏪 편의점: 바코드 타이밍 ----------
        // 초록 구간 가운데(노란 띠)에서 찍으면 PERFECT. 소주는 신분증(I) 먼저 확인해야 함. 2개 맞히면 구간이 흔들리기 시작.
        IEnumerator MgStore(WorkSetup su, Action<double> done)
        {
            float H = (float)su.H; const int NB = 4; float SEC = 10f / H;
            var rng = MgRng(su);
            var seq = new int[NB]; for (int i = 0; i < NB; i++) seq[i] = rng.Next(2);
            seq[1 + rng.Next(NB - 1)] = 2;
            if (rng.NextDouble() < 0.35) seq[1 + rng.Next(NB - 1)] = 2;
            int zi = 0, hits = 0, tries = 0, combo = 0; float pos = 0, dir = 1, speed = 85 * H; bool idOk = false;
            const float BW = 1000;

            // 계산대: 상품 카드
            var counter = Ui.Box(MgCard, 24, 24); counter.style.height = 340; counter.style.alignItems = Align.Center; counter.style.justifyContent = Justify.Center; Ui.Border(counter, MgLine, 2);
            counter.style.overflow = Overflow.Hidden; mgBoard.Add(counter);
            var belt = Ui.Box(new Color(0.1f, 0.1f, 0.12f, 1)); Ui.Abs(belt, 0, null, 0, 0); belt.style.height = 70; counter.Add(belt);
            for (int i = 0; i < 24; i++) { var s = Ui.Box(new Color(1, 1, 1, 0.07f)); Ui.Abs(s, i * 70, 0); s.style.width = 30; s.style.height = 70; belt.Add(s); }
            var prod = new VisualElement(); prod.style.alignItems = Align.Center; counter.Add(prod);
            var prodName = Ui.Label("", 28, Ui.Text, true);
            var idBadge = Ui.Label("", 24, Color.white, true); Ui.Abs(idBadge, 24, 24); Ui.Radius(idBadge, 10); Ui.Pad(idBadge, 10); counter.Add(idBadge);
            var queueLbl = Ui.Label("", 22, Ui.Dim, true); Ui.Abs(queueLbl, null, 24, 24); counter.Add(queueLbl);
            void NewProduct(int i)
            {
                int k = seq[Mathf.Min(i, NB - 1)];
                prod.Clear();
                prod.Add(Icon(PRODUCT[k], PRODUCT_C[k], null, 210));
                var bc = Ui.Row(); bc.style.height = 34; bc.style.marginTop = -36; bc.style.backgroundColor = Color.white; bc.style.paddingLeft = 6; bc.style.paddingRight = 6; Ui.Radius(bc, 4);
                for (int j = 0; j < 18; j++) { var bar = Ui.Box(Color.black); bar.style.width = (j * 7 + i) % 3 + 1; bar.style.height = 26; bar.style.marginRight = 2; bc.Add(bar); }
                prod.Add(bc);
                prodName.text = PRODUCT_NAME[k]; prod.Add(prodName);
                idOk = false;
                idBadge.text = "19  성인 인증 필요 (I)"; idBadge.style.backgroundColor = Ui.Bad; idBadge.style.display = k == 2 ? DisplayStyle.Flex : DisplayStyle.None;
                queueLbl.text = $"줄 선 손님 {NB - i}명";
                Fx(Tween(0.25f, p => prod.style.translate = new Translate(Mathf.Lerp(-500, 0, EaseOut(p)), 0)));
            }
            NewProduct(0);

            // 스캐너 막대
            var meter = Ui.Box(new Color(0, 0, 0, 0.55f), 0, 18); meter.style.width = BW; meter.style.height = 90; meter.style.alignSelf = Align.Center; meter.style.marginTop = 30; Ui.Border(meter, MgLine, 3);
            mgBoard.Add(meter);
            var zone = Ui.Box(new Color32(0x3e, 0xd6, 0x7a, 0xd0), 0, 10); zone.style.position = Position.Absolute; zone.style.top = 6; zone.style.bottom = 6; meter.Add(zone);
            var core = Ui.Box(new Color(1, 0.95f, 0.5f, 0.7f), 0, 6); core.style.position = Position.Absolute; core.style.top = 0; core.style.bottom = 0;
            core.style.left = Length.Percent(33.3f); core.style.width = Length.Percent(33.4f); core.pickingMode = PickingMode.Ignore; zone.Add(core);
            var needle = Ui.Box(Color.white, 0, 4); needle.style.position = Position.Absolute; needle.style.top = -14; needle.style.bottom = -14; needle.style.width = 10; meter.Add(needle);
            var needleGlow = Ui.Box(new Color(1, 0.3f, 0.3f, 0.9f), 0, 3); Ui.Fill(needleGlow); Ui.Margin(needleGlow, 2); needle.Add(needleGlow);
            float zoneX = 0, zoneW = 0, zx0 = 0, zx1 = 0;
            void PlaceZone(float drift)
            {
                zx0 = Mathf.Clamp(zoneX + drift, 2, 98 - zoneW); zx1 = zx0 + zoneW;
                zone.style.left = Length.Percent(zx0); zone.style.width = Length.Percent(zoneW);
            }
            void Zone()
            {
                zoneW = Mathf.Max(8, 15 - hits * 1.5f) / H; zoneX = 8 + (float)su.u[Mathf.Min(zi++, su.u.Length - 1)] * (100 - zoneW - 16);
                PlaceZone(0);
            }
            Zone();

            Label msg = null; bool fin = false;
            var bottom = Ui.Row(); bottom.style.justifyContent = Justify.Center; bottom.style.marginTop = 28; mgBoard.Add(bottom);
            var marks = Ui.Row(); marks.style.marginRight = 30; bottom.Add(marks);
            var markLbl = new Label[NB];
            for (int i = 0; i < NB; i++)
            {
                var m = Ui.Label("?", 36, Ui.Dim, true); m.style.width = 66; m.style.height = 66; m.style.unityTextAlign = TextAnchor.MiddleCenter;
                m.style.backgroundColor = new Color(1, 1, 1, 0.08f); Ui.Radius(m, 33); m.style.marginRight = 10; markLbl[i] = m; marks.Add(m);
            }
            var idBtn = BigBtn("신분증 확인", "I", () => CheckId(), new Color32(0x44, 0x40, 0x55, 0xff), 260, 110, 28); bottom.Add(idBtn);
            var scanBtn = BigBtn("삑!", "Space", () => Scan(), Ui.Accent, 330, 110, 48); bottom.Add(scanBtn);
            msg = Ui.Label("", 28, Ui.Gold, true); msg.style.alignSelf = Align.Center; msg.style.marginTop = 16; mgBoard.Add(msg);

            void Beep(Color c) => Fx(Tween(0.3f, p => Ui.Border(meter, Color.Lerp(c, MgLine, p), 3 + 5 * (1 - p))));
            void CheckId()
            {
                if (fin || tries >= NB) return;
                if (seq[tries] == 2)
                {
                    if (idOk) return;
                    idOk = true; idBadge.text = "인증 완료 ✓"; idBadge.style.backgroundColor = Ui.Good; Pop(idBadge);
                    msg.text = "손님: (민증 꺼냄) 97년생인데요";
                }
                else { msg.text = "손님: 저 마흔둘인데요;; (시간 낭비)"; Bubble("컵라면 사는데 민증 검사 ㅋㅋ", "smug"); }
            }
            void Scan()
            {
                if (fin || tries >= NB) return;
                bool under = seq[tries] == 2 && !idOk;
                bool ok = !under && pos >= zx0 && pos <= zx1;
                bool perfect = ok && Mathf.Abs(pos - (zx0 + zx1) / 2) <= zoneW / 6;
                if (ok) { hits++; combo++; } else combo = 0;
                var m = markLbl[tries]; m.text = perfect ? "★" : ok ? "O" : "X"; m.style.color = Color.white; m.style.backgroundColor = perfect ? Ui.Gold : ok ? Ui.Good : Ui.Bad; Pop(m);
                tries++;
                msg.text = under ? "민증 확인 안 함! 점장: \"너 영업정지 먹고 싶냐\"" : perfect ? "삑!! (완벽한 손목 스냅)" : ok ? "삑! (정상 결제)" : "삐빅— 다시 찍어 주세요 (점장 째려봄)";
                if (ok)
                {
                    Flash(Ui.Good); Beep(perfect ? Ui.Gold : Ui.Good);
                    Float(meter, perfect ? "PERFECT" : "GOOD", BW * pos / 100 - 60, -70, perfect ? Ui.Gold : Ui.Good);
                    if (perfect) { Punch(); Judge(combo >= 2 ? $"PERFECT  {combo} COMBO" : "PERFECT", Ui.Gold); }
                    else if (combo >= 2) Judge($"{combo} COMBO", Ui.Good, 60);
                    if (hits == 2) msg.text += "  — 이제 구간이 움직임";
                }
                else
                {
                    Flash(Ui.Bad); Shake(meter); Beep(Ui.Bad); Judge(under ? "미성년자 판매?!" : "MISS", Ui.Bad, 64);
                    Bubble(under ? "미성년자한테 소주 팔면 우리 빚 2배임" : "바코드도 나 싫어함 ㅋ", under ? "panic" : "tired");
                }
                MgHud(combo, (double)hits / NB);
                speed += 30 * H; Zone();
                if (tries < NB) NewProduct(tries);
            }

            MgHud(0, 0);
            float t = 0;
            while (t < SEC && tries < NB)
            {
                float dt = Time.unscaledDeltaTime; t += dt;
                pos += dir * speed * dt; if (pos > 100) { pos = 100; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
                needle.style.left = BW * pos / 100 - 5;
                PlaceZone(hits >= 2 ? Mathf.Sin(t * 2.2f) * 7 : 0);
                for (int i = 0; i < belt.childCount; i++) belt[i].style.translate = new Translate(-(t * 120 % 70), 0);
                if (idBadge.style.display == DisplayStyle.Flex && !idOk) idBadge.style.opacity = 0.55f + 0.45f * Mathf.PingPong(t * 3, 1);
                else idBadge.style.opacity = 1;
                Timer(1 - t / SEC, SEC - t);
                if (Input.GetKeyDown(KeyCode.I)) ExecuteButtonAction(CheckId);
                if (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return)) ExecuteButtonAction(Scan);
                yield return null;
            }
            fin = true;
            yield return new WaitForSecondsRealtime(0.35f);
            done((double)hits / NB);
        }

        // ---------- 📦 상하차: 연타 ----------
        // 일반 박스 1번에 1개, 무거운 박스는 3번 눌러야 +2. 다음 박스 3개가 미리 보임. 깨지기 쉬움 구간엔 누르면 −3.
        IEnumerator MgWare(WorkSetup su, Action<double> done)
        {
            int GOAL = (int)MathK.RoundHalfUp(40 * su.H); const float SEC = 6;
            float fa = 0.66f - (float)su.w * 0.2f, fb = fa - 1f / 6;   // 남은 시간 비율이 (fb, fa] 이면 깨지기 쉬움
            var rng = MgRng(su);
            int n = 0, combo = 0, heavyHits = 0; bool frag = false;
            var next = new List<int>(); for (int i = 0; i < 4; i++) next.Add(rng.NextDouble() < 0.15 ? 1 : 0);
            next[0] = 0;   // 첫 박스는 일반

            var row = Ui.Row(); row.style.alignItems = Align.Stretch; row.style.flexGrow = 1; mgBoard.Add(row);
            // 트럭 짐칸
            var truck = Ui.Box(new Color(0.12f, 0.11f, 0.1f, 0.95f), 20, 18); truck.style.width = 640; Ui.Border(truck, new Color32(0x8a, 0x7a, 0x5a, 0xff), 4);
            truck.style.flexDirection = FlexDirection.Row; truck.style.flexWrap = Wrap.WrapReverse; truck.style.alignContent = Align.FlexStart; truck.style.overflow = Overflow.Hidden;   // 바닥부터 한 줄씩 쌓임
            row.Add(truck);
            var right = Ui.Box(null, 16, 20); right.style.flexGrow = 1; right.style.marginLeft = 30; right.style.alignItems = Align.Center; right.style.justifyContent = Justify.Center; row.Add(right);
            var cnt = Ui.Label("", 88, Ui.Text, true); right.Add(cnt);
            var fillLbl = Ui.Label("", 24, Ui.Dim, true); fillLbl.style.marginBottom = 6; right.Add(fillLbl);
            var prog = Ui.Box(new Color(1, 1, 1, 0.12f), 0, 10); prog.style.width = 480; prog.style.height = 22; prog.style.overflow = Overflow.Hidden; right.Add(prog);
            var progFill = Ui.Box(Ui.Gold, 0, 10); progFill.style.height = Length.Percent(100); prog.Add(progFill);
            var nextRow = Ui.Row(); nextRow.style.marginTop = 16; nextRow.style.height = 76; right.Add(nextRow);
            Button mash = null; Label mashLbl = null, warn = null;
            mash = BigBtn("올려!", "Space 연타", () => Hit(), new Color32(0xc0, 0x7a, 0x2c, 0xff), 480, 230, 60);
            mash.style.marginTop = 20; right.Add(mash);
            mashLbl = mash.Q<Label>();
            warn = Ui.Label("", 28, Ui.Bad, true); warn.style.marginTop = 14; right.Add(warn);

            string MashText() => frag ? "손 떼!!" : next[0] == 1 ? $"무거움 {heavyHits}/3" : "올려!";
            void Draw()
            {
                cnt.text = $"{n} / {GOAL}"; float r = Mathf.Clamp01((float)n / GOAL);
                progFill.style.width = Length.Percent(r * 100);
                fillLbl.text = $"적재율 {r * 100:0}%" + (r >= 0.8f ? "  (거의 다 참)" : "");
                mashLbl.text = MashText();
            }
            void DrawNext()
            {
                nextRow.Clear();
                var lb = Ui.Label("다음", 22, Ui.Dim, true); lb.style.marginRight = 10; nextRow.Add(lb);
                for (int i = 0; i < 3; i++)
                {
                    bool hv = next[i] == 1;
                    var ic = Icon("box", hv ? HeavyC : BoxC, hv ? "무거움" : null, i == 0 ? 72 : 54); ic.style.marginRight = 8;
                    if (i > 0) ic.style.opacity = 0.55f;
                    nextRow.Add(ic);
                }
            }
            void AddBox(bool heavy)
            {
                if (truck.childCount >= 40) return;
                var b = Icon("box", heavy ? HeavyC : BoxC, heavy ? "중" : null, 74); b.style.marginRight = 2; b.style.marginBottom = 2;
                truck.Add(b); Fx(Tween(0.18f, p => b.style.translate = new Translate(0, Mathf.Lerp(-120, 0, EaseOut(p)))));
            }
            void Hit()
            {
                if (n >= GOAL) return;
                if (frag)
                {
                    n = Math.Max(0, n - 3); for (int i = 0; i < 3 && truck.childCount > 0; i++) truck.RemoveAt(truck.childCount - 1);
                    combo = 0; heavyHits = 0;
                    Draw(); Flash(Ui.Bad); Shake(mash, 22); Float(right, "-3 쨍그랑", 200, 160, Ui.Bad, 54); Bubble("야 그거 유리라고 ㅅㅂ (−3)", "angry");
                    right.style.backgroundColor = new Color(0, 0, 0, 0);
                    MgHud(combo, Math.Min(1, (double)n / GOAL));
                    return;
                }
                int prev = n;
                if (next[0] == 1)
                {
                    heavyHits++;
                    if (heavyHits < 3) { Shake(mash, 6); Float(right, $"끙… {heavyHits}/3", 210, 150, Ui.Dim, 36); Draw(); return; }
                    heavyHits = 0; n = Math.Min(GOAL, n + 2); AddBox(true); AddBox(true);
                    Float(right, "+2 무거운 거!", 150, 140, Ui.Gold, 48); Punch();
                }
                else { n++; AddBox(false); }
                combo++;
                next.RemoveAt(0); next.Add(rng.NextDouble() < 0.15 ? 1 : 0); DrawNext();
                Draw(); Pop(mash);
                if (prev / 5 != n / 5) Float(right, $"+{n}", 380, 140, Ui.Gold, 40);
                if (combo % 10 == 0) Judge(combo >= 20 ? $"{combo} COMBO!! 허리 불탐" : $"{combo} COMBO!", Ui.Gold);
                right.style.backgroundColor = new Color(1, 0.55f, 0.1f, Mathf.Min(0.24f, combo * 0.008f));
                MgHud(combo, Math.Min(1, (double)n / GOAL));
                if (prev < 12 && n >= 12) Bubble("허리 나감 ㅅㅂ", "angry");
                if (prev < 26 && n >= 26) Bubble("박스 = 1틱 박스 = 1틱 박스 = 1틱", "tired");
            }

            Draw(); DrawNext(); MgHud(0, 0);
            float t = 0;
            while (t < SEC && n < GOAL)
            {
                t += Time.unscaledDeltaTime; float rem = 1 - t / SEC;
                Timer(rem, SEC - t);
                bool f = rem > fb && rem <= fa;
                if (f != frag)
                {
                    frag = f;
                    mashLbl.text = MashText();
                    mash.style.backgroundColor = f ? (Color)new Color32(0xb3, 0x26, 0x1e, 0xff) : (Color)new Color32(0xc0, 0x7a, 0x2c, 0xff);
                    warn.text = f ? "깨지기 쉬움 박스! 1초 동안 누르지 마" : "";
                    if (f) { var fb2 = Icon("box_fragile", new Color32(0xd0, 0x3a, 0x2a, 0xff), "취급주의", 150); Ui.Abs(fb2, 230, 20); fb2.name = "fragile"; truck.parent.Add(fb2); Pop(fb2); Judge("손 떼!!", Ui.Bad, 70); }
                    else { truck.parent.Q("fragile")?.RemoveFromHierarchy(); warn.style.opacity = 1; }
                }
                if (frag) warn.style.opacity = Mathf.PingPong(t * 6, 1);
                if (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return)) ExecuteButtonAction(Hit);
                yield return null;
            }
            yield return new WaitForSecondsRealtime(0.3f);
            done(Math.Min(1, (double)n / GOAL));
        }

        // ---------- 🛒 마트 창고: 피하기 ----------
        // 떨어지기 0.6초 전 위에 경고, 떨어지는 동안 바닥에 그림자. 아슬하게 피하면 콤보. 가끔 박카스 → 먹으면 하트 1개 회복.
        class Drop { public float t, x, y = -80, vx; public bool k, heal, on, done, passed, warned; public VisualElement el, shadow, warn; }

        IEnumerator MgMart(WorkSetup su, Action<double> done)
        {
            const float SEC = 9, W = 1100, AH = 600, PW = 90; const int LIVES = 5;
            float hpF = 0.55f + 0.45f * Mathf.Clamp((float)su.hp, 0, 100) / 100, speed = 760 * hpF;
            float H = (float)su.H;
            var rng = MgRng(su);

            var top = Ui.Row(); top.style.justifyContent = Justify.SpaceBetween; top.style.width = W; top.style.alignSelf = Align.Center; mgBoard.Add(top);
            var livesRow = Ui.Row(); top.Add(livesRow);
            var lives = Ui.Label("", 44, Ui.Bad, true); livesRow.Add(lives);
            var lost = Ui.Label("", 44, new Color(1, 1, 1, 0.18f), true); livesRow.Add(lost);
            var msg = Ui.Label(hpF < 0.8f ? $"체력 {su.hp:0} — 몸이 무거움 (이동 {hpF * 100:0}%)" : "← → / A D / 드래그 · 박카스는 먹기", 24, hpF < 0.8f ? Ui.Bad : Ui.Dim, true); top.Add(msg);

            var arena = Ui.Box(new Color(0.08f, 0.09f, 0.08f, 0.9f), 0, 16); arena.style.width = W; arena.style.height = AH; arena.style.alignSelf = Align.Center; arena.style.marginTop = 8;
            arena.style.overflow = Overflow.Hidden; Ui.Border(arena, MgLine, 3); mgBoard.Add(arena);
            for (int i = 0; i < 4; i++) { var shelf = Ui.Box(new Color(1, 1, 1, 0.04f)); Ui.Abs(shelf, 0, 90 + i * 120, 0); shelf.style.height = 14; arena.Add(shelf); }
            var floor = Ui.Box(new Color32(0x3a, 0x34, 0x2a, 0xff)); Ui.Abs(floor, 0, null, 0, 0); floor.style.height = 26; arena.Add(floor);
            var pl = Icon("player", Ui.Accent, "나", PW); pl.style.position = Position.Absolute; pl.style.top = AH - 26 - PW; arena.Add(pl);

            var ctl = Ui.Row(); ctl.style.justifyContent = Justify.Center; ctl.style.marginTop = 14; mgBoard.Add(ctl);
            bool hl = false, hr = false; float? target = null;
            Button Hold(string txt, string key, Action<bool> set)
            {
                var b = BigBtn(txt, key, null, new Color32(0x44, 0x40, 0x55, 0xff), 260, 76, 28);
                b.RegisterCallback<PointerDownEvent>(_ => set(true), TrickleDown.TrickleDown);
                b.RegisterCallback<PointerUpEvent>(_ => set(false)); b.RegisterCallback<PointerLeaveEvent>(_ => set(false));
                return b;
            }
            ctl.Add(Hold("◀ 왼쪽", "←", v => hl = v)); ctl.Add(Hold("오른쪽 ▶", "→", v => hr = v));
            void ToX(Vector2 lp) => target = Mathf.Clamp(lp.x - PW / 2, 0, W - PW);
            arena.RegisterCallback<PointerDownEvent>(e => { ToX(e.localPosition); arena.CapturePointer(e.pointerId); });
            arena.RegisterCallback<PointerMoveEvent>(e => { if (arena.HasPointerCapture(e.pointerId)) ToX(e.localPosition); });
            arena.RegisterCallback<PointerUpEvent>(e => arena.ReleasePointer(e.pointerId));

            var objs = new List<Drop>();
            foreach (var d in su.drops) objs.Add(new Drop { t = (float)d[0] * SEC, x = 20 + (float)d[1] * (W - 100), k = d[2] > 0 });
            if (rng.NextDouble() < 0.55) objs.Add(new Drop { t = SEC * (0.35f + 0.4f * (float)rng.NextDouble()), x = 20 + (float)rng.NextDouble() * (W - 100), heal = true });
            float x = W / 2 - PW / 2; int hits = 0, combo = 0;
            void Lives() { lives.text = new string('♥', Math.Max(0, LIVES - hits)); lost.text = new string('♥', Math.Min(LIVES, hits)); }
            void Gone(Drop o, bool fade)
            {
                o.done = true; o.shadow?.RemoveFromHierarchy();
                var el = o.el; if (el == null) return;
                if (!fade) { el.RemoveFromHierarchy(); return; }
                Fx(Tween(0.3f, p => { el.style.opacity = 1 - p; el.style.scale = new Scale(Vector3.one * (1 + p)); if (p >= 1) el.RemoveFromHierarchy(); }));
            }
            Lives(); MgHud(0, 1);

            float t = 0;
            while (t < SEC && hits < LIVES)
            {
                float dt = Mathf.Min(0.05f, Time.unscaledDeltaTime); t += dt;
                Timer(1 - t / SEC, SEC - t);
                bool kl = hl || Input.GetKey(KeyCode.LeftArrow) || Input.GetKey(KeyCode.A), kr = hr || Input.GetKey(KeyCode.RightArrow) || Input.GetKey(KeyCode.D);
                int dir = (kr ? 1 : 0) - (kl ? 1 : 0);
                if (dir != 0) target = null;
                if (target != null) { float dd = target.Value - x; x += Mathf.Sign(dd) * Mathf.Min(Mathf.Abs(dd), speed * dt); }
                else x = Mathf.Clamp(x + dir * speed * dt, 0, W - PW);
                bool moving = dir != 0 || (target != null && Mathf.Abs(target.Value - x) > 1);
                pl.style.left = x;
                pl.style.translate = new Translate(0, moving ? -Mathf.Abs(Mathf.Sin(t * 18)) * 10 : 0);
                pl.style.rotate = new Rotate(new Angle(moving ? (dir != 0 ? dir : Mathf.Sign(target.Value - x)) * 8 : 0));

                foreach (var o in objs)
                {
                    if (o.done) continue;
                    if (!o.on)
                    {
                        if (!o.warned && t >= o.t - 0.6f)
                        {
                            o.warned = true;
                            o.warn = Ui.Label(o.heal ? "+" : o.k ? "빵빵!" : "!", o.k ? 30 : 48, o.heal ? Ui.Good : o.k ? Ui.Bad : Ui.Gold, true);
                            Ui.Abs(o.warn, o.x + 18, 6); o.warn.pickingMode = PickingMode.Ignore;
                            o.warn.style.unityTextOutlineColor = Color.black; o.warn.style.unityTextOutlineWidth = 1.5f;
                            arena.Add(o.warn);
                        }
                        if (o.warn != null) o.warn.style.opacity = Mathf.PingPong(t * 8, 1);
                        if (t < o.t) continue;
                        o.on = true; o.warn?.RemoveFromHierarchy(); o.warn = null;
                        o.el = o.heal ? Icon("bacchus", new Color32(0xe8, 0xb8, 0x2a, 0xff), "박카스", 64)
                             : o.k ? Icon("cart", new Color32(0xd0, 0x3a, 0x3a, 0xff), "진상", 90) : Icon("box", BoxC, null, 74);
                        o.el.style.position = Position.Absolute;
                        o.shadow = Ui.Box(new Color(0, 0, 0, 0.5f), 0, 8); o.shadow.style.position = Position.Absolute; o.shadow.style.height = 14; o.shadow.pickingMode = PickingMode.Ignore;
                        arena.Insert(arena.IndexOf(pl), o.shadow);   // 그림자는 플레이어 밑
                        arena.Add(o.el);
                        o.vx = o.k ? (x > o.x ? 1 : -1) * 120 : 0;
                    }
                    float vy = o.heal ? 330 * H : (o.k ? 520 : 400) * H;
                    float prevY = o.y;
                    o.y += vy * dt; o.x = Mathf.Clamp(o.x + o.vx * dt, 0, W - 70);
                    o.el.style.left = o.x; o.el.style.top = o.y;
                    if (!o.k) o.el.style.rotate = new Rotate(new Angle(o.y * (o.heal ? 0.15f : 0.3f)));
                    float pr = Mathf.Clamp01((o.y + 80) / (AH - 40)), sw = Mathf.Lerp(16, o.k ? 90 : 70, pr);
                    o.shadow.style.left = o.x + 35 - sw / 2; o.shadow.style.top = AH - 26 - 10; o.shadow.style.width = sw; o.shadow.style.opacity = 0.25f + 0.75f * pr;

                    float dx = Mathf.Abs(o.x + 35 - (x + PW / 2)), hrad = o.k ? 70 : 58;
                    if (o.y > AH - 120 && o.y < AH - 30 && dx < hrad)
                    {
                        Gone(o, true);
                        if (o.heal)
                        {
                            bool healed = hits > 0; if (healed) hits--; Lives();
                            Float(arena, healed ? "+♥ 박카스" : "박카스 원샷", x - 20, AH - 220, Ui.Good, 40); Flash(Ui.Good);
                            if (healed) { Judge("회복!", Ui.Good); Pop(lives); }
                            Bubble("박카스 = 합법 도핑", "smug");
                        }
                        else
                        {
                            hits++; combo = 0; Lives();
                            msg.text = o.k ? "진상: \"사장 나오라 그래!!!\" (−일당)" : "박스에 맞음. 허리도 매도함 (−일당)"; msg.style.color = Ui.Bad;
                            Flash(Ui.Bad); Shake(arena, 18); Float(arena, "아야", x, AH - 200, Ui.Bad);
                            if (hits == 2) Bubble("자기 괜찮아?? 그거 계란 박스였음", "panic");
                        }
                        MgHud(combo, Mathf.Clamp01(1 - (float)hits / LIVES));
                    }
                    else if (!o.passed && prevY <= AH - 30 && o.y > AH - 30)
                    {
                        o.passed = true;
                        if (!o.heal && dx < hrad + 60)
                        {
                            combo++;
                            Float(arena, combo >= 2 ? $"아슬! x{combo}" : "아슬!", x - 10, AH - 200, Ui.Gold, 36);
                            if (combo % 5 == 0) { Judge($"회피 {combo}연속", Ui.Gold); Punch(); }
                            MgHud(combo, Mathf.Clamp01(1 - (float)hits / LIVES));
                        }
                    }
                    if (!o.done && o.y > AH) Gone(o, false);
                }
                yield return null;
            }
            yield return new WaitForSecondsRealtime(0.3f);
            done(Mathf.Clamp01(1 - (float)hits / LIVES));
        }
    }
}
