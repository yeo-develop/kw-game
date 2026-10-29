using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Febucci.TextAnimatorForUnity;
using KwGame.Sim;
using KwGame.Audio;
using Newtonsoft.Json.Linq;
using UnityEngine;
using UnityEngine.UIElements;

namespace KwGame.View
{
    /// 메인 루프 (web/src/view/main.js 대응): pending → 화면 → 명령 → 이벤트 재생 → pending …
    /// 화면은 UI Toolkit 을 코드로 만든다 (UXML/프리팹 없이 데이터 따라 메뉴가 바뀌는 구조라 flex 레이아웃이 편함).
    public partial class GameController : MonoBehaviour
    {
        public int seed = 0;            // 0 = 랜덤
        public bool autoSkipDialog;     // 데모·스크린샷용

        GameData D; GameSim G; GameState S => G.S;
        UIDocument doc; VisualElement root;
        VisualElement hudBar, stage, dlg, panel, panelBody, toastCol, modal, phone;
        Label stageTitle, dlgName, dlgHint, panelTitle;
        AnimatedLabel dlgText;
        TypingDelaysByCharacter dialogueTiming;
        AnimatorSettingsScriptable dialogueAnimation;
        bool playing, waiting, clicked; int waitFrame;
        bool waitingForDialogue;
        int advanceFrame = -1;
        bool phoneOpen; string phoneTab = "stock";
        double stakeFrac = 0.1;
        Font font, fontBold;

        static readonly Dictionary<string, Color> BG = new Dictionary<string, Color>
        {
            ["room"] = new Color32(0x2b, 0x24, 0x3a, 0xff), ["map"] = new Color32(0x1e, 0x33, 0x2a, 0xff), ["broker"] = new Color32(0x1d, 0x2a, 0x4a, 0xff),
            ["bank"] = new Color32(0x22, 0x30, 0x40, 0xff), ["casino"] = new Color32(0x45, 0x12, 0x22, 0xff), ["cafe"] = new Color32(0x3a, 0x2a, 0x1e, 0xff),
            ["store"] = new Color32(0x1f, 0x3a, 0x3a, 0xff), ["ware"] = new Color32(0x33, 0x2e, 0x24, 0xff), ["mart"] = new Color32(0x2e, 0x36, 0x1e, 0xff),
            ["pc"] = new Color32(0x18, 0x18, 0x30, 0xff), ["shop"] = new Color32(0x3a, 0x1e, 0x36, 0xff), ["lotto"] = new Color32(0x3a, 0x33, 0x14, 0xff),
            ["race"] = new Color32(0x1e, 0x3a, 0x1a, 0xff), ["sea"] = new Color32(0x10, 0x22, 0x3a, 0xff), ["gall"] = new Color32(0x22, 0x22, 0x22, 0xff),
        };

        // ---------- 시작 ----------
        void Start()
        {
            Application.targetFrameRate = 60;
            if (Camera.main != null && !FindObjectsByType<AudioListener>().Any(listener => listener.isActiveAndEnabled))
                Camera.main.gameObject.AddComponent<AudioListener>();
            D = LoadData();
            font = Resources.Load<Font>("Fonts/Pretendard-Regular");
            fontBold = Resources.Load<Font>("Fonts/Pretendard-Bold");
            BuildUi();
            bool requested = TitleStartup.Consume(out var restored);
            if (restored != null)
            {
                G = new GameSim(D, restored) { Hud = true };
                G.EnableRt();   // 예전(칸 방식) 저장도 실시간으로 이어서
                saveMessage = "저장 데이터를 불러왔습니다.";
                RenderAll();
            }
            else
            {
                NewGame(seed != 0 ? seed : UnityEngine.Random.Range(1, 1000000));
                if (requested) Send("start");
            }
            var shots = ArgValue("-kwShots");
            if (shots != null) StartCoroutine(DemoShots(shots));
        }

        public static GameData LoadData()
        {
            var assets = Resources.LoadAll<TextAsset>("Data");
            return GameData.Load(assets.Select(a => new KeyValuePair<string, string>(a.name + ".json", a.text)));
        }

        void NewGame(int sd)
        {
            G = GameSim.Create(D, sd, new GameSim.Opts { rt = true });
            G.Hud = true;
            phoneOpen = false;
            LlmNewGame();
            RenderAll();
            LlmTick();
        }

        public void Send(SimCommand c)
        {
            if (playing) return;
            int coinsBefore = S.cps.Count;
            var evs = G.Apply(c);
            int closedCoins = c.t == "closeCoins" ? coinsBefore - S.cps.Count : 0;
            var cb = onSent; onSent = null; cb?.Invoke(evs);   // 주문 결과 메시지 (GameController.Chart.cs)
            LlmTick();   // 새 칸이면 뉴스·대사 요청을 재생 전에 미리 (GameController.Llm.cs)
            StartCoroutine(Play(evs, closedCoins));
        }
        void Send(string t, params object[] kv) => Send(new SimCommand(t, kv));

        // ---------- 이벤트 재생 (events.js) ----------
        IEnumerator Play(List<SimEvent> evs, int closedCoins = 0)
        {
            playing = true; FacePlayBegin();
            panel.style.display = DisplayStyle.None;   // 이벤트 재생 중엔 지난 선택지를 아예 걷음 (반투명으로 남아 보이던 문제)
            MinigameSync();                            // 알바 결과 카드도 바로 걷음
            saveControls.SetEnabled(false);
            foreach (var e in evs)
            {
                SoundEventAdapter.Play(e, closedCoins);
                if (e.h != null) RenderHud(e.h);
                switch (e.t)
                {
                    case "say": yield return Say(e.Str("who"), e.Str("name"), e.Str("text"), e.Str("face")); break;
                    case "hideDlg": HideDialogue(); break;
                    case "scene": SetScene(e.Str("bg"), e.Str("face"), e["night"] is bool nt && nt); break;
                    case "face": SetFace(e.Str("f")); break;
                    case "kim": ShowKim(e["on"] is bool on && on); break;
                    case "npc": stageTitle.text = Ui.Clean(e.Str("kind") != null && D.NPC_NAME.TryGetValue(e.Str("kind"), out var nn) ? nn : LocTitle()); ShowNpc(e.Str("kind")); break;
                    case "toast": Toast(e.Str("text"), e.Str("kind")); if (e.Str("app") == "gall") HoldFace("annoyed"); break;
                    case "bubble": Toast("미래: " + e.Str("text"), "bubble"); SetFace(e.Str("face")); break;
                    case "tip": if (e.Str("bubble") != null) { Toast("미래: " + e.Str("bubble"), "bubble"); SetFace(e.Str("face")); } break;
                    case "casino": Toast($"{e.Str("txt")}  ({G.sgnWon(e.Num("net"))})", e.Num("net") > 0 ? "good" : "liq"); if (e.Num("net") > 0) HoldFace("smug"); yield return new WaitForSeconds(autoSkipDialog ? 0 : 0.35f); break;
                    case "race": { var H = S.pending?.H; string w = H != null && (int)e.Num("win") < H.Count ? H[(int)e.Num("win")].name : "?"; Toast($"1등: {w}  ({G.sgnWon(e.Num("net"))})", e.Num("net") > 0 ? "good" : "liq"); if (e.Num("net") > 0) HoldFace("smug"); break; }
                    case "scratch": Toast(e["prize"] is object[] pz ? $"당첨! {G.won(Convert.ToDouble(pz[1]))}" : "꽝", e["prize"] != null ? "good" : ""); if (e["prize"] != null) HoldFace("smug"); break;
                    case "lottoDraw": Toast($"빚또 추첨: {string.Join("·", (List<int>)e["win"])} → {G.won(e.Num("tot"))}", "news"); break;
                    case "fx":
                        switch (e.Str("k"))
                        {
                            case "big": Toast(e.Str("text") + " " + (e.Str("small") ?? ""), "big"); break;
                            case "flex": HoldFace(ArtCatalog.FaceSprite(e.Num("amt") >= GameSim.LOVE_AMT ? "love" : "flex"), true); break;
                            case "crack": HoldFace("shocked", true); break;
                            case "ash": HoldFace("crying_comic", true); break;
                        }
                        break;
                    case "relic": { var a = D.AUGS.FirstOrDefault(x => x.id == e.Str("id")); if (a != null) { Toast($"유품 획득: {a.name}", "good", ArtCatalog.Relic(a.id)); HoldFace("smug"); } break; }
                    case "gacha": if (e["junk"] != null) Toast("꽝: " + e.Str("text"), "", ArtCatalog.Junk((int)e.Num("junk"))); break;
                    case "bought": SetFace("happy"); break;
                    case "menhera": SetFace(e.Str("face") ?? "menhera"); yield return KakaoBarrage((string[])e["msgs"]); Toast("카톡 " + ((string[])e["msgs"]).Length + "개 폭탄", "liq"); break;
                    case "impBuy": yield return ImpulseAlert(e); break;
                    case "addictEv": if (e.Str("k") == "secret") Toast($"몰래 카지노 {G.sgnWon(e.Num("amt"))}", "liq"); break;
                    case "faint": Toast("기절!", "liq"); HoldFace("dizzy", true); break;
                    case "morning": yield return Morning(e); break;
                    case "opening": yield return PlayScene("opening"); break;
                    case "story": yield return PlayScene(e.Str("key")); break;
                    case "aff": Toast($"미래 호감 {(e.Num("d") > 0 ? "+" : "")}{e.Num("d"):0} → {e.Num("v"):0}", e.Num("d") > 0 ? "good" : "liq"); break;
                    case "watch": if (!phoneOpen) TogglePhone(); break;
                    case "ending": if (e.Str("kind") == "clear" && !(G.v4 && e.Str("variant") == "lonely")) yield return PlayScene("clear"); break;
                    case "error": Debug.LogWarning("[sim] " + e.Str("msg")); break;
                }
            }
            HideDialogue();
            playing = false; FacePlayEnd();

            saveControls.SetEnabled(true);
            if (!evs.Any(e => e.t == "error")) SaveCheckpoint(false);
            RenderAll();
        }

        IEnumerator Say(string who, string name, string text, string face)
        {
            dlg.style.display = DisplayStyle.Flex;
            dlgText.style.display = DisplayStyle.Flex; idleText.style.display = DisplayStyle.None; dlgHint.style.display = DisplayStyle.Flex;
            dlgName.text = Ui.Clean(who == "m" ? "미래" : who == "me" ? "나" : who == "kim" ? "김사장" : who == "npc" ? name : "");
            dlgName.style.display = dlgName.text == "" ? DisplayStyle.None : DisplayStyle.Flex;
            dlgText.style.unityFontStyleAndWeight = who == "nar" ? FontStyle.Italic : FontStyle.Normal;
            dlgText.ResumeAnimation();
            dlgText.Typewriter.ShowText(Ui.Clean(text));
            dlgText.Typewriter.StartShowingText(true);
            UpdateDialogueHint();
            if (face != null) SetFace(face);
            SpeakerArt(who, name, face);
            yield return WaitClick(true);
        }
        IEnumerator WaitClick(bool dialogue = false)
        {
            if (autoSkipDialog)
            {
                if (dialogue) CompleteDialogueText();
                yield return null; yield break;
            }
            waitingForDialogue = dialogue;
            waiting = true; clicked = false; waitFrame = Time.frameCount;
            while (!clicked) yield return null;
            waiting = false; waitingForDialogue = false;
        }
        // ---------- 실시간 (GameSim.Realtime.cs) ----------
        int rtSpeed = 1; float rtAcc, rtPhoneT, rtSaveT;
        /// 고를 게 없는 화면(집·지도·장소·창구)에선 게임 시간이 흐름. 조용한 분은 HUD·차트만 다시 그리고, 무슨 일이 생기면(시간대 끝·청산·상폐) 이벤트 재생
        bool rtDirty, rtWasOpen;
        void RtUpdate()
        {
            if (G == null || !S.rt || playing || waiting || rtSpeed == 0 || mg != null || modal.style.display == DisplayStyle.Flex || !PHONE_OK.Contains(S.pending?.t)) return;
            if (G.v4 && S.pending?.t != "watch") return;   // v4: 장 볼 때만 시간이 흐름
            // 타이머는 매 프레임 쌓음 (예전엔 시계가 1분 갈 때만 쌓여서 폰 글자가 8초에 한 번꼴로만 바뀜)
            float dt = Time.unscaledDeltaTime;
            rtPhoneT += dt; rtSaveT += dt;
            rtAcc += dt * (float)(G.v4 ? D.RULES.V4_WATCH_SPEED : D.RULES.RT_SPEED) * rtSpeed;
            int m = Mathf.Min(30, (int)rtAcc);
            if (m >= 1)
            {
                rtAcc -= m;
                var evs = G.Apply(new SimCommand("tick", "m", m));
                if (evs.Count > 0) { rtAcc = 0; LlmTick(); StartCoroutine(Play(evs)); return; }
                rtDirty = true;
                LiveChart();
            }
            bool held = Input.GetMouseButton(0) || Input.touchCount > 0;   // 누르고 있는 동안엔 다시 그리지 않음 (누름~뗌 사이에 버튼이 바뀌면 클릭이 사라짐)
            if (!held) stkDragging = false;                                 // 막대 끌던 중 다시 그려져서 뗌을 못 받아도 풀리게
            bool flip = G.stockOpen() != rtWasOpen;                         // 장 열림/닫힘이 바뀌면 바로 (매수 버튼)
            if (rtDirty && !held && !stkDragging && (rtPhoneT >= 0.3f || flip))
            {
                rtDirty = false; rtPhoneT = 0; rtWasOpen = G.stockOpen();
                RenderHud(G.HudSnapOf());
                if (G.v4 && S.pending?.t == "watch") RenderPanel();   // 장 보기 상자: 시각·장 열림
                if (phoneOpen) RenderPhone();
                RenderMini();
            }
            if (rtSaveT >= 30f) { rtSaveT = 0; SaveCheckpoint(false); }
        }

        void Update()
        {
            if (dlgText == null) return;
            RtUpdate();
            if (CoachKeys()) return;
            if (!waiting && mg == null && G != null && S.pending?.t != "start")
            {
                if (Input.GetKeyDown(KeyCode.P) || (phoneOpen && Input.GetKeyDown(KeyCode.Escape))) TogglePhone();
            }
            FaceTick();
            if (waitingForDialogue)
            {
                dlgText.Typewriter.UpdateTypewriter();
                UpdateDialogueHint();
            }
            if (!waiting) return;
            if (Input.GetMouseButtonDown(0) || Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return)) RequestAdvance();
        }

        void RequestAdvance()
        {
            if (!waiting || Time.frameCount <= waitFrame || advanceFrame == Time.frameCount) return;
            advanceFrame = Time.frameCount;
            if (waitingForDialogue && dlgText.Typewriter.IsShowingText)
            {
                CompleteDialogueText();
                return;
            }
            clicked = true;
        }

        void CompleteDialogueText()
        {
            dlgText.Typewriter.SkipTypewriter();
            dlgText.SetVisibilityEntireText(true, false);
            UpdateDialogueHint();
        }

        void UpdateDialogueHint()
        {
            dlgHint.text = dlgText.Typewriter.IsShowingText ? "클릭 / Space : 즉시 표시" : "클릭 / Space ▶";
        }

        void HideDialogue()
        {
            dlgText.Typewriter.StopShowingText();
            dlgText.PauseAnimation();
            dlgText.style.display = DisplayStyle.None; idleText.style.display = DisplayStyle.Flex; dlgHint.style.display = DisplayStyle.None;
            if (G != null) SetIdle();
        }

        void OnDestroy()
        {
            dlgText?.Typewriter?.StopShowingText();
            dlgText?.PauseAnimation();
            dlgText?.Typewriter?.Dispose();
            if (Application.isPlaying)
            {
                Destroy(dialogueTiming);
                Destroy(dialogueAnimation);
            }
            else
            {
                DestroyImmediate(dialogueTiming);
                DestroyImmediate(dialogueAnimation);
            }
        }

        IEnumerator PlayScene(string key)
        {
            var steps = D.J["SCENES"]?[key] as JArray;
            if (steps == null) yield break;
            sceneKey = key;
            foreach (JObject st in steps)
            {
                if (st["say"] != null) yield return Say((string)st["say"], (string)st["name"], (string)st["text"], (string)st["face"]);
                else switch ((string)st["do"])
                {
                    case "scene": SetScene((string)st["bg"], (string)st["face"], (bool?)st["night"] == true); break;
                    case "face": SetFace((string)st["f"]); break;
                    case "kim": ShowKim((bool?)st["on"] == true); break;
                    case "hideDlg": HideDialogue(); break;
                    case "rules": yield return RulesCard(); if (key == "opening") ShowCg("opening_box"); break;   // 규칙 뒤 = 유품 상자 장면
                    case "shake": Shake(stage, 18); break;
                    case "flash": Flashback((bool?)st["on"] == true); break;
                    case "card": HideDialogue(); yield return StoryCard((string)st["h"], (string)st["t"], (string)st["sub"], (string)st["chart"]); break;
                }
            }
            Flashback(false);
            sceneKey = null;
            HideDialogue();
        }

        IEnumerator Morning(SimEvent e)
        {
            modal.Clear();
            modal.style.display = DisplayStyle.Flex;
            HoldFace("pajama");   // 밤잠 자고 일어난 아침
            var card = Card(900);
            if (e["v4"] is bool v4 && v4)
            {
                string[] chn = { "빚 공동체", "불장", "과열", "만기" }; int ch = (int)e.Num("ch");
                card.Add(Ui.Label($"☀ {(e.Num("part") > 1 ? "2부 · " : "")}{ch}장 {chn[Math.Max(0, Math.Min(3, ch - 1))]} · {(e.Num("month") - 1) * D.RULES.MONTH_DAYS + e.Num("day")}일째 아침", 40, Ui.Gold, true));
                card.Add(Ui.Label($"원금 만기까지 {e.Num("left")}일" + (e["wk"] is bool wk && wk ? " · 오늘은 주말 (국장 휴장)" : ""), 26, Ui.Accent));
            }
            else card.Add(Ui.Label($"☀ {e.Num("month")}개월차 {e.Num("day")}일 아침", 40, Ui.Gold, true));
            card.Add(Ui.Label(e["paid"] is bool p && p ? "이번 달 이자 냄" : $"이자일까지 D-{e.Num("dd")} · 이자 {G.won(e.Num("due"))}", 26, Ui.Dim));
            var Y = e["Y"] as List<Dictionary<string, object>>;
            if (Y != null && Y.Count > 0)
            {
                card.Add(Ui.Label("어제 결산", 28, Ui.Text, true));
                foreach (var y in Y.Take(8)) card.Add(Ui.Label($"· {y["label"]}  {G.sgnWon(Convert.ToDouble(y["amt"]))}", 22, Convert.ToDouble(y["amt"]) >= 0 ? Ui.Good : Ui.Bad));
                card.Add(Ui.Label($"합계 {G.sgnWon(e.Num("net"))} ({e.Str("netConv")})", 24, Ui.Text, true));
            }
            if (!string.IsNullOrEmpty(e.Str("ev"))) card.Add(Ui.Label("오늘의 사건: " + e.Str("ev"), 24, Ui.Gold));
            card.Add(Ui.Label("미래: " + e.Str("mline"), 24, Ui.Accent));
            card.Add(Ui.Label("(클릭해서 계속)", 20, Ui.Dim));
            modal.Add(card);
            yield return WaitClick();
            modal.style.display = DisplayStyle.None;
        }

        static string ArgValue(string name)
        {
            var a = Environment.GetCommandLineArgs();
            int i = Array.IndexOf(a, name);
            return i >= 0 && i + 1 < a.Length ? a[i + 1] : null;
        }
    }
}
