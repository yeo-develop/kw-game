using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using KwGame.Sim;
using KwGame.View;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.Tests
{
    /// 글자가 깨지는 종류의 결함: 타자 효과 순서 · 낱말 중간 줄바꿈 · 말풍선 겹침 · 알림이 대사를 가림 · 넘기기 누름이 버튼까지 누름
    public sealed class UiTextTests
    {
        const string Broken = "…엄마가 자기 목소리 좋대. 반찬 보내 준대 ㅠㅠ";   // 실제로 깨져 보였던 줄 ("…" 로 시작 + 띄어쓰기)

        // ---------- 타자 효과 (TypeReveal) ----------
        [Test]
        public void TypewriterAlwaysRevealsFromTheFront()
        {
            foreach (var raw in new[] { Broken, "…이제 누가 알바 가는지 정해졌네.", "짧음", "마통 땡기고, 카드론 땡기고, 모자라면 김사장 캐피탈까지. 레버리지는 국룰 50배지 ㅎㅎ", "?!…" })
            {
                var t = new TypeReveal(); string text = Ui.Show(raw);
                t.Start(text);
                int last = 0, steps = 0;
                while (t.Typing && steps++ < 5000)
                {
                    Assert.That(t.Shown, Is.GreaterThanOrEqualTo(last), "보이는 글자 수는 줄지 않음"); last = t.Shown;
                    for (int i = 1; i < text.Length; i++) Assert.That(t.Alpha(i), Is.LessThanOrEqualTo(t.Alpha(i - 1)), $"'{raw}' {t.Shown}글자째: {i}번째 글자가 앞 글자보다 진함 (순서가 뒤섞임)");
                    for (int i = t.Shown; i < text.Length; i++) Assert.That(t.Alpha(i), Is.EqualTo(0), "아직 안 나온 글자는 안 보임");
                    t.Tick(0.01f);
                }
                Assert.That(t.Typing, Is.False, $"'{raw}' 가 끝까지 나옴");
                for (int i = 0; i < text.Length; i++) Assert.That(t.Alpha(i), Is.EqualTo(255), $"'{raw}' 다 나온 뒤 {i}번째 글자가 안 보임");
            }
        }

        [Test]
        public void TypewriterTimingFollowsPunctuationAndSpeed()
        {
            Assert.That(TypeReveal.Delay('.', '가'), Is.EqualTo(TypeReveal.Long));
            Assert.That(TypeReveal.Delay(',', '가'), Is.EqualTo(TypeReveal.Middle));
            Assert.That(TypeReveal.Delay('?', '!'), Is.EqualTo(TypeReveal.Normal), "문장 부호가 이어지면 한 번만 쉼");
            Assert.That(TypeReveal.Delay('가', '나'), Is.EqualTo(TypeReveal.Normal));
            var slow = new TypeReveal { Speed = 2 }; slow.Start("가나다라마바사아자차"); slow.Tick(0.1f);
            var fast = new TypeReveal { Speed = 0.45f }; fast.Start("가나다라마바사아자차"); fast.Tick(0.1f);
            Assert.That(fast.Shown, Is.GreaterThan(slow.Shown), "빠름이 느림보다 많이 나옴");
            var now = new TypeReveal { Speed = 0 }; now.Start(Broken);
            Assert.That(now.Typing, Is.False, "즉시 = 처음부터 전부");
            var sp = new TypeReveal(); sp.Start("가 나");
            Assert.That(sp.Shown, Is.EqualTo(2), "공백은 앞 글자와 함께 넘어감 (공백에서 한 박자 쉬지 않음)");
        }

        // ---------- 낱말 단위 줄바꿈 ----------
        [Test]
        public void KeepAllJoinsCharactersInsideShortWords()
        {
            string s = "무서워 ㅠㅠ", k = Ui.KeepAll(s);
            Assert.That(k, Does.Contain("ㅠ" + Ui.WJ + "ㅠ"));
            Assert.That(k, Does.Contain("무" + Ui.WJ + "서" + Ui.WJ + "워 "), "띄어쓰기는 그대로 (거기서만 줄이 바뀜)");
            Assert.That(Ui.Plain(k), Is.EqualTo(s));
            Assert.That(Ui.KeepAll(k), Is.EqualTo(k), "두 번 해도 같음");
            Assert.That(Ui.KeepAll("미래"), Is.EqualTo("미래"), "띄어쓰기 없는 글은 그대로");
            string longTok = new string('ㅋ', Ui.KeepMax + 1);
            Assert.That(Ui.KeepAll("와 " + longTok), Is.EqualTo("와 " + longTok), "아주 긴 덩어리는 안 묶음 (좁은 칸에서 넘치지 않게)");
            Assert.That(Ui.KeepAll(null), Is.EqualTo(""));
        }

        [Test]
        public void KoreanTextWrapsAtSpacesNotInsideWords()
        {
            using var rig = new ViewRig();
            var host = new VisualElement(); host.style.position = Position.Absolute; host.style.width = 1600; host.style.alignItems = Align.FlexStart; rig.root.Add(host);
            // 안팎 여백 없는 글 상자 (줄 수 = 높이 ÷ 한 줄 높이 가 정확하게 나오게)
            Label L(string text, float? width)
            {
                var l = new Label(text); l.style.fontSize = 24; l.style.whiteSpace = width.HasValue ? WhiteSpace.Normal : WhiteSpace.NoWrap;
                l.style.marginLeft = l.style.marginRight = l.style.marginTop = l.style.marginBottom = 0; l.style.paddingLeft = l.style.paddingRight = l.style.paddingTop = l.style.paddingBottom = 0;
                if (width.HasValue) l.style.width = width.Value;
                host.Add(l); return l;
            }
            var four = L("가나다라", null); var joined = L("가\u2060나\u2060다\u2060라", null);
            rig.Layout();
            float cw = four.layout.width / 4f, lh = four.layout.height;
            int Lines(Label l) => Mathf.RoundToInt(l.layout.height / lh);
            Assert.That(joined.layout.width, Is.EqualTo(four.layout.width).Within(0.6f), "이음표는 폭이 없음 (안 보이는 글자)");
            var a = L(Ui.Show("가 나다라 마"), cw * 3.6f);                    // 낱말 단위: 가 / 나다라 / 마
            var raw = L("가 나다라 마", cw * 3.6f);                          // 대조: 이음표 없이는 가 나다 / 라 마
            var b = L(Ui.Show("자기 어디야? 무서워 ㅠㅠ"), cw * 9.4f);         // "ㅠㅠ" 가 갈라지지 않음: 자기 어디야? / 무서워 ㅠㅠ
            var c = L(Ui.Show("못 갚았을 때 미래가 따라와 주는 조건이 느슨함"), cw * 7.5f);   // 타이틀 난이도 설명: "미 / 래가" 로 끊기던 줄
            rig.Layout();
            Assert.That(Lines(a), Is.EqualTo(3), $"낱말 단위로 끊기면 3줄 (한 줄 {lh:0.0} · 실제 {a.layout.height:0.0})");
            Assert.That(Lines(raw), Is.EqualTo(2), "대조: 이음표가 없으면 낱말 중간에서 끊겨 2줄 — 이 테스트가 줄바꿈을 실제로 재고 있다는 증거");
            Assert.That(Lines(b), Is.EqualTo(2));
            Assert.That(Lines(c), Is.EqualTo(4), "못 갚았을 때 / 미래가 따라와 / 주는 조건이 / 느슨함");
            Assert.That(Ui.Label("자기 어디야? 무서워 ㅠㅠ").text, Is.EqualTo(Ui.Show("자기 어디야? 무서워 ㅠㅠ")), "화면 글 상자(Ui.Label)는 늘 낱말 단위 줄바꿈");
        }

        // ---------- 카톡 말풍선 ----------
        [Test]
        public void KakaoBubblesNeverOverlapAndTimeStaysInside()
        {
            using var rig = new ViewRig();
            var body = new VisualElement(); body.style.position = Position.Absolute; body.style.width = 850; rig.root.Add(body);
            var room = ("m", "미래 ♥", (Color)new Color32(0xff, 0x8f, 0xb1, 0xff));
            string[] msgs =
            {
                "자기 어디야? 밥은 먹었어? 나 혼자 집에 있으니까 무서워 ㅠㅠ",
                "자기 밥은 먹었어? 나 오늘 좀 불안해 ㅠㅠ 코인 생각 안 할게 약속!",
                "짧은 말",
                "자기야 아직 일어났어? 나 무서워서 잠이 안 와 ㅠㅠ 그리고 이건 세 줄까지 가는 아주아주 긴 말이라서 말풍선이 넘치는지 보려고 일부러 길게 쓴 거야 진짜로",
            };
            foreach (var w in new[] { "m", "me" }) foreach (var m in msgs) rig.Call("KkBubble", body, w, m, "12:00", room);
            rig.Layout();
            for (int i = 0; i < body.childCount; i++)
            {
                var row = body[i]; var col = row[row.childCount - 1]; var line = col[col.childCount - 1]; var bub = line[0]; var time = line[1];
                Assert.That(col.layout.yMax, Is.LessThanOrEqualTo(row.layout.height + 1), $"말풍선 {i}: 내용이 줄 높이보다 큼 → 다음 말풍선과 겹침");
                Assert.That(bub.layout.yMax, Is.LessThanOrEqualTo(line.layout.height + 1), $"말풍선 {i}: 글 상자가 줄보다 큼");
                Assert.That(Mathf.Max(bub.layout.xMax, time.layout.xMax), Is.LessThanOrEqualTo(col.layout.width + 1), $"말풍선 {i}: 시각이 잘림");
                if (i + 1 < body.childCount) Assert.That(body[i + 1].layout.y, Is.GreaterThanOrEqualTo(row.layout.yMax - 0.5f), $"말풍선 {i} 와 다음 줄이 겹침");
            }
            Assert.That(rig.Lint(body), Is.Empty);
        }

        // ---------- 카톡 알림이 대사를 가리지 않음 ----------
        [Test]
        public void KakaoPopupMovesAboveTheDialogueBoxWhileSomeoneTalks()
        {
            using var rig = new ViewRig(sim: true);
            Assert.That(rig.G.S.pending.t, Is.EqualTo("home"));
            rig.Call("KakaoPop", "m", "오늘 밤 칸은 내 거야. 밤엔 나랑 있어 줘.");
            rig.Layout();
            var pop = rig.Get<VisualElement>("kkPopCol"); var dlg = rig.Get<VisualElement>("dlg");
            Assert.That(pop.style.bottom.value.value, Is.EqualTo(24).Within(0.1f), "집 · 대사 없음: 왼쪽 아래");
            var say = (IEnumerator)rig.Call("Say", "m", null, "…표에 이렇게 적혀 있네.", null);
            Assert.That(say.MoveNext(), Is.True);
            rig.Layout();
            Assert.That(dlg.resolvedStyle.display, Is.EqualTo(DisplayStyle.Flex));
            float dlgTop = dlg.resolvedStyle.bottom + dlg.layout.height;   // 화면 아래에서 대사창 윗변까지
            Assert.That(pop.style.bottom.value.value, Is.GreaterThanOrEqualTo(dlgTop), "대사가 나오는 동안엔 대사창 위로");
            rig.Call("HideDialogue"); rig.Layout();
            Assert.That(pop.style.bottom.value.value, Is.EqualTo(24).Within(0.1f), "대사가 끝나면 제자리");
        }

        // ---------- 넘기기 누름 보호 ----------
        static void Press(ViewRig rig, Vector2 at)
        {
            using (var e = PointerDownEvent.GetPooled(new Event { type = EventType.MouseDown, mousePosition = at, button = 0, clickCount = 1 })) rig.root.panel.visualTree.SendEvent(e);
            using (var e = PointerUpEvent.GetPooled(new Event { type = EventType.MouseUp, mousePosition = at, button = 0, clickCount = 1 })) rig.root.panel.visualTree.SendEvent(e);
        }

        [Test]
        public void AdvanceClickCannotPressAButtonThatAppearsUnderIt()
        {
            using var rig = new ViewRig();
            int n = 0, cards = 0;
            var b = new Button(() => n++) { text = "선택지" }; b.style.position = Position.Absolute; b.style.left = 200; b.style.top = 200; b.style.width = 300; b.style.height = 90; rig.root.Add(b);
            var card = new VisualElement(); card.style.position = Position.Absolute; card.style.left = 600; card.style.top = 200; card.style.width = 300; card.style.height = 90; card.RegisterCallback<ClickEvent>(_ => cards++); rig.root.Add(card);
            rig.Layout();
            Vector2 pb = b.worldBound.center, pc = card.worldBound.center;
            Press(rig, pb); Press(rig, pc);
            if (n != 1 || cards != 1) Assert.Inconclusive($"창 없는 실행에선 가짜 누름이 버튼에 안 닿음 (버튼 {n} · 카드 {cards}) — 배포본에서 실제 클릭으로 확인");
            // 대사를 넘긴 누름 직후: 버튼이 그 자리에 있어도 안 눌림
            rig.Call("GuardUi");
            Press(rig, pb); Press(rig, pc);
            Assert.That(n, Is.EqualTo(1), "보호 중엔 버튼이 안 눌림"); Assert.That(cards, Is.EqualTo(1), "보호 중엔 카드(ClickEvent)도 안 눌림");
            Assert.That((bool)rig.Prop("GuardOn"), Is.True, "연타는 보호 시간을 다시 늘림");
            rig.Set("uiGuardUntil", 0f);   // 손을 멈췄다 (시간이 지남)
            Press(rig, pb); Press(rig, pc);
            Assert.That(n, Is.EqualTo(2), "보호가 끝나면 다시 눌림"); Assert.That(cards, Is.EqualTo(2));
        }

        [Test]
        public void OnlyAdvanceWaitsArmTheGuard()
        {
            using var rig = new ViewRig();
            rig.Get<TypeReveal>("dlgType").Speed = 1;
            // "아무 데나 눌러 넘기기" 기다림: 넘기는 순간 보호가 켜짐
            var wait = (IEnumerator)rig.Call("WaitClick", false);
            Assert.That(wait.MoveNext(), Is.True);
            rig.Set("waitFrame", Time.frameCount - 1);
            rig.Call("RequestAdvance");
            Assert.That((bool)rig.Get("clicked"), Is.True);
            Assert.That((bool)rig.Prop("GuardOn"), Is.True, "넘기기로 쓴 누름 → 보호");
            Assert.That(wait.MoveNext(), Is.False);
            // 버튼을 고르는 기다림 (오프닝 다시 보기 카드): 그 누름은 버튼 것 → 보호를 켜면 버튼이 안 눌림
            rig.Set("uiGuardUntil", 0f);
            rig.Set("waiting", true); rig.Set("waitAny", false); rig.Set("waitFrame", Time.frameCount - 1); rig.Set("advanceFrame", Time.frameCount - 1);
            rig.Call("RequestAdvance");
            Assert.That((bool)rig.Prop("GuardOn"), Is.False, "버튼 고르기 기다림에선 보호 안 켬");
        }

        // ---------- 아침 한 장 ----------
        /// 다음 아침 사건이 나올 때까지 무난하게 진행 (집 = 쉬기)
        static SimEvent NextMorning(GameSim g)
        {
            for (int i = 0; i < 80 && g.S.pending != null && g.S.pending.t != "ending"; i++)
            {
                var P = g.S.pending; SimCommand c;
                switch (P.t)
                {
                    case "home": c = new SimCommand("rest"); break;
                    case "relic": c = new SimCommand("pickRelic", "i", 0); break;
                    case "event": c = new SimCommand("evPick", "k", P.opts.First(o => !o.dis).k); break;
                    case "menhera": case "impulse": c = new SimCommand("reply", "i", P.opts.FindIndex(o => o.ok)); break;
                    case "tempt": c = new SimCommand("tempt", "k", "no"); break;
                    case "payday": c = new SimCommand("payday", "k", P.stage == "repay" ? "keep" : P.opts.First(o => !o.dis).k); break;
                    default: Assert.Fail("NextMorning: " + P.t); return null;
                }
                var m = g.Apply(c).FirstOrDefault(x => x.t == "morning");
                if (m != null) return m;
            }
            return null;
        }

        [Test]
        public void MorningIsOneSheetWithThePaymentLadder()
        {
            using var rig = new ViewRig(sim: true);
            rig.c.autoSkipDialog = true;
            var m = NextMorning(rig.G); Assert.That(m, Is.Not.Null, "아침 사건");
            rig.Call("RenderAll"); rig.Call("CoachClose");
            var it = (IEnumerator)rig.Call("Morning", m);
            Assert.That(it.MoveNext(), Is.True);
            rig.Layout();
            var sheet = rig.Get<VisualElement>("settleEl"); Assert.That(sheet, Is.Not.Null);
            var card = sheet.Q("morning-card"); var ladder = sheet.Q("morning-ladder");
            Assert.That(ladder.childCount, Is.EqualTo(rig.G.gateLadder().Count), "납부 일정이 주마다 한 칸");
            Assert.That(sheet.Q<Button>("morning-go"), Is.Not.Null, "시작 버튼 (어디를 눌러야 하는지 보임)");
            Assert.That(rig.Get<VisualElement>("planEl").resolvedStyle.display, Is.EqualTo(DisplayStyle.None), "아침 한 장 동안 계획판은 숨김 (글 위에 글이 겹치지 않게)");
            Assert.That(rig.Get<VisualElement>("modal").resolvedStyle.display, Is.EqualTo(DisplayStyle.None), "가운데 덮개 카드가 아님");
            Assert.That(card.worldBound.yMax, Is.LessThanOrEqualTo(ViewRig.H - 8), "카드가 화면 안에 들어옴");
            Assert.That(card.worldBound.xMax, Is.LessThanOrEqualTo(ViewRig.W));
            Assert.That(card.Query<Label>().ToList().Count(l => l.text.Contains("클릭해서 계속")), Is.EqualTo(0));
            Assert.That(rig.Lint(sheet), Is.Empty);
            while (it.MoveNext()) { }
            Assert.That(rig.Get<VisualElement>("settleEl"), Is.Null, "넘기면 걷힘");
        }

        /// 줄이 가장 많은 아침 (주 첫날 + 주말 표시 + 사건 + 부탁 + 새로 열림 + 버프 + 어제 5건): 그래도 시작 버튼이 카드 안에 온전히 보임
        [Test]
        public void MorningStartButtonIsNeverCutOffOnTheBusiestDay()
        {
            using var rig = new ViewRig(sim: true);
            rig.c.autoSkipDialog = true;
            var m = NextMorning(rig.G); Assert.That(m, Is.Not.Null);
            m.d["day"] = 1; m.d["wk"] = true; m.d["ev"] = "수상한 택배가 왔다. 열어 보니 현금 5만원과 쪽지 한 장이 들어 있다. 누가 보낸 걸까.";
            m.d["Y"] = Enumerable.Range(0, 5).Select(i => new Dictionary<string, object> { ["label"] = $"멍멍코인 3x 청산 · 증거금 76% 증발 ({i})", ["amt"] = -75000.0 * (i + 1) }).ToList();
            m.d["net"] = -1125000.0; m.d["netConv"] = "최저시급 알바 109시간";
            m.d["mline"] = "잠 못 잤어. 꿈에 김사장 나왔어 ㅠㅠ 오늘은 진짜 조심하자, 알았지?";
            rig.G.S.missN = 1; rig.G.S.prom = ((Newtonsoft.Json.Linq.JArray)rig.G.D.J["V4_PROM"])[0].Value<string>("id");
            rig.Set("mShortSeen", (bool?)false); rig.Set("mLoanSeen", (bool?)false); rig.Set("mBuffSeen", -1);
            rig.G.S.shortOn = true; rig.G.S.aff = 85;
            rig.Call("RenderAll"); rig.Call("CoachClose");
            var it = (IEnumerator)rig.Call("Morning", m);
            Assert.That(it.MoveNext(), Is.True);
            rig.Layout();
            var sheet = rig.Get<VisualElement>("settleEl"); var card = sheet.Q("morning-card"); var go = sheet.Q<Button>("morning-go");
            Assert.That(card.worldBound.yMax, Is.LessThanOrEqualTo(ViewRig.H - 8), "카드가 화면 안");
            Assert.That(go.worldBound.yMax, Is.LessThanOrEqualTo(card.worldBound.yMax - 8), "시작 버튼이 카드 안에 온전히");
            Assert.That(go.worldBound.height, Is.GreaterThan(60), "버튼이 찌그러지지 않음");
            Assert.That(sheet.Q("morning-ladder").worldBound.height, Is.GreaterThan(80), "납부 일정이 찌그러지지 않음");
            Assert.That(rig.Lint(sheet), Is.Empty);
        }

        // ---------- 화면별 배치 검사 (탐색용 기록: logs/lint.txt) ----------
        [Test]
        public void LintDump()
        {
            var sb = new StringBuilder();
            void Section(string name, ViewRig rig, VisualElement scope = null)
            {
                rig.Layout();
                var L = rig.Lint(scope);
                sb.AppendLine($"## {name}: {L.Count}건 (화면 {rig.root.layout.width:0}x{rig.root.layout.height:0})");
                foreach (var x in L.Take(60)) sb.AppendLine("  " + x);
            }
            try
            {
                using (var rig = new ViewRig(sim: true))
                {
                    Section("집 (계획판)", rig);
                    foreach (var tab in new[] { "stock", "kakao", "gall", "news", "notes" })
                    {
                        rig.Set("phoneOpen", true); rig.Set("phoneTab", tab);
                        if (tab == "kakao")
                        {
                            var kk = rig.G.S.kk["m"];
                            foreach (var x in LongLines(rig.G).Take(14)) kk.Add(new KMsg { w = "m", x = x, t = "12:00", d = 1 });
                            kk.Add(new KMsg { w = "me", x = "응 알겠어. 오늘은 알바만 하고 바로 들어갈게. 코인은 진짜 안 볼게 약속", t = "12:01", d = 1 });
                        }
                        try { rig.Render(); Section("폰 · " + tab, rig, rig.Get<VisualElement>("phone")); } catch (System.Exception e) { sb.AppendLine($"## 폰 · {tab}: 예외 {e.Message.Split('\n')[0]}"); }
                    }
                    rig.Set("phoneOpen", false); rig.Render();
                    try { rig.Call("OpenStatusCard"); Section("상태 카드", rig, rig.Get<VisualElement>("statusCard")); rig.Call("CloseStatusCard"); } catch (System.Exception e) { sb.AppendLine("## 상태 카드: 예외 " + e.Message.Split('\n')[0]); }
                    try { rig.G.Apply(new SimCommand("watch")); rig.Render(); Section("장 보기 (데스크)", rig); rig.G.Apply(new SimCommand("leave")); } catch (System.Exception e) { sb.AppendLine("## 데스크: 예외 " + e.Message.Split('\n')[0]); }
                }
                foreach (var ev in new[] { "v4_fund", "v4_reg_no", "mom_call" })
                    using (var rig = new ViewRig(sim: true))
                    {
                        try { rig.G.Apply(new SimCommand("debug", "k", "ev:" + ev)); rig.Render(); Section($"이벤트 {ev} ({rig.G.S.pending?.t})", rig); } catch (System.Exception e) { sb.AppendLine($"## 이벤트 {ev}: 예외 " + e.Message.Split('\n')[0]); }
                    }
                using (var rig = new ViewRig(sim: true))
                {
                    try { rig.G.Apply(new SimCommand("debug", "k", "gate")); rig.Render(); Section($"납부 관문 ({rig.G.S.pending?.t}/{rig.G.S.pending?.stage})", rig); } catch (System.Exception e) { sb.AppendLine("## 관문: 예외 " + e.Message.Split('\n')[0]); }
                }
                using (var rig = new ViewRig(sim: true))
                {
                    rig.c.autoSkipDialog = true;
                    for (int d = 0; d < 8; d++)
                    {
                        var m = NextMorning(rig.G); if (m == null) break;
                        try { rig.Call("RenderAll"); rig.Call("CoachClose"); var it = (IEnumerator)rig.Call("Morning", m); it.MoveNext(); Section($"아침 {d + 2}일째", rig, rig.Get<VisualElement>("settleEl")); while (it.MoveNext()) { } }
                        catch (System.Exception e) { sb.AppendLine($"## 아침 {d + 2}: 예외 " + e.Message.Split('\n')[0]); }
                    }
                }
            }
            catch (System.Exception e) { sb.AppendLine("실패: " + e); }
            Directory.CreateDirectory("logs");
            File.WriteAllText("logs/lint.txt", sb.ToString());
            Assert.Pass();
        }

        /// 데이터에서 가장 긴 미래 말들 (글이 길 때 배치가 버티는지 보려고)
        static IEnumerable<string> LongLines(GameSim g)
        {
            var all = new List<string>();
            void Dig(Newtonsoft.Json.Linq.JToken t)
            {
                if (t is Newtonsoft.Json.Linq.JValue v && v.Type == Newtonsoft.Json.Linq.JTokenType.String) { var s = (string)v; if (s.Length >= 24 && s.Length <= 90 && s.Contains(" ")) all.Add(s); }
                else foreach (var c in t.Children()) Dig(c);
            }
            foreach (var k in new[] { "KQ", "MEN_SETS", "MEN_SETS_X", "LINES", "V4_LINES" }) if (g.D.J[k] != null) Dig(g.D.J[k]);
            return all.Distinct().OrderByDescending(s => s.Length);
        }
    }
}
